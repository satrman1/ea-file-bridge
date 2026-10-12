// AICodeBridge.FB_SessionStart(Repository)
// START SESSION (pumpa / vratny / FB_Process pri cerstvem session tokenu).
// Vraci textovy souhrn pro konzoli pumpy. Od Baseline politiky (zadani v1.2
// par. 4.8) ma DVE oddelene casti; od cile zapisu v rezimu blacklist
// (Z261004b-10, zadani cil zapisu v1.1 kap. 5.9/4, 5.11):
//  (1) HLASENI - bezi VZDY: identita repa dle FB_RepoId, stav konfigurace
//      cile zapisu (FB_WriteScopeCfg: chranene vetve blacklistu, implicitni
//      ochrana auditu a add-inu, vady = E_SCOPE_CONFIG), varovani, kdyz
//      repozitar nema polozku ve FB_WriteScope (prevence E_REPO). Lidskou
//      vetu a ping (writeScope) doladuje Z261004b-11.
//  (2) ZALOHA session se uz NEDELA: sessionBaseline "auto" nema bez whitelistu
//      cil - FB_BaselineConfig ji preklopi na "off" a ohlasi to (FB-CZ-25).
//      Zalohy vznikaji az pred zapisem, vzdy nad konkretnim balickem.
// FB-PU-06 (v0.16, Z261004b-3): pod pumpou si executor pamatuje identitu
// repozitare ze startu session; FB_Main ji porovnava s aktualni a pri zmene
// projektu v EA vraci E_REPO "restartuj pumpu" (i u cteni). Jen pamet
// procesu pumpy (typeof WScript) - EA runtime this._fb* nedrzi (par. 1a/5).
var self = this;
var ridRaw = "" + this.FB_RepoId(Repository);
if (typeof WScript != "undefined") {
    this._fbSessionRepo = ridRaw;
    this._fbOwnGuids = {}; // pravidlo 3: nova session = zadne vlastni prvky
}
this._fbScopeCfg = null; // cerstve cteni konfigurace cile zapisu
var cfgB = null, cfgWarn = [];
try { var cb = this.FB_BaselineConfig(Repository); cfgB = cb.cfg; cfgWarn = cb.warnings || []; } catch (eCfg) { cfgB = null; }
var parts = [];
parts.push("Repozitar: " + ridRaw);
var ws = null;
try { ws = this.FB_WriteScopeCfg(Repository); } catch (eWs) { ws = null; }
var secOn = false;
try { secOn = (Repository.IsSecurityEnabled === true); } catch (eSe) { secOn = false; }
if (ws == null) {
    parts.push("POZOR: konfiguraci cile zapisu (FB_WriteScope) nelze precist - zapisy skonci E_SCOPE_CONFIG");
} else if (!ws.repoKnown) {
    parts.push("POZOR: repozitar nema polozku ve FB_WriteScope - zapisy budou zamitnuty (E_REPO). Identita: " + ridRaw + " | Pripojeni: " + Repository.ConnectionString);
} else {
    var bl = [];
    for (var b = 0; b < ws.blacklist.length; b++) {
        var w = ws.blacklist[b];
        bl.push((w.found ? w.path : (w.name || w.pkg) + " (NENALEZEN)") + (w.note ? " [" + w.note + "]" : ""));
    }
    var im = [];
    for (var i = 0; i < ws.implicit.length; i++) { im.push(ws.implicit[i].path || ws.implicit[i].name); }
    parts.push("Zapis: blacklist (" + ws.blacklist.length + " chranenych vetvi) | EA security " + (secOn ? "zapnuta" : "vypnuta")
        + " | chraneno: " + (bl.length > 0 ? bl.join(", ") : "(nic na blacklistu)")
        + " | bridge chrani i sam sebe: " + (im.length > 0 ? im.join(", ") : "(balicek add-inu/auditu nedohledan)"));
    if (!secOn) { parts.push("Varovani: EA security je vypnuta - jedinou hranici zapisu je blacklist a implicitni ochrana (O2 = b)"); }
    if (ws.problems.length > 0) { parts.push("CHYBA konfigurace cile zapisu (E_SCOPE_CONFIG - vsechny zapisy zastavene, cteni bezi): " + ws.problems.join(" | ")); }
    if (ws.warnings.length > 0) { parts.push("Upozorneni: " + ws.warnings.join(" | ")); }
}
for (var cw = 0; cw < cfgWarn.length; cw++) { parts.push(cfgWarn[cw]); }
parts.push("Session baseline se nedela (sessionBaseline off). Zalohy se poridi automaticky az pred prvnim zapisem - vzdy nad konkretnim balickem, ne nad celou vetvi.");
var out = parts.join(" | ");
this.Log(Repository, out);
return out;
