// AICodeBridge.FB_Main(Repository, requestText)
// Vstupni bod executoru (eafb/0.2): text requestu -> text response (JSON).
// Stop-on-error: prvni chyba v davce zastavi zbytek (oznaci se "skipped").
// v0.2 (iterace 1+3): registr operaci (zrcadlo MCP toolu), WHITELIST OPERACI
// (FB_OpsAllowed, K4), retezeni GUIDu v davce pres "$N" placeholdery.
// v0.3 (iterace 2): Diagram Builder - create_or_update_diagram,
// place_elements_on_diagram, get_diagram_image (PNG do souboru).
// v0.4 (iterace 2b): create_or_update_scenarios (strukturovane UC scenare),
// apply_classifier_stereotypes (IDS instance na SD), find_or_create_
// referencing_sr (port ITAN scaffoldu, SR vetev; sablony = FB_ScaffoldConfig).
// v0.6: create_or_update_constraints (internal constraints elementu -
// zalozka Constraints, PRE/PST/ASU na UC dle U2 rev. 2026-08-17).
// v0.7 (iterace 4b, vypocetni cast): RISK GATE - metriky + klasifikace
// (FB_RiskGate/FB_RiskPolicy/FB_Sha256). Vynucuje se JEN BLOCKED
// (E_RISK_BLOCKED, nic se neprovede); LOW i ELEVATED zatim exekuce jako
// dosud (SHADOW rezim - riskova pole v response.risk a v auditu #AI-LOG).
// Confirm okruh (nonce, pending\, E_RISK_INTEGRITY, zmena kontraktu na
// cestu/raw bytes) = V2. Kontrakt FB_Main(Repository, requestText) NEMENEN.
var resp = { protocol: "eafb/0.2", id: "", status: "error", results: [] };
var req = null;
try {
    req = this.FB_JsonParse(requestText);
} catch (e) {
    resp.code = "E_PARSE";
    resp.message = "Request neni validni JSON.";
    return this.FB_JsonStringify(resp);
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
        return this.FB_JsonStringify(resp);
    }
}
if (!req.ops || Object.prototype.toString.call(req.ops) != "[object Array]" || req.ops.length == 0) {
    resp.code = "E_PARSE";
    resp.message = "Request nema neprazdne pole ops.";
    return this.FB_JsonStringify(resp);
}
// --- registr operaci: nazvy zrcadli MCP tooly (skilly funguji beze zmen) ---
// w: true = zapisova operace -> podleha whitelistu operaci (FB_OpsAllowed).
// Cteci operace jsou povolene vzdy.
var REG = {
    "ping":                              { fn: "FB_OpPing", w: false },
    "query":                             { fn: "FB_OpQuery", w: false },
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
// --- RISK GATE (iterace 4b, vypocetni cast) ---
// Ciste ctene (Č) davky jdou mimo gate. Neznama operace se pocita jako
// zapisova (fail-closed; exekuci ji stejne zastavi E_UNKNOWN_OP).
var risk = null;
var writesInBatch = 0;
for (var wi = 0; wi < req.ops.length; wi++) {
    var wname = "" + (req.ops[wi] && req.ops[wi].op ? req.ops[wi].op : "?");
    if (!REG[wname] || REG[wname].w) { writesInBatch++; }
}
if (writesInBatch > 0) {
    try {
        risk = this.FB_RiskGate(Repository, req, REG);
    } catch (eRG) {
        // fail-closed: pad gate nikdy nesmi pustit LOW (W5); BLOCKED vynuceni
        // pri padu gate neni k dispozici - viditelne v duvodech i auditu
        risk = { riskLevel: "ELEVATED",
            riskReasons: ["FB_RiskGate selhal: " + eRG.message + " - fail-closed ELEVATED, nikdy LOW"],
            policyValid: false, metrics: null };
    }
    // payloadHash: v shadow fazi nad textem requestu (UTF-8); hash nad
    // surovymi bajty souboru prijde se zmenou kontraktu ve V2 (I5)
    try {
        var hMax = (typeof risk.hashMaxChars == "number") ? risk.hashMaxChars : 2000000;
        var rtLen = ("" + requestText).length;
        if (rtLen <= hMax) {
            var hT0 = new Date().getTime();
            risk.payloadHash = "" + this.FB_Sha256("" + requestText);
            risk.hashMs = new Date().getTime() - hT0;
        } else {
            risk.payloadHash = "";
            if (risk.riskLevel == "LOW") { risk.riskLevel = "ELEVATED"; }
            risk.riskReasons.push("payload " + rtLen + " znaku nad hashMaxChars " + hMax + " - hash nespocitan (fail-closed W5)");
        }
    } catch (eH) {
        risk.payloadHash = "";
        if (risk.riskLevel == "LOW") { risk.riskLevel = "ELEVATED"; }
        risk.riskReasons.push("FB_Sha256 selhal: " + eH.message + " (fail-closed)");
    }
    resp.risk = risk;
    if (risk.riskLevel == "BLOCKED") {
        // jedine vynucovane pasmo vypocetni faze: nic se neprovede,
        // davka patri do rejected\ (adapterove pravidlo pumpy/GUI fallbacku),
        // audit se zapise vcetne riskovych poli (ladeni limitu, par. 8)
        resp.code = "E_RISK_BLOCKED";
        resp.message = "Risk Gate: davka BLOCKED - " + risk.riskReasons.join("; ")
            + " Zadny jednoklikovy override; cesta ven = zmena FB_RiskPolicy (deploy_src/rucne) nebo rucni prace v EA.";
        for (var bi2 = 0; bi2 < req.ops.length; bi2++) {
            resp.results.push({ op: "" + (req.ops[bi2] && req.ops[bi2].op ? req.ops[bi2].op : "?"), status: "skipped" });
        }
        var bSummary = "error E_RISK_BLOCKED: " + req.ops.length + " ops (0 ok, nic neprovedeno)" + this.FB_RiskNote(risk);
        try {
            var agB = this.FB_Audit(Repository, reqId, bSummary, "" + requestText);
            resp.audit = { aiLogGuid: agB };
            this.FB_RiskAuditTags(Repository, agB, risk);
        } catch (e3b) {
            resp.audit = { aiLogGuid: "", warning: "Audit selhal: " + e3b.message };
        }
        this.Log(Repository, "FB " + reqId + " -> E_RISK_BLOCKED (" + risk.riskReasons.join("; ") + ")");
        return this.FB_JsonStringify(resp);
    }
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
            r = { op: name, status: "error", code: "E_EXCEPTION", message: "" + e2.message };
        }
    }
    resp.results.push(r);
    if (r.status == "ok") { okc++; } else { errc++; failed = true; }
}
resp.status = failed ? "error" : "done";
var summary = resp.status + ": " + req.ops.length + " ops (" + okc + " ok, " + errc + " chyb)"
    + this.FB_RiskNote(risk);
try {
    var ag = this.FB_Audit(Repository, reqId, summary, "" + requestText);
    resp.audit = { aiLogGuid: ag };
    this.FB_RiskAuditTags(Repository, ag, risk);
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
    if (anyExc) { this._fbPrevExc = true; }
    else if (writesInBatch > 0) { this._fbPrevExc = false; }
} catch (eW8) { }
this.Log(Repository, "FB " + reqId + " -> " + summary);
return this.FB_JsonStringify(resp);
