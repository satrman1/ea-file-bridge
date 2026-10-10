---
name: use-case-model
description: Kompletní funkční analýza modulu — přehled UC (survey), identifikace UC se správnou granularitou, detail UC se scénářem (basic/alternate/exception flow), vyčlenění behaviorálních pravidel (BRU) a traceabilita požadavek→UC. Pro analytickou metodu identifikace a specifikace využívá existující skill use-case-analyst. Sloučeno z use-case-prehled + behavioralni-pravidla + obsahová část use-case-scaffold.
license: Complete terms in LICENSE.txt
---

# use-case-model

> Kroky dle EMR vzorů (UC package 114, BRU 461, GLOBAL VIEWS 115 — viz `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele) §3–4). Konvence: `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md).

## Zařazení
- **Typ:** Produkční · **Role:** UC Identifier (kroky 1–3) + UC Specifier (kroky 4–6) · **Fáze:** F1 · **Brána:** G1 (business)

## Vstupy
- Schválená G0: hranice řešení, registrované požadavky v Projects, kostra BA z `emr-scaffold` (režim A).
- Metodická pravidla UC: `../use-case-analyst/references/` (`use-case-rules.md`, `scenario-rules.md`, `scenario-phrases.md`, `common-mistakes.md`). **Načíst POVINNĚ PŘED prvním návrhem UC** — bez nich se identifikace vrací na G0 (granularita, rozkazovací názvy, CRUDL). Metamodel scénáře v `scenario-rules.md` se zapisuje 1:1 do **Scenarios tab**; BRU dvojím způsobem (krok 5, detail v `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md) §3): **přepoužitelná `BRU-####`** = samostatné elementy v `RULES (REUSABLE)` + konektor Usage «use»; **lokální `BRU<čísloUC>-Y`** = internal requirements uvnitř UC (Responsibilities → Requirements), bez elementu a bez konektoru.

## Kroky

**Identifikace (UC Identifier):**
1. Z požadavků identifikuj kandidáty UC (metoda dle skillu `use-case-analyst`): jeden uživatelský cíl na UC, schvalovatelná a verzovatelná granularita. Každý UC pokrývá ≥1 funkční požadavek.
2. Survey (rozsah dle velikosti BA): malá BA = jedna `Use Case Survey of <BA>`; větší BA = rozpad na moduly, survey **per modul** (zastřešující survey per BA volitelná); příliš komplexní modul = rozpad na business areas, rozpad survey analogicky. Diagram v `GLOBAL VIEWS` (`CSOB-ITAN::FA-Behavioral`): aktéři (z ACTORS, zakládej tam) —Association→ UC + **System Boundary** (typ Boundary, název dle BA) obepínající UC — aktéři vně, stejně jako na UC detailu. Jen navigační úroveň, žádný detail.
3. Per UC postupuj dle `emr-scaffold` (režim B) a založ traceabilitu požadavek↔UC (konektor Realization, UC→požadavek — dle metamodelu).

**Specifikace (UC Specifier):**
4. Scénář: strukturovaně do **Scenarios tab** UC operací `create_or_update_scenarios` — Basic Path (BE), Alternate (AF) a Exception (EF) scénáře, kroky actor/system, větve AF/EF kotvené `attachTo` na krok BE + `join` (mapování polí: `use-case-analyst/references/scenario-rules.md`, sekce Fyzické umístění). Preconditions/Postconditions/Assumptions → internal constraints (záložka Constraints; operace bridge `create_or_update_constraints`). Drž čistotu: tok bez pravidel, datových struktur a UI popisu. Scenarios tab je jediné umístění scénáře, notes UC se pro scénáře nepoužívá (emr-zapis-pravidla §7).
5. Pravidla: podmínky/validace/rozhodovací logiku vyčleň mimo tok scénáře. **Přepoužitelná** `BRU-#### Název` = samostatný element **Behavioral Rule** (obsah v notes) v `RULES (REUSABLE)`, konektor UC —**Usage («use»)**→ BRU s `direction: FromSourceToTarget`, umísti na FA-Behavioral diagram. **UC-specifická** `BRU<čísloUC>-Y Název` (bez pomlčky — např. `BRU91001-1`) = **internal requirement uvnitř UC** (záložka Responsibilities → Requirements; text v Notes), bez elementu a bez konektoru; **zápis dávkou přes bridge operací `create_or_update_requirements`**. Ze scénáře odkazuj vždy jen ID pravidla (§3 pravidel).
6. UI data scénáře předej skillu `logicka-obrazovka` (seznam: co uživatel vidí/zadává/systém vrací per krok).

## Kontrola výstupu
Každý požadavek pokryt UC; scénář čistý (pravidla jen odkazem); UC package úplný; survey aktuální. K dávce přilož **shrnutí producenta s confidence flags** dle `hitl-brany.md` (skill `emr-konvence`, references/hitl-brany.md) (WP4). Pak `emr-qa` (sada F1) → podklad pro G1 dle `hitl-brany.md` (skill `emr-konvence`, references/hitl-brany.md).

## Operace ea-file-bridge
`create_or_update_elements, create_or_update_connectors, create_or_update_diagram, place_elements_on_diagram, find_elements_by_name` + `create_or_update_scenarios`, `create_or_update_constraints`, `create_or_update_requirements` (scénáře, constrainty, lokální BRU; Risk Gate ELEVATED, B3)
