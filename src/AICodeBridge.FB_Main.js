// AICodeBridge.FB_Main(Repository, requestText)
// Vstupni bod executoru (eafb/0.2): request -> text response (JSON).
// Stop-on-error: prvni chyba v davce zastavi zbytek (oznaci se "skipped").
// v0.2 (iterace 1+3): registr operaci (zrcadlo MCP toolu), WHITELIST OPERACI
// (FB_OpsAllowed, K4), retezeni GUIDu v davce pres "$N" placeholdery.
// v0.3 (iterace 2): Diagram Builder. v0.4 (iterace 2b): scenarios, classifier
// stereotypes, SR scaffold. v0.6: constraints.
// v0.12 (iterace 6): move_elements (presun elementu mezi packages - konec
// falesneho OK z nalezu N-2) + create_or_update_requirements (internal
// requirements = lokalni BRU dle U5). Registr 40 -> 42 operaci.
// v0.7 (iterace 4b, vypocetni cast): RISK GATE - metriky + klasifikace
// (FB_RiskGate/FB_RiskPolicy/FB_Sha256).
// v0.8 (iterace 4b V2 - CONFIRM OKRUH):
//  - KONTRAKT I5: requestText je preferovane CESTA k req souboru (pumpa
//    v0.5 i FB_ProcessFolder predavaji cestu). SHA-256 surovych bajtu
//    (FB_FileBytes) i parse (FB_Utf8Decode) z JEDNOHO cteni souboru.
//    Text zacinajici '{' = zpetne kompatibilni fallback - bez confirm
//    okruhu (ELEVATED v textovem rezimu = confirm_required bez nonce,
//    nic se neprovede, fail-closed).
//  - ELEVATED se VYNUCUJE: zadny zapis, jednorazovy nonce (FB_Nonce) jen
//    do response (res-*.json), req soubor se presune do requests\pending\
//    (pumpa i GUI fallback pending\ strukturalne preskakuji - podslozka).
//  - Potvrzeni = VYHRADNE FB_ConfirmPending (lokalni UI ukon; neni
//    v registru operaci). Potvrzovaci pole v OBSAHU davky (nonce,
//    payloadHash, top-level confirm...) odmita FB_Main sam ->
//    E_RISK_CONFIRM (B1, kryje i soubor polozeny primo do requests\).
//  - Re-klasifikace pri potvrzeni (W1): zmena metrik proti potvrzenemu
//    souhrnu = NOVE confirm_required s novym nonce, exekuce neprobehne.
//  - Migrace E_QUOTA (W6): op-level confirm: true se IGNORUJE s warningem
//    v response (stara davka NEspadne na chybu); nad-kvotovy klon jde
//    cestou ELEVATED (trida klonu v politice), E_QUOTA se uz nevydava.
//  - Audit par. 8: confirmationRequired, confirmedByUser + timestamp,
//    confirmChannel (pres risk.confirm -> FB_RiskNote/FB_RiskAuditTags).
// v0.13 (E2E VS Code 2026-09-07, nalez N4): response se serializuje ODSAZENA
//    (FB_JsonStringify(resp, 1) - jedna mezera na uroven, bez mezery za
//    dvojteckou), aby res-*.json precetl Copilot Read cely; obsah beze zmeny.
//    payloadHash se pocita ze SUROVYCH bajtu req souboru (vyse), z res textu
//    se nic nepocita - odsazeni nema na nonce/hash mechaniku vliv.
var resp = { protocol: "eafb/0.2", id: "", status: "error", results: [] };
var self = this;
function pad2m(x) { return (x < 10 ? "0" : "") + x; }
function nowTextM() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2m(d.getMonth() + 1) + "-" + pad2m(d.getDate())
        + " " + pad2m(d.getHours()) + ":" + pad2m(d.getMinutes()) + ":" + pad2m(d.getSeconds());
}
// --- kontrakt I5: cesta k souboru (preferovane) vs. text (legacy) ---
var reqPath = "", reqText = "", rawHash = "", rawLen = -1, hashMsPre = -1, rawSource = "";
var inputStr = ("" + requestText).replace(/^\uFEFF/, "");
var inTrim = inputStr.replace(/^\s+|\s+$/g, "");
if (inTrim.charAt(0) == "{") {
    reqText = inputStr; // legacy textovy rezim (zpetna kompatibilita)
} else {
    var okPath = false;
    try {
        var fsoM = this.FB_ComObj("Scripting.FileSystemObject");
        okPath = (inTrim != "" && inTrim.length < 300 && fsoM.FileExists(inTrim));
    } catch (ePth) { okPath = false; }
    if (!okPath) {
        resp.code = "E_PARSE";
        resp.message = "Vstup neni validni JSON ani cesta k existujicimu souboru.";
        return this.FB_JsonStringify(resp, 1);
    }
    reqPath = inTrim;
    try {
        var rawBytes = this.FB_FileBytes(reqPath);
        if (rawBytes === null) {
            // EA runtime (Mozilla JS): binarni cteni nedostupne (COM past
            // nodeTypedValue, viz FB_FileBytes) -> JEDNO textove cteni utf-8;
            // hash textu == hash surovych bajtu pro UTF-8 soubory bez BOM
            var stT = this.FB_ComObj("ADODB.Stream");
            stT.Type = 2; stT.Charset = "utf-8"; stT.Open();
            stT.LoadFromFile(reqPath);
            reqText = ("" + stT.ReadText(-1)).replace(/^\uFEFF/, "");
            stT.Close();
            rawLen = reqText.length;
            rawSource = "text-utf8";
            if (rawLen <= 2000000) {
                var hT0t = new Date().getTime();
                rawHash = "" + this.FB_Sha256(reqText);
                hashMsPre = new Date().getTime() - hT0t;
            }
        } else {
            rawLen = rawBytes.length;
            rawSource = "raw-bytes";
            // strop pro hash se overi jeste proti politice (hashMaxChars) az
            // po gate; tvrdy default 2 MB chrani pred W5 pasti uz ted
            if (rawLen <= 2000000) {
                var hT0p = new Date().getTime();
                rawHash = "" + this.FB_Sha256(rawBytes);
                hashMsPre = new Date().getTime() - hT0p;
            }
            reqText = this.FB_Utf8Decode(rawBytes);
        }
    } catch (eRaw) {
        resp.code = "E_PARSE";
        resp.message = "Req soubor nejde precist: " + eRaw.message;
        return this.FB_JsonStringify(resp, 1);
    }
}
var req = null;
try {
    req = this.FB_JsonParse(reqText);
} catch (e) {
    resp.code = "E_PARSE";
    resp.message = "Request neni validni JSON.";
    return this.FB_JsonStringify(resp, 1);
}
var reqId = "" + ((req && req.id) || ("noid-" + (new Date()).getTime()));
resp.id = reqId;
resp.repository = "" + this.FB_RepoId(Repository);
resp.connection = "" + Repository.ConnectionString;
// Deklarace ciloveho repozitare (povinna v copilot-instructions): pri neshode
// se NIC neprovede (ani audit). Kryje "davka pro TEST zpracovana v PROD".
if (req.repo) {
    var cs = ("" + resp.repository).toUpperCase();
    if (cs.indexOf(("" + req.repo).toUpperCase()) < 0) {
        resp.code = "E_REPO";
        resp.message = "Davka je urcena pro repozitar '" + req.repo + "', pripojeny je jiny. Nic nebylo provedeno.";
        return this.FB_JsonStringify(resp, 1);
    }
}
if (!req.ops || Object.prototype.toString.call(req.ops) != "[object Array]" || req.ops.length == 0) {
    resp.code = "E_PARSE";
    resp.message = "Request nema neprazdne pole ops.";
    return this.FB_JsonStringify(resp, 1);
}
// --- B1 (par. 6.2): potvrzovaci parametry NEJSOU prijatelne z obsahu davky
// ZADNEHO kanalu - vcetne souboru polozeneho primo do requests\. Vynucuje
// executor sam; adapterova pravidla jsou jen druha obrana. ---
var FORBID_TOP = ["confirm", "confirmed", "nonce", "payloadHash", "confirmNonce", "confirmHash", "confirmChannel", "confirmedBy"];
var fi;
for (fi = 0; fi < FORBID_TOP.length; fi++) {
    if (typeof req[FORBID_TOP[fi]] != "undefined") {
        resp.code = "E_RISK_CONFIRM";
        resp.message = "Request obsahuje potvrzovaci pole '" + FORBID_TOP[fi] + "' na urovni davky - potvrzeni neni prijatelne z obsahu davky zadneho kanalu (par. 6.2, B1). Davka odmitnuta, nic nebylo provedeno. Potvrzeni probiha vyhradne lokalnim ukonem (dialog/konzole).";
        this.Log(Repository, "FB " + reqId + " -> E_RISK_CONFIRM (podvrzene potvrzovaci pole '" + FORBID_TOP[fi] + "' v obsahu davky)");
        return this.FB_JsonStringify(resp, 1);
    }
}
for (fi = 0; fi < req.ops.length; fi++) {
    var opF = req.ops[fi];
    if (opF && (typeof opF.nonce != "undefined" || typeof opF.payloadHash != "undefined")) {
        resp.code = "E_RISK_CONFIRM";
        resp.message = "ops[" + fi + "] obsahuje potvrzovaci pole (nonce/payloadHash) - potvrzeni neni prijatelne z obsahu davky (par. 6.2, B1). Davka odmitnuta, nic nebylo provedeno.";
        this.Log(Repository, "FB " + reqId + " -> E_RISK_CONFIRM (potvrzovaci pole v ops[" + fi + "])");
        return this.FB_JsonStringify(resp, 1);
    }
}
// --- W6 (par. 6.4): migrace E_QUOTA - op-level confirm: true ztraci ucinek.
// Pole se odstrani (handlery ho nikdy neuvidi) + warning v response kvuli
// zacviku instrukci. Stara davka NESMI spadnout na chybu. ---
var warnW6 = [];
for (fi = 0; fi < req.ops.length; fi++) {
    var opW = req.ops[fi];
    if (opW && typeof opW.confirm != "undefined") {
        try { delete opW.confirm; } catch (eDel) { opW.confirm = null; }
        warnW6.push("ops[" + fi + "] (" + (opW.op || "?") + "): pole 'confirm' ztratilo ucinek - kvota klonu jde pres Risk Gate cestou ELEVATED (migrace E_QUOTA, zadani 4b par. 6.4); pole ignorovano, davka pokracuje");
    }
}
if (warnW6.length > 0) { resp.warnings = warnW6; }
// --- registr operaci: nazvy zrcadli MCP tooly (skilly funguji beze zmen) ---
// w: true = zapisova operace -> podleha whitelistu operaci (FB_OpsAllowed).
// Cteci operace jsou povolene vzdy.
var REG = {
    "ping":                              { fn: "FB_OpPing", w: false },
    "query":                             { fn: "FB_OpQuery", w: false },
    "get_selected_context":              { fn: "FB_OpSelectedContext", w: false },
    "find_elements_by_name":             { fn: "FB_OpFindElements", w: false },
    "find_packages_by_name":             { fn: "FB_OpFindPackages", w: false },
    "get_elements_information":          { fn: "FB_OpGetElements", w: false },
    "get_packages_information":          { fn: "FB_OpGetPackages", w: false },
    "get_connectors_information":        { fn: "FB_OpGetConnectors", w: false },
    "get_diagrams_information":          { fn: "FB_OpGetDiagrams", w: false },
    "get_baselines":                     { fn: "FB_OpBaselineList", w: false },
    "baseline_diff":                     { fn: "FB_OpBaselineDiff", w: false },
    "export_element_linked_documents":   { fn: "FB_OpLinkedDocExport", w: false },
    "create_element":                    { fn: "FB_OpCreateElement", w: true },
    "create_or_update_elements":         { fn: "FB_OpElements", w: true },
    "move_elements":                     { fn: "FB_OpMoveElements", w: true },
    "create_or_update_package":          { fn: "FB_OpPackage", w: true },
    "create_or_update_connectors":       { fn: "FB_OpConnectors", w: true },
    "create_or_update_attributes":       { fn: "FB_OpAttributes", w: true },
    "create_or_update_operations":       { fn: "FB_OpOperations", w: true },
    "create_or_update_messages":         { fn: "FB_OpMessages", w: true },
    "delete_from_model":                 { fn: "FB_OpDelete", w: true },
    "delete_taggedvalue_from_model":     { fn: "FB_OpDeleteTag", w: true },
    "remove_elements_from_diagram":      { fn: "FB_OpRemoveFromDiagram", w: true },
    "create_baseline":                   { fn: "FB_OpBaselineCreate", w: true },
    "clone_package":                     { fn: "FB_OpClonePackage", w: true },
    "clone_elements":                    { fn: "FB_OpCloneElements", w: true },
    "import_element_linked_documents":   { fn: "FB_OpLinkedDocImport", w: true },
    "layout_connectors":                 { fn: "FB_OpLayoutConnectors", w: true },
    "change_connector_visibility":       { fn: "FB_OpConnectorVisibility", w: true },
    "open_diagrams":                     { fn: "FB_OpOpenDiagrams", w: false },
    "reload_diagrams":                   { fn: "FB_OpReloadDiagrams", w: false },
    "update_diagram_properties":         { fn: "FB_OpUpdateDiagramProps", w: true },
    "set_diagram_object_style":          { fn: "FB_OpDiagramObjectStyle", w: true },
    "create_or_update_diagram":          { fn: "FB_OpDiagram", w: true },
    "place_elements_on_diagram":         { fn: "FB_OpPlaceElements", w: true },
    "get_diagram_image":                 { fn: "FB_OpDiagramImage", w: false },
    "create_or_update_scenarios":        { fn: "FB_OpScenarios", w: true },
    "create_or_update_constraints":      { fn: "FB_OpConstraints", w: true },
    "create_or_update_requirements":     { fn: "FB_OpRequirements", w: true },
    "apply_classifier_stereotypes":      { fn: "FB_OpApplyClassifierStereotypes", w: true },
    "find_or_create_referencing_sr":     { fn: "FB_OpFindOrCreateSR", w: true },
    "deploy_src":                        { fn: "FB_OpDeploySrc", w: true }
};
// --- whitelist operaci (K4): allow/deny per repo, deny ma prednost ---
var opsCfg = null;
var oa = this.FB_OpsAllowed();
var ridU = ("" + resp.repository).toUpperCase();
for (var ci = 0; ci < oa.length; ci++) {
    if (ridU.indexOf(("" + oa[ci].repo).toUpperCase()) >= 0) { opsCfg = oa[ci]; break; }
}
function opAllowed(name) {
    if (opsCfg == null) { return false; } // fail-secure: repo bez polozky = zadny zapis
    var k;
    var deny = opsCfg.deny || [];
    for (k = 0; k < deny.length; k++) { if (("" + deny[k]) == name) { return false; } }
    var allow = opsCfg.allow || [];
    for (k = 0; k < allow.length; k++) {
        if (("" + allow[k]) == "*" || ("" + allow[k]) == name) { return true; }
    }
    return false;
}
// --- reseni "$N" referenci: "$2" -> results[2].guid, "$2.id" -> results[2].id,
//     "$2[1]" -> results[2].items[1].guid, "$2[1].id" -> .id ---
var results = resp.results;
function refValue(m) {
    var idx = parseInt(m[1], 10);
    if (idx >= results.length) { return null; }
    var r = results[idx];
    if (typeof m[2] != "undefined" && m[2] !== "" && m[2] !== null) {
        var it = (r.items && r.items[parseInt(m[2], 10)]) || null;
        if (it == null) { return null; }
        return (m[3] == "id") ? it.id : it.guid;
    }
    return (m[3] == "id") ? r.id : r.guid;
}
function resolveRefs(v) {
    if (v === null || typeof v == "undefined") { return v; }
    if (typeof v == "string") {
        var m = /^\$(\d+)(?:\[(\d+)\])?(?:\.(id|guid))?$/.exec(v);
        if (m) {
            var rv = refValue(m);
            if (rv === null || typeof rv == "undefined") { throw new Error("Referenci " + v + " nelze rozresolvovat (vysledek neexistuje)."); }
            return rv;
        }
        return v;
    }
    if (typeof v == "object") {
        if (Object.prototype.toString.call(v) == "[object Array]") {
            for (var i2 = 0; i2 < v.length; i2++) { v[i2] = resolveRefs(v[i2]); }
        } else {
            for (var k2 in v) { if (typeof v[k2] != "function") { v[k2] = resolveRefs(v[k2]); } }
        }
    }
    return v;
}
// --- RISK GATE (iterace 4b) ---
// Ciste ctene (Č) davky jdou mimo gate. Neznama operace se pocita jako
// zapisova (fail-closed; exekuci ji stejne zastavi E_UNKNOWN_OP).
var risk = null;
var blPlan = null, blDec = null; // Baseline politika (plan + rozhodnuti davky)
var writesInBatch = 0;
for (var wi = 0; wi < req.ops.length; wi++) {
    var wname = "" + (req.ops[wi] && req.ops[wi].op ? req.ops[wi].op : "?");
    if (!REG[wname] || REG[wname].w) { writesInBatch++; }
}
// --- iterace 5 (A): pristup k WRITE ficuram add-inu pres EA security
// skupinu (FB_AccessGroups + FB_UserAccess). Vynucuje EXECUTOR - jedna
// mechanika kryje vsechny kanaly (pumpa/clipboard/GUI/vratny), stejny
// princip jako Risk Gate. Cteci davky bez omezeni; security vypnuta =
// vse povoleno (rozhodnuti Milos 2026-08-20). Fail-closed: nejistota
// pristupu nikdy nepusti zapis. ---
if (writesInBatch > 0) {
    var acc = null;
    try { acc = this.FB_UserAccess(Repository); }
    catch (eAcc) { acc = { securityEnabled: true, login: "", access: "read",
        reason: "FB_UserAccess selhal: " + eAcc.message + " - fail-closed read" }; }
    if (!acc || ("" + acc.access) != "write") {
        resp.code = "E_ADDIN_ACCESS";
        resp.message = "Zapisove ficury bridge nejsou pro uzivatele '" + (acc ? acc.login : "?")
            + "' povolene (EA security skupiny, FB_AccessGroups): " + (acc ? acc.reason : "?")
            + " O zarazeni do write skupiny pozadej spravce EA. Nic nebylo provedeno.";
        for (var ai2 = 0; ai2 < req.ops.length; ai2++) {
            resp.results.push({ op: "" + (req.ops[ai2] && req.ops[ai2].op ? req.ops[ai2].op : "?"), status: "skipped" });
        }
        try {
            var agA = this.FB_Audit(Repository, reqId,
                "error E_ADDIN_ACCESS: " + req.ops.length + " ops (0 ok, nic neprovedeno) - " + resp.message, "" + reqText);
            resp.audit = { aiLogGuid: agA };
        } catch (e3a) { resp.audit = { aiLogGuid: "", warning: "Audit selhal: " + e3a.message }; }
        this.Log(Repository, "FB " + reqId + " -> E_ADDIN_ACCESS (" + (acc ? acc.login : "?") + ": " + (acc ? acc.reason : "?") + ")");
        return this.FB_JsonStringify(resp, 1);
    }
}
// confirm kontext (nastavuje VYHRADNE FB_ConfirmPending po overeni nonce
// + hashe proti res souboru; in-call stav, nikdy neprezije volani)
var ctx = this._fbConfirmCtx || null;
var confirmedRun = (ctx != null && reqPath != "" && ("" + ctx.path) == reqPath.toLowerCase());
if (writesInBatch > 0) {
    // W8 pres soubor (par. 1a/5): EA runtime nedrzi this._fb* mezi invokacemi
    // -> flag "prvni zapis po E_EXCEPTION" cte i ze state souboru
    try {
        if (this._fbPrevExc !== true && ("" + this.FB_StateFile(Repository, "w8")) == "1") { this._fbPrevExc = true; }
    } catch (eW8r) { }
    try {
        risk = this.FB_RiskGate(Repository, req, REG);
    } catch (eRG) {
        // fail-closed: pad gate nikdy nesmi pustit LOW (W5); BLOCKED vynuceni
        // pri padu gate neni k dispozici - viditelne v duvodech i auditu
        risk = { riskLevel: "ELEVATED",
            riskReasons: ["FB_RiskGate selhal: " + eRG.message + " - fail-closed ELEVATED, nikdy LOW"],
            policyValid: false, metrics: null };
    }
    // payloadHash: v rezimu cesty = SHA-256 SUROVYCH bajtu req souboru
    // z jednoho cteni (I5); v textovem fallbacku hash textu (interim).
    try {
        var hMax = (typeof risk.hashMaxChars == "number") ? risk.hashMaxChars : 2000000;
        if (reqPath != "") {
            if (rawLen <= hMax && rawHash != "") {
                risk.payloadHash = rawHash;
                risk.hashMs = hashMsPre;
                risk.hashSource = rawSource;
            } else {
                risk.payloadHash = "";
                if (risk.riskLevel == "LOW") { risk.riskLevel = "ELEVATED"; }
                risk.riskReasons.push("payload " + rawLen + " bajtu nad hashMaxChars " + hMax + " - hash nespocitan (fail-closed W5); potvrzeni neni mozne, davku zmensi");
            }
        } else {
            var rtLen = ("" + reqText).length;
            if (rtLen <= hMax) {
                var hT0 = new Date().getTime();
                risk.payloadHash = "" + this.FB_Sha256("" + reqText);
                risk.hashMs = new Date().getTime() - hT0;
                risk.hashSource = "text-legacy";
            } else {
                risk.payloadHash = "";
                if (risk.riskLevel == "LOW") { risk.riskLevel = "ELEVATED"; }
                risk.riskReasons.push("payload " + rtLen + " znaku nad hashMaxChars " + hMax + " - hash nespocitan (fail-closed W5)");
            }
        }
    } catch (eH) {
        risk.payloadHash = "";
        if (risk.riskLevel == "LOW") { risk.riskLevel = "ELEVATED"; }
        risk.riskReasons.push("FB_Sha256 selhal: " + eH.message + " (fail-closed)");
    }
    resp.risk = risk;
    if (risk.riskLevel == "BLOCKED") {
        // nic se neprovede, davka patri do rejected\ (normalni tok: adapter;
        // confirm tok: FB_ConfirmPending), audit SE zapise (ladeni limitu)
        risk.confirm = confirmedRun
            ? { required: true, confirmedByUser: true, channel: "" + ctx.channel, timestamp: nowTextM(), reclassifiedToBlocked: true }
            : { required: false };
        resp.code = "E_RISK_BLOCKED";
        resp.message = "Risk Gate: davka BLOCKED - " + risk.riskReasons.join("; ")
            + " Zadny jednoklikovy override; cesta ven = zmena FB_RiskPolicy (deploy_src/rucne) nebo rucni prace v EA.";
        for (var bi2 = 0; bi2 < req.ops.length; bi2++) {
            resp.results.push({ op: "" + (req.ops[bi2] && req.ops[bi2].op ? req.ops[bi2].op : "?"), status: "skipped" });
        }
        var bSummary = "error E_RISK_BLOCKED: " + req.ops.length + " ops (0 ok, nic neprovedeno)" + this.FB_RiskNote(risk);
        try {
            var agB = this.FB_Audit(Repository, reqId, bSummary, "" + reqText);
            resp.audit = { aiLogGuid: agB };
            this.FB_RiskAuditTags(Repository, agB, risk);
        } catch (e3b) {
            resp.audit = { aiLogGuid: "", warning: "Audit selhal: " + e3b.message };
        }
        this.Log(Repository, "FB " + reqId + " -> E_RISK_BLOCKED (" + risk.riskReasons.join("; ") + ")");
        return this.FB_JsonStringify(resp, 1);
    }
    // --- BASELINE POLITIKA (zadani v1.2 par. 4.6/2): plan zalohy se pocita
    // PO klasifikaci (mimo budgetMs gate) a PRED confirm - dialog tak predem
    // rika, co se zazalohuje. Pri potvrzenem behu se prepocita (par. 4.6/4).
    // Rozhodnuti (FB_BaselineDecide, par. 4.4): none | create | guided | refuse.
    // ZALOHA SAMA vznika az tesne pred prvni zapisovou operaci - u ELEVATED
    // tedy az PO potvrzeni (par. 4.6/3+5; zamitnuta davka nesmi plodit zalohy).
    // Prahy velikosti jsou SHADOW, dokud politika nema thresholdsShadow: false.
    // Pad planu/rozhodnuti davku neshodi, ale NIKDY nepusti tichy zapis:
    // vynuti potvrzeni s duvodem (clovek vi, ze pise bez pre-image).
    try { blPlan = this.FB_BaselinePlan(Repository, req, risk, REG); }
    catch (eBl) { blPlan = null; resp.baseline = { decision: "failed", posture: "unknown", reason: "FB_BaselinePlan selhal: " + eBl.message, packages: [] }; }
    if (blPlan != null) {
        try { blDec = this.FB_BaselineDecide(Repository, blPlan, risk); }
        catch (eBd) { blDec = null; blPlan.section.reason = "FB_BaselineDecide selhal: " + eBd.message; }
    }
    if (blPlan == null || blDec == null) {
        if (blPlan != null) { resp.baseline = blPlan.section; resp.baseline.decision = "failed"; }
        if (risk.riskLevel == "LOW") { risk.riskLevel = "ELEVATED"; }
        risk.riskReasons.push("Baseline politika selhala (" + resp.baseline.reason + ") - zapis by probehl BEZ pre-image; vyzaduje potvrzeni cloveka (fail-closed)");
    }
    if (blPlan != null && blDec != null) {
        resp.baseline = blPlan.section;
        resp.baseline.decision = (blDec.action == "create") ? "planned" : ((blDec.action == "none") ? "none" : (blDec.action == "guided" ? "skipped" : "failed"));
        resp.baseline.reason = blDec.reason;
        resp.baseline.action = blDec.action;
        resp.baseline.lines = blDec.lines;
        if (blDec.manual) { resp.baseline.manual = blDec.manual; }
        if (risk.metrics && typeof risk.metrics.updatedExistingApprox == "number" && risk.metrics.updatedExistingApprox > 0) {
            resp.baseline.updatedExistingApprox = risk.metrics.updatedExistingApprox;
        }
        // radek 4a: destruktivni podtrida bez moznosti zalohy -> terminalne
        if (blDec.action == "refuse") {
            return emitNoBaseline("pre-image nelze poridit: " + blDec.reason);
        }
        // vynucene potvrzeni (navadena cesta / parentOutOfWhitelist) - i pro LOW
        if (blDec.confirmReasons.length > 0) {
            if (risk.riskLevel == "LOW") { risk.riskLevel = "ELEVATED"; }
            for (var bcr = 0; bcr < blDec.confirmReasons.length; bcr++) { risk.riskReasons.push(blDec.confirmReasons[bcr]); }
        }
        // navadena cesta: potvrzeno, ale rucni baseline porad chybi -> NEprovest,
        // nove confirm_required s navodem (soubor zustava v pending\)
        if (blDec.action == "guided" && confirmedRun && !(blDec.manual && blDec.manual.ok)) {
            risk.riskReasons.push("Potvrzeno, ale cerstva rucni baseline stale chybi - davka se NEPROVEDLA; udelej baseline a potvrd znovu, nebo davku zamitni");
            return emitConfirmRequired();
        }
        // chybejici sekce politiky: warning nejvys 1x denne (state-blwarn.txt)
        try {
            if (blPlan.cfgWarnings && blPlan.cfgWarnings.length > 0) {
                var dW = new Date();
                var dayW = dW.getFullYear() + "-" + pad2m(dW.getMonth() + 1) + "-" + pad2m(dW.getDate());
                if (("" + this.FB_StateFile(Repository, "blwarn")) != dayW) {
                    if (!resp.warnings) { resp.warnings = []; }
                    for (var bw = 0; bw < blPlan.cfgWarnings.length; bw++) { resp.warnings.push(blPlan.cfgWarnings[bw]); }
                    this.FB_StateFile(Repository, "blwarn", dayW);
                    this.Log(Repository, "FB " + reqId + " -> " + blPlan.cfgWarnings.join(" | "));
                }
            }
        } catch (eBw) { }
    }
    // --- ELEVATED: vynucene potvrzeni (V2 - konec shadow rezimu) ---
    if (risk.riskLevel == "ELEVATED") {
        if (!confirmedRun) {
            return emitConfirmRequired();
        }
        // potvrzeny beh: bezstavova RE-KLASIFIKACE nad aktualnim modelem (W1)
        // - metriky se porovnaji s potvrzenym souhrnem z res souboru
        if (!metricsMatch(ctx.prevMetrics, risk.metrics)) {
            risk.riskReasons.push("Re-klasifikace pri potvrzeni: metriky se zmenily proti potvrzenemu souhrnu (model-state TOCTOU, W1) - nutne nove potvrzeni s novym nonce");
            return emitConfirmRequired();
        }
        risk.confirm = { required: true, confirmedByUser: true, channel: "" + ctx.channel, timestamp: nowTextM() };
    } else {
        // LOW: bez potvrzeni (B1-A trva pro LOW); po potvrzenem behu, ktery
        // re-klasifikaci klesl na LOW, se potvrzeni zaznamena take
        risk.confirm = confirmedRun
            ? { required: true, confirmedByUser: true, channel: "" + ctx.channel, timestamp: nowTextM(), reclassifiedToLow: true }
            : { required: false };
    }
}
function metricsMatch(a, b) {
    if (a == null || b == null) { return false; }
    var keys = ["writeOps", "createOps", "updatedExisting", "deleteTargets",
                "affectedElements", "affectedPackages", "affectedDiagrams", "moveOps"];
    for (var mi = 0; mi < keys.length; mi++) {
        var av = (typeof a[keys[mi]] == "number") ? a[keys[mi]] : -1;
        var bv = (typeof b[keys[mi]] == "number") ? b[keys[mi]] : -2;
        if (av != bv) { return false; }
    }
    return true;
}
function emitConfirmRequired() {
    // ELEVATED bez platneho potvrzeni: ZADNY ZAPIS. Nonce jen do response
    // (= res-*.json); plny hash/nonce NIKDY do chat verze (par. 6.3) -
    // chat ACK nese jen prefix (hlida vratny/instrukce).
    resp.status = "confirm_required";
    for (var pi2 = 0; pi2 < req.ops.length; pi2++) {
        resp.results.push({ op: "" + (req.ops[pi2] && req.ops[pi2].op ? req.ops[pi2].op : "?"), status: "pending" });
    }
    var hashPrefix = risk.payloadHash ? ("" + risk.payloadHash).substring(0, 12) : "";
    if (reqPath == "") {
        // legacy textovy kanal: neni soubor -> neni co potvrdit (fail-closed)
        resp.confirm = { available: false,
            note: "Textove volani FB_Main nema req soubor - potvrzeni neni mozne. Poloz davku jako soubor do requests\\ (kontrakt I5)." };
        resp.message = "Risk Gate: ELEVATED - davka vyzaduje lidske potvrzeni, ktere textovy kanal neumoznuje. Nic nebylo provedeno.";
        self.Log(Repository, "FB " + reqId + " -> confirm_required (textovy kanal, bez nonce - nic neprovedeno)");
        return self.FB_JsonStringify(resp, 1);
    }
    if (!risk.payloadHash) {
        // bez hashe nejde potvrdit (integrita CR par. 7) - soubor NESMI zustat
        // v requests\ (watcher by ho rotoval ve smycce) -> fail-closed error,
        // adapter ho presune do rejected\
        resp.status = "error";
        resp.code = "E_RISK_CONFIRM";
        resp.message = "Risk Gate: ELEVATED, ale payloadHash nespocitan (nad hashMaxChars / chyba) - potvrzeni neni mozne. Nic nebylo provedeno; davku zmensi a posli znovu. Duvody: " + risk.riskReasons.join("; ");
        resp.results = [];
        self.Log(Repository, "FB " + reqId + " -> E_RISK_CONFIRM (ELEVATED bez hashe - nelze potvrdit)");
        return self.FB_JsonStringify(resp, 1);
    } else {
        var nonce = "" + self.FB_Nonce(risk.payloadHash + "|" + reqId + "|" + resp.repository);
        var pendDir = "";
        try {
            var fsoP = self.FB_ComObj("Scripting.FileSystemObject");
            pendDir = "" + fsoP.GetParentFolderName(reqPath);
            var inPending = /\\requests\\pending$/i.test(pendDir);
            if (!inPending) {
                pendDir = pendDir + "\\pending";
                if (!fsoP.FolderExists(pendDir)) { fsoP.CreateFolder(pendDir); }
                var tgt = pendDir + "\\" + fsoP.GetFileName(reqPath);
                if (fsoP.FileExists(tgt)) {
                    resp.status = "error";
                    resp.code = "E_RISK_CONFIRM";
                    resp.message = "V requests\\pending\\ uz ceka davka tehoz jmena (" + fsoP.GetFileName(reqPath) + ") - nejdriv ji potvrd/zamitni, pak posli novou s jinym id.";
                    resp.results = [];
                    return self.FB_JsonStringify(resp, 1);
                }
                fsoP.MoveFile(reqPath, tgt);
                resp.confirm = { pendingPath: tgt };
            } else {
                resp.confirm = { pendingPath: reqPath }; // uz ceka (re-klasifikace)
            }
        } catch (eMv) {
            resp.status = "error";
            resp.code = "E_RISK_CONFIRM";
            resp.message = "Presun davky do requests\\pending\\ selhal: " + eMv.message;
            resp.results = [];
            return self.FB_JsonStringify(resp, 1);
        }
        resp.confirm.nonce = nonce;
        resp.confirm.payloadHash = "" + risk.payloadHash;
        resp.confirm.hashPrefix = hashPrefix;
        resp.confirm.channelHint = "Potvrzeni vyhradne lokalnim ukonem: popup pumpy / dialog GUI fallbacku / stavove okno vratneho (FB_ConfirmPending). NIKDY z obsahu davky.";
    }
    resp.message = "Risk Gate: ELEVATED - davka ceka na lidske potvrzeni v requests\\pending\\. Zadny zapis neprobehl. Duvody: " + risk.riskReasons.join("; ");
    self.Log(Repository, "FB " + reqId + " -> confirm_required (" + risk.riskReasons.join("; ") + ")");
    return self.FB_JsonStringify(resp, 1);
}
// --- Baseline politika: E_NO_BASELINE (par. 7) - JEDINY kod pro "pre-image
// nelze poridit". Terminalni (W10): nic se neprovedlo, zadne nove
// confirm_required, soubor patri do rejected\, audit SE zapise.
function emitNoBaseline(why) {
    resp.status = "error";
    resp.code = "E_NO_BASELINE";
    resp.message = "Baseline politika: " + why + ". Nic nebylo provedeno. Co s tim: (1) udelej v EA rucni baseline nad balickem cile "
        + "(Ctrl+Alt+B -> New Baseline, jmeno bez prefixu FB-AUTO) a davku posli znovu, (2) pracuj v mensim balicku, "
        + "(3) pri E_WHITELIST / zamcenem balicku se obrat na spravce. Davku NEDEL na mensi jen kvuli obejiti teto kontroly.";
    resp.results = [];
    for (var nb = 0; nb < req.ops.length; nb++) {
        resp.results.push({ op: "" + (req.ops[nb] && req.ops[nb].op ? req.ops[nb].op : "?"), status: "skipped" });
    }
    if (!resp.baseline) { resp.baseline = { packages: [] }; }
    resp.baseline.decision = "failed";
    resp.baseline.reason = why;
    if (confirmedRun && risk) { risk.confirm = { required: true, confirmedByUser: true, channel: "" + ctx.channel, timestamp: nowTextM() }; }
    var nbSummary = "error E_NO_BASELINE: " + req.ops.length + " ops (0 ok, nic neprovedeno) - " + why + self.FB_RiskNote(risk, resp.baseline);
    try {
        var agN = self.FB_Audit(Repository, reqId, nbSummary, "" + reqText);
        resp.audit = { aiLogGuid: agN };
        self.FB_RiskAuditTags(Repository, agN, risk, resp.baseline);
    } catch (e3n) { resp.audit = { aiLogGuid: "", warning: "Audit selhal: " + e3n.message }; }
    self.Log(Repository, "FB " + reqId + " -> E_NO_BASELINE (" + why + ")");
    return self.FB_JsonStringify(resp, 1);
}
// --- Baseline politika: LAZY BASELINE (par. 4.1, 4.6/5) - tesne pred prvni
// zapisovou operaci; u ELEVATED az tady = PO potvrzeni. Neni to operace
// davky: nejde do results ani do metrik, jen do sekce baseline{}.
if (writesInBatch > 0 && blPlan != null && blDec != null && blDec.action == "create") {
    var blT0 = new Date().getTime();
    var blTok = null;
    try { blTok = this.FB_SessionToken(Repository, blPlan.cfg); } catch (eTk) { blTok = null; }
    var blKlass = (confirmedRun || risk.riskLevel == "ELEVATED") ? "ELEVATED" : "LOW";
    var blCreated = [], blReused = [];
    for (var bk = 0; bk < blPlan.scope.packages.length; bk++) {
        var bpk = blPlan.scope.packages[bk];
        var bres = null;
        try { bres = this.FB_AutoBaseline(Repository, bpk.guid, blPlan.cfg, blTok, blKlass, false); }
        catch (eAb) { bres = { status: "failed", why: "FB_AutoBaseline selhal: " + eAb.message, name: "", guid: "" }; }
        if (!bres || bres.status == "failed") {
            resp.baseline.elapsedMs = new Date().getTime() - blT0;
            return emitNoBaseline("zalohu balicku '" + (bpk.path || bpk.name) + "' se nepodarilo poridit (" + (bres ? bres.why : "?") + ")");
        }
        resp.baseline.packages[bk].name = bres.name;
        resp.baseline.packages[bk].baselineGuid = bres.guid;
        resp.baseline.packages[bk].result = bres.status;
        if (bres.status == "created") { blCreated.push(bres.name); } else { blReused.push(bres.name); resp.baseline.packages[bk].reuse = bres.why; }
    }
    resp.baseline.decision = (blCreated.length > 0) ? "created" : "reused";
    if (blCreated.length == 0 && blReused.length > 0) { resp.baseline.reason = resp.baseline.packages[0].reuse; }
    resp.baseline.created = blCreated;
    resp.baseline.reused = blReused;
    // MINIMALNI JOURNAL (par. 4.9): pre-image menenych poli resolvovanych cilu
    // - jen pod prahem (= tady, vedle mikro-baseline), pred prvni zapisovou op.
    // Rozhodnuti o zaloze NEMENI (radek 3 par. 4.4 se nestavi). Best-effort.
    try {
        var jr = this.FB_Journal(Repository, req, reqId, blPlan.cfg, blTok, resp.baseline);
        resp.baseline.journal = { targets: jr.targets, covered: jr.covered, uncovered: jr.uncovered, manifestRef: jr.manifestRef };
        if (jr.why) { resp.baseline.journal.why = jr.why; }
    } catch (eJr) { resp.baseline.journal = { targets: 0, covered: [], uncovered: [], manifestRef: "", why: "FB_Journal selhal: " + eJr.message }; }
    resp.baseline.elapsedMs = new Date().getTime() - blT0;
}
// --- provedeni davky (stop-on-error) ---
var okc = 0, errc = 0, failed = false;
for (var i = 0; i < req.ops.length; i++) {
    var op = req.ops[i];
    var name = "" + (op && op.op ? op.op : "?");
    if (failed) {
        resp.results.push({ op: name, status: "skipped" });
        continue;
    }
    var r;
    var reg = REG[name];
    if (!reg) {
        r = { op: name, status: "error", code: "E_UNKNOWN_OP", message: "Neznama operace: " + name };
    } else if (reg.w && !opAllowed(name)) {
        r = { op: name, status: "error", code: "E_OP_FORBIDDEN",
            message: "Operace '" + name + "' neni povolena whitelistem operaci (FB_OpsAllowed) pro repozitar " + resp.repository + "." };
    } else {
        try {
            resolveRefs(op);
            r = this[reg.fn](Repository, op, reqId);
            if (!r) { r = { op: name, status: "error", code: "E_EXCEPTION", message: "Operace nevratila vysledek." }; }
            if (!r.op) { r.op = name; }
        } catch (e2) {
            // interpretace znamych EA chyb (odepreny zapis = EA security /
            // zamek) na citelny kod+hlasku; jinak generic E_EXCEPTION
            var interp = null;
            try { interp = this.FB_InterpretError(e2.message); } catch (eIn) { interp = null; }
            r = interp
                ? { op: name, status: "error", code: interp.code, message: interp.message }
                : { op: name, status: "error", code: "E_EXCEPTION", message: "" + e2.message };
        }
    }
    resp.results.push(r);
    if (r.status == "ok") { okc++; } else { errc++; failed = true; }
}
resp.status = failed ? "error" : "done";
// QC v ACK (iterace 4 par. 3.4): jen po zapisove davce, ktera neco zapsala.
// TRI STAVY ODDELENE - selhani QC NENI chyba zapisu (W6), proto try/catch
// a vysledek vyhradne do resp.qc (chat verze ho rendruje zvlast).
// E2E pumpa P8c (2026-09-05): delete_from_model s vice cili muze skoncit
// error, ale cast cilu UZ je smazana (items deleted:true) - okc je 0 a
// Output by o smazani mlcel. Castecne mazani = zmena v modelu -> logovat.
var partialDel = false;
for (var pdI = 0; pdI < resp.results.length; pdI++) {
    var pdR = resp.results[pdI];
    if (pdR && pdR.op == "delete_from_model" && pdR.items) {
        for (var pdJ = 0; pdJ < pdR.items.length; pdJ++) { if (pdR.items[pdJ].deleted === true) { partialDel = true; } }
    }
}
if (writesInBatch > 0 && (okc > 0 || partialDel)) {
    try { resp.qc = this.FB_QcRun(Repository, req, resp); }
    catch (eQc) { resp.qc = { status: "nedobehlo", reason: "FB_QcRun selhal: " + eQc.message, checks: 0, findings: [] }; }
    // pozorovatelnost (Miloš UX): vypis zmen s teckovou cestou do Output tabu
    try { this.FB_LogChanges(Repository, resp); } catch (eLc) { }
    // iterace 5 (B-V2): posledni zapisova davka pro Add-in Search FB_Changes
    // (prazdny SearchText = tato davka); in-memory pro pumpu + state soubor
    // pro EA runtime (par. 1a/5 - this._fb* tam neprezije invokaci)
    try { this._fbLastWriteReqId = reqId; this.FB_StateFile(Repository, "lastwrite", reqId); } catch (eLr) { }
}
var summary = resp.status + ": " + req.ops.length + " ops (" + okc + " ok, " + errc + " chyb)"
    + this.FB_RiskNote(risk, resp.baseline);
