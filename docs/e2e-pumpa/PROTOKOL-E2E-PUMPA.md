# E2E transportu PUMPA (pump.wsf) — klikací protokol

Datum přípravy: 2026-09-04 (vlákno Z260904-1) · Provede: Miloš u EA, pondělí 7. 9. 2026 · Repozitář: `EAExample.qea` (eaexample, EA 17.x) · Kód: commit z tohoto vlákna v `C:\GIT\ea-file-bridge` (harness 211/211).
Vyhodnocení: ACK a poznámky vkládej do **nového vlákna „Z260904-1b vyhodnocení"** (prompt na konci tohoto souboru).

## Proč tenhle test

Celý E2E iterace 7 (31. 8.) běžel jen **schránkou** (menu *Zpracovat davku ze schranky*). Transport **pumpa** je od té doby nedoložený:

- `deploy_src` pumpou po commitech 7a7fcca / 05b25f8 / db22a56 nikdo nespustil (ověřen jen in-model dávkou T7-07),
- „neutralita pumpy vůči chat ACK" je jen deklarace (zadání iterace 7 §8 bod 5),
- tři nálezy z iterace 7 dostaly opravu kódu, kterou má tento test doložit: **(1a)** proklik z Output tabu per typ artefaktu, **(1b)** plná cesta mazaného prvku v potvrzovacím dialogu, **(1c)** chybová větev delete s více cíli vypisuje i selhaný cíl.

### Co jsem zjistil z kódu — čti před během (jádro testu P2)

Pumpa **chat verzi ACK nikde nevytváří.** Po dávce zapíše jen `responses\res-<id>.json` a vypíše řádek na konzoli (`Hotovo req-P2.json -> res-P2.json`); `FB_Main` k tomu napíše jeden řádek do Output tabu *AI Bridge* (`FB P2 -> …`) a u zápisových dávek výpis změn (`FB_LogChanges`). `FB_ChatRender` volají jen `FB_ClipboardImport` (schránka) a `FB_Process` (vrátný). **Očekávání pro P2: schránka se nezmění, žádný `EAFB OK …` text nikde — identita výsledku (GUIDy) je pro transport pumpa výhradně v res souboru.** To je „neutralita" v praxi: pumpa iterací 7 nebyla dotčena ani obsahově. Jestli je to pro tvůj způsob práce (Copilot čte ACK) dostačující, rozhodni ve vyhodnocení — kandidát na drobnou změnu je vypsat chat verzi i na konzoli pumpy.

## Jak se posílá dávka pumpou (pořád stejné 3 kroky)

