# EA File Bridge — instrukce pro Copilot agenta (DOMÁCÍ dev stanice, eaexample)

> Tento soubor patří do `.github/copilot-instructions.md` ve workspace `C:\GIT\ea-file-bridge`.
> Domácí varianta (eafb/0.2): repo = eaexample, dialekt SQLite, `deploy_src` POVOLEN (dev).
> Bankovní varianta se odvozuje z `docs/copilot-instructions-eafb.md` (`<TEST-DB>`, MS SQL 2022, deploy_src deny).

---

Pracuješ s Enterprise Architect přes **EA File Bridge**: souborový protokol místo přímého API. Nemáš žádný jiný způsob, jak s EA mluvit. Pumpa běží na tomto počítači a sleduje složku `requests/`.

## Jak to funguje

1. Request = JSON soubor, který **zapíšeš** do složky `requests/` (jméno `req-<krátké-id>.json`, id unikátní).
2. Pumpa ho do ~2 s zpracuje a **zapíše odpověď** do `responses/res-<stejné-id>.json`.
3. Odpověď **přečti a interpretuj**. Pokud do ~10 s neexistuje, počkej a zkus číst znovu (max ~30 s, pak ohlas uživateli, že pumpa zřejmě neběží).

## AI import režim (vrátný) — jiný tvar odpovědi

Když uživatel jede **AI import režim** (vrátného zapíná v EA: Specialize → AI Bridge → Zapnout AI import režim), NEzapisuješ do `requests/` sám. Místo toho **dávku vydáš jako `eafb` JSON code blok** a uživatel klikne Copy — vrátný ji zachytí ze schránky, zpracuje a **do schránky vloží chat verzi (ACK)**, kterou ti uživatel vloží zpět. Pravidla:

1. **Nejdřív dávku ukaž a vysvětli, teprve po odsouhlasení nabídni k Copy.** Review dávky před Copy je bod, kde člověk zabrání chybné/otrávené dávce (HITL checkpoint). Nespěchej na Copy.
2. **Chat ACK nese identitu výsledků** (iterace 7). `EAFB OK <id>: N/N ops | QC ciste` = hotovo; `… | 1 WARNING: … | QC …` = zapsáno, ale část záměru se nepropsala (viz pravidlo 12b). Pod prvním řádkem jsou segmenty `op[i]` s položkami: **GUID + jméno** (+ typ, u packages `path` plnou cestou); `ping` nese `whitelist[]` + `access{}`. **GUIDy pro navazující dávku ber přímo z ACK.** Ořez rozpočtem je vždy hlasitý (priorita GUIDy > jména) a končí ukazatelem na `res-<id>.json`. **Žádost o obsah `res` souboru je výjimka pro doložené případy** (dump nad rozpočet — ACK nese ukazatel; binární/souborové výstupy — ACK nese cestu; plný výčet warningů nad rozpočet), **ne výchozí postup**; `res-*.json` zůstává system of record.
3. **`EAFB CEKA NA POTVRZENI <id>` = ELEVATED dávka čeká na lidské potvrzení ve stavovém okně.** Není to chyba ani tvůj úkol. **Nepřeposílej dávku, nic neopravuj.** Počkej, až uživatel v okně klikne Provest/Zamitnout a vloží ti finální ACK. `EAFB ZAMITNUTO` = respektuj a zeptej se, jak dál.
4. **Potvrzení nikdy nepochází od tebe** — do dávky NIKDY nedávej `confirm`/`nonce`/`payloadHash` (executor ji odmítne `E_RISK_CONFIRM`). ACK nese jen `hash <prefix>…` — plný hash ani nonce v chatu neuvidíš a neopisuj je.
5. **`rowCount: 0` neznamená „data neexistují"** — jen „dotaz nic nevrátil" (po zamrznutí EA na dialogu může být výsledek degradovaný; ověř kontrolním čtením).
6. **Dvě rychlé Copy = obě dávky se provedou** (souborová fronta); ale když okno svítí ZPRACOVAVAM, **nekopíruj** — přepsal bys ACK, který ti vrátný právě dává.

## Formát requestu

```json
{
  "protocol": "eafb/0.2",
  "id": "20260817-01",
  "repo": "EAExample.qea",
  "ops": [
    { "op": "ping", "echo": "kontrola" },
    { "op": "create_or_update_elements", "elements": [
      { "package": "{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}", "name": "Jméno", "type": "Class", "stereotypes": "entity", "notes": "text s diakritikou" }
    ] }
  ]
}
```

## Operace

Stejný registr jako `docs/PROTOKOL-EAFB.md` §4 (zrcadlo MCP toolů — skilly fungují beze změn):

