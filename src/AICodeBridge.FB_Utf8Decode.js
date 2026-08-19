// AICodeBridge.FB_Utf8Decode(bytes)
// UTF-8 bajty (pole 0-255) -> JS retezec. Preskakuje uvodni BOM (EF BB BF).
// Soucast kontraktu I5 (iterace 4b V2): parse requestu z tychz bajtu jako
// hash. Nevalidni sekvence se tolerantne prevezme jako 1 bajt = 1 znak
// (nevalidni JSON pak stejne spadne na E_PARSE).
// Vykon: String.fromCharCode.apply po blocich (ES3; konkatenace po znaku
// je v JScriptu O(n^2)).
var codes = [], parts = [], i = 0, n = bytes.length;
if (n >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF) { i = 3; }
function flush() {
    if (codes.length > 0) {
        parts.push(String.fromCharCode.apply(null, codes));
        codes = [];
    }
}
while (i < n) {
    var b = bytes[i];
    if (b < 0x80) {
        codes.push(b); i++;
    } else if (b >= 0xC0 && b < 0xE0 && i + 1 < n) {
        codes.push(((b & 31) << 6) | (bytes[i + 1] & 63)); i += 2;
    } else if (b >= 0xE0 && b < 0xF0 && i + 2 < n) {
        codes.push(((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3;
    } else if (b >= 0xF0 && i + 3 < n) {
        var cp = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63);
        cp -= 0x10000;
        codes.push(0xD800 + ((cp >> 10) & 1023));
        codes.push(0xDC00 + (cp & 1023));
        i += 4;
    } else {
        codes.push(b); i++; // nevalidni sekvence - tolerantni fallback
    }
    if (codes.length >= 8192) { flush(); }
}
flush();
return parts.join("");
