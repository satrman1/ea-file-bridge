---
name: emr-scaffold
description: Založí strukturální kostru v EMR podle ověřených šablon repozitáře — režimy: (a) struktura řešení/BA, (b) UC package, (c) service package. Jediné místo, kde se zakládají package kostry, version diagramy a kompozitní elementy. Použij vždy před tvorbou obsahu artefaktu.
license: Complete terms in LICENSE.txt
---

# emr-scaffold

> ✅ Kroky dle ověřených vzorů z EMR (šablony pkg 99/110/69, UC package 114, service packages 154/158 — viz `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele)). Sloučeno z `emr-scaffold-init` + `use-case-scaffold` + `realizace-sluzby-scaffold`.

## Zařazení
- **Typ:** Produkční (strukturální) · **Role:** Správce repozitáře · **Fáze:** F0 (řešení), F1 (UC), F3 (služba) · **Brány:** G0/G1/G2
- **Konvence:** `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md) (idempotence, naming, typy — závazné)
- **Ochrana (§12 pravidel):** zakládáš-li do **existující** package, nejdřív `create_baseline(package, "AI-pre-<session>-<batch>")`; nové packages baseline nepotřebují. Vše AI-created razítkuj (`AI-Created/Session/Batch/User/Tool`). Objem dávky vykazuj dle §12e (kvóty jsou signální, ✅ R2 — ne tvrdý stop). Zápis směřuj dle P3 (§6 pravidel) do pracovního prostoru (`…Proposed`, projektový pracovní package), ne přímo do ostrých větví; cílové umístění deklaruj ve výstupu.

## Režim A — struktura řešení (F0)

Vstup: název BA (+ asset tag ServiceNow), moduly, platforma/komponenty, název projektu.

1. Ověř neexistenci (`find_packages_by_name`); roots: Business Applications (62), Logical Design Artefacts (67), Projects (63).
2. `/Business Applications`: `<BA>` (notes: SNOW hyperlink s asset tagem) → `ACTORS`, `ARCHITECTURE`, `#TODO-IN`, `#TODO-OUT`; volitelně `(Module)`; pod modul/BA: `GLOBAL VIEWS`, `OTHER ELEMENTS`, `RULES (REUSABLE)`, `#ARCHIVE`.
3. `/Logical Design`: `<Platforma>` → `<Komponenta>` (názvy = katalog komponent); DB Resource navíc `LDM of <Komponenta>`; všude `#ARCHIVE`.
4. `/Projects`: `<Projekt>` → `Business Requirements` + `Solution Architecture (SOS)` (vzor DEMO).

## Režim B — UC package (F1)

Vstup: UC číslo+název, aktéři, cílový modul.

1. Ověř, že struktura BA/Module existuje a UC číslo není obsazené. Číslování: counter se přes AI kanál (bridge/Automation API) **neaplikuje** (✅ U1b 2026-07-07) — dohledej nejvyšší obsazené `UC-#####` (query dávka), přiděl max+1 a ve výstupu vykaž „posunout Auto Name Counter na <N+1>" jako HITL krok (§3 pravidel; duplicity hlídá QA).
2. Package `UC-##### Název` pod (Module). V něm:
   - UseCase `UC-##### Název` + kompozitní diagram `CSOB-ITAN::FA-Behavioral` (owning ElementID = UC),
   - `UCR-##### Název` — type **`CSOB-ITAN::Use Case Realization`** (MDG typ jako `type`, ne stereotyp — §7c pravidel); auto-kompozit `UML Behavioral::Sequence` **ponech a používej přímo** (✅ 2026-07-12 — §7d/§7h; revalidovat přes bridge),
   - diagram `version_UC-##### Název` typu `CSOB-ITAN::Version Root Diagram` v rootu package — **zakládej rovnou NAPLNĚNÝ**: root elementy package na něj umísti hned při scaffoldu (`place_elements_on_diagram`; ✅ N-K3-3 — prázdný version diagram = vrácení G1; EA-Repozitar-Kontext §9).
3. Konektory: Aktér (z ACTORS) —Association→ UC; UCR —Realization→ UC; vše s `direction: FromSourceToTarget` (✅ N-K3-1, §5 pravidel). Umísti na FA-Behavioral diagram + **System/Module Boundary** (typ Boundary, název dle BA/modulu) obepínající vše kromě aktéra a požadavků (§7f pravidel).
4. LS nezakládej zde — řeší `logicka-obrazovka` (patří ale do rootu UC package).

## Režim C — service package (F3) — platí beze změny i pro event (Kafka) operace (✅ KF2)

