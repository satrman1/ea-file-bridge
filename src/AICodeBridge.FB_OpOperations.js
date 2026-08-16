// AICodeBridge.FB_OpOperations(Repository, op, reqId)
// create_or_update_operations (K2) - operace elementu (katalog komponent,
// interfacy, entitni CRUD, LS operace).
// op.element = cilovy element ("{GUID}" | id | jmeno | $ref)
// op.operations = [ {
//   operationID | guid  -> UPDATE podle ID; jinak match podle name (idempotence), jinak CREATE
//   name                -> povinne (LS operace CamelCase, par. 3)
//   returnType          -> text (napr. "boolean"); returnClassifierID/-Classifier = classifier navratu
//   notes | description, stereotype, isStatic, isAbstract
//   parameters          -> [ { name, type, notes, default } ] - PORADI POLE = poradi
//                          parametru. Na UPDATE s poslanym parameters se parametry
//                          SMAZOU A POSTAVI ZNOVU (deterministicky rebuild; zadna
//                          order-adresa mechanika MCP, par. 7h "order:-1" odpada).
//   taggedValues
// } ]
// Vysledek vraci GUID operace I parametru (MCP vracel jen parametry).
if (!op || !op.element || !op.operations || Object.prototype.toString.call(op.operations) != "[object Array]" || op.operations.length == 0) {
    return { op: "create_or_update_operations", status: "error", code: "E_ARGS", message: "Povinne: element, operations (neprazdne pole)." };
}
var el = this.FB_ResolveEl(Repository, op.element);
if (el == null) { return { op: "create_or_update_operations", status: "error", code: "E_NOT_FOUND", message: "Element nenalezen: " + op.element }; }
var chk = this.FB_CheckWrite(Repository, Repository.GetPackageByID(el.PackageID));
if (chk != null) { return { op: "create_or_update_operations", status: "error", code: chk.code, message: chk.message }; }
var items = [], warns = [];
for (var i = 0; i < op.operations.length; i++) {
    var o = op.operations[i];
    var m = null, created = false, j;
    if (o.operationID || o.guid) {
        for (j = 0; j < el.Methods.Count; j++) {
            var cand = el.Methods.GetAt(j);
            if ((o.operationID && cand.MethodID == parseInt(o.operationID, 10))
                || (o.guid && ("" + cand.MethodGUID).toUpperCase() == ("" + o.guid).toUpperCase())) { m = cand; break; }
        }
        if (m == null) { return { op: "create_or_update_operations", status: "error", code: "E_NOT_FOUND", message: "operations[" + i + "]: operace nenalezena.", items: items }; }
    } else if (o.name) {
        for (j = 0; j < el.Methods.Count; j++) {
            if (("" + el.Methods.GetAt(j).Name) == ("" + o.name)) { m = el.Methods.GetAt(j); break; }
        }
    }
    if (m == null) {
        if (!o.name) { return { op: "create_or_update_operations", status: "error", code: "E_ARGS", message: "operations[" + i + "]: chybi name.", items: items }; }
        m = el.Methods.AddNew("" + o.name, (typeof o.returnType == "undefined" ? "void" : "" + o.returnType));
        if (!m.Update()) { return { op: "create_or_update_operations", status: "error", code: "E_EXCEPTION", message: "operations[" + i + "]: Update selhal: " + m.GetLastError(), items: items }; }
        created = true;
    }
    if (!created && typeof o.name != "undefined") { m.Name = "" + o.name; }
    if (typeof o.returnType != "undefined") { m.ReturnType = "" + o.returnType; }
    if (typeof o.returnClassifierID != "undefined") { m.ClassifierID = "" + parseInt(o.returnClassifierID, 10); }
    else if (o.returnClassifier) {
        var cl = this.FB_ResolveEl(Repository, o.returnClassifier);
        if (cl == null) { warns.push("operations[" + i + "]: returnClassifier nenalezen - preskocen"); }
        else { m.ClassifierID = "" + cl.ElementID; }
    }
    if (typeof o.notes != "undefined") { m.Notes = "" + o.notes; }
    else if (typeof o.description != "undefined") { m.Notes = "" + o.description; }
    if (typeof o.stereotype != "undefined") { m.StereotypeEx = "" + o.stereotype; }
    if (typeof o.isStatic != "undefined") { m.IsStatic = o.isStatic ? true : false; }
    if (typeof o.isAbstract != "undefined") { m.Abstract = o.isAbstract ? true : false; }
    if (!m.Update()) {
        return { op: "create_or_update_operations", status: "error", code: "E_EXCEPTION", message: "operations[" + i + "]: Update selhal: " + m.GetLastError(), items: items };
    }
    // --- parametry: deterministicky rebuild ---
    var params = [];
    if (o.parameters && Object.prototype.toString.call(o.parameters) == "[object Array]") {
        if (!created) {
            for (j = m.Parameters.Count - 1; j >= 0; j--) { m.Parameters.DeleteAt(j, false); }
            m.Parameters.Refresh();
        }
        for (j = 0; j < o.parameters.length; j++) {
            var ps = o.parameters[j];
            if (!ps || !ps.name) { warns.push("operations[" + i + "].parameters[" + j + "]: chybi name - preskocen"); continue; }
            var par = m.Parameters.AddNew("" + ps.name, (typeof ps.type == "undefined" ? "" : "" + ps.type));
            par.Position = j;
            if (typeof ps.notes != "undefined") { par.Notes = "" + ps.notes; }
            if (typeof ps["default"] != "undefined") { par.Default = "" + ps["default"]; }
            if (!par.Update()) { warns.push("operations[" + i + "].parameters[" + j + "]: Update selhal: " + par.GetLastError()); continue; }
            params.push({ guid: "" + par.ParameterGUID, name: "" + par.Name, position: j });
        }
        m.Parameters.Refresh();
    }
    var w2 = this.FB_TagWrite(Repository, m, o.taggedValues);
    for (var wj = 0; wj < w2.length; wj++) { warns.push("operations[" + i + "]: " + w2[wj]); }
    var item = { guid: "" + m.MethodGUID, id: m.MethodID, name: "" + m.Name, created: created };
    if (params.length > 0) { item.parameters = params; }
    items.push(item);
}
el.Methods.Refresh();
this.SetTag(el, "ai.request", "" + reqId); // razitko na vlastnika
var res = { op: "create_or_update_operations", status: "ok", element: { guid: "" + el.ElementGUID, id: el.ElementID }, count: items.length, items: items };
if (items.length > 0) { res.guid = items[0].guid; res.id = items[0].id; }
if (warns.length > 0) { res.warnings = warns; }
return res;
