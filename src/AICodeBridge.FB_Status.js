// AICodeBridge.FB_Status(Repository)
// Prehled "kam bridge zapisuje a co cte" pro uzivatele (menu "Stav bridge").
// Odpovida na Milosovy otazky: nad kterym repozitarem jsem, do ktere slozky
// (balicku) smim zapisovat (whitelist s cestou), co ctu. Vraci text pro dialog
// + zapise do Output tabu "AI Bridge".
var self = this;
var rid = "" + this.FB_RepoId(Repository);
var lines = [];
lines.push("=== EA File Bridge - stav ===");
lines.push("");
lines.push("Repozitar (identita): " + rid);
lines.push("Pripojeni: " + Repository.ConnectionString);
lines.push("");
lines.push("ZAPIS je povolen JEN do techto balicku (a cele vetve pod nimi):");
var wl = [];
try { wl = this.FB_Whitelist(); } catch (eWL) { wl = []; }
var ridU = rid.toUpperCase();
var any = 0;
for (var i = 0; i < wl.length; i++) {
    var w = wl[i];
    if (ridU.indexOf(("" + w.repo).toUpperCase()) < 0) { continue; }
    var pth = "?";
    try {
        var pkg = Repository.GetPackageByGuid("" + w.pkg);
        if (pkg) { pth = self.FB_ElementPath(Repository, "package", pkg); }
    } catch (eW) { }
    lines.push("  - " + pth + "   [" + w.pkg + "]");
    any++;
}
if (any == 0) {
    lines.push("  (ZADNY - pro tento repozitar neni whitelist -> vsechny zapisy budou odmitnuty, E_REPO)");
}
lines.push("");
lines.push("CTENI (dotazy SELECT / get_*) je povoleno kdekoli v modelu.");
lines.push("Kazda zapisova davka je klasifikovana (Risk Gate); mazani, klonovani");
lines.push("a hromadne zmeny vyzaduji tve potvrzeni v dialogu.");
lines.push("");
var cfgs = [];
try { cfgs = this.FB_Config(); } catch (eC) { cfgs = []; }
for (var c = 0; c < cfgs.length; c++) {
    if (ridU.indexOf(("" + cfgs[c].repo).toUpperCase()) >= 0) {
        lines.push("Slozka vymeny souboru: " + cfgs[c].baseDir);
        break;
    }
}
lines.push("Zmeny se prubezne vypisuji do Output tabu 'AI Bridge' (cesta + operace).");
var txt = lines.join("\n");
try { this.Log(Repository, txt); } catch (eL) { }
return txt;