1. Otevři soubor `docs\e2e-pumpa\req-<krok>.json` (Poznámkový blok / VS Code), pokud je v něm zástupný text `GUID-…`, nahraď ho skutečným GUIDem z předchozího kroku a **ulož kopii do `C:\GIT\ea-file-bridge\requests\`** (název nech `req-<krok>.json`).
2. Pumpa si soubor sama vezme do ~1 s — sleduj konzoli pumpy (`Zpracovavam req-P2.json …` → `Hotovo …`).
3. Výsledek: `C:\GIT\ea-file-bridge\responses\res-<krok>.json` (otevři, u tohoto testu je to **dovolené a nutné** — res je jediný záznam identity) + Output tab *AI Bridge* v EA + u ELEVATED dávek **popup pumpy** Ano/Ne/Storno.

Do tabulky na konci zapisuj ✅/❌ + co bylo jinak. Když něco selže, **neopravuj naslepo** — zapiš číslo kroku, zkopíruj text z konzole a obsah res souboru do vlákna vyhodnocení. `res-*.json` nemaž.

⚠ Souběh transportů: **pumpa a GUI fallback (P9) nikdy zároveň** — před P9 pumpu zavři (křížek na okně konzole).

---

## P0 — start pumpy

**Udělej:** EA otevřená s `EAExample.qea`. Dvojklik na `C:\GIT\ea-file-bridge\pump.wsf` (sama se přehodí do konzole). Pokud EA ještě není otevřená, pumpa čeká (`Cekam na bezici EA …`) — otevři EA, pumpa se připojí sama.

**Očekávaný výstup na konzoli (opiš do tabulky přesná čísla):**

```
=== EA File Bridge pumpa v0.5 (eafb/0.2, confirm okruh) ===
Slozka requestu: C:\GIT\ea-file-bridge\requests (pending\ = davky cekajici na potvrzeni)
Pripojeno na EA: <cesta k EAExample.qea>
Code loader: <N> operaci nacteno z modelu (elementID 11037).
<řádek session baseline z FB_SessionStart>
```

Čekáme **N ≈ 103** (stav modelu dle PROTOKOL §12; přesné číslo zapiš — je to baseline pro P1). Když se objeví `CEKA … v pending\` — v modelu visí stará nepotvrzená dávka: zapiš její jméno, v popupu dej **Ne** (zamítnout), pokračuj.

| Kolonka | Hodnota |
|---|---|
| verze pumpy | |
| repo (cesta) | |
| počet operací (Code loader) | |
| session baseline (text) | |
| ✅/❌ | |

## P1 — deploy_src PUMPOU + plný restart EA

Nasadí nový kód z tohoto vlákna (5 operací). `deploy_src` je ELEVATED → **popup pumpy** → **Ano**.

**Dávka:** `req-P1.json`

```json
{"protocol":"eafb/0.2","id":"P1","repo":"EAEXAMPLE.QEA","ops":[
 {"op":"deploy_src","only":["FB_LogChanges","EA_OnOutputItemDoubleClicked","FB_RiskGate","FB_ConfirmSummary","FB_OpDelete"]}]}
```

**Očekávaný výstup:**

- konzole: `CEKA NA POTVRZENI req-P1.json -> requests\pending\` → popup se souhrnem (`Chysta se zapsat …`, `Proc potvrzeni: … deploy_src …`) → po **Ano**: `POTVRZENO a provedeno req-P1.json -> processed\` a hned `deploy_src (potvrzeny) -> prenacitam kod z modelu ...` + nový řádek `Code loader: <N> operaci …` (**stejné N jako v P0** — nic nepřibylo, jen se přepsala těla).
- `res-P1.json`: `"status":"done"`, v `results[0]`: `"updated":[…5 jmen…]`, `"created":[]`, `"count":5`, `"reloadCode":true` (případně `paramsSynced`/`skipped` — zapiš).
- Pak **EA úplně zavři a znovu otevři** (File → Exit → spustit `EAExample.qea`). Kód dvojkliku (P7) běží v EA runtime a bez plného restartu testuje starou verzi. Pumpu nechat běžet — po restartu EA sama hlásí `Spojeni s EA ztraceno …` a pak znovu `Pripojeno na EA …` + `Code loader …` (nový kód načte znovu). Pokud se nepřipojí do ~30 s, pumpu zavři a spusť znovu (= P0 podruhé, zapiš).

| Kolonka | Hodnota |
|---|---|
| popup se ukázal / text hlavičky | |
| updated / created / paramsSynced | |
| Code loader po reloadu (N) | |
| re-attach po restartu EA proběhl sám | |
| ✅/❌ | |

## P2 — ping = kotva session + **test neutrality** (kde je ACK)

**Před vložením dávky:** zkopíruj do schránky libovolné slovo (např. napiš do Poznámkového bloku `KONTROLA` a Ctrl+C). Po dávce dáš Ctrl+V — pokud se vloží `KONTROLA`, schránka je nedotčená.

**Dávka:** `req-P2.json`

```json
{"protocol":"eafb/0.2","id":"P2","repo":"EAEXAMPLE.QEA","ops":[{"op":"ping","echo":"pumpa-neutralita"}]}
```

**Očekávaný výstup (totéž co T7-01, navíc otázka „kde"):**

- `res-P2.json` obsahuje: `"echo":"pumpa-neutralita"`, `"repository"` s `EAEXAMPLE`, `"whitelist":[{"guid":"{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}","name":"#FB-TEST","path":"<plná tečková cesta>"}]`, `"access":{…"access":"write"…}`. (V res smí být `login`/`groups`/`connection` — to není chyba, res je system of record.)
- **Kde se ACK objevil — zapiš všechny tři:** schránka (Ctrl+V → čekáme `KONTROLA`, tj. **nezměněná**), konzole pumpy (čekáme jen `Zpracovavam …` / `Hotovo req-P2.json -> res-P2.json`, **žádný** `EAFB OK` text), Output tab *AI Bridge* (čekáme jeden řádek `FB P2 -> done: 1 ops (1 ok, 0 chyb) …`).
- Zapiš z res: **plnou cestu whitelistu** (např. `Model.Sandbox.#FB-TEST`) — použije se pro porovnání v P8.

