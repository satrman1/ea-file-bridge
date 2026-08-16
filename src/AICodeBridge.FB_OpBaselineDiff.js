// AICodeBridge.FB_OpBaselineDiff(Repository, op)
// baseline_diff (K5, cteci cast) - porovnani package proti baseline.
// op.package  = "{GUID}" | packageID | jmeno
// op.baseline = GUID baseline (z get_baselines / create_baseline)
// Vraci surovy XML log DoBaselineCompare (comparelog) - strukturu logu
// interpretuje driver/skill; executor jen porovnava. Jen cteni (zadny zapis).
// POZN: apply_baseline ekvivalent NEEXISTUJE zamerne (par. 12a) - obnovu
// z baseline dela vyhradne clovek v EA UI dle Restore-Runbook.
if (!op || !op["package"] || !op.baseline) {
    return { op: "baseline_diff", status: "error", code: "E_ARGS", message: "Povinne: package, baseline (GUID baseline)." };
}
var pkg = this.FB_ResolvePkg(Repository, op["package"]);
if (pkg == null) { return { op: "baseline_diff", status: "error", code: "E_NOT_FOUND", message: "Package nenalezen: " + op["package"] }; }
var pi = Repository.GetProjectInterface();
var xml = "";
try {
    xml = "" + pi.DoBaselineCompare(pi.GUIDtoXML("" + pkg.PackageGUID), "" + op.baseline, "");
} catch (e) {
    return { op: "baseline_diff", status: "error", code: "E_EXCEPTION", message: "DoBaselineCompare selhal: " + e.message };
}
// hruby souhrn: pocty polozek podle statusu v comparelogu
var counts = {};
var re = /status="([^"]*)"/gi, m;
while ((m = re.exec(xml)) != null) {
    var s = m[1];
    counts[s] = (counts[s] ? counts[s] : 0) + 1;
}
return { op: "baseline_diff", status: "ok", packageGuid: "" + pkg.PackageGUID, baseline: "" + op.baseline,
    summary: counts, raw: xml };
