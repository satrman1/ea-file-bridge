---
name: e2e-f0-f1
description: Rituál tenkého řezu systémové analýzy — provede jeden nový use case od převzetí zadání (F0) po funkční analýzu (F1) a podklad brány G1 v devíti kolech přes EA File Bridge — ping, převzetí zadání ze zadani/*.md, registrace požadavků, QA F0, identifikace a specifikace UC, řetězená dávka UC package, scénáře + constrainty + lokální BRU + traceabilita (ELEVATED), QA F1, Gate Record G1. Spouštěj na výslovný pokyn (/e2e-f0-f1), typicky pro E2E ověření kitu.
argument-hint: "[cesta k zadání, např. zadani/<uc>-brd.md]"
user-invocable: true
disable-model-invocation: true
---

# e2e-f0-f1 — tenký řez F0 → F1 na jednom UC

Cíl: jeden UC package projde F0 → F1 (převzetí zadání → požadavky → UC + scénáře + BRU → QA F0/F1 → Gate Record G1) **v ≤ 10 dávkách, z toho ≤ 2 opravné, s právě 1 ELEVATED potvrzením**. Logická obrazovka je mimo řez — kontroly QA F1 6/6b (LS existuje, LS diagram naplněný) skončí W/B **záměrně**; vykaž je jako známý nález, neopravuj.

Před startem: platí instrukce workspace (kontrolní kód uveď v první odpovědi) a agent `sa-analytik`. Terminál nepoužívej. Každou dávku před zápisem souboru ukaž v chatu a jednou větou vysvětli.

## Kola

| Kolo | Skill | Co uděláš | Dávka |
|---|---|---|---|
| 1 | — | **`ping`** (samotný). Z ACK si vezmi repozitář, `whitelist[]` (cílová větev = jediná položka whitelistu, jinak se zeptej) a `access`. Nesedí-li repo → stop. | 1 (čtecí) |
| 2 | `/prevzeti-zadani` | Přečti zadání ze `zadani/*.md` (cesta z argumentu, jinak jediný soubor ve složce). Vyextrahuj požadavky (ID, název, popis, akceptační kritéria), navrhni hranici řešení a projekt. → **HUMAN_DECISION** v chatu; dokud není schváleno, žádná dávka. | — |
| 3 | `/eafb-bridge` | Zápis: **jedna** package `Business Requirements` pod whitelist větví (existuje-li projektová package, pod ní) + Requirement elementy `<ID> Název` (notes = popis + AK) řetězené přes `$N` v téže dávce. Jedna nová package na dávku = LOW. GUIDy z ACK si zapiš. | 2 (LOW) |
| 4 | `/emr-qa` sada F0 | Čtecí dávka (packages, elementy) + LLM kontrola; QA report Artifact do `#QA`. Blokující nález → oprav (opravná dávka) před pokračováním. | 3 (čtecí), 4 (LOW) |
| 5 | `/use-case-analyst` + `/use-case-model` | **Před identifikací povinně přečti** [pravidla identifikace UC](references/UC-Pravidla-Identifikace.md) a [pravidla scénářů](references/UC-Pravidla-Scenare.md) a **uveď jejich kontrolní kód** v odpovědi. Návrh: aktéři, UC (název v rozkazovacím způsobu, cíl, pokryté požadavky), specifikace = PRE/PST/ASU + BE + AF/EF s odbočkou a návratem na krok + lokální BRU; textová struktura dle pravidel (+ volitelně Mermaid survey). → **HUMAN_DECISION** (G0/G1-lite v chatu). | — |
| 6 | `/emr-scaffold` (režim B) + `/use-case-model` | Číslo UC = nejvyšší obsazené `UC-#####` v cílové větvi (`query`) + 1; vykaž „posunout Auto Name Counter" jako ruční krok. **Jedna řetězená dávka `$N`**: package `UC-##### Název` → UseCase (kompozitní diagram `CSOB-ITAN::FA-Behavioral` pod UC) + `UCR-#####` (typ `Use Case Realization`) + diagram `version_UC-##### Název` (`CSOB-ITAN::Version Root Diagram`, rovnou naplněný) + Aktér (existující z ACTORS, jinak založ) —Association→ UC, UCR —Realization→ UC, `place_elements_on_diagram` + Boundary. **Právě 1 nová package** (víc packages = ELEVATED navíc). Typování: vzor v modelu > pravidla — chybí-li MDG, základní UML typ + stereotyp. | 5 (LOW) |
| 7 | `/eafb-bridge` | `create_or_update_scenarios` (kompletní sada BE/AF/EF, `attachTo` + `join` = **číslo kroku**), `create_or_update_constraints` (PRE/PST/ASU), `create_or_update_requirements` (lokální BRU jako internal requirements), konektory UC —Realization→ požadavky (traceabilita) — v jedné dávce. **ELEVATED**: dávka skončí `EAFB CEKA NA POTVRZENI`, člověk klikne Ano v EA; ty čekáš na finální ACK. Pak zkontroluj **warningy** (join, typy) — oprava = rebuild kompletní sady na element GUID. | 6 (ELEVATED) |
| 8 | `/emr-qa` sada F1 | Čtení (`t_objectscenarios`, `t_objectrequires`, konektory, obsah package, diagramy) + report Artifact do `#QA`. Očekávaný verdikt: pass s varováními, jediné B/W = kontroly 6/6b (LS mimo řez). Cokoli jiného → opravná dávka. | 7 (čtecí), 8 (LOW) |
| 9 | — | Podklad G1 (gate package lite v chatu: confidence flags, QA verdikt, co vzniklo s GUIDy a plnými cestami, tier) → **HUMAN_DECISION** → Gate Record Artifact do `#GATES` (TV `gate=G1`, `datum`, `rozhodl`, `vysledek`, `tier`). | 9 (LOW) |
| rez. | `/eafb-bridge` | Opravné dávky dle warningů / QA — vždy nová dávka s novým `id`, nikdy přeposlání. | ≤ 2 |

## Limity a kontrolní body

- Celkem ≤ 10 dávek, ≤ 2 opravné, 1 ELEVATED. Překročíš-li, zastav se a shrň, co brání.
- Kontrolní kódy: instrukce workspace v první odpovědi; kód UC pravidel v kole 5. Bez nich běh neplatí jako důkaz načtení.
- Žádný terminál, žádné Allow prompty. Žádný zástupný text v dávce; hodnoty repo / whitelist z instrukcí a z pingu.
- Metodika před mechanikou: kolo 3 a 6 začínají až po schválení v kole 2 resp. 5.
- Na konci shrň: počet dávek (z toho opravné), ELEVATED, verdikty QA F0/F1, GUID + cesta UC package, ruční kroky (posun counteru).
