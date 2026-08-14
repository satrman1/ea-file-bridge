// ============================================================================
// Krok 0, test 3 (P4): COM XMLHTTP z EA Scripting — JScript verze.
// (P4 uz byl 2026-08-13 potvrzen: COM objekt vytvoren, HTTP 200, 44293 znaku.
//  Skript zustava jako zalozni komunikacni kanal na Confluence pro M365-A.)
//
// PRED SPUSTENIM: uprav konstantu URL na skutecnou Confluence stranku.
// Spusteni v EA: Specialize > Scripting > novy skript typu JScript >
// vlozit obsah > Run. Vysledek v System Output, zalozka Script.
// ============================================================================

var URL = "https://ZDE-DOPLN-CONFLUENCE/pages/viewpage.action?pageId=123456";

function main() {
    Repository.EnsureOutputVisible("Script");
    Session.Output("=== Krok 0 / test P4: XMLHTTP z EA Scripting (JScript) ===");

    var http = null;
    try {
        http = new ActiveXObject("MSXML2.XMLHTTP");
    } catch (e) {
        Session.Output("VYSLEDEK: CHYBA - COM objekt MSXML2.XMLHTTP nejde vytvorit: " + e.message);
        return;
    }
    Session.Output("COM objekt MSXML2.XMLHTTP vytvoren - COM na teto stanici zije.");

    try {
        http.open("GET", URL, false);
        http.send();
    } catch (e2) {
        Session.Output("GET selhal (sit/proxy/prihlaseni?): " + e2.message);
        Session.Output("POZN: i tak plati, ze COM funguje - pulka testu OK.");
        return;
    }

    Session.Output("HTTP status: " + http.status + " (200 = OK, 302/401 = zije, ale chce prihlaseni)");
    Session.Output("Delka odpovedi: " + ("" + http.responseText).length + " znaku");
    Session.Output("=== Konec testu ===");
}

main();
