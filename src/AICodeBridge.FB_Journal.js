// AICodeBridge.FB_Journal(Repository, req, reqId, cfg, token, baseline)
// BASELINE POLITIKA - MINIMALNI JOURNAL (zadani v1.2 par. 4.9, dispozice 1):
// PRE-IMAGE resolvovanych cilu davky - a v nich POUZE tech poli, ktera davka
// prepise - zapsany jako restore manifest <baseDir>\journal\<reqId>.json.
// Vola FB_Main na temze miste jako lazy baseline (po potvrzeni, tesne pred
// prvni zapisovou operaci) a JEN pro davky pod prahem (radek 2 par. 4.4 -
// tedy vedle mikro-baseline, ne misto ni).
// Vraci { targets, covered[], uncovered[], manifestRef, why }.
//
// CO KRYJE (update vetve s cilem adresovanym guid/ID):
//   create_or_update_elements    pole elementu + hodnoty menenych tagu
//   create_or_update_package     Name, Notes, Author, Version
//   create_or_update_attributes  pole existujiciho atributu (dle ID/guid/jmena)
//   create_or_update_operations  pole existujici operace + seznam parametru,
//                                kdyz davka posila parameters (rebuild)
// CO NEKRYJE (vypisuje do uncovered, nikdy mlcky):
//   - diagramy, konektory, zpravy, scenare, constraints, requirements,
//     linked documents, presuny, klony, mazani (kaskadove ucinky pre-image
//     cilu z definice nezachyti - tam drzi baseline / par. 12a beze zmeny);
//   - cile pres $N, match/dedup (identita znama az za behu);
//   - davky NAD prahem - rozsireni je samostatna iterace, proto se radek 3
//     par. 4.4 NESTAVI a journal zadne rozhodnuti o zaloze nemeni;
//   - vic nez MAX_TARGETS cilu.
// NEOBNOVUJE SAM: obnova je ukon cloveka podle manifestu (nebo opravnou
// davkou s hodnotami z `fields`); automaticky rollback neni predmetem zadani.
// OMEZENI: baseDir je PER UZIVATEL - manifest neni sdileny; odkaz na nej
// nese sekce baseline{} v res souboru a Notes auditu v #AI-LOG.
// Best-effort: selhani journalu nikdy neshodi davku (cil = nekryt).
var self = this;
var MAX_TARGETS = 200;
var out = { targets: 0, covered: [], uncovered: [], manifestRef: "", why: "" };
var items = [];
function isArr(v) { return Object.prototype.toString.call(v) == "[object Array]"; }
function has(o, k) { return typeof o[k] != "undefined"; }
function unc(what) { if (out.uncovered.length < 50) { out.uncovered.push(what); } }
function rd(obj, prop) { try { var v = obj[prop]; return (v === null || typeof v == "undefined") ? null : ((typeof v == "boolean" || typeof v == "number") ? v : ("" + v)); } catch (eR) { return null; } }
function pick(src, obj, map) {
    var f = {}, n = 0;
    for (var k in map) {
        if (has(src, k)) { f[map[k]] = rd(obj, map[k]); n++; }
    }
    return n > 0 ? f : null;
}
function tagsOf(coll, wanted) {
    if (!isArr(wanted) || wanted.length == 0) { return null; }
    var t = {};
    for (var w = 0; w < wanted.length; w++) {
        var nm = "" + ((wanted[w] || {}).name || "");
        if (nm == "") { continue; }
        t[nm] = null; // null = tag pred davkou neexistoval
        try {
            for (var c = 0; c < coll.Count; c++) {
                var tv = coll.GetAt(c);
                if (("" + tv.Name) == nm) { t[nm] = "" + tv.Value; break; }
            }
        } catch (eT) { }
    }
    return t;
}
var EL_MAP = { name: "Name", alias: "Alias", stereotypes: "StereotypeEx", notes: "Notes", description: "Notes", notes_b64: "Notes",
               multiplicity: "Multiplicity", status: "Status", author: "Author", version: "Version", type: "Type",
               classifierID: "ClassifierID", classifier: "ClassifierID", isComposite: "IsComposite" };
var AT_MAP = { name: "Name", type: "Type", classifierID: "ClassifierID", classifier: "ClassifierID", notes: "Notes", description: "Notes",
               stereotype: "StereotypeEx", "default": "Default", position: "Pos", lowerBound: "LowerBound", upperBound: "UpperBound" };
