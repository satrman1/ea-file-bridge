# Bankovní kontext IDesign

**Status (2026-07-19):** všechny blokující otázky delty zodpovězeny Milošem (D1, D3,
D5, D8, D9, D10, D11 — detail v **závazném** `IDesign/IDesign-v-Bance-Delta.md` v0.3;
tento soubor je jeho destilát pro skill, čti je spolu). Doktrína z ostatních referencí
je Löwy 2008–2015; tento soubor říká, co z ní v bance platí jinak.

## Známá fakta

1. **IDesign je adoptovaná norma banky ~10 let**, implementovaná do EMR MDG technologií
   `IDS-IDesign`, jejímž autorem je Miloš. **Mapa platformy existuje:
   `IDesign/IDesign-MDG-Kontext.md`** (2026-07-19) — stereotypy `IDS-*`, konektory
   IDS-Sync/IDS-Async, šablona SAR balíčku, pravidla modelování (Big Picture jen
   instance, dynamické pohledy jen linky, popis vazeb linked Notes) a SQL kontroly SARů.
   Při práci s bankovními SA artefakty ji čti společně s tímto souborem.
2. **Osekané artefakty (✅ D1):** auth / identity / transactions = jen Advanced šablona
   na vyžádání; **iFX, message bus / The Message Is The Application a workflow managery
   jsou mimo bankovní praxi — nenabízej je.** Nepředpokládej, že vše z doktríny v bance
   existuje.
3. **Runtime nezávislost komponent (✅ D3):** banka nasazuje více instancí jedné
   komponenty s nezávislými call chainy — ale **žije to jen v deploymentu, v EMR se
   NEMODELUJE.** Je to důsledek IDesign návrhu, ne modelovaná skutečnost. Stereotyp
   `IDS-Run-Time Process` v MDG existuje, ale v praxi se nepoužívá (spadá pod osekání).
   Nikdy nenavrhuj modelování instancí-per-runtime.
4. **Katalog komponent (best effort uklizen):** značná část komponent nese IDesign
   stereotypy (Manager/Engine/ResourceAccess…). Komponenty nesplňující IDesign kritéria
   dekompozice mají stereotyp **Generic System** nebo **Generic LISC** (z metodiky IAF;
   LISC = logical information system component).
5. **Vztah k IAF:** UCR a SR systémové analýzy jsou v podstatě **IAF.ISS** (information
   system service), resp. se tomu záměrně blíží. IDesign a IAF v bance koexistují.

## Pravidla plynoucí z faktů (platí už teď)

- **Klasifikační pravidlo komponent (✅ D5, není rigidní — výjimky možné):**
  (1) stavíme my podle volatilit a IDesignu → **IDS role**; (2) krabice s neznámým
  vnitřkem → **Generic System** (⚠ přiznaná slabina: může se krýt s rolí Client);
  (3) komponenta dle starší metodiky (např. IAF) nebo krabicové řešení se známou
  strukturou → **Generic LISC**. IDesign kritéria, smell-check ani pravidla interakce
  se na Generic komponenty **neaplikují**. AI klasifikaci vždy jen navrhuje
  s odůvodněním; potvrzuje člověk (G1/G2).
- **SR × PR (✅ D8):** operace v rozhraní se stereotypem **`IDS-Process Contract`**
  se nerealizuje Service realizací, ale **Proces realizací (PR)** — stejný tvar vč.
  operation linku, ale pod ní BPMN diagram (Camunda). Detail a stav propsání:
  `Skilly/_shared/emr-zapis-pravidla.md` §7e.
- **Kontrakty v praxi (✅ D9):** contract factoring dle doktríny (facety, díl 3) se
  dělá **jen u exponovaných integračních komponent — a těch je málo**. Typický vzor:
  **jeden common interface + jeden proposed interface** (proposed = odemčený kvůli
  zámkům, master zamčený — NE sémantické členění). Granularitu operací dělá ITAN se
  supervizí SARa (šedá zóna dle seniority). AI: facetování nenavrhuj z vlastní
  iniciativy — jen u exponované integrace, jako rozhodnutí SARa; InProc Promotion
  tím prakticky odpadá.
- **Papírová část doktríny (✅ D10):** vize→objectives→mise, osy volatility,
  rozhodovací strom a test odolnosti se produkují jako **MD dokumenty vedle EMR**
  (podklad bran G0/G1); do EMR se zapisuje až od Area of Volatility dál —
  IDS-Volatility elementy nesou destilát, ne celý rozhovor.
- **Terminologie (závazná pro výstupy):** „operace" = operace na kontraktu (historický
  bankovní význam slova „služba"); „SOA Service" / „komponenta" = jednotka dekompozice
  IDesign. Holé „služba" bez kvalifikátoru nepoužívat — v bance je víceznačné (SAR jím
  míní komponentu, analytici operaci). Zavedené názvy artefaktů systémové analýzy
  (realizace služby, LS) se nemění.
- **Retro-přestavba se nenavrhuje:** existující Generic komponenty nejsou dluh k okamžité
  nápravě; harmonizace portfolia není cílem AI disciplíny.

## Co sem NEpatří

Domýšlení bankovních pravidel bez podkladu. Chybí-li fakt, řekni to a odkaž na otevřené
otázky SA1–SA7 v koncepci — nedomýšlej hypotetické oblasti (anti-pattern metanávodu).
