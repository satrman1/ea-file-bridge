# Dokončení reverse engineeringu add-inu EA File Bridge — výsledky 17. 10. 2026

Dávka `IT-ANALYSIS/zaprah-vlaken-2026-10-17.md` (Z261017-1…5). Tento soubor plní vlákna postupně: kap. 1 = Z261017-1, kap. 2 = -2, kap. 3 = -3, kap. 4–5 = -4, kap. 6 = -5.

## 1. Z261017-1 — dorovnání modelu (17. 10. 2026 12:10–12:40)

**Rozsah:** model `/AI Test/Reverse Addinu` (pkg 1124) v EAExample + `docs/re-addin/` (`ir_addin.py`, `ir_fa.py`, `gen.py`, nový `extract_ldm.py`, `ldm_atributy.json`, `stav-2026-10-17.json`, `s17.sh`/`r17.py`, `ready-17/`, `img-17/`). `src/` beze změny. Pumpa v0.6 nad EAExample, všechna okna pumpy (11× Ano) odklikal Claude přes computer use; Miloš jen spustil EA + pumpu a schválil přístup.

**Prescan (krok 0):** ping `repository` = `…\EAExample.qea`, `codeInfo.short` = **`ea47ee1a03a8`** (= v0.22, nasazeno 15. 10. 18:40 `deploy_src`) → pokračováno. **Z261016-1 neproběhlo** — `riskPolicy` nemá `ownSessionPackages` (jen `ownSessionLow: true`; prahy ELEVATED `affectedPackages > 1`, BLOCKED `> 5`) → zápisové dávky dělené tak, aby sahaly do nejvýš 5 balíčků. Stav před = `stav-2026-10-17.json` (z `res-re17-1-00-prescan.json`).

### 1.1 Stav před / po (SQL nad podstromem pkg 1124)

| | před (12:20) | po (12:40) |
|---|---|---|
| balíčky / diagramy | 29 / 64 | 29 / 64 |
| prvky (vč. 28 package prvků) | 193 | **195** (+ BRU-9510, BRU-9511) |
| Behavioral Rule | 9 (BRU-9501 „Klasifikace rizika dávky“ …) | **11** — BRU-9501 „Třídy operací“ (přejmenovaný 12051), **BRU-9510 „Prahy metrik“ (12207)**, **BRU-9511 „Eskalace podle obsahu“ (12208)** |
| Request/Response | 8 tříd `<Služba> Request/Response` vedle DTO v service package (ParentID 0) | 8 tříd **`<Služba>Req` / `<Služba>Res` pod DTO** (ParentID = DTO 11962/11966/11970/11974, Package_ID = service package beze změny) |
| vazby | Aggregation 8, Association 21, Dependency 11, Realisation 23, Sequence 61 (+4 Return), Usage 58 | Aggregation 8 (kompozice DTO → Req/Res beze změny, `SourceIsAggregate 2`), Association 21, **Dependency 15** (+4 DTO «refine» SR), Realisation 23, Sequence 61 (+4), **Usage 73** (+8 UC → BRU-9510/9511, +7 impact) |
| TV `code-ref` prvků | 44× `v0.21 (45de928)` / `code-verified 2026-10-14` | **46× `v0.22 (0c3e207)` / `2026-10-17`** (44 + 2 nová BRU), 0× v0.21 |
| TV `code-ref` operací katalogu | 85× v0.21 | **85× v0.22**, 0× v0.21 |
| atributy entit LDM | 0 | **73** (8 entit) |
| kompozit 1193 `EA Repository` | prázdný | komponenta 11934 umístěna |

### 1.2 Co se udělalo (krok → dávka)

1. **Req/Res pod DTO** — `re17-1-01` `move_elements` s cílem `owningElement` (8×, `moved: true`, readback ParentID = DTO); kompozice DTO → Req/Res beze změny (8× Aggregation, `SourceIsAggregate 2`); DTO diagramy 1197/1199/1201/1203 prvky dál zobrazují (12 objektů). **Proti kanonu dorovnáno navíc** (`re17-1-16`, krok 7): jména podle `emr-zapis-pravidla.md` §7e a šablony `EA-Repozitar-Kontext.md` §13 = **`<Služba>Req` / `<Služba>Res`** (model měl „ProcessRequest Request“) a **Dependency «refine» DTO → SR** (v modelu chyběla, 4×). Pravidlo pro další služby: `gen.svc_ops()` (Req/Res se zakládají s `owningElement` = DTO z předchozí operace téže dávky, kanonickými jmény, kompozicí a «refine») + poznámka v hlavičce `ir_addin.py` (`DTO_PARTS_UNDER_DTO`). `r3()` zůstává jako doklad historické dávky re-12.
2. **Provenance v0.22** — `ir_addin.REF = "v0.22 (0c3e207)"`, `VERIFIED = "2026-10-17"` (staré v `REF_OLD`); `re17-1-03b` (18 komponent + operace rozhraní 11937–11943), `-04` (operace 11944–11950), `-05` (4 SR + 4 DTO), `-07` (BRU + 4 UC), `-08` (zbylých 5 UC). `git diff v0.21 v0.22 -- src/` = 15 souborů; **věta navíc do notes 14 operací** (`ir_addin.V022_NOTES`):

   | Operace katalogu | Soubor | Věta „v0.22: …“ |
   |---|---|---|
   | EAFB Request Manager.ProcessRequest | FB_Main | `$N[i].compositeDiagram`; auto-kompozit MDG = vlastní diagram session |
   | Batch Validation.PrecheckBatch | FB_Precheck | odkazy `.compositeDiagram`, cíl `owningElement` |
   | Batch Validation.CheckFields | FB_FieldCheck | `owningElement` (aliasy owner, parent) |
   | Write Scope.PrecheckTargets | FB_ScopePrecheck | balíček vlastníka u `owningElement` |
   | Risk Gate.ClassifyBatch | FB_RiskGate | výčet balíčků u prahu `affectedPackages` (`summary.packagePaths`) |
   | Risk Gate.BuildConfirmSummary | FB_ConfirmSummary | věta „PRESUNOUT … pod jiný prvek ve stromu“ |
   | Risk Gate.DescribeReason | FB_ReasonText | důvod prahu nese výčet balíčků |
   | Baseline Policy.PlanBaseline | FB_BaselinePolicy | cíl zálohy = balíček vlastníka |
   | Quality Check.RunQc | FB_QcConfig | QC-DEMO-001 bez instancí s classifierem, refů, hranic, gatů |
   | ITAN Methodology.ApplyClassifierStereotypes | FB_OpApplyClassifierStereotypes | Actor → Type Actor |
   | Model Element Access.CreateOrUpdateElements | FB_OpElements | DiagramGate, jméno `""`, ref s odkazem, `compositeDiagramID` |
   | Model Element Access.MoveElements | FB_OpMoveElements | cíl `owningElement` |
   | Diagram Access.PlaceElementsOnDiagram | FB_OpPlaceElements | přesun existujícího objektu |
   | Diagram Access.CreateOrUpdateMessages | FB_OpMessages | zachování `SeqNo` při přesměrování |

   `FB_TargetCache` (resolver, bez vlastní operace v katalogu) beze změny notes.
