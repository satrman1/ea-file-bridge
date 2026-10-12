// AICodeBridge.FB_RepoId(Repository)
// Identita repozitare ZDOLA - z databaze, ne z cesty k souboru/zastupci.
// MS SQL: nazev databaze (DB_NAME()). Jinak fallback = ConnectionString
// (lokalni .qea/SQLite apod.).
// Duvod (nalez 2.1 protokolu vyhodnoceni POC, 2026-08-14): pri otevreni EA
// pres .qea zastupce vraci Repository.ConnectionString cestu k zastupci -
// nazev lokalniho souboru nema zadnou autoritu (lze prejmenovat/prepojit),
// je stanice-zavisly a nemusi odpovidat nazvu DB ani EA connection.
// Proti teto hodnote se porovnava FB_WriteScope.repo i deklarace repo v davce.
// !! Sonda DB_NAME() se pousti VYHRADNE na MS SQL (RepositoryType SQLSVR).
// Na lokalnim .qea/SQLite se EA z SQLQuery s neznamou funkci nevrati
// (pumpa se 14.8. pri startu zasekla) - proto se tam SQL vubec nespousti.
// v0.20 (FB-PU-32, Z261004b-7): PAMET PO DOBU JEDNOHO VOLANI FB_Main -
// this._fbRepoIdCache. FB_Main ji na zacatku vynuluje a na konci (finishM)
// zahodi; mezi tim se identita zjisti jednou (driv 15-20x tentyz SELECT
// DB_NAME() na davku - kazdy pomocnik se ptal znovu). Mimo FB_Main (menu,
// start session, pumpa mezi davkami) pamet neni -> vzdy cerstvy dotaz,
// takze zmena otevreneho projektu (FB-PU-06) se pozna.
if (typeof this._fbRepoIdCache == "string" && this._fbRepoIdCache != "") { return this._fbRepoIdCache; }
var ridOut = null;
try {
    var rt = "";
    try { rt = ("" + Repository.RepositoryType()).toUpperCase(); } catch (eT) { rt = ""; }
    if (rt == "SQLSVR") {
        var rows = this.FB_XmlRows(Repository.SQLQuery("SELECT DB_NAME() AS db"));
        if (rows && rows.length && rows[0].db) { ridOut = "" + rows[0].db; }
    }
} catch (e) { }
if (ridOut === null) { ridOut = "" + Repository.ConnectionString; }
if (this._fbRepoIdCacheOn === true) { this._fbRepoIdCache = ridOut; }
return ridOut;
