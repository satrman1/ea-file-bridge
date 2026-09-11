# Validace architektury call chainy

Zdroj: díl 2. „One of the fundamental ideas behind the IDesign Method is that **you must
validate your design.**" Dekompozice bez důkazu je jen obrázek („The Gnome Plan is not
a validation").

## Core use cases

**Závazné definice (metodika banky, 2026-07-19):**

- **Core use-case** = případ užití, který nejlépe vystihuje **nejdůležitější business
  přínos** systému. Systém má zpravidla jen několik klíčových use-casů; ostatní jsou
  jejich **varianty nebo podpůrné** případy užití. Klíčové use-casy obvykle **nebývají
  přímo uvedeny ve specifikaci požadavků** — vznikají až jako výsledek analýzy a vyšší
  úrovně abstrakce.
- **Use-case** = **jedna konkrétní interakce či impuls aktéra** — NIKOLI uživatelem
  řízený sled kroků nebo workflow. Aktérem může být **člověk, externí systém nebo čas**
  (např. odeslání příkazu k úhradě; nastavení předpisu pro notifikace; zpracování
  události na konci bankovního dne).

**Výběrové kritérium core množiny (pracovní heuristika Miloše, ne dogma):** cílem je
identifikovat **všechny komponenty**, které se budou podílet na existujících
i očekávaných use casech. Core UC je proto **typový zástupce**: jeho realizace používá
**jiný call chain** než realizace ostatních core UC. Dva UC se shodným call chainem →
jeden z nich je variace, ne core. Očekávaný UC, jehož chain potřebuje komponentu mimo
dekompozici → chybí core UC (a komponenta). Množina core UC je tak duálem k „minimal
set of interacting services": organicky vyplaví všechny komponenty řešení.

**Doktrína (konzistentní s výše uvedeným):**

- Validuje se nad **4–6 vzájemně odlišnými core use cases** v jednoduché seznamové formě
  („not heavy specs" — detailní specifikace UC je jiná disciplína, viz use-case-analyst).
- Core use cases reprezentují podstatu byznysu a téměř se nemění. Všechny ostatní use cases
  jsou **variace**: jiná interakce mezi komponentami, **ne jiná dekompozice**.
  „Change in use cases causes change in work flow not in services."

## Notace

- Sekvenční diagramy per use case se v této fázi **nepoužívají** (too time consuming,
  „subverts crunch") — to je detailed design.
- Use case se **superponuje** na diagram komponent jako call chain:
  **plná šipka = synchronní volání, čárkovaná = queued volání.**
- Číslované kroky na šipkách; queued šipky smějí vést jen Manager→Manager (pravidla 3, 6, 7).

## Postup validace

1. Pro každý core use case nakresli call chain přes existující komponenty.
2. Ověř pravidla interakce (viz [pravidla-interakce](pravidla-interakce.md)).
3. **Chybí-li v řetězu komponenta, kterou use case vyžaduje → díra v dekompozici** —
   vrať se k volatilitám.
4. Vznikla-li pro use case nová komponenta pojmenovaná po něm → funkcionální recidiva.
5. Ověř variace: vybrané ne-core use cases musí projít jako jiná kompozice týchž komponent.
6. Zkontroluj tvary řetězů proti smells (fork, staircase, glove — [design-smells](design-smells.md))
  a symetrii napříč use casy („Good architecture is symmetric", stick figure).

## Kritérium validity

„Strive to have the minimal set of interacting services that satisfy use cases" — současné
i budoucí, známé i neznámé. Iterativní faktorizace; smí měnit i use case.
„**When all conceivable use cases satisfied architecture is validated.**"
Pozor na bod klesajících výnosů — validace nemá být gold plating v převleku.

## Forward-looking test

Dobrý call chain unese i budoucí scénáře beze změny designu (vícenásobné průchody,
BI dotazy nad historií). Test odolnosti z [dekompozice-volatilita](dekompozice-volatilita.md) (3–5 změn, každá
zadržena v jedné komponentě) je součástí validace.
