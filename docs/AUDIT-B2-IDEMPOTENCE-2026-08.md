# AUDIT B2 — Idempotenční klíče v executoru EA File Bridge

**Datum:** 2026-08-18
**Typ:** papírový audit kódu (žádné spouštění, žádné editace src/)
**Norma:** zadání iterace 4 v1.1 §3.2, kritéria K1–K4 (nález B2 red team oponentury 2026-08-17)
**Kontext:** poslední tvrdá brána před stavbou vrátného (P7-A / C-A / B1-A rozhodnuto 2026-08-18)
**Auditované repo:** C:\GIT\ea-file-bridge, větev main, pracovní strom čistý před auditem

---

## 0. Prescan (ověření na disku)

- `src/` obsahuje **69 souborů** (`ls src | wc -l` = 69) — odpovídá očekávání ze zadání.
- Registr operací = `AICodeBridge.FB_Main.js`, mapování op → handler:
  - `create_or_update_elements` → `FB_OpElements` (FB_Main.js:55)
  - `create_or_update_connectors` → `FB_OpConnectors` (FB_Main.js:57)
  - `create_or_update_messages` → `FB_OpMessages` (FB_Main.js:60)
- Relevantní pomocné soubory: `FB_ResolveEl.js`, `FB_ResolvePkg.js`, `FB_OpDelete.js`, `FB_OpFindOrCreateSR.js`, `FB_OpScenarios.js`, `FB_OpPackage.js` (K1 pokrývá i packages).

---

## 1. Souhrnná tabulka verdiktů

| Kritérium | Norma (§3.2) | Verdikt | Klíčová citace |
|---|---|---|---|
| **K1** — pojmenované elementy/packages: klíč = jméno/alias v cílovém package, find_or_create idempotentní | find_or_create | **NEPLATÍ — CHYBÍ MECHANISMUS** | FB_OpElements.js:37–61 (create = vždy `AddNew`, žádné hledání dle jména); FB_OpPackage.js:37 (totéž pro packages) |
| **K2** — nepojmenované konektory: klíč = kompozit (zdroj, cíl, typ, stereotyp); klientská dedupKey | kompozitní lookup + dedupKey | **CHYBÍ MECHANISMUS** | FB_OpConnectors.js:40–47 (lookup jen guid/connectorID), :66–69 (jinak vždy `AddNew`); `grep -ri dedup src/ docs/` = 0 nálezů |
| **K3** — sekvenční zprávy: deterministický rebuild V2d (smaž + postav znovu), ne párování po jedné | rebuild v executoru | **CHYBÍ MECHANISMUS v executoru** (V2d je klientský vzor; primitiva existují) | FB_OpMessages.js:94–97 (create = `AddNew`, žádné mazání v celém souboru); PROTOKOL-EAFB.md:142 (V2d = klientská dávka delete + recreate); kontrast: FB_OpScenarios.js:51–56 (V2d server-side implementován, ale jen pro scénáře) |
| **K4** — přejmenování mezi pokusy: dedupKey stabilní napříč přejmenováním, nebo adresace původního prvku | dedupKey / adresace | **CHYBÍ MECHANISMUS** (dedupKey neexistuje); částečné zmírnění: adresace GUIDem z response existuje | žádný výskyt dedupKey v src/; adresace: FB_OpElements.js:28–33 (UPDATE dle guid/elementID), :105 (response vrací guid každé položky) |

**Poznámka k K1:** protože find_or_create pro elementy neexistuje vůbec, scénář K4 „nové jméno → find nenajde → druhý element" nenastává tak, jak ho norma popisuje — **duplicita při opakování dávky vzniká VŽDY, i beze změny jména.** K4 je tedy podmnožinou obecnějšího nálezu K1.

---

## 2. Detail K2 — konektory (FB_OpConnectors.js, 108 řádků)

### 2.1 Podle čeho operace hledá existující konektor

Jediný lookup je explicitní identita z requestu:

