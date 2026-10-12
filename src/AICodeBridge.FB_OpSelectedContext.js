// AICodeBridge.FB_OpSelectedContext(Repository, op)
// get_selected_context (Č, iterace 5 C): aktualni vyber v Project browseru
// + otevreny diagram jako KONTEXT pro Copilota. KLIENTSKY vzor (rozhodnuti
// Milos 2026-08-20): Copilot si kontext precte mini ctecí davkou a GUIDy
// VLOZI do zapisove davky - zadny server-side default cile (davka zustava
// samonosna: deterministicky retry par. 5a, risk gate i audit sedi na tom,
// co bylo potvrzeno; vyber se mezi Copy a exekuci muze zmenit = TOCTOU).
// Pozn. k PROTOKOL par. 4 "trvale vylouceno get_current_*": verdikt platil
// pro cisty davkovy kanal; interaktivni rezimy (clipboard, GUI fallback)
// vyber smysluplne zhodnoti - revize v par. 6g.
// EA API: GetTreeSelectedItemType / GetTreeSelectedObject /
// GetTreeSelectedElements / GetCurrentDiagram. Jen CTENI vlastnosti
// vracenych objektu (stejna rodina jako GetElementByID) - zadne navigacni
// COM volani (past par. 1a/4).
// Response:
//   selected: true|false
//   repository: identita repa (FB_RepoId) - do schranky / do davky
//   context: { type: Element|Package|Diagram|Attribute|Operation, guid, id,
//     name, path (teckova), branchGuid+branchId (vetev pro scope/adresaci),
//     writeCheck { ok, code, note } - TATAZ kontrola cile zapisu jako pri
//     zapisu (blacklist + implicitni ochrana, osa balicku i vlastniku), BEZ
//     zamku EA (ty se projevi az pri zapisu: E_PERMISSION / E_LOCKED).
//     Nahrazuje inWhitelist/whitelistNote (cil zapisu v1.2, FB-CZ-19,
//     Z261004b-11). Je to snimek v okamziku cteni - rozhoduje kontrola pri
//     provedeni (davka nese GUID).
//   selectedElements: [{guid,id,name,type}] (multi-vyber, max 50)
//   currentDiagram: { guid, id, name, type } | null
//   treeType: syrova hodnota GetTreeSelectedItemType (diagnostika)
var self = this;
var r = { op: "get_selected_context", status: "ok", selected: false, repository: "",
    context: null, selectedElements: [], currentDiagram: null, treeType: 0 };
