// AICodeBridge.FB_RiskAuditTags(Repository, auditGuid, risk)
// Riskova pole na audit Artifact v #AI-LOG jako tagged values (iterace 4b,
// zadani par. 8). Plne metriky + duvody jsou v Notes (FB_RiskNote); tagy
// nesou strojove citelny vytah (limit TV ~255 znaku -> oriznuti).
// Audit nesmi shodit davku - vse best-effort.
if (risk === null || typeof risk == "undefined") { return ""; }
if (auditGuid === null || typeof auditGuid == "undefined" || ("" + auditGuid) == "") { return ""; }
try {
    var el = Repository.GetElementByGuid("" + auditGuid);
    if (el == null) { return ""; }
    this.SetTag(el, "ai.risk.level", "" + risk.riskLevel);
    if (risk.riskReasons && risk.riskReasons.length > 0) {
        this.SetTag(el, "ai.risk.reasons", ("" + risk.riskReasons.join("; ")).substring(0, 250));
    }
    var m = risk.metrics;
    if (m != null) {
        this.SetTag(el, "ai.risk.metrics",
            ("writeOps=" + m.writeOps + ";createOps=" + m.createOps
             + ";updatedExisting=" + m.updatedExisting + ";deleteTargets=" + m.deleteTargets
             + ";affectedElements=" + m.affectedElements + ";affectedPackages=" + m.affectedPackages
             + ";affectedDiagrams=" + m.affectedDiagrams + ";moveOps=" + m.moveOps
             + ";complete=" + (m.metricsComplete ? "1" : "0")).substring(0, 250));
    }
    if (risk.payloadHash) { this.SetTag(el, "ai.risk.hash", ("" + risk.payloadHash).substring(0, 64)); }
} catch (eT) { }
return "";
