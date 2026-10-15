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
// op.owningElement = ALTERNATIVNI cil (N-RE-17, v0.22): presun POD PRVEK
//                  ("{GUID}" | elementID | $ref) - Element.ParentID = vlastnik,
//                  PackageID = balicek vlastnika; potomci a vlastnene diagramy
//                  nasleduji (stejna kaskada jako u balicku). Metodicky duvod
//                  (Milos 15. 10. 2026): rozhrani patri pod komponentu, prvky
//                  sekvence (lifeliny, refy, gaty) pod prvek SR / UCR na uroven
//                  jeho kompozitniho diagramu. `package` a `owningElement`
//                  soucasne = E_ARGS; vlastnik = sam prvek nebo jeho potomek =
//                  E_ARGS. Presun pod prvek je v Risk Gate stejne ELEVATED.
// op.elements    = [ "{GUID}"|id|jmeno|$ref  NEBO  { element, package | owningElement } ]
//                  per-polozka `package` / `owningElement` prebiji op.*
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
// CIL ZAPISU (rezim blacklist, zadani v1.1 kap. 5.5, I6, Z261004b-10):
// kontroluje se ZDROJ (prvek vc. osy vlastniku), CILOVY package a PREDEM cely
// VLASTNENY podstrom (child elementy pres ParentID + diagramy vlastnene prvky)
// bez stropu 12 urovni - potomek nebo diagram v chranene casti = E_BLACKLIST
// pred prvnim presunem; podstrom hlubsi nez MAX_DEPTH urovni nebo vetsi nez
// MAX_NODES uzlu = E_BLACKLIST "presun po castech" (nikdy tichy presun).
// Validace CELE davky probehne PRED prvnim zapisem - zadny castecny presun.
// Vysledek: items = [{guid, id, name, moved, fromPackageID, fromPackage,
// toPackageID, toPackage, fromOwnerID, toOwnerID?, toOwner?, children,
// childrenFixed, diagrams, diagramsFixed}],
// readback (SQL Package_ID + ParentID - kontrola, kde prvky po davce skutecne jsou).
if (!op) {
    return { op: "move_elements", status: "error", code: "E_ARGS", message: "Povinne: elements." };
}
if (!op.elements || Object.prototype.toString.call(op.elements) != "[object Array]" || op.elements.length == 0) {
    return { op: "move_elements", status: "error", code: "E_ARGS", message: "Povinne: elements (neprazdne pole)." };
}
var self = this;
var withChildren = (typeof op.withChildren == "undefined") ? true : (op.withChildren ? true : false);
var items = [], warns = [];
this._fbOpProgress = { items: items }; // W3
var MAX_DEPTH = 60, MAX_NODES = 5000;
function qrows(sql) { try { return self.FB_XmlRows(Repository.SQLQuery(sql)); } catch (eQ) { return null; } }
function scope(kind, id) { try { return self.FB_ScopeCheck(Repository, kind, "" + id); } catch (eS) { return { code: "E_EXCEPTION", message: "kontrola cile selhala: " + eS.message }; } }
// predbezny pruchod vlastnenym podstromem (SQL po urovnich, zadne Automation
// objekty): vraci null (ok) nebo { code, message }
function subtreeCheck(rootEl, idx) {
    var level = ["" + rootEl.ElementID], all = ["" + rootEl.ElementID], depth = 0;
    while (level.length > 0) {
        if (depth++ >= MAX_DEPTH) { return { code: "E_BLACKLIST", message: "elements[" + idx + "]: vlastneny podstrom je hlubsi nez " + MAX_DEPTH + " urovni - bridge ho nedokaze predem zkontrolovat; presun po castech" }; }
        var rc = qrows("SELECT Object_ID, Name FROM t_object WHERE ParentID IN (" + level.join(",") + ")");
        if (rc == null) { return { code: "E_EXCEPTION", message: "elements[" + idx + "]: vlastneny podstrom nelze precist (SQL) - fail-closed, nic nepresunuto" }; }
        var next = [];
        for (var c = 0; c < rc.length; c++) {
            var cid = parseInt(rc[c].Object_ID, 10);
            var sr = scope("element", cid);
            if (sr != null && sr.code != "E_NOT_FOUND") { return { code: sr.code, message: "elements[" + idx + "]: vlastneny potomek '" + rc[c].Name + "' (" + cid + ") lezi v chranene casti - presun by ho vzal s sebou. " + sr.message }; }
            next.push("" + cid); all.push("" + cid);
            if (all.length > MAX_NODES) { return { code: "E_BLACKLIST", message: "elements[" + idx + "]: vlastneny podstrom ma vic nez " + MAX_NODES + " prvku - presun po castech" }; }
        }
        level = next;
    }
    var rd = qrows("SELECT Diagram_ID, Name FROM t_diagram WHERE ParentID IN (" + all.join(",") + ")");
    if (rd == null) { return { code: "E_EXCEPTION", message: "elements[" + idx + "]: vlastnene diagramy nelze precist (SQL) - fail-closed, nic nepresunuto" }; }
    for (var d = 0; d < rd.length; d++) {
        var did = parseInt(rd[d].Diagram_ID, 10);
        var dr = scope("diagram", did);
        if (dr != null && dr.code != "E_NOT_FOUND") { return { code: dr.code, message: "elements[" + idx + "]: vlastneny diagram '" + rd[d].Name + "' (" + did + ") lezi v chranene casti - presun by ho vzal s sebou. " + dr.message }; }
    }
    return null;
}

