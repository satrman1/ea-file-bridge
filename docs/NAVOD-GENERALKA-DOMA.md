# Generálka fáze 2 doma — Copilot jako driver (vrstva 3)

2026-08-13 · dle `Prostredi-POC-EA-File-Bridge.md` kap. 3–4 · Ověřuje **P3** (Copilot agent mode zvládne protokol) a **P6** (Copilot vision na PNG) nanečisto, na eaexample, než se pojede naostro v bance (`<TEST-DB>`).

**Pravidlo hospodaření:** domácí Copilot Free má ~50 premium requests/měsíc — šetřit VÝHRADNĚ na tuhle generálku. Pro intenzivní kolo aktivovat 30denní trial Copilot Pro. Nic jiného přes Copilota nejezdit (vrstvy 1–2 = Claude).

---

## Příprava (jednorázově, ~5 minut)

1. **Instrukční soubor:** ve složce `C:\GIT\ea-file-bridge` vytvoř podsložku `.github` a do ní zkopíruj soubor `docs\github-copilot-instructions.md` pod názvem **`copilot-instructions.md`** (tedy: `C:\GIT\ea-file-bridge\.github\copilot-instructions.md`).
2. **VS Code:** Soubor → Open Folder → vyber složku `C:\GIT\ea-file-bridge`. (Workspace = repo s pumpou; Copilot tak vidí `requests/` i `responses/`.)
3. **Copilot model:** v Copilot chatu dole přepni model na **Claude** — ideálně stejnou rodinu jako bankovní default (Opus 4.8; na Free/Pro vyber nejbližší dostupný Claude). Poznamenej si, který to přesně byl.
4. **Agent mode:** v Copilot chatu přepni režim na **Agent**.
5. **EA + pumpa:** otevři EA s `EAExample.qea` a spusť pumpu (dvojklik `pump.wsf`). V konzoli zkontroluj „Pripojeno na EA" + „Session baseline: 1 vytvoren".

## Úloha A — test P3 (driver protokolu)

Zadej Copilotu v agent mode přesně tohle (jedna zpráva):

> Zjisti GUID elementu `Zakaznik` a založ do package #FB-TEST nový element `Objednavka` (Class, stereotyp entity) s poznámkou „Objednávka založená Copilotem v rámci generálky fáze 2". Postupuj podle instrukcí workspace (EA File Bridge).

**Co se má stát bez tvé asistence:** Copilot začne pingem (kontrola repository), pak query na Zakaznik, pak create_element; každý krok = soubor v `requests/`, odpověď si sám přečte z `responses/` a nakonec ti shrne GUID + elementId Objednavky.

**Zaznamenej (kritéria P3):**

| Kontrola | Výsledek |
|---|---|
| Složil validní request bez ruční asistence? | |
| Počkal si na response a správně ji přečetl? | |
| Začal pingem a zkontroloval repository? | |
| Při chybě se opravil sám (nový soubor, nové id)? | |
| Kolik premium requests úloha spotřebovala? | |

Pokud se zasekne (nečte response, vyrábí nevalidní JSON, ignoruje instrukce): poznamenej **co přesně** dělal — to je vstup pro posílení copilot-instructions před bankou. P3 ⚠/❌ neznamená konec, jen úpravu promptů.

## Úloha B — test P6 (vision na PNG, bez EA kódu)

1. V EA ručně vyexportuj libovolný diagram jako PNG (pravý klik na diagram → Save Image → PNG) a ulož ho do workspace (třeba `C:\GIT\ea-file-bridge\diagram-test.png`; PNG jsou v .gitignore).
2. Zadej Copilotu v agent mode:

> Podívej se na soubor diagram-test.png a popiš, co na něm je: jaké elementy, jaké vazby mezi nimi, a jestli se něco překrývá nebo je špatně čitelné.

**Zaznamenej:** popsal elementy a vazby správně? (P6 ✅ = vizuální QA diagramů může v iteraci 2 dělat Copilot; ❌ = dělá ji Miloš v EA — GO to nemění.)

## Po generálce

Výsledky obou úloh nadiktuj Claudovi — propíšou se do `Protokol-Vyhodnoceni-POC-EA-File-Bridge.md` (P3, P6) a podle nich se případně posílí instrukce. Teprve pak má smysl stavět bankovní balíček fáze 2 (`<TEST-DB>`).

⚠ Známé rozdíly domácí generálky proti bance (Prostředí kap. 5): jiný plán Copilota (jiná nabídka modelů/limity), eaexample místo bankovního repozitáře (jiné GUIDy — bankovní instrukce dostanou vlastní hodnoty), bez AppLockeru, bez bankovní sítě. Generálka je zrychlovač, ne náhrada fáze 2.
