---
name: re-interface
description: RE-IF — rychlý reverse engineering specifikace jedné operace z GitHub kódu pro rozhodnutí o reuse. Z code-* referencí / repo-map dohledá kód, kontrakt-first extrahuje request/response/chyby do mini-IR, porovná s EMR (read-only) a navrhne dry-run zápis (notes + code-* TV + re-origin) k HITL schválení. Volán ze skillů katalog-komponent (4d) a realizace-sluzby (8b); v RE-FULL (fáze C) běží v cyklu per operace.
license: Complete terms in LICENSE.txt
---

# re-interface

> ✅ Postup dle `RE/Koncepce-Reverse-Engineering-GitHub.md` §6 (RE-IF), IR dle `ir-format.md` (skill `emr-konvence`, references/ir-format.md), konvence `code-*`/`re-origin` dle `emr-zapis-pravidla.md` (skill `emr-konvence`, references/emr-zapis-pravidla.md) §13. E2E ověřeno na `re-fixtures/` proti demo EMR (pkg 151/154/158) 2026-07-12. Skill sám je read-only — zápis jde po bráně standardními kanály. **Zápisová část ověřena tréninkem C1 (2026-07-12, demo EMR)** — vzorový průběh vč. journalu, baselines a UNDO drillu: `emr-bridge/archive/journal-RE-C1-2026-07-12.md`.

## Zařazení
- **Typ:** Produkční · **Role:** Systémový analytik · **Fáze:** F2 (most) / F3 — trigger: kandidát na reuse s chatrnou/chybějící specifikací · **Brána:** G2 (návrh zápisu vždy přes HITL)

## Vstupy
- Operace z katalogu komponent (typicky z Dynamického pohledu / impact analýzy), nebo jméno služby, která by v katalogu být měla.
- Reference na kód: `code-repo`/`code-path`/`code-ref` TV na operaci; chybí-li, `RE/repo-map.yaml` (složka `RE/` v IT-ANALYSIS — master, O3). Není-li ani tam: dohledání (org search, naming konvence) a **návrh doplnění mapy** (zapisuje Miloš/vlastník mapy).
- Checkout repa (pin na `code-ref`), nebo ekvivalentní code bundle (repomix adaptér, koncepce §8 — volitelný; filtr: kontraktové soubory + api/dto/entity balíčky).
- `ir-format.md` (skill `emr-konvence`, references/ir-format.md) (formát výstupu), `EA-Repozitar-Kontext.md` (mimo workspace — vyžádej od uživatele) (vzory pro diff).

## Kroky

**1. Lokalizace kódu.** `code-*` TV na operaci → checkout na `code-ref`. Bez TV: `RE/repo-map.yaml` (komponenta → repo/path); při nesouladu TV×mapa platí mapa (§13). Zafixuj commit SHA — celé IR platí jen k němu.

**2. Extrakce — kontrakt-first (koncepce, princip 2).** ✅ C2 2026-07-12: strukturu extrahuje **deterministický skript `re-fixtures/tools/ir-extract.py`** (`--repo --repo-map --ref --out`; repo-map může nést i `platform`); LLM doplňuje jen `summary` a kontroluje mapování jmen na katalog (krok 3). Ruční grep níže zůstává jako fallback mimo pokryté vzory (OSS robustnost = C5). Pořadí zdrojů pravdy:
   a. **Kontraktové soubory**: `openapi*.{yaml,json}`, `*.avsc`, `*.proto`, `*.xsd`, WSDL, AsyncAPI, schema-registry exporty. Existuje-li kontrakt operace, struktura polí se bere z něj; kód jen ověř, že kontrakt není mrtvý (endpoint/topic v kódu skutečně existuje).
   b. **Kód rozhraní** (jen když kontrakt chybí — `authority: none`): grep/AST na `@RestController`/`@GetMapping`/`@PostMapping`/Ktor routing, `@KafkaListener`, `KafkaTemplate`/producer, `@JmsListener`/MQ sender; request/response třídy (DTO). Každé pole extrahované z kódu nese `evidence: path:line`.
   c. **Testy a příklady payloadů** — jen jako ověření/doplnění, ne primární zdroj.
   Extrahuj **pouze kontrakt operace**: request/response struktura, chybové stavy, u eventů topic + struktura zprávy. Žádné SR, žádný LDM (to je RE-FULL, fáze C); volání jiných služeb zapiš nanejvýš do `dependencies` s evidence.

**3. Mapování nálezu na logickou úroveň.**
   - REST operace → operace na interfacu komponenty; jméno `service` dle katalogu (existuje-li), jinak návrh dle naming konvencí (N-OPR), ne dle jména metody v kódu.
   - **Kafka** → `event.topic` + event jako operace na `KafkaDesign::Kafka_Topic` (§10 pravidel); směr = `kind: kafka-publish`/`kafka-consume` (v EMR stereotyp `LD-Publish`/`LD-Read`); strukturu zprávy nese DTO.
   - **MQ (✅ O1)**: listener/sender = **běžná operace komponenty** (vzor T-Hub) — žádné queue elementy, žádná Kafka analogie. Fyzickou queue zapiš do `mq.queue` (jen dokumentační stopa v IR); async/batch varianta = operace samostatné komponenty, opět běžné.
   - Technické vrstvy (config, security filtry, mapery, DI, retry/observability) ignoruj.

**4. Mini-IR.** Sestav `<Service>.ir.yaml` dle `ir-format.md` (skill `emr-konvence`, references/ir-format.md) (sekce identita, repo, contract, příp. event/mq; `dependencies` volitelně, `summary` = 1 odstavec LLM shrnutí). Validuj proti §5 ir-format (povinná pole, evidence).

