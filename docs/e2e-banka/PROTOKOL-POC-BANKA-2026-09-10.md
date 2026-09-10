# POC EA File Bridge v bance — protokol 2026-09-10 (Z260908-5, část A: nasazení)

*Vlákno Z260908-5 „podpora banky živě“ (interaktivní, Miloš v bance vzdáleně, Claude doma nad `C:\GIT\ea-file-bridge`). Repozitář: **`<TEST-DB>`** (MS SQL Server 2022, EA 17.1.6 build 1716, security zapnutá, režim uživatelských zámků). Kód: tag **v0.14** = `75534f1` + dva opravné commity z tohoto běhu (`d53164c`, `47fdbb2`). Tento soubor nese **žádné interní hodnoty banky** — název DB, GUIDy bankovního modelu, ID prvků, loginy, názvy skupin a cest jsou nahrazeny placeholdery `<…>`.*

> **Stav:** část A (nasazení, bloky 1–6 + první zápis) **HOTOVA 10. 9. 2026 večer — PASS s nálezy**. Část B (build `.github` v bance, E2E `/e2e-f0-f1` kola 1–9, negativní testy A2/A3-typ, T6-C, verdikt POC a Fáze 3 GO/NO-GO) = navazující vlákno **Z260908-5b** (prompt v `IT-ANALYSIS/zaprah-vlaken-2026-09-08.md`).

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

## Část B — E2E (vyplní Z260908-5b)

*(tabulka kol 1–9 jako v `docs/e2e-vscode/PROTOKOL-E2E-VSCODE.md`, AK-6/7/8, negativní testy A2/A3-typ, T6-C, verdikt POC PASS / PASS s nálezy / FAIL, Fáze 3 GO/NO-GO)*

## Commity z tohoto běhu (domácí repo, push dělá Miloš)

- `d53164c` fix(bootstrap): reception EA_MenuClick se 4 parametry (MenuName) + sync parametru existujicich EA_* receptions — harness 247
- `47fdbb2` fix(bridge): obalka <EADATA> bez Dataset_0 = 0 radku (ok + warning + raw), ne E_SQL; FB_UserAccess totez — harness 248
- docs(banka): tento protokol + dávky `docs/e2e-banka/ready/` + PROTOKOL-EAFB §7 + zápřah -5b
