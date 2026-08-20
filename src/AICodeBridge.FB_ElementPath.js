// AICodeBridge.FB_ElementPath(Repository, kind, ref)
// Vraci TECKOU oddelenou cestu k prvku/balicku tak, jak ji zobrazuje EA
// browser: "Root.Balicek.Podbalicek.Prvek". Klicove pro pozorovatelnost nad
// velkym repozitarem (1,5M prvku) - uzivatel z cesty pozna, KAM davka sahla.
//   kind = "element" | "package"
//   ref  = EA.Element / EA.Package objekt NEBO jeho ID (cislo)
// Bezi v obou runtime (jen Repository metody, zadny COM). Strop 60 hopu proti
// pripadne cykli. Chyba -> vraci "?" (nikdy nespadne - je to jen popisek).
var parts = [];
var guard = 0;
var pkgId = 0;
try {
    if (("" + kind).toLowerCase() == "element") {
        var el = (ref && typeof ref == "object" && typeof ref.ElementID != "undefined")
            ? ref : Repository.GetElementByID(parseInt(ref, 10));
        if (!el) { return "?"; }
        parts.push("" + el.Name);
        var pid = el.ParentID;
        while (pid && pid > 0 && guard++ < 60) {
            var pe = Repository.GetElementByID(pid);
            if (!pe) { break; }
            parts.unshift("" + pe.Name);
            pid = pe.ParentID;
        }
        pkgId = el.PackageID;
    } else {
        pkgId = (ref && typeof ref == "object" && typeof ref.PackageID != "undefined")
            ? ref.PackageID : parseInt(ref, 10);
    }
    while (pkgId && pkgId > 0 && guard++ < 60) {
        var pk = Repository.GetPackageByID(pkgId);
        if (!pk) { break; }
        parts.unshift("" + pk.Name);
        pkgId = pk.ParentID;
    }
} catch (e) {
    if (parts.length == 0) { return "?"; }
}
return parts.join(".");
