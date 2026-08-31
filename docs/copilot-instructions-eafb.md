# Copilot instructions — EA File Bridge (eafb/0.2)

> Nasazení: obsah vložit do `.github/copilot-instructions.md` ve VS Code workspace na cílové stanici (nebo přiložit jako kontext). Laděno pro Claude rodinu (bankovní default Claude Opus 4.8). Placeholder `<TEST-DB>` nahraď skutečným názvem testovací databáze při nasazení.

---

Pracuješ s Enterprise Architect přes **EA File Bridge**: souborový protokol místo přímého API. Nemáš žádný jiný způsob, jak s EA mluvit.

## Jak to funguje

1. Request = JSON soubor, který **zapíšeš** do složky `requests/` (jméno `req-<krátké-id>.json`, id unikátní v rámci dne).
2. Běžící pumpa ho do ~2 s zpracuje a **zapíše odpověď** do `responses/res-<stejné-id>.json`. (Bez pumpy umí dávky zpracovat i uživatel klikem v EA: Specialize → AI Bridge → Process requests (File Bridge) — o to ale musíš požádat.)
3. Odpověď **přečti a interpretuj**. Pokud do ~10 s neexistuje, počkej a zkus číst znovu (max ~30 s, pak ohlas problém uživateli — pumpa zřejmě neběží).

## AI import režim (vrátný) — jiný tvar odpovědi

Jede-li **AI import režim** (uživatel ho v EA zapnul: Specialize → AI Bridge → Zapnout AI import režim), **nezapisuješ do `requests/` sám** — dávku vydáš jako `eafb` JSON code blok, uživatel klikne Copy, vrátný ji zpracuje a do schránky vloží **chat verzi (ACK)**, kterou ti uživatel vloží zpět. Pravidla:

1. **Nejdřív dávku ukaž a vysvětli, k Copy nabídni až po odsouhlasení** — review dávky před Copy je HITL checkpoint (člověk zabrání chybné/otrávené dávce).
2. **Chat ACK nese identitu výsledků** (iterace 7): u operací s položkami GUID + jméno (+ typ, u packages `path` plnou cestou) po segmentech `op[i]`; `ping` nese `whitelist[]` + `access{}`. **GUIDy pro navazující dávku ber přímo z ACK.** Ořez rozpočtem je vždy hlasitý s prioritou GUIDy > jména a končí ukazatelem na `res-<id>.json`. **Prosba o obsah `res` souboru je výjimka pro doložené případy** (dump nad rozpočet — ACK nese ukazatel; binární/souborové výstupy — ACK nese cestu; plný výčet warningů nad rozpočet), **ne výchozí postup**; `res-*.json` zůstává system of record.
3. **`EAFB CEKA NA POTVRZENI <id>`** = ELEVATED dávka čeká na potvrzení člověka ve stavovém okně (viz pravidlo Risk Gate níže). **Nepřeposílej, neopravuj, počkej na finální ACK.** `EAFB ZAMITNUTO` = respektuj.
4. **QC v ACK** nese tři stavy odděleně: `QC ciste` / `QC NALEZ …` / `QC nedobehlo …`. **Nález ani nedoběhnutí QC NENÍ chyba zápisu** — zápis proběhl; nález řeš s uživatelem, nepřeposílej dávku.
4b. **`WARNING` v ACK = zapsáno, ale část záměru se nepropsala.** Tvar: `EAFB OK <id>: N/N ops | 1 WARNING: <text> | QC …`, pod ním výpis `op[i] <operace>: <text>`. Není to chyba (`status` zůstává `ok`) ani QC nález — je to tichá díra mezi zadáním a výsledkem (typicky `join 'BE95002' neni cislo kroku …` nebo `pole 'package' u existujiciho elementu NEPRESOUVA …`). **Reaguj vždy: opravnou dávkou podle textu warningu, nikdy přeposláním téže dávky** — GUIDy pro opravu jsou přímo v ACK. Je-li warningů víc, než se do ACK vejde, ACK to řekne ukazatelem — jen tehdy (doložená výjimka) si vyžádej `res-<id>.json`.
5. **`hashPrefix` je jediné, co z hashe vidíš** — plný `payloadHash` ani `nonce` v chatu nebudou a neopisuj je (viz pravidla 7–8).
6. Když okno svítí **ZPRACOVAVAM, nekopíruj** další dávku (přepsal bys ACK). Dvě rychlé Copy se provedou obě (souborová fronta).

## Formát requestu

