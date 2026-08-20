// AICodeBridge.FB_OpLinkedDocExport(Repository, op)
// export_element_linked_documents (K10) - export linked documentu (RTF)
// elementu. Cteci operace. Soubory se pisou VYHRADNE do <baseDir>\responses\docs\
// (zadne cizi cesty - jmeno souboru se sanitizuje).
// op.elements = [ "{GUID}" | id | $ref, ... ]
// op.inline   = true -> RTF se vrati i base64 v response (rtf_b64)
if (!op || !op.elements || Object.prototype.toString.call(op.elements) != "[object Array]" || op.elements.length == 0) {
    return { op: "export_element_linked_documents", status: "error", code: "E_ARGS", message: "Povinne: elements (neprazdne pole)." };
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
var docsDir = cfg.baseDir + "\\responses\\docs";
if (!fso.FolderExists(cfg.baseDir + "\\responses")) { fso.CreateFolder(cfg.baseDir + "\\responses"); }
if (!fso.FolderExists(docsDir)) { fso.CreateFolder(docsDir); }
var items = [];
for (var i = 0; i < op.elements.length; i++) {
    var el = this.FB_ResolveEl(Repository, op.elements[i]);
    if (el == null) { return { op: "export_element_linked_documents", status: "error", code: "E_NOT_FOUND", message: "elements[" + i + "]: element nenalezen (" + op.elements[i] + ")", items: items }; }
    var rtf = "";
    try { rtf = "" + el.GetLinkedDocument(); } catch (e) { rtf = ""; }
    var item = { elementID: el.ElementID, guid: "" + el.ElementGUID, name: "" + el.Name, hasDocument: rtf != "" };
    if (rtf != "") {
        var fn = ("" + el.Name).replace(/[^A-Za-z0-9._-]/g, "_");
        if (fn == "") { fn = "element"; }
        fn = fn + "-" + el.ElementID + ".rtf";
        var path = docsDir + "\\" + fn;
        var st = this.FB_ComObj("ADODB.Stream");
        st.Type = 2; st.Charset = "windows-1250"; st.Open();
        st.WriteText(rtf);
        st.SaveToFile(path, 2);
        st.Close();
        item.file = path;
        item.size = rtf.length;
        if (op.inline) { item.rtf_b64 = this.B64Encode(rtf); }
    }
    items.push(item);
}
return { op: "export_element_linked_documents", status: "ok", count: items.length, items: items };
