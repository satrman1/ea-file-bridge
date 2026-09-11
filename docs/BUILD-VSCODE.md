# BUILD-VSCODE — build stromu `.github/` z kanonu skillů

*v1.0 — 2026-09-07 (Z260907b-2). Nástroj: `tools/build-vscode.py` (Python 3 stdlib, syntax 3.6+). Specifikace: `IT-ANALYSIS/Zadani-Portace-VSCode-v2.md` kap. 4.4 a 9 (AK-1…AK-5), odchylka PV-R6 (ii) — profil `kuryr` neexistuje, název MDG profilu se nenahrazuje.*

*v1.1 — 2026-09-11 (Z260911‑2): sekce **Sady** — `full` je od 11. 9. výchozí sada doma, `thin` zůstává pro E2E srovnání s bankou a pro rychlý smoke.*

## Co to dělá

`.github/` (Agent Skills `skills/`, agent `agents/`, `instructions/`, `copilot-instructions.md`, `skills-manifest.md`) je **build výstup**, ne zdroj. Zdroj = kanon `IT-ANALYSIS/Skilly/` (skilly + `_shared/`) a ručně psané šablony `IT-ANALYSIS/Skilly/_vscode/` (copilot-instructions, agent, instructions, skilly `eafb-bridge`, `emr-konvence`, `e2e-f0-f1`).

Build v tomto pořadí: kopie skillů celou složkou (vendoring) → `_shared/` do `skills/emr-konvence/references/` → přepis odkazů mimo strom skillu (tabulka v logu) → backtick `references/x.md` → `[x](references/x.md)` → šablony se substitucí `{{REPO}}`, `{{WHITELIST}}`, `{{DIALEKT}}`, `{{DENY_OPS}}` (+ volitelně `{{CONTEXT_NOTES}}`) → validace (AK-2 name/description, AK-3 references odkázané a nic mimo strom, nenahrazený `{{…}}`, `copilot-instructions.md` ≤ 8 192 B, NUL bajty, konce souborů, marker `## 12.` v `emr-zapis-pravidla.md`) → sweep B1 (T6 regexy + názvy DB z profilu) → manifest se sha256. **Jediná chyba = nic se nezapíše.**

## Sady (`--set`)

**Od 11. 9. 2026 je `full` výchozí sada doma** (build `chore(skills): build vscode doma full 2026-09-11`). `thin` zůstává pro dva účely: **E2E srovnání v bance** (banka jede tenký řez, dokud neproběhne verdikt Fáze 3 — sada musí být na obou stranách stejná) a **rychlý smoke** po zásahu do `build-vscode.py` nebo do šablon `_vscode/` (build ~5× menšího stromu, plná validace i sweep).

| Sada | Kanonové skilly | Generované | Celkem doma | Celkem banka |
|---|---|---|---|---|
| `thin` | 5 (`prevzeti-zadani`, `emr-scaffold`, `use-case-model`, `use-case-analyst`, `emr-qa`) | 3 (`emr-konvence`, `eafb-bridge`, `e2e-f0-f1`) | **8** | 8 |
| `full` | 21 (= všech 22 složek kanonu bez `sa-orchestrator`, který je tělem agenta `sa-analytik`) | 3 | **24** | **23** (bez `ea-addin-developer`, PV-R7/N-P4) |

Velikost stromu `.github/` (profil `doma`, měřeno 11. 9. 2026):

| Sada | Souborů | Velikost |
|---|---|---|
| `thin` | 60 | 389 kB |
| `full` | 105 | 668 kB |

> Pozn. k AK-1 v `Zadani-Portace-VSCode-v2.md` kap. 9: formulace „`--set full` = 21 skillů (+ `ea-addin-developer` jen v `doma`)" počítá **jen kanonové** skilly a `ea-addin-developer` je už v těch 21 obsažen. Kontrola `find .github/skills -name SKILL.md | wc -l` proto dává **24 doma / 23 banka** (21 + 3 generované), ne 22. Směrodatná je konstanta `SET_FULL` v `tools/build-vscode.py`.

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

Další přepínače: `--set thin` (tenký řez — viz **Sady** výše), `--out` (default `<repo>/.github`), `--templates` (default `<kanon>/_vscode`), `--config-dir`, `--dry-run` (validuje, nic nezapíše), `--log <soubor>`.

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

Klíč `mdg` je zakázaný (PV-R6 ii). `sweepAllow` = položky `{rule, pattern, scope: match|line, reason}` — každá výjimka nese důvod, přesně jak T6 B1 žádá („nález buď odstraň, nebo výslovně zdůvodni"). GUID whitelistu a hodnota `repo` jsou povolené implicitně.

## Sweep B1 a profily

Sweep běží nad celým výstupem v obou profilech. **Doma: neošetřený nález = build FAIL** (výstup se commituje do kurýrního repa — pojistka proti úniku z kanonu, ne kvůli MDG). **Banka: jen report** (hodnoty jsou vlastní hodnoty banky v korporátním repu). Nález doma se řeší buď opravou kanonu (syntetický příklad), nebo položkou `sweepAllow` s důvodem — nikdy editací `.github/`.

## Co se commituje

- `tools/build-vscode.py`, `test/build-vscode.test.py`, `test/fixtures/vscode-kanon/`, `config/vscode-profile.doma.json`, `config/vscode-profile.banka.example.json`, tento návod.
- **Výstup profilu `doma`** v `.github/` — vždy samostatný commit `chore(skills): build vscode doma <sada> <datum>`.
- Nikdy: `config/vscode-profile.banka.json`, výstup profilu `banka`.

## Pravidla

1. **`.github/skills`, `agents`, `instructions`, `copilot-instructions.md` se nikdy needitují ručně.** Manifest to prozradí (`--verify` → „mimo manifest" / „NESOUHLASÍ sha256").
2. **Rituál lekce → kanon → rebuild:** lekce z E2E (VS Code, banka) se zapíše do `IT-ANALYSIS/Skilly/<skill>/` nebo `Skilly/_vscode/`, pak build, pak commit výstupu. V bance jde lekce ven jako change request (T6 část B), doma se propíše do kanonu a kurýr přinese nový build.
3. Šablony `_vscode/` nesou jen placeholdery, žádné konkrétní hodnoty repa; název MDG profilu se píše tak, jak je v kanonu.
4. Harness bridge (`node test\harness.js`) se buildem nemění (AK-5) — build sahá jen do `.github/`.

## Testy

```
python test\build-vscode.test.py
```

22 testů nad fixture (syntetický kanon 22 skillů + `_shared` + `_vscode`): pozitivní thin/full × doma/banka, determinismus, dry-run, přegenerování jen spravovaného stromu; negativní name/description/odkaz/placeholder/limit copilot/šablona/marker/sweep/GUID/NUL/klíč mdg; `--verify` po poškození, smazání a přidání souboru.