**5. Diff proti EMR — POUZE čtení** (`find_*`, `get_*`, příp. SQL):
   a. Operace: `find_elements_by_name` v katalogu (master `Solution Artefacts` i `…Proposed`) → interface → `get_elements_information` (parametry, notes, TV vč. `code-*`).
   b. SR/service package: SQL vzor 505-1 (`t_objectproperties WHERE Property='505-1 Operation Link'`), nebo `find_packages_by_name` v Logical Design. ⚠ 505-1 bývá prázdná (demo SR 322/588 před C1; od 2026-07-12 v demu vyplněné) — pak hledej podle jména služby a prázdnou 505-1 vykaž jako součást `undocumented` nálezu.
   c. Kafka: existence `Kafka_Topic` elementu + eventu jako operace. ⚠ `find_elements_by_name` vrací při nenalezení **chybu** „no matched item", ne prázdný seznam — negativní nález (= podklad pro `missing`) čti z chybové hlášky.
   d. Klasifikuj `emr.diff` dle ir-format §4 (`missing`/`undocumented`/`match`/`CONFLICT`) a vyplň `emr.finding`. **CONFLICT nikdy neopravuj** — je to nález pro člověka.
   e. ✅ C3 2026-07-12: klasifikaci provádí strojově **`re-fixtures/tools/emr-ir-check.py`** — RAW výstupy `get_elements_information` ulož do dump souboru (= evidence čtení dle §7g) a pusť `--ir <dir> --dump <soubor>`; kontroluje notes, `code-*` TV (repo/ref/path vůči IR) i 505-1 na SR (prázdná = undocumented, jiný cíl = CONFLICT). LLM krok zůstává jen pro dohledání kandidátů (find_* podle jmen) a interpretaci CONFLICT.

**6. Rozhodnutí dle contractAuthority (koncepce §6 bod 4).** Nalezen kontraktový soubor → `physical`: do EMR jen hyperlink na kontrakt + stručný logický popis do notes operace + `code-*` TV; DTO se nemodeluje jako kopie. Kontrakt jen v kódu (`none`) → zvaž DTO jako analytickou mezivrstvu (modeluje se standardně přes `realizace-sluzby` krok 7). `model` → EMR vlastní kontrakt, RE nález slouží jen k verifikaci (diff `match`/`CONFLICT`).

**7. Návrh zápisu — dry-run (v tomto kole se NEPROVÁDÍ).** Per operace dle diff klasifikace sestav plán v termínech existujících kanálů (princip 5 koncepce — žádný nový zapisovač):
   - `missing` → založení operace do `Solution Artefacts Proposed` (`katalog-komponent` kroky 1–4c), u Kafky topic + event (§10 pravidel); service package až na pokyn (`emr-scaffold` C).
   - `undocumented` → update notes operace (shrnutí ze `summary` + hyperlink na kontrakt) + `code-*` TV; pozor — update existujícího elementu je dvoukolový režim §12a (dry-run diff → schválení per GUID).
   - `match` → jen refresh `code-verified`.
   - Provenance: `re-origin=code` **výhradně** na obsah vygenerovaný z kódu (notes, DTO, event struktury); při pouhém párování jen `code-*` bez `re-origin` (O2, §13). AI razítka §12b nezávisle na tom.
   - I při **zamítnutí reuse** navrhni zapsat `code-*` TV + jednořádkové shrnutí — příští čtení je levnější.

**8. HITL brána.** Předlož: IR soubor(y), diff klasifikaci s evidencí, dry-run návrh zápisu (co, kam, jakým skillem, jaké TV). Nic se nezapisuje bez schválení; po schválení zápis provádějí standardní skilly (`katalog-komponent`, `realizace-sluzby`) — RE je pro ně jen jiný zdroj obsahu. Předkládej **lidsky** (tabulka „co se změní z → na", per položka u updatů, blok u nových), nikdy YAML/JSON.

**Zápisová část — lekce z C1 (2026-07-12, závazné pro realizaci po bráně):**
- Pořadí dle §12a: schválení → journal se snapshoty starých hodnot (soubor + Artifact v #AI-LOG/#AI-SANDBOX) → mikro-baselines dotčených packages → zápis → **zpětné čtení každé dávky** (vykazuje se jen přečtený stav, ne response).
- `code-path` u `authority: physical` ukazuj na kontraktový soubor, u `none` na vstupní bod (controller/consumer/DTO) z IR `repo.path`.
- 505-1 na SR zapisuj `ids` strukturou (§7h) samostatným updatem SR (jen `taggedValues` — notes se nedotýkají) + `AI-Modified`.
- Kafka topic: type nekvalifikovaně `Kafka_Topic` (FQ padá bez instalovaného MDG; demo = ThubDesignProfile, produkce = KafkaDesign) a profil ověř zpětným čtením.
- `create_baseline` bez názvu → restore manifest povinně v journalu; eventová pole zpravy do notes event operace, dokud se nemodeluje DTO.

## Kontrola výstupu
IR validní dle `ir-format.md` §5 (povinná pole, evidence u polí z kódu, errors a dependencies); `service`/`component` v termínech katalogu; každá operace má `emr.diff` + u `undocumented`/`CONFLICT` vyplněný `finding`; MQ nález bez queue elementů v návrhu; `re-origin=code` jen na generovaný obsah; žádný zápis bez brány. Golden/mutační testy: `re-fixtures/` (fixture musí projít bez ručních zásahů, mutace M1–M3 musí diff odhalit). Pak `emr-qa` (sada F3).

## Operace ea-file-bridge
Read-only: `find_elements_by_name, find_packages_by_name, get_elements_information, get_packages_information, get_connectors_information` (+ SQL přes ea-sql-expert). Zápisové nástroje až po bráně a mimo tento skill.
