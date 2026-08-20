// AICodeBridge.FB_ProcessFolder(Repository)
// GUI FALLBACK (akceptacni kriterium 4): zpracuje davky z requests\ bez pumpy
// - stejny zivotni cyklus souboru jako pumpa (response do responses\, archiv
// do processed\ / rejected\ s timestampem). Spousti se z menu add-inu
// "Process requests (File Bridge)" - bezi UVNITR EA.exe (zaklad prod strany
// M365-A, iterace 2). Slozku resi FB_Config dle identity repozitare.
// Vraci textovy souhrn pro Session.Output/dialog.
// v0.2 (20260817): COM objekty pres FB_ComObj a vypis slozky bez JScript
// Enumeratoru - v EA runtime (Mozilla JavaScript) neni ActiveXObject ani
// Enumerator; puvodni verze proto v EA tise padala.
// v0.3 (iterace 4b V2 - CONFIRM OKRUH):
//  - FB_Main dostava CESTU k souboru (kontrakt I5) - hash surovych bajtu.
//  - Podslozka requests\pending\ se strukturalne preskakuje (vypis bere jen
//    soubory primo v requests\) - cekajici davka nikdy nerotuje ve smycce.
//  - confirm_required: executor presunul soubor do pending\; zde se zobrazi
//    dialog Ano/Ne/Storno se souhrnem (FB_ConfirmSummary) a vysledek klinku
//    se preda FB_ConfirmPending (kanal "gui"). Storno = davka dal ceka.
//  - Po zpracovani requests\ se nabidnou i drive cekajici davky v pending\
//    (bezstavovost W1/B1: potvrzeni funguje i po restartu EA).
//  - rejected\ nove i pro E_RISK_CONFIRM (podvrzene potvrzeni v obsahu).
var self = this;
var cfgs = this.FB_Config();
var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
var cfg = null;
for (var ci = 0; ci < cfgs.length; ci++) {
    if (rid.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) { cfg = cfgs[ci]; break; }
}
if (cfg == null || !cfg.baseDir) {
    return "FB_Config nema baseDir pro repozitar " + this.FB_RepoId(Repository) + " - neni co zpracovat.";
}
var fso = this.FB_ComObj("Scripting.FileSystemObject");
var DIR_REQ = cfg.baseDir + "\\requests";
var DIR_RES = cfg.baseDir + "\\responses";
var DIR_PROC = DIR_REQ + "\\processed";
var DIR_REJ = DIR_REQ + "\\rejected";
var DIR_PEND = DIR_REQ + "\\pending";
function ensureDir(p) { if (!fso.FolderExists(p)) { fso.CreateFolder(p); } }
ensureDir(DIR_REQ); ensureDir(DIR_RES); ensureDir(DIR_PROC); ensureDir(DIR_REJ); ensureDir(DIR_PEND);
function pad2(n) { return (n < 10 ? "0" : "") + n; }
function ts() {
    var d = new Date();
    return "" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate())
        + "-" + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}
