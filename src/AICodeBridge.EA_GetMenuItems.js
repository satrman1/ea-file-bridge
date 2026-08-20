// AICodeBridge.EA_GetMenuItems - definice menu (vzor: vendor TypeInfo, eaexample.qea)
// Prefix "-" = submenu; bez & akceleratoru (konvence model add-inu).
// 2026-08-20 (Milos UX): uklid menu - odebrana legacy polozka
// "Process requests (#AI-CODE)" (predbridgeovy kanal, matla); polozky
// prejmenovany lidsky a serazeny primarni-prvni; pribyl "Stav bridge".
if (MenuName == "-AI Bridge")
    return [
        "Zpracovat davku ze schranky",
        "Zpracovat davky ze slozky (requests)",
        "Zapnout AI import rezim (vratny)",
        "-",
        "Stav bridge (kam zapisuje / co cte)",
        "About AI Bridge"
    ];
else
    return "-AI Bridge";
