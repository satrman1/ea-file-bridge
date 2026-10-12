// AICodeBridge.FB_PumpAlive(Repository, baseDir, nowMs)
// BEZI PUMPA? (FB-PU-07, pumpa v0.6, Z261004b-5). Schranka (FB_ClipboardImport)
// a GUI fallback (FB_ProcessFolder) nesmi zpracovavat davky nad touz slozkou,
// nad kterou bezi pumpa (zavod o res a pending\). Pozna se to z TEPU ve
// stavovem souboru responses\pump-status.json, NE pokusem otevrit zamek
// pumpy: chyba COM pri otevreni drzeneho souboru v EA runtime muze obejit
// try/catch a shodit cely handler (PROTOKOL-EAFB.md kap. 1a).
// Stavovy soubor pise pumpa v0.6: { pump{version,fingerprint,path,started},
// phase (idle|waiting_ea|processing|waiting_confirm|stopped), file, since,
// heartbeat, aliveUntil, ... }. aliveUntil = cas, do kdy se pumpa zarucene
// ozve (idle: tep + 30 s; processing: od prevzeti + 30 min - FB_Main bezi
// v jednom vlakne a tep neobnovuje; waiting_confirm: od otevreni okna +
// timeout okna + 30 s). Pumpa po tomto case = nebezi (zavrene okno, pad).
// Vraci { running, known, phase, file, since, heartbeat, aliveUntil,
// version, pumpPath, text }. known false = stavovy soubor neni (pumpa v0.5
// a starsi ho nepise - pak se o soubehu nic nevi, text to rekne).
var self = this;
var out = { running: false, known: false, phase: "", file: "", since: "", heartbeat: "", aliveUntil: "", version: "", pumpPath: "", text: "" };
var now = (typeof nowMs == "number") ? nowMs : new Date().getTime();
var base = "" + (baseDir || "");
if (base == "") { try { base = "" + this.FB_ResolveBaseDir(Repository); } catch (eB) { base = ""; } }
if (base == "") { out.text = "Pumpa: slozku vymeny nelze urcit"; return out; }
var p = base.replace(/[\\\/]+$/, "") + "\\responses\\pump-status.json";
var fso = null;
try { fso = this.FB_ComObj("Scripting.FileSystemObject"); } catch (eF) { out.text = "Pumpa: FSO nedostupny"; return out; }
if (!fso.FileExists(p)) { out.text = "Pumpa: stavovy soubor responses\\pump-status.json neni (pumpa v0.6 nebezela nebo bezi starsi pumpa bez stavu)"; return out; }
var st = null;
try {
    var s = this.FB_ComObj("ADODB.Stream");
    s.Type = 2; s.Charset = "utf-8"; s.Open();
    s.LoadFromFile(p);
    var tx = ("" + s.ReadText(-1)).replace(/^﻿/, "");
    s.Close();
    st = this.FB_JsonParse(tx);
} catch (eR) { out.text = "Pumpa: stavovy soubor nejde precist (" + eR.message + ")"; return out; }
if (st == null) { out.text = "Pumpa: stavovy soubor je prazdny"; return out; }
out.known = true;
out.phase = "" + (st.phase || "");
out.file = "" + (st.file || "");
out.since = "" + (st.since || "");
out.heartbeat = "" + (st.heartbeat || "");
out.aliveUntil = "" + (st.aliveUntil || "");
try { out.version = "" + ((st.pump && st.pump.version) || ""); out.pumpPath = "" + ((st.pump && st.pump.path) || ""); } catch (eP) { }
function parseTs(x) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec("" + x);
    if (!m) { return NaN; }
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6], 10)).getTime();
}
var until = parseTs(out.aliveUntil);
if (out.phase == "stopped") { out.running = false; }
else if (isNaN(until)) { out.running = false; }
else { out.running = (now <= until); }
if (out.running) {
    out.text = "BEZI PUMPA " + (out.version || "") + " (" + out.pumpPath + ") - faze " + out.phase + (out.file ? " " + out.file : "") + " od " + out.since
        + ". Davky zpracovava pumpa: poloz req-*.json do requests\\, nebo pumpu zavri a klikni znovu.";
} else {
    out.text = "Pumpa nebezi (posledni tep " + (out.heartbeat || "?") + ", faze " + (out.phase || "?") + ").";
}
return out;
