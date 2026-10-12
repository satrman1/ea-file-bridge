// AICodeBridge.FB_SessionStart(Repository)
// START SESSION (pumpa / vratny / FB_Process pri cerstvem session tokenu).
// Vraci textovy souhrn pro konzoli pumpy. Od Baseline politiky (zadani v1.2
// par. 4.8) ma DVE oddelene casti; od cile zapisu v rezimu blacklist
// (Z261004b-10, zadani cil zapisu v1.1 kap. 5.9/4, 5.11):
//  (1) HLASENI - bezi VZDY: identita repa dle FB_RepoId, stav konfigurace
//      cile zapisu (FB_WriteScopeCfg: chranene vetve blacklistu, implicitni
//      ochrana auditu a add-inu, vady = E_SCOPE_CONFIG), varovani, kdyz
//      repozitar nema polozku ve FB_WriteScope (prevence E_REPO). Lidska
//      veta = FB_ScopeText (tataz v menu "Stav bridge" a v pingu, FB-CZ-27).
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
// jedna lidska veta o cili zapisu - tataz jako v menu "Stav bridge" a v pingu
// (FB_ScopeText, FB-CZ-27, Z261004b-11); stav EA security jen informativne
var st = null;
try { st = this.FB_ScopeText(Repository); } catch (eSt) { st = null; }
if (st == null) {
    parts.push("POZOR: konfiguraci cile zapisu (FB_WriteScope) nelze precist - zapisy skonci E_SCOPE_CONFIG");
} else {
    parts.push(st.sentence);
    if (st.problems.length > 0) { parts.push("CHYBA konfigurace cile zapisu (E_SCOPE_CONFIG - vsechny zapisy zastavene, cteni bezi; opravny kanal = davka jen s deploy_src): " + st.problems.join(" | ")); }
    if (st.warnings.length > 0) { parts.push("Upozorneni: " + st.warnings.join(" | ")); }
}
for (var cw = 0; cw < cfgWarn.length; cw++) { parts.push(cfgWarn[cw]); }
parts.push("Session baseline se nedela (sessionBaseline off). Zalohy se poridi automaticky az pred prvnim zapisem - vzdy nad konkretnim balickem, ne nad celou vetvi.");
var out = parts.join(" | ");
this.Log(Repository, out);
return out;
