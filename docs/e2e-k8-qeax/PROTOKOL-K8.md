# K8 — bridge v QEAX modelu se zapnutou EA security: klikací protokol (A1–A4)

Datum přípravy: 2026-09-04 (vlákno Z260904-6) · Provede: Miloš u EA, **Čt–Pá 10.–11. 9. 2026** · Model: QEAX (security ZAPNUTA; název souboru doplň níže) · Kód: commit tohoto vlákna v `C:\GIT\ea-file-bridge` (harness 220/220) · Nahrazuje nikdy nespuštěný zápřah `IT-ANALYSIS\zaprah-vlaken-2026-08-21.md`.
Vyhodnocení: ACK a poznámky vkládej do **nového vlákna „Z260904-6b vyhodnocení"** (prompt na konci souboru). To vlákno se spouští **DVAKRÁT**: poprvé po K3 (doplní identitu repa + GUID do configů a commitne — bez toho nejde dál), podruhé po A4 (vzor hlášky A3, §6g živě, commit).

## Co se tady ověřuje a proč

Na eaexample je security vypnutá, takže vrstvy autorizace 2 a 3 (`PROTOKOL-EAFB.md` §6g/A) kryje jen harness. QEAX má security zapnutou a už jeden cizí add-in (vendor `ExtendedPropertiesAddin`) — je to zároveň **generálka na bankovní nasazení** (Po 14. 9.). Testy:

| Test | Vrstva | Co dokazuje |
|---|---|---|
| A1 | 2 (write fíčury za EA skupinou) | člen skupiny `EAFB Write` zapíše LOW dávkou do `#FB-TEST`; Output proklik funguje i v QEAX |
| A2 | 2 | nečlen → `E_ADDIN_ACCESS` s čitelnou hláškou, nic se neprovede; čtecí dávka projde |
| A3 | 3 (balíčková práva EA) | zápis do package zamčené na skupinu → **syrová EA hláška** = vzor pro `FB_InterpretError` (otevřený bod od commitu 0300cfb) |
| A4 | 1 (aktivace add-inu) | `t_xrefsystem` nese `UserSettings` / `GroupSettings` (SELECT z §6g, SQLite dialekt) |

Vedlejší doklady: přenos add-inu mezi modely (Copy/Paste + bootstrap + `deploy_src` přepne receptions na lokální SignalGUID), dialog **Manage Add-Ins v security modelu** (screenshot — poprvé naživo), jména security tabulek na SQLite.

## Co je jinak než 21. 8. (čti před během)

