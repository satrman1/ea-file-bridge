// AICodeBridge.FB_FileBytes(path)
// Precte soubor JEDNIM binarnim ctenim a vrati pole bajtu (0-255),
// NEBO null v EA runtime (viz nize) - volajici pak pouzije textove cteni.
// Zaklad kontraktu I5 (iterace 4b V2, zadani v1.1 par. 3.2): SHA-256 payloadu
// i JSON parse vychazeji z TYCHZ bajtu jedineho cteni - zadna re-serializace
// (CRLF/BOM pasti), zadne mikro-TOCTOU okno mezi hashem a parsem.
// COM vyhradne pres FB_ComObj (dual runtime par. 1a - zadny primy
// ActiveXObject). Prevod VARIANT bajtu -> JS pole: MSXML bin.base64
// (nativni, rychle), base64 dekodovani ciste v JS (ES3, lookup mapa).
//
// !! LEKCE 2026-08-19 (T5-10, dual runtime par. 1a bod 4): v EA runtime
// (Mozilla JS) hazi prirazeni node.nodeTypedValue = <VARIANT bajty> COM
// chybu "Nesoulad typu", kterou try/catch NEZACHYTI - shodi cely handler
// ("Invocation error in: addin.EA_MenuClick", u uzivatele "klik nic
// neudelal"). Binarni cesta se proto pousti JEN v JScript runtime (pumpa,
// ActiveXObject existuje); v EA runtime vracime null a volajici (FB_Main,
// FB_ConfirmPending) ctou soubor textove utf-8 - hash textu je pro UTF-8
// soubory bez BOM identicky s hashem surovych bajtu (overeno v0.7).
var hasAX = false;
try { hasAX = (typeof ActiveXObject != "undefined"); } catch (eAX) { hasAX = false; }
if (!hasAX) { return null; }
var st = this.FB_ComObj("ADODB.Stream");
st.Type = 1; // binarni
st.Open();
st.LoadFromFile("" + path);
var size = st.Size;
var bin = null;
if (size > 0) { bin = st.Read(-1); }
st.Close();
if (bin === null || typeof bin == "undefined") { return []; }
var xml = this.FB_ComObj("MSXML2.DOMDocument");
var node = xml.createElement("b");
node.dataType = "bin.base64";
node.nodeTypedValue = bin;
var b64 = ("" + node.text).replace(/[^A-Za-z0-9+\/=]/g, "");
var ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var MAP = {};
var k;
for (k = 0; k < 64; k++) { MAP[ABC.charAt(k)] = k; }
MAP["="] = 64;
var bytes = [], bi = 0, i = 0, n = b64.length;
while (i + 3 < n) {
    var e1 = MAP[b64.charAt(i++)];
    var e2 = MAP[b64.charAt(i++)];
    var e3 = MAP[b64.charAt(i++)];
    var e4 = MAP[b64.charAt(i++)];
    bytes[bi++] = ((e1 << 2) | (e2 >> 4)) & 255;
    if (e3 != 64) { bytes[bi++] = (((e2 & 15) << 4) | (e3 >> 2)) & 255; }
    if (e4 != 64) { bytes[bi++] = (((e3 & 3) << 6) | e4) & 255; }
}
return bytes;
