// AICodeBridge.FB_BaselineDecide(Repository, plan, risk, nowMs)
// BASELINE POLITIKA - ROZHODNUTI davky (zadani v1.2 par. 4.4 tabulka radku
// 1-4, par. 4.6). Vstup = plan z FB_BaselinePlan + risk z FB_RiskGate.
// Vraci { action, reason, confirmReasons[], manual, lines[] }:
//   action "none"    zaloha se nedela (radek 1 cisty create / vyjimka Approx)
//          "create"  mikro-baseline nad plan.scope.packages (radek 2) - dela
//                    FB_Main az PO potvrzeni, tesne pred prvni zapisovou op
//          "guided"  NAVADENA CESTA (radek 4b): bez pre-image se nezapisuje;
//                    confirm_required + strojova kontrola cerstve RUCNI
//                    baseline nad predkem cile uvnitr whitelistu
//          "refuse"  E_NO_BASELINE (radek 4a): destruktivni podtrida bez
//                    moznosti zalohy pri requireRecoveryForUpdates
//   confirmReasons  duvody, ktere VYNUCUJI confirm_required (i u LOW davky)
//   manual          { ok, found[], missing[] } - vysledek kontroly rucnich
//                   baselines (jen u "guided")
//   lines           lidske radky pro potvrzovaci dialog (FB_ConfirmSummary)
// RADEK 3 (nad prahem => zapis bez baseline, recovery z journalu) se
// NESTAVI (dispozice 7) - dokud journal nekryje cile nad prahem, pada pripad
// na radek 4.
// O MOZNOSTI zalohy rozhoduje VELIKOSTNI nejistota (scope / sonda / strop
// packages / prahy po kalibraci). Nespocitane metriky gate samy zalohu
// NEBLOKUJI - naopak ji VYNUCUJI (podminka 1 / B3, T6-25): davka se bere
// jako menici a zalohuje se, co scope nasel.
var now = (typeof nowMs == "number") ? nowMs : new Date().getTime();
var self = this;
var cfg = (plan && plan.cfg) ? plan.cfg : {};
var scope = plan ? plan.scope : null;
var m = (risk && risk.metrics) ? risk.metrics : null;
var out = { action: "none", reason: "", confirmReasons: [], manual: null, lines: [] };
var metricsOk = !!m && m.metricsComplete === true;

// velikostni nejistota = vse krome zdroje (1) metriky
var sizeOk = !!scope && scope.unknown !== true && scope.overLimit !== true;
var sizeWhy = "";
if (!scope) { sizeWhy = "scope nespocitan"; }
else if (scope.overLimit === true) { sizeWhy = "nad prahem (dotcenych packages " + scope.packages.length + " > maxBaselinePackages " + scope.maxBaselinePackages + ")"; }
else if (scope.unknown === true) { sizeWhy = "velikost neznama (" + (scope.unknownWhy.length > 0 ? scope.unknownWhy[0] : "?") + ")"; }
if (sizeOk) {
    var sum = 0;
    for (var i = 0; i < plan.probes.length; i++) {
        var pb = plan.probes[i];
        if (pb.status != "ok") { sizeOk = false; sizeWhy = "velikost neznama (" + pb.why + ")"; break; }
        sum += pb.elements;
        if (cfg.thresholdsShadow === false && typeof cfg.subtreeMax == "number" && pb.elements > cfg.subtreeMax) {
            sizeOk = false; sizeWhy = "nad prahem (podstrom " + pb.elements + " > subtreeMax " + cfg.subtreeMax + ")"; break;
        }
    }
    if (sizeOk && cfg.thresholdsShadow === false && typeof cfg.maxBaselineElements == "number" && sum > cfg.maxBaselineElements) {
        sizeOk = false; sizeWhy = "nad prahem (soucet " + sum + " > maxBaselineElements " + cfg.maxBaselineElements + ")";
    }
}
function pkgList() {
    var a = [];
    for (var k = 0; scope && k < scope.packages.length; k++) {
        var pr = plan.probes[k];
        a.push((scope.packages[k].path || scope.packages[k].name) + ((pr && pr.status == "ok") ? " (" + pr.elements + " prvku)" : ""));
    }
    return a;
}
if (!metricsOk) { out.lines.push("Rozsah davky se nepodarilo spocitat - zachazi se s ni jako s menici."); }

