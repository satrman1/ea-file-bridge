# Iterace 6 — živý E2E protokol (2026-08-21)

Rozsah: **join na krok** (oprava vyvráceného nálezu N-1) · **`move_elements`** (dostavba po N-2) ·
**`create_or_update_requirements`** (lokální BRU jako internal requirement, U5 rev. 2026-08-21).
Kontrakt a mechanika: `docs/PROTOKOL-EAFB.md` **v0.12 §6i**. Offline sito: `test/harness.js` **181/181 PASS**.

Prostředí: EAExample.qea (dev stanice), kanál **pumpa**, kulisa SportHub v `#FB-TEST`
(UC-95002 = el. 11310, UC-95003 = el. 11311; cílové packages 1069 / 1070; `OTHER ELEMENTS` = 1067).

## Průběh

| # | dávka | co | výsledek |
|---|---|---|---|
| -90 | ping | první dávka session (pravidlo 2) | ✅ `eaVersion 1715` |
| -91 | čtecí | **stav PŘED** ručním zásahem: schéma `t_objectscenarios` přes `sqlite_master` (N-4) + `SELECT *` scénářů UC-95002 | ✅ 5 scénářů; `join` u dvou větví = `ScenarioGUID` (co psal starý bridge), u dvou prázdný |
| — | **ruční krok Miloše v EA UI** | UC-95002 → Scenarios → Entry Points → `Join`: `AF95002-1` → krok 7, `AF95002-3` → krok 10 | — |
| -92 | čtecí | **stav PO**, diff proti -91 | ✅ **`join` = GUID KROKU** \| `"End"`; EA přitom XMLContent normalizovala (viz níže) |
| -93 | čtecí | sonda schématu `t_objectrequires` (`sqlite_master`) | ✅ `ReqID, Object_ID, Requirement, ReqType, Status, Notes, Stability, Difficulty, Priority, LastUpdate`; bez GUID |
| -94 | `deploy_src` | 8 souborů (join, `move_elements`, requirements, warning u `package`, registr, gate, politika, Output) | ✅ ELEVATED → potvrzeno; `created: FB_OpMoveElements, FB_OpRequirements`, registr 40 → **42** |
| -95 | scénáře | rebuild kompletních sad obou UC, `join` **číslem kroku** | ✅ 5+5 scénářů, `removed 5+5`, **žádný warning** |
| -96 | čtecí | důkaz: mapování `join` GUIDů na čísla kroků | ✅ 95002: krok 9 a 10 + 2× `End`; 95003: krok 2 + 3× `End` |
| — | **kontrola Miloše v EA UI** | Entry Points ukazují **čísla kroků**, ne `End` | ✅ potvrzeno |
| -97 | `move_elements` | 11310 → 1069, 11311 → 1070 | ⚠ `moved: false` — oba UC už v cílech byly (přesunuty mezitím ručně). Idempotence OK, ale **důkaz žádný** |
| -99 | `move_elements` | **round-trip** 11310: 1069 → 1067 → 1069 | ✅ `moved: true` obě operace, readback `Package_ID` sedí; ⚠ `children: 0` → vedlo na experiment -A1 |
| -A1 | move + query **uvnitř dávky** | 11311: 1070 → 1067, **čtení BRU uprostřed**, → 1070 | ✅ 4 BRU byly s rodičem v 1067 → **EA kaskáduje potomky sama** |
| -A2 | `deploy_src` | oprava vykazování: `children`/`childrenFixed`, `diagrams`/`diagramsFixed` | ✅ |
| -A4 | move + requirements + delete + čtení | round-trip 11311 s novým vykazováním · 3+4 internal requirements · smazání 7 BRU elementů · kontrola | ✅ `children: 4, childrenFixed: 0` · 7 requirements v `t_objectrequires` · `ZbyleUsageKonektory: 0` · QC **čisté** |
| — | **kontrola Miloše v EA UI** | Responsibilities → Requirements u obou UC | ✅ potvrzeno |
| -A5 | `deploy_src` | nasazení oprav po nezávislé revizi diffu (viz níže) | ✅ |

## Opravy po nezávislé revizi diffu (před commitem)

Diff prošel nezávislou revizí; z ní vzešlo šest oprav, které jsou v commitu i v modelu (dávka -A5):

