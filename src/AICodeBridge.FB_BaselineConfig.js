// AICodeBridge.FB_BaselineConfig(Repository)
// BASELINE POLITIKA - konfigurace (zadani Baseline politika v1.2 par. 5).
// JEDINE misto, odkud ostatni moduly berou konfiguraci baseline politiky
// (FB_SessionToken, FB_OpBaselineCreate, FB_RiskGate, pozdeji FB_BaselinePolicy,
// FB_SubtreeCount, FB_AutoBaseline, FB_BaselineCleanup). Zdroj = sekce
// `baseline` polozky FB_RiskPolicy pro pripojeny repozitar (chranena
// konfigurace dle 4b par. 5 - FB_RISKPOLICY je v mape chranenych jmen gate).
//
// Vraci { cfg, valid, present, warnings[], why }:
//   cfg      uplna sada klicu (defaulty + hodnoty ze sekce); VZDY pouzitelna
//   present  sekce `baseline` v polozce repa existuje
//   valid    false = sekce je PRITOMNA, ale nekonzistentni
//   warnings texty pro response.warnings (PROTOKOL par. 3a)
//   why      duvod nevalidity (prazdny retezec, kdyz valid)
//
// FAIL-CLOSED s rozlisenim (podminka 11 / W14):
//  - CHYBEJICI sekce (i repo bez polozky politiky) = VALIDNI: bezpecne
//    defaulty (sessionBaseline "off", cleanup.mode "report",
//    requireRecoveryForUpdates false) + warning. Driv nasazena politika bez
//    sekce NESMI spadnout do ELEVATED (T6-31).
//  - PRITOMNA, ale nekonzistentni sekce = NEVALIDNI -> FB_RiskGate davku
//    eskaluje na ELEVATED. cfg se v tom pripade vraci z DEFAULTU (vadne
//    hodnoty se nepouziji nikde).
// Nikdy nevyhazuje vyjimku (chyba cteni politiky = chybejici sekce).
var DEF = {
    subtreeMax: 5000,              // shadow - jen meri a vykazuje (dispozice 2)
    maxBaselineElements: 10000,    // shadow
    maxBaselinePackages: 5,
    probeBudgetMs: 500,
    probeBudgetTotalMs: 2000,
    useCte: false,
    freshWithinMin: 15,
    sessionMaxHours: 12,
    requireRecoveryForUpdates: false,
    sessionBaseline: "off",        // bezpecny default pri chybejici sekci
    autoPrefix: "FB-AUTO ",
    cleanupEveryHours: 24,
    cleanup: { mode: "report", keepLastK: 3, maxAgeDays: 14,
               maxDeletesPerRun: 20, maxDeletesAnomaly: 200,
               requireWriteGroup: true }
};
function copyDef() {
    var o = {}, k;
    for (k in DEF) { if (k != "cleanup") { o[k] = DEF[k]; } }
    o.cleanup = {};
    for (k in DEF.cleanup) { o.cleanup[k] = DEF.cleanup[k]; }
    return o;
}
function isNum(v) { return typeof v == "number" && isFinite(v); }
function has(o, k) { return o !== null && typeof o == "object" && typeof o[k] != "undefined"; }

var sec = null, found = false;
try {
    var pa = this.FB_RiskPolicy();
    var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
    for (var i = 0; i < pa.length; i++) {
        if (rid.indexOf(("" + pa[i].repo).toUpperCase()) >= 0) {
            found = true;
            if (has(pa[i], "baseline") && pa[i].baseline !== null) { sec = pa[i].baseline; }
            break;
        }
    }
} catch (ePol) { sec = null; }

if (sec === null) {
    return { cfg: copyDef(), valid: true, present: false, why: "",
        warnings: ["Baseline politika: " + (found ? "polozka FB_RiskPolicy nema sekci 'baseline'" : "repozitar nema polozku ve FB_RiskPolicy")
            + " - pouzity bezpecne defaulty (sessionBaseline off, uklid jen report). Doplneni sekce = zmena FB_RiskPolicy (deploy_src / rucne v EA)."] };
}

// --- validace PRITOMNE sekce ---
var bad = [];
if (typeof sec != "object") { bad.push("sekce baseline neni objekt"); sec = {}; }
var NUMS = ["subtreeMax", "maxBaselineElements", "maxBaselinePackages", "probeBudgetMs",
            "probeBudgetTotalMs", "freshWithinMin", "sessionMaxHours", "cleanupEveryHours"];
