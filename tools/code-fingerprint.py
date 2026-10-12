#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Otisk nasazeného kódu EA File Bridge (FB-PU-02, pumpa v0.6 / Z261004b-5).

Spočítá sha256 nad ne-konfiguračními soubory `src\\AICodeBridge.*.js` STEJNÝM
algoritmem jako `src\\AICodeBridge.FB_CodeFingerprint.js` (bootstrap i deploy_src
ho zapisují do modelu jako tagged values `fb.code.*` prvku AICodeBridge; `ping`,
„About AI Bridge" a hlášení startu session ho vypisují). Správce tak porovná,
co je v pracovní kopii (tento nástroj), s tím, co je v modelu (ping → `codeInfo`).

Algoritmus (měnit jen spolu s FB_CodeFingerprint.js):
  1. soubor → jméno operace (AICodeBridge.<Op>.js → <Op>); konfigurační operace
     CONFIG_OPS se vynechají;
  2. text: bez BOM, CRLF/CR → LF, bílé znaky na konci souboru pryč + "\\n";
  3. seřazeno podle jména operace (ASCII), zřetězeno "<Op>\\n<text>\\n";
  4. sha256 UTF-8 bajtů, hex lowercase; short = prvních 12 znaků.

Použití:
  python tools\\code-fingerprint.py                 # src\\ vedle tools\\
  python tools\\code-fingerprint.py <slozka src>    # jiná pracovní kopie
  python tools\\code-fingerprint.py --expect <hex>  # exit 1, když otisk nesouhlasí (CI, generálka)
  python tools\\code-fingerprint.py --json          # strojový výstup
"""
import argparse
import hashlib
import json
import os
import re
import sys

CONFIG_OPS = {"FB_Config", "FB_WriteScope", "FB_OpsAllowed", "FB_RiskPolicy", "FB_AccessGroups", "FB_QcConfig", "FB_ScaffoldConfig"}
NAME_RE = re.compile(r"^AICodeBridge\.([A-Za-z0-9_]+)\.js$")


def normalize(text):
    if text.startswith("﻿"):
        text = text[1:]
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text.rstrip() + "\n"


def fingerprint_files(files):
    """files = [(op_name, text)] -> dict(fingerprint, short, files, excluded)."""
    items, excluded = [], []
    for name, text in files:
        m = NAME_RE.match(name)
        op = m.group(1) if m else name
        if op in CONFIG_OPS:
            excluded.append(op)
            continue
        items.append((op, normalize(text)))
    items.sort(key=lambda x: x[0])
    data = "".join(op + "\n" + text + "\n" for op, text in items)
    hx = hashlib.sha256(data.encode("utf-8")).hexdigest()
    return {"fingerprint": hx, "short": hx[:12], "files": len(items), "excluded": sorted(excluded)}


def fingerprint_dir(src_dir):
    files = []
    for fn in sorted(os.listdir(src_dir)):
        if not NAME_RE.match(fn):
            continue
        with open(os.path.join(src_dir, fn), "r", encoding="utf-8", errors="strict") as fh:
            files.append((fn, fh.read()))
    return fingerprint_files(files)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Otisk nasazeného kódu EA File Bridge (sha256 nad src\\ bez konfigurace).")
    ap.add_argument("src", nargs="?", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"), help="složka src\\ (výchozí: vedle tools\\)")
    ap.add_argument("--expect", help="očekávaný otisk (celý nebo prefix) – exit 1 při neshodě")
    ap.add_argument("--json", action="store_true", help="výstup jako JSON")
    a = ap.parse_args(argv)
    src = os.path.abspath(a.src)
    if not os.path.isdir(src):
        print("CHYBA: složka src neexistuje: %s" % src, file=sys.stderr)
        return 2
    r = fingerprint_dir(src)
    r["src"] = src
    if a.json:
        print(json.dumps(r, ensure_ascii=False, indent=1))
    else:
        print("Otisk kodu (sha256 nad %d souboru src\\ bez konfigurace): %s" % (r["files"], r["fingerprint"]))
        print("short: %s | vynechano: %s" % (r["short"], ", ".join(r["excluded"]) or "-"))
        print("Porovnej s pingem (codeInfo.fingerprint), About AI Bridge nebo hlasenim startu session pumpy.")
    if a.expect:
        exp = a.expect.strip().lower()
        if not r["fingerprint"].startswith(exp):
            print("NESOUHLASI: ocekavano %s, spocitano %s" % (exp, r["fingerprint"]), file=sys.stderr)
            return 1
        print("souhlasi s --expect")
    return 0


if __name__ == "__main__":
    sys.exit(main())