| # | vada | oprava |
|---|---|---|
| V1 | `move_elements` razítkoval `ai.request` i při noopu (`moved: false`) — kód si protiřečil s vlastním slibem „žádný zápis" | razítko jen když se opravdu něco stalo |
| V2 | potomci a vlastněné diagramy se přepisovali **bez** kontroly whitelistu své *vlastní* package | `FB_CheckWrite` i na potomka/diagram; mimo whitelist = warning + přeskočení (kaskádu EA tím zastavit nelze, proto warning, ne ticho) |
| V3 | Risk Gate nezapočítává vlastněný podstrom (přesun 1 UC se 4 BRU = metrika 1) | doplněno mezi **vědomé aproximace metrik** v §6d |
| V4 | potvrzovací dialog říkal u přesunu „Chysta se upravit 1 prvek" — nerozeznatelné od přejmenování, a **jméno zdrojové package v souhrnu vůbec nebylo** | `FB_ConfirmSummary` má headline „Chysta se PRESUNOUT N prvku mezi balicky (…)"; gate do souhrnu přidává i zdrojovou package jménem |
| V5 | nečíselný `attachTo.step` (`"krok 2"`) → `NaN` prošlo validací a větev **zmizela tiše** | `isNaN` guard → warning |
| V6 | strop rekurze podstromu (12 úrovní) končil bez zprávy | warning |

Dokumentační nesrovnalosti ze stejné revize: počet operací s op-level warningy (15 → **14**), stav modelu §12 (101 → **103** operací), `MATICE-PARITY.md` doplněna o obě nové operace, poznámka „Risk Gate ELEVATED" v obou kompilátech pro Copilota doplněna o `requirements` a `move_elements`, sjednocena pole `difficulty`/`stability` mezi zrcadly kompilátu.

Doplněné testy (harness 174 → **181**): izolace efektu **třídy** `move_elements` (dřívější test by prošel i s klasifikací LOW, protože dávka stejně překročí `affectedPackages`), kontrola **ostré** politiky (ne stubu), zdrojová package v souhrnu pro dialog, headline `ConfirmSummary`, noop nic nezapíše, potomek mimo whitelist, nečíselný `attachTo.step`.

## Co se z toho naučilo

1. **`join` = GUID kroku, ne scénáře.** Nález N-1 byl špatná diagnóza postavená na čtení `src/` a na
   zeleném readbacku vlastního zápisu. Zelený readback dokazuje jen to, že se **naše** hodnota uložila —
   ne že jí **EA rozumí**. Důkaz o chování EA smí přijít jen z EA UI nebo z diffu proti stavu, který
   v UI vyrobil člověk. (Propsáno do `PROTOKOL-EAFB.md` §6h jako trvalé pravidlo.)
2. **EA normalizuje `XMLContent` při uložení přes UI**: `join=""` → `join="End"`, atributy `<extension>`
   přerovná na `level, guid, join`, ke krokům doplní `useslist=""`, na konec `<path>` přidá `<context>`
   s cache jmen z `uses`. Executor od v0.12 píše pořadí atributů jako EA; zbytek je kosmetika.
3. **EA kaskáduje `Package_ID` na vlastněné potomky sama.** `children: 0` proto neznamenalo „potomci
   zůstali vzadu", ale „nebylo co dorovnávat" — zrádné číslo, které se rozpadlo na dvě
   (`children` = kolik jich s rodičem šlo, `childrenFixed` = kolik dorovnal bridge).
4. **Živý test operace, která uvádí model do cílového stavu, se dokazuje round-tripem.** Dávka -97
   vrátila korektní `moved: false`, protože stav už byl cílový — a nedokázala nic. Přesun tam a hned
   zpět v jedné dávce dá důkaz obou směrů při nulové čisté změně modelu.
5. **Číslo kroku vs. jméno scénáře v `join`** — obojí projde jako `status: "ok"`; rozdíl nese jen
   warning. Potvrzení pravidla z §3a: u scénářů si po zápisu vždy vyžádej `res-<id>.json`.

## Koncový stav modelu

`UC-95002` (11310) v pkg 1069, `UC-95003` (11311) v pkg 1070; oba mají scénáře s návraty do kroků
a lokální BRU jako **internal requirements** (3 + 4). Původní BRU elementy 11331–11333 / 11342–11345
a jejich 7 `Usage` konektorů (4834–4840) smazány. Dluh POC (UC mimo své packages) tím uklizen.
