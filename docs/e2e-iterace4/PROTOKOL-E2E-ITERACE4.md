# PROTOKOL E2E — iterace 4 (vrátný / AI import režim)

Zadání: `Zadani-EA-File-Bridge-Iterace-4-AI-Import-Rezim.md` v1.1, §6/§9 + kontrakt confirm okruhu (kanál „okno"). Prostředí: eaexample (.qea/SQLite), AICodeBridge el. 11037, EA 17.1.5.

> **Stav:** kód postaven a **offline ověřen (harness 49/49 PASS**, Node mock COM/EA — syntaxe všech 87 src, FB_ChatRender, FB_QcRun, FB_Process, FB_GatekeeperLaunch, PS invarianty vrátného). Reálný PS 5.1 parse + živý klikací E2E **provede Miloš u stroje** (Cowork vlákno nemá jak klikat na plochu, spouštět PowerShell ani dělat Copy v prohlížeči). Tento dokument je krok-za-krokem s **očekávanými** výsledky; čísla zelených dávek doplní Miloš.

## Jednorázová příprava (dělá Miloš)

1. **Deploy kódu do modelu.** Pumpa běží (dvojklik `pump.wsf`) → zkopíruj obsah `req-20260820-00-deploy.json` do `requests\` (nebo pošli přes Copilota). Očekávaně: `deploy_src` založí nové operace `FB_Gatekeeper`, `FB_GatekeeperLaunch`, `FB_Process`, `FB_ChatRender`, `FB_QcRun`, `FB_QcConfig` a přepíše `FB_Main`, `EA_GetMenuItems`, `EA_MenuClick`. Response `reloadCode:true`.
2. **Plný restart EA** (ne reload — §1a; kvůli menu + EA runtime FB_Process).
3. **Model Search „FB_Process"** (jednorázově, vzor T4-0a): *Find in Project → nový search*, **Group Type = Search**, **Add-in Name and method = `AICodeBridge.FB_Process`** (separátor **TEČKA**, ne lomítko — jinak se metoda tiše nezavolá). Uložit jako `FB_Process`.
4. **(volitelně) `gk-config.json`** vedle pumpy pro zrychlené testy reapu / debug okno:
   `{ "reapTimeoutMin": 1, "reattachSec": 5, "healthSec": 5, "reapGraceSec": 10, "debug": true }`
   `debug:true` nechá konzoli PS viditelnou (uvidíš případnou parse chybu kanonu).

## Scénáře (§6/§9)

Legenda: **⌨** = Miloš klik/akce, **⇒** = očekávaný pozorovatelný stav.

| # | Scénář (§9) | Akce ⌨ | Očekávaný důkaz ⇒ | Dávka |
|---|---|---|---|---|
| E1 | Zapnutí režimu = 1 akce, okno viditelné, baseline (AK1, W8) | Specialize → AI Bridge → **Zapnout AI import režim (vratny)** | dialog „vratny spusten"; **stavové okno** ČEKAM NA DAVKU; v Logu `session baseline` (W8); žádný skript na disku | — |
| E2 | Plný řetěz schránka → chat ACK (AK2, T4-4) | v Copilotu/editoru **Copy** obsahu `req-20260820-01-ping.json` | okno blikne ZPRACOVAVAM → **🟢 ODPOVED VE SCHRANCE**; Ctrl+V ukáže `EAFB OK 20260820-01: 1/1 ops`; čítač Prijato/OK +1 | 20260820-01 |
| E3 | LOW write = auto (bez potvrzení), QC v ACK (§3.4) | Copy `req-20260820-02-low.json` | ACK `EAFB OK …02: 1/1 ops | QC ciste (1 kontrol)`; element `FBT IT4 LOW` vznikl; **žádný confirm dialog** | 20260820-02 |
| E4 | ELEVATED přípravný cíl (LOW create) | Copy `req-20260820-03-elevated-delete.json` | LOW auto, `FBT IT4 DEL` vznikl | 20260820-03 |
| E5 | **Potvrzení ELEVATED dávky kanálem „okno"** (audit confirmChannel=okno) | Copy `req-20260820-04-elevated-A.json` → v okně vyber řádek `CEKA: req-20260820-04…` → **Provest** | okno CEKA NA POTVRZENI (1); souhrn ukazuje `delete_from_model`, target `FBT IT4 DEL`, důvod; po Provest ACK `EAFB OK …04`; `FBT IT4 DEL` smazán; **`pending\` prázdná** | 20260820-04 |
| E6 | **Zamítnutí** → E_RISK_REJECTED | Copy `req-20260820-05-elevated-B.json` → vyber `CEKA` → **Zamitnout** | ACK `EAFB ZAMITNUTO …05`; nic neprovedeno; soubor v `rejected\`; audit `confirmedByUser:false` | 20260820-05 |
| E7 | **Fronta 2 čekajících ELEVATED** (I6) | Copy -04 a -05 **rychle za sebou** (nepotvrzuj hned) | okno seznam ukáže **dvě** `CEKA:` řádky; každá má vlastní souhrn; potvrď/zamítni jednu po druhé | -04,-05 |
| E8 | **Restart vrátného s dávkou v `pending\`** (bezstavovost) | během čekající ELEVATED dávky **Ukoncit rezim** → znovu **Zapnout** | po startu okno znovu ukáže `CEKA:` řádek (res+pending přežily); potvrzení funguje se stejným hashem | — |
| E9 | **Mutex dvojspuštění** (W3, AK5) | při běžícím okně klikni **Zapnout AI import režim** ještě jednou | MessageBox „AI import režim … už běží", druhá instance se **nespustí** (exit 2); první okno běží dál | — |
| E10 | **Dedup schránka × Downloads** (W5, AK6) | ulož tutéž dávku jako `%USERPROFILE%\Downloads\ea-req-20260820-01.json` a zároveň Copy | provede se **jen jednou**; Log `preskoceno … dedup W5` | — |
| E11 | Dvě rychlé Copy (W4) | Copy -01 a hned -02 | obě se provedou v pořadí (souborová fronta), žádná se tiše neztratí | -01,-02 |
| E12 | Ukončení = souhrn + session log (AK5) | **Ukoncit rezim** | schránka nese `# … zaverecny souhrn`; vedle pumpy `session-log-*.md`; okno zmizí, proces skončí | — |
| E13 | Ztráta EA → re-attach → reap (W3) | (gk-config zrychlený) zavři EA | okno 🟠 `EA NEDOSTUPNA — pokus N`; spustíš EA zpět → zpět ČEKAM; nespustíš → 🔴 UKONCUJI → exit 3, session-log s důvodem REAP | — |
| E14 | **Izolovaný mutex test** (W3, bez EA) | `krok0\mutex-probe.ps1` dle hlavičky | přesné výstupy MUTEX ZISKAN/OBSAZEN/UVOLNEN/PREVZAT (W3 §5.1) | — |

## Pozorovatelné ověření (zadání §6 bod 6)

- **Čísla zelených dávek:** _(doplní Miloš: 20260820-01…05 + případné opravné)_
- **Audit `ai.risk.confirm` s `channel=okno`** — doložit čtecí dávkou po E5:
  ```json
  { "protocol":"eafb/0.2","id":"20260820-90","repo":"EAExample.qea",
    "ops":[{ "op":"query","sql":"SELECT p.Value AS confirmTag FROM t_objectproperties p INNER JOIN t_object o ON p.Object_ID=o.Object_ID WHERE o.Package_ID=(SELECT Package_ID FROM t_package WHERE Name='#AI-LOG') AND p.Property='ai.risk.confirm' ORDER BY o.Object_ID DESC" }]}
  ```
  ⇒ nejnovější řádek obsahuje `channel=okno` (u E5).
- **grep `ActiveXObject`** v nových/změněných src = **0** (mimo komentáře/typeof) — ověřeno v tomto vlákně (viz commit / MATICE-PARITY).
- **`pending\` po testech prázdná** — po potvrzení/zamítnutí všech ELEVATED dávek.
- **Mutex test** — E9 (druhá instance se nespustí) + E14 (izolovaný výpis).

## Poznámky z běhu

_(sem Miloš zapisuje odchylky — parse chyby kanonu, latence Copy→semafor, doba zamrznutí EA na dávku, doba QC nad reálným modelem)_
