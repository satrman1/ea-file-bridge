// AICodeBridge.FB_OpGetPackages(Repository, op)
// get_packages_information - dump package: vlastnosti, TV (pres pkg.Element,
// rozprazene), pod-packages, elementy (souhrn) a diagramy.
// op.packages = [ "{GUID}" | packageID | jmeno | $ref, ... ]
if (!op || !op.packages || Object.prototype.toString.call(op.packages) != "[object Array]" || op.packages.length == 0) {
    return { op: "get_packages_information", status: "error", code: "E_ARGS", message: "Povinne: packages (neprazdne pole referenci)." };
}
var out = [];
for (var i = 0; i < op.packages.length; i++) {
    var pkg = this.FB_ResolvePkg(Repository, op.packages[i]);
    if (pkg == null) {
        return { op: "get_packages_information", status: "error", code: "E_NOT_FOUND", message: "packages[" + i + "]: package nenalezen (" + op.packages[i] + ")", items: out };
    }
    var d = {
        id: pkg.PackageID, guid: "" + pkg.PackageGUID, name: "" + pkg.Name,
        parentID: pkg.ParentID, notes: "" + pkg.Notes
    };
    var pel = null;
    try { pel = pkg.Element; } catch (eP) { pel = null; }
    if (pel != null) {
        d.elementID = pel.ElementID;
        d.stereotypes = "" + pel.StereotypeEx;
        d.author = "" + pel.Author;
        d.version = "" + pel.Version;
        d.taggedValues = this.FB_TagRead(Repository, pel);
    }
    var j;
    d.packages = [];
    for (j = 0; j < pkg.Packages.Count; j++) {
        var sp = pkg.Packages.GetAt(j);
        d.packages.push({ id: sp.PackageID, guid: "" + sp.PackageGUID, name: "" + sp.Name });
    }
    d.elements = [];
    for (j = 0; j < pkg.Elements.Count; j++) {
        var el = pkg.Elements.GetAt(j);
        d.elements.push({ id: el.ElementID, guid: "" + el.ElementGUID, name: "" + el.Name,
            type: "" + el.Type, stereotypes: "" + el.StereotypeEx });
    }
    d.diagrams = [];
    for (j = 0; j < pkg.Diagrams.Count; j++) {
        var dg = pkg.Diagrams.GetAt(j);
        d.diagrams.push({ id: dg.DiagramID, guid: "" + dg.DiagramGUID, name: "" + dg.Name, type: "" + dg.Type });
    }
    out.push(d);
}
return { op: "get_packages_information", status: "ok", count: out.length, items: out };
