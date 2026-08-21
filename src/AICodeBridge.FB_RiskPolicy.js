// AICodeBridge.FB_RiskPolicy()
// RISK GATE POLITIKA per repozitar (iterace 4b, zadani v1.1 par. 4+5).
// Konfiguracni sekce VZOREM FB_OpsAllowed - zije MIMO whitelist packages,
// je menitelna JEN cestou deploy_src (v bance deny -> jen rucne v EA) a
// executor navic klasifikuje JAKYKOLI target davky = konfiguracni element
// bridge -> BLOCKED (B4, vynucuje FB_RiskGate). Zmena politiky = rucni,
// baselinovana, auditovatelna udalost cloveka - nikdy AI davka.
//
// Executor politiku JEN CTE a vykonava AUTO/CONFIRM/BLOCK; zadna hodnota
// limitu neni zadratovana v kodu operaci. FAIL-CLOSED (W9, vynucuje
// FB_RiskGate pri cteni): repo bez polozky NEBO neuplna sada prahu NEBO
// neuplna mapa classes proti registru Z operaci = politika NEVALIDNI ->
// vsechny zapisove davky ELEVATED s duvodem. Nikdy "chybejici prah = zadny
// strop".
//
// Polozka per repo:
//   repo      podretezec identity dle FB_RepoId (case-insensitive)
//   classes   mapa op -> "LOW" | "ELEVATED" | "BLOCKED" - MUSI pokryvat
//             VSECHNY zapisove operace registru FB_Main (w: true).
//             Varianty se ZVYSENOU semantikou (messages+rebuild,
//             operations+parameters, elements update se zmenou type -
//             W2a/W2b) eskaluje FB_RiskGate NAD tuto mapu - pravidla jen
//             eskaluji, nikdy nesnizuji.
//   elevate   prahy per davka -> ELEVATED (prekroceni = confirm ve V2;
//             ve vypocetni fazi shadow pole v response/auditu).
//             `moveOps` (iterace 6) je VOLITELNY prah - kdyz chybi,
//             politika zustava validni (jinak by pridani noveho prahu
//             fail-closed shodilo kazdou driv nasazenou politiku do
//             ELEVATED). Trida operace move_elements ELEVATED plati vzdy.
//   block     prahy per davka -> BLOCKED (E_RISK_BLOCKED, vynucovano hned)
//   budgetMs  rozpocet vypoctu metrik (W5): prekroceni = fail-closed
//             ELEVATED "metriky nespocitany"
//   hashMaxChars  strop delky requestu pro payloadHash (W5): nad strop se
//             hash nepocita a davka jde ELEVATED (fail-closed)
//
// Hodnoty limitu schvalil Milos 2026-08-19 jako VYCHOZI konfiguraci -
// vedome predbezne, ladi se podle auditnich dat (CR par. 11) zmenou teto
// politiky, ne kodu operaci.
//
// eaexample (dev stanice) - klasifikace dle zadani par. 4; VEDOMA DEV
// VYJIMKA: deploy_src = ELEVATED (ne BLOCKED) - deploy_src je jedina cesta
// nasazeni kodu na dev stanici a BLOCKED bez override by vyvoj zastavil.
// V bance deploy_src BLOCKED (+ FB_OpsAllowed deny trva - gate = 2. vrstva).
return [
    { repo: "EAEXAMPLE.QEA",
      classes: {
          // --- LOW (par. 4: bezny pracovni den bez dialogu) ---
          "create_element":                  "LOW",
          "create_or_update_elements":       "LOW",
          "create_or_update_package":        "LOW",
          "create_or_update_connectors":     "LOW",
          "create_or_update_attributes":     "LOW",
          "create_or_update_operations":     "LOW", // s parameters eskaluje gate (W2a)
          "create_or_update_messages":       "LOW", // s rebuild:true eskaluje gate (V2d)
          "update_diagram_properties":       "LOW",
          "set_diagram_object_style":        "LOW",
          "place_elements_on_diagram":       "LOW", // cizi diagram chyta prah foreignDiagrams
          "layout_connectors":               "LOW",
          "change_connector_visibility":     "LOW",
          "create_or_update_diagram":        "LOW",
          "apply_classifier_stereotypes":    "LOW", // idempotentni, parita ITAN
          "find_or_create_referencing_sr":   "LOW", // katalog-first; deklarovany objem
          "create_baseline":                 "LOW", // soucast obrany
          // --- ELEVATED vzdy (bez ohledu na rozsah) ---
          "delete_from_model":               "ELEVATED",
          "delete_taggedvalue_from_model":   "ELEVATED",
          "remove_elements_from_diagram":    "ELEVATED",
          "import_element_linked_documents": "ELEVATED", // prepis existujiciho dokumentu
          "clone_package":                   "ELEVATED",
          "clone_elements":                  "ELEVATED",
          "create_or_update_scenarios":      "ELEVATED", // V2d rebuild; kandidat na LOW po zacviku
          "create_or_update_constraints":    "ELEVATED", // V2d rebuild; kandidat na LOW po zacviku
          "create_or_update_requirements":   "ELEVATED", // V2d rebuild (iterace 6); kandidat na LOW po zacviku
          // move_elements (iterace 6) = ELEVATED VZDY, i pro jediny prvek:
          //  (1) je to zasah do STRUKTURY modelu, ne do obsahu prvku;
          //  (2) neni vratny opakovanim davky - puvodni package v davce neni;
          //  (3) governance visi na package (SA-Status per package, P1) -
          //      presunem se meni, jaky stav/brana na prvek plati;
          //  (4) metodika P3 presun mezi pracovnim prostorem a ostrou vetvi
          //      vyslovne sveruje CLOVEKU ("provadi/potvrzuje clovek");
          //  (5) dotyka se dvou packages naraz - prah affectedPackages > 1 by
          //      stejne eskaloval; trida to jen dela explicitnim a nezavislym
          //      na tom, kolik packages davka jinak potka.
          "move_elements":                   "ELEVATED",
          // --- dev vyjimka (v PROD sablone BLOCKED) ---
          "deploy_src":                      "ELEVATED"
      },
      elevate: { deleteTargets: 0, writeOps: 20, updatedExisting: 10,
                 affectedPackages: 1, foreignDiagrams: 0, moveOps: 0 },
      block:   { deleteTargets: 100, writeOps: 500, updatedExisting: 100,
                 affectedPackages: 5 },
      budgetMs: 8000,
      hashMaxChars: 2000000 }
    // Banka (PROD politika - doplni clovek v bance; sablona dle par. 4):
    // { repo: "<TEST-DB>",
    //   classes: { ...jako vyse..., "deploy_src": "BLOCKED",
    //              "move_elements": "ELEVATED" (P2+; do te doby spis
    //              FB_OpsAllowed deny - presun v ostre vetvi je ukon cloveka),
    //              "create_or_update_requirements": "ELEVATED" },
    //   elevate: { deleteTargets: 0, writeOps: 20, updatedExisting: 10,
    //              affectedPackages: 1, foreignDiagrams: 0, moveOps: 0 },
    //   block:   { deleteTargets: 100, writeOps: 500, updatedExisting: 100,
    //              affectedPackages: 5 },
    //   budgetMs: 8000, hashMaxChars: 2000000 }
];
