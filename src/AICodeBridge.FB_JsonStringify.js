// AICodeBridge.FB_JsonStringify(v)
// Vlastni JSON stringify (stare enginy nemaji nativni JSON). Funkce preskakuje.
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
function str(v) {
    if (v === null || typeof v == "undefined") { return "null"; }
    var t = typeof v;
    if (t == "number") { return isFinite(v) ? "" + v : "null"; }
    if (t == "boolean") { return v ? "true" : "false"; }
    if (t == "string") { return esc(v); }
    if (Object.prototype.toString.call(v) == "[object Array]") {
        var parts = [];
        for (var i = 0; i < v.length; i++) { parts.push(str(v[i])); }
        return "[" + parts.join(",") + "]";
    }
    var kv = [];
    for (var k in v) {
        if (typeof v[k] == "function") { continue; }
        kv.push(esc(k) + ":" + str(v[k]));
    }
    return "{" + kv.join(",") + "}";
}
return str(v);
