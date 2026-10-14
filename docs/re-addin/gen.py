# -*- coding: utf-8 -*-
import json, io, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ir_addin as I
ROOT = "{DDA8A0F3-5920-4046-8F97-764CF89B9D8F}"   # /AI Test/Reverse Addinu (EAExample)
def tv(code):
    t = [{"name":"code-repo","value":I.REPO},{"name":"code-ref","value":I.REF},
         {"name":"code-verified","value":I.VERIFIED},{"name":"re-origin","value":"code"}]
    if code: t.insert(1, {"name":"code-path","value":code[:250]})
    return t
def batch(id_, ops):
    return {"protocol":"eafb/0.2","id":id_,"repo":"EAEXAMPLE","ops":ops}
def write(b, ready=True):
    s = json.dumps(b, ensure_ascii=False, indent=1)
    io.open("ready/req-%s.json" % b["id"], "w", encoding="utf-8").write(s)
    return s
os.makedirs("ready", exist_ok=True)

def r1():
    ops = [
     {"op":"create_or_update_package","parent":ROOT,"name":"Catalogues","notes":"Zrcadlo větve Catalogues EMR - reverse add-inu EA File Bridge (RE-FULL, 2026-10-14)."},
     {"op":"create_or_update_package","parent":"$0","name":"Solution Artefacts"},
     {"op":"create_or_update_package","parent":"$1","name":"EA File Bridge","notes":"Platforma EA File Bridge - katalog komponent odvozený z kódu (src @ %s)." % I.REF},
     {"op":"create_or_update_package","parent":ROOT,"name":"Logical Design","notes":"Zrcadlo větve Logical Design EMR - reverse add-inu EA File Bridge."},
     {"op":"create_or_update_package","parent":"$3","name":"EA File Bridge"},
    ]
    comps = [{"package":"$2","type":c["type"],"name":c["name"],"notes":c["notes"],"taggedValues":tv(c["code"])} for c in I.COMPONENTS]
    ops.append({"op":"create_or_update_elements","elements":comps})
    withif = [i for i,c in enumerate(I.COMPONENTS) if c["ops"]]
    ifs = [{"package":"$2","type":"Interface","name":I.COMPONENTS[i]["name"]+" Interface",
            "notes":"Rozhraní komponenty %s (reverse z kódu)." % I.COMPONENTS[i]["name"],
            "taggedValues":[{"name":"re-origin","value":"code"}]} for i in withif]
    ops.append({"op":"create_or_update_elements","elements":ifs})
    ops.append({"op":"create_or_update_connectors","connectors":[
        {"source":"$5[%d]"%ci,"target":"$6[%d]"%k,"type":"Realisation"} for k,ci in enumerate(withif)]})
    return batch("re-10-katalog-kostra", ops)

def load_ids():
    d = json.load(io.open("../../responses/res-re-10-katalog-kostra.json", encoding="utf-8-sig"))
    R = d["results"]
    comp = {I.COMPONENTS[i]["key"]: it for i, it in enumerate(R[5]["items"])}
    withif = [c["key"] for c in I.COMPONENTS if c["ops"]]
    iface = {k: R[6]["items"][j] for j, k in enumerate(withif)}
    pk = {"cat": R[2]["items"][0], "ld": R[4]["items"][0]}
    return comp, iface, pk

def r2():
    comp, iface, pk = load_ids()
    ops = []
    for c in I.COMPONENTS:
        if not c["ops"]: continue
        ol = []
        for (n, params, ret, notes, cp) in c["ops"]:
            ol.append({"name": n, "returnType": ret, "notes": notes,
                       "parameters": [{"name": p["name"], "type": p["type"], "notes": p["notes"]} for p in params],
                       "taggedValues": tv(cp)})
        ops.append({"op": "create_or_update_operations", "element": iface[c["key"]]["guid"], "operations": ol})
    n_ops = len(ops)
    ops.append({"op": "create_or_update_connectors", "connectors": [
        {"source": comp[s]["guid"], "target": comp[t]["guid"], "type": "Usage",
         "notes": note, "direction": "FromSourceToTarget"} for s, t, note in I.USAGES]})
    ops.append({"op": "create_or_update_diagram", "diagrams": [
        {"package": pk["cat"]["guid"], "type": "Component", "name": "EA File Bridge - Component Overview",
         "notes": "Přehled komponent add-inu EA File Bridge dle IDesign (reverse z kódu src @ %s). Vazby Usage = skutečná volání v kódu; poznámka as-implemented označuje odchylky od směru volání IDesign." % I.REF}]})
    rows = {"IDS-IDesign::IDS-Client": 40, "IDS-IDesign::IDS-Manager": 190, "IDS-IDesign::IDS-Engine": 340,
            "IDS-IDesign::IDS-Resource Access": 520, "IDS-IDesign::IDS-DB Resource": 700, "IDS-IDesign::IDS-File Resource": 700}
    cnt = {}
    pl = []
    W, H, GAP = 170, 80, 25
    for c in I.COMPONENTS:
        if c["type"] == "IDS-IDesign::IDS-Utility":
            pl.append({"element": comp[c["key"]]["guid"], "x": 1250, "y": 40, "width": W, "height": H}); continue
        y = rows[c["type"]]; key = y
        k = cnt.get(key, 0); cnt[key] = k + 1
        n = sum(1 for z in I.COMPONENTS if rows.get(z["type"]) == y)
        x0 = 40 + (6 - n) * (W + GAP) // 2
        if c["key"] == "xf": x0 = 40 + (6 - 2) * (W + GAP) // 2
        pl.append({"element": comp[c["key"]]["guid"], "x": x0 + k * (W + GAP), "y": y, "width": W, "height": H})
    ops.append({"op": "place_elements_on_diagram", "diagram": "$%d[0]" % (n_ops + 1), "elementPlacements": pl})
    return batch("re-11-katalog-operace", ops)


