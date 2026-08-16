// AICodeBridge.FB_ProcessFolder(Repository)
// GUI FALLBACK (akceptacni kriterium 4): zpracuje davky z requests\ bez pumpy
// - stejny zivotni cyklus souboru jako pumpa (response do responses\, archiv
// do processed\ / rejected\ s timestampem). Spousti se z menu add-inu
// "Process requests (File Bridge)" - bezi UVNITR EA.exe (zaklad prod strany
// M365-A, iterace 2). Slozku resi FB_Config dle identity repozitare.
// Vraci textovy souhrn pro Session.Output/dialog.
var cfgs = this.FB_Config();
var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
var cfg = null;
for (var ci = 0; ci < cfgs.length; ci++) {
    if (rid.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) { cfg = cfgs[ci]; break; }
}
if (cfg == null || !cfg.baseDir) {
    return "FB_Config nema baseDir pro repozitar " + this.FB_RepoId(Repository) + " - neni co zpracovat.";
}
var fso = new ActiveXObject("Scripting.FileSystemObject");
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
    var st = new ActiveXObject("ADODB.Stream");
    st.Type = 2; st.Charset = "utf-8"; st.Open();
    st.LoadFromFile(path);
    var s = st.ReadText(-1);
    st.Close();
    return s;
}
function writeUtf8(path, text) {
    var st = new ActiveXObject("ADODB.Stream");
    st.Type = 2; st.Charset = "utf-8"; st.Open();
    st.WriteText(text);
    st.SaveToFile(path, 2);
    st.Close();
}
function responseName(reqName) {
    if (/^req/i.test(reqName)) { return reqName.replace(/^req/i, "res"); }
    return "res-" + reqName;
}
var done = 0, rej = 0, names = [];
var en = new Enumerator(fso.GetFolder(DIR_REQ).Files);
var files = [];
for (; !en.atEnd(); en.moveNext()) {
    var f0 = en.item();
    if (/\.json$/i.test("" + f0.Name)) { files.push({ name: "" + f0.Name, path: "" + f0.Path }); }
}
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
