// AICodeBridge.FB_ReasonText(item)
// TABULKA VET K DUVODUM RISK GATE (balik B2 texty, Z261004b-6; KONCEPCE
// potvrzovacich oken pravidlo 2 a 4, vzor FB-UI-08, nalez FB-PU-20 e):
// kod duvodu -> veta pro cloveka. Vstup = polozka risk.reasonItems[]
// { code, text, args } (plni FB_RiskGate a FB_Main); vystup = jedna veta.
// NEZNAMY kod (nebo stara odpoved bez kodu) -> puvodni technicky text, nic
// se neztrati. Kody jsou STABILNI - podle nich seskupuje kalibrace oken
// (tag ai.risk.codes v auditu, pravidlo 9); text se smi menit, kod ne.
// Texty bez diakritiky - rozhodnuti o diakritice v dialozich ceka na spike
// S1 (UI-Vystupy-EA-File-Bridge.md kap. 3.15); prepis je pak mechanicky.
if (item === null || typeof item == "undefined") { return ""; }
if (typeof item == "string") { return item; }
var code = "" + (item.code || "");
var a = item.args || {};
var text = "" + (item.text || "");
function q(s) { return "'" + s + "'"; }
// lidske jmeno operace (rodina "co dela")
var OPS = {
    "delete_from_model": "mazani z modelu", "delete_taggedvalue_from_model": "mazani tagu", "remove_elements_from_diagram": "odebrani prvku z diagramu",
    "move_elements": "presun prvku mezi balicky", "clone_package": "klonovani balicku", "clone_elements": "klonovani prvku",
    "import_element_linked_documents": "import dokumentu do prvku", "create_or_update_scenarios": "zapis scenaru",
    "create_or_update_constraints": "zapis podminek", "create_or_update_requirements": "zapis pravidel (requirements)",
    "create_or_update_messages": "zapis zprav sekvencniho diagramu", "create_or_update_operations": "zapis operaci",
    "create_or_update_attributes": "zapis atributu", "apply_classifier_stereotypes": "zmena stereotypu podle klasifikatoru",
    "deploy_src": "nasazeni kodu bridge", "create_baseline": "zalozeni zalohy (baseline)"
};
function opName(op) { return OPS[op] || ("operace " + q(op)); }
function cap(s) { s = "" + s; return (s.length > 0) ? s.charAt(0).toUpperCase() + s.substring(1) : s; }
var known = /^(POLICY_INVALID|BASELINE_POLICY_INVALID|OWN_SESSION|PREV_EXCEPTION|UNKNOWN_OP|CLASS_BLOCKED|CLASS_ELEVATED|CLASS_ELEVATED_FOREIGN|ROOT_PACKAGE|TYPE_CHANGE|TYPE_UNVERIFIED|OPS_PARAMS|MSG_REBUILD|BASELINE_RESERVED|CLONE_VOLUME|TARGET_MISSING|TARGET_UNRESOLVED|REF_UNCERTAIN|EMPTY_LIST|NO_METRIC_RULE|BUDGET|THRESHOLD_ELEVATED|THRESHOLD_BLOCKED|CONFIG_TARGET|HASH_MISSING|GATE_FAILED|CASCADE|BASELINE_FAILED|BASELINE_GUIDED|MANUAL_BASELINE_MISSING|RECLASS_METRICS|RECLASS_SUMMARY)$/.test(code);
return known ? cap(sentence()) : sentence(); // neznamy kod = puvodni text beze zmeny
function sentence() {
function pl(n, one, few, many) { return n + " " + (n == 1 ? one : ((n >= 2 && n <= 4) ? few : many)); }
function keyText(key, v) {
    switch ("" + key) {
        case "deleteTargets": return "maze " + pl(v, "cil", "cile", "cilu");
        case "writeOps": return "obsahuje " + pl(v, "zapis", "zapisy", "zapisu");
        case "updatedExisting": return "meni " + pl(v, "existujici prvek", "existujici prvky", "existujicich prvku");
        case "affectedPackages": return "zasahuje do " + pl(v, "balicku", "balicku", "balicku");
        case "foreignDiagrams": return "meni " + pl(v, "diagram", "diagramy", "diagramu") + ", ktere sama nezalozila";
        case "moveOps": return "presouva " + pl(v, "prvek", "prvky", "prvku");
        default: return key + " = " + v;
    }
}
switch (code) {
    case "POLICY_INVALID":
        return "Politika rizik v modelu (FB_RiskPolicy) je nevalidni: " + (a.why || "?") + ". Dokud ji spravce neopravi, potvrzuje se kazdy zapis.";
    case "BASELINE_POLICY_INVALID":
        return "Nastaveni zaloh v politice je nevalidni: " + (a.why || "?") + ". Bez potvrzeni se nezapisuje.";
    case "OWN_SESSION":
        return opName(a.op) + " nad prvkem, ktery tato session sama zalozila - samo o sobe okno neotvira.";
    case "PREV_EXCEPTION":
        return "Predchozi davka skoncila chybou uprostred prace - model mohl zustat v puli, proto se prvni dalsi zapis potvrzuje.";
    case "UNKNOWN_OP":
        return "Davka obsahuje neznamou operaci " + q(a.op || "?") + " - bridge nevi, co by udelala (provedeni ji stejne zastavi).";
    case "CLASS_BLOCKED":
        return opName(a.op) + " je v tomto repozitari zakazane politikou.";
    case "CLASS_ELEVATED":
        switch ("" + a.op) {
            case "delete_from_model": case "delete_taggedvalue_from_model": case "remove_elements_from_diagram":
                return "Mazani a odebirani nejde vzit zpet jednim krokem, proto ho vzdy potvrzuje clovek.";
            case "move_elements":
                return "Presun meni, kam prvek patri (na balicku visi governance), proto ho vzdy potvrzuje clovek.";
            case "clone_package": case "clone_elements":
                return "Klonovani vytvari kopie, jejichz objem je znamy az pri provedeni, proto ho vzdy potvrzuje clovek.";
            case "import_element_linked_documents":
                return "Import dokumentu prepise stavajici dokument prvku bez moznosti vratit ho po prvku.";
            case "create_or_update_scenarios": case "create_or_update_constraints": case "create_or_update_requirements":
                return opName(a.op) + " prepise stavajici sadu u prvku - nejde to vzit zpet jednim krokem.";
            case "create_or_update_messages":
                return "Zapis zprav sekvencniho diagramu meni spojnice diagramu, proto ho potvrzuje clovek.";
            case "deploy_src":
                return "Nasazeni kodu meni chovani bridge pro vsechny, proto ho vzdy potvrzuje clovek.";
            default:
                return opName(a.op) + " patri podle politiky mezi zmeny, ktere vzdy potvrzuje clovek.";
        }
    case "CLASS_ELEVATED_FOREIGN":
        return opName(a.op) + (a.target ? " u prvku " + q(a.target) : "") + " prepise stavajici sadu u prvku, ktery tato session nezalozila.";
    case "ROOT_PACKAGE":
        return "Novy balicek " + q(a.name || "?") + " by vznikl primo pod korenem modelu " + q(a.root || "?") + " - struktura nejvyssi urovne, kterou vidi vsichni.";
    case "TYPE_CHANGE":
        return "Davka meni typ existujiciho prvku" + (a.target ? " " + q(a.target) : "") + " (" + (a.from || "?") + " -> " + (a.to || "?") + ") - prvek se tim stane necim jinym.";
    case "TYPE_UNVERIFIED":
        return "Davka nastavuje typ prvku, ale bridge nemohl overit, jestli se typ meni.";
    case "OPS_PARAMS":
        return "Zapis operaci s parametry prestavi cely seznam parametru operace (stavajici parametry se prepisou).";
    case "MSG_REBUILD":
        return "Prestavba zprav (rebuild) smaze stavajici spojnice sekvencniho diagramu a postavi je znovu.";
    case "BASELINE_RESERVED":
        return "Jmeno zalohy " + q(a.name || "?") + " zasahuje do prostoru automatickych zaloh (FB-AUTO) - provedeni ho odmitne.";
    case "CLONE_VOLUME":
        return "Objem klonu je znamy az pri provedeni - kvotu kryje tvoje potvrzeni.";
    case "TARGET_MISSING":
        return "V davce chybi cil (" + (a.ctx || "?") + ") - bridge nevi, kam davka miri, proto se pta.";
    case "TARGET_UNRESOLVED":
        return "Cil " + q(a.ref || "?") + " (" + (a.ctx || "?") + ") se v modelu nepodarilo najit - bridge nevi, kam davka miri, proto se pta.";
    case "REF_UNCERTAIN":
        return "Odkaz " + (a.ref || "$?") + " (" + (a.ctx || "?") + ") miri na vysledek, u ktereho nejde predem rict, jestli vznikne novy prvek, nebo se upravi existujici.";
    case "EMPTY_LIST":
        return opName(a.op) + " nema zadne polozky - provedeni skonci chybou.";
    case "NO_METRIC_RULE":
        return "Zapisova operace " + q(a.op || "?") + " nema pravidlo pro odhad rozsahu - rozsah davky je neznamy.";
    case "BUDGET":
        return "Bridge nedokazal spocitat rozsah davky v casovem limitu (" + (a.ms || "?") + " ms) - zkontroluj souhrn rucne.";
    case "THRESHOLD_ELEVATED":
        return "Davka " + keyText(a.key, a.value) + "; bez potvrzeni je dovoleno nejvys " + a.limit + ".";
    case "THRESHOLD_BLOCKED":
        return "Prekrocen tvrdy strop (" + (a.key || "?") + " " + a.value + " > " + a.limit + ") - davka je odmitnuta, potvrzeni nepomuze.";
    case "CONFIG_TARGET":
        return "Cil " + q(a.ref || "?") + " je konfiguracni prvek bridge - zapis do nej je zakazany.";
    case "HASH_MISSING":
        return "Otisk davky nesel spocitat (davka je prilis velka) - potvrzeni neni mozne, davku zmensi.";
    case "GATE_FAILED":
        return "Kontrola rizika spadla (" + (a.err || "?") + ") - bez potvrzeni se nezapisuje.";
    case "CASCADE":
        return "Smazani sahne kaskadou EA do chranene casti: " + text;
    case "BASELINE_FAILED":
        return "Zalohu se nepodarilo naplanovat (" + (a.reason || "?") + ") - zapis by probehl bez zalohy, proto se pta.";
    case "BASELINE_GUIDED":
        return "Davka je nad prahem automaticke zalohy - bez zalohy se zapisuje jen po tvem potvrzeni (viz Zaloha vyse).";
    case "MANUAL_BASELINE_MISSING":
        return "Potvrdil jsi, ale cerstva rucni zaloha stale chybi - davka se NEPROVEDLA. Udelej zalohu v EA a potvrd znovu, nebo davku zamitni.";
    case "RECLASS_METRICS":
        return "Model se mezi oknem a potvrzenim zmenil (rozsah davky je jiny) - potvrd znovu podle noveho souhrnu.";
    case "RECLASS_SUMMARY":
        return "Souhrn v okne neodpovidal modelu (zmenil se model, nebo soubor res) - tohle je pravdivy souhrn, potvrd znovu.";
    default:
        return text;
}
}
