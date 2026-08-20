// AICodeBridge.Log(Repository, msg, id)
// Zapis do System Output tabu "AI Bridge", fallback Session.Output (vendor
// konvence). Iterace 5 (B-V1): volitelny 3. parametr id = ElementID prvku -
// dvojklik na radek pak NATIVNE naviguje na prvek v Project browseru
// (WriteOutput 3. param, GUI-KATALOG par. 5). Naviguje EA sama ze sveho UI
// kontextu - zadne ShowInProjectView z add-inu, past par. 1a/4 se nekona.
try {
    Repository.CreateOutputTab("AI Bridge");
    Repository.WriteOutput("AI Bridge", "" + msg, (typeof id == "number" && id > 0) ? id : 0);
    Repository.EnsureOutputVisible("AI Bridge");
} catch (e) {
    Session.Output("[AI Bridge] " + msg);
}
