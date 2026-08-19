// AICodeBridge.FB_QcRun(Repository, req, resp)
// QC V ACK (zadani iterace 4 par. 3.4): po zapisove davce spusti kontroly
// z FB_QcConfig scopovane na dotcene packages (risk.summary.packages).
// TRI STAVY ODDELENE od stavu zapisu (W6 - selhani QC se NIKDY nehlasi
// jako chyba zapisu; vola se z FB_Main v try/catch, vysledek jen resp.qc):
//   { status: "ciste" | "nalez" | "nedobehlo", checks, findings[], reason, elapsedMs }
// findings[] = { id, desc, count, sample (max 3 radky) }.
// !! SQL kontrol VYHRADNE nad overenymi sloupci (lekce par. 6a/3: neznamy
// sloupec na .qea = modalni dialog EA = viselec pumpy/vratneho).
// $PKGNAMES v SQL = scope na dotcene packages (jmena z risk.summary.packages,
// escapovana ''); kdyz scope neni znamy, kontrola s $PKGNAMES se preskoci.
var t0 = new Date().getTime();
var cfgs = null;
try { cfgs = this.FB_QcConfig(); }
catch (eC) { return { status: "nedobehlo", reason: "FB_QcConfig chybi/selhal: " + eC.message, checks: 0, findings: [] }; }
var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
var cfg = null;
for (var ci = 0; ci < cfgs.length; ci++) {
    if (rid.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) { cfg = cfgs[ci]; break; }
}
if (cfg == null || !cfg.checks || cfg.checks.length == 0) {
    return { status: "nedobehlo", reason: "zadne QC kontroly pro repozitar (FB_QcConfig)", checks: 0, findings: [] };
}
var pkgs = (resp && resp.risk && resp.risk.summary && resp.risk.summary.packages) ? resp.risk.summary.packages : [];
var pkgSql = "";
if (pkgs && pkgs.length > 0) {
    var esc = [];
    for (var p = 0; p < pkgs.length; p++) { esc.push("'" + ("" + pkgs[p]).replace(/'/g, "''") + "'"); }
    pkgSql = esc.join(",");
}
var findings = [], ran = 0, skippedScope = 0, failReason = "";
for (var i = 0; i < cfg.checks.length; i++) {
    var ch = cfg.checks[i];
    var sql = "" + ch.sql;
    if (sql.indexOf("$PKGNAMES") >= 0) {
        if (pkgSql == "") { skippedScope++; continue; }
        sql = sql.replace(/\$PKGNAMES/g, pkgSql);
    }
    try {
        var rows = this.FB_XmlRows(Repository.SQLQuery(sql));
        ran++;
        if (rows && rows.length > 0) {
            findings.push({ id: "" + ch.id, desc: "" + (ch.desc || ""), count: rows.length, sample: rows.slice(0, 3) });
        }
    } catch (eQ) {
        failReason = "" + ch.id + ": " + eQ.message;
        break;
    }
}
var out = { checks: ran, findings: findings, elapsedMs: new Date().getTime() - t0 };
if (skippedScope > 0) { out.skippedScope = skippedScope; }
if (failReason != "") {
    out.status = "nedobehlo";
    out.reason = "kontrola selhala - " + failReason;
    return out;
}
if (ran == 0) {
    out.status = "nedobehlo";
    out.reason = "zadna kontrola nebezela (scope $PKGNAMES neznamy - risk.summary bez packages)";
    return out;
}
out.status = (findings.length > 0) ? "nalez" : "ciste";
return out;
