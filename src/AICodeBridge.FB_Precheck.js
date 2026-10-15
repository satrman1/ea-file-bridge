// AICodeBridge.FB_Precheck(Repository, req, reg, phase, repoId)
// PREDBEZNA KONTROLA DAVKY (balik B1, Z261004b-3; revize usability pumpy
// navrh P2 = FB-PU-23/-28, N-K8-7; KONCEPCE potvrzovaci okna pravidlo 1:
// "chyba agenta okno neotvira"). Bezi ve FB_Main hned po parsovani a kontrole
// repozitare (E_REPO), ve DVOU FAZICH:
//   phase "shape"   PRED kontrolou pristupu: operace v registru (jinak
//                   E_UNKNOWN_OP s nejblizsimi nazvy), povinna pole a tvary,
//                   zadny prazdny seznam, zadny zastupny text v
//                   identifikacnich polich (<...>, GUID-..., {GUID-),
//                   $N jen dozadu. Zadne SQL.
//   phase "targets" PO kontrole pristupu (E_ADDIN_ACCESS ma prednost):
//                   operace povolena ve FB_OpsAllowed (E_OP_FORBIDDEN; az tady,
//                   aby uzivatel bez write pristupu dostal svou chybu, ne
//                   chybu konfigurace), cil zadany GUIDem existuje
//                   (FB_TargetCache - tatez mezipamet pak slouzi Risk Gate;
//                   jen zapisove operace); CIL ZAPISU (Z261004b-10,
//                   FB_ScopePrecheck): E_SCOPE_CONFIG, E_BLACKLIST (obe
//                   auditovane), E_AMBIGUOUS / E_NOT_FOUND u jmen a cest
//                   (zadani cile zapisu v1.1 kap. 5.3, 5.7); resolved[].
// Vraci { ok: true } nebo { ok: false, code, message, problems: [ { op, path,
// code, message, suggestions? } ], audit: bool }. Jedna chyba se SEZNAMEM VSECH
// problemu; nic se neprovede, zadne okno, zadna zaloha. audit = true jen pro
// kody, ktere se maji auditovat (hak pro E_BLACKLIST z Z261004b-10: ostatni
// chyby P2 se neauditu, protoze se v modelu nic nestalo).
// Co P2 NEKONTROLUJE (zustava fail-closed v gate): cil jmenem (matchByName,
// dedupKey), $N na vysledek cteni, rozsah klonu/presunu, rozpocet.
// Textova pole (notes, text, sql...) se nekontroluji - EA v nich formatuje
// znackami jako <b>.
var self = this;
var AUDIT_CODES = { "E_BLACKLIST": 1, "E_SCOPE_CONFIG": 1 }; // Z261004b-10: pokus o zapis do chranene casti / vadna konfigurace se auditu (kap. 5.3, odchylka od pravidla 1 KONCEPCE oken)
var problems = [];
var resolvedOut = [], cascadesOut = [];
var ph = ("" + (phase || "shape")).toLowerCase();
function prob(opIdx, pth, code, msg, extra) {
    var p = { op: opIdx, path: pth, code: code, message: msg };
    if (extra) { for (var k in extra) { p[k] = extra[k]; } }
    problems.push(p);
}
function isArr(v) { return Object.prototype.toString.call(v) == "[object Array]"; }
function has(o, k) { return o && typeof o[k] != "undefined" && o[k] !== null && ("" + o[k]) != ""; }
function nonEmptyArr(o, k) { return o && isArr(o[k]) && o[k].length > 0; }
var refRe = /^\$(\d+)(?:\[(\d+)\])?(?:\.(id|guid|compositeDiagram))?$/; // v0.22: .compositeDiagram (N-RE-11)
var guidRe = /^\{[^{}<>]{3,}\}$/; // tvar {…} = odkaz GUIDem (stejne kriterium jako resolvery: prvni znak '{'); zastupne {GUID-…} chyta placeholder() driv
var bareGuidRe = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/; // FB-PU-30: GUID bez zavorek
var badBraceRe = /^\{(?![A-Za-z0-9-]+\}$)/; // zacina { ale uvnitr jsou cizi znaky / chybi }
// identifikacni pole: klic -> druh cile (pro fazi 2); "" = jen kontrola zastupneho textu
var ID_KEYS = { guid: "?", elementID: "element", packageID: "package", diagramID: "diagram", connectorID: "",
                "package": "package", parent: "package", targetPackage: "package", scope: "package",
                owningElement: "element", element: "element", source: "element", target: "element",
                classifier: "element", diagram: "diagram", baseline: "", repo: "", operation: "", id: "",
                from: "package", baselineRoot: "package" }; // from = vychozi balicek cesty {path, from} (kap. 5.7)
