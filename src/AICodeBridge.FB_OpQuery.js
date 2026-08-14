// AICodeBridge.FB_OpQuery(Repository, op)
// SQL cteni pres Repository.SQLQuery (vraci i GUIDy - vyhoda proti MCP).
// READ-ONLY pojistka: povoleny jen dotazy zacinajici SELECT nebo WITH.
var sql = "";
if (op && op.sql_b64) { sql = this.B64Decode(op.sql_b64); }
else if (op && op.sql) { sql = "" + op.sql; }
if (sql.replace(/\s/g, "") == "") {
    return { op: "query", status: "error", code: "E_ARGS", message: "Chybi sql (nebo sql_b64)." };
}
var head = sql.replace(/^\s+/, "").substring(0, 6).toUpperCase();
if (head.substring(0, 6) != "SELECT" && head.substring(0, 4) != "WITH") {
    return { op: "query", status: "error", code: "E_SQL_READONLY", message: "Povoleny jen SELECT/WITH dotazy (read-only)." };
}
var xml = "" + Repository.SQLQuery(sql);
var rows = this.FB_XmlRows(xml);
return { op: "query", status: "ok", rowCount: rows.length, rows: rows };
