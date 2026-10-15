// AICodeBridge.FB_RiskGate(Repository, req, reg)
// RISK GATE (iterace 4b, zadani v1.1 par. 3-5): deterministicke METRIKY +
// KLASIFIKACE zapisove davky PRED exekuci. Zadne AI hodnoceni (CR par. 14/3).
//
// Vraci { riskLevel: "LOW"|"ELEVATED"|"BLOCKED", riskReasons[], metrics{},
//         summary{ops,targets,packages,diagrams}, policyValid, elapsedMs,
//         budgetMs, hashMaxChars }.
// Vynucovani (od v0.8 - confirm okruh V2): BLOCKED = E_RISK_BLOCKED;
// ELEVATED = confirm_required (zadny zapis bez lidskeho potvrzeni pres
// FB_ConfirmPending); LOW = auto. Vynucuje FB_Main, gate jen klasifikuje.
//
// PRAVIDLA (dispozice red teamu jsou zavazne):
//  - $N reference (B3): jako "prvek vytvoreny touto davkou" se pocita JEN $N
//    na vysledek CREATE vetve zapisove operace. $N na vysledek CTECI operace
//    nebo update vetve = existujici target -> zvysuje updatedExisting.
//    Nejistota (matchByName/dedupKey/find_or_create/dopredna reference/
//    neznama vetev) -> fail-closed ELEVATED.
//  - B4: jakykoli target davky = konfiguracni element bridge (AICodeBridge,
//    FB_RiskPolicy, FB_OpsAllowed, FB_Config, FB_ScaffoldConfig; nad ramec
//    zadani navic FB_WriteScope - tez konfiguracni sekce) -> BLOCKED.
//  - W5: prekroceni rozpoctu budgetMs -> fail-closed ELEVATED "metriky
//    nespocitany"; nikdy LOW bez spocitanych metrik.
//  - W8: prvni zapisova davka po E_EXCEPTION predchozi davky v teze session
//    -> ELEVATED (in-memory flag this._fbPrevExc, plni FB_Main).
//  - W9: chybejici/neuplna politika -> vse ELEVATED (validace zde).
//  - Varianty W2a/W2b/V2d (operations+parameters, elements update se zmenou
//    type, messages+rebuild) ESKALUJI nad tridu z politiky - nikdy nesnizuji.
//  - MOVE (iterace 6): operace `move_elements` uz existuje - metrika
//    `moveOps` pocita SKUTECNE presuny (drive rezervovana 0, I4). Trida
//    v politice = ELEVATED vzdy (zduvodneni ve FB_RiskPolicy); volitelny
//    prah `elevate.moveOps` je druha pojistka. Update vetev FB_OpElements
//    vlastnika porad NEMENI - jen o tom nove vraci warning (nalez N-2).
//
// VEDOME APROXIMACE METRIK (shadow faze; ladi se auditem):
//  - $N na existujici prvek: identita znama az za behu -> affectedElements
//    pocita referenci, package prvku se NEZAPOCITA (podpocet affectedPackages).
//  - matchByName/dedupKey create-or-update: konzervativne +1 updatedExisting
//    (muze byt UPDATE), bez ELEVATED duvodu - chyta az prah.
//  - endpointy konektoru/zprav se pocitaji do affectedElements, ne do
//    affectedPackages (t_connector package nema).
//  - apply_classifier_stereotypes: 1 write + dotceny diagram (dorovnani je
//    omezene obsahem diagramu; cizi diagram chyta prah foreignDiagrams).
//  - clone_*: objem znamy az pri exekuci (vykazuje E_QUOTA kvota) - trida
//    ELEVATED z politiky.
// SQL vyhradne nad standardnimi sloupci t_object/t_package/t_diagram
// (zadna sonda neznamych sloupcu - lekce par. 6a/3).
// v0.16 (balik B1, Z261004b-3):
//  - resolvery jdou pres FB_TargetCache (mezipamet jednoho volani FB_Main
//    sdilena s predbeznou kontrolou P2 - jeden cil = jeden dotaz na davku);
//  - PRAVIDLO 3 KONCEPCE (klic politiky ownSessionLow, chybi = false): prvek
//    nebo diagram ZALOZENY touto session pumpy (this._fbOwnGuids, plni
//    FB_Main; jen pamet procesu pumpy) neni cizi - vlastni diagram se
//    nepocita do foreignDiagrams, scenare/constraints/requirements nad
//    vlastnim prvkem jsou LOW, pokud nic jineho neeskaluje (prahy, mazani,
//    W8...). $N na create vetev teze davky je vlastni i bez klice (B3).
//    Prahy se NEMENI (pravidlo 8).
// v0.19 (balik B2 texty, Z261004b-6; KONCEPCE pravidla 2, 4, 9; FB-PU-20):
//  - kazdy duvod nese STABILNI KOD (reasonItems[] = { code, text, args }):
//    riskReasons[] zustava technicky text pro res/audit, FB_ConfirmSummary
//    sklada vetu pro cloveka z kodu (FB_ReasonText), audit dostava tag
//    ai.risk.codes - kalibrace oken seskupuje podle kodu, ne textu;
//  - summary.deletes[] = co se SMAZE se skutecnym rozsahem (balicek vcetne
//    N prvku/diagramu pres FB_SubtreeCount, prvek vcetne vnorenych, konektor
//    A -> B, atribut Trida.x, diagram, tag) - zvlast od summary.targets
//    (ostatni zmeny); mazane cile uz do targets nepatri (FB-PU-20 b);
//  - summary.actions[] = per operace co a nad cim (vety "Co se stane" v okne);
//  - summary.targetsMore / packagesMore = kolik jmen je nad stropem 12.
var self = this;
var t0 = new Date().getTime();
var reasons = [], reasonSeen = {}, reasonItems = [];
var level = 1; // 1=LOW 2=ELEVATED 3=BLOCKED
function addReason(msg, code, args) {
    if (reasonSeen[msg] != 1) { reasonSeen[msg] = 1; reasons.push(msg); reasonItems.push({ code: "" + (code || "OTHER"), text: msg, args: args || {} }); }
}
function elevate(msg, code, args) { if (level < 2) { level = 2; } addReason(msg, code, args); }
function block(msg, code, args) { level = 3; addReason(msg, code, args); }

