// AICodeBridge.FB_ResolveEl(Repository, ref, mode)
// Najde element podle "{GUID}" | elementID (cislice) | jmena. Vraci Element
// nebo null. Sdileny resolver pro vsechny operace.
// JMENO (zadani cil zapisu v1.1 kap. 5.7, W7, Z261004b-10): presna shoda v JS
// pres FB_TargetCache. Vychozi rezim = ZAPIS: jmeno musi odpovidat prave
// jednomu prvku, jinak null + this._fbResolveErr = { code: "E_AMBIGUOUS",
// message, guids[], candidates[{guid, path}] } (volajici vrati E_AMBIGUOUS -
// FB_ResolveFail). mode "read": vic shod = PRVNI shoda + this._fbResolveWarn
// (cteni beze zmeny chovani, jen varovani). Parametr mode je novy - cte se
// jen pres typeof (pravidlo FB-PU-01).
var readMode = (typeof mode == "string" && mode.toLowerCase() == "read");
this._fbResolveErr = null;
this._fbResolveWarn = null;
var self = this;
function pathOf(row) {
    var parts = ["" + row.name], g = 0;
    var cur = null;
    try { cur = (row.pkgId > 0) ? self.FB_TargetCache(Repository, "package", "" + row.pkgId) : null; } catch (eP) { cur = null; }
    while (cur && g++ < 60) {
        parts.unshift("" + cur.name);
        if (!cur.parentId || cur.parentId <= 0) { break; }
        try { cur = self.FB_TargetCache(Repository, "package", "" + cur.parentId); } catch (eP2) { cur = null; }
    }
    return parts.join(".");
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
var el = null;
try {
    if (t.charAt(0) == "{") {
        el = Repository.GetElementByGuid(t);
    } else if (/^[0-9]+$/.test(t)) {
        el = Repository.GetElementByID(parseInt(t, 10));
    } else {
        var r = null;
        try { r = this.FB_TargetCache(Repository, "element", t); } catch (eC) { r = null; }
        if (r != null) { el = Repository.GetElementByGuid("" + r.guid); }
        else {
            var amb = (this._fbTargetCache && this._fbTargetCache.amb) ? this._fbTargetCache.amb["element:" + t] : null;
            if (amb && amb.length > 1) {
                var guids = [], cands = [];
                for (var a = 0; a < amb.length; a++) { guids.push(amb[a].guid); cands.push({ guid: amb[a].guid, path: pathOf(amb[a]) }); }
                if (readMode) {
                    this._fbResolveWarn = "jmeno prvku '" + t + "' odpovida " + amb.length + " prvkum - cteni bere prvni (" + cands[0].path + "); pro zapis uved GUID";
                    el = Repository.GetElementByGuid("" + amb[0].guid);
                } else {
                    this._fbResolveErr = { code: "E_AMBIGUOUS", message: "jmeno prvku '" + t + "' odpovida " + amb.length + " prvkum - uved GUID kandidata",
                                           guids: guids, candidates: cands };
                }
            }
        }
    }
} catch (e) {
    el = null;
}
return el;
