# EMR Bridge protokol (dávková předávka agent ↔ executor)

**Rev. 2026-08-29 (framecheck):** kanál pro EA je v bance **výhradně EA File Bridge** — agent MCP nikdy nemá (rozhodnutí 2026-08-16, [emr-zapis-pravidla](emr-zapis-pravidla.md) §7b): zápis i čtení jde JSON dávkou `requests/` → executor bridge → `responses/`. Markdown vrstva inbox/outbox níže je předávka **mezi agenty** (analytik-agent ↔ EMR agent) NAD touto JSON vrstvou — obě vrstvy nezaměňovat. Doma (Cowork) může Claude použít domácí MCP, ale jen pro test/dev — není to vzor pro banku a žádný „plný MCP režim pro Copilot" se neplánuje. Historie: protokol vznikl pro hybridní režim Zoo Code (community fork Roo Code) — ten je překonaný mezikrok (Metodika v2 §17.2).

## Dělba rolí

| Agent | Nástroj | Skilly | Smí |
|---|---|---|---|
| **Analytik-agent** | GitHub Copilot (agent mode) | `sa-orchestrator`, `prevzeti-zadani`, `use-case-model`, `logicka-obrazovka`, `realizace-uc`, `katalog-komponent`*, `realizace-sluzby`, `logicky-datovy-model`, `mapovani-rozhrani`, `verzovani-release`* | analytická rozhodnutí, tvorba obsahu, sestavování dávek; **nikdy** přímý zápis do EA |
| **EMR agent** | v bance: sestavuje a validuje JSON dávky pro executor EA File Bridge (`requests/`→`responses/`); doma jen test/dev přes domácí MCP | `emr-scaffold`, `emr-qa` + vykonávání dávek | čtení/zápis EA výhradně dávkou přes bridge dle [emr-zapis-pravidla](emr-zapis-pravidla.md); **žádná** analytická rozhodnutí |

\* analytická část v Copilotu, EA operace dávkou přes bridge.

## Struktura ve workspace

```
emr-bridge/
├── STATE.md        # cache stavu workflow (zdroj pravdy = EMR!)
├── inbox/          # příkazy: analytik-agent → EMR agent
├── outbox/         # výsledky: EMR agent → analytik-agent
└── archive/        # vyřízené páry (id-příkaz + id-result)
```

## Příkaz (inbox/NNN-typ-slug.md)

```markdown
---
id: 012
typ: cteni | zapis | scaffold | qa | dry-run | delete-request
stav: requested            # requested → in-progress → done | failed
fáze: F1
projekt: <název>
---
# 012 — zapis: UC-00123 Zobrazení potvrzení

## Operace (závazně dle _shared/emr-zapis-pravidla.md)
1. create_or_update_elements: Behavioral Rule "BRU-0042 Validace limitu"
   - owner: package `RULES (REUSABLE)` (přepoužitelné pravidlo, konvence `BRU-####` s pomlčkou — §3), notes: |...|
2. create_or_update_connectors: {GUID UC} —Usage(«use»)→ $g1, direction: FromSourceToTarget (✅ N-K3-1; UC—Realization→BRU je překonané)
3. create_or_update_requirements: element {GUID UC}, requirements: [{name: "BRU00123-1 Kontrola disponibilního zůstatku", notes: |...|}]
...
```

⚠ **Lokální pravidla `BRU<čísloUC>-Y` (bez pomlčky) NEJSOU samostatný element pod UC** — od U5 rev. 2026-08-21 jsou to internal requirements uvnitř UC (záložka Responsibilities → Requirements, `t_objectrequires`) a zapisují se operací `create_or_update_requirements` (iterace 6 bridge, docs v0.12 §6i), **bez konektoru**. Dřívější vzor „element pod UC + Usage konektor" (N-K3-2) platí už jen pro přepoužitelná `BRU-####`.

Pravidla příkazů:
- **Jedna dávka = jeden ucelený artefaktový celek** (celý UC package, celá QA sada) — minimalizuj počet předávek.
- Placeholdery `$g1, $g2…` pro GUID elementů vytvořených dříve v téže dávce.
- `typ: cteni` = výpis kontextu (package/element/diagram dump) — analytik-agent si jím nahrazuje přímé čtení EA před analytickou prací.
- `typ: scaffold` = parametry pro `emr-scaffold` režim A/B/C; `typ: qa` = sada + scope pro `emr-qa`.
- `typ: dry-run` = **povinné předkolo každé dávky obsahující update/delete cizího obsahu** ([emr-zapis-pravidla](emr-zapis-pravidla.md) §12a): EMR agent nic nezapisuje, vrátí diff plán (per pole: stará → nová hodnota; u diagramů co přibude/změní se). Následná ostrá dávka `typ: zapis` odkazuje na id dry-run dávky + explicitní schválení člověka per GUID.
- `typ: delete-request` = žádost o smazání existujících elementů: seznam GUID + zdůvodnění + dopady (kde je element použit). Vykonává **člověk** ručně v EA, EMR agent jen loguje do `#AI-LOG`.

## Výsledek (outbox/NNN-result.md)

Stejné `id`; obsahuje: stav (done/failed), tabulku placeholder→GUID, u čtení strukturovaný výpis, u QA report (sada, nálezy B/W/I), u chyby přesný důvod + co EMR agent potřebuje rozhodnout. U zápisu navíc **restore manifest** (dotčený package GUID → **GUID baseline** + konvenční označení `AI-pre-<session>-<batch>`; ⚠ MCP `create_baseline` název zadat neumí — baseline je v EA bezejmenná, konvenci nese jen manifest, §12c; executor bridge název zadává přímo (`Project.CreateBaseline`); limit platí jen pro domácí MCP) a odkaz na session journal ([emr-zapis-pravidla](emr-zapis-pravidla.md) §12c–d). Po zpracování přesune EMR agent pár do `archive/`.

## STATE.md

Tabulka: fáze, brána, poslední Gate Record, rozpracované dávky (id, typ, stav), datum poslední synchronizace s EMR. Aktualizuje **výhradně EMR agent** po každé dávce (analytik-agent jen čte). Při pochybnostech platí EMR, ne STATE.md — EMR agent umí na žádost (`typ: cteni`, scope `stav-workflow`) STATE.md znovu sestavit z EMR.

## Tvrdá pravidla

1. EMR agent před zápisem validuje dávku proti [emr-zapis-pravidla](emr-zapis-pravidla.md) (větev, naming, typy) — nevyhovující dávku vrací `failed` s důvodem, nezapisuje „přibližně".
2. EMR agent nedomýšlí chybějící údaje; chybí-li parametr, `failed` + otázka.
3. Analytik-agent nikdy needituje outbox ani STATE.md; EMR agent nikdy needituje obsah příkazu (jen frontmatter `stav`).
4. GUID z výsledků přenáší analytik-agent do navazujících dávek — to je jediná „paměť" mezi dávkami vedle EMR.
5. HUMAN_DECISION (brány) probíhá u analytik-agenta; Gate Record zapisuje EMR agent dávkou `typ: zapis`.
6. EMR agent vynucuje ochranné vrstvy [emr-zapis-pravidla](emr-zapis-pravidla.md) §12: razítka na vše AI-created, mikro-baseline před zápisem do existující package, vykázání objemu dávky v result + při překročení orientační soft úrovně `failed` s žádostí o potvrzení uživatelem (✅ R2 — tvrdý stop se zatím neaplikuje), update cizího obsahu bez odkazu na schválený dry-run = `failed`.
