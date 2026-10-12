// AICodeBridge.FB_FieldCheck(req, reg)
// SDILENA KONTROLA POLI DAVKY (balik B2 operace, Z261004b-7; revize usability
// pumpy FB-PU-24 + FB-PU-25). Bezi ve FB_Precheck (faze "shape") PRED kontrolou
// povinnych poli, nad KAZDOU operaci, kterou registr zna a ktera ma tu zaznam
// (SPEC). Operace bez zaznamu se nekontroluje (zadne falesne varovani).
// Tri veci v jednom pruchodu:
//  1. ALIASY nejcastejsich zamen se prepisi PRIMO V DAVCE (op/polozka), kdyz
//     spravny klic chybi: stereotype -> stereotypes (prvky, vazby), stereotypes
//     -> stereotype (atributy, operace), id -> elementID / packageID /
//     connectorID / attributeID / operationID / diagramID (FB-PU-25: `id`
//     z vysledku je klic upravy), defaultValue -> default, description -> notes
//     (kde kod alias nema), tagged_values/tags -> taggedValues, note -> notes,
//     elementID/packageID/... -> id u cilu mazani, limit/top/rows -> maxRows,
//     barva "#RRGGBB" -> {red, green, blue}. Kazdy alias = jedno varovani
//     ("prijato jako ..."), aby agent priste psal spravny tvar.
//  2. NEZNAME POLE = varovani s napovedou nejblizsiho znameho pole
//     ("elements[0]: nezname pole 'sterotypes' (myslel jsi 'stereotypes'?)").
//     Drive se tise ignorovalo a odpoved hlasila ok (falesne OK, FB-PU-24).
//     Dokumentacni klice (why, note, comment, desc, _comment) jsou dovolene
//     na urovni operace vzdy.
//  3. E_ARGS (problems[], davka se neprovede): taggedValues, ktere nejsou pole;
//     krok scenare bez `text` (prosty retezec nebo objekt bez text) - z nich
//     by vznikly prazdne kroky.
// Vraci { problems: [{op, path, code, message}], warnings: [string], aliased: n }.
// Zadne SQL, zadny model - jen tvar davky. Texty bez diakritiky (spike S1).
var problems = [], warnings = [], aliased = 0;
function isArr(v) { return Object.prototype.toString.call(v) == "[object Array]"; }
function isObj(v) { return v !== null && typeof v == "object" && !isArr(v); }
function hasKey(o, k) { return typeof o[k] != "undefined" && o[k] !== null; }
var DOC_KEYS = { why: 1, note: 1, comment: 1, desc: 1, _comment: 1 };
// --- spolecne sady klicu ---
var ITEM_TV = ["taggedValues"];
var SPEC = {
    "create_or_update_elements": { top: ["elements"], lists: { elements: {
        item: ["guid", "elementID", "package", "owningElement", "name", "type", "stereotypes", "notes", "description", "notes_b64",
               "alias", "multiplicity", "status", "author", "version", "classifierID", "classifier", "isComposite", "compositeDiagram",
               "taggedValues", "dedupKey", "matchByName"],
        alias: { stereotype: "stereotypes", id: "elementID", tagged_values: "taggedValues", tags: "taggedValues", note: "notes", parent: "package", owner: "owningElement" },
        tv: true } } },
    "create_element": { top: ["name", "type", "package", "stereotype", "notes", "notes_b64"], alias: { stereotypes: "stereotype", note: "notes", description: "notes" } },
    "create_or_update_package": { top: ["packages", "guid", "packageID", "parent", "name", "notes", "description", "notes_b64", "author", "version", "taggedValues", "matchByName"],
        alias: { id: "packageID", note: "notes", tagged_values: "taggedValues", tags: "taggedValues" },
        lists: { packages: {
        item: ["guid", "packageID", "parent", "name", "notes", "description", "notes_b64", "author", "version", "taggedValues", "matchByName"],
        alias: { id: "packageID", note: "notes", tagged_values: "taggedValues", tags: "taggedValues", "package": "parent" },
        tv: true } } },
    "create_or_update_connectors": { top: ["connectors"], lists: { connectors: {
        item: ["guid", "connectorID", "source", "target", "type", "stereotypes", "name", "notes", "description", "notes_b64",
               "direction", "sourceEnd", "targetEnd", "taggedValues", "dedupKey", "match"],
        alias: { stereotype: "stereotypes", id: "connectorID", tagged_values: "taggedValues", tags: "taggedValues", note: "notes", from: "source", to: "target", client: "source", supplier: "target" },
        sub: { sourceEnd: ["aggregation", "multiplicity", "role", "navigable"], targetEnd: ["aggregation", "multiplicity", "role", "navigable"] },
        subAlias: { cardinality: "multiplicity" },
        tv: true } } },
    "create_or_update_attributes": { top: ["element", "attributes"], lists: { attributes: {
        item: ["attributeID", "guid", "name", "type", "classifierID", "classifier", "notes", "description", "stereotype", "default",
               "position", "lowerBound", "upperBound", "taggedValues"],
        alias: { stereotypes: "stereotype", id: "attributeID", defaultValue: "default", initial: "default", note: "notes", tagged_values: "taggedValues", tags: "taggedValues", pos: "position" },
        tv: true } } },
    "create_or_update_operations": { top: ["element", "operations"], lists: { operations: {
        item: ["operationID", "guid", "name", "returnType", "returnClassifierID", "returnClassifier", "notes", "description", "stereotype",
               "isStatic", "isAbstract", "parameters", "taggedValues"],
        alias: { stereotypes: "stereotype", id: "operationID", methodID: "operationID", note: "notes", tagged_values: "taggedValues", tags: "taggedValues", "return": "returnType" },
        sub: { parameters: ["name", "type", "notes", "default"] },
        subAlias: { defaultValue: "default", description: "notes", note: "notes" },
        tv: true } } },
    "create_or_update_messages": { top: ["diagram", "rebuild", "messages"], lists: { messages: {
        item: ["connectorID", "guid", "source", "target", "name", "operation", "isReturn", "isAsynchronous", "arguments", "returnValue", "notes", "seqNo"],
        alias: { id: "connectorID", note: "notes", description: "notes", isAsync: "isAsynchronous", async: "isAsynchronous", sequence: "seqNo", seq: "seqNo", from: "source", to: "target" } } } },
    "create_or_update_scenarios": { top: ["element", "scenarios", "probe"], lists: { scenarios: {
        item: ["name", "type", "notes", "steps", "attachTo", "join"],
        alias: { description: "notes", note: "notes" },
        sub: { steps: ["text", "kind", "stepType", "uses", "results", "state"], attachTo: ["scenario", "step"] },
        subAlias: { name: "text", action: "text", actor: "kind", result: "results" },
        stepsText: true } } },
    "create_or_update_constraints": { top: ["element", "constraints"], lists: { constraints: {
        item: ["name", "type", "notes", "status"], alias: { description: "notes", note: "notes" } } } },
    "create_or_update_requirements": { top: ["element", "requirements"], lists: { requirements: {
        item: ["name", "notes", "type", "status", "priority", "difficulty", "stability"], alias: { description: "notes", note: "notes", text: "notes" } } } },
    "create_or_update_diagram": { top: ["diagrams"], lists: { diagrams: {
        item: ["diagram", "diagramID", "guid", "package", "owningElement", "type", "name", "notes", "author", "version", "showDetails", "styleEx"],
        alias: { id: "diagramID", note: "notes", description: "notes" } } } },
    "update_diagram_properties": { top: ["diagrams"], lists: { diagrams: {
        item: ["diagram", "name", "author", "version", "showDetails", "styleEx"], alias: { id: "diagram", diagramID: "diagram", guid: "diagram" } } } },
    "place_elements_on_diagram": { top: ["diagram", "elementPlacements", "elements"], lists: { elementPlacements: {
        item: ["elementID", "element", "x", "y", "width", "height", "style"], alias: { id: "elementID", guid: "element", w: "width", h: "height", left: "x", top: "y" } },
        elements: { item: ["elementID", "element", "x", "y", "width", "height", "style"], alias: { id: "elementID", guid: "element", w: "width", h: "height", left: "x", top: "y" } } } },
    "set_diagram_object_style": { top: ["diagram", "objects"], lists: { objects: {
        item: ["elementID", "backgroundColor", "fontColor", "borderColor", "borderWidth", "reset"],
        alias: { id: "elementID", background: "backgroundColor", fillColor: "backgroundColor", color: "fontColor", border: "borderColor" },
        colors: ["backgroundColor", "fontColor", "borderColor"] } } },
    "delete_from_model": { top: ["targets"], lists: { targets: {
        item: ["type", "id", "guid", "name"], alias: { elementID: "id", packageID: "id", connectorID: "id", diagramID: "id", attributeID: "id", operationID: "id", kind: "type" } } } },
    "delete_taggedvalue_from_model": { top: ["targets"], lists: { targets: {
        item: ["type", "id", "name"], alias: { elementID: "id", connectorID: "id", attributeID: "id", operationID: "id", packageID: "id", tag: "name" } } } },
    "move_elements": { top: ["package", "elements", "withChildren"], alias: { target: "package", targetPackage: "package", to: "package" } },
    "remove_elements_from_diagram": { top: ["diagram", "elementIDs"], alias: { elements: "elementIDs", ids: "elementIDs" } },
    "query": { top: ["sql", "sql_b64", "maxRows"], alias: { limit: "maxRows", top: "maxRows", rows: "maxRows", max_rows: "maxRows", maxrows: "maxRows", query: "sql" } },
    "find_elements_by_name": { top: ["name", "exactMatch", "scope"], alias: { exact: "exactMatch", "package": "scope", branch: "scope" } },
    "find_packages_by_name": { top: ["name", "exactMatch", "scope"], alias: { exact: "exactMatch", "package": "scope", branch: "scope" } },
    "get_elements_information": { top: ["elements", "brief"], alias: { element: "elements", ids: "elements", guids: "elements" } },
    "get_packages_information": { top: ["packages"], alias: { "package": "packages", ids: "packages" } },
    "clone_elements": { top: ["elements", "package"], alias: { target: "package", targetPackage: "package" } },
    "clone_package": { top: ["package", "name"], alias: { source: "package", newName: "name" } },
    "create_baseline": { top: ["package", "name", "session", "notes"], alias: { version: "name", note: "notes" } }
};
// --- nejblizsi znamy klic (Levenshtein, ES3) ---
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
function nearest(key, known) {
    var kl = ("" + key).toLowerCase(), best = null, bd = 99;
    for (var i = 0; i < known.length; i++) {
        var cand = known[i], cl = cand.toLowerCase();
        if (cl == kl) { return cand; } // jen jina velikost pismen
        var d = lev(kl, cl);
        if (kl.length >= 3 && (cl.indexOf(kl) == 0 || kl.indexOf(cl) == 0)) { d = (d < 2) ? d : 2; } // prefix = blizko
        if (d < bd) { bd = d; best = cand; }
    }
    return (bd <= 3) ? best : null;
}
function inList(k, list) { for (var i = 0; i < list.length; i++) { if (list[i] == k) { return true; } } return false; }
function hexColor(v) {
    var m = /^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec("" + v);
    if (!m) { return null; }
    return { red: parseInt(m[1], 16), green: parseInt(m[2], 16), blue: parseInt(m[3], 16) };
}
// kontrola jednoho objektu: aliasy (prepis v miste), nezname klice (varovani)
function checkObj(o, known, alias, pth, opIdx) {
    if (!isObj(o)) { return; }
    var k, used = [];
    for (k in o) { if (typeof o[k] != "function") { used.push(k); } }
    for (var u = 0; u < used.length; u++) {
        k = used[u];
        if (inList(k, known)) { continue; }
        if (alias && typeof alias[k] == "string") {
            var tgt = alias[k];
            if (!hasKey(o, tgt)) {
                o[tgt] = o[k];
                try { delete o[k]; } catch (eD) { o[k] = null; }
                aliased++;
                warnings.push(pth + ": pole '" + k + "' prijato jako '" + tgt + "' - priste pis '" + tgt + "'");
            } else {
                warnings.push(pth + ": pole '" + k + "' ignorovano - plati '" + tgt + "', ktere je v polozce take");
                try { delete o[k]; } catch (eD2) { o[k] = null; }
            }
            continue;
        }
        var near = nearest(k, known);
        warnings.push(pth + ": nezname pole '" + k + "'" + (near ? " (myslel jsi '" + near + "'?)" : "") + " - pole se neprovede");
    }
}
function checkTv(o, pth, opIdx) {
    if (!hasKey(o, "taggedValues")) { return; }
    if (!isArr(o.taggedValues)) {
        problems.push({ op: opIdx, path: pth + ".taggedValues", code: "E_ARGS",
            message: "taggedValues musi byt pole [{name, value}] - poslany tvar (" + (isObj(o.taggedValues) ? "objekt" : typeof o.taggedValues) + ") by se tise preskocil; prepis na [{\"name\": \"...\", \"value\": \"...\"}]" });
        return;
    }
    for (var i = 0; i < o.taggedValues.length; i++) {
        var tv = o.taggedValues[i];
        if (!isObj(tv)) {
            problems.push({ op: opIdx, path: pth + ".taggedValues[" + i + "]", code: "E_ARGS", message: "polozka taggedValues musi byt objekt {name, value}" });
            continue;
        }
        checkObj(tv, ["name", "value", "ids", "notes"], { tag: "name", key: "name", val: "value", "default": "value" }, pth + ".taggedValues[" + i + "]", opIdx);
    }
}
if (!req || !isArr(req.ops)) { return { problems: problems, warnings: warnings, aliased: aliased }; }
for (var i = 0; i < req.ops.length; i++) {
    var o = req.ops[i];
    if (!isObj(o)) { continue; }
    var name = "" + (o.op || "");
    var spec = SPEC[name];
    if (!spec || !reg || !reg[name]) { continue; }
    var opPath = "ops[" + i + "]";
    // uroven operace: dokumentacni klice + op + top + nazvy seznamu
    var topKnown = ["op"].concat(spec.top || []);
    for (var dk in DOC_KEYS) { topKnown.push(dk); }
    if (spec.lists) { for (var lk in spec.lists) { if (!inList(lk, topKnown)) { topKnown.push(lk); } } }
    checkObj(o, topKnown, spec.alias || null, opPath, i);
    if (name == "create_or_update_package" && !isArr(o.packages)) { checkTv(o, opPath, i); }
    if (!spec.lists) { continue; }
    for (var listKey in spec.lists) {
        var ls = spec.lists[listKey];
        if (!isArr(o[listKey])) { continue; }
        for (var j = 0; j < o[listKey].length; j++) {
            var it = o[listKey][j];
            var ipath = opPath + "." + listKey + "[" + j + "]";
            if (!isObj(it)) { continue; } // tvar polozky hlida FB_Precheck.checkNeed
            checkObj(it, ls.item, ls.alias || null, ipath, i);
            if (ls.tv) { checkTv(it, ipath, i); }
            if (ls.colors) {
                for (var c = 0; c < ls.colors.length; c++) {
                    var ck = ls.colors[c];
                    if (hasKey(it, ck) && typeof it[ck] == "string") {
                        var col = hexColor(it[ck]);
                        if (col) { it[ck] = col; aliased++; warnings.push(ipath + "." + ck + ": barva '" + col.red + "," + col.green + "," + col.blue + "' prevedena z textu - priste pis {red, green, blue}"); }
                        else { problems.push({ op: i, path: ipath + "." + ck, code: "E_ARGS", message: "barva musi byt {red, green, blue} (0-255) nebo '#RRGGBB' - text '" + it[ck] + "' by skoncil cernou" }); }
                    }
                }
            }
            if (ls.sub) {
                for (var sk in ls.sub) {
                    if (!hasKey(it, sk)) { continue; }
                    var sv = it[sk];
                    if (isArr(sv)) {
                        for (var s = 0; s < sv.length; s++) {
                            var spath = ipath + "." + sk + "[" + s + "]";
                            if (ls.stepsText && sk == "steps") {
                                if (!isObj(sv[s])) {
                                    problems.push({ op: i, path: spath, code: "E_ARGS", message: "krok scenare musi byt objekt {text, kind} - prosty retezec by vytvoril prazdny krok" });
                                    continue;
                                }
                                checkObj(sv[s], ls.sub[sk], ls.subAlias || null, spath, i);
                                if (!hasKey(sv[s], "text") || ("" + sv[s].text).replace(/^\s+|\s+$/g, "") == "") {
                                    problems.push({ op: i, path: spath + ".text", code: "E_ARGS", message: "krok scenare bez text - vznikl by prazdny krok" });
                                }
                                continue;
                            }
                            if (isObj(sv[s])) { checkObj(sv[s], ls.sub[sk], ls.subAlias || null, spath, i); }
                        }
                    } else if (isObj(sv)) {
                        checkObj(sv, ls.sub[sk], ls.subAlias || null, ipath + "." + sk, i);
                    }
                }
            }
        }
    }
}
return { problems: problems, warnings: warnings, aliased: aliased };
