# POC EA File Bridge v bance — protokol 2026-09-10/11/13 (Z260908-5 část A: nasazení · Z260908-5b část B: E2E, negativní testy, verdikt)

*Vlákno Z260908-5 „podpora banky živě“ (interaktivní, Miloš v bance vzdáleně, Claude doma nad `C:\GIT\ea-file-bridge`). Repozitář: **`<TEST-DB>`** (MS SQL Server 2022, EA 17.1.6 build 1716, security zapnutá, režim uživatelských zámků). Kód: tag **v0.14** = `75534f1` + dva opravné commity z tohoto běhu (`d53164c`, `47fdbb2`). Tento soubor nese **žádné interní hodnoty banky** — název DB, GUIDy bankovního modelu, ID prvků, loginy, názvy skupin a cest jsou nahrazeny placeholdery `<…>`.*

> **Stav:** část A (nasazení, bloky 1–6 + první zápis) **HOTOVA 10. 9. 2026 — PASS s nálezy**. Část B **HOTOVA: E2E `/e2e-f0-f1` 11. 9. (kola 0–9 prošla bez výhrad k AK), negativní testy A2/A3 + T6-C 13. 9.** — **verdikt POC: PASS s nálezy, Fáze 3: GO** (sekce B6). Kit `.github` v bance vznikl nouzovou cestou (B0), build v bance neproběhl.

## Jak se běželo

Dělba: Claude připravuje dávky do `docs/e2e-banka/ready/` (s placeholdery `<TEST-DB>`, `<GUID-SANDBOX>`, `<LOGIN>`, `<WRITE-GROUP>`), Miloš je vkládá do bankovního `<korp>\requests\` (bankovní klon není v připojených složkách) a výsledky z `res-*.json` **vytahuje bankovní GitHub Copilot podle promptu od Claude** (sanitizace: guid/login/repository/path → `<skryto>`) — Miloš je před odesláním kontroluje. Tenhle způsob se osvědčil (3 výtahy, žádný únik) a od dávky recon-03 nahradil ruční opisování. Placeholdery dosazuje od 19:00 nástroj `tools\banka-dosad.py` + `config\banka-hodnoty.json` (gitignored), který v bance napsal Copilot podle promptu od Claude — ruční nahrazování vedlo 2× k chybě obsluhy.

## Tabulka bloků (podle `docs/NAVOD-NASAZENI-KLIKACI.md` v1.0 s korekcemi K8 z promptu rev. 2)

| Blok | CO | VÝSLEDEK | Čas | Poznámka |
|---|---|---|---|---|
| 0 | Podmínka startu: tag v0.14 na originu | ✅ `v0.14` = `75534f1` = `origin/main` | 9. 9. večer | |
| 1.1 | Kurýrní klon | ✅ nový čistý klon (starý přejmenován), `git log -1` = `75534f1` | ~16:30 | |
| 1.2 | Diff × korporátní repo | ✅ korp. repo bylo na **v0.1 z léta** (24 operací v `src\`, z configů jen `FB_Whitelist`); 368 změněných z 386 souborů, nic navíc; jediná bankovní adaptace = letní `FB_Whitelist.js` → záloha `src-bak\` (mimo commit) | | Diff soubor po souboru nemá u skoku v0.1 → v0.14 smysl — stačila kontrola seznamu + záloha adaptace |
| 1.3 | Commit `import v0.14` | ✅ | | |
| 2 | Přenos add-inu = **jen ITAN-Bootstrap** (ne Copy/Paste) | ✅ `Hotovo: 85 operaci zalozeno, 105 nahran kod (souboru v src: 105). Receptions: 4 zalozeno, 0 prepnuto.` — element AICodeBridge z léta nalezen a doplněn; žádné „BEZ RECEPTION“ (signály v Broadcast Types jsou) | | src cesta zadána dialogem (klon není na `C:\GIT`) |
| 3 | Manage Add-Ins (security model: Available Add-Ins / Groups / Status / Load on Startup) | ✅ Groups = skupina, Status **Optional**, Load on Startup ✓; po znovuotevření beze změny | | screenshot Miloš nechtěl (dialog zná) |
| 4 | Plný restart EA → menu | ⚠ → ✅ menu **Specialize → AI Bridge** kompletní (6 položek), záložka Output „AI Bridge“ existuje; **ALE klik na kteroukoli položku → `Unhandled menu item: -AI Bridge`** = nález **N-B-1** (bootstrap založil `EA_MenuClick` bez parametru `MenuName`) → oprava bootstrapu doma (`d53164c`) → přenos souboru **schránkou** (odchylka od kurýra) → Run: `… 1 parametry opraveny` (`PX EA_MenuClick`) → restart → **Stav bridge dialog funguje** (identita = název DB, whitelist zatím prázdný, složka výměny default) | | Milošova hypotéza „receptions jinde / duplicitně“ vyloučena výpisem PX |
| 6.1a | Pumpa + recon **před configy** (dávka bez `repo`) | ⚠ recon-01: ops 1–6 ok, **op 7 (0 řádků) → `E_SQL`**, zbytek skipped = nález **N-B-2**; recon-02 (neomezené SELECTy nad `t_seclocks`) **visel** = nález **N-B-3** | | doloženo: security tabulky vč. `t_secusergroup`, 105 operací, 4 receptions, `#AI-LOG` v `<TEST-DB>` právě 1, **2 elementy AICodeBridge** (N-B-4) |
| 5 | Šest configů + `auditPkg` (5 souborů + FB_Config najednou) | ✅ položky doplnil bankovní Copilot podle promptu (vstupy Miloš: TEST_DB, WRITE_GROUP, KORP, záloha; odvozené GUID sandbox + GUID `#AI-LOG`); kontrola: identita 1× v každém, placeholdery 0, diagnostika bez chyb; RiskPolicy = DEV prahy (parita s domovem) + `deploy_src: BLOCKED`; OpsAllowed deny 6 op; + 2 opravené src (N-B-2) schránkou → bootstrap `0 zalozeno / 105 kod / 0 parametry` → restart EA → Stav bridge: whitelist s plnou cestou ✅, složka výměny = `<korp>` ✅ | ~18:20 | |
| 6.1b | Pumpa s configy | ✅ `Code loader: 105 operaci`, **`Session baseline … vytvoren nad: <…>.#FB-TEST | 2 preskocen (jiny repozitar!)` za ~10 s** | 18:25:52–18:26:02 | první bankovní číslo pro baseline politiku |
| 6.3 | Ping s `repo` + recon-03 | ⚠ 1. pokus: `<TEST-DB>` nenahrazen → **E_REPO** (správně fail-closed, rejected); 03b/03c ✅ done 7/7: identita ✅, whitelist `#FB-TEST` (hloubka cesty 3) ✅, `TOP 1` ✅ (dialekt), **záměrně prázdný dotaz → `ok / 0 / warning / raw`** (oprava N-B-2 živě ✅), `access = read` → Miloš write skupinu **neměl přiřazenou** → přidal → ping stále read (**cache členství = N-K8-8 potvrzeno v bance**) → plný restart EA + pumpy → ping-05 **`access: write`** ✅ | 18:30–18:50 | |
| A1 | První zápis (obdoba K8 A1): package pod `#FB-TEST` + UseCase řetězem `$0`, LOW | ✅ popup **ne**, Output `FB banka-A1 -> done: 2 ops (2 ok, 0 chyb)` + `[vytvoreno]` řádky s markery, **dvojklik označí UseCase i package**, **Artifact `FB banka-A1` v `#AI-LOG` z `auditPkg`** ✅, žádný dialog EA | ~19:05 | obsah v `#FB-TEST` zůstává do úklidu po POC |

