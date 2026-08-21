// AICodeBridge.FB_OpMoveElements(Repository, op, reqId)
// move_elements (ITERACE 6) - PRESUN existujiciho elementu mezi packages.
//
// PROC SAMOSTATNA OPERACE (rozhodnuti Milos 2026-08-21): pole `package`
// v update vetvi `create_or_update_elements` se do iterace 6 TISE
// ignorovalo a odpoved hlasila ok (falešne OK, nalez N-2 POC). Cesta
// "respektovat package u updatu" byla zamitnuta - davky bezne nesou
// `package` u updatu jen popisne a strukturalni presun jako vedlejsi
// efekt je prave to riziko, ktere nechceme. Update vetev proto od
// iterace 6 vraci WARNING s odkazem sem (viz FB_OpElements), presun ma
// vyhradne tato operace, aby byl zamer v davce videt a Risk Gate ho
// klasifikoval (ELEVATED - zasah do struktury modelu, metrika moveOps).
// `moveOps = 0` v PROTOKOL-EAFB par. 6d NEBYL designovy zakaz, jen
// nedostavena funkce - Automation API presun umi (Element.PackageID
// + Update()).
//
// op.package     = spolecny cil ("{GUID}" | packageID | jmeno | $ref)
// op.elements    = [ "{GUID}"|id|jmeno|$ref  NEBO  { element, package } ]
//                  per-polozka `package` prebiji op.package
// op.withChildren = true (DEFAULT) - DOROVNA i vlastneny podstrom:
//                  child elementy (ParentID retez) a diagramy vlastnene
//                  elementem. false = pojistka se vypne (viz nize).
//
// !! LEKCE ZIVEHO TESTU (davka 20260821-A1, EA 17.1.5): EA si presun
// vlastnenych child elementu KASKADUJE SAMA - po `Element.PackageID = X;
// Update()` maji potomci (ParentID) nove Package_ID uz bez naseho zasahu
// (dokazano ctenim UPROSTRED davky: 4 BRU pod UC-95003 sly s rodicem tam
// i zpet, pritom nas pruchod nemel co opravovat). Tento pruchod je tedy
// POJISTKA, ne motor. Proto se vykazuji DVA cisla, aby `children: 0`
// nesvadelo ke ctenim "potomci zustali vzadu":
//   children / diagrams          = kolik vlastnenych prvku jsme videli
//                                  (tolik jich s rodicem slo)
//   childrenFixed / diagramsFixed = kolik z nich jsme museli prepsat sami
// `withChildren: false` vypina JEN nas pruchod - kaskadu EA jim vypnout
// nelze. U diagramu vlastnenych elementem kaskada EA OVERENA NENI (v
// testovaci vetvi zadny takovy diagram nebyl) - pruchod je tam skutecna
// pojistka.
//
// IDEMPOTENCE: element uz v cilovem package = noop (moved: false), zadny
// zapis. Opakovane spusteni davky je bezpecne (par. 5a).
// WHITELIST: kontroluje se ZDROJOVY i CILOVY package (presun je zapis do
// obou vetvi). Validace CELE davky probehne PRED prvnim zapisem - zadny
// castecny presun pri E_ARGS/E_NOT_FOUND/E_WHITELIST.
// Vysledek: items = [{guid, id, name, moved, fromPackageID, fromPackage,
// toPackageID, toPackage, children, childrenFixed, diagrams, diagramsFixed}],
// readback (SQL Package_ID - kontrola, kde prvky po davce skutecne jsou).
if (!op) {
    return { op: "move_elements", status: "error", code: "E_ARGS", message: "Povinne: elements." };
}
if (!op.elements || Object.prototype.toString.call(op.elements) != "[object Array]" || op.elements.length == 0) {
    return { op: "move_elements", status: "error", code: "E_ARGS", message: "Povinne: elements (neprazdne pole)." };
}
var self = this;
var withChildren = (typeof op.withChildren == "undefined") ? true : (op.withChildren ? true : false);
var items = [], warns = [];