function readUtf8(path) {
    var st = self.FB_ComObj("ADODB.Stream");
    st.Type = 2; st.Charset = "utf-8"; st.Open();
    st.LoadFromFile(path);
    var s = st.ReadText(-1);
    st.Close();
    return ("" + s).replace(/^\uFEFF/, "");
}
function writeUtf8(path, text) {
    var st = self.FB_ComObj("ADODB.Stream");
    st.Type = 2; st.Charset = "utf-8"; st.Open();
    st.WriteText(text);
    st.SaveToFile(path, 2);
    st.Close();
}
function responseName(reqName) {
    if (/^req/i.test(reqName)) { return reqName.replace(/^req/i, "res"); }
    return "res-" + reqName;
}
// vypis *.json v dane slozce - bez Enumeratoru (EA runtime ho nema):
// JScript vetev zkusi Enumerator (rychlejsi, pumpa), jinak skryty "dir /b"
// pres WScript.Shell do docasneho souboru (jmena req-*.json jsou ASCII).
// Bere JEN soubory primo ve slozce -> podslozky (pending\, processed\,
// rejected\) se strukturalne preskakuji.
function listJson(dir) {
    try {
        var en = new Enumerator(fso.GetFolder(dir).Files);
        var out = [];
        for (; !en.atEnd(); en.moveNext()) {
            var f0 = en.item();
            if (/\.json$/i.test("" + f0.Name)) { out.push({ name: "" + f0.Name, path: "" + f0.Path }); }
        }
        return out;
    } catch (eEnum) { }
    var sh = self.FB_ComObj("WScript.Shell");
    var tmp = dir + "\\_fb-list.tmp";
    sh.Run('cmd /c dir /b /a-d "' + dir + '\\*.json" > "' + tmp + '"', 0, true);
    var out2 = [];
    if (fso.FileExists(tmp)) {
        var tf = fso.OpenTextFile(tmp, 1, false);
        while (!tf.AtEndOfStream) {
            var ln = ("" + tf.ReadLine()).replace(/^\s+|\s+$/g, "");
            if (/\.json$/i.test(ln)) { out2.push({ name: ln, path: dir + "\\" + ln }); }
        }
        tf.Close();
        fso.DeleteFile(tmp);
    }
    return out2;
}
// dialog Ano/Ne/Storno: EA runtime = Session.Prompt (promptYESNOCANCEL=3,
// Yes=3/No=4/Cancel=2); fallback = WScript.Shell.Popup (vbYesNoCancel=3,
// Yes=6/No=7; timeout 600 s = "later"). Pumpa Session shim vraci 1 -> "later"
// (FB_ProcessFolder se z pumpy stejne nevola).
function askUser(text) {
    try {
        var rr = Session.Prompt(text, 3);
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
// potvrzovaci cyklus nad cekajici davkou (soubor v pending\, res existuje);
// re-klasifikace muze vydat nove confirm_required -> nova nabidka (max 3 kola)
function offerPending(pendPath, respText, names) {
    var nm = "" + fso.GetFileName(pendPath);
    for (var round = 0; round < 3; round++) {
        var r = null;
        try { r = self.FB_JsonParse(respText); } catch (ePr) { r = null; }
        if (r == null || ("" + r.status) != "confirm_required") { return; }
        if (!r.confirm || !r.confirm.nonce) {
            names.push(nm + " (CEKA - potvrzeni neni mozne: " + ((r.confirm && r.confirm.note) || "bez nonce") + ")");
            return;
        }
        var verdict = askUser("CEKA NA POTVRZENI (Risk Gate ELEVATED)\n\n" + self.FB_ConfirmSummary(r)
            + "\n\nAno = provest, Ne = zamitnout (rejected), Storno = nechat cekat v pending\\.");
        if (verdict == "later") { names.push(nm + " (CEKA v pending\\)"); return; }
        var out = "" + self.FB_ConfirmPending(Repository, pendPath, r.confirm.nonce, r.confirm.payloadHash, "gui", (verdict == "yes"));
        writeUtf8(DIR_RES + "\\" + responseName(nm), out);
        if (out.indexOf("\"status\":\"confirm_required\"") >= 0) {
            respText = out; // nove confirm_required (novy nonce) - dalsi kolo
            continue;
        }
        if (out.indexOf("\"code\":\"E_RISK_REJECTED\"") >= 0) { names.push(nm + " (ZAMITNUTO uzivatelem)"); }
        else if (out.indexOf("\"code\":\"E_RISK_INTEGRITY\"") >= 0) { names.push(nm + " (E_RISK_INTEGRITY - payload zmenen)"); }
        else if (out.indexOf("\"status\":\"done\"") >= 0) { names.push(nm + " (POTVRZENO a provedeno)"); }
        else { names.push(nm + " (POTVRZENO, vysledek s chybou - viz response)"); }
        return;
    }
    names.push(nm + " (CEKA v pending\\ - opakovana re-klasifikace)");
}
var done = 0, rej = 0, names = [];
var files = listJson(DIR_REQ);
for (var i = 0; i < files.length; i++) {
    var f = files[i];
    // kontrakt I5: executor dostava CESTU (hash surovych bajtu + parse z
    // jednoho cteni); text uz se zde necte
    var respText = "" + this.FB_Main(Repository, f.path);
    writeUtf8(DIR_RES + "\\" + responseName(f.name), respText);
    // interaktivni rezim: ukaz v Project browseru, co vzniklo (UX)
    try { this.FB_ShowInBrowser(Repository, this.FB_JsonParse(respText)); } catch (eSb) { }
    if (respText.indexOf("\"status\":\"confirm_required\"") >= 0) {
        // executor soubor presunul do pending\ - zadny presun zde; nabidnout dialog
        this.Log(Repository, "FB GUI fallback: " + f.name + " ceka na potvrzeni (pending\\)");
        offerPending(DIR_PEND + "\\" + f.name, respText, names);
        continue;
    }
    // rejected: E_PARSE + E_RISK_BLOCKED + E_RISK_CONFIRM (podvrzene potvrzeni)
    var rejected = (respText.indexOf("\"code\":\"E_PARSE\"") >= 0)
        || (respText.indexOf("\"code\":\"E_RISK_BLOCKED\"") >= 0)
        || (respText.indexOf("\"code\":\"E_RISK_CONFIRM\"") >= 0);
    var stamped = f.name.replace(/\.json$/i, "") + "." + ts() + ".json";
    if (fso.FileExists(f.path)) {
        fso.MoveFile(f.path, (rejected ? DIR_REJ : DIR_PROC) + "\\" + stamped);
    }
    if (rejected) { rej++; } else { done++; }
    names.push(f.name + (rejected ? " (ODMITNUTO)" : ""));
    this.Log(Repository, "FB GUI fallback: " + f.name + (rejected ? " ODMITNUTO" : " zpracovano"));
}
// drive cekajici davky v pending\ (napr. po restartu EA - bezstavovost):
// nabidnout potvrzeni z existujiciho res souboru
var pend = listJson(DIR_PEND);
for (var pi = 0; pi < pend.length; pi++) {
    var resP = DIR_RES + "\\" + responseName(pend[pi].name);
    if (!fso.FileExists(resP)) {
        names.push(pend[pi].name + " (CEKA v pending\\ bez res souboru - nelze potvrdit, vyres rucne)");
        continue;
    }
    offerPending(pend[pi].path, readUtf8(resP), names);
}
if (files.length == 0 && pend.length == 0) {
    return "Slozka " + DIR_REQ + " neobsahuje zadny req-*.json (ani cekajici davku v pending\\).";
}
return "Zpracovano " + done + " davek, odmitnuto " + rej + " (" + names.join(", ") + "). Responses: " + DIR_RES;
