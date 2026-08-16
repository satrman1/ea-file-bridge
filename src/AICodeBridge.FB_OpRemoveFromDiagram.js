// AICodeBridge.FB_OpRemoveFromDiagram(Repository, op, reqId)
// remove_elements_from_diagram (K4) - odebere elementy Z DIAGRAMU (element
// v modelu zustava - bezpecne mazani, par. 11). Zrcadlo MCP toolu.
// op.diagram = diagramID | "{GUID}" | jmeno; op.elementIDs = [ id, ... ]
if (!op || !op.diagram || !op.elementIDs || Object.prototype.toString.call(op.elementIDs) != "[object Array]" || op.elementIDs.length == 0) {
    return { op: "remove_elements_from_diagram", status: "error", code: "E_ARGS", message: "Povinne: diagram, elementIDs (neprazdne pole)." };
}
var dg = null;
var ref = ("" + op.diagram).replace(/^\s+|\s+$/g, "");
try {
    if (ref.charAt(0) == "{") { dg = Repository.GetDiagramByGuid(ref); }
    else if (/^[0-9]+$/.test(ref)) { dg = Repository.GetDiagramByID(parseInt(ref, 10)); }
} catch (eG) { dg = null; }
if (dg == null) { return { op: "remove_elements_from_diagram", status: "error", code: "E_NOT_FOUND", message: "Diagram nenalezen: " + ref }; }
var chk = this.FB_CheckWrite(Repository, Repository.GetPackageByID(dg.PackageID));
if (chk != null) { return { op: "remove_elements_from_diagram", status: "error", code: chk.code, message: chk.message }; }
var want = {};
for (var i = 0; i < op.elementIDs.length; i++) { want[parseInt(op.elementIDs[i], 10)] = 1; }
var removed = [];
for (var j = dg.DiagramObjects.Count - 1; j >= 0; j--) {
    var o = dg.DiagramObjects.GetAt(j);
    if (want[o.ElementID] == 1) {
        dg.DiagramObjects.DeleteAt(j, false);
        removed.push(o.ElementID);
    }
}
dg.DiagramObjects.Refresh();
try { Repository.ReloadDiagram(dg.DiagramID); } catch (eR) { }
if (removed.length == 0) {
    return { op: "remove_elements_from_diagram", status: "error", code: "E_NOT_FOUND", message: "Zadny z elementu neni na diagramu umisten." };
}
return { op: "remove_elements_from_diagram", status: "ok", diagramID: dg.DiagramID, removedElementIDs: removed, count: removed.length };
