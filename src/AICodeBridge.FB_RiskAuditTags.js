// AICodeBridge.FB_RiskAuditTags(Repository, auditGuid, risk, baseline)
// Riskova pole na audit Artifact v #AI-LOG jako tagged values (iterace 4b,
// zadani par. 8). Plne metriky + duvody jsou v Notes (FB_RiskNote); tagy
// nesou strojove citelny vytah (limit TV ~255 znaku -> oriznuti).
// Audit nesmi shodit davku - vse best-effort.
// Parametr baseline pribyl az po v0.14 - cte se jen pres typeof (FB-PU-01,
// PROTOKOL-EAFB kap. 11); bez nej by se uvnitr try jen tise ztratil tag
// ai.baseline (restore manifest), coz je presne to, co nema byt tiche.
var bl = (typeof baseline != "undefined") ? baseline : null;
if (risk === null || typeof risk == "undefined") { return ""; }
if (auditGuid === null || typeof auditGuid == "undefined" || ("" + auditGuid) == "") { return ""; }
try {
    var el = Repository.GetElementByGuid("" + auditGuid);
    if (el == null) { return ""; }
    this.SetTag(el, "ai.risk.level", "" + risk.riskLevel);
    if (risk.riskReasons && risk.riskReasons.length > 0) {
        this.SetTag(el, "ai.risk.reasons", ("" + risk.riskReasons.join("; ")).substring(0, 250));
    }
    // v0.19 (KONCEPCE pravidlo 9, Z261004b-6): STABILNI KODY duvodu - kalibrace
    // oken seskupuje podle kodu, ne podle textu (texty se smi menit, kody ne)
    if (risk.reasonItems && risk.reasonItems.length > 0) {
        var codes = [], seenC = {};
        for (var rc = 0; rc < risk.reasonItems.length; rc++) {
            var cc = "" + ((risk.reasonItems[rc] && risk.reasonItems[rc].code) || "");
            if (cc != "" && seenC[cc] != 1) { seenC[cc] = 1; codes.push(cc); }
        }
        if (codes.length > 0) { this.SetTag(el, "ai.risk.codes", codes.join(";").substring(0, 250)); }
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
    // Audit potvrzeni (V2, zadani par. 8) - strojove citelny vytah
    if (risk.confirm) {
        this.SetTag(el, "ai.risk.confirm",
            ("required=" + (risk.confirm.required ? "1" : "0")
             + ";confirmedByUser=" + (risk.confirm.confirmedByUser ? "1" : "0")
             + (risk.confirm.channel ? ";channel=" + risk.confirm.channel : "")
             + (risk.confirm.timestamp ? ";at=" + risk.confirm.timestamp : "")
             + (risk.confirm.integrityFailed ? ";integrityFailed=1" : "")).substring(0, 250));
    }
    // Baseline politika par. 4.6/7 (W11): restore manifest pro par. 12f/T3 -
    // res-*.json lezi v per-user slozce, tag na audit Artifactu prezije.
    // Tvar: pkgGuid=...;name=...;decision=... per package, oddelovac |
    if (bl) {
        var parts = [], pk = bl.packages || [];
        for (var bi = 0; bi < pk.length; bi++) {
            parts.push("pkgGuid=" + (pk[bi].guid || "") + ";name=" + (pk[bi].name || "") + ";decision=" + (pk[bi].result || bl.decision || ""));
        }
        if (parts.length == 0) { parts.push("decision=" + (bl.decision || "") + ";reason=" + (bl.reason || "")); }
        var full = parts.join("|");
        // limit TV ~255: delsi vycet se deli do ai.baseline, ai.baseline.2, ...
        var chunkNo = 1, cur = "";
        for (var ci = 0; ci < parts.length; ci++) {
            var add = (cur == "" ? "" : "|") + parts[ci];
            if (cur != "" && (cur.length + add.length) > 250) {
                this.SetTag(el, (chunkNo == 1 ? "ai.baseline" : "ai.baseline." + chunkNo), cur);
                chunkNo++; cur = parts[ci];
            } else { cur += add; }
        }
        if (cur != "") { this.SetTag(el, (chunkNo == 1 ? "ai.baseline" : "ai.baseline." + chunkNo), cur.substring(0, 250)); }
    }
} catch (eT) { }
return "";
