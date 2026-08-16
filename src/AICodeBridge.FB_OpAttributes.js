// AICodeBridge.FB_OpAttributes(Repository, op, reqId)
// create_or_update_attributes (K2) - atributy elementu (LS parts, DTO Req/Res,
// LDM entity, katalog atributu).
// op.element = cilovy element ("{GUID}" | id | jmeno | $ref)
// op.attributes = [ {
//   attributeID | guid  -> UPDATE podle ID; jinak match podle name (idempotence), jinak CREATE
//   name                -> povinne
//   type                -> datovy typ jako text (napr. "dtVarchar50")
//   classifierID | classifier -> domenovy typ / classifier (id | "{GUID}") - dotahne
//                          zdedene tagged values (emr-zapis-pravidla par. 9)
//   notes | description, stereotype, default, position (poradi),
//   lowerBound, upperBound, taggedValues
// } ]
// UPDATE je PARCIALNI - meni se jen poslana pole (lekce MCP "update bez
// typeElementID shodi classifier" se bridge netyka, nic se neshazuje).
if (!op || !op.element || !op.attributes || Object.prototype.toString.call(op.attributes) != "[object Array]" || op.attributes.length == 0) {
    return { op: "create_or_update_attributes", status: "error", code: "E_ARGS", message: "Povinne: element, attributes (neprazdne pole)." };
}
var el = this.FB_ResolveEl(Repository, op.element);
if (el == null) { return { op: "create_or_update_attributes", status: "error", code: "E_NOT_FOUND", message: "Element nenalezen: " + op.element }; }
var chk = this.FB_CheckWrite(Repository, Repository.GetPackageByID(el.PackageID));
if (chk != null) { return { op: "create_or_update_attributes", status: "error", code: chk.code, message: chk.message }; }
var items = [], warns = [];
for (var i = 0; i < op.attributes.length; i++) {
    var a = op.attributes[i];
    var attr = null, created = false, j;
    if (a.attributeID || a.guid) {
        for (j = 0; j < el.Attributes.Count; j++) {
            var cand = el.Attributes.GetAt(j);
            if ((a.attributeID && cand.AttributeID == parseInt(a.attributeID, 10))
                || (a.guid && ("" + cand.AttributeGUID).toUpperCase() == ("" + a.guid).toUpperCase())) { attr = cand; break; }
        }
        if (attr == null) { return { op: "create_or_update_attributes", status: "error", code: "E_NOT_FOUND", message: "attributes[" + i + "]: atribut nenalezen.", items: items }; }
    } else if (a.name) {
        for (j = 0; j < el.Attributes.Count; j++) {
            if (("" + el.Attributes.GetAt(j).Name) == ("" + a.name)) { attr = el.Attributes.GetAt(j); break; }
        }
    }
    if (attr == null) {
        if (!a.name) { return { op: "create_or_update_attributes", status: "error", code: "E_ARGS", message: "attributes[" + i + "]: chybi name.", items: items }; }
        attr = el.Attributes.AddNew("" + a.name, (typeof a.type == "undefined" ? "" : "" + a.type));
        if (!attr.Update()) { return { op: "create_or_update_attributes", status: "error", code: "E_EXCEPTION", message: "attributes[" + i + "]: Update selhal: " + attr.GetLastError(), items: items }; }
        created = true;
    }
    if (!created && typeof a.name != "undefined") { attr.Name = "" + a.name; }
    if (typeof a.type != "undefined") { attr.Type = "" + a.type; }
    if (typeof a.classifierID != "undefined") { attr.ClassifierID = parseInt(a.classifierID, 10); }
    else if (a.classifier) {
        var cl = this.FB_ResolveEl(Repository, a.classifier);
        if (cl == null) { warns.push("attributes[" + i + "]: classifier nenalezen - preskocen"); }
        else { attr.ClassifierID = cl.ElementID; }
    }
    if (typeof a.notes != "undefined") { attr.Notes = "" + a.notes; }
    else if (typeof a.description != "undefined") { attr.Notes = "" + a.description; }
    if (typeof a.stereotype != "undefined") { attr.StereotypeEx = "" + a.stereotype; }
    if (typeof a["default"] != "undefined") { attr.Default = "" + a["default"]; }
    if (typeof a.position != "undefined") { attr.Pos = parseInt(a.position, 10); }
    if (typeof a.lowerBound != "undefined") { attr.LowerBound = "" + a.lowerBound; }
    if (typeof a.upperBound != "undefined") { attr.UpperBound = "" + a.upperBound; }
    if (!attr.Update()) {
        return { op: "create_or_update_attributes", status: "error", code: "E_EXCEPTION", message: "attributes[" + i + "]: Update selhal: " + attr.GetLastError(), items: items };
    }
    var w2 = this.FB_TagWrite(Repository, attr, a.taggedValues);
    for (var wj = 0; wj < w2.length; wj++) { warns.push("attributes[" + i + "]: " + w2[wj]); }
    items.push({ guid: "" + attr.AttributeGUID, id: attr.AttributeID, name: "" + attr.Name, created: created });
}
el.Attributes.Refresh();
this.SetTag(el, "ai.request", "" + reqId); // razitko na vlastnika
var res = { op: "create_or_update_attributes", status: "ok", element: { guid: "" + el.ElementGUID, id: el.ElementID }, count: items.length, items: items };
if (items.length > 0) { res.guid = items[0].guid; res.id = items[0].id; }
if (warns.length > 0) { res.warnings = warns; }
return res;
