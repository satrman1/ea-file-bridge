# BUILD-VSCODE — build stromu `.github/` z kanonu skillů

*v1.0 — 2026-09-07 (Z260907b-2). Nástroj: `tools/build-vscode.py` (Python 3 stdlib, syntax 3.6+). Specifikace: `IT-ANALYSIS/Zadani-Portace-VSCode-v2.md` kap. 4.4 a 9 (AK-1…AK-5), odchylka PV-R6 (ii) — profil `kuryr` neexistuje, název MDG profilu se nenahrazuje.*

*v1.1 — 2026-09-11 (Z260911‑2): sekce **Sady** — `full` je od 11. 9. výchozí sada doma, `thin` zůstává pro E2E srovnání s bankou a pro rychlý smoke.*

*v1.2 — 2026-09-11 (Z260911‑3): sekce **Terminál** — volitelná varianta s povoleným terminálem (PV-R8 ii, N-P8): klíč profilu `terminal`, přepínač `--terminal on|off`, placeholder `{{TERMINAL_RULES}}`, skilly `re-interface`/`mapovani-rozhrani` jen s terminálem. Výchozí build (terminal off) se tím mění jen o vynechání těchto dvou skillů. build-vscode.py 1.1.*

## Co to dělá

`.github/` (Agent Skills `skills/`, agent `agents/`, `instructions/`, `copilot-instructions.md`, `skills-manifest.md`) je **build výstup**, ne zdroj. Zdroj = kanon `IT-ANALYSIS/Skilly/` (skilly + `_shared/`) a ručně psané šablony `IT-ANALYSIS/Skilly/_vscode/` (copilot-instructions, agent, instructions, skilly `eafb-bridge`, `emr-konvence`, `e2e-f0-f1`).

Build v tomto pořadí: kopie skillů celou složkou (vendoring) → `_shared/` do `skills/emr-konvence/references/` → přepis odkazů mimo strom skillu (tabulka v logu) → backtick `references/x.md` → `[x](references/x.md)` → šablony se substitucí `{{REPO}}`, `{{WHITELIST}}`, `{{DIALEKT}}`, `{{DENY_OPS}}` (+ volitelně `{{CONTEXT_NOTES}}`) → validace (AK-2 name/description, AK-3 references odkázané a nic mimo strom, nenahrazený `{{…}}`, `copilot-instructions.md` ≤ 8 192 B, NUL bajty, konce souborů, marker `## 12.` v `emr-zapis-pravidla.md`) → sweep B1 (T6 regexy + názvy DB z profilu) → manifest se sha256. **Jediná chyba = nic se nezapíše.**

## Sady (`--set`)

**Od 11. 9. 2026 je `full` výchozí sada doma** (build `chore(skills): build vscode doma full 2026-09-11`). `thin` zůstává pro dva účely: **E2E srovnání v bance** (banka jede tenký řez, dokud neproběhne verdikt Fáze 3 — sada musí být na obou stranách stejná) a **rychlý smoke** po zásahu do `build-vscode.py` nebo do šablon `_vscode/` (build ~5× menšího stromu, plná validace i sweep).

| Sada | Kanonové skilly | Generované | Celkem doma | Celkem banka |
|---|---|---|---|---|
| `thin` | 5 (`prevzeti-zadani`, `emr-scaffold`, `use-case-model`, `use-case-analyst`, `emr-qa`) | 3 (`emr-konvence`, `eafb-bridge`, `e2e-f0-f1`) | **8** | 8 |
| `full` | 21 (= všech 22 složek kanonu bez `sa-orchestrator`, který je tělem agenta `sa-analytik`) − 2 terminálové (`re-interface`, `mapovani-rozhrani` — jen s `terminal: on`, sekce **Terminál**) | 3 | **22** (24 s terminálem) | **21** (bez `ea-addin-developer`, PV-R7/N-P4; 23 s terminálem) |

Velikost stromu `.github/` (profil `doma`, měřeno 11. 9. 2026):

| Sada | Souborů | Velikost |
|---|---|---|
| `thin` | 60 | 389 kB |
| `full` | 105 | 668 kB (build 11. 9. ráno, ještě s `re-interface` + `mapovani-rozhrani`) |
| `full` terminal off | 103 | ≈ 640 kB (od Z260911‑3) |
| `full --terminal on` | 107 | ≈ 670 kB (+ `scripts/` 26 kB) |

