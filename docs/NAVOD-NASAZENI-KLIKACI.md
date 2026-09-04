# Nasazení EA File Bridge — klikací návod (bez terminálu)

Verze **v1.0**, 2026-09-04 (vlákno Z260904-5) · Kód: stav po iteracích 5–7 (`docs/PROTOKOL-EAFB.md` v0.12, registr **42 operací**, harness 220/220) · Provede: **Miloš, v bance Po 14. 9. 2026**

> **Co tenhle soubor je.** Postup v pořadí, v jakém se to v bance skutečně klikne — od pullu kurýrního klonu po první ping. Žádný terminál: git jde přes **VS Code → Source Control**, kód do modelu přes **EA UI**, dávky přes **pumpu (dvojklik)** nebo **schránku (menu v EA)**.
> **Co tenhle soubor NENÍ.** Není to protokol testu (ty jsou `docs/e2e-pumpa/PROTOKOL-E2E-PUMPA.md` a `docs/e2e-k8-qeax/PROTOKOL-K8.md`) ani plán fáze 2 POC (`docs/NAVOD-NASAZENI-BANKA.md`, který na tenhle návod odkazuje).
> **Vrátný (AI import režim) se v bance NENASAZUJE** — je mimo rozsah tohoto návodu (důvod: AV-optika dlouhoběžícího PowerShell watcheru, `PROTOKOL-EAFB.md` §9b). V bance jedou dva kanály: **pumpa** (`pump.wsf`) a **schránka / složka** (menu uvnitř EA).

## Placeholdery — dosazuj lokálně, do repa NIKDY

| Placeholder | Co dosadit |
|---|---|
| `<TEST-DB>` | název **testovací** databáze repozitáře EA |
| `<PROD-DB>` | název **produkční** databáze (jen abys ji poznal — nic se na ni nenasazuje) |
| `<KLON>` | cesta kurýrního klonu, např. `C:\work\transfer\ea-file-bridge` |
| `<KORP>` | cesta pracovní kopie korporátního repa |
| `<AI-SANDBOX>` | package, kam smí AI zapisovat (whitelist větev) |
| `<AI-LOG>` | package auditu (Artifacty `FB <id>`) |
| `<WRITE-GROUP>` | název EA security skupiny s právem na write fíčury |

**Zásada celého nasazení:** na `<PROD-DB>` se nenasazuje ani nespouští nic. Whitelist i dávky jsou vázané na `<TEST-DB>`; při neshodě executor odmítne (`E_REPO`) a neprovede ani audit.

## Před startem si připrav (5 minut)

- [ ] VS Code s přístupem ke **kurýrnímu klonu** i k **pracovní kopii korporátního repa** (kanál: `PROBLEMS/kuryrni-kanal-prenos-repa.md`, fáze D–F).
- [ ] EA připojená na **`<TEST-DB>`** (title bar zkontroluj pohledem).
- [ ] Vědět, **jestli má repozitář zapnutou EA security** (Configure → Security). Rozhoduje o krocích 3.3 a 5.4.
- [ ] Vědět, do jakého package smí AI zapisovat (`<AI-SANDBOX>`) a kde je `<AI-LOG>`.
- [ ] **Záloha:** existující baseline / snapshot dle zvyklostí repozitáře. Bridge sám dělá session baseline whitelistovaných packages při startu pumpy, ale to je až druhá pojistka.

---

# 1. Pull kurýrního klonu a diff proti korporátnímu repu

## 1.1 Aktualizovat kurýrní klon

- **CO:** stáhnout do banky nový stav z osobního GitHubu (kurýrní kanál, fáze D).
- **KDE:** VS Code, otevřená složka `<KLON>`.
- **JAK:** levý panel **Source Control** (ikona větvení, `Ctrl+Shift+G`) → **…** (tři tečky nahoře) → **Pull**. Dole ve stavovém řádku sleduj kolotoč; když se zeptá na přihlášení, je to PAT (kanál fáze C/D).
- **OČEKÁVANÝ VÝSLEDEK:** Source Control nehlásí žádné změny k commitnutí; ve stavovém řádku vlevo dole je název větve bez šipky „↓ N". Kontrola stavu: **…** → **Checkout to…** ukáže seznam s tagem verze, kterou v bance nasazuješ.
- **KDYŽ SELŽE:** hláška „Repository not found" **není** překlep v názvu — je to sáhnutí po korporátní identitě. Řešení je v `kuryrni-kanal-prenos-repa.md` fáze D (identita `satrman1@` v URL).

## 1.2 Diff kurýrní klon × korporátní repo

- **CO:** zjistit, co se od minulého importu změnilo, a **rozhodnout, co v korporátním repu zůstane**.
- **KDE:** VS Code, otevřená složka `<KORP>` (druhé okno VS Code, `Ctrl+Shift+N`).
- **JAK:** zkopíruj obsah `<KLON>` **bez složky `.git`** přes `<KORP>` (Průzkumník: v `<KLON>` `Ctrl+A`, odznač `.git`, `Ctrl+C` → v `<KORP>` `Ctrl+V`, potvrď přepis). Pak ve VS Code panel **Source Control** ukáže seznam změněných souborů — **na každý klikni** a projdi diff (vlevo staré, vpravo nové).
- **OČEKÁVANÝ VÝSLEDEK:** v diffu vidíš jen změny z iterací, které nasazuješ. **Nečekaná položka v diffu = stop a vyšetřit** (kanál §10).

