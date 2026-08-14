// AICodeBridge.FB_SessionStart(Repository)
// Povinna vybava: automaticky baseline vsech whitelistovanych packages
// pri startu session pumpy. Vraci textovy souhrn pro konzoli pumpy.
function pad2(n) { return (n < 10 ? "0" : "") + n; }
var d = new Date();
var ver = "FB " + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
    + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
var wl = this.FB_Whitelist();
var pi = Repository.GetProjectInterface();
// identita repozitare dle FB_RepoId (MS SQL: nazev DB; lokalni .qea: fallback
// ConnectionString) - NE cesta k zastupci, viz komentar ve FB_RepoId
var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
var done = 0, fail = 0, skipped = 0, lastErr = "";
for (var i = 0; i < wl.length; i++) {
    var w = wl[i];
    // baseline jen pro polozky patrici PRIPOJENEMU repozitari (klon = jina
    // identita -> polozka se preskoci a nahlas se to do konzole)
    if (rid.indexOf(("" + w.repo).toUpperCase()) < 0) { skipped++; continue; }
    try {
        pi.CreateBaseline(pi.GUIDtoXML("" + w.pkg), ver, "EA File Bridge - auto-baseline pri startu session pumpy");
        done++;
    } catch (e) {
        fail++;
        lastErr = "" + e.message;
    }
}
var out = "Session baseline: " + done + " vytvoren"
    + (fail > 0 ? (", " + fail + " selhal (" + lastErr + ")") : "")
    + (skipped > 0 ? (", " + skipped + " preskocen (jiny repozitar!)") : "")
    + " [" + ver + "]";
if (done == 0) {
    out = out + " | POZOR: pripojeny repozitar nema zadnou whitelist polozku - zapisy budou zamitnuty (E_REPO). Identita: " + this.FB_RepoId(Repository) + " | Pripojeni: " + Repository.ConnectionString;
}
this.Log(Repository, out);
return out;
