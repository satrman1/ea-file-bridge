// AICodeBridge.FB_NavProbe(Repository)
// SPIKE iterace 5 (B-V3): krokovaci sonda bezpecnosti navigacnich COM volani
// v EA runtime. Kontext: Repository.ShowInProjectView(el) 2026-08-20 shodilo
// CELY add-in NEZACHYTITELNOU COM chybou (par. 1a/4) -> FB_ShowInBrowser je
// default vypnuto. Sonda zjistuje, KTERE volani a v JAKEM kontextu pada.
// PRINCIP: KAZDY KLIK = JEDEN KROK (pripadny pad zabije invokaci - vice
// kroku najednou by znemoznilo urcit viníka). Stav = in-memory _fbNavStep
// (zanika restartem EA). Pred krokem se zapise "krok N: ... - START" do
// Output tabu; kdyz po kliku chybi radek "OK", padl prave ten krok.
// Postup a vyhodnoceni: docs/e2e-iterace5/SPIKE-NAV.md. Menu polozka je
// videt jen s FB_Config navProbe: true (spike nepatri do PROD menu).
// Kroky (cil = element AICodeBridge, existuje v kazdem repu s bridge):
//  1 RefreshModelView(0)              - refresh celeho modelu
//  2 RefreshModelView(packageID)      - refresh package bridge
//  3 ShowInProjectView(GetElementByID)
//  4 ShowInProjectView(GetElementByGuid)
//  5 RunModelSearch("FB_Changes", "") - automaticke otevreni vysledku hledani
var self = this;
function L(m) { try { self.Log(Repository, m); } catch (e) { } }
var step = (typeof this._fbNavStep == "number") ? this._fbNavStep : 1;
var bridgeId = -1, bridgeGuid = "", bridgePkg = 0;
try {
    var br = this.FB_XmlRows(Repository.SQLQuery(
        "SELECT Object_ID, ea_guid, Package_ID FROM t_object WHERE Name = 'AICodeBridge' AND Stereotype = 'JavascriptAddin'"));
    if (br.length > 0) {
        bridgeId = parseInt(br[0].Object_ID, 10);
        bridgeGuid = "" + br[0].ea_guid;
        bridgePkg = parseInt(br[0].Package_ID || "0", 10);
    }
} catch (eBr) { }
if (bridgeId < 0) { return "NavProbe: element AICodeBridge nenalezen - sonda nema cil."; }
var DESC = {
    1: "RefreshModelView(0) - cely model",
    2: "RefreshModelView(" + bridgePkg + ") - package bridge",
    3: "ShowInProjectView(GetElementByID " + bridgeId + ")",
    4: "ShowInProjectView(GetElementByGuid)",
    5: "RunModelSearch('FB_Changes') - automaticke okno vysledku"
};
L("NavProbe krok " + step + ": " + DESC[step] + " - START (kdyz chybi OK, padl tento krok)");
// !! COM pad tady NENI zachytitelny try/catch (par. 1a/4) - try/catch je jen
// pro bezne JS chyby; nezachytitelny pad se pozna podle chybejiciho OK.
if (step == 1) {
    Repository.RefreshModelView(0);
} else if (step == 2) {
    Repository.RefreshModelView(bridgePkg);
} else if (step == 3) {
    var e1 = Repository.GetElementByID(bridgeId);
    Repository.ShowInProjectView(e1);
} else if (step == 4) {
    var e2 = Repository.GetElementByGuid(bridgeGuid);
    Repository.ShowInProjectView(e2);
} else {
    Repository.RunModelSearch("FB_Changes", "" + (this._fbLastWriteReqId || ""), "", "");
}
L("NavProbe krok " + step + ": OK");
this._fbNavStep = (step >= 5) ? 1 : (step + 1);
return "NavProbe krok " + step + " (" + DESC[step] + "): OK. Dalsi klik = krok " + this._fbNavStep + ".";
