// AICodeBridge.FB_OpPackage(Repository, op, reqId)
// create_or_update_package - zrcadlo MCP toolu. Podporuje i davku (packages[]).
// op.packages = [ {
//   guid | packageID   -> UPDATE; jinak CREATE
//   parent             -> rodicovsky package pro create ("{GUID}" | id | jmeno | $ref)
//   name               -> jmeno (povinne na create)
//   notes | description, notes_b64
//   author, version    -> bonus K6
//   taggedValues       -> pole [{name, value}] - zapisuje se na pkg.Element
//                         (root/top-level packages TV mit NEMOHOU - limit EA, par. 7)
// } ]
// Pozn.: intermitentni selhani create_or_update_package znane z MCP (N-K4-1)
// je duvod, proc vysledek vzdy obsahuje guid+id k okamzite kontrole.
var list = null;
if (op && op.packages && Object.prototype.toString.call(op.packages) == "[object Array]") { list = op.packages; }
else if (op && (op.name || op.guid || op.packageID)) { list = [op]; } // zkraceny zapis pro jediny package
if (!list || list.length == 0) {
    return { op: "create_or_update_package", status: "error", code: "E_ARGS", message: "Povinne: packages (pole) nebo primo name/parent." };
}
var items = [], warns = [];
for (var i = 0; i < list.length; i++) {
    var p = list[i];
    var pkg = null, created = false;
    if (p.guid || p.packageID) {
        pkg = this.FB_ResolvePkg(Repository, p.guid || p.packageID);
        if (pkg == null) { return { op: "create_or_update_package", status: "error", code: "E_NOT_FOUND", message: "packages[" + i + "]: package nenalezen.", items: items }; }
        var chkU = this.FB_CheckWrite(Repository, pkg);
        if (chkU != null) { return { op: "create_or_update_package", status: "error", code: chkU.code, message: "packages[" + i + "]: " + chkU.message, items: items }; }
    } else {
        if (!p.name || !p.parent) {
            return { op: "create_or_update_package", status: "error", code: "E_ARGS", message: "packages[" + i + "]: create vyzaduje name a parent.", items: items };
        }
        var parent = this.FB_ResolvePkg(Repository, p.parent);
        if (parent == null) { return { op: "create_or_update_package", status: "error", code: "E_NOT_FOUND", message: "packages[" + i + "]: parent nenalezen (" + p.parent + ")", items: items }; }
        var chkC = this.FB_CheckWrite(Repository, parent);
        if (chkC != null) { return { op: "create_or_update_package", status: "error", code: chkC.code, message: "packages[" + i + "]: " + chkC.message, items: items }; }
        pkg = parent.Packages.AddNew("" + p.name, "Package");
        if (!pkg.Update()) { return { op: "create_or_update_package", status: "error", code: "E_EXCEPTION", message: "packages[" + i + "]: Update selhal: " + pkg.GetLastError(), items: items }; }
        parent.Packages.Refresh();
        created = true;
    }
    if (!created && typeof p.name != "undefined" && p.name !== null) { pkg.Name = "" + p.name; }
    if (p.notes_b64) { pkg.Notes = this.B64Decode(p.notes_b64); }
    else if (typeof p.notes != "undefined") { pkg.Notes = "" + p.notes; }
    else if (typeof p.description != "undefined") { pkg.Notes = "" + p.description; }
    if (!pkg.Update()) { return { op: "create_or_update_package", status: "error", code: "E_EXCEPTION", message: "packages[" + i + "]: Update selhal: " + pkg.GetLastError(), items: items }; }
    // TV + razitka + K6 na podkladovem elementu package (root package Element nema)
    var pel = null;
    try { pel = pkg.Element; } catch (ePE) { pel = null; }
    if (pel != null) {
        if (typeof p.author != "undefined") { pel.Author = "" + p.author; pel.Update(); }   // K6
        if (typeof p.version != "undefined") { pel.Version = "" + p.version; pel.Update(); } // K6
        var w2 = this.FB_TagWrite(Repository, pel, p.taggedValues);
        for (var wj = 0; wj < w2.length; wj++) { warns.push("packages[" + i + "]: " + w2[wj]); }
        if (created) { this.SetTag(pel, "ai.channel", "eafb"); }
        this.SetTag(pel, "ai.request", "" + reqId);
    } else if (p.taggedValues) {
        warns.push("packages[" + i + "]: root package nema podkladovy element - TV nelze zapsat (limit EA).");
    }
    items.push({ guid: "" + pkg.PackageGUID, id: pkg.PackageID, name: "" + pkg.Name, created: created });
}
var res = { op: "create_or_update_package", status: "ok", count: items.length, items: items };
if (items.length > 0) { res.guid = items[0].guid; res.id = items[0].id; }
if (warns.length > 0) { res.warnings = warns; }
return res;
