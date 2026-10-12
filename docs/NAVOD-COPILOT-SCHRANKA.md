# Schránkový kanál — návod pro uživatele M365 Copilota

Stav: 2026-10-12 · kód **v0.21** (texty srovnané s kódem ve vlákně Z261004b‑8; vznik 2026-08-21, v0.12) · režim `FB_ClipboardImport` (menu **Zpracovat davku ze schranky**). Pracuješ-li s pumpou ve VS Code, platí `NAVOD-PUMPA-VSCODE.md`.

Tenhle režim je nejjednodušší způsob, jak nechat Copilota zapisovat do EA: **Copy v chatu → klik v menu EA → Ctrl+V zpátky do chatu.** Běží celý uvnitř EA, nespouští žádný PowerShell (proto ho neřeší antivirus) a na každou dávku klikneš ty — což je zároveň tvůj kontrolní bod.

Návod je psaný pro **pilotní provoz**: co dělat, co nedělat a co z toho zatím bolí.

---

## 1. Než začneš (jednou za session)

| # | Co | Kde |
|---|---|---|
| 1 | **Zjisti si název repozitáře a kam se NEsmí zapisovat** | EA: **Specialize → AI Bridge → Stav bridge (kam zapisuje / co cte)**. Vypíše identitu repozitáře, **chráněné větve** (blacklist) **s cestou**, balíčky, které bridge chrání sám (audit, add-in), režim kaskád mazání a složku výměny souborů. Zapisovat se smí všude jinde, kam tě pustí EA security. |
| 2 | **Řekni Copilotovi název repozitáře a cílový balíček hned v prvním promptu** | „Pracujeme nad repozitářem `EAExample.qea`, cílový balíček je `<plná cesta>` `{GUID}`." Nejrychleji: vyber balíček v Project Browseru → **Specialize → AI Bridge → Kontext vyberu do schranky (pro Copilota)** → vlož do promptu (jen identita: repozitář, GUID, cesta, `writeCheck`). |
| 3 | **První dávka = `ping`** | Ověří, že Copilot mluví se správným modelem. |

> ⚠ **Nejčastější ztracené kolo:** Copilot nezná název repozitáře, doplní do dávky zástupný text (`<NAZEV_REPOZITARE>`) a dávka spadne na `E_REPO`. Stalo se to i naostro (2026-08-21). Dva řádky kontextu na začátku tomu předejdou.

---

## 2. Smyčka — pět kroků

1. **Copilot vygeneruje dávku** jako jeden JSON code blok.
2. **Přečti si ji.** Tohle je jediné místo, kde má člověk poslední slovo — když je něco špatně, prostě nekopíruj a řekni Copilotovi, co změnit.
3. **Copy** na code blocku.
4. V EA: **Specialize → AI Bridge → Zpracovat davku ze schranky.**
   EA na chvíli zamrzne (zpracovává), pak ukáže **dialog s odpovědí (ACK)** a tutéž odpověď vloží **do schránky**.
5. Přepni do Copilota a dej **Ctrl+V**.

Mezi kroky 4 a 5 nic dalšího nekopíruj — přepsal bys odpověď.

**Co se stane, když ve schránce žádná dávka není:** EA to řekne (`Schranka neobsahuje eafb davku`) a nic neudělá. Nic se nerozbije.

