// ============================================================================
// ITAN-Fix-Receptions (JScript pro EA Scripting) — Z260904-6b, 2026-09-09
// Opravi receptions model-based add-inu PRENESENEHO z jineho modelu
// (Copy/Paste, XMI): kazda operace se StyleEx 'Reception=1;SignalGUID={...};'
// se spa'ruje PODLE JMENA na lokalni Signal (Object_Type = 'Signal',
// typicky package Broadcast Types) a kdyz GUID nesedi, prepise se na lokalni.
// Bez platnych receptions EA add-in nepusti (Manage Add-Ins pada na Disabled).
// Stejnou logiku ma deploy_src bridge (FB_OpDeploySrc.signalGuidFor) — tento
// skript je pro CIZI add-iny, kterych se bridge nedotyka.
//
// SPUSTENI: v Project Browseru OZNAC element add-inu (stereotyp
//   JavascriptAddin) -> Specialize > Scripting > tento skript > Run.
//   Kdyz neni nic oznaceno, zepta se na jmeno elementu.
// DRY_RUN = true  -> jen vypis, NIC se nezapisuje (spust nejdriv takto)
// DRY_RUN = false -> prepise StyleEx u receptions s cizim/chybejicim GUID
// PO OPRAVE: Manage Add-Ins -> Enabled + Load on startup -> PLNY restart EA.
// ============================================================================
var DRY_RUN = true;

function sqlRows(sql) {
    var xml = "" + Repository.SQLQuery(sql);
    var rows = [], re = /<Row>([\s\S]*?)<\/Row>/gi, m;
    while ((m = re.exec(xml)) !== null) {
        var row = {}, fre = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g, fm;
        while ((fm = fre.exec(m[1])) !== null) { row[fm[1]] = fm[2]; }
        rows.push(row);
    }
    return rows;
}
function localSignalGuid(name) {
    var r = sqlRows("SELECT ea_guid FROM t_object WHERE Object_Type = 'Signal' AND Name = '" + name.replace(/'/g, "''") + "'");
    return r.length ? r[0].ea_guid : "";
}
function main() {
    Session.Output("=== ITAN-Fix-Receptions (" + (DRY_RUN ? "DRY RUN - nic se nezapisuje" : "ZAPIS") + ") ===");
    var el = null;
    try { el = Repository.GetTreeSelectedObject(); } catch (e0) { el = null; }
    if (!el || ("" + el.ObjectType) != "4") { // otElement = 4
        var nm = "" + Session.Input("Oznac add-in v Project Browseru, nebo zadej jmeno elementu add-inu:");
        nm = nm.replace(/^\s+|\s+$/g, "");
        var r = sqlRows("SELECT ea_guid FROM t_object WHERE Name = '" + nm.replace(/'/g, "''") + "' AND Stereotype = 'JavascriptAddin'");
        if (!r.length) { Session.Output("CHYBA: element '" + nm + "' se stereotypem JavascriptAddin nenalezen."); return; }
        el = Repository.GetElementByGuid(r[0].ea_guid);
    }
    Session.Output("Add-in: " + el.Name + " (elementID " + el.ElementID + ", stereotyp " + el.Stereotype + ")");
    var ok = 0, fixed = 0, missing = 0, total = 0;
    for (var i = 0; i < el.Methods.Count; i++) {
        var meth = el.Methods.GetAt(i);
        var style = "" + meth.StyleEx;
        if (style.indexOf("Reception=1") < 0) { continue; }
        total++;
        var name = "" + meth.Name;
        var cur = (/SignalGUID=(\{[^}]+\})/i.exec(style) || [null, ""])[1];
        var want = localSignalGuid(name);
        if (want == "") { missing++; Session.Output("CHYBI lokalni signal  " + name + "  (StyleEx: " + style + ")"); continue; }
        if (cur.toUpperCase() == want.toUpperCase()) { ok++; Session.Output("OK        " + name + "  " + want); continue; }
        if (DRY_RUN) { fixed++; Session.Output("K PREPNUTI " + name + "  z " + (cur || "(bez GUID)") + " na " + want); continue; }
        meth.StyleEx = "Reception=1;SignalGUID=" + want + ";";
        if (meth.Update()) { fixed++; Session.Output("PREPNUTO  " + name + "  z " + (cur || "(bez GUID)") + " na " + want); }
        else { Session.Output("CHYBA     " + name + "  Update selhal: " + meth.GetLastError()); }
    }
    if (!DRY_RUN) { el.Methods.Refresh(); }
    Session.Output("Hotovo: receptions " + total + ", OK " + ok + ", " + (DRY_RUN ? "k prepnuti " : "prepnuto ") + fixed + ", bez lokalniho signalu " + missing + ".");
    if (!DRY_RUN && fixed > 0) { Session.Output("DALSI KROK: Manage Add-Ins -> Enabled + Load on startup -> PLNY restart EA."); }
}
main();
