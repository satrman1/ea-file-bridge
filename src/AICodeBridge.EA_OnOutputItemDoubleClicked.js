// AICodeBridge.EA_OnOutputItemDoubleClicked - dvojklik na radek Output tabu
// (broadcast handler; EA ho doruci jen kdyz ma add-in RECEPTION na signal
// EA_OnOutputItemDoubleClicked z Broadcast Types - viz par. 6g/B).
// Signatura dle Sparx: (Repository, TabName, LineText, ID).
// Iterace 5 K3 korekce: u CUSTOM Output tabu EA dvojklikem NEnaviguje sama -
// cervencove "nativni" chovani v GUI-KATALOGU par. 5 slo pres handler vendor
// demo add-inu. Navigaci na prvek z radku tabu "AI Bridge" (ID = ElementID,
// plni FB_LogChanges pres Log) proto dela tento handler.
// !! SPIKE b1 (par. 1a/4): ShowInProjectView volane na KONCI DAVKY drive
// shodilo cely add-in nezachytitelnou COM chybou. TADY bezi z user-gesture
// kontextu (dvojklik v GUI) - hypoteza: past se nespusti. Kdyz add-in po
// dvojkliku zmizi ze Specialize -> pad potvrzen: obnova Manage Add-Ins +
// restart EA a handler vypnout pres FB_Config outputNav: false.
if (("" + TabName) != "AI Bridge") { return; }
var eid = parseInt(ID, 10);
if (!eid || eid <= 0) { return; }
try {
    var cfgs = this.FB_Config();
    var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
    for (var ci = 0; ci < cfgs.length; ci++) {
        if (rid.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) {
            if (cfgs[ci].outputNav === false) { return; } // vypinac po pripadnem padu
            break;
        }
    }
} catch (eCf) { }
try {
    var el = Repository.GetElementByID(eid);
    if (el) { Repository.ShowInProjectView(el); }
} catch (eNav) {
    try { Session.Output("[AI Bridge] Navigace na element " + eid + " selhala: " + eNav.message); } catch (eO) { }
}
