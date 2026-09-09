// AICodeBridge.FB_UserAccess(Repository)
// Urci pristup PRIHLASENEHO uzivatele k WRITE ficuram add-inu (iterace 5,
// feature A; konfigurace = FB_AccessGroups). Vraci:
//   { securityEnabled, login, access: "write" | "read", reason, groups[] }
// Pravidla (rozhodnuti Milos 2026-08-20):
//   - EA security VYPNUTA -> "write" (vse povoleno; vynucovani bez security
//     nedava smysl).
//   - Security ZAPNUTA: login = Repository.GetCurrentLoginUser(false);
//     clenstvi ve skupinach = SQL nad t_secuser / t_secgroup / vazebni
//     tabulkou t_secusergroup. Clen aspon jedne writeGroups -> "write".
//   - JAKAKOLI nejistota (repo bez polozky, login nezjisten, SQL selze,
//     spatna jmena tabulek) -> fail-closed "read" s konkretnim duvodem.
// Jmena security tabulek OVERENA ZIVE 2026-09-09 (K8 QEAX, EA 17.1.5, SQLite;
// res-K3b-xref.json): t_secuser [UserID, UserLogin], t_secgroup [GroupID,
// GroupName], vazebni tabulka je t_secusergroup [UserID, GroupID] - BEZ
// podtrzitka (do 2026-09-09 tu byl chybny nazev t_secuser_group: EA vratila
// vysledek bez Dataset_0 + modalni dialog "SQL API Open FAILED ... no such
// table", clenstvi vyslo prazdne -> E_ADDIN_ACCESS i pro clena skupiny).
// Dalsi tabulky schematu: t_secgrouppermission, t_secuserpermission,
// t_secpermission, t_secpolicies, t_seclocks, t_xrefsystem. Na MS SQL v bance
// tataz jmena (standardni schema EA). SQL bezi JEN pri zapnute security -
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
        var xml = "" + Repository.SQLQuery(
            "SELECT g.GroupName FROM t_secgroup g"
            + " INNER JOIN t_secusergroup ug ON ug.GroupID = g.GroupID"
            + " INNER JOIN t_secuser u ON u.UserID = ug.UserID"
            + " WHERE u.UserLogin = '" + ("" + login).replace(/'/g, "''") + "'");
        // EA pri chybnem SQL NEvyhodi vyjimku - vrati vysledek bez <Dataset_0>
        // (lekce E_SQL 2026-09-08 + zive K6 2026-09-09). Bez datasetu je to
        // selhani dotazu, ne "zadne clenstvi" - duvod musi rict pravdu.
        if (xml.indexOf("<Dataset_0") < 0) {
            sqlFail = "EA nevratila dataset (neexistujici tabulka/sloupec? viz dialog EA)";
        } else {
            var rows = this.FB_XmlRows(xml);
            for (var ri = 0; ri < rows.length; ri++) {
                if (rows[ri].GroupName) { groups.push("" + rows[ri].GroupName); }
            }
        }
    } catch (eQ) { sqlFail = "" + eQ.message; }
    if (sqlFail != "") {
        result = failClosed("clenstvi ve skupinach nelze zjistit (SQL selhal: " + sqlFail
            + ") - fail-closed read; over jmena tabulek t_secuser/t_secgroup/t_secusergroup", []);
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
