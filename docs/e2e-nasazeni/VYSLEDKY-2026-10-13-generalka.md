# Generálka nasazení v0.21 doma cestou banky — výsledky živého běhu 2026-10-13 (vlákno Z261013‑1)

*Kódy vláken v tomto souboru jsou psány s nedělitelným spojovníkem (U+2011), aby soubor prošel sweepem před tagem.*

Model: QEAX `EA17_Yoga_QEA2.qeax` (EA security zapnutá, uživatel admin; fixtury `Groups.FBT-CHRANENE` na blacklistu, `FBT-VOLNE` volná, audit `#AI-LOG` 686, add-in `AICodeBridge` 3352 v `EA Addins` 687). Kód: HEAD `97b2dd7` = `origin/main` (strom čistý), předchozí tag `v0.14` = `75534f1`, pumpa v0.6. Režim: Claude dělá vše přes `device_bash` (dávky do `requests\`, čtení `res`) a computer use (EA Scripting, okna pumpy, Output), Miloš jen plný restart EA, start/zavření pumpy a dialog mimo grant.

Zadání: `IT-ANALYSIS/zaprah-vlaken-2026-10-13.md` (Z261013‑1); postup = `docs/NAVOD-NASAZENI-KLIKACI.md` v1.5 kap. 8 (tabulka generálky), 2.2, 4, 4a, 4b, 6.1; pravidla před tagem = `docs/PROTOKOL-EAFB.md` kap. 11; vzor = `VYSLEDKY-2026-10-10.md`. Vhozené dávky a výpis bootstrapu: `docs/e2e-nasazeni/ready-generalka/`. `responses\` není v repu — klíčové hodnoty jsou opsané sem.

## 1. Shrnutí

1. **Generálka prošla** — nasazení v0.21 bootstrapem do QEAX se zapnutou EA security, plný restart EA, pumpa v0.6, kontrola parametrů 0 rozdílů, ping bez problémů, LOW zápis s auditem ve tvaru v0.21, ELEVATED Ne/Ano v okně pumpy (okna klikal Claude), `E_BLACKLIST` v předběžné kontrole, schránka po restartu (kontext výběru + ACK se segmentem `zapis: blacklist`), úklid. **Žádná chyba kódu, žádný STOP.** Tag `v0.21` založen.
2. **Prescan a sanitizace:** harness 603/603, 6 změněných signatur (vše `typeof`), otisk `c37e5f8a4c1a`, sweep 733 blobů `v0.14..HEAD` = 0 nových nálezů; jeden řádek slovníku (vzor názvů funkčních skupin EA banky) se stal vědomou výjimkou rozhodnutím Miloše (kap. 4 ř. 14, T6).
3. **Odchylky od zadání, které nejsou chybou bridge:** model byl na v0.17 (bootstrap tedy zakládal 8 operací a srovnával 2 signatury — realističtější než „0/0"); „tentýž soubor znovu" po Ne = `E_DUPLICATE_ID` (správně podle B1, nový id → Ano); schránka s běžící pumpou neodmítla, protože QEAX nemá `baseDir` = složka pumpy (N‑GEN‑3 — pro banku rozhodnout `baseDir` v `FB_Config`).

## 2. Stav před / po

| | Před (12:06) | Po |
|---|---|---|
| HEAD / origin | `97b2dd7` / `97b2dd7`, strom čistý | commit VYSLEDKY (viz git log) = `main`; `origin/main` do pushe `97b2dd7` |
| Poslední tag | `v0.14` = `75534f1` | **`v0.21`** na commitu VYSLEDKY |
| Harness | 603/603 (`HARNESS_SKIP_DIFFSIG=1`) | 603/603 |
| Otisk pracovní kopie (`tools/code-fingerprint.py`) | `c37e5f8a4c1a` (132 souborů bez konfigurace) | `c37e5f8a4c1a` |
| Add-in v QEAX | **v0.17** (stav deploy_src 12. 10. 11:13–12:08): 132 operací vč. zbylé `FB_Whitelist`; `FB_Audit` bez `human`, `FB_ConfirmSummary` bez `ageInfo`; chybělo 8 operací v0.18–v0.21 (`FB_AuditText`, `FB_CodeFingerprint`, `FB_CodeInfo`, `FB_FieldCheck`, `FB_OutputFlush`, `FB_PumpAlive`, `FB_QcText`, `FB_ReasonText`); tagy `fb.code.*` žádné | v0.21: 140 operací (139 ze `src\` + zbylá `FB_Whitelist`), otisk v modelu `c37e5f8a4c1a` |
| Pumpa | neběžela (poslední tep 06:09 nad EAExample) | běží nad QEAX od 14:51 (v0.6, otisk `943a3941ff62`), `pending\`/`processing\` prázdné |

Zadání předpokládalo „model už má 139, Parametry 0 (deploy_src je srovnal 12. 10.)" — to platilo pro EAExample (večerní běhy v0.18–v0.21 šly tam), ne pro QEAX. Generálka tím byla blíž bance: bootstrap musel operace zakládat i srovnávat parametry.

## 3. Prescan (krok 0)

| Kontrola | Výsledek |
|---|---|
| `git status` | čistý; `main` = `origin/main` = `97b2dd7` (bez zámků `.git/*.lock`) |
| `node test\harness.js` | **603/603 PASS** (`HARNESS_SKIP_DIFFSIG=1`, nástroj signatur zvlášť) |
| `python tools\diff-signatures.py v0.14 HEAD` | 105 operací ve v0.14, 139 v HEAD; **6 změněných signatur** (každá čte nový parametr přes `typeof`, ověřeno grepem): `FB_Audit` +`human` · `FB_ConfirmSummary` +`ageInfo` · `FB_ResolveEl` +`mode` · `FB_ResolvePkg` +`mode` · `FB_RiskAuditTags` +`baseline` · `FB_RiskNote` +`baseline`; 35 nových souborů, 1 smazaný (`FB_Whitelist`) |
| `python tools\code-fingerprint.py` | `c37e5f8a4c1a` (sha256 `c37e5f8a4c1aa751a8c8d83be41d4d63ea84f56baea3790b519244db1d5cca62`), vynechány konfigurace `FB_AccessGroups`, `FB_Config`, `FB_OpsAllowed`, `FB_QcConfig`, `FB_RiskPolicy`, `FB_ScaffoldConfig`, `FB_WriteScope` |

## 4. Sanitizace před tagem (krok 1) — sweep nad bloby `v0.14..HEAD`

Metoda jako v `PROBLEMS/RESENI/sanitizace-v0.13-2026-09-09.md`: `git rev-list --objects v0.14..HEAD` (1081 objektů, 1034 cest, **733 textových blobů**, 47 commitů) → `cat-file --batch` → regexy `SWEEP_RULES` z `tools\build-vscode.py` + slovník kurýrního kanálu (`docs/WORKSPACE-METODIKY.md` kap. 5: čtyři slova + název testovací databáze banky) + 2 greppy přiřazení hesla/tokenu + cesty cizích uživatelů; zvlášť zprávy commitů. Počty = zásahy přes všechny verze souborů (jeden řádek v N verzích = N zásahů).

| # | Co hledám | Zásahy / unik. / souborů | Verdikt |
|---|---|---|---|
| 1 | Jira ID (`[A-Z][A-Z0-9]{1,9}-\d+`) | 10369 / 449 / 283 | **falešný poplach** — kódy metodiky (`UC-`, `BRU…-`, `AF/EF/PRE/PST-`), kontrolní body a nálezy (`PK-`, `BL-`, `T6-`, `PU-`, `CZ-`, `E2E-`, `K8-`, `UI-`…), kódy vláken řady Z, syntetické GUIDy harnessu (`F0000001-…`), `DEMO-` a `PROJ-` fixtury sweepu, poloviny GUIDů. Žádný prefix reálného Jira projektu. |
| 2 | `customfield_\d+` | 0 | čisté |
| 3 | GUID | 1111 / 261 / 167 | **povoleno** — `test/harness.js` (427, syntetické), dávky a `guids*.json` z domácích modelů (`docs/e2e-pumpa/ready*`, `docs/e2e-baseline/ready`, `docs/e2e-scope/ready/guids-qeax.json`), `FB_ScaffoldConfig`, PROTOKOL; v `docs/e2e-banka/` **0** GUIDů (jen placeholdery). |
| 4 | URL | 24 / 4 / 11 | **povoleno** — jen placeholder `github.com/<org>` (profil, logy buildu, kit), `intranet.example` = fixture testu sweepu. |
| 5 | E‑mail | 2 / 1 / 1 | **povoleno** — jediná adresa je fixture `test/build-vscode.test.py` (`…@intranet.example…`). Osobní adresa z v0.13 (P1) se v nových blobech nevyskytuje. |
| 6 | IP | 0 | čisté |
| 7 | UNC (dvojité zpětné lomítko + slovo) | 2785 / 78 / 59 | **falešný poplach** — escapovaná lomítka v JS/JSON (`requests`, `responses`, `HARNSRC`, `processing`…); jediný tvar share = fixture `fileserver01`; syntetické loginy harnessu (`tajnylogin`, `nejakylogin`, `jan_novak`). |
| 8 | Drive (`X:\`) | 893 / 4 písmena / 54 | **povoleno s poznámkou (P2 trvá)** — domácí cesty `C:\GIT\…`, `C:\Users\milos\…` (vč. Box), harness `C:\HARNSRC*`, fixtury `D:`/`W:`; žádná bankovní cesta. |
| 9 | tokeny/hesla (`token|passw|secret|api[_-]?key|bearer|authorization`) | 1146 / 8 / 35 | **falešný poplach** — próza kitu, názvy proměnných (`token` = session token Baseline politiky, `FB_SessionToken`), definice regexu. Přiřazení hodnoty `password *[:=]` = **0**; `token *[:=]` = 142 zásahů, vše kód (`token: s…`, `Token = f…` v harnessu a `FB_AutoBaseline`/`FB_SessionToken`/`FB_BaselineName`), žádná hodnota. |
| 10 | cesty jiných uživatelů `X:\Users\<ne milos>` | 0 | čisté |
| 11 | slovník: název banky | 188 / 2 / 25 | **povoleno (PV‑R6 ii)** — 185× název MDG profilu `CSOB-ITAN`; 3× malými písmeny jen jako slovo slovníku v `docs/WORKSPACE-METODIKY.md` (sebereferenční). Mimo tyto tvary = **0**. |
| 12 | slovník: skupina banky (tři písmena) | 3 / 1 / 1 | **falešný poplach** — tentýž řádek slovníku ve `WORKSPACE-METODIKY.md`. |
| 13 | slovník: `.corp` | 3 / 1 / 1 | **falešný poplach** — tentýž řádek. |
| 14 | slovník: vzor názvů funkčních security skupin EA banky (zavináč‑F‑nula) | 97 / 1 / 6 | **VĚDOMÁ VÝJIMKA (nová, Miloš 13. 10. 2026)** — tvary v komentářích `src\AICodeBridge.FB_AccessGroups.js` a `FB_InterpretError.js`, ve fixtuře `test/harness.js` (login `novak`), v `docs/PROTOKOL-EAFB.md`, `docs/e2e-banka/PROTOKOL-POC-BANKA-2026-09-10.md` a jako slovo slovníku ve `WORKSPACE-METODIKY.md`. Vše kromě POC‑BANKA bylo už ve `v0.14` (na GitHubu). Rozhodnutí: jde o vzor pojmenování skupin, ne o server, účet ani klíč → nic se nenahrazuje, historie se nepřepisuje; řádek doplněn do tabulky vědomých výjimek `PROBLEMS/RESENI/T6-sanitizacni-checklist.md`. Při dalších sweepech mostu = zásahy jen v těchto souborech = OK. |
| 15 | slovník: název testovací databáze banky | 34 / 2 / 6 | **vědomá výjimka (T6, 10. 10. 2026)** — jen **starší verze** souborů v historii (`PROTOKOL-EAFB`, `BUILD-VSCODE`, `README`, `NAVOD-NASAZENI-BANKA`, `WORKSPACE-METODIKY`, `e2e-banka/ready/req-banka-A1.json`); v **HEAD = 0** (nahrazeno `<TEST-DB>` v `97b2dd7`). Historie se nepřepisuje. |
| 16 | `jira\.[a-z]` (interní Jira host) | 0 | čisté |
| 17 | zprávy commitů `v0.14..HEAD` (47) | 0 nálezů | jen odkazy `claude.ai/code/session_…` v trailerech Co‑Authored‑By (veřejná doména nástroje, ne banka) |

**Verdikt: 0 nových nálezů mimo vědomé výjimky → tag povolen.** Tento soubor prošel týmž sweepem (řádek 14 a 15 jsou popsány slovy, kódy vláken s U+2011).

## 5. Živě v QEAX (krok 2) — tabulka kroků a)–k)

| Krok | Co ověřuje | ✅/❌ | Čas | Doklad | Poznámka |
|---|---|---|---|---|---|
| a | stav add-inu před bootstrapem (EA MCP `get_elements_information` 3352, pumpa zavřená) | ✅ | 12:19 | seznam 132 operací | **model byl na v0.17**, ne v0.21 (viz kap. 2) — 8 operací chybělo, `FB_Audit`/`FB_ConfirmSummary` se starými parametry, `FB_Whitelist` navíc |
| b | bootstrap (Scripting → FABLE5 → `ITAN-Bootstrap`, obsah skriptu nahrazen aktuálním `scripts\ITAN-Bootstrap File Bridge.js` přes schránku, Run) | ✅ | 12:25 | `ready-generalka/bootstrap-output-2026-10-13.txt` | `Element AICodeBridge uz existuje (3352)`; **`PX FB_Audit: (…, requestText) -> (…, requestText, human)`**, **`PX FB_ConfirmSummary: (resp) -> (resp, ageInfo)`**; `Otisk kodu v modelu: c37e5f8a4c1a (132 souboru…)`; **`Hotovo: 8 operaci zalozeno, 139 nahran kod (souboru v src: 139). Parametry: 2 operaci srovnano… Receptions: 0 zalozeno, 0 prepnuto, 0 parametry opraveny.`**; žádné `VAROVANI`; ~26 s. Klik trefil „Debug: Run Script with Debugger" místo Run — výsledek stejný, výpis v panelu Debug místo System Output → Script (zkopírován přes Ctrl+A/C) |
| c | plný restart EA (Miloš, File → Exit, QEAX) → menu Specialize → AI Bridge | ✅ | 14:46 | screenshot menu | **6 položek, bez vrátného**: Zpracovat davku ze schranky · Zpracovat davky ze slozky (requests) · Stav bridge · Kontext vyberu do schranky (pro Copilota) · Uklid automatickych baselines · About AI Bridge |
| d | start pumpy (Miloš, dvojklik `pump.wsf`) → start session | ✅ | 14:51 | `responses\pump-2026-10-13.log` 14:51:27–38 | `Pripojeno na EA: …EA17_Yoga_QEA2.qeax`; `Code loader: 140 operaci` (139 + zbylá `FB_Whitelist`); `==== AI Bridge pripraven ====` bez varování; `Zapis: blacklist (1 chranenych vetvi)` · `EA security zapnuta` · `chraneno: Groups.FBT-CHRANENE` · `bridge chrani i sam sebe: …#AI-LOG, …EA Addins` · `kaskady mazani … cascadeDelete = allow` · **`Otisk kodu v modelu: c37e5f8a4c1a (… nasazeno 2026-10-13 12:25:39 bootstrap)`** · `Pumpa v0.6, otisk 943a3941ff62` |
| e | kontrola parametrů (NAVOD 4a) | ✅ | 14:52 | `req/res-gen-01-params.json` + `params-check.py` | 343 řádků, **140 operací v modelu, 139 souborů v src, 0 rozdílů**; navíc jen `FB_Whitelist` (bez souboru, nikdo ji nevolá — NAVOD 1.2 to už říká) |
| f | ping pumpou (NAVOD 6.1) | ✅ | 14:53 | `res-gen-02-ping.json` | `writeScope`: `mode blacklist`, `repoKnown true`, **`problems []`**, `cascadeDelete allow`, `implicit` = audit `#AI-LOG` + addin `EA Addins`, blacklist `FBT-CHRANENE` `found true`; `access.access write` (admin, člen write skupiny); **`codeInfo.short c37e5f8a4c1a`** (`deployedBy bootstrap`); `pump.version 0.6`; **`agentNotes` 6** |
| g | LOW zápis do `FBT-VOLNE`: `create_or_update_package` `FBT-GENERALKA-1013` + prvek `$0` | ✅ | 14:53 | `res-gen-03-low-zapis.json`, `res-gen-04-kontrola-auditu.json` | `done`, `riskLevel LOW`, bez okna, `baseline none (cisty create)`, balíček 717 + prvek 3853; **audit Artifact 3854 `FB gen-03-low-zapis`** s Notes ve tvaru v0.21 (věty „Davka … skoncila USPESNE: 2 z 2…", „Uroven rizika: bez potvrzeni.", „Zaloha: neporizovala se…", „Kontrola kvality: bez kontrol…" / `--- strojovy zaznam (beze zmeny) ---` / `--- request ---`); tagy `ai.risk.level=LOW`, `ai.risk.confirm=required=0;…`, `ai.risk.metrics`, `ai.baseline`, `result` = strojový řádek; Output tab (zoom): `FB gen-03-low-zapis - Kontrola kvality: bez kontrol - pro tento repozitar nejsou definovane QC kontroly.` |
| h1 | ELEVATED `delete_from_model` prvku 3853 → okno pumpy → **Ne** (klik Claude přes computer use) | ✅ | 14:54 | `res-gen-05-delete-NE.json`, `requests\rejected\req-gen-05-delete.20261013-145458.json` | okno FB-UI-08: „AI chce SMAZAT 1 cil…", Co se stane / Zaloha / Proc se ptam / Ceka od / Ano·Ne·Storno, výchozí **Zrušit**; `rejected E_RISK_REJECTED`, `confirmedByUser false` 14:54:55, audit 3856 „**ZAMITL uzivatel v okne pumpy** 2026-10-13 14:54:55", `ai.risk.codes=CLASS_ELEVATED;THRESHOLD_ELEVATED` |
| h2 | „tentýž soubor znovu" | ✅ (chování) | 14:55 | `res-gen-05-delete-DUPLICATE.json` | **`E_DUPLICATE_ID`** — po Ne je dávka uzavřená (`rejected`); opakování téhož souboru nabídne okno znovu jen u dávky čekající po Stornu (B1). Zadání kroku h) bylo nepřesné, bridge se chová podle PROTOKOL §3b. Nový id → h3 |
| h3 | ELEVATED `delete_from_model` 3853 s novým id → okno → **Ano** | ✅ | 14:56 | `res-gen-05b-delete.json` | `done`, `confirmedByUser true` 14:56:18, prvek `deleted true`; Baseline politika: `FB-AUTO admin s20261013-1 2026-10-13 14:56:18` nad `FBT-GENERALKA-1013` (1 prvek); audit 3857 „**Potvrdil uzivatel v okne pumpy** 2026-10-13 14:56:18", `ai.baseline=…decision=created` |
| i | `E_BLACKLIST`: `create_or_update_package` s `parent` = `FBT-CHRANENE` | ✅ | 14:56 | `res-gen-06-blacklist.json`, `rejected\req-gen-06-blacklist.20261013-145646.json` | `error E_BLACKLIST` v **předběžné kontrole** (`problems[0].path ops[0].parent`, „Bridge sem nezapisuje - davku neopakuj…"), žádné okno, žádná záloha; audit 3858 „ODMITNUTA pred zapisem: cil lezi v chranene casti modelu" |
| — | čtecí dávka nad audity | ✅ | 14:57 | `res-gen-07-audity.json` | 4 Artifacty (3854, 3856, 3857, 3858) s Notes a tagy jak výše; prvek 3853 `COUNT = 0` |
| j1 | schránka po restartu EA: menu **Kontext vyberu do schranky** nad `FBT-GENERALKA-1013` | ✅ | 14:57 | schránka (čtení computer use), dialog `Session` | lidská věta + řádek JSON `{"kind":"eafb-context", …, "writeCheck":{"ok":true,…}, "currentDiagram":{…}}`, bez BOM; dialog = proces `sscripter.exe` (grant + `computer_release_lock`, pak OK klikl Claude) |
| j2 | ping JSON ve schránce → **Zpracovat davku ze schranky** s **běžící pumpou** | ⚠ jinak, než zadání čekalo | 14:59 | dialog ACK + Output `FB clipboard: req-gen-08-ping-schranka.json zpracovan` | **Neodmítla** — zpracovala: `EAFB OK gen-08-ping-schranka: 1/1 ops … zapis: blacklist (1 chranenych vetvi, EA security zapnuta) … kod: c37e5f8a4c1a (2026-10-13 12:25:39 bootstrap)`. Důvod = konfigurace (N‑GEN‑3 níže), ne chyba kódu. Segment `zapis: blacklist` v ACK ✅; test „se zavřenou pumpou" tím odpadl (výsledek by byl týž) |
| k | úklid: `delete_from_model` balíčku 717 → okno → **Ano** | ✅ | 15:01 | `res-gen-09-uklid.json` | `done`, pre‑image `FB-AUTO admin s20261013-1 2026-10-13 15:01:36` nad **`FBT-VOLNE`** (7 prvků, rodič mazaného balíčku), audit zapsán; `requests\pending\` a `processing\` prázdné. Baselines FB‑AUTO ponechány (úklid = report) |

Doba: 12:06 prescan → 12:25 bootstrap → (pauza, zamčená stanice) → 14:46 restart EA → 15:01 úklid. Živá část d)–k) = 10 minut bez jediného kliku Miloše kromě startu pumpy.

## 6. Nálezy a lekce

- **N‑GEN‑1 (zadání × stav modelu):** QEAX nebyl na v0.21, jak zadání předpokládalo — večerní `deploy_src` 12. 10. (v0.18–v0.21) šly do EAExample. Pro generálku to byla výhoda (bootstrap zakládal i srovnával). Lekce: stav modelu před generálkou číst z pingu/EA MCP, ne z VYSLEDKY jiného modelu; `_MOC.md`/paměť mají u každého domácího modelu držet poslední nasazenou verzi zvlášť.
- **N‑GEN‑2 (bootstrap v debuggeru):** „Debug: Run Script with Debugger" (tlačítko vedle Run) dá týž výsledek, ale výpis jde do panelu **Debug**, ne do System Output → Script; v NAVOD 2.2 stojí „Run (zelená šipka)" — správně. Do troubleshootingu: když je Script tab po běhu prázdný, podívej se do Debug.
- **N‑GEN‑3 (schránka vs. běžící pumpa — konfigurace):** `FB_PumpAlive` hlídá `responses\pump-status.json` ve složce výměny schránkového kanálu (`FB_Config.baseDir`, jinak `<složka modelu>\EA-File-Bridge`). QEAX `baseDir` nemá → schránka pracuje nad složkou modelu, pumpa nad `C:\GIT\ea-file-bridge` → žádný konflikt, žádné odmítnutí (ochrana platí jen „nad touž složkou", PROTOKOL §11; ověřena 12. 10. na EAExample, kde `baseDir` = složka pumpy). **Pro banku:** pokud má schránkový kanál sdílet složku s pumpou (a tedy odmítat při běžící pumpě), musí bankovní položka `FB_Config` nést `baseDir` = složka workspace pumpy (NAVOD 5.1). Rozhodnutí Miloše, ne chyba kódu.
- **N‑GEN‑4 (B1 a „tentýž soubor znovu"):** po Ne je dávka `rejected` a stejné `id` = `E_DUPLICATE_ID` („stary res presunut do responses\superseded\"). Hláška říká `(predchozi vysledek: rejected E_RISK_REJECTED, od ?)` — **`od ?`**: pumpa nečte čas z předchozího `res` (pole `since` je jen u stavového záznamu `processing`). Kosmetika; kandidát na balík textů, ne STOP.
- **N‑GEN‑5 (kontrolní dotaz parametrů):** u 10 operací z původního prvku z července (`FB_Main`, `FB_OpPing`, `FB_OpQuery`, `FB_OpCreateElement`, `DeployRequest`, `ExportRequest`, `RunQuery`, `FindTargetMethod`, `GetTag`, `SetTag`) má **každý parametr `Pos = 0`** — `ORDER BY o.Name, p.Pos` pak dává pořadí podle vnitřního pořadí řádků. První verze porovnávacího skriptu řadila shodné `Pos` podle jména → 2 falešné rozdíly. Oprava: řadit stabilně jen podle `Pos` (`ready-generalka/params-check.py`). V bance prvek vznikl bootstrapem (`Position` nastavené), takže se to tam nečeká; kdo si píše vlastní porovnání, musí s `Pos = 0` počítat. Pumpa i EA runtime fungují (loader bere pořadí kolekce).
- **N‑GEN‑6 (`FB_Whitelist` v modelu):** bootstrap operace nemaže → po nasazení v0.21 nad prvkem z v0.14 zůstane `FB_Whitelist` (140 operací místo 139). NAVOD 1.2 to už říká („osiřelou operaci nech být"); kontrola parametrů ji vykáže jako „v modelu navíc" — to je správný výsledek, ne rozdíl.
- Computer use: grant vyprší po 30 min nečinnosti (obnovit přes `computer_request_access`); přepnutí grantů skryje okna → `computer_release_lock` + nový screenshot; `cscript` se rezolvuje jen když pumpa běží; `sscripter.exe` (dialogy `Session.Prompt`) **šlo 13. 10. rezolvovat plnou cestou** (12. 10. ne) — pak dialogy odklikává Claude; `Textinputhost` je nutné grantovat, jinak blokuje jako popředí; zamčená stanice = `Lockapp` v popředí → nic nejde, čekat na Miloše.

## 7. Ověření (krok 4) — pozorovatelné

| Co | Výsledek |
|---|---|
| `node test\harness.js` | 603/603 ✅ |
| `diff-signatures v0.14 HEAD` | 6 změněných signatur, seznam v kap. 3 ✅ |
| sweep | 0 nových nálezů mimo vědomé výjimky ✅ (výjimka pro názvy skupin zapsána do T6) |
| kontrola parametrů | 0 rozdílů / 139 (+ `FB_Whitelist` navíc) ✅ |
| ping `writeScope.problems` | `[]` ✅ |
| audit Artifacty g) h) i) | existují (čtecí dávka `gen-07`: 3854, 3856, 3857, 3858) ✅ |
| `git tag -l v0.21` | `1` — tag vytvořen hned po commitu tohoto souboru (ověřeno `git tag -l v0.21`, `git log -1 v0.21`) |
| `git status` | čistý po commitu (ověřeno) |

## 8. Release v0.21

**Tag `v0.21`** (anotovaný) na commitu tohoto VYSLEDKY; předchozí tag `v0.14` = `75534f1` (9. 9. 2026, stav ověřený v bance). Co se změnilo od v0.14 (47 commitů; detail v `docs/PROTOKOL-EAFB.md` hlavička a §6j–6k, §11; audit `IT-ANALYSIS/AUDIT-usability-pumpy-2026-10-04.md` kap. 6.1):

- **v0.15 — Baseline politika** (20. 9., živě 11. 10., §6j): záloha vázaná na zápis (lazy mikro‑baseline nad nejbližším vlastnícím balíčkem, `FB-AUTO`), pravidla rozhodování, úklid automatických baselines (menu, výchozí report), session token, journal.
- **Balík A — pojistka nasazení** (10. 10., v0.15+): nový parametr existující operace jen přes `typeof`; bootstrap srovnává parametry každé operace (`PX`) a varuje/zastaví při více `AICodeBridge` (N‑B‑4); `tools/diff-signatures.py`; kontrola parametrů po nasazení (NAVOD 4a).
- **Balík B1 — smyčka agent ↔ pumpa, v0.16** (11. 10.): `res` jako stavový záznam (`processing`, `E_INTERRUPTED`), `E_DUPLICATE_ID`, předběžná kontrola `FB_Precheck` (`problems[]`, `E_UNKNOWN_OP` + návrhy, zástupné texty), čekající dávky v `requests\pending\` + expirace `E_RISK_EXPIRED`, pravidlo 3 `ownSessionLow`.
- **Cíl zápisu, v0.17** (12. 10., §6k): režim **blacklist** (`FB_WriteScope`, `FB_Whitelist` zrušen), implicitní ochrana balíčku auditu a add‑inu, `E_BLACKLIST` v předběžné kontrole, `E_SCOPE_CONFIG`, `E_AMBIGUOUS`, cesty `{path:[…]}`, vazba chráněná jen s oběma konci v chráněné části, `cascadeDelete allow|block`, hlášení `FB_ScopeText` (konzole, ping `writeScope.summary` + `agentNotes`), menu **Kontext vyberu do schranky**, `get_selected_context.writeCheck`.
- **Balík D — pumpa v0.6 + src v0.18** (12. 10.): stavový soubor `pump-status.json`, zámek pro uživatele, jeden výsledkový řádek na dávku, log `pump-RRRR-MM-DD.log`, `requests\processing\`, okno s výchozím Storno, čekající dávky po startu; **otisk kódu** `fb.code.*` (`FB_CodeFingerprint`, `FB_CodeInfo`, `tools/code-fingerprint.py`), `FB_PumpAlive`, `FB_SessionStart` po reloadu.
- **Balík B2 — texty a operace, v0.19–v0.20** (12. 10.): okno podle FB‑UI‑08 (`FB_ConfirmSummary(resp, ageInfo)`), stabilní kódy důvodů `ai.risk.codes` (`FB_ReasonText`), druhé kolo potvrzení, otisk souhrnu, `E_PARSE` s pozicí, `E_FILE`/`E_DB_RETRY`; `FB_FieldCheck` (neznámá pole, aliasy), `id` jako klíč, `items/stamped/recovery`, `maxRows` + `E_SQL_UNBOUNDED`, `E_SQL_READONLY`, schránka bez BOM.
- **Audit a QC pro člověka, v0.21** (12. 10.): Notes auditu = věty / strojový záznam beze změny / request (`FB_AuditText`, `FB_Audit(…, human)`), `FB_QcText` v Outputu a dialogu, `FB_OutputFlush`; kanon QA reportu.
- **Balík E — návody** (12.–13. 10., bez změny kódu): `NAVOD-PUMPA-VSCODE.md`, tabulka restartů (NAVOD 4b), kalibrace oken (PROTOKOL §11a), osiřelé `UserSettings` (§6g).

**Změněné signatury existujících operací (6, všechny čtou nový parametr přes `typeof`):** `FB_Audit(+human)`, `FB_ConfirmSummary(+ageInfo)`, `FB_ResolveEl(+mode)`, `FB_ResolvePkg(+mode)`, `FB_RiskAuditTags(+baseline)`, `FB_RiskNote(+baseline)`. Nové operace: 35 (vč. `FB_WriteScope`, `FB_Precheck`, `FB_FieldCheck`, `FB_CodeInfo`, `FB_PumpAlive`, `FB_AuditText`, `FB_QcText`, `FB_ReasonText`); smazaná: `FB_Whitelist` (v modelu zůstane osiřelá).

**Kontroly před tagem:** harness **603/603**; `diff-signatures` = seznam výše; sweep historie `v0.14..HEAD` = **0 nových nálezů** mimo vědomé výjimky (kap. 4); generálka bootstrapem v QEAX se security = tento dokument.

**Co banka musí v adaptacích změnit (NAVOD-NASAZENI-KLIKACI kap. 1.2 tabulka):** `FB_WriteScope` nově místo `FB_Whitelist` (položka `{ repo, cascadeDelete: "block", blacklist: [...] }`), `FB_Config` (`baseDir` — viz N‑GEN‑3), `FB_OpsAllowed` deny (`deploy_src`, `delete_*`, `clone_*`), `FB_AccessGroups`, `FB_RiskPolicy`, `FB_QcConfig`; po bootstrapu plný restart EA, kontrola parametrů (4a), pumpa v0.6 z workspace (`tools/refresh-workspace.py`), kit `.github` z profilu banka. Release na GitHubu se nedělá; push tagu = Miloš.

## 9. Co zbývá

- Push `main` + tagu (Miloš z VS Code; z VM selhává na přihlášení) — karta ve frontě.
- V modelu QEAX zůstávají: audit Artifacty `FB gen-*` v `#AI-LOG` (záměrně), baselines `FB-AUTO admin s20261013-1 …` nad `FBT-VOLNE` (úklid = report); testovací balíček i prvek smazány.
- N‑GEN‑3 (baseDir pro banku) a N‑GEN‑4 (`od ?`) = rozhodnutí/oprava v dalším vlákně, ne v tomto.
