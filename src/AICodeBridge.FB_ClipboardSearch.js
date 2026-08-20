// AICodeBridge.FB_ClipboardSearch(Repository, SearchText, XMLResults)
// Add-in Search obal nad FB_ClipboardImport - umozni spustit clipboard rezim
// z VYHLEDAVACIHO POLE EA (rychla klavesova cesta bez otevirani menu).
// Jednorazova definice hledani (jako FB_Process): Find in Project -> New Search,
// Group Type = Search, "Addin Name and method" = AICodeBridge.FB_ClipboardSearch
// (separator TECKA, ne lomitko). Pak staci napsat nazev hledani do pole a Enter.
// Navrat "T" NENI indikator behu - vysledek ukaze dialog (par. T4-0a).
var out = "";
try { out = "" + this.FB_ClipboardImport(Repository); }
catch (e) { out = "CHYBA clipboard rezimu: " + e.message; }
try { Session.Prompt("File Bridge - davka ze schranky:\n\n" + out, 0); } catch (eP) { }
return "T";