## Doložená čísla (smí do vaultu)

| Co | Hodnota | Kde změřeno |
|---|---|---|
| EA | 17.1.6 build 1716 | ping `eaVersion` |
| Operace add-inu po bootstrapu | 105 | recon-01 `cnt`, konzole pumpy |
| Session baseline nad `#FB-TEST` | ~10 s | konzole pumpy 18:25:52 → 18:26:02 |
| `t_seclocks` | **1 450 469 řádků** (režim uživatelských zámků) | recon-03 `COUNT(*)` |
| `t_document.Version` | `nvarchar(50)` | recon-03 INFORMATION_SCHEMA |
| `t_document.DocName` / `DocType` / `ElementID` | `nvarchar(100)` / `nvarchar(100)` / `nvarchar(40)` | tamtéž |
| `t_document.BinContent` | `image` (2 147 483 647) | tamtéž |
| `t_document.DocDate` | `datetime` | tamtéž |
| Prázdný výsledek `SQLQuery` (MS SQL) | `<?xml version="1.0" encoding="UTF-16" standalone="no" ?>` + `<EADATA version="1.0" exporter="Enterprise Architect">` + `</EADATA>` — **bez `Dataset_0`, i s vyjmenovanými sloupci** | recon-01 op 7 `raw`, recon-03 op 2 `raw` |
| Security tabulky | `t_secgroup, t_secgrouppermission, t_seclocks, t_secpermission, t_secpolicies, t_secuser, t_secusergroup, t_secuserpermission, t_xrefsystem` | recon-01 op 2 |
| Aktivace add-inu v `t_xrefsystem` | 1× `GroupSettings` (na **read-only** skupinu — vrstva 1) + 2× `UserSettings` | recon-03 op 3 |
| Python / node v bance | 3.13 / **není** | Copilot |

## Nálezy (klasifikace: šablona · kanon · bridge · prostředí · banka · obsluha)

