# VYSLEDKY 2026-10-12 — balík B2, část operace (Z261004b-7, src v0.20)

Vlákno Z261004b-7 (dávka `IT-ANALYSIS/zaprah-vlaken-2026-10-04b.md`), předchůdce Z261004b-6 DOBĚHLO (`4a95f35`). Podklad: `IT-ANALYSIS/AUDIT-usability-pumpy-2026-10-04.md` kap. 3 (FB-PU-24/-25/-26/-27/-30/-31/-32/-33/-43/-44/-45), N-B-3 (banka 10. 9.), bod 1 bývalého Z260911-5 (`maxRows`).

Cíl: operace bridge vracejí, co udělaly; neničí data před kontrolou vstupu; čtení má strop.

## 1. Co se změnilo (src, v0.20 — otisk kódu `64ef92487458`, 130 souborů bez konfigurace)

| Bod | Nález | Změna |
|---|---|---|
| 1 | FB-PU-24 neznámá pole se tiše ignorují | **Nový `FB_FieldCheck(req, reg)`** volaný z `FB_Precheck` (fáze shape) PŘED kontrolou povinných polí: tabulka povolených polí pro 30 operací (op, položky seznamů, podpoložky `sourceEnd`/`targetEnd`/`parameters`/`steps`/`attachTo`/`taggedValues`); neznámé pole → warning `ops[i].elements[j]: nezname pole 'x' (myslel jsi 'y'?) - pole se neprovede` (Levenshtein ≤ 3 / prefix); aliasy se přepíší přímo v dávce + warning „prijato jako“ (`stereotype`↔`stereotypes` podle druhu, `defaultValue`→`default`, `description`→`notes` kde kód alias nemá, `tagged_values`/`tags`→`taggedValues`, `note`→`notes`, `limit`/`top`/`rows`→`maxRows`, `from`/`to`→`source`/`target`, `elementID`…→`id` u cílů mazání, barva `#RRGGBB`→`{red,green,blue}`); `taggedValues` mimo pole, položka TV bez tvaru objektu, krok scénáře jako řetězec / bez `text`, nepřevoditelná barva = **E_ARGS** (`problems[]`). Dokumentační klíče `why`/`note`/`comment`/`desc`/`_comment` na úrovni operace bez varování. Warningy jdou do `resp.warnings` (i při chybě P2). |
| 2 | FB-PU-25 `id` není klíč úpravy | `id` → alias v `FB_FieldCheck` (elementID/packageID/connectorID/attributeID/operationID/diagramID) **a** druhá obrana v operacích (`FB_OpElements`, `FB_OpPackage` vč. zkráceného tvaru, `FB_OpAttributes`, `FB_OpOperations`, `FB_OpConnectors`, `FB_OpMessages` vč. kontroly rebuild). Hlášky E_ARGS/E_NOT_FOUND radí „pro upravu pouzij guid nebo …ID (id z vysledku)“. |
| 3 | FB-PU-26 výjimka zahodí GUIDy | Položka jde do `items` **hned, jak objekt v modelu existuje** (po create/resolve, před zápisem vlastností) v Elements, Package, Attributes, Operations, Connectors, Messages; nese `index`. `FB_Main` po výjimce zapisové operace navíc dohledá prvky s razítkem `ai.request = id dávky` mimo `items` (SQL z `FB_Changes`) → `r.stamped[]` + věta v `message`. |
| 4 | FB-PU-27 rebuild maže před kontrolou | `FB_OpScenarios`: validace celé sady (objekt, `name`, `steps` pole, krok objekt s neprázdným `text`) **před prvním mazáním**; chyby po mazání nesou `removed`; `this._fbOpProgress.removed` pro výjimku. `FB_OpMessages` rebuild: source/target/operation všech zpráv se dohledají před mazáním; `removed` v chybách. `FB_Main`: chyba zápisové operace, která už něco změnila (`removed`, `partial`, `stamped`, položka `created`/`deleted`), nese **`recovery`** = „obnova: baseline '<jméno>' nad <balíček>“ ze sekce `baseline` dávky, nebo věta, že dávka automatickou zálohu nemá. |
| 5 | FB-PU-30 odkaz jménem / GUID bez závorek | `E_AMBIGUOUS` u jmen už dělal Z261004b-10 (`FB_TargetCache` + `FB_ResolveFail`). Nově: GUID bez složených závorek (`8-4-4-4-12` hex) se doplní v `FB_ResolveEl`, `FB_ResolvePkg`, `FB_TargetCache` **a** v `FB_Precheck.walk` (přepis přímo v dávce → Risk Gate i záloha vidí `{GUID}`); tvar `{…}` s cizími znaky = `E_ARGS` před SQL (`_fbResolveErr`, P2 `problems[]`). Ryze číselné jméno = ID zůstává záměr. |
| 6 | FB-PU-31 + N-B-3 SQL | `FB_OpQuery`: `;` a `INTO` mimo řetězcový literál (`'…'`, `"…"`, `[…]`) = `E_SQL_READONLY`; `op.maxRows` (typeof; výchozí 500, max 5000, neplatné = výchozí + warning, větší = strop + warning) → `rows` oříznuté, `truncated: true`, `rowCount` = skutečný počet, `maxRows` v odpovědi; dotaz bez `TOP`/`LIMIT`/`WHERE`/`FETCH` a bez agregace (`COUNT|MIN|MAX|SUM|AVG(` bez `GROUP BY`) = warning „dotaz bez omezeni“, nad tabulkou z `BIG_TABLES` (t_object, t_connector, t_objectproperties, t_attribute, t_operation, t_operationparams, t_diagramobjects, t_diagramlinks, t_xref, t_seclocks, t_document, t_snapshot, t_*tag, t_object*) = **`E_SQL_UNBOUNDED`** (`tables[]`). `FB_ChatRender`: `query: N radku (ORIZNUTO na M radku, maxRows M - zuz dotaz)`. **PROTOKOL kap. 10** poctivě: strop chrání velikost `res` a kontext agenta, ne dobu běhu v EA — tu chrání jen `TOP N`/`WHERE` v dotazu. |
| 7 | FB-PU-32 20+ dotazů na identitu | `FB_RepoId`: paměť `this._fbRepoIdCache` jen po dobu volání `FB_Main` (zapne `_fbRepoIdCacheOn` na začátku, `finishM` i návrat `oldResText` ji zahodí). Mimo `FB_Main` (menu, start session, pumpa mezi dávkami) paměť není → FB-PU-06 (jiný projekt) se dál pozná. Harness: zápisová dávka = 1× `DB_NAME()` (dřív 15–20×). |
| 8 | FB-PU-33 sonda velikosti | `FB_SubtreeCount`: rozpočet se kontroluje **před** každým dalším dotazem, ne po hotovém — dokončený `COUNT` platí vždy; součet 0 **s kanárkem** (kořen v expanzi, `COUNT` i dotaz na diagramy vrátily řádek) = `ok`/0 „prazdny balicek“, ne `unknown`. Falešná nula (B6) zůstává `unknown` jen tam, kde dotaz řádek nevrátil. Dva starší testy harnessu přepsány na nové pravidlo (B6 → FB-PU-33). |
| 9 | FB-PU-43 vrátný v menu v bance | `EA_GetMenuItems`: položka „Zapnout AI import rezim (vratny)“ jen při `FB_Config.gatekeeper === true` (stejná větev jako `navProbe`); `FB_GatekeeperLaunch`: bez `gatekeeper: true` odmítne (text pro správce), s ním `Session.Prompt(…, 2)` Ano/Ne před spuštěním skrytého powershellu (Ne = „nespusten“). `FB_Config`: EAEXAMPLE `gatekeeper: true` (doma zůstává), QEAX ne; bankovní šablona klíč nemá → v bance položka zmizí. |
| 10 | FB-PU-44 / -45 schránka, BOM | `FB_ClipboardImport`: (a) JSON vyříznut od první `{` po poslední `}` (markdown obal / věta kolem) + věta „Obal kolem JSON (N znaku, markdownovy blok) odriznut“; typografické uvozovky = vlastní hláška; (b) po `clip.exe` fallbacku se schránka přečte zpět a porovná — „je ve schrance (overeno zpetnym ctenim)“ / „NEZDARILO“; (c) dedup přes konečný `res-<id>.json` (status ≠ processing/confirm_required) před zápisem req — přežije restart EA; (d) `writeUtf8` píše UTF-8 **bez BOM** (ADODB binární cesta, Position = 3; fallback s BOM jen bez binární cesty). `FB_Main` (surové bajty i `pendSame`) a `FB_ConfirmPending` odříznou BOM `EF BB BF` před otiskem — soubor s BOM odjinud (Notepad) už nedá `E_RISK_INTEGRITY`. |