3. **Rozdělení BRU-9501** (bod b karty 16. 10., přebírá Z261016-2) — `re17-1-07`: 12051 přejmenován na „BRU-9501 Třídy operací“ (vazby zůstaly), nové 12207 „BRU-9510 Prahy metrik“ a 12208 „BRU-9511 Eskalace podle obsahu“ v RULES (REUSABLE); notes = rozdělený původní text (úvodní věta klasifikace + třídy / prahy / eskalace + `ownSessionLow`, kódy důvodů rozdělené podle části). **`ownSessionPackages` do BRU-9511 nepřidáno** — Z261016-1 ještě neproběhlo a věta by byla nové pravidlo, ne rozdělený text; doplní se po Z261016-1. Usage UC → BRU-9510/9511 u 4 UC, které měly Usage na 9501 (UC-95101, -95102, -95103, -95108), oba prvky umístěny na jejich UC detail (1218, 1219, 1220, 1225) pod poslední pravidlo vpravo, krok 75 px. Scénáře UC-95101 (5) a UC-95108 (3) přestavěny celou sadou z `ir_fa.py` (`uses` = „BRU-9501, BRU-9510, BRU-9511[, BRU-9506]“); UC-95102 a -95103 krok s `uses` 9501 nemají → scénáře beze změny. `ir_fa.py`: nová pravidla na konci `F.BRU` (aby `gen.load_r5` párování s `res-re-30` zůstalo platné).
4. **LDM atributy** (N-RE-13) — `extract_ldm.py` (SQL: aliasy tabulek a holé sloupce v řádcích s tabulkou, filtrováno známým schématem EA; Automation: mapa vlastností → sloupec jen v souborech `FB_Op*`, obecné vlastnosti jen u primární entity souboru) → `ldm_atributy.json` → `re17-1-09`: 73 atributů (Package 5, Element 14, TaggedValue 4, Attribute 11, Operation 8, Connector 15, Diagram 10, Baseline 6), typ prostým textem `string|number|guid|datetime`, notes = „SQL: FB_… ; API: FB_…“. Notes entit + věta „Typování doménovými typy při přenosu do EMR (plán A/B/C, metodika §6.3).“ **Omezení:** heuristika — atribuce Automation vlastností je přibližná (vlastnost `.Name` souboru, který zapisuje víc entit, jde jen primární entitě); před přenosem do EMR projít člověkem.
5. **Impact vazby** — `re17-1-10` UCR-95101…95104 → SR ProcessRequest (4×), `re17-1-11` UCR-95106 → SR Ping, SR ProcessRequest → SR CreateOrUpdateElements / SR DeleteFromModel; Usage, `FromSourceToTarget`, notes „Impact: Usage kopíruje ref řetěz“, na žádný diagram (`t_diagramlinks` pro 5124–5130 = 0).
6. **Service Contract Detail (N-RE-14)** — 14 diagramů s rozhraním (1180–1192, 1194) má komponentu + rozhraní pod ní; `t_diagramlinks` pro ně je prázdné, ale **EA vazbu Realisation kreslí** (obrázky 1180 a 1194 přes EA MCP: čárkovaná šipka komponenta → rozhraní, rozhraní se zobrazuje `Komponenta::Rozhraní`). **N-RE-14 tedy nepotvrzen — re-place ani ruční krok není potřeba.** 1178/1179 (klienti bez rozhraní) mají jen komponentu (správně); 1193 `EA Repository` byl prázdný → `re17-1-14` (N-RE-22).
7. **Kontrola stromu** — `re17-1-13` (před dorovnáním kanonu) a `re17-1-17` (po): všech 19 kontrol podle očekávání (`gen.KONTROLY`):

   | Kontrola | Očekávání | Výsledek |
   |---|---|---|
   | rozhraní s ParentID 0 v 1127 | 0 | 0 |
   | instance s classifierem (Object/Component/Actor/InteractionOccurrence/MessageEndpoint) s ParentID 0 v balíčcích služeb a UC | 0 | 0 |
   | gaty bez vlastníka | 0 | 0 |
   | prvky se jménem „Object“ | 0 | 0 |
   | Req/Res pod DTO | 8 | 8 |
   | DTO «refine» SR | 4 | 4 (po `-16`) |
   | SR s TV 505-1 (GUID) / s kompozitem | 4 / 4 | 4 / 4 |
   | UC se scénářem Basic Path / s podmínkou | 9 / 9 | 9 / 9 |
   | Usage UC → BRU-9501/9510/9511 | 12 | 12 |
   | BRU-9510/9511 na UC detailech | 8 | 8 |
   | impact Usage UCR/SR → SR | 7 | 7 |
   | TV code-ref prvků v0.21 / v0.22 | 0 / 46 | 0 / 46 |
   | TV code-ref operací v0.21 / v0.22 | 0 / 85 | 0 / 85 |
   | atributy entit LDM | 73 | 73 |
   | prázdné diagramy v katalogu 1127 | — | 1193 (před) → žádný (po `-14`) |

