// AICodeBridge.FB_RepoId(Repository)
// Identita repozitare ZDOLA - z databaze, ne z cesty k souboru/zastupci.
// MS SQL: nazev databaze (DB_NAME()). Jinak fallback = ConnectionString
// (lokalni .qea/SQLite apod.).
// Duvod (nalez 2.1 protokolu vyhodnoceni POC, 2026-08-14): pri otevreni EA
// pres .qea zastupce vraci Repository.ConnectionString cestu k zastupci -
// nazev lokalniho souboru nema zadnou autoritu (lze prejmenovat/prepojit),
// je stanice-zavisly a nemusi odpovidat nazvu DB ani EA connection.
// Proti teto hodnote se porovnava FB_Whitelist.repo i deklarace repo v davce.
// !! Sonda DB_NAME() se pousti VYHRADNE na MS SQL (RepositoryType SQLSVR).
// Na lokalnim .qea/SQLite se EA z SQLQuery s neznamou funkci nevrati
// (pumpa se 14.8. pri startu zasekla) - proto se tam SQL vubec nespousti.
try {
    var rt = "";
    try { rt = ("" + Repository.RepositoryType()).toUpperCase(); } catch (eT) { rt = ""; }
    if (rt == "SQLSVR") {
        var rows = this.FB_XmlRows(Repository.SQLQuery("SELECT DB_NAME() AS db"));
        if (rows && rows.length && rows[0].db) { return "" + rows[0].db; }
    }
} catch (e) { }
return "" + Repository.ConnectionString;
