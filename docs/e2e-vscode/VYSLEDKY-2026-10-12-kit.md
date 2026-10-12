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

## 5. Živý tenký test ve VS Code

(doplní se po běhu)

## 6. Co zbývá Milošovi

- Push `C:\GIT\ea-file-bridge` (commit `20d055b` + commit VYSLEDKY).
- Nahrát na SharePoint AI_CONTEXT: `EA-FILE-BRIDGE/` všechny 4 soubory (`EA Bridge Expert.md` = bankovní varianta, `EAFB-Pravidla-Agenta.md`, `EAFB-Operace-Registr.md`, `EAFB-Chyby-a-Confirm.md`), `LANGOSH/02-use-case-model/02-Use-Case-Model-Prompt.md` a `UC-Zapis-EMR.md` (UC-Pravidla-* beze změny). Vše v `M365/banka-kity-2026-10-12.zip`.
- Odpovědi na otázky kap. 4.
