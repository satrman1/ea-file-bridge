# Protokol živého běhu Baseline politiky T6-1…T6-33 doma (Z261004b-2)

2026-10-11 · model `EAExample.qea` (SQLite, security vypnutá, whitelist `#FB-TEST` `{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}`), pumpa v0.5, kód HEAD `6ff24fe` (= Z261004b-1, harness 436/436). Zadání: `IT-ANALYSIS/Zadani-EA-File-Bridge-Baseline-Politika.md` v1.2 kap. 9; chování podle kódu = `docs/PROTOKOL-EAFB.md` kap. 6j + `docs/NAVOD-BASELINE-KLIKACI.md`. Vzor: `docs/baseline-spike/PROTOKOL-SPIKE-BASELINE.md`.

**Režim:** interaktivní vlákno. Claude vhazuje dávky do `requests\` sám (kopie s dosazenými GUIDy v `docs/e2e-baseline/ready/req-20261011-Bxx-*.json`), čeká na `responses\res-*.json` a vyplňuje tabulky. Miloš: Ano/Ne v okně pumpy (okno **nejdřív opsat / vyfotit, pak klikat** — výchozí tlačítko je Ano), restarty pumpy, Baseline manager (Ctrl+Alt+B), menu AI Bridge, dvojklik na WSF, schránka u T6-32. Výsledky → `VYSLEDKY-2026-10-11.md`. **Tento protokol je záloha a doklad, ne úkol pro Miloše.**

Pravidla: `src\` se nemění kromě dočasných variant `FB_RiskPolicy.js` / `FB_Whitelist.js` (po běhu `git checkout`); nálezy se zapisují, neopravují; MCP Enterprise Architect se nepoužívá; `#FB-TEST` se nikdy nemaže; testovací podbalíčky `FBT-BL-*` se na konci smažou dávkou.

## 0. Prescan (hotovo 09:45–09:55)