// --- validace CELE davky pred prvnim zapisem ---
var plan = [];
for (var v = 0; v < op.elements.length; v++) {
    var raw = op.elements[v];
    var elRef = null, pkgRef = null;
    if (raw !== null && typeof raw == "object") {
        elRef = raw.element || raw.guid || raw.elementID;
        pkgRef = (typeof raw["package"] != "undefined" && raw["package"] !== null && ("" + raw["package"]) != "")
            ? raw["package"] : op["package"];
    } else {
        elRef = raw;
        pkgRef = op["package"];
    }
    if (elRef === null || typeof elRef == "undefined" || ("" + elRef) == "") {
        return { op: "move_elements", status: "error", code: "E_ARGS", message: "elements[" + v + "]: chybi element." };
    }
    if (pkgRef === null || typeof pkgRef == "undefined" || ("" + pkgRef) == "") {
        return { op: "move_elements", status: "error", code: "E_ARGS",
            message: "elements[" + v + "]: chybi cilovy package (ani op.package, ani polozka)." };
    }
    var el = this.FB_ResolveEl(Repository, elRef);
    if (el == null) {
        return { op: "move_elements", status: "error", code: "E_NOT_FOUND", message: "elements[" + v + "]: element nenalezen (" + elRef + ")" };
    }
    var tgt = this.FB_ResolvePkg(Repository, pkgRef);
    if (tgt == null) {
        return { op: "move_elements", status: "error", code: "E_NOT_FOUND", message: "elements[" + v + "]: cilovy package nenalezen (" + pkgRef + ")" };
    }
    // whitelist: zdroj i cil
    var src = null;
    try { src = Repository.GetPackageByID(el.PackageID); } catch (eSrc) { src = null; }
    var chkS = this.FB_CheckWrite(Repository, src);
    if (chkS != null) {
        return { op: "move_elements", status: "error", code: chkS.code, message: "elements[" + v + "] (zdrojovy package): " + chkS.message };
    }
    var chkT = this.FB_CheckWrite(Repository, tgt);
    if (chkT != null) {
        return { op: "move_elements", status: "error", code: chkT.code, message: "elements[" + v + "] (cilovy package): " + chkT.message };
    }
    plan.push({ idx: v, el: el, tgt: tgt, srcId: el.PackageID, srcName: (src ? "" + src.Name : "") });
}

// --- presun vlastneneho podstromu (child elementy + jejich diagramy) ---
function moveOwned(el, pkgId, depth, stat) {
    if (depth > 12) {
        stat.warns.push("vlastneny podstrom je hlubsi nez 12 urovni - hloubeji se uz nedorovnavalo");
        return;
    }
    try {
        el.Elements.Refresh();
        for (var c = 0; c < el.Elements.Count; c++) {
            var ch = el.Elements.GetAt(c);
            stat.children++; // videny vlastneny prvek (sel s rodicem)
            // whitelist i na potomka: child element muze legitimne lezet v jine
            // package nez rodic - bridge ho z nebilolistovane vetve nevytahuje.
            // (Kaskadu EA tim zastavit nelze - proto warning, ne ticho.)
            var chBlocked = null;
            try { chBlocked = self.FB_CheckWrite(Repository, Repository.GetPackageByID(ch.PackageID)); } catch (eCw) { chBlocked = { message: eCw.message }; }
            if (chBlocked != null) {
                stat.warns.push("potomek '" + ch.Name + "' lezi mimo whitelist (" + chBlocked.message + ") - bridge ho neprepisuje; over rucne, kam ho posunula kaskada EA");
                continue;
            }
            try {
                if (ch.PackageID != pkgId) {
                    ch.PackageID = pkgId;
                    if (!ch.Update()) { stat.warns.push("potomek '" + ch.Name + "': Update selhal: " + ch.GetLastError()); }
                    else { stat.childrenFixed++; } // museli jsme dorovnat my
                }
            } catch (eCh) { stat.warns.push("potomek '" + ch.Name + "': " + eCh.message); }
            moveDiagrams(ch, pkgId, stat);
            moveOwned(ch, pkgId, depth + 1, stat);
        }
    } catch (eEls) { stat.warns.push("cteni potomku selhalo: " + eEls.message); }
}
function moveDiagrams(el, pkgId, stat) {
    try {
        el.Diagrams.Refresh();
        for (var d = 0; d < el.Diagrams.Count; d++) {
            var dg = el.Diagrams.GetAt(d);
            stat.diagrams++; // videny vlastneny diagram
            var dgBlocked = null;
            try { dgBlocked = self.FB_CheckWrite(Repository, Repository.GetPackageByID(dg.PackageID)); } catch (eCwD) { dgBlocked = { message: eCwD.message }; }
            if (dgBlocked != null) {
                stat.warns.push("diagram '" + dg.Name + "' lezi mimo whitelist (" + dgBlocked.message + ") - bridge ho neprepisuje");
                continue;
            }
            try {
                if (dg.PackageID != pkgId) {
                    dg.PackageID = pkgId;
                    if (!dg.Update()) { stat.warns.push("diagram '" + dg.Name + "': Update selhal: " + dg.GetLastError()); }
                    else { stat.diagramsFixed++; }
                }
            } catch (eDg) { stat.warns.push("diagram '" + dg.Name + "': " + eDg.message); }
        }
    } catch (eDgs) { stat.warns.push("cteni diagramu selhalo: " + eDgs.message); }
}

