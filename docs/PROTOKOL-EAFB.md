# Protokol eafb/0.2 — EA File Bridge

2026-08-19 · **v0.6** (dokumentační verze; protokol na drátě zůstává `eafb/0.2`) · Ověřeno E2E na eaexample: iterace 1 (dávky 20260816-02…17) + iterace 3 (dávky 20260817-01…23) + iterace 2 Diagram Builder (dávky 20260818-01…11) + iterace 2b Scenarios/Classifier/Scaffold (dávky 20260818-14…37) + dostavba idempotence dle auditu B2 (dávky 20260818-40…55) + **constraints (dávky 20260819-01…04)** · Zadání: `IT-ANALYSIS/Zadani-EA-File-Bridge.md` v1.6 (kap. 5a: operace K1–K11 předsunuty do iterace 3; v bance MCP zakázané trvale — bridge = bankovní cesta).

Změny v0.6 proti v0.5: **`create_or_update_constraints`** — internal constraints elementu (záložka Constraints, `t_objectconstraint`) = metodický nosič PRE/PST/ASU na Use Case dle revize U2 2026-08-17 (scénáře → Scenarios tab, PRE/PST/ASU → Constraints tab; `scenario-rules.md` „Fyzické umístění v EA"). Deterministický rebuild V2d po vzoru scenarios, `removed` v response. Registr 38 → **39 operací**. Viz §6c.

Změny v0.5 proti v0.4: **dostavba idempotenčních mechanismů dle auditu B2** (`docs/AUDIT-B2-IDEMPOTENCE-2026-08.md` §5, rozhodnutí 2026-08-18 — před stavbou vrátného). Vše **opt-in, výchozí chování dávek se NEMĚNÍ**: `matchByName` (elements, packages — K1, find_or_create dle jména/aliasu scoped na cílový package/parent), `match: "composite"` (connectors — K2, kompozitní lookup Start/End/Type/Stereotype), `dedupKey` + TV `ai.dedup` + sdílený helper `FB_DedupFind` (elements, connectors — K4, klíč přežívá přejmenování; pořadí lookupu guid → dedupKey → kompozit/jméno), `rebuild: true` (messages — K3, server-side deterministický rebuild V2d po vzoru scenarios, `removed` v response). Nový chybový kód `E_AMBIGUOUS` (výčet kandidátů v `guids`). Nová sekce **§5a Retry sémantika**. Registr zůstává 38 operací (jen nová pole).

Změny v0.4 proti v0.3: **iterace 2b** — `create_or_update_scenarios` (strukturované UC scénáře do Scenarios tab — revize U2, rozhodnutí 2026-08-17), `apply_classifier_stereotypes` (port ITAN-Apply Classifier Stereotypes on SD.vbs), `find_or_create_referencing_sr` (port ITAN scaffoldu, SR větev) + konfigurační sekce **`FB_ScaffoldConfig`** (šablonové GUIDy per repo). Registr 35 → **38 operací**. Viz §6b.

Změny v0.3 proti v0.2: **Diagram Builder (iterace 2)** — `create_or_update_diagram` (vč. MDG typů a diagramů pod elementem), `place_elements_on_diagram` (geometrie + auto-pozice + výkaz konektorů), `get_diagram_image` (**PNG do souboru** — výhoda proti MCP, který uměl jen inline). Registr 32 → 35 operací. Viz §6a.

Změny 0.2 proti 0.1: **registr operací** (zrcadlo MCP toolů — skilly fungují beze změn), **`$N` řetězení GUIDů v dávce**, **whitelist operací `FB_OpsAllowed`** (E_OP_FORBIDDEN), **kvóty klonování** (E_QUOTA), sekvenční zprávy (K1), baselines (K5), linked docs (K10), diagram helpery (K11), bonusy K6–K9, **GUI fallback** (zpracování dávek bez pumpy, klik v EA), **`deploy_src`** (dev nasazení kódu bez klikání), **dvojí runtime + `FB_ComObj`**.

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

## 4. Registr operací (39; zrcadlo MCP toolů)

Legenda: Z = zápisová (podléhá whitelistu operací `FB_OpsAllowed` i whitelistu packages), Č = čtecí (povolena vždy). Stav ✅ = E2E ověřeno (iterace 1 = dávky 20260816-*, iterace 3 = 20260817-*, iterace 2 = 20260818-*).

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
| `create_or_update_elements` | Z | `elements[{guid\|elementID→update; package\|owningElement+type→create; name, stereotypes, notes, alias, status, author/version (K6), type na update = změna typu (K7), isComposite+compositeDiagram (K8), classifier, taggedValues, **matchByName (opt-in B2/K1: find dle jména/aliasu scoped na package/parent → UPDATE), dedupKey (opt-in B2/K4: TV `ai.dedup`, přežívá přejmenování)**}]` | `items[{guid,id,name,created,matchedBy?}]` | ✅ K7/K8: 20260817-13; B2: 20260818-45…49 |
| `create_or_update_package` | Z | `parent`, `name`, `notes`, `taggedValues`, **`matchByName` (opt-in B2/K1: find dle jména scoped na parent → UPDATE)** | `items[{guid,id,name,created,matchedBy?}]` | ✅ B2: 20260818-45/-46 |
| `create_or_update_connectors` | Z | `connectors[{source,target,type,stereotypes,direction,taggedValues(RefGUID ids), **match: "composite" (opt-in B2/K2: lookup dle Start/End/Type/Stereotype → UPDATE; >1 bez dedupKey = E_AMBIGUOUS), dedupKey (opt-in B2/K4: TV `ai.dedup`)**}]` | `items[{…,created,matchedBy?}]` | ✅ B2: 20260818-43/-44 |
| `create_or_update_attributes` | Z | `element`, `attributes[{name,type,classifier,…}]` (parciální update) | `items[{guid,id,name,created}]` | ✅ |
| `create_or_update_operations` | Z | `element`, `operations[{name,returnType,parameters[]…}]` (parameters = deterministický rebuild) | `items[]` vč. GUIDů parametrů | ✅ |
| `create_or_update_messages` | Z | `diagram`, `messages[{source,target,name\|operation,isReturn,isAsynchronous,arguments,returnValue,seqNo}]`, **`rebuild: true` (opt-in B2/K3: server-side V2d — smaže Sequence konektory diagramu a postaví znovu; vyžaduje `diagram` + explicitní `seqNo` u všech zpráv, zprávy bez guid/connectorID)** | `items[]` + `pdata` readback, **`removed` (rebuild)** | ✅ (K1, viz §5); rebuild B2: 20260818-51…54 |
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
| `create_or_update_diagram` | Z | `diagrams[{diagram→update; package\|owningElement+type→create (type vč. MDG "Tech::Typ"); name, notes, author, version, showDetails, styleEx}]` — na create vždy Author+Version dle §7e | `items[{guid,id,name,type,created}]` | ✅ 20260818-05 |
| `place_elements_on_diagram` | Z | `diagram`, `elementPlacements[{elementID\|element, x, y, width, height, style}]` — bez souřadnic auto-mřížka | `items[{elementID,guid,x,y,width,height}]`, `connectorsOnDiagram[]` | ✅ 20260818-05/-07 |
| `get_diagram_image` | Č | `diagrams[]` \| `diagram`, `inline` | `items[{file,size,png_b64?}]`; PNG jen do `<baseDir>\responses\images\` | ✅ 20260818-08/-10 |
| `update_diagram_properties` | Z | `diagrams[{diagram, name, author, version, showDetails, styleEx}]` (K6, konvence §7e) | `items[]` | ✅ 20260817-13 |
| `set_diagram_object_style` | Z | `diagram`, `objects[{elementID, backgroundColor{red,green,blue}, fontColor, borderColor, borderWidth, reset}]` (K9) | `changedElementIDs` | ✅ 20260817-13 |
| `create_or_update_scenarios` | Z | `element`, `scenarios[{name, type: Basic Path\|Alternate\|Exception, notes, steps[{text, kind: actor\|system, uses, results, state}], attachTo{scenario, step}, join}]` — deterministický rebuild (V2d); mechanika §6b | `items[{guid,name,type,steps}], removed, readback` | ✅ 20260818-28 (UI potvrzeno) |
| `create_or_update_constraints` | Z | `element`, `constraints[{name, type: Pre-condition\|Post-condition\|Invariant (tolerantně i metodické „Assumption [Invariant]" ap. — base typ ze závorky), notes, status?}]` — deterministický rebuild (V2d); mechanika §6c | `items[{name,type,created}], removed, readback{api,tableRowCount}` | ✅ 20260819-02…04 |
| `apply_classifier_stereotypes` | Z | `diagram`, `elementIDs[]` filtr — objektům s classifierem dorovná Type+stereotyp dle classifiera (Component→Component, Interface/Class→Object); idempotentní | `items[{elementID,oldType,newType,oldStereotype,stereotype,changed}], changedCount` | ✅ 20260818-31 (2. běh 0 změn) |
| `find_or_create_referencing_sr` | Z | `operation`, `packageName`, `targetPackage` (default `unsortedPkg` z `FB_ScaffoldConfig`), `author` — katalog-first: najde SR přes TV `505-1 Operation Link`, jinak založí service pkg + version/SR/ImpactView/DTO diagramy + SR/DTO/Req/Res + vazby + place | `found` + `items[]` NEBO `created{...}, counts, tag505` | ✅ 20260818-35/-36 |
| `deploy_src` | Z | `only[]` — nalije kód ze `src/` do modelu, založí i NOVOU operaci (signatura z hlavičky `// AICodeBridge.Nazev(args)`); pumpa si kód po dávce sama přenačte | `updated[], created[], skipped[]` | ✅ (VÝHRADNĚ dev; v bance deny) |

Trvale vyloučeno (neimplementuje se): `apply_baseline` (§12a — obnova z baseline jen člověk v EA UI), `find_element_in_diagrams` (kryje `query` nad `t_diagramobjects`), interaktivní `select_*`/`get_current_*` (pro dávkový kanál bezpředmětné). M365 části iterace 2 (Downloads watcher, OneDrive/SharePoint, prod add-in) čekají na POC fázi 3.

## 5. Sekvenční zprávy (K1) — mechanika v `t_connector`

Reverse-engineering proti MCP referenci (zprávy 4799–4801 vs. bridge 4809–4812, diagram 1131):

| Pole `t_connector` | Automation | Význam |
|---|---|---|
| `PDATA1` | `TransitionEvent` | `Synchronous` / `Asynchronous` |
| `PDATA2` | `TransitionGuard` | `paramsDlgs=;params=<argumenty>;retval=<návratový typ>` |
| `PDATA3` | `TransitionAction` | `Call` |
| `SeqNo`, `DiagramID` | zapisovatelné | pořadí zprávy, domovský diagram |

Návratová zpráva: MCP kóduje `PDATA4=1`, bridge používá `SubType="Return"` — **obojí EA kreslí čárkovaně**, čtecí strana bridge (`get_diagrams_information`) rozumí oběma. Vazba na operaci = tag `operation_guid` na konektoru. Deterministický rebuild V2d: klientsky delete zpráv + recreate v jedné dávce, **nebo od v0.5 server-side `rebuild: true`** (preferováno — atomický smaž-a-postav uvnitř jedné operace, viz §5a).

## 5a. Retry sémantika a idempotence (dostavba auditu B2, 2026-08-18)

Referenční audit: `docs/AUDIT-B2-IDEMPOTENCE-2026-08.md` (verdikty K1–K4). Pravidla pro klienty (vrátný, copilot-instructions, skilly):

1. **Rollback neexistuje.** Dávka je stop-on-error; chybová response nese v `items` GUIDy položek **dosud vytvořených** uvnitř chybující operace — ty v modelu zůstávají. Operace za chybou jsou `skipped` (neproběhly vůbec).
2. **Korektní retry bez opt-in polí = opravná dávka adresující GUIDy z chybové response** (guid → UPDATE cesta), **nikdy slepé přeposlání celé dávky** — každé přeposlání create položek bez guid vytvoří duplicity. Toto pravidlo platí bezpodmínečně, dokud klient nepoužívá `matchByName`/`match`/`dedupKey`.
3. **Opt-in idempotence (v0.5)** — s těmito poli je přeposlání téže dávky bezpečné (druhý běh = UPDATE, `created: false` + `matchedBy` v items):
   - `matchByName: true` (elements, packages — K1): find dle jména/aliasu **scoped na cílový package (`Package_ID` + `ParentID = 0`) / parent element (`ParentID`) / parent package (`t_package.Parent_ID`)**. Globální resolver `FB_ResolveEl` se pro tohle nepoužívá.
   - `match: "composite"` (connectors — K2): lookup dle (`Start_Object_ID`, `End_Object_ID`, `Connector_Type`, `Stereotype`); právě 1 nález = UPDATE.
   - `dedupKey` (elements, connectors — K4): stabilní klientský klíč; na create se zapíše jako TV `ai.dedup` (sdílený helper `FB_DedupFind`, SQL `t_objectproperties`/`t_connectortag`, bez dialektových funkcí). **Přežívá přejmenování.** Pořadí lookupu: guid → dedupKey → kompozit/jméno.
   - `rebuild: true` (messages — K3): server-side V2d — smaže **všechny** Sequence konektory diagramu (whitelist kontrola drží, pre-check před prvním mazáním = žádné parciální mazání) a postaví znovu z dávky; vyžaduje `diagram` + explicitní `seqNo` u každé zprávy; response nese `removed`. Vzor `create_or_update_scenarios`.
4. **`E_AMBIGUOUS`**: match/dedupKey lookup našel >1 kandidáta — response nese `guids` (výčet). Řešení: adresovat konkrétní `guid`, nebo u konektorů poslat `dedupKey` (create pak založí nový, jednoznačně klíčovaný).
5. **Vazba na modal hang** (T4-3): po zotavení z visící pumpy odklikem hrozí falešné OK `rowCount: 0` — právě tam vzniknou duplicity nepozorovaně. Retry po každém zotavení proto **výhradně** s `match`/`dedupKey`, nebo přes kontrolní čtení + opravnou dávku dle bodu 2.
6. Výchozí chování beze změny: create bez opt-in polí je vždy `AddNew` — dávky, které duplicitní jména legitimně chtějí (nepojmenované lifeliny, opakovaná jména v různých kontextech), fungují jako dřív.

## 6. Poznámky z E2E iterace 3

- **`layout_connectors`**: EA `LinkLineStyle` má jen hodnoty 1–9 (orthS=8, orthR=9). Původní mapa 10/11 tiše degradovala orthogonální styly na „custom" (`Mode=3;` bez `TREE=`). Opraveno 20260817-11/-12; readback v `t_diagramlinks.Style`: `Mode=3;TREE=OS;` / `TREE=OR;` / `TREE=LH;` atd.
- **`clone_elements` a owned diagramy**: `Element.Clone()` owned diagramy NEPŘENÁŠÍ (ověřeno 20260817-07: zdroj s 1 owned diagramem → klon `ownedDiagrams: 0`). Limit MCP éry platí i pro Automation; bridge ho aspoň **vykazuje** v response (`ownedDiagrams`), driver musí případné diagramy řešit zvlášť (iterace 2 Diagram Builder). `clone_package` diagramy v podstromu klonuje.
- **`create_baseline`**: pojmenovaná baseline je dohledatelná v `get_baselines` (`version` = jméno) — konkrétní výhoda proti MCP (bezejmenné baseline).
- **Linked docs round-trip**: EA při importu RTF normalizuje (obohatí hlavičky) — porovnávat obsah/markery, ne byte-shodu.
- **K8 isComposite**: zapisuje `t_object.NType=8`; `compositeDiagram` přes `SetCompositeDiagram`.
- **K9 reset**: zapíše explicitní `BCol=-1;BFol=-1;LCol=-1;LWth=1;` (= default vzhled).

## 6a. Diagram Builder a PNG export (iterace 2, dávky 20260818-01…11)

- **`create_or_update_diagram`**: create v package (`package`) NEBO pod elementem (`owningElement` — auto-kompozity, linked diagramy §7e). **MDG typ** se zadává kvalifikovaně (`"UML Behavioral::Sequence"`, `"CSOB-ITAN::FA-Behavioral"`): EA zapíše základní `Diagram_Type` a MDG vazbu drží `StyleEx` `MDGDgm=<typ>;` (mechanika ověřena RE proti MCP referenci, dávky 20260818-02/-03; executor MDGDgm doplní, kdyby ho AddNew nezapsal). Na create se **vždy** nastaví `Author` (default `Claude via eafb`) a `Version` (default `1.0`) — §7e: diagramy založené přes API jinak autora nemají. Update = cíl přes `diagram` ("{GUID}" | id), mění jméno/notes/author/version/showDetails/styleEx.
- **`place_elements_on_diagram`**: geometrie v `t_diagramobjects`: `RectLeft=x`, `RectTop=−y`, `RectRight=x+width`, `RectBottom=−(y+height)` (souřadnice od levého horního rohu, shodné s MCP). Bez `x`/`y` auto-mřížka 4 sloupce (krok 220×140), default velikost 160×80. **Konektory mezi umístěnými elementy EA vykreslí sám**, jakmile jsou oba konce na diagramu — response je vykazuje v `connectorsOnDiagram` (čte se `t_connector`; ⚠ `t_diagramlinks` se plní až při otevření/kreslení diagramu v EA, u čerstvého diagramu je prázdná — ověřeno 20260818-05/-07).
- **`get_diagram_image`**: `Project.PutDiagramImageToFile` → PNG **výhradně do `<baseDir>\responses\images\`** (jméno se sanitizuje, vzor linked docs). `inline: true` přidá `png_b64` (base64 přes ADODB.Stream+MSXML, obojí `FB_ComObj` — dual runtime §1a). Klíčová výhoda proti MCP: ten uměl obrázek jen inline v odpovědi (bolest EDU pipeline).
- ⚠ **Lekce — pořadí v dávce**: (1) `deploy_src` přenačítá kód pumpy až **po doběhnutí dávky** — operace za ním v téže dávce běží starým kódem; nový kód používej až od následující dávky (pozorováno 20260818-06). (2) PNG exportovaný v téže dávce hned po zápisu zpráv nezachytí čerstvé změny — před `get_diagram_image` zařaď `reload_diagrams`, ideálně v samostatné dávce (20260818-09/-10).
- Sekvenční řetěz Diagram Builder + K1 ověřen: nový MDG Sequence diagram + place lifelin + `create_or_update_messages` v jedné dávce přes `$N` (20260818-09) — dosud šly zprávy jen na předpřipravený diagram.

## 6b. Iterace 2b — Scenarios, Classifier Stereotypes, SR Scaffold (dávky 20260818-14…37)

- **`create_or_update_scenarios`** — strukturované scénáře do Scenarios tab (revize U2; metodické propsání do §7e/skillů řeší navazující vlákno). Úložiště: `t_objectscenarios`, kroky = XML v `XMLContent` (`<path><step name guid level uses result state trigger link/></path>`; `trigger` 1=Actor, 0=System; větev = child kroku `<extension guid="{ScenarioGUID větve}" join="{GUID pokračování|''}" level="Na"/>`). **⚠ Zásadní lekce (spike -18/-20/-24/-26): JAKÝKOLI Step API zápis mimo prostý `Steps.AddNew(text, 0)`** — AddNew s typem Actor, vlastnost `StepType`, `Extensions.AddNew`, i pozdější `Step.Update()` — **krok přemístí (reinsert) a pořadí scénáře se rozpadne.** Executor proto jede ve 3 průchodech: (1) scénáře + kroky všechny jako System, (2) jen sběr větví, (3) trigger atributy + `<extension>` elementy přepisem `XMLContent` + `Update()` jako poslední zápis (EA `XMLContent` persistuje 1:1, dávka -24). Update scénářů = deterministický rebuild V2d (smaž vše + zapiš znovu, `removed` v response). E2E: dávka -28, Scenarios tab vizuálně potvrzen (pořadí, actor glyfy, větve A1/E1 na krocích 2/4).
- **`apply_classifier_stereotypes`** — port `Scripts/ITAN-Apply Classifier Stereotypes on SD.vbs`: objektům na diagramu s `ClassifierID` dorovná Type + stereotyp dle classifiera (Component → Component; Interface/Class → Object; jiné typy se nechávají — parita s VBS). Idempotentní: shoda = žádný zápis. E2E dávka -31: 1. běh 2× Object→Component + IDS-Manager, 2. běh `changedCount: 0`, `t_object` readback sedí.
- **`find_or_create_referencing_sr`** — port `Scripts/ITAN-Find or Create Referencing Service Realization.vbs` (SR větev; SR×PR fork = pozdější update, viz itan-skripty). Katalog-first (§7e): SQL přes TV `505-1 Operation Link`; nález → `found: true` + items (žádný zápis); jinak scaffold: service package (Notes ze šablony) + version diagram (`CSOB-ITAN::Version Root Diagram`, ShowDetails=1, Version, Author) + SR (`CSOB-ITAN::Service Realization`) + SR diagram (**auto-kompozit MDG se používá, nezakládá se druhý** — §7e/§7g; jen přejmenování) + Impact View (`MDGDgm=CSOB-ITAN::LD-Behavioral;MDGView=CSOB-ITAN::Realization Impact View;`) + TV 505-1 (zápis jménem přes SetTag, ne `GetAt(0)`) + DTO + Req/Res + vazby (DTO —«refine» Dependency→ SR; Req/Res —Composition→ DTO, `SupplierEnd.Aggregation=2`, client Non-Navigable — diamant u DTO, `DestIsAggregate=2` v readbacku) + place na version/DTO diagram. Vědomá oprava proti VBS: DTO diagram přebírá Notes z DTO šablony (VBS ř. 242 omylem kopíroval SR šablonu). **Šablonové GUIDy + cílový `unsortedPkg` = per-repo `FB_ScaffoldConfig`** (vzor FB_Config; doma fixture v `#FB-TEST`, bankovní hodnoty doplní člověk v bance — v repu jen `<EMR-GUID>` placeholdery). Chybějící šablona = warning, scaffold pokračuje bez Notes. E2E: dávka -35 (1 pkg, 4 diagramy, 4 elementy, 3 vazby, tag505 = GUID operace), -36 (2. běh `found: true`, nic nezaloženo).
- ⚠ Lekce §6a/3 potvrzena znovu (dávka -32): neznámý sloupec v SQL na `.qea` (`Method_ID` místo `OperationID` v `t_operation`) = modální dialog EA + pumpa visí do odkliknutí.
- **Vztah k ITAN skriptům (údržba):** VBS ve Scripts/ (EA Scripting nabídka) = **norma a nástroj pro ruční použití ITANy**, operace bridge = **port pro AI kanál** — vědomě dvě implementace (EA nemá headless spouštění Scripting skriptů; skripty jsou interaktivní — InputBox/MsgBox/tree selection; „spusť skript z modelu" = zamítnutý dynamický loader). **Pravidlo: při změně VBS se aktualizuje operace, nikdy obráceně.** Známý čekající update: SR×PR fork z bankovní verze skriptu.

## 6c. Constraints (v0.6, dávky 20260819-01…04)

- **`create_or_update_constraints`** — internal constraints elementu do záložky Constraints (`t_objectconstraint`; constraint **nemá GUID** — identita = Object_ID + jméno). Metodický nosič PRE/PST/ASU na UC (U2 rev. 2026-08-17): metodická jména `PREXXXXX-Y` / `PSTXXXXX-Y` / `ASUXXXXX-Y` nese `name`, `type` se mapuje na EA hodnoty `Pre-condition` | `Post-condition` | `Invariant`. Metodické enum varianty ze `scenario-rules.md` („Assumption [Invariant]", „Log record [Post-condition]", „Business function [Pre-condition]") se přijímají — base typ se vezme ze závorky, sémantika zůstává ve jméně. Mechanika: `Element.Constraints.AddNew(name, type)` + Notes/Status + `Update()`. Update = deterministický rebuild V2d (smaž vše + zapiš v pořadí dávky, `removed` v response — konzistence se scenarios; dávka vždy nese kompletní sadu). Validace celé dávky proběhne **před** prvním mazáním (žádné parciální mazání při E_ARGS). Readback: API dump + `SELECT * FROM t_objectconstraint` (zásadně `SELECT *` — lekce §6a/3).

E2E (UC `FBT UC Scenarios` 11129): deploy -01 → create 3× PRE/PST/ASU -02 (readback 3/3; mapování „Assumption [Invariant]"→Invariant ověřeno) → kontrolní čtení -03 (3/3) → rebuild s úpravou PST -04 (`removed: 3`, 3 znovu, změna jména/notes/status propsaná, readback 3/3). ⚠ Incident při -01/-02: po deployi visel modál (odkliknut ručně) a `query` op v -02 vrátil **falešné `rowCount: 0`** (readback UVNITŘ operace přitom viděl 3/3) — potvrzení lekce T4-3 §5a/5: po zotavení z modálu vždy kontrolní čtení v čerstvé dávce (-03 zde).

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
| `E_AMBIGUOUS` | op | **nové v 0.5** (audit B2): `matchByName`/`match: "composite"`/`dedupKey` lookup našel víc kandidátů — response nese `guids`; adresuj `guid`, nebo použij `dedupKey` |
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
- Změna kódu: upravit `src/` → dávka `{"op":"deploy_src","only":["FB_Nazev"]}` (pumpa se sama přenačte — až **po doběhnutí dávky**; nový kód platí od následující dávky, §6a). Bootstrap v EA Scripting jen když pumpa vůbec neběží se starým kódem.
- Kód pro EA runtime (menu, GUI fallback): po `deploy_src` navíc **restart EA** (§1a).
- Po každé změně: sync `src/` = commit v repu (dělá Miloš, VS Code GUI).

## 12. Stav modelu (eaexample, po constraints v0.6)

AICodeBridge el. 11037 (pkg 1052), **71 operací** (od 20260819-01 navíc `FB_OpConstraints`; od 20260818-41 `FB_DedupFind`) (41× `FB_Op*`/`FB_*` — od 20260818-15/-29/-34 navíc `FB_OpScenarios`, `FB_OpApplyClassifierStereotypes`, `FB_OpFindOrCreateSR`, `FB_ScaffoldConfig` + AI Code Bridge legacy). Packages: `#FB-TEST` 1054 `{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}` (whitelist), `#AI-LOG` 1055 (audit). Testovací artefakty `FBT-*` viz `docs/HANDOFF-2026-08-16.md` + klony z iterace 3 (pkg `FBT-IT1-CLONE` 1058, elementy 11093/11096, diagram `FBT OwnedDiag` 1133) + artefakty iterace 2 (diagramy MCP reference 1136 `FBT MCPRef Logical`/1137 `FBT MCPRef Seq`, bridge 1138 `FBT BLD Statika`/1139 `FBT BLD Seq`/1140 `FBT BLD SeqTest`, zprávy 4814/4815, element 11123 `FBT Regres IT2`, 11060 umístěn na 1132) + MDG probe (el. 11126, diagramy 1141/1143/1144) + **artefakty iterace 2b**: UC `FBT UC Scenarios` 11129 (3 scénáře), lifeliny 11061/11062 + classifier 11060 zkonvertované na Component «IDS-Manager» (dávka -31), pkg `FBT Scaffold Templates` 1059 (šablony: el. 11149–11152, diagramy 1147–1150), pkg `FBT #UNSORTED` 1060 + scaffold `DoBind_AREL2608` 1061 (el. 11157–11160, diagramy 1151–1154, konektory 4816–4818), regres el. `FBT Regres IT2b` 11163 + **artefakty dostavby B2** (dávky 20260818-42…55): elementy `FBT B2 K2A` 11173, `FBT B2 K2B` 11174, `FBT B2 MBN` 11178, `FBT B2 NOMATCH` 11179 + 11182 (záměrná duplicita — důkaz defaultu), `FBT B2 DK original` 11184 (TV `ai.dedup`), lifeliny `FBT B2 LL1` 11188 / `FBT B2 LL2` 11189, regres `FBT Regres B2` 11195; konektor Dependency«use» 4819; zprávy 4823–4825; pkg `FBT B2 PKG` 1062; diagram `FBT B2 Seq` 1155 + **artefakty constraints v0.6** (dávky 20260819-02/-04): 3 internal constrainty PRE/PST/ASU na UC `FBT UC Scenarios` 11129 (žádný nový element) — úklid rozhoduje Miloš.
