// AICodeBridge.FB_OpPing(Repository, op)
// Zdravotni test smycky: echo + zakladni info o prostredi.
// ITERACE 7 (par. 4.5): ping = UVODNI KOTVA session - vraci navic whitelist
// rozvinuty na polozky pripojeneho repozitare (jmeno + plna cesta dopoctem
// pres FB_ResolvePkg + FB_ElementPath) a access z FB_UserAccess, aby prvni
// zapisova davka byla samonosna bez recon kola. Res nese PLNY navrat
// FB_UserAccess (vc. login/groups - do res smi, dispozice 2026-08-30);
// chat verze (FB_ChatRender) renderuje jen access/securityEnabled/reason
// (datova minimalizace) a connection nikdy.
function pad2(n) { return (n < 10 ? "0" : "") + n; }
var d = new Date();
var r = { op: "ping", status: "ok" };
if (op && typeof op.echo != "undefined") { r.echo = op.echo; }
r.eaVersion = "" + Repository.LibraryVersion;
// repository = identita dle FB_RepoId (MS SQL: nazev DB); connection = cesta
r.repository = "" + this.FB_RepoId(Repository);
r.connection = "" + Repository.ConnectionString;
r.time = "" + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
    + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
// --- cil zapisu (rezim blacklist, Z261004b-10/-11, kap. 5.11): blok writeScope
// misto pole whitelist[] (zaniklo, O1 = b): stav EA security (informativne),
// blacklist (GUID, jmeno, plna cesta, note, found, allowIncomingRefs),
// implicitni ochrany s cestou, stav konfigurace (vady = E_SCOPE_CONFIG),
// cascadeDelete, summary = tataz lidska veta jako start session a "Stav
// bridge" (FB_ScopeText, FB-CZ-27), agentNotes = pravidla pro agenta (vazby
// "oba konce", zamky EA nehlidaji vazby, $N misto jmen, kaskady mazani).
// Nedohledatelna polozka se vypise s found: false, NIKDY se tise nezahodi.
r.writeScope = { mode: "blacklist", securityEnabled: false, repoKnown: false, cascadeDelete: "block", summary: "", blacklist: [], implicit: [], problems: [], warnings: [], agentNotes: [] };
try { r.writeScope.securityEnabled = (Repository.IsSecurityEnabled === true); } catch (eSe) { }
try {
    var st = this.FB_ScopeText(Repository); // cerstve cteni konfigurace
    var ws = st.cfg;
    r.writeScope.summary = st.sentence;
    r.writeScope.cascadeDelete = st.cascadeDelete;
    r.writeScope.agentNotes = st.agentNotes;
    if (ws == null) { throw new Error("FB_WriteScopeCfg nelze precist"); }
    r.writeScope.repoKnown = ws.repoKnown;
    for (var wi = 0; wi < ws.blacklist.length; wi++) {
        var w = ws.blacklist[wi];
        r.writeScope.blacklist.push({ guid: w.pkg, name: w.name, path: w.path, note: w.note, found: w.found, allowIncomingRefs: w.allowIncomingRefs });
    }
    for (var ii = 0; ii < ws.implicit.length; ii++) {
        var im = ws.implicit[ii];
        r.writeScope.implicit.push({ kind: im.kind, guid: im.guid, name: im.name, path: im.path, note: im.note });
    }
    r.writeScope.problems = ws.problems;
    r.writeScope.warnings = st.warnings; // vc. informativniho varovani o vypnute security
} catch (eWl) { r.writeScope.error = "" + eWl.message; }
// --- riskPolicy (KONCEPCE potvrzovaci okna pravidlo 7, Z261004b-3): agent si
// na zacatku prace precte tridy operaci a prahy a predem rekne cloveku,
// ktera davka bude chtit potvrzeni. Jen hodnoty politiky (zadne GUIDy).
r.riskPolicy = { available: false };
try {
    var pa = this.FB_RiskPolicy();
    var ridP = ("" + r.repository).toUpperCase();
    for (var pi = 0; pi < pa.length; pi++) {
        if (ridP.indexOf(("" + pa[pi].repo).toUpperCase()) < 0) { continue; }
        var pol = pa[pi];
        var always = [], blocked = [], low = [];
        for (var ck in (pol.classes || {})) {
            var cv = "" + pol.classes[ck];
            if (cv == "ELEVATED") { always.push(ck); } else if (cv == "BLOCKED") { blocked.push(ck); } else if (cv == "LOW") { low.push(ck); }
        }
        always.sort(); blocked.sort(); low.sort();
        r.riskPolicy = { available: true,
            classes: pol.classes || {},
            confirmAlways: always, blocked: blocked, low: low,
            elevate: pol.elevate || {}, block: pol.block || {},
            confirmMaxAgeMin: (typeof pol.confirmMaxAgeMin == "number") ? pol.confirmMaxAgeMin : 480,
            ownSessionLow: (pol.ownSessionLow === true),
            note: "okno vzdy = confirmAlways; okno pri prekroceni prahu elevate (napr. writeOps > " + ((pol.elevate && typeof pol.elevate.writeOps == "number") ? pol.elevate.writeOps : "?")
                + "); blocked = odmitnuto bez okna; cekajici davka vyprsi po confirmMaxAgeMin; ownSessionLow = vlastni prvky/diagramy teto session pumpy bez okna" };
        break;
    }
    if (!r.riskPolicy.available) { r.riskPolicy.note = "repozitar nema polozku ve FB_RiskPolicy - kazdy zapis vyzaduje potvrzeni (fail-closed W9)"; }
} catch (eRp) { r.riskPolicy = { available: false, note: "FB_RiskPolicy nelze precist: " + eRp.message }; }
// --- access: plny navrat FB_UserAccess do res; pri chybe fail-closed read
try { r.access = this.FB_UserAccess(Repository); }
catch (eAc) {
    r.access = { securityEnabled: false, login: "", access: "read", groups: [],
        reason: "FB_UserAccess selhal: " + eAc.message + " - fail-closed read" };
}
return r;
