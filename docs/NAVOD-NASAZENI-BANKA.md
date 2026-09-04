# Nasazení EA File Bridge do banky — fáze 2 (plán POC)

Verze **v0.3**, revize 2026-09-04 (vlákno Z260904-5; původní text 2026-08-14) · Předpoklad: generálka doma kompletní (všech 6 předpokladů POC ✅, protokol vyhodnocení v0.5) · Cíl: tentýž tracer bullet proti testovacímu repozitáři **`<TEST-DB>`** s GitHub Copilotem jako driverem · **Aktualizace pro bridge v0.2:** identita repozitáře = název databáze (`FB_RepoId`), už NE connection string / název `.qea` zástupce — whitelist i `repo` v dávkách se píší jako `<TEST-DB>` a fungují na každé stanici (upgrade z v0.1 viz §6)

> **⚠ Dělba se `NAVOD-NASAZENI-KLIKACI.md` (od 2026-09-04).** Tento soubor je **plán fáze 2 POC**: co se ověřuje, akceptační kritéria, upgrade whitelistu v0.1 → v0.2. **Klik po kliku** — pull a diff kurýrního klonu, přenos add-inu, Manage Add-Ins, restart EA, všech šest konfiguračních sekcí, první ping oběma kanály a troubleshooting — je v **[`NAVOD-NASAZENI-KLIKACI.md`](NAVOD-NASAZENI-KLIKACI.md)**, který pokrývá stav po iteracích 5–7. Kroky §2–§3 níže popisují stav k srpnu 2026 a **neznají** security vrstvy (`FB_AccessGroups`), `FB_OpsAllowed`, `FB_QcConfig` ani schránkový kanál — při skutečném nasazení jeď podle klikacího návodu a sem se vracej pro kritéria fáze 2 (§4) a upgrade (§6).

> Placeholdery: `<TEST-DB>` / `<PROD-DB>` = skutečné názvy testovací a produkční databáze repozitáře. Do tohoto repa (GitHub) nepatří — reálné hodnoty viz interní poznámky projektu; dosazují se až lokálně při nasazení a necommitují se.

**Zásada: na produkci (`<PROD-DB>`) se v rámci fáze 2 NIC nenasazuje ani nespouští.** Whitelist i dávky jsou vázané na `<TEST-DB>` — kdyby se cokoli omylem potkalo s produkcí, executor odmítne (`E_REPO`).

---

## 1. Přenos repa (jednorázově)

1. Dostaň klon `ea-file-bridge` na dev stanici obvyklým sync mechanismem (jako u ostatních C:\GIT projektů).
2. Zapiš si cestu klonu — dosaď ji níže všude místo `<KLON>`.

## 2. Příprava `<TEST-DB>` (jednorázově, ~10 minut)

1. **Packages:** v EA (připojeném na **`<TEST-DB>`**!) založ vyhrazený testovací package **`#FB-TEST`** (umístění zvol dle konvencí repozitáře). Package **`#AI-LOG`**: pokud už v repozitáři existuje, použije se; jinak založ i ten.
2. **GUIDy:** v SSMS proti `<TEST-DB>` spusť:
   ```sql
   SELECT Package_ID, Name, ea_guid FROM t_package WHERE Name IN ('#FB-TEST', '#AI-LOG');
   ```
   Zapiš si `ea_guid` obou packages.
3. **Whitelist:** otevři `<KLON>\src\AICodeBridge.FB_Whitelist.js` (Poznámkový blok / VS Code) a přepiš návratové pole na:
   ```js
   return [
       { repo: "<TEST-DB>", pkg: "{GUID-#FB-TEST-z-kroku-2}" }
   ];
   ```
   (`repo` = od v0.2 podřetězec **názvu databáze** — executor si ho zjistí sám přes `DB_NAME()`, takže nezáleží na názvu `.qea` zástupce ani cestě. Ulož.)
