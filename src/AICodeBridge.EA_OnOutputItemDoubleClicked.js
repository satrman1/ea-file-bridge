// AICodeBridge.EA_OnOutputItemDoubleClicked(Repository, TabName, LineText, ID)
// Dvojklik na radek Output tabu (broadcast; RECEPTION na signal
// EA_OnOutputItemDoubleClicked - zaklada/synchronizuje deploy_src, par. 6g/B).
// v5 (zive ladeni K3, 2026-08-20): argumenty prichazi POZICNE dle atributu
// Signalu 10303, kazdy jako ZABALENY objekt. v4 zkousel .Value/kolekci -
// "neznamy-objekt". Hlavni kandidat v5 = maly wrapper s lowercase ".val"
// (tymz vzorem vraci vendor Add-in Search vysledek: XMLResults.val - lekce
// T4-0). Poradi pokusu: .val -> .Value (i jako metoda) -> Get(0) -> valueOf;
// k tomu introspekce for-in klicu do debugu (navProbe: true), at pripadny
// dalsi tvar uz neni hadanka.
// Navigace = ShowInProjectView z USER-GESTURE kontextu (zivy spike b1).
// Vypinac: FB_Config.outputNav: false.
function unwrap(x) {
    var out = { v: null, how: "", keys: "" };
    if (x == null) { out.how = "null"; return out; }
    if (typeof x != "object" && typeof x != "function") { out.v = x; out.how = "primitiv"; return out; }
    try {
        var ks = [];
        for (var k in x) { ks.push(k); if (ks.length >= 12) { break; } }
        out.keys = ks.join("|");
    } catch (eK) { out.keys = "?"; }
    try {
        var v0 = x.val; // vendor vzor XMLResults.val (lowercase)
        if (typeof v0 != "undefined" && v0 != null && typeof v0 != "object") { out.v = v0; out.how = "val"; return out; }
    } catch (e0) { }
    try {
        var v1 = x.Value;
        if (typeof v1 == "function") {
            try { var v1f = x.Value(); if (v1f != null && typeof v1f != "object") { out.v = v1f; out.how = "Value()"; return out; } } catch (eVf) { }
        } else if (typeof v1 != "undefined" && v1 != null && typeof v1 != "object") {
            out.v = v1; out.how = "Value"; return out;
        }
    } catch (e1) { }
    try {
        var p = x.Get(0);
        if (p != null) {
            if (typeof p != "object") { out.v = p; out.how = "Get(0)"; return out; }
            try {
                var pv = p.Value;
                if (typeof pv == "function") { pv = p.Value(); }
                if (pv != null && typeof pv != "object") { out.v = pv; out.how = "Get(0).Value"; return out; }
            } catch (eP) { }
        }
    } catch (e2) { }
    try {
        var vo = x.valueOf();
        if (vo != null && typeof vo != "object") { out.v = vo; out.how = "valueOf"; return out; }
    } catch (e3) { }
    out.how = "neznamy";
    return out;
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
        this.Log(Repository, "dblclick debug v5: tab='" + tab + "' id=" + id
            + " how=[" + u1.how + "," + u2.how + "," + u3.how + "]"
            + " keys1=[" + u1.keys + "] keys3=[" + u3.keys + "] line='" + line.substring(0, 30) + "'");
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
