// AICodeBridge.FB_OpQuery(Repository, op)
// SQL cteni pres Repository.SQLQuery (vraci i GUIDy - vyhoda proti MCP).
// READ-ONLY pojistka: povoleny jen dotazy zacinajici SELECT nebo WITH.
// v0.13 (E2E VS Code 2026-09-07, nalez N2): chybny SQL (neexistujici sloupec/
// tabulka) drive vratil ok/rowCount 0 ("falesna nula") a EA otevrelo MODALNI
// dialog "SQL API Open FAILED", ktery musel clovek odkliknout. Nove:
//  - kolem SQLQuery se nastavi Repository.SuppressEADialogs = true (EA 16+;
//    kdyz vlastnost v runtime chybi, prirazeni tise selze) a po dotazu se
//    vrati puvodni hodnota (try/finally),
//  - vysledek bez <Dataset_0> (prazdny retezec, EA chybovy text, <EADATA/>
//    bez datasetu) = E_SQL s prvnim radkem hlasky EA; vyjimka z SQLQuery = E_SQL.
//  Legitimni prazdny SELECT vraci <EADATA><Dataset_0><Data/>...</EADATA>
//  -> zustava ok/rowCount 0. Rozliseni "<EADATA> bez Dataset_0 = chyba"
//  potvrzuje ziva davka 20260908-V1 (docs/e2e-vscode/OVERENI-S-OPRAVY-2026-09-08.md).
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
function sqlErr(detail) {
    var msg = "";
    if (detail) {
        // prvni neprazdny radek textu bez XML tagu (hlaska EA, napr. "SQL API Open FAILED: no such column: Type")
        var plain = ("" + detail).replace(/<[^>]*>/g, "\n");
        var lines = plain.split(/\r?\n/);
        for (var li = 0; li < lines.length; li++) {
            var ln = lines[li].replace(/^\s+|\s+$/g, "");
            if (ln != "") { msg = ln.substring(0, 300); break; }
        }
    }
    if (msg == "") { msg = "dotaz selhal (neexistujici sloupec/tabulka?)"; }
    return { op: "query", status: "error", code: "E_SQL", message: msg, sql: sql.substring(0, 500) };
}
var xml = "";
var supOld = null, supSet = false;
try {
    // SuppressEADialogs: zadny modalni dialog EA behem dotazu (EA 16+).
    // Chybi-li vlastnost (starsi EA / mock), prirazeni spadne do catch a jede se bez ni.
    try { supOld = Repository.SuppressEADialogs; Repository.SuppressEADialogs = true; supSet = true; }
    catch (eSup) { supSet = false; }
    try { xml = "" + Repository.SQLQuery(sql); }
    catch (eQ) { return sqlErr(eQ && eQ.message ? eQ.message : ""); }
} finally {
    if (supSet) { try { Repository.SuppressEADialogs = supOld; } catch (eRes) { } }
}
if (xml.replace(/\s/g, "") == "" || xml.indexOf("<Dataset_0") < 0) {
    return sqlErr(xml);
}
var rows = this.FB_XmlRows(xml);
return { op: "query", status: "ok", rowCount: rows.length, rows: rows };
