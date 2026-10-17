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
