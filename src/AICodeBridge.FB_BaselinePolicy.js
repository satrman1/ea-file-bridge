// AICodeBridge.FB_BaselinePolicy(Repository, req, risk, cfg, reg)
// BASELINE POLITIKA - SCOPE (zadani v1.2 par. 4.2): ktere packages jsou
// "nejblizsi vlastnici package cilu zapisu" teto davky. Tabulka SCOPE je
// NORMATIVNI (kod, ne dokument): KAZDA zapisova operace registru FB_Main
// (w: true) MUSI mit polozku - hlida test/harness.js (vzor validace classes
// ve FB_RiskGate); operace bez polozky = `unknown` (fail-closed, T6-29).
//
// Vraci { packages:[{id, guid, name, path, why[], parentOverThreshold}],
//         unknown, unknownWhy[], overLimit, volumeUnknown, destructive,
//         destructiveOps[], missingScope[], baselineRoot, normalized: true, ms }.
// CIL ZAPISU - rezim blacklist (Z261004b-10, zadani cil zapisu v1.1 kap. 5.9, B3):
//   - update konektoru dle guid/ID: konce se dohledaji jednim SELECT nad
//     t_connector -> rozsah znamy (package zdroje), uz ne "unknown"
//   - $N na jinou nez create vetev: pro zalohu se vezme balicek cile
//     PREDCHOZI operace (je znam z jeji definice - dollarPkg)
//   - delete package: rodic je "povoleny" vzdy (dedicna ochrana predka = cil
//     by byl chraneny), ale zaloha nad nim jen kdyz projde velikostni sondou
//     FB_SubtreeCount (subtreeMax) - a to i pri thresholdsShadow: true (I13;
//     precedens FB_SessionStart); jinak baseline nad mazanym balickem samym +
//     parentOverThreshold (varianta T6-28: zaloha zanikne se smazanym uzlem)
//   - baselineRoot: pole davky pro navadenou cestu bez dohledaneho cile
//     (FB_BaselineDecide); kontroluje se jako cil (FB_CheckWrite)
//   packages       normalizovana mnozina (potomek predka v mnozine se slouci
//                  do predka; NIKDY spolecny predek dvou sourozencu)
//   unknown        aspon jeden cil, jehoz package nelze odvodit -> davka se
//                  chova jako "velikost neznama" (nikdy "pod prahem")
//   overLimit      po normalizaci vic nez cfg.maxBaselinePackages -> cela
//                  davka "bez package zalohy" (nikdy baseline predka)
//   volumeUnknown  clone_* / move_elements: objem je pre-exekucne neznamy ->
//                  dialog nesmi hlasit "cisty create"
//   destructive    davka obsahuje DESTRUKTIVNI PODTRIDU (par. 4.4): jedina
//                  mnozina, kde plati tvrde E_NO_BASELINE
// Packages se sbiraji JEN z cilu, ktere davka MENI nebo MAZE. Cisty create
// package neprinasi (undo = smazani dle razitek, par. 12f T2).
// SQL vyhradne nad standardnimi sloupci, tytez tvary jako FB_RiskGate a
// operace samy (FB_OpDelete) - zadna sonda neznamych sloupcu (N-4).
// Nikdy nevyhazuje: chyba resolvu = unknown.
//
// scope (pravidlo cile)          destr (destruktivni podtrida)
//   none        bez cile v modelu   no      nikdy
//   create      jen zaklada         always  vzdy
//   elements    Element.PackageID   rebuild jen s rebuild: true
//   package     tyz package         params  jen operations s parameters
//   connectors  package SOURCE
//   owner       package rodic. elementu (atributy, operace, scenare, ...)
//   diagram     package diagramu (op.diagram)
//   diagramEls  package diagramu + packages ELEMENTU, ktere operace meni
//               (apply_classifier_stereotypes prepisuje Type/Stereotype prvku
//               na diagramu - ty mohou lezet jinde nez diagram; nalez M2)
//   diagrams    package diagramu per polozka (diagrams[].diagram)
//   delete      dle typu cile (package -> RODIC, vyjimka rodic nad prahem velikosti)
//   deleteTag   package vlastnika tagu
//   move        OBE packages (zdroj i cil)
//   clonePkg    rodic zdrojoveho package (klon vznika vedle zdroje)
//   cloneEls    cilovy package / package zdrojovych elementu
//   docs        package elementu dokumentu
var SCOPE = {
    "create_element":                  { scope: "create",     destr: "no" },
    "create_or_update_elements":       { scope: "elements",   destr: "no" },
    "move_elements":                   { scope: "move",       destr: "no" },
    "create_or_update_package":        { scope: "package",    destr: "no" },
    "create_or_update_connectors":     { scope: "connectors", destr: "no" },
    "create_or_update_attributes":     { scope: "owner",      destr: "no" },
    "create_or_update_operations":     { scope: "owner",      destr: "params" },
    "create_or_update_messages":       { scope: "diagram",    destr: "rebuild" },
    "delete_from_model":               { scope: "delete",     destr: "always" },
    "delete_taggedvalue_from_model":   { scope: "deleteTag",  destr: "always" },
    "remove_elements_from_diagram":    { scope: "diagram",    destr: "no" },
    "create_baseline":                 { scope: "none",       destr: "no" },
    "clone_package":                   { scope: "clonePkg",   destr: "no" },
    "clone_elements":                  { scope: "cloneEls",   destr: "no" },
    "import_element_linked_documents": { scope: "docs",       destr: "always" },
    "layout_connectors":               { scope: "diagram",    destr: "no" },
    "change_connector_visibility":     { scope: "diagram",    destr: "no" },
    "update_diagram_properties":       { scope: "diagrams",   destr: "no" },
    "set_diagram_object_style":        { scope: "diagram",    destr: "no" },
    "create_or_update_diagram":        { scope: "diagrams",   destr: "no" },
    "place_elements_on_diagram":       { scope: "diagram",    destr: "no" },
    "create_or_update_scenarios":      { scope: "owner",      destr: "always" },
    "create_or_update_constraints":    { scope: "owner",      destr: "always" },
    "create_or_update_requirements":   { scope: "owner",      destr: "always" },
    "apply_classifier_stereotypes":    { scope: "diagramEls", destr: "no" },
    "find_or_create_referencing_sr":   { scope: "create",     destr: "no" },
    "deploy_src":                      { scope: "none",       destr: "no" }
};
// Poznamky k tabulce:
//  - scenarios / constraints / requirements: operace je VZDY deterministicky
//    rebuild V2d (smaz vse + zapis) -> destr "always" (requirements sdili
//    vetev s constraints, par. 4.2).
//  - deploy_src: cil = element AICodeBridge (mimo whitelist, verzovan v gitu);
//    baseline nad nim by FB_CheckWrite odmitl -> scope "none" (gate mu
//    updatedExisting nepocita, takze zalohu nespousti).
//  - create_baseline: explicitni zaloha sama nic nemeni.
var self = this;
var t0 = new Date().getTime();
// Rozpocet resolvu scope = rozpocet gate (risk.budgetMs, default 8000): je to
// tataz prace (resolve cilu davky), ne sonda velikosti - probeBudgetTotalMs
// patri jen FB_SubtreeCount (nalez M5: spolecny 2s strop by v bance delal
// z vetsich davek navadenou cestu). Dotazy se v ramci davky cachuji.
var budget = (risk && typeof risk.budgetMs == "number" && risk.budgetMs > 0) ? risk.budgetMs : 8000;
var sqlCache = {};
var maxPk = (cfg && typeof cfg.maxBaselinePackages == "number") ? cfg.maxBaselinePackages : 5;
var unknownWhy = [], whySeen = {};
function unk(msg) { if (whySeen[msg] != 1) { whySeen[msg] = 1; if (unknownWhy.length < 12) { unknownWhy.push(msg); } } }
var overBudget = false;
function spent() {
    if (!overBudget && (new Date().getTime() - t0) > budget) { overBudget = true; unk("rozpocet resolvu scope vycerpan (" + budget + " ms)"); }
    return overBudget;
}
var pk = {}, pkOrder = [];        // Package_ID -> { id, why[] , pow }
function addPkgId(id, why, pow) {
    var n = parseInt(id, 10);
    if (isNaN(n) || n <= 0) { unk(why + ": package nezjisten"); return; }
    if (!pk[n]) { pk[n] = { id: n, why: [], parentOverThreshold: false }; pkOrder.push(n); }
    if (pk[n].why.length < 6) { pk[n].why.push(why); }
    if (pow === true) { pk[n].parentOverThreshold = true; }
}
function esc(s) { return ("" + s).replace(/'/g, "''"); }
function rows(sql) {
    if (typeof sqlCache[sql] != "undefined") { return sqlCache[sql]; }
    if (spent()) { return null; }
    var rq = null;
    try { rq = self.FB_XmlRows(Repository.SQLQuery(sql)); } catch (eQ) { rq = null; }
    sqlCache[sql] = rq;
    return rq;
}
function isArr(v) { return Object.prototype.toString.call(v) == "[object Array]"; }
function blank(v) { return v === null || typeof v == "undefined" || ("" + v) == ""; }
// --- $N reference: OWN jen na CREATE vetev zapisove operace teto davky;
// vse ostatni (cteci op, update vetev, match/dedup, dopredna) = ne-vlastni
// (T6-27). Zamerne konzervativnejsi zrcadlo FB_RiskGate.classifyDollar -
// odchylka smi vest jen k `unknown`. B3 (Z261004b-10): u ne-vlastniho $N se
// pro ZALOHU vezme balicek cile predchozi operace, je-li znam z jeji definice
// (dollarPkg) - rozsah je pak znamy, ne "unknown".
var refRe = /^\$(\d+)(?:\[(\d+)\])?(?:\.(id|guid|compositeDiagram))?$/; // v0.22: .compositeDiagram (N-RE-11)
function dollarOwn(ref, opIdx) {
    var m = refRe.exec("" + ref);
    if (!m) { return null; }              // neni $N
    var idx = parseInt(m[1], 10);
    var it = (typeof m[2] != "undefined" && m[2] !== "" && m[2] !== null) ? parseInt(m[2], 10) : 0;
    if (idx >= opIdx) { return false; }
    var rop = req.ops[idx] || {};
    var rn = "" + (rop.op || "?");
    if (!reg || !reg[rn] || !reg[rn].w) { return false; }
    var x;
    if (rn == "create_or_update_elements") { x = (rop.elements || [])[it]; return !!x && !x.guid && !x.elementID && !x.matchByName && !x.dedupKey; }
    if (rn == "create_or_update_package") {
        var pl = isArr(rop.packages) ? rop.packages : [rop]; x = pl[it];
        return !!x && !x.guid && !x.packageID && !x.matchByName;
    }
    if (rn == "create_or_update_connectors") { x = (rop.connectors || [])[it]; return !!x && !x.guid && !x.connectorID && !x.match && !x.dedupKey; }
    if (rn == "create_or_update_diagram") { x = (rop.diagrams || [])[it]; return !!x && !x.diagram && !x.diagramID && !x.guid; }
    if (rn == "create_element" || rn == "clone_package" || rn == "clone_elements") { return true; }
    return false;
}
// balicek cile predchozi operace, na kterou miri ne-vlastni $N (B3): > 0 = znam
function dollarPkg(ref, opIdx) {
    var m = refRe.exec("" + ref);
    if (!m) { return 0; }
    var idx = parseInt(m[1], 10);
    var it = (typeof m[2] != "undefined" && m[2] !== "" && m[2] !== null) ? parseInt(m[2], 10) : 0;
    if (idx >= opIdx) { return 0; }
    var rop = req.ops[idx] || {};
    var rn = "" + (rop.op || "?");
    var x, pr;
    if (rn == "create_or_update_elements") {
        x = (rop.elements || [])[it]; if (!x) { return 0; }
        if (x.guid || x.elementID) { return elPkgRaw(x.guid || x.elementID); }
        if (x.dedupKey) { var rd = rows("SELECT o.Package_ID FROM t_object o INNER JOIN t_objectproperties p ON p.Object_ID = o.Object_ID WHERE p.Property = 'ai.dedup' AND p.Value = '" + esc(x.dedupKey) + "'"); return (rd != null && rd.length == 1) ? parseInt(rd[0].Package_ID, 10) : 0; }
        if (x.owningElement) { return elPkgRaw(x.owningElement); }
        pr = pkgRowRaw(x["package"]); return pr ? pr.id : 0;
    }
    if (rn == "create_or_update_package") {
        var pl = isArr(rop.packages) ? rop.packages : [rop]; x = pl[it]; if (!x) { return 0; }
        if (x.guid || x.packageID) { pr = pkgRowRaw(x.guid || x.packageID); return pr ? pr.id : 0; }
        pr = pkgRowRaw(x.parent); return pr ? pr.id : 0;
    }
    if (rn == "create_or_update_connectors") {
        x = (rop.connectors || [])[it]; if (!x) { return 0; }
        if (x.guid || x.connectorID) { return connSrcPkg(x.guid, x.connectorID); }
        return elPkgRaw(x.source);
    }
    if (rn == "create_or_update_diagram") {
        x = (rop.diagrams || [])[it]; if (!x) { return 0; }
        var dr2 = x.diagram || x.diagramID || x.guid;
        if (dr2) { return dgmPkgRaw(dr2); }
        if (x.owningElement) { return elPkgRaw(x.owningElement); }
        pr = pkgRowRaw(x["package"]); return pr ? pr.id : 0;
    }
    if (rn == "move_elements") {
        x = (rop.elements || [])[it];
        var mp = (x !== null && typeof x == "object" && !blank(x["package"])) ? x["package"] : rop["package"];
        pr = pkgRowRaw(mp); return pr ? pr.id : 0;
    }
    return 0;
}
// "raw" resolvery bez $N logiky (pro dollarPkg): Package_ID nebo 0
function elPkgRaw(ref) {
    if (blank(ref) || refRe.test("" + ref)) { return 0; }
    var t = ("" + ref).replace(/^\s+|\s+$/g, ""), rr;
    if (t.charAt(0) == "{") { rr = rows("SELECT Package_ID FROM t_object WHERE ea_guid = '" + esc(t) + "'"); }
    else if (/^[0-9]+$/.test(t)) { rr = rows("SELECT Package_ID FROM t_object WHERE Object_ID = " + parseInt(t, 10)); }
    else { rr = rows("SELECT Package_ID FROM t_object WHERE Name = '" + esc(t) + "'"); }
    return (rr != null && rr.length == 1) ? parseInt(rr[0].Package_ID, 10) : 0;
}
function pkgRowRaw(ref) {
    if (blank(ref) || refRe.test("" + ref)) { return null; }
    if (ref !== null && typeof ref == "object" && isArr(ref.path)) {
        var tr = null; try { tr = self.FB_TargetCache(Repository, "package", ref); } catch (eTp) { tr = null; }
        return tr ? { own: false, id: tr.id, parent: tr.parentId } : null;
    }
    var t = ("" + ref).replace(/^\s+|\s+$/g, ""), rr;
    if (t.charAt(0) == "{") { rr = rows("SELECT Package_ID, Parent_ID FROM t_package WHERE ea_guid = '" + esc(t) + "'"); }
    else if (/^[0-9]+$/.test(t)) { rr = rows("SELECT Package_ID, Parent_ID FROM t_package WHERE Package_ID = " + parseInt(t, 10)); }
    else { rr = rows("SELECT Package_ID, Parent_ID FROM t_package WHERE Name = '" + esc(t) + "'"); }
    if (rr == null || rr.length != 1) { return null; }
    return { own: false, id: parseInt(rr[0].Package_ID, 10), parent: parseInt(rr[0].Parent_ID, 10) };
}
function dgmPkgRaw(ref) {
    if (blank(ref) || refRe.test("" + ref)) { return 0; }
    var t = ("" + ref).replace(/^\s+|\s+$/g, ""), rr;
    if (t.charAt(0) == "{") { rr = rows("SELECT Package_ID FROM t_diagram WHERE ea_guid = '" + esc(t) + "'"); }
    else if (/^[0-9]+$/.test(t)) { rr = rows("SELECT Package_ID FROM t_diagram WHERE Diagram_ID = " + parseInt(t, 10)); }
    else { rr = rows("SELECT Package_ID FROM t_diagram WHERE Name = '" + esc(t) + "'"); }
    return (rr != null && rr.length == 1) ? parseInt(rr[0].Package_ID, 10) : 0;
}
// konce konektoru dle guid/ID jednim SELECT (B3 i): package ZDROJE nebo 0.
// Pravidlo vazeb "oba konce" (Z261004b-11, 12. 10. 2026): vazba s jednim
// koncem v chranene casti se smi menit i mazat, ale zalohu nad chranenym
// balickem bridge neporizuje (E_BLACKLIST -> E_NO_BASELINE, zive Z11-05b) ->
// pro zalohu se bere balicek VOLNEHO konce: zdroj, a je-li zdroj chraneny,
// cil (oba chranene = P2 davku zastavi driv).
function pkgProtected(pkgId) {
    if (!pkgId || pkgId <= 0) { return false; }
    var r = null;
    try { r = self.FB_ScopeCheck(Repository, "package", "" + pkgId); } catch (eS) { r = null; }
    return (r != null && r.code == "E_BLACKLIST");
}
function connEndsPkg(startId, endId) {
    var sp = elPkgRaw("" + startId);
    if (sp > 0 && !pkgProtected(sp)) { return sp; }
    var ep = elPkgRaw("" + endId);
    if (ep > 0 && !pkgProtected(ep)) { return ep; }
    return sp > 0 ? sp : ep;
}
function connSrcPkg(guid, id) {
    var rc = null;
    if (!blank(guid) && !refRe.test("" + guid)) { rc = rows("SELECT Start_Object_ID, End_Object_ID FROM t_connector WHERE ea_guid = '" + esc(guid) + "'"); }
    else if (!blank(id) && /^[0-9]+$/.test("" + id)) { rc = rows("SELECT Start_Object_ID, End_Object_ID FROM t_connector WHERE Connector_ID = " + parseInt(id, 10)); }
    if (rc == null || rc.length != 1) { return 0; }
    return connEndsPkg(rc[0].Start_Object_ID, rc[0].End_Object_ID);
}
// resolvery -> Package_ID nebo 0 (nezjisteno)
function elPkg(ref, ctx, opIdx) {
    if (blank(ref)) { unk(ctx + ": chybi cil"); return -1; }
    var own = dollarOwn(ref, opIdx);
    if (own === true) { return 0; }       // prvek teto davky - neni co zalohovat
    if (own === false) {
        var dpE = dollarPkg(ref, opIdx);  // B3: balicek cile predchozi operace
        if (dpE > 0) { return dpE; }
        unk(ctx + ": $N odkaz na existujici/nejisty prvek (" + ref + ")"); return -1;
    }
    var t = ("" + ref).replace(/^\s+|\s+$/g, ""), rr;
    if (t.charAt(0) == "{") { rr = rows("SELECT Package_ID FROM t_object WHERE ea_guid = '" + esc(t) + "'"); }
    else if (/^[0-9]+$/.test(t)) { rr = rows("SELECT Package_ID FROM t_object WHERE Object_ID = " + parseInt(t, 10)); }
    else { rr = rows("SELECT Package_ID FROM t_object WHERE Name = '" + esc(t) + "'"); }
    if (rr == null || rr.length != 1) { unk(ctx + ": element '" + ref + "' " + (rr != null && rr.length > 1 ? "neni jednoznacny" : "nenalezen")); return -1; }
    var ep = parseInt(rr[0].Package_ID, 10);
    if (isNaN(ep) || ep <= 0) { unk(ctx + ": element '" + ref + "' bez Package_ID"); return -1; }
    return ep;
}
function pkgRow(ref, ctx, opIdx) {
    if (blank(ref)) { unk(ctx + ": chybi package"); return null; }
    var own = dollarOwn(ref, opIdx);
    if (own === true) { return { own: true }; }
    if (own === false) {
        var dpP = dollarPkg(ref, opIdx);
        if (dpP > 0) { var dpr = pkgRowRaw("" + dpP); if (dpr) { return dpr; } }
        unk(ctx + ": $N odkaz na existujici/nejisty package (" + ref + ")"); return null;
    }
    if (ref !== null && typeof ref == "object" && isArr(ref.path)) {
        // cesta { path, from } (cil zapisu kap. 5.7) - pres FB_TargetCache
        var prow = pkgRowRaw(ref);
        if (prow == null) { unk(ctx + ": cesta " + ref.path.join(".") + " nenalezena"); return null; }
        return prow;
    }
    var t = ("" + ref).replace(/^\s+|\s+$/g, ""), rr;
    if (t.charAt(0) == "{") { rr = rows("SELECT Package_ID, Parent_ID FROM t_package WHERE ea_guid = '" + esc(t) + "'"); }
    else if (/^[0-9]+$/.test(t)) { rr = rows("SELECT Package_ID, Parent_ID FROM t_package WHERE Package_ID = " + parseInt(t, 10)); }
    else { rr = rows("SELECT Package_ID, Parent_ID FROM t_package WHERE Name = '" + esc(t) + "'"); }
    if (rr == null || rr.length != 1) { unk(ctx + ": package '" + ref + "' " + (rr != null && rr.length > 1 ? "neni jednoznacny" : "nenalezen")); return null; }
    return { own: false, id: parseInt(rr[0].Package_ID, 10), parent: parseInt(rr[0].Parent_ID, 10) };
}
function dgmPkg(ref, ctx, opIdx) {
    if (blank(ref)) { unk(ctx + ": chybi diagram"); return -1; }
    var own = dollarOwn(ref, opIdx);
    if (own === true) { return 0; }
    if (own === false) {
        var dpD = dollarPkg(ref, opIdx);
        if (dpD > 0) { return dpD; }
        unk(ctx + ": $N odkaz na existujici/nejisty diagram (" + ref + ")"); return -1;
    }
    var t = ("" + ref).replace(/^\s+|\s+$/g, ""), rr;
    if (t.charAt(0) == "{") { rr = rows("SELECT Package_ID FROM t_diagram WHERE ea_guid = '" + esc(t) + "'"); }
    else if (/^[0-9]+$/.test(t)) { rr = rows("SELECT Package_ID FROM t_diagram WHERE Diagram_ID = " + parseInt(t, 10)); }
    else { rr = rows("SELECT Package_ID FROM t_diagram WHERE Name = '" + esc(t) + "'"); }
    if (rr == null || rr.length != 1) { unk(ctx + ": diagram '" + ref + "' " + (rr != null && rr.length > 1 ? "neni jednoznacny" : "nenalezen")); return -1; }
    var dp0 = parseInt(rr[0].Package_ID, 10);
    if (isNaN(dp0) || dp0 <= 0) { unk(ctx + ": diagram '" + ref + "' bez Package_ID"); return -1; }
    return dp0;
}
function addEl(ref, ctx, opIdx, why) { var p = elPkg(ref, ctx, opIdx); if (p > 0) { addPkgId(p, why); } }
function addDgm(ref, ctx, opIdx, why) { var p = dgmPkg(ref, ctx, opIdx); if (p > 0) { addPkgId(p, why); } }
// rodic mazaneho balicku: zaloha nad nim jen kdyz (a) neni chraneny a (b)
// projde velikostni sondou - i ve stinovem rezimu prahu (kap. 5.9/3, I13)
function parentOk(pkgId) {
    try {
        var po = Repository.GetPackageByID(pkgId);
        if (!po) { return false; }
        if (self.FB_CheckWrite(Repository, po) != null) { return false; }
        var maxEl = (cfg && typeof cfg.subtreeMax == "number") ? cfg.subtreeMax : 5000;
        var pr = null;
        try { pr = self.FB_SubtreeCount(Repository, pkgId, cfg, (cfg && typeof cfg.probeBudgetTotalMs == "number") ? cfg.probeBudgetTotalMs : 2000); } catch (ePr) { pr = null; }
        if (!pr || pr.status != "ok") { return false; } // neznama velikost = jako nad prahem
        return pr.elements <= maxEl;
    } catch (eW) { return false; }
}

var destructive = false, destructiveOps = [], volumeUnknown = false, missingScope = [], missSeen = {};
var i, j, lst;
for (i = 0; i < req.ops.length; i++) {
    var o = req.ops[i] || {};
    var name = "" + (o.op || "?");
    if (reg && reg[name] && !reg[name].w) { continue; }      // cteci operace
    var sc = SCOPE[name];
    if (!sc) {
        // zapisova / neznama operace bez polozky SCOPE = fail-closed (T6-29)
        if (missSeen[name] != 1) { missSeen[name] = 1; missingScope.push(name); }
        unk("operace '" + name + "' nema polozku v tabulce SCOPE");
        continue;
    }
    var ctx = name + "[" + i + "]";
    var isDestr = (sc.destr == "always")
        || (sc.destr == "rebuild" && (o.rebuild === true || ("" + o.rebuild) == "true"));
    if (sc.destr == "params") {
        lst = o.operations || [];
        for (j = 0; j < lst.length; j++) {
            if (lst[j] && isArr(lst[j].parameters) && lst[j].parameters.length > 0) { isDestr = true; break; }
        }
    }
    if (isDestr) { destructive = true; if (destructiveOps.length < 12) { destructiveOps.push(name); } }

    if (sc.scope == "none" || sc.scope == "create") { continue; }
    if (sc.scope == "elements") {
        lst = o.elements || [];
        for (j = 0; j < lst.length; j++) {
            var e = lst[j] || {};
            if (e.guid || e.elementID) { addEl(e.guid || e.elementID, ctx + ".elements[" + j + "]", i, name + " (update)"); }
            else if (e.dedupKey) {
                // dedupKey hleda GLOBALNE (TV ai.dedup prezije presun i
                // prejmenovani - FB_DedupFind): package = kde prvek OPRAVDU
                // lezi, ne deklarovany e.package (nalez M1)
                var rdk = rows("SELECT o.Package_ID FROM t_object o INNER JOIN t_objectproperties p ON p.Object_ID = o.Object_ID WHERE p.Property = 'ai.dedup' AND p.Value = '" + esc(e.dedupKey) + "'");
                if (rdk == null || rdk.length > 1) { unk(ctx + ".elements[" + j + "]: dedupKey '" + e.dedupKey + "' " + (rdk == null ? "nelze dohledat" : "neni jednoznacny")); }
                else if (rdk.length == 1) { addPkgId(rdk[0].Package_ID, name + " (dedupKey - existujici prvek)"); }
                else if (e.matchByName) {
                    var pmd = pkgRow(e["package"], ctx + ".elements[" + j + "].package", i); if (pmd && !pmd.own) { addPkgId(pmd.id, name + " (matchByName)"); }
                }
            }
            else if (e.matchByName) {
                // create-or-update: existujici prvek muze lezet v cilovem package
                if (e.owningElement) { addEl(e.owningElement, ctx + ".elements[" + j + "].owningElement", i, name + " (match/dedup)"); }
                else { var pm = pkgRow(e["package"], ctx + ".elements[" + j + "].package", i); if (pm && !pm.own) { addPkgId(pm.id, name + " (match/dedup)"); } }
            }
        }
    } else if (sc.scope == "package") {
        lst = isArr(o.packages) ? o.packages : [o];
        for (j = 0; j < lst.length; j++) {
            var p = lst[j] || {};
            var pr = null;
            if (p.guid || p.packageID) { pr = pkgRow(p.guid || p.packageID, ctx + ".packages[" + j + "]", i); if (pr && !pr.own) { addPkgId(pr.id, name + " (update vlastnosti)"); } }
            else if (p.matchByName) { pr = pkgRow(p.parent, ctx + ".packages[" + j + "].parent", i); if (pr && !pr.own) { addPkgId(pr.id, name + " (matchByName v rodici)"); } }
        }
    } else if (sc.scope == "connectors") {
        lst = o.connectors || [];
        for (j = 0; j < lst.length; j++) {
            var c = lst[j] || {};
            if (c.guid || c.connectorID) {
                // B3 (i): konce dle guid/ID jednim SELECT nad t_connector -> package zdroje
                var csp = (refRe.test("" + (c.guid || c.connectorID))) ? 0 : connSrcPkg(c.guid, c.connectorID);
                if (csp > 0) { addPkgId(csp, name + " (update konektoru - package zdroje)"); }
                else if (refRe.test("" + (c.guid || c.connectorID))) { var cdp = dollarPkg(c.guid || c.connectorID, i); if (cdp > 0) { addPkgId(cdp, name + " (update konektoru pres $N)"); } else if (dollarOwn(c.guid || c.connectorID, i) !== true) { unk(ctx + ".connectors[" + j + "]: $N odkaz na nejisty konektor"); } }
                else { unk(ctx + ".connectors[" + j + "]: konektor '" + (c.guid || c.connectorID) + "' nenalezen - konce neresolvovany"); }
            } else if (c.dedupKey) {
                var rck = rows("SELECT c.Start_Object_ID, c.End_Object_ID FROM t_connector c INNER JOIN t_connectortag t ON t.ElementID = c.Connector_ID WHERE t.Property = 'ai.dedup' AND t.VALUE = '" + esc(c.dedupKey) + "'");
                if (rck == null || rck.length > 1) { unk(ctx + ".connectors[" + j + "]: dedupKey '" + c.dedupKey + "' " + (rck == null ? "nelze dohledat" : "neni jednoznacny")); }
                else if (rck.length == 1) { var ckp = connEndsPkg(rck[0].Start_Object_ID, rck[0].End_Object_ID); if (ckp > 0) { addPkgId(ckp, name + " (dedupKey - existujici konektor, package volneho konce)"); } else { unk(ctx + ".connectors[" + j + "]: konce konektoru dle dedupKey nezjisteny"); } }
                else if (c.match) { addEl(c.source, ctx + ".connectors[" + j + "].source", i, name + " (match, package source)"); }
            } else if (c.match) {
                addEl(c.source, ctx + ".connectors[" + j + "].source", i, name + " (match, package source)");
            }
        }
    } else if (sc.scope == "owner") {
        addEl(o.element, ctx + ".element", i, name);
    } else if (sc.scope == "diagram") {
        addDgm(o.diagram, ctx + ".diagram", i, name);
    } else if (sc.scope == "diagramEls") {
        addDgm(o.diagram, ctx + ".diagram", i, name);
        if (isArr(o.elementIDs) && o.elementIDs.length > 0) {
            for (j = 0; j < o.elementIDs.length; j++) { addEl(o.elementIDs[j], ctx + ".elementIDs[" + j + "]", i, name + " (meneny prvek)"); }
        } else if (dollarOwn(o.diagram, i) === null && !blank(o.diagram)) {
            // bez filtru = vsechny objekty diagramu
            var dt0 = ("" + o.diagram).replace(/^\s+|\s+$/g, "");
            var rdo = (dt0.charAt(0) == "{")
                ? rows("SELECT DISTINCT o.Package_ID FROM t_diagramobjects x INNER JOIN t_object o ON o.Object_ID = x.Object_ID INNER JOIN t_diagram g ON g.Diagram_ID = x.Diagram_ID WHERE g.ea_guid = '" + esc(dt0) + "'")
                : (/^[0-9]+$/.test(dt0) ? rows("SELECT DISTINCT o.Package_ID FROM t_diagramobjects x INNER JOIN t_object o ON o.Object_ID = x.Object_ID WHERE x.Diagram_ID = " + parseInt(dt0, 10)) : null);
            if (rdo == null) { unk(ctx + ": objekty diagramu nelze vycist"); }
            else { for (j = 0; j < rdo.length; j++) { addPkgId(rdo[j].Package_ID, name + " (prvek na diagramu)"); } }
        }
    } else if (sc.scope == "diagrams") {
        lst = o.diagrams || [];
        for (j = 0; j < lst.length; j++) {
            var d = lst[j] || {};
            // FB_OpDiagram bere UPDATE vetev pres diagram | diagramID | guid
            // (nalez H1 oponentury 2026-09-20: cteni jen `diagram` delalo
            // z updatu "cisty create")
            var dref2 = d.diagram || d.diagramID || d.guid;
            if (name == "update_diagram_properties" || dref2) { addDgm(dref2, ctx + ".diagrams[" + j + "]", i, name); }
        }
    } else if (sc.scope == "docs") {
        lst = o.documents || [];
        for (j = 0; j < lst.length; j++) { addEl((lst[j] || {}).element, ctx + ".documents[" + j + "]", i, name); }
    } else if (sc.scope == "move") {
        volumeUnknown = true; // withChildren je default - objem presunu predem neznamy
        lst = o.elements || [];
        for (j = 0; j < lst.length; j++) {
            var mv = lst[j];
            var mvRef = (mv !== null && typeof mv == "object") ? (mv.element || mv.guid || mv.elementID) : mv;
            var mvPkg = (mv !== null && typeof mv == "object" && !blank(mv["package"])) ? mv["package"] : o["package"];
            addEl(mvRef, ctx + ".elements[" + j + "]", i, name + " (zdroj)");
            var tp = pkgRow(mvPkg, ctx + ".elements[" + j + "].package", i);
            if (tp && !tp.own) { addPkgId(tp.id, name + " (cil)"); }
        }
    } else if (sc.scope == "clonePkg") {
        volumeUnknown = true;
        var cs = pkgRow(o["package"], ctx + ".package", i);
        if (cs && !cs.own) {
            if (cs.parent > 0) { addPkgId(cs.parent, name + " (klon vznika v rodici zdroje)"); }
            else { unk(ctx + ": klon korenoveho package - rodic neexistuje"); }
        }
    } else if (sc.scope == "cloneEls") {
        volumeUnknown = true;
        if (!blank(o["package"])) {
            var ct = pkgRow(o["package"], ctx + ".package", i);
            if (ct && !ct.own) { addPkgId(ct.id, name + " (cilovy package)"); }
        } else {
            lst = o.elements || [];
            for (j = 0; j < lst.length; j++) { addEl(lst[j], ctx + ".elements[" + j + "]", i, name + " (klon zustava u zdroje)"); }
        }
    } else if (sc.scope == "delete") {
        lst = o.targets || [];
        for (j = 0; j < lst.length; j++) {
            var dt = lst[j] || {};
            var ty = ("" + (dt.type || "")).toUpperCase();
            var dref = dt.guid || dt.id;
            var dctx = ctx + ".targets[" + j + "]";
            if (ty == "ELEMENT") { addEl(dref, dctx, i, name + " (element)"); }
            else if (ty == "DIAGRAM") { addDgm(dref, dctx, i, name + " (diagram)"); }
            else if (ty == "PACKAGE") {
                // RODIC ciloveho package (EA pri smazani package maze i jeho
                // baselines - spike 2026-09-07); vyjimka: rodic mimo whitelist
                // -> cilovy package sam + parentOutOfWhitelist (T6-28)
                var dp = pkgRow(dref, dctx, i);
                if (dp && !dp.own) {
                    if (dp.parent > 0 && parentOk(dp.parent)) { addPkgId(dp.parent, name + " (package -> rodic)"); }
                    else { addPkgId(dp.id, name + " (package; rodic nad prahem velikosti nebo chraneny)", true); }
                }
            } else if (ty == "CONNECTOR") {
                var rc = null;
                if (dt.guid) { rc = rows("SELECT Start_Object_ID, End_Object_ID FROM t_connector WHERE ea_guid = '" + esc(dt.guid) + "'"); }
                else if (/^[0-9]+$/.test("" + dt.id)) { rc = rows("SELECT Start_Object_ID, End_Object_ID FROM t_connector WHERE Connector_ID = " + parseInt(dt.id, 10)); }
                if (rc != null && rc.length == 1) { var dcp = connEndsPkg(rc[0].Start_Object_ID, rc[0].End_Object_ID); if (dcp > 0) { addPkgId(dcp, name + " (konektor, package volneho konce)"); } else { unk(dctx + ".source: konce konektoru nezjisteny"); } }
                else { unk(dctx + ": konektor nenalezen - rodic neresolvovan"); }
            } else if (ty == "ATTRIBUTE" || ty == "OPERATION" || ty == "PARAMETER") {
                var ra = null;
                if (/^[0-9]+$/.test("" + dt.id)) {
                    ra = (ty == "ATTRIBUTE")
                        ? rows("SELECT Object_ID FROM t_attribute WHERE ID = " + parseInt(dt.id, 10))
                        : rows("SELECT Object_ID FROM t_operation WHERE OperationID = " + parseInt(dt.id, 10));
                }
                if (ra != null && ra.length == 1) { addEl("" + ra[0].Object_ID, dctx + ".parent", i, name + " (" + ty.toLowerCase() + ", package rodice)"); }
                else { unk(dctx + ": rodicovsky element neresolvovan"); }
            } else { unk(dctx + ": neznamy typ cile '" + dt.type + "'"); }
        }
    } else if (sc.scope == "deleteTag") {
        lst = o.targets || [];
        for (j = 0; j < lst.length; j++) {
            var tt = lst[j] || {};
            var tty = ("" + (tt.type || "")).toUpperCase();
            var tctx = ctx + ".targets[" + j + "]";
            if (tty == "ELEMENTTAGGEDVALUE") { addEl(tt.guid || tt.id, tctx, i, name + " (element)"); }
            else if (tty == "PACKAGETAGGEDVALUE") { var tpk = pkgRow(tt.guid || tt.id, tctx, i); if (tpk && !tpk.own) { addPkgId(tpk.id, name + " (package)"); } }
            else if (tty == "CONNECTORTAGGEDVALUE") {
                var rtc = null;
                if (tt.guid) { rtc = rows("SELECT Start_Object_ID, End_Object_ID FROM t_connector WHERE ea_guid = '" + esc(tt.guid) + "'"); }
                else if (/^[0-9]+$/.test("" + tt.id)) { rtc = rows("SELECT Start_Object_ID, End_Object_ID FROM t_connector WHERE Connector_ID = " + parseInt(tt.id, 10)); }
                if (rtc != null && rtc.length == 1) { var tcp = connEndsPkg(rtc[0].Start_Object_ID, rtc[0].End_Object_ID); if (tcp > 0) { addPkgId(tcp, name + " (konektor, package volneho konce)"); } else { unk(tctx + ".source: konce konektoru nezjisteny"); } }
                else { unk(tctx + ": vlastnik tagu (konektor) neresolvovan"); }
            } else if (tty == "ATTRIBUTETAGGEDVALUE" || tty == "OPERATIONTAGGEDVALUE") {
                var rta = null;
                if (/^[0-9]+$/.test("" + tt.id)) {
                    rta = (tty == "ATTRIBUTETAGGEDVALUE")
                        ? rows("SELECT Object_ID FROM t_attribute WHERE ID = " + parseInt(tt.id, 10))
                        : rows("SELECT Object_ID FROM t_operation WHERE OperationID = " + parseInt(tt.id, 10));
                }
                if (rta != null && rta.length == 1) { addEl("" + rta[0].Object_ID, tctx + ".parent", i, name + " (package rodice)"); }
                else { unk(tctx + ": vlastnik tagu neresolvovan"); }
            } else { unk(tctx + ": neznamy typ vlastnika tagu '" + tt.type + "'"); }
        }
    } else {
        unk("operace '" + name + "': nezname pravidlo scope '" + sc.scope + "'");
    }
}

// --- normalizace: potomek package, ktery je v mnozine take, se vyradi ---
function hasAncestorInSet(id) {
    var cur = id, guard = 0;
    while (guard++ < 60) {
        var po = null;
        try { po = Repository.GetPackageByID(cur); } catch (eP) { po = null; }
        if (!po) { return false; }
        var par = 0;
        try { par = po.ParentID; } catch (eP2) { par = 0; }
        if (!par || par <= 0) { return false; }
        if (pk[par]) { return par; }
        cur = par;
    }
    return false;
}
var out = [];
for (i = 0; i < pkOrder.length; i++) {
    var id = pkOrder[i];
    // package s parentOverThreshold se neslucuje (zaloha patri jemu samemu)
    var anc = hasAncestorInSet(id);
    if (anc) {
        if (pk[anc].why.length < 6) { pk[anc].why.push("kryje i potomka " + id); }
        continue;
    }
    var item = { id: id, guid: "", name: "", path: "", why: pk[id].why, parentOverThreshold: pk[id].parentOverThreshold };
    try {
        var pobj = Repository.GetPackageByID(id);
        if (pobj) {
            item.guid = "" + pobj.PackageGUID; item.name = "" + pobj.Name;
            try { item.path = "" + self.FB_ElementPath(Repository, "package", pobj); } catch (ePa) { item.path = item.name; }
        } else { unk("package " + id + " nelze nacist (GetPackageByID)"); }
    } catch (eG) { unk("package " + id + " nelze nacist: " + eG.message); }
    out.push(item);
}
var overLimit = out.length > maxPk;
// baselineRoot (kap. 5.9/2): balicek pro navadenou cestu, kdyz neni dohledan zadny cil
var blRoot = null;
if (req && !blank(req.baselineRoot)) {
    var brr = pkgRowRaw(req.baselineRoot);
    if (brr) {
        blRoot = { id: brr.id, guid: "", path: "" };
        try { var bro = Repository.GetPackageByID(brr.id); if (bro) { blRoot.guid = "" + bro.PackageGUID; blRoot.path = "" + self.FB_ElementPath(Repository, "package", bro); } } catch (eBr) { }
    } else { unk("baselineRoot '" + req.baselineRoot + "' nenalezen"); }
}
return { packages: out, unknown: unknownWhy.length > 0, unknownWhy: unknownWhy,
         overLimit: overLimit, maxBaselinePackages: maxPk, volumeUnknown: volumeUnknown,
         destructive: destructive, destructiveOps: destructiveOps, missingScope: missingScope,
         baselineRoot: blRoot, normalized: true, ms: (new Date().getTime() - t0) };
