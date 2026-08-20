// AICodeBridge.FB_ResolveBaseDir(Repository)
// Vraci korenovou slozku vymennych souboru (obsahuje requests\ a responses\)
// pro pripojeny repozitar. Zavedeno 2026-08-20 (Milos): kazdy si muze nastavit
// svou slozku, ale BEZ nastaveni to musi fungovat (rozumny default). Poradi:
//  1. FB_Config polozka pro tento repozitar s baseDir (explicitni nastaveni),
//  2. DEFAULT:
//     - lokalni model (.qea/.qeax/.eap/.eapx/.feap = cesta k souboru):
//       slozka MODELU + "\EA-File-Bridge" (data hned u modelu),
//     - jinak (DB repozitar / neznama cesta):
//       %USERPROFILE%\Documents\EA-File-Bridge\<repo-sanitizovane>.
// Vzdy vrati NEPRAZDNY retezec a strom slozek zalozi (idempotentne).
// Bezi v obou runtime - COM jen pres FB_ComObj (par. 1a).
var self = this;
var rid = "" + this.FB_RepoId(Repository);
// 1) explicitni FB_Config
try {
    var cfgs = this.FB_Config();
    var ridU = rid.toUpperCase();
    for (var i = 0; i < cfgs.length; i++) {
        if (ridU.indexOf(("" + cfgs[i].repo).toUpperCase()) >= 0 && cfgs[i].baseDir) {
            return "" + cfgs[i].baseDir;
        }
    }
} catch (eC) { }
// 2) default
var fso = this.FB_ComObj("Scripting.FileSystemObject");
var base = "";
var conn = "";
try { conn = "" + Repository.ConnectionString; } catch (eR) { conn = ""; }
if (/\.(qea|qeax|eap|eapx|feap)$/i.test(conn) && conn.indexOf("\\") >= 0) {
    try { base = fso.GetParentFolderName(conn) + "\\EA-File-Bridge"; } catch (eP) { base = ""; }
}
if (base == "") {
    var home = "C:";
    try { home = "" + this.FB_ComObj("WScript.Shell").ExpandEnvironmentStrings("%USERPROFILE%"); } catch (eH) { home = "C:"; }
    var key = rid.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    if (key.length > 40) { key = key.substring(0, 40); }
    base = home + "\\Documents\\EA-File-Bridge\\" + key;
}
// zaloz strom po urovnich (CreateFolder vyzaduje existujiciho rodice)
try {
    var parts = base.split("\\");
    var cur = parts[0];
    for (var p = 1; p < parts.length; p++) {
        cur = cur + "\\" + parts[p];
        if (cur.indexOf("\\") > 0 && !fso.FolderExists(cur)) {
            try { fso.CreateFolder(cur); } catch (eF) { }
        }
    }
} catch (eMk) { }
var subs = ["\\requests", "\\requests\\pending", "\\requests\\processed", "\\requests\\rejected", "\\responses"];
for (var si = 0; si < subs.length; si++) {
    try { if (!fso.FolderExists(base + subs[si])) { fso.CreateFolder(base + subs[si]); } } catch (eS2) { }
}
return base;
