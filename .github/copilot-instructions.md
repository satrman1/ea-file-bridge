# EA File Bridge — instrukce pro Copilot agenta (DOMÁCÍ generálka, eaexample)

> Tento soubor patří do `.github/copilot-instructions.md` ve workspace `C:\GIT\ea-file-bridge`.
> Domácí varianta pro vrstvu 3 (generálka fáze 2): repo = eaexample, dialekt SQLite.
> Bankovní varianta (`<TEST-DB>`, MS SQL 2022) se z ní odvodí až při nasazení.

---

Pracuješ s Enterprise Architect přes **EA File Bridge**: souborový protokol místo přímého API. Nemáš žádný jiný způsob, jak s EA mluvit. Pumpa běží na tomto počítači a sleduje složku `requests/`.

## Jak to funguje

1. Request = JSON soubor, který **zapíšeš** do složky `requests/` (jméno `req-<krátké-id>.json`, id unikátní).
2. Pumpa ho do ~2 s zpracuje a **zapíše odpověď** do `responses/res-<stejné-id>.json`.
3. Odpověď **přečti a interpretuj**. Pokud do ~10 s neexistuje, počkej a zkus číst znovu (max ~30 s, pak ohlas uživateli, že pumpa zřejmě neběží).

## Formát requestu

```json
{
  "protocol": "eafb/0.1",
  "id": "20260813-01",
  "repo": "EAExample.qea",
  "ops": [
    { "op": "ping", "echo": "kontrola" },
    { "op": "query", "sql": "SELECT Object_ID, Name, ea_guid FROM t_object WHERE Name = 'X'" },
    { "op": "create_element", "package": "{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}", "name": "Jméno", "type": "Class", "stereotype": "entity", "notes": "text poznámky (klidně víceřádkový, s diakritikou)" }
  ]
}
```

## Pravidla (závazná)

1. **`repo` je povinné** a v tomto workspace je vždy `"EAExample.qea"`. Chrání proti zpracování dávky ve špatném repozitáři.
2. **První dávka session = samotný `ping`.** Z odpovědi zkontroluj pole `repository` — musí obsahovat `EAExample.qea`. Nesedí-li, zastav se a ohlas to uživateli.
3. **Notes posílej jako obyčejný text** v poli `notes` (řádné JSON escapování stačí — diakritiku i tabulátory protokol zvládá). Pole `notes_b64` (base64 UTF-8) existuje jen jako záloha — nepoužívej ho, ať nemusíš nic kódovat ani ověřovat.
4. **SQL**: jen SELECT/WITH (zápis přes SQL executor odmítne). Dialekt zde = **SQLite** (lokální .qea soubor); v bance bude MS SQL 2022.
5. **Zápis jen do vyhrazeného package `#FB-TEST`** = `{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}` (whitelist vynucuje executor — `E_WHITELIST`/`E_REPO` neobcházej, ohlas uživateli).
6. Dávka běží **stop-on-error**: první chyba zastaví zbytek (`skipped`). Po chybě si přečti `code` + `message`, oprav request a pošli nový soubor s novým id (starý nikdy nepřepisuj).
7. Odpověď `status:"done"` + pole `results` v pořadí operací; vytvořené elementy vrací `guid` a `elementId` — **GUIDy si pamatuj a používej v dalších dávkách**.
8. **Nepoužívej terminál.** Celá práce jde přes soubory (zápis requestu, čtení response) — žádné příkazy, žádné externí ověřování, nic ke schvalování uživatelem. Na response čekej opakovaným čtením složky `responses/`.

## Chybové kódy

`E_PARSE` (nevalidní JSON), `E_REPO` (špatný repozitář — nic se neprovedlo), `E_UNKNOWN_OP`, `E_ARGS`, `E_SQL_READONLY`, `E_WHITELIST`, `E_NOT_FOUND`, `E_EXCEPTION`, `E_NO_EXECUTOR` (pumpa bez kódu — ohlas uživateli).
