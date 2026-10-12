// AICodeBridge.FB_WriteScopeCfg(Repository)
// KONFIGURACE CILE ZAPISU pro pripojeny repozitar - jedno misto, kde se cte
// FB_WriteScope, kontroluje se (E_SCOPE_CONFIG, zadani cil zapisu v1.1 kap.
// 5.2) a sklada se mnozina DEDICNE chranenych balicku (kap. 5.4): blacklist +
// balicek auditu (FB_Config.auditPkg) + balicek, ve kterem lezi element
// AICodeBridge. Koreny modelu (Parent_ID = 0) se tu NEevidují - jsou chranene
// jen jako uzel (B1, O5 = a) a to resi operace samy (FB_OpPackage, FB_OpDelete)
// a FB_RiskGate (duvod okna "novy balicek pod korenem").
// Vraci { repoId, repoKnown, entry, problems[], warnings[], blacklist[],
//         implicit[], protectedIds{}, ancestorIds{}, auditPkg, bridge,
//         cascadeDelete }:
//   problems      vady konfigurace -> E_SCOPE_CONFIG pro vsechny zapisy
//   cascadeDelete "allow" | "block" (klic polozky; chybi = "block", jina
//                 hodnota = vada) - kaskady mazani do chranene casti (W2 b/c),
//                 rozhodnuti Milose 12. 10. 2026 (Z261004b-11)
//   blacklist[]   { pkg, name, note, allowIncomingRefs, found, id, path, actualName }
//   implicit[]    { kind "audit"|"addin", id, guid, name, path, note }
//   protectedIds  Package_ID -> { kind, guid, name, path, note, allowIncomingRefs }
//   ancestorIds   Package_ID predka chranene vetve -> [ jmena chranenych pod nim ]
//                 (mazani/klon balicku, ktery chranenou vetev OBSAHUJE - kap. 5.5)
// MEZIPAMET jednoho volani FB_Main (this._fbScopeCfg; FB_Main nuluje na
// startu) - sdili ji predbezna kontrola P2, FB_CheckWrite pri provedeni,
// Risk Gate i zaloha (kap. 5.3, R12). Dohledani balicku jde pres
// FB_TargetCache (SQL nad standardnimi sloupci) s nahradou pres Automation
// (GetPackageByGuid/ByID), aby se chovala stejne pod pumpou i v EA runtime.
// Nikdy nevyhazuje: chyba cteni = vada konfigurace (fail-closed).
var self = this;
var ridRaw = "";
try { ridRaw = "" + this.FB_RepoId(Repository); } catch (eR) { ridRaw = ""; }
var rid = ridRaw.toUpperCase();
if (this._fbScopeCfg && typeof this._fbScopeCfg == "object" && this._fbScopeCfg.repoId === ridRaw) {
    return this._fbScopeCfg;
}
var out = { repoId: ridRaw, repoKnown: false, entry: null, problems: [], warnings: [], blacklist: [], implicit: [],
            protectedIds: {}, ancestorIds: {}, auditPkg: null, bridge: null, cascadeDelete: "block", checked: { pkg: {}, el: {}, dgm: {} } };
