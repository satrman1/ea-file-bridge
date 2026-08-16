// AICodeBridge.EA_MenuClick - obsluha kliknuti (vzor: vendor MyDemoAddin)
// v0.2 - GUI fallback File Bridge (akceptacni kriterium 4 iterace 1)
if (ItemName == "Process requests (File Bridge)") {
    var out = "" + this.FB_ProcessFolder(Repository);
    Session.Output("[AI Bridge] " + out);
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
