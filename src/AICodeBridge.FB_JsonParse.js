// AICodeBridge.FB_JsonParse(text)
// Bezpecny JSON parse pro stare JScript enginy (EA ani WSH nemaji nativni JSON).
// Crockfordova kontrola (json2 fallback) + eval. Pri nevalidnim vstupu Error "E_PARSE".
var t = ("" + text).replace(/^\uFEFF/, "");
var check = t
    .replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@")
    .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]")
    .replace(/(?:^|:|,)(?:\s*\[)+/g, "");
if (!/^[\],:{}\s]*$/.test(check)) {
    throw new Error("E_PARSE");
}
try {
    return eval("(" + t + ")");
} catch (e) {
    throw new Error("E_PARSE");
}