// --- politika: nacteni + fail-closed validace (W9) ---
var pol = null, polWhy = "";
try {
    var pa = this.FB_RiskPolicy();
    var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
    for (var pi = 0; pi < pa.length; pi++) {
        if (rid.indexOf(("" + pa[pi].repo).toUpperCase()) >= 0) { pol = pa[pi]; break; }
    }
    if (pol == null) { polWhy = "repo bez polozky ve FB_RiskPolicy"; }
} catch (ePol) { pol = null; polWhy = "FB_RiskPolicy nelze precist: " + ePol.message; }
var polValid = (pol != null);
if (polValid) {
    var missing = [];
    for (var rk in reg) {
        if (reg[rk] && reg[rk].w) {
            var cv = (pol.classes ? pol.classes[rk] : null);
            if (cv != "LOW" && cv != "ELEVATED" && cv != "BLOCKED") { missing.push(rk); }
        }
    }
    if (missing.length > 0) { polValid = false; polWhy = "neuplna mapa classes proti registru (chybi: " + missing.join(", ") + ")"; }
    if (polValid) {
        var needE = ["deleteTargets", "writeOps", "updatedExisting", "affectedPackages", "foreignDiagrams"];
        var needB = ["deleteTargets", "writeOps", "updatedExisting", "affectedPackages"];
        var ni;
        for (ni = 0; ni < needE.length; ni++) {
            if (!pol.elevate || typeof pol.elevate[needE[ni]] != "number") { polValid = false; polWhy = "chybi prah elevate." + needE[ni]; break; }
        }
        if (polValid) {
            for (ni = 0; ni < needB.length; ni++) {
                if (!pol.block || typeof pol.block[needB[ni]] != "number") { polValid = false; polWhy = "chybi prah block." + needB[ni]; break; }
            }
        }
    }
}
if (!polValid) { elevate("Politika nevalidni (" + polWhy + ") - fail-closed W9: zadny auto-write", "POLICY_INVALID", { why: polWhy }); }
// --- pravidlo 3: vlastni prvky/diagramy teto session (jen s platnou politikou a klicem) ---
var ownLow = (polValid && pol.ownSessionLow === true);
var ownSet = (ownLow && self._fbOwnGuids && typeof self._fbOwnGuids == "object") ? self._fbOwnGuids : null;
function isOwn(guid) { return ownSet != null && !!guid && ownSet[("" + guid).toUpperCase()] === 1; }
// --- Baseline politika par. 5 (W14): CHYBEJICI sekce `baseline` = validni
// (defaulty, T6-31: LOW zustane LOW); PRITOMNA nekonzistentni = ELEVATED.
// Zamerne NEshazuje polValid - tridy a prahy (vcetne BLOCKED) plati dal;
// vadna baseline sekce smi jen eskalovat, nikdy uvolnit vynucovani.
var blValid = true;
try {
    var blc = this.FB_BaselineConfig(Repository);
    if (blc && blc.valid === false) {
        blValid = false;
        elevate("Baseline politika nevalidni (" + blc.why + ") - fail-closed W14: zadny auto-write", "BASELINE_POLICY_INVALID", { why: "" + blc.why });
    }
} catch (eBlc) {
    blValid = false;
    elevate("FB_BaselineConfig selhal: " + eBlc.message + " - fail-closed W14", "BASELINE_POLICY_INVALID", { why: "" + eBlc.message });
}
var budget = (polValid && typeof pol.budgetMs == "number") ? pol.budgetMs : 8000;
var budgetHit = false;
function checkBudget() {
    if (!budgetHit && (new Date().getTime() - t0) > budget) { budgetHit = true; }
    return budgetHit;
}

// --- B4: chranene konfiguracni elementy bridge ---
var PROT = { "AICODEBRIDGE": 1, "FB_RISKPOLICY": 1, "FB_OPSALLOWED": 1,
             "FB_CONFIG": 1, "FB_SCAFFOLDCONFIG": 1, "FB_WHITELIST": 1,
             "FB_ACCESSGROUPS": 1, "FB_WRITESCOPE": 1 }; // FB_AccessGroups = iterace 5 (A);
             // FB_WriteScope = cil zapisu (Z261004b-10); FB_WHITELIST zustava (pozustatek v modelu)
var bridgeGuid = "", bridgeId = -1;
try {
    var br = this.FB_XmlRows(Repository.SQLQuery(
        "SELECT Object_ID, ea_guid FROM t_object WHERE Name = 'AICodeBridge' AND Stereotype = 'JavascriptAddin'"));
    if (br.length > 0) { bridgeGuid = ("" + br[0].ea_guid).toUpperCase(); bridgeId = parseInt(br[0].Object_ID, 10); }
} catch (eBr) { }
function guardRaw(ref, ctx) {
    var u = ("" + ref).replace(/^\s+|\s+$/g, "").toUpperCase();
    if (u == "") { return; }
    if (PROT[u] == 1) { block("Target '" + ref + "' (" + ctx + ") = konfiguracni element bridge - BLOCKED (B4)", "CONFIG_TARGET", { ref: "" + ref, ctx: ctx }); return; }
    if (bridgeGuid != "" && u == bridgeGuid) { block("Target " + ref + " (" + ctx + ") = element AICodeBridge - BLOCKED (B4)", "CONFIG_TARGET", { ref: "AICodeBridge", ctx: ctx }); return; }
    if (bridgeId >= 0 && /^[0-9]+$/.test(u) && parseInt(u, 10) == bridgeId) { block("Target " + ref + " (" + ctx + ") = element AICodeBridge - BLOCKED (B4)", "CONFIG_TARGET", { ref: "AICodeBridge", ctx: ctx }); }
}
function guardResolved(res, ctx) {
    if (res == null) { return; }
    if (PROT[("" + res.name).toUpperCase()] == 1
        || (bridgeGuid != "" && ("" + res.guid).toUpperCase() == bridgeGuid)
        || (bridgeId >= 0 && res.id == bridgeId)) {
        block("Target '" + res.name + "' (" + ctx + ") = konfiguracni element bridge - BLOCKED (B4)", "CONFIG_TARGET", { ref: "" + res.name, ctx: ctx });
    }
}

// --- resolvery: FB_TargetCache (mezipamet jednoho volani FB_Main, sdilena s P2;
// jen standardni sloupce). Rozpocet gate se kontroluje PRED dotazem; cil uz
// dohledany predbeznou kontrolou se nedotazuje znovu. ---
function resolveVia(kind, ref) {
    // cesta { path: [...], from? } (cil zapisu kap. 5.7) jde do FB_TargetCache jako objekt
    var isPath = (ref !== null && typeof ref == "object" && Object.prototype.toString.call(ref.path) == "[object Array]");
    var t = isPath ? ("path:" + ref.path.join("\u0001") + "|" + ("" + (ref.from === null || typeof ref.from == "undefined" ? "" : ref.from)))
                   : ("" + ref).replace(/^\s+|\s+$/g, "");
    var C = self._fbTargetCache;
    var bucket = (C && typeof C == "object") ? ((kind == "package") ? C.pkg : ((kind == "diagram") ? C.dgm : C.el)) : null;
    if (bucket && typeof bucket[t] != "undefined") { return bucket[t]; }
    if (checkBudget()) { return "BUDGET"; }
    var r = null;
    try { r = self.FB_TargetCache(Repository, kind, isPath ? ref : t); } catch (eTc) { r = null; }
    return r;
}
function resolveElement(ref) { return resolveVia("element", ref); }
function resolvePackage(ref) { return resolveVia("package", ref); }
function resolveDiagram(ref) { return resolveVia("diagram", ref); }