### Co v diffu ZACHOVAT (bankovní adaptace — vrátit zpět po přepisu)

Tyhle soubory nesou lokální hodnoty, které do repa nikdy nešly. Po překopírování v nich budou hodnoty z domácího repa — **přepiš je zpět** (nebo jejich řádky v diffu odmítni):

| Soubor | Co je bankovní adaptace |
|---|---|
| `src\AICodeBridge.FB_Whitelist.js` | položka `{ repo: "<TEST-DB>", pkg: "{GUID <AI-SANDBOX>}" }` |
| `src\AICodeBridge.FB_Config.js` | položka `{ repo: "<TEST-DB>", baseDir/srcDir, navProbe: false }` |
| `src\AICodeBridge.FB_OpsAllowed.js` | položka `<TEST-DB>` s **deny** dle 5.3 |
| `src\AICodeBridge.FB_AccessGroups.js` | položka `{ repo: "<TEST-DB>", writeGroups: ["<WRITE-GROUP>"] }` |
| `src\AICodeBridge.FB_RiskPolicy.js` | položka `<TEST-DB>` (`deploy_src: "BLOCKED"`) |
| `src\AICodeBridge.FB_QcConfig.js` | bankovní podmnožina QC kontrol |
| `.github\copilot-instructions.md` | `repo` = `<TEST-DB>` |
| cesty typu `C:\GIT\...` | lokální cesty klonu v bance |

- **JAK to ohlídat:** vede se **evidence adaptací v korporátním repu** (kanál fáze E bod 3). Před commitem importu si ji projdi jako checklist — každá položka evidence musí být v `<KORP>` ve své bankovní podobě, ne v podobě z diffu.

## 1.3 Commit importu

- **CO:** zapsat novou verzi do korporátního repa jedním commitem.
- **KDE:** VS Code nad `<KORP>`, panel Source Control.
- **JAK:** do pole zprávy napiš `import v<X.Y>` → **✓ Commit** → **…** → **Push** (dle zvyklostí korporátního repa).
- **OČEKÁVANÝ VÝSLEDEK:** jeden commit `import v<X.Y>`; Source Control je prázdný. **Kurýrní klon se needituje ani teď.**

---

# 2. Přenos add-inu do modelu

Kód executoru žije **jako operace elementu `AICodeBridge`** (stereotyp `JavascriptAddin`) v modelu — ne ve Scripting okně. Do modelu se dostane dvěma cestami; **rozhodni podle toho, jestli už máš element AICodeBridge v jiném dostupném modelu.**

| Situace | Použij | Proč |
|---|---|---|
| V bance máš otevřený jiný model, kde už AICodeBridge běží | **2.1 Copy/Paste Full Structure for Duplication** | přenese i receptions (broadcast handlery) → menu funguje hned |
| Čistý `<TEST-DB>`, nemáš odkud kopírovat | **2.2 ITAN-Bootstrap** | založí element a nalije kód **z disku** (řeší slepici-vejce: `deploy_src` čte `FB_Config` z modelu, který ještě neexistuje) |
| Paste selhal / EA odmítla cizí element | **2.2** | bootstrap element založí sám; receptions doplní `deploy_src` v kroku 6 |

> **Vždy platí:** `deploy_src` je až **po** bootstrapu — ne místo něj. A v bance je `deploy_src` navíc v `deny` (5.3), takže po nasazení se kód mění **jen** bootstrapem.

## 2.1 Copy / Paste Full Structure for Duplication

- **CO:** zkopírovat celý element AICodeBridge se všemi ~105 operacemi.
- **KDE:** EA, Project Browser, zdrojový model.
- **JAK:**
  1. Najdi element **AICodeBridge** → pravým → **Copy / Paste → Copy**.
  2. Otevři **`<TEST-DB>`** → pravým na cílový package (kam patří add-iny) → **Copy / Paste → Paste Element(s)…** → v dialogu zvol **Full Structure for Duplication** → **OK**.
- **OČEKÁVANÝ VÝSLEDEK:** pod cílovým packagem je nový **AICodeBridge**; dvojklik → záložka **Operations** ukazuje řádově **100+ operací** (`FB_Main`, `FB_Whitelist`, `EA_MenuClick`, `EA_GetMenuItems`…). Vendor add-iny, které v modelu už jsou, **nesahat**.
- **KDYŽ SELŽE:** pokračuj rovnou 2.2 a **zapiš, na čem to spadlo**.

## 2.2 ITAN-Bootstrap (kód z disku)

