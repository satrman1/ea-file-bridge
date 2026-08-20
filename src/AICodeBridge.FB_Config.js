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
// eaexample (dev stanice):
return [
    { repo: "EAEXAMPLE.QEA", baseDir: "C:\\GIT\\ea-file-bridge", srcDir: "C:\\GIT\\ea-file-bridge\\src\\" }
];
