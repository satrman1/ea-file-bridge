// AICodeBridge.FB_ScopeCheck(Repository, kind, ref)
// KONTROLA CILE ZAPISU podle ID/GUID (zadani cil zapisu v1.1 kap. 5.3) - jadro,
// ktere sdili predbezna kontrola P2 (jen SQL, zadne Automation objekty) a
// FB_CheckWrite / FB_CheckWriteEl pri provedeni. kind = "package" | "element"
// | "diagram"; ref = Package_ID / Object_ID / Diagram_ID (cislo) nebo GUID.
// Poradi: (1) repozitar ma polozku ve FB_WriteScope, jinak E_REPO; (2)
// konfigurace v poradku, jinak E_SCOPE_CONFIG; (3) DEDICNA ochrana - cilovy
// balicek nebo kterykoli predek (strop 60) je na blacklistu / balicek auditu /
// balicek add-inu -> E_BLACKLIST; u prvku a diagramu navic OSA VLASTNIKU (I14):
// prvek vlastneny chranenym prvkem je chraneny, i kdyby po rucnim presunu lezel
// ve volnem balicku. (4) Ochrana uzlu korene (B1) se tu NEDELA - tyka se jen
// operaci, jejichz cilem JE koren (FB_OpPackage, FB_OpDelete, FB_RiskGate).
// Vraci null (povoleno) nebo { code, message, branch{kind, guid, name, path,
// note, allowIncomingRefs}, target{kind, id, path} }. Vysledek se uklada do
// mezipameti volani (FB_WriteScopeCfg.checked). Nenalezeny cil = E_NOT_FOUND.
// Dohledani jde pres FB_TargetCache (SQL) s nahradou Automation (mock/EA
// runtime bez SQL pravidel) - chyba cteni predka = fail-closed E_EXCEPTION.
var self = this;
var cfg = this.FB_WriteScopeCfg(Repository);
if (!cfg.repoKnown) {
    return { code: "E_REPO", message: "Pripojeny repozitar nema polozku ve FB_WriteScope - zapis zamitnut. Identita: "
        + cfg.repoId + " | Pripojeni: " + Repository.ConnectionString };
}
if (cfg.problems.length > 0) {
    return { code: "E_SCOPE_CONFIG", message: "Konfigurace cile zapisu (FB_WriteScope / FB_Config) je vadna - vsechny zapisy v repozitari jsou zastavene, cteni bezi. Vady: "
        + cfg.problems.join(" | ") + " Opravu dela spravce (doma deploy_src, v bance bootstrap; NAVOD-NASAZENI-KLIKACI kap. 5.2).", problems: cfg.problems };
}
var k = ("" + (kind || "package")).toLowerCase();
var t = ("" + (ref === null || typeof ref == "undefined" ? "" : ref)).replace(/^\s+|\s+$/g, "");
if (t == "") { return { code: "E_NOT_FOUND", message: "Cil kontroly zapisu neni zadan." }; }
var bucket = (k == "element") ? cfg.checked.el : ((k == "diagram") ? cfg.checked.dgm : cfg.checked.pkg);
if (typeof bucket[t] != "undefined") { return bucket[t]; }
function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
function pkgRow(r) {
    var row = null;
    try { row = self.FB_TargetCache(Repository, "package", r); } catch (eT) { row = null; }
    if (row != null) { return row; }
    var po = null;
    try {
        var s = "" + r;
        if (s.charAt(0) == "{") { po = Repository.GetPackageByGuid(s); }
        else if (/^[0-9]+$/.test(s)) { po = Repository.GetPackageByID(parseInt(s, 10)); }
    } catch (eP) { po = null; }
    if (!po) { return null; }
    var pid = 0; try { pid = num(po.ParentID); } catch (eI) { pid = 0; }
    return { guid: "" + po.PackageGUID, id: num(po.PackageID), parentId: pid, name: "" + po.Name };
}
function elRow(r) {
    var row = null;
    try { row = self.FB_TargetCache(Repository, "element", r); } catch (eT) { row = null; }
    if (row != null) { return row; }
    var eo = null;
    try {
        var s = "" + r;
        if (s.charAt(0) == "{") { eo = Repository.GetElementByGuid(s); }
        else if (/^[0-9]+$/.test(s)) { eo = Repository.GetElementByID(parseInt(s, 10)); }
    } catch (eE) { eo = null; }
    if (!eo) { return null; }
    var par = 0; try { par = num(eo.ParentID); } catch (eI2) { par = 0; }
    return { guid: "" + eo.ElementGUID, id: num(eo.ElementID), pkgId: num(eo.PackageID), parentId: par, type: "" + eo.Type, name: "" + eo.Name };
}
function dgmRow(r) {
    var row = null;
    try { row = self.FB_TargetCache(Repository, "diagram", r); } catch (eT) { row = null; }
    if (row != null) { return row; }
    var dg = null;
    try {
        var s = "" + r;
        if (s.charAt(0) == "{") { dg = Repository.GetDiagramByGuid(s); }
        else if (/^[0-9]+$/.test(s)) { dg = Repository.GetDiagramByID(parseInt(s, 10)); }
    } catch (eD) { dg = null; }
    if (!dg) { return null; }
    var pard = 0; try { pard = num(dg.ParentID); } catch (eI3) { pard = 0; }
    return { guid: "" + dg.DiagramGUID, id: num(dg.DiagramID), pkgId: num(dg.PackageID), parentId: pard, name: "" + dg.Name };
}
function pkgPath(row) {
    var parts = [], cur = row, guard = 0;
    while (cur && guard++ < 60) {
        parts.unshift("" + cur.name);
        if (!cur.parentId || cur.parentId <= 0) { break; }
        cur = pkgRow("" + cur.parentId);
    }
    return parts.join(".");
}
function blocked(branch, targetKind, targetId, targetPath, via) {
    var msg = "E_BLACKLIST: cil " + targetPath + " (" + targetKind + (targetId ? " " + targetId : "") + ")"
        + (via ? " " + via : "") + " lezi v chranene vetvi '" + branch.path + "' (" + branch.kind + (branch.note ? ": " + branch.note : "")
        + "). Bridge sem nezapisuje - davku neopakuj ani nedel, pozadej cloveka o jiny cil.";
    return { code: "E_BLACKLIST", message: msg,
             branch: { kind: branch.kind, guid: branch.guid, name: branch.name, path: branch.path, note: branch.note, allowIncomingRefs: branch.allowIncomingRefs },
             target: { kind: targetKind, id: targetId, path: targetPath } };
}
// dedicna ochrana po ose balicku: vraci { branch } nebo null; { error } pri selhani
function pkgAxis(startRow) {
    var cur = startRow, guard = 0;
    while (cur && guard++ < 60) {
        var pr = cfg.protectedIds["" + cur.id];
        if (pr) { return { branch: pr }; }
        if (!cur.parentId || cur.parentId <= 0) { return null; }
        var next = pkgRow("" + cur.parentId);
        if (next == null) { return { error: "predek balicku " + cur.parentId + " nelze dohledat" }; }
        cur = next;
    }
    return null;
}
var res = null;
if (k == "package") {
    var prow = pkgRow(t);
    if (prow == null) { res = { code: "E_NOT_FOUND", message: "Cilovy package nenalezen (" + t + ")." }; }
    else {
        var ax = pkgAxis(prow);
        if (ax && ax.error) { res = { code: "E_EXCEPTION", message: "Kontrola cile zapisu selhala (fail-closed): " + ax.error }; }
        else if (ax) { res = blocked(ax.branch, "package", prow.id, pkgPath(prow), ""); }
    }
} else {
    var row0 = (k == "element") ? elRow(t) : dgmRow(t);
    if (row0 == null) { res = { code: "E_NOT_FOUND", message: (k == "element" ? "Element" : "Diagram") + " nenalezen (" + t + ")." }; }
    else {
        var prow2 = pkgRow("" + row0.pkgId);
        var tpath = (prow2 ? pkgPath(prow2) + "." : "") + row0.name;
        if (prow2 == null) { res = { code: "E_EXCEPTION", message: "Kontrola cile zapisu selhala (fail-closed): balicek " + row0.pkgId + " cile " + t + " nelze dohledat" }; }
        else {
            var ax2 = pkgAxis(prow2);
            if (ax2 && ax2.error) { res = { code: "E_EXCEPTION", message: "Kontrola cile zapisu selhala (fail-closed): " + ax2.error }; }
            else if (ax2) { res = blocked(ax2.branch, k, row0.id, tpath, ""); }
        }
        // osa vlastniku (I14): vlastnik prvku/diagramu v chranene casti
        var own = row0.parentId, g2 = 0;
        while (res == null && own && own > 0 && g2++ < 60) {
            var orow = elRow("" + own);
            if (orow == null) { res = { code: "E_EXCEPTION", message: "Kontrola cile zapisu selhala (fail-closed): vlastnik " + own + " cile " + t + " nelze dohledat" }; break; }
            var oprow = pkgRow("" + orow.pkgId);
            if (oprow == null) { res = { code: "E_EXCEPTION", message: "Kontrola cile zapisu selhala (fail-closed): balicek vlastnika " + own + " nelze dohledat" }; break; }
            var ax3 = pkgAxis(oprow);
            if (ax3 && ax3.error) { res = { code: "E_EXCEPTION", message: "Kontrola cile zapisu selhala (fail-closed): " + ax3.error }; break; }
            if (ax3) { res = blocked(ax3.branch, k, row0.id, tpath, "(vlastnik '" + orow.name + "' je v chranene casti)"); break; }
            own = orow.parentId;
        }
    }
}
bucket[t] = res;
return res;
