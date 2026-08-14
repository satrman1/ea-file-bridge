// AICodeBridge.FB_OpCreateElement(Repository, op, reqId)
// Zalozi element pres Automation API (SQL zapis NIKDY). Zapis jen do package
// z FB_Whitelist. Kazdy AI zapis nese tagy ai.channel + ai.request (detektivni model).
if (!op || !op.name || !op.type) {
    return { op: "create_element", status: "error", code: "E_ARGS", message: "Povinne: name, type, package." };
}
// --- resolve package: {GUID} | packageID | jmeno ---
var ref = ("" + (op["package"] || "")).replace(/^\s+|\s+$/g, "");
var pkg = null;
try {
    if (ref.charAt(0) == "{") {
        pkg = Repository.GetPackageByGuid(ref);
    } else if (/^[0-9]+$/.test(ref)) {
        pkg = Repository.GetPackageByID(parseInt(ref, 10));
    } else if (ref != "") {
        var xml = Repository.SQLQuery("SELECT ea_guid FROM t_package WHERE Name = '" + ref.replace(/'/g, "''") + "'");
        var mm = /<ea_guid>([^<]+)<\/ea_guid>/i.exec(xml);
        if (mm) { pkg = Repository.GetPackageByGuid(mm[1]); }
    }
} catch (e) {
    pkg = null;
}
if (pkg == null) {
    return { op: "create_element", status: "error", code: "E_NOT_FOUND", message: "Package nenalezen: " + ref };
}
// --- whitelist (vynuceno v kodu, jedine misto pravdy = FB_Whitelist) ---
// Polozka = { repo: podretezec ConnectionString, pkg: "{GUID}" }.
// Nejdriv se overi INSTANCE repozitare (klon ma shodne GUIDy, ale jiny
// connection string), teprve pak package.
var wl = this.FB_Whitelist();
var cs = ("" + Repository.ConnectionString).toUpperCase();
var pguid = ("" + pkg.PackageGUID).toUpperCase();
var repoKnown = false;
var allowed = false;
for (var i = 0; i < wl.length; i++) {
    var w = wl[i];
    if (cs.indexOf(("" + w.repo).toUpperCase()) < 0) { continue; }
    repoKnown = true;
    if (("" + w.pkg).toUpperCase() == pguid) { allowed = true; }
}
if (!repoKnown) {
    return { op: "create_element", status: "error", code: "E_REPO",
        message: "Pripojeny repozitar neni ve whitelistu - zapis zamitnut. Pripojeno: " + Repository.ConnectionString };
}
if (!allowed) {
    return { op: "create_element", status: "error", code: "E_WHITELIST",
        message: "Package mimo whitelist: " + pkg.Name + " " + pguid };
}
// --- zapis vyhradne Automation API ---
var el = pkg.Elements.AddNew("" + op.name, "" + op.type);
if (!el.Update()) {
    return { op: "create_element", status: "error", code: "E_EXCEPTION", message: "Update selhal: " + el.GetLastError() };
}
if (op.stereotype) { el.StereotypeEx = "" + op.stereotype; }
// Notes: preferovane plain "notes" (JSON escaping tab/diakritiku zvladne),
// "notes_b64" zustava podporovane (base64 UTF-8). Duvod zmeny 2026-08-14:
// driver si base64 overoval terminalem -> rucni Allow; plain notes to odstrani.
if (op.notes_b64) { el.Notes = this.B64Decode(op.notes_b64); }
else if (typeof op.notes != "undefined") { el.Notes = "" + op.notes; }
if (op.stereotype || op.notes_b64 || typeof op.notes != "undefined") { el.Update(); }
this.SetTag(el, "ai.channel", "eafb");
this.SetTag(el, "ai.request", "" + reqId);
pkg.Elements.Refresh();
return { op: "create_element", status: "ok", guid: "" + el.ElementGUID, elementId: el.ElementID, name: "" + el.Name };
