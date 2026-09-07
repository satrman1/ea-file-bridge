---
applyTo: "requests/**/*.json"
description: Destilát pravidel zápisu do EMR (§1–§6, §8, §11, §12); plné znění ve skillu emr-konvence.
---

# Pravidla zápisu do EMR — destilát pro stavbu dávky

## 1. Cílové větve (artefakt na špatném místě = blokující nález)

- UC, scénáře, BRU, LS, UCR → `/Business Applications/<BA>/(Module)/UC-##### …` (LS v rootu UC package)
- SR, DTO, specifikace rozhraní → `/Logical Design/Logical Design Artefacts/<Platforma>/<Komponenta>/<Služba>` — cíl odvoď z katalogu; nejednoznačný → `#UNSORTED` + vykaž
- LDM → `…/<DB Resource komponenta>/LDM of <Komponenta>`
- Komponenty, interfacy, operace → `/Catalogues/Přehled komponent/Solution Artefacts` (master); nové návrhy **vždy** do `…Proposed`
- Požadavky, traceabilita, QA reporty, Gate Records → `/Projects/<Projekt>` (`Business Requirements`, `#QA`, `#GATES`)

Zapisuj jen do whitelistované větve z pingu; pracovní prostor (P3) — do ostré větve přesouvá člověk po bráně (`move_elements`, ELEVATED).

## 2. Idempotence

Před create do existujícího obsahu `find_*` / `query` v cílové větvi; existuje-li (GUID, jinak jméno+typ+package) → update, ne duplikát. V prázdné větvi recon vynech, create bez opt-in polí (`matchByName` / `dedupKey` jen kde je retry pravděpodobný — plošně tlačí dávku do BLOCKED). GUIDy vzniklých prvků vykazuj.

## 3. Pojmenování

- **UC** `UC-#####` — counter se přes bridge **neaplikuje**: dohledej nejvyšší obsazené číslo v cílové větvi (`query`), přiděl max+1, vykaž „posunout Auto Name Counter na N+1" jako ruční krok. `UCR-#####` sdílí číslo.
- Scénáře `BEXXXXX Jméno` / `AFXXXXX-Y` / `EFXXXXX-Y`; constrainty `PREXXXXX-Y` / `PSTXXXXX-Y` / `ASUXXXXX-Y`.
- **BRU**: přepoužitelná `BRU-####` = element `Behavioral Rule` v `RULES (REUSABLE)` + Usage z UC; lokální `BRU<čísloUC>-Y` (bez pomlčky) = **internal requirement uvnitř UC** (`create_or_update_requirements`), žádný element ani konektor.
- **LS** `SSS-LS<čísloUC>[-Y]_Název česky` (celé číslo UC); parts česky v jednotném čísle; operace CamelCase.
- `SR <Služba>`, `DTO <Služba>`, `version_<Název package>`, požadavek `<ID zdroje> Název`, release `ARELYYMM`, prefix `#` jen technické package.

## 4. Typy (MDG — doslovně, včetně překlepu)

- Diagramy: `CSOB-ITAN::FA-Behavioral`, `CSOB-ITAN::FA-Structural Detail`, `CSOB-ITAN::FA-Sturctural Overview` (!), `CSOB-ITAN::LD-Behavioral`, `CSOB-ITAN::LD-Structural`, `CSOB-ITAN::Version Root Diagram`, `UML Behavioral::Sequence`, `UML Structural::Class`.
- Elementy: UseCase, Actor, `Use Case Realization` (MDG typ jako `type`), `Logical Screen`, `Logical Screen Part`, `Behavioral Rule`, `Service Realization`, `Data Transfer Object`, `Entity`, Requirement, `IDS-*`, DataType `dt*`; Kafka `Kafka_Topic` (nekvalifikovaně), stereotypy zpráv `CSOB-ITAN::LD-Publish` / `LD-Read`.
- Kompozitní elementy (UC, UCR, LS, SR, DTO): linked diagram **pod elementem** (`owningElement`).
- **Konflikt: vzor v modelu > pravidla** — před prvním zápisem nového typu si reconem přečti typování existujícího vzoru. Repozitář bez MDG: základní UML typ + stereotyp.

## 5. Konektory (vše `direction: FromSourceToTarget`)

Aktér → UC Association · UCR → UC Realization · LS → UC Dependency · UC → `BRU-####` Usage «use» · UC → požadavek Realization · UCR → služba/operace/DTO Usage · UC → Core UC Trace · Dynamics → Core UC Realization · entita–entita Association s multiplicitami. Lokální BRU: **žádný konektor**. Zprávy: od FE dál vazba na operaci povinná, aktér → FE ne; sync/async = `isAsynchronous`.

## 6. Stav artefaktu a Gate Records

- `SA-Status` ∈ {proposed, approved, baseline} = tagged value **na package**.
- Gate Record / QA report = **Artifact** v `#GATES` / `#QA`, TV `gate`, `datum`, `rozhodl`, `vysledek` (+ `tier`, `kategorie-vraceni`); gate package `GP-<gate>-<datum>` s linked documentem.
- `contractAuthority` ∈ {model, physical} na package rozhraní. Root packages TV mít nemohou; package jen přes `create_or_update_package`.

## 8. Po zápisu

`reload_diagrams`; `place_elements_on_diagram` + `layout_connectors`; version diagram zakládej rovnou naplněný. Výstup: co vzniklo (GUID, plná cesta), kam, stav, co zbývá ručně. Po větším zápisu zpětné čtení nebo `baseline_diff`.

## 11. Bezpečné mazání

Smazání z diagramu ≠ smazání z modelu. Před mazáním dopady (výskyt na diagramech `query` nad `t_diagramobjects` JOIN `t_diagram`, konektory) a autor; cizí element jen **delete-request** člověku (GUID + zdůvodnění + dopady). Pole `Author` je nespolehlivé — autorství nesou razítka.

## 12. Bezpečný AI zápis

- **Asymetrie:** create ve whitelistu ✅; update vlastního AI-created ✅ + journal; update / delete **cizího** elementu, diagramu, konektoru existující↔existující ⛔ — jen dvoukolově: dry-run diff → schválení per GUID → snapshot + mikro-baseline → zápis. Nový konektor AI → existující ✅. `apply_baseline` nikdy; `clone_*` jen ve verzovacím cyklu.
- **Razítka:** každý AI-created prvek nese TV `AI-Created=true`, `AI-Session`, `AI-Batch`, `AI-User`, `AI-Tool`, timestamp; schválený update cizího navíc `AI-Modified`.
- **Mikro-baselines:** před prvním zápisem dávky do existující package `create_baseline(<package>, "AI-pre-<session>-<batch>")` nejmenší dotčené package (max ~5 per dávka); scaffold packages baseline nepotřebují. Výstup nese restore manifest.
- **Journal:** před schváleným updatem přečti cílový element (`get_elements_information`) a staré hodnoty ulož do session journalu — jediný zdroj pro revert.
- **Objem:** vždy vykaž objem dávky; nad orientační úrovní (50 nových, 5 updatů, 3 packages, 10 diagramů) si vyžádej potvrzení.
- **UNDO:** revert z journalu · mazání session přes razítka jen skriptem v EA, nikdy SQL DELETE · restore z baseline (správce).
