// AICodeBridge.FB_OpLinkedDocImport(Repository, op, reqId)
// import_element_linked_documents (K10) - import linked documentu (RTF)
// na element (structured scenario / RTF zrcadlo).
// op.documents = [ {
//   element  -> "{GUID}" | id | $ref
//   file     -> plna cesta k RTF souboru UVNITR baseDir (FB_Config) - jine cesty
//               se odmitaji (zadny prochazeni disku executorem), NEBO
//   rtf_b64  -> base64 RTF primo v davce (zapise se pres docasny soubor)
// } ]
if (!op || !op.documents || Object.prototype.toString.call(op.documents) != "[object Array]" || op.documents.length == 0) {
    return { op: "import_element_linked_documents", status: "error", code: "E_ARGS", message: "Povinne: documents (neprazdne pole)." };
}
var cfgs = this.FB_Config();
var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
var cfg = null;
for (var ci = 0; ci < cfgs.length; ci++) {
    if (rid.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) { cfg = cfgs[ci]; break; }
}
if (cfg == null || !cfg.baseDir) { cfg = { baseDir: this.FB_ResolveBaseDir(Repository) }; }
var fso = this.FB_ComObj("Scripting.FileSystemObject");
var items = [];
for (var i = 0; i < op.documents.length; i++) {
    var d = op.documents[i];
    if (!d || !d.element) { return { op: "import_element_linked_documents", status: "error", code: "E_ARGS", message: "documents[" + i + "]: chybi element.", items: items }; }
    var el = this.FB_ResolveEl(Repository, d.element);
    if (el == null) { return { op: "import_element_linked_documents", status: "error", code: "E_NOT_FOUND", message: "documents[" + i + "]: element nenalezen.", items: items }; }
    var chk = this.FB_CheckWrite(Repository, Repository.GetPackageByID(el.PackageID));
    if (chk != null) { return { op: "import_element_linked_documents", status: "error", code: chk.code, message: "documents[" + i + "]: " + chk.message, items: items }; }
    var path = "";
    if (d.rtf_b64) {
        var rtf = this.B64Decode(d.rtf_b64);
        path = cfg.baseDir + "\\responses\\tmp-linkeddoc-" + el.ElementID + ".rtf";
        var st = this.FB_ComObj("ADODB.Stream");
        st.Type = 2; st.Charset = "windows-1250"; st.Open();
        st.WriteText(rtf);
        st.SaveToFile(path, 2);
        st.Close();
    } else if (d.file) {
        path = "" + d.file;
        if (path.toUpperCase().indexOf(("" + cfg.baseDir).toUpperCase()) != 0) {
            return { op: "import_element_linked_documents", status: "error", code: "E_ARGS",
                message: "documents[" + i + "]: file musi lezet uvnitr baseDir (" + cfg.baseDir + ").", items: items };
        }
        if (!fso.FileExists(path)) {
            return { op: "import_element_linked_documents", status: "error", code: "E_NOT_FOUND", message: "documents[" + i + "]: soubor nenalezen: " + path, items: items };
        }
    } else {
        return { op: "import_element_linked_documents", status: "error", code: "E_ARGS", message: "documents[" + i + "]: chybi file nebo rtf_b64.", items: items };
    }
    var okL = false;
    try { okL = el.LoadLinkedDocument(path); } catch (e) {
        return { op: "import_element_linked_documents", status: "error", code: "E_EXCEPTION", message: "documents[" + i + "]: LoadLinkedDocument selhal: " + e.message, items: items };
    }
    if (!okL) {
        return { op: "import_element_linked_documents", status: "error", code: "E_EXCEPTION", message: "documents[" + i + "]: LoadLinkedDocument vratil false.", items: items };
    }
    this.SetTag(el, "ai.request", "" + reqId);
    items.push({ elementID: el.ElementID, guid: "" + el.ElementGUID, imported: true });
}
return { op: "import_element_linked_documents", status: "ok", count: items.length, items: items };
