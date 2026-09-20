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
        GetDiagramByID: function (id) { return (opts.diagrams && opts.diagrams[id]) || null; },
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
    EA_MenuClick: ["Repository", "MenuLocation", "MenuName", "ItemName"],
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
    // FB_OpDeploySrc z allowlistu VYRAZEN 20260831 (E2E T7-00: prvni beh
    // schrankovym kanalem spadl na ActiveXObject v in-model runtime)
    var allow = { "AICodeBridge.FB_ComObj.js": 1, "AICodeBridge.FB_FileBytes.js": 1,
                  "AICodeBridge.FB_ProcessFolder.js": 1 };
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
t("FB_LogChanges: package item -> marker (pkg:PackageID), WriteOutput id 0 (T1)", function () {
    // T1 2026-09-04: Element.ElementID package (10007) proklik NEOZNACIL
    // (evidence Milose 08-21c) -> radek nese marker s PackageID, 3. param 0
    var repo = mkRepo();
    var pkg = repo._addPackage({ id: 7, name: "NovyPkg", elementID: 10007 });
    var resp = { id: "t-log-3", results: [
        { op: "create_or_update_package", status: "ok", items: [{ id: 7, guid: pkg.PackageGUID, name: "NovyPkg", created: true, kind: "package" }] }
    ] };
    B.FB_LogChanges.call(B, repo, resp);
    var pl = repo._output.filter(function (o) { return o.text.indexOf("package \"NovyPkg\"") >= 0; });
    eq(pl.length, 1, "chybi radek package");
    contains(pl[0].text, "(pkg:7)", "radek package nenese marker pkg:PackageID");
    eq(pl[0].id, 0, "PackageID nesmi jit do 3. paramu WriteOutput (jiny ciselny prostor nez ElementID)");
    eq(repo._output.filter(function (o) { return o.id === 10007; }).length, 0, "Element.ElementID package uz nema byt navigacni id");
});
t("FB_LogChanges: element radek nese marker (el:ID) + stavajici WriteOutput id (T1)", function () {
    var repo = mkRepo();
    repo._addPackage({ id: 1, name: "Model" });
    repo._addElement({ id: 42, name: "NovyPrvek", packageID: 1 });
    B.FB_LogChanges.call(B, repo, { id: "t-log-4", results: [
        { op: "create_or_update_elements", status: "ok", items: [{ id: 42, name: "NovyPrvek", created: true }] }
    ] });
    var l = repo._output.filter(function (o) { return o.id === 42; });
    eq(l.length, 1);
    contains(l[0].text, "(el:42)");
});
t("FB_LogChanges: scenarios/constraints -> id VLASTNICIHO elementu (T1)", function () {
    var repo = mkRepo();
    repo._addPackage({ id: 1, name: "Model" });
    repo._addElement({ id: 11129, name: "FBT UC Scenarios", packageID: 1 });
    B.FB_LogChanges.call(B, repo, { id: "t-log-5", results: [
        { op: "create_or_update_scenarios", status: "ok", count: 2, items: [{ guid: "{S1}" }, { guid: "{S2}" }], guid: "{S1}", id: 11129 },
        { op: "create_or_update_constraints", status: "ok", count: 1, items: [{ name: "PRE" }], guid: "{E}", id: 11129 },
        { op: "create_or_update_attributes", status: "ok", element: { guid: "{E}", id: 11129 }, count: 1, items: [{ guid: "{A}", id: 5 }] }
    ] });
    var owned = repo._output.filter(function (o) { return o.id === 11129; });
    eq(owned.length, 3, "vsechny tri radky maji nest id vlastnika 11129: " + JSON.stringify(repo._output));
    contains(owned[0].text, "(el:11129)");
    contains(owned[0].text, "Model.FBT UC Scenarios", "radek ma nest cestu vlastnika");
});
t("FB_LogChanges: diagram radky nesou marker (dgm:DiagramID) (T1)", function () {
    var repo = mkRepo();
    B.FB_LogChanges.call(B, repo, { id: "t-log-6", results: [
        { op: "create_or_update_diagram", status: "ok", items: [{ guid: "{D}", id: 1133, name: "FBT OwnedDiag", created: true }] },
        { op: "place_elements_on_diagram", status: "ok", diagramID: 1133, guid: "{D}", count: 2, items: [{}, {}] }
    ] });
    var dg = repo._output.filter(function (o) { return o.text.indexOf("(dgm:1133)") >= 0; });
    eq(dg.length, 2, "oba diagramove radky maji nest marker dgm:1133: " + JSON.stringify(repo._output));
    eq(dg[0].id, 0, "DiagramID nesmi jit do 3. paramu WriteOutput");
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
t("FB_Main E_ADDIN_ACCESS: hlaska pro omezeneho uzivatele bez zdvojeneho 'cteci operace funguji' (K8 A2w 2026-09-09)", function () {
    delete B._fbAccessCache;
    var repo = mainRepoBase({ securityEnabled: true, login: "novak" });
    var orig = B.FB_AccessGroups;
    B.FB_AccessGroups = function () { return [{ repo: "EAEXAMPLE.QEA", writeGroups: ["@FX_AI_Write"] }]; };
    var out = B.FB_Main.call(B, repo, JSON.stringify({
        protocol: "eafb/0.2", id: "t-acc-msg", repo: "EAEXAMPLE.QEA",
        ops: [{ op: "create_or_update_package", parent: "{X}", name: "Pkg" }]
    }));
    B.FB_AccessGroups = orig;
    delete B._fbAccessCache;
    var msg = ("" + JSON.parse(out).message).toLowerCase();
    eq(msg.split("cteci operace funguji").length - 1, 1, "veta 'cteci operace funguji' prave jednou: " + msg);
    contains(msg, "spravce ea");
});
// --- FB_Audit: cil auditu (N-K8-3, zive K8 QEAX 2026-09-09: 3x #AI-LOG -> vsech 18 auditu v cizi package)
function auditRepo(rows, cfgGuid) {
    var repo = mkRepo({ sqlRules: [{ re: /#AI-LOG/i, rows: rows }] });
    var orig = B.FB_Config;
    B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", auditPkg: cfgGuid }]; };
    repo._restore = function () { B.FB_Config = orig; };
    return repo;
}
t("FB_Audit: FB_Config.auditPkg -> audit jde do package s timto GUID (jmeno se nekontroluje)", function () {
    var repo = auditRepo([{ Package_ID: "1", ea_guid: "{JINA}" }], "{AUDIT-CFG}");
    var jina = repo._addPackage({ id: 1, name: "#AI-LOG", guid: "{JINA}" });
    var cil = repo._addPackage({ id: 2, name: "Muj audit", guid: "{AUDIT-CFG}" });
    var g;
    try { g = B.FB_Audit.call(B, repo, "t-au-1", "done: 1 ops", "{}"); } finally { repo._restore(); }
    ok(g != "", "audit musi vzniknout");
    eq(cil.Elements.Count, 1, "artefakt v package z configu");
    eq(jina.Elements.Count, 0, "do package jmenem #AI-LOG nic");
});
t("FB_Audit: auditPkg nastaven, ale GUID v modelu neni -> WARN a zadny fallback jmenem", function () {
    var repo = auditRepo([{ Package_ID: "1", ea_guid: "{JINA}" }], "{CHYBI}");
    var jina = repo._addPackage({ id: 1, name: "#AI-LOG", guid: "{JINA}" });
    var g;
    try { g = B.FB_Audit.call(B, repo, "t-au-2", "done", "{}"); } finally { repo._restore(); }
    eq(g, "");
    eq(jina.Elements.Count, 0, "fallback jmenem nesmi nastat, kdyz je auditPkg nastaven");
    ok(repo._output.some(function (o) { return /auditPkg/.test(o.text); }), "WARN musi jmenovat auditPkg");
});
t("FB_Audit: bez auditPkg + vice package #AI-LOG -> prvni dle Package_ID + WARN s poctem", function () {
    var repo = auditRepo([{ Package_ID: "356", ea_guid: "{A356}" }, { Package_ID: "686", ea_guid: "{A686}" }], "");
    var p356 = repo._addPackage({ id: 356, name: "#AI-LOG", guid: "{A356}" });
    var p686 = repo._addPackage({ id: 686, name: "#AI-LOG", guid: "{A686}" });
    var g;
    try { g = B.FB_Audit.call(B, repo, "t-au-3", "done", "{}"); } finally { repo._restore(); }
    ok(g != "");
    eq(p356.Elements.Count, 1); eq(p686.Elements.Count, 0);
    ok(repo._output.some(function (o) { return /2x package #AI-LOG/.test(o.text); }), "WARN o vice package");
});
t("FB_Audit: bez auditPkg + jedina #AI-LOG -> audit bez WARN (eaexample beze zmeny chovani)", function () {
    var repo = auditRepo([{ Package_ID: "9", ea_guid: "{A9}" }], "");
    var p9 = repo._addPackage({ id: 9, name: "#AI-LOG", guid: "{A9}" });
    try { B.FB_Audit.call(B, repo, "t-au-4", "done", "{}"); } finally { repo._restore(); }
    eq(p9.Elements.Count, 1);
    ok(!repo._output.some(function (o) { return /WARN/.test(o.text); }), "zadny WARN");
});
t("K8: FB_Config QEAX ma auditPkg = GUID #AI-LOG 686", function () {
    var cfg = B.FB_Config.call(B);
    var q = null;
    for (var i = 0; i < cfg.length; i++) { if (cfg[i].repo === "EA17_Yoga_QEA2.qeax") { q = cfg[i]; } }
    ok(q && q.auditPkg === "{AEEBE2C0-AD55-4912-903D-07CD047C7244}", "auditPkg QEAX");
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
t("dblclick handler: marker (pkg:ID) -> GetPackageByID + ShowInProjectView(package) (T1)", function () {
    var repo = mkRepo();
    var pkg = repo._addPackage({ id: 1071, name: "T7 Mail", elementID: 11341 });
    repo._addElement({ id: 1071, name: "CIZI PRVEK SE STEJNYM CISLEM", packageID: 1 });
    B.EA_OnOutputItemDoubleClicked.call(B, repo, "AI Bridge", "  [vytvoreno]  package \"T7 Mail\"  @ Model.#FB-TEST.T7 Mail  (pkg:1071)", 0);
    eq(repo._shown.length, 1, "melo se navigovat na package");
    eq(repo._shown[0], pkg, "cil ma byt Package objekt, ne element se stejnym cislem");
});
t("dblclick handler: marker (dgm:ID) -> GetDiagramByID + ShowInProjectView(diagram) (T1)", function () {
    var dg = { DiagramID: 1133, Name: "FBT OwnedDiag" };
    var repo = mkRepo({ diagrams: { 1133: dg } });
    B.EA_OnOutputItemDoubleClicked.call(B, repo, "AI Bridge", "  [diagram vytvoren]  \"FBT OwnedDiag\"  (dgm:1133)", 0);
    eq(repo._shown.length, 1, "melo se navigovat na diagram");
    eq(repo._shown[0], dg);
});
t("dblclick handler: marker (el:ID) ma prednost pred 3. paramem; bez markeru plati ID (T1 regrese)", function () {
    var repo = mkRepo();
    repo._addPackage({ id: 1, name: "Model" });
    var a = repo._addElement({ id: 42, name: "A", packageID: 1 });
    var b = repo._addElement({ id: 43, name: "B", packageID: 1 });
    B.EA_OnOutputItemDoubleClicked.call(B, repo, "AI Bridge", "  [vytvoreno]  \"B\"  (el:43)", 42);
    eq(repo._shown[0], b, "marker ma prednost");
    B.EA_OnOutputItemDoubleClicked.call(B, repo, "AI Bridge", "  [vytvoreno]  \"A\"  @ Model.A", 42);
    eq(repo._shown[1], a, "radek bez markeru = stavajici chovani (ID = ElementID)");
    B.EA_OnOutputItemDoubleClicked.call(B, repo, "AI Bridge", "  [smazano]  Element \"X\"", 0);
    eq(repo._shown.length, 2, "radek bez cile nenaviguje");
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

// =====================================================================
// --- ITERACE 7 (schrankovy kanal, zadani v1.1 2026-08-30): FB_ChatRender
// nese IDENTITU vysledku (GUID + jmeno), retry par. 5a proveditelny z ACK.
// Testy = akceptacni kriteria par. 6 (1-9) + 11' (uplnost proti REG).
// =====================================================================

t("I7 krit.1: get_selected_context -> ACK nese GUID, jmeno, inWhitelist i plnou path (regrese res-20260821-03)", function () {
    var out = chat({
        status: "done", id: "20260821-03", repository: "EAEXAMPLE.QEA",
        results: [{ op: "get_selected_context", status: "ok", selected: true,
            context: { type: "Package", guid: "{5A55C1C5-3A34-4a5f-A33C-A6E829A29AAA}", id: 1054,
                name: "#FB-TEST", path: "Model.Sandbox.#FB-TEST", inWhitelist: true, whitelistNote: "" },
            selectedElements: [], currentDiagram: null, treeType: 5 }]
    });
    contains(out, "{5A55C1C5-3A34-4a5f-A33C-A6E829A29AAA}");
    contains(out, "#FB-TEST");
    contains(out, "inWhitelist=true");
    contains(out, "path=Model.Sandbox.#FB-TEST", "path plnou cestou (par. 4.2/I5)");
});

t("I7 krit.2a: find_elements_by_name se 3 polozkami -> ACK nese 3 GUIDy", function () {
    var out = chat({
        status: "done", id: "t7-f3", repository: "EAEXAMPLE.QEA",
        results: [{ op: "find_elements_by_name", status: "ok", count: 3, items: [
            { guid: "{F0000001-0000-0000-0000-000000000001}", id: 1, name: "UC Alfa", type: "UseCase" },
            { guid: "{F0000002-0000-0000-0000-000000000002}", id: 2, name: "UC Beta", type: "UseCase" },
            { guid: "{F0000003-0000-0000-0000-000000000003}", id: 3, name: "UC Gama", type: "UseCase" }
        ] }]
    });
    contains(out, "{F0000001-0000-0000-0000-000000000001}");
    contains(out, "{F0000002-0000-0000-0000-000000000002}");
    contains(out, "{F0000003-0000-0000-0000-000000000003}");
    contains(out, "UC Alfa");
    contains(out, "(UseCase)", "typ na plne urovni detailu");
});

t("I7 krit.2b: 200 polozek -> prvnich N=items (default 25) + ukazatel, nikdy tichy cut", function () {
    var items = [];
    for (var i = 1; i <= 200; i++) {
        var nn = ("000" + i).slice(-3);
        items.push({ guid: "{G-" + nn + "}", id: i, name: "E" + nn });
    }
    var out = chat({
        status: "done", id: "t7-f200", repository: "EAEXAMPLE.QEA",
        results: [{ op: "find_elements_by_name", status: "ok", count: 200, items: items }]
    });
    contains(out, "{G-025}", "25. polozka jeste v ACK (default items=25, par. 4.3)");
    ok(out.indexOf("{G-026}") < 0, "26. polozka uz ne");
    contains(out, "zobrazeno prvnich 25 z 200", "hlasity orez s poctem");
    contains(out, "res-t7-f200.json", "ukazatel na res soubor (W10)");
});

t("I7 krit.3: create_or_update_elements -> oba GUIDy; follow-up davka slozena JEN z ACK je platna", function () {
    var g1 = "{11111111-2222-3333-4444-555555555555}";
    var g2 = "{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}";
    var out = chat({
        status: "done", id: "t7-w2", repository: "EAEXAMPLE.QEA",
        results: [{ op: "create_or_update_elements", status: "ok", count: 2, items: [
            { guid: g1, id: 11, name: "UC Posli mailovou zpravu", created: true },
            { guid: g2, id: 12, name: "UC Prijmi zpravu", created: true }
        ] }]
    });
    contains(out, g1); contains(out, g2);
    // davka VYHRADNE z renderovaneho textu (kriterium 3 - nejsilnejsi test)
    var found = ("" + out).match(/\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}/g) || [];
    eq(found.length, 2, "z ACK jdou vytahnout prave 2 kompletni GUIDy");
    var batch = JSON.parse(JSON.stringify({
        protocol: "eafb/0.2", id: "t7-w2-fix", repo: "EAEXAMPLE.QEA",
        ops: [{ op: "move_elements", elements: [found[0], found[1]], targetPackage: found[0] }]
    }));
    eq(batch.ops[0].elements[0], g1, "GUID z ACK == GUID z response");
    eq(batch.ops[0].elements[1], g2);
});

t("I7 krit.4: orez podle priority par. 4.4 - GUIDy zustavaji, jmena odpadaji; integrita GUID (W2)", function () {
    var origCfg = B.FB_Config;
    B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", chat: { total: 400 } }]; };
    var items = [];
    for (var i = 0; i < 5; i++) {
        items.push({ guid: "{AB00000" + i + "-1111-2222-3333-44444444444" + i + "}", id: i,
            name: "Velmi dlouhe jmeno prvku cislo " + i + " ktere se do rozpoctu nevejde" });
    }
    var out;
    try {
        out = chat({ status: "done", id: "t7-cut", repository: "EAEXAMPLE.QEA",
            results: [{ op: "create_or_update_elements", status: "ok", count: 5, items: items }] });
    } finally { B.FB_Config = origCfg; }
    for (var k = 0; k < 5; k++) { contains(out, "{AB00000" + k, "GUID " + k + " musi prezit orez"); }
    ok(out.indexOf("Velmi dlouhe jmeno") < 0, "jmena musi odpadnout DRIVE nez GUIDy (par. 4.4)");
    contains(out, "res-t7-cut.json", "orez vzdy s ukazatelem (W10)");
    // integrita GUID po orezu (W2): zadny podretezec { bez uzavirajici }
    var opens = out.split("{").length - 1, closes = out.split("}").length - 1;
    eq(opens, closes, "pocty { a } musi sedet - zadny neuplny GUID");
    ok(out.lastIndexOf("{") < out.lastIndexOf("}"), "posledni GUID je uzavreny");
});

t("I7 krit.4b: FB_Config bez polozky chat -> defaulty v kodu (total 4000, zadny orez pod 1500)", function () {
    // realny FB_Config (EAEXAMPLE bez sekce chat) - fixture "repo bez polozky"
    var items = [];
    for (var i = 0; i < 20; i++) {
        items.push({ guid: "{DEF0000" + ("0" + i).slice(-2) + "-0000-0000-0000-000000000000}", id: i, name: "Prvek cislo " + i });
    }
    var out = chat({ status: "done", id: "t7-def", repository: "EAEXAMPLE.QEA",
        results: [{ op: "create_or_update_elements", status: "ok", count: 20, items: items }] });
    ok(out.length > 900, "s defaultem total=4000 se 20 polozek vejde (delka " + out.length + ")");
    ok(out.indexOf("orez rozpoctem") < 0, "zadny globalni orez na defaultech");
});

t("I7 krit.5: zakaz obsahu - notes/XMLContent/raw/rtf_b64/png_b64 NIKDY v ACK", function () {
    var out = chat({
        status: "done", id: "t7-sec", repository: "EAEXAMPLE.QEA",
        results: [
            { op: "get_elements_information", status: "ok", count: 1, items: [
                { guid: "{E0000001-0000-0000-0000-000000000001}", id: 1, name: "El1", type: "UseCase",
                  notes: "TAJNE-NOTES", XMLContent: "<x>TAJNE-XML</x>" }] },
            { op: "get_baselines", status: "ok", count: 1, packageGuid: "{P0000001-0000-0000-0000-000000000001}",
              items: [{ guid: "{B0000001-0000-0000-0000-000000000001}", version: "1.0", notes: "TAJNE-BNOTES", date: "2026-08-30" }],
              raw: "<xml>TAJNE-RAW</xml>" },
            { op: "get_diagrams_information", status: "ok", count: 1, items: [
                { guid: "{D0000001-0000-0000-0000-000000000001}", name: "SD1", type: "Sequence",
                  messages: [{ name: "TAJNE-MSG1" }, { name: "TAJNE-MSG2" }] }] },
            { op: "export_element_linked_documents", status: "ok", count: 1, items: [
                { file: "responses\\docs\\doc1.rtf", size: 123, rtf_b64: "TAJNE-RTF" }] },
            { op: "get_diagram_image", status: "ok", count: 1, items: [
                { file: "responses\\images\\d1.png", png_b64: "TAJNE-PNG" }] }
        ]
    });
    ok(out.indexOf("TAJNE-") < 0, "obsahova pole nesmi do chatu (nalezeno v: " + out.substring(0, 300) + ")");
    contains(out, "doc1.rtf", "souborovy vystup nese cestu");
    contains(out, "d1.png");
    contains(out, "NEPROJDE", "veta, ze obsah schrankou nejde (par. 3)");
    contains(out, "[zprav: 2]", "zpravy diagramu jen poctem (par. 4.2)");
});

t("I7 krit.6: ping ACK nese whitelist (GUID+jmeno+plna path) + access; nikdy login/groups/connection/nonce", function () {
    var out = chat({
        status: "done", id: "t7-ping", repository: "EAEXAMPLE.QEA",
        results: [{ op: "ping", status: "ok", echo: "x", eaVersion: "1715",
            repository: "EAEXAMPLE.QEA", connection: "C:\\Users\\tajnylogin\\models\\EAEXAMPLE.QEA",
            whitelist: [{ guid: "{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}", name: "#FB-TEST", path: "Model.Sandbox.#FB-TEST" }],
            access: { securityEnabled: true, login: "TAJNY-LOGIN", access: "write",
                groups: ["TAJNA-SKUPINA"], reason: "clen write skupiny dle FB_AccessGroups" } }]
    });
    contains(out, "{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}");
    contains(out, "#FB-TEST");
    contains(out, "path=Model.Sandbox.#FB-TEST", "plna cesta whitelist package (par. 4.5/I5)");
    contains(out, "pristup: write");
    contains(out, "clen write skupiny", "reason plnym textem");
    ok(out.indexOf("TAJNY-LOGIN") < 0, "login se nerenderuje (datova minimalizace par. 4.5)");
    ok(out.indexOf("TAJNA-SKUPINA") < 0, "groups se nerenderuji");
    ok(out.indexOf("tajnylogin") < 0, "connection se do ACK nedava");
    ok(out.toLowerCase().indexOf("nonce") < 0, "zadny nonce v ACK");
});

t("I7 krit.6b: prazdny whitelist = explicitni veta, ne prazdne pole", function () {
    var out = chat({
        status: "done", id: "t7-pw0", repository: "JINE.QEA",
        results: [{ op: "ping", status: "ok", repository: "JINE.QEA", whitelist: [],
            access: { securityEnabled: false, access: "write", reason: "security vypnuta" } }]
    });
    contains(out, "whitelist: PRAZDNY", "prazdny whitelist musi byt explicitne pojmenovan (par. 4.5)");
});

t("I7: FB_OpPing rozvine whitelist filtrovany na repo; nedohledatelna polozka s poznamkou", function () {
    delete B._fbAccessCache;
    var repo = mkRepo();
    var r = B.FB_OpPing.call(B, repo, { op: "ping", echo: "x" });
    eq(r.status, "ok");
    ok(r.whitelist && r.whitelist.length === 1, "radek EAEXAMPLE z FB_Whitelist se ma propsat");
    contains(r.whitelist[0].guid, "{CCD344F6", "GUID z FB_Whitelist");
    contains(r.whitelist[0].note || "", "nedohledatelna", "nedohledatelny package = poznamka, ne tiche zahozeni");
    eq(r.access.access, "write", "security vypnuta -> write (FB_UserAccess)");
});

t("I7: FB_OpPing dohleda jmeno + plnou cestu whitelist package", function () {
    delete B._fbAccessCache;
    var repo = mkRepo();
    repo._addPackage({ id: 1, name: "Model" });
    repo._addPackage({ id: 2, name: "Sandbox", parentID: 1 });
    repo._addPackage({ id: 3, name: "#FB-TEST", parentID: 2, guid: "{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}" });
    var r = B.FB_OpPing.call(B, repo, { op: "ping" });
    eq(r.whitelist.length, 1);
    eq(r.whitelist[0].name, "#FB-TEST");
    eq(r.whitelist[0].path, "Model.Sandbox.#FB-TEST", "path plnou cestou pres FB_ElementPath");
});

t("I7 krit.7: E_REPO pojmenuje pripojeny repozitar (basename souborove cesty)", function () {
    var out = chat({
        status: "error", id: "20260821-01", code: "E_REPO",
        message: "Davka je urcena pro repozitar '<NAZEV_REPOZITARE>', pripojeny je jiny. Nic nebylo provedeno.",
        repository: "C:\\Users\\nejakylogin\\models\\EAEXAMPLE.QEA",
        results: []
    });
    contains(out, "EAFB CHYBA 20260821-01");
    contains(out, "Pripojeny repozitar: EAEXAMPLE.QEA", "agent se ma opravit sam (par. 4.6)");
});

t("I7 krit.9: neznama operace -> bezpecny default op+status+shrnuti+ukazatel, nikdy prazdny render", function () {
    var out = chat({
        status: "done", id: "t7-unk", repository: "EAEXAMPLE.QEA",
        results: [{ op: "operace_z_budoucna", status: "ok", count: 7 }]
    });
    contains(out, "op[0] operace_z_budoucna: ok", "op + status (B4)");
    contains(out, "count 7", "ciselne shrnuti");
    contains(out, "res-t7-unk.json", "ukazatel na res");
});

t("I7: trida D - diagramova rodina renderuje ciselne shrnuti, nikdy prazdny segment", function () {
    var out = chat({
        status: "done", id: "t7-d", repository: "EAEXAMPLE.QEA",
        results: [
            { op: "layout_connectors", status: "ok", diagramID: 5, style: "auto", changed: [1, 2, 3] },
            { op: "open_diagrams", status: "ok", opened: [7], count: 1 },
            { op: "remove_elements_from_diagram", status: "ok", diagramID: 5, removedElementIDs: [9, 10], count: 2 }
        ]
    });
    contains(out, "op[0] layout_connectors: 3 polozek");
    contains(out, "op[1] open_diagrams: 1 polozek");
    contains(out, "op[2] remove_elements_from_diagram: 2 polozek");
    contains(out, "res-t7-d.json", "trida D vzdy s ukazatelem na res");
});

t("I7 vyjimka B3: constraints/requirements - element GUID + name+type, rebuild pokyn; jmena prezijou i orez", function () {
    var origCfg = B.FB_Config;
    var elGuid = "{E1E1E1E1-0000-0000-0000-000000000001}";
    var mk = function () {
        return chat({
            status: "done", id: "t7-b3", repository: "EAEXAMPLE.QEA",
            results: [{ op: "create_or_update_constraints", status: "ok", count: 3, removed: 3,
                guid: elGuid, id: 11129, items: [
                    { name: "PRE-1 prihlaseny uzivatel", type: "Precondition", created: true },
                    { name: "PST-1 zprava odeslana", type: "Postcondition", created: true },
                    { name: "ASU-1 SMTP dostupne", type: "Invariant", created: true }
                ] }]
        });
    };
    var out = mk();
    contains(out, elGuid, "identita = element GUID (res.guid)");
    contains(out, "PRE-1 prihlaseny uzivatel");
    contains(out, "(Precondition)", "type je soucast identity B3 polozky");
    contains(out, "rebuild kompletni sady", "retry pokyn dle par. 5a/B3");
    // orez: jmena B3 polozek JSOU identita - nesmi odpadnout ve prospech niceho
    B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", chat: { total: 380 } }]; };
    var out2;
    try { out2 = mk(); } finally { B.FB_Config = origCfg; }
    ok(out2.indexOf("PRE-1") >= 0 || out2.indexOf("res-t7-b3.json") >= 0,
        "B3: bud jmena drzi, nebo je hlasity ukazatel - nikdy tichy cut");
});

t("I7 krit.12 (offline analog): chyba uprostred davky -> GUIDy drivejsich ok operaci JSOU v ACK", function () {
    var g1 = "{C1000001-0000-0000-0000-000000000001}";
    var out = chat({
        status: "error", id: "t7-err", repository: "EAEXAMPLE.QEA",
        results: [
            { op: "create_or_update_elements", status: "ok", count: 1, items: [{ guid: g1, id: 1, name: "UC Hotovy", created: true }] },
            { op: "create_or_update_connectors", status: "error", code: "E_NOT_FOUND", message: "target neni" },
            { op: "create_or_update_scenarios", status: "skipped" }
        ]
    });
    contains(out, "EAFB CHYBA t7-err v op[1]");
    contains(out, g1, "GUID polozky vznikle PRED chybou musi byt v ACK (par. 5a / kriterium 12)");
    contains(out, "UC Hotovy");
});

t("I7 krit.11': uplnost projekcni tabulky proti registru REG (W3)", function () {
    // enumerace REG z FB_Main.js + PROJ z FB_ChatRender.js (zdrojove soubory,
    // vzor FB_RiskGate.js validace uplnosti classes) - nova operace bez
    // zaznamu v projekcni tabulce = cerveny harness
    var mainSrc = fs.readFileSync(path.join(SRC, "AICodeBridge.FB_Main.js"), "utf8");
    var regM = /var REG = \{([\s\S]*?)\n\};/.exec(mainSrc);
    ok(regM, "blok REG ve FB_Main.js nalezen");
    var regOps = [], rex = /"([a-z0-9_]+)":\s*\{\s*fn:/g, m1;
    while ((m1 = rex.exec(regM[1])) != null) { regOps.push(m1[1]); }
    ok(regOps.length >= 42, "registr ma mit aspon 42 operaci, nalezeno " + regOps.length);
    var chatSrc = fs.readFileSync(path.join(SRC, "AICodeBridge.FB_ChatRender.js"), "utf8");
    var projM = /var PROJ = \{([\s\S]*?)\n\};/.exec(chatSrc);
    ok(projM, "blok PROJ ve FB_ChatRender.js nalezen");
    var projOps = {}, pex = /"([a-z0-9_]+)":\s*\{\s*cls:\s*"([ABCD])"/g, m2;
    var projCount = 0;
    while ((m2 = pex.exec(projM[1])) != null) { projOps[m2[1]] = m2[2]; projCount++; }
    var missing = [];
    for (var ri = 0; ri < regOps.length; ri++) {
        if (!projOps[regOps[ri]]) { missing.push(regOps[ri]); }
    }
    ok(missing.length === 0, "operace registru bez zaznamu v projekcni tabulce (par. 4.2/W3): " + missing.join(", "));
    // kontrolni soucet trid dle Prilohy A: 27+1+8+6 = 42
    var byCls = { A: 0, B: 0, C: 0, D: 0 };
    for (var pk in projOps) { byCls[projOps[pk]]++; }
    ok(byCls.A >= 27 && byCls.B >= 1 && byCls.C >= 8 && byCls.D >= 6,
        "rozpad trid nesedi s Prilohou A: A=" + byCls.A + " B=" + byCls.B + " C=" + byCls.C + " D=" + byCls.D);
});

t("I7: zadny substring cut vysledneho retezce v renderu (W2)", function () {
    // finalni pojistka drive rezala out.substring(0, BUDGET-90) - po iteraci 7
    // se render sklada z celych polozek a vysledny retezec se NIKDY nestriha
    var chatSrc = fs.readFileSync(path.join(SRC, "AICodeBridge.FB_ChatRender.js"), "utf8");
    ok(!/out\s*=\s*out\.substring\(/.test(chatSrc), "render nesmi strihat vysledny retezec substringem");
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


// --- 1b (Z260904-1): plna teckova cesta mazaneho/presouvaneho cile v dialogu
function pathRepo() {
    var repo = gateRepo();
    repo._addPackage({ id: 1, name: "Model", parentID: 0 });
    repo._addPackage({ id: 1054, name: "#FB-TEST", parentID: 1 });
    repo._addPackage({ id: 1067, name: "OTHER ELEMENTS", parentID: 1054 });
    repo._addPackage({ id: 1069, name: "UC-95002", parentID: 1054 });
    repo._addElement({ id: 11310, name: "UC-95002", packageID: 1067 });
    return repo;
}
var REG_DEL = { "delete_from_model": { w: true }, "move_elements": { w: true }, "create_or_update_elements": { w: true } };
function polDel() {
    return [{ repo: "EAEXAMPLE.QEA",
        classes: { delete_from_model: "ELEVATED", move_elements: "ELEVATED", create_or_update_elements: "LOW" },
        elevate: { deleteTargets: 0, writeOps: 20, updatedExisting: 10, affectedPackages: 5, foreignDiagrams: 5 },
        block: { deleteTargets: 100, writeOps: 500, updatedExisting: 100, affectedPackages: 50 },
        budgetMs: 8000, hashMaxChars: 2000000 }];
}
t("RiskGate: delete package -> summary.paths nese PLNOU teckovou cestu (1b)", function () {
    var polOrig = B.FB_RiskPolicy; B.FB_RiskPolicy = polDel;
    var r = B.FB_RiskGate.call(B, pathRepo(), { ops: [
        { op: "delete_from_model", targets: [{ type: "Package", id: 1069 }] }
    ] }, REG_DEL);
    B.FB_RiskPolicy = polOrig;
    eq(r.riskLevel, "ELEVATED");
    ok(r.summary.paths && r.summary.paths.length === 1, "chybi summary.paths: " + JSON.stringify(r.summary));
    eq(r.summary.paths[0], "Model.#FB-TEST.UC-95002", "cesta ma byt plna od korene (vzor whitelist v pingu)");
});
t("RiskGate: delete element + move -> cesta elementu vc. package retezu (1b)", function () {
    var polOrig = B.FB_RiskPolicy; B.FB_RiskPolicy = polDel;
    var r = B.FB_RiskGate.call(B, pathRepo(), { ops: [
        { op: "delete_from_model", targets: [{ type: "Element", id: 11310 }] }
    ] }, REG_DEL);
    var m = B.FB_RiskGate.call(B, pathRepo(), { ops: [
        { op: "move_elements", "package": 1069, elements: [11310] }
    ] }, REG_DEL);
    B.FB_RiskPolicy = polOrig;
    eq(r.summary.paths[0], "Model.#FB-TEST.OTHER ELEMENTS.UC-95002");
    eq(m.summary.paths[0], "Model.#FB-TEST.OTHER ELEMENTS.UC-95002", "presun ma ukazat, ODKUD prvek jde, plnou cestou");
});
t("RiskGate: davka bez delete/move -> summary.paths prazdne (regrese)", function () {
    var polOrig = B.FB_RiskPolicy; B.FB_RiskPolicy = polDel;
    var r = B.FB_RiskGate.call(B, pathRepo(), { ops: [
        { op: "create_or_update_elements", elements: [{ elementID: 11310, name: "x" }] }
    ] }, REG_DEL);
    B.FB_RiskPolicy = polOrig;
    eq(r.summary.paths.length, 0);
});
t("ConfirmSummary: delete dialog ukaze 'Kde (plna cesta mazaneho)' (1b, nalez MLA 31.8.)", function () {
    var out = "" + B.FB_ConfirmSummary.call(B, {
        status: "confirm_required", id: "P8",
        risk: { metrics: { deleteTargets: 1, createOps: 0, updatedExisting: 0, writeOps: 1 },
                summary: { targets: [], packages: ["T7 Mail"], paths: ["Model.Sandbox.#FB-TEST.T7 Mail"] },
                riskReasons: ["Operace 'delete_from_model' je politikou klasifikovana ELEVATED"] },
        confirm: { hashPrefix: "abc123abc123" }, results: []
    });
    contains(out, "SMAZAT 1");
    contains(out, "Kde (plna cesta mazaneho): Model.Sandbox.#FB-TEST.T7 Mail");
});
t("ConfirmSummary: vice cest -> odrazky; bez paths beze zmeny (regrese)", function () {
    var two = "" + B.FB_ConfirmSummary.call(B, { status: "confirm_required", id: "x",
        risk: { metrics: { deleteTargets: 2, writeOps: 2 }, summary: { targets: ["A", "B"], paths: ["M.A", "M.B"] }, riskReasons: [] }, results: [] });
    contains(two, "  - M.A"); contains(two, "  - M.B");
    var none = "" + B.FB_ConfirmSummary.call(B, { status: "confirm_required", id: "y",
        risk: { metrics: { createOps: 1, writeOps: 1 }, summary: { targets: [], packages: ["P"] }, riskReasons: [] }, results: [] });
    ok(none.indexOf("Kde (") < 0, "bez paths se radek Kde nesmi objevit");
});

// --- 1c (Z260904-1): chybova vetev delete s vice targets vyjmenuje i selhany
t("FB_OpDelete: E_NOT_FOUND uprostred -> items nese smazane i selhany target + pocty (1c)", function () {
    var repo = wlRepo();
    var pkg = repo.GetPackageByID(1054);
    var a = repo._addElement({ id: 501, name: "DEL-A", packageID: 1054 });
    pkg.Elements._items.push(a);
    var res = B.FB_OpDelete.call(B, repo, { op: "delete_from_model", targets: [
        { type: "Element", id: 501 }, { type: "Element", guid: "{00000000-0000-0000-0000-000000000000}" }, { type: "Element", id: 503 }
    ] }, "t-del-1c");
    eq(res.status, "error"); eq(res.code, "E_NOT_FOUND");
    eq(res.items.length, 2, "items = 1 smazany + 1 selhany: " + JSON.stringify(res.items));
    eq(res.items[0].deleted, true); eq(res.items[0].name, "DEL-A");
    eq(res.items[1].deleted, false); eq(res.items[1].code, "E_NOT_FOUND"); eq(res.items[1].index, 1);
    contains(res.items[1].name, "{00000000-0000-0000-0000-000000000000}", "selhany target ma byt identifikovatelny");
    contains(res.message, "smazano pred chybou: 1 z 3");
    contains(res.message, "neprovedeno: 1");
    eq(pkg.Elements.Count, 0, "prvni target se smazat mel");
});

// --- E2E pumpa P8 (Z260904-1b, 2026-09-05): smazany package v items nese PackageID
// + jmeno + cestu (zive res-P8 melo {"type":"Package","id":0,"deleted":true})
t("FB_OpDelete: Package podle GUID -> items nese PackageID, name, path (P8 nalez)", function () {
    var repo = wlRepo();
    var parent = repo.GetPackageByID(1054);
    var sub = repo._addPackage({ id: 1076, name: "P4 Mail (pumpa)", parentID: 1054, guid: "{PKG-P4}" });
    parent.Packages._items.push(sub);
    var res = B.FB_OpDelete.call(B, repo, { op: "delete_from_model", targets: [{ type: "Package", guid: "{PKG-P4}" }] }, "t-del-p8");
    eq(res.status, "ok", JSON.stringify(res));
    eq(res.items[0].id, 1076, "id = PackageID, ne 0 z requestu");
    eq(res.items[0].name, "P4 Mail (pumpa)");
    ok(("" + res.items[0].path).indexOf("P4 Mail (pumpa)") >= 0, "path ma koncit jmenem package: " + res.items[0].path);
    eq(parent.Packages.Count, 0);
});

// --- E2E pumpa P8c (Z260904-1c, 2026-09-05): delete s vice cili skoncil error,
// prvni cil UZ smazany - Output mlcel (FB_Main: okc 0 -> FB_LogChanges se
// nevolal; FB_LogChanges: status != ok -> continue). Zive res-P8c.json.
t("FB_LogChanges: delete error s deleted:true v items -> [smazano] + [nesmazano] (P8c nalez)", function () {
    var repo = mkRepo();
    B.FB_LogChanges.call(B, repo, { id: "t-log-p8c", results: [
        { op: "delete_from_model", status: "error", code: "E_NOT_FOUND", items: [
            { type: "Package", id: 1077, name: "P4 Mail (pumpa)", path: "M.#FB-TEST.P4 Mail (pumpa)", deleted: true },
            { type: "Package", id: 0, guid: "{0}", name: "{0}", deleted: false, code: "E_NOT_FOUND", index: 1 }
        ] }
    ] });
    var del = repo._output.filter(function (o) { return o.text.indexOf("[smazano]") >= 0; });
    eq(del.length, 1, "chybi radek smazano: " + JSON.stringify(repo._output));
    contains(del[0].text, "P4 Mail (pumpa)"); contains(del[0].text, "@ M.#FB-TEST.P4 Mail (pumpa)");
    var ne = repo._output.filter(function (o) { return o.text.indexOf("[nesmazano]") >= 0; });
    eq(ne.length, 1, "selhany cil ma mit radek nesmazano");
    contains(ne[0].text, "E_NOT_FOUND");
    // error bez items (nic se nesmazalo) -> zadny radek
    var repo2 = mkRepo();
    eq(B.FB_LogChanges.call(B, repo2, { id: "t-log-p8c2", results: [{ op: "delete_from_model", status: "error", code: "E_ARGS" }] }), 0);
});
t("FB_Main: delete error po castecnem smazani -> FB_LogChanges se vola (Output nemlci) (P8c nalez)", function () {
    delete B._fbAccessCache;
    var repo = mainRepoBase({ securityEnabled: false });
    var oD = B.FB_OpDelete, oG = B.FB_RiskGate;
    B.FB_OpDelete = function () { return { op: "delete_from_model", status: "error", code: "E_NOT_FOUND", message: "targets[1]", items: [
        { type: "Package", id: 1077, name: "P4 Mail (pumpa)", path: "M.P4 Mail (pumpa)", deleted: true },
        { type: "Package", id: 0, name: "{0}", deleted: false, code: "E_NOT_FOUND", index: 1 } ] }; };
    B.FB_RiskGate = function () { return { riskLevel: "LOW", riskReasons: [], policyValid: true, metrics: {}, summary: {} }; };
    // Baseline politika (Z260907-3): test je o FB_LogChanges, ne o zaloze -
    // rozhodnuti o baseline se stubuje stejne jako gate (mock cile neresolvuje)
    var oBd = B.FB_BaselineDecide;
    B.FB_BaselineDecide = function () { return { action: "none", reason: "stub", confirmReasons: [], manual: null, lines: [] }; };
    var out;
    try {
        out = B.FB_Main.call(B, repo, JSON.stringify({ protocol: "eafb/0.2", id: "t-p8c", repo: "EAEXAMPLE.QEA",
            ops: [{ op: "delete_from_model", targets: [{ type: "Package", guid: "{A}" }, { type: "Package", guid: "{0}" }] }] }));
    } finally { B.FB_OpDelete = oD; B.FB_RiskGate = oG; B.FB_BaselineDecide = oBd; }
    var resp = JSON.parse(out);
    eq(resp.status, "error", out.substring(0, 300));
    var del = repo._output.filter(function (o) { return o.text.indexOf("[smazano]") >= 0 && o.text.indexOf("P4 Mail (pumpa)") >= 0; });
    eq(del.length, 1, "Output ma nest smazany package i po error davce: " + JSON.stringify(repo._output));
});

// --- K8 QEAX (Z260904-6): configy se zastupnou identitou repa = fail-secure
var K8_CFG_FILES = ["AICodeBridge.FB_Whitelist.js", "AICodeBridge.FB_Config.js", "AICodeBridge.FB_OpsAllowed.js",
                    "AICodeBridge.FB_RiskPolicy.js", "AICodeBridge.FB_AccessGroups.js"];
// 6b 2026-09-09 (zivy K3): identita QEAX = nazev souboru .qeax, GUID #FB-TEST
// z res-K3.json. Placeholder uz nesmi byt nikde (ani v komentari by nevadil,
// ale v aktivnim kodu = fail-secure past: zadny zapis do QEAX).
var K8_REPO_ID = "EA17_Yoga_QEA2.qeax";
var K8_PKG_GUID = "{78F3F9CB-68B9-4e31-9287-AC38F59BFF17}";
t("K8: skutecna identita QEAX je PRAVE JEDNOU a placeholder 0x v kazdem z 5 configu", function () {
    K8_CFG_FILES.forEach(function (f) {
        var code = fs.readFileSync(path.join(SRC, f), "utf8");
        var active = code.split(/\r?\n/).filter(function (l) { return l.replace(/^\s+/, "").indexOf("//") !== 0; }).join("\n");
        var n = active.split('"' + K8_REPO_ID + '"').length - 1;
        eq(n, 1, f + ": ocekavan 1 aktivni vyskyt identity QEAX, je " + n);
        eq(active.indexOf("<QEAX-FILENAME>"), -1, f + ": placeholder <QEAX-FILENAME> uz v aktivnim kodu nesmi byt");
        eq(active.indexOf("<GUID-685>"), -1, f + ": placeholder <GUID-685> uz v aktivnim kodu nesmi byt");
    });
    var wl = B.FB_Whitelist.call(B);
    ok(wl.length === 2 && wl[1].repo === K8_REPO_ID && wl[1].pkg === K8_PKG_GUID, "QEAX polozka whitelistu se skutecnou identitou a GUID #FB-TEST");
});
t("K8: FB_RiskPolicy polozka QEAX ma tytez tridy a prahy jako eaexample", function () {
    var pol = B.FB_RiskPolicy.call(B);
    var eaex = null, qeax = null;
    for (var i = 0; i < pol.length; i++) {
        if (/EAEXAMPLE/i.test("" + pol[i].repo)) { eaex = pol[i]; }
        if (pol[i].repo === K8_REPO_ID) { qeax = pol[i]; }
    }
    ok(eaex && qeax, "chybi eaexample nebo QEAX polozka");
    eq(JSON.stringify(qeax.classes), JSON.stringify(eaex.classes));
    eq(JSON.stringify(qeax.elevate), JSON.stringify(eaex.elevate));
    eq(JSON.stringify(qeax.block), JSON.stringify(eaex.block));
    eq(qeax.classes["deploy_src"], "ELEVATED", "deploy_src v QEAX = ELEVATED (K6 reception sync pumpou)");
});
function k8Repo(opts) {
    // realne configy (ZADNE prepsani FB_*): identita, ktera QEAX polozce neodpovida (cizi model)
    opts = opts || {};
    var rules = [{ re: /#AI-LOG/i, rows: [] }];
    if (opts.groups) { rules.push({ re: /t_secgroup/i, rows: opts.groups.map(function (g) { return { GroupName: g }; }) }); }
    var repo = mkRepo({ connectionString: "C:\\HARNESS\\QEAX-K8-MODEL.QEA",
        securityEnabled: opts.securityEnabled, login: opts.login, sqlRules: rules });
    repo._addPackage({ id: 685, name: "#FB-TEST", guid: "{K8-685-GUID}" });
    return repo;
}
t("K8 fail-secure: security ON + clen EAFB Write, ale repo neodpovida zadne polozce -> E_ADDIN_ACCESS (nic nezapsano)", function () {
    delete B._fbAccessCache;
    var repo = k8Repo({ securityEnabled: true, login: "milos", groups: ["EAFB Write"] });
    var out = B.FB_Main.call(B, repo, JSON.stringify({ protocol: "eafb/0.2", id: "k8-fs-1",
        ops: [{ op: "create_or_update_package", parent: "{K8-685-GUID}", name: "K8 nesmi vzniknout" }] }));
    delete B._fbAccessCache;
    var resp = JSON.parse(out);
    eq(resp.code, "E_ADDIN_ACCESS", "repo bez polozky FB_AccessGroups = fail-closed read: " + out.substring(0, 200));
    eq(repo.GetPackageByID(685).Packages.Count, 0, "zadny package nesmel vzniknout");
});
t("K8 fail-secure: security OFF + repo neodpovida zadne polozce -> zadny zapis (status != done)", function () {
    delete B._fbAccessCache;
    var repo = k8Repo({ securityEnabled: false });
    var out = B.FB_Main.call(B, repo, JSON.stringify({ protocol: "eafb/0.2", id: "k8-fs-2",
        ops: [{ op: "create_or_update_package", parent: "{K8-685-GUID}", name: "K8 nesmi vzniknout" }] }));
    var resp = JSON.parse(out);
    ok(resp.status !== "done", "zapis nesmi projet: " + out.substring(0, 200));
    var oks = (resp.results || []).filter(function (r) { return r.status === "ok"; }).length;
    eq(oks, 0, "zadna operace ok");
    eq(repo.GetPackageByID(685).Packages.Count, 0, "zadny package nesmel vzniknout");
});
t("K8 fail-secure: cteci davka BEZ pole repo projde i v neznamem repu (K3 recon)", function () {
    delete B._fbAccessCache;
    var repo = k8Repo({ securityEnabled: true, login: "milos", groups: [] });
    var out = B.FB_Main.call(B, repo, JSON.stringify({ protocol: "eafb/0.2", id: "k8-fs-3",
        ops: [{ op: "ping", echo: "k3" }, { op: "query", sql: "SELECT 1 AS x" }] }));
    delete B._fbAccessCache;
    var resp = JSON.parse(out);
    eq(resp.status, "done", "cteni musi projit: " + out.substring(0, 300));
    contains(resp.repository, "QEAX-K8-MODEL.QEA", "ping vraci identitu repa pro doplneni configu");
    eq(resp.results[0].whitelist.length, 0, "placeholder whitelist se do ACK nepropisuje");
    eq(resp.results[0].access.access, "read");
});
t("K8 fail-secure: repo doplneno, pkg jeste placeholder -> FB_CheckWrite = E_WHITELIST", function () {
    var repo = k8Repo({ securityEnabled: false });
    var origWl = B.FB_Whitelist;
    B.FB_Whitelist = function () { return [{ repo: "QEAX-K8-MODEL.QEA", pkg: "<GUID-685>" }]; };
    var chk;
    try { chk = B.FB_CheckWrite.call(B, repo, repo.GetPackageByID(685)); } finally { B.FB_Whitelist = origWl; }
    ok(chk != null && chk.code === "E_WHITELIST", "ocekavan E_WHITELIST: " + JSON.stringify(chk));
});

// --- K8 ZIVE 2026-09-09 (Z260904-6b, K6): jmena security tabulek + chybny SQL bez vyjimky
t("K8 zive: FB_UserAccess se pta na t_secusergroup (bez podtrzitka), nikdy na t_secuser_group", function () {
    var code = fs.readFileSync(path.join(SRC, "AICodeBridge.FB_UserAccess.js"), "utf8");
    var active = code.split(/\r?\n/).filter(function (l) { return l.replace(/^\s+/, "").indexOf("//") !== 0; }).join("\n");
    ok(active.indexOf("t_secusergroup") >= 0, "SQL musi jmenovat t_secusergroup");
    eq(active.indexOf("t_secuser_group"), -1, "chybny nazev t_secuser_group nesmi byt v aktivnim kodu");
    var a4 = fs.readFileSync(path.join(__dirname, "..", "docs", "e2e-k8-qeax", "req-A4.json"), "utf8");
    eq(a4.indexOf("t_secuser_group"), -1, "req-A4.json: chybny nazev tabulky");
});
t("K8 zive: SQL clenstvi vrati vysledek BEZ Dataset_0 (EA bez vyjimky) -> fail-closed read s duvodem 'SQL', ne 'neni clenem'", function () {
    delete B._fbAccessCache;
    var repo = mkRepo({ securityEnabled: true, login: "milos",
        sqlRules: [{ re: /t_secusergroup/i, rows: [] }] });
    repo.SQLQuery = function (sql) { return "SQL API Open FAILED with error: no such table: t_secusergroup"; };
    var a = B.FB_UserAccess.call(B, repo);
    delete B._fbAccessCache;
    eq(a.access, "read");
    contains(a.reason, "dataset", "duvod musi rict, ze selhal dotaz");
    ok(a.reason.indexOf("neni clenem") < 0, "nesmi tvrdit, ze uzivatel neni clenem");
});
// --- N-K8-1 (2026-09-09): bootstrap zaklada/opravuje receptions EA_* handleru na lokalni Signal
t("ITAN-Bootstrap: EA_* handlery = receptions na lokalni Signal (StyleEx), stara veta 'zalozi deploy_src' pryc", function () {
    var code = fs.readFileSync(path.join(__dirname, "..", "scripts", "ITAN-Bootstrap File Bridge.js"), "utf8");
    ok(code.indexOf('"Reception=1;SignalGUID=" + sg + ";"') >= 0, "bootstrap musi nastavovat StyleEx reception");
    ok(/Object_Type = 'Signal' AND Name =/.test(code), "lookup Signalu podle jmena v cilovem modelu");
    eq(code.indexOf("zalozi deploy_src, ne bootstrap"), -1, "EA_* uz se nepreskakuji");
    ["EA_Connect", "EA_GetMenuItems", "EA_MenuClick", "EA_OnOutputItemDoubleClicked"].forEach(function (n) {
        ok(code.indexOf(n + ":") >= 0, "signatura " + n + " v EA_ARGS");
    });
    new Function("Repository", "Session", "ActiveXObject", "Enumerator", code.replace(/^\s*main\(\);\s*$/m, ""));
});
// --- BANKA 2026-09-10 (Z260908-5): bootstrap zalozil EA_MenuClick bez MenuName -> ItemName = "-AI Bridge"
t("ITAN-Bootstrap: EA_ARGS = Sparx broadcast signatury (EA_MenuClick ma MenuName), parametry existujicich receptions se synchronizuji", function () {
    var code = fs.readFileSync(path.join(__dirname, "..", "scripts", "ITAN-Bootstrap File Bridge.js"), "utf8");
    var m = /EA_MenuClick:\s*\[([^\]]*)\]/.exec(code);
    ok(m != null, "EA_ARGS.EA_MenuClick musi existovat");
    var args = m[1].split(",").map(function (a) { return a.replace(/[\s"]/g, ""); });
    eq(args.join(","), "Repository,MenuLocation,MenuName,ItemName", "Sparx: EA_MenuClick(Repository, MenuLocation, MenuName, ItemName)");
    var g = /EA_GetMenuItems:\s*\[([^\]]*)\]/.exec(code);
    eq(g[1].split(",").map(function (a) { return a.replace(/[\s"]/g, ""); }).join(","), "Repository,MenuLocation,MenuName");
    ok(code.indexOf("syncEaParams(m, name)") >= 0, "existujici reception musi projit sync parametru (pozicni predani argumentu EA)");
    ok(code.indexOf("Parameters.DeleteAt(dp, false)") >= 0, "sync = prestaveni parametru, ne jen pridani");
    ok(code.indexOf("parametry opraveny") >= 0, "souhrn hlasi pocet opravenych signatur");
    eq(KNOWN_ARGS.EA_MenuClick.join(","), "Repository,MenuLocation,MenuName,ItemName", "harness KNOWN_ARGS = tataz signatura");
});
// --- K8 A3 (Z260904-6): FB_InterpretError - vetev balickovych prav (zastupny vzor)
t("FB_InterpretError: Group Lock hlaska -> E_PERMISSION (ne E_LOCKED), puvodni text zachovan", function () {
    var r = B.FB_InterpretError.call(B, "Element 'X' is locked by group 'EAFB Locked'. You are not a member of this group.");
    ok(r != null, "hlaska musi byt rozpoznana");
    eq(r.code, "E_PERMISSION");
    contains(r.message, "EAFB Locked", "puvodni hlaska EA se nesmi ztratit");
    contains(r.message, "balickova prava");
});
t("FB_InterpretError: PRESNA hlaska EA z ziveho A3 (Group Lock, 2026-09-09) -> E_PERMISSION vetev balickovych prav", function () {
    var raw = "Cannot create new UseCase.  The parent package is locked by Project Security.";
    var r = B.FB_InterpretError.call(B, raw);
    ok(r != null, "hlaska musi byt rozpoznana");
    eq(r.code, "E_PERMISSION");
    contains(r.message, "balickova prava", "musi chytit vetev balickovych prav (skupinovy zamek), ne obecnou");
    contains(r.message, raw, "puvodni hlaska EA doslova zachovana");
    eq(B.FB_InterpretError.call(B, "Cannot create new Package.  The parent package is locked by Project Security.").code, "E_PERMISSION");
});
t("FB_InterpretError: Require User Lock to Edit bez zamku -> E_PERMISSION", function () {
    eq(B.FB_InterpretError.call(B, "You must apply a user lock to this element before you can edit it").code, "E_PERMISSION");
    eq(B.FB_InterpretError.call(B, "Package is locked to group Architects").code, "E_PERMISSION");
});
t("FB_InterpretError: zamek jineho uzivatele zustava E_LOCKED; nezname null (regrese)", function () {
    eq(B.FB_InterpretError.call(B, "Element is locked by user novak").code, "E_LOCKED");
    eq(B.FB_InterpretError.call(B, "Access denied").code, "E_PERMISSION");
    eq(B.FB_InterpretError.call(B, "Object reference not set"), null);
    eq(B.FB_InterpretError.call(B, ""), null);
});
// =====================================================================
// --- v0.13 S-opravy (Z260908-1, lekce E2E VS Code 2026-09-07: N2, N4)
// =====================================================================
// N2: chybny SQL -> E_SQL (ne falesna nula), SuppressEADialogs kolem SQLQuery
function supRepo(sqlImpl) {
    var repo = mkRepo();
    repo._supLog = [];
    var supVal = false;
    Object.defineProperty(repo, "SuppressEADialogs", {
        get: function () { return supVal; },
        set: function (v) { supVal = v; repo._supLog.push(v); }
    });
    repo.SQLQuery = function (sql) { repo._supDuringQuery = supVal; return sqlImpl(sql); };
    return repo;
}
t("N-K8-4 ROZHODNUTO (banka 2026-09-10): obalka <EADATA> bez Dataset_0 = ok / rowCount 0 + warning + raw (ne E_SQL)", function () {
    // presny tvar odpovedi EA 17.1.6 na MS SQL 2022 pro 0 radku (recon-01 op 7, vyjmenovane sloupce)
    var bankRaw = "<?xml version=\"1.0\" encoding=\"UTF-16\" standalone=\"no\" ?>\r\n<EADATA version=\"1.0\" exporter=\"Enterprise Architect\">\r\n</EADATA>";
    var r = B.FB_OpQuery.call(B, supRepo(function () { return bankRaw; }), { sql: "SELECT Package_ID, Name FROM t_package WHERE ea_guid = '{nic}'" });
    eq(r.status, "ok"); eq(r.rowCount, 0); eq(r.rows.length, 0);
    ok(typeof r.code == "undefined", "zadny chybovy kod");
    ok(r.warnings && r.warnings.length == 1, "warning o nerozlisitelnosti 0 radku vs. chybny dotaz");
    contains(r.warnings[0], "SQL API Open FAILED", "warning musi rict, jak se pozna chybny dotaz");
    contains(r.raw, "<EADATA", "raw nese zacatek odpovedi (diagnostika)");
    ok(r.raw.length <= 300);
    var r2 = B.FB_OpQuery.call(B, supRepo(function () { return "<?xml version=\"1.0\"?><EADATA version=\"1.0\" exporter=\"Enterprise Architect\"></EADATA>"; }), { sql: "SELECT * FROM t_seclocks" });
    eq(r2.status, "ok", "SQLite K10 tvar = totez"); eq(r2.rowCount, 0);
});
t("N2 E_SQL: EA vrati chybovy text bez Dataset_0 -> status error, code E_SQL, hlaska EA v message", function () {
    var repo = supRepo(function () { return "SQL API Open FAILED: no such column: Type"; });
    var r = B.FB_OpQuery.call(B, repo, { sql: "SELECT Type FROM t_objectconstraint LIMIT 1" });
    eq(r.status, "error"); eq(r.code, "E_SQL");
    contains(r.message, "no such column: Type", "prvni radek chyby EA musi byt v message");
    ok(typeof r.rowCount == "undefined", "E_SQL nesmi nest rowCount");
});
t("N2 E_SQL: prazdny retezec / bily text = E_SQL s vychozi hlaskou; ne-XML text = E_SQL s hlaskou EA (obalka bez datasetu uz NENI chyba)", function () {
    var r1 = B.FB_OpQuery.call(B, supRepo(function () { return ""; }), { sql: "SELECT x FROM neexistuje" });
    eq(r1.code, "E_SQL"); contains(r1.message, "dotaz selhal");
    var r1b = B.FB_OpQuery.call(B, supRepo(function () { return "  \r\n "; }), { sql: "SELECT x FROM neexistuje" });
    eq(r1b.code, "E_SQL");
    var r3 = B.FB_OpQuery.call(B, supRepo(function () { return "SQL API Open FAILED with error: no such table: t_x"; }), { sql: "SELECT x FROM t_x" });
    eq(r3.code, "E_SQL"); contains(r3.message, "no such table");
});
// --- FB_UserAccess: stejne pravidlo (banka 2026-09-10) - obalka bez datasetu = 0 skupin, ne "SQL selhal"
t("FB_UserAccess: obalka <EADATA> bez Dataset_0 = uzivatel bez skupin (neni clenem), prazdny retezec = SQL selhal", function () {
    var src = fs.readFileSync(path.join(SRC, "AICodeBridge.FB_UserAccess.js"), "utf8");
    ok(/<EADATA\[\\s>\\\/\]/.test(src) || src.indexOf("<EADATA[") >= 0, "FB_UserAccess musi rozlisovat obalku bez datasetu od prazdneho retezce");
    ok(src.indexOf("groups = [];") >= 0, "obalka bez datasetu -> prazdne clenstvi");
});
t("N2 E_SQL: vyjimka ze SQLQuery -> E_SQL s textem vyjimky", function () {
    var r = B.FB_OpQuery.call(B, supRepo(function () { throw new Error("mock: SQLQuery vyhodil"); }), { sql: "SELECT 1" });
    eq(r.code, "E_SQL"); contains(r.message, "SQLQuery vyhodil");
});
t("N2 legitimni prazdny SELECT: <Dataset_0> s prazdnym <Data/> = ok / rowCount 0 (ne E_SQL)", function () {
    var r = B.FB_OpQuery.call(B, supRepo(function () { return '<?xml version="1.0"?><EADATA version="1.0" exporter="Enterprise Architect"><Dataset_0><Data/></Dataset_0></EADATA>'; }), { sql: "SELECT Name FROM t_object WHERE 1=0" });
    eq(r.status, "ok"); eq(r.rowCount, 0); eq(r.rows.length, 0);
    var rB = B.FB_OpQuery.call(B, mkRepo(), { sql: "SELECT Name FROM t_object WHERE 1=0" });
    eq(rB.status, "ok", "mock xmlRows([]) = legitimni nula"); eq(rB.rowCount, 0);
});
t("N2 normalni dotaz: n radku = ok / rowCount n; hodnota 'error' v datech NENI chyba", function () {
    var repo = mkRepo({ sqlRules: [{ re: /t_object/, rows: [{ Name: "ErrorHandler" }, { Name: "Open FAILED test" }] }] });
    var r = B.FB_OpQuery.call(B, repo, { sql: "SELECT Name FROM t_object" });
    eq(r.status, "ok"); eq(r.rowCount, 2); eq(r.rows[0].Name, "ErrorHandler");
});
t("N2 SuppressEADialogs: true behem SQLQuery, po dotazu vracena puvodni hodnota (i pri chybe)", function () {
    var repo = supRepo(function () { return xmlRows([{ x: 1 }]); });
    B.FB_OpQuery.call(B, repo, { sql: "SELECT 1 AS x" });
    eq(repo._supDuringQuery, true, "behem dotazu musi byt SuppressEADialogs = true");
    eq(repo.SuppressEADialogs, false, "po dotazu puvodni hodnota");
    eq(repo._supLog.join(","), "true,false");
    var repoE = supRepo(function () { throw new Error("x"); });
    B.FB_OpQuery.call(B, repoE, { sql: "SELECT 1" });
    eq(repoE.SuppressEADialogs, false, "finally vraci hodnotu i po vyjimce");
});
t("N2 SuppressEADialogs chybi v runtime (prirazeni hazi) -> dotaz jede dal bez ni", function () {
    var repo = mkRepo({ sqlRules: [{ re: /./, rows: [{ x: 1 }] }] });
    Object.defineProperty(repo, "SuppressEADialogs", {
        get: function () { throw new Error("mock: property neexistuje"); },
        set: function () { throw new Error("mock: property neexistuje"); }
    });
    var r = B.FB_OpQuery.call(B, repo, { sql: "SELECT 1 AS x" });
    eq(r.status, "ok"); eq(r.rowCount, 1);
});
t("N2 E_SQL pres FB_Main: davka konci error, results[0].code = E_SQL", function () {
    var repo = supRepo(function () { return "SQL API Open FAILED: no such column: Type"; });
    var out = B.FB_Main.call(B, repo, JSON.stringify({ protocol: "eafb/0.2", id: "n2-main",
        ops: [{ op: "query", sql: "SELECT Type FROM t_objectconstraint LIMIT 1" }] }));
    var resp = JSON.parse(out);
    eq(resp.status, "error"); eq(resp.results[0].code, "E_SQL");
});
t("SuppressEADialogs: pravidlo - vyskyt jen ve FB_OpQuery (jinde SQLQuery bez obalu = vedome, interni dotazy)", function () {
    var where = [];
    L.files.forEach(function (f) {
        if (/SuppressEADialogs/.test(fs.readFileSync(path.join(SRC, f), "utf8"))) { where.push(f); }
    });
    eq(where.join(","), "AICodeBridge.FB_OpQuery.js");
});

// N4: odsazeny res (FB_JsonStringify indent), obsahove beze zmeny
t("N4 FB_JsonStringify(v, 1): odradkovani + 1 mezera na uroven, bez mezery za dvojteckou, prazdne [] a {}", function () {
    var v = { a: 1, b: [1, "x"], c: {}, d: [], e: { f: null, g: true } };
    var s = B.FB_JsonStringify.call(B, v, 1);
    eq(s, '{\n "a":1,\n "b":[\n  1,\n  "x"\n ],\n "c":{},\n "d":[],\n "e":{\n  "f":null,\n  "g":true\n }\n}');
});
t("N4 FB_JsonStringify: indent 0 / nevyplneno = dosavadni kompaktni tvar; parse obou tvaru = stejny objekt", function () {
    var v = { a: "x\ny", b: [1, { c: "\"q\"" }], d: 2.5 };
    var compact = B.FB_JsonStringify.call(B, v);
    eq(compact, B.FB_JsonStringify.call(B, v, 0));
    ok(compact.indexOf("\n") < 0, "kompaktni tvar bez odradkovani");
    eq(JSON.stringify(JSON.parse(compact)), JSON.stringify(JSON.parse(B.FB_JsonStringify.call(B, v, 1))));
    eq(JSON.stringify(JSON.parse(B.FB_JsonStringify.call(B, v, 2))), JSON.stringify(v));
});
t("N4 FB_Main: res je odsazeny, parsovatelny FB_JsonParse i JSON.parse, textove kotvy pumpy ('\"status\":\"…\"') zustavaji", function () {
    var repo = mkRepo();
    var out = B.FB_Main.call(B, repo, JSON.stringify({ protocol: "eafb/0.2", id: "n4-main",
        ops: [{ op: "ping", echo: "n4" }] }));
    ok(out.indexOf("\n") > 0, "res musi byt odsazeny (viceradkovy)");
    ok(/^\{\n "protocol":"eafb\/0\.2",\n "id":"n4-main"/.test(out), "1 mezera na uroven, bez mezery za dvojteckou: " + out.substring(0, 60));
    var a = JSON.parse(out);
    var b = B.FB_JsonParse.call(B, out);
    eq(JSON.stringify(a), JSON.stringify(b), "FB_JsonParse musi dat totez co JSON.parse");
    eq(a.status, "done");
    ok(out.indexOf("\"status\":\"done\"") >= 0, "kotva '\"status\":\"done\"' bez mezery (pumpa/FB_ConfirmPending hledaji doslovne)");
    var outE = B.FB_Main.call(B, repo, "{nevalidni json");
    ok(outE.indexOf("\"code\":\"E_PARSE\"") >= 0, "kotva '\"code\":\"E_PARSE\"' musi v odsazenem res prezit");
});

// ===========================================================================
// BASELINE POLITIKA (zadani v1.2) - cast 1: session token, konfigurace,
// rezervace prefixu (Z260907-1)
// ===========================================================================
function blReset() { memFs.files = {}; memFs.folders = {}; delete B._fbSessionTokMem; }
function withPolicy(polFn, fn) {
    var orig = B.FB_RiskPolicy;
    B.FB_RiskPolicy = polFn;
    try { return fn(); } finally { B.FB_RiskPolicy = orig; }
}
function polBase(baselineSec) {
    // politika s uplnou mapou classes (prevzata z ostre) + volitelna sekce baseline
    var real = B.FB_RiskPolicy.call(B)[0];
    return function () {
        var p = { repo: "EAEXAMPLE.QEA", classes: real.classes, elevate: real.elevate, block: real.block,
                  budgetMs: 8000, hashMaxChars: 2000000 };
        if (typeof baselineSec != "undefined") { p.baseline = baselineSec; }
        return [p];
    };
}
var T0 = new Date(2026, 8, 7, 10, 50, 15).getTime(); // 2026-09-07 10:50:15 lokalne
function sessFile() {
    for (var k in memFs.files) { if (/state-session\.txt$/.test(k)) { return memFs.files[k]; } }
    return null;
}
t("BL-1 token: prvni volani zalozi s<RRRRMMDD>-1, zapise soubor, fresh", function () {
    blReset();
    var r = B.FB_SessionToken.call(B, mkRepo(), null, T0);
    eq(r.token, "s20260907-1"); eq(r.fresh, true); eq(r.persisted, true);
    eq(r.created, "2026-09-07 10:50:15");
    eq(sessFile(), "s20260907-1|2026-09-07 10:50:15", "format souboru");
});
t("BL-1 token: druhe volani v okne = tentyz token, fresh false", function () {
    blReset();
    var repo = mkRepo();
    B.FB_SessionToken.call(B, repo, null, T0);
    var r = B.FB_SessionToken.call(B, repo, null, T0 + 11 * 3600000);
    eq(r.token, "s20260907-1"); eq(r.fresh, false);
});
t("BL-1 token: expirace dle sessionMaxHours (12 h) -> novy token, poradi v dni +1", function () {
    blReset();
    var repo = mkRepo();
    B.FB_SessionToken.call(B, repo, null, T0);
    var r = B.FB_SessionToken.call(B, repo, null, T0 + 12 * 3600000 + 1000);
    eq(r.fresh, true); eq(r.token, "s20260907-2", "tyz den -> n+1");
    var r2 = B.FB_SessionToken.call(B, repo, null, T0 + 40 * 3600000);
    eq(r2.token, "s20260909-1", "jiny den -> n od 1");
});
t("BL-1 token: sessionMaxHours z cfg (1 h)", function () {
    blReset();
    var repo = mkRepo();
    B.FB_SessionToken.call(B, repo, { sessionMaxHours: 1 }, T0);
    eq(B.FB_SessionToken.call(B, repo, { sessionMaxHours: 1 }, T0 + 59 * 60000).fresh, false);
    eq(B.FB_SessionToken.call(B, repo, { sessionMaxHours: 1 }, T0 + 61 * 60000).fresh, true);
});
t("BL-1 token: necitelny obsah souboru / cas v budoucnosti -> novy token", function () {
    blReset();
    var repo = mkRepo();
    B.FB_StateFile.call(B, repo, "session", "nesmysl");
    eq(B.FB_SessionToken.call(B, repo, null, T0).fresh, true);
    B.FB_StateFile.call(B, repo, "session", "s20260907-5|2026-09-07 23:00:00");
    var r = B.FB_SessionToken.call(B, repo, null, T0);
    eq(r.fresh, true, "cas v budoucnosti je neduveryhodny"); eq(r.token, "s20260907-6");
});
t("BL-1 token: best-effort - selhani zapisu neshodi volani a druhe volani neni znovu fresh", function () {
    blReset();
    var orig = B.FB_StateFile;
    B.FB_StateFile = function (R, name, value) { if (typeof value == "undefined") { return ""; } return "" + value; }; // zapis se "ztrati"
    try {
        var r1 = B.FB_SessionToken.call(B, mkRepo(), null, T0);
        eq(r1.fresh, true); eq(r1.persisted, false);
        var r2 = B.FB_SessionToken.call(B, mkRepo(), null, T0 + 60000);
        eq(r2.fresh, false, "pametovy fallback"); eq(r2.token, r1.token);
        B.FB_StateFile = function () { throw new Error("disk"); };
        delete B._fbSessionTokMem;
        ok(B.FB_SessionToken.call(B, mkRepo(), null, T0).token.length > 0, "vyjimka FB_StateFile nesmi probublat");
    } finally { B.FB_StateFile = orig; blReset(); }
});
t("BL-1 FB_Process: dve vyvolani za sebou = 1x FB_SessionStart; po expiraci tokenu 2x", function () {
    blReset();
    var calls = 0, origS = B.FB_SessionStart;
    B.FB_SessionStart = function () { calls++; return ""; };
    try {
        var repo = mkRepo();
        B.FB_Process.call(B, repo, "ping|a", null);
        B.FB_Process.call(B, repo, "ping|b", null);
        eq(calls, 1, "session start jen pri fresh tokenu");
        // expirace: prepis souboru na 13 h stary token
        var old = new Date(new Date().getTime() - 13 * 3600000);
        function p2(x) { return (x < 10 ? "0" : "") + x; }
        B.FB_StateFile.call(B, repo, "session", "s20200101-1|" + old.getFullYear() + "-" + p2(old.getMonth() + 1) + "-" + p2(old.getDate())
            + " " + p2(old.getHours()) + ":" + p2(old.getMinutes()) + ":" + p2(old.getSeconds()));
        B.FB_Process.call(B, repo, "ping|c", null);
        eq(calls, 2, "po expiraci nova session");
    } finally { B.FB_SessionStart = origS; blReset(); }
});
t("BL-1 FB_Process: vyjimka FB_SessionStart / FB_SessionToken neshodi prikaz", function () {
    blReset();
    var origS = B.FB_SessionStart, origT = B.FB_SessionToken;
    B.FB_SessionStart = function () { throw new Error("baseline api"); };
    try {
        eq(B.FB_Process.call(B, mkRepo(), "ping|x", null), "T");
        B.FB_SessionToken = function () { throw new Error("token"); };
        eq(B.FB_Process.call(B, mkRepo(), "ping|y", null), "T");
    } finally { B.FB_SessionStart = origS; B.FB_SessionToken = origT; blReset(); }
});
t("BL-1 zdroj: _fbSessionStarted uz v src neni", function () {
    L.files.forEach(function (f) {
        ok(fs.readFileSync(path.join(SRC, f), "utf8").indexOf("_fbSessionStarted") < 0, f);
    });
});
t("BL-1 config: chybejici sekce = validni + warning + bezpecne defaulty presne dle par. 5", function () {
    var c = withPolicy(polBase(), function () { return B.FB_BaselineConfig.call(B, mkRepo()); });
    eq(c.valid, true); eq(c.present, false); eq(c.warnings.length, 1);
    eq(JSON.stringify(c.cfg), JSON.stringify({ subtreeMax: 5000, maxBaselineElements: 10000, maxBaselinePackages: 5,
        probeBudgetMs: 500, probeBudgetTotalMs: 2000, useCte: false, thresholdsShadow: true, freshWithinMin: 15, sessionMaxHours: 12,
        requireRecoveryForUpdates: false, sessionBaseline: "off", autoPrefix: "FB-AUTO ", cleanupEveryHours: 24,
        cleanup: { mode: "report", keepLastK: 3, maxAgeDays: 14, maxDeletesPerRun: 20, maxDeletesAnomaly: 200, requireWriteGroup: true } }));
});
t("BL-1 config: repo bez polozky politiky = chybejici sekce (validni, warning)", function () {
    var c = B.FB_BaselineConfig.call(B, mkRepo({ connectionString: "C:\\X\\JINY.QEA" }));
    eq(c.valid, true); eq(c.present, false); eq(c.cfg.sessionBaseline, "off");
});
t("BL-1 config: ostra dev politika ma sekci, validni, sessionBaseline auto, mode report", function () {
    var c = B.FB_BaselineConfig.call(B, mkRepo());
    eq(c.valid, true, c.why); eq(c.present, true); eq(c.warnings.length, 0);
    eq(c.cfg.sessionBaseline, "auto"); eq(c.cfg.cleanup.mode, "report"); eq(c.cfg.requireRecoveryForUpdates, false);
});
t("BL-1 config: castecna sekce se doplni defaulty", function () {
    var c = withPolicy(polBase({ freshWithinMin: 5 }), function () { return B.FB_BaselineConfig.call(B, mkRepo()); });
    eq(c.valid, true, c.why); eq(c.cfg.freshWithinMin, 5); eq(c.cfg.maxBaselinePackages, 5); eq(c.cfg.cleanup.keepLastK, 3);
});
[
    ["keepLastK bez maxAgeDays", { cleanup: { keepLastK: 3 } }],
    ["mode delete bez keepLastK", { cleanup: { mode: "delete" } }],
    ["maxDeletesAnomaly < maxDeletesPerRun", { cleanup: { maxDeletesPerRun: 50, maxDeletesAnomaly: 10 } }],
    ["maxDeletesAnomaly < default maxDeletesPerRun", { cleanup: { maxDeletesAnomaly: 10 } }],
    ["neciselna hodnota", { subtreeMax: "5000" }],
    ["sessionBaseline mimo vycet", { sessionBaseline: "on" }],
    ["autoPrefix bez koncove mezery", { autoPrefix: "FB-AUTO" }],
    ["cleanup neni objekt", { cleanup: "report" }]
].forEach(function (c) {
    t("BL-1 config: nekonzistentni sekce (" + c[0] + ") = NEVALIDNI + defaulty", function () {
        var r = withPolicy(polBase(c[1]), function () { return B.FB_BaselineConfig.call(B, mkRepo()); });
        eq(r.valid, false); eq(r.present, true); ok(r.why.length > 0);
        eq(r.cfg.cleanup.mode, "report", "vadne hodnoty se nepouziji"); eq(r.cfg.autoPrefix, "FB-AUTO ");
    });
});
var REG_BL = { "create_baseline": { w: true }, "create_or_update_elements": { w: true } };
function regFull() {
    var mainSrc = fs.readFileSync(path.join(SRC, "AICodeBridge.FB_Main.js"), "utf8");
    var regM = /var REG = \{([\s\S]*?)\n\};/.exec(mainSrc);
    var reg = {}, rex = /"([a-z0-9_]+)":\s*\{\s*fn:\s*"[A-Za-z_]+",\s*w:\s*(true|false)/g, m1;
    while ((m1 = rex.exec(regM[1])) != null) { reg[m1[1]] = { w: m1[2] == "true" }; }
    return reg;
}
t("BL-1 gate T6-31: politika BEZ sekce baseline -> LOW davka zustane LOW", function () {
    var r = withPolicy(polBase(), function () {
        return B.FB_RiskGate.call(B, mkRepo(), { ops: [{ op: "create_baseline", "package": "{P}" }] }, regFull());
    });
    eq(r.riskLevel, "LOW", r.riskReasons.join("; ")); eq(r.baselinePolicyValid, true);
});
t("BL-1 gate T6-31: sekce pritomna a nekonzistentni -> ELEVATED, tridy/prahy plati dal", function () {
    var r = withPolicy(polBase({ cleanup: { mode: "delete" } }), function () {
        return B.FB_RiskGate.call(B, mkRepo(), { ops: [{ op: "create_baseline", "package": "{P}" }] }, regFull());
    });
    eq(r.riskLevel, "ELEVATED"); eq(r.baselinePolicyValid, false);
    eq(r.policyValid, true, "vadna baseline sekce nesmi vypnout vynucovani trid (BLOCKED)");
    contains(r.riskReasons.join("; "), "W14");
});
function blCreateRepo() {
    var repo = mkRepo();
    var created = [];
    repo._created = created;
    repo.GetProjectInterface = function () {
        return { GUIDtoXML: function (g) { return g; },
                 CreateBaseline: function (g, n) { created.push(n); return true; },
                 GetBaselines: function () { return ""; } };
    };
    return repo;
}
function callCreate(repo, name) {
    var oP = B.FB_ResolvePkg, oC = B.FB_CheckWrite;
    B.FB_ResolvePkg = function () { return { PackageGUID: "{P}", PackageID: 1, Name: "P" }; };
    B.FB_CheckWrite = function () { return null; };
    try { return B.FB_OpBaselineCreate.call(B, repo, { op: "create_baseline", "package": "{P}", name: name }, "r1"); }
    finally { B.FB_ResolvePkg = oP; B.FB_CheckWrite = oC; }
}
["FB-AUTO x", "fb-auto x", "  FB-AUTO jnovak s20260907-1 2026-09-07 10:00:00", "FB-AUTO"].forEach(function (nm) {
    t("BL-1 T6-30 create_baseline '" + nm + "' -> E_ARGS, zadna baseline", function () {
        var repo = blCreateRepo();
        var r = callCreate(repo, nm);
        eq(r.code, "E_ARGS"); contains(r.message, "vyhrazen executoru"); eq(repo._created.length, 0);
    });
});
["FB 2026-09-07 10:00:00", "AI-pre-S-r1", "Pred refaktorem", undefined].forEach(function (nm) {
    t("BL-1 create_baseline '" + nm + "' -> povoleno (mimo rezervovany prostor)", function () {
        var repo = blCreateRepo();
        var r = callCreate(repo, nm);
        eq(r.status, "ok", JSON.stringify(r)); eq(repo._created.length, 1);
    });
});
t("BL-1 T6-30 gate: pokus o rezervovane jmeno eskaluje LOW -> ELEVATED; bezne jmeno zustava LOW", function () {
    var bad = B.FB_RiskGate.call(B, mkRepo(), { ops: [{ op: "create_baseline", "package": "{P}", name: "fb-auto podvrh" }] }, regFull());
    eq(bad.riskLevel, "ELEVATED"); contains(bad.riskReasons.join("; "), "B4");
    var good = B.FB_RiskGate.call(B, mkRepo(), { ops: [{ op: "create_baseline", "package": "{P}", name: "AI-pre-x" }] }, regFull());
    eq(good.riskLevel, "LOW", good.riskReasons.join("; "));
});
t("BL-1 rezervace drzi i kdyz politika prefix zmeni (stary FB-AUTO porad rezervovan)", function () {
    withPolicy(polBase({ autoPrefix: "AUTOBL " }), function () {
        eq(B.FB_BaselineNameReserved.call(B, mkRepo(), "autobl x"), true);
        eq(B.FB_BaselineNameReserved.call(B, mkRepo(), "FB-AUTO x"), true);
        eq(B.FB_BaselineNameReserved.call(B, mkRepo(), "FB 2026"), false);
    });
});

// ===========================================================================
// BASELINE POLITIKA - cast 2: SCOPE + sonda + posture + baseline{} shadow
// (Z260907-2)
// ===========================================================================
var WL_GUID = "{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}";
function blModel() {
    // strom: 1 Model > 10 #FB-TEST (whitelist) > 11 A > 13 A1 ; 10 > 12 B ; 10 > 14..18 C..G
    var pk = [[1, 0, "Model", "{PK-1}"], [10, 1, "#FB-TEST", WL_GUID], [11, 10, "A", "{PK-11}"], [12, 10, "B", "{PK-12}"],
              [13, 11, "A1", "{PK-13}"], [14, 10, "C", "{PK-14}"], [15, 10, "D", "{PK-15}"], [16, 10, "E", "{PK-16}"],
              [17, 10, "F", "{PK-17}"], [18, 10, "G", "{PK-18}"], [19, 10, "Prazdny", "{PK-19}"]];
    var el = [[101, 11, "ElA", "{EL-101}"], [102, 12, "ElB", "{EL-102}"], [103, 13, "ElA1", "{EL-103}"], [104, 14, "ElC", "{EL-104}"],
              [105, 15, "ElD", "{EL-105}"], [106, 16, "ElE", "{EL-106}"], [107, 17, "ElF", "{EL-107}"], [108, 18, "ElG", "{EL-108}"],
              [109, 11, "Lifeline", "{EL-109}"], [110, 11, "Dvojnik", "{EL-110}"], [111, 12, "Dvojnik", "{EL-111}"]];
    var dg = [[201, 12, "SeqB", "{DG-201}"]];
    return { pk: pk, el: el, dg: dg, conn: [[301, 101, "{CN-301}"]], attr: [[401, 102]], oper: [[501, 103]] };
}
function blRepo(opts) {
    opts = opts || {};
    var M = blModel();
    var sqlLog = [];
    function pick(list, where, cols) {
        var out = [];
        list.forEach(function (r) { if (where(r)) { out.push(cols(r)); } });
        return out;
    }
    function inList(sql, col) {
        var m = new RegExp(col + " IN \\(([0-9, ]+)\\)", "i").exec(sql);
        return m ? m[1].split(",").map(function (x) { return parseInt(x, 10); }) : [];
    }
    function key(sql) {
        var m;
        if ((m = /ea_guid = '([^']+)'/i.exec(sql))) { return { guid: m[1] }; }
        if ((m = /(?:Object_ID|Package_ID|Diagram_ID|Connector_ID|OperationID|\bID) = (\d+)/i.exec(sql))) { return { id: parseInt(m[1], 10) }; }
        if ((m = /Name = '([^']+)'/i.exec(sql))) { return { name: m[1] }; }
        return {};
    }
    function match(k, id, guid, name) { return (k.guid && k.guid == guid) || (k.id && k.id == id) || (k.name && k.name == name); }
    var rules = [
        { re: /#AI-LOG/i, rows: [] },
        { re: /JavascriptAddin/i, rows: [] },
        { re: /COUNT\(\*\) AS c FROM t_object/i, rows: function (sql) {
            sqlLog.push(sql);
            if (opts.countFails) { return []; }
            var ids = inList(sql, "Package_ID");
            var n = M.el.filter(function (e) { return ids.indexOf(e[1]) >= 0; }).length;
            return [{ c: (opts.countZero ? 0 : n * (opts.mult || 1)) }];
        } },
        { re: /^WITH/i, rows: function (sql) { sqlLog.push(sql); return [{ packages: 3, elements: 42 }]; } },
        { re: /FROM t_package WHERE Parent_ID IN/i, rows: function (sql) {
            sqlLog.push(sql);
            if (opts.expandFails) { return []; }
            var ids = inList(sql, "Parent_ID");
            var root = parseInt(/OR Package_ID = (\d+)/i.exec(sql)[1], 10);
            return pick(M.pk, function (p) { return ids.indexOf(p[1]) >= 0 || p[0] == root; },
                function (p) { return { Package_ID: p[0], Parent_ID: p[1] }; });
        } },
        { re: /FROM t_object WHERE/i, rows: function (sql) { var k = key(sql);
            return pick(M.el, function (e) { return match(k, e[0], e[3], e[2]); },
                function (e) { return { Object_ID: e[0], ea_guid: e[3], Package_ID: e[1], Object_Type: "Class", Name: e[2] }; }); } },
        { re: /FROM t_package WHERE/i, rows: function (sql) { var k = key(sql);
            return pick(M.pk, function (p) { return match(k, p[0], p[3], p[2]); },
                function (p) { return { Package_ID: p[0], ea_guid: p[3], Parent_ID: p[1], Name: p[2] }; }); } },
        { re: /FROM t_diagram WHERE/i, rows: function (sql) { var k = key(sql);
            return pick(M.dg, function (d) { return match(k, d[0], d[3], d[2]); },
                function (d) { return { Diagram_ID: d[0], ea_guid: d[3], Package_ID: d[1], Name: d[2] }; }); } },
        { re: /FROM t_connector WHERE/i, rows: function (sql) { var k = key(sql);
            return pick(M.conn, function (c) { return match(k, c[0], c[2], null); }, function (c) { return { Start_Object_ID: c[1] }; }); } },
        { re: /FROM t_attribute WHERE/i, rows: function (sql) { var k = key(sql);
            return pick(M.attr, function (a) { return k.id == a[0]; }, function (a) { return { Object_ID: a[1] }; }); } },
        { re: /FROM t_operation WHERE/i, rows: function (sql) { var k = key(sql);
            return pick(M.oper, function (a) { return k.id == a[0]; }, function (a) { return { Object_ID: a[1] }; }); } }
    ];
    var BLS = {}; // pkgGuid -> [{ guid, version, docDate }]
    function isoNow(ms) { var d = new Date(ms); function p(x) { return (x < 10 ? "0" : "") + x; }
        return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()); }
    rules.unshift({ re: /FROM t_document/i, rows: function (sql) {
        sqlLog.push(sql);
        var out = [], g = /ElementID = '([^']+)'/i.exec(sql);
        for (var pg in BLS) {
            if (g && g[1] != pg) { continue; }
            BLS[pg].forEach(function (b, ix) { out.push({ DocID: b.guid, ElementID: pg, Version: b.version, DocDate: b.docDate }); });
        }
        return out;
    } });
    var repo = mkRepo({ sqlRules: rules, repositoryType: opts.repositoryType, login: opts.login, securityEnabled: opts.securityEnabled });
    repo._baselines = BLS;
    repo._createCalls = 0; repo._deleteCalls = 0;
    repo._addBaseline = function (pkgGuid, version, ageMin) {
        if (!BLS[pkgGuid]) { BLS[pkgGuid] = []; }
        var b = { guid: mkGuid(), version: version, docDate: isoNow(new Date().getTime() - (ageMin || 0) * 60000) };
        BLS[pkgGuid].push(b); return b;
    };
    repo._countBaselines = function () { var n = 0; for (var pg in BLS) { n += BLS[pg].length; } return n; };
    repo.GetProjectInterface = function () {
        return {
            GUIDtoXML: function (g) { return g; },
            CreateBaseline: function (g, name) {
                repo._createCalls++;
                if (opts.createThrows) { throw new Error("mock: CreateBaseline COM chyba"); }
                if (opts.createFalse) { return false; }
                repo._addBaseline(g, name, 0); return true;
            },
            GetBaselines: function (g) {
                return "<EA.BaseLines>" + (BLS[g] || []).map(function (b) {
                    return '<Baseline name="x" version="' + b.version + '" notes="" guid="' + b.guid + '"/>'; }).join("") + "</EA.BaseLines>";
            },
            DeleteBaseline: function (bg) {
                repo._deleteCalls++;
                for (var pg in BLS) { for (var i = 0; i < BLS[pg].length; i++) { if (BLS[pg][i].guid == bg) { BLS[pg].splice(i, 1); return true; } } }
                return false;
            }
        };
    };
    M.pk.forEach(function (p) { repo._addPackage({ id: p[0], parentID: p[1], name: p[2], guid: p[3] }); });
    M.el.forEach(function (e) { repo._addElement({ id: e[0], packageID: e[1], name: e[2], guid: e[3] }); });
    repo._sqlLog = sqlLog;
    return repo;
}
function scopeOf(ops, cfgOver) {
    var cfg = B.FB_BaselineConfig.call(B, mkRepo()).cfg;
    for (var k in (cfgOver || {})) { cfg[k] = cfgOver[k]; }
    return B.FB_BaselinePolicy.call(B, blRepo(), { ops: ops }, null, cfg, regFull());
}
function ids(sc) { return sc.packages.map(function (p) { return p.id; }).sort(function (a, b) { return a - b; }).join(","); }

t("BL-2 T6-29 uplnost SCOPE: kazda w:true operace registru ma polozku a SCOPE nema polozku mimo registr", function () {
    var reg = regFull();
    var src = fs.readFileSync(path.join(SRC, "AICodeBridge.FB_BaselinePolicy.js"), "utf8");
    var blk = /var SCOPE = \{([\s\S]*?)\n\};/.exec(src);
    ok(blk, "blok SCOPE nalezen");
    var scope = {}, rex = /"([a-z0-9_]+)":\s*\{\s*scope:\s*"([A-Za-z]+)",\s*destr:\s*"(no|always|rebuild|params)"/g, m;
    while ((m = rex.exec(blk[1])) != null) { scope[m[1]] = m[2]; }
    var missing = [], extra = [], nW = 0;
    for (var op in reg) { if (reg[op].w) { nW++; if (!scope[op]) { missing.push(op); } } }
    for (var s in scope) { if (!reg[s] || !reg[s].w) { extra.push(s); } }
    ok(nW >= 27, "registr ma mit aspon 27 zapisovych operaci, nalezeno " + nW);
    eq(missing.join(","), "", "zapisove operace BEZ polozky SCOPE");
    eq(extra.join(","), "", "polozky SCOPE mimo registr / pro cteci operace");
});
t("BL-2 T6-29 runtime: zapisova operace bez polozky SCOPE = unknown + missingScope", function () {
    var reg = regFull(); reg["nova_zapisova_op"] = { w: true };
    var sc = B.FB_BaselinePolicy.call(B, blRepo(), { ops: [{ op: "nova_zapisova_op" }] }, null, null, reg);
    eq(sc.unknown, true); eq(sc.missingScope.join(","), "nova_zapisova_op");
});
// tabulka par. 4.2: [popis, ops, ocekavane packages, unknown, dalsi kontrola]
[
    ["create_element = cisty create", [{ op: "create_element", "package": "{PK-11}", name: "X" }], "", false],
    ["elements update -> Element.PackageID", [{ op: "create_or_update_elements", elements: [{ guid: "{EL-103}", name: "n" }] }], "13", false],
    ["elements cisty create -> nic", [{ op: "create_or_update_elements", elements: [{ name: "n", "package": "{PK-11}" }] }], "", false],
    ["elements matchByName -> cilovy package", [{ op: "create_or_update_elements", elements: [{ name: "n", matchByName: true, "package": "{PK-12}" }] }], "12", false],
    ["elements update jmenem, ktere neni jednoznacne -> unknown", [{ op: "create_or_update_elements", elements: [{ elementID: "Dvojnik" }] }], "", true],
    ["move_elements -> OBE packages + volumeUnknown", [{ op: "move_elements", "package": 12, elements: [101] }], "11,12", false, function (sc) { eq(sc.volumeUnknown, true); }],
    ["package update -> tyz package", [{ op: "create_or_update_package", guid: "{PK-13}", name: "n" }], "13", false],
    ["package create -> nic", [{ op: "create_or_update_package", parent: "{PK-11}", name: "n" }], "", false],
    ["package matchByName -> rodic", [{ op: "create_or_update_package", parent: "{PK-11}", name: "n", matchByName: true }], "11", false],
    ["connectors create -> nic", [{ op: "create_or_update_connectors", connectors: [{ source: 101, target: 102, type: "Association" }] }], "", false],
    ["connectors dedupKey -> package SOURCE", [{ op: "create_or_update_connectors", connectors: [{ source: 102, target: 101, dedupKey: "k" }] }], "12", false],
    ["connectors update dle guid -> unknown", [{ op: "create_or_update_connectors", connectors: [{ guid: "{CN-301}", name: "n" }] }], "", true],
    ["attributes -> package rodice", [{ op: "create_or_update_attributes", element: 102, attributes: [{ name: "a" }] }], "12", false],
    ["operations bez parameters -> package rodice, nedestruktivni", [{ op: "create_or_update_operations", element: 103, operations: [{ name: "o" }] }], "13", false, function (sc) { eq(sc.destructive, false); }],
    ["operations s parameters -> destruktivni podtrida", [{ op: "create_or_update_operations", element: 103, operations: [{ name: "o", parameters: [{ name: "p" }] }] }], "13", false, function (sc) { eq(sc.destructive, true); }],
    ["T6-33 messages rebuild -> package DIAGRAMU (ne lifeliny), destruktivni", [{ op: "create_or_update_messages", diagram: 201, rebuild: true, messages: [{ source: 109, target: 101, name: "m", seqNo: 1 }] }], "12", false, function (sc) { eq(sc.destructive, true); }],
    ["messages bez rebuild -> package diagramu, nedestruktivni", [{ op: "create_or_update_messages", diagram: "{DG-201}", messages: [{ source: 109, target: 101, name: "m" }] }], "12", false, function (sc) { eq(sc.destructive, false); }],
    ["delete element -> vlastnici package", [{ op: "delete_from_model", targets: [{ type: "Element", id: 104 }] }], "14", false, function (sc) { eq(sc.destructive, true); }],
    ["T6-12 delete package -> RODIC", [{ op: "delete_from_model", targets: [{ type: "Package", guid: "{PK-13}" }] }], "11", false],
    ["T6-28 delete korenove whitelist package -> package sam + parentOutOfWhitelist", [{ op: "delete_from_model", targets: [{ type: "Package", guid: WL_GUID }] }], "10", false, function (sc) { eq(sc.packages[0].parentOutOfWhitelist, true); }],
    ["delete diagram -> package diagramu", [{ op: "delete_from_model", targets: [{ type: "Diagram", id: 201 }] }], "12", false],
    ["delete connector -> package source", [{ op: "delete_from_model", targets: [{ type: "Connector", id: 301 }] }], "11", false],
    ["delete attribute -> package rodice", [{ op: "delete_from_model", targets: [{ type: "Attribute", id: 401 }] }], "12", false],
    ["delete operation / parameter -> package rodice", [{ op: "delete_from_model", targets: [{ type: "Operation", id: 501 }, { type: "Parameter", id: 501, name: "p" }] }], "13", false],
    ["delete attribute s neexistujicim rodicem -> unknown", [{ op: "delete_from_model", targets: [{ type: "Attribute", id: 999 }] }], "", true],
    ["deleteTag element -> package vlastnika", [{ op: "delete_taggedvalue_from_model", targets: [{ type: "ElementTaggedValue", id: 105, name: "t" }] }], "15", false, function (sc) { eq(sc.destructive, true); }],
    ["deleteTag connector -> package source", [{ op: "delete_taggedvalue_from_model", targets: [{ type: "ConnectorTaggedValue", guid: "{CN-301}", name: "t" }] }], "11", false],
    ["deleteTag nezname vlastnictvi -> unknown", [{ op: "delete_taggedvalue_from_model", targets: [{ type: "OperationTaggedValue", id: 999, name: "t" }] }], "", true],
    ["remove_elements_from_diagram -> package diagramu", [{ op: "remove_elements_from_diagram", diagram: 201, elementIDs: [101] }], "12", false],
    ["create_baseline -> nic", [{ op: "create_baseline", "package": "{PK-11}" }], "", false],
    ["clone_package -> rodic zdroje + volumeUnknown", [{ op: "clone_package", "package": "{PK-13}" }], "11", false, function (sc) { eq(sc.volumeUnknown, true); }],
    ["clone_elements s cilem -> cilovy package", [{ op: "clone_elements", "package": "{PK-12}", elements: [101] }], "12", false, function (sc) { eq(sc.volumeUnknown, true); }],
    ["clone_elements bez cile -> package zdroje", [{ op: "clone_elements", elements: [103] }], "13", false],
    ["import docs -> package elementu, destruktivni", [{ op: "import_element_linked_documents", documents: [{ element: 106, path: "x" }] }], "16", false, function (sc) { eq(sc.destructive, true); }],
    ["layout_connectors -> package diagramu", [{ op: "layout_connectors", diagram: 201 }], "12", false],
    ["change_connector_visibility -> package diagramu", [{ op: "change_connector_visibility", diagram: 201, connectorIDs: [301] }], "12", false],
    ["update_diagram_properties -> package diagramu", [{ op: "update_diagram_properties", diagrams: [{ diagram: 201, name: "n" }] }], "12", false],
    ["set_diagram_object_style -> package diagramu", [{ op: "set_diagram_object_style", diagram: 201, objects: [] }], "12", false],
    ["create_or_update_diagram update -> package diagramu; create -> nic", [{ op: "create_or_update_diagram", diagrams: [{ diagram: 201, name: "n" }, { name: "novy", "package": "{PK-14}" }] }], "12", false],
    ["place_elements_on_diagram -> package diagramu", [{ op: "place_elements_on_diagram", diagram: 201, elementPlacements: [{ element: 101 }] }], "12", false],
    ["scenarios / constraints / requirements -> package rodice, destruktivni (V2d rebuild)", [{ op: "create_or_update_scenarios", element: 101, scenarios: [] }, { op: "create_or_update_constraints", element: 102, constraints: [] }, { op: "create_or_update_requirements", element: 104, requirements: [] }], "11,12,14", false, function (sc) { eq(sc.destructive, true); eq(sc.destructiveOps.length, 3); }],
    ["apply_classifier_stereotypes -> package diagramu", [{ op: "apply_classifier_stereotypes", diagram: 201 }], "12", false],
    ["find_or_create_referencing_sr -> create", [{ op: "find_or_create_referencing_sr", targetPackage: "{PK-11}", name: "SR" }], "", false],
    ["deploy_src -> none", [{ op: "deploy_src", files: [] }], "", false],
    ["T6-27 $N na vysledek CTECI operace -> unknown", [{ op: "find_elements_by_name", name: "x" }, { op: "create_or_update_attributes", element: "$0", attributes: [{ name: "a" }] }], "", true],
    ["$N na CREATE vetev teto davky -> vlastni prvek, nic", [{ op: "create_or_update_elements", elements: [{ name: "n", "package": "{PK-11}" }] }, { op: "create_or_update_attributes", element: "$0", attributes: [{ name: "a" }] }], "", false],
    ["$N na UPDATE vetev -> unknown", [{ op: "create_or_update_elements", elements: [{ guid: "{EL-101}", name: "n" }] }, { op: "create_or_update_attributes", element: "$0", attributes: [{ name: "a" }] }], "11", true],
    ["cteci operace se ignoruji", [{ op: "ping" }, { op: "query", sql: "SELECT 1" }], "", false]
].forEach(function (c) {
    t("BL-2 SCOPE: " + c[0], function () {
        var sc = scopeOf(c[1]);
        eq(ids(sc), c[2], "packages (" + sc.unknownWhy.join("; ") + ")");
        eq(sc.unknown, c[3], "unknown: " + sc.unknownWhy.join("; "));
        if (c[4]) { c[4](sc); }
    });
});
t("BL-2 T6-7: cile ve 3 sourozeneckych packages -> 3 packages, zadny spolecny predek", function () {
    var sc = scopeOf([{ op: "create_or_update_elements", elements: [{ elementID: 104 }, { elementID: 105 }, { elementID: 106 }] }]);
    eq(ids(sc), "14,15,16"); eq(sc.overLimit, false);
});
t("BL-2 T6-8: potomek + predek -> 1 package (predek); hluboky potomek take", function () {
    var sc = scopeOf([{ op: "create_or_update_elements", elements: [{ elementID: 103 }, { elementID: 101 }] }]);
    eq(ids(sc), "11");
    var sc2 = scopeOf([{ op: "create_or_update_elements", elements: [{ elementID: 103 }] }, { op: "create_or_update_package", guid: WL_GUID, name: "n" }]);
    eq(ids(sc2), "10", "A1 je vnuk #FB-TEST");
});
t("BL-2 T6-9: 7 packages > maxBaselinePackages -> overLimit, nikdy spolecny predek", function () {
    var sc = scopeOf([{ op: "create_or_update_elements", elements: [{ elementID: 101 }, { elementID: 102 }, { elementID: 104 }, { elementID: 105 }, { elementID: 106 }, { elementID: 107 }, { elementID: 108 }] }]);
    eq(sc.packages.length, 7); eq(sc.overLimit, true);
    ok(ids(sc).split(",").indexOf("10") < 0, "spolecny predek #FB-TEST nesmi byt v mnozine");
});
t("BL-2 sonda: iterativni expanze po urovnich -> spravny IN seznam a soucet", function () {
    var repo = blRepo();
    var r = B.FB_SubtreeCount.call(B, repo, 11, { probeBudgetMs: 500 }, 2000);
    eq(r.status, "ok", r.why); eq(r.packages, 2, "11 + 13"); eq(r.elements, 4, "101,109,110 v 11 + 103 v 13"); eq(r.method, "iter");
    var cnt = repo._sqlLog.filter(function (s) { return /COUNT/.test(s); });
    eq(cnt.length, 1); contains(cnt[0], "IN (11,13)");
    ok(!repo._sqlLog.some(function (s) { return /^WITH/i.test(s); }), "bez useCte zadny WITH");
});
t("BL-2 sonda B6: soucet 0 nad existujici package = unknown (nikdy pod prahem)", function () {
    eq(B.FB_SubtreeCount.call(B, blRepo(), 19, { probeBudgetMs: 500 }, 2000).status, "unknown");
    eq(B.FB_SubtreeCount.call(B, blRepo({ countZero: true }), 11, { probeBudgetMs: 500 }, 2000).status, "unknown");
});
t("BL-2 sonda: selhani dotazu (zadny radek ani pro koren / COUNT bez radku) = unknown", function () {
    var a = B.FB_SubtreeCount.call(B, blRepo({ expandFails: true }), 11, { probeBudgetMs: 500 }, 2000);
    eq(a.status, "unknown"); contains(a.why, "koren");
    eq(B.FB_SubtreeCount.call(B, blRepo({ countFails: true }), 11, { probeBudgetMs: 500 }, 2000).status, "unknown");
    eq(B.FB_SubtreeCount.call(B, blRepo(), 999, { probeBudgetMs: 500 }, 2000).status, "unknown", "neexistujici package");
});
t("BL-2 T6-16 (harness): vycerpany rozpocet = unknown", function () {
    eq(B.FB_SubtreeCount.call(B, blRepo(), 11, { probeBudgetMs: 500 }, 0).status, "unknown", "celkovy strop vycerpan");
    var repo = blRepo();
    var origQ = repo.SQLQuery;
    repo.SQLQuery = function (sql) { var e = new Date().getTime() + 5; while (new Date().getTime() < e) { } return origQ(sql); };
    eq(B.FB_SubtreeCount.call(B, repo, 11, { probeBudgetMs: 1 }, 2000).status, "unknown", "probeBudgetMs 1");
});
t("BL-2 sonda useCte: SQLite -> WITH RECURSIVE, MS SQL -> WITH, JET -> iterativne", function () {
    var a = blRepo({ repositoryType: "SL3" });
    var ra = B.FB_SubtreeCount.call(B, a, 11, { probeBudgetMs: 500, useCte: true }, 2000);
    eq(ra.method, "cte"); eq(ra.elements, 42); ok(/^WITH RECURSIVE sub/.test(a._sqlLog[0]), a._sqlLog[0]);
    var b = blRepo({ repositoryType: "SQLSVR" });
    B.FB_SubtreeCount.call(B, b, 11, { probeBudgetMs: 500, useCte: true }, 2000);
    ok(/^WITH sub/.test(b._sqlLog[0]), b._sqlLog[0]);
    var c = blRepo({ repositoryType: "JET" });
    eq(B.FB_SubtreeCount.call(B, c, 11, { probeBudgetMs: 500, useCte: true }, 2000).method, "iter");
});
t("BL-2 zdroj: WITH RECURSIVE jen ve vetvi useCte FB_SubtreeCount", function () {
    L.files.forEach(function (f) {
        var code = fs.readFileSync(path.join(SRC, f), "utf8").split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join("\n");
        if (f != "AICodeBridge.FB_SubtreeCount.js") { ok(code.indexOf("WITH RECURSIVE") < 0, f); }
    });
});
t("BL-2 recoveryPosture: 4 zdroje unknown + overLimit none + shadow prahy", function () {
    var M = { metricsComplete: true }, S = { unknown: false, overLimit: false, packages: [] }, okP = [{ status: "ok", elements: 9000 }];
    eq(B.FB_RecoveryPosture.call(B, M, S, okP, { subtreeMax: 5000 }).posture, "full", "shadow: prah nerozhoduje");
    eq(B.FB_RecoveryPosture.call(B, M, S, okP, { subtreeMax: 5000, thresholdsShadow: false }).posture, "none", "po kalibraci rozhoduje");
    eq(B.FB_RecoveryPosture.call(B, { metricsComplete: false }, S, okP, {}).posture, "unknown", "(1) metriky");
    eq(B.FB_RecoveryPosture.call(B, null, S, okP, {}).posture, "unknown", "(1) metriky null");
    eq(B.FB_RecoveryPosture.call(B, M, S, [{ status: "unknown", why: "rozpocet" }], {}).posture, "unknown", "(2-4) sonda");
    eq(B.FB_RecoveryPosture.call(B, M, { unknown: true, unknownWhy: ["$N"], packages: [] }, [], {}).posture, "unknown", "(5) scope");
    eq(B.FB_RecoveryPosture.call(B, M, { unknown: false, overLimit: true, packages: [1, 2, 3, 4, 5, 6], maxBaselinePackages: 5 }, [], {}).posture, "none");
    eq(B.FB_RecoveryPosture.call(B, M, null, [], {}).posture, "unknown", "scope null");
});
// rezim cesty k souboru (kontrakt I5) v harnessu: binarni cteni mock neumi ->
// FB_FileBytes vraci null jako v EA runtime a FB_Main cte soubor textove
function asEaRuntime(fn) {
    var orig = B.FB_FileBytes;
    B.FB_FileBytes = function () { return null; };
    try { return fn(); } finally { B.FB_FileBytes = orig; }
}
function mainBl(ops, repoOpts) {
    blReset(); delete B._fbAccessCache; delete B._fbPrevExc;
    var repo = blRepo(repoOpts);
    var out = B.FB_Main.call(B, repo, JSON.stringify({ protocol: "eafb/0.2", id: "bl-" + (++guidSeq), repo: "EAEXAMPLE.QEA", ops: ops }));
    return { resp: JSON.parse(out), repo: repo };
}
t("BL-2 T6-1 FB_Main: cteci davka nema sekci baseline", function () {
    var r = mainBl([{ op: "ping", echo: "x" }]);
    eq(typeof r.resp.baseline, "undefined");
});
t("BL-2 T6-4 FB_Main: cisty create -> needsBaseline false, zadna sonda", function () {
    var r = mainBl([{ op: "create_or_update_elements", elements: [{ name: "Novy", type: "Class", "package": "{PK-11}" }] }]);
    eq(r.resp.baseline.needsBaseline, false); eq(r.resp.baseline.packages.length, 0);
    ok(!r.repo._sqlLog.some(function (s) { return /COUNT\(\*\) AS c FROM t_object/.test(s); }), "sonda se u cisteho create nepousti");
});
t("BL-2 FB_Main: ELEVATED davka ma sekci baseline uz v confirm_required (par. 4.6/2)", function () {
    blReset();
    var repo = blRepo();
    var p = "C:\\HARNESS\\EA-File-Bridge\\requests\\req-bl-conf.json";
    memFs.files[p] = JSON.stringify({ protocol: "eafb/0.2", id: "bl-conf", repo: "EAEXAMPLE.QEA",
        ops: [{ op: "delete_from_model", targets: [{ type: "Element", id: 104 }] }] });
    var resp = asEaRuntime(function () { return JSON.parse(B.FB_Main.call(B, repo, p)); });
    eq(resp.status, "confirm_required", JSON.stringify(resp).substring(0, 300));
    eq(resp.baseline.packages[0].guid, "{PK-14}");
});
t("BL-2 T6-31 FB_Main: politika bez sekce baseline -> warning v response nejvys 1x denne, davka LOW probehne", function () {
    withPolicy(polBase(), function () {
        blReset(); delete B._fbAccessCache;
        var repo = blRepo();
        function run(id) { return JSON.parse(B.FB_Main.call(B, repo, JSON.stringify({ protocol: "eafb/0.2", id: id, repo: "EAEXAMPLE.QEA",
            ops: [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": "{PK-11}" }] }] }))); }
        var a = run("bl-w1"), b = run("bl-w2");
        eq(a.risk.riskLevel, "LOW");
        ok(a.warnings && /sekci 'baseline'/.test(a.warnings.join(" ")), "prvni davka nese warning");
        ok(!b.warnings || !/sekci 'baseline'/.test(b.warnings.join(" ")), "druha davka tyz den uz ne");
    });
});

// ===========================================================================
// BASELINE POLITIKA - cast 3: lazy baseline, reuse, E_NO_BASELINE, navadena
// cesta, razitka, confirm dialog, FB_SessionStart (Z260907-3)
// ===========================================================================
var BL_BASE = "C:\\HARNESS\\EA-File-Bridge";
function autoNames(repo, pkgGuid) {
    return (repo._baselines[pkgGuid] || []).map(function (b) { return b.version; }).filter(function (v) { return /^FB-AUTO /.test(v); });
}
function runText(repo, ops, id) {
    delete B._fbAccessCache; delete B._fbPrevExc;
    return JSON.parse(B.FB_Main.call(B, repo, JSON.stringify({ protocol: "eafb/0.2", id: id || ("bl3-" + (++guidSeq)), repo: "EAEXAMPLE.QEA", ops: ops })));
}
// davka souborem (kontrakt I5) -> confirm okruh jde odehrat cely
function runFile(repo, ops, id) {
    delete B._fbAccessCache; delete B._fbPrevExc;
    var p = BL_BASE + "\\requests\\req-" + id + ".json";
    memFs.files[p] = JSON.stringify({ protocol: "eafb/0.2", id: id, repo: "EAEXAMPLE.QEA", ops: ops });
    var out = asEaRuntime(function () { return B.FB_Main.call(B, repo, p); });
    memFs.files[BL_BASE + "\\responses\\res-" + id + ".json"] = out;
    return JSON.parse(out);
}
function confirmFile(repo, first, id, approve) {
    var out = asEaRuntime(function () {
        return B.FB_ConfirmPending.call(B, repo, first.confirm.pendingPath, first.confirm.nonce, first.confirm.payloadHash, "okno", approve);
    });
    memFs.files[BL_BASE + "\\responses\\res-" + id + ".json"] = out;
    return JSON.parse(out);
}
var UPD_A1 = [{ op: "create_or_update_elements", elements: [{ guid: "{EL-103}", notes: "x" }] }];
var DEL_C = [{ op: "delete_from_model", targets: [{ type: "Element", id: 104 }] }];

t("BL-3 jmeno: format + parse celotvarem; legacy / AI-pre / rucni mimo mnozinu", function () {
    var ms = new Date(2026, 7, 21, 9, 14, 3).getTime();
    var n = B.FB_BaselineName.call(B, "format", "FB-AUTO ", "jnovak", "s20260821-1", ms, false);
    eq(n, "FB-AUTO jnovak s20260821-1 2026-08-21 09:14:03");
    var p = B.FB_BaselineName.call(B, "parse", n, "FB-AUTO ");
    eq(p.login, "jnovak"); eq(p.token, "s20260821-1"); eq(p.ms, ms); eq(p.session, false);
    var s = B.FB_BaselineName.call(B, "format", "FB-AUTO ", "", "s20260821-2", ms, true);
    eq(s, "FB-AUTO - s20260821-2 2026-08-21 09:14:03 (session)", "prazdny login -> '-'");
    eq(B.FB_BaselineName.call(B, "parse", s, "FB-AUTO ").session, true);
    eq(B.FB_BaselineName.call(B, "format", "FB-AUTO ", "DOM\\jan novak", "s20260821-1", ms, false).split(" ")[1], "DOM\\jan_novak");
    ["FB 2026-08-21 09:14:03", "AI-pre-S-r1", "Pred refaktorem", "FB-AUTO jnovak s20260821-1", "FB-AUTO jnovak s20260821-1 2026-08-21 09:14:03 navic",
     "xFB-AUTO jnovak s20260821-1 2026-08-21 09:14:03", "FB-AUTOjnovak s20260821-1 2026-08-21 09:14:03"].forEach(function (x) {
        eq(B.FB_BaselineName.call(B, "parse", x, "FB-AUTO "), null, x);
    });
});
t("BL-3 zdroj: regex jmena je definovan 1x (FB_BaselineName) a parser necte atribut date", function () {
    L.files.forEach(function (f) {
        var code = fs.readFileSync(path.join(SRC, f), "utf8").split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join("\n");
        if (f != "AICodeBridge.FB_BaselineName.js") { ok(!/s\\\\d\{8\}-\\\\d\+\) \(/.test(code), f + " ma vlastni kopii regexu jmena"); }
        if (/FB_(AutoBaseline|BaselineName|BaselineDecide|BaselineCleanup)\.js$/.test(f)) { ok(!/date="/.test(code) && !/"date"/.test(code), f + " cte atribut date"); }
    });
});
t("BL-3 T6-1: cteci davka -> zadna baseline, response bez sekce baseline", function () {
    blReset(); var repo = blRepo();
    var r = runText(repo, [{ op: "ping", echo: "x" }, { op: "get_selected_context" }]);
    eq(typeof r.baseline, "undefined"); eq(repo._createCalls, 0);
});
t("BL-3 T6-4: cisty create do existujici package -> zadna baseline, LOW, decision none / cisty create", function () {
    blReset(); var repo = blRepo();
    var r = runText(repo, [{ op: "create_or_update_elements", elements: [{ name: "Novy", type: "Class", "package": "{PK-11}" }] }]);
    eq(r.risk.riskLevel, "LOW"); eq(r.baseline.decision, "none"); eq(r.baseline.reason, "cisty create"); eq(repo._createCalls, 0);
    ok(!repo._sqlLog.some(function (s) { return /COUNT\(\*\) AS c FROM t_object/.test(s); }), "sonda se u cisteho create nepousti");
});
t("BL-3 T6-5: update pod prahem -> prave 1 baseline nad NEJBLIZSI vlastnici package, jmeno FB-AUTO <login> <token> <cas>", function () {
    blReset(); var repo = blRepo({ login: "jnovak" });
    var r = runText(repo, UPD_A1);
    eq(r.baseline.decision, "created", JSON.stringify(r.baseline)); eq(repo._countBaselines(), 1);
    var nm = autoNames(repo, "{PK-13}");
    eq(nm.length, 1, "baseline nad A1, ne nad vetvi");
    var p = B.FB_BaselineName.call(B, "parse", nm[0], "FB-AUTO ");
    ok(p != null, nm[0]); eq(p.login, "jnovak"); ok(/^s\d{8}-1$/.test(p.token));
    eq(r.baseline.packages[0].name, nm[0]); eq(r.baseline.created[0], nm[0]); eq(r.baseline.packages[0].subtreeCount, 1);
    ok(typeof r.baseline.elapsedMs == "number");
    ok(r.results.length == 1 && r.results[0].op == "create_or_update_elements", "auto-baseline neni operace v results");
});
t("BL-3 T6-6: tentyz update podruhe v teze session -> zadna dalsi baseline, reason reuse session", function () {
    blReset(); var repo = blRepo({ login: "jnovak" });
    runText(repo, UPD_A1);
    var r2 = runText(repo, UPD_A1);
    eq(r2.baseline.decision, "reused"); eq(r2.baseline.reason, "reuse session"); eq(repo._countBaselines(), 1);
});
t("BL-3 reuse LOW: baseline JINEHO uzivatele se stejnym tokenem se nepocita", function () {
    blReset(); var repo = blRepo({ login: "jnovak" });
    var tok = B.FB_SessionToken.call(B, repo, null).token;
    repo._addBaseline("{PK-13}", B.FB_BaselineName.call(B, "format", "FB-AUTO ", "kolega", tok, new Date().getTime() - 3600000, false), 60);
    var r = runText(repo, UPD_A1);
    eq(r.baseline.decision, "created"); eq(autoNames(repo, "{PK-13}").length, 2);
});
t("BL-3 T6-7 / T6-8: 3 sourozenci -> 3 baselines; potomek + predek -> 1 baseline nad predkem", function () {
    blReset(); var repo = blRepo();
    var r = runFile(repo, [{ op: "create_or_update_elements", elements: [{ elementID: 104, notes: "a" }, { elementID: 105, notes: "b" }, { elementID: 106, notes: "c" }] }], "t67");
    eq(r.status, "confirm_required", "affectedPackages 3 > 1 = ELEVATED"); eq(repo._createCalls, 0);
    var r2 = confirmFile(repo, r, "t67", true);
    eq(r2.baseline.decision, "created", JSON.stringify(r2).substring(0, 400)); eq(repo._countBaselines(), 3);
    eq(autoNames(repo, WL_GUID).length, 0, "nikdy baseline spolecneho predka");
    blReset(); var repo8 = blRepo();
    var r8 = runFile(repo8, [{ op: "create_or_update_elements", elements: [{ elementID: 103, notes: "a" }, { elementID: 101, notes: "b" }] }], "t68");
    var r8b = (r8.status == "confirm_required") ? confirmFile(repo8, r8, "t68", true) : r8;
    eq(repo8._countBaselines(), 1); eq(autoNames(repo8, "{PK-11}").length, 1);
});
t("BL-3 T6-9: 7 packages (nad maxBaselinePackages) -> 0 baselines, rezim bez package zalohy (navadena cesta), nikdy predek", function () {
    blReset(); var repo = blRepo();
    var ops = [{ op: "create_or_update_elements", elements: [101, 102, 104, 105, 106, 107, 108].map(function (i) { return { elementID: i, notes: "x" }; }) }];
    var polNB = polBase(B.FB_RiskPolicy.call(B)[0].baseline)(); polNB[0].block = { deleteTargets: 100, writeOps: 500, updatedExisting: 100, affectedPackages: 50 };
    var r = withPolicy(function () { return polNB; }, function () { return runFile(repo, ops, "t69"); });
    eq(r.status, "confirm_required", JSON.stringify(r).substring(0, 300)); eq(r.baseline.action, "guided");
    contains(r.baseline.reason, "maxBaselinePackages"); eq(repo._createCalls, 0);
});
t("BL-3 T6-10: update nad prahem (mimo destruktivni podtridu) -> confirm 'bez pre-image'; bez rucni baseline se po potvrzeni NEPROVEDE; s ni ano, 0 FB-AUTO, tag ai.baseline", function () {
    blReset(); var repo = blRepo({ mult: 9000 });
    var pol = polBase({ thresholdsShadow: false, subtreeMax: 5000 });
    withPolicy(pol, function () {
        var r = runFile(repo, UPD_A1, "t610");
        eq(r.status, "confirm_required"); eq(r.baseline.action, "guided"); contains(r.baseline.reason, "nad prahem");
        contains(r.risk.riskReasons.join("; "), "bez pre-image"); contains(r.risk.riskReasons.join("; "), "nutna rucni baseline nad Model.#FB-TEST.A.A1");
        var sum = "" + B.FB_ConfirmSummary.call(B, r);
        contains(sum, "BEZ AUTOMATICKE ZALOHY"); contains(sum, "Ctrl+Alt+B");
        var r2 = confirmFile(repo, r, "t610", true);
        eq(r2.status, "confirm_required", "bez rucni baseline se neprovede"); ok(r2.confirm.nonce != r.confirm.nonce, "novy nonce");
        ok(memFs.files[r2.confirm.pendingPath], "soubor zustava v pending");
        repo._addBaseline("{PK-11}", "Pred upravou A", 3); // rucni baseline nad PREDKEM cile, uvnitr whitelistu
        var r3 = confirmFile(repo, r2, "t610", true);
        eq(r3.status, "done", JSON.stringify(r3).substring(0, 500)); eq(r3.baseline.decision, "skipped");
        eq(r3.baseline.manual.ok, true); eq(autoNames(repo, "{PK-13}").length + autoNames(repo, "{PK-11}").length, 0, "0 FB-AUTO baselines");
    });
});
t("BL-3 navadena cesta: stara rucni baseline (mimo freshWithinMin) ani FB-AUTO/rezervovane jmeno nestaci", function () {
    blReset(); var repo = blRepo({ mult: 9000 });
    repo._addBaseline("{PK-13}", "Stara rucni", 120);
    repo._addBaseline("{PK-13}", "FB-AUTO kolega s20260101-1 2026-01-01 10:00:00", 1);
    repo._addBaseline("{PK-13}", "fb-auto podvrh", 1);
    withPolicy(polBase({ thresholdsShadow: false }), function () {
        var r = runFile(repo, UPD_A1, "t610b");
        eq(r.baseline.manual.ok, false);
    });
});
t("BL-3 T6-11: destruktivni podtrida nad prahem + requireRecoveryForUpdates -> E_NO_BASELINE, nic zapsano, audit, zadny confirm", function () {
    blReset(); var repo = blRepo({ mult: 9000 });
    var called = 0, oD = B.FB_OpDelete, oA = B.FB_Audit, audits = [];
    B.FB_OpDelete = function () { called++; return { op: "delete_from_model", status: "ok", items: [] }; };
    B.FB_Audit = function (R, id, summary) { audits.push(summary); return ""; };
    try {
        withPolicy(polBase({ thresholdsShadow: false, requireRecoveryForUpdates: true }), function () {
            var r = runFile(repo, DEL_C, "t611");
            eq(r.code, "E_NO_BASELINE", JSON.stringify(r).substring(0, 300)); eq(r.status, "error");
            eq(r.results[0].status, "skipped"); eq(called, 0); eq(repo._createCalls, 0);
            eq(audits.length, 1); contains(audits[0], "E_NO_BASELINE");
            ok(!r.confirm, "zadne confirm_required");
        });
    } finally { B.FB_OpDelete = oD; B.FB_Audit = oA; }
});
t("BL-3 T6-11b: dev (requireRecoveryForUpdates false) -> destruktivni nad prahem jde navadenou cestou, ne E_NO_BASELINE", function () {
    blReset(); var repo = blRepo({ mult: 9000 });
    withPolicy(polBase({ thresholdsShadow: false }), function () {
        var r = runFile(repo, DEL_C, "t611b");
        eq(r.status, "confirm_required"); eq(r.baseline.action, "guided");
    });
});
t("BL-3 T6-12: delete package X -> baseline nad RODICEM X (po potvrzeni)", function () {
    blReset(); var repo = blRepo();
    var oD = B.FB_OpDelete; B.FB_OpDelete = function () { return { op: "delete_from_model", status: "ok", items: [] }; };
    try {
        var r = runFile(repo, [{ op: "delete_from_model", targets: [{ type: "Package", guid: "{PK-13}" }] }], "t612");
        eq(r.status, "confirm_required"); eq(repo._createCalls, 0);
        var r2 = confirmFile(repo, r, "t612", true);
        eq(r2.status, "done", JSON.stringify(r2).substring(0, 300));
        eq(autoNames(repo, "{PK-11}").length, 1); eq(autoNames(repo, "{PK-13}").length, 0);
    } finally { B.FB_OpDelete = oD; }
});
t("BL-3 T6-13: ELEVATED davka ZAMITNUTA v dialogu -> 0 baselines", function () {
    blReset(); var repo = blRepo();
    var r = runFile(repo, DEL_C, "t613");
    eq(r.status, "confirm_required"); eq(r.baseline.decision, "planned");
    contains("" + B.FB_ConfirmSummary.call(B, r), "Zaloha pred zapisem: Model.#FB-TEST.C (1 prvku)");
    var r2 = confirmFile(repo, r, "t613", false);
    eq(r2.code, "E_RISK_REJECTED"); eq(repo._createCalls, 0); eq(repo._countBaselines(), 0);
});
t("BL-3 T6-14: ELEVATED potvrzena -> baseline az PO potvrzeni; v okne freshWithinMin reuse, mimo okno cerstva", function () {
    blReset(); var repo = blRepo({ login: "jnovak" });
    var oD = B.FB_OpDelete; B.FB_OpDelete = function () { return { op: "delete_from_model", status: "ok", items: [] }; };
    try {
        var tok = B.FB_SessionToken.call(B, repo, null).token;
        // FB-AUTO tehoz uzivatele a session, ale 40 min stara -> ELEVATED ji NEpouzije
        repo._addBaseline("{PK-14}", B.FB_BaselineName.call(B, "format", "FB-AUTO ", "jnovak", tok, new Date().getTime() - 40 * 60000, false), 40);
        var r = runFile(repo, DEL_C, "t614");
        eq(repo._createCalls, 0, "pred potvrzenim nic");
        var r2 = confirmFile(repo, r, "t614", true);
        eq(r2.baseline.decision, "created"); eq(autoNames(repo, "{PK-14}").length, 2);
        ok(typeof r2.baseline.elapsedMs == "number");
        // druha ELEVATED davka hned potom -> reuse freshWithinMin
        var r3 = runFile(repo, DEL_C, "t614b");
        var r4 = confirmFile(repo, r3, "t614b", true);
        eq(r4.baseline.decision, "reused"); eq(r4.baseline.reason, "reuse freshWithinMin"); eq(autoNames(repo, "{PK-14}").length, 2);
    } finally { B.FB_OpDelete = oD; }
});
t("BL-3 T6-15: CreateBaseline vraci false / hazi / FB_CheckWrite odmitne -> E_NO_BASELINE terminalne, bez confirm, nic zapsano", function () {
    [{ createFalse: true }, { createThrows: true }].forEach(function (o) {
        blReset(); var repo = blRepo(o);
        var r = runText(repo, UPD_A1);
        eq(r.code, "E_NO_BASELINE", JSON.stringify(o)); eq(r.status, "error"); eq(r.results[0].status, "skipped");
        ok(!r.confirm); eq(r.baseline.decision, "failed");
    });
    blReset(); var repo2 = blRepo();
    var oC = B.FB_CheckWrite; B.FB_CheckWrite = function () { return { code: "E_WHITELIST", message: "mimo whitelist" }; };
    try { var r2 = runText(repo2, UPD_A1); eq(r2.code, "E_NO_BASELINE"); contains(r2.message, "E_WHITELIST"); eq(repo2._createCalls, 0); }
    finally { B.FB_CheckWrite = oC; }
});
t("BL-3 T6-15b: potvrzena ELEVATED davka, zaloha selze -> E_NO_BASELINE, soubor do rejected (ne nove confirm)", function () {
    blReset(); var repo = blRepo({ createFalse: true });
    var r = runFile(repo, DEL_C, "t615");
    var r2 = confirmFile(repo, r, "t615", true);
    eq(r2.code, "E_NO_BASELINE"); ok(!memFs.files[r.confirm.pendingPath], "soubor uz neni v pending");
    ok(Object.keys(memFs.files).some(function (k) { return /\\rejected\\req-t615/.test(k); }), "soubor v rejected");
});
t("BL-3 T6-16: velikost neznama (sonda selze) -> jako nad prahem, nikdy pod prahem", function () {
    blReset(); var repo = blRepo({ countFails: true });
    var r = runFile(repo, UPD_A1, "t616");
    eq(r.status, "confirm_required"); eq(r.baseline.action, "guided"); contains(r.baseline.reason, "velikost neznama"); eq(repo._createCalls, 0);
});
t("BL-3 T6-25: metriky gate nespocitany + update existujiciho -> zaloha VZNIKNE a dialog nerika 'cisty create'", function () {
    blReset(); var repo = blRepo();
    var polArr = polBase(B.FB_RiskPolicy.call(B)[0].baseline)(); polArr[0].budgetMs = -1;
    withPolicy(function () { return polArr; }, function () {
        var r = runFile(repo, UPD_A1, "t625");
        eq(r.status, "confirm_required"); eq(r.risk.metrics.metricsComplete, false);
        var sum = "" + B.FB_ConfirmSummary.call(B, r);
        contains(sum, "Rozsah davky se nepodarilo spocitat"); ok(sum.indexOf("jen vytvari") < 0, "nikdy cisty create");
        var r2 = confirmFile(repo, r, "t625", true);
        eq(r2.baseline.decision, "created", JSON.stringify(r2.baseline)); eq(autoNames(repo, "{PK-13}").length, 1);
    });
});
t("BL-3 T6-26: opravna davka pres dedupKey/matchByName nad prahem -> projde bez E_NO_BASELINE, vykazuje updatedExistingApprox", function () {
    blReset(); var repo = blRepo({ mult: 9000 });
    withPolicy(polBase({ thresholdsShadow: false, requireRecoveryForUpdates: true }), function () {
        var r = runText(repo, [{ op: "create_or_update_elements", elements: [{ name: "Retry", type: "Class", "package": "{PK-11}", dedupKey: "k1" }] }]);
        ok(r.code != "E_NO_BASELINE", JSON.stringify(r).substring(0, 300)); ok(r.status != "confirm_required", "zadny dialog navic");
        eq(r.baseline.decision, "none"); contains(r.baseline.reason, "updatedExistingApprox"); eq(r.baseline.updatedExistingApprox, 1);
    });
});
t("BL-3 T6-27: $N odkaz na existujici prvek -> velikost neznama (navadena cesta), nikdy cisty create", function () {
    blReset(); var repo = blRepo();
    var r = runFile(repo, [{ op: "find_elements_by_name", name: "ElA" }, { op: "create_or_update_attributes", element: "$0", attributes: [{ name: "a" }] }], "t627");
    eq(r.status, "confirm_required"); eq(r.baseline.action, "guided"); ok(r.baseline.reason.indexOf("cisty create") < 0);
    contains(r.baseline.manual.missing.join(";"), "koren whitelistu");
});
t("BL-3 T6-28: delete korenove whitelist package -> povinne confirm s vysvetlenim, baseline nad package samym, nikdy E_WHITELIST", function () {
    blReset(); var repo = blRepo();
    var oD = B.FB_OpDelete; B.FB_OpDelete = function () { return { op: "delete_from_model", status: "ok", items: [] }; };
    try {
        var r = runFile(repo, [{ op: "delete_from_model", targets: [{ type: "Package", guid: WL_GUID }] }], "t628");
        eq(r.status, "confirm_required"); contains(r.risk.riskReasons.join("; "), "parentOutOfWhitelist");
        contains("" + B.FB_ConfirmSummary.call(B, r), "ZANIKNE");
        var r2 = confirmFile(repo, r, "t628", true);
        eq(r2.status, "done", JSON.stringify(r2).substring(0, 300)); eq(autoNames(repo, WL_GUID).length, 1);
    } finally { B.FB_OpDelete = oD; }
});
t("BL-3 razitka: ai.baseline tag (pkgGuid;name;decision) + radek v Notes auditu", function () {
    var tags = {}, el = {};
    var repo = mkRepo(); repo.GetElementByGuid = function () { return el; };
    var oS = B.SetTag; B.SetTag = function (e, n, v) { tags[n] = v; };
    try {
        B.FB_RiskAuditTags.call(B, repo, "{AUD}", { riskLevel: "LOW", riskReasons: [] },
            { decision: "created", packages: [{ guid: "{PK-13}", name: "FB-AUTO - s20260907-1 2026-09-07 10:00:00", result: "created" }] });
    } finally { B.SetTag = oS; }
    eq(tags["ai.baseline"], "pkgGuid={PK-13};name=FB-AUTO - s20260907-1 2026-09-07 10:00:00;decision=created");
    var note = B.FB_RiskNote.call(B, { riskLevel: "LOW", metrics: {} }, { decision: "none", reason: "cisty create", packages: [] });
    contains(note, "baseline=none (cisty create)");
    eq(B.FB_RiskNote.call(B, { riskLevel: "LOW", metrics: {} }).indexOf("baseline="), -1, "bez sekce beze zmeny");
});
t("BL-3 pad planu/rozhodnuti: nikdy tichy zapis - vynucene potvrzeni s duvodem", function () {
    blReset(); var repo = blRepo();
    var o = B.FB_BaselinePlan; B.FB_BaselinePlan = function () { throw new Error("bum"); };
    try {
        var r = runFile(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": "{PK-11}" }] }], "tpad");
        eq(r.status, "confirm_required"); contains(r.risk.riskReasons.join("; "), "Baseline politika selhala"); eq(r.baseline.decision, "failed");
        contains("" + B.FB_ConfirmSummary.call(B, r), "BEZ pre-image");
    } finally { B.FB_BaselinePlan = o; }
});
t("BL-3 E_NO_BASELINE: adaptery radi soubor do rejected; chat ACK nerika 'rozdel davku'", function () {
    ["AICodeBridge.FB_Process.js", "AICodeBridge.FB_ClipboardImport.js", "AICodeBridge.FB_ProcessFolder.js", "AICodeBridge.FB_ConfirmPending.js"].forEach(function (f) {
        contains(fs.readFileSync(path.join(SRC, f), "utf8"), "E_NO_BASELINE", f);
    });
    var ack = "" + B.FB_ChatRender.call(B, { id: "x", status: "error", code: "E_NO_BASELINE", message: "m", baseline: { reason: "nad prahem" }, results: [] });
    contains(ack, "E_NO_BASELINE"); contains(ack, "NEDEL");
});
t("BL-3 T6-24 regrese: den dev skillu (scaffold + UC + vlastni diagram) -> zadny dialog navic, baselines <= dotcene packages", function () {
    blReset(); var repo = blRepo();
    var day = [
        [{ op: "create_or_update_package", parent: "{PK-11}", name: "UC-1" }],
        [{ op: "create_or_update_elements", elements: [{ name: "UC-1", type: "UseCase", "package": "{PK-11}" }] },
         { op: "create_or_update_diagram", diagrams: [{ name: "UC-1 FA", type: "Activity", "package": "{PK-11}" }] },
         { op: "place_elements_on_diagram", diagram: "$1", elementPlacements: [{ element: "$0" }] }],
        [{ op: "create_or_update_attributes", element: 101, attributes: [{ name: "a" }] }],
        [{ op: "create_or_update_attributes", element: 109, attributes: [{ name: "b" }] }],
        [{ op: "create_or_update_elements", elements: [{ guid: "{EL-101}", notes: "n" }] }]
    ];
    var stub = function (n) { return function () { return { op: n, status: "ok", guid: mkGuid(), items: [{ guid: mkGuid(), id: ++guidSeq }] }; }; };
    var keep = {}; ["FB_OpPackage", "FB_OpElements", "FB_OpDiagram", "FB_OpPlaceElements", "FB_OpAttributes"].forEach(function (k) { keep[k] = B[k]; B[k] = stub(k); });
    try {
        day.forEach(function (ops, ix) {
            var r = runText(repo, ops, "t624-" + ix);
            eq(r.status, "done", "davka " + ix + ": " + JSON.stringify(r).substring(0, 300));
            eq(r.risk.riskLevel, "LOW", "davka " + ix + " bez dialogu");
        });
    } finally { for (var k in keep) { B[k] = keep[k]; } }
    eq(repo._countBaselines(), 1, "3 menici davky do teze package = 1 baseline (reuse session)");
});
// --- FB_SessionStart ---
t("BL-3 T6-2 SessionStart 'off': zadna baseline; hlaseni nese identitu repa a cesty whitelistu", function () {
    blReset(); var repo = blRepo();
    var out = withPolicy(polBase({ sessionBaseline: "off" }), function () { return "" + B.FB_SessionStart.call(B, repo); });
    eq(repo._createCalls, 0); contains(out, "EAEXAMPLE.QEA"); contains(out, "Model.#FB-TEST"); contains(out, "az pred prvnim zapisem");
});
t("BL-3 T6-3 SessionStart 'auto' nad prahem: 0 baselines, 'preskocena (nad limitem)' s poctem", function () {
    blReset(); var repo = blRepo({ mult: 1000 });
    var out = "" + B.FB_SessionStart.call(B, repo);
    eq(repo._createCalls, 0); contains(out, "preskocena (nad limitem)"); contains(out, "11000 prvku > 5000");
});
t("BL-3 SessionStart 'auto' pod prahem: baseline pod autoPrefix se sufixem (session); druhy start v teze session = reuse", function () {
    blReset(); var repo = blRepo();
    var out = "" + B.FB_SessionStart.call(B, repo);
    var nm = autoNames(repo, WL_GUID);
    eq(nm.length, 1); ok(/ \(session\)$/.test(nm[0]), nm[0]); ok(B.FB_BaselineName.call(B, "parse", nm[0], "FB-AUTO ").session);
    contains(out, "vytvorena nad: Model.#FB-TEST");
    ok(!(repo._baselines[WL_GUID] || []).some(function (b) { return /^FB \d{4}/.test(b.version); }), "legacy tvar 'FB <datum>' se uz nevyrabi");
    var out2 = "" + B.FB_SessionStart.call(B, repo);
    eq(autoNames(repo, WL_GUID).length, 1); contains(out2, "uz existuje");
});
t("BL-3 I4 SessionStart: CreateBaseline false -> hlasi SELHANI (ne 'vytvoreno') a NEvaruje o chybejicim whitelistu", function () {
    blReset(); var repo = blRepo({ createFalse: true });
    var out = "" + B.FB_SessionStart.call(B, repo);
    contains(out, "SELHALA"); ok(out.indexOf("vytvorena nad") < 0); ok(out.indexOf("E_REPO") < 0, "whitelist je v poradku");
});
t("BL-3 I4 SessionStart: repo bez whitelist polozky -> varovani E_REPO (z identity, ne z poctu zaloh)", function () {
    blReset();
    var repo = mkRepo({ connectionString: "C:\\X\\JINY.QEA" });
    var out = "" + B.FB_SessionStart.call(B, repo);
    contains(out, "zadna whitelist polozka neodpovida"); contains(out, "E_REPO");
});

// ===========================================================================
// BASELINE POLITIKA - cast 4: minimalni journal (Z260907-4)
// ===========================================================================
var JR_BASE = "C:\\GIT\\ea-file-bridge"; // FB_Config.baseDir pro EAEXAMPLE.QEA
function journalOf(repo, id) {
    var k = JR_BASE + "\\journal\\" + id + ".json";
    return memFs.files[k] ? JSON.parse(memFs.files[k]) : null;
}
function jrRepo() {
    var repo = blRepo({ login: "jnovak" });
    var el = repo.GetElementByID(103);
    el.Name = "ElA1"; el.Notes = "stare poznamky"; el.Alias = "A-1"; el.Stereotype = "entity"; el.StereotypeEx = "entity";
    var tv = el.TaggedValues.AddNew("sa.status", ""); tv.Value = "draft";
    var at = { AttributeID: 401, AttributeGUID: "{AT-401}", Name: "kod", Type: "dtVarchar50", Default: "X", Notes: "n", TaggedValues: mkColl() };
    var el2 = repo.GetElementByID(102);
    el2.Attributes = mkColl(); el2.Attributes._items.push(at);
    var par = { Name: "p1", Type: "int", Default: "0", Notes: "", Position: 0 };
    var me = { MethodID: 501, MethodGUID: "{OP-501}", Name: "najdi", ReturnType: "boolean", Notes: "", Parameters: mkColl(), TaggedValues: mkColl() };
    me.Parameters._items.push(par);
    el.Methods = mkColl(); el.Methods._items.push(me);
    return repo;
}
t("BL-4 journal: pre-image PRESNE tech poli, ktera davka meni (element + tagy), manifest vedle baseline", function () {
    blReset(); var repo = jrRepo();
    var stubs = B.FB_OpElements; B.FB_OpElements = function () { return { op: "create_or_update_elements", status: "ok", items: [] }; };
    try {
        var r = runText(repo, [{ op: "create_or_update_elements", elements: [{ guid: "{EL-103}", notes: "nove", alias: "A-2",
            taggedValues: [{ name: "sa.status", value: "final" }, { name: "novy.tag", value: "1" }] }] }], "jr1");
        eq(r.baseline.decision, "created"); eq(r.baseline.journal.targets, 1); eq(r.baseline.journal.covered[0], "{EL-103}");
        var mf = journalOf(repo, "jr1");
        ok(mf, "manifest neexistuje"); eq(r.baseline.journal.manifestRef, JR_BASE + "\\journal\\jr1.json");
        eq(mf.kind, "eafb-journal/1"); eq(mf.user, "jnovak"); ok(/^s\d{8}-\d+$/.test(mf.session));
        var tg = mf.targets[0];
        eq(JSON.stringify(tg.fields), JSON.stringify({ Alias: "A-1", Notes: "stare poznamky" }), "jen menena pole");
        eq(tg.tags["sa.status"], "draft"); eq(tg.tags["novy.tag"], null, "null = tag pred davkou neexistoval");
        eq(mf.baselines[0].pkgGuid, "{PK-13}"); ok(/^FB-AUTO jnovak /.test(mf.baselines[0].name), "dvojice package -> jmeno baseline");
        contains(mf.limitation, "per-uzivatelske"); ok(mf.restore.length > 20);
    } finally { B.FB_OpElements = stubs; }
});
t("BL-4 journal: package, atribut (match jmenem) a operace s parameters; create vetve se nezaznamenavaji", function () {
    blReset(); var repo = jrRepo();
    repo.GetPackageByID(13).Notes = "pkg notes";
    var cfg = B.FB_BaselineConfig.call(B, repo).cfg;
    var jr = B.FB_Journal.call(B, repo, { ops: [
        { op: "create_or_update_package", guid: "{PK-13}", notes: "x" },
        { op: "create_or_update_attributes", element: 102, attributes: [{ name: "kod", type: "dtInt" }, { name: "novyAtribut", type: "dtInt" }] },
        { op: "create_or_update_operations", element: 103, operations: [{ operationID: 501, returnType: "int", parameters: [{ name: "q", type: "string" }] }] },
        { op: "create_or_update_elements", elements: [{ name: "Novy", type: "Class", "package": "{PK-11}" }] }
    ] }, "jr2", cfg, { token: "s20260920-1" }, { packages: [] });
    eq(jr.targets, 3); eq(jr.uncovered.length, 0, jr.uncovered.join(";"));
    var mf = journalOf(repo, "jr2");
    eq(mf.targets[0].kind, "package"); eq(mf.targets[0].fields.Notes, "pkg notes");
    eq(mf.targets[1].kind, "attribute"); eq(JSON.stringify(mf.targets[1].fields), JSON.stringify({ Name: "kod", Type: "dtVarchar50" }));
    eq(mf.targets[2].kind, "operation"); eq(mf.targets[2].fields.ReturnType, "boolean");
    eq(mf.targets[2].parameters.length, 1); eq(mf.targets[2].parameters[0].name, "p1");
});
t("BL-4 journal: co NEKRYJE, vypise (diagramy, scenare, mazani, $N, match/dedup) - nikdy mlcky", function () {
    blReset(); var repo = jrRepo();
    var jr = B.FB_Journal.call(B, repo, { ops: [
        { op: "update_diagram_properties", diagrams: [{ diagram: 201, name: "n" }] },
        { op: "create_or_update_scenarios", element: 101, scenarios: [] },
        { op: "delete_from_model", targets: [{ type: "Element", id: 104 }] },
        { op: "create_or_update_elements", elements: [{ guid: "$0", notes: "x" }, { name: "M", matchByName: true, "package": "{PK-11}" }] },
        { op: "ping" }, { op: "get_elements_information", elements: [101] }
    ] }, "jr3", null, null, null);
    eq(jr.targets, 0); eq(jr.uncovered.length, 5, jr.uncovered.join(" | ")); eq(jr.manifestRef, "");
});
t("BL-4 journal: strop cilu -> zbytek uncovered", function () {
    blReset(); var repo = jrRepo();
    var els = []; for (var i = 0; i < 205; i++) { els.push({ guid: "{EL-103}", notes: "x" + i }); }
    var jr = B.FB_Journal.call(B, repo, { ops: [{ op: "create_or_update_elements", elements: els }] }, "jr4", null, null, null);
    eq(jr.targets, 200); eq(jr.uncovered.length > 0, true); contains(jr.uncovered[0], "strop 200");
});
t("BL-4 journal: selhani (pad sberu / zapisu manifestu) nikdy neshodi davku; cil = nekryt", function () {
    blReset(); var repo = jrRepo();
    var o = B.FB_Journal, oE = B.FB_OpElements;
    B.FB_OpElements = function () { return { op: "create_or_update_elements", status: "ok", items: [] }; };
    B.FB_Journal = function () { throw new Error("disk plny"); };
    try {
        var r = runText(repo, UPD_A1, "jr5");
        eq(r.status, "done"); contains(r.baseline.journal.why, "disk plny"); eq(r.baseline.journal.covered.length, 0);
    } finally { B.FB_Journal = o; B.FB_OpElements = oE; }
    var oR = B.FB_ResolveBaseDir; B.FB_ResolveBaseDir = function () { throw new Error("baseDir"); };
    try {
        var jr = B.FB_Journal.call(B, repo, { ops: UPD_A1 }, "jr6", null, null, null);
        eq(jr.covered.length, 0); contains(jr.why, "manifest");
    } finally { B.FB_ResolveBaseDir = oR; }
});
t("BL-4 journal jen pod prahem: navadena cesta (nad prahem) i destruktivni E_NO_BASELINE journal NEVOLAJI; rozhodnuti o zaloze journal nemeni", function () {
    blReset(); var repo = blRepo({ mult: 9000 });
    var calls = 0, o = B.FB_Journal; B.FB_Journal = function () { calls++; return { targets: 0, covered: [], uncovered: [], manifestRef: "" }; };
    try {
        withPolicy(polBase({ thresholdsShadow: false }), function () {
            var r = runFile(repo, UPD_A1, "jr7");
            eq(r.status, "confirm_required"); eq(r.baseline.action, "guided", "journal z radku 4 neudela radek 3");
        });
        withPolicy(polBase({ thresholdsShadow: false, requireRecoveryForUpdates: true }), function () {
            eq(runFile(repo, DEL_C, "jr8").code, "E_NO_BASELINE");
        });
        eq(calls, 0);
    } finally { B.FB_Journal = o; }
});
t("BL-4 audit Notes nese odkaz na manifest journalu", function () {
    contains(B.FB_RiskNote.call(B, { riskLevel: "LOW", metrics: {} }, { decision: "created", packages: [], journal: { manifestRef: "C:\\x\\journal\\a.json", targets: 2 } }), "journal=C:\\x\\journal\\a.json (2 cilu)");
});

// ===========================================================================
// BASELINE POLITIKA - cast 5: uklid automatickych baselines (Z260907-5)
// ===========================================================================
var DAY = 86400000;
function clName(login, daysAgo, n, session) {
    return B.FB_BaselineName.call(B, "format", "FB-AUTO ", login, "s20260101-" + (n || 1), new Date().getTime() - daysAgo * DAY, session === true);
}
function clRepo(specs, opts) {
    // specs: [pkgGuid, login, daysAgo] - DocDate zamerne nesouvisi se jmenem (vek se bere ZE JMENA)
    var repo = blRepo(opts);
    specs.forEach(function (s, i) { repo._addBaseline(s[0], (s.length > 3) ? s[3] : clName(s[1], s[2], i + 1), 0); });
    return repo;
}
function clCfg(over) {
    var cfg = B.FB_BaselineConfig.call(B, mkRepo()).cfg;
    for (var k in (over || {})) { cfg.cleanup[k] = over[k]; }
    return cfg;
}
function six() { return [20, 25, 30, 35, 40, 45].map(function (d) { return ["{PK-11}", "jnovak", d]; }); }
t("BL-5 T6-17 report: 6 starych FB-AUTO tehoz uzivatele, K=3 -> 0 smazano, 'smazal bych 3', DeleteBaseline se NEVOLA", function () {
    blReset(); var repo = clRepo(six());
    var r = B.FB_BaselineCleanup.call(B, repo, clCfg(), "report", false);
    eq(r.mode, "report"); eq(r.total, 6); eq(r.candidates.length, 3); eq(r.planned, 3); eq(r.deleted.length, 0);
    eq(repo._deleteCalls, 0); eq(repo._countBaselines(), 6); contains(r.text, "Smazal bych 3");
    contains(r.text, "uzivatel jnovak");
});
t("BL-5 T6-18 delete: smazany PRAVE 3 nejstarsi, zustanou 3 nejnovejsi; audit vyjmenovava GUIDy s loginem", function () {
    blReset(); var repo = clRepo(six());
    var audits = [], oA = B.FB_Audit; B.FB_Audit = function (R, id, summary, text) { audits.push({ id: id, summary: summary, text: text }); return "{AUD}"; };
    var r;
    try { r = B.FB_BaselineCleanup.call(B, repo, clCfg(), "delete", false); } finally { B.FB_Audit = oA; }
    eq(r.mode, "delete"); eq(r.deleted.length, 3); eq(repo._deleteCalls, 3); eq(repo._countBaselines(), 3);
    var left = autoNames(repo, "{PK-11}").map(function (n) { return B.FB_BaselineName.call(B, "parse", n, "FB-AUTO ").ms; });
    ok(left.every(function (ms) { return (new Date().getTime() - ms) < 31 * DAY; }), "zustaly 3 nejnovejsi (20, 25, 30 dni)");
    eq(audits.length, 1); r.deleted.forEach(function (d) { contains(audits[0].text, d.guid); }); contains(audits[0].text, "uzivatel jnovak");
});
t("BL-5 T6-19: legacy 'FB <datum>', 'AI-pre-*', rucni a podvrzena jmena nejsou ani kandidat a report je nezminuje", function () {
    blReset();
    var repo = clRepo([["{PK-11}", "", 0, "FB 2026-01-01 10:00:00"], ["{PK-11}", "", 0, "AI-pre-S-r1"], ["{PK-11}", "", 0, "Pred refaktorem"],
        ["{PK-11}", "", 0, "FB-AUTO jnovak s20260101-1 2026-01-01 10:00:00 navic"], ["{PK-11}", "", 0, "FB-AUTO jnovak 2026-01-01 10:00:00"]]);
    var r = B.FB_BaselineCleanup.call(B, repo, clCfg({ keepLastK: 0 }), "delete", true);
    eq(r.total, 0); eq(r.candidates.length, 0); eq(repo._deleteCalls, 0); eq(repo._countBaselines(), 5);
    ok(r.text.indexOf("Pred refaktorem") < 0 && r.text.indexOf("AI-pre") < 0);
});
t("BL-5 T6-20: 8 FB-AUTO starych 7 dnu, K=3, maxAgeDays 14 -> 0 smazano (AND, ne OR)", function () {
    blReset(); var sp = []; for (var i = 0; i < 8; i++) { sp.push(["{PK-11}", "jnovak", 7]); }
    var repo = clRepo(sp);
    var r = B.FB_BaselineCleanup.call(B, repo, clCfg(), "delete", false);
    eq(r.candidates.length, 0); eq(repo._deleteCalls, 0);
});
t("BL-5 podlaha per (package, uzivatel): kolega A s novejsimi zalohami nevytlaci jediny pre-image kolegy B", function () {
    blReset();
    var sp = [["{PK-11}", "kolegaB", 60]];
    for (var i = 0; i < 5; i++) { sp.push(["{PK-11}", "kolegaA", 1 + i]); }
    var repo = clRepo(sp);
    var r = B.FB_BaselineCleanup.call(B, repo, clCfg(), "delete", false);
    eq(r.candidates.length, 0, "B ma jedinou zalohu = je v jeho keepLastK"); eq(repo._deleteCalls, 0);
    // stejna package, jiny balicek teze osoby se take nemicha
    blReset(); var repo2 = clRepo(six().concat([["{PK-12}", "jnovak", 90]]));
    eq(B.FB_BaselineCleanup.call(B, repo2, clCfg(), "report", false).candidates.length, 3, "PK-12 ma jedinou -> drzi se");
});
t("BL-5 T6-21: 40 kandidatu, maxDeletesPerRun 20 -> prave 20 NEJSTARSICH + 'zbyva 20'; 250 kandidatu -> anomalie, 0 smazano", function () {
    blReset(); var sp = []; for (var i = 0; i < 43; i++) { sp.push(["{PK-11}", "jnovak", 20 + i]); }
    var repo = clRepo(sp);
    var r = B.FB_BaselineCleanup.call(B, repo, clCfg(), "delete", false);
    eq(r.candidates.length, 40); eq(r.deleted.length, 20); eq(r.remaining, 20); contains(r.text, "zbyva 20");
    var oldestLeft = Math.max.apply(null, autoNames(repo, "{PK-11}").map(function (n) { return new Date().getTime() - B.FB_BaselineName.call(B, "parse", n, "FB-AUTO ").ms; }));
    ok(oldestLeft < 43.5 * DAY && oldestLeft > 41.5 * DAY, "smazano 20 nejstarsich (63..43 dni), nejstarsi zbyla ~42 dni: " + (oldestLeft / DAY));
    blReset(); var sp2 = []; for (var j = 0; j < 253; j++) { sp2.push(["{PK-11}", "jnovak", 20 + j]); }
    var repo2 = clRepo(sp2);
    var r2 = B.FB_BaselineCleanup.call(B, repo2, clCfg(), "delete", true);
    eq(r2.anomaly, true); eq(r2.deleted.length, 0); eq(repo2._deleteCalls, 0); contains(r2.text, "ANOMALIE");
});
t("BL-5 menu (force): maze vic nez maxDeletesPerRun, strop anomalie plati", function () {
    blReset(); var sp = []; for (var i = 0; i < 43; i++) { sp.push(["{PK-11}", "jnovak", 20 + i]); }
    var repo = clRepo(sp);
    eq(B.FB_BaselineCleanup.call(B, repo, clCfg(), "delete", true).deleted.length, 40);
});
t("BL-5 T6-22: uklid necte zadny lokalni index - kandidati jen z modelu; selhany SELECT = nic se nedeje", function () {
    ok(fs.readFileSync(path.join(SRC, "AICodeBridge.FB_BaselineCleanup.js"), "utf8").split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join("\n").indexOf("baselines-index") < 0);
    blReset(); var repo = clRepo(six());
    repo.SQLQuery = function () { throw new Error("db"); };
    var r = B.FB_BaselineCleanup.call(B, repo, clCfg(), "delete", true);
    eq(r.deleted.length, 0); eq(repo._deleteCalls, 0); contains(r.text, "selhal");
});
t("BL-5 T6-23 (dev nahrada): uzivatel mimo write skupinu -> delete se NESPUSTI, report ano", function () {
    blReset(); var repo = clRepo(six());
    var oU = B.FB_UserAccess; B.FB_UserAccess = function () { return { access: "read", login: "ctenar", reason: "neni clen" }; };
    try {
        var r = B.FB_BaselineCleanup.call(B, repo, clCfg(), "delete", true);
        eq(r.mode, "report"); eq(r.requestedMode, "delete"); eq(repo._deleteCalls, 0); eq(r.candidates.length, 3); contains(r.text, "write skupinu");
    } finally { B.FB_UserAccess = oU; }
});
t("BL-5 autorita pred smazanim: baseline, ktera v GetBaselines pod timto GUID/jmenem neni, se nemaze", function () {
    blReset(); var repo = clRepo(six());
    var oldest = repo._baselines["{PK-11}"].slice().sort(function (a, b) { return a.version < b.version ? -1 : 1; });
    // SQL vraci radek, ktery API uz nezna (jmeno mezitim zmeneno na rucni)
    var realGet = repo.GetProjectInterface;
    repo.GetProjectInterface = function () {
        var pi = realGet(); var g = pi.GetBaselines;
        pi.GetBaselines = function (x) { return g(x).replace(/version="FB-AUTO [^"]*"/, 'version="Prejmenovano rucne"'); };
        return pi;
    };
    var r = B.FB_BaselineCleanup.call(B, repo, clCfg({ keepLastK: 0 }), "delete", true);
    eq(r.failed.length, 1); contains(r.failed[0].why, "GetBaselines"); eq(r.deleted.length, 5);
});
t("BL-5 selhani jednoho DeleteBaseline neshodi zbytek behu", function () {
    blReset(); var repo = clRepo(six());
    var realGet = repo.GetProjectInterface, n = 0;
    repo.GetProjectInterface = function () { var pi = realGet(); var d = pi.DeleteBaseline;
        pi.DeleteBaseline = function (g) { n++; if (n == 1) { throw new Error("COM"); } return d(g); }; return pi; };
    var r = B.FB_BaselineCleanup.call(B, repo, clCfg(), "delete", false);
    eq(r.failed.length, 1); eq(r.deleted.length, 2);
});
t("BL-5 session baselines (sufix) spadaji pod tutez retenci; vek se bere ZE JMENA, ne z DocDate", function () {
    blReset();
    var repo = blRepo();
    for (var i = 0; i < 5; i++) { repo._addBaseline(WL_GUID, clName("jnovak", 30 + i, i + 1, true), 0); } // DocDate = dnes
    eq(B.FB_BaselineCleanup.call(B, repo, clCfg(), "report", false).candidates.length, 2);
});
t("BL-5 zdroj: DeleteBaseline se vola z jedineho mista (FB_BaselineCleanup)", function () {
    var where = [];
    L.files.forEach(function (f) {
        var code = fs.readFileSync(path.join(SRC, f), "utf8").split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join("\n");
        if (/\.DeleteBaseline\(/.test(code)) { where.push(f); }
    });
    eq(where.join(","), "AICodeBridge.FB_BaselineCleanup.js");
});
t("BL-5 T6-32 hak v executoru: dve zapisove davky za sebou (i schrankovy kanal jde pres FB_Main) -> uklid PRAVE jednou; po okne znovu", function () {
    blReset(); var repo = clRepo(six());
    var calls = 0, o = B.FB_BaselineCleanup;
    B.FB_BaselineCleanup = function () { calls++; return o.apply(B, arguments); };
    try {
        var a = runText(repo, [{ op: "create_or_update_elements", elements: [{ name: "N1", type: "Class", "package": "{PK-12}" }] }], "cl1");
        var b = runText(repo, [{ op: "create_or_update_elements", elements: [{ name: "N2", type: "Class", "package": "{PK-12}" }] }], "cl2");
        eq(calls, 1); ok(a.cleanup && a.cleanup.mode == "report" && a.cleanup.candidates == 3, JSON.stringify(a.cleanup)); eq(typeof b.cleanup, "undefined");
        contains((a.warnings || []).join(" "), "smazal bych 3"); eq(repo._deleteCalls, 0, "vychozi politika = report");
        runText(repo, [{ op: "ping" }], "cl3"); eq(calls, 1, "cteci davka uklid nespousti");
        eq(B.FB_BaselineCleanupHook.call(B, repo, new Date().getTime() + 25 * 3600000) != null, true, "po cleanupEveryHours znovu");
        var st = ("" + B.FB_StateFile.call(B, repo, "cleanup")).split("|"); eq(st[1], "2", "pocitadlo behu");
    } finally { B.FB_BaselineCleanup = o; }
});
t("BL-5 hak: pad uklidu neshodi davku a nebezi pak pri kazde davce; vadna politika = zadny uklid", function () {
    blReset(); var repo = clRepo(six());
    var calls = 0, o = B.FB_BaselineCleanup; B.FB_BaselineCleanup = function () { calls++; throw new Error("bum"); };
    try {
        eq(runText(repo, [{ op: "create_or_update_elements", elements: [{ name: "N1", type: "Class", "package": "{PK-12}" }] }], "cl4").status, "done");
        runText(repo, [{ op: "create_or_update_elements", elements: [{ name: "N2", type: "Class", "package": "{PK-12}" }] }], "cl5");
        eq(calls, 1);
    } finally { B.FB_BaselineCleanup = o; }
    blReset();
    withPolicy(polBase({ cleanup: { mode: "delete" } }), function () { eq(B.FB_BaselineCleanupHook.call(B, clRepo(six())), null); });
});
t("BL-5 menu: polozka existuje; klik = report -> Ano -> delete s force; bez kandidatu jen informace", function () {
    blReset();
    var items = B.EA_GetMenuItems.call(B, mkRepo(), "TreeView", "-AI Bridge");
    ok(items.indexOf("Uklid automatickych baselines (ukazat / provest)") >= 0, items.join("|"));
    var repo = clRepo(six());
    var oP = Session.Prompt; var asked = [];
    Session.Prompt = function (m, kind) { asked.push(kind); return kind == 3 ? 3 : 1; };
    try { B.EA_MenuClick.call(B, repo, "TreeView", "-AI Bridge", "Uklid automatickych baselines (ukazat / provest)"); }
    finally { Session.Prompt = oP; }
    eq(asked.join(","), "3,0"); eq(repo._deleteCalls, 3);
    blReset(); var repo2 = clRepo(six()); asked = [];
    Session.Prompt = function (m, kind) { asked.push(kind); return kind == 3 ? 4 : 1; };
    try { B.EA_MenuClick.call(B, repo2, "TreeView", "-AI Bridge", "Uklid automatickych baselines (ukazat / provest)"); }
    finally { Session.Prompt = oP; }
    eq(repo2._deleteCalls, 0, "Ne = nic se nemaze");
});

// ------------------------------------------------------------------ vysledek
console.log("");
console.log("EA File Bridge offline harness: " + passed + "/" + (passed + failed) + " PASS");
if (failed > 0) {
    console.log("");
    failures.forEach(function (f) { console.log("FAIL " + f); });
    process.exit(1);
}
