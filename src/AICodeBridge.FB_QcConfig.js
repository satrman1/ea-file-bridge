// AICodeBridge.FB_QcConfig()
// QC kontroly per repozitar pro ACK zapisovych davek (FB_QcRun, zadani
// iterace 4 par. 3.4). Parovani pres FB_RepoId (case-insensitive
// podretezec - stejna mechanika jako FB_Config/FB_Whitelist).
// !! SQL VYHRADNE nad overenymi standardnimi sloupci (lekce par. 6a/3:
// neznamy sloupec na .qea = modalni dialog EA = viselec) a bez
// dialektovych funkci (bezi na SQLite i MS SQL).
// $PKGNAMES = scope na dotcene packages (jmena z risk.summary.packages).
// Repo bez polozky => QC status "nedobehlo: zadne kontroly" (tri stavy W6).
// BANKA: sem prijde relevantni podmnozina QC101-405 (pamet
// produkcni-qc-kontroly) - tvrde kriterium "AI zapis nesmi vygenerovat
// nalez"; doba behu se meri v T4-6 (rozpocet zamrznuti).
return [
    { repo: "EAEXAMPLE.QEA", checks: [
        { id: "QC-DEMO-001", desc: "Element bez jmena v dotcenych packages",
          sql: "SELECT o.Object_ID FROM t_object o INNER JOIN t_package p ON o.Package_ID = p.Package_ID WHERE p.Name IN ($PKGNAMES) AND (o.Name IS NULL OR o.Name = '')" }
    ] }
];
