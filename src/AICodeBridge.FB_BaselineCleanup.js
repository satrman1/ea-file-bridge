// AICodeBridge.FB_BaselineCleanup(Repository, cfg, mode, force, nowMs)
// BASELINE POLITIKA - UKLID AUTOMATICKYCH BASELINES (zadani v1.2 par. 6).
//   mode  "report" = jen vypise, co BY smazal - NIKDY nevola DeleteBaseline;
//                    cteci akt, dostupny vsem (I8)
//         "delete" = maze; jen pro WRITE skupinu (cfg.cleanup.requireWriteGroup,
//                    FB_UserAccess) - jinak se provede jako report s poznamkou
//   force true = z MENU pod dohledem: bez stropu maxDeletesPerRun (strop
//                anomalie plati vzdy)
// Vraci { mode, requestedMode, total, candidates[], planned, deleted[],
//         failed[], remaining, anomaly, orphans, note, text }.
//
// PET POJISTEK (par. 6.3):
//  1. filtr = CELOTVAROVA shoda jmena (FB_BaselineName "parse" - tentyz regex
//     jako vznik; rezervaci prefixu hlida FB_OpBaselineCreate + gate). Legacy
//     "FB <datum>", "AI-pre-*" a rucni jmena mnozinou vubec neprojdou.
//  2. AND retence: kandidat = starsi nez maxAgeDays (vek ZE JMENA) A ZAROVEN
//     mimo keepLastK nejnovejsich TEHOZ (package, uzivatel) - kolega A nikdy
//     nevytlaci pre-image kolegy B; navrat po dovolene nesmaze vse.
//  3. strop: smaze se maxDeletesPerRun NEJSTARSICH, zbytek se nahlasi; nad
//     maxDeletesAnomaly se nemaze NIC (anomalie k rucnimu prosetreni).
//  4. vychozi mode "report"; prepnuti = zmena chranene politiky clovekem.
//  5. prvni ostre mazani z menu pod dohledem (EA_MenuClick).
// KANDIDATI Z MODELU (W4), ne z per-user indexu: jeden SELECT nad t_document
// (DocType 'Baseline', ElementID = GUID package, Version = jmeno, DocID =
// GUID baseline; dolozeno spikem 2026-09-07 doma na SQLite). V BANCE PRED
// PRVNIM SPUSTENIM OVERIT SLOUPCE dle docs/baseline-spike/sql-banka.md B1/B2
// (INFORMATION_SCHEMA - nikdy hadany sloupec, past N-4: chybny dotaz = modal
// + prazdny vysledek = "neni co uklizet", tj. bezpecny smer).
// AUTORITA tesne pred smazanim = GetBaselines(package) + tentyz filtr: co
// v modelu pod timze GUID a jmenem neni, to se nemaze.
// DeleteBaseline("{GUID}") maze radek t_document (spike T6-S); v EA runtime
// dolozeno jen proxy (Scripting okno) - kazde volani ma vlastni try/catch,
// selhani jednoho smazani neshodi zbytek behu.
var self = this;
var now = (typeof nowMs == "number") ? nowMs : new Date().getTime();
var cl = (cfg && cfg.cleanup) ? cfg.cleanup : {};
var prefix = (cfg && typeof cfg.autoPrefix == "string" && cfg.autoPrefix != "") ? cfg.autoPrefix : "FB-AUTO ";
var keepK = (typeof cl.keepLastK == "number") ? cl.keepLastK : 3;
var maxAge = (typeof cl.maxAgeDays == "number") ? cl.maxAgeDays : 14;
var perRun = (typeof cl.maxDeletesPerRun == "number") ? cl.maxDeletesPerRun : 20;
var anomalyMax = (typeof cl.maxDeletesAnomaly == "number") ? cl.maxDeletesAnomaly : 200;
var res = { mode: "report", requestedMode: ("" + mode), total: 0, candidates: [], planned: 0, deleted: [], failed: [],
            remaining: 0, anomaly: false, orphans: 0, note: "", text: "" };
