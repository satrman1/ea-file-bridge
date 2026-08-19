// AICodeBridge.FB_RiskNote(risk)
// Textovy souhrn riskovych poli pro audit Notes / Log (iterace 4b).
// risk == null (ciste ctena davka / gate nebezel) -> prazdny retezec.
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
return s;
