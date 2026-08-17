// AICodeBridge.FB_OpApplyClassifierStereotypes(Repository, op, reqId)
// apply_classifier_stereotypes (iterace 2b) - port produkce
// Scripts/ITAN-Apply Classifier Stereotypes on SD.vbs (Milos Lang, 2022).
// Pro objekty na diagramu (typicky lifeliny na SD), ktere maji ClassifierID:
//   - classifier Component          -> Type = "Component" + stereotyp classifiera
//   - classifier Interface | Class  -> Type = "Object"    + stereotyp classifiera
// Pouziti: po "convert to instance" / po AI zapisu lifelin jako Object
// (par. 7g N-K4-5) ztraci instance stereotyp - operace dorovna cilovy stav
// dle classifiera. Idempotentni: kdyz Type i stereotyp uz sedi, nic nezapisuje
// (changed=false) - druhy beh musi vratit 0 zmen.
//
// op.diagram    = cilovy diagram ("{GUID}" | diagramID)
// op.elementIDs = volitelny filtr - jen tyto elementy (pole id)
// Vysledek: items = [{elementID, name, classifier, oldType, newType,
//   oldStereotype, stereotype, changed}], changedCount.
if (!op || !op.diagram) {
    return { op: "apply_classifier_stereotypes", status: "error", code: "E_ARGS", message: "Povinne: diagram." };
}
var dg = null;
var dref = ("" + op.diagram).replace(/^\s+|\s+$/g, "");
try {
    if (dref.charAt(0) == "{") { dg = Repository.GetDiagramByGuid(dref); }
    else { dg = Repository.GetDiagramByID(parseInt(dref, 10)); }
} catch (eD) { dg = null; }
if (dg == null) { return { op: "apply_classifier_stereotypes", status: "error", code: "E_NOT_FOUND", message: "Diagram nenalezen: " + op.diagram }; }
var chk = this.FB_CheckWrite(Repository, Repository.GetPackageByID(dg.PackageID));
if (chk != null) { return { op: "apply_classifier_stereotypes", status: "error", code: chk.code, message: chk.message }; }
var filter = null;
if (op.elementIDs && Object.prototype.toString.call(op.elementIDs) == "[object Array]" && op.elementIDs.length > 0) {
    filter = {};
    for (var fi = 0; fi < op.elementIDs.length; fi++) { filter["" + parseInt(op.elementIDs[fi], 10)] = 1; }
}
var items = [], warns = [], changedCount = 0;
for (var i = 0; i < dg.DiagramObjects.Count; i++) {
    var dobj = dg.DiagramObjects.GetAt(i);
    var el;
    try { el = Repository.GetElementByID(dobj.ElementID); } catch (eE) { el = null; }
    if (el == null) { continue; }
    if (filter != null && filter["" + el.ElementID] != 1) { continue; }
    var clsId = 0;
    try { clsId = el.ClassifierID; } catch (eC) { clsId = 0; }
    if (!clsId) { continue; }
    var cls;
    try { cls = Repository.GetElementByID(clsId); } catch (eC2) { cls = null; }
    if (cls == null) { warns.push("element " + el.ElementID + ": classifier " + clsId + " nenalezen - preskocen"); continue; }
    var clsType = "" + cls.Type;
    var targetType = null;
    if (clsType == "Component") { targetType = "Component"; }
    else if (clsType == "Interface" || clsType == "Class") { targetType = "Object"; }
    if (targetType == null) { continue; } // jine typy classifiera VBS nresi - parita
    var oldType = "" + el.Type;
    var oldStereo = "" + el.Stereotype;
    var newStereo = "" + cls.Stereotype;
    var changed = false;
    // whitelist na package elementu (lifeline muze lezet jinde nez diagram)
    var chkE = this.FB_CheckWrite(Repository, Repository.GetPackageByID(el.PackageID));
    if (chkE != null) {
        return { op: "apply_classifier_stereotypes", status: "error", code: chkE.code, message: "element " + el.ElementID + ": " + chkE.message, items: items };
    }
    if (oldType != targetType) {
        el.Type = targetType;
        if (!el.Update()) {
            return { op: "apply_classifier_stereotypes", status: "error", code: "E_EXCEPTION", message: "element " + el.ElementID + ": Update (Type) selhal: " + el.GetLastError(), items: items };
        }
        changed = true;
    }
    if (oldStereo != newStereo) {
        el.Stereotype = newStereo;
        if (!el.Update()) {
            return { op: "apply_classifier_stereotypes", status: "error", code: "E_EXCEPTION", message: "element " + el.ElementID + ": Update (Stereotype) selhal: " + el.GetLastError(), items: items };
        }
        changed = true;
    }
    if (changed) {
        changedCount++;
        this.SetTag(el, "ai.request", "" + reqId);
    }
    items.push({ elementID: el.ElementID, name: "" + el.Name, classifier: "" + cls.Name,
        oldType: oldType, newType: "" + el.Type, oldStereotype: oldStereo, stereotype: "" + el.Stereotype, changed: changed });
}
try { Repository.ReloadDiagram(dg.DiagramID); } catch (eR) { }
var res = { op: "apply_classifier_stereotypes", status: "ok", diagramID: dg.DiagramID, count: items.length, changedCount: changedCount, items: items };
if (warns.length > 0) { res.warnings = warns; }
return res;
