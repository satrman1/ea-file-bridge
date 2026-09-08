# E2E ve VS Code — klikací protokol tenkého řezu F0 → F1 na DBK „Hodnoť knihu" (Z260907b-5)

*v1.1 — 2026-09-07 (Z260907b-4; **VYPLNĚN po živém běhu Po 7. 9. 16:20–18:45, Z260907b-5** — výsledky níže). Původně v1.0: Prostředí: VS Code + GitHub Copilot Pro+ (agent `sa-analytik`, model Claude Opus 5), EA s `EAExample.qea`, transport pumpa. Zadání: `IT-ANALYSIS/Zadani-Portace-VSCode-v2.md` kap. 5.2 (kola), kap. 9 (AK-6, AK-7, AK-8); scénář PV-R2 revidován 7. 9. večer: místo SportHub/UC-95004 **Databáze knih (DBK), UC „Hodnoť knihu"** z `zadani/DBK-hodnot-knihu-brd.md` (podklad `IT-ANALYSIS/podklady/business-sample-book-db.png`). Rituál, který agent provádí: `.github/skills/e2e-f0-f1/SKILL.md`. Build, který se testuje: `docs/e2e-vscode/build-doma.log`.*

## Jak protokol používat

Sedíš u VS Code a EA, vedle běží **interaktivní vlákno Z260907b-5** (prompt je v dávce `IT-ANALYSIS/zaprah-vlaken-2026-09-07b.md`, sekce Z260907b-5 — založ ho až po kole 0). Vlákno si `responses\res-*.json` čte samo z disku. **Ty mu po každém kole vkládáš jen to, co nevidí:**

1. **přepis odpovědi Copilota** z chatu (celý text kola — kopíruj, neparafrázuj),
2. **řádek z Output tabu *AI Bridge* v EA** (`FB <id> -> <status>: N ops (…)`) — jen ten jeden řádek,
3. **číslo z ukazatele kontextu** u vstupního pole chatu Copilota (procenta) — když je nad 50 %, přilož screenshot,
4. **zda vyskočil jakýkoli „Allow" / „Continue" dialog** Copilota (terminál, nástroj, přístup k souboru mimo workspace) — a co jsi zvolil,
5. u ELEVATED dávky **text popupu pumpy** a co jsi klikl.

Pravidla během běhu:

