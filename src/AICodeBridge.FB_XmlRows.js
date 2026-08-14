// AICodeBridge.FB_XmlRows(xml)
// Prevod XML vysledku Repository.SQLQuery na pole radku (objekt sloupec -> hodnota).
function unent(s) {
    return ("" + s)
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
var rows = [];
var rowRe = /<Row>([\s\S]*?)<\/Row>/g;
var m;
var src = "" + xml;
while ((m = rowRe.exec(src)) != null) {
    var row = {};
    var colRe = /<([A-Za-z_][A-Za-z0-9_]*)>([\s\S]*?)<\/\1>/g;
    var c;
    while ((c = colRe.exec(m[1])) != null) {
        row[c[1]] = unent(c[2]);
    }
    rows.push(row);
}
return rows;
