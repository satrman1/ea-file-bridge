# Přechod projektů z `.venv` na nativní Python 3.12 pro stanici

Verze **v1.7**, 2026-10-10 (v1.6 z 2026-10-06 zobecněna pro kurýrní repo: bez patch-verze Pythonu a bez názvu interního zrcadla balíčků) · historie rozhodování a výsledky spiku: `docs/spike-python/PROTOKOL-SPIKE-PYTHON.md` v1.3 § Výsledky — **záměrně neverzováno** (`.gitignore`; protokol nese údaje o prostředí banky), žije jen na stanici

**Stav.** Na obou VDE (test i produkce) je Python **3.12 pro stanici** v `C:\Program Files\Python312` s knihovnami PyYAML, pywin32, comtypes, openpyxl. Interní zrcadlo balíčků pro pip (index) je nastavené v uživatelském `%APPDATA%\pip\pip.ini` na obou stanicích (hotovo 6. 10. 2026); jeho adresa je hodnota banky — jen v `pip.ini`, nikdy do repa. Rozhodnutí: projekty běží na této instalaci, **`.venv` se ruší**, kód bez syntaxe 3.13. Případná 3.13 přijde pro obě prostředí jako balíček s knihovnami — postup se pak zopakuje s jinou cestou.

**Zbývá:** v každém projektu na **testu** zrušit `.venv` a přepnout interpret (§1 + §2). Na produkci `.venv` nikdy nebyl — tam jen §1 krok 5 (interpret ve VS Code), až se projekt poprvé otevře.

**Projekty:** `ea-file-bridge` (bankovní mirror), `ai-skills`, `pkb-wiki`. **`brq-ai` ne** — řeší kolega.

## 1. Zrušení `.venv` v projektu (test)

`<PROJEKT>` = složka projektu. Příkazový řádek (cmd) v ní: `cd /d <PROJEKT>`.

1. Zavři ve VS Code všechny terminály (ikona koše u terminálu) — venv v nich může být aktivovaný a přejmenování by selhalo.

2. Přejmenuj venv na zálohu:

```
ren .venv .venv313-stary
```

3. Ověř, že nativní interpret má knihovny projektu. Očekávaný výstup: `ok`.

```
"C:\Program Files\Python312\python.exe" -c "import yaml, win32com.client, comtypes, openpyxl; print('ok')"
```

   V `pkb-wiki` navíc: `"C:\Program Files\Python312\python.exe" -c "import confluence_publish; print('ok')"` (ze složky, kde modul leží). Chybějící balíček: `"C:\Program Files\Python312\python.exe" -m pip install --user <balík>` (zrcadlo balíčků už je nastavené).

4. **Jen `ea-file-bridge`:** oprava kódování výstupu (nález 6. 10. 2026, test `build-vscode.test.py` 14× FAIL: nástroj v rouře podprocesu psal cp1250 podle locale stanice, test dekóduje UTF-8). V `tools\build-vscode.py`, funkce `safe_console()`, řádek `enc = stream.encoding or "utf-8"` → `enc = "utf-8"`; `BUILD_VERSION = "1.1"` → `"1.2"`. Stejná změna je doma (kanon), kurýr ji příště přinese — v bance ji udělej teď, aby testy prošly.

5. Spusť testy projektu nativním interpretem. EA File Bridge (oba `OK`):

```
"C:\Program Files\Python312\python.exe" test\build-vscode.test.py
"C:\Program Files\Python312\python.exe" test\refresh-workspace.test.py
```

   `ai-skills` / `pkb-wiki`: vlastní testy, nebo aspoň import z kroku 3.

6. Přepni interpreta ve VS Code: `Ctrl+Shift+P` → **Python: Select Interpreter** → položka **3.12.x** s cestou do `Program Files` (ne `.venv`, ne uživatelská 3.13). Když ji seznam nenabízí: „Enter interpreter path…" → `C:\Program Files\Python312\python.exe`. Ověř vpravo dole ve stavovém řádku (s otevřeným `.py` souborem).

