// AICodeBridge.FB_OpReloadDiagrams(Repository, op)
// reload_diagrams (K11) - prenacte diagramy v EA po zapisu (par. 8 "diagramy
// po uprave reload"). UI operace, nic nemeni.
// op.diagrams = [ diagramID | "{GUID}", ... ]
if (!op || !op.diagrams || Object.prototype.toString.call(op.diagrams) != "[object Array]" || op.diagrams.length == 0) {
    return { op: "reload_diagrams", status: "error", code: "E_ARGS", message: "Povinne: diagrams (neprazdne pole)." };
}
var reloaded = [];
for (var i = 0; i < op.diagrams.length; i++) {
    var ref = ("" + op.diagrams[i]).replace(/^\s+|\s+$/g, "");
    var id = 0;
    try {
        if (ref.charAt(0) == "{") { id = Repository.GetDiagramByGuid(ref).DiagramID; }
        else { id = parseInt(ref, 10); }
        Repository.ReloadDiagram(id);
        reloaded.push(id);
    } catch (e) {
        return { op: "reload_diagrams", status: "error", code: "E_EXCEPTION", message: "diagrams[" + i + "]: ReloadDiagram selhal: " + e.message, reloaded: reloaded };
    }
}
return { op: "reload_diagrams", status: "ok", reloaded: reloaded, count: reloaded.length };