- **CO:** založit element AICodeBridge a nalít do něj kód ze složky `src\` na disku.
- **KDE:** EA připojená na `<TEST-DB>`, okno **Specialize → Scripting**.
- **JAK:**
  1. **Nejdřív v Project Browseru označ package**, kam má element patřit (bootstrap ho založí tam).
  2. Scripting → pravým na skupinu skriptů (nebo **New Script Group**) → **New JScript**, jméno `ITAN-Bootstrap`.
  3. Otevři `<KORP>\scripts\ITAN-Bootstrap File Bridge.js` v Poznámkovém bloku → `Ctrl+A`, `Ctrl+C` → vlož do skriptu → **Save** → **Run** (zelená šipka).
  4. Cestu ke `src\` si skript najde sám na obvyklých cestách; když ji nenajde, **zeptá se dialogem** — zadej `<KORP>\src`. Skript se needituje (proto v diffu nevzniká položka navíc).
- **OČEKÁVANÝ VÝSLEDEK:** **System Output → záložka Script**:
  ```
  === ITAN-Bootstrap File Bridge ===
  Slozka src: <KORP>\src\
  OK  B64Decode (…)
  …
  Hotovo: <X> operaci zalozeno, <Y> nahran kod (souboru v src: 105).
  ```
  - po 2.1 (paste): `X` = 0 až pár, `Y` = 105;
  - bez paste (element zakládá bootstrap): `X` ≈ 100 a v závěru výčet **`BEZ RECEPTION`** s `EA_*` položkami — to je čekaný stav, receptions doplní `deploy_src`; v bance je `deploy_src` v deny, takže **menu add-inu vznikne až po opakovaném bootstrapu z modelu, kde receptions už jsou** (nebo si na jeho dobu jednorázově povol `deploy_src` a hned zase vrať do deny — rozhodnutí zapiš).
- **POZOR:** bootstrap je **idempotentní** — spustit ho podruhé je bezpečné a je to standardní krok po každé změně configů na disku (viz 5.7).

---

# 3. Manage Add-Ins — aktivace

## 3.1 Zapnout add-in

- **CO:** aktivovat add-in pro tvůj účet a nechat ho načítat při startu.
- **KDE:** EA → **Specialize → Manage Add-Ins**.
- **JAK:** v seznamu najdi řádek **AICodeBridge** → zaškrtni **Enabled** → zaškrtni **Load on startup** → OK.
- **OČEKÁVANÝ VÝSLEDEK:** dialog se zavře bez chyby; položka zůstane zaškrtnutá i po opětovném otevření dialogu.

## 3.2 Zaznamenat, co dialog nabízí

- **CO:** doložit, jak vypadá aktivace add-inu v modelu **se zapnutou security** (v EA to je per-user, ale existuje i skupinová varianta).
- **KDE:** tentýž dialog.
- **JAK:** udělej screenshot (`Win+Shift+S`) a zapiš, jestli dialog nabízí přiřazení **skupině**, nebo jen per-user.
- **OČEKÁVANÝ VÝSLEDEK:** doklad k auditní otázce „kdo má add-in aktivovaný". Ověřit se to dá čtecí dávkou později — `t_xrefsystem` s `Type` = `UserSettings` / `GroupSettings` (přesný SELECT je v `PROTOKOL-EAFB.md` §6g).

## 3.3 Security skupina pro write fíčury (jen když má repozitář zapnutou EA security)

- **CO:** rozhodnout, kdo smí přes bridge **zapisovat**. Aktivace add-inu (3.1) dává jen **čtení**.
- **KDE:** EA → **Configure → Security → Users / Groups** (přesné umístění dle verze EA); zakládá **správce EA**, ne ty.
- **JAK:** existující nebo nová skupina `<WRITE-GROUP>`, do ní členové, kteří smí zapisovat. Jméno skupiny pak patří do `FB_AccessGroups` (5.4).
- **OČEKÁVANÝ VÝSLEDEK:** skupina existuje a víš její **přesné jméno** (case-insensitive, ale opisuj přesně).
- **POZOR — tři vrstvy, nezaměňovat** (`PROTOKOL-EAFB.md` §6g/A):
  1. **kdo smí add-in používat** = aktivace v Manage Add-Ins (3.1),
  2. **kdo smí write fíčury** = členství ve skupině dle `FB_AccessGroups` → jinak `E_ADDIN_ACCESS`,
  3. **kam smí zapisovat** = balíčková práva EA (platí i přes API; bridge chybu jen překládá → `E_PERMISSION` / `E_LOCKED`),
  4. **co smí AI kanál** = `FB_Whitelist` + `FB_OpsAllowed`.

---

# 4. PLNÝ restart EA

- **CO:** aktivovat nově nasazený kód v EA runtime.
- **KDE:** EA.
- **JAK:** **File → Exit** (zavřít celou aplikaci, ne jen projekt) → spustit EA znovu → otevřít `<TEST-DB>`.
- **OČEKÁVANÝ VÝSLEDEK:** v menu je **Specialize → AI Bridge** s položkami:
  ```
  Zpracovat davku ze schranky
  Zpracovat davky ze slozky (requests)
  Zapnout AI import rezim (vratny)
  ---
  Stav bridge (kam zapisuje / co cte)
  About AI Bridge
  ```
  (Položka „Nav spike" se v bance nezobrazí — je vázaná na `navProbe: true` v `FB_Config`, který v bankovní položce **není**.)
- **PROČ TO NEJDE OBEJÍT:** reload projektu **nestačí**. Kód pro EA runtime (menu, dvojklik v Output tabu, GUI fallback) se načítá jen při startu EA. Totéž platí po **každé** změně kódu nebo configů v modelu a po každé změně členství v security skupině (cache `FB_UserAccess` platí na session).
- **KDYŽ MENU MLČÍ:** viz troubleshooting 7.1.

---

# 5. Konfigurace — šest sekcí

Configy jsou **operace elementu AICodeBridge** — kanon je na disku v `<KORP>\src\`, do modelu se dostávají bootstrapem (2.2). **Nikdy je needituj přímo v modelu** (ztratil bys je při příštím bootstrapu a v repu by nebyla stopa). Postup je vždy: uprav soubor v `<KORP>\src\` → **bootstrap** (5.7) → **plný restart EA**.

Všech šest je zároveň **chráněný element** (`PROTOKOL-EAFB.md` §8 bod 8): jakákoli dávka, která by na ně mířila, končí **BLOCKED** — bridge sám sebe přes AI kanál přenastavit nemůže.

## 5.1 `FB_Config` — prostředí

- **CO:** říct bridgi, kde má složku výměny a kanon kódu pro tenhle repozitář.
- **KDE:** soubor `<KORP>\src\AICodeBridge.FB_Config.js`; v modelu operace `AICodeBridge.FB_Config`.
- **JAK:** do vraceného pole přidej položku pro `<TEST-DB>`:
  ```js
  { repo: "<TEST-DB>", srcDir: "<KORP>\\src\\", navProbe: false }
  ```
- **Pole:** `repo` = podřetězec identity repozitáře (u MS SQL **název databáze**, viz 5.2); `baseDir` = kořen výměnných složek — **volitelný**, bez něj padá default (`%USERPROFILE%\Documents\EA-File-Bridge\<repo>` u serverového repozitáře); `srcDir` = složka kanonu kódu; `navProbe: false` (spike menu do banky nepatří).
- **OČEKÁVANÝ VÝSLEDEK:** po bootstrapu a restartu ukáže menu **Stav bridge** správnou složku výměny.

## 5.2 `FB_Whitelist` — kam smí zápis

- **CO:** vymezit jedinou větev modelu, do které smí AI kanál zapisovat.
- **KDE:** `<KORP>\src\AICodeBridge.FB_Whitelist.js`.
- **JAK:** položka `{ repo: "<TEST-DB>", pkg: "{GUID <AI-SANDBOX>}" }`. GUID zjistíš **čtecí dávkou** (6.1 krok „ping"), nebo dotazem správce nad `t_package`.
- **KLÍČOVÉ — identita repozitáře je NÁZEV DATABÁZE, ne cesta k `.qea` zástupci** (upgrade v0.1 → v0.2, přesný postup v `NAVOD-NASAZENI-BANKA.md` §6). Executor si název zjistí sám (`FB_RepoId` → `DB_NAME()`), takže položka funguje na **každé stanici** bez ohledu na to, jak se lokální zástupce jmenuje a kde leží. Testovací repozitář vzniká **klonem produkčního** → package GUIDy jsou v obou stejné a **GUID sám instanci nerozliší**; proto je identita databáze povinná druhá polovina klíče.
- **OČEKÁVANÝ VÝSLEDEK:** zápis projde jen když identita obsahuje `<TEST-DB>` **a zároveň** sedí GUID package. Jinak `E_REPO` (nesedí repo — neprovede se nic, ani audit) nebo `E_WHITELIST` (správné repo, package mimo větev).

## 5.3 `FB_OpsAllowed` — které operace jsou povolené

- **CO:** vypnout v bance operace, které tam nemají co dělat (mazání, klonování, nasazení kódu).
- **KDE:** `<KORP>\src\AICodeBridge.FB_OpsAllowed.js`.
- **JAK — bankovní položka:**
  ```js
  { repo: "<TEST-DB>", allow: ["*"],
    deny: ["delete_from_model", "delete_taggedvalue_from_model",
           "remove_elements_from_diagram", "clone_package", "clone_elements",
           "deploy_src"] }
  ```
- **Mechanika:** čtecí operace jsou povolené **vždy** (whitelist se na ně nevztahuje). Zápisové projdou jen když je repo v seznamu a operace projde `allow`/`deny`; **`deny` má přednost**. Repozitář **bez položky = žádný zápis** (fail-secure).
- **TRVALE V DENY V BANCE:** `deploy_src` (nasazení kódu je výhradně dev operace — v bance kód mění bootstrap, což je vědomý ruční úkon), `delete_from_model`, `clone_package`, `clone_elements`. Delete operace se zapínají nejdřív v P2+, a to rozhodnutím, ne mimochodem.
- **OČEKÁVANÝ VÝSLEDEK:** dávka s `deploy_src` skončí `E_OP_FORBIDDEN` a nic nezapíše.

## 5.4 `FB_AccessGroups` — kdo smí write fíčury

- **CO:** navázat právo zapisovat přes bridge na EA security skupinu.
- **KDE:** `<KORP>\src\AICodeBridge.FB_AccessGroups.js`.
- **JAK:** `{ repo: "<TEST-DB>", writeGroups: ["<WRITE-GROUP>"] }` — jméno skupiny ze 3.3.
- **Chování:** EA security **vypnutá** → vše povoleno (vynucovat bez security nedává smysl). Security **zapnutá + repo bez položky** → fail-closed, žádné write fíčury. Security zapnutá + položka → vynucuje se členství; kdo má write, má i read.
- **OČEKÁVANÝ VÝSLEDEK:** nečlen skupiny dostane na zápisovou dávku `E_ADDIN_ACCESS` s čitelnou hláškou a **nic se neprovede**; čtecí dávka mu projde.
- **POZOR:** členství je **cachované na session** — po změně skupiny **plný restart EA** (krok 4), jinak testuješ starý stav.

## 5.5 `FB_RiskPolicy` — kdy se bridge ptá

- **CO:** nastavit, která dávka projde bez dialogu a která vyžaduje potvrzení člověkem.
- **KDE:** `<KORP>\src\AICodeBridge.FB_RiskPolicy.js`.
- **JAK:** položka pro `<TEST-DB>` s mapou tříd (`classes`), prahy `elevate`/`block`, `budgetMs`, `hashMaxChars`. Proti dev položce **jeden rozdíl**: `"deploy_src": "BLOCKED"` (na dev je ELEVATED, protože tam je to jediná cesta nasazení kódu).
- **Mechanika:** mapa tříd musí pokrývat **všech 25 zápisových operací**; prahy určují, kdy dávka skončí `confirm_required`. Výchozí ELEVATED prahy: `deleteTargets > 0`, `writeOps > 20`, `updatedExisting > 10`, `affectedPackages > 1`, `foreignDiagrams > 0`, `moveOps > 0`. `move_elements` je **ELEVATED vždy**, i pro jediný prvek (je to zásah do struktury a governance visí na package).
- **Fail-closed:** repozitář **bez politiky**, neúplná mapa, chybějící práh, pád gate nebo překročený rozpočet → **ELEVATED, nikdy LOW**.
- **OČEKÁVANÝ VÝSLEDEK:** běžná pracovní dávka jede bez dialogu; mazání a hromadné zásahy se ptají.

## 5.6 `FB_QcConfig` — kontroly po zápisu

- **CO:** nechat bridge po každé zápisové dávce spustit kontroly kvality nad dotčenými balíčky.
- **KDE:** `<KORP>\src\AICodeBridge.FB_QcConfig.js`.
- **JAK:** položka `{ repo: "<TEST-DB>", checks: [ { id, desc, sql } ] }` — do banky přijde relevantní podmnožina produkčních QC kontrol. SQL **výhradně nad ověřenými standardními sloupci** a **bez dialektových funkcí** (`$PKGNAMES` = scope na dotčené packages).
- **OČEKÁVANÝ VÝSLEDEK:** po zápisové dávce ACK nese QC stav `ciste` | `nalez` | `nedobehlo:<důvod>` **odděleně** od stavu zápisu. Repozitář bez položky → `nedobehlo: zadne kontroly`.
- **PROČ ODDĚLENĚ:** kdyby se selhání QC hlásilo jako chyba zápisu, agent by dávku přeposlal a vyrobil duplicity.

## 5.7 Nasadit configy a ověřit

- **CO:** dostat upravené soubory z disku do modelu.
- **JAK:** spusť znovu **ITAN-Bootstrap** (2.2, tentokrát už jen doplní kód — element existuje) → **plný restart EA** (krok 4).
- **OČEKÁVANÝ VÝSLEDEK:** menu **Specialize → AI Bridge → Stav bridge (kam zapisuje / co cte)** ukáže identitu repozitáře, whitelist packages **s plnou cestou** a složku výměny. Když tam vidíš `<TEST-DB>` a `<AI-SANDBOX>`, configy jsou v modelu.
- **KONTROLA, KTEROU NEPŘESKAKUJ:** dokud je v configu placeholder (`<TEST-DB>` doslova), **žádný zápis neprojde** — `E_REPO`. To je fail-secure, ne porucha.

---

# 6. První ping — oběma kanály

Ping je **kotva session**: vrací identitu repozitáře, rozvinutý whitelist s cestami a stav přístupu. Pusť ho **oběma kanály**, protože každý se chová jinak.

**Dávka (obě varianty stejná, jen `id` a `echo` měň):**
```json
{ "protocol": "eafb/0.2", "id": "banka-ping-01", "repo": "<TEST-DB>",
  "ops": [ { "op": "ping", "echo": "pumpa" } ] }
