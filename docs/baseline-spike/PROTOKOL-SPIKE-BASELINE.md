# Baseline politika — prerekvizity T6-W4 / T6-B1 / T6-S / T6-C — klikací protokol

Datum přípravy: 2026-09-04 (vlákno Z260904-2, dávka `IT-ANALYSIS/zaprah-vlaken-2026-09-04.md`) · **Proveden: pondělí 7. 9. 2026, 10:50–12:00, živě ve vlákně Z260904-2b (Miloš u EA + Claude čte `responses\`)** · Repozitář: `EAExample.qea` (eaexample, EA 17.1.5 build 1715) · Kód při běhu: HEAD `1da3d8c` (origin/main `361e2f2`), harness 223/223 — **protokol nic nenasazoval, `src/` se neměnil**; commit tohoto vlákna nese jen `docs/baseline-spike/`.
Zadání: `IT-ANALYSIS/Zadani-EA-File-Bridge-Baseline-Politika.md` v1.1 §9 (řádky T6-S / T6-W4 / T6-B1 / T6-C) + §11 bod 4 → výsledky propsány do **v1.2**; dispozice Miloše bod 8 v `IT-ANALYSIS/audity/RedTeam-Zadani-Baseline-Politika-2026-08.md`. Nahrazuje nikdy nespuštěné vlákno 2 dávky `zaprah-vlaken-2026-08-21d.md` (rozklad T6-S/T6-C převzat, doplněno T6-W4 a T6-B1).
Průběžný záznam s hodnotami z každého res souboru: `vysledky/ZAZNAM-2026-09-07.md`; výstupy spiku: `vysledky/T6S-pumpa-20260907-113418.txt`, `vysledky/T6S-pumpa-20260907-114714.txt`; dávky s dosazenými GUIDy: `ready/`.

## VÝSLEDKY 2026-09-07

| Krok | Co se ověřuje | ✅/❌ | Naměřeno / doklad |
|---|---|---|---|
| K0 | start pumpy, session baseline | ✅ | pumpa v0.5 10:50:14, Code loader 105, `FB 2026-09-07 10:50:15` nad #FB-TEST |
| K1–K3 | **T6-W4**: schéma, SELECT (package GUID, version), křížová kontrola | ✅ | `res-20260907-S01-w4-schema.json` results[0] DDL: všech 11 sloupců `t_document` existuje (SQLite `TEXT`, bez délky); `res-20260907-S02-w4-enum.json` results[0] DocType literál `Baseline` (41), results[2] join `t_package.ea_guid = t_document.ElementID` 41/41, results[4] osiřelé 0; API × SQL 40 × 40, `guid` = `DocID`, `version` = `Version` u všech |
| K4–K8 | **T6-B1**: C0/C1/C2, verdikt | ✅ | C0 40 (`res-…S03`), C1 41 (`res-…S04`, nová `FB 2026-09-07 10:58:46`), C2 41 (`res-…S05`) → **příznak `_fbSessionStarted` v EA runtime přežívá**, b1b (týž dialog) = b1c (nový dialog) |
| K9 | GUI fallback bez session baseline (volitelné) | ✅ | `res-20260907-S06-b1-gui-ping.json` done 11:25:45 při vypnuté pumpě; Baseline manager = 41 (beze změny) |
| K10–K12 | pojistka, FBT-SPIKE ×3, formát `date`, délka `version` | ✅ | `res-…S07` 3/3 s `baselineGuid`; `res-…S08` results[1] lenVersion **255 / 300** (neořezáno), `DocDate` `2026-09-07 11:30:27`; results[0] `date` = "" — **atribut `date` v XML `GetBaselines` neexistuje** (raw S01: jen `name, version, notes, guid`) |
| K13–K14 | **T6-S** z pumpy: STAV 1/2/3 | ✅ **STAV 1** | `vysledky/T6S-pumpa-20260907-113418.txt`: A) `typeof = unknown`, B) `DeleteBaseline("{32798739-…}") vratil: true`, D) 45 (před 46), cíl pryč; `res-…S09` — řádek chybí v API i v `t_document`; 2. běh `…-114714.txt` len300: true, 43 (před 44) |
| K15–K16 | T6-S z EA runtime (proxy) | ✅ | Scripting/JavaScript výstup: `A) typeof = function`, `B) vratil: true`, `C) 44 (pred 45); cil JE PRYC`, `VERDIKT: z EA runtime MAZE`, **`KONEC` vypsán**; `res-…S10` len255 pryč v API i SQL |
| K17–K22 | **T6-C** stavba a velikosti | — | **NEPROVEDENO doma (rozhodnutí Miloše 7. 9.)** — kalibrace neovlivní žádné rozhodnutí stavby (prahy jsou shadow, dispozice 2) a banka by ji měřila znovu (MS SQL, odhad ≥10× pomalejší); T6-C zůstává **bankovní krok** |
| K23–K24 | kalibrační tabulka, subtreeMax | — | neprovedeno (viz výše); jediný domácí bod: baseline #FB-TEST (desítky prvků) ≈ 64 kB, FBT-ORPHAN (2 třídy) 1 802 B |
| K25–K27 | úklid, osiřelé baselines | ✅ | nahrazeno **mini-testem** (dávky `ready/req-20260907-S20…S23`): package FBT-ORPHAN + baseline {FC14940E-…} (`res-…S21`) → `delete_from_model` (`res-…S22` deleted:true) → `res-…S23` i čerstvá `res-…S19`: osiřelé **0**, řádek baseline v `t_document` **0**, #FB-TEST 43 baselines → **EA maže baselines spolu s package** (očekávání K26 se nepotvrdilo); FBT-SPIKE nezbyl žádný, FBT-CAL nevznikl |

**Čtyři verdikty (s doklady):**

1. **T6-W4 ✅ jde jedním SELECT.** Baselines drží `t_document` (`DocType = 'Baseline'`, `ElementID` = GUID package, `Version` = jméno baseline, `DocName` = jméno package, `DocDate` ISO `YYYY-MM-DD hh:mm:ss`, `BinContent` blob). Doklad: `res-20260907-S02-w4-enum.json` results[2] (41 řádků joinu) + křížová kontrola s `res-20260907-S01-w4-schema.json` results[1] (40 × 40, GUIDy i verze shodné). Osiřelé 0.
2. **T6-B1 ✅ oprava `FB_Process` NENÍ blokující prerekvizita.** C0 40 → C1 41 → C2 41: in-memory příznak přežívá mezi vyvoláními Add-in Search (i z nově otevřeného dialogu); session = životnost EA procesu. Vrátný dnes session baseline při každé dávce nedělá. Doklad: `res-20260907-S03/S04/S05`. Vedlejší nález **N-B1a**: při ručním vyvolání z Find in Project přijde `SearchText` jako objekt (`neznamy prikaz '[object Object]'`), `gk-ping` nevznikl — netýká se PS vrátného (`GetElementsByQuery` posílá string).
3. **T6-S ✅ STAV 1 — `Project.DeleteBaseline(guid)` existuje a maže z obou runtime; téma 3 je stavitelné.** Doklad: `vysledky/T6S-pumpa-20260907-113418.txt` (B true, D pryč), `res-20260907-S09` (řádek `t_document` zmizel → maže, neskrývá), EA runtime výstup s `KONEC` (bez nezachytitelné COM chyby), `res-20260907-S10`. Formát `date`: **v API neexistuje** → zdroj data = jméno (autorita, §6.1) nebo SQL `DocDate`. Limit `version` doma: ≥ 300 znaků bez ořezu (SQLite `TEXT`); bankovní limit určí `sql-banka.md` B1.
4. **T6-C — neprovedeno doma, přesunuto do banky** (rozhodnutí Miloše 7. 9., viz řádek K17–K22). `subtreeMax` / `maxBaselineElements` zůstávají shadow s defaulty §5. Náhradní nález: **baseline smazané package zaniká s ní** (`res-20260907-S23`, `S19`) → obnova smazané package jen z baseline předka = empirický doklad řádku §4.2 „package — delete → RODIČ".

---

## Co se tu rozhoduje (a proč v tomhle pořadí)

| Prerekvizita | Otázka | Rozhoduje o | Kroky |
|---|---|---|---|
| **T6-W4** (jen čtení) | Kde EA drží baselines; jde získat (package GUID, `version`) jedním `SELECT`? | kandidátní množina úklidu z **modelu** (§6.3) × fallback „jen whitelistované větve" | K1–K3 |
| **T6-B1** (levný test) | Drží EA runtime `FB_Process._fbSessionStarted` mezi vyvoláními? | zda oprava `FB_Process` → `FB_StateFile` je prerekvizita stavby (§8/6), nebo ne | K4–K9 |
| **T6-S** (nejrizikovější → až po W4 a B1, před ním ruční baseline jako pojistka) | Existuje `Project.DeleteBaseline` a maže — z runtime pumpy i z EA runtime? Formát `date`; délkový limit `version` | **celé téma 3** (automatický úklid) × degradace na report + ruční úklid (§6.4); formát jména FB-AUTO (§6.1) | K10–K16 |
| **T6-C** (ruční kalibrace, NE dávkou) | Trvání `create_baseline` a přírůstek DB pro ~100 / ~1 000 / ~5 000 (/ ~20 000) prvků | hodnota `subtreeMax` (hranice, kde trvání > 10 s) — dnes jen shadow (dispozice 2) | K17–K24 |
| Úklid | smazat `FBT-CAL`, zkontrolovat osiřelé baselines, FBT-SPIKE zbytky | model zpět do stavu před spikem | K25–K27 |

Pořadí je záměrné: W4 nic nemění, B1 přidá jen session baselines (levné), T6-S je jediný krok, který **může shodit add-in** — proto běží nejdřív z runtime pumpy (chyba zachytitelná) a do EA runtime jde jen když z pumpy vyšel STAV 1. T6-C je poslední, protože zvětší `#FB-TEST` na tisíce prvků — a **každý start pumpy dělá session baseline celého `#FB-TEST`** (`FB_SessionStart`), takže po T6-C ihned K25 (úklid), jinak bude každý další start pumpy trvat dlouho.

