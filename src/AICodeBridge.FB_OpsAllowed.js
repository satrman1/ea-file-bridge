// AICodeBridge.FB_OpsAllowed()
// WHITELIST OPERACI executoru (iterace 3, K4) - konfiguracni sekce vedle
// whitelistu packages (FB_Whitelist). Nahrada domaci MCP mechaniky
// -enableDelete / -enableEdit: co tady neni povolene, executor odmitne
// s E_OP_FORBIDDEN, i kdyby package whitelist prosel.
//
// Mechanika:
//   - CTECI operace (ping, query, get_*, find_*, baseline list/diff) jsou
//     povolene VZDY - whitelist se na ne nevztahuje (vynuceno ve FB_Main).
//   - ZAPISOVE operace: povoleny jen kdyz je repo nalezeno a operace prochazi
//     allow/deny. deny ma prednost pred allow. "*" v allow = vsechny.
//   - Repozitar bez polozky = ZADNA zapisova operace (fail-secure).
//   - Zmena tohoto souboru = zmena kodu v modelu = auditovatelna udalost
//     (baseline), stejne jako u FB_Whitelist.
//
// Doporuceni pro banku (politika P1, emr-zapis-pravidla.md par. 12a+12g):
//   { repo: "<TEST-DB>", allow: ["*"],
//     deny: ["delete_from_model", "delete_taggedvalue_from_model",
//            "remove_elements_from_diagram", "clone_package", "clone_elements",
//            "deploy_src"] }
// (delete operace se zapinaji az v P2+, deploy_src je VYHRADNE dev operace.)
//
// eaexample (dev stanice) - vse povolene:
return [
    { repo: "EAEXAMPLE.QEA", allow: ["*"], deny: [] }
];
