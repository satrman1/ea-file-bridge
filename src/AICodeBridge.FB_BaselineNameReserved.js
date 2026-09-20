// AICodeBridge.FB_BaselineNameReserved(Repository, name)
// true = jmeno baseline lezi v REZERVOVANEM jmennem prostoru automatickych
// baselines (Baseline politika v1.2 par. 6.1, podminka 4 / B4). Jediny test
// sdileny FB_OpBaselineCreate (E_ARGS) a FB_RiskGate (eskalace) - dve kopie
// by se rozjely. Zamerne SIRSI nez celotvarovy vzor uklidu: porovnava se
// case-insensitive, po oriznuti uvodnich bilych znaku jmena a BEZ koncove
// mezery prefixu ("FB-AUTO", "fb-auto x", "  FB-AUTO x" = rezervovano;
// "FB 2026-...", "AI-pre-...", "Pred refaktorem" = volne).
// Prefix z FB_BaselineConfig (default "FB-AUTO "); chyba konfigurace =
// default prefix (rezervace nikdy nevypadne).
var prefix = "FB-AUTO ";
try {
    var c = this.FB_BaselineConfig(Repository);
    if (c && c.cfg && typeof c.cfg.autoPrefix == "string" && c.cfg.autoPrefix != "") { prefix = c.cfg.autoPrefix; }
} catch (eC) { prefix = "FB-AUTO "; }
var p = prefix.replace(/\s+$/, "").toLowerCase();
var n = ("" + name).replace(/^\s+/, "").toLowerCase();
if (p == "") { return false; }
// vzdy hlidej i vychozi prefix (kdyby politika prefix zmenila, stare
// automaticke baselines pod "FB-AUTO " porad existuji)
return n.indexOf(p) == 0 || n.indexOf("fb-auto") == 0;
