---
name: sar-volatilita-dekompozice
description: >
  Analýza volatilit a návrh dekompozice systému podle IDesign (SA disciplína) — rozhodovací
  strom kandidátů, seznam volatilit s odůvodněním, návrh komponent s taxonomií a klasifikací
  (IDS role / Generic System / Generic LISC) a test odolnosti. Výstup = MD návrh pro TĚŽKOU
  bránu SA-G1; volatility vždy rozhoduje člověk. Použij po schváleném SA-G0 podkladu, nebo
  když uživatel chce navrhnout/zrevidovat dekompozici systému na komponenty.
---

# sar-volatilita-dekompozice

> SA disciplína. Pravidla: `sar-pravidla.md` (skill `emr-konvence`, references/sar-pravidla.md). Znalosti: `../solution-architect/`
> (references: `dekompozice-volatilita.md` — POVINNÉ čtení, `taxonomie-komponent.md`,
> `design-smells.md`, `checklisty.md` blok A). **Žádný zápis do EMR** — výstup je MD návrh.

## Zařazení
- **Typ:** Produkční (SA) · **Brána:** **SA-G1 (TĚŽKÁ)** — jediná nemechanická část Metody

## Vstupy
Schválený `SA-G0-<Projekt>.md` (kandidáti volatilit, objectives, core UC, swim lanes).
Katalog komponent (existující komponenty — reuse před založením nové!).

## Kroky

1. **Rozhodovací strom pro každého kandidáta** (`dekompozice-volatilita.md`):
   variabilita → implementace, ne dekompozice · povaha businessu → identifikovat,
   nezapouzdřovat · bez doložené potřeby (test proti objectives!) → gold plating,
   vyhodit/degradovat · povrchní tah štětcem → kopat dál (širší koncept? kolaps
   příbuzných?). Tři povinné otázky: co přesně / proč / pravděpodobnost × dopad.
2. **Tabulka volatilit** — každý řádek: kandidát · verdikt · odůvodnění · osa ·
   krycí objective. Zamítnuté kandidáty uveď taky (s důvodem) — reviewer musí vidět,
   co NEprošlo.
3. **Návrh dekompozice** (`taxonomie-komponent.md`): komponenty per volatilita;
   nejdřív reuse z katalogu, pak nové. Jména dle rolí (§4.9 sar-pravidel). Doložené
   budoucí potřeby → pojmenovaná prázdná komponenta hned.
4. **Klasifikace každé komponenty** dle D5 (§4.7 sar-pravidel) — návrh + odůvodnění;
   u Generic System zvaž a označ možný překryv s rolí Client.
5. **Test odolnosti**: 3–5 realistických změn (z obou os + 1 amorfní) — každá musí
   zůstat zadržena v jedné komponentě; jinak zpět ke kroku 1.
6. **Self-check**: checklist A (`checklisty.md`) + rychlý smell-check (počty vs.
   kalibrace 3,4/3,8/4,0; žádná komponenta po funkci/obrazovce; „bylo to těžké?" —
   pokud ne, red flag a napiš to do confidence flags).

## Výstup

MD dokument `SA-G1-<Projekt>.md`: **(a) tabulka volatilit s verdikty — ODDĚLENĚ a PŘED
dekompozicí; (b) dekompozice (Mermaid diagram vrstev + tabulka komponent s klasifikací);
(c) test odolnosti; (d) zamítnutí kandidáti.** + shrnutí producenta s confidence flags.
Předlož **SA-G1** — verdikty volatilit a klasifikace komponent po jednom (HUMAN_DECISION);
schvaluje Miloš (+ SAR reviewer, je-li k dispozici — otázka SA1).

## Kontrola výstupu
Žádná volatilita bez lidského verdiktu; žádná komponenta bez klasifikace a krycího
objective; dekompozice odvozená z volatilit (ne ze zadání ani z obrazovek); test
odolnosti proveden; nic v EMR.
