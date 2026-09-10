// AICodeBridge.FB_OpQuery(Repository, op)
// SQL cteni pres Repository.SQLQuery (vraci i GUIDy - vyhoda proti MCP).
// READ-ONLY pojistka: povoleny jen dotazy zacinajici SELECT nebo WITH.
// v0.13 (E2E VS Code 2026-09-07, nalez N2): chybny SQL (neexistujici sloupec/
// tabulka) drive vratil ok/rowCount 0 ("falesna nula") a EA otevrelo MODALNI
// dialog "SQL API Open FAILED", ktery musel clovek odkliknout. Nove:
//  - kolem SQLQuery se nastavi Repository.SuppressEADialogs = true (EA 16+;
//    kdyz vlastnost v runtime chybi, prirazeni tise selze) a po dotazu se
//    vrati puvodni hodnota (try/finally). ZIVE 2026-09-08 (V1, EA 17.1.5
//    build 1715): dialog "SQL API Open FAILED" se PRESTO objevil - obal ho
//    nekryje; pole suppressDialogs v E_SQL vysledku rika proc (viz sqlErr),
//  - vysledek bez <Dataset_0> (prazdny retezec, EA chybovy text, <EADATA/>
//    bez datasetu) = E_SQL s prvnim radkem hlasky EA; vyjimka z SQLQuery = E_SQL.
//  Legitimni prazdny SELECT vraci <EADATA><Dataset_0><Data/>...</EADATA>
//  -> zustava ok/rowCount 0. Rozliseni "<EADATA> bez Dataset_0 = chyba"
//  potvrzuje ziva davka 20260908-V1 (docs/e2e-vscode/OVERENI-S-OPRAVY-2026-09-08.md).
//  !! OTEVRENO 2026-09-09 (K8 K10, N-K8-4): `SELECT * FROM t_seclocks` nad
//  PRAZDNOU tabulkou skoncil E_SQL BEZ dialogu EA (tyz dotaz s 1 radkem
//  prosel) - hypoteza: u SELECT * bez radku EA nezna sloupce a Dataset_0
//  nevyrobi -> falesne pozitivni E_SQL. Proto E_SQL od 9. 9. nese `raw`
//  (prvnich 300 znaku odpovedi EA, tagy zachovany) = diagnostika pro
//  rozliseni obou pripadu pri pristim vyskytu; do te doby pravidlo pro kit:
//  nad tabulkou, ktera muze byt prazdna, sloupce VYJMENOVAT, ne SELECT *.
//  !! ROZHODNUTO 2026-09-10 (zive BANKA, MS SQL 2022, recon-01 op 7, raw):
//  prazdny vysledek = `<?xml ...?><EADATA version="1.0" exporter="Enterprise
//  Architect"></EADATA>` - obalka BEZ Dataset_0, i s VYJMENOVANYMI sloupci
//  (ne jen SELECT *). Detekce z 8. 9. tedy kazde legitimni 0 radku hlasila
//  E_SQL a shodila zbytek davky (recon, ktery nic nenajde = cely beh stoji).
//  Nove pravidlo: obalka <EADATA> bez datasetu = ok / rowCount 0 + warning
//  (EA takto muze vratit i CHYBNY dotaz - ten pozna clovek podle dialogu
//  "SQL API Open FAILED"; bridge ho z odpovedi rozlisit neumi); E_SQL jen
//  pro vyjimku, prazdny retezec nebo ne-XML text. Tvar odpovedi EA na
//  chybny dotaz zatim v `raw` nezachycen - kdyz se objevi, doplnit sem.
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
    var rawText = (detail == null ? "" : detail);
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
    // suppressDialogs = diagnostika (zive 2026-09-08 V1: dialog "SQL API Open
    // FAILED" se OBJEVIL i s obalem) - rozlisuje "on" (vlastnost prijala true,
    // ale dialog nekryje) od "unavailable: <chyba>" (vlastnost v runtime chybi)
    return { op: "query", status: "error", code: "E_SQL", message: msg, sql: sql.substring(0, 500), suppressDialogs: supState,
        raw: ("" + rawText).substring(0, 300) };
}
var xml = "";
var supOld = null, supSet = false, supState = "not-set";
try {
    // SuppressEADialogs: pokus potlacit modalni dialog EA behem dotazu (EA 16+).
    // Chybi-li vlastnost (starsi EA / mock), prirazeni spadne do catch a jede se bez ni.
    try {
        supOld = Repository.SuppressEADialogs; Repository.SuppressEADialogs = true; supSet = true;
        supState = "on (readback=" + Repository.SuppressEADialogs + ", before=" + supOld + ")";
    }
    catch (eSup) { supSet = false; supState = "unavailable: " + (eSup && eSup.message ? eSup.message : eSup); }
    try { xml = "" + Repository.SQLQuery(sql); }
    catch (eQ) { return sqlErr(eQ && eQ.message ? eQ.message : ""); }
} finally {
    if (supSet) { try { Repository.SuppressEADialogs = supOld; } catch (eRes) { } }
}
if (xml.replace(/\s/g, "") == "") { return sqlErr(xml); }
if (xml.indexOf("<Dataset_0") < 0) {
    if (/<EADATA[\s>\/]/i.test(xml)) {
        // obalka bez datasetu = 0 radku (zive banka 2026-09-10 + K8 K10) - NE chyba
        return { op: "query", status: "ok", rowCount: 0, rows: [],
            warnings: ["0 radku: EA vratilo obalku <EADATA> bez datasetu. Stejne muze vypadat i CHYBNY dotaz"
                + " (neexistujici sloupec/tabulka) - ten se pozna podle dialogu 'SQL API Open FAILED' v EA."
                + " Nez z nuly vyvodis zaver, over nazvy sloupcu (INFORMATION_SCHEMA / sqlite_master)."],
            raw: xml.substring(0, 300) };
    }
    return sqlErr(xml);
}
var rows = this.FB_XmlRows(xml);
return { op: "query", status: "ok", rowCount: rows.length, rows: rows };