- **MCP Enterprise Architect se nepoužívá** — všechno čtení i zápis jdou dávkami, které pouštíš ty.
- **Slepice-vejce configů** řeší bootstrap **dvakrát**: K2 nalije kód s placeholdery (`<QEAX-FILENAME>`, `<GUID-685>`), K3 čtecí dávka bez pole `repo` zjistí identitu repa a GUIDy, vlákno 6b je doplní do configů a commitne, **K4 = bootstrap podruhé** (už se skutečnými hodnotami). Teprve pak funguje `deploy_src` (K6), který navíc přepne receptions (menu add-inu).
- Bootstrap od tohoto vlákna nalévá kód do **všech** operací, které mají soubor v `src\` (dřív jen 57 ze SIG) — bez toho by `FB_AccessGroups`/`FB_RiskPolicy` zůstaly s hodnotami z eaexample.
- **Cache `FB_UserAccess` platí na session** → každá změna členství ve skupině = **plný restart EA** (File → Exit, spustit znovu). Reload modelu nestačí.
- Dokud jsou v configu placeholdery, **žádný zápis do QEAX neprojde** (E_REPO / E_ADDIN_ACCESS / ELEVATED bez politiky) — kryto harnessem, takže K2/K3 nic nerozbijí.

## Jak se posílají dávky

**Schránka** (od K6, kdy funguje menu): otevři `docs\e2e-k8-qeax\req-<krok>.json`, nahraď zástupné `GUID-…` skutečnými hodnotami z předchozích ACK, **Ctrl+A, Ctrl+C** celý obsah → v EA **Specialize → AI Bridge → Zpracovat davku ze schranky** → dialog s ACK (chat verze je zároveň ve schránce: Ctrl+V do vlákna 6b). Plná odpověď = `<složka modelu>\EA-File-Bridge\responses\res-<id>.json` (baseDir pro QEAX není nastaven → default vedle modelu, `FB_ResolveBaseDir`).

**Pumpa** (K3 když menu mlčí, K6 vždy): EA s QEAX otevřená (**jediná** běžící EA — pumpa se připojí na první), dvojklik `C:\GIT\ea-file-bridge\pump.wsf`, soubor dávky ulož do `C:\GIT\ea-file-bridge\requests\`, výsledek `C:\GIT\ea-file-bridge\responses\res-<id>.json` (pumpa čte složky vedle sebe bez ohledu na model). Popup Ano/Ne u ELEVATED. Pumpa a schránka nikdy zároveň — před schránkou pumpu zavři (křížek).

Do tabulek zapisuj ✅/❌ + co bylo jinak. Když něco selže, **neopravuj naslepo** — zapiš krok, text z Output tabu / konzole a obsah res souboru do vlákna 6b. Nic z `responses\` nemaž.

---

## K0 — příprava (5 min)

1. **Název souboru QEAX** (title bar EA, např. `Moje.qeax`): ______________________ ← zapiš sem. Identitu repa pro configy dá až K3 (`repository` v ACK) — název souboru je jen kontrola.
2. **Záloha:** zavři EA, zkopíruj soubor QEAX vedle sebe jako `<název>-BEFORE-K8.qeax` (Explorer, Ctrl+C/Ctrl+V, přejmenovat). Levná pojistka proti čemukoli v K1–K6.
3. **Režim security QEAX:** otevři QEAX → Settings/Configure → Security → zapiš, který režim platí: ☐ standardní (edit povolen, dokud není zamčeno) ☐ **Require User Lock to Edit** (nic nejde editovat bez vlastního zámku). Ve druhém režimu si před K1 a K2 **zamkni package `EA Addins` (380) i `Test Data` (377)** (pravým → Lock Package → Apply User Lock, včetně obsahu), jinak paste i bootstrap spadnou na zámku. Zapiš i přihlašovací jméno, pod kterým v QEAX jsi: ______________ (= `login` v ACK).
4. Ověř, že v QEAX existují `#FB-TEST` (685) a `#AI-LOG` (686) pod `Test Data` (377) — založeny přes MCP 21. 8. Když chybí, založ je ručně (Add Package) se stejnými jmény a zapiš to; čísla ID pak budou jiná → K3 je vypíše.

| Kolonka | Hodnota |
|---|---|
| název souboru QEAX | |
| režim security / login | |
| záloha vytvořena | |
| 685/686 existují | |

## K1 — přenos add-inu z eaexample do QEAX

1. Zavři QEAX, otevři `EAExample.qea`. V Project browseru najdi element **AICodeBridge** (package `EA Addins`, stereotyp JavascriptAddin). Pravým → **Copy / Paste → Copy** (element se všemi operacemi a receptions jde do schránky jako XML).
2. Zavři eaexample, otevři QEAX. Pravým na package **EA Addins (380)** → **Copy / Paste → Paste Element(s)…** → v dialogu zvol **Full Structure for Duplication** → OK.
3. Kontrola: pod `EA Addins` je nový **AICodeBridge**; dvojklik → záložka Operations ukazuje ~103 operací (`FB_Main`, `FB_Whitelist`, `EA_MenuClick`…). Vedle něj zůstává vendor `ExtendedPropertiesAddin` — nesahat.

**Když paste selže / EA odmítne cizí element:** pokračuj rovnou K2 — bootstrap element založí sám (označ package `EA Addins` v browseru před spuštěním). Menu add-inu pak vznikne až K6 (`deploy_src` receptions zakládá). Zapiš to.

| Kolonka | Hodnota |
|---|---|
| paste proběhl / počet operací | |
| ✅/❌ | |

## K2 — ITAN-Bootstrap (kód z disku, placeholdery) + Manage Add-Ins + plný restart