var wantDelete = (("" + mode) == "delete");
if (wantDelete && cl.requireWriteGroup !== false) {
    var acc = null;
    try { acc = this.FB_UserAccess(Repository); } catch (eAcc) { acc = null; }
    if (!acc || ("" + acc.access) != "write") {
        wantDelete = false;
        res.note = "Mazani vyzaduje write skupinu add-inu (FB_AccessGroups) - provedeno jen jako report (E_ADDIN_ACCESS semantika).";
    }
}
res.mode = wantDelete ? "delete" : "report";
// --- kandidati z modelu ---
var likeOk = /^[A-Za-z0-9 \-]+$/.test(prefix);
var where = "d.DocType = 'Baseline'" + (likeOk ? " AND d.Version LIKE '" + prefix + "%'" : "");
var rows = null;
try { rows = this.FB_XmlRows(Repository.SQLQuery("SELECT d.DocID, d.ElementID, d.Version, d.DocDate, d.DocName FROM t_document d WHERE " + where)); }
catch (eQ) { rows = null; }
if (rows == null) { res.note += (res.note ? " " : "") + "Vycet baselines z t_document selhal - nic se nedela."; res.text = "Uklid automatickych baselines: " + res.note; return res; }
var groups = {}, gKeys = [];
for (var i = 0; i < rows.length; i++) {
    var p = this.FB_BaselineName("parse", rows[i].Version, prefix);
    if (p == null) { continue; } // mimo mnozinu: legacy, AI-pre-*, rucni
    res.total++;
    var gk = ("" + rows[i].ElementID).toUpperCase() + "|" + p.login.toUpperCase();
    if (!groups[gk]) { groups[gk] = []; gKeys.push(gk); }
    groups[gk].push({ guid: "" + rows[i].DocID, pkgGuid: "" + rows[i].ElementID, pkgName: "" + (rows[i].DocName || ""),
                      name: "" + rows[i].Version, login: p.login, time: p.time, ms: p.ms });
}
var cand = [];
for (var g = 0; g < gKeys.length; g++) {
    var lst = groups[gKeys[g]];
    lst.sort(function (a, b) { return b.ms - a.ms; }); // nejnovejsi prvni
    for (var k = keepK; k < lst.length; k++) {
        if ((now - lst[k].ms) > maxAge * 86400000) { cand.push(lst[k]); }
    }
}
cand.sort(function (a, b) { return a.ms - b.ms; }); // nejstarsi prvni
res.candidates = cand;
// osirele (package uz neexistuje) - jen do reportu, levna pojistka
try {
    var orr = this.FB_XmlRows(Repository.SQLQuery("SELECT COUNT(*) AS c FROM t_document d WHERE " + where + " AND d.ElementID NOT IN (SELECT ea_guid FROM t_package)"));
    if (orr.length == 1) { res.orphans = parseInt(orr[0].c, 10) || 0; }
} catch (eO) { }
if (cand.length > anomalyMax) {
    res.anomaly = true; res.planned = 0; res.remaining = cand.length;
    res.note += (res.note ? " " : "") + "ANOMALIE: " + cand.length + " kandidatu > maxDeletesAnomaly " + anomalyMax + " - nemaze se NIC, prosetri rucne.";
} else {
    res.planned = (force === true) ? cand.length : Math.min(cand.length, perRun);
    res.remaining = cand.length - res.planned;
}
// --- mazani ---
if (wantDelete && !res.anomaly && res.planned > 0) {
    var pi = null;
    try { pi = Repository.GetProjectInterface(); } catch (ePi) { pi = null; }
    var liveCache = {};
    for (var d = 0; d < res.planned; d++) {
        var c = cand[d];
        if (pi == null) { res.failed.push({ guid: c.guid, name: c.name, why: "GetProjectInterface nedostupny" }); continue; }
        try {
            // AUTORITA: aktualni vypis baselines package + tentyz filtr
            var key = c.pkgGuid.toUpperCase();
            if (typeof liveCache[key] == "undefined") {
                var live = {};
                var xml = "" + pi.GetBaselines(pi.GUIDtoXML(c.pkgGuid), "");
                var re = /<baseline\s+([^>]*)\/?>/gi, m;
                while ((m = re.exec(xml)) != null) {
                    var vm = /version="([^"]*)"/i.exec(m[1]), gm = /guid="([^"]*)"/i.exec(m[1]);
                    if (vm && gm) { live[("" + gm[1]).toUpperCase()] = vm[1]; }
                }
                liveCache[key] = live;
            }
            var liveName = liveCache[key][c.guid.toUpperCase()];
            if (typeof liveName == "undefined" || liveName != c.name || this.FB_BaselineName("parse", liveName, prefix) == null) {
                res.failed.push({ guid: c.guid, name: c.name, why: "v modelu pod timto GUID a jmenem neni (GetBaselines) - nemazano" });
                continue;
            }
            var okD = pi.DeleteBaseline(c.guid);
            if (okD === true || okD === -1 || okD === 1) { res.deleted.push(c); }
            else { res.failed.push({ guid: c.guid, name: c.name, why: "DeleteBaseline vratil " + okD }); }
        } catch (eD) {
            res.failed.push({ guid: c.guid, name: c.name, why: "" + eD.message });
        }
    }
    res.remaining = cand.length - res.deleted.length;
}
// --- text (Output tab / dialog / audit) ---
var L = [];
L.push("Uklid automatickych baselines [" + res.mode + (force === true ? ", z menu" : "") + "]: v modelu " + res.total + " automatickych baselines, kandidatu "
    + cand.length + " (starsi nez " + maxAge + " dni A mimo " + keepK + " nejnovejsich per balicek+uzivatel).");
