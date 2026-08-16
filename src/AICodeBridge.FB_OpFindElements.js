// AICodeBridge.FB_OpFindElements(Repository, op)
// find_elements_by_name - zrcadlo MCP toolu (idempotence par. 2: "pred create
// vzdy find"). Na rozdil od MCP vraci i GUID.
// op.name = hledane jmeno; op.exactMatch = true (default) | false (podretezec)
if (!op || !op.name) {
    return { op: "find_elements_by_name", status: "error", code: "E_ARGS", message: "Povinne: name." };
}
var nm = ("" + op.name).replace(/'/g, "''");
var exact = (typeof op.exactMatch == "undefined") ? true : (op.exactMatch ? true : false);
var where = exact ? ("Name = '" + nm + "'") : ("Name LIKE '%" + nm + "%'");
var sql = "SELECT Object_ID, ea_guid, Name, Object_Type, Stereotype, Package_ID FROM t_object WHERE " + where;
var rows = this.FB_XmlRows(Repository.SQLQuery(sql));
var items = [];
for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    items.push({ id: parseInt(r.Object_ID, 10), guid: "" + r.ea_guid, name: "" + (r.Name || ""),
        type: "" + (r.Object_Type || ""), stereotype: "" + (r.Stereotype || ""),
        packageID: parseInt(r.Package_ID || "0", 10) });
}
return { op: "find_elements_by_name", status: "ok", count: items.length, items: items };
