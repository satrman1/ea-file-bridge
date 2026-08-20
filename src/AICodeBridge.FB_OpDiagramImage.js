// AICodeBridge.FB_OpDiagramImage(Repository, op, reqId)
// get_diagram_image (iterace 2) - PNG export diagramu DO SOUBORU. Vyhoda proti
// MCP: MCP umel jen inline obrazek v odpovedi (bolest EDU pipeline), bridge
// pise PNG do <baseDir>\responses\images\ (zadne cizi cesty, jmeno souboru se
// sanitizuje - vzor FB_OpLinkedDocExport). Cteci operace.
// DVOJI RUNTIME (par. 1a protokolu): vsechny COM objekty vyhradne pres
// this.FB_ComObj - kod muze bezet i v EA (Mozilla JS) pres GUI fallback.
// op.diagrams = [ diagramID | "{GUID}" | $ref, ... ]   (alias: op.diagram = 1 kus)
// op.inline = true -> PNG se vrati i base64 v response (png_b64)
// Vysledek: items = [{diagramID, guid, name, file, size, png_b64?}]
var refs = null;
if (op && op.diagrams && Object.prototype.toString.call(op.diagrams) == "[object Array]") { refs = op.diagrams; }
else if (op && op.diagram) { refs = [op.diagram]; }
if (!refs || refs.length == 0) {
    return { op: "get_diagram_image", status: "error", code: "E_ARGS", message: "Povinne: diagram nebo diagrams (neprazdne pole)." };
}
// baseDir z FB_Config dle identity repozitare
var cfgs = this.FB_Config();
var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
var cfg = null;
for (var ci = 0; ci < cfgs.length; ci++) {
    if (rid.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) { cfg = cfgs[ci]; break; }
}
if (cfg == null || !cfg.baseDir) { cfg = { baseDir: this.FB_ResolveBaseDir(Repository) }; }
var fso = this.FB_ComObj("Scripting.FileSystemObject");
var imgDir = cfg.baseDir + "\\responses\\images";
if (!fso.FolderExists(cfg.baseDir + "\\responses")) { fso.CreateFolder(cfg.baseDir + "\\responses"); }
if (!fso.FolderExists(imgDir)) { fso.CreateFolder(imgDir); }
var proj = Repository.GetProjectInterface();
var items = [];
for (var i = 0; i < refs.length; i++) {
    var dg = null;
    var ref = ("" + refs[i]).replace(/^\s+|\s+$/g, "");
    try {
        if (ref.charAt(0) == "{") { dg = Repository.GetDiagramByGuid(ref); }
        else if (/^[0-9]+$/.test(ref)) { dg = Repository.GetDiagramByID(parseInt(ref, 10)); }
    } catch (eG) { dg = null; }
    if (dg == null) { return { op: "get_diagram_image", status: "error", code: "E_NOT_FOUND", message: "diagrams[" + i + "]: diagram nenalezen (" + ref + ")", items: items }; }
    var fn = ("" + dg.Name).replace(/[^A-Za-z0-9._-]/g, "_");
    if (fn == "") { fn = "diagram"; }
    fn = fn + "-" + dg.DiagramID + ".png";
    var path = imgDir + "\\" + fn;
    var okPut = false;
    try { okPut = proj.PutDiagramImageToFile(proj.GUIDtoXML("" + dg.DiagramGUID), path, 1); } catch (eP) { okPut = false; }
    if (!okPut || !fso.FileExists(path)) {
        return { op: "get_diagram_image", status: "error", code: "E_EXCEPTION", message: "diagrams[" + i + "]: PutDiagramImageToFile selhal (" + proj.GetLastError() + ")", items: items };
    }
    var item = { diagramID: dg.DiagramID, guid: "" + dg.DiagramGUID, name: "" + dg.Name, file: path, size: fso.GetFile(path).Size };
    if (op.inline) {
        // binarni PNG -> base64 pres ADODB.Stream + MSXML (oba pres FB_ComObj)
        var st = this.FB_ComObj("ADODB.Stream");
        st.Type = 1; st.Open();
        st.LoadFromFile(path);
        var bytes = st.Read(-1);
        st.Close();
        var xdoc = this.FB_ComObj("MSXML2.DOMDocument");
        var node = xdoc.createElement("b64");
        node.dataType = "bin.base64";
        node.nodeTypedValue = bytes;
        item.png_b64 = ("" + node.text).replace(/[\r\n]/g, "");
    }
    items.push(item);
}
var res = { op: "get_diagram_image", status: "ok", count: items.length, items: items };
if (items.length > 0) { res.guid = items[0].guid; res.id = items[0].diagramID; res.file = items[0].file; }
return res;
