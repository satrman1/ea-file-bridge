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
// FB-PU-02 (pumpa v0.6, Z261004b-5): hlaseni nese otisk kodu v modelu
// (FB_CodeInfo - tagged values fb.code.*, zapisuje bootstrap/deploy_src) a pod
// pumpou i verzi a otisk SOUBORU pumpy (WScript.ScriptFullName): verze z
// hlavicky "pumpa vX.Y" se porovna s PUMP_REQUIRED - starsi pumpa = POZOR
// "pumpa je starsi nez kod v modelu" (typicky vendorovana kopie ve workspace
// po zmene pumpy bez refreshe). Otisk = sha256 souboru pumpy (stejna hodnota
// jako PUMP-VERSION workspace, docs\WORKSPACE-METODIKY.md kap. 2).
var PUMP_REQUIRED = "0.6"; // nejnizsi verze pumpy, se kterou tento kod pocita (requests\processing\, stavovy soubor)
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
// --- otisk kodu v modelu + verze/otisk pumpy (FB-PU-02) ---
try { parts.push("" + this.FB_CodeInfo(Repository).text); } catch (eCi) { parts.push("Otisk kodu: nelze precist (" + eCi.message + ")"); }
if (typeof WScript != "undefined") {
    try {
        var pumpPath = "" + WScript.ScriptFullName;
        var pumpBytes = this.FB_FileBytes(pumpPath);
        var pumpText = "";
        if (pumpBytes === null) {
            var stP = this.FB_ComObj("ADODB.Stream");
            stP.Type = 2; stP.Charset = "utf-8"; stP.Open(); stP.LoadFromFile(pumpPath);
            pumpText = "" + stP.ReadText(-1); stP.Close();
        } else { pumpText = this.FB_Utf8Decode(pumpBytes); }
        var pumpHash = "" + this.FB_Sha256(pumpBytes === null ? pumpText : pumpBytes);
        var vm = /pumpa v(\d+)\.(\d+)/.exec(pumpText);
        var pumpVer = vm ? (vm[1] + "." + vm[2]) : "";
        this._fbPumpInfo = { version: pumpVer, fingerprint: pumpHash, path: pumpPath };
        var rq = PUMP_REQUIRED.split("."), hv = pumpVer.split(".");
        var older = (pumpVer == "") || (parseInt(hv[0], 10) < parseInt(rq[0], 10)) || (parseInt(hv[0], 10) == parseInt(rq[0], 10) && parseInt(hv[1], 10) < parseInt(rq[1], 10));
        if (older) {
            parts.push("POZOR: pumpa " + (pumpVer == "" ? "(verze v hlavicce nenalezena)" : "v" + pumpVer) + " je starsi nez kod v modelu (potrebuje pumpu v" + PUMP_REQUIRED + "+): " + pumpPath
                + " - vymen ji za aktualni (spravce: tools\\refresh-workspace.py), stavovy soubor a processing\\ tahle pumpa neumi");
        } else {
            parts.push("Pumpa v" + pumpVer + ", otisk " + pumpHash.substring(0, 12) + " (" + pumpPath + ")");
        }
    } catch (ePu) { parts.push("Verzi pumpy nelze zjistit: " + ePu.message); }
}
parts.push("Session baseline se nedela (sessionBaseline off). Zalohy se poridi automaticky az pred prvnim zapisem - vzdy nad konkretnim balickem, ne nad celou vetvi.");
var out = parts.join(" | ");
this.Log(Repository, out);
return out;
