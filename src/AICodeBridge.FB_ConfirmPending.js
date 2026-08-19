// AICodeBridge.FB_ConfirmPending(Repository, path, nonce, payloadHash, channel, approve)
// CONFIRM OKRUH Risk Gate (iterace 4b V2, zadani v1.1 par. 3 kroky 5-6,
// par. 6) - JEDINY vstupni bod potvrzeni/zamitnuti cekajici ELEVATED davky.
// NENI v registru operaci FB_Main -> NENI dosazitelny obsahem davky zadneho
// kanalu (B1). Volaji ho vyhradne lokalni UI adaptery po lidskem ukonu:
// popup pumpy, dialog GUI fallbacku, stavove okno vratneho (iterace 4).
//
// Vstupy: path = soubor v requests\pending\; nonce + payloadHash = z res
// souboru (UI je odtud cte, par. 6.1/6.3); channel = "pumpa"|"gui"|"okno";
// approve = true (Provest) | false (Zrusit).
//
// Bezstavovy prubeh (B1/W1, par. 3.6):
//  1. soubor MUSI lezet v requests\pending\ - jinak E_RISK_CONFIRM,
//  2. nonce (i hash) se overi proti res-*.json na disku - nesoulad nebo
//     chybejici hodnota = E_RISK_CONFIRM, soubor ZUSTAVA v pending\,
//  3. zamitnuti -> audit (confirmationRequired, confirmedByUser=false,
//     confirmChannel) + presun do rejected\ + response E_RISK_REJECTED,
//  4. potvrzeni -> prepocet SHA-256 SUROVYCH bajtu pending souboru
//     (FB_FileBytes, jedno cteni): nesoulad = E_RISK_INTEGRITY, nic se
//     neprovede, soubor do rejected\ + audit (bezpecnostni udalost),
//  5. shoda -> FB_Main nad tymz souborem s in-call confirm kontextem
//     (this._fbConfirmCtx): FB_Main RE-KLASIFIKUJE nad aktualnim stavem
//     modelu - zmena metrik = NOVE confirm_required s NOVYM nonce (soubor
//     zustava v pending\); shoda = exekuce s audit poli potvrzeni.
//  6. presuny po exekuci dela tato operace: done/error -> processed\,
//     E_RISK_BLOCKED (re-klasifikace) -> rejected\.
// Zadny in-memory stav mezi volanimi -> prezije restart EA i pumpy.
var self = this;
function refuse(code, msg, id) {
    return self.FB_JsonStringify({ protocol: "eafb/0.2", id: ("" + (id || "")),
        status: "error", code: code, message: msg, results: [] });
}
var fso = this.FB_ComObj("Scripting.FileSystemObject");
var p = ("" + path).replace(/^\s+|\s+$/g, "");
if (p == "" || !fso.FileExists(p)) {
    return refuse("E_RISK_CONFIRM", "Potvrzovana davka neexistuje: " + p);
}
if (!/\\requests\\pending\\[^\\]+\.json$/i.test(p)) {
    return refuse("E_RISK_CONFIRM", "Potvrzeni je pripustne jen nad souborem cekajicim v requests\\pending\\ (B1): " + p);
}
// --- odvozeni cest ze struktury slozek (…\requests\pending\req-X.json) ---
var pendDir = "" + fso.GetParentFolderName(p);
var reqDir = "" + fso.GetParentFolderName(pendDir);
var baseDir = "" + fso.GetParentFolderName(reqDir);
var resDir = baseDir + "\\responses";
var rejDir = reqDir + "\\rejected";
var procDir = reqDir + "\\processed";
var name = "" + fso.GetFileName(p);
var resName = /^req/i.test(name) ? name.replace(/^req/i, "res") : ("res-" + name);
var resPath = resDir + "\\" + resName;
function pad2(x) { return (x < 10 ? "0" : "") + x; }
function stamp() {
    var d = new Date();
    return "" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate())
        + "-" + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}
