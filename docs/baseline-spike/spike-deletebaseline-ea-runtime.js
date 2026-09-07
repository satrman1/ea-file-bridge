// ============================================================================
// T6-S SPIKE, druhy runtime: Project.DeleteBaseline z EA runtime (Mozilla JS)
// (Z260904-2, docs/baseline-spike/PROTOKOL-SPIKE-BASELINE.md, krok K15)
//
// KAM: EA -> okno Scripting -> nova skupina/skript typu JavaScript (NE JScript,
// NE VBScript) -> vlozit cely tento text -> Run. Vystup v System Output
// (zalozka Script).
// PROC TAKHLE: in-model add-in AICodeBridge bezi na tomtez JavaScript engine
// EA jako skripty Scripting okna. Skript je PROXY za add-in runtime: nic se
// nenasazuje (zadny deploy_src, zadna zmena src/), a kdyz COM volani spadne,
// spadne jen tento skript - add-in zustava pripojeny. Rozdil proti add-inu:
// kontext "uvnitr zpracovani davky" (PROTOKOL par. 1a/4) tenhle skript
// nereprodukuje - proto je to proxy, ne dukaz; dukaz z add-inu prijde az se
// stavbou FB_BaselineCleanup (chranene volani, report rezim).
// POUSTET AZ PO K13 (spike z runtime pumpy hlasil STAV 1). Pri STAVU 3
// (API neexistuje) sem nechodit - nema co testovat.
//
// Maze VYHRADNE baseline package #FB-TEST, jejiz version zacina TARGET
// (vychozi "FBT-SPIKE len255"). Nic jineho.
// ============================================================================
var FBTEST = "{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}";
var TARGET = "FBT-SPIKE len255";

function out(s) { Session.Output("T6-S EA runtime: " + s); }
function listBaselines(pi) {
    var xml = "" + pi.GetBaselines(pi.GUIDtoXML(FBTEST), "");
    var items = [];
    var re = /<baseline\s+([^>]*)\/?>/gi, m;
    function attr(s, n) { var am = new RegExp(n + '="([^"]*)"', "i").exec(s); return am ? am[1] : ""; }
    while ((m = re.exec(xml)) != null) {
        items.push({ guid: attr(m[1], "guid"), version: attr(m[1], "version"), date: attr(m[1], "date") });
    }
    return items;
}
function main() {
    var cs = "" + Repository.ConnectionString;
    out("pripojeno: " + cs);
    if (cs.toUpperCase().indexOf("EAEXAMPLE") < 0) { out("STOP: repozitar neni EAExample."); return; }
    var pi = Repository.GetProjectInterface();
    var before = listBaselines(pi);
    out("baselines pred: " + before.length);
    var target = null, hits = 0;
    for (var i = 0; i < before.length; i++) {
        if (before[i].version.indexOf("FBT-SPIKE") == 0) { out("  kandidat: " + before[i].guid + " | " + before[i].version.substring(0, 40) + " | date=" + before[i].date); }
        if (before[i].version.indexOf(TARGET) == 0) { target = before[i]; hits++; }
    }
    if (hits != 1) { out("STOP: '" + TARGET + "' odpovida " + hits + " baselines (musi 1)."); return; }
    out("cil: " + target.guid);
    // A) existence clenu - v EA runtime muze uz tohle shodit skript (pak chybi radek 'A)')
    out("A) START typeof pi.DeleteBaseline");
    var typ = "?";
    try { typ = "" + (typeof pi.DeleteBaseline); } catch (eA) { typ = "EXC " + eA.message; }
    out("A) typeof pi.DeleteBaseline = " + typ);
    // B) volani
    out("B) START DeleteBaseline(" + target.guid + ")");
    var r = null;
    try { r = pi.DeleteBaseline(target.guid); out("B) vratil: " + r + " (typeof " + (typeof r) + ")"); }
    catch (eB) { out("B) VYJIMKA zachycena try/catch: " + eB.message); }
    // C) kontrolni cteni
    var after = listBaselines(pi);
    var still = false;
    for (var k = 0; k < after.length; k++) { if (after[k].guid == target.guid) { still = true; } }
    out("C) baselines po: " + after.length + " (pred " + before.length + "); cil " + (still ? "STALE EXISTUJE" : "JE PRYC"));
    out(still ? "VERDIKT: z EA runtime NEMAZE (navrat " + r + ")" : "VERDIKT: z EA runtime MAZE (navrat " + r + ")");
    out("KONEC (kdyz tenhle radek chybi, skript spadl na COM chybe - zapsat text chyby ze System Output)");
}
main();