// pole, jejichz retezcove polozky jsou odkazy na cile
var REF_ARRAYS = { elements: "element", elementIDs: "element", diagrams: "diagram", packages: "package",
                   connectors: "", connectorIDs: "" };
function placeholder(s) {
    var v = "" + s;
    if (refRe.test(v)) { return false; }
    if (/^\{?GUID-/i.test(v) || /\{GUID-/i.test(v)) { return true; }
    if (/<[^<>]{0,80}>/.test(v)) { return true; }
    return false;
}
// --- nejblizsi nazvy operaci (Levenshtein; ES3) ---
function lev(a, b) {
    var m = a.length, n = b.length, i, j;
    if (m == 0) { return n; } if (n == 0) { return m; }
    var prev = [], cur = [];
    for (j = 0; j <= n; j++) { prev[j] = j; }
    for (i = 1; i <= m; i++) {
        cur = [i];
        for (j = 1; j <= n; j++) {
            var cost = (a.charAt(i - 1) == b.charAt(j - 1)) ? 0 : 1;
            var v = prev[j] + 1;
            if (cur[j - 1] + 1 < v) { v = cur[j - 1] + 1; }
            if (prev[j - 1] + cost < v) { v = prev[j - 1] + cost; }
            cur[j] = v;
        }
        prev = cur;
    }
    return prev[n];
}
function nearest(name) {
    var cand = [];
    var nl = ("" + name).toLowerCase();
    for (var k in reg) {
        if (!reg[k]) { continue; }
        var d = lev(nl, k.toLowerCase());
        var shared = (k.toLowerCase().indexOf(nl.split("_")[0]) == 0) ? 1 : 0;
        if (d <= 4 || shared) { cand.push({ n: k, d: d - shared }); }
    }
    cand.sort(function (a, b) { return a.d - b.d; });
    var out = [];
    for (var i = 0; i < cand.length && out.length < 3; i++) { out.push(cand[i].n); }
    return out;
}
// --- whitelist operaci (stejna mechanika jako FB_Main) ---
var opsCfg = null;
try {
    var oa = this.FB_OpsAllowed();
    var ridU = ("" + (repoId || "")).toUpperCase();
    for (var ci = 0; ci < oa.length; ci++) {
        if (ridU != "" && ridU.indexOf(("" + oa[ci].repo).toUpperCase()) >= 0) { opsCfg = oa[ci]; break; }
    }
} catch (eOa) { opsCfg = null; }
function opAllowed(name) {
    if (opsCfg == null) { return false; }
    var k, deny = opsCfg.deny || [], allow = opsCfg.allow || [];
    for (k = 0; k < deny.length; k++) { if (("" + deny[k]) == name) { return false; } }
    for (k = 0; k < allow.length; k++) { if (("" + allow[k]) == "*" || ("" + allow[k]) == name) { return true; } }
    return false;
}
// --- povinna pole per operace (zrcadli E_ARGS podminky v FB_Op*) ---
var NEED = {
    "find_elements_by_name": ["name"], "find_packages_by_name": ["name"],
    "get_elements_information": ["elements[]"], "get_packages_information": ["packages[]"],
    "get_connectors_information": ["connectors[]"], "get_diagrams_information": ["diagrams[]"],
    "get_baselines": ["package"], "baseline_diff": ["package", "baseline"],
    "export_element_linked_documents": ["elements[]"],
    "create_element": ["name", "type"], "create_or_update_elements": ["elements[]"],
    "move_elements": ["elements[]"], "create_or_update_connectors": ["connectors[]"],
    "create_or_update_attributes": ["element", "attributes[]"], "create_or_update_operations": ["element", "operations[]"],
    "create_or_update_messages": ["messages[]"], "delete_from_model": ["targets[]"],
    "delete_taggedvalue_from_model": ["targets[]"], "remove_elements_from_diagram": ["diagram", "elementIDs[]"],
    "create_baseline": ["package"], "clone_package": ["package"], "clone_elements": ["elements[]"],
    "import_element_linked_documents": ["documents[]"], "layout_connectors": ["diagram", "style"],
    "change_connector_visibility": ["diagram", "connectorIDs[]", "hidden"],
    "open_diagrams": ["diagrams[]"], "reload_diagrams": ["diagrams[]"], "update_diagram_properties": ["diagrams[]"],
    "set_diagram_object_style": ["diagram", "objects[]"], "create_or_update_diagram": ["diagrams[]"],
    "place_elements_on_diagram": ["diagram", "elementPlacements[]"],
    "create_or_update_scenarios": ["element", "scenarios[]"], "create_or_update_constraints": ["element", "constraints[]"],
    "create_or_update_requirements": ["element", "requirements[]"], "apply_classifier_stereotypes": ["diagram"],
    "find_or_create_referencing_sr": ["operation"]
};
function checkNeed(i, name, o) {
    var need = NEED[name] || [];
    for (var n = 0; n < need.length; n++) {
        var key = need[n];
        if (/\[\]$/.test(key)) {
            var ak = key.replace(/\[\]$/, "");
            if (typeof o[ak] == "undefined" || o[ak] === null) { prob(i, "ops[" + i + "]." + ak, "E_ARGS", "chybi povinne pole '" + ak + "' (neprazdne pole)"); }
            else if (!isArr(o[ak])) { prob(i, "ops[" + i + "]." + ak, "E_ARGS", "pole '" + ak + "' musi byt seznam []"); }
            else if (o[ak].length == 0) { prob(i, "ops[" + i + "]." + ak, "E_ARGS", "seznam '" + ak + "' je prazdny - nic by se neprovedlo"); }
        } else if (key == "hidden") {
            if (typeof o.hidden == "undefined") { prob(i, "ops[" + i + "].hidden", "E_ARGS", "chybi povinne pole 'hidden' (true/false)"); }
        } else if (!has(o, key)) {
            prob(i, "ops[" + i + "]." + key, "E_ARGS", "chybi povinne pole '" + key + "'");
        }
    }
    // alternativy a tvary po operacich
    var j, it, lst;
    if (name == "query" && !has(o, "sql") && !has(o, "sql_b64")) { prob(i, "ops[" + i + "].sql", "E_ARGS", "chybi sql (nebo sql_b64)"); }
    if (name == "get_diagram_image" && !has(o, "diagram") && !nonEmptyArr(o, "diagrams")) { prob(i, "ops[" + i + "].diagram", "E_ARGS", "chybi diagram nebo diagrams (neprazdne pole)"); }
    if (name == "create_element" && !has(o, "package") && !has(o, "owningElement")) { prob(i, "ops[" + i + "].package", "E_ARGS", "chybi package (nebo owningElement)"); }
    if (name == "create_or_update_elements" && nonEmptyArr(o, "elements")) {
        lst = o.elements;
        for (j = 0; j < lst.length; j++) {
            it = lst[j];
            if (!it || typeof it != "object") { prob(i, "ops[" + i + "].elements[" + j + "]", "E_ARGS", "polozka musi byt objekt"); continue; }
            if (has(it, "guid") || has(it, "elementID")) { continue; }
            if (!has(it, "type")) { prob(i, "ops[" + i + "].elements[" + j + "].type", "E_ARGS", "create vyzaduje type"); }
            if (!has(it, "package") && !has(it, "owningElement")) { prob(i, "ops[" + i + "].elements[" + j + "].package", "E_ARGS", "create vyzaduje package nebo owningElement"); }
        }
    }
    if (name == "create_or_update_package") {
        if (isArr(o.packages)) {
            if (o.packages.length == 0) { prob(i, "ops[" + i + "].packages", "E_ARGS", "seznam 'packages' je prazdny"); }
            for (j = 0; j < o.packages.length; j++) {
                it = o.packages[j];
                if (!it || typeof it != "object") { prob(i, "ops[" + i + "].packages[" + j + "]", "E_ARGS", "polozka musi byt objekt"); continue; }
                if (has(it, "guid") || has(it, "packageID")) { continue; }
                if (!has(it, "name") || !has(it, "parent")) { prob(i, "ops[" + i + "].packages[" + j + "]", "E_ARGS", "create vyzaduje name a parent"); }
            }
        } else if (!has(o, "guid") && !has(o, "packageID")) {
            if (!has(o, "name") || !has(o, "parent")) { prob(i, "ops[" + i + "].packages", "E_ARGS", "chybi packages (pole) nebo primo name + parent"); }
        }
    }
    if (name == "create_or_update_connectors" && nonEmptyArr(o, "connectors")) {
        lst = o.connectors;
        for (j = 0; j < lst.length; j++) {
            it = lst[j];
            if (!it || typeof it != "object") { prob(i, "ops[" + i + "].connectors[" + j + "]", "E_ARGS", "polozka musi byt objekt"); continue; }
            if (has(it, "guid") || has(it, "connectorID")) { continue; }
            if (!has(it, "source") || !has(it, "target") || !has(it, "type")) { prob(i, "ops[" + i + "].connectors[" + j + "]", "E_ARGS", "create vyzaduje source, target, type"); }
        }
    }
    if (name == "create_or_update_diagram" && nonEmptyArr(o, "diagrams")) {
        lst = o.diagrams;
        for (j = 0; j < lst.length; j++) {
            it = lst[j];
            if (!it || typeof it != "object") { prob(i, "ops[" + i + "].diagrams[" + j + "]", "E_ARGS", "polozka musi byt objekt"); continue; }
            if (has(it, "diagram") || has(it, "diagramID") || has(it, "guid")) { continue; }
            if (!has(it, "type")) { prob(i, "ops[" + i + "].diagrams[" + j + "].type", "E_ARGS", "create vyzaduje type"); }
            if (!has(it, "package") && !has(it, "owningElement")) { prob(i, "ops[" + i + "].diagrams[" + j + "].package", "E_ARGS", "create vyzaduje package nebo owningElement"); }
        }
    }
    if (name == "create_or_update_messages") {
        if ((o.rebuild === true || o.rebuild === "true") && !has(o, "diagram")) { prob(i, "ops[" + i + "].diagram", "E_ARGS", "rebuild: true vyzaduje diagram"); }
        if (nonEmptyArr(o, "messages")) {
            for (j = 0; j < o.messages.length; j++) {
                it = o.messages[j];
                if (!it || typeof it != "object") { prob(i, "ops[" + i + "].messages[" + j + "]", "E_ARGS", "polozka musi byt objekt"); continue; }
                if (has(it, "guid") || has(it, "connectorID")) { continue; }
                if (!has(it, "source") || !has(it, "target")) { prob(i, "ops[" + i + "].messages[" + j + "]", "E_ARGS", "create vyzaduje source a target"); }
            }
        }
    }
    if (name == "delete_from_model" && nonEmptyArr(o, "targets")) {
        for (j = 0; j < o.targets.length; j++) {
            it = o.targets[j];
            if (!it || typeof it != "object") { prob(i, "ops[" + i + "].targets[" + j + "]", "E_ARGS", "polozka musi byt objekt {type, id|guid}"); continue; }
            if (!has(it, "type")) { prob(i, "ops[" + i + "].targets[" + j + "].type", "E_ARGS", "chybi type (Package|Diagram|Element|Connector|Attribute|Operation|Parameter)"); }
            else if (!/^(PACKAGE|DIAGRAM|ELEMENT|CONNECTOR|ATTRIBUTE|OPERATION|PARAMETER)$/.test(("" + it.type).toUpperCase())) { prob(i, "ops[" + i + "].targets[" + j + "].type", "E_ARGS", "neznamy type '" + it.type + "'"); }
            if (!has(it, "id") && !has(it, "guid") && ("" + it.type).toUpperCase() != "PARAMETER") { prob(i, "ops[" + i + "].targets[" + j + "]", "E_ARGS", "chybi id nebo guid cile"); }
        }
    }
    if ((name == "create_or_update_attributes" || name == "create_or_update_operations" || name == "create_or_update_scenarios"
         || name == "create_or_update_constraints" || name == "create_or_update_requirements" || name == "delete_taggedvalue_from_model")) {
        var lk = { "create_or_update_attributes": "attributes", "create_or_update_operations": "operations", "create_or_update_scenarios": "scenarios",
                   "create_or_update_constraints": "constraints", "create_or_update_requirements": "requirements", "delete_taggedvalue_from_model": "targets" }[name];
        if (nonEmptyArr(o, lk)) {
            for (j = 0; j < o[lk].length; j++) {
                it = o[lk][j];
                if (!it || typeof it != "object") { prob(i, "ops[" + i + "]." + lk + "[" + j + "]", "E_ARGS", "polozka musi byt objekt"); continue; }
                if (!has(it, "name")) { prob(i, "ops[" + i + "]." + lk + "[" + j + "].name", "E_ARGS", "chybi name"); }
            }
        }
    }
    if (name == "import_element_linked_documents" && nonEmptyArr(o, "documents")) {
        for (j = 0; j < o.documents.length; j++) {
            it = o.documents[j];
            if (!it || typeof it != "object") { prob(i, "ops[" + i + "].documents[" + j + "]", "E_ARGS", "polozka musi byt objekt"); continue; }
            if (!has(it, "element")) { prob(i, "ops[" + i + "].documents[" + j + "].element", "E_ARGS", "chybi element"); }
            if (!has(it, "file") && !has(it, "rtf_b64")) { prob(i, "ops[" + i + "].documents[" + j + "]", "E_ARGS", "chybi file nebo rtf_b64"); }
        }
    }
    if (name == "move_elements" && nonEmptyArr(o, "elements")) {
        for (j = 0; j < o.elements.length; j++) {
            it = o.elements[j];
            var mref = (it !== null && typeof it == "object") ? (it.element || it.guid || it.elementID) : it;
            // v0.22 (N-RE-17): cil = package NEBO owningElement; polozka s jednim z nich prebiji operaci
            var mItem = (it !== null && typeof it == "object" && (has(it, "package") || has(it, "owningElement")));
            var mpkg = mItem ? (has(it, "package") ? it["package"] : null) : (has(o, "package") ? o["package"] : null);
            var mown = mItem ? (has(it, "owningElement") ? it.owningElement : null) : (has(o, "owningElement") ? o.owningElement : null);
            if (!mref) { prob(i, "ops[" + i + "].elements[" + j + "]", "E_ARGS", "chybi element"); }
            if (!mpkg && !mown) { prob(i, "ops[" + i + "].elements[" + j + "].package", "E_ARGS", "chybi cil presunu - package nebo owningElement (v polozce nebo na urovni operace)"); }
            if (mpkg && mown) { prob(i, "ops[" + i + "].elements[" + j + "].owningElement", "E_ARGS", "package a owningElement soucasne - cil presunu je bud balicek, nebo vlastnici prvek"); }
        }
    }
}
// --- pruchod hodnotami: zastupny text v ID polich, $N dozadu, cile GUIDem ---
var guidTargets = []; // { op, path, kind, guid }
function walk(i, v, pth, key, inRefArr, parent, pkey) {
    if (v === null || typeof v == "undefined") { return; }
    if (typeof v == "string") {
        var m = refRe.exec(v);
        if (m) {
            var idx = parseInt(m[1], 10);
            if (idx >= i) {
                prob(i, pth, "E_ARGS", "odkaz " + v + " miri " + (idx == i ? "na vlastni operaci" : "dopredu (ops[" + idx + "])")
                    + " - $N smi odkazovat jen na DRIVEJSI operaci teze davky");
            }
            return;
        }
        var kind = null;
        if (typeof ID_KEYS[key] != "undefined") { kind = ID_KEYS[key]; }
        else if (inRefArr !== null && typeof inRefArr != "undefined") { kind = inRefArr; }
        if (kind !== null) {
            // FB-PU-30: GUID bez zavorek -> doplnit primo v davce (resolvery i Risk Gate
            // pak vidi {GUID}); {…} s cizimi znaky = E_ARGS pred jakymkoli SQL
            if (bareGuidRe.test(v) && parent && typeof pkey != "undefined") {
                v = "{" + v + "}";
                try { parent[pkey] = v; } catch (eNb) { }
            }
            if (placeholder(v)) {
                prob(i, pth, "E_ARGS", "zastupny text '" + v + "' v identifikacnim poli - dosad skutecny GUID/ID (nebo $N na drivejsi operaci)");
            } else if (badBraceRe.test(v) && ph == "shape") {
                prob(i, pth, "E_ARGS", "neplatny tvar GUID '" + v + "' - GUID je {8-4-4-4-12 hex} bez mezer a cizich znaku (vezmi ho z pingu / find_* / vysledku)");
            } else if (guidRe.test(v) && kind != "") {
                guidTargets.push({ op: i, path: pth, kind: kind, guid: v }); // "?" = druh podle pole (kindOfGuid)
            }
        }
        return;
    }
    if (typeof v != "object") { return; }
    if (isArr(v)) {
        var ra = (typeof REF_ARRAYS[key] != "undefined") ? REF_ARRAYS[key] : null;
        for (var a = 0; a < v.length; a++) { walk(i, v[a], pth + "[" + a + "]", key, ra, v, a); }
        return;
    }
    for (var k in v) {
        if (typeof v[k] == "function") { continue; }
        walk(i, v[k], pth + "." + k, k, null, v, k);
    }
}
// GUID polozek: v elements[]/packages[]/diagrams[] je klic "guid" = druh dle pole
function kindOfGuid(pth) {
    if (/\.elements\[\d+\]\.guid$/.test(pth) || /\.documents\[\d+\]\.element$/.test(pth)) { return "element"; }
    if (/\.packages\[\d+\]\.guid$/.test(pth)) { return "package"; }
    if (/\.diagrams\[\d+\]\.guid$/.test(pth)) { return "diagram"; }
    if (/\.targets\[\d+\]\.guid$/.test(pth)) { return "target"; }
    return "";
}
// ===================== faze 1: tvar davky =====================
var fieldWarnings = [];
if (ph == "shape") {
    if (req && typeof req.repo == "string" && placeholder(req.repo)) {
        prob(-1, "repo", "E_ARGS", "zastupny text '" + req.repo + "' v poli repo - dosad identitu repozitare z pingu");
    }
    // FB-PU-24/-25 (Z261004b-7): sdilena kontrola poli PRED kontrolou povinnych
    // poli - aliasy (stereotype -> stereotypes, id -> elementID, ...) se prepisi
    // primo v davce, nezname pole = varovani, taggedValues mimo pole a krok bez
    // text = E_ARGS. Selhani kontroly davku nezastavi (jen varovani).
    try {
        var fc = this.FB_FieldCheck(req, reg);
        if (fc && fc.problems) { for (var fp = 0; fp < fc.problems.length; fp++) { problems.push(fc.problems[fp]); } }
        if (fc && fc.warnings) { fieldWarnings = fc.warnings; }
    } catch (eFc) { fieldWarnings.push("kontrola poli (FB_FieldCheck) selhala: " + eFc.message + " - nezname pole se nekontrolovala"); }
    for (var i = 0; i < req.ops.length; i++) {
        var o = req.ops[i];
        if (!o || typeof o != "object" || isArr(o)) { prob(i, "ops[" + i + "]", "E_ARGS", "operace musi byt objekt { op: ... }"); continue; }
        var name = (typeof o.op == "undefined" || o.op === null) ? "" : ("" + o.op);
        if (name == "") { prob(i, "ops[" + i + "].op", "E_UNKNOWN_OP", "chybi nazev operace (pole op)", { suggestions: [] }); continue; }
        if (!reg[name]) {
            var sug = nearest(name);
            prob(i, "ops[" + i + "].op", "E_UNKNOWN_OP", "neznama operace '" + name + "'" + (sug.length ? " - mysleno " + sug.join(" / ") + "?" : ""), { suggestions: sug });
            continue;
        }
        checkNeed(i, name, o);
        for (var k2 in o) {
            if (k2 == "op" || typeof o[k2] == "function") { continue; }
            walk(i, o[k2], "ops[" + i + "]." + k2, k2, null, o, k2);
        }
    }
}
// ===================== faze 2: cile =====================
if (ph == "targets") {
    for (var i2 = 0; i2 < req.ops.length; i2++) {
        var o2 = req.ops[i2];
        if (!o2 || typeof o2 != "object") { continue; }
        var nm2 = "" + (o2.op || "");
        if (!reg[nm2] || !reg[nm2].w) { continue; } // cile se overuji jen u zapisovych operaci (cteni vrati E_NOT_FOUND bez okna)
        for (var k3 in o2) {
            if (k3 == "op" || typeof o2[k3] == "function") { continue; }
            walk(i2, o2[k3], "ops[" + i2 + "]." + k3, k3, null, o2, k3);
        }
        // guid polozek: druh podle pole, u delete podle type
        for (var g = 0; g < guidTargets.length; g++) {
            var gt = guidTargets[g];
            if (gt.op != i2 || gt.kind != "?") { continue; }
            var kg = kindOfGuid(gt.path);
            if (kg == "target") {
                var tm = /\.targets\[(\d+)\]/.exec(gt.path);
                var tt = (tm && o2.targets && o2.targets[parseInt(tm[1], 10)]) ? ("" + (o2.targets[parseInt(tm[1], 10)].type || "")).toUpperCase() : "";
                kg = (tt == "ELEMENT") ? "element" : ((tt == "PACKAGE") ? "package" : ((tt == "DIAGRAM") ? "diagram" : ""));
            }
            gt.kind = kg;
        }
    }
    problems = []; // faze 1 uz probehla; tady jen cile a whitelist operaci
    // whitelist operaci AZ PO kontrole pristupu: uzivatel bez write pristupu
    // dostane E_ADDIN_ACCESS (jeho problem), ne E_OP_FORBIDDEN (problem konfigurace)
    for (var i3 = 0; i3 < req.ops.length; i3++) {
        var o3 = req.ops[i3];
        var nm3 = (o3 && typeof o3 == "object") ? ("" + (o3.op || "")) : "";
        if (nm3 != "" && reg[nm3] && reg[nm3].w && !opAllowed(nm3)) {
            prob(i3, "ops[" + i3 + "].op", "E_OP_FORBIDDEN", "operace '" + nm3 + "' neni povolena whitelistem operaci (FB_OpsAllowed) pro repozitar " + (repoId || "?"));
        }
    }
    var seenG = {};
    for (var g2 = 0; g2 < guidTargets.length; g2++) {
        var t2 = guidTargets[g2];
        if (t2.kind == "" || t2.kind == "?") { continue; }
        var ck = t2.kind + ":" + t2.guid.toUpperCase();
        if (seenG[ck] == 1) { continue; }
        var found = null;
        try { found = this.FB_TargetCache(Repository, t2.kind, t2.guid); } catch (eT) { found = null; }
        if (found == null) {
            seenG[ck] = 1;
            prob(t2.op, t2.path, "E_ARGS", "cil " + t2.guid + " (" + t2.kind + ") v modelu neexistuje - zkontroluj GUID (ping/find_*), neposilej davku znovu beze zmeny");
        }
    }
    // --- cil zapisu (Z261004b-10): blacklist, konfigurace, jmena a cesty ---
    var scopeRes = null;
    try { scopeRes = this.FB_ScopePrecheck(Repository, req, reg); }
    catch (eSc) { scopeRes = { problems: [{ op: -1, path: "FB_WriteScope", code: "E_SCOPE_CONFIG", message: "FB_ScopePrecheck selhal: " + eSc.message + " - fail-closed" }], resolved: [] }; }
    if (scopeRes && scopeRes.problems) { for (var sp = 0; sp < scopeRes.problems.length; sp++) { problems.push(scopeRes.problems[sp]); } }
    if (scopeRes && scopeRes.resolved && scopeRes.resolved.length > 0) { resolvedOut = scopeRes.resolved; }
    if (scopeRes && scopeRes.cascades && scopeRes.cascades.length > 0) { cascadesOut = scopeRes.cascades; } // W2 b/c pri cascadeDelete allow -> okno
}
// ===================== vysledek =====================
if (problems.length == 0) { return { ok: true, problems: [], resolved: resolvedOut, cascades: cascadesOut, warnings: fieldWarnings }; }
// kod davky = nejzavaznejsi z problemu (poradi: konfigurace > chranena cast >
// neznama operace > zakazana operace > nejednoznacnost > nenalezeno > tvar)
var ORDER = { "E_SCOPE_CONFIG": 7, "E_BLACKLIST": 6, "E_REPO": 6, "E_UNKNOWN_OP": 5, "E_OP_FORBIDDEN": 4, "E_AMBIGUOUS": 3, "E_NOT_FOUND": 2, "E_ARGS": 1 };
var code = "E_ARGS", audit = false, firstMsg = problems[0].message, best = 0;
for (var p2 = 0; p2 < problems.length; p2++) {
    var rank = ORDER[problems[p2].code] || 1;
    if (rank > best) { best = rank; code = problems[p2].code; }
    if (AUDIT_CODES[problems[p2].code] == 1) { audit = true; }
}
return { ok: false, code: code, audit: audit, problems: problems, resolved: resolvedOut, warnings: fieldWarnings,
    message: "Predbezna kontrola davky: " + problems.length + (problems.length == 1 ? " problem" : (problems.length < 5 ? " problemy" : " problemu"))
        + " - nic nebylo provedeno, zadne okno, zadna zaloha. Oprav davku podle problems[] a posli ji s NOVYM id. Prvni: " + problems[0].path + ": " + firstMsg };
