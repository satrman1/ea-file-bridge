# SA disciplína (SAR) — sdílená pravidla (sdílená reference)

Pravidla AI produkce artefaktů **Solution architektury** podle IDesign-jak-ho-praktikuje-banka.
Vztah k ostatním referencím: obecná pravidla zápisu ([emr-zapis-pravidla](emr-zapis-pravidla.md) §1–§8 a
**bezpečný AI zápis §12**) platí beze změny; tento soubor přidává SA specifika. Znalostní
základ: `../solution-architect/` (expertní skill) + `IDesign-MDG-Kontext.md` (mimo workspace — vyžádej od uživatele)
(mapa platformy) + `IDesign-v-Bance-Delta.md` (mimo workspace — vyžádej od uživatele) v0.3 (bankovní delta — ZÁVAZNÁ).

> Merge poznámka: SA sekce bran a QA žijí zatím ZDE (ne v [hitl-brany](hitl-brany.md) / [qa-checklisty](qa-checklisty.md))
> — sloučí se po pilotu SportHub, aby nekolidovaly s buildem v10. Mechanika bran (Gate
> Records, gate package, tiery, confidence flags WP4) z [hitl-brany](hitl-brany.md) platí beze změny.

## 1. Terminologie (závazná)

**operace** = operace na kontraktu · **SOA Service / komponenta** = jednotka dekompozice
IDesign · holé slovo **„služba" se nepoužívá**. Zavedené názvy artefaktů analýzy
(realizace služby, LS) se nemění.

## 2. Co se v bance NEMODELUJE (delta D1/D3 — nenabízet)

iFX · message bus / The Message Is The Application · workflow managery · runtime
instance komponent (`IDS-Run-Time Process` — runtime nezávislost žije jen v deploymentu)
· auth/identity/transactions (jen Advanced šablona na explicitní vyžádání).

## 3. Struktura SAR balíčku (scaffold předpis)

Projekt = **kopie struktury šablony** `/Groups/SAR/Solution Architecture (Template)` do
cílové větve (pilot: pracovní prostor dle P1–P3, `#PILOT` demo repozitáře). ID packages
se VŽDY dohledávají čerstvě (`find_packages_by_name`) — opravy QEA přeuspořádávají ID.

```
<Projekt SA>
├── High Level Analysis
│   ├── Area of Volatility      … IDS-Volatility elementy (Requirement!) + diagram Generic Oveview
│   └── Core Use Cases          … Core UC (UseCase) + overview; per UC kompozit Core UC Detail + Activity
├── Big Picture                 … diagram Generic Oveview — POUZE INSTANCE komponent z KATALOGU
├── High Level Design of Recommended Variant
│   ├── Patterns                … IDS-Architecture Pattern (Collaboration) + Pattern Detail
│   ├── Dynamic Architecture View … IDS-Core Use Case Dynamics (Collaboration) + kompozit — POUZE LINKY
│   └── SOA Services Dependency View
└── #Other SAR Views
```

Pozn.: překlep „Generic Oveview" je součást MDG — nikdy neopravovat. Postfix `SAMPLE`
nikdy nepoužívat (vyhrazen šabloně; QC ho vynechává).

## 4. Zápisová pravidla SA artefaktů (vymáhaná SQL kontrolami SARů)

1. **Big Picture = pouze INSTANCE** komponent z katalogu (žádné linky). Instance =
   Object s classifierem, jako u lifelinů (§7g obecných pravidel).
2. **Dynamické pohledy = pouze LINKY** na katalogové komponenty (žádné instance),
   jen na komponenty z katalogu.
3. **Popis vazeb = linked Notes** připnuté ke konektorům — nikdy textové labely na
   konektorech. ⚠ MCP vzor pro NoteLink neověřen — sandbox drill v pilotu; do ověření
   vykazovat jako ruční krok handoffu.
4. Vazby mezi katalogovými komponentami **jen `IDS-Sync` / `IDS-Async`**;
   Manager→Manager výhradně `IDS-Async`; žádné duplicitní stejnosměrné vazby téhož
   stereotypu.
5. Core UC ↔ Activity: právě jedna vazba **IDS-Description**; Core UC ↔ Dynamics:
   právě jedna vazba **Realization**; dynamické pohledy bydlí v package
   „Dynamic Architecture View"; kompozity Aktivit a Dynamics nesmí být prázdné.
6. Komponenta má **právě jeden stereotyp**; IDS komponenty žijí jen v katalogu
   (nové → Proposed, search `G-Component Catalogue-P`; přesun do masteru jen
   doporučovat — K2).
7. **Klasifikace komponent (D5, AI jen navrhuje, člověk potvrzuje):** stavíme my dle
   volatilit → IDS role · neznámý vnitřek → `IDS-Generic System` (⚠ možný překryv
   s Client — flag) · starší metodika (IAF) / krabice se známou strukturou →
   `IDS-Generic LISC`. Na Generic komponenty se IDesign kritéria a smell-check NEaplikují.