8. **Ověření okem** (`img-17/` — PNG jsou v `.gitignore` (`*.png`), zůstávají jen na stanici; `re17-1-15` a po přejmenování `re17-1-18`):
   - `DTO_ProcessRequest-1197.png` — DTO nahoře, Req a Res pod ním s kompozicí (plný kosočtverec u DTO, multiplicita 1) a atributy; jména se zobrazují s vlastníkem (`DTO ProcessRequest::ProcessRequestReq`).
   - `UC-95101-detail-1218.png` — hranice s UC a UCR, dva aktéři vlevo, 10 pravidel vpravo pod sebou, BRU-9510 a BRU-9511 dole s vlastní šipkou «use» z UC; popisky „(from RULES (REUSABLE))“ se mírně kříží s šipkami (kosmetika).
   - `EAFB_Request_Manager-1180.png` — Service Contract Detail: komponenta + rozhraní s 6 operacemi, Realisation nakreslená.
   - `EA_Repository-1193.png` — kompozit DB Resource s komponentou (dřív prázdný).

### 1.3 Dávky (`ready-17/req-re17-1-*.json`, odpovědi `responses/res-re17-1-*.json`)

| Dávka | Stav | Risk | QC | Operace |
|---|---|---|---|---|
| `re17-1-00-prescan` | done | — | — | ping, query×6 |
| `re17-1-01-reqres-pod-dto` | done | ELEVATED → Ano | čisté | move_elements, query×3 |
| `re17-1-02-notes-operaci` | done | — | — | query×2 |
| `re17-1-03-provenance-katalog-a` | **error E_ARGS** (předběžná kontrola, nic nezapsáno — N-RE-20) | — | — | create_or_update_elements, create_or_update_operations×7 |
| `re17-1-03b-provenance-katalog-a` | done | ELEVATED → Ano | čisté | totéž s `name` |
| `re17-1-04-provenance-katalog-b` | done | ELEVATED → Ano | čisté | create_or_update_operations×7 |
| `re17-1-05-provenance-sr-dto` | done | ELEVATED → Ano | čisté | create_or_update_elements |
| `re17-1-06-bru-pozice` | done | — | — | query×2 |
| `re17-1-07-bru-split` | done | ELEVATED → Ano | čisté | create_or_update_elements×3, create_or_update_connectors, place_elements_on_diagram×4, create_or_update_scenarios×2 |
| `re17-1-08-provenance-uc` | done | ELEVATED → Ano | čisté | create_or_update_elements |
| `re17-1-09-ldm-atributy` | done | ELEVATED → Ano | čisté | create_or_update_attributes×8, create_or_update_elements |
| `re17-1-10-impact-ucr` | done | **LOW** (bez okna) | bez kontrol (N-RE-19) | create_or_update_connectors, query |
| `re17-1-11-impact-sr` | done | **LOW** | bez kontrol | create_or_update_connectors, query |
| `re17-1-12-scd-kontrola` | done | — | — | query×5 |
| `re17-1-13-kontrola` | done | — | — | query×18 |
| `re17-1-14-kompozit-1193` | done | ELEVATED → Ano | čisté | place_elements_on_diagram, query |
| `re17-1-15-obrazky` | done | — | — | reload_diagrams, get_diagram_image |
| `re17-1-16-dto-kanon` | done | ELEVATED → Ano | čisté | create_or_update_elements, create_or_update_connectors, query×2 |
| `re17-1-17-kontrola-po` | done | — | — | query×19 |
| `re17-1-18-obrazky-po` | done | — | — | reload_diagrams, get_diagram_image |
| `re17-1-19-stav-po` | done | — | — | query×4 |

Žádná dávka nevhozena dvakrát (`s17.sh` kopíruje jen, když `res` ještě neexistuje). Baseline: automatické FB-AUTO nad dotčenými balíčky (žádné `E_NO_BASELINE`).

### 1.4 Nálezy (pokračování řady VYSLEDKY-2026-10-14 kap. 5)

- **N-RE-14 nepotvrzen** (viz krok 6): vazba Realisation se na Service Contract Detail kreslí; prázdné `t_diagramlinks` neznamená chybějící vazbu na diagramu (EA řádek zakládá až pro geometrii/skrytí).
- **N-RE-19 Vazby mezi existujícími prvky zadanými ID jdou LOW a bez kontroly kvality.** `create_or_update_connectors` přes 6 balíčků (UCR ve 4 UC balíčcích → SR v jiné větvi) nezvedl `affectedPackages` (LOW, bez okna, bez zálohy) a QC hlásí `bez_kontrol` „scope balíčku neznámý“. Třída LOW pro vazby je záměr politiky (BRU-9501), ale rozsah zápisu se pro vazby nepočítá a QC se nespustí. Návrh: balíčky konců vazby do `affectedPackages` a do scope QC (rozhodnutí politiky = Miloš).
- **N-RE-20 `create_or_update_operations` update podle `operationID` bez `name` padá v předběžné kontrole** (`E_ARGS ops[1].operations[0].name: chybi name`), ačkoli executor (`FB_OpOperations`) operaci podle `operationID` najde a `name` při updatu nepotřebuje. Nesoulad P2 × executor; obejito posláním stávajícího jména. Návrh: v P2 vyžadovat `name` jen bez `operationID`/`guid`.
- **N-RE-21 (model, opraveno)** Req/Res pojmenované „<Služba> Request/Response“ místo kanonického `<Služba>Req/Res` a chyběla Dependency «refine» DTO → SR (kanon §7e) — generátor re-12 (14. 10.) kanon nečetl. Opraveno `re17-1-16`, generátor `svc_ops()` kanonický.
- **N-RE-22 (model, opraveno)** kompozitní diagram komponenty `EA Repository` (1193) byl prázdný — `r4()` měl v mapě SCD jen komponenty s rozhraním + klienty. Opraveno `re17-1-14`.

