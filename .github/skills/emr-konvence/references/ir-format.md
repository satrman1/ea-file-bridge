# IR formát „code-mirror" (sdílená reference)

Intermediate reprezentace pro reverse engineering z GitHub codebase (`RE/Koncepce-Reverse-Engineering-GitHub.md` §7, rozhodnutí O4). Z kódu se **nikdy nezapisuje do EMR přímo** — vždy přes IR: reviewovatelný, diffovatelný a testovatelný YAML per služba/operace. Konzumenti: skill `re-interface` (RE-IF, mini-IR), budoucí RE-FULL orchestrace (fáze C), golden/mutační testy (`re-fixtures/`). Konvence zápisu výsledku do EMR: [emr-zapis-pravidla](emr-zapis-pravidla.md) §13 (`code-*` TV, `re-origin`).

Stav: v1, fáze B · 2026-07-12 · Vazby: koncepce §6–§7+§9, `INTERFACES/KONCEPT Katalog rozhrani a analyticke repo.md` §4.1 (IF-0 záznam).

## 1. Principy

1. **As-implemented.** IR popisuje, co kód *dělá* (fyzická pravda k `repo.ref`), ne co měl dělat. Konflikt s EMR je nález pro člověka (`diff: CONFLICT`), nikdy tichá oprava.
2. **Evidence povinná.** Každé netriviální tvrzení nese `evidence: <path:line>` (cesta v repu + řádek k pinnutému ref). Bez evidence je tvrzení jen hypotéza a do IR nepatří.
3. **1 IR = 1 operace/služba.** Soubor `<Service>.ir.yaml` (u eventů jméno eventu, např. `TransactionCreated.ir.yaml`). Uložení: analytické repo, do jeho vzniku projektová složka; fixture golden v `re-fixtures/golden/`.
4. **Determinismus.** Strukturu (operace, pole, topicy, závislosti) nese deterministická extrakce (grep/AST, kontraktové soubory); LLM nese jen `summary` a `note` texty. Dva běhy nad stejným `ref` musí dát identickou strukturu.
5. **Logická úroveň.** Jména `service`/`component` jsou z **katalogu komponent** (ne z kódu); technické vrstvy (config, security, mapery, DI, retry) se filtrují. MQ nález se zaznamenává fyzicky (queue v `mq:`), ale do EMR se mapuje jako běžná operace komponenty — žádné queue elementy (✅ O1, §13 pravidel).

## 2. Anotovaný vzor

```yaml
# --- identita (zarovnáno s IF-0 operation.*) ------------------------------
service: ReadTransaction            # jméno operace dle katalogu komponent (IF-0: operation.name)
component: DEMO DB Resource         # komponenta z katalogu, NE jméno třídy z kódu (IF-0: operation.component)
platform: DEMO Platforma            # platforma z katalogu (IF-0: operation.platform)
kind: rest                          # rest | kafka-publish | kafka-consume | mq-send | mq-listen
                                    # mq-* je jen nález v kódu; do EMR běžná operace komponenty (O1)

# --- kde kód bydlí ---------------------------------------------------------
repo:
  url: https://github.com/<org>/demo-transactions   # = budoucí TV code-repo
  ref: a1b2c3d                                      # commit SHA/tag = TV code-ref; IR platí JEN k tomuto ref
  path: src/main/kotlin/cz/demo/transactions/db     # vstupní bod/modul = TV code-path

# --- kontrakt (kolonky = IF-0 záznam, KONCEPT §4.1 — žádné paralelní schéma) ---
contract:
  authority: physical               # physical = nalezen kontraktový soubor | none = jen kód
                                    # | model = kontrakt vlastní EMR (RE ho nepřepisuje)
  files:                            # = IF-0 contracts[]; prázdné při authority: none
    - type: openapi                 # openapi | asyncapi | avro | protobuf | xsd | wsdl | json-schema
      role: request+response        # request | response | request+response | event
      file: api/openapi.yaml        # cesta v repu (IF-0: file)
      version: "1.0"                # verze kontraktu, je-li v souboru (IF-0: version)
  request:                          # struktura po polích — z kontraktu, jinak z kódu (pak evidence povinná)
    fields:
      - { name: AccountId,       type: string, required: true,  note: "" }
      - { name: PeriodFromDate,  type: date,   required: true,  note: "" }
  response:
    fields:
      - { name: PostDate,        type: date,    required: true, note: "datum zaúčtování" }
      - { name: Amount,          type: decimal, required: true, note: "" }
  errors:
    - { code: ACCOUNT_NOT_FOUND, meaning: "účet neexistuje", evidence: "src/...:47" }

# --- jen kind: kafka-* ------------------------------------------------------
event:
  topic: demo.transaction.created   # fyzické jméno topicu z kódu/konfigurace
  name: TransactionCreated          # event = operace na Kafka_Topic elementu (§10 pravidel)
  dto: TransactionCreatedEvent      # nositel struktury zprávy; pole zprávy v contract.request
                                    # (zpráva je u eventu jediná struktura — response se nepoužívá)
  evidence: "src/.../TransactionEventProducer.kt:14"

# --- jen kind: mq-* ---------------------------------------------------------
mq:
  queue: DEMO.TRANSACTIONS.EXPORT   # fyzická queue — POUZE dokumentační; v EMR se nemodeluje (O1)
  evidence: "src/.../TransactionExportListener.kt:12"

# --- závislosti (RE-FULL; v RE-IF mini-IR volitelné) ------------------------
dependencies:
  - { calls: ReadTransaction, kind: sync, evidence: "src/.../TransactionDbClient.kt:15" }
  - { entity: Transaction, crud: R,  evidence: "src/.../TransactionDbService.kt:18" }

# --- sémantika (jediná LLM část) --------------------------------------------
summary: >
  Jeden odstavec: co operace dělá byznysově, pro koho, s jakými omezeními.

# --- vazba na EMR (doplní diff krok; před ním sekce chybí) -------------------
emr:
  operation_id: 11                  # elementID/operationID z katalogu (ID stačí; bridge response GUIDy vrací — §7 pravidel)
  sr_package: 154                   # packageID service package, existuje-li
  diff: undocumented                # missing | undocumented | match | CONFLICT (sémantika §4)
  finding: >                        # povinné u undocumented/CONFLICT: co přesně nesedí/chybí
    Operace v katalogu bez parametrů a notes; SR package existuje, DTO jen šablonové notes.

# --- provenance běhu ---------------------------------------------------------
provenance:
  extracted: 2026-07-12
  by: re-interface v1               # skill + verze postupu
```

