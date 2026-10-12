// AICodeBridge.FB_TargetCache(Repository, kind, ref)
// DOHLEDANI CILE DAVKY NA JEDNOM MISTE + MEZIPAMET (balik B1, Z261004b-3;
// rozsireno o cesty a presne jmeno ve Z261004b-10 - zadani cile zapisu v1.1
// kap. 5.7). kind = "element" | "package" | "diagram";
// ref = "{GUID}" | ciselne ID | jmeno | { path: [...], from? } (jen package).
// Vraci null (nenalezeno NEBO nejednoznacne) nebo
//   element: { guid, id, pkgId, parentId, type, name }
//   package: { guid, id, parentId, name }
//   diagram: { guid, id, pkgId, parentId, name }
// JMENO (W7): SQL `Name = '...'` je jen PREDFILTR (SQLite porovnava citlive na
// velikost pismen, MS SQL podle kolace) - rozhoduje presne porovnani === v JS
// nad "" + Name. Presne 1 shoda = nalez; vic shod = null + zaznam
// this._fbTargetCache.amb[kind:jmeno] = [ { guid, id, name, parentId|pkgId } ]
// (az 10) pro E_AMBIGUOUS; 0 shod = null (E_NOT_FOUND).
// CESTA (kap. 5.7): { path: ["Model", "Oblast", "Balik"] } od korene, nebo
// { path: [...], from: "{GUID}"|ID } od balicku; deleguje na FB_ResolvePath,
// chyba se uklada do amb/err pod klicem cesty (FB_Precheck ji vypise).
// Mezipamet zije JEN po dobu jednoho volani FB_Main (this._fbTargetCache -
// FB_Main ji na zacatku vynuluje; EA runtime this._fb* mezi vyvolanimi
// stejne nedrzi, par. 1a/5). Totez dohledani tak sdili predbezna kontrola
// (FB_Precheck faze 2), kontrola cile (FB_ScopeCheck), Risk Gate i zaloha,
// a jeden cil se v jedne davce dotazuje nejvys jednou (FB-PU-32).
// SQL vyhradne nad standardnimi sloupci t_object/t_package/t_diagram (lekce
// par. 6a/3); chyba dotazu = null (volajici rozhodne fail-closed).
var self = this;
if (!this._fbTargetCache || typeof this._fbTargetCache != "object") {
    this._fbTargetCache = { el: {}, pkg: {}, dgm: {}, amb: {}, err: {}, queries: 0 };
}
var C = this._fbTargetCache;
if (!C.amb) { C.amb = {}; }
if (!C.err) { C.err = {}; }
var k = ("" + (kind || "")).toLowerCase();
var bucket = (k == "package") ? C.pkg : ((k == "diagram") ? C.dgm : C.el);
function esc(s) { return ("" + s).replace(/'/g, "''"); }
function rows(sql) { C.queries++; return self.FB_XmlRows(Repository.SQLQuery(sql)); }
function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
// --- cesta (jen balicky) ---
if (ref !== null && typeof ref == "object" && Object.prototype.toString.call(ref.path) == "[object Array]") {
    var pkey = "path:" + ref.path.join("\u0001") + "|" + ("" + (ref.from === null || typeof ref.from == "undefined" ? "" : ref.from));
    if (k != "package") { C.err[pkey] = { code: "E_ARGS", message: "cesta {path: [...]} je prijatelna jen jako odkaz na balicek" }; return null; }
    if (typeof bucket[pkey] != "undefined") { return bucket[pkey]; }
    var pr = null;
    try { pr = self.FB_ResolvePath(Repository, ref.path, ref.from); } catch (ePa) { pr = { ok: false, code: "E_EXCEPTION", message: "FB_ResolvePath selhal: " + ePa.message }; }
    if (pr && pr.ok) { bucket[pkey] = pr.pkg; return pr.pkg; }
    C.err[pkey] = pr || { code: "E_NOT_FOUND", message: "cesta nenalezena" };
    bucket[pkey] = null;
    return null;
}
var t = ("" + (ref === null || typeof ref == "undefined" ? "" : ref)).replace(/^\s+|\s+$/g, "");
if (t == "") { return null; }
if (typeof bucket[t] != "undefined") { return bucket[t]; }
var byName = !(t.charAt(0) == "{" || /^[0-9]+$/.test(t));
var rr = null, r = null, cands = [];
try {
    if (k == "package") {
        if (t.charAt(0) == "{") { rr = rows("SELECT Package_ID, Parent_ID, ea_guid, Name FROM t_package WHERE ea_guid = '" + esc(t) + "'"); }
        else if (!byName) { rr = rows("SELECT Package_ID, Parent_ID, ea_guid, Name FROM t_package WHERE Package_ID = " + parseInt(t, 10)); }
        else { rr = rows("SELECT Package_ID, Parent_ID, ea_guid, Name FROM t_package WHERE Name = '" + esc(t) + "'"); }
        for (var i = 0; rr != null && i < rr.length; i++) {
            if (byName && typeof rr[i].Name != "undefined" && ("" + rr[i].Name) !== t) { continue; } // W7: presna shoda v JS (radek bez Name = predfiltr bez moznosti overeni)
            cands.push({ guid: "" + rr[i].ea_guid, id: num(rr[i].Package_ID), parentId: num(rr[i].Parent_ID), name: "" + rr[i].Name });
        }
    } else if (k == "diagram") {
        if (t.charAt(0) == "{") { rr = rows("SELECT Diagram_ID, ea_guid, Package_ID, ParentID, Name FROM t_diagram WHERE ea_guid = '" + esc(t) + "'"); }
        else if (!byName) { rr = rows("SELECT Diagram_ID, ea_guid, Package_ID, ParentID, Name FROM t_diagram WHERE Diagram_ID = " + parseInt(t, 10)); }
        else { rr = rows("SELECT Diagram_ID, ea_guid, Package_ID, ParentID, Name FROM t_diagram WHERE Name = '" + esc(t) + "'"); }
        for (var d = 0; rr != null && d < rr.length; d++) {
            if (byName && typeof rr[d].Name != "undefined" && ("" + rr[d].Name) !== t) { continue; }
            cands.push({ guid: "" + rr[d].ea_guid, id: num(rr[d].Diagram_ID), pkgId: num(rr[d].Package_ID), parentId: num(rr[d].ParentID), name: "" + rr[d].Name });
        }
    } else {
        if (t.charAt(0) == "{") { rr = rows("SELECT Object_ID, ea_guid, Package_ID, ParentID, Object_Type, Name FROM t_object WHERE ea_guid = '" + esc(t) + "'"); }
        else if (!byName) { rr = rows("SELECT Object_ID, ea_guid, Package_ID, ParentID, Object_Type, Name FROM t_object WHERE Object_ID = " + parseInt(t, 10)); }
        else { rr = rows("SELECT Object_ID, ea_guid, Package_ID, ParentID, Object_Type, Name FROM t_object WHERE Name = '" + esc(t) + "'"); }
        for (var e = 0; rr != null && e < rr.length; e++) {
            if (byName && typeof rr[e].Name != "undefined" && ("" + rr[e].Name) !== t) { continue; }
            cands.push({ guid: "" + rr[e].ea_guid, id: num(rr[e].Object_ID), pkgId: num(rr[e].Package_ID), parentId: num(rr[e].ParentID), type: "" + rr[e].Object_Type, name: "" + rr[e].Name });
        }
    }
} catch (eQ) { cands = []; }
if (cands.length == 1) { r = cands[0]; }
else if (cands.length > 1) {
    // vic presnych shod: GUID/ID by nemelo nastat, jmeno = E_AMBIGUOUS (volajici)
    r = null;
    if (byName) { C.amb[k + ":" + t] = cands.slice(0, 10); }
    else { r = cands[0]; }
}
bucket[t] = r;
return r;
