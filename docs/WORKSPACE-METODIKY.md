# WORKSPACE-METODIKY — roztržení bridge (produkt správce) a metodiky (workspace analytika)

Verze 1.0 · 2026-09-11 · vlákno Z260911‑4 · realizuje PV-R5 (b) ze `IT-ANALYSIS/Zadani-Portace-VSCode-v2.md` kap. 6 · rozhodnutí Miloše 10. 9.: „když bude pumpa funkční, git repo bridge už nebude potřeba a můžu ji volat z jiného repa, kde bude E2E metodika“.

## 1. Co je co

| Repo | Role | Kdo ho má naklonované | Obsah |
|---|---|---|---|
| `ea-file-bridge` (`C:\GIT\ea-file-bridge`, kurýr `satrman1/ea-file-bridge`) | **produkt pro správce** | správce bridge (Miloš) | `src/` (kód executoru), `pump.wsf`, `scripts/`, `tools/` (build kitu, refresh workspace), `test/`, `docs/`, `config/vscode-profile.*` |
| `ai-transfer` (`C:\GIT\ai-transfer`, kurýr `satrman1/ai-transfer`) | **workspace repo metodiky** — to, ve kterém analytik pracuje ve VS Code | každý analytik | `.github/` (kit Agent Skills z buildu), **kopie** `pump.wsf` + `PUMP-VERSION`, `requests/`, `responses/`, `zadani/`, kontext repa `.example`, `tools/banka-dosad` |

Workspace na bridge repu **nezávisí**: všechno, co z bridge potřebuje, do něj přiteče nástrojem `tools/refresh-workspace.py` a zůstane tam jako vendorovaná kopie s dokladem původu (`.github/skills-manifest.md`, `PUMP-VERSION`). Analytik nikdy nepotřebuje `src/`, harness ani build tool.

## 2. Rozhodnutí: jak dostat pumpu do workspace

