// AICodeBridge.FB_OpCloneElements(Repository, op, reqId)
// clone_elements (K3) - klon elementu (klon NESE kod/vlastnosti byte-presne,
// lekce GuiShowcase). Znamy limit z MCP ery: klon bez owned diagramu -
// chovani Element.Clone() overit E2E, vysledek vykazat.
// op.elements = [ "{GUID}" | id | $ref, ... ]
// op.package  = cilovy package (volitelne - jinak klon zustava ve zdrojovem)
// v0.8 (iterace 4b V2, migrace E_QUOTA dle zadani par. 6.4/W6): kvotu kryje
// RISK GATE (klony ELEVATED -> lidske potvrzeni), E_QUOTA se uz NEVYDAVA;
// op.confirm ztratilo ucinek (FB_Main odstrani + warning). Objem se dal
// VZDY vykazuje (volume).
if (!op || !op.elements || Object.prototype.toString.call(op.elements) != "[object Array]" || op.elements.length == 0) {
    return { op: "clone_elements", status: "error", code: "E_ARGS", message: "Povinne: elements (neprazdne pole)." };
}
var targetPkg = null;
if (op["package"]) {
    targetPkg = this.FB_ResolvePkg(Repository, op["package"]);
    if (targetPkg == null) { return { op: "clone_elements", status: "error", code: "E_NOT_FOUND", message: "Cilovy package nenalezen: " + op["package"] }; }
    var chkT = this.FB_CheckWrite(Repository, targetPkg);
    if (chkT != null) { return { op: "clone_elements", status: "error", code: chkT.code, message: chkT.message }; }
}
var items = [];
for (var i = 0; i < op.elements.length; i++) {
    var el = this.FB_ResolveEl(Repository, op.elements[i]);
    if (el == null) { return { op: "clone_elements", status: "error", code: "E_NOT_FOUND", message: "elements[" + i + "]: element nenalezen (" + op.elements[i] + ")", items: items }; }
    if (targetPkg == null) {
        var chkS = this.FB_CheckWrite(Repository, Repository.GetPackageByID(el.PackageID));
        if (chkS != null) { return { op: "clone_elements", status: "error", code: chkS.code, message: "elements[" + i + "]: " + chkS.message, items: items }; }
    }
    var cl = null;
    try {
        cl = el.Clone();
    } catch (e) {
        return { op: "clone_elements", status: "error", code: "E_EXCEPTION", message: "elements[" + i + "]: Element.Clone() selhal: " + e.message, items: items };
    }
    if (cl == null) { return { op: "clone_elements", status: "error", code: "E_EXCEPTION", message: "elements[" + i + "]: Clone() nevratil element.", items: items }; }
    if (targetPkg != null && cl.PackageID != targetPkg.PackageID) {
        cl.PackageID = targetPkg.PackageID;
        if (!cl.Update()) {
            return { op: "clone_elements", status: "error", code: "E_EXCEPTION", message: "elements[" + i + "]: presun klonu selhal: " + cl.GetLastError(), items: items };
        }
    }
    this.SetTag(cl, "ai.channel", "eafb");
    this.SetTag(cl, "ai.request", "" + reqId);
    // vykazat, zda klon prenesl owned diagramy (znamy MCP limit)
    var ownedDiagrams = 0;
    try { ownedDiagrams = cl.Diagrams.Count; } catch (eD) { }
    items.push({ guid: "" + cl.ElementGUID, id: cl.ElementID, name: "" + cl.Name,
        sourceID: el.ElementID, ownedDiagrams: ownedDiagrams });
}
var res = { op: "clone_elements", status: "ok", count: items.length, items: items, volume: { elements: items.length } };
if (items.length > 0) { res.guid = items[0].guid; res.id = items[0].id; }
return res;