def load_r2():
    d = json.load(io.open("../../responses/res-re-11-katalog-operace.json", encoding="utf-8-sig"))
    opid = {}
    j = 0
    for c in I.COMPONENTS:
        if not c["ops"]: continue
        for k, o in enumerate(c["ops"]):
            opid[(c["key"], o[0])] = d["results"][j]["items"][k]["id"]
        j += 1
    return opid

def r3():
    comp, iface, pk = load_ids(); opid = load_r2()
    ops = []
    def pkg(parent, name, notes=""):
        ops.append({"op":"create_or_update_package","parent":parent,"name":name,"notes":notes}); return "$%d" % (len(ops)-1)
    ld = pk["ld"]["guid"]
    cpk = {"rm": pkg(ld, "EAFB Request Manager"), "mea": pkg(ld, "EAFB Model Element Access")}
    spk = {}
    for s in I.SERVICES:
        spk[s["name"]] = pkg(cpk[s["comp"]], s["name"], "Service package služby %s (reverse z kódu)." % s["name"])
    ldmp = pkg(pkg(ld, "EA Repository"), "LDM of EA Repository", "Logický datový model repozitáře EA tak, jak ho bridge používá (reverse z SQL a Automation volání v src).")
    # SR + DTO + Req/Res per sluzba
    svc_idx = {}
    for s in I.SERVICES:
        c = [x for x in I.COMPONENTS if x["key"] == s["comp"]][0]
        cp = [o[4] for o in c["ops"] if o[0] == s["op"]][0]
        els = [
         {"package": spk[s["name"]], "type":"CSOB-ITAN::Service Realization", "name":"SR "+s["name"],
          "notes":"Servisní realizace operace %s.%s - průběh odvozený z kódu (as-implemented)." % (c["name"]+" Interface", s["op"]),
          "taggedValues":[{"name":"505-1 Operation Link","ids":[{"type":"Operation","id":opid[(s["comp"], s["op"])]}]}] + tv(cp)},
         {"package": spk[s["name"]], "type":"CSOB-ITAN::Data Transfer Object", "name":"DTO "+s["name"],
          "notes":"DTO služby %s. Kontrakt žije v kódu (contractAuthority physical): %s; DTO je logický komentář, ne kopie." % (s["name"], cp),
          "taggedValues": tv(cp)},
         {"package": spk[s["name"]], "type":"Class", "name":s["name"]+" Request", "notes":"Request služby %s." % s["name"]},
         {"package": spk[s["name"]], "type":"Class", "name":s["name"]+" Response", "notes":"Response služby %s." % s["name"]},
        ]
        ops.append({"op":"create_or_update_elements","elements":els}); svc_idx[s["name"]] = len(ops)-1
    for s in I.SERVICES:
        i = svc_idx[s["name"]]
        ops.append({"op":"create_or_update_attributes","element":"$%d[2]"%i,"attributes":s["req"]})
        ops.append({"op":"create_or_update_attributes","element":"$%d[3]"%i,"attributes":s["res"]})
    conns = []
    for s in I.SERVICES:
        i = svc_idx[s["name"]]
        for k in (2,3):
            conns.append({"source":"$%d[1]"%i,"target":"$%d[%d]"%(i,k),"type":"Aggregation","sourceEnd":{"aggregation":2},"targetEnd":{"multiplicity":"1"}})
    ops.append({"op":"create_or_update_connectors","connectors":conns})
    ops.append({"op":"create_or_update_diagram","diagrams":[{"package":spk[s["name"]],"type":"CSOB-ITAN::Version Root Diagram","name":"version_"+s["name"]} for s in I.SERVICES]})
    # LDM
    ents = [{"package":ldmp,"type":"Class","stereotypes":"entity","name":n,"alias":t,"notes":nt+" Fyzická tabulka: %s." % t,
             "taggedValues":[{"name":"re-origin","value":"code"}]} for n,t,nt in I.ENTITIES]
    ops.append({"op":"create_or_update_elements","elements":ents}); ei = len(ops)-1
    names = [e[0] for e in I.ENTITIES]
    for k in range(len(names)):
        ops.append({"op":"create_or_update_operations","element":"$%d[%d]"%(ei,k),
                    "operations":[{"name":x,"returnType":"void"} for x in ("C","R","U","D")]})
    ops.append({"op":"create_or_update_connectors","connectors":[
        {"source":"$%d[%d]"%(ei,names.index(a)),"target":"$%d[%d]"%(ei,names.index(b)),"type":"Association","name":nm,
         "sourceEnd":{"multiplicity":ma},"targetEnd":{"multiplicity":mb}} for a,b,ma,mb,nm in I.ASSOCS]})
    ops.append({"op":"create_or_update_diagram","diagrams":[{"package":ldmp,"type":"CSOB-ITAN::LD-Structural","name":"LDM of EA Repository"}]})
    pos = {"Package":(300,40),"Baseline":(40,40),"Diagram":(560,40),"Element":(300,260),"TaggedValue":(40,460),"Attribute":(230,460),"Operation":(420,460),"Connector":(610,300)}
    ops.append({"op":"place_elements_on_diagram","diagram":"$%d[0]"%(len(ops)-1),"elementPlacements":[
        {"element":"$%d[%d]"%(ei,k),"x":pos[n][0],"y":pos[n][1],"width":160,"height":110} for k,n in enumerate(names)]})
    return batch("re-12-logical-design", ops)