- **Dávky ručně neopravuj a do `requests\` nesahej.** Když Copilot sejde z cesty, napiš to do vlákna — dostaneš větu, kterou napíšeš do chatu Copilota. Opravy kanonu se dělají až po běhu (jinak měříme dva systémy najednou).
- **`responses\res-*.json` nemaž**, jsou to důkazy.
- Přerušit běh smíš kdykoli; po 12 dávkách celkem se běh vyhodnotí jako neprošlý (AK-6 = ≤ 10).
- Na `/compact` v chatu nesahej — AK-8 měří kontext bez něj. Když ukazatel překročí 60 %, zapiš to a pokračuj.

Co znamená status v Output tabu: `done` = provedeno · `confirm_required` / konzole pumpy `CEKA NA POTVRZENI` = ELEVATED, čeká na tvůj klik v EA · `error` = zastaveno na chybě (Copilot má poslat novou dávku s novým id, ne tu samou znovu) · `blocked` = Risk Gate zamítl (tvrdý stop, hlásit do vlákna).

## Kolo 0 — příprava (ty, bez Copilota)

| # | Udělej | Má být vidět | Zapiš |
|---|---|---|---|
| 0.1 | Otevři EA s `EAExample.qea`. | Project Browser, package `#FB-TEST` v `Example Model / Model Based Add-Ins / EA Addins`. | — |
| 0.2 | Dvojklik na `C:\GIT\ea-file-bridge\pump.wsf`. **Před tím zavři každé starší okno pumpy — smí běžet jen jedna** (dvě pumpy provedou tutéž dávku dvakrát, N5). | Okno konzole pumpy: `=== EA File Bridge pumpa v0.5 …`, `Pripojeno na EA: …`, `Code loader: N operaci nacteno`, řádek session baseline nad `#FB-TEST`. Kdyby hlásila starou dávku v `pending\`, dej v popupu **Ne**. | N operací: ____ |
| 0.3 | Otevři VS Code na složce `C:\GIT\ea-file-bridge` (jen tato složka, ne multi-root). Source Control panel: žádné změny, poslední commit = `chore(zadani): scénář tenkého řezu → DBK Hodnoť knihu (PV-R2 rev.) + protokol E2E`. | Ve stromu: `.github\skills\` (8 složek), `.github\agents\sa-analytik.agent.md`, `zadani\DBK-hodnot-knihu-brd.md` (jediný soubor v `zadani\`). | commit hash (z panelu Source Control → historie): ____ |
| 0.4 | Otevři Copilot Chat, přepni na režim **Agent**, v rozbalovacím seznamu agentů vyber **`sa-analytik`**, model **Claude Opus 5**. | V hlavičce chatu je vidět `sa-analytik` a `Claude Opus 5`. Když `sa-analytik` v seznamu není: Nastavení → hledej `chat.agentFilesLocations` (má obsahovat `.github/agents`) a `chat.useAgentSkills` (zapnuto) — zapiš, co bylo jinak. | agent ✅/❌ · model ✅/❌ |
| 0.5 | Nový chat (ikona +), nic nepiš. Zapiš stav ukazatele kontextu **před prvním dotazem**. | Ukazatel u vstupního pole (procenta nebo kolečko; hover ukáže číslo). | kontext start: ____ % |
| 0.6 | Založ vlákno **Z260907b-5** v Cowork (prompt z dávky), vlož mu tento vyplněný řádek 0.1–0.5. | — | čas startu: ____ |

## Kola 1–9 (Copilot; ty píšeš doslova to, co je v uvozovkách)

Pro každé kolo: napiš text → počkej, až Copilot dopíše → zkopíruj odpověď do vlákna Z260907b-5 + Output řádek + kontext % → vlákno řekne „další kolo" nebo dá opravnou větu.

### Kolo 1 — ping (kotva)

- **Napiš:** „`/e2e-f0-f1 zadani/DBK-hodnot-knihu-brd.md`"
- **Agent má:** v **první větě odpovědi uvést kontrolní kód `SA-KIT-VSC-Q9M`** (AK-7 první část — bez něj instrukce nenačetl), pak ukázat dávku `ping` v chatu, uložit ji jako `requests\req-<id>.json` a čekat na odpověď pumpy; z ní vypsat repozitář `EAEXAMPLE.QEA`, whitelist `#FB-TEST` s GUID a `access`.
- **Očekáváš:** konzole pumpy `Zpracovavam req-<id>.json … Hotovo`; Output tab `FB <id> -> done: 1 ops (1 ok, 0 chyb)`. Žádný Allow dialog (agent jen zapisuje soubor ve workspace).
- **Zapiš:** kód uveden ✅/❌ · id dávky · Output řádek · kontext % · Allow 0/1.
- **Když:** Copilot místo dávky napíše text „pošlu ping" a čeká, nebo chce po tobě obsah res souboru → napiš do vlákna, dostaneš větu. Copilot **smí** číst `responses\res-<id>.json` sám (u pumpy je to jediný záznam výsledku — chat ACK pumpa netvoří).

### Kolo 2 — převzetí zadání (bez dávky)

- **Napiš:** nic — agent pokračuje sám; když se zastaví, napiš: „`Pokračuj kolem 2: převezmi zadání ze zadani/DBK-hodnot-knihu-brd.md.`"
- **Agent má:** načíst skill `prevzeti-zadani`, přečíst BRD, vyextrahovat 3 požadavky (`DEMO-91051` hodnocení 1–5★, `-91052` celkové hodnocení v %, `-91053` 1 IP = 1×; s AK a Weight), navrhnout hranici (mimo hranici: vyhledávání/top 50, autoři, administrace, technika IP) a projekt. Smí udělat **jednu čtecí dávku** recon (`find_packages_by_name` DBK / `find_elements_by_name` hodnocení, kniha; ideálně v téže dávce i `query` na nejvyšší obsazené `UC-#####` v `#FB-TEST` pro kolo 6) — počítá se do limitu 10. Skončit **HUMAN_DECISION** v chatu: co schválit.
- **Očekáváš (recon):** v `EAEXAMPLE.QEA` **žádný obsah DBK není** — `find_packages_by_name` / `find_elements_by_name` na DBK, kniha, hodnocení = 0 nálezů (pilot DBK z července žije v jiném repozitáři, EA17_Yoga_QEA2, a do běhu nevstupuje). Agent to má vykázat jako „bez existujícího kontextu" a navrhnout **nový** obsah pod `#FB-TEST`; nesmí si kontext vymyslet. Pod `#FB-TEST` jsou `FBT-*`, `SportHub` s UC-95001…95005 a 2× `UC …` z iterace 7. Když recon ukáže něco jiného, zapiš to.
- **Tvoje odpověď (HUMAN_DECISION):** „`Schvaluji: hranice a požadavky DEMO-91051–91053 dle BRD, mimo hranici dle BRD. Projektovou package nezakládej — package Business Requirements dej přímo pod #FB-TEST (jedna nová package na dávku), UC package později také přímo pod #FB-TEST.`"
- **Zapiš:** počet čtecích dávek v kole (0/1) · požadavky rozpoznány 3/3 ✅/❌ · zástupný text v dávce (`<…>`, `TODO`) ✅ nebyl / ❌ byl · kontext %.