// --- metriky ---
var writeOps = 0, createOps = 0, updatedExisting = 0, deleteTargets = 0, moveOps = 0;
// Baseline politika par. 4.4 (B5/b): konzervativni pripocet updatedExisting
// u match/dedup se vykazuje ZVLAST - vyjima se z rozhodnuti o navadene ceste,
// NE z rozhodnuti o porizeni zalohy. Do prahu a metricsMatch nevstupuje.
var updatedExistingApprox = 0;
var elSet = {}, elCount = 0, pkgSet = {}, pkgCount = 0, dgmSet = {}, dgmCount = 0;
function addEl(k) { if (elSet[k] != 1) { elSet[k] = 1; elCount++; } }
var pkgIds = [], pkgIdsDel = {}; // N-RE-12 (v0.22): ID dotcenych balicku pro vycet jmen v duvodu/odpovedi (mazane zvlast - FB-PU-20 b)
function addPkg(k) {
    if (pkgSet[k] != 1) {
        pkgSet[k] = 1; pkgCount++;
        if (("" + k).charAt(0) == "p") { var pid = parseInt(("" + k).substring(1), 10); pkgIds.push(pid); if (inDelete) { pkgIdsDel["p" + pid] = 1; } }
    }
}
// N-RE-12: teckove cesty dotcenych balicku (max 10 + "a N dalsich"); jen cteni, strop 10 lookupu
var pkgPathCache = {};
function pkgPath(pid) {
    if (typeof pkgPathCache["p" + pid] != "undefined") { return pkgPathCache["p" + pid]; }
    var pth = "";
    try { pth = "" + self.FB_ElementPath(Repository, "package", pid); } catch (ePp) { pth = ""; }
    if (pth == "" || pth == "?") { try { var pko = Repository.GetPackageByID(pid); pth = pko ? "" + pko.Name : ("#" + pid); } catch (ePn) { pth = "#" + pid; } }
    pkgPathCache["p" + pid] = pth;
    return pth;
}
function pkgList(skipDeleted) {
    var names = [], more = 0;
    for (var pi = 0; pi < pkgIds.length; pi++) {
        if (skipDeleted && pkgIdsDel["p" + pkgIds[pi]] == 1) { continue; }
        if (names.length >= 10) { more++; continue; }
        names.push(pkgPath(pkgIds[pi]));
    }
    return { names: names, more: more };
}
function pkgListText() {
    var pl = pkgList(false);
    if (pl.names.length == 0) { return ""; }
    return pl.names.join(", ") + (pl.more > 0 ? " a " + pl.more + " dalsich" : "");
}
function addForeignDgm(k) { if (dgmSet[k] != 1) { dgmSet[k] = 1; dgmCount++; } }
// --- souhrn pro potvrzovaci UI (V2, I6: dialog zobrazuje konkretni davku) ---
var opCounts = {}, tgtNames = [], pkgNames = [], dgmNames = [], nameSeen = {}, nameMore = { e: 0, p: 0, d: 0 };
// v0.19: inDelete = dotyk cile z delete_from_model -> jmeno NEJDE do targets
// (ostatni zmeny), ale do summary.deletes se skutecnym rozsahem (FB-PU-20)
var inDelete = false;
var actions = [], curAct = null;
function actAdd(field, nm) {
    if (curAct == null || nm === null || typeof nm == "undefined" || ("" + nm) == "") { return; }
    var arr = curAct[field];
    for (var ai = 0; ai < arr.length; ai++) { if (arr[ai] == ("" + nm)) { return; } }
    if (arr.length < 12) { arr.push("" + nm); } else { curAct[field + "More"] = (curAct[field + "More"] || 0) + 1; }
}
function pushName(arr, prefix, nm) {
    if (inDelete) { return; }
    var k = prefix + ":" + nm;
    if (nameSeen[k] == 1) { return; }
    nameSeen[k] = 1;
    if (arr.length < 12) { arr.push("" + nm); }
    else { nameMore[prefix]++; if (arr.length == 12) { arr.push("..."); } }
}
// --- co se SMAZE: druh + skutecny rozsah (FB-PU-20 a, c; pravidlo 4) ---
var deletes = [];
function fullPath(kind, id, nm) {
    var pth = "";
    try { pth = "" + self.FB_ElementPath(Repository, kind, id); } catch (ePth) { pth = ""; }
    if (pth == "" || pth == "?") { pth = ""; }
    return pth;
}
function addDelete(d) { if (deletes.length < 40) { deletes.push(d); } else { deletes[39].more = (deletes[39].more || 0) + 1; } }
function deleteScopePackage(res) {
    // rozsah balicku = podstrom (FB_SubtreeCount; best-effort, kratky rozpocet)
    var d = { kind: "package", name: "" + res.name, path: fullPath("package", res.id, res.name), scopeKnown: false };
    try {
        var sc = self.FB_SubtreeCount(Repository, res.id, { probeBudgetMs: 1500, withDiagrams: true }, 1500);
        if (sc && sc.status == "ok") { d.scopeKnown = true; d.elements = sc.elements; d.diagrams = sc.diagrams; d.packages = (sc.packages > 0 ? sc.packages - 1 : 0); }
    } catch (eSc) { }
    addDelete(d);
}
function deleteScopeElement(res) {
    var d = { kind: "element", name: "" + res.name, type: "" + (res.type || ""), path: fullPath("element", res.id, res.name), scopeKnown: true, children: 0 };
    try {
        var cr = self.FB_XmlRows(Repository.SQLQuery("SELECT COUNT(*) AS c FROM t_object WHERE ParentID = " + parseInt(res.id, 10)));
        if (cr.length == 1) { d.children = parseInt(cr[0].c, 10) || 0; } else { d.scopeKnown = false; }
    } catch (eCh) { d.scopeKnown = false; }
    addDelete(d);
}
function deleteScopeConnector(ref) {
    var d = { kind: "connector", ref: "" + ref, label: "", scopeKnown: false };
    try {
        var cn = (("" + ref).charAt(0) == "{") ? Repository.GetConnectorByGuid("" + ref) : Repository.GetConnectorByID(parseInt(ref, 10));
        if (cn) {
            var a = null, b = null;
            try { a = Repository.GetElementByID(cn.ClientID); } catch (eA) { a = null; }
            try { b = Repository.GetElementByID(cn.SupplierID); } catch (eB) { b = null; }
            d.type = "" + (cn.Type || ""); d.name = "" + (cn.Name || "");
            d.label = (a ? "" + a.Name : "?") + " -> " + (b ? "" + b.Name : "?");
            d.scopeKnown = true;
            if (a) { addEl("" + a.ElementGUID); }
        }
    } catch (eCn) { }
    addDelete(d);
}
function deleteScopeOwned(kind, ref, opName) {
    // atribut / operace / parametr: "Trida.x" pres vlastnika (SQL jen cteni)
    var d = { kind: kind, ref: "" + ref, label: "", scopeKnown: false };
    try {
        var tbl = (kind == "attribute") ? "t_attribute" : "t_operation";
        var idc = (kind == "attribute") ? "ID" : "OperationID";
        var rr = self.FB_XmlRows(Repository.SQLQuery("SELECT Object_ID, Name FROM " + tbl + " WHERE " + idc + " = " + parseInt(ref, 10)));
        if (rr.length == 1) {
            var ow = null;
            try { ow = Repository.GetElementByID(parseInt(rr[0].Object_ID, 10)); } catch (eOw) { ow = null; }
            d.name = "" + (rr[0].Name || "");
            d.owner = ow ? "" + ow.Name : "";
            d.label = (ow ? "" + ow.Name : "?") + "." + (d.name != "" ? d.name : ("id " + ref));
            if (kind == "parameter" && opName) { d.label += "(" + opName + ")"; }
            d.scopeKnown = true;
            if (ow) { addEl("" + ow.ElementGUID); }
        }
    } catch (eAt) { }
    addDelete(d);
}
// --- PLNE TECKOVE CESTY mazanych / presouvanych cilu (nalez Milose
// 2026-08-31, E2E T7-05 "MLA": dialog neukazal, KDE prvek lezi). Stejny
// vzor jako whitelist v pingu (par. 4.5): FB_ElementPath. Jen pro
// delete_from_model + move_elements (zasahy do struktury); best-effort,
// nikdy nespadne - je to popisek pro cloveka. Do summary.paths.
var tgtPaths = [], pathSeen = {};
function pushPathDel(kind, id, nm) { var keep = inDelete; inDelete = false; pushPath(kind, id, nm); inDelete = keep; }
function pushPath(kind, id, nm) {
    if (!id || id <= 0) { return; }
    var k = kind + ":" + id;
    if (pathSeen[k] == 1) { return; }
    pathSeen[k] = 1;
    var pth = "";
    try { pth = "" + self.FB_ElementPath(Repository, kind, id); } catch (ePth) { pth = ""; }
    if (pth == "" || pth == "?") { pth = "" + nm + " (cesta nedostupna)"; }
    if (tgtPaths.length < 12) { tgtPaths.push(pth); }
    else if (tgtPaths.length == 12) { tgtPaths.push("..."); }
}

