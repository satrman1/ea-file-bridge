# Nasazení EA File Bridge do banky — fáze 2 (klikací postup)

2026-08-14 · Předpoklad: generálka doma kompletní (všech 6 předpokladů POC ✅, protokol vyhodnocení v0.5) · Cíl: tentýž tracer bullet proti testovacímu repozitáři **`<TEST-DB>`** s GitHub Copilotem jako driverem · **Aktualizace pro bridge v0.2:** identita repozitáře = název databáze (`FB_RepoId`), už NE connection string / název `.qea` zástupce — whitelist i `repo` v dávkách se píší jako `<TEST-DB>` a fungují na každé stanici (upgrade z v0.1 viz §6)

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
   - Run (cestu ke složce `src` skript najde sám na obvyklých cestách, jinak se zeptá dialogem — nic se needituje). Výstup má hlásit založení elementu + `OK` pro 16 operací.
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

## 6. Upgrade z v0.1 na v0.2 (pokud už fáze 2 běžela na v0.1)

Fáze 2 na v0.1 běžela s provizorním whitelistem na název `.qea` zástupce. Přechod na v0.2 (~5 minut):

1. Aktualizuj klon repa (obvyklý sync/pull).
2. `src\AICodeBridge.FB_Whitelist.js` v klonu: položku `repo` přepiš z názvu zástupce na **`<TEST-DB>`** (název databáze). Lokální úprava, necommituje se.
3. EA (`<TEST-DB>`) → Scripting → spusť **`scripts/ITAN-Bootstrap File Bridge.js`** (idempotentní — doplní novou operaci `FB_RepoId` a nahraje aktuální kód všech operací; obyčejný inject novou operaci nezaloží, jen na ni upozorní).
4. Restartuj pumpu. Smoke ping (§3.3) — `repository` v response musí být `<TEST-DB>`.
5. Dávky od teď deklarují `"repo": "<TEST-DB>"` — uprav i lokální `.github\copilot-instructions.md`, pokud tam byl název zástupce.

## Troubleshooting (nejčastější)

| Příznak | Příčina → řešení |
|---|---|
| Konzole: „Cekam na bezici EA…" | EA neběží / nemá otevřený projekt → otevři `<TEST-DB>` |
| „POZOR: … žádná whitelist položka (E_REPO)" | whitelist nesedí na připojený repozitář → zkontroluj krok 2.3 a KTERÝ projekt je v EA otevřený |
| Response `E_REPO` | dávka má jiné `repo` než připojený repozitář — správné chování ochrany; zkontroluj, co je otevřené |
| „operace FB_Main v modelu chybí" | bootstrap neproběhl / jiný repozitář → krok 2.4 |
| Windows dialog „Vyberte aplikaci pro .wsf" | zvol Microsoft ® Windows Based Script Host (není to blokace) |