### Kolo 3 — zápis požadavků (1 dávka, LOW)

- **Napiš:** nic (po schválení agent pokračuje); jinak „`Pokračuj kolem 3.`"
- **Agent má:** načíst skill `eafb-bridge`, ukázat dávku v chatu s jednou větou vysvětlení, zapsat ji: **jedna** nová package `Business Requirements` přímo pod `#FB-TEST` + 3 Requirement elementy `DEMO-91051 Zadání hodnocení knihy návštěvníkem` atd. (notes = popis + AK), řetězené přes `$N` v téže dávce. Bez `matchByName` (recon prokázal, že cíle neexistují).
- **Očekáváš:** Output tab `FB <id> -> done: 4 ops (4 ok, 0 chyb)` + výpis `[vytvoreno] package "Business Requirements" …` a 3× element. **Žádný popup** (1 package = LOW). Agent po ACK vypíše GUIDy nové package a elementů.
- **Zapiš:** id dávky · Output řádek · popup ne ✅ / ano ❌ (= salámování nebo víc packages) · warnings v ACK (agent má říct „0 warnings") · kontext %.

### Kolo 4 — QA sada F0 (2 dávky: čtecí + LOW)

- **Napiš:** nic; jinak „`Pokračuj kolem 4: QA F0.`"
- **Agent má:** načíst `emr-qa`, poslat **čtecí** dávku (obsah package Business Requirements, elementy) a vyhodnotit sadu F0 (každý FR registrován, AK v notes, hranice) → QA report jako Artifact do `#QA` (LOW dávka). Blokující nález = opravná dávka (počítá se do „opravných").
- **Očekáváš:** Output `FB <id> -> done: … (… ok, 0 chyb)` 2×; verdikt agenta **pass**. `#QA` package možná neexistuje — agent ji smí založit v téže dávce (pořád 1 nová package = LOW).
- **Zapiš:** 2 id dávek · Output řádky · verdikt QA F0 (pass / pass s W / fail) · opravná dávka 0/1 · kontext %.

### Kolo 5 — identifikace a specifikace UC (bez dávky, HUMAN_DECISION)

- **Napiš:** nic; jinak „`Pokračuj kolem 5: identifikace a specifikace UC.`"
- **Agent má:** načíst `use-case-analyst` + `use-case-model`, **před návrhem přečíst pravidla identifikace a scénářů a v odpovědi uvést kontrolní kód `UC-PRAVIDLA-R4T`** (AK-7 druhá část). Návrh: aktér **Návštěvník** (v `#FB-TEST` neexistuje — založí se; aktéři SportHub Člen/Recepční se nepoužijí), UC **„Hodnoť knihu"** (cíl: návštěvník ohodnotí knihu 1–5★; pokrývá DEMO-91051/52/53), specifikace: PRE (zobrazen detail knihy), PST (hodnocení uloženo, celkové % přepočteno), ASU, BE (základní průchod), AF/EF (druhé hodnocení z téže IP = odmítnutí; neplatná hodnota) s odbočkou na krok BE a návratem, lokální BRU (hodnota 1–5; 1 IP = 1× na knihu; výpočet % z průměru). Skončit HUMAN_DECISION. *(Pro vyhodnocení ve vlákně -5, ne pro agenta: srovnávací vzor je `IT-ANALYSIS/md-mirror/dbk/use-cases/UC-91002.md` z červencového pilotu v EA17_Yoga_QEA2 — mimo workspace.)*
- **Kontrola obsahu (ty, 2 minuty):** název UC v rozkazovacím způsobu · kroky BE střídají Návštěvník / Systém · v krocích **není** GUI ani text pravidel (pravidla jsou BRU odkazované z kroků) · AF/EF mají krok, na který se vážou.
- **Tvoje odpověď:** „`Schvaluji návrh UC Hodnoť knihu beze změn. Pokračuj kolem 6.`" (nebo s úpravou jednou větou — zapiš ji).
- **Zapiš:** kód `UC-PRAVIDLA-R4T` uveden ✅/❌ · počet BE kroků · AF/EF počet · BRU počet · kontext % (tady bývá nejvyšší — `use-case-analyst` má 36 souborů; screenshot, když > 50 %).

### Kolo 6 — kostra UC v EMR (1 řetězená dávka, LOW)

- **Agent má:** načíst `emr-scaffold` (režim B). Číslo UC = nejvyšší obsazené `UC-#####` v `#FB-TEST` + 1 (z recon kola 2; nemá-li ho, jedna čtecí dávka navíc — zapiš): očekávej **UC-95006** (kulisa SportHub drží 95001…95005; kdyby už nebyla, UC-95001 — zapiš skutečné číslo). Pak **jedna** zápisová dávka `$N`: package `UC-95006 Hodnoť knihu` přímo pod `#FB-TEST` (TV `SA-Status = proposed`) → UseCase s kompozitním diagramem `CSOB-ITAN::FA-Behavioral` → `UCR-95006` (Use Case Realization) → diagram `version_UC-95006 …` → aktér Návštěvník (nový, v téže package) —Association→ UC, UCR —Realization→ UC, umístění na diagram + Boundary.
- **Očekáváš:** Output `FB <id> -> done: N ops (N ok, 0 chyb)`, **bez popupu** (1 nová package). Agent vypíše GUID package a diagramů a **vykáže ruční krok** „posunout Auto Name Counter".
- **Když** si agent číslo vymyslí bez čtení (např. `UC-91002` z domácího vzoru v kanonu) → napiš: „`Číslo UC urči podle pravidla nejvyšší obsazené UC-##### v #FB-TEST + 1.`" a zapiš jako nález šablony (ne opravnou dávku).
- **Zapiš:** číslo UC · id (+ čtecí, byla-li) · Output řádek · popup ne ✅ · warnings (agent vypíše) · ruční krok counter vykázán ✅/❌ · kontext %.

### Kolo 7 — scénáře, constrainty, BRU, traceabilita (1 dávka, **ELEVATED**)

- **Agent má:** jedna dávka: `create_or_update_scenarios` (BE + AF/EF, `attachTo`/`join` = číslo kroku), `create_or_update_constraints` (PRE/PST/ASU), `create_or_update_requirements` (BRU pod UC), konektory `Realization` UC → DEMO-91051/52/53. Dávku ukázat v chatu, zapsat, **čekat** na potvrzení.
- **Očekáváš:** konzole pumpy `CEKA NA POTVRZENI …` a **popup pumpy** „EA File Bridge – potvrzení dávky <id>" s výčtem operací a hash prefixem. **Klikni Ano.** Pak Output `FB <id> -> done: …`. Agent poté **přečte warningy** (typicky `join` nebo typ BRU) — je-li warning, pošle **opravnou** dávku (rebuild kompletní sady na GUID elementu), ne opravu ručně a ne tutéž dávku znovu.
- **Zapiš:** id · text popupu (opiš první 2 řádky + počet operací) · klik Ano čas · Output řádek · warnings počet · opravná dávka 0/1 (+ její id a Output řádek) · kontext %.
- **Chyba, kterou hlídáme:** agent po `confirm_required` pošle dávku znovu nebo do ní přidá `confirm`/`nonce` → **zastav ho** („`Nic neposílej, čekej na finální výsledek — potvrzuji v EA.`") a zapiš nález.

### Kolo 8 — QA sada F1 (2 dávky: čtecí + LOW)

- **Agent má:** načíst `emr-qa` F1: čtecí dávka (`t_objectscenarios`, `t_objectconstraint`, konektory, obsah UC package, diagramy — SQL v dialektu **sqlite**) + report do `#QA`.
- **Očekáváš:** verdikt **pass s varováními**, kde **jediné** W/B jsou kontroly **6/6b** (logická obrazovka neexistuje — záměrně mimo řez). Cokoli jiného B = opravná dávka (limit 2 celkem).
- **Zapiš:** 2 id · Output řádky · verdikt · seznam W/B kontrol (čísla) · opravná dávka 0/1 · kontext %.

### Kolo 9 — Gate Record G1 (1 dávka, LOW)

- **Agent má:** podklad G1 v chatu (co vzniklo s GUIDy a plnými cestami, QA verdikt, confidence flags, tier) → HUMAN_DECISION.
- **Tvoje odpověď:** „`G1 schvaluji, tier dle návrhu. Zapiš Gate Record.`"
- **Očekáváš:** Artifact do `#GATES` (TV `gate=G1`, datum, rozhodl, výsledek, tier), Output `done`. Package `#GATES` pod `#FB-TEST` **neexistuje** — agent ji založí v téže dávce jako Gate Record (1 nová package = pořád LOW, bez popupu); stejně jako `#QA` v kole 4. Kdyby ji zakládal samostatnou dávkou, je to dávka navíc do limitu — zapiš. Agent na závěr shrne: počet dávek (z toho opravných), ELEVATED 1, QA F0/F1, GUID + cesta UC package, ruční kroky.
- **Zapiš:** id · Output řádek · `#GATES` založena v téže dávce ✅/❌ · souhrn agenta (celý do vlákna) · kontext % **konečný**.

## Tabulka výsledků (vyplň průběžně)

| Kolo | Co | Dávka id | Output řádek (ACK) | Popup / klik | Opravná | Allow dialog | Kontext % | Poznámka |
|---|---|---|---|---|---|---|---|---|
| 0 | příprava | — | — | — | — | — | 0 | N operací = 105 (pumpa); **byla otevřená i druhá pumpa z dopoledne** (zjištěno až v kole 6) |
| 1 | ping | 20260907-E1 | `done: 1 ops (1 ok)` (Output řádek smazán, doloženo `res-…E1.json`) | — | — | 0 | 3 | kód SA-KIT-VSC-Q9M ✅ v první větě |
| 2 | převzetí zadání (recon 0) | — | — | — | — | 0 | 3 | 3/3 požadavky ✅, recon vynechán (dotazy přibalil do kola 4) — dobře; UC pojmenoval „Ohodnotit knihu" (infinitiv, v kole 5 sám opravil); zeptal se na `AI-User` |
| 3 | Business Requirements + 3 Req | 20260907-E2 | `done: 2 ops (2 ok)` risk=**ELEVATED** | **Ano** (nemělo být) | — | 1 (obsah dialogu nezjištěn — doplní Miloš) | 3 | ELEVATED kvůli `matchByName: true` na nové package (N1), ne kvůli `$N` |
| 4a | QA F0 čtení | 20260907-E3 | `done: 5 ops (5 ok)` | — | — | 0 | 3 | res 11 kB v jednom řádku — Copilot dočetl jen část, dotazy zopakoval v E4 (N4) |
| 4b | QA F0 report (+ recon UC counter, aktéři, MDG) | 20260907-E4 | `done: 6 ops (6 ok)` risk=**ELEVATED** confirmedAt 16:31:30 | **Ano** (nemělo být) | — | 0 | 3 | verdikt **pass s W** (B=0, W=2, I=1); `#QA` v téže dávce ✅; ELEVATED opět `matchByName` (N1); MDG dotaz chybný → falešné „bez MDG" (N3) |
| 5 | návrh UC (bez dávky) | — | — | — | — | 0 | 5 | kód UC-PRAVIDLA-R4T ✅ · BE 8 kroků · AF 2 (AF-2 na pokyn vypuštěn) / EF 2 · BRU 3 · název „Hodnoť knihu" (opraven na pokyn z „Ohodnoť") |
| 6 | kostra UC | 20260907-E5 | `done: 8 ops (8 ok)` risk=**LOW** | ne ✅ | — | 0 | 9 | UC-95006 ✅ · counter vykázán ✅ · warnings 0 · **provedeno 2× (dvě pumpy → duplicitní package 1082, N5)** · typování fallback UML+stereotyp místo `CSOB-ITAN::` (N3) |
| 7 | scénáře + BRU + trace | 20260907-E6 | `done: 4 ops (4 ok)` risk=ELEVATED writeOps=14 | **Ano** 18:20:59 | — | 0 | 9 | popup: „Chysta se vytvorit 3 a upravit 3 prvku … Operace 'create_or_update_scenarios' je politikou klasifikovana ELEVATED (+ 2 dalsi duvody)"; warnings = 0; join AF→3, EF-2→3, EF-1→End správně |
| X1 | **úklid prostředí** (mimo rozpočet): delete duplicitní package 1082 | 20260907-X1-duplikat | `done: 1 ops (1 ok)` risk=ELEVATED | **Ano** | — | 0 | — | dávku připravilo vlákno -5 (`ready/`), Miloš zkopíroval; druhá pumpa zavřena |
| 8a | QA F1 čtení | 20260907-E7 | `done: 8 ops (8 ok)` | — | — | 0 | 12 | op 1 `SELECT … Type FROM t_objectconstraint` = neexistující sloupec → **modální dialog EA** + `ok, rowCount 0` (falešná nula, N2) |
| 8a' | QA F1 dočtení | 20260907-E8 | `done: 4 ops (4 ok)` | — | ✅ (čtecí) | 0 | 12 | `SELECT *` — constrainty 4/4 ✓ |
| 8b | QA F1 report | 20260907-E9 | `done: 2 ops (2 ok)` risk=LOW | — | — | 0 | 12 | verdikt **pass s W**; **B = jen 6/6b** ✅; W navíc: 6c aktér v UC package (dle protokolu), typování bez MDG (N3), 1c umístění pod #FB-TEST (dle protokolu) |
| 9 | Gate Record G1 | 20260907-EA | `done: 2 ops (2 ok)` risk=LOW | — | — | 0 | 13 | `#GATES` v téže dávce ✅ · GR `{3CD8A76C-…}` · souhrn agenta úplný (dávky, ELEVATED, QA, GUIDy, ruční kroky) |
| **Σ** | | **dávek = 10** (E1–E9, EA) + 1 úklid prostředí mimo rozpočet | | **ELEVATED = 3** (E2, E4, E6) | **opravných = 1** (E8, čtecí) | **Allow = 1** (kolo 3–4) | **max % = 13** | |

Souhrn agenta na konci (doslova zkráceno): 10 dávek, 1 opravná (E8), ELEVATED 3 (E2/E4 `matchByName`, E6 politika scénářů), kódy SA-KIT-VSC-Q9M + UC-PRAVIDLA-R4T, QA F0 pass s W (B=0), QA F1 pass s W (B=2 = 6/6b), výstup `#FB-TEST/UC-95006 Hodnoť knihu` {65D45022-4B79-4aae-AE12-5DD704040BD1} (UseCase {BD9BCAB1-1CF3-4e99-9B84-77EC0009075A}, UCR, aktér Návštěvník, boundary, detail + version diagram, 4 scénáře, 4 constrainty, 3 BRU, 3 Realization na DEMO-91051/52/53), `Business Requirements` {655F0D69-…}, `#QA` {DA02D755-…} (3 Artifacty), `#GATES` {5663EE51-…} (GR-G1); ruční kroky: counter 95007, přesun z #FB-TEST, aktér do ACTORS, zaokrouhlení % (BRU95006-3). Agent sám správně pojmenoval kandidáty do kanonu: `matchByName` → ELEVATED, `ConstraintType`, falešná nula.

## Vyhodnocení AK-6 / AK-7 / AK-8 (vyplní vlákno Z260907b-5 po běhu)

| AK | Kritérium | Limit | Naměřeno | ✅/❌ |
|---|---|---|---|---|
| AK-6a | dávek celkem | ≤ 10 | 10 (+1 úklid prostředí mimo rozpočet agenta) | ✅ |
| AK-6b | opravných dávek | ≤ 2 | 1 (E8, čtecí dočtení po falešné nule) | ✅ |
| AK-6c | ELEVATED potvrzení | právě 1 (kolo 7) | 3 (E2, E4 kvůli `matchByName`; E6 = to očekávané) | ❌ — příčina = mezera kitu (N1), po opravě kanonu by běh dal 1 |
| AK-6d | QA F0 | pass | pass s varováními (B=0, W=2: umístění pod #FB-TEST, razítka ověřena až v E4) | ✅ |
| AK-6e | QA F1 | pass s W, jediné B/W = 6/6b | pass s W; **B = jen 6/6b** ✅; W navíc 3 (6c aktér, typování bez MDG, 1c umístění) | ✅ s výhradou (W navíc: 2× důsledek zadání protokolu, 1× N3) |
| AK-6f | Gate Record G1 zapsán | ano | ano — `#GATES` založena v téže dávce, TV gate/datum/rozhodl/vysledek/tier | ✅ |
| AK-6g | Allow / Continue dialogy | 0 | 1 (kolo 3–4; na co se ptal, Miloš nezaznamenal) | ❌ (neurčeno) |
| AK-7a | kód `SA-KIT-VSC-Q9M` v první odpovědi | ano | ano, první řádek odpovědi | ✅ |
| AK-7b | kód `UC-PRAVIDLA-R4T` v kole 5 | ano | ano (pozn.: agent kód nejdřív hledal grepem „kontroln|kód", teprve pak četl pravidla — důkaz načtení je slabší, než AK předpokládá; obsah návrhu ale pravidla respektoval) | ✅ |
| AK-8 | ukazatel kontextu, maximum přes všechna kola (bez `/compact`) | ≤ 60 % | **13 %** (969/7000; kolo 5 = 5 %, kolo 6–7 = 9 %, kolo 8 = 12 %) | ✅ |

Verdikt tenkého řezu: ☐ prošel · ☒ **prošel s nálezy** · ☐ neprošel — důvod: obsahově F0→F1 kompletní a správné (UC, scénáře s join, constrainty, BRU, traceabilita, QA F0/F1, G1) v 10 dávkách a 13 % kontextu; neprošly AK-6c (3× ELEVATED — mezera kitu u `matchByName`, opraveno v kanonu) a AK-6g (1 Allow dialog nezdokumentovaný); prostředí přidalo duplicitní provedení E5 (dvě pumpy).

## Nálezy (klasifikace: šablona `_vscode/` · kanon `Skilly/<skill>` · bridge `src/` · prostředí)

| # | Kolo | Co se stalo (1–2 věty) | Klasifikace | Oprava (kam) |
|---|---|---|---|---|
| N1 | 3, 4 | Agent dal na nově zakládanou package `matchByName: true` („idempotence bez reconu"). Risk Gate klasifikuje `$N` na package s `matchByName` jako „nejistý původ" (fail-closed B3) a novou package počítá jako cizí → ELEVATED 2×. Agentova diagnóza („každý `$N` je ELEVATED") byla špatně; po větě z vlákna -5 šla E5 bez `matchByName` jako LOW. Pravidlo bylo jen v `emr-zapis.instructions.md` (applyTo `requests/**`), které agent při skládání zjevně neměl v kontextu. | šablona `_vscode/` | ✅ `eafb-bridge/SKILL.md` (nové pravidlo), `copilot-instructions.md` bod 7, `e2e-f0-f1/SKILL.md` kola 3/4/6 |
| N2 | 8a | Dotaz `SELECT … Type AS ConstraintType FROM t_objectconstraint` — sloupec se jmenuje `ConstraintType`. EA otevřelo modální dialog „SQL API Open FAILED: no such column: Type" (Miloš musel odkliknout), bridge vrátil `ok, rowCount: 0`. Stálo 1 dávku (E8). | šablona + **bridge** | ✅ `eafb-bridge/SKILL.md` (sloupce QA tabulek, falešná nula), `e2e-f0-f1` kolo 8; **bridge ⚠ částečně 8. 9. (Z260908-1, v0.13)**: `query` vrací `error`/`E_SQL` (falešná nula pryč — živě V1/V3 ✅); **dialog zůstává** — `SuppressEADialogs` ho živě nepotlačil (V1b: vlastnost `true` přijala, dialog z Database API nekryje), bridge bez další páky → obrana = kit „ověř sloupce" (`OVERENI-S-OPRAVY-2026-09-08.md`) |
| N3 | 4b, 6 | Agent „ověřil", že repozitář nemá MDG, dotazem `Object_Type LIKE '%::%'` / `Diagram_Type LIKE '%::%'` — tam MDG nikdy není (StyleEx `MDGDgm=`, t_xref). V tomtéž `#FB-TEST` přitom SportHub UC-95001 má diagram `CSOB-ITAN::FA-Behavioral`. Výsledek: UC package typována fallbackem (UseCase + Collaboration «Use Case Realization», diagram Use Case / Class místo FA-Behavioral / Version Root Diagram) a QA F1 W navíc. | šablona + kanon | ✅ `eafb-bridge/SKILL.md` (MDG detekce, vzor z existující package), `e2e-f0-f1` kolo 4/6 |
| N4 | 4a | `res-…E3.json` (11 kB, jeden řádek) Copilot nedokázal přečíst celý („výstup spadl za limit čitelnosti") a dotazy zopakoval v E4 — bez ztráty dávky, ale dvojí čtení. Copilotův file search navíc `responses/` nevidí (gitignore → „No matches found"), soubor otevře jen přímo cestou. | prostředí + bridge | ✅ `eafb-bridge/SKILL.md` (číst celý soubor, opakovat kompaktně); **bridge ✅ 8. 9. (Z260908-1, v0.13)**: `FB_Main` píše res odsazený (1 mezera/úroveň, obsah beze změny); search.exclude pro `responses/` je věc nastavení VS Code, ne kitu |
| N5 | 6 | **Dvě běžící pumpy** (dopolední z baseline spike + odpolední) vzaly `req-…E5.json` obě → package `UC-95006` vznikla 2× (1082 a 1083, ids prokládané 18:19:14–18:19:31), `res-E5.json` přepsán druhým během; Copilot pracoval s GUIDy z prvního (1083). Úklid: dávka `X1-duplikat` z vlákna -5 (ELEVATED, Ano), druhá pumpa zavřena. E6 už jela jednou. | **prostředí** (+ bridge kandidát) | protokol kolo 0.2 doplněn („jen jedno okno pumpy"); **bridge ✅ 8. 9. (Z260908-1, v0.13)**: `pump.wsf` drží zámek `requests\.pump.lock`, druhý start „Pumpa uz bezi" + exit 2; živé ověření V2 (dvojí start). Atomický přesun do `processing/` neřešen (zámek stačí) |
| N6 | 3–4 | Vyskočil 1 Allow/Continue dialog, Miloš potvrdil, obsah nezaznamenán → AK-6g nelze vyhodnotit. | prostředí / obsluha | příště: text dialogu do vlákna před kliknutím (protokol „Jak protokol používat" bod 4 to říká) |
| N7 | 2 | Agent se zeptal na hodnotu razítka `AI-User` (login z pingu prázdný, security vypnutá) — správně, ale protokol s tím nepočítal. | šablona | ✅ `e2e-f0-f1` kolo 2 (otázka v HUMAN_DECISION) |
| N8 | 2, 5 | UC nejdřív „Ohodnotit knihu" (infinitiv, kolo 2 před čtením pravidel), v kole 5 „Ohodnoť knihu", na pokyn „Hodnoť knihu". Kontrolní kód R4T agent našel grepem a teprve pak četl pravidla. | pozorování | bez opravy; AK-7 měří přítomnost kódu, ne hloubku čtení — pro banku zvážit kód uvnitř věty pravidla, ne v hlavičce |
| N9 | 8b | QA F1 W „aktér v UC package místo ACTORS" a „umístění pod #FB-TEST místo /Projects" jsou důsledek zadání protokolu (jediná whitelist větev, aktér nový v téže package) — agent je správně zdůvodnil. | pozorování | bez opravy |

Známé předem (neopravovat během běhu): SOS / Core UC pro tenký řez neexistuje — agent v kole 2 vykáže „mantinely nedostupné" jako omezení hranice a pokračuje (kdyby na odkazu na SOS trval, je to nález šablony, ne chyba běhu) · doménové typy do F0–F1 bez logické obrazovky nevstupují (kontrola 6 QA F1 = W/B záměrně; DTO/entity až F2–F3) · package `#QA` (kolo 4) a `#GATES` (kolo 9) pod `#FB-TEST` neexistují, agent je zakládá v téže dávce jako report/record · číslo UC = `UC-95006`, protože kulisa SportHub (UC-95001…95005) v `#FB-TEST` stále existuje (P3 z 5. 9.) · kontroly 6/6b v QA F1 = W/B záměrně · build WARN u `scenario-phrases.md` = falešný poplach (viz `build-doma.log`).

## Po běhu (stav 7. 9. večer)

Hotovo vláknem Z260907b-5: protokol vyplněn, kanon opraven (N1–N3, N7 → `Skilly/_vscode/`), rebuild doma thin (`docs/e2e-vscode/build-doma-2.log`, 60 souborů, sweep 0, verify OK, harness 223/223), commit lokálně. Zbývá Miloš: rozhodnout úklid `#FB-TEST` (dávka `docs/e2e-vscode/ready/req-20260907-X2-uklid.json` = delete `UC-95006 Hodnoť knihu` + `Business Requirements` + `#QA` + `#GATES`, ELEVATED — nebo nechat jako referenci), Pá 11. 9. tag `v0.13` + push. Bridge kandidáti N2/N4/N5 **vyřízeny 8. 9.** (Z260908-1, commit lokálně) — zbývá živé ověření V0–V3 (`OVERENI-S-OPRAVY-2026-09-08.md`).

### Původní pokyny

1. Do vlákna Z260907b-5 vlož vyplněnou tabulku výsledků (nebo ji vlákno vyplní z tvých průběžných vstupů) — vlákno doplní AK tabulku, nálezy, opraví kanon, spustí `tools\build.cmd` (dvojklik; okno se na konci zastaví, čekej „OK – build i verify prosly") a commitne.
2. Úklid `#FB-TEST`: vlákno ti připraví dávku delete package `UC-95006 Hodnoť knihu` + `Business Requirements` (ELEVATED, klikneš Ano), nebo obsah necháš jako referenci — rozhodneš jednou větou.
3. Push **ne** — Pá 11. 9. tag `v0.13` + push děláš ty.

Prompt pro interaktivní vlákno: `IT-ANALYSIS/zaprah-vlaken-2026-09-07b.md` → sekce **Z260907b-5**.
