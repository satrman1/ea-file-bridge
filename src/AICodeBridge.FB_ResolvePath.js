// AICodeBridge.FB_ResolvePath(Repository, pathArr, from)
// ADRESACE BALICKU CESTOU (zadani cil zapisu v1.1 kap. 5.7, Z261004b-10):
//   { "path": ["Model", "Oblast", "Balik"] }            od korene modelu
//   { "path": ["Podbalik", "Dalsi"], "from": "{GUID}" }  od balicku v from (GUID | ID)
// Pole jmen, ne retezec (jmena v EA smi obsahovat tecku i lomitko). Jmena se
// porovnavaji PRESNE, po urovnich, bez uprav mezer a velikosti pismen - v JS
// (W7): SQL `Parent_ID = ? AND Name = ?` je jen predfiltr, rozhoduje === nad
// "" + Name (SQLite citlive, MS SQL podle kolace - bridge se musi chovat
// stejne doma i v bance).
// Vraci { ok: true, pkg: { guid, id, parentId, name }, path: "A.B.C" } nebo
// { ok: false, code: "E_AMBIGUOUS" | "E_NOT_FOUND" | "E_ARGS", message,
//   candidates: [ { guid, path } ] (E_AMBIGUOUS, nejvys 10),
//   guids: [...] (kompatibilita PROTOKOL kap. 7),
//   found: "nejhlubsi nalezena uroven", children: [ jmena podbalicku, nejvys 10 ] }.
// Jen SQL nad standardnimi sloupci t_package; nikdy nevyhazuje.
var self = this;
function esc(s) { return ("" + s).replace(/'/g, "''"); }
function rows(sql) { try { return self.FB_XmlRows(Repository.SQLQuery(sql)); } catch (eQ) { return null; } }
function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
if (Object.prototype.toString.call(pathArr) != "[object Array]" || pathArr.length == 0) {
    return { ok: false, code: "E_ARGS", message: "path musi byt neprazdne pole jmen balicku (od korene, nebo od balicku v from)" };
}
for (var v = 0; v < pathArr.length; v++) {
    if (typeof pathArr[v] != "string" || pathArr[v] == "") {
        return { ok: false, code: "E_ARGS", message: "path[" + v + "] musi byt neprazdny retezec (jmeno balicku)" };
    }
}
var startId = 0, prefix = "";
var fromRef = (from === null || typeof from == "undefined") ? "" : ("" + from).replace(/^\s+|\s+$/g, "");
if (fromRef != "") {
    var fr = null;
    try { fr = this.FB_TargetCache(Repository, "package", fromRef); } catch (eF) { fr = null; }
    if (fr == null) {
        return { ok: false, code: "E_NOT_FOUND", message: "from: vychozi balicek '" + fromRef + "' nenalezen (GUID nebo ID balicku)", found: "", children: [] };
    }
    startId = fr.id;
    // plna cesta vychoziho balicku (popisek pro cloveka)
    var parts = [], cur = fr, g = 0;
    while (cur && g++ < 60) {
        parts.unshift("" + cur.name);
        if (!cur.parentId || cur.parentId <= 0) { break; }
        try { cur = this.FB_TargetCache(Repository, "package", "" + cur.parentId); } catch (eP) { cur = null; }
    }
    prefix = parts.join(".");
}
var parentId = startId, foundParts = (prefix != "" ? [prefix] : []), row = null;
for (var lv = 0; lv < pathArr.length; lv++) {
    var name = "" + pathArr[lv];
    var rr = rows("SELECT Package_ID, Parent_ID, ea_guid, Name FROM t_package WHERE Parent_ID = " + parentId + " AND Name = '" + esc(name) + "'");
    if (rr == null) { return { ok: false, code: "E_EXCEPTION", message: "dotaz na uroven cesty '" + name + "' selhal (fail-closed)" }; }
    var exact = [];
    for (var i = 0; i < rr.length; i++) {
        if (("" + rr[i].Name) === name) { exact.push({ guid: "" + rr[i].ea_guid, id: num(rr[i].Package_ID), parentId: num(rr[i].Parent_ID), name: "" + rr[i].Name }); }
    }
    var here = foundParts.join(".");
    if (exact.length == 0) {
        var ch = rows("SELECT Name FROM t_package WHERE Parent_ID = " + parentId), names = [];
        for (var c = 0; ch != null && c < ch.length && names.length < 10; c++) { names.push("" + ch[c].Name); }
        return { ok: false, code: "E_NOT_FOUND",
            message: "cesta: uroven '" + name + "' (path[" + lv + "]) pod '" + (here == "" ? "(koren modelu)" : here) + "' neexistuje (presna shoda jmena); podbalicky tam: "
                + (names.length ? names.join(", ") : "(zadne)"),
            found: here, children: names, guids: [] };
    }
    if (exact.length > 1) {
        var cands = [], guids = [];
        for (var a = 0; a < exact.length && a < 10; a++) { cands.push({ guid: exact[a].guid, path: (here == "" ? "" : here + ".") + exact[a].name }); guids.push(exact[a].guid); }
        return { ok: false, code: "E_AMBIGUOUS",
            message: "cesta: jmeno '" + name + "' (path[" + lv + "]) odpovida " + exact.length + " sourozencum pod '" + (here == "" ? "(koren modelu)" : here) + "' - uved GUID kandidata",
            candidates: cands, guids: guids, found: here, children: [] };
    }
    row = exact[0];
    parentId = row.id;
    foundParts.push(row.name);
}
return { ok: true, pkg: row, path: foundParts.join(".") };