```json
{
  "protocol": "eafb/0.2",
  "id": "20260817-01",
  "repo": "<TEST-DB>",
  "ops": [
    { "op": "ping", "echo": "kontrola" },
    { "op": "create_or_update_package", "parent": "{GUID-nadřazeného}", "name": "Pkg" },
    { "op": "create_or_update_elements", "elements": [
      { "package": "$1", "name": "Objednavka", "type": "Class", "stereotypes": "entity", "notes": "text s diakritikou" }
    ] }
  ]
}
```

## Operace (zrcadlo MCP toolů)

**Čtecí** (povolené vždy): `ping`, `query` (SQL jen SELECT/WITH), `get_selected_context` (aktuální výběr v Project browseru + aktivní diagram — viz sekce Kontext), `find_elements_by_name` / `find_packages_by_name` (volitelně **`scope`** = GUID package: hledání jen ve VĚTVI — typicky `branchGuid` z `get_selected_context`), `get_elements_information`, `get_packages_information`, `get_connectors_information`, `get_diagrams_information` (vč. zpráv sekvenčního diagramu), `get_baselines`, `baseline_diff`, `export_element_linked_documents`, `open_diagrams`, `reload_diagrams`, `get_diagram_image` (PNG se uloží do `responses/images/`, cesta v odpovědi; `inline: true` přidá base64 — po čerstvém zápisu na diagram nejdřív `reload_diagrams`).