## Jak se posílá dávka pumpou (pořád stejné 3 kroky)

1. Otevři `docs\baseline-spike\req-20260907-<krok>.json`; kde je zástupný text `GUID-…`, nahraď ho skutečným GUIDem z předchozího kroku a **ulož kopii do `C:\GIT\ea-file-bridge\requests\`** (název nech).
2. Pumpa si soubor vezme do ~1 s — sleduj konzoli (`Zpracovavam … → Hotovo …`). ELEVATED dávka = **popup pumpy** Ano/Ne/Storno (timeout 300 s).
3. Výsledek: `C:\GIT\ea-file-bridge\responses\res-20260907-<krok>.json` — otevři, u tohoto protokolu je čtení res souboru **nutné** (hodnoty se z něj opisují). `res-*.json` nemaž.

Když něco selže, neopravuj naslepo — zapiš krok, zkopíruj text konzole a res soubor do vlákna vyhodnocení. **Falešná nula:** `rowCount: 0` po jakémkoli modálním okně EA neznamená „nic tam není" — dávku pusť znovu v čerstvé kopii (PROTOKOL §5a/5, §10).

Souběh: **pumpa a GUI fallback (K9) nikdy zároveň**; vrátný se v tomto protokolu nespouští vůbec (Norton — viz K5).

---

## K0 — start pumpy + výchozí počet baselines

**Udělej:** EA otevřená s `EAExample.qea`. Dvojklik `C:\GIT\ea-file-bridge\pump.wsf`. Pokud dnes už proběhl protokol `docs\e2e-pumpa` (Z260904-1), pumpa běží — tenhle krok jen opiš z konzole.

**Očekávaný výstup (konzole):** `=== EA File Bridge pumpa v0.5 …`, `Pripojeno na EA: …EAExample.qea`, `Code loader: <N> operaci …`, řádek `Session baseline (zaloha pred zapisem) vytvoren nad: …#FB-TEST [FB 2026-09-07 hh:mm:ss]`. Ten řádek = **1 nová baseline na `#FB-TEST` za každý start pumpy** — počítej s tím v B1.

