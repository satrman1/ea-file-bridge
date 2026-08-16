// AICodeBridge.EA_GetMenuItems - definice menu (vzor: vendor TypeInfo, eaexample.qea)
// Prefix "-" = submenu; bez & akceleratoru (konvence model add-inu)
if (MenuName == "-AI Bridge")
    return ["Process requests (File Bridge)", "Process requests (#AI-CODE)", "-", "About AI Bridge"];
else
    return "-AI Bridge";
