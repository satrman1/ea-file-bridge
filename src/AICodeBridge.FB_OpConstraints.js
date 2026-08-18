// AICodeBridge.FB_OpConstraints(Repository, op, reqId)
// create_or_update_constraints - internal constraints elementu (zalozka
// Constraints, uloziste t_objectconstraint). Metodicky nosic PRE/PST/ASU
// na Use Case (U2 rev. 2026-08-17: scenare = Scenarios tab, PRE/PST/ASU
// = Constraints tab; scenario-rules.md sekce "Fyzicke umisteni v EA").
// Deterministicky rebuild (vzor V2d z FB_OpScenarios): existujici
// constrainty elementu se SMAZOU a zapisi znovu v poradi davky - zadne
// parcialni updaty. Davka proto vzdy nese KOMPLETNI sadu constraintu.
//
// MECHANIKA: Element.Constraints.AddNew(name, type) + Notes/Status +
// Update(). Constraint NEMA GUID - identita = (Object_ID, jmeno);
// metodicke jmeno PREXXXXX-Y / PSTXXXXX-Y / ASUXXXXX-Y nese `name`.
// Readback SQL zasadne SELECT * (lekce par. 6a/3: neznamy sloupec na .qea
// = modalni dialog EA + visici pumpa).
//
// op.element     = cilovy element ("{GUID}" | elementID | jmeno | $ref), typicky UseCase
// op.constraints = [ {
//   name   -> jmeno constraintu (povinne; metodicky PREXXXXX-Y apod.)
//   type   -> "Pre-condition" | "Post-condition" | "Invariant" (povinne).
//             Prijimaji se i metodicke enum hodnoty se zavorkou -
//             "Assumption [Invariant]", "Log record [Post-condition]",
//             "Business function [Pre-condition]" - base typ se vezme ze
//             zavorky, semantika zustava ve jmene. Tolerantne tez
//             "precondition"/"PRE", "postcondition"/"PST",
//             "assumption"/"ASU". Neznamy typ = E_ARGS.
//   notes  -> popis constraintu
//   status -> volitelne (EA default "Approved")
// } ]
// Vysledek: items = [{name, type, created}], removed, readback (API + tableRowCount).
if (!op || !op.element) {
    return { op: "create_or_update_constraints", status: "error", code: "E_ARGS", message: "Povinne: element." };
}
if (!op.constraints || Object.prototype.toString.call(op.constraints) != "[object Array]" || op.constraints.length == 0) {
    return { op: "create_or_update_constraints", status: "error", code: "E_ARGS", message: "Povinne: constraints (neprazdne pole)." };
}
// --- normalizace typu na EA hodnoty (Pre-condition | Post-condition | Invariant) ---
function normType(t) {
    var s = ("" + (t === null || typeof t == "undefined" ? "" : t)).replace(/^\s+|\s+$/g, "");
    if (s == "") { return null; }
    var br = /\[([^\]]+)\]\s*$/.exec(s); // metodicka varianta "Xyz [Base-typ]"
    if (br) { s = br[1]; }
    var l = s.toLowerCase().replace(/[\s_]+/g, "-");
    if (l == "pre-condition" || l == "precondition" || l == "pre") { return "Pre-condition"; }
    if (l == "post-condition" || l == "postcondition" || l == "pst" || l == "post") { return "Post-condition"; }
    if (l == "invariant" || l == "assumption" || l == "asu") { return "Invariant"; }
    return null;
}
var el = this.FB_ResolveEl(Repository, op.element);
if (el == null) {
    return { op: "create_or_update_constraints", status: "error", code: "E_NOT_FOUND", message: "Element nenalezen: " + op.element };
}
var chk = this.FB_CheckWrite(Repository, Repository.GetPackageByID(el.PackageID));
if (chk != null) { return { op: "create_or_update_constraints", status: "error", code: chk.code, message: chk.message }; }
// --- validace CELE davky pred prvnim zapisem (zadne parcialni mazani) ---
var defs = [];
for (var v = 0; v < op.constraints.length; v++) {
    var dv = op.constraints[v];
    if (!dv || !dv.name || ("" + dv.name).replace(/^\s+|\s+$/g, "") == "") {
        return { op: "create_or_update_constraints", status: "error", code: "E_ARGS", message: "constraints[" + v + "]: chybi name." };
    }
    var nt = normType(dv.type);
    if (nt == null) {
        return { op: "create_or_update_constraints", status: "error", code: "E_ARGS",
            message: "constraints[" + v + "]: neznamy type '" + dv.type + "'. Povolene: Pre-condition | Post-condition | Invariant (pripadne metodicke 'Assumption [Invariant]', 'Log record [Post-condition]', 'Business function [Pre-condition]')." };
    }
    defs.push({ name: "" + dv.name, type: nt, notes: (typeof dv.notes != "undefined" ? "" + dv.notes : null), status: (typeof dv.status != "undefined" ? "" + dv.status : null) });
}
var items = [], warns = [];
// --- deterministicky rebuild: smazat vsechny existujici constrainty ---
var removed = 0;
try {
    for (var di = el.Constraints.Count - 1; di >= 0; di--) {
        el.Constraints.DeleteAt(di, false);
        removed++;
    }
    el.Constraints.Refresh();
} catch (eDel) {
    return { op: "create_or_update_constraints", status: "error", code: "E_EXCEPTION", message: "Mazani existujicich constraintu selhalo: " + eDel.message };
}
// --- zapis v poradi davky ---
for (var i = 0; i < defs.length; i++) {
    var def = defs[i];
    var cn;
    try {
        cn = el.Constraints.AddNew(def.name, def.type);
        if (def.notes !== null) { cn.Notes = def.notes; }
        if (def.status !== null) { cn.Status = def.status; }
        if (!cn.Update()) {
            return { op: "create_or_update_constraints", status: "error", code: "E_EXCEPTION", message: "constraints[" + i + "]: Constraint.Update() selhal: " + cn.GetLastError(), items: items };
        }
    } catch (eC) {
        return { op: "create_or_update_constraints", status: "error", code: "E_EXCEPTION", message: "constraints[" + i + "]: " + eC.message, items: items };
    }
    items.push({ name: def.name, type: def.type, created: true });
}
try { el.Constraints.Refresh(); } catch (eRf) { }
this.SetTag(el, "ai.request", "" + reqId);
// --- readback (pozorovatelnost): API + t_objectconstraint ---
var api = [];
try {
    for (var ri = 0; ri < el.Constraints.Count; ri++) {
        var rc = el.Constraints.GetAt(ri);
        api.push({ name: "" + rc.Name, type: "" + rc.Type, notes: "" + rc.Notes, status: "" + rc.Status });
    }
} catch (eApi) { warns.push("API readback selhal: " + eApi.message); }
var tableRows = [];
try {
    tableRows = this.FB_XmlRows(Repository.SQLQuery(
        "SELECT * FROM t_objectconstraint WHERE Object_ID = " + el.ElementID));
} catch (eQ) { warns.push("t_objectconstraint readback selhal: " + eQ.message); }
var res = { op: "create_or_update_constraints", status: "ok", count: items.length, removed: removed, items: items,
    readback: { api: api, tableRowCount: tableRows.length } };
res.guid = "" + el.ElementGUID; res.id = el.ElementID;
if (warns.length > 0) { res.warnings = warns; }
return res;