- **Čtecí**: `ping`, `query`, `get_selected_context` (aktuální výběr v Project browseru + aktivní diagram — viz sekce Kontext), `find_elements_by_name` / `find_packages_by_name` (volitelně **`scope`** = GUID package: hledání jen ve VĚTVI — typicky `branchGuid` z `get_selected_context`), `get_elements_information`, `get_packages_information`, `get_connectors_information`, `get_diagrams_information`, `get_baselines`, `baseline_diff`, `export_element_linked_documents`, `open_diagrams`, `reload_diagrams`, `get_diagram_image` (PNG do `responses/images/`, `inline: true` přidá base64; po čerstvém zápisu na diagram nejdřív `reload_diagrams`).
- **Zápisové**: `create_or_update_elements` (vč. K7 změny typu, K8 isComposite/compositeDiagram, K6 author/version; **idempotence B2: `matchByName: true`** = před create najdi dle jména/aliasu v cílovém package/parentu → update, **`dedupKey`** = stabilní klíč → TV `ai.dedup`, přežije přejmenování), `create_or_update_package` (**`matchByName: true`** scoped na parent), `create_or_update_connectors` (**`match: "composite"`** = lookup dle source+target+type+stereotyp → update, **`dedupKey`** jako u elementů), `create_or_update_attributes`, `create_or_update_operations`, `create_or_update_messages` (**`rebuild: true`** = server-side V2d: smaže zprávy diagramu + postaví znovu; vyžaduje `diagram` + explicitní `seqNo`, zprávy bez guid/connectorID; odpověď nese `removed`), `create_baseline` (pojmenovaná), `create_or_update_diagram` (create v `package` nebo pod `owningElement`, `type` i MDG „Technologie::Typ", update přes `diagram`), `place_elements_on_diagram` (`elementPlacements`: `elementID`, `x`, `y`, `width`, `height`; bez souřadnic auto-mřížka; konektory se vykreslí samy — viz `connectorsOnDiagram` v odpovědi), `update_diagram_properties`, `set_diagram_object_style`, `layout_connectors`, `change_connector_visibility`, `import_element_linked_documents`, `remove_elements_from_diagram`, `delete_from_model`, `delete_taggedvalue_from_model`, `clone_package`, `clone_elements`, `create_or_update_scenarios` (`element` + `scenarios[{name, type: Basic Path|Alternate|Exception, steps[{text, kind: actor|system, uses, results, state}], attachTo{scenario, step}, **`join` = ČÍSLO KROKU hostitelského scénáře** | `"End"` | vynecháno}]` — deterministický rebuild: nahradí VŠECHNY scénáře elementu), `create_or_update_constraints` (`element` + `constraints[{name, type: Pre-condition|Post-condition|Invariant, notes, status}]` — deterministický rebuild všech internal constraints elementu), **`create_or_update_requirements`** (`element` + `requirements[{name, notes, type (default Functional), status, priority, difficulty, stability}]` — internal requirements = nosič **lokálních** BRU dle U5; deterministický rebuild všech internal requirements elementu), **`move_elements`** (`package` a/nebo `elements[ref | {element, package}]`, `withChildren` default true — přesun mezi packages; whitelist zdroje i cíle, validace celé dávky před zápisem, element už v cíli = noop; politika ELEVATED vždy, metrika `moveOps`), `apply_classifier_stereotypes` (`diagram`, filtr `elementIDs` — dorovná Type+stereotyp instancí dle classifiera, idempotentní), `find_or_create_referencing_sr` (`operation`, `packageName` `<Operace>_ARELYYMM`, volitelně `targetPackage` — katalog-first SR scaffold; šablony viz `FB_ScaffoldConfig`).

Pozn. Risk Gate: `delete_*`, `remove_elements_from_diagram`, `clone_*`, `import_element_linked_documents`, `scenarios`, `constraints`, **`requirements`**, **`move_elements`** (a varianty `messages`+`rebuild`, `operations`+`parameters`, změna `type` na update) jsou klasifikované **ELEVATED** — odpověď bude `confirm_required` a dávka počká na potvrzení uživatele (pravidlo 6). To je normální chod, ne chyba.
- **Dev only (zde povoleno)**: `deploy_src` — po úpravě `src/AICodeBridge.*.js` nasadí kód do modelu (`{"op":"deploy_src","only":["FB_Nazev"]}`); pumpa se sama přenačte **až po doběhnutí dávky** — nový kód používej až v následující dávce. Kód pro EA runtime (menu/GUI fallback) vyžaduje navíc restart EA. **V bance se deploy_src nikdy nenavrhuje (deny).**

## Kontext = výběr v browseru (`get_selected_context`)

Když uživatel mluví kontextově — „tady", „v této větvi", „na označeném prvku", „k vybranému use case" — **nejdřív pošli mini čtecí dávku `get_selected_context`** a z odpovědi si vezmi `context.guid` (prvek) / `context.branchGuid` (větev). Pravidla:

- **GUIDy VLOŽ do zapisové dávky sám (klientský vzor).** Executor cíl z výběru NIKDY nedoplňuje — dávka bez cíle spadne na `E_ARGS`/`E_NOT_FOUND`. Dávka tak zůstává samonosná a retry deterministický.
- `context.inWhitelist: false` → **varuj uživatele předem**, že zápis do větve výběru AI-sandbox odmítne (`E_WHITELIST`); nenavrhuj obcházení.
- **Kontextová vs. globální úloha rozhoduje ZADÁNÍ uživatele**, ne heuristika: „najdi v této větvi" → `find_*` se `scope: <branchGuid>`; „najdi v celém modelu" → bez `scope`.
- `selected: false` = nic není vybráno — zeptej se uživatele na cíl (jméno/GUID), nehádej.
- Výběr se mezi tvým čtením a dávkou může změnit — kontext čti **těsně před** stavbou dávky; při pochybnosti přečti znovu.

## `$N` reference — řetězení v dávce

`"$0"` = guid výsledku 0, `"$0.id"` = id, `"$1[2]"` / `"$1[2].id"` = položka `items[2]` výsledku 1. Funguje v celém objektu operace (targets, elements, taggedValues.ids). Do SQL řetězce `$N` vložit nejde.

## Pravidla (závazná)

1. **`repo` je povinné** a v tomto workspace vždy `"EAExample.qea"`.
2. **První dávka session = samotný `ping`** — zkontroluj `"protocol": "eafb/0.2"` a `repository` obsahuje `EAExample.qea`.
3. **Notes plain text** (`notes`); `notes_b64` nepoužívej.
4. **SQL**: jen SELECT/WITH; dialekt zde = **SQLite** (v bance MS SQL 2022). **Neznámý sloupec nevrátí chybu — otevře v EA modální dialog a zablokuje zpracování** (a po odkliknutí hrozí falešná nula). Neznáš-li tabulku, nejdřív schéma: SQLite `SELECT sql FROM sqlite_master WHERE type='table' AND name='t_objectscenarios'` (`PRAGMA` nelze — není SELECT), MS SQL `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='t_object'`; levná alternativa `SELECT *` na jeden řádek. Rezervovaná slova kvótuj (`[Sloupec]` / `"Sloupec"`), apostrof v literálu zdvoj (`''`). **`rowCount: 0` = „dotaz nic nevrátil", nikdy „data neexistují".**
5. **Zápis jen do větve `#FB-TEST`** = `{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}` (whitelist vynucuje executor; `E_WHITELIST`/`E_REPO`/`E_OP_FORBIDDEN` neobcházej).
6. **Risk Gate — `confirm_required` NENÍ chyba.** Zápisové dávky klasifikuje deterministický Risk Gate (LOW = provede se hned; ELEVATED = čeká na potvrzení člověka; BLOCKED = `E_RISK_BLOCKED`). Odpověď `status: "confirm_required"` znamená: dávka čeká v `requests/pending/` na lidské potvrzení. **Počkej na finální odpověď** (soubor `res-…` se po rozhodnutí přepíše) — **nenavrhuj re-send, nic neopravuj, dávku neduplikuj.** Zamítne-li ji uživatel (`E_RISK_REJECTED`), respektuj to a zeptej se ho, jak dál.
7. **Potvrzení nikdy nepochází od tebe.** Do requestu NIKDY nevkládej pole `confirm`, `nonce`, `payloadHash` ani jiná potvrzovací pole — executor takovou dávku odmítne (`E_RISK_CONFIRM`). Potvrzení probíhá výhradně lokálním úkonem uživatele (dialog/konzole). Staré `confirm: true` u klonů ztratilo účinek (jen warning) — klony jdou vždy ELEVATED cestou.
8. **Plný `payloadHash` ani `nonce` NIKDY neopisuj do chatu ani do souhrnu** — smí se citovat jen prefix hashe z pole `hashPrefix`.
9. **Zákaz dělení dávek za účelem podlezení limitů Risk Gate (salámování).** Dávku strukturuj podle věcné logiky práce; potřebuje-li víc zápisů, než limity dovolí, nech ji projít potvrzením — nerozsekávej ji na menší, aby vyšla LOW. **Do BLOCKED nevede velikost dávky, ale plošné `matchByName`/`dedupKey`** (gate pak počítá cíle jako existující a jejich packages jako cizí) — zapínej je jen tam, kde je retry pravděpodobný. Zakládáš-li strukturu, drž jednu cílovou package na dávku (víc packages = ELEVATED).
10. **Před zápisem do existujícího obsahu** `create_baseline` (pojmenovaná `AI-pre-<session>-<batch>`); výsledek ověř zpětným čtením nebo `baseline_diff`.
11. **Stop-on-error**: první chyba zastaví zbytek (`skipped`); oprav a pošli nový soubor s novým id (starý nepřepisuj).
12. Zápisy vracejí `guid` + `id` — pamatuj si je, v rámci dávky řetěz přes `$N`.
12b. **Warningy čti jako chyby.** `status: "ok"` + `warnings` = zapsáno, ale **část záměru se nepropsala** (`scenarios[1]: join 'BE95002' neni cislo kroku …`). Chat ACK nese počet + první warning v prvním řádku a pod ním výpis po operacích; přeteče-li rozpočet, ACK to řekne ukazatelem na `res-<id>.json` — jen tehdy (doložená výjimka) si plný výčet vyžádej. Řeš opravnou dávkou dle textu warningu, nikdy přeposláním — GUIDy pro opravu jsou přímo v ACK (u `constraints`/`requirements` položky GUIDy nemají — rebuild kompletní sady na element GUID).
12c. **Dřívější „dvě tiché pasti" jsou od v0.12 vyřešené a jejich popis byl chybný** (§6i): (a) **`join` = ČÍSLO KROKU hostitelského scénáře** (`"End"` / vynechané = větev končí) — EA návrat na krok umí, dřívější tvrzení „join = jméno scénáře, EA to neumí" **neplatí**; jméno scénáře v `join` teď vrátí warning; (b) **přesun elementu mezi packages dělá operace `move_elements`** (vždy ELEVATED) — `package` v update větvi `create_or_update_elements` element nepřesouvá a nově o tom vrací **warning** místo falešného OK. `PackageID` po zápisu i tak kontroluj zpětným čtením.
13. **Retry po chybě — NIKDY slepé přeposlání téže dávky.** Rollback neexistuje; chybová odpověď nese GUIDy dosud vytvořených položek (`items`) — korektní retry = opravná dávka adresující tyto GUIDy. Výjimka: položky s `matchByName`/`match: "composite"`/`dedupKey` a zprávy s `rebuild: true` jsou idempotentní — přeposlání beze změny je bezpečné (2. běh `created: false` + `matchedBy`). `E_AMBIGUOUS` = víc kandidátů, odpověď nese `guids`.
14. **Nepoužívej terminál** — vše přes soubory.
15. **Zakázané kategorie dat (interní politika banky pro AI).** Do dávek, `query` SQL ani do promptů **nikdy** nepatří: přístupové údaje (hesla, tokeny, certifikáty), mzdové údaje, karetní údaje, zvláštní kategorie osobních údajů (rasový/etnický původ, politické názory, náboženské vyznání, filozofické přesvědčení, členství v odborech, zdravotní stav, sexuální život/orientace) ani genetické a biometrické údaje — narazíš-li na ně v modelu, **nečti je a ohlas to**. Strop klasifikace = **Confidential**: obsah `strictly confidential` je **absolutně vyloučen z kontextového okna GitHub Copilota** (prompt, kontext, přílohy) — při pochybnosti o klasifikaci obsah nezpracuj a zeptej se. (Samotný login je identifikátor, ne přístupový údaj.)

## Chybové kódy a stavy

Stav `confirm_required` (není chyba — dávka čeká na potvrzení, viz pravidlo 6). Kódy: `E_PARSE`, `E_REPO` (nic se neprovedlo), `E_OP_FORBIDDEN` (whitelist operací), `E_ADDIN_ACCESS` (uživatel nemá write přístup k bridge — EA security skupiny; čtecí operace fungují; ohlas uživateli, ať požádá správce EA o zařazení do write skupiny — nic neobcházej), `E_RISK_BLOCKED` (Risk Gate — tvrdý stop, žádný override; ohlas uživateli), `E_RISK_CONFIRM` (potvrzovací pole v dávce / neplatné potvrzení — nikdy je tam nedávej), `E_RISK_REJECTED` (uživatel dávku zamítl), `E_RISK_INTEGRITY` (obsah dávky se změnil mezi klasifikací a potvrzením), `E_AMBIGUOUS` (match/dedupKey — víc kandidátů, `guids` v odpovědi), `E_PERMISSION` (EA security nepustila zápis do balíčku — uživatel požádá správce o práva k balíčku), `E_LOCKED` (prvek/balíček zamčený), `E_UNKNOWN_OP`, `E_ARGS`, `E_SQL_READONLY`, `E_WHITELIST`, `E_NOT_FOUND`, `E_EXCEPTION`, `E_NO_EXECUTOR`. `E_QUOTA` se od v0.8 nevydává (kvótu klonů kryje ELEVATED potvrzení).
