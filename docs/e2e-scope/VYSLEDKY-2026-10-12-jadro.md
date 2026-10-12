# Výsledky — cíl zápisu, stavba jádra (režim blacklist) — 2026-10-12

Vlákno **Z261004b-10** (dávka `IT-ANALYSIS/zaprah-vlaken-2026-10-04b.md`) · repo `C:\GIT\ea-file-bridge` · kód **v0.17 (jádro cíle zápisu)** = commit `6a6cdce` nad `00a5fb9` (B1) · zadání `IT-ANALYSIS/ZADANI-cil-zapisu-ea-file-bridge.md` **v1.1** (rozhodnutí 11. 10.: O1 = b bez režimu whitelist, O2 = b security se nekontroluje, O3 = a `allowIncomingRefs` default true, O4 = a, O5 = a kořen = ochrana uzlu, O7 = b bez autoZone, O10 = b bez spiku zámku, O11 = c vazba z chráněného zdroje do volného cíle povolena).

**Souhrn:** harness **513/513** (z toho 36 nových testů bloku CIL ZAPISU CZ-00a/00/01/02/02b/03/06/07 (tabulka všech 27 zápisových operací)/08/09/10/10b/11/12/14/15/16/17/18/21/28 + převedené testy `E_WHITELIST` → `E_BLACKLIST`; 477 → 513). `tools/diff-signatures.py v0.14 HEAD`: změněné signatury existujících operací **4** (`FB_ResolveEl`, `FB_ResolvePkg` +`mode`; `FB_RiskNote`, `FB_RiskAuditTags` +`baseline` z 20. 9.) — všechny nový parametr čtou přes `typeof`; nových souborů 25 (z tohoto vlákna 7: `FB_WriteScope`, `FB_WriteScopeCfg`, `FB_ScopeCheck`, `FB_ScopePrecheck`, `FB_CheckWriteEl`, `FB_ResolvePath`, `FB_ResolveFail`), smazaný 1 (`FB_Whitelist`). Registr operací 42 / 27 zápisových beze změny. **Živé ověření doma: QEAX 2026-10-11 22:39 – 2026-10-12 08:05 (30 dávek) + FB-CZ-22 10:17–10:22 (6 dávek), EAExample 08:08 – 08:30 (13 dávek) — vše dle očekávání**, tři zjištění mění zadání (kap. 3 body 2, 3 a 4). Push: Miloš 12. 10. 08:55, `origin/main` = `5d83ed8`.

## 1. Co se změnilo pro agenta (vstup pro kit — Z261004b-4)