`diff-signatures v0.14 HEAD`: beze změny proti Z261004b-6 (5 změněných signatur z dřívějška, vše typeof); nový soubor `FB_FieldCheck`. Nové kódy/pole pro kit: `E_SQL_UNBOUNDED`; `query.maxRows/truncated/rowCount`; `items[].index`, `stamped[]`, `recovery`, `removed`; `resp.warnings` z kontroly polí; `FB_Config.gatekeeper`.

## 2. Harness

561 → **590/590** (`HARNESS_SKIP_DIFFSIG=1`; blok „BALIK B2 - OPERACE (Z261004b-7)“, 29 testů). Upravené fixtury: `B2 okno 'Co se stane'` (kroky scénáře jako objekty), dva dotazy N-K8-4/N2 (`LIMIT 10` / `WHERE` — bez omezení nad t_seclocks/t_object je teď chyba), `BL-2 sonda B6` a `B1 N-E2E-3` (nula s kanárkem = ok).

## 3. Kit

Kanon `IT-ANALYSIS/Skilly/_vscode/skills/eafb-bridge/references/`: `EAFB-Operace-Registr.md` (query maxRows/truncated/E_SQL_UNBOUNDED, nová sekce **Kontrola polí dávky** + `id` jako klíč, sekce **Co nese odpověď operace** — `index`, `partial`, `stamped[]`, `removed`, `recovery`), `EAFB-Chyby-a-Confirm.md` (E_ARGS rozšířen, `E_SQL_READONLY` `;`/INTO, nový řádek `E_SQL_UNBOUNDED`, E_PERMISSION s `stamped`/`removed`/`recovery`, warningy kontroly polí a `query`), `EAFB-Pravidla-Agenta.md` (pravidlo 4 SQL: odmítnutí + strop; pravidlo 15 warningy polí). Tři kopie shodné (`emr-bridge/`, `.github/` build `--set full` 103 souborů, verify OK, sweep 0); ZIP `IT-ANALYSIS/M365/banka-kity-2026-10-12.zip` přestavěn (stejný název, README-BANKA.txt rev. večer).