4. **Bootstrap executoru:** v EA (`<TEST-DB>`):
   - v Project Browseru **označ package**, kam má patřit element AICodeBridge (např. vedle #FB-TEST),
   - Specialize → Scripting → nový **JScript** → vlož obsah `<KLON>\scripts\ITAN-Bootstrap File Bridge.js`,
   - Run (cestu ke složce `src` skript najde sám na obvyklých cestách, jinak se zeptá dialogem — nic se needituje). Výstup má hlásit založení elementu + řádek `OK` na **každý soubor v `src\`** (od iterace 7 jich je 105; číslo „16 operací" v původním textu platilo pro POC z 8/2026). Podrobně: klikací návod §2.2.

   > **Iterace 5–7 přidaly další konfigurační sekce**, které tenhle výčet nezná: `FB_OpsAllowed` (whitelist operací — v bance `deny` na `deploy_src`, `delete_*`, `clone_*`), `FB_AccessGroups` (EA security skupina pro write fíčury), `FB_RiskPolicy`, `FB_QcConfig`. Kompletní postup pro všech šest sekcí: **klikací návod §5**.
5. **Copilot instrukce:** zkopíruj `<KLON>\docs\copilot-instructions-eafb.md` jako `<KLON>\.github\copilot-instructions.md` a uvnitř dosaď skutečnou hodnotu `repo` (= `<TEST-DB>`).

## 3. Spuštění a smoke test (~5 minut)

1. EA běží s otevřeným **`<TEST-DB>`**.
2. Dvojklik `<KLON>\pump.wsf`. Konzole musí hlásit: připojený repozitář (zkontroluj pohledem, že v cestě je `<TEST-DB>`!), počet načtených operací a **„Session baseline: 1 vytvoren"**. Hláška „POZOR: … žádná whitelist položka" = špatný krok 2.3 nebo připojený jiný repozitář — zastav se.
3. Ruční smoke: do `requests\` ulož soubor `req-smoke.json`:
   ```json
   { "protocol": "eafb/0.1", "id": "smoke-01", "repo": "<TEST-DB>",
     "ops": [ { "op": "ping", "echo": "banka" } ] }
   ```
   Do ~2 s má v `responses\` být `res-smoke.json` se `status:"done"` a polem `repository` = **`<TEST-DB>`** (název databáze; pole `connection` vedle toho informativně ukazuje cestu připojení).

## 4. Průchod fáze 2 (Copilot jako driver — P3 naostro)

1. VS Code → Open Folder → `<KLON>`. Copilot: **agent mode**, model **Claude Sonnet 5** (přímá porovnatelnost s generálkou; až po úspěchu případně default Opus 4.8).
2. Zadej úlohu typu: *„Zjisti GUID elementu X (existující v `<TEST-DB>`) a založ do #FB-TEST element Y (Class, stereotyp entity) s poznámkou …. Postupuj podle instrukcí workspace."*
3. **Sleduj a zaznamenej** (akceptační kritéria fáze 2 dle zadání POC):

| Kritérium | Výsledek |
|---|---|
| Copilot složil request, přečetl response, interpretoval — bez asistence (P3) | |
| Kritéria fáze 1 platí proti bankovnímu repozitáři (smyčka ~2 s, GUIDy, whitelist, audit #AI-LOG) | |
| Baseline #FB-TEST vznikl při startu session pumpy | |
| Žádné ruční „Allow" (plain notes, bez terminálu) | |
| Spotřeba kreditů na úlohu (doma: ~18 na Sonnetu 5) | |

4. Ověř v EA: element v #FB-TEST s tagy `ai.channel`/`ai.request`, audit element `FB <id>` v #AI-LOG, baseline v Package Control.

## 5. Po průchodu

Výsledky nadiktovat Claudovi → protokol vyhodnocení (finální GO/NO-GO na iterace 1+2) → fáze 3 (přenosové primitivy M365: E2E za studena s ručním přenosem, zaznamenat `(1)` varianty názvů při opakovaném stažení).

## 6. Upgrade whitelistu na název databáze (z v0.1 na v0.2)

Fáze 2 na v0.1 běžela s provizorním whitelistem na název `.qea` zástupce. **Proč se to musí změnit:** cesta k zástupci není autoritativní — na jiné stanici se jmenuje jinak a nic o skutečně připojené databázi neříká. Testovací repozitář navíc vzniká **klonem produkčního**, takže **package GUIDy jsou v obou stejné** a GUID sám instanci nerozliší. Od v0.2 je identita repozitáře **název databáze**, který si executor zjistí sám (`FB_RepoId` → `DB_NAME()`), a whitelist tak funguje na každé stanici bez editace.

Přechod (~5 minut):

**1. Zjisti přesný název databáze.** Buď dotazem správce, nebo — pokud už bridge v modelu je — **čtecí dávkou** (`ping`): v `res-*.json` je pole `"repository"` = přesně ta hodnota, kterou executor porovnává. Vedle ní je informativní `"connection"` s cestou připojení — **tu do whitelistu nepiš**. Když bridge ještě není nasazený, dá se totéž zjistit v SSMS proti `<TEST-DB>`:
   ```sql
   SELECT DB_NAME() AS RepoId;
   ```

**2. Přepiš položku ve whitelistu.** `src\AICodeBridge.FB_Whitelist.js` v klonu:
   ```js
   { repo: "<TEST-DB>", pkg: "{GUID-AI-SANDBOX}" }
   ```
   `repo` se porovnává jako **podřetězec, case-insensitive** — stačí tedy rozlišující část názvu, ale **pozor na klony:** podřetězec `EMR_TEST` sedí i na `EMR_TEST_COPY`. Když v prostředí takové názvy existují, piš název celý. Lokální úprava, **necommituje se** do kurýrního repa (patří do evidence bankovních adaptací, kanál fáze E).

**3. Stejnou hodnotu dosaď i do ostatních konfiguračních sekcí** — `FB_Config`, `FB_OpsAllowed`, `FB_AccessGroups`, `FB_RiskPolicy`, `FB_QcConfig`. Všechny párují přes tutéž mechaniku; **nahraď je najednou**, jinak vznikne stav, kdy jedna sekce repozitář zná a druhá ne (a ta druhá jede fail-closed: bez položky ve `FB_OpsAllowed` neprojde žádný zápis, bez `FB_RiskPolicy` je každá dávka ELEVATED).

**4. Nasaď configy do modelu:** EA (`<TEST-DB>`) → Scripting → spusť **`scripts/ITAN-Bootstrap File Bridge.js`** (idempotentní — doplní chybějící operace a nahraje aktuální kód **všech** operací, které mají soubor v `src\`; obyčejný inject novou operaci nezaloží, jen na ni upozorní). Pak **plný restart EA**.

**5. Ověř pingem.** Restartuj pumpu, pošli smoke ping (§3.3): `repository` v response musí být `<TEST-DB>` a `whitelist[]` musí nést `<AI-SANDBOX>` s plnou cestou. Menu **Specialize → AI Bridge → Stav bridge** ukáže totéž bez posílání dávky.

**6. Dávky od teď deklarují `"repo": "<TEST-DB>"`** — uprav i lokální `.github\copilot-instructions.md`, pokud tam byl název zástupce.

> **Kontrola, že to sedí:** dokud whitelist neodpovídá připojenému repozitáři, zápis končí `E_REPO` (nesedí identita — neprovede se nic, ani audit) nebo `E_WHITELIST` (identita sedí, package je mimo větev). Obojí je fail-secure, ne porucha. Troubleshooting: klikací návod §7.3.

## Troubleshooting

**Plný troubleshooting je v [`NAVOD-NASAZENI-KLIKACI.md`](NAVOD-NASAZENI-KLIKACI.md) §7** — menu add-inu mlčí (cizí `SignalGUID`), `E_ADDIN_ACCESS`, `E_REPO`, `E_PERMISSION`/`E_LOCKED`, ELEVATED dialog, prokliky z Output tabu, modální dialog EA s falešnou nulou, AV/EDR. Tady jen to nejčastější u startu pumpy:

| Příznak | Příčina → řešení |
|---|---|
| Konzole: „Cekam na bezici EA…" | EA neběží / nemá otevřený projekt → otevři `<TEST-DB>` |
| „POZOR: … žádná whitelist položka (E_REPO)" | whitelist nesedí na připojený repozitář → zkontroluj krok 2.3 a KTERÝ projekt je v EA otevřený |
| Response `E_REPO` | dávka má jiné `repo` než připojený repozitář — správné chování ochrany; zkontroluj, co je otevřené |
| „operace FB_Main v modelu chybí" | bootstrap neproběhl / jiný repozitář → krok 2.4 |
| Windows dialog „Vyberte aplikaci pro .wsf" | zvol Microsoft ® Windows Based Script Host (není to blokace) |

## Changelog

- **v0.3 — 2026-09-04** (vlákno Z260904-5): dělba s novým `NAVOD-NASAZENI-KLIKACI.md` (tento soubor = plán fáze 2, klikací postup jinde); §6 přepsán na přesný postup zjištění a dosazení názvu databáze včetně pasti podřetězce u klonů a ostatních pěti konfiguračních sekcí; §2.4 opraven výstup bootstrapu (105 souborů místo „16 operací") a doplněny konfigurační sekce iterací 5–7; troubleshooting odkazuje na klikací návod.
- **v0.2 — 2026-08-14**: identita repozitáře = název databáze (`FB_RepoId`) místo connection stringu / názvu `.qea` zástupce.
- v0.1 — 2026-08: vznik (fáze 2 POC s provizorním whitelistem na název zástupce).