// --- validace CELE davky pred prvnim zapisem ---
function given(v2) { return typeof v2 != "undefined" && v2 !== null && ("" + v2) != ""; }
var plan = [];
for (var v = 0; v < op.elements.length; v++) {
    var raw = op.elements[v];
    var elRef = null, pkgRef = null, ownRef = null;
    if (raw !== null && typeof raw == "object") {
        elRef = raw.element || raw.guid || raw.elementID;
        if (given(raw["package"]) || given(raw.owningElement)) {
            // polozka urcuje cil sama (jeden z dvojice)
            pkgRef = given(raw["package"]) ? raw["package"] : null;
            ownRef = given(raw.owningElement) ? raw.owningElement : null;
        } else {
            pkgRef = given(op["package"]) ? op["package"] : null;
            ownRef = given(op.owningElement) ? op.owningElement : null;
        }
    } else {
        elRef = raw;
        pkgRef = given(op["package"]) ? op["package"] : null;
        ownRef = given(op.owningElement) ? op.owningElement : null;
    }
    if (elRef === null || typeof elRef == "undefined" || ("" + elRef) == "") {
        return { op: "move_elements", status: "error", code: "E_ARGS", message: "elements[" + v + "]: chybi element." };
    }
    if (pkgRef !== null && ownRef !== null) {
        return { op: "move_elements", status: "error", code: "E_ARGS",
            message: "elements[" + v + "]: package a owningElement soucasne - cil presunu je bud balicek, nebo vlastnici prvek (ne oboji)." };
    }
    if (pkgRef === null && ownRef === null) {
        return { op: "move_elements", status: "error", code: "E_ARGS",
            message: "elements[" + v + "]: chybi cil presunu - package nebo owningElement (na urovni operace nebo v polozce)." };
    }
    var el = this.FB_ResolveEl(Repository, elRef);
    if (el == null) {
        return this.FB_ResolveFail("move_elements", "elements[" + v + "]: element nenalezen (" + elRef + ")", null);
    }
    var tgt = null, owner = null;
    if (ownRef !== null) {
        // N-RE-17: cil = vlastnici prvek; balicek = balicek vlastnika
        owner = this.FB_ResolveEl(Repository, ownRef);
        if (owner == null) {
            return this.FB_ResolveFail("move_elements", "elements[" + v + "]: owningElement nenalezen (" + ownRef + ")", null);
        }
        if (owner.ElementID == el.ElementID) {
            return { op: "move_elements", status: "error", code: "E_ARGS", message: "elements[" + v + "]: owningElement je sam presouvany prvek." };
        }
        // vlastnik nesmi byt potomek prvku (cyklus ve stromu): retez ParentID od vlastnika nahoru
        var anc = owner, hops = 0, cyc = false;
        while (anc && anc.ParentID && anc.ParentID > 0 && hops++ < MAX_DEPTH) {
            if (anc.ParentID == el.ElementID) { cyc = true; break; }
            try { anc = Repository.GetElementByID(anc.ParentID); } catch (eAn) { anc = null; }
        }
        if (cyc) {
            return { op: "move_elements", status: "error", code: "E_ARGS", message: "elements[" + v + "]: owningElement '" + owner.Name + "' je potomek presouvaneho prvku - vznikl by cyklus ve stromu." };
        }
        var chkOw = this.FB_CheckWriteEl(Repository, owner);
        if (chkOw != null) {
            return { op: "move_elements", status: "error", code: chkOw.code, message: "elements[" + v + "] (cilovy vlastnik): " + chkOw.message };
        }
        try { tgt = Repository.GetPackageByID(owner.PackageID); } catch (eTp) { tgt = null; }
        if (tgt == null) {
            return { op: "move_elements", status: "error", code: "E_NOT_FOUND", message: "elements[" + v + "]: balicek vlastnika (" + owner.PackageID + ") nenalezen." };
        }
    } else {
        tgt = this.FB_ResolvePkg(Repository, pkgRef);
        if (tgt == null) {
            var pl = (pkgRef !== null && typeof pkgRef == "object" && pkgRef.path) ? ("path " + pkgRef.path.join(".")) : ("" + pkgRef);
            return this.FB_ResolveFail("move_elements", "elements[" + v + "]: cilovy package nenalezen (" + pl + ")", null);
        }
    }
    // cil zapisu: zdroj (prvek vc. vlastniku), cil, vlastneny podstrom
    var src = null;
    try { src = Repository.GetPackageByID(el.PackageID); } catch (eSrc) { src = null; }
    var chkS = this.FB_CheckWriteEl(Repository, el);
    if (chkS != null) {
        return { op: "move_elements", status: "error", code: chkS.code, message: "elements[" + v + "] (zdroj presunu): " + chkS.message };
    }
    var chkT = this.FB_CheckWrite(Repository, tgt);
    if (chkT != null) {
        return { op: "move_elements", status: "error", code: chkT.code, message: "elements[" + v + "] (cilovy package): " + chkT.message };
    }
    var chkSub = subtreeCheck(el, v);
    if (chkSub != null) {
        return { op: "move_elements", status: "error", code: chkSub.code, message: chkSub.message };
    }
    plan.push({ idx: v, el: el, tgt: tgt, owner: owner, srcId: el.PackageID, srcName: (src ? "" + src.Name : ""), srcOwner: el.ParentID });
}

