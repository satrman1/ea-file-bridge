# Pracovní poznámky běhu 2026-10-11 (Claude)

## Stav před (B01, res-20261011-B01-t6-1-cteni.json)
- #FB-TEST: 49 baselines (poslední: FB 2026-10-10 23:07:34, FB-AUTO - s20261010-1 2026-10-10 23:16:15 (session), FB-AUTO - s20261010-1 2026-10-10 23:39:42); 20 prvků přímo; t_document FB% = 48
- FBT-ROOT {8274372A-A0D7-4998-A78B-063B9C76CD36} id 1098 parent EA Addins 1052; ROOT1 {7A95B5FD-BD2E-4963-BD38-BFC3497BED44} id 11631 (založil Miloš 10:48)
- bez sekce baseline ✅ T6-1; get_selected_context = FBT-ROOT inWhitelist false

## B0
- B00a deploy: confirm_required 10:04:28, okno vypršelo 10:09:28 (300 s) — Miloš nestihl; restart pumpy 10:36:52 → nabídnuto znovu → Ano 10:37:08 → done, updated 119, created [], baseline decision none "cisty create", audit {8287A860-…}
  - NÁLEZ N-E2E-1 (kosmetika): okno u deploy_src: "Chysta se zapsat prvku." (chybí číslo), dva prázdné řádky
