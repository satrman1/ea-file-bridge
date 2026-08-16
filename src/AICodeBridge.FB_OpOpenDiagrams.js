// AICodeBridge.FB_OpOpenDiagrams(Repository, op)
// open_diagrams (K11) - otevre diagramy v EA (UI operace, nic nemeni).
// op.diagrams = [ diagramID | "{GUID}" | jmeno, ... ]
if (!op || !op.diagrams || Object.prototype.toString.call(op.diagrams) != "[object Array]" || op.diagrams.length == 0) {
    return { op: "open_diagrams", status: "error", code: "E_ARGS", message: "Povinne: diagrams (neprazdne pole)." };
}
var opened = [];
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
    if (dg == null) { return { op: "open_diagrams", status: "error", code: "E_NOT_FOUND", message: "diagrams[" + i + "]: diagram nenalezen (" + ref + ")", opened: opened }; }
    try {
        Repository.OpenDiagram(dg.DiagramID);
        opened.push(dg.DiagramID);
    } catch (e) {
        return { op: "open_diagrams", status: "error", code: "E_EXCEPTION", message: "diagrams[" + i + "]: OpenDiagram selhal: " + e.message, opened: opened };
    }
}
return { op: "open_diagrams", status: "ok", opened: opened, count: opened.length };
