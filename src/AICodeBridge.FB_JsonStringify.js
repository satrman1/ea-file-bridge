// AICodeBridge.FB_JsonStringify(v, indent)
// Vlastni JSON stringify (stare enginy nemaji nativni JSON). Funkce preskakuje.
// indent (v0.13, nalez N4 E2E VS Code 2026-09-07): pocet mezer na uroven
// odsazeni; 0 / nevyplneno = kompaktni jeden radek (dosavadni chovani).
// Odsazeny tvar = jen odradkovani + uvodni mezery. ZA DVOJTECKOU NIKDY
// MEZERA ('"key":value'), protoze pumpa, FB_ConfirmPending, FB_ProcessFolder
// i FB_ClipboardImport hledaji v res textu doslovne '"code":"E_PARSE"',
// '"status":"confirm_required"', '"reloadCode":true'. Obsah je totozny
// s kompaktnim tvarem (parse obou da stejny objekt).
var ind = 0;
if (typeof indent == "number" && isFinite(indent) && indent > 0) { ind = Math.floor(indent); }
var pad = "";
for (var pi = 0; pi < ind; pi++) { pad += " "; }
function esc(s) {
    s = "" + s;
    var out = "";
    for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i), n = s.charCodeAt(i);
        if (c == '"') { out += '\\"'; }
        else if (c == "\\") { out += "\\\\"; }
        else if (n == 10) { out += "\\n"; }
        else if (n == 13) { out += "\\r"; }
        else if (n == 9) { out += "\\t"; }
        else if (n < 32) { out += "\\u" + ("000" + n.toString(16)).slice(-4); }
        else { out += c; }
    }
    return '"' + out + '"';
}
function nl(level) {
    if (ind == 0) { return ""; }
    var s = "\n";
    for (var k = 0; k < level; k++) { s += pad; }
    return s;
}
function str(v, level) {
    if (v === null || typeof v == "undefined") { return "null"; }
    var t = typeof v;
    if (t == "number") { return isFinite(v) ? "" + v : "null"; }
    if (t == "boolean") { return v ? "true" : "false"; }
    if (t == "string") { return esc(v); }
    if (Object.prototype.toString.call(v) == "[object Array]") {
        if (v.length == 0) { return "[]"; }
        var parts = [];
        for (var i = 0; i < v.length; i++) { parts.push(nl(level + 1) + str(v[i], level + 1)); }
        return "[" + parts.join(",") + nl(level) + "]";
    }
    var kv = [];
    for (var k in v) {
        if (typeof v[k] == "function") { continue; }
        kv.push(nl(level + 1) + esc(k) + ":" + str(v[k], level + 1));
    }
    if (kv.length == 0) { return "{}"; }
    return "{" + kv.join(",") + nl(level) + "}";
}
return str(v, 0);
