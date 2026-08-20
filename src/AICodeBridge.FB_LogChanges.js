// AICodeBridge.FB_LogChanges(Repository, resp)
// Lidsky citelny vypis ZMEN do Output tabu "AI Bridge" - co a KDE (teckova
// cesta jak v EA browseru) se vytvorilo/upravilo/smazalo. Vola FB_Main po
// exekuci zapisove davky (vsechny kanaly). Pozorovatelnost nad velkym
// repozitarem: uzivatel vidi presne, kam davka sahla. Best-effort (Output je
// jen popisek) - kazdy radek v try/catch.
// Iterace 5 (B-V1): radky zmen nesou ElementID (3. param WriteOutput pres
// Log) -> DVOJKLIK na radek nativne naviguje na prvek v Project browseru
// (GUI-KATALOG par. 5). Zadne ShowInProjectView z add-inu (past par. 1a/4).
// Smazane prvky navigacni id nemaji (neni kam skocit); package radky nesou
// Package.Element.ElementID (nativni navigace funguje i na package).
var self = this;
function L(m, navId) { try { self.Log(Repository, m, navId); } catch (e) { } }
function elInfo(idOrGuid) {
    try {
        var el = null;
        var s = "" + idOrGuid;
        if (s.charAt(0) == "{") { el = Repository.GetElementByGuid(s); }
        else { el = Repository.GetElementByID(parseInt(s, 10)); }
        if (!el) { return null; }
        return { path: self.FB_ElementPath(Repository, "element", el), navId: el.ElementID };
    } catch (eP) { return null; }
}
function pkgInfo(idOrGuid) {
    try {
        var pkg = null;
        var s = "" + idOrGuid;
        if (s.charAt(0) == "{") { pkg = Repository.GetPackageByGuid(s); }
        else { pkg = Repository.GetPackageByID(parseInt(s, 10)); }
        if (!pkg) { return null; }
        var nid = 0;
        try { nid = pkg.Element ? pkg.Element.ElementID : 0; } catch (eN) { nid = 0; }
        return { path: self.FB_ElementPath(Repository, "package", pkg), navId: nid };
    } catch (eP) { return null; }
}
var results = (resp && resp.results) ? resp.results : [];
var reqId = "" + ((resp && resp.id) || "?");
var lines = []; // { text, navId }
for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (!r || ("" + r.status) != "ok") { continue; }
    var op = "" + r.op;
    if (op == "delete_from_model") {
        var dit = r.items || [];
        for (var d = 0; d < dit.length; d++) {
            var it = dit[d];
            lines.push({ text: "  [smazano]  " + (it.type || "?") + " \"" + (it.name || "") + "\""
                + (it.path ? "  @ " + it.path : ("  (id " + it.id + ")")), navId: 0 });
        }
    } else if (op == "create_or_update_package") {
        var pts = r.items || ((r.guid || r.id) ? [r] : []);
        for (var p = 0; p < pts.length; p++) {
            var pe = pts[p];
            var pin = pkgInfo(pe.guid || pe.id);
            var pverb = (pe.created === true) ? "vytvoreno"
                : ((pe.created === false || pe.matchedBy) ? "upraveno" : "zapsano");
            lines.push({ text: "  [" + pverb + "]  package \"" + (pe.name || "?") + "\""
                + (pin && pin.path ? "  @ " + pin.path : ""), navId: (pin ? pin.navId : 0) });
        }
    } else if (op == "create_or_update_elements" || op == "create_element") {
        var its = r.items || ((r.guid || r.id) ? [r] : []);
        for (var k = 0; k < its.length; k++) {
            var e = its[k];
            var ein = elInfo(e.id || e.guid);
            var verb = (e.created === true) ? "vytvoreno"
                : ((e.created === false || e.matchedBy) ? "upraveno" : "zapsano");
            lines.push({ text: "  [" + verb + "]  \"" + (e.name || "?") + "\""
                + (ein && ein.path ? "  @ " + ein.path : ""), navId: (ein ? ein.navId : 0) });
        }
    } else if (op == "create_or_update_diagram") {
        var dts = r.items || [];
        for (var g = 0; g < dts.length; g++) {
            lines.push({ text: "  [diagram " + (dts[g].created === false ? "upraven" : "vytvoren") + "]  \"" + (dts[g].name || "?") + "\"", navId: 0 });
        }
    } else {
        var cnt = r.items ? r.items.length : ((typeof r.changed == "number") ? r.changed : 0);
        lines.push({ text: "  [" + op + "]  hotovo" + (cnt ? "  (" + cnt + " polozek)" : ""), navId: 0 });
    }
}
if (lines.length == 0) { return 0; }
L("FB " + reqId + " - zmeny v modelu (" + this.FB_RepoId(Repository) + "); dvojklik na radek = skok na prvek v browseru:");
for (var li = 0; li < lines.length; li++) { L(lines[li].text, lines[li].navId); }
return lines.length;