| Kolonka | Hodnota |
|---|---|
| schránka po dávce (Ctrl+V) | |
| konzole — objevil se text ACK (EAFB OK…)? | |
| Output tab — řádek | |
| whitelist path z res | |
| ✅/❌ | |

## P3 — kontrolní čtení nad `#FB-TEST` (co tam dnes je)

**Dávka:** `req-P3.json` — informace o package, seznam podpackages (Parent_ID 1054) a elementů v nich.

**Očekávaný výstup:** `"status":"done"`, 3/3 ops. V `results[1].rows` čekáme package od iterace 7: **`{02E5717B-AADA-4bfc-8180-848CBE93A3AB}`** (UC „Pošli mailovou zprávu" + diagram, běh 2 z 31. 8.). Dle úklidu 31. 8. v noci (T7-06 smazal „T7 Mail", T7-09 package běhu 1, ověření T7-08b: 0+0 položek) by tam **nic jiného být nemělo** — kdyby se přesto objevily zbytky `{C74A8DB9-9B1B-49c0-A248-CBB6BF0FF503}` (UC Prijmi zpravu z T7-03) nebo `{1BC0BC38-7F91-495d-BA4C-3A3BACCF64FA}` (package běhu 1), vypiš je — rozhodneš, zda je P8 smaže. Plus starší `FBT *` artefakty (PROTOKOL §12) — ty **nejsou** předmětem tohoto testu.

**Vypiš do tabulky, co v `rows` je (Name + ea_guid), a rozhodni:** co z toho má úklid v P8 smazat navíc (P8 je připravena jen na package z P4; další cíle přidej do `targets` sám — každý jako `{"type":"Package","guid":"{…}"}`).

| Kolonka | Hodnota |
|---|---|
| podpackages v #FB-TEST (jméno + GUID) | |
| rozhodnutí: smazat v P8 navíc | |
| ✅/❌ | |

## P4 — řetěz `$N`: package + UC + scénáře + constraint + diagram + umístění

**Dávka:** `req-P4.json` (6 operací; jediná cílová package = nová `P4 Mail (pumpa)` pod `#FB-TEST`). Může skončit popupem (nová struktura) → **Ano**.

**Očekávaný výstup:** `"status":"done"`, 6/6 ops, žádné `warnings`. Z `res-P4.json` **opiš**: `GUID-PKG` (results[0].guid — package), `GUID-UC` (results[1].items[0].guid), `GUID-DGM` (results[4].items[0].guid) + `id` diagramu (results[4].items[0].id). Output tab *AI Bridge* musí mít blok `FB P4 - zmeny v modelu …` s řádky:

```
  [vytvoreno]  package "P4 Mail (pumpa)"  @ <cesta>  (pkg:<PackageID>)
  [vytvoreno]  "UC Posli mailovou zpravu (pumpa)"  @ <cesta>  (el:<ElementID>)
  [create_or_update_scenarios]  hotovo  (2 polozek)  @ <cesta UC>  (el:<ElementID UC>)
  [create_or_update_constraints]  hotovo  (1 polozek)  @ <cesta UC>  (el:<ElementID UC>)
  [diagram vytvoren]  "P4 Mail UC (pumpa)"  (dgm:<DiagramID>)
  [place_elements_on_diagram]  hotovo  (1 polozek)  (dgm:<DiagramID>)
```

