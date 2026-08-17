# Copilot instructions — EA File Bridge (eafb/0.2)

> Nasazení: obsah vložit do `.github/copilot-instructions.md` ve VS Code workspace na cílové stanici (nebo přiložit jako kontext). Laděno pro Claude rodinu (bankovní default Claude Opus 4.8). Placeholder `<TEST-DB>` nahraď skutečným názvem testovací databáze při nasazení.

---

Pracuješ s Enterprise Architect přes **EA File Bridge**: souborový protokol místo přímého API. Nemáš žádný jiný způsob, jak s EA mluvit.

## Jak to funguje

1. Request = JSON soubor, který **zapíšeš** do složky `requests/` (jméno `req-<krátké-id>.json`, id unikátní v rámci dne).
2. Běžící pumpa ho do ~2 s zpracuje a **zapíše odpověď** do `responses/res-<stejné-id>.json`. (Bez pumpy umí dávky zpracovat i uživatel klikem v EA: Specialize → AI Bridge → Process requests (File Bridge) — o to ale musíš požádat.)
3. Odpověď **přečti a interpretuj**. Pokud do ~10 s neexistuje, počkej a zkus číst znovu (max ~30 s, pak ohlas problém uživateli — pumpa zřejmě neběží).

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

**Čtecí** (povolené vždy): `ping`, `query` (SQL jen SELECT/WITH), `find_elements_by_name`, `find_packages_by_name`, `get_elements_information`, `get_packages_information`, `get_connectors_information`, `get_diagrams_information` (vč. zpráv sekvenčního diagramu), `get_baselines`, `baseline_diff`, `export_element_linked_documents`, `open_diagrams`, `reload_diagrams`, `get_diagram_image` (PNG se uloží do `responses/images/`, cesta v odpovědi; `inline: true` přidá base64 — po čerstvém zápisu na diagram nejdřív `reload_diagrams`).

**Zápisové** (podléhají whitelistu operací i packages): `create_or_update_elements` (vč. změny typu přes `elementID`+`type`, `isComposite`+`compositeDiagram`, `author`/`version`), `create_or_update_package`, `create_or_update_connectors`, `create_or_update_attributes`, `create_or_update_operations` (pole `parameters` = kompletní rebuild parametrů), `create_or_update_messages` (sekvenční zprávy: `source`, `target`, `name`|`operation`, `isReturn`, `isAsynchronous`, `arguments`, `returnValue`, `seqNo`), `create_baseline` (pojmenovaná; před zápisem do existujícího package), `update_diagram_properties`, `set_diagram_object_style`, `layout_connectors` (styly direct/auto/custom/treeV/treeH/lateralV/lateralH/orthS/orthR), `change_connector_visibility`, `import_element_linked_documents`, `remove_elements_from_diagram` (jen z diagramu, model nedotčen), `delete_from_model` (typy Package/Diagram/Element/Connector/Attribute/Operation/Parameter), `delete_taggedvalue_from_model`, `clone_package`, `clone_elements`, `create_or_update_diagram` (create v package přes `package` nebo pod elementem přes `owningElement`; `type` i MDG kvalifikovaný „Technologie::Typ"; update přes `diagram`), `place_elements_on_diagram` (`elementPlacements` s `elementID`, `x`, `y`, `width`, `height`; bez souřadnic auto-mřížka; konektory mezi umístěnými elementy se vykreslí samy — odpověď je vykazuje v `connectorsOnDiagram`), `create_or_update_scenarios` (strukturované scénáře use case: `element` + `scenarios` s `name`, `type` „Basic Path"/„Alternate"/„Exception", `steps` s `text` + `kind` „actor"/„system" + `uses`/`results`/`state`; větev připneš na krok přes `attachTo: {scenario, step}` a `join`; zápis vždy NAHRADÍ všechny scénáře elementu — posílej kompletní sadu), `apply_classifier_stereotypes` (`diagram` + volitelný filtr `elementIDs`; instancím s classifierem dorovná typ a stereotyp podle classifiera — použij po zápisu lifelin na sekvenční diagram), `find_or_create_referencing_sr` (`operation` + `packageName` dle konvence `<Operace>_ARELYYMM`; najde Service Realizaci odkazující na operaci katalogu, nebo založí standardní strukturu — service package, version diagram, SR, Impact View, DTO, Req/Res, vazby; když vrátí `found: true`, struktura existuje a NIC se nezaložilo).

