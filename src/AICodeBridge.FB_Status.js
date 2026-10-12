// AICodeBridge.FB_Status(Repository)
// Prehled "kam bridge zapisuje a co cte" pro uzivatele (menu "Stav bridge").
// Odpovida na Milosovy otazky: nad kterym repozitarem jsem, do ktere slozky
// (balicku) NESMIM zapisovat (blacklist s cestou), co ctu. Vraci text pro dialog
// + zapise do Output tabu "AI Bridge".
var self = this;
var rid = "" + this.FB_RepoId(Repository);
var lines = [];
lines.push("=== EA File Bridge - stav ===");
lines.push("");
lines.push("Repozitar (identita): " + rid);
lines.push("Pripojeni: " + Repository.ConnectionString);
lines.push("");
// cil zapisu (rezim blacklist, Z261004b-10/-11): kam bridge NESMI; jinak
// rozhoduje EA security (zamky). Veta = FB_ScopeText (tataz jako start
// session a ping, FB-CZ-27) + rozpis vetvi s GUIDy.
var st = null;
try { st = this.FB_ScopeText(Repository); } catch (eSt) { st = null; }
var ws = st ? st.cfg : null;
lines.push("ZAPIS: rezim blacklist - bridge pise kamkoli, kam smi uzivatel podle EA security (" + (st && st.securityEnabled ? "zapnuta" : "VYPNUTA") + "), KROME techto vetvi:");
if (ws == null || !ws.repoKnown) {
    lines.push("  (repozitar nema polozku ve FB_WriteScope -> vsechny zapisy budou odmitnuty, E_REPO)");
} else {
    for (var i = 0; i < ws.blacklist.length; i++) {
        var w = ws.blacklist[i];
        lines.push("  - " + (w.found ? w.path : (w.name || "?") + " (NENALEZEN)") + "   [" + w.pkg + "]" + (w.note ? "  " + w.note : "") + (w.allowIncomingRefs === false ? "  (bez prichozich vazeb z volne casti)" : ""));
    }
    if (ws.blacklist.length == 0) { lines.push("  (blacklist je prazdny)"); }
    for (var k = 0; k < ws.implicit.length; k++) { lines.push("  - " + (ws.implicit[k].path || ws.implicit[k].name) + "   (bridge chrani sam sebe: " + ws.implicit[k].note + ")"); }
    lines.push("  Kaskady mazani do chranene casti: " + (st.cascadeDelete == "allow" ? "povoleny s varovanim v potvrzovacim okne (cascadeDelete = allow)" : "zakazane - E_BLACKLIST (cascadeDelete = block)"));
    lines.push("  Vazby: chranena je jen vazba s OBEMA konci v chranene casti; zamky EA vazby nehlidaji (most je u vazeb nekontroluje).");
    if (ws.problems.length > 0) { lines.push("  CHYBA KONFIGURACE (E_SCOPE_CONFIG, zapisy zastavene, cteni bezi): " + ws.problems.join(" | ")); }
    if (st.warnings.length > 0) { lines.push("  Upozorneni: " + st.warnings.join(" | ")); }
}
lines.push("");
lines.push("Souhrn (totez hlasi start session a ping): " + (st ? st.sentence : "?"));
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
