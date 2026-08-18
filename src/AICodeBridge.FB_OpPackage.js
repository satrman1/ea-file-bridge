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
//   matchByName: true  -> OPT-IN (audit B2, K1): pred create hledani dle jmena
//                         OMEZENE na parent (t_package.Parent_ID). Presne 1 nalez
//                         = UPDATE nalezeneho; >1 = E_AMBIGUOUS. Default off -
//                         chovani stavajicich davek se NEMENI.
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
    var pkg = null, created = false, matchedBy = "";
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
        if (p.matchByName) {
            // K1 (audit B2): scoped na parent (t_package.Parent_ID) - FB_ResolvePkg je globalni, proto vlastni dotaz
            var escN = ("" + p.name).replace(/'/g, "''");
            var rowsN;
            try {
                rowsN = this.FB_XmlRows(Repository.SQLQuery(
                    "SELECT ea_guid FROM t_package WHERE Parent_ID = " + parent.PackageID + " AND Name = '" + escN + "'"));
            } catch (eMN) {
                return { op: "create_or_update_package", status: "error", code: "E_EXCEPTION", message: "packages[" + i + "]: matchByName lookup selhal: " + eMN.message, items: items };
            }
            if (rowsN.length > 1) {
                var ambN = [];
                for (var nj = 0; nj < rowsN.length; nj++) { ambN.push("" + rowsN[nj].ea_guid); }
                return { op: "create_or_update_package", status: "error", code: "E_AMBIGUOUS",
                    message: "packages[" + i + "]: jmeno '" + p.name + "' odpovida " + rowsN.length + " packages pod parentem - rozliseni vyzaduje guid.",
                    guids: ambN, items: items };
            }
            if (rowsN.length == 1) {
                try { pkg = Repository.GetPackageByGuid("" + rowsN[0].ea_guid); } catch (eGN) { pkg = null; }
                if (pkg != null) { matchedBy = "name"; }
            }
        }
        if (pkg == null) {
            pkg = parent.Packages.AddNew("" + p.name, "Package");
            if (!pkg.Update()) { return { op: "create_or_update_package", status: "error", code: "E_EXCEPTION", message: "packages[" + i + "]: Update selhal: " + pkg.GetLastError(), items: items }; }
            parent.Packages.Refresh();
            created = true;
        }
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
    var itP = { guid: "" + pkg.PackageGUID, id: pkg.PackageID, name: "" + pkg.Name, created: created };
    if (matchedBy != "") { itP.matchedBy = matchedBy; }
    items.push(itP);
}
var res = { op: "create_or_update_package", status: "ok", count: items.length, items: items };
if (items.length > 0) { res.guid = items[0].guid; res.id = items[0].id; }
if (warns.length > 0) { res.warnings = warns; }
return res;
