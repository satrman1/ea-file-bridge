// AICodeBridge.FB_Status(Repository)
// Prehled "kam bridge zapisuje a co cte" pro uzivatele (menu "Stav bridge").
// Odpovida na Milosovy otazky: nad kterym repozitarem jsem, do ktere slozky
// (balicku) smim zapisovat (whitelist s cestou), co ctu. Vraci text pro dialog
// + zapise do Output tabu "AI Bridge".
var self = this;
var rid = "" + this.FB_RepoId(Repository);
var lines = [];
lines.push("=== EA File Bridge - stav ===");
lines.push("");
lines.push("Repozitar (identita): " + rid);
lines.push("Pripojeni: " + Repository.ConnectionString);
lines.push("");
// cil zapisu (rezim blacklist, Z261004b-10): kam bridge NESMI; jinak rozhoduje
// EA security (zamky). Lidske vety doladuje Z261004b-11 (FB-CZ-27).
var ws = null;
try { this._fbScopeCfg = null; ws = this.FB_WriteScopeCfg(Repository); } catch (eWs) { ws = null; }
var secOn = false;
try { secOn = (Repository.IsSecurityEnabled === true); } catch (eSe) { }
lines.push("ZAPIS: rezim blacklist - bridge pise kamkoli, kam smi uzivatel podle EA security (" + (secOn ? "zapnuta" : "VYPNUTA") + "), KROME techto vetvi:");
if (ws == null || !ws.repoKnown) {
    lines.push("  (repozitar nema polozku ve FB_WriteScope -> vsechny zapisy budou odmitnuty, E_REPO)");
} else {
    for (var i = 0; i < ws.blacklist.length; i++) {
        var w = ws.blacklist[i];
        lines.push("  - " + (w.found ? w.path : (w.name || "?") + " (NENALEZEN)") + "   [" + w.pkg + "]" + (w.note ? "  " + w.note : ""));
    }
    if (ws.blacklist.length == 0) { lines.push("  (blacklist je prazdny)"); }
    for (var k = 0; k < ws.implicit.length; k++) { lines.push("  - " + (ws.implicit[k].path || ws.implicit[k].name) + "   (bridge chrani sam sebe: " + ws.implicit[k].note + ")"); }
    if (ws.problems.length > 0) { lines.push("  CHYBA KONFIGURACE (E_SCOPE_CONFIG, zapisy zastavene): " + ws.problems.join(" | ")); }
}
lines.push("");
lines.push("CTENI (dotazy SELECT / get_*) je povoleno kdekoli v modelu.");
lines.push("Kazda zapisova davka je klasifikovana (Risk Gate); mazani, klonovani");
lines.push("a hromadne zmeny vyzaduji tve potvrzeni v dialogu.");
lines.push("");
lines.push("Slozka vymeny souboru: " + this.FB_ResolveBaseDir(Repository));
lines.push("Zmeny se prubezne vypisuji do Output tabu 'AI Bridge' (cesta + operace).");
var txt = lines.join("\n");
try { this.Log(Repository, txt); } catch (eL) { }
return txt;
