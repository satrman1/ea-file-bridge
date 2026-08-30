// AICodeBridge.FB_ChatRender(resp)
// CHAT VERZE response (zadani iterace 4 par. 3.3 + ITERACE 7 "schrankovy
// kanal", zadani v1.1 2026-08-30) - text pro schranku/Copilot. Vstup:
// parsovany response objekt. Pravidla:
//  - NIKDY plny payloadHash ani nonce (jen hashPrefix, par. 6.3/B1);
//  - NIKDY tichy orez (W10): pri preteceni rozpoctu ukazatel na res soubor;
//    orez se provadi PO HRANICICH POLOZEK - ACK nikdy nenese neuplny GUID
//    (W2, par. 4.4); zadny substring cut vysledneho retezce;
//  - priorita orezu (par. 4.4): 1. warningy + chybovy kod (prvni radek),
//    2. GUIDy polozek, 3. jmena, 4. typy/cesty/doprovodna pole. Dojde-li
//    rozpocet, zahazuji se nejdriv jmena a nechavaji GUIDy, ne naopak;
//  - PROJEKCE = JEN IDENTITA, NIKDY OBSAH (par. 4.2): guid/name/type/path.
//    Nikdy notes, XMLContent, raw, rtf_b64, png_b64, tela scenaru;
//  - chat ACK NENI jediny zaznam (I3) - plne rows/items ziji v res-*.json;
//    od iterace 7 ale ACK nese IDENTITU vysledku (GUID + jmeno), aby byl
//    retry kontrakt par. 5a proveditelny i ve schrankovem kanalu;
//  - vyjimka B3 (par. 4.1): constraints/requirements polozky GUID nemaji
//    (v datovem modelu EA neexistuje) - identita = element GUID (res.guid)
//    + name+type polozky; oprava = rebuild kompletni sady na element;
//  - rowCount 0 se NIKDY neinterpretuje jako "data neexistuji" (lekce T4-3c);
//  - QC tri stavy ODDELENE od zapisu (par. 3.4/W6): ciste | NALEZ | nedobehlo;
//  - WARNINGS (nalez POC N-7): pocet + prvni warning do PRVNIHO RADKU ACK,
//    plny vycet v res-<id>.json; bezwarningova davka ma ACK beze zmeny;
//  - E_REPO pojmenuje pripojeny repozitar (par. 4.6; basename souborove
//    cesty - strucnost ACK, ne bezpecnostni plot).
var self = this;
// --- rozpocty (par. 4.3): DEFAULTY ZIJI V KODU; FB_Config sekce "chat" je
// jen volitelny per-repo prepis. Repo bez polozky jede na defaultech -
// zadny undefined ani tichy navrat k zadratovani (W6).
var BUD = { total: 4000, perOp: 900, items: 25, query: 700, warn: 500 };
try {
    var ridB = "" + ((resp && resp.repository) ? resp.repository : "");
    if (ridB !== "") {
        var cfgsB = this.FB_Config();
        var ridBU = ridB.toUpperCase();
        for (var bc = 0; bc < cfgsB.length; bc++) {
            var cB = cfgsB[bc];
            if (!cB || !cB.chat) { continue; }
            if (ridBU.indexOf(("" + cB.repo).toUpperCase()) < 0) { continue; }
            if (typeof cB.chat.total == "number") { BUD.total = cB.chat.total; }
            if (typeof cB.chat.perOp == "number") { BUD.perOp = cB.chat.perOp; }
            if (typeof cB.chat.items == "number") { BUD.items = cB.chat.items; }
            if (typeof cB.chat.query == "number") { BUD.query = cB.chat.query; }
            if (typeof cB.chat.warn == "number") { BUD.warn = cB.chat.warn; }
            break;
        }
    }
} catch (eBud) { /* defaulty v kodu plati */ }
if (resp === null || typeof resp == "undefined") { return "EAFB: response nedostupna."; }
var st = "" + resp.status;
var id = "" + (resp.id || "?");
var code = "" + (resp.code || "");
var results = resp.results || [];
var ops = results.length, okc = 0, errIdx = -1, errRes = null;
for (var i = 0; i < results.length; i++) {
    var r0 = results[i] || {};
    if (("" + r0.status) == "ok") { okc++; }
    if (("" + r0.status) == "error" && errIdx < 0) { errIdx = i; errRes = r0; }
}
// GUID-safe clip (W2): kdyz by rez pristal uvnitr {...}, rizne se PRED "{"
// - ACK nikdy nenese neuplny GUID, ani v chybove hlasce.
function clip(s, n) {
    s = "" + s;
    if (s.length <= n) { return s; }
    var cut = s.substring(0, n);
    var ob = cut.lastIndexOf("{"), cb = cut.lastIndexOf("}");
    if (ob > cb) { cut = cut.substring(0, ob); }
    return cut + "...";
}
// ------------------------------------------------------------------ PROJEKCNI
// TABULKA (zadani iterace 7 par. 4.1/4.2; normativni zdroj = Priloha A
// red team reportu RedTeam-Zadani-Iterace-7-Schrankovy-Kanal-2026-08.md).
// Tabulka zije V KODU (vzor SCOPE tabulky Baseline politiky); uplnost proti
// registru REG (FB_Main) hlida harness, kriterium 11' - nova operace bez
// zaznamu zde = cerveny harness.
//   cls:  "A" = count+items[] genericka vetev (27 ops)
//         "B" = query rows[] (1 op)
//         "C" = singleton s vlastni projekci (8 ops)
//         "D" = ciselne shrnuti bez items[] (6 ops, diagramova rodina)
//   f:    identitni pole polozky, ktera smi do chatu (guid/name/type/...)
//   b3:   vyjimka B3 - polozky bez GUID; identita = element GUID (res.guid)
//         + name+type, jmena se proto drzi na vsech urovnich orezu
//   file: souborovy vystup - ACK nese cestu + vetu, ze obsah schrankou
//         neprojde (par. 3 zadani; rtf_b64/png_b64 NIKDY)
//   msgCount: vnorene messages[] jen poctem (par. 4.2)
var PROJ = {
    "ping":                              { cls: "C" },
    "query":                             { cls: "B" },
    "get_selected_context":              { cls: "C" },
    "find_elements_by_name":             { cls: "A", f: ["guid", "name", "type"] },
    "find_packages_by_name":             { cls: "A", f: ["guid", "name"] },
    "get_elements_information":          { cls: "A", f: ["guid", "name", "type", "stereotype"] },
    "get_packages_information":          { cls: "A", f: ["guid", "name", "path"] },
    "get_connectors_information":        { cls: "A", f: ["guid", "name", "type"] },
    "get_diagrams_information":          { cls: "A", f: ["guid", "name", "type"], msgCount: true },
    "get_baselines":                     { cls: "A", f: ["guid", "version"] },
    "baseline_diff":                     { cls: "C" },
    "export_element_linked_documents":   { cls: "A", f: ["file"], file: true },
    "create_element":                    { cls: "C" },
    "create_or_update_elements":         { cls: "A", f: ["guid", "name"] },
    "move_elements":                     { cls: "A", f: ["guid", "name"] },
    "create_or_update_package":          { cls: "A", f: ["guid", "name"] },
    "create_or_update_connectors":       { cls: "A", f: ["guid", "name"] },
    "create_or_update_attributes":       { cls: "A", f: ["guid", "name"] },
    "create_or_update_operations":       { cls: "A", f: ["guid", "name"] },
    "create_or_update_messages":         { cls: "A", f: ["guid", "name"] },
    "delete_from_model":                 { cls: "A", f: ["name", "type"] },
    "delete_taggedvalue_from_model":     { cls: "A", f: ["name", "type"] },
    "remove_elements_from_diagram":      { cls: "D" },
    "create_baseline":                   { cls: "C" },
    "clone_package":                     { cls: "C" },
    "clone_elements":                    { cls: "A", f: ["guid", "name"] },
    "import_element_linked_documents":   { cls: "A", f: ["guid"] },
    "layout_connectors":                 { cls: "D" },
    "change_connector_visibility":       { cls: "D" },
    "open_diagrams":                     { cls: "D" },
    "reload_diagrams":                   { cls: "D" },
    "update_diagram_properties":         { cls: "A", f: ["guid", "name"] },
    "set_diagram_object_style":          { cls: "D" },
    "create_or_update_diagram":          { cls: "A", f: ["guid", "name", "type"] },
    "place_elements_on_diagram":         { cls: "A", f: ["guid"] },
    "get_diagram_image":                 { cls: "A", f: ["file"], file: true },
    "create_or_update_scenarios":        { cls: "A", f: ["guid", "name", "type"] },
    "create_or_update_constraints":      { cls: "A", f: ["name", "type"], b3: true },
    "create_or_update_requirements":     { cls: "A", f: ["name", "type"], b3: true },
    "apply_classifier_stereotypes":      { cls: "A", f: ["name", "classifier"] },
    "find_or_create_referencing_sr":     { cls: "C" },
    "deploy_src":                        { cls: "C" }
};
function inArr(arr, v) {
    for (var xA = 0; xA < arr.length; xA++) { if (arr[xA] === v) { return true; } }
    return false;
}
// --- polozka tridy A podle urovne detailu (par. 4.4):
//   level 3 = guid + jmeno + typ/cesta/doprovod; 2 = guid + jmeno; 1 = guid.
//   Polozky BEZ guid (B3, delete, apply): jmeno JE identita - drzi se vzdy.
function fmtItem(it, pj, level) {
    it = it || {};
    var f = pj.f || [];
    if (pj.file) { return (it.file ? ("" + it.file) : "(cesta v res souboru)"); }
    var hasG = inArr(f, "guid");
    var name = (inArr(f, "name") && it.name) ? ("" + it.name) : "";
    var guid = (hasG && it.guid) ? ("" + it.guid) : "";
    var parts = [];
    if (guid !== "") {
        if (level >= 2 && name !== "") { parts.push(name); }
        parts.push(guid);
    } else if (name !== "") {
        parts.push(name);
    }
    if (level >= 3) {
        if (inArr(f, "type") && it.type) { parts.push("(" + it.type + ")"); }
        else if (inArr(f, "stereotype") && it.stereotype) { parts.push("(" + it.stereotype + ")"); }
        if (inArr(f, "version") && it.version) { parts.push("v" + it.version); }
        if (inArr(f, "classifier") && it.classifier) { parts.push("->" + it.classifier); }
        if (inArr(f, "path") && it.path) { parts.push("path=" + it.path); }
        if (pj.msgCount && it.messages && it.messages.length) { parts.push("[zprav: " + it.messages.length + "]"); }
    } else if (guid === "" && inArr(f, "type") && it.type) {
        parts.push("(" + it.type + ")"); // bez guid je typ soucast identity (B3)
    }
    return parts.join(" ");
}
// --- segment tridy A: hlavicka + polozky do perOp/items rozpoctu, orez
// VZDY po celych polozkach + ukazatel (W10/W2)
function segA(rr, idx, pj, level) {
    var items = rr.items;
    var cnt = (typeof rr.count == "number") ? rr.count : (items ? items.length : null);
    if (cnt === null && !items) { return ""; } // legacy/degenerovany tvar bez dat - neni co projektovat
    items = items || [];
    var head2 = "\nop[" + idx + "] " + (rr.op || "?") + ": " + cnt + " polozek";
    if (typeof rr.removed == "number") { head2 += ", removed " + rr.removed; }
    if (typeof rr.changedCount == "number") { head2 += ", changed " + rr.changedCount; }
    if (pj.b3) {
        if (rr.guid) { head2 += ", element " + rr.guid; }
        head2 += " (B3: polozky bez GUID - oprava dle par. 5a = rebuild kompletni sady na element)";
    }
    if (pj.file) { head2 += " - souborovy vystup, obsah schrankou NEPROJDE (par. 3), soubory v responses\\"; }
    var cap = (items.length < BUD.items) ? items.length : BUD.items;
    var buf = [], used = head2.length, shown = 0;
    for (var k = 0; k < cap; k++) {
        var s1 = fmtItem(items[k], pj, level);
        if (s1 === "") { shown++; continue; }
        if ((used + s1.length + 2) > BUD.perOp) { break; }
        buf.push(s1); used += s1.length + 2; shown++;
    }
    var o2 = head2;
    if (buf.length > 0) { o2 += ": " + buf.join("; "); }
    if (shown < items.length) {
        o2 += " (zobrazeno prvnich " + shown + " z " + items.length + " - plny seznam v res-" + id + ".json)";
    }
    return o2;
}
// --- segment tridy B (query): level 3 = dnesni vycuc radku; nizsi urovne
// jen pocet + ukazatel (radky jsou "doprovod" dle priority par. 4.4)
function segB(rr, idx, level) {
    var rc = (typeof rr.rowCount == "number") ? rr.rowCount : -1;
    if (rc == 0) {
        return "\nop[" + idx + "] query: 0 radku - pozor, znamena jen 'dotaz nic nevratil', ne 'data neexistuji' (T4-3c).";
    }
    if (level < 3) {
        return "\nop[" + idx + "] query: " + rc + " radku (plna odpoved v res-" + id + ".json)";
    }
    var rows = rr.rows || [];
    var shown = 0, buf = [];
    for (var k = 0; k < rows.length; k++) {
        var rj = "";
        try { rj = "" + self.FB_JsonStringify(rows[k]); } catch (eJ) { rj = "(radek nejde serializovat)"; }
        if ((buf.join("; ").length + rj.length) > BUD.query) { break; }
        buf.push(rj);
        shown++;
    }
    var o3 = "\nop[" + idx + "] query: " + rc + " radku";
    if (buf.length > 0) { o3 += ": " + buf.join("; "); }
    if (shown < rc) { o3 += " (zobrazeno prvnich " + shown + " - plna odpoved v res-" + id + ".json)"; }
    return o3;
}
// --- segment tridy D: ciselne shrnuti + ukazatel, nikdy prazdny (B4)
function segD(rr, idx) {
    var n = null;
    if (typeof rr.count == "number") { n = rr.count; }
    else {
        var lists = ["changed", "connectorIDs", "opened", "reloaded", "removedElementIDs", "changedElementIDs"];
        for (var dL = 0; dL < lists.length; dL++) {
            var lv = rr[lists[dL]];
            if (lv && typeof lv.length == "number") { n = lv.length; break; }
        }
    }
    if (n === null) { n = "?"; }
    return "\nop[" + idx + "] " + (rr.op || "?") + ": " + n + " polozek (ID a detail v res-" + id + ".json)";
}
// --- bezpecny default (par. 4.2/B4): operace bez zaznamu v PROJ - op +
// status + ciselne shrnuti + ukazatel na res. NIKDY prazdny render u ok.
function segDefault(rr, idx) {
    var bits = [];
    var nums = ["count", "changed", "removed", "rowCount"];
    for (var nD = 0; nD < nums.length; nD++) {
        if (typeof rr[nums[nD]] == "number") { bits.push(nums[nD] + " " + rr[nums[nD]]); }
    }
    return "\nop[" + idx + "] " + (rr.op || "?") + ": " + (rr.status || "?")
        + (bits.length ? (" (" + bits.join(", ") + ")") : "")
        + " (detail v res-" + id + ".json)";
}
// --- singletony tridy C (par. 4.5 + Priloha A) ---
function segPing(rr, idx, level) {
    var s2 = "\nop[" + idx + "] ping: repo " + (rr.repository || "?");
    if (level >= 3 && rr.eaVersion) { s2 += " | EA " + rr.eaVersion; }
    var ac = rr.access;
    if (ac) {
        // z FB_UserAccess jde do chatu JEN access/securityEnabled/reason -
        // login a groups se nerenderuji (datova minimalizace, par. 4.5)
        s2 += " | pristup: " + (ac.access || "?") + " (security " + (ac.securityEnabled ? "zapnuta" : "vypnuta");
        if (level >= 3 && ac.reason) { s2 += "; " + clip(ac.reason, 200); }
        s2 += ")";
    }
    var wlA = rr.whitelist;
    if (wlA && wlA.length > 0) {
        var wbuf = [];
        for (var wx = 0; wx < wlA.length; wx++) {
            var w1 = wlA[wx] || {};
            var ws = "";
            if (level >= 2 && w1.name) { ws += w1.name + " "; }
            ws += (w1.guid || "?");
            if (level >= 3 && w1.path) { ws += " path=" + w1.path; } // plna cesta (par. 4.2, I5)
            if (w1.note) { ws += " (" + w1.note + ")"; }
            wbuf.push(ws);
        }
        s2 += " | whitelist: " + wbuf.join("; ");
    } else if (wlA) {
        // prazdny whitelist = explicitni veta, ne prazdne pole (par. 4.5)
        s2 += " | whitelist: PRAZDNY - repozitar nema zadny povoleny cil zapisu (bez zmeny FB_Whitelist zapis neprojde)";
    }
    // connection se do ACK nedava - identita je v repository (par. 4.5)
    return s2;
}
function segCtx(rr, idx, level) {
    var c = rr.context;
    if (!c) {
        return "\nop[" + idx + "] get_selected_context: zadny vyber v Project browseru - kontextove zadani nelze ukotvit, uved cil explicitne (GUID/jmeno).";
    }
    var s3 = "\nop[" + idx + "] get_selected_context: " + (c.type || "?") + " ";
    if (level >= 2 && c.name) { s3 += c.name + " "; }
    s3 += (c.guid || "?");
    if (level >= 3 && c.path) { s3 += " path=" + c.path; } // plna cesta (I5)
    s3 += " inWhitelist=" + (c.inWhitelist ? "true" : "false");
    if (level >= 3 && c.whitelistNote) { s3 += " (" + clip(c.whitelistNote, 120) + ")"; }
    if (rr.selectedElements && rr.selectedElements.length > 1) {
        s3 += " | multi-vyber " + rr.selectedElements.length + " prvku (GUIDy v res-" + id + ".json)";
    }
    if (level >= 3 && rr.currentDiagram) {
        s3 += " | diagram " + (rr.currentDiagram.name || "") + " " + (rr.currentDiagram.guid || "");
    }
    return s3;
}
function segC(rr, idx, level) {
    var opn = "" + rr.op;
    if (opn == "ping") { return segPing(rr, idx, level); }
    if (opn == "get_selected_context") { return segCtx(rr, idx, level); }
    if (opn == "baseline_diff") {
        var pairs = [];
        var sm = rr.summary || {};
        for (var sk in sm) { pairs.push(sk + " " + sm[sk]); }
        return "\nop[" + idx + "] baseline_diff: package " + (rr.packageGuid || "?")
            + " baseline " + (rr.baseline || "?") + " | zmeny: "
            + (pairs.length ? pairs.join(", ") : "zadne rozdily")
            + " (detail v res-" + id + ".json)";
    }
    if (opn == "create_baseline") {
        return "\nop[" + idx + "] create_baseline: package " + (rr.packageGuid || "?")
            + (rr.version ? (" -> baseline v" + rr.version) : " -> baseline vytvorena");
    }
    if (opn == "create_element") {
        return "\nop[" + idx + "] create_element: " + (rr.name || "?") + " " + (rr.guid || "?");
    }
    if (opn == "clone_package") {
        var vol = rr.volume || {};
        return "\nop[" + idx + "] clone_package: " + (rr.name || "?") + " " + (rr.guid || "?")
            + ((level >= 3 && typeof vol.elements == "number")
                ? (" (elements " + vol.elements + ", packages " + vol.packages + ")") : "");
    }
    if (opn == "find_or_create_referencing_sr") {
        return "\nop[" + idx + "] find_or_create_referencing_sr: found=" + (rr.found ? "true" : "false")
            + " SR " + (rr.guid || "?") + " operace " + (rr.operation || "?");
    }
    if (opn == "deploy_src") {
        return "\nop[" + idx + "] deploy_src: updated " + ((rr.updated && rr.updated.length) || 0)
            + ", created " + ((rr.created && rr.created.length) || 0)
            + ((rr.skipped && rr.skipped.length) ? (", skipped " + rr.skipped.length) : "");
    }
    return segDefault(rr, idx);
}
// --- datove segmenty vsech ok operaci (dulezite i v chybove vetvi:
// kriterium 12 - GUIDy polozek vzniklych PRED chybou musi byt v ACKu)
function buildParts(level) {
    var parts = [];
    for (var i2 = 0; i2 < results.length; i2++) {
        var rr = results[i2] || {};
        if (("" + rr.status) != "ok") { continue; }
        var pj = PROJ["" + rr.op];
        var sg = "";
        if (!pj) { sg = segDefault(rr, i2); }
        else if (pj.cls == "B") { sg = segB(rr, i2, level); }
        else if (pj.cls == "D") { sg = segD(rr, i2); }
        else if (pj.cls == "C") { sg = segC(rr, i2, level); }
        else { sg = segA(rr, i2, pj, level); }
        if (sg !== "") { parts.push(sg); }
    }
    return parts;
}
// --- skladani s prioritou orezu (par. 4.4): nejdriv snizeni urovne detailu
// (jmena/doprovod pryc, GUIDy zustavaji), pak odpadaji CELE segmenty od
// konce. Vysledny retezec se NIKDY nestriha substringem (W2).
function assemble(head) {
    var lvl = 3, parts = null, total = 0, p;
    for (lvl = 3; lvl >= 1; lvl--) {
        parts = buildParts(lvl);
        total = head.length;
        for (p = 0; p < parts.length; p++) { total += parts[p].length; }
        if (total <= BUD.total || lvl == 1) { break; }
    }
    var reduced = (lvl < 3);
    var NOTE = "\n(orez rozpoctem dle par. 4.4 - GUIDy pred jmeny; plna odpoved v res-" + id + ".json)";
    while (parts.length > 0 && (total + NOTE.length) > BUD.total && (reduced || total > BUD.total)) {
        total -= parts[parts.length - 1].length;
        parts.pop();
        reduced = true;
    }
    var sOut = head + parts.join("");
    if (reduced) { sOut += NOTE; }
    return sOut;
}
function qcLine() {
    var qc = resp.qc;
    if (!qc) { return ""; }
    var s = "" + qc.status;
    if (s == "ciste") { return " | QC ciste (" + qc.checks + " kontrol)"; }
    if (s == "nalez") {
        var ids = [];
        var fnd = qc.findings || [];
        for (var q = 0; q < fnd.length; q++) { ids.push(fnd[q].id + " (" + fnd[q].count + "x)"); }
        return " | QC NALEZ: " + ids.join(", ") + " - detail v res souboru (zapis PROBEHL, QC neni chyba zapisu)";
    }
    // benigni: nebylo co kontrolovat (zadna alarmujici formulace)
    if (s == "bez_kontrol") { return " | QC: bez kontrol pro tuto zmenu"; }
    // skutecne selhani QC behu (SQL apod.) - zapis tim NENI dotcen
    return " | QC neproveden (chyba kontroly: " + clip(qc.reason || "?", 140) + ") - zapis tim NENI dotcen";
}
// sber warningu: davkove (resp.warnings, napr. migrace W6) + op-level
// (results[i].warnings) se zdrojovou znackou, aby slo warning priradit k operaci
function collectWarns() {
    var acc = [];
    var bw = resp.warnings || [];
    for (var a = 0; a < bw.length; a++) { acc.push({ src: "davka", text: "" + bw[a] }); }
    for (var b = 0; b < results.length; b++) {
        var rb = results[b] || {};
        var ow = rb.warnings || [];
        for (var c = 0; c < ow.length; c++) {
            acc.push({ src: "op[" + b + "] " + (rb.op || "?"), text: "" + ow[c] });
        }
    }
    return acc;
}
// segment do PRVNIHO radku ACK - pocet prezije i orez rozpoctem (W10)
function warnHead(ws) {
    if (!ws || ws.length === 0) { return ""; }
    var label = (ws.length == 1) ? "1 WARNING: " : (ws.length + " WARNINGS: ");
    return " | " + label + clip(ws[0].text, 140);
}
// vypis warningu s rozpoctem a ukazatelem na res soubor (W10: zadny tichy cut)
function warnBlock(ws) {
    if (!ws || ws.length === 0) { return ""; }
    var lines = [], used = 0, shown = 0;
    for (var i = 0; i < ws.length; i++) {
        var ln = ws[i].src + ": " + clip(ws[i].text, 200);
        if (used + ln.length > BUD.warn) { break; }
        lines.push(ln); used += ln.length; shown++;
    }
    var s = "\nWarnings (zapis PROBEHL, cast zameru se ale nepropsala - resit OPRAVNOU davkou, ne preposlanim):";
    for (var j = 0; j < lines.length; j++) { s += "\n- " + lines[j]; }
    if (shown < ws.length) { s += "\n- (dalsich " + (ws.length - shown) + " - plny vycet v res-" + id + ".json)"; }
    return s;
}
// basename souborove cesty (par. 4.6 - strucnost ACK; identita repozitare
// vcetne cesty do chat kanalu smi, dispozice 2026-08-30)
function repoName() {
    var rp = "" + (resp.repository || "");
    if (rp === "") { return ""; }
    var cutBs = rp.lastIndexOf("\\"), cutFs = rp.lastIndexOf("/");
    var cutAt = (cutBs > cutFs) ? cutBs : cutFs;
    return (cutAt >= 0) ? rp.substring(cutAt + 1) : rp;
}
var warns = collectWarns();
var out = "";
if (st == "done") {
    out = assemble("EAFB OK " + id + ": " + okc + "/" + ops + " ops" + warnHead(warns) + qcLine() + warnBlock(warns));
}
else if (st == "confirm_required") {
    var hp = (resp.confirm && resp.confirm.hashPrefix) ? resp.confirm.hashPrefix : "";
    var reasons = (resp.risk && resp.risk.riskReasons) ? resp.risk.riskReasons.join("; ") : "";
    out = "EAFB CEKA NA POTVRZENI " + id + " (ELEVATED, hash " + hp + "...): zadny zapis neprobehl, davka ceka v requests\\pending\\."
        + " Potvrzeni = lokalni ukon cloveka (stavove okno vratneho / popup pumpy / GUI fallback), nikdy z chatu."
        + " Duvody: " + clip(reasons, 400);
}
else if (code == "E_RISK_BLOCKED") {
    out = "EAFB BLOKOVANO " + id + ": Risk Gate BLOCKED - nic neprovedeno, davka v rejected\\. "
        + clip((resp.risk && resp.risk.riskReasons) ? resp.risk.riskReasons.join("; ") : (resp.message || ""), 400)
        + " Zadny jednoklikovy override (cesta ven = zmena FB_RiskPolicy nebo rucni prace v EA).";
}
else if (code == "E_RISK_REJECTED" || st == "rejected") {
    out = "EAFB ZAMITNUTO " + id + ": davka zamitnuta clovekem v potvrzovacim dialogu - nic neprovedeno, soubor v rejected\\.";
}
else if (code == "E_RISK_INTEGRITY") {
    out = "EAFB INTEGRITA " + id + ": obsah davky se zmenil mezi klasifikaci a potvrzenim - nic neprovedeno (bezpecnostni udalost, res soubor + audit). Novou verzi posli jako novou davku.";
}
else if (code == "E_RISK_CONFIRM") {
    out = "EAFB ODMITNUTO " + id + " (E_RISK_CONFIRM): " + clip(resp.message || "potvrzovaci pole v obsahu davky / neplatne potvrzeni", 300);
}
else if (errIdx >= 0) {
    // chybova vetev NESE datove segmenty ok operaci pred chybou (par. 5a /
    // kriterium 12): opravna davka se sklada z GUIDu v ACKu, ne z res souboru
    out = assemble("EAFB CHYBA " + id + " v op[" + errIdx + "] (" + (errRes.op || "?") + "): " + (errRes.code || "")
        + " " + clip(errRes.message || "", 300)
        + " - dalsi ops skipped (" + (ops - errIdx - 1) + "), drivejsi zapisy PLATI (rollback neexistuje)."
        + " Oprava dle par. 5a: opravna davka adresujici GUIDy z tohoto ACK (u B3 rebuild sady na element GUID), zadne slepe preposlani."
        + warnHead(warns) + qcLine() + warnBlock(warns));
}
else {
    // koncova vetev (E_REPO sem pada s results:[] - FB_Main.js:113)
    out = "EAFB CHYBA " + id + ": " + code + " " + clip(resp.message || "", 300);
    if (code == "E_REPO") {
        var rn = repoName();
        if (rn !== "") { out += " Pripojeny repozitar: " + rn + " - oprav pole repo a posli davku znovu."; }
    }
}
return out;