| Situace | Dřív (v0.16, whitelist) | Teď (v0.17, blacklist) | Co má agent dělat |
|---|---|---|---|
| Kam se smí psát | jen do balíčků z `FB_Whitelist` (#AI-SANDBOX / #FB-TEST), jinak `E_WHITELIST` | **kamkoli, kam pustí EA security**, kromě chráněných větví: `FB_WriteScope.blacklist` (dědičně na podstrom) + implicitně balíček auditu (`FB_Config.auditPkg`) a balíček add-inu (element `AICodeBridge`) — oboje dědičně; kořeny modelu jen jako uzel (update/delete/clone kořene) | před prací přečíst `ping.writeScope` (seznam chráněných větví s cestami) a říct člověku, kam se psát nebude |
| Zápis do chráněné větve | `E_WHITELIST` při exekuci (po okně a záloze) | `E_BLACKLIST` v **předběžné kontrole P2** (před prvním zápisem, před oknem i zálohou, po kontrole přístupu), **auditováno** (`audit.aiLogGuid`), soubor dávky v `requests\rejected\`; `problems[] {op, path, code, message, branch{kind, guid, name, path, note, allowIncomingRefs}, target{kind, id, path}}` | dávku **neopakovat ani nedělit** — požádat člověka o jiný cíl (text chyby to říká) |
| Zamčený balíček (EA security) | — (whitelist nedovolil) | bridge to **nekontroluje** (O2 = b); EA vrátí `E_PERMISSION` při exekuci, dávka se zastaví, `items` + `partial: true` ukážou, co proběhlo (W3), záloha i QC proběhnou | číst `items`, nepokračovat „naslepo"; vazba **do** zamčeného balíčku projde (kap. 5 bod 7) |
| Vazby (`create_or_update_connectors`, messages) | kontrola jen na whitelist package | pravidlo přes **skutečné konce**: zdroj v chráněné části → `E_BLACKLIST` (create, update, delete — vazbu „vlastní" zdroj); cíl v chráněné části → projde (`allowIncomingRefs: true`, O3 = a), s `false` → `E_BLACKLIST`; vazba z chráněného zdroje do volného cíle projde (O11 = c) — platí i pro **nové konce** při přesměrování; `dedupKey`/`match: composite`/`matchByName` dohledané v chráněné části → `E_BLACKLIST` (P2 i při exekuci) | zdroj vazby volit ve volné části |
| Mazání (`delete_from_model`) | whitelist | cíl v chráněné části → `E_BLACKLIST` v P2; podstrom balíčku **obsahující** chráněnou větev → `E_BLACKLIST`; kořen → `E_ARGS`; **kaskády W2 při exekuci**: (a) příchozí vazba s chráněným zdrojem → `E_BLACKLIST` (EA by ji smazala), (b) prvek leží na chráněném diagramu → `E_BLACKLIST`, (c) prvek je klasifikátorem chráněné instance → **warning** (viz kap. 3 bod 2); vazba se maže podle zdroje | před mazáním volného prvku počítat s tím, že vazba z chráněné části ho „uzamkne" |
| Přesun (`move_elements`) | whitelist, strop 12 úrovní | cíl i zdroj mimo chráněnou část; podstrom přes SQL po úrovních (limit 60 úrovní / 5000 uzlů) | — |
| Klony (`clone_elements`, `clone_package`) | whitelist | **zdroj vždy** kontrolován (W5, O4 = a): zdroj v chráněné části nebo balíček obsahující chráněnou větev → `E_BLACKLIST`; klon kořene odmítnut | — |
| Adresování cestou | jen GUID/jméno/`$N` | `{ "path": ["Kořen", "Balíček", …], "from": "{GUID}" }` ve všech identifikačních polích (`package`, `parent`, `element`, `diagram`, `source`, `target`…); porovnání jmen přesné (JS, ne SQL LIKE); odpověď nese `resolved[] {op, path, ref, kind, guid, id, fullPath}` (FB-CZ-18) | při nejistotě jména používat cestu; z `resolved[]` převzít GUID |
| Nejednoznačné jméno | první nález (tichá chyba cíle) | zápis: `E_AMBIGUOUS` v P2 s `guids[]` + `candidates[{guid, path}]`; chybějící úroveň cesty: `E_NOT_FOUND` s `found` + `children[]`; **čtecí** operace berou první nález + `warnings[]` | zvolit kandidáta GUIDem nebo cestou |
| Jméno v zápisové dávce na prvek téže dávky | fungovalo (dohledání až při exekuci) | jména se dohledávají **v P2** před exekucí → prvek založený dřívější operací téže dávky jménem **nenajde** (`E_NOT_FOUND`) | odkazovat `$N` |
| Záloha před zápisem | nad whitelist balíčkem; `sessionBaseline: "auto"` nad celým sandboxem | vždy nad **konkrétním cílovým balíčkem** zápisu (B3; vazba podle zdrojového balíčku); chráněný cílový balíček se do zálohy nedostane (`protected` v úklidu); session baseline **vypnuta** (`auto` → `off` + varování, FB-CZ-25); rodič nad prahem → `parentOverThreshold` (dřív `parentOutOfWhitelist`), nápověda `baselineRoot` / společný předek v `E_NO_BASELINE` | — |
| Vadná konfigurace | nic | `E_SCOPE_CONFIG` pro všechny zápisové dávky (čtení běží): chybí klíč `blacklist`, GUID v modelu není („balíček jména X existuje s GUID Y — překlep?"), jméno nesedí, chybí `FB_Config.auditPkg`, balíček add-inu obsahuje cizí obsah/podbalíčky; `ping.writeScope.problems[]`, `FB_SessionStart` to vypíše na konzoli pumpy; **dávka složená jen z `deploy_src` konfigurací blokovaná není** (opravný kanál doma, kap. 3 bod 3) | říct člověku, co opravit (text chyby); nic nezkoušet |
| Ping | `whitelist[]` | `writeScope { mode: "blacklist", securityEnabled, repoKnown, blacklist[{guid, name, path, note, found, allowIncomingRefs}], implicit[{kind: audit/addin, guid, name, path}], problems[], warnings[] }`; chat ACK segment „zapis: blacklist (N chranenych vetvi …)" | — |
| Repozitář bez položky `FB_WriteScope` | `E_REPO` (whitelist) | `E_REPO` beze změny (bez auditu — může jít o cizí repozitář) | — |
| Nový balíček přímo pod kořenem modelu | okno (whitelist nedovolil) | **ELEVATED** s důvodem „Nový balíček … přímo pod kořenem modelu" (B4/Risk Gate) | počítat s oknem |

Nové kódy: `E_BLACKLIST`, `E_SCOPE_CONFIG`, `E_AMBIGUOUS` (P2); zrušený `E_WHITELIST`. Nová pole: `resolved[]`, `problems[].branch/target`, `candidates[]`, `guids[]`, `found`, `children[]`, `items` + `partial: true` při výjimce, `warnings[]` u delete (kaskády), `writeScope{}` v pingu, `protected` v úklidu záloh. Pumpa `pump.wsf`: `E_BLACKLIST` a `E_SCOPE_CONFIG` v seznamu kódů, které jdou do `rejected\`.

## 2. Živé ověření doma — co a jak dopadlo

Dávky `docs/e2e-scope/ready/req-Z10-*.json`, odpovědi `responses/res-Z10-*.json` (BOM UTF-8), GUIDy fixtur `ready/guids-qeax.json`. Model **QEAX** (`EA17_Yoga_QEA2.qeax`, security zapnutá, uživatel admin; fixtury `Groups.FBT-CHRANENE` {54223CC8-…} na blacklistu, `Groups.FBT-VOLNE`, `Groups.FBT-ZAMCENE` zámek skupiny).

| # | Dávka | Kritérium | Výsledek |
|---|---|---|---|
| 1 | Z10-00b-deploy, Z10-01-kontrola-parametru | FB-CZ-01 deploy | deploy 129 updated / 25 created / 4 params synced (`reloadCode`); kontrola parametrů A vs. model: 0 rozdílů (mimo `EA_*` handlery a osiřelou metodu `FB_Whitelist`, která v modelu zůstává bez souboru) |
| 2 | Z10-02-fixtures, Z10-03b-deploy-blacklist, Z10-04-ping | FB-CZ-01/18 | ping `writeScope.blacklist[0].found: true, path "Groups.FBT-CHRANENE"`, implicit: `Groups.…#AI-LOG` (audit), `EA Addins` (add-in); problems [] |
| 3 | Z10-05-volne | FB-CZ-21 | zápis do `FBT-VOLNE` (mimo bývalý sandbox): LOW, bez okna, `done` |
| 4 | Z10-06-zamcene | FB-CZ-21 (W3) | zápis do `FBT-ZAMCENE` (zámek skupiny): `E_PERMISSION` z EA při exekuci, `items` + `partial: true` (VOL-Prvek updated, VOL-PredZamkem created), záloha FB-AUTO nad `Groups.FBT-VOLNE`, QC proběhlo, audit |
| 5 | Z10-07-chranene (před deployem blacklistu: ELEVATED → zamítnuto „n"), Z10-07b-chranene | FB-CZ-05a/08 | `E_BLACKLIST` v P2 (cíl `FBT-CHRANENE` i `FBT-CHRANENE-SUB`), nic neprovedeno, žádné okno, žádná záloha, soubor v `rejected\`, audit `{97423B62-…}` |
| 6 | Z10-09-cesta | FB-CZ-18 | `package: {path: ["Groups","FBT-VOLNE"]}` → `done`, `resolved[]` s GUID a `fullPath` |
| 7 | Z10-09b-cesta-chranena | FB-CZ-18 | cesta do chráněné → `E_BLACKLIST` |
| 8 | Z10-09c-cesta-neni | FB-CZ-18 | neexistující úroveň → `E_NOT_FOUND` s `found` a `children[]` |
| 9 | Z10-10-jmeno | FB-CZ-17 | `package: "#AI-LOG"` (2× v modelu) → `E_AMBIGUOUS`, `candidates[]` 2 kandidáti s cestami, `guids[]` |
| 10 | Z10-10b-jmeno-cteni | FB-CZ-17 | čtení jménem → první nález + `warnings[]` |
| 11 | Z10-11-delete-predek | FB-CZ-14 | `delete_from_model` kořene `Groups` (předek chráněné větve) → `E_ARGS` (kořen); podstrom s chráněnou větví kryje harness CZ-14 |
| 12 | Z10-12-w2-smazat | W2 a/b | smazání volného `VOL-Smazat` (příchozí vazba z `CHR-Prvek`, leží na `CHR-Diagram`): okno Ano → při exekuci **`E_BLACKLIST`** „příchozí vazba má zdroj v chráněné části — EA by ji smazala s cílem", `items[0].deleted: false`, 0 z 1 |
| 13 | Z10-13-w2c-klasifikator | W2 c | smazání `VOL-Klasifikator` (klasifikátor chráněné `CHR-Instance`): `ok` + warning; **EA instanci v chráněné části nastavila `ClassifierID = 0`** (readback `get_elements_information`: `classifierID: 0`, dřív 3795) — viz kap. 3 bod 2 |
| 14 | Z10-14-vazby-ok | FB-CZ-12 | create `CHR-Prvek → VOL-Prvek2` (chráněný zdroj, volný cíl, O11 = c) `ok`; create `VOL-Prvek2 → CHR-SubPrvek` (příchozí do chráněné, O3 = a) `ok`; delete vazby `vol→chr` (zdroj volný) `ok`; záloha jen nad `FBT-VOLNE` |
| 15 | Z10-15-vazba-chr | FB-CZ-12 | update vazby `chr→vol` (chráněný zdroj) → `E_BLACKLIST` v P2 |
| 16 | Z10-16-move-chr | FB-CZ-13 | `move_elements` `VOL-Prvek2` → `FBT-CHRANENE` → `E_BLACKLIST` v P2 (`target.kind: package`) |
| 17 | Z10-17-klony | FB-CZ-15 (W5) | `clone_elements CHR-Prvek` + `clone_package FBT-CHRANENE` → `E_BLACKLIST`, **2 problémy v jedné odpovědi**, nic neprovedeno |
| 18 | Z10-18-diagram-ok | FB-CZ-16 | `place_elements_on_diagram` chráněného `CHR-SubPrvek` na volný `VOL-Diagram` → `ok` (diagram je cíl, prvek se nemění) |
| 19 | Z10-19-diagram-chr | FB-CZ-16 | `layout_connectors` na `CHR-Diagram` → `E_BLACKLIST` (`target.kind: diagram`) |
| 20 | Z10-21-cz22-zamek-cil, Z10-21b-cz22-zamek-zdroj | FB-CZ-22 (1. část) | `FBT-ZAMCENE` byl prázdný → vazba na **objekt zamčeného balíčku**: cíl zamčený → `ok` (LOW); **zdroj zamčený → také `ok`** |
| 20b | Z10-22-zamcene-prvek, Z10-23-cz22-do-zamku, Z10-23b-cz22-ze-zamku, Z10-23c-cz22-zamek-update, Z10-23d-cz22-zamek-delete, Z10-23e-readback | **FB-CZ-22 (2. část, 10:20)** | Miloš vložil `ZAM-Prvek` 3830 {AA1F87B9-…} do zamčeného `FBT-ZAMCENE`. Vazba volný `VOL-Prvek2` → `ZAM-Prvek` `ok`; vazba `ZAM-Prvek` → `VOL-Prvek2` **`ok`** (1869); update jména této vazby **`ok`**; smazání této vazby (okno Ano) **`ok`**, readback: 1869 pryč, 1868 zůstala. Ve stejné dávce update prvku `ZAM-Prvek` → **`E_LOCKED`** („Element locked“). Závěr: **zámek EA (skupinový zámek balíčku) přes Automation hlídá prvky (create `E_PERMISSION`, update `E_LOCKED`), ale vazby vůbec — ani zdroj, ani cíl, ani změnu či smazání.** Záloha před zápisem vznikla nad `Groups.FBT-ZAMCENE` (zamčený balíček baseline nebrání) |

Model **EAExample** (`EAExample.qea`, security vypnutá; krok 9e):

| # | Dávka | Kritérium | Výsledek |
|---|---|---|---|
| 21 | Z10-30-ping-ex, Z10-31-ex-struktura | — | starý kód (whitelist `#FB-TEST`); `AICodeBridge` ležel v `EA Addins` spolu s podbalíčky `#AI-CODE`, `#AI-LOG`, `#FB-TEST` → nová konfigurace by hlásila „balíček add-inu obsahuje cizí obsah" |
| 22 | (GUI) + Z10-32-ex-presun | B1 | nový balíček `Model Based Add-Ins.EA File Bridge` {EE3798D1-…}, `AICodeBridge` přesunut do něj (Move > Cut/Paste v browseru); `FB_Config.auditPkg` EAExample = `#AI-LOG` {8DF101C4-…} (místo TODO placeholderu) |
| 23 | Z10-33-ex-deploy, Z10-34-ex-ping | FB-CZ-01 | deploy 7 created / 4 params synced; ping `writeScope`: blacklist [], implicit audit `…EA Addins.#AI-LOG` + add-in `…EA File Bridge`, problems [] |
| 24 | Z10-35-ex-fixtures | — | `FBT-CHRANENE` {4B73153D-…954} a `FBT-VOLNE` {07475E42-…} přímo pod `Example Model` (ELEVATED „nový balíček pod kořenem", Ano), prvky CHR-Prvek / VOL-Prvek |
| 25 | Z10-36-ex-deploy-preklep, Z10-37b-ex-ping, Z10-37-ex-cz03 | **FB-CZ-03** | blacklist s GUID s překlepem (…955) nasazen: ping `problems[0]` „GUID … nenalezen; balíček jména 'FBT-CHRANENE' existuje s GUID {…954} — překlep?"; zápis do volného `FBT-VOLNE` → `E_SCOPE_CONFIG`, nic neprovedeno, audit |
| 26 | Z10-38-ex-deploy-oprava | FB-CZ-03 (nález) | opravný `deploy_src` → **`E_SCOPE_CONFIG`** — vadná konfigurace blokovala i svou opravu (kap. 3 bod 3); kód opraven v tomto vlákně (CZ-02b), do modelu nahrán **bootstrapem** `ITAN-Inject Addin Code` v EA Scripting (129 operací) + restart pumpy (zavření a otevření EA) |
| 27 | Z10-39-ex-ping2, Z10-40-ex-volne, Z10-41-ex-chranene | FB-CZ-03/05a/18 | ping: blacklist `Example Model.FBT-CHRANENE` found, problems []; zápis do `FBT-VOLNE` `done` LOW; zápis cestou `["Example Model","FBT-CHRANENE"]` → `E_BLACKLIST` v P2, audit |

Neověřeno živě (kryje harness): `dedupKey`/`match: composite` mířící do chráněné části (v chráněné části nejsou tagy `ai.dedup`; CZ-09, CZ-10), `allowIncomingRefs: false` (CZ-12), `find_or_create_referencing_sr` (CZ-07), mazání balíčku s chráněným podstromem (CZ-14), úklid záloh s `protected` (CZ-28). FB-CZ-22 s prvkem **uvnitř** zamčeného balíčku čeká na doplnění prvku Milošem (viz kap. 4).

## 3. Rozhodnutí a odchylky (do changelogu zadání v1.1 → v1.2)

1. **Balíček add-inu s dalšími `JavascriptAddin` elementy** (QEAX: `EA Addins` obsahuje i `ExtendedPropertiesAddin`) se **nepovažuje za vadu** — implicitní ochrana se vztahuje na celý balíček add-inů, cizí = jiný typ elementu nebo podbalíček (kap. 5.4 zadání mluví jen o elementu AICodeBridge). EAExample: `AICodeBridge` přesunut do vlastního balíčku `EA File Bridge`, protože `EA Addins` tam obsahuje podbalíčky (`#AI-CODE`, `#AI-LOG`, `#FB-TEST`).
2. **W2 c — klasifikátor chráněné instance** (zadání: „zapiš, co EA udělá"): EA při smazání klasifikátoru **přepíše chráněnou instanci** (`Classifier` → 0), tedy tiše změní obsah chráněné větve. Implementováno dle zadání jako **warning** v `delete_from_model`; **doporučení pro v1.2: `E_BLACKLIST` jako u (a) a (b)** (stejný princip — EA by sáhla na chráněný prvek). Rozhodnutí je Milošovo; změna = jeden řádek v `FB_OpDelete.cascade()` + test CZ-14.
3. **Opravný kanál `deploy_src`**: dávka složená **jen** z `deploy_src` (a čtení) se vadnou konfigurací (`E_SCOPE_CONFIG`) nezastaví — jinak preklep ve `FB_WriteScope` zablokuje i svou opravu a doma zbývá jen bootstrap v EA Scripting (živě potvrzeno Z10-38). `deploy_src` nemá jiný cíl než element `AICodeBridge` (B4 + ELEVATED okno; v bance `FB_OpsAllowed` deny). Smíšená dávka zůstává `E_SCOPE_CONFIG` (CZ-02b). **Doplnit do zadání kap. 5.3/FB-CZ-03.**
4. **EA security a vazby přes Automation (FB-CZ-22, potvrzeno 12. 10. 10:20 s prvkem uvnitř zámku)**: zámek EA hlídá prvky (`E_PERMISSION` / `E_LOCKED`), ale **vazby ne** — vazba ze zamčeného prvku i do něj vznikne, dá se přejmenovat i smazat. Pro O2 = b (bridge security nekontroluje) to znamená díru: agent může přes most měnit vazby prvků, které jsou pro něj v EA zamčené. Rozhodnutí Miloše (karta `IT-ANALYSIS-hlidat-vazby-zamcenych-prvku`): zda má most u vazeb sám kontrolovat zámek zdrojového (a cílového) prvku v `t_seclocks`, nebo to jen hlásit agentovi (Z261004b-11). Kritérium FB-CZ-22 je splněné (výsledek zapsán, liší se od FB-CZ-12 → changelog zadání).
5. **Jména v zápisových dávkách se dohledávají v P2** (před exekucí) → prvek založený dřívější operací téže dávky jménem nenajde; v dávce se odkazuje `$N`. Protokol kap. 7 to už doporučuje; kit (Z261004b-4) to má říct natvrdo.
6. **Osiřelá metoda `FB_Whitelist`** v obou domácích modelech zůstává (deploy_src/bootstrap metody nemažou); neškodí, nikdo ji nevolá. Úklid = ruční smazání operace v EA nebo rozšíření deploy_src o mazání (mimo rozsah).
7. **`parentOutOfWhitelist` → `parentOverThreshold`** v baseline politice (bez whitelistu je jediný důvod nejít výš práh počtu prvků); `baselineRoot` lze zadat v dávce.
8. **Fixtury zůstávají v modelech**: `FBT-CHRANENE` je v obou modelech na blacklistu — smazat ji bridgem nejde (`E_BLACKLIST`) a smazání ručně by rozbilo konfiguraci (`E_SCOPE_CONFIG`). Úklid (krok 9f) tedy = nejdřív položku z `FB_WriteScope` vyjmout + deploy, pak smazat; `FBT-VOLNE`/`FBT-ZAMCENE` ponechány pro živé testy Z261004b-11.
9. `test/harness.js` nahrazuje skutečný `FB_WriteScope` neutrální položkou (prázdný blacklist) — skutečný soubor obsahuje GUIDy živých fixtur, které mock nemá; tvar skutečného souboru hlídá test CZ-00a (repo shodná s `FB_Config`, `pkg` = `{GUID}`, `name`, `note`, žádné bankovní placeholdery).
10. Harness: `HARNESS_ONLY=<podřetězec>` pouští jen vybrané testy.

## 4. Co zbývá / lidské kroky (Miloš)

1. `git push` z PC (commit `6a6cdce` je lokálně na `main`).
2. ~~FB-CZ-22 naplno~~ — hotovo 12. 10. 10:20 (řádek 20b).
3. Rozhodnout bod 3.2 (kaskády mazání — karta `IT-ANALYSIS-rozhodnout-mazani-klasifikatoru-chranene-instance`, varianta c Miloše) a 3.4 (vazby vs. zámek EA — karta `IT-ANALYSIS-hlidat-vazby-zamcenych-prvku`).
4. Úklid fixtur dle 3.8 (až po Z261004b-11); smazat `C:\Users\milos\CLAUDE\_tmp-eafb\`.
5. Z261004b-11 (hlášení/menu/návody/dokumenty): README a `docs/PROTOKOL-EAFB.md` stále popisují whitelist; `FB_SessionStart` věta a chat ACK segment jsou jen technický minimální tvar.

## 5. Lekce z živého běhu (pro další vlákna)

- Pumpa reloaduje kód jen po potvrzeném `deploy_src` nebo při re-attachi (zavřít a znovu otevřít EA stačí — konzoli pumpy není nutné zavírat).
- Bootstrap `ITAN-Inject Addin Code` v EA Scripting je použitelný i doma jako nouzový kanál (script v modelu EAExample je aktuální; QEAX neověřeno).
- `device_commit_files` s opakovaným `stagedPath` podal zastaralý obsah → každé nahrání do nové složky, nebo patch přímo na PC.
- Computer use: přehozená tlačítka myši (tool `right_click` = logický levý klik), okno konzole pumpy je jen „click" tier (klávesy tam nejdou) — popup pumpy se potvrzuje `Return`/`n`, dokud má fokus.
- EA dotaz s `LEN()` nad SQLite otevře modální chybu, která blokuje pumpu do stisku Enter — používat `LENGTH()`.
