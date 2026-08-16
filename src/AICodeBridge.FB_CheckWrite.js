// AICodeBridge.FB_CheckWrite(Repository, pkg)
// Spolecna kontrola zapisu: (1) identita repozitare dle FB_RepoId musi mit
// polozku ve FB_Whitelist, (2) cilovy package musi byt whitelistovany PRIMO
// NEBO byt POTOMKEM whitelistovaneho package (whitelist = cela vetev; jinak
// by nesly zakladat sub-packages, coz je zakladni vzor scaffoldu).
// Vraci null kdyz je zapis povolen, jinak objekt { code, message }.
if (pkg == null) {
    return { code: "E_NOT_FOUND", message: "Cilovy package nenalezen." };
}
var wl = this.FB_Whitelist();
var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
var repoKnown = false;
var allowed = {};
for (var i = 0; i < wl.length; i++) {
    var w = wl[i];
    if (rid.indexOf(("" + w.repo).toUpperCase()) < 0) { continue; }
    repoKnown = true;
    allowed[("" + w.pkg).toUpperCase()] = 1;
}
if (!repoKnown) {
    return { code: "E_REPO", message: "Pripojeny repozitar neni ve whitelistu - zapis zamitnut. Identita: "
        + this.FB_RepoId(Repository) + " | Pripojeni: " + Repository.ConnectionString };
}
var p = pkg;
var depth = 0;
while (p != null && depth < 60) {
    if (allowed[("" + p.PackageGUID).toUpperCase()] == 1) { return null; }
    var parentId = 0;
    try { parentId = p.ParentID; } catch (e1) { parentId = 0; }
    if (!parentId) { break; }
    try { p = Repository.GetPackageByID(parentId); } catch (e2) { p = null; }
    depth++;
}
return { code: "E_WHITELIST", message: "Package mimo whitelist (vcetne nadrazenych): "
    + pkg.Name + " " + pkg.PackageGUID };
