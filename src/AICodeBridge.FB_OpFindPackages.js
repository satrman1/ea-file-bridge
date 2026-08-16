// AICodeBridge.FB_OpFindPackages(Repository, op)
// find_packages_by_name - zrcadlo MCP toolu. Vraci i GUID a rodice.
// op.name = hledane jmeno; op.exactMatch = true (default) | false (podretezec)
if (!op || !op.name) {
    return { op: "find_packages_by_name", status: "error", code: "E_ARGS", message: "Povinne: name." };
}
var nm = ("" + op.name).replace(/'/g, "''");
var exact = (typeof op.exactMatch == "undefined") ? true : (op.exactMatch ? true : false);
var where = exact ? ("Name = '" + nm + "'") : ("Name LIKE '%" + nm + "%'");
var sql = "SELECT Package_ID, ea_guid, Name, Parent_ID FROM t_package WHERE " + where;
var rows = this.FB_XmlRows(Repository.SQLQuery(sql));
var items = [];
for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    items.push({ id: parseInt(r.Package_ID, 10), guid: "" + r.ea_guid, name: "" + (r.Name || ""),
        parentID: parseInt(r.Parent_ID || "0", 10) });
}
return { op: "find_packages_by_name", status: "ok", count: items.length, items: items };
