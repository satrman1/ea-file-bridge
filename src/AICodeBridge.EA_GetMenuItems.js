// AICodeBridge.EA_GetMenuItems - definice menu (vzor: vendor TypeInfo, eaexample.qea)
// Prefix "-" = submenu; bez & akceleratoru (konvence model add-inu).
// 2026-08-20 (Milos UX): uklid menu - odebrana legacy polozka
// "Process requests (#AI-CODE)" (predbridgeovy kanal, matla); polozky
// prejmenovany lidsky a serazeny primarni-prvni; pribyl "Stav bridge".
// Iterace 5 (B-V3): polozka "Nav spike (test navigace)" JEN kdyz ma repo
// v FB_Config navProbe: true (spike nepatri do PROD menu).
// v0.20 (FB-PU-43, Z261004b-7): polozka "Zapnout AI import rezim (vratny)" JEN
// kdyz ma repo v FB_Config gatekeeper: true - v bance se vratny nenasazuje
// (antivir: skryty powershell hlidajici schranku = signatura "Dropper"), ale
// bootstrap jeho kod do modelu nahral a menu ho nabizelo vzdy; jeden klik bez
// dotazu spoustel proces, ktery bankovni ochrana muze vyhodnotit jako incident.
// Stejna podminka je v FB_GatekeeperLaunch (druha obrana) + dotaz Ano/Ne.
if (MenuName == "-AI Bridge") {
    var cfgM = null;
    try {
        var cfgsM = this.FB_Config();
        var ridM = ("" + this.FB_RepoId(Repository)).toUpperCase();
        for (var cm = 0; cm < cfgsM.length; cm++) {
            if (ridM.indexOf(("" + cfgsM[cm].repo).toUpperCase()) >= 0) { cfgM = cfgsM[cm]; break; }
        }
    } catch (eCm) { cfgM = null; }
    var items = [
        "Zpracovat davku ze schranky",
        "Zpracovat davky ze slozky (requests)"
    ];
    if (cfgM != null && cfgM.gatekeeper === true) { items.push("Zapnout AI import rezim (vratny)"); }
    items.push(
        "-",
        "Stav bridge (kam zapisuje / co cte)",
        // Cil zapisu (FB-UX-03, O6 = a, Z261004b-11): identita vyberu ve
        // stromu (repozitar, typ, GUID, plna cesta, writeCheck) do schranky
        // pro schrankovy kanal (M365 Copilot) - jen identita, nikdy obsah.
        // Nova polozka menu = plny restart EA (PROTOKOL par. 1a).
        "Kontext vyberu do schranky (pro Copilota)",
        // Baseline politika par. 6.3/5 (Z260907-5): nova polozka menu se
        // v EA projevi az po PLNEM RESTARTU EA (PROTOKOL par. 1a)
        "Uklid automatickych baselines (ukazat / provest)",
        "About AI Bridge"
    );
    if (cfgM != null && cfgM.navProbe === true) {
        items.push("-");
        items.push("Nav spike (test navigace)");
    }
    return items;
}
else
    return "-AI Bridge";
