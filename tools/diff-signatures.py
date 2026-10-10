#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""diff-signatures.py <tag> [<ref>] - operace, jejichz seznam parametru se zmenil.

Porovna hlavicky "// AICodeBridge.Nazev(a, b)" vsech src/AICodeBridge.*.js
mezi dvema git refy (vychozi <ref> = HEAD). Pouziti pred kazdym tagem
(docs/PROTOKOL-EAFB.md kap. 11): zmeneny seznam parametru = radek do release
poznamky + kontrola parametru po nasazeni (docs/NAVOD-NASAZENI-KLIKACI.md).

Proc: bootstrap do 2026-10-10 u existujici operace prepsal jen kod a parametry
nechal (FB-PU-01) - novy parametr se v EA runtime nekompiloval a telo padalo
na "baseline is not defined". Od opravy bootstrap parametry srovnava, ale
pravidlo "novy parametr existujici operace se cte jen pres typeof" plati dal
(starsi bootstrap v cizim prostredi).

Vystup: radek per zmenena operace  "<operace>: (stare) -> (nove)",
pridane soubory jako "+ <operace>(params)", smazane jako "- <operace>(params)".
Exit code 0 = zadna zmena signatury existujicich operaci, 1 = zmeny, 2 = chyba.
--json vypise strojove citelny vystup (pro test v harnessu).
"""
import json
import re
import subprocess
import sys

HEADER = re.compile(r"^//\s*AICodeBridge\.([A-Za-z0-9_]+)\s*\(([^)]*)\)")
FILE = re.compile(r"^src/AICodeBridge\.([A-Za-z0-9_]+)\.js$")


def git(*args):
    p = subprocess.run(["git"] + list(args), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError("git %s: %s" % (" ".join(args), p.stderr.decode("utf-8", "replace").strip()))
    return p.stdout


def signatures(ref):
    """{operace: [parametry] | None}; None = hlavicka bez zavorek (EA_* lifecycle)."""
    out = {}
    names = git("ls-tree", "--name-only", ref, "src/").decode("utf-8", "replace").split("\n")
    for n in names:
        m = FILE.match(n.strip())
        if not m:
            continue
        op = m.group(1)
        code = git("show", "%s:%s" % (ref, n.strip())).decode("utf-8", "replace")
        if code.startswith("﻿"):
            code = code[1:]
        first = code.split("\n", 1)[0]
        h = HEADER.match(first)
        if h and h.group(1) == op:
            params = [p.strip() for p in h.group(2).split(",") if p.strip() != ""]
            out[op] = params
        else:
            out[op] = None
    return out


def compare(old, new):
    changed, added, removed = [], [], []
    for op in sorted(set(old) | set(new)):
        if op not in old:
            added.append((op, new[op]))
        elif op not in new:
            removed.append((op, old[op]))
        elif old[op] is not None and new[op] is not None and old[op] != new[op]:
            changed.append((op, old[op], new[op]))
    return changed, added, removed


def fmt(params):
    return "(" + ", ".join(params) + ")" if params is not None else "(bez hlavicky)"


def main(argv):
    as_json = "--json" in argv
    argv = [a for a in argv if a != "--json"]
    if len(argv) < 1:
        print(__doc__)
        return 2
    old_ref = argv[0]
    new_ref = argv[1] if len(argv) > 1 else "HEAD"
    try:
        old, new = signatures(old_ref), signatures(new_ref)
    except RuntimeError as e:
        print("CHYBA: %s" % e)
        return 2
    changed, added, removed = compare(old, new)
    if as_json:
        print(json.dumps({"old": old_ref, "new": new_ref,
                          "changed": [{"op": c[0], "old": c[1], "new": c[2]} for c in changed],
                          "added": [{"op": a[0], "params": a[1]} for a in added],
                          "removed": [{"op": r[0], "params": r[1]} for r in removed]}, ensure_ascii=False))
        return 1 if changed else 0
    print("diff-signatures %s -> %s: %d operaci v %s, %d v %s" % (old_ref, new_ref, len(old), old_ref, len(new), new_ref))
    for op, o, n in changed:
        print("%s: %s -> %s" % (op, fmt(o), fmt(n)))
    for op, p in added:
        print("+ %s%s" % (op, fmt(p)))
    for op, p in removed:
        print("- %s%s" % (op, fmt(p)))
    print("Zmenene signatury existujicich operaci: %d (nove soubory: %d, smazane: %d)" % (len(changed), len(added), len(removed)))
    if changed:
        print("-> kazda zmenena operace musi novy parametr cist pres typeof (PROTOKOL-EAFB kap. 11) a patri do release poznamky.")
    return 1 if changed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