// --- presun vlastneneho podstromu (child elementy + jejich diagramy) ---
function moveOwned(el, pkgId, depth, stat) {
    if (depth > MAX_DEPTH) {
        stat.warns.push("vlastneny podstrom je hlubsi nez " + MAX_DEPTH + " urovni - hloubeji se uz nedorovnavalo");
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
                // druha obrana (predbezny pruchod subtreeCheck by to mel chytit driv)
                stat.warns.push("potomek '" + ch.Name + "' lezi v chranene casti (" + chBlocked.message + ") - bridge ho neprepisuje; over rucne, kam ho posunula kaskada EA");
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
                stat.warns.push("diagram '" + dg.Name + "' lezi v chranene casti (" + dgBlocked.message + ") - bridge ho neprepisuje");
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
    // cil balicek: prvek zustava vlastneny tim, kym byl (ParentID se nemeni);
    // cil vlastnik (N-RE-17): ParentID = vlastnik + balicek vlastnika
    var already = (p.owner != null)
        ? (e.ParentID == p.owner.ElementID && e.PackageID == tp.PackageID)
        : (e.PackageID == tp.PackageID);
    if (!already) {
        try {
            // LEKCE 15. 10. 2026 (zive, N-RE-17): zapis PackageID (i na stejnou hodnotu)
            // bere EA jako presun do balicku a ParentID pri Update vynuluje - proto
            // PackageID jen kdyz se lisi, a ParentID vzdy az ve VLASTNIM Update.
            if (e.PackageID != tp.PackageID) {
                e.PackageID = tp.PackageID;
                if (!e.Update()) {
                    return { op: "move_elements", status: "error", code: "E_EXCEPTION",
                        message: "elements[" + p.idx + "]: Update (PackageID) selhal: " + e.GetLastError(), items: items };
                }
            }
            if (p.owner != null && e.ParentID != p.owner.ElementID) {
                e.ParentID = p.owner.ElementID;
                if (!e.Update()) {
                    return { op: "move_elements", status: "error", code: "E_EXCEPTION",
                        message: "elements[" + p.idx + "]: Update (ParentID) selhal: " + e.GetLastError(), items: items };
                }
                // readback z modelu - EA umi Update vratit true a ParentID nezapsat
                var chkE = null;
                try { chkE = Repository.GetElementByID(e.ElementID); } catch (eRb) { chkE = null; }
                if (chkE != null && chkE.ParentID != p.owner.ElementID) {
                    return { op: "move_elements", status: "error", code: "E_EXCEPTION",
                        message: "elements[" + p.idx + "]: EA nezapsal vlastnika (ParentID zustal " + chkE.ParentID + ") - prvek zustava, kde byl.", items: items };
                }
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
    var itM = { guid: "" + e.ElementGUID, id: e.ElementID, name: "" + e.Name,
        moved: !already, fromPackageID: p.srcId, fromPackage: p.srcName,
        toPackageID: tp.PackageID, toPackage: "" + tp.Name, fromOwnerID: p.srcOwner,
        children: stat.children, childrenFixed: stat.childrenFixed,
        diagrams: stat.diagrams, diagramsFixed: stat.diagramsFixed };
    if (p.owner != null) { itM.toOwnerID = p.owner.ElementID; itM.toOwner = "" + p.owner.Name; }
    items.push(itM);
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
// N-RE-17: vlastnici prvky (strom pod prvkem EA prekresli az po Refresh vlastnika)
for (var oi = 0; oi < plan.length; oi++) {
    if (plan[oi].owner != null) { try { plan[oi].owner.Elements.Refresh(); } catch (eRo) { } }
}

var movedCount = 0;
for (var mi = 0; mi < items.length; mi++) { if (items[mi].moved) { movedCount++; } }
var res = { op: "move_elements", status: "ok", count: items.length, moved: movedCount,
    withChildren: withChildren, items: items, readback: { elements: rb } };
if (items.length > 0) { res.guid = items[0].guid; res.id = items[0].id; }
if (warns.length > 0) { res.warnings = warns; }
return res;
