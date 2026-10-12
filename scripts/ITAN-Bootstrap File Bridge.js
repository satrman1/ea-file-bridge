// ============================================================================
// ITAN-Bootstrap File Bridge (JScript pro EA Scripting)
// Zaklada executor EA File Bridge v repozitari, kde jeste NENI (typicky bankovni repozitar):
//   1. v OZNACENEM package v Project Browseru zalozi element AICodeBridge
//      (Class se stereotypem JavascriptAddin), pokud v modelu neexistuje
//   2. dovytvori chybejici operace vc. parametru (viz SIG nize)
//   3. naleje kod ze src\ do VSECH operaci, ktere maji soubor (od Z260904-6
//      uplny disk->model refresh; drive jen SIG)
// Idempotentni: co existuje, jen dostane kod; chybejici operace se zaklada
// s parametry z hlavicky souboru (fallback SIG).
//   4. (od 2026-09-09, nalez N-K8-1 ziveho K8 QEAX) RECEPTIONS: EA_* handlery
//      se zakladaji / opravuji jako RECEPTION na LOKALNI Signal tehoz jmena
//      (StyleEx 'Reception=1;SignalGUID={...};', lookup podle JMENA v cilovem
//      modelu = stejna logika jako deploy_src). Add-in preneseny Copy/Paste
//      nese CIZI SignalGUID -> EA ho nenacte (Manage Add-Ins pada na Disabled,
//      menu mlci) - v bance je deploy_src deny, proto to dela bootstrap.
//      Signal, ktery v modelu neni -> handler se preskoci (vypis).
//   5. (od 2026-09-10, nalez zive v bance) PARAMETRY receptions EA_* se
//      kontroluji proti EA_ARGS (Sparx broadcast signatury) a pri neshode
//      se prestavi - EA preda argumenty POZICNE, chybejici parametr posune
//      vsechny dalsi (EA_MenuClick bez MenuName -> ItemName = nazev podmenu,
//      Output "Unhandled menu item: -AI Bridge"). Idempotentni jako vse ostatni.
//   6. (od 2026-10-10, nalez FB-PU-01 revize usability pumpy, zive doma)
//      PARAMETRY KAZDE existujici operace se srovnaji podle hlavicky souboru
//      "// AICodeBridge.Nazev(a, b)" - stejna logika jako deploy_src (v0.10).
//      Do te doby bootstrap u existujici operace prepsal jen kod: pumpa i EA
//      runtime skladaji funkci z parametru v MODELU, takze FB_RiskNote(risk)
//      z v0.14 bezela s novym telem bez parametru baseline a kazdy zapis
//      spadl "Objekt baseline neni definovan" AZ PO provedeni (prvky
//      v modelu, audit chybi, davka v rejected\). Radek "PX <operace>:
//      (stare) -> (nove)" + pocet v souhrnu. Po nasazeni VZDY kontrolni
//      dotaz (docs\NAVOD-NASAZENI-KLIKACI.md, Kontrola parametru po nasazeni).
//   7. (od 2026-10-10, nalez N-B-4 z banky) vice elementu jmenem AICodeBridge
//      v modelu -> vypis vsech (ElementID, stereotyp, package) jako VAROVANI;
//      bere se ten se stereotypem JavascriptAddin. Dva se stereotypem = STOP
//      (nelze rozhodnout, kam nalevat kod) - uklid rucne, pak znovu.
//   8. (od 2026-10-12, FB-PU-02, pumpa v0.6 / Z261004b-5) OTISK NASAZENEHO
//      KODU: sha256 nad ne-konfiguracnimi soubory src\ (algoritmus
//      src\AICodeBridge.FB_CodeFingerprint.js - skript ho zkompiluje ze
//      souboru spolu s FB_Sha256, aby byl otisk stejny jako z deploy_src)
//      se zapise jako tagged values prvku AICodeBridge: fb.code.fingerprint,
//      fb.code.files, fb.code.deployedAt, fb.code.deployedBy = bootstrap.
//      Cte ho ping, About AI Bridge a hlaseni startu session (FB_CodeInfo);
//      spravce porovna s tools\code-fingerprint.py nad pracovni kopii.
//
// PRED SPUSTENIM:
//   - v Project Browseru OZNAC package, kam ma element patrit (jen pri
//     prvnim zalozeni; kdyz uz element existuje, vyber se ignoruje)
//   - SRC_DIR se resi samo: zkusi obvykle cesty, jinak se zepta dialogem
//     (zadava se cesta ke slozce src\ klonu) - soubor neni treba editovat
// Spusteni: Specialize > Scripting > novy JScript > vlozit > Run.
// PO DOBEHNUTI: spustit/restartovat pumpu (kod se cte pri attachi).
// ============================================================================

