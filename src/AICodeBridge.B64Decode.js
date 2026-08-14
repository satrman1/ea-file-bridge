// AICodeBridge.B64Decode(s) - base64 -> text (EA JS engine nema atob)
var ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
var input = ("" + s).replace(/[^A-Za-z0-9+\/=]/g, "");
var out = "";
var i = 0;
while (i < input.length) {
    var e1 = ABC.indexOf(input.charAt(i++));
    var e2 = ABC.indexOf(input.charAt(i++));
    var e3 = ABC.indexOf(input.charAt(i++));
    var e4 = ABC.indexOf(input.charAt(i++));
    var c1 = (e1 << 2) | (e2 >> 4);
    var c2 = ((e2 & 15) << 4) | (e3 >> 2);
    var c3 = ((e3 & 3) << 6) | e4;
    out = out + String.fromCharCode(c1);
    if (e3 != 64) {
        out = out + String.fromCharCode(c2);
    }
    if (e4 != 64) {
        out = out + String.fromCharCode(c3);
    }
}
// UTF-8 dekodovani (diakritika v komentarich)
try {
    out = decodeURIComponent(escape(out));
} catch (e) {
    // ponechat raw pri nevalidni UTF-8 sekvenci
}
return out;
