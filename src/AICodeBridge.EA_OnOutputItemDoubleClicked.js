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
// v6 (E2E pumpa P7, 2026-09-05): debug v5 ukazoval jen prvnich 30 znaku radku,
// takze u pkg/dgm radku (id=0, nic se neoznacilo) neslo rozhodnout, zda
// marker "(pkg:ID)" na KONCI radku do handleru vubec dorazil. Nove: delka,
// hlava i OCAS radku + vysledek dispatchu (marker/kind/target/objekt).
if (dbg) {
    try {
        this.Log(Repository, "dblclick debug v6: tab='" + tab + "' id=" + id
            + " how=[" + u1.how + "," + u2.how + "," + u3.how + "]"
            + " keys1=[" + u1.keys + "] keys3=[" + u3.keys + "] len=" + line.length
            + " head='" + line.substring(0, 30) + "' tail='" + line.substring(Math.max(0, line.length - 40)) + "'");
    } catch (eL) { }
}
if (navOff) { return; }
if (tab.replace(/^\s+|\s+$/g, "").toUpperCase() != "AI BRIDGE") { return; }
// T1 (2026-09-04): proklik PER TYP artefaktu. FB_LogChanges pise na konec
// radku marker "(el:ID)" | "(pkg:ID)" | "(dgm:ID)"; marker ma prednost pred
// 3. paramem WriteOutput (PackageID/DiagramID nejsou ElementID - jiny
// ciselny prostor). Radek bez markeru = stavajici chovani (ID = ElementID).
var kind = "el", target = id;
var mk = /\((el|pkg|dgm):(\d+)\)\s*$/.exec(line);
if (mk) { kind = mk[1]; target = parseInt(mk[2], 10); }
if (dbg) { try { this.Log(Repository, "dblclick nav: marker=" + (mk ? mk[0] : "ZADNY") + " kind=" + kind + " target=" + target); } catch (eL2) { } }
if (!target || target <= 0) { return; }
try {
    var obj = null;
    if (kind == "pkg") { obj = Repository.GetPackageByID(target); }
    else if (kind == "dgm") { obj = Repository.GetDiagramByID(target); }
    else { obj = Repository.GetElementByID(target); }
    if (obj) { Repository.ShowInProjectView(obj); }
    if (dbg) { try { this.Log(Repository, "dblclick nav: " + kind + " " + target + (obj ? " -> ShowInProjectView zavolano" : " -> objekt NENALEZEN")); } catch (eL3) { } }
} catch (eNav) {
    try { this.Log(Repository, "Navigace na " + kind + " " + target + " selhala: " + eNav.message); } catch (eO) { }
}
