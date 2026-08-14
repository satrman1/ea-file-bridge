// AICodeBridge.B64Encode(s) - text -> base64 (EA JS engine nema btoa)
var ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var input = "" + s;
// UTF-8 zakodovani (diakritika v komentarich)
try {
    input = unescape(encodeURIComponent(input));
} catch (e) {
    // ponechat raw
}
var out = "";
var i = 0;
while (i < input.length) {
    var c1 = input.charCodeAt(i++);
    var c2 = input.charCodeAt(i++);
    var c3 = input.charCodeAt(i++);
    var e1 = c1 >> 2;
    var e2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : (c2 >> 4));
    var e3 = isNaN(c2) ? 64 : (((c2 & 15) << 2) | (isNaN(c3) ? 0 : (c3 >> 6)));
    var e4 = isNaN(c3) ? 64 : (c3 & 63);
    out = out + ABC.charAt(e1)
        + ABC.charAt(e2)
        + (e3 == 64 ? "=" : ABC.charAt(e3))
        + (e4 == 64 ? "=" : ABC.charAt(e4));
}
return out;
