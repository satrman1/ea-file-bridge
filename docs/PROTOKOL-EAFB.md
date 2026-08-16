# Protokol eafb/0.2 — EA File Bridge

2026-08-17 · **v0.2** (nahrazuje eafb/0.1 z 2026-08-13) · Ověřeno E2E na eaexample: iterace 1 (dávky 20260816-02…17) + iterace 3 (dávky 20260817-01…23) · Zadání: `IT-ANALYSIS/Zadani-EA-File-Bridge.md` v1.6 (kap. 5a: operace K1–K11 předsunuty do iterace 3; v bance MCP zakázané trvale — bridge = bankovní cesta).

Změny proti 0.1: **registr operací** (zrcadlo MCP toolů — skilly fungují beze změn), **`$N` řetězení GUIDů v dávce**, **whitelist operací `FB_OpsAllowed`** (E_OP_FORBIDDEN), **kvóty klonování** (E_QUOTA), sekvenční zprávy (K1), baselines (K5), linked docs (K10), diagram helpery (K11), bonusy K6–K9, **GUI fallback** (zpracování dávek bez pumpy, klik v EA), **`deploy_src`** (dev nasazení kódu bez klikání), **dvojí runtime + `FB_ComObj`**.

## 1. Architektura

```
AI driver (Copilot/Claude)          pumpa (pump.wsf, WSH)            EA (běžící instance)
  píše requests\req-*.json  ──►  watcher ~1 s, COM attach   ──►  executor = kód operací FB_*
  čte responses\res-*.json  ◄──  zapíše response, archivuje  ◄──  z elementu AICodeBridge (11037)
```

