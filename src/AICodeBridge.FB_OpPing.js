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
// --- whitelist: FB_Whitelist drzi { repo, pkg } (holy GUID) a muze nest
// radky vice repozitaru -> filtr na pripojeny repozitar (substring,
// case-insensitive, I4). Nedohledatelna polozka se vypise jako GUID
// s poznamkou, NIKDY se tise nezahodi (par. 4.5).
r.whitelist = [];
try {
    var wl = this.FB_Whitelist();
    var ridU = ("" + r.repository).toUpperCase();
    for (var wi = 0; wi < wl.length; wi++) {
        if (ridU.indexOf(("" + wl[wi].repo).toUpperCase()) < 0) { continue; }
        var item = { guid: "" + wl[wi].pkg, name: "", path: "" };
        var pkg = null;
        try { pkg = this.FB_ResolvePkg(Repository, wl[wi].pkg); } catch (ePk) { pkg = null; }
        if (pkg !== null && typeof pkg != "undefined" && pkg) {
            item.name = "" + pkg.Name;
            item.path = "" + this.FB_ElementPath(Repository, "package", pkg); // plna cesta (par. 4.2/I5)
        } else {
            item.note = "package nedohledatelna v pripojenem repozitari";
        }
        r.whitelist.push(item);
    }
} catch (eWl) { r.whitelistError = "" + eWl.message; }
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
