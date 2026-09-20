// AICodeBridge.FB_SubtreeCount(Repository, pkgId, cfg, budgetLeftMs)
// BASELINE POLITIKA - SONDA velikosti podstromu package (zadani v1.2 par.
// 4.3). Vraci { elements, packages, ms, status: "ok"|"unknown", why, method }.
// SHADOW: cislo se jen MERI a vykazuje; o nicem nerozhoduje, dokud politika
// nema thresholdsShadow: false (po kalibraci T6-C v bance).
//
// PRIMAR = iterativni expanze po urovnich nad t_package prostymi SELECT
// (tvary odzkousene v executoru), pak COUNT(*) nad t_object s Package_ID IN
// (...) a Object_Type <> 'Package'. Rekurzivni CTE jen jako OPT-IN
// (cfg.useCte) - SQLite `WITH RECURSIVE` (RepositoryType "SL3"), MS SQL `WITH`
// ("SQLSVR"); JET/neznamy typ -> iterativni cesta. POZN: hodnota
// RepositoryType pro .qea ("SL3") je z dokumentace EA, ZIVE NEOVERENA -
// pri neshode se jen pouzije iterativni cesta (bezpecny smer).
// FAIL-CLOSED (B6, PROTOKOL par. 10 / N-4): chybny dotaz v EA NEVRACI chybu,
// ale prazdny vysledek (po modalu). Proto:
//  - kazdy dotaz expanze vraci i KOREN (kanarek): 0 radku = dotaz selhal, ne
//    "list bez deti" -> unknown;
//  - COUNT bez radku = selhani -> unknown;
//  - soucet 0 nad existujici package = NEDUVERYHODNY -> unknown, nikdy
//    "pod prahem";
//  - vycerpany rozpocet (cfg.probeBudgetMs na package, budgetLeftMs = zbytek
//    probeBudgetTotalMs na davku), strop hloubky / poctu packages -> unknown.
// Nikdy nevyhazuje. Early-exit (COUNT s TOP/LIMIT) zamerne NENI (I3).
var self = this;
var t0 = new Date().getTime();
var perPkg = (cfg && typeof cfg.probeBudgetMs == "number") ? cfg.probeBudgetMs : 500;
var budget = perPkg;
if (typeof budgetLeftMs == "number" && budgetLeftMs < budget) { budget = budgetLeftMs; }
var MAX_DEPTH = 40, MAX_PACKAGES = 5000, CHUNK = 200;
function done(status, why, el, pkc, method) {
    return { elements: el, packages: pkc, ms: (new Date().getTime() - t0), status: status, why: why, method: method };
}
function over() { return (new Date().getTime() - t0) > budget; }
function rows(sql) {
    try { return self.FB_XmlRows(Repository.SQLQuery(sql)); } catch (eQ) { return null; }
}
var root = parseInt(pkgId, 10);
if (isNaN(root) || root <= 0) { return done("unknown", "neplatne Package_ID", 0, 0, "none"); }
if (budget <= 0) { return done("unknown", "rozpocet sondy vycerpan (celkovy strop na davku)", 0, 0, "none"); }