function nowText() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
        + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
}
function moveTo(dir) {
    if (!fso.FolderExists(dir)) { fso.CreateFolder(dir); }
    fso.MoveFile(p, dir + "\\" + name.replace(/\.json$/i, "") + "." + stamp() + ".json");
}
function readText(fp) {
    var st = self.FB_ComObj("ADODB.Stream");
    st.Type = 2; st.Charset = "utf-8"; st.Open();
    st.LoadFromFile(fp);
    var s = st.ReadText(-1);
    st.Close();
    return ("" + s).replace(/^\uFEFF/, "");
}
// --- res soubor = nosic nonce (par. 6.1): bez nej nelze potvrdit ---
if (!fso.FileExists(resPath)) {
    return refuse("E_RISK_CONFIRM", "K cekajici davce chybi res soubor (" + resPath + ") - nonce nelze overit, davku nelze potvrdit. Rucni reseni: soubor z pending\\ odstranit/vratit do requests\\.");
}
var resObj = null;
try { resObj = this.FB_JsonParse(readText(resPath)); } catch (eR) { resObj = null; }
if (resObj == null || ("" + resObj.status) != "confirm_required" || !resObj.confirm || !resObj.confirm.nonce) {
    return refuse("E_RISK_CONFIRM", "res soubor neni ve stavu confirm_required s nonce - potvrzeni odmitnuto.", (resObj ? resObj.id : ""));
}
var reqId = "" + (resObj.id || "");
var chan = ("" + (channel || "")) || "nezname";
var risk = resObj.risk || null;
var isApprove = (approve === true || approve === "true" || approve === 1 || approve === "1");
// --- zamitnuti (Zrusit): audit + rejected, zadne overovani hashe netreba ---
if (!isApprove) {
    if (risk == null) { risk = { riskLevel: "ELEVATED", riskReasons: [], metrics: null, policyValid: false }; }
    risk.confirm = { required: true, confirmedByUser: false, channel: chan, timestamp: nowText() };
    var rejSummary = "rejected E_RISK_REJECTED: davka zamitnuta uzivatelem (kanal " + chan + "), nic neprovedeno" + this.FB_RiskNote(risk);
    var rejResp = { protocol: "eafb/0.2", id: reqId, status: "rejected", code: "E_RISK_REJECTED",
        message: "Davka zamitnuta uzivatelem v potvrzovacim dialogu (kanal " + chan + "). Nic nebylo provedeno; soubor presunut do rejected\\.",
        risk: risk, results: [] };
    try {
        var reqTextRej = readText(p);
        var agR = this.FB_Audit(Repository, reqId, rejSummary, reqTextRej);
        rejResp.audit = { aiLogGuid: agR };
        this.FB_RiskAuditTags(Repository, agR, risk);
    } catch (eA1) { rejResp.audit = { aiLogGuid: "", warning: "Audit selhal: " + eA1.message }; }
    try { moveTo(rejDir); } catch (eM1) { rejResp.message += " (POZOR: presun do rejected\\ selhal: " + eM1.message + ")"; }
    this.Log(Repository, "FB " + reqId + " -> E_RISK_REJECTED (zamitnuto uzivatelem, kanal " + chan + ")");
    return this.FB_JsonStringify(rejResp);
}
// --- potvrzeni: nonce + hash povinne a MUSI sedet na res soubor (B2) ---
if (nonce === null || typeof nonce == "undefined" || ("" + nonce) == "") {
    this.Log(Repository, "FB " + reqId + " -> confirm ODMITNUT: chybi nonce (kanal " + chan + ")");
    return refuse("E_RISK_CONFIRM", "Potvrzeni vyzaduje nonce z res souboru - samotny payloadHash nestaci (par. 6.1, B2). Davka zustava v pending\\.", reqId);
}
if (("" + nonce) != ("" + resObj.confirm.nonce)) {
    this.Log(Repository, "FB " + reqId + " -> confirm ODMITNUT: nonce nesouhlasi (kanal " + chan + ")");
    return refuse("E_RISK_CONFIRM", "Nonce nesouhlasi s res souborem - potvrzeni odmitnuto (B2). Davka zustava v pending\\.", reqId);
}
if (payloadHash === null || typeof payloadHash == "undefined" || ("" + payloadHash) == ""
    || ("" + payloadHash) != ("" + resObj.confirm.payloadHash)) {
    this.Log(Repository, "FB " + reqId + " -> confirm ODMITNUT: payloadHash chybi/nesouhlasi (kanal " + chan + ")");
    return refuse("E_RISK_CONFIRM", "payloadHash chybi nebo nesouhlasi s res souborem - potvrzeni odmitnuto (par. 6.1). Davka zustava v pending\\.", reqId);
}
// --- integrita payloadu (CR par. 7): prepocet hashe surovych bajtu ---
// EA runtime: FB_FileBytes vraci null (COM past nodeTypedValue, lekce
// 2026-08-19) -> hash z textoveho cteni utf-8 (identicky s raw pro UTF-8
// soubory bez BOM; stejnou cestou pocital hash i FB_Main v tomto runtime)
var bytes = null, freshHash = "";
try {
    bytes = this.FB_FileBytes(p);
    freshHash = "" + this.FB_Sha256(bytes === null ? readText(p) : bytes);
} catch (eH) {
    return refuse("E_RISK_CONFIRM", "Pending soubor nejde precist/hashovat: " + eH.message, reqId);
}
if (freshHash != ("" + resObj.confirm.payloadHash)) {
    if (risk == null) { risk = { riskLevel: "ELEVATED", riskReasons: [], metrics: null, policyValid: false }; }
    risk.confirm = { required: true, confirmedByUser: true, channel: chan, timestamp: nowText(), integrityFailed: true };
    var intSummary = "error E_RISK_INTEGRITY: obsah davky se zmenil mezi klasifikaci a potvrzenim (hash " + freshHash.substring(0, 12) + "... != potvrzeny " + ("" + resObj.confirm.payloadHash).substring(0, 12) + "...), nic neprovedeno" + this.FB_RiskNote(risk);
    var intResp = { protocol: "eafb/0.2", id: reqId, status: "error", code: "E_RISK_INTEGRITY",
        message: "Obsah davky se zmenil mezi klasifikaci a potvrzenim - potvrzeni je vazane na payload (CR par. 7). Nic nebylo provedeno; soubor presunut do rejected\\. Novou verzi davky posli jako novy soubor do requests\\.",
        risk: risk, results: [] };
    try {
        var agI = this.FB_Audit(Repository, reqId, intSummary, (bytes === null ? readText(p) : this.FB_Utf8Decode(bytes)));
        intResp.audit = { aiLogGuid: agI };
        this.FB_RiskAuditTags(Repository, agI, risk);
    } catch (eA2) { intResp.audit = { aiLogGuid: "", warning: "Audit selhal: " + eA2.message }; }
    try { moveTo(rejDir); } catch (eM2) { intResp.message += " (POZOR: presun do rejected\\ selhal: " + eM2.message + ")"; }
    this.Log(Repository, "FB " + reqId + " -> E_RISK_INTEGRITY (payload zmenen, kanal " + chan + ")");
    return this.FB_JsonStringify(intResp);
}
// --- vse sedi: exekuce pres FB_Main s in-call confirm kontextem ---
// FB_Main bezstavove RE-KLASIFIKUJE nad aktualnim modelem (W1): zmena
// metrik = nove confirm_required s novym nonce (soubor zustava v pending\).
this._fbConfirmCtx = {
    path: p.toLowerCase(),
    channel: chan,
    timestamp: nowText(),
    prevMetrics: (risk ? risk.metrics : null),
    prevLevel: (risk ? "" + risk.riskLevel : "")
};
var out = "";
try {
    out = "" + this.FB_Main(Repository, p);
} catch (eX) {
    this._fbConfirmCtx = null;
    return refuse("E_RISK_CONFIRM", "Exekuce potvrzene davky selhala vyjimkou: " + eX.message + ". Davka zustava v pending\\.", reqId);
}
this._fbConfirmCtx = null;
// --- presuny dle vysledku ---
if (out.indexOf("\"status\":\"confirm_required\"") >= 0) {
    // re-klasifikace vydala nove confirm_required (novy nonce) - soubor
    // ZUSTAVA v pending\, UI musi zobrazit novy souhrn a ziskat nove potvrzeni
    return out;
}
var toRejected = (out.indexOf("\"code\":\"E_RISK_BLOCKED\"") >= 0)
    || (out.indexOf("\"code\":\"E_PARSE\"") >= 0)
    || (out.indexOf("\"code\":\"E_RISK_CONFIRM\"") >= 0);
try { moveTo(toRejected ? rejDir : procDir); }
catch (eM3) { this.Log(Repository, "FB " + reqId + " WARN: presun pending souboru selhal: " + eM3.message); }
return out;
