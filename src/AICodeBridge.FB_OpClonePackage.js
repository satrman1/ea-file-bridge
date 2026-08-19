// AICodeBridge.FB_OpClonePackage(Repository, op, reqId)
// clone_package (K3) - klon package pro verzovaci/release cyklus (_AREL forma).
// v0.8 (iterace 4b V2, migrace E_QUOTA dle zadani par. 6.4/W6): kvotu klonu
// pokryva RISK GATE - klony jsou v politice ELEVATED (lidske potvrzeni nad
// skutecnym payloadem), E_QUOTA se uz NEVYDAVA. Pole op.confirm ztratilo
// ucinek - FB_Main ho odstrani a prida warning (stara davka nespadne na
// chybu). Objem se dal VZDY vykazuje (volume) - ladeni limitu politiky.
// op.package = zdrojovy package ("{GUID}" | id | jmeno)
// op.name    = jmeno klonu (volitelne - prejmenuje po klonu)
// Klon vznika VEDLE zdroje (stejny rodic) - chovani Package.Clone().
if (!op || !op["package"]) {
    return { op: "clone_package", status: "error", code: "E_ARGS", message: "Povinne: package." };
}
var pkg = this.FB_ResolvePkg(Repository, op["package"]);
if (pkg == null) { return { op: "clone_package", status: "error", code: "E_NOT_FOUND", message: "Package nenalezen: " + op["package"] }; }
// klon vznika ve stejnem rodici -> whitelist na zdrojovy package (jeho vetev)
var chk = this.FB_CheckWrite(Repository, pkg);
if (chk != null) { return { op: "clone_package", status: "error", code: chk.code, message: chk.message }; }
// --- kvota: pocet elementu v podstromu (rekurzivne pres t_package, jen cteni) ---
var total = 0, pkgCount = 0;
var queue = [pkg.PackageID];
var seen = {};
var guard = 0;
while (queue.length > 0 && guard < 500) {
    guard++;
    var pid = queue.pop();
    if (seen[pid] == 1) { continue; }
    seen[pid] = 1;
    pkgCount++;
    var rowsE = this.FB_XmlRows(Repository.SQLQuery("SELECT COUNT(*) AS c FROM t_object WHERE Package_ID = " + pid));
    if (rowsE.length > 0) { total += parseInt(rowsE[0].c || "0", 10); }
    var rowsP = this.FB_XmlRows(Repository.SQLQuery("SELECT Package_ID FROM t_package WHERE Parent_ID = " + pid));
    for (var i = 0; i < rowsP.length; i++) { queue.push(parseInt(rowsP[i].Package_ID, 10)); }
}
// (E_QUOTA odstranena v0.8 - kvotu kryje Risk Gate: klony ELEVATED, par. 6.4)
var cl = null;
try {
    cl = pkg.Clone();
} catch (e) {
    return { op: "clone_package", status: "error", code: "E_EXCEPTION", message: "Package.Clone() selhal: " + e.message };
}
if (cl == null) { return { op: "clone_package", status: "error", code: "E_EXCEPTION", message: "Package.Clone() nevratil package." }; }
if (op.name) {
    cl.Name = "" + op.name;
    if (!cl.Update()) {
        return { op: "clone_package", status: "error", code: "E_EXCEPTION", message: "Prejmenovani klonu selhalo: " + cl.GetLastError() };
    }
}
// razitko na podkladovy element klonu
try {
    var pel = cl.Element;
    if (pel != null) { this.SetTag(pel, "ai.channel", "eafb"); this.SetTag(pel, "ai.request", "" + reqId); }
} catch (eT) { }
return { op: "clone_package", status: "ok", guid: "" + cl.PackageGUID, id: cl.PackageID, name: "" + cl.Name,
    volume: { elements: total, packages: pkgCount },
    sourceGuid: "" + pkg.PackageGUID };
