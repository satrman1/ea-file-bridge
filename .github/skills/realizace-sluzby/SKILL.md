---
name: realizace-sluzby
description: Kompletní servisní vrstva jedné operace — SR sekvence vnitřního průběhu napříč vrstvami (manager/engine/RA až DB resource s entitami LDM), DTO model requestu/response a specifikace rozhraní (operation link, XSD jako zdroj pravdy). Sloučeno z realizace-sluzby + dto-model + specifikace-rozhrani.
license: Complete terms in LICENSE.txt
---

# realizace-sluzby

> ✅ Kroky dle EMR vzorů (SR diagram 83, DTO 589, packages 154/158 — viz `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele) §6). Konvence: `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md).

## Zařazení
- **Typ:** Produkční · **Role:** Systémový analytik + Class Modeller (DTO/spec) · **Fáze:** F3 · **Brána:** G2

## Vstupy
- Operace v katalogu komponent; service package z `emr-scaffold` (režim C) vč. tagged value `505-1 Operation Link`.
- LDM entity DB Resource komponenty (`logicky-datovy-model`); Dynamic View omezení z `realizace-uc`.

## Kroky

**SR sekvence:**
1. Ověř kostru: SR + DTO + version_ diagram existují, `505-1 Operation Link` vyplněn.
2. **Gate na OBOU koncích sekvence** (✅ N-K3-7): vstupní Diagram Gate (vlevo nahoře) i výstupní Diagram Gate (vlevo dole) — **přímým create s `type: "DiagramGate"`** (✅ vendor + UI potvrzeno 2026-07-17, §7h pravidel; gate-clone šablonou ZRUŠEN, MessageEndpoint provizorium zrušeno). První zpráva = call ze vstupního gatu na lifeline vlastnící komponenty, **nese operationID služby**.
3. **Lifeliny zakládej jako NEPOJMENOVANÉ INSTANCE** (✅ N-K4-5, escape K3 — dřívější „rovnou s MDG typem" je PŘEKONANÉ): `type: "Object"`, `name: ""` explicitně, `classifierID` komponenty + plain stereotyp classifiera; entity stejně s stereotypem `entity` (§7g). Type konverzi Object→Component u komponentových instancí ✅ dělá operace bridge `apply_classifier_stereotypes` (idempotentní port `ITAN-Apply Classifier Stereotypes on SD.vbs`, Dokumentace v0.9 §4.4); FIX skript kola je jen fallback. Lifeliny/EP/ref vlastní SR element (owningElementID). Řetězení vrstvami dle IDesign pravidel a typů volání povolených Dynamic View. Lifeliny na diagram VŽDY `place_elements_on_diagram` s **width i height** (jinak hrozí tichý no-op, §7d) a AŽ PAK zprávy. Op-vazby zpráv: PŘED operationID ověř Realization komponenta→interface pro každou cílovou lifeline vč. RA pass-through; zpráva s polem `operation` (`create_or_update_messages`, K1) nese jméno/argumenty/return z operace už při create (✅ 2026-07-21 — name-only update pro nové zprávy odpadá); po create levná kontrola číselné řady `seqNo`; GUI vazba vč. comba je plná (UI ✅ 2026-07-21 — položka handoffu odpadá); ref na nižší SR hned POD příslušný call.
4. DB hrana: lifeliny = Objecty klasifikované **entitami LDM**; zprávy jen CRUD (`C/R/U/D`).
5. Volání jiné služby = **InteractionOccurrence** na její SR; nové potřebné operace → `katalog-komponent` (Proposed).
6. Závěr: return message s návratovou hodnotou **do výstupního Diagram Gate** (vlevo dole) — ne „do vzduchu" (✅ N-K3-7, vrácení G2 kola 3).

**DTO + specifikace rozhraní:**
7. Rozhodni dle tagged value **`contractAuthority`** na package rozhraní (✅ IF1+L3, §6 pravidel): `physical` (nebo bez TV: existuje stabilní XSD/JSON kontrakt?) **Ano** → nemodeluj; do notes DTO hyperlink na specifikaci (centrální katalog interfaces) + případný analytický komentář. **Ne / nestabilní / potřeba diskuse** → modeluj `<Služba>Req` a `<Služba>Res` jako classy pod DTO (owned) na kompozitním diagramu; vazby **Composition** Req/Res→DTO (aggregation=2, non-navigable) a DTO —Dependency«refine»→ SR; atributy z katalogu atributů, typované doménovými typy (classifier, ne text). Notes přebírej ze šablon (GUIDy v `EA-Repozitar-Kontext.md` §13). Detail: `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md) §7e.
8. Specifikace rozhraní = DTO + operation link + odkazy na kontrakt; EA je logický komentář a rozcestník, ne konkurenční kopie. ✅ L3 uzavřeno konvencí `contractAuthority` (model-first vs. physical-first, §6 pravidel); chybí-li TV, navrhni ji doplnit.
8b. **Reference na kód (§13 pravidel):** před rozhodnutím v kroku 7 zkontroluj `code-*` TV na operaci/packagi — existují-li, chovej se jako při `contractAuthority=physical` (kontrakt v repu = fyzická pravda) a do notes dej odkaz. Chatrná dokumentace reusované operace → skill `re-interface` (RE-IF, mini-IR dle `ir-format.md` (skill `emr-konvence`, references/ir-format.md)). Artefakty, jejichž obsah jsi vygeneroval z kódu, označ `re-origin=code`; při pouhém párování nikdy.
9. Potřebu mapování screen↔DTO↔LDM předej skillu `mapovani-rozhrani`.

**Event (Kafka) operace — odlišný postup (metodika v2, kap. 5.4.4):**
10. Pokud je operace na Kafka topicu (`KafkaDesign::Kafka_Topic`; ⚠ type zadávej nekvalifikovaně `Kafka_Topic`, pokud MDG v repu chybí — §10 pravidel, lekce C1), založ SR **i když sekvenční diagram nedává smysl** — SR je tu navigační uzel z katalogu do logického designu. ✅ KF2: zakládá se **stejným scaffoldem jako běžná SR** (`emr-scaffold` režim C / týž ITAN skript), žádná zjednodušená varianta.
11. U eventu je **DTO hlavním nositelem hodnoty** — přesně tam se popisuje struktura eventové zprávy (na rozdíl od synchronní služby, kde specifikace může být „jen" odkaz na XSD).
12. Směr a čtení/zápis rozliš stereotypem na message callu: **`CSOB-ITAN::LD-Publish`** (publikace/zápis) / **`CSOB-ITAN::LD-Read`** (konzumace/čtení) — ✅ KF1, báze UML::Message.
13. Staré synchronní rozhraní k témuž konceptu neměň — event přístup jen pro nově vznikající analýzy.

## Kontrola výstupu
SR navázána na operaci; lokální reference v sekvenci; entity jen na DB hraně s CRUD; DTO není duplikací XSD; request/response jednoznačné; u event operací SR existuje i bez smysluplné sekvence a DTO nese strukturu zprávy. Pak `emr-qa` (sada F3).

## Operace ea-file-bridge
`create_or_update_diagram, create_or_update_messages, create_or_update_elements, create_or_update_attributes, place_elements_on_diagram, create_or_update_connectors`