**Nepoužívej**: `deploy_src` (vývojová operace na dev stanici — v bance je zakázaná whitelistem a nikdy ji nenavrhuj). Neexistuje `apply_baseline` (obnovu z baseline dělá výhradně člověk v EA) ani `find_element_in_diagrams` (použij `query` nad `t_diagramobjects`).

## `$N` reference — řetězení v dávce

Místo GUIDu můžeš v kterémkoli poli odkázat na výsledek dřívější operace téže dávky: `"$0"` = guid výsledku 0, `"$0.id"` = jeho id, `"$1[2]"` = guid položky `items[2]` výsledku 1, `"$1[2].id"` = její id. Funguje i uvnitř `targets`, `elements`, `taggedValues.ids`. Do SQL řetězce `$N` vložit nejde — tam patří skutečné hodnoty z předchozích odpovědí.

## Pravidla (závazná)

1. **`repo` je povinné** — deklaruje cílový repozitář **názvem databáze** (hodnotu ti řekne uživatel na začátku práce). Chrání proti zpracování dávky ve špatném repozitáři.
2. **První dávka session = samotný `ping`.** Z odpovědi zkontroluj `"protocol": "eafb/0.2"` a pole `repository` (název databáze musí odpovídat). Nesedí-li, zastav se a ohlas to uživateli.
3. **Notes posílej jako obyčejný text** v poli `notes` (JSON escapování stačí — diakritiku i tabulátory protokol zvládá). `notes_b64` nepoužívej.
4. **SQL**: jen SELECT/WITH. Dialekt = dialekt repozitáře: bankovní repozitář = **MS SQL 2022**.
5. **Zápis jen do vyhrazeného package** (whitelist vynucuje executor). `E_WHITELIST`/`E_REPO`/`E_OP_FORBIDDEN` neobcházej — ohlas uživateli.
6. **Mazání a klonování**: `delete_*`/`clone_*` mohou být v daném prostředí vypnuté (`E_OP_FORBIDDEN`) — pak navrhni uživateli ruční postup, nezkoušej obejít. `clone_*` nad 100 elementů vrátí `E_QUOTA` — pošli znovu s `confirm: true` **jen po výslovném potvrzení uživatelem**.
7. **Před zápisem do existujícího obsahu** udělej `create_baseline` dotčeného package (pojmenovaná `AI-pre-<session>-<batch>`); po větším zápisu zkontroluj výsledek zpětným čtením (`get_*`) nebo `baseline_diff`.
8. Dávka běží **stop-on-error**: první chyba zastaví zbytek (`skipped`). Po chybě přečti `code` + `message`, oprav request a pošli nový soubor s novým id (starý nikdy nepřepisuj).
9. Odpověď `status:"done"` + `results` v pořadí operací; zápisy vracejí `guid` a `id` — **GUIDy si pamatuj a používej v dalších dávkách** (nebo řetěz `$N` v rámci dávky).
10. **Nepoužívej terminál.** Celá práce jde přes soubory (zápis requestu, čtení response) — žádné příkazy, nic ke schvalování uživatelem. Na response čekej opakovaným čtením složky `responses/`.

## Chybové kódy

`E_PARSE` (nevalidní JSON), `E_REPO` (špatný repozitář — nic se neprovedlo), `E_OP_FORBIDDEN` (operace není povolena whitelistem operací), `E_QUOTA` (objem klonování nad kvótou — nutné potvrzení uživatele), `E_UNKNOWN_OP`, `E_ARGS`, `E_SQL_READONLY`, `E_WHITELIST`, `E_NOT_FOUND`, `E_EXCEPTION`, `E_NO_EXECUTOR` (pumpa bez kódu — ohlas uživateli).

## Příklad úkolu

Uživatel: „Založ komponentu Objednavky s operací VytvorObjednavku a naznač volání v sekvenčním diagramu X."

1. `req-a.json`: `ping` (kontrola protokolu a repozitáře)
2. `req-b.json`: `query` na GUID cílového package + diagramu X
3. `req-c.json`: `create_baseline` (package) + `create_or_update_elements` (komponenta) + `create_or_update_operations` (`element: "$1[0]"`) + `create_or_update_messages` (`operation: "$2.id"`)
4. Shrň uživateli: GUIDy, id, případné chyby.
