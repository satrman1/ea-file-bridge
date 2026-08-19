// AICodeBridge.FB_Process(Repository, SearchText, XMLResults)
// VSTUPNI BOD VRATNEHO (iterace 4) - metoda pro Add-in Search "FB_Process".
// EA 17.1.5 nema search typu Script - definice hledani v GUI/MDG: Group Type
// = Search, "Addin Name and method" = AICodeBridge.FB_Process (separator
// TECKA - lekce T4-0a: s lomitkem se metoda TISE nezavola).
// Vola VYHRADNE vratny (PS): Repository.GetElementsByQuery("FB_Process", prikaz).
// Prikazy (oddelovac "|"; Windows cesta "|" obsahovat nemuze):
//   ping|<token>                            -> identita repa do responses\gk-ping-<token>.json (W3 par. 3.3)
//   req|<cesta>                             -> FB_Main nad souborem + res + chat/confirm sidecary + presuny
//   confirm|approve|<pend>|<nonce>|<hash>   -> FB_ConfirmPending kanal "okno" (potvrzeni)
//   confirm|reject|<pend>|<nonce>|<hash>    -> FB_ConfirmPending kanal "okno" (zamitnuti)
// PRAVIDLA:
//  - ZADNE UI/modal/Session.Prompt (W7) - chyby jen do souboru + Log;
//  - EA runtime (Mozilla JS): COM jen pres FB_ComObj, zadny Enumerator,
//    zadne binarni cteni (par. 1a); text utf-8 pres ADODB.Stream je OK;
//  - "req" prijima JEN soubor primo v requests\ - pending\ a ostatni
//    podslozky se odmitaji (druha obrana; prvni = executor E_RISK_CONFIRM);
//  - navratova hodnota "T" NENI indikator behu (lekce T4-0a/2) - dukaz behu
//    = vedlejsi efekt (res soubor); vratny cte vysledky z disku.
// Sidecary (chat verze, par. 3.3): res-X.chat.txt = chat ACK (FB_ChatRender,
// nikdy nonce/plny hash), res-X.confirm.txt = souhrn pro potvrzovaci UI
// (FB_ConfirmSummary) - existuje jen dokud davka ceka v pending\.
var self = this;
var fso = this.FB_ComObj("Scripting.FileSystemObject");
function wU8(p, t) {
    var st = self.FB_ComObj("ADODB.Stream");
    st.Type = 2; st.Charset = "utf-8"; st.Open();
    st.WriteText(t);
    st.SaveToFile(p, 2);
    st.Close();
}
function pad2(n) { return (n < 10 ? "0" : "") + n; }
function ts() {
    var d = new Date();
    return "" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate())
        + "-" + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}