Ty řádky **nemaž z Output tabu** — jsou vstupem P7. V EA zkontroluj dvojklikem na UC → záložka Scenarios (2 scénáře, druhý s návratem na krok 2) a Constraints (1 pre-condition).

| Kolonka | Hodnota |
|---|---|
| GUID-PKG / GUID-UC / GUID-DGM (+ id) | |
| Output: řádky nesou markery (pkg:/el:/dgm:) | |
| warnings | |
| ✅/❌ | |

## P5 — chyba uprostřed dávky + oprava z res (vzor T7-03/03b)

**Dávka:** `req-P5.json` — v souboru nahraď `GUID-PKG-Z-P4` hodnotou GUID-PKG z P4. Druhá operace míří na nulový GUID = úmyslná chyba.

**Očekávaný výstup:** `"status":"error"`, `results[0]` **ok** s GUIDem nového UC „UC Prijmi zpravu (pumpa)" (zapiš jako `GUID-UC2`), `results[1]` `E_NOT_FOUND`, další nic. Konzole: `Hotovo req-P5.json -> res-P5.json` (chyba dávky **není** rejected — soubor jde do `processed\`). Output tab: blok změn s jedním řádkem `[vytvoreno] "UC Prijmi zpravu (pumpa)" … (el:…)`.

**Oprava:** `req-P5b.json` — nahraď `GUID-UC-Z-RES-P5` hodnotou `GUID-UC2` (z res souboru — u pumpy jiný zdroj není, viz P2). Čekáme `"status":"done"`, 1/1, `items[0].guid` scénáře.

| Kolonka | Hodnota |
|---|---|
| P5: kód chyby v results[1] / GUID-UC2 z results[0] | |
| P5b: status / GUID scénáře | |
| ✅/❌ | |

## P6 — obrázek diagramu souborem

**Dávka:** `req-P6.json` (diagram 1133 = `FBT OwnedDiag`; kdyby neexistoval, dosaď `id` diagramu z P4).

**Očekávaný výstup:** `"status":"done"`, `results[0].file` (a `items[0].file`) = `C:\GIT\ea-file-bridge\responses\images\FBT_OwnedDiag-1133.png`; soubor existuje a dá se otevřít (dvojklik). Zapiš velikost souboru v kB.

| Kolonka | Hodnota |
|---|---|
| cesta PNG / existuje / kB | |
| ✅/❌ | |

## P7 — prokliky z Output tabu (ověření 1a)

V EA otevři okno **System Output → záložka AI Bridge** (pokud není vidět: Start → All Windows → System Output). Najdi blok `FB P4 - zmeny v modelu …` z kroku P4 a **dvojklikni** postupně na tyto řádky; po každém dvojkliku zapiš, **co se označilo v Project browseru**:

| Řádek (dvojklik) | Očekávání | Co se označilo | ✅/❌ |
|---|---|---|---|
| `[vytvoreno] package "P4 Mail (pumpa)" … (pkg:…)` | označí se **package** P4 Mail (pumpa) — dřív id 11341-styl nic neoznačil | | |
| `[vytvoreno] "UC Posli mailovou zpravu (pumpa)" … (el:…)` | označí se UC (stávající chování) | | |
| `[create_or_update_scenarios] hotovo … (el:…)` | označí se **UC** (vlastník scénářů) — dřív id 0 | | |
| `[create_or_update_constraints] hotovo … (el:…)` | označí se UC — dřív id 0 | | |
| `[diagram vytvoren] "P4 Mail UC (pumpa)" (dgm:…)` | označí se **diagram** — dřív id 0 | | |
| `[place_elements_on_diagram] hotovo … (dgm:…)` | označí se diagram — dřív id 0 | | |
| `[smazano] …` (až po P8) | nic se nestane (není kam skočit) | | |

