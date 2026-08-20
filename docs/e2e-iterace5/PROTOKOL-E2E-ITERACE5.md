# E2E protokol — iterace 5 (autorizace, zvýraznění v browseru, kontext výběru)

Klikací návod pro živé ověření u stroje (eaexample, EA 17.1.5). Dávky `req-20260821-*` v této složce. Offline harness prošel **131/131** — tady se ověřuje jen to, co mock nechytí (nativní navigace, EA runtime, dual-runtime pasti §1a/4).

**Předpoklad:** nasazené dávky iterace 4 (`e2e-iterace4/req-20260820-09…12`, nebo combined -11 + -12) + restart EA. Pokud ne, nasaď je před krokem K1 (stačí v téže seanci — restart EA je pak jen jeden).

Dávky pouštěj **clipboard režimem** (Copy obsahu req souboru → Specialize → AI Bridge → Zpracovat dávku ze schránky), nebo pumpou (soubor do `requests\`). U deploy dávek čekej potvrzovací dialog (deploy_src = ELEVATED) → **Ano**.

## K1 — deploy + restart

1. Pusť `req-20260821-01-deploy.json` → dialog → Ano → `EAFB OK 20260821-01: 1/1 ops`.
2. **PLNÝ restart EA** (menu + EA runtime kód; Reload nestačí — §1a/3).

## K2 — prescan po restartu

3. Pusť `req-20260821-00-prescan.json` → v odpovědi `cnt` = **93** operací na AICodeBridge (87 + 6 nových: FB_AccessGroups, FB_UserAccess, FB_Changes, FB_NavProbe, FB_OpSelectedContext, FB_InBranch). Nižší číslo = deploy neprošel celý.
4. V menu Specialize → AI Bridge musí být nová položka **„Nav spike (test navigace)"** (jen doma — `navProbe: true`).

## K3 — Output proklik (B-V1)

5. Pusť `req-20260821-04-uxwrite.json` (LOW zápis, bez dialogu).
6. Otevři Output tab **„AI Bridge"** → řádek `[vytvoreno] "FBT IT5 UX" @ …` → **DVOJKLIK na řádek** → Project browser označí prvek FBT IT5 UX. ✅/❌ zapsat.

## K4 — search FB_Changes (B-V2)

7. **Jednorázově** založ hledání: Find in Project (Ctrl+F) → New Search → jméno `FB_Changes` → Group Type **Search** → „Add-in Name and method" = `AICodeBridge.FB_Changes` (**TEČKA**, ne lomítko — lekce T4-0a).
8. Spusť hledání `FB_Changes` s **prázdným** textem → výsledky = prvky poslední dávky (FBT IT5 UX; pokud EA mezitím restartovala, zadej do pole id `20260821-04`). **Dvojklik na výsledek** → skok v browseru. ✅/❌.

## K5 — get_selected_context (C)

9. V Project browseru **označ** FBT IT5 UX → pusť `req-20260821-02-selctx.json` → v odpovědi: `context.type: "Element"`, `name: "FBT IT5 UX"`, `path` = tečková cesta, `branchGuid` = GUID #FB-TEST, `inWhitelist: true`. ✅/❌.
10. Označ libovolný prvek **mimo** #FB-TEST (např. AICodeBridge) → táž dávka s novým id → `inWhitelist: false` + `whitelistNote`. ✅/❌.
11. Nic neoznačuj (klikni do prázdna / zavři diagramy) → táž dávka → `selected: false` + message. (Nepovinné.)

## K6 — scope na find (C)

12. Pusť `req-20260821-03-scope.json` → op 1 (bez scope): `count: 1` (AICodeBridge); op 2 (scope #FB-TEST): `count: 0` + blok `scope` s cestou. ✅/❌.

## K7 — spike navigace (B-V3)

13. Postupuj podle **`SPIKE-NAV.md`** (5 kroků po jednom kliku; výsledky zapiš tam). Až po závěru spiku případně zapínat `showInBrowser`.

## K8 — feature A (doma jen částečně)

Doma je EA security **vypnutá** → gate se neuplatní (vše povoleno — rozhodnutí 2026-08-20); logiku kryje harness (9 testů). **V bance** (až s kurýrem):

14. Čtecí dávkou ověř jména tabulek: `query` `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE 't_sec%'` (MS SQL). Očekávané: `t_secuser`, `t_secgroup`, `t_secuser_group`. Pokud se vazební tabulka jmenuje jinak → upravit SQL ve `FB_UserAccess`.
15. Do `FB_AccessGroups` doplnit bankovní repo + skutečné jméno write skupiny (jen v korporátním repu, ne tady — pravidlo očisty).
16. Test s omezeným uživatelem (bez write skupiny): zapisová dávka → `E_ADDIN_ACCESS`, čtecí projde; člen skupiny: zápis projde.

## Úklid

`FBT IT5 UX` smazat po testech (delete dávka → ELEVATED → potvrdit), nebo nechat do hromadného úklidu FBT-*.

## Výsledky (vyplnit)

| Krok | Výsledek | Poznámka |
|---|---|---|
| K2 cnt=93 | | |
| K3 dvojklik Output | | |
| K4 FB_Changes | | |
| K5 kontext (3 případy) | | |
| K6 scope | | |
| K7 spike | | viz SPIKE-NAV.md |
