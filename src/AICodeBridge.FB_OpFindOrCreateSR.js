// AICodeBridge.FB_OpFindOrCreateSR(Repository, op, reqId)
// find_or_create_referencing_sr (iterace 2b) - port produkce
// Scripts/ITAN-Find or Create Referencing Service Realization.vbs
// (Milos Lang, 2019; SR VETEV = dnesni logika, SRxPR fork prijde pozdeji).
// Katalog-first tok (par. 7e): pro operaci z katalogu dohleda odkazujici
// Service Realizaci pres TV "505-1 Operation Link"; kdyz zadna neni, zalozi
// standardni strukturu: service package + version diagram + SR element
// (+ SR diagram + Impact View) + DTO + Req/Res + vazby + place.
// Sablonove GUIDy a cilovy package = per-repo konfigurace FB_ScaffoldConfig
// (zadne InputBox/MsgBox - vse argumenty a response).
// Odchylky od VBS (vedome): (1) TV 505-1 se zapisuje jmenem (SetTag), ne
// TaggedValues.GetAt(0); (2) DTO diagram prebira Notes z DTO diagram sablony
// (VBS radek 242 kopiroval omylem SR sablonu); (3) auto-kompozitni diagramy
// MDG elementu se NEzakladaji duplicitne - pouzije/prejmenuje se vznikly
// (par. 7e/7g); (4) Author diagramu = op.author | "Claude via eafb"
// (SecurityUser doma neni).
//
// op.operation     = operace katalogu ("{GUID}" | operationID) - povinne
// op.packageName   = jmeno noveho service package (povinne pri zakladani;
//                    konvence <Operace>_ARELYYMM, postfix resi clovek/AI)
// op.targetPackage = volitelne prebiti cile ("{GUID}" | id | jmeno);
//                    default = unsortedPkg z FB_ScaffoldConfig
// op.author        = volitelne; default "Claude via eafb"
// Vysledek: found=true + items[] (nalezene SR) NEBO found=false + created
// struktura s guid/id vsech artefaktu + counts + tag505 readback.
if (!op || !op.operation) {
    return { op: "find_or_create_referencing_sr", status: "error", code: "E_ARGS", message: "Povinne: operation." };
}
// --- resolve operace ---
var meth = null;
var oref = ("" + op.operation).replace(/^\s+|\s+$/g, "");
try {
    if (oref.charAt(0) == "{") { meth = Repository.GetMethodByGuid(oref); }
    else if (/^[0-9]+$/.test(oref)) { meth = Repository.GetMethodByID(parseInt(oref, 10)); }
} catch (eM) { meth = null; }
if (meth == null) {
    return { op: "find_or_create_referencing_sr", status: "error", code: "E_NOT_FOUND", message: "Operace nenalezena: " + oref };
}
var methGuid = "" + meth.MethodGUID;
var methName = "" + meth.Name;
// --- FIND: odkazujici elementy pres TV 505-1 Operation Link ---
var foundRows = [];
try {
    foundRows = this.FB_XmlRows(Repository.SQLQuery(
        "SELECT o.Object_ID, o.ea_guid, o.Name, o.Stereotype, o.Author, o.ModifiedDate " +
        "FROM t_object o INNER JOIN t_objectproperties p ON p.Object_ID = o.Object_ID " +
        "WHERE p.Property = '505-1 Operation Link' AND p.Value = '" + methGuid.replace(/'/g, "''") + "' " +
        "ORDER BY o.CreatedDate"));
} catch (eF) {
    return { op: "find_or_create_referencing_sr", status: "error", code: "E_EXCEPTION", message: "Dotaz na odkazujici SR selhal: " + eF.message };
}
if (foundRows.length > 0) {
    var fitems = [];
    for (var fi = 0; fi < foundRows.length; fi++) {
        fitems.push({ guid: "" + foundRows[fi].ea_guid, id: parseInt(foundRows[fi].Object_ID, 10),
            name: "" + foundRows[fi].Name, stereotype: "" + (foundRows[fi].Stereotype || ""),
            author: "" + (foundRows[fi].Author || ""), modified: "" + (foundRows[fi].ModifiedDate || "") });
    }
    return { op: "find_or_create_referencing_sr", status: "ok", found: true, operation: methGuid,
        count: fitems.length, items: fitems, guid: fitems[fitems.length - 1].guid, id: fitems[fitems.length - 1].id };
}
// --- CREATE: nic neodkazuje -> zalozit standardni strukturu ---
if (!op.packageName || ("" + op.packageName) == "") {
    return { op: "find_or_create_referencing_sr", status: "error", code: "E_ARGS",
        message: "Zadna SR na operaci '" + methName + "' neodkazuje a chybi packageName - zakladani vyzaduje jmeno service package (konvence <Operace>_ARELYYMM)." };
}
var author = (typeof op.author != "undefined" && ("" + op.author) != "") ? ("" + op.author) : "Claude via eafb";
// konfigurace scaffoldu pro repo
var cfg = null;
var sca = this.FB_ScaffoldConfig();
var ridU = ("" + this.FB_RepoId(Repository)).toUpperCase();
for (var ci = 0; ci < sca.length; ci++) {
    if (ridU.indexOf(("" + sca[ci].repo).toUpperCase()) >= 0) { cfg = sca[ci]; break; }
}
if (cfg == null && !op.targetPackage) {
    return { op: "find_or_create_referencing_sr", status: "error", code: "E_ARGS",
        message: "Repozitar nema polozku ve FB_ScaffoldConfig a chybi targetPackage - neni kam scaffold zalozit." };
}
var tmpl = (cfg && cfg.templates) ? cfg.templates : {};
var warns = [];
var self = this;
function pkgNotes(g) { if (!g) { return null; } try { var p = Repository.GetPackageByGuid("" + g); return (p == null) ? null : ("" + p.Notes); } catch (e) { return null; } }
function elNotes(g)  { if (!g) { return null; } try { var e2 = Repository.GetElementByGuid("" + g); return (e2 == null) ? null : ("" + e2.Notes); } catch (e) { return null; } }
function dgNotes(g)  { if (!g) { return null; } try { var d2 = Repository.GetDiagramByGuid("" + g); return (d2 == null) ? null : ("" + d2.Notes); } catch (e) { return null; } }
function warnTmpl(role) { warns.push("Sablona '" + role + "' nedohledana (FB_ScaffoldConfig) - Notes zustavaji prazdne."); }
// cilovy package
var targetPkg = null;
if (op.targetPackage) { targetPkg = this.FB_ResolvePkg(Repository, op.targetPackage); }
else { targetPkg = this.FB_ResolvePkg(Repository, cfg.unsortedPkg); }
if (targetPkg == null) {
    return { op: "find_or_create_referencing_sr", status: "error", code: "E_NOT_FOUND",
        message: "Cilovy package nenalezen (" + (op.targetPackage || (cfg && cfg.unsortedPkg)) + ")." };
}
var chk = this.FB_CheckWrite(Repository, targetPkg);
if (chk != null) { return { op: "find_or_create_referencing_sr", status: "error", code: chk.code, message: chk.message }; }
var createdDiagrams = [], createdElements = [], createdConnectors = [];
// *** Service package ***
var svcPkg = targetPkg.Packages.AddNew("" + op.packageName, "");
if (!svcPkg.Update()) {
    return { op: "find_or_create_referencing_sr", status: "error", code: "E_EXCEPTION", message: "Zalozeni service package selhalo: " + svcPkg.GetLastError() };
}
var n0 = pkgNotes(tmpl.srPackage);
if (n0 !== null) { svcPkg.Notes = n0; svcPkg.Update(); } else { warnTmpl("srPackage"); }
targetPkg.Packages.Refresh();
// *** Version diagram ***
var verDg = svcPkg.Diagrams.AddNew("version_" + methName, "CSOB-ITAN::Version Root Diagram");
if (!verDg.Update()) {
    return { op: "find_or_create_referencing_sr", status: "error", code: "E_EXCEPTION", message: "Version diagram selhal: " + verDg.GetLastError() };
}
if (("" + verDg.StyleEx).indexOf("MDGDgm=") < 0) { verDg.StyleEx = "MDGDgm=CSOB-ITAN::Version Root Diagram;" + verDg.StyleEx; }
verDg.ShowDetails = 1;
verDg.Version = "1.0";
verDg.Author = author;
var nV = dgNotes(tmpl.versionDiagram);
if (nV !== null) { verDg.Notes = nV; } else { warnTmpl("versionDiagram"); }
if (!verDg.Update()) { warns.push("Version diagram: druhy Update selhal: " + verDg.GetLastError()); }
svcPkg.Diagrams.Refresh();
createdDiagrams.push({ role: "version", guid: "" + verDg.DiagramGUID, id: verDg.DiagramID, name: "" + verDg.Name, type: "" + verDg.Type, styleEx: "" + verDg.StyleEx });
// *** SR element + diagramy ***
var srEl = svcPkg.Elements.AddNew("SR " + methName, "CSOB-ITAN::Service Realization");
if (!srEl.Update()) {
    return { op: "find_or_create_referencing_sr", status: "error", code: "E_EXCEPTION", message: "SR element selhal: " + srEl.GetLastError() };
}
srEl.Notes = "" + meth.Notes;
srEl.Update();
svcPkg.Elements.Refresh();
createdElements.push({ role: "sr", guid: "" + srEl.ElementGUID, id: srEl.ElementID, name: "" + srEl.Name, type: "" + srEl.Type, stereotype: "" + srEl.Stereotype });
// SR diagram: MDG si kompozit zaklada sam (par. 7e) - pouzit, nezakladat druhy
var srDg = null, srDgAuto = false;
try {
    srEl.Diagrams.Refresh();
    if (srEl.Diagrams.Count > 0) { srDg = srEl.Diagrams.GetAt(0); srDgAuto = true; }
} catch (eSD) { srDg = null; }
if (srDg == null) {
    srDg = srEl.Diagrams.AddNew("SR " + methName, "Sequence");
    if (!srDg.Update()) { warns.push("SR diagram (fallback) selhal: " + srDg.GetLastError()); srDg = null; }
}
if (srDg != null) {
    if (("" + srDg.Name) != ("SR " + methName)) { srDg.Name = "SR " + methName; }
    var nS = dgNotes(tmpl.srDiagram);
    if (nS !== null) { srDg.Notes = nS; } else { warnTmpl("srDiagram"); }
    srDg.Version = "1.0";
    srDg.Author = author;
    if (!srDg.Update()) { warns.push("SR diagram: Update selhal: " + srDg.GetLastError()); }
    createdDiagrams.push({ role: "sr", guid: "" + srDg.DiagramGUID, id: srDg.DiagramID, name: "" + srDg.Name, type: "" + srDg.Type, autoComposite: srDgAuto });
}
// SR Impact View
var ivDg = srEl.Diagrams.AddNew(methName + " Impact View", "CSOB-ITAN::LD-Behavioral");
if (!ivDg.Update()) { warns.push("Impact View diagram selhal: " + ivDg.GetLastError()); ivDg = null; }
if (ivDg != null) {
    ivDg.StyleEx = "MDGDgm=CSOB-ITAN::LD-Behavioral;MDGView=CSOB-ITAN::Realization Impact View;";
    ivDg.Version = "1.0";
    ivDg.Author = author;
    var nI = dgNotes(tmpl.srImpactViewDiagram);
    if (nI !== null) { ivDg.Notes = nI; } else { warnTmpl("srImpactViewDiagram"); }
    if (!ivDg.Update()) { warns.push("Impact View: Update selhal: " + ivDg.GetLastError()); }
    createdDiagrams.push({ role: "impactView", guid: "" + ivDg.DiagramGUID, id: ivDg.DiagramID, name: "" + ivDg.Name, type: "" + ivDg.Type, styleEx: "" + ivDg.StyleEx });
}
srEl.Diagrams.Refresh();
// *** Napojeni na katalog: TV 505-1 Operation Link ***
this.SetTag(srEl, "505-1 Operation Link", methGuid);
// prevzeti sablonovych Notes SR (VBS je nebral - SR Notes = Notes operace; parita drzi)
// *** DTO + Req/Res ***
var dtoEl = svcPkg.Elements.AddNew("DTO " + methName, "CSOB-ITAN::Data Transfer Object");
if (!dtoEl.Update()) {
    return { op: "find_or_create_referencing_sr", status: "error", code: "E_EXCEPTION", message: "DTO element selhal: " + dtoEl.GetLastError(), created: { elements: createdElements, diagrams: createdDiagrams } };
}
var nD = elNotes(tmpl.dto);
if (nD !== null) { dtoEl.Notes = nD; dtoEl.Update(); } else { warnTmpl("dto"); }
svcPkg.Elements.Refresh();
createdElements.push({ role: "dto", guid: "" + dtoEl.ElementGUID, id: dtoEl.ElementID, name: "" + dtoEl.Name, type: "" + dtoEl.Type, stereotype: "" + dtoEl.Stereotype });
var reqEl = dtoEl.Elements.AddNew(methName + "Req", "Class");
if (!reqEl.Update()) { warns.push("Req element selhal: " + reqEl.GetLastError()); }
var nRq = elNotes(tmpl.req);
if (nRq !== null) { reqEl.Notes = nRq; reqEl.Update(); } else { warnTmpl("req"); }
var resEl = dtoEl.Elements.AddNew(methName + "Res", "Class");
if (!resEl.Update()) { warns.push("Res element selhal: " + resEl.GetLastError()); }
var nRs = elNotes(tmpl.res);
if (nRs !== null) { resEl.Notes = nRs; resEl.Update(); } else { warnTmpl("res"); }
dtoEl.Elements.Refresh();
createdElements.push({ role: "req", guid: "" + reqEl.ElementGUID, id: reqEl.ElementID, name: "" + reqEl.Name, type: "" + reqEl.Type });
createdElements.push({ role: "res", guid: "" + resEl.ElementGUID, id: resEl.ElementID, name: "" + resEl.Name, type: "" + resEl.Type });
// *** Version diagram: place SR + DTO ***
try {
    var vObjs = verDg.DiagramObjects;
    var vo1 = vObjs.AddNew("l=50;r=200;t=100;b=170;", "");
    vo1.ElementID = srEl.ElementID;
    vo1.Update();
    var vo2 = vObjs.AddNew("l=250;r=400;t=100;b=170;", "");
    vo2.ElementID = dtoEl.ElementID;
    vo2.Update();
} catch (eVP) { warns.push("Place na version diagram selhal: " + eVP.message); }
// *** Vazby (vzor par. 7e: diamant u DTO, refine na SR) ***
function addConn(fromEl, toEl, type, fin) {
    var c = fromEl.Connectors.AddNew("", type);
    c.SupplierID = toEl.ElementID;
    if (!c.Update()) { warns.push(type + " " + fromEl.Name + "->" + toEl.Name + ": Update selhal: " + c.GetLastError()); return null; }
    if (fin) { fin(c); }
    fromEl.Connectors.Refresh();
    toEl.Connectors.Refresh();
    return c;
}
var cRef = addConn(dtoEl, srEl, "Dependency", function (c) {
    c.Stereotype = "refine";
    if (!c.Update()) { warns.push("refine: Update stereotypu selhal: " + c.GetLastError()); }
});
if (cRef != null) { createdConnectors.push({ role: "refine", guid: "" + cRef.ConnectorGUID, id: cRef.ConnectorID, type: "" + cRef.Type, stereotype: "" + cRef.Stereotype }); }
function addComposition(partEl) {
    return addConn(partEl, dtoEl, "Composition", function (c) {
        c.SupplierEnd.Aggregation = 2;
        if (!c.Update()) { warns.push("Composition " + partEl.Name + ": Aggregation Update selhal: " + c.GetLastError()); }
        c.ClientEnd.Navigable = "Non-Navigable";
        if (!c.Update()) { warns.push("Composition " + partEl.Name + ": Navigable Update selhal: " + c.GetLastError()); }
    });
}
var cRq = addComposition(reqEl);
if (cRq != null) { createdConnectors.push({ role: "composition-req", guid: "" + cRq.ConnectorGUID, id: cRq.ConnectorID, type: "" + cRq.Type }); }
var cRs = addComposition(resEl);
if (cRs != null) { createdConnectors.push({ role: "composition-res", guid: "" + cRs.ConnectorGUID, id: cRs.ConnectorID, type: "" + cRs.Type }); }
// *** DTO diagram: auto-kompozit pouzit/prejmenovat (par. 7g), place Req/Res ***
var dtoDg = null, dtoDgAuto = false;
try {
    dtoEl.Diagrams.Refresh();
    if (dtoEl.Diagrams.Count > 0) { dtoDg = dtoEl.Diagrams.GetAt(0); dtoDgAuto = true; }
} catch (eDD) { dtoDg = null; }
if (dtoDg == null) {
    dtoDg = dtoEl.Diagrams.AddNew("DTO " + methName, "Logical");
    if (!dtoDg.Update()) { warns.push("DTO diagram (fallback) selhal: " + dtoDg.GetLastError()); dtoDg = null; }
}
if (dtoDg != null) {
    if (("" + dtoDg.Name) != ("DTO " + methName)) { dtoDg.Name = "DTO " + methName; }
    var nDD = dgNotes(tmpl.dtoDiagram); // VBS r. 242 omylem bral SR sablonu - vedoma oprava
    if (nDD !== null) { dtoDg.Notes = nDD; } else { warnTmpl("dtoDiagram"); }
    dtoDg.Version = "1.0";
    dtoDg.Author = author;
    if (!dtoDg.Update()) { warns.push("DTO diagram: Update selhal: " + dtoDg.GetLastError()); }
    createdDiagrams.push({ role: "dto", guid: "" + dtoDg.DiagramGUID, id: dtoDg.DiagramID, name: "" + dtoDg.Name, type: "" + dtoDg.Type, autoComposite: dtoDgAuto });
    try {
        var dObjs = dtoDg.DiagramObjects;
        var do1 = dObjs.AddNew("l=50;r=200;t=100;b=170;", "");
        do1.ElementID = reqEl.ElementID;
        do1.Update();
        var do2 = dObjs.AddNew("l=250;r=400;t=100;b=170;", "");
        do2.ElementID = resEl.ElementID;
        do2.Update();
    } catch (eDP) { warns.push("Place na DTO diagram selhal: " + eDP.message); }
}
// *** razitka (detektivni model) ***
var stamp = [srEl, dtoEl, reqEl, resEl];
for (var si = 0; si < stamp.length; si++) {
    this.SetTag(stamp[si], "ai.channel", "eafb");
    this.SetTag(stamp[si], "ai.request", "" + reqId);
}
// *** readback TV 505-1 (pozorovatelnost) ***
var tag505 = "";
try {
    var t5 = this.FB_XmlRows(Repository.SQLQuery(
        "SELECT Value FROM t_objectproperties WHERE Object_ID = " + srEl.ElementID + " AND Property = '505-1 Operation Link'"));
    if (t5.length > 0) { tag505 = "" + t5[0].Value; }
} catch (eT5) { }
try { Repository.RefreshModelView(targetPkg.PackageID); } catch (eRM) { }
var res = { op: "find_or_create_referencing_sr", status: "ok", found: false, operation: methGuid,
    created: {
        servicePackage: { guid: "" + svcPkg.PackageGUID, id: svcPkg.PackageID, name: "" + svcPkg.Name },
        diagrams: createdDiagrams, elements: createdElements, connectors: createdConnectors,
        tag505: tag505
    },
    counts: { packages: 1, diagrams: createdDiagrams.length, elements: createdElements.length, connectors: createdConnectors.length },
    guid: "" + srEl.ElementGUID, id: srEl.ElementID };
if (warns.length > 0) { res.warnings = warns; }
return res;
