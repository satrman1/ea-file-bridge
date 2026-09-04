// ============================================================================
// ITAN-Bootstrap File Bridge (JScript pro EA Scripting)
// Zaklada executor EA File Bridge v repozitari, kde jeste NENI (typicky bankovni repozitar):
//   1. v OZNACENEM package v Project Browseru zalozi element AICodeBridge
//      (Class se stereotypem JavascriptAddin), pokud v modelu neexistuje
//   2. dovytvori chybejici operace vc. parametru (viz SIG nize)
//   3. naleje kod ze src\ do VSECH operaci, ktere maji soubor (od Z260904-6
//      uplny disk->model refresh; drive jen SIG)
// Idempotentni: co existuje, jen dostane kod; chybejici operace se zaklada
// s parametry z hlavicky souboru (fallback SIG). EA_* receptions NEZAKLADA.
// POZN: pumpa GUI cast add-inu nepotrebuje - EA_ handlery/receptions se
// zde NEZAKLADAJI (GUI fallback = az iterace 1, klonem vzoru).
//
// PRED SPUSTENIM:
//   - v Project Browseru OZNAC package, kam ma element patrit (jen pri
//     prvnim zalozeni; kdyz uz element existuje, vyber se ignoruje)
//   - SRC_DIR se resi samo: zkusi obvykle cesty, jinak se zepta dialogem
//     (zadava se cesta ke slozce src\ klonu) - soubor neni treba editovat
// Spusteni: Specialize > Scripting > novy JScript > vlozit > Run.
// PO DOBEHNUTI: spustit/restartovat pumpu (kod se cte pri attachi).
// ============================================================================

// Kandidati na slozku src\ klonu (v poradi); kdyz zadny neexistuje,
// skript se zepta dialogem. Diky tomu se soubor needituje -> zadny diff
// pri kazdem pullu v bance.
var SRC_CANDIDATES = [
    "C:\\GIT\\ea-file-bridge\\src\\",
    "D:\\GIT\\ea-file-bridge\\src\\"
];
var ADDIN_NAME = "AICodeBridge";

function resolveSrcDir(fso) {
    for (var i = 0; i < SRC_CANDIDATES.length; i++) {
        if (fso.FolderExists(SRC_CANDIDATES[i])) { return SRC_CANDIDATES[i]; }
    }
    var p = "" + Session.Input("Slozka src klonu nenalezena na obvyklych cestach. Zadej plnou cestu ke slozce src (napr. C:\\GIT\\ea-file-bridge\\src):");
    p = p.replace(/^\s+|\s+$/g, "");
    if (p != "" && p.charAt(p.length - 1) != "\\") { p = p + "\\"; }
    return p;
}

