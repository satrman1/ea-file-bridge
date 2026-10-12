// AICodeBridge.FB_JsonParse(text)
// Bezpecny JSON parse pro stare JScript enginy (EA ani WSH nemaji nativni JSON).
// Crockfordova kontrola (json2 fallback) + eval. Pri nevalidnim vstupu Error
// "E_PARSE: <co> u znaku N: <40 znaku okoli>".
// FB-PU-12 (Z261004b-6): pred evalem bezi vlastni pruchod JSONem, ktery
// (a) odmitne CARKU NAVIC pred ] nebo } - WSH JScript ji u pole tise bere
//     jako dalsi prazdny prvek (ops: [{...},] -> operace "?", ELEVATED okno),
//     engine EA ji odmitne; obe cesty musi dat tutez chybu;
// (b) u kazde chyby rekne POZICI (index znaku od 1, radek:sloupec) a 40 znaku
//     okoli, aby agent vedel, co opravit. Pruchod nic nestavi - jen overuje
//     tvar; objekt porad sklada eval nad puvodnim textem (zadna zmena hodnot).
var t = ("" + text).replace(/^﻿/, "");
var n = t.length;
var i = 0;
function ctxAt(pos) {
    var a = pos - 20; if (a < 0) { a = 0; }
    var b = pos + 20; if (b > n) { b = n; }
    return t.substring(a, b).replace(/[\r\n\t]/g, " ");
}
function lineCol(pos) {
    var ln = 1, col = 1;
    for (var k = 0; k < pos && k < n; k++) { if (t.charAt(k) == "\n") { ln++; col = 1; } else { col++; } }
    return ln + ":" + col;
}
function fail(what, pos) {
    if (typeof pos != "number") { pos = i; }
    if (pos > n) { pos = n; }
    throw new Error("E_PARSE: " + what + " u znaku " + (pos + 1) + " (radek:sloupec " + lineCol(pos) + "): \"" + ctxAt(pos) + "\"");
}
function ws() { while (i < n && /[ \t\r\n]/.test(t.charAt(i))) { i++; } }
function parseString() {
    // i stoji na uvozovce
    var start = i;
    i++;
    while (i < n) {
        var c = t.charAt(i);
        if (c == "\\") {
            i++;
            if (i >= n) { fail("neukonceny escape v retezci", start); }
            var e = t.charAt(i);
            if (e == "u") {
                if (!/^[0-9a-fA-F]{4}$/.test(t.substr(i + 1, 4))) { fail("neplatny \\u escape", i); }
                i += 4;
            } else if ("\"\\/bfnrt".indexOf(e) < 0) { fail("neplatny escape \\" + e + " v retezci", i); }
            i++;
            continue;
        }
        if (c == "\"") { i++; return; }
        if (c == "\n" || c == "\r") { fail("neukonceny retezec (konec radku uvnitr uvozovek)", start); }
        i++;
    }
    fail("neukonceny retezec", start);
}
function parseValue(depth) {
    if (depth > 200) { fail("prilis hluboke vnoreni"); }
    ws();
    if (i >= n) { fail("neocekavany konec vstupu (chybi hodnota)"); }
    var c = t.charAt(i);
    if (c == "{") {
        i++; ws();
        if (t.charAt(i) == "}") { i++; return; }
        while (true) {
            ws();
            if (t.charAt(i) == "}") { fail("carka navic pred }"); }
            if (t.charAt(i) != "\"") { fail("ocekavan nazev pole v uvozovkach"); }
            parseString();
            ws();
            if (t.charAt(i) != ":") { fail("ocekavana dvojtecka za nazvem pole"); }
            i++;
            parseValue(depth + 1);
            ws();
            if (t.charAt(i) == ",") { i++; continue; }
            if (t.charAt(i) == "}") { i++; return; }
            if (i >= n) { fail("neocekavany konec vstupu (chybi })"); }
            fail("ocekavana carka nebo } za hodnotou pole");
        }
    }
    if (c == "[") {
        i++; ws();
        if (t.charAt(i) == "]") { i++; return; }
        while (true) {
            ws();
            if (t.charAt(i) == "]") { fail("carka navic pred ]"); }
            parseValue(depth + 1);
            ws();
            if (t.charAt(i) == ",") { i++; continue; }
            if (t.charAt(i) == "]") { i++; return; }
            if (i >= n) { fail("neocekavany konec vstupu (chybi ])"); }
            fail("ocekavana carka nebo ] za prvkem pole");
        }
    }
    if (c == "\"") { parseString(); return; }
    if (t.substr(i, 4) == "true") { i += 4; return; }
    if (t.substr(i, 5) == "false") { i += 5; return; }
    if (t.substr(i, 4) == "null") { i += 4; return; }
    var m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+\-]?\d+)?/.exec(t.substring(i, i + 40));
    if (m) { i += m[0].length; return; }
    if (c == "'") { fail("retezec v apostrofech - JSON vyzaduje uvozovky"); }
    fail("neocekavany znak '" + c + "'");
}
parseValue(0);
ws();
if (i < n) { fail("text za koncem JSON hodnoty"); }
// Crockfordova kontrola jako druha pojistka pred evalem (json2 fallback)
var check = t
    .replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@")
    .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]")
    .replace(/(?:^|:|,)(?:\s*\[)+/g, "");
if (!/^[\],:{}\s]*$/.test(check)) {
    throw new Error("E_PARSE: text neprosel kontrolou tvaru JSON (nepovolene znaky mimo retezce)");
}
try {
    return eval("(" + t + ")");
} catch (e) {
    throw new Error("E_PARSE: " + e.message);
}
