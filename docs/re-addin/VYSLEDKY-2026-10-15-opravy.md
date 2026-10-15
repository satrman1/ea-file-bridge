# Opravy EA File Bridge z reverse engineeringu add-inu — 2026-10-15 (Z261014b‑1)

**Vlákno:** Z261014b‑1 bridge opravy z RE (`IT-ANALYSIS/zaprah-vlaken-2026-10-14b.md`). **Vstup:** `VYSLEDKY-2026-10-14-reverse-addinu.md` kap. 5 a 5b (N‑RE‑1…18). **Větev:** `main` (rozhodnutí Miloše 14. 10. 21:59 — opravy před přenosem do banky). **Výsledek:** tag `v0.22` (lokálně; push tagu = Miloš), harness **616/616**, `diff-signatures v0.21 HEAD` = **0 změněných signatur, 0 nových operací**, 28 živých dávek nad EAExample (`ready-fix/`, u každé `req-` i `res-`), model `/AI Test/Reverse Addinu` dorovnán do tvaru metodiky, testovací `_FIX-TEST` smazán.

## 1. Stav před / po

| | před (v0.21 = `45de928`, `main` `d3f5bac`) | po (v0.22) |
|---|---|---|
| Diagram Gate | `type: "DiagramGate"` → `E_EXCEPTION Invalid type` (Automation typ neexistuje) | `DiagramGate`/`Gate` → `MessageEndpoint` + `Subtype 2` pod `owningElement` (SR); zprávy z gatu i na gate fungují |
| `name: ""` při create | EA dosadí „Object" (jméno se nastavovalo jen u updatu) | jméno (i prázdné) se zapíše hned po `AddNew` |
| place existujícího prvku | druhý `DiagramObject.AddNew` → `Update() selhal:` (prázdný `GetLastError`) | existující objekt se **přesune** (`moved: true`, `from{}`), bez `x/y` noop |
| ref (`InteractionOccurrence`) | bez jména, bez kompozitního odkazu (dvojklik nic) | jméno classifieru + `SetCompositeDiagram(kompozit classifieru)`, `refDiagramID` v items |
| ownSessionLow a diagramy | auto‑kompozity MDG (UCR, LS, UC detail) byly „cizí" → `foreignDiagrams N > 0` i v téže session | items nesou `compositeDiagramID/GUID`, `FB_Main` je registruje jako vlastní |
| `$N` odkazy | jen `.id`/`.guid` | + `$N[i].compositeDiagram` (P2, Risk Gate B3 OWN, resolver, nápověda `E_ARGS`) |
| `move_elements` | jen cíl `package` | + cíl `owningElement` (ParentID + balíček vlastníka, kaskáda, readback) |
| `apply_classifier_stereotypes` | Component / Interface / Class | + Actor → Type Actor |
| práh `affectedPackages` | jen číslo (`11 > 5`) | výčet tečkových cest (max 10 + „a N dalších") v důvodu, `FB_ReasonText`, okně a `E_RISK_BLOCKED`; `summary.packagePaths` |
| QC‑DEMO‑001 | hlásila každou nepojmenovanou lifeline | vynechává instance s classifierem, refy, hranice, gaty |

Zdroje pravdy po změně: `src/` (HEAD), `docs/PROTOKOL-EAFB.md` (hlavička „Stav 2026‑10‑15 — tag v0.22", §2a, §4, §6a, §6b, §6i/B, §7), tento soubor.

## 2. Nálezy — před / po / dávka / res

| Nález | Před (důkaz 14. 10.) | Po (kód) | Dávka | res |
|---|---|---|---|---|
| **N‑RE‑1** gate | `re-16`/`re-17`: `E_EXCEPTION Invalid type` | `FB_OpElements.eaType()`: `DiagramGate`/`Gate` → `AddNew(nm, "MessageEndpoint")` + `Subtype = 2` (= `t_object.NType 2`, ověřeno sondou přes vendor MCP — jediný nástroj, který gate uměl — a `SELECT … FROM t_object WHERE Object_ID = 12138`); gate v `package` místo `owningElement` = warning | `fix-02-gate-sql` (jak EA gate ukládá), `fix-10-gate-jmeno` (gate 12143 pod SR 12136, zpráva gate→lifeline 5109, návrat 5110), `fix-30-gaty-sr` + `fix-31-gaty-vystup` + `fix-34-return-poradi` (8 gatů na 4 SR, vstupní zpráva přesměrována z lifeline‑na‑sebe na gate, návratová zpráva na výstupní gate) | `done`; readback `Object_Type = MessageEndpoint, NType = 2, ParentID = SR`; `SELECT COUNT(*) … NType = 2 AND Package_ID IN (1132…1135)` = **8** |
| **N‑RE‑2** jméno `""` | `re-20`: 23× „Object", workaround updatem | po `AddNew` `el.Name = nm`, když dávka `name` nese (i `""`); řádek 169 už neomezen na update | `fix-10-gate-jmeno` (12142), `fix-11-ucr-kompozit` (12147), `fix-21b` (12157) | `items[].name = ""`, `t_object.Name` prázdné; `SELECT COUNT(*) … Name='Object' AND Package_ID BETWEEN 1124 AND 1152` = **0** |
| **N‑RE‑3** přemístění | `re-21`, `re-34a`: `DiagramObject.Update() selhal:` | `FB_OpPlaceElements.existingObj()`: prvek už na diagramu → `left/right/top/bottom` (top/bottom záporné), `Update`, `moved: true`; nový prvek beze změny. Příčina: druhý `DiagramObject` téhož prvku EA odmítá (ne otevřený diagram, ne zámek layoutu) | `fix-20-posun-refu-1196` (otevřený diagram 1196: refy 12002/12003 pod zprávu č. 10 „exekuce operací dávky", y 414), `fix-47`/`fix-48-ls-rozestupy` (35 posunů na UC detailech 1219–1226 z původních dávek re‑34a/b) | `moved: 14/14`, `21/21`; readback `RectTop -414 / RectBottom -444` |
| **N‑RE‑4** ref | `re-14b`: QC nález „bez jména", dvojklik neotevře SR (Miloš 15. 10.) | `InteractionOccurrence` + classifier (`classifierID`/`classifier`) bez jména → `Name = classifier.Name`; bez `compositeDiagram` → `SetCompositeDiagram(kompozit classifieru)` (Automation `CompositeDiagram`, fallback `t_diagram.ParentID`), `refDiagramID` v items; classifier bez kompozitu = warning | `fix-11-ucr-kompozit` (nový ref 12148 → `PDATA1 = 1242`), `fix-30-gaty-sr` op 9 (12002 → 1200, 12003 → 1202), `fix-45-akteri-ucr-1` op 5 (4 UCR refy → 1196) | `t_object.PDATA1` = DiagramID kompozitu SR = klikatelný ref (EA ukládá kompozitní odkaz refu do PDATA1); dvojklik v EA = ruční kontrola Miloše |
| **N‑RE‑6** vlastní diagramy | `re-32`: `foreignDiagrams 14 > 0` (= 9 UCR + 5 LS auto‑kompozitů z `re-30`) | příčina: auto‑kompozit zakládá EA/MDG při `Update`, ne `FB_OpDiagram` → GUID nikdy v `_fbOwnGuids`; `FB_SessionStart` se nenuluje po dávce (jen při startu/reloadu pumpy — ověřeno v `pump.wsf`). Oprava: items `compositeDiagramGUID`, `FB_Main` ho registruje (`ownSession.added` počítá i kompozit) | `fix-11-ucr-kompozit` (UCR + place na `$0[0].compositeDiagram` v téže dávce = **LOW**), harness RE‑6 (dávka A založí, dávka B umístí → `foreignDiagrams 0`) | `riskLevel LOW`, `affectedDiagrams 0` |
| **N‑RE‑11** `$N.compositeDiagram` | `re-32`: druhá dávka s dotazem do `t_diagram` | `refRe` v `FB_Main`, `FB_Precheck`, `FB_RiskGate`, `FB_BaselinePolicy`, `FB_ScopePrecheck` rozšířen; `refValue` vrací `compositeDiagramID` (bez indexu = první položka); `refHint` rozlišuje „položka nenese compositeDiagramID" od „index mimo rozsah" | `fix-11-ucr-kompozit` (`"diagram": "$0[0].compositeDiagram"` → 1244) | `done LOW`; harness RE‑11 (vč. `E_ARGS` s nápovědou) |
| **N‑RE‑17** přesun pod vlastníka | update `owningElement` ignoruje, `move_elements` jen balíček (Miloš 15. 10.) | `FB_OpMoveElements`: `owningElement` na úrovni operace i položky; `ParentID` = vlastník, `PackageID` = balíček vlastníka; `package`+`owningElement` = `E_ARGS`, vlastník = sám prvek / potomek (řetěz `ParentID`) = `E_ARGS`; kaskáda potomků a diagramů jako u balíčku; P2 (`FB_Precheck`, `FB_ScopePrecheck`), `FB_FieldCheck` (+ aliasy `owner`, `parent`), Risk Gate (balíček vlastníka, `owners` v akci, okno „pod jiný prvek ve stromu"), `FB_BaselinePolicy` (cíl = balíček vlastníka) | `fix-21b` (**selhalo tiše** — viz lekce), `fix-24-presun-pod-ucr-2` (stejný i jiný balíček), `fix-36` (14 rozhraní pod komponenty), `fix-40`/`41`/`42` (56 lifelin/refů/gatů pod 4 SR + 9 UCR) | `moved: true`, readback `ParentID = vlastník`; `SELECT COUNT(*) … Interface AND Package_ID=1127 AND ParentID=0` = **0**; `… Classifier > 0 AND ParentID = 0` (1132–1152) = **0** |
| **N‑RE‑18** aktér na SD | lifeline aktéra zůstávala `Object` | `clsType == "Actor"` → `Type = "Actor"` + stereotyp classifiera; idempotentní; domácí kanon `Scripts/ITAN-Apply Classifier Stereotypes on SD.vbs` řeší jen Component / Interface / Class → **rozšíření nad rámec skriptu** (Miloš při zakládání vlákna jinak neurčil) | `fix-21b` (12157 → Actor, 2. běh harness 0 změn), `fix-45`/`fix-46` (9 UCR diagramů) | 9 lifelin aktérů `Object_Type = Actor` s `Classifier` = aktér |
| **N‑RE‑12** výčet balíčků | `re-32`: `affectedPackages 11 > 5` bez jmen | `FB_RiskGate`: `pkgIds` + `FB_ElementPath` (max 10 lookupů) → text důvodu `(A, B … a N dalsich)`, `args.packages/packagesMore`, `summary.packagePaths`; `summary.packages` doplněno **prostými jmény** (QC `$PKGNAMES`, okno); `FB_ReasonText` „zasahuje do N balicku: …" | `fix-25-blocked-vycet` (6 UC balíčků → `E_RISK_BLOCKED` s výčtem), všechna ELEVATED okna od `fix-30` | `message` i okno nesou cesty |
| **N‑RE‑9** QC bez jména | QC hlásila lifeliny | `FB_QcConfig` QC‑DEMO‑001: `AND (o.Classifier IS NULL OR o.Classifier = 0) AND o.Object_Type NOT IN ('InteractionOccurrence','Boundary','MessageEndpoint')` (první verze vyjímala jen `Object/Sequence` — živě `fix-20` našla 9 lifelin typu `Component` po `apply_classifier_stereotypes`) | `fix-11` (4 prázdná jména v `_FIX-TEST` → QC čistá), `fix-24` a dál | `qc.status = ciste` |
| **N‑RE‑16** hranice na survey | survey 1227 bez Boundary (Miloš 15. 10.) | žádná změna kódu — dávka | `fix-35-boundary-survey` (Boundary „EA File Bridge" v GLOBAL VIEWS 1141, 260×5–1320×465 kolem 9 UC, aktéři vně) | `t_diagramobjects` 1 Boundary na 1227 |

Mimo rozsah (beze změny, zůstávají v kap. 5 VYSLEDKY ‑14): N‑RE‑5 (hláška „Pumpa už běží" bez projektu), N‑RE‑7 (práh `affectedPackages` v dev politice — rozhodnutí Miloše), N‑RE‑8 (výkon velké dávky, `aliveUntil` během `processing`), N‑RE‑10 („()" u zprávy bez operace), N‑RE‑13 (katalog typů v EAExample), N‑RE‑14 (Realisation na Service Contract Detail), N‑RE‑15 (generátor katalogu z registru).

## 3. Lekce EA Automation z živého běhu (nové, do PROTOKOL §6i a hlavičky)

1. **`Element.PackageID` zápis = přesun do balíčku.** I při stejné hodnotě EA při `Update()` vynuluje `ParentID` (Update vrátí true). První živý přesun pod UCR (`fix-21b`) proto „prošel" s `moved: true`, ale `t_object.ParentID` zůstal 0. Oprava: `PackageID` jen při změně, `ParentID` ve vlastním `Update`, **readback** `GetElementByID(id).ParentID` → nesoulad = `E_EXCEPTION` „EA nezapsal vlastnika". Vendor MCP (`create_or_update_elements` s `owningElementID`) to umí — potvrzení, že Automation cesta existuje.
2. **Změna konce zprávy (`ClientID`/`SupplierID`) vynuluje `SeqNo`** → návratová zpráva vyskočila na začátek sekvence (`fix-31`). Oprava: `FB_OpMessages` při přesměrování bez `seqNo` pořadí zachová (harness RE‑gate); dorovnání `fix-34`.
3. **Návratová zpráva:** `Connector.Subtype = "Return"` → `t_connector.SubType = Return`, EA ji kreslí čárkovaně (ověřeno PNG `SR Ping`); `PDATA4 = 1` přímo Automation nenastaví — **vendor MCP také ne** (`isReturnMessage: true` na create vrátilo `false`), až jeho update téže zprávy PDATA4 doplnil (mechanismus neznámý; `PDATA2 retval` přitom přepsal na prázdné). Pro metodiku stačí `isReturn: true` v bridge.
4. **Gate = `MessageEndpoint` + `NType 2`**, vlastník = prvek interakce; EA ho na diagramu posadí k jeho zprávě (geometrie z dávky je jen výchozí). Kompozitní odkaz refu EA ukládá do `t_object.PDATA1` (DiagramID).
5. **`DiagramObject.top/bottom` v Automation jsou záporné** (jako `t_diagramobjects.RectTop/RectBottom`); šířka se při přesunu bez `width/height` bere z původního objektu.
6. **Druhý `DiagramObject` téhož prvku** EA tiše odmítne (`Update()` false, prázdný `GetLastError`) — na otevřeném i zavřeném diagramu, sekvenčním i UC.
7. **Obsluha:** opakované vhození hotové dávky (stejný soubor) = `E_DUPLICATE_ID` a původní `res` jde do `responses\superseded\` — správně se stalo 16× mému pomocnému skriptu (`fsubmit.sh` místo `res.sh`); model nedotčen, `fsubmit.sh` teď před kopií kontroluje existující `res`. Ruční baseline nad **společným předkem** cílů (`Logical Design/EA File Bridge` 1129, `Business Applications/EA File Bridge` 1139, `Solution Artefacts` 1127) baseline politika uzná („nalezena čerstvá ruční baseline … (dohledaný cíl dávky)") — 3 ruční baseline `RE-fix pred presunem …` v EAExample zůstávají (ruční se neuklízejí).
8. **`deploy_src` doma nahrává i konfigurační soubory** (`FB_QcConfig` v modelu = HEAD) — „excluded" v odpovědi se týká jen otisku kódu.

## 4. Tabulka ověření (krok 9 zápřahu)

| Kontrola | Očekávání | Výsledek |
|---|---|---|
| harness `HARNESS_SKIP_DIFFSIG=1 node test/harness.js` | ≥ 603 + nové | **616/616 PASS** (13 nových testů: RE‑1, RE‑2, RE‑3, RE‑4, RE‑11, RE‑6, RE‑17 ×2, RE‑18, RE‑12, RE‑9, RE‑11/17 P2, RE‑gate) |
| `python tools/diff-signatures.py v0.21 HEAD` | změněné signatury vypsat | **0 změněných, 0 nových, 0 smazaných** (139 operací) → bootstrap v bance „0 zalozeno / 139 nahran kod / Parametry 0 srovnano" |
| gaty: `SELECT COUNT(*) FROM t_object WHERE Object_Type = 'MessageEndpoint' AND NType = 2 AND Package_ID IN (1132,1133,1134,1135)` | 8 | **8** (dotaz ze zápřahu `Object_Type LIKE '%Gate%'` dává 0 **vždy** — EA gate neukládá pod typem Gate) |
| `SELECT COUNT(*) FROM t_object WHERE Name='Object' AND Package_ID BETWEEN 1124 AND 1152` | 0 | **0** |
| `SELECT COUNT(*) FROM t_object WHERE Object_Type='Interface' AND Package_ID=1127 AND ParentID=0` | 0 | **0** |
| `SELECT COUNT(*) FROM t_object WHERE Package_ID BETWEEN 1132 AND 1152 AND Object_Type IN ('Object','Component','InteractionOccurrence','MessageEndpoint','Actor') AND Classifier > 0 AND ParentID = 0` | 0 | **0** |
| survey 1227 má Boundary | 1 | **1** |
| git log `main` = commity per nález | `feat(fix-re-N)` | 12 commitů: fix‑re‑1,2,4 · 3 · 6,11 · 17 · 12 · 18 · 9 · test · fix‑re‑12 (summary.packages) · fix‑re‑9 (Component/Actor) · fix‑re‑17 (ParentID) · fix‑re‑1,17 (SeqNo, baseline) + docs |
| sanitizační sweep blobů `v0.21..HEAD` | 0 mimo známé výjimky (vzor názvů skupin zavináč‑F‑nula, název MDG profilu) | viz kap. 7 |
| generálka cestou banky (bootstrap nad QEAX, ping) | „N zalozeno / M nahran / Parametry K" + `problems []` | viz kap. 7 |
| tag `v0.22` lokálně | na commitu po generálce | viz kap. 7 |

## 5. Živé dávky (`docs/re-addin/ready-fix/`, EAExample, pumpa v0.6, 15. 10. 2026 14:24–18:26)

Testovací plocha `/AI Test/Reverse Addinu/_FIX-TEST` (1153; SR 12136 + Sequence 1243, UCR 12146 + auto‑kompozit 1244, gaty, lifeliny, ref, aktér, podbalíček `_sub` 1154) — smazána `fix-51` (`delete_from_model`, ELEVATED → Ano, zbytek 0). Nasazení kódu `deploy_src` 3× (po každé opravě z živého nálezu): `fix-03` (otisk `85bed4b5d59a`), `fix-03b` (`d0448e203e19`), `fix-03c` (`0468c9a33142`); **HEAD po `fix-03c` má ještě 2 commity (SeqNo zpráv, baseline cíl vlastníka) — EAExample se dorovná dalším `deploy_src` / bootstrapem před generálkou.** Okna pumpy odklikával Claude přes computer use (prohozená myš: tool `right_click`), 17 oken Ano, 3× Storno (chyběla ruční baseline → `create_baseline` → znovu).

| Dávka | Stav | Risk | QC | Operace |
|---|---|---|---|---|
| `fix-00-prescan` | done | — |  | ping, query×3 |
| `fix-01-testpkg` | error E_ARGS | — |  | create_or_update_package, create_or_update_elements, create_or_update_diagram |
| `fix-01b-testpkg` | done | LOW | ciste | create_or_update_package, create_or_update_elements, create_or_update_diagram |
| `fix-02-gate-sql` | done | — |  | query |
| `fix-03-deploy` | done | ELEVATED | bez_kontrol | deploy_src |
| `fix-03b-deploy` | done | ELEVATED | bez_kontrol | deploy_src |
| `fix-03c-deploy` | done | ELEVATED | bez_kontrol | deploy_src |
| `fix-10-gate-jmeno` | done | ELEVATED | ciste | create_or_update_elements, place_elements_on_diagram, create_or_update_messages, query×2 |
| `fix-11-ucr-kompozit` | done | LOW | ciste | create_or_update_elements, place_elements_on_diagram, query×2 |
| `fix-12-qc-sonda` | done | — |  | query×3 |
| `fix-12b-qc-model` | done | — |  | query |
| `fix-13b-geom-1196` | done | — |  | query×2 |
| `fix-14-img-1196` | done | — |  | get_diagram_image |
| `fix-20-posun-refu-1196` | done (res v `superseded\`) | ELEVATED | nalez | open_diagrams, place_elements_on_diagram, reload_diagrams, query |
| `fix-21-presun-pod-ucr` | error E_ARGS | — |  | create_or_update_elements, place_elements_on_diagram, move_elements, apply_classifier_stereotypes, query |
| `fix-21b-presun-pod-ucr` | done (res v `superseded\`) | ELEVATED | nalez | create_or_update_elements×2, place_elements_on_diagram, move_elements, apply_classifier_stereotypes, query |
| `fix-22-baseline-fixtest` | done | LOW | bez_kontrol | create_baseline |
| `fix-23b-readback-parent` | done | — |  | query, get_elements_information |
| `fix-24-presun-pod-ucr-2` | done (res v `superseded\`) | ELEVATED | ciste | create_or_update_package, create_or_update_elements, move_elements, query |
| `fix-25-blocked-vycet` | error E_RISK_BLOCKED | BLOCKED |  | create_or_update_elements |
| `fix-26-mapovani` | done | — |  | query×6 |
| `fix-27-return-sonda` | done | — |  | query×2 |
| `fix-27b-return-sonda` | done | — |  | query |
| `fix-27c-return-sonda` | done | — |  | query×2 |
| `fix-28-ops-sonda` | done | — |  | query×3 |
| `fix-30-gaty-sr` | done (res v `superseded\`) | ELEVATED | ciste | create_or_update_elements×2, place_elements_on_diagram×4, create_or_update_messages×4, reload_diagrams, query×3 |
| `fix-31-gaty-vystup` | done (res v `superseded\`) | ELEVATED | ciste | create_or_update_elements, place_elements_on_diagram×4, create_or_update_messages×4, reload_diagrams, query×2 |
| `fix-32-return-sonda` | done | — |  | query×2 |
| `fix-33-img-1198` | done | — |  | reload_diagrams, get_diagram_image |
| `fix-34-return-poradi` | done (res v `superseded\`) | ELEVATED | ciste | create_or_update_messages×4, reload_diagrams, query |
| `fix-35-boundary-survey` | done (res v `superseded\`) | ELEVATED | ciste | create_or_update_elements, place_elements_on_diagram, reload_diagrams, query |
| `fix-36-rozhrani-pod-komponenty` | done (res v `superseded\`) | ELEVATED | ciste | move_elements, query |
| `fix-37-baseline-katalog` | done | LOW | bez_kontrol | create_baseline |
| `fix-40-pod-sr` | done (res v `superseded\`) | ELEVATED | ciste | move_elements, query |
| `fix-41-pod-ucr-1` | done (res v `superseded\`) | ELEVATED | ciste | move_elements |
| `fix-42-pod-ucr-2` | done (res v `superseded\`) | ELEVATED | ciste | move_elements |
| `fix-43-baseline-predci` | done | — |  | query |
| `fix-44-baseline-predci` | done | LOW | bez_kontrol | create_baseline×2 |
| `fix-45-akteri-ucr-1` | done (res v `superseded\`) | ELEVATED | ciste | apply_classifier_stereotypes×5, create_or_update_elements, query |
| `fix-46-akteri-ucr-2` | done (res v `superseded\`) | ELEVATED | ciste | apply_classifier_stereotypes×4, query×2 |
| `fix-47-ls-rozestupy` | done (res v `superseded\`) | ELEVATED | ciste | place_elements_on_diagram×6 |
| `fix-48-ls-rozestupy-2` | done (res v `superseded\`) | ELEVATED | ciste | place_elements_on_diagram×10 |
| `fix-50-overeni` | done | — |  | query×7 |
| `fix-51-smaz-fixtest` | done (res v `superseded\`) | ELEVATED | bez_kontrol | delete_from_model, query |

## 6. Co propsat do kanonu a kitu (Miloš / další vlákno)

**`IT-ANALYSIS/Skilly/_shared/emr-zapis-pravidla.md` — přesná znění (kanon needitován, propíše Miloš):**

- §7h, odrážka „Diagram Gate" — **nahradit** celou odrážku: `- **Diagram Gate: \`create_or_update_elements\` s type \`"DiagramGate"\` a \`owningElement\` = prvek SR/UCR** (ověřeno v bridge v0.22, 15. 10. 2026) — bridge ho překládá na Automation typ \`MessageEndpoint\` + \`Subtype 2\` (EA tak gate ukládá; typ „DiagramGate" Automation nezná); vznikne skutečný gate pod prvkem interakce, sedí na rámu jeho kompozitního diagramu, zprávy z něj i na něj (\`isReturn: true\`) fungují. Gate založený do \`package\` místo pod prvek bridge pustí s varováním. Type \`Gate\` je synonymum, \`MessageEndpoint\` na create nepoužívej (obyčejný endpoint).`
- §7g, odrážka „Ref (InteractionOccurrence)…" — **nahradit** druhou větu: `Přes bridge (v0.22) \`classifierID\` nastaví u refu bez jména jméno classifieru **i kompozitní odkaz na jeho kompozitní diagram** (klikatelný ref, \`refDiagramID\` v odpovědi) — FIX skript \`Element.SetCompositeDiagram(...)\` už není potřeba; explicitní \`compositeDiagram\` v dávce má přednost.`
- §7g, nová odrážka za „Lifeliny na SD…": `- **Vlastnictví ve stromu:** lifeliny, refy a gaty patří pod prvek SR/UCR (na úroveň jeho kompozitního diagramu), rozhraní pod komponentu (výjimka: rozhraní vedená samostatně v \`Solution Artefacts Proposed\`). Nový prvek zakládej rovnou s \`owningElement\`; existující přesuň \`move_elements\` s cílem \`owningElement\` (v0.22; \`package\` a \`owningElement\` současně nelze; ELEVATED jako každý přesun). Lifeline aktéra po \`apply_classifier_stereotypes\` = Type \`Actor\` + stereotyp aktéra.`
- §7g, odrážka „MDG elementy … si auto-zakládají kompozitní diagram" — **doplnit** na konec: `Kompozit je v odpovědi \`items[].compositeDiagramID\` a v téže dávce adresovatelný \`$N[i].compositeDiagram\` (v0.22) — druhá dávka s dotazem do \`t_diagram\` odpadá; auto‑kompozit založený touto session není pro Risk Gate cizí diagram.`
- §7h, „Verzní podmínky" — doplnit: `bridge v0.22: gate přes \`DiagramGate\`, \`$N[i].compositeDiagram\`, \`move_elements\` s \`owningElement\`, přesun existujícího prvku po diagramu \`place_elements_on_diagram\` (dříve selhávalo), výčet balíčků u prahu \`affectedPackages\`.`

**`IT-ANALYSIS/EA-Repozitar-Kontext.md` §6** (řádek „Sekvenční vzor SR"): doplnit `(bridge v0.22: gate = \`DiagramGate\` pod SR, návrat \`isReturn\`, ref dostane jméno i odkaz z classifieru, prvky sekvence vlastní SR)`.

**Kit `.github` (jen seznam — kit se nemění v tomto vlákně):**
- `skills/eafb-bridge/references/EAFB-Operace-Registr.md`: `create_or_update_elements` (DiagramGate/Gate, jméno `""` při create, ref = jméno + kompozit classifieru, `items[].compositeDiagramID/GUID/refDiagramID`); `move_elements` (cíl `owningElement`, pravidla E_ARGS, `items[].toOwner`); `place_elements_on_diagram` (existující prvek = přesun, `moved`, `from`); `apply_classifier_stereotypes` (Actor); kapitola „Řetězení `$N`" (`$N[i].compositeDiagram`).
- `skills/eafb-bridge/references/EAFB-Pravidla-Agenta.md`: pravidlo „kompozit MDG prvku adresuj `$N[i].compositeDiagram`, ne druhou dávkou"; „prvky sekvence zakládej s `owningElement` = SR/UCR"; `E_RISK_BLOCKED`/okno teď vyjmenovává balíčky — použij výčet k rozdělení dávky.
- `skills/eafb-bridge/references/EAFB-Chyby-a-Confirm.md`: `E_EXCEPTION` „EA nezapsal vlastnika"; `E_ARGS` u `move_elements` (dva cíle / cyklus) a u `$N[i].compositeDiagram` bez kompozitu; okno „PRESUNOUT N prvků pod jiný prvek ve stromu".
- `skills/emr-konvence/references/emr-zapis-pravidla.md` + `instructions/emr-zapis.instructions.md`: zrcadlo vět z kanonu výše (po propsání kanonu přegenerovat).
- `skills/e2e-f0-f1/SKILL.md`, `skills/emr-scaffold/SKILL.md`: sekvence SR s gaty (vstup gate → lifeline, návrat lifeline → výstupní gate) místo zprávy lifeline‑na‑sebe.

## 7. Závěr vlákna (sweep, generálka, tag)

**Sanitizační sweep `v0.21..HEAD`** (metoda jako 13. 10.: `git rev-list --objects` → 176 textových blobů, regexy `SWEEP_RULES` + slovník čtyř slov; název testovací DB banky nebyl k dispozici — `config/banka-hodnoty.json` na stanici není, v HEAD je od `97b2dd7` jen `<TEST-DB>`): Jira‑vzor = kódy metodiky/nálezů a poloviny GUIDů (falešný poplach); GUID = domácí modely a harness; URL = `github.com/satrman1/…` (osobní repo, provenance TV z RE) + trailery commitů; e‑mail = 1× `satrman1@github.com` v URL plánu (v1.1); UNC/drive = escapovaná lomítka a domácí cesty; tokeny = názvy proměnných, přiřazení hodnoty 0; cesty cizích uživatelů 0; slovník: název banky jen jako `CSOB-ITAN::` (MDG profil, PV‑R6 ii), skupina banky 0, `.corp` 0, zavináč‑F‑nula jen v `PROTOKOL-EAFB.md`, `test/harness.js` a jako slovo v tomto souboru (vědomá výjimka 13. 10.). **Verdikt: 0 nových nálezů.**

**Generálka cestou banky nad QEAX (`EA17_Yoga_QEA2.qeax`, EA security zapnutá, uživatel admin), 15. 10. 18:40–18:48:** EA zavřeno a otevřeno s QEAX přes computer use (login = klik na Login s předvyplněným UserID; okno Scripting se v tomto layoutu EA nezobrazilo — tlačítko Script Library se přepne, okno nikde, zkratka ani Find Command nereagují → **Run bootstrap skriptu zůstává human krok Miloše**, viz karta). Zkrácená varianta: pumpa v0.6 se po restartu EA **sama připojila k QEAX** (`pump-status.repository` = QEAX, start session s otiskem `c37e5f8a4c1a` z bootstrapu 13. 10.), `gen22-01-deploy` = `deploy_src` ELEVATED → Ano → **139 nahráno, 0 založeno, otisk `ea47ee1a03a8`** (= `tools/code-fingerprint.py` nad HEAD), reload; `gen22-02-ping` → `writeScope.problems []`, `codeInfo ea47ee1a03a8`, model 140 operací (139 + osiřelá `FB_Whitelist`); `gen22-03b-low` LOW (balíček `FBT-GENERALKA-1015` 718 + Class 3865 + nepojmenovaná instance 3866 s classifierem přes `$1` — jméno `""` drží i v QEAX) s auditem `{3543015B-…}`; `gen22-04-delete-ne` ELEVATED → **Ne** → `rejected E_RISK_REJECTED`, soubor v `rejected\`; `gen22-05-uklid` ELEVATED → Ano → balíček smazán, zbytek 0. Všechna okna klikal Claude. Očekávání pro bootstrap skript nad QEAX (až ho Miloš pustí): `Hotovo: 0 operaci zalozeno, 139 nahran kod (souboru v src: 139). Parametry: 0 operaci srovnano`, otisk `ea47ee1a03a8`; pro banku z v0.14 beze změny `35 / 139 / 6` (plán v1.2 kap. 1.2).

**Tag `v0.22`** založen lokálně (`git tag -a v0.22`) na posledním commitu vlákna (docs kap. 7 + plán v1.2 nad kódem, který prošel harnessem 616/616 a živými běhy nad EAExample i QEAX). Push tagu = Miloš z VS Code (proxy tagy nepropustí); před pushem tagu doporučeno pustit bootstrap skript nad QEAX (karta).

**Stav domácích modelů:** EAExample i QEAX mají `src/` HEAD (`ea47ee1a03a8`); v EAExample zůstávají 3 ruční baseline `RE-fix pred presunem …` (nad 1127, 1129, 1139; ruční se neuklízejí) a model RE dorovnaný (kap. 2); v QEAX nic navíc kromě auditních Artifactů `FB gen22-*` v `#AI-LOG`.
