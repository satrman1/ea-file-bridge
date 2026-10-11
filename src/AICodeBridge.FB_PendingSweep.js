// AICodeBridge.FB_PendingSweep(Repository, pendDir, onlyPath, nowMs)
// EXPIRACE CEKAJICICH DAVEK (balik B1, Z261004b-3; KONCEPCE potvrzovaci okna
// pravidlo 6 bod 4, FB-PU-17 / simulace S5 "zatuchla cekajici davka"). Davka
// starsi nez confirmMaxAgeMin (klic FB_RiskPolicy, chybi = 480 min) se
// NEPROVEDE: dostane E_RISK_EXPIRED, jde do requests\rejected\ a zapise se
// do auditu (confirmedByUser false, channel "expired"). Res soubor prepise
// tato operace sama (je system of record; pri nabidce po startu pumpy ho
// zadny adapter nepise).
// Vola se:
//  - z FB_ConfirmPending PRED overenim nonce (onlyPath = potvrzovana davka) -
//    pokus o potvrzeni/zamitnuti expirovane davky konci E_RISK_EXPIRED;
//  - z pumpy pri startu PRED nabidkou cekajicich davek (onlyPath prazdny;
//    pumpa v0.6 - Z261004b-5 - vysledek jen vypise na konzoli).
// Vraci objekt { maxAgeMin, checked, expired: [ { name, id, since, ageMin,
// response } ], kept: [ { name, id, since, ageMin } ], text }.
// Stari se bere z res.since (cas vzniku zaznamu, P1); kdyz chybi (res ze
// starsi verze), z indexu; kdyz ani tam ne, z DateLastModified souboru;
// bez casu se davka NEexpiruje (jen poznamka) - expirace nesmi mazat davky
// nahodne. Nikdy nevyhazuje.
var self = this;
var now = (typeof nowMs == "number") ? nowMs : new Date().getTime();
var out = { maxAgeMin: 480, checked: 0, expired: [], kept: [], notes: [], text: "" };
var dir = ("" + (pendDir || "")).replace(/[\\\/]+$/, "");
if (dir == "") { out.text = "FB_PendingSweep: chybi pendDir"; return out; }
var fso = null;
try { fso = this.FB_ComObj("Scripting.FileSystemObject"); } catch (eF) { out.text = "FB_PendingSweep: FSO nedostupny"; return out; }
var reqDir = "" + fso.GetParentFolderName(dir);
var baseDir = "" + fso.GetParentFolderName(reqDir);
var resDir = baseDir + "\\responses";
var rejDir = reqDir + "\\rejected";
function pad2(x) { return (x < 10 ? "0" : "") + x; }
function fmt(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
        + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
}
function stamp(d) {
    return "" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "-" + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}
