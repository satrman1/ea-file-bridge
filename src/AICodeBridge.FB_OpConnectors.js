// AICodeBridge.FB_OpConnectors(Repository, op, reqId)
// create_or_update_connectors - zrcadlo MCP toolu.
// op.connectors = [ {
//   guid | connectorID   -> UPDATE; jinak CREATE
//   source, target       -> elementy ("{GUID}" | id | jmeno | $ref) - povinne na create
//   type                 -> "Association", "Realization", "Dependency", "Usage", ...
//   stereotypes          -> string/pole, plain jmena ("use", "refine", ...)
//   name, notes | description
//   direction            -> enum par. 7h: FromSourceToTarget | FromTargetToSource
//                           | BothDirection | Unspecified (mapuje se na EA retezce)
//   sourceEnd, targetEnd -> { aggregation: 0|1|2, multiplicity: "0..*", role, navigable: true|false }
//                           (aggregation na tom konci, kde ma byt diamant - par. 7f)
//   taggedValues         -> vc. RefGUID ids struktury (505-1 Operation Link, par. 7h)
//   dedupKey             -> OPT-IN (audit B2, K4): stabilni klientsky klic; na create
//                           se zapise jako TV ai.dedup, pri dalsim behu se konektor
//                           najde podle nej (prezije prejmenovani). Poradi lookupu:
//                           guid -> dedupKey -> match.
//   match: "composite"   -> OPT-IN (audit B2, K2): pred create SQL lookup na
//                           t_connector dle kompozitu (Start_Object_ID,
//                           End_Object_ID, Connector_Type, Stereotype). Presne
//                           1 nalez = UPDATE nalezeneho; >1 nalez bez dedupKey
//                           = E_AMBIGUOUS s vyctem GUIDu. Default off - chovani
//                           stavajicich davek se NEMENI.
// } ]
// CIL ZAPISU (rezim blacklist, zadani v1.1 kap. 5.5, B2, Z261004b-10): kontrola
// se pocita nad konci SKUTECNEHO konektoru po dohledani (guid, dedupKey,
// match) a znovu nad NOVYMI konci, meni-li davka source/target:
//   create: zdroj chraneny -> cil volny = povoleno vzdy (O11 = c); zdroj volny
//           -> cil chraneny = podle allowIncomingRefs vetve (O3 = a, vychozi
//           true); oba konce chranene = E_BLACKLIST
//   update: zdroj existujici vazby v chranene casti = E_BLACKLIST (vlastni
//           vazba chraneneho prvku); presmerovani zdroje do chranene casti =
//           E_BLACKLIST; presmerovani cile podle allowIncomingRefs
// Osa vlastniku (I14) pres FB_CheckWriteEl. Prvni obrana je P2 (FB_ScopePrecheck).
// POZOR (par. 7g): Connector.Update() umi vratit false bez vyhozeni chyby -
// navratova hodnota se kontroluje VZDY; updaty direction davkovat po jednom.
if (!op || !op.connectors || Object.prototype.toString.call(op.connectors) != "[object Array]" || op.connectors.length == 0) {
    return { op: "create_or_update_connectors", status: "error", code: "E_ARGS", message: "Povinne: connectors (neprazdne pole)." };
}
var DIRMAP = {
    "FROMSOURCETOTARGET": "Source -> Destination",
    "FROMTARGETTOSOURCE": "Destination -> Source",
    "BOTHDIRECTION": "Bi-Directional",
    "UNSPECIFIED": "Unspecified"
};
var items = [], warns = [];
this._fbOpProgress = { items: items }; // W3: polozky pred pripadnou vyjimkou (E_PERMISSION / E_LOCKED)
var self = this;
function chkEl(el) { try { return self.FB_CheckWriteEl(Repository, el); } catch (eC) { return { code: "E_EXCEPTION", message: "kontrola cile selhala: " + eC.message }; } }
function allowIn(r) { return !(r && r.branch && r.branch.allowIncomingRefs === false); }
function applyEnd(end, spec, label) {
    if (!spec) { return; }
    if (typeof spec.aggregation != "undefined") { end.Aggregation = parseInt(spec.aggregation, 10); }
    if (typeof spec.multiplicity != "undefined") { end.Cardinality = "" + spec.multiplicity; }
    if (typeof spec.role != "undefined") { end.Role = "" + spec.role; }
    if (typeof spec.navigable != "undefined") { end.Navigable = spec.navigable ? "Navigable" : "Non-Navigable"; }
    if (!end.Update()) { warns.push(label + ": end.Update() vratil false"); }
}
for (var i = 0; i < op.connectors.length; i++) {
    var c = op.connectors[i];
    var conn = null, created = false, srcEl = null, tgtEl = null, matchedBy = "";
    if (c.guid || c.connectorID) {
        try {
            if (c.guid) { conn = Repository.GetConnectorByGuid("" + c.guid); }
            else { conn = Repository.GetConnectorByID(parseInt(c.connectorID, 10)); }
        } catch (eG) { conn = null; }
        if (conn == null) { return { op: "create_or_update_connectors", status: "error", code: "E_NOT_FOUND", message: "connectors[" + i + "]: konektor nenalezen.", items: items }; }
        srcEl = Repository.GetElementByID(conn.ClientID);
        tgtEl = Repository.GetElementByID(conn.SupplierID);
    } else {
        if (!c.source || !c.target || !c.type) {
            return { op: "create_or_update_connectors", status: "error", code: "E_ARGS", message: "connectors[" + i + "]: create vyzaduje source, target, type.", items: items };
        }
        srcEl = this.FB_ResolveEl(Repository, c.source);
        if (srcEl == null) { return this.FB_ResolveFail("create_or_update_connectors", "connectors[" + i + "]: source nenalezen (" + c.source + ").", items); }
        tgtEl = this.FB_ResolveEl(Repository, c.target);
        if (tgtEl == null) { return this.FB_ResolveFail("create_or_update_connectors", "connectors[" + i + "]: target nenalezen (" + c.target + ").", items); }
        // --- OPT-IN idempotence (audit B2): dedupKey (K4) -> match composite (K2) ---
        if (typeof c.match != "undefined" && c.match !== null && ("" + c.match) != "" && ("" + c.match).toLowerCase() != "composite") {
            return { op: "create_or_update_connectors", status: "error", code: "E_ARGS",
                message: "connectors[" + i + "]: match podporuje jen hodnotu 'composite'.", items: items };
        }
        if (c.dedupKey) {
            var df = this.FB_DedupFind(Repository, "connector", "" + c.dedupKey);
            if (df.count > 1) {
                return { op: "create_or_update_connectors", status: "error", code: "E_AMBIGUOUS",
                    message: "connectors[" + i + "]: dedupKey '" + c.dedupKey + "' odpovida " + df.count + " konektorum.",
                    guids: df.guids, items: items };
            }
            if (df.count == 1) { conn = df.obj; matchedBy = "dedupKey"; }
        }
        if (conn == null && c.match && ("" + c.match).toLowerCase() == "composite") {
            var stPrim = "";
            if (c.stereotypes) {
                var stM = c.stereotypes;
                if (Object.prototype.toString.call(stM) == "[object Array]") { stM = (stM.length > 0 ? stM[0] : ""); }
                stPrim = ("" + stM).split(",")[0].replace(/^\s+|\s+$/g, "");
            }
            var sqlC = "SELECT ea_guid FROM t_connector WHERE Start_Object_ID = " + srcEl.ElementID +
                " AND End_Object_ID = " + tgtEl.ElementID +
                " AND Connector_Type = '" + ("" + c.type).replace(/'/g, "''") + "' AND " +
                (stPrim == "" ? "(Stereotype IS NULL OR Stereotype = '')" : "Stereotype = '" + stPrim.replace(/'/g, "''") + "'");
            var rowsC;
            try { rowsC = this.FB_XmlRows(Repository.SQLQuery(sqlC)); }
            catch (eCM) {
                return { op: "create_or_update_connectors", status: "error", code: "E_EXCEPTION",
                    message: "connectors[" + i + "]: kompozitni lookup selhal: " + eCM.message, items: items };
            }
            if (rowsC.length > 1 && !c.dedupKey) {
                var ambG = [];
                for (var aj = 0; aj < rowsC.length; aj++) { ambG.push("" + rowsC[aj].ea_guid); }
                return { op: "create_or_update_connectors", status: "error", code: "E_AMBIGUOUS",
                    message: "connectors[" + i + "]: kompozit (source, target, type, stereotyp) odpovida " + rowsC.length + " konektorum - rozliseni vyzaduje dedupKey nebo guid.",
                    guids: ambG, items: items };
            }
            if (rowsC.length == 1) {
                try { conn = Repository.GetConnectorByGuid("" + rowsC[0].ea_guid); } catch (eCG) { conn = null; }
                if (conn != null) { matchedBy = "composite"; }
            }
        }
    }
    // --- pravidlo vazeb nad SKUTECNYMI konci (B2) a NOVYMI konci ---
    var ns = null, nt = null;
    if (conn != null) {
        var realSrc = null, realTgt = null;
        try { realSrc = Repository.GetElementByID(conn.ClientID); realTgt = Repository.GetElementByID(conn.SupplierID); } catch (eRe) { realSrc = null; }
        var chkRS = (realSrc != null) ? chkEl(realSrc) : { code: "E_EXCEPTION", message: "zdroj konektoru nelze nacist" };
        if (chkRS != null) {
            return { op: "create_or_update_connectors", status: "error", code: chkRS.code,
                message: "connectors[" + i + "]: zdroj existujici vazby" + (realSrc ? " ('" + realSrc.Name + "')" : "") + " lezi v chranene casti - zmena vazby chraneneho prvku neni povolena. " + chkRS.message, items: items };
        }
        if (c.source) {
            ns = this.FB_ResolveEl(Repository, c.source);
            if (ns == null) { return this.FB_ResolveFail("create_or_update_connectors", "connectors[" + i + "]: novy source nenalezen (" + c.source + ").", items); }
            var chkNS = chkEl(ns);
            if (chkNS != null) {
                return { op: "create_or_update_connectors", status: "error", code: chkNS.code,
                    message: "connectors[" + i + "]: novy zdroj vazby ('" + ns.Name + "') lezi v chranene casti - presmerovani zdroje do chranene casti neni povolene. " + chkNS.message, items: items };
            }
        }
        if (c.target) {
            nt = this.FB_ResolveEl(Repository, c.target);
            if (nt == null) { return this.FB_ResolveFail("create_or_update_connectors", "connectors[" + i + "]: novy target nenalezen (" + c.target + ").", items); }
            var chkNT = chkEl(nt);
            if (chkNT != null && (chkNT.code != "E_BLACKLIST" || !allowIn(chkNT))) {
                return { op: "create_or_update_connectors", status: "error", code: chkNT.code,
                    message: "connectors[" + i + "]: novy cil vazby ('" + nt.Name + "') lezi v chranene vetvi s allowIncomingRefs: false. " + chkNT.message, items: items };
            }
        }
    } else {
        var chkS = chkEl(srcEl);
        var chkT = chkEl(tgtEl);
        if (chkS != null && chkS.code != "E_BLACKLIST") { return { op: "create_or_update_connectors", status: "error", code: chkS.code, message: "connectors[" + i + "]: " + chkS.message, items: items }; }
        if (chkT != null && chkT.code != "E_BLACKLIST") { return { op: "create_or_update_connectors", status: "error", code: chkT.code, message: "connectors[" + i + "]: " + chkT.message, items: items }; }
        if (chkS != null && chkT != null) {
            return { op: "create_or_update_connectors", status: "error", code: "E_BLACKLIST",
                message: "connectors[" + i + "]: oba konce vazby lezi v chranene casti. " + chkS.message, items: items };
        }
        if (chkT != null && chkS == null && !allowIn(chkT)) {
            return { op: "create_or_update_connectors", status: "error", code: "E_BLACKLIST",
                message: "connectors[" + i + "]: cil vazby ('" + tgtEl.Name + "') lezi v chranene vetvi s allowIncomingRefs: false - vazba z volne casti do ni neni povolena. " + chkT.message, items: items };
        }
        // zdroj chraneny -> cil volny: povoleno vzdy (O11 = c, krok 4b katalogu)
    }
    if (conn == null) {
        conn = srcEl.Connectors.AddNew((typeof c.name == "undefined" ? "" : "" + c.name), "" + c.type);
        conn.SupplierID = tgtEl.ElementID;
        created = true;
    } else {
        if (typeof c.name != "undefined" && c.name !== null) { conn.Name = "" + c.name; }
        if (c.type) { conn.Type = "" + c.type; }
        if (ns != null) { conn.ClientID = ns.ElementID; }
        if (nt != null) { conn.SupplierID = nt.ElementID; }
    }
    if (c.stereotypes) {
        var st = c.stereotypes;
        if (Object.prototype.toString.call(st) == "[object Array]") { st = st.join(","); }
        conn.StereotypeEx = "" + st;
    }
    if (c.notes_b64) { conn.Notes = this.B64Decode(c.notes_b64); }
    else if (typeof c.notes != "undefined") { conn.Notes = "" + c.notes; }
    else if (typeof c.description != "undefined") { conn.Notes = "" + c.description; }
    if (c.direction) {
        var dk = ("" + c.direction).toUpperCase();
        if (typeof DIRMAP[dk] == "undefined") {
            return { op: "create_or_update_connectors", status: "error", code: "E_ARGS",
                message: "connectors[" + i + "]: direction musi byt FromSourceToTarget | FromTargetToSource | BothDirection | Unspecified.", items: items };
        }
        conn.Direction = DIRMAP[dk];
    }
    if (!conn.Update()) {
        return { op: "create_or_update_connectors", status: "error", code: "E_EXCEPTION",
            message: "connectors[" + i + "]: Connector.Update() selhal: " + conn.GetLastError(), items: items };
    }
    applyEnd(conn.ClientEnd, c.sourceEnd, "connectors[" + i + "].sourceEnd");
    applyEnd(conn.SupplierEnd, c.targetEnd, "connectors[" + i + "].targetEnd");
    var w2 = this.FB_TagWrite(Repository, conn, c.taggedValues);
    for (var wj = 0; wj < w2.length; wj++) { warns.push("connectors[" + i + "]: " + w2[wj]); }
    if (created) { this.SetTag(conn, "ai.channel", "eafb"); }
    if (created && c.dedupKey) { this.SetTag(conn, "ai.dedup", "" + c.dedupKey); } // K4: klic prezije prejmenovani
    this.SetTag(conn, "ai.request", "" + reqId);
    if (created) { srcEl.Connectors.Refresh(); }
    var itC = { guid: "" + conn.ConnectorGUID, id: conn.ConnectorID, type: "" + conn.Type, created: created };
    if (matchedBy != "") { itC.matchedBy = matchedBy; }
    items.push(itC);
}
var res = { op: "create_or_update_connectors", status: "ok", count: items.length, items: items };
if (items.length > 0) { res.guid = items[0].guid; res.id = items[0].id; }
if (warns.length > 0) { res.warnings = warns; }
return res;
