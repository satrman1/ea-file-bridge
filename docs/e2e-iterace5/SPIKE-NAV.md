# SPIKE-NAV — sonda bezpečnosti navigačních COM volání v EA runtime (iterace 5, B-V3)

**Proč:** `Repository.ShowInProjectView(el)` volané z add-inu (konec clipboard dávky) 2026-08-20 shodilo CELÝ add-in nezachytitelnou COM chybou (§1a/4) — EA ho odpojila (obnova: Manage Add-Ins + plný restart). `FB_ShowInBrowser` je proto default vypnuto. Tahle sonda zjišťuje, KTERÉ volání a v JAKÉM kontextu padá — a jestli existuje bezpečná cesta k auto-zvýraznění bez kliku.

**Princip:** menu položka **Specialize → AI Bridge → Nav spike (test navigace)** — každý klik = JEDEN krok. Před krokem se do Output tabu „AI Bridge" zapíše `NavProbe krok N: … - START`; po přežití `OK`. **Chybí-li OK, padl právě ten krok** (a add-in je odpojený).

**Obnova po pádu:** Specialize → Manage Add-Ins → enable AICodeBridge → **plný restart EA**. Čítač kroků restart nepřežije — aby ses nemusel proklikávat znovu (a nespadl na tomtéž kroku), nastav v `FB_Config` položku `navProbeStart: <číslo dalšího kroku>` (+ deploy_src FB_Config + restart) a pokračuj.

## Kroky — VÝSLEDKY 2026-08-20 (živě, eaexample EA 17.1.5)

| # | Volání | Hypotéza | Výsledek (OK/PÁD) |
|---|---|---|---|
| 1 | `RefreshModelView(0)` — celý model | refresh je bezpečný | **OK** — ale sbalí celý strom browseru (UX vedlejší efekt, pro auto-použití nevhodné) |
| 2 | `RefreshModelView(pkg)` — package bridge | dtto na konkrétní pkg | **OK** |
| 3 | `ShowInProjectView(GetElementByID)` | menu (user-gesture) kontext možná past nespustí | **POTVRZENO JINOU CESTOU** — `ShowInProjectView(GetElementByID)` z output-click handleru (`EA_OnOutputItemDoubleClicked`) opakovaně funguje bez pádu = **hypotéza b1 POTVRZENA**: past §1a/4 je specifická pro volání během zpracování dávky, user-gesture kontext je bezpečný |
| 4 | `ShowInProjectView(GetElementByGuid)` | jiná cesta k témuž objektu | vědomě nedokončeno (viz Závěr) |
| 5 | `RunModelSearch("FB_Changes", "")` | okno hledání ≠ browser navigace — možná bezpečná auto-cesta | vědomě nedokončeno (viz Závěr) |

## Závěr (rozhodnutí Miloš 2026-08-20)

**Output proklik (dvojklik → handler → ShowInProjectView) = finální řešení zvýraznění — „nejlepší varianta, na zbytek nepálit čas".** Kroky 4–5 i fáze D (auto-highlight na konci dávky přes `FB_ShowInBrowser`) se NEDOKONČUJÍ; `FB_ShowInBrowser` zůstává trvale default vypnuto, pozorovatelnost kryje proklik z Output tabu + search FB_Changes. Menu položka „Nav spike" může z FB_Config zmizet (`navProbe: false`) po doladění zbytku E2E — debug výpis dvojkliku na ní visí taky.

## Fáze D (jen když kroky 3+4 přežily)

Původní pád byl na KONCI DÁVKY (jiný kontext než klik v menu). Ověř přesně ten:

1. `FB_Config` → `showInBrowser: true` (deploy_src + restart EA).
2. Pusť zapisovou dávku clipboard režimem (vzor `req-20260821-04` s novým id) → po zpracování se má poslední prvek sám označit v browseru.
3. **Tvrdý test:** 3× po sobě dávka s novým prvkem + navigací — add-in musí zůstat v Specialize (nespadnout).
4. PÁD → `showInBrowser` zpět false; pozorovatelnost zůstává na V1 (proklik) + V2 (FB_Changes).

## Interpretace

- Kroky 1–2 PÁD → i refresh je v EA runtime nebezpečný → z `FB_ShowInBrowser` vyhodit i RefreshModelView, V1/V2 stačí.
- Kroky 3–4 OK, fáze D PÁD → past je specifická pro kontext „uvnitř zpracování dávky" → auto-highlight možný jen ODLOŽENĚ (např. z output-click handleru) — samostatná úvaha, zatím nechat vypnuté.
- Krok 5 OK → kandidát na auto-UX po dávce: `RunModelSearch` s výsledky FB_Changes (okno se otevře samo, uživatel dvojkliká) — případná další iterace.
- Výsledky zapsat sem + do PROTOKOL-EAFB §6g + paměti (ea-file-bridge).
