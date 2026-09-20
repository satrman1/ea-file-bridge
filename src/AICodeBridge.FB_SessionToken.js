// AICodeBridge.FB_SessionToken(Repository, cfg, nowMs)
// SESSION TOKEN executoru (zadani Baseline politika v1.2 par. 4.5, podm. 7/W1).
// Session je pojem EXECUTORU, ne klienta: token drzi FB_StateFile
// (state-session.txt) ve tvaru  s<RRRRMMDD>-<n>|<RRRR-MM-DD hh:mm:ss>
//   - chybi / necitelny / starsi nez cfg.sessionMaxHours (default 12)
//     -> zalozi se NOVY (n = poradi v dni; pokracuje v cislovani, kdyz ulozeny
//        token je z tehoz dne), zapise se a vraci fresh: true;
//   - jinak se vraci ulozeny s fresh: false.
// Token je JEDINY zdroj session casti jmena automaticke baseline (par. 6.1)
// i klice reuse. Klientske op.session se pro tento ucel NEPOUZIVA nikdy.
//
// Vraci { token, created, fresh, persisted }.
//   cfg    = cfg z FB_BaselineConfig (null/undefined -> nacte se zde)
//   nowMs  = jen pro testy (hodiny); jinak aktualni cas
// BEST-EFFORT (jako FB_StateFile): nikdy nesmi shodit davku. Kdyz se token
// nepodari ulozit (persisted: false), drzi se v pameti procesu
// (this._fbSessionTokMem) - jinak by kazde volani bylo "fresh" a session
// baseline by vznikala pri kazde davce (presne vada, kterou B1 vysetroval).
// Volat JEN z mist, ktera uz zapisuji (FB_Process, FB_SessionStart, hak
// FB_Main pred prvni zapisovou operaci) - cteci davka session nezaklada.
function pad2(x) { return (x < 10 ? "0" : "") + x; }
function fmt(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
        + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
}
function parseTs(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec("" + s);
    if (!m) { return NaN; }
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10),
        parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6], 10)).getTime();
}
function parseState(raw) {
    var m = /^(s(\d{8})-(\d+))\|(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$/.exec("" + raw);
    if (!m) { return null; }
    var ms = parseTs(m[4]);
    if (isNaN(ms)) { return null; }
    return { token: m[1], day: m[2], n: parseInt(m[3], 10), created: m[4], ms: ms };
}
var now = (typeof nowMs == "number") ? nowMs : new Date().getTime();
var maxH = 12;
try {
    var c = cfg;
    if (c === null || typeof c == "undefined") { c = this.FB_BaselineConfig(Repository).cfg; }
    if (c && typeof c.sessionMaxHours == "number" && c.sessionMaxHours > 0) { maxH = c.sessionMaxHours; }
} catch (eCfg) { maxH = 12; }
function alive(st) {
    // budouci cas (posun hodin) = neduveryhodny -> novy token
    return st != null && st.ms <= now && (now - st.ms) < maxH * 3600000;
}
var st = null;
try { st = parseState(this.FB_StateFile(Repository, "session")); } catch (eRd) { st = null; }
if (alive(st)) { return { token: st.token, created: st.created, fresh: false, persisted: true }; }
// soubor nic nedal -> pametovy fallback (jen kdyz predchozi zapis selhal)
var mem = null;
try { mem = parseState(this._fbSessionTokMem || ""); } catch (eMem) { mem = null; }
if (st == null && alive(mem)) { return { token: mem.token, created: mem.created, fresh: false, persisted: false }; }
// --- novy token ---
var dNow = new Date(now);
var day = "" + dNow.getFullYear() + pad2(dNow.getMonth() + 1) + pad2(dNow.getDate());
var nNext = 1;
if (st != null && st.day == day) { nNext = st.n + 1; }
else if (mem != null && mem.day == day) { nNext = mem.n + 1; }
var token = "s" + day + "-" + nNext;
var created = fmt(dNow);
var line = token + "|" + created;
var persisted = false;
try {
    this.FB_StateFile(Repository, "session", line);
    persisted = (("" + this.FB_StateFile(Repository, "session")) == line);
} catch (eWr) { persisted = false; }
try { this._fbSessionTokMem = persisted ? "" : line; } catch (eSet) { }
return { token: token, created: created, fresh: true, persisted: persisted };
