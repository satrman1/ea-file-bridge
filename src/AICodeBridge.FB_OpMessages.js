// AICodeBridge.FB_OpMessages(Repository, op, reqId)
// create_or_update_messages (K1, PRIORITA iterace 3) - zpravy sekvencnich
// diagramu vc. jmen, smeru (async/return) a vazeb na operace. Podklad pro
// vzor V2d (deterministicky rebuild sekvencnich diagramu).
//
// MECHANIKA (reverse-engineering proti MCP referenci, davky 20260816-10/11):
//   t_connector: PDATA1 = "Synchronous"|"Asynchronous" (<-> TransitionEvent)
//                PDATA2 = "paramsDlgs=;params=<args>;retval=<ret>" (<-> TransitionGuard)
//                PDATA3 = "Call" (<-> TransitionAction)
//                PDATA4 = "1" pro navratovou zpravu (mapovana Automation
//                         vlastnost neexistuje - reseni viz nize)
//                SeqNo, DiagramID = poradi + domovsky diagram zpravy
//   Vazba na operaci = TV operation_guid + sync jmena/argumentu z operace.
//
// op.diagram  = domovsky diagram zprav (id | "{GUID}") - doporucene: zapise
//               se do Connector.DiagramID (zprava patri interakci, ale EA
//               ji kresli podle DiagramID/SeqNo)
// op.rebuild  = true -> OPT-IN (audit B2, K3): deterministicky rebuild V2d
//               server-side (vzor FB_OpScenarios): SMAZE vsechny Sequence
//               konektory diagramu (vyzaduje op.diagram; whitelist kontrola
//               drzi - vzor FB_OpDelete) a postavi je znovu z davky. V rebuild
//               modu musi kazda zprava mit explicitni seqNo a nesmi nest
//               guid/connectorID (cile prave smazane). Response nese removed.
//               Default off - chovani stavajicich davek se NEMENI.
// op.messages = [ {
//   connectorID | guid    -> UPDATE; jinak CREATE
//   source, target        -> lifeliny ("{GUID}" | elementID | $ref)
//   name                  -> jmeno zpravy (u operace se sklada z operace)
//   operation             -> operationID | "{GUID}" -> TV operation_guid + sync
//   isReturn              -> true = navratova zprava
//   isAsynchronous        -> true = asynchronni volani
//   arguments, returnValue, notes, seqNo (explicitni poradi)
// } ]
// Kazdy item vraci "pdata" readback primo z t_connector = okamzita kontrola.
if (!op || !op.messages || Object.prototype.toString.call(op.messages) != "[object Array]" || op.messages.length == 0) {
    return { op: "create_or_update_messages", status: "error", code: "E_ARGS", message: "Povinne: messages (neprazdne pole)." };
}
var dg = null;
if (op.diagram) {
    var dref = ("" + op.diagram).replace(/^\s+|\s+$/g, "");
    try {
        if (dref.charAt(0) == "{") { dg = Repository.GetDiagramByGuid(dref); }
        else { dg = Repository.GetDiagramByID(parseInt(dref, 10)); }
    } catch (eD) { dg = null; }
    if (dg == null) { return { op: "create_or_update_messages", status: "error", code: "E_NOT_FOUND", message: "Diagram nenalezen: " + op.diagram }; }
}
var items = [], warns = [];
// --- OPT-IN rebuild mod (audit B2, K3): smaz Sequence konektory diagramu + postav znovu ---
var rebuild = (op.rebuild === true || ("" + op.rebuild) == "true");
var removed = 0;
if (rebuild) {
    if (dg == null) {
        return { op: "create_or_update_messages", status: "error", code: "E_ARGS", message: "rebuild: true vyzaduje op.diagram." };
    }
    for (var vi = 0; vi < op.messages.length; vi++) {
        var vm = op.messages[vi];
        if (vm && (vm.connectorID || vm.guid)) {
            return { op: "create_or_update_messages", status: "error", code: "E_ARGS",
                message: "messages[" + vi + "]: v rebuild modu nesmi zprava nest guid/connectorID (cile se prave mazou) - posli kompletni sadu jako create." };
        }
        if (!vm || typeof vm.seqNo == "undefined") {
            return { op: "create_or_update_messages", status: "error", code: "E_ARGS",
                message: "messages[" + vi + "]: rebuild mod vyzaduje explicitni seqNo u kazde zpravy (deterministicke poradi)." };
        }
    }
    var delRows;
    try {
        delRows = this.FB_XmlRows(Repository.SQLQuery(
            "SELECT Connector_ID FROM t_connector WHERE DiagramID = " + dg.DiagramID + " AND Connector_Type = 'Sequence'"));
    } catch (eRQ) {
        return { op: "create_or_update_messages", status: "error", code: "E_EXCEPTION", message: "rebuild: dotaz na zpravy diagramu selhal: " + eRQ.message };
    }
    // pre-check whitelistu VSECH mazanych konektoru PRED prvnim mazanim (zadne parcialni mazani)
    var toDel = [];
    for (var di = 0; di < delRows.length; di++) {
        var dcid = parseInt(delRows[di].Connector_ID, 10);
        var dc = null;
        try { dc = Repository.GetConnectorByID(dcid); } catch (eDC) { dc = null; }
        if (dc == null) { continue; }
        var dCli = Repository.GetElementByID(dc.ClientID);
        var dSup = Repository.GetElementByID(dc.SupplierID);
        var dChk1 = this.FB_CheckWrite(Repository, Repository.GetPackageByID(dCli.PackageID));
        var dChk2 = this.FB_CheckWrite(Repository, Repository.GetPackageByID(dSup.PackageID));
        if (dChk1 != null && dChk2 != null) {
            return { op: "create_or_update_messages", status: "error", code: dChk1.code,
                message: "rebuild: konektor " + dcid + " ma oba konce mimo whitelist - nic nebylo smazano. " + dChk1.message };
        }
        toDel.push({ id: dcid, clientID: dc.ClientID });
    }
    // delete pass (vzor FB_OpDelete: kolekce Connectors.DeleteAt)
    for (var dj = 0; dj < toDel.length; dj++) {
        var dCliEl = Repository.GetElementByID(toDel[dj].clientID);
        var dFound = false;
        for (var dk = 0; dk < dCliEl.Connectors.Count; dk++) {
            if (dCliEl.Connectors.GetAt(dk).ConnectorID == toDel[dj].id) {
                dCliEl.Connectors.DeleteAt(dk, false);
                dCliEl.Connectors.Refresh();
                dFound = true;
                removed++;
                break;
            }
        }
        if (!dFound) {
            return { op: "create_or_update_messages", status: "error", code: "E_EXCEPTION",
                message: "rebuild: konektor " + toDel[dj].id + " se nepodarilo najit v kolekci elementu (smazano " + removed + " z " + toDel.length + ").", removed: removed };
        }
    }
}
for (var i = 0; i < op.messages.length; i++) {
    var msg = op.messages[i];
    var conn = null, created = false, srcEl = null, tgtEl = null;
    if (msg.connectorID || msg.guid) {
        try {
            if (msg.guid) { conn = Repository.GetConnectorByGuid("" + msg.guid); }
            else { conn = Repository.GetConnectorByID(parseInt(msg.connectorID, 10)); }
        } catch (eG) { conn = null; }
        if (conn == null) { return { op: "create_or_update_messages", status: "error", code: "E_NOT_FOUND", message: "messages[" + i + "]: zprava nenalezena.", items: items }; }
        srcEl = Repository.GetElementByID(conn.ClientID);
        tgtEl = Repository.GetElementByID(conn.SupplierID);
    } else {
        if (!msg.source || !msg.target) {
            return { op: "create_or_update_messages", status: "error", code: "E_ARGS", message: "messages[" + i + "]: create vyzaduje source a target.", items: items };
        }
        srcEl = this.FB_ResolveEl(Repository, msg.source);
        tgtEl = this.FB_ResolveEl(Repository, msg.target);
        if (srcEl == null || tgtEl == null) {
            return { op: "create_or_update_messages", status: "error", code: "E_NOT_FOUND",
                message: "messages[" + i + "]: " + (srcEl == null ? "source" : "target") + " nenalezen.", items: items };
        }
    }
    var chkS = this.FB_CheckWrite(Repository, Repository.GetPackageByID(srcEl.PackageID));
    var chkT = this.FB_CheckWrite(Repository, Repository.GetPackageByID(tgtEl.PackageID));
    if (chkS != null && chkT != null) {
        return { op: "create_or_update_messages", status: "error", code: chkS.code,
            message: "messages[" + i + "]: zadny konec neni ve whitelistovane vetvi. " + chkS.message, items: items };
    }
    // --- vazba na operaci ---
    var meth = null;
    if (msg.operation) {
        var oref = "" + msg.operation;
        try {
            if (oref.charAt(0) == "{") { meth = Repository.GetMethodByGuid(oref); }
            else { meth = Repository.GetMethodByID(parseInt(oref, 10)); }
        } catch (eM) { meth = null; }
        if (meth == null) {
            return { op: "create_or_update_messages", status: "error", code: "E_NOT_FOUND",
                message: "messages[" + i + "]: operace nenalezena (" + oref + ").", items: items };
        }
    }
    var name = (typeof msg.name != "undefined" && msg.name !== null) ? ("" + msg.name) : null;
    var args = (typeof msg.arguments != "undefined") ? ("" + msg.arguments) : null;
    var retv = (typeof msg.returnValue != "undefined") ? ("" + msg.returnValue) : null;
    if (meth != null) {
        if (name === null) { name = "" + meth.Name; }
        if (args === null) {
            var pn = [];
            for (var pj = 0; pj < meth.Parameters.Count; pj++) { pn.push("" + meth.Parameters.GetAt(pj).Name); }
            args = pn.join(",");
        }
        if (retv === null && ("" + meth.ReturnType) != "" && ("" + meth.ReturnType) != "void") { retv = "" + meth.ReturnType; }
    }
    if (conn == null) {
        conn = srcEl.Connectors.AddNew((name === null ? "" : name), "Sequence");
        conn.SupplierID = tgtEl.ElementID;
        created = true;
    } else {
        if (name !== null) { conn.Name = name; }
        if (msg.source) { var ns = this.FB_ResolveEl(Repository, msg.source); if (ns != null) { conn.ClientID = ns.ElementID; } }
        if (msg.target) { var nt = this.FB_ResolveEl(Repository, msg.target); if (nt != null) { conn.SupplierID = nt.ElementID; } }
    }
    // --- kind/synch dle MCP reference: PDATA1=Sync/Async, PDATA3=Call ---
    if (typeof msg.isAsynchronous != "undefined") {
        conn.TransitionEvent = msg.isAsynchronous ? "Asynchronous" : "Synchronous";
    } else if (created) {
        conn.TransitionEvent = "Synchronous";
    }
    if (created) { conn.TransitionAction = "Call"; }
    // PDATA2 presne ve formatu MCP/GUI: paramsDlgs=;params=<args>;retval=<ret>
    if (args !== null || retv !== null || created) {
        conn.TransitionGuard = "paramsDlgs=;params=" + (args === null ? "" : args) + ";retval=" + (retv === null ? "" : retv);
    }
    // Navratova zprava: PDATA4=1; primou Automation vlastnost EA nema -
    // pokus o Subtype (readback pdata ukaze, zda se propsala; jinak fallback
    // stereotyp "return" na konektoru, ktery EA rovnez kresli carkovane)
    if (msg.isReturn) {
        try { conn.Subtype = "Return"; } catch (eSub) { warns.push("messages[" + i + "]: Subtype='Return' se nepodarilo zapsat"); }
    }
    if (typeof msg.notes != "undefined") { conn.Notes = "" + msg.notes; }
    // domovsky diagram zpravy
    if (dg != null) {
        try { conn.DiagramID = dg.DiagramID; } catch (eDia) { warns.push("messages[" + i + "]: DiagramID nelze zapsat"); }
    }
    // explicitni poradi (SequenceNo je dle dokumentace read-only - pokus + readback)
    if (typeof msg.seqNo != "undefined") {
        try { conn.SequenceNo = parseInt(msg.seqNo, 10); } catch (eSeq) { warns.push("messages[" + i + "]: SequenceNo nelze zapsat (read-only)"); }
    }
    if (!conn.Update()) {
        return { op: "create_or_update_messages", status: "error", code: "E_EXCEPTION",
            message: "messages[" + i + "]: Connector.Update() selhal: " + conn.GetLastError(), items: items };
    }
    if (meth != null) { this.SetTag(conn, "operation_guid", "" + meth.MethodGUID); }
    if (created) { this.SetTag(conn, "ai.channel", "eafb"); }
    this.SetTag(conn, "ai.request", "" + reqId);
    if (created) { srcEl.Connectors.Refresh(); }
    var item = { guid: "" + conn.ConnectorGUID, id: conn.ConnectorID, name: "" + conn.Name, created: created };
    // okamzity readback z t_connector (pozorovatelnost per zprava)
    try {
        var rows = this.FB_XmlRows(Repository.SQLQuery(
            "SELECT SeqNo, DiagramID, PDATA1, PDATA2, PDATA3, PDATA4 FROM t_connector WHERE Connector_ID = " + conn.ConnectorID));
        if (rows.length > 0) { item.pdata = rows[0]; }
    } catch (eRB) { }
    items.push(item);
}
var res = { op: "create_or_update_messages", status: "ok", count: items.length, items: items };
if (rebuild) { res.removed = removed; } // K3: vykaz smazanych zprav (vzor FB_OpScenarios)
if (items.length > 0) { res.guid = items[0].guid; res.id = items[0].id; }
if (warns.length > 0) { res.warnings = warns; }
return res;
