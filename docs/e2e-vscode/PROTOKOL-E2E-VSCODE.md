# E2E ve VS Code — klikací protokol tenkého řezu F0 → F1 na `UC-95004` (Z260907b-5)

*v1.0 — 2026-09-07 (Z260907b-4). Prostředí: VS Code + GitHub Copilot Pro+ (agent `sa-analytik`, model Claude Opus 5), EA s `EAExample.qea`, transport pumpa. Zadání: `IT-ANALYSIS/Zadani-Portace-VSCode-v2.md` kap. 5.2 (kola), kap. 9 (AK-6, AK-7, AK-8). Rituál, který agent provádí: `.github/skills/e2e-f0-f1/SKILL.md`. Build, který se testuje: `docs/e2e-vscode/build-doma.log`.*

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
| 0.2 | Dvojklik na `C:\GIT\ea-file-bridge\pump.wsf`. | Okno konzole pumpy: `=== EA File Bridge pumpa v0.5 …`, `Pripojeno na EA: …`, `Code loader: N operaci nacteno`, řádek session baseline nad `#FB-TEST`. Kdyby hlásila starou dávku v `pending\`, dej v popupu **Ne**. | N operací: ____ |
| 0.3 | Otevři VS Code na složce `C:\GIT\ea-file-bridge` (jen tato složka, ne multi-root). Source Control panel: žádné změny, poslední commit = `chore(skills): build vscode doma thin 2026-09-07 + zadani UC-95004 + protokol E2E VS Code`. | Ve stromu: `.github\skills\` (8 složek), `.github\agents\sa-analytik.agent.md`, `zadani\UC-95004-brd.md`. | commit hash (z panelu Source Control → historie): ____ |
| 0.4 | Otevři Copilot Chat, přepni na režim **Agent**, v rozbalovacím seznamu agentů vyber **`sa-analytik`**, model **Claude Opus 5**. | V hlavičce chatu je vidět `sa-analytik` a `Claude Opus 5`. Když `sa-analytik` v seznamu není: Nastavení → hledej `chat.agentFilesLocations` (má obsahovat `.github/agents`) a `chat.useAgentSkills` (zapnuto) — zapiš, co bylo jinak. | agent ✅/❌ · model ✅/❌ |
| 0.5 | Nový chat (ikona +), nic nepiš. Zapiš stav ukazatele kontextu **před prvním dotazem**. | Ukazatel u vstupního pole (procenta nebo kolečko; hover ukáže číslo). | kontext start: ____ % |
| 0.6 | Založ vlákno **Z260907b-5** v Cowork (prompt z dávky), vlož mu tento vyplněný řádek 0.1–0.5. | — | čas startu: ____ |

## Kola 1–9 (Copilot; ty píšeš doslova to, co je v uvozovkách)

Pro každé kolo: napiš text → počkej, až Copilot dopíše → zkopíruj odpověď do vlákna Z260907b-5 + Output řádek + kontext % → vlákno řekne „další kolo" nebo dá opravnou větu.

### Kolo 1 — ping (kotva)

- **Napiš:** „`/e2e-f0-f1 zadani/UC-95004-brd.md`"
- **Agent má:** v **první větě odpovědi uvést kontrolní kód `SA-KIT-VSC-Q9M`** (AK-7 první část — bez něj instrukce nenačetl), pak ukázat dávku `ping` v chatu, uložit ji jako `requests\req-<id>.json` a čekat na odpověď pumpy; z ní vypsat repozitář `EAEXAMPLE.QEA`, whitelist `#FB-TEST` s GUID a `access`.
- **Očekáváš:** konzole pumpy `Zpracovavam req-<id>.json … Hotovo`; Output tab `FB <id> -> done: 1 ops (1 ok, 0 chyb)`. Žádný Allow dialog (agent jen zapisuje soubor ve workspace).
- **Zapiš:** kód uveden ✅/❌ · id dávky · Output řádek · kontext % · Allow 0/1.
- **Když:** Copilot místo dávky napíše text „pošlu ping" a čeká, nebo chce po tobě obsah res souboru → napiš do vlákna, dostaneš větu. Copilot **smí** číst `responses\res-<id>.json` sám (u pumpy je to jediný záznam výsledku — chat ACK pumpa netvoří).

