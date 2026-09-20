// AICodeBridge.FB_XmlUnescape(s)
// Prevod XML entit na znaky pro hodnoty ATRIBUTU z Project.GetBaselines
// (jmeno baseline = atribut `version`). Bez toho se jmeno s & " < > z XML
// nikdy neshodne se jmenem z SQL (t_document.Version je raw) - nalez L3
// oponentury Baseline politiky 2026-09-20.
return ("" + (s === null || typeof s == "undefined" ? "" : s))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
