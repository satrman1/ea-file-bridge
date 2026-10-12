// AICodeBridge.FB_OpDelete(Repository, op, reqId)
// delete_from_model (K4) - mazani z modelu pres Automation API (kolekce
// DeleteAt). Gated dvojite: WHITELIST OPERACI (FB_OpsAllowed - v bance
// v P1 deny) + CIL ZAPISU v rezimu blacklist (zadani v1.1 kap. 5.5, W2,
// Z261004b-10): prvek/balicek/diagram v chranene casti = E_BLACKLIST (osa
// balicku i osa vlastniku); balicek, jehoz PODSTROM obsahuje chranenou vetev =
// E_BLACKLIST; KASKADY EA: (a) mazany prvek (nebo obsah mazaneho balicku) ma
// vazbu, jejiz ZDROJ lezi v chranene casti -> E_BLACKLIST (vazba zanika
// s cilem, ale patri chranenemu prvku); vazba z mazaneho prvku do chranene
// casti mazani nebrani; (b) mazany prvek je umisten na CHRANENEM diagramu ->
// E_BLACKLIST (EA ho z diagramu odstrani = zmena chraneneho diagramu);
// (c) mazany prvek je klasifikatorem instanci v chranene casti -> zatim jen
// VAROVANI (chovani EA se overuje zive, krok 9d) ; vazba mazane/mazany
// konektor: zdroj v chranene casti = E_BLACKLIST (rule 2 kap. 5.5).
// Mazani ciziho obsahu zustava delete-request pres cloveka (par. 12a).
// op.targets = [ { type: "Package|Diagram|Element|Connector|Attribute|Operation|Parameter",
//                  id | guid, name (jen u Parameter - mazani podle jmena) } ]
// Vysledek per polozka; chyba polozky = chyba operace (stop-on-error davky).
if (!op || !op.targets || Object.prototype.toString.call(op.targets) != "[object Array]" || op.targets.length == 0) {
    return { op: "delete_from_model", status: "error", code: "E_ARGS", message: "Povinne: targets (neprazdne pole)." };
}
var items = [], warns = [];
var self = this;
this._fbOpProgress = { items: items }; // W3
function esc(v) { return ("" + v).replace(/'/g, "''"); }
function qrows(sql) { try { return self.FB_XmlRows(Repository.SQLQuery(sql)); } catch (eQ) { return null; } }
function scope(kind, id) { try { return self.FB_ScopeCheck(Repository, kind, "" + id); } catch (eS) { return { code: "E_EXCEPTION", message: "kontrola cile selhala: " + eS.message }; } }
function isBl(r) { return r != null && r.code != "E_NOT_FOUND"; }
// kaskady EA (W2) nad mnozinou objektu (jeden prvek, nebo obsah podstromu balicku)
// idsSql = SQL vyraz mnoziny Object_ID; vraci null (ok) nebo { code, message }
function cascade(idsSql, what) {
    var rc = qrows("SELECT DISTINCT c.Start_Object_ID FROM t_connector c WHERE c.End_Object_ID IN (" + idsSql + ") AND c.Start_Object_ID NOT IN (" + idsSql + ")");
    if (rc == null) { return { code: "E_EXCEPTION", message: what + ": kaskadu vazeb nelze overit (SQL) - fail-closed" }; }
    for (var a = 0; a < rc.length; a++) {
        var sr = scope("element", parseInt(rc[a].Start_Object_ID, 10));
        if (isBl(sr)) { return { code: sr.code, message: what + ": prichozi vazba ma zdroj v chranene casti - EA by ji smazala s cilem. " + sr.message }; }
    }
    var rd = qrows("SELECT DISTINCT x.Diagram_ID FROM t_diagramobjects x WHERE x.Object_ID IN (" + idsSql + ")");
    if (rd == null) { return { code: "E_EXCEPTION", message: what + ": vyskyt na diagramech nelze overit (SQL) - fail-closed" }; }
    for (var d = 0; d < rd.length; d++) {
        var dr = scope("diagram", parseInt(rd[d].Diagram_ID, 10));
        if (isBl(dr)) { return { code: dr.code, message: what + ": objekt lezi na CHRANENEM diagramu - EA by ho z nej smazanim odstranila. " + dr.message }; }
    }
    // (c) klasifikator instanci v chranene casti: zatim varovani (overit zive)
    var ri = qrows("SELECT Object_ID FROM t_object WHERE Classifier IN (" + idsSql + ")");
    var protInst = 0;
    for (var ii = 0; ri != null && ii < ri.length && ii < 200; ii++) { if (isBl(scope("element", parseInt(ri[ii].Object_ID, 10)))) { protInst++; } }
    if (protInst > 0) { warns.push(what + ": mazany prvek je klasifikatorem " + protInst + " instanci v chranene casti - zkontroluj po smazani, co EA s instancemi udelala (W2 c; chovani EA se overuje zive ve Z261004b-10 krok 9d)"); }
    return null;
}
function subtreeIds(rootId) {
    var ids = [rootId], queue = [rootId], seen = {}, guard = 0;
    seen[rootId] = 1;
    while (queue.length > 0 && guard++ < 500) {
        var pid = queue.shift();
        var rp = qrows("SELECT Package_ID FROM t_package WHERE Parent_ID = " + pid);
        if (rp == null) { return null; }
        for (var k = 0; k < rp.length; k++) { var n = parseInt(rp[k].Package_ID, 10); if (!seen[n]) { seen[n] = 1; ids.push(n); queue.push(n); } }
    }
    return ids;
}
// Chybova vetev (nalez z ukladu T7-09, 2026-09-01): u vice targets musi byt
// z response videt CELY obraz - co uz je smazane (items, deleted:true), ktery
// target selhal (deleted:false + code) a kolik targetu se uz neprovedlo.
// Bez toho clovek po E_NOT_FOUND uprostred davky nevi, co v modelu zbylo.
function fail(i, code, message) {
    var t0 = op.targets[i] || {};
    items.push({ type: "" + (t0.type || "?"), id: t0.id || 0, guid: t0.guid || "", name: "" + (t0.name || t0.guid || t0.id || "?"),
                 deleted: false, code: code, index: i });
    var msg = "targets[" + i + "]: " + message;
    var doneN = 0;
    for (var di = 0; di < items.length; di++) { if (items[di].deleted === true) { doneN++; } }
    msg += " | smazano pred chybou: " + doneN + " z " + op.targets.length
        + ", neprovedeno: " + (op.targets.length - i - 1) + " (vycet v items)";
    return { op: "delete_from_model", status: "error", code: code, message: msg, items: items };
}
for (var i = 0; i < op.targets.length; i++) {
    var t = op.targets[i];
    var typ = ("" + (t && t.type ? t.type : "")).toUpperCase();
    var j, found;
    if (typ == "ELEMENT") {
        var el = this.FB_ResolveEl(Repository, t.guid || t.id);
        if (el == null) { var rfE = this.FB_ResolveFail("delete_from_model", "element nenalezen", null); return fail(i, rfE.code, rfE.message); }
        var chkE = this.FB_CheckWriteEl(Repository, el);
        if (chkE != null) { return fail(i, chkE.code, chkE.message); }
        var casE = cascade("" + el.ElementID, "kaskada mazani prvku '" + el.Name + "'");
        if (casE != null) { return fail(i, casE.code, casE.message); }
        // jmeno + cesta JESTE PRED smazanim (po smazani uz je nezjistis) -
        // aby FB_LogChanges/dialog ukazal, CO se smazalo a KDE (UX)
        var delName = "" + el.Name;
        var delPath = "?";
        try { delPath = this.FB_ElementPath(Repository, "element", el); } catch (eDp) { }
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
        items.push({ type: "Element", id: el.ElementID, name: delName, path: delPath, deleted: true });
    } else if (typ == "PACKAGE") {
        var pkg = this.FB_ResolvePkg(Repository, t.guid || t.id);
        if (pkg == null) { var rfP = this.FB_ResolveFail("delete_from_model", "package nenalezen", null); return fail(i, rfP.code, rfP.message); }
        var chkP = this.FB_CheckWrite(Repository, pkg);
        if (chkP != null) { return fail(i, chkP.code, chkP.message); }
        if (!pkg.ParentID) { return fail(i, "E_ARGS", "root package nelze mazat"); }
        // podstrom obsahuje chranenou vetev (blacklist / audit / add-in) -> E_BLACKLIST
        var scfg = null;
        try { scfg = this.FB_WriteScopeCfg(Repository); } catch (eCfg) { scfg = null; }
        var inside = (scfg && scfg.ancestorIds) ? scfg.ancestorIds["" + pkg.PackageID] : null;
        if (inside && inside.length > 0) { return fail(i, "E_BLACKLIST", "podstrom balicku '" + pkg.Name + "' obsahuje chranenou vetev (" + inside.join(", ") + ") - smazani by ji vzalo s sebou; pozadej cloveka"); }
        // kaskady EA nad obsahem celeho podstromu (W2 d)
        var sids = subtreeIds(pkg.PackageID);
        if (sids == null) { return fail(i, "E_EXCEPTION", "podstrom balicku nelze precist (SQL) - fail-closed"); }
        var casP = cascade("SELECT Object_ID FROM t_object WHERE Package_ID IN (" + sids.join(",") + ")", "kaskada mazani balicku '" + pkg.Name + "'");
        if (casP != null) { return fail(i, casP.code, casP.message); }
        // E2E pumpa P8 (2026-09-05): items nesly id z requestu (0 u GUID) a bez
        // jmena/cesty -> res "id":0, Output '[smazano] Package "" (id 0)'. Jako u
        // elementu: PackageID + jmeno + cesta zachytit PRED smazanim.
        var delPkgId = pkg.PackageID, delPkgName = "" + pkg.Name, delPkgPath = "?";
        try { delPkgPath = this.FB_ElementPath(Repository, "package", pkg); } catch (ePp) { }
        var parent = Repository.GetPackageByID(pkg.ParentID);
        found = false;
        for (j = 0; j < parent.Packages.Count; j++) {
            if (parent.Packages.GetAt(j).PackageID == pkg.PackageID) { parent.Packages.DeleteAt(j, false); parent.Packages.Refresh(); found = true; break; }
        }
        if (!found) { return fail(i, "E_EXCEPTION", "package se nepodarilo najit v kolekci rodice"); }
        items.push({ type: "Package", id: delPkgId, name: delPkgName, path: delPkgPath, deleted: true });
    } else if (typ == "CONNECTOR") {
        var conn = null;
        try {
            if (t.guid) { conn = Repository.GetConnectorByGuid("" + t.guid); }
            else { conn = Repository.GetConnectorByID(parseInt(t.id, 10)); }
        } catch (eC) { conn = null; }
        if (conn == null) { return fail(i, "E_NOT_FOUND", "konektor nenalezen"); }
        var cliEl = Repository.GetElementByID(conn.ClientID);
        // pravidlo vazeb (kap. 5.5 bod 2): zdroj v chranene casti = vlastni vazba chraneneho prvku
        var chkC1 = this.FB_CheckWriteEl(Repository, cliEl);
        if (chkC1 != null) { return fail(i, chkC1.code, "zdroj konektoru ('" + (cliEl ? cliEl.Name : "?") + "') lezi v chranene casti - mazani vazby chraneneho prvku neni povolene. " + chkC1.message); }
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
        var chkD = this.FB_CheckWriteEl(Repository, dg, "diagram");
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
        items.push({ type: "Diagram", id: dg.DiagramID, name: "" + dg.Name, deleted: true });
    } else if (typ == "ATTRIBUTE" || typ == "OPERATION") {
        // vlastnika najdeme SQL dotazem (jen cteni), mazeme pres kolekci
        var idn = parseInt(t.id, 10);
        var tbl = (typ == "ATTRIBUTE") ? "t_attribute" : "t_operation";
        var idc = (typ == "ATTRIBUTE") ? "ID" : "OperationID";
        var rows = this.FB_XmlRows(Repository.SQLQuery("SELECT Object_ID FROM " + tbl + " WHERE " + idc + " = " + idn));
        if (rows.length == 0) { return fail(i, "E_NOT_FOUND", typ.toLowerCase() + " nenalezen(a)"); }
        var ownEl = Repository.GetElementByID(parseInt(rows[0].Object_ID, 10));
        var chkA = this.FB_CheckWriteEl(Repository, ownEl);
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
            var chkPa = this.FB_CheckWriteEl(Repository, ownP);
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
var resD = { op: "delete_from_model", status: "ok", count: items.length, items: items };
if (warns.length > 0) { resD.warnings = warns; }
return resD;
