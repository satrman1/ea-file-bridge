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
//   baseline  BASELINE POLITIKA (zadani Baseline politika v1.2 par. 5) -
//             VOLITELNA sekce; cte a validuje ji VYHRADNE FB_BaselineConfig:
//             CHYBEJICI sekce = politika zustava validni (bezpecne defaulty
//             + warning), PRITOMNA nekonzistentni = zapisove davky ELEVATED.
//             subtreeMax / maxBaselineElements jsou SHADOW (jen meri).
//             Klice: subtreeMax, maxBaselineElements, maxBaselinePackages,
//             probeBudgetMs, probeBudgetTotalMs, useCte, freshWithinMin,
//             sessionMaxHours, requireRecoveryForUpdates (JEN destruktivni
//             podtrida -> E_NO_BASELINE), sessionBaseline "auto"|"off",
//             autoPrefix (REZERVOVANY - create_baseline s nim = E_ARGS),
//             cleanupEveryHours, cleanup { mode "report"|"delete", keepLastK,
//             maxAgeDays, maxDeletesPerRun, maxDeletesAnomaly,
//             requireWriteGroup }.
//             PREPNUTI cleanup.mode report -> delete: az po 10 cistych bezich
//             rezimu report, nejdrive po 14 dnech provozu, a po PRVNIM ostrem
//             mazani z menu pod dohledem; prepnuti zapsat SEM do komentare
//             (datum, kdo) - je to auditovatelna zmena cloveka.
//
// Hodnoty limitu schvalil Milos 2026-08-19 jako VYCHOZI konfiguraci -
// vedome predbezne, ladi se podle auditnich dat (CR par. 11) zmenou teto
// politiky, ne kodu operaci.
//
// eaexample (dev stanice) - klasifikace dle zadani par. 4; VEDOMA DEV
// VYJIMKA: deploy_src = ELEVATED (ne BLOCKED) - deploy_src je jedina cesta
// nasazeni kodu na dev stanici a BLOCKED bez override by vyvoj zastavil.
// V bance deploy_src BLOCKED (+ FB_OpsAllowed deny trva - gate = 2. vrstva).
// QEAX (K8-doma, security model; Z260904-6): TAZ politika jako eaexample
// (sdilena mapa DEV_CLASSES + tytez prahy) - testuji se vrstvy 2 a 3
// autorizace, ne risk gate. Identita doplnena 6b 2026-09-09 (viz
// FB_Whitelist); repo bez polozky = fail-closed ELEVATED (W9).
var DEV_CLASSES = {
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
};
var DEV_ELEVATE = { deleteTargets: 0, writeOps: 20, updatedExisting: 10,
                    affectedPackages: 1, foreignDiagrams: 0, moveOps: 0 };
var DEV_BLOCK   = { deleteTargets: 100, writeOps: 500, updatedExisting: 100,
                    affectedPackages: 5 };
// Baseline politika - DEV hodnoty (zadani v1.2 par. 5, schvaleno jako vychozi
// 2026-08-21). cleanup.mode: "report" - prepnuti viz komentar vyse.
var DEV_BASELINE = { subtreeMax: 5000, maxBaselineElements: 10000, // shadow
                     maxBaselinePackages: 5, probeBudgetMs: 500, probeBudgetTotalMs: 2000,
                     useCte: false, freshWithinMin: 15, sessionMaxHours: 12,
                     requireRecoveryForUpdates: false, sessionBaseline: "auto",
                     autoPrefix: "FB-AUTO ", cleanupEveryHours: 24,
                     cleanup: { mode: "report", keepLastK: 3, maxAgeDays: 14,
                                maxDeletesPerRun: 20, maxDeletesAnomaly: 200,
                                requireWriteGroup: true } };
return [
    { repo: "EAEXAMPLE.QEA",
      classes: DEV_CLASSES, elevate: DEV_ELEVATE, block: DEV_BLOCK,
      budgetMs: 8000, hashMaxChars: 2000000, baseline: DEV_BASELINE },
    { repo: "EA17_Yoga_QEA2.qeax",
      classes: DEV_CLASSES, elevate: DEV_ELEVATE, block: DEV_BLOCK,
      budgetMs: 8000, hashMaxChars: 2000000, baseline: DEV_BASELINE }
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
    //   budgetMs: 8000, hashMaxChars: 2000000,
    //   baseline: { ...jako DEV_BASELINE..., requireRecoveryForUpdates: true,
    //               sessionBaseline: "off" } }   // bankovni sablona par. 5
];
