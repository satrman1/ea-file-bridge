// AICodeBridge.FB_PendingIndex(Repository, pendDir, action, entry)
// INDEX CEKAJICICH DAVEK (balik B1, Z261004b-3; KONCEPCE potvrzovaci okna
// pravidlo 6 body 1-2 + FB-PU-16/-17). Maly textovy soubor
// <pendDir>\.index.txt (radek = name|hash|id|since) vedle cekajicich davek.
// Proc soubor a ne vypis slozky: EA runtime (Mozilla JS) nema Enumerator ani
// jine iterovani COM kolekce - FB_ProcessFolder to resi "dir /b" pres
// WScript.Shell, co je pro kazdou davku zbytecne drahe. Index je levny
// v obou runtime (par. 1a) a overuje se proti disku: polozka, jejiz soubor
// v pendDir uz nelezi, se pri cteni tise zahodi (pravda je slozka, index je
// jen urychlovac). Pumpa i GUI fallback berou z pending\ jen *.json, tecka
// soubor je pro ne neviditelny.
//   action "list"              -> pole polozek { name, hash, id, since }
//   action "add",    entry     -> prida/prepise polozku dle name, vrati pole
//   action "remove", entry     -> odebere polozku dle name, vrati pole
//   action "find",   entry     -> polozka s entry.hash (jiny name) nebo null
// Best-effort: chyba cteni = prazdny index, chyba zapisu se polyka (index
// nikdy nesmi shodit davku). COM vyhradne pres FB_ComObj.
var self = this;
var dir = ("" + (pendDir || "")).replace(/[\\\/]+$/, "");
var out = [];
if (dir == "") { return (action == "find") ? null : out; }
var idxPath = dir + "\\.index.txt";
var fso = null;
try { fso = this.FB_ComObj("Scripting.FileSystemObject"); } catch (eF) { return (action == "find") ? null : out; }
function readAll() {
    var list = [];
    try {
        if (!fso.FileExists(idxPath)) { return list; }
        var st = self.FB_ComObj("ADODB.Stream");
        st.Type = 2; st.Charset = "utf-8"; st.Open();
        st.LoadFromFile(idxPath);
        var t = ("" + st.ReadText(-1)).replace(/^﻿/, "");
        st.Close();
        var lines = t.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
            var ln = lines[i].replace(/^\s+|\s+$/g, "");
            if (ln == "") { continue; }
            var p = ln.split("|");
            if (p.length < 2 || p[0] == "") { continue; }
            // pravda je slozka: soubor, ktery v pending\ uz neni, z indexu vypadne
            try { if (!fso.FileExists(dir + "\\" + p[0])) { continue; } } catch (eX) { continue; }
            list.push({ name: p[0], hash: p[1] || "", id: p[2] || "", since: p[3] || "" });
        }
    } catch (eR) { list = []; }
    return list;
}
function writeAll(list) {
    var lines = [];
    for (var i = 0; i < list.length; i++) {
        lines.push(list[i].name + "|" + (list[i].hash || "") + "|" + (list[i].id || "") + "|" + (list[i].since || ""));
    }
    try {
        if (!fso.FolderExists(dir)) { fso.CreateFolder(dir); }
        if (lines.length == 0) { if (fso.FileExists(idxPath)) { fso.DeleteFile(idxPath); } return; }
        var stw = self.FB_ComObj("ADODB.Stream");
        stw.Type = 2; stw.Charset = "utf-8"; stw.Open();
        stw.WriteText(lines.join("\r\n") + "\r\n");
        stw.SaveToFile(idxPath, 2);
        stw.Close();
    } catch (eW) { }
}
out = readAll();
var act = ("" + (action || "list")).toLowerCase();
var nm = (entry && entry.name) ? ("" + entry.name) : "";
if (act == "add" && nm != "") {
    var kept = [];
    for (var a = 0; a < out.length; a++) { if (out[a].name.toLowerCase() != nm.toLowerCase()) { kept.push(out[a]); } }
    kept.push({ name: nm, hash: "" + (entry.hash || ""), id: "" + (entry.id || ""), since: "" + (entry.since || "") });
    out = kept;
    writeAll(out);
    return out;
}
if (act == "remove" && nm != "") {
    var rest = [];
    for (var r = 0; r < out.length; r++) { if (out[r].name.toLowerCase() != nm.toLowerCase()) { rest.push(out[r]); } }
    out = rest;
    writeAll(out);
    return out;
}
if (act == "find") {
    var h = (entry && entry.hash) ? ("" + entry.hash) : "";
    if (h == "") { return null; }
    for (var f = 0; f < out.length; f++) {
        if (out[f].hash == h && out[f].name.toLowerCase() != nm.toLowerCase()) { return out[f]; }
    }
    return null;
}
return out;
