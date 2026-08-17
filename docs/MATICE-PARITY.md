# Matice parity MCP × ea-file-bridge (stav 2026-08-17, po iteraci 2 — Diagram Builder; dávky 20260818-*)

Legenda: ✅ E2E ověřeno (v závorce důkazní dávka) · 🔵 nad rámec MCP · ⛔ vědomě vynecháno

| MCP tool | Operace bridge | Stav |
|---|---|---|
| — | `ping` | ✅ |
| (chybí v MCP) | `query` (SQL read-only, vrací GUIDy) | ✅ 🔵 |
| `find_elements_by_name` | `find_elements_by_name` | ✅ |
| `find_packages_by_name` | `find_packages_by_name` | ✅ |
| `get_elements_information` | `get_elements_information` | ✅ |
| `get_packages_information` | `get_packages_information` | ✅ |
| `get_connectors_information` | `get_connectors_information` | ✅ |
| `get_diagrams_information` | `get_diagrams_information` (vč. `messages`) | ✅ |
| `create_or_update_elements` | `create_or_update_elements` | ✅ |
| `create_or_update_package` | `create_or_update_package` | ✅ |
| `create_or_update_connectors` | `create_or_update_connectors` | ✅ |
| `create_or_update_attributes` (K2) | `create_or_update_attributes` | ✅ |
| `create_or_update_operations` (K2) | `create_or_update_operations` | ✅ |
| `create_or_update_messages` (K1) | `create_or_update_messages` | ✅ |
| `delete_from_model` (K4) | `delete_from_model` | ✅ všech 7 typů: Connector (20260816-12/14), Parameter/Attribute/Operation/Element/Package (20260817-04), Diagram (20260817-07) |
| `delete_taggedvalue_from_model` (K4) | `delete_taggedvalue_from_model` | ✅ ElementTV + ConnectorTV vč. `operation_guid` UNDO drillu T1 (20260817-03) |
| `remove_elements_from_diagram` (K4) | `remove_elements_from_diagram` | ✅ element zůstal v modelu, §11 (20260817-03) |
| (MCP: `-enableDelete`/`-enableEdit`) | **whitelist operací `FB_OpsAllowed`** | ✅ 🔵 (E_OP_FORBIDDEN, 20260816-16) |
| `create_baseline` (K5) | `create_baseline` (pojmenovaná `AI-pre-<session>-<batch>`) | ✅ 🔵 jméno dohledatelné v `get_baselines` — MCP jméno neuměl (20260817-02) |
| (chybí v MCP) | `get_baselines` | ✅ 🔵 |
| (chybí v MCP) | `baseline_diff` | ✅ 🔵 summary + raw comparelog; diff vykázal cílenou změnu (20260817-02) |
| `clone_package` (K3) | `clone_package` (kvóta V3, `volume`) | ✅ vč. diagramů podstromu (20260817-05) |
| `clone_elements` (K3) | `clone_elements` (kvóta V3) | ✅ (20260817-05/-07); `E_QUOTA` na 101 el. bez confirm (20260817-14). ⚠ `Element.Clone()` NEPŘENÁŠÍ owned diagramy (ověřeno -07: zdroj 1 → klon 0) — limit MCP éry platí i pro Automation; bridge počet aspoň vykazuje (`ownedDiagrams`). Náhradní postup: diagramy klonu postavit Diagram Builderem (`create_or_update_diagram` + `place_elements_on_diagram` — od iterace 2 ✅ k dispozici). |
| `import_element_linked_documents` (K10) | `import_element_linked_documents` | ✅ round-trip s exportem, marker zachován; EA RTF normalizuje (20260817-08) |
| `export_element_linked_documents` (K10) | `export_element_linked_documents` | ✅ (20260817-08; přes FB_ComObj re-test 20260817-22) |
| `layout_connectors` (K11) | `layout_connectors` | ✅ (20260817-12) — po opravě mapy stylů: EA LinkLineStyle jen 1–9, orthS=8/orthR=9 (bug 10/11 tiše degradoval na custom; fix nasazen deploy_src 20260817-11) |
| `change_connector_visibility` (K11) | `change_connector_visibility` | ✅ Hidden 0→1→0 v `t_diagramlinks` (20260817-09) |
| `open_diagrams` (K11) | `open_diagrams` | ✅ (20260817-09) |
| `reload_diagrams` (K11) | `reload_diagrams` | ✅ (20260816-14) |
| `create_or_update_diagram` | `create_or_update_diagram` | ✅ create v package i pod elementem (owningElement), MDG typ přes `StyleEx MDGDgm=` (parita s MCP referencí 20260818-02/-03), update jména/vlastností, §7e Author+Version na create (20260818-05) |
| `place_elements_on_diagram` | `place_elements_on_diagram` | ✅ x/y/width/height/style + auto-mřížka bez souřadnic (20260818-05); konektor mezi umístěnými konci EA vykreslí sám — response `connectorsOnDiagram` z `t_connector` (Dependency 4802, 20260818-07; ⚠ `t_diagramlinks` u čerstvého diagramu prázdná) |
| `get_diagram_image` | `get_diagram_image` | ✅ 🔵 **PNG do souboru** `<baseDir>\responses\images\` (MCP uměl jen inline — bolest EDU pipeline); `inline:true` → `png_b64` 1:1 (20260818-08); po zápisu zpráv nutný `reload_diagrams` před exportem (20260818-10) |
| `find_element_in_diagrams` | — | ⛔ kryje `query` nad `t_diagramobjects` (rozhodnutí zadání) |
| `apply_baseline` | — | ⛔ **trvale** (§12a emr-zapis-pravidla, kap. 6 zadání) |
| `select_element_in_browser` / `_in_diagram`, `get_current_*` | — | ⛔ interaktivní UI, pro dávkový kanál bezpředmětné |
| (nad rámec MCP) | `update_diagram_properties` (K6 Author/Version/ShowDetails/StyleEx) | ✅ 🔵 (20260817-13) |
| (nad rámec MCP) | `set_diagram_object_style` (K9 barvy objektu + reset) | ✅ 🔵 (20260817-13) |
| (nad rámec MCP) | změna `Element.Type` (K7) — součást `create_or_update_elements` | ✅ 🔵 Object→Component→Object (20260817-13) |
| (nad rámec MCP) | `isComposite` + `SetCompositeDiagram` (K8) — součást `create_or_update_elements` | ✅ 🔵 NType=8 (20260817-13) |
| (nad rámec MCP) | `deploy_src` (dev nasazení kódu executoru) | ✅ 🔵 vč. založení NOVÉ operace ze signatury (FB_ComObj, 20260817-22); v bance deny |
| (nad rámec MCP) | **GUI fallback** `FB_ProcessFolder` + menu „Process requests (File Bridge)" | ✅ 🔵 response bez běžící pumpy, archiv processed\ (20260817-23). ⚠ EA runtime: nutný `FB_ComObj` (žádný ActiveXObject/Enumerator) a aktivace kódu = **plný restart EA** (Reload Current Project nestačí) |

**K9 legenda diagramu**: neimplementována — kandidát, odhad 0,5 dne (vlastní struktura legend elementu v EA, netriviální mapování na protokol). Fallback: ITAN skript.

**Regresní běh 2026-08-17** (bod 4 zadání): pozitivní ping+query+create_or_update_elements + `E_WHITELIST`+skipped (20260817-15), `E_REPO` na dávce pro EMR_PROD — nic neprovedeno (20260817-16), `E_SQL_READONLY` na DELETE (20260817-17). Shodné chování jako 2026-08-16. **Regrese po iteraci 2**: ping + query + create (el. 11123) + `E_WHITELIST` na pkg 1052 + skipped — shodné chování (20260818-11).

**Sekvenční řetěz Diagram Builder + K1** (dosud šly messages jen na předpřipravený diagram 1131): nový MDG Sequence diagram + place lifelin 11061/11062 + `create_or_update_messages` v jedné dávce přes `$N`, PNG důkaz po reloadu (20260818-09/-10, diagram 1140).

**M365 části** (Downloads watcher, OneDrive/SharePoint responses, Confluence noha) — vědomě mimo rozsah, čekají na vyhodnocení POC fáze 3.