| Kolonka | Hodnota |
|---|---|
| čas startu pumpy / text session baseline | 10:50:14 / `FB 2026-09-07 10:50:15` (druhý start 11:29:36 / `FB 2026-09-07 11:29:37`) |
| Code loader N | 105 |
| ✅/❌ | ✅ |

---

## T6-W4 — kde EA drží baselines (jen čtení)

### K1 — schéma `t_document` a `t_package` (nikdy hádaný sloupec)

**Dávka:** `req-20260907-S01-w4-schema.json` — `sqlite_master` (DDL obou tabulek) + `get_baselines` nad `#FB-TEST`.

**Očekávaný výstup:** `"status":"done"`, 2/2 ops. `results[0].rows` = 2 řádky s `sql` (DDL `CREATE TABLE t_document (...)` a `t_package`). **Zkontroluj v DDL `t_document`, že existují sloupce:** `DocID`, `DocName`, `DocType`, `ElementID`, `ElementType`, `Author`, `Version`, `IsActive`, `Sequence`, `DocDate`, `BinContent` — K2 je používá. Chybí-li některý, K2 **nepouštěj** a zapiš, jak se jmenuje doopravdy (uprav SQL v S02 ručně). Z DDL opiš i deklarovanou délku `DocName` / `Version` (např. `VARCHAR(255)` — SQLite ji nevynucuje, ale je to hint pro banku).
`results[1]` = seznam baselines `#FB-TEST` (`count`, `items[{guid,version,notes,date}]`, `raw` XML) — **opiš první `date` doslova** (formát, T6-S).

| Kolonka | Hodnota |
|---|---|
| sloupce `t_document` (výčet z DDL) | DocID (PK), DocName, Notes, Style, ElementID, ElementType, StrContent, BinContent (BLOB), DocType, Author, Version, IsActive, Sequence, DocDate — všech 11 z K1 existuje (`res-…S01` results[0]) |
| deklarovaná délka `DocName` / `Version` | `TEXT` bez délky (SQLite); limit určí banka (`sql-banka.md` B1) |
| `get_baselines` #FB-TEST: count | 40 |
| atribut `date` doslova (1. položka) | **"" — atribut `date` v XML není** (raw: `name, version, notes, guid`) |
| ✅/❌ | ✅ |

### K2 — enumerace baselines jedním SELECT

**Dávka:** `req-20260907-S02-w4-enum.json` — 5 čtení: rozložení `DocType` → všechny baseline řádky bez blobů → **join na `t_package` (package GUID, `version`)** → počet per package → osiřelé (package neexistuje).

**Očekávaný výstup:** `done`, 5/5. `results[0].rows` obsahuje hodnotu `Baseline` (pokud se literál jmenuje jinak, uprav `WHERE d.DocType = '…'` v S02 a pusť znovu jako `S02b`). `results[2].rows` = dvojice `PackageName/PackageGUID` + `BaselineGUID/DocName/Version/DocDate` — **to je odpověď na W4**: řádek pro `#FB-TEST` musí existovat (session baselines z K0). `results[4].rows` = osiřelé baselines (čekáme 0; nenulový výsledek je nález pro §6.3 — takové baselines `GetBaselines(package)` nikdy neuvidí).

| Kolonka | Hodnota |
|---|---|
| hodnoty `DocType` + počty | Baseline 41, ExtDoc 63, EPost 52, EDisc 31, BPSimulation 29, BPSimReport 27, ModelDocument 27, … (18 hodnot; `res-…S02` results[0]) |
| kde je `version`: `DocName`, nebo `Version`? (porovnej s `get_baselines` z K1) | **`Version`** (= `get_baselines.version`); `DocName` = jméno package |
| kde je package GUID: `ElementID` = `t_package.ea_guid`? (join vrátil řádky?) | **ano, `ElementID` = `t_package.ea_guid`**, join vrátil 41/41 (results[2]) |
| počet baselines `#FB-TEST` dle SQL | 40 (+ 1 FBT-IT1 `AI-pre-IT3-20260817-02`) |
| osiřelé baselines (počet) | 0 |
| ✅/❌ | ✅ |

### K3 — křížová kontrola (bez dávky)

**Očekávaný výstup:** shoda API × SQL v počtu i GUIDech. Porovnej `results[1].items` z K1 (`get_baselines`: `guid`, `version`, `date`) s řádky K2 pro `#FB-TEST`: **stejný počet, `guid` = `DocID`, `version` = ten sloupec, který jsi určil v K2, `date` × `DocDate` (stejná hodnota, jiný formát?)**. Když sedí, W4 je vyřešeno kladně: kandidátní množina úklidu = jeden `SELECT` nad `t_document` (bankovní varianta `sql-banka.md` B2 — spustit až v bance).