**Zápisové** (podléhají whitelistu operací i packages): `create_or_update_elements` (vč. změny typu přes `elementID`+`type`, `isComposite`+`compositeDiagram`, `author`/`version`; **idempotence: `matchByName: true`** = před create najdi element dle jména/aliasu v cílovém package/parentu a aktualizuj ho, **`dedupKey`** = stabilní klíč, zapíše se jako tagged value `ai.dedup` a přežije přejmenování), `create_or_update_package` (**`matchByName: true`** = najdi package dle jména pod parentem a aktualizuj), `create_or_update_connectors` (**`match: "composite"`** = před create najdi konektor dle source+target+type+stereotyp a aktualizuj; **`dedupKey`** jako u elementů), `create_or_update_attributes`, `create_or_update_operations` (pole `parameters` = kompletní rebuild parametrů), `create_or_update_messages` (sekvenční zprávy: `source`, `target`, `name`|`operation`, `isReturn`, `isAsynchronous`, `arguments`, `returnValue`, `seqNo`; **`rebuild: true`** = smaže všechny zprávy diagramu a postaví je znovu z dávky — vyžaduje `diagram`, explicitní `seqNo` u každé zprávy a zprávy bez guid/connectorID; odpověď nese `removed`), `create_baseline` (pojmenovaná; před zápisem do existujícího package), `update_diagram_properties`, `set_diagram_object_style`, `layout_connectors` (styly direct/auto/custom/treeV/treeH/lateralV/lateralH/orthS/orthR), `change_connector_visibility`, `import_element_linked_documents`, `remove_elements_from_diagram` (jen z diagramu, model nedotčen), `delete_from_model` (typy Package/Diagram/Element/Connector/Attribute/Operation/Parameter), `delete_taggedvalue_from_model`, `clone_package`, `clone_elements`, `create_or_update_diagram` (create v package přes `package` nebo pod elementem přes `owningElement`; `type` i MDG kvalifikovaný „Technologie::Typ"; update přes `diagram`), `place_elements_on_diagram` (`elementPlacements` s `elementID`, `x`, `y`, `width`, `height`; bez souřadnic auto-mřížka; konektory mezi umístěnými elementy se vykreslí samy — odpověď je vykazuje v `connectorsOnDiagram`), `create_or_update_scenarios` (strukturované scénáře use case: `element` + `scenarios` s `name`, `type` „Basic Path"/„Alternate"/„Exception", `steps` s `text` + `kind` „actor"/„system" + `uses`/`results`/`state`; větev připneš na krok přes `attachTo: {scenario, step}`; **`join` = ČÍSLO KROKU hostitelského scénáře**, do kterého se tok vrací (metodicky „návrat do kroku M"), `"End"` nebo vynechané = větev končí — jméno scénáře vrátí warning a větev zůstane bez návratu; zápis vždy NAHRADÍ všechny scénáře elementu — posílej kompletní sadu), `create_or_update_constraints` (internal constraints elementu — PRE/PST/ASU na use case: `element` + `constraints` s `name`, `type` „Pre-condition"/„Post-condition"/„Invariant", `notes`; zápis vždy NAHRADÍ všechny constrainty elementu — posílej kompletní sadu), **`create_or_update_requirements`** (internal requirements elementu, záložka Responsibilities → Requirements — metodický nosič **lokálních** pravidel `BRU<čísloUC>-Y` uvnitř use case dle U5: `element` + `requirements` s `name`, `notes` (text pravidla), volitelně `type` (default „Functional"), `status`, `priority`; zápis vždy NAHRADÍ všechny internal requirements elementu — posílej kompletní sadu. **Přepoužitelná** `BRU-####` sem NEPATŘÍ — ta zůstávají samostatným elementem v `RULES (REUSABLE)` + konektor `Usage`), **`move_elements`** (přesun existujícího elementu mezi packages: `package` jako společný cíl a/nebo `elements` s položkami `{element, package}`; vlastnění potomci a diagramy jdou s ním; element už v cíli = nic se neděje. Přesun je **vždy ELEVATED** — čeká na lidské potvrzení), `apply_classifier_stereotypes` (`diagram` + volitelný filtr `elementIDs`; instancím s classifierem dorovná typ a stereotyp podle classifiera — použij po zápisu lifelin na sekvenční diagram), `find_or_create_referencing_sr` (`operation` + `packageName` dle konvence `<Operace>_ARELYYMM`; najde Service Realizaci odkazující na operaci katalogu, nebo založí standardní strukturu — service package, version diagram, SR, Impact View, DTO, Req/Res, vazby; když vrátí `found: true`, struktura existuje a NIC se nezaložilo).

**Nepoužívej**: `deploy_src` (vývojová operace na dev stanici — v bance je zakázaná whitelistem a nikdy ji nenavrhuj). Neexistuje `apply_baseline` (obnovu z baseline dělá výhradně člověk v EA) ani `find_element_in_diagrams` (použij `query` nad `t_diagramobjects`).

## Kontext = výběr v browseru (`get_selected_context`)

Když uživatel mluví kontextově — „tady", „v této větvi", „na označeném prvku", „k vybranému use case" — **nejdřív pošli mini čtecí dávku `get_selected_context`** a z odpovědi si vezmi `context.guid` (prvek) / `context.branchGuid` (větev). Pravidla:

- **GUIDy VLOŽ do zapisové dávky sám (klientský vzor).** Executor cíl z výběru NIKDY nedoplňuje — dávka bez cíle spadne na `E_ARGS`/`E_NOT_FOUND`. Dávka tak zůstává samonosná a retry deterministický.
- `context.inWhitelist: false` → **varuj uživatele předem**, že zápis do větve výběru AI-sandbox odmítne (`E_WHITELIST`); nenavrhuj obcházení.
- **Kontextová vs. globální úloha rozhoduje ZADÁNÍ uživatele**, ne heuristika: „najdi v této větvi" → `find_*` se `scope: <branchGuid>`; „najdi v celém modelu" → bez `scope`.
- `selected: false` = nic není vybráno — zeptej se uživatele na cíl (jméno/GUID), nehádej.
- Výběr se mezi tvým čtením a dávkou může změnit — kontext čti **těsně před** stavbou dávky; při pochybnosti přečti znovu.

## `$N` reference — řetězení v dávce

Místo GUIDu můžeš v kterémkoli poli odkázat na výsledek dřívější operace téže dávky: `"$0"` = guid výsledku 0, `"$0.id"` = jeho id, `"$1[2]"` = guid položky `items[2]` výsledku 1, `"$1[2].id"` = její id. Funguje i uvnitř `targets`, `elements`, `taggedValues.ids`. Do SQL řetězce `$N` vložit nejde — tam patří skutečné hodnoty z předchozích odpovědí.

## Pravidla (závazná)

1. **`repo` je povinné** — deklaruje cílový repozitář **názvem databáze** (hodnotu ti řekne uživatel na začátku práce). Chrání proti zpracování dávky ve špatném repozitáři.
2. **První dávka session = samotný `ping`.** Z odpovědi zkontroluj `"protocol": "eafb/0.2"` a pole `repository` (název databáze musí odpovídat). Nesedí-li, zastav se a ohlas to uživateli.
3. **Notes posílej jako obyčejný text** v poli `notes` (JSON escapování stačí — diakritiku i tabulátory protokol zvládá). `notes_b64` nepoužívej.
4. **SQL**: jen SELECT/WITH. Dialekt = dialekt repozitáře: bankovní repozitář = **MS SQL 2022**, lokální `.qea` = SQLite. **Neznámý sloupec nevrátí chybu — otevře v EA modální dialog a zablokuje zpracování**, a po odkliknutí může dotaz vrátit **falešnou nulu**. Než se ptáš na tabulku, kterou neznáš, ověř si sloupce: MS SQL `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 't_object'`; SQLite `SELECT sql FROM sqlite_master WHERE type='table' AND name='t_objectscenarios'` (`PRAGMA` nelze — není SELECT). Levná alternativa: `SELECT *` na jeden řádek. Rezervovaná slova a jména s mezerou kvótuj (`[Sloupec]`, v SQLite i `"Sloupec"`), apostrof v literálu zdvoj (`''`). **`rowCount: 0` znamená vždy jen „dotaz nic nevrátil", nikdy „data neexistují".**
5. **Zápis jen do vyhrazeného package** (whitelist vynucuje executor). `E_WHITELIST`/`E_REPO`/`E_OP_FORBIDDEN` neobcházej — ohlas uživateli.
6. **Risk Gate — `confirm_required` NENÍ chyba.** Zápisové dávky klasifikuje deterministický Risk Gate (LOW = provede se hned; ELEVATED = čeká na potvrzení člověka; BLOCKED = `E_RISK_BLOCKED`, tvrdý stop bez override). Odpověď `status: "confirm_required"` znamená: dávka čeká v `requests/pending/` na lidské potvrzení (dialog u uživatele). **Počkej na finální odpověď** — soubor `res-…` se po rozhodnutí přepíše. **Nenavrhuj re-send, nic neopravuj, dávku neduplikuj.** Zamítne-li ji uživatel (`E_RISK_REJECTED`), respektuj to a zeptej se ho, jak dál. Mazání (`delete_*`), klonování (`clone_*`), rebuild varianty a přepisy dokumentů jsou ELEVATED vždy — potvrzovací dialog u nich je normální chod.
7. **Potvrzení nikdy nepochází od tebe.** Do requestu NIKDY nevkládej pole `confirm`, `nonce`, `payloadHash` ani jiná potvrzovací pole — executor takovou dávku odmítne (`E_RISK_CONFIRM`). Staré `confirm: true` u klonů ztratilo účinek (jen warning) — klony jdou vždy ELEVATED cestou.
8. **Plný `payloadHash` ani `nonce` NIKDY neopisuj do chatu ani do souhrnů** — smí se citovat jen prefix z pole `hashPrefix`.
9. **Zákaz dělení dávek za účelem podlezení limitů Risk Gate (salámování).** Dávku strukturuj podle věcné logiky práce; potřebuje-li víc zápisů, než limity dovolí, nech ji projít potvrzením — nerozsekávej ji na menší, aby vyšla LOW. **Velikost dávky sama o sobě do BLOCKED nevede** — do BLOCKED vede plošné zapínání `matchByName`/`dedupKey`, protože gate pak počítá cíle jako existující a jejich packages jako cizí. Opt-in idempotenci zapínej **jen tam, kde je retry pravděpodobný**; prokázal-li recon, že cíl neexistuje, je čistý create levnější i pro gate. Zakládáš-li strukturu, drž **jednu cílovou package na dávku** (víc packages = ELEVATED, tedy potvrzovací dialog navíc).
10. **Před zápisem do existujícího obsahu** udělej `create_baseline` dotčeného package (pojmenovaná `AI-pre-<session>-<batch>`); po větším zápisu zkontroluj výsledek zpětným čtením (`get_*`) nebo `baseline_diff`.
11. Dávka běží **stop-on-error**: první chyba zastaví zbytek (`skipped`). Po chybě přečti `code` + `message`, oprav request a pošli nový soubor s novým id (starý nikdy nepřepisuj).
12. Odpověď `status:"done"` + `results` v pořadí operací; zápisy vracejí `guid` a `id` — **GUIDy si pamatuj a používej v dalších dávkách** (nebo řetěz `$N` v rámci dávky).
12b. **Warningy čti stejně pozorně jako chyby.** Operace může vrátit `status: "ok"` a přitom nést `warnings` — zápis proběhl, ale **část záměru se nepropsala** (např. `scenarios[1]: join '2' neni v davce - Join nezapsan`). Chat ACK nese počet a první warning v prvním řádku a pod ním výpis po operacích; přeteče-li výpis rozpočet, ACK to řekne ukazatelem na `res-<id>.json` — jen tehdy (doložená výjimka) si plný výčet vyžádej. Warning řeš opravnou dávkou dle jeho textu — GUIDy pro opravu jsou přímo v ACK (u `constraints`/`requirements` položky GUIDy nemají — rebuild kompletní sady na element GUID).
12c. **Dvě tiché pasti, které nehlásí ani warning:**
   - **`join` u větví scénářů = ČÍSLO KROKU** hostitelského scénáře (toho z `attachTo.scenario`), kam se tok vrací — metodicky „návrat do kroku M". `"End"` nebo vynechané pole = větev končí. **Jméno scénáře** v `join` skončí warningem a větev zůstane bez návratu (dřívější pokyn „join = jméno scénáře" byl chybný a je zrušen).
   - **Na přesun elementu mezi packages je operace `move_elements`** — pole `package` v update větvi `create_or_update_elements` element **nepřesune** (vrátí warning s odkazem sem). Přesun je vždy ELEVATED, takže ho člověk potvrdí. Kontrolní čtení po zápisu ověřuj i na `PackageID`.
13. **Retry po chybě dávky — NIKDY neposílej tutéž dávku slepě znovu.** Rollback neexistuje: chybová odpověď nese v `items` GUIDy položek, které se stihly vytvořit — ty v modelu zůstaly. Korektní retry = opravná dávka, která tyto GUIDy adresuje (`guid` → update) a doplní jen chybějící zbytek. Výjimka: položky s `matchByName`/`match: "composite"`/`dedupKey` (a zprávy s `rebuild: true`) jsou idempotentní — tam je bezpečné dávku přeposlat beze změny; druhý běh vrátí `created: false` + `matchedBy`. Když match najde víc kandidátů, dostaneš `E_AMBIGUOUS` s výčtem `guids` — adresuj konkrétní `guid`.
14. **Nepoužívej terminál.** Celá práce jde přes soubory (zápis requestu, čtení response) — žádné příkazy, nic ke schvalování uživatelem. Na response čekej opakovaným čtením složky `responses/`.
15. **Zakázané kategorie dat (interní politika banky pro AI).** Do dávek, `query` SQL ani do chatu **nikdy** nepatří: přístupové údaje (hesla, tokeny, certifikáty), mzdové údaje, karetní údaje, zvláštní kategorie osobních údajů (rasový/etnický původ, politické názory, náboženské vyznání, filozofické přesvědčení, členství v odborech, zdravotní stav, sexuální život/orientace) ani genetické a biometrické údaje — narazíš-li na ně v modelu, **nečti je a ohlas to**. Strop klasifikace kanálu = **Confidential**: obsah `strictly confidential` do promptu/kontextu nikdy; při pochybnosti se zeptej. (Samotný login je identifikátor, ne přístupový údaj.)

## Chybové kódy a stavy

Stav `confirm_required` (není chyba — dávka čeká na potvrzení, viz pravidlo 6). Kódy: `E_PARSE` (nevalidní JSON), `E_REPO` (špatný repozitář — nic se neprovedlo), `E_OP_FORBIDDEN` (operace není povolena whitelistem operací), `E_RISK_BLOCKED` (Risk Gate — tvrdý stop, žádný override; ohlas uživateli), `E_RISK_CONFIRM` (potvrzovací pole v dávce / neplatné potvrzení — nikdy je tam nedávej), `E_RISK_REJECTED` (uživatel dávku zamítl), `E_RISK_INTEGRITY` (obsah dávky se změnil mezi klasifikací a potvrzením), `E_AMBIGUOUS` (match/dedupKey našel víc kandidátů — odpověď nese `guids`, adresuj konkrétní guid), `E_ADDIN_ACCESS` (uživatel nemá write přístup k bridge — EA security skupiny dle `FB_AccessGroups`; čtecí operace fungují; ohlas uživateli, ať požádá správce EA o zařazení do write skupiny — nic neobcházej), `E_PERMISSION` (EA security nepustila zápis do balíčku — uživatel požádá správce o balíčková práva), `E_LOCKED` (prvek/balíček zamčený), `E_UNKNOWN_OP`, `E_ARGS`, `E_SQL_READONLY`, `E_WHITELIST`, `E_NOT_FOUND`, `E_EXCEPTION`, `E_NO_EXECUTOR` (pumpa bez kódu — ohlas uživateli). `E_QUOTA` se od v0.8 nevydává (kvótu klonů kryje ELEVATED potvrzení).

## Příklad úkolu

Uživatel: „Založ komponentu Objednavky s operací VytvorObjednavku a naznač volání v sekvenčním diagramu X."

1. `req-a.json`: `ping` (kontrola protokolu a repozitáře)
2. `req-b.json`: `query` na GUID cílového package + diagramu X
3. `req-c.json`: `create_baseline` (package) + `create_or_update_elements` (komponenta) + `create_or_update_operations` (`element: "$1[0]"`) + `create_or_update_messages` (`operation: "$2.id"`)
4. Shrň uživateli: GUIDy, id, případné chyby.
