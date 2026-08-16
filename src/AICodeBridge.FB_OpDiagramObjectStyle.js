// AICodeBridge.FB_OpDiagramObjectStyle(Repository, op, reqId)
// set_diagram_object_style (bonus K9, cast "barva objektu") - barvy objektu
// NA DIAGRAMU (DiagramObject) - klicove pro V4 vrstvu (davkove odbarveni pri
// akvizici). Legenda elementu zustava kandidat (slozitejsi struktura).
// op.diagram = diagramID | "{GUID}"
// op.objects = [ { elementID, backgroundColor: {red,green,blue},
//                  fontColor: {...}, borderColor: {...}, borderWidth: n,
//                  reset: true -> vraci default (-1) } ]
// Barva = COLORREF int (red + green*256 + blue*65536); -1 = default.
if (!op || !op.diagram || !op.objects || Object.prototype.toString.call(op.objects) != "[object Array]" || op.objects.length == 0) {
    return { op: "set_diagram_object_style", status: "error", code: "E_ARGS", message: "Povinne: diagram, objects (neprazdne pole)." };
}
function colref(c) {
    if (!c) { return null; }
    var r = parseInt(c.red || 0, 10), g = parseInt(c.green || 0, 10), b = parseInt(c.blue || 0, 10);
    return r + g * 256 + b * 65536;
}
var dg = null;
var ref = ("" + op.diagram).replace(/^\s+|\s+$/g, "");
try {
    if (ref.charAt(0) == "{") { dg = Repository.GetDiagramByGuid(ref); }
    else if (/^[0-9]+$/.test(ref)) { dg = Repository.GetDiagramByID(parseInt(ref, 10)); }
} catch (eG) { dg = null; }
if (dg == null) { return { op: "set_diagram_object_style", status: "error", code: "E_NOT_FOUND", message: "Diagram nenalezen: " + ref }; }
var chk = this.FB_CheckWrite(Repository, Repository.GetPackageByID(dg.PackageID));
if (chk != null) { return { op: "set_diagram_object_style", status: "error", code: chk.code, message: chk.message }; }
var byId = {};
for (var i = 0; i < op.objects.length; i++) { byId[parseInt(op.objects[i].elementID, 10)] = op.objects[i]; }
var changed = [];
for (var j = 0; j < dg.DiagramObjects.Count; j++) {
    var dob = dg.DiagramObjects.GetAt(j);
    var spec = byId[dob.ElementID];
    if (!spec) { continue; }
    if (spec.reset) {
        dob.BackgroundColor = -1; dob.FontColor = -1; dob.BorderColor = -1; dob.BorderLineWidth = -1;
    } else {
        var bg = colref(spec.backgroundColor);
        var fc = colref(spec.fontColor);
        var bc = colref(spec.borderColor);
        if (bg !== null) { dob.BackgroundColor = bg; }
        if (fc !== null) { dob.FontColor = fc; }
        if (bc !== null) { dob.BorderColor = bc; }
        if (typeof spec.borderWidth != "undefined") { dob.BorderLineWidth = parseInt(spec.borderWidth, 10); }
    }
    if (dob.Update()) { changed.push(dob.ElementID); }
}
try { Repository.ReloadDiagram(dg.DiagramID); } catch (eR) { }
if (changed.length == 0) {
    return { op: "set_diagram_object_style", status: "error", code: "E_NOT_FOUND", message: "Zadny z elementu neni na diagramu umisten." };
}
return { op: "set_diagram_object_style", status: "ok", diagramID: dg.DiagramID, changedElementIDs: changed, count: changed.length };
