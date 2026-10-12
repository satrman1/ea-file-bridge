// AICodeBridge.FB_ConfirmSummary(resp, ageInfo)
// LIDSKY souhrn confirm_required davky pro potvrzovaci dialog (pumpa / GUI
// fallback / stavove okno vratneho). Cil (Milosova UX zpetna vazba 2026-08-20):
// nejdriv CO SE STANE a KDE, plainu; technicka metrika + hashPrefix az dole
// jako mala paticka. NIKDY plny hash/nonce (par. 6.3) - jen prefix.
// Vstup: parsovany response objekt (status confirm_required); ageInfo
// VOLITELNE { since, ageMin } z pumpy (cte se jen pres typeof - novy parametr
// existujici operace, PROTOKOL-EAFB kap. 11); bez nej se stari pocita z resp.since.
// v0.19 (balik B2 texty, Z261004b-6) = vzor FB-UI-08 + KONCEPCE pravidlo 4:
//   [druhe kolo: prvni radek rika, PROC se okno pta znovu]      (FB-PU-19)
//   AI chce zapsat do modelu a potrebuje tvuj souhlas.
//   Co se stane:  vety z operaci a cilu (risk.summary.actions), ne metriky;
//                 u mazani SKUTECNY ROZSAH (risk.summary.deletes: balicek vcetne
//                 N prvku, prvek vcetne vnorenych, konektor A -> B, atribut
//                 Trida.x) zvlast od ostatnich zmen                 (FB-PU-20)
//   Kde:          plna cesta (mazani, presun, cil jmenem)
//   Zaloha:       radky Baseline politiky (bez duplicit, N-E2E-5)
//   POZOR:        kaskady mazani do chranene casti (rozhodnuti 12. 10. 2026)
//   Proc se ptam: VSECHNY duvody jako vety (FB_ReasonText z kodu), ne "+ N dalsi"
//   Ceka od:      stari cekajici davky (pravidlo 6 bod 3)
//   Provest?      JEDNA legenda tlacitek (pumpa uz zadnou nepridava)
//   (paticka)     id davky, otisk, pocet zapisu (0/neznamo slovy - N-E2E-1), kody duvodu
// Stara odpoved bez actions/deletes/reasonItems se vypise postaru (metriky,
// technicke texty) - nic nespadne. Texty bez diakritiky (spike S1 ceka).
var age = (typeof ageInfo != "undefined" && ageInfo !== null && typeof ageInfo == "object") ? ageInfo : null;
if (resp === null || typeof resp == "undefined") { return "(zadna response)"; }
var risk = resp.risk || {};
var m = risk.metrics || {};
var sm = risk.summary || {};
var L = [];
function pl(n, one, few, many) { return n + " " + (n == 1 ? one : ((n >= 2 && n <= 4) ? few : many)); }
function q(s) { return "\"" + s + "\""; }
function names(arr, more) {
    var out = [];
    for (var i = 0; i < (arr || []).length; i++) { if (arr[i] != "...") { out.push(q(arr[i])); } }
    var s = out.join(", ");
    if (more > 0) { s += " a dalsich " + more; }
    return s;
}
var del = (typeof m.deleteTargets == "number") ? m.deleteTargets : 0;
var creat = (typeof m.createOps == "number") ? m.createOps : 0;
var upd = (typeof m.updatedExisting == "number") ? m.updatedExisting : 0;
var mov = (typeof m.moveOps == "number") ? m.moveOps : 0;
var pkgs = (sm.packages && sm.packages.length) ? sm.packages : [];
var deletes = (sm.deletes && sm.deletes.length) ? sm.deletes : null;
var actions = (sm.actions && sm.actions.length) ? sm.actions : null;
var metricsKnown = !(m.metricsComplete === false);
// --- druhe kolo (FB-PU-19): proc se okno pta znovu - PRVNI radek ---
var rnd = (resp.confirm && resp.confirm.round) ? resp.confirm.round : null;
if (rnd) {
    var why = "" + (rnd.why || "");
    if (why == "baseline-missing") { L.push("NEPROVEDENO - zaloha stale chybi. Udelej rucni zalohu v EA (viz Zaloha nize) a potvrd znovu, nebo davku zamitni."); }
    else if (why == "metrics-changed") { L.push("ZNOVU K POTVRZENI - model se mezitim zmenil, rozsah davky je jiny. Nize je novy souhrn."); }
    else if (why == "summary-mismatch") { L.push("ZNOVU K POTVRZENI - souhrn v okne neodpovidal modelu (zmenil se model, nebo soubor res). Nize je pravdivy souhrn."); }
    else { L.push("ZNOVU K POTVRZENI - " + (rnd.text || why)); }
    if (rnd.no > 1) { L.push("(kolo " + rnd.no + ")"); }
    L.push("");
}
// --- headline ---
var head;
if (del > 0) {
    head = "AI chce SMAZAT " + pl(del, "cil", "cile", "cilu") + " z modelu a potrebuje tvuj souhlas.";
} else if (mov > 0) {
    // iterace 6: presun je zasah do STRUKTURY - dialog to musi rict rovnou
    head = "AI chce PRESUNOUT " + pl(mov, "prvek", "prvky", "prvku") + " mezi balicky"
        + (pkgs.length > 0 ? " (" + pkgs.join(" / ") + ")" : "") + " a potrebuje tvuj souhlas.";
} else {
    head = "AI chce zapsat do modelu a potrebuje tvuj souhlas.";
}
L.push(head);
L.push("");
// --- Co se stane: vety z operaci a cilu ---
L.push("Co se stane:");
var said = 0;
function pathLine(p) { if (p && p != "") { L.push("      kde: " + p); } }
if (deletes) {
    for (var di = 0; di < deletes.length; di++) {
        var d = deletes[di] || {};
        var k = "" + (d.kind || "?");
        var line;
        if (k == "package") {
            if (d.unresolved) { line = "SMAZE balicek " + (d.ref ? d.ref : "?") + " - v modelu nenalezen (rozsah neznamy)"; }
            else {
                line = "SMAZE balicek " + q(d.name || "?");
                if (d.scopeKnown) {
                    // po "vcetne" 2. pad: N prvku, M diagramu, K podbalicku
                    var parts = [(d.elements || 0) + " prvku"];
                    if (d.diagrams > 0) { parts.push(d.diagrams + " diagramu"); }
                    if (d.packages > 0) { parts.push(d.packages + " podbalicku"); }
                    line += " vcetne " + parts.join(", ");
                } else { line += " (rozsah obsahu nespocitan)"; }
            }
        } else if (k == "element") {
            if (d.unresolved) { line = "SMAZE prvek " + (d.ref ? d.ref : "?") + " - v modelu nenalezen"; }
            else {
                line = "SMAZE " + (d.type ? d.type.toLowerCase() + " " : "prvek ") + q(d.name || "?");
                if (d.scopeKnown && d.children > 0) { line += " vcetne " + pl(d.children, "vnoreneho prvku", "vnorenych prvku", "vnorenych prvku"); }
                else if (!d.scopeKnown) { line += " (rozsah vnorenych prvku nespocitan)"; }
            }
        } else if (k == "connector") {
            line = "SMAZE vazbu " + (d.scopeKnown ? d.label + (d.type ? " (" + d.type + ")" : "") : (d.ref ? d.ref : "?") + " - konce vazby nedohledany");
        } else if (k == "attribute" || k == "operation" || k == "parameter") {
            line = "SMAZE " + (k == "attribute" ? "atribut " : (k == "operation" ? "operaci " : "parametr ")) + (d.scopeKnown ? d.label : (d.ref ? d.ref : "?") + " - vlastnik nedohledan");
        } else if (k == "diagram") {
            line = "SMAZE diagram " + (d.scopeKnown ? q(d.name || "?") : (d.ref ? d.ref : "?") + " - v modelu nenalezen");
        } else if (k == "tag") {
            line = "SMAZE tag " + (d.label || d.name || "?");
        } else {
            line = "SMAZE " + k + " " + (d.ref || d.name || "?");
        }
        L.push("  - " + line);
        pathLine(d.path);
        said++;
        if (d.more > 0) { L.push("  - ... a dalsich " + d.more + " cilu ke smazani"); }
    }
} else if (del > 0) {
    // stara odpoved bez deletes[]: aspon cile a cesty jako driv
    L.push("  - SMAZE " + pl(del, "cil", "cile", "cilu") + (sm.targets && sm.targets.length > 0 ? ": " + names(sm.targets, sm.targetsMore) : ""));
    said++;
}
function actionSentence(ac) {
    var op = "" + ac.op;
    var tg = names(ac.targets, ac.targetsMore), pk = names(ac.packages, ac.packagesMore), dg = names(ac.diagrams, ac.diagramsMore);
    var n = ac.items || 0;
    if (ac.unknown) { return "neznama operace '" + op + "' - bridge nevi, co by udelala (provedeni ji zastavi)"; }
    switch (op) {
        case "create_element": return "vytvori prvek" + (tg ? " " + tg : "") + (pk ? " v balicku " + pk : "");
        case "create_or_update_elements": {
            var s = [];
            if (ac.create > 0) { s.push("vytvori " + pl(ac.create, "prvek", "prvky", "prvku") + (pk ? " v balicku " + pk : "")); }
            if (ac.update > 0) { s.push("upravi " + pl(ac.update, "existujici prvek", "existujici prvky", "existujicich prvku")); }
            if (s.length == 0) { s.push("zapise prvky"); }
            return s.join(" a ") + (tg ? ": " + tg : "");
        }
        case "create_or_update_package": {
            var sp = [];
            if (ac.create > 0) { sp.push("vytvori " + pl(ac.create, "balicek", "balicky", "balicku") + (tg ? " " + tg : "") + (pk ? " v " + pk : "")); }
            if (ac.update > 0) { sp.push("upravi " + pl(ac.update, "balicek", "balicky", "balicku") + (pk ? " " + pk : "")); }
            return sp.length ? sp.join(" a ") : "zapise balicek";
        }
        case "create_or_update_connectors": {
            var sc = [];
            if (ac.create > 0) { sc.push("vytvori " + pl(ac.create, "vazbu", "vazby", "vazeb") + (ac.pairs && ac.pairs.length ? ": " + ac.pairs.join(", ") + (ac.pairsMore > 0 ? " a dalsich " + ac.pairsMore : "") : "")); }
            if (ac.update > 0) { sc.push("upravi " + pl(ac.update, "existujici vazbu", "existujici vazby", "existujicich vazeb")); }
            return sc.length ? sc.join(" a ") : "zapise vazby";
        }
        case "create_or_update_attributes": return "zapise " + pl(n, "atribut", "atributy", "atributu") + (tg ? " do prvku " + tg : "") + " (existujici stejneho jmena prepise)";
        case "create_or_update_operations": return "zapise " + pl(n, "operaci", "operace", "operaci") + (tg ? " do prvku " + tg : "") + " (existujici stejneho jmena prepise)";
        case "create_or_update_scenarios": return "do prvku " + (tg || "?") + " zapise scenare (" + n + "; prepise stavajici sadu)";
        case "create_or_update_constraints": return "do prvku " + (tg || "?") + " zapise podminky (" + n + "; prepise stavajici sadu)";
        case "create_or_update_requirements": return "do prvku " + (tg || "?") + " zapise pravidla/requirements (" + n + "; prepise stavajici sadu)";
        case "create_or_update_messages": return "zapise " + pl(n, "zpravu", "zpravy", "zprav") + (dg ? " do diagramu " + dg : "") + (ac.rebuild ? " a PRESTAVI spojnice diagramu (rebuild)" : "");
        case "delete_from_model": return "smaze " + pl(n, "cil", "cile", "cilu") + (tg ? ": " + tg : "");
        case "delete_taggedvalue_from_model": return "smaze " + pl(n, "tag", "tagy", "tagu");
        case "remove_elements_from_diagram": return "odebere " + pl(n, "prvek", "prvky", "prvku") + (dg ? " z diagramu " + dg : " z diagramu") + " (v modelu zustanou)";
        case "create_baseline": return "zalozi zalohu (baseline)" + (tg ? " " + tg : "") + (pk ? " balicku " + pk : "");
        case "clone_package": return "naklonuje balicek" + (tg ? " " + tg : "") + (pk ? " do " + pk : "") + " (objem znamy az pri provedeni)";
        case "clone_elements": return "naklonuje " + pl(n, "prvek", "prvky", "prvku") + (pk ? " do balicku " + pk : "");
        case "import_element_linked_documents": return "importuje " + pl(n, "dokument", "dokumenty", "dokumentu") + (tg ? " do prvku " + tg : "") + " (stavajici dokument prepise)";
        case "layout_connectors": return "srovna spojnice" + (dg ? " na diagramu " + dg : "");
        case "change_connector_visibility": return "zmeni viditelnost " + pl(n, "spojnice", "spojnic", "spojnic") + (dg ? " na diagramu " + dg : "");
        case "update_diagram_properties": return "upravi vlastnosti " + pl(n, "diagramu", "diagramu", "diagramu") + (dg ? ": " + dg : "");
        case "set_diagram_object_style": return "obarvi/prestyluje " + pl(n, "prvek", "prvky", "prvku") + (dg ? " na diagramu " + dg : "");
        case "create_or_update_diagram": {
            var sd = [];
            if (ac.create > 0) { sd.push("vytvori " + pl(ac.create, "diagram", "diagramy", "diagramu") + (tg ? " " + tg : "") + (pk ? " v " + pk : "")); }
            if (ac.update > 0) { sd.push("upravi " + pl(ac.update, "diagram", "diagramy", "diagramu") + (dg ? " " + dg : "")); }
            return sd.length ? sd.join(" a ") : "zapise diagram";
        }
        case "place_elements_on_diagram": return "umisti " + pl(n, "prvek", "prvky", "prvku") + (dg ? " na diagram " + dg : " na diagram");
        case "move_elements": return "PRESUNE " + pl(n, "prvek", "prvky", "prvku") + (tg ? " " + tg : "") + (pk ? " mezi balicky " + pk : "");
        case "apply_classifier_stereotypes": return "upravi stereotypy prvku podle klasifikatoru" + (dg ? " na diagramu " + dg : "");
        case "find_or_create_referencing_sr": return "zalozi kostru realizace sluzby (balicek, diagramy, prvky, vazby)" + (pk ? " v " + pk : "") + " - pokud uz neexistuje";
        case "deploy_src": return "nasadi kod bridge do modelu (" + (typeof ac.files == "number" && ac.files > 0 ? ac.files + " operaci" : "rozsah nespocitan") + ")";
        default: return "provede " + op + (n > 0 ? " (" + pl(n, "polozka", "polozky", "polozek") + ")" : "") + (tg ? ": " + tg : "");
    }
}
if (actions) {
    for (var ai = 0; ai < actions.length; ai++) {
        var ac = actions[ai];
        if (!ac) { continue; }
        if ((ac.op == "delete_from_model" || ac.op == "delete_taggedvalue_from_model") && deletes) { continue; } // uz vyjmenovano s rozsahem
        L.push("  - " + actionSentence(ac));
        said++;
    }
} else if (!deletes && del == 0) {
    // stara odpoved: metriky jako driv
    var partsH = [];
    if (creat > 0) { partsH.push("vytvori " + creat); }
    if (upd > 0) { partsH.push("upravi " + upd); }
    if (partsH.length == 0) { partsH.push(metricsKnown ? "zapise do modelu" : "zapise do modelu (rozsah nespocitan)"); }
    L.push("  - " + partsH.join(" a ") + ((creat + upd) > 0 ? " " + ((creat + upd) == 1 ? "prvek" : "prvku") : "")
        + (pkgs.length > 0 ? " v " + pl(pkgs.length, "balicku", "balicich", "balicich") : ""));
    said++;
}
if (said == 0) { L.push("  - (bridge nedokazal popsat, co davka udela - rozsah nespocitan; zkontroluj res soubor)"); }
if (!metricsKnown) { L.push("  POZOR: rozsah davky se nepodarilo spocitat - nasledujici souhrn muze byt neuplny."); }
// --- Kde: ostatni cile a balicky (mazane uz maji cestu u sebe) ---
if (!deletes && sm.targets && sm.targets.length > 0 && del > 0) {
    L.push("Ke smazani: " + names(sm.targets, sm.targetsMore));
} else if (sm.targets && sm.targets.length > 0 && !actions) {
    L.push("Prvky: " + names(sm.targets, sm.targetsMore));
}
if (pkgs.length > 0 && mov == 0) { L.push("Balicky: " + names(pkgs, sm.packagesMore)); }
if (sm.paths && sm.paths.length > 0) {
    // plna teckova cesta presouvanych / jmenem zadanych cilu (nalez MLA 2026-08-31);
    // cesta mazaneho uz je u polozky "SMAZE ..." - tady jen ty ostatni
    var shownP = {};
    if (deletes) { for (var dp = 0; dp < deletes.length; dp++) { if (deletes[dp] && deletes[dp].path) { shownP["" + deletes[dp].path] = 1; } } }
    var restP = [];
    for (var rp = 0; rp < sm.paths.length; rp++) { if (shownP["" + sm.paths[rp]] != 1) { restP.push("" + sm.paths[rp]); } }
    if (restP.length > 0) {
        L.push((del > 0 && !deletes ? "Kde (plna cesta mazaneho): " : "Kde (plna cesta): ") + (restP.length == 1 ? restP[0] : ""));
        if (restP.length > 1) { for (var pi = 0; pi < restP.length; pi++) { L.push("  - " + restP[pi]); } }
    }
}
if (sm.diagrams && sm.diagrams.length > 0) { L.push("Diagramy: " + names(sm.diagrams, sm.diagramsMore)); }
// --- ZALOHA (Baseline politika par. 4.6/2): dialog PREDEM rika, co se
// zazalohuje a co ne. Texty sklada FB_BaselineDecide; radky bez duplicit.
var bl = resp.baseline || null;
L.push("");
if (bl && bl.lines && bl.lines.length > 0) {
    var seenBl = {};
    for (var bli = 0; bli < bl.lines.length; bli++) {
        var blLine = "" + bl.lines[bli];
        if (seenBl[blLine] == 1) { continue; }
        seenBl[blLine] = 1;
        L.push((bli == 0 ? "Zaloha: " : "        ") + blLine);
    }
} else if (bl && bl.decision == "failed") {
    L.push("Zaloha: POZOR - zalohu se nepodarilo naplanovat (" + (bl.reason || "?") + ") - zapis by probehl BEZ pre-image (bez zalohy).");
} else {
    L.push("Zaloha: (politika zaloh nic nehlasi)");
}
// --- KASKADY MAZANI do chranene casti (W2 b/c, cascadeDelete = allow;
// rozhodnuti Milose 12. 10. 2026): clovek rozhoduje S INFORMACI.
if (risk.cascades && risk.cascades.length > 0) {
    L.push("");
    L.push("POZOR - smazani sahne kaskadou EA do CHRANENE casti (zaloha ji nekryje):");
    for (var ki = 0; ki < risk.cascades.length; ki++) {
        var kc = risk.cascades[ki] || {};
        L.push("  - " + (kc.what || "") + ": " + (kc.kind == "diagram" ? "lezi na chranenem diagramu" : (kc.kind == "classifier" ? "je klasifikatorem instanci v chranene casti (EA jim nastavi Classifier = 0)" : "kaskada")) + " - " + (kc.count || 0) + "x");
        var kit = kc.items || [];
        for (var kj = 0; kj < kit.length && kj < 8; kj++) { L.push("      " + kit[kj]); }
        if (kit.length > 8) { L.push("      ... a dalsich " + (kit.length - 8)); }
    }
}
// --- Proc se ptam: VSECHNY duvody jako vety ---
var items = (risk.reasonItems && risk.reasonItems.length > 0) ? risk.reasonItems : null;
var reasonsRaw = risk.riskReasons || [];
var codes = [];
L.push("");
if (items || reasonsRaw.length > 0) {
    L.push("Proc se ptam:");
    var seenR = {};
    var list = items || reasonsRaw;
    for (var ri = 0; ri < list.length; ri++) {
        var it = list[ri];
        var sentence = "";
        try { sentence = "" + this.FB_ReasonText(it); } catch (eRt) { sentence = (typeof it == "string") ? it : ("" + (it && it.text ? it.text : it)); }
        if (sentence == "" || seenR[sentence] == 1) { continue; }
        seenR[sentence] = 1;
        L.push("  - " + sentence);
        if (it && typeof it == "object" && it.code) { codes.push("" + it.code); }
    }
} else {
    L.push("Proc se ptam: davka vyzaduje potvrzeni cloveka (duvod bridge neuvedl).");
}
// --- Ceka od (pravidlo 6 bod 3) ---
var since = (age && age.since) ? "" + age.since : ("" + (resp.since || ""));
if (since != "") {
    var ageMin = (age && typeof age.ageMin == "number") ? age.ageMin : -1;
    if (ageMin < 0) {
        var mm = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(since);
        if (mm) {
            var ms = new Date(parseInt(mm[1], 10), parseInt(mm[2], 10) - 1, parseInt(mm[3], 10), parseInt(mm[4], 10), parseInt(mm[5], 10), parseInt(mm[6] || "0", 10)).getTime();
            if (!isNaN(ms)) { ageMin = Math.floor((new Date().getTime() - ms) / 60000); if (ageMin < 0) { ageMin = 0; } }
        }
    }
    var ageTxt = "";
    if (ageMin >= 0) { ageTxt = ageMin + " min"; }
    L.push("");
    L.push("Ceka od " + since + (ageTxt != "" ? " (" + ageTxt + ")" : ""));
}
// --- akce: JEDNA legenda tlacitek ---
L.push("");
L.push("Provest?");
L.push("  Ano = provest ted  |  Ne = zahodit davku  |  Storno = nechat cekat, rozhodnu pozdeji");
// --- mala technicka paticka (kontrola integrity; NE plny hash) ---
var foot = "davka " + (resp.id || "?");
if (resp.confirm && resp.confirm.hashPrefix) { foot += " | otisk " + resp.confirm.hashPrefix + "..."; } // "..." misto vypustky: ANSI log pumpy ji komoli
if (typeof m.writeOps == "number" && metricsKnown) { foot += " | " + pl(m.writeOps, "zapis", "zapisy", "zapisu"); }
else { foot += " | pocet zapisu nespocitan"; }
if (codes.length > 0) {
    var cu = [], cs = {};
    for (var ci = 0; ci < codes.length; ci++) { if (cs[codes[ci]] != 1) { cs[codes[ci]] = 1; cu.push(codes[ci]); } }
    foot += " | " + cu.join(", ");
}
L.push("(" + foot + ")");
return L.join("\n");
