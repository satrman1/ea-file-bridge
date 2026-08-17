// AICodeBridge.FB_OpDiagram(Repository, op, reqId)
// create_or_update_diagram (iterace 2, Diagram Builder) - zrcadlo MCP toolu.
// CREATE: v package NEBO pod elementem (owningElement); type povinny, muze byt
// MDG kvalifikovany ("UML Behavioral::Sequence", "CSOB-ITAN::FA-Behavioral") -
// EA zapise zakladni Diagram_Type a MDG vazbu drzi StyleEx "MDGDgm=<typ>;"
// (RE proti MCP referenci, davka 20260818-03). Par. 7e: diagramy zalozene pres
// API nemaji autora -> na create se VZDY nastavi Author (default "Claude via
// eafb") a Version (default "1.0").
// UPDATE: cil pres diagram ("{GUID}" | diagramID) -> jmeno/vlastnosti.
// op.diagrams = [ {
//   diagram                   -> UPDATE cil ("{GUID}" | id); jinak CREATE
//   package | owningElement   -> cil createu (package | element, napr. UC auto-kompozit)
//   type                      -> povinny na create; vc. MDG "Tech::Typ"
//   name, notes
//   author, version, showDetails, styleEx  -> vlastnosti (K6 konvence par. 7e)
// } ]
// Vysledek: items = [{guid, id, name, type, created}]; guid/id prvniho itemu
// navrchu (kvuli $N referencim v davce).
if (!op || !op.diagrams || Object.prototype.toString.call(op.diagrams) != "[object Array]" || op.diagrams.length == 0) {
    return { op: "create_or_update_diagram", status: "error", code: "E_ARGS", message: "Povinne: diagrams (neprazdne pole objektu)." };
}
var items = [], warns = [];
for (var i = 0; i < op.diagrams.length; i++) {
    var d = op.diagrams[i];
    var dg = null, created = false;
    if (d.diagram || d.diagramID || d.guid) {
        // --- UPDATE ---
        var ref = ("" + (d.diagram || d.diagramID || d.guid)).replace(/^\s+|\s+$/g, "");
        try {
            if (ref.charAt(0) == "{") { dg = Repository.GetDiagramByGuid(ref); }
            else if (/^[0-9]+$/.test(ref)) { dg = Repository.GetDiagramByID(parseInt(ref, 10)); }
        } catch (eG) { dg = null; }
        if (dg == null) { return { op: "create_or_update_diagram", status: "error", code: "E_NOT_FOUND", message: "diagrams[" + i + "]: diagram nenalezen (" + ref + ")", items: items }; }
        var chkU = this.FB_CheckWrite(Repository, Repository.GetPackageByID(dg.PackageID));
        if (chkU != null) { return { op: "create_or_update_diagram", status: "error", code: chkU.code, message: "diagrams[" + i + "]: " + chkU.message, items: items }; }
        if (typeof d.name != "undefined") { dg.Name = "" + d.name; }
    } else {
        // --- CREATE ---
        if (!d.type) {
            return { op: "create_or_update_diagram", status: "error", code: "E_ARGS", message: "diagrams[" + i + "]: create vyzaduje type (a package nebo owningElement).", items: items };
        }
        var nm = (typeof d.name == "undefined" || d.name === null) ? "" : ("" + d.name);
        var typ = "" + d.type;
        if (d.owningElement) {
            var owner = this.FB_ResolveEl(Repository, d.owningElement);
            if (owner == null) { return { op: "create_or_update_diagram", status: "error", code: "E_NOT_FOUND", message: "diagrams[" + i + "]: owningElement nenalezen (" + d.owningElement + ")", items: items }; }
            var chkO = this.FB_CheckWrite(Repository, Repository.GetPackageByID(owner.PackageID));
            if (chkO != null) { return { op: "create_or_update_diagram", status: "error", code: chkO.code, message: "diagrams[" + i + "]: " + chkO.message, items: items }; }
            dg = owner.Diagrams.AddNew(nm, typ);
            if (!dg.Update()) { return { op: "create_or_update_diagram", status: "error", code: "E_EXCEPTION", message: "diagrams[" + i + "]: Diagram.Update() selhal: " + dg.GetLastError(), items: items }; }
            owner.Diagrams.Refresh();
        } else {
            var pkg = this.FB_ResolvePkg(Repository, d["package"]);
            if (pkg == null) { return { op: "create_or_update_diagram", status: "error", code: "E_NOT_FOUND", message: "diagrams[" + i + "]: package nenalezen (" + d["package"] + ")", items: items }; }
            var chkC = this.FB_CheckWrite(Repository, pkg);
            if (chkC != null) { return { op: "create_or_update_diagram", status: "error", code: chkC.code, message: "diagrams[" + i + "]: " + chkC.message, items: items }; }
            dg = pkg.Diagrams.AddNew(nm, typ);
            if (!dg.Update()) { return { op: "create_or_update_diagram", status: "error", code: "E_EXCEPTION", message: "diagrams[" + i + "]: Diagram.Update() selhal: " + dg.GetLastError(), items: items }; }
            pkg.Diagrams.Refresh();
        }
        created = true;
        // MDG typ: EA ma po AddNew drzet vazbu v StyleEx (MDGDgm=<typ>;) - kdyz
        // ji nezapsal sam, doplnime (stejny vysledek jako MCP reference).
        if (typ.indexOf("::") > 0) {
            var sx = "" + dg.StyleEx;
            if (sx.indexOf("MDGDgm=") < 0) {
                dg.StyleEx = "MDGDgm=" + typ + ";" + sx;
            }
        }
        // Par. 7e: API-created diagram nema autora -> vzdy Author + Version.
        dg.Author = (typeof d.author != "undefined") ? ("" + d.author) : "Claude via eafb";
        dg.Version = (typeof d.version != "undefined") ? ("" + d.version) : "1.0";
    }
    // --- spolecne vlastnosti ---
    if (!created) {
        if (typeof d.author != "undefined") { dg.Author = "" + d.author; }
        if (typeof d.version != "undefined") { dg.Version = "" + d.version; }
    }
    if (typeof d.notes != "undefined") { dg.Notes = "" + d.notes; }
    if (typeof d.showDetails != "undefined") { dg.ShowDetails = parseInt(d.showDetails, 10); }
    if (typeof d.styleEx != "undefined") { dg.StyleEx = "" + d.styleEx; }
    if (!dg.Update()) {
        return { op: "create_or_update_diagram", status: "error", code: "E_EXCEPTION", message: "diagrams[" + i + "]: Diagram.Update() selhal: " + dg.GetLastError(), items: items };
    }
    try { Repository.ReloadDiagram(dg.DiagramID); } catch (eR) { }
    items.push({ guid: "" + dg.DiagramGUID, id: dg.DiagramID, name: "" + dg.Name, type: "" + dg.Type, created: created });
}
var res = { op: "create_or_update_diagram", status: "ok", count: items.length, items: items };
if (items.length > 0) { res.guid = items[0].guid; res.id = items[0].id; }
if (warns.length > 0) { res.warnings = warns; }
return res;
