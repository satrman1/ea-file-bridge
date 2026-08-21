// AICodeBridge.FB_ChatRender(resp)
// CHAT VERZE response (zadani iterace 4 par. 3.3, W10, I3) - text pro
// schranku/Copilot. Vstup: parsovany response objekt. Pravidla:
//  - NIKDY plny payloadHash ani nonce (jen hashPrefix, par. 6.3/B1);
//  - NIKDY tichy orez (W10): pri preteceni rozpoctu ukazatel na res soubor;
//  - chat ACK NENI jediny zaznam (I3) - GUIDy, aiLogGuid, plne rows zije
//    v res-*.json; chat je jen vycuc;
//  - rowCount 0 se NIKDY neinterpretuje jako "data neexistuji" (lekce T4-3c
//    falesne OK po odkliku modalu) - jen "dotaz nic nevratil";
//  - QC tri stavy ODDELENE od zapisu (par. 3.4/W6): ciste | NALEZ | nedobehlo;
//  - WARNINGS (nalez POC N-7, 2026-08-21): op-level warnings (results[i].warnings)
//    i davkove (resp.warnings) se propisuji DO PRVNIHO RADKU ACK jako pocet +
//    prvni warning zkracene, plny vycet zustava v res-<id>.json. Duvod: warning
//    znamena "zapis probehl, ale CAST ZAMERU se tise nepropsala" (napr. join
//    neresolvovan) - drive ho chat verze nenesla vubec a agent ho nemel jak
//    videt. Pocet je v prvni rade prave proto, aby prezil i orez rozpoctem.
//    Bezwarningova davka ma ACK BEZE ZMENY (zadny prazdny segment).
var self = this;
var BUDGET = 1500;
var QBUDGET = 700;
var WBUDGET = 500;
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
// sber warningu: davkove (resp.warnings, napr. migrace W6) + op-level
// (results[i].warnings) se zdrojovou znackou, aby slo warning priradit k operaci
function collectWarns() {
    var acc = [];
    var bw = resp.warnings || [];
    for (var a = 0; a < bw.length; a++) { acc.push({ src: "davka", text: "" + bw[a] }); }
    for (var b = 0; b < results.length; b++) {
        var rb = results[b] || {};
        var ow = rb.warnings || [];
        for (var c = 0; c < ow.length; c++) {
            acc.push({ src: "op[" + b + "] " + (rb.op || "?"), text: "" + ow[c] });
        }
    }
    return acc;
}
// segment do PRVNIHO radku ACK - pocet prezije i orez rozpoctem (W10)
function warnHead(ws) {
    if (!ws || ws.length === 0) { return ""; }
    var label = (ws.length == 1) ? "1 WARNING: " : (ws.length + " WARNINGS: ");
    return " | " + label + clip(ws[0].text, 140);
}
// vypis warningu s rozpoctem a ukazatelem na res soubor (W10: zadny tichy cut)
function warnBlock(ws) {
    if (!ws || ws.length === 0) { return ""; }
    var lines = [], used = 0, shown = 0;
    for (var i = 0; i < ws.length; i++) {
        var ln = ws[i].src + ": " + clip(ws[i].text, 200);
        if (used + ln.length > WBUDGET) { break; }
        lines.push(ln); used += ln.length; shown++;
    }
    var s = "\nWarnings (zapis PROBEHL, cast zameru se ale nepropsala - resit OPRAVNOU davkou, ne preposlanim):";
    for (var j = 0; j < lines.length; j++) { s += "\n- " + lines[j]; }
    if (shown < ws.length) { s += "\n- (dalsich " + (ws.length - shown) + " - plny vycet v res-" + id + ".json)"; }
    return s;
}
var warns = collectWarns();
var out = "";
if (st == "done") {
    out = "EAFB OK " + id + ": " + okc + "/" + ops + " ops" + warnHead(warns) + qcLine() + warnBlock(warns);
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
        + warnHead(warns) + qcLine() + warnBlock(warns);
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
