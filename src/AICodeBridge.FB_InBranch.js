// AICodeBridge.FB_InBranch(Repository, pkgId, rootId)
// true, kdyz package pkgId lezi ve VETVI package rootId (vcetne rootu
// samotneho). Chodi parent retez pres GetPackageByID - zadne SQL, zadne
// dialektove funkce, zadna velka IN () - laciny i nad 1,5M repozitarem
// (kandidatu po jmennem filtru byva par, retez ma jednotky hopu).
// Strop 60 hopu proti cyklu. Pouziva scope filtr find_* operaci (iterace 5, C).
var pid = parseInt(pkgId, 10);
var rid = parseInt(rootId, 10);
if (!pid || !rid || pid < 0 || rid < 0) { return false; }
var guard = 0;
while (pid && pid > 0 && guard++ < 60) {
    if (pid == rid) { return true; }
    var pk = null;
    try { pk = Repository.GetPackageByID(pid); } catch (e) { pk = null; }
    if (!pk) { return false; }
    pid = pk.ParentID;
}
return false;
