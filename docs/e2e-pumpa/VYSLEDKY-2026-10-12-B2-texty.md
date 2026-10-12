# VYSLEDKY 2026-10-12 — balík B2, část texty pro člověka (Z261004b-6)

Commit `dfc2ee3` (src v0.19, nad `ad8ae06`); harness **561/561** (`HARNESS_SKIP_DIFFSIG=1`, 17 nových testů „B2 …"); `diff-signatures ad8ae06 HEAD` = 1 změněná signatura (`FB_ConfirmSummary(resp) -> (resp, ageInfo)`, čte se přes `typeof`) + 2 nové operace (`FB_ReasonText`, `FB_OutputFlush`). Živě doma na EAExample 18:44–18:57 (pumpa v0.6 z `ad8ae06`, kód nasazen `deploy_src` 2×). Texty bez diakritiky — rozhodnutí o diakritice čeká na spike S1 (UI-Vystupy kap. 3.15); přepis je mechanický.

## 1. Co se změnilo (src)

| Nález / pravidlo | Soubor | Co |
|---|---|---|
| FB-UI-08, KONCEPCE pravidlo 4 | `FB_ConfirmSummary` | Nový tvar okna: `[druhé kolo]` · „AI chce zapsat do modelu a potrebuje tvuj souhlas." · **Co se stane** (věty z operací a cílů = `risk.summary.actions`, ne metriky; u mazání `risk.summary.deletes` se skutečným rozsahem a cestou u položky) · Kde (cesty ostatních cílů) · **Zaloha** (řádky Baseline politiky, bez duplicit) · POZOR kaskády · **Proc se ptam** (všechny důvody jako věty) · **Ceka od** (2. parametr `ageInfo` z pumpy, jinak z `resp.since`) · **Provest?** + jedna legenda · patička `(davka id | otisk … | N zapisu | kódy důvodů)`. Stará odpověď bez `actions`/`deletes`/`reasonItems` se vypíše postaru. Výpustka v patičce nahrazena `...` (ANSI log pumpy ji komolil). |
| FB-PU-20 | `FB_RiskGate` | `summary.deletes[]` zvlášť od ostatních změn: balíček (`FB_SubtreeCount` s `cfg.withDiagrams` → prvky, diagramy, podbalíčky), prvek (vnořené prvky přes `ParentID`), konektor `A -> B (typ)`, atribut/operace/parametr `Trida.x`, diagram, tag; mazaný cíl už není mezi `targets`; `summary.actions[]` per operace (create/update/items/targets/packages/diagrams/pairs/files); `targetsMore`/`packagesMore` = počet nad stropem 12 jmen. |
| KONCEPCE pravidlo 2 + 9 | `FB_RiskGate`, `FB_Main`, `FB_ReasonText` (nový), `FB_RiskAuditTags`, `FB_RiskNote` | Každý důvod nese stabilní kód (`risk.reasonItems[{code, text, args}]`; `riskReasons[]` = technický text beze změny). Tabulka kód → věta ve `FB_ReasonText` (neznámý kód = původní text). Audit tag **`ai.risk.codes`** (kalibrace seskupuje podle kódů), `FB_RiskNote` řádek `kody:`. Kódy: POLICY_INVALID, BASELINE_POLICY_INVALID, OWN_SESSION, PREV_EXCEPTION, UNKNOWN_OP, CLASS_BLOCKED, CLASS_ELEVATED, CLASS_ELEVATED_FOREIGN, ROOT_PACKAGE, TYPE_CHANGE, TYPE_UNVERIFIED, OPS_PARAMS, MSG_REBUILD, BASELINE_RESERVED, CLONE_VOLUME, TARGET_MISSING, TARGET_UNRESOLVED, REF_UNCERTAIN, EMPTY_LIST, NO_METRIC_RULE, BUDGET, THRESHOLD_ELEVATED, THRESHOLD_BLOCKED, CONFIG_TARGET, HASH_MISSING, GATE_FAILED, CASCADE, BASELINE_FAILED, BASELINE_GUIDED, MANUAL_BASELINE_MISSING, RECLASS_METRICS, RECLASS_SUMMARY. |
| FB-PU-19 | `FB_Main`, `FB_ConfirmPending` | Nové `confirm_required` v potvrzeném běhu nese `confirm.round {why: baseline-missing \| metrics-changed \| summary-mismatch, no}`; okno začíná „NEPROVEDENO - zaloha stale chybi…" / „ZNOVU K POTVRZENI - …" + „(kolo N)". |
| FB-PU-21, pravidlo 6 bod 5 | `FB_Main`, `FB_ConfirmPending` | `risk.summaryHash` = SHA-256 kanonického otisku souhrnu (cíle, balíčky, diagramy, cesty, mazané vč. rozsahu, akce). V potvrzeném běhu se otisk souhrnu z `res` (co člověk viděl) porovná s čerstvým; nesoulad = `RECLASS_SUMMARY` + nové kolo `summary-mismatch` s pravdivým souhrnem, nic se neprovede. |
| FB-PU-12 | `FB_JsonParse`, `FB_Main` | Vlastní průchod JSONem před `eval`: čárka navíc před `]`/`}`, neukončený řetězec, chybějící čárka… → `Error("E_PARSE: <co> u znaku N (radek:sloupec r:c): \"<40 znaků okolí>\"")`; `FB_Main` dává text do `message` a `resp.parse {position, detail}`. Pumpa i EA tak dají tutéž chybu (WSH dřív bral `[…,]` jako prázdný prvek). |
| FB-PU-29 | `FB_InterpretError`, `FB_Main` | Souborové hlášky (FSO/ADODB: přesné „Permission denied", „Path not found"…, cesta/přípona/`file`/`folder` v textu bez slov modelu) → **`E_FILE`** s vlastním textem („NENI to EA security ani zamek"), `fileError: true` → W8 jako skutečná výjimka. Deadlock/timeout/spojení → **`E_DB_RETRY`** „zkus davku znovu s novym id". Větve E_PERMISSION/E_LOCKED beze změny, běží až po nich. |
| FB-PU-05, FB-UI-14 | `FB_SessionStart`, `FB_GatekeeperLaunch` | Hlášení po řádcích: `==== AI Bridge pripraven - D. M. RRRR h:mm ====`, varování (POZOR/CHYBA/Upozorneni) první, věta cíle zápisu rozpadlá podle ` \| ` na řádky, každý řádek zvlášť do Output tabu; vrátný dostává řádky slepené ` \| `. |
| FB-PU-34 | `Log`, `FB_OutputFlush` (nový), `FB_Main`, `FB_Config` | Během dávky (`this._fbOutputBatch`) se řádky jen píšou; `EnsureOutputVisible` jednou na konci (každý návrat `FB_Main` jde přes `finishM`). Mimo dávku (menu, start session) jako dřív. Vypínač `FB_Config.outputShow: false`. |
| N-E2E-1 | `FB_RiskGate`, `FB_ConfirmSummary` | `deploy_src` v okně: „nasadi kod bridge do modelu (136 operaci)" (počet souborů `src\` přes Enumerator — pumpa; EA runtime → „rozsah nespocitan"); nespočítané metriky → „pocet zapisu nespocitan" + POZOR řádek. |
| N-E2E-5 | `FB_BaselineDecide` | `found[]` dedup podle (jméno baseline, balíček) — tatáž ruční záloha nad předkem jednou. |
| N-E2E-6 | `FB_BaselineCleanup`, `EA_MenuClick` | `res.textHuman` první: „Smazu N automatickych zaloh balicku "X" starsich nez 14 dni; M novejsich zustane (vzdy aspon K…); rucni zalohy se nemazou." (jméno balíčku dohledá `GetPackageByGuid`, když `DocName` chybí); `textDetail` s GUIDy a loginy jen do Output tabu (po řádcích). Dialog z menu = lidská věta + čára + `balicek \| zaloha` (max 10) + „Podrobny vypis … v Output tabu"; tlačítka „Ano = tyto zalohy TED SMAZAT / Ne, Storno = jen ukazat". |
| — | `pump.wsf` | `FB_ConfirmSummary(r, {since, ageMin})`; vlastní řádek „Ceka od" jen když ho souhrn nenese (starý kód v modelu). Verze pumpy 0.6 beze změny — **do restartu pumpy je v okně řádek „Ceka od" dvakrát** (starý běžící `pump.wsf` ho přidává sám). |
| — | `FB_SubtreeCount` | `cfg.withDiagrams === true` = spočítá diagramy i u neprázdného podstromu (jen Risk Gate u mazání; Baseline politika beze změny, N-E2E-3 platí). |

Neimplementováno (záměrně): FB-UI-07 (blok Output tabu, hlavička s výsledkem) a FB-UI-09 (čtyři řádky chyby s cestou) nejsou v zadání -6; z KONCEPCE jen body schválené kap. 7 (vše, co -6 připadlo: 2, 4, 6.3, 6.5, 9 — hotovo). Diakritika: čeká na spike S1.

## 2. Harness (17 nových testů „B2 …")

Okno smazání balíčku s obsahem (deletes: package, 4 prvky, 1 podbalíček, cesta; cíl ne mezi targets; věty důvodů; jedna legenda; patička), smíšená dávka (prvek + konektor `ElA -> ElB` + atribut `ElB.…`, mazané před ostatními), Co se stane z operací (scénáře + vazby, Ceka od, ageInfo), `FB_ReasonText` (kód → věta, neznámý kód, stará odpověď), kódy + `ai.risk.codes` + `FB_RiskNote`, druhé kolo (`confirm.round` baseline-missing, no 2 → 3, první řádek NEPROVEDENO), podvržený souhrn (nic se neprovede, summary-mismatch, nový nonce, pravdivý souhrn, nepodvržené kolo projde), E_PARSE s pozicí (`[…,]`, `{…,}`, chybějící čárka, BOM, `resp.parse`), `FB_InterpretError` (E_FILE/E_DB_RETRY/E_PERMISSION/E_LOCKED/null), E_FILE v dávce zvedne W8, `FB_SessionStart` po řádcích s varováním první, Output jednou na konci + vypínač + mimo dávku hned, N-E2E-1, N-E2E-5, N-E2E-6. Upravené staré testy: `vcetne 4 prvku, 1 podbalicku` (2. pad), CZ-27 (věta cíle zápisu po řádcích), BL-3 „BEZ pre-image" (text), CZ-18 (cesta cíle zadaného cestou vedle mazaného).

## 3. Živý běh doma (EAExample, 12. 10. 2026 18:44–18:57)

Dávky `docs\e2e-pumpa\ready-b2\`; okna pumpy odklikával Claude přes computer use (cscript + EA), Miloš nic.

| Krok | Dávka | Výsledek |
|---|---|---|
| deploy starým kódem | `b2-02-deploy` | okno ještě starý text „Chysta se zapsat prvku." (N-E2E-1 reprodukován) → Ano → 136 operací, `created: FB_OutputFlush, FB_ReasonText`, `paramsSynced: FB_ConfirmSummary (resp) -> (resp, ageInfo)`, reload, hlášení session po řádcích ✅ |
| fixtura | `b2-03-fixture` | LOW bez okna: `FBT-VOLNE.B2 Mazani` (3 třídy, podbalíček s 1 třídou, diagram, vazba) |
| **okno u smazání balíčku** | `b2-04-delete` | „SMAZE balicek "B2 Mazani" vcetne 4 prvky, 1 podbalicek / kde: Example Model.FBT-VOLNE.B2 Mazani" — **diagram chyběl** (sonda počítala diagramy jen u 0 prvků) a 2. pad → opraveno (`withDiagrams`, „vcetne 4 prvku, 1 diagramu, 1 podbalicku"), Ne |
| deploy novým kódem | `b2-07-deploy2` | okno: „nasadi kod bridge do modelu (136 operaci)", důvod „Nasazeni kodu meni chovani bridge pro vsechny…" ✅; po reloadu věta cíle zápisu po řádcích ✅ |
| okno u smazání, Storno | `b2-08-delete` | „SMAZE balicek "B2 Mazani" vcetne 4 prvku, 1 diagramu, 1 podbalicku", záloha nad FBT-VOLNE (6 prvků), 2 důvody větami, Ceka od, Provest?, patička s kódy ✅ → Storno (pending) |
| **podvržený souhrn** | `res-b2-08-delete.json` přepsán (`Poznamka-docasna`, 0 prvků), tentýž soubor znovu | okno ukázalo podvrh (jako FB-PU-21) → Ano → **nic se neprovedlo**, nové okno „ZNOVU K POTVRZENI - souhrn v okne neodpovidal modelu … (kolo 2)" s pravdivým souhrnem a důvodem RECLASS_SUMMARY ✅ → Ano → smazáno (`done`, baseline `reused`, audit `ai.risk.codes = CLASS_ELEVATED;THRESHOLD_ELEVATED`) ✅ |
| E_PARSE | `b2-05-parse` (`[{"op":"ping"},]`) | `E_PARSE` „carka navic pred ] u znaku 87 (radek:sloupec 1:87): …", `parse.position: 87`, konzole pumpy totéž ✅ |
| druhé kolo „zaloha stale chybi" | `b2-06-guided` (6 balíčků) | **neověřeno živě:** domácí politika má `block.affectedPackages: 5` = `maxBaselinePackages: 5` → dávka přes 5 balíčků je BLOCKED dřív, než dojde na naváděnou cestu (N-B2-1); harness kryje (`B2 druhe kolo`). Živě pokryto druhým kolem `summary-mismatch` (stejný mechanismus, první řádek = důvod). |

Neověřeno živě (vyžaduje restart EA / EA UI): dialog úklidu baselines z menu (N-E2E-6) a chování Output tabu (FB-PU-34) — kryto harnessem.

## 4. Nálezy

- **N-B2-1 (nízká):** doma `DEV_BLOCK.affectedPackages 5` a `DEV_BASELINE.maxBaselinePackages 5` → naváděná cesta přes počet balíčků je nedosažitelná (blokováno dřív). Není chyba (BLOCKED je přísnější), jen T6-9/„druhé kolo" nejde doma pustit bez úpravy politiky. Bankovní šablona: ověřit, že `maxBaselinePackages < block.affectedPackages`, pokud má naváděná cesta existovat.
- **N-B2-2 (info):** do restartu pumpy je v okně „Ceka od" dvakrát (starý `pump.wsf` v paměti). Po restartu pumpy z HEAD zmizí.
- **N-B2-3 (info):** `FB_JsonParse` jde znak po znaku — u dávek kolem 2 MB (strop `hashMaxChars`) přibude v JScriptu řádově sekunda; běžné dávky (KB) bez vlivu.

## 5. Kit

Kanon `Skilly\_vscode\…\EAFB-Chyby-a-Confirm.md`: `E_PARSE` (pozice, `parse.position`), nové řádky `E_FILE`, `E_DB_RETRY`, odstavec „Druhé kolo" (`confirm.round`, nikdy neupravovat `res`). Tři kopie shodné (`emr-bridge`, `.github` build `--set full` 103 souborů + verify OK), ZIP `M365\banka-kity-2026-10-12.zip` přestavěn (stejný název).

## 6. Co zbývá

- Miloš: push (z VM nejde), restart pumpy (odstraní duplicitní „Ceka od"), případně restart EA + menu „Uklid automatickych baselines" (ověřit lidskou větu dialogu živě).
- Z261004b-8 (návody): tabulka kódů důvodů (`ai.risk.codes`) do postupu kalibrace; slovník okna (FB-UI-15) a diakritika po spiku S1.
- Fixtura `FBT-VOLNE.B2 Mazani` je smazaná (součást testu); `B2 Mazani` baseline FB-AUTO nad FBT-VOLNE zůstává (úklid řeší politika).