- FB_OpConnectors.js:40–44 — `if (c.guid || c.connectorID)` → `Repository.GetConnectorByGuid(...)` / `GetConnectorByID(...)`. Nenalezení = chyba `E_NOT_FOUND` (řádek 45).
- FB_OpConnectors.js:48–57 — bez guid/connectorID se přejde rovnou do CREATE větve: validace `source, target, type` a resolve konců přes `FB_ResolveEl`.
- FB_OpConnectors.js:66–69 — CREATE je bezpodmínečný: `conn = srcEl.Connectors.AddNew(...)`. **Žádné hledání existujícího konektoru podle kompozitu (zdroj, cíl, typ, stereotyp) v kódu není** — v souboru není jediný SQL dotaz ani průchod kolekcí `Connectors` za účelem shody.

### 2.2 Podpora klientské dedupKey

Neexistuje. `grep -ri "dedup" src/ docs/` vrací 0 výskytů. Vstupní kontrakt operace (komentář FB_OpConnectors.js:3–14) žádné takové pole nedefinuje.

Poznámka: na každý vytvořený konektor se razítkuje `ai.channel=eafb` a `ai.request=<reqId>` (FB_OpConnectors.js:100–101) — to je potenciální základ pro dedup podle request-id, ale **nic v kódu tyto tagy při zápisu nečte** (slouží jen detektivnímu modelu).

### 2.3 Opakování dávky s nepojmenovaným konektorem po částečném failu

Sémantika dávky (FB_Main.js:134–162): stop-on-error na úrovni operací — po první chybové operaci se zbytek dávky přeskočí (`status: "skipped"`, řádky 139–142). Uvnitř operace se při chybě položky vrací chyba **spolu s dosud vytvořenými items** (např. FB_OpConnectors.js:45, 55–56) — **rollback neexistuje**, dosud vytvořené konektory v modelu zůstávají.

Důsledek: přeposlání téže dávky po částečném failu projde CREATE větví znovu pro všechny položky bez guid → **duplicita ANO, u každé již dříve vytvořené položky.** U nepojmenovaného konektoru navíc neexistuje ani slabý klíč (jméno), podle kterého by šla duplicita následně strojově rozpoznat mimo tagy `ai.request`.

**Verdikt K2: CHYBÍ MECHANISMUS.**

---

## 3. Detail K3 — sekvenční zprávy (FB_OpMessages.js, 149 řádků)

### 3.1 Co operace skutečně dělá

`create_or_update_messages` je **párování po jedné** (per-item create/update), ne rebuild:

- FB_OpMessages.js:44–51 — UPDATE jen dle explicitního `connectorID | guid`.
- FB_OpMessages.js:94–97 — jinak CREATE: `conn = srcEl.Connectors.AddNew(name, "Sequence")`.
- **Mazání v souboru není žádné** — žádné volání `DeleteAt` ani delete SQL (ověřeno čtením celého souboru, 149 řádků).
- FB_OpMessages.js:126–128 — explicitní `seqNo` se zapisuje pokusem (`SequenceNo` je dle dokumentace read-only, s readbackem `pdata` na řádcích 139–143).

### 3.2 Kde V2d skutečně je

- Hlavička souboru (FB_OpMessages.js:2–4) říká „**Podklad pro** vzor V2d" — tj. operace je stavební kámen, ne nositel vzoru.
- PROTOKOL-EAFB.md:142 definuje V2d jako **klientskou dávku**: „delete zpráv + recreate v jedné dávce (`delete_from_model` Connector + `create_or_update_messages` s explicitními `seqNo`)".
- Primitivum mazání existuje: FB_OpDelete.js:53–70 (větev `Connector`, mazání přes kolekci `Connectors.DeleteAt`).
- Kontrast: pro UC scénáře je V2d implementován **server-side** — FB_OpScenarios.js:51–56 smaže všechny existující scénáře elementu (`el.Scenarios.DeleteAt`, počítadlo `removed`) a postaví znovu; hlavička (řádky 3–4) se na „vzor V2d z messages" výslovně odvolává.

### 3.3 Mezera

Idempotence rebuilding-u zpráv **závisí výhradně na disciplíně klienta**: pokud klient pošle jen create dávku bez předchozího delete (nebo delete dávka selže a klient přepošle celou kombinovanou dávku od začátku za stop-on-error sémantiky FB_Main.js:139–142, kde už delete proběhl jinak než plánováno), vzniknou duplicitní zprávy. Executor sám nic nezaručuje — na rozdíl od scénářů, kde je smaž-a-postav atomicky uvnitř jedné operace.

