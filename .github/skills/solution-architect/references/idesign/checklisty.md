# Konsolidované checklisty architekta

Zdroj: závěry dílů 1–4. Použití: QA podklad pro review dekompozice a architektury;
při smell-checku projdi relevantní blok celý a každé „ne" zapiš jako nález.

## A. Dekompozice (díl 1)

- [ ] Netransformované požadavky nebyly použity přímo (swim lanes, konsolidace).
- [ ] Prošly obě osy volatility; žádná položka nesedí na obou najednou.
- [ ] Každý kandidát prošel třemi otázkami (co, proč, pravděpodobnost × dopad).
- [ ] Variabilita zůstala v implementaci; nezapouzdřují se atributy a číselníky.
- [ ] Povaha businessu se nezapouzdřuje; spekulace bez byznysového krytí vyřazeny.
- [ ] Doložené budoucí potřeby mají pojmenovanou komponentu už teď.
- [ ] Žádná komponenta se nejmenuje po funkci nebo doméně ze zadání (leda by doména sama
      byla volatilní).
- [ ] Volatilita klesá shora dolů; Manageři jsou téměř postradatelní.
- [ ] Počet komponent je v oblasti minima U-křivky — žádná God Service, žádné hadí hnízdo.
- [ ] Na žádnou feature nejde ukázat prstem v jedné komponentě.
- [ ] Test odolnosti proveden: každá zkušební změna zůstane zadržena v jedné komponentě.
- [ ] Bylo to těžké. (Pokud ne — red flag.)

## B. Architektura (díl 2)

- [ ] Stakeholdeři se shodli na vizi; objectives jsou čistě byznysové; mise mluví
      o blocích, ne features.
- [ ] Každá komponenta má jednoznačnou roli taxonomie (Who/What/How/Where).
- [ ] Business logika není v klientech; session/context awareness má jen Manager.
- [ ] Manageři jsou lehcí a postradatelní; „Workflow varies, BL does not."
- [ ] Engines jsou vzácné, slovesné, sdílené; žádný Engine nevolá Engine.
- [ ] ResourceAccess vystavuje business slovesa, ne CRUD; žádná BL ve stored procedures.
- [ ] Architektura je uzavřená; do stran jen frontou a jen témuž jednomu Manageru
      (Law of 0,1).
- [ ] Události publikují jen Manageři („there are no gremlins").
- [ ] Mezi vrstvami jen primitiva a DTO; žádné business entity s chováním.
- [ ] 4–6 core use cases pokryto call chainy; ostatní use cases jsou variace interakce,
      ne dekompozice.
- [ ] Katalog smells projit; každé pípnutí prošetřeno (a zdůvodněno, pokud ponecháno).
- [ ] Každý blok architektury slouží některému objective.

## C. Kontrakty a komunikace (díl 3)

- [ ] Je známo, k čemu je systém coupled — vědomá volba, ne nehoda.
- [ ] Žádný z pěti anti-patternů (orchestrace internalizovaná, služby nejsou general
      purpose, žádné form-centric služby, žádné schema-as-service, myslí se na zprávy).
- [ ] Počet komponent = minimální množina uspokojující use cases (U-křivka).
- [ ] Kontrakty: 3–5 operací, žádné properties, „tell don't ask", každý kontrakt je
      reusable faceta.
- [ ] Je známo, které kontrakty jsou collapsed a kudy povede případná InProc Promotion.
- [ ] DTO properties-only; interní DTO nikdy do prezentační vrstvy u volatilních use cases.
- [ ] Každá vrstva autentizuje bezprostředního volajícího; žádná impersonace; audit se
      skládá z lokálních auditů.
- [ ] Queued volání jen z důvodů availability / disjoint work / kompenzace / load leveling
      — a nikdy na Engines či ResourceAccess.
- [ ] Queued služba nevrací hodnoty; response service jen kde ji use case žádá.
- [ ] Message bus (a tím spíš Message-Is-The-Application) zdůvodněn konkrétní volatilitou
      a objectives — ne design copycat.
- [ ] Změna transportu/hostingu nemění jádro Manager/Engine/ResourceAccess.

## D. Proces a role (díl 4 — výběr relevantní pro review návrhu)

- [ ] Interview: otevřené otázky, jazyk byznysu, sondování os volatility, validace
      otázkami (ne přikyvováním).
- [ ] Návrh nezrcadlí strukturu dostupného týmu ani cizí diktovaný kontrakt
      (mirror image effect).
- [ ] Kritická cesta a integrační pořadí jsou známy (bottom-up: utility → Resources →
      RA → Engines → Manageři → klienti), i když project design není v aktuálním scope.
