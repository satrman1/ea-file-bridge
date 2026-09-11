---
name: mapovani-rozhrani
description: Mapování dat mezi logickou obrazovkou, DTO, službami, XSD a logickým datovým modelem. Primární formát návrhu je YAML notace (INTERFACES), z níž se generuje mapovací Excel vložený do EA. Částečně manuální krok.
license: Complete terms in LICENSE.txt
---

# mapovani-rozhrani

> Konvence: `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md). Sémantika Excelu (norma): `current-implementation.md` (mimo workspace — vyžádej od uživatele). Notace YAML: `ANALYZA Rozhrani a mapovani v EA s LLM.md` (mimo workspace — vyžádej od uživatele) kap. 6.2/6.5. Umístění v EA ✅ L4 (2026-07-06): souborový artefakt v EMR z toolbox šablony, na verzovacím diagramu service package, vazba DTO —«use»→ Mapping.

## Zařazení
- **Typ:** Produkční (částečně manuální) · **Role:** Class Modeller · **Fáze:** F3 · **Brána:** G2
- **Budoucí modul IF:** cílově master mapování v Gitu (YAML + Mapping Studio + validátor) — organizačně závislé, viz `Feedback-Interfaces-Integrace.md` (mimo workspace — vyžádej od uživatele). Tento skill jede režim IF-0: notace už teď, master zatím v EA.

## Kroky
1. Z `realizace-sluzby` a `logicka-obrazovka` převezmi dvojice k mapování (LS atribut ↔ DTO pole ↔ XSD element ↔ LDM atribut). Mapuj jen tam, kde je potřeba (větší/prakticky používaná rozhraní) — ne dogmaticky všude; při jednotném pojmenování z katalogu atributů je mapa triviální a Excel netřeba.
2. Návrh sestav jako `mapping.yaml` dle notace INTERFACES (kap. 6.2; vícevolací fasáda → `flow.yaml` + mapování per krok, kap. 6.5). Každé pravidlo: `source`, `target`, `transform` (uzavřený enum), `confidence`, `rationale`, `status: proposed`. Podmínky výhradně v gramatice z `current-implementation.md` — žádná vlastní syntaxe. Sekce `unmapped` s důvody je povinná.
3. Po lidské validaci (ideálně v `INTERFACES/mapping-studio.html` — lokální soubor, bez instalace) vygeneruj z YAML **Excel pohled dle normy** `current-implementation.md` (sloupce, pravidla sheetů, INPUT/OUTPUT, root na 3. řádku).
4. Vložení Excelu do EA je manuální krok analytika (✅ L4): v EA přetáhne **šablonu mapovacího Excelu z toolboxu na verzovací diagram u Service Realization** (vznikne souborový artefakt uvnitř EMR) a propojí vazbou **DTO —«use»→ Mapping**. Skill to neprovádí — jen předá vygenerovaný obsah Excelu a určení cílové service package. YAML ulož do projektové složky vedle Excelu — je to budoucí zlatý fond pro kalibraci modulu IF.

## Kontrola výstupu
Mapování čitelné a vytěžitelné; pokrývá potřebné dvojice; každá povinná cílová cesta mapovaná nebo zdůvodněně v `unmapped`; YAML a Excel se shodují (Excel je generovaný, needituje se). K dávce přilož **shrnutí producenta s confidence flags** dle `hitl-brany.md` (skill `emr-konvence`, references/hitl-brany.md) (WP4, ✅ 2026-07-17 — `confidence` z mapping.yaml se do flags propisuje u pravidel < 0.8). Pak `emr-qa` (sada F3, bod 12).

## Operace ea-file-bridge
`import_element_linked_documents, create_or_update_connectors, get_elements_information`
