# Živý E2E — op-level warnings v chat ACK (nález POC N-7)

> ⛔ **Revize po iteraci 6 (2026-08-21).** Dávky 4–6 níže stojí na vyvráceném nálezu N-1 („`join` = jméno scénáře"). **`join` je ČÍSLO KROKU hostitelského scénáře**, `"End"`/vynechané = větev končí (viz `PROTOKOL-EAFB.md` §6b/§6i). Scénář testu tím **neztrácí platnost** — jen se posunul obsah: jako „špatná" hodnota, která vyrobí warning, poslouž **jméno scénáře** (dávka 4), jako oprava **číslo kroku** (dávka 5), a readback (dávka 6) má po opravě najít `join="{GUID kroku}"`, po dávce 4 `join="End"`. Dávky v souborech `req-20260821-32/-33/-34` je před spuštěním potřeba v tomto smyslu prohodit.

Stav: **připraveno, živý běh zbývá** (rozhodnutí Miloš 2026-08-21: commit napřed, živý test v samostatném vlákně).
Offline pokryto: `test/harness.js` **150/150 PASS** (6 nových testů `ChatRender: …`).
Kontrakt tvaru ACK: `docs/PROTOKOL-EAFB.md` **§3a**.

## Proč nestačí pumpa sama

Chat verzi response rendruje `FB_ChatRender` a volají ji **jen** interaktivní kanály — `FB_ClipboardImport`
(menu „Zpracuj davku ze schranky") a `FB_Process` (vrátný). Pumpa a GUI fallback píší jen `res-*.json`.
Živý test ACK proto jede **clipboard režimem**, a protože `FB_ChatRender` běží v **EA runtime**,
je po deployi nutný **plný restart EA** (§1a).

## Postup

| # | dávka | kanál | očekávaný výsledek |
|---|---|---|---|
| 1 | `req-20260821-30-deploy-chatrender.json` | **pumpa** (deploy_src je JScript-only) | `deploy_src` nasadí `FB_ChatRender`; ELEVATED → potvrdit v popupu pumpy |
| 2 | — | — | **restart EA** (aktivace kódu v EA runtime) |
| 3 | `req-20260821-31-create-uc.json` | clipboard režim | ACK **beze změny**: `EAFB OK 20260821-31: 1/1 ops | QC …` — žádná zmínka o warninzích (regrese) |
| 4 | `req-20260821-32-scenarios-badjoin.json` | clipboard režim | ELEVATED dialog → potvrdit → ACK **s warningem**: `… | 1 WARNING: scenarios[1]: join '2' neni v davce - Join nezapsan` + výpis `op[0] create_or_update_scenarios: …` |
| 5 | `req-20260821-33-scenarios-fix.json` | clipboard režim | opravná dávka (`join: "BE-N7"` = **jméno** scénáře) → ELEVATED → potvrdit → **čistý ACK bez warningu** |
| 6 | `req-20260821-34-readback.json` | pumpa nebo clipboard | zpětné čtení: `XMLContent` scénáře `AF-N7-1` nese `<extension … join="{GUID BE-N7}" …>` — po dávce 4 je `join=""` |
| 7 | `req-20260821-35-cleanup.json` | clipboard režim | úklid: smaže `FBT N7 UC` (ELEVATED → potvrdit) |

Pozn.: `element` se adresuje **jménem** (`FBT N7 UC`) — `FB_ResolveEl` umí GUID | id | jméno, takže
dávky 4–7 nepotřebují GUID z předchozí response.

## Kritéria (co musí platit, aby byl test zelený)

1. ACK dávky 3 je **znak po znaku** ve tvaru jako před změnou (žádný prázdný segment, žádné „0 warnings").
2. ACK dávky 4 nese **počet i text** warningu už v **prvním řádku** (přežije ořez rozpočtem).
3. ACK dávky 5 je čistý — warning zmizel, protože zmizela příčina (ne proto, že se přestal vykazovat).
4. Readback (6) potvrdí, že warning mluvil pravdu: po dávce 4 je `join` prázdný, po dávce 5 nese GUID.
5. Po dávce 7 nezůstane v `#FB-TEST` žádný artefakt `FBT N7 *`.

⚠ Po jakémkoli odkliknutí modálu v EA hrozí falešné `rowCount: 0` (§5a/5) — kontrolní čtení vždy
v **čerstvé** dávce.
