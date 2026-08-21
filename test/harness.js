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
    this.GetFolder = function (p) {
        var prefix = norm(p);
        var out = [];
        for (var k in memFs.files) {
            if (k.indexOf(prefix) === 0 && k.substring(prefix.length).indexOf("\\") < 0) {
                out.push({ Name: k.substring(prefix.length), Path: k });
            }
        }
        return { Files: out };
    };
}
// WSH Enumerator (JScript) - iterace nad kolekci/polem
global.Enumerator = function (coll) {
    var items = (coll && coll._items) ? coll._items : (coll || []);
    var idx = 0;
    this.atEnd = function () { return idx >= items.length; };
    this.moveNext = function () { idx++; };
    this.item = function () { return items[idx]; };
};
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

// --- FB_StateFile (par. 1a/5): perzistentni mini-stav v baseDir
t("FB_StateFile: write -> read -> delete", function () {
    var repo = mkRepo();
    B.FB_StateFile.call(B, repo, "harness", "hodnota-42");
    eq(B.FB_StateFile.call(B, repo, "harness"), "hodnota-42");
    B.FB_StateFile.call(B, repo, "harness", null);
    eq(B.FB_StateFile.call(B, repo, "harness"), "", "po delete ma byt prazdno");
});

// --- FB_NavProbe (iterace 5, B-V3 spike): krokovaci sonda navigace
t("FB_NavProbe: krok prezije i ztratu in-memory stavu (EA runtime, par. 1a/5)", function () {
    var repo = mkRepo({ sqlRules: [
        { re: /AICodeBridge/i, rows: [{ Object_ID: 11037, ea_guid: "{BRIDGE}" }] }
    ] });
    repo._addElement({ id: 11037, guid: "{BRIDGE}", name: "AICodeBridge", packageID: 1 });
    repo._addPackage({ id: 1, name: "Model" });
    delete B._fbNavStep;
    B.FB_StateFile.call(B, repo, "navprobe", null); // cisty start
    var out1 = "" + B.FB_NavProbe.call(B, repo);
    contains(out1, "krok 1");
    delete B._fbNavStep; // simulace EA runtime: nova instance mezi kliky
    var out2 = "" + B.FB_NavProbe.call(B, repo);
    contains(out2, "krok 2", "citac musi prezit ve state souboru");
    ok(repo._output.length >= 2, "kroky se maji logovat do Output");
    delete B._fbNavStep;
    B.FB_StateFile.call(B, repo, "navprobe", null);
});

// --- EA_OnOutputItemDoubleClicked (K3 korekce): (Repository, Info) + navigace
function mkInfo(props) {
    return {
        Count: props.length,
        Get: function (i) { return props[i]; }
    };
}
t("dblclick handler: zabalene EventProperty argumenty (.Value) -> ShowInProjectView", function () {
    // realny tvar dle ziveho debugu v3: kazdy argument = objekt s .Value
    var repo = mkRepo();
    repo._addPackage({ id: 1, name: "Model" });
    repo._addElement({ id: 42, name: "NovyPrvek", packageID: 1 });
    B.EA_OnOutputItemDoubleClicked.call(B, repo,
        { Value: "AI Bridge" }, { Value: "[vytvoreno] ..." }, { Value: 42 });
    eq(repo._shown.length, 1, "melo se navigovat");
    eq(repo._shown[0].ElementID, 42);
});
t("dblclick handler: pozicni argumenty (jako EA_MenuClick) -> ShowInProjectView", function () {
    var repo = mkRepo();
    repo._addPackage({ id: 1, name: "Model" });
    repo._addElement({ id: 42, name: "NovyPrvek", packageID: 1 });
    B.EA_OnOutputItemDoubleClicked.call(B, repo, "AI Bridge", "[vytvoreno] ...", 42);
    eq(repo._shown.length, 1, "pozicni tvar ma navigovat");
    eq(repo._shown[0].ElementID, 42);
});
t("dblclick handler: cizi tab -> zadna navigace", function () {
    var repo = mkRepo();
    repo._addElement({ id: 42, name: "X", packageID: 1 });
    B.EA_OnOutputItemDoubleClicked.call(B, repo, mkInfo([
        { Name: "TabName", Value: "Script" },
        { Name: "LineText", Value: "x" },
        { Name: "ID", Value: 42 }
    ]));
    eq(repo._shown.length, 0);
});
t("FB_Changes: fallback na state soubor lastwrite (EA runtime)", function () {
    var repo = mkRepo({ sqlRules: changesSqlRules("t-ch-4") });
    repo._addPackage({ id: 1, name: "Model" });
    repo._addElement({ id: 42, guid: "{CHANGED-42}", name: "NovyPrvek", packageID: 1 });
    delete B._fbLastWriteReqId;
    B.FB_StateFile.call(B, repo, "lastwrite", "t-ch-4");
    var holder = { val: "" };
    B.FB_Changes.call(B, repo, "", holder);
    contains(holder.val, "t-ch-4", "id se ma vzit ze state souboru");
    B.FB_StateFile.call(B, repo, "lastwrite", null);
});

