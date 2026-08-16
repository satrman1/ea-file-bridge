// AICodeBridge.FB_TagRead(Repository, obj)
// Precte tagged values objektu (Element, Connector, Attribute, Method).
// RefGUID hodnoty "{...}" vraci ROZPRAZENE: { name, value, ref: { type, id, name } }
// - shodne chovani jako MCP (emr-zapis-pravidla.md par. 7h "GUID tagged values
// se ctou rozprazene"), aby QA kontroly fungovaly bez SQL.
var out = [];
var col = null;
try { col = obj.TaggedValues; } catch (e0) { return out; }
if (col == null) { return out; }
for (var i = 0; i < col.Count; i++) {
    var tv = col.GetAt(i);
    var item = { name: "" + tv.Name, value: "" + tv.Value };
    var v = item.value.replace(/^\s+|\s+$/g, "");
    if (/^\{[0-9A-Fa-f-]{36}\}$/.test(v)) {
        var ref = null;
        try { var e1 = Repository.GetElementByGuid(v); if (e1 != null) { ref = { type: "Element", id: e1.ElementID, name: "" + e1.Name }; } } catch (x1) { }
        if (ref == null) { try { var m1 = Repository.GetMethodByGuid(v); if (m1 != null) { ref = { type: "Operation", id: m1.MethodID, name: "" + m1.Name }; } } catch (x2) { } }
        if (ref == null) { try { var a1 = Repository.GetAttributeByGuid(v); if (a1 != null) { ref = { type: "Attribute", id: a1.AttributeID, name: "" + a1.Name }; } } catch (x3) { } }
        if (ref == null) { try { var c1 = Repository.GetConnectorByGuid(v); if (c1 != null) { ref = { type: "Connector", id: c1.ConnectorID, name: "" + c1.Name }; } } catch (x4) { } }
        if (ref == null) { try { var p1 = Repository.GetPackageByGuid(v); if (p1 != null) { ref = { type: "Package", id: p1.PackageID, name: "" + p1.Name }; } } catch (x5) { } }
        if (ref == null) { try { var d1 = Repository.GetDiagramByGuid(v); if (d1 != null) { ref = { type: "Diagram", id: d1.DiagramID, name: "" + d1.Name }; } } catch (x6) { } }
        if (ref != null) { item.ref = ref; }
    }
    out.push(item);
}
return out;
