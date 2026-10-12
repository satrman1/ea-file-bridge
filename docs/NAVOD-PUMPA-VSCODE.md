# Pumpa ve VS Code — provozní návod analytika

Stav 2026-10-12 · pumpa **v0.6** · kód bridge **v0.21** · Pro analytika, který pracuje ve workspace s Copilotem (agent `sa-analytik`) a pumpou. Nasazení bridge do modelu dělá správce (`NAVOD-NASAZENI-KLIKACI.md` v repu bridge) — ty ho nepotřebuješ. Tenhle soubor leží ve workspace vedle `pump.wsf` (kopíruje ho `tools\refresh-workspace.py`).

**Kdo co dělá.** Copilot píše dávky do `requests\` a sám čte odpovědi z `responses\`. Pumpa (okno konzole) dávky bere a provádí v otevřené EA. Ty pumpu spustíš, občas se podíváš do jejího okna a rozhoduješ v potvrzovacím okně. Odpovědi neopisuješ ani nekopíruješ — agent si je přečte sám.

---

## 1. Start (jednou za den)

1. Otevři **EA s projektem**, nad kterým budeš pracovat. **Jen jedna EA** — pumpa se připojí na první spuštěnou (kap. 6).
2. **Dvojklik `pump.wsf`** v kořeni workspace. Když se Windows zeptá na aplikaci, zvol *Microsoft ® Windows Based Script Host*.
3. **Zkontroluj pohledem** v okně pumpy:
   - `Slozka requestu: <tvůj workspace>\requests` — pumpa běží z workspace, ne odjinud;
   - blok `==== AI Bridge pripraven - <datum> ====` a v něm `Repozitar: <projekt, nad kterým pracuješ>`;
   - **hned pod hlavičkou bloku žádný řádek `POZOR` ani `CHYBA`** (varování jsou vždy první) — jinak kap. 2.
4. VS Code → Open Folder → workspace → Copilot Chat, režim **Agent**, agent **`sa-analytik`**. První dávka agenta je `ping`; v okně pumpy uvidíš `OK 1/1 req-<id>.json`.

Okno pumpy nech otevřené celý den. Zavírej ho křížkem a nikdy ne uprostřed dávky (`Zpracovavam …` nebo otevřené potvrzovací okno).

## 2. Co píše okno pumpy a co dělat

Každá dávka má v okně jeden výsledkový řádek. Tytéž řádky jdou do logu `responses\pump-RRRR-MM-DD.log` — když potřebuješ hlášku zkopírovat, vezmi ji z logu, v okně nic neoznačuj (kap. 7).

| Hláška v okně | Znamená | Co dělat |
|---|---|---|
| `Cekam na bezici EA s otevrenym projektem ...` | EA neběží nebo nemá otevřený projekt | otevři EA s projektem — pumpa se připojí sama |
| `Pripojeno na EA: …` | připojovací řetězec (cesta zástupce, ne identita) | identitu kontroluj na řádku `Repozitar:` |
| `Code loader: N operaci nacteno z modelu` | kód bridge načten (řádově 140 operací) | nic; 0 nebo jednotky = obrať se na správce |
| `POZOR: repozitar nema polozku ve FB_WriteScope …` | otevřený projekt není nastavený pro zápis (nebo je otevřený jiný) | zkontroluj projekt v EA; sedí-li, správce. Zápisy skončí `E_REPO` |
| `CHYBA konfigurace cile zapisu (E_SCOPE_CONFIG …)` | vadné nastavení cíle zápisu; zápisy stojí, čtení běží | pošli celý řádek správci |
| `POZOR: pumpa vX.Y je starsi nez kod v modelu …` | ve workspace je stará pumpa | správce: refresh workspace; do té doby nezapisuj |
| `STOP: kod v modelu je STARSI nez pumpa v0.6 …` | pumpa dávky nebere | správce nasadí kód; pak restartuj pumpu |
| `Upozorneni: EA security je vypnuta …` | informace (doma běžné) | nic |
| `Zpracovavam req-<id>.json ...` | pumpa dávku provádí | čekej; přes 2 minuty bez výsledku zkontroluj, jestli EA nečeká na dialog (věta B) |
| `OK 3/3 req-<id>.json` | hotovo | nic — agent si odpověď přečte |
| `OK 3/3 req-<id>.json \| varovani: 1` | zapsáno, ale něco s výhradou | nic; agent má podle varování poslat opravnou dávku |
| `CHYBA op[1] E_… req-<id>.json (ok 1/3) - …` | dávka se zastavila na operaci 1; **dřívější operace platí** | nic — agent pošle opravnou dávku s novým id; tutéž dávku nikdy znovu |
| `CHYBA E_… req-<id>.json - …` | dávka odmítnuta celá, nic se nezapsalo | nic — agent opraví (u `E_BLACKLIST` a `E_AMBIGUOUS` kap. 8) |
| `ZAMITNUTO …` | dávku jsi zamítl, nebo vypršela | nic |
| `CEKA NA TEBE (okno potvrzeni) req-<id>.json` | otevřelo se potvrzovací okno | rozhodni (kap. 3) |
| `CEKA req-<id>.json (Storno)` / `(timeout 300 s)` | dávka čeká v `requests\pending\` | okno se vrátí, až agent pošle tentýž soubor znovu, nebo po restartu pumpy |
| `NEPROVEDENO req-<id>.json: chybi cerstva rucni baseline …` | potvrdil jsi, ale chybí ruční záloha | v EA nad uvedeným balíčkem Ctrl+Alt+B → New Baseline (jméno **nesmí** začínat `FB-AUTO`), pak řekni agentovi, ať pošle tentýž soubor znovu |
| `PRERUSENA req-<id>.json: …` | minulý běh skončil uprostřed dávky (zavřené okno, pád EA); **neprovede se znovu** | v EA otevři Output tab *AI Bridge* a podívej se, co proběhlo; agent pošle opravnou dávku s novým id |
| `VYPRSELA req-<id>.json …` | čekající dávka starší než 8 h — zahozena, audit zapsán | nic; je-li pořád potřeba, agent pošle novou |
| `IGNORUJI <soubor> - zpracovavam jen soubory req-*.json …` | v `requests\` leží něco jiného | soubor přesuň jinam |
| `Pumpa uz bezi (zamek requests\.pump.lock) …` / `Pumpa uz bezi z JINE slozky: <cesta> …` | druhá pumpa | zavři toto okno; běží-li pumpa z jiné složky než workspace, zavři tu a spusť `pump.wsf` z workspace |
| `Spojeni s EA ztraceno …` | EA zavřena nebo restartována | otevři EA; pumpa se připojí a kód načte znovu sama |
| `CHYBA E_REPO req-<id>.json - EA ma otevreny jiny projekt … - restartuj pumpu` | v téže EA jsi otevřel jiný projekt | zavři pumpu a spusť ji znovu (kap. 6) |
| `CHYBA code loaderu: …` / `POZOR: operace FB_Main v modelu chybi …` / `WARN: operace X se nezkompilovala …` | kód bridge v modelu chybí nebo je vadný | obrať se na správce (bootstrap) |
| `ERROR u <soubor>: …` / `ERROR smycky: …` | neočekávaná chyba pumpy | pošli správci řádek z logu |

## 3. Potvrzovací okno

Okno **„EA File Bridge - potvrzeni davky <id>"** patří pumpě, ne EA, a drží se navrchu. Nahoře je, **co se stane** (věty, u mazání skutečný rozsah), **kde** (plná cesta), **záloha**, **proč se ptám** a **od kdy dávka čeká**; dole malá patička (id, začátek otisku, počet zápisů, kódy důvodů). První řádek `ZNOVU K POTVRZENI - …` říká, proč se okno ptá podruhé.

- **Ano** = provést teď. **Ne** = zahodit (nic se nezapíše, audit ano). **Storno** = nechat čekat, rozhodneš později.
- **Výchozí tlačítko je Storno** — Enter ani mezerník nic neprovedou.
- Okno zmizí po **5 minutách** = jako Storno. Dávka čeká v `requests\pending\` nejvýš **8 hodin**, pak vyprší.
- Okno se vrátí, **když agent pošle tentýž soubor znovu** (věta C — napiš mu „okno zmizelo"), nebo po restartu pumpy.
- Dokud je okno otevřené, pumpa nic jiného nedělá — další dávky čekají.
- **Než klikneš Ano:** porovnej cestu s Project Browserem; u mazání si přečti rozsah (balíček *včetně N prvků*).

## 4. Věty agenta A–F

Agent používá hotové věty. Co od tebe chtějí:

| Věta | Situace | Co uděláš |
|---|---|---|
| **A** | pumpa neběží (`pump-status.json`) | dvojklik `pump.wsf` ve workspace, zkontroluj `Pripojeno na EA` a `Slozka requestu`, napiš „pokračuj" |
| **B** | pumpa na dávce pracuje | počkej na výsledek v okně, napiš „pokračuj"; přes 2 minuty → hledej dialog EA |
| **C** | dávka čeká na potvrzení | rozhodni v okně pumpy (kap. 3), napiš „hotovo"; zmizelo-li okno, napiš „okno zmizelo" |
| **D** | pumpa čeká na EA | otevři EA s projektem |
| **E** | agent ví, že dávka je chybná | v okně dej **Ne** |
| **F** | po změně členství ve skupinách EA | zavři EA i pumpu a spusť obojí znovu |

## 5. Co jsem změnil → co restartovat

Tatáž tabulka je v návodu správce (`NAVOD-NASAZENI-KLIKACI.md` kap. 4b). *Plný restart EA* = File → Exit a spustit znovu; *Reload Current Project* nestačí nikdy.

| Co se změnilo | Co restartovat | Proč |
|---|---|---|
| Správce nasadil kód nebo konfiguraci **bootstrapem** (v bance vždy) | **plný restart EA**; pumpa v0.6 se po něm připojí sama a kód načte znovu | pumpa čte kód při připojení k EA; EA runtime při startu EA |
| Doma nový kód **`deploy_src` pumpou** | pro pumpu nic (načte ho sama po dávce); pro menu *AI Bridge*, schránku a dvojklik v Output tabu **plný restart EA** | kód EA runtime se načítá jen při startu EA |
| Nová položka v menu *AI Bridge* | plný restart EA | menu se staví při startu EA |
| Členství ve skupinách EA security | plný restart EA (věta F radí zavřít i pumpu — jistota; pumpa v0.6 by se připojila sama) | členství se pamatuje v EA i v pumpě do nového připojení |
| Nová `pump.wsf` (refresh workspace) | restart pumpy | běžící pumpa se sama nevymění |
| V téže EA jsi otevřel **jiný projekt** | restart pumpy | pumpa drží projekt ze startu; jinak `E_REPO` |
| Spustil jsi **druhou EA** | zavři ji a restartuj pumpu | pumpa sedí na první EA |
| EA spadla nebo jsi ji zavřel uprostřed dávky | otevři EA | pumpa se připojí sama a nedokončenou dávku ohlásí `PRERUSENA` |

*Restart pumpy* = zavřít její okno křížkem a dvojklik `pump.wsf`.

## 6. Jen jedna EA

Pumpa se připojí na **první spuštěnou EA**. Druhá EA (i jen pro nahlédnutí do jiného modelu) = pumpa může pracovat nad jiným modelem, než si myslíš. Když potřebuješ jiný projekt, **v téže EA ho otevři a restartuj pumpu** — bez restartu pumpa každou dávku, i čtecí, odmítne větou „EA ma otevreny jiny projekt … - restartuj pumpu".

## 7. V okně pumpy nic neoznačuj

Označení textu myší v okně konzole může pumpu **zastavit**, dokud výběr nezrušíš — vypadá to, že „visí". **Když se zastaví, stiskni Esc.** Hlášky kopíruj z logu `responses\pump-RRRR-MM-DD.log`.

## 8. Kam se zapisuje — cíl zápisu

- **Řekni agentovi, kam psát:** GUID balíčku, nebo plnou cestu (`Model / Oblast / Balík`), nebo balíček vyber v Project Browseru a nech agenta přečíst výběr. Agent před prvním zápisem napíše „Zapíšu do: <plná cesta>" — **zkontroluj ji**.
- **`E_BLACKLIST`** = cíl leží v chráněné části modelu (větev, kam AI nesmí, balíček auditu nebo add-inu). Nic se nezapsalo. Agent dávku neopakuje ani nedělí — **dej mu jiný cíl**; má-li být cíl zapisovatelný, rozhoduje správce.
- **`E_AMBIGUOUS`** = jméno nebo cesta sedí na víc objektů. Agent ukáže kandidáty s cestou — **vyber jeden**, agent pošle GUID.
- **`E_PERMISSION` / `E_LOCKED`** = EA security nepustila (zamčený balíček nebo prvek). Odpověď říká, co stihlo proběhnout; zámek řeší člověk.

## 9. Konec dne a úklid složek

- **Konec dne:** počkej, až pumpa nic nedělá (žádné `Zpracovavam`, žádné okno), zavři její okno, pak EA. Co zůstalo v `requests\pending\`, ti pumpa zítra nabídne znovu (do 8 hodin od vzniku, starší vyprší).
- **Smí se mazat** (při zavřené pumpě, třeba jednou za týden): obsah `requests\processed\`, `requests\rejected\`, `responses\superseded\`, staré `responses\res-*.json` a `responses\pump-*.log`.
- **Nemazat:** `requests\pending\` (čekající dávky — vyřeš je oknem), `requests\processing\` (nedokončenou dávku ohlásí pumpa při startu), `journal\` (staré hodnoty přepsaných polí — podklad pro obnovu), `state-*.txt`.
- **Nevynášet:** odpovědi, logy, `journal\` a dávky obsahují data z repozitáře, cestu připojení, login a skupiny. Nekopíruj je do mailu, chatu mimo pracoviště ani na GitHub; do gitu nejdou (`.gitignore` workspace).

---

Zdroj pravdy pro texty: `pump.wsf` v0.6 a `src\` v0.21 v repu bridge; technická reference `docs\PROTOKOL-EAFB.md`. Changelog: **v1.0 — 2026-10-12** (vlákno Z261004b‑8, balík E revize usability pumpy — FB-PU-05/-06/-08/-14/-39/-40/-41).