// --- deploy_src: sync signatury existujici operace (lekce K3 iterace 5 -
// zmena hlavicky se drive tise nepropsala, Log bez id = mrtvy dvojklik)
t("deploy_src: existujici operace s novym parametrem -> parametry se prestavi", function () {
    memFs.folders["C:\\HARNSRC\\"] = 1;
    memFs.files["C:\\HARNSRC\\AICodeBridge.Log.js"] = "// AICodeBridge.Log(Repository, msg, id)\nreturn 0;\n";
    var parColl = mkColl(function (n) { return { Name: n, Position: 0, Update: function () { } }; });
    parColl.AddNew("Repository", "String"); parColl.AddNew("msg", "String");
    var meth = { Name: "Log", Code: "stary kod", Parameters: parColl,
        Update: function () { return true; }, GetLastError: function () { return ""; } };
    var methods = mkColl(); methods._items.push(meth);
    var el = { Methods: methods };
    var repo = mkRepo({ sqlRules: [{ re: /AICodeBridge/i, rows: [{ Object_ID: 11037 }] }] });
    repo.GetElementByID = function () { return el; };
    var origCfg = B.FB_Config;
    B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", srcDir: "C:\\HARNSRC\\" }]; };
    var r = B.FB_OpDeploySrc.call(B, repo, { op: "deploy_src", only: ["Log"] }, "t-dep");
    B.FB_Config = origCfg;
    eq(r.status, "ok", r.message || "");
    ok(meth.Code.indexOf("AICodeBridge.Log(Repository, msg, id)") >= 0, "Code se nepropsal");
    eq(parColl.Count, 3, "parametry se maji prestavet na 3");
    eq(parColl.GetAt(2).Name, "id");
    ok(r.paramsSynced && r.paramsSynced.length === 1, "response ma nest paramsSynced");
});
t("deploy_src: shodna signatura -> parametry se nesahaji (paramsSynced prazdne)", function () {
    memFs.folders["C:\\HARNSRC\\"] = 1;
    memFs.files["C:\\HARNSRC\\AICodeBridge.Log.js"] = "// AICodeBridge.Log(Repository, msg, id)\nreturn 0;\n";
    var parColl = mkColl(function (n) { return { Name: n, Position: 0, Update: function () { } }; });
    parColl.AddNew("Repository", "String"); parColl.AddNew("msg", "String"); parColl.AddNew("id", "String");
    var meth = { Name: "Log", Code: "x", Parameters: parColl,
        Update: function () { return true; }, GetLastError: function () { return ""; } };
    var methods = mkColl(); methods._items.push(meth);
    var el = { Methods: methods };
    var repo = mkRepo({ sqlRules: [{ re: /AICodeBridge/i, rows: [{ Object_ID: 11037 }] }] });
    repo.GetElementByID = function () { return el; };
    var origCfg = B.FB_Config;
    B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", srcDir: "C:\\HARNSRC\\" }]; };
    var r = B.FB_OpDeploySrc.call(B, repo, { op: "deploy_src", only: ["Log"] }, "t-dep2");
    B.FB_Config = origCfg;
    eq(r.status, "ok");
    eq(parColl.Count, 3);
    ok(!r.paramsSynced, "beze zmeny nema byt paramsSynced");
});
t("deploy_src: hlavicka bez zavorek (EA_ handler) -> signatura se nesaha", function () {
    memFs.folders["C:\\HARNSRC2\\"] = 1;
    memFs.files["C:\\HARNSRC2\\AICodeBridge.EA_Connect.js"] = "// AICodeBridge.EA_Connect - inicializace\nreturn \"\";\n";
    var parColl = mkColl(function (n) { return { Name: n, Position: 0, Update: function () { } }; });
    parColl.AddNew("Repository", "String");
    var meth = { Name: "EA_Connect", Code: "x", Parameters: parColl,
        Update: function () { return true; }, GetLastError: function () { return ""; } };
    var methods = mkColl(); methods._items.push(meth);
    var el = { Methods: methods };
    var repo = mkRepo({ sqlRules: [{ re: /AICodeBridge/i, rows: [{ Object_ID: 11037 }] }] });
    repo.GetElementByID = function () { return el; };
    var origCfg = B.FB_Config;
    B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", srcDir: "C:\\HARNSRC2\\" }]; };
    var r = B.FB_OpDeploySrc.call(B, repo, { op: "deploy_src", only: ["EA_Connect"] }, "t-dep3");
    B.FB_Config = origCfg;
    eq(r.status, "ok");
    eq(parColl.Count, 1, "handler bez zavorek se nesmi sahat");
    ok(!r.paramsSynced, "zadny sync");
});

t("deploy_src: preneseny add-in s cizim SignalGUID -> reception se prepne na lokalni", function () {
    memFs.folders["C:\\HARNSRC4\\"] = 1;
    memFs.files["C:\\HARNSRC4\\AICodeBridge.EA_MenuClick.js"] =
        "// AICodeBridge.EA_MenuClick - obsluha kliknuti\nreturn;\n"; // bez zavorek se signatura nesaha, ale StyleEx ANO (jmeno = Signal)
    var parColl = mkColl(function (n) { return { Name: n, Position: 0, Update: function () { } }; });
    parColl.AddNew("Repository", "String");
    var meth = { Name: "EA_MenuClick", Code: "x",
        StyleEx: "Reception=1;SignalGUID={CIZI-GUID-Z-JINEHO-MODELU};",
        Parameters: parColl, Update: function () { return true; }, GetLastError: function () { return ""; } };
    var methods = mkColl(); methods._items.push(meth);
    var el = { Methods: methods };
    var repo = mkRepo({ sqlRules: [
        { re: /Object_Type = 'Signal'/i, rows: [{ ea_guid: "{LOKALNI-SIG}" }] },
        { re: /AICodeBridge/i, rows: [{ Object_ID: 11037 }] }
    ] });
    repo.GetElementByID = function () { return el; };
    var origCfg = B.FB_Config;
    B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", srcDir: "C:\\HARNSRC4\\" }]; };
    var r = B.FB_OpDeploySrc.call(B, repo, { op: "deploy_src", only: ["EA_MenuClick"] }, "t-dep5");
    B.FB_Config = origCfg;
    eq(r.status, "ok");
    eq(meth.StyleEx, "Reception=1;SignalGUID={LOKALNI-SIG};", "SignalGUID se mel prepnout na lokalni");
    ok(r.receptions && ("" + r.receptions[0]).indexOf("prepnuto") >= 0, "response ma hlasit prepnuti");
});
t("deploy_src: nova operace se jmenem Signalu -> zalozi se jako RECEPTION", function () {
    memFs.folders["C:\\HARNSRC3\\"] = 1;
    memFs.files["C:\\HARNSRC3\\AICodeBridge.EA_OnOutputItemDoubleClicked.js"] =
        "// AICodeBridge.EA_OnOutputItemDoubleClicked(Repository, TabName, LineText, ID)\nreturn;\n";
    var methods = mkColl(function (n) {
        return { Name: n, Code: "", StyleEx: "", Parameters: mkColl(function (pn) { return { Name: pn, Position: 0, Update: function () { } }; }),
            Update: function () { return true; }, GetLastError: function () { return ""; } };
    });
    var el = { Methods: methods };
    var repo = mkRepo({ sqlRules: [
        { re: /Object_Type = 'Signal'/i, rows: [{ ea_guid: "{SIG-DBLCLK}" }] },
        { re: /AICodeBridge/i, rows: [{ Object_ID: 11037 }] }
    ] });
    repo.GetElementByID = function () { return el; };
    var origCfg = B.FB_Config;
    B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", srcDir: "C:\\HARNSRC3\\" }]; };
    var r = B.FB_OpDeploySrc.call(B, repo, { op: "deploy_src", only: ["EA_OnOutputItemDoubleClicked"] }, "t-dep4");
    B.FB_Config = origCfg;
    eq(r.status, "ok", r.message || "");
    eq(r.created.length, 1);
    var m = methods._items[0];
    eq(m.StyleEx, "Reception=1;SignalGUID={SIG-DBLCLK};", "operace ma byt reception");
    eq(m.Parameters.Count, 4, "signatura z hlavicky (4 parametry)");
    ok(r.receptions && r.receptions.length === 1, "response ma nest receptions");
});

