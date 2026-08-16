// AICodeBridge.FB_OpBaselineList(Repository, op)
// get_baselines (K5, cteci cast) - vypis baselines package.
// op.package = "{GUID}" | packageID | jmeno
// Vraci parsovany seznam { guid, version, notes, date } + surove XML (raw)
// pro pripad, ze EA verze vraci dalsi atributy.
if (!op || !op["package"]) {
    return { op: "get_baselines", status: "error", code: "E_ARGS", message: "Povinne: package." };
}
var pkg = this.FB_ResolvePkg(Repository, op["package"]);
if (pkg == null) { return { op: "get_baselines", status: "error", code: "E_NOT_FOUND", message: "Package nenalezen: " + op["package"] }; }
var pi = Repository.GetProjectInterface();
var xml = "";
try {
    xml = "" + pi.GetBaselines(pi.GUIDtoXML("" + pkg.PackageGUID), "");
} catch (e) {
    return { op: "get_baselines", status: "error", code: "E_EXCEPTION", message: "GetBaselines selhal: " + e.message };
}
var items = [];
var re = /<baseline\s+([^>]*)\/?>/gi, m;
function attr(s, n) { var am = new RegExp(n + '="([^"]*)"', "i").exec(s); return am ? am[1] : ""; }
while ((m = re.exec(xml)) != null) {
    items.push({ guid: attr(m[1], "guid"), version: attr(m[1], "version"),
        notes: attr(m[1], "notes"), date: attr(m[1], "date") });
}
return { op: "get_baselines", status: "ok", packageGuid: "" + pkg.PackageGUID, count: items.length, items: items, raw: xml };