### Kolo 2 — převzetí zadání (bez dávky)

- **Napiš:** nic — agent pokračuje sám; když se zastaví, napiš: „`Pokračuj kolem 2: převezmi zadání ze zadani/UC-95004-brd.md.`"
- **Agent má:** načíst skill `prevzeti-zadani`, přečíst BRD, vyextrahovat 3 požadavky (`DEMO-95041`, `-95042`, `-95043` s AK a Weight), navrhnout hranici (mimo hranici: fiskalizace, věrnostní program, UC-95003) a projekt. Smí udělat **jednu čtecí dávku** recon (`find_packages_by_name` / `find_elements_by_name` SportHub, UC-95004) — počítá se do limitu 10. Skončit **HUMAN_DECISION** v chatu: co schválit.
- **Očekáváš (recon):** package `SportHub` pod `#FB-TEST` **existuje** (kulisa z 21. 8.; stav `#FB-TEST` k 5. 9. — `docs/e2e-pumpa/VYSLEDKY-2026-09-05.md` — ji stále uvádí) a v ní `ACTORS` (Člen, Recepční, Provozovatel), `OTHER ELEMENTS` s prázdným elementem `UC-95004 Prodej vstup na recepci` ze survey. Package `Business Requirements` neexistuje. Když recon ukáže něco jiného (SportHub pryč), zapiš to — návrh se přizpůsobí (projektová package se založí nově).
- **Tvoje odpověď (HUMAN_DECISION):** „`Schvaluji: projekt = existující package SportHub, Business Requirements založ pod ní, registruj všechny tři požadavky DEMO-95041–95043 s AK v notes, mimo hranici dle BRD. UC bude UC-95004 (existující element ze survey použij a přejmenuj na „Prodej vstupu na recepci", nezakládej duplikát).`"
- **Zapiš:** počet čtecích dávek v kole (0/1) · požadavky rozpoznány 3/3 ✅/❌ · zástupný text v dávce (`<…>`, `TODO`) ✅ nebyl / ❌ byl · kontext %.

### Kolo 3 — zápis požadavků (1 dávka, LOW)