```

## 6.1 Pumpou

- **CO:** ověřit souborový kanál a session baseline.
- **KDE:** `<KORP>\pump.wsf`; EA s otevřeným `<TEST-DB>` musí běžet (a **jediná** — pumpa se připojí na první instanci).
- **JAK:**
  1. **Dvojklik `pump.wsf`.** Když Windows nabídne výběr aplikace, zvol **Microsoft ® Windows Based Script Host** (není to blokace).
  2. Ulož dávku jako `req-banka-ping-01.json` do složky `requests\` (kterou ukázalo **Stav bridge**).
  3. Počkej ~2 s.
- **OČEKÁVANÝ VÝSLEDEK:**
  - **konzole pumpy** hlásí verzi, **připojený repozitář** (pohledem zkontroluj, že je tam `<TEST-DB>`, ne `<PROD-DB>`), **počet načtených operací** (Code loader, ~105) a **`Session baseline: 1 vytvoren`**, pak `Zpracovavam req-banka-ping-01.json` / `Hotovo … -> res-banka-ping-01.json`;
  - v `responses\` je `res-banka-ping-01.json` se `"status": "done"`, `"repository"` = `<TEST-DB>` a v `results[0]` pole `echo`, `eaVersion`, **`whitelist[]`** (položky s `guid`, `name`, **`path` plnou cestou**) a **`access{level, securityEnabled, reason}`**;
  - **Output tab „AI Bridge"** má jeden řádek `FB banka-ping-01 -> done: 1 ops (1 ok, 0 chyb)`;
  - **schránka se nezmění** a nikde není text `EAFB OK …`.
- **DŮLEŽITÉ — to poslední je správně, ne chyba:** **pumpa chatovou verzi ACK nerenderuje** (zjištění E2E 4. 9. 2026, `docs/e2e-pumpa/PROTOKOL-E2E-PUMPA.md` P2). Identita výsledků je pro pumpu **výhradně v `res-*.json`**. Chat ACK dělá jen schránkový kanál (`FB_ClipboardImport`) a vrátný.
- **Hláška „POZOR: … žádná whitelist položka"** = whitelist nesedí na připojený repozitář (špatný krok 5.2, nebo je v EA otevřený jiný projekt). **Zastav se a oprav**, nepokračuj.

## 6.2 Schránkou

- **CO:** ověřit interaktivní kanál a **chat ACK** — to, co ve skutečnosti čte Copilot.
- **KDE:** EA, menu **Specialize → AI Bridge → Zpracovat davku ze schranky**.
- **JAK:**
  1. **Zavři pumpu** (křížek na konzoli). Pumpa a schránkový kanál nikdy neběží zároveň nad touž složkou `requests\`.
  2. Otevři dávku (změň `id` na `banka-ping-02`, `echo` na `schranka`) → `Ctrl+A`, `Ctrl+C`.
  3. V EA klikni na položku menu.
- **OČEKÁVANÝ VÝSLEDEK:**
  - **EA dialog** s chatovou verzí odpovědi, tvar:
    ```
    EAFB OK banka-ping-02: 1/1 ops | ping: EA <verze>, repo <TEST-DB>
    ```
    plus rozvinutý **whitelist s plnou cestou** a řádek `access` (u zapnuté security `level` + `login`/`groups` se **nerenderují** — datová minimalizace);
  - **tentýž text je ve schránce** (`Ctrl+V` do libovolného okna to potvrdí);
  - plná odpověď je v `responses\res-banka-ping-02.json`.
- **Když se ACK ve schránce neobjeví, ale dialog ano:** je to známé chování zápisu do schránky z EA runtime — `FB_ClipboardImport` má read-back ověření a fallback přes `clip.exe`. **Dialog je autoritativní**, obsah si z něj přečteš i tak.

## 6.3 Co ping musí potvrdit, než jdeš dál

- [ ] `repository` = **`<TEST-DB>`** (ne `<PROD-DB>`, ne název zástupce)
- [ ] `whitelist[]` obsahuje `<AI-SANDBOX>` s **plnou cestou**, která odpovídá tomu, co vidíš v Project Browseru
- [ ] `access` odpovídá realitě (security zapnutá → `securityEnabled: true`; ty jsi členem `<WRITE-GROUP>` → write)
- [ ] Code loader v konzoli pumpy hlásí ~105 operací (ne 16, ne 0)
- [ ] `Session baseline: 1 vytvoren`

Teprve pak má smysl pouštět zápisovou dávku.

---

# 7. Troubleshooting

## 7.1 Menu „AI Bridge" v EA vůbec není

Nejčastější příčina po přenosu z jiného modelu: **cizí `SignalGUID`**. Broadcast handlery (`EA_GetMenuItems`, `EA_MenuClick`, `EA_OnOutputItemDoubleClicked`…) jsou v modelu **receptions** — operace se `StyleEx = 'Reception=1;SignalGUID={…}'`. GUIDy signálů jsou **per model**, takže po Copy/Paste z jiného modelu ukazují na signál, který v `<TEST-DB>` neexistuje → EA handleru event nepošle a menu mlčí.

| Krok | Co udělat |
|---|---|
| 1 | Ověř, že add-in je **Enabled + Load on startup** (3.1) a že proběhl **plný restart EA** (4) — reload projektu nestačí |
| 2 | Zkontroluj, jestli element AICodeBridge má operace (dvojklik → Operations) |
| 3 | Přepnutí SignalGUID na lokální umí **`deploy_src`** (přiřadí podle **jména** operace = jména signálu v modelu; response hlásí `receptions`). V bance je ale `deploy_src` v **deny** (5.3) |
| 4 | **V bance:** dokud je `deploy_src` v deny, jde to jen (a) opakovaným bootstrapem z modelu, kde receptions sedí, nebo (b) jednorázovým vědomým povolením `deploy_src`, spuštěním deploye a **okamžitým vrácením do deny** — udělej to jako zaznamenané rozhodnutí, ne mimochodem |
| 5 | Dokud menu mlčí, **kanál je pumpa** — ta na menu nezávisí (běží mimo EA přes COM) |

## 7.2 `E_ADDIN_ACCESS`

- **Znamená:** nejsi členem žádné skupiny z `FB_AccessGroups.writeGroups` pro tento repozitář (vrstva 2), nebo repozitář nemá ve `FB_AccessGroups` položku (fail-closed).
- **Řešení:** správce EA tě přidá do `<WRITE-GROUP>` → **PLNÝ restart EA** (cache `FB_UserAccess` platí na session — bez restartu se změna neprojeví). Když skupina sedí a chyba trvá, chybí položka v configu → 5.4 + bootstrap + restart.
- **Čtecí dávka projde i tak** — to je kontrola, že jde o vrstvu 2 a ne o něco jiného.

## 7.3 `E_REPO`

- **Znamená:** deklarace `repo` v dávce nesedí na **připojený** repozitář. Neprovede se nic — **ani audit**. Je to správné chování ochrany, ne porucha.
- **Řešení:** zkontroluj v tomhle pořadí: (1) **který projekt je v EA otevřený** (title bar), (2) `repo` v dávce, (3) položka ve `FB_Whitelist` — nezůstal tam placeholder? Chat ACK u `E_REPO` **pojmenuje připojený repozitář**, takže se dá opravit hned.
- **Když se to stane u pumpy:** konzole hlásí `POZOR: … žádná whitelist položka`. Zastav se — nespouštěj další dávky.

## 7.4 `E_PERMISSION` / `E_LOCKED` — balíčková práva

- **Znamená:** vrstva 3 — EA security na úrovni package (zámek na skupinu, nebo režim **Require User Lock to Edit** bez drženého zámku). **Platí i přes API**, bridge chybu jen překládá (`FB_InterpretError`).
- **Řešení:** požádej správce EA o členství ve skupině s právem k danému balíčku, nebo si prvek zamkni (pokud režim vyžaduje uživatelský zámek), nebo zapisuj do balíčku, kam právo máš. Hláška nese i **původní text z EA**.
- **Poznámka:** vzor rozpoznávání hlášky je zatím **zástupný** (odhad z terminologie EA UI). Když dostaneš syrovou hlášku, která se nepřeloží, **zapiš ji přesně** — patří do `FB_InterpretError` jako nový vzor.

## 7.5 Dialog s potvrzením (ELEVATED) — co v něm číst

Dávka klasifikovaná jako ELEVATED se **nezapíše** a čeká v `requests\pending\`. Pumpa ukáže popup Ano/Ne/Storno (timeout 300 s = dávka čeká dál), menu ukáže dialog EA.

Dialog je psaný lidsky, ne metrikami — nahoře **co se chystá**, pak **kde**, pak **proč se ptám**, technická patička (id, otisk = `hashPrefix`, počty) až dole. U mazání a přesunů nese od 4. 9. 2026 řádek s **plnou tečkovou cestou** cíle:
```
Chysta se SMAZAT 1 prvek z modelu.

