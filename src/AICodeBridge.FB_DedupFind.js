// AICodeBridge.FB_DedupFind(Repository, kind, key)
// Sdileny dedup helper (dostavba auditu B2, K4). Najde element/konektor
// podle TV ai.dedup = <key> (SQL jen cteni: t_objectproperties /
// t_connectortag). Klic je stabilni napric prejmenovanim prvku - vzor TV
// klicovani prevzat z FB_OpFindOrCreateSR (TV '505-1 Operation Link').
// kind = "element" | "connector".
// Vraci { count, guids[], obj } - obj je Element/Connector JEN pri count == 1;
// count > 1 resi volajici (E_AMBIGUOUS s vyctem guids).
// SQL bez dialektovych funkci - musi bezet na SQLite (.qea) i MS SQL.
var k = ("" + (key === null || typeof key == "undefined" ? "" : key)).replace(/^\s+|\s+$/g, "");
var res = { count: 0, guids: [], obj: null };
if (k == "") { return res; }
var esc = k.replace(/'/g, "''");
var sql;
if (("" + kind) == "connector") {
    sql = "SELECT c.ea_guid AS ea_guid FROM t_connector c " +
          "INNER JOIN t_connectortag t ON t.ElementID = c.Connector_ID " +
          "WHERE t.Property = 'ai.dedup' AND t.VALUE = '" + esc + "'";
} else {
    sql = "SELECT o.ea_guid AS ea_guid FROM t_object o " +
          "INNER JOIN t_objectproperties p ON p.Object_ID = o.Object_ID " +
          "WHERE p.Property = 'ai.dedup' AND p.Value = '" + esc + "'";
}
var rows = this.FB_XmlRows(Repository.SQLQuery(sql));
for (var i = 0; i < rows.length; i++) { res.guids.push("" + rows[i].ea_guid); }
res.count = res.guids.length;
if (res.count == 1) {
    try {
        if (("" + kind) == "connector") { res.obj = Repository.GetConnectorByGuid(res.guids[0]); }
        else { res.obj = Repository.GetElementByGuid(res.guids[0]); }
    } catch (eG) { res.obj = null; }
    if (res.obj == null) { res.count = 0; res.guids = []; }
}
return res;
