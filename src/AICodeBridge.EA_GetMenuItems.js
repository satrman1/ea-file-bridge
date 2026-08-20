// AICodeBridge.EA_GetMenuItems - definice menu (vzor: vendor TypeInfo, eaexample.qea)
// Prefix "-" = submenu; bez & akceleratoru (konvence model add-inu).
// 2026-08-20 (Milos UX): uklid menu - odebrana legacy polozka
// "Process requests (#AI-CODE)" (predbridgeovy kanal, matla); polozky
// prejmenovany lidsky a serazeny primarni-prvni; pribyl "Stav bridge".
// Iterace 5 (B-V3): polozka "Nav spike (test navigace)" JEN kdyz ma repo
// v FB_Config navProbe: true (spike nepatri do PROD menu).
if (MenuName == "-AI Bridge") {
    var items = [
        "Zpracovat davku ze schranky",
        "Zpracovat davky ze slozky (requests)",
        "Zapnout AI import rezim (vratny)",
        "-",
        "Stav bridge (kam zapisuje / co cte)",
        "About AI Bridge"
    ];
    try {
        var cfgs = this.FB_Config();
        var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
        for (var ci = 0; ci < cfgs.length; ci++) {
            if (rid.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) {
                if (cfgs[ci].navProbe === true) {
                    items.push("-");
                    items.push("Nav spike (test navigace)");
                }
                break;
            }
        }
    } catch (eNp) { }
    return items;
}
else
    return "-AI Bridge";