function isArr(v) { return Object.prototype.toString.call(v) == "[object Array]"; }
function esc(s) { return ("" + s).replace(/'/g, "''"); }
function rows(sql) { try { return self.FB_XmlRows(Repository.SQLQuery(sql)); } catch (eQ) { return null; } }
// radek balicku: FB_TargetCache (SQL) -> nahrada Automation objektem
function pkgRow(ref) {
    var r = null;
    try { r = self.FB_TargetCache(Repository, "package", ref); } catch (eT) { r = null; }
    if (r != null) { return r; }
    var po = null;
    try {
        var t = "" + ref;
        if (t.charAt(0) == "{") { po = Repository.GetPackageByGuid(t); }
        else if (/^[0-9]+$/.test(t)) { po = Repository.GetPackageByID(parseInt(t, 10)); }
    } catch (eP) { po = null; }
    if (!po) { return null; }
    var pid = 0;
    try { pid = parseInt(po.ParentID, 10); } catch (eI) { pid = 0; }
    if (isNaN(pid)) { pid = 0; }
    return { guid: "" + po.PackageGUID, id: parseInt(po.PackageID, 10), parentId: pid, name: "" + po.Name };
}
function pathOf(row) {
    var parts = [], cur = row, guard = 0;
    while (cur && guard++ < 60) {
        parts.unshift("" + cur.name);
        if (!cur.parentId || cur.parentId <= 0) { break; }
        cur = pkgRow("" + cur.parentId);
    }
    return parts.join(".");
}
function addProtected(row, kind, note, allowIn) {
    var key = "" + row.id;
    if (out.protectedIds[key]) { return; }
    var pth = pathOf(row);
    out.protectedIds[key] = { kind: kind, guid: "" + row.guid, name: "" + row.name, path: pth, note: "" + note,
                              allowIncomingRefs: (allowIn === false) ? false : true };
    // predci (vcetne korenu): mazani/klon predka by chranenou vetev vzal s sebou
    var cur = row, guard = 0;
    while (cur && cur.parentId && cur.parentId > 0 && guard++ < 60) {
        cur = pkgRow("" + cur.parentId);
        if (!cur) { break; }
        var ak = "" + cur.id;
        if (!out.ancestorIds[ak]) { out.ancestorIds[ak] = []; }
        out.ancestorIds[ak].push(pth);
    }
    return out.protectedIds[key];
}
// --- (1) polozka repozitare ---
var ws = null;
try { ws = this.FB_WriteScope(); } catch (eWs) { ws = null; out.problems.push("FB_WriteScope nelze precist: " + (eWs && eWs.message ? eWs.message : eWs)); }
if (isArr(ws)) {
    for (var i = 0; i < ws.length; i++) {
        var w = ws[i];
        if (w && rid != "" && rid.indexOf(("" + w.repo).toUpperCase()) >= 0) { out.entry = w; out.repoKnown = true; break; }
    }
}
if (!out.repoKnown) {
    this._fbScopeCfg = out;
    return out; // E_REPO resi volajici (bez auditu - muze jit o cizi repozitar)
}
// --- (1b) cascadeDelete (Z261004b-11): chybi = block (fail-closed) ---
if (typeof out.entry.cascadeDelete == "undefined" || out.entry.cascadeDelete === null) {
    out.cascadeDelete = "block";
} else {
    var cdv = ("" + out.entry.cascadeDelete).toLowerCase();
    if (cdv == "allow" || cdv == "block") { out.cascadeDelete = cdv; }
    else { out.cascadeDelete = "block"; out.problems.push("polozka FB_WriteScope pro repozitar '" + out.entry.repo + "': cascadeDelete musi byt \"allow\" nebo \"block\" (je '" + out.entry.cascadeDelete + "')"); }
}
// --- (2) blacklist ---
if (!isArr(out.entry.blacklist)) {
    out.problems.push("polozka FB_WriteScope pro repozitar '" + out.entry.repo + "' nema klic blacklist (i prazdny blacklist se pise vyslovne: blacklist: [])");
} else {
    for (var b = 0; b < out.entry.blacklist.length; b++) {
        var it = out.entry.blacklist[b] || {};
        var bl = { pkg: "" + (it.pkg || ""), name: "" + (it.name || ""), note: "" + (it.note || ""),
                   allowIncomingRefs: (it.allowIncomingRefs === false) ? false : true, found: false, id: 0, path: "", actualName: "" };
        out.blacklist.push(bl);
        if (bl.pkg == "" || bl.pkg.charAt(0) != "{") {
            out.problems.push("blacklist[" + b + "]: pkg musi byt GUID balicku ve tvaru {...} (je '" + bl.pkg + "')");
            continue;
        }
        if (bl.name == "") {
            out.problems.push("blacklist[" + b + "] (" + bl.pkg + "): chybi name (jmeno balicku je druha polovina klice)");
        }
        var row = pkgRow(bl.pkg);
        if (row == null) {
            var hint = "";
            if (bl.name != "") {
                var byName = rows("SELECT Package_ID, ea_guid, Name FROM t_package WHERE Name = '" + esc(bl.name) + "'");
                if (byName != null && byName.length > 0) {
                    var gs = [];
                    for (var n = 0; n < byName.length && n < 5; n++) { if (("" + byName[n].Name) === bl.name) { gs.push("" + byName[n].ea_guid); } }
                    if (gs.length > 0) { hint = "; balicek jmena '" + bl.name + "' existuje s GUID " + gs.join(", ") + " - preklep?"; }
                }
            }
            out.problems.push("blacklist[" + b + "]: GUID " + bl.pkg + " v repozitari nenalezen" + hint + " (smazany nebo preklep - oprav FB_WriteScope: doma deploy_src, v bance bootstrap)");
            continue;
        }
        bl.found = true; bl.id = row.id; bl.actualName = "" + row.name;
        if (bl.name != "" && ("" + row.name) !== bl.name) {
            out.problems.push("blacklist[" + b + "]: balicek " + bl.pkg + " se jmenuje '" + row.name + "', konfigurace ceka '" + bl.name + "' - preklep nebo prejmenovani; oprav FB_WriteScope");
            continue;
        }
        var pr = addProtected(row, "blacklist", bl.note, bl.allowIncomingRefs);
        if (pr) { bl.path = pr.path; }
    }
}
// --- (3) balicek auditu (povinny v rezimu blacklist - I5) ---
var auditGuid = "";
try {
    var cfgs = this.FB_Config();
    for (var ci = 0; ci < cfgs.length; ci++) {
        if (rid.indexOf(("" + cfgs[ci].repo).toUpperCase()) >= 0) { if (cfgs[ci].auditPkg) { auditGuid = "" + cfgs[ci].auditPkg; } break; }
    }
} catch (eC) { auditGuid = ""; }
if (auditGuid == "") {
    out.problems.push("FB_Config polozka repozitare nema auditPkg (GUID balicku auditu) - v rezimu blacklist je povinny (fallback jmenem '#AI-LOG' neni identita)");
} else {
    var arow = pkgRow(auditGuid);
    if (arow == null) {
        out.warnings.push("balicek auditu FB_Config.auditPkg " + auditGuid + " v modelu nenalezen - audit davek se neulozi (FB_Audit) a implicitni ochrana auditu neplati");
    } else {
        out.auditPkg = { id: arow.id, guid: "" + arow.guid, name: "" + arow.name };
        var apr = addProtected(arow, "audit", "balicek auditu bridge (FB_Config.auditPkg)", true);
        out.implicit.push({ kind: "audit", id: arow.id, guid: "" + arow.guid, name: "" + arow.name, path: apr ? apr.path : "", note: "balicek auditu bridge" });
    }
}
// --- (4) balicek add-inu (element AICodeBridge se stereotypem JavascriptAddin) ---
var br = rows("SELECT Object_ID, ea_guid, Package_ID FROM t_object WHERE Name = 'AICodeBridge' AND Stereotype = 'JavascriptAddin'");
if (br != null && br.length > 0) {
    var bid = parseInt(br[0].Object_ID, 10), bpk = parseInt(br[0].Package_ID, 10);
    out.bridge = { id: bid, guid: "" + br[0].ea_guid, pkgId: bpk, count: br.length };
    if (br.length > 1) { out.warnings.push("v modelu je " + br.length + "x element AICodeBridge (JavascriptAddin) - implicitni ochrana kryje balicek prvniho (N-B-4: zkontroluj Manage Add-Ins)"); }
    var brow = pkgRow("" + bpk);
    if (brow == null) {
        out.problems.push("balicek add-inu (Package_ID " + bpk + ") nelze dohledat");
    } else {
        // cizi obsah: top-level objekty mimo add-iny (jine JavascriptAddin elementy
        // jsou take add-iny - EA je bezne drzi v jednom balicku) a podbalicky
        var foreign = [];
        var ob = rows("SELECT Object_ID, Name, Stereotype, ParentID FROM t_object WHERE Package_ID = " + bpk);
        if (ob == null) { out.problems.push("obsah balicku add-inu nelze precist (SQL)"); }
        else {
            for (var o = 0; o < ob.length; o++) {
                var pid0 = parseInt(ob[o].ParentID, 10);
                if (parseInt(ob[o].Object_ID, 10) == bid) { continue; }
                if (!isNaN(pid0) && pid0 > 0) { continue; } // vlastneny jinym prvkem (add-inem)
                if (("" + ob[o].Stereotype) == "JavascriptAddin") { continue; }
                if (foreign.length < 5) { foreign.push("" + ob[o].Name + " (" + ob[o].Object_ID + ")"); }
            }
        }
        var sub = rows("SELECT Package_ID, Name FROM t_package WHERE Parent_ID = " + bpk);
        if (sub == null) { out.problems.push("podbalicky balicku add-inu nelze precist (SQL)"); }
        else { for (var s = 0; s < sub.length && foreign.length < 8; s++) { foreign.push("podbalicek " + sub[s].Name + " (" + sub[s].Package_ID + ")"); } }
        var bpr = addProtected(brow, "addin", "balicek add-inu (element AICodeBridge)", true);
        out.implicit.push({ kind: "addin", id: brow.id, guid: "" + brow.guid, name: "" + brow.name, path: bpr ? bpr.path : "", note: "balicek add-inu" });
        if (foreign.length > 0) {
            out.problems.push("balicek add-inu '" + (bpr ? bpr.path : brow.name) + "' obsahuje neco jineho nez add-in: " + foreign.join(", ")
                + " - implicitni ochrana by sahala na cizi obsah; presun add-in do vlastniho balicku (B1)");
        }
    }
}
this._fbScopeCfg = out;
return out;
