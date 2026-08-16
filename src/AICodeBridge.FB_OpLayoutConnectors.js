// AICodeBridge.FB_OpLayoutConnectors(Repository, op, reqId)
// layout_connectors (K11) - styl vedeni konektoru na diagramu.
// op.diagram = diagramID | "{GUID}" | jmeno
// op.style   = "direct" | "auto" | "custom" | "treeV" | "treeH" | "treeLV" | "treeLH"
//              | "lateralV" | "lateralH" | "orthS" | "orthR" (DiagramLink.LineStyle 1-11)
// op.connectorIDs = volitelny filtr (jinak vsechny linky diagramu)
var STYLES = { "DIRECT": 1, "AUTO": 2, "CUSTOM": 3, "TREEV": 4, "TREEH": 5, "TREELV": 6, "TREELH": 7,
    "LATERALV": 8, "LATERALH": 9, "ORTHS": 10, "ORTHR": 11 };
if (!op || !op.diagram || !op.style) {
    return { op: "layout_connectors", status: "error", code: "E_ARGS", message: "Povinne: diagram, style." };
}
var styleN = STYLES[("" + op.style).toUpperCase()];
if (typeof styleN == "undefined") {
    return { op: "layout_connectors", status: "error", code: "E_ARGS", message: "Neznamy style '" + op.style + "'." };
}
var dg = null;
var ref = ("" + op.diagram).replace(/^\s+|\s+$/g, "");
try {
    if (ref.charAt(0) == "{") { dg = Repository.GetDiagramByGuid(ref); }
    else if (/^[0-9]+$/.test(ref)) { dg = Repository.GetDiagramByID(parseInt(ref, 10)); }
} catch (eG) { dg = null; }
if (dg == null) { return { op: "layout_connectors", status: "error", code: "E_NOT_FOUND", message: "Diagram nenalezen: " + ref }; }
var chk = this.FB_CheckWrite(Repository, Repository.GetPackageByID(dg.PackageID));
if (chk != null) { return { op: "layout_connectors", status: "error", code: chk.code, message: chk.message }; }
var filter = null;
if (op.connectorIDs && Object.prototype.toString.call(op.connectorIDs) == "[object Array]") {
    filter = {};
    for (var i = 0; i < op.connectorIDs.length; i++) { filter[parseInt(op.connectorIDs[i], 10)] = 1; }
}
var changed = 0;
for (var j = 0; j < dg.DiagramLinks.Count; j++) {
    var l = dg.DiagramLinks.GetAt(j);
    if (filter != null && filter[l.ConnectorID] != 1) { continue; }
    l.LineStyle = styleN;
    if (l.Update()) { changed++; }
}
try { Repository.ReloadDiagram(dg.DiagramID); } catch (eR) { }
return { op: "layout_connectors", status: "ok", diagramID: dg.DiagramID, style: "" + op.style, changed: changed };
