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
function ensureDir(p) { if (!fso.FolderExists(p)) { fso.CreateFolder(p); } }
ensureDir(DIR_REQ); ensureDir(DIR_RES); ensureDir(DIR_PROC); ensureDir(DIR_REJ);
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
    return s;
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
// vypis *.json v requests\ - bez Enumeratoru (EA runtime ho nema):
// JScript vetev zkusi Enumerator (rychlejsi, pumpa), jinak skryty "dir /b"
// pres WScript.Shell do docasneho souboru (jmena req-*.json jsou ASCII).
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
var done = 0, rej = 0, names = [];
var files = listJson(DIR_REQ);
for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var text = readUtf8(f.path);
    var respText = "" + this.FB_Main(Repository, text);
    var rejected = (respText.indexOf("\"code\":\"E_PARSE\"") >= 0);
    writeUtf8(DIR_RES + "\\" + responseName(f.name), respText);
    var stamped = f.name.replace(/\.json$/i, "") + "." + ts() + ".json";
    fso.MoveFile(f.path, (rejected ? DIR_REJ : DIR_PROC) + "\\" + stamped);
    if (rejected) { rej++; } else { done++; }
    names.push(f.name + (rejected ? " (ODMITNUTO)" : ""));
    this.Log(Repository, "FB GUI fallback: " + f.name + (rejected ? " ODMITNUTO" : " zpracovano"));
}
if (files.length == 0) {
    return "Slozka " + DIR_REQ + " neobsahuje zadny req-*.json.";
}
return "Zpracovano " + done + " davek, odmitnuto " + rej + " (" + names.join(", ") + "). Responses: " + DIR_RES;