- **Kanon kódu = `src/` v repu**; runtime kopie žije v modelu (element AICodeBridge). Nasazení změn = dávka `deploy_src` (pumpa si kód po dávce sama přenačte). Bootstrap v EA Scripting je jen nouzový fallback.
- **Zápis výhradně Automation API.** `Repository.SQLQuery` jen čtení (vrací i GUIDy).
- Složky vedle `pump.wsf`: `requests\` (vstup), `responses\` (výstup), `requests\processed\` (archiv s timestampem), `requests\rejected\` (nevalidní).
- Životní cyklus souboru: `req-X.json` → zpracování → `res-X.json` + přesun requestu do `processed\` (`rejected\` u E_PARSE). Při zavřeném EA request čeká ve frontě a zpracuje se po re-attachi.

### 1a. Dvojí runtime a `FB_ComObj` (lekce 2026-08-17)

Stejný kód operací běží ve **dvou různých JS runtime**:

| Runtime | Engine | COM objekty | Enumerator |
|---|---|---|---|
| pumpa (pump.wsf, WSH) | JScript | `new ActiveXObject(...)` | ano |
| EA in-model add-in (GUI fallback, prod strana M365-A) | JavaScript (Mozilla) | `new COMObject(...)` | **ne** |

Pravidla:

1. Kód, který může běžet v obou runtime (GUI fallback, linked docs), tvoří COM objekty **výhradně přes `this.FB_ComObj(progId)`** (zkusí ActiveXObject, fallback COMObject). Přímý `new ActiveXObject` v EA runtime hodí ReferenceError a **tiše shodí celý handler** — u uživatele „klik nic neudělal".
2. `Enumerator` v EA runtime neexistuje — výpis složky řeší `FB_ProcessFolder` fallbackem přes skrytý `dir /b` (WScript.Shell.Run, okno 0, wait).
3. **Aktivace nového kódu v EA runtime = plný restart EA.** `File → Reload Current Project` na EA 17.1.5 (build 1715) NEobnovil ani strukturu menu, ani těla operací add-inu (ověřeno 2026-08-16/17; dřívější lekce „reload stačí" z 2026-07-19 pro tento účel neplatí). Pumpa restart EA přežije (re-attach); `deploy_src` se týká jen runtime pumpy.

## 2. Request (1 soubor = 1 dávka)

```json
{
  "protocol": "eafb/0.2",
  "id": "20260817-01",
  "repo": "EAExample.qea",
  "ops": [
    { "op": "ping", "echo": "text" },
    { "op": "create_or_update_package", "parent": "{GUID}", "name": "Pkg" },
    { "op": "create_or_update_elements", "elements": [ { "package": "$1", "name": "X", "type": "Class" } ] }
  ]
}
```

- `repo` — deklarace cílového repozitáře (case-insensitive podřetězec identity dle `FB_RepoId`: u MS SQL název DB přes `DB_NAME()`, u lokálního `.qea` fallback ConnectionString). Volitelné v protokolu, **povinné v copilot-instructions**. Při neshodě se neprovede NIC (ani audit) → `E_REPO`.
- Sémantika dávky: **stop-on-error** — první chyba zastaví zbytek (`skipped`).
- `notes` plain text (JSON escapování zvládá diakritiku i tab); `notes_b64`/`sql_b64` = záloha.

### 2a. `$N` řetězení GUIDů v dávce

Kterákoli string hodnota v opu může odkázat na výsledek dřívějšího opu téže dávky:

| Zápis | Význam |
|---|---|
| `"$0"` | `results[0].guid` |
| `"$0.id"` | `results[0].id` |
| `"$1[2]"` | `results[1].items[2].guid` |
| `"$1[2].id"` | `results[1].items[2].id` |

Reference se rozresolvují rekurzivně v celém objektu opu (i uvnitř polí `targets`, `elements`, `taggedValues.ids`…). Nerozresolvovatelná reference = chyba opu. Do SQL řetězců `$N` NElze vkládat (nahrazuje se jen celá hodnota pole).

## 3. Response

```json
{
  "protocol": "eafb/0.2", "id": "...", "status": "done | error",
  "repository": "identita dle FB_RepoId", "connection": "cesta připojení (informativní)",
  "results": [ { "op": "...", "status": "ok | error | skipped", "...": "..." } ],
  "audit": { "aiLogGuid": "{...}" }
}
```

Zápisové výsledky nesou `guid` + `id` (a `items[]` s `{guid, id, name, created}` u dávkových operací) — kvůli `$N` referencím.

## 4. Registr operací (32; zrcadlo MCP toolů)

Legenda: Z = zápisová (podléhá whitelistu operací `FB_OpsAllowed` i whitelistu packages), Č = čtecí (povolena vždy). Stav ✅ = E2E ověřeno (iterace 1 = dávky 20260816-*, iterace 3 = 20260817-*).

| op | Z/Č | Klíčové argumenty | Response (nad rámec status) | Stav |
|---|---|---|---|---|
| `ping` | Č | `echo` | `echo, eaVersion, repository, connection, time` | ✅ |
| `query` | Č | `sql` (jen SELECT/WITH; dialekt dle repa) | `rowCount, rows[]` (vrací i GUIDy) | ✅ |
| `find_elements_by_name` | Č | `name` | `items[{guid,id,name,type}]` | ✅ |
| `find_packages_by_name` | Č | `name` | `items[{guid,id,name}]` | ✅ |
| `get_elements_information` | Č | `elements[]` (guid\|id\|jméno\|$ref), `brief` | plný dump vč. atributů, operací, TV (RefGUID rozpřaženě), konektorů, owned diagramů | ✅ |
| `get_packages_information` | Č | `packages[]` | dump package | ✅ |
| `get_connectors_information` | Č | `connectors[]` \| `element` | dump konektorů | ✅ |
| `get_diagrams_information` | Č | `diagrams[]` | dump diagramu vč. bloku `messages` (seqNo, operace rozpřaženě) | ✅ |
| `get_baselines` | Č | `package` | `items[{guid,version,notes,date}], raw` | ✅ |
| `baseline_diff` | Č | `package`, `baseline` (GUID) | `summary` (počty per status), `raw` (XML comparelog) | ✅ 20260817-02 |
| `export_element_linked_documents` | Č | `elements[]`, `inline` | `items[{hasDocument,file,size,rtf_b64?}]`; soubory jen do `<baseDir>\responses\docs\` | ✅ 20260817-08 |
| `create_element` | Z | legacy POC alias (nahrazeno `create_or_update_elements`) | `guid, elementId` | ✅ |
| `create_or_update_elements` | Z | `elements[{guid\|elementID→update; package\|owningElement+type→create; name, stereotypes, notes, alias, status, author/version (K6), type na update = změna typu (K7), isComposite+compositeDiagram (K8), classifier, taggedValues}]` | `items[{guid,id,name,created}]` | ✅ K7/K8: 20260817-13 |
| `create_or_update_package` | Z | `parent`, `name`, `notes`, `taggedValues` | `items[{guid,id,name,created}]` | ✅ |
| `create_or_update_connectors` | Z | `connectors[{source,target,type,stereotypes,direction,taggedValues(RefGUID ids)}]` | `items[]` | ✅ |
| `create_or_update_attributes` | Z | `element`, `attributes[{name,type,classifier,…}]` (parciální update) | `items[{guid,id,name,created}]` | ✅ |
| `create_or_update_operations` | Z | `element`, `operations[{name,returnType,parameters[]…}]` (parameters = deterministický rebuild) | `items[]` vč. GUIDů parametrů | ✅ |
| `create_or_update_messages` | Z | `diagram`, `messages[{source,target,name\|operation,isReturn,isAsynchronous,arguments,returnValue,seqNo}]` | `items[]` + `pdata` readback | ✅ (K1, viz §5) |
| `delete_from_model` | Z | `targets[{type: Package\|Diagram\|Element\|Connector\|Attribute\|Operation\|Parameter, id\|guid, name (Parameter)}]` | `items[{type,id,deleted}]` | ✅ všech 7 typů (20260817-04, -07; Connector 20260816-12/14) |
| `delete_taggedvalue_from_model` | Z | `targets[{type: Element/Connector/Attribute/Operation/PackageTaggedValue, id\|guid, name}]` | `items[]` | ✅ Element+Connector TV (20260817-03, UNDO drill T1) |
| `remove_elements_from_diagram` | Z | `diagram`, `elementIDs[]` — jen z diagramu, model nedotčen (§11) | `removedElementIDs` | ✅ 20260817-03 |
| `create_baseline` | Z | `package`, `name` (default `AI-pre-<session>-<batch>`), `session`, `notes` — **pojmenovaná** (MCP jméno neuměl) | `name, baselineGuid, guid` | ✅ 20260817-02 |
| `clone_package` | Z | `package`, `name`, `confirm` — kvóta V3 §12e | `guid, id, volume{elements,packages}` | ✅ 20260817-05 |
| `clone_elements` | Z | `elements[]`, `package` (cíl), `confirm` | `items[{…,sourceID,ownedDiagrams}]`, `volume` | ✅ 20260817-05/-07; kvóta -14 |
| `import_element_linked_documents` | Z | `documents[{element, rtf_b64 \| file (jen uvnitř baseDir)}]` | `items[{imported}]` | ✅ 20260817-08 |
| `layout_connectors` | Z | `diagram`, `style` (direct/auto/custom/treeV/treeH/lateralV/lateralH/orthS/orthR), `connectorIDs` filtr | `changed` | ✅ 20260817-12 (viz §6) |
| `change_connector_visibility` | Z | `diagram`, `connectorIDs[]`, `hidden` | `connectorIDs` (změněné) | ✅ 20260817-09 |
| `open_diagrams` | Č | `diagrams[]` | `opened[]` | ✅ 20260817-09 |
| `reload_diagrams` | Č | `diagrams[]` | `reloaded[]` | ✅ 20260816-14 |
| `update_diagram_properties` | Z | `diagrams[{diagram, name, author, version, showDetails, styleEx}]` (K6, konvence §7e) | `items[]` | ✅ 20260817-13 |
| `set_diagram_object_style` | Z | `diagram`, `objects[{elementID, backgroundColor{red,green,blue}, fontColor, borderColor, borderWidth, reset}]` (K9) | `changedElementIDs` | ✅ 20260817-13 |
| `deploy_src` | Z | `only[]` — nalije kód ze `src/` do modelu, založí i NOVOU operaci (signatura z hlavičky `// AICodeBridge.Nazev(args)`); pumpa si kód po dávce sama přenačte | `updated[], created[], skipped[]` | ✅ (VÝHRADNĚ dev; v bance deny) |

