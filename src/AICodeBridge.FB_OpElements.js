// AICodeBridge.FB_OpElements(Repository, op, reqId)
// create_or_update_elements - zrcadlo MCP toolu. Zapis vyhradne Automation API.
// op.elements = [ {
//   guid | elementID          -> UPDATE; jinak CREATE
//   package                   -> cil CREATE ("{GUID}" | packageID | jmeno).
//                                U UPDATU element NEPRESOUVA (iterace 6,
//                                nalez N-2) - vraci warning a odkazuje na
//                                operaci move_elements.
//   owningElement             -> alternativa: create POD elementem (napr. BRU pod UC)
//   name                      -> jmeno (chybejici = "" - nepojmenovane instance/lifeliny)
//   type                      -> povinne na create; na UPDATE = ZMENA TYPU (bonus K7,
//                                napr. Object -> Component; nahrazuje FIX skript)
//   stereotypes               -> string nebo pole; PLAIN jmena (par. 7h), sklada se do StereotypeEx
//   notes | description       -> poznamky plain; notes_b64 = base64 UTF-8 zaloha
//   alias, multiplicity, status
//   author, version           -> bonus K6 (zapis Version/Author)
//   classifierID | classifier -> classifier (id | "{GUID}" | $ref)
//   isComposite               -> bonus K8 (true/false)
//   compositeDiagram          -> bonus K8: SetCompositeDiagram (diagramID | "{GUID}")
//   taggedValues              -> [{name, value} | {name, ids:[{type,id}]}] (par. 7h)
//   dedupKey                  -> OPT-IN (audit B2, K4): stabilni klientsky klic; na create
//                                se zapise jako TV ai.dedup, pri dalsim behu se element
//                                najde podle nej (prezije prejmenovani). Poradi lookupu:
//                                guid -> dedupKey -> matchByName.
//   matchByName: true         -> OPT-IN (audit B2, K1): pred create hledani dle
//                                jmena/aliasu OMEZENE na cilovy package (Package_ID
//                                + ParentID = 0) / parent element (ParentID). Presne
//                                1 nalez = UPDATE nalezeneho; >1 = E_AMBIGUOUS.
//                                Default off - chovani stavajicich davek se NEMENI
//                                (duplicitni jmena zustavaji legitimni).
// } ]
// Vysledek: items = [{guid, id, name, created}] + warnings. Razitka ai.channel/ai.request.
if (!op || !op.elements || Object.prototype.toString.call(op.elements) != "[object Array]" || op.elements.length == 0) {
    return { op: "create_or_update_elements", status: "error", code: "E_ARGS", message: "Povinne: elements (neprazdne pole)." };
}
var items = [], warns = [];
this._fbOpProgress = { items: items }; // W3: polozky pred pripadnou vyjimkou (E_PERMISSION / E_LOCKED)
for (var i = 0; i < op.elements.length; i++) {
    var e = op.elements[i];
    var el = null, created = false, matchedBy = "";
    // --- UPDATE cil ---
    // FB-PU-25 (Z261004b-7): `id` z vysledku drivejsi operace je klic upravy
    // (FB_FieldCheck ho v P2 prepise na elementID; tady druha obrana pro
    // textovy rezim a prime volani)
    var eKey = e.guid || e.elementID || e.id;
    if (eKey) {
        el = this.FB_ResolveEl(Repository, eKey);
        if (el == null) {
            return this.FB_ResolveFail("create_or_update_elements", "elements[" + i + "]: element nenalezen (" + eKey + ")", items);
        }
        var chkU = this.FB_CheckWriteEl(Repository, el); // osa balicku + osa vlastniku (I14)
        if (chkU != null) { return { op: "create_or_update_elements", status: "error", code: chkU.code, message: "elements[" + i + "]: " + chkU.message, items: items }; }
        if (e.type) { el.Type = "" + e.type; } // K7: zmena typu elementu
    } else {
        // --- CREATE (s OPT-IN idempotenci - audit B2: dedupKey K4, matchByName K1) ---
        if (!e.type) {
            return { op: "create_or_update_elements", status: "error", code: "E_ARGS",
                message: "elements[" + i + "]: create vyzaduje type (a package nebo owningElement); pro upravu existujiciho prvku pouzij guid nebo elementID (id z vysledku).", items: items };
        }
        var nm = (typeof e.name == "undefined" || e.name === null) ? "" : ("" + e.name);
        // K4: dedupKey lookup (globalni TV ai.dedup - prezije prejmenovani i presun)
        if (e.dedupKey) {
            var dfE = this.FB_DedupFind(Repository, "element", "" + e.dedupKey);
            if (dfE.count > 1) {
                return { op: "create_or_update_elements", status: "error", code: "E_AMBIGUOUS",
                    message: "elements[" + i + "]: dedupKey '" + e.dedupKey + "' odpovida " + dfE.count + " elementum.",
                    guids: dfE.guids, items: items };
            }
            if (dfE.count == 1) {
                el = dfE.obj;
                var chkD = this.FB_CheckWriteEl(Repository, el); // cil dohledany pres dedupKey (kap. 5.6)
                if (chkD != null) { return { op: "create_or_update_elements", status: "error", code: chkD.code, message: "elements[" + i + "]: " + chkD.message, items: items }; }
                if (e.type) { el.Type = "" + e.type; } // parita s UPDATE cestou (K7)
                matchedBy = "dedupKey";
            }
        }
        if (el == null && e.matchByName && nm == "") {
            warns.push("elements[" + i + "]: matchByName ignorovan - prazdne jmeno (nepojmenovane instance nemaji klic).");
        }
        if (el == null && e.owningElement) {
            var owner = this.FB_ResolveEl(Repository, e.owningElement);
            if (owner == null) { return this.FB_ResolveFail("create_or_update_elements", "elements[" + i + "]: owningElement nenalezen (" + e.owningElement + ").", items); }
            var chkO = this.FB_CheckWriteEl(Repository, owner);
            if (chkO != null) { return { op: "create_or_update_elements", status: "error", code: chkO.code, message: "elements[" + i + "]: " + chkO.message, items: items }; }
            if (e.matchByName && nm != "") {
                // K1: scoped na parent element (ParentID) - FB_ResolveEl je globalni, proto vlastni dotaz
                var escO = nm.replace(/'/g, "''");
                var rowsO;
                try {
                    rowsO = this.FB_XmlRows(Repository.SQLQuery(
                        "SELECT ea_guid FROM t_object WHERE ParentID = " + owner.ElementID +
                        " AND (Name = '" + escO + "' OR Alias = '" + escO + "')"));
                } catch (eMO) {
                    return { op: "create_or_update_elements", status: "error", code: "E_EXCEPTION", message: "elements[" + i + "]: matchByName lookup selhal: " + eMO.message, items: items };
                }
                if (rowsO.length > 1) {
                    var ambO = [];
                    for (var oj = 0; oj < rowsO.length; oj++) { ambO.push("" + rowsO[oj].ea_guid); }
                    return { op: "create_or_update_elements", status: "error", code: "E_AMBIGUOUS",
                        message: "elements[" + i + "]: jmeno/alias '" + nm + "' odpovida " + rowsO.length + " elementum pod owningElement - rozliseni vyzaduje guid nebo dedupKey.",
                        guids: ambO, items: items };
                }
                if (rowsO.length == 1) {
                    try { el = Repository.GetElementByGuid("" + rowsO[0].ea_guid); } catch (eGO) { el = null; }
                    if (el != null) { if (e.type) { el.Type = "" + e.type; } matchedBy = "name"; }
                }
            }
            if (el == null) {
                el = owner.Elements.AddNew(nm, "" + e.type);
                if (!el.Update()) { return { op: "create_or_update_elements", status: "error", code: "E_EXCEPTION", message: "elements[" + i + "]: Update selhal: " + el.GetLastError(), items: items }; }
                owner.Elements.Refresh();
                created = true;
            }
        } else if (el == null) {
            var pkg = this.FB_ResolvePkg(Repository, e["package"]);
            if (pkg == null) { return this.FB_ResolveFail("create_or_update_elements", "elements[" + i + "]: package nenalezen (" + ((e["package"] && e["package"].path) ? "path " + e["package"].path.join(".") : e["package"]) + ")", items); }
            var chkC = this.FB_CheckWrite(Repository, pkg);
            if (chkC != null) { return { op: "create_or_update_elements", status: "error", code: chkC.code, message: "elements[" + i + "]: " + chkC.message, items: items }; }
            if (e.matchByName && nm != "") {
                // K1: scoped na cilovy package (Package_ID + ParentID = 0 = primo v package)
                var escP = nm.replace(/'/g, "''");
                var rowsP;
                try {
                    rowsP = this.FB_XmlRows(Repository.SQLQuery(
                        "SELECT ea_guid FROM t_object WHERE Package_ID = " + pkg.PackageID +
                        " AND ParentID = 0 AND (Name = '" + escP + "' OR Alias = '" + escP + "')"));
                } catch (eMP) {
                    return { op: "create_or_update_elements", status: "error", code: "E_EXCEPTION", message: "elements[" + i + "]: matchByName lookup selhal: " + eMP.message, items: items };
                }
                if (rowsP.length > 1) {
                    var ambP = [];
                    for (var pj2 = 0; pj2 < rowsP.length; pj2++) { ambP.push("" + rowsP[pj2].ea_guid); }
                    return { op: "create_or_update_elements", status: "error", code: "E_AMBIGUOUS",
                        message: "elements[" + i + "]: jmeno/alias '" + nm + "' odpovida " + rowsP.length + " elementum v cilovem package - rozliseni vyzaduje guid nebo dedupKey.",
                        guids: ambP, items: items };
                }
                if (rowsP.length == 1) {
                    try { el = Repository.GetElementByGuid("" + rowsP[0].ea_guid); } catch (eGP) { el = null; }
                    if (el != null) { if (e.type) { el.Type = "" + e.type; } matchedBy = "name"; }
                }
            }
            if (el == null) {
                el = pkg.Elements.AddNew(nm, "" + e.type);
                if (!el.Update()) { return { op: "create_or_update_elements", status: "error", code: "E_EXCEPTION", message: "elements[" + i + "]: Update selhal: " + el.GetLastError(), items: items }; }
                pkg.Elements.Refresh();
                created = true;
            }
        }
    }
    // FB-PU-26 (Z261004b-7): polozka jde do items HNED, jak prvek v modelu
    // existuje (vznikl nebo byl dohledan) - vyjimka EA pri zapisu vlastnosti
    // (zamek, pravo) uz GUID neztrati; FB_Main ji pripoji k odpovedi (partial)
    var itE = { guid: "" + el.ElementGUID, id: el.ElementID, name: "" + el.Name, created: created, index: i };
    if (matchedBy != "") { itE.matchedBy = matchedBy; }
    items.push(itE);
    // --- spolecne vlastnosti ---
    // ITERACE 6 (nalez N-2): `package` u UPDATU element NEPRESOUVA. Drive se
    // pole tise ignorovalo a odpoved hlasila ok (FALESNE OK bez warningu);
    // od iterace 6 je z toho viditelny warning (chat ACK ho nese, par. 3a).
    // Presun ma vyhradne operace move_elements - rozhodnuti Milos 2026-08-21.
    if (!created && typeof e["package"] != "undefined" && e["package"] !== null && ("" + e["package"]) != "") {
        var wpk = null;
        try { wpk = this.FB_ResolvePkg(Repository, e["package"]); } catch (eWp) { wpk = null; }
        if (wpk == null || wpk.PackageID != el.PackageID) {
            warns.push("elements[" + i + "]: pole 'package' u existujiciho elementu NEPRESOUVA - element zustava v package id "
                + el.PackageID + ". Na presun mezi packages pouzij operaci move_elements.");
        }
    }
    if (!created && typeof e.name != "undefined" && e.name !== null) { el.Name = "" + e.name; }
    if (typeof e.alias != "undefined") { el.Alias = "" + e.alias; }
    if (e.stereotypes) {
        var st = e.stereotypes;
        if (Object.prototype.toString.call(st) == "[object Array]") { st = st.join(","); }
        el.StereotypeEx = "" + st;
    }
    if (e.notes_b64) { el.Notes = this.B64Decode(e.notes_b64); }
    else if (typeof e.notes != "undefined") { el.Notes = "" + e.notes; }
    else if (typeof e.description != "undefined") { el.Notes = "" + e.description; }
    if (typeof e.multiplicity != "undefined") { el.Multiplicity = "" + e.multiplicity; }
    if (typeof e.status != "undefined") { el.Status = "" + e.status; }
    if (typeof e.author != "undefined") { el.Author = "" + e.author; }     // K6
    if (typeof e.version != "undefined") { el.Version = "" + e.version; }  // K6
    if (typeof e.classifierID != "undefined") { el.ClassifierID = parseInt(e.classifierID, 10); }
    else if (e.classifier) {
        var cl = this.FB_ResolveEl(Repository, e.classifier);
        if (cl == null) { warns.push("elements[" + i + "]: classifier nenalezen - preskocen"); }
        else { el.ClassifierID = cl.ElementID; }
    }
    if (typeof e.isComposite != "undefined") { el.IsComposite = e.isComposite ? true : false; } // K8
    if (!el.Update()) {
        return { op: "create_or_update_elements", status: "error", code: "E_EXCEPTION",
            message: "elements[" + i + "]: Update selhal: " + el.GetLastError(), items: items };
    }
    // K8: klikatelny kompozitni diagram
    if (e.compositeDiagram) {
        try {
            var dg = null;
            var dref = "" + e.compositeDiagram;
            if (dref.charAt(0) == "{") { dg = Repository.GetDiagramByGuid(dref); }
            else { dg = Repository.GetDiagramByID(parseInt(dref, 10)); }
            if (dg != null) { el.SetCompositeDiagram("" + dg.DiagramGUID); }
            else { warns.push("elements[" + i + "]: compositeDiagram nenalezen"); }
        } catch (eCD) { warns.push("elements[" + i + "]: SetCompositeDiagram selhal: " + eCD.message); }
    }
    // --- tagged values + razitka (detektivni model) ---
    var w2 = this.FB_TagWrite(Repository, el, e.taggedValues);
    for (var wj = 0; wj < w2.length; wj++) { warns.push("elements[" + i + "]: " + w2[wj]); }
    if (created) { this.SetTag(el, "ai.channel", "eafb"); }
    if (created && e.dedupKey) { this.SetTag(el, "ai.dedup", "" + e.dedupKey); } // K4: klic prezije prejmenovani
    this.SetTag(el, "ai.request", "" + reqId);
    itE.name = "" + el.Name; // jmeno po zapisu vlastnosti (create s name, update s prejmenovanim)
}
var res = { op: "create_or_update_elements", status: "ok", count: items.length, items: items };
if (items.length > 0) { res.guid = items[0].guid; res.id = items[0].id; }
if (warns.length > 0) { res.warnings = warns; }
return res;