var OP_MAP = { name: "Name", returnType: "ReturnType", returnClassifierID: "ClassifierID", returnClassifier: "ClassifierID",
               notes: "Notes", description: "Notes", stereotype: "StereotypeEx", isStatic: "IsStatic", isAbstract: "Abstract" };
function pad2(x) { return (x < 10 ? "0" : "") + x; } // na urovni funkce - deklarace v bloku neni ES3
function full() { if (items.length >= MAX_TARGETS) { return true; } return false; }
function isDollar(v) { return /^\$\d+/.test("" + v); }
function resolveEl(ref) { try { return self.FB_ResolveEl(Repository, ref); } catch (eE) { return null; } }

try {
    for (var i = 0; i < req.ops.length; i++) {
        var o = req.ops[i] || {};
        var name = "" + (o.op || "?");
        var j, lst;
        if (name == "create_or_update_elements") {
            lst = o.elements || [];
            for (j = 0; j < lst.length; j++) {
                var e = lst[j] || {};
                var ref = e.guid || e.elementID;
                if (!ref) { if (e.matchByName || e.dedupKey) { unc(name + "[" + i + "].elements[" + j + "]: match/dedup - cil znam az za behu"); } continue; }
                if (isDollar(ref)) { unc(name + "[" + i + "].elements[" + j + "]: $N reference"); continue; }
                if (full()) { unc(name + "[" + i + "].elements[" + j + "]: strop " + MAX_TARGETS + " cilu"); continue; }
                var el = resolveEl(ref);
                if (el == null) { unc(name + "[" + i + "].elements[" + j + "]: element nenalezen"); continue; }
                var it = { kind: "element", guid: "" + el.ElementGUID, id: el.ElementID, name: "" + el.Name, fields: pick(e, el, EL_MAP) || {} };
                var tg = tagsOf(el.TaggedValues, e.taggedValues);
                if (tg) { it.tags = tg; }
                items.push(it); out.covered.push(it.guid);
            }
        } else if (name == "create_or_update_package") {
            lst = isArr(o.packages) ? o.packages : [o];
            for (j = 0; j < lst.length; j++) {
                var p = lst[j] || {};
                var pref = p.guid || p.packageID;
                if (!pref) { if (p.matchByName) { unc(name + "[" + i + "].packages[" + j + "]: matchByName - cil znam az za behu"); } continue; }
                if (isDollar(pref)) { unc(name + "[" + i + "].packages[" + j + "]: $N reference"); continue; }
                if (full()) { unc(name + "[" + i + "].packages[" + j + "]: strop " + MAX_TARGETS + " cilu"); continue; }
                var pk = null;
                try { pk = self.FB_ResolvePkg(Repository, pref); } catch (ePk) { pk = null; }
                if (pk == null) { unc(name + "[" + i + "].packages[" + j + "]: package nenalezen"); continue; }
                var pf = {};
                if (has(p, "name")) { pf.Name = rd(pk, "Name"); }
                if (has(p, "notes") || has(p, "description") || has(p, "notes_b64")) { pf.Notes = rd(pk, "Notes"); }
                if (has(p, "author")) { try { pf.Author = rd(pk.Element, "Author"); } catch (eA) { } }
                if (has(p, "version")) { try { pf.Version = rd(pk.Element, "Version"); } catch (eV) { } }
                items.push({ kind: "package", guid: "" + pk.PackageGUID, id: pk.PackageID, name: "" + pk.Name, fields: pf });
                out.covered.push("" + pk.PackageGUID);
            }
        } else if (name == "create_or_update_attributes" || name == "create_or_update_operations") {
            var isAt = (name == "create_or_update_attributes");
            lst = (isAt ? o.attributes : o.operations) || [];
            if (isDollar(o.element)) { unc(name + "[" + i + "]: element pres $N referenci"); continue; }
            var own = resolveEl(o.element);
            if (own == null) { unc(name + "[" + i + "]: element nenalezen"); continue; }
            var coll = isAt ? own.Attributes : own.Methods;
            for (j = 0; j < lst.length; j++) {
                var f = lst[j] || {};
                if (full()) { unc(name + "[" + i + "][" + j + "]: strop " + MAX_TARGETS + " cilu"); continue; }
                var hit = null, idWanted = isAt ? f.attributeID : f.operationID;
                try {
                    for (var c2 = 0; c2 < coll.Count; c2++) {
                        var cand = coll.GetAt(c2);
                        var cid = isAt ? cand.AttributeID : cand.MethodID;
                        var cg = isAt ? cand.AttributeGUID : cand.MethodGUID;
                        if ((idWanted && cid == parseInt(idWanted, 10)) || (f.guid && ("" + cg) == ("" + f.guid))
                            || (!idWanted && !f.guid && ("" + cand.Name) == ("" + f.name))) { hit = cand; break; }
                    }
                } catch (eC) { hit = null; }
                if (hit == null) { continue; } // create - neni co zaznamenat
                var fi = { kind: (isAt ? "attribute" : "operation"), ownerGuid: "" + own.ElementGUID, owner: "" + own.Name,
                           guid: "" + (isAt ? hit.AttributeGUID : hit.MethodGUID), id: (isAt ? hit.AttributeID : hit.MethodID),
                           name: "" + hit.Name, fields: pick(f, hit, isAt ? AT_MAP : OP_MAP) || {} };
                var ftg = tagsOf(hit.TaggedValues, f.taggedValues);
                if (ftg) { fi.tags = ftg; }
                if (!isAt && isArr(f.parameters)) {
                    fi.parameters = [];
                    try {
                        for (var pp = 0; pp < hit.Parameters.Count; pp++) {
                            var par = hit.Parameters.GetAt(pp);
                            fi.parameters.push({ name: "" + par.Name, type: "" + par.Type, "default": rd(par, "Default"), notes: rd(par, "Notes"), position: rd(par, "Position") });
                        }
                    } catch (ePa) { }
                }
                items.push(fi); out.covered.push(fi.guid);
            }
        } else if (name != "create_element" && name != "create_baseline" && name != "find_or_create_referencing_sr"
                   && name != "ping" && name != "query" && !/^(get_|find_|export_|open_|reload_|baseline_diff)/.test(name)) {
            unc(name + "[" + i + "]: operace mimo rozsah minimalniho journalu (kryje ji jen baseline)");
        }
    }
} catch (eTop) { out.why = "sber pre-image selhal: " + eTop.message; }
out.targets = items.length;
if (items.length == 0) { if (out.why == "") { out.why = "zadny cil v rozsahu journalu"; } return out; }
// --- manifest ---
try {
    var d = new Date();
    var when = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
    var login = "";
    try { login = "" + Repository.GetCurrentLoginUser(false); } catch (eL) { login = ""; }
    var bl = [];
    var bp = (baseline && baseline.packages) ? baseline.packages : [];
    for (var b = 0; b < bp.length; b++) { bl.push({ pkgGuid: bp[b].guid, path: bp[b].path, name: bp[b].name || "" }); }
    var manifest = {
        kind: "eafb-journal/1", reqId: "" + reqId, time: when,
        session: (token && token.token) ? token.token : "" + (token || ""),
        user: login, repository: "" + this.FB_RepoId(Repository),
        limitation: "Manifest lezi v per-uzivatelske slozce baseDir - neni sdileny. Kryje jen vyjmenovane cile a pole; diagramy, konektory, scenare, mazani a davky nad prahem kryje jen baseline.",
        restore: "Obnova je ukon cloveka: (a) hodnoty z `fields`/`tags`/`parameters` vrat opravnou davkou create_or_update_* s guid cile, nebo rucne v EA; tag s hodnotou null pred davkou neexistoval -> smazat. (b) Vetsi rozsah: restore z baseline uvedene v `baselines` (EA: balicek -> Ctrl+Alt+B -> Compare / Restore).",
        baselines: bl, targets: items, uncovered: out.uncovered
    };
    var base = "" + this.FB_ResolveBaseDir(Repository);
    var fso = this.FB_ComObj("Scripting.FileSystemObject");
    var dir = base + "\\journal";
    if (!fso.FolderExists(dir)) { fso.CreateFolder(dir); }
    var fn = dir + "\\" + ("" + reqId).replace(/[^0-9A-Za-z_.-]/g, "_") + ".json";
    var st = this.FB_ComObj("ADODB.Stream");
    st.Type = 2; st.Charset = "utf-8"; st.Open();
    st.WriteText("" + this.FB_JsonStringify(manifest, 1));
    st.SaveToFile(fn, 2);
    st.Close();
    out.manifestRef = fn;
} catch (eM) {
    out.why = "manifest se nepodarilo zapsat: " + eM.message;
    out.covered = [];
}
return out;
