// AICodeBridge.FB_RiskNote(risk, baseline)
// Textovy souhrn riskovych poli pro audit Notes / Log (iterace 4b).
// risk == null (ciste ctena davka / gate nebezel) -> prazdny retezec.
// Parametr baseline pribyl az po v0.14 (Baseline politika 20. 9.). Cte se
// VYHRADNE pres typeof (FB-PU-01, zive 2026-10-10: bootstrap do te doby
// parametry existujici operace nesrovnal -> EA runtime metodu kompiloval
// bez nej a kazdy zapis spadl "Objekt baseline neni definovan" AZ PO
// provedeni, bez auditu). Pravidlo PROTOKOL-EAFB kap. 11: novy parametr
// existujici operace se cte jen pres typeof.
var bl = (typeof baseline != "undefined") ? baseline : null;
if (risk === null || typeof risk == "undefined") { return ""; }
var m = risk.metrics || {};
var s = " | risk=" + risk.riskLevel
    + " writeOps=" + (typeof m.writeOps == "number" ? m.writeOps : "?")
    + " createOps=" + (typeof m.createOps == "number" ? m.createOps : "?")
    + " updatedExisting=" + (typeof m.updatedExisting == "number" ? m.updatedExisting : "?")
    + " deleteTargets=" + (typeof m.deleteTargets == "number" ? m.deleteTargets : "?")
    + " affectedElements=" + (typeof m.affectedElements == "number" ? m.affectedElements : "?")
    + " affectedPackages=" + (typeof m.affectedPackages == "number" ? m.affectedPackages : "?")
    + " affectedDiagrams=" + (typeof m.affectedDiagrams == "number" ? m.affectedDiagrams : "?")
    + " moveOps=" + (typeof m.moveOps == "number" ? m.moveOps : 0)
    + " policyValid=" + (risk.policyValid ? "true" : "false")
    + (typeof risk.elapsedMs == "number" ? " gateMs=" + risk.elapsedMs : "")
    + (typeof risk.hashMs == "number" ? " hashMs=" + risk.hashMs : "")
    + (risk.payloadHash ? " payloadHash=" + risk.payloadHash : "");
// Audit potvrzeni (iterace 4b V2, zadani par. 8): confirmationRequired,
// confirmedByUser + timestamp, confirmChannel; integrityFailed u E_RISK_INTEGRITY.
if (risk.confirm) {
    s += " | confirmationRequired=" + (risk.confirm.required ? "true" : "false");
    if (risk.confirm.required) {
        s += " confirmedByUser=" + (risk.confirm.confirmedByUser ? "true" : "false");
        if (risk.confirm.channel) { s += " confirmChannel=" + risk.confirm.channel; }
        if (risk.confirm.timestamp) { s += " confirmedAt=" + risk.confirm.timestamp; }
        if (risk.confirm.integrityFailed) { s += " integrityFailed=true"; }
    }
}
if (risk.riskReasons && risk.riskReasons.length > 0) {
    s += " | duvody: " + risk.riskReasons.join("; ");
}
// Baseline politika par. 4.6/7: radek o zaloze (restore manifest v Notes auditu)
if (bl) {
    s += " | baseline=" + (bl.decision || "?") + (bl.reason ? " (" + bl.reason + ")" : "");
    var bp = bl.packages || [], bn = [];
    for (var bi = 0; bi < bp.length; bi++) {
        if (bp[bi].name) { bn.push((bp[bi].path || bp[bi].guid) + " -> " + bp[bi].name + " [" + (bp[bi].result || "?") + "]"); }
    }
    if (bn.length > 0) { s += ": " + bn.join(", "); }
    if (bl.journal && bl.journal.manifestRef) { s += " | journal=" + bl.journal.manifestRef + " (" + bl.journal.targets + " cilu)"; }
}
return s;