| Kolonka | Hodnota |
|---|---|
| počty shodné (API × SQL) | 40 × 40 ✅ |
| `guid` = `DocID` | ✅ identické množiny |
| `date` (API) × `DocDate` (SQL) — hodnoty | "" × `2026-09-07 10:50:16` (jméno `…10:50:15` — může se lišit o 1 s) |
| **Závěr W4:** jde jedním SELECT ✅ / nejde ❌ (→ fallback whitelistované větve) | **jde jedním SELECT ✅** |

---

## T6-B1 — `FB_Process._fbSessionStarted` × `FB_StateFile` (levný test)

**Co se rozhoduje:** `FB_Process` (vstupní bod vrátného, EA runtime) volá `FB_SessionStart` chráněný in-memory příznakem `this._fbSessionStarted`. Hlavička `FB_StateFile` tvrdí, že EA runtime in-memory stav mezi vyvoláními **nedrží** → session baseline by vznikala **při každé dávce vrátného**. Test: vyvolat `FB_Process` dvakrát, mezi tím `get_baselines`.

**Náhrada za vrátného (Norton doma blokuje `gatekeeper.ps1`):** vrátný volá `Repository.GetElementsByQuery("FB_Process", "<příkaz>")` — tj. **Add-in Search `FB_Process`**. Totéž jde vyvolat ručně z EA bez PowerShellu: **Find in Project → hledání `FB_Process` → hledaný text `ping|b1a` → Run**. Příkaz `ping` nespouští žádnou dávku, jen zapíše `responses\gk-ping-b1a.json` (důkaz běhu — návratová hodnota „T" důkaz není, lekce T4-0a) a předtím projde přesně tou větví `if (!this._fbSessionStarted) FB_SessionStart(...)`. Je to **stejný kód, stejný runtime, stejná cesta vyvolání** jako u vrátného — liší se jen volající (člověk místo PS).

**Co náhrada rozhoduje:** zda EA runtime drží `this._fb*` mezi dvěma vyvoláními Add-in Search (= spor B1). **Co nerozhoduje:** nic o samotném PS vrátném (mutex, reap, AV) — to ale se sporem nesouvisí. **Proč ne návrh „dvě dávky pumpou + dvě přes GUI fallback":** pumpa `FB_Process` vůbec nevolá (session baseline dělá sama při startu, `pump.wsf` ř. 296) a GUI fallback `FB_ProcessFolder` `FB_SessionStart` nevolá nikdy (nález B1 red teamu) — obě varianty by o `_fbSessionStarted` neřekly nic. GUI fallback je tu jen jako doplněk K9 (doloží druhou polovinu nálezu B1: „v klikacích kanálech session baseline nevzniká").

### K4 — počet baselines před

**Dávka:** `req-20260907-S03-b1-baselines-0.json` (`get_baselines` `#FB-TEST`). **Očekávaný výstup:** `done`, `count` = C0 (zapiš) a čas poslední `FB 2026-09-07 …`.

### K5 — první vyvolání `FB_Process` (ručně, bez PowerShellu)

**Udělej:** V EA otevři **Find in Project** (Ctrl+F, případně ribbon Start → Explore → Search → Model). V rozbalovacím seznamu hledání vyber **`FB_Process`** (skupina Add-in searches / vlastní; pokud v seznamu **není**, založ ji: New Search → Group Type = *Search*, Search Name = `FB_Process`, **Addin Name and method = `AICodeBridge.FB_Process`** — oddělovač TEČKA, s lomítkem se metoda tiše nezavolá; lekce T4-0a). Do pole hledaného textu napiš přesně `ping|b1a` a spusť (Run/Enter).

**Očekávaný výstup:** soubor `C:\GIT\ea-file-bridge\responses\gk-ping-b1a.json` (obsah `repository`, `connection`, `time`) — **bez něj se nic nespustilo** (zkontroluj definici hledání). V Output tabu *AI Bridge* nový řádek `Session baseline (zaloha pred zapisem) vytvoren nad: …#FB-TEST [FB …]` (loguje `FB_SessionStart`). Pokud řádek chybí a `gk-ping` existuje → `FB_SessionStart` selhal potichu (try/catch v `FB_Process`) — zapiš, B1 pak nejde rozhodnout touto cestou.

| Kolonka | Hodnota |
|---|---|
| hledání `FB_Process` existovalo / založeno | existovalo |
| `gk-ping-b1a.json` vznikl (čas) | **ne** — Output: `neznamy prikaz '[object Object]'` (SearchText z Find in Project je objekt; nález N-B1a) |
| řádek Session baseline v Output tabu | ✅ `…#FB-TEST [FB 2026-09-07 10:58:46]` |
| ✅/❌ | ✅ (větev proběhla) |

### K6 — počet baselines po prvním vyvolání

**Dávka:** `req-20260907-S04-b1-baselines-1.json`. **Očekávaný výstup:** `count` = C1 = **C0 + 1** (nová `FB 2026-09-07 hh:mm:ss` s časem K5).

### K7 — druhé vyvolání

**Udělej:** totéž jako K5 s textem `ping|b1b` (Find in Project **nezavírej ani neotvírej znovu** kvůli čistotě testu — jen změň text a Run; pak pro jistotu ještě jednou `ping|b1c` z **nově otevřeného** dialogu). **Očekávaný výstup:** `gk-ping-b1b.json` (+ `b1c`).

### K8 — počet baselines po druhém vyvolání + verdikt

**Dávka:** `req-20260907-S05-b1-baselines-2.json`. **Očekávaný výstup:** `count` = C2.

