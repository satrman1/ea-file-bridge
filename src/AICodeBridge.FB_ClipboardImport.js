// AICodeBridge.FB_ClipboardImport(Repository)
// PLNE RUCNI CLIPBOARD REZIM (fallback bez PowerShellu, 2026-08-20).
// Duvod: vratny (PS proces hlidajici schranku ve smycce) = pro AV "Dropper"
// (Norton CMD:Powershell-AP [Drp], Auto-Protect) - persistent child watching
// clipboard je infostealer signatura (red team W1). Tento rezim bezi CELY
// uvnitr EA.exe: menu klik precte davku ze SCHRANKY (COM htmlfile, zadny
// powershell, zadny watcher -> AV-neviditelne), zpracuje ji (FB_Main, confirm
// okruh kanalem "gui" pres EA dialog) a chat verzi vlozi ZPET do schranky +
// ukaze v dialogu. UX: Copy v Copilotu -> klik v menu -> Ctrl+V. Klik za
// davku (jako dnesni M365-A), ale s pohodlim schranky misto ukladani souboru.
// Bezi VYHRADNE v EA runtime (Mozilla JS) - COM jen pres FB_ComObj (par. 1a).
// Kontrakt confirm okruhu (par. 6e) beze zmeny: ELEVATED -> EA dialog ->
// FB_ConfirmPending kanal "gui"; potvrzovaci pole v obsahu davky odmita
// executor sam (E_RISK_CONFIRM) + druha obrana zde (nematerializovat).
var self = this;
var fso = this.FB_ComObj("Scripting.FileSystemObject");
// --- konfigurace slozek (stejna jako GUI fallback) ---
var cfgs = this.FB_Config();
var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
var cfg = null;
for (var ci = 0; ci < cfgs.length; ci++) {
    if (rid.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) { cfg = cfgs[ci]; break; }
}
if (cfg == null || !cfg.baseDir) { cfg = { baseDir: this.FB_ResolveBaseDir(Repository) }; }
var DIR_REQ = cfg.baseDir + "\\requests";
var DIR_RES = cfg.baseDir + "\\responses";
var DIR_PEND = DIR_REQ + "\\pending";
var DIR_PROC = DIR_REQ + "\\processed";
var DIR_REJ = DIR_REQ + "\\rejected";
function ensureDir(p) { if (!fso.FolderExists(p)) { fso.CreateFolder(p); } }
ensureDir(DIR_REQ); ensureDir(DIR_RES); ensureDir(DIR_PEND); ensureDir(DIR_PROC); ensureDir(DIR_REJ);
function pad2(n) { return (n < 10 ? "0" : "") + n; }
function ts() {
    var d = new Date();
    return "" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate())
        + "-" + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}
