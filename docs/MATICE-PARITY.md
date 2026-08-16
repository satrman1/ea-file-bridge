# Matice parity MCP × ea-file-bridge (stav 2026-08-16)

Legenda: ✅ E2E ověřeno · 🟡 implementováno, netestováno · 🔵 nad rámec MCP · ⛔ vědomě vynecháno

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
| `delete_from_model` (K4) | `delete_from_model` | ✅ (Connector; ostatní typy 🟡) |
| `delete_taggedvalue_from_model` (K4) | `delete_taggedvalue_from_model` | 🟡 |
| `remove_elements_from_diagram` (K4) | `remove_elements_from_diagram` | 🟡 |
| (MCP: `-enableDelete`/`-enableEdit`) | **whitelist operací `FB_OpsAllowed`** | ✅ 🔵 |
| `create_baseline` (K5) | `create_baseline` (pojmenovaná `AI-pre-<session>-<batch>`) | 🟡 🔵 (MCP jméno neuměl) |
| (chybí v MCP) | `get_baselines` | ✅ 🔵 |
| (chybí v MCP) | `baseline_diff` | 🟡 🔵 |
| `clone_package` (K3) | `clone_package` (kvóta V3, `E_QUOTA`) | 🟡 |
| `clone_elements` (K3) | `clone_elements` (kvóta V3) | 🟡 |
| `import_element_linked_documents` (K10) | `import_element_linked_documents` | 🟡 |
| `export_element_linked_documents` (K10) | `export_element_linked_documents` | 🟡 |
| `layout_connectors` (K11) | `layout_connectors` | 🟡 |
| `change_connector_visibility` (K11) | `change_connector_visibility` | 🟡 |
| `open_diagrams` (K11) | `open_diagrams` | 🟡 |
| `reload_diagrams` (K11) | `reload_diagrams` | ✅ |
| `create_or_update_diagram` | — | ⛔ iterace 2 (Diagram Builder) |
| `place_elements_on_diagram` | — | ⛔ iterace 2 (Diagram Builder) |
| `get_diagram_image` | — | ⛔ iterace 2 (PNG export) |
| `find_element_in_diagrams` | — | ⛔ kryje `query` nad `t_diagramobjects` (rozhodnutí zadání) |
| `apply_baseline` | — | ⛔ **trvale** (§12a emr-zapis-pravidla, kap. 6 zadání) |
| `select_element_in_browser` / `_in_diagram`, `get_current_*` | — | ⛔ interaktivní UI, pro dávkový kanál bezpředmětné |
| (nad rámec MCP) | `update_diagram_properties` (K6 Author/Version/ShowDetails/StyleEx) | 🟡 🔵 |
| (nad rámec MCP) | `set_diagram_object_style` (K9 barvy objektu) | 🟡 🔵 |
| (nad rámec MCP) | změna `Element.Type` (K7) — součást `create_or_update_elements` | 🟡 🔵 |
| (nad rámec MCP) | `isComposite` + `SetCompositeDiagram` (K8) — součást `create_or_update_elements` | 🟡 🔵 |
| (nad rámec MCP) | `deploy_src` (dev nasazení kódu executoru) | ✅ 🔵 |

**K9 legenda diagramu**: neimplementována — kandidát, odhad 0,5 dne (vlastní struktura legend elementu v EA, netriviální mapování na protokol). Fallback: ITAN skript.

**M365 části** (Downloads watcher, OneDrive/SharePoint responses, Confluence noha) — vědomě mimo rozsah tohoto vlákna, čekají na vyhodnocení POC fáze 3.