var n;
for (n = 0; n < NUMS.length; n++) {
    if (has(sec, NUMS[n]) && (!isNum(sec[NUMS[n]]) || sec[NUMS[n]] < 0)) { bad.push(NUMS[n] + " neni nezaporne cislo"); }
}
if (has(sec, "maxBaselinePackages") && isNum(sec.maxBaselinePackages) && sec.maxBaselinePackages < 1) { bad.push("maxBaselinePackages < 1"); }
if (has(sec, "sessionMaxHours") && isNum(sec.sessionMaxHours) && sec.sessionMaxHours <= 0) { bad.push("sessionMaxHours <= 0"); }
if (has(sec, "useCte") && typeof sec.useCte != "boolean") { bad.push("useCte neni boolean"); }
if (has(sec, "requireRecoveryForUpdates") && typeof sec.requireRecoveryForUpdates != "boolean") { bad.push("requireRecoveryForUpdates neni boolean"); }
if (has(sec, "sessionBaseline") && sec.sessionBaseline != "auto" && sec.sessionBaseline != "off") { bad.push("sessionBaseline musi byt 'auto' nebo 'off'"); }
if (has(sec, "autoPrefix")) {
    var ap = sec.autoPrefix;
    // prefix MUSI koncit mezerou (celotvarovy vzor jmena, par. 6.1) a nesmi
    // byt trivialni - jinak by rezervace prefixu odmitala bezna jmena
    if (typeof ap != "string" || ap.replace(/\s+$/, "").length < 4 || !/ $/.test(ap)) { bad.push("autoPrefix musi byt retezec >= 4 znaky zakonceny mezerou"); }
}
if (has(sec, "cleanup")) {
    var cl = sec.cleanup;
    if (cl === null || typeof cl != "object") { bad.push("cleanup neni objekt"); }
    else {
        var CN = ["keepLastK", "maxAgeDays", "maxDeletesPerRun", "maxDeletesAnomaly"];
        for (n = 0; n < CN.length; n++) {
            if (has(cl, CN[n]) && (!isNum(cl[CN[n]]) || cl[CN[n]] < 0)) { bad.push("cleanup." + CN[n] + " neni nezaporne cislo"); }
        }
        if (has(cl, "mode") && cl.mode != "report" && cl.mode != "delete") { bad.push("cleanup.mode musi byt 'report' nebo 'delete'"); }
        if (has(cl, "requireWriteGroup") && typeof cl.requireWriteGroup != "boolean") { bad.push("cleanup.requireWriteGroup neni boolean"); }
        // nekonzistence dle par. 5 (AND retence potrebuje OBE podlahy explicitne)
        if (has(cl, "keepLastK") && !has(cl, "maxAgeDays")) { bad.push("cleanup.keepLastK bez cleanup.maxAgeDays"); }
        if (has(cl, "maxAgeDays") && !has(cl, "keepLastK")) { bad.push("cleanup.maxAgeDays bez cleanup.keepLastK"); }
        if (cl.mode == "delete" && !has(cl, "keepLastK")) { bad.push("cleanup.mode 'delete' bez cleanup.keepLastK"); }
        if (cl.mode == "delete" && isNum(cl.keepLastK) && cl.keepLastK < 1) { bad.push("cleanup.mode 'delete' s keepLastK < 1 (zadna podlaha)"); }
        var eRun = has(cl, "maxDeletesPerRun") ? cl.maxDeletesPerRun : DEF.cleanup.maxDeletesPerRun;
        var eAno = has(cl, "maxDeletesAnomaly") ? cl.maxDeletesAnomaly : DEF.cleanup.maxDeletesAnomaly;
        if (isNum(eRun) && isNum(eAno) && eAno < eRun) { bad.push("cleanup.maxDeletesAnomaly < cleanup.maxDeletesPerRun"); }
    }
}
if (bad.length > 0) {
    return { cfg: copyDef(), valid: false, present: true, why: bad.join("; "),
        warnings: ["Baseline politika: sekce 'baseline' ve FB_RiskPolicy je nekonzistentni (" + bad.join("; ") + ") - politika NEVALIDNI, zapisove davky jdou ELEVATED, pouzity bezpecne defaulty."] };
}
var out = copyDef(), k2;
for (k2 in sec) {
    if (k2 == "cleanup" || typeof sec[k2] == "function") { continue; }
    if (typeof DEF[k2] != "undefined") { out[k2] = sec[k2]; }
}
if (has(sec, "cleanup")) {
    for (k2 in sec.cleanup) {
        if (typeof sec.cleanup[k2] != "function" && typeof DEF.cleanup[k2] != "undefined") { out.cleanup[k2] = sec.cleanup[k2]; }
    }
}
return { cfg: out, valid: true, present: true, why: "", warnings: [] };
