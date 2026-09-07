# HITL brány (sdílená reference)

`HUMAN_DECISION(brána, podklady) → {schváleno | přepracovat | schváleno s podmínkou}` — abstraktní operace, platformně nezávislá. Skilly nikdy nevolají platformní nástroj přímo v jádru logiky.

| Brána | Po fázi | Rozhoduje | Podklady |
|---|---|---|---|
| **G0** | F0 převzetí zadání | analytik + zadavatel | hranice řešení, registrované požadavky, kostra EMR, QA sada F0 |
| **G1** | F1 funkční analýza | business (+ analytik) | UC přehled, scénáře, BRU, LS, QA sada F1, traceabilita |
| **G2** | F3 logický design | analytik (+ architekt) | UCR, SR, DTO/spec, LDM, mapování, QA sada F3 |
| **G3** | F4–F5 release | analytik | baseline + diff, klon, QA sady F4+FINAL, 20bodový checklist (metodika v2, kap. 13) |

Implementace per platforma: **Cowork** = AskUserQuestion/odpověď v chatu; **VS Code + Copilot** = approval krok agenta v chatu (v hybridním režimu zapisuje Gate Record EMR agent dávkou). Výsledek se vždy zapíše jako Gate Record do `/Projects/<Projekt>/#GATES` — Artifact s tagged values `gate/datum/rozhodl/vysledek` (✅ P2, [emr-zapis-pravidla](emr-zapis-pravidla.md) §6). Stav workflow žije v EMR — rozdělaná analýza je přenositelná mezi platformami.

**Podklady bran vždy s plnými Path referencemi** (`/Logical Design/…/DEMO Manager/DeleteMyReservation`), ne jen ID; před G3 baselines na úrovni **každé verzované package** (checklist bod 14), restore manifest součástí podkladů (✅ N-K3-8, vrácení G3 kola 3).

Vedle bran existuje ještě **mikro-rozhodnutí nad diffem**: každá dávka s updatem/delete cizího obsahu vyžaduje schválení dry-run diffu per GUID ([emr-zapis-pravidla](emr-zapis-pravidla.md) §12a) — nečeká na bránu a bránu nenahrazuje. Diff schvaluje autor sám, s auditní stopou (✅ R3).

## Gate package (WP1) — jediný podklad brány (✅ 2026-07-17, `Zadani-levnejsi-review.md`)

Podklad brány generuje `sa-orchestrator` **jedním spuštěním, bez ručního skládání**. Review = rozhodování nad diffem a rizikem, ne čtení všeho: člověk neprochází strom v EA, EA klient slouží jen pro spot-check.

**Uložení (✅ rozhodnuto 2026-07-14, konzistence P2):** element **Artifact** `GP-<gate>-<datum>` v `/Projects/<Projekt>/#GATES` vedle Gate Recordu; obsah = markdown v **linked documentu** Artifactu (`import_element_linked_documents`). Tagged values: `gate`, `datum`, `tier` (návrh stroje), `qa-verdikt` (pass/pass-s-varovanimi/fail).

**Struktura dokumentu (pevné pořadí):**

| # | Sekce | Zdroj |
|---|---|---|
| 1 | **Confidence flags producenta** (WP4) — nad vším ostatním; skutečné HUMAN_DECISION body | shrnutí producenta (sekce níže) |
| 2 | **QA verdikt filtrovaný** (WP3): B rozepsané + nevyřešené W se zdůvodněním + sbalený souhrn „co stroj ověřil" | `emr-qa` dle [qa-checklisty](qa-checklisty.md) (QA verdikt jako filtr brány) |
| 3 | **Co vzniklo** (elementy, konektory, diagramy) | SQL nad `t_objectproperties` přes razítka `AI-Session`/`AI-Batch` ([emr-zapis-pravidla](emr-zapis-pravidla.md) §12b) |
| 4 | **Co se změnilo na existujícím** | diff proti `AI-pre-*` mikro-baseline (§12c) + restore manifest |
| 5 | **Dopad mimo území dávky** | Usage/Realization vazby na elementy mimo work package |
| 6 | **Vizuál** — 1 přehledový diagram per artefaktový celek (generovaný, ne ručně skládaný) | přehledový diagram + `get_diagram_image` |
| 7 | **Tier + zdůvodnění skóre** (WP2) | skórování níže |

