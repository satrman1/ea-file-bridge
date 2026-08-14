// AICodeBridge.FB_OpPing(Repository, op)
// Zdravotni test smycky: echo + zakladni info o prostredi.
function pad2(n) { return (n < 10 ? "0" : "") + n; }
var d = new Date();
var r = { op: "ping", status: "ok" };
if (op && typeof op.echo != "undefined") { r.echo = op.echo; }
r.eaVersion = "" + Repository.LibraryVersion;
// repository = identita dle FB_RepoId (MS SQL: nazev DB); connection = cesta
r.repository = "" + this.FB_RepoId(Repository);
r.connection = "" + Repository.ConnectionString;
r.time = "" + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
    + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
return r;