def load_r3():
    d = json.load(io.open("../../responses/res-re-12-logical-design.json", encoding="utf-8-sig"))
    R = d["results"]
    svc = {s["name"]: R[8+i]["items"] for i, s in enumerate(I.SERVICES)}   # SR, DTO, Req, Res
    spk = {s["name"]: R[2+i]["items"][0] for i, s in enumerate(I.SERVICES)}
    ent = {I.ENTITIES[k][0]: it for k, it in enumerate(R[22]["items"])}
    crud = {}
    for k, e in enumerate(I.ENTITIES):
        for it in R[23+k]["items"]: crud[(e[0], it["name"])] = it["id"]
    return svc, spk, ent, crud

SRDG = {"ProcessRequest":1196,"Ping":1198,"CreateOrUpdateElements":1200,"DeleteFromModel":1202}
DTODG = {"ProcessRequest":1197,"Ping":1199,"CreateOrUpdateElements":1201,"DeleteFromModel":1203}
SCD = dict(zip(["pump","ui","rm","val","scope","risk","bpol","qc","itan","mea","dga","bla","aud","code","xfa"], range(1178,1193)))
SCD["util"] = 1194
STEREO = {"IDS-IDesign::IDS-Manager":"IDS-Manager","IDS-IDesign::IDS-Engine":"IDS-Engine","IDS-IDesign::IDS-Resource Access":"IDS-Resource Access"}

