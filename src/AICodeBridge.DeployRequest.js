// AICodeBridge.DeployRequest(Repository, req)
// Notes (base64) -> decode -> Method.Code cilove operace.
var targetGuid = this.GetTag(req, "targetGuid", "");
var opName = this.GetTag(req, "opName", "");
var m = this.FindTargetMethod(Repository, targetGuid, opName);
if (m == null) {
    this.SetTag(req, "status", "ERROR");
    this.SetTag(req, "detail", "Cilova operace nenalezena: " + targetGuid + " / " + opName);
    this.Log(Repository, "ERROR " + req.Name + ": cilova operace nenalezena");
    return;
}
// Notes mohou obsahovat formatovaci markup - orezat na cisty base64
var raw = ("" + req.Notes).replace(/<[^>]+>/g, "");
raw = raw.replace(/[^A-Za-z0-9+\/=]/g, "");
if (raw == "") {
    this.SetTag(req, "status", "ERROR");
    this.SetTag(req, "detail", "Prazdne Notes (zadny base64 payload).");
    this.Log(Repository, "ERROR " + req.Name + ": prazdny payload");
    return;
}
var code = this.B64Decode(raw);
m.Code = code;
m.Update();
this.SetTag(req, "status", "DONE");
this.SetTag(req, "detail", "Nasazeno " + code.length + " znaku do " + opName + ", " + String(new Date()) + ". Aktivace az po reloadu add-inu.");
this.Log(Repository, "OK " + req.Name + " -> " + opName + " (" + code.length + " znaku)");
