// ============================================================================
// ITAN-Bootstrap File Bridge (JScript pro EA Scripting)
// Zaklada executor EA File Bridge v repozitari, kde jeste NENI (typicky bankovni repozitar):
//   1. v OZNACENEM package v Project Browseru zalozi element AICodeBridge
//      (Class se stereotypem JavascriptAddin), pokud v modelu neexistuje
//   2. dovytvori chybejici operace vc. parametru (viz SIG nize)
//   3. naleje kod ze src\ (stejne jako ITAN-Inject)
// Idempotentni: co existuje, preskoci/jen aktualizuje kod. Existujici
// operace mimo SIG (napr. EA_ handlery z eaexample) nesaha.
// POZN: pumpa GUI cast add-inu nepotrebuje - EA_ handlery/receptions se
// zde NEZAKLADAJI (GUI fallback = az iterace 1, klonem vzoru).
//
// PRED SPUSTENIM:
//   - uprav SRC_DIR na cestu klonu repa na teto stanici
//   - v Project Browseru OZNAC package, kam ma element patrit (jen pri
//     prvnim zalozeni; kdyz uz element existuje, vyber se ignoruje)
// Spusteni: Specialize > Scripting > novy JScript > vlozit > Run.
// PO DOBEHNUTI: spustit/restartovat pumpu (kod se cte pri attachi).
// ============================================================================

var SRC_DIR = "C:\\GIT\\ea-file-bridge\\src\\"; // <-- upravit dle klonu!
var ADDIN_NAME = "AICodeBridge";

// Operace + poradi parametru (loader pumpy se ridi Position!)
var SIG = [
    { n: "FB_Main",            p: ["Repository", "requestText"] },
    { n: "FB_JsonParse",       p: ["text"] },
    { n: "FB_JsonStringify",   p: ["v"] },
    { n: "FB_XmlRows",         p: ["xml"] },
    { n: "FB_OpPing",          p: ["Repository", "op"] },
    { n: "FB_OpQuery",         p: ["Repository", "op"] },
    { n: "FB_OpCreateElement", p: ["Repository", "op", "reqId"] },
    { n: "FB_Whitelist",       p: [] },
    { n: "FB_Audit",           p: ["Repository", "reqId", "summary", "requestText"] },
    { n: "FB_SessionStart",    p: ["Repository"] },
    { n: "B64Decode",          p: ["s"] },
    { n: "B64Encode",          p: ["s"] },
    { n: "GetTag",             p: ["el", "tagName", "defaultValue"] },
    { n: "SetTag",             p: ["el", "tagName", "value"] },
    { n: "Log",                p: ["Repository", "msg"] }
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
    if (!fso.FolderExists(SRC_DIR)) {
        Session.Output("CHYBA: slozka src nenalezena: " + SRC_DIR + " - uprav SRC_DIR v hlavicce skriptu.");
        return;
    }

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

    // 3) operace dle SIG: zaloz chybejici (vc. parametru s Position), naplnit kod
    var created = 0, coded = 0, noFile = "";
    for (var j = 0; j < SIG.length; j++) {
        var name = SIG[j].n;
        var m = have[name];
        if (!m) {
            m = el.Methods.AddNew(name, "String");
            m.Update();
            for (var k = 0; k < SIG[j].p.length; k++) {
                var par = m.Parameters.AddNew(SIG[j].p[k], "String");
                par.Position = k;
                par.Update();
            }
            m.Parameters.Refresh();
            created++;
        }
        var path = SRC_DIR + ADDIN_NAME + "." + name + ".js";
        if (fso.FileExists(path)) {
            var code = readUtf8(path);
            m.Code = code;
            m.Update();
            coded++;
            Session.Output("OK  " + name + " (" + code.length + " znaku)");
        } else {
            noFile = noFile + name + " ";
            Session.Output("--  " + name + " (soubor v src nenalezen!)");
        }
    }
    el.Methods.Refresh();

    Session.Output("Hotovo: " + created + " operaci zalozeno, " + coded + " nahran kod."
        + (noFile != "" ? " BEZ SOUBORU: " + noFile : ""));
    Session.Output("DALSI KROKY: 1) zkontroluj/uprav FB_Whitelist.js (repo + GUID) a pripadne spust znovu,");
    Session.Output("2) spust/restartuj pumpu (pump.wsf) - kod se cte pri pripojeni.");
}

main();
