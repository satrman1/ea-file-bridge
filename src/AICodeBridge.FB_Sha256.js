// AICodeBridge.FB_Sha256(input)
// Cista JS SHA-256 (FIPS 180-4) - ZADNY COM (iterace 4b, W5; dual runtime
// par. 1a: bezi v JScript ES3 pumpy i v Mozilla JS EA add-inu beze zmen).
// Vstup:
//   - string        -> hashuji se UTF-8 bajty retezce (shadow faze 4b:
//                      payloadHash nad requestText; hash nad surovymi bajty
//                      souboru prijde az se zmenou kontraktu FB_Main ve V2, I5)
//   - pole cisel 0-255 -> hashuji se primo (pripraveno pro V2 raw bytes)
// Vraci hex retezec (64 znaku, lowercase). Overeno proti FIPS vektorum
// ("abc", prazdny retezec) i proti node crypto na nahodnych datech.
var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];
var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
    h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
// --- vstup na UTF-8 bajty ---
var bytes, bi = 0, i;
if (input !== null && typeof input == "object" && Object.prototype.toString.call(input) == "[object Array]") {
    // KOPIE vstupu (V2): padding nize by jinak MUTOVAL volajicimu pole -
    // FB_Main hashuje tytez bajty, ktere pak dekoduje FB_Utf8Decode (I5)
    bytes = input.slice(0);
    bi = bytes.length;
} else {
    var s = "" + input;
    bytes = [];
    for (i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c < 128) { bytes[bi++] = c; }
        else if (c < 2048) { bytes[bi++] = 192 | (c >> 6); bytes[bi++] = 128 | (c & 63); }
        else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length
                 && s.charCodeAt(i + 1) >= 0xDC00 && s.charCodeAt(i + 1) <= 0xDFFF) {
            var cp = 0x10000 + ((c - 0xD800) << 10) + (s.charCodeAt(i + 1) - 0xDC00);
            bytes[bi++] = 240 | (cp >> 18); bytes[bi++] = 128 | ((cp >> 12) & 63);
            bytes[bi++] = 128 | ((cp >> 6) & 63); bytes[bi++] = 128 | (cp & 63);
            i++;
        } else {
            bytes[bi++] = 224 | (c >> 12); bytes[bi++] = 128 | ((c >> 6) & 63); bytes[bi++] = 128 | (c & 63);
        }
    }
}
// --- padding (delka v bitech jako hi/lo 32bit slova) ---
var byteLen = bi;
var loBits = (byteLen << 3) & 0xffffffff;
var hiBits = 0;
// Math.floor misto bitovych operaci - byteLen*8 muze prelezt 32 bitu
hiBits = Math.floor(byteLen / 536870912); // 2^29 bajtu = 2^32 bitu
bytes[bi++] = 0x80;
while ((bi % 64) != 56) { bytes[bi++] = 0; }
bytes[bi++] = (hiBits >> 24) & 255; bytes[bi++] = (hiBits >> 16) & 255;
bytes[bi++] = (hiBits >> 8) & 255;  bytes[bi++] = hiBits & 255;
bytes[bi++] = (loBits >>> 24) & 255; bytes[bi++] = (loBits >> 16) & 255;
bytes[bi++] = (loBits >> 8) & 255;   bytes[bi++] = loBits & 255;
// --- bloky po 64 bajtech ---
var W = new Array(64);
var off, t, a, b, cc, d, e, f, g, hh, s0, s1, T1, T2;
for (off = 0; off < bi; off += 64) {
    for (t = 0; t < 16; t++) {
        var o4 = off + t * 4;
        W[t] = ((bytes[o4] << 24) | (bytes[o4 + 1] << 16) | (bytes[o4 + 2] << 8) | bytes[o4 + 3]) | 0;
    }
    for (t = 16; t < 64; t++) {
        var w15 = W[t - 15], w2 = W[t - 2];
        s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
        s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
        W[t] = ((((W[t - 16] + s0) | 0) + W[t - 7]) | 0) + s1 | 0;
    }
    a = h0; b = h1; cc = h2; d = h3; e = h4; f = h5; g = h6; hh = h7;
    for (t = 0; t < 64; t++) {
        s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        T1 = (((hh + s1) | 0) + ((ch + K[t]) | 0) + W[t]) | 0;
        s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var maj = (a & b) ^ (a & cc) ^ (b & cc);
        T2 = (s0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + T1) | 0;
        d = cc; cc = b; b = a; a = (T1 + T2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + cc) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + hh) | 0;
}
// --- hex vystup ---
function hex8(x) {
    var hx = "0123456789abcdef", out = "", k;
    for (k = 28; k >= 0; k -= 4) { out += hx.charAt((x >>> k) & 15); }
    return out;
}
return hex8(h0) + hex8(h1) + hex8(h2) + hex8(h3) + hex8(h4) + hex8(h5) + hex8(h6) + hex8(h7);
