// AICodeBridge.FB_OpCreateElement(Repository, op, reqId)
// LEGACY operace eafb/0.1 (tracer bullet) - zachovana kvuli regresnimu behu
// a zpetne kompatibilite davek. Od v0.2 jen tenky prevod na FB_OpElements
// (jednotna cesta zapisu: subtree whitelist, razitka, tagged values).
if (!op || !op.name || !op.type) {
    return { op: "create_element", status: "error", code: "E_ARGS", message: "Povinne: name, type, package." };
}
var e = { name: "" + op.name, type: "" + op.type };
e["package"] = op["package"];
if (op.stereotype) { e.stereotypes = "" + op.stereotype; }
if (op.notes_b64) { e.notes_b64 = op.notes_b64; }
else if (typeof op.notes != "undefined") { e.notes = op.notes; }
var r = this.FB_OpElements(Repository, { elements: [e] }, reqId);
if (r.status != "ok") {
    return { op: "create_element", status: "error", code: r.code, message: r.message };
}
return { op: "create_element", status: "ok", guid: r.items[0].guid, elementId: r.items[0].id, id: r.items[0].id, name: r.items[0].name };
