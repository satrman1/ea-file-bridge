// AICodeBridge.EA_MenuClick - obsluha kliknuti (vzor: vendor MyDemoAddin)
// v0.2 - GUI fallback File Bridge (akceptacni kriterium 4 iterace 1)
// 20260817: try/catch kolem FB_ProcessFolder - chyba se MUSI ukazat v dialogu,
// tiche selhani ("nic se nestalo") je nepripustne.
if (ItemName == "Zapnout AI import rezim (vratny)") {
    // iterace 4: launcher vratneho - chyba se MUSI ukazat (zadne tiche selhani)
    var outG = "";
    try {
        outG = "" + this.FB_GatekeeperLaunch(Repository);
    } catch (eGk) {
        outG = "CHYBA launcheru vratneho: " + eGk.message;
    }
    try { Session.Output("[AI Bridge] " + outG); } catch (eOG) { }
    Session.Prompt("AI import rezim:\n\n" + outG, 0);
}
else if (ItemName == "Zpracuj davku ze schranky (File Bridge)") {
    // plne rucni clipboard rezim (fallback bez PowerShellu) - cte davku ze
    // schranky zevnitr EA, zpracuje, chat verzi vlozi zpet do schranky
    var outC = "";
    try {
        outC = "" + this.FB_ClipboardImport(Repository);
    } catch (eCl) {
        outC = "CHYBA clipboard rezimu: " + eCl.message;
    }
    try { Session.Output("[AI Bridge] " + outC); } catch (eOC) { }
    Session.Prompt("File Bridge - davka ze schranky:\n\n" + outC, 0);
}
else if (ItemName == "Process requests (File Bridge)") {
    var out = "";
    try {
        out = "" + this.FB_ProcessFolder(Repository);
    } catch (eFB) {
        out = "CHYBA GUI fallbacku: " + eFB.message;
    }
    try { Session.Output("[AI Bridge] " + out); } catch (eO) { }
    Session.Prompt("File Bridge - GUI fallback:\n\n" + out, 0);
}
else if (ItemName == "Process requests (#AI-CODE)")
    this.ProcessRequests(Repository);
else if (ItemName == "About AI Bridge")
    Session.Prompt("AI Code Bridge + EA File Bridge (eafb/0.2)\n"
        + "Executor: operace FB_* (kanon = ea-file-bridge/src, runtime = model).\n"
        + "Pumpa: pump.wsf (dev) | GUI fallback: Process requests (File Bridge).\n"
        + "Protokol: docs/PROTOKOL-EAFB.md v repu ea-file-bridge.", 0);
else
    Session.Output("Unhandled menu item: " + ItemName);