def r4():
    comp, iface, pk = load_ids(); opid = load_r2(); svc, spk, ent, crud = load_r3()
    ops = []
    # DTO diagramy
    for s in I.SERVICES:
        it = svc[s["name"]]
        ops.append({"op":"place_elements_on_diagram","diagram":DTODG[s["name"]],"elementPlacements":[
            {"elementID":it[1]["id"],"x":260,"y":30,"width":200,"height":70},
            {"elementID":it[2]["id"],"x":40,"y":180,"width":260,"height":40+22*len(s["req"])},
            {"elementID":it[3]["id"],"x":380,"y":180,"width":300,"height":40+22*len(s["res"])}]})
    # Service Contract Detail: komponenta + rozhrani
    for c in I.COMPONENTS:
        if c["key"] not in SCD: continue
        pl = [{"elementID":comp[c["key"]]["id"],"x":60,"y":60,"width":200,"height":90}]
        if c["key"] in iface: pl.append({"elementID":iface[c["key"]]["id"],"x":360,"y":40,"width":360,"height":40+16*len(c["ops"])})
        ops.append({"op":"place_elements_on_diagram","diagram":SCD[c["key"]],"elementPlacements":pl})
    # SR sekvence
    ctype = {c["key"]: c["type"] for c in I.COMPONENTS}
    for s in I.SERVICES:
        q = I.SEQ[s["name"]]; pkgg = spk[s["name"]]["guid"]
        els = [{"package":pkgg,"type":"DiagramGate","name":""}]
        for l in q["lifelines"]:
            if l.startswith("E:"):
                els.append({"package":pkgg,"type":"Object","name":"","classifierID":ent[l[2:]]["id"],"stereotypes":"entity"})
            else:
                els.append({"package":pkgg,"type":"Object","name":"","classifierID":comp[l]["id"],"stereotypes":STEREO[ctype[l]]})
        for r in q["refs"]:
            els.append({"package":pkgg,"type":"InteractionOccurrence","name":"","classifierID":svc[r][0]["id"]})
        ops.append({"op":"create_or_update_elements","elements":els}); ei = len(ops)-1
        pl = [{"element":"$%d[0]"%ei,"x":0,"y":110,"width":10,"height":10}]
        for k, l in enumerate(q["lifelines"]):
            pl.append({"element":"$%d[%d]"%(ei,k+1),"x":90+k*170,"y":40,"width":130,"height":60})
        n = len(q["lifelines"])
        for k, r in enumerate(q["refs"]):
            pl.append({"element":"$%d[%d]"%(ei,n+1+k),"x":90+170*(q["lifelines"].index("mea"))-40,"y":540+k*70,"width":260,"height":50})
        ops.append({"op":"place_elements_on_diagram","diagram":SRDG[s["name"]],"elementPlacements":pl})
        idx = {"G":0}; idx.update({l:k+1 for k,l in enumerate(q["lifelines"])})
        msgs = []
        for seq, (a, b, o, nm, args) in enumerate(q["msgs"], 1):
            m = {"source":"$%d[%d]"%(ei,idx[a]),"target":"$%d[%d]"%(ei,idx[b]),"seqNo":seq}
            if o == "RETURN": m.update({"isReturn":True,"name":nm})
            elif o is None: m.update({"name":nm,"arguments":args})
            elif o[0] == "E": m.update({"operation":crud[(o[1],o[2])],"notes":args})
            else:
                m.update({"operation":opid[o]})
                if args: m["arguments"] = args
            msgs.append(m)
        ops.append({"op":"create_or_update_messages","diagram":SRDG[s["name"]],"messages":msgs})
        ops.append({"op":"apply_classifier_stereotypes","diagram":SRDG[s["name"]]})
    # poznamky na SR prvky (vetve a nalezy)
    ops.append({"op":"create_or_update_elements","elements":[
        {"elementID":svc[s["name"]][0]["id"],"notes":"Servisní realizace operace %s - průběh odvozený z kódu (as-implemented, src @ %s).\n%s" % (s["op"], I.REF, I.SEQ[s["name"]]["note"])} for s in I.SERVICES]})
    return batch("re-14-realizace", ops)


def r4b():
    """Bez Diagram Gate (bridge je neumi - zaprah). Vstup = self-message na prvni lifeline s operaci, bez return."""
    comp, iface, pk = load_ids(); opid = load_r2(); svc, spk, ent, crud = load_r3()
    ops = []
    ctype = {c["key"]: c["type"] for c in I.COMPONENTS}
    for s in I.SERVICES:
        q = I.SEQ[s["name"]]; pkgg = spk[s["name"]]["guid"]
        els = []
        for l in q["lifelines"]:
            if l.startswith("E:"):
                els.append({"package":pkgg,"type":"Object","name":"","classifierID":ent[l[2:]]["id"],"stereotypes":"entity"})
            else:
                els.append({"package":pkgg,"type":"Object","name":"","classifierID":comp[l]["id"],"stereotypes":STEREO[ctype[l]]})
        for r in q["refs"]:
            els.append({"package":pkgg,"type":"InteractionOccurrence","name":"","classifierID":svc[r][0]["id"]})
        ops.append({"op":"create_or_update_elements","elements":els}); ei = len(ops)-1
        pl = []
        for k, l in enumerate(q["lifelines"]):
            pl.append({"element":"$%d[%d]"%(ei,k),"x":40+k*170,"y":40,"width":130,"height":60})
        n = len(q["lifelines"])
        for k, r in enumerate(q["refs"]):
            pl.append({"element":"$%d[%d]"%(ei,n+k),"x":40+170*(q["lifelines"].index("mea"))-40,"y":540+k*70,"width":260,"height":50})
        ops.append({"op":"place_elements_on_diagram","diagram":SRDG[s["name"]],"elementPlacements":pl})
        idx = {l:k for k,l in enumerate(q["lifelines"])}
        msgs = []; seq = 0
        for (a, b, o, nm, args) in q["msgs"]:
            if o == "RETURN": continue
            if a == "G": a = b
            seq += 1
            m = {"source":"$%d[%d]"%(ei,idx[a]),"target":"$%d[%d]"%(ei,idx[b]),"seqNo":seq}
            if o is None: m.update({"name":nm,"arguments":args})
            elif o[0] == "E": m.update({"operation":crud[(o[1],o[2])],"notes":args})
            else:
                m.update({"operation":opid[o]})
                if args: m["arguments"] = args
            msgs.append(m)
        ops.append({"op":"create_or_update_messages","diagram":SRDG[s["name"]],"messages":msgs})
        ops.append({"op":"apply_classifier_stereotypes","diagram":SRDG[s["name"]]})
    ops.append({"op":"create_or_update_elements","elements":[
        {"elementID":svc[s["name"]][0]["id"],"notes":"Servisní realizace operace %s - průběh odvozený z kódu (as-implemented, src @ %s).\n%s\nBez Diagram Gate (vstup a výstup): bridge v0.21 gate neumí založit (E_EXCEPTION Invalid type) - oprava v zápřahu; vstupní volání je zatím zpráva lifeline sama na sebe, návratová zpráva chybí." % (s["op"], I.REF, I.SEQ[s["name"]]["note"])} for s in I.SERVICES]})
    return batch("re-14b-realizace-bez-gatu", ops)


