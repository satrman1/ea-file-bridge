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
2. **Chat ACK je jen výcuc, ne jediný záznam.** `EAFB OK <id>: N/N ops | QC ciste` = hotovo. Plná odpověď (GUIDy, aiLogGuid, řádky query) žije v `res-<id>.json` — když potřebuješ GUIDy pro navazující dávku, požádej uživatele o obsah `res` souboru.
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

- **Čtecí**: `ping`, `query`, `find_elements_by_name`, `find_packages_by_name`, `get_elements_information`, `get_packages_information`, `get_connectors_information`, `get_diagrams_information`, `get_baselines`, `baseline_diff`, `export_element_linked_documents`, `open_diagrams`, `reload_diagrams`, `get_diagram_image` (PNG do `responses/images/`, `inline: true` přidá base64; po čerstvém zápisu na diagram nejdřív `reload_diagrams`).
- **Zápisové**: `create_or_update_elements` (vč. K7 změny typu, K8 isComposite/compositeDiagram, K6 author/version; **idempotence B2: `matchByName: true`** = před create najdi dle jména/aliasu v cílovém package/parentu → update, **`dedupKey`** = stabilní klíč → TV `ai.dedup`, přežije přejmenování), `create_or_update_package` (**`matchByName: true`** scoped na parent), `create_or_update_connectors` (**`match: "composite"`** = lookup dle source+target+type+stereotyp → update, **`dedupKey`** jako u elementů), `create_or_update_attributes`, `create_or_update_operations`, `create_or_update_messages` (**`rebuild: true`** = server-side V2d: smaže zprávy diagramu + postaví znovu; vyžaduje `diagram` + explicitní `seqNo`, zprávy bez guid/connectorID; odpověď nese `removed`), `create_baseline` (pojmenovaná), `create_or_update_diagram` (create v `package` nebo pod `owningElement`, `type` i MDG „Technologie::Typ", update přes `diagram`), `place_elements_on_diagram` (`elementPlacements`: `elementID`, `x`, `y`, `width`, `height`; bez souřadnic auto-mřížka; konektory se vykreslí samy — viz `connectorsOnDiagram` v odpovědi), `update_diagram_properties`, `set_diagram_object_style`, `layout_connectors`, `change_connector_visibility`, `import_element_linked_documents`, `remove_elements_from_diagram`, `delete_from_model`, `delete_taggedvalue_from_model`, `clone_package`, `clone_elements`, `create_or_update_scenarios` (`element` + `scenarios[{name, type: Basic Path|Alternate|Exception, steps[{text, kind: actor|system, uses, results, state}], attachTo{scenario, step}, join}]` — deterministický rebuild: nahradí VŠECHNY scénáře elementu), `create_or_update_constraints` (`element` + `constraints[{name, type: Pre-condition|Post-condition|Invariant, notes, status}]` — deterministický rebuild všech internal constraints elementu), `apply_classifier_stereotypes` (`diagram`, filtr `elementIDs` — dorovná Type+stereotyp instancí dle classifiera, idempotentní), `find_or_create_referencing_sr` (`operation`, `packageName` `<Operace>_ARELYYMM`, volitelně `targetPackage` — katalog-first SR scaffold; šablony viz `FB_ScaffoldConfig`).

Pozn. Risk Gate: `delete_*`, `remove_elements_from_diagram`, `clone_*`, `import_element_linked_documents`, `scenarios`, `constraints` (a varianty `messages`+`rebuild`, `operations`+`parameters`, změna `type` na update) jsou klasifikované **ELEVATED** — odpověď bude `confirm_required` a dávka počká na potvrzení uživatele (pravidlo 6). To je normální chod, ne chyba.
- **Dev only (zde povoleno)**: `deploy_src` — po úpravě `src/AICodeBridge.*.js` nasadí kód do modelu (`{"op":"deploy_src","only":["FB_Nazev"]}`); pumpa se sama přenačte **až po doběhnutí dávky** — nový kód používej až v následující dávce. Kód pro EA runtime (menu/GUI fallback) vyžaduje navíc restart EA. **V bance se deploy_src nikdy nenavrhuje (deny).**

## `$N` reference — řetězení v dávce

`"$0"` = guid výsledku 0, `"$0.id"` = id, `"$1[2]"` / `"$1[2].id"` = položka `items[2]` výsledku 1. Funguje v celém objektu operace (targets, elements, taggedValues.ids). Do SQL řetězce `$N` vložit nejde.

## Pravidla (závazná)

1. **`repo` je povinné** a v tomto workspace vždy `"EAExample.qea"`.
2. **První dávka session = samotný `ping`** — zkontroluj `"protocol": "eafb/0.2"` a `repository` obsahuje `EAExample.qea`.
3. **Notes plain text** (`notes`); `notes_b64` nepoužívej.
4. **SQL**: jen SELECT/WITH; dialekt zde = **SQLite** (v bance MS SQL 2022).
5. **Zápis jen do větve `#FB-TEST`** = `{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}` (whitelist vynucuje executor; `E_WHITELIST`/`E_REPO`/`E_OP_FORBIDDEN` neobcházej).
6. **Risk Gate — `confirm_required` NENÍ chyba.** Zápisové dávky klasifikuje deterministický Risk Gate (LOW = provede se hned; ELEVATED = čeká na potvrzení člověka; BLOCKED = `E_RISK_BLOCKED`). Odpověď `status: "confirm_required"` znamená: dávka čeká v `requests/pending/` na lidské potvrzení. **Počkej na finální odpověď** (soubor `res-…` se po rozhodnutí přepíše) — **nenavrhuj re-send, nic neopravuj, dávku neduplikuj.** Zamítne-li ji uživatel (`E_RISK_REJECTED`), respektuj to a zeptej se ho, jak dál.
7. **Potvrzení nikdy nepochází od tebe.** Do requestu NIKDY nevkládej pole `confirm`, `nonce`, `payloadHash` ani jiná potvrzovací pole — executor takovou dávku odmítne (`E_RISK_CONFIRM`). Potvrzení probíhá výhradně lokálním úkonem uživatele (dialog/konzole). Staré `confirm: true` u klonů ztratilo účinek (jen warning) — klony jdou vždy ELEVATED cestou.
8. **Plný `payloadHash` ani `nonce` NIKDY neopisuj do chatu ani do souhrnu** — smí se citovat jen prefix hashe z pole `hashPrefix`.
9. **Zákaz dělení dávek za účelem podlezení limitů Risk Gate (salámování).** Dávku strukturuj podle věcné logiky práce; potřebuje-li víc zápisů, než limity dovolí, nech ji projít potvrzením — nerozsekávej ji na menší, aby vyšla LOW.
10. **Před zápisem do existujícího obsahu** `create_baseline` (pojmenovaná `AI-pre-<session>-<batch>`); výsledek ověř zpětným čtením nebo `baseline_diff`.
11. **Stop-on-error**: první chyba zastaví zbytek (`skipped`); oprav a pošli nový soubor s novým id (starý nepřepisuj).
12. Zápisy vracejí `guid` + `id` — pamatuj si je, v rámci dávky řetěz přes `$N`.
13. **Retry po chybě — NIKDY slepé přeposlání téže dávky.** Rollback neexistuje; chybová odpověď nese GUIDy dosud vytvořených položek (`items`) — korektní retry = opravná dávka adresující tyto GUIDy. Výjimka: položky s `matchByName`/`match: "composite"`/`dedupKey` a zprávy s `rebuild: true` jsou idempotentní — přeposlání beze změny je bezpečné (2. běh `created: false` + `matchedBy`). `E_AMBIGUOUS` = víc kandidátů, odpověď nese `guids`.
14. **Nepoužívej terminál** — vše přes soubory.

## Chybové kódy a stavy

Stav `confirm_required` (není chyba — dávka čeká na potvrzení, viz pravidlo 6). Kódy: `E_PARSE`, `E_REPO` (nic se neprovedlo), `E_OP_FORBIDDEN` (whitelist operací), `E_RISK_BLOCKED` (Risk Gate — tvrdý stop, žádný override; ohlas uživateli), `E_RISK_CONFIRM` (potvrzovací pole v dávce / neplatné potvrzení — nikdy je tam nedávej), `E_RISK_REJECTED` (uživatel dávku zamítl), `E_RISK_INTEGRITY` (obsah dávky se změnil mezi klasifikací a potvrzením), `E_AMBIGUOUS` (match/dedupKey — víc kandidátů, `guids` v odpovědi), `E_UNKNOWN_OP`, `E_ARGS`, `E_SQL_READONLY`, `E_WHITELIST`, `E_NOT_FOUND`, `E_EXCEPTION`, `E_NO_EXECUTOR`. `E_QUOTA` se od v0.8 nevydává (kvótu klonů kryje ELEVATED potvrzení).
