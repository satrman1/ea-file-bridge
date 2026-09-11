# AI Code Bridge — programování add-inů přes MCP

Bridge řeší mezeru: MCP neexponuje `t_operation.Code`. Vzor = **request v modelu + HITL executor**.
Kanon add-inu bridge: `IT-ANALYSIS/addin-bridge/` (src/, Scripts/, PROTOKOL.md, dump/).

## Komponenty

- **AICodeBridge** — model add-in (klon vendor vzoru), umístěný vedle příkladů v `Model Based Add-Ins/EA Addins`.
- **Inbox `#AI-CODE`** — package, kam AI přes MCP zakládá request elementy.
- **src/** — kanonické JS zdrojáky (`AICodeBridge.<Operace>.js` = tělo funkce). Po každém deployi synchronizovat.

## Formát requestu

Element typu **Artifact** v `#AI-CODE`:

- **Name:** `REQ-<nn> <Cíl>.<Operace>`
- **Tagged values:**
  - `mode` — `deploy` | `export` | `query`
  - `targetGuid` — cíl: GUID `{..}` | **elementID** (číslo) | jméno elementu (u deploy/export)
  - `opName` — jméno cílové operace (u deploy/export)
  - `status` — `PENDING` → `DONE` | `ERROR` | `EXPORTED` (nastavuje bridge)
  - `detail` — výsledek/chyba (nastavuje bridge)
- **Notes** — base64 payload (viz módy).

## Módy

| mode | vstup (Notes) | akce | výstup |
|---|---|---|---|
| `deploy` | base64(JS kódu) | zapíše do `Method.Code` cílové operace | status DONE, aktivace až po restartu |
| `export` | prázdné | přečte `Method.Code` cílové operace | Notes = base64(kódu), status EXPORTED |
| `query` | base64(SQL) | `Repository.SQLQuery` (jen SELECT/WITH, read-only) | Notes = base64(XML výsledku), status DONE |

## HITL smyčka

1. **AI (MCP):** založí request(y) se `status=PENDING`.
2. **Člověk (EA):** AI Bridge → Process requests (#AI-CODE). Bridge zpracuje všechny PENDING najednou, loguje do
   System Output tabu „AI Bridge".
3. **AI (MCP):** přečte `status`/`detail`/Notes, pokračuje.
4. **U deploy:** po zpracování ulož (Ctrl+S) a **File → Reload Current Project** (ne plný restart EA), aby se nový kód aktivoval.

Žádný kód se nevykonává bez lidského kliknutí. Zpracované requesty se nemažou (audit trail).

## Bootstrap / fallback

První nasazení kódu bridge (a oprava, kdyby se rozbil vlastním deployem): `Scripts/ITAN-Inject Addin Code.vbs`
v EA Scripting okně — načte `src/*.js` do `Method.Code` dle konvence jmen. Verifikace: `Scripts/ITAN-Dump Addin Code.vbs`.

## Rozšiřování bridge (nové módy)

Nová schopnost = nová `mode` větev v `ProcessRequests` volající pojmenovanou operaci. Roadmap v PROTOKOL.md:
query (hotovo) → XMI export → ValidatePackage/framecheck → dávkový export kódu → ITAN FIX operace → (výhled)
HITL brány, event telemetrie. **Zásada: pojmenované operace, ne obecný „spusť skript" (RCE).**