> Pozn. k AK-1 v `Zadani-Portace-VSCode-v2.md` kap. 9: formulace „`--set full` = 21 skillů (+ `ea-addin-developer` jen v `doma`)" počítá **jen kanonové** skilly a `ea-addin-developer` je už v těch 21 obsažen. Kontrola `find .github/skills -name SKILL.md | wc -l` dávala **24 doma / 23 banka** (21 + 3 generované), ne 22; od Z260911‑3 **22 doma / 21 banka** bez terminálu (24 / 23 s ním). Směrodatné jsou konstanty `SET_FULL` a `TERMINAL_SKILLS` v `tools/build-vscode.py`.

## Terminál (varianta PV-R8 ii — volitelná, výchozí build bez terminálu)

**Proč.** Rozhodnutí PV-R8 (Miloš 7. 9.) = (i) tenký řez bez terminálu — P3 v bance prošel bez jediného Allow právě díky zákazu; pak zkusit variantu s terminálem, „pokud pro něj budeme mít užití". Užití = nález **N-P8**: skill `re-interface` v krocích 2 a 5e volá deterministické skripty `ir-extract.py` (`--repo --repo-map --ref --out`) a `emr-ir-check.py` (`--ir <dir> --dump <soubor>`), skill `mapovani-rozhrani` v kroku 3 generuje Excel z YAML (Python, skript zatím neexistuje). Bez terminálu agent tyto postupy dodržet nemůže — proto oba skilly ve výchozím buildu **nejsou** (ani v sadě `full`), aby se agent nepokoušel „pustit skript" bez nástroje.

**Přepínač.** Klíč profilu `"terminal": false|true` (default `false`, oba profily; jiný typ než bool = FAIL). Jednorázově ho přebije `--terminal on|off` na příkazové řádce (log říká, odkud hodnota přišla: `terminál: on (--terminal)` / `(profil)`). Profil `doma` v repu zůstává `false` — varianta term se builduje `--terminal on --out .github-term` (složka je v `.gitignore`).

Co se při `terminal: on` mění (a jinak nic):

