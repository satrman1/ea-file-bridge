// AICodeBridge.FB_ShowInBrowser(Repository, resp)
// INTERAKTIVNI rezimy (clipboard import, GUI fallback): po exekuci ukaze
// v Project browseru posledni dotceny prvek a obnovi strom dotcenych balicku,
// aby uzivatel VIDEL, co vzniklo/zmenilo se. NEvola se z pumpy/vratneho -
// tam nikdo u EA nesedi a slo by o kradez focusu. Best-effort v try/catch:
// je to UX navic, ne kontrakt (pri chybe se nic nedeje).
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