| # | Co se stalo | Klasifikace | Stav |
|---|---|---|---|
| **N-B-1** | Bootstrap zakládal reception `EA_MenuClick(Repository, MenuLocation, ItemName)` — Sparx broadcast má **4** argumenty (`… MenuName, ItemName`), EA je předává pozičně → do `ItemName` přišel název podmenu, každý klik = `Unhandled menu item: -AI Bridge`. Doma se neprojevilo (receptions z vendor šablony měly 4 parametry; bootstrap je dnes zakládal poprvé). | **bridge** (bootstrap) | ✅ `d53164c`: `EA_ARGS` opraveno + `syncEaParams` (existující receptions se přestaví, řádek `PX …`, souhrn `N parametry opraveny`), harness `KNOWN_ARGS` + test (247). Živě ✅ (PX 1×, menu funguje). |
| **N-B-2** | **Každý prázdný výsledek `query` končil `E_SQL` a shodil zbytek dávky** — EA na MS SQL vrací pro 0 řádků obálku `<EADATA>` bez `Dataset_0` **i s vyjmenovanými sloupci** (ne jen `SELECT *`, jak se čekalo po K8 K10). Detekce z 8. 9. („bez Dataset_0 = chyba“) tedy nedetekovala chybu, ale prázdno; recon, který nic nenajde, by v E2E zastavil celý běh. | **bridge** (kritický) | ✅ `47fdbb2`: obálka bez datasetu = `ok / rowCount 0` + `warnings[]` („EA nerozlišuje 0 řádků od chybného dotazu — ten se pozná dialogem SQL API Open FAILED“) + `raw`; `E_SQL` jen pro výjimku / prázdný řetězec / ne-XML text; `FB_UserAccess` totéž pravidlo (obálka = 0 skupin, ne „SQL selhal“); harness 248; PROTOKOL-EAFB §7. Živě ✅ (recon-03 op 2). **Otevřeno:** tvar odpovědi EA na skutečně chybný dotaz stále nezachycen v `raw`. |
| **N-B-3** | Dávka recon-01/02 měla dva **neomezené SELECTy nad `t_seclocks`** (doma prázdná; v bance **1,45 M řádků**) — EA sestavovalo XML minuty, pumpa „visela“ na `Zpracovavam`. Chyba návrhu dávky (Claude), ne bridge. | **kanon / kit + prostředí** | Lekce: v bance **každý SELECT s `TOP N` nebo selektivním `WHERE`**; do kontextu repa v korp. repu (`EA-Repozitar-Kontext-banka.md`, na který odkazuje profil buildu) doplnit **tabulku velkých tabulek a jejich řádů** (návrh Miloše). Kandidát bridge: strop `rowCount` u `query` (např. `maxRows`, výchozí 500, přes výstup hlásit ořez). |
| **N-B-4** | V `<TEST-DB>` jsou **dva** elementy `AICodeBridge`: jeden se stereotypem `JavascriptAddin` (letní, doplněn bootstrapem), druhý **bez stereotypu** v jiné package. Bootstrap správně vzal ten se stereotypem; `t_xrefsystem` má `UserSettings` na oba. | **banka / prostředí** | Kandidát úklid (smazat/označit druhý element) — rozhodne Miloš; bootstrap by měl při >1 nálezu varovat (kandidát). |
| N-B-5 | Členství ve write skupině je **cachované** v EA runtime i v běžící pumpě — po přidání do skupiny ping říkal `read`, dokud neproběhl plný restart EA **i pumpy**. | bridge (chování, známé N-K8-8) | Potvrzeno v bance; NAVOD blok 4/5.4/7.2 to říká — doplnit „i pumpy“ (NAVOD v1.1). |
| N-B-6 | `t_document.Version` = `nvarchar(50)`; automatický název session baseline `FB-AUTO <login> <session> <RRRR-MM-DD hh:mm:ss>` má ~46 znaků → u delších loginů hrozí ořez / chyba. | bridge (baseline politika) | Vstup pro zadání Baseline v1.2 (`sql-banka.md` B1 splněno). |
| N-B-7 | Aktivace add-inu ve `t_xrefsystem` je `GroupSettings` na **read-only** skupinu (Manage Add-Ins → Groups), write právo řídí `FB_AccessGroups` — tři vrstvy se nepletou. | banka (informace) | bez akce |
| N-B-8 | Obsluha: 2× nenahrazený placeholder (`<GUID-…>` v recon-01 → užitečná náhoda = 0 řádků; `<TEST-DB>` v recon-03 → E_REPO správně fail-closed), 1× nespuštěná pumpa. Příčina: instrukce „nahraď“ byla zahrabaná v odstavci. | obsluha / formát instrukcí | Od 18:40 blok **NAHRAĎ** pod každou dávkou; od 19:00 nástroj `tools\banka-dosad.py` (Copilot v bance) — placeholdery dosazuje strojově, validuje JSON a hlídá nenahrazené `<…>`. |
| N-B-9 | Kurýrní kanál: opravy z tohoto běhu (bootstrap, 2 src) přeneseny **schránkou** (Copy/Paste do VDI), ne pullem — kurýrní klon je za domácím HEAD o 2 commity. | kanál (odchylka) | Miloš: push z domova (`d53164c`, `47fdbb2` + docs commit) → v bance Pull kurýra před -5b, ať stavy sedí; korp. repo commit „adaptace banka v0.14“ (configy + opravy) a **smazat `src-bak\`**. |
| N-B-10 | Bankovní Copilot jako „výtahovač“ z `res-*.json` a jako editor configů podle promptu od Claude funguje spolehlivě a je jediná cesta, jak číst res bez opisování; v bance chybí `node` (harness nejde), Python 3.13 je. | prostředí | Pravidlo pro -5b: každý výsledek = prompt pro Copilota s explicitními poli + pravidlem `<skryto>`. |

## Co je doloženo živě na skutečné bankovní security (vrstvy §6g PROTOKOL-EAFB)

- **Vrstva 1** aktivace add-inu (Manage Add-Ins, Groups/Optional) ✅ — `GroupSettings` v `t_xrefsystem`.
- **Vrstva 2** write fíčury za `FB_AccessGroups` ✅ — nečlen `read` (ping reason), po zařazení + restartu obou runtime `write`; oprava `t_secusergroup` z 9. 9. v bance správná (tabulka existuje, členství se čte).
- **Vrstva 4** whitelist + identita ✅ — `E_REPO` při špatném `repo`, whitelist s plnou cestou, session baseline.
- Zápis LOW bez popupu, prokliky package i UseCase z Output tabu, audit do `#AI-LOG` podle `auditPkg` ✅.
- **Neověřeno (→ -5b):** vrstva 3 balíčková práva (A3-typ, hláška `@F002_Write`-typu), A2-typ v bance (`E_ADDIN_ACCESS` u nečlena — doloženo jen nepřímo pingem `read`), ELEVATED popup pumpy v bance, build `.github` profilem banka, E2E kola 1–9, T6-C.

## Část B — E2E, negativní testy, verdikt (Z260908-5b, 11. 9. 2026)

*Vlákno Z260908-5b (interaktivní, Miloš ve VDI, Claude doma nad `C:\GIT\ea-file-bridge`, HEAD před během `62b4b61`, harness 248/248). Kurýrní klon v bance **nepullován** (stav = v0.14 + opravy `d53164c`/`47fdbb2` přenesené schránkou 10. 9.); korporátní repo má commit „adaptace banka v0.14“.*

### B0 — kit `.github` v bance (krok 1 promptu; nouzová cesta 1c)