- **Napiš:** nic (po schválení agent pokračuje); jinak „`Pokračuj kolem 3.`"
- **Agent má:** načíst skill `eafb-bridge`, ukázat dávku v chatu s jednou větou vysvětlení, zapsat ji: **jedna** nová package `Business Requirements` pod `SportHub` + 3 Requirement elementy `DEMO-95041 Prodej jednorázového vstupu` atd. (notes = popis + AK), řetězené přes `$N` v téže dávce. Bez `matchByName` (recon prokázal, že cíle neexistují).
- **Očekáváš:** Output tab `FB <id> -> done: 4 ops (4 ok, 0 chyb)` + výpis `[vytvoreno] package "Business Requirements" …` a 3× element. **Žádný popup** (1 package = LOW). Agent po ACK vypíše GUIDy nové package a elementů.
- **Zapiš:** id dávky · Output řádek · popup ne ✅ / ano ❌ (= salámování nebo víc packages) · warnings v ACK (agent má říct „0 warnings") · kontext %.

### Kolo 4 — QA sada F0 (2 dávky: čtecí + LOW)

- **Napiš:** nic; jinak „`Pokračuj kolem 4: QA F0.`"
- **Agent má:** načíst `emr-qa`, poslat **čtecí** dávku (obsah package Business Requirements, elementy) a vyhodnotit sadu F0 (každý FR registrován, AK v notes, hranice) → QA report jako Artifact do `#QA` (LOW dávka). Blokující nález = opravná dávka (počítá se do „opravných").
- **Očekáváš:** Output `FB <id> -> done: … (… ok, 0 chyb)` 2×; verdikt agenta **pass**. `#QA` package možná neexistuje — agent ji smí založit v téže dávce (pořád 1 nová package = LOW).
- **Zapiš:** 2 id dávek · Output řádky · verdikt QA F0 (pass / pass s W / fail) · opravná dávka 0/1 · kontext %.

### Kolo 5 — identifikace a specifikace UC (bez dávky, HUMAN_DECISION)

- **Napiš:** nic; jinak „`Pokračuj kolem 5: identifikace a specifikace UC.`"
- **Agent má:** načíst `use-case-analyst` + `use-case-model`, **před návrhem přečíst pravidla identifikace a scénářů a v odpovědi uvést kontrolní kód `UC-PRAVIDLA-R4T`** (AK-7 druhá část). Návrh: aktér Recepční (existující v ACTORS), `UC-95004 Prodej vstupu na recepci` (cíl, pokrývá DEMO-95041/42/43), specifikace: PRE/PST/ASU, BE (základní průchod), AF/EF s odbočkou na krok BE a návratem, lokální BRU (např. cena jen z ceníku, permanentka jen členovi, storno jen nečerpaného nároku týž den). Skončit HUMAN_DECISION.
- **Kontrola obsahu (ty, 2 minuty):** název UC v rozkazovacím způsobu · kroky BE střídají Recepční / Systém · v krocích **není** GUI ani text pravidel (pravidla jsou BRU odkazované z kroků) · AF/EF mají krok, na který se vážou.
- **Tvoje odpověď:** „`Schvaluji návrh UC-95004 beze změn. Pokračuj kolem 6.`" (nebo s úpravou jednou větou — zapiš ji).
- **Zapiš:** kód `UC-PRAVIDLA-R4T` uveden ✅/❌ · počet BE kroků · AF/EF počet · BRU počet · kontext % (tady bývá nejvyšší — `use-case-analyst` má 36 souborů; screenshot, když > 50 %).

### Kolo 6 — kostra UC v EMR (1 řetězená dávka, LOW)

- **Agent má:** načíst `emr-scaffold` (režim B), **jedna** dávka `$N`: package `UC-95004 Prodej vstupu na recepci` pod `SportHub` (TV `SA-Status = proposed`) → UseCase (existující element ze survey **aktualizovat**, ne založit nový — schváleno v kole 2) s kompozitním diagramem `CSOB-ITAN::FA-Behavioral` → `UCR-95004` (Use Case Realization) → diagram `version_UC-95004 …` → Association Recepční → UC, Realization UCR → UC, umístění na diagram + Boundary.
- **Očekáváš:** Output `FB <id> -> done: N ops (N ok, 0 chyb)`, **bez popupu** (1 nová package). Agent vypíše GUID package a diagramů a **vykáže dva ruční kroky**: (a) existující UC element zůstal v `OTHER ELEMENTS` — přesun do nové package se dělá ručně přetažením v EA (bridge přesun neumí, nález N-2 z POC), (b) Auto Name Counter.
- **Když** agent navrhne číslo `UC-95006` (rituál říká „nejvyšší + 1") → napiš: „`Použij UC-95004 podle schválení v kole 2.`" a zapiš jako nález šablony (ne opravnou dávku).
- **Zapiš:** id · Output řádek · popup ne ✅ · warnings (agent vypíše) · ruční kroky vykázány ✅/❌ · kontext %.

### Kolo 7 — scénáře, constrainty, BRU, traceabilita (1 dávka, **ELEVATED**)

- **Agent má:** jedna dávka: `create_or_update_scenarios` (BE + AF/EF, `attachTo`/`join` = číslo kroku), `create_or_update_constraints` (PRE/PST/ASU), `create_or_update_requirements` (BRU pod UC), konektory `Realization` UC → DEMO-95041/42/43. Dávku ukázat v chatu, zapsat, **čekat** na potvrzení.
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
- **Očekáváš:** Artifact do `#GATES` (TV `gate=G1`, datum, rozhodl, výsledek, tier), Output `done`. Agent na závěr shrne: počet dávek (z toho opravných), ELEVATED 1, QA F0/F1, GUID + cesta UC package, ruční kroky.
- **Zapiš:** id · Output řádek · souhrn agenta (celý do vlákna) · kontext % **konečný**.

## Tabulka výsledků (vyplň průběžně)

| Kolo | Co | Dávka id | Output řádek (ACK) | Popup / klik | Opravná | Allow dialog | Kontext % | Poznámka |
|---|---|---|---|---|---|---|---|---|
| 0 | příprava | — | — | — | — | — | | N operací = |
| 1 | ping | | | — | — | | | kód SA-KIT-VSC-Q9M ✅/❌ |
| 2 | převzetí zadání (recon?) | | | — | — | | | 3/3 požadavky |
| 3 | Business Requirements + 3 Req | | | ne | | | | |
| 4a | QA F0 čtení | | | — | | | | |
| 4b | QA F0 report | | | — | | | | verdikt |
| 5 | návrh UC (bez dávky) | — | — | — | — | | | kód UC-PRAVIDLA-R4T ✅/❌ |
| 6 | kostra UC | | | ne | | | | ruční: přesun, counter |
| 7 | scénáře + BRU + trace | | | **Ano** ___:___ | | | | warnings = |
| 7x | opravná (je-li) | | | | ✅ | | | |
| 8a | QA F1 čtení | | | — | | | | |
| 8b | QA F1 report | | | — | | | | W/B = 6/6b? |
| 9 | Gate Record G1 | | | — | | | | |
| **Σ** | | **dávek =** | | **ELEVATED =** | **opravných =** | **Allow =** | **max % =** | |

## Vyhodnocení AK-6 / AK-7 / AK-8 (vyplní vlákno Z260907b-5 po běhu)

| AK | Kritérium | Limit | Naměřeno | ✅/❌ |
|---|---|---|---|---|
| AK-6a | dávek celkem | ≤ 10 | | |
| AK-6b | opravných dávek | ≤ 2 | | |
| AK-6c | ELEVATED potvrzení | právě 1 (kolo 7) | | |
| AK-6d | QA F0 | pass | | |
| AK-6e | QA F1 | pass s W, jediné B/W = 6/6b | | |
| AK-6f | Gate Record G1 zapsán | ano | | |
| AK-6g | Allow / Continue dialogy | 0 | | |
| AK-7a | kód `SA-KIT-VSC-Q9M` v první odpovědi | ano | | |
| AK-7b | kód `UC-PRAVIDLA-R4T` v kole 5 | ano | | |
| AK-8 | ukazatel kontextu, maximum přes všechna kola (bez `/compact`) | ≤ 60 % | | |

Verdikt tenkého řezu: ☐ prošel · ☐ prošel s nálezy · ☐ neprošel — důvod: ______

## Nálezy (klasifikace: šablona `_vscode/` · kanon `Skilly/<skill>` · bridge `src/` · prostředí)

| # | Kolo | Co se stalo (1–2 věty) | Klasifikace | Oprava (kam) |
|---|---|---|---|---|
| | | | | |

Známé předem (neopravovat během běhu): existující UC element `UC-95004` zůstane po kole 6 v `OTHER ELEMENTS` (přesun = ruční krok, N-2) · kontroly 6/6b v QA F1 = W/B záměrně · build WARN u `scenario-phrases.md` = falešný poplach (viz `build-doma.log`).

## Po běhu

1. Do vlákna Z260907b-5 vlož vyplněnou tabulku výsledků (nebo ji vlákno vyplní z tvých průběžných vstupů) — vlákno doplní AK tabulku, nálezy, opraví kanon, spustí `tools\build.cmd` (dvojklik; okno se na konci zastaví, čekej „OK – build i verify prosly") a commitne.
2. Úklid `#FB-TEST`: vlákno ti připraví dávku delete package `UC-95004` + `Business Requirements` (ELEVATED, klikneš Ano), nebo obsah necháš jako referenci — rozhodneš jednou větou.
3. Push **ne** — Pá 11. 9. tag `v0.13` + push děláš ty.

Prompt pro interaktivní vlákno: `IT-ANALYSIS/zaprah-vlaken-2026-09-07b.md` → sekce **Z260907b-5**.
