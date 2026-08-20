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
else if (ItemName == "Stav bridge (kam zapisuje / co cte)") {
    // prehled repozitare, whitelistu (kam smi zapisovat, s cestou), slozky
    var outS = "";
    try { outS = "" + this.FB_Status(Repository); }
    catch (eSt) { outS = "CHYBA nacteni stavu: " + eSt.message; }
    Session.Prompt(outS, 0);
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
else if (ItemName == "About AI Bridge")
    Session.Prompt("AI Code Bridge + EA File Bridge (eafb/0.2)\n"
        + "Executor: operace FB_* (kanon = ea-file-bridge/src, runtime = model).\n"
        + "Rezimy: davka ze schranky | davky ze slozky | AI import (vratny).\n"
        + "Zmeny se vypisuji do Output tabu 'AI Bridge' (cesta + operace).\n"
        + "Protokol: docs/PROTOKOL-EAFB.md v repu ea-file-bridge.", 0);
else
    Session.Output("Unhandled menu item: " + ItemName);