**Verdikt K3: CHYBÍ MECHANISMUS v executoru** (norma §3.2 žádá rebuild „z podstaty" idempotentní; to splňuje FB_OpScenarios, nikoli FB_OpMessages).

---

## 4. Detail K1 + K4 — elementy a packages

### 4.1 K1: find_or_create klíčování

**Neexistuje.** FB_OpElements.js:

- řádky 28–33 — UPDATE výhradně dle `guid | elementID` (přes `FB_ResolveEl`).
- řádky 37–61 — CREATE bezpodmínečně: `el = owner.Elements.AddNew(nm, type)` (řádek 49, pod elementem) nebo `el = pkg.Elements.AddNew(nm, type)` (řádek 57, do package). **Před AddNew se nikde nehledá existující element podle jména/aliasu v cílovém package.**
- řádek 43 — chybějící jméno = `""` (záměr: nepojmenované instance/lifeliny), tj. u těchto elementů není ani jméno jako slabý klíč.

Totéž pro packages — FB_OpPackage.js:24–41: UPDATE dle `guid | packageID` (řádek 24–25), jinak bezpodmínečné `parent.Packages.AddNew(p.name, "Package")` (řádek 37), žádné hledání dle jména pod parentem.

Jediný find_or_create v executoru je `FB_OpFindOrCreateSR` (FB_OpFindOrCreateSR.js:41–61): FIND přes SQL dotaz na tagged value `505-1 Operation Link` = GUID operace; teprve při 0 nálezech CREATE. Je to ale **speciální operace pro SR scaffold** — klíčuje přes TV odkaz na katalog, ne přes jméno/alias, a na generické `create_or_update_elements` se nijak nepřenáší. (Mimochodem je to zároveň ukázka, že klíčování přes TV — tedy budoucí dedupKey — je v tomto kódu proveditelné.)

Vedlejší nález: resolver referencí `FB_ResolveEl` při zadání jménem hledá **globálně první match** v celém modelu (`SELECT ea_guid FROM t_object WHERE Name = '...'`, FB_ResolveEl.js:13–15, bez omezení na package; totéž FB_ResolvePkg.js:13–15). I kdyby se find_or_create stavěl nad tímto resolverem, není package-scoped, jak žádá norma — nutno postavit vlastní dotaz omezený na `Package_ID`.

**Verdikt K1: NEPLATÍ — CHYBÍ MECHANISMUS.** Opakování create dávky (typicky po částečném failu, viz §2.3 — stejná stop-on-error sémantika platí i zde, chybové návraty s items: FB_OpElements.js:31–32, 46, 54) vytvoří duplicitní elementy/packages.

### 4.2 K4: přežití přejmenování

- **dedupKey mechanismus neexistuje** (0 výskytů v src/, viz §2.2). Není tedy co by přejmenování přežilo.
- Protože neexistuje ani find_or_create dle jména (§4.1), scénář normy „nové jméno → find nenajde → druhý element, první osiří" je fakticky pohlcen obecnějším problémem: **druhý element vznikne při každém opakování create, bez ohledu na přejmenování.**
- Částečné zmírnění, které v kódu JE: každá response vrací `guid` + `id` každé vytvořené položky (FB_OpElements.js:105, agregát 107–108; obdobně FB_OpConnectors.js:103, FB_OpMessages.js:137) a UPDATE cesta umí původní prvek adresovat GUIDem (FB_OpElements.js:28–29). **Opravná dávka adresující původní prvek je tedy možná** — ale jen pokud si klient GUIDy z (částečně chybové) response uložil a použil. Executor to nevynucuje.
- Razítka `ai.channel`/`ai.request` (FB_OpElements.js:103–104) jsou zapisována, ale nečtena — mohla by být základem server-side dedupu podle request-id, dnes nejsou.

**Verdikt K4: CHYBÍ MECHANISMUS** (dedupKey nutno dostavět; adresace GUIDem existuje jako ruční/klientská záchrana).

---

## 5. Co dostavět před vrátným

Pořadí dle závažnosti pro bránu B2 (duplicity při retry jsou přesně to, co vrátný bude generovat — přeposílání dávek po failu je jeho základní pracovní režim):

1. **K2 — kompozitní lookup konektorů** (FB_OpConnectors, CREATE větev před řádkem 66): před `AddNew` SQL dotaz na `t_connector` dle (`Start_Object_ID`, `End_Object_ID`, `Connector_Type`, `Stereotype`); při právě jednom nálezu přepnout na UPDATE, při více nálezech vyžadovat dedupKey (viz bod 3). Odhad: ~30–50 řádků + rozšíření kontraktu v hlavičce a PROTOKOL-EAFB.md.
2. **K1 — find_or_create elementů/packages**: v FB_OpElements (před řádky 49/57) a FB_OpPackage (před řádkem 37) hledání dle jména/aliasu **omezené na cílový package/parent** (vlastní dotaz na `t_object.Package_ID` / `t_package.Parent_ID` — `FB_ResolveEl` je globální, nelze použít přímo, viz §4.1). Doporučeno jako opt-in přepínač per položka (např. `matchByName: true`), aby se nezměnilo chování existujících dávek, které duplicitu jmen legitimně chtějí. Odhad: ~25–40 řádků na operaci.
3. **K4 — klientská dedupKey**: nové volitelné pole položky (`dedupKey`); při CREATE se zapíše jako TV (např. `ai.dedup`), lookup pořadí: guid → dedupKey (SQL na `t_objectproperties`/`t_connectortag`) → jméno/alias. Přežívá přejmenování z podstaty. Vzor klíčování přes TV už v kódu existuje (FB_OpFindOrCreateSR.js:44–48). Odhad: ~20–30 řádků sdíleného helperu + napojení ve 2–3 operacích.
4. **K3 — server-side rebuild mód zpráv**: volitelný `rebuild: true` ve FB_OpMessages — smazat všechny Sequence konektory daného diagramu (vzor FB_OpDelete.js:66–68) + postavit znovu z dávky s explicitními seqNo, po vzoru FB_OpScenarios.js:51–56 (včetně `removed` v response). Alternativa minimálně: v PROTOKOL-EAFB.md povýšit V2d z doporučení na povinný vzor pro vrátného a zakázat mu samostatné create dávky zpráv. Odhad kódové varianty: ~40–60 řádků.
5. **Dokumentace retry sémantiky pro vrátného**: explicitně popsat, že (a) chybová response obsahuje items dosud vytvořených položek a jejich GUIDy, (b) korektní retry = opravná dávka adresující tyto GUIDy, nikdy slepé přeposlání celku — dokud nejsou body 1–3 hotové. Odhad: dokumentační změna.

## 6. Mimo rozsah auditu (vyžaduje běh, ne čtení)

- **E2E retest duplicit**: reálné chování při přeposlání dávky po částečném failu (včetně známého režimu „falešné OK rowCount:0 po zotavení z modal hangu" — právě tam duplicity vzniknou nepozorovaně).
- Zda EA Automation API vůbec dovolí dva identické konektory mezi týmiž elementy bez protestu (papírově nic nebrání, runtime neověřeno).
- Chování `Connector.Update()` vracejícího `false` bez výjimky (komentář FB_OpConnectors.js:17–18) v kombinaci s retry.
- Skutečná zapisovatelnost `SequenceNo`/`Subtype` u zpráv (kód sám je řeší pokusem + readbackem, FB_OpMessages.js:117–119, 126–128).
- Výkon dostavěných SQL lookupů na velkém modelu.
- SQL injection přes jméno v resolverech je escapováno (`replace(/'/g, "''")`, FB_ResolveEl.js:13) — funkční ověření hraničních případů jen za běhu.

---

## 7. N-1 kontrola auditu

- Každý verdikt K1–K4 má citace soubor+řádek (viz tabulka §1 a detaily §2–§4). ✔
- Žádné tvrzení typu „mělo by/pravděpodobně" bez citace; jediné neověřené runtime otázky jsou explicitně v §6. ✔
- `git status` před auditem čistý; po auditu jediná změna = tento soubor. ✔
- Žádné bankovní názvy; report pracuje jen s kódem repa (placeholdery <TEST-DB>/<PROD-DB> nebyly potřeba — kód žádné názvy prostředí necituje). ✔
