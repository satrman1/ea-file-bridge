// AICodeBridge.FB_OpFindPackages(Repository, op)
// find_packages_by_name - zrcadlo MCP toolu. Vraci i GUID a rodice.
// op.name = hledane jmeno; op.exactMatch = true (default) | false (podretezec)
// op.scope (iterace 5, C - volitelne) = GUID | id package: vysledky se omezi
// na VETEV tohoto package (vcetne nej) - viz FB_OpFindElements. Bez scope
// se chovani NEMENI.
if (!op || !op.name) {
    return { op: "find_packages_by_name", status: "error", code: "E_ARGS", message: "Povinne: name." };
}
var scopePkg = null;
if (op.scope) {
    var sc = ("" + op.scope).replace(/^\s+|\s+$/g, "");
    try {
        scopePkg = (sc.charAt(0) == "{") ? Repository.GetPackageByGuid(sc)
            : Repository.GetPackageByID(parseInt(sc, 10));
    } catch (eSc) { scopePkg = null; }
    if (!scopePkg) {
        return { op: "find_packages_by_name", status: "error", code: "E_NOT_FOUND",
            message: "scope package nenalezen: " + sc };
    }
}
var nm = ("" + op.name).replace(/'/g, "''");
var exact = (typeof op.exactMatch == "undefined") ? true : (op.exactMatch ? true : false);
var where = exact ? ("Name = '" + nm + "'") : ("Name LIKE '%" + nm + "%'");
var sql = "SELECT Package_ID, ea_guid, Name, Parent_ID FROM t_package WHERE " + where;
var rows = this.FB_XmlRows(Repository.SQLQuery(sql));
var items = [];
for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var pid = parseInt(r.Package_ID, 10);
    if (scopePkg != null && !this.FB_InBranch(Repository, pid, scopePkg.PackageID)) { continue; }
    items.push({ id: pid, guid: "" + r.ea_guid, name: "" + (r.Name || ""),
        parentID: parseInt(r.Parent_ID || "0", 10) });
}
var resp = { op: "find_packages_by_name", status: "ok", count: items.length, items: items };
if (scopePkg != null) {
    resp.scope = { guid: "" + scopePkg.PackageGUID, id: scopePkg.PackageID,
        path: "" + this.FB_ElementPath(Repository, "package", scopePkg) };
}
return resp;
