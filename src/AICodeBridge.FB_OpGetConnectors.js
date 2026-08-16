// AICodeBridge.FB_OpGetConnectors(Repository, op)
// get_connectors_information - plny dump konektoru vc. koncu a TV (rozprazene).
// op.connectors = [ connectorID | "{GUID}" | $ref, ... ]
// direction se vraci v enum tvaru protokolu (par. 7h), ne v EA retezci.
if (!op || !op.connectors || Object.prototype.toString.call(op.connectors) != "[object Array]" || op.connectors.length == 0) {
    return { op: "get_connectors_information", status: "error", code: "E_ARGS", message: "Povinne: connectors (neprazdne pole referenci)." };
}
var DIRBACK = {
    "SOURCE -> DESTINATION": "FromSourceToTarget",
    "DESTINATION -> SOURCE": "FromTargetToSource",
    "BI-DIRECTIONAL": "BothDirection",
    "UNSPECIFIED": "Unspecified"
};
function endInfo(end) {
    return { aggregation: end.Aggregation, multiplicity: "" + end.Cardinality,
        role: "" + end.Role, navigable: "" + end.Navigable };
}
var out = [];
for (var i = 0; i < op.connectors.length; i++) {
    var conn = null;
    var ref = "" + op.connectors[i];
    try {
        if (ref.charAt(0) == "{") { conn = Repository.GetConnectorByGuid(ref); }
        else { conn = Repository.GetConnectorByID(parseInt(ref, 10)); }
    } catch (eG) { conn = null; }
    if (conn == null) {
        return { op: "get_connectors_information", status: "error", code: "E_NOT_FOUND", message: "connectors[" + i + "]: konektor nenalezen (" + ref + ")", items: out };
    }
    var dir = ("" + conn.Direction).toUpperCase();
    var d = {
        id: conn.ConnectorID, guid: "" + conn.ConnectorGUID, name: "" + conn.Name,
        type: "" + conn.Type, stereotypes: "" + conn.StereotypeEx,
        direction: (typeof DIRBACK[dir] == "undefined" ? "" + conn.Direction : DIRBACK[dir]),
        notes: "" + conn.Notes,
        sourceID: conn.ClientID, targetID: conn.SupplierID,
        sourceEnd: endInfo(conn.ClientEnd), targetEnd: endInfo(conn.SupplierEnd)
    };
    try { d.sequenceNo = conn.SequenceNo; } catch (eS) { }
    try { var se = Repository.GetElementByID(conn.ClientID); d.source = { id: se.ElementID, name: "" + se.Name, type: "" + se.Type }; } catch (e1) { }
    try { var te = Repository.GetElementByID(conn.SupplierID); d.target = { id: te.ElementID, name: "" + te.Name, type: "" + te.Type }; } catch (e2) { }
    d.taggedValues = this.FB_TagRead(Repository, conn);
    out.push(d);
}
return { op: "get_connectors_information", status: "ok", count: out.length, items: out };
