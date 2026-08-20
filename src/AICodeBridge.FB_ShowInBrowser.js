// AICodeBridge.FB_ShowInBrowser(Repository, resp)
// INTERAKTIVNI rezimy (clipboard import, GUI fallback): po exekuci ukaze
// v Project browseru posledni dotceny prvek a obnovi strom dotcenych balicku.
// !! DEFAULT VYPNUTO (lekce 2026-08-20): Repository.ShowInProjectView(el)
// v EA runtime hodila NEZACHYTITELNOU COM chybu (par. 1a/4 rodina) -> spadl
// CELY add-in a EA ho odpojil (uzivatel musel obnovit pres Manage Add-Ins).
// Try/catch to nechyti (COM chyba mimo JS). Zapinat jen po overeni jineho,
// bezpecneho zpusobu navigace v browseru. Zapnuti: FB_Config polozka
// showInBrowser: true (per repo). Pozorovatelnost stejne kryje FB_LogChanges
// (Output tab s cestou) - to je hlavni kanal "co a kde".
var self = this;
var enabled = false;
try {
    var cfgs = this.FB_Config();
    var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
    for (var ci = 0; ci < cfgs.length; ci++) {
        if (rid.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) {
            enabled = (cfgs[ci].showInBrowser === true);
            break;
        }
    }
} catch (eCfg) { enabled = false; }
if (!enabled) { return false; }
var results = (resp && resp.results) ? resp.results : [];
var lastEl = null;
var pkgIds = {};
for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (!r || ("" + r.status) != "ok") { continue; }
    if (("" + r.op) == "delete_from_model") { continue; } // smazane nelze ukazat
    var its = r.items || ((r.guid || r.id) ? [r] : []);
    for (var k = 0; k < its.length; k++) {
        var e = its[k];
        var el = null;
        try {
            var s = "" + (e.id || e.guid);
            if (s.charAt(0) == "{") { el = Repository.GetElementByGuid(s); }
            else if (e.id) { el = Repository.GetElementByID(parseInt(s, 10)); }
        } catch (eG) { el = null; }
        if (el) { lastEl = el; pkgIds["" + el.PackageID] = el.PackageID; }
    }
}
try {
    for (var p in pkgIds) {
        if (pkgIds.hasOwnProperty(p)) {
            try { Repository.RefreshModelView(pkgIds[p]); } catch (eR) { }
        }
    }
    if (lastEl) { Repository.ShowInProjectView(lastEl); }
} catch (eS) { }
return lastEl != null;
