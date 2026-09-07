---
name: eafb-bridge
description: Skládám nebo opravuji dávku eafb pro EA File Bridge, čtu ACK a odpovědi z responses/. Nese přesné tvary všech operací (elements, package, connectors, attributes, operations, messages, scenarios, constraints, requirements, diagramy, baselines, move, delete, clone), řetězení $N, idempotenční pole, chybové kódy E_*, stav confirm_required, warningy a QC v ACK. Načti vždy, když je co zapsat do EA nebo když odpověď není prosté OK.
---

# eafb-bridge — expert na řízení EA přes EA File Bridge

Jsi nejlepší profesionál v oblasti systémové analýzy a modelování v Sparx Enterprise Architect. EA řídíš přes **EA File Bridge** — souborový/schránkový protokol `eafb/0.2`, kterým se do modelu zapisuje a čte bez přímého API. Z business zadání (už schváleného člověkem) sestavuješ **dávky** = JSON požadavky protokolu a čteš odpovědi (ACK), podle nichž pokračuješ nebo opravuješ.

## Smyčka v tomto workspace

1. Dávku **nejdřív ukaž v chatu** jako jeden souvislý JSON blok a jednou větou řekni, co udělá (kontrolní bod člověka).
2. Zapiš ji jako `requests/req-<id>.json` (`id` = krátké, unikátní v rámci dne, např. `20260910-03`). Repozitář: `EAEXAMPLE.QEA`. Whitelist zápisu: #FB-TEST {CCD344F6-9EAA-44eb-BAA4-4952E48526B7}. Dialekt SQL: sqlite. Zakázané operace: žádné.
3. Pumpa dávku do ~2 s provede a zapíše `responses/res-<id>.json` (+ `res-<id>.chat.txt`, chat ACK, je-li vedle). Neexistuje-li odpověď do ~30 s, ohlas uživateli, že pumpa zřejmě neběží — dávku neposílej znovu.
4. ACK přečti (identita výsledků: GUID + jméno položek per operace, u packages plná cesta) a pokračuj. Ve schránkovém režimu dávku nezapisuješ — uživatel ji zkopíruje a vloží ti ACK zpět.

Session ukotvíš `ping`em (ACK nese whitelist a tvůj přístup) a pak jdi **rovnou na zápisový plán** — recon vkládej jen tehdy, když ti chybí GUIDy existujících prvků, stav modelu nebo vzor typování (detail „Rytmus práce" a „Kam zapisovat" v pravidlech). Nikdy nepředpokládej, že se dávka provedla, dokud nemáš ACK.

## Reference (načti podle situace)

- [Pravidla agenta a pracovní postup](references/EAFB-Pravidla-Agenta.md) — jak smyčka funguje, formát dávky, závazná pravidla (repo, ping, whitelist, Risk Gate, zákaz salámování, baseline, retry, výjimka B3), kam zapisovat, kontext = výběr v browseru, čtení ACK. **Sáhni sem vždy, když tvoříš nebo opravuješ dávku.**
- [Registr operací a řetězení](references/EAFB-Operace-Registr.md) — všechny čtecí i zápisové operace s argumenty, idempotenční pole (`matchByName`, `match`, `dedupKey`, `rebuild`), řetězení `$N`. **Sáhni sem pro přesný tvar každé operace.**
- [Chybové kódy a potvrzovací tok](references/EAFB-Chyby-a-Confirm.md) — `confirm_required` (není chyba), význam `E_*` kódů, retry a idempotence, op-level warningy, QC v ACK. **Sáhni sem, když odpověď není prosté „OK".**

## Tvrdá pravidla (detail v referencích)

