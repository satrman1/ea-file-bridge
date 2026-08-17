// AICodeBridge.FB_OpPlaceElements(Repository, op, reqId)
// place_elements_on_diagram (iterace 2, Diagram Builder) - zrcadlo MCP toolu.
// Umisti EXISTUJICI elementy na diagram. Geometrie dle RE proti MCP (davka
// 20260818-02): t_diagramobjects RectLeft=x, RectTop=-y, RectRight=x+w,
// RectBottom=-(y+h); AddNew pozicni string "l=..;r=..;t=..;b=..;" (kladne t/b).
// Kdyz souradnice chybi, pouzije se auto-pozice (mrizka 4 sloupce, krok
// 220x140, default velikost 160x80). Konektory mezi umistenymi elementy EA
// vykresli SAM, jakmile jsou oba konce na diagramu - response je vykazuje
// v connectorsOnDiagram (readback t_diagramlinks).
// op.diagram = diagramID | "{GUID}" | $ref
// op.elementPlacements = [ { elementID | element ("{GUID}"|$ref), x, y,
//                            width, height, style } ]   (alias: op.elements)
// Vysledek: items = [{elementID, guid, x, y, width, height}] +
//           connectorsOnDiagram = [{connectorID, hidden}].
var pls = (op && (op.elementPlacements || op.elements)) || null;
if (!op || !op.diagram || !pls || Object.prototype.toString.call(pls) != "[object Array]" || pls.length == 0) {
    return { op: "place_elements_on_diagram", status: "error", code: "E_ARGS", message: "Povinne: diagram, elementPlacements (neprazdne pole)." };
}
var dg = null;
var ref = ("" + op.diagram).replace(/^\s+|\s+$/g, "");
try {
    if (ref.charAt(0) == "{") { dg = Repository.GetDiagramByGuid(ref); }
    else if (/^[0-9]+$/.test(ref)) { dg = Repository.GetDiagramByID(parseInt(ref, 10)); }
} catch (eG) { dg = null; }
if (dg == null) { return { op: "place_elements_on_diagram", status: "error", code: "E_NOT_FOUND", message: "Diagram nenalezen: " + ref }; }
var chk = this.FB_CheckWrite(Repository, Repository.GetPackageByID(dg.PackageID));
if (chk != null) { return { op: "place_elements_on_diagram", status: "error", code: chk.code, message: chk.message }; }
var items = [];
var auto = 0; // poradove cislo auto-pozicovanych elementu (mrizka)
for (var i = 0; i < pls.length; i++) {
    var p = pls[i];
    var el = null;
    if (typeof p.elementID != "undefined" && ("" + p.elementID) != "" && /^[0-9]+$/.test("" + p.elementID)) {
        try { el = Repository.GetElementByID(parseInt(p.elementID, 10)); } catch (eE) { el = null; }
    } else if (p.element) {
        el = this.FB_ResolveEl(Repository, p.element);
    }
    if (el == null) { return { op: "place_elements_on_diagram", status: "error", code: "E_NOT_FOUND", message: "elementPlacements[" + i + "]: element nenalezen (" + (p.elementID || p.element) + ")", items: items }; }
    var w = (typeof p.width != "undefined") ? parseInt(p.width, 10) : 160;
    var h = (typeof p.height != "undefined") ? parseInt(p.height, 10) : 80;
    var x, y;
    if (typeof p.x != "undefined" && typeof p.y != "undefined") {
        x = parseInt(p.x, 10); y = parseInt(p.y, 10);
    } else {
        x = 40 + (auto % 4) * 220;
        y = 40 + Math.floor(auto / 4) * 140;
        auto++;
    }
    var pos = "l=" + x + ";r=" + (x + w) + ";t=" + y + ";b=" + (y + h) + ";";
    var obj = dg.DiagramObjects.AddNew(pos, (p.style ? "" + p.style : ""));
    obj.ElementID = el.ElementID;
    if (!obj.Update()) { return { op: "place_elements_on_diagram", status: "error", code: "E_EXCEPTION", message: "elementPlacements[" + i + "]: DiagramObject.Update() selhal: " + obj.GetLastError(), items: items }; }
    items.push({ elementID: el.ElementID, guid: "" + el.ElementGUID, x: x, y: y, width: w, height: h });
}
dg.DiagramObjects.Refresh();
try { Repository.ReloadDiagram(dg.DiagramID); } catch (eR) { }
// konektory, ktere EA na diagramu vykresli sam (oba konce umistene).
// POZOR: t_diagramlinks se plni az pri otevreni/kresleni diagramu v EA -
// u cerstveho diagramu je prazdna (overeno 20260818-05). Proto se cte
// t_connector (oba konce mezi objekty diagramu) a Hidden se doplni
// z t_diagramlinks, kdyz uz radek existuje.
var links = [];
try {
    var hid = {};
    var xmlH = "" + Repository.SQLQuery("SELECT ConnectorID, Hidden FROM t_diagramlinks WHERE DiagramID = " + dg.DiagramID);
    var rowsH = this.FB_XmlRows(xmlH);
    for (var rh = 0; rh < rowsH.length; rh++) { hid["" + rowsH[rh].ConnectorID] = ("" + rowsH[rh].Hidden) == "1"; }
    var xml = "" + Repository.SQLQuery(
        "SELECT Connector_ID FROM t_connector WHERE Start_Object_ID IN (SELECT Object_ID FROM t_diagramobjects WHERE Diagram_ID = " + dg.DiagramID + ")"
        + " AND End_Object_ID IN (SELECT Object_ID FROM t_diagramobjects WHERE Diagram_ID = " + dg.DiagramID + ")");
    var rows = this.FB_XmlRows(xml);
    for (var r = 0; r < rows.length; r++) {
        var cid = "" + rows[r].Connector_ID;
        links.push({ connectorID: parseInt(cid, 10), hidden: (typeof hid[cid] != "undefined") ? hid[cid] : false });
    }
} catch (eL) { }
return { op: "place_elements_on_diagram", status: "ok", diagramID: dg.DiagramID, guid: "" + dg.DiagramGUID,
    count: items.length, items: items, connectorsOnDiagram: links };
