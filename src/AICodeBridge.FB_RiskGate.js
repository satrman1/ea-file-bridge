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
//    zadani navic FB_Whitelist - tez konfiguracni sekce) -> BLOCKED.
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
var self = this;
var t0 = new Date().getTime();
var reasons = [], reasonSeen = {};
var level = 1; // 1=LOW 2=ELEVATED 3=BLOCKED
function addReason(msg) { if (reasonSeen[msg] != 1) { reasonSeen[msg] = 1; reasons.push(msg); } }
function elevate(msg) { if (level < 2) { level = 2; } addReason(msg); }
function block(msg) { level = 3; addReason(msg); }

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
if (!polValid) { elevate("Politika nevalidni (" + polWhy + ") - fail-closed W9: zadny auto-write"); }
var budget = (polValid && typeof pol.budgetMs == "number") ? pol.budgetMs : 8000;
var budgetHit = false;
function checkBudget() {
    if (!budgetHit && (new Date().getTime() - t0) > budget) { budgetHit = true; }
    return budgetHit;
}

// --- B4: chranene konfiguracni elementy bridge ---
var PROT = { "AICODEBRIDGE": 1, "FB_RISKPOLICY": 1, "FB_OPSALLOWED": 1,
             "FB_CONFIG": 1, "FB_SCAFFOLDCONFIG": 1, "FB_WHITELIST": 1,
             "FB_ACCESSGROUPS": 1 }; // FB_AccessGroups = iterace 5 (A)
var bridgeGuid = "", bridgeId = -1;
try {
    var br = this.FB_XmlRows(Repository.SQLQuery(
        "SELECT Object_ID, ea_guid FROM t_object WHERE Name = 'AICodeBridge' AND Stereotype = 'JavascriptAddin'"));
    if (br.length > 0) { bridgeGuid = ("" + br[0].ea_guid).toUpperCase(); bridgeId = parseInt(br[0].Object_ID, 10); }
} catch (eBr) { }
function guardRaw(ref, ctx) {
    var u = ("" + ref).replace(/^\s+|\s+$/g, "").toUpperCase();
    if (u == "") { return; }
    if (PROT[u] == 1) { block("Target '" + ref + "' (" + ctx + ") = konfiguracni element bridge - BLOCKED (B4)"); return; }
    if (bridgeGuid != "" && u == bridgeGuid) { block("Target " + ref + " (" + ctx + ") = element AICodeBridge - BLOCKED (B4)"); return; }
    if (bridgeId >= 0 && /^[0-9]+$/.test(u) && parseInt(u, 10) == bridgeId) { block("Target " + ref + " (" + ctx + ") = element AICodeBridge - BLOCKED (B4)"); }
}
function guardResolved(res, ctx) {
    if (res == null) { return; }
    if (PROT[("" + res.name).toUpperCase()] == 1
        || (bridgeGuid != "" && ("" + res.guid).toUpperCase() == bridgeGuid)
        || (bridgeId >= 0 && res.id == bridgeId)) {
        block("Target '" + res.name + "' (" + ctx + ") = konfiguracni element bridge - BLOCKED (B4)");
    }
}