// --- vlastni presun ---
var touched = {}, movedIds = [];
for (var i = 0; i < plan.length; i++) {
    var p = plan[i];
    var e = p.el, tp = p.tgt;
    var stat = { children: 0, childrenFixed: 0, diagrams: 0, diagramsFixed: 0, warns: [] };
    var already = (e.PackageID == tp.PackageID);
    if (!already) {
        try {
            e.PackageID = tp.PackageID;
            if (!e.Update()) {
                return { op: "move_elements", status: "error", code: "E_EXCEPTION",
                    message: "elements[" + p.idx + "]: Update selhal: " + e.GetLastError(), items: items };
            }
        } catch (eMv) {
            return { op: "move_elements", status: "error", code: "E_EXCEPTION",
                message: "elements[" + p.idx + "]: " + eMv.message, items: items };
        }
    }
    if (withChildren) {
        moveDiagrams(e, tp.PackageID, stat);
        moveOwned(e, tp.PackageID, 0, stat);
    }
    for (var w = 0; w < stat.warns.length; w++) { warns.push("elements[" + p.idx + "]: " + stat.warns[w]); }
    // razitko JEN kdyz se opravdu neco stalo - noop (prvek uz v cili) nesmi
    // sahnout na model ani na LastUpdate prvku (idempotence, par. 5a)
    if (!already || stat.childrenFixed > 0 || stat.diagramsFixed > 0) {
        this.SetTag(e, "ai.request", "" + reqId);
    }
    items.push({ guid: "" + e.ElementGUID, id: e.ElementID, name: "" + e.Name,
        moved: !already, fromPackageID: p.srcId, fromPackage: p.srcName,
        toPackageID: tp.PackageID, toPackage: "" + tp.Name,
        children: stat.children, childrenFixed: stat.childrenFixed,
        diagrams: stat.diagrams, diagramsFixed: stat.diagramsFixed });
    movedIds.push(e.ElementID);
    touched["p" + p.srcId] = 1; touched["p" + tp.PackageID] = 1;
}

// --- readback (pozorovatelnost): kde prvky skutecne jsou (standardni sloupce) ---
var rb = [];
try {
    if (movedIds.length > 0) {
        rb = this.FB_XmlRows(Repository.SQLQuery(
            "SELECT Object_ID, Name, Package_ID, ParentID FROM t_object WHERE Object_ID IN (" + movedIds.join(",") + ")"));
    }
} catch (eQ) { warns.push("readback t_object selhal: " + eQ.message); }

// osvezeni browseru dotcenych vetvi (bez ShowInProjectView - past par. 1a/4)
for (var tk in touched) {
    if (touched[tk] != 1) { continue; }
    try { Repository.RefreshModelView(parseInt(("" + tk).substring(1), 10)); } catch (eRf) { }
}

var movedCount = 0;
for (var mi = 0; mi < items.length; mi++) { if (items[mi].moved) { movedCount++; } }
var res = { op: "move_elements", status: "ok", count: items.length, moved: movedCount,
    withChildren: withChildren, items: items, readback: { elements: rb } };
if (items.length > 0) { res.guid = items[0].guid; res.id = items[0].id; }
if (warns.length > 0) { res.warnings = warns; }
return res;
