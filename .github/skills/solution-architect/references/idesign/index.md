# Knihovna IDesign — index

Zdroj: čtyřdílná publikace `IT-ANALYSIS/IDesign/idesign-1..4` (destilace korpusu IDesign Inc.
2008–2015: Architect's Master Class 2008, Method Details ~2012, Detailed Design 2012,
SOA Anti-Patterns 2011, Process 2012, Architecture Clinic 2015, Virtual Method 2015).
Publikace je kanonem znalostní vrstvy; tato knihovna je její operační destilát — pravidla
a postupy bez výkladu. Když potřebuješ zdůvodnění, příklady (SportHub, TradeMe) nebo citace
v kontextu, jdi do publikace.

## Jak knihovnu používat

- Reference jsou **pravidlové** — formulované jako instrukce a checklisty, ne jako výklad.
- Klíčové anglické formulace Löwyho jsou ponechány v originále (jsou přesné a citovatelné).
- Metriky čti **asymetricky**: „Complying with metric does not mean good design.
  Violating them does." Soulad nedokazuje kvalitu; porušení dokazuje problém.
- Smell = pokyn podívat se znovu, ne rozsudek. U každého pípnutí hledej, zda ho
  ospravedlňuje skutečná volatilita („volatility trumps all").

## Katalog

| Soubor | Obsah (zkráceně) | Zdroj (díl) |
|---|---|---|
| [dekompozice-volatilita](dekompozice-volatilita.md) | princip, dvě osy, rozhodovací strom kandidáta, variabilita vs. volatilita, povaha businessu, gold plating, swim lanes, U-křivka, features = integrace | 1 |
| [taxonomie-komponent](taxonomie-komponent.md) | vrstvy a role (Client/Manager/Engine/ResourceAccess/Resource/Utility/iFX), Who/What/How/Where, pojmenování, instance management, logická služba | 2 |
| [pravidla-interakce](pravidla-interakce.md) | uzavřená architektura, 4 relaxace, 17 pravidel, Law of 0,1, „there are no gremlins", data mezi vrstvami | 2 |
| [validace-call-chains](validace-call-chains.md) | core use cases 4–6, notace, kritérium validity, variace vs. dekompozice | 2 |
| [design-smells](design-smells.md) | katalog smells: počty, jména, fat Manager, fork/staircase/glove, symetrie, reflecting change | 2 |
| [vize-cile-mise](vize-cile-mise.md) | řetěz vize → objectives → mise, pravidla pro objectives, mise jako obrana architektury, test gold platingu | 2 |
| [interview-stakeholderu](interview-stakeholderu.md) | checklist otázek, don't lead, solutions ≠ requirements, validace otázkami, lov volatility | 4 |
| [kontrakty-facety-dto](kontrakty-facety-dto.md) | contract factoring, facety, metriky 3–5, InProc Promotion, DTO pravidla, trusted subsystem | 3 |
| [soa-anti-patterny](soa-anti-patterny.md) | 5 anti-patternů (object/super-service/UI/data/code-centric), 4 metriky, triáda remedy | 3 |
| [messaging](messaging.md) | 4 důvody front, zákazy frontování, kritéria message busu, The Message Is The Application, „nothing is free" | 3 |
| [checklisty](checklisty.md) | konsolidované checklisty architekta ze všech dílů — podklad pro QA | 1–4 |
| [project-design](project-design.md) | staffing 1:1, integrační plán bottom-up, earned value, HOP — kompaktně; mimo produkční scope | 4 |
| [banka-kontext](banka-kontext.md) | bankovní delta (D1–D11: osekání, runtime, klasifikace, SR×PR, kontrakty, Core UC…) — destilát závazného `IDesign/IDesign-v-Bance-Delta.md` v0.3 | — |

## Vztah k ostatním skillům projektu

- `use-case-analyst` — IDesign pracuje s **core use cases** jako lehkými seznamy pro validaci
  architektury; detailní specifikace UC je disciplína use-case-analyst. Nezaměňovat úrovně.
- `katalog-komponent` / realizace UC — komponenty z dekompozice jsou klasifikátory lifelinů
  v UCR (pojmenované instance). Pravidla interakce lze použít jako kontrolu sekvencí —
  jen informativně, a nikdy na Generic System / Generic LISC lifeliny.
- `realizace-sluzby` — stojí na operačním významu slova „služba" (≈ IAF.ISS);
  kontrakty a facety IDesign jsou o úroveň výš (SOA Service = komponenta).
