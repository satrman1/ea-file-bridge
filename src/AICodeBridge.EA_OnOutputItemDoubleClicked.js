// AICodeBridge.EA_OnOutputItemDoubleClicked(Repository, TabName, LineText, ID)
// Dvojklik na radek Output tabu (broadcast; RECEPTION na signal
// EA_OnOutputItemDoubleClicked - zaklada/synchronizuje deploy_src, par. 6g/B).
// v4 - FINALNI TVAR ARGUMENTU (vyladeno zivym debugem 2026-08-20, K3):
// EA doda argumenty POZICNE dle atributu Signalu 10303 (Repository, TabName,
// LineText, ID), ale kazdy NE-Repository argument je ZABALENY objekt
// (EventProperty vzor) - debug v3 ukazal typeof=[object,object,object],
// '[object Object]'. Hodnota se bere z .Value; fallback primitiv (kdyby
// nektera verze EA posilala prosto) i kolekce Count/Get(0) zustavaji.
// Navigace = ShowInProjectView z USER-GESTURE kontextu (zivy spike b1).
// Vypinac: FB_Config.outputNav: false. Debug jen s navProbe: true.
function unwrap(x) {
    if (x == null) { return { v: null, how: "null" }; }
    if (typeof x != "object") { return { v: x, how: "primitiv" }; }
    try {
        var v1 = x.Value;
        if (typeof v1 != "undefined" && v1 != null) { return { v: v1, how: "Value" }; }
    } catch (e1) { }
    try {
        var c = x.Count;
        if (typeof c == "number" && c > 0) {
            var p = x.Get(0);
            if (p != null) { return { v: p.Value, how: "Get(0).Value" }; }
        }
    } catch (e2) { }
    return { v: null, how: "neznamy-objekt" };
}
var u1 = unwrap(TabName), u2 = unwrap(LineText), u3 = unwrap(ID);
var tab = "" + (u1.v == null ? "" : u1.v);
var line = "" + (u2.v == null ? "" : u2.v);
var id = parseInt(u3.v, 10);
if (isNaN(id)) { id = 0; }
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
    try {
        this.Log(Repository, "dblclick debug v4: tab='" + tab + "' id=" + id
            + " how=[" + u1.how + "," + u2.how + "," + u3.how + "] line='" + line.substring(0, 40) + "'");
    } catch (eL) { }
}
if (navOff) { return; }
if (tab.replace(/^\s+|\s+$/g, "").toUpperCase() != "AI BRIDGE") { return; }
if (!id || id <= 0) { return; }
try {
    var el = Repository.GetElementByID(id);
    if (el) { Repository.ShowInProjectView(el); }
} catch (eNav) {
    try { this.Log(Repository, "Navigace na element " + id + " selhala: " + eNav.message); } catch (eO) { }
}
