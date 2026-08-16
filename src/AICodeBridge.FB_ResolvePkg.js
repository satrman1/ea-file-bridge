// AICodeBridge.FB_ResolvePkg(Repository, ref)
// Najde package podle "{GUID}" | packageID (cislice) | jmena (SQL lookup).
// Vraci Package nebo null. Sdileny resolver pro vsechny operace.
var t = ("" + (ref === null || typeof ref == "undefined" ? "" : ref)).replace(/^\s+|\s+$/g, "");
if (t == "") { return null; }
var pkg = null;
try {
    if (t.charAt(0) == "{") {
        pkg = Repository.GetPackageByGuid(t);
    } else if (/^[0-9]+$/.test(t)) {
        pkg = Repository.GetPackageByID(parseInt(t, 10));
    } else {
        var xml = Repository.SQLQuery("SELECT ea_guid FROM t_package WHERE Name = '" + t.replace(/'/g, "''") + "'");
        var mm = /<ea_guid>([^<]+)<\/ea_guid>/i.exec(xml);
        if (mm) { pkg = Repository.GetPackageByGuid(mm[1]); }
    }
} catch (e) {
    pkg = null;
}
return pkg;
