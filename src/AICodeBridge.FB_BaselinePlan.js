// AICodeBridge.FB_BaselinePlan(Repository, req, risk, reg)
// BASELINE POLITIKA - PLAN davky (zadani v1.2 par. 4.2-4.4, 4.6/2): spoji
// konfiguraci (FB_BaselineConfig), scope (FB_BaselinePolicy), sondu
// (FB_SubtreeCount) a nejistotu (FB_RecoveryPosture) do jednoho vysledku.
// Vola FB_Main PO klasifikaci gate (mimo budgetMs gate - sonda nesmi zpusobit
// metricsIncomplete, W12) a pri potvrzenem behu ZNOVU (par. 4.6/4).
// Vraci { cfg, cfgWarnings[], scope, probes[], posture, postureReasons[],
//         needsBaseline, pureCreate, probeMs, section }.
//   needsBaseline (par. 4.4, podminka 1): updatedExisting > 0 || deleteTargets
//     > 0 || affectedDiagrams > 0 || metricsComplete === false (+ chybejici
//     metriky). POZITIVNE: zalohu nepotrebuje JEN davka s nulovymi metrikami,
//     metricsComplete === true a posture "full".
//   pureCreate: smi se davka oznacit "cisty create"? Nikdy pri nejistote ani
//     u clone_*/move_elements (objem predem neznamy, par. 4.6/2).
//   section = sekce `baseline{}` pro response (kontrakt par. 4.6/7); v teto
//     fazi decision "shadow" - FB_Main ji pri lazy baseline prepise.
// Nikdy nevyhazuje: jakakoli chyba = posture "unknown".
var t0 = new Date().getTime();
var cfg = null, cfgWarn = [];
try {
    var c = this.FB_BaselineConfig(Repository);
    cfg = c.cfg; cfgWarn = c.warnings || [];
} catch (eC) { cfg = null; }
var m = (risk && risk.metrics) ? risk.metrics : null;
var scope = null, probes = [], why = [];
try { scope = this.FB_BaselinePolicy(Repository, req, risk, cfg, reg); }
catch (eS) { scope = null; why.push("FB_BaselinePolicy selhal: " + eS.message); }
var needs = true;
if (m && m.metricsComplete === true) {
    needs = (m.updatedExisting > 0) || (m.deleteTargets > 0) || (m.affectedDiagrams > 0);
}
// scope, ktery nasel menene packages nebo nejistotu, zalohu vyzaduje take
// (gate a scope jsou dva nezavisle vypocty - rozhoduje prisnejsi)
if (scope && (scope.packages.length > 0 || scope.unknown === true)) { needs = true; }
var totalBudget = (cfg && typeof cfg.probeBudgetTotalMs == "number") ? cfg.probeBudgetTotalMs : 2000;
var probeT0 = new Date().getTime();
if (scope && needs && !scope.overLimit) {
    for (var i = 0; i < scope.packages.length; i++) {
        var left = totalBudget - (new Date().getTime() - probeT0);
        var pr = null;
        try { pr = this.FB_SubtreeCount(Repository, scope.packages[i].id, cfg, left); }
        catch (eP) { pr = { elements: 0, packages: 0, ms: 0, status: "unknown", why: "FB_SubtreeCount selhal: " + eP.message, method: "none" }; }
        pr.id = scope.packages[i].id;
        probes.push(pr);
    }
}
var probeMs = new Date().getTime() - probeT0;
var pos = { posture: "unknown", reasons: why };
try { pos = this.FB_RecoveryPosture(m, scope, probes, cfg); if (why.length > 0) { pos.reasons = why.concat(pos.reasons); } }
catch (eR) { pos = { posture: "unknown", reasons: why.concat(["FB_RecoveryPosture selhal: " + eR.message]) }; }
var pureCreate = (!needs) && pos.posture == "full" && !!m && m.metricsComplete === true
    && !!scope && scope.volumeUnknown !== true;
var pk = [];
if (scope) {
    for (var j = 0; j < scope.packages.length; j++) {
        var sp = scope.packages[j], pb = probes[j] || null;
        var row = { guid: sp.guid, name: "", path: sp.path, packageName: sp.name,
                    subtreeCount: (pb && pb.status == "ok") ? pb.elements : null,
                    probeMs: pb ? pb.ms : null, status: pb ? pb.status : "nemereno" };
        if (pb && pb.status != "ok") { row.why = pb.why; }
        if (sp.parentOutOfWhitelist === true) { row.parentOutOfWhitelist = true; }
        pk.push(row);
    }
}
var section = {
    decision: "shadow",
    reason: "shadow - nerozhoduje",
    posture: pos.posture,
    postureReasons: pos.reasons,
    needsBaseline: needs,
    packages: pk,
    subtreeMax: cfg ? cfg.subtreeMax : null,
    maxBaselineElements: cfg ? cfg.maxBaselineElements : null,
    thresholdsShadow: cfg ? (cfg.thresholdsShadow !== false) : true,
    probeMs: probeMs,
    elapsedMs: (new Date().getTime() - t0)
};
return { cfg: cfg, cfgWarnings: cfgWarn, scope: scope, probes: probes, posture: pos.posture,
         postureReasons: pos.reasons, needsBaseline: needs, pureCreate: pureCreate,
         probeMs: probeMs, section: section };
