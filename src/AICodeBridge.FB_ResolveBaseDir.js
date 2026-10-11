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
// v0.16 (FB-PU-35, Z261004b-3): POD PUMPOU (typeof WScript != "undefined") je
// baseDir VZDY slozka pumpy (WScript.ScriptFullName) - pumpa cte requests\
// vedle sebe, takze stav, journal, obrazky i pending musi lezet tam, ne
// v FB_Config.baseDir jineho repa (doma: workspace ai-transfer vs. repo
// bridge). Explicitni cesta z FB_Config se zaklada PO UROVNICH a overuje
// zapisovou sondou 1x za session (this._fbBaseDirProbe) - selhani nahlasi
// FB_Main warningem hned u prvni davky, ne tichym neukladanim stavu.
var self = this;
var rid = "" + this.FB_RepoId(Repository);
var fso = this.FB_ComObj("Scripting.FileSystemObject");
var base = "";
// 0) pod pumpou: slozka pumpy
if (typeof WScript != "undefined" && WScript && WScript.ScriptFullName) {
    try { base = "" + fso.GetParentFolderName("" + WScript.ScriptFullName); } catch (eW) { base = ""; }
}
// 1) explicitni FB_Config
if (base == "") {
    try {
        var cfgs = this.FB_Config();
        var ridU = rid.toUpperCase();
        for (var i = 0; i < cfgs.length; i++) {
            if (ridU.indexOf(("" + cfgs[i].repo).toUpperCase()) >= 0 && cfgs[i].baseDir) {
                base = ("" + cfgs[i].baseDir).replace(/[\\\/]+$/, "");
                break;
            }
        }
    } catch (eC) { }
}
// 2) default
if (base == "") {
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
// zapisova sonda 1x za session (per cesta) - vysledek si cte FB_Main
if (!this._fbBaseDirProbe || ("" + this._fbBaseDirProbe.path).toLowerCase() != base.toLowerCase()) {
    var probe = { path: base, ok: true, why: "", reported: false };
    try {
        if (!fso.FolderExists(base)) { throw new Error("slozka neexistuje a nejde zalozit"); }
        var pf = base + "\\.write-probe.tmp";
        var stp = this.FB_ComObj("ADODB.Stream");
        stp.Type = 2; stp.Charset = "utf-8"; stp.Open();
        stp.WriteText("probe");
        stp.SaveToFile(pf, 2);
        stp.Close();
        if (!fso.FileExists(pf)) { throw new Error("testovaci soubor po zapisu neexistuje"); }
        fso.DeleteFile(pf);
    } catch (ePr) {
        probe.ok = false;
        probe.why = "" + ePr.message;
        try { this.Log(Repository, "FB POZOR: slozka vymeny " + base + " neni zapisovatelna (" + probe.why + ") - stav/journal/obrazky se neulozi"); } catch (eLg) { }
    }
    this._fbBaseDirProbe = probe;
}
return base;