Vstup: operace z katalogu komponent, cílová komponenta. **Katalog-first princip**: začíná se vždy od operace — nejdřív SQL dohledej, zda už na ni neodkazuje existující SR (`t_objectproperties`, Property=`505-1 Operation Link`, Value=MethodGUID); teprve když ne, zakládej. **SR nalezená v archivních větvích (`#ARCHIVE`, packages s postfixem „ARCHIV") se nepočítá jako živá** — zakládej novou a archivní nález vykaž ve výstupu (✅ N-K4-3, kolo 4: K3 archiv odkazoval na tytéž operace).

**SR × PR (2026-07-19):** před scaffoldem ověř stereotyp rozhraní operace — je-li **`IDS-Process Contract`** (MDG IDS-IDesign, Camunda), místo SR vzniká **Proces realizace (PR)**: scaffold stejný jako SR, jen element typu **`Process Realization`** (`CSOB-ITAN::Process Realization`) a kompozit **`BPMN2.0::BusinessProcess`**; `505-1 Operation Link` beze změny (✅ vzor ze sandboxu, §7e pravidel). Obsah BPMN diagramu přes bridge (Diagram Builder, it. 2) je neověřená oblast — **první ostrý PR proveď jako sandbox drill s HITL**; SR pro takovou operaci nikdy nezakládej.

0. ✅ Celý katalog-first scaffold režimu C umí bridge **jedinou operací `find_or_create_referencing_sr`** (service package, diagramy, SR/DTO/Req/Res, vazby, tag 505-1 — Dokumentace v0.9 §4.4); kroky 1–4 níže popisují sémantiku výsledku a ekvivalentní ruční skladbu dávky.
1. Ověř operaci v katalogu (master/Proposed). Cílovou složku odvoď zrcadlením: operace → interface → komponenta v katalogu → v `/Logical Design/Logical Design Artefacts/` dohledej package odpovídající platformě/komponentě (názvem). Když neexistuje nebo je mapování nejednoznačné → zakládej do `#UNSORTED` a vykaž k ručnímu zatřídění (soulad katalog↔LD není garantovaný).
2. Package `<NázevSlužby>` pod komponentou. V něm:
   - `SR <NázevSlužby>` (**Service Realization**) + kompozitní sekvence (auto-kompozit používej přímo; revalidovat přes bridge — §7d/§7h pravidel),
   - `DTO <NázevSlužby>` (**Data Transfer Object**) + kompozitní `UML Structural::Class`; Req/Res classy s Composition vazbami, DTO —«refine»→ SR (§7e),
   - `version_<NázevPackage>` typu `CSOB-ITAN::Version Root Diagram` (Version 1.0, ShowDetails, Author — ✅ jde přes bridge: `create_or_update_diagram` na create nastavuje Author+Version, `update_diagram_properties` doplní showDetails; Dokumentace v0.9 §4.3, historicky K6 — naplněno) — **zakládej rovnou NAPLNĚNÝ** root elementy package (✅ N-K3-3, EA-Repozitar-Kontext §9).
3. **Tagged value `505-1 Operation Link`** na SR → odkaz na operaci zapiš **`ids` strukturou** (✅ 2026-07-07, §7h pravidel): `[{"name": "505-1 Operation Link", "ids": [{"type": "Operation", "id": <operationID>}]}]` — GUID není potřeba, FIX skript odpadá. Zpětným čtením ověř rozresolvovaný cíl {name, type, ID}.
4. Notes nových artefaktů přebírej ze šablon `#Template structure` (GUIDy: `EA-Repozitar-Kontext.md` §13).

> Pro lidský (ne-AI) tok existuje ekvivalentní skript `Scripts/ITAN-Find or Create Referencing Service Realization.vbs` — výstupy musí být identické.

## Auto-kompozity MDG elementů (závazné, §7g pravidel — z kola 2; revize 2026-08-16)
- Auto-kompozity **NEMAZAT, jen přejmenovat/použít**; chování revalidovat přes bridge.
- **UCR/SR**: auto-kompozit `UML Behavioral::Sequence` se **používá přímo** (✅ ověřeno 2026-07-12).
- **LS**: auto-kompozit vzniká rovnou jako **`CSOB-ITAN::FA-Structural Detail`** (jen se jménem „Class") — **NEMAZAT, jen přejmenovat a použít** (✅ N-K3-9). **DTO**: auto-kompozit vzniká rovnou jako **`UML Structural::Class`** — **NEMAZAT, jen přejmenovat a použít** (✅ ověřeno kolo 4, 2026-07-14, §7g pravidel).
- **505-1**: zapisuj `ids` strukturou dle §7h pravidel (type `Operation` + operationID) — placeholder `#FIX-GUID:` je zrušený (✅ 2026-07-07).

## Kontrola výstupu
Kostra odpovídá šabloně 1:1 (žádná standardní část nechybí, žádná navíc), naming dle konvencí, version diagram v rootu, žádné osiřelé auto-kompozity. K dávce přilož **shrnutí producenta s confidence flags** dle `hitl-brany.md` (skill `emr-konvence`, references/hitl-brany.md) (WP4, ✅ 2026-07-17 — „žádné nejistoty" explicitně). Pak `emr-qa` (sada dle fáze).

## Operace ea-file-bridge
`find_packages_by_name, create_or_update_package, create_or_update_elements, create_or_update_diagram, create_or_update_connectors, place_elements_on_diagram`
