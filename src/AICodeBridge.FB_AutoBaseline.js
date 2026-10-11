// AICodeBridge.FB_AutoBaseline(Repository, pkgGuid, cfg, token, klass, isSession, nowMs)
// BASELINE POLITIKA - LAZY AUTOMATICKA BASELINE jedne package (zadani v1.2
// par. 4.5, 4.6, 6.1). Vola FB_Main tesne PRED prvni zapisovou operaci
// (u ELEVATED az PO potvrzeni) a FB_SessionStart (isSession = true).
// Vraci { status: "created"|"reused"|"failed", guid, name, elapsedMs, why }.
//
// REUSE je bezstavove vuci modelu (cte se GetBaselines + parser jmena):
//   LOW       existuje FB-AUTO teze package od TEHOZ uzivatele a TEZE session
//             (token) -> nova se nedela (20 davek = 1 zaloha);
//   ELEVATED  od 2026-10-11 (N-E2E-7, rozhodnuti Milose = a, Z261004b-3):
//             STEJNE jako LOW - FB-AUTO teze package od tehoz uzivatele a
//             teze session se pouzije bez ohledu na stari ("reuse session");
//             cfg.freshWithinMin zustava jen jako STROP pro zalohu z jine
//             session / bez tokenu (cas ZE JMENA, ne z atributu date).
//             Duvod: pri "dni prace" 11. 10. vznikly 2 zalohy tehoz balicku
//             za 18 min a kriterium T6-24 "nove FB-AUTO <= dotcene balicky"
//             neslo splnit. Driv: jen freshWithinMin (session reuse neplatil).
//   isSession session baseline pri startu: reuse jako LOW (restart pumpy
//             v teze session nevyrobi dalsi zalohu cele vetve).
// Token = VYHRADNE FB_SessionToken (nikdy klientske op.session).
// Zapis prochazi FB_CheckWrite stejne jako explicitni create_baseline
// (E_WHITELIST -> failed). FB_OpsAllowed se na auto-baseline ZAMERNE
// nevztahuje (I6): neni to operace davky, ale obrana executoru - zakaz
// obrany by znamenal tichy zapis bez pre-image.
// SELHANI je terminalni pro volajiciho (W10): CreateBaseline vyjimka i
// navrat false = "failed" -> FB_Main vyda E_NO_BASELINE, zadne nove confirm.
// Lokalni cache baselines-index.json se NEVEDE: nema ctenare (reuse cte
// GetBaselines, uklid SQL t_document) - autorita je vzdy model (par. 6.1).
var self = this;
var t0 = new Date().getTime();
var now = (typeof nowMs == "number") ? nowMs : t0;
function res(status, guid, name, why) {
    return { status: status, guid: guid || "", name: name || "", elapsedMs: (new Date().getTime() - t0), why: why || "" };
}
var prefix = (cfg && typeof cfg.autoPrefix == "string" && cfg.autoPrefix != "") ? cfg.autoPrefix : "FB-AUTO ";
var freshMin = (cfg && typeof cfg.freshWithinMin == "number") ? cfg.freshWithinMin : 15;
var pkg = null;
try { pkg = Repository.GetPackageByGuid("" + pkgGuid); } catch (eP) { pkg = null; }
if (pkg == null) { return res("failed", "", "", "package " + pkgGuid + " nenalezen"); }
var chk = null;
try { chk = this.FB_CheckWrite(Repository, pkg); } catch (eC) { chk = { code: "E_EXCEPTION", message: "FB_CheckWrite selhal: " + eC.message }; }
if (chk != null) { return res("failed", "", "", chk.code + ": " + chk.message); }
var login = "";
try { login = "" + Repository.GetCurrentLoginUser(false); } catch (eL) { login = ""; }
login = login.replace(/\s+/g, "_");
if (login == "") { login = "-"; }
var tok = "" + ((token && token.token) ? token.token : (token || ""));
if (!/^s\d{8}-\d+$/.test(tok)) { return res("failed", "", "", "neplatny session token '" + tok + "'"); }
var pi = null;
try { pi = Repository.GetProjectInterface(); } catch (ePi) { pi = null; }
if (pi == null) { return res("failed", "", "", "GetProjectInterface nedostupny"); }
var pkgXml = "";
try { pkgXml = "" + pi.GUIDtoXML("" + pkg.PackageGUID); } catch (eX) { return res("failed", "", "", "GUIDtoXML selhal: " + eX.message); }
function listBaselines() {
    var out = [];
    var xml = "" + pi.GetBaselines(pkgXml, "");
    var re = /<baseline\s+([^>]*)\/?>/gi, m;
    while ((m = re.exec(xml)) != null) {
        var vm = /version="([^"]*)"/i.exec(m[1]), gm = /guid="([^"]*)"/i.exec(m[1]);
        out.push({ version: vm ? self.FB_XmlUnescape(vm[1]) : "", guid: gm ? gm[1] : "" });
    }
    return out;
}
// --- reuse ---
try {
    var have = listBaselines();
    var best = null;
    for (var i = 0; i < have.length; i++) {
        var p = this.FB_BaselineName("parse", have[i].version, prefix);
        if (p == null) { continue; }
        var hit = false, why = "";
        if (p.login == login && p.token == tok) {
            hit = true; why = "reuse session"; // LOW i ELEVATED (N-E2E-7)
        } else if (("" + klass) == "ELEVATED" && isSession !== true) {
            // zaloha jine session / jineho uzivatele: jen kdyz je cerstva
            hit = (p.ms <= now + 60000) && ((now - p.ms) < freshMin * 60000);
            why = "reuse freshWithinMin";
        }
        if (hit && (best == null || p.ms > best.ms || (p.ms == best.ms && why == "reuse session"))) {
            best = { ms: p.ms, guid: have[i].guid, name: have[i].version, why: why };
        }
    }
    if (best != null) {
        return res("reused", best.guid, best.name, best.why);
    }
} catch (eR) {
    // cteni seznamu selhalo -> reuse nelze overit; porid cerstvou (bezpecny smer)
}
// --- vznik ---
var name = "" + this.FB_BaselineName("format", prefix, login, tok, now, isSession === true);
var okB = false;
try {
    okB = pi.CreateBaseline(pkgXml, name, "EA File Bridge - automaticka baseline pred zapisem (Baseline politika); uklid dle retence FB_RiskPolicy.baseline.cleanup");
} catch (eB) { return res("failed", "", name, "CreateBaseline selhal: " + eB.message); }
if (okB !== true && okB !== -1 && okB !== 1) { return res("failed", "", name, "CreateBaseline vratil " + okB); }
var bguid = "";
try {
    var after = listBaselines();
    for (var j = 0; j < after.length; j++) { if (after[j].version == name) { bguid = after[j].guid; } }
} catch (eA) { }
return res("created", bguid, name, "");
