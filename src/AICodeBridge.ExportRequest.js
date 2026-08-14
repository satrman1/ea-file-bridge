// AICodeBridge.ExportRequest(Repository, req)
// Precte Method.Code cilove operace a ulozi jako base64 do Notes requestu.
// Tim AI ziska pristup ke stavajicimu kodu pres MCP (cteni Notes).
var targetGuid = this.GetTag(req, "targetGuid", "");
var opName = this.GetTag(req, "opName", "");
var m = this.FindTargetMethod(Repository, targetGuid, opName);
if (m == null) {
    this.SetTag(req, "status", "ERROR");
    this.SetTag(req, "detail", "Cilova operace nenalezena: " + targetGuid + " / " + opName);
    this.Log(Repository, "ERROR " + req.Name + ": cilova operace nenalezena");
    return;
}
var code = "" + m.Code;
req.Notes = this.B64Encode(code);
req.Update();
this.SetTag(req, "status", "EXPORTED");
this.SetTag(req, "detail", "Exportovano " + code.length + " znaku z " + opName + ", " + String(new Date()));
this.Log(Repository, "EXPORT " + req.Name + " <- " + opName + " (" + code.length + " znaku)");
