// AICodeBridge.FB_ResolvePkg(Repository, ref, mode)
// Najde package podle "{GUID}" | packageID (cislice) | jmena | cesty
// { path: [...], from? } (zadani cil zapisu v1.1 kap. 5.7, Z261004b-10).
// Vraci Package nebo null. Sdileny resolver pro vsechny operace.
// JMENO: presna shoda v JS (W7, pres FB_TargetCache). Vychozi rezim = ZAPIS:
// jmeno musi odpovidat prave jednomu balicku, jinak null + this._fbResolveErr
// = { code: "E_AMBIGUOUS", message, guids[], candidates[{guid, path}] }
// (volajici vrati E_AMBIGUOUS misto E_NOT_FOUND - FB_ResolveFail). Cesta:
// chyba cesty (E_NOT_FOUND s napovedou / E_AMBIGUOUS) tamtez.
// mode "read" (cteci operace): vic shod = PRVNI shoda + this._fbResolveWarn
// (chovani cteni beze zmeny, jen varovani). Parametr mode je novy - cte se
// jen pres typeof (pravidlo FB-PU-01).
var readMode = (typeof mode == "string" && mode.toLowerCase() == "read");
this._fbResolveErr = null;
this._fbResolveWarn = null;
var self = this;
function pathOf(row) {
    var parts = [], cur = row, g = 0;
    while (cur && g++ < 60) {
        parts.unshift("" + cur.name);
        if (!cur.parentId || cur.parentId <= 0) { break; }
        try { cur = self.FB_TargetCache(Repository, "package", "" + cur.parentId); } catch (eP) { cur = null; }
    }
    return parts.join(".");
}
var pkg = null;
// --- cesta ---
if (ref !== null && typeof ref == "object" && Object.prototype.toString.call(ref.path) == "[object Array]") {
    var row = null;
    try { row = this.FB_TargetCache(Repository, "package", ref); } catch (eT) { row = null; }
    if (row == null) {
        var pkey = "path:" + ref.path.join("\u0001") + "|" + ("" + (ref.from === null || typeof ref.from == "undefined" ? "" : ref.from));
        var err = (this._fbTargetCache && this._fbTargetCache.err) ? this._fbTargetCache.err[pkey] : null;
        this._fbResolveErr = err ? { code: "" + (err.code || "E_NOT_FOUND"), message: "" + (err.message || "cesta nenalezena"),
                                     guids: err.guids || [], candidates: err.candidates || [], found: err.found, children: err.children }
                                 : { code: "E_NOT_FOUND", message: "cesta nenalezena", guids: [], candidates: [] };
        return null;
    }
    try { pkg = Repository.GetPackageByGuid("" + row.guid); } catch (eG) { pkg = null; }
    return pkg;
}
var t = ("" + (ref === null || typeof ref == "undefined" ? "" : ref)).replace(/^\s+|\s+$/g, "");
if (t == "") { return null; }
// FB-PU-30 (Z261004b-7): GUID bez slozenych zavorek se doplni (driv se hledal
// jako jmeno -> "nenalezen"); tvar {…} s cizimi znaky se odmitne PRED SQL
if (/^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(t)) { t = "{" + t + "}"; }
if (t.charAt(0) == "{" && !/^\{[A-Za-z0-9-]+\}$/.test(t)) {
    this._fbResolveErr = { code: "E_ARGS", message: "neplatny tvar GUID '" + t + "' - GUID je {8-4-4-4-12 hex} (napr. z pingu/find_*), bez mezer a cizich znaku", guids: [], candidates: [] };
    return null;
}
try {
    if (t.charAt(0) == "{") {
        pkg = Repository.GetPackageByGuid(t);
    } else if (/^[0-9]+$/.test(t)) {
        pkg = Repository.GetPackageByID(parseInt(t, 10));
    } else {
        var r = null;
        try { r = this.FB_TargetCache(Repository, "package", t); } catch (eC) { r = null; }
        if (r != null) { pkg = Repository.GetPackageByGuid("" + r.guid); }
        else {
            var amb = (this._fbTargetCache && this._fbTargetCache.amb) ? this._fbTargetCache.amb["package:" + t] : null;
            if (amb && amb.length > 1) {
                var guids = [], cands = [];
                for (var a = 0; a < amb.length; a++) { guids.push(amb[a].guid); cands.push({ guid: amb[a].guid, path: pathOf(amb[a]) }); }
                if (readMode) {
                    this._fbResolveWarn = "jmeno balicku '" + t + "' odpovida " + amb.length + " balickum - cteni bere prvni (" + cands[0].path + "); pro zapis uved GUID";
                    pkg = Repository.GetPackageByGuid("" + amb[0].guid);
                } else {
                    this._fbResolveErr = { code: "E_AMBIGUOUS", message: "jmeno balicku '" + t + "' odpovida " + amb.length + " balickum - uved GUID kandidata nebo cestu {path: [...]}",
                                           guids: guids, candidates: cands };
                }
            }
        }
    }
} catch (e) {
    pkg = null;
}
return pkg;
