// test/harness.js - offline Node harness EA File Bridge (iterace 5+)
// Spusteni:  node test/harness.js        (z korene repa nebo odkudkoli)
// Ucel: rychla iterace bez EA - mock COM/EA prostredi, loader vsech
// src/AICodeBridge.*.js pres new Function() (syntax check ES3 kodu),
// funkcni testy klicovych modulu. Harness zije V REPU (lekce 2026-08-20:
// predchozi harness zil jen v sandboxu vlakna a ztratil se).
// Pozn.: harness NEnahrazuje zivy E2E v EA (dual-runtime pasti par. 1a/4
// mock nechyti) - je to prvni sito pred deployem.
"use strict";
var fs = require("fs");
var path = require("path");

var SRC = path.join(__dirname, "..", "src");

// ---------------------------------------------------------------- test runner
var passed = 0, failed = 0, failures = [];
function t(name, fn) {
    try {
        fn();
        passed++;
    } catch (e) {
        failed++;
        failures.push(name + ": " + (e && e.message ? e.message : e));
    }
}
function ok(cond, msg) { if (!cond) { throw new Error(msg || "assert failed"); } }
function eq(a, b, msg) {
    if (a !== b) { throw new Error((msg || "eq") + " - expected [" + b + "], got [" + a + "]"); }
}
function contains(hay, needle, msg) {
    if (("" + hay).indexOf(needle) < 0) { throw new Error((msg || "contains") + " - [" + needle + "] not in [" + ("" + hay).substring(0, 300) + "]"); }
}

// ------------------------------------------------------------- globalni mocky
// Session (EA in-model add-in global)
global.Session = {
    _outputs: [], _prompts: [],
    Output: function (m) { this._outputs.push("" + m); },
    Prompt: function (m, kind) { this._prompts.push({ msg: "" + m, kind: kind }); return 1; }
};

