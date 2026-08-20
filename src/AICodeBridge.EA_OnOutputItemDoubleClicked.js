// AICodeBridge.EA_OnOutputItemDoubleClicked(Repository, Info)
// Dvojklik na radek Output tabu (broadcast; RECEPTION na signal
// EA_OnOutputItemDoubleClicked - zaklada/synchronizuje deploy_src, par. 6g/B).
// !! KOREKCE ze zivych testu K3 (2026-08-20): model-based add-in NEDOSTAVA
// COM signaturu (TabName, LineText, ID) - broadcast prijde jako
// (Repository, Info), kde Info = EventProperties (vendor vzor
// EA_OnPreDeleteAttribute: Info.Get(i).Value). Jmena properties nejsou
// dokumentovana -> cte se defenzivne dle jmena (tab/line/id) I pozice
// (0=tab, 1=text, 2=id).
// Navigace = ShowInProjectView z USER-GESTURE kontextu (zivy spike b1 -
// puvodni pad par. 1a/4 byl na konci davky, tady je jiny kontext).
// Vypinac pro pripad padu: FB_Config.outputNav: false. Debug vypis hodnot
// jen s FB_Config.navProbe: true (dev).
var tab = "", line = "", id = 0;
try {
    var vals = [];
    var n = 0;
    try { n = Info.Count; } catch (eN0) { n = 0; }
    for (var i = 0; i < n; i++) {
        var p = null, nm = "", v = null;
        try { p = Info.Get(i); } catch (eG) { p = null; }
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
    try { this.Log(Repository, "dblclick debug: tab='" + tab + "' id=" + id + " line='" + ("" + line).substring(0, 60) + "'"); } catch (eL) { }
}
if (navOff) { return; }
if (tab != "AI Bridge") { return; }
if (!id || id <= 0) { return; }
try {
    var el = Repository.GetElementByID(id);
    if (el) { Repository.ShowInProjectView(el); }
} catch (eNav) {
    try { this.Log(Repository, "Navigace na element " + id + " selhala: " + eNav.message); } catch (eO) { }
}
