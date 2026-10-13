import json, re, sys, glob, os
res_path, src_dir = sys.argv[1], sys.argv[2]
EA_ARGS = {"EA_Connect":["Repository"],"EA_Disconnect":[],"EA_GetMenuItems":["Repository","MenuLocation","MenuName"],
 "EA_MenuClick":["Repository","MenuLocation","MenuName","ItemName"],
 "EA_GetMenuState":["Repository","MenuLocation","MenuName","ItemName","IsEnabled","IsChecked"],
 "EA_OnOutputItemDoubleClicked":["Repository","TabName","LineText","ID"],"EA_OnOutputItemClicked":["Repository","TabName","LineText","ID"]}
txt = open(res_path, encoding="utf-8-sig").read()
res = json.loads(txt)
print("status:", res.get("status"), res.get("code",""), res.get("message","")[:200])
rows = res["results"][0].get("rows", [])
model = {}
for r in rows:
    op = r["operace"]; model.setdefault(op, [])
    if r.get("parametr") not in (None, ""):
        model[op].append((int(r["Pos"] or 0), r["parametr"]))
model = {k: [n for _, n in sorted(v, key=lambda x: x[0])] for k, v in model.items()}
src = {}
for f in sorted(glob.glob(os.path.join(src_dir, "AICodeBridge.*.js"))):
    op = os.path.basename(f)[len("AICodeBridge."):-3]
    head = open(f, encoding="utf-8-sig").read(500)
    m = re.search(r"AICodeBridge\." + re.escape(op) + r"\s*\(([^)]*)\)", head)
    if m: src[op] = [p.strip() for p in m.group(1).split(",") if p.strip()]
    elif op in EA_ARGS: src[op] = EA_ARGS[op]
    else: src[op] = None
diff = 0
for op in sorted(set(src) | set(model)):
    if op not in model: print("CHYBI V MODELU:", op); diff += 1; continue
    if op not in src: print("V MODELU NAVIC (bez souboru v src):", op, model[op]); continue
    if src[op] is None: print("bez hlavicky (nekontrolovano):", op, model[op]); continue
    if src[op] != model[op]: print("ROZDIL:", op, "model", model[op], "src", src[op]); diff += 1
print("operaci v modelu: %d, souboru v src: %d, rozdilu: %d, radku: %d" % (len(model), len(src), diff, len(rows)))
