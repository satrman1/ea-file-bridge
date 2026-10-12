// AICodeBridge.FB_CodeFingerprint(files)
// OTISK NASAZENEHO KODU (FB-PU-02, balik D pumpa v0.6, Z261004b-5).
// Proc otisk a ne verze/VERSION soubor: bootstrap v bance nema git a kod
// v modelu neni nutne stav tagu (doma deploy_src kazdy den, v bance stav,
// ktery privezl kuryr). Konfigurace se doma a v bance lisi, proto se
// hashuji JEN ne-konfiguracni soubory src\ - stejny kod da doma i v bance
// stejny otisk. Otisk spocita bootstrap i deploy_src ze souboru, ktere
// prave nalevaji do modelu, a zapisou ho jako tagged values prvku
// AICodeBridge (fb.code.fingerprint, fb.code.files, fb.code.deployedAt,
// fb.code.deployedBy). Cte ho FB_CodeInfo (ping, About, start session).
// Stejny algoritmus ma tools\code-fingerprint.py (spravce: otisk pracovni
// kopie vs. otisk v modelu z pingu).
// Algoritmus (menit jen spolu s tools\code-fingerprint.py):
//   1. soubor -> jmeno operace (AICodeBridge.<Op>.js -> <Op>); konfiguracni
//      operace CONFIG_OPS se vynechaji;
//   2. text: bez BOM, CRLF/CR -> LF, bile znaky na konci souboru pryc + "\n";
//   3. serazeno podle jmena operace (ASCII), zretezeno "<Op>\n<text>\n";
//   4. sha256 UTF-8 bajtu (FB_Sha256), hex lowercase; short = prvnich 12.
// files = pole { name, text }. Vraci { fingerprint, short, files, excluded[] }.
var CONFIG_OPS = { FB_Config: 1, FB_WriteScope: 1, FB_OpsAllowed: 1, FB_RiskPolicy: 1, FB_AccessGroups: 1, FB_QcConfig: 1, FB_ScaffoldConfig: 1 };
var list = [], excluded = [];
for (var i = 0; i < (files || []).length; i++) {
    var f = files[i];
    if (!f || typeof f.name == "undefined") { continue; }
    var nm = "" + f.name;
    var mm = /^(?:AICodeBridge\.)?([A-Za-z0-9_]+?)(?:\.js)?$/.exec(nm);
    if (!mm) { continue; }
    var op = mm[1];
    if (CONFIG_OPS[op] === 1) { excluded.push(op); continue; }
    var tx = ("" + (f.text == null ? "" : f.text)).replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\s+$/, "") + "\n";
    list.push({ op: op, text: tx });
}
list.sort(function (a, b) { return (a.op < b.op) ? -1 : ((a.op > b.op) ? 1 : 0); });
var parts = [];
for (var j = 0; j < list.length; j++) { parts.push(list[j].op + "\n" + list[j].text + "\n"); }
var hex = "" + this.FB_Sha256(parts.join(""));
excluded.sort();
return { fingerprint: hex, short: hex.substring(0, 12), files: list.length, excluded: excluded };
