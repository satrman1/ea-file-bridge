// AICodeBridge.FB_OpDeleteTag(Repository, op, reqId)
// delete_taggedvalue_from_model (K4) - mazani tagged value podle jmena
// z vlastnika. Zrcadlo MCP toolu (od 2.8.5 opraveny nazev, N-K3-10).
// op.targets = [ { type: "ElementTaggedValue|ConnectorTaggedValue|AttributeTaggedValue
//                        |OperationTaggedValue|PackageTaggedValue",
//                  id: <ID vlastnika>, name: "jmeno tagu" } ]
// Umi i ConnectorTaggedValue (mazani operation_guid - UNDO drill T1).
if (!op || !op.targets || Object.prototype.toString.call(op.targets) != "[object Array]" || op.targets.length == 0) {
    return { op: "delete_taggedvalue_from_model", status: "error", code: "E_ARGS", message: "Povinne: targets (neprazdne pole)." };
}
var items = [];
function delFromCollection(col, name) {
    for (var j = 0; j < col.Count; j++) {
        if (("" + col.GetAt(j).Name) == ("" + name)) { col.DeleteAt(j, false); col.Refresh(); return true; }
    }
    return false;
}
for (var i = 0; i < op.targets.length; i++) {
    var t = op.targets[i];
    var typ = ("" + (t && t.type ? t.type : "")).toUpperCase();
    if (!t.name) { return { op: "delete_taggedvalue_from_model", status: "error", code: "E_ARGS", message: "targets[" + i + "]: chybi name tagu.", items: items }; }
    var ownerPkg = null, col = null, ownerEl = null;
    if (typ == "ELEMENTTAGGEDVALUE") {
        var el = this.FB_ResolveEl(Repository, t.guid || t.id);
        if (el == null) { return { op: "delete_taggedvalue_from_model", status: "error", code: "E_NOT_FOUND", message: "targets[" + i + "]: element nenalezen.", items: items }; }
        ownerPkg = Repository.GetPackageByID(el.PackageID); col = el.TaggedValues; ownerEl = el;
    } else if (typ == "CONNECTORTAGGEDVALUE") {
        var conn = null;
        try { conn = t.guid ? Repository.GetConnectorByGuid("" + t.guid) : Repository.GetConnectorByID(parseInt(t.id, 10)); } catch (eC) { conn = null; }
        if (conn == null) { return { op: "delete_taggedvalue_from_model", status: "error", code: "E_NOT_FOUND", message: "targets[" + i + "]: konektor nenalezen.", items: items }; }
        var cli = Repository.GetElementByID(conn.ClientID);
        ownerPkg = Repository.GetPackageByID(cli.PackageID); col = conn.TaggedValues;
    } else if (typ == "ATTRIBUTETAGGEDVALUE") {
        var rowsA = this.FB_XmlRows(Repository.SQLQuery("SELECT Object_ID FROM t_attribute WHERE ID = " + parseInt(t.id, 10)));
        if (rowsA.length == 0) { return { op: "delete_taggedvalue_from_model", status: "error", code: "E_NOT_FOUND", message: "targets[" + i + "]: atribut nenalezen.", items: items }; }
        var ownA = Repository.GetElementByID(parseInt(rowsA[0].Object_ID, 10));
        var attr = null;
        for (var ja = 0; ja < ownA.Attributes.Count; ja++) {
            if (ownA.Attributes.GetAt(ja).AttributeID == parseInt(t.id, 10)) { attr = ownA.Attributes.GetAt(ja); break; }
        }
        if (attr == null) { return { op: "delete_taggedvalue_from_model", status: "error", code: "E_NOT_FOUND", message: "targets[" + i + "]: atribut nenalezen v kolekci.", items: items }; }
        ownerPkg = Repository.GetPackageByID(ownA.PackageID); col = attr.TaggedValues; ownerEl = ownA;
    } else if (typ == "OPERATIONTAGGEDVALUE") {
        var meth = null;
        try { meth = Repository.GetMethodByID(parseInt(t.id, 10)); } catch (eM) { meth = null; }
        if (meth == null) { return { op: "delete_taggedvalue_from_model", status: "error", code: "E_NOT_FOUND", message: "targets[" + i + "]: operace nenalezena.", items: items }; }
        var rowsO = this.FB_XmlRows(Repository.SQLQuery("SELECT Object_ID FROM t_operation WHERE OperationID = " + parseInt(t.id, 10)));
        if (rowsO.length > 0) {
            var ownO = Repository.GetElementByID(parseInt(rowsO[0].Object_ID, 10));
            ownerPkg = Repository.GetPackageByID(ownO.PackageID); ownerEl = ownO;
        }
        col = meth.TaggedValues;
    } else if (typ == "PACKAGETAGGEDVALUE") {
        var pkg = this.FB_ResolvePkg(Repository, t.guid || t.id);
        if (pkg == null) { return { op: "delete_taggedvalue_from_model", status: "error", code: "E_NOT_FOUND", message: "targets[" + i + "]: package nenalezen.", items: items }; }
        var pel = null;
        try { pel = pkg.Element; } catch (ePE) { pel = null; }
        if (pel == null) { return { op: "delete_taggedvalue_from_model", status: "error", code: "E_ARGS", message: "targets[" + i + "]: root package TV nema.", items: items }; }
        ownerPkg = pkg; col = pel.TaggedValues; ownerEl = pel;
    } else {
        return { op: "delete_taggedvalue_from_model", status: "error", code: "E_ARGS",
            message: "targets[" + i + "]: neznamy type '" + t.type + "'.", items: items };
    }
    var chk = this.FB_CheckWrite(Repository, ownerPkg);
    if (chk != null) { return { op: "delete_taggedvalue_from_model", status: "error", code: chk.code, message: "targets[" + i + "]: " + chk.message, items: items }; }
    if (!delFromCollection(col, t.name)) {
        return { op: "delete_taggedvalue_from_model", status: "error", code: "E_NOT_FOUND",
            message: "targets[" + i + "]: tag '" + t.name + "' na cili nenalezen.", items: items };
    }
    if (ownerEl != null) { this.SetTag(ownerEl, "ai.request", "" + reqId); }
    items.push({ type: t.type, id: parseInt(t.id || "0", 10), name: "" + t.name, deleted: true });
}
return { op: "delete_taggedvalue_from_model", status: "ok", count: items.length, items: items };