import ir_fa as F
def r5():
    """FA kostra: balicky, akteri, prepouzitelna pravidla, UC, UCR, LS, verzni diagramy."""
    ops = []
    def pkg(parent, name, notes=""):
        ops.append({"op":"create_or_update_package","parent":parent,"name":name,"notes":notes}); return "$%d" % (len(ops)-1)
    ba_root = pkg(ROOT, "Business Applications", "Zrcadlo větve Business Applications EMR - funkční analýza add-inu EA File Bridge (reverse z kódu, as-implemented).")
    ba = pkg(ba_root, "EA File Bridge", "Business aplikace EA File Bridge = add-in EA + pumpa + schránkový kanál. FA odvozená z kódu src @ %s a pump.wsf v0.6 - popisuje, co nástroj dělá, ne co měl dělat. Logické obrazovky = menu, okna a Output tab add-inu." % I.REF)
    actors_p = pkg(ba, "ACTORS"); gv = pkg(ba, "GLOBAL VIEWS"); oth = pkg(ba, "OTHER ELEMENTS"); rules = pkg(ba, "RULES (REUSABLE)")
    ucp = {u["code"]: pkg(ba, u["code"]+" "+u["name"]) for u in F.UC}
    ops.append({"op":"create_or_update_elements","elements":[{"package":actors_p,"type":"Actor","name":n,"notes":d} for n,d in F.ACTORS]}); ai = len(ops)-1
    ops.append({"op":"create_or_update_elements","elements":[{"package":ucp[u["code"]],"type":"UseCase","name":u["code"]+" "+u["name"],"notes":u["notes"],"taggedValues":tv("")} for u in F.UC]}); ui_ = len(ops)-1
    ops.append({"op":"create_or_update_diagram","diagrams":[{"package":ucp[u["code"]],"type":"CSOB-ITAN::Version Root Diagram","name":"version_"+u["code"]+" "+u["name"]} for u in F.UC]})
    ops.append({"op":"create_or_update_diagram","diagrams":[{"owningElement":"$%d[%d]"%(ui_,k),"type":"CSOB-ITAN::FA-Behavioral","name":u["code"]+" "+u["name"],"styleEx":"MDGDgm=CSOB-ITAN::FA-Behavioral;MDGView=CSOB-ITAN::Use Case Detail;"} for k,u in enumerate(F.UC)]}); di = len(ops)-1
    ops.append({"op":"create_or_update_elements","elements":[{"elementID":"$%d[%d]"%(ui_,k),"isComposite":True,"compositeDiagram":"$%d[%d]"%(di,k)} for k,u in enumerate(F.UC)]})
    ops.append({"op":"create_or_update_diagram","diagrams":[{"package":gv,"type":"CSOB-ITAN::FA-Behavioral","name":"Use Case Survey of EA File Bridge","notes":"Přehled use casů add-inu EA File Bridge (bez pravidel a požadavků - ta patří jen na detail)."}]})
    # MDG typy na konci - kazdy vlastni op (pri padu zbytek skipped, predchozi zustava)
    ops.append({"op":"create_or_update_elements","elements":[{"package":rules,"type":"CSOB-ITAN::Behavioral Rule","name":c+" "+n,"notes":t,"taggedValues":tv(cp)} for c,n,cp,t in F.BRU]})
    ops.append({"op":"create_or_update_elements","elements":[{"package":ucp[u["code"]],"type":"CSOB-ITAN::Use Case Realization","name":"UCR-"+u["code"][3:]+" "+u["name"],"notes":"Realizace %s: aktér → %s → EAFB Request Manager%s (as-implemented z kódu)." % (u["code"], "EAFB Pump" if u["client"]=="pump" else "EAFB Add-in UI", (" + ref SR "+u["sr"]) if u["sr"] else "")} for u in F.UC]})
    ls_el = []
    for name, owner, notes, attrs, opsl in F.LS:
        ls_el.append({"package": oth if owner=="OTHER" else ucp[owner], "type":"CSOB-ITAN::Logical Screen","name":name,"notes":notes})
    ops.append({"op":"create_or_update_elements","elements":ls_el}); li = len(ops)-1
    for k,(name, owner, notes, attrs, opsl) in enumerate(F.LS):
        ops.append({"op":"create_or_update_attributes","element":"$%d[%d]"%(li,k),"attributes":[{"name":a,"type":t,"notes":d} for a,t,d in attrs]})
        if opsl: ops.append({"op":"create_or_update_operations","element":"$%d[%d]"%(li,k),"operations":[{"name":o,"returnType":"void","notes":d} for o,d in opsl]})
    return batch("re-30-fa-kostra", ops)


