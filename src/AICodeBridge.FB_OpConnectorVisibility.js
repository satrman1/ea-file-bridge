// AICodeBridge.FB_OpConnectorVisibility(Repository, op, reqId)
// change_connector_visibility (K11) - skryti/zobrazeni konektoru na diagramu
// (DiagramLink.IsHidden; z modelu se nic nemaze).
// op.diagram = diagramID | "{GUID}" | jmeno
// op.connectorIDs = [ id, ... ]
// op.hidden = true (skryt) | false (zobrazit)
if (!op || !op.diagram || !op.connectorIDs || Object.prototype.toString.call(op.connectorIDs) != "[object Array]" || op.connectorIDs.length == 0 || typeof op.hidden == "undefined") {
    return { op: "change_connector_visibility", status: "error", code: "E_ARGS", message: "Povinne: diagram, connectorIDs (pole), hidden (true/false)." };
}
var dg = null;
var ref = ("" + op.diagram).replace(/^\s+|\s+$/g, "");
try {
    if (ref.charAt(0) == "{") { dg = Repository.GetDiagramByGuid(ref); }
    else if (/^[0-9]+$/.test(ref)) { dg = Repository.GetDiagramByID(parseInt(ref, 10)); }
} catch (eG) { dg = null; }
if (dg == null) { return { op: "change_connector_visibility", status: "error", code: "E_NOT_FOUND", message: "Diagram nenalezen: " + ref }; }
var chk = this.FB_CheckWrite(Repository, Repository.GetPackageByID(dg.PackageID));
if (chk != null) { return { op: "change_connector_visibility", status: "error", code: chk.code, message: chk.message }; }
var want = {};
for (var i = 0; i < op.connectorIDs.length; i++) { want[parseInt(op.connectorIDs[i], 10)] = 1; }
var changed = [];
for (var j = 0; j < dg.DiagramLinks.Count; j++) {
    var l = dg.DiagramLinks.GetAt(j);
    if (want[l.ConnectorID] != 1) { continue; }
    l.IsHidden = op.hidden ? true : false;
    if (l.Update()) { changed.push(l.ConnectorID); }
}
try { Repository.ReloadDiagram(dg.DiagramID); } catch (eR) { }
if (changed.length == 0) {
    return { op: "change_connector_visibility", status: "error", code: "E_NOT_FOUND", message: "Zadny z konektoru neni na diagramu (DiagramLink nenalezen)." };
}
return { op: "change_connector_visibility", status: "ok", diagramID: dg.DiagramID, hidden: op.hidden ? true : false, connectorIDs: changed };