Build v bance **neproběhl** — kanon skillů (`Skilly\`) v bance není. Kit v korp. repu = thin build **v0.13** (`23a225b`, 7. 9.) z importu, tj. s **domácími hodnotami** (`repo: EAEXAMPLE.QEA`, domácí GUID whitelistu, dialekt sqlite, „zakázané operace: žádné“) a **bez pravidla TOP N** (N-B-3 vzniklo až 10. 9.). Postup:

1. Doma thin build profilem banka s placeholdery (`<TEST-DB>`, `<GUID-SANDBOX>`, dialekt mssql, denyOps z example profilu) → `docs/e2e-banka/ready/kit-thin-banka/build-placeholder.log` (60 souborů, sweep 0 neošetřených, AK-1 = 1/1/2/8/60).
2. Diff proti kitu v0.13: **12 souborů** se liší; pro běh podstatné jen **3** (`copilot-instructions.md` body 1/3/4/9, `skills/eafb-bridge/SKILL.md` krok 2 + pravidlo TOP N + „0 řádků ≠ chyba“, `skills/eafb-bridge/references/EAFB-Pravidla-Agenta.md` „0 řádků není chyba“); zbylých 9 = kosmetika („EA MCP“ → „operace ea-file-bridge“, řádek `E_SQL` v tabulce chyb, TOP N v `qa-checklisty.md`, terminál v agentovi) — v bance **neaktualizováno** (nález N-B-11).
3. Tři soubory přeneseny **schránkou** do VDI (kopie s placeholdery = `ready/kit-thin-banka/`), placeholdery dosadil **bankovní Copilot** z `config\banka-hodnoty.json`: 2 soubory × 2 náhrady (v `EAFB-Pravidla-Agenta.md` placeholder nebyl), seznam zakázaných operací srovnán s `FB_OpsAllowed` v korp. repu = **6 deny operací** (`delete_from_model`, `delete_taggedvalue_from_model`, `remove_elements_from_diagram`, `clone_package`, `clone_elements`, `deploy_src`); kontrola „žádný `<…>` mimo ilustrativní značky dokumentace“ ✅. Copilot uvedl kontrolní kód `SA-KIT-VSC-Q9M` (instrukce workspace načteny už při editaci).
4. `--verify` v bance nespuštěn (Python je, ale kit není z buildu — hlásil by nesoulad sha256 u 3 souborů = očekáváno).

### B1 — Tabulka kol (E2E `/e2e-f0-f1`, zadání `zadani\DBK-hodnot-knihu-brd.md`, stejné jako doma 7. 9.)

| Kolo | Co | Dávka id | Output řádek (ACK) | Popup / klik | Opravná | Allow dialog | Kontext % | Poznámka |
|---|---|---|---|---|---|---|---|---|
| 0 | příprava | — | — | — | — | — | 0 | pumpa jediná, `Code loader: 105 operaci`, session baseline nad `#FB-TEST` ~12 s (2 přeskočeny, jiný repozitář); VS Code nad `<korp>`, agent `sa-analytik` ✅, model **Claude Opus 5** (stejný jako doma; Miloš zvažoval Sonnet 5 kvůli kreditu — rozhodnuto pro srovnání 1:1) |
| 1 | ping | 20260911-01 | `done: 1 ops (1 ok, 0 chyb)` | — | — | 0 | | kód `SA-KIT-VSC-Q9M` ✅ v první větě; repo sedí, whitelist `#FB-TEST` jediná větev, `access: write`, login z pingu neprázdný → razítko `AI-User` = login (N7 doma se tu neobjevilo) |
| 2 | převzetí zadání (recon 0) | — | — | — | — | 0 | | 3/3 požadavky ✅ (Must, ICT impact Yes), hranice dle BRD, „SOS/Core UC nedostupné“ vykázáno; UC pojmenován „Ohodnotit knihu“ (jako doma); **agent se sám zeptal, zda `Business Requirements` pod `#FB-TEST` existuje** (poučení N1 propsané v kitu) — odpověď: neexistuje |
| 3 | Business Requirements + 3 Req | 20260911-02 | `done: 2 ops (2 ok, 0 chyb) risk=LOW writeOps=4 createOps=4 affectedPackages=1` | ne ✅ | — | 0 | | **LOW bez popupu (doma ELEVATED kvůli `matchByName` — oprava kanonu ověřena)**; `[vytvoreno]` package + 3 elementy s prokliky |
| 4a | QA F0 čtení + recon (UC counter, aktéři, vzor typování) | 20260911-03 | `done: 7 ops (7 ok, 0 chyb)` | — | — | 0 | | recon přibalen do QA dávky ✅ (dle SKILL kolo 4); vzor typování z modelu potvrzen (`MDGDgm=CSOB-ITAN::Version Root Diagram`, `FA-Behavioral`); větev obsahuje jen `#QA`, `Business Requirements`, cizí `POC banka A1` — žádný UC/UCR/aktér |
| 4b | QA F0 report | 20260911-04 | `done: 7 ops (7 ok, 0 chyb) risk=LOW writeOps=2 createOps=2 affectedPackages=1` | ne ✅ | — | 0 | 13 | verdikt **pass s W** (B=0, W=3, I=2); `#QA` v téže dávce ✅ |
| 5 | návrh UC (bez dávky) | — | — | — | — | 0 | 13 | kód `UC-PRAVIDLA-R4T` ✅ · aktér Návštěvník (nový; ACTORS package ve větvi není) · 1 UC „Ohodnoť knihu“ → na pokyn „Hodnoť knihu“ (jako doma) · **číslo UC-91001**: větev prázdná → pravidlo „max+1“ nemá výchozí hodnotu, agent vzal řadu z příkladů kanonu a doložil dotazem, že rozsah 5xxxx–9xxxx v modelu není obsazen (nejvyšší skutečné UC šestimístné) → N-B-12 |
| 6 | kostra UC | 20260911-05 | `done: 11 ops (11 ok, 0 chyb) risk=LOW writeOps=16 createOps=9 affectedPackages=1` | ne ✅ | — | 0 | | **1 řetězená dávka, LOW bez popupu** (doma totéž): package `UC-91001 Hodnoť knihu` → UseCase (kompozitní diagram) → `UCR-91001` → aktér Návštěvník → Boundary `Databáze knih (DBK)` → `version_UC-91001 …` → 2 konektory → umístění 3+3 → reload → 2 čtecí dotazy (readback). **Čtecí dotaz nad `t_connector` JOIN `t_object` trval pumpě déle, než agent čekal** → agent správně nepřeposlal, ohlásil „čekám na ACK“ a poprosil o pohled na pumpu; po větě „odpověď už existuje“ pokračoval → N-B-13. Provedeno **1×** (jedna pumpa; doma 2× kvůli dvěma pumpám) |
| 7 | scénáře + constrainty + BRU + trace | 20260911-06 | `confirm_required (…scenarios/constraints/requirements … ELEVATED)` → `done: 4 ops (4 ok, 0 chyb) risk=ELEVATED writeOps=13 createOps=3 updatedExisting=3 affectedElements=4 affectedPackages=1` | **Ano** | — | 0 | | warnings **0** (join EF-1 → 3/konec, EF-2 → 2/1 ověřeny readbackem); **po kliknutí Ano musel Miloš napsat „pokračuj“** — agent přestal čekat na finální ACK dřív, než člověk potvrdil (N-B-13, stejná příčina jako kolo 6); popup „EA File Bridge – potvrzeni davky 20260911-06“: `CEKA NA POTVRZENI (Risk Gate ELEVATED)` / `Chysta se vytvorit 3 a upravit 3 prvku.` / Prvky: UC-91001 + DEMO-91051/52/53 / `Proc potvrzeni: Operace 'create_or_update_scenarios' je politikou klasifikovana ELEVATED (+ 2 dalsi duvod/y - viz res soubor)` / otisk + `zapisu 13` |
| 8a | QA F1 čtení | 20260911-07 | `done: 8 ops (8 ok, 0 chyb)` | — | — | 0 | | MS SQL dialekt (TOP N) bez chyby, **žádný modální dialog EA** (doma N2 = chybný sloupec); constrainty/scénáře/BRU/konektory přečteny |
| 8b | QA F1 report | 20260911-08 | `done: 1 ops (1 ok, 0 chyb) risk=LOW writeOps=1 createOps=1 affectedPackages=1` | ne ✅ | — | 0 | 21 | verdikt **pass s W** (F1 7/9): **B = jen 6/6b** ✅ (LS mimo řez); W: 2b CRUD (Kniha jen R, Hodnocení C+R — zdůvodněno BRU), 6c aktér lokálně v UC package (ACTORS ve větvi není); W F0: 1c umístění pod `#FB-TEST`, 1d BRQ brána (vstup BRD), mantinely SOS/Core UC neexistují — vše zdůvodněno, shodné s domácím během (N9) |
| 9 | Gate Record G1 | 20260911-09 | `done: 2 ops (2 ok, 0 chyb) risk=LOW writeOps=2 createOps=2 affectedPackages=1` | ne ✅ | — | 0 | **22** | `#GATES` založena v téže dávce ✅ + Artifact `GR-G1 DBK 2026-09-11` (TV gate/datum/rozhodl/vysledek/tier=A); souhrn agenta úplný (rozpočet, QA, GUID + cesta UC package, kontrolní kódy, 5 ručních kroků, 5 lekcí) |
| **Σ** | | **dávek = 9** (01–09), žádný úklid prostředí | | **ELEVATED = 1** (06, potvrzeno 19:16:13) | **opravných = 0** | **Allow = 0** | **max % = 22** (219 K z 1 M; doma 13 % = jiná metrika ukazatele) | Copilot „Session Cost“ ≈ 1 620 kreditů za celý běh (Opus 5) |

Souhrn agenta na konci (zkráceno): 9 dávek z 10, 0 opravných, 1 ELEVATED, 0 warningů, 0 QC nálezů; QA F0 pass s W (B=0, W=3, I=2), QA F1 pass s W (B=2 = 6/6b záměrně, W=2, I=2); výstup `#FB-TEST/UC-91001 Hodnoť knihu` (UseCase s kompozitním FA-Behavioral diagramem, UCR-91001, aktér Návštěvník, System Boundary, naplněný version root diagram, 3 scénáře BE + 2 EF s ukotvením a návratem, 4 constrainty, 3 lokální BRU, 3 traceability konektory na DEMO-91051/52/53); kódy SA-KIT-VSC-Q9M + UC-PRAVIDLA-R4T; ruční kroky: Auto Name Counter na 91002, přesun z `#FB-TEST` do ostré větve (`move_elements` = ELEVATED), logická obrazovka v plné F1, ACTORS package + přesun aktéra, kontrola v Infoportu + commit `requests\`/`responses\`. **Lekce, které agent sám správně pojmenoval pro kanon:** (a) rekurzivní CTE vrací prázdnou `<EADATA>` obálku (vypadá jako 0 řádků) → podstrom číst vnořenými poddotazy; (b) `WHERE` přes jméno na joinu `t_connector JOIN t_object` visel minuty, `WHERE c.Start_Object_ID = …` okamžitě → na velké tabulky filtrovat po ID; (c) zápisy v dávce před dotazy (dávka 05 visela jen na readbacku, scaffold už byl zapsán); (d) `Realisation` (kanonická hodnota `t_connector.Connector_Type`) vs `Realization` v `emr-zapis-pravidla` §5 = zavádějící; (e) `join` na číslo kroku funguje (readback ukazuje GUID cílového kroku).

### B2 — AK-6 / AK-7 / AK-8

| AK | Kritérium | Limit | Naměřeno | ✅/❌ |
|---|---|---|---|---|
| AK-6a | dávek celkem | ≤ 10 | **9** (doma 10 + 1 úklid) | ✅ |
| AK-6b | opravných dávek | ≤ 2 | **0** (doma 1) | ✅ |
| AK-6c | ELEVATED potvrzení | právě 1 (kolo 7) | **1** (dávka 06, kolo 7) — doma 3; oprava kanonu N1 (`matchByName`) v bance potvrzena | ✅ |
| AK-6d | QA F0 | pass | pass s varováními (B=0, W=3, I=2) | ✅ |
| AK-6e | QA F1 | pass s W, jediné B/W = 6/6b | pass s W; **B = jen 6/6b** ✅; W navíc 2 (2b CRUD, 6c aktér) — obě zdůvodněná, důsledek zadání protokolu (jediná whitelist větev) | ✅ s výhradou (jako doma) |
| AK-6f | Gate Record G1 zapsán | ano | ano — `#GATES` v téže dávce, TV gate/datum/rozhodl/vysledek/tier | ✅ |
| AK-6g | Allow / Continue dialogy | 0 | **0** (doma 1 nezdokumentovaný) | ✅ |
| AK-7a | kód `SA-KIT-VSC-Q9M` v první odpovědi | ano | ano, první věta (i při editaci kitu v B0) | ✅ |
| AK-7b | kód `UC-PRAVIDLA-R4T` v kole 5 | ano | ano | ✅ |
| AK-8 | ukazatel kontextu, maximum (bez `/compact`) | ≤ 60 % | **22 %** (219 K / 1 M tokenů; kolo 4 = 13 %, kolo 8 = 21 %, kolo 9 = 22 %) | ✅ |

Verdikt tenkého řezu v bance: ☒ **prošel** (bez výhrad k AK; nálezy jen pro kanon/kit a prostředí — viz B5). Proti domácímu běhu 7. 9.: méně dávek (9 vs 10), žádná opravná, jediné ELEVATED, žádný Allow dialog, žádný modální dialog EA, jediná pumpa; navíc 2 ruční zásahy do chatu mimo dávky („odpověď už existuje“ v kole 6, „pokračuj“ v kole 7) = N-B-13.

### B3 — Negativní testy (A2-typ, A3-typ) — vrstvy 2 a 3 na skutečné bankovní security

Postup s dvěma restarty: A3a (package pro zámek, ještě jako člen) → Miloš: dočasné členství v pomocné skupině, **Group Lock** na package `POC banka A3 zamceny (balickova prava)` na tuto skupinu, odebrání sebe z pomocné skupiny **i** z write skupiny → plný restart EA + pumpy → A2 → zpět do write skupiny → restart → ping + A3b. Dávky: `docs/e2e-banka/ready/req-banka-A3a.json`, `req-banka-A2-write.json`, `req-banka-A2-read.json`, `req-banka-A2-ping-zpet.json`, `req-banka-A3b.json` (placeholder `<GUID-A3>` dosadil bankovní Copilot z `res-banka-A3a.json`, zbytek `banka-dosad`).

| Test | Očekávání | Výsledek | Doklad |
|---|---|---|---|
| A3a | package pod `#FB-TEST` (LOW) | ✅ `done: 1 ops`, Group Lock nastaven (ikona zámku) | Output řádek, browser |
| **A2 write** | nečlen write skupiny → `E_ADDIN_ACCESS`, nic neprovedeno, bez popupu | ✅ Output `FB banka-A2-write -> E_ADDIN_ACCESS (<login>: uzivatel neni clenem zadne write skupiny dle FB_AccessGroups (<WRITE-GROUP>) - cteci operace funguji)`; res: `status error`, `code E_ADDIN_ACCESS`, `results[0].status skipped (op create_or_update_package)`; package `POC banka A2 NESMI VZNIKNOUT` **nevznikla** (výčet packages pod `#FB-TEST` = 6, bez A2) | `res-banka-A2-write.json` (výtah Copilotem) |
| A2 message | bez zdvojeného „cteci operace funguji“ | ✅ `Zapisove ficury bridge nejsou pro uzivatele '<login>' povolene (EA security skupiny, FB_AccessGroups): uzivatel neni clenem zadne write skupiny dle FB_AccessGroups (<WRITE-GROUP>) - cteci operace funguji O zarazeni do write skupiny pozadej spravce EA. Nic nebylo provedeno.` — zdvojení pryč (dc59dc3 ✅); **kosmetika: chybí oddělovač („. “) mezi reason a větou „O zarazeni…“** (N-B-16) | tamtéž |
| **A2 read** | ping + query nečlenovi projde, `access: read` | ✅ `done: 2 ops (2 ok, 0 chyb)`; `securityEnabled true`, `access read`, `groups` = 5 skutečných skupin uživatele (bez write skupiny), `reason` = tatáž věta; `rowCount 6` (TOP 20 pod sandboxem) | `res-banka-A2-read.json` |
| ping po návratu | `access: write` po plném restartu EA + pumpy | ✅ `done: 1 ops`, `access.level write`, `reason: clen write skupiny dle FB_AccessGroups` | `res-banka-A2-ping-zpet.json` |
| **A3b** | zápis UC do package s Group Lock skupiny, jejímž není členem → `E_PERMISSION` + syrová hláška EA | ✅ Output `FB banka-A3b -> error: 1 ops (0 ok, 1 chyb) \| risk=LOW writeOps=1 createOps=1 …` (**bez popupu**, LOW = gate prošel, zastavila až EA security); res: `status error`, `code E_PERMISSION`, `results[0].status error`; UC v zamčené package nevznikl | `res-banka-A3b.json` |

**Syrová hláška EA v bance (A3b, doslova z `message` za „Puvodni hlaska EA:“):** `Cannot create new UseCase. The parent package is locked by Project Security.` — **shodná s domácím vzorem z K8 QEAX 9. 9.** (EA 17.1.5 SQLite vs. 17.1.6 MS SQL). Chytila ji **přesná větev** `FB_InterpretError` (text „Nemas balickova prava k cili zapisu - EA security (package zamcena na skupinu / rezim Require User Lock to Edit), plati i pres API. Toto NENI chyba bridge: …“), ne obecná větev → **žádná změna kódu není potřeba**, vzor z 9. 9. platí i na MS SQL. Varianta „package permissions bez zámku“ se v EA security neliší (práva k package se v EA realizují zámky), samostatně netestováno.


### B4 — T6-C (velikost baselines v `<TEST-DB>`, `sql-banka.md` B3)

Dávka `ready/req-banka-T6C.json` (13. 9., `done: 2 ops`): `SELECT TOP 20 … DATALENGTH(BinContent)/1048576.0 … WHERE DocType = 'Baseline' ORDER BY DocDate DESC` + součet. Čísla (bez názvů packages):

| Co | Hodnota |
|---|---|
| Baselines v `<TEST-DB>` celkem (`DocType = 'Baseline'`) | **2 021** |
| Součet `DATALENGTH(BinContent)` | **0,88 MB** |
| Největší baseline | **0,66 MB** |
| Session baselines bridge (`FB-AUTO …`, 8 z posledních 20; 10. 9. 2×, 11. 9. 1×, 13. 9. 3× + 2 starší ze srpna) | **0,00–0,03 MB** každá (nad `#FB-TEST` s obsahem z E2E ≈ 0,03 MB) |
| Ostatní posledních 20 (ruční baselines leden–březen 2026) | 0,00–0,15 MB |
| Doba dotazu | řádově sekundy (TOP 20 + agregace přes `t_document`) |

Závěr T6-C: v testovacím repozitáři je objem baselines zanedbatelný (2 021 ks < 1 MB); jedna session baseline bridge nad malou větví ≈ 30 KB → **baseline politika (session baseline při každém startu pumpy) v bance neškodí**, roste lineárně s počtem startů (3 starty za jeden večer = 3 baselines). Produkční repozitář neměřen. Vstup pro Baseline v1.2: úklid starých `FB-AUTO` baselines zůstává kandidát (počet, ne velikost).

### B5 — Nálezy části B (N-B-11+)

| # | Co se stalo | Klasifikace | Stav |
|---|---|---|---|
| N-B-11 | Kit `.github` v bance není z buildu: kanon v bance chybí, kit = import thin v0.13 s domácími hodnotami a bez TOP N; adaptace 3 souborů schránkou + Copilot (viz B0), 9 souborů kosmetiky neaktualizováno. `--verify` by hlásil nesoulad sha256. | kanál / prostředí | Otevřeno: kanon (nebo hotový build profilem banka s placeholdery + dosazení `banka-dosad` i pro `.github\`) přenést kurýrem; do té doby je kit v bance ručně udržovaný. |
| N-B-12 | Pravidlo čísla UC „nejvyšší obsazené `UC-#####` v cílové větvi + 1“ nemá výchozí hodnotu pro **prázdnou větev** (`#FB-TEST` v bance žádný UC neměl). Agent zvolil `UC-91001` (řada z příkladů kanonu) a sám dotazem doložil, že rozsah 5xxxx–9xxxx v modelu není obsazen (skutečné UC banky mají šestimístná čísla). Výsledek správný, ale rozhodnutí bylo agentovo, ne pravidla. | kanon (`emr-scaffold`, `e2e-f0-f1`) | Doplnit do pravidla výchozí číslo pro prázdnou větev (např. začátek testovací řady) + požadavek doložit nekolizi dotazem nad celým modelem, jak agent udělal. |
| N-B-13 | **Agent čeká na `res-<id>.json` kratší dobu, než v bance trvá (a) čtecí dotaz nad velkou tabulkou, (b) potvrzení ELEVATED člověkem.** Kolo 6: readback `t_connector JOIN t_object WHERE … Name = …` trval pumpě minuty (filtr přes jméno na joinu, ne přes ID); agent správně **nepřeposlal**, ohlásil „čekám“ a poprosil o pohled na pumpu; po větě „odpověď už existuje“ pokračoval. Kolo 7: po kliknutí Ano musel Miloš napsat „pokračuj“. Kit říká „neexistuje-li odpověď do ~30 s, ohlas, že pumpa neběží“ — v bance zavádějící. Stálo 2 věty v chatu, 0 dávek. | kit (`eafb-bridge` krok 3, `e2e-f0-f1` kolo 7) + kanon (SQL) | Kit: čekací pravidlo rozdělit — čtecí dávka v bance až minuty (neposílat znovu, zeptat se uživatele, zda pumpa stojí na `Zpracovavam`), ELEVATED = čekej bez limitu na člověka. Kanon: **na velké tabulky filtrovat po ID (`Start_Object_ID`, `Package_ID`), ne po jméně na joinu**; zápisy v dávce před dotazy (agentova lekce c). Bridge kandidát: strop `rowCount`/timeout dotazu s hlášením. |
| N-B-14 | **Rekurzivní CTE (`WITH … UNION ALL … JOIN`) vrací v bance prázdnou `<EADATA>` obálku** — od `47fdbb2` je to `ok / 0 řádků + warning`, tj. **selhaný dotaz nerozlišitelný od prázdna** (přesně otevřený bod z N-B-2). Agent to sám rozpoznal a přešel na vnořené poddotazy. `sql-banka.md` B4 („CTE v bance neověřeno“) tím rozhodnuto: **nepoužívat**. | bridge (známé omezení EA SQL API) + kanon | `sql-banka.md` B4 označit jako nefunkční v bance (podstrom přes `Parent_ID IN (…)` / vnořené poddotazy). Warning u prázdna zůstává jediná stopa — kit už říká „ověř sloupce, u nejistého SELECT *“; doplnit „žádné CTE“. |
| N-B-15 | Konvence `emr-zapis-pravidla` §5 píše typ konektoru `Realization`, EA kanonická hodnota `t_connector.Connector_Type` je **`Realisation`** (britský pravopis; doloženo i v `qc-verzovani.sql`). Bridge přijal `Realization` a konektory vznikly správně (3 traceability vazby ověřeny readbackem), agent ale nejistotu vykázal jako lekci. | kanon (`emr-konvence`) | Sjednotit na `Realisation` v pravidlech + poznámka, že bridge/EA API tolerují obě. |
| N-B-16 | Text `E_ADDIN_ACCESS`: mezi `reason` („… - cteci operace funguji“) a pevnou větou „O zarazeni do write skupiny pozadej spravce EA.“ chybí oddělovač („. “). Zdvojení „cteci operace funguji“ (K8) je pryč. | bridge (kosmetika `FB_Main`) | Kandidát: oddělovač; harness test na 1 výskyt zůstává. |
| N-B-17 | Pozitivní: **`FB_InterpretError` přesný vzor balíčkových práv z K8 QEAX (9. 9.) platí beze změny na MS SQL v bance** — hláška EA „Cannot create new UseCase. The parent package is locked by Project Security.“ je totožná. Vrstva 3 doložena živě; **žádný fix kódu**. Zbývá neověřen jen tvar hlášky pro `Package` („Cannot create new Package.“ — odvozeno) a režim Require User Lock to Edit (v bance režim uživatelských zámků = jiný text možný). | bridge (potvrzení) | bez akce |
| N-B-18 | Kontext Copilotu v bance se měří z okna 1 M tokenů (22 % = 219 K), doma 7 K ukazatel (13 %) — **AK-8 není mezi běhy přímo srovnatelné číslem, jen splněním limitu**. Cena běhu: ≈ 1 620 „kreditů“ Copilot (Opus 5) za 9 dávek + kolo 0. | prostředí / metrika | Do zadání AK-8 doplnit „procento z aktuálního okna modelu“; pro banku uvádět i absolutní tokeny. |

### B6 — Verdikt POC a Fáze 3

**POC EA File Bridge v bance: PASS s nálezy.** Doloženo živě na testovacím repozitáři banky (MS SQL 2022, EA 17.1.6, security zapnutá, režim uživatelských zámků), bez jediné změny kódu bridge v části B:

- **Funkčně:** tenký řez F0 → F1 (`/e2e-f0-f1`) prošel **bez výhrad k AK-6/7/8** — 9 dávek, 0 opravných, 1 ELEVATED, 0 warningů, 0 Allow dialogů, 0 modálních dialogů EA, kontext 22 %; výsledek v modelu úplný (UC package s diagramy, scénáře s join, constrainty, BRU, traceabilita, QA F0/F1, Gate Record G1). Proti domácímu běhu 7. 9. lepší ve všech měřených bodech — opravy kanonu ze 7. 9. (N1–N3) a bridge z 8.–10. 9. (v0.13/v0.14 + `47fdbb2`) se v bance potvrdily.
- **Bezpečnostně (§6g vrstvy):** vrstva 1 aktivace (část A) ✅ · vrstva 2 write skupina — **A2 živě**: nečlen `E_ADDIN_ACCESS`, nic neprovedeno, čtení funguje ✅ · vrstva 3 balíčková práva — **A3 živě**: Group Lock cizí skupiny → `E_PERMISSION` s doslovnou hláškou EA, UC nevznikl, vzor z K8 platí ✅ · vrstva 4 whitelist/identita (část A) ✅ · Risk Gate: LOW bez popupu, ELEVATED právě tam, kde má být, popup s výčtem prvků a důvodem ✅.
- **Provozně:** jedna pumpa, session baseline ~10–12 s a ~30 KB (T6-C), `banka-dosad` + bankovní Copilot jako výtahovač = žádný únik interních hodnot, žádná chyba obsluhy s placeholdery (proti 2 v části A).

**Nálezy nejsou blokující:** N-B-11 (kit v bance ručně udržovaný — kanál), N-B-12/13/14/15 (kanon a kit: výchozí číslo UC, čekání agenta, CTE, `Realisation`), N-B-16 (kosmetika hlášky), N-B-18 (metrika). Žádný nález bridge kritické třídy (proti části A: N-B-1, N-B-2).

**Fáze 3: GO.** Podmínky pro další krok (ne pro verdikt): (1) kurýrem přenést kanon nebo hotový build profilem banka, aby kit v bance vznikl z buildu s `--verify` (N-B-11); (2) zapracovat N-B-12…15 do kanonu před dalším bankovním během; (3) úklid `#FB-TEST` a odemčení A3 package (ruční kroky Miloše, delete je v deny). Otevřené z části A trvají (druhý element AICodeBridge, strop rowCount, tvar `raw` chybného dotazu — dnes N-B-14 ukázal, že chybný dotaz se tváří jako prázdno).

**Úklid `#FB-TEST` v bance (ruční, Miloš — `delete_from_model` je v deny):** packages z běhů: `POC banka A1 (clen write skupiny)` (10. 9.), `Business Requirements`, `#QA`, `UC-91001 Hodnoť knihu`, `#GATES` (11. 9.), `POC banka A3 zamceny (balickova prava)` (13. 9.; **před smazáním odemknout** — vyžaduje dočasné členství v pomocné skupině zámku, pak skupinu zrušit); package A2 nevznikla. Audit Artifacty `FB <id>` v `#AI-LOG` (9 + 6 dávek) ponechat nebo smazat dle politiky auditu. Alternativa: nechat obsah jako referenční ukázku pro 22. 9.

## Commity z tohoto běhu (domácí repo, push dělá Miloš)

- `d53164c` fix(bootstrap): reception EA_MenuClick se 4 parametry (MenuName) + sync parametru existujicich EA_* receptions — harness 247
- `47fdbb2` fix(bridge): obalka <EADATA> bez Dataset_0 = 0 radku (ok + warning + raw), ne E_SQL; FB_UserAccess totez — harness 248
- docs(banka): tento protokol + dávky `docs/e2e-banka/ready/` + PROTOKOL-EAFB §7 + zápřah -5b
- `5470e34` (výše) · `da15de2` NAVOD v1.1
- Část B (13. 9.): docs(banka): protokol POC banka 2026-09-10 část B + Fáze 3 verdikt — bez změny `src/` (N-B-17), harness 248/248 před i po; dávky `ready/req-banka-A2-*.json`, `req-banka-A3*.json`, `req-banka-T6C.json`, kit `ready/kit-thin-banka/`
