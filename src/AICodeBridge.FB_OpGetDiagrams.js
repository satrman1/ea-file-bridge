// AICodeBridge.FB_OpGetDiagrams(Repository, op)
// get_diagrams_information - dump diagramu: vlastnosti, umistene objekty
// s geometrii, linky (viditelnost, styl) a u sekvencnich diagramu blok
// "messages" (zpravy mezi lifelinami na diagramu, serazene po SeqNo) -
// zrcadlo chovani MCP 2.8.7 (par. 7d cteni zprav).
// op.diagrams = [ diagramID | "{GUID}" | jmeno, ... ]
if (!op || !op.diagrams || Object.prototype.toString.call(op.diagrams) != "[object Array]" || op.diagrams.length == 0) {
    return { op: "get_diagrams_information", status: "error", code: "E_ARGS", message: "Povinne: diagrams (neprazdne pole referenci)." };
}
var out = [];
for (var i = 0; i < op.diagrams.length; i++) {
    var dg = null;
    var ref = ("" + op.diagrams[i]).replace(/^\s+|\s+$/g, "");
    try {
        if (ref.charAt(0) == "{") { dg = Repository.GetDiagramByGuid(ref); }
        else if (/^[0-9]+$/.test(ref)) { dg = Repository.GetDiagramByID(parseInt(ref, 10)); }
        else {
            var xml = Repository.SQLQuery("SELECT ea_guid FROM t_diagram WHERE Name = '" + ref.replace(/'/g, "''") + "'");
            var mm = /<ea_guid>([^<]+)<\/ea_guid>/i.exec(xml);
            if (mm) { dg = Repository.GetDiagramByGuid(mm[1]); }
        }
    } catch (eG) { dg = null; }
    if (dg == null) {
        return { op: "get_diagrams_information", status: "error", code: "E_NOT_FOUND", message: "diagrams[" + i + "]: diagram nenalezen (" + ref + ")", items: out };
    }
    var d = {
        id: dg.DiagramID, guid: "" + dg.DiagramGUID, name: "" + dg.Name,
        type: "" + dg.Type, metaType: "" + dg.MetaType, styleEx: "" + dg.StyleEx,
        author: "" + dg.Author, version: "" + dg.Version,
        packageID: dg.PackageID, owningElementID: dg.ParentID
    };
    var j;
    var onDiagram = {};
    d.objects = [];
    for (j = 0; j < dg.DiagramObjects.Count; j++) {
        var o = dg.DiagramObjects.GetAt(j);
        onDiagram[o.ElementID] = 1;
        var oi = { elementID: o.ElementID, left: o.left, right: o.right, top: o.top, bottom: o.bottom };
        try { var oe = Repository.GetElementByID(o.ElementID); oi.name = "" + oe.Name; oi.type = "" + oe.Type; oi.classifierID = oe.ClassifierID; } catch (eO) { }
        d.objects.push(oi);
    }
    d.links = [];
    for (j = 0; j < dg.DiagramLinks.Count; j++) {
        var l = dg.DiagramLinks.GetAt(j);
        d.links.push({ connectorID: l.ConnectorID, hidden: l.IsHidden ? true : false, lineStyle: l.LineStyle });
    }
    // Sekvencni zpravy: konektory typu Sequence mezi elementy na diagramu,
    // serazene po SeqNo (t_connector, jen cteni).
    var ids = [];
    for (var key in onDiagram) { if (onDiagram[key] == 1) { ids.push(key); } }
    if (ids.length > 0) {
        var sql = "SELECT Connector_ID, ea_guid, Name, Start_Object_ID, End_Object_ID, SeqNo, Connector_Type, Stereotype, "
            + "SubType, PDATA1, PDATA2, PDATA4 "
            + "FROM t_connector WHERE Connector_Type IN ('Sequence', 'Collaboration') "
            + "AND Start_Object_ID IN (" + ids.join(",") + ") AND End_Object_ID IN (" + ids.join(",") + ") "
            + "ORDER BY SeqNo";
        var rows = this.FB_XmlRows(Repository.SQLQuery(sql));
        if (rows.length > 0) {
            d.messages = [];
            for (j = 0; j < rows.length; j++) {
                var r = rows[j];
                var msg = { connectorID: parseInt(r.Connector_ID, 10), guid: "" + r.ea_guid,
                    name: "" + (r.Name || ""), seqNo: parseInt(r.SeqNo || "0", 10),
                    sourceID: parseInt(r.Start_Object_ID, 10), targetID: parseInt(r.End_Object_ID, 10),
                    // dve rovnocenne kodovani navratu: MCP = PDATA4=1, bridge = SubType=Return
                    isReturn: (("" + (r.PDATA4 || "")) == "1" || ("" + (r.SubType || "")) == "Return"),
                    isAsynchronous: (("" + (r.PDATA1 || "")) == "Asynchronous") };
                var pm = /params=([^;]*);retval=([^;]*)/.exec("" + (r.PDATA2 || ""));
                if (pm) {
                    if (pm[1] != "") { msg.arguments = pm[1]; }
                    if (pm[2] != "") { msg.returnValue = pm[2]; }
                }
                // vazba na operaci (TV operation_guid) rozprazene
                try {
                    var c = Repository.GetConnectorByID(msg.connectorID);
                    var tvs = this.FB_TagRead(Repository, c);
                    for (var k = 0; k < tvs.length; k++) {
                        if (tvs[k].name == "operation_guid" && tvs[k].ref) { msg.operation = tvs[k].ref; }
                    }
                } catch (eM) { }
                d.messages.push(msg);
            }
        }
    }
    out.push(d);
}
return { op: "get_diagrams_information", status: "ok", count: out.length, items: out };
