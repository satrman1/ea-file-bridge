// AICodeBridge.FB_CheckWrite(Repository, pkg)
// Spolecna kontrola zapisu do BALICKU - rezim BLACKLIST (zadani cil zapisu
// v1.1 kap. 5.3, Z261004b-10; do v0.16 whitelist). Signatura i tvar navratu
// zustavaji (null = povoleno, jinak { code, message }), takze ~50 volajicich
// mist se nemeni. Poradi: (1) repozitar ma polozku ve FB_WriteScope, jinak
// E_REPO; (2) konfigurace v poradku, jinak E_SCOPE_CONFIG; (3) DEDICNA ochrana
// - balicek nebo kterykoli predek (strop 60) na blacklistu / balicek auditu /
// balicek add-inu -> E_BLACKLIST (zprava nese plnou cestu cile, chranene
// vetve a note); (4) jinak povoleno - o zbytku rozhodne EA security pri
// zapisu (E_PERMISSION / E_LOCKED). Koreny modelu jsou chranene jen jako uzel
// (B1) - resi operace, ktere na koren miri (FB_OpPackage, FB_OpDelete).
// Pro PRVKY a DIAGRAMY (osa vlastniku, I14) volej FB_CheckWriteEl.
// Jadro = FB_ScopeCheck (mezipamet jednoho volani sdilena s P2 a zalohou).
if (pkg == null) {
    return { code: "E_NOT_FOUND", message: "Cilovy package nenalezen." };
}
var pid = 0;
try { pid = parseInt(pkg.PackageID, 10); } catch (eI) { pid = 0; }
var ref = (pid > 0) ? ("" + pid) : "";
if (ref == "") { try { ref = "" + pkg.PackageGUID; } catch (eG) { ref = ""; } }
var r = null;
try { r = this.FB_ScopeCheck(Repository, "package", ref); }
catch (eS) { r = { code: "E_EXCEPTION", message: "Kontrola cile zapisu selhala (fail-closed): " + (eS && eS.message ? eS.message : eS) }; }
if (r != null && r.code == "E_NOT_FOUND") {
    // balicek existuje jako objekt (volajici ho ma v ruce), ale neni v SQL ani
    // Automation - nejspis cerstve zalozeny v teto davce bez radku v mezipameti:
    // kontrola po rodici (novy balicek dedi ochranu rodice)
    var parentId = 0;
    try { parentId = parseInt(pkg.ParentID, 10); } catch (eP) { parentId = 0; }
    if (parentId > 0) {
        try { r = this.FB_ScopeCheck(Repository, "package", "" + parentId); }
        catch (eS2) { r = { code: "E_EXCEPTION", message: "Kontrola cile zapisu selhala (fail-closed): " + (eS2 && eS2.message ? eS2.message : eS2) }; }
    } else { r = null; }
}
return r;