if (res.note != "") { L.push(res.note); }
if (res.mode == "report" && !res.anomaly) {
    L.push(cand.length == 0 ? "Neni co uklizet." : ("Smazal bych " + res.planned + (res.remaining > 0 ? " (zbyva " + res.remaining + " na dalsi behy)" : "") + ":"));
} else if (res.mode == "delete") {
    L.push("Smazano " + res.deleted.length + (res.failed.length > 0 ? ", selhalo " + res.failed.length : "") + (res.remaining > 0 ? ", zbyva " + res.remaining : "") + ":");
}
var show = (res.mode == "delete") ? res.deleted : cand.slice(0, res.planned);
for (var s = 0; s < show.length && s < 40; s++) {
    L.push("  - " + (show[s].pkgName || show[s].pkgGuid) + " | " + show[s].name + " | " + show[s].guid + " | uzivatel " + show[s].login);
}
if (show.length > 40) { L.push("  ... a dalsich " + (show.length - 40)); }
for (var f = 0; f < res.failed.length && f < 10; f++) { L.push("  ! NESMAZANO " + res.failed[f].name + ": " + res.failed[f].why); }
if (res.orphans > 0) { L.push("Osirele automaticke baselines (package uz neexistuje): " + res.orphans + " - jen hlaseni."); }
res.text = L.join("\n");
try { this.Log(Repository, res.text.replace(/\n/g, " | ")); } catch (eLg) { }
// audit: kazde MAZANI; report jen kdyz ma co hlasit (best-effort - cteci
// uzivatel do #AI-LOG zapsat nemusi smet)
if (res.deleted.length > 0 || res.failed.length > 0 || res.anomaly || (res.mode == "report" && cand.length > 0)) {
    try {
        var dN = new Date(now);
        var aid = "uklid-baselines-" + dN.getFullYear() + (dN.getMonth() < 9 ? "0" : "") + (dN.getMonth() + 1) + (dN.getDate() < 10 ? "0" : "") + dN.getDate()
            + "-" + (dN.getHours() < 10 ? "0" : "") + dN.getHours() + (dN.getMinutes() < 10 ? "0" : "") + dN.getMinutes();
        res.auditGuid = "" + this.FB_Audit(Repository, aid, "uklid baselines [" + res.mode + "]: kandidatu " + cand.length + ", smazano " + res.deleted.length
            + ", selhalo " + res.failed.length + (res.anomaly ? ", ANOMALIE" : ""), res.text);
    } catch (eAu) { }
}
return res;