// --- klasifikace $N reference (B3): OWN | EXISTING | UNCERTAIN ---
var refRe = /^\$(\d+)(?:\[(\d+)\])?(?:\.(id|guid|compositeDiagram))?$/; // v0.22: .compositeDiagram (N-RE-11)
var opIndex = 0;
function classifyDollar(m) {
    var idx = parseInt(m[1], 10);
    var itemIdx = (typeof m[2] != "undefined" && m[2] !== "" && m[2] !== null) ? parseInt(m[2], 10) : -1;
    if (idx >= opIndex) { return "UNCERTAIN"; } // dopredna/vlastni reference
    var rop = req.ops[idx];
    var rname = "" + (rop && rop.op ? rop.op : "?");
    var rreg = reg[rname];
    if (!rreg) { return "UNCERTAIN"; }
    if (!rreg.w) { return "EXISTING"; } // cteci op vraci guidy existujicich prvku (B3)
    if (rname == "create_or_update_elements") {
        var it = (rop.elements || [])[itemIdx < 0 ? 0 : itemIdx];
        if (!it) { return "UNCERTAIN"; }
        if (it.guid || it.elementID) { return "EXISTING"; } // update vetev (B3)
        if (it.matchByName || it.dedupKey) { return "UNCERTAIN"; } // find-or-create (B2)
        return "OWN";
    }
    if (rname == "create_or_update_package") {
        var plist = (rop.packages && Object.prototype.toString.call(rop.packages) == "[object Array]") ? rop.packages : [rop];
        var pit = plist[itemIdx < 0 ? 0 : itemIdx];
        if (!pit) { return "UNCERTAIN"; }
        if (pit.guid || pit.packageID) { return "EXISTING"; }
        if (pit.matchByName) { return "UNCERTAIN"; }
        return "OWN";
    }
    if (rname == "create_or_update_connectors") {
        var cit = (rop.connectors || [])[itemIdx < 0 ? 0 : itemIdx];
        if (!cit) { return "UNCERTAIN"; }
        if (cit.guid || cit.connectorID) { return "EXISTING"; }
        if (cit.match || cit.dedupKey) { return "UNCERTAIN"; }
        return "OWN";
    }
    if (rname == "create_or_update_diagram") {
        var dit = (rop.diagrams || [])[itemIdx < 0 ? 0 : itemIdx];
        if (!dit) { return "UNCERTAIN"; }
        return (dit.diagram || dit.diagramID || dit.guid) ? "EXISTING" : "OWN"; // FB_OpDiagram: update pres diagram | diagramID | guid (H1)
    }
    if (rname == "create_element" || rname == "clone_package" || rname == "clone_elements"
        || rname == "create_baseline") { return "OWN"; }
    if (rname == "move_elements") { return "EXISTING"; } // presouva JEN existujici prvky
    // find_or_create_referencing_sr (found vs created), attributes/operations/
    // messages/scenarios/... - vetev nelze pre-exekucne urcit -> fail-closed
    return "UNCERTAIN";
}

// --- dotyky targetu ---
// countUpdate: pocitat updatedExisting; addPackages: pocitat package targetu
function touchElement(ref, ctx, countUpdate, addPackages) {
    if (ref === null || typeof ref == "undefined" || ("" + ref) == "") {
        elevate("Chybejici target (" + ctx + ") - fail-closed", "TARGET_MISSING", { ctx: ctx });
        return { own: false };
    }
    var m = refRe.exec("" + ref);
    if (m) {
        var kind = classifyDollar(m);
        actAdd("targets", "" + ref);
        if (kind == "OWN") { return { own: true }; }
        if (kind == "UNCERTAIN") { elevate("$N reference '" + ref + "' (" + ctx + ") s nejistym puvodem - fail-closed B3", "REF_UNCERTAIN", { ref: "" + ref, ctx: ctx }); }
        if (countUpdate) { updatedExisting++; }
        addEl("$:" + ref); // identita znama az za behu; package se nezapocita (viz hlavicka)
        return { own: false };
    }
    guardRaw(ref, ctx);
    var res = resolveElement(ref);
    if (res == "BUDGET") { return { own: false }; }
    if (res == null) {
        elevate("Neresolvovatelny target '" + ref + "' (" + ctx + ") - fail-closed", "TARGET_UNRESOLVED", { ref: "" + ref, ctx: ctx });
        if (countUpdate) { updatedExisting++; }
        return { own: false };
    }
    guardResolved(res, ctx);
    addEl(res.guid);
    actAdd("targets", res.name);
    pushName(tgtNames, "e", res.name);
    if (!inDelete && !(("" + ref).charAt(0) == "{" || /^[0-9]+$/.test("" + ref))) { pushPath("element", res.id, res.name); } // cil jmenem: plna cesta v okne (FB-CZ-18)
    if (addPackages && res.pkgId > 0) { addPkg("p" + res.pkgId); }
    if (countUpdate) { updatedExisting++; }
    // pravidlo 3: prvek zalozeny touto session pumpy = vlastni (metriky
    // updatedExisting/affected se pocitaji dal - prahy beze zmeny)
    return { own: isOwn(res.guid), res: res, ownSession: isOwn(res.guid) };
}
function touchPackage(ref, ctx, countUpdate) {
    if (ref === null || typeof ref == "undefined" || ("" + ref) == "") {
        elevate("Chybejici package (" + ctx + ") - fail-closed", "TARGET_MISSING", { ctx: ctx });
        return;
    }
    var m = refRe.exec("" + ref);
    if (m) {
        var kind = classifyDollar(m);
        actAdd("packages", "" + ref);
        if (kind == "OWN") { return; } // zapis do package vytvoreneho touto davkou
        if (kind == "UNCERTAIN") { elevate("$N reference '" + ref + "' (" + ctx + ") s nejistym puvodem - fail-closed B3", "REF_UNCERTAIN", { ref: "" + ref, ctx: ctx }); }
        if (countUpdate) { updatedExisting++; }
        addPkg("$:" + ref);
        return;
    }
    guardRaw(ref, ctx);
    var res = resolvePackage(ref);
    if (res == "BUDGET") { return; }
    var lbl = (ref !== null && typeof ref == "object" && ref.path) ? ("path " + ref.path.join(".") + (ref.from ? " od " + ref.from : "")) : ("" + ref);
    if (res == null) { elevate("Neresolvovatelny package '" + lbl + "' (" + ctx + ") - fail-closed", "TARGET_UNRESOLVED", { ref: lbl, ctx: ctx }); return; }
    if (PROT[("" + res.name).toUpperCase()] == 1) { block("Target package '" + res.name + "' (" + ctx + ") = konfiguracni jmeno bridge - BLOCKED (B4)", "CONFIG_TARGET", { ref: "" + res.name, ctx: ctx }); }
    if (countUpdate) { updatedExisting++; }
    addPkg("p" + res.id);
    actAdd("packages", res.name);
    pushName(pkgNames, "p", res.name);
    // cil zadany cestou nebo jmenem: okno ukaze plnou cestu (cil zapisu FB-CZ-18)
    var byPathOrName = (ref !== null && typeof ref == "object") || !(("" + ref).charAt(0) == "{" || /^[0-9]+$/.test("" + ref));
    if (byPathOrName && !inDelete) { pushPath("package", res.id, res.name); }
    return { res: res };
}
// vraci { own: bool } - cizi (ne-vlastni) diagram jde do foreignDiagrams
function touchDiagram(ref, ctx) {
    if (ref === null || typeof ref == "undefined" || ("" + ref) == "") {
        elevate("Chybejici diagram (" + ctx + ") - fail-closed", "TARGET_MISSING", { ctx: ctx });
        return { own: false };
    }
    var m = refRe.exec("" + ref);
    if (m) {
        var kind = classifyDollar(m);
        actAdd("diagrams", "" + ref);
        if (kind == "OWN") { return { own: true }; }
        if (kind == "UNCERTAIN") { elevate("$N reference '" + ref + "' (" + ctx + ") s nejistym puvodem - fail-closed B3", "REF_UNCERTAIN", { ref: "" + ref, ctx: ctx }); }
        addForeignDgm("$:" + ref);
        return { own: false };
    }
    var res = resolveDiagram(ref);
    if (res == "BUDGET") { return { own: false }; }
    if (res == null) {
        elevate("Neresolvovatelny diagram '" + ref + "' (" + ctx + ") - fail-closed", "TARGET_UNRESOLVED", { ref: "" + ref, ctx: ctx });
        addForeignDgm("?:" + ref);
        return { own: false };
    }
    actAdd("diagrams", res.name);
    if (isOwn(res.guid)) {
        // pravidlo 3: diagram zalozeny touto session pumpy neni cizi
        pushName(dgmNames, "d", res.name);
        if (res.pkgId > 0) { addPkg("p" + res.pkgId); }
        return { own: true, res: res, ownSession: true };
    }
    addForeignDgm(res.guid);
    pushName(dgmNames, "d", res.name);
    if (res.pkgId > 0) { addPkg("p" + res.pkgId); }
    return { own: false, res: res };
}