| Výsledek | Verdikt B1 |
|---|---|
| C2 = C1 + 2 (každé vyvolání nová baseline) | **`FB_StateFile` má pravdu**: EA runtime `this._fbSessionStarted` nedrží → oprava `FB_Process` → `FB_StateFile` (session token `state-session.txt`, §4.5) je **prerekvizita stavby** (§8/6). Vrátný dnes dělá session baseline **při každé dávce**. |
| C2 = C1 (žádná další) | in-memory příznak v EA runtime přežívá (aspoň v rámci běžící EA a téhož dialogu/vyvolání) → oprava není blokující; session = životnost EA procesu. Zapiš, zda se lišil výsledek `b1b` (týž dialog) × `b1c` (nový dialog). |
| C1 = C0 (ani první vyvolání nic nevytvořilo) | test nerozhodl — viz K5 (tichý pád `FB_SessionStart`, nebo hledání nevolá metodu). |

| Kolonka | Hodnota |
|---|---|
| C0 / C1 / C2 | 40 / 41 / 41 (`res-…S03/S04/S05`) |
| **Verdikt B1** | **in-memory příznak přežívá** (b1b týž dialog = b1c nový dialog, žádná nová baseline) → oprava `FB_Process` není blokující; session = životnost EA procesu |
| ✅/❌ | ✅ |

### K9 — doplněk (volitelný): GUI fallback session baseline nedělá

**Udělej:** zavři pumpu (křížek). Ulož `req-20260907-S06-b1-gui-ping.json` do `requests\` a spusť **Specialize → AI Bridge → Process requests (File Bridge)**. Pak počet baselines `#FB-TEST` odečti **v EA Baseline manageru** (vyber `#FB-TEST` → Ctrl+Alt+B / Manage Baselines) — pumpa neběží, dávkou to nejde.

**Očekávaný výstup:** dialog `EAFB OK …: 1/1 ops`, `res-20260907-S06.json` `done`; počet baselines **= C2 (beze změny)**. Pak pumpu spusť znovu (= +1 baseline, zapiš jako C3 — to je normální).

---

## T6-S — `Project.DeleteBaseline` (nejrizikovější; pojistka nejdřív)

### K10 — ruční baseline jako pojistka

**Udělej:** v EA vyber `#FB-TEST` → Manage Baselines (Ctrl+Alt+B) → **New Baseline**, Version `Pojistka pred T6-S 2026-09-07`, Notes libovolné → OK. Tahle baseline se **nikdy nemaže** (filtr spiku bere jen `FBT-SPIKE*`; ruční jména jsou strukturálně nedotknutelná, §6.1).

**Očekávaný výstup:** v seznamu Baseline manageru nový řádek `Pojistka pred T6-S 2026-09-07`; v K12 se objeví i v `get_baselines` (bez prefixu FBT-SPIKE → není kandidát).

### K11 — tři testovací baselines `FBT-SPIKE` dávkou

**Dávka:** `req-20260907-S07-s-create-spike.json` — 3× `create_baseline` nad `#FB-TEST` (třída LOW, bez dialogu): `FBT-SPIKE del 2026-09-07` (kandidát pro pumpu), `FBT-SPIKE len255 …` (**přesně 255 znaků**; kandidát pro EA runtime), `FBT-SPIKE len300 …` (**300 znaků**; test limitu nad 255).

**Očekávaný výstup:** `done`, 3/3, každý result `name`, `baselineGuid` (neprázdný — dohledáno v `GetBaselines` podle `version`). Když je `baselineGuid` prázdný u len255/len300 a plný u „del" → EA jméno **oříznulo** (dohledání podle celé verze selhalo) — to je samo o sobě nález o limitu.

### K12 — ověření + formát `date` + délka `version`

**Dávka:** `req-20260907-S08-s-verify.json` — `get_baselines` + SQL nad `t_document` pro `#FB-TEST` s `LENGTH(DocName)`, `LENGTH(Version)`, `LENGTH(BinContent)`.

**Očekávaný výstup:** `done`, 2/2. V `results[0].items` tři `FBT-SPIKE*` položky; `results[1].rows` tytéž řádky. **Odečti:** `lenVersion`/`lenDocName` u len255 a len300 (255 a 300 = neořezává; 255 a 255 = limit 255; jiné = zapiš), `date` doslova (např. `2026-09-07 10:14:03` × `07.09.2026 10:14:03` × ISO s `T`), a `bytes` každé baseline `#FB-TEST` (velikost při ~ desítkách prvků — první bod do T6-C).

| Kolonka | Hodnota |
|---|---|
| `lenVersion` len255 / len300 (SQL) + délka `version` v API | 255 / 300 (SQL) = 255 / 300 (API) — neořezává |
| **formát `date` (API)** doslova | "" (atribut neexistuje) |
| `DocDate` (SQL) doslova | `2026-09-07 11:30:27` |
| bytes baseline `#FB-TEST` (typická) | ≈ 64 017–64 028 B (SPIKE); přes 46 baselines min 1 131 / medián 39 616 / max 65 243 |
| ✅/❌ | ✅ |

### K13 — spike z runtime pumpy: `spike-deletebaseline.wsf`

**Proč tudy a ne dávkou:** operace `delete_baseline` neexistuje a nasazení dočasné operace by znamenalo `deploy_src` (změna `src/` + trvalá stopa v modelu) — mimo rozsah tohoto vlákna. Skript `docs\baseline-spike\spike-deletebaseline.wsf` je **tentýž runtime jako pumpa** (WSH JScript, stejný COM attach `GetObject(, "EA.App")` jako `pump.wsf`), kde je chyba „metoda neexistuje" zachytitelná `try/catch`. Nic nenasazuje, `requests\` se nedotýká, maže **výhradně** baseline s prefixem `FBT-SPIKE`.

**Udělej:** pumpa může běžet, ale nesmí zrovna zpracovávat dávku. Dvojklik `docs\baseline-spike\spike-deletebaseline.wsf` (přehodí se do konzole). Zkontroluj výpis kandidátů (3 `FBT-SPIKE`), na dotaz **Enter** (vybere `FBT-SPIKE del`), na „Opravdu smazat?" napiš `a`.