**Poslal jsem tutéž dávku dvakrát:** druhý klik se přeskočí — v téže session (`Davka <id> uz byla v teto session zpracovana (dedup W5) - preskoceno`) i po restartu EA podle hotové odpovědi (`Davka <id> uz byla zpracovana (res-<id>.json: <stav>) - znovu se neprovede`). Chceš-li ji provést znovu, musí mít **jiné `id`** — řekni to Copilotovi. Na markdown obal kolem JSON (```` ```json ````) nehleď — bridge si JSON vyřízne sám.

---

## 3. Rytmus práce (best practice z POC)

Tohle není teorie — je to, co v POC fungovalo, a co ho stálo dávky navíc.

1. **Recon, pak plán.** První dávka je čtecí (`query` / `find_*` / `get_*`) — zjistí GUIDy a **vzor v modelu**. Druhá dávka je celý zápisový plán. Nesnaž se zapisovat naslepo.
2. **Vzor v modelu má přednost před pravidlem v promptu.** Když se dokumentace a model neshodnou, řídí se model — a řekni mi to, ať to opravím v pravidlech.
3. **Nedělej dávky malé „pro jistotu".** Velikost sama o sobě nic nezablokuje: větší dávka znamená potvrzovací dialog, ne odmítnutí. Co dávku opravdu shodí, je **jedna cílová package na dávku** (víc balíčků = dialog navíc) a plošné zapínání `matchByName`.
4. **Nikdy nepřeposílej tutéž dávku po chybě.** Rollback neexistuje — co se stihlo zapsat před chybou, v modelu zůstalo. Správná oprava je nová dávka, která adresuje GUIDy vzniklých prvků.
5. **Před zápisem do existujícího obsahu si nech udělat `create_baseline`** dotčeného balíčku. Je to jeden řádek v dávce a jediná cesta zpátky.
6. **Po zápisu se podívej do EA očima.** Zelená odpověď dokazuje jen to, že se hodnota uložila — ne že jí EA rozumí. (Přesně tak se v POC půl dne psalo `Join`, který EA zahazovala. Zjistilo se to teprve pohledem do Scenarios tabu.)
7. **`0 radku` v odpovědi znamená „dotaz nic nevrátil"**, ne „data neexistují" — zvlášť když těsně předtím EA zamrzla na nějakém dialogu. Ověř kontrolním dotazem.
8. **Nepiš `confirm`, `nonce` ani `payloadHash` do dávky.** Potvrzení je vždycky tvoje kliknutí; dávka s potvrzovacími poli se odmítne.

---

## 4. Jak číst odpověď (ACK)

| Co uvidíš | Co to znamená | Co s tím |
|---|---|---|
| `EAFB OK <id>: 3/3 ops \| QC ciste (N kontrol)` | hotovo, vše proběhlo | vlož do Copilota a pokračuj |
| `EAFB OK <id>: 6/6 ops \| **1 WARNING**: …` | **zapsáno, ale část záměru se nepropsala** (např. `join` se nezapsal) | ⚠ nepřehlédni — Copilot má poslat **opravnou dávku podle textu warningu**, ne tutéž znovu |
| `\| QC NALEZ: …` / `\| QC neproveden (chyba kontroly: …)` / `\| QC: bez kontrol pro tuto zmenu` | kontrola po zápisu něco našla / nedoběhla / pro změnu žádná není | **není to chyba zápisu** — zápis proběhl; řeš obsahově. Dialog nad ACK to říká i větou `Kontrola kvality: …` |
| `EAFB CEKA NA POTVRZENI <id>` | riziková dávka čeká na tvoje Ano/Ne | viz §5 |
| `EAFB CHYBA <id> v op[2] (…): E_…` | dávka se zastavila na druhé operaci, další jsou přeskočené, **dřívější zápisy platí** | opravná dávka, nikdy přeposlání |
| `EAFB BLOKOVANO <id>` | Risk Gate tvrdý stop (žádný override) | rozdělit práci jinak, nebo ruční zásah v EA |
| `EAFB ZAMITNUTO <id>` | tys to v dialogu odmítl | nic se nestalo |

**Warning je to nejcennější, co v ACKu je.** Znamená přesně: „operace doběhla, ale tuhle konkrétní věc jsem nezapsal a tady je proč". Bez něj vypadá dávka jako v pořádku a chyba se najde až v modelu.

---

## 5. Když EA chce Ano/Ne (potvrzovací dialog)

Objeví se u dávek, které **mažou, klonují, přesouvají, dělají rebuild nebo sahají do víc balíčků najednou**. Dialog ukáže lidský souhrn: co se chystá, kolika prvků a balíčků se to týká a proč je dávka označená za rizikovou. Technické údaje (id, otisk) jsou až dole.

- **Ano** = provést. **Ne** = zahodit (nic se nestane). **Storno** = nechat čekat.
- Storno není chyba — dávka počká a vyřídíš ji později přes **Zpracovat davky ze slozky (requests)**. Přežije i restart EA; čeká nejvýš **8 hodin**, pak vyprší (`E_RISK_EXPIRED`).
- Výchozí tlačítko dialog EA nastavit neumí (na rozdíl od okna pumpy, kde je výchozí Storno) — **Enter nemačkej naslepo**, klikni myší.
- Do chatu nikdy neposílej nic z potvrzení. Copilot vidí jen krátký otisk (`hash abc123…`) a to stačí.

Než klikneš Ano, přečti si ten souhrn. Je to poslední brzda před nevratnou změnou.

---

## 6. Kde jsou data, když je ACK nemá

**Od iterace 7 nese chat ACK identitu výsledků sám:** GUIDy + jména položek (u packages plnou cestu) po operacích, výcuk `query`, u pingu cíl zápisu (segment `zapis: blacklist (N chranenych vetvi, …): <cesty>`) a přístupovou úroveň. Běžná smyčka — recon i navazující zápisové dávky — se tak odbaví **bez otevírání souborů**; Copilot si GUIDy bere přímo z ACK. Soubor otevíráš jen ve výjimkách, které ACK sám ohlásí:

- **`<složka výměny>\responses\res-<id>.json`** — plná odpověď (system of record). Sáhne se po ní jen když ACK nese **ukazatel** (dump/výčet nad rozpočet) nebo **cestu** k binárnímu výstupu (PNG diagramu, RTF dokumenty — ty schránkou nejdou nikdy). Cestu ke složce ukazuje **Stav bridge**.
- **Output tab „AI Bridge"** v EA — řádky změn s tečkovou cestou; **dvojklik naviguje** na prvek v Project browseru.

---

## 7. Když něco nehraje

| Příznak | Příčina | Řešení |
|---|---|---|
| `Schranka neobsahuje eafb davku` | neklikls Copy, nebo se zkopíroval jiný text | Copy na code blocku a klikni znovu |
| `Davka <id> uz byla v teto session zpracovana` | dedup — stejná dávka podruhé | nech Copilota změnit `id` |
| `req-<id>.json uz je ve fronte nebo ceka v pending` | dávka s týmž id čeká na potvrzení | vyřiď ji (Zpracovat davky ze slozky), nebo pošli jiné `id` |
| `E_REPO` | Copilot poslal špatný/zástupný název repozitáře | chybový ACK připojený repozitář sám **pojmenuje** — Copilot opraví pole `repo` a pošle dávku znovu; hodnotu vidíš i ve **Stav bridge** |
| `E_BLACKLIST` | cíl leží v chráněné části (větev z blacklistu, balíček auditu nebo add-inu); hláška říká plnou cestu a chráněnou větev; nic se nezapsalo | neobcházej a nech Copilota dávku **neopakovat ani nedělit** — dej mu jiný cíl; má-li být cíl zapisovatelný, rozhoduje správce (`E_WHITELIST` od v0.17 nepřichází) |
| `E_AMBIGUOUS` | jméno nebo cesta sedí na víc objektů; odpověď nese kandidáty s cestou | vyber s Copilotem jeden, pošle GUID |
| `BEZI PUMPA v0.6 (<cesta>) - faze … Davky zpracovava pumpa …` | na stanici běží pumpa nad touž složkou | buď pumpu zavři a klikni znovu, nebo pracuj s pumpou (`NAVOD-PUMPA-VSCODE.md`) |
| `E_SQL_UNBOUNDED` / ACK s `truncated` | dotaz bez `TOP`/`LIMIT`/`WHERE` nad velkou tabulkou se nespustil / výsledek ořízl strop `maxRows` (500) | Copilot přidá omezení dotazu |
| **EA zamrzla a nic se neděje** | SQL dotaz sáhl na neexistující sloupec → EA otevřela modální dialog schovaný za oknem | najdi dialog, odklikni; **pak dej kontrolní dotaz znovu** — první výsledek po odkliknutí může být falešná nula |
| ACK se nevložil do schránky | zápis do schránky selhal | text je v dialogu — zkopíruj ho ručně; plná odpověď je v `res-<id>.json` |
| Odpověď je useknutá / `(dalsich N …)` | dávka vrátila víc, než rozpočet ACK unese | ořez je **vždy hlášený, nikdy tichý**, a jde po hranicích položek s prioritou **GUIDy > jména** — jména padají první, GUID nikdy neuvidíš neúplný. Copilot obvykle pokračuje rovnou z GUIDů; `res-<id>.json` otevři jen když ACK nese ukazatel a Copilot data z něj opravdu potřebuje |

---

## 8. Tři režimy — kdy který

| Režim | Jak se dávka dostane do EA | Kdy ho chceš |
|---|---|---|
| **Schránkový** (tenhle) | Copy → klik v menu | **výchozí volba.** Žádný PowerShell → antivirus neřeší; klik za dávku je zároveň kontrolní bod |
| **AI import režim (vrátný)** | Copy → provede se samo | **jen doma** (položka v menu jen s `gatekeeper: true` ve `FB_Config`, před spuštěním dotaz Ano/Ne); v bance se nenasazuje. Norton ho doma blokoval jako „Dropper" — viz `NAVOD-VRATNY-AI-IMPORT.md` |
| **Složka `requests\`** | dávku uložíš jako soubor → klik v menu | když pracuješ s dávkami z disku (vývoj, opakované testy) nebo běží pumpa |

Pumpu a vrátného nespouštěj současně — přetahovaly by si stejné dávky. Schránku a složku při běžící pumpě kód sám odmítne (`BEZI PUMPA …`).

---

## 9. Shrnutí na jednu kartu

1. Řekni Copilotovi **repozitář a cílový balíček**, začni `ping`em.
2. **Recon → plán.** Jedna cílová package na dávku.
3. **Přečti dávku, teprve pak Copy.**
4. Klik: **Specialize → AI Bridge → Zpracovat davku ze schranky** → **Ctrl+V** zpátky.
5. V ACKu hledej **WARNING** — a reaguj na něj opravnou dávkou.
6. U rizikové dávky si přečti souhrn, **až pak Ano**.
7. Po zápisu se **podívej do EA očima**. Zelená odpověď není důkaz.
8. Chyba = **nová opravná dávka**, nikdy přeposlání.

---

## Changelog

- **2026-10-12** (vlákno Z261004b‑8, srovnání s kódem v0.21): whitelist → blacklist (§1, §6, §7 `E_BLACKLIST`, `E_AMBIGUOUS`), menu *Kontext vyberu do schranky*, dedup přes hotovou odpověď a výřez JSON z markdown obalu (§2), QC texty ACK (§4), expirace čekající dávky a Enter v dialogu EA (§5), `BEZI PUMPA` a `E_SQL_UNBOUNDED` (§7), vrátný jen s `gatekeeper: true` (§8).
- 2026-08-21: vznik (protokol v0.12).