// Kandidati na slozku src\ klonu (v poradi); kdyz zadny neexistuje,
// skript se zepta dialogem. Diky tomu se soubor needituje -> zadny diff
// pri kazdem pullu v bance.
var SRC_CANDIDATES = [
    "C:\\GIT\\ea-file-bridge\\src\\",
    "D:\\GIT\\ea-file-bridge\\src\\"
];
var ADDIN_NAME = "AICodeBridge";

function resolveSrcDir(fso) {
    for (var i = 0; i < SRC_CANDIDATES.length; i++) {
        if (fso.FolderExists(SRC_CANDIDATES[i])) { return SRC_CANDIDATES[i]; }
    }
    var p = "" + Session.Input("Slozka src klonu nenalezena na obvyklych cestach. Zadej plnou cestu ke slozce src (napr. C:\\GIT\\ea-file-bridge\\src):");
    p = p.replace(/^\s+|\s+$/g, "");
    if (p != "" && p.charAt(p.length - 1) != "\\") { p = p + "\\"; }
    return p;
}

// Operace + poradi parametru (loader pumpy se ridi Position!)
// v0.2 (iterace 1+3): pribyly operace zrcadlici MCP tooly + helpery + konfigy.
var SIG = [
    { n: "FB_Main",                  p: ["Repository", "requestText"] },
    { n: "FB_JsonParse",             p: ["text"] },
    { n: "FB_JsonStringify",         p: ["v"] },
    { n: "FB_XmlRows",               p: ["xml"] },
    { n: "FB_RepoId",                p: ["Repository"] },
    { n: "FB_OpPing",                p: ["Repository", "op"] },
    { n: "FB_OpQuery",               p: ["Repository", "op"] },
    { n: "FB_OpCreateElement",       p: ["Repository", "op", "reqId"] },
    { n: "FB_Whitelist",             p: [] },
    { n: "FB_OpsAllowed",            p: [] },
    { n: "FB_Config",                p: [] },
    { n: "FB_Audit",                 p: ["Repository", "reqId", "summary", "requestText"] },
    { n: "FB_SessionStart",          p: ["Repository"] },
    { n: "FB_ResolvePkg",            p: ["Repository", "ref"] },
    { n: "FB_ResolveEl",             p: ["Repository", "ref"] },
    { n: "FB_CheckWrite",            p: ["Repository", "pkg"] },
    { n: "FB_TagWrite",              p: ["Repository", "obj", "tvs"] },
    { n: "FB_TagRead",               p: ["Repository", "obj"] },
    { n: "FB_OpElements",            p: ["Repository", "op", "reqId"] },
    { n: "FB_OpPackage",             p: ["Repository", "op", "reqId"] },
    { n: "FB_OpConnectors",          p: ["Repository", "op", "reqId"] },
    { n: "FB_OpAttributes",          p: ["Repository", "op", "reqId"] },
    { n: "FB_OpOperations",          p: ["Repository", "op", "reqId"] },
    { n: "FB_OpMessages",            p: ["Repository", "op", "reqId"] },
    { n: "FB_OpGetElements",         p: ["Repository", "op"] },
    { n: "FB_OpGetPackages",         p: ["Repository", "op"] },
    { n: "FB_OpGetConnectors",       p: ["Repository", "op"] },
    { n: "FB_OpGetDiagrams",         p: ["Repository", "op"] },
    { n: "FB_OpFindElements",        p: ["Repository", "op"] },
    { n: "FB_OpFindPackages",        p: ["Repository", "op"] },
    { n: "FB_OpDelete",              p: ["Repository", "op", "reqId"] },
    { n: "FB_OpDeleteTag",           p: ["Repository", "op", "reqId"] },
    { n: "FB_OpRemoveFromDiagram",   p: ["Repository", "op", "reqId"] },
    { n: "FB_OpBaselineCreate",      p: ["Repository", "op", "reqId"] },
    { n: "FB_OpBaselineList",        p: ["Repository", "op"] },
    { n: "FB_OpBaselineDiff",        p: ["Repository", "op"] },
    { n: "FB_OpClonePackage",        p: ["Repository", "op", "reqId"] },
    { n: "FB_OpCloneElements",       p: ["Repository", "op", "reqId"] },
    { n: "FB_OpLinkedDocExport",     p: ["Repository", "op"] },
    { n: "FB_OpLinkedDocImport",     p: ["Repository", "op", "reqId"] },
    { n: "FB_OpLayoutConnectors",    p: ["Repository", "op", "reqId"] },
    { n: "FB_OpConnectorVisibility", p: ["Repository", "op", "reqId"] },
    { n: "FB_OpOpenDiagrams",        p: ["Repository", "op"] },
    { n: "FB_OpReloadDiagrams",      p: ["Repository", "op"] },
    { n: "FB_OpUpdateDiagramProps",  p: ["Repository", "op", "reqId"] },
    { n: "FB_OpDiagramObjectStyle",  p: ["Repository", "op", "reqId"] },
    { n: "FB_OpDeploySrc",           p: ["Repository", "op", "reqId"] },
    { n: "FB_ProcessFolder",         p: ["Repository"] },
    { n: "B64Decode",                p: ["s"] },
    { n: "B64Encode",                p: ["s"] },
    { n: "GetTag",                   p: ["el", "tagName", "defaultValue"] },
    { n: "SetTag",                   p: ["el", "tagName", "value"] },
    { n: "Log",                      p: ["Repository", "msg"] },
    // Legacy AI Code Bridge (#AI-CODE inbox) + GUI cast - v eaexample UZ EXISTUJI
    // (jen refresh kodu). POZOR pro banku: EA_ handlery maji byt RECEPTIONS
    // (vznikaji klonem vzoru, ne bootstrapem) - bootstrap je zalozi jako bezne
    // operace, coz pumpe nevadi, ale GUI menu v EA se tim nenapoji.
    { n: "FindTargetMethod",         p: ["Repository", "targetGuid", "opName"] },
    { n: "ProcessRequests",          p: ["Repository"] },
    { n: "DeployRequest",            p: ["Repository", "req"] },
    { n: "ExportRequest",            p: ["Repository", "req"] }
];