- B00b ping ok 10:37:44, EA 1715, 119 operací, 0 rozdílů jmen parametrů (FB_Audit, FindTargetMethod, GetTag mají Pos=0 u všech parametrů — pořadí v DB = pořadí src; pozorování, ne nález tohoto vlákna)
- state-session.txt přepsán na starý čas 10:03 → nový token s20261011-1 (potvrzeno jménem baseline v B04)
- setup B02a–d: všechny LOW bez okna (affectedPackages 1 — nové balíčky se nepočítají, jen #FB-TEST), decision none cisty create; GUIDy v ready/guids.json

## Varianta B0 — výsledky
- B03 T6-4 ✅ LOW, none/cisty create, A3 {AC264A36…}
- B04 T6-5 ✅ created "pod prahem", FB-AUTO - s20261011-1 2026-10-11 10:39:48 nad FBT-BL-A (subtree 3), journal targets 1 covered 1, manifest journal\20261011-B04-t6-5.json; elapsedMs 761
- B05 T6-6 ✅ reused "reuse session", táž baseline; get_baselines A = 1 (B05b)
- B06 T6-7 ✅ ELEVATED affectedPackages 3, Ano 10:40:22; 3 created nad B (2), C (1), D (2); žádná nad #FB-TEST; journal 3/3
- B07 T6-8 ✅ ELEVATED 2 pkg, Ano 10:40:39; scope jen FBT-BL-D (D1 sloučen); reused "reuse freshWithinMin" (10:40:23)
- B08 T6-9/13 ❌ nedosažitelné: E_RISK_BLOCKED affectedPackages 7 > 5 (gate před politikou), bez okna, bez sekce baseline, audit {AE75E662…}; soubor šel do processed\ (!)
  - NÁLEZ N-E2E-2: zadání T6-9 (7 balíčků → maxBaselinePackages) je s dev politikou mrtvá cesta — block.affectedPackages 5 = maxBaselinePackages 5 → gate blokuje dřív. Zkusit ve variantě C s block.affectedPackages 10.
- B09 T6-12 ✅ delete package D1 → scope rodič FBT-BL-D, reused freshWithinMin, Ano 10:41:46; journal uncovered delete
- B10 T6-14 ✅ delete E1, Ano 10:42:02, created FB-AUTO - s20261011-1 2026-10-11 10:42:02 nad FBT-BL-E, elapsedMs 747; confirm.timestamp 10:42:02 = čas ve jméně
- B11 T6-15 ✅ E_NO_BASELINE (E_WHITELIST FBT-ROOT), žádné confirm_required, results skipped, audit {32508DD3…}; ALE soubor v processed\ místo rejected\ (NÁLEZ N-E2E-3 — pump.wsf má řazení E_NO_BASELINE do rejected, ale živě nenastalo; B08 BLOCKED také processed\; zjistit z konzole)

(oprava: B08 i B11 jsou v rejected\ — N-E2E-3 ODVOLÁN, chyba čtení výpisu; konzole 10:48:44 "ODMITNUTO")
- B12 T6-27 ✅ confirm_required, riskReasons "bez pre-image - velikost neznama ($N odkaz na existujici/nejisty prvek ($0[0])); nutna rucni baseline nad #FB-TEST (koren whitelistu)"; okno (screenshot 10:52); Ne 10:52:26 → rejected E_RISK_REJECTED; = T6-13 (ELEVATED zamítnutá → 0 baselines). Pozorování: po zamítnutí res nenese sekci baseline (jen v riskReasons).
- B13 T6-30 ✅ E_ARGS "prefix FB-AUTO je vyhrazen executoru", gate riskReasons eskalace B4 → ELEVATED (okno Ano 10:53:53), žádná baseline; soubor processed\ (status error, ne rejected — ok dle pumpy)
- B14 T6-33 první pokus: scope FBT-BL-S správně (balíček diagramu), ALE probe "podstrom ma 0 prvku - prazdna package nebo falesna nula (B6)" → guided; Miloš Ano → "Potvrzeno, ale cerstva rucni baseline stale chybi" → pending; při restartu pumpy 11:02 nabídnuto znovu → Ne 11:02:44 → rejected
  - NÁLEZ N-E2E-3 (věcný): balíček obsahující JEN diagram(y) bez prvků = pro sondu "0 prvků = neznámá velikost" → každá dávka nad diagramovým balíčkem jde naváděnou cestou (ruční baseline). Odchylka 7 kap. 6j to říká pro prázdnou package, ale diagramový balíček prázdný není. Návrh: COUNT i t_diagram (nebo elementy+diagramy), nebo balíček s diagramem a 0 prvky brát jako "pod prahem" (zálohuje se diagram).
- B14a: prvek S-note do S (LOW). B14b T6-33 ✅: ELEVATED (rebuild + foreignDiagrams 1), Ano 10:57:49, created FB-AUTO - s20261011-1 2026-10-11 10:57:49 nad FBT-BL-S (subtree 1), ne nad FBT-BL-S2; messages 2 items
- B15 (c) dedupKey prvek + konektor: LOW, bez okna, decision none "bez menenych cilu" (klíče nové → create), updatedExistingApprox 2; SQL nad t_objectproperties/t_connectortag (+ t_diagramobjects v T6-33) — dialog EA: (Miloš nehlásil)
- Pozorování: ELEVATED okno pumpy — Miloš při B00a nestihl 300 s; "Chysta se zapsat prvku." (deploy_src), "zapisu 0" při nespočítaných metrikách (B26)

## Varianta A (FB_Whitelist + FBT-ROOT; sessionBaseline off; useCte true) — deploy B16 Ano 11:01:26 (updated 2)
- restart pumpy 11:02:13: "Repozitar: …EAExample.qea | Whitelist: …#FB-TEST, …FBT-ROOT | 1 polozek whitelistu patri jinemu repozitari | Session baseline vypnuta (sessionBaseline off). Zalohy se poridi automaticky az pred prvnim zapisem…" → T6-2 ✅ (identita + cesty, žádná nová baseline)
- B17 T6-2/(a) ✅ LOW update A2: probeMs 3 ≤ 500, subtree 4 status ok s useCte true (CTE nebo fallback — nerozlišitelné z res; RepositoryType vypíše WSF)
- B18 T6-28 ✅ delete FBT-ROOT: okno s řádkem "POZOR: parentOutOfWhitelist - zaloha nekryje smazany uzel…" (screenshot 11:04), Ano 11:04:04, created FB-AUTO - s20261011-1 2026-10-11 11:04:04 nad FBT-ROOT ({29D98D59-…}), packages[0].parentOutOfWhitelist true; po smazání t_document pro FBT-ROOT = 0, t_package FBT-ROOT = 0 (B18b)

## Varianta B (thresholdsShadow false, subtreeMax 10, requireRecoveryForUpdates true, auto) — deploy B19 Ano 11:05:25
- restart 11:05:41: "Session baseline preskocena (nad limitem) - zalohy vzniknou az u zapisu: …#FB-TEST (80 prvku > 10)" → T6-3 ✅
- B20 T6-10a ✅: confirm_required "nad prahem (podstrom 80 > subtreeMax 10)", okno (screenshot 11:08) + instrukce ruční baseline; Ano bez ruční → "Potvrzeno, ale cerstva rucni baseline stale chybi - davka se NEPROVEDLA", zůstala v pending; decision "skipped" action guided posture none
  - NÁLEZ N-E2E-4 (UX pumpy): po Ano bez ruční baseline pumpa OKAMŽITĚ zobrazí totéž okno znovu (smyčka continue v promptConfirm) — uživatel nemá přirozenou cestu "udělám baseline a vrátím se" jinak než Storno; okno by mělo po tomto stavu samo přejít do "čeká v pending" (nebo nabídnout jen Storno/Ne). Miloš: "hláška vyskakuje opakovaně"
- Miloš 11:09: ruční baseline "Rucni pred T6-10" nad #FB-TEST
- B20b T6-10 ✅: okno "Nalezena cerstva rucni baseline: Rucni pred T6-10 nad …#FB-TEST - po potvrzeni se davka provede" (screenshot), Ano 11:10:32, done, decision skipped, manual.ok true, 0 FB-AUTO; audit Artifact FB 20261011-B20b-t6-10 tag ai.baseline = "pkgGuid={CCD344F6…};name=;decision=skipped" (B20c)
- B21 T6-11 ✅: E_NO_BASELINE "nad prahem … destruktivni operace (delete_from_model) bez moznosti zalohy", action refuse, rejected\ (req-…B21-t6-11.20261011-111044.json), prvek T10 existuje (Note = T6-10b), audit Artifact FB 20261011-B21-t6-11 tag decision=failed
- B22 T6-26 ✅: matchByName FBT-BL-T10 v #FB-TEST: okno "BEZ ZALOHY: nad prahem…; davka muze prepsat prvky dohledane pres match/dedupKey", Ano 11:11:38, done, decision none, baseline.updatedExistingApprox 1, bez E_NO_BASELINE
- pending B20 (T6-10a) zůstává → při příštím restartu Ne

## Varianta C (probeBudgetMs 1 + block.affectedPackages 10) — deploy B23 Ano ~11:12:40
- B24 T6-16 ✅: "bez pre-image - velikost neznama (rozpocet sondy vycerpan (1 ms) pri expanzi); nalezena cerstva rucni baseline (Rucni pred T6-10 nad #FB-TEST)" (předek uvnitř whitelistu nalezen); Ne 11:13:14 → rejected
- B24b T6-9 ✅ (s block 10): confirm_required "nad prahem (dotcenych packages 7 > maxBaselinePackages 5)", 7 packages status "nemereno", action guided, 0 baselines, žádná nad předkem; Ne 11:13:50 (screenshot)
  - NÁLEZ N-E2E-5 (kosmetika): manual.found opakuje tutéž ruční baseline 7× (jednou per package) — v okně 7 řádků

## Varianta D (budgetMs 1) — deploy B25 Ano ~11:14:40
- B26 T6-25 ✅: ELEVATED "Metriky nespocitany - prekrocen rozpocet 1 ms", metricsComplete false; okno "Rozsah davky se nepodarilo spocitat - zachazi se s ni jako s menici." + "Zaloha pred zapisem: …FBT-BL-B (2 prvku)" (screenshot), NE "čistý create"; Ano 11:15:19 → created FB-AUTO - s20261011-1 2026-10-11 11:15:19 nad FBT-BL-B, reason "metriky nespoctany"; okno "zapisu 0" (kosmetika)

## Varianta E (bez sekce baseline) — deploy B27 Ano ~11:16:30
- B28 T6-31 ✅: LOW create A4 bez okna, done, warnings ["Baseline politika: polozka FB_RiskPolicy nema sekci 'baseline' - pouzity bezpecne defaulty (sessionBaseline off, uklid jen report)…"]
- B28b update C1: LOW, reused "reuse session" (defaults = plná politika), bez warningu (1× denně)

## R návrat — git show HEAD > RiskPolicy, git status src čistý, deploy B29 Ano ~11:17:30 (updated 1)

## Krok 3 úklid
- restart pumpy 11:20:30: "Session baseline teto session uz existuje: …#FB-TEST [FB-AUTO - s20261011-1 2026-10-11 10:36:54 (session)]" (reuse session baseline přes restart ✅); pending B20 → Ne 11:20:50
- WSF fáze 1 (11:21:26–11:21:55, log vysledky/FIXTURES-20261011-112155.txt): (a) RepositoryType() = 'SL3' ✅; CL1 6 + 3 ne-kandidáti = 9; CL2 8; (b) CreateBaseline vrací true (boolean) ×17; ~0,9 s/baseline
- B31 T6-17 ✅ hák (state-cleanup přepsán na 2026-10-09): LOW create A5, res.cleanup {mode report, total 24, candidates 3, planned 3, deleted 0, remaining 0, runs 2}, warnings "Uklid automatickych baselines [report]: kandidatu 3, smazal bych 3"; state-cleanup = 2026-10-11 11:22:21|2|2026-10-10 23:37:10
- B31b get_baselines CL1 = 9 (6 FB-AUTO + FB 2026-09-01 + AI-pre-s1-b1 + Pred refaktorem) beze změny ✅ T6-19 (ne-kandidáti nejsou v reportu) ✅ T6-20 (CL2 8× 7 dnů → 0 kandidátů; 24 celkem = 6+8+10 z běhu)
  - chyba obsluhy: můj SQL "o.Notes" → EA modál "SQL API Open FAILED… no such column: o.Notes" (11:26), pumpa stála do OK — potvrzuje lekci §10 (chybné SQL = modál), ne nález
- B32 T6-17 menu (screenshot 11:28): "Uklid automatickych baselines [report, z menu]: v modelu 24 automatickych baselines, kandidatu 3 (starsi nez 14 dni A mimo 3 nejnovejsich per balicek+uzivatel). Smazal bych 3: FBT-BL-CL1 | …10:00:01 | {07F7515F-…} | uzivatel - ; …10:00:02 {2A7BB269-…}; …10:00:03 {E94E16FF-…}" → Ne
  - NÁLEZ N-E2E-6 (UX, Miloš 11:28: "ten dialog je pro člověka úplně naprd - vůbec netuším, co maže"): dialog úklidu je strojový výpis (GUID, login "-"), chybí lidské shrnutí (co, proč, co zůstane, že ruční se nemažou)
- B32b menu delete (screenshot 11:29): "Smazano 3" (tytéž 3 GUIDy) → OK; B33b: CL1 get_baselines 6 (…04,05,06 + FB 2026-09-01 + AI-pre-s1-b1 + Pred refaktorem), t_document CL1 6 ✅ T6-18; audit artefakty 11664 (1122 report hák), 11666/11667 (menu report), 11668 (1129 "[delete]: kandidatu 3, smazano 3, selhalo 0") ✅
- WSF fáze 2 (11:31:07–11:31:47, FIXTURES-20261011-113147.txt): CL3 43× 20 dnů, 35 120 ms, true×43; state-cleanup přepsán 2026-10-09 → B34 hák: cleanup {report, total 64, candidates 40, planned 20, deleted 0, remaining 20, anomaly False, runs 3}; warning "kandidatu 40, smazal bych 20" ✅ T6-21 (maxDeletesPerRun 20); audit 11672 "Smazal bych 20 (zbyva 20 na dalsi behy)"; state = 2026-10-11 11:32:11|3|…
- WSF fáze 3 (CL3 +210 → 253; CL1 6, CL2 8) → menu 11:38 (screenshot): "v modelu 274 automatickych baselines, kandidatu 250 … ANOMALIE: 250 kandidatu > maxDeletesAnomaly 200 - nemaze se NIC, prosetri rucne." jen OK (bez Ano/Ne) ✅ T6-22; B36: t_document CL3 253 / CL2 8 / CL1 6 beze změny ✅; audit 11673 "[report]: kandidatu 250, smazano 0, selhalo 0, ANOMALIE"; state-cleanup se z menu nemění (zůstal 11:32:11|3) – očekávané
- B37 WSF fáze 4 (11:40:29–11:40:39, FIXTURES-20261011-114039.txt): DeleteBaseline true×267 (CL1 6/26 ms, CL2 8/12 ms, CL3 253/327 ms), výjimek 0; CL1–3 = 0 ✅ (pozn.: DeleteBaseline je řádově rychlejší než CreateBaseline ~0,9 s)

## Krok 4 T6-24 den práce (FBT-BL-R)
- před R: #FB-TEST 51 baselines; FB-AUTO v modelu celkem 10 (B39b); cizí UC pro R7 = "FBT UC Scenarios" {2977915E-…} v FBT-IT1 (2026-08-17)
- R1 B40 kostra (balíček FBT-BL-R + Actor Ctenar + UC-R1/UC-R2 + Class Pomocny prvek + UC diagram + place 3 + 2 asociace; writeOps 11, createOps 8): LOW, baseline decision none "cisty create" → **0 oken** ✅ (tabulka Dnes 0)
- R2 B41 scénáře (Basic Path 4 kroky) + 2 constraints do UC-R1 (vlastní session): ELEVATED „Operace create_or_update_scenarios/constraints je politikou klasifikovana ELEVATED"; baseline planned "pod prahem" → Miloš Ano 11:42 → created FB-AUTO - s20261011-1 2026-10-11 11:42:47 nad FBT-BL-R (4 prvky, 3,7 s); journal uncovered (scenarios/constraints mimo journal) → **1 okno** (Dnes 1 ✅; Po pravidlech má být 0 – Pravidlo 3 vlastní práce téže session)
- R3 B42 Actor Knihovnik + place na „UC prehled R" (diagram z předchozí dávky) + asociace: ELEVATED „foreignDiagrams 1 > 0" → Miloš Ano (~11:45, před odchodem) → baseline **reused** "reuse freshWithinMin" (11:42:47) → **1 okno**, 0 nových baselines ✅ (Dnes 1; Po pravidlech 0)
- 11:46 Miloš odchází; computer use (EA + Cscript full, cmd click). Zjištění: klik na Ano v MsgBox pumpy **nezabírá** (3×), Enter ano (výchozí tlačítko Ano) → dál potvrzuji klávesou: Return = Ano, N = Ne, Esc = Storno
- R4 B43 datový model (4 třídy × 6 atributů + 3 asociace; writeOps 31): ELEVATED „Prah ELEVATED prekrocen: writeOps 31 > 20"; dialog: „Chysta se vytvorit 7 prvku v 1 balicku. Balicky: FBT-BL-R. Bez zalohy - davka jen vytvari (undo = smazani dle razitek)." → Claude Enter 11:48 → done, baseline none (čistý create) → **1 okno** ✅ (Dnes 1, Po pravidlech 1)
- R5 B44 delete „Pomocny prvek": ELEVATED „Operace delete_from_model … ELEVATED" + „deleteTargets 1 > 0"; dialog „Chysta se SMAZAT 1 prvek z modelu. Ke smazani: Pomocny prvek, Kde (plna cesta)…, Zaloha pred zapisem: …FBT-BL-R (9 prvku)" → Claude Enter 11:49 → done, baseline **reused** freshWithinMin (11:42:47) → **1 okno** ✅ (Dnes 1, Po pravidlech 1), 0 nových baselines
- R6a B45a nová operace `vypujcKnhu` (překlep) na Kniha: LOW (writeOps 1, updatedExisting 1), done bez okna, baseline reused „reuse session" (11:42:47) → 0 oken
- R6b B45b oprava názvu přes guid → `vypujcKnihu`: LOW, done bez okna, reuse session → **0 oken**. Pozn.: řádek KONCEPCE „Překlep: 1 okno (až 3 kola) + ruční záloha" platil pro **velký balíček nad prahem**; v malém FBT-BL-R (8 prvků) se to nereprodukuje – řádek v T6-24 **nesrovnatelný**, ne důkaz zlepšení
- R7 B46 Alternate scénář do cizího UC „FBT UC Scenarios" (FBT-IT1, 2026-08-17): ELEVATED „create_or_update_scenarios … ELEVATED"; dialog „Chysta se upravit 1 prvek. Prvky: FBT UC Scenarios. Zaloha pred zapisem: …FBT-IT1 (7 prvku)" → Claude Enter 11:50 → done, **created** FB-AUTO - s20261011-1 2026-10-11 11:51:02 nad FBT-IT1 (5,5 s; EA ukazuje dialog „Export Package to Native/XMI File" po dobu CreateBaseline) → **1 okno** ✅ (Dnes 1, Po pravidlech 1 / fáze 2: 0)
- R7b B47 update notes Kniha + UC-R1 (vlastní session, updatedExisting 2): LOW, bez okna, reuse session → 0 oken