function resName(n) { return /^req/i.test(n) ? n.replace(/^req/i, "res") : ("res-" + n); }
function sideCars(resDir, rn, respText) {
    var base = resDir + "\\" + rn.replace(/\.json$/i, "");
    var obj = null;
    try { obj = self.FB_JsonParse(respText); } catch (eP) { obj = null; }
    var chat = "";
    try { chat = "" + self.FB_ChatRender(obj); }
    catch (eC) { chat = "EAFB: chat rendering selhal (" + eC.message + ") - plna odpoved v " + rn; }
    try { wU8(base + ".chat.txt", chat); } catch (eW) { }
    try {
        if (obj != null && ("" + obj.status) == "confirm_required") {
            wU8(base + ".confirm.txt", "" + self.FB_ConfirmSummary(obj));
        } else if (fso.FileExists(base + ".confirm.txt")) {
            fso.DeleteFile(base + ".confirm.txt");
        }
    } catch (eS) { }
}
// W8: cesta pres vratneho nesmi session baseline tise preskocit - launcher
// ji vola, ale FB_Process ji pri prvnim uziti dozene (in-memory flag,
// zanika s restartem EA = novou session)
if (!this._fbSessionStarted) {
    try { this.FB_SessionStart(Repository); } catch (eSs) { }
    this._fbSessionStarted = true;
}
var cmd = "";
try {
    var parts = ("" + SearchText).split("|");
    cmd = "" + parts[0];
    if (cmd == "ping") {
        var tok = ("" + (parts[1] || "x")).replace(/[^0-9A-Za-z-]/g, "");
        var cfgs = this.FB_Config();
        var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
        var cfg = null;
        for (var ci = 0; ci < cfgs.length; ci++) {
            if (rid.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) { cfg = cfgs[ci]; break; }
        }
        if (cfg != null && cfg.baseDir) {
            wU8(cfg.baseDir + "\\responses\\gk-ping-" + tok + ".json", this.FB_JsonStringify({
                repository: "" + this.FB_RepoId(Repository),
                connection: "" + Repository.ConnectionString,
                time: ts()
            }));
        }
        return "T";
    }
    if (cmd == "req") {
        var p = "" + parts[1];
        if (!/\\requests\\[^\\]+\.json$/i.test(p) || !fso.FileExists(p)) {
            this.Log(Repository, "FB vratny: odmitnuta cesta mimo requests\\ nebo neexistujici soubor: " + p);
            return "T";
        }
        var reqDir = "" + fso.GetParentFolderName(p);
        var baseDir = "" + fso.GetParentFolderName(reqDir);
        var resDir = baseDir + "\\responses";
        var nm = "" + fso.GetFileName(p);
        var rn = resName(nm);
        var respText = "" + this.FB_Main(Repository, p);
        wU8(resDir + "\\" + rn, respText);
        sideCars(resDir, rn, respText);
        if (respText.indexOf("\"status\":\"confirm_required\"") >= 0) {
            // executor uz presunul soubor do pending\ - rozhodne clovek v okne
            this.Log(Repository, "FB vratny: " + nm + " ceka na potvrzeni (pending\\)");
            return "T";
        }
        var rejected = (respText.indexOf("\"code\":\"E_PARSE\"") >= 0)
            || (respText.indexOf("\"code\":\"E_RISK_BLOCKED\"") >= 0)
            || (respText.indexOf("\"code\":\"E_RISK_CONFIRM\"") >= 0);
        if (fso.FileExists(p)) {
            var stamped = nm.replace(/\.json$/i, "") + "." + ts() + ".json";
            fso.MoveFile(p, reqDir + "\\" + (rejected ? "rejected" : "processed") + "\\" + stamped);
        }
        this.Log(Repository, "FB vratny: " + nm + (rejected ? " ODMITNUTO" : " zpracovano"));
        return "T";
    }
    if (cmd == "confirm") {
        var act = "" + parts[1];
        var pp = "" + parts[2];
        var nonce = "" + (parts[3] || "");
        var hash = "" + (parts[4] || "");
        var nmC = "" + fso.GetFileName(pp);
        var pendDir = "" + fso.GetParentFolderName(pp);
        var resDirC = "" + fso.GetParentFolderName("" + fso.GetParentFolderName(pendDir)) + "\\responses";
        var rnC = resName(nmC);
        // FB_ConfirmPending sam bezstavove overi pending\ + nonce + hash proti
        // res souboru a udela presuny; kanal "okno" = stavove okno vratneho
        var out = "" + this.FB_ConfirmPending(Repository, pp, nonce, hash, "okno", (act == "approve"));
        wU8(resDirC + "\\" + rnC, out);
        sideCars(resDirC, rnC, out);
        return "T";
    }
    this.Log(Repository, "FB vratny: neznamy prikaz '" + cmd + "'");
    return "T";
} catch (eTop) {
    // W7: zadny modal - chyba do Logu + gk-error souboru (bez obsahu prikazu
    // confirm - nonce/hash se nesmi logovat)
    try { this.Log(Repository, "FB vratny CHYBA (" + cmd + "): " + eTop.message); } catch (eL) { }
    try {
        var cfgsE = this.FB_Config();
        var ridE = ("" + this.FB_RepoId(Repository)).toUpperCase();
        for (var ce = 0; ce < cfgsE.length; ce++) {
            if (ridE.indexOf(("" + cfgsE[ce].repo).toUpperCase()) >= 0) {
                wU8(cfgsE[ce].baseDir + "\\responses\\gk-error-" + ts() + ".txt",
                    "FB_Process CHYBA | prikaz: " + cmd + " | " + eTop.message);
                break;
            }
        }
    } catch (eE) { }
    return "T";
}