**Review diagram pod gate package Artifactem (✅ 2026-07-17, pokyn analytika):** pod Artifact gate package se navíc generuje diagram obsahující **pouze elementy vyžadující lidskou validaci** — cíle confidence flags, místa B/W nálezů, updatované existující elementy, dopady mimo území dávky. Záměrně NE všechny vzniklé elementy (kompletní inventura = sekce 3 textově, celek = přehledový diagram sekce 6) — review diagram je navigační zkratka „tady rozhoduj": dvojklikem rovnou k artefaktu, bez hledání ve stromě.

Plné Path reference platí i uvnitř gate package. Akceptace: reviewer otevírá jeden dokument.

## Rizikové tiery review (WP2)

Klasifikace dávky před bránou, mapovaná na model hrozeb H1–H7 (`ai-zapis/Koncepce-bezpecny-AI-zapis-EMR.md`):

| Faktor | Váha |
|---|---|
| jen create ve whitelistovaném území (pracovní prostor P3) | nízká |
| update existujícího elementu / konektoru | vysoká (H1, H2) |
| dotyk master katalogu, šablon, cizích diagramů | kritická (H3) |
| objem dávky (orientační úrovně [emr-zapis-pravidla](emr-zapis-pravidla.md) §12e) | střední (H5, H7) |

Tiery: **A** = auto-pass s namátkovou kontrolou (sampling 10 %, viz WP5) — **výhradně vnitřní mezikroky mikro-cyklu; každá G-brána G0–G3 má vždy člověka** (✅ rozhodnuto 2026-07-14; rozšíření tieru A na G2 až nad daty WP6) · **B** = rychlé review nad gate package, cíl ≤ 10 min · **C** = plné review. Mapování skóre → tier: jakýkoli faktor „kritická" → C; „vysoká" → min. B; jen „nízká/střední" → A (mezikrok) resp. B (brána). **Tier navrhuje stroj, člověk smí eskalovat, nikdy deeskalovat pod návrh.** Tier + zdůvodnění se zapisují do gate package (sekce 7) i Gate Recordu (TV `tier`).

## Shrnutí producenta a confidence flags (WP4)

Každý produkční skill **povinně přikládá k dávce** shrnutí (vstupuje do gate package, sekce 1):

- **Co a proč vyrobil** (vazba na požadavky/scénář),
- **jaké alternativy zamítl a proč**,
- **confidence flags — kde si není jistý**; číselník: `NEJEDNOZNACNY-POZADAVEK` · `CHYBI-PROTISTRANA-KATALOG` · `ODHAD-BEZ-PODKLADU` · `KONFLIKT-PRAVIDEL` · `JINE` (+ volný text s místem: plná Path reference). „Žádné nejistoty" je platná hodnota, ale musí být **explicitní** — chybějící sekce shrnutí = nález W v QA.

## Kategorie vrácení a zpětná vazba (WP5)

Každé vrácení z brány („přepracovat") se zapisuje **strukturovaně** do Gate Recordu: TV `kategorie-vraceni` (čárkou oddělený seznam) + důvod v notes. Číselník: `GRANULARITA` · `VAZBY-TRACE` · `CISTOTA-OBSAHU` · `PLACEMENT` · `KATALOG-OPERACE` · `VIZUAL-DIAGRAM` · `JINE`. Měsíční revizi kategorií, sampling 10 % tier A dávek a smyčku připomínka→strojové pravidlo vlastní **správce metodiky** (✅ rozhodnuto 2026-07-14) — postup v [qa-checklisty](qa-checklisty.md) (Přijímání pravidel z review nálezů).
