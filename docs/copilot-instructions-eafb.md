# Copilot instructions — EA File Bridge (eafb/0.1, fáze 2 POC)

> Nasazení: obsah vložit do `.github/copilot-instructions.md` ve VS Code workspace na dev stanici (nebo přiložit jako kontext). Laděno pro Claude rodinu (bankovní default Claude Opus 4.8).

---

Pracuješ s Enterprise Architect přes **EA File Bridge**: souborový protokol místo přímého API. Nemáš žádný jiný způsob, jak s EA mluvit.

## Jak to funguje

1. Request = JSON soubor, který **zapíšeš** do složky `requests/` (jméno `req-<krátké-id>.json`, id unikátní v rámci dne).
2. Běžící pumpa ho do ~2 s zpracuje a **zapíše odpověď** do `responses/res-<stejné-id>.json`.
3. Odpověď **přečti a interpretuj**. Pokud do ~10 s neexistuje, počkej a zkus číst znovu (max ~30 s, pak ohlas problém uživateli — pumpa zřejmě neběží).

## Formát requestu

```json
{
  "protocol": "eafb/0.1",
  "id": "20260813-01",
  "repo": "<TEST-DB>",
  "ops": [
    { "op": "ping", "echo": "kontrola" },
    { "op": "query", "sql": "SELECT Object_ID, Name, ea_guid FROM t_object WHERE Name = 'X'" },
    { "op": "create_element", "package": "{GUID-package}", "name": "Jméno", "type": "Class", "stereotype": "entity", "notes": "text poznámky (klidně víceřádkový, s diakritikou)" }
  ]
}
```

## Pravidla (závazná)

1. **`repo` je povinné** — deklaruje cílový repozitář **názvem databáze** (skutečnou hodnotu dosaď při nasazení; hodnotu ti řekne uživatel na začátku práce). Chrání proti zpracování dávky ve špatném repozitáři.
2. **První dávka session = samotný `ping`.** Z odpovědi zkontroluj pole `repository` — obsahuje název databáze a musí odpovídat očekávanému repozitáři (pole `connection` je jen informativní cesta připojení). Nesedí-li, zastav se a ohlas to uživateli.
3. **Notes posílej jako obyčejný text** v poli `notes` (řádné JSON escapování stačí — diakritiku i tabulátory protokol zvládá). Pole `notes_b64` (base64 UTF-8) existuje jen jako záloha — nepoužívej ho, ať nemusíš nic kódovat ani ověřovat.
4. **SQL**: jen SELECT/WITH (zápis přes SQL je zakázán a executor ho odmítne). Dialekt = dialekt repozitáře: bankovní repozitář = **MS SQL 2022**, lokální `.qea` = SQLite.
5. **Zápis jen do vyhrazeného package** (whitelist vynucuje executor — `E_WHITELIST`/`E_REPO` neobcházej, ohlas uživateli).
6. Dávka běží **stop-on-error**: první chyba zastaví zbytek (`skipped`). Po chybě si přečti `code` + `message`, oprav request a pošli nový soubor s novým id (starý nikdy nepřepisuj).
7. Odpověď `status:"done"` + pole `results` v pořadí operací; vytvořené elementy vrací `guid` a `elementId` — **GUIDy si pamatuj a používej v dalších dávkách**.
8. **Nepoužívej terminál.** Celá práce jde přes soubory (zápis requestu, čtení response) — žádné příkazy, žádné externí ověřování, nic ke schvalování uživatelem. Na response čekej opakovaným čtením složky `responses/`.

## Chybové kódy

`E_PARSE` (nevalidní JSON), `E_REPO` (špatný repozitář — nic se neprovedlo), `E_UNKNOWN_OP`, `E_ARGS`, `E_SQL_READONLY`, `E_WHITELIST`, `E_NOT_FOUND`, `E_EXCEPTION`, `E_NO_EXECUTOR` (pumpa bez kódu — ohlas uživateli).

## Příklad úkolu

Uživatel: „Zjisti GUID elementu Zakaznik a založ vedle něj element Objednavka."

1. `req-a.json`: ping (kontrola repository)
2. `req-b.json`: query `SELECT Object_ID, Name, Package_ID, ea_guid FROM t_object WHERE Name = 'Zakaznik'`
3. `req-c.json`: create_element do téhož package (GUID package zjisti query na `t_package`), name `Objednavka`
4. Shrň uživateli: GUIDy, elementId, případné chyby.
