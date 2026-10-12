// AICodeBridge.Log(Repository, msg, id)
// Zapis do System Output tabu "AI Bridge", fallback Session.Output (vendor
// konvence). Iterace 5 (B-V1): volitelny 3. parametr id = ElementID prvku -
// dvojklik na radek pak NATIVNE naviguje na prvek v Project browseru
// (WriteOutput 3. param, GUI-KATALOG par. 5). Naviguje EA sama ze sveho UI
// kontextu - zadne ShowInProjectView z add-inu, past par. 1a/4 se nekona.
// FB-PU-34 (v0.19, Z261004b-6): EnsureOutputVisible (zobrazeni/prepnuti tabu)
// uz NE u kazdeho radku - davka s 15 prvky = 19x "zobraz Output" a zavrene
// okno System Output se otviralo i u davek pumpy na pozadi. Behem davky
// (FB_Main drzi this._fbOutputBatch) se radky jen pisou a tab se ukaze JEDNOU
// na konci (FB_OutputFlush); mimo davku (menu, start session) jako driv.
// Vypinac: FB_Config.outputShow: false = tab se nikdy nevynucuje.
try {
    Repository.CreateOutputTab("AI Bridge");
    Repository.WriteOutput("AI Bridge", "" + msg, (typeof id == "number" && id > 0) ? id : 0);
    var ob = this._fbOutputBatch;
    if (ob && typeof ob == "object") { ob.pending = true; }
    else { Repository.EnsureOutputVisible("AI Bridge"); }
} catch (e) {
    Session.Output("[AI Bridge] " + msg);
}