// Operace + poradi parametru (loader pumpy se ridi Position!)
// v0.2 (iterace 1+3): pribyly operace zrcadlici MCP tooly + helpery + konfigy.
var SIG = [
    { n: "FB_Main",                  p: ["Repository", "requestText"] },
    { n: "FB_JsonParse",             p: ["text"] },
    { n: "FB_JsonStringify",         p: ["v"] },
    { n: "FB_XmlRows",               p: ["xml"] },
    { n: "FB_RepoId",                p: ["Repository"] },
    { n: "FB_OpPing",                p: ["Repository", "op"] },
    { n: "FB_OpQuery",               p: ["Repository", "op"] },
    { n: "FB_OpCreateElement",       p: ["Repository", "op", "reqId"] },
    { n: "FB_Whitelist",             p: [] },
    { n: "FB_OpsAllowed",            p: [] },
    { n: "FB_Config",                p: [] },
    { n: "FB_Audit",                 p: ["Repository", "reqId", "summary", "requestText"] },
    { n: "FB_SessionStart",          p: ["Repository"] },
    { n: "FB_ResolvePkg",            p: ["Repository", "ref"] },
    { n: "FB_ResolveEl",             p: ["Repository", "ref"] },
    { n: "FB_CheckWrite",            p: ["Repository", "pkg"] },
    { n: "FB_TagWrite",              p: ["Repository", "obj", "tvs"] },
    { n: "FB_TagRead",               p: ["Repository", "obj"] },
    { n: "FB_OpElements",            p: ["Repository", "op", "reqId"] },
    { n: "FB_OpPackage",             p: ["Repository", "op", "reqId"] },
    { n: "FB_OpConnectors",          p: ["Repository", "op", "reqId"] },
    { n: "FB_OpAttributes",          p: ["Repository", "op", "reqId"] },
    { n: "FB_OpOperations",          p: ["Repository", "op", "reqId"] },
    { n: "FB_OpMessages",            p: ["Repository", "op", "reqId"] },
    { n: "FB_OpGetElements",         p: ["Repository", "op"] },
    { n: "FB_OpGetPackages",         p: ["Repository", "op"] },
    { n: "FB_OpGetConnectors",       p: ["Repository", "op"] },
    { n: "FB_OpGetDiagrams",         p: ["Repository", "op"] },
    { n: "FB_OpFindElements",        p: ["Repository", "op"] },
    { n: "FB_OpFindPackages",        p: ["Repository", "op"] },
    { n: "FB_OpDelete",              p: ["Repository", "op", "reqId"] },
    { n: "FB_OpDeleteTag",           p: ["Repository", "op", "reqId"] },
    { n: "FB_OpRemoveFromDiagram",   p: ["Repository", "op", "reqId"] },
    { n: "FB_OpBaselineCreate",      p: ["Repository", "op", "reqId"] },
    { n: "FB_OpBaselineList",        p: ["Repository", "op"] },
    { n: "FB_OpBaselineDiff",        p: ["Repository", "op"] },
    { n: "FB_OpClonePackage",        p: ["Repository", "op", "reqId"] },
    { n: "FB_OpCloneElements",       p: ["Repository", "op", "reqId"] },
    { n: "FB_OpLinkedDocExport",     p: ["Repository", "op"] },
    { n: "FB_OpLinkedDocImport",     p: ["Repository", "op", "reqId"] },
    { n: "FB_OpLayoutConnectors",    p: ["Repository", "op", "reqId"] },
    { n: "FB_OpConnectorVisibility", p: ["Repository", "op", "reqId"] },
    { n: "FB_OpOpenDiagrams",        p: ["Repository", "op"] },
    { n: "FB_OpReloadDiagrams",      p: ["Repository", "op"] },
    { n: "FB_OpUpdateDiagramProps",  p: ["Repository", "op", "reqId"] },
    { n: "FB_OpDiagramObjectStyle",  p: ["Repository", "op", "reqId"] },
    { n: "FB_OpDeploySrc",           p: ["Repository", "op", "reqId"] },
    { n: "FB_ProcessFolder",         p: ["Repository"] },
    { n: "B64Decode",                p: ["s"] },
    { n: "B64Encode",                p: ["s"] },
    { n: "GetTag",                   p: ["el", "tagName", "defaultValue"] },
    { n: "SetTag",                   p: ["el", "tagName", "value"] },
    { n: "Log",                      p: ["Repository", "msg"] },
    // Legacy AI Code Bridge (#AI-CODE inbox) + GUI cast - v eaexample UZ EXISTUJI
    // (jen refresh kodu). POZOR pro banku: EA_ handlery maji byt RECEPTIONS
    // (vznikaji klonem vzoru, ne bootstrapem) - bootstrap je zalozi jako bezne
    // operace, coz pumpe nevadi, ale GUI menu v EA se tim nenapoji.
    { n: "FindTargetMethod",         p: ["Repository", "targetGuid", "opName"] },
    { n: "ProcessRequests",          p: ["Repository"] },
    { n: "DeployRequest",            p: ["Repository", "req"] },
    { n: "ExportRequest",            p: ["Repository", "req"] }
];

function readUtf8(path) {
    var st = new ActiveXObject("ADODB.Stream");
    st.Type = 2; st.Charset = "utf-8"; st.Open();
    st.LoadFromFile(path);
    var s = st.ReadText(-1);
    st.Close();
    return s;
}

function findAddin() {
    var xml = "" + Repository.SQLQuery(
        "SELECT ea_guid FROM t_object WHERE Name = '" + ADDIN_NAME + "' AND Stereotype = 'JavascriptAddin'");
    var m = /<ea_guid>([^<]+)<\/ea_guid>/i.exec(xml);
    return m ? Repository.GetElementByGuid(m[1]) : null;
}

