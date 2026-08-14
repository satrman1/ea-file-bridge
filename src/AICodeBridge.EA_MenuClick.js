// AICodeBridge.EA_MenuClick - obsluha kliknuti (vzor: vendor MyDemoAddin)
// v0.1.1 - nasazeno pres AI Bridge (E2E test deploy vetve)
if (ItemName == "Process requests (#AI-CODE)")
    this.ProcessRequests(Repository);
else if (ItemName == "About AI Bridge")
    Session.Prompt("AI Code Bridge v0.1.1 (2026-07-19)\n"
        + "Tato verze byla nasazena bridgem samotnym (REQ-02).\n"
        + "HITL executor pro vyvoj in-model add-inu pres MCP.\n"
        + "Inbox: #AI-CODE | Protokol: IT-ANALYSIS/addin-bridge/PROTOKOL.md", 0);
else
    Session.Output("Unhandled menu item: " + ItemName);
