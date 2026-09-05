// AICodeBridge.FB_LogChanges(Repository, resp)
// Lidsky citelny vypis ZMEN do Output tabu "AI Bridge" - co a KDE (teckova
// cesta jak v EA browseru) se vytvorilo/upravilo/smazalo. Vola FB_Main po
// exekuci zapisove davky (vsechny kanaly). Pozorovatelnost nad velkym
// repozitarem: uzivatel vidi presne, kam davka sahla. Best-effort (Output je
// jen popisek) - kazdy radek v try/catch.
// Iterace 5 (B-V1): radky zmen nesou ElementID (3. param WriteOutput pres
// Log) -> DVOJKLIK na radek naviguje na prvek v Project browseru.
// T1 (2026-09-04, evidence Milose 2026-08-21c vlakno 2): proklik PER TYP
// artefaktu. Radek nese na konci MARKER cile "(el:ID)" | "(pkg:ID)" |
// "(dgm:ID)"; handler EA_OnOutputItemDoubleClicked ho parsuje z LineText
// a dispatchne GetElementByID / GetPackageByID / GetDiagramByID. Duvod:
//  - package radek nesl Package.Element.ElementID (t_object radek package)
//    a GetElementByID + ShowInProjectView package NEOZNACIL;
//  - scenarios/constraints/requirements/attributes/operations logovaly id 0
//    -> nove nesou id VLASTNICIHO elementu (executor ho v response ma);
//  - diagram radky (create_or_update_diagram, place_elements_on_diagram)
//    logovaly id 0 -> nove DiagramID.
// 3. param WriteOutput (ElementID) se posila JEN u elementu (stavajici
// chovani zachovano); u package/diagramu je 0 - PackageID/DiagramID zije
// v jinem ciselnem prostoru a jako ElementID by ukazoval na cizi prvek.
// Smazane prvky navigacni cil nemaji (neni kam skocit).
var self = this;
function L(m, navId) { try { self.Log(Repository, m, navId); } catch (e) { } }
function mark(kind, id) { return (id && id > 0) ? "  (" + kind + ":" + id + ")" : ""; }
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
        return { path: self.FB_ElementPath(Repository, "package", pkg), pkgId: pkg.PackageID };
    } catch (eP) { return null; }
}
// vlastnici element z tvaru response (scenarios/constraints/requirements:
// res.id; attributes/operations: res.element.id)
function ownerId(r) {
    try {
        if (r.element && typeof r.element.id == "number" && r.element.id > 0) { return r.element.id; }
        if (typeof r.id == "number" && r.id > 0) { return r.id; }
        var n = parseInt(r.id, 10);
        if (!isNaN(n) && n > 0) { return n; }
    } catch (eO) { }
    return 0;
}
var results = (resp && resp.results) ? resp.results : [];
var reqId = "" + ((resp && resp.id) || "?");
var lines = []; // { text, navId }
for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (!r) { continue; }
    var op = "" + r.op;
    // E2E pumpa P8c (2026-09-05): delete_from_model se status error, ale
    // s uz smazanymi cili (items deleted:true) - ty se musi vypsat, jinak
    // Output o realne zmene v modelu mlci; selhany cil dostane [nesmazano].
    if (op == "delete_from_model" && ("" + r.status) != "ok" && !r.items) { continue; }
    if (op != "delete_from_model" && ("" + r.status) != "ok") { continue; }
    if (op == "delete_from_model") {
        var dit = r.items || [];
        for (var d = 0; d < dit.length; d++) {
            var it = dit[d];
            if (it.deleted === false) {
                lines.push({ text: "  [nesmazano]  " + (it.type || "?") + " \"" + (it.name || "") + "\"  (" + (it.code || "chyba") + ")", navId: 0 });
                continue;
            }
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
                + (pin && pin.path ? "  @ " + pin.path : "") + mark("pkg", pin ? pin.pkgId : 0), navId: 0 });
        }
    } else if (op == "create_or_update_elements" || op == "create_element") {
        var its = r.items || ((r.guid || r.id) ? [r] : []);
        for (var k = 0; k < its.length; k++) {
            var e = its[k];
            var ein = elInfo(e.id || e.guid);
            var verb = (e.created === true) ? "vytvoreno"
                : ((e.created === false || e.matchedBy) ? "upraveno" : "zapsano");
            lines.push({ text: "  [" + verb + "]  \"" + (e.name || "?") + "\""
                + (ein && ein.path ? "  @ " + ein.path : "") + mark("el", ein ? ein.navId : 0), navId: (ein ? ein.navId : 0) });
        }
    } else if (op == "move_elements") {
        // iterace 6: presun je zasah do struktury - musi byt v Output videt
        // odkud kam, vcetne poctu prvku, ktere sly s nim
        var mts = r.items || [];
        for (var m = 0; m < mts.length; m++) {
            var mi2 = mts[m];
            var min2 = elInfo(mi2.id || mi2.guid);
            var extra = "";
            if (mi2.children) { extra += ", potomku: " + mi2.children + " (dorovnano " + (mi2.childrenFixed || 0) + ")"; }
            if (mi2.diagrams) { extra += ", diagramu: " + mi2.diagrams + " (dorovnano " + (mi2.diagramsFixed || 0) + ")"; }
            lines.push({ text: "  [" + (mi2.moved ? "presunuto" : "beze zmeny") + "]  \"" + (mi2.name || "?") + "\"  "
                + (mi2.fromPackage || ("id " + mi2.fromPackageID)) + " -> " + (mi2.toPackage || ("id " + mi2.toPackageID)) + extra
                + (min2 && min2.path ? "  @ " + min2.path : "") + mark("el", min2 ? min2.navId : 0), navId: (min2 ? min2.navId : 0) });
        }
    } else if (op == "create_or_update_diagram") {
        var dts = r.items || [];
        for (var g = 0; g < dts.length; g++) {
            var dgId = parseInt(dts[g].id, 10); if (isNaN(dgId)) { dgId = 0; }
            lines.push({ text: "  [diagram " + (dts[g].created === false ? "upraven" : "vytvoren") + "]  \"" + (dts[g].name || "?") + "\""
                + mark("dgm", dgId), navId: 0 });
        }
    } else if (op == "place_elements_on_diagram" || op == "remove_elements_from_diagram"
               || op == "layout_connectors" || op == "update_diagram_properties" || op == "set_diagram_object_style") {
        // diagramova rodina: cil prokliku = diagram
        var dgId2 = parseInt(r.diagramID || r.diagramId || (r.diagram && r.diagram.id) || r.id, 10); if (isNaN(dgId2)) { dgId2 = 0; }
        var cntD = r.items ? r.items.length : ((typeof r.count == "number") ? r.count : 0);
        lines.push({ text: "  [" + op + "]  hotovo" + (cntD ? "  (" + cntD + " polozek)" : "") + mark("dgm", dgId2), navId: 0 });
    } else if (op == "create_or_update_scenarios" || op == "create_or_update_constraints"
               || op == "create_or_update_requirements" || op == "create_or_update_attributes"
               || op == "create_or_update_operations") {
        // polozky ziji UVNITR elementu -> proklik na vlastnici element
        var oid = ownerId(r);
        var oin = oid > 0 ? elInfo(oid) : null;
        var cntO = r.items ? r.items.length : ((typeof r.count == "number") ? r.count : 0);
        lines.push({ text: "  [" + op + "]  hotovo" + (cntO ? "  (" + cntO + " polozek)" : "")
            + (oin && oin.path ? "  @ " + oin.path : "") + mark("el", oid), navId: oid });
    } else {
        var cnt = r.items ? r.items.length : ((typeof r.changed == "number") ? r.changed : 0);
        lines.push({ text: "  [" + op + "]  hotovo" + (cnt ? "  (" + cnt + " polozek)" : ""), navId: 0 });
    }
}
if (lines.length == 0) { return 0; }
L("FB " + reqId + " - zmeny v modelu (" + this.FB_RepoId(Repository) + "); dvojklik na radek = skok na prvek/package/diagram v browseru:");
for (var li = 0; li < lines.length; li++) { L(lines[li].text, lines[li].navId); }
return lines.length;
