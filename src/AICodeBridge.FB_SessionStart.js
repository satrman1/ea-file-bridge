// AICodeBridge.FB_SessionStart(Repository)
// START SESSION (pumpa / vratny / FB_Process pri cerstvem session tokenu).
// Vraci textovy souhrn pro konzoli pumpy. Od Baseline politiky (zadani v1.2
// par. 4.8) ma DVE oddelene casti:
//  (1) HLASENI - bezi VZDY (i pri sessionBaseline "off"): identita repa dle
//      FB_RepoId, cesty whitelistovanych balicku, varovani, kdyz ZADNA
//      whitelist polozka neodpovida identite pripojeneho repa (prevence
//      E_REPO). Oprava I4: varovani se odvozuje z identity, NE z poctu
//      vytvorenych zaloh (driv `done == 0` - padalo i pri selhani zaloh).
//  (2) ZALOHA - jen pri sessionBaseline "auto" a jen nad whitelistovanymi
//      balicky POD prahem subtreeMax (FB_SubtreeCount); ostatni se preskoci
//      s hlasenim. Jmeno pod autoPrefix se sufixem " (session)" -> spada pod
//      retenci uklidu (I7; legacy tvar "FB <datum>" se uz nevyrabi). Reuse per
//      (uzivatel, session token): restart pumpy v teze session dalsi zalohu
//      cele vetve nevyrobi. CreateBaseline se kontroluje na navrat i vyjimku
//      (FB_AutoBaseline) - "vytvoreno" od ted neco znamena.
// Bankovni sablona: sessionBaseline "off" - zalohy vznikaji az u zapisu,
// vzdy nad konkretnim balickem, ne nad celou vetvi.
var self = this;
var wl = [];
try { wl = this.FB_Whitelist(); } catch (eWl) { wl = []; }
var ridRaw = "" + this.FB_RepoId(Repository);
var rid = ridRaw.toUpperCase();
var cfg = null;
try { cfg = this.FB_BaselineConfig(Repository).cfg; } catch (eCfg) { cfg = null; }
var mode = (cfg && cfg.sessionBaseline == "auto") ? "auto" : "off";
var mine = [], skippedRepo = 0;
for (var i = 0; i < wl.length; i++) {
    // jen polozky patrici PRIPOJENEMU repozitari (klon = jina identita)
    if (rid.indexOf(("" + wl[i].repo).toUpperCase()) < 0) { skippedRepo++; continue; }
    var pnm = "" + wl[i].pkg, pobj = null;
    try {
        pobj = Repository.GetPackageByGuid("" + wl[i].pkg);
        if (pobj) { pnm = "" + this.FB_ElementPath(Repository, "package", pobj); }
    } catch (ePn) { pobj = null; }
    mine.push({ guid: "" + wl[i].pkg, path: pnm, pkg: pobj });
}
var parts = [];
var paths = [];
for (var m = 0; m < mine.length; m++) { paths.push(mine[m].path + (mine[m].pkg ? "" : " (balicek v modelu NENALEZEN)")); }
parts.push("Repozitar: " + ridRaw);
parts.push("Whitelist (kam smi bridge zapisovat): " + (paths.length > 0 ? paths.join(", ") : "(zadny balicek)"));
if (skippedRepo > 0) { parts.push(skippedRepo + " polozek whitelistu patri jinemu repozitari"); }
if (mine.length == 0) {
    parts.push("POZOR: zadna whitelist polozka neodpovida pripojenemu repozitari - zapisy budou zamitnuty (E_REPO). Identita: "
        + ridRaw + " | Pripojeni: " + Repository.ConnectionString);
}
// --- (2) zaloha ---
if (mine.length > 0 && mode == "off") {
    parts.push("Session baseline vypnuta (sessionBaseline off). Zalohy se poridi automaticky az pred prvnim zapisem - vzdy nad konkretnim balickem, ne nad celou vetvi.");
} else if (mine.length > 0) {
    var tok = null;
    try { tok = this.FB_SessionToken(Repository, cfg); } catch (eTok) { tok = null; }
    var made = [], reused = [], over = [], fail = [];
    var max = (cfg && typeof cfg.subtreeMax == "number") ? cfg.subtreeMax : 5000;
    for (var k = 0; k < mine.length; k++) {
        var it = mine[k];
        if (!it.pkg) { fail.push(it.path + " (nenalezen)"); continue; }
        var pr = null;
        try { pr = this.FB_SubtreeCount(Repository, it.pkg.PackageID, cfg, (cfg ? cfg.probeBudgetTotalMs : 2000)); } catch (ePr) { pr = null; }
        if (!pr || pr.status != "ok") { over.push(it.path + " (velikost neznama" + (pr && pr.why ? ": " + pr.why : "") + ")"); continue; }
        if (pr.elements > max) { over.push(it.path + " (" + pr.elements + " prvku > " + max + ")"); continue; }
        var r = null;
        try { r = this.FB_AutoBaseline(Repository, it.guid, cfg, tok, "LOW", true); }
        catch (eAb) { r = { status: "failed", why: "" + eAb.message }; }
        if (r && r.status == "created") { made.push(it.path + " [" + r.name + "]"); }
        else if (r && r.status == "reused") { reused.push(it.path + " [" + r.name + "]"); }
        else { fail.push(it.path + " (" + (r ? r.why : "?") + ")"); }
    }
    if (made.length > 0) { parts.push("Session baseline (zaloha pred zapisem) vytvorena nad: " + made.join(", ")); }
    if (reused.length > 0) { parts.push("Session baseline teto session uz existuje: " + reused.join(", ")); }
    if (over.length > 0) { parts.push("Session baseline preskocena (nad limitem) - zalohy vzniknou az u zapisu: " + over.join(", ")); }
    if (fail.length > 0) { parts.push("POZOR: session baseline SELHALA: " + fail.join(", ") + " - zalohy vzniknou az u zapisu"); }
}
var out = parts.join(" | ");
this.Log(Repository, out);
return out;