- `git log`: HEAD `6ff24fe` = commit Z261004b-1 (předchůdce DOBĚHLO, tabulka dávky 10-04b) · `git status` čistý · harness `node test\harness.js` **436/436**.
- Kód přečten: hák v `FB_Main` (plán → rozhodnutí → confirm → lazy baseline → journal → úklid po dávce), `FB_AutoBaseline` (reuse session / freshWithinMin, `CreateBaseline` bere `true | -1 | 1`), `FB_BaselineCleanup` (+ `Hook`, menu `EA_MenuClick`), `FB_SessionStart`, `FB_RiskPolicy` (`DEV_BASELINE`, bankovní šablona v komentáři), `FB_BaselineDecide`, `FB_SubtreeCount` (CTE jen `useCte: true`, `RepositoryType` „SL3" neověřeno), `FB_BaselineName`, `FB_Whitelist`.
- Runtime stav na stanici před během: `state-session.txt` = `s20261010-1|2026-10-10 23:16:14` (vyprší 11:16 — **před B0 se přepíše na starý čas, aby vznikl čistý token `s20261011-1`**); `state-cleanup.txt` = `2026-10-10 23:37:10|1|…` (hák by do 23:37 nejel — před T6-17 a T6-32 se přepíše na starý čas, aby hák běžel; je to runtime soubor mimo git).
- Stav `#FB-TEST` čtecí dávkou B01 (get_baselines) — viz VYSLEDKY.

## Varianty politiky a počet nasazení (dopředu: **7× deploy_src**, z toho 1× návrat)

| # | Nasazení | Soubory `src\` | Co se testuje | Restart |
|---|---|---|---|---|
| B0 | výchozí dev z HEAD | vše (`deploy_src` bez `only`) | T6-1, T6-4…T6-9, T6-12…T6-15, T6-27, T6-30, T6-33 + (c) | pumpa (hlášení session, nový token) |
| A | `FB_Whitelist` + kořen FBT-ROOT; `FB_RiskPolicy`: `sessionBaseline: "off"`, `useCte: true` | 2 | T6-2, T6-28, bod (a) | pumpa (hlášení „Session baseline vypnuta" + 2 kořeny) |
| B | `FB_Whitelist` zpět; `FB_RiskPolicy`: `thresholdsShadow: false`, `subtreeMax: 10`, `requireRecoveryForUpdates: true`, `sessionBaseline: "auto"` | 2 | T6-3, T6-10, T6-11, T6-26 | pumpa (T6-3 „přeskočeno (nad limitem)") |
| C | `probeBudgetMs: 1` | 1 | T6-16 | — |
| D | `budgetMs: 1` (prah gate, mimo sekci baseline) | 1 | T6-25 | — |
| E | položka EAEXAMPLE bez sekce `baseline` | 1 | T6-31 | pumpa (volitelně: „Session baseline vypnuta") |
| R | `git checkout src\` → výchozí | 1 | úklid T6-17…22, T6-24, T6-32, zbytek | — |

Každé nasazení = dávka `deploy_src` (`only: [...]`) → ELEVATED okno → **Ano** → pumpa si kód přenačte sama. Plný restart EA není potřeba (menu ani receptions se nemění). Menu „Uklid automatickych baselines" je v modelu od bootstrapu 10. 10. — B0 to ověří.

## 1. B0 — nasazení a kontrola

| Krok | Kdo | Co | Očekávání |
|---|---|---|---|
| B00 | Claude | `state-session.txt` → starý čas (nový token) | první zápis/pumpa založí `s20261011-1` |
| B00 | Claude | dávka `deploy_src` (bez `only`) | ELEVATED okno; po Ano `updated[] = 119`, `created[] = 0` |
| B00 | Miloš | Ano; restart pumpy | konzole: `Code loader: 119`, hlášení session: `Repozitar: EAEXAMPLE.QEA | Whitelist: …#FB-TEST | Session baseline (zaloha pred zapisem) vytvorena nad: …#FB-TEST [FB-AUTO - s20261011-1 … (session)]` |
| B00 | Claude | ping + kontrolní dotaz parametrů (`req-banka-kontrola-parametru` vzor) | ping done; 119 operací, 0 rozdílů proti hlavičkám `src\` |
| B00 | Miloš | menu Specialize → AI Bridge | položka „Uklid automatickych baselines (ukazat / provest)" je |
| B01 | Claude | **T6-1** čtecí: `get_baselines #FB-TEST` + `get_selected_context` + `query` počet prvků | bez sekce `baseline`; počet baselines = stav po startu pumpy (beze změny) |
| B02a–d | Claude | setup `FBT-BL-*` (4 dávky, každá ≤ 4 nové balíčky) | ELEVATED (affectedPackages > 1), okno „Bez zalohy - davka jen vytvari", po Ano `decision: "none"`, `reason: "cisty create"`, žádná nová baseline |

Setup struktura pod `#FB-TEST`: `FBT-BL-A` (A1, A2) · `FBT-BL-B` (B1, B2) · `FBT-BL-C` (C1) · `FBT-BL-M` (prázdná) · `FBT-BL-D` (Da) ⊃ `FBT-BL-D1` (D1a) · `FBT-BL-E` (E1) · `FBT-BL-F` (F1) · `FBT-BL-G` (G1) · `FBT-BL-H` (H1) · `FBT-BL-S` (sekvenční diagram SD1) · `FBT-BL-S2` (lifelines L1, L2 umístěné na SD1) · `FBT-BL-CL1`, `FBT-BL-CL2`, `FBT-BL-CL3` (po 1 prvku; fixtures úklidu) · prvek `FBT-BL-T10` přímo v `#FB-TEST`. Mimo whitelist: `FBT-ROOT` (ROOT1) — zakládá Miloš v EA vedle `#FB-TEST`.

## 2. T6-1…T6-16 + T6-25, T6-28, T6-31 (+ T6-26, T6-27) po variantách

U každé dávky se zapisuje: `baseline{}` (decision, reason, created/reused, posture, subtreeCount), počet baselines před/po (`get_baselines`), text okna (Miloš u T6-10, T6-13, T6-14), `rejected\` u T6-11, tag `ai.baseline` v `#AI-LOG` (čtecí dávka nad `t_objectproperties`).

### Varianta B0 (výchozí dev)

| B | T6 | Dávka / klik | Očekávání (podle kódu) |
|---|---|---|---|
| B03 | T6-4 | create prvku A3 do `FBT-BL-A` | LOW, bez okna; `decision none`, `reason "cisty create"`; baselines A: 0 → 0 |
| B04 | T6-5 | update notes A1 (guid) | LOW; **1** nová `FB-AUTO - s20261011-1 …` nad `FBT-BL-A` (ne nad `#FB-TEST`); `decision created`, `reason "pod prahem"`, `subtreeCount` 3; journal manifest s polem notes |
| B05 | T6-6 | tentýž update podruhé | žádná nová; `decision reused`, `reason "reuse session"` |
| B06 | T6-7 | update B1, C1, E1? — ne: update B1, C1 a Da (3 balíčky B, C, D) | ELEVATED (affectedPackages 3 > 1) → okno „Zaloha pred zapisem: …B, …C, …D" → Ano → **3** baselines, žádná nad `#FB-TEST`; `affectedPackages = 3` |
| B07 | T6-8 | update Da + D1a (D a D1, potomek) | ELEVATED (2 balíčky) → Ano → **1** baseline nad `FBT-BL-D` (reuse z B06 možný — pak `reused`, počet D beze změny; zapsat) — normalizace: D1 se sloučí do D |
| B08 | T6-9 + T6-13 | update A1, B1, C1, E1, F1, G1, H1 (7 balíčků) | `overLimit` (7 > 5) → okno „BEZ AUTOMATICKE ZALOHY (bez pre-image): nad prahem (dotcenych packages 7 > 5)" + „PRED potvrzenim udelej rucni baseline nad: …" → **Miloš opíše okno, dá Ne** → `rejected`, `E_RISK_REJECTED`, **0** nových baselines (T6-13), nikdy baseline předka |
| B09 | T6-12 | delete package `FBT-BL-D1` | ELEVATED → Ano → baseline nad **rodičem `FBT-BL-D`** (reuse z B06/B07 = `reused`; zapsat), D1 smazán |
| B10 | T6-14 | delete prvku E1 (balíček E bez FB-AUTO) | ELEVATED → **Miloš opíše okno** (čas potvrzení) → Ano → `decision created`, čerstvá baseline nad `FBT-BL-E`; čas ve jméně a `elapsedMs` mezi potvrzením (`risk.confirm.timestamp`) a zápisem |
| B11 | T6-15 | update notes ROOT1 (`FBT-ROOT` mimo whitelist) | **`E_NO_BASELINE`** terminálně (why obsahuje `E_WHITELIST`), žádné `confirm_required`, soubor v `rejected\`, ROOT1 nezměněn |
| B12 | T6-27 | op0 `find_elements_by_name` A2 → op1 update s `"$0[0].guid"` | `scope.unknown` → okno „bez pre-image: velikost neznama ($N odkaz na existujici…)" — nikdy „čistý create" → Ne |
| B13 | T6-30 | `create_baseline` `#FB-TEST`, `name: "FB-AUTO test"` | `E_ARGS` („prefix vyhrazen"), gate eskalace (ELEVATED důvod), žádná baseline |
| B14 | T6-33 | `create_or_update_messages` SD1 `rebuild: true` (L1→L2) | ELEVATED (rebuild) → Ano → baseline nad **`FBT-BL-S`** (balíček diagramu), ne nad `FBT-BL-S2` |
| B15 | (c) | prvek s `dedupKey` do A + konektor A1→A2 s `dedupKey` + place na diagram | SQL nad `t_objectproperties` / `t_connectortag` / `t_diagramobjects` **bez modálního dialogu** (Miloš sleduje EA) |

### Varianta A (whitelist + FBT-ROOT, sessionBaseline off, useCte true)

| B | T6 | Dávka / klik | Očekávání |
|---|---|---|---|
| B16 | — | `deploy_src only [FB_Whitelist, FB_RiskPolicy]` → Ano; **restart pumpy** | konzole: `Whitelist: …#FB-TEST, …FBT-ROOT | Session baseline vypnuta (sessionBaseline off). Zalohy se poridi …` — **T6-2** (žádná nová baseline, identita + 2 cesty) |
| B17 | T6-2 / (a) | update A1 (LOW) | `baseline.probeMs ≤ 500`; probe `status ok` s `useCte: true` ⇒ CTE cesta prošla (`RepositoryType` vrátil „SL3"/SQLite) — hodnotu `RepositoryType()` navíc vypíše fixtures WSF |
| B18 | T6-28 | delete package `FBT-ROOT` (kořen whitelistu, rodič EA Addins mimo) | ELEVATED, okno s řádkem „POZOR: parentOutOfWhitelist - zaloha nekryje smazany uzel…" → **Miloš opíše** → Ano → baseline nad FBT-ROOT vznikla a se smazáním zanikla; `scope.packages[0].parentOutOfWhitelist: true`; nikdy tichý zápis / holé `E_WHITELIST` |

### Varianta B (prahy ostré: subtreeMax 10, requireRecoveryForUpdates true, sessionBaseline auto)

| B | T6 | Dávka / klik | Očekávání |
|---|---|---|---|
| B19 | — | `deploy_src only [FB_Whitelist, FB_RiskPolicy]` → Ano; **restart pumpy** | **T6-3**: `Session baseline preskocena (nad limitem) - zalohy vzniknou az u zapisu: …#FB-TEST (N prvku > 10)`; 0 nových baselines |
| B20 | T6-10 | update notes `FBT-BL-T10` (přímo v `#FB-TEST`, podstrom > 10) | `confirm_required`, okno „BEZ AUTOMATICKE ZALOHY (bez pre-image): nad prahem (podstrom N > subtreeMax 10)" + „PRED potvrzenim udelej rucni baseline nad: …#FB-TEST" → **Miloš opíše**, dá **Ano** bez ruční baseline → nic nezapsáno, nové `confirm_required` („Potvrzeno, ale cerstva rucni baseline stale chybi"), dávka čeká v `pending\` |
| B20b | T6-10 | Miloš: Ctrl+Alt+B nad `#FB-TEST` → New Baseline „Rucni pred T6-10"; Claude: nová dávka (jiné id) | okno „Nalezena cerstva rucni baseline: Rucni pred T6-10 nad …#FB-TEST - po potvrzeni se davka provede" → Ano → `done`, `decision skipped`, `manual.found`, **0** FB-AUTO; audit Artifact `FB <id>` v `#AI-LOG` s tagem `ai.baseline` obsahujícím `decision` |
| B21 | T6-11 | delete prvku `FBT-BL-T10` (destruktivní, nad prahem, requireRecovery true) | **`E_NO_BASELINE`**, soubor v `rejected\`, prvek stále existuje (kontrolní čtení), audit zapsán |
| B22 | T6-26 | update přes `matchByName` jména `FBT-BL-T10` v `#FB-TEST` (nad prahem) | okno „BEZ ZALOHY: nad prahem…; davka muze prepsat prvky dohledane pres match/dedupKey" → Ano → **projde**, `baseline.updatedExistingApprox = 1`, nikdy `E_NO_BASELINE` |
| — | — | pending z B20 při dalším restartu pumpy znovu nabídnuto → **Ne** | `rejected` |

### Varianta C (`probeBudgetMs: 1`)

| B23 | — | deploy → Ano | — |
| B24 | T6-16 | update A1 | okno „bez pre-image: velikost neznama (rozpocet sondy vycerpan (1 ms)…)" → Ne; `reason` začíná `velikost neznama`, nikdy „pod prahem" |

### Varianta D (`budgetMs: 1`)

| B25 | — | deploy → Ano | — |
| B26 | T6-25 | update A1 | ELEVATED („Metriky nespocitany"), okno: „Rozsah davky se nepodarilo spocitat - zachazi se s ni jako s menici." + „Zaloha pred zapisem: …FBT-BL-A", **ne** „čistý create" → Ano → `decision created/reused`, `reason "metriky nespoctany"` / reuse; `metricsComplete false` |

### Varianta E (bez sekce `baseline`)

| B27 | — | deploy → Ano | — |
| B28 | T6-31 | create prvku A4 do A (LOW) | **LOW, bez okna, `done`**; `warnings` obsahuje „polozka FB_RiskPolicy nema sekci 'baseline'"; (nekonzistentní sekce ⇒ ELEVATED kryje harness) |

### Návrat (R)

| B29 | — | `git checkout src\` → `deploy_src only [FB_RiskPolicy]` → Ano | `git diff src\` prázdný; model = výchozí |

## 3. Úklid T6-17…T6-22 (`cleanup.mode: "report"` zůstává)

Fixtures = `docs\e2e-baseline\fixtures-baselines.wsf` (dvojklik, fáze 1–4 volbou na konzoli; vzor `spike-deletebaseline.wsf`; jména přesně podle `FB_BaselineName`; vypíše `RepositoryType()` = bod (a) a návratové hodnoty `CreateBaseline`/`DeleteBaseline` = bod (b)).

| B | T6 | Fáze WSF / dávka / klik | Očekávání |
|---|---|---|---|
| B30 | — | WSF fáze 1: `FBT-BL-CL1` 6× `FB-AUTO - s20260921-1 2026-09-21 10:00:0N` (20 dnů) + `FB 2026-09-01 10:00:00` + `AI-pre-s1-b1` + `Pred refaktorem`; `FBT-BL-CL2` 8× stáří 7 dnů (`s20261004-1 2026-10-04 …`) | vytvořeno 17, návraty `CreateBaseline` |
| B31 | T6-17, T6-19, T6-20 | `state-cleanup.txt` → starý čas; LOW zápis (A5 do A) → hák | `res.warnings`: „Uklid automatickych baselines [report]: kandidatu **3** … Smazal bych 3"; legacy/AI-pre/ruční nejsou kandidáti ani v Output; CL2 (7 dnů) 0 kandidátů; `get_baselines CL1` = 9 beze změny |
| B32 | T6-17 menu | Miloš: menu Uklid → dialog (**vloží text**) → Ne | dialog = report, nic nesmazáno |
| B33 | T6-18 | Miloš: menu Uklid → **Ano** (vloží text výsledku) | „Smazano 3" — právě 3 nejstarší (`…10:00:01…03`); `get_baselines CL1` = 3 FB-AUTO nejnovější + 3 ostatní; SQL `t_document` potvrdí; audit Artifact `FB uklid-baselines-…` se 3 GUIDy a `uzivatel -` |
| B34 | T6-21a | WSF fáze 2: `FBT-BL-CL3` 43× 20 dnů; `state-cleanup.txt` → starý čas; LOW zápis → hák | „kandidatu 40 … Smazal bych 20 (zbyva 20 na dalsi behy)" |
| B35 | T6-21b | WSF fáze 3: CL3 +210 (celkem 253); Miloš menu Uklid (vloží text) | „ANOMALIE: 250 kandidatu > maxDeletesAnomaly 200 - nemaze se NIC"; bez otázky Ano/Ne |
| B36 | T6-22 | — | bezpředmětné: kód index `baselines-index.json` nevede (odchylka 2 v kap. 6j) — ✅ by design, zapsat |
| B37 | — | WSF fáze 4: smaže všechny fixtures (CL1/CL2/CL3 vč. legacy/ruční) přes `DeleteBaseline` | návraty `DeleteBaseline`; `get_baselines CL*` = 0 |

## 4. T6-24 regrese „den práce dev skillů"

Po návratu R. Sekvence dávek v `FBT-BL-R`: R1 kostra (balíček + podbalíčky + prvky) · R2 UC prvky + UC diagram + place · R3 scénáře UC · R4 constraints + requirements · R5 datový model (třídy, atributy, operace, asociace) · R6 class diagram + place · R7 update notes existujících prvků · R8 druhá iterace scénářů. Zapsat **každé okno** (důvod, Ano/Ne) a počet nových `FB-AUTO` ≤ počet dotčených balíčků; tabulku oken porovnat s kap. 5 (sloupec „Dnes") `IT-ANALYSIS/KONCEPCE-potvrzovaci-okna-ea-file-bridge.md`.

## 5. Zbytek

| T6 | Jak | Očekávání |
|---|---|---|
| T6-29 | kopie repa mimo mount (`$HOME/tmp-eafb`), do `REG` v `FB_Main` přidán `"fbt_fake_write": { fn: "FB_OpElements", w: true }` → `node test\harness.js` | harness **červený** (kontrola úplnosti `SCOPE`); původní repo nedotčen |
| T6-32 | Miloš zavře pumpu; `state-cleanup.txt` → starý čas; schránka: dávka S1 (LOW create do A) → menu „Zpracovat davku ze schranky"; pak S2 (LOW create do A) | po S1 `state-cleanup.txt` počet běhů +1 a Output „Uklid automatickych baselines [report]…"; po S2 beze změny (úklid **právě jednou**); res v `responses\` |
| T6-23, T6-C | bankovní testy | přeskočeno, zapsat |

## 6. Úklid

- dávka delete `FBT-BL-*` (A…H, M, S, S2, CL1–3, R, prvek T10) — ELEVATED, okno Ano; baseline nad `#FB-TEST` před smazáním (rodič);
- fixtures baselines smazány WSF fáze 4 (před tím);
- `get_baselines #FB-TEST` = stav před + session baseline(s) + FB-AUTO z tohoto běhu;
- Miloš potvrdí Project Browser; `FBT-ROOT` smazal už T6-28 (jinak ručně v EA);
- `git diff src\` prázdný; výchozí politika nasazena (B29).

## 7–8. Zápis a ověření

`VYSLEDKY-2026-10-11.md` (tabulka T6 ✅/❌ + doklad res + klíč; tabulka oken T6-24; nálezy = návrh opravného zápřahu) · `PROTOKOL-EAFB.md` kap. 6j odstavec „ověřeno živě" · zadání v1.3 · `NAVRH-PROPSANI-DO-KANONU.md` označení · harness beze změny · commit `docs(e2e-baseline): zivy beh T6-1..T6-33 2026-10-11 nasazeny deploy_src, VYSLEDKY, PROTOKOL 6j overeno`.
