// AICodeBridge.FB_Config()
// Konfigurace prostredi bridge per repozitar (parovani pres FB_RepoId,
// case-insensitive podretezec - stejna mechanika jako FB_WriteScope):
//   repo:    podretezec identity repozitare dle FB_RepoId
//   baseDir: korenova slozka vymennych souboru (obsahuje requests\ a responses\).
//            VOLITELNE od 2026-08-20: bez polozky pro dany repozitar spadne
//            FB_ResolveBaseDir na DEFAULT (slozka modelu\EA-File-Bridge u .qea,
//            jinak %USERPROFILE%\Documents\EA-File-Bridge\<repo>). Kazdy si
//            muze nastavit svou zde; bez nastaveni to funguje.
//            - pouziva GUI fallback "Process requests (File Bridge)" v EA
//              a operace export/import_element_linked_documents (soubory
//              se pisou VYHRADNE dovnitr baseDir - zadne cizi cesty).
//   srcDir:  slozka kanonu kodu pro deploy_src (dev operace; v bance deny).
//   showInBrowser: true = zapne FB_ShowInBrowser (default VYPNUTO - lekce
//            2026-08-20, ShowInProjectView pad; zapinat az po zavere spiku
//            B-V3, viz docs/e2e-iterace5/SPIKE-NAV.md).
//   navProbe: true = ukaze menu polozku "Nav spike (test navigace)"
//            (iterace 5 B-V3; jen dev repo, do PROD sablon NEpatri).
//   gatekeeper: true = ukaze menu polozku "Zapnout AI import rezim (vratny)" a
//            dovoli launcheru vratneho bezet (v0.20, FB-PU-43). Bez nej polozka
//            v menu NENI a launcher odmitne - v bance se vratny nenasazuje
//            (antivir), do bankovni sablony klic NEpatri.
//   auditPkg: GUID package pro audit davek (FB_Audit; od 2026-09-09, nalez
//            N-K8-3). Od rezimu blacklist (Z261004b-10, cil zapisu kap. 5.2/I5)
//            POVINNY - chybejici = E_SCOPE_CONFIG pro vsechny zapisy (fallback
//            jmenem '#AI-LOG' neni identita; FB_Audit ho drzi jen pro cteni
//            stareho modelu). Balicek auditu je implicitne chraneny (podstrom).
//   chat:    VOLITELNE (iterace 7, par. 4.3) - per-repo prepis rozpoctu
//            chat ACK: { total, perOp, items, query, warn }. DEFAULTY ZIJI
//            V KODU FB_ChatRender (4000/900/25/700/500) - repozitar bez
//            polozky jede na defaultech, zadny undefined ani tichy navrat
//            k zadratovani (W6). FB_Config je chraneny element (PROTOKOL
//            par. 8 bod 7) -> zvednuti stropu = auditovatelna zmena v
//            modelu, ne runtime prepinac z chatu.
// eaexample (dev stanice):
// QEAX (K8-doma, security model; Z260904-6): identita repa = nazev souboru
//   .qeax (doplneno 6b 2026-09-09 z K3 pingu; stejna hodnota ve vsech peti
//   konfiguracnich souborech - viz FB_WriteScope).
//   baseDir zamerne NENI (default = slozka modelu\EA-File-Bridge, FB_ResolveBaseDir);
//   pumpa (pump.wsf) cte requests\ vedle sebe bez ohledu na baseDir.
//   navProbe: false - QEAX neni dev piskoviste, spike menu tam nepatri.
//   auditPkg = #AI-LOG 686 pod Test Data (res-K3.json); model ma #AI-LOG 3x.
return [
    { repo: "EAEXAMPLE.QEA", baseDir: "C:\\GIT\\ea-file-bridge", srcDir: "C:\\GIT\\ea-file-bridge\\src\\", navProbe: true, gatekeeper: true,
      auditPkg: "{8DF101C4-14A9-4b89-927E-833EA58D9F3C}" }, // #AI-LOG 1055 pod Model Based Add-Ins.EA Addins (zivy krok 9e, 2026-10-12)
    { repo: "EA17_Yoga_QEA2.qeax", srcDir: "C:\\GIT\\ea-file-bridge\\src\\", navProbe: false,
      auditPkg: "{AEEBE2C0-AD55-4912-903D-07CD047C7244}" }
];