try { r.repository = "" + this.FB_RepoId(Repository); } catch (eRid) { r.repository = ""; }
try { r.treeType = Repository.GetTreeSelectedItemType(); } catch (eT) { r.treeType = 0; }
var obj = null;
try { obj = Repository.GetTreeSelectedObject(); } catch (eO) { obj = null; }
function prop(o, name) {
    try { var v = o[name]; return (typeof v == "undefined") ? null : v; }
    catch (e) { return null; }
}
// writeCheck = tataz kontrola jako pri zapisu (FB_CheckWrite pro balicek,
// FB_CheckWriteEl pro prvek/diagram - osa balicku i vlastniku), bez zamku EA
function wcFrom(err, what) {
    if (err == null) { return { ok: true, code: "", note: "zapis sem by prosel kontrolou cile (blacklist + implicitni ochrana); zamky EA rozhodnou az pri zapisu" }; }
    return { ok: false, code: "" + err.code, note: (what ? what + ": " : "") + err.message };
}
function wcPkg(pkgObj) {
    try { return wcFrom(self.FB_CheckWrite(Repository, pkgObj), ""); }
    catch (e) { return { ok: false, code: "E_EXCEPTION", note: "kontrola cile zapisu selhala: " + e.message }; }
}
function wcEl(obj, kind) {
    try { return wcFrom(self.FB_CheckWriteEl(Repository, obj, kind), ""); }
    catch (e) { return { ok: false, code: "E_EXCEPTION", note: "kontrola cile zapisu selhala: " + e.message }; }
}
function elCtx(el, typeLabel, ownGuid, ownId, ownName) {
    var pkg = null;
    try { pkg = Repository.GetPackageByID(el.PackageID); } catch (eP) { pkg = null; }
    return { type: typeLabel, guid: "" + ownGuid, id: ownId, name: "" + ownName,
        path: "" + self.FB_ElementPath(Repository, "element", el)
            + (typeLabel == "Element" ? "" : ("." + ownName)),
        branchGuid: pkg ? ("" + pkg.PackageGUID) : "", branchId: pkg ? pkg.PackageID : 0,
        writeCheck: wcEl(el, "element") };
}
if (obj != null) {
    var ctxInfo = null;
    if (prop(obj, "ElementGUID") != null) {
        ctxInfo = elCtx(obj, "Element", obj.ElementGUID, obj.ElementID, obj.Name);
    } else if (prop(obj, "PackageGUID") != null) {
        ctxInfo = { type: "Package", guid: "" + obj.PackageGUID, id: obj.PackageID, name: "" + obj.Name,
            path: "" + this.FB_ElementPath(Repository, "package", obj),
            branchGuid: "" + obj.PackageGUID, branchId: obj.PackageID,
            writeCheck: wcPkg(obj) };
    } else if (prop(obj, "DiagramGUID") != null) {
        var pkgD = null;
        try { pkgD = Repository.GetPackageByID(obj.PackageID); } catch (eD) { pkgD = null; }
        ctxInfo = { type: "Diagram", guid: "" + obj.DiagramGUID, id: obj.DiagramID, name: "" + obj.Name,
            path: (pkgD ? ("" + this.FB_ElementPath(Repository, "package", pkgD) + ".") : "") + obj.Name,
            branchGuid: pkgD ? ("" + pkgD.PackageGUID) : "", branchId: pkgD ? pkgD.PackageID : 0,
            writeCheck: pkgD ? wcEl(obj, "diagram") : { ok: false, code: "E_NOT_FOUND", note: "package diagramu nenalezen" } };
    } else if (prop(obj, "AttributeGUID") != null || prop(obj, "MethodGUID") != null) {
        var isAttr = (prop(obj, "AttributeGUID") != null);
        var parEl = null;
        try { parEl = Repository.GetElementByID(parseInt(obj.ParentID, 10)); } catch (ePar) { parEl = null; }
        if (parEl != null) {
            ctxInfo = elCtx(parEl, isAttr ? "Attribute" : "Operation",
                isAttr ? obj.AttributeGUID : obj.MethodGUID,
                isAttr ? obj.AttributeID : obj.MethodID, obj.Name);
        }
    }
    if (ctxInfo != null) { r.selected = true; r.context = ctxInfo; }
}
// multi-vyber elementu (Ctrl+klik v browseru)
try {
    var coll = Repository.GetTreeSelectedElements();
    if (coll != null) {
        var n = coll.Count;
        for (var i = 0; i < n && i < 50; i++) {
            var el2 = coll.GetAt(i);
            r.selectedElements.push({ guid: "" + el2.ElementGUID, id: el2.ElementID,
                name: "" + el2.Name, type: "" + el2.Type });
        }
    }
} catch (eMs) { }
// otevreny (aktivni) diagram
try {
    var dg = Repository.GetCurrentDiagram();
    if (dg != null) {
        r.currentDiagram = { guid: "" + dg.DiagramGUID, id: dg.DiagramID,
            name: "" + dg.Name, type: "" + dg.Type };
    }
} catch (eDg) { }
if (!r.selected && r.selectedElements.length == 0 && r.currentDiagram == null) {
    r.message = "V Project browseru neni nic vybrano a zadny diagram neni aktivni - zadej cil explicitne (GUID/jmeno), nebo pozadej uzivatele o vyber.";
}
return r;