// --- resolvery (cache, jen standardni sloupce) ---
var elCache = {}, pkgCache = {}, dgmCache = {};
function esc(s) { return ("" + s).replace(/'/g, "''"); }
function rows(sql) { return self.FB_XmlRows(Repository.SQLQuery(sql)); }
function resolveElement(ref) {
    var key = "e:" + ref;
    if (typeof elCache[key] != "undefined") { return elCache[key]; }
    if (checkBudget()) { return "BUDGET"; }
    var t = ("" + ref).replace(/^\s+|\s+$/g, ""), rr = null, r = null;
    try {
        if (t.charAt(0) == "{") {
            rr = rows("SELECT Object_ID, ea_guid, Package_ID, Object_Type, Name FROM t_object WHERE ea_guid = '" + esc(t) + "'");
        } else if (/^[0-9]+$/.test(t)) {
            rr = rows("SELECT Object_ID, ea_guid, Package_ID, Object_Type, Name FROM t_object WHERE Object_ID = " + parseInt(t, 10));
        } else {
            rr = rows("SELECT Object_ID, ea_guid, Package_ID, Object_Type, Name FROM t_object WHERE Name = '" + esc(t) + "'");
        }
    } catch (eq) { rr = null; }
    if (rr != null && rr.length > 0) {
        r = { guid: "" + rr[0].ea_guid, id: parseInt(rr[0].Object_ID, 10),
              pkgId: parseInt(rr[0].Package_ID, 10), type: "" + rr[0].Object_Type, name: "" + rr[0].Name };
    }
    elCache[key] = r;
    return r;
}
function resolvePackage(ref) {
    var key = "p:" + ref;
    if (typeof pkgCache[key] != "undefined") { return pkgCache[key]; }
    if (checkBudget()) { return "BUDGET"; }
    var t = ("" + ref).replace(/^\s+|\s+$/g, ""), rr = null, r = null;
    try {
        if (t.charAt(0) == "{") {
            rr = rows("SELECT Package_ID, ea_guid, Name FROM t_package WHERE ea_guid = '" + esc(t) + "'");
        } else if (/^[0-9]+$/.test(t)) {
            rr = rows("SELECT Package_ID, ea_guid, Name FROM t_package WHERE Package_ID = " + parseInt(t, 10));
        } else {
            rr = rows("SELECT Package_ID, ea_guid, Name FROM t_package WHERE Name = '" + esc(t) + "'");
        }
    } catch (eq2) { rr = null; }
    if (rr != null && rr.length > 0) {
        r = { guid: "" + rr[0].ea_guid, id: parseInt(rr[0].Package_ID, 10), name: "" + rr[0].Name };
    }
    pkgCache[key] = r;
    return r;
}
function resolveDiagram(ref) {
    var key = "d:" + ref;
    if (typeof dgmCache[key] != "undefined") { return dgmCache[key]; }
    if (checkBudget()) { return "BUDGET"; }
    var t = ("" + ref).replace(/^\s+|\s+$/g, ""), rr = null, r = null;
    try {
        if (t.charAt(0) == "{") {
            rr = rows("SELECT Diagram_ID, ea_guid, Package_ID, Name FROM t_diagram WHERE ea_guid = '" + esc(t) + "'");
        } else if (/^[0-9]+$/.test(t)) {
            rr = rows("SELECT Diagram_ID, ea_guid, Package_ID, Name FROM t_diagram WHERE Diagram_ID = " + parseInt(t, 10));
        } else {
            rr = rows("SELECT Diagram_ID, ea_guid, Package_ID, Name FROM t_diagram WHERE Name = '" + esc(t) + "'");
        }
    } catch (eq3) { rr = null; }
    if (rr != null && rr.length > 0) {
        r = { guid: "" + rr[0].ea_guid, id: parseInt(rr[0].Diagram_ID, 10),
              pkgId: parseInt(rr[0].Package_ID, 10), name: "" + rr[0].Name };
    }
    dgmCache[key] = r;
    return r;
}

// --- metriky ---
var writeOps = 0, createOps = 0, updatedExisting = 0, deleteTargets = 0, moveOps = 0;
var elSet = {}, elCount = 0, pkgSet = {}, pkgCount = 0, dgmSet = {}, dgmCount = 0;
function addEl(k) { if (elSet[k] != 1) { elSet[k] = 1; elCount++; } }
function addPkg(k) { if (pkgSet[k] != 1) { pkgSet[k] = 1; pkgCount++; } }
function addForeignDgm(k) { if (dgmSet[k] != 1) { dgmSet[k] = 1; dgmCount++; } }
// --- souhrn pro potvrzovaci UI (V2, I6: dialog zobrazuje konkretni davku) ---
var opCounts = {}, tgtNames = [], pkgNames = [], dgmNames = [], nameSeen = {};
function pushName(arr, prefix, nm) {
    var k = prefix + ":" + nm;
    if (nameSeen[k] == 1) { return; }
    nameSeen[k] = 1;
    if (arr.length < 12) { arr.push("" + nm); }
    else if (arr.length == 12) { arr.push("..."); }
}
// --- PLNE TECKOVE CESTY mazanych / presouvanych cilu (nalez Milose
// 2026-08-31, E2E T7-05 "MLA": dialog neukazal, KDE prvek lezi). Stejny
// vzor jako whitelist v pingu (par. 4.5): FB_ElementPath. Jen pro
// delete_from_model + move_elements (zasahy do struktury); best-effort,
// nikdy nespadne - je to popisek pro cloveka. Do summary.paths.
var tgtPaths = [], pathSeen = {};
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
var refRe = /^\$(\d+)(?:\[(\d+)\])?(?:\.(id|guid))?$/;
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
        return dit.diagram ? "EXISTING" : "OWN";
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
        elevate("Chybejici target (" + ctx + ") - fail-closed");
        return { own: false };
    }
    var m = refRe.exec("" + ref);
    if (m) {
        var kind = classifyDollar(m);
        if (kind == "OWN") { return { own: true }; }
        if (kind == "UNCERTAIN") { elevate("$N reference '" + ref + "' (" + ctx + ") s nejistym puvodem - fail-closed B3"); }
        if (countUpdate) { updatedExisting++; }
        addEl("$:" + ref); // identita znama az za behu; package se nezapocita (viz hlavicka)
        return { own: false };
    }
    guardRaw(ref, ctx);
    var res = resolveElement(ref);
    if (res == "BUDGET") { return { own: false }; }
    if (res == null) {
        elevate("Neresolvovatelny target '" + ref + "' (" + ctx + ") - fail-closed");
        if (countUpdate) { updatedExisting++; }
        return { own: false };
    }
    guardResolved(res, ctx);
    addEl(res.guid);
    pushName(tgtNames, "e", res.name);
    if (addPackages && res.pkgId > 0) { addPkg("p" + res.pkgId); }
    if (countUpdate) { updatedExisting++; }
    return { own: false, res: res };
}
function touchPackage(ref, ctx, countUpdate) {
    if (ref === null || typeof ref == "undefined" || ("" + ref) == "") {
        elevate("Chybejici package (" + ctx + ") - fail-closed");
        return;
    }
    var m = refRe.exec("" + ref);
    if (m) {
        var kind = classifyDollar(m);
        if (kind == "OWN") { return; } // zapis do package vytvoreneho touto davkou
        if (kind == "UNCERTAIN") { elevate("$N reference '" + ref + "' (" + ctx + ") s nejistym puvodem - fail-closed B3"); }
        if (countUpdate) { updatedExisting++; }
        addPkg("$:" + ref);
        return;
    }
    guardRaw(ref, ctx);
    var res = resolvePackage(ref);
    if (res == "BUDGET") { return; }
    if (res == null) { elevate("Neresolvovatelny package '" + ref + "' (" + ctx + ") - fail-closed"); return; }
    if (PROT[("" + res.name).toUpperCase()] == 1) { block("Target package '" + res.name + "' (" + ctx + ") = konfiguracni jmeno bridge - BLOCKED (B4)"); }
    if (countUpdate) { updatedExisting++; }
    addPkg("p" + res.id);
    pushName(pkgNames, "p", res.name);
    return { res: res };
}
// vraci { own: bool } - cizi (ne-vlastni) diagram jde do foreignDiagrams
function touchDiagram(ref, ctx) {
    if (ref === null || typeof ref == "undefined" || ("" + ref) == "") {
        elevate("Chybejici diagram (" + ctx + ") - fail-closed");
        return { own: false };
    }
    var m = refRe.exec("" + ref);
    if (m) {
        var kind = classifyDollar(m);
        if (kind == "OWN") { return { own: true }; }
        if (kind == "UNCERTAIN") { elevate("$N reference '" + ref + "' (" + ctx + ") s nejistym puvodem - fail-closed B3"); }
        addForeignDgm("$:" + ref);
        return { own: false };
    }
    var res = resolveDiagram(ref);
    if (res == "BUDGET") { return { own: false }; }
    if (res == null) {
        elevate("Neresolvovatelny diagram '" + ref + "' (" + ctx + ") - fail-closed");
        addForeignDgm("?:" + ref);
        return { own: false };
    }
    addForeignDgm(res.guid);
    pushName(dgmNames, "d", res.name);
    if (res.pkgId > 0) { addPkg("p" + res.pkgId); }
    return { own: false };
}