### 1.5 Lekce

- Okno pumpy může být v screenshotu částečně zakryté černým obdélníkem okna mimo allowlist (konzole pumpy); tlačítka Ano/Ne/Zrušit dole zůstávají vidět a klik tool `right_click` (prohozená myš) na „Ano“ funguje spolehlivě — 11 oken bez chyby.
- Rebuild scénářů jen u UC, jejichž kroky mají `uses` s měněným pravidlem; UC jen s Usage na pravidlo (bez kroku) scénáře nepotřebuje.
- Pořadí v `F.BRU` je vázané na `res-re-30` (`zip` v `gen.load_r5`) — nová pravidla vždy na konec.

### 1.6 Návrhy do kanonu — propsáno 17. 10. 2026 12:55 (schválil Miloš „ano“; changelog `IT-ANALYSIS/Skilly/_shared/emr-zapis-changelog.md`, dodatek 17. 10.; kity se přegenerují při příštím buildu)

- `IT-ANALYSIS/Skilly/_shared/emr-zapis-pravidla.md` §7e, odrážka „DTO vnitřní struktura“ — doplnit na konec větu: „Přes bridge (v0.22) zakládej Req/Res rovnou pod DTO (`owningElement` = DTO, v téže dávce odkazem `$N[i]` na DTO); existující Req/Res ležící vedle DTO přesuň `move_elements` s cílem `owningElement` (ELEVATED). Jména bez mezery: `<Služba>Req`, `<Služba>Res`.“
- `IT-ANALYSIS/EA-Repozitar-Kontext.md` §6, odrážka „DTO zapouzdřuje Request/Response“ — doplnit: „(ve stromu pod DTO jako `<Služba>Req` / `<Služba>Res` — šablona §13; DTO —«refine»→ SR)“.
- Kit `.github`: zrcadlo §7e po propsání kanonu (přegenerovat).

## 2. Z261017-2 — servisní realizace všech operací katalogu (17. 10. 2026 12:55–13:02 prescan, 20:07–20:51 zápis)

**Rozsah:** model `/AI Test/Reverse Addinu/Logical Design/EA File Bridge` v EAExample a `docs/re-addin/`: nové soubory `ir_sr.py`, `extract_calls.py`, `ir_sr_calls.json` (výstup extraktoru), `w17.sh`, sekce Z261017-2 v `gen.py` (`z2_*`), dávky `ready-17/req-re17-2-*`, obrázky v `img-17/`. `src/` beze změny. Pumpa v0.6 nad EAExample. Všech 24 oken pumpy odklikal Claude přes computer use; Miloš jen schválil přístup.

**Prescan (`re17-2-00`):** ping `codeInfo.short` = `ea47ee1a03a8` (v0.22), `riskPolicy` bez `ownSessionPackages` → Z261016-1 dosud neproběhlo, dávky jsou dělené na nejvýš 5 balíčků. Katalog = **85 operací na 14 rozhraních**, SR mají **4** (ProcessRequest 11961, Ping 11965, CreateOrUpdateElements 11969, DeleteFromModel 11973). Utility (EAFB Utilities, 9 operací) se nerealizuje, protože IDesign Utility je průřezová pomůcka, ne služba; věta je v notes rozhraní 11950 (`re17-2-01`). **Zbývalo 72 operací: Manager 4, Engines 20 (Batch Validation 3, Write Scope 5, Risk Gate 4, Baseline Policy 4, Quality Check 2, ITAN Methodology 2), Resource Access 48 (Model Element 21, Diagram 12, Baseline 5, Audit 3, Code 2, Exchange Folder 5)** — odpovídá zadání. Šablony scaffoldu (`FB_ScaffoldConfig` EAEXAMPLE.QEA, pkg 1059 `FBT Scaffold Templates`, prvky 11149–11152) existují.

### 2.1 Extraktor volání (`extract_calls.py`)

