# Krok 0 — smoke testy prostředí (klikací návod)

Součást POC EA File Bridge (`Zadani-POC-EA-File-Bridge.md` v1.1, kap. 2). Žádný test nevyžaduje instalaci ani terminál — vše dvojklikem nebo v okně EA. Výsledky si poznamenej do tabulky dole.

---

## Na dev stanici (banka)

### Test 1 — WSH / AppLocker (předpoklad P1)

1. Zkopíruj na stanici soubor `test.js` (nebo ho vytvoř v Poznámkovém bloku — obsah je jeden řádek: `WScript.Echo("funguje");`).
2. Dvojklik na soubor.
3. Pokud Windows zobrazí okno **„Vyberte aplikaci pro otevření souboru .js"**: zvol **Microsoft ® Windows Based Script Host** (ikona s barevnou krychličkou) a **nezaškrtávej „Vždy"**. Toto okno není blokace — jen chybí výchozí přiřazení (často si .js „ukradne" VS Code).

**Výsledek:**

| Co vyskočilo | Znamená |
|---|---|
| Okénko „funguje" | ✅ P1 — WSH běží, pumpa může být WSH |
| Hláška o zásadách organizace / zablokováno správcem | ❌ P1 — AppLocker; pumpa se přepíše do PowerShellu |

> ✅ **Provedeno 2026-08-13: OK** (okénko „funguje" — P1 potvrzeno).

### Test 2 — COM attach na běžící EA (část předpokladu P2)

1. Otevři EA a v něm libovolný projekt.
2. Zkopíruj na stanici soubor `test-ea.vbs`.
3. Dvojklik na soubor (u `.vbs` se dialog s výběrem aplikace obvykle neobjeví; kdyby ano, opět Microsoft Windows Based Script Host).

**Výsledek:**

| Co vyskočilo | Znamená |
|---|---|
| „COM attach OK" + cesta k repository | ✅ skript zvenku vidí běžící EA — jádro pumpy je průchozí |
| „EA neběží, nebo COM připojení selhalo" | ❌ ověř, že EA opravdu běží; pokud běží a hláška trvá, COM attach je blokovaný — zásadní zjištění, hlásit |
| „EA běží, ale nejde přečíst repository" | ⚠ otevři v EA projekt a spusť znovu |

---

## Na produkční M365 stanici

### Test 3 — XMLHTTP z EA Scripting okna (předpoklad P4; jen pokud je na stanici EA)

> Preferovaná verze skriptu = **`test-confluence-ea-scripting.js`** (JScript) — v EA Scripting používáme JScript, VBS už v bankovním prostředí není v add-in kontextu podporováno. Původní `.vbs` verze zůstává jen jako záloha.

1. Otevři soubor `test-confluence-ea-scripting.js` v Poznámkovém bloku a v řádku `var URL = ...` doplň adresu libovolné Confluence stránky, na kterou máš přístup. Ulož.
2. V EA: **Specialize → Scripting** → pravý klik na skupinu (např. Local Scripts) → **New JScript** → pojmenuj třeba `Test-XMLHTTP`.
3. Dvojklikem skript otevři, vlož do něj celý obsah souboru, ulož (Ctrl+S).
4. Spusť zelenou šipkou (Run Script).
5. Výsledek se vypíše dole v okně **System Output**, záložka **Script**.

> ✅ **Provedeno 2026-08-13: OK** — COM objekt vytvořen, HTTP status 200, odpověď 44 293 znaků → P4 potvrzeno.

**Výsledek:**

| Výpis | Znamená |
|---|---|
| „COM objekt … vytvořen" + HTTP status 200 | ✅ P4 — COM na produkci žije a Confluence je dosažitelná |
| „COM objekt … vytvořen" + status 302/401 nebo chyba sítě | ✅ COM žije (hlavní půlka P4), jen síť/přihlášení — poznamenej status |
| „COM objekt MSXML2.XMLHTTP nejde vytvořit" | ❌ P4 — COM zevnitř EA blokován; ohrožen princip M365-A |

### Test 4 — free Copilot: stažitelný JSON (předpoklad P5a)

1. Otevři free M365 Copilot (copilot.microsoft.com nebo aplikace).
2. Požádej ho: *„Vygeneruj mi malý JSON soubor ke stažení pod názvem `ea-req-test.json` s obsahem `{"op":"ping","echo":"test"}`."*
3. Stáhni, co nabídne, a podívej se do složky **Stažené soubory**.

**Poznamenej:** skutečný název souboru (přesně), příponu (je to `.json`, nebo `.txt`?), a co se stane při druhém stažení téhož (vznikne `ea-req-test (1).json`?).

### Test 5 — free Copilot: čtení ze SharePointu (předpoklad P5b)

1. Do složky synchronizované OneDrivem (SharePoint knihovna) vlož malý textový soubor, např. `ea-res-test.txt` s obsahem `odpoved: 42`.
2. Počkej na synchronizaci (zelená fajfka na ikoně souboru).
3. V free Copilotu se na soubor odkaž (připoj ho / vlož odkaz na SharePoint umístění) a nech ho přečíst obsah.

**Poznamenej:** přečetl obsah správně? Jak dlouho po nasyncování byl soubor pro Copilota viditelný?

---

## Záznam výsledků

| Test | Předpoklad | Stanice | Výsledek | Datum | Poznámka |
|---|---|---|---|---|---|
| 1. WSH dvojklik | P1 | dev (banka) | ✅ OK | 2026-08-13 | dialog „Vyberte aplikaci" → Windows Based Script Host |
| 2. COM attach | P2 (část) | dev (banka) | ✅ OK | 2026-08-13 | COM attach OK + cesta k repository |
| 3. XMLHTTP z EA | P4 | prod M365 | ✅ OK | 2026-08-13 | COM objekt vytvořen, HTTP 200, 44 293 znaků |
| 4. Copilot download | P5a | prod M365 | ✅ OK | 2026-08-13 | |
| 5. SharePoint čtení | P5b | prod M365 | ✅ OK | 2026-08-13 | soubor vybrán z nabídky (picker) — nasyncovaný dřív, než se člověk doklikal; latence syncu není překážka |
