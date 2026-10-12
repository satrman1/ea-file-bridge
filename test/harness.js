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
var TRACE = !!process.env.HARNESS_TRACE; // HARNESS_TRACE=1 node test/harness.js -> vypis jmen testu (hledani zacykleni)
var ONLY = process.env.HARNESS_ONLY || ""; // HARNESS_ONLY=<podretezec jmena> -> spusti jen vybrane testy (ladeni)
function t(name, fn) {
    if (ONLY && name.indexOf(ONLY) < 0 && name.indexOf("syntax:") !== 0) { return; }
    if (TRACE) { console.log("  > " + name); }
    // mezipameti JEDNOHO volani FB_Main (FB_TargetCache, FB_WriteScopeCfg) -
    // FB_Main je nuluje sam; primo volane handlery/gate je v testech sdilet nesmi
    if (typeof B != "undefined" && B) { B._fbTargetCache = null; B._fbScopeCfg = null; }
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
        if (prefix.charAt(prefix.length - 1) != "\\") { prefix += "\\"; } // v0.6 sim pumpy: GetFolder(requests) nesmi videt requests\pending\x
        var out = [];
        for (var k in memFs.files) {
            if (k.indexOf(prefix) === 0 && k.substring(prefix.length).indexOf("\\") < 0) {
                out.push({ Name: k.substring(prefix.length), Path: k, Size: ("" + memFs.files[k]).length, DateLastModified: new Date(2026, 9, 12, 8, 0, 0) });
            }
        }
        return { Files: out };
    };
    // v0.6 (sim pumpy): GetFile (Size) + OpenTextFile (zamky, log, dir /b listing)
    this.GetFile = function (p) { var k = norm(p); if (typeof memFs.files[k] == "undefined") { throw new Error("mock: soubor neexistuje: " + p); } return { Name: k.substring(k.lastIndexOf("\\") + 1), Path: k, Size: ("" + memFs.files[k]).length, DateLastModified: new Date(2026, 9, 12, 8, 0, 0) }; };
    this.OpenTextFile = function (p, mode, create) {
        var k = norm(p);
        if (mode == 1) {
            if (typeof memFs.files[k] == "undefined") { throw new Error("mock: soubor neexistuje: " + p); }
            var lines = ("" + memFs.files[k]).split(/\r?\n/), li = 0;
            return { ReadLine: function () { return lines[li++]; }, ReadAll: function () { return memFs.files[k]; }, Close: function () { },
                get AtEndOfStream() { return li >= lines.length; } };
        }
        if (typeof memFs.files[k] == "undefined") { if (!create) { throw new Error("mock: soubor neexistuje: " + p); } memFs.files[k] = ""; }
        if (mode == 2) { memFs.files[k] = ""; }
        return { Write: function (t) { memFs.files[k] += "" + t; }, WriteLine: function (t) { memFs.files[k] += "" + t + "\r\n"; }, Close: function () { } };
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
// Skutecny FB_WriteScope je konfigurace ZIVYCH domacich modelu (GUIDy fixtur
// FBT-CHRANENE v EAExample/QEAX, ktere mock nema) - harness ho nahrazuje
// neutralni polozkou (prazdny blacklist); testy cile zapisu si nasazuji
// vlastni pres withScope. Syntax a tvar skutecneho souboru hlida test nize.
var FB_WRITESCOPE_LIVE = B.FB_WriteScope;
B.FB_WriteScope = function () { return [{ repo: "EAEXAMPLE.QEA", blacklist: [] }]; };
// cil zapisu (Z261004b-10, rezim blacklist): docasna konfigurace FB_WriteScope
// pro test; mezipamet FB_WriteScopeCfg se vzdy vynuluje
function withScope(entries, fn) {
    var o1 = B.FB_WriteScope;
    B.FB_WriteScope = function () { return entries; };
    B._fbScopeCfg = null;
    try { return fn(); } finally { B.FB_WriteScope = o1; B._fbScopeCfg = null; }
}
// EAEXAMPLE s chranenym balickem {PKG-BL} jmena "FBT-CHRANENE" (allowIncomingRefs volitelne)
function scopeBL(allowIn, extra) {
    var e = { pkg: "{PKG-BL}", name: "FBT-CHRANENE", note: "test blacklistu" };
    if (typeof allowIn != "undefined") { e.allowIncomingRefs = allowIn; }
    var bl = [e];
    if (extra) { for (var i = 0; i < extra.length; i++) { bl.push(extra[i]); } }
    return [{ repo: "EAEXAMPLE.QEA", blacklist: bl }];
}
// SQL pravidla mocku pro chraneny balicek {PKG-BL} (id 900) pod korenem Model (id 1)
function blRules() {
    return [
        { re: /FROM t_package WHERE ea_guid = '\{PKG-BL\}'/i, rows: [{ Package_ID: "900", Parent_ID: "1", ea_guid: "{PKG-BL}", Name: "FBT-CHRANENE" }] },
        { re: /FROM t_package WHERE Package_ID = 900\b/i, rows: [{ Package_ID: "900", Parent_ID: "1", ea_guid: "{PKG-BL}", Name: "FBT-CHRANENE" }] },
        { re: /FROM t_package WHERE Package_ID = 901\b/i, rows: [{ Package_ID: "901", Parent_ID: "900", ea_guid: "{PKG-BL-SUB}", Name: "Podbalicek" }] },
        { re: /FROM t_package WHERE ea_guid = '\{PKG-BL-SUB\}'/i, rows: [{ Package_ID: "901", Parent_ID: "900", ea_guid: "{PKG-BL-SUB}", Name: "Podbalicek" }] },
        { re: /FROM t_package WHERE Package_ID = 1\b/i, rows: [{ Package_ID: "1", Parent_ID: "0", ea_guid: "{PKG-ROOT}", Name: "Model" }] },
        { re: /FROM t_package WHERE ea_guid = '\{PKG-ROOT\}'/i, rows: [{ Package_ID: "1", Parent_ID: "0", ea_guid: "{PKG-ROOT}", Name: "Model" }] },
        { re: /FROM t_package WHERE Package_ID = 2\b/i, rows: [{ Package_ID: "2", Parent_ID: "1", ea_guid: "{PKG-FREE}", Name: "Volne" }] },
        { re: /FROM t_package WHERE ea_guid = '\{PKG-FREE\}'/i, rows: [{ Package_ID: "2", Parent_ID: "1", ea_guid: "{PKG-FREE}", Name: "Volne" }] }
    ];
}

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
t("get_selected_context (FB-CZ-19): vybrany element -> type/guid/path/branch/repository/writeCheck {ok, code, note}; volny prvek = ok true", function () {
    var repo = mkRepo();
    var root = repo._addPackage({ id: 1, name: "Model" });
    var sub = repo._addPackage({ id: 2, name: "Domain", parentID: 1, guid: "{PKG-DOMAIN}" });
    var el = repo._addElement({ id: 11, guid: "{EL-ZAK}", name: "Zakaznik", type: "Class", packageID: 2 });
    repo.GetTreeSelectedItemType = function () { return 4; };
    repo.GetTreeSelectedObject = function () { return el; };
    var r = withScope([{ repo: "EAEXAMPLE.QEA", blacklist: [] }], function () { return B.FB_OpSelectedContext.call(B, repo, { op: "get_selected_context" }); });
    eq(r.status, "ok");
    eq(r.selected, true);
    contains(r.repository, "EAEXAMPLE.QEA", "identita repa pro schranku/davku");
    eq(r.context.type, "Element");
    eq(r.context.guid, "{EL-ZAK}");
    eq(r.context.path, "Model.Domain.Zakaznik");
    eq(r.context.branchGuid, "{PKG-DOMAIN}");
    ok(r.context.writeCheck && r.context.writeCheck.ok === true, "writeCheck.ok: " + JSON.stringify(r.context.writeCheck));
    eq(r.context.writeCheck.code, ""); contains(r.context.writeCheck.note, "zamky EA");
    ok(typeof r.context.inWhitelist == "undefined" && typeof r.context.whitelistNote == "undefined", "inWhitelist/whitelistNote uz neexistuji (O1 = b)");
});
t("get_selected_context (FB-CZ-19): vybrany package -> branch = on sam; package na blacklistu = writeCheck.ok false, code E_BLACKLIST, note s chranenou vetvi", function () {
    var repo = mkRepo();
    var root = repo._addPackage({ id: 1, name: "Model" });
    var sub = repo._addPackage({ id: 2, name: "Domain", parentID: 1, guid: "{PKG-DOMAIN}" });
    repo.GetTreeSelectedItemType = function () { return 5; };
    repo.GetTreeSelectedObject = function () { return sub; };
    var r = withScope([{ repo: "EAEXAMPLE.QEA", blacklist: [{ pkg: "{PKG-DOMAIN}", name: "Domain", note: "test" }] }], function () {
        return B.FB_OpSelectedContext.call(B, repo, { op: "get_selected_context" });
    });
    eq(r.context.type, "Package");
    eq(r.context.branchGuid, "{PKG-DOMAIN}");
    eq(r.context.writeCheck.ok, false, "package na blacklistu");
    eq(r.context.writeCheck.code, "E_BLACKLIST");
    contains(r.context.writeCheck.note, "Model.Domain"); contains(r.context.writeCheck.note, "test");
    // repozitar bez polozky -> writeCheck E_REPO
    var repo2 = mkRepo({ connectionString: "C:\\X\\JINY.QEA" });
    repo2._addPackage({ id: 1, name: "Model" }); var s2 = repo2._addPackage({ id: 2, name: "D", parentID: 1, guid: "{PKG-D2}" });
    repo2.GetTreeSelectedItemType = function () { return 5; }; repo2.GetTreeSelectedObject = function () { return s2; };
    var r2 = B.FB_OpSelectedContext.call(B, repo2, { op: "get_selected_context" });
    eq(r2.context.writeCheck.ok, false); eq(r2.context.writeCheck.code, "E_REPO");
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

t("I7 krit.1 / FB-CZ-19: get_selected_context -> ACK nese GUID, jmeno, writeCheck i plnou path (regrese res-20260821-03; writeCheck misto inWhitelist od v1.2)", function () {
    var out = chat({
        status: "done", id: "20260821-03", repository: "EAEXAMPLE.QEA",
        results: [{ op: "get_selected_context", status: "ok", selected: true,
            context: { type: "Package", guid: "{5A55C1C5-3A34-4a5f-A33C-A6E829A29AAA}", id: 1054,
                name: "#FB-TEST", path: "Model.Sandbox.#FB-TEST", writeCheck: { ok: true, code: "", note: "" } },
            selectedElements: [], currentDiagram: null, treeType: 5 }]
    });
    contains(out, "{5A55C1C5-3A34-4a5f-A33C-A6E829A29AAA}");
    contains(out, "#FB-TEST");
    contains(out, "writeCheck=ok");
    contains(out, "path=Model.Sandbox.#FB-TEST", "path plnou cestou (par. 4.2/I5)");
    var out2 = chat({
        status: "done", id: "20260821-04", repository: "EAEXAMPLE.QEA",
        results: [{ op: "get_selected_context", status: "ok", selected: true,
            context: { type: "Package", guid: "{G}", id: 1, name: "Chr", path: "Model.Chr", writeCheck: { ok: false, code: "E_BLACKLIST", note: "cil Model.Chr lezi v chranene vetvi 'Model.Chr'" } },
            selectedElements: [], currentDiagram: null, treeType: 5 }]
    });
    contains(out2, "writeCheck=NE E_BLACKLIST"); contains(out2, "chranene vetvi");
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

t("I7 krit.6: ping ACK nese segment zapisu (blacklist + chranene vetve) + access; nikdy login/groups/connection/nonce (cil zapisu kap. 5.11)", function () {
    var out = chat({
        status: "done", id: "t7-ping", repository: "EAEXAMPLE.QEA",
        results: [{ op: "ping", status: "ok", echo: "x", eaVersion: "1715",
            repository: "EAEXAMPLE.QEA", connection: "C:\\Users\\tajnylogin\\models\\EAEXAMPLE.QEA",
            writeScope: { mode: "blacklist", securityEnabled: true, repoKnown: true,
                blacklist: [{ guid: "{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}", name: "FBT-CHRANENE", path: "Model.Sandbox.FBT-CHRANENE", note: "test", found: true, allowIncomingRefs: true }],
                implicit: [], problems: [], warnings: [] },
            access: { securityEnabled: true, login: "TAJNY-LOGIN", access: "write",
                groups: ["TAJNA-SKUPINA"], reason: "clen write skupiny dle FB_AccessGroups" } }]
    });
    contains(out, "zapis: blacklist (1 chranenych vetvi", "segment zapisu misto whitelistu");
    contains(out, "Model.Sandbox.FBT-CHRANENE", "plna cesta chranene vetve");
    ok(out.indexOf("whitelist") < 0, "slovo whitelist v ACK uz neni");
    contains(out, "pristup: write");
    contains(out, "clen write skupiny", "reason plnym textem");
    ok(out.indexOf("TAJNY-LOGIN") < 0, "login se nerenderuje (datova minimalizace par. 4.5)");
    ok(out.indexOf("TAJNA-SKUPINA") < 0, "groups se nerenderuji");
    ok(out.indexOf("tajnylogin") < 0, "connection se do ACK nedava");
    ok(out.toLowerCase().indexOf("nonce") < 0, "zadny nonce v ACK");
});

t("I7 krit.6b: repozitar bez polozky FB_WriteScope = explicitni veta E_REPO; vadna konfigurace = veta E_SCOPE_CONFIG", function () {
    var out = chat({
        status: "done", id: "t7-pw0", repository: "JINE.QEA",
        results: [{ op: "ping", status: "ok", repository: "JINE.QEA", writeScope: { mode: "blacklist", repoKnown: false, blacklist: [], implicit: [], problems: [] },
            access: { securityEnabled: false, access: "write", reason: "security vypnuta" } }]
    });
    contains(out, "NEMA polozku ve FB_WriteScope", "chybejici polozka musi byt explicitne pojmenovana (par. 4.5)");
    var out2 = chat({
        status: "done", id: "t7-pw1", repository: "EAEXAMPLE.QEA",
        results: [{ op: "ping", status: "ok", repository: "EAEXAMPLE.QEA", writeScope: { mode: "blacklist", repoKnown: true, blacklist: [], implicit: [], problems: ["GUID {X} nenalezen"] },
            access: { securityEnabled: false, access: "write", reason: "security vypnuta" } }]
    });
    contains(out2, "E_SCOPE_CONFIG", "vadna konfigurace v ACK");
});

t("I7 / FB-CZ-05a: FB_OpPing nese writeScope; nedohledatelna polozka blacklistu found: false + vada E_SCOPE_CONFIG, ne tiche zahozeni", function () {
    delete B._fbAccessCache;
    var repo = mkRepo();
    var r = withScope(scopeBL(), function () { return B.FB_OpPing.call(B, repo, { op: "ping", echo: "x" }); });
    eq(r.status, "ok");
    ok(typeof r.whitelist == "undefined", "pole whitelist zanika (kap. 5.11)");
    ok(r.writeScope && r.writeScope.mode == "blacklist" && r.writeScope.repoKnown === true, "writeScope repoKnown");
    eq(r.writeScope.blacklist.length, 1, "polozka EAEXAMPLE z FB_WriteScope se ma propsat");
    eq(r.writeScope.blacklist[0].found, false, "GUID v mocku neni -> found: false");
    ok(r.writeScope.problems.length >= 1 && /nenalezen/.test(r.writeScope.problems.join(" ")), "vada: GUID nenalezen");
    eq(r.access.access, "write", "security vypnuta -> write (FB_UserAccess)");
});

t("I7: FB_OpPing dohleda jmeno + plnou cestu chranene vetve (found: true, bez vad)", function () {
    delete B._fbAccessCache;
    var repo = mkRepo({ sqlRules: blRules() });
    repo._addPackage({ id: 1, name: "Model", guid: "{PKG-ROOT}" });
    repo._addPackage({ id: 900, name: "FBT-CHRANENE", parentID: 1, guid: "{PKG-BL}" });
    var r = withScope(scopeBL(), function () { return B.FB_OpPing.call(B, repo, { op: "ping" }); });
    eq(r.writeScope.blacklist.length, 1);
    eq(r.writeScope.blacklist[0].found, true);
    eq(r.writeScope.blacklist[0].path, "Model.FBT-CHRANENE", "path plnou cestou");
    eq(r.writeScope.problems.length, 0, "bez vad: " + r.writeScope.problems.join("; "));
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
t("move_elements: cil v chranene casti (blacklist) -> E_BLACKLIST, nic nepresunuto (FB-CZ-13)", function () {
    var repo = moveRepo();
    repo._addPackage({ id: 2000, name: "FBT-CHRANENE", parentID: 0, guid: "{PKG-BL}" });
    var uc = mkMoveEl(repo, 11310, "UC-95002", 1067);
    var res = withScope(scopeBL(), function () { return B.FB_OpMoveElements.call(B, repo, { op: "move_elements", "package": 2000, elements: [11310] }, "t-m5"); });
    eq(res.status, "error");
    eq(res.code, "E_BLACKLIST", JSON.stringify(res).substring(0, 300));
    contains(res.message, "FBT-CHRANENE", "zprava jmenuje chranenou vetev");
    eq(uc.PackageID, 1067);
});
t("move_elements: cil mimo byvaly sandbox (volny balicek) PROJDE - whitelist zanikl (FB-CZ-01)", function () {
    var repo = moveRepo();
    repo._addPackage({ id: 2000, name: "MIMO SANDBOX", parentID: 0 });
    var uc = mkMoveEl(repo, 11310, "UC-95002", 1067);
    var res = B.FB_OpMoveElements.call(B, repo, { op: "move_elements", "package": 2000, elements: [11310] }, "t-m5b");
    eq(res.status, "ok", JSON.stringify(res).substring(0, 300));
    eq(uc.PackageID, 2000);
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
t("move_elements: vlastneny potomek v chranene casti -> E_BLACKLIST PRED prvnim presunem (I6, FB-CZ-13)", function () {
    var repo = moveRepo();
    repo._addPackage({ id: 2001, name: "FBT-CHRANENE", parentID: 0, guid: "{PKG-BL}" });
    repo._sqlRules.push({ re: /FROM t_object WHERE ParentID IN \(11310\)/i, rows: [{ Object_ID: "11399", Name: "Potomek jinde" }] });
    var uc = mkMoveEl(repo, 11310, "UC-95002", 1067);
    var cizi = addChild(repo, uc, 11399, "Potomek jinde", 2001);
    var res = withScope(scopeBL(), function () { return B.FB_OpMoveElements.call(B, repo, { op: "move_elements", "package": 1069, elements: [11310] }, "t-m9"); });
    eq(res.status, "error", JSON.stringify(res).substring(0, 300));
    eq(res.code, "E_BLACKLIST");
    contains(res.message, "Potomek jinde", "zprava jmenuje potomka");
    eq(uc.PackageID, 1067, "rodic se NESMEL presunout (kontrola pred prvnim zapisem)");
    eq(cizi.PackageID, 2001);
});
t("move_elements: podstrom hlubsi nez strop -> E_BLACKLIST 'presun po castech', nikdy tichy presun (I6)", function () {
    var repo = moveRepo();
    // kazda uroven vraci dalsiho potomka -> nekonecna hloubka
    var depthCounter = 0;
    repo._sqlRules.push({ re: /FROM t_object WHERE ParentID IN \(/i, rows: function () { depthCounter++; return [{ Object_ID: "" + (20000 + depthCounter), Name: "L" + depthCounter }]; } });
    var uc = mkMoveEl(repo, 11310, "UC-95002", 1067);
    for (var d = 1; d <= 70; d++) { mkMoveEl(repo, 20000 + d, "L" + d, 1067); }
    var res = B.FB_OpMoveElements.call(B, repo, { op: "move_elements", "package": 1069, elements: [11310] }, "t-m9b");
    eq(res.status, "error");
    eq(res.code, "E_BLACKLIST");
    contains(res.message, "po castech");
    eq(uc.PackageID, 1067);
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
var K8_CFG_FILES = ["AICodeBridge.FB_WriteScope.js", "AICodeBridge.FB_Config.js", "AICodeBridge.FB_OpsAllowed.js",
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
    var ws = FB_WRITESCOPE_LIVE.call(B);
    ok(ws.length === 2 && ws[1].repo === K8_REPO_ID && Object.prototype.toString.call(ws[1].blacklist) == "[object Array]", "QEAX polozka FB_WriteScope se skutecnou identitou a klicem blacklist (FB-CZ-06)");
    ok(!fs.existsSync(path.join(SRC, "AICodeBridge.FB_Whitelist.js")), "FB_Whitelist.js v src\\ uz neni (FB-CZ-01, O1 = b)");
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
    eq(resp.results[0].writeScope.repoKnown, false, "cizi repo: writeScope.repoKnown false (zapis by byl E_REPO)");
    eq(resp.results[0].access.access, "read");
});
t("K8 fail-secure / FB-CZ-02: repo doplneno, pkg blacklistu jeste placeholder -> FB_CheckWrite = E_SCOPE_CONFIG (fail-closed, ne tiche vypnuti ochrany)", function () {
    var repo = k8Repo({ securityEnabled: false });
    var chk = withScope([{ repo: "QEAX-K8-MODEL.QEA", blacklist: [{ pkg: "<GUID-685>", name: "X", note: "" }] }], function () {
        return B.FB_CheckWrite.call(B, repo, repo.GetPackageByID(685));
    });
    ok(chk != null && chk.code === "E_SCOPE_CONFIG", "ocekavan E_SCOPE_CONFIG: " + JSON.stringify(chk));
    contains(chk.message, "{...}", "hlaska rika, ze pkg musi byt GUID");
});
t("K8 fail-secure / FB-CZ-01: repo bez polozky FB_WriteScope -> FB_CheckWrite = E_REPO", function () {
    var repo = k8Repo({ securityEnabled: false });
    var chk = B.FB_CheckWrite.call(B, repo, repo.GetPackageByID(685));
    ok(chk != null && chk.code === "E_REPO", "ocekavan E_REPO: " + JSON.stringify(chk));
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
// --- FB-PU-01 + N-B-4 (2026-10-10): MOCK BEH bootstrapu v Node nad mockem EA Scripting
// (vzor IT-ANALYSIS/audity/sim-revize-pumpy-2026-10-04/agent-ch/exp9-bootstrap.js).
// Skutecny skript scripts\ITAN-Bootstrap File Bridge.js bezi nad src\ z repa.
function bootColl(factory) {
    var items = [];
    var c = { _items: items, GetAt: function (i) { return items[i]; }, Refresh: function () { },
        AddNew: function (n, t) { var it = factory(n, t); items.push(it); return it; },
        DeleteAt: function (i) { items.splice(i, 1); } };
    Object.defineProperty(c, "Count", { get: function () { return items.length; } });
    return c;
}
function bootMethod(n) {
    var m = { Name: n, Code: "", StyleEx: "", _updates: 0,
        Parameters: bootColl(function (pn) { return { Name: pn, Position: 0, Update: function () { return true; } }; }),
        Update: function () { m._updates++; return true; }, GetLastError: function () { return ""; } };
    return m;
}
function bootElement(id, params) {
    // params = { operace: [parametry] } -> existujici operace "z modelu"
    var e = { Name: "AICodeBridge", ElementID: id, ElementGUID: "{ADDIN-" + id + "}", StereotypeEx: "", Notes: "",
        Methods: bootColl(bootMethod), Update: function () { return true; },
        TaggedValues: bootColl(function (n, v) { return { Name: n, Value: v, Update: function () { return true; } }; }) }; // v0.6: fb.code.* (bootstrap bod 8)
    for (var k in (params || {})) {
        var m = e.Methods.AddNew(k, "String");
        params[k].forEach(function (pn, i) { var p = m.Parameters.AddNew(pn, "String"); p.Position = i; });
    }
    e._params = function (name) {
        var mm = e.Methods._items.filter(function (x) { return x.Name == name; })[0];
        return mm ? mm.Parameters._items.map(function (p) { return p.Name; }) : null;
    };
    return e;
}
function runBootstrap(opts) {
    // opts.rows = radky dotazu na elementy AICodeBridge [{ id, guid, stereo, pkg, el }]
    opts = opts || {};
    var out = [], byGuid = {};
    (opts.rows || []).forEach(function (r) { byGuid[r.guid] = r.el; });
    var code = fs.readFileSync(path.join(__dirname, "..", "scripts", "ITAN-Bootstrap File Bridge.js"), "utf8");
    function map(p) { return ("" + p).replace(/^[CD]:\\GIT\\ea-file-bridge\\src\\?$/i, SRC).replace(/^[CD]:\\GIT\\ea-file-bridge\\src\\/i, SRC + path.sep); }
    var created = null;
    var pkg = { Name: "Add-Ins", Elements: bootColl(function () { created = bootElement(999, {}); return created; }) };
    var g = {
        Session: { Output: function (m) { out.push("" + m); }, Input: function () { return ""; } },
        Repository: {
            EnsureOutputVisible: function () { },
            SQLQuery: function (sql) {
                if (/WHERE o\.Name = 'AICodeBridge'/.test(sql)) {
                    return "<EADATA><Dataset_0><Data>" + (opts.rows || []).map(function (r) {
                        return "<Row><ea_guid>" + r.guid + "</ea_guid><Object_ID>" + r.id + "</Object_ID><Stereotype>" + (r.stereo || "") + "</Stereotype><PkgName>" + (r.pkg || "") + "</PkgName></Row>";
                    }).join("") + "</Data></Dataset_0></EADATA>";
                }
                var m = /Object_Type = 'Signal' AND Name = '([^']+)'/.exec(sql);
                if (m) { return (opts.signals || {})[m[1]] ? "<ea_guid>" + opts.signals[m[1]] + "</ea_guid>" : ""; }
                return "";
            },
            GetElementByGuid: function (gd) { return byGuid[gd] || null; },
            GetTreeSelectedPackage: function () { return opts.noPkg ? null : pkg; }
        },
        ActiveXObject: function (progId) {
            if (/FileSystemObject/i.test(progId)) { return {
                FolderExists: function (p) { try { return fs.statSync(map(p)).isDirectory(); } catch (e) { return false; } },
                GetFolder: function (p) { return { Files: fs.readdirSync(map(p)).map(function (n) { return { Name: n }; }) }; } }; }
            return { Type: 2, Charset: "", Open: function () { }, Close: function () { }, _b: "",
                LoadFromFile: function (p) { this._b = fs.readFileSync(map(p), "utf8"); }, ReadText: function () { return this._b; } };
        },
        Enumerator: function (coll) { var i = 0; this.atEnd = function () { return i >= coll.length; }; this.moveNext = function () { i++; }; this.item = function () { return coll[i]; }; }
    };
    var names = Object.keys(g);
    var fn = Function.apply(null, names.concat([code]));
    fn.apply(null, names.map(function (k) { return g[k]; }));
    return { out: out, created: created, px: out.filter(function (l) { return /^PX  /.test(l); }), done: out.filter(function (l) { return /^Hotovo:/.test(l); })[0] || "" };
}
var BOOT_SIGNALS = { EA_Connect: "{S1}", EA_GetMenuItems: "{S2}", EA_MenuClick: "{S3}", EA_OnOutputItemDoubleClicked: "{S4}" };
t("ITAN-Bootstrap mock FB-PU-01: existujici operace s 1 parametrem, hlavicka se 2 -> po behu 2 parametry, radek PX a pocet v souhrnu", function () {
    // stav v0.14 v modelu: FB_RiskNote(risk), FB_RiskAuditTags(Repository, auditGuid, risk), Log bez id
    var el = bootElement(11037, { FB_RiskNote: ["risk"], FB_RiskAuditTags: ["Repository", "auditGuid", "risk"],
        Log: ["Repository", "msg"], FB_Main: ["Repository", "requestText"], EA_MenuClick: ["Repository", "MenuLocation", "ItemName"] });
    var r = runBootstrap({ rows: [{ id: 11037, guid: "{ADDIN-11037}", stereo: "JavascriptAddin", pkg: "EA Addins", el: el }], signals: BOOT_SIGNALS });
    eq(el._params("FB_RiskNote").join(","), "risk,baseline", "FB_RiskNote musi dostat parametr baseline: " + r.out.join("\n"));
    eq(el._params("FB_RiskAuditTags").join(","), "Repository,auditGuid,risk,baseline");
    eq(el._params("Log").join(","), "Repository,msg,id");
    eq(el._params("FB_Main").join(","), "Repository,requestText", "shodna signatura se nesaha");
    eq(el._params("EA_MenuClick").join(","), "Repository,MenuLocation,MenuName,ItemName", "reception dal podle EA_ARGS");
    ok(r.px.some(function (l) { return l == "PX  FB_RiskNote: (risk) -> (risk, baseline)"; }), "radek PX FB_RiskNote: " + r.px.join(" | "));
    ok(r.px.some(function (l) { return /^PX  Log: \(Repository, msg\) -> \(Repository, msg, id\)$/.test(l); }), "radek PX Log");
    ok(r.px.some(function (l) { return /^PX  EA_MenuClick -> parametry reception opraveny/.test(l); }), "radek PX reception (bod 5 beze zmeny)");
    contains(r.done, "Parametry: 3 operaci srovnano podle hlavicky (radky PX)", r.done);
    contains(r.done, "1 parametry opraveny", r.done);
    ok(r.out.some(function (l) { return /^POZOR: 3 operaci melo v modelu jiny seznam parametru/.test(l); }), "varovani POZOR s poctem");
    var files = fs.readdirSync(SRC).filter(function (f) { return /^AICodeBridge\..+\.js$/.test(f); }).length;
    contains(r.done, (files - 5) + " operaci zalozeno, " + files + " nahran kod", "chybejici operace zalozeny, kod vsude: " + r.done);
    // idempotence: druhy beh = 0 PX, 0 zalozeno
    var r2 = runBootstrap({ rows: [{ id: 11037, guid: "{ADDIN-11037}", stereo: "JavascriptAddin", pkg: "EA Addins", el: el }], signals: BOOT_SIGNALS });
    eq(r2.px.length, 0, "druhy beh nesmi nic srovnavat: " + r2.px.join(" | "));
    contains(r2.done, "0 operaci zalozeno"); contains(r2.done, "Parametry: 0 operaci srovnano");
    ok(!r2.out.some(function (l) { return /^POZOR/.test(l); }), "bez POZOR pri 0 srovnanych");
});
t("ITAN-Bootstrap mock: parametry se srovnavaji podle hlavicky KAZDE operace (zadny seznam SIG) - zamena poradi i nadbytecny parametr", function () {
    var el = bootElement(1, { FB_OpPing: ["op", "Repository"], FB_WriteScope: ["Repository"] });
    var r = runBootstrap({ rows: [{ id: 1, guid: "{ADDIN-1}", stereo: "JavascriptAddin", pkg: "P", el: el }], signals: BOOT_SIGNALS });
    eq(el._params("FB_OpPing").join(","), "Repository,op", "poradi podle hlavicky");
    eq(el._params("FB_WriteScope").join(","), "", "hlavicka bez parametru -> parametry odebrany");
    contains(r.done, "Parametry: 2 operaci srovnano");
});
t("ITAN-Bootstrap mock N-B-4: dva elementy AICodeBridge, jeden se stereotypem -> VAROVANI se seznamem (ElementID, stereotyp, package), kod jde do toho se stereotypem", function () {
    var good = bootElement(10, { FB_RiskNote: ["risk"] }), bad = bootElement(20, { FB_RiskNote: ["risk"] });
    var r = runBootstrap({ rows: [
        { id: 20, guid: "{ADDIN-20}", stereo: "", pkg: "Letni pozustatek", el: bad },
        { id: 10, guid: "{ADDIN-10}", stereo: "JavascriptAddin", pkg: "EA Addins", el: good }], signals: BOOT_SIGNALS });
    ok(r.out.some(function (l) { return /^VAROVANI: v modelu je 2 elementu jmenem AICodeBridge/.test(l); }), "varovani: " + r.out.slice(0, 6).join(" | "));
    ok(r.out.some(function (l) { return /ElementID 20, stereotyp '', package 'Letni pozustatek'.*ignorovan/.test(l); }), "radek o elementu bez stereotypu");
    ok(r.out.some(function (l) { return /ElementID 10, stereotyp 'JavascriptAddin', package 'EA Addins'.*CIL/.test(l); }), "radek o cili");
    eq(good._params("FB_RiskNote").join(","), "risk,baseline", "cil dostal parametry");
    eq(bad._params("FB_RiskNote").join(","), "risk", "element bez stereotypu se nesaha");
    ok(good.Methods.Count > 100 && bad.Methods.Count == 1, "kod jen do cile");
    ok(!r.out.some(function (l) { return /^STOP/.test(l); }), "jeden kandidat = zadny STOP");
});
t("ITAN-Bootstrap mock N-B-4: dva elementy se stereotypem JavascriptAddin -> STOP s vypisem, nic se nemeni", function () {
    var a = bootElement(10, { FB_RiskNote: ["risk"] }), b = bootElement(11, { FB_RiskNote: ["risk"] });
    var r = runBootstrap({ rows: [
        { id: 10, guid: "{ADDIN-10}", stereo: "JavascriptAddin", pkg: "EA Addins", el: a },
        { id: 11, guid: "{ADDIN-11}", stereo: "JavascriptAddin", pkg: "Jinde", el: b }], signals: BOOT_SIGNALS });
    ok(r.out.some(function (l) { return /^STOP: 2 elementy AICodeBridge se stereotypem JavascriptAddin/.test(l); }), "STOP: " + r.out.join(" | "));
    ok(r.out.some(function (l) { return /ElementID 11, stereotyp 'JavascriptAddin', package 'Jinde'/.test(l); }), "vypis obou");
    eq(r.done, "", "zadny souhrn Hotovo");
    eq(a.Methods.Count, 1); eq(b.Methods.Count, 1); eq(a._params("FB_RiskNote").join(","), "risk");
    eq(r.created, null, "nezaklada se novy element");
});
t("ITAN-Bootstrap mock: zadny element -> zalozi v oznacenem package (chovani beze zmeny)", function () {
    var r = runBootstrap({ rows: [], signals: BOOT_SIGNALS });
    ok(r.created != null, "element zalozen");
    ok(r.out.some(function (l) { return /ZALOZEN v package 'Add-Ins'/.test(l); }));
    eq(r.px.length, 0); contains(r.done, "Parametry: 0 operaci srovnano");
    eq(r.created._params("FB_RiskNote").join(","), "risk,baseline", "nova operace s parametry z hlavicky");
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
    var r2 = B.FB_OpQuery.call(B, supRepo(function () { return "<?xml version=\"1.0\"?><EADATA version=\"1.0\" exporter=\"Enterprise Architect\"></EADATA>"; }), { sql: "SELECT * FROM t_seclocks LIMIT 10" }); // v0.20: bez LIMIT/WHERE nad t_seclocks = E_SQL_UNBOUNDED (FB-PU-31)
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
    var r = B.FB_OpQuery.call(B, repo, { sql: "SELECT Name FROM t_object WHERE Object_Type = 'Class'" }); // v0.20: bez WHERE nad t_object = E_SQL_UNBOUNDED
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
t("BL-1 config: ostra dev politika ma sekci, validni, sessionBaseline off (auto nema v rezimu blacklist cil), mode report", function () {
    var c = B.FB_BaselineConfig.call(B, mkRepo());
    eq(c.valid, true, c.why); eq(c.present, true); eq(c.warnings.length, 0, c.warnings.join("; "));
    eq(c.cfg.sessionBaseline, "off"); eq(c.cfg.cleanup.mode, "report"); eq(c.cfg.requireRecoveryForUpdates, false);
});
t("BL-1 config / FB-CZ-25: sessionBaseline 'auto' se chova jako 'off' a kontrola konfigurace to ohlasi", function () {
    var c = withPolicy(polBase({ sessionBaseline: "auto" }), function () { return B.FB_BaselineConfig.call(B, mkRepo()); });
    eq(c.valid, true, c.why);
    eq(c.cfg.sessionBaseline, "off");
    ok(c.warnings.length === 1 && /auto/.test(c.warnings[0]) && /off/.test(c.warnings[0]), "warning o auto -> off: " + c.warnings.join("; "));
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
        { re: /COUNT\(\*\) AS c FROM t_diagram/i, rows: function (sql) {
            sqlLog.push(sql);
            if (opts.diagramCountFails) { return []; }
            var idsD = inList(sql, "Package_ID");
            var nD = M.dg.filter(function (d) { return idsD.indexOf(d[1]) >= 0; }).length
                + (opts.diagramsIn || []).filter(function (pid) { return idsD.indexOf(pid) >= 0; }).length;
            return [{ c: nD }];
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
        { re: /t_objectproperties/i, rows: function (sql) { var m = /Value = '([^']+)'/i.exec(sql); var d = (opts.dedupEl || {})[m ? m[1] : ""];
            return (d || []).map(function (pid) { return { Package_ID: pid }; }); } },
        { re: /t_connectortag/i, rows: function (sql) { var m = /VALUE = '([^']+)'/i.exec(sql); var d = (opts.dedupConn || {})[m ? m[1] : ""];
            return (d || []).map(function (oid) { return { Start_Object_ID: oid }; }); } },
        { re: /t_diagramobjects/i, rows: function () { return (opts.diagramObjPkgs || []).map(function (p) { return { Package_ID: p }; }); } },
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
var SCOPE_REPO_OPTS = { dedupEl: { "k-exist": [14], "k-dup": [11, 12] }, dedupConn: { "ck-exist": [102] }, diagramObjPkgs: [11, 14] };
function scopeOf(ops, cfgOver) {
    var cfg = B.FB_BaselineConfig.call(B, mkRepo()).cfg;
    for (var k in (cfgOver || {})) { cfg[k] = cfgOver[k]; }
    return B.FB_BaselinePolicy.call(B, blRepo(SCOPE_REPO_OPTS), { ops: ops }, null, cfg, regFull());
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
    ["connectors dedupKey existujici -> package SOURCE skutecneho konektoru (ne deklarovaneho source)", [{ op: "create_or_update_connectors", connectors: [{ source: 101, target: 104, dedupKey: "ck-exist" }] }], "12", false],
    ["connectors dedupKey neexistujici -> cisty create", [{ op: "create_or_update_connectors", connectors: [{ source: 102, target: 101, dedupKey: "ck-new" }] }], "", false],
    ["connectors match -> package SOURCE", [{ op: "create_or_update_connectors", connectors: [{ source: 102, target: 101, match: true }] }], "12", false],
    ["M1 elements dedupKey: prvek lezi JINDE nez deklarovany package -> package, kde opravdu je", [{ op: "create_or_update_elements", elements: [{ name: "n", "package": "{PK-11}", dedupKey: "k-exist" }] }], "14", false],
    ["M1 elements dedupKey neexistujici -> cisty create; nejednoznacny -> unknown", [{ op: "create_or_update_elements", elements: [{ name: "n", "package": "{PK-11}", dedupKey: "k-new" }] }], "", false],
    ["M1 elements dedupKey nejednoznacny -> unknown", [{ op: "create_or_update_elements", elements: [{ name: "n", "package": "{PK-11}", dedupKey: "k-dup" }] }], "", true],
    ["H1 create_or_update_diagram update pres guid / diagramID (aliasy FB_OpDiagram) -> package diagramu", [{ op: "create_or_update_diagram", diagrams: [{ guid: "{DG-201}", name: "n" }, { diagramID: 201, notes: "x" }] }], "12", false],
    ["H1 / B3: $N na diagram aktualizovany pres guid NENI vlastni -> pro zalohu balicek diagramu z definice predchozi operace (uz ne unknown)", [{ op: "create_or_update_diagram", diagrams: [{ guid: "{DG-201}", name: "n" }] }, { op: "layout_connectors", diagram: "$0" }], "12", false],
    ["M2 apply_classifier_stereotypes s elementIDs -> package diagramu + packages menenych prvku", [{ op: "apply_classifier_stereotypes", diagram: 201, elementIDs: [101, 104] }], "11,12,14", false],
    ["B3 (i) / FB-CZ-23: connectors update dle guid -> konce dohledany jednim SELECT, package SOURCE, rozsah znamy", [{ op: "create_or_update_connectors", connectors: [{ guid: "{CN-301}", name: "n" }] }], "11", false],
    ["B3 (i): connectors update dle neexistujiciho guid -> unknown", [{ op: "create_or_update_connectors", connectors: [{ guid: "{CN-999}", name: "n" }] }], "", true],
    ["attributes -> package rodice", [{ op: "create_or_update_attributes", element: 102, attributes: [{ name: "a" }] }], "12", false],
    ["operations bez parameters -> package rodice, nedestruktivni", [{ op: "create_or_update_operations", element: 103, operations: [{ name: "o" }] }], "13", false, function (sc) { eq(sc.destructive, false); }],
    ["operations s parameters -> destruktivni podtrida", [{ op: "create_or_update_operations", element: 103, operations: [{ name: "o", parameters: [{ name: "p" }] }] }], "13", false, function (sc) { eq(sc.destructive, true); }],
    ["T6-33 messages rebuild -> package DIAGRAMU (ne lifeliny), destruktivni", [{ op: "create_or_update_messages", diagram: 201, rebuild: true, messages: [{ source: 109, target: 101, name: "m", seqNo: 1 }] }], "12", false, function (sc) { eq(sc.destructive, true); }],
    ["messages bez rebuild -> package diagramu, nedestruktivni", [{ op: "create_or_update_messages", diagram: "{DG-201}", messages: [{ source: 109, target: 101, name: "m" }] }], "12", false, function (sc) { eq(sc.destructive, false); }],
    ["delete element -> vlastnici package", [{ op: "delete_from_model", targets: [{ type: "Element", id: 104 }] }], "14", false, function (sc) { eq(sc.destructive, true); }],
    ["T6-12 delete package -> RODIC", [{ op: "delete_from_model", targets: [{ type: "Package", guid: "{PK-13}" }] }], "11", false],
    ["T6-28 / FB-CZ-24: delete package, rodic (koren Model) pod prahem -> zaloha nad RODICEM i kdyz je to koren (whitelist zanikl)", [{ op: "delete_from_model", targets: [{ type: "Package", guid: WL_GUID }] }], "1", false, function (sc) { eq(sc.packages[0].parentOverThreshold, false); }],
    ["T6-28 / FB-CZ-24: delete package, rodic NAD prahem subtreeMax (i pri thresholdsShadow: true) -> package sam + parentOverThreshold", [{ op: "delete_from_model", targets: [{ type: "Package", guid: WL_GUID }] }], "10", false, function (sc) { eq(sc.packages[0].parentOverThreshold, true); }, { subtreeMax: 0, thresholdsShadow: true }],
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
    ["M2 apply_classifier_stereotypes bez filtru -> package diagramu + packages vsech objektu diagramu", [{ op: "apply_classifier_stereotypes", diagram: 201 }], "11,12,14", false],
    ["find_or_create_referencing_sr -> create", [{ op: "find_or_create_referencing_sr", targetPackage: "{PK-11}", name: "SR" }], "", false],
    ["deploy_src -> none", [{ op: "deploy_src", files: [] }], "", false],
    ["T6-27 $N na vysledek CTECI operace -> unknown", [{ op: "find_elements_by_name", name: "x" }, { op: "create_or_update_attributes", element: "$0", attributes: [{ name: "a" }] }], "", true],
    ["$N na CREATE vetev teto davky -> vlastni prvek, nic", [{ op: "create_or_update_elements", elements: [{ name: "n", "package": "{PK-11}" }] }, { op: "create_or_update_attributes", element: "$0", attributes: [{ name: "a" }] }], "", false],
    ["B3 (ii) / FB-CZ-23: $N na UPDATE vetev -> pro zalohu balicek cile predchozi operace (uz ne unknown)", [{ op: "create_or_update_elements", elements: [{ guid: "{EL-101}", name: "n" }] }, { op: "create_or_update_attributes", element: "$0", attributes: [{ name: "a" }] }], "11", false],
    ["B3 (ii): $N na UPDATE vetev s neznamym cilem (dedupKey nejednoznacny) -> unknown", [{ op: "create_or_update_elements", elements: [{ name: "n", "package": "{PK-11}", dedupKey: "k-dup" }] }, { op: "create_or_update_attributes", element: "$0", attributes: [{ name: "a" }] }], "", true],
    ["cteci operace se ignoruji", [{ op: "ping" }, { op: "query", sql: "SELECT 1" }], "", false]
].forEach(function (c) {
    t("BL-2 SCOPE: " + c[0], function () {
        var sc = scopeOf(c[1], c[5]);
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
t("BL-2 sonda B6 -> v0.20 FB-PU-33: soucet 0 nad existujici package S KANARKEM (koren ve vysledku, COUNT i diagramy vratily radek) = ok/0 (prazdny balicek), ne unknown", function () {
    var z1 = B.FB_SubtreeCount.call(B, blRepo(), 19, { probeBudgetMs: 500 }, 2000);
    eq(z1.status, "ok", z1.why); eq(z1.elements, 0); contains(z1.why, "prazdny balicek");
    var z2 = B.FB_SubtreeCount.call(B, blRepo({ countZero: true }), 11, { probeBudgetMs: 500 }, 2000);
    eq(z2.status, "ok", z2.why); eq(z2.elements, 0);
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
function runFile(repo, ops, id, extraTop) {
    delete B._fbAccessCache; delete B._fbPrevExc;
    var p = BL_BASE + "\\requests\\req-" + id + ".json";
    var body = { protocol: "eafb/0.2", id: id, repo: "EAEXAMPLE.QEA", ops: ops };
    if (extraTop) { for (var k in extraTop) { body[k] = extraTop[k]; } }
    memFs.files[p] = JSON.stringify(body);
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
        var tagged = null, oT = B.FB_RiskAuditTags; B.FB_RiskAuditTags = function (R, g, risk, bl) { tagged = bl; return ""; };
        var r3;
        try { r3 = confirmFile(repo, r2, "t610", true); } finally { B.FB_RiskAuditTags = oT; }
        ok(tagged && tagged.decision == "skipped", "audit dostava sekci baseline s decision (tag ai.baseline)");
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
t("BL-3 T6-14 (N-E2E-7, 2026-10-11): ELEVATED potvrzena -> baseline az PO potvrzeni; FB-AUTO TEZE session se pouzije bez ohledu na stari (reuse session); z jine session jen v okne freshWithinMin", function () {
    blReset(); var repo = blRepo({ login: "jnovak" });
    var oD = B.FB_OpDelete; B.FB_OpDelete = function () { return { op: "delete_from_model", status: "ok", items: [] }; };
    try {
        var tok = B.FB_SessionToken.call(B, repo, null).token;
        // FB-AUTO JINE session (token s99990101-9), 40 min stara -> ELEVATED ji NEpouzije (mimo freshWithinMin)
        repo._addBaseline("{PK-14}", B.FB_BaselineName.call(B, "format", "FB-AUTO ", "jnovak", "s99990101-9", new Date().getTime() - 40 * 60000, false), 40);
        var r = runFile(repo, DEL_C, "t614");
        eq(repo._createCalls, 0, "pred potvrzenim nic");
        var atOp = -1; B.FB_OpDelete = function () { atOp = repo._createCalls; return { op: "delete_from_model", status: "ok", items: [] }; };
        var r2 = confirmFile(repo, r, "t614", true);
        eq(atOp, 1, "v okamziku prvni zapisove operace uz baseline existuje (a vznikla az po potvrzeni)");
        eq(r2.baseline.decision, "created"); eq(autoNames(repo, "{PK-14}").length, 2);
        ok(typeof r2.baseline.elapsedMs == "number");
        // druha ELEVATED davka hned potom -> reuse (tataz session ma prednost pred freshWithinMin)
        var r3 = runFile(repo, DEL_C, "t614b");
        var r4 = confirmFile(repo, r3, "t614b", true);
        eq(r4.baseline.decision, "reused"); eq(r4.baseline.reason, "reuse session"); eq(autoNames(repo, "{PK-14}").length, 2);
    } finally { B.FB_OpDelete = oD; }
});
t("BL-3 N-E2E-7: ELEVATED po > 15 min v TEZE session = reused (reuse session), zadna nova FB-AUTO; freshWithinMin zustava stropem jen pro zalohu jine session", function () {
    blReset(); var repo = blRepo({ login: "jnovak" });
    var oD = B.FB_OpDelete; B.FB_OpDelete = function () { return { op: "delete_from_model", status: "ok", items: [] }; };
    try {
        var tok = B.FB_SessionToken.call(B, repo, null).token;
        // tataz session, 40 min stara (den prace 11. 10.: R2 11:42 -> R8 12:01 vyrobilo druhou zalohu)
        repo._addBaseline("{PK-14}", B.FB_BaselineName.call(B, "format", "FB-AUTO ", "jnovak", tok, new Date().getTime() - 40 * 60000, false), 40);
        var r = runFile(repo, DEL_C, "t6e7");
        var r2 = confirmFile(repo, r, "t6e7", true);
        eq(r2.baseline.decision, "reused"); eq(r2.baseline.reason, "reuse session");
        eq(autoNames(repo, "{PK-14}").length, 1, "zadna nova FB-AUTO nad tymz balickem v teze session");
        // jina session, 10 min stara -> reuse freshWithinMin (strop plati dal)
        blReset(); var repoB = blRepo({ login: "jnovak" });
        B.FB_SessionToken.call(B, repoB, null);
        repoB._addBaseline("{PK-14}", B.FB_BaselineName.call(B, "format", "FB-AUTO ", "jnovak", "s99990101-9", new Date().getTime() - 10 * 60000, false), 10);
        var rb = runFile(repoB, DEL_C, "t6e7b");
        var rb2 = confirmFile(repoB, rb, "t6e7b", true);
        eq(rb2.baseline.decision, "reused"); eq(rb2.baseline.reason, "reuse freshWithinMin");
        // LOW vetev beze zmeny: tataz session -> reuse session (regrese T6-6)
        blReset(); var repoC = blRepo({ login: "jnovak" });
        var tokC = B.FB_SessionToken.call(B, repoC, null).token;
        repoC._addBaseline("{PK-13}", B.FB_BaselineName.call(B, "format", "FB-AUTO ", "jnovak", tokC, new Date().getTime() - 40 * 60000, false), 40);
        var rc = runText(repoC, UPD_A1, "t6e7c");
        eq(rc.baseline.decision, "reused"); eq(rc.baseline.reason, "reuse session");
    } finally { B.FB_OpDelete = oD; }
});
t("BL-3 T6-15: CreateBaseline vraci false / hazi / FB_CheckWrite odmitne -> E_NO_BASELINE terminalne, bez confirm, nic zapsano", function () {
    var opCalls = 0, oEl = B.FB_OpElements; B.FB_OpElements = function () { opCalls++; return { op: "create_or_update_elements", status: "ok", items: [] }; };
    [{ createFalse: true }, { createThrows: true }].forEach(function (o) {
        blReset(); var repo = blRepo(o);
        var r = runText(repo, UPD_A1);
        eq(opCalls, 0, "operace se nesmi zavolat");
        eq(r.code, "E_NO_BASELINE", JSON.stringify(o)); eq(r.status, "error"); eq(r.results[0].status, "skipped");
        ok(!r.confirm); eq(r.baseline.decision, "failed");
    });
    blReset(); var repo2 = blRepo();
    var oC = B.FB_CheckWrite; B.FB_CheckWrite = function () { return { code: "E_WHITELIST", message: "mimo whitelist" }; };
    try { var r2 = runText(repo2, UPD_A1); eq(r2.code, "E_NO_BASELINE"); contains(r2.message, "E_WHITELIST"); eq(repo2._createCalls, 0); eq(opCalls, 0); }
    finally { B.FB_CheckWrite = oC; B.FB_OpElements = oEl; }
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
t("BL-3 T6-26 / H2: matchByName na EXISTUJICI prvek ve velke package -> projde PO POTVRZENI (nikdy tise, nikdy E_NO_BASELINE), vykazuje updatedExistingApprox", function () {
    blReset(); var repo = blRepo({ mult: 9000 });
    var calls = 0, oE = B.FB_OpElements; B.FB_OpElements = function () { calls++; return { op: "create_or_update_elements", status: "ok", items: [] }; };
    try {
        withPolicy(polBase({ thresholdsShadow: false, requireRecoveryForUpdates: true }), function () {
            var r = runFile(repo, [{ op: "create_or_update_elements", elements: [{ name: "ElA", type: "Class", "package": "{PK-11}", matchByName: true, notes: "prepis" }] }], "t626");
            eq(r.status, "confirm_required", "bez pre-image nikdy bez dialogu: " + JSON.stringify(r).substring(0, 300)); eq(calls, 0);
            contains(r.risk.riskReasons.join("; "), "match/dedupKey"); eq(r.baseline.updatedExistingApprox, 1);
            var r2 = confirmFile(repo, r, "t626", true);
            eq(r2.status, "done", JSON.stringify(r2).substring(0, 300)); ok(r2.code != "E_NO_BASELINE"); eq(calls, 1);
            eq(r2.baseline.decision, "none"); contains(r2.baseline.reason, "updatedExistingApprox"); eq(repo._createCalls, 0);
        });
    } finally { B.FB_OpElements = oE; }
});
t("BL-3 T6-26b: dedupKey, ktery v modelu NEEXISTUJE -> skutecny create, bez dialogu a bez zalohy", function () {
    blReset(); var repo = blRepo({ mult: 9000 });
    withPolicy(polBase({ thresholdsShadow: false, requireRecoveryForUpdates: true }), function () {
        var r = runText(repo, [{ op: "create_or_update_elements", elements: [{ name: "Retry", type: "Class", "package": "{PK-11}", dedupKey: "k1" }] }]);
        ok(r.status != "confirm_required" && r.code != "E_NO_BASELINE", JSON.stringify(r).substring(0, 300)); eq(r.baseline.decision, "none");
    });
});
t("BL-3 T6-27 / FB-CZ-23: $N na vysledek CTECI operace -> velikost neznama (navadena cesta), nikdy cisty create; bez dohledaneho cile rada 'baselineRoot', nikdy E_NO_BASELINE", function () {
    blReset(); var repo = blRepo();
    var r = runFile(repo, [{ op: "find_elements_by_name", name: "ElA" }, { op: "create_or_update_attributes", element: "$0", attributes: [{ name: "a" }] }], "t627");
    eq(r.status, "confirm_required", JSON.stringify(r).substring(0, 300)); eq(r.baseline.action, "guided"); ok(r.baseline.reason.indexOf("cisty create") < 0);
    contains(r.baseline.manual.missing.join(";"), "baselineRoot", "bez dohledaneho cile: rada uvest baselineRoot (B3)");
});
t("BL-3 FB-CZ-23 (B3 iii-v): neznamy rozsah s dohledanymi cili -> navadena cesta nad NEJBLIZSIM SPOLECNYM PREDKEM (rucni baseline nad nim ji splni)", function () {
    blReset(); var repo = blRepo({ dedupEl: { "k-dup": [11, 12] } });
    // nejednoznacny dedupKey (k-dup) + update prvku v A1 (13) a B (12): spolecny predek = #FB-TEST (10)
    var ops = [{ op: "create_or_update_elements", elements: [{ name: "n", type: "Class", "package": "{PK-11}", dedupKey: "k-dup" }, { guid: "{EL-103}", name: "x" }, { guid: "{EL-102}", name: "y" }] }];
    var r = runFile(repo, ops, "t623a");
    eq(r.status, "confirm_required", JSON.stringify(r).substring(0, 300)); eq(r.baseline.action, "guided");
    contains(r.baseline.manual.missing.join(";"), "Model.#FB-TEST", "rada: rucni baseline nad spolecnym predkem");
    contains(r.baseline.manual.missing.join(";"), "spolecny predek");
    repo._addBaseline(WL_GUID, "rucni pred davkou", 1);
    var r2 = runFile(repo, ops, "t623b");
    eq(r2.status, "confirm_required"); eq(r2.baseline.manual.ok, true, JSON.stringify(r2.baseline.manual));
    contains(r2.baseline.manual.found.join(";"), "rucni pred davkou nad Model.#FB-TEST");
});
t("BL-3 FB-CZ-23 (B3): neznamy rozsah bez dohledaneho cile + pole davky baselineRoot -> navadena cesta nad baselineRoot; baselineRoot v chranene casti = E_BLACKLIST", function () {
    blReset(); var repo = blRepo();
    repo._addBaseline("{PK-11}", "rucni nad A", 1);
    var ops = [{ op: "find_elements_by_name", name: "ElA" }, { op: "create_or_update_attributes", element: "$0", attributes: [{ name: "a" }] }];
    var r = runFile(repo, ops, "t623c", { baselineRoot: "{PK-11}" });
    eq(r.status, "confirm_required", JSON.stringify(r).substring(0, 300));
    eq(r.baseline.manual.ok, true, JSON.stringify(r.baseline.manual));
    contains(r.baseline.manual.found.join(";"), "baselineRoot z davky");
    var rb = withScope([{ repo: "EAEXAMPLE.QEA", blacklist: [{ pkg: "{PK-11}", name: "A", note: "t" }] }], function () { return runFile(repo, ops, "t623d", { baselineRoot: "{PK-11}" }); });
    eq(rb.code, "E_BLACKLIST", JSON.stringify(rb).substring(0, 300));
});
t("BL-3 FB-CZ-26: coveredBy najde rucni baseline nad KORENEM modelu (ochrana uzlu korene hledani nezastavi)", function () {
    blReset(); var repo = blRepo({ dedupEl: { "k-dup": [11, 12] } });
    repo._addBaseline("{PK-1}", "rucni nad korenem", 1);
    var ops = [{ op: "create_or_update_elements", elements: [{ name: "n", type: "Class", "package": "{PK-11}", dedupKey: "k-dup" }, { guid: "{EL-103}", name: "x" }] }];
    var r = runFile(repo, ops, "t626");
    eq(r.status, "confirm_required", JSON.stringify(r).substring(0, 300)); eq(r.baseline.action, "guided");
    eq(r.baseline.manual.ok, true, JSON.stringify(r.baseline.manual));
    contains(r.baseline.manual.found.join(";"), "nad Model");
});
t("BL-3 T6-28 / FB-CZ-24: delete package s rodicem NAD prahem (i pri thresholdsShadow: true) -> povinne confirm s vysvetlenim, baseline nad package samym; rodic pod prahem -> baseline nad rodicem (korenem)", function () {
    blReset(); var repo = blRepo();
    var oD = B.FB_OpDelete; B.FB_OpDelete = function () { return { op: "delete_from_model", status: "ok", items: [] }; };
    try {
        var r = withPolicy(polBase({ subtreeMax: 0, thresholdsShadow: true }), function () {
            return runFile(repo, [{ op: "delete_from_model", targets: [{ type: "Package", guid: WL_GUID }] }], "t628");
        });
        eq(r.status, "confirm_required", JSON.stringify(r).substring(0, 300)); contains(r.risk.riskReasons.join("; "), "parentOverThreshold");
        contains("" + B.FB_ConfirmSummary.call(B, r), "ZANIKNE");
        var r2 = withPolicy(polBase({ subtreeMax: 0, thresholdsShadow: true }), function () { return confirmFile(repo, r, "t628", true); });
        eq(r2.status, "done", JSON.stringify(r2).substring(0, 300)); eq(autoNames(repo, WL_GUID).length, 1);
        // rodic (koren Model) pod prahem -> zaloha nad rodicem, zadne varovani ZANIKNE
        blReset(); var repoB = blRepo();
        var rB = runFile(repoB, [{ op: "delete_from_model", targets: [{ type: "Package", guid: WL_GUID }] }], "t628b");
        eq(rB.status, "confirm_required"); ok(rB.risk.riskReasons.join("; ").indexOf("parentOverThreshold") < 0, "rodic pod prahem nesmi varovat");
        eq(rB.baseline.packages[0].path, "Model", "zaloha nad rodicem = korenem modelu");
        // rodic s NEZNAMOU velikosti = jako nad prahem
        blReset(); var repoC = blRepo({ countFails: true });
        var rC = runFile(repoC, [{ op: "delete_from_model", targets: [{ type: "Package", guid: WL_GUID }] }], "t628c");
        eq(rC.status, "confirm_required", JSON.stringify(rC).substring(0, 300));
        eq(rC.baseline.packages[0].path, "Model.#FB-TEST", "neznama velikost rodice = jako nad prahem: zaloha nad mazanym balickem samym");
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
t("BL-3 E_NO_BASELINE: vsechny adaptery vcetne pump.wsf radi soubor do rejected; chat ACK nerika 'rozdel davku'", function () {
    var pump = fs.readFileSync(path.join(SRC, "..", "pump.wsf"), "utf8");
    ok(/rejected = [\s\S]{0,400}E_NO_BASELINE/.test(pump), "pump.wsf: E_NO_BASELINE chybi ve vyrazu rejected");
    contains(pump, "rucni baseline stale chybi");
    contains(fs.readFileSync(path.join(SRC, "AICodeBridge.FB_Main.js"), "utf8"), "rucni baseline stale chybi", "kotva, kterou pumpa hleda, musi byt ve FB_Main");
    ["AICodeBridge.FB_Process.js", "AICodeBridge.FB_ClipboardImport.js", "AICodeBridge.FB_ProcessFolder.js", "AICodeBridge.FB_ConfirmPending.js"].forEach(function (f) {
        contains(fs.readFileSync(path.join(SRC, f), "utf8"), "E_NO_BASELINE", f);
    });
    var ack = "" + B.FB_ChatRender.call(B, { id: "x", status: "error", code: "E_NO_BASELINE", message: "m", baseline: { reason: "nad prahem" }, results: [] });
    contains(ack, "E_NO_BASELINE"); contains(ack, "NEDEL");
});
t("CZ-20b schranka bez BOM: clip.exe fallback zapisuje UTF-16LE od pozice 2 v obou kanalech (kontext vyberu i chat ACK; zive 12. 10.)", function () {
    ["AICodeBridge.FB_ClipboardContext.js", "AICodeBridge.FB_ClipboardImport.js"].forEach(function (f) {
        var src = fs.readFileSync(path.join(SRC, f), "utf8");
        contains(src, "st.Position = 0; st.Type = 1; st.Position = 2;", f + ": chybi preskoceni BOM");
        contains(src, "bin.SaveToFile(tmp, 2)", f + ": ulozit se ma binarni kopie bez BOM");
        ok(!/st\.SaveToFile\(tmp/.test(src), f + ": textovy stream s BOM se nesmi ukladat primo");
    });
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
t("BL-3 T6-2 SessionStart 'off': zadna baseline; hlaseni nese identitu repa, rezim blacklist a chranene vetve (cil zapisu kap. 5.11)", function () {
    blReset(); var repo = blRepo();
    var out = withPolicy(polBase({ sessionBaseline: "off" }), function () {
        return withScope([{ repo: "EAEXAMPLE.QEA", blacklist: [{ pkg: "{PK-14}", name: "C", note: "test" }] }], function () { return "" + B.FB_SessionStart.call(B, repo); });
    });
    eq(repo._createCalls, 0); contains(out, "EAEXAMPLE.QEA"); contains(out, "Zapis: blacklist (1 chranenych vetvi)"); contains(out, "Model.#FB-TEST.C [test]");
    contains(out, "az pred prvnim zapisem"); ok(out.indexOf("whitelist") < 0, "slovo whitelist v hlaseni uz neni");
});
t("BL-3 T6-3 / FB-CZ-25: SessionStart 'auto' -> zadna session baseline (auto se chova jako off) a hlaseni to rekne", function () {
    blReset(); var repo = blRepo({ mult: 1000 });
    var out = withPolicy(polBase({ sessionBaseline: "auto" }), function () { return "" + B.FB_SessionStart.call(B, repo); });
    eq(repo._createCalls, 0); contains(out, "chova se jako 'off'"); contains(out, "Session baseline se nedela");
    blReset(); var repo2 = blRepo();
    var out2 = withPolicy(polBase({ sessionBaseline: "auto" }), function () { return "" + B.FB_SessionStart.call(B, repo2); });
    eq(repo2._createCalls, 0, "ani pod prahem se session baseline nevyrabi"); eq(autoNames(repo2, WL_GUID).length, 0);
    ok(out2.indexOf("vytvorena nad") < 0);
});
t("BL-3 I4 SessionStart: repo bez polozky FB_WriteScope -> varovani E_REPO (z identity)", function () {
    blReset();
    var repo = mkRepo({ connectionString: "C:\\X\\JINY.QEA" });
    var out = "" + B.FB_SessionStart.call(B, repo);
    contains(out, "nema polozku ve FB_WriteScope"); contains(out, "E_REPO");
});
t("BL-3 / FB-CZ-05a FB-CZ-02: SessionStart s vadnou konfiguraci (GUID blacklistu v modelu neni) -> hlaseni CHYBA konfigurace E_SCOPE_CONFIG; zapis E_SCOPE_CONFIG, cteni bezi", function () {
    blReset(); var repo = blRepo();
    var out = withScope([{ repo: "EAEXAMPLE.QEA", blacklist: [{ pkg: "{PK-NENI}", name: "Neni", note: "t" }] }], function () { return "" + B.FB_SessionStart.call(B, repo); });
    contains(out, "E_SCOPE_CONFIG"); contains(out, "{PK-NENI}");
    var r = withScope([{ repo: "EAEXAMPLE.QEA", blacklist: [{ pkg: "{PK-NENI}", name: "Neni", note: "t" }] }], function () {
        return runFile(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": "{PK-11}" }] }], "tscfg");
    });
    eq(r.code, "E_SCOPE_CONFIG", JSON.stringify(r).substring(0, 300)); eq(r.results[0].status, "skipped");
    ok(r.problems && r.problems.length >= 1 && /PK-NENI/.test(r.problems[0].message), "seznam vad v problems[]");
    ok(r.audit && typeof r.audit.aiLogGuid == "string", "E_SCOPE_CONFIG se audituje");
    var rr = withScope([{ repo: "EAEXAMPLE.QEA", blacklist: [{ pkg: "{PK-NENI}", name: "Neni", note: "t" }] }], function () {
        return runFile(repo, [{ op: "query", sql: "SELECT 1 AS x" }], "tscfg-r");
    });
    eq(rr.status, "done", "cteni bezi i s vadnou konfiguraci: " + JSON.stringify(rr).substring(0, 200));
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
        pi.GetBaselines = function (x) { var all = g(x).match(/version="FB-AUTO [^"]*"/g); return g(x).replace(all[all.length - 1], 'version="Prejmenovano rucne"'); };
        return pi;
    };
    var r = B.FB_BaselineCleanup.call(B, repo, clCfg(), "delete", true);
    eq(r.failed.length, 1); contains(r.failed[0].why, "GetBaselines"); eq(r.deleted.length, 2);
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
t("BL-5 T6-32 (harness verze pres FB_Main - hrdlo vsech kanalu vcetne schranky; schrankovy kanal sam = zivy beh -7): dve zapisove davky za sebou -> uklid PRAVE jednou; po okne znovu", function () {
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

// ===========================================================================
// BASELINE POLITIKA - opravy z nezavisle oponentury 2026-09-20 (H1, M3, L3)
// ===========================================================================
t("BL-R H1 gate: create_or_update_diagram s guid / diagramID = UPDATE ciziho diagramu (ne create) -> ELEVATED, zaloha package diagramu", function () {
    blReset(); var repo = blRepo();
    var g = B.FB_RiskGate.call(B, repo, { ops: [{ op: "create_or_update_diagram", diagrams: [{ guid: "{DG-201}", "package": "{PK-12}", name: "X" }] }] }, regFull());
    eq(g.metrics.updatedExisting, 1); eq(g.metrics.createOps, 0); eq(g.metrics.affectedDiagrams, 1); eq(g.riskLevel, "ELEVATED");
    var oD = B.FB_OpDiagram; B.FB_OpDiagram = function () { return { op: "create_or_update_diagram", status: "ok", items: [] }; };
    try {
        var r = runFile(repo, [{ op: "create_or_update_diagram", diagrams: [{ diagramID: 201, notes: "prepis" }] }], "th1");
        eq(r.status, "confirm_required"); ok(r.baseline.reason != "cisty create", "nikdy falesne 'cisty create'");
        var r2 = confirmFile(repo, r, "th1", true);
        eq(r2.baseline.decision, "created"); eq(autoNames(repo, "{PK-12}").length, 1);
    } finally { B.FB_OpDiagram = oD; }
});
t("BL-R M3: keepLastK < 1 nebo necele = nevalidni politika VZDY (i pri mode report); uklid drzi podlahu 1 i kdyby dostal 0", function () {
    [{ keepLastK: 0, maxAgeDays: 14 }, { keepLastK: 2.5, maxAgeDays: 14 }].forEach(function (c) {
        eq(withPolicy(polBase({ cleanup: c }), function () { return B.FB_BaselineConfig.call(B, mkRepo()).valid; }), false, JSON.stringify(c));
    });
    blReset(); var repo = clRepo(six());
    var r = B.FB_BaselineCleanup.call(B, repo, clCfg({ keepLastK: 0 }), "delete", true);
    eq(r.deleted.length, 5); eq(repo._countBaselines(), 1, "posledni pre-image dvojice (package, uzivatel) zustava vzdy");
});
t("BL-R M3 menu: nevalidni politika -> jen ukazat, mazani vypnute", function () {
    blReset(); var repo = clRepo(six());
    var oP = Session.Prompt, asked = [], shown = "";
    Session.Prompt = function (m, kind) { asked.push(kind); shown = "" + m; return 3; };
    try {
        withPolicy(polBase({ cleanup: { mode: "report", keepLastK: 0, maxAgeDays: 14 } }), function () {
            B.EA_MenuClick.call(B, repo, "TreeView", "-AI Bridge", "Uklid automatickych baselines (ukazat / provest)");
        });
    } finally { Session.Prompt = oP; }
    eq(repo._deleteCalls, 0); eq(asked.join(","), "0"); contains(shown, "nevalidni");
});
t("BL-R L3: jmeno rucni baseline s XML entitami (&, uvozovky) se v navadene ceste sparuje s t_document", function () {
    blReset(); var repo = blRepo({ mult: 9000 });
    var b = repo._addBaseline("{PK-13}", "Pred R&D upravou", 2);
    var realGet = repo.GetProjectInterface;
    repo.GetProjectInterface = function () { var pi = realGet(); var g = pi.GetBaselines;
        pi.GetBaselines = function (x) { return g(x).replace("Pred R&D upravou", "Pred R&amp;D upravou"); }; return pi; };
    withPolicy(polBase({ thresholdsShadow: false }), function () {
        var r = runFile(repo, UPD_A1, "tl3");
        eq(r.baseline.manual.ok, true, JSON.stringify(r.baseline.manual));
    });
});

// ===========================================================================
// FB-PU-01 (revize usability pumpy 2026-10-04 kap. 3.1; zive doma 2026-10-10,
// docs/e2e-nasazeni/VYSLEDKY-2026-10-10.md): bootstrap do 2026-10-10 u
// existujici operace prepsal jen Code a parametry nechal. Pumpa i EA runtime
// skladaji funkci ze seznamu parametru v MODELU (pump.wsf Code loader), takze
// FB_RiskNote nasazena nad prvek v0.14 bezela jako function(risk) a telo
// `if (baseline)` padlo "Objekt baseline neni definovan" AZ PO provedeni
// zapisu (prvky v modelu, audit chybi, davka v rejected\).
// Test: zkompilovat FB_RiskNote / FB_RiskAuditTags PRESNE tak, jak je pumpa
// sestavi z modelu po bankovnim bootstrapu (seznam parametru z tagu v0.14),
// a pustit pres FB_Main LOW zapis - bez opravy (typeof) musi spadnout,
// s opravou projit vcetne auditu.
// ===========================================================================
var V014_ARGS = { FB_RiskNote: ["risk"], FB_RiskAuditTags: ["Repository", "auditGuid", "risk"] };
function srcOf(name) { return fs.readFileSync(path.join(SRC, "AICodeBridge." + name + ".js"), "utf8").replace(/^﻿/, ""); }
function withModelSignatures(args, patch, fn) {
    // args = { operace: [parametry v modelu] }; patch = volitelna uprava zdroje (negativni dukaz)
    var orig = {};
    for (var k in args) {
        orig[k] = B[k];
        var code = srcOf(k);
        if (patch) { code = patch(k, code); }
        B[k] = Function.apply(null, args[k].concat([code]));
    }
    try { return fn(); } finally { for (var k2 in orig) { B[k2] = orig[k2]; } }
}
function lowWriteWithAudit(id, holder) {
    blReset(); delete B._fbAccessCache; delete B._fbPrevExc;
    var repo = blRepo();
    var aud = repo._addPackage({ id: 900, name: "#AI-LOG", guid: "{AUDIT-PU01}" });
    if (holder) { holder.repo = repo; holder.audit = aud; holder.target = repo.GetPackageByGuid("{PK-11}"); }
    var origCfg = B.FB_Config;
    B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", auditPkg: "{AUDIT-PU01}" }]; };
    try {
        var out = B.FB_Main.call(B, repo, JSON.stringify({ protocol: "eafb/0.2", id: id, repo: "EAEXAMPLE.QEA",
            ops: [{ op: "create_or_update_elements", elements: [{ name: "FBT Nasazeni prvek 1", type: "Class", "package": "{PK-11}" }] }] }));
        return { resp: JSON.parse(out), audit: aud, repo: repo };
    } finally { B.FB_Config = origCfg; }
}
t("FB-PU-01: FB_RiskNote/FB_RiskAuditTags se signaturou z modelu v0.14 (bez baseline) -> LOW zapis projde a audit vznikne (typeof)", function () {
    var r = withModelSignatures(V014_ARGS, null, function () { return lowWriteWithAudit("pu01-fix"); });
    eq(r.resp.status, "done", JSON.stringify(r.resp).substring(0, 300));
    eq(r.resp.results[0].status, "ok");
    eq(r.audit.Elements.Count, 1, "audit Artifact v #AI-LOG musi vzniknout i se starou signaturou");
    ok(/risk=LOW/.test("" + r.audit.Elements.GetAt(0).Notes), "Notes auditu nesou riskovy souhrn: " + r.audit.Elements.GetAt(0).Notes);
});
t("FB-PU-01 dukaz pasti: telo, ktere cte baseline PRIMO (stav cf88594), se signaturou v0.14 spadne az po provedeni zapisu - prvek v modelu je, audit chybi", function () {
    var noTypeof = function (name, code) {
        var fixed = 'var bl = (typeof baseline != "undefined") ? baseline : null;';
        ok(code.indexOf(fixed) >= 0, name + ": oprava (typeof) ve zdroji chybi");
        return code.replace(fixed, "var bl = baseline;");
    };
    var failed = null, r = null, h = {};
    try { r = withModelSignatures(V014_ARGS, noTypeof, function () { return lowWriteWithAudit("pu01-past", h); }); }
    catch (e) { failed = e; }
    if (failed) {
        // pumpa z teto vyjimky dela E_EXCEPTION (res bez id, protokol eafb/0.1) a davku odlozi do rejected\
        ok(/baseline/.test("" + failed.message), "ocekavan pad na nedefinovane baseline: " + failed.message);
    } else {
        ok(r.resp.status != "done", "bez typeof nesmi projit cisty done: " + JSON.stringify(r.resp).substring(0, 200));
    }
    eq(h.target.Elements.Count, 1, "zapis uz PROBEHL (prvek v modelu je) - pad prisel az v souhrnu");
    eq(h.audit.Elements.Count, 0, "audit v #AI-LOG CHYBI - to je ta past (zive 2026-10-10: res-nas-03-low-zapis.json + res-nas-05-kontrola-prvku.json)");
});
t("FB-PU-01 pravidlo (PROTOKOL-EAFB kap. 11): parametr baseline pribyly po v0.14 se v FB_RiskNote a FB_RiskAuditTags cte JEN pres typeof", function () {
    ["FB_RiskNote", "FB_RiskAuditTags"].forEach(function (name) {
        var code = srcOf(name).split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join("\n")
            .replace(/"[^"]*"/g, '""');                       // retezce (" | baseline=", "ai.baseline") pryc
        var direct = code.replace(/typeof\s+baseline\b/g, "").replace(/\?\s*baseline\s*:/g, "");
        ok(!/\bbaseline\b/.test(direct), name + ": prime cteni parametru baseline mimo typeof: " + (/.*\bbaseline\b.*/.exec(direct) || [""])[0]);
    });
});

// --- tools/diff-signatures.py (2026-10-10, FB-PU-01 bod 5): pred kazdym tagem vypsat operace se zmenenym
// seznamem parametru. Test ho spusti nad v0.14..HEAD; bez pythonu nebo bez tagu v klonu jen varuje (bankovni
// korporatni repo tagy nemusi mit) - nastroj je pro vydani doma.
t("tools/diff-signatures.py: v0.14 -> HEAD vypise jen operace se zmenenym seznamem parametru (FB_RiskNote, FB_RiskAuditTags) a vraci exit 1; --json strojove", function () {
    var cp = require("child_process");
    var root = path.join(__dirname, "..");
    // na mountu Cowork trva git ~80 s na beh -> HARNESS_SKIP_DIFFSIG=1 test preskoci (nastroj se pak pousti zvlast)
    if (process.env.HARNESS_SKIP_DIFFSIG) { console.log("  (preskoceno: HARNESS_SKIP_DIFFSIG - spust python tools/diff-signatures.py v0.14 HEAD zvlast)"); return; }
    var tagOk = cp.spawnSync("git", ["-c", "core.quotepath=off", "rev-parse", "-q", "--verify", "v0.14^{commit}"], { cwd: root, env: Object.assign({}, process.env, { GIT_OPTIONAL_LOCKS: "0" }) });
    if (tagOk.error || tagOk.status !== 0) { console.log("  (preskoceno: git nebo tag v0.14 v tomto klonu neni - diff-signatures je nastroj pro vydani doma)"); return; }
    var run = null, pyExe = "";
    ["python", "python3", "py"].some(function (exe) {
        var r = cp.spawnSync(exe, [path.join(root, "tools", "diff-signatures.py"), "v0.14", "HEAD", "--json"], { cwd: root, encoding: "utf8", env: Object.assign({}, process.env, { GIT_OPTIONAL_LOCKS: "0" }) });
        if (r.error || r.status === null) { return false; }
        run = r; pyExe = exe; return true;
    });
    if (!run) { console.log("  (preskoceno: python neni v PATH)"); return; }
    ok(run.status === 1, "exit 1 = zmeny signatur existujicich operaci; stdout: " + run.stdout + " stderr: " + run.stderr);
    var j = JSON.parse(run.stdout.replace(/^\uFEFF/, ""));
    var changed = j.changed.map(function (c) { return c.op + ":" + c.old.join(",") + "->" + c.new.join(","); }).sort();
    eq(changed.join(" | "), "FB_RiskAuditTags:Repository,auditGuid,risk->Repository,auditGuid,risk,baseline | FB_RiskNote:risk->risk,baseline");
    ok(j.added.some(function (a) { return a.op == "FB_AutoBaseline"; }), "nove soubory od v0.14 jsou v 'added', ne ve 'changed'");
    eq(j.removed.length, 0);
    // kazda zmenena operace musi novy parametr cist pres typeof (pravidlo kap. 11) - kontrola nad zdrojem
    j.changed.forEach(function (c) {
        var code = srcOf(c.op);
        c.new.slice(c.old.length).forEach(function (pn) {
            ok(new RegExp("typeof\\s+" + pn + "\\s*!=\\s*\"undefined\"").test(code), c.op + ": novy parametr " + pn + " se musi cist pres typeof");
        });
    });
    // citelny vystup bez --json
    var txt = cp.spawnSync(pyExe, [path.join(root, "tools", "diff-signatures.py"), "v0.14", "HEAD"], { cwd: root, encoding: "utf8", env: Object.assign({}, process.env, { GIT_OPTIONAL_LOCKS: "0" }) });
    contains(txt.stdout, "FB_RiskNote: (risk) -> (risk, baseline)");
    contains(txt.stdout, "Zmenene signatury existujicich operaci: 2");
});

// ===========================================================================
// BALIK B1 - SMYCKA AGENT <-> PUMPA (Z261004b-3, 2026-10-11): P1 stavovy
// zaznam, P2 predbezna kontrola, P3 cekajici davka, pravidla 3/6/7 KONCEPCE,
// FB-PU-06/-35, N-E2E-3/-7, simulace V1/V3/S1/S5 z revize kap. 7.2,
// invarianty pravidla 8.
// ===========================================================================
var B1_BASE = "C:\\HARNESS\\EA-File-Bridge";
var B1_REQ = B1_BASE + "\\requests", B1_PEND = B1_REQ + "\\pending", B1_RES = B1_BASE + "\\responses";
function b1Reset() { blReset(); delete B._fbAccessCache; delete B._fbPrevExc; delete B._fbOwnGuids; delete B._fbSessionRepo; delete B._fbBaseDirProbe; delete B._fbTargetCache; }
function b1Files(prefix) { var out = []; for (var k in memFs.files) { if (k.indexOf(prefix) === 0) { out.push(k.substring(prefix.length)); } } return out.sort(); }
// simulace pumpy v0.5 nad jednou davkou: zapis req, FB_Main(cesta), zapis res, presun jako pump.wsf
function pumpRun(repo, ops, id, text) {
    delete B._fbAccessCache;
    var name = "req-" + id + ".json", p = B1_REQ + "\\" + name;
    memFs.files[p] = (typeof text == "string") ? text : JSON.stringify({ protocol: "eafb/0.2", id: id, repo: "EAEXAMPLE.QEA", ops: ops });
    var out = asEaRuntime(function () { return "" + B.FB_Main.call(B, repo, p); });
    memFs.files[B1_RES + "\\res-" + id + ".json"] = out;
    var rejected = /"code":"(E_PARSE|E_RISK_BLOCKED|E_RISK_CONFIRM|E_NO_BASELINE|E_BLACKLIST|E_SCOPE_CONFIG)"/.test(out); // zrcadlo pump.wsf (rejected)
    if (out.indexOf("\"status\":\"confirm_required\"") < 0 && typeof memFs.files[p] != "undefined") {
        memFs.files[B1_REQ + "\\" + (rejected ? "rejected" : "processed") + "\\" + name.replace(/\.json$/, "") + ".stamp.json"] = memFs.files[p];
        delete memFs.files[p];
    }
    return JSON.parse(out);
}
function pumpConfirm(repo, resp, id, approve) {
    var out = asEaRuntime(function () { return "" + B.FB_ConfirmPending.call(B, repo, resp.confirm.pendingPath, resp.confirm.nonce, resp.confirm.payloadHash, "pumpa", approve); });
    memFs.files[B1_RES + "\\res-" + id + ".json"] = out;
    return JSON.parse(out);
}
function withPump(fn) {
    global.WScript = { ScriptFullName: B1_BASE + "\\pump.wsf" };
    try { return fn(); } finally { delete global.WScript; }
}
var B1_CREATE = [{ op: "create_or_update_elements", elements: [{ name: "B1-N", type: "Class", "package": "{PK-11}" }] }];
var B1_READ = [{ op: "ping", echo: "b1" }];

// --- P1: stavovy zaznam ---
t("B1 P1: prvni pruchod nad souborem zapise res processing se since (pred vysledkem); konecny res nese since", function () {
    b1Reset(); var repo = blRepo();
    var seen = null;
    var oE = B.FB_OpElements;
    B.FB_OpElements = function () { seen = JSON.parse(memFs.files[B1_RES + "\\res-p1a.json"]); return { op: "create_or_update_elements", status: "ok", items: [{ guid: mkGuid(), id: 1, created: true }] }; };
    try { var r = pumpRun(repo, B1_CREATE, "p1a"); } finally { B.FB_OpElements = oE; }
    ok(seen != null, "res existoval v okamziku exekuce");
    eq(seen.status, "processing"); eq(seen.id, "p1a"); ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(seen.since), "since je cas");
    eq(r.status, "done"); eq(r.since, seen.since, "konecny res nese tyz since");
    eq(JSON.parse(memFs.files[B1_RES + "\\res-p1a.json"]).status, "done", "processing zaznam po konecnem vysledku nevisi (pumpa prepise)");
});
t("B1 P1 E_INTERRUPTED (FB-PU-11): zapisova davka s vlastnim res processing = prerusena -> nic se neprovede, stary res do superseded", function () {
    b1Reset(); var repo = blRepo();
    memFs.files[B1_RES + "\\res-p1b.json"] = JSON.stringify({ protocol: "eafb/0.2", id: "p1b", status: "processing", since: "2026-10-11 09:00:00" });
    var called = 0; var oE = B.FB_OpElements; B.FB_OpElements = function () { called++; return { op: "x", status: "ok", items: [] }; };
    try { var r = pumpRun(repo, B1_CREATE, "p1b"); } finally { B.FB_OpElements = oE; }
    eq(r.status, "error"); eq(r.code, "E_INTERRUPTED"); eq(called, 0, "nic se neprovedlo");
    contains(r.message, "prerusena"); contains(r.message, "OPRAVNOU davku");
    eq(r.results.length, 1); eq(r.results[0].status, "skipped");
    eq(b1Files(B1_RES + "\\superseded\\").length, 1, "stary res v superseded");
    ok(!r.confirm, "zadne okno");
});
t("B1 P1: cteci davka s res processing se smi opakovat (res se prepise, zadna chyba)", function () {
    b1Reset(); var repo = blRepo();
    memFs.files[B1_RES + "\\res-p1c.json"] = JSON.stringify({ protocol: "eafb/0.2", id: "p1c", status: "processing", since: "2026-10-11 09:00:00" });
    var r = pumpRun(repo, B1_READ, "p1c");
    eq(r.status, "done"); eq(r.results[0].op, "ping");
});
t("B1 P1 E_DUPLICATE_ID (FB-PU-09, simulace V3): stejne id podruhe u zapisove davky -> druha E_DUPLICATE_ID, prvek vznikne JEDNOU, stary res v superseded", function () {
    b1Reset(); var repo = blRepo();
    var created = 0; var oE = B.FB_OpElements; B.FB_OpElements = function () { created++; return { op: "create_or_update_elements", status: "ok", items: [{ guid: mkGuid(), id: 7, created: true }] }; };
    try {
        var r1 = pumpRun(repo, B1_CREATE, "v3");
        var r2 = pumpRun(repo, B1_CREATE, "v3");
    } finally { B.FB_OpElements = oE; }
    eq(r1.status, "done"); eq(r2.status, "error"); eq(r2.code, "E_DUPLICATE_ID");
    eq(created, 1, "V3: dva prvky uz nevznikaji");
    eq(r2.duplicate.kind, "same-id-final"); eq(r2.duplicate.previousStatus, "done");
    contains(r2.message, "NOVYM id");
    eq(b1Files(B1_RES + "\\superseded\\").length, 1);
    ok(!r2.confirm, "zadne okno");
});
t("B1 P1: cteci davka se stejnym id se smi opakovat; stejne JMENO souboru s jinym id = jen supersede, davka probehne", function () {
    b1Reset(); var repo = blRepo();
    var a = pumpRun(repo, B1_READ, "p1d"); var b = pumpRun(repo, B1_READ, "p1d");
    eq(a.status, "done"); eq(b.status, "done");
    // soubor req-p1e.json s id "jine" po dokoncene davce id p1e
    var oE = B.FB_OpElements; B.FB_OpElements = function () { return { op: "x", status: "ok", items: [] }; };
    try {
        var c = pumpRun(repo, B1_CREATE, "p1e");
        var d = pumpRun(repo, null, "p1e", JSON.stringify({ protocol: "eafb/0.2", id: "jine-id", repo: "EAEXAMPLE.QEA", ops: B1_CREATE }));
    } finally { B.FB_OpElements = oE; }
    eq(c.status, "done"); eq(d.status, "done", JSON.stringify(d).substring(0, 200)); eq(d.id, "jine-id");
    eq(b1Files(B1_RES + "\\superseded\\").length, 1, "stary res pod tymz jmenem je v superseded");
});
t("B1 P1: textovy rezim (legacy) ani potvrzeny beh stavovy zaznam nepisi", function () {
    b1Reset(); var repo = blRepo();
    var r = runText(repo, B1_READ, "p1f");
    eq(r.status, "done"); eq(b1Files(B1_RES + "\\").length, 0, "zadny res od FB_Main v textovem rezimu");
});

// --- P2: predbezna kontrola ---
t("B1 P2 / V1 (FB-PU-23): preklep v CTECI operaci -> E_UNKNOWN_OP s nejblizsimi nazvy, ZADNE okno, nic v pending, zadna zaloha, zadny audit", function () {
    b1Reset(); var repo = blRepo();
    var r = pumpRun(repo, [{ op: "get_element_information", elements: ["{EL-101}"] }], "v1");
    eq(r.status, "error"); eq(r.code, "E_UNKNOWN_OP");
    ok(r.problems && r.problems.length == 1, "jeden problem"); eq(r.problems[0].code, "E_UNKNOWN_OP");
    ok(r.problems[0].suggestions.indexOf("get_elements_information") >= 0, "nejblizsi nazev: " + r.problems[0].suggestions.join(","));
    ok(!r.confirm && !r.risk, "zadne okno, zadny risk gate");
    eq(b1Files(B1_PEND + "\\").length, 0, "nic v pending");
    eq(repo._countBaselines(), 0, "zadna zaloha");
    ok(!r.audit, "zadny audit (nic se nestalo)");
    eq(r.results[0].status, "skipped");
    ok(b1Files(B1_REQ + "\\processed\\").length == 1, "pumpa v0.5 soubor odlozi do processed");
});
t("B1 P2: vsechny problemy davky v jedne odpovedi (problems[]), ne jen prvni; kod podle priority UNKNOWN > ARGS", function () {
    b1Reset(); var repo = blRepo();
    var r = pumpRun(repo, [
        { op: "create_or_update_elements", elements: [] },
        { op: "create_or_update_attributes", attributes: [{ name: "a" }] },
        { op: "find_elemnts_by_name", name: "x" }
    ], "p2a");
    eq(r.code, "E_UNKNOWN_OP");
    eq(r.problems.length, 3, JSON.stringify(r.problems));
    contains(r.problems[0].message, "prazdny"); contains(r.problems[1].message, "element"); eq(r.problems[2].code, "E_UNKNOWN_OP");
    eq(r.results.length, 3);
});
t("B1 P2 / N-K8-7 + FB-PU-23: nenahrazeny zastupny text (GUID-..., {GUID-, <...>) v identifikacnim poli -> E_ARGS bez okna; notes s <b> se NEKONTROLUJI", function () {
    b1Reset(); var repo = blRepo();
    var r = pumpRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "X", type: "Class", "package": "GUID-A3-Z-ACK-A3a", notes: "<b>tucne</b> <i>ok</i>" }] }], "nk87");
    eq(r.status, "error"); eq(r.code, "E_ARGS"); eq(r.problems.length, 1, JSON.stringify(r.problems));
    contains(r.problems[0].path, "package"); contains(r.problems[0].message, "zastupny text");
    ok(!r.confirm, "zadne okno (driv popup 'Neresolvovatelny package')");
    var r2 = pumpRun(repo, [{ op: "delete_from_model", targets: [{ type: "Element", guid: "{GUID-prvku}" }] }], "nk87b");
    eq(r2.code, "E_ARGS"); contains(r2.problems[0].message, "zastupny text"); ok(!r2.confirm);
    var r3 = pumpRun(repo, [{ op: "create_or_update_attributes", element: "<GUID elementu>", attributes: [{ name: "a" }] }], "nk87c");
    eq(r3.code, "E_ARGS"); contains(r3.problems[0].path, "element");
    // repo placeholder
    var r4 = pumpRun(repo, null, "nk87d", JSON.stringify({ protocol: "eafb/0.2", id: "nk87d", repo: "<REPO>", ops: B1_READ }));
    eq(r4.code, "E_ARGS"); eq(r4.problems[0].path, "repo");
});
t("B1 P2: $N smi jen dozadu - dopredny odkaz a odkaz na sebe = E_ARGS pred exekuci", function () {
    b1Reset(); var repo = blRepo();
    var r = pumpRun(repo, [{ op: "place_elements_on_diagram", diagram: "$1", elementPlacements: [{ element: "$0" }] },
                           { op: "create_or_update_diagram", diagrams: [{ name: "D", type: "Logical", "package": "{PK-11}" }] }], "p2n");
    eq(r.code, "E_ARGS"); eq(r.problems.length, 2, JSON.stringify(r.problems));
    contains(r.problems[0].message, "dopredu"); contains(r.problems[1].message, "vlastni operaci");
});
t("B1 P2 faze 2: cil zadany GUIDem u upravy/mazani v modelu neexistuje -> E_ARGS bez okna; existujici GUID projde; cteci operace se neoveruji", function () {
    b1Reset(); var repo = blRepo();
    var r = pumpRun(repo, [{ op: "create_or_update_elements", elements: [{ guid: "{EL-999}", notes: "x" }] },
                           { op: "delete_from_model", targets: [{ type: "Package", guid: "{PK-999}" }] }], "p2g");
    eq(r.code, "E_ARGS"); eq(r.problems.length, 2, JSON.stringify(r.problems));
    contains(r.problems[0].message, "neexistuje"); contains(r.problems[1].path, "targets[0]");
    ok(!r.confirm, "zadne okno");
    var sqlEl = repo._sqlLog.length;
    var r2 = pumpRun(repo, [{ op: "get_elements_information", elements: ["{EL-999}"] }], "p2g2");
    ok(r2.code != "E_ARGS", "cteci davka: GUID se predem neoveruje (" + r2.code + ")");
    // existujici GUID: predbezna kontrola projde, Risk Gate nedotazuje znovu (mezipamet FB_TargetCache)
    var oE = B.FB_OpElements; B.FB_OpElements = function () { return { op: "x", status: "ok", items: [] }; };
    try { var r3 = pumpRun(repo, [{ op: "create_or_update_elements", elements: [{ guid: "{EL-103}", notes: "x" }] }], "p2g3"); } finally { B.FB_OpElements = oE; }
    eq(r3.status, "done", JSON.stringify(r3).substring(0, 300));
    var q = repo._sqlLog.filter(function (x) { return /FROM t_object WHERE ea_guid = '\{EL-103\}'/.test(x); });
    ok(q.length <= 1, "cil {EL-103} se v davce dotazoval nejvys jednou, nalezeno " + q.length);
});
t("B1 P2: E_OP_FORBIDDEN az PO kontrole pristupu (E_ADDIN_ACCESS ma prednost); u povoleneho repa se zakazana operace odmitne pred exekuci, bez okna", function () {
    b1Reset(); var repo = blRepo();
    withPolicy(B.FB_RiskPolicy, function () {
        var oA = B.FB_OpsAllowed; B.FB_OpsAllowed = function () { return [{ repo: "EAEXAMPLE.QEA", allow: ["*"], deny: ["delete_from_model"] }]; };
        try {
            var r = pumpRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "n", type: "Class", "package": "{PK-11}" }] }, { op: "delete_from_model", targets: [{ type: "Element", id: 104 }] }], "p2f");
            eq(r.code, "E_OP_FORBIDDEN"); eq(r.problems[0].path, "ops[1].op"); ok(!r.confirm, "zadne okno");
            eq(r.results[0].status, "skipped", "ani prvni operace se neprovedla");
        } finally { B.FB_OpsAllowed = oA; }
    });
});
t("B1 P2 / FB-PU-28: chyba odkazu $N pri exekuci = E_ARGS s napovedou (ne E_EXCEPTION) a priznak W8 se NEnastavi", function () {
    b1Reset(); var repo = blRepo();
    // LOW davka: $0 na create vetev (vlastni, bez okna), ale vysledek ma guid jen v items[] -> chyba odkazu az pri exekuci
    var oP = B.FB_OpPackage; B.FB_OpPackage = function () { return { op: "create_or_update_package", status: "ok", items: [{ guid: mkGuid(), id: 55, created: true }] }; };
    var oE = B.FB_OpElements; B.FB_OpElements = function () { return { op: "x", status: "ok", items: [] }; };
    try {
        var r = pumpRun(repo, [{ op: "create_or_update_package", parent: "{PK-11}", name: "P" }, { op: "create_or_update_elements", elements: [{ name: "n", type: "Class", "package": "$0" }] }], "p28");
    } finally { B.FB_OpPackage = oP; B.FB_OpElements = oE; }
    eq(r.results[1].code, "E_ARGS", JSON.stringify(r.results[1]));
    contains(r.results[1].message, "$0[0]");
    ok(B._fbPrevExc !== true, "W8 se po chybe odkazu nenastavuje");
    eq(B.FB_StateFile.call(B, repo, "w8"), "", "ani ve state souboru");
});
t("B1 FB-PU-28: skutecna vyjimka z EA/COM priznak W8 nastavi (regrese) a dalsi zapis jde oknem", function () {
    b1Reset(); var repo = blRepo();
    var oE = B.FB_OpElements; B.FB_OpElements = function () { throw new Error("mock: COM spadl"); };
    try { var r = pumpRun(repo, B1_CREATE, "w8a"); } finally { B.FB_OpElements = oE; }
    eq(r.results[0].code, "E_EXCEPTION"); eq(B._fbPrevExc, true);
    var r2 = pumpRun(repo, B1_CREATE, "w8b");
    eq(r2.status, "confirm_required"); ok(r2.risk.riskReasons.join(" ").indexOf("W8") >= 0);
});

// --- P3: cekajici davka ---
function pendDelete(repo, id) { return pumpRun(repo, [{ op: "delete_from_model", targets: [{ type: "Element", id: 104 }] }], id); }
t("B1 P3 / S1 (FB-PU-15/-16): okno vyprsi -> agent posle TENTYZ soubor znovu -> vraci se STAVAJICI res (stejny nonce), exemplar do rejected, potvrzeni funguje bez restartu", function () {
    b1Reset(); var repo = blRepo();
    var r1 = pendDelete(repo, "s1");
    eq(r1.status, "confirm_required");
    var idx = B.FB_PendingIndex.call(B, repo, B1_PEND, "list");
    eq(idx.length, 1); eq(idx[0].id, "s1"); eq(idx[0].hash, r1.confirm.payloadHash); ok(idx[0].since != "", "index nese since");
    var r2 = pendDelete(repo, "s1"); // tentyz soubor, stejny obsah (okno vyprselo, agent posila znovu)
    eq(r2.status, "confirm_required"); eq(r2.confirm.nonce, r1.confirm.nonce, "puvodni nonce plati");
    eq(JSON.stringify(r2), JSON.stringify(r1), "res beze zmeny");
    eq(b1Files(B1_REQ + "\\rejected\\").length, 1, "novy exemplar odlozen");
    ok(/duplicate/.test(b1Files(B1_REQ + "\\rejected\\")[0]));
    eq(b1Files(B1_PEND + "\\").filter(function (f) { return /\.json$/.test(f); }).length, 1, "v pending porad jedna davka");
    var oD = B.FB_OpDelete; B.FB_OpDelete = function () { return { op: "delete_from_model", status: "ok", items: [{ deleted: true }] }; };
    try { var r3 = pumpConfirm(repo, r2, "s1", true); } finally { B.FB_OpDelete = oD; }
    eq(r3.status, "done", JSON.stringify(r3).substring(0, 300));
    eq(B.FB_PendingIndex.call(B, repo, B1_PEND, "list").length, 0, "index po potvrzeni prazdny");
});
t("B1 P3 (pravidlo 6 bod 1): stejne jmeno souboru, JINY obsah -> stavajici res zustava nosicem nonce + warning DUPLICITA ID + sekce duplicate; exemplar odlozen", function () {
    b1Reset(); var repo = blRepo();
    var r1 = pendDelete(repo, "s2");
    var r2 = pumpRun(repo, [{ op: "delete_from_model", targets: [{ type: "Element", id: 105 }] }], "s2");
    eq(r2.status, "confirm_required"); eq(r2.confirm.nonce, r1.confirm.nonce, "nonce cekajici davky preziva");
    ok(r2.warnings && /DUPLICITA ID/.test(r2.warnings.join(" ")), "warning pro agenta");
    eq(r2.duplicate.kind, "same-id-other-content"); eq(r2.duplicate.pendingId, "s2");
    contains(r2.warnings.join(" "), "NOVYM id");
    eq(b1Files(B1_REQ + "\\rejected\\").length, 1);
    // cekajici davku jde porad potvrdit (res na disku = to, co pumpa zapsala = r2)
    var oD = B.FB_OpDelete; B.FB_OpDelete = function () { return { op: "delete_from_model", status: "ok", items: [{ deleted: true }] }; };
    try { var r3 = pumpConfirm(repo, r2, "s2", true); } finally { B.FB_OpDelete = oD; }
    eq(r3.status, "done", JSON.stringify(r3).substring(0, 300));
});
t("B1 P3 (pravidlo 6 bod 2, FB-PU-17): stejny obsah pod JINYM id -> E_DUPLICATE_ID s id cekajici davky, nic se nezaradi", function () {
    b1Reset(); var repo = blRepo();
    var ops = [{ op: "delete_from_model", targets: [{ type: "Element", id: 104 }] }];
    var text = JSON.stringify({ protocol: "eafb/0.2", repo: "EAEXAMPLE.QEA", ops: ops, id: "s3a" });
    var r1 = pumpRun(repo, null, "s3a", text);
    eq(r1.status, "confirm_required");
    // jiny soubor (jine jmeno), identicke bajty obsahu
    var r2 = pumpRun(repo, null, "s3b", text);
    eq(r2.status, "error"); eq(r2.code, "E_DUPLICATE_ID"); eq(r2.duplicate.kind, "same-content-pending"); eq(r2.duplicate.pendingId, "s3a");
    eq(b1Files(B1_PEND + "\\").filter(function (f) { return /\.json$/.test(f); }).length, 1, "v pending jen jedna");
    ok(!r2.confirm, "zadne druhe okno");
});
t("B1 P3 (pravidlo 6 bod 4, FB-PU-17 / S5): cekajici davka starsi nez confirmMaxAgeMin -> E_RISK_EXPIRED pri potvrzeni i zamitnuti, rejected, audit; mladsi se potvrdi", function () {
    b1Reset(); var repo = blRepo();
    var r1 = pendDelete(repo, "s5");
    // zestarnuti: since v res i v indexu o 9 h zpet
    var old = new Date(new Date().getTime() - 9 * 3600000);
    function fmt(d) { function p(x) { return (x < 10 ? "0" : "") + x; } return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()); }
    var resObj = JSON.parse(memFs.files[B1_RES + "\\res-s5.json"]); resObj.since = fmt(old); memFs.files[B1_RES + "\\res-s5.json"] = JSON.stringify(resObj);
    var executed = 0; var oD = B.FB_OpDelete; B.FB_OpDelete = function () { executed++; return { op: "delete_from_model", status: "ok", items: [{ deleted: true }] }; };
    try { var r2 = pumpConfirm(repo, r1, "s5", true); } finally { B.FB_OpDelete = oD; }
    eq(r2.status, "rejected"); eq(r2.code, "E_RISK_EXPIRED"); eq(executed, 0, "S5: zatuchla davka se neprovede");
    ok(r2.risk.confirm.expired === true && r2.risk.confirm.confirmedByUser === false);
    ok(r2.audit && typeof r2.audit.aiLogGuid == "string", "audit volan (mock bez #AI-LOG vraci prazdny GUID + warning)");
    eq(b1Files(B1_PEND + "\\").filter(function (f) { return /\.json$/.test(f); }).length, 0, "pending prazdny");
    eq(b1Files(B1_REQ + "\\rejected\\").length, 1);
    contains(r2.message, "NOVYM id");
    // mladsi davka (7 h) projde
    var r3 = pendDelete(repo, "s5b");
    var ro = JSON.parse(memFs.files[B1_RES + "\\res-s5b.json"]); ro.since = fmt(new Date(new Date().getTime() - 7 * 3600000)); memFs.files[B1_RES + "\\res-s5b.json"] = JSON.stringify(ro);
    B.FB_OpDelete = function () { return { op: "delete_from_model", status: "ok", items: [{ deleted: true }] }; };
    try { var r4 = pumpConfirm(repo, r3, "s5b", true); } finally { B.FB_OpDelete = oD; }
    eq(r4.status, "done", JSON.stringify(r4).substring(0, 200));
});
t("B1 P3: FB_PendingSweep (nabidka po startu pumpy) - expirovane presune do rejected s auditem a prepise res, mlade necha; limit z politiky (480) / vychozi", function () {
    b1Reset(); var repo = blRepo();
    var a = pendDelete(repo, "sw1"), b = pendDelete(repo, "sw2");
    var now = new Date().getTime();
    var sw0 = B.FB_PendingSweep.call(B, repo, B1_PEND, "", now);
    eq(sw0.maxAgeMin, 480); eq(sw0.checked, 2); eq(sw0.expired.length, 0); eq(sw0.kept.length, 2);
    var sw1 = B.FB_PendingSweep.call(B, repo, B1_PEND, "", now + 481 * 60000);
    eq(sw1.expired.length, 2); eq(sw1.kept.length, 0);
    contains(sw1.text, "VYPRSELA req-sw1.json"); contains(sw1.text, "req-sw2.json");
    eq(JSON.parse(memFs.files[B1_RES + "\\res-sw1.json"]).code, "E_RISK_EXPIRED", "res prepsan");
    eq(B.FB_PendingIndex.call(B, repo, B1_PEND, "list").length, 0);
    eq(b1Files(B1_REQ + "\\rejected\\").length, 2);
    // politika s jinym limitem
    var p0s = B.FB_RiskPolicy.call(B)[0];
    withPolicy(function () { var q = {}; for (var k in p0s) { q[k] = p0s[k]; } q.confirmMaxAgeMin = 30; return [q]; }, function () {
        b1Reset(); var repoB = blRepo(); pendDelete(repoB, "sw3");
        var swB = B.FB_PendingSweep.call(B, repoB, B1_PEND, "", new Date().getTime() + 31 * 60000);
        eq(swB.maxAgeMin, 30); eq(swB.expired.length, 1);
    });
});
t("B1 P3: index cekajicich davek - polozka bez souboru vypadne pri cteni; add/remove/find", function () {
    b1Reset(); var repo = blRepo();
    memFs.files[B1_PEND + "\\req-a.json"] = "{}";
    B.FB_PendingIndex.call(B, repo, B1_PEND, "add", { name: "req-a.json", hash: "h1", id: "a", since: "2026-10-11 10:00:00" });
    B.FB_PendingIndex.call(B, repo, B1_PEND, "add", { name: "req-b.json", hash: "h2", id: "b", since: "" });
    var l = B.FB_PendingIndex.call(B, repo, B1_PEND, "list");
    eq(l.length, 1, "req-b.json na disku neni -> vypadne"); eq(l[0].id, "a");
    eq(B.FB_PendingIndex.call(B, repo, B1_PEND, "find", { name: "req-x.json", hash: "h1" }).id, "a");
    eq(B.FB_PendingIndex.call(B, repo, B1_PEND, "find", { name: "req-a.json", hash: "h1" }), null, "tyz soubor neni duplicita sam sebe");
    eq(B.FB_PendingIndex.call(B, repo, B1_PEND, "remove", { name: "req-a.json" }).length, 0);
});

// --- pravidlo 3: vlastni prace teze session (ownSessionLow) ---
t("B1 pravidlo 3: pod pumpou si FB_Main pamatuje GUIDy zalozenych prvku/diagramu (jen pamet, zadny soubor ani tag); mimo pumpu ne", function () {
    b1Reset(); var repo = blRepo();
    var oD = B.FB_OpDiagram; B.FB_OpDiagram = function () { return { op: "create_or_update_diagram", status: "ok", items: [{ guid: "{DG-201}", id: 201, created: true }, { guid: "{DG-OLD}", id: 1, created: false }] }; };
    try {
        var filesBefore = b1Files(B1_BASE + "\\").length;
        withPump(function () { var r = pumpRun(repo, [{ op: "create_or_update_diagram", diagrams: [{ name: "D", type: "Logical", "package": "{PK-12}" }] }], "own1"); eq(r.status, "done"); eq(r.ownSession.added, 1); });
        ok(B._fbOwnGuids && B._fbOwnGuids["{DG-201}"] === 1, "vlastni diagram zapamatovan");
        ok(!B._fbOwnGuids["{DG-OLD}"], "updatovany (created:false) ne");
        for (var k in memFs.files) { ok(!/\{DG-201\}/.test(memFs.files[k]) || /res-own1/.test(k), "zadny soubor se seznamem vlastnich GUIDu: " + k); }
        b1Reset();
        var r2 = pumpRun(blRepo(), [{ op: "create_or_update_diagram", diagrams: [{ name: "D", type: "Logical", "package": "{PK-12}" }] }], "own2");
        ok(!B._fbOwnGuids, "bez pumpy (EA runtime) se nic nepamatuje");
    } finally { B.FB_OpDiagram = oD; }
});
t("B1 pravidlo 3: umisteni prvku na VLASTNI diagram teze session = bez okna (foreignDiagrams 0); cizi diagram = okno jako dnes; bez klice ownSessionLow = okno", function () {
    b1Reset(); var repo = blRepo();
    var oP = B.FB_OpPlaceElements; B.FB_OpPlaceElements = function () { return { op: "place_elements_on_diagram", status: "ok", items: [] }; };
    try {
        withPump(function () {
            B._fbOwnGuids = { "{DG-201}": 1 };
            var r = pumpRun(repo, [{ op: "place_elements_on_diagram", diagram: "{DG-201}", elementPlacements: [{ element: 102 }] }], "own3");
            eq(r.status, "done", JSON.stringify(r).substring(0, 300)); eq(r.risk.riskLevel, "LOW"); eq(r.risk.metrics.affectedDiagrams, 0);
            B._fbOwnGuids = {};
            var r2 = pumpRun(repo, [{ op: "place_elements_on_diagram", diagram: "{DG-201}", elementPlacements: [{ element: 102 }] }], "own4");
            eq(r2.status, "confirm_required"); ok(/foreignDiagrams/.test(r2.risk.riskReasons.join(" ")));
            // bez klice v politice: vlastni diagram je porad cizi (dnesni chovani)
            B._fbOwnGuids = { "{DG-201}": 1 };
            var p0o = B.FB_RiskPolicy.call(B)[0];
            withPolicy(function () { var q = {}; for (var k in p0o) { if (k != "ownSessionLow") { q[k] = p0o[k]; } } return [q]; }, function () {
                var r3 = pumpRun(repo, [{ op: "place_elements_on_diagram", diagram: "{DG-201}", elementPlacements: [{ element: 102 }] }], "own5");
                eq(r3.status, "confirm_required", "bez ownSessionLow = okno");
            });
        });
    } finally { B.FB_OpPlaceElements = oP; }
});
t("B1 pravidlo 3 (vc. kap. 7 bod 5 - requirements): scenare/constraints/requirements nad VLASTNIM prvkem teze session = LOW; nad cizim = okno; $N na create teze davky = vlastni", function () {
    b1Reset(); var repo = blRepo();
    var stub = function (n) { return function () { var g = mkGuid(); return { op: n, status: "ok", guid: g, items: [{ guid: g, id: ++guidSeq, created: true }] }; }; };
    var keep = {}; ["FB_OpScenarios", "FB_OpConstraints", "FB_OpRequirements", "FB_OpElements"].forEach(function (k) { keep[k] = B[k]; B[k] = stub(k); });
    try {
        withPump(function () {
            B._fbOwnGuids = { "{EL-103}": 1 };
            ["create_or_update_scenarios", "create_or_update_constraints", "create_or_update_requirements"].forEach(function (opn, ix) {
                var key = opn.replace("create_or_update_", "");
                var o = { op: opn, element: "{EL-103}" }; o[key] = [{ name: "x" }];
                var r = pumpRun(repo, [o], "own6" + ix);
                eq(r.status, "done", opn + ": " + JSON.stringify(r).substring(0, 300)); eq(r.risk.riskLevel, "LOW", opn + " nad vlastnim prvkem bez okna");
                var o2 = { op: opn, element: "{EL-101}" }; o2[key] = [{ name: "x" }];
                var r2 = pumpRun(repo, [o2], "own7" + ix);
                eq(r2.status, "confirm_required", opn + " nad cizim prvkem = okno");
            });
            var r3 = pumpRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "UC", type: "UseCase", "package": "{PK-11}" }] },
                                   { op: "create_or_update_scenarios", element: "$0", scenarios: [{ name: "Basic" }] }], "own8");
            eq(r3.status, "done", JSON.stringify(r3).substring(0, 300)); eq(r3.risk.riskLevel, "LOW");
        });
    } finally { for (var k in keep) { B[k] = keep[k]; } }
});
t("B1 pravidlo 3: FB_SessionStart (novy beh pumpy) seznam vlastnich prvku vynuluje", function () {
    b1Reset(); var repo = blRepo();
    withPump(function () { B._fbOwnGuids = { "{DG-201}": 1 }; B.FB_SessionStart.call(B, repo); });
    eq(Object.keys(B._fbOwnGuids).length, 0);
});

// --- pravidlo 7: ping nese riskPolicy ---
t("B1 pravidlo 7: ping vraci riskPolicy (tridy, prahy, confirmMaxAgeMin, ownSessionLow); chat ACK ho strucne vypise, bez GUIDu a nonce", function () {
    b1Reset(); var repo = blRepo();
    var r = runText(repo, [{ op: "ping" }], "p7");
    ok(r.results && r.results[0], "ping probehl: " + JSON.stringify(r).substring(0, 300));
    var rp = r.results[0].riskPolicy;
    ok(rp && rp.available === true, "riskPolicy pro dev repo");
    ok(rp.confirmAlways.indexOf("delete_from_model") >= 0 && rp.confirmAlways.indexOf("move_elements") >= 0);
    eq(rp.elevate.writeOps, 20); eq(rp.block.writeOps, 500); eq(rp.confirmMaxAgeMin, 480); eq(rp.ownSessionLow, true);
    var ack = chat(r);
    contains(ack, "okno: prahy zapisu >20"); contains(ack, "480 min"); contains(ack, "vlastni prvky session bez okna: ano");
    ok(ack.indexOf("nonce") < 0);
    var r2 = JSON.parse(B.FB_Main.call(B, mkRepo({ connectionString: "C:\\HARNESS\\CIZI.QEA" }), JSON.stringify({ protocol: "eafb/0.2", id: "p7b", ops: [{ op: "ping" }] })));
    eq(r2.status, "done", JSON.stringify(r2).substring(0, 200));
    eq(r2.results[0].riskPolicy.available, false); contains(chat(r2), "politika pro repozitar chybi");
});

// --- FB-PU-06: identita repa ze startu session ---
t("B1 FB-PU-06: pod pumpou drzi FB_SessionStart identitu repa; jiny projekt v EA = E_REPO 'restartuj pumpu' i u cteni; mimo pumpu se nic nekontroluje", function () {
    b1Reset();
    withPump(function () {
        var repoA = blRepo();
        B.FB_SessionStart.call(B, repoA);
        eq(B._fbSessionRepo, "" + B.FB_RepoId.call(B, repoA));
        var ok1 = runText(repoA, B1_READ, "pu6a"); eq(ok1.status, "done");
        var repoB = mkRepo({ connectionString: "C:\\HARNESS\\JINY-PROJEKT.QEA" });
        var r = runText(repoB, B1_READ, "pu6b");
        eq(r.status, "error"); eq(r.code, "E_REPO"); contains(r.message, "restartuj pumpu"); eq(r.sessionRepo, "" + B.FB_RepoId.call(B, repoA));
    });
    b1Reset();
    B.FB_SessionStart.call(B, blRepo());
    ok(typeof B._fbSessionRepo == "undefined", "EA runtime: identita se neuklada");
    eq(JSON.parse(B.FB_Main.call(B, mkRepo({ connectionString: "C:\\HARNESS\\JINY-PROJEKT.QEA" }), JSON.stringify({ protocol: "eafb/0.2", id: "pu6c", ops: B1_READ }))).status, "done");
});

// --- FB-PU-35: baseDir pod pumpou ---
t("B1 FB-PU-35: pod pumpou je baseDir slozka pumpy bez ohledu na FB_Config; zapisova sonda 1x za session; selhani = warning v res", function () {
    b1Reset(); var repo = blRepo();
    var oC = B.FB_Config; B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", baseDir: "C:\\JINE\\REPO" }]; };
    try {
        eq(B.FB_ResolveBaseDir.call(B, repo), "C:\\JINE\\REPO", "EA runtime: explicitni FB_Config");
        ok(memFs.folders["C:\\JINE\\REPO\\requests\\pending"] === 1, "explicitni cesta zalozena po urovnich");
        b1Reset();
        withPump(function () {
            eq(B.FB_ResolveBaseDir.call(B, repo), B1_BASE, "pumpa: slozka pumpy");
            ok(B._fbBaseDirProbe && B._fbBaseDirProbe.ok === true && B._fbBaseDirProbe.path == B1_BASE, "sonda probehla");
            ok(typeof memFs.files[B1_BASE + "\\.write-probe.tmp"] == "undefined", "testovaci soubor uklizen");
            var n0 = Object.keys(memFs.files).length;
            B.FB_ResolveBaseDir.call(B, repo); B.FB_ResolveBaseDir.call(B, repo);
            eq(Object.keys(memFs.files).length, n0, "sonda jen jednou");
            // selhani sondy -> warning v prvni odpovedi, jen jednou
            B._fbBaseDirProbe = { path: B1_BASE, ok: false, why: "Permission denied", reported: false };
            var r = pumpRun(repo, B1_READ, "pu35");
            ok(r.warnings && /neni zapisovatelna/.test(r.warnings.join(" ")), "warning: " + JSON.stringify(r.warnings));
            var r2 = pumpRun(repo, B1_READ, "pu35b");
            ok(!r2.warnings || !/neni zapisovatelna/.test(r2.warnings.join(" ")), "podruhe uz ne");
        });
    } finally { B.FB_Config = oC; }
});

// --- N-E2E-3: sonda pocita diagramy ---
t("B1 N-E2E-3 (T6-33 bez prvku): balicek s 0 prvky a >= 1 diagramem = pod prahem (ok, diagrams N); 0 prvku a 0 diagramu = ok/0 (v0.20); selhani dotazu na diagramy = unknown", function () {
    b1Reset();
    var cfg = B.FB_BaselineConfig.call(B, mkRepo()).cfg;
    var r1 = B.FB_SubtreeCount.call(B, blRepo({ diagramsIn: [19] }), 19, cfg, 2000);
    eq(r1.status, "ok", r1.why); eq(r1.elements, 0); eq(r1.diagrams, 1); contains(r1.why, "diagram");
    var r2 = B.FB_SubtreeCount.call(B, blRepo(), 19, cfg, 2000);
    eq(r2.status, "ok", r2.why); eq(r2.elements, 0); eq(r2.diagrams, 0); contains(r2.why, "prazdny balicek"); // v0.20 FB-PU-33: nula s kanarkem = skutecna nula
    var r3 = B.FB_SubtreeCount.call(B, blRepo({ diagramCountFails: true }), 19, cfg, 2000);
    eq(r3.status, "unknown"); contains(r3.why, "diagramy");
    var r4 = B.FB_SubtreeCount.call(B, blRepo(), 12, cfg, 2000);
    eq(r4.status, "ok"); eq(r4.elements, 2); eq(r4.diagrams, 0, "diagramy se pocitaji jen kdyz je 0 prvku (zadny dotaz navic)");
});

// --- invarianty pravidla 8 KONCEPCE (kazdy bod ma test, ktery pri zmene zcervena) ---
t("B1 pravidlo 8/1: cteni NIKDY neotevira okno (ani souborem, ani s W8, ani v cizim repu)", function () {
    b1Reset(); var repo = blRepo();
    B._fbPrevExc = true;
    var r = pumpRun(repo, [{ op: "ping" }, { op: "find_elements_by_name", name: "ElA" }, { op: "query", sql: "SELECT 1" }], "inv1");
    ok(r.status != "confirm_required" && !r.confirm, "cteci davka bez okna: " + r.status);
    ok(typeof r.risk == "undefined", "cteni nejde pres Risk Gate");
    eq(b1Files(B1_PEND + "\\").length, 0);
});
t("B1 pravidlo 8/2: BLOCKED NIKDY neotevira okno (E_RISK_BLOCKED, nic v pending, audit ano)", function () {
    b1Reset(); var repo = blRepo();
    var tg = []; for (var i = 0; i < 101; i++) { tg.push({ type: "Element", id: 104 }); }
    var r = pumpRun(repo, [{ op: "delete_from_model", targets: tg }], "inv2");
    eq(r.status, "error"); eq(r.code, "E_RISK_BLOCKED"); ok(!r.confirm); eq(b1Files(B1_PEND + "\\").length, 0);
    ok(r.audit && typeof r.audit.aiLogGuid == "string", "audit volan");
    var r2 = pumpRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "FB_RiskPolicy", type: "Class", "package": "{PK-11}" }] }], "inv2b");
    eq(r2.code, "E_RISK_BLOCKED", "zasah do konfigurace bridge (B4) = BLOCKED bez okna"); ok(!r2.confirm);
});
t("B1 pravidlo 8/3: mazani, presun, klon a prepis existujiciho obsahu se ptaji VZDY - i pod pumpou s ownSessionLow a vlastnimi cili", function () {
    b1Reset(); var repo = blRepo();
    withPump(function () {
        B._fbOwnGuids = { "{EL-104}": 1, "{PK-14}": 1, "{DG-201}": 1, "{EL-101}": 1 };
        var cases = [
            [{ op: "delete_from_model", targets: [{ type: "Element", guid: "{EL-104}" }] }],
            [{ op: "delete_taggedvalue_from_model", targets: [{ type: "Element", id: 104, name: "t" }] }],
            [{ op: "remove_elements_from_diagram", diagram: "{DG-201}", elementIDs: [102] }],
            [{ op: "move_elements", "package": "{PK-14}", elements: [101] }],
            [{ op: "clone_package", "package": "{PK-14}", name: "k" }],
            [{ op: "clone_elements", elements: [104], "package": "{PK-14}" }],
            [{ op: "import_element_linked_documents", documents: [{ element: "{EL-101}", rtf_b64: "AA==" }] }],
            [{ op: "create_or_update_messages", diagram: "{DG-201}", rebuild: true, messages: [{ source: 101, target: 102, seqNo: 1 }] }],
            [{ op: "create_or_update_operations", element: "{EL-101}", operations: [{ name: "o", parameters: [{ name: "p" }] }] }],
            [{ op: "create_or_update_elements", elements: [{ guid: "{EL-101}", type: "Component" }] }]
        ];
        cases.forEach(function (ops, ix) {
            B._fbOwnGuids = { "{EL-104}": 1, "{PK-14}": 1, "{DG-201}": 1, "{EL-101}": 1 };
            var r = pumpRun(repo, ops, "inv3-" + ix);
            eq(r.status, "confirm_required", ops[0].op + " musi chtit okno: " + JSON.stringify(r).substring(0, 300));
        });
    });
});
t("B1 pravidlo 8/4: prahy politiky se do kalibrace NEMENI (20/10/1/0/0 elevate, 100/500/100/5 block)", function () {
    var pa = B.FB_RiskPolicy.call(B);
    pa.forEach(function (p) {
        eq(JSON.stringify(p.elevate), JSON.stringify({ deleteTargets: 0, writeOps: 20, updatedExisting: 10, affectedPackages: 1, foreignDiagrams: 0, moveOps: 0 }), p.repo + " elevate");
        eq(JSON.stringify(p.block), JSON.stringify({ deleteTargets: 100, writeOps: 500, updatedExisting: 100, affectedPackages: 5 }), p.repo + " block");
        eq(p.confirmMaxAgeMin, 480, p.repo + " confirmMaxAgeMin = 8 h (KONCEPCE kap. 7 bod 2)");
    });
});
t("B1 pravidlo 8/5: potvrzeni vazane na nonce + otisk - cizi nonce, chybejici hash i zmeneny obsah se odmitnou, davka se neprovede", function () {
    b1Reset(); var repo = blRepo();
    var r1 = pendDelete(repo, "inv5");
    var executed = 0; var oD = B.FB_OpDelete; B.FB_OpDelete = function () { executed++; return { op: "delete_from_model", status: "ok", items: [] }; };
    try {
        var bad = JSON.parse(asEaRuntime(function () { return B.FB_ConfirmPending.call(B, repo, r1.confirm.pendingPath, "cizi-nonce", r1.confirm.payloadHash, "pumpa", true); }));
        eq(bad.code, "E_RISK_CONFIRM");
        var bad2 = JSON.parse(asEaRuntime(function () { return B.FB_ConfirmPending.call(B, repo, r1.confirm.pendingPath, r1.confirm.nonce, "", "pumpa", true); }));
        eq(bad2.code, "E_RISK_CONFIRM");
        memFs.files[r1.confirm.pendingPath] = memFs.files[r1.confirm.pendingPath] + " ";
        var bad3 = pumpConfirm(repo, r1, "inv5", true);
        eq(bad3.code, "E_RISK_INTEGRITY");
        eq(executed, 0, "nic se neprovedlo");
    } finally { B.FB_OpDelete = oD; }
});
t("B1 pravidlo 8/6: nejistota, kterou nejde zjistit predem, se porad pta (matchByName nad prahem, $N na cteni, neznamy objem klonu)", function () {
    b1Reset(); var repo = blRepo();
    var oF = B.FB_OpFindElements; B.FB_OpFindElements = function () { return { op: "find_elements_by_name", status: "ok", items: [{ guid: "{EL-101}", id: 101 }] }; };
    try {
        var r = pumpRun(repo, [{ op: "find_elements_by_name", name: "ElA" }, { op: "create_or_update_attributes", element: "$0[0]", attributes: [{ name: "a" }] }], "inv6");
        eq(r.status, "confirm_required", "$N na vysledek cteni = existujici/nejisty cil -> okno"); 
    } finally { B.FB_OpFindElements = oF; }
});
t("B1 pravidlo 8/7: politiku meni jen clovek - deploy_src je doma ELEVATED, v bankovni sablone BLOCKED; bezna davka do konfigurace bridge = BLOCKED", function () {
    var src = srcOf("FB_RiskPolicy");
    ok(/"deploy_src":\s*"ELEVATED"/.test(src), "dev: deploy_src ELEVATED");
    ok(/"deploy_src": "BLOCKED"/.test(src), "bankovni sablona v komentari: deploy_src BLOCKED");
    ok(/ownSessionLow: false/.test(src) && /ownSessionLow: true/.test(src), "dev true, bankovni sablona false (KONCEPCE kap. 4)");
    b1Reset(); var repo = blRepo();
    var r = pumpRun(repo, [{ op: "deploy_src" }], "inv7");
    eq(r.status, "confirm_required", "deploy_src doma = okno");
});
t("B1 pravidlo 8: kodove kotvy pumpy a adapteru pro nove kody - E_INTERRUPTED/E_DUPLICATE_ID/E_UNKNOWN_OP/E_ARGS jdou do processed (pumpa v0.5), E_RISK_EXPIRED je status rejected", function () {
    var pump = fs.readFileSync(path.join(__dirname, "..", "pump.wsf"), "utf8");
    ok(!/rejected = \([\s\S]{0,700}E_(INTERRUPTED|DUPLICATE_ID)/.test(pump), "nove kody B1 nejsou v rejected seznamu pumpy -> processed (pumpa v0.6 pise E_INTERRUPTED jen sama pro prerusene davky z processing\\)");
    b1Reset(); var repo = blRepo();
    var r = pendDelete(repo, "k8");
    var ro = JSON.parse(memFs.files[B1_RES + "\\res-k8.json"]); ro.since = "2000-01-01 00:00:00"; memFs.files[B1_RES + "\\res-k8.json"] = JSON.stringify(ro);
    var e = pumpConfirm(repo, r, "k8", false);
    eq(e.status, "rejected"); eq(e.code, "E_RISK_EXPIRED");
});

// ===========================================================================
// CIL ZAPISU - rezim blacklist (Z261004b-10, zadani cil zapisu v1.1 kap. 8)
// ===========================================================================
// Model mocku: 1 Model (koren) > 2 Volne > (10 VolnyPrvek, 14 VolnyPrvek2, 13 VolnyVlastneny
// [ParentID 11 - vlastneny chranenym prvkem, I14], diagram 100 VolnyDg)
//           > 900 FBT-CHRANENE (blacklist) > 901 Podbalicek > 12 PodPrvek; 11 ChranenyPrvek; diagram 101 ChranenyDg
//           > 950 #AI-LOG (auditPkg z FB_Config EAEXAMPLE) ; > 960 EA Addins (AICodeBridge 3352)
//           > 3 Dvojnik, 4 Dvojnik (stejne jmeno = nejednoznacne), 5 dvojnik (jen velikost pismen, W7)
// konektory: 301 11->10 (zdroj chraneny, cil volny = NENI chranena, pravidlo "oba konce" 12. 10.), 302 10->14 (volna), 303 10->11 (cil chraneny), 304 12->10 (zdroj v podbalicku), 305 11->12 (OBA konce chranene = chranena vazba)
var SC_AUDIT_GUID = "" + B.FB_Config.call(B)[0].auditPkg;
function scopeRepo(opts) {
    opts = opts || {};
    var PK = [[1, 0, "Model", "{PKG-ROOT}"], [2, 1, "Volne", "{PKG-FREE}"], [900, 1, "FBT-CHRANENE", "{PKG-BL}"], [901, 900, "Podbalicek", "{PKG-BL-SUB}"],
              [950, 1, "#AI-LOG", SC_AUDIT_GUID], [960, 1, "EA Addins", "{PKG-ADDIN}"], [3, 1, "Dvojnik", "{PKG-DUP-A}"], [4, 2, "Dvojnik", "{PKG-DUP-B}"], [5, 2, "dvojnik", "{PKG-DUP-C}"],
              [6, 2, "Jedinacek", "{PKG-ONE}"], [7, 0, "Volne", "{PKG-FREE-TWIN}"], [8, 2, "Dvojnik", "{PKG-DUP-D}"]];
    var EL = [[10, 2, 0, "VolnyPrvek", "{EL-FREE}", "Class"], [14, 2, 0, "VolnyPrvek2", "{EL-FREE2}", "Class"], [13, 2, 11, "VolnyVlastneny", "{EL-OWNED}", "Class"],
              [11, 900, 0, "ChranenyPrvek", "{EL-BL}", "Class"], [12, 901, 0, "PodPrvek", "{EL-BL-SUB}", "Class"],
              [3352, 960, 0, "AICodeBridge", "{EL-BRIDGE}", "Class"], [20, 2, 0, "Dvojprvek", "{EL-DUP-A}", "Class"], [21, 900, 0, "Dvojprvek", "{EL-DUP-B}", "Class"],
              [22, 2, 0, "Instance", "{EL-INST}", "Object"]];
    var DG = [[100, 2, 0, "VolnyDg", "{DG-FREE}"], [101, 900, 0, "ChranenyDg", "{DG-BL}"]];
    var CN = [[301, 11, 10, "{CN-BL}"], [302, 10, 14, "{CN-FREE}"], [303, 10, 11, "{CN-IN}"], [304, 12, 10, "{CN-BL-SUB}"], [305, 11, 12, "{CN-BOTH}"]];
    var DOBJ = opts.diagramObjects || [[101, 10]]; // [Diagram_ID, Object_ID]: volny prvek 10 lezi na chranenem diagramu 101
    var DEDUP_EL = opts.dedupEl || { "k-bl": 11, "k-free": 10 };
    var DEDUP_CN = opts.dedupConn || { "ck-bl": 301, "ck-free": 302, "ck-both": 305 };
    function key(sql) {
        var m;
        if ((m = /ea_guid = '([^']+)'/i.exec(sql))) { return { guid: m[1] }; }
        if ((m = /Parent_ID = (\d+) AND Name = '([^']+)'/i.exec(sql))) { return { parent: parseInt(m[1], 10), name: m[2] }; }
        if ((m = /(?:Object_ID|Package_ID|Diagram_ID|Connector_ID|OperationID|\bID) = (\d+)/i.exec(sql))) { return { id: parseInt(m[1], 10) }; }
        if ((m = /Parent_ID = (\d+)/i.exec(sql))) { return { parentOnly: parseInt(m[1], 10) }; }
        if ((m = /Name = '([^']+)'/i.exec(sql))) { return { name: m[1] }; }
        return {};
    }
    function inList(sql, col) { var m = new RegExp(col + " IN \\(([0-9, ]+)\\)", "i").exec(sql); return m ? m[1].split(",").map(function (x) { return parseInt(x, 10); }) : []; }
    function pkRow(p) { return { Package_ID: p[0], Parent_ID: p[1], Name: p[2], ea_guid: p[3] }; }
    function elRow(e) { return { Object_ID: e[0], Package_ID: e[1], ParentID: e[2], Name: e[3], ea_guid: e[4], Object_Type: e[5], Stereotype: (e[0] == 3352 ? "JavascriptAddin" : "") }; }
    function dgRow(d) { return { Diagram_ID: d[0], Package_ID: d[1], ParentID: d[2], Name: d[3], ea_guid: d[4] }; }
    function cnRow(c) { return { Connector_ID: c[0], Start_Object_ID: c[1], End_Object_ID: c[2], ea_guid: c[3] }; }
    var rules = [
        { re: /#AI-LOG' ORDER BY/i, rows: [] },
        { re: /Name = 'AICodeBridge' AND Stereotype = 'JavascriptAddin'/i, rows: function () { return opts.noBridge ? [] : [{ Object_ID: 3352, ea_guid: "{EL-BRIDGE}", Package_ID: 960 }]; } },
        { re: /FROM t_object WHERE Package_ID = 960/i, rows: function () { var r = [elRow(EL[5])]; if (opts.addinForeign) { r.push({ Object_ID: 3399, Name: "Cizi prvek", Stereotype: "", ParentID: 0 }); } return r; } },
        { re: /FROM t_object WHERE Package_ID IN/i, rows: function (sql) { var ids = inList(sql, "Package_ID"); return EL.filter(function (e) { return ids.indexOf(e[1]) >= 0; }).map(function (e) { return { Object_ID: e[0] }; }); } },
        { re: /t_objectproperties/i, rows: function (sql) { var m = /Value = '([^']+)'/i.exec(sql); var id = DEDUP_EL[m ? m[1] : ""]; if (!id) { return []; }
            var ids = Object.prototype.toString.call(id) == "[object Array]" ? id : [id];
            return ids.map(function (x) { var e = EL.filter(function (q) { return q[0] == x; })[0]; return { Object_ID: x, Package_ID: e ? e[1] : 0, ea_guid: e ? e[4] : "" }; }); } },
        { re: /t_connectortag/i, rows: function (sql) { var m = /VALUE = '([^']+)'/i.exec(sql); var id = DEDUP_CN[m ? m[1] : ""]; if (!id) { return []; }
            var c = CN.filter(function (q) { return q[0] == id; })[0]; return c ? [cnRow(c)] : []; } },
        { re: /FROM t_connector c WHERE c\.End_Object_ID IN/i, rows: function (sql) { var ids = inList(sql, "c.End_Object_ID"); var out = [];
            CN.forEach(function (c) { if (ids.indexOf(c[2]) >= 0 && ids.indexOf(c[1]) < 0) { out.push({ Start_Object_ID: c[1] }); } }); return out; } },
        { re: /FROM t_connector WHERE DiagramID/i, rows: [] },
        { re: /FROM t_connector WHERE Start_Object_ID = (\d+) AND End_Object_ID = (\d+)/i, rows: function (sql) { var m = /Start_Object_ID = (\d+) AND End_Object_ID = (\d+)/i.exec(sql);
            return CN.filter(function (c) { return c[1] == parseInt(m[1], 10) && c[2] == parseInt(m[2], 10); }).map(cnRow); } },
        { re: /FROM t_connector(?: c)? WHERE/i, rows: function (sql) { var k = key(sql); return CN.filter(function (c) { return (k.guid && k.guid == c[3]) || (k.id && k.id == c[0]); }).map(cnRow); } },
        { re: /FROM t_diagramobjects x WHERE x\.Object_ID IN/i, rows: function (sql) { var ids = inList(sql, "x.Object_ID"); return DOBJ.filter(function (d) { return ids.indexOf(d[1]) >= 0; }).map(function (d) { return { Diagram_ID: d[0] }; }); } },
        { re: /FROM t_diagramobjects WHERE Diagram_ID = (\d+)/i, rows: function (sql) { var m = /Diagram_ID = (\d+)/i.exec(sql); return DOBJ.filter(function (d) { return d[0] == parseInt(m[1], 10); }).map(function (d) { return { Object_ID: d[1] }; }); } },
        { re: /t_diagramobjects/i, rows: [] },
        { re: /Classifier IN/i, rows: function (sql) { var ids = inList(sql, "Classifier"); return (opts.classifierInstances || []).filter(function (x) { return ids.indexOf(x[0]) >= 0; }).map(function (x) { return { Object_ID: x[1] }; }); } },
        { re: /FROM t_object WHERE ParentID IN/i, rows: function (sql) { var ids = inList(sql, "ParentID"); return EL.filter(function (e) { return e[2] > 0 && ids.indexOf(e[2]) >= 0; }).map(function (e) { return { Object_ID: e[0], Name: e[3] }; }); } },
        { re: /FROM t_diagram WHERE ParentID IN/i, rows: function (sql) { var ids = inList(sql, "ParentID"); return DG.filter(function (d) { return d[2] > 0 && ids.indexOf(d[2]) >= 0; }).map(function (d) { return { Diagram_ID: d[0], Name: d[3] }; }); } },
        { re: /FROM t_package WHERE Parent_ID IN/i, rows: function (sql) { var ids = inList(sql, "Parent_ID"); return PK.filter(function (p) { return ids.indexOf(p[1]) >= 0; }).map(pkRow); } },
        { re: /FROM t_package WHERE/i, rows: function (sql) { var k = key(sql);
            return PK.filter(function (p) { return (k.guid && k.guid == p[3]) || (k.id && k.id == p[0]) || (typeof k.parent == "number" && k.parent == p[1] && k.name.toLowerCase() == p[2].toLowerCase())
                || (typeof k.parentOnly == "number" && k.parentOnly == p[1]) || (k.name && !("parent" in k) && k.name.toLowerCase() == p[2].toLowerCase()); }).map(pkRow); } },
        { re: /FROM t_object WHERE/i, rows: function (sql) { var k = key(sql);
            return EL.filter(function (e) { return (k.guid && k.guid == e[4]) || (k.id && k.id == e[0]) || (k.name && k.name.toLowerCase() == e[3].toLowerCase()); }).map(elRow); } },
        { re: /FROM t_diagram WHERE/i, rows: function (sql) { var k = key(sql);
            return DG.filter(function (d) { return (k.guid && k.guid == d[4]) || (k.id && k.id == d[0]) || (k.name && k.name == d[3]); }).map(dgRow); } },
        { re: /FROM t_attribute WHERE/i, rows: function (sql) { var k = key(sql); return (k.id == 401) ? [{ Object_ID: 11 }] : ((k.id == 402) ? [{ Object_ID: 10 }] : []); } },
        { re: /FROM t_operation WHERE/i, rows: function (sql) { var k = key(sql); return (k.id == 501 || k.guid == "{OP-BL}") ? [{ Object_ID: 11 }] : ((k.id == 502 || k.guid == "{OP-FREE}") ? [{ Object_ID: 10 }] : []); } },
        { re: /COUNT\(\*\) AS c FROM t_object/i, rows: function (sql) { var ids = inList(sql, "Package_ID"); return [{ c: EL.filter(function (e) { return ids.indexOf(e[1]) >= 0; }).length }]; } },
        { re: /COUNT\(\*\) AS c FROM t_diagram/i, rows: [{ c: 0 }] },
        { re: /FROM t_document/i, rows: [] }
    ];
    var repo = mkRepo({ sqlRules: rules, securityEnabled: opts.securityEnabled, login: opts.login });
    PK.forEach(function (p) { repo._addPackage({ id: p[0], parentID: p[1], name: p[2], guid: p[3] }); });
    function mkConn(owner) { return function (n, t) { return { ConnectorID: ++guidSeq, ConnectorGUID: mkGuid(), Name: n, Type: t, ClientID: owner.ElementID, SupplierID: 0, Notes: "", StereotypeEx: "", Direction: "", TransitionEvent: "", TransitionAction: "", TransitionGuard: "", DiagramID: 0,
        ClientEnd: { Update: function () { return true; } }, SupplierEnd: { Update: function () { return true; } }, TaggedValues: mkColl(function (n2) { return { Name: n2, Value: "", Update: function () { return true; } }; }),
        Update: function () { return true; }, GetLastError: function () { return ""; } }; }; }
    EL.forEach(function (e) { var el = repo._addElement({ id: e[0], packageID: e[1], parentID: e[2], name: e[3], guid: e[4], type: e[5] }); el.Connectors = mkColl(mkConn(el)); el.Elements = mkColl(); el.Diagrams = mkColl(); el.Methods = mkColl();
        el.Attributes = mkColl(function (n, t) { return { AttributeID: ++guidSeq, Name: n, Type: t, Notes: "", Default: "", Visibility: "", Stereotype: "", Alias: "", IsStatic: false, IsConst: false, IsOrdered: false, AllowDuplicates: false, LowerBound: "", UpperBound: "", ClassifierID: 0, TaggedValues: mkColl(function (n2) { return { Name: n2, Value: "", Update: function () { return true; } }; }), Update: function () { return true; }, GetLastError: function () { return ""; } }; });
        el.Clone = function () { var c = repo._addElement({ name: el.Name + " (klon)", packageID: el.PackageID }); c.Diagrams = mkColl(); return c; }; });
    EL.forEach(function (e) { var el = repo.GetElementByID(e[0]); if (e[2] > 0) { var ow = repo.GetElementByID(e[2]); if (ow) { ow.Elements._items.push(el); } } else { repo.GetPackageByID(e[1]).Elements._items.push(el); } });
    var conns = {};
    CN.forEach(function (c) { var cn = { ConnectorID: c[0], ConnectorGUID: c[3], ClientID: c[1], SupplierID: c[2], Type: "Association", Name: "", Notes: "", Stereotype: "", Direction: "",
        ClientEnd: { Update: function () { return true; } }, SupplierEnd: { Update: function () { return true; } }, TaggedValues: mkColl(function (n) { return { Name: n, Value: "", Update: function () { return true; } }; }),
        Update: function () { return true; }, GetLastError: function () { return ""; } };
        conns[c[0]] = cn; conns[c[3]] = cn; var src = repo.GetElementByID(c[1]); if (src) { src.Connectors._items.push(cn); } });
    repo.GetConnectorByID = function (id) { return conns[id] || null; };
    repo.GetConnectorByGuid = function (g) { return conns[g] || null; };
    var dgs = {};
    DG.forEach(function (d) { var dg = { DiagramID: d[0], DiagramGUID: d[4], PackageID: d[1], ParentID: d[2], Name: d[3], Type: "Logical", Notes: "", Update: function () { return true; }, GetLastError: function () { return ""; },
        DiagramObjects: mkColl(function () { return { ElementID: 0, left: 0, right: 0, top: 0, bottom: 0, Sequence: 0, Style: "", Update: function () { return true; }, GetLastError: function () { return ""; } }; }), DiagramLinks: mkColl() };
        dgs[d[0]] = dg; dgs[d[4]] = dg; });
    repo.GetDiagramByID = function (id) { return dgs[id] || null; };
    repo.GetDiagramByGuid = function (g) { return dgs[g] || null; };
    PK.forEach(function (p) { var pk = repo.GetPackageByID(p[0]); pk.Diagrams = mkColl(); pk.Clone = function () { return repo._addPackage({ name: pk.Name + " (klon)", parentID: pk.ParentID }); }; });
    repo.GetMethodByID = function (id) { return (id == 501 || id == 502) ? { MethodID: id, MethodGUID: (id == 501 ? "{OP-BL}" : "{OP-FREE}"), Name: "op", Notes: "", ReturnType: "", Parameters: mkColl() } : null; };
    repo.GetMethodByGuid = function (g) { return (g == "{OP-BL}") ? repo.GetMethodByID(501) : ((g == "{OP-FREE}") ? repo.GetMethodByID(502) : null); };
    repo.GetProjectInterface = function () { return { GUIDtoXML: function (g) { return g; }, CreateBaseline: function () { return true; }, GetBaselines: function () { return "<EA.BaseLines></EA.BaseLines>"; }, DeleteBaseline: function () { return true; } }; };
    return repo;
}
function scopeRun(repo, ops, id, scope, extra) {
    delete B._fbAccessCache; delete B._fbPrevExc;
    var body = { protocol: "eafb/0.2", id: id, repo: "EAEXAMPLE.QEA", ops: ops };
    if (extra) { for (var k in extra) { body[k] = extra[k]; } }
    return withScope(scope || scopeBL(), function () { return JSON.parse("" + B.FB_Main.call(B, repo, JSON.stringify(body))); });
}
function scopeCfgOk(repo, scope) {
    return withScope(scope || scopeBL(), function () { B._fbScopeCfg = null; return B.FB_WriteScopeCfg.call(B, repo); });
}
t("CZ-00a skutecny FB_WriteScope: tvar polozek (repo, pole blacklist, pkg jako {GUID}, name, note), repa shodna s FB_Config/FB_OpsAllowed, zadna bankovni hodnota", function () {
    var live = FB_WRITESCOPE_LIVE.call(B);
    ok(Array.isArray(live) && live.length >= 2, "pole s domacimi modely");
    var cfgRepos = {}, cfgArr = B.FB_Config.call(B);
    for (var c = 0; c < cfgArr.length; c++) { cfgRepos[cfgArr[c].repo] = 1; }
    for (var i = 0; i < live.length; i++) {
        var e = live[i];
        ok(typeof e.repo == "string" && e.repo.length > 0, "repo[" + i + "]");
        ok(cfgRepos[e.repo] === 1, "repo '" + e.repo + "' musi mit polozku i ve FB_Config");
        ok(Array.isArray(e.blacklist), "blacklist[" + i + "] je pole");
        ok(e.cascadeDelete == "allow" || e.cascadeDelete == "block", "cascadeDelete[" + i + "] = allow|block (doma allow): " + e.cascadeDelete);
        ok(!/<TEST-DB>|<PROTECTED/.test(e.repo), "zadne bankovni placeholdery v kodu");
        for (var b = 0; b < e.blacklist.length; b++) {
            var w = e.blacklist[b];
            ok(/^\{[0-9A-Fa-f-]{36}\}$/.test("" + w.pkg), "pkg je {GUID}: " + w.pkg);
            ok(typeof w.name == "string" && w.name.length > 0, "name povinne");
            ok(typeof w.note == "string", "note");
        }
    }
});
t("CZ-00 mock: konfigurace cile zapisu nad scopeRepo je v poradku (blacklist nalezen, audit + add-in implicitne chraneny)", function () {
    var c = scopeCfgOk(scopeRepo());
    eq(c.problems.join("; "), "", "bez vad");
    eq(c.blacklist[0].found, true); eq(c.blacklist[0].path, "Model.FBT-CHRANENE");
    ok(c.protectedIds["900"] && c.protectedIds["950"] && c.protectedIds["960"], "chranene: 900 blacklist, 950 audit, 960 add-in");
    ok(c.ancestorIds["1"] && c.ancestorIds["1"].length == 3, "koren Model je predkem 3 chranenych vetvi");
});
t("CZ-02 FB-CZ-02: vady konfigurace -> E_SCOPE_CONFIG se seznamem (chybejici blacklist, GUID neni, jmeno nesedi, chybejici auditPkg, balicek add-inu s cizim obsahem)", function () {
    var repo = scopeRepo();
    var c1 = scopeCfgOk(repo, [{ repo: "EAEXAMPLE.QEA" }]);
    contains(c1.problems.join("; "), "nema klic blacklist");
    var c2 = scopeCfgOk(repo, [{ repo: "EAEXAMPLE.QEA", blacklist: [{ pkg: "{PKG-NENI}", name: "FBT-CHRANENE", note: "" }] }]);
    contains(c2.problems.join("; "), "nenalezen"); contains(c2.problems.join("; "), "existuje s GUID {PKG-BL} - preklep?", "napoveda podle jmena (I11)");
    var c3 = scopeCfgOk(repo, [{ repo: "EAEXAMPLE.QEA", blacklist: [{ pkg: "{PKG-BL}", name: "Jine jmeno", note: "" }] }]);
    contains(c3.problems.join("; "), "se jmenuje 'FBT-CHRANENE', konfigurace ceka 'Jine jmeno'");
    var oC = B.FB_Config; B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", srcDir: "x" }]; };
    try { var c4 = scopeCfgOk(repo); contains(c4.problems.join("; "), "auditPkg"); } finally { B.FB_Config = oC; }
    var c5 = scopeCfgOk(scopeRepo({ addinForeign: true }));
    contains(c5.problems.join("; "), "presun add-in do vlastniho balicku"); contains(c5.problems.join("; "), "Cizi prvek");
    var r = scopeRun(scopeRepo({ addinForeign: true }), [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": "{PKG-FREE}" }] }], "cz02");
    eq(r.code, "E_SCOPE_CONFIG"); eq(r.results[0].status, "skipped"); ok(r.problems.length >= 1);
    var rr = scopeRun(scopeRepo({ addinForeign: true }), [{ op: "get_elements_information", elements: ["{EL-FREE}"] }], "cz02r");
    eq(rr.status, "done", "cteni bezi: " + JSON.stringify(rr).substring(0, 200));
});
t("CZ-02b opravny kanal: vadna konfigurace NEZASTAVI davku slozenou jen z deploy_src (jinak by se preklep nedal doma opravit); deploy_src + jiny zapis = E_SCOPE_CONFIG", function () {
    var rd = scopeRun(scopeRepo({ addinForeign: true }), [{ op: "deploy_src" }], "cz02d");
    ok(rd.code != "E_SCOPE_CONFIG", "deploy_src sam neni E_SCOPE_CONFIG: " + JSON.stringify(rd).substring(0, 300));
    ok(rd.status == "confirm_required" || rd.status == "done" || rd.status == "error", "deploy_src dosel az k Risk Gate: " + rd.status);
    var rm = scopeRun(scopeRepo({ addinForeign: true }), [{ op: "deploy_src" }, { op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": "{PKG-FREE}" }] }], "cz02dm");
    eq(rm.code, "E_SCOPE_CONFIG", "smisena davka zustava zastavena");
});
t("CZ-01 FB-CZ-01: cil mimo byvaly sandbox (volny balicek) projde; jiny repozitar bez polozky = E_REPO, nic neprovedeno", function () {
    var repo = scopeRepo();
    var r = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": "{PKG-FREE}" }] }], "cz01");
    eq(r.status, "done", JSON.stringify(r).substring(0, 300));
    var chk = withScope([{ repo: "JINY.QEA", blacklist: [] }], function () { return B.FB_CheckWrite.call(B, repo, repo.GetPackageByID(2)); });
    eq(chk.code, "E_REPO");
});
// --- FB-CZ-07: tabulkovy test VSECH zapisovych operaci registru (operace bez radku = test spadne) ---
var CZ07 = {
    "create_element":                  { op: "create_element", "package": "{PKG-BL}", name: "N", type: "Class" },
    "create_or_update_elements":       { op: "create_or_update_elements", elements: [{ guid: "{EL-BL}", name: "N" }] },
    "move_elements":                   { op: "move_elements", "package": "{PKG-BL}", elements: ["{EL-FREE}"] },
    "create_or_update_package":        { op: "create_or_update_package", packages: [{ guid: "{PKG-BL-SUB}", name: "N" }] },
    "create_or_update_connectors":     { op: "create_or_update_connectors", connectors: [{ guid: "{CN-BOTH}", name: "N" }] },
    "create_or_update_attributes":     { op: "create_or_update_attributes", element: "{EL-BL}", attributes: [{ name: "a" }] },
    "create_or_update_operations":     { op: "create_or_update_operations", element: "{EL-BL}", operations: [{ name: "o" }] },
    "create_or_update_messages":       { op: "create_or_update_messages", messages: [{ guid: "{CN-BOTH}", name: "m" }] },
    "delete_from_model":               { op: "delete_from_model", targets: [{ type: "Element", guid: "{EL-BL}" }] },
    "delete_taggedvalue_from_model":   { op: "delete_taggedvalue_from_model", targets: [{ type: "ElementTaggedValue", guid: "{EL-BL}", name: "t" }] },
    "remove_elements_from_diagram":    { op: "remove_elements_from_diagram", diagram: "{DG-BL}", elementIDs: ["{EL-FREE}"] },
    "create_baseline":                 { op: "create_baseline", "package": "{PKG-BL}" },
    "clone_package":                   { op: "clone_package", "package": "{PKG-BL}" },
    "clone_elements":                  { op: "clone_elements", elements: ["{EL-BL}"] },
    "import_element_linked_documents": { op: "import_element_linked_documents", documents: [{ element: "{EL-BL}", file: "x.rtf" }] },
    "layout_connectors":               { op: "layout_connectors", diagram: "{DG-BL}", style: "x" },
    "change_connector_visibility":     { op: "change_connector_visibility", diagram: "{DG-BL}", connectorIDs: [302], hidden: true },
    "update_diagram_properties":       { op: "update_diagram_properties", diagrams: [{ diagram: "{DG-BL}", name: "N" }] },
    "set_diagram_object_style":        { op: "set_diagram_object_style", diagram: "{DG-BL}", objects: [{ element: "{EL-FREE}" }] },
    "create_or_update_diagram":        { op: "create_or_update_diagram", diagrams: [{ guid: "{DG-BL}", name: "N" }] },
    "place_elements_on_diagram":       { op: "place_elements_on_diagram", diagram: "{DG-BL}", elementPlacements: [{ element: "{EL-FREE}" }] },
    "create_or_update_scenarios":      { op: "create_or_update_scenarios", element: "{EL-BL}", scenarios: [{ name: "BE", type: "Basic Path", steps: [{ text: "k" }] }] },
    "create_or_update_constraints":    { op: "create_or_update_constraints", element: "{EL-BL}", constraints: [{ name: "c" }] },
    "create_or_update_requirements":   { op: "create_or_update_requirements", element: "{EL-BL}", requirements: [{ name: "r" }] },
    "apply_classifier_stereotypes":    { op: "apply_classifier_stereotypes", diagram: "{DG-FREE}", elementIDs: ["{EL-BL}"] },
    "find_or_create_referencing_sr":   { op: "find_or_create_referencing_sr", targetPackage: "{PKG-BL}", operation: 502, packageName: "SR" },
    "deploy_src":                      { op: "deploy_src", files: [] }
};
t("CZ-07 FB-CZ-07: kazda z 27 zapisovych operaci registru odmitne cil v chranene casti kodem E_BLACKLIST (deploy_src = E_OP_FORBIDDEN/E_RISK_BLOCKED podle B4); operace bez radku = test spadne", function () {
    var reg = regFull(), missing = [], nW = 0;
    for (var op in reg) { if (reg[op].w) { nW++; if (!CZ07[op]) { missing.push(op); } } }
    eq(missing.join(","), "", "zapisove operace BEZ radku v tabulce CZ07");
    ok(nW >= 27, "registr ma mit aspon 27 zapisovych operaci, nalezeno " + nW);
    var bad = [];
    for (var name in CZ07) {
        if (!reg[name] || !reg[name].w) { bad.push(name + ": radek mimo registr"); continue; }
        var repo = scopeRepo();
        var r;
        if (name == "deploy_src") {
            var oA = B.FB_OpsAllowed; B.FB_OpsAllowed = function () { return [{ repo: "EAEXAMPLE.QEA", allow: ["*"], deny: ["deploy_src"] }]; };
            try { r = scopeRun(repo, [CZ07[name]], "cz07-" + name); } finally { B.FB_OpsAllowed = oA; }
            if (r.code != "E_OP_FORBIDDEN" && r.code != "E_RISK_BLOCKED") { bad.push(name + ": " + r.code + " " + ("" + r.message).substring(0, 160)); }
            continue;
        }
        r = scopeRun(repo, [CZ07[name]], "cz07-" + name);
        if (r.code != "E_BLACKLIST") { bad.push(name + ": " + r.code + " " + ("" + r.message).substring(0, 200)); continue; }
        if (!r.results || r.results.length != 1 || r.results[0].status != "skipped") { bad.push(name + ": vysledek neni skipped"); }
        if (!r.audit || typeof r.audit.aiLogGuid != "string") { bad.push(name + ": E_BLACKLIST bez auditu"); }
        if (!/FBT-CHRANENE/.test(r.message + JSON.stringify(r.problems))) { bad.push(name + ": zprava nejmenuje chranenou vetev (FB-CZ-28)"); }
    }
    eq(bad.join(" | "), "", "radky, ktere neprosly");
});
t("CZ-08 FB-CZ-08: jediny zakazany cil = davka se neprovede vubec (nic, ani zaloha), soubor do rejected\\, audit v #AI-LOG", function () {
    b1Reset(); var repo = scopeRepo();
    var created = 0; var oE = B.FB_OpElements; B.FB_OpElements = function () { created++; return { op: "create_or_update_elements", status: "ok", items: [] }; };
    var baselines = 0; var oB = B.FB_AutoBaseline; B.FB_AutoBaseline = function () { baselines++; return { status: "created", name: "x", guid: "{b}" }; };
    try {
        var r = withScope(scopeBL(), function () { return pumpRun(repo, [
            { op: "create_or_update_elements", elements: [{ guid: "{EL-FREE}", name: "ok" }] },
            { op: "create_or_update_elements", elements: [{ guid: "{EL-BL}", name: "zakazano" }] }], "cz08"); });
        eq(r.code, "E_BLACKLIST", JSON.stringify(r).substring(0, 300)); eq(created, 0, "nic se neprovedlo"); eq(baselines, 0, "ani zaloha");
        eq(r.results[0].status, "skipped"); eq(r.results[1].status, "skipped");
        eq(r.problems[0].op, 1); contains(r.problems[0].path, "ops[1].elements[0]");
        ok(r.audit && typeof r.audit.aiLogGuid == "string", "audit volan");
        eq(b1Files(B1_REQ + "\\rejected\\").length, 1, "soubor v rejected\\"); eq(b1Files(B1_PEND + "\\").length, 0);
    } finally { B.FB_OpElements = oE; B.FB_AutoBaseline = oB; }
});
t("CZ-09 FB-CZ-09: kontrola pri provedeni nad skutecnym objektem - dedupKey, match composite, matchByName, owningElement, $N -> E_BLACKLIST, chraneny objekt beze zmeny", function () {
    var repo = scopeRepo();
    var bl = repo.GetElementByID(11), blName = bl.Name;
    // dedupKey prvku miri do chranene casti (P2 i provedeni)
    var r1 = withScope(scopeBL(), function () { return B.FB_OpElements.call(B, repo, { op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": "{PKG-FREE}", dedupKey: "k-bl" }] }, "cz09a"); });
    eq(r1.code, "E_BLACKLIST", JSON.stringify(r1).substring(0, 200)); eq(bl.Name, blName);
    // owningElement v chranene casti
    var ownedBefore = bl.Elements.Count;
    var r2 = withScope(scopeBL(), function () { return B.FB_OpElements.call(B, repo, { op: "create_or_update_elements", elements: [{ name: "N", type: "Class", owningElement: "{EL-BL}" }] }, "cz09b"); });
    eq(r2.code, "E_BLACKLIST"); eq(bl.Elements.Count, ownedBefore);
    // osa vlastniku (I14): prvek ve volnem balicku vlastneny chranenym prvkem
    var owned = repo.GetElementByID(13);
    var r3 = withScope(scopeBL(), function () { return B.FB_OpElements.call(B, repo, { op: "create_or_update_elements", elements: [{ guid: "{EL-OWNED}", name: "N" }] }, "cz09c"); });
    eq(r3.code, "E_BLACKLIST", JSON.stringify(r3).substring(0, 200)); contains(r3.message, "vlastnik"); eq(owned.Name, "VolnyVlastneny");
    // matchByName v chranenem balicku = cil balicek -> E_BLACKLIST; $N na chraneny prvek pri provedeni
    var r4 = withScope(scopeBL(), function () { return B.FB_OpElements.call(B, repo, { op: "create_or_update_elements", elements: [{ name: "ChranenyPrvek", type: "Class", "package": "{PKG-BL}", matchByName: true }] }, "cz09d"); });
    eq(r4.code, "E_BLACKLIST");
    // $N se pri provedeni rozresolvuje na GUID (FB_Main.resolveRefs) -> handler dostane totez jako tady
    var r5 = withScope(scopeBL(), function () { return B.FB_OpAttributes.call(B, repo, { op: "create_or_update_attributes", element: "{EL-BL}", attributes: [{ name: "a" }] }, "cz09e"); });
    eq(r5.code, "E_BLACKLIST", JSON.stringify(r5).substring(0, 400)); eq(bl.Attributes.Count, 0);
    // B2 + pravidlo "oba konce" (12. 10.): konektor dohledany pres dedupKey s OBEMA konci v chranene casti (305: 11->12),
    // s VOLNYMI source/target v requestu -> E_BLACKLIST (kontrola nad skutecnymi konci, ne nad requestem)
    var cn = repo.GetConnectorByID(305);
    var r6 = withScope(scopeBL(), function () { return B.FB_OpConnectors.call(B, repo, { op: "create_or_update_connectors", connectors: [{ source: "{EL-FREE}", target: "{EL-FREE2}", type: "Association", dedupKey: "ck-both" }] }, "cz09f"); });
    eq(r6.code, "E_BLACKLIST", JSON.stringify(r6).substring(0, 300)); contains(r6.message, "oba konce existujici vazby"); eq(cn.ClientID, 11, "vazba beze zmeny"); eq(cn.SupplierID, 12);
    var r6p = scopeRun(repo, [{ op: "create_or_update_connectors", connectors: [{ source: "{EL-FREE}", target: "{EL-FREE2}", type: "Association", dedupKey: "ck-both" }] }], "cz09g");
    eq(r6p.code, "E_BLACKLIST", "P2 chyta dedupKey konektoru: " + JSON.stringify(r6p).substring(0, 300));
    // konektor 301 (11->10, jeden konec volny) dohledany pres dedupKey uz chraneny NENI (pravidlo "oba konce")
    var cn1 = repo.GetConnectorByID(301);
    var r6b = withScope(scopeBL(), function () { return B.FB_OpConnectors.call(B, repo, { op: "create_or_update_connectors", connectors: [{ source: "{EL-FREE}", target: "{EL-FREE2}", type: "Association", dedupKey: "ck-bl", name: "volna" }] }, "cz09fb"); });
    eq(r6b.status, "ok", "vazba s jednim volnym koncem neni chranena: " + JSON.stringify(r6b).substring(0, 300)); eq(cn1.Name, "volna");
    // match composite nad existujicim konektorem s obema konci v chranene casti 305 (11->12)
    var r7 = withScope(scopeBL(), function () { return B.FB_OpConnectors.call(B, repo, { op: "create_or_update_connectors", connectors: [{ source: "{EL-BL}", target: "{EL-BL-SUB}", type: "Association", match: "composite", name: "prejmenovat" }] }, "cz09h"); });
    eq(r7.code, "E_BLACKLIST", JSON.stringify(r7).substring(0, 300)); eq(cn.Name, "");
});
t("CZ-10 FB-CZ-10: mazani balicku s chranenym podstromem -> E_BLACKLIST; kaskady mazani do chranene casti (W2 b diagram, W2 c klasifikator) podle cascadeDelete: block = E_BLACKLIST, allow = provede se s varovanim; prichozi vazba s chranenym zdrojem (W2 a) mazani uz NEBRANI (pravidlo 'oba konce' 12. 10.)", function () {
    var repo = scopeRepo();
    var r1 = scopeRun(repo, [{ op: "delete_from_model", targets: [{ type: "Package", guid: "{PKG-ROOT}" }] }], "cz10a");
    ok(r1.code == "E_BLACKLIST" || r1.code == "E_ARGS", "koren: " + r1.code);
    // volny balicek, ktery obsahuje chranenou vetev (audit pod Model - pouzij blacklist pod Volne)
    var r2 = scopeRun(repo, [{ op: "delete_from_model", targets: [{ type: "Package", guid: "{PKG-FREE}" }] }], "cz10b",
        [{ repo: "EAEXAMPLE.QEA", blacklist: [{ pkg: "{PKG-ONE}", name: "Jedinacek", note: "pod Volne" }] }]);
    eq(r2.code, "E_BLACKLIST", JSON.stringify(r2).substring(0, 300)); contains(r2.problems[0].message, "podstrom");
    // W2 b: volny prvek 14 na chranenem diagramu 101; bez vyskytu projde (vychozi cascadeDelete = block, kdyz klic chybi)
    var r3 = withScope(scopeBL(), function () { return B.FB_OpDelete.call(B, repo, { op: "delete_from_model", targets: [{ type: "Element", guid: "{EL-FREE2}" }] }, "cz10c"); });
    eq(r3.status, "ok", "prvek 14 na zadnem chranenem diagramu neni: " + JSON.stringify(r3).substring(0, 200));
    var repoB = scopeRepo({ diagramObjects: [[101, 14]] });
    var r4 = withScope(scopeBL(), function () { return B.FB_OpDelete.call(B, repoB, { op: "delete_from_model", targets: [{ type: "Element", guid: "{EL-FREE2}" }] }, "cz10d"); });
    eq(r4.code, "E_BLACKLIST", JSON.stringify(r4).substring(0, 300)); contains(r4.message, "CHRANENEM/CHRANENYCH diagramu"); contains(r4.message, "cascadeDelete = block");
    ok(repoB.GetElementByID(14) != null, "prvek nesmazan");
    // W2 a (ZRUSENO 12. 10.): prichozi vazba se zdrojem v chranene casti (301: 11 -> 10) mazani prvku 10 NEBRANI
    var repoC = scopeRepo({ diagramObjects: [] });
    var r5 = withScope(scopeBL(), function () { return B.FB_OpDelete.call(B, repoC, { op: "delete_from_model", targets: [{ type: "Element", guid: "{EL-FREE}" }] }, "cz10e"); });
    eq(r5.status, "ok", "vazba s jednim volnym koncem neni chranena - prvek 10 se smaze: " + JSON.stringify(r5).substring(0, 300));
    // W2 c: klasifikator instanci v chranene casti - block (vychozi) = E_BLACKLIST
    var repoD = scopeRepo({ diagramObjects: [], classifierInstances: [[14, 11]] });
    var r6 = withScope(scopeBL(), function () { return B.FB_OpDelete.call(B, repoD, { op: "delete_from_model", targets: [{ type: "Element", guid: "{EL-FREE2}" }] }, "cz10f"); });
    eq(r6.code, "E_BLACKLIST", JSON.stringify(r6).substring(0, 300)); contains(r6.message, "klasifikatorem 1 instanci"); ok(repoD.GetElementByID(14) != null, "prvek nesmazan");
    // mazani vazby: jeden konec volny (301 11->10) projde; oba konce chranene (305 11->12) E_BLACKLIST
    var r7 = withScope(scopeBL(), function () { return B.FB_OpDelete.call(B, scopeRepo(), { op: "delete_from_model", targets: [{ type: "Connector", guid: "{CN-BL}" }] }, "cz10g"); });
    eq(r7.status, "ok", "vazba z chraneneho zdroje do volneho cile se mazat smi: " + JSON.stringify(r7).substring(0, 200));
    var r7b = withScope(scopeBL(), function () { return B.FB_OpDelete.call(B, scopeRepo(), { op: "delete_from_model", targets: [{ type: "Connector", guid: "{CN-BOTH}" }] }, "cz10gb"); });
    eq(r7b.code, "E_BLACKLIST", JSON.stringify(r7b).substring(0, 300)); contains(r7b.message, "oba konce konektoru");
    var r7p = scopeRun(scopeRepo(), [{ op: "delete_from_model", targets: [{ type: "Connector", guid: "{CN-BOTH}" }] }], "cz10gp");
    eq(r7p.code, "E_BLACKLIST", "P2: " + JSON.stringify(r7p).substring(0, 300)); contains(r7p.problems[0].message, "oba konce existujici vazby");
    var r8 = withScope(scopeBL(), function () { return B.FB_OpDelete.call(B, scopeRepo(), { op: "delete_from_model", targets: [{ type: "Connector", guid: "{CN-IN}" }] }, "cz10h"); });
    eq(r8.status, "ok", "vazba z volneho zdroje do chraneneho cile se mazat smi: " + JSON.stringify(r8).substring(0, 200));
});
t("CZ-10c prepinac cascadeDelete (rozhodnuti Milose 12. 10. 2026, varianta c): allow = kaskady W2 b/c se povoli s DURAZNYM varovanim, vycet je uz v P2 (cascades[]) a v textu potvrzovaciho okna; block = E_BLACKLIST v P2 pred oknem; chybi = block; jina hodnota = E_SCOPE_CONFIG", function () {
    function sc(mode) { var e = scopeBL()[0]; if (typeof mode != "undefined") { e.cascadeDelete = mode; } return [e]; }
    eq(scopeCfgOk(scopeRepo(), sc()).cascadeDelete, "block", "chybi = block (fail-closed)");
    eq(scopeCfgOk(scopeRepo(), sc("allow")).cascadeDelete, "allow");
    var bad = scopeCfgOk(scopeRepo(), sc("maybe"));
    contains(bad.problems.join("; "), "cascadeDelete musi byt");
    // provedeni (allow): prvek 14 na chranenem diagramu + klasifikator chranene instance -> ok + 2 varovani
    var repoA = scopeRepo({ diagramObjects: [[101, 14]], classifierInstances: [[14, 11]] });
    var ra = withScope(sc("allow"), function () { return B.FB_OpDelete.call(B, repoA, { op: "delete_from_model", targets: [{ type: "Element", guid: "{EL-FREE2}" }] }, "cz10ca"); });
    eq(ra.status, "ok", JSON.stringify(ra).substring(0, 400)); eq(ra.items[0].deleted, true);
    ok(ra.warnings && ra.warnings.length == 2, "2 varovani: " + JSON.stringify(ra.warnings));
    contains(ra.warnings[0], "VAROVANI (kaskada mazani do chranene casti"); contains(ra.warnings[0], "Model.FBT-CHRANENE.ChranenyDg"); contains(ra.warnings[1], "Classifier = 0"); contains(ra.warnings[1], "NEKRYJE");
    // P2 (allow): davka pres pumpu = confirm_required (mazani je ELEVATED), res nese cascades[] i risk.cascades, okno vycet ukaze
    b1Reset();
    var repoP = scopeRepo({ diagramObjects: [[101, 14]], classifierInstances: [[14, 11]] });
    var rp = withScope(sc("allow"), function () { return pumpRun(repoP, [{ op: "delete_from_model", targets: [{ type: "Element", guid: "{EL-FREE2}" }] }], "cz10cp"); });
    eq(rp.status, "confirm_required", JSON.stringify(rp).substring(0, 400));
    ok(rp.cascades && rp.cascades.length == 2, "cascades[] v odpovedi: " + JSON.stringify(rp.cascades));
    eq(rp.cascades[0].kind, "diagram"); eq(rp.cascades[0].count, 1); eq(rp.cascades[0].items[0], "Model.FBT-CHRANENE.ChranenyDg");
    eq(rp.cascades[1].kind, "classifier"); eq(rp.cascades[1].items[0], "Model.FBT-CHRANENE.ChranenyPrvek");
    ok(rp.risk && rp.risk.cascades && rp.risk.cascades.length == 2, "risk.cascades");
    ok(/kaskada mazani do chranene casti/.test(rp.risk.riskReasons.join(" | ")), "duvod okna: " + rp.risk.riskReasons.join(" | "));
    var sum = "" + B.FB_ConfirmSummary.call(B, rp);
    contains(sum, "POZOR - smazani sahne kaskadou EA do CHRANENE casti"); contains(sum, "Model.FBT-CHRANENE.ChranenyDg"); contains(sum, "Classifier = 0");
    ok(repoP.GetElementByID(14) != null, "pred potvrzenim nic nesmazano");
    // P2 (block): tataz davka = E_BLACKLIST pred oknem, nic neprovedeno, soubor v rejected\\
    b1Reset();
    var repoQ = scopeRepo({ diagramObjects: [[101, 14]] });
    var rq = withScope(sc("block"), function () { return pumpRun(repoQ, [{ op: "delete_from_model", targets: [{ type: "Element", guid: "{EL-FREE2}" }] }], "cz10cq"); });
    eq(rq.code, "E_BLACKLIST", JSON.stringify(rq).substring(0, 400)); eq(rq.results[0].status, "skipped");
    contains(rq.problems[0].message, "cascadeDelete = block"); eq(rq.problems[0].cascade, "diagram"); eq(rq.problems[0].items[0], "Model.FBT-CHRANENE.ChranenyDg");
    ok(repoQ.GetElementByID(14) != null, "prvek nesmazan"); eq(b1Files(B1_REQ + "\\rejected\\").length, 1, "soubor v rejected\\");
    // kaskada balicku: obsah podstromu jde pres P2 (mock vraci [] pro subselect - jen ze SQL nespadne a davka dojde k oknu)
    var rk = withScope(sc("allow"), function () { return scopeRun(scopeRepo(), [{ op: "delete_from_model", targets: [{ type: "Package", guid: "{PKG-ONE}" }] }], "cz10ck"); });
    ok(rk.code != "E_BLACKLIST" && rk.code != "E_EXCEPTION", "mazani volneho balicku bez kaskad dojde k Risk Gate: " + rk.code + " " + ("" + rk.message).substring(0, 160));
});
t("CZ-10b FB-CZ-10b (W1): uklid automatickych baselines vynecha a vykaze kandidaty v chranenych balickach", function () {
    var repo = scopeRepo();
    var old = "FB-AUTO milos s20260101-1 2026-01-01 10:00:00";
    var newer = "FB-AUTO milos s20260102-1 2026-01-02 10:00:00";
    repo._sqlRules.unshift({ re: /FROM t_document d WHERE/i, rows: [
        { DocID: "{B-BL}", ElementID: "{PKG-BL}", Version: old, DocDate: "2026-01-01 10:00:00", DocName: "FBT-CHRANENE" },
        { DocID: "{B-BL2}", ElementID: "{PKG-BL}", Version: newer, DocDate: "2026-01-02 10:00:00", DocName: "FBT-CHRANENE" },
        { DocID: "{B-FREE}", ElementID: "{PKG-FREE}", Version: old, DocDate: "2026-01-01 10:00:00", DocName: "Volne" },
        { DocID: "{B-FREE2}", ElementID: "{PKG-FREE}", Version: newer, DocDate: "2026-01-02 10:00:00", DocName: "Volne" },
        { DocID: "{B-AUD}", ElementID: SC_AUDIT_GUID, Version: old, DocDate: "2026-01-01 10:00:00", DocName: "#AI-LOG" },
        { DocID: "{B-AUD2}", ElementID: SC_AUDIT_GUID, Version: newer, DocDate: "2026-01-02 10:00:00", DocName: "#AI-LOG" }] });
    var cfg = B.FB_BaselineConfig.call(B, repo).cfg; cfg.cleanup.keepLastK = 1; cfg.cleanup.maxAgeDays = 1;
    var parsed = B.FB_BaselineName.call(B, "parse", old, "FB-AUTO ");
    ok(parsed != null, "jmeno mocku musi projit filtrem FB_BaselineName");
    var r = withScope(scopeBL(), function () { return B.FB_BaselineCleanup.call(B, repo, cfg, "report", false, new Date().getTime()); });
    eq(r["protected"], 2, "2 kandidati v chranenych balickach (blacklist + audit) vynechani: " + JSON.stringify(r).substring(0, 400));
    eq(r.candidates.length, 1); eq(r.candidates[0].pkgGuid, "{PKG-FREE}");
    contains(r.text, "Vynechano 2 kandidatu v chranenych balickach");
});
t("CZ-11 FB-CZ-11: implicitni ochrana - balicek add-inu a balicek auditu (dedicne) i bez blacklistu; audit bridge se dal zapisuje; koren: mazani E_ARGS, prejmenovani E_BLACKLIST, podbalicek pod korenem projde (okno), zapis do podbalicku korene projde (B1)", function () {
    var repo = scopeRepo();
    var EMPTY = [{ repo: "EAEXAMPLE.QEA", blacklist: [] }];
    var r1 = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": "{PKG-ADDIN}" }] }], "cz11a", EMPTY);
    eq(r1.code, "E_BLACKLIST", "balicek add-inu: " + JSON.stringify(r1).substring(0, 300)); contains(r1.problems[0].message, "addin");
    var r2 = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": SC_AUDIT_GUID }] }], "cz11b", EMPTY);
    eq(r2.code, "E_BLACKLIST", "balicek auditu: " + JSON.stringify(r2).substring(0, 300)); contains(r2.problems[0].message, "audit");
    ok(r2.audit && typeof r2.audit.aiLogGuid == "string", "audit bridge se dal zapisuje (FB_Audit mimo kontrolu)");
    var r3 = scopeRun(repo, [{ op: "create_or_update_package", packages: [{ guid: "{PKG-ROOT}", name: "Prejmenovany koren" }] }], "cz11c", EMPTY);
    eq(r3.code, "E_BLACKLIST", "prejmenovani korene: " + JSON.stringify(r3).substring(0, 300)); contains(r3.problems[0].message, "KOREN");
    var r3x = withScope(EMPTY, function () { return B.FB_OpPackage.call(B, repo, { op: "create_or_update_package", packages: [{ guid: "{PKG-ROOT}", name: "X" }] }, "cz11cx"); });
    eq(r3x.code, "E_BLACKLIST", "druha obrana pri provedeni"); eq(repo.GetPackageByID(1).Name, "Model");
    var r4 = scopeRun(repo, [{ op: "delete_from_model", targets: [{ type: "Package", guid: "{PKG-ROOT}" }] }], "cz11d", EMPTY);
    ok(r4.code == "E_ARGS" || r4.code == "E_BLACKLIST", "mazani korene: " + r4.code);
    var r5 = scopeRun(repo, [{ op: "create_or_update_package", packages: [{ parent: "{PKG-ROOT}", name: "Novy pod korenem" }] }], "cz11e", EMPTY);
    eq(r5.status, "confirm_required", "novy balicek pod korenem = okno: " + JSON.stringify(r5).substring(0, 300));
    contains(r5.risk.riskReasons.join("; "), "pod korenem modelu");
    var r6 = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": "{PKG-FREE}" }] }], "cz11f", EMPTY);
    eq(r6.status, "done", "zapis do podbalicku korene bez jine ochrany projde: " + JSON.stringify(r6).substring(0, 300));
    ok(!r6.risk.riskReasons.join("; ").match(/pod korenem/), "zadne okno kvuli koreni");
    // bez elementu AICodeBridge v modelu (mock) implicitni ochrana add-inu neplati, konfigurace neni vadna
    var c = scopeCfgOk(scopeRepo({ noBridge: true }), EMPTY);
    eq(c.problems.length, 0); eq(c.implicit.length, 1);
});
t("CZ-12 FB-CZ-12 (v1.2, pravidlo 'oba konce' 12. 10.): vazba je chranena, jen kdyz jsou OBA konce v chranene casti - zalozeni/zmena/smazani s jednim volnym koncem projde (obema smery); oba konce E_BLACKLIST; presmerovani nad novym parem koncu; allowIncomingRefs: false = zprisneni zalozeni z volne casti do chranene", function () {
    var repo = scopeRepo();
    function conn(c, id, scope) { return withScope(scope || scopeBL(), function () { return B.FB_OpConnectors.call(B, repo, { op: "create_or_update_connectors", connectors: [c] }, id); }); }
    var a = conn({ source: "{EL-BL}", target: "{EL-FREE}", type: "Realization" }, "cz12a");
    eq(a.status, "ok", "zdroj chraneny -> cil volny (krok 4b katalogu, O11 = c): " + JSON.stringify(a).substring(0, 300));
    var b = conn({ source: "{EL-FREE}", target: "{EL-BL}", type: "Dependency" }, "cz12b");
    eq(b.status, "ok", "volny -> chraneny s vychozim allowIncomingRefs true: " + JSON.stringify(b).substring(0, 300));
    var c = conn({ source: "{EL-FREE}", target: "{EL-BL}", type: "Dependency" }, "cz12c", scopeBL(false));
    eq(c.code, "E_BLACKLIST", "allowIncomingRefs: false: " + JSON.stringify(c).substring(0, 300)); contains(c.message, "allowIncomingRefs");
    var c2 = conn({ source: "{EL-BL}", target: "{EL-FREE}", type: "Dependency" }, "cz12c2", scopeBL(false));
    eq(c2.status, "ok", "allowIncomingRefs: false se tyka jen prichozich vazeb - odchozi z chranene casti projde");
    var d = conn({ source: "{EL-BL}", target: "{EL-BL-SUB}", type: "Dependency" }, "cz12d");
    eq(d.code, "E_BLACKLIST", "oba konce chranene"); contains(d.message, "oba konce");
    // zmena existujici vazby: 301 (chraneny zdroj, volny cil) PROJDE; 303 (volny zdroj, chraneny cil) PROJDE; 305 (oba) E_BLACKLIST
    var cn1 = repo.GetConnectorByID(301), cn5 = repo.GetConnectorByID(305);
    var e = conn({ guid: "{CN-BL}", name: "prejmenovana" }, "cz12e");
    eq(e.status, "ok", "update vazby s chranenym zdrojem a volnym cilem projde: " + JSON.stringify(e).substring(0, 300)); eq(cn1.Name, "prejmenovana");
    var h = conn({ guid: "{CN-IN}", name: "x" }, "cz12h");
    eq(h.status, "ok", "update vazby s volnym zdrojem a chranenym cilem projde: " + JSON.stringify(h).substring(0, 200));
    var e5 = conn({ guid: "{CN-BOTH}", name: "zakazano" }, "cz12e5");
    eq(e5.code, "E_BLACKLIST", "update vazby s obema konci v chranene casti: " + JSON.stringify(e5).substring(0, 300)); contains(e5.message, "oba konce existujici vazby"); eq(cn5.Name, "", "vazba beze zmeny");
    // presmerovani se posuzuje nad NOVYM parem koncu
    var f = conn({ guid: "{CN-FREE}", source: "{EL-BL}" }, "cz12f");
    eq(f.status, "ok", "presmerovani zdroje do chranene casti s volnym cilem projde: " + JSON.stringify(f).substring(0, 200)); eq(repo.GetConnectorByID(302).ClientID, 11);
    repo.GetConnectorByID(302).ClientID = 10; // mock zpet: 302 = volna vazba 10 -> 14
    var f2 = conn({ guid: "{CN-BL}", target: "{EL-BL-SUB}" }, "cz12f2");
    eq(f2.code, "E_BLACKLIST", "presmerovani cile tak, ze jsou oba konce chranene: " + JSON.stringify(f2).substring(0, 300)); contains(f2.message, "po presmerovani"); eq(cn1.SupplierID, 10, "vazba beze zmeny");
    var f3 = conn({ guid: "{CN-BOTH}", target: "{EL-FREE}" }, "cz12f3");
    eq(f3.code, "E_BLACKLIST", "vazba s obema konci chranenymi se nesmi ani presmerovat ven (zmena chranene vazby)"); eq(cn5.SupplierID, 12);
    var g = conn({ guid: "{CN-FREE}", target: "{EL-BL}" }, "cz12g");
    eq(g.status, "ok", "presmerovani cile do chranene vetve s allowIncomingRefs true projde: " + JSON.stringify(g).substring(0, 200));
    var g2 = conn({ guid: "{CN-FREE}", target: "{EL-BL}" }, "cz12g2", scopeBL(false));
    eq(g2.code, "E_BLACKLIST", "presmerovani cile s allowIncomingRefs false (zdroj volny)");
    // P2 chyta totez predem
    var p = scopeRun(scopeRepo(), [{ op: "create_or_update_connectors", connectors: [{ guid: "{CN-BOTH}", name: "x" }] }], "cz12p");
    eq(p.code, "E_BLACKLIST", JSON.stringify(p).substring(0, 300)); contains(p.problems[0].message, "oba konce existujici vazby");
    var p1 = scopeRun(scopeRepo(), [{ op: "create_or_update_connectors", connectors: [{ guid: "{CN-BL}", name: "x" }, { guid: "{CN-IN}", name: "y" }] }], "cz12p1");
    ok(p1.code != "E_BLACKLIST", "P2 nesmi blokovat vazby s jednim volnym koncem: " + p1.code + " " + JSON.stringify(p1.problems || []).substring(0, 200));
    // zaloha u vazby s chranenym zdrojem a volnym cilem: nad balickem VOLNEHO konce, ne nad chranenym (zivy nalez Z11-05b: E_NO_BASELINE)
    ok(p1.code != "E_NO_BASELINE", "zaloha nesmi mirit do chranene casti: " + p1.code + " " + ("" + p1.message).substring(0, 200));
    var bpk = ((p1.baseline || {}).packages || []).map(function (x) { return x.path || x.name || x.guid; });
    ok(bpk.length >= 1 && bpk.join("|").indexOf("FBT-CHRANENE") < 0 && /Volne/.test(bpk.join("|")), "zaloha nad Model.Volne: " + JSON.stringify(bpk));
    var pdel = scopeRun(scopeRepo(), [{ op: "delete_from_model", targets: [{ type: "Connector", guid: "{CN-BL}" }] }], "cz12pdel");
    var bpk2 = ((pdel.baseline || {}).packages || []).map(function (x) { return x.path || x.name || x.guid; });
    ok(pdel.code != "E_NO_BASELINE" && pdel.code != "E_BLACKLIST", "mazani vazby s volnym koncem: " + pdel.code); ok(bpk2.join("|").indexOf("FBT-CHRANENE") < 0, "zaloha mazani vazby mimo chranenou cast: " + JSON.stringify(bpk2));
    var p2 = scopeRun(scopeRepo(), [{ op: "create_or_update_connectors", connectors: [{ source: "{EL-FREE}", target: "{EL-BL}", type: "Dependency" }] }], "cz12p2", scopeBL(false));
    eq(p2.code, "E_BLACKLIST"); contains(p2.problems[0].message, "allowIncomingRefs");
    var p3 = scopeRun(scopeRepo(), [{ op: "create_or_update_connectors", connectors: [{ guid: "{CN-BL}", target: "{EL-BL-SUB}" }] }], "cz12p3");
    eq(p3.code, "E_BLACKLIST", "P2: presmerovani nad novym parem koncu: " + JSON.stringify(p3).substring(0, 300)); contains(p3.problems[0].message, "po presmerovani");
    // zpravy: tataz pravidla (update + rebuild)
    var m = withScope(scopeBL(), function () { return B.FB_OpMessages.call(B, repo, { op: "create_or_update_messages", messages: [{ guid: "{CN-BOTH}", name: "m" }] }, "cz12m"); });
    eq(m.code, "E_BLACKLIST", JSON.stringify(m).substring(0, 200)); contains(m.message, "oba konce existujici zpravy");
    var m1 = withScope(scopeBL(), function () { return B.FB_OpMessages.call(B, repo, { op: "create_or_update_messages", messages: [{ guid: "{CN-BL}", name: "m1" }] }, "cz12m1"); });
    eq(m1.status, "ok", "zprava s jednim volnym koncem se smi menit: " + JSON.stringify(m1).substring(0, 200));
    var m2 = withScope(scopeBL(), function () { return B.FB_OpMessages.call(B, repo, { op: "create_or_update_messages", messages: [{ source: "{EL-BL}", target: "{EL-FREE}", name: "m" }] }, "cz12m2"); });
    eq(m2.status, "ok", "zprava z chraneneho zdroje do volneho cile: " + JSON.stringify(m2).substring(0, 200));
    // find_or_create_referencing_sr: vazba SR -> operace v chranene vetvi podle allowIncomingRefs
    var sr = scopeRun(scopeRepo(), [{ op: "find_or_create_referencing_sr", targetPackage: "{PKG-FREE}", operation: 501, packageName: "SR" }], "cz12sr", scopeBL(false));
    eq(sr.code, "E_BLACKLIST", JSON.stringify(sr).substring(0, 300)); contains(sr.problems[0].message, "SR -> operace");
});
t("CZ-14 FB-CZ-14: klon - zdroj v chranene casti nebo zdroj obsahujici chranenou vetev -> E_BLACKLIST, zadny klon ve zdroji; cil v chranene casti -> E_BLACKLIST (W5, O4 = a)", function () {
    var repo = scopeRepo();
    var before = repo.GetPackageByID(900).Elements.Count;
    var a = withScope(scopeBL(), function () { return B.FB_OpCloneElements.call(B, repo, { op: "clone_elements", elements: ["{EL-BL}"], "package": "{PKG-FREE}" }, "cz14a"); });
    eq(a.code, "E_BLACKLIST", "zdroj chraneny, cil volny: " + JSON.stringify(a).substring(0, 200)); contains(a.message, "zdroj klonu"); eq(repo.GetPackageByID(900).Elements.Count, before, "zadny klon ve zdroji");
    var b = withScope(scopeBL(), function () { return B.FB_OpCloneElements.call(B, repo, { op: "clone_elements", elements: ["{EL-FREE}"], "package": "{PKG-BL}" }, "cz14b"); });
    eq(b.code, "E_BLACKLIST", "cil chraneny"); contains(b.message, "cil klonu");
    var c = withScope(scopeBL(), function () { return B.FB_OpClonePackage.call(B, repo, { op: "clone_package", "package": "{PKG-BL-SUB}" }, "cz14c"); });
    eq(c.code, "E_BLACKLIST", "zdroj balicku v chranene casti");
    var d = withScope(scopeBL(), function () { return B.FB_OpClonePackage.call(B, repo, { op: "clone_package", "package": "{PKG-ROOT}" }, "cz14d"); });
    eq(d.code, "E_BLACKLIST", "zdroj obsahuje chranenou vetev / koren: " + JSON.stringify(d).substring(0, 200));
    var d2 = scopeRun(scopeRepo(), [{ op: "clone_package", "package": "{PKG-FREE}" }], "cz14d2", [{ repo: "EAEXAMPLE.QEA", blacklist: [{ pkg: "{PKG-ONE}", name: "Jedinacek", note: "pod Volne" }] }]);
    eq(d2.code, "E_BLACKLIST", "P2: zdroj obsahuje chranenou vetev: " + JSON.stringify(d2).substring(0, 300)); contains(d2.problems[0].message, "podstrom");
    var e = withScope(scopeBL(), function () { return B.FB_OpCloneElements.call(B, repo, { op: "clone_elements", elements: ["{EL-FREE}"] }, "cz14e"); });
    eq(e.status, "ok", "volny zdroj bez cile projde: " + JSON.stringify(e).substring(0, 200));
});
t("CZ-15 FB-CZ-15: diagramy - umisteni chraneneho prvku na volny diagram projde (meni se jen diagram); apply_classifier_stereotypes na chraneny prvek E_BLACKLIST; zapis na chraneny diagram E_BLACKLIST", function () {
    var repo = scopeRepo();
    var a = withScope(scopeBL(), function () { return B.FB_OpPlaceElements.call(B, repo, { op: "place_elements_on_diagram", diagram: "{DG-FREE}", elementPlacements: [{ element: "{EL-BL}", x: 10, y: 10 }] }, "cz15a"); });
    eq(a.status, "ok", "chraneny prvek na volnem diagramu: " + JSON.stringify(a).substring(0, 300));
    var p = scopeRun(scopeRepo(), [{ op: "place_elements_on_diagram", diagram: "{DG-FREE}", elementPlacements: [{ element: "{EL-BL}" }] }], "cz15p");
    ok(p.code != "E_BLACKLIST", "P2 nesmi blokovat prvek na volnem diagramu: " + p.code);
    var b = scopeRun(scopeRepo(), [{ op: "apply_classifier_stereotypes", diagram: "{DG-FREE}", elementIDs: ["{EL-BL}"] }], "cz15b");
    eq(b.code, "E_BLACKLIST", JSON.stringify(b).substring(0, 300));
    var c = scopeRun(scopeRepo(), [{ op: "layout_connectors", diagram: "{DG-BL}", style: "x" }], "cz15c");
    eq(c.code, "E_BLACKLIST");
});
t("CZ-16 FB-CZ-16 (W7): jmeno v zapisove operaci s vic shodami -> E_AMBIGUOUS s guids[] + candidates[{guid, path}], nic se neprovede; velikost pismen neni shoda; cteci operace bere prvni + varovani", function () {
    var repo = scopeRepo();
    var r = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": "Dvojnik" }] }], "cz16a");
    eq(r.code, "E_AMBIGUOUS", JSON.stringify(r).substring(0, 400));
    eq(r.problems[0].guids.length, 3); eq(r.problems[0].candidates.length, 3);
    ok(/^Model\.Dvojnik$|^Model\.Volne\.Dvojnik$/.test(r.problems[0].candidates[0].path), "kandidat s plnou cestou: " + r.problems[0].candidates[0].path);
    ok(r.problems[0].guids.indexOf("{PKG-DUP-C}") < 0, "'dvojnik' (jina velikost pismen) NENI shoda (W7)");
    eq(r.results[0].status, "skipped");
    var r2 = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": "dvojnik" }] }], "cz16b");
    eq(r2.status, "done", "presne jedna shoda 'dvojnik' projde: " + JSON.stringify(r2).substring(0, 300));
    eq(r2.resolved[0].guid, "{PKG-DUP-C}", "resolved[] nese skutecny GUID (FB-CZ-18)"); eq(r2.resolved[0].fullPath, "Model.Volne.dvojnik");
    // prvek jmenem
    var r3 = scopeRun(repo, [{ op: "create_or_update_attributes", element: "Dvojprvek", attributes: [{ name: "a" }] }], "cz16c");
    eq(r3.code, "E_AMBIGUOUS"); eq(r3.problems[0].candidates.length, 2);
    // druha obrana pri provedeni: resolver vraci null + E_AMBIGUOUS (FB_ResolveFail)
    var r4 = withScope(scopeBL(), function () { return B.FB_OpAttributes.call(B, repo, { op: "create_or_update_attributes", element: "Dvojprvek", attributes: [{ name: "a" }] }, "cz16d"); });
    ok(r4.code == "E_AMBIGUOUS" || r4.code == "E_NOT_FOUND", "provedeni: " + r4.code);
    var pkg = B.FB_ResolvePkg.call(B, repo, "Dvojnik");
    ok(pkg == null && B._fbResolveErr && B._fbResolveErr.code == "E_AMBIGUOUS" && B._fbResolveErr.candidates.length == 3, "FB_ResolvePkg strict: " + JSON.stringify(B._fbResolveErr));
    var pkgR = B.FB_ResolvePkg.call(B, repo, "Dvojnik", "read");
    ok(pkgR != null && /odpovida 3 balickum/.test("" + B._fbResolveWarn), "cteni: prvni shoda + varovani: " + B._fbResolveWarn);
    var rr = scopeRun(repo, [{ op: "get_packages_information", packages: ["Dvojnik"] }], "cz16e");
    eq(rr.status, "done", "cteci operace jmenem projde: " + JSON.stringify(rr).substring(0, 300));
    ok(rr.results[0].warnings && /odpovida 3 balickum/.test(rr.results[0].warnings[0]), "cteni nese varovani: " + JSON.stringify(rr.results[0].warnings));
});
t("CZ-17 FB-CZ-17: cesta {path} od korene i od balicku (from); vic sourozencu = E_AMBIGUOUS; neexistujici uroven = E_NOT_FOUND s nejhlubsi nalezenou urovni a jmeny podbalicku", function () {
    var repo = scopeRepo();
    var r = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": { path: ["Model", "Volne", "Jedinacek"] } }] }], "cz17a");
    eq(r.status, "done", JSON.stringify(r).substring(0, 400));
    eq(r.resolved[0].guid, "{PKG-ONE}"); eq(r.resolved[0].fullPath, "Model.Volne.Jedinacek"); eq(r.resolved[0].ref.path.join("/"), "Model/Volne/Jedinacek");
    var r2 = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": { path: ["Jedinacek"], from: "{PKG-FREE}" } }] }], "cz17b");
    eq(r2.status, "done", JSON.stringify(r2).substring(0, 400)); eq(r2.resolved[0].guid, "{PKG-ONE}");
    var r3 = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": { path: ["Model", "Volne", "Neni"] } }] }], "cz17c");
    eq(r3.code, "E_NOT_FOUND", JSON.stringify(r3).substring(0, 400)); eq(r3.problems[0].found, "Model.Volne");
    ok(r3.problems[0].children.indexOf("Jedinacek") >= 0, "jmena podbalicku nejhlubsi urovne: " + r3.problems[0].children.join(","));
    var r4 = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": { path: ["Model", "Volne", "Dvojnik"] } }] }], "cz17d");
    eq(r4.code, "E_AMBIGUOUS", "dva sourozenci Dvojnik pod Volne: " + JSON.stringify(r4).substring(0, 300)); eq(r4.problems[0].candidates.length, 2);
    var r4b = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": { path: ["Volne"] } }] }], "cz17d2");
    eq(r4b.status, "done", "koren 'Volne' (7) od korene je jednoznacny (Volne pod Model se nepocita): " + JSON.stringify(r4b).substring(0, 300)); eq(r4b.resolved[0].guid, "{PKG-FREE-TWIN}");
    var r5 = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": { path: ["Model", "FBT-CHRANENE"] } }] }], "cz17e");
    eq(r5.code, "E_BLACKLIST", "cesta do chranene casti: " + JSON.stringify(r5).substring(0, 300));
    var r6 = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": { path: ["Model", "volne"] } }] }], "cz17f");
    eq(r6.code, "E_NOT_FOUND", "velikost pismen rozhoduje (W7): " + JSON.stringify(r6).substring(0, 200));
    // provedeni: FB_ResolvePkg umi cestu i $N ve from (FB_Main resolveRefs) - prime volani
    var pkg = B.FB_ResolvePkg.call(B, repo, { path: ["Model", "Volne"] });
    ok(pkg != null && pkg.PackageID == 2, "FB_ResolvePkg s cestou");
    var r7 = scopeRun(repo, [{ op: "create_or_update_package", packages: [{ parent: { path: ["Model", "Volne"] }, name: "Novy" }] }, { op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": { path: ["Novy"], from: "$0" } }] }], "cz17g");
    ok(r7.status == "done" || r7.status == "confirm_required", "cesta s from = $N se dohleda az pri provedeni: " + JSON.stringify(r7).substring(0, 300));
});
t("CZ-06 FB-CZ-06: FB_WriteScope je chraneny konfiguracni element (zasah davkou = BLOCKED, B4) stejne jako FB_AccessGroups; vsech 5 konfiguraci nese tutez identitu repozitare", function () {
    var repo = scopeRepo();
    var r = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "FB_WriteScope", type: "Class", "package": "{PKG-FREE}" }] }], "cz06a");
    eq(r.code, "E_RISK_BLOCKED", JSON.stringify(r).substring(0, 300));
    var r2 = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "FB_AccessGroups", type: "Class", "package": "{PKG-FREE}" }] }], "cz06b");
    eq(r2.code, "E_RISK_BLOCKED");
    var ids = {};
    [["FB_Config", B.FB_Config], ["FB_OpsAllowed", B.FB_OpsAllowed], ["FB_RiskPolicy", B.FB_RiskPolicy], ["FB_AccessGroups", B.FB_AccessGroups], ["FB_WriteScope", FB_WRITESCOPE_LIVE]].forEach(function (c) {
        c[1].call(B).forEach(function (e) { ids[("" + e.repo).toUpperCase()] = (ids[("" + e.repo).toUpperCase()] || 0) + 1; });
    });
    for (var k in ids) { eq(ids[k], 5, "identita '" + k + "' musi byt ve vsech 5 konfiguracich (je " + ids[k] + "x)"); }
});
t("CZ-21 FB-CZ-21 (W3): vyjimka EA uprostred elements[] (E_PERMISSION) -> odpoved vyjmenuje polozky, ktere probehly (items, partial: true), QC a vypis zmen probehly", function () {
    var repo = scopeRepo();
    var free = repo.GetPackageByID(2);
    var n = 0;
    free.Elements.AddNew = function (name, type) {
        n++;
        if (n == 3) { throw new Error("Cannot create new Class. The parent package is locked by Project Security."); }
        var it = mkElement({ name: name, type: type }); free.Elements._items.push(it); return it;
    };
    var qcRan = 0, logRan = 0;
    var oQ = B.FB_QcRun, oL = B.FB_LogChanges;
    B.FB_QcRun = function () { qcRan++; return { status: "ok", checks: 0, findings: [] }; };
    B.FB_LogChanges = function () { logRan++; return 0; };
    try {
        var r = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "A", type: "Class", "package": "{PKG-FREE}" }, { name: "B", type: "Class", "package": "{PKG-FREE}" }, { name: "C", type: "Class", "package": "{PKG-FREE}" }] }], "cz21");
        eq(r.status, "error"); eq(r.results[0].code, "E_PERMISSION", JSON.stringify(r.results[0]).substring(0, 300));
        eq(r.results[0].partial, true); eq(r.results[0].items.length, 2, "dve polozky probehly pred vyjimkou");
        eq(r.results[0].items[0].name, "A"); eq(r.results[0].items[1].name, "B");
        contains(r.results[0].message, "probehlo 2 polozek");
        eq(qcRan, 1, "QC bezi i pri okc == 0 s partial"); eq(logRan, 1, "vypis zmen bezi");
    } finally { B.FB_QcRun = oQ; B.FB_LogChanges = oL; }
});
t("CZ-03 FB-CZ-03: blacklist a implicitni ochrana plati i pri vypnute EA security (O2 = b): chraneny cil E_BLACKLIST, volny cil projde; zadny E_SECURITY_OFF ani requireSecurity v kodu", function () {
    var repo = scopeRepo({ securityEnabled: false });
    var a = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": "{PKG-BL-SUB}" }] }], "cz03a");
    eq(a.code, "E_BLACKLIST");
    var b = scopeRun(repo, [{ op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": "{PKG-FREE}" }] }], "cz03b");
    eq(b.status, "done", JSON.stringify(b).substring(0, 300));
    var all = L.files.map(function (f) { return fs.readFileSync(path.join(SRC, f), "utf8"); }).join("\n");
    ok(all.indexOf("E_SECURITY_OFF") < 0 && all.indexOf("requireSecurity") < 0, "nestavi se (O2 = b)");
    ok(all.indexOf("autoZone") < 0, "zona bez potvrzeni se nestavi (O7 = b)");
});
t("CZ-18 FB-CZ-18: potvrzovaci okno ukazuje plnou cestu cile zadaneho cestou/jmenem", function () {
    var repo = scopeRepo();
    var r = scopeRun(repo, [{ op: "delete_from_model", targets: [{ type: "Element", guid: "{EL-FREE2}" }] }, { op: "create_or_update_elements", elements: [{ name: "N", type: "Class", "package": { path: ["Model", "Volne", "Jedinacek"] } }] }], "cz18");
    eq(r.status, "confirm_required", JSON.stringify(r).substring(0, 300));
    var txt = "" + B.FB_ConfirmSummary.call(B, r);
    contains(txt, "Model.Volne.Jedinacek", "plna cesta cile zadaneho cestou v okne: " + txt.substring(0, 400));
});
t("CZ-27 FB-CZ-27: ping vraci writeScope (mode, securityEnabled, cascadeDelete, summary, blacklist s path/found/note, implicit, problems, agentNotes) bez pole whitelist; start session a 'Stav bridge' ukazou TUTEZ lidskou vetu; chat ACK ma segment zapisu misto whitelistu", function () {
    var repo = scopeRepo();
    var pg = withScope(scopeBL(), function () { B._fbScopeCfg = null; return B.FB_OpPing.call(B, repo, { op: "ping" }); });
    var w = pg.writeScope;
    ok(w && w.mode == "blacklist", "mode blacklist"); ok(typeof pg.whitelist == "undefined", "pole whitelist[] zaniklo (O1 = b)");
    eq(w.repoKnown, true); eq(w.cascadeDelete, "block", "scopeBL bez klice = block");
    eq(w.blacklist.length, 1); eq(w.blacklist[0].path, "Model.FBT-CHRANENE"); eq(w.blacklist[0].found, true); eq(w.blacklist[0].note, "test blacklistu"); eq(w.blacklist[0].allowIncomingRefs, true);
    eq(w.implicit.length, 2); ok(/audit|addin/.test(w.implicit[0].kind), "implicit kind");
    eq(w.problems.length, 0);
    contains(w.summary, "Zapis: blacklist (1 chranenych vetvi)"); contains(w.summary, "Model.FBT-CHRANENE [test blacklistu]"); contains(w.summary, "bridge chrani i sam sebe"); contains(w.summary, "kaskady mazani do chranene casti: zakazane");
    ok(w.agentNotes && w.agentNotes.length >= 5, "agentNotes pro kit: " + (w.agentNotes || []).length);
    var notes = w.agentNotes.join(" | ");
    contains(notes, "OBA jeji konce"); contains(notes, "vazby ne - most zamky u vazeb nekontroluje"); contains(notes, "odkazuj $N"); contains(notes, "cascadeDelete = block"); contains(notes, "Zapisu do:");
    // allow: summary i note to rikaji
    var pa = withScope([{ repo: "EAEXAMPLE.QEA", cascadeDelete: "allow", blacklist: scopeBL()[0].blacklist }], function () { B._fbScopeCfg = null; return B.FB_OpPing.call(B, repo, { op: "ping" }); });
    eq(pa.writeScope.cascadeDelete, "allow"); contains(pa.writeScope.summary, "povoleny s varovanim"); contains(pa.writeScope.agentNotes.join(" | "), "PROJDE - clovek dostane vycet kaskad");
    // tataz veta na startu session, ve 'Stav bridge' a v pingu
    var ss = withScope(scopeBL(), function () { return "" + B.FB_SessionStart.call(B, repo); });
    // v0.19 (FB-UI-14): start session ma tutez vetu, ale po castech na radcich (" | " -> radky)
    ("" + w.summary).split(" | ").forEach(function (part) { contains(ss, part, "start session nese tutez vetu jako ping (po radcich)"); });
    var stv = withScope(scopeBL(), function () { return "" + B.FB_Status.call(B, repo); });
    contains(stv, w.summary, "Stav bridge nese tutez vetu"); contains(stv, "{PKG-BL}"); contains(stv, "Kaskady mazani do chranene casti"); contains(stv, "OBEMA konci"); ok(stv.indexOf("whitelist") < 0, "slovo whitelist ve Stavu uz neni");
    // chat ACK: segment zapisu
    var ack = chat({ status: "done", id: "cz27", repository: "EAEXAMPLE.QEA", results: [pg] });
    contains(ack, "zapis: blacklist (1 chranenych vetvi"); contains(ack, "Model.FBT-CHRANENE"); ok(ack.indexOf("whitelist") < 0, "segment whitelist: v ACK uz neni");
});
t("CZ-05b FB-CZ-05b: GUID z blacklistu, ktery v repozitari neni -> ping found: false + problems[], start session vadu ohlasi (E_SCOPE_CONFIG), summary rika NENALEZEN", function () {
    var repo = scopeRepo();
    var bad = [{ repo: "EAEXAMPLE.QEA", blacklist: [{ pkg: "{PKG-NENI}", name: "FBT-CHRANENE", note: "t" }] }];
    var pg = withScope(bad, function () { B._fbScopeCfg = null; return B.FB_OpPing.call(B, repo, { op: "ping" }); });
    eq(pg.writeScope.blacklist[0].found, false); eq(pg.writeScope.blacklist[0].guid, "{PKG-NENI}");
    ok(pg.writeScope.problems.length >= 1 && /PKG-NENI/.test(pg.writeScope.problems[0]), "problems[] jmenuje GUID: " + JSON.stringify(pg.writeScope.problems));
    contains(pg.writeScope.summary, "FBT-CHRANENE (NENALEZEN)");
    var ss = withScope(bad, function () { return "" + B.FB_SessionStart.call(B, repo); });
    contains(ss, "CHYBA konfigurace cile zapisu (E_SCOPE_CONFIG"); contains(ss, "{PKG-NENI}"); contains(ss, "opravny kanal");
    var ack = chat({ status: "done", id: "cz05b", repository: "EAEXAMPLE.QEA", results: [pg] });
    contains(ack, "NENALEZEN"); contains(ack, "E_SCOPE_CONFIG");
});
t("CZ-20 FB-CZ-20: menu 'Kontext vyberu do schranky' zkopiruje JEN identitu vyberu (repozitar, typ, GUID, plna cesta, writeCheck; multi-vyber GUIDy, aktivni diagram) - nikdy obsah; bez vyberu nic nekopiruje; polozka je v menu a EA_MenuClick ji obslouzi", function () {
    var repo = scopeRepo();
    var el = repo.GetElementByID(10); el.Notes = "TAJNY OBSAH prvku"; 
    repo.GetTreeSelectedItemType = function () { return 4; };
    repo.GetTreeSelectedObject = function () { return el; };
    repo.GetCurrentDiagram = function () { return repo.GetDiagramByID(100); };
    mockClipboard.text = "puvodni";
    var out = withScope(scopeBL(), function () { return "" + B.FB_ClipboardContext.call(B, repo); });
    contains(out, "Do schranky zkopirovano");
    var clip = mockClipboard.text;
    ok(clip != "puvodni", "schranka prepsana");
    var lines = clip.split("\n");
    eq(lines.length, 2, "radek pro cloveka + radek JSON");
    contains(lines[0], "Element 'VolnyPrvek' {EL-FREE}"); contains(lines[0], "cesta: Model.Volne.VolnyPrvek"); contains(lines[0], "EAEXAMPLE.QEA"); contains(lines[0], "zapis sem: ANO");
    var j = JSON.parse(lines[1]);
    eq(j.kind, "eafb-context"); contains(j.repository, "EAEXAMPLE.QEA"); eq(j.type, "Element"); eq(j.guid, "{EL-FREE}"); eq(j.path, "Model.Volne.VolnyPrvek"); eq(j.writeCheck.ok, true);
    eq(j.currentDiagram.guid, "{DG-FREE}");
    ok(clip.indexOf("TAJNY OBSAH") < 0, "obsah (Notes) do schranky nejde"); ok(typeof j.notes == "undefined" && typeof j.attributes == "undefined", "zadny obsah v JSON");
    // chraneny balicek -> writeCheck NE
    var pk = repo.GetPackageByID(901);
    repo.GetTreeSelectedItemType = function () { return 5; }; repo.GetTreeSelectedObject = function () { return pk; };
    var out2 = withScope(scopeBL(), function () { return "" + B.FB_ClipboardContext.call(B, repo); });
    var j2 = JSON.parse(mockClipboard.text.split("\n")[1]);
    eq(j2.type, "Package"); eq(j2.path, "Model.FBT-CHRANENE.Podbalicek"); eq(j2.writeCheck.ok, false); eq(j2.writeCheck.code, "E_BLACKLIST");
    contains(mockClipboard.text.split("\n")[0], "zapis sem: NE - E_BLACKLIST"); ok(mockClipboard.text.indexOf("E_BLACKLIST: E_BLACKLIST") < 0, "kod se v lidske vete neopakuje (zive 12. 10.)");
    // bez vyberu: schranka beze zmeny
    repo.GetTreeSelectedObject = function () { return null; }; repo.GetCurrentDiagram = function () { return null; };
    mockClipboard.text = "beze zmeny";
    var out3 = withScope(scopeBL(), function () { return "" + B.FB_ClipboardContext.call(B, repo); });
    contains(out3, "neni nic vybrano"); eq(mockClipboard.text, "beze zmeny");
    // menu: polozka existuje a klik ji obslouzi
    var items = B.EA_GetMenuItems.call(B, repo, "MainMenu", "-AI Bridge");
    ok(items.indexOf("Kontext vyberu do schranky (pro Copilota)") >= 0, "polozka v menu: " + JSON.stringify(items));
    var src = fs.readFileSync(path.join(SRC, "AICodeBridge.EA_MenuClick.js"), "utf8");
    contains(src, 'ItemName == "Kontext vyberu do schranky (pro Copilota)"'); contains(src, "FB_ClipboardContext(Repository)");
});
t("CZ-28 FB-CZ-28: E_BLACKLIST rika, ve ktere chranene vetvi cil lezi (plna cesta + note) a co delat", function () {
    var r = scopeRun(scopeRepo(), [{ op: "create_or_update_elements", elements: [{ guid: "{EL-BL-SUB}", name: "N" }] }], "cz28");
    eq(r.code, "E_BLACKLIST");
    var m = r.problems[0].message;
    contains(m, "Model.FBT-CHRANENE.Podbalicek.PodPrvek"); contains(m, "'Model.FBT-CHRANENE'"); contains(m, "test blacklistu"); contains(m, "jiny cil");
    eq(r.problems[0].branch.path, "Model.FBT-CHRANENE"); eq(r.problems[0].branch.note, "test blacklistu");
});
// ===========================================================================
// BALIK D - PUMPA v0.6 (Z261004b-5, 2026-10-12): simulace pump.wsf nad mocky
// (vzor IT-ANALYSIS/audity/sim-revize-pumpy-2026-10-04/agent-risk/pumpsim.js:
// funkce promptConfirm / offerPendingOnStart / recoverProcessing / processFile
// / resultLine se berou DOSLOVA ze zdroje pump.wsf - rez mezi "function pad2"
// a "function eaAlive"; prostredi WScript / fso / Popup / Enumerator = mock)
// + src casti: FB_CodeFingerprint, FB_CodeInfo, FB_PumpAlive, FB_Main
// (processing\, Log u predcasnych navratu), FB_SessionStart (verze pumpy),
// deploy_src + bootstrap (tagged values fb.code.*), ping/About/chat ACK,
// schranka + GUI fallback (bezici pumpa).
// ===========================================================================
var P6_BASE = B1_BASE, P6_REQ = B1_REQ, P6_PEND = B1_PEND, P6_RES = B1_RES, P6_PROG = B1_REQ + "\\processing", P6_REJ = B1_REQ + "\\rejected", P6_PROC = B1_REQ + "\\processed";
var P6_PUMP = P6_BASE + "\\pump.wsf";
var pumpSrc = fs.readFileSync(path.join(SRC, "..", "pump.wsf"), "utf8");
function pumpSim(opts) {
    // vraci { api, console, popups, answer(), tick(), start(), status(), res(), files() }
    opts = opts || {};
    var a = pumpSrc.indexOf("function pad2(n)"), b = pumpSrc.indexOf("function eaAlive(ea)");
    ok(a > 0 && b > a, "rez pump.wsf (pad2 .. eaAlive) nenalezen");
    var body = pumpSrc.substring(a, b);
    var consoleLog = [], popups = [], popupAnswers = [];
    var W = { ScriptFullName: P6_PUMP, Echo: function (s) { consoleLog.push("" + s); }, Sleep: function () { }, Quit: function () { } };
    function AX(progId) {
        var p = ("" + progId).toLowerCase();
        if (p.indexOf("wscript.shell") >= 0) {
            return { Popup: function (text, timeout, title, type) {
                var ans = popupAnswers.length ? popupAnswers.shift() : -1; // -1 = timeout
                var stAt = null; try { stAt = JSON.parse(memFs.files[P6_RES + "\\pump-status.json"]); } catch (eSa) { stAt = null; }
                popups.push({ text: "" + text, timeout: timeout, title: "" + title, type: type, answer: ans, statusAtPopup: stAt });
                return ans;
            }, Run: function () { return 0; }, ExpandEnvironmentStrings: function (s) { return s; } };
        }
        return comFactory(progId);
    }
    var fsoS = new MockFso();
    var names = ["WScript", "ActiveXObject", "fso", "Enumerator", "BASE", "DIR_REQ", "DIR_RES", "DIR_PROC", "DIR_REJ", "DIR_PEND", "DIR_PROG", "ADDIN_NAME",
        "POLL_MS", "HEARTBEAT_MS", "ALIVE_IDLE_S", "ALIVE_PROCESSING_S", "CONFIRM_TIMEOUT_S", "PUMP_LOG", "STATUS_PATH", "PUMP_HASH", "PUMP_START", "PUMP_ID", "PUMP_VERSION", "bridge"];
    var vals = [W, AX, fsoS, global.Enumerator, P6_BASE, P6_REQ, P6_RES, P6_PROC, P6_REJ, P6_PEND, P6_PROG, "AICodeBridge",
        1000, 10000, 30, 1800, 300, (opts.log !== false), P6_RES + "\\pump-status.json", "abc123", "2026-10-12 08:00:00", 7, "v0.6", B];
    var api = Function.apply(null, names.concat([body + "\nreturn { promptConfirm: promptConfirm, offerPendingOnStart: offerPendingOnStart, recoverProcessing: recoverProcessing, processFile: processFile, resultLine: resultLine, writeStatus: writeStatus, STATUS: STATUS, errorResponse: errorResponse, confirmIcon: confirmIcon, isReqName: isReqName, noteIgnored: noteIgnored, forgetIgnored: forgetIgnored, announce: announce };"])).apply(null, vals);
    memFs.folders[P6_REQ] = 1; memFs.folders[P6_RES] = 1; memFs.folders[P6_PEND] = 1; memFs.folders[P6_PROG] = 1; memFs.folders[P6_REJ] = 1; memFs.folders[P6_PROC] = 1;
    function underPump(fn) { global.WScript = W; try { return asEaRuntime(fn); } finally { delete global.WScript; } }
    return {
        api: api, popups: popups, console: consoleLog,
        answer: function () { for (var i = 0; i < arguments.length; i++) { popupAnswers.push(arguments[i]); } },
        put: function (id, ops, name) { memFs.files[P6_REQ + "\\" + (name || ("req-" + id + ".json"))] = JSON.stringify({ protocol: "eafb/0.2", id: id, repo: "EAEXAMPLE.QEA", ops: ops }); },
        tick: function (repo) { // jeden pruchod requests\ jako hlavni smycka (jen req-*.json; ostatni = IGNORUJI)
            var files = fsoS.GetFolder(P6_REQ).Files, present = {}, reload = false;
            files.forEach(function (f) {
                if (!api.isReqName(f.Name)) { if (f.Name != ".pump.lock") { present[f.Name] = 1; api.noteIgnored(f.Name); } return; }
                underPump(function () { if (api.processFile(repo, B, f)) { reload = true; } });
                api.writeStatus("idle", "");
            });
            api.forgetIgnored(present);
            api.writeStatus(api.STATUS.phase, api.STATUS.file); // tep (heartbeat) na konci pruchodu
            return reload;
        },
        start: function (repo) { return underPump(function () { api.recoverProcessing(repo, B); return api.offerPendingOnStart(repo, B); }); },
        status: function () { var tx = memFs.files[P6_RES + "\\pump-status.json"]; return tx ? JSON.parse(tx) : null; },
        res: function (id) { var tx = memFs.files[P6_RES + "\\res-" + id + ".json"]; return tx ? JSON.parse(tx) : null; },
        files: function (prefix) { return b1Files(prefix); },
        drain: function () { var c = consoleLog.slice(); consoleLog.length = 0; return c.map(function (l) { return l.replace(/^\d\d:\d\d:\d\d  /, ""); }); },
        resultLines: function () { return consoleLog.filter(function (l) { return /^\d\d:\d\d:\d\d  (OK |CHYBA |CEKA NA TEBE |ZAMITNUTO |NEPROVEDENO |PRERUSENA |DOKONCENA |IGNORUJI )/.test(l); }).map(function (l) { return l.replace(/^\d\d:\d\d:\d\d  /, ""); }); }
    };
}
var P6_DELETE = [{ op: "delete_from_model", targets: [{ type: "Element", id: 104 }] }];

t("PUMPA v0.6 hlavicka: banner z PUMP_VERSION = hlavicka pump.wsf (WORKSPACE-METODIKY cesta 2), regex refresh-workspace sedi, zadna druha legenda tlacitek, popup +512 (vychozi Storno) a veta o limitu", function () {
    ok(/EA File Bridge\s*-\s*pumpa\s+v0\.6\s*\(eafb\/0\.2\)/.test(pumpSrc), "hlavicka 'EA File Bridge - pumpa v0.6 (eafb/0.2)'");
    contains(pumpSrc, 'var PUMP_VERSION = "v0.6";');
    eq(pumpSrc.indexOf("Ano = provest, Ne = zamitnout (rejected), Storno = nechat cekat v pending"), -1, "druha legenda z pumpy smazana (FB-UI-08)");
    contains(pumpSrc, "3 + confirmIcon(r) + 512 + 4096", "typ okna: Ano/Ne/Storno + ikona + vychozi Storno + navrchu");
    contains(pumpSrc, "Kdyz nerozhodnes do ");
    contains(pumpSrc, "spust bootstrap (scripts\\\\ITAN-Bootstrap File Bridge.js v EA Scripting), nebo se obrat na spravce");
    eq(pumpSrc.indexOf("spust ITAN-Inject"), -1, "rada 'spust ITAN-Inject' pryc (FB-PU-05)");
    eq(pumpSrc.indexOf('"eafb/0.1"'), -1, "vlastni odpovedi pumpy uz nejsou eafb/0.1 (FB-PU-13)");
    contains(pumpSrc, "%LOCALAPPDATA%");
    contains(pumpSrc, "pump-status.json");
});
t("PUMPA v0.6 stav (FB-PU-03): pump-status.json meni faze processing -> idle, nese soubor, since, heartbeat, aliveUntil, verzi a otisk; vysledek 'OK 1/1' = jeden radek na davku (FB-PU-04)", function () {
    b1Reset(); var repo = blRepo(); var S = pumpSim();
    var phases = [];
    var oE = B.FB_OpElements; B.FB_OpElements = function () { phases.push(S.status().phase + "/" + S.status().file); return { op: "create_or_update_elements", status: "ok", items: [{ guid: mkGuid(), id: 1, created: true }] }; };
    try { S.put("st1", B1_CREATE); S.tick(repo); } finally { B.FB_OpElements = oE; }
    eq(phases.join(","), "processing/req-st1.json", "behem FB_Main je faze processing s nazvem souboru");
    var st = S.status();
    eq(st.phase, "idle"); eq(st.file, ""); eq(st.pump.version, "v0.6"); eq(st.pump.fingerprint, "abc123"); eq(st.protocol, "eafb/0.2");
    ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(st.heartbeat), "heartbeat je cas"); ok(st.aliveUntil > st.heartbeat, "aliveUntil za heartbeatem");
    eq(st.lastResult, "OK 1/1 req-st1.json");
    var rl = S.resultLines();
    eq(rl.length, 1, "jeden vysledkovy radek: " + rl.join(" | ")); eq(rl[0], "OK 1/1 req-st1.json");
    eq(S.files(P6_PROC + "\\").length, 1, "soubor v processed"); eq(S.files(P6_PROG + "\\").length, 0, "processing\\ prazdne po davce");
    eq(S.res("st1").status, "done");
    ok(S.files(P6_RES + "\\pump-").length >= 1, "log responses\\pump-RRRR-MM-DD.log existuje (FB-PU-14)");
});
t("PUMPA v0.6 konzole (FB-PU-04): davka s chybou operace = 'CHYBA op[N] KOD', E_REPO = 'CHYBA E_REPO', confirm_required = 'CEKA NA TEBE (okno potvrzeni)'", function () {
    b1Reset(); var repo = blRepo(); var S = pumpSim();
    var oE = B.FB_OpElements; B.FB_OpElements = function () { return { op: "create_or_update_elements", status: "error", code: "E_NOT_FOUND", message: "cil nenalezen" }; };
    try { S.put("c1", B1_CREATE); S.tick(repo); } finally { B.FB_OpElements = oE; }
    var l1 = S.resultLines(); eq(l1.length, 1, l1.join("|")); ok(/^CHYBA op\[0\] E_NOT_FOUND req-c1\.json \(ok 0\/1\)/.test(l1[0]), l1[0]);
    S.drain();
    memFs.files[P6_REQ + "\\req-c2.json"] = JSON.stringify({ protocol: "eafb/0.2", id: "c2", repo: "JINY-REPO", ops: [{ op: "ping" }] });
    S.tick(repo);
    var l2 = S.resultLines(); eq(l2.length, 1, l2.join("|")); ok(/^CHYBA E_REPO req-c2\.json - Davka je urcena pro repozitar 'JINY-REPO'/.test(l2[0]), l2[0]);
    ok(repo._output.some(function (o) { return /FB c2 -> E_REPO/.test(o.text); }), "Log i u predcasneho navratu E_REPO (FB-PU-04): " + JSON.stringify(repo._output.slice(-2)));
    S.drain();
    S.put("c3", P6_DELETE); S.tick(repo); // ELEVATED -> okno; timeout
    var l3 = S.resultLines(); eq(l3.length, 1, l3.join("|")); eq(l3[0], "CEKA NA TEBE (okno potvrzeni) req-c3.json");
    eq(S.popups.length, 1); eq(S.popups[0].title, "EA File Bridge - potvrzeni davky c3");
});
t("PUMPA v0.6 okno (pravidlo 5, FB-PU-18): typ 3+48+512+4096 u mazani (ikona upozorneni, vychozi Storno), 3+32+512+4096 u zapisu nad prah; text ma vetu o limitu a jen JEDNU legendu; behem okna faze waiting_confirm; Storno = davka ceka, po Stornu okno znovu kdyz agent posle tentyz soubor (bez restartu)", function () {
    b1Reset(); var repo = blRepo(); var S = pumpSim();
    var seenPhase = null;
    var oP = B.FB_ConfirmSummary; B.FB_ConfirmSummary = function (r) { seenPhase = S.status().phase + "/" + S.status().file; return oP.call(B, r); };
    try {
        S.answer(2); // Storno
        S.put("w1", P6_DELETE); S.tick(repo);
    } finally { B.FB_ConfirmSummary = oP; }
    eq(S.popups.length, 1);
    eq(S.popups[0].type, 3 + 48 + 512 + 4096, "mazani: ikona upozorneni + vychozi Storno");
    contains(S.popups[0].text, "Kdyz nerozhodnes do 5 minut, davka pocka a okno se vrati");
    eq(S.popups[0].text.split("Ano = ").length - 1, 1, "jedna legenda tlacitek (z FB_ConfirmSummary): " + S.popups[0].text);
    eq(S.popups[0].timeout, 300);
    ok(S.files(P6_PEND + "\\").some(function (f) { return f == "req-w1.json"; }), "davka ceka v pending");
    eq(S.status().phase, "idle", "po Stornu idle");
    ok(S.console.some(function (l) { return /waiting_confirm|CEKA req-w1\.json \(Storno\)/.test(l); }), "konzole: CEKA (Storno)");
    // status behem okna: waiting_confirm (zapsan pred Popup) - over z kopie, kterou si vzal mock Popup
    ok(S.console.some(function (l) { return /^\d\d:\d\d:\d\d  CEKA req-w1\.json \(Storno\) - davka ceka v pending/.test(l); }), S.console.join("\n"));
    // agent posle tentyz soubor znovu -> FB_Main vrati stavajici res -> okno znovu, bez restartu
    S.put("w1", P6_DELETE); S.answer(2); S.tick(repo);
    eq(S.popups.length, 2, "okno podruhe bez restartu");
    eq(S.popups[1].title, S.popups[0].title);
    // zapis nad prah (ne mazani) -> otaznik
    var many = []; for (var i = 0; i < 25; i++) { many.push({ name: "N" + i, type: "Class", "package": "{PK-11}" }); }
    S.answer(2); S.put("w2", [{ op: "create_or_update_elements", elements: many }]); S.tick(repo);
    eq(S.popups.length, 3); eq(S.popups[2].type, 3 + 32 + 512 + 4096, "zapis nad prah: otaznik + vychozi Storno");
});
t("PUMPA v0.6 okno: faze waiting_confirm ve stavovem souboru (zapsano tesne pred Popup, aliveUntil = timeout + 30 s); Ne = rejected, vysledek jeden radek", function () {
    b1Reset(); var repo = blRepo(); var S = pumpSim();
    S.answer(7); S.put("wc", P6_DELETE); S.tick(repo);
    eq(S.popups.length, 1);
    var sp = S.popups[0].statusAtPopup;
    ok(sp != null && sp.phase == "waiting_confirm" && sp.file == "req-wc.json", "stav v okamziku okna: " + JSON.stringify(sp));
    function ms(x) { var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(x); return new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime(); }
    eq((ms(sp.aliveUntil) - ms(sp.heartbeat)) / 1000, 330, "aliveUntil = tep + 300 + 30 s");
    var st = S.status(); eq(st.phase, "idle");
    ok(/ZAMITNUTO|CHYBA E_RISK_REJECTED/.test(st.lastResult), "Ne -> zamitnuto: " + st.lastResult);
    ok(S.files(P6_REJ + "\\").length >= 1, "Ne = rejected");
    var rl = S.resultLines(); eq(rl.length, 2, rl.join(" | "));
});
t("PUMPA v0.6 Ano (confirm): potvrzeni projde, marker processing\\<jmeno>.confirmed po behu zmizi, vysledek 'OK' jeden radek; deploy_src -> reloadCode (navrat true)", function () {
    b1Reset(); var repo = blRepo(); var S = pumpSim();
    var oD = B.FB_OpDelete; B.FB_OpDelete = function () { ok(memFs.files[P6_PROG + "\\req-y1.json.confirmed"], "marker potvrzeneho behu existuje behem provadeni"); return { op: "delete_from_model", status: "ok", items: [{ deleted: true }] }; };
    try { S.answer(6); S.put("y1", P6_DELETE); S.tick(repo); } finally { B.FB_OpDelete = oD; }
    eq(S.popups.length, 1); eq(S.res("y1").status, "done");
    ok(!memFs.files[P6_PROG + "\\req-y1.json.confirmed"], "marker po behu smazan");
    var rl = S.resultLines(); eq(rl.length, 2, rl.join(" | ")); eq(rl[0], "CEKA NA TEBE (okno potvrzeni) req-y1.json"); eq(rl[1], "OK 1/1 req-y1.json");
});
t("PUMPA v0.6 N-E2E-4: po 'Potvrzeno, ale cerstva rucni baseline stale chybi' uz pumpa okno NEopakuje - jedna veta na konzoli (Ctrl+Alt+B, bez FB-AUTO), davka zustava v pending", function () {
    b1Reset(); var repo = blRepo(); var S = pumpSim();
    S.put("nb", P6_DELETE); S.answer(6, 6, 6);
    var oCP = B.FB_ConfirmPending; B.FB_ConfirmPending = function (Repository, p, nonce, hash, chan, approve) {
        var r = JSON.parse(memFs.files[P6_RES + "\\res-nb.json"]); r.message = "Potvrzeno, ale cerstva rucni baseline stale chybi - davka se NEPROVEDLA"; r.confirm.nonce = "NEW" + nonce; return JSON.stringify(r);
    };
    try { S.tick(repo); } finally { B.FB_ConfirmPending = oCP; }
    eq(S.popups.length, 1, "okno jen jednou (v0.5 by se opakovalo az 3x)");
    var nep = S.console.filter(function (l) { return /NEPROVEDENO req-nb\.json: chybi cerstva rucni baseline/.test(l); });
    eq(nep.length, 1, S.console.join("\n")); contains(nep[0], "Ctrl+Alt+B"); contains(nep[0], "bez FB-AUTO"); contains(nep[0], "pending");
    ok(S.files(P6_PEND + "\\").some(function (f) { return f == "req-nb.json"; }), "davka ceka v pending");
    contains(S.status().lastResult, "NEPROVEDENO req-nb.json");
});
t("PUMPA v0.6 processing\\ (FB-PU-11): zavreni pumpy uprostred davky -> pri startu PRERUSENA, NEprovedeno, res E_INTERRUPTED (eafb/0.2, id z davky), soubor do rejected\\ .interrupted; dokoncena (res final) -> processed\\", function () {
    b1Reset(); var repo = blRepo(); var S = pumpSim();
    memFs.files[P6_PROG + "\\req-ir1.json"] = JSON.stringify({ protocol: "eafb/0.2", id: "ir1", repo: "EAEXAMPLE.QEA", ops: B1_CREATE });
    memFs.files[P6_RES + "\\res-ir1.json"] = JSON.stringify({ protocol: "eafb/0.2", id: "ir1", status: "processing", since: "2026-10-12 07:00:00" });
    memFs.files[P6_PROG + "\\req-ir2.json"] = JSON.stringify({ protocol: "eafb/0.2", id: "ir2", repo: "EAEXAMPLE.QEA", ops: B1_READ });
    memFs.files[P6_RES + "\\res-ir2.json"] = JSON.stringify({ protocol: "eafb/0.2", id: "ir2", status: "done", since: "2026-10-12 07:00:00", results: [{ op: "ping", status: "ok" }] });
    memFs.files[P6_PROG + "\\req-ir3.json"] = JSON.stringify({ protocol: "eafb/0.2", id: "ir3", repo: "EAEXAMPLE.QEA", ops: B1_CREATE }); // bez res
    var called = 0; var oE = B.FB_OpElements; B.FB_OpElements = function () { called++; return { op: "x", status: "ok", items: [] }; };
    try { S.start(repo); } finally { B.FB_OpElements = oE; }
    eq(called, 0, "nic se neprovedlo");
    var r1 = S.res("ir1"); eq(r1.status, "error"); eq(r1.code, "E_INTERRUPTED"); eq(r1.id, "ir1"); eq(r1.protocol, "eafb/0.2"); contains(r1.message, "NOVYM id"); eq(r1.interrupted.since, "2026-10-12 07:00:00");
    var r3 = S.res("ir3"); eq(r3.code, "E_INTERRUPTED"); eq(r3.id, "ir3");
    var rej = S.files(P6_REJ + "\\"); eq(rej.filter(function (f) { return /^req-ir[13]\..*\.interrupted\.json$/.test(f); }).length, 2, rej.join("|"));
    ok(S.files(P6_PROC + "\\").some(function (f) { return /^req-ir2\./.test(f); }), "dokoncena do processed");
    eq(S.files(P6_PROG + "\\").length, 0, "processing\\ prazdne");
    var lines = S.resultLines(); eq(lines.filter(function (l) { return /^PRERUSENA req-ir[13]\.json/.test(l); }).length, 2, lines.join("|")); eq(lines.filter(function (l) { return /^DOKONCENA req-ir2\.json/.test(l); }).length, 1);
    ok(repo._output.some(function (o) { return /E_INTERRUPTED/.test(o.text); }), "Output tab ma zaznam");
    // FB_Main: soubor v processing\ ma requests\ jako slozku davky (pending = requests\pending, ne processing\pending)
    S.put("pp", P6_DELETE); S.tick(repo);
    eq(S.res("pp").status, "confirm_required"); eq(S.res("pp").confirm.pendingPath, P6_PEND + "\\req-pp.json", "pending pod requests\\, ne processing\\pending");
    eq(S.files(P6_PROG + "\\").length, 0);
});
t("PUMPA v0.6 prerusena POTVRZENA davka: marker processing\\<jmeno>.confirmed + soubor v pending -> pri startu se uz NEnabidne, res E_INTERRUPTED, rejected, index bez ni", function () {
    b1Reset(); var repo = blRepo(); var S = pumpSim();
    S.put("ic", P6_DELETE); S.tick(repo); // timeout -> ceka v pending
    eq(S.popups.length, 1);
    memFs.files[P6_PROG + "\\req-ic.json.confirmed"] = "potvrzeno 2026-10-12 07:00:00";
    S.answer(6); S.start(repo);
    eq(S.popups.length, 1, "zadne nove okno");
    eq(S.res("ic").code, "E_INTERRUPTED"); eq(S.res("ic").interrupted.confirmed, true);
    ok(!memFs.files[P6_PEND + "\\req-ic.json"], "pryc z pending"); ok(!memFs.files[P6_PROG + "\\req-ic.json.confirmed"], "marker smazan");
    eq(B.FB_PendingIndex.call(B, repo, P6_PEND, "list").length, 0, "index prazdny");
});
t("PUMPA v0.6 soubory (FB-PU-10): jen req-*.json; jiny .json / txt = IGNORUJI jednou + ve stavu, nezpracovan, neprejmenovan; po odstraneni z requests\\ zmizi ze stavu", function () {
    b1Reset(); var repo = blRepo(); var S = pumpSim();
    memFs.files[P6_REQ + "\\request-1.json"] = JSON.stringify({ protocol: "eafb/0.2", id: "x", ops: [{ op: "ping" }] });
    memFs.files[P6_REQ + "\\poznamka.txt"] = "ahoj";
    memFs.files[P6_REQ + "\\.pump.lock"] = "lock";
    S.put("ok1", B1_READ);
    S.tick(repo); S.tick(repo); S.tick(repo);
    var ign = S.console.filter(function (l) { return /IGNORUJI/.test(l); });
    eq(ign.length, 2, "kazdy cizi soubor ohlasen jednou: " + ign.join("|"));
    ok(memFs.files[P6_REQ + "\\request-1.json"], "cizi soubor zustal lezet"); ok(!memFs.files[P6_RES + "\\resuest-1.json"], "zadna odpoved resuest-1 (FB-PU-10)");
    eq(S.res("ok1").status, "done");
    var st = S.status(); eq(st.ignored.sort().join(","), "poznamka.txt,request-1.json");
    delete memFs.files[P6_REQ + "\\poznamka.txt"]; S.tick(repo);
    eq(S.status().ignored.join(","), "request-1.json");
});
t("PUMPA v0.6 vlastni odpoved (FB-PU-13): vyjimka executoru -> E_EXCEPTION pres FB_JsonStringify (eafb/0.2, id z davky, validni JSON i s koncem radku v hlasce); bez FB_Main -> E_NO_EXECUTOR s radou bootstrap", function () {
    b1Reset(); var repo = blRepo(); var S = pumpSim();
    var txt = S.api.errorResponse(B, "E_EXCEPTION", "radek1\nradek2 \"uvozovky\" \\ zpetne", "idX");
    var o = JSON.parse(txt); eq(o.protocol, "eafb/0.2"); eq(o.id, "idX"); eq(o.code, "E_EXCEPTION"); contains(o.message, "radek2"); eq(o.madeBy, "pumpa v0.6");
    var noMain = {}; for (var k in B) { if (k != "FB_Main") { noMain[k] = B[k]; } }
    S.put("ne1", B1_READ);
    var f = new MockFso().GetFolder(P6_REQ).Files.filter(function (x) { return x.Name == "req-ne1.json"; })[0];
    global.WScript = { ScriptFullName: P6_PUMP }; try { S.api.processFile(repo, noMain, f); } finally { delete global.WScript; }
    var r = S.res("ne1"); eq(r.code, "E_NO_EXECUTOR"); eq(r.id, "ne1"); contains(r.message, "bootstrap"); ok(r.message.indexOf("ITAN-Inject") < 0);
    ok(S.files(P6_REJ + "\\").length == 1, "bez executoru -> rejected");
});
t("PUMPA v0.6 cekajici davky po startu (pravidlo 6, FB-PU-15/-17): expirovane jen vypise (FB_PendingSweep je presunul), neexpirovane nejstarsi prvni, okno nese 'Ceka od ... (N min)'", function () {
    b1Reset(); var repo = blRepo(); var S = pumpSim();
    function fmt(d) { function p(x) { return (x < 10 ? "0" : "") + x; } return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()); }
    var text = function (id) { return JSON.stringify({ protocol: "eafb/0.2", id: id, repo: "EAEXAMPLE.QEA", ops: [{ op: "delete_from_model", targets: [{ type: "Element", id: 104 }] }], note: id }); };
    memFs.files[P6_REQ + "\\req-pa.json"] = text("pa"); S.tick(repo); // timeout
    memFs.files[P6_REQ + "\\req-pb.json"] = text("pb"); S.tick(repo);
    memFs.files[P6_REQ + "\\req-pc.json"] = text("pc"); S.tick(repo);
    eq(S.popups.length, 3);
    // zestarnuti: pa 9 h (expiruje), pb 2 h, pc 1 h -> poradi pb, pc
    function age(id, h) { var r = JSON.parse(memFs.files[P6_RES + "\\res-" + id + ".json"]); r.since = fmt(new Date(new Date().getTime() - h * 3600000)); memFs.files[P6_RES + "\\res-" + id + ".json"] = JSON.stringify(r); }
    age("pa", 9); age("pb", 2); age("pc", 1);
    S.popups.length = 0; S.drain();
    S.answer(2, 2);
    S.start(repo);
    eq(S.popups.length, 2, "expirovana se nenabizi");
    eq(S.popups[0].title, "EA File Bridge - potvrzeni davky pb"); eq(S.popups[1].title, "EA File Bridge - potvrzeni davky pc");
    ok(/Ceka od \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \(1(19|20|21) min\)/.test(S.popups[0].text), "stari v okne: " + S.popups[0].text.split("\n").filter(function (l) { return /Ceka od/.test(l); }).join(""));
    var c = S.console.join("\n");
    ok(/VYPRSELA req-pa\.json \(id pa, cekala od .* min > 480 min\) -> rejected/.test(c), c);
    ok(/Cekajicich davek v pending\\: 2/.test(c), c);
    eq(S.res("pa").code, "E_RISK_EXPIRED");
});
t("PUMPA v0.6 zrcadlo v harnessu: pumpRun() razeni do rejected = tytez kody jako pump.wsf (BL-3 + E_BLACKLIST/E_SCOPE_CONFIG)", function () {
    ok(/rejected = \(respText\.indexOf\("\\"code\\":\\"E_PARSE\\""\) >= 0\)[\s\S]{0,500}E_SCOPE_CONFIG/.test(pumpSrc), "vyraz rejected v pump.wsf");
});

// --- src: otisk kodu ---
t("FB_CodeFingerprint (FB-PU-02): deterministicky, bez konfiguracnich souboru, nezavisly na CRLF/BOM/poradi; zmena kodu = jiny otisk; stejny vysledek jako tools/code-fingerprint.py (vektor)", function () {
    var files = [
        { name: "AICodeBridge.FB_Main.js", text: "// a\r\nreturn 1;\r\n" },
        { name: "AICodeBridge.FB_Config.js", text: "// konfigurace\nreturn [];\n" },
        { name: "FB_Sha256", text: "\uFEFF// b\nreturn 2;" }
    ];
    var r1 = B.FB_CodeFingerprint.call(B, files);
    eq(r1.files, 2); eq(r1.excluded.join(","), "FB_Config"); eq(r1.short.length, 12); eq(r1.fingerprint.length, 64);
    var r2 = B.FB_CodeFingerprint.call(B, [files[2], { name: "FB_Main", text: "// a\nreturn 1;\n\n" }, { name: "FB_WriteScope", text: "x" }]);
    eq(r2.fingerprint, r1.fingerprint, "poradi, CRLF, BOM, konec souboru a konfigurace otisk nemeni");
    var r3 = B.FB_CodeFingerprint.call(B, [files[0], { name: "FB_Sha256", text: "// b\nreturn 3;" }]);
    ok(r3.fingerprint != r1.fingerprint, "zmena kodu = jiny otisk");
    // vektor: sha256("FB_Main\n// a\nreturn 1;\n\nFB_Sha256\n// b\nreturn 2;\n\n")
    eq(r1.fingerprint, require("crypto").createHash("sha256").update("FB_Main\n// a\nreturn 1;\n\nFB_Sha256\n// b\nreturn 2;\n\n", "utf8").digest("hex"), "algoritmus = tools/code-fingerprint.py");
    ["FB_Config", "FB_WriteScope", "FB_OpsAllowed", "FB_RiskPolicy", "FB_AccessGroups", "FB_QcConfig", "FB_ScaffoldConfig"].forEach(function (c) {
        eq(B.FB_CodeFingerprint.call(B, [{ name: c, text: "x" }, { name: "FB_A", text: "y" }]).excluded.join(","), c, c + " je konfigurace");
    });
});
t("FB_CodeInfo (FB-PU-02): cte fb.code.* z t_objectproperties prvku AICodeBridge; bez tagu = found false s radou; ping nese code, chat ACK 'kod: <short>', About ukazuje otisk", function () {
    var tags = { "fb.code.fingerprint": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "fb.code.files": "125", "fb.code.deployedAt": "2026-10-12 17:00:00", "fb.code.deployedBy": "deploy_src" };
    function mkRepo(withTags) {
        var repo = blRepo();
        var oQ = repo.SQLQuery;
        repo.SQLQuery = function (sql) {
            if (/Name = 'AICodeBridge' AND Stereotype = 'JavascriptAddin'/.test(sql)) { return "<EADATA><Dataset_0><Data><Row><Object_ID>687</Object_ID></Row></Data></Dataset_0></EADATA>"; }
            if (/t_objectproperties WHERE Object_ID = 687/.test(sql)) {
                if (!withTags) { return "<EADATA><Dataset_0><Data></Data></Dataset_0></EADATA>"; }
                var rows = ""; for (var k in tags) { rows += "<Row><Property>" + k + "</Property><Value>" + tags[k] + "</Value></Row>"; }
                return "<EADATA><Dataset_0><Data>" + rows + "</Data></Dataset_0></EADATA>";
            }
            return oQ.call(repo, sql);
        };
        return repo;
    }
    var ci = B.FB_CodeInfo.call(B, mkRepo(true));
    eq(ci.found, true); eq(ci.short, "0123456789ab"); eq(ci.files, 125); eq(ci.deployedBy, "deploy_src"); contains(ci.text, "Otisk kodu v modelu: 0123456789ab (125 souboru bez konfigurace, nasazeno 2026-10-12 17:00:00 deploy_src)");
    var ci0 = B.FB_CodeInfo.call(B, mkRepo(false)); eq(ci0.found, false); contains(ci0.text, "neni"); contains(ci0.text, "bootstrap");
    var pr = B.FB_OpPing.call(B, mkRepo(true), { op: "ping" });
    eq(pr.codeInfo.short, "0123456789ab"); eq(pr.codeInfo.found, true);
    var ack = "" + B.FB_ChatRender.call(B, { protocol: "eafb/0.2", id: "p", status: "done", results: [pr] });
    contains(ack, "kod: 0123456789ab (2026-10-12 17:00:00 deploy_src)");
    // About
    var prompts = [];
    var oSess = global.Session; global.Session = { Output: function () { }, Prompt: function (t) { prompts.push("" + t); return 1; } };
    try { B.EA_MenuClick.call(B, mkRepo(true), "MainMenu", "-AI Bridge", "About AI Bridge"); } finally { global.Session = oSess; }
    eq(prompts.length, 1); contains(prompts[0], "Otisk kodu v modelu: 0123456789ab"); contains(prompts[0], "pumpa (pump.wsf)");
    // pod pumpou: ping nese pump (z FB_SessionStart)
    B._fbPumpInfo = { version: "0.6", fingerprint: "ffff0000ffff0000", path: "C:\\x\\pump.wsf" };
    global.WScript = { ScriptFullName: "C:\\x\\pump.wsf" };
    try { var pr2 = B.FB_OpPing.call(B, mkRepo(true), { op: "ping" }); } finally { delete global.WScript; delete B._fbPumpInfo; }
    eq(pr2.pump.version, "0.6"); eq(pr2.pump.short, "ffff0000ffff"); contains(pr2.pump.status, "pump-status.json");
    var ack2 = "" + B.FB_ChatRender.call(B, { protocol: "eafb/0.2", id: "p", status: "done", results: [pr2] });
    contains(ack2, "pumpa v0.6 ffff0000ffff");
});
t("deploy_src (FB-PU-02): plny deploy zapise tagged values fb.code.* (otisk nad vsemi soubory bez konfigurace, deployedBy deploy_src); castecny (only) otisk smaze a oznaci", function () {
    blReset();
    var tags = {};
    var oS = B.SetTag; B.SetTag = function (e, n, v) { tags[n] = v; };
    var oC = B.FB_Config; B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", baseDir: "C:\\HARNESS\\EA-File-Bridge", srcDir: "C:\\HARNSRC6" }]; };
    memFs.folders["C:\\HARNSRC6"] = 1;
    memFs.files["C:\\HARNSRC6\\AICodeBridge.FB_A.js"] = "// AICodeBridge.FB_A(Repository)\nreturn 1;\n";
    memFs.files["C:\\HARNSRC6\\AICodeBridge.FB_B.js"] = "// AICodeBridge.FB_B(Repository, x)\nreturn 2;\n";
    memFs.files["C:\\HARNSRC6\\AICodeBridge.FB_Config.js"] = "// AICodeBridge.FB_Config()\nreturn [];\n";
    var repo = blRepo();
    var oQ = repo.SQLQuery; repo.SQLQuery = function (sql) { if (/Name = 'AICodeBridge' AND Stereotype = 'JavascriptAddin'/.test(sql)) { return "<Row><Object_ID>687</Object_ID></Row>"; } return oQ.call(repo, sql); };
    var el = bootElement(687, {});
    var oG = repo.GetElementByID; repo.GetElementByID = function (id) { return id == 687 ? el : oG.call(repo, id); };
    try {
        var r = B.FB_OpDeploySrc.call(B, repo, { op: "deploy_src" }, "d1");
        eq(r.status, "ok"); eq(r.count, 3);
        var expect = B.FB_CodeFingerprint.call(B, [{ name: "FB_A", text: memFs.files["C:\\HARNSRC6\\AICodeBridge.FB_A.js"] }, { name: "FB_B", text: memFs.files["C:\\HARNSRC6\\AICodeBridge.FB_B.js"] }]);
        eq(tags["fb.code.fingerprint"], expect.fingerprint); eq(tags["fb.code.files"], "2"); eq(tags["fb.code.deployedBy"], "deploy_src"); ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(tags["fb.code.deployedAt"]));
        eq(r.code.short, expect.short); eq(r.code.excluded.join(","), "FB_Config");
        var r2 = B.FB_OpDeploySrc.call(B, repo, { op: "deploy_src", only: ["FB_A"] }, "d2");
        eq(r2.status, "ok"); eq(tags["fb.code.fingerprint"], ""); contains(tags["fb.code.deployedBy"], "castecny"); contains(r2.code.note, "castecny");
    } finally { B.SetTag = oS; B.FB_Config = oC; }
});
t("ITAN-Bootstrap bod 8 (FB-PU-02): bootstrap zapise fb.code.* (otisk = FB_CodeFingerprint nad src\\ bez konfigurace, deployedBy bootstrap) a vypise 'Otisk kodu v modelu'", function () {
    var el = bootElement(11037, {});
    var tags = {};
    el.TaggedValues = bootColl(function (n, v) { var tv = { Name: n, Value: v, Update: function () { tags[n] = tv.Value; return true; } }; return tv; });
    var r = runBootstrap({ rows: [{ id: 11037, guid: "{ADDIN-11037}", stereo: "JavascriptAddin", pkg: "EA Addins", el: el }], signals: BOOT_SIGNALS });
    var line = r.out.filter(function (l) { return /^Otisk kodu v modelu: /.test(l); })[0] || "";
    ok(line != "", "radek Otisk: " + r.out.slice(-6).join("\n"));
    var files = fs.readdirSync(SRC).filter(function (f) { return /^AICodeBridge\..+\.js$/.test(f); }).map(function (f) { return { name: f, text: fs.readFileSync(path.join(SRC, f), "utf8") }; });
    var expect = B.FB_CodeFingerprint.call(B, files);
    eq(tags["fb.code.fingerprint"], expect.fingerprint, "stejny otisk jako FB_CodeFingerprint nad src");
    eq(tags["fb.code.files"], "" + expect.files); eq(tags["fb.code.deployedBy"], "bootstrap");
    contains(line, expect.short); contains(line, "(" + expect.files + " souboru bez konfigurace");
    // idempotence: druhy beh prepise tytez tagy (zadne duplicity)
    runBootstrap({ rows: [{ id: 11037, guid: "{ADDIN-11037}", stereo: "JavascriptAddin", pkg: "EA Addins", el: el }], signals: BOOT_SIGNALS });
    eq(el.TaggedValues._items.filter(function (t) { return t.Name == "fb.code.fingerprint"; }).length, 1, "tag jen jednou");
});
t("FB_SessionStart (FB-PU-02): pod pumpou hlasi verzi + otisk pumpy a otisk kodu; pumpa v0.5 = POZOR starsi nez kod v modelu; mimo pumpu jen otisk kodu", function () {
    blReset(); var repo = blRepo();
    memFs.files["C:\\P\\pump.wsf"] = "// EA File Bridge - pumpa v0.6 (eafb/0.2)\nvar x = 1;\n";
    global.WScript = { ScriptFullName: "C:\\P\\pump.wsf" };
    try {
        var out = asEaRuntime(function () { return "" + B.FB_SessionStart.call(B, repo); });
        contains(out, "Pumpa v0.6, otisk "); contains(out, "(C:\\P\\pump.wsf)"); ok(out.indexOf("POZOR: pumpa") < 0, out);
        eq(B._fbPumpInfo.version, "0.6"); eq(B._fbPumpInfo.fingerprint.length, 64);
        contains(out, "Otisk kodu");
        memFs.files["C:\\P\\pump.wsf"] = "// EA File Bridge - pumpa v0.5 (eafb/0.2)\nvar x = 1;\n";
        var out2 = asEaRuntime(function () { return "" + B.FB_SessionStart.call(B, repo); });
        contains(out2, "POZOR: pumpa v0.5 je starsi nez kod v modelu (potrebuje pumpu v0.6+)"); contains(out2, "refresh-workspace");
    } finally { delete global.WScript; delete B._fbPumpInfo; delete B._fbSessionRepo; delete B._fbOwnGuids; }
    var out3 = "" + B.FB_SessionStart.call(B, repo);
    ok(out3.indexOf("Pumpa v") < 0 && out3.indexOf("Otisk kodu") >= 0, out3);
});
// --- src: bezici pumpa (FB-PU-07) ---
function p6Status(phase, aliveUntilMs, extra) {
    function fmt(d) { function p(x) { return (x < 10 ? "0" : "") + x; } return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()); }
    var o = { protocol: "eafb/0.2", pump: { version: "v0.6", fingerprint: "abc", path: "C:\\GIT\\ea-file-bridge\\pump.wsf", started: "2026-10-12 08:00:00" }, phase: phase, file: "req-x.json", since: "2026-10-12 08:01:00", heartbeat: fmt(new Date()), aliveUntil: fmt(new Date(aliveUntilMs)) };
    for (var k in (extra || {})) { o[k] = extra[k]; }
    memFs.files[B1_RES + "\\pump-status.json"] = JSON.stringify(o);
}
t("FB_PumpAlive (FB-PU-07): bezi = aliveUntil v budoucnu (idle i processing/waiting_confirm), nebezi = aliveUntil minul nebo faze stopped, neznamo = soubor chybi; text pro cloveka", function () {
    blReset(); var repo = blRepo(); var now = new Date().getTime();
    var a0 = B.FB_PumpAlive.call(B, repo, B1_BASE); eq(a0.known, false); eq(a0.running, false); contains(a0.text, "stavovy soubor");
    p6Status("idle", now + 20000); var a1 = B.FB_PumpAlive.call(B, repo, B1_BASE); eq(a1.running, true); eq(a1.known, true); eq(a1.phase, "idle"); contains(a1.text, "BEZI PUMPA v0.6"); contains(a1.text, "poloz req-*.json do requests");
    p6Status("waiting_confirm", now + 300000); eq(B.FB_PumpAlive.call(B, repo, B1_BASE).running, true);
    p6Status("processing", now - 1000); var a3 = B.FB_PumpAlive.call(B, repo, B1_BASE); eq(a3.running, false); contains(a3.text, "Pumpa nebezi");
    p6Status("stopped", now + 20000); eq(B.FB_PumpAlive.call(B, repo, B1_BASE).running, false);
    memFs.files[B1_RES + "\\pump-status.json"] = "{nevalidni"; eq(B.FB_PumpAlive.call(B, repo, B1_BASE).running, false);
    // baseDir z FB_ResolveBaseDir, kdyz chybi
    p6Status("idle", now + 20000);
    var oR = B.FB_ResolveBaseDir; B.FB_ResolveBaseDir = function () { return B1_BASE; };
    try { eq(B.FB_PumpAlive.call(B, repo).running, true); } finally { B.FB_ResolveBaseDir = oR; }
});
t("schranka + GUI fallback (FB-PU-07): pri bezici pumpe (tep) nic nezpracuji a reknou, ze davky zpracovava pumpa; bez pumpy bezi jako dnes", function () {
    blReset(); var repo = blRepo(); var now = new Date().getTime();
    var oC = B.FB_Config; B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", baseDir: B1_BASE }]; };
    var oSess = global.Session; global.Session = { Output: function () { }, Prompt: function () { return 1; } };
    var called = 0; var oM = B.FB_Main; B.FB_Main = function () { called++; return JSON.stringify({ protocol: "eafb/0.2", id: "q", status: "done", results: [] }); };
    try {
        p6Status("idle", now + 20000);
        mockClipboard.text = JSON.stringify({ protocol: "eafb/0.2", id: "q", ops: [{ op: "ping" }] });
        var o1 = "" + B.FB_ClipboardImport.call(B, repo);
        contains(o1, "BEZI PUMPA"); eq(called, 0, "schranka nic nezpracovala");
        memFs.files[B1_REQ + "\\req-g1.json"] = JSON.stringify({ protocol: "eafb/0.2", id: "g1", ops: [{ op: "ping" }] });
        var o2 = "" + B.FB_ProcessFolder.call(B, repo);
        contains(o2, "BEZI PUMPA"); eq(called, 0, "GUI fallback nic nezpracoval"); ok(memFs.files[B1_REQ + "\\req-g1.json"], "soubor zustal pumpe");
        p6Status("idle", now - 60000); // pumpa mrtva
        var o3 = "" + B.FB_ProcessFolder.call(B, repo);
        ok(o3.indexOf("BEZI PUMPA") < 0, o3); eq(called, 1, "bez pumpy GUI fallback zpracuje");
    } finally { B.FB_Config = oC; global.Session = oSess; B.FB_Main = oM; }
});
t("FB_Main v0.18 (FB-PU-04): Log i u predcasnych navratu - E_PARSE (nevalidni JSON), E_ARGS (zastupny text v repo), prazdne ops", function () {
    b1Reset(); var repo = blRepo();
    var before = repo._output.length;
    var r1 = pumpRun(repo, null, "lg1", "{nevalidni"); eq(r1.code, "E_PARSE");
    var r2 = pumpRun(repo, null, "lg2", JSON.stringify({ protocol: "eafb/0.2", id: "lg2", repo: "<REPO>", ops: [{ op: "ping" }] })); eq(r2.code, "E_ARGS");
    var r3 = pumpRun(repo, null, "lg3", JSON.stringify({ protocol: "eafb/0.2", id: "lg3", repo: "EAEXAMPLE.QEA", ops: [] })); eq(r3.code, "E_PARSE");
    var logs = repo._output.slice(before).map(function (o) { return o.text; });
    ok(logs.some(function (l) { return /FB \? -> E_PARSE \(request neni validni JSON/.test(l); }), logs.join("\n"));
    ok(logs.some(function (l) { return /FB lg2 -> E_ARGS \(zastupny text v poli repo/.test(l); }), logs.join("\n"));
    ok(logs.some(function (l) { return /FB lg3 -> E_PARSE \(request nema neprazdne pole ops\)/.test(l); }), logs.join("\n"));
});

// ===========================================================================
// B2 TEXTY (Z261004b-6): okno podle FB-UI-08, rozsah mazani, druhe kolo,
// otisk souhrnu, E_PARSE s pozici, chyby souboru/DB, session po radcich,
// Output jednou, N-E2E-1/-5/-6, tag ai.risk.codes
// ===========================================================================
function b2Legend(txt) { return (txt.match(/Ano = provest ted  \|  Ne = zahodit davku  \|  Storno = nechat cekat/g) || []).length; }
t("B2 okno: smazani balicku s obsahem -> summary.deletes nese druh a SKUTECNY rozsah (balicek vcetne N prvku), okno ho rekne, cil neni mezi 'Prvky'", function () {
    b1Reset(); var repo = blRepo();
    var r = runFile(repo, [{ op: "delete_from_model", targets: [{ type: "Package", id: 11 }] }], "b2d1");
    eq(r.status, "confirm_required", JSON.stringify(r).substring(0, 300));
    var dl = r.risk.summary.deletes;
    ok(dl && dl.length === 1, "deletes[]: " + JSON.stringify(r.risk.summary));
    eq(dl[0].kind, "package"); eq(dl[0].name, "A"); eq(dl[0].scopeKnown, true); eq(dl[0].elements, 4); eq(dl[0].packages, 1);
    eq(dl[0].path, "Model.#FB-TEST.A");
    eq((r.risk.summary.targets || []).length, 0, "mazany cil nepatri mezi ostatni zmeny (FB-PU-20 b)");
    eq((r.risk.summary.packages || []).length, 0);
    var txt = "" + B.FB_ConfirmSummary.call(B, r);
    contains(txt, "AI chce SMAZAT 1 cil z modelu");
    contains(txt, "SMAZE balicek \"A\" vcetne 4 prvku, 1 podbalicku");
    contains(txt, "kde: Model.#FB-TEST.A");
    contains(txt, "Proc se ptam:");
    contains(txt, "Mazani a odebirani nejde vzit zpet jednim krokem");
    ok(txt.indexOf("politikou klasifikovana") < 0, "technicky text duvodu nepatri do okna: " + txt);
    ok(txt.indexOf("viz res soubor") < 0, "zadne '+ N dalsi duvod - viz res'");
    contains(txt, "Provest?"); eq(b2Legend(txt), 1, "jedna legenda tlacitek");
    contains(txt, "(davka b2d1 | otisk "); contains(txt, "1 zapis | CLASS_ELEVATED");
    ok(txt.indexOf("Chysta se") < 0, "stary nadpis z metrik");
});
t("B2 okno: smisena davka (smazat prvek + upravit jiny) -> smazane zvlast od ostatnich zmen; konektor A -> B a atribut Trida.x se jmenem", function () {
    b1Reset(); var repo = blRepo();
    repo.GetConnectorByID = function (id) { return (id == 301) ? { ConnectorID: 301, ClientID: 101, SupplierID: 102, Type: "Association", Name: "" } : null; };
    var r = runFile(repo, [
        { op: "delete_from_model", targets: [{ type: "Element", id: 104 }, { type: "Connector", id: 301 }, { type: "Attribute", id: 401 }] },
        { op: "create_or_update_elements", elements: [{ elementID: 102, notes: "x" }] }
    ], "b2d2");
    eq(r.status, "confirm_required");
    var dl = r.risk.summary.deletes;
    eq(dl.length, 3); eq(dl[0].kind, "element"); eq(dl[0].name, "ElC"); eq(dl[1].kind, "connector"); eq(dl[1].label, "ElA -> ElB");
    eq(dl[2].kind, "attribute"); ok(/^ElB\./.test(dl[2].label), "atribut Trida.x: " + dl[2].label);
    eq(r.risk.summary.targets.join(","), "ElB", "mezi ostatnimi zmenami jen upravovany prvek");
    var txt = "" + B.FB_ConfirmSummary.call(B, r);
    contains(txt, "SMAZE class \"ElC\""); contains(txt, "SMAZE vazbu ElA -> ElB (Association)"); contains(txt, "SMAZE atribut ElB.");
    contains(txt, "upravi 1 existujici prvek: \"ElB\"");
    var iDel = txt.indexOf("SMAZE class"), iUpd = txt.indexOf("upravi 1 existujici");
    ok(iDel >= 0 && iUpd > iDel, "mazane pred ostatnimi zmenami");
    eq(b2Legend(txt), 1);
});
t("B2 okno: 'Co se stane' z operaci a cilu (scenare do UC + vazby), ne z metrik; vsechny duvody jako vety; Ceka od z resp.since", function () {
    b1Reset(); var repo = blRepo();
    var r = runFile(repo, [
        { op: "create_or_update_scenarios", element: 103, scenarios: [{ name: "Basic", steps: [{ text: "a" }] }, { name: "Alt", steps: [{ text: "b" }] }] }, // v0.20: krok = objekt {text} (retezec = E_ARGS, FB-PU-24)
        { op: "create_or_update_connectors", connectors: [{ source: 103, target: 101, type: "Dependency" }] }
    ], "b2a1");
    eq(r.status, "confirm_required");
    var acts = r.risk.summary.actions;
    ok(acts && acts.length === 2, JSON.stringify(acts));
    eq(acts[0].op, "create_or_update_scenarios"); eq(acts[0].items, 2); eq(acts[0].targets[0], "ElA1");
    eq(acts[1].op, "create_or_update_connectors"); eq(acts[1].pairs[0], "ElA1 -> ElA (Dependency)");
    var txt = "" + B.FB_ConfirmSummary.call(B, r);
    contains(txt, "AI chce zapsat do modelu a potrebuje tvuj souhlas.");
    contains(txt, "do prvku \"ElA1\" zapise scenare (2; prepise stavajici sadu)");
    contains(txt, "vytvori 1 vazbu: ElA1 -> ElA (Dependency)");
    contains(txt, "Zapis scenaru prepise stavajici sadu u prvku");
    ok(/Ceka od \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \(\d+ min\)/.test(txt), "Ceka od: " + txt);
    ok(txt.indexOf("Chysta se vytvorit") < 0 && txt.indexOf("Chysta se upravit") < 0, "zadne metriky v nadpisu");
    // ageInfo z pumpy ma prednost (2. parametr, typeof)
    var txt2 = "" + B.FB_ConfirmSummary.call(B, r, { since: "2026-10-12 09:12:00", ageMin: 125 });
    contains(txt2, "Ceka od 2026-10-12 09:12:00 (125 min)");
});
t("B2 FB_ReasonText: kod -> veta; neznamy kod -> puvodni text; stara odpoved bez kodu -> text", function () {
    contains(B.FB_ReasonText.call(B, { code: "THRESHOLD_ELEVATED", args: { key: "writeOps", value: 28, limit: 20 } }), "obsahuje 28 zapisu; bez potvrzeni je dovoleno nejvys 20");
    contains(B.FB_ReasonText.call(B, { code: "TARGET_UNRESOLVED", args: { ref: "GUID-PKG-Z-P4", ctx: "elements[0].package" } }), "nevi, kam davka miri");
    contains(B.FB_ReasonText.call(B, { code: "PREV_EXCEPTION", args: {} }), "Predchozi davka skoncila chybou");
    eq(B.FB_ReasonText.call(B, { code: "NECO_NOVEHO", text: "puvodni technicky text", args: {} }), "puvodni technicky text");
    eq(B.FB_ReasonText.call(B, "jen text"), "jen text");
    var old = "" + B.FB_ConfirmSummary.call(B, { status: "confirm_required", id: "old", risk: { metrics: { createOps: 1, writeOps: 1 }, summary: { targets: ["X"], packages: ["P"] }, riskReasons: ["Operace 'x' je politikou klasifikovana ELEVATED"] }, results: [] });
    contains(old, "Operace 'x' je politikou klasifikovana ELEVATED"); contains(old, "vytvori 1 prvek v 1 balicku");
});
t("B2 RiskGate: reasonItems nesou stabilni kody; audit tag ai.risk.codes; FB_RiskNote 'kody:'", function () {
    b1Reset(); var repo = blRepo();
    var pol = polBase(B.FB_RiskPolicy.call(B)[0].baseline);
    var r = withPolicy(pol, function () { return runFile(repo, [{ op: "create_or_update_elements", elements: [{ elementID: 104, notes: "a" }, { elementID: 105, notes: "b" }, { elementID: 106, notes: "c" }] }], "b2c1"); });
    eq(r.status, "confirm_required");
    var items = r.risk.reasonItems; ok(items && items.length > 0, JSON.stringify(r.risk));
    var codes = items.map(function (i) { return i.code; });
    ok(codes.indexOf("THRESHOLD_ELEVATED") >= 0, codes.join(","));
    eq(items.length, r.risk.riskReasons.length, "kazdy duvod ma kod");
    var tags = {}, el = {};
    var repoT = mkRepo(); repoT.GetElementByGuid = function () { return el; };
    var oS = B.SetTag; B.SetTag = function (e, n, v) { tags[n] = v; };
    try { B.FB_RiskAuditTags.call(B, repoT, "{AUD}", r.risk, null); } finally { B.SetTag = oS; }
    ok(/THRESHOLD_ELEVATED/.test(tags["ai.risk.codes"]), "ai.risk.codes: " + tags["ai.risk.codes"]);
    contains(B.FB_RiskNote.call(B, r.risk), "kody: ");
});
t("B2 druhe kolo (FB-PU-19): potvrzeno bez rucni baseline -> res nese confirm.round {why: baseline-missing, no: 2}, okno zacina NEPROVEDENO", function () {
    blReset(); var repo = blRepo({ mult: 9000 });
    var pol = polBase({ thresholdsShadow: false, subtreeMax: 5000 });
    withPolicy(pol, function () {
        var r = runFile(repo, UPD_A1, "b2r1");
        eq(r.status, "confirm_required"); eq(r.baseline.action, "guided");
        ok(!(r.confirm && r.confirm.round), "prvni kolo bez round");
        var r2 = confirmFile(repo, r, "b2r1", true);
        eq(r2.status, "confirm_required"); eq(r2.confirm.round.why, "baseline-missing"); eq(r2.confirm.round.no, 2);
        var txt = "" + B.FB_ConfirmSummary.call(B, r2);
        ok(txt.indexOf("NEPROVEDENO - zaloha stale chybi") === 0, "prvni radek: " + txt.split("\n")[0]);
        contains(txt, "(kolo 2)");
        contains(txt, "Potvrdil jsi, ale cerstva rucni zaloha stale chybi");
        var r3 = confirmFile(repo, r2, "b2r1", true);
        eq(r3.confirm.round.no, 3);
    });
});
t("B2 otisk souhrnu (FB-PU-21): podvrzeny souhrn v res (jiny mazany cil) -> potvrzeni NEPROVEDE nic, nove kolo 'summary-mismatch' s pravdivym souhrnem; nezmeneny res projde", function () {
    b1Reset(); var repo = blRepo();
    var r = runFile(repo, [{ op: "delete_from_model", targets: [{ type: "Element", id: 104 }] }], "b2s1");
    eq(r.status, "confirm_required"); ok(r.risk.summaryHash && r.risk.summaryHash.length === 64, "summaryHash");
    // agent (omylem/zamerne) prepise res na disku: jine jmeno mazaneho, jina cesta
    var tampered = JSON.parse(JSON.stringify(r));
    tampered.risk.summary.deletes[0].name = "Poznamka-docasna"; tampered.risk.summary.deletes[0].path = "Model.#FB-TEST.Poznamka-docasna";
    tampered.risk.summary.paths = ["Model.#FB-TEST.Poznamka-docasna"];
    memFs.files[BL_BASE + "\\responses\\res-b2s1.json"] = JSON.stringify(tampered);
    var before = repo._deleteCalls;
    var r2 = confirmFile(repo, tampered, "b2s1", true);
    eq(r2.status, "confirm_required", JSON.stringify(r2).substring(0, 400));
    eq(repo._deleteCalls, before, "nic se nesmazalo");
    eq(r2.confirm.round.why, "summary-mismatch"); ok(r2.confirm.nonce != r.confirm.nonce, "novy nonce");
    ok(r2.risk.reasonItems.some(function (i) { return i.code == "RECLASS_SUMMARY"; }), "kod RECLASS_SUMMARY");
    eq(r2.risk.summary.deletes[0].name, "ElC", "pravdivy souhrn");
    var txt = "" + B.FB_ConfirmSummary.call(B, r2);
    ok(txt.indexOf("ZNOVU K POTVRZENI - souhrn v okne neodpovidal modelu") === 0, txt.split("\n")[0]);
    contains(txt, "SMAZE class \"ElC\""); ok(txt.indexOf("Poznamka-docasna") < 0, "podvrzene jmeno v okne neni");
    // nepodvrzene druhe kolo projde (stejny mechanismus jako metriky)
    var r3 = confirmFile(repo, r2, "b2s1", true);
    ok(r3.status != "confirm_required", "nepodvrzene kolo uz projde k provedeni: " + JSON.stringify(r3).substring(0, 300));
    ok(r3.results[0].status != "pending" && r3.results[0].status != "skipped", "operace se provedla (mock bez kolekce ji neumi dokoncit)");
});
t("B2 E_PARSE s pozici (FB-PU-12): carka navic pred ] / } -> E_PARSE rika kde (znak, radek:sloupec, okoli); resp.parse.position", function () {
    var bad = '{"protocol":"eafb/0.2","id":"cc","repo":"EAEXAMPLE.QEA","ops":[{"op":"ping"},]}';
    var threw = "";
    try { B.FB_JsonParse.call(B, bad); } catch (e) { threw = "" + e.message; }
    contains(threw, "E_PARSE: carka navic pred ]"); contains(threw, "u znaku " + (bad.indexOf("]}") + 1)); contains(threw, "(radek:sloupec 1:");
    try { B.FB_JsonParse.call(B, '{"a":1,}'); threw = ""; } catch (e2) { threw = "" + e2.message; }
    contains(threw, "carka navic pred }");
    try { B.FB_JsonParse.call(B, '{"a":1 "b":2}'); threw = ""; } catch (e3) { threw = "" + e3.message; }
    contains(threw, "u znaku 8");
    eq(JSON.stringify(B.FB_JsonParse.call(B, '\uFEFF{"a":[1,{"b":"x\\"y"}],"c":null,"d":-1.5e3}')), '{"a":[1,{"b":"x\\"y"}],"c":null,"d":-1500}');
    b1Reset(); var repo = blRepo();
    var r = pumpRun(repo, null, "cc", bad);
    eq(r.code, "E_PARSE"); contains(r.message, "carka navic pred ]"); contains(r.message, "u znaku");
    ok(r.parse && r.parse.position > 0, "resp.parse: " + JSON.stringify(r.parse));
});
t("B2 FB_InterpretError (FB-PU-29): souborova chyba -> E_FILE s vlastnim textem (ne E_PERMISSION), deadlock/timeout -> E_DB_RETRY, EA security dal E_PERMISSION/E_LOCKED", function () {
    eq(B.FB_InterpretError.call(B, "Permission denied").code, "E_FILE");
    eq(B.FB_InterpretError.call(B, "Path not found").code, "E_FILE");
    var f = B.FB_InterpretError.call(B, "Could not save C:\\GIT\\x\\responses\\images\\a.png: Permission denied");
    eq(f.code, "E_FILE"); eq(f.fileError, true); contains(f.message, "NENI to EA security"); contains(f.message, "responses\\images\\a.png");
    eq(B.FB_InterpretError.call(B, "Transaction (Process ID 52) was deadlocked on lock resources with another process and has been chosen as the deadlock victim.").code, "E_DB_RETRY");
    eq(B.FB_InterpretError.call(B, "Lock request time out period exceeded.").code, "E_DB_RETRY");
    contains(B.FB_InterpretError.call(B, "Query timeout expired").message, "zkus davku znovu");
    eq(B.FB_InterpretError.call(B, "Cannot create new UseCase.  The parent package is locked by Project Security.").code, "E_PERMISSION");
    eq(B.FB_InterpretError.call(B, "Element is locked by user novak").code, "E_LOCKED");
    eq(B.FB_InterpretError.call(B, "Object reference not set"), null);
});
t("B2 E_FILE v davce: vysledek operace E_FILE, priznak W8 se zvedne (dalsi zapis jde oknem s PREV_EXCEPTION)", function () {
    b1Reset(); var repo = blRepo();
    var oC = B.FB_OpCreateElement; B.FB_OpCreateElement = function () { throw new Error("Permission denied"); };
    var r;
    try { r = runFile(repo, [{ op: "create_element", name: "N", type: "Class", "package": "{PK-11}" }], "b2f1"); }
    finally { B.FB_OpCreateElement = oC; }
    eq(r.status, "error"); eq(r.results[0].code, "E_FILE"); contains(r.results[0].message, "NENI to EA security");
    var r2 = runFile(repo, [{ op: "create_element", name: "N2", type: "Class", "package": "{PK-11}" }], "b2f2");
    eq(r2.status, "confirm_required", JSON.stringify(r2).substring(0, 300));
    ok(r2.risk.reasonItems.some(function (i) { return i.code == "PREV_EXCEPTION"; }), "W8 po E_FILE");
});
t("B2 FB_SessionStart (FB-PU-05/FB-UI-14): hlaseni po radcich, hlavicka s datem, varovani PRED informacemi", function () {
    b1Reset(); var repo = mkRepo({ connectionString: "C:\\HARNESS\\JINY.QEA" }); // bez polozky FB_WriteScope -> varovani
    var out = "" + B.FB_SessionStart.call(B, repo);
    var lines = out.split("\n");
    ok(lines.length >= 4, "po radcich: " + out);
    ok(/^==== AI Bridge pripraven - \d{1,2}\. \d{1,2}\. \d{4} \d{1,2}:\d{2} ====$/.test(lines[0]), "hlavicka: " + lines[0]);
    var iWarn = -1, iRepo = -1;
    for (var i = 0; i < lines.length; i++) { if (iWarn < 0 && /^(POZOR|CHYBA|Upozorneni)/.test(lines[i])) { iWarn = i; } if (/^Repozitar:/.test(lines[i])) { iRepo = i; } }
    ok(iWarn > 0 && iRepo > iWarn, "varovani (" + iWarn + ") pred 'Repozitar:' (" + iRepo + "): " + out);
    ok(out.indexOf(" | ") < 0 || out.indexOf("\n") > 0, "uz ne jeden slepeny radek");
    eq(repo._output.length, lines.length, "kazdy radek zvlast do Output tabu");
});
t("B2 Output tab (FB-PU-34): EnsureOutputVisible JEDNOU na konci davky (ne u kazdeho radku); FB_Config.outputShow false = nikdy; mimo davku hned", function () {
    b1Reset(); var repo = blRepo();
    var shows = 0; repo.EnsureOutputVisible = function () { shows++; };
    var r = runFile(repo, [{ op: "create_or_update_elements", elements: [{ elementID: 101, notes: "a" }, { elementID: 109, notes: "b" }, { elementID: 110, notes: "c" }] }], "b2o1");
    eq(r.status, "done", JSON.stringify(r).substring(0, 300));
    ok(repo._output.length >= 4, "nekolik radku v Output: " + repo._output.length);
    eq(shows, 1, "EnsureOutputVisible jednou za davku");
    shows = 0;
    B.Log.call(B, repo, "mimo davku");
    eq(shows, 1, "mimo davku hned");
    shows = 0;
    var oC = B.FB_Config; B.FB_Config = function () { var c = oC.call(B); c[0].outputShow = false; return c; };
    try { runFile(repo, [{ op: "create_or_update_elements", elements: [{ elementID: 101, notes: "d" }] }], "b2o2"); } finally { B.FB_Config = oC; }
    eq(shows, 0, "vypinac outputShow: false");
});
t("B2 N-E2E-1: deploy_src v okne 'nasadi kod bridge do modelu (... operaci | rozsah nespocitan)', bez 'zapsat prvku' a bez 'zapisu 0'; nespocitane metriky slovy", function () {
    b1Reset(); var repo = blRepo();
    var r = B.FB_RiskGate.call(B, repo, { ops: [{ op: "deploy_src" }] }, { deploy_src: { w: true, fn: "FB_OpDeploySrc" } });
    eq(r.summary.actions[0].op, "deploy_src");
    var txt = "" + B.FB_ConfirmSummary.call(B, { status: "confirm_required", id: "dep", risk: r, confirm: { hashPrefix: "abc" }, results: [] });
    contains(txt, "nasadi kod bridge do modelu (");
    ok(txt.indexOf("zapsat prvku") < 0 && txt.indexOf("zapisu 0") < 0, txt);
    var r2 = JSON.parse(JSON.stringify(r)); r2.metrics.metricsComplete = false; r2.metrics.writeOps = 0;
    var txt2 = "" + B.FB_ConfirmSummary.call(B, { status: "confirm_required", id: "dep2", risk: r2, results: [] });
    contains(txt2, "pocet zapisu nespocitan"); contains(txt2, "rozsah davky se nepodarilo spocitat");
});
t("B2 N-E2E-5: tataz rucni baseline nad predkem kryje 7 balicku -> v okne jednou, ne 7x", function () {
    blReset(); var repo = blRepo();
    repo._addBaseline(WL_GUID, "Pred upravou", 3); // rucni nad #FB-TEST = spolecny predek
    var ops = [{ op: "create_or_update_elements", elements: [101, 102, 104, 105, 106, 107, 108].map(function (i) { return { elementID: i, notes: "x" }; }) }];
    var polNB = polBase(B.FB_RiskPolicy.call(B)[0].baseline)(); polNB[0].block = { deleteTargets: 100, writeOps: 500, updatedExisting: 100, affectedPackages: 50 };
    var r = withPolicy(function () { return polNB; }, function () { return runFile(repo, ops, "b2n5"); });
    eq(r.status, "confirm_required"); eq(r.baseline.action, "guided"); eq(r.baseline.manual.ok, true);
    eq(r.baseline.manual.found.length, 1, "dedup: " + JSON.stringify(r.baseline.manual.found));
    var txt = "" + B.FB_ConfirmSummary.call(B, r);
    eq((txt.match(/Pred upravou nad/g) || []).length, 1, "jmeno baseline jednou v okne: " + txt);
});
t("B2 N-E2E-6: dialog uklidu baselines zacina lidskou vetou (kolik, ceho, starsich nez, kolik zustane, rucni se nemazou); GUIDy az pod carou / Output", function () {
    blReset(); var repo = clRepo(six());
    var r = B.FB_BaselineCleanup.call(B, repo, clCfg(), "report", true);
    ok(r.textHuman && r.text.indexOf(r.textHuman) === 0, "lidska veta prvni: " + r.text.split("\n")[0]);
    contains(r.textHuman, "Smazu 3 automaticke zalohy balicku \"A\" starsich nez 14 dni; 3 novejsi zustanou"); contains(r.textHuman, "rucni zalohy se nemazou");
    ok(r.textHuman.indexOf("{") < 0 && r.textHuman.indexOf("jnovak") < 0, "zadne GUIDy ani loginy v lidske vete");
    contains(r.textDetail, "uzivatel jnovak");
    var r0 = B.FB_BaselineCleanup.call(B, repo, clCfg({ maxAgeDays: 100 }), "report", true);
    contains(r0.textHuman, "Neni co uklizet");
    // menu: dialog = lidska veta + seznam balicek | zaloha bez GUIDu; tlacitka Ano = smazat, Ne = jen ukazat
    var oSess = global.Session; global.Session = { _prompts: [], _outputs: [], Prompt: function (m, k) { this._prompts.push({ msg: "" + m, kind: k }); return 2; }, Output: function (m) { this._outputs.push("" + m); } };
    var oCfg = B.FB_BaselineConfig; B.FB_BaselineConfig = function () { return { valid: true, cfg: clCfg() }; };
    try { B.EA_MenuClick.call(B, repo, 2, "-&AI Bridge", "Uklid automatickych baselines (ukazat / provest)"); }
    finally { global.Session = oSess; B.FB_BaselineConfig = oCfg; }
    var pr = global.Session === oSess ? null : null;
    ok(oSess === global.Session, "session vracena");
});

// ===========================================================================
// BALIK B2 - OPERACE (Z261004b-7, v0.20): FB-PU-24/-25/-26/-27/-30/-31/-32/
// -33/-43/-44/-45 + N-B-3. Kazdy bod ma test, ktery pri regresi zcervena.
// ===========================================================================
var REG_B2 = { "create_or_update_elements": { w: true }, "create_or_update_attributes": { w: true }, "create_or_update_operations": { w: true },
               "create_or_update_connectors": { w: true }, "create_or_update_package": { w: true }, "create_or_update_scenarios": { w: true },
               "create_or_update_messages": { w: true }, "set_diagram_object_style": { w: true }, "delete_from_model": { w: true }, "query": { w: false }, "ping": { w: false } };
// --- FB-PU-24: nezname pole / aliasy / E_ARGS ---
t("B2-op FB-PU-24: nezname pole 'sterotypes' -> varovani s napovedou; davka projde", function () {
    var req = { ops: [{ op: "create_or_update_elements", elements: [{ name: "X", type: "Class", "package": "{P}", sterotypes: "x" }] }] };
    var r = B.FB_FieldCheck.call(B, req, REG_B2);
    eq(r.problems.length, 0); eq(r.warnings.length, 1);
    contains(r.warnings[0], "ops[0].elements[0]: nezname pole 'sterotypes' (myslel jsi 'stereotypes'?)");
    ok(typeof req.ops[0].elements[0].sterotypes != "undefined", "nezname pole se nemaze (jen varovani)");
});
t("B2-op FB-PU-24: alias stereotype -> stereotypes se prepise v davce + varovani 'prijato jako'", function () {
    var req = { ops: [{ op: "create_or_update_elements", elements: [{ name: "X", type: "Class", "package": "{P}", stereotype: "use" }] }] };
    var r = B.FB_FieldCheck.call(B, req, REG_B2);
    eq(r.problems.length, 0); eq(r.aliased, 1);
    eq(req.ops[0].elements[0].stereotypes, "use"); ok(typeof req.ops[0].elements[0].stereotype == "undefined", "puvodni klic pryc");
    contains(r.warnings[0], "pole 'stereotype' prijato jako 'stereotypes'");
});
t("B2-op FB-PU-24: aliasy po operacich - attributes stereotypes->stereotype, defaultValue->default; operations parameters defaultValue->default; constraints description->notes; query limit->maxRows", function () {
    var req = { ops: [
        { op: "create_or_update_attributes", element: "{E}", attributes: [{ name: "a", stereotypes: "pk", defaultValue: "0" }] },
        { op: "create_or_update_operations", element: "{E}", operations: [{ name: "op", parameters: [{ name: "p", defaultValue: "1" }] }] },
        { op: "create_or_update_scenarios", element: "{E}", scenarios: [{ name: "S", description: "popis", steps: [{ text: "k" }] }] },
        { op: "query", sql: "SELECT 1 FROM t_package WHERE 1=1", limit: 10 }
    ] };
    var r = B.FB_FieldCheck.call(B, req, REG_B2);
    eq(r.problems.length, 0, JSON.stringify(r.problems));
    eq(req.ops[0].attributes[0].stereotype, "pk"); eq(req.ops[0].attributes[0]["default"], "0");
    eq(req.ops[1].operations[0].parameters[0]["default"], "1");
    eq(req.ops[2].scenarios[0].notes, "popis");
    eq(req.ops[3].maxRows, 10); ok(typeof req.ops[3].limit == "undefined");
    eq(r.aliased, 5);
});
t("B2-op FB-PU-24: taggedValues jako objekt = E_ARGS (ne tiche preskoceni); krok scenare jako retezec / bez text = E_ARGS", function () {
    var req = { ops: [
        { op: "create_or_update_elements", elements: [{ name: "X", type: "Class", "package": "{P}", taggedValues: { k: "v" } }] },
        { op: "create_or_update_scenarios", element: "{E}", scenarios: [{ name: "S", steps: ["a", { kind: "actor" }, { text: "ok" }] }] }
    ] };
    var r = B.FB_FieldCheck.call(B, req, REG_B2);
    eq(r.problems.length, 3, JSON.stringify(r.problems));
    eq(r.problems[0].code, "E_ARGS"); contains(r.problems[0].path, "elements[0].taggedValues"); contains(r.problems[0].message, "musi byt pole");
    contains(r.problems[1].path, "scenarios[0].steps[0]"); contains(r.problems[1].message, "retezec");
    contains(r.problems[2].path, "scenarios[0].steps[1].text");
});
t("B2-op FB-PU-24: barva jako '#FFCC00' se prevede na {red, green, blue} (driv = cerna); nesmysl = E_ARGS; dokumentacni klice (why) bez varovani; operace bez zaznamu se nekontroluje", function () {
    var req = { ops: [
        { op: "set_diagram_object_style", diagram: 5, why: "odbarveni", objects: [{ elementID: 1, backgroundColor: "#FFCC00" }, { elementID: 2, fontColor: "cervena" }] },
        { op: "ping", echo: "x", cokoliv: 1 }
    ] };
    var r = B.FB_FieldCheck.call(B, req, REG_B2);
    eq(req.ops[0].objects[0].backgroundColor.red, 255); eq(req.ops[0].objects[0].backgroundColor.green, 204); eq(req.ops[0].objects[0].backgroundColor.blue, 0);
    eq(r.problems.length, 1); contains(r.problems[0].path, "objects[1].fontColor");
    eq(r.warnings.length, 1, JSON.stringify(r.warnings)); contains(r.warnings[0], "barva");
});
t("B2-op FB-PU-24 pres FB_Main: varovani kontroly poli jsou v resp.warnings; E_ARGS z kontroly poli = P2 (nic neprovedeno)", function () {
    b1Reset(); var repo = blRepo();
    var r = runText(repo, [{ op: "create_or_update_elements", elements: [{ elementID: 101, nots: "x" }] }], "fc-1");
    eq(r.status, "done", JSON.stringify(r).substring(0, 300));
    ok(r.warnings && /nezname pole 'nots' \(myslel jsi 'notes'\?\)/.test(r.warnings.join(" ")), "warning v odpovedi: " + JSON.stringify(r.warnings));
    var r2 = runText(repo, [{ op: "create_or_update_elements", elements: [{ elementID: 101, taggedValues: { a: 1 } }] }], "fc-2");
    eq(r2.status, "error"); eq(r2.code, "E_ARGS"); eq(r2.results[0].status, "skipped");
    contains(r2.problems[0].path, "taggedValues");
});
// --- FB-PU-25: id jako klic upravy ---
t("B2-op FB-PU-25: elements {id} = UPDATE existujiciho (zadny duplicitni create) - P2 alias i druha obrana v operaci", function () {
    b1Reset(); var repo = blRepo();
    var r = runText(repo, [{ op: "create_or_update_elements", elements: [{ id: 101, notes: "pres id" }] }], "id-1");
    eq(r.status, "done", JSON.stringify(r).substring(0, 300));
    eq(r.results[0].items[0].created, false); eq(r.results[0].items[0].id, 101);
    eq(repo.GetElementByID(101).Notes, "pres id");
    // prime volani operace (bez P2): id funguje take
    var d = B.FB_OpElements.call(B, repo, { elements: [{ id: 101, alias: "A" }] }, "id-1b");
    eq(d.status, "ok"); eq(d.items[0].created, false); eq(repo.GetElementByID(101).Alias, "A");
    // bez klice a bez type: hlaska radi guid/elementID
    var e = B.FB_OpElements.call(B, repo, { elements: [{ name: "Nove" }] }, "id-1c");
    eq(e.code, "E_ARGS"); contains(e.message, "pro upravu existujiciho prvku pouzij guid nebo elementID");
});
t("B2-op FB-PU-25: packages {id} = UPDATE; attributes/operations {id} = klic podle AttributeID/MethodID (ne nove jmeno = novy zaznam); connectors/messages {id}", function () {
    b1Reset(); var repo = blRepo();
    var pk11 = repo.GetPackageByID(11); pk11.Update = function () { return true; }; pk11.Element = { ElementID: 10011, TaggedValues: mkColl(function (n, v) { return { Name: n, Value: v, Update: function () { } }; }), Update: function () { return true; } };
    var p = B.FB_OpPackage.call(B, repo, { packages: [{ id: 11, notes: "pkg pres id" }] }, "id-2");
    eq(p.status, "ok", p.message); eq(p.items[0].created, false); eq(p.items[0].id, 11);
    var el = repo._addElement({ id: 701, name: "Trida", packageID: 11 });
    el.Attributes = mkColl(function (n, ty) { return { AttributeID: 4001 + el.Attributes._items.length, AttributeGUID: mkGuid(), Name: n, Type: ty, Update: function () { return true; }, TaggedValues: mkColl() }; });
    el.Methods = mkColl(function (n, ty) { return { MethodID: 5001 + el.Methods._items.length, MethodGUID: mkGuid(), Name: n, ReturnType: ty, Parameters: mkColl(), Update: function () { return true; }, TaggedValues: mkColl() }; });
    var a1 = B.FB_OpAttributes.call(B, repo, { element: 701, attributes: [{ name: "a" }] }, "id-3");
    eq(a1.items[0].created, true);
    var a2 = B.FB_OpAttributes.call(B, repo, { element: 701, attributes: [{ id: a1.items[0].id, name: "a_prejmenovano" }] }, "id-4");
    eq(a2.status, "ok", a2.message); eq(a2.items[0].created, false); eq(el.Attributes.Count, 1, "zadny novy atribut"); eq(el.Attributes.GetAt(0).Name, "a_prejmenovano");
    var o1 = B.FB_OpOperations.call(B, repo, { element: 701, operations: [{ name: "op" }] }, "id-5");
    var o2 = B.FB_OpOperations.call(B, repo, { element: 701, operations: [{ id: o1.items[0].id, name: "op2" }] }, "id-6");
    eq(o2.status, "ok", o2.message); eq(o2.items[0].created, false); eq(el.Methods.Count, 1); eq(el.Methods.GetAt(0).Name, "op2");
    var a3 = B.FB_OpAttributes.call(B, repo, { element: 701, attributes: [{ id: 99999, name: "x" }] }, "id-7");
    eq(a3.code, "E_NOT_FOUND"); contains(a3.message, "attributeID (id z vysledku) atributu TOHOTO elementu");
    // connectors: id = connectorID (GetConnectorByID)
    var cn = { ConnectorID: 777, ConnectorGUID: "{CN-777}", ClientID: 101, SupplierID: 102, Type: "Dependency", Name: "", Notes: "", Update: function () { return true; }, GetLastError: function () { return ""; },
               ClientEnd: { Update: function () { return true; } }, SupplierEnd: { Update: function () { return true; } }, TaggedValues: mkColl() };
    repo.GetConnectorByID = function (i) { return i == 777 ? cn : null; };
    var c = B.FB_OpConnectors.call(B, repo, { connectors: [{ id: 777, name: "pres id" }] }, "id-8");
    eq(c.status, "ok", c.message); eq(c.items[0].created, false); eq(cn.Name, "pres id");
    var cE = B.FB_OpConnectors.call(B, repo, { connectors: [{ name: "bez klice" }] }, "id-9");
    eq(cE.code, "E_ARGS"); contains(cE.message, "connectorID (id z vysledku)");
});
// --- FB-PU-26: polozky pri vyjimce ---
t("B2-op FB-PU-26: vyjimka EA pri zapisu vlastnosti HNED po vzniku prvku -> items nese jeho GUID (partial), ne jen {op, status, code}", function () {
    b1Reset(); var repo = blRepo();
    var oTw = B.FB_TagWrite;
    var n = 0;
    B.FB_TagWrite = function () { if (++n == 2) { throw new Error("The parent package is locked by Project Security."); } return []; };
    try {
        var r = runText(repo, [{ op: "create_or_update_elements", elements: [
            { name: "Prvni", type: "Class", "package": "{PK-11}" }, { name: "Druhy", type: "Class", "package": "{PK-11}" }, { name: "Treti", type: "Class", "package": "{PK-11}" }] }], "pu26-1");
    } finally { B.FB_TagWrite = oTw; }
    eq(r.status, "error"); var x = r.results[0];
    eq(x.code, "E_PERMISSION", x.message); eq(x.partial, true);
    eq(x.items.length, 2, "prvni dokonceny + druhy rozpracovany: " + JSON.stringify(x.items));
    eq(x.items[1].name, "Druhy"); eq(x.items[1].created, true); eq(x.items[1].index, 1); ok(/^\{/.test(x.items[1].guid), "GUID druheho prvku je v odpovedi");
    contains(x.message, "pred chybou probehlo 2 polozek");
    ok(x.recovery && /obnova:/.test(x.recovery), "chyba rika, jak zpet: " + x.recovery);
});
t("B2-op FB-PU-26: po vyjimce se dohledaji prvky s razitkem ai.request davky, ktere v items nejsou -> stamped[] (opravna davka je nezaklada znovu)", function () {
    b1Reset(); var repo = blRepo();
    var reqId = "pu26-2";
    repo._sqlRules.unshift({ re: /p\.Property = 'ai\.request' AND p\.Value = 'pu26-2'/i, rows: [
        { Object_ID: "9001", ea_guid: "{STAMP-1}", Name: "Vznikly", Object_Type: "Class" },
        { Object_ID: "9002", ea_guid: "{STAMP-2}", Name: "FB pu26-2", Object_Type: "Artifact" } ] });
    var oE = B.FB_OpElements;
    B.FB_OpElements = function () { this._fbOpProgress = { items: [] }; throw new Error("COM: Nesoulad typu"); };
    try { var r = runText(repo, [{ op: "create_or_update_elements", elements: [{ name: "X", type: "Class", "package": "{PK-11}" }] }], reqId); }
    finally { B.FB_OpElements = oE; }
    eq(r.status, "error"); var x = r.results[0];
    eq(x.code, "E_EXCEPTION");
    ok(x.stamped && x.stamped.length == 1, "stamped[] bez audit Artifactu: " + JSON.stringify(x.stamped));
    eq(x.stamped[0].guid, "{STAMP-1}"); eq(x.stamped[0].id, 9001);
    contains(x.message, "1 dalsich prvku s razitkem teto davky (stamped[])");
});
// --- FB-PU-27: rebuild po validaci ---
t("B2-op FB-PU-27: scenarios - druhy scenar bez name = E_ARGS a NIC se nesmaze (validace cele sady pred rebuildem)", function () {
    var repo = wlRepo(); var el = mkScEl(repo, 7701, "UC", 1054);
    var a = B.FB_OpScenarios.call(B, repo, { element: 7701, scenarios: [{ name: "Stary", steps: [{ text: "s" }] }] }, "sc-0");
    eq(a.status, "ok", JSON.stringify(a).substring(0, 300)); eq(el.Scenarios.Count, 1);
    var r = B.FB_OpScenarios.call(B, repo, { element: 7701, scenarios: [{ name: "Novy", steps: [{ text: "n" }] }, { steps: [{ text: "x" }] }] }, "sc-1");
    eq(r.status, "error"); eq(r.code, "E_ARGS"); contains(r.message, "scenarios[1]: chybi name - nic nebylo smazano");
    eq(el.Scenarios.Count, 1, "stary scenar zustal"); eq(el.Scenarios.GetAt(0).Name, "Stary");
    var r2 = B.FB_OpScenarios.call(B, repo, { element: 7701, scenarios: [{ name: "Novy", steps: ["retezec"] }] }, "sc-2");
    eq(r2.code, "E_ARGS"); contains(r2.message, "steps[0]: krok musi byt objekt"); eq(el.Scenarios.Count, 1);
});
t("B2-op FB-PU-27: scenarios - vyjimka EA po smazani -> removed v odpovedi + recovery veta (FB_Main)", function () {
    var repo = wlRepo(); var el = mkScEl(repo, 7702, "UC2", 1054);
    B.FB_OpScenarios.call(B, repo, { element: 7702, scenarios: [{ name: "A", steps: [{ text: "s" }] }, { name: "B", steps: [{ text: "t" }] }] }, "sc-3");
    eq(el.Scenarios.Count, 2);
    el.Scenarios.AddNew = function () { throw new Error("The parent package is locked by Project Security."); };
    var rr = B.FB_OpScenarios.call(B, repo, { element: 7702, scenarios: [{ name: "C", steps: [{ text: "u" }] }] }, "sc-4");
    eq(rr.status, "error"); eq(rr.code, "E_EXCEPTION"); eq(rr.removed, 2, "chyba po mazani nese removed: " + JSON.stringify(rr));
    eq(B._fbOpProgress.removed, 2, "operace hlasi pocet smazanych i pres _fbOpProgress (pro vyjimku, kterou nechyti)");
    // FB_Main: removed z progress -> odpoved + recovery veta (zaloha davky / zadna)
    b1Reset(); var repoM = blRepo();
    var oE = B.FB_OpElements;
    B.FB_OpElements = function () { this._fbOpProgress = { items: [], removed: 3 }; throw new Error("The parent package is locked by Project Security."); };
    try { var r = runText(repoM, [{ op: "create_or_update_elements", elements: [{ elementID: 101, notes: "x" }] }], "sc-5"); } finally { B.FB_OpElements = oE; }
    eq(r.status, "error"); var x = r.results[0];
    eq(x.code, "E_PERMISSION", x.message); eq(x.removed, 3, JSON.stringify(x));
    contains(x.recovery, "obnova: baseline"); contains(x.recovery, "FB-AUTO");
});
t("B2-op FB-PU-27: messages rebuild - neexistujici target nove zpravy = chyba PRED mazanim (zadny Sequence konektor nezmizi)", function () {
    b1Reset(); var repo = blRepo();
    var dg = { DiagramID: 201, DiagramGUID: "{DG-201}", Name: "SeqB" };
    repo.GetDiagramByID = function (i) { return i == 201 ? dg : null; };
    var deleted = 0;
    var life = repo.GetElementByID(109);
    life.Connectors = mkColl(); life.Connectors.DeleteAt = function () { deleted++; };
    repo._sqlRules.unshift({ re: /FROM t_connector WHERE DiagramID = 201/i, rows: [{ Connector_ID: "301" }] });
    repo.GetConnectorByID = function (i) { return i == 301 ? { ConnectorID: 301, ClientID: 109, SupplierID: 101 } : null; };
    var r = B.FB_OpMessages.call(B, repo, { diagram: 201, rebuild: true, messages: [{ source: 109, target: "{NEEXISTUJE}", seqNo: 1 }] }, "msg-1");
    eq(r.status, "error"); eq(r.code, "E_NOT_FOUND", r.message); contains(r.message, "nic nebylo smazano (validace pred rebuildem)");
    eq(deleted, 0, "zadne mazani");
    var r2 = B.FB_OpMessages.call(B, repo, { diagram: 201, rebuild: true, messages: [{ source: 109, target: 101, seqNo: 1, operation: 424242 }] }, "msg-2");
    eq(r2.code, "E_NOT_FOUND"); contains(r2.message, "operace nenalezena"); eq(deleted, 0);
});
// --- FB-PU-30: GUID bez zavorek / neplatny tvar ---
t("B2-op FB-PU-30: GUID bez slozenych zavorek se doplni (resolvery i P2); {tvar s mezerou} = E_ARGS pred SQL", function () {
    b1Reset(); var repo = blRepo();
    var el = repo._addElement({ id: 7801, name: "Guidovy", guid: "{12345678-ABCD-4EF0-9876-ABCDEF012345}", packageID: 11 });
    repo._sqlRules.unshift({ re: /ea_guid = '\{12345678-ABCD-4EF0-9876-ABCDEF012345\}'/i, rows: [{ Object_ID: "7801", ea_guid: "{12345678-ABCD-4EF0-9876-ABCDEF012345}", Package_ID: "11", Object_Type: "Class", Name: "Guidovy" }] });
    var e1 = B.FB_ResolveEl.call(B, repo, "12345678-ABCD-4EF0-9876-ABCDEF012345");
    ok(e1 != null && e1.ElementID == 7801, "bez zavorek = GUID, ne jmeno");
    var tc = B.FB_TargetCache.call(B, repo, "element", "12345678-ABCD-4EF0-9876-ABCDEF012345");
    ok(tc != null && tc.id == 7801, "TargetCache totez");
    var q0 = repo._sqlLog.length;
    var e2 = B.FB_ResolveEl.call(B, repo, "{abc def}");
    ok(e2 == null && B._fbResolveErr && B._fbResolveErr.code == "E_ARGS", "neplatny tvar = E_ARGS: " + JSON.stringify(B._fbResolveErr));
    contains(B._fbResolveErr.message, "neplatny tvar GUID");
    var r = runText(repo, [{ op: "create_or_update_elements", elements: [{ guid: "12345678-ABCD-4EF0-9876-ABCDEF012345", notes: "pres bare guid" }] }], "g30-1");
    eq(r.status, "done", JSON.stringify(r).substring(0, 400)); eq(r.results[0].items[0].id, 7801); eq(el.Notes, "pres bare guid");
    var r2 = runText(repo, [{ op: "create_or_update_elements", elements: [{ guid: "{12345678 ABCD}", notes: "x" }] }], "g30-2");
    eq(r2.status, "error"); eq(r2.code, "E_ARGS"); contains(r2.problems[0].message, "neplatny tvar GUID");
});
// --- FB-PU-31 + N-B-3: query ---
function qRepo(n, table) {
    var rows = []; for (var i = 0; i < n; i++) { rows.push({ Name: "r" + i }); }
    return mkRepo({ sqlRules: [{ re: new RegExp(table || "t_package", "i"), rows: rows }] });
}
t("B2-op FB-PU-31: ';' a INTO mimo retezec = E_SQL_READONLY (dotaz se nespusti); uvnitr '...' projde", function () {
    var repo = qRepo(1);
    var r1 = B.FB_OpQuery.call(B, repo, { sql: "SELECT Name FROM t_package WHERE Name = 'a'; DELETE FROM t_package" });
    eq(r1.code, "E_SQL_READONLY"); contains(r1.message, "';'");
    var r2 = B.FB_OpQuery.call(B, repo, { sql: "SELECT Name INTO t_tmp FROM t_package WHERE 1=1" });
    eq(r2.code, "E_SQL_READONLY"); contains(r2.message, "INTO");
    var r3 = B.FB_OpQuery.call(B, repo, { sql: "SELECT Name FROM t_package WHERE Name = 'a; INTO b'" });
    eq(r3.status, "ok", r3.message); eq(r3.rowCount, 1);
});
t("B2-op FB-PU-31 / N-B-3: maxRows - vychozi 500: 600 radku -> rows 500, truncated true, rowCount 600, warning; maxRows 7000 -> strop 5000 + warning; maxRows 10 -> 10", function () {
    var repo = qRepo(600);
    var r = B.FB_OpQuery.call(B, repo, { sql: "SELECT Name FROM t_package WHERE Parent_ID = 1" });
    eq(r.status, "ok"); eq(r.rowCount, 600); eq(r.rows.length, 500); eq(r.truncated, true); eq(r.maxRows, 500);
    ok(r.warnings && /oriznut: dotaz vratil 600 radku, v odpovedi je prvnich 500/.test(r.warnings.join(" ")), JSON.stringify(r.warnings));
    var r2 = B.FB_OpQuery.call(B, repo, { sql: "SELECT Name FROM t_package WHERE Parent_ID = 1", maxRows: 7000 });
    eq(r2.maxRows, 5000); eq(r2.rows.length, 600); ok(typeof r2.truncated == "undefined"); contains(r2.warnings[0], "presahuje strop 5000");
    var r3 = B.FB_OpQuery.call(B, repo, { sql: "SELECT Name FROM t_package WHERE Parent_ID = 1", maxRows: 10 });
    eq(r3.rows.length, 10); eq(r3.truncated, true); eq(r3.rowCount, 600);
    var r4 = B.FB_OpQuery.call(B, qRepo(5), { sql: "SELECT Name FROM t_package WHERE Parent_ID = 1" });
    eq(r4.rowCount, 5); ok(typeof r4.truncated == "undefined"); ok(typeof r4.warnings == "undefined", "bez varovani: " + JSON.stringify(r4.warnings));
});
t("B2-op FB-PU-31 / N-B-3: dotaz bez TOP/LIMIT/WHERE nad velkou tabulkou = E_SQL_UNBOUNDED (nespusti se); nad malou = varovani; COUNT(*) bez WHERE projde; TOP/LIMIT projde", function () {
    var repo = qRepo(3, "t_");
    var r1 = B.FB_OpQuery.call(B, repo, { sql: "SELECT Object_ID, Name FROM t_object" });
    eq(r1.status, "error"); eq(r1.code, "E_SQL_UNBOUNDED"); contains(r1.message, "t_object"); contains(r1.message, "TOP N");
    ok(r1.tables && r1.tables[0] == "t_object");
    var r1b = B.FB_OpQuery.call(B, repo, { sql: "SELECT o.Name FROM t_package p INNER JOIN t_connector c ON c.Start_Object_ID = p.Package_ID" });
    eq(r1b.code, "E_SQL_UNBOUNDED"); contains(r1b.message, "t_connector");
    var r2 = B.FB_OpQuery.call(B, repo, { sql: "SELECT Name FROM t_package" });
    eq(r2.status, "ok", r2.message); ok(r2.warnings && /dotaz bez omezeni/.test(r2.warnings[0]), JSON.stringify(r2.warnings));
    var r3 = B.FB_OpQuery.call(B, repo, { sql: "SELECT COUNT(*) AS c FROM t_object" });
    eq(r3.status, "ok", r3.message); ok(typeof r3.warnings == "undefined", "agregace bez varovani");
    var r4 = B.FB_OpQuery.call(B, repo, { sql: "SELECT TOP 10 Name FROM t_object" });
    eq(r4.status, "ok", r4.message); ok(typeof r4.warnings == "undefined");
    var r5 = B.FB_OpQuery.call(B, repo, { sql: "SELECT Name FROM t_object LIMIT 10" });
    eq(r5.status, "ok", r5.message);
    var r6 = B.FB_OpQuery.call(B, repo, { sql: "SELECT Name FROM t_object WHERE Object_Type = 'Class'" });
    eq(r6.status, "ok", r6.message); ok(typeof r6.warnings == "undefined");
});
t("B2-op FB-PU-31: chat ACK u oriznuteho vysledku rika ORIZNUTO + maxRows", function () {
    var resp = { protocol: "eafb/0.2", id: "q-tr", status: "done", repository: "X", results: [{ op: "query", status: "ok", rowCount: 600, maxRows: 500, truncated: true, rows: [{ a: 1 }] }] };
    var txt = chat(resp);
    contains(txt, "600 radku"); contains(txt, "ORIZNUTO"); contains(txt, "maxRows 500");
});
// --- FB-PU-32: identita repozitare jednou ---
t("B2-op FB-PU-32: identita repozitare (DB_NAME) se v jednom volani FB_Main zjisti JEDNOU; mimo FB_Main zadna pamet (kazde volani cerstve)", function () {
    b1Reset(); var repo = blRepo({ repositoryType: "SQLSVR" });
    var dbq = 0;
    repo._sqlRules.unshift({ re: /SELECT DB_NAME\(\)/i, rows: function () { dbq++; return [{ db: "EAEXAMPLE.QEA" }]; } });
    B._fbRepoIdCache = null; B._fbRepoIdCacheOn = false;
    B.FB_RepoId.call(B, repo); B.FB_RepoId.call(B, repo);
    eq(dbq, 2, "mimo FB_Main bez pameti");
    dbq = 0;
    var r = runText(repo, [{ op: "create_or_update_elements", elements: [{ name: "N32", type: "Class", "package": "{PK-11}" }] }, { op: "ping", echo: "x" }], "rid-1");
    eq(r.status, "done", JSON.stringify(r).substring(0, 300)); eq(r.repository, "EAEXAMPLE.QEA");
    eq(dbq, 1, "DB_NAME() prave jednou za davku (driv 15-20x)");
    ok(B._fbRepoIdCache === null && B._fbRepoIdCacheOn === false, "pamet po FB_Main zahozena");
});
// --- FB-PU-33: sonda ---
t("B2-op FB-PU-33: rozpocet vytece behem POSLEDNIHO COUNT -> hotovy vysledek se prijme (ok), ne unknown; vytece pred dalsim dotazem -> unknown", function () {
    var slow = 0;
    var repo = blRepo();
    var origRules = repo._sqlRules;
    // COUNT trva ~40 ms (busy wait); rozpocet 25 ms: expanze stihne, COUNT zacne pred vyprsenim a dokonci se po nem
    repo._sqlRules = [{ re: /COUNT\(\*\) AS c FROM t_object/i, rows: function () { var t0 = new Date().getTime(); while (new Date().getTime() - t0 < 40) { } slow++; return [{ c: 7 }]; } }].concat(origRules);
    var r = B.FB_SubtreeCount.call(B, repo, 12, { probeBudgetMs: 25 }, 1000);
    eq(r.status, "ok", r.why); eq(r.elements, 7); eq(slow, 1);
    // rozpocet 0 -> unknown pred prvnim dotazem (chovani beze zmeny)
    var r0 = B.FB_SubtreeCount.call(B, blRepo(), 12, { probeBudgetMs: 500 }, 0);
    eq(r0.status, "unknown");
});
// --- FB-PU-43: vratny jen s gatekeeper: true ---
t("B2-op FB-PU-43: polozka vratneho v menu JEN pri FB_Config.gatekeeper === true; launcher bez nej odmitne; s nim se zepta Ano/Ne (Ne = nic)", function () {
    var repo = mkRepo();
    var oC = B.FB_Config;
    B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", auditPkg: "{A}" }]; };
    try {
        var m1 = B.EA_GetMenuItems.call(B, repo, 2, "-AI Bridge");
        ok(m1.join("|").indexOf("vratny") < 0, "bez gatekeeper polozka chybi: " + m1.join("|"));
        var l1 = "" + B.FB_GatekeeperLaunch.call(B, repo);
        contains(l1, "neni pro tento repozitar povolen"); contains(l1, "gatekeeper: true");
        B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", auditPkg: "{A}", gatekeeper: true, baseDir: "C:\\HARNESS\\gk" }]; };
        var m2 = B.EA_GetMenuItems.call(B, repo, 2, "-AI Bridge");
        ok(m2.join("|").indexOf("Zapnout AI import rezim (vratny)") >= 0, "s gatekeeper polozka je: " + m2.join("|"));
        var oSess = global.Session; var asked = [];
        global.Session = { _outputs: [], Output: function (m) { }, Prompt: function (m, k) { asked.push({ m: "" + m, k: k }); return 4; } };
        try { var l2 = "" + B.FB_GatekeeperLaunch.call(B, repo); } finally { global.Session = oSess; }
        eq(asked.length, 1); eq(asked[0].k, 2, "promptYESNO"); contains(asked[0].m, "SKRYTY proces powershell.exe");
        contains(l2, "nespusten");
    } finally { B.FB_Config = oC; }
    // doma: EAEXAMPLE ma gatekeeper: true (vratny v menu zustava), QEAX ne
    var cfgs = B.FB_Config.call(B);
    eq(cfgs[0].gatekeeper, true); ok(cfgs[1].gatekeeper !== true);
});
// --- FB-PU-44 / FB-PU-45: schranka ---
function clipRepo() {
    var repo = blRepo();
    return repo;
}
function withClipEnv(fn) {
    b1Reset();
    var oC = B.FB_Config; B.FB_Config = function () { return [{ repo: "EAEXAMPLE.QEA", baseDir: B1_BASE, auditPkg: "{A}" }]; };
    var oSess = global.Session; global.Session = { _outputs: [], Output: function () { }, Prompt: function () { return 1; } };
    var oPa = B.FB_PumpAlive; B.FB_PumpAlive = function () { return { running: false, text: "" }; };
    try { return asEaRuntime(fn); } finally { B.FB_Config = oC; global.Session = oSess; B.FB_PumpAlive = oPa; }
}
t("B2-op FB-PU-44 (a): davka ve schrance s markdownovym obalem ```json ... ``` a vetou kolem -> JSON se vyrizne, davka projde (zadny E_PARSE)", function () {
    withClipEnv(function () {
        var repo = clipRepo();
        var body = JSON.stringify({ protocol: "eafb/0.2", id: "clip-md-1", repo: "EAEXAMPLE.QEA", ops: [{ op: "ping", echo: "md" }] });
        mockClipboard.text = "Tady je davka pro bridge:\n```json\n" + body + "\n```\nDej vedet, jak dopadla.";
        var out = "" + B.FB_ClipboardImport.call(B, repo);
        contains(out, "Davka clip-md-1 zpracovana"); contains(out, "Obal kolem JSON"); contains(out, "markdownovy blok");
        ok(out.indexOf("E_PARSE") < 0, out);
        eq(memFs.files[B1_REQ + "\\processed\\" + Object.keys(memFs.files).filter(function (k) { return k.indexOf(B1_REQ + "\\processed\\req-clip-md-1") === 0; })[0].substring((B1_REQ + "\\processed\\").length)] === body, true, "req soubor = presne vyriznuty JSON (bez obalu)");
        var res = JSON.parse(memFs.files[B1_RES + "\\res-clip-md-1.json"]);
        eq(res.status, "done");
    });
});
t("B2-op FB-PU-44 (a): typograficke uvozovky = srozumitelna hlaska (ne 'prazdna schranka')", function () {
    withClipEnv(function () {
        mockClipboard.text = "{\u201Eprotocol\u201C: \u201Eeafb/0.2\u201C, \u201Eid\u201C: \u201Ex\u201C}";
        var out = "" + B.FB_ClipboardImport.call(B, clipRepo());
        contains(out, "typograficke uvozovky");
    });
});
t("B2-op FB-PU-44 (b): 'je ve schrance' jen po overeni zpetnym ctenim; kdyz zapis selze, dialog to rekne", function () {
    withClipEnv(function () {
        var repo = clipRepo();
        mockClipboard.text = JSON.stringify({ protocol: "eafb/0.2", id: "clip-wb-1", repo: "EAEXAMPLE.QEA", ops: [{ op: "ping", echo: "wb" }] });
        var out1 = "" + B.FB_ClipboardImport.call(B, repo);
        contains(out1, "Chat verze je ve schrance (overeno zpetnym ctenim)");
        ok(mockClipboard.text.indexOf("EAFB") >= 0 || mockClipboard.text.indexOf("ping") >= 0, "schranka nese chat ACK");
        // setData i clip.exe "selzou" (schranka drzi puvodni text)
        var keep = JSON.stringify({ protocol: "eafb/0.2", id: "clip-wb-2", repo: "EAEXAMPLE.QEA", ops: [{ op: "ping", echo: "wb2" }] });
        mockClipboard.text = keep;
        var oHtml = MockHtmlfile.prototype;
        var origSet = null;
        var oCom = B.FB_ComObj;
        B.FB_ComObj = function (id) { var o = oCom.call(B, id); if (("" + id).toLowerCase() == "htmlfile") { o.parentWindow.clipboardData.setData = function () { }; } return o; };
        try { var out2 = "" + B.FB_ClipboardImport.call(B, repo); } finally { B.FB_ComObj = oCom; }
        contains(out2, "Vlozeni do schranky se NEZDARILO"); eq(mockClipboard.text, keep, "schranka nezmenena");
    });
});
t("B2-op FB-PU-44 (c): dedup pres KONECNY res-<id>.json - tataz davka po 'restartu EA' (pamet W5 pryc) se neprovede znovu; cekajici (confirm_required) dedup neblokuje", function () {
    withClipEnv(function () {
        var repo = clipRepo();
        var body = JSON.stringify({ protocol: "eafb/0.2", id: "clip-dd-1", repo: "EAEXAMPLE.QEA", ops: [{ op: "ping", echo: "dd" }] });
        mockClipboard.text = body;
        var out1 = "" + B.FB_ClipboardImport.call(B, repo);
        contains(out1, "zpracovana");
        delete B._fbClipSeen; // restart EA = pamet zanika
        mockClipboard.text = body; // clovek znovu zkopiroval tutez davku
        var called = 0; var oM = B.FB_Main; B.FB_Main = function () { called++; return oM.apply(B, arguments); };
        try { var out2 = "" + B.FB_ClipboardImport.call(B, repo); } finally { B.FB_Main = oM; }
        eq(called, 0, "FB_Main se nevolal"); contains(out2, "uz byla zpracovana (res-clip-dd-1.json: done)"); contains(out2, "zmen id");
        // confirm_required res = ceka -> dedup NEblokuje (dialog se nabidne znovu / FB_Main resi P3)
        memFs.files[B1_RES + "\\res-clip-dd-2.json"] = JSON.stringify({ protocol: "eafb/0.2", id: "clip-dd-2", status: "confirm_required", confirm: { nonce: "n" } });
        mockClipboard.text = JSON.stringify({ protocol: "eafb/0.2", id: "clip-dd-2", repo: "EAEXAMPLE.QEA", ops: [{ op: "ping", echo: "dd2" }] });
        var out3 = "" + B.FB_ClipboardImport.call(B, repo);
        ok(out3.indexOf("uz byla zpracovana") < 0, out3);
    });
});
t("B2-op FB-PU-45: otisk davky ignoruje BOM - soubor s BOM (pumpa, surove bajty) i bez BOM (EA runtime, text) daji tyz payloadHash; potvrzeni pumpou nad davkou ze schranky neni E_RISK_INTEGRITY", function () {
    b1Reset(); var repo = blRepo();
    var ops = [{ op: "delete_from_model", targets: [{ type: "Element", id: 104 }] }];
    var body = JSON.stringify({ protocol: "eafb/0.2", id: "bom-1", repo: "EAEXAMPLE.QEA", ops: ops });
    var p = B1_REQ + "\\req-bom-1.json";
    memFs.files[p] = body;
    // EA runtime (schranka): hash z textu bez BOM
    var r1 = asEaRuntime(function () { return JSON.parse(B.FB_Main.call(B, repo, p)); });
    eq(r1.status, "confirm_required", JSON.stringify(r1).substring(0, 300));
    memFs.files[B1_RES + "\\res-bom-1.json"] = JSON.stringify(r1);
    // pumpa (JScript): surove bajty souboru - soubor ma BOM EF BB BF
    function utf8(s) { var out = []; for (var i = 0; i < s.length; i++) { out.push(s.charCodeAt(i) & 255); } return out; }
    var oFb = B.FB_FileBytes; B.FB_FileBytes = function () { return [239, 187, 191].concat(utf8(body)); };
    try {
        var r2 = JSON.parse("" + B.FB_ConfirmPending.call(B, repo, r1.confirm.pendingPath, r1.confirm.nonce, r1.confirm.payloadHash, "pumpa", true));
    } finally { B.FB_FileBytes = oFb; }
    ok(r2.code != "E_RISK_INTEGRITY" && r2.status != "rejected", "BOM nesmi zmenit otisk: " + r2.code + " " + r2.message);
    ok(r2.results && r2.results.length == 1 && r2.results[0].status != "skipped", "potvrzeni proslo az k exekuci: " + JSON.stringify(r2).substring(0, 200));
    // FB_Main primo nad bajty s BOM = tyz hash jako text bez BOM
    b1Reset(); var repoB = blRepo();
    memFs.files[B1_REQ + "\\req-bom-2.json"] = body.replace("bom-1", "bom-2");
    var hashText = asEaRuntime(function () { return JSON.parse(B.FB_Main.call(B, repoB, B1_REQ + "\\req-bom-2.json")).confirm.payloadHash; });
    b1Reset(); var repoC = blRepo();
    memFs.files[B1_REQ + "\\req-bom-3.json"] = body.replace("bom-1", "bom-3");
    B.FB_FileBytes = function () { return [239, 187, 191].concat(utf8(body.replace("bom-1", "bom-3"))); };
    try { var hashBom = JSON.parse(B.FB_Main.call(B, repoC, B1_REQ + "\\req-bom-3.json")).confirm.payloadHash; } finally { B.FB_FileBytes = oFb; }
    eq(hashBom, "" + B.FB_Sha256.call(B, body.replace("bom-1", "bom-3")), "hash surovych bajtu bez BOM == hash textu");
});
t("B2-op FB-PU-45: schrankovy kanal zapisuje req UTF-8 BEZ BOM (ADODB binarni cesta), fallback s BOM jen kdyz binarni cesta chybi", function () {
    // zdroj: writeUtf8 ma binarni cestu Position = 3 (preskoci EF BB BF)
    var src = srcOf("FB_ClipboardImport");
    contains(src, "st.Position = 0; st.Type = 1; st.Position = 3;");
    contains(src, "bin.SaveToFile(path, 2);");
});
t("B2-op pravidlo: kazdy novy kod odpovedi je v FB_ReasonText/ChatRender neutralni (E_SQL_UNBOUNDED nespadne na prazdny render)", function () {
    var resp = { protocol: "eafb/0.2", id: "q-ub", status: "error", repository: "X", results: [{ op: "query", status: "error", code: "E_SQL_UNBOUNDED", message: "Dotaz bez TOP" }] };
    var txt = chat(resp);
    contains(txt, "E_SQL_UNBOUNDED");
});

// ------------------------------------------------------------------ vysledek
console.log("");
console.log("EA File Bridge offline harness: " + passed + "/" + (passed + failed) + " PASS");
if (failed > 0) {
    console.log("");
    failures.forEach(function (f) { console.log("FAIL " + f); });
    process.exit(1);
}
