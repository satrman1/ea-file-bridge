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
- **Zápisové**: `create_or_update_elements` (vč. K7 změny typu, K8 isComposite/compositeDiagram, K6 author/version; **idempotence B2: `matchByName: true`** = před create najdi dle jména/aliasu v cílovém package/parentu → update, **`dedupKey`** = stabilní klíč → TV `ai.dedup`, přežije přejmenování), `create_or_update_package` (**`matchByName: true`** scoped na parent), `create_or_update_connectors` (**`match: "composite"`** = lookup dle source+target+type+stereotyp → update, **`dedupKey`** jako u elementů), `create_or_update_attributes`, `create_or_update_operations`, `create_or_update_messages` (**`rebuild: true`** = server-side V2d: smaže zprávy diagramu + postaví znovu; vyžaduje `diagram` + explicitní `seqNo`, zprávy bez guid/connectorID; odpověď nese `removed`), `create_baseline` (pojmenovaná), `create_or_update_diagram` (create v `package` nebo pod `owningElement`, `type` i MDG „Technologie::Typ", update přes `diagram`), `place_elements_on_diagram` (`elementPlacements`: `elementID`, `x`, `y`, `width`, `height`; bez souřadnic auto-mřížka; konektory se vykreslí samy — viz `connectorsOnDiagram` v odpovědi), `update_diagram_properties`, `set_diagram_object_style`, `layout_connectors`, `change_connector_visibility`, `import_element_linked_documents`, `remove_elements_from_diagram`, `delete_from_model`, `delete_taggedvalue_from_model`, `clone_package`, `clone_elements`, `create_or_update_scenarios` (`element` + `scenarios[{name, type: Basic Path|Alternate|Exception, steps[{text, kind: actor|system, uses, results, state}], attachTo{scenario, step}, join}]` — deterministický rebuild: nahradí VŠECHNY scénáře elementu), `apply_classifier_stereotypes` (`diagram`, filtr `elementIDs` — dorovná Type+stereotyp instancí dle classifiera, idempotentní), `find_or_create_referencing_sr` (`operation`, `packageName` `<Operace>_ARELYYMM`, volitelně `targetPackage` — katalog-first SR scaffold; šablony viz `FB_ScaffoldConfig`).
- **Dev only (zde povoleno)**: `deploy_src` — po úpravě `src/AICodeBridge.*.js` nasadí kód do modelu (`{"op":"deploy_src","only":["FB_Nazev"]}`); pumpa se sama přenačte **až po doběhnutí dávky** — nový kód používej až v následující dávce. Kód pro EA runtime (menu/GUI fallback) vyžaduje navíc restart EA. **V bance se deploy_src nikdy nenavrhuje (deny).**

## `$N` reference — řetězení v dávce

`"$0"` = guid výsledku 0, `"$0.id"` = id, `"$1[2]"` / `"$1[2].id"` = položka `items[2]` výsledku 1. Funguje v celém objektu operace (targets, elements, taggedValues.ids). Do SQL řetězce `$N` vložit nejde.

## Pravidla (závazná)

1. **`repo` je povinné** a v tomto workspace vždy `"EAExample.qea"`.
2. **První dávka session = samotný `ping`** — zkontroluj `"protocol": "eafb/0.2"` a `repository` obsahuje `EAExample.qea`.
3. **Notes plain text** (`notes`); `notes_b64` nepoužívej.
4. **SQL**: jen SELECT/WITH; dialekt zde = **SQLite** (v bance MS SQL 2022).
5. **Zápis jen do větve `#FB-TEST`** = `{CCD344F6-9EAA-44eb-BAA4-4952E48526B7}` (whitelist vynucuje executor; `E_WHITELIST`/`E_REPO`/`E_OP_FORBIDDEN` neobcházej).
6. **`clone_*` nad 100 elementů** vrátí `E_QUOTA` — `confirm: true` pošli jen po výslovném potvrzení uživatelem.
7. **Před zápisem do existujícího obsahu** `create_baseline` (pojmenovaná `AI-pre-<session>-<batch>`); výsledek ověř zpětným čtením nebo `baseline_diff`.
8. **Stop-on-error**: první chyba zastaví zbytek (`skipped`); oprav a pošli nový soubor s novým id (starý nepřepisuj).
9. Zápisy vracejí `guid` + `id` — pamatuj si je, v rámci dávky řetěz přes `$N`.
10. **Retry po chybě — NIKDY slepé přeposlání téže dávky.** Rollback neexistuje; chybová odpověď nese GUIDy dosud vytvořených položek (`items`) — korektní retry = opravná dávka adresující tyto GUIDy. Výjimka: položky s `matchByName`/`match: "composite"`/`dedupKey` a zprávy s `rebuild: true` jsou idempotentní — přeposlání beze změny je bezpečné (2. běh `created: false` + `matchedBy`). `E_AMBIGUOUS` = víc kandidátů, odpověď nese `guids`.
11. **Nepoužívej terminál** — vše přes soubory.

## Chybové kódy

`E_PARSE`, `E_REPO` (nic se neprovedlo), `E_OP_FORBIDDEN` (whitelist operací), `E_QUOTA` (kvóta klonování), `E_AMBIGUOUS` (match/dedupKey — víc kandidátů, `guids` v odpovědi), `E_UNKNOWN_OP`, `E_ARGS`, `E_SQL_READONLY`, `E_WHITELIST`, `E_NOT_FOUND`, `E_EXCEPTION`, `E_NO_EXECUTOR`.
