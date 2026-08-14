// ============================================================================
// ITAN-Inject Addin Code — JScript verze pro EA Scripting (skupina JScript!)
// Nahrazuje VBS verzi (preference 2026-08-13: v EA Scripting pouzivat JScript;
// VBS uz v bankovnim prostredi neni v add-in kontextu podporovano).
// Nacte soubory src\AICodeBridge.<Operace>.js a nalije je do Internal Code
// (Method.Code) odpovidajicich operaci elementu AICodeBridge.
// Spusteni: EA > Specialize > Scripting > novy skript typu JScript > vlozit
// obsah > Run. Vysledek v System Output, zalozka Script.
// Pro AKTIVACI v pumpe staci restart pumpy (kod se cte pri attachi);
// reload projektu je potreba jen pro GUI cast add-inu (menu).
// ============================================================================

// SRC_DIR se resi samo: zkusi obvykle cesty, jinak se zepta dialogem
// (zadava se cesta ke slozce src\ klonu) - soubor neni treba editovat,
// takze pull v bance nenese zadny lokalni diff.
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

function readUtf8(path) {
    var st = new ActiveXObject("ADODB.Stream");
    st.Type = 2;
    st.Charset = "utf-8";
    st.Open();
    st.LoadFromFile(path);
    var s = st.ReadText(-1);
    st.Close();
    return s;
}

function findAddinElement(name) {
    // primarne dle stereotypu, fallback jen dle jmena
    var xml = "" + Repository.SQLQuery(
        "SELECT ea_guid FROM t_object WHERE Name = '" + name + "' AND Stereotype = 'JavascriptAddin'");
    var m = /<ea_guid>([^<]+)<\/ea_guid>/i.exec(xml);
    if (!m) {
        xml = "" + Repository.SQLQuery("SELECT ea_guid FROM t_object WHERE Name = '" + name + "'");
        m = /<ea_guid>([^<]+)<\/ea_guid>/i.exec(xml);
    }
    return m ? Repository.GetElementByGuid(m[1]) : null;
}

function main() {
    Repository.EnsureOutputVisible("Script");
    Session.Output("=== ITAN-Inject Addin Code (JScript): " + ADDIN_NAME + " ===");

    var el = findAddinElement(ADDIN_NAME);
    if (el == null) {
        Session.Output("CHYBA: element '" + ADDIN_NAME + "' nenalezen. Konec.");
        return;
    }
    Session.Output("Element nalezen: elementID " + el.ElementID + ", " + el.Methods.Count + " operaci");

    var fso = new ActiveXObject("Scripting.FileSystemObject");
    var SRC_DIR = resolveSrcDir(fso);
    if (SRC_DIR == "" || !fso.FolderExists(SRC_DIR)) {
        Session.Output("CHYBA: slozka src nenalezena: " + SRC_DIR + " - spust znovu a zadej platnou cestu.");
        return;
    }
    Session.Output("Slozka src: " + SRC_DIR);
    var cnt = 0;
    var missing = "";
    var haveOp = {};
    for (var i = 0; i < el.Methods.Count; i++) {
        var meth = el.Methods.GetAt(i);
        haveOp["" + meth.Name] = true;
        var path = SRC_DIR + ADDIN_NAME + "." + meth.Name + ".js";
        if (fso.FileExists(path)) {
            var code = readUtf8(path);
            meth.Code = code;
            meth.Update();
            cnt++;
            Session.Output("OK  " + meth.Name + " (" + code.length + " znaku)");
        } else {
            missing = missing + meth.Name + " ";
            Session.Output("--  " + meth.Name + " (soubor nenalezen, preskoceno)");
        }
    }
    el.Methods.Refresh();

    // opacna kontrola: soubor v src\, ke kteremu v modelu neexistuje operace
    // (nova operace) -> inject ji nezalozi, to umi jen (idempotentni) Bootstrap
    var newOps = "";
    var en = new Enumerator(fso.GetFolder(SRC_DIR).Files);
    for (; !en.atEnd(); en.moveNext()) {
        var fn = "" + en.item().Name;
        var mF = new RegExp("^" + ADDIN_NAME + "\\.(.+)\\.js$").exec(fn);
        if (mF && !haveOp[mF[1]]) { newOps = newOps + mF[1] + " "; }
    }
    Session.Output("Hotovo: " + cnt + " operaci nahrano.");
    if (missing != "") {
        Session.Output("Bez souboru: " + missing);
    }
    if (newOps != "") {
        Session.Output("POZOR: v src jsou NOVE operace, ktere v modelu chybi: " + newOps + "- spust ITAN-Bootstrap File Bridge.js (idempotentni, doplni je).");
    }
    Session.Output("DALSI KROK: restart pumpy (dvojklik pump.wsf). Reload projektu jen pro GUI cast add-inu.");
}

main();