1. V QEAX **Specialize → Scripting** (okno Scripting) → pravým na skupinu (nebo New Script Group „K8") → **New JScript**, jméno `ITAN-Bootstrap` → otevři skript, vlož celý obsah souboru `C:\GIT\ea-file-bridge\scripts\ITAN-Bootstrap File Bridge.js` (Poznámkový blok, Ctrl+A, Ctrl+C) → Save → **Run** (zelená šipka). Skript si sám najde `C:\GIT\ea-file-bridge\src\`.
2. **Očekávaný výstup** (System Output → záložka Script):
   ```
   === ITAN-Bootstrap File Bridge ===
   Slozka src: C:\GIT\ea-file-bridge\src\
   Element AICodeBridge uz existuje (elementID <N>) - jen doplnim operace/kod.
   OK  B64Decode (…)
   … (jeden řádek OK na každý soubor v src; EA_* co chybí → "--  EA_… (reception chybi - zalozi deploy_src, ne bootstrap)")
   Hotovo: <X> operaci zalozeno, <Y> nahran kod (souboru v src: 105).
   ```
   Zapiš X a Y. Po K1 přes paste čekáme X = 0…několik (operace, které v eaexample modelu ještě nebyly nasazené), Y = 105. Bez paste (element založen bootstrapem) X ≈ 100, plus výčet `BEZ RECEPTION` s `EA_*`.
3. **Specialize → Manage Add-Ins**: řádek **AICodeBridge** → zaškrtni **Enabled** + **Load on startup**. Tohle je **dialog v security modelu — poprvé naživo**: udělej **screenshot** (Win+Shift+S) do `docs\e2e-k8-qeax\manage-addins-security.png` a zapiš, co dialog nabízí navíc proti eaexample (sloupec/tlačítko pro **skupinu** = `GroupSettings` v `t_xrefsystem`? per-user jen `UserSettings`?). Pokud jde add-in přiřadit skupině, **zatím to nedělej** — aktivuj jen sebe (per-user); skupinová aktivace je kandidát na A4b.
4. **PLNÝ restart EA** (File → Exit, spustit QEAX znovu). Kód EA runtime (menu, dvojklik) se načítá jen při startu.
5. Po startu: menu **Specialize → AI Bridge** ☐ je vidět (receptions z eaexample sedí na lokální signály) ☐ **mlčí** (cizí SignalGUID — čekaný stav; spraví K6). Obojí je v pořádku, jen to určuje kanál pro K3.

| Kolonka | Hodnota |
|---|---|
| bootstrap: X zalozeno / Y nahran kod | |
| Manage Add-Ins: co dialog nabízí (screenshot uložen) | |
| menu AI Bridge po restartu: vidět / mlčí | |
| ✅/❌ | |

## K3 — první čtecí dávka BEZ pole `repo` (recon) → ACK do vlákna 6b

**Dávka:** `req-K3.json` — schválně **bez `"repo"`** (kontrola identity se přeskočí; zápisy stejně neprojdou, configy mají placeholdery). Kanál: menu vidět → schránka; menu mlčí → pumpa (`pump.wsf`, soubor do `requests\`). U pumpy zapiš i řádek `Code loader: <N> operaci nacteno z modelu` (N = počet operací s kódem, čekáme ~105).

**Očekávaný výstup:** `"status":"done"`, 8/8 ops. Z ACK/res potřebuje vlákno 6b **doslova**:

| Co | Kde v res | Poznámka |
|---|---|---|
| **identita repa** | `"repository": "…"` (kořen res) | u .qeax = cesta k souboru; 6b z ní vezme název souboru jako `repo` do configů |
| `access` | `results[0].access` | čekáme `securityEnabled: true`, `login` = ty, `access: "read"`, `reason` „repozitar nema polozku ve FB_AccessGroups" (placeholder nesedí) — **správně, fail-closed**; `groups[]` = tvé skupiny (SQL nad `t_secuser_group` prošel ⇒ jména tabulek na SQLite potvrzena) |
| `whitelist` | `results[0].whitelist` | čekáme `[]` |
| **GUID 685 / 686** | `results[1].rows` | `ea_guid` řádku `#FB-TEST` → do `FB_Whitelist`; `#AI-LOG` jen kontrola |
| GUIDy signálů | `results[2].rows` | 1966 `EA_Connect`, 1967 `EA_OnOutputItemDoubleClicked`, 2079 `EA_MenuClick`, 2080 `EA_GetMenuItems` … — porovnání s eaexample `{5F05064B-…}` řekne, proč menu mlčelo |
| add-in element | `results[3].rows` | `ea_guid` AICodeBridge = `Supplier` pro A4 |
| počet operací | `results[4].rows[0].cnt` | čekáme ~103–105 |
| receptions | `results[5].rows` | `StyleEx` u `EA_*` — `Reception=1;SignalGUID={…}` s cizím nebo lokálním GUID |
| skupiny | `results[6].rows` | existující `t_secgroup` — jestli `EAFB Write` už je, K5 ji jen použije |
| kontext | `results[7]` | co bylo označeno v browseru (nepovinné; `selected:false` je OK) |

**Pak:** založ vlákno **„Z260904-6b vyhodnocení"** (prompt dole), vlož celý res-K3 (nebo ACK ze schránky + res). Vlákno nahradí `<QEAX-FILENAME>` (5 souborů v `src\` + dávky v této složce) a `<GUID-685>` (`FB_Whitelist` + dávky) a commitne. **Bez toho commitu nepokračuj** — K4 čte disk.

| Kolonka | Hodnota |
|---|---|
| kanál (schránka/pumpa) · Code loader N | |
| repository (identita) | |
| access: login / access / reason / groups | |
| GUID #FB-TEST (685) / #AI-LOG (686) | |
| cnt operací · receptions cizí/lokální | |
| ✅/❌ | |

## K4 — bootstrap podruhé (skutečné configy) + plný restart

1. Ověř na disku, že `src\AICodeBridge.FB_Whitelist.js` už nemá `<QEAX-FILENAME>` ani `<GUID-685>` (otevři v Poznámkovém bloku).
2. Scripting → skript `ITAN-Bootstrap` → **Run**. Čekáme `Hotovo: 0 operaci zalozeno, 105 nahran kod`.
3. **PLNÝ restart EA.**

| Kolonka | Hodnota |
|---|---|
| Hotovo řádek | |
| ✅/❌ | |

## K5 — security: skupina „EAFB Write" + sebe do ní + plný restart

1. Settings/Configure → **Security → Manage Groups** (EA 17: ribbon Settings → Security): New group **`EAFB Write`** (přesně takto, mezera; porovnání je case-insensitive). Zapiš `GroupID`, pokud ho dialog ukazuje.
2. **Security → Manage Users** → tvůj login → Groups → přidej `EAFB Write`. Nic jiného (žádné package permissions) — vrstvu 3 řeší až A3.
3. Založ i druhou skupinu **`EAFB Locked`** (pro A3) — **do ní se nepřidávej**.
4. **PLNÝ restart EA** (cache `FB_UserAccess`).

| Kolonka | Hodnota |
|---|---|
| skupiny založeny (Write / Locked) · jsi v Write | |
| ✅/❌ | |

## K6 — `deploy_src` PUMPOU (receptions → lokální signály) + plný restart

**Dávka:** `req-K6-deploy.json` (po 6b nese skutečné `repo`). Spusť pumpu, soubor do `requests\`. `deploy_src` je ELEVATED → **popup pumpy → Ano**. Deploy je zapisová operace → **teprve tady se poprvé uplatní vrstva 2** (jsi člen `EAFB Write` po restartu ⇒ projde).

**Očekávaný výstup:**
- konzole: `CEKA NA POTVRZENI req-K6-deploy.json -> requests\pending\` → popup (`Proc potvrzeni: … deploy_src …`) → po **Ano** `POTVRZENO a provedeno …` + `deploy_src (potvrzeny) -> prenacitam kod z modelu` + `Code loader: <N> operaci …`.
- `res-K6.json`: `"status":"done"`; `results[0]`: `"updated":[…]` (~105), `"created":[]` nebo výčet `EA_*` (když K1 šel bez paste), a **`"receptions": ["EA_MenuClick -> Signal {…} (prepnuto z ciziho GUID - preneseny add-in)", …]`** — přesně tenhle text je důkaz přenosu mezi modely. Když `receptions` chybí a menu v K2 už bylo vidět, signály měly stejné GUIDy v obou modelech (zapiš — zajímavé pro banku).
- Kdyby místo toho přišlo `E_ADDIN_ACCESS`: nebyl plný restart po K5, nebo jméno skupiny nesedí (`reason` v res to řekne). Oprav, restart, znovu.
- **Zavři pumpu**, **PLNÝ restart EA**. Po startu: **Specialize → AI Bridge** menu je vidět (položky „Zpracovat davku ze schranky", „Zpracovat davky ze slozky (requests)", …).
- Kontrola schránkou: `req-K6b-ping.json` → ACK ve schránce: `access: write`, `reason` „clen write skupiny dle FB_AccessGroups", whitelist s `#FB-TEST` a plnou cestou (zapiš cestu — použije se v A1/A3). Od teď všechno schránkou.

| Kolonka | Hodnota |
|---|---|
| popup / updated / created / receptions | |
| menu AI Bridge po restartu vidět | |
| K6b: access · reason · whitelist path | |
| ✅/❌ | |

## A1 — člen skupiny: LOW zápis do #FB-TEST + Output proklik

**Dávka:** `req-A1.json` (package `K8 A1 (clen skupiny)` pod `#FB-TEST` + UC v něm). Může skončit `EAFB CEKA NA POTVRZENI A1 (ELEVATED …)` — u schránky dávka čeká v `pending\` a potvrzuje se dialogem EA (nová struktura → `affectedPackages`) → **Ano**; finální ACK pak nese GUIDy.

**Očekávaný výstup:** ACK `EAFB OK A1: 2/2 ops`, GUID package (**zapiš jako `GUID-A1`**, potřebuje ho K9) + GUID UC. Output tab **AI Bridge**: blok `FB A1 - zmeny v modelu` s řádky `[vytvoreno] package "K8 A1 (clen skupiny)" @ <cesta> (pkg:…)` a `[vytvoreno] "UC K8 A1 …" (el:…)`. **Dvojklik** na řádek UC → Project browser označí UC; dvojklik na řádek package → označí package (Z260904-1, 1a). Audit: v `#AI-LOG` (686) přibyl Artifact `FB A1` (pokud ne → `warnings` v res, zapiš; audit je best-effort).

| Kolonka | Hodnota |
|---|---|
| status / GUID-A1 / GUID UC | |
| proklik UC · proklik package | |
| audit v #AI-LOG | |
| ✅/❌ | |

## K7 — vyřadit se ze skupiny + plný restart (příprava A2)

Security → Manage Users → tvůj login → odeber `EAFB Write` → **PLNÝ restart EA**. (Bez restartu A2 projde — cache — a test je neplatný.)

## A2 — nečlen: zápis = E_ADDIN_ACCESS, čtení projde

1. **Dávka `req-A2-write.json`** → očekáváme dialog/ACK **`EAFB CHYBA A2w: E_ADDIN_ACCESS Zapisove ficury bridge nejsou pro uzivatele '<login>' povolene (EA security skupiny, FB_AccessGroups): uzivatel neni clenem zadne write skupiny dle FB_AccessGroups (EAFB Write) - cteci operace funguji … Nic nebylo provedeno.`**, `results[0].status: "skipped"`. Package `K8 A2 NESMI VZNIKNOUT` v browseru **není** (Refresh). Output tab: `FB A2w -> E_ADDIN_ACCESS (<login>: …)`.
2. **Dávka `req-A2-read.json`** → `"status":"done"`, 3/3: `access: read` + týž `reason`; `get_packages_information` vrací `#FB-TEST`; query vypíše podpackages 685 = jen `K8 A1 (clen skupiny)` (žádné A2).
3. Zapiš **doslova** hlášku z ACK (je to text, který v bance uvidí omezený uživatel).
4. **Vrať se do skupiny** (Manage Users → `EAFB Write`) → **PLNÝ restart EA**.

| Kolonka | Hodnota |
|---|---|
| A2w: kód / hláška doslova / package nevznikl | |
| A2r: status / access.reason / podpackages | |
| ✅/❌ | |

## A3 — zápis do package bez balíčkových práv → syrová EA hláška

Cíl: dostat **přesný text chyby Automation API**, když EA security odmítne zápis. Bridge na něj dnes reaguje jen klíčovými slovy (`FB_InterpretError`: nová větev „balíčková práva" má **zástupný vzor** — Group Lock / Require User Lock); 6b doplní přesný vzor.

1. **Dávka `req-A3a.json`** (jsi člen `EAFB Write`) → vznikne package `K8 A3 zamceny (skupina EAFB Locked)` pod `#FB-TEST` → **zapiš `GUID-A3`**.
2. **Zamkni ji na skupinu, ve které nejsi:** pravým na package → **Lock Package…** → volba **Group Lock** → skupina `EAFB Locked` → OK. (Ve standardním režimu security je group lock dostupný; v režimu Require User Lock to Edit je alternativa: **nezamykat vůbec** — bez vlastního zámku EA edit odmítne. Zapiš, kterou variantu QEAX nabídl.) Když QEAX žádnou z variant nenabízí → zapiš „A3 nedostupné: <proč>" a přeskoč na A4.
3. **Dávka `req-A3b.json`** — nahraď `GUID-A3-Z-ACK-A3a` hodnotou `GUID-A3` → vloží UC do zamčené package. **Očekáváme chybu**, přijatelné jsou tři podoby, zapiš, která nastala:
   - `E_PERMISSION` s textem „Nemas balickova prava …" (zástupný vzor trefil) — **nejlepší**;
   - `E_LOCKED` („Cilovy prvek/balicek je zamceny …") — hláška obsahovala „locked", starší větev ji chytla dřív, vzor se doladí;
   - `E_EXCEPTION` s holým textem EA — vzor netrefil vůbec.
   Ve všech případech je v `message` za „Puvodni hlaska EA:" (nebo přímo) **syrový text** — **opiš doslova** (to je hlavní výstup A3). Pokud EA zápis **povolila** (UC vznikl), zapiš ✅-nečekané: group lock přes API neplatí → důležitý nález pro banku (vrstva 3 pak stojí jen na `@F002_Write` package permissions, ne na zámcích).
4. Odemkni package (Lock Package → Unlock) — kvůli úklidu K9.

| Kolonka | Hodnota |
|---|---|
| GUID-A3 · varianta zámku (group lock / require user lock / nedostupné) | |
| A3b: kód z ACK · **syrová hláška doslova** | |
| UC vznikl? (nečekané) | |
| ✅/❌ | |

## A4 — t_xrefsystem: UserSettings / GroupSettings (aktivace add-inu)

**Dávka:** `req-A4.json` (4 čtecí query, SQLite dialekt `||`; první je SELECT z `PROTOKOL-EAFB.md` §6g).

**Očekávaný výstup:** `"status":"done"`, 4/4:
- `results[0].rows`: aspoň jeden řádek `Type = UserSettings`, `UserLogin` = ty, `Supplier` = GUID AICodeBridge (z K3 results[3]), `Name = AICodeBridge`; vedle něj možná řádek pro vendor add-in. Pokud jsi v K2 add-in přiřadil skupině, i řádek `GroupSettings` s `GroupName`. **To je důkaz vrstvy 1** (aktivace add-inu bydlí v `t_xrefsystem`, audit správce = tento SELECT).
- `results[1].rows`: totéž bez joinů (kdyby JOIN na SQLite něco vynechal) + `Description`.
- `results[2].rows`: členství — ty × `EAFB Write` (a nikdo v `EAFB Locked`).
- `results[3].rows`: `t_seclocks` — po odemknutí v A3 prázdné, nebo tvé user locky z K0 (režim Require User Lock). Když query selže (jiné sloupce), je poslední → předchozí 3 výsledky zůstávají; zapiš hlášku.

**A4b (nepovinné, jen když Manage Add-Ins v K2 skupinovou aktivaci nabízí):** přiřaď add-in skupině `EAFB Write` → plný restart → znovu `req-A4.json` (id změň na `A4b`) → řádek `GroupSettings` s `GroupName = EAFB Write`. Zapiš.

| Kolonka | Hodnota |
|---|---|
| UserSettings řádek (login, Supplier=AICodeBridge) | |
| GroupSettings řádek (pokud) | |
| členství · t_seclocks | |
| ✅/❌ | |

## K9 — úklid (volitelné, ELEVATED)

`req-K9-uklid.json` — nahraď `GUID-A1-Z-ACK-A1` a `GUID-A3-Z-ACK-A3a`; A3 package musí být odemčená. Dialog ukáže **plné cesty** obou package (Z260904-1, 1b) → Ano. Skupiny `EAFB Write`/`EAFB Locked` **nech** — použije je banka-generálka a případné opakování.

---

## Tabulka výsledků (souhrn)

| Krok | Co ověřuje | ✅/❌ | Poznámka |
|---|---|---|---|
| K0 | příprava, režim security, záloha | | |
| K1 | přenos add-inu Copy/Paste mezi modely | | |
| K2 | bootstrap (105 souborů), Manage Add-Ins v security modelu (screenshot), menu po restartu | | |
| K3 | recon bez `repo`: identita, GUIDy, tabulky t_sec* na SQLite, fail-closed read | | |
| K4 | bootstrap podruhé se skutečnými configy | | |
| K5 | skupiny EAFB Write / EAFB Locked | | |
| K6 | deploy_src pumpou: vrstva 2 pustí člena; receptions přepnuty; menu | | |
| A1 | člen: LOW zápis + proklik + audit | | |
| K7 | vyřazení + restart | | |
| A2 | nečlen: E_ADDIN_ACCESS, čtení projde | | |
| A3 | balíčková práva: syrová hláška | | |
| A4 | t_xrefsystem UserSettings/GroupSettings | | |
| K9 | úklid | | |

## Známé pasti

- **Plný restart EA** po každé změně členství (A2 negativní test jinak lže) a po každém deployi kódu EA runtime (K2, K4, K6).
- **Jedna běžící EA** při pumpě — eaexample musí být zavřený (pumpa se připojí na první instanci).
- Popup pumpy timeout 300 s; Storno = dávka čeká v `pending\`. Nezavírej křížkem.
- Visící modál během dávky → falešné `rowCount: 0` (PROTOKOL §5a/5) → ověř kontrolním čtením, ne opakováním.
- Audit do `#AI-LOG` (686) může před K4 selhávat (whitelist/placeholdery) — je best-effort (warning, ne pád).
- Režim **Require User Lock to Edit**: bootstrap i paste vyžadují tvůj zámek na `EA Addins`; deploy_src taky (add-in element). Zamkni včetně obsahu.
- `.git\index.lock` po Cowork commitu na mountu — pokud VS Code hlásí zamčený index, smaž `C:\GIT\ea-file-bridge\.git\index.lock` ručně.

---

## Prompt pro vlákno „Z260904-6b vyhodnocení" (zkopíruj celý; spouští se dvakrát — 1. běh po K3, 2. běh po A4)

```text
Z260904-6b vyhodnocení K8 QEAX — název tohoto vlákna (přejmenování ručně).
Vstup: C:\GIT\ea-file-bridge\docs\e2e-k8-qeax\PROTOKOL-K8.md (protokol s
očekáváními) + níže vložené výsledky Miloše (res-*.json / ACK ze schránky,
vyplněné tabulky, poznámky). Napiš mi, který BĚH to je: (1) po K3, nebo
(2) po A4.
Kontext: Paměť ANO — paměť ea-file-bridge platí (Z260904-6 přidala configy
QEAX s placeholdery <QEAX-FILENAME> / <GUID-685> do FB_Whitelist, FB_Config,
FB_OpsAllowed, FB_RiskPolicy, FB_AccessGroups; FB_InterpretError větev
balíčkových práv se ZÁSTUPNÝM regexem; bootstrap nalévá všech 105 souborů;
harness 220/220). Pracuj v C:\GIT\ea-file-bridge; IT-ANALYSIS jen číst. Do
EA nezapisuj, MCP Enterprise Architect nepoužívej.

0. Prescan: git log --oneline -3 (čekej commit "feat(k8): configy QEAX …"),
   node test\harness.js (čekej 220/220; po běhu 1 čekej totéž — nahrazení
   placeholderů harness pokryje: test "placeholder PRAVE JEDNOU" se v běhu 1
   PŘEPÍŠE na test skutečné hodnoty, viz níže).

BĚH 1 (po K3):
1. Z res-K3 vezmi `repository` → identita repa = NÁZEV SOUBORU (poslední
   část cesty, např. "MOJE.QEAX"; porovnání je case-insensitive substring
   ConnectionString — nikdy celá cesta, je stanice-závislá) a `ea_guid`
   package #FB-TEST (results[1], Package_ID 685).
2. Nahraď "<QEAX-FILENAME>" ve VŠECH pěti src configech + ve všech
   docs\e2e-k8-qeax\req-*.json; "<GUID-685>" ve FB_Whitelist + req-A1/A2/
   A3a/A2-read. Komentáře o placeholderech přepiš na „doplněno 6b <datum>".
3. test\harness.js: test "K8: placeholder … PRAVE JEDNOU" změň na kontrolu,
   že v 5 configech je 1× skutečná identita a 0× placeholder; test
   "K8 fail-secure: … repo neodpovida placeholderu" nech (mock identita je
   jiná než skutečná). Harness zelený.
4. Do PROTOKOL-K8.md zapiš výsledky K0–K3 do tabulek (co Miloš dodal) +
   nálezy (jména t_sec* tabulek na SQLite potvrzena? cizí vs. lokální
   SignalGUID?). Commit lokálně (git -c user.name="Milos Lang"
   -c user.email="milosxlang@gmail.com") "chore(k8): identita QEAX + GUID
   #FB-TEST do configu (po K3)", PUSH NE. Řekni Milošovi: pokračuj K4.

BĚH 2 (po A4):
1. Vyhodnoť K4–A4 krok po kroku proti očekáváním (✅/❌ + důvod; u ❌ rozliš
   chyba kódu / chyba protokolu / chyba prostředí).
2. A3: ze syrové hlášky udělej PŘESNÝ vzor do FB_InterpretError (první
   alternativa regexu větve balíčkových práv, zástupný komentář nahraď
   skutečným textem + datem) + test s doslovnou hláškou v harnessu. Pokud
   A3 bylo nedostupné nebo EA zápis povolila, zapiš to do komentáře větve
   a do PROTOKOL-EAFB §6g (vrstva 3 = jen package permissions, ne zámky).
3. PROTOKOL-EAFB.md §6g: doplň „Živě K8 QEAX <datum>" — A1–A4 výsledky,
   Manage Add-Ins v security modelu (odkaz na screenshot), t_xrefsystem
   řádky, jména tabulek na SQLite; MATICE-PARITY řádek feature A → živě.
   docs\e2e-iterace5\PROTOKOL-E2E-ITERACE5.md řádek K8 → ✅/⚠ s odkazem.
4. Výsledky do docs\e2e-k8-qeax\VYSLEDKY-<datum>.md (tabulka + nálezy +
   doporučení pro banku Po 14. 9.: co z K8 přenést do NAVOD-NASAZENI-KLIKACI
   — předej jako vstup Z260904-5, needituj jeho soubory).
5. Harness zelený, commit lokálně "feat(k8): FB_InterpretError presny vzor
   balickovych prav (A3 zivě); docs: vysledky K8 QEAX", PUSH NE.
6. Paměť ea-file-bridge (co je doloženo živě, co padlo) + řádek Z260904-6b
   do tabulky Zápřahy v C:\Users\milos\CLAUDE\IT-ANALYSIS\_MOC.md + stavová
   hlavička v IT-ANALYSIS\zaprah-vlaken-2026-09-04.md.
Výstup: commit + shrnutí v chatu (co zbývá ručně dle skillu predavani-tasku).
```
