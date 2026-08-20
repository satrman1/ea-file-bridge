// AICodeBridge.FB_StateFile(Repository, name, value)
// Maly perzistentni stav bridge v <baseDir>\state-<name>.txt (korekce ze
// zivych testu K3/spike 2026-08-20, par. 1a/5): EA runtime NEDRZI in-memory
// stav (this._fb*) mezi invokacemi - kazde vyvolani add-inu je cerstva
// instance (na rozdil od pumpy, kde JScript proces zije). Vse, co ma prezit
// mezi kliky (citac spiku, posledni zapisova davka pro FB_Changes, W8 flag),
// bydli v souboru.
//   value nezadano  -> READ (vraci orezany text, "" kdyz neexistuje)
//   value null      -> DELETE
//   jinak           -> WRITE ("" + value)
// Best-effort: chyba cteni = "", chyba zapisu se polyka (stav je pomocny,
// nikdy nesmi shodit davku). COM vyhradne pres FB_ComObj (par. 1a).
var path = "";
try { path = "" + this.FB_ResolveBaseDir(Repository) + "\\state-" + name + ".txt"; }
catch (eB) { return ""; }
var fso = null;
try { fso = this.FB_ComObj("Scripting.FileSystemObject"); } catch (eF) { return ""; }
if (typeof value == "undefined") {
    try {
        if (!fso.FileExists(path)) { return ""; }
        var st = this.FB_ComObj("ADODB.Stream");
        st.Type = 2; st.Charset = "utf-8"; st.Open();
        st.LoadFromFile(path);
        var t = "" + st.ReadText(-1);
        st.Close();
        return t.replace(/^\uFEFF/, "").replace(/^\s+|\s+$/g, "");
    } catch (eR) { return ""; }
}
if (value === null) {
    try { if (fso.FileExists(path)) { fso.DeleteFile(path); } } catch (eD) { }
    return "";
}
try {
    var stw = this.FB_ComObj("ADODB.Stream");
    stw.Type = 2; stw.Charset = "utf-8"; stw.Open();
    stw.WriteText("" + value);
    stw.SaveToFile(path, 2);
    stw.Close();
} catch (eW) { }
return "" + value;