// --- FB_ChatRender: op-level warnings v chat ACK (nalez POC N-7, 2026-08-21)
// Executor rekne "join '2' neni v davce - Join nezapsan" uz napoprve, ale chat
// verze to drive nenesla -> agent psal opravne davky naslepo. Testy hlidaji:
// (1) warning se propise a je v PRVNIM radku (prezije orez rozpoctem),
// (2) bezwarningova davka ma ACK BEZE ZMENY.
function chat(resp) { return "" + B.FB_ChatRender.call(B, resp); }

t("ChatRender: op-level warning -> pocet + text v prvnim radku ACK", function () {
    var out = chat({
        status: "done", id: "20260821-83",
        results: [
            { op: "create_or_update_elements", status: "ok" },
            { op: "create_or_update_scenarios", status: "ok",
              warnings: ["scenarios[1]: join '2' neni v davce - Join nezapsan"] }
        ]
    });
    var first = out.split("\n")[0];
    contains(first, "EAFB OK 20260821-83: 2/2 ops");
    contains(first, "1 WARNING:", "pocet warningu patri do prvniho radku");
    contains(first, "join '2' neni v davce");
    contains(out, "op[1] create_or_update_scenarios:", "vypis ma nest index a jmeno operace");
    contains(out, "OPRAVNOU davkou", "ACK ma rict, co s warningem delat");
});

t("ChatRender: bez warningu -> ACK beze zmeny (zadny prazdny segment)", function () {
    var out = chat({
        status: "done", id: "t-nw",
        results: [{ op: "create_or_update_elements", status: "ok" }]
    });
    eq(out, "EAFB OK t-nw: 1/1 ops", "bezwarningovy ACK se nesmi zhorsit");
    ok(out.toUpperCase().indexOf("WARNING") < 0, "zadna zminka o warninzich");
});

t("ChatRender: vice warningu z vice operaci -> pocet sedi, davkove i op-level", function () {
    var out = chat({
        status: "done", id: "t-mw",
        warnings: ["op[0]: pole confirm ignorovano (W6)"],
        results: [
            { op: "clone_package", status: "ok" },
            { op: "create_or_update_scenarios", status: "ok", warnings: ["w1", "w2"] }
        ]
    });
    contains(out.split("\n")[0], "3 WARNINGS:");
    contains(out, "davka: op[0]: pole confirm ignorovano (W6)");
    contains(out, "- op[1] create_or_update_scenarios: w1");
    contains(out, "- op[1] create_or_update_scenarios: w2");
});

t("ChatRender: warningy prezijou i chybu v pozdejsi operaci", function () {
    var out = chat({
        status: "error", id: "t-ew",
        results: [
            { op: "create_or_update_scenarios", status: "ok", warnings: ["join nezapsan"] },
            { op: "create_or_update_constraints", status: "error", code: "E_NOT_FOUND", message: "element neni" }
        ]
    });
    contains(out, "EAFB CHYBA t-ew v op[1]");
    contains(out.split("\n")[0], "1 WARNING:");
    contains(out, "op[0] create_or_update_scenarios: join nezapsan");
});

t("ChatRender: mnoho warningu -> rozpocet + ukazatel na res soubor (W10)", function () {
    var many = [];
    for (var i = 0; i < 40; i++) { many.push("warning cislo " + i + " s dostatecne dlouhym textem, aby se vycet nevesel"); }
    var out = chat({
        status: "done", id: "t-bw",
        results: [{ op: "create_or_update_messages", status: "ok", warnings: many }]
    });
    contains(out.split("\n")[0], "40 WARNINGS:");
    contains(out, "plny vycet v res-t-bw.json", "zadny tichy cut - vzdy ukazatel");
    ok(out.length <= 1500, "ACK musi zustat v rozpoctu, delka " + out.length);
});

t("ChatRender: confirm_required nese hashPrefix, NIKDY nonce ani plny hash", function () {
    var out = chat({
        status: "confirm_required", id: "t-cr",
        confirm: { hashPrefix: "a1b2c3d4e5f6", nonce: "TAJNY-NONCE" },
        payloadHash: "a1b2c3d4e5f6aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        risk: { riskReasons: ["affectedPackages 2 > 1"] },
        results: []
    });
    contains(out, "EAFB CEKA NA POTVRZENI t-cr");
    contains(out, "a1b2c3d4e5f6");
    ok(out.indexOf("TAJNY-NONCE") < 0, "nonce se do chatu nikdy nedostane");
    ok(out.indexOf("a1b2c3d4e5f6aaaa") < 0, "plny payloadHash se do chatu nikdy nedostane");
});

