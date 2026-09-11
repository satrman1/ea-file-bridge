---
name: katalog-komponent
description: Správa katalogu komponent jako zdroje pravdy pro platformy, komponenty, interfacy a operace — vč. návrhu nových operací na rozhraní (Proposed → master) a správy Dynamic Views (povolené komponenty a typy volání per typ UC). Operace žijí na interfacech, ne jako volné projektové vynálezy.
license: Complete terms in LICENSE.txt
---

# katalog-komponent

> ✅ Kroky dle EMR vzoru pkg 151 (IDS-IDesign komponenty — viz `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele) §8). Interface vzor ✅ K1, governance ✅ K2 (2026-07-06, MLA); Dynamic View ✅ D1–D6; 505-1 ✅ K3. Konvence: `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md).

## Zařazení
- **Typ:** Produkční (governance) · **Role:** Systémový analytik · **Fáze:** F3 (průběžně) · **Brána:** G2

## Vstupy
- Požadavky na služby/operace z `realizace-uc` a `realizace-sluzby`; typ UC pro Dynamic View.

## Kroky

**Komponenty a operace:**
1. Před návrhem vždy hledej existující (`find_elements_by_name`) v masteru `Solution Artefacts` i `Solution Artefacts Proposed` — žádné duplicitní služby.
2. Nové návrhy **výhradně do Proposed** s vlastníkem. ✅ K2: do master katalogu má přístup jen velmi úzká skupina uživatelů — **skill přesun pouze doporučuje**, nikdy neprovádí; k přesunu reálně dochází až v momentě **nasazení operace na produkci**.
3. Komponenty = typy MDG **IDS-IDesign** (`IDS-Client/Manager/Engine/Resource Access/DB Resource/Subsystem`), per platforma package, per komponenta kompozitní diagram `IDS-IDesign::Service Contract Detail`.
4. Operace definuj na **interfacech** komponent. ✅ K1 (popis PRODUKČNÍ reality, ne předpis pro nové zápisy): interface bývá v produkci stereotypovaná classa s operacemi — provided interface, ale ne lollipop; jedna komponenta realizuje více interfaces a interface může sám realizovat další interfaces (in-line řetěz) — **operace ze všech in-line interfaces jsou dostupné na message callech instancí dané komponenty** na sekvenčním diagramu. **NOVÉ interfacy se zakládají výhradně dle vzoru N-SH-2** (krok 4e + `sar-pravidla.md` (skill `emr-konvence`, references/sar-pravidla.md) §4.8): plain `UML::Interface` bez stereotypu, jména `common interface` / `common interface proposed`, owned pod elementem komponenty, Realization + kompozit Service Contract Detail. Na operace se váže `505-1 Operation Link` ze SR (zápis `ids` strukturou s operationID — §7h pravidel, GUID netřeba) a operationID z message callů. Naming dle `references/operation-name-rules.md` (skill `structural-modeller`) (N-OPR: anglicky, PascalCase, CRUD vzory).
4b. **Komponenta —Realization→ interface je povinná součást zápisu** (§7g) — bez ní EA nenabízí operace interfacu k navázání na message cally. Před předáním do realizačních skillů ověř, že Realization existuje pro **KAŽDOU komponentu, jejíž lifeline má operace přijímat, vč. RA pass-through** (✅ N-K3-6a — chybějící DEMO RA→DB IF byla kořenová příčina G2 diagnostiky kola 3). U nového/Proposed interfacu ji založ hned, se směrem `"direction": "FromSourceToTarget"` (✅ 2026-07-13, enum hodnoty §7h pravidel — FIX skript pro směry odpadá). Pozor: hromadný Update Realizací ve VBS skriptech umí viset — řešit jednotlivě.

**Reference na kód (✅ konvence 2026-07-12, §13 pravidel):**
4c. Při zakládání/úpravě operace doplň `code-*` TV (repo, path, ref, verified) dle `RE/repo-map.yaml` (složka `RE/` v IT-ANALYSIS) — master je mapa, TV jsou derivát; při nesouladu platí mapa. Najdeš-li na operaci `code-repo`, čti kód/kontrakt jako fyzickou pravdu a EMR notes jako logický komentář.
4d. Reuse operace s chatrnou dokumentací → skill **`re-interface`** (RE-IF, ✅ fáze B): vytáhne kontrakt z kódu do mini-IR (`ir-format.md` (skill `emr-konvence`, references/ir-format.md)), klasifikuje diff proti EMR a předloží dry-run návrh zápisu; referenci zapiš i při zamítnutí reuse. `re-origin=code` dávej jen na obsah vygenerovaný z kódu, **nikdy při pouhém párování** (§13 pravidel).
4e. **Granularita interfaců (✅ D9 delty, 2026-07-19):** typický vzor komponenty = **jeden common interface + jeden proposed interface** — proposed existuje kvůli logice zámků (proposed odemčený pro všechny, master zamčený), NE kvůli sémantickému členění. **Sémantické facetování kontraktů (více interfaců dle IDesign contract factoring) se dělá jen u exponovaných integračních komponent a je to rozhodnutí SARa** — nenavrhuj nové interfacy z vlastní iniciativy; nové operace patří na existující proposed interface. Granularita operací = doména ITANa se supervizí SARa (šedá zóna dle seniority) — návrhy operací předkládej s odůvodněním.

**Dynamic View (per typ UC):**
5. Dynamic View vyjmenovává komponenty a typy volání povolené pro daný typ UC; je připojen k UC a determinuje instance v UCR/SR sekvencích (mechanismus ⚠ D1–D6 — element typ, umístění, konektor, číselník typů UC).
6. Při zavedení nové komponenty/typu volání aktualizuj dotčené Dynamic Views.

**Kafka / událostní rozhraní (metodika v2, kap. 5.4.4 — nová oblast, dosud bez precedentu v repu):**
7. Kafka topic modeluj jako element **`KafkaDesign::Kafka_Topic`** (✅ KF1 2026-07-06); jednotlivé eventy jako **UML operace** na něm, aby bylo z modelu vidět, kdo publikuje a kdo konzumuje. Message cally eventů nesou stereotyp `CSOB-ITAN::LD-Publish` / `CSOB-ITAN::LD-Read` (§4 pravidel). ⚠ Type zadávej **nekvalifikovaně `Kafka_Topic`** — FQ padá, pokud MDG v repu chybí (demo QEA = ThubDesignProfile), a shodí celou dávku; navázaný profil ověř zpětným čtením (§10/§7h pravidel, lekce C1).
8. Stará synchronní rozhraní k témuž doménovému konceptu zůstávají beze změny (zpětná kompatibilita) — event přístup zaváděj jen u nově vznikajících analýz, staré se nepředělávají.

## Kontrola výstupu
Bez duplicit; operace jen na interfacech; návrhy v Proposed s vlastníkem; Dynamic Views konzistentní s katalogem; Kafka topicy (pokud použité) mají eventy jako operace, ne volné elementy. K dávce přilož **shrnutí producenta s confidence flags** dle `hitl-brany.md` (skill `emr-konvence`, references/hitl-brany.md) (WP4, ✅ 2026-07-17). Pak `emr-qa` (sada F3).

## Operace ea-file-bridge
`find_elements_by_name, create_or_update_elements, create_or_update_operations, create_or_update_connectors, create_or_update_diagram`
