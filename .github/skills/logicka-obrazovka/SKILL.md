---
name: logicka-obrazovka
description: Vytvoří logickou obrazovku jako logickou datovou fasádu UI: element obrazovky, případné parts, atributy (ideálně z katalogu atributů), operace a detailní diagram. Není to wireframe ani finální UI návrh.
license: Complete terms in LICENSE.txt
---

# logicka-obrazovka

> ✅ **Kroky doplněny podle ověřených vzorů z EMR** (ověřeno čtením EMR 2026-06-11; viz `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele)). Rámec odvozen z `Workflow/Navrh-workflow-IT-analyzy.md` a metodiky (nyní `Metodika Systémové analýzy v2.md`).

## Zařazení v metodice
- **Typ skillu:** Produkční (vytváří artefakty)
- **Role:** Class Modeller
- **Fáze:** Fáze 1 — Funkční analýza
- **Rozhodovací brána:** G1

## Účel
Vytvoří logickou obrazovku jako logickou datovou fasádu UI: element obrazovky, případné parts, atributy (ideálně z katalogu atributů), operace a detailní diagram. Není to wireframe ani finální UI návrh.

## Vstupy
- Schválená baseline předchozí brány z EMR (čtení přes ea-file-bridge — `query`/`get_*` dávka).
- UC package založený přes `emr-scaffold` (režim B); LS patří do **rootu** UC package (kvůli verzování); UI data scénáře od `use-case-model`.
- Katalog atributů (`/Catalogues/Atributy/Attributes`, pkg 98) a doménové typy (`/Catalogues/Doménové typy/Domain Types`, pkg 86).

## Kroky (vzor ověřen v EMR — sample LS-0000X, element 465, viz `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele) §3)
1. Ověř kontext: UC package existuje, UC element je založen.
2. Vytvoř element typu/stereotypu **Logical Screen** v UC package, s kompozitním diagramem `CSOB-ITAN::FA-Structural Detail` (owning ElementID = LS). ⚠ Auto-kompozit vzniká **rovnou jako `FA-Structural Detail`** (jen se jménem „Class") — **nemazat, jen přejmenovat a použít** (✅ N-K3-9, §7g pravidel; revalidovat přes bridge). **Diagram zakládej rovnou NAPLNĚNÝ**: po založení parts (krok 3) polož LS i parts na diagram (`place_elements_on_diagram`) — prázdný LS detail diagram = vrácení brány (✅ N-K4-2, G1 kola 4; analogie N-K3-3). Naming (✅ U3, `ls-rules.png` (mimo workspace — vyžádej od uživatele) / §3 pravidel): **`SSS-LS<čísloUC>[-Y]_Název česky`** — SSS = zkratka systému, Y = pořadí při více obrazovkách na UC; číslo UC celé bez zkracování (`PAY-LS90002_…`); doporučené názvy Přehled…/Detail…; formát viz `PAY-LS002_Přehled pohybů na účtu`.
3. Části obrazovky modeluj jako owned elementy typu **Logical Screen Part** pod LS, navázané **Aggregation** na LS — diamant u LS: v bridge dávce (`create_or_update_connectors`) **source=LS, `sourceEnd.aggregation=1`, target=part** (`aggregation` je write-once, na update se ignoruje — ✅ N-K3-4, §7f pravidel; dřívější source=part forma dávala diamant u partu). Názvy parts česky, v jednotném čísle — multiplicitu nese aggregate vazba (✅ U3).
4. Atributy LS (a parts) přebírej z katalogu atributů; typuj doménovými typy (`dtName`, `dtAmount`, …) — typ atributu musí nést vazbu na classifier (elementID doménového typu), ne jen textový název. Názvy dle `references/attribute-naming-conventions.md` (skill `structural-modeller`): **anglicky, PascalCase, kvalifikátor na konci** (PeriodFromDate, TransactionAmount); popisy česky. Pozor (AI kanál): update atributu vždy s kompletními údaji vč. typeElementID (§7f). Operace `create_or_update_attributes` je v bridge součástí výčtu iterace 1 (upřesnění K2, zadání v1.6).
4b. **Operace LS (✅ U3 2026-07-06):** modeluj **stěžejní uživatelské akce**, ne detailní ergonomii UI — operace není ekvivalent tlačítka, je to ekvivalent klíčové fíčury, která se volá. Název CamelCase vyjadřující podstatu akce (`NewMessage`, `DisplayMessageDetail`, `FilterMessageList`, `CreateReplyMessage`…), popis česky do notes. Test úplnosti: **při čtení scénáře UC musí být jasné, kterou operaci navázané LS aktér v daném kroku použil.**
5. Založ konektor LS —**Dependency**→ UC (`direction: FromSourceToTarget` — ✅ N-K3-1, §5 pravidel) a umísti LS na FA-Behavioral diagram UC.
6. Zapiš dle konvencí `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md).
7. Předej `emr-qa` (sada F1) / orchestrátoru; k dávce přilož **shrnutí producenta s confidence flags** dle `hitl-brany.md` (skill `emr-konvence`, references/hitl-brany.md) (WP4, ✅ 2026-07-17).

## Výstupy → EMR (přes ea-file-bridge)
Zápis výhradně dávkou přes ea-file-bridge (JSON do `requests/`) dle `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md), do správné větve EMR. Použité operace (`create_or_update_attributes`/`_operations` = výčet iterace 1 dle upřesnění K2, zadání v1.6):
`create_or_update_elements, create_or_update_attributes, create_or_update_operations, create_or_update_diagram`

Stav artefaktu se nese jako tagged value: `proposed` → po schválení v bráně G1 `approved` (dle §6/P1 pravidel: `SA-Status` na úrovni package, ne elementu).

> ⚠ Soubor byl 2026-07-06 poškozen synchronizací (uříznut uprostřed poslední věty). Rekonstruován je pouze závěr věty o stavu artefaktu za „…po schválení v b“ — zbytek souboru je původní.
