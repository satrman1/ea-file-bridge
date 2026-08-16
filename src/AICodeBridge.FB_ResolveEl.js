// AICodeBridge.FB_ResolveEl(Repository, ref)
// Najde element podle "{GUID}" | elementID (cislice) | jmena (SQL lookup, prvni match).
// Vraci Element nebo null. Sdileny resolver pro vsechny operace.
var t = ("" + (ref === null || typeof ref == "undefined" ? "" : ref)).replace(/^\s+|\s+$/g, "");
if (t == "") { return null; }
var el = null;
try {
    if (t.charAt(0) == "{") {
        el = Repository.GetElementByGuid(t);
    } else if (/^[0-9]+$/.test(t)) {
        el = Repository.GetElementByID(parseInt(t, 10));
    } else {
        var xml = Repository.SQLQuery("SELECT ea_guid FROM t_object WHERE Name = '" + t.replace(/'/g, "''") + "'");
        var mm = /<ea_guid>([^<]+)<\/ea_guid>/i.exec(xml);
        if (mm) { el = Repository.GetElementByGuid(mm[1]); }
    }
} catch (e) {
    el = null;
}
return el;