def load_r5():
    d = json.load(io.open("../../responses/res-re-30-fa-kostra.json", encoding="utf-8-sig"))
    R = d["results"]
    P = {"ba_root": R[0]["items"][0], "ba": R[1]["items"][0], "actors": R[2]["items"][0], "gv": R[3]["items"][0], "oth": R[4]["items"][0], "rules": R[5]["items"][0]}
    ucp = {u["code"]: R[6+k]["items"][0] for k, u in enumerate(F.UC)}
    actors = {n: it for (n, _), it in zip(F.ACTORS, R[15]["items"])}
    uc = {u["code"]: it for u, it in zip(F.UC, R[16]["items"])}
    ucd = {u["code"]: it for u, it in zip(F.UC, R[18]["items"])}   # UC detail diagramy
    survey = R[20]["items"][0]
    bru = {c: it for (c, n, cp, t), it in zip(F.BRU, R[21]["items"])}
    ucr = {u["code"]: it for u, it in zip(F.UC, R[22]["items"])}
    ls = {name: it for (name, o, n, a, op), it in zip(F.LS, R[23]["items"])}
    return P, ucp, actors, uc, ucd, survey, bru, ucr, ls

def r6():
    """Podminky, lokalni pravidla, scenare (rebuild operace = ELEVATED)."""
    P, ucp, actors, uc, ucd, survey, bru, ucr, ls = load_r5()
    ops = []
    for u in F.UC:
        g = uc[u["code"]]["guid"]
        ops.append({"op":"create_or_update_constraints","element":g,"constraints":[{"name":n,"type":t,"notes":x} for n,t,x in u["pre"]+u["pst"]]})
        ops.append({"op":"create_or_update_requirements","element":g,"requirements":[{"name":n,"notes":x,"type":"Functional","status":"Approved"} for n,x in u["req"]]})
        ops.append({"op":"create_or_update_scenarios","element":g,"scenarios":u["scen"]})
    return batch("re-31-fa-scenare", ops)


def r6a(): return _r6part("re-31a-fa-scenare", F.UC[:5])
def r6b(): return _r6part("re-31b-fa-scenare", F.UC[5:])
def _r6part(id_, ucs):
    P, ucp, actors, uc, ucd, survey, bru, ucr, ls = load_r5()
    ops = []
    for u in ucs:
        g = uc[u["code"]]["guid"]
        ops.append({"op":"create_or_update_constraints","element":g,"constraints":[{"name":n,"type":t,"notes":x} for n,t,x in u["pre"]+u["pst"]]})
        ops.append({"op":"create_or_update_requirements","element":g,"requirements":[{"name":n,"notes":x,"type":"Functional","status":"Approved"} for n,x in u["req"]]})
        ops.append({"op":"create_or_update_scenarios","element":g,"scenarios":u["scen"]})
    return batch(id_, ops)


