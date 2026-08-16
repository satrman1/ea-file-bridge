// AICodeBridge.FB_OpDeploySrc(Repository, op, reqId)
// deploy_src - VYHRADNE DEV operace (v bance deny ve FB_OpsAllowed!).
// Nahraje kod operaci AICodeBridge ze slozky src\ (FB_Config.srcDir) do modelu
// = nahrada rucniho ITAN-Inject behem vyvoje. CHYBEJICI operace ZALOZI -
// signaturu (poradi parametru) cte z hlavicky souboru:
//   // AICodeBridge.NazevOperace(param1, param2, ...)
// Vysledek nese reloadCode: true -> pumpa v0.4+ po teto davce sama prenacte
// kod z modelu (zadny restart pumpy, zadny klik).
// op.only = volitelne pole nazvu operaci (jinak vsechny soubory ve srcDir)
var cfgs = this.FB_Config();
var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
var cfg = null;
for (var ci = 0; ci < cfgs.length; ci++) {
    if (rid.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) { cfg = cfgs[ci]; break; }
}
if (cfg == null || !cfg.srcDir) {
    return { op: "deploy_src", status: "error", code: "E_ARGS", message: "FB_Config nema srcDir pro repozitar " + this.FB_RepoId(Repository) + "." };
}
var fso = new ActiveXObject("Scripting.FileSystemObject");
if (!fso.FolderExists(cfg.srcDir)) {
    return { op: "deploy_src", status: "error", code: "E_NOT_FOUND", message: "srcDir neexistuje: " + cfg.srcDir };
}
// cilovy element = AICodeBridge (self) - zadny jiny cil neni povoleny
var xmlA = "" + Repository.SQLQuery("SELECT Object_ID FROM t_object WHERE Name = 'AICodeBridge' AND Stereotype = 'JavascriptAddin'");
var mA = /<Object_ID>(\d+)<\/Object_ID>/.exec(xmlA);
if (!mA) { return { op: "deploy_src", status: "error", code: "E_NOT_FOUND", message: "Element AICodeBridge v modelu nenalezen." }; }
var el = Repository.GetElementByID(parseInt(mA[1], 10));
var only = null;
if (op && op.only && Object.prototype.toString.call(op.only) == "[object Array]") {
    only = {};
    for (var oi = 0; oi < op.only.length; oi++) { only["" + op.only[oi]] = 1; }
}
function readUtf8(path) {
    var st = new ActiveXObject("ADODB.Stream");
    st.Type = 2; st.Charset = "utf-8"; st.Open();
    st.LoadFromFile(path);
    var s = st.ReadText(-1);
    st.Close();
    return s;
}
// mapa existujicich operaci
var have = {};
for (var i = 0; i < el.Methods.Count; i++) { have["" + el.Methods.GetAt(i).Name] = el.Methods.GetAt(i); }
var updated = [], createdOps = [], skipped = [], warns = [];
var en = new Enumerator(fso.GetFolder(cfg.srcDir).Files);
for (; !en.atEnd(); en.moveNext()) {
    var f = en.item();
    var fm = /^AICodeBridge\.([A-Za-z0-9_]+)\.js$/.exec("" + f.Name);
    if (!fm) { continue; }
    var opName = fm[1];
    if (only != null && only[opName] != 1) { skipped.push(opName); continue; }
    var code = readUtf8("" + f.Path);
    var meth = have[opName];
    if (!meth) {
        // zalozit operaci; signatura z hlavicky "// AICodeBridge.Nazev(a, b)"
        var params = [];
        var hm = new RegExp("AICodeBridge\\." + opName + "\\s*\\(([^)]*)\\)").exec(code.substring(0, 500));
        if (hm && hm[1].replace(/\s/g, "") != "") {
            var raw = hm[1].split(",");
            for (var pj = 0; pj < raw.length; pj++) { params.push(raw[pj].replace(/^\s+|\s+$/g, "")); }
        } else {
            warns.push(opName + ": hlavicka se signaturou nenalezena - operace zalozena BEZ parametru (zkontroluj!)");
        }
        meth = el.Methods.AddNew(opName, "String");
        meth.Update();
        for (var pk = 0; pk < params.length; pk++) {
            var par = meth.Parameters.AddNew(params[pk], "String");
            par.Position = pk;
            par.Update();
        }
        meth.Parameters.Refresh();
        createdOps.push(opName);
    }
    meth.Code = code;
    if (!meth.Update()) { warns.push(opName + ": Update selhal: " + meth.GetLastError()); continue; }
    updated.push(opName);
}
el.Methods.Refresh();
var res = { op: "deploy_src", status: "ok", updated: updated, created: createdOps,
    count: updated.length, reloadCode: true };
if (skipped.length > 0) { res.skipped = skipped; }
if (warns.length > 0) { res.warnings = warns; }
return res;
