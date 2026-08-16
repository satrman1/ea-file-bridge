// AICodeBridge.FB_OpBaselineCreate(Repository, op, reqId)
// create_baseline (K5) - explicitni mikro-baseline per package PRED zapisem
// do existujici package (par. 12c). Na rozdil od domaciho MCP baseline
// NESE JMENO: default "AI-pre-<session>-<batch>" (limit bezejmenne MCP
// baseline u bridge odpada). Session baseline pri startu pumpy
// (FB_SessionStart) timto neni dotcena.
// op.package = "{GUID}" | packageID | jmeno | $ref
// op.name    = verze baseline (default "AI-pre-<op.session|S>-<reqId>")
// op.session = oznaceni session pro default jmeno
// op.notes   = poznamka baseline
// POZN: apply_baseline se NEIMPLEMENTUJE - trvale vylouceno (par. 12a, kap. 6 zadani).
if (!op || !op["package"]) {
    return { op: "create_baseline", status: "error", code: "E_ARGS", message: "Povinne: package." };
}
var pkg = this.FB_ResolvePkg(Repository, op["package"]);
if (pkg == null) { return { op: "create_baseline", status: "error", code: "E_NOT_FOUND", message: "Package nenalezen: " + op["package"] }; }
var chk = this.FB_CheckWrite(Repository, pkg);
if (chk != null) { return { op: "create_baseline", status: "error", code: chk.code, message: chk.message }; }
var name = (op.name && ("" + op.name) != "") ? ("" + op.name)
    : ("AI-pre-" + (op.session ? "" + op.session : "S") + "-" + reqId);
var notes = (typeof op.notes != "undefined") ? ("" + op.notes)
    : ("EA File Bridge - mikro-baseline pred zapisem (davka " + reqId + ")");
var pi = Repository.GetProjectInterface();
var okB = false;
try {
    okB = pi.CreateBaseline(pi.GUIDtoXML("" + pkg.PackageGUID), name, notes);
} catch (e) {
    return { op: "create_baseline", status: "error", code: "E_EXCEPTION", message: "CreateBaseline selhal: " + e.message };
}
if (!okB) {
    return { op: "create_baseline", status: "error", code: "E_EXCEPTION", message: "CreateBaseline vratil false (" + pkg.Name + ")." };
}
// GUID nove baseline dohledame ve vypisu (posledni se shodnou verzi)
var bguid = "";
try {
    var xml = "" + pi.GetBaselines(pi.GUIDtoXML("" + pkg.PackageGUID), "");
    var re = /<baseline\s+([^>]*)>/gi, m, last = null;
    while ((m = re.exec(xml)) != null) {
        var attrs = m[1];
        var vm = /version="([^"]*)"/i.exec(attrs);
        if (vm && vm[1] == name) { last = attrs; }
    }
    if (last != null) {
        var gm = /guid="([^"]*)"/i.exec(last);
        if (gm) { bguid = gm[1]; }
    }
} catch (e2) { }
return { op: "create_baseline", status: "ok", packageGuid: "" + pkg.PackageGUID, packageID: pkg.PackageID,
    name: name, baselineGuid: bguid, guid: bguid };
