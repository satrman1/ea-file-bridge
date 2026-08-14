// AICodeBridge.Log(Repository, msg) - zapis do System Output tabu "AI Bridge",
// fallback Session.Output (vendor konvence)
try {
    Repository.CreateOutputTab("AI Bridge");
    Repository.WriteOutput("AI Bridge", "" + msg, 0);
    Repository.EnsureOutputVisible("AI Bridge");
} catch (e) {
    Session.Output("[AI Bridge] " + msg);
}
