// AICodeBridge.FB_RecoveryPosture(metrics, scope, probes, cfg)
// BASELINE POLITIKA - JEDINA funkce nejistoty (zadani v1.2 par. 4.3, W12):
//   "full"    package zalohu LZE poridit nad vsemi dotcenymi packages
//   "none"    package zalohu NELZE poridit (vedome: prilis mnoho packages,
//             nebo - az po kalibraci - podstrom nad prahem)
//   "unknown" nevime: davka se chova jako "nad prahem", nikdy "pod prahem"
// Vraci { posture, reasons[] }. unknown vznika z KTEREHOKOLI zdroje:
//  (1) metriky gate nespocitany (metrics null / metricsComplete === false),
//  (2) vycerpany rozpocet sondy, (3) selhani dotazu sondy, (4) nulovy
//  vysledek nad existujici package [2-4 = probe.status "unknown"],
//  (5) scope nelze odvodit (scope.unknown - $N, update konektoru dle guid,
//      operace bez polozky SCOPE ...).
// metrics = risk.metrics z FB_RiskGate; scope = vystup FB_BaselinePolicy;
// probes  = [{ id, status, elements }] z FB_SubtreeCount (per package scope).
// SHADOW (dispozice 2): subtreeMax / maxBaselineElements rozhoduji AZ kdyz
// cfg.thresholdsShadow === false; do te doby jen maxBaselinePackages.
var reasons = [];
var unknown = false, none = false;
if (!metrics || metrics.metricsComplete === false) { unknown = true; reasons.push("metriky nespoctany"); }
if (!scope) { unknown = true; reasons.push("scope nespocitan"); }
else {
    if (scope.unknown === true) { unknown = true; reasons.push("velikost neznama (scope: " + (scope.unknownWhy && scope.unknownWhy.length > 0 ? scope.unknownWhy[0] : "?") + ")"); }
    if (scope.overLimit === true) { none = true; reasons.push("dotcenych packages " + scope.packages.length + " > maxBaselinePackages " + scope.maxBaselinePackages); }
}
var sum = 0, i;
var lst = probes || [];
for (i = 0; i < lst.length; i++) {
    var p = lst[i] || {};
    if (p.status != "ok") { unknown = true; reasons.push("velikost neznama (sonda: " + (p.why || "?") + ")"); }
    else { sum += (typeof p.elements == "number" ? p.elements : 0); }
}
if (cfg && cfg.thresholdsShadow === false) {
    for (i = 0; i < lst.length; i++) {
        if (lst[i] && lst[i].status == "ok" && typeof cfg.subtreeMax == "number" && lst[i].elements > cfg.subtreeMax) {
            none = true; reasons.push("nad prahem (podstrom " + lst[i].elements + " > subtreeMax " + cfg.subtreeMax + ")");
        }
    }
    if (typeof cfg.maxBaselineElements == "number" && sum > cfg.maxBaselineElements) {
        none = true; reasons.push("nad prahem (soucet " + sum + " > maxBaselineElements " + cfg.maxBaselineElements + ")");
    }
}
// "none" je vedome rozhodnuti a ma prednost pred "unknown" jen v textu -
// chovani obou je stejne (par. 4.4 radek 3/4); poradi: none > unknown > full
return { posture: (none ? "none" : (unknown ? "unknown" : "full")), reasons: reasons, sumElements: sum };
