// AICodeBridge.FB_Config()
// Konfigurace prostredi bridge per repozitar (parovani pres FB_RepoId,
// case-insensitive podretezec - stejna mechanika jako FB_Whitelist):
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
//   chat:    VOLITELNE (iterace 7, par. 4.3) - per-repo prepis rozpoctu
//            chat ACK: { total, perOp, items, query, warn }. DEFAULTY ZIJI
//            V KODU FB_ChatRender (4000/900/25/700/500) - repozitar bez
//            polozky jede na defaultech, zadny undefined ani tichy navrat
//            k zadratovani (W6). FB_Config je chraneny element (PROTOKOL
//            par. 8 bod 7) -> zvednuti stropu = auditovatelna zmena v
//            modelu, ne runtime prepinac z chatu.
// eaexample (dev stanice):
// QEAX (K8-doma, security model; Z260904-6): "<QEAX-FILENAME>" = zastupna
//   identita repa (nahradi Z260904-6b hodnotou `repository` z K3 pingu, ve
//   vsech peti konfiguracnich souborech najednou - viz FB_Whitelist).
//   baseDir zamerne NENI (default = slozka modelu\EA-File-Bridge, FB_ResolveBaseDir);
//   pumpa (pump.wsf) cte requests\ vedle sebe bez ohledu na baseDir.
//   navProbe: false - QEAX neni dev piskoviste, spike menu tam nepatri.
return [
    { repo: "EAEXAMPLE.QEA", baseDir: "C:\\GIT\\ea-file-bridge", srcDir: "C:\\GIT\\ea-file-bridge\\src\\", navProbe: true },
    { repo: "<QEAX-FILENAME>", srcDir: "C:\\GIT\\ea-file-bridge\\src\\", navProbe: false }
];
