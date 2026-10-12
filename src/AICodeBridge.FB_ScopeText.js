// AICodeBridge.FB_ScopeText(Repository)
// LIDSKA VETA o cili zapisu (zadani cil zapisu v1.2 kap. 5.11, FB-CZ-27;
// Z261004b-11) - JEDNO misto, ze ktereho berou tutez vetu start session
// (konzole pumpy), menu "Stav bridge" (dialog EA) a ping (writeScope.summary),
// aby clovek videl vsude totez. K tomu poznamky pro agenta (ping
// writeScope.agentNotes - kit Z261004b-4 je prebira): pravidlo vazeb "oba
// konce", zamky EA nehlidaji vazby, jmena v davce se dohledavaji predem ($N),
// kaskady mazani podle cascadeDelete, co delat pri E_BLACKLIST.
// Vraci { ok, repoKnown, securityEnabled, cascadeDelete, sentence, problems[],
//         warnings[], agentNotes[], cfg } - nikdy nevyhazuje (chyba cteni =
// veta "POZOR ...", ok false). Konfiguraci cte cerstve (this._fbScopeCfg = null).
function hasAllowInFalse(c) { for (var k = 0; k < c.blacklist.length; k++) { if (c.blacklist[k].allowIncomingRefs === false) { return true; } } return false; }
var out = { ok: false, repoKnown: false, securityEnabled: false, cascadeDelete: "block", sentence: "", problems: [], warnings: [], agentNotes: [], cfg: null };
var ridRaw = "";
try { ridRaw = "" + this.FB_RepoId(Repository); } catch (eR) { ridRaw = "?"; }
try { out.securityEnabled = (Repository.IsSecurityEnabled === true); } catch (eSe) { out.securityEnabled = false; }
var ws = null;
try { this._fbScopeCfg = null; ws = this.FB_WriteScopeCfg(Repository); } catch (eWs) { ws = null; }
out.cfg = ws;
if (ws == null) {
    out.sentence = "POZOR: konfiguraci cile zapisu (FB_WriteScope) nelze precist - zapisy skonci E_SCOPE_CONFIG";
    return out;
}
out.repoKnown = ws.repoKnown;
if (!ws.repoKnown) {
    out.sentence = "POZOR: repozitar nema polozku ve FB_WriteScope - zapisy budou zamitnuty (E_REPO). Identita: " + ridRaw;
    try { out.sentence += " | Pripojeni: " + Repository.ConnectionString; } catch (eC) { }
    return out;
}
out.ok = true;
out.cascadeDelete = "" + (ws.cascadeDelete || "block");
out.problems = ws.problems || [];
out.warnings = ws.warnings || [];
var bl = [];
for (var b = 0; b < ws.blacklist.length; b++) {
    var w = ws.blacklist[b];
    bl.push((w.found ? w.path : (w.name || w.pkg) + " (NENALEZEN)") + (w.note ? " [" + w.note + "]" : ""));
}
var im = [];
for (var i = 0; i < ws.implicit.length; i++) { im.push(ws.implicit[i].path || ws.implicit[i].name); }
out.sentence = "Zapis: blacklist (" + ws.blacklist.length + " chranenych vetvi) | EA security " + (out.securityEnabled ? "zapnuta" : "vypnuta")
    + " | chraneno: " + (bl.length > 0 ? bl.join(", ") : "(nic na blacklistu)")
    + " | bridge chrani i sam sebe: " + (im.length > 0 ? im.join(", ") : "(balicek add-inu/auditu nedohledan)")
    + " | kaskady mazani do chranene casti: " + (out.cascadeDelete == "allow" ? "povoleny s varovanim v okne (cascadeDelete = allow)" : "zakazane, E_BLACKLIST (cascadeDelete = block)");
if (!out.securityEnabled) { out.warnings = out.warnings.concat(["EA security je vypnuta - jedinou hranici zapisu je blacklist a implicitni ochrana (O2 = b)"]); }
out.agentNotes = [
    "Kam psat: kamkoli, kam pusti EA security, krome chranenych vetvi (blacklist dedicne na podstrom + balicek auditu a balicek add-inu). Pred prvnim zapisem rekni cloveku jednou vetou 'Zapisu do: <plna cesta>'.",
    "E_BLACKLIST prijde uz v predbezne kontrole (pred oknem i zalohou): davku neopakuj ani nedel, pozadej cloveka o jiny cil. E_AMBIGUOUS: vyber kandidata GUIDem nebo cestou {path: [...]}.",
    "Vazba (i zprava) je chranena, JEN kdyz jsou OBA jeji konce v chranene casti - s jednim koncem venku se da zalozit, zmenit i smazat, at vede kterymkoli smerem; presmerovani se posuzuje nad novym parem koncu" + (hasAllowInFalse(ws) ? "; vetev s allowIncomingRefs: false nepusti novou vazbu z volne casti do sebe" : "") + ".",
    "Zamky EA (security) hlidaji prvky (E_PERMISSION pri zalozeni, E_LOCKED pri zmene), vazby ne - most zamky u vazeb nekontroluje (rozhodnuti 12. 10. 2026): vazbu z/do zamceneho prvku jde zalozit, zmenit i smazat. Po E_PERMISSION/E_LOCKED cti items + partial, nepokracuj naslepo.",
    "Jmena v zapisove davce se dohledavaji PRED provedenim - na prvek zalozeny drivejsi operaci teze davky odkazuj $N, jmenem ho nenajdes (E_NOT_FOUND).",
    (out.cascadeDelete == "allow"
        ? "Mazani volneho objektu, ktere by kaskadou EA sahlo do chranene casti (lezi na chranenem diagramu / je klasifikatorem chranene instance), PROJDE - clovek dostane vycet kaskad v potvrzovacim okne a odpoved nese warnings[]; zaloha chraneny balicek nekryje."
        : "Mazani volneho objektu, ktere by kaskadou EA sahlo do chranene casti (lezi na chranenem diagramu / je klasifikatorem chranene instance), konci E_BLACKLIST uz v predbezne kontrole (cascadeDelete = block).")
];
return out;
