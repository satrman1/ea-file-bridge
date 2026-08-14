// AICodeBridge.FindTargetMethod(Repository, targetGuid, opName)
// Najde operaci opName na cilovem elementu. targetGuid akceptuje:
// GUID "{...}", elementID (jen cislice), nebo jmeno elementu (SQL lookup).
// Duvod: MCP nevydava GUIDy, AI adresuje cile pres elementID.
var el = null;
var t = ("" + targetGuid).replace(/^\s+|\s+$/g, "");
try {
    if (t.charAt(0) == "{") {
        el = Repository.GetElementByGuid(t);
    } else if (/^[0-9]+$/.test(t)) {
        el = Repository.GetElementByID(parseInt(t, 10));
    } else {
        var xml = Repository.SQLQuery("SELECT ea_guid FROM t_object WHERE Name = '" + t + "'");
        var mm = /<ea_guid>([^<]+)<\/ea_guid>/i.exec(xml);
        if (mm) {
            el = Repository.GetElementByGuid(mm[1]);
        }
    }
} catch (e) {
    el = null;
}
if (el == null) {
    return null;
}
for (var i = 0; i < el.Methods.Count; i++) {
    var m = el.Methods.GetAt(i);
    if (m.Name == opName) {
        return m;
    }
}
return null;
