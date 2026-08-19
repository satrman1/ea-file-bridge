// AICodeBridge.FB_ConfirmSummary(resp)
// Lidsky citelny souhrn confirm_required response pro potvrzovaci UI
// (konzole pumpy, dialog GUI fallbacku, stavove okno vratneho - I6:
// vzdy id + souhrn KONKRETNI davky). Vstup: parsovany response objekt.
// Vraci viceradkovy text. NIKDY neobsahuje plny hash ani nonce (par. 6.3)
// - jen prefix hashe pro identifikaci.
if (resp === null || typeof resp == "undefined") { return "(zadna response)"; }
var risk = resp.risk || {};
var m = risk.metrics || {};
var sm = risk.summary || {};
var lines = [];
lines.push("Davka: " + (resp.id || "?") + "   riskLevel: " + (risk.riskLevel || "?"));
if (resp.confirm && resp.confirm.hashPrefix) {
    lines.push("payloadHash (prefix): " + resp.confirm.hashPrefix + "...");
}
var cnt = [];
if (sm.ops) {
    for (var k in sm.ops) {
        if (typeof sm.ops[k] != "function") { cnt.push(sm.ops[k] + "x " + k); }
    }
}
if (cnt.length > 0) { lines.push("Operace: " + cnt.join(", ")); }
lines.push("Metriky: writeOps=" + (m.writeOps != null ? m.writeOps : "?")
    + ", deleteTargets=" + (m.deleteTargets != null ? m.deleteTargets : "?")
    + ", updatedExisting=" + (m.updatedExisting != null ? m.updatedExisting : "?")
    + ", affectedElements=" + (m.affectedElements != null ? m.affectedElements : "?")
    + ", affectedPackages=" + (m.affectedPackages != null ? m.affectedPackages : "?")
    + ", affectedDiagrams=" + (m.affectedDiagrams != null ? m.affectedDiagrams : "?"));
function listLine(label, arr) {
    if (arr && arr.length > 0) { lines.push(label + ": " + arr.join(", ")); }
}
listLine("Targety", sm.targets);
listLine("Packages", sm.packages);
listLine("Diagramy", sm.diagrams);
if (risk.riskReasons && risk.riskReasons.length > 0) {
    lines.push("Duvody (CR par. 12 - vzdy konkretni):");
    for (var i = 0; i < risk.riskReasons.length; i++) {
        lines.push("  - " + risk.riskReasons[i]);
    }
}
return lines.join("\n");
