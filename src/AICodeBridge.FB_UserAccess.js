// AICodeBridge.FB_UserAccess(Repository)
// Urci pristup PRIHLASENEHO uzivatele k WRITE ficuram add-inu (iterace 5,
// feature A; konfigurace = FB_AccessGroups). Vraci:
//   { securityEnabled, login, access: "write" | "read", reason, groups[] }
// Pravidla (rozhodnuti Milos 2026-08-20):
//   - EA security VYPNUTA -> "write" (vse povoleno; vynucovani bez security
//     nedava smysl).
//   - Security ZAPNUTA: login = Repository.GetCurrentLoginUser(false);
//     clenstvi ve skupinach = SQL nad t_secuser / t_secgroup / vazebni
//     tabulkou t_secuser_group. Clen aspon jedne writeGroups -> "write".
//   - JAKAKOLI nejistota (repo bez polozky, login nezjisten, SQL selze,
//     spatna jmena tabulek) -> fail-closed "read" s konkretnim duvodem.
// !! PRESNA jmena security tabulek OVERIT v bance ctecí davkou (standardni
// schema EA = t_secuser [UserID, UserLogin], t_secgroup [GroupID, GroupName],
// t_secuser_group [UserID, GroupID]; zadani iterace 5 zminovalo t_secmember,
// ktera ve standardnim schematu neni). SQL bezi JEN pri zapnute security -
// na dev .qea bez security se nikdy nespusti (sonda cizich tabulek na
// SQLite = riziko modalu, lekce par. 6a/3).
// Cache per repo+login na dobu session (in-memory, zanika restartem EA;
// zmena clenstvi ve skupinach se projevi az po restartu - dokumentovano).
var secOn = false;
try { secOn = (Repository.IsSecurityEnabled === true); } catch (eSec) { secOn = false; }
if (!secOn) {
    return { securityEnabled: false, login: "", access: "write", groups: [],
        reason: "EA security je vypnuta - write ficury povoleny (FB_AccessGroups se neuplatnuje)" };
}
var login = "";
try { login = "" + Repository.GetCurrentLoginUser(false); } catch (eLg) { login = ""; }
var rid = "" + this.FB_RepoId(Repository);
function failClosed(reason, groups) {
    return { securityEnabled: true, login: login, access: "read",
        groups: groups || [], reason: reason };
}
if (login == "") {
    return failClosed("prihlaseneho uzivatele nelze zjistit (GetCurrentLoginUser) - fail-closed read");
}
var cacheKey = rid.toUpperCase() + "|" + login.toUpperCase();
if (this._fbAccessCache && this._fbAccessCache.key == cacheKey) {
    return this._fbAccessCache.value;
}
var cfg = null;
try {
    var ag = this.FB_AccessGroups();
    var ridU = rid.toUpperCase();
    for (var ci = 0; ci < ag.length; ci++) {
        if (ridU.indexOf(("" + ag[ci].repo).toUpperCase()) >= 0) { cfg = ag[ci]; break; }
    }
} catch (eCf) { cfg = null; }
var result;
if (cfg == null) {
    result = failClosed("repozitar nema polozku ve FB_AccessGroups - fail-closed read (pri zapnute security je konfigurace povinna)");
} else {
    var groups = [];
    var sqlFail = "";
    try {
        var rows = this.FB_XmlRows(Repository.SQLQuery(
            "SELECT g.GroupName FROM t_secgroup g"
            + " INNER JOIN t_secuser_group ug ON ug.GroupID = g.GroupID"
            + " INNER JOIN t_secuser u ON u.UserID = ug.UserID"
            + " WHERE u.UserLogin = '" + ("" + login).replace(/'/g, "''") + "'"));
        for (var ri = 0; ri < rows.length; ri++) {
            if (rows[ri].GroupName) { groups.push("" + rows[ri].GroupName); }
        }
    } catch (eQ) { sqlFail = "" + eQ.message; }
    if (sqlFail != "") {
        result = failClosed("clenstvi ve skupinach nelze zjistit (SQL selhal: " + sqlFail
            + ") - fail-closed read; over jmena tabulek t_secuser/t_secgroup/t_secuser_group", []);
    } else {
        var want = cfg.writeGroups || [];
        var isMember = false;
        for (var wi = 0; wi < want.length && !isMember; wi++) {
            for (var gi = 0; gi < groups.length; gi++) {
                if (("" + groups[gi]).toUpperCase() == ("" + want[wi]).toUpperCase()) { isMember = true; break; }
            }
        }
        result = isMember
            ? { securityEnabled: true, login: login, access: "write", groups: groups,
                reason: "clen write skupiny dle FB_AccessGroups" }
            : failClosed("uzivatel neni clenem zadne write skupiny dle FB_AccessGroups ("
                + want.join(", ") + ") - cteci operace funguji", groups);
    }
}
this._fbAccessCache = { key: cacheKey, value: result };
return result;