UCRDG = {'UC-9510%d'%(k+1): 1228+k for k in range(9)}
LSDG = {}
def r7(sel=None, survey_only=False):
    P, ucp, actors, uc, ucd, survey, bru, ucr, ls = load_r5()
    UCS = [u for u in F.UC if (sel is None or u['code'] in sel)]
    comp, iface, pk = load_ids(); opid = load_r2(); svc, spk, ent, crud = load_r3()
    ops = []
    # --- vazby UC detailu ---
    conns = []
    for u in ([] if survey_only else UCS):
        ug = uc[u["code"]]["guid"]
        for a in u["actors"]:
            conns.append({"source":actors[a]["guid"],"target":ug,"type":"Association","direction":"FromSourceToTarget"})
        conns.append({"source":ucr[u["code"]]["guid"],"target":ug,"type":"Realisation","direction":"FromSourceToTarget"})
        for l in u["ls"]:
            conns.append({"source":ls[l]["guid"],"target":ug,"type":"Dependency","direction":"FromSourceToTarget"})
        for b in u["bru"]:
            conns.append({"source":ug,"target":bru[b]["guid"],"type":"Usage","direction":"FromSourceToTarget"})
    if conns: ops.append({"op":"create_or_update_connectors","connectors":conns})
    # --- hranice systemu per UC + UC detail diagramy ---
    bnd = [{"package":ucp[u["code"]]["guid"],"type":"Boundary","name":"EA File Bridge"} for u in ([] if survey_only else UCS)]
    if bnd: ops.append({"op":"create_or_update_elements","elements":bnd}); bi = len(ops)-1
    for k, u in enumerate([] if survey_only else UCS):
        nls = len(u["ls"]); bh = 330 + 80*nls
        pl = [{"element":"$%d[%d]"%(bi,k),"x":220,"y":20,"width":540,"height":bh},
              {"elementID":uc[u["code"]]["id"],"x":330,"y":60,"width":320,"height":100},
              {"elementID":ucr[u["code"]]["id"],"x":330,"y":200,"width":320,"height":70}]
        for j, l in enumerate(u["ls"]):
            pl.append({"elementID":ls[l]["id"],"x":330,"y":300+80*j,"width":320,"height":60})
        for j, a in enumerate(u["actors"]):
            pl.append({"elementID":actors[a]["id"],"x":40,"y":60+140*j,"width":90,"height":100})
        for j, b in enumerate(u["bru"]):
            pl.append({"elementID":bru[b]["id"],"x":820,"y":20+75*j,"width":300,"height":60})
        ops.append({"op":"place_elements_on_diagram","diagram":ucd[u["code"]]["id"],"elementPlacements":pl})
    # --- survey ---
    if survey_only:
      pl = [{"elementID":actors[n]["id"],"x":40,"y":60+200*j,"width":90,"height":100} for j,(n,_) in enumerate(F.ACTORS)]
      for k, u in enumerate(F.UC):
        pl.append({"elementID":uc[u["code"]]["id"],"x":300+(k%3)*340,"y":40+(k//3)*140,"width":300,"height":100})
      ops.append({"op":"place_elements_on_diagram","diagram":survey["id"],"elementPlacements":pl})
    # --- LS kompozitni diagramy: umistit LS element ---
    lsdg = dict(zip([n for n,_,_,_,_ in F.LS], range(1237,1242)))
    for name,_,_,attrs,opsl in (F.LS if survey_only else []):
        ops.append({"op":"place_elements_on_diagram","diagram":lsdg[name],"elementPlacements":[{"elementID":ls[name]["id"],"x":40,"y":40,"width":420,"height":80+20*(len(attrs)+len(opsl))}]})
    # --- UCR sekvence ---
    MGR = {"ProcessRequest":("rm","ProcessRequest"),"ConfirmPending":("rm","ConfirmPending"),"GetStatus":("rm","GetStatus")}
    ucr_seq = {
     "UC-95101": [("A","C","uloží req-<id>.json do requests\\"),("C","M",("rm","ProcessRequest")),("ref","ProcessRequest"),("C","A","res-<id>.json (done | error | confirm_required)")],
     "UC-95102": [("A","C","Ano / Ne / Storno v okně pumpy"),("C","M",("rm","ConfirmPending")),("ref","ProcessRequest"),("C","A","výsledek na konzoli a v Output tabu")],
     "UC-95103": [("A","C","menu AI Bridge → Zpracovat dávku ze schránky"),("C","M",("rm","ProcessRequest")),("ref","ProcessRequest"),("C","A","dialog + chat ACK ve schránce")],
     "UC-95104": [("A","C","menu AI Bridge → Zpracovat dávky ze složky"),("C","M",("rm","ProcessRequest")),("ref","ProcessRequest"),("C","A","souhrn počtů v dialogu")],
     "UC-95105": [("A","C","menu AI Bridge → Kontext výběru do schránky"),("C","X","mea",("mea","GetSelectedContext")),("C","A","věta + JSON eafb-context ve schránce")],
     "UC-95106": [("A","C","menu AI Bridge → Stav bridge"),("C","M",("rm","GetStatus")),("C","A","dialog Stav bridge")],
     "UC-95107": [("A","C","dvojklik na řádek Output tabu AI Bridge"),("C","C","vybere prvek podle markeru (el:|pkg:|dgm:ID) v Project browseru")],
     "UC-95108": [("A","C","dávka deploy_src do requests\\ (nebo bootstrap skript v EA)"),("C","M",("rm","ProcessRequest")),("C","X","code",("code","DeploySrc")),("C","A","res + reloadCode → pumpa přenačte kód")],
     "UC-95109": [("A","C","menu AI Bridge → Úklid automatických baselines"),("C","X","bpol",("bpol","CleanupBaselines")),("C","A","výčet smazaných záloh v Output tabu")],
    }
    STEREO2 = dict(STEREO); STEREO2["IDS-IDesign::IDS-Client"] = "IDS-Client"
    ctype = {c["key"]: c["type"] for c in I.COMPONENTS}
    for u in ([] if survey_only else UCS):
        q = ucr_seq[u["code"]]; pkgg = ucp[u["code"]]["guid"]; dg = None
        clientk = u["client"]
        lifel = [("A", actors[u["primary"]]["id"], None), ("C", comp[clientk]["id"], STEREO2[ctype[clientk]])]
        if any(m[1]=="M" for m in q): lifel.append(("M", comp["rm"]["id"], "IDS-Manager"))
        for m in q:
            if m[1]=="X": lifel.append(("X", comp[m[2]]["id"], STEREO2[ctype[m[2]]]))
        els = []
        for key, cid, st in lifel:
            e = {"package":pkgg,"type":"Object","name":"","classifierID":cid}
            if st: e["stereotypes"] = st
            els.append(e)
        refs = [m[1] for m in q if m[0]=="ref"]
        for r in refs: els.append({"package":pkgg,"type":"InteractionOccurrence","name":"ref SR "+r,"classifierID":svc[r][0]["id"]})
        ops.append({"op":"create_or_update_elements","elements":els}); ei = len(ops)-1
        idx = {key:k for k,(key,_,_) in enumerate(lifel)}
        ops.append({"op":"create_or_update_elements","elements":[{"elementID":"$%d[%d]"%(ei,k),"name":""} for k in range(len(lifel))]})
        pl = [{"element":"$%d[%d]"%(ei,k),"x":40+k*230,"y":40,"width":150,"height":60} for k in range(len(lifel))]
        for j, r in enumerate(refs): pl.append({"element":"$%d[%d]"%(ei,len(lifel)+j),"x":40+230*idx.get("M",1)-20,"y":330+70*j,"width":260,"height":50})
        # kompozitni diagram UCR (auto-kompozit MDG) - dohledat
        dgid = UCRDG[u["code"]]
        ops.append({"op":"place_elements_on_diagram","diagram":dgid,"elementPlacements":pl})
        msgs = []; seq = 0
        for m in q:
            if m[0]=="ref": continue
            seq += 1
            mm = {"source":"$%d[%d]"%(ei,idx[m[0]]),"target":"$%d[%d]"%(ei,idx[m[1]]),"seqNo":seq}
            if isinstance(m[2], tuple): mm["operation"] = opid[m[2]]
            elif m[1]=="X": mm["operation"] = opid[m[3]]
            else: mm["name"] = m[2]
            msgs.append(mm)
        ops.append({"op":"create_or_update_messages","diagram":dgid,"messages":msgs})
        ops.append({"op":"apply_classifier_stereotypes","diagram":dgid})
    return batch("re-32s-fa-survey" if survey_only else "re-32-%s" % "-".join(x[3:] for x in sel), ops)


def r7s(): return r7(survey_only=True)
def r7_1(): return r7(sel=['UC-95101'])
def r7_2(): return r7(sel=['UC-95102'])
def r7_3(): return r7(sel=['UC-95103'])
def r7_4(): return r7(sel=['UC-95104'])
def r7_5(): return r7(sel=['UC-95105'])
def r7_6(): return r7(sel=['UC-95106'])
def r7_7(): return r7(sel=['UC-95107'])
def r7_8(): return r7(sel=['UC-95108'])
def r7_9(): return r7(sel=['UC-95109'])


def _r8(id_, ucs):
    P, ucp, actors, uc, ucd, survey, bru, ucr, ls = load_r5()
    ops = []
    for u in ucs:
        nls = len(u["ls"]); bh = 330 + 230*nls
        pl = [{"elementID":uc[u["code"]]["id"],"x":330,"y":60,"width":320,"height":100},
              {"elementID":ucr[u["code"]]["id"],"x":330,"y":200,"width":320,"height":70}]
        for j, l in enumerate(u["ls"]):
            pl.append({"elementID":ls[l]["id"],"x":300,"y":310+230*j,"width":400,"height":200})
        ops.append({"op":"place_elements_on_diagram","diagram":ucd[u["code"]]["id"],"elementPlacements":pl})
    # hranice: dohledat podle jmena v balicku - zapise se zvlast (ids z res re-32-*)
    for u in ucs:
        d = json.load(io.open("../../responses/res-re-32-%s.json" % u["code"][3:], encoding="utf-8-sig"))
        bid = d["results"][1]["items"][0]["id"]
        nls = len(u["ls"])
        if nls: ops.append({"op":"place_elements_on_diagram","diagram":ucd[u["code"]]["id"],"elementPlacements":[{"elementID":bid,"x":220,"y":20,"width":540,"height":330+230*nls}]})
    return batch(id_, ops)
def r8a(): return _r8("re-34a-ls-rozestupy", [u for u in F.UC if u["ls"]][:3])
def r8b(): return _r8("re-34b-ls-rozestupy", [u for u in F.UC if u["ls"]][3:])

if __name__ == "__main__":
    which = sys.argv[1]
    b = globals()[which]()
    print(write(b)[:600]); print("ops:", len(b["ops"]))