// in-memory souborovy system pro FSO/ADODB mocky
var memFs = { files: {}, folders: {} };
function norm(p) { return ("" + p).replace(/\//g, "\\"); }

function MockFso() {
    this.FileExists = function (p) { return typeof memFs.files[norm(p)] != "undefined"; };
    this.FolderExists = function (p) { return memFs.folders[norm(p)] === 1; };
    this.CreateFolder = function (p) { memFs.folders[norm(p)] = 1; };
    this.DeleteFile = function (p) { delete memFs.files[norm(p)]; };
    this.MoveFile = function (a, b) { memFs.files[norm(b)] = memFs.files[norm(a)]; delete memFs.files[norm(a)]; };
    this.GetParentFolderName = function (p) { var s = norm(p); return s.substring(0, s.lastIndexOf("\\")); };
    this.GetFileName = function (p) { var s = norm(p); return s.substring(s.lastIndexOf("\\") + 1); };
    this.GetTempName = function () { return "tmp" + Math.floor(Math.random() * 1e6) + ".tmp"; };
    this.BuildPath = function (a, b) { return norm(a) + "\\" + b; };
}
function MockAdoStream() {
    var self = this;
    this.Type = 2; this.Charset = "utf-8"; this._buf = "";
    this.Open = function () { };
    this.Close = function () { };
    this.WriteText = function (tx) { self._buf += "" + tx; };
    this.SaveToFile = function (p) { memFs.files[norm(p)] = self._buf; };
    this.LoadFromFile = function (p) {
        if (typeof memFs.files[norm(p)] == "undefined") { throw new Error("mock: soubor neexistuje: " + p); }
        self._buf = memFs.files[norm(p)];
    };
    this.ReadText = function () { return self._buf; };
    this.Read = function () { throw new Error("mock: binarni Read jen v JScript runtime"); };
}
var mockClipboard = { text: "" };
function MockHtmlfile() {
    this.parentWindow = {
        clipboardData: {
            getData: function () { return mockClipboard.text; },
            setData: function (fmt, v) { mockClipboard.text = "" + v; return true; }
        }
    };
}
function MockShell() {
    this.Run = function () { return 0; };
    this.Exec = function () { return { Status: 1, StdIn: { Write: function () { }, Close: function () { } } }; };
    this.ExpandEnvironmentStrings = function (s) { return ("" + s).replace(/%USERPROFILE%/gi, "C:\\Users\\harness"); };
}
function comFactory(progId) {
    var p = ("" + progId).toLowerCase();
    if (p.indexOf("filesystemobject") >= 0) { return new MockFso(); }
    if (p.indexOf("adodb.stream") >= 0) { return new MockAdoStream(); }
    if (p == "htmlfile") { return new MockHtmlfile(); }
    if (p.indexOf("wscript.shell") >= 0) { return new MockShell(); }
    if (p.indexOf("msxml") >= 0) { return { createElement: function () { return {}; } }; }
    throw new Error("mock: neznamy COM progId " + progId);
}
global.ActiveXObject = function (progId) { return comFactory(progId); };
global.COMObject = function (progId) { return comFactory(progId); };

// ----------------------------------------------------------------- EA mocky
function mkColl(factory) {
    var items = [];
    var coll = {
        _items: items,
        GetAt: function (i) { return items[i]; },
        AddNew: function (name, type) {
            var it = factory ? factory(name, type) : { Name: name, Type: type, Update: function () { } };
            items.push(it);
            return it;
        },
        Refresh: function () { },
        DeleteAt: function (i) { items.splice(i, 1); }
    };
    Object.defineProperty(coll, "Count", { get: function () { return items.length; } });
    return coll;
}
var guidSeq = 1000;
function mkGuid() { guidSeq++; return "{HARNESS-0000-0000-0000-" + ("000000000000" + guidSeq).slice(-12) + "}"; }
function mkElement(props) {
    var el = {
        ElementID: props.id || ++guidSeq,
        ElementGUID: props.guid || mkGuid(),
        Name: props.name || "El",
        Type: props.type || "Class",
        Stereotype: props.stereotype || "",
        Notes: "",
        Alias: "",
        PackageID: props.packageID || 0,
        ParentID: props.parentID || 0,
        TaggedValues: mkColl(function (n) { return { Name: n, Value: "", Update: function () { } }; }),
        Update: function () { return true; }
    };
    return el;
}
function mkPackage(props) {
    var pkg = {
        PackageID: props.id || ++guidSeq,
        PackageGUID: props.guid || mkGuid(),
        Name: props.name || "Pkg",
        ParentID: props.parentID || 0,
        Element: { ElementID: props.elementID || (10000 + (props.id || 0)) },
        Elements: mkColl(function (n, ty) { return mkElement({ name: n, type: ty }); }),
        Packages: mkColl(function (n) { return mkPackage({ name: n }); })
    };
    return pkg;
}
function xmlRows(rows) {
    var out = "<EADATA><Dataset_0><Data>";
    for (var i = 0; i < rows.length; i++) {
        out += "<Row>";
        for (var k in rows[i]) {
            if (Object.prototype.hasOwnProperty.call(rows[i], k)) {
                out += "<" + k + ">" + ("" + rows[i][k]).replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</" + k + ">";
            }
        }
        out += "</Row>";
    }
    return out + "</Data></Dataset_0></EADATA>";
}
// mock Repository: konfigurovatelny pres opts
function mkRepo(opts) {
    opts = opts || {};
    var elements = {};   // id -> element
    var elByGuid = {};
    var packages = {};   // id -> package
    var pkgByGuid = {};
    var repo = {
        _output: [],
        _shown: [],
        _refreshed: [],
        _sqlRules: opts.sqlRules || [],
        ConnectionString: opts.connectionString || "C:\\HARNESS\\EAEXAMPLE.QEA",
        RepositoryType: function () { return opts.repositoryType || "JET"; },
        SQLQuery: function (sql) {
            for (var i = 0; i < repo._sqlRules.length; i++) {
                var r = repo._sqlRules[i];
                if (r.re.test(sql)) { return xmlRows(typeof r.rows == "function" ? r.rows(sql) : r.rows); }
            }
            return xmlRows([]);
        },
        GetElementByID: function (id) { return elements[id] || null; },
        GetElementByGuid: function (g) { return elByGuid[g] || null; },
        GetPackageByID: function (id) { return packages[id] || null; },
        GetPackageByGuid: function (g) { return pkgByGuid[g] || null; },
        CreateOutputTab: function () { },
        EnsureOutputVisible: function () { },
        WriteOutput: function (tab, text, id) { repo._output.push({ tab: tab, text: "" + text, id: id }); },
        ShowInProjectView: function (o) { repo._shown.push(o); },
        RefreshModelView: function (id) { repo._refreshed.push(id); },
        GetTreeSelectedItemType: function () { return (typeof opts.treeSelectedType != "undefined") ? opts.treeSelectedType : 0; },
        GetTreeSelectedObject: function () { return opts.treeSelectedObject || null; },
        GetTreeSelectedElements: function () { return opts.treeSelectedElements || mkColl(); },
        GetCurrentDiagram: function () { return opts.currentDiagram || null; },
        GetCurrentLoginUser: function (asGuid) {
            if (opts.loginThrows) { throw new Error("mock: security vypnuta"); }
            return asGuid ? (opts.loginGuid || "") : (opts.login || "");
        }
    };
    Object.defineProperty(repo, "IsSecurityEnabled", {
        get: function () { return opts.securityEnabled === true; }
    });
    repo._addElement = function (props) {
        var el = mkElement(props);
        elements[el.ElementID] = el; elByGuid[el.ElementGUID] = el;
        return el;
    };
    repo._addPackage = function (props) {
        var pkg = mkPackage(props);
        packages[pkg.PackageID] = pkg; pkgByGuid[pkg.PackageGUID] = pkg;
        return pkg;
    };
    return repo;
}

// ------------------------------------------------------------------- loader
// Hlavicka  // AICodeBridge.Nazev(args)  urcuje jmeno + argumenty metody.
// Bez zavorek (EA_ lifecycle handlery) -> zname signatury, jinak fallback.
var KNOWN_ARGS = {
    EA_Connect: ["Repository"],
    EA_GetMenuItems: ["Repository", "MenuLocation", "MenuName"],
    EA_MenuClick: ["Repository", "MenuLocation", "ItemName"],
    EA_GetMenuState: ["Repository", "MenuLocation", "MenuName", "ItemName", "IsEnabled", "IsChecked"]
};
function loadBridge() {
    var bridge = {};
    var files = fs.readdirSync(SRC).filter(function (f) { return /^AICodeBridge\..+\.js$/.test(f); });
    var loaded = [];
    files.forEach(function (f) {
        var code = fs.readFileSync(path.join(SRC, f), "utf8").replace(/^\uFEFF/, "");
        var name = f.replace(/^AICodeBridge\./, "").replace(/\.js$/, "");
        var m = /^\/\/\s*AICodeBridge\.([A-Za-z0-9_]+)\s*\(([^)]*)\)/.exec(code);
        var args;
        if (m && m[1] === name) {
            args = m[2].split(",").map(function (a) { return a.trim(); }).filter(function (a) { return a !== ""; });
        } else if (KNOWN_ARGS[name]) {
            args = KNOWN_ARGS[name];
        } else {
            args = ["Repository", "a1", "a2", "a3", "a4", "a5"];
        }
        t("syntax: " + f, function () {
            var fn = Function.apply(null, args.concat([code]));
            bridge[name] = fn;
        });
        loaded.push(name);
    });
    return { bridge: bridge, files: files, names: loaded };
}

// -------------------------------------------------------------------- testy
var L = loadBridge();
var B = L.bridge;

// pravidlo ActiveXObject: primy vyskyt jen v allowlistu (JScript-only /
// typeof-guard soubory); vsude jinde VYHRADNE this.FB_ComObj (par. 1a)
t("pravidlo: ActiveXObject jen v allowlistu", function () {
    var allow = { "AICodeBridge.FB_ComObj.js": 1, "AICodeBridge.FB_FileBytes.js": 1,
                  "AICodeBridge.FB_OpDeploySrc.js": 1, "AICodeBridge.FB_ProcessFolder.js": 1 };
    var bad = [];
    L.files.forEach(function (f) {
        if (allow[f]) { return; }
        var code = fs.readFileSync(path.join(SRC, f), "utf8");
        code.split(/\r?\n/).forEach(function (line, i) {
            var noComment = line.replace(/\/\/.*$/, "");
            if (/ActiveXObject/.test(noComment) && !/typeof\s+ActiveXObject/.test(noComment)) {
                bad.push(f + ":" + (i + 1));
            }
        });
    });
    ok(bad.length === 0, "primy ActiveXObject mimo allowlist: " + bad.join(", "));
});

// --- FB_ElementPath: teckova cesta elementu pres package retez
t("FB_ElementPath: element -> teckova cesta", function () {
    var repo = mkRepo();
    var root = repo._addPackage({ id: 1, name: "Model" });
    var sub = repo._addPackage({ id: 2, name: "Domain", parentID: 1 });
    var el = repo._addElement({ id: 11, name: "Zakaznik", packageID: 2 });
    eq(B.FB_ElementPath.call(B, repo, "element", el), "Model.Domain.Zakaznik");
});

// --- FB_LogChanges (iterace 5, B-V1): radky nesou ElementID pro nativni
// dvojklik-navigaci v Output tabu (WriteOutput 3. param; GUI-KATALOG par. 5)
t("FB_LogChanges: vytvoreny element -> WriteOutput s jeho ElementID", function () {
    var repo = mkRepo();
    repo._addPackage({ id: 1, name: "Model" });
    var el = repo._addElement({ id: 42, name: "NovyPrvek", packageID: 1 });
    var resp = { id: "t-log-1", results: [
        { op: "create_or_update_elements", status: "ok", items: [{ id: 42, name: "NovyPrvek", created: true }] }
    ] };
    var n = B.FB_LogChanges.call(B, repo, resp);
    ok(n >= 1, "zadny radek");
    var withId = repo._output.filter(function (o) { return o.id === 42; });
    eq(withId.length, 1, "radek zmeny nenese ElementID 42");
    contains(withId[0].text, "NovyPrvek");
});
t("FB_LogChanges: smazany prvek -> id 0 (neni kam navigovat)", function () {
    var repo = mkRepo();
    var resp = { id: "t-log-2", results: [
        { op: "delete_from_model", status: "ok", items: [{ type: "Element", id: 99, name: "Pryc", path: "Model.Pryc" }] }
    ] };
    B.FB_LogChanges.call(B, repo, resp);
    var del = repo._output.filter(function (o) { return o.text.indexOf("smazano") >= 0; });
    eq(del.length, 1, "chybi radek smazano");
    eq(del[0].id, 0, "smazany radek nema mit navigacni id");
});
t("FB_LogChanges: package item -> id = Package.Element.ElementID", function () {
    var repo = mkRepo();
    var pkg = repo._addPackage({ id: 7, name: "NovyPkg", elementID: 10007 });
    var resp = { id: "t-log-3", results: [
        { op: "create_or_update_package", status: "ok", items: [{ id: 7, guid: pkg.PackageGUID, name: "NovyPkg", created: true, kind: "package" }] }
    ] };
    B.FB_LogChanges.call(B, repo, resp);
    var withId = repo._output.filter(function (o) { return o.id === 10007; });
    eq(withId.length, 1, "radek package nenese Element.ElementID");
});

// --- FB_Changes (iterace 5, B-V2): Add-in Search - dotcene prvky davky
function changesSqlRules(reqId) {
    return [
        { re: /ai\.request/i, rows: [
            { Object_ID: 42, ea_guid: "{CHANGED-42}", Name: "NovyPrvek", Object_Type: "Class", Stereotype: "" }
        ] }
    ];
}
t("FB_Changes: SearchText id -> ReportViewData s CLASSGUID/CLASSTYPE", function () {
    var repo = mkRepo({ sqlRules: changesSqlRules("t-ch-1") });
    repo._addPackage({ id: 1, name: "Model" });
    repo._addElement({ id: 42, guid: "{CHANGED-42}", name: "NovyPrvek", packageID: 1 });
    var holder = { val: "" };
    var r = B.FB_Changes.call(B, repo, "t-ch-1", holder);
    eq(r, "T");
    contains(holder.val, "CLASSGUID");
    contains(holder.val, "{CHANGED-42}");
    contains(holder.val, "CLASSTYPE");
    contains(holder.val, "Class");
    contains(holder.val, "Model.NovyPrvek", "vysledek nenese teckovou cestu");
});
t("FB_Changes: prazdny SearchText -> pouzije posledni zapisovou davku", function () {
    var repo = mkRepo({ sqlRules: changesSqlRules("t-ch-2") });
    repo._addPackage({ id: 1, name: "Model" });
    repo._addElement({ id: 42, guid: "{CHANGED-42}", name: "NovyPrvek", packageID: 1 });
    B._fbLastWriteReqId = "t-ch-2";
    var holder = { val: "" };
    var r = B.FB_Changes.call(B, repo, "", holder);
    eq(r, "T");
    contains(holder.val, "t-ch-2", "id davky ma byt ve vysledku");
    delete B._fbLastWriteReqId;
});
t("FB_Changes: zadna posledni davka ani id -> informacni radek, zadny pad", function () {
    var repo = mkRepo();
    delete B._fbLastWriteReqId;
    var holder = { val: "" };
    var r = B.FB_Changes.call(B, repo, "", holder);
    eq(r, "T");
    contains(holder.val.toLowerCase(), "zadn", "ocekavan informacni radek");
});

// --- FB_UserAccess (iterace 5, A): write autorizace pres EA security skupinu
function accessRepo(opts) {
    var rules = [];
    if (opts.groups) {
        rules.push({ re: /t_secgroup/i, rows: opts.groups.map(function (g) { return { GroupName: g }; }) });
    }
    if (opts.sqlThrows) {
        rules.push({ re: /t_secgroup/i, rows: function () { throw new Error("mock: tabulka neexistuje"); } });
    }
    return mkRepo({
        securityEnabled: opts.securityEnabled,
        login: opts.login,
        sqlRules: rules
    });
}
t("FB_UserAccess: security VYPNUTA -> write (vse povoleno, rozhodnuti Milos)", function () {
    delete B._fbAccessCache;
    var repo = accessRepo({ securityEnabled: false });
    var a = B.FB_UserAccess.call(B, repo);
    eq(a.access, "write");
    eq(a.securityEnabled, false);
});
t("FB_UserAccess: security ON + clen write skupiny -> write", function () {
    delete B._fbAccessCache;
    var repo = accessRepo({ securityEnabled: true, login: "novak", groups: ["@F002_Write", "@FX_AI_Write"] });
    var orig = B.FB_AccessGroups;
    B.FB_AccessGroups = function () { return [{ repo: "EAEXAMPLE.QEA", writeGroups: ["@FX_AI_Write"] }]; };
    var a = B.FB_UserAccess.call(B, repo);
    B.FB_AccessGroups = orig;
    eq(a.access, "write", "clen skupiny ma mit write: " + a.reason);
    eq(a.login, "novak");
});
t("FB_UserAccess: security ON + neclen -> read (fail-closed)", function () {
    delete B._fbAccessCache;
    var repo = accessRepo({ securityEnabled: true, login: "novak", groups: ["@F004_Read-Only"] });
    var orig = B.FB_AccessGroups;
    B.FB_AccessGroups = function () { return [{ repo: "EAEXAMPLE.QEA", writeGroups: ["@FX_AI_Write"] }]; };
    var a = B.FB_UserAccess.call(B, repo);
    B.FB_AccessGroups = orig;
    eq(a.access, "read", "neclen nesmi mit write");
});
t("FB_UserAccess: security ON + repo bez polozky v konfiguraci -> read (fail-closed)", function () {
    delete B._fbAccessCache;
    var repo = accessRepo({ securityEnabled: true, login: "novak", groups: ["@FX_AI_Write"] });
    var orig = B.FB_AccessGroups;
    B.FB_AccessGroups = function () { return [{ repo: "JINY_REPO", writeGroups: ["@FX_AI_Write"] }]; };
    var a = B.FB_UserAccess.call(B, repo);
    B.FB_AccessGroups = orig;
    eq(a.access, "read", "repo bez polozky = fail-closed read");
});
t("FB_UserAccess: security ON + SQL clenstvi selze -> read (fail-closed) + duvod", function () {
    delete B._fbAccessCache;
    var repo = accessRepo({ securityEnabled: true, login: "novak", sqlThrows: true });
    var orig = B.FB_AccessGroups;
    B.FB_AccessGroups = function () { return [{ repo: "EAEXAMPLE.QEA", writeGroups: ["@FX_AI_Write"] }]; };
    var a = B.FB_UserAccess.call(B, repo);
    B.FB_AccessGroups = orig;
    eq(a.access, "read");
    ok(("" + a.reason).length > 0, "chybi duvod");
});
t("FB_UserAccess: cache per repo (druhe volani bez SQL)", function () {
    delete B._fbAccessCache;
    var calls = 0;
    var repo = mkRepo({ securityEnabled: true, login: "novak",
        sqlRules: [{ re: /t_secgroup/i, rows: function () { calls++; return [{ GroupName: "@FX_AI_Write" }]; } }] });
    var orig = B.FB_AccessGroups;
    B.FB_AccessGroups = function () { return [{ repo: "EAEXAMPLE.QEA", writeGroups: ["@FX_AI_Write"] }]; };
    B.FB_UserAccess.call(B, repo);
    B.FB_UserAccess.call(B, repo);
    B.FB_AccessGroups = orig;
    eq(calls, 1, "clenstvi se ma cachovat per session");
    delete B._fbAccessCache;
});

// --- FB_Main gate E_ADDIN_ACCESS (A): zapisova davka bez write pristupu
function mainRepoBase(opts) {
    opts = opts || {};
    var rules = (opts.sqlRules || []).concat([
        { re: /#AI-LOG/i, rows: [] } // audit package neexistuje -> audit "" (nesmi shodit)
    ]);
    var repo = mkRepo({
        securityEnabled: opts.securityEnabled, login: opts.login, sqlRules: rules
    });
    return repo;
}
t("FB_Main: zapisova davka + access read -> E_ADDIN_ACCESS, nic neprovedeno", function () {
    delete B._fbAccessCache;
    var repo = mainRepoBase({ securityEnabled: true, login: "novak" });
    var orig = B.FB_AccessGroups;
    B.FB_AccessGroups = function () { return [{ repo: "EAEXAMPLE.QEA", writeGroups: ["@FX_AI_Write"] }]; };
    // clenstvi: zadna skupina (SQL vrati prazdno) -> read
    var out = B.FB_Main.call(B, repo, JSON.stringify({
        protocol: "eafb/0.2", id: "t-acc-1", repo: "EAEXAMPLE.QEA",
        ops: [{ op: "create_or_update_package", parent: "{X}", name: "Pkg" }]
    }));
    B.FB_AccessGroups = orig;
    delete B._fbAccessCache;
    var resp = JSON.parse(out);
    eq(resp.code, "E_ADDIN_ACCESS", "ocekavan E_ADDIN_ACCESS: " + out.substring(0, 200));
    eq(resp.results.length, 1);
    eq(resp.results[0].status, "skipped");
});
t("FB_Main: cteci davka + access read -> probehne (ping ok)", function () {
    delete B._fbAccessCache;
    var repo = mainRepoBase({ securityEnabled: true, login: "novak" });
    var orig = B.FB_AccessGroups;
    B.FB_AccessGroups = function () { return [{ repo: "EAEXAMPLE.QEA", writeGroups: ["@FX_AI_Write"] }]; };
    var out = B.FB_Main.call(B, repo, JSON.stringify({
        protocol: "eafb/0.2", id: "t-acc-2", repo: "EAEXAMPLE.QEA",
        ops: [{ op: "ping", echo: "ahoj" }]
    }));
    B.FB_AccessGroups = orig;
    delete B._fbAccessCache;
    var resp = JSON.parse(out);
    eq(resp.status, "done", "cteci davka ma projit: " + out.substring(0, 300));
});
t("FB_Main: security VYPNUTA + zapis -> gate nebrani (E_ADDIN_ACCESS se nevyda)", function () {
    delete B._fbAccessCache;
    var repo = mainRepoBase({ securityEnabled: false });
    var out = B.FB_Main.call(B, repo, JSON.stringify({
        protocol: "eafb/0.2", id: "t-acc-3", repo: "EAEXAMPLE.QEA",
        ops: [{ op: "create_or_update_package", parent: "{NEEXISTUJE}", name: "Pkg" }]
    }));
    delete B._fbAccessCache;
    var resp = JSON.parse(out);
    ok(resp.code !== "E_ADDIN_ACCESS", "security off nesmi blokovat: " + out.substring(0, 200));
});

// --- FB_OpSelectedContext (iterace 5, C): get_selected_context
t("get_selected_context: vybrany element -> type/guid/path/branch/inWhitelist", function () {
    var repo = mkRepo();
    var root = repo._addPackage({ id: 1, name: "Model" });
    var sub = repo._addPackage({ id: 2, name: "Domain", parentID: 1, guid: "{PKG-DOMAIN}" });
    var el = repo._addElement({ id: 11, guid: "{EL-ZAK}", name: "Zakaznik", type: "Class", packageID: 2 });
    repo.GetTreeSelectedItemType = function () { return 4; };
    repo.GetTreeSelectedObject = function () { return el; };
    var origWl = B.FB_Whitelist;
    B.FB_Whitelist = function () { return [{ repo: "EAEXAMPLE.QEA", pkg: "{PKG-DOMAIN}" }]; };
    var r = B.FB_OpSelectedContext.call(B, repo, { op: "get_selected_context" });
    B.FB_Whitelist = origWl;
    eq(r.status, "ok");
    eq(r.selected, true);
    eq(r.context.type, "Element");
    eq(r.context.guid, "{EL-ZAK}");
    eq(r.context.path, "Model.Domain.Zakaznik");
    eq(r.context.branchGuid, "{PKG-DOMAIN}");
    eq(r.context.inWhitelist, true);
});
t("get_selected_context: vybrany package -> branch = on sam", function () {
    var repo = mkRepo();
    var root = repo._addPackage({ id: 1, name: "Model" });
    var sub = repo._addPackage({ id: 2, name: "Domain", parentID: 1, guid: "{PKG-DOMAIN}" });
    repo.GetTreeSelectedItemType = function () { return 5; };
    repo.GetTreeSelectedObject = function () { return sub; };
    var origWl = B.FB_Whitelist;
    B.FB_Whitelist = function () { return [{ repo: "EAEXAMPLE.QEA", pkg: "{JINY}" }]; };
    var r = B.FB_OpSelectedContext.call(B, repo, { op: "get_selected_context" });
    B.FB_Whitelist = origWl;
    eq(r.context.type, "Package");
    eq(r.context.branchGuid, "{PKG-DOMAIN}");
    eq(r.context.inWhitelist, false, "package mimo whitelist");
});
t("get_selected_context: nic nevybrano -> selected:false, status ok", function () {
    var repo = mkRepo();
    var r = B.FB_OpSelectedContext.call(B, repo, { op: "get_selected_context" });
    eq(r.status, "ok");
    eq(r.selected, false);
});
t("get_selected_context: multi-vyber elementu -> selectedElements[]", function () {
    var repo = mkRepo();
    repo._addPackage({ id: 1, name: "Model" });
    var e1 = repo._addElement({ id: 21, name: "A", packageID: 1 });
    var e2 = repo._addElement({ id: 22, name: "B", packageID: 1 });
    var coll = mkColl(); coll._items.push(e1, e2);
    repo.GetTreeSelectedItemType = function () { return 4; };
    repo.GetTreeSelectedObject = function () { return e1; };
    repo.GetTreeSelectedElements = function () { return coll; };
    var r = B.FB_OpSelectedContext.call(B, repo, { op: "get_selected_context" });
    eq(r.selectedElements.length, 2);
    eq(r.selectedElements[1].name, "B");
});
t("get_selected_context: otevreny diagram -> currentDiagram", function () {
    var repo = mkRepo();
    repo.GetCurrentDiagram = function () {
        return { DiagramID: 77, DiagramGUID: "{DGM-77}", Name: "Prehled", Type: "Logical" };
    };
    var r = B.FB_OpSelectedContext.call(B, repo, { op: "get_selected_context" });
    ok(r.currentDiagram, "chybi currentDiagram");
    eq(r.currentDiagram.guid, "{DGM-77}");
});

// --- scope na find_* (iterace 5, C): omezeni na vetev vyberu
t("find_elements_by_name + scope: prvek ve vetvi projde, mimo vetev ne", function () {
    var repo = mkRepo({ sqlRules: [
        { re: /FROM t_object WHERE Name = 'Zakaznik'/i, rows: [
            { Object_ID: 11, ea_guid: "{IN}", Name: "Zakaznik", Object_Type: "Class", Stereotype: "", Package_ID: 3 },
            { Object_ID: 12, ea_guid: "{OUT}", Name: "Zakaznik", Object_Type: "Class", Stereotype: "", Package_ID: 9 }
        ] }
    ] });
    var root = repo._addPackage({ id: 2, name: "Domain", guid: "{PKG-DOMAIN}" });
    repo._addPackage({ id: 3, name: "Sub", parentID: 2 });
    repo._addPackage({ id: 9, name: "Jinde", parentID: 0 });
    var r = B.FB_OpFindElements.call(B, repo, { op: "find_elements_by_name", name: "Zakaznik", scope: "{PKG-DOMAIN}" });
    eq(r.status, "ok");
    eq(r.count, 1, "scope mel odfiltrovat prvek mimo vetev");
    eq(r.items[0].guid, "{IN}");
    ok(r.scope && r.scope.guid === "{PKG-DOMAIN}", "response ma nest scope");
});
t("find_packages_by_name + scope: filtr dle vetve", function () {
    var repo = mkRepo({ sqlRules: [
        { re: /FROM t_package WHERE Name = 'Sub'/i, rows: [
            { Package_ID: 3, ea_guid: "{P-IN}", Name: "Sub", Parent_ID: 2 },
            { Package_ID: 9, ea_guid: "{P-OUT}", Name: "Sub", Parent_ID: 0 }
        ] }
    ] });
    repo._addPackage({ id: 2, name: "Domain", guid: "{PKG-DOMAIN}" });
    repo._addPackage({ id: 3, name: "Sub", parentID: 2 });
    repo._addPackage({ id: 9, name: "Sub", parentID: 0 });
    var r = B.FB_OpFindPackages.call(B, repo, { op: "find_packages_by_name", name: "Sub", scope: "{PKG-DOMAIN}" });
    eq(r.count, 1);
    eq(r.items[0].guid, "{P-IN}");
});
t("find_elements_by_name bez scope: chovani beze zmeny (oba nalezy)", function () {
    var repo = mkRepo({ sqlRules: [
        { re: /FROM t_object WHERE Name = 'Zakaznik'/i, rows: [
            { Object_ID: 11, ea_guid: "{IN}", Name: "Zakaznik", Object_Type: "Class", Stereotype: "", Package_ID: 3 },
            { Object_ID: 12, ea_guid: "{OUT}", Name: "Zakaznik", Object_Type: "Class", Stereotype: "", Package_ID: 9 }
        ] }
    ] });
    var r = B.FB_OpFindElements.call(B, repo, { op: "find_elements_by_name", name: "Zakaznik" });
    eq(r.count, 2, "bez scope se nic filtrovat nesmi");
});

// --- FB_NavProbe (iterace 5, B-V3 spike): krokovaci sonda navigace
t("FB_NavProbe: kazde volani = 1 krok, loguje START/OK, cykluje", function () {
    var repo = mkRepo({ sqlRules: [
        { re: /AICodeBridge/i, rows: [{ Object_ID: 11037, ea_guid: "{BRIDGE}" }] }
    ] });
    repo._addElement({ id: 11037, guid: "{BRIDGE}", name: "AICodeBridge", packageID: 1 });
    repo._addPackage({ id: 1, name: "Model" });
    delete B._fbNavStep;
    var out1 = "" + B.FB_NavProbe.call(B, repo);
    contains(out1, "krok 1");
    var out2 = "" + B.FB_NavProbe.call(B, repo);
    contains(out2, "krok 2");
    ok(repo._output.length >= 2, "kroky se maji logovat do Output");
    delete B._fbNavStep;
});

// --- regrese jadra: FB_Main ping (legacy textovy kontrakt drzi)
t("FB_Main: ping davka -> done + echo", function () {
    delete B._fbAccessCache;
    var repo = mainRepoBase({ securityEnabled: false });
    var out = B.FB_Main.call(B, repo, JSON.stringify({
        protocol: "eafb/0.2", id: "t-ping", repo: "EAEXAMPLE.QEA",
        ops: [{ op: "ping", echo: "harness" }]
    }));
    var resp = JSON.parse(out);
    eq(resp.status, "done");
    eq(resp.results[0].echo, "harness");
});
t("FB_Main: E_REPO pri neshode deklarace repo", function () {
    var repo = mainRepoBase({});
    var out = B.FB_Main.call(B, repo, JSON.stringify({
        protocol: "eafb/0.2", id: "t-repo", repo: "EMR_PROD",
        ops: [{ op: "ping" }]
    }));
    var resp = JSON.parse(out);
    eq(resp.code, "E_REPO");
});
t("FB_Main: podvrzene potvrzovaci pole -> E_RISK_CONFIRM", function () {
    var repo = mainRepoBase({});
    var out = B.FB_Main.call(B, repo, JSON.stringify({
        protocol: "eafb/0.2", id: "t-b1", repo: "EAEXAMPLE.QEA", nonce: "xxx",
        ops: [{ op: "ping" }]
    }));
    var resp = JSON.parse(out);
    eq(resp.code, "E_RISK_CONFIRM");
});
t("FB_XmlRows: entity unescape + vice radku", function () {
    var rows = B.FB_XmlRows.call(B, xmlRows([{ A: "x<y", B: "1" }, { A: "z", B: "2" }]));
    eq(rows.length, 2);
    eq(rows[0].A, "x<y");
});

// ------------------------------------------------------------------ vysledek
console.log("");
console.log("EA File Bridge offline harness: " + passed + "/" + (passed + failed) + " PASS");
if (failed > 0) {
    console.log("");
    failures.forEach(function (f) { console.log("FAIL " + f); });
    process.exit(1);
}