7. Smaž zálohu, až testy projdou: `rmdir /s /q .venv313-stary`. `.gitignore` má mít řádek `.venv*/`.

## 2. Totéž přes Copilota (model Gemini Flash, režim Agent)

```
Úkol: přepni tento projekt z .venv na nativní Python 3.12 pro stanici (C:\Program Files\Python312).
Nic mimo složku projektu neměň, nic neinstaluj.

1. Spusť `"C:\Program Files\Python312\python.exe" --version`. Pokud to není 3.12.x, skonči.
2. Přejmenuj `.venv` na `.venv313-stary` (nemaž ho). Pokud to selže, řekni mi, že mám zavřít terminály.
3. Ověř knihovny: `"C:\Program Files\Python312\python.exe" -c "import yaml, win32com.client, comtypes, openpyxl"`
   a importy modulů tohoto projektu (např. confluence_publish). Chybějící balíčky jen vypiš.
4. Kódování (locale stanice je cp1250, stdout utf-8 — výstupy musí být UTF-8 nezávisle na locale):
   a) Je-li tento projekt ea-file-bridge: v tools/build-vscode.py ve funkci safe_console() změň
      `enc = stream.encoding or "utf-8"` na `enc = "utf-8"` a BUILD_VERSION "1.1" na "1.2". Nic dalšího
      v tomto projektu neopravuj (kanon je mimo banku) — ostatní nálezy z bodu b) jen vypiš.
   b) Vypiš všechna volání open() / Path.read_text() / write_text() / subprocess s text=True BEZ
      parametru encoding=. V projektech ai-skills a pkb-wiki je rovnou oprav: doplň encoding="utf-8"
      (u subprocess encoding="utf-8", errors="replace"). Každou změnu vypiš (soubor:řádek).
5. Spusť testy projektu tímto interpretem a vypiš výsledek. Pokud některý test padá na českém textu
   v logu (nahrazovací znaky), je to stále kódování — najdi místo a oprav podle bodu 4.
6. Zkontroluj, že `.venv*/` je v .gitignore; pokud ne, přidej řádek, necommituj.
7. Shrň: verze interpretu, chybějící knihovny, změny z bodu 4, výsledek testů.

Nepoužívej holé `python` ani `py` (mohou ukázat na uživatelskou 3.13), nepoužívej --user, nic neinstaluj.
```

Interpreta ve VS Code (§1 krok 6) přepni ručně.

## 3. Co hlídat

- **Plná cesta k 3.12 pro stanici.** Holé `python`/`py` může na testu sáhnout po uživatelské 3.13. Tu odinstaluj (Nastavení Windows → Aplikace), až všechny projekty běží na 3.12.
- **`encoding=` všude.** Locale je cp1250, stdout utf-8 — `open()` bez `encoding=` zapisuje cp1250 a výstup podprocesu v rouře se kóduje podle locale. Potvrzeno 6. 10. 2026 (14 FAIL v `build-vscode.test.py`). Režim oprav: **ea-file-bridge** = kanon doma, v bance jen stejná jednořádková oprava; **ai-skills / pkb-wiki** = kanon specifikací doma, kód vzniká v bance → Copilot opravuje sám (prompt §2 bod 4b).
- **Interní zrcadlo balíčků jen v `%APPDATA%\pip\pip.ini`** (user), nikdy do repa. Balíčky `--user` jsou per verze Pythonu — po přechodu na 3.13 se instalují znovu, pokud nebudou v balíčku banky.
- **PowerShell místo cmd:** cesta v uvozovkách s `&` na začátku: `& "C:\Program Files\Python312\python.exe" --version`; místo `ren`/`rmdir /s /q` → `Rename-Item` / `Remove-Item -Recurse -Force`.
- **Spec v `pkb-wiki`** (`SPEC_confluence_publish_modul.md`, `SPEC_confluence_layout.md`) uvádí 3.13 → při implementaci changelogu rev. 3 přepsat na „3.12+" (pokyn je v návodu přenosu wiki, `CLA-WORK/NAVOD-prenos-wiki-2026-09-29-banka.md`).