function readUtf8(path) {
    var st = new ActiveXObject("ADODB.Stream");
    st.Type = 2; st.Charset = "utf-8"; st.Open();
    st.LoadFromFile(path);
    var s = st.ReadText(-1);
    st.Close();
    return s;
}

function xmlField(row, name) {
    var m = new RegExp("<" + name + ">([^<]*)</" + name + ">", "i").exec(row);
    return m ? m[1] : "";
}
// bod 7 hlavicky (N-B-4): vsechny elementy jmenem AICodeBridge, ne jen prvni
// se stereotypem. Vraci { el, stop } - stop = true znamena STOP celeho behu.
function findAddin() {
    var xml = "" + Repository.SQLQuery(
        "SELECT o.ea_guid, o.Object_ID, o.Stereotype, p.Name AS PkgName FROM t_object o"
        + " LEFT JOIN t_package p ON p.Package_ID = o.Package_ID"
        + " WHERE o.Name = '" + ADDIN_NAME + "'");
    var rows = [], re = /<Row>([\s\S]*?)<\/Row>/gi, rm;
    while ((rm = re.exec(xml)) != null) {
        rows.push({ guid: xmlField(rm[1], "ea_guid"), id: xmlField(rm[1], "Object_ID"),
            stereo: xmlField(rm[1], "Stereotype"), pkg: xmlField(rm[1], "PkgName") });
    }
    var cands = [];
    for (var ri = 0; ri < rows.length; ri++) { if (rows[ri].stereo == "JavascriptAddin") { cands.push(rows[ri]); } }
    if (rows.length > 1) {
        Session.Output("VAROVANI: v modelu je " + rows.length + " elementu jmenem " + ADDIN_NAME + " (N-B-4) - kod dostane JEN ten se stereotypem JavascriptAddin:");
        for (var rj = 0; rj < rows.length; rj++) {
            Session.Output("  - ElementID " + rows[rj].id + ", stereotyp '" + rows[rj].stereo + "', package '" + rows[rj].pkg + "'"
                + (rows[rj].stereo == "JavascriptAddin" ? "  <- CIL" : "  (ignorovan; kandidat na uklid)"));
        }
    }
    if (cands.length > 1) {
        Session.Output("STOP: " + cands.length + " elementy " + ADDIN_NAME + " se stereotypem JavascriptAddin - nelze rozhodnout, kam nalevat kod. Nic nezmeneno. Odstran/prejmenuj nadbytecny element a spust znovu.");
        return { el: null, stop: true };
    }
    if (cands.length == 0) { return { el: null, stop: false }; }
    return { el: Repository.GetElementByGuid(cands[0].guid), stop: false };
}