Protože má eaexample v `FB_Config` zapnutý `navProbe: true`, po každém dvojkliku přibude v Output tabu i řádek `dblclick debug v5: tab='AI Bridge' id=… line='…'` — **opiš `id=` a začátek `line=`** aspoň u package a diagram řádku (potvrdí, že marker došel do handleru). Pokud se u package/diagramu nic neoznačí a debug řádek marker (`(pkg:` / `(dgm:`) v `line=` **neobsahuje**, je LineText v EA useknutý na 30 znaků jen v debugu, nebo nedorazil vůbec — zapiš přesně.

## P8 — delete package z P4 (ELEVATED) — plná cesta v dialogu (ověření 1b)

**Dávka:** `req-P8.json` — nahraď `GUID-PKG-Z-P4` hodnotou GUID-PKG z P4. Pokud jsi v P3 rozhodl smazat i další package, přidej je do `targets` (**nejdřív** položky z P3, **naposled** GUID-PKG z P4 — kdyby některá z P3 už neexistovala, chybová větev 1c ukáže, co se stihlo).

**Očekávaný výstup:**

- konzole: `CEKA NA POTVRZENI req-P8.json -> requests\pending\` → **popup pumpy**. V popupu (a stejný text na konzoli) musí být:
  ```
  Chysta se SMAZAT 1 prvek z modelu.

  Balicky: P4 Mail (pumpa)
  Kde (plna cesta mazaneho): <plná cesta>.#FB-TEST.P4 Mail (pumpa)
  ```
  Řádek **„Kde (plna cesta mazaneho)"** je nový (nález MLA 31. 8.); cesta musí začínat stejně jako `whitelist.path` z P2 a končit jménem package. Při více cílech jsou cesty jako odrážky `  - …`.
- **Ano** → `POTVRZENO a provedeno req-P8.json -> processed\`; `res-P8.json`: `"status":"done"`, `results[0].items[]` `deleted:true`. Konzole ani res už neukazuje `confirm_required` (finální ACK v témž kroku — parita s kritériem 13).
- Pokud některý cíl neexistoval (1c): `"status":"error"`, `code":"E_NOT_FOUND"`, `message` obsahuje `smazano pred chybou: X z Y, neprovedeno: Z` a `items[]` má **i selhaný cíl** (`deleted:false`, `code`, `index`). Zapiš — a smazání zbytku zopakuj novou dávkou jen se zbývajícími GUIDy.
- Output tab: řádky `[smazano] Package "P4 Mail (pumpa)" …` — dvojklik na ně nic nedělá (doplň do tabulky P7).
- EA: package P4 Mail (pumpa) v Project browseru zmizela (i s UC, scénáři, diagramem).

| Kolonka | Hodnota |
|---|---|
| popup: text hlavičky | |
| popup: řádek „Kde (plna cesta mazaneho)" — přesně | |
| cesta souhlasí s whitelist.path z P2 | |
| finální status v res / items | |
| ✅/❌ | |

## P9 — GUI fallback tou samou dávkou jako P2 (bez pumpy)

