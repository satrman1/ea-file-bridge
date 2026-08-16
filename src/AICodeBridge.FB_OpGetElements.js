// AICodeBridge.FB_OpGetElements(Repository, op)
// get_elements_information - plny dump elementu vc. atributu, operaci (+parametru),
// tagged values (RefGUID rozprazene, par. 7h), konektoru, deti a owned diagramu.
// op.elements = [ "{GUID}" | elementID | jmeno | $ref, ... ]
// Volitelne op.brief = true -> jen zakladni vlastnosti (bez kolekci).
if (!op || !op.elements || Object.prototype.toString.call(op.elements) != "[object Array]" || op.elements.length == 0) {
    return { op: "get_elements_information", status: "error", code: "E_ARGS", message: "Povinne: elements (neprazdne pole referenci)." };
}
var out = [];
for (var i = 0; i < op.elements.length; i++) {
    var el = this.FB_ResolveEl(Repository, op.elements[i]);
    if (el == null) {
        return { op: "get_elements_information", status: "error", code: "E_NOT_FOUND", message: "elements[" + i + "]: element nenalezen (" + op.elements[i] + ")", items: out };
    }
    var d = {
        id: el.ElementID, guid: "" + el.ElementGUID, name: "" + el.Name,
        type: "" + el.Type, stereotypes: "" + el.StereotypeEx, alias: "" + el.Alias,
        notes: "" + el.Notes, author: "" + el.Author, version: "" + el.Version,
        status: "" + el.Status, multiplicity: "" + el.Multiplicity,
        packageID: el.PackageID, owningElementID: el.ParentID,
        classifierID: el.ClassifierID, isComposite: el.IsComposite ? true : false
    };
    if (el.ClassifierID > 0) {
        try { d.classifierName = "" + Repository.GetElementByID(el.ClassifierID).Name; } catch (eC) { }
    }
    if (!op.brief) {
        var j, k;
        d.taggedValues = this.FB_TagRead(Repository, el);
        d.attributes = [];
        for (j = 0; j < el.Attributes.Count; j++) {
            var a = el.Attributes.GetAt(j);
            var ai = { id: a.AttributeID, guid: "" + a.AttributeGUID, name: "" + a.Name, type: "" + a.Type,
                classifierID: a.ClassifierID, notes: "" + a.Notes, stereotype: "" + a.StereotypeEx,
                defaultValue: "" + a.Default, position: a.Pos };
            var atv = this.FB_TagRead(Repository, a);
            if (atv.length > 0) { ai.taggedValues = atv; }
            d.attributes.push(ai);
        }
        d.operations = [];
        for (j = 0; j < el.Methods.Count; j++) {
            var m = el.Methods.GetAt(j);
            var mi = { id: m.MethodID, guid: "" + m.MethodGUID, name: "" + m.Name,
                returnType: "" + m.ReturnType, notes: "" + m.Notes, stereotype: "" + m.StereotypeEx,
                parameters: [] };
            for (k = 0; k < m.Parameters.Count; k++) {
                var p = m.Parameters.GetAt(k);
                mi.parameters.push({ guid: "" + p.ParameterGUID, name: "" + p.Name, type: "" + p.Type,
                    notes: "" + p.Notes, defaultValue: "" + p.Default, position: parseInt("" + p.Position, 10) });
            }
            var mtv = this.FB_TagRead(Repository, m);
            if (mtv.length > 0) { mi.taggedValues = mtv; }
            d.operations.push(mi);
        }
        d.connectors = [];
        var DIRBACK = { "SOURCE -> DESTINATION": "FromSourceToTarget", "DESTINATION -> SOURCE": "FromTargetToSource",
            "BI-DIRECTIONAL": "BothDirection", "UNSPECIFIED": "Unspecified" };
        for (j = 0; j < el.Connectors.Count; j++) {
            var c = el.Connectors.GetAt(j);
            var other = (c.ClientID == el.ElementID) ? c.SupplierID : c.ClientID;
            var dirU = ("" + c.Direction).toUpperCase();
            var ci = { id: c.ConnectorID, guid: "" + c.ConnectorGUID, type: "" + c.Type,
                stereotype: "" + c.StereotypeEx, name: "" + c.Name,
                direction: (typeof DIRBACK[dirU] == "undefined" ? "" + c.Direction : DIRBACK[dirU]),
                sourceID: c.ClientID, targetID: c.SupplierID };
            try { var oe = Repository.GetElementByID(other); ci.otherEnd = { id: oe.ElementID, name: "" + oe.Name, type: "" + oe.Type }; } catch (eO) { }
            d.connectors.push(ci);
        }
        d.childElements = [];
        for (j = 0; j < el.Elements.Count; j++) {
            var ch = el.Elements.GetAt(j);
            d.childElements.push({ id: ch.ElementID, guid: "" + ch.ElementGUID, name: "" + ch.Name, type: "" + ch.Type });
        }
        d.diagrams = [];
        for (j = 0; j < el.Diagrams.Count; j++) {
            var dg = el.Diagrams.GetAt(j);
            d.diagrams.push({ id: dg.DiagramID, guid: "" + dg.DiagramGUID, name: "" + dg.Name, type: "" + dg.Type });
        }
    }
    out.push(d);
}
return { op: "get_elements_information", status: "ok", count: out.length, items: out };