function main() {
    Repository.EnsureOutputVisible("Script");
    Session.Output("=== ITAN-Bootstrap File Bridge ===");

    var fso = new ActiveXObject("Scripting.FileSystemObject");
    var SRC_DIR = resolveSrcDir(fso);
    if (SRC_DIR == "" || !fso.FolderExists(SRC_DIR)) {
        Session.Output("CHYBA: slozka src nenalezena: " + SRC_DIR + " - spust znovu a zadej platnou cestu.");
        return;
    }
    Session.Output("Slozka src: " + SRC_DIR);

    // 1) element
    var found = findAddin();
    if (found.stop) { return; }
    var el = found.el;
    if (el == null) {
        var pkg = Repository.GetTreeSelectedPackage();
        if (pkg == null) {
            Session.Output("CHYBA: element neexistuje a v Project Browseru neni oznacen zadny package. Oznac cilovy package a spust znovu.");
            return;
        }
        el = pkg.Elements.AddNew(ADDIN_NAME, "Class");
        el.StereotypeEx = "Model Add-Ins::JavascriptAddin";
        el.Notes = "EA File Bridge - executor (kanon kodu, cte ho pumpa). Zalozen bootstrapem "
            + "ITAN-Bootstrap File Bridge.js. Protokol: docs/PROTOKOL-EAFB.md v repu ea-file-bridge. AI-Created: true.";
        el.Update();
        pkg.Elements.Refresh();
        Session.Output("Element " + ADDIN_NAME + " ZALOZEN v package '" + pkg.Name + "' (elementID " + el.ElementID + ").");
    } else {
        Session.Output("Element " + ADDIN_NAME + " uz existuje (elementID " + el.ElementID + ") - jen doplnim operace/kod.");
    }

    // 2) mapa existujicich operaci
    var have = {};
    for (var i = 0; i < el.Methods.Count; i++) {
        have["" + el.Methods.GetAt(i).Name] = el.Methods.GetAt(i);
    }

    // 3) VSECHNY soubory src\AICodeBridge.*.js (Z260904-6, K8): kod se nalije
    //    do KAZDE operace, ktera ma soubor - tim je bootstrap uplny disk->model
    //    refresh (drive jen SIG = 57 operaci; konfiguracni FB_AccessGroups /
    //    FB_RiskPolicy / FB_QcConfig by po prenosu add-inu zustaly s cizimi
    //    hodnotami a deploy_src by pak nesel spustit - slepice-vejce).
    //    Chybejici operace se zaklada s parametry z hlavicky souboru
    //    "// AICodeBridge.Nazev(a, b)" (fallback = SIG). EA_* handlery =
    //    RECEPTIONS na lokalni Signal (viz hlavicka bod 4): chybejici se
    //    zalozi jen kdyz Signal existuje, existujici dostanou kod + oprava
    //    cizi SignalGUID.
    var sigMap = {};
    for (var sj = 0; sj < SIG.length; sj++) { sigMap[SIG[sj].n] = SIG[sj].p; }
    var created = 0, coded = 0, skippedEa = "", recFixed = 0, recNew = 0, parFixed = 0, parSynced = 0;
    // signatury EA_ handleru bez zavorek v hlavicce (stejne jako harness KNOWN_ARGS)
    var EA_ARGS = {
        EA_Connect: ["Repository"],
        EA_Disconnect: [],
        EA_GetMenuItems: ["Repository", "MenuLocation", "MenuName"],
        EA_MenuClick: ["Repository", "MenuLocation", "MenuName", "ItemName"],
        EA_GetMenuState: ["Repository", "MenuLocation", "MenuName", "ItemName", "IsEnabled", "IsChecked"],
        EA_OnOutputItemDoubleClicked: ["Repository", "TabName", "LineText", "ID"],
        EA_OnOutputItemClicked: ["Repository", "TabName", "LineText", "ID"]
    };
    // bod 5 hlavicky: parametry reception = presne EA_ARGS (jmeno + poradi)
    function syncEaParams(meth, opName) {
        var wantP = EA_ARGS[opName];
        if (!wantP) { return false; }
        var haveP = [];
        for (var hp = 0; hp < meth.Parameters.Count; hp++) { haveP.push("" + meth.Parameters.GetAt(hp).Name); }
        if (haveP.join(",") == wantP.join(",")) { return false; }
        for (var dp = meth.Parameters.Count - 1; dp >= 0; dp--) { meth.Parameters.DeleteAt(dp, false); }
        meth.Parameters.Refresh();
        for (var np = 0; np < wantP.length; np++) {
            var par2 = meth.Parameters.AddNew(wantP[np], "String");
            par2.Position = np;
            par2.Update();
        }
        meth.Parameters.Refresh();
        Session.Output("PX  " + opName + " -> parametry reception opraveny: (" + haveP.join(", ") + ") -> (" + wantP.join(", ") + ")");
        return true;
    }
    // bod 6 hlavicky (FB-PU-01): parametry z hlavicky souboru; null = hlavicka
    // bez zavorek (EA_ lifecycle handlery) - signatura se NEsaha (ridi EA_ARGS)
    function headerParams(opName, code) {
        var hm = new RegExp("AICodeBridge\\." + opName + "\\s*\\(([^)]*)\\)").exec(code.replace(/^\uFEFF/, "").substring(0, 500));
        if (!hm) { return null; }
        var out = [];
        if (hm[1].replace(/\s/g, "") != "") {
            var raw = hm[1].split(",");
            for (var pj = 0; pj < raw.length; pj++) { out.push(raw[pj].replace(/^\s+|\s+$/g, "")); }
        }
        return out;
    }
    // bod 6: srovnani parametru EXISTUJICI operace podle hlavicky (logika
    // deploy_src, src\AICodeBridge.FB_OpDeploySrc.js) - jmeno + poradi
    function syncParams(meth, opName, code) {
        var wantP = headerParams(opName, code);
        if (wantP == null) { return false; }
        var haveP = [];
        for (var hp = 0; hp < meth.Parameters.Count; hp++) { haveP.push("" + meth.Parameters.GetAt(hp).Name); }
        if (haveP.join(",") == wantP.join(",")) { return false; }
        for (var dp = meth.Parameters.Count - 1; dp >= 0; dp--) { meth.Parameters.DeleteAt(dp, false); }
        meth.Parameters.Refresh();
        for (var np = 0; np < wantP.length; np++) {
            var par3 = meth.Parameters.AddNew(wantP[np], "String");
            par3.Position = np;
            par3.Update();
        }
        meth.Parameters.Refresh();
        Session.Output("PX  " + opName + ": (" + haveP.join(", ") + ") -> (" + wantP.join(", ") + ")");
        return true;
    }
    function signalGuidFor(opName) {
        var sx = "" + Repository.SQLQuery("SELECT ea_guid FROM t_object WHERE Object_Type = 'Signal' AND Name = '" + opName.replace(/'/g, "''") + "'");
        var sm = /<ea_guid>([^<]+)<\/ea_guid>/i.exec(sx);
        return sm ? sm[1] : "";
    }
    var folder = fso.GetFolder(SRC_DIR);
    var files = new Enumerator(folder.Files);
    var names = [];
    var fpFiles = []; // bod 8: otisk nasazeneho kodu
    for (; !files.atEnd(); files.moveNext()) {
        var fn = "" + files.item().Name;
        var mm = new RegExp("^" + ADDIN_NAME + "\\.([A-Za-z0-9_]+)\\.js$").exec(fn);
        if (mm) { names.push(mm[1]); }
    }
    names.sort();
    for (var j = 0; j < names.length; j++) {
        var name = names[j];
        var path = SRC_DIR + ADDIN_NAME + "." + name + ".js";
        var code = readUtf8(path);
        fpFiles.push({ name: name, text: code });
        var m = have[name];
        var isEa = (name.indexOf("EA_") == 0);
        var sg = isEa ? signalGuidFor(name) : "";
        if (!m) {
            if (isEa && sg == "") {
                skippedEa = skippedEa + name + " ";
                Session.Output("--  " + name + " (Signal tehoz jmena v modelu neni - reception nelze zalozit; zkontroluj Broadcast Types)");
                continue;
            }
            var params = (isEa ? EA_ARGS[name] : sigMap[name]) || null;
            var hm = /^\/\/\s*AICodeBridge\.([A-Za-z0-9_]+)\s*\(([^)]*)\)/.exec(code.replace(/^\uFEFF/, ""));
            if (hm && hm[1] == name) {
                params = [];
                var raw = hm[2].split(",");
                for (var ri = 0; ri < raw.length; ri++) {
                    var pn = raw[ri].replace(/^\s+|\s+$/g, "");
                    if (pn != "") { params.push(pn); }
                }
            }
            if (params == null) { params = ["Repository"]; }
            m = el.Methods.AddNew(name, "String");
            m.Update();
            for (var k = 0; k < params.length; k++) {
                var par = m.Parameters.AddNew(params[k], "String");
                par.Position = k;
                par.Update();
            }
            m.Parameters.Refresh();
            have[name] = m;
            created++;
            if (isEa) { m.StyleEx = "Reception=1;SignalGUID=" + sg + ";"; recNew++; }
        } else if (isEa) {
            // receptions: parametry podle EA_ARGS (bod 5), i kdyz Signal v modelu neni
            if (syncEaParams(m, name)) { parFixed++; }
            if (sg != "") {
                var haveStyle = "" + m.StyleEx;
                if (haveStyle.toUpperCase().indexOf(("SignalGUID=" + sg + ";").toUpperCase()) < 0) {
                    m.StyleEx = "Reception=1;SignalGUID=" + sg + ";";
                    recFixed++;
                    Session.Output("RX  " + name + " -> reception prepnuta na lokalni Signal " + sg + (haveStyle.indexOf("Reception=1") < 0 ? " (doplneno)" : " (byl cizi GUID - preneseny add-in)"));
                }
            }
        } else {
            // bod 6 (FB-PU-01): KAZDA existujici operace dostane parametry podle hlavicky
            if (syncParams(m, name, code)) { parSynced++; }
        }
        m.Code = code;
        m.Update();
        coded++;
        Session.Output("OK  " + name + " (" + code.length + " znaku)");
    }
    el.Methods.Refresh();

    // bod 8 (FB-PU-02): otisk nasazeneho kodu -> tagged values fb.code.* na prvku
    // AICodeBridge; FB_Sha256 + FB_CodeFingerprint se zkompiluji ze souboru
    // src\ (stejny kod, ktery se prave nalil do modelu)
    try {
        var fpLib = {};
        var shaCode = readUtf8(SRC_DIR + ADDIN_NAME + ".FB_Sha256.js").replace(/^\uFEFF/, "");
        var fpCode = readUtf8(SRC_DIR + ADDIN_NAME + ".FB_CodeFingerprint.js").replace(/^\uFEFF/, "");
        fpLib.FB_Sha256 = new Function("input", shaCode);
        fpLib.FB_CodeFingerprint = new Function("files", fpCode);
        var fp = fpLib.FB_CodeFingerprint(fpFiles);
        var dN = new Date();
        var p2 = function (x) { return (x < 10 ? "0" : "") + x; };
        var fpAt = dN.getFullYear() + "-" + p2(dN.getMonth() + 1) + "-" + p2(dN.getDate()) + " " + p2(dN.getHours()) + ":" + p2(dN.getMinutes()) + ":" + p2(dN.getSeconds());
        var setTag = function (tagName, value) {
            for (var ti = 0; ti < el.TaggedValues.Count; ti++) {
                var tv = el.TaggedValues.GetAt(ti);
                if (("" + tv.Name) == tagName) { tv.Value = value; tv.Update(); el.TaggedValues.Refresh(); return; }
            }
            var ntv = el.TaggedValues.AddNew(tagName, value);
            ntv.Update();
            el.TaggedValues.Refresh();
        };
        setTag("fb.code.fingerprint", fp.fingerprint);
        setTag("fb.code.files", "" + fp.files);
        setTag("fb.code.deployedAt", fpAt);
        setTag("fb.code.deployedBy", "bootstrap");
        Session.Output("Otisk kodu v modelu: " + fp.short + " (" + fp.files + " souboru bez konfigurace, sha256 " + fp.fingerprint + ") - tagged values fb.code.* na prvku " + ADDIN_NAME + "; totez vraci ping a About AI Bridge.");
    } catch (eFp) { Session.Output("POZOR: otisk kodu (fb.code.*) se nepodarilo zapsat: " + eFp.message); }

    Session.Output("Hotovo: " + created + " operaci zalozeno, " + coded + " nahran kod (souboru v src: " + names.length + ")."
        + " Parametry: " + parSynced + " operaci srovnano podle hlavicky (radky PX)."
        + " Receptions: " + recNew + " zalozeno, " + recFixed + " prepnuto na lokalni Signal, " + parFixed + " parametry opraveny."
        + (skippedEa != "" ? " BEZ RECEPTION (Signal chybi): " + skippedEa : ""));
    if (parSynced > 0) {
        Session.Output("POZOR: " + parSynced + " operaci melo v modelu jiny seznam parametru nez hlavicka souboru (radky PX vyse) - bez tohoto srovnani by EA runtime i pumpa volaly nove telo se starymi parametry (FB-PU-01). Po restartu spust kontrolni dotaz parametru (NAVOD-NASAZENI-KLIKACI.md).");
    }
    Session.Output("DALSI KROKY: 1) zkontroluj configy v src (FB_WriteScope/FB_Config/FB_OpsAllowed/FB_RiskPolicy/FB_AccessGroups: repo + GUID) a pripadne spust znovu,");
    Session.Output("2) PLNY restart EA (kod EA runtime) a spust/restartuj pumpu (pump.wsf) - kod se cte pri pripojeni.");
}

main();