Pumpa (`pump.wsf`) čte `requests\` a `responses\` **vedle sebe** — `BASE = fso.GetParentFolderName(WScript.ScriptFullName)` (řádek 62), zámek `requests\.pump.lock`, kód operací bere z modelu (element `AICodeBridge`). Je to jediný soubor bez závislostí na `src/`.

| | (A) vendorovaná kopie `pump.wsf` + `PUMP-VERSION` — **ZVOLENO** | (B) parametr složky `pump.wsf --dir <workspace>` — zamítnuto |
|---|---|---|
| Závislost workspace na bridge repu | **žádná** — workspace je samonosný, analytik klikne `pump.wsf` tam, kde má zadání a dávky | trvalá: bridge repo musí být naklonované na každé stanici a spouštět se z něj |
| Bankovní stanice | jeden strom = korporátní workspace repo; správce nasadí, analytik klikne | dvojí umístění (kurýrní klon bridge + workspace) → dvě cesty, dva `.gitignore`, dvě místa, kde vzniká `requests\`; přesně ten drift, který kurýrní lekce 14. 8. zakazují („hardcoded cesty vyrábějí trvalý drift“) |
| Konzistence s pravidly | vendoring + manifest (banka-repo-struktura, 27. 7.: „update skillu je vědomý akt“) — pumpa se chová jako vendorovaný skill | výjimka z pravidla pro jeden soubor |
| Zastaralost | zjistitelná strojově: `PUMP-VERSION` (sha256 + verze + commit) × pumpa v bridge (`--check`) | zjistitelná jen tím, že běží „nějaká“ pumpa z „nějakého“ klonu |
| Bezpečnost | pumpa ve workspace dělá totéž co v bridge (kód z modelu, whitelist v modelu) — kopie nic neotevírá | totéž, ale okno pumpy ukazuje cestu k jinému repu než k dávkám → chyby obsluhy typu „která `requests\`?“ (N-B-8 rodina) |
| Cena | 17 kB duplicitní soubor + jeden řádek v refresh nástroji | úprava `pump.wsf` (argumenty, validace cesty), nová chyba v bootstrapu bank |

**Jak se pumpa aktualizuje:** jen nástrojem `tools/refresh-workspace.py` z repa bridge (build + kopie + `PUMP-VERSION` + skeleton) — nikdy ručním kopírováním. Po refreshi analytik/správce commitne workspace (`chore(workspace): refresh z bridge <datum>`), do banky to jde kurýrem jako každá verze.

**Jak se pozná zastaralá pumpa** (tři cesty, od nejrychlejší):

1. `python C:\GIT\ea-file-bridge\tools\refresh-workspace.py --workspace C:\GIT\ai-transfer --check` → `aktuální` / `ZASTARALÁ` / `NEODPOVÍDÁ` (ruční editace) / `chybí`; exit 0 / 1 / 1 / 2. Porovnává sha256 pumpy ve workspace × `PUMP-VERSION` × pumpa v bridge.
2. Bez bridge repa (analytik): `PUMP-VERSION` řádek `pump-version:` × první řádek okna pumpy `=== EA File Bridge pumpa vX.Y …` (stejná hodnota je i v hlavičce `pump.wsf`, řádek 19). Liší-li se, kopie byla ručně vyměněna.
3. `--verify` (součást `refresh-workspace.cmd`) dělá 1. + verify `.github/` proti manifestu + skeleton.

Pozn.: verze v hlavičce pumpy je od iterace 4b `v0.5` a nezvyšuje se s každou opravou (v0.13 zámek je jen komentář) — proto je rozhodující **sha256**, verze je jen lidsky čitelná nápověda. Kandidát bridge: při další změně pumpy zvednout hlavičku (`pumpa v0.6`), aby cesta 2 fungovala i bez nástroje.

## 3. Struktura workspace `ai-transfer`

| Cesta | Původ | Do gitu | Poznámka |
|---|---|---|---|
| `.github/copilot-instructions.md`, `agents/sa-analytik.agent.md`, `instructions/*.instructions.md`, `skills/<22 skillů>/`, `skills-manifest.md` | build `tools/build-vscode.py --out <ws>\.github` (profil `doma`, sada `full`, terminál off) | ano — výstup profilu doma je veřejný (PV-R6 ii) | needitovat ručně; `skills-manifest.md` = doklad původu (verze kanonu sha1, sha256 každého souboru); bit-shodné s `.github/` v bridge z commitu `62b4b61` |
| `pump.wsf` | kopie z bridge | ano | v0.5 (eafb/0.2), sha256 `5e37af20…` |
| `PUMP-VERSION` | píše refresh | ano | verze, protokol, sha256, bytes, `bridge-commit 914f921`, `bridge-describe v0.14-9-g914f921`, `pump-commit cbb383c 2026-09-08`, datum |
| `requests/.gitkeep`, `responses/.gitkeep` | refresh | ano (jen `.gitkeep`) | obsah v `.gitignore` (`requests/*`, `responses/*`, `.pump.lock`, `state-*.txt`) |
| `zadani/DBK-hodnot-knihu-brd.md` | kopie z bridge `zadani/` | ano | vzor scénáře PV-R2 (tenký řez F0→F1); refresh do `zadani/` nesahá |
| `EA-Repozitar-Kontext.example.md` | ručně (Z260911‑4) | ano | šablona: velké tabulky a jejich řády (N-B-3), root packages, šablony/vzory, MDG, verzování, číslování, omezení; kopie → `EA-Repozitar-Kontext.md` (doma) / `EA-Repozitar-Kontext-banka.md` (jen korp. repo) — přesně názvy, které kit čte (`eafb-bridge` SKILL, řádek o TOP N) |
| `config/banka-hodnoty.example.json` | ručně | ano | vzor hodnot stanice pro `banka-dosad`; ostrý `config/banka-hodnoty.json` v `.gitignore` |
| `tools/banka-dosad.py` + `.cmd` | ručně (domácí verze nástroje, který v bance 10. 9. napsal Copilot) | ano | `banka-ready\*.json` → dosazení `<TEST-DB>`, `<GUID-SANDBOX>`, `<GUID-AILOG>`, `<WRITE-GROUP>`, `<LOGIN>`, … z configu → `requests\`; fail-closed (config s `<…>` = stop; nenahrazený placeholder = dávka se neuloží; existující soubor v `requests\` se nepřepíše); zdroj → `banka-ready\dosazeno\` (dávka se nikdy nedosadí dvakrát) |
| `.gitignore` | spravovaný blok píše refresh, řádky mimo blok zůstávají | ano | |
| `README.md` | ručně | ano | kontrakt: co je workspace, jak refresh, kurýrní pravidla, co je v `.gitignore` a proč |
| `corbel-banka-2026-08-03-cisty.zip` | historie repa (kurýrní balík Corbel, commit `426ad13`) | zůstává | o přesunu rozhodne Miloš (návrh: samostatné repo nebo `docs/` v corbel-poc) |

**Co ve workspace záměrně NENÍ:** `config/vscode-profile.*.json` (profil patří k build toolu — v bance do korporátního repa bridge, ne do workspace), `src/`, `scripts/`, `test/`, `krok0/`, `docs/` bridge. Kit skill `eafb-bridge` nese vlastní kopii registru operací a pravidel agenta, takže dokumentaci bridge analytik nepotřebuje.

## 4. Nástroj `tools/refresh-workspace.py` (bridge repo, verze 1.0)

```
python tools\refresh-workspace.py --workspace C:\GIT\ai-transfer --profile doma --set full --kanon C:\Users\milos\CLAUDE\IT-ANALYSIS\Skilly [--terminal on|off] [--log <soubor>]
python tools\refresh-workspace.py --workspace C:\GIT\ai-transfer --profile doma --verify
python tools\refresh-workspace.py --workspace C:\GIT\ai-transfer --check
```

Dvojklik: `tools\refresh-workspace.cmd` (doma: workspace `C:\GIT\ai-transfer`, kanon vaultu, profil `doma`, sada `full`; build → verify → okno se zastaví; log `docs\e2e-vscode\refresh-workspace-last.log`, v `.gitignore`).

| Krok | Co udělá | Idempotence |
|---|---|---|
| 1 build | `build-vscode.py --out <ws>\.github` s předanými `--profile/--set/--kanon/--terminal/--config-dir`; při chybě buildu se `.github/` nemění a nástroj končí 1 | otisk stromu před/po — „beze změny“, když kanon dal totéž |
| 2 pumpa | kopie `pump.wsf` + `PUMP-VERSION` | zapisuje jen při rozdílu; `refreshed:` datum se nemění, dokud je stejná pumpa i commit |
| 3 skeleton | `requests/.gitkeep`, `responses/.gitkeep`, `zadani/.gitkeep` (jen je-li `zadani/` prázdná), spravovaný blok v `.gitignore` | blok se nahradí na místě, uživatelské řádky mimo blok zůstávají |

Nesahá na obsah `zadani/`, `requests/`, `responses/`. Odmítne workspace, který neexistuje (exit 2 — naklonuj) nebo je samo repo bridge (exit 2). `--verify` = build verify (sha256 proti manifestu, mimo manifest, sweep, počty) + kontrola pumpy + skeleton; `--check` = jen pumpa. `--dry-run` nic nezapíše.

Testy: `python test\refresh-workspace.test.py` — 15 testů (skeleton vč. netknutého obsahu, dry-run, idempotence 2. běhu, obnova poškozeného bloku `.gitignore`, `--check` aktuální / chybí / ruční editace / zastaralá + obnova, verify po refreshi / ruční editace `.github/` / bez refreshe, vstupy: neexistující workspace, workspace = bridge, bez kanonu). Fixture kanon = `test/fixtures/vscode-kanon/` (sdílená s `build-vscode.test.py`). Harness bridge (`node test\harness.js`) se nemění.

## 5. Kurýr a banka — dopad

- **Doma:** `ai-transfer` jde na osobní GitHub (private, PAT `banka-transfer-readonly` ho už kryje od 29. 7.). Před každým commitem: `--verify` (sweep B1 nad `.github/` s `sweepAllow` profilu doma = 0 neošetřených) + slovník nad celým repem (`csob|kbc|.corp|@F0|emr_test`) = 0 mimo název MDG profilu `CSOB-ITAN` (PV-R6 ii: není citlivý). Push jen Miloš.
- **Banka příště (-5b a dál):** korporátní **workspace** repo = import `ai-transfer` (kopie bez `.git`) + `config/banka-hodnoty.json` + `EA-Repozitar-Kontext-banka.md` + `.github/` přestavěné profilem `banka`. Build profilem `banka` běží z **korporátního repa bridge** (`tools\refresh-workspace.py --workspace <korp. workspace> --profile banka --set thin --kanon <kanon>`), které zůstává jen správci; analytik dostane workspace. Dnešní stav „korporátní repo obsahuje obojí“ (protokol POC banka 10. 9.) se tím rozdělí — bridge korp. repo přestane být místem, kde analytik klikne pumpu.
- **`banka-dosad`:** bankovní verze (Copilot, 10. 9.) se nahradí touto z kurýra při dalším pullu; config zůstává bankovní (gitignored), formát = plochý JSON `{"TEST-DB": "…", …}`. Rozdíl proti bankovní verzi ověřit v diffu (bankovní verze je mimo připojené složky — nemám ji).
- **Nový bod v `NAVOD-NASAZENI-KLIKACI` (kandidát v1.2):** krok „workspace analytika“ = klon/import `ai-transfer` + refresh profilem banka; blok „Placeholdery“ odkazovat na `tools\banka-dosad.cmd` **ve workspace**, ne v bridge.

## 6. Test doma 15 min (Miloš — klikací)

Cíl: důkaz, že workspace nezávisí na bridge repu. Bridge repo přitom **nemá** být otevřené ve VS Code ani z něj nesmí běžet pumpa.

| # | Udělej | Má být vidět | Zapiš |
|---|---|---|---|
| 1 | Zavři každé okno pumpy (jedna instance, N5). Otevři EA s `EAExample.qea`. | Project Browser, package `#FB-TEST`. | — |
| 2 | Dvojklik **`C:\GIT\ai-transfer\pump.wsf`** (ne v bridge). | Okno: `=== EA File Bridge pumpa v0.5 (eafb/0.2, confirm okruh) ===`, řádek `Slozka requestu: C:\GIT\ai-transfer\requests` ← **tohle je ten důkaz**, pak `Pripojeno na EA: …`, `Code loader: N operaci nacteno`, session baseline nad `#FB-TEST`. | N operací: ____ · cesta requestu = ai-transfer ✅/❌ |
| 3 | VS Code → Open Folder → `C:\GIT\ai-transfer` (jen tato složka, ne multi-root). | Strom: `.github\skills\` (22 složek), `.github\agents\sa-analytik.agent.md`, `zadani\DBK-hodnot-knihu-brd.md`, `pump.wsf`, `PUMP-VERSION`. Source Control: čistý (po commitu). | ✅/❌ |
| 4 | Copilot Chat → režim **Agent** → agent **`sa-analytik`** → model Claude Opus 5. | V hlavičce chatu `sa-analytik`. Když chybí: Nastavení `chat.agentFilesLocations` má `.github/agents`, `chat.useAgentSkills` zapnuto. | agent ✅/❌ |
| 5 | Nový chat, napiš doslova: „`/e2e-f0-f1 zadani/DBK-hodnot-knihu-brd.md`“ — a po odpovědi agenta zastav (jen kolo 1 = ping). | První věta odpovědi obsahuje kontrolní kód `SA-KIT-VSC-Q9M`; agent uloží `requests\req-<id>.json` **do ai-transfer**, okno pumpy `Zpracovavam req-<id>.json … Hotovo`, Output tab `FB <id> -> done: 1 ops (1 ok, 0 chyb)`, agent vypíše repozitář `EAEXAMPLE.QEA`, whitelist `#FB-TEST`. Žádný Allow dialog. | kód ✅/❌ · id dávky ____ · Output řádek ____ · kontext % ____ |
| 6 | Průzkumník: `C:\GIT\ai-transfer\requests\processed\` a `responses\`. | `req-<id>` s timestampem v `processed\`, `res-<id>.json` v `responses\`; v bridge `C:\GIT\ea-file-bridge\requests\` **nic nového**. | ✅/❌ |
| 7 | `git status` v ai-transfer. | Čistý — runtime soubory jsou ignorované (`requests/*`, `responses/*`, `.pump.lock`). | ✅/❌ |

Když v kroku 2 pumpa hlásí starou dávku v `pending\`, dej **Ne**. Když v kroku 5 Copilot chce obsah `res` souboru, smí ho číst sám (`responses\res-<id>.json`). Výsledek řádků 2, 5, 6, 7 pošli do vlákna — to je celý záznam; obsah `res-*.json` neopisuj.

## 7. Provedeno 11. 9. 2026 (Z260911‑4)

- Bridge: `tools/refresh-workspace.py` 1.0 + `tools/refresh-workspace.cmd` + `test/refresh-workspace.test.py` (15/15 OK), tento dokument, `.gitignore` (+ `refresh-workspace-last.log`), logy `docs/e2e-vscode/refresh-workspace-doma.log` (refresh) a `refresh-workspace-doma-verify.log` (verify exit 0: 102 souborů sha256 OK, 0 mimo manifest, sweep 0 neošetřených, pumpa aktuální, skeleton OK). Logy běžely z Cowork VM nad připojenými složkami — cesty v nich jsou `/sessions/…/mnt/…`, ne `C:\`; obsah je totožný s během na stanici.
- Workspace `ai-transfer`: refresh profilem doma, sada full, terminál off → `.github/` 103 souborů (22 skillů), bit-shodné s `.github/` v bridge (commit `62b4b61`); `pump.wsf` v0.5 + `PUMP-VERSION`; skeleton; `zadani/DBK-hodnot-knihu-brd.md`; `EA-Repozitar-Kontext.example.md`; `config/banka-hodnoty.example.json`; `tools/banka-dosad.py` + `.cmd`; README (kontrakt). Sanitizace celého repa: B1 regexy → jen GUID whitelistu `#FB-TEST` (hodnota profilu), escapované `\\` v cestách (ne UNC), kódy `Z260911‑4` / `DEMO-9105x` / `OPRAVY-2026` (ne Jira), domácí cesty `C:\GIT\…` v README; slovník → 0 (jen `CSOB-ITAN` v `.github/`, PV-R6 ii). `git status` = jen zamýšlené soubory.
- Commity (push NE): ai-transfer `feat(workspace): …`, bridge `feat(tools): refresh-workspace + docs WORKSPACE-METODIKY`.

## 8. Zbývá (Miloš)

1. Test doma 15 min (kap. 6) → výsledky řádků 2/5/6/7 do vlákna.
2. Push obou rep (`ai-transfer` main, `ea-file-bridge` main) — kurýr pak nese workspace i nástroj.
3. Rozhodnout osud `corbel-banka-2026-08-03-cisty.zip` v `ai-transfer` (zůstat / přesunout).
4. Banka (-5b nebo další návštěva): import `ai-transfer` jako korporátní workspace repo, refresh profilem `banka` z korp. repa bridge, nahradit bankovní `banka-dosad` touto verzí (config zachovat), doplnit `EA-Repozitar-Kontext-banka.md` podle šablony (tabulka velkých tabulek — N-B-3).