**Očekávaný výstup (konzole + soubor `docs\baseline-spike\vysledky\T6S-pumpa-<čas>.txt`):** řádky `A) typeof pi.DeleteBaseline = …`, `B) … vratil: true/false` nebo `B) VYJIMKA: …`, `D) GetBaselines po: N-1 …; cil JE PRYC`, a **`VERDIKT: STAV 1 / 2 / 3`**.

| Výsledek | Co dělat |
|---|---|
| **STAV 1** — API existuje, vrací `true`, `GetBaselines` ji nevrací | téma 3 (automatický úklid) je stavitelné. Pokračuj K14 (kontrola v `t_document`) a K15 (EA runtime). |
| **STAV 2** — API existuje, vrací `false` (nebo `true`, ale baseline zůstala) | zapiš přesně návratové hodnoty A/B/C. Zkus tutéž baseline smazat **ručně v Baseline manageru** — funguje-li, je to omezení API (ne zámek/práva). §6.4: téma 3 **degraduje** na jmennou konvenci + `report` + klikací návod na ruční úklid, dokud se příčina nevysvětlí (kandidáti: formát GUID, verze EA, security). K15 **přeskoč**. |
| **STAV 3** — výjimka 438 / „Object doesn't support this property or method" | API v EA 17.1.5 z automation **není**. §6.4: téma 3 degraduje **definitivně** (jmenná konvence + `report` + ruční úklid). K14–K16 přeskoč, FBT-SPIKE baselines smaž ručně v K27. Do zadání jde nález: úklid = člověk v Baseline manageru s návodem; kandidáty mu vypíše `report`. |

| Kolonka | Hodnota |
|---|---|
| A) typeof | `unknown` (COM člen existuje) |
| B) návrat / výjimka doslova | `vratil: true (typeof boolean)` |
| C) varianta GUIDtoXML (jen při false) | nespouštěno (B = true) |
| D) počet po / cíl pryč | 45 (před 46) / JE PRYC; 2. běh len300: 43 (před 44) / JE PRYC |
| **STAV** | **STAV 1** |

### K14 — kontrolní čtení po pumpě

