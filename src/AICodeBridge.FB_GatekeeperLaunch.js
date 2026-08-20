// AICodeBridge.FB_GatekeeperLaunch(Repository)
// LAUNCHER AI IMPORT REZIMU (iterace 4, zadani par. 2): vytahne kanon
// vratneho z modelu (FB_Gatekeeper), dosadi parametry, odstrani komentare
// a spusti powershell.exe (Windows PS 5.1 - NIKDY pwsh, GetActiveObject
// v PS7 neexistuje, red team I1). ZADNY skriptovy soubor na disku.
// NOSIC KODU (rozhodnuti 2026-08-19, upresneno 2026-08-20 po Norton bloku):
// "powershell.exe ... -Command -" - powershell precte CELY kanon ze StdIn,
// prikazova radka je CISTA (zadny base64 payload). Puvodni -EncodedCommand
// mel base64 na prikazove radce = Norton IDP.HELU.CMD.Generic24 "detekce
// pomoci prikazoveho radku" zablokoval powershell.exe. Roura pres
// WScript.Shell.Exec (= primy CreateProcess, ne cmd); R4/W2: command line ma
// strop 32767 znaku, kanon 15k+ se do nej stejne nevejde. Kod se rodi inline
// z EA, nikdy z disku. R3/W1: chovani-based AV muze i tak namitat -> R5 C-A.
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
// NOSIC KODU = StdIn pres "-Command -" (rozhodnuti 2026-08-19, UPRESNENO
// 2026-08-20 po Norton bloku IDP.HELU.CMD.Generic24 "detekce pomoci
// prikazoveho radku", ochrana na zaklade chovani): puvodni -EncodedCommand
// mel na prikazove radce base64 blob = presne vzor, na ktery command-line
// heuristika kyva -> AV zablokoval spusteni powershell.exe (a Exec pak vratil
// undefined). "-Command -" = powershell precte CELY skript ze StdIn; prikazova
// radka je pak CISTA (zadny payload), kanon jde rourou (bez delkoveho limitu
// R4/W2). Exec = primy CreateProcess (nikdy pres cmd). -Command - MUSI byt
// posledni argument (vse za -Command je hodnota prikazu; "-" = cti StdIn).
// POZN.: chovani-based AV muze i tak namitat proti EA->powershell + schranka
// (R3/W1 optika) - to je vstup pro R5 (podminka C-A: DLP/EDR clearance).
var sh = this.FB_ComObj("WScript.Shell");
var winArgs = gk.debug ? "-NoExit " : "-WindowStyle Hidden ";
var ex = null;
try { ex = sh.Exec("powershell.exe -NoProfile -NoLogo -STA " + winArgs + "-Command -"); }
catch (eEx) { ex = null; }
if (!ex || typeof ex.StdIn == "undefined") {
    return "CHYBA: powershell.exe se nepodarilo spustit (Exec nevratil proces).\n"
        + "Nejcastejsi pricina: antivirus/EDR zablokoval spusteni powershell.exe z EA "
        + "(Norton IDP.HELU.CMD.* / 'detekce pomoci prikazoveho radku' = R3/W1 optika).\n"
        + "Reseni doma: povol/obnov zablokovanou polozku v Norton historii (a pridej vyjimku), "
        + "pak zapni rezim znovu. Pokud problem trva i s cistou prikazovou radkou, jde o "
        + "chovani-based blok (EA->powershell) = vstup pro R5, ohlas.";
}
ex.StdIn.Write(ps);
ex.StdIn.Close();
return "AI import rezim: vratny spusten (PS 5.1, kanon " + ps.length + " znaku rourou StdIn, mutex per repo).\n"
    + "Repo: " + rid + "\nBase: " + cfg.baseDir + "\n" + sess
    + "\nStavove okno se objevi do par sekund. Druhe spusteni odmitne mutex (W3)."
    + "\nRezim ukoncis tlacitkem 'Ukoncit rezim' v okne.";
