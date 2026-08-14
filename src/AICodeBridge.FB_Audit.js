// AICodeBridge.FB_Audit(Repository, reqId, summary, requestText)
// Audit element za kazdou davku do package #AI-LOG. Vraci GUID auditu,
// nebo "" kdyz #AI-LOG neexistuje (bridge kvuli tomu nesmi spadnout).
var xml = "" + Repository.SQLQuery("SELECT ea_guid FROM t_package WHERE Name = '#AI-LOG'");
var mm = /<ea_guid>([^<]+)<\/ea_guid>/i.exec(xml);
if (!mm) {
    this.Log(Repository, "WARN: package #AI-LOG nenalezen - audit davky se neulozi.");
    return "";
}
var pkg = Repository.GetPackageByGuid(mm[1]);
var el = pkg.Elements.AddNew("FB " + reqId, "Artifact");
el.Notes = summary + "\n\n--- request ---\n" + requestText;
el.Update();
this.SetTag(el, "ai.channel", "eafb");
this.SetTag(el, "ai.request", "" + reqId);
this.SetTag(el, "result", ("" + summary).substring(0, 250));
pkg.Elements.Refresh();
return "" + el.ElementGUID;
