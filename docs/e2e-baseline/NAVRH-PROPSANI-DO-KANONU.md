# Návrh propsání Baseline politiky do kánonu (metodika + Copilot instrukce)

2026-09-20 · vlákno Z260907-6 · **NÁVRH — neaplikováno.**

## Proč to není rovnou zapsané

Dávka `zaprah-vlaken-2026-09-07.md` (Z260907-6) chtěla upravit `docs/copilot-instructions-eafb.md`, `docs/github-copilot-instructions.md` a `IT-ANALYSIS/Skilly/_shared/emr-zapis-pravidla.md`. Stav se mezitím změnil:

1. Oba soubory v `docs/` jsou od 7. 9. **HISTORIE** (hlavička ⛔) — kit se staví z kánonu `IT-ANALYSIS/Skilly/_vscode/copilot-instructions.md` a `Skilly/_shared/*` přes `tools/build-vscode.py`. Úprava historie by se nikam nepropsala.
2. **Kánon se nesmí změnit dřív, než je politika nasazená tam, kde se kit používá.** §12c dnes agentovi říká „před prvním zápisem dávky udělej `create_baseline`". Kdyby kánon začal tvrdit „zálohu pořizuje executor automaticky" a build se dostal do banky dřív než kód v0.15 (v bance běží v0.14 **bez** politiky), agent by přestal dělat explicitní zálohy a executor by je nedělal taky — zápisy bez pre-image. Pořadí proto musí být: kód nasazen a živě ověřen (Z260907-7) → kánon → build kitu.

Texty níže jsou připravené k vložení. Aplikovat **po** Z260907-7, doma hned, do bankovního kánonu až s nasazením v0.15.

## 1. `Skilly/_vscode/copilot-instructions.md` — pravidlo 6 (Risk Gate), doplnit na konec

> **Záloha před zápisem je věc bridge, ne tvoje.** Od verze bridge s Baseline politikou (poznáš podle sekce `baseline` v `res-*.json` / řádku o záloze v ACK) pořizuje executor zálohu balíčku sám těsně před zápisem; explicitní `create_baseline` posílej jen tehdy, když ji uživatel výslovně chce (jméno nesmí začínat `FB-AUTO` → `E_ARGS`). **`confirm_required` s důvodem „bez pre-image" NENÍ chyba a NEŘEŠÍ se rozdělením dávky na menší** (stejný zákaz jako u prahů Risk Gate): řekni uživateli, že má v EA udělat ruční baseline nad balíčkem, který dialog jmenuje (Ctrl+Alt+B → New Baseline), a pak dávku potvrdit — nebo navrhni práci v menším balíčku. **`E_NO_BASELINE`** = zálohu nešlo pořídit, nic se nezapsalo; dávku neposílej znovu beze změny a nedrob ji — řešení je na člověku (ruční baseline / menší balíček / správce). Dokud `res` sekci `baseline` nenese (starší bridge), platí původní postup: `create_baseline` před prvním zápisem do existujícího balíčku.

Do výčtu kódů (pravidlo „Stav `confirm_required`… Kódy:") doplnit: `E_NO_BASELINE` (pre-image nelze pořídit — nic se neprovedlo, řeší člověk).

## 2. `Skilly/_shared/emr-zapis-pravidla.md`

**§12c Mikro-baselines — nahradit první větu:**

> *Žádný zápis, který mění nebo maže obsah existující package, bez čerstvé baseline nejmenšího dotčeného package.* U bridge s Baseline politikou (`PROTOKOL-EAFB.md` §6j; sekce `baseline` v response) ji **pořizuje executor automaticky** — těsně před první zápisovou operací, u dávky čekající na potvrzení až po něm — pod jménem `FB-AUTO <login> <session> <čas>`, jednu na (package, session), u potvrzovaných dávek nejvýš 15 min starou. **Dávka, která jen vytváří, baseline nepotřebuje** (undo = smazání dle razítek). Explicitní `create_baseline(X, "AI-pre-<session>-<batch>")` zůstává pro případ, kdy autor chce vlastní záchytný bod před konkrétní dávkou, a jako **povinný postup u bridge bez politiky** (response bez sekce `baseline`). Nikdy baseline nad velkými složkami — max ~5 dotčených packages per dávka (executor nad 5 zálohu nedělá a dávku pustí jen naváděnou cestou). Restore manifest (package GUID → jméno baseline) je v sekci `baseline` response, v tagu `ai.baseline` auditního Artifactu v `#AI-LOG` a v journal manifestu.

**§12a — k řádku „Update cizího elementu…" doplnit poznámku pod tabulku:**

> **Podmíněná revize (Baseline politika, dispozice 7 red teamu 2026-08-21):** krok „snapshot + mikro-baseline" plní od bridge s politikou executor — mikro-baseline automaticky, snapshot = minimální journal (§12d) — **jen tam, kde journal cíl skutečně kryje** (update polí elementu / package / atributu / operace, dávka pod prahem). Kde nekryje (diagramy, konektory, scénáře, dávky nad prahem), platí §12a doslova: bez pre-image se nezapisuje (naváděná cesta s ruční baseline). **Destruktivní operace** (delete, rebuild scénářů / constraintů / requirements / zpráv, přepis parametrů, import dokumentu) drží §12a **beze změny vždy** — bez baseline `E_NO_BASELINE`. Dry-run diff a schválení per GUID se nemění.

**§12d — doplnit odstavec:**

> **Minimální journal executoru (první částečné naplnění tohoto paragrafu):** bridge s Baseline politikou zapisuje před zápisem restore manifest `<baseDir>\journal\<reqId>.json` se starými hodnotami **jen těch polí, která dávka přepíše**, u cílů adresovaných guid/ID (element + měněné tagy, package, existující atribut, existující operace vč. starých parametrů). **Nekryje:** diagramy, konektory, zprávy, scénáře, constraints, requirements, dokumenty, přesuny, klony, mazání, cíle přes `$N` / match / dedupKey, dávky nad prahem — vypisuje je v `uncovered`. Manifest leží v per-uživatelské složce (není sdílený) a **neobnovuje sám**. Session journal podle tohoto paragrafu (čtení celého elementu před schváleným updatem cizího obsahu, Artifact v `#AI-LOG`) proto **zůstává povinný** všude, kde `uncovered` není prázdné.

**§12f — T3 přepsat:**

> **T3** celý package — restore z baseline dle restore manifestu: `AI-pre-*` (explicitní, per dávka) **nebo `FB-AUTO <login> <session> <čas>`** (automatická, executor; jedna na package a session → vrací stav *na začátku session*, tedy i přes legitimní práci předchozích dávek téže session — vědomý kompromis, per-dávkový návrat je T1/T2). Kterou baseline použít, říká tag `ai.baseline` na auditním Artifactu dávky v `#AI-LOG`. Automatické baselines podléhají úklidu (starší než 14 dní a zároveň mimo 3 nejnovější per balíček a uživatel) — `AI-pre-*` a ruční ne.

Po úpravě: verze souboru + řádek do `emr-zapis-changelog.md`, pak `tools/build-vscode.py` (doma), do banky kurýrem spolu s kódem.
