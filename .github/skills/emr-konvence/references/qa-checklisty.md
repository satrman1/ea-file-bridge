# QA checklisty (sdílená reference pro `emr-qa`)

Jeden QA engine (`emr-qa`) + tato data. Checklist vychází z **20bodového checklistu `Metodika Systémové analýzy v2.md` (kap. 13)** — dřívější v1 měla checklist 16bodový (kap. 8), body 1–16 níže na něj beze změny navazují, body **17–19 jsou nové** (viz sady níže a `Feedback-Metodika-v2-Integrace.md` (mimo workspace — vyžádej od uživatele)), bod **20 (chybové stavy, pravidlo 12.7) doplněn 2026-07-15** — strojová kontrola v sadě FINAL (#19). Závažnosti: **B** blokující (anti-pattern/tvrdé pravidlo → červená v bráně), **W** varování (k uvážení člověka), **I** info (metrika).

## Vazba na produkční QC kontroly (doplněno 2026-07-03)

Nad EMR běží kontinuální produkční QA (reporty QC101–QC405): nález = JIRA issue na autora artefaktu (Diagram/Element/Package Author), závažnosti 2_Critical–6_Trivial, scope omezený datem vzniku (grandfathering legacy), výjimky řízeně přes tag (u QC102 výjimka nepřípustná). Důsledky pro agentní QA:

1. **Tvrdé kritérium: AI zápis nesmí vygenerovat žádný QC nález.** Agent zapisuje pod účtem člověka — nálezy mu přistanou jako JIRA. Sady se proto před bránou pouštějí vždy celé, včetně QC-mapovaných bodů (tabulka na konci).
2. **Při rozporu definic platí QC** — je ostrá a provozně laděná; checklist je její ex-ante předsunutí.
3. **Výjimky — tagged value `QC Exception List`:** hodnota = čárkou oddělený seznam QC kódů, na které se výjimka vztahuje (např. `QC101, QC201`), **důvod výjimky povinně do Note tagu**. Výjimka platí jen pro vyjmenované kontroly (QC filtruje `value like '%QCxxx%'`), ne plošně — governance zásada: žádné „všechna naše jídla obsahují všechny alergeny". QA nález na položce s výjimkou pro danou kontrolu reportuje jako **I** s citací důvodu z Note (u 9d/QC102 výjimka nepřípustná). **Agent výjimku nikdy nezakládá sám** — smí ji navrhnout (kód + důvod), zapisuje se až po potvrzení člověkem (HITL).
4. **Scope period:** při běhu nad existující větví omez kontroly na artefakty vzniklé v rámci projektu (obdoba QC grandfatheringu) — jinak QA vykazuje legacy obsah mimo vlastní scope.
5. **Pracovní prostor (P3):** kontroly placementu (1c, 13) se před schválením brány vyhodnocují vůči *cílovému* umístění deklarovanému v pracovním prostoru, ne vůči aktuální pracovní větvi — do schválení brány je artefakt „na špatném místě" záměrně.

## Sada F0 (brána G0)

| # | Kontrola | Jak | Záv. |
|---|---|---|---|
| 1 | Každý požadavek evidován v Projects (`<JIRA-ID> Název`) | get_packages/elements | B |
| 1b | Hranice řešení popsána (výstup prevzeti-zadani) | textový artefakt | B |
| 1c | Package kostra ve správných větvích dle šablon | find_packages + porovnání se šablonou 99/110/69 | B |
| 1d | Registrované FR prošly BRQ bránou s PASS (nebo waiver / zdůvodněné rozhodnutí analytika); existuje-li brq snapshot, žádný in-scope FR z JIRA nechybí v EA | report.csv / requirements.json z brq běhu (vault `BRQS/`, root vaultu) vs. elementy v Projects | W |

## Sada F1 — funkční analýza (brána G1, checklist 1–6)

| # | Kontrola | Jak | Záv. |
|---|---|---|---|
| 2 | Každý funkční (solution, BABOK v3) požadavek má vazbu na ≥1 UC (✅ F3: matice se negeneruje, stačí konektory — pokrytí ověřuje tato kontrola) | get_connectors nad Requirement | B |
| 2b | *(nová 2026-07-06, MLA)* **CRUD cross-check**: lifecycle každého business objektu zmíněného v UC scénářích je pokrytý v rámci UC sady (C/R/U/D), nebo explicitně poznamenán jako spravovaný/načtený odjinud | LLM analýza scénářů + porovnání s LDM entitami | W |
| 3 | Granularita UC: 1 cíl, vlastní package, scénář existuje | struktura UC package + **Scenarios tab** (U2 rev. 2026-08-17; čtení: `query` nad `t_objectscenarios` / readback `create_or_update_scenarios`) | W |
| 4 | Čistota scénáře: bez pravidel/datových struktur/UI popisu (✅ U5: LLM heuristika stačí, tvrdá pravidla se nezavádějí) | LLM analýza kroků ze **Scenarios tab** (U2 rev. 2026-08-17); podmínkové konstrukce → odkaz na BRU | W |
| 5a | **Přepoužitelná pravidla `BRU-####`** (s pomlčkou): samostatný element `Behavioral Rule` v package `RULES (REUSABLE)`, ze scénáře odkazované vazbou UC—**Usage «use»**→BRU (✅ N-K3-1) | get_connectors | B |
| 5b | **Lokální pravidla `BRU<čísloUC>-Y`** (bez pomlčky): internal requirements uvnitř UC (Responsibilities → Requirements), jméno = celé `BRU<čísloUC>-Y Název`, text pravidla v Notes (U5 rev. 2026-08-21). **Lokální BRU nalezené jako samostatný element pod UC = NÁLEZ** (překonaný vzor N-K3-2), stejně jako lokální BRU s konektorem | `query`: `SELECT * FROM t_objectrequires WHERE Object_ID = <UC>` (readback `create_or_update_requirements`) + kontrola potomků UC ve stromě | B |
| 6 | LS existuje kde UC nese UI data; atributy typované doménovými typy (classifier, ne text) | get_elements/attributes | B/W |
| 6b | UC package úplný: FA-Behavioral diagram, UCR, version_ diagram; **LS detail diagram NAPLNĚNÝ (LS + parts)** (✅ N-K4-2 — prázdný LS diagram = vrácení G1 kola 4) | get_packages_information + get_diagrams_information | B |
| 6c | Aktér z ACTORS package, ne lokální duplikát | owning package aktéra | W |

## Sada F3 — logický design (brána G2, checklist 7–12)

| # | Kontrola | Jak | Záv. |
|---|---|---|---|
| 7 | UCR odpovídá scénáři (aktér/FE vlevo, kroky pokryty) | diagram info + LLM porovnání s kroky Scenarios tab (U2 rev. 2026-08-17) | W |
| 8 | Reference z UCR vedou na SR (InteractionOccurrence); Usage impact vazby existují | get_diagrams/connectors | B |
| 9 | Každá SR má `505-1 Operation Link` na operaci katalogu | tagged values | B |
| 9b | Lifeliny jen z komponent povolených Dynamic View (⊂ katalog — přísnější než QC101) | klasifikátory Objectů vs DV | B |
| 9c | Message cally navázané na operace (operationID ≠ 0) dle rozsahu §5b: od FE dále povinné **vč. CRUD zpráv na entity** (✅ 2026-07-14), aktér→FE a self cally ne | get_diagrams messages | B |
| 9d | Instance (lifeline) nesmí být přepoužitá na více SD — per diagram vlastní instance; **bez výjimky** (QC102) | `query` nad Objecty (K11 — bridge nemá operaci pro hledání elementu na diagramech): `SELECT dob.Object_ID, dob.Diagram_ID, dgm.Name, dgm.Package_ID FROM t_diagramobjects dob JOIN t_diagram dgm ON dgm.Diagram_ID = dob.Diagram_ID WHERE dob.Object_ID = <Object_ID>` — **nález = víc než 1 řádek** pro tutéž instanci | B |
| 9e | Na SD instance (Objecty s klasifikátorem), ne přímé linky na komponenty/classy (QC202) | typy elementů na diagramu | B |
| 9f | *(nová 2026-07-14, N-K4-5 — escape K3)* Lifeliny na SD jsou **nepojmenované instance** klasifikované katalogem (ClassifierID ≠ 0, name prázdné, bez vlastního Service Contract Detail diagramu) — ne katalogové komponenty založené MDG typem; Type konverzi Object→Component dělá operace bridge `apply_classifier_stereotypes` (FIX skript ITAN-Apply Classifier Stereotypes = fallback) | get_elements_information nad lifeliny (owned diagramy + classifier) | B |
| 10 | DTO/specifikace: request a response jednoznačné, nebo hyperlink na XSD | DTO notes/diagram | B |
| 10b | *(nová 2026-07-07, v2 kap. 13 bod 7)* Atributy DTO Req/Res typované doménovými typy z katalogu (classifier vazba, ne text) | get_elements/attributes na Req/Res classách | W |
| 11 | DTO není duplikací existujícího XSD | DTO + odkaz | W |
| 12 | Mapování screen↔DTO↔LDM existuje kde je potřeba | linked document | W |
| 12b | Entity: jen CRUD operace, atributy s doménovými typy, asociace s multiplicitami | get_elements | B/W |
| 12c | Nové operace jen v Solution Artefacts Proposed s vlastníkem | owning package | B |
| 12d | *(v2 5.4.4; ✅ KF1+KF2 2026-07-06)* Event operace: SR existuje (zakládá se stejným scaffoldem jako běžná SR) i bez smysluplné sekvence; DTO nese strukturu zprávy; message cally eventů nesou stereotyp `CSOB-ITAN::LD-Publish`/`LD-Read`; topic = `KafkaDesign::Kafka_Topic` | get_elements/notes + konektory | W |
| 12e | *(nová, v2 6.2)* Nový atribut v katalogu: naming, doménový typ přes Select Type (ne text), univerzální popis bez vazby na projekt | get_elements/attributes na `Attributes Proposal` | B |

## Sada F4 — verzování (brána G3, checklist 13–14)

| # | Kontrola | Jak | Záv. |
|---|---|---|---|
| 13 | Artefakty ve správných větvích (průřezově) | placement dle emr-zapis-pravidla §1 | B |
| 14 | version_ diagram v rootu každé verzované package (naplněný root elementy — N-K3-3); **baseline per KAŽDÁ verzovaná package** (ne jen rooty — ✅ N-K3-8); restore manifest s plnými Path referencemi | get_packages + create_baseline log + restore manifest | B |
| 14b | Klon: jen měněné elementy, as-is zachován, postfix ARELYYMM, žádné orphany | porovnání package, SQL orphan check | B |

## Sada FINAL (brána G3, checklist 15–20 + celé 1–14)

| # | Kontrola | Jak | Záv. |
|---|---|---|---|
| 15 | Model čitelný mimo EA (v Infoportu — tenkém klientu nad EMR; žádný export se nedělá) | manuální checklist čitelnosti | W |
| 16 | Kontrolní SQL pohledy pro rizikové části existují a prošly | ea-sql-expert | B |
| 17 | *(v2 #18)* Změna prošla relevantními globálními kontrolami (QC101–QC405), nebo má explicitní výjimku (`QC Exception List` + důvod) | mapovací tabulka níže; výjimky nikdy nezakládá agent sám | B |
| 18 | *(v2 #19)* U mazaných/rušených objektů je dohledatelný autor a zohledněné neviditelné vazby před smazáním | audit log s časovým filtrem (⚠ AU1) + kontrola vazeb před `delete_from_model` | B — jen při reálném mazání v dané sadě, jinak N/A |
| 19 | *(v2 #20, pravidlo 12.7; doplněno 2026-07-19 — audit W1)* Scénáře a sekvenční diagramy obsahují jen chybové stavy měnící chování systému (business výjimky, funkční návratové stavy) — žádné technické chyby a žádné chybové endpointy místo návratu přes gate | LLM kontrola scénářů ze Scenarios tab (U2 rev. 2026-08-17) dle `references/scenario-rules.md` (skill `use-case-analyst`) (12.7) + kontrola return zpráv SD (gate, ne error endpoint) | B |
| — | Re-run sad F0–F4 nad finálním stavem | emr-qa | dle sady |

## Průřezové SQL kontroly (ea-sql-expert, kdykoliv)

**Pravidlo pro každé QA SQL přes `query` (lekce z banky 2026-09-10, N-B-3):** každý `SELECT` má omezení — `TOP N` (MS SQL) / `LIMIT N` (SQLite) podle dialektu repozitáře, nebo selektivní `WHERE` (Package_ID, Object_ID, GUID, jméno); velké tabulky (`t_seclocks`, `t_object`, `t_connector`, `t_diagramobjects`, `t_xref`, `t_attribute`, `t_operation`) **nikdy bez omezení** — neomezený výpis nechá EA sestavovat XML minuty a pumpa „visí“. Kontroly typu „existuje/kolik“ piš přes `COUNT(*)` scoped na dotčené packages, ne výpisem řádků. Řády velkých tabulek = kontext repozitáře (`EA-Repozitar-Kontext.md`, v bance `EA-Repozitar-Kontext-banka.md`). Prázdný výsledek (`ok`, `rowCount: 0`, případně warning „EA nerozlišuje 0 řádků od chybného dotazu“) **není chyba** a nález z něj vyvozuj jen po ověření sloupců; `E_SQL` = chybný dotaz → oprav a pošli znovu.

Orphan elementy (bez diagramu a konektorů) v dotčených packages; elementy bez stereotypu tam, kde MDG typ povinný; duplicitní názvy UC/SR v BA; **duplicitní `UC-#####` číslo napříč BA** (B — riziko AI max+1 × UI counter, ✅ U1b §3 pravidel; ověř i vykázaný posun counteru ve výstupu skillu); konektory na smazané elementy; #TODO-IN/OUT neprázdné déle než release cyklus (W).

## Mapování checklist ↔ produkční QC (2026-07-03)

| QC | Obsah (závažnost QC) | Checklist bod | Pozn. |
|---|---|---|---|
| QC101 | Nekatalogové instance a komponenty na SD (2_Critical) | 9b | checklist přísnější: povoluje jen podmnožinu katalogu dle Dynamic View |
| QC102 | Instance na více SD (4_High, výjimka nepřípustná) | 9d | nová kontrola, doplněno z QC |
| QC103 | SR s nekorektní vazbou na operaci (3_Major) | 9 | |
| QC201 | Messages bez přiřazené operace (4_High) | 9c | 9c přeřazeno W→B (soulad s §5b a QC201) |
| QC202 | Linky místo instancí na SD (4_High) | 9e | nová kontrola, doplněno z QC |
| QC104 | UC bez scénáře či aktivity diagramu (6_Trivial) | 3 | scénář v Scenarios tab (U2 rev. 2026-08-17; SQL protějšek: `t_objectscenarios` per UC) |
| QC401/402/403/405 | UC/UCR/SR/LS mimo standardní strukturu (5_Minor/6_Trivial) | 1c, 6b, 13 | checklist vědomě přísnější (B): prevence levnější než JIRA |
| QC404 | Nearchivované verze analýz (5_Minor) | 14b + úklid (`verzovani-release` krok 6) | |

Bez QC protějšku (obsahová vrstva, kterou SQL kontroly neumí): 4 (čistota scénáře), 7 (soulad UCR↔scénář), granularita UC (3) — zde agentní LLM QA doplňuje, nekonkuruje.

## QA report

Zapisuje se do `/Projects/<Projekt>/#QA` — **Artifact** element per běh (✅ P2 2026-07-02, [emr-zapis-pravidla](emr-zapis-pravidla.md) §6), tagged values: sada, datum, výsledek (pass/fail), počty B/W/I; nálezy v notes.

## QA verdikt jako filtr brány (WP3, ✅ 2026-07-17, `Zadani-levnejsi-review.md`)

Plný QA report do `#QA` zůstává beze změny (audit). **Do gate package** ([hitl-brany](hitl-brany.md), sekce 2) jde ale jen filtrovaná podoba — report přestává být dokument ke čtení:

- **B nálezy rozepsané** (checklist bod, místo s plnou Path referencí, návrh nápravy),
- **nevyřešené W** — pouze ty, u nichž producent doložil zdůvodnění, proč zůstávají (W bez zdůvodnění se řeší před bránou),
- **„co stroj ověřil"** — sbalený jednořádkový souhrn per sada (`Sada F1: 12/12 kontrol pass`), zelené kontroly se **nerozepisují**,
- I nálezy se do gate package nedávají vůbec (jsou v plném reportu v `#QA`).

## Přijímání pravidel z review nálezů (WP5, ✅ 2026-07-17) — postup pro správce metodiky

Vlastník: **správce metodiky** (✅ rozhodnuto 2026-07-14 — jediná role s právem měnit `_shared` pravidla; smyčka připomínka→pravidlo bez předávky).

1. **Sampling tier A:** namátková kontrola **10 %** schválených tier A dávek (výběr např. každá n-tá dle pořadí, ne ručně „co se hodí"); výsledek každé kontroly se eviduje jako QA report do `#QA` s TV `sampling=true`.
2. **Escape = nález kategorie B objevený po schválení brány** (blokující dle tohoto checklistu). Eviduje se jako QA report (TV `escape=true` + odkaz na Gate Record schválené brány); W/I nálezy se evidují, ale escape rate nekazí.
3. **Reakce na escape:** dočasné zpřísnění skórování — pravidla, která dávku pustila do tieru A, se downgradují (dotčený faktor min. o stupeň výš), dokud měsíční revize nepotvrdí nápravu.
4. **Měsíční revize:** projdi Gate Recordy (TV `kategorie-vraceni`), sampling a escape evidenci za období. Kategorie vrácení opakovaná **2×+** → kandidát na nové strojové pravidlo v tomto checklistu, nebo na úpravu produkčního skillu (lekce se propisují do SKILL.md/`_shared`, ne do promptů). Každé přijaté pravidlo dostane datum a původ (kategorie/Gate Record) — jako stávající konvence `(nová 2026-07-14, N-K4-5)`.
5. **Metriky (WP6):** z Gate Recordů a QA reportů drž: čas člověka per brána a tier, počet vrácení per kategorie, escape rate, podíl dávek per tier. Baseline: K3 = 8 vrácení/~50 min, K4 = 2 vrácení/~18 min, escape K3 = 1 (N-K4-5).