## 3. Mapování IR → IF-0 (rozhodnutí O4)

RE-IF plní katalog rozhraní jako vedlejší produkt — IF-0 záznam vznikne z IR bez konverzí:

| IF-0 (KONCEPT §4.1) | IR | Pozn. |
|---|---|---|
| `operation.name` | `service` | |
| `operation.component` / `.platform` | `component` / `platform` | |
| `operation.eaGuid` | `emr.operation_id` | ID + dohledání (bridge GUIDy vrací — §7 pravidel; „GUID doplní člověk/SQL" platilo jen pro domácí MCP) |
| `operation.owner` / `.status` | — | doplní analytik při zápisu do katalogu (IR je nezná) |
| `contracts[].type/role/file/version` | `contract.files[]` | stejné kolonky |
| `contracts[].contractAuthority` | `contract.authority` | v IR jednou za operaci (RE nález je vždy jednotný). ⚠ `none` v IF-0/TV protějšek nemá (TV contractAuthority zná jen `model`\|`physical`, §6 pravidel) — při `none` se TV **nezapisuje** a analytik při zápisu do katalogu rozhodne dle metodiky §5.4.5 (typicky návrh `physical` po vzniku kontraktu, nebo `model` při vlastnictví rozhraní) |
| `consumers`, `mappings` | — | mimo RE scope; doplňuje se v katalogu |
| `notes` | `summary` | |

## 4. Sémantika `emr.diff`

| Hodnota | Význam | Návazný krok |
|---|---|---|
| `missing` | operace/topic v katalogu neexistuje | návrh založení do Proposed (katalog-first) |
| `undocumented` | existuje, ale bez použitelné specifikace (bez parametrů, notes, kontraktového odkazu, `code-*` TV) | doplnění notes + `code-*` TV + odkaz na kontrakt |
| `match` | existuje a dokumentace odpovídá kódu (pole, chování, reference) | jen `code-verified` refresh |
| `CONFLICT` | existuje a dokumentace kódu **odporuje** | nález pro člověka, žádná automatická oprava (princip as-implemented) |

## 5. Validace IR (kontroluje QA / golden testy)

1. Povinná pole: `service`, `component`, `kind`, `repo.{url,ref,path}`, `contract.authority`, `summary`, `provenance`.
2. `contract.authority: physical` ⇒ `contract.files` neprázdné; `none` ⇒ pole request/response mají `evidence` (nebo evidencí je `repo.path` vstupního bodu uvedený u operace).
3. `kind: kafka-*` ⇒ sekce `event` povinná; `kind: mq-*` ⇒ sekce `mq` povinná; jinak se sekce vynechávají.
4. Jména `service`/`component` existují v katalogu komponent, nebo je IR explicitně navrhuje (`emr.diff: missing`).
5. Každý záznam `dependencies` a `errors` má `evidence`.
6. Diff dvou IR téhož `service` je testovatelný nástrojem `re-fixtures/tools/ir-diff.py` (golden/mutační testy, koncepce §9).
