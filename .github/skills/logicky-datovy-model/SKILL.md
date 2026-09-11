---
name: logicky-datovy-model
description: Logický datový model: entity a vztahy na logické úrovni (před fyzickým DB návrhem), používané na DB hraně servisních realizací s omezenou sadou CRUD operací. Lze využít structural-modeller.
license: Complete terms in LICENSE.txt
---

# logicky-datovy-model

> ✅ **Kroky doplněny podle ověřených vzorů z EMR** (ověřeno čtením EMR 2026-06-11; viz `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele)). Rámec odvozen z `Workflow/Navrh-workflow-IT-analyzy.md` a metodiky (nyní `Metodika Systémové analýzy v2.md`).

## Zařazení v metodice
- **Typ skillu:** Produkční (vytváří artefakty)
- **Role:** Data Modeller
- **Fáze:** Fáze 3 — Logický design
- **Rozhodovací brána:** G2

## Účel
Logický datový model: entity a vztahy na logické úrovni (před fyzickým DB návrhem), používané na DB hraně servisních realizací s omezenou sadou CRUD operací. Lze využít structural-modeller.

## Vstupy
- Schválená baseline předchozí brány z EMR (čtení přes ea-file-bridge — `query`/`get_*` dávka).
- DB Resource komponenta ve větvi Logical Design; servisní realizace, které na entitách pracují.
- Katalog atributů a doménových typů (`/Catalogues`).

## Kroky (vzor ověřen v EMR — package 155 `LDM of DEMO DB Resource`, viz `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele) §7)
1. Ověř kontext: existuje package DB Resource komponenty; LDM patří do podpackage `LDM of <Komponenta>`.
1b. **Mermaid náhled před zápisem (povinné, doplněno 2026-07-06):** návrh modelu nejdřív vygeneruj jako Mermaid classDiagram (formát dle `structural-modeller`, režim datový model — entity, atributy s dt* typy, enumerátory, multiplicity) a **předlož analytikovi ke schválení (HITL)**. Do EMR zapisuj až schválenou podobu. Stejný Mermaid pak přilož do podkladů brány G2.
2. Entity vytvoř jako elementy typu/stereotypu **Entity**.
3. Atributy typuj doménovými typy z katalogu (`dtAmount`, `dtNumericIdentifier`, `dtDATE`, `dtVARCHAR(n)`, …) — typ atributu nese vazbu na classifier (elementID doménového typu); popis atributu do description.
4. Operace na entitách výhradně CRUD: `C`, `R`, `U`, `D` (void, bez parametrů) — nic jiného na entitu nepatří.
5. Vztahy jako **Association s multiplicitami** na obou koncích (vzor: `Transaction 0..*` — `1 Account`).
6. Vytvoř diagram typu `CSOB-ITAN::LD-Structural` (vzor: `Transactions Schema`) a entity na něj umísti.
7. Entity pak slouží jako classifiery Objectů (lifelinů) v sekvencích servisních realizací — drž názvy konzistentní.
8. Zapiš dle konvencí `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md).
9. Předej `emr-qa` (sada F3) / orchestrátoru; k dávce přilož **shrnutí producenta s confidence flags** dle `hitl-brany.md` (skill `emr-konvence`, references/hitl-brany.md) (WP4, ✅ 2026-07-17).

## Výstupy → EMR (přes ea-file-bridge)
Zápis výhradně dávkou přes ea-file-bridge (JSON do `requests/`) dle `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md), do správné větve EMR. Použité operace (`create_or_update_attributes` = výčet iterace 1 dle upřesnění K2, zadání v1.6):
`find_packages_by_name, find_elements_by_name, create_or_update_elements, create_or_update_attributes, create_or_update_connectors, create_or_update_diagram, place_elements_on_diagram`

Stav artefaktu se nese jako tagged value: `proposed` → po schválení v bráně G2 `approved` (dle §6/P1 pravidel: `SA-Status` na úrovni package, ne elementu).

> ⚠ Soubor byl 2026-07-06 poškozen synchronizací (uříznut za „Použité nástr…“). Rekonstruovaný je seznam nástrojů a věta o stavu artefaktu (dle šablony sesterského skillu `logicka-obrazovka`) — zbytek souboru je původní.