**Dávka:** `req-20260907-S09-s-verify-po-pumpe.json` (totéž co S08). **Očekávaný výstup:** `FBT-SPIKE del` chybí **v API i v SQL** (`t_document` řádek zmizel — tj. `DeleteBaseline` maže řádek, nenechává osiřelý blob). Pokud API nevrací a SQL řádek zůstal → nález (API jen „skryje"; velikost DB neklesá).

### K15 — spike z EA runtime (proxy): Scripting okno, engine JavaScript

**Jen při STAVU 1 z K13.** In-model add-in (GUI fallback, vrátný) běží na JavaScript engine EA, kde COM chyby **nejsou** zachytitelné a shodí celou invokaci (PROTOKOL §1a/4). Proto se druhý runtime testuje **skriptem v okně Scripting se stejným engine** — když spadne, spadne skript, ne add-in. Je to proxy (nereprodukuje kontext „uvnitř zpracování dávky"), důkaz z add-inu přijde až se stavbou chráněného volání v `FB_BaselineCleanup`.

**Udělej:** EA → okno **Scripting** (ribbon Specialize → Tools → Scripting, podle verze ribbonu i Develop → Scripting). Nová skupina (např. `FB spike`) → **New JavaScript Script** (engine *JavaScript*; NE JScript, NE VBScript) → vlož celý obsah `docs\baseline-spike\spike-deletebaseline-ea-runtime.js` → Save → **Run**. Výstup v System Output, záložka *Script*.

**Očekávaný výstup:** řádky `T6-S EA runtime: A) typeof …`, `B) vratil: true`, `C) … cil JE PRYC`, `VERDIKT: z EA runtime MAZE`, a **poslední řádek `KONEC`**. Chybí-li `KONEC` (výstup končí na `A) START` nebo `B) START`) → volání **shodilo skript nezachytitelnou COM chybou** = past §1a/4 platí i pro `DeleteBaseline` → v add-inu půjde volat jen s pojistkou (vlastní krok po ověření existence z pumpy) — zapsat, téma 3 tím nepadá (mazat může i executor přes pumpu/vrátného), ale mění to návrh `FB_BaselineCleanup`.

| Kolonka | Hodnota |
|---|---|
| A / B / C řádky doslova | `A) typeof pi.DeleteBaseline = function` / `B) vratil: true (typeof boolean)` / `C) baselines po: 44 (pred 45); cil JE PRYC` |
| `KONEC` vypsán | ✅ |
| případný text chyby ze System Output | žádný |
| ✅/❌ | ✅ |

### K16 — kontrolní čtení po EA runtime + zbylá len300

**Dávka:** `req-20260907-S10-s-verify-po-ea.json`. **Očekávaný výstup:** `FBT-SPIKE len255` pryč v API i SQL. Zbylou `FBT-SPIKE len300` smaž tím, co fungovalo (znovu K13 s textem `FBT-SPIKE len300`), jinak ručně v K27.

**Souhrn T6-S do vlákna vyhodnocení:** STAV z pumpy, výsledek EA runtime, formát `date`, délkový limit `version` doma (+ poznámka, že bankovní limit určí `sql-banka.md` B1 — `CHARACTER_MAXIMUM_LENGTH`).

---

## T6-C — kalibrace `create_baseline` (ručně v Baseline manageru, ne dávkou)

**Princip:** trvání baseline a přírůstek DB pro ~100 / ~1 000 / ~5 000 (/ ~20 000) prvků. Takové packages v eaexample nejsou (K17 to ověří), velikost se vyrobí uvnitř `#FB-TEST`: jeden vnořený strom `FBT-CAL > L20000 > L5000 > L1000 > L100`, kde `L100` dostane 100 tříd dávkou a vyšší úrovně vzniknou **klonováním sourozenců** (`clone_package` klonuje vedle zdroje, do téhož rodiče — proto vnoření). Baseline se pak dělá ručně nad `L100`, `L1000`, `L5000` (a `L20000`). `clone_package` je třídy ELEVATED → **popup u každé dávky**; žádná dávka nepřekročí 500 writeOps (největší je S12 = 105).

### K17 — kandidáti v eaexample (jen čtení)

**Dávka:** `req-20260907-S11-c-kandidati.json` — rekurzivní CTE nad `t_package` (SQLite `WITH RECURSIVE`, doma OK; v bance nepoužívat bez ověření — `sql-banka.md` B4), 40 největších packages + celkové počty.

**Očekávaný výstup:** `done`, 3/3; `results[0].rows` = `Package_ID, Name, ea_guid, packages, elements` seřazeno sestupně. Zapiš 5 největších (jméno + elements) a `objects_total`. Existuje-li přirozený kandidát ~1 000 nebo ~5 000 prvků (mimo `#FB-TEST`), **můžeš ho použít pro ruční baseline místo klonu** (baseline v Baseline manageru whitelist neřeší — jen bridge) a klonovací kroky odpovídající velikosti přeskočit.

| Kolonka | Hodnota |
|---|---|
| top 5 (Name / elements) | neprovedeno (T6-C přesunuto do banky, rozhodnutí 7. 9.) |
| objects_total / packages_total | — |
| přirozený kandidát ~1 000 / ~5 000? | — |

### K18 — stavba: strom + 100 tříd

**Dávka:** `req-20260907-S12-c-build-l100.json` — 5 packages řetězem `$N` + 100 elementů `FBT-CAL-E001…E100` (Class) do `L100`. ELEVATED (105 writeOps) → popup → **Ano**.

**Očekávaný výstup:** `done`, 6/6. Z res opiš: `results[0].items[0].guid` = **GUID-FBT-CAL** (pro úklid S18), `results[2]…guid` = **GUID-L5000**, `results[3]` = **GUID-L1000**, `results[4]` = **GUID-L100**; `results[5].items` má 100 položek `created:true`.

| Kolonka | Hodnota |
|---|---|
| GUID-FBT-CAL / GUID-L5000 / GUID-L1000 / GUID-L100 | neprovedeno |
| trvání dávky (konzole) | — |
| ✅/❌ | — (přeskočeno) |

### K19 — L1000 = L100 + 9 klonů

**Dávka:** `req-20260907-S13-c-clone-l100x9.json` — nahraď **všech 9×** `GUID-L100`. ELEVATED → popup → Ano. **Očekávaný výstup:** `done`, 9/9, každý result `volume.elements` = 100 (+ `packages` 1). Trvání zapiš.

### K20 — L5000 = L1000 + 4 klony

**Dávka:** `req-20260907-S14-c-clone-l1000x4.json` — nahraď 4× `GUID-L1000`. **Očekávaný výstup:** `done`, 4/4, `volume.elements` = 1000, `packages` = 10 u každého. Trvání zapiš (klon 1 000 prvků jde přes XMI — může být desítky sekund).

### K21 — L20000 = L5000 + 3 klony (jen pokud jde vyrobit)

**Podmínka:** K20 celkem pod ~5 min a `.qea` pod ~500 MB; jinak přeskoč a zapiš proč. **Dávka:** `req-20260907-S15-c-clone-l5000x3.json` — 3× `GUID-L5000`. **Očekávaný výstup:** `done`, 3/3, `volume.elements` = 5000.

### K22 — ověření velikostí

**Dávka:** `req-20260907-S16-c-count.json` (týž CTE, jen `FBT-CAL%`). **Očekávaný výstup:** řádky `FBT-CAL-L100` ≈ 100, `FBT-CAL-L1000` ≈ 1 000, `FBT-CAL-L5000` ≈ 5 000, `FBT-CAL-L20000` ≈ 20 000 (nebo 5 000, když K21 přeskočen); klony pod nimi. Přesná čísla do tabulky K23.

### K23 — ruční kalibrace se stopkami (Baseline manager)

**Udělej pro každý řádek tabulky:** v Project browseru vyber package → Ctrl+Alt+B (Manage Baselines) → New Baseline → Version `CAL <úroveň> 2026-09-07` → **stopky start při OK**, stop až se baseline objeví v seznamu. Před a po každé baseline odečti velikost souboru `EAExample.qea` (Průzkumník → Vlastnosti; sečti i případné `EAExample.qea-wal` / `-journal` vedle něj). Pořadí od nejmenší.

**Očekávaný výstup:** vyplněná tabulka (4 řádky, nebo 3 + důvod přeskočení L20000), trvání roste s počtem prvků; řádek `subtreeMax` s číslem, nebo „nad 10 s nikde — subtreeMax > <největší měřená velikost>".

| package | počet prvků (K22) | trvání [s] | .qea před [MB] | .qea po [MB] | přírůstek souboru [MB] | bytes baseline (K24) | poznámka |
|---|---|---|---|---|---|---|---|
| `FBT-CAL-L100` | — | — | — | — | — | — | neprovedeno doma (T6-C → banka) |
| `FBT-CAL-L1000` | — | — | — | — | — | — | neprovedeno |
| `FBT-CAL-L5000` | — | — | — | — | — | — | neprovedeno |
| `FBT-CAL-L20000` (volitelně) | — | — | — | — | — | — | neprovedeno |
| `#FB-TEST` (desítky prvků, z K12) | ~10 | <1 (dávkou) | — | — | — | ≈ 64 000 | jediný domácí bod; FBT-ORPHAN (2 třídy) 1 802 B |

**subtreeMax = nekalibrováno** (doma neměřeno; shadow default 5 000 dle §5) · **maxBaselineElements = nekalibrováno** (shadow default 10 000) · obojí zůstává **shadow**; kalibrace = bankovní T6-C (MS SQL; Milošův odhad ≥10× pomalejší než SQLite doma) (dispozice 2) — rozhodovací roli dostane až po datech z auditu.

### K24 — přírůstek přesně (SQL místo velikosti souboru)

**Dávka:** `req-20260907-S17-c-sizes.json` — `LENGTH(BinContent)` každé `FBT-CAL*` baseline + součet všech baselines. **Očekávaný výstup:** řádek per baseline s `bytes`/`mb`; doplň do tabulky K23. Rozdíl proti přírůstku souboru = režie SQLite (nebo znovu využité volné stránky) — přesnější je `bytes`. Bankovní ekvivalent `sql-banka.md` B3 (`DATALENGTH`).

---

## Úklid (poslední dávky)

### K25 — smazat celý `FBT-CAL`

**Dávka:** `req-20260907-S18-uklid-fbt-cal.json` — nahraď `GUID-FBT-CAL`. ELEVATED (delete) → popup s plnou cestou `…#FB-TEST.FBT-CAL` → **Ano**. **Očekávaný výstup:** `done`, `items[0].deleted:true`. Mazání 5–20 tisíc prvků může trvat minuty — pumpa čeká. **Nevynechávej** — jinak každý start pumpy baselinuje tisíce prvků (K0).

### K26 — kontrola úklidu + osiřelé baselines

**Dávka:** `req-20260907-S19-uklid-kontrola.json`. **Očekávaný výstup:** `results[0].rowCount` = 0 (žádný `FBT-CAL%` package); `results[1]` = baselines, jejichž package už neexistuje — **čekáme, že se tu objeví CAL baselines z K23** (EA při smazání package baselines v `t_document` pravděpodobně nemaže). Je-li to tak: nález pro §6.3 (osiřelé baselines drží místo a `GetBaselines` je nevidí; kandidát na SQL-only detekci v `report`). `results[2]` = baselines `#FB-TEST` (pojistka z K10 + session `FB …` + případná `FBT-SPIKE len300`).

| Kolonka | Hodnota |
|---|---|
| FBT-CAL packages zbývají | 0 (nikdy nevznikly); FBT-ORPHAN 0 po S22 |
| osiřelé baselines (počet, jména) | **0** — baseline `FBT-ORPHAN pred smazanim` zanikla se smazáním package (`res-…S23`, `res-…S19`) |
| baselines #FB-TEST (výčet version) | 43: 39× legacy `FB …` (do 5. 9.), `FB 2026-09-07 10:50:15`, `FB 2026-09-07 10:58:46`, `Pojistka pred T6-S 2026-09-07`, `FB 2026-09-07 11:29:37` |

### K27 — ruční dočištění (Baseline manager)

Zbylé `FBT-SPIKE*` (při STAVU 2/3) smaž ručně: `#FB-TEST` → Ctrl+Alt+B → vybrat → Delete. Session baselines `FB 2026-09-07 …` (K0, K5, K7, K9) a `Pojistka pred T6-S` nech, nebo smaž podle uvážení — nejsou předmětem testu. Volitelně **Project → Manage → Compact** pro zmenšení `.qea` (SQLite se sám nezmenší); velikost před/po zapiš.

**Očekávaný výstup:** Baseline manager `#FB-TEST` bez položek `FBT-SPIKE*`; žádný package `FBT-CAL*` v Project browseru; `#FB-TEST` obsahově stejný jako před K11 (jen navíc baselines, které jsi nechal).

---

## Tabulka výsledků

Vyplněná tabulka je nahoře v bloku **VÝSLEDKY 2026-09-07** (šablona odstraněna 7. 9.).

## Známé pasti

- **Modál = falešná nula.** Neznámý sloupec v SQL neotevře chybu, ale dialog; po odkliknutí může přijít `rowCount: 0`. Proto K1 (schéma) před K2 a kontrolní čtení vždy v čerstvé dávce.
- **`FB_SessionStart` běží při každém startu pumpy** — počty baselines `#FB-TEST` v B1 vztahuj k C0 z K4, ne k K1.
- **Popup pumpy má timeout 300 s** — u dlouhých klonů (K20/K21) potvrď hned, trvání se měří až po potvrzení.
- **T6-S nikdy schránkou ani GUI fallbackem** — první dotyk `DeleteBaseline` je vždy `spike-deletebaseline.wsf` (JScript). Kdyby add-in přesto spadl (K15): Specialize → Manage Add-Ins → enable AICodeBridge → plný restart EA.
- **`clone_package` klonuje vedle zdroje** (do téhož rodiče) — proto vnořený strom; do jiného rodiče klon dát nejde.
- **Baseline manager whitelist neřeší** — ruční baseline jde nad čímkoli; bridge (`create_baseline`) jen uvnitř `#FB-TEST`.
- Prompt pro vlákno vyhodnocení je níže; ACK a čísla vkládej tam, ne sem.

---

## Vlákno k tomuto protokolu

Živý běh proběhl 7. 9. 2026 ve vlákně **`Z260904-2b baseline spike zive`** (prompt v `C:\Users\milos\CLAUDE\IT-ANALYSIS\zaprah-vlaken-2026-09-04.md`, sekce Z260904-2b); výsledky jsou v bloku VÝSLEDKY nahoře. Starší prompt „Z260904-2b vyhodnocení", který tu býval, byl překonán 5. 9. 2026 a 9. 9. 2026 odstraněn (dohledatelný v git historii do commitu `23a225b`).
