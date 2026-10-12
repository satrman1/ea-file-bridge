// AICodeBridge.FB_OpQuery(Repository, op)
// SQL cteni pres Repository.SQLQuery (vraci i GUIDy - vyhoda proti MCP).
// READ-ONLY pojistka: povoleny jen dotazy zacinajici SELECT nebo WITH.
// v0.20 (balik B2 operace, Z261004b-7; FB-PU-31 + N-B-3 banka 10. 9.):
//  - obchvat pojistky: `;` (druhy prikaz) a klicove slovo INTO (SELECT ... INTO
//    = zapis) mimo retezcovy literal = E_SQL_READONLY, dotaz se nespusti;
//  - STROP RADKU op.maxRows (vychozi 500, max 5000; novy parametr -> jen
//    typeof): rows se oriznou, truncated: true, rowCount = SKUTECNY pocet radku,
//    maxRows = pouzity strop. Strop chrani VELIKOST res a kontext agenta, NE
//    dobu behu v EA - EA sestavi cely vysledek, nez ho bridge dostane (N-B-3:
//    neomezeny SELECT nad velkou tabulkou "visi" minuty). Dobu behu chrani jen
//    TOP N / selektivni WHERE v dotazu samotnem (PROTOKOL kap. 10);
//  - dotaz bez TOP / LIMIT / WHERE (a bez agregace) = varovani "dotaz bez
//    omezeni"; nad znamymi VELKYMI tabulkami (t_object, t_connector,
//    t_objectproperties, t_seclocks, t_xref, ...) se takovy dotaz rovnou odmitne
//    (E_SQL_UNBOUNDED) - v bance by zastavil pumpu na minuty.
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
// --- FB-PU-31: text dotazu bez retezcovych literalu ('...' a "..." / [..]) pro kontroly tvaru ---
var bare = "", inQ = "";
for (var qi = 0; qi < sql.length; qi++) {
    var ch = sql.charAt(qi);
    if (inQ != "") { if (ch == inQ) { inQ = ""; } continue; }
    if (ch == "'" || ch == "\"") { inQ = ch; bare += " "; continue; }
    if (ch == "[") { inQ = "]"; bare += " "; continue; }
    bare += ch;
}
if (bare.indexOf(";") >= 0) {
    return { op: "query", status: "error", code: "E_SQL_READONLY", message: "Dotaz obsahuje ';' mimo retezec - povolen je jediny SELECT/WITH prikaz (zadne retezeni prikazu)." };
}
if (/\bINTO\b/i.test(bare)) {
    return { op: "query", status: "error", code: "E_SQL_READONLY", message: "Dotaz obsahuje INTO (SELECT ... INTO = zapis) - povoleno je jen cteni." };
}
// --- strop radku (op.maxRows; novy parametr -> jen typeof) ---
var MAX_ROWS_DEFAULT = 500, MAX_ROWS_CAP = 5000;
var maxRows = MAX_ROWS_DEFAULT, qWarns = [];
if (op && typeof op.maxRows != "undefined" && op.maxRows !== null && ("" + op.maxRows) != "") {
    var mrq = parseInt(op.maxRows, 10);
    if (isNaN(mrq) || mrq < 1) { qWarns.push("maxRows '" + op.maxRows + "' neni kladne cislo - plati vychozi " + MAX_ROWS_DEFAULT); }
    else if (mrq > MAX_ROWS_CAP) { maxRows = MAX_ROWS_CAP; qWarns.push("maxRows " + mrq + " presahuje strop " + MAX_ROWS_CAP + " - plati " + MAX_ROWS_CAP + "; vetsi vysledek rozdel dotazem (WHERE / TOP po castech)"); }
    else { maxRows = mrq; }
}
// --- dotaz bez omezeni (N-B-3): varovani; nad znamymi velkymi tabulkami odmitnout ---
var BIG_TABLES = { t_object: 1, t_connector: 1, t_objectproperties: 1, t_attribute: 1, t_operation: 1, t_operationparams: 1,
                   t_diagramobjects: 1, t_diagramlinks: 1, t_xref: 1, t_seclocks: 1, t_document: 1, t_snapshot: 1,
                   t_connectortag: 1, t_attributetag: 1, t_operationtag: 1, t_objectconstraint: 1, t_objectrequires: 1,
                   t_objectscenarios: 1, t_objecttests: 1, t_objectresource: 1, t_objectrisks: 1, t_objecteffort: 1 };
var hasLimit = /\bTOP\s*\(?\s*\d+/i.test(bare) || /\bLIMIT\s+\d+/i.test(bare) || /\bWHERE\b/i.test(bare) || /\bFETCH\s+(FIRST|NEXT)\b/i.test(bare);
var isAggregate = /^\s*(WITH\b[\s\S]*?\))?\s*SELECT\s+(DISTINCT\s+)?(COUNT|MIN|MAX|SUM|AVG)\s*\(/i.test(bare) && !/\bGROUP\s+BY\b/i.test(bare);
if (!hasLimit && !isAggregate) {
    var tabs = [], bigHit = [], tm, tabRe = /\b(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)/gi;
    while ((tm = tabRe.exec(bare)) != null) {
        var tn = tm[1].toLowerCase();
        tabs.push(tn);
        if (BIG_TABLES[tn] == 1) { bigHit.push(tm[1]); }
    }
    if (bigHit.length > 0) {
        return { op: "query", status: "error", code: "E_SQL_UNBOUNDED",
            message: "Dotaz bez TOP / LIMIT / WHERE nad velkou tabulkou (" + bigHit.join(", ") + ") se nespusti - EA by sestavovalo cely vysledek (v bance miliony radku = pumpa stoji minuty, N-B-3)."
                + " Pridej TOP N (MS SQL) / LIMIT N (SQLite) nebo selektivni WHERE (filtr po ID, ne po jmene na joinu); maxRows (" + maxRows + ") orizne jen odpoved, ne dobu behu.",
            sql: sql.substring(0, 500), tables: tabs };
    }
    qWarns.push("dotaz bez omezeni (TOP / LIMIT / WHERE): EA sestavi cely vysledek, maxRows (" + maxRows + ") orizne jen odpoved - nad vetsi tabulkou pridej TOP N / WHERE");
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
        return { op: "query", status: "ok", rowCount: 0, rows: [], maxRows: maxRows,
            warnings: ["0 radku: EA vratilo obalku <EADATA> bez datasetu. Stejne muze vypadat i CHYBNY dotaz"
                + " (neexistujici sloupec/tabulka) - ten se pozna podle dialogu 'SQL API Open FAILED' v EA."
                + " Nez z nuly vyvodis zaver, over nazvy sloupcu (INFORMATION_SCHEMA / sqlite_master)."].concat(qWarns),
            raw: xml.substring(0, 300) };
    }
    return sqlErr(xml);
}
var rows = this.FB_XmlRows(xml);
var resQ = { op: "query", status: "ok", rowCount: rows.length, rows: rows, maxRows: maxRows };
if (rows.length > maxRows) {
    resQ.rows = rows.slice(0, maxRows);
    resQ.truncated = true;
    qWarns.push("vysledek oriznut: dotaz vratil " + rows.length + " radku, v odpovedi je prvnich " + maxRows + " (maxRows); rowCount = skutecny pocet. Zuz dotaz (WHERE / TOP) nebo zvys maxRows (max " + MAX_ROWS_CAP + ")");
}
if (qWarns.length > 0) { resQ.warnings = qWarns; }
return resQ;
