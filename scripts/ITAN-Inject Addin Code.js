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

var SRC_DIR = "C:\\GIT\\ea-file-bridge\\src\\";  // v bance upravit na cestu klonu repa
var ADDIN_NAME = "AICodeBridge";

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
    var cnt = 0;
    var missing = "";
    for (var i = 0; i < el.Methods.Count; i++) {
        var meth = el.Methods.GetAt(i);
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

    Session.Output("Hotovo: " + cnt + " operaci nahrano.");
    if (missing != "") {
        Session.Output("Bez souboru: " + missing);
    }
    Session.Output("DALSI KROK: restart pumpy (dvojklik pump.wsf). Reload projektu jen pro GUI cast add-inu.");
}

main();
