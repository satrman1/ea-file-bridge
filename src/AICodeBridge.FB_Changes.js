// AICodeBridge.FB_Changes(Repository, SearchText, XMLResults)
// Add-in Search "FB_Changes" (iterace 5, B-V2): dotcene prvky zapisove davky
// jako vysledkova sada ve Find in Project. Dvojklik na radek = NATIVNI
// navigace EA v Project browseru (konvence CLASSGUID/CLASSTYPE, vzor
// ea-sql-expert) - zadne ShowInProjectView z add-inu (past par. 1a/4).
// SearchText = id davky (napr. "20260821-04"); PRAZDNY = posledni zapisova
// davka teto session (in-memory this._fbLastWriteReqId, nastavuje FB_Main;
// zanika restartem EA - pak zadej id rucne).
// Zdroj dat: razitka ai.request na zapsanych prvcich (t_objectproperties,
// jen standardni sloupce, zadne dialektove funkce - lekce par. 6a/3).
// Audit Artifacty "FB <id>" z #AI-LOG se vynechavaji (nejsou zmeny modelu).
// Smazane prvky tu z principu nejsou (razitko zaniklo s prvkem) - mazani
// dokumentuje Output log (FB_LogChanges zachyti jmeno+cestu pred smazanim).
// Jednorazova definice hledani (jako FB_Process, lekce T4-0a): Find in
// Project -> New Search, Group Type = Search, "Add-in Name and method" =
// AICodeBridge.FB_Changes (separator TECKA, ne lomitko).
// Vysledek: XMLResults.val = ReportViewData XML, navrat "T" (vzor vendor
// MyDemoAddin.CustomSearch).
var self = this;
function esc(s) { return ("" + s).replace(/'/g, "''"); }
function xEsc(s) {
    return ("" + s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var FIELDS = ["CLASSGUID", "CLASSTYPE", "Nazev", "Typ", "Cesta", "Davka"];
function infoRow(msg) {
    return { CLASSGUID: "", CLASSTYPE: "", Nazev: msg, Typ: "", Cesta: "", Davka: "" };
}
var reqId = ("" + (SearchText || "")).replace(/^\s+|\s+$/g, "");
if (reqId == "") { reqId = "" + (this._fbLastWriteReqId || ""); }
if (reqId == "") {
    // par. 1a/5: v EA runtime in-memory hodnota neprezije invokaci -> state soubor
    try { reqId = "" + this.FB_StateFile(Repository, "lastwrite"); } catch (eSf) { reqId = ""; }
}
var rowsOut = [];
if (reqId == "") {
    rowsOut.push(infoRow("Zadna zapisova davka v teto session - zadej id davky jako hledany text (napr. 20260821-04)"));
} else {
    var rr = [];
    try {
        rr = this.FB_XmlRows(Repository.SQLQuery(
            "SELECT o.Object_ID, o.ea_guid, o.Name, o.Object_Type, o.Stereotype FROM t_object o"
            + " INNER JOIN t_objectproperties p ON p.Object_ID = o.Object_ID"
            + " WHERE p.Property = 'ai.request' AND p.Value = '" + esc(reqId) + "'"));
    } catch (eQ) { rr = []; }
    var count = 0;
    for (var i = 0; i < rr.length && count < 200; i++) {
        var r = rr[i];
        var nm = "" + (r.Name || "");
        var ty = "" + (r.Object_Type || "");
        if (ty == "Artifact" && nm.indexOf("FB ") == 0) { continue; } // audit zaznam z #AI-LOG
        var pth = "";
        try { pth = "" + self.FB_ElementPath(Repository, "element", parseInt(r.Object_ID, 10)); }
        catch (eP) { pth = ""; }
        var st = "" + (r.Stereotype || "");
        rowsOut.push({
            CLASSGUID: "" + r.ea_guid,
            CLASSTYPE: ty,
            Nazev: nm,
            Typ: ty + (st != "" ? " <<" + st + ">>" : ""),
            Cesta: pth,
            Davka: reqId
        });
        count++;
    }
    if (count == 0) {
        rowsOut.push(infoRow("Davka '" + reqId + "' nema v modelu zadne orazitkovane prvky (tag ai.request) - bud nic nezapsala, nebo byly prvky smazany"));
    }
}
var xml = "<ReportViewData UID=\"FB_Changes\"><Fields>";
var f;
for (f = 0; f < FIELDS.length; f++) { xml += "<Field name=\"" + FIELDS[f] + "\"/>"; }
xml += "</Fields><Rows>";
for (var ri = 0; ri < rowsOut.length; ri++) {
    xml += "<Row>";
    for (f = 0; f < FIELDS.length; f++) {
        xml += "<Field name=\"" + FIELDS[f] + "\" value=\"" + xEsc(rowsOut[ri][FIELDS[f]]) + "\"/>";
    }
    xml += "</Row>";
}
xml += "</Rows></ReportViewData>";
try { XMLResults.val = xml; } catch (eX) { }
return "T";
