// AICodeBridge.FB_BaselineCleanupHook(Repository, nowMs)
// BASELINE POLITIKA - SPOUSTEC UKLIDU (zadani v1.2 par. 6.3, podminka 2 / B1):
// hak v EXECUTORU (vola FB_Main PO dokonceni zapisove davky - nikdy uprostred),
// ne ve FB_SessionStart: ten v clipboard rezimu ani v GUI fallbacku nebezi,
// takze by uklid v obou bankovnich klikacich kanalech nenastal nikdy (T6-32).
// Nejvys jednou za cfg.cleanupEveryHours (default 24); stav drzi
// state-cleanup.txt:  <posledni beh RRRR-MM-DD hh:mm:ss>|<pocet behu>|<prvni beh>
// (pocet behu a datum prvniho = podklad pro kriterium prepnuti report ->
// delete: 10 cistych behu, nejdrive po 14 dnech - par. 5; rozhoduje clovek).
// Rezim bere z politiky (cleanup.mode; vychozi "report"). Vraci strucny
// vysledek pro response.cleanup, nebo null kdyz uklid nebezel.
// Chyba uklidu NENI chyba davky - jen radek v logu.
var now = (typeof nowMs == "number") ? nowMs : new Date().getTime();
function pad2(x) { return (x < 10 ? "0" : "") + x; }
function fmt(ms) {
    var d = new Date(ms);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
}
function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec("" + s);
    if (!m) { return NaN; }
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6], 10)).getTime();
}
try {
    var c = this.FB_BaselineConfig(Repository);
    if (!c || c.valid === false) { return null; } // vadna politika = zadny uklid
    var cfg = c.cfg;
    var every = (typeof cfg.cleanupEveryHours == "number") ? cfg.cleanupEveryHours : 24;
    var raw = ("" + this.FB_StateFile(Repository, "cleanup")).split("|");
    var last = parse(raw[0]);
    var runs = parseInt(raw[1], 10); if (isNaN(runs) || runs < 0) { runs = 0; }
    var first = (raw.length > 2 && !isNaN(parse(raw[2]))) ? raw[2] : fmt(now);
    if (!isNaN(last) && last <= now && (now - last) < every * 3600000) { return null; }
    // stav se zapisuje PRED behem: pad uklidu nesmi zpusobit beh pri kazde davce
    this.FB_StateFile(Repository, "cleanup", fmt(now) + "|" + (runs + 1) + "|" + first);
    var mode = (cfg.cleanup && cfg.cleanup.mode == "delete") ? "delete" : "report";
    var r = this.FB_BaselineCleanup(Repository, cfg, mode, false, now);
    return { mode: r.mode, total: r.total, candidates: r.candidates.length, planned: r.planned, deleted: r.deleted.length,
             failed: r.failed.length, remaining: r.remaining, anomaly: r.anomaly, orphans: r.orphans, runs: runs + 1, firstRun: first,
             note: r.note };
} catch (eH) {
    try { this.Log(Repository, "FB uklid baselines: selhal (" + eH.message + ") - davky se to netyka"); } catch (eL) { }
    return null;
}