// --- W8: prvni zapisova davka po vyjimce/zotaveni predchozi davky ---
try {
    if (this._fbPrevExc === true) {
        elevate("Predchozi davka skoncila vyjimkou/zotavenim - prvni zapisova davka jde ELEVATED (W8)");
    }
} catch (eW8) { }

// --- pruchod operacemi ---
var metricsIncomplete = false;
for (opIndex = 0; opIndex < req.ops.length; opIndex++) {
    if (checkBudget()) { metricsIncomplete = true; break; }
    var o = req.ops[opIndex];
    var name = "" + (o && o.op ? o.op : "?");
    var rg = reg[name];
    if (!rg) {
        writeOps++;
        elevate("Neznama operace '" + name + "' - fail-closed (exekuci zastavi E_UNKNOWN_OP)");
        continue;
    }
    if (!rg.w) { continue; } // cteci operace mimo gate
    opCounts[name] = (opCounts[name] ? opCounts[name] + 1 : 1); // souhrn UI
    if (polValid) {
        var klass = pol.classes[name];
        if (klass == "BLOCKED") { block("Operace '" + name + "' je politikou klasifikovana BLOCKED"); }
        else if (klass == "ELEVATED") { elevate("Operace '" + name + "' je politikou klasifikovana ELEVATED"); }
    }
    var j, lst;
    if (name == "create_element") {
        writeOps++; createOps++;
        if (o.name) { guardRaw(o.name, "create_element.name"); }
        touchPackage(o["package"], "create_element.package", false);
    } else if (name == "create_or_update_elements") {
        lst = o.elements || [];
        if (lst.length == 0) { elevate("create_or_update_elements bez elements - E_ARGS pri exekuci"); }
        for (j = 0; j < lst.length; j++) {
            var e = lst[j] || {};
            writeOps++;
            if (e.guid || e.elementID) {
                var tr = touchElement(e.guid || e.elementID, "elements[" + j + "]", true, true);
                if (e.type) {
                    if (tr.res) {
                        if (("" + tr.res.type) != ("" + e.type)) {
                            elevate("Update elementu se zmenou type ('" + tr.res.type + "' -> '" + e.type + "') - W2b");
                        }
                    } else if (!tr.own) {
                        elevate("Update s polem type bez moznosti porovnat typ - fail-closed W2b");
                    }
                }
            } else {
                createOps++;
                if (e.matchByName || e.dedupKey) { updatedExisting++; } // konzervativne: muze byt UPDATE
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
            writeOps++;
            if (p.guid || p.packageID) {
                touchPackage(p.guid || p.packageID, "packages[" + j + "]", true);
            } else {
                createOps++;
                if (p.matchByName) { updatedExisting++; }
                if (p.name) { guardRaw(p.name, "packages[" + j + "].name"); }
                touchPackage(p.parent, "packages[" + j + "].parent", false);
            }
        }
    } else if (name == "create_or_update_connectors") {
        lst = o.connectors || [];
        if (lst.length == 0) { elevate("create_or_update_connectors bez connectors - E_ARGS pri exekuci"); }
        for (j = 0; j < lst.length; j++) {
            var c = lst[j] || {};
            writeOps++;
            if (c.guid || c.connectorID) {
                updatedExisting++;
                addEl("conn:" + (c.guid || c.connectorID));
            } else {
                createOps++;
                if (c.match || c.dedupKey) { updatedExisting++; }
                touchElement(c.source, "connectors[" + j + "].source", false, false);
                touchElement(c.target, "connectors[" + j + "].target", false, false);
            }
        }
    } else if (name == "create_or_update_attributes" || name == "create_or_update_operations") {
        lst = (name == "create_or_update_attributes" ? o.attributes : o.operations) || [];
        writeOps += (lst.length > 0 ? lst.length : 1);
        touchElement(o.element, name + ".element", true, true);
        if (name == "create_or_update_operations") {
            for (j = 0; j < lst.length; j++) {
                var oo = lst[j] || {};
                if (oo.parameters && Object.prototype.toString.call(oo.parameters) == "[object Array]" && oo.parameters.length > 0) {
                    elevate("create_or_update_operations s parameters = deterministicky rebuild parametru - W2a");
                    break;
                }
            }
        }
    } else if (name == "create_or_update_messages") {
        touchDiagram(o.diagram, "messages.diagram");
        lst = o.messages || [];
        writeOps += (lst.length > 0 ? lst.length : 1);
        for (j = 0; j < lst.length; j++) {
            var mg = lst[j] || {};
            if (mg.source) { touchElement(mg.source, "messages[" + j + "].source", false, false); }
            if (mg.target) { touchElement(mg.target, "messages[" + j + "].target", false, false); }
        }
        if (o.rebuild === true || o.rebuild === "true") {
            elevate("create_or_update_messages s rebuild:true - V2d rebuild maze Sequence konektory diagramu");
        }
    } else if (name == "delete_from_model") {
        lst = o.targets || [];
        for (j = 0; j < lst.length; j++) {
            var dt = lst[j] || {};
            deleteTargets++; writeOps++;
            var dty = ("" + (dt.type || "")).toUpperCase();
            var dref = dt.guid || dt.id;
            if (dty == "ELEMENT") {
                var tde = touchElement(dref, "delete.targets[" + j + "]", false, true);
                if (tde && tde.res) { pushPath("element", tde.res.id, tde.res.name); }
            } else if (dty == "PACKAGE") {
                var tdp = touchPackage(dref, "delete.targets[" + j + "]", false);
                if (tdp && tdp.res) { pushPath("package", tdp.res.id, tdp.res.name); }
            }
            else if (dty == "DIAGRAM") { touchDiagram(dref, "delete.targets[" + j + "]"); }
            else if (typeof dref != "undefined" && dref !== null) { guardRaw(dref, "delete.targets[" + j + "]"); }
        }
        if (lst.length == 0) { elevate("delete_from_model bez targets - E_ARGS pri exekuci"); }
    } else if (name == "delete_taggedvalue_from_model") {
        lst = o.targets || [];
        deleteTargets += (lst.length > 0 ? lst.length : 1);
        writeOps += (lst.length > 0 ? lst.length : 1);
        for (j = 0; j < lst.length; j++) {
            var dtv = lst[j] || {};
            if (dtv.guid || dtv.id) { guardRaw(dtv.guid || dtv.id, "deleteTag.targets[" + j + "]"); }
        }
    } else if (name == "remove_elements_from_diagram") {
        touchDiagram(o.diagram, "removeFromDiagram.diagram");
        lst = o.elementIDs || [];
        writeOps += (lst.length > 0 ? lst.length : 1);
        for (j = 0; j < lst.length; j++) { touchElement(lst[j], "removeFromDiagram.elementIDs[" + j + "]", false, false); }
    } else if (name == "create_baseline") {
        writeOps++;
    } else if (name == "clone_package") {
        writeOps++; createOps++;
        addReason("clone_package: objem klonu je znamy az pri exekuci (vykazan ve volume; kvotu kryje potvrzeni ELEVATED - migrace E_QUOTA par. 6.4)");
    } else if (name == "clone_elements") {
        lst = o.elements || [];
        writeOps += (lst.length > 0 ? lst.length : 1);
        createOps += (lst.length > 0 ? lst.length : 1);
        touchPackage(o["package"], "cloneElements.package", false);
        addReason("clone_elements: objem klonu je znamy az pri exekuci (vykazan ve volume; kvotu kryje potvrzeni ELEVATED - migrace E_QUOTA par. 6.4)");
    } else if (name == "import_element_linked_documents") {
        lst = o.documents || [];
        writeOps += (lst.length > 0 ? lst.length : 1);
        for (j = 0; j < lst.length; j++) {
            var dd = lst[j] || {};
            touchElement(dd.element, "importDocs.documents[" + j + "]", true, true);
        }
    } else if (name == "layout_connectors") {
        writeOps++;
        touchDiagram(o.diagram, "layoutConnectors.diagram");
    } else if (name == "change_connector_visibility") {
        lst = o.connectorIDs || [];
        writeOps += (lst.length > 0 ? lst.length : 1);
        touchDiagram(o.diagram, "connectorVisibility.diagram");
    } else if (name == "update_diagram_properties") {
        lst = o.diagrams || [];
        if (lst.length == 0) { elevate("update_diagram_properties bez diagrams - E_ARGS pri exekuci"); }
        for (j = 0; j < lst.length; j++) {
            var ud = lst[j] || {};
            writeOps++;
            var tdu = touchDiagram(ud.diagram, "diagramProps.diagrams[" + j + "]");
            if (!tdu.own) { updatedExisting++; }
        }
    } else if (name == "set_diagram_object_style") {
        lst = o.objects || [];
        writeOps += (lst.length > 0 ? lst.length : 1);
        touchDiagram(o.diagram, "objectStyle.diagram");
    } else if (name == "create_or_update_diagram") {
        lst = o.diagrams || [];
        if (lst.length == 0) { elevate("create_or_update_diagram bez diagrams - E_ARGS pri exekuci"); }
        for (j = 0; j < lst.length; j++) {
            var dg = lst[j] || {};
            writeOps++;
            if (dg.diagram) {
                var tdg = touchDiagram(dg.diagram, "diagram.diagrams[" + j + "]");
                if (!tdg.own) { updatedExisting++; }
            } else {
                createOps++;
                if (dg.owningElement) { touchElement(dg.owningElement, "diagram.diagrams[" + j + "].owningElement", false, true); }
                else { touchPackage(dg["package"], "diagram.diagrams[" + j + "].package", false); }
            }
        }
    } else if (name == "place_elements_on_diagram") {
        touchDiagram(o.diagram, "place.diagram");
        lst = o.elementPlacements || [];
        writeOps += (lst.length > 0 ? lst.length : 1);
        for (j = 0; j < lst.length; j++) {
            var pl = lst[j] || {};
            touchElement(pl.element || pl.elementID, "place.elementPlacements[" + j + "]", false, false);
        }
    } else if (name == "move_elements") {
        // presun = zapis do ZDROJOVE i CILOVE vetve; oba packages se pocitaji
        lst = o.elements || [];
        if (lst.length == 0) { elevate("move_elements bez elements - E_ARGS pri exekuci"); }
        writeOps += (lst.length > 0 ? lst.length : 1);
        moveOps += (lst.length > 0 ? lst.length : 1);
        for (j = 0; j < lst.length; j++) {
            var mv = lst[j];
            var mvRef = (mv !== null && typeof mv == "object") ? (mv.element || mv.guid || mv.elementID) : mv;
            var mvPkg = (mv !== null && typeof mv == "object" && typeof mv["package"] != "undefined"
                && mv["package"] !== null && ("" + mv["package"]) != "") ? mv["package"] : o["package"];
            // countUpdate: presun je zmena existujiciho prvku; addPackages:
            // zapocte ZDROJOVY package prvku
            var tmv = touchElement(mvRef, "move.elements[" + j + "]", true, true);
            if (tmv && tmv.res) { pushPath("element", tmv.res.id, tmv.res.name); }
            // ZDROJOVY package i JMENEM - potvrzovaci dialog musi ukazat ODKUD
            // kam se prvek stehuje (touchElement zna jen jeho id, ne jmeno)
            if (tmv && tmv.res && tmv.res.pkgId > 0) {
                touchPackage("" + tmv.res.pkgId, "move.elements[" + j + "].fromPackage", false);
            }
            touchPackage(mvPkg, "move.elements[" + j + "].package", false);
        }
    } else if (name == "create_or_update_scenarios" || name == "create_or_update_constraints"
               || name == "create_or_update_requirements") {
        lst = (name == "create_or_update_scenarios" ? o.scenarios
              : (name == "create_or_update_constraints" ? o.constraints : o.requirements)) || [];
        writeOps += (lst.length > 0 ? lst.length : 1);
        touchElement(o.element, name + ".element", true, true);
    } else if (name == "apply_classifier_stereotypes") {
        writeOps++;
        touchDiagram(o.diagram, "classifierStereotypes.diagram");
        lst = o.elementIDs || [];
        for (j = 0; j < lst.length; j++) { touchElement(lst[j], "classifierStereotypes.elementIDs[" + j + "]", false, false); }
    } else if (name == "find_or_create_referencing_sr") {
        // deklarovany objem scaffoldu: 1 pkg + 4 diagramy + 4 elementy + 3 vazby
        // (worst case; found=true vetev nezapisuje nic - fail-closed nadpocet)
        writeOps += 12; createOps += 12;
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
        else { elevate("find_or_create_referencing_sr bez targetPackage a bez FB_ScaffoldConfig - cil neznamy (fail-closed)"); }
    } else if (name == "deploy_src") {
        writeOps++;
        // cilem je vzdy element AICodeBridge; B4 target pravidlo se na deploy_src
        // NEaplikuje - deploy_src je prave ta chranena cesta zmeny konfigurace
        // (dev; v bance FB_OpsAllowed deny + politika BLOCKED)
    } else {
        // zapisova operace bez metrickeho pravidla = neznamy objem -> fail-closed
        writeOps++;
        elevate("Zapisova operace '" + name + "' bez metrickeho pravidla - fail-closed (neznamy objem)");
    }
}
if (budgetHit || metricsIncomplete) {
    elevate("Metriky nespocitany - prekrocen rozpocet " + budget + " ms (fail-closed W5)");
}

// --- prahy politiky ---
if (polValid) {
    // function expression, ne declaration - deklarace v bloku neni ES3
    var overB = function (v, key) {
        if (v > pol.block[key]) { block("Prah BLOCKED prekrocen: " + key + " " + v + " > " + pol.block[key]); }
    };
    var overE = function (v, key) {
        if (v > pol.elevate[key]) { elevate("Prah ELEVATED prekrocen: " + key + " " + v + " > " + pol.elevate[key]); }
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

return {
    riskLevel: (level == 3 ? "BLOCKED" : (level == 2 ? "ELEVATED" : "LOW")),
    riskReasons: reasons,
    policyValid: polValid,
    summary: { ops: opCounts, targets: tgtNames, packages: pkgNames, diagrams: dgmNames, paths: tgtPaths },
    metrics: {
        writeOps: writeOps, createOps: createOps, updatedExisting: updatedExisting,
        deleteTargets: deleteTargets, affectedElements: elCount,
        affectedPackages: pkgCount, affectedDiagrams: dgmCount,
        moveOps: moveOps, // iterace 6: skutecne presuny (operace move_elements)
        metricsComplete: !(budgetHit || metricsIncomplete)
    },
    elapsedMs: (new Date().getTime() - t0),
    budgetMs: budget,
    hashMaxChars: (polValid && typeof pol.hashMaxChars == "number") ? pol.hashMaxChars : 2000000
};
