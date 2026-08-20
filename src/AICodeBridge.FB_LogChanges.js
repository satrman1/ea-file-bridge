// AICodeBridge.FB_LogChanges(Repository, resp)
// Lidsky citelny vypis ZMEN do Output tabu "AI Bridge" - co a KDE (teckova
// cesta jak v EA browseru) se vytvorilo/upravilo/smazalo. Vola FB_Main po
// exekuci zapisove davky (vsechny kanaly). Pozorovatelnost nad velkym
// repozitarem: uzivatel vidi presne, kam davka sahla. Best-effort (Output je
// jen popisek) - kazdy radek v try/catch.
var self = this;
function L(m) { try { self.Log(Repository, m); } catch (e) { } }
function pathEl(idOrGuid) {
    try {
        var el = null;
        var s = "" + idOrGuid;
        if (s.charAt(0) == "{") { el = Repository.GetElementByGuid(s); }
        else { el = Repository.GetElementByID(parseInt(s, 10)); }
        if (!el) { return null; }
        return self.FB_ElementPath(Repository, "element", el);
    } catch (eP) { return null; }
}
var results = (resp && resp.results) ? resp.results : [];
var reqId = "" + ((resp && resp.id) || "?");
var lines = [];
for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (!r || ("" + r.status) != "ok") { continue; }
    var op = "" + r.op;
    if (op == "delete_from_model") {
        var dit = r.items || [];
        for (var d = 0; d < dit.length; d++) {
            var it = dit[d];
            lines.push("  [smazano]  " + (it.type || "?") + " \"" + (it.name || "") + "\""
                + (it.path ? "  @ " + it.path : ("  (id " + it.id + ")")));
        }
    } else if (op == "create_or_update_elements" || op == "create_element" || op == "create_or_update_package") {
        var its = r.items || ((r.guid || r.id) ? [r] : []);
        for (var k = 0; k < its.length; k++) {
            var e = its[k];
            var pth = pathEl(e.id || e.guid);
            var verb = (e.created === true) ? "vytvoreno"
                : ((e.created === false || e.matchedBy) ? "upraveno" : "zapsano");
            lines.push("  [" + verb + "]  \"" + (e.name || "?") + "\"" + (pth ? "  @ " + pth : ""));
        }
    } else if (op == "create_or_update_diagram") {
        var dts = r.items || [];
        for (var g = 0; g < dts.length; g++) {
            lines.push("  [diagram " + (dts[g].created === false ? "upraven" : "vytvoren") + "]  \"" + (dts[g].name || "?") + "\"");
        }
    } else {
        var cnt = r.items ? r.items.length : ((typeof r.changed == "number") ? r.changed : 0);
        lines.push("  [" + op + "]  hotovo" + (cnt ? "  (" + cnt + " polozek)" : ""));
    }
}
if (lines.length == 0) { return 0; }
L("FB " + reqId + " - zmeny v modelu (" + this.FB_RepoId(Repository) + "):");
for (var li = 0; li < lines.length; li++) { L(lines[li]); }
return lines.length;
