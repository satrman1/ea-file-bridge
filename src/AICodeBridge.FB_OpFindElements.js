// AICodeBridge.FB_OpFindElements(Repository, op)
// find_elements_by_name - zrcadlo MCP toolu (idempotence par. 2: "pred create
// vzdy find"). Na rozdil od MCP vraci i GUID.
// op.name = hledane jmeno; op.exactMatch = true (default) | false (podretezec)
// op.scope (iterace 5, C - volitelne) = GUID | id package: vysledky se omezi
// na VETEV tohoto package (vcetne nej). Typicky branchGuid z
// get_selected_context ("hledej ve vetvi vyberu"). Filtr bezi klientsky
// pres FB_InBranch (parent retez, zadne dialektove SQL ani velke IN).
// Bez scope se chovani NEMENI (globalni hledani jako dosud).
if (!op || !op.name) {
    return { op: "find_elements_by_name", status: "error", code: "E_ARGS", message: "Povinne: name." };
}
var scopePkg = null;
if (op.scope) {
    var sc = ("" + op.scope).replace(/^\s+|\s+$/g, "");
    try {
        scopePkg = (sc.charAt(0) == "{") ? Repository.GetPackageByGuid(sc)
            : Repository.GetPackageByID(parseInt(sc, 10));
    } catch (eSc) { scopePkg = null; }
    if (!scopePkg) {
        return { op: "find_elements_by_name", status: "error", code: "E_NOT_FOUND",
            message: "scope package nenalezen: " + sc };
    }
}
var nm = ("" + op.name).replace(/'/g, "''");
var exact = (typeof op.exactMatch == "undefined") ? true : (op.exactMatch ? true : false);
var where = exact ? ("Name = '" + nm + "'") : ("Name LIKE '%" + nm + "%'");
var sql = "SELECT Object_ID, ea_guid, Name, Object_Type, Stereotype, Package_ID FROM t_object WHERE " + where;
var rows = this.FB_XmlRows(Repository.SQLQuery(sql));
var items = [];
for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var pkgId = parseInt(r.Package_ID || "0", 10);
    if (scopePkg != null && !this.FB_InBranch(Repository, pkgId, scopePkg.PackageID)) { continue; }
    items.push({ id: parseInt(r.Object_ID, 10), guid: "" + r.ea_guid, name: "" + (r.Name || ""),
        type: "" + (r.Object_Type || ""), stereotype: "" + (r.Stereotype || ""),
        packageID: pkgId });
}
var resp = { op: "find_elements_by_name", status: "ok", count: items.length, items: items };
if (scopePkg != null) {
    resp.scope = { guid: "" + scopePkg.PackageGUID, id: scopePkg.PackageID,
        path: "" + this.FB_ElementPath(Repository, "package", scopePkg) };
}
return resp;
