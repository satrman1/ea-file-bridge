// AICodeBridge.FB_RepoId(Repository)
// Identita repozitare ZDOLA - z databaze, ne z cesty k souboru/zastupci.
// MS SQL: nazev databaze (DB_NAME()). Fallback = ConnectionString
// (lokalni .qea/SQLite, kde DB_NAME() neexistuje).
// Duvod (nalez 2.1 protokolu vyhodnoceni POC, 2026-08-14): pri otevreni EA
// pres .qea zastupce vraci Repository.ConnectionString cestu k zastupci -
// nazev lokalniho souboru nema zadnou autoritu (lze prejmenovat/prepojit),
// je stanice-zavisly a nemusi odpovidat nazvu DB ani EA connection.
// Proti teto hodnote se porovnava FB_Whitelist.repo i deklarace repo v davce.
try {
    var rows = this.FB_XmlRows(Repository.SQLQuery("SELECT DB_NAME() AS db"));
    if (rows && rows.length && rows[0].db) { return "" + rows[0].db; }
} catch (e) { }
return "" + Repository.ConnectionString;