try {
    var ag = this.FB_Audit(Repository, reqId, summary, "" + reqText);
    resp.audit = { aiLogGuid: ag };
    this.FB_RiskAuditTags(Repository, ag, risk, resp.baseline);
} catch (e3) {
    resp.audit = { aiLogGuid: "", warning: "Audit selhal: " + e3.message };
}
// W8: session flag (in-memory, zanika s reloadem kodu/restartem) - pristi
// zapisova davka po E_EXCEPTION jde ELEVATED (cte FB_RiskGate). Ctecí davka
// flag NEmaze (kontrolni cteni po zotaveni z modalu ho musi prezit).
try {
    var anyExc = false;
    for (var xi = 0; xi < resp.results.length; xi++) {
        if (resp.results[xi] && resp.results[xi].code == "E_EXCEPTION") { anyExc = true; break; }
    }
    if (anyExc) { this._fbPrevExc = true; try { this.FB_StateFile(Repository, "w8", "1"); } catch (eW8a) { } }
    else if (writesInBatch > 0) { this._fbPrevExc = false; try { this.FB_StateFile(Repository, "w8", null); } catch (eW8b) { } }
} catch (eW8) { }
this.Log(Repository, "FB " + reqId + " -> " + summary);
// --- Baseline politika par. 6.3: UKLID automatickych baselines - hak v
// executoru (plati pro vsechny kanaly stejne), PO dokonceni zapisove davky,
// nejvys 1x za cleanupEveryHours (state-cleanup.txt). Nikdy neshodi davku.
if (writesInBatch > 0) {
    try {
        var clr = this.FB_BaselineCleanupHook(Repository);
        if (clr != null) {
            resp.cleanup = clr;
            if (clr.anomaly || clr.candidates > 0) {
                if (!resp.warnings) { resp.warnings = []; }
                resp.warnings.push("Uklid automatickych baselines [" + clr.mode + "]: kandidatu " + clr.candidates
                    + (clr.mode == "delete" ? ", smazano " + clr.deleted : ", smazal bych " + clr.planned)
                    + (clr.anomaly ? " - ANOMALIE, nemaze se nic" : "") + " (detail: Output tab AI Bridge; menu AI Bridge -> Uklid automatickych baselines)");
            }
        }
    } catch (eClr) { }
}
return this.FB_JsonStringify(resp, 1);