## 4. Živé ověření doma — EAExample, 12. 10. 2026 20:00–20:12

Dávky `docs/e2e-pumpa/ready-b2ops/`. Computer use: okno deploy (Ano) a menu EA klikal Claude; Miloš zavřel pumpu, restartoval EA, spustil pumpu a (po zaseknutí computer use) dal Ano v posledním okně.

| # | Dávka | Co | Výsledek |
|---|---|---|---|
| 1 | `b2o-01-deploy` | deploy_src pumpou v0.6 | okno „nasadi kod bridge do modelu (137 operaci)“ → Ano → `done`, otisk `64ef92487458` (= `tools/code-fingerprint.py`), reload; `FB_FieldCheck` založen v modelu ✅ |
| 2 | `b2o-02-fixture` | balíček `FBT-VOLNE.B2 Operace` + 2 třídy (LOW) | `done`, items nesou `index` ✅ |
| 3 | `b2o-03-fields` | **neznámé pole + id** — `{id: 11896, stereotype: "entity", nots: "…", notes}` a `{id: 11897, description}` | `done` LOW, oba `created: false` (**žádná duplicita**), 4 warningy: `pole 'id' prijato jako 'elementID'`, `pole 'stereotype' prijato jako 'stereotypes'`, `nezname pole 'nots' (myslel jsi 'notes'?)`, `id`→`elementID` u [1] ✅ |
| 4 | `b2o-04-query` | **600+ řádků bez WHERE**: `SELECT Package_ID, Name FROM t_package` (1091 řádků) · `t_object WHERE Object_ID > 0` (11 693) · totéž `maxRows: 50` · `SELECT Object_ID FROM t_object` | op0 `ok` rowCount 1091, rows 500, `truncated`, 2 warningy („dotaz bez omezeni“, „oriznut … 1091 … prvnich 500“) ✅ · op1 rowCount 11693 / rows 500 ✅ · op2 rows 50 ✅ · op3 **`E_SQL_UNBOUNDED`** (`tables: [t_object]`) ✅; res 67 KB |
| 5 | `b2o-05-sqlro` | `… WHERE Package_ID = 1; DELETE FROM t_package` | `E_SQL_READONLY` „obsahuje ';' mimo retezec“ ✅ |
| 6 | `b2o-06-clip` (schránka, EA před restartem) | dávka s markdown obalem | **E_PARSE podle starého kódu** — EA runtime drží kód z doby startu EA, `deploy_src` + reload pumpy ho nemění (lekce: po `deploy_src` změn `FB_ClipboardImport`/menu = plný restart EA, jako u nových položek menu) |
| 7 | `b2o-07-clip` (schránka, po restartu EA) | tatáž dávka (ELEVATED delete `B2 Operace` 1122) s obalem ```json … ``` + věty kolem | obal odříznut, `requests\pending\req-b2o-07-clip.json` = 144 B čistý JSON **bez BOM**; `confirm_required`; dialog EA → Storno (Miloš) ✅ |
| 8 | pumpa v0.6 start | nabídne čekající `b2o-07-clip` (otisk `395d47b0a41b`, „Ceka od 20:07:39 (1 min)“) → Ano (Miloš, computer use zaseknuté) | **`done`**, `delete_from_model ok` (`Example Model.FBT-VOLNE.B2 Operace`, deleted), záloha reuse `FB-AUTO - s20261012-1 …`; **žádné `E_RISK_INTEGRITY`** — dávka ze schránky potvrzená pumpou prošla ✅ |

