// AICodeBridge.FB_ResolveFail(opName, ctx, items)
// Chybovy vysledek operace po neuspesnem FB_ResolvePkg / FB_ResolveEl (zadani
// cil zapisu v1.1 kap. 5.7, Z261004b-10): kdyz resolver zaznamenal
// nejednoznacne jmeno nebo chybu cesty (this._fbResolveErr), vraci se
// E_AMBIGUOUS s guids[] (kompatibilita PROTOKOL kap. 7) a candidates[{guid,
// path}] (I16), resp. E_NOT_FOUND s napovedou cesty; jinak E_NOT_FOUND
// s textem ctx. items = dosavadni polozky operace (stop-on-error vycet).
// Hlavni obrana je predbezna kontrola P2 (FB_ScopePrecheck) - tohle je druha
// obrana pri provedeni (cile dohledane az za behu, $N).
var err = this._fbResolveErr || null;
this._fbResolveErr = null;
var res = { op: "" + opName, status: "error", code: "E_NOT_FOUND", message: "" + ctx };
if (err) {
    res.code = "" + (err.code || "E_NOT_FOUND");
    res.message = "" + ctx + " " + (err.message || "");
    if (err.guids && err.guids.length) { res.guids = err.guids; }
    if (err.candidates && err.candidates.length) { res.candidates = err.candidates; }
    if (typeof err.found != "undefined") { res.found = err.found; }
    if (err.children && err.children.length) { res.children = err.children; }
}
if (items) { res.items = items; }
return res;