Trvale vyloučeno (neimplementuje se): `apply_baseline` (§12a — obnova z baseline jen člověk v EA UI), `find_element_in_diagrams` (kryje `query` nad `t_diagramobjects`), interaktivní `select_*`/`get_current_*` (pro dávkový kanál bezpředmětné). Iterace 2: `create_or_update_diagram`, `place_elements_on_diagram`, `get_diagram_image` (Diagram Builder + PNG export).

## 5. Sekvenční zprávy (K1) — mechanika v `t_connector`

Reverse-engineering proti MCP referenci (zprávy 4799–4801 vs. bridge 4809–4812, diagram 1131):

| Pole `t_connector` | Automation | Význam |
|---|---|---|
| `PDATA1` | `TransitionEvent` | `Synchronous` / `Asynchronous` |
| `PDATA2` | `TransitionGuard` | `paramsDlgs=;params=<argumenty>;retval=<návratový typ>` |
| `PDATA3` | `TransitionAction` | `Call` |
| `SeqNo`, `DiagramID` | zapisovatelné | pořadí zprávy, domovský diagram |

Návratová zpráva: MCP kóduje `PDATA4=1`, bridge používá `SubType="Return"` — **obojí EA kreslí čárkovaně**, čtecí strana bridge (`get_diagrams_information`) rozumí oběma. Vazba na operaci = tag `operation_guid` na konektoru. Deterministický rebuild V2d: delete zpráv + recreate v jedné dávce (`delete_from_model` Connector + `create_or_update_messages` s explicitními `seqNo`).

