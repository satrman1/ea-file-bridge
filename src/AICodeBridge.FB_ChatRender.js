// AICodeBridge.FB_ChatRender(resp)
// CHAT VERZE response (zadani iterace 4 par. 3.3, W10, I3) - text pro
// schranku/Copilot. Vstup: parsovany response objekt. Pravidla:
//  - NIKDY plny payloadHash ani nonce (jen hashPrefix, par. 6.3/B1);
//  - NIKDY tichy orez (W10): pri preteceni rozpoctu ukazatel na res soubor;
//  - chat ACK NENI jediny zaznam (I3) - GUIDy, aiLogGuid, plne rows zije
//    v res-*.json; chat je jen vycuc;
//  - rowCount 0 se NIKDY neinterpretuje jako "data neexistuji" (lekce T4-3c
//    falesne OK po odkliku modalu) - jen "dotaz nic nevratil";
//  - QC tri stavy ODDELENE od zapisu (par. 3.4/W6): ciste | NALEZ | nedobehlo.
var self = this;
var BUDGET = 1500;
var QBUDGET = 700;
if (resp === null || typeof resp == "undefined") { return "EAFB: response nedostupna."; }
var st = "" + resp.status;
var id = "" + (resp.id || "?");
var code = "" + (resp.code || "");
var results = resp.results || [];
var ops = results.length, okc = 0, errIdx = -1, errRes = null;
for (var i = 0; i < results.length; i++) {
    var r0 = results[i] || {};
    if (("" + r0.status) == "ok") { okc++; }
    if (("" + r0.status) == "error" && errIdx < 0) { errIdx = i; errRes = r0; }
}
function clip(s, n) {
    s = "" + s;
    return (s.length > n) ? (s.substring(0, n) + "...") : s;
}
function qcLine() {
    var qc = resp.qc;
    if (!qc) { return ""; }
    var s = "" + qc.status;
    if (s == "ciste") { return " | QC ciste (" + qc.checks + " kontrol)"; }
    if (s == "nalez") {
        var ids = [];
        var fnd = qc.findings || [];
        for (var q = 0; q < fnd.length; q++) { ids.push(fnd[q].id + " (" + fnd[q].count + "x)"); }
        return " | QC NALEZ: " + ids.join(", ") + " - detail v res souboru (zapis PROBEHL, QC neni chyba zapisu)";
    }
    // benigni: nebylo co kontrolovat (zadna alarmujici formulace)
    if (s == "bez_kontrol") { return " | QC: bez kontrol pro tuto zmenu"; }
    // skutecne selhani QC behu (SQL apod.) - zapis tim NENI dotcen
    return " | QC neproveden (chyba kontroly: " + clip(qc.reason || "?", 140) + ") - zapis tim NENI dotcen";
}
function warnLine() {
    var w = resp.warnings;
    if (w && w.length > 0) { return "\nWarning: " + clip(w.join("; "), 200); }
    return "";
}
var out = "";
if (st == "done") {
    out = "EAFB OK " + id + ": " + okc + "/" + ops + " ops" + qcLine();
    // kompaktni vycuc query vysledku (W10: rozpocet + ukazatel, zadny tichy cut)
    for (var j = 0; j < results.length; j++) {
        var rr = results[j] || {};
        if (("" + rr.op) != "query" || ("" + rr.status) != "ok") { continue; }
        var rc = (typeof rr.rowCount == "number") ? rr.rowCount : -1;
        if (rc == 0) {
            out += "\nop[" + j + "] query: 0 radku - pozor, znamena jen 'dotaz nic nevratil', ne 'data neexistuji' (T4-3c).";
            continue;
        }
        var rows = rr.rows || [];
        var shown = 0, buf = [];
        for (var k = 0; k < rows.length; k++) {
            var rj = "";
            try { rj = "" + self.FB_JsonStringify(rows[k]); } catch (eJ) { rj = "(radek nejde serializovat)"; }
            if ((buf.join("; ").length + rj.length) > QBUDGET) { break; }
            buf.push(rj);
            shown++;
        }
        out += "\nop[" + j + "] query: " + rc + " radku";
        if (buf.length > 0) { out += ": " + buf.join("; "); }
        if (shown < rc) { out += " (zobrazeno prvnich " + shown + " - plna odpoved v res-" + id + ".json)"; }
    }
    out += warnLine();
}
else if (st == "confirm_required") {
    var hp = (resp.confirm && resp.confirm.hashPrefix) ? resp.confirm.hashPrefix : "";
    var reasons = (resp.risk && resp.risk.riskReasons) ? resp.risk.riskReasons.join("; ") : "";
    out = "EAFB CEKA NA POTVRZENI " + id + " (ELEVATED, hash " + hp + "...): zadny zapis neprobehl, davka ceka v requests\\pending\\."
        + " Potvrzeni = lokalni ukon cloveka (stavove okno vratneho / popup pumpy / GUI fallback), nikdy z chatu."
        + " Duvody: " + clip(reasons, 400);
}
else if (code == "E_RISK_BLOCKED") {
    out = "EAFB BLOKOVANO " + id + ": Risk Gate BLOCKED - nic neprovedeno, davka v rejected\\. "
        + clip((resp.risk && resp.risk.riskReasons) ? resp.risk.riskReasons.join("; ") : (resp.message || ""), 400)
        + " Zadny jednoklikovy override (cesta ven = zmena FB_RiskPolicy nebo rucni prace v EA).";
}
else if (code == "E_RISK_REJECTED" || st == "rejected") {
    out = "EAFB ZAMITNUTO " + id + ": davka zamitnuta clovekem v potvrzovacim dialogu - nic neprovedeno, soubor v rejected\\.";
}
else if (code == "E_RISK_INTEGRITY") {
    out = "EAFB INTEGRITA " + id + ": obsah davky se zmenil mezi klasifikaci a potvrzenim - nic neprovedeno (bezpecnostni udalost, res soubor + audit). Novou verzi posli jako novou davku.";
}
else if (code == "E_RISK_CONFIRM") {
    out = "EAFB ODMITNUTO " + id + " (E_RISK_CONFIRM): " + clip(resp.message || "potvrzovaci pole v obsahu davky / neplatne potvrzeni", 300);
}
else if (errIdx >= 0) {
    out = "EAFB CHYBA " + id + " v op[" + errIdx + "] (" + (errRes.op || "?") + "): " + (errRes.code || "")
        + " " + clip(errRes.message || "", 300)
        + " - dalsi ops skipped (" + (ops - errIdx - 1) + "), drivejsi zapisy PLATI (rollback neexistuje)."
        + " Oprava dle par. 5a: opravna davka adresujici GUIDy z res souboru, zadne slepe preposlani."
        + qcLine();
}
else {
    out = "EAFB CHYBA " + id + ": " + code + " " + clip(resp.message || "", 300);
}
if (resp.results && resp.results.length > 0 && st != "done" && errIdx < 0 && st != "confirm_required") {
    // rejected/blocked: results jsou skipped/pending - nic dalsiho netreba
}
if (out.length > BUDGET) {
    // W10: nikdy tichy cut - deterministicky orez s ukazatelem
    out = out.substring(0, BUDGET - 90) + "\n(zkraceno - plna odpoved v res-" + id + ".json)";
}
return out;
