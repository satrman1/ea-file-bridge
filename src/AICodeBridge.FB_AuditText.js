// AICodeBridge.FB_AuditText(kind, resp, risk, baseline, qc, extra)
// VETY PRO CLOVEKA DO AUDITU (vzor FB-UI-06, Z261004b-12): auditor hleda
// "co, s jakym vysledkem, kdo potvrdil, jaka zaloha, co rekla kontrola
// kvality". Tyto vety jdou do Notes auditniho Artifactu NAD strojovy radek
// (FB_RiskNote), ktery zustava doslova beze zmeny (tag result = jeho
// prvnich 250 znaku, harness to hlida). Vraci text (radky oddelene \n);
// pri jakekoli chybe vraci "" - audit nesmi spadnout kvuli vetam.
//   kind  = "final" (konecny audit po provedeni) | kod odmitnuti:
//           E_BLACKLIST a dalsi kody predbezne kontroly, E_ADDIN_ACCESS,
//           E_RISK_BLOCKED, E_NO_BASELINE, E_RISK_REJECTED, E_RISK_INTEGRITY
//   resp  = odpoved davky (status, results[], message) - smi byt null
//   risk  = resp.risk (riskLevel, confirm, reasonItems, riskReasons) - smi byt null
//   baseline = resp.baseline (decision, reason, packages[]) - smi byt null
//   qc    = resp.qc (FB_QcRun) - smi byt null
//   extra = { id, total, ok, err, writes, message } - cisla davky; smi byt null
// Duvody potvrzeni = vety z FB_ReasonText (ne kody); kody zustavaji ve
// strojovem radku a v tagu ai.risk.codes. Texty bez diakritiky (spike S1).
var lines = [];
function pl(n, one, few, many) { return n + " " + (n == 1 ? one : ((n >= 2 && n <= 4) ? few : many)); }
function ops(n) { return pl(n, "operace", "operace", "operaci"); }
function chanText(ch) {
    switch ("" + ch) {
        case "pumpa": return "okne pumpy";
        case "gui": return "dialogu EA";
        case "okno": return "okne bridge";
        default: return "kanalu '" + ch + "'";
    }
}
try {
    var x = extra || {};
    var id = "" + ((x.id) || (resp && resp.id) || "?");
    var total = (typeof x.total == "number") ? x.total : ((resp && resp.results) ? resp.results.length : 0);
    var okc = (typeof x.ok == "number") ? x.ok : 0;
    var errc = (typeof x.err == "number") ? x.err : 0;
    var writes = (typeof x.writes == "number") ? x.writes : -1;
    var k = "" + (kind || "final");
    var nothing = " Nic se nezapsalo.";
    // --- 1. vysledek davky ---
    switch (k) {
        case "final":
            var st = "" + ((resp && resp.status) || "?");
            if (st == "done") {
                lines.push("Davka " + id + " skoncila USPESNE: " + okc + " z " + ops(total) + " provedeno.");
            } else {
                lines.push("Davka " + id + " skoncila CHYBOU: " + okc + " z " + ops(total) + " provedeno, " + pl(errc, "operace skoncila", "operace skoncily", "operaci skoncilo") + " chybou"
                    + (okc == 0 ? "; v modelu se nic nezmenilo (nebo jen castecne - viz polozky nize)." : "."));
            }
            break;
        case "E_BLACKLIST":
            lines.push("Davka " + id + " byla ODMITNUTA pred zapisem: cil lezi v chranene casti modelu (" + ops(total) + ")." + nothing);
            break;
        case "E_ADDIN_ACCESS":
            lines.push("Davka " + id + " byla ODMITNUTA: uzivatel nema povolene zapisove funkce bridge (" + ops(total) + ")." + nothing);
            break;
        case "E_RISK_BLOCKED":
            lines.push("Davka " + id + " byla ZABLOKOVANA politikou rizik (" + ops(total) + "); potvrzeni cloveka tu nepomuze." + nothing);
            break;
        case "E_NO_BASELINE":
            lines.push("Davka " + id + " byla ODMITNUTA: zalohu pred zapisem se nepodarilo poridit (" + ops(total) + ")." + nothing);
            break;
        case "E_RISK_REJECTED":
            lines.push("Davku " + id + " ZAMITL uzivatel" + (risk && risk.confirm && risk.confirm.channel ? " v " + chanText(risk.confirm.channel) : "") + "." + nothing);
            break;
        case "E_RISK_INTEGRITY":
            lines.push("Davka " + id + " byla ODMITNUTA: obsah davky se zmenil mezi oknem a potvrzenim, potvrzeni proto neplati." + nothing);
            break;
        default:
            lines.push("Davka " + id + " byla ODMITNUTA predbeznou kontrolou (" + k + ", " + ops(total) + ")." + nothing);
    }
    if (x.message && k != "final" && k != "E_RISK_REJECTED") {
        var msg = ("" + x.message).replace(/\s+/g, " ").replace(/\s+$/, "");
        if (msg.length > 300) { msg = msg.substring(0, 297) + "..."; }
        if (msg != "") { lines.push("Duvod: " + msg); }
    }
    // --- 2. uroven rizika + potvrzeni ---
    if (risk === null || typeof risk == "undefined") {
        if (writes == 0) { lines.push("Uroven rizika: davka jen cte, nic nezapisuje."); }
        else { lines.push("Uroven rizika: nehodnoceno (kontrola rizika nebezela)."); }
    } else {
        var lvl = "" + risk.riskLevel;
        var lvlText = (lvl == "LOW") ? "bez potvrzeni" : ((lvl == "ELEVATED") ? "vyzadovala potvrzeni" : ((lvl == "BLOCKED") ? "blokovano" : lvl));
        var c = risk.confirm || null;
        var conf = "";
        if (c && c.required) {
            var when = c.timestamp ? " " + c.timestamp : "";
            var where = c.channel ? " v " + chanText(c.channel) : "";
            if (c.expired) { conf = " Potvrzeni se nedockala - cekajici davka vyprsela" + when + "."; }
            else if (c.confirmedByUser) {
                conf = " Potvrdil uzivatel" + where + when + ".";
                if (c.integrityFailed) { conf += " Potvrzeni neplati: obsah davky se mezitim zmenil."; }
                if (c.reclassifiedToBlocked) { conf += " Po potvrzeni se davka ukazala jako blokovana."; }
            } else { conf = " Zamitl uzivatel" + where + when + "."; }
        }
        lines.push("Uroven rizika: " + lvlText + "." + conf);
        // --- 3. proc potvrzeni (vety, ne kody) ---
        var why = [];
        var items = risk.reasonItems || [];
        for (var ri = 0; ri < items.length; ri++) {
            var tx = "";
            try { tx = "" + this.FB_ReasonText(items[ri]); } catch (eRt) { tx = "" + ((items[ri] && items[ri].text) || ""); }
            if (tx != "") { why.push(tx); }
        }
        if (why.length == 0 && risk.riskReasons && risk.riskReasons.length > 0) {
            for (var rr = 0; rr < risk.riskReasons.length; rr++) { why.push("" + risk.riskReasons[rr]); }
        }
        if (why.length > 0 && lvl != "LOW") { lines.push("Proc potvrzeni: " + why.join(" ")); }
    }
    // --- 4. zaloha ---
    var bl = (baseline === null || typeof baseline == "undefined") ? null : baseline;
    if (k != "final") {
        if (bl && ("" + bl.decision) == "failed") { lines.push("Zaloha: nepodarilo se ji poridit" + (bl.reason ? " (" + bl.reason + ")" : "") + "."); }
        else { lines.push("Zaloha: neporizovala se (nic se nezapsalo)."); }
    } else if (writes == 0) {
        // cteci davka: o zaloze nema smysl mluvit
    } else if (bl == null) {
        lines.push("Zaloha: neporizovala se.");
    } else {
        var dec = "" + (bl.decision || "");
        var pk = bl.packages || [], names = [];
        for (var bi = 0; bi < pk.length; bi++) {
            if (pk[bi] && pk[bi].name) { names.push("'" + pk[bi].name + "' nad balickem " + (pk[bi].path || pk[bi].guid || "?") + (pk[bi].result == "reused" ? " (pouzita cerstva zaloha z teto session)" : "")); }
        }
        if (names.length > 0) { lines.push("Zaloha: " + names.join("; ") + "."); }
        else if (dec == "none") { lines.push("Zaloha: neporizovala se" + (bl.reason ? " (" + bl.reason + ")" : "") + "."); }
        else if (dec == "skipped") { lines.push("Zaloha: automaticka se neporizovala, davka je nad prahem - spoleha na rucni zalohu uzivatele" + (bl.reason ? " (" + bl.reason + ")" : "") + "."); }
        else if (dec == "failed") { lines.push("Zaloha: nepodarilo se ji poridit" + (bl.reason ? " (" + bl.reason + ")" : "") + "."); }
        else if (dec == "planned") { lines.push("Zaloha: byla naplanovana, ale k zapisu nedoslo" + (bl.reason ? " (" + bl.reason + ")" : "") + "."); }
        else { lines.push("Zaloha: " + (dec != "" ? dec : "neporizovala se") + (bl.reason ? " (" + bl.reason + ")" : "") + "."); }
    }
    // --- 5. kontrola kvality ---
    if (k == "final" && writes != 0) {
        if (qc !== null && typeof qc != "undefined") {
            var qt = null;
            try { qt = this.FB_QcText(qc); } catch (eQt) { qt = null; }
            if (qt && qt.line) { lines.push(qt.line); }
        } else {
            lines.push("Kontrola kvality: neprobehla (nic se nezapsalo).");
        }
    }
} catch (eAll) { return ""; }
return lines.join("\n");