// --- W8: prvni zapisova davka po vyjimce/zotaveni predchozi davky ---
try {
    if (this._fbPrevExc === true) {
        elevate("Predchozi davka skoncila vyjimkou/zotavenim - prvni zapisova davka jde ELEVATED (W8)", "PREV_EXCEPTION", {});
    }
} catch (eW8) { }

// --- pruchod operacemi ---
var metricsIncomplete = false;
for (opIndex = 0; opIndex < req.ops.length; opIndex++) {
    if (checkBudget()) { metricsIncomplete = true; break; }
    var o = req.ops[opIndex];
    var name = "" + (o && o.op ? o.op : "?");
    var rg = reg[name];
    inDelete = false; curAct = null;
    if (!rg) {
        writeOps++;
        elevate("Neznama operace '" + name + "' - fail-closed (exekuci zastavi E_UNKNOWN_OP)", "UNKNOWN_OP", { op: name });
        actions.push({ op: name, unknown: true, items: 0, targets: [], packages: [], diagrams: [], pairs: [] });
        continue;
    }
    if (!rg.w) { continue; } // cteci operace mimo gate
    opCounts[name] = (opCounts[name] ? opCounts[name] + 1 : 1); // souhrn UI
    // akce pro okno: jedna polozka per operace (stejne op za sebou se slucuji)
    curAct = null;
    for (var ax = 0; ax < actions.length; ax++) { if (actions[ax].op == name && !actions[ax].unknown) { curAct = actions[ax]; break; } }
    if (curAct == null) { curAct = { op: name, items: 0, create: 0, update: 0, targets: [], packages: [], diagrams: [], pairs: [] }; actions.push(curAct); }
    inDelete = (name == "delete_from_model" || name == "delete_taggedvalue_from_model");
    // pravidlo 3: u scenarios/constraints/requirements se trida ELEVATED
    // uplatni az podle cile (vlastni prvek teze session = bez eskalace)
    var ownClassDefer = false;
    if (polValid) {
        var klass = pol.classes[name];
        if (klass == "BLOCKED") { block("Operace '" + name + "' je politikou klasifikovana BLOCKED", "CLASS_BLOCKED", { op: name }); }
        else if (klass == "ELEVATED") {
            if (ownSet != null && (name == "create_or_update_scenarios" || name == "create_or_update_constraints" || name == "create_or_update_requirements")) {
                ownClassDefer = true;
            } else {
                elevate("Operace '" + name + "' je politikou klasifikovana ELEVATED", "CLASS_ELEVATED", { op: name });
            }
        }
    }
    var j, lst;
    if (name == "create_element") {
        writeOps++; createOps++; curAct.items++; curAct.create++;
        if (o.name) { actAdd("targets", o.name); }
        if (o.name) { guardRaw(o.name, "create_element.name"); }
        touchPackage(o["package"], "create_element.package", false);
    } else if (name == "create_or_update_elements") {
        lst = o.elements || [];
        if (lst.length == 0) { elevate("create_or_update_elements bez elements - E_ARGS pri exekuci", "EMPTY_LIST", { op: name }); }
        for (j = 0; j < lst.length; j++) {
            var e = lst[j] || {};
            writeOps++; curAct.items++;
            if (e.guid || e.elementID) {
                curAct.update++;
                var tr = touchElement(e.guid || e.elementID, "elements[" + j + "]", true, true);
                if (e.type) {
                    if (tr.res) {
                        if (("" + tr.res.type) != ("" + e.type)) {
                            elevate("Update elementu se zmenou type ('" + tr.res.type + "' -> '" + e.type + "') - W2b", "TYPE_CHANGE", { from: "" + tr.res.type, to: "" + e.type, target: "" + tr.res.name });
                        }
                    } else if (!tr.own) {
                        elevate("Update s polem type bez moznosti porovnat typ - fail-closed W2b", "TYPE_UNVERIFIED", {});
                    }
                }
            } else {
                createOps++; curAct.create++;
                if (typeof e.name != "undefined" && e.name !== null && ("" + e.name) != "") { actAdd("targets", e.name); }
                if (e.matchByName || e.dedupKey) { updatedExisting++; updatedExistingApprox++; } // konzervativne: muze byt UPDATE
                if (typeof e.name != "undefined" && e.name !== null && ("" + e.name) != "") {
                    guardRaw(e.name, "elements[" + j + "].name");
                }
                if (e.owningElement) { touchElement(e.owningElement, "elements[" + j + "].owningElement", false, true); }
                else { touchPackage(e["package"], "elements[" + j + "].package", false); }
            }
        }
    } else if (name == "create_or_update_package") {
        lst = (o.packages && Object.prototype.toString.call(o.packages) == "[object Array]") ? o.packages : [o];
        for (j = 0; j < lst.length; j++) {
            var p = lst[j] || {};
            writeOps++; curAct.items++;
            if (p.guid || p.packageID) {
                curAct.update++;
                touchPackage(p.guid || p.packageID, "packages[" + j + "]", true);
            } else {
                createOps++; curAct.create++;
                if (p.matchByName) { updatedExisting++; updatedExistingApprox++; }
                if (p.name) { guardRaw(p.name, "packages[" + j + "].name"); actAdd("targets", p.name); }
                var tpr = touchPackage(p.parent, "packages[" + j + "].parent", false);
                // cil zapisu kap. 5.3 krok 4 (B1, O5 = a): koren modelu je chraneny jako
                // uzel - novy balicek primo pod korenem = duvod okna (ELEVATED)
                if (tpr && tpr.res && tpr.res.parentId === 0) {
                    elevate("Novy balicek '" + (p.name || "?") + "' primo pod korenem modelu '" + tpr.res.name + "' (packages[" + j + "].parent) - struktura nejvyssi urovne, vyzaduje potvrzeni", "ROOT_PACKAGE", { name: "" + (p.name || "?"), root: "" + tpr.res.name });
                }
            }
        }
    } else if (name == "create_or_update_connectors") {
        lst = o.connectors || [];
        if (lst.length == 0) { elevate("create_or_update_connectors bez connectors - E_ARGS pri exekuci", "EMPTY_LIST", { op: name }); }
        for (j = 0; j < lst.length; j++) {
            var c = lst[j] || {};
            writeOps++; curAct.items++;
            if (c.guid || c.connectorID) {
                updatedExisting++; curAct.update++;
                addEl("conn:" + (c.guid || c.connectorID));
            } else {
                createOps++; curAct.create++;
                if (c.match || c.dedupKey) { updatedExisting++; updatedExistingApprox++; }
                var tcs = touchElement(c.source, "connectors[" + j + "].source", false, false);
                var tct = touchElement(c.target, "connectors[" + j + "].target", false, false);
                if (curAct.pairs.length < 12) {
                    curAct.pairs.push(((tcs && tcs.res) ? tcs.res.name : ("" + c.source)) + " -> " + ((tct && tct.res) ? tct.res.name : ("" + c.target)) + (c.type ? " (" + c.type + ")" : ""));
                } else { curAct.pairsMore = (curAct.pairsMore || 0) + 1; }
            }
        }
    } else if (name == "create_or_update_attributes" || name == "create_or_update_operations") {
        lst = (name == "create_or_update_attributes" ? o.attributes : o.operations) || [];
        writeOps += (lst.length > 0 ? lst.length : 1); curAct.items += lst.length;
        touchElement(o.element, name + ".element", true, true);
        if (name == "create_or_update_operations") {
            for (j = 0; j < lst.length; j++) {
                var oo = lst[j] || {};
                if (oo.parameters && Object.prototype.toString.call(oo.parameters) == "[object Array]" && oo.parameters.length > 0) {
                    elevate("create_or_update_operations s parameters = deterministicky rebuild parametru - W2a", "OPS_PARAMS", {});
                    break;
                }
            }
        }
    } else if (name == "create_or_update_messages") {
        touchDiagram(o.diagram, "messages.diagram");
        lst = o.messages || [];
        writeOps += (lst.length > 0 ? lst.length : 1); curAct.items += lst.length;
        for (j = 0; j < lst.length; j++) {
            var mg = lst[j] || {};
            if (mg.source) { touchElement(mg.source, "messages[" + j + "].source", false, false); }
            if (mg.target) { touchElement(mg.target, "messages[" + j + "].target", false, false); }
        }
        if (o.rebuild === true || o.rebuild === "true") {
            elevate("create_or_update_messages s rebuild:true - V2d rebuild maze Sequence konektory diagramu", "MSG_REBUILD", {}); curAct.rebuild = true;
        }
    } else if (name == "delete_from_model") {
        lst = o.targets || [];
        for (j = 0; j < lst.length; j++) {
            var dt = lst[j] || {};
            deleteTargets++; writeOps++; curAct.items++;
            var dty = ("" + (dt.type || "")).toUpperCase();
            var dref = dt.guid || dt.id;
            if (dty == "ELEMENT") {
                var tde = touchElement(dref, "delete.targets[" + j + "]", false, true);
                if (tde && tde.res) { pushPathDel("element", tde.res.id, tde.res.name); deleteScopeElement(tde.res); }
                else if (checkBudget()) { addDelete({ kind: "element", ref: "" + dref, scopeKnown: false }); }
                else if (!(tde && tde.own)) { addDelete({ kind: "element", ref: "" + dref, scopeKnown: false, unresolved: true }); }
            } else if (dty == "PACKAGE") {
                var tdp = touchPackage(dref, "delete.targets[" + j + "]", false);
                if (tdp && tdp.res) { pushPathDel("package", tdp.res.id, tdp.res.name); deleteScopePackage(tdp.res); }
                else { addDelete({ kind: "package", ref: "" + dref, scopeKnown: false, unresolved: true }); }
            }
            else if (dty == "DIAGRAM") {
                var tdd = touchDiagram(dref, "delete.targets[" + j + "]");
                if (tdd && tdd.res) { addDelete({ kind: "diagram", name: "" + tdd.res.name, path: fullPath("diagram", tdd.res.id, tdd.res.name), scopeKnown: true }); }
                else { addDelete({ kind: "diagram", ref: "" + dref, scopeKnown: false, unresolved: !(tdd && tdd.own) }); }
            }
            else if (dty == "CONNECTOR") { if (typeof dref != "undefined" && dref !== null) { guardRaw(dref, "delete.targets[" + j + "]"); } deleteScopeConnector(dref); }
            else if (dty == "ATTRIBUTE") { deleteScopeOwned("attribute", dref, ""); }
            else if (dty == "OPERATION") { deleteScopeOwned("operation", dref, ""); }
            else if (dty == "PARAMETER") { deleteScopeOwned("parameter", dref, "" + (dt.name || "")); }
            else if (typeof dref != "undefined" && dref !== null) { guardRaw(dref, "delete.targets[" + j + "]"); addDelete({ kind: ("" + (dt.type || "?")).toLowerCase(), ref: "" + dref, scopeKnown: false }); }
            else { addDelete({ kind: ("" + (dt.type || "?")).toLowerCase(), ref: "", scopeKnown: false }); }
        }
        if (lst.length == 0) { elevate("delete_from_model bez targets - E_ARGS pri exekuci", "EMPTY_LIST", { op: name }); }
    } else if (name == "delete_taggedvalue_from_model") {
        lst = o.targets || [];
        deleteTargets += (lst.length > 0 ? lst.length : 1);
        writeOps += (lst.length > 0 ? lst.length : 1); curAct.items += lst.length;
        for (j = 0; j < lst.length; j++) {
            var dtv = lst[j] || {};
            if (dtv.guid || dtv.id) { guardRaw(dtv.guid || dtv.id, "deleteTag.targets[" + j + "]"); }
            var tvOwner = "";
            try { if (dtv.guid || dtv.id) { var tvr = resolveElement(dtv.guid || dtv.id); if (tvr && tvr != "BUDGET") { tvOwner = "" + tvr.name; } } } catch (eTv) { }
            addDelete({ kind: "tag", name: "" + (dtv.name || ""), owner: tvOwner, label: (tvOwner != "" ? tvOwner + "." : "") + (dtv.name || "?") + (dtv.type ? " (" + dtv.type + ")" : ""), scopeKnown: (tvOwner != "") });
        }
    } else if (name == "remove_elements_from_diagram") {
        touchDiagram(o.diagram, "removeFromDiagram.diagram");
        lst = o.elementIDs || [];
        writeOps += (lst.length > 0 ? lst.length : 1); curAct.items += lst.length;
        for (j = 0; j < lst.length; j++) { touchElement(lst[j], "removeFromDiagram.elementIDs[" + j + "]", false, false); }
    } else if (name == "create_baseline") {
        writeOps++;
        // Baseline politika par. 6.1 (B4): pokus o jmeno v REZERVOVANEM
        // prostoru automatickych baselines eskaluje NAD tridu politiky (vzor
        // W2a/W2b); exekuce ho navic odmitne E_ARGS (FB_OpBaselineCreate)
        var bnRes = false;
        try { bnRes = (typeof o.name != "undefined" && o.name !== null && self.FB_BaselineNameReserved(Repository, "" + o.name) === true); }
        catch (eBn) { bnRes = true; } // nejistota = fail-closed
        curAct.items++; if (o.name) { actAdd("targets", o.name); }
        if (bnRes) { elevate("create_baseline se jmenem v rezervovanem prostoru automatickych baselines (prefix FB-AUTO) - B4; exekuce odmitne E_ARGS", "BASELINE_RESERVED", { name: "" + o.name }); }
    } else if (name == "clone_package") {
        writeOps++; createOps++; curAct.items++;
        addReason("clone_package: objem klonu je znamy az pri exekuci (vykazan ve volume; kvotu kryje potvrzeni ELEVATED - migrace E_QUOTA par. 6.4)", "CLONE_VOLUME", { op: name });
    } else if (name == "clone_elements") {
        lst = o.elements || [];
        writeOps += (lst.length > 0 ? lst.length : 1);
        createOps += (lst.length > 0 ? lst.length : 1);
        curAct.items += lst.length;
        touchPackage(o["package"], "cloneElements.package", false);
        addReason("clone_elements: objem klonu je znamy az pri exekuci (vykazan ve volume; kvotu kryje potvrzeni ELEVATED - migrace E_QUOTA par. 6.4)", "CLONE_VOLUME", { op: name });
    } else if (name == "import_element_linked_documents") {
        lst = o.documents || [];
        writeOps += (lst.length > 0 ? lst.length : 1); curAct.items += lst.length;
        for (j = 0; j < lst.length; j++) {
            var dd = lst[j] || {};
            touchElement(dd.element, "importDocs.documents[" + j + "]", true, true);
        }
    } else if (name == "layout_connectors") {
        writeOps++;
        touchDiagram(o.diagram, "layoutConnectors.diagram");
    } else if (name == "change_connector_visibility") {
        lst = o.connectorIDs || [];
        writeOps += (lst.length > 0 ? lst.length : 1); curAct.items += lst.length;
        touchDiagram(o.diagram, "connectorVisibility.diagram");
    } else if (name == "update_diagram_properties") {
        lst = o.diagrams || [];
        if (lst.length == 0) { elevate("update_diagram_properties bez diagrams - E_ARGS pri exekuci", "EMPTY_LIST", { op: name }); }
        for (j = 0; j < lst.length; j++) {
            var ud = lst[j] || {};
            writeOps++; curAct.items++;
            var tdu = touchDiagram(ud.diagram, "diagramProps.diagrams[" + j + "]");
            if (!tdu.own) { updatedExisting++; }
        }
    } else if (name == "set_diagram_object_style") {
        lst = o.objects || [];
        writeOps += (lst.length > 0 ? lst.length : 1); curAct.items += lst.length;
        touchDiagram(o.diagram, "objectStyle.diagram");
    } else if (name == "create_or_update_diagram") {
        lst = o.diagrams || [];
        if (lst.length == 0) { elevate("create_or_update_diagram bez diagrams - E_ARGS pri exekuci", "EMPTY_LIST", { op: name }); }
        for (j = 0; j < lst.length; j++) {
            var dg = lst[j] || {};
            writeOps++; curAct.items++;
            // FB_OpDiagram bere UPDATE vetev pres diagram | diagramID | guid -
            // cteni jen `diagram` delalo z updatu ciziho diagramu "create"
            // (nalez H1 oponentury Baseline politiky 2026-09-20)
            var dgRef = dg.diagram || dg.diagramID || dg.guid;
            if (dgRef) {
                var tdg = touchDiagram(dgRef, "diagram.diagrams[" + j + "]");
                curAct.update++;
                if (!tdg.own) { updatedExisting++; }
            } else {
                createOps++; curAct.create++;
                if (dg.name) { actAdd("targets", dg.name); }
                if (dg.owningElement) { touchElement(dg.owningElement, "diagram.diagrams[" + j + "].owningElement", false, true); }
                else { touchPackage(dg["package"], "diagram.diagrams[" + j + "].package", false); }
            }
        }
    } else if (name == "place_elements_on_diagram") {
        touchDiagram(o.diagram, "place.diagram");
        lst = o.elementPlacements || [];
        writeOps += (lst.length > 0 ? lst.length : 1); curAct.items += lst.length;
        for (j = 0; j < lst.length; j++) {
            var pl = lst[j] || {};
            touchElement(pl.element || pl.elementID, "place.elementPlacements[" + j + "]", false, false);
        }
    } else if (name == "move_elements") {
        // presun = zapis do ZDROJOVE i CILOVE vetve; oba packages se pocitaji
        lst = o.elements || [];
        if (lst.length == 0) { elevate("move_elements bez elements - E_ARGS pri exekuci", "EMPTY_LIST", { op: name }); }
        writeOps += (lst.length > 0 ? lst.length : 1); curAct.items += lst.length;
        moveOps += (lst.length > 0 ? lst.length : 1);
        for (j = 0; j < lst.length; j++) {
            var mv = lst[j];
            var mvRef = (mv !== null && typeof mv == "object") ? (mv.element || mv.guid || mv.elementID) : mv;
            var mvHas = function (x, k) { return x !== null && typeof x == "object" && typeof x[k] != "undefined" && x[k] !== null && ("" + x[k]) != ""; };
            var mvItem = (mvHas(mv, "package") || mvHas(mv, "owningElement"));
            var mvPkg = mvItem ? (mvHas(mv, "package") ? mv["package"] : null) : (mvHas(o, "package") ? o["package"] : null);
            var mvOwn = mvItem ? (mvHas(mv, "owningElement") ? mv.owningElement : null) : (mvHas(o, "owningElement") ? o.owningElement : null); // v0.22 (N-RE-17)
            // countUpdate: presun je zmena existujiciho prvku; addPackages:
            // zapocte ZDROJOVY package prvku
            var tmv = touchElement(mvRef, "move.elements[" + j + "]", true, true);
            if (tmv && tmv.res) { pushPath("element", tmv.res.id, tmv.res.name); }
            // ZDROJOVY package i JMENEM - potvrzovaci dialog musi ukazat ODKUD
            // kam se prvek stehuje (touchElement zna jen jeho id, ne jmeno)
            if (tmv && tmv.res && tmv.res.pkgId > 0) {
                touchPackage("" + tmv.res.pkgId, "move.elements[" + j + "].fromPackage", false);
            }
            if (mvOwn !== null) {
                // cil = vlastnici prvek: jeho balicek se zapocita (addPackages), prvek sam se nemeni
                var tow = touchElement(mvOwn, "move.elements[" + j + "].owningElement", false, true);
                if (tow && tow.res) { actAdd("packages", "pod " + tow.res.name); }
            } else {
                touchPackage(mvPkg, "move.elements[" + j + "].package", false);
            }
        }
    } else if (name == "create_or_update_scenarios" || name == "create_or_update_constraints"
               || name == "create_or_update_requirements") {
        lst = (name == "create_or_update_scenarios" ? o.scenarios
              : (name == "create_or_update_constraints" ? o.constraints : o.requirements)) || [];
        writeOps += (lst.length > 0 ? lst.length : 1); curAct.items += lst.length;
        var tsc = touchElement(o.element, name + ".element", true, true);
        if (ownClassDefer) {
            if (tsc && tsc.own) {
                addReason("Operace '" + name + "' nad prvkem zalozenym touto session - bez okna (pravidlo 3, ownSessionLow)", "OWN_SESSION", { op: name });
            } else {
                elevate("Operace '" + name + "' je politikou klasifikovana ELEVATED (cizi prvek - prepis existujiciho obsahu)", "CLASS_ELEVATED_FOREIGN", { op: name, target: (tsc && tsc.res) ? "" + tsc.res.name : "" });
            }
        }
    } else if (name == "apply_classifier_stereotypes") {
        writeOps++; curAct.items++;
        touchDiagram(o.diagram, "classifierStereotypes.diagram");
        lst = o.elementIDs || [];
        for (j = 0; j < lst.length; j++) { touchElement(lst[j], "classifierStereotypes.elementIDs[" + j + "]", false, false); }
    } else if (name == "find_or_create_referencing_sr") {
        // deklarovany objem scaffoldu: 1 pkg + 4 diagramy + 4 elementy + 3 vazby
        // (worst case; found=true vetev nezapisuje nic - fail-closed nadpocet)
        writeOps += 12; createOps += 12; curAct.items++; curAct.create++;
        var tp = o.targetPackage;
        if (!tp) {
            try {
                var scf = this.FB_ScaffoldConfig();
                var rid2 = ("" + this.FB_RepoId(Repository)).toUpperCase();
                for (var si = 0; si < scf.length; si++) {
                    if (rid2.indexOf(("" + scf[si].repo).toUpperCase()) >= 0) { tp = scf[si].unsortedPkg; break; }
                }
            } catch (eSc) { tp = null; }
        }
        if (tp) { touchPackage(tp, "scaffold.targetPackage", false); }
        else { elevate("find_or_create_referencing_sr bez targetPackage a bez FB_ScaffoldConfig - cil neznamy (fail-closed)", "TARGET_MISSING", { ctx: "scaffold.targetPackage" }); }
    } else if (name == "deploy_src") {
        writeOps++; curAct.items++;
        // N-E2E-1: okno rekne "nasazeni kodu: N operaci" - pocet souboru src\ (best-effort, jen cteni slozky)
        try {
            var cfgD = self.FB_Config(), ridD = ("" + self.FB_RepoId(Repository)).toUpperCase(), srcDirD = "";
            for (var cdi = 0; cdi < cfgD.length; cdi++) { if (ridD.indexOf(("" + cfgD[cdi].repo).toUpperCase()) >= 0) { srcDirD = "" + (cfgD[cdi].srcDir || ""); break; } }
            if (srcDirD != "" && typeof Enumerator != "undefined") {
                var fsoD2 = self.FB_ComObj("Scripting.FileSystemObject");
                var fdD = fsoD2.GetFolder(srcDirD), fcD = new Enumerator(fdD.Files), nD = 0;
                for (; !fcD.atEnd(); fcD.moveNext()) { if (/^AICodeBridge\..+\.js$/i.test("" + fcD.item().Name)) { nD++; } }
                curAct.files = nD;
            }
        } catch (eDs) { }
        // cilem je vzdy element AICodeBridge; B4 target pravidlo se na deploy_src
        // NEaplikuje - deploy_src je prave ta chranena cesta zmeny konfigurace
        // (dev; v bance FB_OpsAllowed deny + politika BLOCKED)
    } else {
        // zapisova operace bez metrickeho pravidla = neznamy objem -> fail-closed
        writeOps++; curAct.items++;
        elevate("Zapisova operace '" + name + "' bez metrickeho pravidla - fail-closed (neznamy objem)", "NO_METRIC_RULE", { op: name });
    }
}
if (budgetHit || metricsIncomplete) {
    elevate("Metriky nespocitany - prekrocen rozpocet " + budget + " ms (fail-closed W5)", "BUDGET", { ms: budget });
}

