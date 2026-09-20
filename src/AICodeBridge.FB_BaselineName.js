// AICodeBridge.FB_BaselineName(action, a1, a2, a3, a4, a5)
// BASELINE POLITIKA - JMENNA KONVENCE automatickych baselines (zadani v1.2
// par. 6.1). JEDINE misto s regularnim vyrazem jmena - sdili ho vznik
// (FB_AutoBaseline, FB_SessionStart), reuse i uklid (FB_BaselineCleanup);
// dve kopie by se rozjely.
//   tvar:  <autoPrefix><login> <session> <RRRR-MM-DD hh:mm:ss>[ (session)]
//   napr.: FB-AUTO jnovak s20260821-1 2026-08-21 09:14:03
// action "format": (prefix, login, token, ms, isSession) -> jmeno
//   login = Repository.GetCurrentLoginUser; prazdny (security vypnuta) -> "-";
//   bile znaky v loginu -> "_" (jmeno se deli mezerami).
// action "parse":  (name, prefix) -> { login, token, time, ms, session } | null
//   CELOTVAROVA shoda (prefix VCETNE mezery, login, session token, ISO cas,
//   volitelny sufix) - NIKDY indexOf. Legacy "FB 2026-..." (stara session
//   baseline), audit "FB <id>", "AI-pre-*" i rucni jmena vraci null = mimo
//   mnozinu automatickych baselines (nestarnou, nemazou se).
//   CAS SE BERE ZE JMENA: atribut `date` v XML GetBaselines v EA 17.1.5
//   NEEXISTUJE (spike 2026-09-07) a poradi prvku v XML neni garantovane.
function pad2(x) { return (x < 10 ? "0" : "") + x; }
function escRe(s) { return ("" + s).replace(/[\\^$.*+?()[\]{}|\-]/g, "\\$&"); }
if (("" + action) == "format") {
    var lg = ("" + (a2 === null || typeof a2 == "undefined" ? "" : a2)).replace(/\s+/g, "_");
    if (lg == "") { lg = "-"; }
    var d = new Date(typeof a4 == "number" ? a4 : new Date().getTime());
    return "" + a1 + lg + " " + a3 + " " + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
        + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds())
        + (a5 === true ? " (session)" : "");
}
if (("" + action) == "parse") {
    var prefix = (typeof a2 == "string" && a2 != "") ? a2 : "FB-AUTO ";
    var re = new RegExp("^" + escRe(prefix) + "(\\S+) (s\\d{8}-\\d+) ((\\d{4})-(\\d{2})-(\\d{2}) (\\d{2}):(\\d{2}):(\\d{2}))( \\(session\\))?$");
    var m = re.exec("" + a1);
    if (!m) { return null; }
    var ms = new Date(parseInt(m[4], 10), parseInt(m[5], 10) - 1, parseInt(m[6], 10),
        parseInt(m[7], 10), parseInt(m[8], 10), parseInt(m[9], 10)).getTime();
    if (isNaN(ms)) { return null; }
    return { login: m[1], token: m[2], time: m[3], ms: ms, session: (typeof m[10] == "string" && m[10] != "") };
}
return null;
