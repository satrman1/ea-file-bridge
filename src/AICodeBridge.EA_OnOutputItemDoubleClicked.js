// AICodeBridge.EA_OnOutputItemDoubleClicked(Repository, TabName, LineText, ID)
// Dvojklik na radek Output tabu (broadcast; RECEPTION na signal
// EA_OnOutputItemDoubleClicked - zaklada/synchronizuje deploy_src, par. 6g/B).
// v3 (zive ladeni K3, 2026-08-20): tvar dodani argumentu do model-based
// receptions NENI dokumentovany a prvni dva pokusy selhaly TISE:
//   v1 pozicni (TabName, LineText, ID) -> zadna navigace (bez debugu),
//   v2 (Repository, Info)/EventProperties -> debug tab='' id=0 line=''.
// Menu receptions (EA_MenuClick) pritom argumenty pozicne dostavaji a funguji.
// v3 proto zvlada OBE varianty (pozicni string / objekt s Get) a s
// FB_Config.navProbe: true vypisuje typeof + syrove hodnoty VSECH argumentu -
// dalsi dvojklik rekne, co EA skutecne posila.
// Navigace = ShowInProjectView z USER-GESTURE kontextu (zivy spike b1).
// Vypinac: FB_Config.outputNav: false.
var tab = "", line = "", id = 0, shape = "";
if (TabName != null && typeof TabName == "object") {
    shape = "objekt";
    try {
        var n = 0;
        try { n = TabName.Count; } catch (eN0) { n = 0; }
        if (!n || n < 0) { n = 0; }
        var vals = [];
        for (var i = 0; i < n; i++) {
            var p = null, nm = "", v = null;
            try { p = TabName.Get(i); } catch (eG) { p = null; }
            if (p == null) { vals.push(null); continue; }
            try { nm = ("" + p.Name).toLowerCase(); } catch (eNm) { nm = ""; }
            try { v = p.Value; } catch (eV) { v = null; }
            vals.push(v);
            if (nm.indexOf("tab") >= 0) { tab = "" + v; }
            else if (nm.indexOf("line") >= 0 || nm.indexOf("text") >= 0) { line = "" + v; }
            else if (nm.indexOf("id") >= 0) { id = parseInt(v, 10) || 0; }
        }
        if (tab == "" && vals.length > 0 && vals[0] != null) { tab = "" + vals[0]; }
        if (id == 0 && vals.length > 2 && vals[2] != null) { id = parseInt(vals[2], 10) || 0; }
    } catch (eI) { }
} else {
    shape = "pozicni";
    tab = "" + (TabName == null ? "" : TabName);
    line = "" + (LineText == null ? "" : LineText);
    id = parseInt(ID, 10);
    if (isNaN(id)) { id = 0; }
}
var dbg = false, navOff = false;
try {
    var cfgs = this.FB_Config();
    var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
    for (var ci = 0; ci < cfgs.length; ci++) {
        if (rid.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) {
            dbg = (cfgs[ci].navProbe === true);
            navOff = (cfgs[ci].outputNav === false);
            break;
        }
    }
} catch (eCf) { }
if (dbg) {
    var raw = "";
    try {
        raw = " typeof=[" + (typeof TabName) + "," + (typeof LineText) + "," + (typeof ID) + "]"
            + " raw1='" + ("" + TabName).substring(0, 40) + "'"
            + " raw2='" + ("" + LineText).substring(0, 40) + "'"
            + " raw3='" + ("" + ID).substring(0, 20) + "'";
    } catch (eRw) { raw = " (raw nelze vypsat)"; }
    try { this.Log(Repository, "dblclick debug v3: shape=" + shape + " tab='" + tab + "' id=" + id + raw); } catch (eL) { }
}
if (navOff) { return; }
if (("" + tab).replace(/^\s+|\s+$/g, "").toUpperCase() != "AI BRIDGE") { return; }
if (!id || id <= 0) { return; }
try {
    var el = Repository.GetElementByID(id);
    if (el) { Repository.ShowInProjectView(el); }
} catch (eNav) {
    try { this.Log(Repository, "Navigace na element " + id + " selhala: " + eNav.message); } catch (eO) { }
}
