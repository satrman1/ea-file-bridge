# VYSLEDKY 2026-10-12 — kit agenta pro kanál s pumpou, cíl zápisu, rekompilace kitů (Z261004b-4, balík C)

Vlákno Z261004b-4 (dávka `IT-ANALYSIS/zaprah-vlaken-2026-10-04b.md`). Předchůdci Z261004b-3 (v0.16) a Z261004b-11 (v0.17) DOBĚHLO. Commit `20d055b` („docs(kit): kanal s pumpou, stavy res, sjednoceni EAFB referenci"), push z VM selhal (credentials) — push dělá Miloš.

## 1. Co se změnilo (kanon `IT-ANALYSIS/Skilly/_vscode/`)

| Soubor | Změna |
|---|---|
| `skills/eafb-bridge/references/EAFB-Pravidla-Agenta.md` | **Přepsán.** Úvod = dva kanály (pumpa / schránka), kdo který má. Rytmus práce: ping = kotva (`writeScope.summary` + `riskPolicy` říct člověku), recon jen když chybí vstup, dávka = logický krok, mazání/přesuny/klony v samostatné dávce (KONCEPCE pravidlo 7). `id` = `<RRRRMMDD>-<4 písmena>-<NN>` (FB-PU-09). Pravidla 1–15: kam se smí psát (blacklist), `E_BLACKLIST` neopakovat/nedělit, Risk Gate s oknem pumpy a čekáním bez limitu, `E_RISK_REJECTED`, Baseline politika místo `create_baseline` (naváděná cesta, `E_NO_BASELINE`), `E_ARGS` s `problems[]` = opravit sám, `E_EXCEPTION` není chyba agenta, `E_INTERRUPTED`, `$N` místo jmen, vazby „oba konce" + zámky EA, kaskády podle `cascadeDelete`, B3, warningy vs. provozní varování. „Kam zapisovat": GUID > cesta > výběr ve stromu > jméno > zeptat se; věta „Zapíšu do:"; `writeCheck`. Kontext: pumpa `get_selected_context`, schránka řádek `eafb-context`. Oddíl **Pumpa (VS Code)**: tabulka stavů `res` (žádný / processing / confirm_required / výsledek), kde co v `res` hledat, hotové věty A–F (C přepsána podle B1: okno znovu bez restartu), zákaz zápisu do `responses\`/`pending\`. Oddíl **Schránka (M365)**: čtení chat ACK (segment `zapis: blacklist`, `writeCheck=`), warningy, QC. |
| `…/EAFB-Chyby-a-Confirm.md` | **Přepsán.** `confirm_required` per kanál (okno pumpy 5 min → tentýž soubor znovu; dialog EA), duplicity, naváděná cesta zálohy, expirace 8 h. Tabulka kódů: − `E_WHITELIST`; + `E_BLACKLIST`, `E_SCOPE_CONFIG`, `E_NO_BASELINE`, `E_INTERRUPTED`, `E_DUPLICATE_ID`, `E_RISK_EXPIRED`; `E_ARGS`/`E_UNKNOWN_OP` s `problems[]`; `E_AMBIGUOUS` s `candidates[]`; `E_NOT_FOUND` s `found`/`children[]`; `E_PERMISSION`/`E_LOCKED` s `items`+`partial`; `E_REPO` = zastav a ohlas (viz otázka 2); `E_EXCEPTION` = není chyba dávky. Warningy: op-level vs. provozní. |
| `…/EAFB-Operace-Registr.md` | `ping` vrací `writeScope`/`riskPolicy`/`access`; `get_selected_context` s `repository` + `writeCheck`; nová sekce **Adresace balíčku cestou** (`{path, from}`, `resolved[]`); `move_elements`/`delete`/`clone`/konektory podle chráněných větví; `$N` jen dopředu, `$0[0]`; „registr je úplný". `{{DIALEKT}}` z reference odstraněn (dialekt nese SKILL.md a instrukce) → tři kopie jsou byte-shodné. |
| `skills/eafb-bridge/SKILL.md` | Kanál pumpa: krok 3 = stavy `res` (zrušeno „~30 s = pumpa neběží", `res-<id>.chat.txt`); `{{WHITELIST}}` nahrazen větou o cíli zápisu; tvrdá pravidla doplněna („Zapíšu do:", `E_ARGS` opravit sám, Baseline politika, `$N`, vazby, zámky). |
| `copilot-instructions.md` | Role: kanál pumpa, `res` jako stavový záznam, executor = předběžná kontrola / chráněné větve. Pravidlo 1 nový tvar `id`; 2 `writeScope`+`riskPolicy`; 3 kam psát + „Zapíšu do:" (bez `{{WHITELIST}}`); 5 GUIDy z `res`; 6 `problems[]`; 7 okno pumpy; 8 `items`/`partial`, `E_EXCEPTION`; 10 Baseline politika místo `create_baseline`, poctivě o „kontrolním bodu" (LOW pumpa provede hned). Velikost 7 343 B (po substituci doma 7 457 B < 8 192). |
| `instructions/emr-zapis.instructions.md` | §1 poslední věta: blacklist + „Zapíšu do:" místo whitelistu; §12 asymetrie bez ✅/⛔ (slovy), mikro-baselines dělá bridge. |
| `agents/sa-analytik.agent.md` | Bod 5 (okno pumpy, záloha bridge) a tvrdé pravidlo (cíl zápisu místo whitelistu). |
| `skills/e2e-f0-f1/SKILL.md` | Kolo 1: cílovou větev určí člověk (výběr/cesta/GUID) + „Zapíšu do:"; kolo 3 „pod cílovou větví"; kolo 7 okno pumpy; limity. Rituál jinak beze změny. |
| `Skilly/_shared/emr-zapis-pravidla.md` | §12a řádky 1–2 → „create mimo chráněné větve" / „create do chráněné větve = `E_BLACKLIST`"; §12g deny-list = seed blacklistu `FB_WriteScope`; §6 P3 věta „pracovní prostor vynucuje kit a zámky, ne kód". Changelog kanonu **needitován** (zadání: čti, needituj) — viz otázka 4. |

Pravidla kitu zrušená jen tam, kde je mechanismus v kódu (revize kap. 4): „~30 s" (stav `processing`), „id unikátní v rámci dne" (`E_DUPLICATE_ID`), „před zápisem `create_baseline`" (Baseline politika), zástupný text jako tvrdé pravidlo (předběžná kontrola — zmínka zůstává). **Zůstává:** povinné `repo`, `TOP N`, bez `matchByName` na nový balíček, „dávku ukaž v chatu" (přeformulováno poctivě), „confirm_required nepřeposílej" (upřesněno: tentýž soubor po zmizení okna ano).

## 2. Kity M365 a transport

- `M365/02-use-case-model/UC-Zapis-EMR.md` (rev. 2026-10-12): hlavička „transportní role EA Bridge Expert" místo „prompt 01"; P3 bullet + věta „Zapíšu do:". Ostatní obsah = kanon beze změny (kanon §1–§8 se od 17. 9. nezměnil).
- `02-Use-Case-Model-Prompt.md`: popisy zdrojů 5 a 7 (chráněné větve, cíl zápisu, warningy). 7 placeholderů.
- `emr-bridge/EA Bridge Expert.md` + `.banka.md`: ping = režim zápisu; `id` nový tvar; `confirm_required` v dialogu EA + `E_RISK_REJECTED` + samostatná dávka pro mazání; nový bod **Cíl zápisu** (GUID > cesta > výběr > jméno, „Zapíšu do:", `E_BLACKLIST`, bez `create_baseline`, `$N`); `E_ARGS` s `problems[]`; kontext ze schránky (`eafb-context`); odstraněno „(stav bridge v0.14)".
- `emr-bridge/EAFB-*.md` = kopie kanonu (cmp shodné). Repo `.github/skills/eafb-bridge/references/` = build (cmp shodné).
- `M365/LDM-Prompt-M365-Copilot.md` **beze změny**: kanon `logicky-datovy-model/SKILL.md` i obě reference (`attribute-naming-conventions.md`, `mermaid-rules.md`) jsou od 17. 9. / 13. 7. nezměněné a kit s nimi souhlasí; prompt do EA nezapisuje, takže řetězec EAFB referencí nepotřebuje (viz otázka 3).
- ZIP `M365/banka-kity-2026-10-12.zip` (README-BANKA.txt rev. 10-12, EA-FILE-BRIDGE 4 soubory, LANGOSH/02 4 soubory); `banka-kity-2026-09-17.zip` → `IT-ANALYSIS/_archiv/kity/`. `M365/README.md` doplněn o odstavec rekompilace.

## 3. Build a ověření

- `python tools/build-vscode.py --kanon <Skilly> --profile doma --set full` → 103 souborů, 22 skillů; `--verify` OK, sweep neošetřené 0. Harness repa beze změny (build sahá jen do `.github/`). `build-vscode.py` nezměněn — nový profilový klíč nebyl potřeba (oddíly Pumpa/Schránka jsou v jednom textu, kanál říká SKILL.md / rolový prompt).
- Grep historických značek (`iterace N`, `neplatí`, ✅/⛔, `ověřeno 20`, `rev. 2026`, `nález N-`, `v0.1x`) nad 9 soubory kitů + 3×3 kopiemi EAFB = 0 (zbylé zásahy: legitimní slova „dřívější operace", „běh neplatí"; `rev. 2026-10-12` v hlavičce kompilátu je záměrná značka verze, byla tam i 17. 9.).
- `cmp` tří kopií = shodné (3/3). JSON příklady v registru a pravidlech validní (`json.loads`, 3 bloky). README v ZIPu uvádí 7 placeholderů = skutečnost.
- Diff každého kitu proti verzi před rekompilací (zálohy v této session): změny jen v bodech kap. 1–2, žádná změna významu mimo bod 1 zadání.

## 4. Otázky pro Miloše (sporné body — nerozhodoval jsem, zvolil jsem konzervativní variantu)

1. **`{{WHITELIST}}` a klíč `whitelist` v profilech buildu** (`config/vscode-profile.doma.json`, `banka.example.json`): šablony ho už nepoužívají (režim whitelist neexistuje), build klíč dál vyžaduje a loguje — mrtvá konfigurace (`#FB-TEST`). Zadání nedovolilo měnit `build-vscode.py` kvůli tomu. Návrh: samostatný malý krok — klíč přejmenovat/zrušit + test; do té doby neškodí.
2. **`E_REPO`:** PROTOKOL §3a (iterace 7) říká „agent se opraví sám", revize FB-PU-38c říká „samooprava ruší smysl deklarace repozitáře". Zvolil jsem **zastav a ohlas, repo opraví jen na hodnotu potvrzenou člověkem**. Potvrdit, nebo vrátit samoopravu.
3. **Kit 03 LDM:** paměť (17. 9.) říká „bude potřebovat totéž (+4 reference EAFB)", ale prompt výslovně nezapisuje („ty sám nikam nezapisuješ"). Přidání zápisové fáze = změna významu → neudělal jsem. Rozhodnout, zda LDM kit dostane fázi 2 (zápis přes EA Bridge Expert) jako kit 02.
4. **Changelog kanonu `emr-zapis-changelog.md`:** zadání ho má v „čti, needituj", ale pravidlo 17. 9. říká „provenance do changelogu". Změny §6/§12a/§12g jsou popsané jen tady — chceš je dopsat do changelogu (3 řádky)?
5. **Kanon §12c mikro-baselines** (`create_baseline(<package>, "AI-pre-…")` skillem) je přežitý Baseline politikou; destilát v instrukcích jsem přepsal, kanon §12c ne (mimo zadaný rozsah). Zařadit do příštího úklidu kanonu.
6. Zadání má `emr-zapis-pravidla.md` zároveň v „čti, needituj" a v bodě 1 „přepsat §12a/§12g/§6" — řídil jsem se bodem 1.

Mimo scope (jen evidence): `Skilly/_shared/hitl-brany.md` ř. 50 „whitelistované území"; `M365/Bootstrap-Prompt-M365-Copilot.md` (srpnový, není v ZIPu) mluví o whitelistu; `Skilly/_vscode/skills/e2e-f0-f1/references/` beze změny.

## 4a. Rozhodnutí Miloše 16:29 a provedení (16:30–16:45)

1. `{{WHITELIST}}` + klíč `whitelist` **zrušeny**: `tools/build-vscode.py` 1.3 (placeholderů 5, profil s klíčem `whitelist` = FAIL, sweep povoluje implicitně jen `repo`), profily `doma` / `banka.example` bez klíče, fixtury testu, `test/build-vscode.test.py` 30/30 (nový `test_profile_whitelist_key_forbidden`), `docs/BUILD-VSCODE.md` v1.3.
2. `E_REPO` **vráceno na samoopravu** (PROTOKOL §3a): odpověď pojmenuje připojený repozitář → agent opraví `repo` a pošle znovu s novým id; „jiný projekt než při startu pumpy" = požádat o restart pumpy. Pravidla agenta bod 2, tabulka kódů, copilot-instructions bod 3.
3. Kit 03 LDM: rozhodnuto **beze změny** (nezapisuje do EA; zápisová fáze až bude potřeba, stejně jako u kitu 02).
4. Changelog kanonu: nová sekce 3b v `Skilly/_shared/emr-zapis-changelog.md` (§6 P3, §12a, §12g, kit 12. 10.; otevřený bod §12c).
5. §12c mikro-baselines — příští úklid kanonu (evidováno v changelogu 3b).
6. Nálezy N-KIT-1 a N-KIT-2 **zapracovány**: Pravidla agenta oddíl Pumpa („O okně mluv až podle `res`"), SKILL.md tvrdá pravidla (věta `writeScope.summary` + odhad oken hned po pingu; okno až podle `res`), copilot-instructions bod 7.

Rebuild `.github/` (103 souborů, verify 0), tři kopie EAFB shodné, ZIP `M365/banka-kity-2026-10-12.zip` přestavěn (stejný název, obsah = kanon 16:45).

## 5. Živý tenký test ve VS Code — 12. 10. 2026 16:10–16:19

Prostředí: VS Code nad `C:\GIT\ea-file-bridge` (čerstvý `.github\` z buildu), agent `sa-analytik`, Claude Opus 5; EA `EAExample.qea`, pumpa v0.5 z repa, vybraný balíček `#FB-TEST`. Úloha: kostra UC „Hodnoť knihu" + scénáře + constrainty, cíl = výběr ve stromu; jednu dávku s překlepem (`create_or_update_scenarious` + `{GUID-UC}`) vhodil Claude jako `req-20261012-hwqn-07.json`.

**Průběh (9 dávek, 1 okno, 0 opravných kol od člověka):**

| # | Dávka | Co | Výsledek |
|---|---|---|---|
| 01 | `ping` | kotva, `writeScope` + `riskPolicy` | done |
| 02 | `get_selected_context` | cíl z výběru, `writeCheck.ok = true` | done |
| 03–04 | recon (`get_packages_information`, `query` s `LIMIT`) | našel existující `UC-95006` téhož UC → **nezaložil duplikát**, nabídl 3 varianty, Miloš zvolil 2 (nový `UC-95007`) | done |
| 05 | `query` | GUIDy požadavků DEMO-9105x pro traceabilitu | done |
| 06 | kostra: package + UC/UCR/Boundary + 2 diagramy + 5 vazeb + umístění + kompozit (řetěz `$N`, bez `matchByName`) | věta **„Zapíšu do: Example Model.Model Based Add-Ins.EA Addins.#FB-TEST"** ✅; ELEVATED (`writeOps 22 > 20`, čistý create bez zálohy) → agent řekl „potvrď Ano v okně pumpy (hash 9fea…)", **čekal**, neposlal znovu; Miloš klikl Ano | done 7/7 |
| 07 | překlep (Claude) | `E_UNKNOWN_OP` (`suggestions`) + `E_ARGS` (zástupný text) — oba problémy najednou, bez okna | error |
| 08 | agent: opravená dávka s novým id — scénáře BE + EF, 4 constrainty, 3 BRU | **opravil obojí sám**, neptal se, neoznačil to za chybu bridge; bridge sám pořídil `FB-AUTO` baseline nad `UC-95007`; **bez okna** (pravidlo 3 `ownSessionLow` — prvek téže session) | done 3/3, 0 warningů |
| 09 | zpětné čtení | shrnutí s GUIDy, confidence flags, ruční kroky | done |

**Kit se osvědčil v:** kontrolní kód, ping jako kotva, cíl z výběru + `writeCheck`, „Zapíšu do:", idempotence (nezaložil duplikát), recon s `LIMIT`, čtení stavů `res` (agent si `res` čte sám, nikdy nechtěl obsah po člověku), čekání u `confirm_required` bez přeposlání, oprava `E_ARGS`/`E_UNKNOWN_OP` z `problems[]` bez zásahu člověka, žádný `create_baseline` od agenta, GUIDy z výsledku do další dávky, `$N` v řetězu.

**Nálezy (agent udělal špatně / kit to má říct líp):**

- **N-KIT-1 (střední):** Agent oznámil „dávka 08 čeká na tvůj klik Ano v okně pumpy" **dřív, než přečetl `res`** — předpověděl ELEVATED (scénáře = rebuild), ve skutečnosti prošla bez okna (`ownSessionLow`). Pak se opravil. Kit: „o okně mluv až podle `status: confirm_required` v `res`, ne podle odhadu" → doplnit do oddílu Pumpa (věta C jen po přečtení stavu).
- **N-KIT-2 (nízká):** Na začátku práce agent **neřekl** člověku `writeScope.summary` ani „která dávka bude chtít potvrzení" (kit Rytmus práce bod 1); odhad LOW/ELEVATED u dávky 06 byl navíc špatně (čekal LOW, bylo 22 > 20). Kit to má, agent to přeskočil — zvážit přesun do tvrdých pravidel SKILL.md.
- **N-KIT-3 (nízká):** Agent nepustil `reload_diagrams` / `layout_connectors` po zápisu a vykázal to jako ruční krok — pravidlo §8 instrukcí má, ale v jedné dávce s kostrou by šlo. Metodika, ne kit bridge.
- **N-KIT-4 (info):** Agent zkusil číst `requests\req-…-07.json` po zpracování (soubor už byl v `processed\` s časovým sufixem) → „Path does not exist". Neškodilo (četl `res`). Kit může říct, že zpracovaná dávka je v `requests\processed\<jméno>.<čas>.json`.
- **N-KIT-5 (info):** Agent sáhl do `docs\` repa pro vzory dávek (e2e-iterace5, e2e-baseline/ready) — v repu bridge to jde, ve workspace `ai-transfer` ty složky nejsou. Není chyba kitu; pro bankovní workspace neplatí.

Spotřeba: 9 dávek (≤ 10), 1 ELEVATED, 0 opravných od člověka, 1 opravná od agenta (záměrně vyvolaná). Vzniklý obsah `UC-95007` v `#FB-TEST` zůstává (fixture pro další běhy; úklid ruční).

## 6. Co zbývá Milošovi

- Push `C:\GIT\ea-file-bridge` (commit `20d055b` + commit VYSLEDKY).
- Nahrát na SharePoint AI_CONTEXT: `EA-FILE-BRIDGE/` všechny 4 soubory (`EA Bridge Expert.md` = bankovní varianta, `EAFB-Pravidla-Agenta.md`, `EAFB-Operace-Registr.md`, `EAFB-Chyby-a-Confirm.md`), `LANGOSH/02-use-case-model/02-Use-Case-Model-Prompt.md` a `UC-Zapis-EMR.md` (UC-Pravidla-* beze změny). Vše v `M365/banka-kity-2026-10-12.zip`.
- Odpovědi na otázky kap. 4.
- Nálezy N-KIT-1 a N-KIT-2 zapracovat do kanonu (`Skilly\_vscode\…\EAFB-Pravidla-Agenta.md` oddíl Pumpa, `SKILL.md` tvrdá pravidla) + rebuild — samostatný malý krok, nebo přibalit k Z261004b-5.
- `C:\GIT\ai-transfer`: `python tools\refresh-workspace.py --workspace C:\GIT\ai-transfer --profile doma --set full --kanon C:\Users\milos\CLAUDE\IT-ANALYSIS\Skilly` (workspace analytika má starý kit).
