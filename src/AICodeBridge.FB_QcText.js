// AICodeBridge.FB_QcText(qc)
// VYSLEDEK KONTROLY KVALITY SLOVY (vzor FB-UI-11, Z261004b-12): jedna veta
// pro cloveka z resp.qc (FB_QcRun: ciste | nalez | nedobehlo | bez_kontrol).
// Pouziva FB_Main (radek v Output tabu za blokem zmen), FB_AuditText (veta
// v auditu), FB_ClipboardImport a FB_ProcessFolder (veta nad ACK v dialogu).
// Chat ACK (FB_ChatRender.qcLine) se NEMENI - model cte ACK, tohle cte clovek.
// Vraci { line, samples[] }: line = veta; samples = radky prvku z nalezu
// (max 3 na kontrolu) s navId pro marker (el:ID) v Outputu, jinak prazdne.
// Texty bez diakritiky (spike S1 nerozhodnut). qc == null -> line "".
var out = { line: "", samples: [] };
if (qc === null || typeof qc == "undefined") { return out; }
function pl(n, one, few, many) { return n + " " + (n == 1 ? one : ((n >= 2 && n <= 4) ? few : many)); }
var s = "" + qc.status;
var checks = (typeof qc.checks == "number") ? qc.checks : 0;
if (s == "ciste") {
    out.line = "Kontrola kvality: ciste (" + pl(checks, "kontrola", "kontroly", "kontrol") + ", bez nalezu).";
    return out;
}
if (s == "nalez") {
    var fnd = qc.findings || [], parts = [];
    for (var i = 0; i < fnd.length; i++) {
        var f = fnd[i] || {};
        var desc = ("" + (f.desc || "")).replace(/\s+$/, "");
        var cnt = (typeof f.count == "number") ? f.count : parseInt(f.count, 10);
        if (isNaN(cnt)) { cnt = 0; }
        parts.push((desc != "" ? desc : ("kontrola " + f.id)) + " (" + (desc != "" ? f.id + ", " : "") + cnt + "x)");
        var smp = f.sample || [];
        for (var k = 0; k < smp.length && k < 3; k++) {
            var row = smp[k] || {};
            var nm = row.Name || row.name || row.NAME || "";
            var oid = parseInt(row.Object_ID || row.ObjectID || row.OBJECT_ID || row.object_id || 0, 10);
            if (isNaN(oid)) { oid = 0; }
            if (("" + nm) == "" && oid == 0) { continue; }
            out.samples.push({ text: "    - " + (("" + nm) != "" ? "\"" + nm + "\"" : "(bez jmena)") + (oid > 0 ? "  (el:" + oid + ")" : ""), navId: oid, checkId: "" + f.id });
        }
    }
    out.line = "Kontrola kvality: NALEZ - " + parts.join("; ")
        + ". Zapis probehl; kontrola hlida cele dotcene balicky, nalez nemusi pochazet z teto davky.";
    return out;
}
if (s == "bez_kontrol") {
    out.line = "Kontrola kvality: bez kontrol - " + ("" + (qc.reason || "pro tuto zmenu neni zadna kontrola definovana")) + ".";
    return out;
}
// nedobehlo (a jakykoli neznamy stav): skutecne selhani behu QC - zapis tim NENI dotcen
out.line = "Kontrola kvality neprobehla: " + ("" + (qc.reason || "neznamy duvod")) + " - zapis tim neni dotcen.";
return out;
