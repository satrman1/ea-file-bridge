// AICodeBridge.EA_GetMenuItems - definice menu (vzor: vendor TypeInfo, eaexample.qea)
// Prefix "-" = submenu; bez & akceleratoru (konvence model add-inu)
// iterace 4: "Zapnout AI import rezim" = launcher vratneho (FB_GatekeeperLaunch)
if (MenuName == "-AI Bridge")
    return ["Zapnout AI import rezim (vratny)", "Process requests (File Bridge)", "Process requests (#AI-CODE)", "-", "About AI Bridge"];
else
    return "-AI Bridge";