Balicky: <jméno>
Kde (plna cesta mazaneho): <plná cesta>.<AI-SANDBOX>.<jméno>
```
- **Než klikneš Ano:** cesta musí začínat stejně jako `path` ve whitelistu z pingu (6.1) a končit jménem toho, co má zmizet. Při více cílech jsou cesty jako odrážky.
- **Storno / timeout** = dávka **čeká dál** v `pending\`, přežije i restart EA a pumpy. Zamítnutí = `E_RISK_REJECTED`, dávka jde do `rejected\` a **zapíše se audit**.
- **Nonce ani plný hash nikdy neopouštějí `res-*.json`** — do chatu jde maximálně `hashPrefix` (12 znaků). Kdyby ti někdo (nebo něco) tvrdilo opak, je to pokus o obejití potvrzení.

## 7.6 Prokliky z Output tabu nefungují

- **KDE:** EA → **Start → All Windows → System Output** → záložka **AI Bridge**.
- **CO tam má být:** po každé zápisové dávce blok `FB <id> - zmeny v modelu` s řádky `[vytvoreno|upraveno|smazano] "jméno" @ <tečková cesta>` a **markerem cíle** na konci: `(el:ID)` / `(pkg:ID)` / `(dgm:ID)`.
- **Dvojklik** na řádek označí prvek v Project Browseru — **podle typu**: element, package i diagram. Řádky scénářů, constraintů, requirementů a atributů skáčou na **vlastnící element**. **Smazané prvky navigační cíl nemají** (není kam skočit) — dvojklik na `[smazano]` neudělá nic a je to správně.
- **Když se nic neděje:** (1) nejsi na záložce **AI Bridge** (jiné taby EA obsluhuje sama), (2) proběhl plný restart EA po nasazení kódu? (3) řádek nemá marker — zapiš přesný text řádku, patří to do evidence.

## 7.7 Modální dialog EA a `rowCount: 0`

- **Příznak:** dávka se zasekne, nebo čtecí operace vrátí prázdný výsledek, ačkoli data v modelu jsou.
- **Příčina:** SQL s neexistujícím názvem sloupce vyvolá v EA **modální dialog** — a po zotavení z něj hrozí **falešné prázdné výsledky**.
- **Řešení:** zavři dialog v EA. Pak **kontrolní čtení v čerstvé dávce** — nikdy nevyvozuj závěr z výsledku, který přišel po modálu. Retry jen s idempotenčními poli (`matchByName`, `dedupKey`, `match: "composite"`, `rebuild`), nikdy slepým přeposláním celé dávky (to vyrábí duplicity).
- **Prevence:** názvy sloupců si ověř dotazem nad systémovým katalogem dřív, než na nich postavíš dávku.

## 7.8 Antivirus / EDR

- **Vrátný (AI import režim) se v bance NENASAZUJE** — je mimo rozsah. Důvod: dlouhoběžící `powershell.exe` hlídající schránku má pro AV signaturu **Dropper** (potvrzeno naživo doma 20. 8. 2026). Položka v menu zůstává, ale **neklikej na ni**.
- **Co v bance jede a je pro AV neviditelné:** pumpa (WSH `pump.wsf`), **schránkový kanál** (`FB_ClipboardImport` běží **celý uvnitř `EA.exe`** — žádný PowerShell, žádný watcher) a **GUI fallback** (`Zpracovat davky ze slozky`).
- **Kdyby přesto něco zaskřípalo:** zapiš přesný text hlášky AV a **který proces** hlásí. Případná výjimka se zřizuje standardní cestou předem, ne tichým nasazením.

## 7.9 Ostatní rychlé záchytky

| Příznak | Příčina → řešení |
|---|---|
| Konzole: `Cekam na bezici EA…` | EA neběží nebo nemá otevřený projekt → otevři `<TEST-DB>` |
| `operace FB_Main v modelu chybi` (`E_NO_EXECUTOR`) | bootstrap neproběhl, nebo je otevřený jiný repozitář → krok 2.2 |
| `E_OP_FORBIDDEN` | operace je v `deny` v `FB_OpsAllowed` — u `deploy_src`, `delete_*` a `clone_*` je to **záměr** (5.3) |
| `E_SQL_READONLY` | `query` umí jen `SELECT`/`WITH`; veškerý zápis jde přes Automation API |
| Windows: „Vyberte aplikaci pro .wsf" | Microsoft ® Windows Based Script Host |
| Dvě EA běží zároveň | pumpa se připojí na **první** — zavři, co nepotřebuješ, a pumpu spusť znovu |
| Pumpa i schránka zároveň | nikdy — oba čtou `requests\`. Před schránkou pumpu zavři |

---

## Kam dál

| Potřebuješ | Kde |
|---|---|
| Plán fáze 2 POC, akceptační kritéria, upgrade whitelistu v0.1 → v0.2 | `docs/NAVOD-NASAZENI-BANKA.md` |
| Technická reference (registr 42 operací, chybové kódy, Risk Gate, historie) | `docs/PROTOKOL-EAFB.md` |
| Samonosný popis řešení pro čtenáře mimo repo | `IT-ANALYSIS/Dokumentace-EA-File-Bridge.md` |
| Jak psát dávky pro Copilota ve schránkovém režimu | `docs/NAVOD-COPILOT-SCHRANKA.md` |
| Kurýrní kanál (přenos repa doma → banka) | `PROBLEMS/kuryrni-kanal-prenos-repa.md` |
| Klikací protokol testu pumpy / testu security | `docs/e2e-pumpa/PROTOKOL-E2E-PUMPA.md`, `docs/e2e-k8-qeax/PROTOKOL-K8.md` |

## Changelog

- **v1.0 — 2026-09-04** (vlákno Z260904-5): vznik. Deliverable ze zadání kap. 5 („klikací návod pro Miloše"), nikdy dřív nedodaný. Pokrývá stav po iteracích 5–7 včetně prokliků per typ artefaktu a plné cesty v ELEVATED dialogu (commit `689c7ad`) a konfiguračních sekcí se security modelem (commit `79bce7f`).