## 6. Poznámky z E2E iterace 3

- **`layout_connectors`**: EA `LinkLineStyle` má jen hodnoty 1–9 (orthS=8, orthR=9). Původní mapa 10/11 tiše degradovala orthogonální styly na „custom" (`Mode=3;` bez `TREE=`). Opraveno 20260817-11/-12; readback v `t_diagramlinks.Style`: `Mode=3;TREE=OS;` / `TREE=OR;` / `TREE=LH;` atd.
- **`clone_elements` a owned diagramy**: `Element.Clone()` owned diagramy NEPŘENÁŠÍ (ověřeno 20260817-07: zdroj s 1 owned diagramem → klon `ownedDiagrams: 0`). Limit MCP éry platí i pro Automation; bridge ho aspoň **vykazuje** v response (`ownedDiagrams`), driver musí případné diagramy řešit zvlášť (iterace 2 Diagram Builder). `clone_package` diagramy v podstromu klonuje.
- **`create_baseline`**: pojmenovaná baseline je dohledatelná v `get_baselines` (`version` = jméno) — konkrétní výhoda proti MCP (bezejmenné baseline).
- **Linked docs round-trip**: EA při importu RTF normalizuje (obohatí hlavičky) — porovnávat obsah/markery, ne byte-shodu.
- **K8 isComposite**: zapisuje `t_object.NType=8`; `compositeDiagram` přes `SetCompositeDiagram`.
- **K9 reset**: zapíše explicitní `BCol=-1;BFol=-1;LCol=-1;LWth=1;` (= default vzhled).

## 7. Chybové kódy