| # | Kde | `terminal: off` (výchozí) | `terminal: on` |
|---|---|---|---|
| a | `agents/sa-analytik.agent.md` frontmatter `tools` | šablona beze změny (`['read', 'search', 'edit']`); šablona nesoucí `execute*` = FAIL | build doplní `'execute/runInTerminal', 'execute/getTerminalOutput'` (jen běh + čtení výstupu, ne celý tool set `execute` s tasks/notebooky) |
| b | pravidlo 11 kitu (`copilot-instructions.md`, v zadání v2 „pravidlo 14") + řádek v tvrdých pravidlech agenta | `{{TERMINAL_RULES}}` = doslovné původní znění „**Nepoužívej terminál.** Vše přes soubory workspace (`requests/`, `responses/`, `zadani/`). Žádné skripty, žádné příkazy." | „**Terminál jen pro skripty skillů** `re-interface` a `mapovani-rozhrani` (`scripts/` uvnitř skillu …). Nikdy `git`, `pip`, síť, instalace, nic mimo workspace. **Každý příkaz ukaž v chatu před spuštěním** a počkej na potvrzení; výstup použij v dalším kroku skillu." (konstanty `TERMINAL_RULES_OFF/ON`) |
| c | sada skillů | `TERMINAL_SKILLS` (`re-interface`, `mapovani-rozhrani`) vynechány i ze sady `full`; log `vynechán … (vyžaduje terminál — N-P8)`; manifest sekce **Vynechané skilly** | zařazeny; k `re-interface` se vendorují skripty z `IT-ANALYSIS/re-fixtures/tools/` (= `<kanon>/../re-fixtures/tools/`, konstanta `TERMINAL_SCRIPTS`) do `skills/re-interface/scripts/` a odkazy `re-fixtures/tools/x.py` v `SKILL.md` se přepíšou na `[x.py](scripts/x.py)`. Skill bez skriptu (dnes `mapovani-rozhrani`; nebo chybějící zdroj) = **WARN** „terminál zapnut, ale skill nenese žádný skript" — build projde, nález zůstává otevřený |
| d | placeholder | `{{TERMINAL_RULES}}` v `_vscode/copilot-instructions.md` a `_vscode/agents/sa-analytik.agent.md` (kontrakt placeholderů rozšířen na 6) | totéž |
| e | manifest | `| Terminál | off |` | `| Terminál | on |`, u skillu výčet `scripts/`; `--verify` hodnotu vypisuje |

**Rozhodnutí: jeden agent s podmínkou, ne druhý agent `sa-analytik-term`.** Důvody: (1) dropdown agentů v bance soutěží s org-level agenty (`organizationCustomAgents`, zadání v2 kap. 4.2 bod 4) — každý další `.agent.md` ho prodlužuje a zvyšuje riziko, že analytik vybere špatný; (2) obě varianty jsou **různé buildy téhož stromu**, ne dva režimy v jednom workspace — ve VS Code se nikdy nepotkají, takže druhý agent by nic nepřidal; (3) dva agenty = dvě těla k údržbě (tělo `sa-orchestrator` by se rozešlo). Cena: přepnutí varianty = výměna složky `.github/` (protokol `docs/e2e-vscode/PROTOKOL-TERMINAL.md`), ne klik v dropdownu. To je záměr — varianta s terminálem má být vědomé rozhodnutí per workspace, ne volba v chatu.

**Názvy nástrojů a Allow (ověřeno 11. 9. 2026 v dokumentaci VS Code, stránky ms.date 9. 9. 2026):** terminál v agent mode = tool set `execute` s nástroji `execute/runInTerminal` (běh příkazu v integrovaném terminálu), `execute/getTerminalOutput`, `execute/createAndRunTask`, `execute/runNotebookCell`, `execute/testFailure` (Copilot features cheat sheet, `code.visualstudio.com/docs/copilot/reference/copilot-vscode-features`); starší název `runCommands` z rozhodnutí PV-R8 v aktuální referenci není. Frontmatter `tools` custom agenta přijímá „built-in tools, tool sets, MCP tools" (`docs/agent-customization/custom-agents`). Schvalování příkazů: každý terminálový příkaz vyžaduje potvrzení (Allow), pokud ho nepokryje `chat.tools.terminal.autoApprove` (mapa příkaz/regex → true/false, `matchCommandLine` pro celou příkazovou řádku), master vypínač `chat.tools.terminal.enableAutoApprove`, `chat.tools.global.autoApprove` = auto-approve všeho (**nikdy v bance**); default: běžné read-only příkazy automaticky, rizikové (`rm`, `del`) s dotazem (`docs/agents/run/approvals`). Pro živý test doma **nic z toho nenastavovat** — protokol měří právě Allow prompty.

**Předpoklady na stanici** (build je nekontroluje): `python` v PATH a **PyYAML** (`ir-extract.py` i `emr-ir-check.py` dělají `import yaml`; bez něj skript skončí „Chybí PyYAML: pip install pyyaml" — a `pip` je agentovi zakázán, instaluje člověk předem). V bance je to další AppLocker/proxy otázka — varianta term zůstává **doma**, dokud nepadne rozhodnutí po 22. 9.

## Příkazy

**Doma** (profil `doma` = demo hodnoty eaexample, commituje se výstup):

```
python tools\build-vscode.py --kanon C:\Users\milos\CLAUDE\IT-ANALYSIS\Skilly --profile doma --set full --log docs\e2e-vscode\build-doma-full.log
python tools\build-vscode.py --profile doma --verify
```

**Banka** (korporátní repo; `config/vscode-profile.banka.json` vznikne ze vzoru `vscode-profile.banka.example.json`, je v `.gitignore`, přes kurýr nikdy nejde):

```
python tools\build-vscode.py --kanon <cesta ke kanonu v bance> --profile banka --set thin
python tools\build-vscode.py --profile banka --verify
```

`--verify` běží bez kanonu i bez pip: přepočítá sha256 každého souboru proti `skills-manifest.md`, hlásí soubory mimo manifest (= ruční editace), počty skillů a sweep. Exit 0/1.

Další přepínače: `--set thin` (tenký řez — viz **Sady** výše), `--terminal on|off` (varianta s terminálem — sekce **Terminál**; přebije klíč profilu), `--out` (default `<repo>/.github`), `--templates` (default `<kanon>/_vscode`), `--config-dir`, `--dry-run` (validuje, nic nezapíše), `--log <soubor>`.

**Varianta s terminálem doma** (výstup mimo `.github/`, necommituje se):

```
python tools\build-vscode.py --kanon C:\Users\milos\CLAUDE\IT-ANALYSIS\Skilly --profile doma --set full --terminal on --out .github-term --log docs\e2e-vscode\build-doma-full-term.log
python tools\build-vscode.py --profile doma --out .github-term --verify
```

## Profily (`config/vscode-profile.<profil>.json`)

| Klíč | doma | banka |
|---|---|---|
| `repo` | `EAEXAMPLE.QEA` | název DB (NAVOD-NASAZENI-BANKA §6) |
| `whitelist[]` `{name, guid}` | `#FB-TEST {CCD344F6-…}` | testovací package(s) EMR_TEST |
| `dialekt` | `sqlite` | `mssql` |
| `denyOps[]` | `[]` | `deploy_src, delete_from_model, clone_package` |
| `contextNotes[]` | volitelné věty do `{{CONTEXT_NOTES}}` | totéž |
| `sweepWords[]` | `[]` | interní slovník (názvy DB, serverů, keys — T6 `zakazana-slova.txt`) |
| `sweepAllow[]` | zdůvodněné výjimky sweepu | totéž |
| `terminal` | `false` (výchozí; `true` = varianta s terminálem, sekce **Terminál**) | `false` |

Klíč `mdg` je zakázaný (PV-R6 ii). `sweepAllow` = položky `{rule, pattern, scope: match|line, reason}` — každá výjimka nese důvod, přesně jak T6 B1 žádá („nález buď odstraň, nebo výslovně zdůvodni"). GUID whitelistu a hodnota `repo` jsou povolené implicitně.

## Sweep B1 a profily

Sweep běží nad celým výstupem v obou profilech. **Doma: neošetřený nález = build FAIL** (výstup se commituje do kurýrního repa — pojistka proti úniku z kanonu, ne kvůli MDG). **Banka: jen report** (hodnoty jsou vlastní hodnoty banky v korporátním repu). Nález doma se řeší buď opravou kanonu (syntetický příklad), nebo položkou `sweepAllow` s důvodem — nikdy editací `.github/`.

## Workspace analytika

Kit pro **workspace repo metodiky** (`C:\GIT\ai-transfer`) nestaví build přímo — volá ho `tools/refresh-workspace.py` s `--out <workspace>\.github` a přidává vendorovanou pumpu + `PUMP-VERSION` + skeleton. Postup, rozhodnutí a klikací test: `docs/WORKSPACE-METODIKY.md`.

## Co se commituje

- `tools/build-vscode.py`, `test/build-vscode.test.py`, `test/fixtures/vscode-kanon/`, `config/vscode-profile.doma.json`, `config/vscode-profile.banka.example.json`, tento návod.
- **Výstup profilu `doma`** v `.github/` — vždy samostatný commit `chore(skills): build vscode doma <sada> <datum>`.
- Nikdy: `config/vscode-profile.banka.json`, výstup profilu `banka`.

## Pravidla

1. **`.github/skills`, `agents`, `instructions`, `copilot-instructions.md` se nikdy needitují ručně.** Manifest to prozradí (`--verify` → „mimo manifest" / „NESOUHLASÍ sha256").
2. **Rituál lekce → kanon → rebuild:** lekce z E2E (VS Code, banka) se zapíše do `IT-ANALYSIS/Skilly/<skill>/` nebo `Skilly/_vscode/`, pak build, pak commit výstupu. V bance jde lekce ven jako change request (T6 část B), doma se propíše do kanonu a kurýr přinese nový build.
3. Šablony `_vscode/` nesou jen placeholdery, žádné konkrétní hodnoty repa; název MDG profilu se píše tak, jak je v kanonu. Nástroj terminálu do `tools` agenta nikdy nepíše šablona — doplňuje ho build při `terminal: on`.
4. Harness bridge (`node test\harness.js`) se buildem nemění (AK-5) — build sahá jen do `.github/`.

## Testy

```
python test\build-vscode.test.py
```

29 testů nad fixture (syntetický kanon 22 skillů + `_shared` + `_vscode` + `test/fixtures/re-fixtures/tools/` stub skripty): pozitivní thin/full × doma/banka, determinismus, dry-run, přegenerování jen spravovaného stromu; **terminál** (off default: skilly vynechány + manifest; on přes `--terminal` i klíč profilu: tools agenta, pravidlo, `scripts/` + přepis odkazů, WARN bez skriptu, banka full 23; klíč jiného typu = FAIL; šablona s `execute` při off = FAIL); negativní name/description/odkaz/placeholder/limit copilot/šablona/marker/sweep/GUID/NUL/klíč mdg; `--verify` po poškození, smazání a přidání souboru.
