// AICodeBridge.EA_MenuClick - obsluha kliknuti (vzor: vendor MyDemoAddin)
// 2026-08-20 (Milos UX): lidske nazvy, novy "Stav bridge", legacy #AI-CODE
// polozka odebrana. Kazda vetev v try/catch - tiche selhani je nepripustne
// (chyba se MUSI ukazat v dialogu).
if (ItemName == "Zpracovat davku ze schranky") {
    // plne rucni clipboard rezim (fallback bez PowerShellu): Copy -> klik ->
    // EA cte schranku, zpracuje, chat verzi vlozi zpet do schranky + dialog
    var outC = "";
    try { outC = "" + this.FB_ClipboardImport(Repository); }
    catch (eCl) { outC = "CHYBA clipboard rezimu: " + eCl.message; }
    try { Session.Output("[AI Bridge] " + outC); } catch (eOC) { }
    Session.Prompt("File Bridge - davka ze schranky:\n\n" + outC, 0);
}
else if (ItemName == "Zpracovat davky ze slozky (requests)") {
    // GUI fallback: zpracuje vsechny req-*.json ze slozky requests\
    var out = "";
    try { out = "" + this.FB_ProcessFolder(Repository); }
    catch (eFB) { out = "CHYBA zpracovani slozky: " + eFB.message; }
    try { Session.Output("[AI Bridge] " + out); } catch (eO) { }
    Session.Prompt("File Bridge - davky ze slozky:\n\n" + out, 0);
}
else if (ItemName == "Zapnout AI import rezim (vratny)") {
    // launcher vratneho (automaticky rezim pres PowerShell)
    var outG = "";
    try { outG = "" + this.FB_GatekeeperLaunch(Repository); }
    catch (eGk) { outG = "CHYBA launcheru vratneho: " + eGk.message; }
    try { Session.Output("[AI Bridge] " + outG); } catch (eOG) { }
    Session.Prompt("AI import rezim:\n\n" + outG, 0);
}
else if (ItemName == "Kontext vyberu do schranky (pro Copilota)") {
    // FB-UX-03 (Z261004b-11): identita vyberu ve stromu do schranky pro
    // schrankovy kanal - repozitar, typ, GUID, plna cesta, writeCheck
    var outK = "";
    try { outK = "" + this.FB_ClipboardContext(Repository); }
    catch (eKx) { outK = "CHYBA kontextu vyberu: " + eKx.message; }
    Session.Prompt(outK, 0);
}
else if (ItemName == "Stav bridge (kam zapisuje / co cte)") {
    // prehled repozitare, blacklistu (kam NESMI zapisovat, s cestou), slozky
    var outS = "";
    try { outS = "" + this.FB_Status(Repository); }
    catch (eSt) { outS = "CHYBA nacteni stavu: " + eSt.message; }
    Session.Prompt(outS, 0);
}
else if (ItemName == "Uklid automatickych baselines (ukazat / provest)") {
    // Baseline politika par. 6.3/5: report vzdy; "provest" = mode delete s
    // force (bez stropu maxDeletesPerRun, strop anomalie plati) JEN po
    // vyslovnem Ano a jen pro write skupinu. PRVNI OSTRE MAZANI ma probehnout
    // odsud, pod dohledem (dispozice 4). Aktivace polozky = plny restart EA.
    var outU = "";
    try {
        var cU = this.FB_BaselineConfig(Repository);
        var cfgU = cU.cfg;
        var repU = this.FB_BaselineCleanup(Repository, cfgU, "report", true);
        outU = "" + repU.text;
        if (cU.valid === false) {
            // vadna politika = jen ukazat (s bezpecnymi defaulty), nikdy mazat (M3)
            outU += "\n\nPOZOR: sekce baseline ve FB_RiskPolicy je nevalidni (" + cU.why + ") - mazani z menu je vypnute, oprav politiku.";
        } else if (repU.candidates.length > 0 && !repU.anomaly) {
            var ansU = Session.Prompt(outU + "\n\nANO = tyto baselines TED SMAZAT (nevratne)   |   NE / Storno = jen ukazat", 3);
            if (ansU == 3) {
                var delU = this.FB_BaselineCleanup(Repository, cfgU, "delete", true);
                outU = "" + delU.text;
            } else { outU = ""; }
        }
    } catch (eUk) { outU = "CHYBA uklidu baselines: " + eUk.message; }
    if (outU != "") {
        try { Session.Output("[AI Bridge] " + outU); } catch (eOU) { }
        Session.Prompt(outU, 0);
    }
}
else if (ItemName == "Nav spike (test navigace)") {
    // SPIKE iterace 5 (B-V3): krokovaci sonda navigacnich COM volani.
    // Pad kroku NENI zachytitelny (par. 1a/4) - vyhodnoceni podle Output
    // tabu (START bez OK). Postup: docs/e2e-iterace5/SPIKE-NAV.md.
    var outN = "";
    try { outN = "" + this.FB_NavProbe(Repository); }
    catch (eNv) { outN = "CHYBA NavProbe (zachytitelna JS vetev): " + eNv.message; }
    Session.Prompt("Nav spike:\n\n" + outN, 0);
}
else if (ItemName == "About AI Bridge") {
    // FB-PU-02 (pumpa v0.6, Z261004b-5): About ukazuje otisk kodu v modelu
    var aboutCode = "";
    try { aboutCode = "" + this.FB_CodeInfo(Repository).text; } catch (eAb) { aboutCode = "Otisk kodu: nelze precist (" + eAb.message + ")"; }
    Session.Prompt("AI Code Bridge + EA File Bridge (eafb/0.2)\n"
        + aboutCode + "\n"
        + "Executor: operace FB_* (kanon = ea-file-bridge/src, runtime = model).\n"
        + "Rezimy: pumpa (pump.wsf) | davka ze schranky | davky ze slozky | AI import (vratny).\n"
        + "Zmeny se vypisuji do Output tabu 'AI Bridge' (cesta + operace).\n"
        + "Protokol: docs/PROTOKOL-EAFB.md v repu ea-file-bridge.", 0);
}
else
    Session.Output("Unhandled menu item: " + ItemName);
