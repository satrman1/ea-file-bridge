// AICodeBridge.ProcessRequests(Repository)
// Projde /Groups/#AI-CODE (nebo #AI-CODE kdekoli) a zpracuje requesty se status=PENDING.
// mode: deploy (default) | export | query
this.Log(Repository, "=== AI Bridge: Process requests ===");

var xml = Repository.SQLQuery("SELECT Package_ID FROM t_package WHERE Name = '#AI-CODE'");
var match = /<Package_ID>(\d+)<\/Package_ID>/.exec(xml);
if (!match) {
    this.Log(Repository, "CHYBA: package #AI-CODE nenalezen.");
    return;
}
var pkg = Repository.GetPackageByID(parseInt(match[1], 10));

var total = 0, ok = 0, err = 0;
for (var i = 0; i < pkg.Elements.Count; i++) {
    var req = pkg.Elements.GetAt(i);
    var status = this.GetTag(req, "status", "");
    if (status != "PENDING") {
        continue;
    }
    total = total + 1;
    var mode = this.GetTag(req, "mode", "deploy");
    try {
        if (mode == "export") {
            this.ExportRequest(Repository, req);
        } else if (mode == "query") {
            this.RunQuery(Repository, req);
        } else {
            this.DeployRequest(Repository, req);
        }
        ok = ok + 1;
    } catch (e) {
        err = err + 1;
        this.SetTag(req, "status", "ERROR");
        this.SetTag(req, "detail", "Exception: " + e.message);
        this.Log(Repository, "ERROR " + req.Name + ": " + e.message);
    }
}
if (total == 0) {
    this.Log(Repository, "Zadne PENDING requesty.");
} else {
    this.Log(Repository, "Hotovo: " + ok + " zpracovano, " + err + " vyjimek (z " + total + " PENDING).");
    this.Log(Repository, "POZOR: nasazeny kod (deploy) se aktivuje az reloadem add-inu.");
}
