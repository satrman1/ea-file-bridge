# Protokol eafb/0.1 — EA File Bridge (POC tracer bullet)

2026-08-13 · Ověřeno E2E na eaexample (dávky e2e-01 … e2e-07) · Doplněk k `PROTOKOL.md` (AI Code Bridge) · Zadání: `IT-ANALYSIS/Zadani-POC-EA-File-Bridge.md` v1.1

## Architektura

```
AI driver (Copilot/Claude)          pumpa (pump.wsf, WSH)            EA (běžící instance)
  píše requests\req-*.json  ──►  watcher ~1 s, COM attach   ──►  executor = kód operací FB_*
  čte responses\res-*.json  ◄──  zapíše response, archivuje  ◄──  z elementu AICodeBridge (11037)
```

- **Jediný kanon kódu = model.** Pumpa nemá logiku — při připojení načte těla operací `FB_*` z elementu AICodeBridge (SQL lookup dle jména + stereotypu `JavascriptAddin`) a zkompiluje. Změna kódu = ITAN-Inject (z `src/`) + restart pumpy.
- **Zápis výhradně Automation API.** `Repository.SQLQuery` jen čtení (vrací i GUIDy).
- Složky vedle `pump.wsf`: `requests\` (vstup), `responses\` (výstup), `requests\processed\` (archiv s timestampem), `requests\rejected\` (nevalidní).
- Životní cyklus souboru: `req-X.json` → zpracování → `res-X.json` + přesun requestu do `processed\` (`rejected\` u E_PARSE). Při zavřeném EA request **čeká ve frontě** a zpracuje se po re-attachi (smyčka nikdy nepadá).

## Request (1 soubor = 1 dávka)

```json
{
  "protocol": "eafb/0.1",
  "id": "unikatni-id-davky",
  "repo": "EAExample.qea",
  "ops": [
    { "op": "ping", "echo": "text" },
    { "op": "query", "sql": "SELECT ... " },
    { "op": "create_element", "package": "{GUID} | packageID | jméno",
      "name": "...", "type": "Class", "stereotype": "", "notes": "plain text" }
  ]
}
```

- `repo` — deklarace cílového repozitáře (podřetězec ConnectionString, case-insensitive). Volitelné v protokolu, **povinné v copilot-instructions**. Při neshodě se neprovede NIC (ani audit) → `E_REPO`. Důvod: testovací repozitář vzniká klonem produkčního — GUIDy se shodují, instanci rozliší jen deklarace v dávce.
- `sql` plain text (řádné JSON escapování); alternativně `sql_b64`. **Notes preferovaně plain** (`notes`) — JSON escaping tab/diakritiku zvládá; `notes_b64` (base64 UTF-8) zůstává podporované jako záloha. (Base64 lekce z addin-bridge platila pro JSON vrstvu MCP serveru; v eafb parseru neplatí. Změna 2026-08-14 po generálce: driver si base64 ověřoval terminálem → ruční Allow.)
- Sémantika dávky: **stop-on-error** — první chyba zastaví zbytek (`skipped`).

## Response

```json
{
  "protocol": "eafb/0.1", "id": "...", "status": "done | error",
  "repository": "connection string připojeného EA",
  "results": [
    { "op": "ping", "status": "ok", "echo": "...", "eaVersion": "...", "repository": "...", "time": "..." },
    { "op": "query", "status": "ok", "rowCount": 2, "rows": [ { "sloupec": "hodnota" } ] },
    { "op": "create_element", "status": "ok", "guid": "{...}", "elementId": 123, "name": "..." }
  ],
  "audit": { "aiLogGuid": "{...}" }
}
```

## Chybové kódy

| Kód | Úroveň | Význam |
|---|---|---|
| `E_PARSE` | dávka | nevalidní JSON / chybí `ops` → soubor do `rejected\`, bez auditu |
| `E_REPO` | dávka i op | deklarace `repo` nesedí na připojený repozitář, NEBO připojený repozitář nemá žádnou whitelist položku; nic se neprovede |
| `E_UNKNOWN_OP` | op | neznámá operace |
| `E_ARGS` | op | chybí povinné argumenty |
| `E_SQL_READONLY` | op | jiný dotaz než SELECT/WITH |
| `E_WHITELIST` | op | package mimo whitelist (v rámci správného repozitáře) |
| `E_NOT_FOUND` | op | package/cíl nenalezen |
| `E_EXCEPTION` | op/dávka | neočekávaná výjimka |
| `E_NO_EXECUTOR` | dávka | v modelu chybí FB_Main (nespuštěný inject) |

## Bezpečnostní výbava (povinná, ne volitelná)

1. **Whitelist vázaný na instanci repozitáře** (`FB_Whitelist`, jediné místo pravdy v kódu = v modelu): položka `{ repo: podřetězec ConnectionString, pkg: "{GUID}" }`. Zápis projde jen při shodě obojího. Klon repozitáře (shodné GUIDy, jiný connection string) → `E_REPO`; přesměrování whitelistu na klon = vědomá, baselinovaná změna kódu.
2. **Deklarace `repo` v dávce** — kryje opačný směr (dávka pro Test zpracovaná v Prod, kde whitelist i GUIDy po klonu sedí).
3. **Auto-baseline** whitelistovaných packages při startu session pumpy (`FB_SessionStart`); položky cizího repozitáře se přeskakují s varováním v konzoli; 0 baselinů = hlasité POZOR.
4. **Audit**: každá provedená dávka = Artifact `FB <id>` v `#AI-LOG` (tagy `ai.channel=eafb`, `ai.request`; Notes = souhrn + celý request). Každý zapsaný element nese tagy `ai.channel` + `ai.request` (detektivní model práv, kap. 3 zadání v1.5).

## ⚠ SQL dialekty

Dotazy v `query` běží v dialektu připojeného repozitáře: **lokální `.qea` = SQLite**, **bankovní repozitář = MS SQL 2022**. Executor SQL jen provádí — dialekt musí hlídat autor dotazu (skilly / copilot-instructions / ea-sql-expert). Dotazy pro fázi 2 psát rovnou v MS SQL; sdílené dotazy omezit na průnik obou dialektů.

## Provoz (klikací)

- Start: dvojklik `pump.wsf` (sám se přehodí do konzole). Konec: zavřít okno.
- Po změně kódu v `src/`: EA Scripting → **ITAN-Inject Addin Code** → restart pumpy.
- Konzole při startu hlásí připojený repozitář, počet načtených operací a výsledek baseline — **zkontrolovat pohledem, že repozitář je ten zamýšlený**.

## Stav modelu (eaexample)

AICodeBridge el. 11037 — operace FB_Main, FB_JsonParse, FB_JsonStringify, FB_XmlRows, FB_OpPing, FB_OpQuery, FB_OpCreateElement, FB_Whitelist, FB_Audit, FB_SessionStart (operationID 1155–1164). Packages: `#FB-TEST` 1054 `{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}` (whitelist), `#AI-LOG` 1055 `{8DF101C4-14A9-4b89-927E-833EA58D9F3C}` (audit). Kanon: `addin-bridge/src/AICodeBridge.FB_*.js` (po každém deployi sync!).