function main() {
    Repository.EnsureOutputVisible("Script");
    Session.Output("=== ITAN-Bootstrap File Bridge ===");

    var fso = new ActiveXObject("Scripting.FileSystemObject");
    var SRC_DIR = resolveSrcDir(fso);
    if (SRC_DIR == "" || !fso.FolderExists(SRC_DIR)) {
        Session.Output("CHYBA: slozka src nenalezena: " + SRC_DIR + " - spust znovu a zadej platnou cestu.");
        return;
    }
    Session.Output("Slozka src: " + SRC_DIR);

    // 1) element
    var el = findAddin();
    if (el == null) {
        var pkg = Repository.GetTreeSelectedPackage();
        if (pkg == null) {
            Session.Output("CHYBA: element neexistuje a v Project Browseru neni oznacen zadny package. Oznac cilovy package a spust znovu.");
            return;
        }
        el = pkg.Elements.AddNew(ADDIN_NAME, "Class");
        el.StereotypeEx = "Model Add-Ins::JavascriptAddin";
        el.Notes = "EA File Bridge - executor (kanon kodu, cte ho pumpa). Zalozen bootstrapem "
            + "ITAN-Bootstrap File Bridge.js. Protokol: docs/PROTOKOL-EAFB.md v repu ea-file-bridge. AI-Created: true.";
        el.Update();
        pkg.Elements.Refresh();
        Session.Output("Element " + ADDIN_NAME + " ZALOZEN v package '" + pkg.Name + "' (elementID " + el.ElementID + ").");
    } else {
        Session.Output("Element " + ADDIN_NAME + " uz existuje (elementID " + el.ElementID + ") - jen doplnim operace/kod.");
    }

    // 2) mapa existujicich operaci
    var have = {};
    for (var i = 0; i < el.Methods.Count; i++) {
        have["" + el.Methods.GetAt(i).Name] = el.Methods.GetAt(i);
    }

    // 3) VSECHNY soubory src\AICodeBridge.*.js (Z260904-6, K8): kod se nalije
    //    do KAZDE operace, ktera ma soubor - tim je bootstrap uplny disk->model
    //    refresh (drive jen SIG = 57 operaci; konfiguracni FB_AccessGroups /
    //    FB_RiskPolicy / FB_QcConfig by po prenosu add-inu zustaly s cizimi
    //    hodnotami a deploy_src by pak nesel spustit - slepice-vejce).
    //    Chybejici operace se zaklada s parametry z hlavicky souboru
    //    "// AICodeBridge.Nazev(a, b)" (fallback = SIG). EA_* handlery se
    //    NEZAKLADAJI (musi byt receptions se SignalGUID - dela deploy_src);
    //    existujici EA_* jen dostanou kod.
    var sigMap = {};
    for (var sj = 0; sj < SIG.length; sj++) { sigMap[SIG[sj].n] = SIG[sj].p; }
    var created = 0, coded = 0, skippedEa = "";
    var folder = fso.GetFolder(SRC_DIR);
    var files = new Enumerator(folder.Files);
    var names = [];
    for (; !files.atEnd(); files.moveNext()) {
        var fn = "" + files.item().Name;
        var mm = new RegExp("^" + ADDIN_NAME + "\\.([A-Za-z0-9_]+)\\.js$").exec(fn);
        if (mm) { names.push(mm[1]); }
    }
    names.sort();
    for (var j = 0; j < names.length; j++) {
        var name = names[j];
        var path = SRC_DIR + ADDIN_NAME + "." + name + ".js";
        var code = readUtf8(path);
        var m = have[name];
        if (!m) {
            if (name.indexOf("EA_") == 0) {
                skippedEa = skippedEa + name + " ";
                Session.Output("--  " + name + " (reception chybi - zalozi deploy_src, ne bootstrap)");
                continue;
            }
            var params = sigMap[name] || null;
            var hm = /^\/\/\s*AICodeBridge\.([A-Za-z0-9_]+)\s*\(([^)]*)\)/.exec(code.replace(/^\uFEFF/, ""));
            if (hm && hm[1] == name) {
                params = [];
                var raw = hm[2].split(",");
                for (var ri = 0; ri < raw.length; ri++) {
                    var pn = raw[ri].replace(/^\s+|\s+$/g, "");
                    if (pn != "") { params.push(pn); }
                }
            }
            if (params == null) { params = ["Repository"]; }
            m = el.Methods.AddNew(name, "String");
            m.Update();
            for (var k = 0; k < params.length; k++) {
                var par = m.Parameters.AddNew(params[k], "String");
                par.Position = k;
                par.Update();
            }
            m.Parameters.Refresh();
            have[name] = m;
            created++;
        }
        m.Code = code;
        m.Update();
        coded++;
        Session.Output("OK  " + name + " (" + code.length + " znaku)");
    }
    el.Methods.Refresh();

    Session.Output("Hotovo: " + created + " operaci zalozeno, " + coded + " nahran kod (souboru v src: " + names.length + ")."
        + (skippedEa != "" ? " BEZ RECEPTION (zalozi deploy_src): " + skippedEa : ""));
    Session.Output("DALSI KROKY: 1) zkontroluj configy v src (FB_Whitelist/FB_Config/FB_OpsAllowed/FB_RiskPolicy/FB_AccessGroups: repo + GUID) a pripadne spust znovu,");
    Session.Output("2) PLNY restart EA (kod EA runtime) a spust/restartuj pumpu (pump.wsf) - kod se cte pri pripojeni.");
}

main();
