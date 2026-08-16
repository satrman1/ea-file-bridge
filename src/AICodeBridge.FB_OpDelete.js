// AICodeBridge.FB_OpDelete(Repository, op, reqId)
// delete_from_model (K4) - mazani z modelu pres Automation API (kolekce
// DeleteAt). Gated dvojite: WHITELIST OPERACI (FB_OpsAllowed - v bance
// v P1 deny) + whitelist packages (mazat jde jen ve whitelistovane vetvi).
// Mazani ciziho obsahu zustava delete-request pres cloveka (par. 12a).
// op.targets = [ { type: "Package|Diagram|Element|Connector|Attribute|Operation|Parameter",
//                  id | guid, name (jen u Parameter - mazani podle jmena) } ]
// Vysledek per polozka; chyba polozky = chyba operace (stop-on-error davky).
if (!op || !op.targets || Object.prototype.toString.call(op.targets) != "[object Array]" || op.targets.length == 0) {
    return { op: "delete_from_model", status: "error", code: "E_ARGS", message: "Povinne: targets (neprazdne pole)." };
}
var items = [];
var self = this;
function fail(i, code, message) {
    return { op: "delete_from_model", status: "error", code: code, message: "targets[" + i + "]: " + message, items: items };
}
for (var i = 0; i < op.targets.length; i++) {
    var t = op.targets[i];
    var typ = ("" + (t && t.type ? t.type : "")).toUpperCase();
    var j, found;
    if (typ == "ELEMENT") {
        var el = this.FB_ResolveEl(Repository, t.guid || t.id);
        if (el == null) { return fail(i, "E_NOT_FOUND", "element nenalezen"); }
        var chkE = this.FB_CheckWrite(Repository, Repository.GetPackageByID(el.PackageID));
        if (chkE != null) { return fail(i, chkE.code, chkE.message); }
        found = false;
        if (el.ParentID > 0) {
            var owner = Repository.GetElementByID(el.ParentID);
            for (j = 0; j < owner.Elements.Count; j++) {
                if (owner.Elements.GetAt(j).ElementID == el.ElementID) { owner.Elements.DeleteAt(j, false); owner.Elements.Refresh(); found = true; break; }
            }
        } else {
            var pkgE = Repository.GetPackageByID(el.PackageID);
            for (j = 0; j < pkgE.Elements.Count; j++) {
                if (pkgE.Elements.GetAt(j).ElementID == el.ElementID) { pkgE.Elements.DeleteAt(j, false); pkgE.Elements.Refresh(); found = true; break; }
            }
        }
        if (!found) { return fail(i, "E_EXCEPTION", "element se nepodarilo najit v kolekci vlastnika"); }
        items.push({ type: "Element", id: el.ElementID, deleted: true });
    } else if (typ == "PACKAGE") {
        var pkg = this.FB_ResolvePkg(Repository, t.guid || t.id);
        if (pkg == null) { return fail(i, "E_NOT_FOUND", "package nenalezen"); }
        var chkP = this.FB_CheckWrite(Repository, pkg);
        if (chkP != null) { return fail(i, chkP.code, chkP.message); }
        if (!pkg.ParentID) { return fail(i, "E_ARGS", "root package nelze mazat"); }
        var parent = Repository.GetPackageByID(pkg.ParentID);
        found = false;
        for (j = 0; j < parent.Packages.Count; j++) {
            if (parent.Packages.GetAt(j).PackageID == pkg.PackageID) { parent.Packages.DeleteAt(j, false); parent.Packages.Refresh(); found = true; break; }
        }
        if (!found) { return fail(i, "E_EXCEPTION", "package se nepodarilo najit v kolekci rodice"); }
        items.push({ type: "Package", id: t.id || 0, deleted: true });
    } else if (typ == "CONNECTOR") {
        var conn = null;
        try {
            if (t.guid) { conn = Repository.GetConnectorByGuid("" + t.guid); }
            else { conn = Repository.GetConnectorByID(parseInt(t.id, 10)); }
        } catch (eC) { conn = null; }
        if (conn == null) { return fail(i, "E_NOT_FOUND", "konektor nenalezen"); }
        var cliEl = Repository.GetElementByID(conn.ClientID);
        var supEl = Repository.GetElementByID(conn.SupplierID);
        var chkC1 = this.FB_CheckWrite(Repository, Repository.GetPackageByID(cliEl.PackageID));
        var chkC2 = this.FB_CheckWrite(Repository, Repository.GetPackageByID(supEl.PackageID));
        if (chkC1 != null && chkC2 != null) { return fail(i, chkC1.code, "zadny konec konektoru neni ve whitelistovane vetvi"); }
        found = false;
        for (j = 0; j < cliEl.Connectors.Count; j++) {
            if (cliEl.Connectors.GetAt(j).ConnectorID == conn.ConnectorID) { cliEl.Connectors.DeleteAt(j, false); cliEl.Connectors.Refresh(); found = true; break; }
        }
        if (!found) { return fail(i, "E_EXCEPTION", "konektor se nepodarilo najit v kolekci elementu"); }
        items.push({ type: "Connector", id: parseInt(t.id || "0", 10), deleted: true });
    } else if (typ == "DIAGRAM") {
        var dg = null;
        try {
            if (t.guid) { dg = Repository.GetDiagramByGuid("" + t.guid); }
            else { dg = Repository.GetDiagramByID(parseInt(t.id, 10)); }
        } catch (eD) { dg = null; }
        if (dg == null) { return fail(i, "E_NOT_FOUND", "diagram nenalezen"); }
        var chkD = this.FB_CheckWrite(Repository, Repository.GetPackageByID(dg.PackageID));
        if (chkD != null) { return fail(i, chkD.code, chkD.message); }
        found = false;
        if (dg.ParentID > 0) {
            var ownerD = Repository.GetElementByID(dg.ParentID);
            for (j = 0; j < ownerD.Diagrams.Count; j++) {
                if (ownerD.Diagrams.GetAt(j).DiagramID == dg.DiagramID) { ownerD.Diagrams.DeleteAt(j, false); ownerD.Diagrams.Refresh(); found = true; break; }
            }
        } else {
            var pkgD = Repository.GetPackageByID(dg.PackageID);
            for (j = 0; j < pkgD.Diagrams.Count; j++) {
                if (pkgD.Diagrams.GetAt(j).DiagramID == dg.DiagramID) { pkgD.Diagrams.DeleteAt(j, false); pkgD.Diagrams.Refresh(); found = true; break; }
            }
        }
        if (!found) { return fail(i, "E_EXCEPTION", "diagram se nepodarilo najit v kolekci vlastnika"); }
        items.push({ type: "Diagram", id: dg.DiagramID, deleted: true });
    } else if (typ == "ATTRIBUTE" || typ == "OPERATION") {
        // vlastnika najdeme SQL dotazem (jen cteni), mazeme pres kolekci
        var idn = parseInt(t.id, 10);
        var tbl = (typ == "ATTRIBUTE") ? "t_attribute" : "t_operation";
        var idc = (typ == "ATTRIBUTE") ? "ID" : "OperationID";
        var rows = this.FB_XmlRows(Repository.SQLQuery("SELECT Object_ID FROM " + tbl + " WHERE " + idc + " = " + idn));
        if (rows.length == 0) { return fail(i, "E_NOT_FOUND", typ.toLowerCase() + " nenalezen(a)"); }
        var ownEl = Repository.GetElementByID(parseInt(rows[0].Object_ID, 10));
        var chkA = this.FB_CheckWrite(Repository, Repository.GetPackageByID(ownEl.PackageID));
        if (chkA != null) { return fail(i, chkA.code, chkA.message); }
        found = false;
        if (typ == "ATTRIBUTE") {
            for (j = 0; j < ownEl.Attributes.Count; j++) {
                if (ownEl.Attributes.GetAt(j).AttributeID == idn) { ownEl.Attributes.DeleteAt(j, false); ownEl.Attributes.Refresh(); found = true; break; }
            }
        } else {
            for (j = 0; j < ownEl.Methods.Count; j++) {
                if (ownEl.Methods.GetAt(j).MethodID == idn) { ownEl.Methods.DeleteAt(j, false); ownEl.Methods.Refresh(); found = true; break; }
            }
        }
        if (!found) { return fail(i, "E_EXCEPTION", "polozka se nepodarila najit v kolekci elementu"); }
        this.SetTag(ownEl, "ai.request", "" + reqId);
        items.push({ type: (typ == "ATTRIBUTE" ? "Attribute" : "Operation"), id: idn, deleted: true });
    } else if (typ == "PARAMETER") {
        // id = operationID, name = jmeno parametru (konvence MCP)
        var mid = parseInt(t.id, 10);
        var meth = null;
        try { meth = Repository.GetMethodByID(mid); } catch (eM) { meth = null; }
        if (meth == null) { return fail(i, "E_NOT_FOUND", "operace parametru nenalezena"); }
        var rowsP = this.FB_XmlRows(Repository.SQLQuery("SELECT Object_ID FROM t_operation WHERE OperationID = " + mid));
        if (rowsP.length > 0) {
            var ownP = Repository.GetElementByID(parseInt(rowsP[0].Object_ID, 10));
            var chkPa = this.FB_CheckWrite(Repository, Repository.GetPackageByID(ownP.PackageID));
            if (chkPa != null) { return fail(i, chkPa.code, chkPa.message); }
        }
        found = false;
        for (j = 0; j < meth.Parameters.Count; j++) {
            if (("" + meth.Parameters.GetAt(j).Name) == ("" + t.name)) { meth.Parameters.DeleteAt(j, false); meth.Parameters.Refresh(); found = true; break; }
        }
        if (!found) { return fail(i, "E_NOT_FOUND", "parametr '" + t.name + "' nenalezen"); }
        items.push({ type: "Parameter", id: mid, name: "" + t.name, deleted: true });
    } else {
        return fail(i, "E_ARGS", "nezmamy type '" + t.type + "' (Package|Diagram|Element|Connector|Attribute|Operation|Parameter)");
    }
}
return { op: "delete_from_model", status: "ok", count: items.length, items: items };