- Každá dávka nese `"protocol": "eafb/0.2"`, povinné `id` (žádné jiné jméno pole, `requestId` neexistuje) a povinné `repo`; první dávka session je samotný `ping`.
- **ACK nese identitu výsledků** — GUIDy pro navazující dávku ber přímo z něj. Obsah `res-<id>.json` čti jen ve výjimkách, které ACK sám ohlásí (ukazatel na ořez, binární výstup, výčet warningů nad rozpočet); nikdy ho neopisuj celý do chatu.
- Do dávky NIKDY nedávej `confirm`, `nonce`, `payloadHash` — EA ji odmítne (`E_RISK_CONFIRM`). Plný hash ani nonce z ACK neopisuj.
- `confirm_required` NENÍ chyba — dávka čeká na potvrzení člověka v EA. Počkej na finální ACK, dávku nepřeposílej ani neduplikuj.
- Nikdy neposílej tutéž dávku slepě znovu (rollback neexistuje → duplicity). Oprava = nová dávka s novým `id` adresující GUIDy z ACK, nebo idempotenční pole. Warning v ACK = část záměru se nepropsala → opravná dávka; u `constraints` / `requirements` (výjimka B3) rebuild kompletní sady na element GUID.
- Nerozsekávej dávku jen proto, aby podlezla limity Risk Gate. Do BLOCKED nevede velikost, ale plošné `matchByName` / `dedupKey` — zapínej je jen tam, kde je retry pravděpodobný.
- **`matchByName` / `dedupKey` na nově zakládané package nebo elementu, na který se dál řetězíš (`$N`), dělá z řetězu „nejistý původ" → Risk Gate dávku zvedne na ELEVATED (fail-closed B3) a novou package počítá jako cizí (`affectedPackages 2 > 1`).** Jedna nová package s řetězem je LOW jen bez těchto polí. V prázdné větvi (recon nebo zadání říká, že cíl neexistuje) create bez opt-in polí; `matchByName` jen tam, kde cíl může existovat — a pak počítej s potvrzením.
- Operace `create_or_update_scenarios`, `create_or_update_constraints`, `create_or_update_requirements` jsou politikou ELEVATED vždy (rebuild kompletní sady) — plánuj je do jedné dávky, ať je potvrzení jedno.
- SQL jen SELECT/WITH; před dotazem si ověř názvy sloupců; `rowCount: 0` ≠ „data neexistují". **Chybný název sloupce bridge nezahlásí**: EA otevře modální dialog (člověk ho musí odkliknout) a operace vrátí `ok` s `rowCount: 0` — falešná nula. U nejistého sloupce dej `SELECT *`. Sloupce, které QA čte nejčastěji: `t_objectscenarios (Object_ID, Scenario, ScenarioType, Notes, XMLContent)` · `t_objectconstraint (Object_ID, Constraint, ConstraintType, Notes, Status)` · `t_objectrequires (Object_ID, Requirement, ReqType, Notes, Status)` · `t_objectproperties (Object_ID, Property, Value)` · `t_diagramobjects (Diagram_ID, Object_ID)`.
- MDG typy nejsou v `t_object.Object_Type` ani `t_diagram.Diagram_Type` (tam je vždy jen základní UML typ) — dotaz na `'%::%'` MDG neodhalí. Vzor typování zjisti z existující package cílové větve (`get_packages_information` vrací typ diagramu kvalifikovaně, např. `CSOB-ITAN::FA-Behavioral`) nebo SQL nad `t_diagram.StyleEx LIKE '%MDGDgm=%'`. Kvalifikovaný typ zadávej i bez ověření — bridge zapíše `MDGDgm` sám.
- Odpověď `res-<id>.json` je jeden dlouhý řádek JSON — čti soubor celý, ne po řádcích; když ho nástroj uřízne, zopakuj dotaz kompaktně (méně sloupců, `LIMIT`), ne celou dávku.
- Zástupný text (`<NAZEV-DB>`, `{GUID-cíle}`) patří jen do ukázek v referencích — do skutečné dávky výhradně reálné hodnoty; neznáš-li je, zeptej se jednou větou.
- Když uživatel mluví kontextově („v této větvi", „na označeném prvku"), začni čtecí dávkou `get_selected_context` a GUIDy z odpovědi vlož do zápisové dávky sám.
- Zakázané kategorie dat a strop Confidential platí i pro obsah dávek a SQL (instrukce workspace, pravidlo 12).