// --- prahy politiky ---
if (polValid) {
    // function expression, ne declaration - deklarace v bloku neni ES3
    // N-RE-12: u affectedPackages nese duvod i vycet balicku (text + args.packages)
    var thrArgs = function (key, v, lim) {
        var a = { key: key, value: v, limit: lim };
        if (key == "affectedPackages") { var pl = pkgList(false); a.packages = pl.names; a.packagesMore = pl.more; }
        return a;
    };
    var thrSuffix = function (key) { var t = (key == "affectedPackages") ? pkgListText() : ""; return t ? " (" + t + ")" : ""; };
    var overB = function (v, key) {
        if (v > pol.block[key]) { block("Prah BLOCKED prekrocen: " + key + " " + v + " > " + pol.block[key] + thrSuffix(key), "THRESHOLD_BLOCKED", thrArgs(key, v, pol.block[key])); }
    };
    var overE = function (v, key) {
        if (v > pol.elevate[key]) { elevate("Prah ELEVATED prekrocen: " + key + " " + v + " > " + pol.elevate[key] + thrSuffix(key), "THRESHOLD_ELEVATED", thrArgs(key, v, pol.elevate[key])); }
    };
    overB(deleteTargets, "deleteTargets");
    overB(writeOps, "writeOps");
    overB(updatedExisting, "updatedExisting");
    overB(pkgCount, "affectedPackages");
    overE(deleteTargets, "deleteTargets");
    overE(writeOps, "writeOps");
    overE(updatedExisting, "updatedExisting");
    overE(pkgCount, "affectedPackages");
    overE(dgmCount, "foreignDiagrams");
    // moveOps = VOLITELNY prah (iterace 6): chybejici hodnota politiku
    // neznevaliduje (jinak by novy prah shodil kazdou driv nasazenou
    // politiku do ELEVATED); trida move_elements ELEVATED plati vzdy
    if (typeof pol.elevate.moveOps == "number") { overE(moveOps, "moveOps"); }
}

