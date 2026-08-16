// AICodeBridge.FB_OpUpdateDiagramProps(Repository, op, reqId)
// update_diagram_properties (bonus K6) - zapis vlastnosti EXISTUJICIHO
// diagramu: Author, Version, jmeno, ShowDetails (par. 7e: "diagramy zalozene
// pres API nemaji autora - nastavovat Author, Version=1.0; version diagram
// navic ShowDetails=1"). Tvorbu diagramu resi Diagram Builder (iterace 2) -
// tohle je cileny doplnek pro konvence 7e nad auto-kompozity MDG.
// op.diagrams = [ { diagram: id|"{GUID}"|jmeno, name, author, version,
//                   showDetails: 0|1, styleEx (nahrada celeho StyleEx - pouzij
//                   pro MDGView napojeni dle 7e, opatrne) } ]
if (!op || !op.diagrams || Object.prototype.toString.call(op.diagrams) != "[object Array]" || op.diagrams.length == 0) {
    return { op: "update_diagram_properties", status: "error", code: "E_ARGS", message: "Povinne: diagrams (neprazdne pole objektu)." };
}
var items = [];
for (var i = 0; i < op.diagrams.length; i++) {
    var d = op.diagrams[i];
    var dg = null;
    var ref = ("" + (d && d.diagram ? d.diagram : "")).replace(/^\s+|\s+$/g, "");
    try {
        if (ref.charAt(0) == "{") { dg = Repository.GetDiagramByGuid(ref); }
        else if (/^[0-9]+$/.test(ref)) { dg = Repository.GetDiagramByID(parseInt(ref, 10)); }
        else if (ref != "") {
            var xml = Repository.SQLQuery("SELECT ea_guid FROM t_diagram WHERE Name = '" + ref.replace(/'/g, "''") + "'");
            var mm = /<ea_guid>([^<]+)<\/ea_guid>/i.exec(xml);
            if (mm) { dg = Repository.GetDiagramByGuid(mm[1]); }
        }
    } catch (eG) { dg = null; }
    if (dg == null) { return { op: "update_diagram_properties", status: "error", code: "E_NOT_FOUND", message: "diagrams[" + i + "]: diagram nenalezen (" + ref + ")", items: items }; }
    var chk = this.FB_CheckWrite(Repository, Repository.GetPackageByID(dg.PackageID));
    if (chk != null) { return { op: "update_diagram_properties", status: "error", code: chk.code, message: "diagrams[" + i + "]: " + chk.message, items: items }; }
    if (typeof d.name != "undefined") { dg.Name = "" + d.name; }
    if (typeof d.author != "undefined") { dg.Author = "" + d.author; }       // K6
    if (typeof d.version != "undefined") { dg.Version = "" + d.version; }    // K6
    if (typeof d.showDetails != "undefined") { dg.ShowDetails = parseInt(d.showDetails, 10); }
    if (typeof d.styleEx != "undefined") { dg.StyleEx = "" + d.styleEx; }
    if (!dg.Update()) {
        return { op: "update_diagram_properties", status: "error", code: "E_EXCEPTION", message: "diagrams[" + i + "]: Diagram.Update() selhal: " + dg.GetLastError(), items: items };
    }
    try { Repository.ReloadDiagram(dg.DiagramID); } catch (eR) { }
    items.push({ id: dg.DiagramID, guid: "" + dg.DiagramGUID, name: "" + dg.Name });
}
var res = { op: "update_diagram_properties", status: "ok", count: items.length, items: items };
if (items.length > 0) { res.guid = items[0].guid; res.id = items[0].id; }
return res;