t("ChatRender: query 0 radku = 'dotaz nic nevratil', ne 'data neexistuji' (T4-3c)", function () {
    var out = chat({
        status: "done", id: "t-q0",
        results: [{ op: "query", status: "ok", rowCount: 0, rows: [] }]
    });
    contains(out, "ne 'data neexistuji'");
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
        protocol: "eafb/0.2", id: "t-repo", repo: "JINY_REPOZITAR",
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

// ================================================================ ITERACE 6
// join na krok · move_elements · create_or_update_requirements
// ---------------------------------------------------------------------------
// Whitelistovany repo: koren = #FB-TEST GUID z FB_Whitelist, aby FB_CheckWrite
// prosel (whitelist = cela vetev pod timto package).
var WL_GUID = "{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}";
function wlRepo(opts) {
    var repo = mkRepo(opts || {});
    repo._addPackage({ id: 1054, name: "#FB-TEST", guid: WL_GUID });
    return repo;
}
// Scenar mock: XMLContent se GENERUJE z kroku (jako EA po Steps.AddNew),
// dokud ho nekdo neprepise (pruchod 3) - pak drzi prepsanou hodnotu.
function mkScenario(name, type) {
    var steps = mkColl(function (txt) {
        return { Name: txt, Uses: "", Results: "", State: "", StepType: 0,
                 Update: function () { return true; }, GetLastError: function () { return ""; } };
    });
    var sc = {
        Name: name, Type: type, Notes: "", ScenarioGUID: mkGuid(), Steps: steps,
        _xml: null, _stepGuids: [],
        Update: function () { return true; }, GetLastError: function () { return ""; }
    };
    Object.defineProperty(sc, "XMLContent", {
        get: function () {
            if (sc._xml !== null) { return sc._xml; }
            var out = "<path>";
            for (var i = 0; i < steps._items.length; i++) {
                if (!sc._stepGuids[i]) { sc._stepGuids[i] = mkGuid(); }
                out += '<step name="' + steps._items[i].Name + '" guid="' + sc._stepGuids[i]
                    + '" level="' + (i + 1) + '" uses="' + steps._items[i].Uses
                    + '" result="" state="" trigger="0" link=""/>';
            }
            return out + "</path>";
        },
        set: function (v) { sc._xml = "" + v; }
    });
    return sc;
}
function mkScEl(repo, id, name, pkgId) {
    var el = repo._addElement({ id: id, name: name, type: "UseCase", packageID: pkgId });
    el.Scenarios = mkColl(function (n, ty) { return mkScenario(n, ty); });
    el.Requirements = mkColl(function (n, ty) {
        return { Name: n, Type: ty, Notes: "", Status: "", Priority: "", Difficulty: "", Stability: "",
                 Update: function () { return true; }, GetLastError: function () { return ""; } };
    });
    return el;
}
// dvouscenarova davka: BE se 3 kroky + jedna vetev pripnuta na krok 1
function scOp(elRef, joinVal) {
    var br = { name: "AF-1", type: "Alternate", steps: [{ text: "vetev krok" }],
               attachTo: { scenario: "BE", step: 1 } };
    if (typeof joinVal != "undefined") { br.join = joinVal; }
    return { op: "create_or_update_scenarios", element: elRef, scenarios: [
        { name: "BE", type: "Basic Path", steps: [{ text: "krok 1" }, { text: "krok 2" }, { text: "krok 3" }] },
        br
    ] };
}
function beXml(el) { return "" + el.Scenarios.GetAt(0).XMLContent; }

t("scenarios/join: cislo kroku -> do XML jde GUID TOHO KROKU (RE davky -91/-92)", function () {
    var repo = wlRepo();
    var el = mkScEl(repo, 11310, "UC-95002", 1054);
    var res = B.FB_OpScenarios.call(B, repo, scOp("11310", 2), "t-j1");
    eq(res.status, "ok", "op selhal: " + JSON.stringify(res).substring(0, 300));
    ok(!res.warnings, "cislo kroku v rozsahu nesmi generovat warning: " + JSON.stringify(res.warnings));
    var g2 = el.Scenarios.GetAt(0)._stepGuids[1]; // GUID 2. kroku BE
    ok(g2, "mock nevygeneroval GUID kroku");
    contains(beXml(el), 'join="' + g2 + '"', "join nenese GUID 2. kroku");
});
t("scenarios/join: vynechany join -> join=\"End\" (ne prazdny retezec)", function () {
    var repo = wlRepo();
    var el = mkScEl(repo, 11310, "UC-95002", 1054);
    var res = B.FB_OpScenarios.call(B, repo, scOp("11310"), "t-j2");
    eq(res.status, "ok");
    contains(beXml(el), 'join="End"');
});
t("scenarios/join: jmeno scenare (vyvraceny nalez N-1) -> warning + End", function () {
    var repo = wlRepo();
    var el = mkScEl(repo, 11310, "UC-95002", 1054);
    var res = B.FB_OpScenarios.call(B, repo, scOp("11310", "BE"), "t-j3");
    eq(res.status, "ok");
    ok(res.warnings && res.warnings.length === 1, "ocekavan prave 1 warning: " + JSON.stringify(res.warnings));
    contains(res.warnings[0], "neni cislo kroku");
    contains(beXml(el), 'join="End"');
});
t("scenarios/join: cislo mimo rozsah kroku hostitele -> warning + End", function () {
    var repo = wlRepo();
    var el = mkScEl(repo, 11310, "UC-95002", 1054);
    var res = B.FB_OpScenarios.call(B, repo, scOp("11310", 99), "t-j4");
    eq(res.status, "ok");
    ok(res.warnings && res.warnings.length === 1, "ocekavan warning o rozsahu");
    contains(res.warnings[0], "mimo rozsah");
    contains(beXml(el), 'join="End"');
});
t("scenarios/join: join bez attachTo -> warning (vetev nikam nevisi)", function () {
    var repo = wlRepo();
    mkScEl(repo, 11310, "UC-95002", 1054);
    var op = scOp("11310", 2);
    delete op.scenarios[1].attachTo;
    var res = B.FB_OpScenarios.call(B, repo, op, "t-j5");
    eq(res.status, "ok");
    ok(res.warnings && res.warnings.length === 1, "ocekavan warning o chybejicim attachTo");
    contains(res.warnings[0], "join bez attachTo");
});
t("scenarios/join: poradi atributu extension = level, guid, join (jako EA)", function () {
    var repo = wlRepo();
    var el = mkScEl(repo, 11310, "UC-95002", 1054);
    B.FB_OpScenarios.call(B, repo, scOp("11310", 3), "t-j6");
    var m = /<extension ([a-z]+)="[^"]*" ([a-z]+)="[^"]*" ([a-z]+)="[^"]*"\/>/.exec(beXml(el));
    ok(m, "extension nenalezen v XML: " + beXml(el).substring(0, 400));
    eq(m[1] + "," + m[2] + "," + m[3], "level,guid,join");
});

// --- move_elements ---------------------------------------------------------
function mkMoveEl(repo, id, name, pkgId) {
    var el = repo._addElement({ id: id, name: name, type: "UseCase", packageID: pkgId });
    el.Elements = mkColl();
    el.Diagrams = mkColl();
    return el;
}
function addChild(repo, parent, id, name, pkgId) {
    var ch = mkMoveEl(repo, id, name, pkgId);
    ch.ParentID = parent.ElementID;
    parent.Elements._items.push(ch);
    return ch;
}
function addDiagram(el, name, pkgId) {
    var dg = { Name: name, PackageID: pkgId, Update: function () { return true; }, GetLastError: function () { return ""; } };
    el.Diagrams._items.push(dg);
    return dg;
}
function moveRepo() {
    var repo = wlRepo();
    repo._addPackage({ id: 1067, name: "OTHER ELEMENTS", parentID: 1054 });
    repo._addPackage({ id: 1069, name: "UC-95002", parentID: 1054 });
    return repo;
}
t("move_elements: presune element, jeho potomky i vlastnene diagramy", function () {
    var repo = moveRepo();
    var uc = mkMoveEl(repo, 11310, "UC-95002", 1067);
    var bru = addChild(repo, uc, 11331, "BRU95002-1", 1067);
    var dg = addDiagram(uc, "UC-95002 FA", 1067);
    var res = B.FB_OpMoveElements.call(B, repo, { op: "move_elements", "package": 1069, elements: [11310] }, "t-m1");
    eq(res.status, "ok", JSON.stringify(res).substring(0, 300));
    eq(res.moved, 1);
    eq(uc.PackageID, 1069, "UC se nepresunul");
    eq(bru.PackageID, 1069, "potomek zustal v puvodnim package");
    eq(dg.PackageID, 1069, "vlastneny diagram zustal v puvodnim package");
    eq(res.items[0].children, 1);
    eq(res.items[0].childrenFixed, 1, "mock EA nekaskaduje -> dorovnal to bridge");
    eq(res.items[0].diagrams, 1);
    eq(res.items[0].diagramsFixed, 1);
    eq(res.items[0].fromPackage, "OTHER ELEMENTS");
    eq(res.items[0].toPackage, "UC-95002");
});
t("move_elements: element uz v cili -> moved:false (idempotence, par. 5a)", function () {
    var repo = moveRepo();
    mkMoveEl(repo, 11310, "UC-95002", 1069);
    var res = B.FB_OpMoveElements.call(B, repo, { op: "move_elements", "package": 1069, elements: [11310] }, "t-m2");
    eq(res.status, "ok");
    eq(res.moved, 0);
    eq(res.items[0].moved, false);
});
t("move_elements: withChildren:false -> potomek zustava (vedomy opt-out)", function () {
    var repo = moveRepo();
    var uc = mkMoveEl(repo, 11310, "UC-95002", 1067);
    var bru = addChild(repo, uc, 11331, "BRU95002-1", 1067);
    var res = B.FB_OpMoveElements.call(B, repo,
        { op: "move_elements", "package": 1069, elements: [11310], withChildren: false }, "t-m3");
    eq(res.status, "ok");
    eq(uc.PackageID, 1069);
    eq(bru.PackageID, 1067, "s withChildren:false se potomek presouvat nema");
});
t("move_elements: neznamy cil -> E_NOT_FOUND a NIC se nepresune (validace pred zapisem)", function () {
    var repo = moveRepo();
    var a = mkMoveEl(repo, 11310, "UC-95002", 1067);
    var b2 = mkMoveEl(repo, 11311, "UC-95003", 1067);
    var res = B.FB_OpMoveElements.call(B, repo, { op: "move_elements", elements: [
        { element: 11310, "package": 1069 }, { element: 11311, "package": 9999 }
    ] }, "t-m4");
    eq(res.status, "error");
    eq(res.code, "E_NOT_FOUND");
    eq(a.PackageID, 1067, "prvni prvek se nesmel presunout, kdyz druhy neprosel validaci");
    eq(b2.PackageID, 1067);
});
t("move_elements: cil mimo whitelist -> E_WHITELIST", function () {
    var repo = moveRepo();
    repo._addPackage({ id: 2000, name: "MIMO", parentID: 0 });
    var uc = mkMoveEl(repo, 11310, "UC-95002", 1067);
    var res = B.FB_OpMoveElements.call(B, repo, { op: "move_elements", "package": 2000, elements: [11310] }, "t-m5");
    eq(res.status, "error");
    eq(res.code, "E_WHITELIST");
    eq(uc.PackageID, 1067);
});
t("move_elements: chybejici cilovy package -> E_ARGS", function () {
    var repo = moveRepo();
    mkMoveEl(repo, 11310, "UC-95002", 1067);
    var res = B.FB_OpMoveElements.call(B, repo, { op: "move_elements", elements: [11310] }, "t-m6");
    eq(res.status, "error");
    eq(res.code, "E_ARGS");
});
t("elements: 'package' u UPDATU nepresouva -> warning (konec falesneho OK, N-2)", function () {
    var repo = moveRepo();
    var uc = mkMoveEl(repo, 11310, "UC-95002", 1067);
    var res = B.FB_OpElements.call(B, repo, { op: "create_or_update_elements",
        elements: [{ elementID: 11310, name: "UC-95002 novy nazev", "package": 1069 }] }, "t-e1");
    eq(res.status, "ok");
    eq(uc.PackageID, 1067, "update vetev nesmi presouvat");
    ok(res.warnings && res.warnings.length === 1, "ocekavan warning o neucinnem package: " + JSON.stringify(res.warnings));
    contains(res.warnings[0], "move_elements");
});
t("FB_LogChanges: move_elements radek nese odkud -> kam", function () {
    var repo = moveRepo();
    mkMoveEl(repo, 11310, "UC-95002", 1069);
    B.FB_LogChanges.call(B, repo, { id: "t-m-log", results: [
        { op: "move_elements", status: "ok", items: [
            { id: 11310, name: "UC-95002", moved: true, fromPackage: "OTHER ELEMENTS",
              toPackage: "UC-95002", children: 3, childrenFixed: 0, diagrams: 1, diagramsFixed: 1 }
        ] }
    ] });
    var line = repo._output.filter(function (o) { return o.text.indexOf("presunuto") >= 0; });
    eq(line.length, 1, "chybi radek presunu v Output tabu");
    contains(line[0].text, "OTHER ELEMENTS -> UC-95002");
    contains(line[0].text, "potomku: 3 (dorovnano 0)");
});
t("move_elements: EA kaskaduje potomka sama -> children 1, childrenFixed 0 (lekce A1)", function () {
    var repo = moveRepo();
    var uc = mkMoveEl(repo, 11310, "UC-95002", 1067);
    var bru = addChild(repo, uc, 11331, "BRU95002-1", 1067);
    // mock kaskady EA: zmena PackageID rodice prepise i potomka (jako EA 17.1.5)
    uc.Update = function () { bru.PackageID = uc.PackageID; return true; };
    var res = B.FB_OpMoveElements.call(B, repo, { op: "move_elements", "package": 1069, elements: [11310] }, "t-m7");
    eq(res.status, "ok");
    eq(bru.PackageID, 1069);
    eq(res.items[0].children, 1, "potomek se ma vykazat i kdyz ho presunula EA");
    eq(res.items[0].childrenFixed, 0, "bridge nemel co dorovnavat");
});

// --- create_or_update_requirements (internal requirements, U5) --------------
t("requirements: zapis v poradi davky + default type Functional", function () {
    var repo = wlRepo();
    var el = mkScEl(repo, 11310, "UC-95002", 1054);
    var res = B.FB_OpRequirements.call(B, repo, { op: "create_or_update_requirements", element: "11310",
        requirements: [
            { name: "BRU95002-1 Zpusobilost uctu", notes: "Pravidlo 1", status: "Proposed", priority: "High" },
            { name: "BRU95002-2 Vyporadani kreditu", notes: "Pravidlo 2", type: "Functional" }
        ] }, "t-r1");
    eq(res.status, "ok", JSON.stringify(res).substring(0, 300));
    eq(res.count, 2);
    eq(res.removed, 0);
    eq(el.Requirements.Count, 2);
    eq(el.Requirements.GetAt(0).Name, "BRU95002-1 Zpusobilost uctu");
    eq(el.Requirements.GetAt(0).Type, "Functional", "chybi default ReqType");
    eq(el.Requirements.GetAt(0).Priority, "High");
    eq(el.Requirements.GetAt(1).Notes, "Pravidlo 2");
});
t("requirements: deterministicky rebuild V2d - druhy beh smaze a zapise znovu", function () {
    var repo = wlRepo();
    var el = mkScEl(repo, 11310, "UC-95002", 1054);
    var op = { op: "create_or_update_requirements", element: "11310",
        requirements: [{ name: "BRU95002-1", notes: "v1" }] };
    B.FB_OpRequirements.call(B, repo, op, "t-r2a");
    var res = B.FB_OpRequirements.call(B, repo, { op: "create_or_update_requirements", element: "11310",
        requirements: [{ name: "BRU95002-1", notes: "v2" }] }, "t-r2b");
    eq(res.removed, 1, "rebuild musi smazat predchozi sadu");
    eq(el.Requirements.Count, 1, "rebuild nesmi nechat duplicity");
    eq(el.Requirements.GetAt(0).Notes, "v2");
});
t("requirements: chybejici name -> E_ARGS a NIC se nesmaze (validace pred mazanim)", function () {
    var repo = wlRepo();
    var el = mkScEl(repo, 11310, "UC-95002", 1054);
    B.FB_OpRequirements.call(B, repo, { op: "create_or_update_requirements", element: "11310",
        requirements: [{ name: "BRU95002-1", notes: "drzi" }] }, "t-r3a");
    var res = B.FB_OpRequirements.call(B, repo, { op: "create_or_update_requirements", element: "11310",
        requirements: [{ name: "ok" }, { notes: "bez jmena" }] }, "t-r3b");
    eq(res.status, "error");
    eq(res.code, "E_ARGS");
    eq(el.Requirements.Count, 1, "puvodni sada se nesmela smazat");
});
t("requirements: prazdne pole / chybejici element -> E_ARGS", function () {
    var repo = wlRepo();
    mkScEl(repo, 11310, "UC-95002", 1054);
    eq(B.FB_OpRequirements.call(B, repo, { op: "create_or_update_requirements", element: "11310", requirements: [] }, "t-r4").code, "E_ARGS");
    eq(B.FB_OpRequirements.call(B, repo, { op: "create_or_update_requirements", requirements: [{ name: "x" }] }, "t-r5").code, "E_ARGS");
});

// --- Risk Gate: nove operace ----------------------------------------------
function gateRepo() {
    return mkRepo({ sqlRules: [
        { re: /FROM t_object WHERE Object_ID = 11310/i,
          rows: [{ Object_ID: "11310", ea_guid: "{EL-11310}", Package_ID: "1067", Object_Type: "UseCase", Name: "UC-95002" }] },
        { re: /FROM t_package WHERE Package_ID = 1069/i,
          rows: [{ Package_ID: "1069", ea_guid: "{PK-1069}", Name: "UC-95002" }] },
        { re: /FROM t_package WHERE Package_ID = 1067/i,
          rows: [{ Package_ID: "1067", ea_guid: "{PK-1067}", Name: "OTHER ELEMENTS" }] }
    ] });
}
var REG6 = { "move_elements": { w: true }, "create_or_update_requirements": { w: true },
             "create_or_update_elements": { w: true } };
t("RiskGate: move_elements -> moveOps se pocita a davka je ELEVATED", function () {
    var repo = gateRepo();
    var polOrig = B.FB_RiskPolicy;
    B.FB_RiskPolicy = function () {
        return [{ repo: "EAEXAMPLE.QEA",
            classes: { move_elements: "ELEVATED", create_or_update_requirements: "ELEVATED", create_or_update_elements: "LOW" },
            elevate: { deleteTargets: 0, writeOps: 20, updatedExisting: 10, affectedPackages: 1, foreignDiagrams: 0, moveOps: 0 },
            block: { deleteTargets: 100, writeOps: 500, updatedExisting: 100, affectedPackages: 5 },
            budgetMs: 8000, hashMaxChars: 2000000 }];
    };
    var r = B.FB_RiskGate.call(B, repo, { ops: [
        { op: "move_elements", "package": 1069, elements: [11310] }
    ] }, REG6);
    B.FB_RiskPolicy = polOrig;
    eq(r.policyValid, true, "politika mela byt validni: " + r.riskReasons.join("; "));
    eq(r.metrics.moveOps, 1, "moveOps uz neni rezervovana nula");
    eq(r.riskLevel, "ELEVATED", "presun musi vzdy vyzadovat potvrzeni: " + r.riskReasons.join("; "));
    eq(r.metrics.updatedExisting, 1, "presouvany prvek je existujici target");
});
t("RiskGate: davka bez presunu -> moveOps 0 (regrese)", function () {
    var repo = gateRepo();
    var polOrig = B.FB_RiskPolicy;
    B.FB_RiskPolicy = function () {
        return [{ repo: "EAEXAMPLE.QEA",
            classes: { move_elements: "ELEVATED", create_or_update_requirements: "ELEVATED", create_or_update_elements: "LOW" },
            elevate: { deleteTargets: 0, writeOps: 20, updatedExisting: 10, affectedPackages: 1, foreignDiagrams: 0 },
            block: { deleteTargets: 100, writeOps: 500, updatedExisting: 100, affectedPackages: 5 },
            budgetMs: 8000, hashMaxChars: 2000000 }];
    };
    var r = B.FB_RiskGate.call(B, repo, { ops: [
        { op: "create_or_update_elements", elements: [{ elementID: 11310, name: "x" }] }
    ] }, REG6);
    B.FB_RiskPolicy = polOrig;
    eq(r.metrics.moveOps, 0);
    eq(r.policyValid, true, "chybejici volitelny prah moveOps nesmi znevalidnit politiku");
});
t("RiskGate: trida move_elements sama o sobe zvedne LOW davku na ELEVATED", function () {
    // izolace efektu TRIDY: prahy jsou schvalne tak volne, ze davka jinak
    // projde jako LOW (bez toho by test prosel i s klasifikaci LOW)
    var polOrig = B.FB_RiskPolicy;
    function polWith(klass, withMoveThreshold) {
        return function () {
            var el = { deleteTargets: 0, writeOps: 20, updatedExisting: 10, affectedPackages: 9, foreignDiagrams: 9 };
            if (withMoveThreshold) { el.moveOps = 0; }
            return [{ repo: "EAEXAMPLE.QEA",
                classes: { move_elements: klass, create_or_update_requirements: "ELEVATED", create_or_update_elements: "LOW" },
                elevate: el,
                block: { deleteTargets: 100, writeOps: 500, updatedExisting: 100, affectedPackages: 5 },
                budgetMs: 8000, hashMaxChars: 2000000 }];
        };
    }
    var batch = { ops: [{ op: "move_elements", "package": 1069, elements: [11310] }] };
    B.FB_RiskPolicy = polWith("LOW", false);
    var low = B.FB_RiskGate.call(B, gateRepo(), batch, REG6);
    B.FB_RiskPolicy = polWith("ELEVATED", false);
    var elev = B.FB_RiskGate.call(B, gateRepo(), batch, REG6);
    B.FB_RiskPolicy = polWith("LOW", true);
    var thr = B.FB_RiskGate.call(B, gateRepo(), batch, REG6);
    B.FB_RiskPolicy = polOrig;
    eq(low.riskLevel, "LOW", "kontrolni vzorek mel projit jako LOW: " + low.riskReasons.join("; "));
    eq(elev.riskLevel, "ELEVATED", "trida ELEVATED musi davku zvednout sama");
    eq(thr.riskLevel, "ELEVATED", "prah moveOps musi davku zvednout i pri tride LOW");
});
t("RiskGate: OSTRA politika da obema novym operacim ELEVATED", function () {
    var pol = B.FB_RiskPolicy.call(B);
    var eaex = null;
    for (var i = 0; i < pol.length; i++) { if (/EAEXAMPLE/i.test("" + pol[i].repo)) { eaex = pol[i]; } }
    ok(eaex != null, "eaexample chybi ve FB_RiskPolicy");
    eq(eaex.classes["move_elements"], "ELEVATED", "presun musi vzdy vyzadovat potvrzeni");
    eq(eaex.classes["create_or_update_requirements"], "ELEVATED", "rebuild requirements = ELEVATED (vzor constraints)");
});
t("RiskGate: souhrn pro dialog nese ZDROJOVOU i cilovou package (odkud -> kam)", function () {
    var polOrig = B.FB_RiskPolicy;
    var r = B.FB_RiskGate.call(B, gateRepo(), { ops: [
        { op: "move_elements", "package": 1069, elements: [11310] }
    ] }, REG6);
    B.FB_RiskPolicy = polOrig;
    var names = (r.summary.packages || []).join(",");
    contains(names, "OTHER ELEMENTS", "chybi jmeno zdrojove package - clovek nevidi ODKUD se prvek bere");
    contains(names, "UC-95002");
});
t("ConfirmSummary: move davka rekne PRESUNOUT, ne 'upravit'", function () {
    var out = "" + B.FB_ConfirmSummary.call(B, {
        status: "confirm_required", id: "t-cs-move",
        risk: { metrics: { moveOps: 2, updatedExisting: 2, createOps: 0, deleteTargets: 0, writeOps: 2 },
                summary: { packages: ["OTHER ELEMENTS", "UC-95002"], targets: ["UC-95002"] },
                riskReasons: ["Operace 'move_elements' je politikou klasifikovana ELEVATED"] },
        confirm: { hashPrefix: "abc123abc123" }, results: []
    });
    contains(out, "PRESUNOUT 2");
    contains(out, "OTHER ELEMENTS");
    ok(out.indexOf("Chysta se upravit") < 0, "presun se nesmi tvarit jako obycejna uprava");
});
t("move_elements: noop beh NIC nezapise (zadne razitko ai.request)", function () {
    var repo = moveRepo();
    var uc = mkMoveEl(repo, 11310, "UC-95002", 1069);
    var res = B.FB_OpMoveElements.call(B, repo, { op: "move_elements", "package": 1069, elements: [11310] }, "t-m8");
    eq(res.status, "ok");
    eq(res.moved, 0);
    eq(uc.TaggedValues.Count, 0, "noop nesmi sahnout na model ani razitkem (idempotence par. 5a)");
});
t("move_elements: potomek mimo whitelist -> warning, bridge ho neprepisuje", function () {
    var repo = moveRepo();
    repo._addPackage({ id: 2001, name: "MIMO WHITELIST", parentID: 0 });
    var uc = mkMoveEl(repo, 11310, "UC-95002", 1067);
    var cizi = addChild(repo, uc, 11399, "Potomek jinde", 2001);
    var res = B.FB_OpMoveElements.call(B, repo, { op: "move_elements", "package": 1069, elements: [11310] }, "t-m9");
    eq(res.status, "ok");
    eq(uc.PackageID, 1069, "rodic se presunout mel");
    eq(cizi.PackageID, 2001, "potomek mimo whitelist se nesmi prepsat");
    ok(res.warnings && res.warnings.length === 1, "chybi warning o potomkovi mimo whitelist: " + JSON.stringify(res.warnings));
    contains(res.warnings[0], "mimo whitelist");
});
t("scenarios: necislena hodnota attachTo.step -> warning, ne TICHA ztrata vetve", function () {
    var repo = wlRepo();
    var el = mkScEl(repo, 11310, "UC-95002", 1054);
    var op = scOp("11310", 2);
    op.scenarios[1].attachTo.step = "krok 1";
    var res = B.FB_OpScenarios.call(B, repo, op, "t-j7");
    eq(res.status, "ok");
    ok(res.warnings && res.warnings.length === 1, "necislene attachTo.step musi dat warning: " + JSON.stringify(res.warnings));
    contains(res.warnings[0], "mimo rozsah");
    ok(beXml(el).indexOf("<extension") < 0, "vetev se nesmi zapsat, kdyz kotva neni platna");
});
t("RiskGate: politika pokryva VSECHNY zapisove operace registru FB_Main", function () {
    var main = fs.readFileSync(path.join(SRC, "AICodeBridge.FB_Main.js"), "utf8");
    var pol = fs.readFileSync(path.join(SRC, "AICodeBridge.FB_RiskPolicy.js"), "utf8");
    var active = pol.split(/\r?\n/).filter(function (l) { return l.replace(/^\s+/, "").indexOf("//") !== 0; }).join("\n");
    var writes = [], m, re = /"([a-z_]+)":\s*\{ fn: "FB_\w+", w: true \}/g;
    while ((m = re.exec(main)) !== null) { writes.push(m[1]); }
    var missing = writes.filter(function (w) {
        return new RegExp('"' + w + '":\\s*"(LOW|ELEVATED|BLOCKED)"').test(active) === false;
    });
    ok(writes.length >= 27, "registr ma mit aspon 27 zapisovych operaci, ma " + writes.length);
    ok(missing.length === 0, "FB_RiskPolicy nepokryva: " + missing.join(", ") + " (fail-closed W9 by shodil vse do ELEVATED)");
});

// ------------------------------------------------------------------ vysledek
console.log("");
console.log("EA File Bridge offline harness: " + passed + "/" + (passed + failed) + " PASS");
if (failed > 0) {
    console.log("");
    failures.forEach(function (f) { console.log("FAIL " + f); });
    process.exit(1);
}