// --- opt-in CTE ---
if (cfg && cfg.useCte === true) {
    var rt = "";
    try { rt = ("" + Repository.RepositoryType()).toUpperCase(); } catch (eT) { rt = ""; }
    var kw = (rt == "SQLSVR") ? "WITH" : ((rt == "SL3" || rt.indexOf("SQLITE") >= 0) ? "WITH RECURSIVE" : "");
    if (kw != "") {
        var rc = rows(kw + " sub(pkg_id) AS (SELECT Package_ID FROM t_package WHERE Package_ID = " + root
            + " UNION ALL SELECT p.Package_ID FROM t_package p JOIN sub s ON p.Parent_ID = s.pkg_id)"
            + " SELECT COUNT(DISTINCT s.pkg_id) AS packages, COUNT(o.Object_ID) AS elements FROM sub s"
            + " LEFT JOIN t_object o ON o.Package_ID = s.pkg_id AND o.Object_Type <> 'Package'");
        if (over()) { return done("unknown", "rozpocet sondy vycerpan (" + budget + " ms, CTE)", 0, 0, "cte"); }
        if (rc == null || rc.length != 1) { return done("unknown", "CTE dotaz nevratil radek (selhani / nepodporovany dialekt)", 0, 0, "cte"); }
        var cp = parseInt(rc[0].packages, 10), ce = parseInt(rc[0].elements, 10);
        if (isNaN(cp) || isNaN(ce) || cp < 1) { return done("unknown", "CTE dotaz vratil necitelny vysledek", 0, 0, "cte"); }
        if (ce == 0) { return done("unknown", "podstrom ma 0 prvku - prazdna package nebo falesna nula (B6)", 0, cp, "cte"); }
        return done("ok", "", ce, cp, "cte");
    }
    // dialekt bez CTE -> iterativni cesta
}

// --- primar: iterativni expanze ---
var all = [root], seen = {}, level = [root], depth = 0;
seen[root] = 1;
while (level.length > 0) {
    if (over()) { return done("unknown", "rozpocet sondy vycerpan (" + budget + " ms) pri expanzi, uroven " + depth, 0, all.length, "iter"); }
    if (++depth > MAX_DEPTH) { return done("unknown", "strop hloubky " + MAX_DEPTH, 0, all.length, "iter"); }
    var next = [];
    for (var a = 0; a < level.length; a += CHUNK) {
        var part = level.slice(a, a + CHUNK);
        // kanarek: koren se vraci vzdy -> 0 radku = dotaz selhal
        var rr = rows("SELECT Package_ID, Parent_ID FROM t_package WHERE Parent_ID IN (" + part.join(",") + ") OR Package_ID = " + root);
        if (rr == null || rr.length == 0) { return done("unknown", "dotaz expanze nevratil ani koren (selhani dotazu / falesna nula)", 0, all.length, "iter"); }
        var sawRoot = false;
        for (var r = 0; r < rr.length; r++) {
            var cid = parseInt(rr[r].Package_ID, 10);
            if (cid == root) { sawRoot = true; continue; }
            if (isNaN(cid) || seen[cid] == 1) { continue; }
            seen[cid] = 1; next.push(cid); all.push(cid);
            if (all.length > MAX_PACKAGES) { return done("unknown", "strop poctu packages " + MAX_PACKAGES, 0, all.length, "iter"); }
        }
        if (!sawRoot) { return done("unknown", "package " + root + " neexistuje (koren ve vysledku chybi)", 0, all.length, "iter"); }
        if (over()) { return done("unknown", "rozpocet sondy vycerpan (" + budget + " ms) pri expanzi", 0, all.length, "iter"); }
    }
    level = next;
}
var total = 0;
for (var b = 0; b < all.length; b += CHUNK) {
    var ids = all.slice(b, b + CHUNK);
    var rcn = rows("SELECT COUNT(*) AS c FROM t_object WHERE Package_ID IN (" + ids.join(",") + ") AND Object_Type <> 'Package'");
    if (rcn == null || rcn.length != 1) { return done("unknown", "COUNT nevratil radek (selhani dotazu)", 0, all.length, "iter"); }
    var cn = parseInt(rcn[0].c, 10);
    if (isNaN(cn)) { return done("unknown", "COUNT vratil necitelnou hodnotu", 0, all.length, "iter"); }
    total += cn;
    if (over()) { return done("unknown", "rozpocet sondy vycerpan (" + budget + " ms) pri pocitani", total, all.length, "iter"); }
}
if (total == 0) { return done("unknown", "podstrom ma 0 prvku - prazdna package nebo falesna nula (B6)", 0, all.length, "iter"); }
return done("ok", "", total, all.length, "iter");