## T6-29 (kopie repa $HOME/tmp-eafb, mimo mount)
- čistá kopie: harness 435/436 (1 FAIL = chybějící docs/e2e-k8-qeax/req-A4.json v kopii → po dokopírování 436/436)
- + `"fbt_fake_write": { fn: "FB_OpElements", w: true }` v REG → **415/436, 21 FAIL**, mj. „BL-2 T6-29 uplnost SCOPE: … zapisove operace BEZ polozky SCOPE – expected [], got [fbt_fake_write]" a „I7 krit.11' uplnost projekcni tabulky proti registru: fbt_fake_write" ✅ T6-29; kaskáda dalších FAIL (politika nevalidní ⇒ vše ELEVATED, viz T6-31 sémantika); původní repo `git status src` prázdný ✅
- R8 B48 druhá iterace scénářů (Alternate do UC-R1, vlastní session, 18 min po 1. baseline): ELEVATED „scenarios … ELEVATED"; dialog „Chysta se upravit 1 prvek. Prvky: UC-R1 Vypujc knihu. Zaloha pred zapisem: …FBT-BL-R (8 prvku)" → Claude Enter 12:01 → done, **created** FB-AUTO - s20261011-1 2026-10-11 12:01:08 (2. baseline nad FBT-BL-R; freshWithinMin 15 vypršelo) → **1 okno**
- **Bilance T6-24** (9 dávek R1–R8 vč. R6a/b, R7b): oken **6** (R2, R3, R4, R5, R7, R8), 0 oken: R1, R6a, R6b, R7b. Nové FB-AUTO: **3** (FBT-BL-R 11:42:47, FBT-IT1 11:51:02, FBT-BL-R 12:01:08) vs dotčené balíčky **2** (FBT-BL-R, FBT-IT1) → kritérium „≤ počet dotčených packages" **NESPLNĚNO** (3 > 2) kvůli oknu freshWithinMin 15 min: každých 15 min práce ve stejném balíčku = další baseline. **Nález N-E2E-7**: kritérium T6-24 v zadání (korekce W2) je s `freshWithinMin: 15` splnitelné jen pro „den práce" kratší než 15 min; buď prodloužit okno (session-wide reuse pro ELEVATED, jako u LOW „reuse session"), nebo kritérium přeformulovat (≤ balíčky × ceil(doba/15 min)). Všechna okna odpovídají sloupci „Dnes" KONCEPCE kap. 5 (kromě nesrovnatelného řádku překlep).
- „Žádný dialog navíc proti dnešku" ✅ – žádné okno nad rámec tabulky Dnes; žádný požadavek na ruční baseline (všechny balíčky pod prahem subtreeMax 5000)
- T6-32 (schránka): **neprovedeno** – vyžaduje zápis do schránky (grant clipboardWrite odmítnut/nezodpovězen, Miloš pryč) a zavření pumpy; zbývá pro Miloše (postup v PROTOKOL kap. 4 řádek T6-32)
