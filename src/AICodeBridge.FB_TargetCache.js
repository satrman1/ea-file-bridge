// AICodeBridge.FB_TargetCache(Repository, kind, ref)
// DOHLEDANI CILE DAVKY NA JEDNOM MISTE + MEZIPAMET (balik B1, Z261004b-3;
// zadani cile zapisu v1.1 kap. 5.3 pocita s rozsirenim o blacklist a cesty
// ve vlakne Z261004b-10). kind = "element" | "package" | "diagram";
// ref = "{GUID}" | ciselne ID | jmeno. Vraci null (nenalezeno) nebo
//   element: { guid, id, pkgId, type, name }
//   package: { guid, id, parentId, name }
//   diagram: { guid, id, pkgId, name }
// Mezipamet zije JEN po dobu jednoho volani FB_Main (this._fbTargetCache -
// FB_Main ji na zacatku vynuluje; EA runtime this._fb* mezi vyvolanimi
// stejne nedrzi, par. 1a/5). Totez dohledani tak sdili predbezna kontrola
// (FB_Precheck faze 2), Risk Gate (FB_RiskGate) i zaloha, a jeden cil se
// v jedne davce dotazuje nejvys jednou (FB-PU-32: rezie SQL).
// SQL vyhradne nad standardnimi sloupci t_object/t_package/t_diagram (lekce
// par. 6a/3); chyba dotazu = null (volajici rozhodne fail-closed).
var self = this;
if (!this._fbTargetCache || typeof this._fbTargetCache != "object") {
    this._fbTargetCache = { el: {}, pkg: {}, dgm: {}, queries: 0 };
}
var C = this._fbTargetCache;
var k = ("" + (kind || "")).toLowerCase();
var t = ("" + (ref === null || typeof ref == "undefined" ? "" : ref)).replace(/^\s+|\s+$/g, "");
if (t == "") { return null; }
var bucket = (k == "package") ? C.pkg : ((k == "diagram") ? C.dgm : C.el);
if (typeof bucket[t] != "undefined") { return bucket[t]; }
function esc(s) { return ("" + s).replace(/'/g, "''"); }
function rows(sql) { C.queries++; return self.FB_XmlRows(Repository.SQLQuery(sql)); }
var rr = null, r = null;
try {
    if (k == "package") {
        if (t.charAt(0) == "{") { rr = rows("SELECT Package_ID, Parent_ID, ea_guid, Name FROM t_package WHERE ea_guid = '" + esc(t) + "'"); }
        else if (/^[0-9]+$/.test(t)) { rr = rows("SELECT Package_ID, Parent_ID, ea_guid, Name FROM t_package WHERE Package_ID = " + parseInt(t, 10)); }
        else { rr = rows("SELECT Package_ID, Parent_ID, ea_guid, Name FROM t_package WHERE Name = '" + esc(t) + "'"); }
        if (rr != null && rr.length > 0) {
            r = { guid: "" + rr[0].ea_guid, id: parseInt(rr[0].Package_ID, 10),
                  parentId: parseInt(rr[0].Parent_ID, 10), name: "" + rr[0].Name };
            if (isNaN(r.parentId)) { r.parentId = 0; }
        }
    } else if (k == "diagram") {
        if (t.charAt(0) == "{") { rr = rows("SELECT Diagram_ID, ea_guid, Package_ID, Name FROM t_diagram WHERE ea_guid = '" + esc(t) + "'"); }
        else if (/^[0-9]+$/.test(t)) { rr = rows("SELECT Diagram_ID, ea_guid, Package_ID, Name FROM t_diagram WHERE Diagram_ID = " + parseInt(t, 10)); }
        else { rr = rows("SELECT Diagram_ID, ea_guid, Package_ID, Name FROM t_diagram WHERE Name = '" + esc(t) + "'"); }
        if (rr != null && rr.length > 0) {
            r = { guid: "" + rr[0].ea_guid, id: parseInt(rr[0].Diagram_ID, 10),
                  pkgId: parseInt(rr[0].Package_ID, 10), name: "" + rr[0].Name };
        }
    } else {
        if (t.charAt(0) == "{") { rr = rows("SELECT Object_ID, ea_guid, Package_ID, Object_Type, Name FROM t_object WHERE ea_guid = '" + esc(t) + "'"); }
        else if (/^[0-9]+$/.test(t)) { rr = rows("SELECT Object_ID, ea_guid, Package_ID, Object_Type, Name FROM t_object WHERE Object_ID = " + parseInt(t, 10)); }
        else { rr = rows("SELECT Object_ID, ea_guid, Package_ID, Object_Type, Name FROM t_object WHERE Name = '" + esc(t) + "'"); }
        if (rr != null && rr.length > 0) {
            r = { guid: "" + rr[0].ea_guid, id: parseInt(rr[0].Object_ID, 10),
                  pkgId: parseInt(rr[0].Package_ID, 10), type: "" + rr[0].Object_Type, name: "" + rr[0].Name };
        }
    }
} catch (eQ) { r = null; }
bucket[t] = r;
return r;