// N-RE-12: summary.packages doplnit o balicky zapoctene jen pres prvky/diagramy
// (touchElement/touchDiagram daly jen ID) - okno i E_RISK_BLOCKED pak rikaji KAM.
// POZOR: summary.packages jsou PROSTA jmena (FB_QcRun $PKGNAMES = t_package.Name IN (...),
// FB_ConfirmSummary) - teckove cesty jdou zvlast do summary.packagePaths.
var pkgPaths = [];
if (pkgIds.length > 0) {
    inDelete = false;
    var plS = pkgList(true);
    pkgPaths = plS.names;
    if (pkgNames.length < pkgCount) {
        for (var ps = 0; ps < plS.names.length; ps++) {
            var last = plS.names[ps], dot = last.lastIndexOf(".");
            if (dot >= 0) { last = last.substring(dot + 1); }
            pushName(pkgNames, "p", last); // dedup pres nameSeen
        }
    }
}
return {
    riskLevel: (level == 3 ? "BLOCKED" : (level == 2 ? "ELEVATED" : "LOW")),
    riskReasons: reasons,
    reasonItems: reasonItems, // v0.19: stabilni kody duvodu (FB_ReasonText, tag ai.risk.codes)
    policyValid: polValid,
    baselinePolicyValid: blValid,
    summary: { ops: opCounts, targets: tgtNames, packages: pkgNames, packagePaths: pkgPaths, diagrams: dgmNames, paths: tgtPaths,
               targetsMore: nameMore.e, packagesMore: nameMore.p, diagramsMore: nameMore.d,
               deletes: deletes, actions: actions },
    metrics: {
        writeOps: writeOps, createOps: createOps, updatedExisting: updatedExisting,
        deleteTargets: deleteTargets, affectedElements: elCount,
        affectedPackages: pkgCount, affectedDiagrams: dgmCount,
        moveOps: moveOps, // iterace 6: skutecne presuny (operace move_elements)
        updatedExistingApprox: updatedExistingApprox, // cast updatedExisting z match/dedup (B5/b)
        metricsComplete: !(budgetHit || metricsIncomplete)
    },
    elapsedMs: (new Date().getTime() - t0),
    budgetMs: budget,
    hashMaxChars: (polValid && typeof pol.hashMaxChars == "number") ? pol.hashMaxChars : 2000000
};