| Kód | Úroveň | Význam |
|---|---|---|
| `E_PARSE` | dávka | nevalidní JSON / chybí `ops` → soubor do `rejected\`, bez auditu |
| `E_REPO` | dávka | deklarace `repo` nesedí na připojený repozitář; nic se neprovede (ani audit) |
| `E_OP_FORBIDDEN` | op | **nové v 0.2**: zápisová operace není povolena whitelistem operací `FB_OpsAllowed` |
| `E_QUOTA` | op | **nové v 0.2**: objem klonování nad soft kvótou (100, §12e) bez `confirm: true`; nic se neprovedlo |
| `E_UNKNOWN_OP` | op | neznámá operace |
| `E_ARGS` | op | chybí povinné argumenty |
| `E_SQL_READONLY` | op | jiný dotaz než SELECT/WITH |
| `E_WHITELIST` | op | package mimo whitelist (v rámci správného repozitáře) |
| `E_NOT_FOUND` | op | cíl nenalezen |
| `E_EXCEPTION` | op/dávka | neočekávaná výjimka |
| `E_NO_EXECUTOR` | dávka | v modelu chybí FB_Main |

## 8. Bezpečnostní výbava (povinná, ne volitelná)

1. **Whitelist packages = celá větev** (`FB_Whitelist`): `{repo, pkg:"{GUID}"}` — zápis projde jen při shodě repozitáře (dle `FB_RepoId`) a package uvnitř whitelistované větve.
2. **Whitelist OPERACÍ `FB_OpsAllowed`** (nové v 0.2, K4 — náhrada MCP `-enableDelete`/`-enableEdit`): per repo `{repo, allow[], deny[]}`; deny má přednost, `"*"` v allow = vše; čtecí operace povoleny vždy; **repo bez položky = žádný zápis (fail-secure)**. Změna = změna kódu v modelu = baselinovaná událost.
   **Doporučená bankovní konfigurace (P1, §12a+§12g):**
   ```
   { repo: "<TEST-DB>", allow: ["*"],
     deny: ["delete_from_model", "delete_taggedvalue_from_model",
            "remove_elements_from_diagram", "clone_package", "clone_elements",
            "deploy_src"] }
   ```
   (delete/clone se zapínají až v P2+ po zácviku; `deploy_src` je VÝHRADNĚ dev operace — v bance deny trvale.)
3. **Deklarace `repo` v dávce** — kryje směr „dávka pro TEST zpracovaná v PROD".
4. **Auto-baseline** whitelistovaných packages při startu session pumpy + explicitní pojmenované mikro-baseline `create_baseline` před zápisem (§12c).
5. **Audit**: každá dávka = Artifact `FB <id>` v `#AI-LOG` (tagy `ai.channel=eafb`, `ai.request`; Notes = souhrn + celý request); každý zapsaný element nese `ai.channel`/`ai.request`.
6. **Kvóty klonování V3** (§12e): objem se vykazuje vždy (`volume`), nad soft 100 nutné `confirm: true` (= potvrzení uživatele v session), jinak `E_QUOTA`.

## 9. GUI fallback (bez pumpy) — ověřeno 20260817-23

Menu v EA: **Specialize → AI Bridge → Process requests (File Bridge)** (operace `FB_ProcessFolder`, běží UVNITŘ EA.exe = základ prod strany M365-A). Zpracuje všechny `requests\*.json` stejným životním cyklem jako pumpa (response, `processed\`/`rejected\`, audit, Log). Složky určuje `FB_Config` (baseDir per repo). Výsledek ukáže dialog; chyby se zobrazují (`CHYBA GUI fallbacku: …`), tiché selhání je nepřípustné.

Provozní poznámky: pumpa nesmí běžet zároveň (sebrala by requesty první); po nasazení nové verze kódu vyžaduje EA runtime **plný restart EA** (§1a).

## 10. SQL dialekty

`query` běží v dialektu připojeného repozitáře: lokální `.qea` = SQLite, bankovní repozitář = MS SQL 2022. Executor SQL jen provádí — dialekt hlídá autor dotazu (skilly / copilot-instructions / ea-sql-expert).

## 11. Provoz

- Start: dvojklik `pump.wsf`. Konzole hlásí verzi (`pumpa v0.4`), repozitář, počet operací (Code loader) a session baseline — **zkontrolovat pohledem**.
- Změna kódu: upravit `src/` → dávka `{"op":"deploy_src","only":["FB_Nazev"]}` (pumpa se sama přenačte). Bootstrap v EA Scripting jen když pumpa vůbec neběží se starým kódem.
- Kód pro EA runtime (menu, GUI fallback): po `deploy_src` navíc **restart EA** (§1a).
- Po každé změně: sync `src/` = commit v repu (dělá Miloš, VS Code GUI).

## 12. Stav modelu (eaexample, po iteraci 3)

AICodeBridge el. 11037 (pkg 1052), 62 operací (33× `FB_Op*`/`FB_*` + AI Code Bridge legacy + `FB_ComObj` od 20260817-22). Packages: `#FB-TEST` 1054 `{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}` (whitelist), `#AI-LOG` 1055 (audit). Testovací artefakty `FBT-*` viz `docs/HANDOFF-2026-08-16.md` + klony z iterace 3 (pkg `FBT-IT1-CLONE` 1058, elementy 11093/11096, diagram `FBT OwnedDiag` 1133) — úklid rozhoduje Miloš.
