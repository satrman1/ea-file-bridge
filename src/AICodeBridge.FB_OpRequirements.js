// AICodeBridge.FB_OpRequirements(Repository, op, reqId)
// create_or_update_requirements (ITERACE 6) - INTERNAL REQUIREMENTS elementu
// (zalozka Responsibilities -> Requirements, uloziste t_objectrequires).
// Metodicky nosic LOKALNICH pravidel BRU<cisloUC>-Y na Use Case dle revize
// U5 2026-08-21 (IT-ANALYSIS/Skilly/_shared/emr-zapis-pravidla.md par. 3 +
// use-case-analyst/references/scenario-rules.md, metamodel "Behavioral Rule
// - local [Requirement internal]"): lokalni BRU NENI samostatny element pod
// UC s Usage konektorem (N-K3-2 je pro nej prekonano), ale internal
// requirement uvnitr UC - stejna logika jako U2 (scenare -> Scenarios tab)
// a PRE/PST/ASU (-> Constraints tab). Prepouzitelna pravidla BRU-#### zustavaji
// samostatnym elementem v RULES (REUSABLE) + konektor Usage - ta se sem NEPISI.
//
// Deterministicky rebuild (vzor V2d z FB_OpConstraints): existujici internal
// requirements elementu se SMAZOU a zapisi znovu v poradi davky - zadne
// parcialni updaty. Davka proto vzdy nese KOMPLETNI sadu requirements.
//
// MECHANIKA: Element.Requirements.AddNew(name, type) + Notes/Status/Priority/
// Difficulty/Stability + Update(). Requirement NEMA GUID (t_objectrequires ma
// jen umely ReqID AUTOINCREMENT) - identita = (Object_ID, jmeno), stejne jako
// u constraintu. Sloupce overeny sondou pres sqlite_master (davka -93, lekce
// N-4): ReqID, Object_ID, Requirement, ReqType, Status, Notes, Stability,
// Difficulty, Priority, LastUpdate. Readback zasadne SELECT * (lekce par. 6a/3:
// neznamy sloupec na .qea = modalni dialog EA + visici pumpa).
//
// op.element      = cilovy element ("{GUID}" | elementID | jmeno | $ref), typicky UseCase
// op.requirements = [ {
//   name       -> jmeno requirementu (povinne; metodicky "BRU95002-1 Nazev")
//   notes      -> text pravidla (metodicky nosic obsahu BRU)
//   type       -> ReqType; volitelne, default "Functional". EA ma seznam typu
//                 konfigurovatelny (Functional, Display, Performance, ...),
//                 proto se hodnota NEVALIDUJE proti vyctu - projde jak je.
//   status     -> volitelne (EA default "Proposed")
//   priority   -> volitelne (High | Medium | Low)
//   difficulty -> volitelne (High | Medium | Low)
//   stability  -> volitelne (High | Moderate | Low)
// } ]
// Vysledek: items = [{name, type, created}], removed, readback (API + tableRowCount).
if (!op || !op.element) {
    return { op: "create_or_update_requirements", status: "error", code: "E_ARGS", message: "Povinne: element." };
}
if (!op.requirements || Object.prototype.toString.call(op.requirements) != "[object Array]" || op.requirements.length == 0) {
    return { op: "create_or_update_requirements", status: "error", code: "E_ARGS", message: "Povinne: requirements (neprazdne pole)." };
}
var el = this.FB_ResolveEl(Repository, op.element);
if (el == null) {
    return { op: "create_or_update_requirements", status: "error", code: "E_NOT_FOUND", message: "Element nenalezen: " + op.element };
}
var chk = this.FB_CheckWrite(Repository, Repository.GetPackageByID(el.PackageID));
if (chk != null) { return { op: "create_or_update_requirements", status: "error", code: chk.code, message: chk.message }; }
// --- validace CELE davky pred prvnim zapisem (zadne parcialni mazani) ---
var defs = [];
for (var v = 0; v < op.requirements.length; v++) {
    var dv = op.requirements[v];
    if (!dv || !dv.name || ("" + dv.name).replace(/^\s+|\s+$/g, "") == "") {
        return { op: "create_or_update_requirements", status: "error", code: "E_ARGS", message: "requirements[" + v + "]: chybi name." };
    }
    defs.push({
        name: "" + dv.name,
        type: (typeof dv.type != "undefined" && dv.type !== null && ("" + dv.type) != "") ? ("" + dv.type) : "Functional",
        notes: (typeof dv.notes != "undefined" ? "" + dv.notes : null),
        status: (typeof dv.status != "undefined" ? "" + dv.status : null),
        priority: (typeof dv.priority != "undefined" ? "" + dv.priority : null),
        difficulty: (typeof dv.difficulty != "undefined" ? "" + dv.difficulty : null),
        stability: (typeof dv.stability != "undefined" ? "" + dv.stability : null)
    });
}
var items = [], warns = [];
// --- deterministicky rebuild: smazat vsechny existujici requirements ---
var removed = 0;
try {
    for (var di = el.Requirements.Count - 1; di >= 0; di--) {
        el.Requirements.DeleteAt(di, false);
        removed++;
    }
    el.Requirements.Refresh();
} catch (eDel) {
    return { op: "create_or_update_requirements", status: "error", code: "E_EXCEPTION", message: "Mazani existujicich requirements selhalo: " + eDel.message };
}
// --- zapis v poradi davky ---
for (var i = 0; i < defs.length; i++) {
    var def = defs[i];
    var rq;
    try {
        rq = el.Requirements.AddNew(def.name, def.type);
        if (def.notes !== null) { rq.Notes = def.notes; }
        if (def.status !== null) { rq.Status = def.status; }
        if (def.priority !== null) { try { rq.Priority = def.priority; } catch (eP) { warns.push("requirements[" + i + "]: Priority nelze zapsat: " + eP.message); } }
        if (def.difficulty !== null) { try { rq.Difficulty = def.difficulty; } catch (eD) { warns.push("requirements[" + i + "]: Difficulty nelze zapsat: " + eD.message); } }
        if (def.stability !== null) { try { rq.Stability = def.stability; } catch (eS) { warns.push("requirements[" + i + "]: Stability nelze zapsat: " + eS.message); } }
        if (!rq.Update()) {
            return { op: "create_or_update_requirements", status: "error", code: "E_EXCEPTION", message: "requirements[" + i + "]: Requirement.Update() selhal: " + rq.GetLastError(), items: items };
        }
    } catch (eR) {
        return { op: "create_or_update_requirements", status: "error", code: "E_EXCEPTION", message: "requirements[" + i + "]: " + eR.message, items: items };
    }
    items.push({ name: def.name, type: def.type, created: true });
}
try { el.Requirements.Refresh(); } catch (eRf) { }
this.SetTag(el, "ai.request", "" + reqId);
// --- readback (pozorovatelnost): API + t_objectrequires ---
var api = [];
try {
    for (var ri = 0; ri < el.Requirements.Count; ri++) {
        var rr = el.Requirements.GetAt(ri);
        api.push({ name: "" + rr.Name, type: "" + rr.Type, notes: "" + rr.Notes, status: "" + rr.Status });
    }
} catch (eApi) { warns.push("API readback selhal: " + eApi.message); }
var tableRows = [];
try {
    tableRows = this.FB_XmlRows(Repository.SQLQuery(
        "SELECT * FROM t_objectrequires WHERE Object_ID = " + el.ElementID));
} catch (eQ) { warns.push("t_objectrequires readback selhal: " + eQ.message); }
var res = { op: "create_or_update_requirements", status: "ok", count: items.length, removed: removed, items: items,
    readback: { api: api, tableRowCount: tableRows.length } };
res.guid = "" + el.ElementGUID; res.id = el.ElementID;
if (warns.length > 0) { res.warnings = warns; }
return res;
