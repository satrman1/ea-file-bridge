// AICodeBridge.FB_ScopePrecheck(Repository, req, reg)
// PREDBEZNA KONTROLA CILU ZAPISU (zadani cil zapisu v1.1 kap. 5.3, 5.5, 5.7;
// Z261004b-10) - druha cast faze "targets" FB_Precheck, bezi PO kontrole
// pristupu (E_ADDIN_ACCESS ma prednost, I4) a PRED Risk Gate i zalohou. Nad
// vsemi cili zapisovych operaci, ktere jdou dohledat pred provedenim (GUID,
// ID, jmeno, cesta {path}, owningElement, dedupKey, baselineRoot) spocita:
//   - E_SCOPE_CONFIG  vadna konfigurace FB_WriteScope / FB_Config (jedina
//                     chyba, cile se dal nezkoumaji); auditovano
//   - E_BLACKLIST     cil (nebo vazba s OBEMA konci v chranene casti - i po
//                     presmerovani, podstrom mazaneho/klonovaneho balicku,
//                     koren jako cil updatu, kaskada mazani do chranene casti
//                     pri cascadeDelete "block") lezi v chranene casti; auditovano
//   - E_AMBIGUOUS     jmeno/cesta odpovida vic objektum (guids[] + candidates[])
//   - E_NOT_FOUND     jmeno/cesta nenalezeno (s napovedou cesty)
// Jediny zakazany cil = davka se neprovede vubec, ani zaloha (FB-CZ-08).
// Vraci { problems: [ { op, path, code, message, ... } ], resolved: [ { op,
// path, ref, kind, guid, id, fullPath } ], cascades: [ { op, path, kind,
// what, count, items[], message } ] } - resolved = odkazy zadane jmenem
// nebo cestou se skutecnym GUIDem a plnou cestou (FB-CZ-18, FB_Main je
// prida do odpovedi); cascades = kaskady mazani do chranene casti (W2 b/c)
// pri cascadeDelete "allow" - FB_Main je da do duvodu potvrzovaciho okna
// (clovek rozhoduje s informaci, Z261004b-11). $N odkazy se tu preskakuji
// (dohledaji se az pri provedeni - druha obrana FB_CheckWrite/FB_CheckWriteEl
// v operacich).
// Jen SQL nad standardnimi sloupci (FB_TargetCache / FB_ScopeCheck sdili
// mezipamet s provedenim); nikdy nevyhazuje.
var self = this;
var problems = [], resolved = [], cascades = [];
var isArr = function (v) { return Object.prototype.toString.call(v) == "[object Array]"; };
var refRe = /^\$(\d+)(?:\[(\d+)\])?(?:\.(id|guid))?$/;
function blank(v) { return v === null || typeof v == "undefined" || ("" + v) == ""; }
function isDollar(v) { return typeof v == "string" && refRe.test(v); }
function isPath(v) { return v !== null && typeof v == "object" && isArr(v.path); }
function esc(s) { return ("" + s).replace(/'/g, "''"); }
function rows(sql) { try { return self.FB_XmlRows(Repository.SQLQuery(sql)); } catch (eQ) { return null; } }
function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
function prob(opIdx, pth, code, msg, extra) {
    var p = { op: opIdx, path: pth, code: code, message: msg };
    if (extra) { for (var k in extra) { if (typeof extra[k] != "undefined") { p[k] = extra[k]; } } }
    problems.push(p);
}
// --- konfigurace (E_REPO resi FB_Main driv; E_SCOPE_CONFIG tady) ---
var cfg = null;
try { cfg = this.FB_WriteScopeCfg(Repository); } catch (eCfg) { cfg = null; }
if (cfg == null) {
    prob(-1, "FB_WriteScope", "E_SCOPE_CONFIG", "kontrola konfigurace cile zapisu selhala (FB_WriteScopeCfg) - fail-closed");
    return { problems: problems, resolved: resolved, cascades: cascades };
}
if (!cfg.repoKnown) {
    prob(-1, "FB_WriteScope", "E_REPO", "pripojeny repozitar (" + cfg.repoId + ") nema polozku ve FB_WriteScope - zapis zamitnut");
    return { problems: problems, resolved: resolved, cascades: cascades };
}
if (cfg.problems.length > 0) {
    // OPRAVNY KANAL (zivy nalez EAExample 2026-10-12, krok 9e): davka slozena
    // JEN z deploy_src (+ cteni) se vadnou konfiguraci NEZASTAVI - jinak by
    // preklep ve FB_WriteScope / FB_Config zablokoval i svou vlastni opravu
    // (deploy_src je zapis do modelu, P2 ho kontroluje) a doma by zbyl jen
    // bootstrap v EA Scripting. deploy_src nema zadny jiny cil nez element
    // AICodeBridge (B4 + ELEVATED okno, v bance FB_OpsAllowed deny) - vadna
    // konfigurace se k nemu nevztahuje. Kazda jina zapisova operace v davce
    // = E_SCOPE_CONFIG jako dosud (FB-CZ-03).
    var onlyDeploy = true;
    for (var od = 0; od < req.ops.length; od++) {
        var odn = "" + (req.ops[od] && req.ops[od].op);
        var odr = (reg && reg[odn]) ? reg[odn] : null;
        if (odn != "deploy_src" && (odr == null || odr.w === true)) { onlyDeploy = false; break; }
    }
    if (!onlyDeploy) {
        for (var cp = 0; cp < cfg.problems.length; cp++) { prob(-1, "FB_WriteScope", "E_SCOPE_CONFIG", cfg.problems[cp]); }
    }
    return { problems: problems, resolved: resolved, cascades: cascades };
}
// --- pomocne: plna cesta balicku / prvku z radku mezipameti ---
function pkgPathById(id) {
    var parts = [], cur = null, g = 0;
    try { cur = self.FB_TargetCache(Repository, "package", "" + id); } catch (e1) { cur = null; }
    while (cur && g++ < 60) {
        parts.unshift("" + cur.name);
        if (!cur.parentId || cur.parentId <= 0) { break; }
        try { cur = self.FB_TargetCache(Repository, "package", "" + cur.parentId); } catch (e2) { cur = null; }
    }
    return parts.join(".");
}
function fullPath(kind, row) {
    if (kind == "package") { return pkgPathById(row.id); }
    var pp = pkgPathById(row.pkgId);
    return (pp ? pp + "." : "") + row.name;
}
// --- dohledani odkazu: vraci { row, err } ; row null = nedohledano ---
// kind = "package" | "element" | "diagram"; byName/path -> E_AMBIGUOUS/E_NOT_FOUND
function lookup(opIdx, pth, kind, ref) {
    if (blank(ref) || isDollar(ref)) { return null; }
    var row = null;
    if (isPath(ref)) {
        if (isDollar(ref.from)) { return null; } // from = $N: az pri provedeni
        try { row = self.FB_TargetCache(Repository, "package", ref); } catch (eT) { row = null; }
        if (row == null) {
            var pkey = "path:" + ref.path.join("\u0001") + "|" + ("" + (blank(ref.from) ? "" : ref.from));
            var err = (self._fbTargetCache && self._fbTargetCache.err) ? self._fbTargetCache.err[pkey] : null;
            if (kind != "package") { prob(opIdx, pth, "E_ARGS", "cesta {path: [...]} je prijatelna jen jako odkaz na balicek"); return null; }
            prob(opIdx, pth, err ? ("" + (err.code || "E_NOT_FOUND")) : "E_NOT_FOUND", "cesta " + ref.path.join(" / ") + (blank(ref.from) ? "" : " od " + ref.from) + ": " + (err ? err.message : "nenalezena"),
                 err ? { guids: err.guids, candidates: err.candidates, found: err.found, children: err.children } : null);
            return null;
        }
        resolved.push({ op: opIdx, path: pth, ref: { path: ref.path, from: (blank(ref.from) ? "" : "" + ref.from) }, kind: "package", guid: row.guid, id: row.id, fullPath: fullPath("package", row) });
        return row;
    }
    var t = ("" + ref).replace(/^\s+|\s+$/g, "");
    var byName = !(t.charAt(0) == "{" || /^[0-9]+$/.test(t));
    try { row = self.FB_TargetCache(Repository, kind, t); } catch (eT2) { row = null; }
    if (row == null && byName) {
        var amb = (self._fbTargetCache && self._fbTargetCache.amb) ? self._fbTargetCache.amb[kind + ":" + t] : null;
        if (amb && amb.length > 1) {
            var guids = [], cands = [];
            for (var a = 0; a < amb.length; a++) { guids.push(amb[a].guid); cands.push({ guid: amb[a].guid, path: fullPath(kind, amb[a]) }); }
            prob(opIdx, pth, "E_AMBIGUOUS", "jmeno '" + t + "' odpovida " + amb.length + " " + (kind == "package" ? "balickum" : (kind == "diagram" ? "diagramum" : "prvkum")) + " - uved GUID kandidata" + (kind == "package" ? " nebo cestu {path: [...]}" : ""),
                 { guids: guids, candidates: cands });
        } else {
            prob(opIdx, pth, "E_NOT_FOUND", (kind == "package" ? "balicek" : (kind == "diagram" ? "diagram" : "prvek")) + " jmenem '" + t + "' v modelu neni (presna shoda jmena); uved GUID z find_*" + (kind == "package" ? " nebo cestu {path: [...]}" : ""));
        }
        return null;
    }
    if (row != null && byName) { resolved.push({ op: opIdx, path: pth, ref: t, kind: kind, guid: row.guid, id: row.id, fullPath: fullPath(kind, row) }); }
    return row; // GUID/ID nenalezeny: hlasi uz faze 2 FB_Precheck (E_ARGS) / provedeni
}
// --- kontrola cile: E_BLACKLIST do problems; vraci vysledek FB_ScopeCheck ---
function check(opIdx, pth, kind, id, via) {
    var r = null;
    try { r = self.FB_ScopeCheck(Repository, kind, "" + id); } catch (eS) { r = { code: "E_EXCEPTION", message: "kontrola cile selhala: " + eS.message }; }
    if (r != null && r.code == "E_BLACKLIST") {
        prob(opIdx, pth, "E_BLACKLIST", (via ? via + ": " : "") + r.message, { branch: r.branch, target: r.target });
    } else if (r != null && (r.code == "E_EXCEPTION")) {
        prob(opIdx, pth, "E_BLACKLIST", (via ? via + ": " : "") + r.message + " (fail-closed)");
    }
    return r;
}
function isProt(r) { return r != null && r.code == "E_BLACKLIST"; }
function allowIn(r) { return !(r && r.branch && r.branch.allowIncomingRefs === false); }
// cil zapisu: dohledat + zkontrolovat (balicek / prvek / diagram)
function target(opIdx, pth, kind, ref, via) {
    var row = lookup(opIdx, pth, kind, ref);
    if (row == null) { return null; }
    return { row: row, chk: check(opIdx, pth, kind, row.id, via) };
}
// konec vazby: jen dohledat a zjistit ochranu (bez zapisu problemu)
function endOf(opIdx, pth, ref) {
    var row = lookup(opIdx, pth, "element", ref);
    if (row == null) { return null; }
    var r = null;
    try { r = self.FB_ScopeCheck(Repository, "element", "" + row.id); } catch (eE) { r = null; }
    return { row: row, prot: isProt(r), chk: r, name: row.name };
}
function endById(id) {
    if (!id || id <= 0) { return null; }
    var r = null, row = null;
    try { row = self.FB_TargetCache(Repository, "element", "" + id); } catch (eR) { row = null; }
    try { r = self.FB_ScopeCheck(Repository, "element", "" + id); } catch (eE2) { r = null; }
    if (r != null && r.code == "E_NOT_FOUND") { return null; }
    return { row: row, prot: isProt(r), chk: r, name: row ? row.name : ("" + id) };
}
// PRAVIDLO VAZEB (kap. 5.5 v1.2; rozhodnuti Milose 12. 10. 2026, nahrazuje
// "vazbu vlastni zdroj" z B2): vazba (i zprava) je chranena, JEN kdyz jsou OBA
// jeji konce v chranene casti - s jednim koncem venku chranena neni, at vede
// kterymkoli smerem. Zmena/smazani vazby s jednim volnym koncem projde;
// presmerovani se posuzuje nad NOVYM parem koncu (novy konec nahrazuje
// skutecny). allowIncomingRefs (O3 = a) zustava jen jako volitelne zprisneni
// ZALOZENI / presmerovani cile: zdroj volny -> cil v chranene vetvi s
// allowIncomingRefs: false = E_BLACKLIST.
//   existing = { src, tgt } skutecne konce dohledaneho konektoru (null = create)
//   newSrc / newTgt = konce z requestu (create: povinne; update: presmerovani)
function connRule(opIdx, pth, existing, newSrc, newTgt, what) {
    var src = newSrc || (existing ? existing.src : null);
    var tgt = newTgt || (existing ? existing.tgt : null);
    var srcProt = !!(src && src.prot), tgtProt = !!(tgt && tgt.prot);
    if (existing != null && existing.src && existing.src.prot && existing.tgt && existing.tgt.prot) {
        prob(opIdx, pth, "E_BLACKLIST", what + ": oba konce existujici vazby ('" + existing.src.name + "' -> '" + existing.tgt.name + "') lezi v chranene casti - zmena ani smazani vazby chranene casti neni povolena. " + existing.src.chk.message, { branch: existing.src.chk.branch });
        return;
    }
    if (srcProt && tgtProt) {
        prob(opIdx, pth, "E_BLACKLIST", what + ": oba konce vazby" + (existing != null ? " po presmerovani" : "") + " ('" + src.name + "' -> '" + tgt.name + "') lezi v chranene casti. " + src.chk.message, { branch: src.chk.branch });
        return;
    }
    if (newTgt && newTgt.prot && !srcProt && !allowIn(newTgt.chk)) {
        prob(opIdx, pth, "E_BLACKLIST", what + ": cil vazby ('" + newTgt.name + "') lezi v chranene vetvi s allowIncomingRefs: false - vazba z volne casti do ni neni povolena. " + newTgt.chk.message, { branch: newTgt.chk.branch });
    }
}
function connEndsBy(guid, id) {
    var rc = null;
    if (!blank(guid) && !isDollar(guid)) { rc = rows("SELECT Connector_ID, Start_Object_ID, End_Object_ID FROM t_connector WHERE ea_guid = '" + esc(guid) + "'"); }
    else if (!blank(id) && !isDollar(id) && /^[0-9]+$/.test("" + id)) { rc = rows("SELECT Connector_ID, Start_Object_ID, End_Object_ID FROM t_connector WHERE Connector_ID = " + parseInt(id, 10)); }
    if (rc == null || rc.length != 1) { return null; }
    return { id: num(rc[0].Connector_ID), src: endById(num(rc[0].Start_Object_ID)), tgt: endById(num(rc[0].End_Object_ID)) };
}
function connByDedup(key) {
    var rc = rows("SELECT c.Connector_ID, c.Start_Object_ID, c.End_Object_ID FROM t_connector c INNER JOIN t_connectortag t ON t.ElementID = c.Connector_ID WHERE t.Property = 'ai.dedup' AND t.VALUE = '" + esc(key) + "'");
    if (rc == null || rc.length != 1) { return null; }
    return { id: num(rc[0].Connector_ID), src: endById(num(rc[0].Start_Object_ID)), tgt: endById(num(rc[0].End_Object_ID)) };
}
// --- KASKADY MAZANI do chranene casti (W2 b/c; rozhodnuti Milose 12. 10.
// 2026, varianta c): spocitaji se UZ TADY (stejne SQL jako FB_OpDelete.cascade)
// a podle cfg.cascadeDelete jdou bud do problems (block = E_BLACKLIST), nebo
// do cascades[] (allow) - FB_Main je da do textu potvrzovaciho okna. Kaskada
// (a) "prichozi vazba s chranenym zdrojem" uz NENI zasahem do chranene casti
// (vazba s jednim volnym koncem neni chranena). idsSql = SQL vyraz mnoziny
// Object_ID (jeden prvek nebo obsah podstromu balicku).
function cascadeCheck(opIdx, pth, idsSql, what) {
    var found = [];
    var rd = rows("SELECT DISTINCT x.Diagram_ID FROM t_diagramobjects x WHERE x.Object_ID IN (" + idsSql + ")");
    if (rd == null) { prob(opIdx, pth, "E_BLACKLIST", what + ": vyskyt na diagramech nelze overit (SQL) - fail-closed"); return; }
    var dgs = [];
    for (var d = 0; d < rd.length; d++) {
        var did = num(rd[d].Diagram_ID), dr = null;
        try { dr = self.FB_ScopeCheck(Repository, "diagram", "" + did); } catch (eD) { dr = null; }
        if (isProt(dr)) { dgs.push((dr.target && dr.target.path) ? dr.target.path : ("diagram " + did)); }
    }
    if (dgs.length > 0) { found.push({ kind: "diagram", count: dgs.length, items: dgs, text: "objekt lezi na " + dgs.length + " CHRANENEM/CHRANENYCH diagramu (" + dgs.slice(0, 5).join(", ") + (dgs.length > 5 ? ", ..." : "") + ") - EA ho z nich smazanim odstrani" }); }
    var ri = rows("SELECT Object_ID FROM t_object WHERE Classifier IN (" + idsSql + ")");
    if (ri == null) { prob(opIdx, pth, "E_BLACKLIST", what + ": instance klasifikatoru nelze overit (SQL) - fail-closed"); return; }
    var inst = [];
    for (var ii = 0; ii < ri.length && ii < 200; ii++) {
        var iid = num(ri[ii].Object_ID), ir = null;
        try { ir = self.FB_ScopeCheck(Repository, "element", "" + iid); } catch (eI) { ir = null; }
        if (isProt(ir)) { inst.push((ir.target && ir.target.path) ? ir.target.path : ("prvek " + iid)); }
    }
    if (inst.length > 0) { found.push({ kind: "classifier", count: inst.length, items: inst, text: "mazany prvek je klasifikatorem " + inst.length + " instanci v chranene casti (" + inst.slice(0, 5).join(", ") + (inst.length > 5 ? ", ..." : "") + ") - EA jim nastavi Classifier = 0 (zive overeno Z10-13)" }); }
    for (var f = 0; f < found.length; f++) {
        var msg = what + ": " + found[f].text;
        if (cfg.cascadeDelete == "block") {
            prob(opIdx, pth, "E_BLACKLIST", msg + ". Kaskada do chranene casti je zakazana (FB_WriteScope.cascadeDelete = block) - pozadej cloveka.", { cascade: found[f].kind, count: found[f].count, items: found[f].items });
        } else {
            cascades.push({ op: opIdx, path: pth, kind: found[f].kind, what: what, count: found[f].count, items: found[f].items,
                message: "VAROVANI (kaskada mazani do chranene casti, cascadeDelete = allow): " + msg + ". Zaloha pred zapisem chraneny balicek NEKRYJE." });
        }
    }
}
function subtreeObjectsSql(rootId) {
    var ids = [rootId], queue = [rootId], seen = {}, guard = 0;
    seen[rootId] = 1;
    while (queue.length > 0 && guard++ < 500) {
        var pid = queue.shift();
        var rp = rows("SELECT Package_ID FROM t_package WHERE Parent_ID = " + pid);
        if (rp == null) { return null; }
        for (var k = 0; k < rp.length; k++) { var n = num(rp[k].Package_ID); if (!seen[n]) { seen[n] = 1; ids.push(n); queue.push(n); } }
    }
    return "SELECT Object_ID FROM t_object WHERE Package_ID IN (" + ids.join(",") + ")";
}
function elByDedup(key) {
    var r = rows("SELECT o.Object_ID FROM t_object o INNER JOIN t_objectproperties p ON p.Object_ID = o.Object_ID WHERE p.Property = 'ai.dedup' AND p.Value = '" + esc(key) + "'");
    if (r == null || r.length != 1) { return 0; }
    return num(r[0].Object_ID);
}
function subtreeHas(opIdx, pth, pkgId, what) {
    var inside = cfg.ancestorIds["" + pkgId];
    if (inside && inside.length > 0) {
        prob(opIdx, pth, "E_BLACKLIST", what + ": podstrom balicku '" + pkgPathById(pkgId) + "' obsahuje chranenou vetev (" + inside.join(", ") + ") - " + what.toLowerCase() + " by ji vzal s sebou", { branch: { path: inside[0] } });
        return true;
    }
    return false;
}
function ownerByTable(ty, id) {
    if (!/^[0-9]+$/.test("" + id)) { return 0; }
    var r = (ty == "ATTRIBUTE") ? rows("SELECT Object_ID FROM t_attribute WHERE ID = " + parseInt(id, 10))
                                 : rows("SELECT Object_ID FROM t_operation WHERE OperationID = " + parseInt(id, 10));
    if (r == null || r.length != 1) { return 0; }
    return num(r[0].Object_ID);
}
// --- baselineRoot (kap. 5.9/2): pole davky, kontroluje se jako cil ---
if (req && !blank(req.baselineRoot)) { target(-1, "baselineRoot", "package", req.baselineRoot, ""); }
// --- pruchod operacemi ---
for (var i = 0; i < req.ops.length; i++) {
    var o = req.ops[i];
    if (!o || typeof o != "object") { continue; }
    var name = "" + (o.op || "");
    if (!reg || !reg[name] || !reg[name].w) { continue; }
    var P = "ops[" + i + "]";
    var j, lst, it, tr;
    if (name == "create_element") {
        if (!blank(o.owningElement)) { target(i, P + ".owningElement", "element", o.owningElement, ""); }
        else { target(i, P + ".package", "package", o["package"], ""); }
    } else if (name == "create_or_update_elements") {
        lst = isArr(o.elements) ? o.elements : [];
        for (j = 0; j < lst.length; j++) {
            it = lst[j]; if (!it || typeof it != "object") { continue; }
            var Q = P + ".elements[" + j + "]";
            if (!blank(it.guid) || !blank(it.elementID)) { target(i, Q, "element", it.guid || it.elementID, "update"); continue; }
            if (!blank(it.dedupKey)) { var did = elByDedup(it.dedupKey); if (did > 0) { check(i, Q + ".dedupKey", "element", did, "dedupKey '" + it.dedupKey + "' = existujici prvek"); continue; } }
            if (!blank(it.owningElement)) { target(i, Q + ".owningElement", "element", it.owningElement, ""); }
            else { target(i, Q + ".package", "package", it["package"], ""); }
        }
    } else if (name == "move_elements") {
        lst = isArr(o.elements) ? o.elements : [];
        for (j = 0; j < lst.length; j++) {
            it = lst[j];
            var mref = (it !== null && typeof it == "object") ? (it.element || it.guid || it.elementID) : it;
            var mpkg = (it !== null && typeof it == "object" && !blank(it["package"])) ? it["package"] : o["package"];
            target(i, P + ".elements[" + j + "]", "element", mref, "zdroj presunu");
            target(i, P + ".elements[" + j + "].package", "package", mpkg, "cil presunu");
        }
    } else if (name == "create_or_update_package") {
        lst = isArr(o.packages) ? o.packages : [o];
        for (j = 0; j < lst.length; j++) {
            it = lst[j]; if (!it || typeof it != "object") { continue; }
            var R = isArr(o.packages) ? P + ".packages[" + j + "]" : P;
            if (!blank(it.guid) || !blank(it.packageID)) {
                tr = target(i, R, "package", it.guid || it.packageID, "update");
                if (tr && tr.row && tr.row.parentId === 0 && !isProt(tr.chk)) {
                    prob(i, R, "E_BLACKLIST", "update: balicek '" + tr.row.name + "' je KOREN modelu - prejmenovani ani zmena korene neni povolena (ochrana uzlu, kap. 5.3 krok 4)");
                }
            } else {
                target(i, R + ".parent", "package", it.parent, "rodic noveho balicku");
            }
        }
    } else if (name == "create_or_update_connectors") {
        lst = isArr(o.connectors) ? o.connectors : [];
        for (j = 0; j < lst.length; j++) {
            it = lst[j]; if (!it || typeof it != "object") { continue; }
            var CQ = P + ".connectors[" + j + "]";
            var ex = null;
            if (!blank(it.guid) || !blank(it.connectorID)) { ex = connEndsBy(it.guid, it.connectorID); if (ex == null) { continue; } }
            else if (!blank(it.dedupKey)) { ex = connByDedup(it.dedupKey); }
            var ns = blank(it.source) ? null : endOf(i, CQ + ".source", it.source);
            var nt = blank(it.target) ? null : endOf(i, CQ + ".target", it.target);
            if (ex == null && (isDollar(it.source) || isDollar(it.target))) { continue; } // konce az pri provedeni
            if (ex == null && (ns == null || nt == null)) { continue; }
            connRule(i, CQ, ex, ns, nt, "vazba");
        }
    } else if (name == "create_or_update_attributes" || name == "create_or_update_operations" || name == "create_or_update_scenarios"
               || name == "create_or_update_constraints" || name == "create_or_update_requirements") {
        target(i, P + ".element", "element", o.element, "");
    } else if (name == "create_or_update_messages") {
        var dgT = null;
        if (!blank(o.diagram)) { dgT = target(i, P + ".diagram", "diagram", o.diagram, "diagram zprav"); }
        if ((o.rebuild === true || ("" + o.rebuild) == "true") && dgT && dgT.row) {
            var sq = rows("SELECT Connector_ID, Start_Object_ID, End_Object_ID FROM t_connector WHERE DiagramID = " + dgT.row.id + " AND Connector_Type = 'Sequence'");
            for (var sqi = 0; sq != null && sqi < sq.length; sqi++) {
                var se = endById(num(sq[sqi].Start_Object_ID)), te = endById(num(sq[sqi].End_Object_ID));
                if (se && se.prot && te && te.prot) { prob(i, P + ".rebuild", "E_BLACKLIST", "rebuild: zprava " + sq[sqi].Connector_ID + " ma oba konce ('" + se.name + "' -> '" + te.name + "') v chranene casti - mazani zprav chranene casti neni povolene. " + se.chk.message, { branch: se.chk.branch }); break; }
            }
        }
        lst = isArr(o.messages) ? o.messages : [];
        for (j = 0; j < lst.length; j++) {
            it = lst[j]; if (!it || typeof it != "object") { continue; }
            var MQ = P + ".messages[" + j + "]";
            var mex = null;
            if (!blank(it.guid) || !blank(it.connectorID)) { mex = connEndsBy(it.guid, it.connectorID); if (mex == null) { continue; } }
            var ms = blank(it.source) ? null : endOf(i, MQ + ".source", it.source);
            var mt = blank(it.target) ? null : endOf(i, MQ + ".target", it.target);
            if (mex == null && (isDollar(it.source) || isDollar(it.target))) { continue; }
            if (mex == null && (ms == null || mt == null)) { continue; }
            connRule(i, MQ, mex, ms, mt, "zprava");
        }
    } else if (name == "delete_from_model") {
        lst = isArr(o.targets) ? o.targets : [];
        for (j = 0; j < lst.length; j++) {
            it = lst[j]; if (!it || typeof it != "object") { continue; }
            var DQ = P + ".targets[" + j + "]";
            var ty = ("" + (it.type || "")).toUpperCase();
            if (ty == "ELEMENT") {
                tr = target(i, DQ, "element", it.guid || it.id, "mazani");
                if (tr && tr.row && !isProt(tr.chk)) { cascadeCheck(i, DQ, "" + tr.row.id, "kaskada mazani prvku '" + tr.row.name + "'"); }
            }
            else if (ty == "DIAGRAM") { target(i, DQ, "diagram", it.guid || it.id, "mazani"); }
            else if (ty == "PACKAGE") {
                tr = target(i, DQ, "package", it.guid || it.id, "mazani");
                if (tr && tr.row) {
                    if (tr.row.parentId === 0) { prob(i, DQ, "E_ARGS", "root package nelze mazat"); }
                    else if (!isProt(tr.chk) && !subtreeHas(i, DQ, tr.row.id, "Mazani balicku")) {
                        var sSql = subtreeObjectsSql(tr.row.id);
                        if (sSql == null) { prob(i, DQ, "E_BLACKLIST", "mazani balicku '" + tr.row.name + "': podstrom nelze precist (SQL) - fail-closed"); }
                        else { cascadeCheck(i, DQ, sSql, "kaskada mazani balicku '" + tr.row.name + "'"); }
                    }
                }
            } else if (ty == "CONNECTOR") {
                var dex = connEndsBy(it.guid, it.id);
                if (dex != null) { connRule(i, DQ, dex, null, null, "mazani vazby"); }
            } else if (ty == "ATTRIBUTE" || ty == "OPERATION" || ty == "PARAMETER") {
                var oid = ownerByTable(ty == "ATTRIBUTE" ? "ATTRIBUTE" : "OPERATION", it.id);
                if (oid > 0) { check(i, DQ, "element", oid, "vlastnik " + ty.toLowerCase()); }
            }
        }
    } else if (name == "delete_taggedvalue_from_model") {
        lst = isArr(o.targets) ? o.targets : [];
        for (j = 0; j < lst.length; j++) {
            it = lst[j]; if (!it || typeof it != "object") { continue; }
            var TQ = P + ".targets[" + j + "]";
            var tty = ("" + (it.type || "")).toUpperCase();
            if (tty == "ELEMENTTAGGEDVALUE") { target(i, TQ, "element", it.guid || it.id, "vlastnik tagu"); }
            else if (tty == "PACKAGETAGGEDVALUE") { target(i, TQ, "package", it.guid || it.id, "vlastnik tagu"); }
            else if (tty == "CONNECTORTAGGEDVALUE") { var tex = connEndsBy(it.guid, it.id); if (tex != null) { connRule(i, TQ, tex, null, null, "mazani tagu vazby"); } }
            else if (tty == "ATTRIBUTETAGGEDVALUE" || tty == "OPERATIONTAGGEDVALUE") {
                var toid = ownerByTable(tty == "ATTRIBUTETAGGEDVALUE" ? "ATTRIBUTE" : "OPERATION", it.id);
                if (toid > 0) { check(i, TQ, "element", toid, "vlastnik tagu"); }
            }
        }
    } else if (name == "remove_elements_from_diagram" || name == "layout_connectors" || name == "change_connector_visibility"
               || name == "set_diagram_object_style" || name == "place_elements_on_diagram") {
        target(i, P + ".diagram", "diagram", o.diagram, "diagram");
    } else if (name == "update_diagram_properties") {
        lst = isArr(o.diagrams) ? o.diagrams : [];
        for (j = 0; j < lst.length; j++) {
            it = lst[j]; if (!it || typeof it != "object") { continue; }
            target(i, P + ".diagrams[" + j + "]", "diagram", it.diagram || it.diagramID || it.guid, "diagram");
        }
    } else if (name == "create_or_update_diagram") {
        lst = isArr(o.diagrams) ? o.diagrams : [];
        for (j = 0; j < lst.length; j++) {
            it = lst[j]; if (!it || typeof it != "object") { continue; }
            var GQ = P + ".diagrams[" + j + "]";
            var dref = it.diagram || it.diagramID || it.guid;
            if (!blank(dref)) { target(i, GQ, "diagram", dref, "update"); }
            else if (!blank(it.owningElement)) { target(i, GQ + ".owningElement", "element", it.owningElement, ""); }
            else { target(i, GQ + ".package", "package", it["package"], ""); }
        }
    } else if (name == "create_baseline") {
        target(i, P + ".package", "package", o["package"], "zaloha");
    } else if (name == "clone_package") {
        tr = target(i, P + ".package", "package", o["package"], "zdroj klonu");
        if (tr && tr.row && !isProt(tr.chk)) { subtreeHas(i, P + ".package", tr.row.id, "Klon balicku"); }
    } else if (name == "clone_elements") {
        lst = isArr(o.elements) ? o.elements : [];
        for (j = 0; j < lst.length; j++) { target(i, P + ".elements[" + j + "]", "element", lst[j], "zdroj klonu"); }
        if (!blank(o["package"])) { target(i, P + ".package", "package", o["package"], "cil klonu"); }
    } else if (name == "import_element_linked_documents") {
        lst = isArr(o.documents) ? o.documents : [];
        for (j = 0; j < lst.length; j++) { it = lst[j]; if (it && typeof it == "object") { target(i, P + ".documents[" + j + "].element", "element", it.element, ""); } }
    } else if (name == "apply_classifier_stereotypes") {
        var adg = target(i, P + ".diagram", "diagram", o.diagram, "diagram");
        if (isArr(o.elementIDs) && o.elementIDs.length > 0) {
            for (j = 0; j < o.elementIDs.length; j++) { target(i, P + ".elementIDs[" + j + "]", "element", o.elementIDs[j], "prvek na diagramu"); }
        } else if (adg && adg.row) {
            var dob = rows("SELECT Object_ID FROM t_diagramobjects WHERE Diagram_ID = " + adg.row.id);
            for (var di = 0; dob != null && di < dob.length; di++) {
                var dr = check(i, P + ".diagram", "element", num(dob[di].Object_ID), "prvek na diagramu");
                if (isProt(dr)) { break; }
            }
        }
    } else if (name == "find_or_create_referencing_sr") {
        if (!blank(o.targetPackage)) { target(i, P + ".targetPackage", "package", o.targetPackage, "cilovy balicek"); }
        if (!blank(o.operation) && !isDollar(o.operation)) {
            var opr = null;
            var ot = "" + o.operation;
            if (ot.charAt(0) == "{") { opr = rows("SELECT Object_ID FROM t_operation WHERE ea_guid = '" + esc(ot) + "'"); }
            else if (/^[0-9]+$/.test(ot)) { opr = rows("SELECT Object_ID FROM t_operation WHERE OperationID = " + parseInt(ot, 10)); }
            if (opr != null && opr.length == 1) {
                var oe = endById(num(opr[0].Object_ID));
                if (oe && oe.prot && !allowIn(oe.chk)) {
                    prob(i, P + ".operation", "E_BLACKLIST", "vazba SR -> operace: vlastnik operace ('" + oe.name + "') lezi v chranene vetvi s allowIncomingRefs: false. " + oe.chk.message, { branch: oe.chk.branch });
                }
            }
        }
    }
    // deploy_src: cil = element AICodeBridge, hlida B4 v Risk Gate (E_RISK_BLOCKED / E_OP_FORBIDDEN)
}
return { problems: problems, resolved: resolved, cascades: cascades };
