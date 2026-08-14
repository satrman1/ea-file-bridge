// AICodeBridge.RunQuery(Repository, req)
// mode=query: Notes = base64(SQL) -> Repository.SQLQuery -> Notes = base64(XML vysledek).
// READ-ONLY: Repository.SQLQuery spousti jen SELECT (nevykona UPDATE/DELETE/INSERT).
// SQL dialekt = dialekt repozitare (.qea = SQLite; produkce MS SQL).
var raw = ("" + req.Notes).replace(/<[^>]+>/g, "").replace(/[^A-Za-z0-9+\/=]/g, "");
if (raw == "") {
    this.SetTag(req, "status", "ERROR");
    this.SetTag(req, "detail", "Prazdne Notes (zadny SQL payload).");
    this.Log(Repository, "ERROR " + req.Name + ": prazdny SQL");
    return;
}
var sql = this.B64Decode(raw);
// Pojistka proti zapisu: povolit jen dotazy zacinajici SELECT nebo WITH.
var head = sql.replace(/^\s+/, "").substring(0, 6).toUpperCase();
if (head.substring(0, 6) != "SELECT" && head.substring(0, 4) != "WITH") {
    this.SetTag(req, "status", "ERROR");
    this.SetTag(req, "detail", "Zamitnuto: povoleny jen SELECT/WITH dotazy (read-only).");
    this.Log(Repository, "ERROR " + req.Name + ": non-SELECT zamitnut");
    return;
}
var result = "" + Repository.SQLQuery(sql);
req.Notes = this.B64Encode(result);
req.Update();
this.SetTag(req, "status", "DONE");
this.SetTag(req, "detail", "Query OK, vysledek " + result.length + " znaku, " + String(new Date()));
this.Log(Repository, "QUERY " + req.Name + " (" + result.length + " znaku vysledku)");
