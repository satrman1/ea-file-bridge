// AICodeBridge.FB_GatekeeperLaunch(Repository)
// LAUNCHER AI IMPORT REZIMU (iterace 4, zadani par. 2): vytahne kanon
// vratneho z modelu (FB_Gatekeeper), dosadi parametry, odstrani komentare
// a spusti powershell.exe (Windows PS 5.1 - NIKDY pwsh, GetActiveObject
// v PS7 neexistuje, red team I1). ZADNY skriptovy soubor na disku.
// NOSIC KODU (rozhodnuti 2026-08-19, misto fallbacku R1): -EncodedCommand
// nese jen bootstrap `iex([Console]::In.ReadToEnd())`; plny kanon jde
// rourou StdIn pres WScript.Shell.Exec (= primy CreateProcess, ne cmd -
// R4/W2: command line ma strop 32767 znaku, kanon 15k+ znaku se do nej
// nevejde; roura limit nema). Kod se rodi inline z EA, nikdy z disku.
// W8: FB_SessionStart PRED spustenim vratneho (otviraci baseline);
// souhrn se predava do $SessionInfo (uvodni stav okna + zaverecny souhrn).
// Bezi v EA runtime (menu klik) - COM vyhradne pres FB_ComObj (par. 1a),
// base64 cistym JS (zadne MSXML/ADODB binarni pasti - par. 1a/4).
// Volitelne prepsani parametru bez restartu EA: <baseDir>\gk-config.json
//   { "reapTimeoutMin": 10, "reattachSec": 10, "healthSec": 15,
//     "reapGraceSec": 30, "stuckSec": 20, "dlDir": "C:\\...\\Downloads",
//     "debug": false }
// (jen tyto klice; soubor je volitelny - bez nej plati defaulty nize).
// debug: true = konzole PS zustane viditelna (-NoExit, bez Hidden) - jedina
// cesta, jak videt pripadnou parse/runtime chybu kanonu pri ladeni.
var fso = this.FB_ComObj("Scripting.FileSystemObject");
var rid = "" + this.FB_RepoId(Repository);
var cfgs = this.FB_Config();
var cfg = null;
var ridU = rid.toUpperCase();
for (var ci = 0; ci < cfgs.length; ci++) {
    if (ridU.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) { cfg = cfgs[ci]; break; }
}
if (cfg == null || !cfg.baseDir) {
    return "CHYBA: FB_Config nema baseDir pro repozitar " + rid + " - vratny se nespusti.";
}
// defaulty (W3 par. 1) + volitelny gk-config.json override
var gk = { reapTimeoutMin: 10, reattachSec: 10, healthSec: 15, reapGraceSec: 30, stuckSec: 20, dlDir: "", debug: false };
try {
    var gp = cfg.baseDir + "\\gk-config.json";
    if (fso.FileExists(gp)) {
        var st = this.FB_ComObj("ADODB.Stream");
        st.Type = 2; st.Charset = "utf-8"; st.Open(); st.LoadFromFile(gp);
        var gtxt = ("" + st.ReadText(-1)).replace(/^\uFEFF/, "");
        st.Close();
        var go = this.FB_JsonParse(gtxt);
        var keys = ["reapTimeoutMin", "reattachSec", "healthSec", "reapGraceSec", "stuckSec", "dlDir", "debug"];
        for (var ki = 0; ki < keys.length; ki++) {
            if (typeof go[keys[ki]] != "undefined") { gk[keys[ki]] = go[keys[ki]]; }
        }
    }
} catch (eG) { }
if (!gk.dlDir) {
    try {
        var sh0 = this.FB_ComObj("WScript.Shell");
        gk.dlDir = "" + sh0.ExpandEnvironmentStrings("%USERPROFILE%") + "\\Downloads";
    } catch (eD) { gk.dlDir = ""; }
}
// W8: otviraci baseline JESTE PRED prvnim stouchnutim
var sess = "";
try { sess = "" + this.FB_SessionStart(Repository); }
catch (eS) { sess = "session baseline selhal: " + eS.message; }
// kanon vratneho z modelu
var src = "";
try { src = "" + this.FB_Gatekeeper(); }
catch (eK) { return "CHYBA: kanon FB_Gatekeeper se nepodarilo nacist z modelu: " + eK.message; }
// materializace: vypustit komentarove radky (#...) a prazdne, orezat odsazeni
// (kanon v modelu zustava citelny; roura nese jen vykonny kod)
var srcLines = src.split("\n");
var body = [];
for (var li = 0; li < srcLines.length; li++) {
    var ln = ("" + srcLines[li]).replace(/^\s+/, "").replace(/\s+$/, "");
    if (ln == "" || ln.charAt(0) == "#") { continue; }
    body.push(ln);
}
function psq(s) { return "'" + ("" + s).replace(/'/g, "''") + "'"; }
var head = "$RepoId=" + psq(rid)
    + ";$BaseDir=" + psq(cfg.baseDir)
    + ";$DlDir=" + psq(gk.dlDir)
    + ";$SessionInfo=" + psq(sess)
    + ";$ReapTimeoutMin=" + parseInt(gk.reapTimeoutMin, 10)
    + ";$ReattachSec=" + parseInt(gk.reattachSec, 10)
    + ";$HealthSec=" + parseInt(gk.healthSec, 10)
    + ";$ReapGraceSec=" + parseInt(gk.reapGraceSec, 10)
    + ";$StuckSec=" + parseInt(gk.stuckSec, 10);
var ps = head + "\n" + body.join("\n") + "\n";
// bootstrap do -EncodedCommand: precte CELY StdIn a vykona ho jako JEDEN
// skript (zadna REPL semantika -Command -). Base64 UTF-16LE cistym JS.
var boot = "iex([Console]::In.ReadToEnd())";
var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var bytes = [];
for (var i2 = 0; i2 < boot.length; i2++) {
    var c = boot.charCodeAt(i2);
    bytes.push(c & 0xFF);
    bytes.push((c >> 8) & 0xFF);
}
var b64 = "";
for (var b = 0; b < bytes.length; b += 3) {
    var n1 = bytes[b];
    var n2 = (b + 1 < bytes.length) ? bytes[b + 1] : 0;
    var n3 = (b + 2 < bytes.length) ? bytes[b + 2] : 0;
    var trip = (n1 << 16) | (n2 << 8) | n3;
    b64 += B64.charAt((trip >> 18) & 63) + B64.charAt((trip >> 12) & 63);
    b64 += (b + 1 < bytes.length) ? B64.charAt((trip >> 6) & 63) : "=";
    b64 += (b + 2 < bytes.length) ? B64.charAt(trip & 63) : "=";
}
// Exec = primy CreateProcess (nikdy pres cmd - R4); konzole se sama skryje
// (-WindowStyle Hidden), stavove okno vratneho se objevi do par sekund.
// StdIn.Write muze kratce blokovat, nez se powershell rozbehne a rouru
// vypije - povoleny stav (powershell 5.1 = overeny predpoklad T4-1).
var sh = this.FB_ComObj("WScript.Shell");
var winArgs = gk.debug ? "-NoExit " : "-WindowStyle Hidden ";
var ex = sh.Exec("powershell.exe -NoProfile -NoLogo -STA " + winArgs + "-EncodedCommand " + b64);
ex.StdIn.Write(ps);
ex.StdIn.Close();
return "AI import rezim: vratny spusten (PS 5.1, kanon " + ps.length + " znaku rourou, mutex per repo).\n"
    + "Repo: " + rid + "\nBase: " + cfg.baseDir + "\n" + sess
    + "\nStavove okno se objevi do par sekund. Druhe spusteni odmitne mutex (W3)."
    + "\nRezim ukoncis tlacitkem 'Ukoncit rezim' v okne.";