8. **Interfacy (D9 + N-SH-2, vzor DEMO Manager — závazné):** zakládá SAR **HNED při
   zápisu komponenty do katalogu**. Dosah: **Manager, Engine, ResourceAccess, Utility —
   Klienti NE, Resources NE.** Vzor: 2× plain `UML::Interface` (bez stereotypu; typ dle
   toolboxu Service Contracts) se jmény **`common interface`** a **`common interface
   proposed`**, **owned POD elementem komponenty** (owningElementID), Realization
   komponenta→interface na oba, + **kompozitní diagram `IDS-IDesign::Service Contract
   Detail`** pod komponentou s komponentou a oběma interfacy. Komponenta nese TV
   **`IDS01_Status`** (Proposed → Production → Decomission; ✅ D-b — enum žije jako TV).
   **Sémantické facetování (více kontraktů) jen u exponovaných integračních komponent,
   rozhodnutí SARa.** Rozhraní se stereotypem `IDS-Process Contract` patří Camunda
   procesům (SR×PR — §7e obecných pravidel).
9. Jména: Manager/RA/Resources = podstatná jména; Engine = slovesné podstatné jméno;
   nikdy jméno po kroku zadání či obrazovce.
10. Diagram typy MDG (`IDS-IDesign::…`) přes MCP fungují (✅ pilot kolo 1 — diagramy
    705–716 vč. Generic Oveview / Core Use Case Overview / Core Use Case Detail);
    po create přesto zpětně přečíst typ.
11. **MDG binding elementů (✅ N-SH-1 remedy):** create batch → retro-read → elementy,
    které spadly na base typ (`Component` + plain stereotyp) → **oprav UPDATEM s FQ
    stereotypem** (`IDS-IDesign::IDS-Manager`) → vzhled ověř `get_diagram_image`
    (read vrací stereotyp vždy plain). Detail §7h obecných pravidel.
12. **Big Picture (✅ N-SH-3 + BP vzhled, Miloš 2026-07-19):** základem BP jsou **tytéž
    IDS-Sync/Async vazby jako na SOA Services Dependency View, kreslené mezi
    instancemi** — SAR si pak BP ručně upravuje/dokresluje, jak potřebuje (BP je jeho
    pracovní plátno). Cílový vzhled = barevné komponenty: konverze Object→Component je
    **defaultní chování profilu** (instance nese stejný stereotyp) a ✅ dělá ji operace
    bridge **`apply_classifier_stereotypes`** (idempotentní port skriptu
    `ITAN-Apply Classifier Stereotypes on SD`, Dokumentace v0.9 §4.4) — ruční spuštění
    skriptu nad BP diagramem zůstává jen fallback.

## 5. Brány SA disciplíny (mechanika dle hitl-brany.md)

| Brána | Po kroku | Rozhoduje | Podklady |
|---|---|---|---|
| **SA-G0** | převzetí zadání | Miloš (+ zadavatel) | MD podklad: interview výtěžek, glosář, vize→objectives→mise, transformované zadání, core UC kandidáti (D10 — mimo EMR) |
| **SA-G1 (TĚŽKÁ)** | volatility + dekompozice | Miloš (+ SAR reviewer, SA1) | MD návrh: **tabulka volatilit (co/proč/pravděpodobnost×dopad) ODDĚLENĚ od dekompozice**, klasifikace komponent s odůvodněním, test odolnosti; rozhodnutí po jednom |
| **SA-G2** | zápis do EMR | Miloš | gate package (WP1 struktura), dry-run diff, žurnál, baseline |
| **SA-G3** | validace + QA | Miloš | call chainy core UC, smell-check report, QA checklist níže, handoff ručních kroků |

G1 je záměrně nejdražší — identifikace volatilit je jediná nemechanická část Metody
a jediné místo, kde AI nesmí rozhodnout. Confidence flags (WP4) povinné u všech dávek.

## 6. QA checklist SA (do sloučení s qa-checklisty.md)

- [ ] SA-1: struktura balíčku odpovídá šabloně (kap. 3); žádný SAMPLE postfix. (B)
- [ ] SA-2: Big Picture bez linků; dynamika bez instancí; jen katalogové komponenty. (B)
- [ ] SA-3: vazby jen IDS-Sync/Async; bez duplicit; M→M jen async. (B)
- [ ] SA-4: UC↔Activity IDS-Description ×1; UC↔Dynamics Realization ×1; žádný prázdný kompozit. (B)
- [ ] SA-5: každá komponenta právě 1 stereotyp; klasifikace potvrzena člověkem. (B)
- [ ] SA-6: popisy vazeb přes Notes (nebo vykázán ruční krok). (W)
- [ ] SA-7: jména dle rolí; vertikální trojice M–E–RA se stejným jménem prošetřena. (W)
- [ ] SA-8: každý blok slouží některému objective (test misí); volatility mají verdikt člověka. (B)
- [ ] SA-9: call chainy core UC projdou pravidly interakce (Generic vyňato); tvary bez fork/staircase, nebo zdůvodněno volatilitou. (W)
- [ ] SA-10: QA vykazuje jen zpětně přečtený stav (žádné „odesláno = hotovo"). (B)

SQL kontroly SARů (`SAR-Validace-SQL.md` (mimo workspace — vyžádej od uživatele)): na produkci je spouští člověk
v GUI; **na lokálním SQLite QEA se ModelView elementy NEČTOU hromadně přes MCP**
(vyhodnocení MS SQL dotazů → blokující dialog).

## 7. Šev na systémovou analýzu

Komponenty vzniklé v SA procesu = klasifikátory lifelinů analýzy (N-K4-5); core UC ze
SA-G0/G1 jsou tytéž UC artefakty, které analýza detailuje (nezakládat paralelní sadu);
operace navrhuje ITAN se supervizí SARa (D9). Handoff do analýzy = seznam komponent
(Proposed) + core UC + odkaz na SA balíček.