**Udělej:** **zavři pumpu** (křížek na konzoli). Ulož `req-P9.json` do `requests\`. V EA: menu **Specialize → AI Bridge → Process requests (File Bridge)**.

**Očekávaný výstup:** EA dialog `Zpracovano 1 davek, odmitnuto 0 (req-P9.json) …`; `res-P9.json` = stejný tvar jako `res-P2.json` (`echo` = `gui-fallback`, whitelist s toutéž `path`). Output tab: `FB GUI fallback: req-P9.json zpracovano`. Schránka opět nedotčená (GUI fallback ACK nerenderuje — stejně jako pumpa).

| Kolonka | Hodnota |
|---|---|
| dialog EA — text | |
| res-P9 shodné s res-P2 (path whitelistu) | |
| schránka nedotčená | |
| ✅/❌ | |

---

## Tabulka výsledků (souhrn)

| Krok | Co ověřuje | ✅/❌ | Poznámka |
|---|---|---|---|
| P0 | start pumpy, baseline N operací | | |
| P1 | deploy_src pumpou + reload + re-attach po restartu EA | | |
| P2 | ping kotva; **kde je ACK** (neutralita §8/5) | | |
| P3 | stav #FB-TEST, rozhodnutí o zbytcích | | |
| P4 | řetěz $N, markery v Output | | |
| P5/P5b | chyba uprostřed + oprava z res | | |
| P6 | PNG souborem | | |
| P7 | prokliky per typ (1a) | | |
| P8 | plná cesta v ELEVATED dialogu (1b), chybová větev (1c) | | |
| P9 | GUI fallback = táž dávka, bez pumpy | | |

## Známé pasti

- Nový kód **EA runtime** (dvojklik P7, menu P9) platí až po **plném restartu EA** (PROTOKOL §1a) — proto restart hned v P1.
- Popup pumpy má timeout 300 s; Storno/timeout = dávka čeká v `pending\` a pumpa ji po restartu znovu nabídne. Nezavírej popup křížkem — použij Ano/Ne.
- Pumpa a GUI fallback nikdy zároveň (oba čtou `requests\`).
- Visící modál během dávky → po odkliku hrozí falešné `rowCount: 0` (PROTOKOL §5a/5) — ověř kontrolním čtením v nové dávce, ne opakováním.
- `.git\index.lock` po Cowork commitu na mountu — pokud VS Code hlásí zamčený index, smaž `C:\GIT\ea-file-bridge\.git\index.lock` ručně.

---

## Prompt pro vlákno „Z260904-1b vyhodnocení" (zkopíruj celý)

```text
Z260904-1b vyhodnocení E2E pumpa — název tohoto vlákna (přejmenování ručně).
Vstup: C:\GIT\ea-file-bridge\docs\e2e-pumpa\PROTOKOL-E2E-PUMPA.md (protokol
s očekáváními) + níže vložené výsledky Miloše (texty z konzole, výňatky z
res-P*.json, vyplněné tabulky, poznámky k P7 prokliků a P8 dialogu).
Kontext: Paměť ANO — paměť ea-file-bridge platí celá (iterace 7 uzavřena;
Z260904-1 přidala 1a proklik per typ (marker (el:|pkg:|dgm:) v Output řádku),
1b plnou cestu v ELEVATED dialogu (summary.paths), 1c chybovou větev delete;
harness 211/211; zjištění: pumpa chat ACK nerenderuje — jen res-*.json +
Output tab). Pracuj v C:\GIT\ea-file-bridge; IT-ANALYSIS jen číst. Do EA
nezapisuj, MCP Enterprise Architect nepoužívej.

0. Prescan: git log --oneline -3 (čekej commit "feat(output+confirm): …"),
   node test\harness.js (čekej 211/211). Přečti protokol celý.
1. Vyhodnoť tabulku krok po kroku proti očekáváním v protokolu: ✅/❌ +
   důvod. U ❌ rozliš: chyba kódu / chyba protokolu (špatné očekávání) /
   chyba prostředí. Zvlášť rozhodni P2 (kde je ACK) — je to nález, ne bug:
   navrhni, zda pumpa má vypisovat chat verzi na konzoli (ANO/NE + proč).
2. Zapiš výsledky do docs\e2e-pumpa\VYSLEDKY-2026-09-07.md (tabulka + nálezy
   + rozhodnutí Miloše z P3). Do PROTOKOL-EAFB.md §11 doplň větu o transportu
   pumpa (ACK jen v res) a do §9c mapování řádků Output → cíl prokliku.
3. Opravy kódu jen pokud je nález jednoznačný a < 30 řádků (jinak zápřah);
   harness zelený, commit lokálně (git -c user.name="Milos Lang"
   -c user.email="milosxlang@gmail.com"), PUSH NE.
4. Korekce paměti ea-file-bridge (co je doloženo živě, co padlo) + řádek
   Z260904-1b do tabulky Zápřahy v C:\Users\milos\CLAUDE\IT-ANALYSIS\_MOC.md
   + stavová hlavička v IT-ANALYSIS\zaprah-vlaken-2026-09-04.md.
Výstup: VYSLEDKY soubor + případný commit + shrnutí v chatu (co zbývá ručně
dle skillu predavani-tasku).
```
