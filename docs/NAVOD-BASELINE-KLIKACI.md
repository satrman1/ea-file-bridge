# Návod: Baseline politika v EA File Bridge — co dělat, když…

v1.1 · 2026-10-12 (v1.0 2026-09-20) · platí pro kód v0.21 a pumpu v0.6 (`docs/PROTOKOL-EAFB.md` §6j). **Živě ověřeno 11. 10. 2026** (vlákno Z261004b-2, 30/33 kritérií T6, `docs/e2e-baseline/VYSLEDKY-2026-10-11.md`); v1.1 srovnává texty s kódem po balících B1–B2 (vlákno Z261004b‑8). Bez terminálu. Každý krok: **CO – KDE – JAK – OČEKÁVANÝ VÝSLEDEK**.

## A. Jak poznám, co se se zálohou stalo

| CO | KDE | JAK | OČEKÁVANÝ VÝSLEDEK |
|---|---|---|---|
| Přečíst rozhodnutí o záloze | soubor `responses\res-<id>.json` | najdi sekci `"baseline"` | `decision`: `none` = nic se nezálohovalo (dávka jen vytváří) · `created` = vznikla nová záloha · `reused` = použila se záloha z této session / posledních 15 min · `skipped` = zapsalo se bez automatické zálohy, protože existovala čerstvá ruční · `planned` = dávka čeká na potvrzení, záloha vznikne až po něm · `failed` = zálohu nešlo pořídit, nic se nezapsalo |
| Zjistit, nad čím záloha je | tamtéž, `baseline.packages[]` | pole `path` = balíček, `name` = jméno baseline, `subtreeCount` = kolik prvků měl | jméno vypadá `FB-AUTO <login> s<datum>-<n> <datum čas>` |
| Najít zálohu v EA | EA → balíček z `path` v browseru → **Ctrl+Alt+B** | v seznamu hledej jméno z `name` | baseline je v seznamu; **Compare / Restore** dělá správce EMR nebo pověřený uživatel |
| Najít staré hodnoty přepsaných polí | soubor z `baseline.journal.manifestRef` (složka `journal\` vedle `requests\`) | otevři v editoru | `targets[]` = prvek + pole `fields` se starými hodnotami; `uncovered[]` = co manifest nekryje (to kryje jen baseline) |

## B. Dialog říká „BEZ AUTOMATICKE ZALOHY (bez pre-image)"

Znamená: bridge neumí bezpečně zazálohovat balíček, do kterého dávka zasahuje (neví, jak je velký, dávka sahá do víc než 5 balíčků, nebo cíl nejde určit). **Není to chyba** a **neřeší se rozdělením dávky**.

| CO | KDE | JAK | OČEKÁVANÝ VÝSLEDEK |
|---|---|---|---|
| 1. Přečíst, nad čím má být ruční záloha | potvrzovací dialog, řádek „PRED potvrzenim udelej v EA rucni baseline nad: …" | opiš si cestu balíčku; dialog zatím **nepotvrzuj** (Storno = rozhodnout později) | znáš balíček |
| 2. Udělat ruční baseline | EA → ten balíček v browseru → **Ctrl+Alt+B** → **New Baseline** | jméno libovolné, ale **nesmí začínat `FB-AUTO`** (např. `Pred AI zapisem 20. 9.`); OK | baseline je v seznamu |
| 3. Potvrdit dávku | znovu otevři potvrzení — **pumpa v0.6 ho sama neopakuje**: řekni agentovi, ať pošle tentýž soubor znovu (okno se vrátí bez restartu), nebo pumpu restartuj (čekající dávky nabídne po startu); schránka/složka: menu AI Bridge → *Zpracovat davky ze slozky (requests)* | **Ano** do 15 minut od vytvoření baseline (`freshWithinMin`) | dávka proběhne, v res je `decision: "skipped"` a `manual.found` jmenuje tvou baseline |
| Když potvrdíš bez ruční baseline | — | — | nic se nezapíše; konzole pumpy napíše `NEPROVEDENO req-…: chybi cerstva rucni baseline …` a **okno se neopakuje** (N-E2E-4); dávka čeká dál v `requests\pending\` (nejvýš 8 h) — udělej baseline (krok 2) a pokračuj krokem 3 (**Ne** ji zahodí) |
| Jiná cesta | — | pracuj v menším balíčku (dávku cílit do podbalíčku) | bridge zálohu pořídí sám |

## C. Odpověď `E_NO_BASELINE`

Znamená: zálohu nešlo pořídit a dávka je z těch, které bez zálohy nejedou nikdy (mazání, přepis scénářů / constraintů / requirements, rebuild zpráv, přepis parametrů operace, import dokumentu), nebo selhalo samotné vytvoření baseline. **Nic se nezapsalo.**

| CO | KDE | JAK | OČEKÁVANÝ VÝSLEDEK |
|---|---|---|---|
| 1. Přečíst důvod | `res-<id>.json` → `message` a `baseline.reason` | — | „zalohu balicku '…' se nepodarilo poridit (…)" nebo „… destruktivni operace (…) bez moznosti zalohy" |
| 2a. Důvod obsahuje „locked" / zámek | — | balíček je zamčený (EA security) → obrať se na správce. *(Do v0.16 sem patřilo i `E_WHITELIST`; od v0.17 chráněný cíl zastaví už předběžná kontrola kódem `E_BLACKLIST` — k záloze se dávka nedostane.)* | — |
| 2b. Důvod „velikost neznama" / „nad prahem" | EA | udělej ruční baseline nad balíčkem cíle (postup B/2) a **pošli dávku znovu** s novým id | dávka tentokrát skončí dialogem z oddílu B a po potvrzení proběhne *(platí na dev stanici; v bance s `requireRecoveryForUpdates: true` destruktivní dávka nad velkým balíčkem neprojde nikdy — pracuj v menším balíčku)* |
| 3. Kde je původní soubor | `requests\rejected\` (pumpa, schránka, složka i vrátný) | — | soubor s časovým razítkem v názvu |
| 4. Konzole pumpy | okno pumpy | — | `CHYBA E_NO_BASELINE req-<id>.json - …` (jeden výsledkový řádek, pumpa v0.6) |

## D. Úklid automatických záloh

Výchozí stav je **jen hlášení** (`cleanup.mode: "report"`): bridge jednou denně po první zápisové dávce spočítá, co by smazal, a napíše to do Output tabu „AI Bridge" (a jako warning do res). Nic nemaže.

| CO | KDE | JAK | OČEKÁVANÝ VÝSLEDEK |
|---|---|---|---|
| Podívat se, co by se smazalo | EA → **Specialize → AI Bridge → Uklid automatickych baselines (ukazat / provest)** *(položka se objeví až po plném restartu EA po nasazení)* | klik | dialog: počet automatických záloh, počet kandidátů a jejich výpis (balíček · jméno · GUID · uživatel). Kandidát = starší než 14 dní **a zároveň** mimo 3 nejnovější téhož uživatele v témže balíčku |
| Smazat je ručně (první ostré mazání dělej takhle, pod dohledem) | tentýž dialog | **Ano** | výpis „Smazano N"; v `#AI-LOG` vznikne Artifact `FB uklid-baselines-…` se seznamem; **Ne / Storno** = nic se nesmaže |
| Zkontrolovat, že zmizely jen `FB-AUTO …` | EA → balíček → Ctrl+Alt+B | — | ruční baselines, `AI-pre-…` i staré `FB <datum>` jsou pořád tam |
| Přepnout na automatické mazání | `src/AICodeBridge.FB_RiskPolicy.js`, sekce `baseline.cleanup.mode` → `"delete"` + do komentáře datum a jméno; nasadit `deploy_src` (doma) / bootstrap + plný restart EA (banka — `NAVOD-NASAZENI-KLIKACI.md` 5.7) | **až po**: 10 bězích hlášení bez překvapivého kandidáta, nejdřív po 14 dnech, a po jednom ručním mazání z menu | počítadlo běhů je v `state-cleanup.txt` (`<poslední běh>|<počet>|<první běh>`) |

## E. Vypnutí session zálohy při startu (banka)

Od v0.17 je `baseline.sessionBaseline: "off"` výchozí všude (doma i v bance — v režimu blacklist nemá session záloha cíl, FB-CZ-25). Konzole pumpy při startu hlásí řádek `Session baseline se nedela (sessionBaseline off). Zalohy se poridi automaticky az pred prvnim zapisem - vzdy nad konkretnim balickem, ne nad celou vetvi.` Hlášení o repozitáři a cíli zápisu (blacklist) běží dál.

## Changelog

- **v1.1 — 2026-10-12** (vlákno Z261004b‑8): stav „živě ověřeno 11. 10."; B3 návrat okna u pumpy v0.6 (okno se samo neopakuje — tentýž soubor znovu nebo restart pumpy; ř. 22 v1.0 „čekající dávky nabídne sama" platila jen pro start pumpy); B řádek „bez ruční baseline" = `NEPROVEDENO` bez opakování okna (N-E2E-4); C 2a bez `E_WHITELIST` (v0.17), C 4 řádek konzole; D nasazení politiky v bance bootstrapem; E session baseline vypnutá výchozí.
- v1.0 — 2026-09-20: vznik (stavba Baseline politiky, texty opsané z kódu).