function writeUtf8(path, text) {
    var st = self.FB_ComObj("ADODB.Stream");
    st.Type = 2; st.Charset = "utf-8"; st.Open();
    st.WriteText(text);
    st.SaveToFile(path, 2);
    st.Close();
}
function readUtf8(path) {
    var st = self.FB_ComObj("ADODB.Stream");
    st.Type = 2; st.Charset = "utf-8"; st.Open();
    st.LoadFromFile(path);
    var s = st.ReadText(-1);
    st.Close();
    return ("" + s).replace(/^\uFEFF/, "");
}
function resName(n) { return /^req/i.test(n) ? n.replace(/^req/i, "res") : ("res-" + n); }
// --- schranka: cteni/zapis zevnitr EA pres COM htmlfile (zadny powershell) ---
function clipRead() {
    var html = self.FB_ComObj("htmlfile");
    var t = html.parentWindow.clipboardData.getData("Text");
    return (t === null || typeof t == "undefined") ? "" : ("" + t);
}
// LEKCE 2026-08-20 (naziво): htmlfile.setData v EA runtime TISE nic nezapise
// (getData funguje, setData ne - schranka drzela puvodni davku). Proto:
// (1) zkus setData + OVER read-backem, jestli se fakt zapsalo;
// (2) fallback = clip.exe (bezny nastroj Windows, ZADNY powershell): temp
//     UTF-16LE (ADODB "unicode" = LE+BOM, clip.exe cte korektne vc. diakritiky)
//     -> cmd /c clip < temp -> smaz temp. cmd+clip neni malware vzor (na rozdil
//     od powershellu), AV to neresi.
function clipWrite(s) {
    s = "" + s;
    try {
        var html = self.FB_ComObj("htmlfile");
        html.parentWindow.clipboardData.setData("Text", s);
        var chk = "" + html.parentWindow.clipboardData.getData("Text");
        if (chk === s) { return true; }
    } catch (eCW) { }
    try {
        var tmp = DIR_RES + "\\_clip.tmp";
        var st = self.FB_ComObj("ADODB.Stream");
        st.Type = 2; st.Charset = "unicode"; st.Open();
        st.WriteText(s);
        st.SaveToFile(tmp, 2);
        st.Close();
        var sh = self.FB_ComObj("WScript.Shell");
        sh.Run('cmd /c clip < "' + tmp + '"', 0, true);
        if (fso.FileExists(tmp)) { fso.DeleteFile(tmp); }
        return true;
    } catch (eClip) { return false; }
}
// --- EA dialog Ano/Ne/Storno (kanal "gui"); fallback WScript.Shell.Popup ---
function askUser(text) {
    try {
        var rr = Session.Prompt(text, 3); // promptYESNOCANCEL
        if (rr == 3) { return "yes"; }
        if (rr == 4) { return "no"; }
        if (rr == 1 || rr == 2) { return "later"; }
    } catch (eS) { }
    try {
        var shP = self.FB_ComObj("WScript.Shell");
        var b = shP.Popup(text, 600, "EA File Bridge - potvrzeni davky", 3 + 32);
        if (b == 6) { return "yes"; }
        if (b == 7) { return "no"; }
    } catch (eP) { }
    return "later";
}
// --- confirm cyklus nad cekajici davkou (pending\, res existuje) ---
function offerPending(pendPath, respText) {
    var nm = "" + fso.GetFileName(pendPath);
    for (var round = 0; round < 3; round++) {
        var r = null;
        try { r = self.FB_JsonParse(respText); } catch (ePr) { r = null; }
        if (r == null || ("" + r.status) != "confirm_required") { return respText; }
        if (!r.confirm || !r.confirm.nonce) {
            return respText;
        }
        var verdict = askUser("CEKA NA POTVRZENI (Risk Gate ELEVATED)\n\n" + self.FB_ConfirmSummary(r)
            + "\n\nAno = provest, Ne = zamitnout (rejected), Storno = nechat cekat v pending\\.");
        if (verdict == "later") { return respText; }
        var out = "" + self.FB_ConfirmPending(Repository, pendPath, r.confirm.nonce, r.confirm.payloadHash, "gui", (verdict == "yes"));
        writeUtf8(DIR_RES + "\\" + resName(nm), out);
        if (out.indexOf("\"status\":\"confirm_required\"") >= 0) { respText = out; continue; }
        return out;
    }
    return respText;
}
// ========================= vlastni beh ===============================
var clip = "";
try { clip = clipRead(); }
catch (eCR) {
    return "CHYBA cteni schranky (COM htmlfile v EA runtime): " + eCR.message
        + "\nPravdepodobne EA JS runtime nepodporuje clipboardData.getData. Ohlas - zvolime jinou cestu cteni schranky.";
}
if (clip == "" || clip.indexOf("\"protocol\"") < 0 || !/"protocol"\s*:\s*"eafb\//.test(clip)) {
    return "Schranka neobsahuje eafb davku. Zkopiruj (Copy) code blok s davkou v Copilotu a klikni znovu.";
}
// druha obrana (B1): davka s potvrzovacimi poli se NEmaterializuje
if (/"(nonce|payloadHash|confirmNonce|confirmHash|confirmChannel|confirmedBy)"\s*:/.test(clip)) {
    return "ODMITNUTO: schranka nese davku s potvrzovacimi poli (nonce/payloadHash) - nematerializuje se (druha obrana B1). Potvrzeni probiha vyhradne timto dialogem, nikdy z obsahu davky.";
}
// id + dedup (per-session, W5) - stejna logika jako vratny
var id = "noid-" + ts();
var mId = /"id"\s*:\s*"([^"]{1,80})"/.exec(clip);
if (mId) { id = mId[1]; }
var id2 = ("" + id).replace(/[^0-9A-Za-z_.-]/g, "_");
if (!self._fbClipSeen) { self._fbClipSeen = {}; }
var dk = id2 + "|" + this.FB_Sha256(clip);
if (self._fbClipSeen[dk]) {
    return "Davka " + id2 + " uz byla v teto session zpracovana (dedup W5) - preskoceno. Pro novou davku zmen id.";
}
var reqName = "req-" + id2 + ".json";
var reqPath = DIR_REQ + "\\" + reqName;
if (fso.FileExists(reqPath) || fso.FileExists(DIR_PEND + "\\" + reqName)) {
    return "req-" + id2 + ".json uz je ve fronte nebo ceka v pending\\ - vyres ji nejdriv, nebo posli davku s jinym id.";
}
writeUtf8(reqPath, clip);
self._fbClipSeen[dk] = 1;
// zpracovani (kontrakt I5: FB_Main dostava CESTU - hash surovych bajtu)
var respText = "" + this.FB_Main(Repository, reqPath);
writeUtf8(DIR_RES + "\\" + resName(reqName), respText);
this.Log(Repository, "FB clipboard: " + reqName + " zpracovan");
// confirm_required -> EA dialog (kanal gui); executor uz presunul do pending\
if (respText.indexOf("\"status\":\"confirm_required\"") >= 0) {
    respText = offerPending(DIR_PEND + "\\" + reqName, respText);
} else {
    // done/error/rejected -> archiv (stejny zivotni cyklus jako GUI fallback)
    var rejected = (respText.indexOf("\"code\":\"E_PARSE\"") >= 0)
        || (respText.indexOf("\"code\":\"E_RISK_BLOCKED\"") >= 0)
        || (respText.indexOf("\"code\":\"E_RISK_CONFIRM\"") >= 0);
    if (fso.FileExists(reqPath)) {
        fso.MoveFile(reqPath, (rejected ? DIR_REJ : DIR_PROC) + "\\" + reqName.replace(/\.json$/i, "") + "." + ts() + ".json");
    }
}
// interaktivni rezim: ukaz v Project browseru, co vzniklo (UX pozorovatelnost)
try { this.FB_ShowInBrowser(Repository, this.FB_JsonParse(respText)); } catch (eSb) { }
// chat verze -> zpet do schranky + do dialogu (par. 3.3; nikdy nonce/plny hash)
var chat = "";
try {
    var obj = this.FB_JsonParse(respText);
    chat = "" + this.FB_ChatRender(obj);
} catch (eCh) { chat = "EAFB: chat rendering selhal (" + eCh.message + ") - plna odpoved v res-" + id2 + ".json"; }
var putBack = clipWrite(chat);
return "Davka " + id2 + " zpracovana.\n\n" + chat
    + "\n\n" + (putBack
        ? "Chat verze je ve schrance - prepni do Copilota a dej Ctrl+V."
        : "(Vlozeni do schranky se nezdarilo - zkopiruj text vyse rucne; plna odpoved je v res-" + id2 + ".json.)");
