# UC-Pravidla-Scenare

> **Kontrolní kód UC pravidel: `UC-PRAVIDLA-R4T`** — uveď ho v odpovědi, ve které navrhuješ identifikaci nebo specifikaci UC. Kopie kompilátu z kanonu (M365/02-use-case-model, rev. b 2026-08-21) pro VS Code kit; změny dělej v kanonu use-case-analyst a rekompiluj — tento soubor needituj ručně.

## Zlatá pravidla

1. Nikdy „nešpiníme" kroky scénáře specifickými pravidly — scénář musí být na první přečtení čitelný. Podmínky, validace a rozhodovací logika jdou do samostatných pravidel chování (BRU) a z kroku se odkazují jen přes ID.
2. Nikdy nepopisujeme ve scénáři GUI — na to jsou jiné artefakty (logická obrazovka); nechceme kvůli každé změně GUI přeschvalovat Use Case.
3. Když cítíš, že popisuješ detail, který při implementaci může vypadat úplně jinak, otázka „PROČ to Aktér/Systém dělá?" tě vrátí na správnou kolej.
4. Textace chybových hlášek do scénáře nepatří — maximálně „systém informuje aktéra o …".

## Struktura specifikace UC

* **Scénáře**: 1× Basic Path (BE) + 0..n Alternate (AF) + 0..n Exception (EF). Kroky mají typ aktéra: **Human (aktér)** nebo **System**.
* **Větvení**: každý AF/EF je ukotven na konkrétní krok BE (kde se odbočuje) a má návrat — buď **návrat do konkrétního kroku BE**, nebo větev končí. Návrat v návrhu vždy uveď (analytická informace); do modelu ho zatím doplňuje člověk ručně.
* **Constrainty UC** (mimo scénář): Pre-condition, Post-condition, Assumption (invariant).
* **Pravidla chování (BRU)** (mimo scénář): samostatné položky s vlastním ID; ve scénáři jen odkaz přes ID. Lokální `BRUXXXXX-Y` žijí jako **internal requirements uvnitř UC** (Responsibilities → Requirements), přepoužitelná `BRU-####` jako samostatné elementy v knihovně pravidel.

## Jmenné konvence (XXXXX = číslo UC, Y = pořadové číslo)

| ID | Vzor | Význam |
|---|---|---|
| N-SCN02 | `BEXXXXX Jméno` | základní scénář |
| N-SCN03 | `AFXXXXX-Y Jméno` | alternativní scénář |
| N-SCN04 | `EFXXXXX-Y Jméno` | chybový scénář |
| N-SCN05 | `BRUXXXXX-Y Jméno` | pravidlo chování lokální pro UC (bez pomlčky za číslem UC, např. `BRU91001-1`) |
| N-SCN06 | `PREXXXXX-Y` | precondition |
| N-SCN07 | `PSTXXXXX-Y` | postcondition |
| N-SCN08 | `ASUXXXXX-Y` | assumption (invariant) |

Přepoužitelná pravidla napříč UC mají vlastní řadu `BRU-####` (knihovna RULES REUSABLE).

## Volba typu scénáře

* **Basic Path** — hlavní scénář.
* **Alternate** — veškeré další scénáře; z Alternate lze ex post udělat Basic u „falešných" alternate (např. CRUD), když je potřeba vyčlenit Exception/Alternate větve.
* **Exception** — chybové (error flow) scénáře.

## Chybové stavy (metodika v2, kap. 12.7)

Chybový stav modeluj pouze tam, kde mění chování systému:

1. **Business výjimka** (zamítnutí, chybějící oprávnění, duplicita) → Exception Flow `EFXXXXX-Y`; podmínku vzniku vyčleň jako BRU a z kroku na ni jen odkazuj přes ID.
2. **Funkční výsledek služby** (nenalezeno, prázdná množina) → do scénáře JEN pokud má business význam; jinak patří do specifikace rozhraní a realizace služby.
3. **Technická chyba** (timeout, HTTP kódy, výpadek DB/sítě) → do scénáře NIKDY. Výjimka: má-li business předepsanou reakci („scoring nedostupný > 30 s → manuální schválení"), je to business pravidlo — BRU + odpovídající Alternate/Exception flow.

## Doporučené fráze kroků

Běžné užití: „Systém zobrazí / prezentuje", „Aktér zadá", „Aktér požaduje", „Aktér zruší", „Aktér vybere 1 nebo více … ze seznamu / označí", „Aktér odešle", „Systém ověří", „Systém nastaví / smaže / zruší", „Systém vytvoří / založí", „Systém aktualizuje", „Systém vrátí", „Systém indikuje, že…", „Systém upozorní".

V případě nutnosti: „Kdykoliv mezi kroky X a Y, Aktér …", „Aktér může kdykoliv…", „Jakmile Aktér …, Systém …", „Systém načte", „Aktér opakuje kroky X–Y dokud neindikuje, že skončil", „Kroky X–Y mohou nastat v libovolném pořadí".

## Časté chyby

**Podmínka (IF) v kroku** (Cockburn, Writing Effective Use Cases):

* Špatně: „2. Systém zkontroluje, zda je heslo správné. 3. Pokud ano, systém zobrazí dostupné akce."
* Dobře: „2. Systém ověří, že heslo je správné. 3. Systém zobrazí dostupné akce." — scénář popisuje úspěch; „co když ne?" řeší Exception větev ukotvená na krok 2.

**Scénář popisuje GUI**: kroky vyjmenovávají obrazovky, pole, tlačítka, wireframy. Správně scénář nese **záměr aktéra a souhrn předávaných informací**: „Aktér poskytne jméno, adresu a telefon" — ne výčet polí a tlačítek dle WF-101.

**UC scénář nahrazuje jiný artefakt**: implementační detail, výčty rozhraní, datové struktury do scénáře nepatří — patří do logické obrazovky, specifikace rozhraní, LDM.

## Výstupní formát návrhu specifikace (ke schválení člověkem)

Návrh odevzdej VŽDY v této textové struktuře (mapuje se 1:1 na zápis do EA):

```
UC-XXXXX Název UC

PREXXXXX-1  <text>            (Pre-condition)
PSTXXXXX-1  <text>            (Post-condition)
ASUXXXXX-1  <text>            (Assumption)

BEXXXXX Jméno základního scénáře   [Basic Path]
  1. [A] <krok aktéra>
  2. [S] <krok systému, příp. odkaz na BRUXXXXX-1>
  ...

AFXXXXX-1 Jméno   [Alternate; odbočka z kroku N BE; návrat do kroku M / konec]
  1. [A/S] ...

EFXXXXX-1 Jméno   [Exception; odbočka z kroku N BE; návrat do kroku M / konec]
  1. [A/S] ...

BRUXXXXX-1 Název pravidla
  <plný text pravidla — podmínky, validace, rozhodovací logika>
```

`[A]` = krok aktéra (Human), `[S]` = krok systému. Kroky čísluj, odkazy na pravidla piš přímo v textu kroku jen jako ID. Čistota: tok bez pravidel, datových struktur a UI popisu.
