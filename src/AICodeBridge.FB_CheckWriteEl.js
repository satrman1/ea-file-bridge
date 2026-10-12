// AICodeBridge.FB_CheckWriteEl(Repository, obj, kind)
// Kontrola zapisu do PRVKU nebo DIAGRAMU (zadani cil zapisu v1.1 kap. 5.3,
// I14 - osa vlastniku): krome balicku objektu (osa balicku, jako
// FB_CheckWrite) se jde i po retezu vlastniku (ParentID prvku, strop 60) -
// prvek vlastneny chranenym prvkem je chraneny, i kdyby po rucnim presunu
// lezel ve volnem balicku. obj = EA.Element / EA.Diagram (Automation objekt);
// kind = "element" (vychozi) | "diagram". Tvar navratu jako FB_CheckWrite:
// null = povoleno, jinak { code, message }. Jadro = FB_ScopeCheck (mezipamet
// jednoho volani). Objekt bez ID (cerstve zalozeny) -> kontrola po balicku
// a vlastnikovi z objektu.
if (obj == null) { return { code: "E_NOT_FOUND", message: "Cilovy prvek nenalezen." }; }
var k = (typeof kind == "string" && kind.toLowerCase() == "diagram") ? "diagram" : "element";
var id = 0;
try { id = parseInt(k == "diagram" ? obj.DiagramID : obj.ElementID, 10); } catch (eI) { id = 0; }
if (isNaN(id)) { id = 0; }
var r = null;
if (id > 0) {
    try { r = this.FB_ScopeCheck(Repository, k, "" + id); }
    catch (eS) { r = { code: "E_EXCEPTION", message: "Kontrola cile zapisu selhala (fail-closed): " + (eS && eS.message ? eS.message : eS) }; }
}
if (id <= 0 || (r != null && r.code == "E_NOT_FOUND")) {
    // objekt bez radku (cerstve zalozeny v teto davce): balicek + vlastnik z objektu
    var pkgId = 0, parentId = 0;
    try { pkgId = parseInt(obj.PackageID, 10); } catch (eP) { pkgId = 0; }
    try { parentId = parseInt(obj.ParentID, 10); } catch (eO) { parentId = 0; }
    r = null;
    if (pkgId > 0) {
        try { r = this.FB_ScopeCheck(Repository, "package", "" + pkgId); }
        catch (eS2) { r = { code: "E_EXCEPTION", message: "Kontrola cile zapisu selhala (fail-closed): " + (eS2 && eS2.message ? eS2.message : eS2) }; }
    }
    if (r == null && parentId > 0) {
        try { r = this.FB_ScopeCheck(Repository, "element", "" + parentId); }
        catch (eS3) { r = { code: "E_EXCEPTION", message: "Kontrola cile zapisu selhala (fail-closed): " + (eS3 && eS3.message ? eS3.message : eS3) }; }
        if (r != null && r.code == "E_NOT_FOUND") { r = null; }
    }
}
return r;