function parseSince(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec("" + s);
    if (!m) { return NaN; }
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6], 10)).getTime();
}
function readText(fp) {
    var st = self.FB_ComObj("ADODB.Stream");
    st.Type = 2; st.Charset = "utf-8"; st.Open();
    st.LoadFromFile(fp);
    var s = "" + st.ReadText(-1);
    st.Close();
    return s.replace(/^﻿/, "");
}
function writeText(fp, text) {
    var stw = self.FB_ComObj("ADODB.Stream");
    stw.Type = 2; stw.Charset = "utf-8"; stw.Open();
    stw.WriteText("" + text);
    stw.SaveToFile(fp, 2);
    stw.Close();
}
function resNameOf(n) { return /^req/i.test(n) ? n.replace(/^req/i, "res") : ("res-" + n); }
// --- limit z politiky (volitelny klic, vzor moveOps) ---
try {
    var pa = this.FB_RiskPolicy();
    var rid = ("" + this.FB_RepoId(Repository)).toUpperCase();
    for (var pi = 0; pi < pa.length; pi++) {
        if (rid.indexOf(("" + pa[pi].repo).toUpperCase()) >= 0) {
            if (typeof pa[pi].confirmMaxAgeMin == "number" && pa[pi].confirmMaxAgeMin > 0) { out.maxAgeMin = pa[pi].confirmMaxAgeMin; }
            break;
        }
    }
} catch (ePol) { }
// --- kandidati: index (overeny proti disku) + pripadne jen jeden soubor ---
var names = [];
var only = ("" + (onlyPath || "")).replace(/^\s+|\s+$/g, "");
var idx = [];
try { idx = this.FB_PendingIndex(Repository, dir, "list") || []; } catch (eIx) { idx = []; }
var sinceIdx = {};
for (var ii = 0; ii < idx.length; ii++) { sinceIdx[idx[ii].name.toLowerCase()] = idx[ii].since || ""; }
if (only != "") {
    var on = "" + fso.GetFileName(only);
    if (fso.FileExists(dir + "\\" + on)) { names.push(on); }
} else {
    for (var ni = 0; ni < idx.length; ni++) { names.push(idx[ni].name); }
}
for (var n = 0; n < names.length; n++) {
    var name = names[n];
    var p = dir + "\\" + name;
    var resPath = resDir + "\\" + resNameOf(name);
    out.checked++;
    var resObj = null;
    try { if (fso.FileExists(resPath)) { resObj = this.FB_JsonParse(readText(resPath)); } } catch (eR) { resObj = null; }
    if (resObj == null || ("" + resObj.status) != "confirm_required") { out.notes.push(name + ": res neni confirm_required - neexpiruje se"); continue; }
    var reqId = "" + (resObj.id || "");
    var since = (resObj.since ? "" + resObj.since : "") || sinceIdx[name.toLowerCase()] || "";
    var sinceMs = parseSince(since);
    if (isNaN(sinceMs)) {
        try { var dlm = fso.GetFile(p).DateLastModified; sinceMs = new Date(dlm).getTime(); since = fmt(new Date(sinceMs)); } catch (eD) { sinceMs = NaN; }
    }
    if (isNaN(sinceMs)) { out.notes.push(name + ": cas vzniku neznamy - neexpiruje se"); out.kept.push({ name: name, id: reqId, since: "", ageMin: -1 }); continue; }
    var ageMin = Math.floor((now - sinceMs) / 60000);
    if (ageMin <= out.maxAgeMin) { out.kept.push({ name: name, id: reqId, since: since, ageMin: ageMin }); continue; }
    // --- expirace: audit + rejected + res + index ---
    var risk = resObj.risk || { riskLevel: "ELEVATED", riskReasons: [], metrics: null, policyValid: false };
    risk.confirm = { required: true, confirmedByUser: false, channel: "expired", timestamp: fmt(new Date(now)), expired: true, since: since, ageMin: ageMin };
    var resp = { protocol: "eafb/0.2", id: reqId, status: "rejected", code: "E_RISK_EXPIRED",
        message: "Cekajici davka vyprsela: ceka od " + since + " (" + ageMin + " min > limit confirmMaxAgeMin " + out.maxAgeMin
            + " min). Nic nebylo provedeno; soubor presunut do rejected\\. Je-li zapis porad potreba, posli davku znovu s NOVYM id (model se mezitim mohl zmenit).",
        since: since, risk: risk, results: [] };
    var summary = "rejected E_RISK_EXPIRED: cekajici davka vyprsela (" + ageMin + " min > " + out.maxAgeMin + " min), nic neprovedeno" + this.FB_RiskNote(risk);
    try {
        var agE = this.FB_Audit(Repository, reqId, summary, readText(p));
        resp.audit = { aiLogGuid: agE };
        this.FB_RiskAuditTags(Repository, agE, risk);
    } catch (eA) { resp.audit = { aiLogGuid: "", warning: "Audit selhal: " + eA.message }; }
    try {
        if (!fso.FolderExists(rejDir)) { fso.CreateFolder(rejDir); }
        fso.MoveFile(p, rejDir + "\\" + name.replace(/\.json$/i, "") + "." + stamp(new Date(now)) + ".json");
    } catch (eM) { resp.message += " (POZOR: presun do rejected\\ selhal: " + eM.message + ")"; }
    var respText = this.FB_JsonStringify(resp, 1);
    try { writeText(resPath, respText); } catch (eW) { }
    try { this.FB_PendingIndex(Repository, dir, "remove", { name: name }); } catch (eIr) { }
    this.Log(Repository, "FB " + reqId + " -> E_RISK_EXPIRED (cekala od " + since + ", " + ageMin + " min)");
    out.expired.push({ name: name, id: reqId, since: since, ageMin: ageMin, response: respText });
}
var lines = [];
for (var e = 0; e < out.expired.length; e++) { lines.push("VYPRSELA " + out.expired[e].name + " (id " + out.expired[e].id + ", cekala od " + out.expired[e].since + ", " + out.expired[e].ageMin + " min) -> rejected\\, audit zapsan"); }
out.text = lines.join("\n");
return out;