- **Funkce → komponenta** (`--map`): pořadí priorit je (1) code-path operace katalogu, (2) soubory vyjmenované v poli `code` komponenty v `ir_addin.py`, (3) zástupné vzory `FB_Op*`, `FB_OpDiagram*`, `FB_OpBaseline*`, `EA_*`, (4) ruční zařazení s důvodem. Ručně zařazeno 19 funkcí, nezařazených 0: `FB_BaselineCleanupHook` a `FB_SessionToken` → Baseline Policy; `FB_ChatRender`, `FB_ClipboardSearch`, `FB_Gatekeeper(Launch)`, `FB_NavProbe`, `FB_ShowInBrowser` a `FB_Process` → Add-in UI; `FB_InBranch`, `FB_ResolveFail`, `GetTag` a `SetTag` → Model Element Access; `FB_Config`, `FB_RepoId` a `FB_XmlUnescape` → Utility; legacy kanál `#AI-CODE` (`FindTargetMethod`, `ProcessRequests`, `RunQuery`) → Code Access. Důvody jsou v `MANUAL`.
- **Volání:** `this.X(` i `self.X(` (kód používá `var self = this`), X = libovolná funkce `src/` (tedy i `Log`, `SetTag`, `GetTag` bez prefixu `FB_`). Pomocné funkce téže komponenty se rozbalí, ale nekreslí. Volání jiné operace katalogu téže komponenty = ref bez rozbalení. Volání jiné komponenty = zpráva (s `operationID`, když je volaná funkce code-path operace katalogu, jinak se jménem funkce) + ref na její SR. Utility a `Log`/`FB_OutputFlush` se nekreslí (přeskočeno 205 volání, nejčastěji `FB_XmlRows` 69×, `FB_ComObj` 33×, `FB_RepoId` 25×, `Log` 16×). Dynamické volání z registru (`this[reg.fn]`) extraktor nevidí a hlásí ho (jen FB_Main).
- **DB hrana:** tabulky z SQL řetězců jsou typu R (`Repository.SQLQuery` je jen čtení). Automation: `*.AddNew` = C, `DeleteAt`/`DeleteBaseline` = D, `Get*ByID/Guid` a `GetBaselines` = R, `Update()` = U nad entitami, které funkce získala nebo založila (heuristika jako `extract_ldm.py`). Mapování na entity LDM: `t_package` Package, `t_object` Element, `t_objectproperties` TaggedValue, `t_attribute` Attribute, `t_operation` Operation, `t_connector` Connector, `t_diagram`/`t_diagramobjects`/`t_diagramlinks` Diagram, `t_document` Baseline. **Souborová hrana** (doplněno, jinak by Exchange Folder Access neměl žádnou zprávu): `OpenTextFile`, `CreateTextFile`, `ADODB.Stream`, `MoveFile`… → lifeline `EAFB Exchange Folder` (IDS-File Resource), zpráva „čtení souboru“ / „zápis souboru“. Code Access je z této hrany vyjmutý, protože čte složku `src\`, a ne výměnnou složku (věta v notes SR).
- **Kandidáti na nové entity LDM** (tabulky bez entity, **nezaloženo**): `t_connectortag` (PrecheckTargets, PlanBaseline, CreateOrUpdateConnectors), `t_operationparams` (CreateOrUpdateOperations, DeploySrc), `t_objectscenarios` (CreateOrUpdateScenarios), `t_objectconstraint` (CreateOrUpdateConstraints), `t_objectrequires` (CreateOrUpdateRequirements), `t_secuser`/`t_secgroup`/`t_secusergroup` (CheckUserAccess). V sekvencích nejsou, v notes SR je věta „sahá i na tabulky bez entity v LDM“.
- **Request/Response:** u protokolových operací Req = `Op` + pole z `FB_FieldCheck` SPEC (24 operací), u operací bez záznamu v SPEC pole `op.<x>` z kódu (15). U ostatních operací Req = parametry operace katalogu (33). Res = klíče literálů odpovědi s `op:` v kódu (protokolové operace), jinak klíče z věty hlavičky „Vraci { … }“, jinak `Result: <návratový typ>`. Jména jsou PascalCase. Notes pole = řádek hlavičky souboru operace, ve kterém se pole objevuje, u standardních polí odpovědi pevný text (op, status, code, message, items, warnings, partial, stamped, recovery). Celkem **560 atributů** na 144 třídách Req/Res. Omezení: heuristika, takže notes z hlavičky jsou někdy delší věta o celé odpovědi, ne o jednom poli; typy jsou prostým textem.

**Self-check proti 4 hotovým SR** (`python3 extract_calls.py --selfcheck`, lifeliny modelu z `res-re17-2-00` ops[6]):

| SR | jen v modelu | jen v extraktoru | vysvětlení |
|---|---|---|---|
| ProcessRequest | Model Element Access | Exchange Folder Access, Exchange Folder (soubor), Element, TaggedValue | Model kreslí exekuci operací z registru jako zprávu na Model Element Access; v kódu je to dynamické `this[reg.fn]`, které extraktor nevidí (hlásí `dynamic 1`). FB_Main sám čte a přesouvá soubor dávky (`FB_FileBytes`, `FB_StateFile`, `FB_PendingIndex`) a razítkuje prvky. Ručně kreslená SR z 14. 10. tyto kroky vynechala. |
| Ping | — | Risk Gate Engine | `FB_OpPing` volá `FB_RiskPolicy` (ping nese `riskPolicy`); ruční SR to vynechala. |
| CreateOrUpdateElements | — | Attribute, Connector, Diagram, Operation | Rozbalené resolvery Model Element Access (`FB_ResolveEl`, `FB_TargetCache`) čtou SQL i tyto tabulky; ruční SR kreslila jen tabulky, do kterých operace zapisuje. |
| DeleteFromModel | — | Attribute, Operation, TaggedValue | Mazání atributů, operací a tagged values (cíle typu Attribute/Operation) a resolvery; ruční SR je zjednodušila. |

Závěr self-checku: komponenty lifelin se shodují (kromě dynamického registru); rozdíly jsou v tom, že extraktor je úplnější u entit. Čtyři ruční SR se nepřegenerovaly — jejich sekvence zůstaly, jak byly, opraveny jsou jen notes (níže).

### 2.2 Co vzniklo v modelu

1. **Balíčky komponent** (`re17-2-01`): 11 nových pod `Logical Design/EA File Bridge` (1129) — Batch Validation 1155, Write Scope 1156, Risk Gate 1157, Baseline Policy 1158, Quality Check 1159, ITAN Methodology 1160, Diagram Access 1161, Baseline Access 1162, Audit Access 1163, Code Access 1164, Exchange Folder Access 1165 (Request Manager 1130 a Model Element Access 1131 už byly).
2. **Scaffold** (`re17-2-02` sonda, `-03` až `-08`): `find_or_create_referencing_sr` (`operation` = OperationID z katalogu, `packageName` = jméno operace, `targetPackage` = balíček komponenty) → 72 service packages (1166–1237), každý obsahuje: version diagram `version_<op>` (Custom, MDG Version Root Diagram) se SR a DTO, prvek `SR <op>` (Collaboration «Service Realization», TV `505-1 Operation Link` = GUID operace), auto-kompozit sekvenční diagram `SR <op>`, diagram `<op> Impact View` (LD-Behavioral / Realization Impact View), `DTO <op>` s auto-kompozitem `DTO <op>`, **`<op>Req` a `<op>Res` rovnou pod DTO** (ParentID = DTO, žádný přesun nebyl potřeba), Dependency «refine» DTO → SR, 2× kompozice (Aggregation, diamant u DTO). Žádné varování scaffoldu (šablony dohledány).
3. **Obsah** (`re17-2-10` sonda, `-40` až `-54`, 5 SR na dávku): atributy Req/Res; notes SR (1–3 věty: co operace dělá + odchylky as-implemented), DTO („Kontrakt žije v kódu (contractAuthority physical): <code-path>; DTO je logický komentář, ne kopie.“), Req a Res; provenance TV `code-*` na SR a DTO; DTO diagram (DTO nahoře, Req a Res pod ním ve velikosti podle počtu atributů); sekvence: 2× DiagramGate (vstup a výstup) a lifeliny (`name ""`, classifier = komponenta nebo entita LDM, ParentID = SR), refy (InteractionOccurrence pod SR, classifier = cílová SR, jméno a kompozitní odkaz z v0.22), vstupní zpráva gate → vstupní lifeline s `operationID` operace a argumenty z polí Req, zprávy podle extraktoru (operace katalogu / CRUD entit / soubor / jméno funkce), čárkovaná návratová zpráva `<op>Res` na výstupní gate, `apply_classifier_stereotypes`. Celkem v 72 nových SR **318 lifelin, 487 zpráv a 58 refů**.
4. **Ref řetěz → Usage** (`re17-2-61`): 123 nových Usage SR → SR (notes „Impact: …“, žádný diagram). Z toho 65 podle refů nových SR a 58 ze SR ProcessRequest. ProcessRequest dostal Usage na SR všech operací, které FB_Main volá přímo, a na SR všech **42 operací registru**. Na jeho diagramu zůstává jedna zpráva „exekuce operací dávky z registru“ a refy CreateOrUpdateElements a DeleteFromModel (žádných 42 refů). Výčet registru („op → SR …“) je v notes SR ProcessRequest. S impact vazbami z Z261017-1 je teď **Usage SR → SR 125**.
5. **Notes 4 starých SR opraveny** (`re17-2-61`, N-RE-27): obsahovaly zastaralou větu „Bez Diagram Gate … bridge v0.21 gate neumí založit“, přestože gaty mají od 15. 10. Notes jsou přegenerované z `ir_addin.SEQ` se `src @ v0.22`.

### 2.3 Ověření (`re17-2-62-kontrola`, `gen.KONTROLY2`)

| Kontrola | Očekávání | Výsledek |
|---|---|---|
| SR v Logical Design | 76 | 76 |
| SR s TV 505-1 na operaci rozhraní komponenty svého balíčku (`i.Name = <balíček komponenty> + ' Interface'`) | 76 | 76 |
| operace katalogu mimo Utility bez SR | 0 | 0 |
| DTO / DTO s Req i Res pod sebou (ParentID = DTO) | 76 / 76 | 76 / 76 |
| lifeliny, refy a gaty s ParentID 0 | 0 | 0 |
| prvky se jménem „Object“ | 0 | 0 |
| SR s DiagramGate | 76 | 76 |
| refy bez classifieru | 0 | 0 |
| Usage SR → SR | — | 125 |

**Obrázky** (`img-17/`, `re17-2-63`, náhodný výběr `random.seed(20261017)`): `SR_CreateOrUpdateOperations-1390.png`, `SR_GetStatus-1262.png`, `SR_GetBaselines-1474.png` (+ sonda `SR_PrecheckBatch-1246.png`, `DTO_PrecheckBatch-1248.png`). Všechny tři odpovídají IR z `ir_sr_calls.json`: lifeliny ve stejném pořadí, zprávy v pořadí extraktoru, gate vlevo, čárkovaná návratová zpráva a refy dole (GetStatus → SR DescribeScope, SR ResolveBaseDir; CreateOrUpdateOperations → SR CheckWriteElement; GetBaselines bez refu). U CreateOrUpdateOperations je 7 entit a 12 CRUD zpráv — diagram je široký, ale čitelný.

### 2.4 Tabulka operace → SR

| Operace | Komponenta | SR (id) | balíček | lifeliny | refy | zprávy |
|---|---|---|---|---|---|---|
| ConfirmPending | Request Manager | 12242 | 1167 | 5 | 6 | 10 |
| SweepPending | Request Manager | 12247 | 1168 | 5 | 3 | 9 |
| StartSession | Request Manager | 12252 | 1169 | 6 | 3 | 7 |
| GetStatus | Request Manager | 12257 | 1170 | 3 | 2 | 4 |
| PrecheckBatch | Batch Validation Engine | 12236 | 1166 | 3 | 2 | 5 |
| CheckFields | Batch Validation Engine | 12262 | 1171 | 1 | 0 | 2 |
| InterpretError | Batch Validation Engine | 12267 | 1172 | 1 | 0 | 2 |
| PrecheckTargets | Write Scope Engine | 12272 | 1173 | 9 | 0 | 10 |
| CheckWrite | Write Scope Engine | 12277 | 1174 | 5 | 0 | 6 |
| CheckWriteElement | Write Scope Engine | 12282 | 1175 | 5 | 0 | 6 |
| CheckUserAccess | Write Scope Engine | 12287 | 1176 | 1 | 0 | 2 |
| DescribeScope | Write Scope Engine | 12292 | 1177 | 4 | 0 | 5 |
| ClassifyBatch | Risk Gate Engine | 12297 | 1178 | 9 | 0 | 11 |
| BuildConfirmSummary | Risk Gate Engine | 12303 | 1179 | 1 | 1 | 2 |
| DescribeReason | Risk Gate Engine | 12308 | 1180 | 1 | 0 | 2 |
| IssueNonce | Risk Gate Engine | 12313 | 1181 | 1 | 0 | 2 |
| PlanBaseline | Baseline Policy Engine | 12318 | 1182 | 11 | 2 | 13 |
| DecideBaseline | Baseline Policy Engine | 12323 | 1183 | 4 | 0 | 5 |
| EvaluateRecoveryPosture | Baseline Policy Engine | 12328 | 1184 | 1 | 0 | 2 |
| CleanupBaselines | Baseline Policy Engine | 12333 | 1185 | 5 | 2 | 8 |
| RunQc | Quality Check Engine | 12338 | 1186 | 3 | 0 | 4 |
| DescribeQc | Quality Check Engine | 12343 | 1187 | 1 | 0 | 2 |
| ApplyClassifierStereotypes | ITAN Methodology Engine | 12348 | 1188 | 5 | 1 | 8 |
| FindOrCreateReferencingSR | ITAN Methodology Engine | 12353 | 1189 | 9 | 1 | 20 |
| Query | Model Element Access | 12358 | 1190 | 1 | 0 | 2 |
| GetSelectedContext | Model Element Access | 12364 | 1191 | 4 | 2 | 6 |
| FindElementsByName | Model Element Access | 12369 | 1192 | 3 | 0 | 4 |
| FindPackagesByName | Model Element Access | 12374 | 1193 | 2 | 0 | 3 |
| GetElementsInformation | Model Element Access | 12379 | 1194 | 7 | 0 | 8 |
| GetPackagesInformation | Model Element Access | 12384 | 1195 | 7 | 0 | 8 |
| GetConnectorsInformation | Model Element Access | 12389 | 1196 | 7 | 0 | 8 |
| CreateElement | Model Element Access | 12394 | 1197 | 1 | 1 | 2 |
| MoveElements | Model Element Access | 12399 | 1198 | 6 | 2 | 13 |
| CreateOrUpdatePackage | Model Element Access | 12404 | 1199 | 9 | 1 | 14 |
| CreateOrUpdateConnectors | Model Element Access | 12409 | 1200 | 9 | 1 | 15 |
| CreateOrUpdateAttributes | Model Element Access | 12414 | 1201 | 9 | 1 | 14 |
| CreateOrUpdateOperations | Model Element Access | 12419 | 1202 | 9 | 1 | 14 |
| CreateOrUpdateScenarios | Model Element Access | 12425 | 1203 | 6 | 1 | 9 |
| CreateOrUpdateConstraints | Model Element Access | 12430 | 1204 | 6 | 1 | 9 |
| CreateOrUpdateRequirements | Model Element Access | 12435 | 1205 | 6 | 1 | 9 |
| DeleteTaggedvalueFromModel | Model Element Access | 12440 | 1206 | 9 | 2 | 13 |
| ClonePackage | Model Element Access | 12445 | 1207 | 6 | 1 | 10 |
| CloneElements | Model Element Access | 12450 | 1208 | 6 | 2 | 10 |
| ExportElementLinkedDocuments | Model Element Access | 12455 | 1209 | 6 | 1 | 7 |
| ImportElementLinkedDocuments | Model Element Access | 12460 | 1210 | 8 | 2 | 12 |
| GetDiagramsInformation | Diagram Access | 12465 | 1211 | 5 | 0 | 7 |
| CreateOrUpdateDiagram | Diagram Access | 12470 | 1212 | 4 | 2 | 9 |
| PlaceElementsOnDiagram | Diagram Access | 12475 | 1213 | 6 | 1 | 9 |
| RemoveElementsFromDiagram | Diagram Access | 12480 | 1214 | 3 | 1 | 5 |
| CreateOrUpdateMessages | Diagram Access | 12486 | 1215 | 7 | 1 | 16 |
| LayoutConnectors | Diagram Access | 12491 | 1216 | 3 | 1 | 5 |
| ChangeConnectorVisibility | Diagram Access | 12496 | 1217 | 3 | 1 | 5 |
| OpenDiagrams | Diagram Access | 12501 | 1218 | 2 | 0 | 3 |
| ReloadDiagrams | Diagram Access | 12506 | 1219 | 2 | 0 | 3 |
| UpdateDiagramProperties | Diagram Access | 12511 | 1220 | 3 | 1 | 5 |
| SetDiagramObjectStyle | Diagram Access | 12516 | 1221 | 3 | 1 | 5 |
| GetDiagramImage | Diagram Access | 12521 | 1222 | 4 | 1 | 6 |
| GetBaselines | Baseline Access | 12526 | 1223 | 3 | 0 | 4 |
| BaselineDiff | Baseline Access | 12531 | 1224 | 3 | 0 | 4 |
| CreateBaseline | Baseline Access | 12536 | 1225 | 5 | 1 | 7 |
| CreateAutoBaseline | Baseline Access | 12541 | 1226 | 5 | 1 | 7 |
| WriteJournal | Baseline Access | 12547 | 1227 | 4 | 1 | 6 |
| WriteAudit | Audit Access | 12552 | 1228 | 4 | 0 | 7 |
| WriteRiskAuditTags | Audit Access | 12557 | 1229 | 3 | 0 | 4 |
| LogChanges | Audit Access | 12562 | 1230 | 3 | 0 | 4 |
| DeploySrc | Code Access | 12567 | 1231 | 4 | 0 | 7 |
| GetCodeInfo | Code Access | 12572 | 1232 | 3 | 0 | 4 |
| ReadRequestBytes | Exchange Folder Access | 12577 | 1233 | 2 | 0 | 3 |
| ReadWriteState | Exchange Folder Access | 12582 | 1234 | 2 | 1 | 4 |
| UpdatePendingIndex | Exchange Folder Access | 12587 | 1235 | 2 | 0 | 4 |
| IsPumpAlive | Exchange Folder Access | 12592 | 1236 | 2 | 1 | 3 |
| ResolveBaseDir | Exchange Folder Access | 12597 | 1237 | 2 | 0 | 4 |

### 2.5 Nálezy (pokračování řady N-RE)

- **N-RE-23 Dva tvary service package v modelu.** Scaffold (port produkčního VBS) zakládá kompozici **Req/Res → DTO** (zdroj = část, `DestIsAggregate 2`) a navíc diagram `<op> Impact View`. Čtyři SR z dávky re-12 (14. 10.) mají kompozici **DTO → Req/Res** (`SourceIsAggregate 2`) a Impact View nemají. Na diagramu vypadají stejně (diamant u DTO), ale SQL kontroly podle směru vazby (např. `gen.KONTROLY` „Req/Res pod DTO“ přes Aggregation) je musí brát obě. Návrh: 4 staré SR dorovnat na tvar scaffoldu (otočit kompozice a přidat Impact View) — kandidát pro Z261017-4 nebo samostatnou dávku; rozhodnutí je na Milošovi.
- **N-RE-24 Chybné SQL v čtecí dávce nad SQLite = modální dialog EA a falešné „ok, 0 řádků“.** Dotaz na neexistující sloupec (`t_object.Notes`, správně `Note`, `re17-2-00` ops[7]) otevřel v EA dialog „SQL API Open FAILED … no such column“. Pumpa stála, dokud ho někdo neodkliknul, a pak vrátila `status ok`, `rowCount 0` — bez `E_SQL`. Známá lekce (chybné SQL = modální MessageBox), nové je, že na SQLite chyba neprojde do odpovědi. Návrh: `FB_OpQuery` na SQLite rozlišit prázdný výsledek od chyby (např. `Repository.GetLastError()` po `SQLQuery`), jinak agent bere chybu jako „nic nenalezeno“.
- **N-RE-25 (as-implemented, A4) Engines čtou repozitář přímo.** 11 operací Engines (PrecheckTargets, CheckWrite, CheckWriteElement, DescribeScope, ClassifyBatch, PlanBaseline, DecideBaseline, CleanupBaselines, RunQc, ApplyClassifierStereotypes, FindOrCreateReferencingSR) volá `Repository.SQLQuery` nebo Automation samo, ne přes Resource Access. V IDesign k datům přistupuje jen Resource Access. V katalogu je to zachyceno jako Usage Engine → Model Element Access („SQL metriky“ apod.), sekvence ukazují skutečnou DB hranu z lifeline Engine a notes SR mají větu „nález A4“. Doplňuje A1 (Resource Access volá Write Scope Engine — 23 SR).
- **N-RE-26 Kandidáti na entity LDM** — 8 tabulek, viz 2.1. Typicky jde o vlastnosti prvků (scénáře, podmínky, požadavky), parametry operací, tagged values vazeb a security EA. Rozhodnutí o rozšíření LDM o tyto entity je na Milošovi (pro přenos do EMR).
- **N-RE-27 (model, opraveno)** zastaralé notes 4 starých SR o chybějících gatech — opraveno `re17-2-61`.
- Předběžná kontrola odmítá prázdný seznam `attributes` (`re17-2-20`: `E_ARGS … seznam 'attributes' je prazdny`; nic se nezapsalo). To je správné chování; generátor teď prázdné seznamy vynechává (operace bez parametrů = Req bez atributů s notes „operace nemá vstupní parametry“). Id `re17-2-20…34` jsou spotřebované nebo neodeslané (`ready-17/_neodeslano/`), obsah šel jako `-40…-54`.

### 2.6 Lekce

- **Grant computer use vyprší i při čekání na schválení.** Žádost o Textinputhost čekala na schválení od 13:01 do ~19:52 (Miloš pryč) a mezitím vypršel grant EA a cscript udělený v 13:01. Okno dávky `-01` proto běželo na timeout (Storno → pending). Po novém grantu stačilo vhodit tentýž soubor znovu: pumpa vrátila stávající pending a okno nabídla znovu (bez `E_DUPLICATE_ID`). Ponaučení: o všechny granty žádat jednou žádostí na začátku vlákna.
- **Okno pumpy bez fokusu:** když přes okno pumpy leží okno Claude desktop, první klik na „Ano“ okno jen aktivuje. Po každém kliku proto ověřovat screenshotem (u `-05` byl potřeba druhý klik). Tlačítko Ano je u širokého okna (dlouhý výčet prvků) jinde než u úzkého — souřadnice brát z aktuálního screenshotu.
- **Výkon:** scaffold ~15 s na operaci (12 operací ≈ 3 min, 144 zápisů), obsah 5 SR ≈ 60–80 s (~180–260 zápisů), Usage 123 vazeb 30 s. Zápis celkem 20:07–20:50 (43 min) včetně 24 oken; 0 dávek vhozeno dvakrát (kromě úmyslného znovuvhození pending `-01`).
- Utility se v sekvencích nekreslí. Bez toho by každá SR měla lifeline Utilities (`FB_XmlRows` je ve 30+ operacích) a diagramy by přestaly říkat, kudy vede hranice komponent.
