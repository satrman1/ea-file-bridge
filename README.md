# EA File Bridge

Plně automatická náhrada MCP pro Enterprise Architect bez cizího instalovaného softwaru: AI driver (GitHub Copilot / Claude) komunikuje s EA přes souborový protokol **eafb/0.1** (`docs/PROTOKOL-EAFB.md`).

```
AI driver ──► requests\req-*.json ──► pumpa (pump.wsf, WSH) ──► COM ──► EA (executor FB_* v modelu)
AI driver ◄── responses\res-*.json ◄──────────────────────────────────┘
```

**Tento repozitář = produkt pro správce bridge** (kód, pumpa, nástroje, testy, docs). Vyvíjí se doma (eaexample), klon se synchronizuje do banky. **Analytik pracuje v jiném repu** — workspace metodiky `ai-transfer` (`docs/WORKSPACE-METODIKY.md`), kam se kit i pumpa dostávají nástrojem `tools/refresh-workspace.py`. Složky `requests\` a `responses\` vznikají za běhu a do gitu nepatří (.gitignore) — obsahují data z repozitáře EA.

## Obsah

| Cesta | Co |
|---|---|
| `pump.wsf` | pumpa — watcher + COM attach + code loader z modelu; start dvojklikem, konec zavřením konzole |
| `src/` | kanon kódu executoru (operace elementu AICodeBridge; deploy = inject + restart pumpy; NOVÁ operace = bootstrap) |
| `scripts/` | ITAN-Inject (nalití `src/` do existujících operací) + ITAN-Bootstrap (založení elementu/operací, idempotentní) — EA Scripting, **JScript**; cestu ke `src/` si najdou samy, jinak se zeptají dialogem |
| `krok0/` | smoke testy prostředí (WSH, COM attach, XMLHTTP, free Copilot) + návod |
| `docs/` | protokol eafb/0.1, návod domácí generálky, šablony copilot-instructions (domácí/bankovní) |
| `.github/` | kit pro Copilot (agent `sa-analytik`, Agent Skills, instrukce) — **výstup buildu** `tools/build-vscode.py` z kanonu skillů (`docs/BUILD-VSCODE.md`), needitovat ručně |
| `tools/refresh-workspace.py` + `.cmd` | naplní **workspace repo metodiky** (`C:\GIT\ai-transfer`) — build `.github/`, vendorovaná kopie `pump.wsf` + `PUMP-VERSION`, skeleton (`docs/WORKSPACE-METODIKY.md`) |

## Rychlý start (doma)

1. EA s `EAExample.qea` + jednorázově: EA Scripting → spustit `scripts/ITAN-Inject Addin Code.js` (JScript)
2. Dvojklik `pump.wsf` → konzole hlásí „Pripojeno na EA" + „Session baseline: 1 vytvoren"
3. VS Code → Open Folder → tento repozitář → Copilot agent mode (postup: `docs/NAVOD-GENERALKA-DOMA.md`)

## Klíčová pravidla

- Zápis do modelu výhradně Automation API; SQL jen čtení (SELECT/WITH).
- Whitelist vázaný na **instanci repozitáře** (`FB_Whitelist`: repo + GUID) + povinná deklarace `repo` v dávce — ochrana proti klonům repozitáře (testovací klon × produkce).
- SQL dialekt: doma SQLite (.qea), v bance MS SQL 2022 — hlídá autor dotazu.
- EA Scripting skripty výhradně JScript. Po každé změně kódu v modelu sync zpět do `src/`.

Kontext a dokumenty POC (zadání, protokol vyhodnocení P1–P6, prostředí): `IT-ANALYSIS/` (mimo tento repozitář).