// --- radek 1: cisty create ---
if (plan && plan.needsBaseline === false) {
    out.action = "none";
    out.reason = plan.pureCreate ? "cisty create" : "bez menenych cilu";
    if (plan.pureCreate) { out.lines.push("Bez zalohy - davka jen vytvari (undo = smazani dle razitek)."); }
    return out;
}
// --- radek 2: zalohu lze poridit ---
if (sizeOk && scope.packages.length > 0) {
    out.action = "create";
    out.reason = metricsOk ? "pod prahem" : "metriky nespoctany";
    out.lines.push("Zaloha pred zapisem: " + pkgList().join(", "));
    for (var q = 0; q < scope.packages.length; q++) {
        if (scope.packages[q].parentOutOfWhitelist === true) {
            // T6-28: rodic korenove whitelist package je mimo whitelist -> baseline
            // jde jen nad mazany package sam; EA ji pri USPESNEM smazani package
            // smaze s nim (spike 2026-09-07) - chrani tedy jen nedokoncene mazani
            var pw = "parentOutOfWhitelist - zaloha nekryje smazany uzel: rodic balicku '" + (scope.packages[q].path || scope.packages[q].name)
                + "' je mimo whitelist, baseline vznikne jen nad mazanym balickem a pri uspesnem smazani ZANIKNE s nim. Chces-li navrat, udelej PRED potvrzenim XMI export balicku v EA.";
            out.confirmReasons.push(pw);
            out.lines.push("POZOR: " + pw);
        }
    }
    return out;
}
if (sizeOk && scope.packages.length == 0) {
    // needsBaseline z metrik gate, ale scope zadny meneny package nenasel
    // (napr. nespocitane metriky u davky, ktera jen vytvari) -> neni co zalohovat
    out.action = "none";
    out.reason = metricsOk ? "bez menenych cilu" : "metriky nespoctany - scope bez menenych cilu";
    return out;
}
// --- zalohu poridit NELZE (none / unknown) ---
// vyjimka B5/b: jedinym dukazem zmeny je konzervativni pripocet match/dedup
// (updatedExistingApprox) a scope je jinak znamy -> neblokovat (T6-26)
var approx = (m && typeof m.updatedExistingApprox == "number") ? m.updatedExistingApprox : 0;
if (metricsOk && scope && scope.unknown !== true && scope.destructive !== true
    && m.deleteTargets == 0 && m.affectedDiagrams == 0 && (m.updatedExisting - approx) <= 0) {
    out.action = "none";
    out.reason = sizeWhy + " - bez zalohy: jedina zmena je updatedExistingApprox " + approx + " (match/dedup, retry po zotaveni)";
    out.lines.push("BEZ ZALOHY: " + sizeWhy + "; davka meni nejvys prvky dohledane pres match/dedupKey.");
    return out;
}
// --- radek 4a: destruktivni podtrida ---
if ((!scope || scope.destructive === true) && cfg.requireRecoveryForUpdates === true) {
    out.action = "refuse";
    out.reason = sizeWhy + " - destruktivni operace (" + (scope ? scope.destructiveOps.join(", ") : "?") + ") bez moznosti zalohy";
    return out;
}
// --- radek 4b: navadena cesta ---
out.action = "guided";
out.reason = sizeWhy;
// strojova kontrola: cerstva RUCNI baseline (jmeno MIMO automaticky vzor)
// nad cilem nebo jeho predkem UVNITR whitelistu, mladsi nez freshWithinMin.
// Existence + jmena = GetBaselines (autorita); stari = t_document.DocDate
// (jedine datum mimo jmeno; atribut date v XML neexistuje - spike 7. 9.).
var prefix = (typeof cfg.autoPrefix == "string" && cfg.autoPrefix != "") ? cfg.autoPrefix : "FB-AUTO ";
var freshMin = (typeof cfg.freshWithinMin == "number") ? cfg.freshWithinMin : 15;
function parseIso(s) {
    var mm = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec("" + s);
    if (!mm) { return NaN; }
    return new Date(parseInt(mm[1], 10), parseInt(mm[2], 10) - 1, parseInt(mm[3], 10), parseInt(mm[4], 10), parseInt(mm[5], 10), parseInt(mm[6], 10)).getTime();
}
function freshManualOn(pkgObj) {
    var names = {};
    try {
        var pi = Repository.GetProjectInterface();
        var xml = "" + pi.GetBaselines(pi.GUIDtoXML("" + pkgObj.PackageGUID), "");
        var re = /<baseline\s+([^>]*)\/?>/gi, mx;
        while ((mx = re.exec(xml)) != null) {
            var vm = /version="([^"]*)"/i.exec(mx[1]);
            if (vm && self.FB_BaselineName("parse", vm[1], prefix) == null && !self.FB_BaselineNameReserved(Repository, vm[1])) { names[vm[1]] = 1; }
        }
    } catch (eG) { return null; }
    var rr = null;
    try {
        rr = self.FB_XmlRows(Repository.SQLQuery("SELECT Version, DocDate FROM t_document WHERE DocType = 'Baseline' AND ElementID = '"
            + ("" + pkgObj.PackageGUID).replace(/'/g, "''") + "'"));
    } catch (eS) { rr = null; }
    if (rr == null) { return null; }
    for (var r = 0; r < rr.length; r++) {
        if (names["" + rr[r].Version] != 1) { continue; }
        var ms = parseIso(rr[r].DocDate);
        if (!isNaN(ms) && ms <= now + 60000 && (now - ms) < freshMin * 60000) { return "" + rr[r].Version; }
    }
    return null;
}
function coveredBy(startPkgId) {
    // jde od package nahoru; zkouma jen packages UVNITR whitelistu
    var cur = startPkgId, guard = 0;
    while (cur && cur > 0 && guard++ < 60) {
        var po = null;
        try { po = Repository.GetPackageByID(cur); } catch (eP) { po = null; }
        if (!po) { return null; }
        var inWl = false;
        try { inWl = (self.FB_CheckWrite(Repository, po) == null); } catch (eW) { inWl = false; }
        if (!inWl) { return null; }
        var nm = freshManualOn(po);
        if (nm != null) {
            var pth = "" + po.Name;
            try { pth = "" + self.FB_ElementPath(Repository, "package", po); } catch (ePa) { }
            return { name: nm, path: pth };
        }
        try { cur = po.ParentID; } catch (eQ) { cur = 0; }
    }
    return null;
}
var found = [], missing = [];
var k2;
for (k2 = 0; scope && k2 < scope.packages.length; k2++) {
    var cv = coveredBy(scope.packages[k2].id);
    if (cv) { found.push(cv.name + " nad " + cv.path); } else { missing.push(scope.packages[k2].path || scope.packages[k2].name); }
}
if (!scope || scope.unknown === true) {
    // cil neznamy -> kryje jen rucni baseline nad korenem whitelistovane vetve
    var wl = [], rid = "";
    try { wl = this.FB_Whitelist(); rid = ("" + this.FB_RepoId(Repository)).toUpperCase(); } catch (eWl) { wl = []; }
    var anyRoot = false;
    for (var w = 0; w < wl.length; w++) {
        if (rid.indexOf(("" + wl[w].repo).toUpperCase()) < 0) { continue; }
        var rp = null;
        try { rp = Repository.GetPackageByGuid("" + wl[w].pkg); } catch (eRp) { rp = null; }
        if (!rp) { continue; }
        anyRoot = true;
        var rn = freshManualOn(rp);
        var rpth = "" + rp.Name;
        try { rpth = "" + self.FB_ElementPath(Repository, "package", rp); } catch (eRpa) { }
        if (rn != null) { found.push(rn + " nad " + rpth); } else { missing.push(rpth + " (koren whitelistu - cil davky nelze urcit)"); }
    }
    if (!anyRoot) { missing.push("(zadna whitelistovana vetev pro tento repozitar)"); }
}
out.manual = { ok: (missing.length == 0 && found.length > 0), found: found, missing: missing };
var cr = "bez pre-image - " + sizeWhy + "; " + (out.manual.ok
    ? "nalezena cerstva rucni baseline (" + found.join("; ") + ") - po potvrzeni se zapise"
    : "nutna rucni baseline nad " + missing.join(", "));
out.confirmReasons.push(cr);
out.lines.push("BEZ AUTOMATICKE ZALOHY (bez pre-image): " + sizeWhy + ".");
if (out.manual.ok) { out.lines.push("Nalezena cerstva rucni baseline: " + found.join("; ") + " - po potvrzeni se davka provede."); }
else {
    out.lines.push("PRED potvrzenim udelej v EA rucni baseline nad: " + missing.join(", "));
    out.lines.push("  (balicek v browseru -> Ctrl+Alt+B -> New Baseline; jmeno BEZ prefixu FB-AUTO; ne starsi nez " + freshMin + " min)");
    out.lines.push("  Bez ni se davka po potvrzeni NEPROVEDE. Jina cesta: pracovat v mensim balicku.");
}
return out;