Menu po restartu EA: položka vrátného zůstává (EAEXAMPLE má `gatekeeper: true`) — skrytí v bance kryje harness (`FB_Config` bez klíče). Zpětné čtení schránky po ACK, dedup přes konečný `res` a `stamped[]`/`recovery` živě neověřeny (harness). Model: `B2 Operace` smazán testem; `FBT-VOLNE` beze změny.

## 5. Nálezy

- **N-B2O-1 (lekce):** změna kódu, který běží v **EA runtime** (`FB_ClipboardImport`, `EA_GetMenuItems`, `EA_MenuClick`, `FB_ClipboardContext`…), se projeví až po plném restartu EA — `deploy_src` mění model a pumpa reloaduje, EA si kód drží od startu. Do návodu nasazení (Z261004b-8) + do pravidla dávky: „po deploy_src změn schránkových/menu operací restart EA“.
- **N-B2O-2:** computer use z cloudové session se po ~10 minutách zaseklo (screenshot bez odpovědi 60 s) — třetí výskyt (11. 10., 12. 10. ráno, 12. 10. večer); restart Claude desktop pomáhá.
- **N-B2O-3:** `SELECT * FROM t_package` na EAExample = 1091 řádků → i „malá“ tabulka přes strop; kit říká TOP/WHERE vždy, bridge ořízne. Dotaz 11 693 řádků trval pumpě ~5 s (SQLite) — v bance bez WHERE by nad t_object neprošel vůbec (E_SQL_UNBOUNDED).
- Dialog `Session.Prompt` (sscripter.exe) computer use nevidí (proces není v seznamu instalovaných aplikací ani plnou cestou) — Storno/Ano v dialogu EA zůstává human krok.

## 6. Co zbývá

- Miloš: **push** (VM nemá přihlášení); `b2o-07` fixtura je po sobě uklizená.
- Z261004b-8 (návody): N-B2O-1 do `NAVOD-NASAZENI-KLIKACI.md` (restart EA po deploy_src změn EA-runtime operací), `gatekeeper: true` do popisu `FB_Config`, `maxRows` do provozního návodu analytika.
- Kanon kit 03 LDM beze změny (nezapisuje do EA).
