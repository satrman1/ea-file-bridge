// AICodeBridge.FB_TagWrite(Repository, obj, tvs)
// Zapis tagged values na objekt s kolekci TaggedValues (Element, Connector,
// Attribute, Method). Polozka: { name, value } NEBO RefGUID struktura
// { name, ids: [ { type: "Operation|Element|Attribute|Connector|Package|Diagram", id: 68 } ] }
// (konvence emr-zapis-pravidla.md par. 7h) - id se rozresolvuje na "{GUID}".
// Vraci pole varovani (prazdne = vse OK). Nevyhazuje - chybejici cil refGUID
// je varovani, ne pad davky.
var warns = [];
if (!tvs || Object.prototype.toString.call(tvs) != "[object Array]") { return warns; }
for (var i = 0; i < tvs.length; i++) {
    var tv = tvs[i];
    if (!tv || !tv.name) { warns.push("taggedValues[" + i + "]: chybi name - preskoceno"); continue; }
    var val = "";
    if (tv.ids && Object.prototype.toString.call(tv.ids) == "[object Array]") {
        var guids = [];
        for (var j = 0; j < tv.ids.length; j++) {
            var ref = tv.ids[j];
            var g = "";
            try {
                var rt = ("" + (ref && ref.type ? ref.type : "Element")).toUpperCase();
                var rid = parseInt(ref.id, 10);
                if (rt == "OPERATION") { g = "" + Repository.GetMethodByID(rid).MethodGUID; }
                else if (rt == "ELEMENT") { g = "" + Repository.GetElementByID(rid).ElementGUID; }
                else if (rt == "ATTRIBUTE") { g = "" + Repository.GetAttributeByID(rid).AttributeGUID; }
                else if (rt == "CONNECTOR") { g = "" + Repository.GetConnectorByID(rid).ConnectorGUID; }
                else if (rt == "PACKAGE") { g = "" + Repository.GetPackageByID(rid).PackageGUID; }
                else if (rt == "DIAGRAM") { g = "" + Repository.GetDiagramByID(rid).DiagramGUID; }
            } catch (e) { g = ""; }
            if (g == "") { warns.push("taggedValues '" + tv.name + "': ids[" + j + "] se nepodarilo rozresolvovat"); }
            else { guids.push(g); }
        }
        if (guids.length == 0) { continue; }
        val = guids.join(",");
    } else {
        val = "" + (typeof tv.value == "undefined" ? "" : tv.value);
    }
    this.SetTag(obj, "" + tv.name, val);
}
return warns;
