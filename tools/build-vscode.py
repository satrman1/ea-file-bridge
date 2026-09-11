#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-vscode.py — jediný zdroj pravdy pro strom `.github/` (Agent Skills, agent,
instructions, copilot-instructions) generovaný z kanonu `IT-ANALYSIS/Skilly/`.

Specifikace: IT-ANALYSIS/Zadani-Portace-VSCode-v2.md kap. 4.4 (body 1–7), kritéria
kap. 9 AK-1…AK-5, odchylka PV-R6 (ii): profil `kuryr` neexistuje, název MDG profilu
se nenahrazuje. Kontrakt placeholderů: zaprah-vlaken-2026-09-07b.md (hlavička dávky).

Použití (doma):
    python tools/build-vscode.py --kanon <cesta Skilly> --profile doma --set full
    python tools/build-vscode.py --profile doma --verify

Varianta s terminálem (PV-R8 ii, N-P8; docs/BUILD-VSCODE.md sekce „Terminál"):
    python tools/build-vscode.py --kanon <cesta Skilly> --profile doma --set full --terminal on --out .github-term

Použití (banka, korporátní repo s config/vscode-profile.banka.json):
    python tools/build-vscode.py --kanon <cesta kanonu> --profile banka --set thin
    python tools/build-vscode.py --profile banka --verify

Bez `--out` = `<repo>/.github` (repo = rodič složky tools/).
Bez `--templates` = `<kanon>/_vscode`.

Python 3 stdlib only; syntax držena kompatibilní s Python 3.6 (banka):
žádný walrus, žádné f-string `=`, žádné anotace list[str], žádné reconfigure().
"""

import argparse
import datetime
import hashlib
import io
import json
import os
import posixpath
import re
import shutil
import sys
from pathlib import Path

BUILD_VERSION = "1.1"

# ---------------------------------------------------------------------------
# Konstanty — sady skillů (Zadani-Portace-VSCode-v2.md kap. 5.1 + AK-1)
# ---------------------------------------------------------------------------

# Tenký řez (kap. 5.1): 5 skillů z kanonu; + 3 generované ze šablon `_vscode/skills/`
# (emr-konvence, eafb-bridge, e2e-f0-f1) = 8 skillů (AK-1).
SET_THIN = [
    "prevzeti-zadani",
    "emr-scaffold",
    "use-case-model",
    "use-case-analyst",
    "emr-qa",
]

# Plná sada (kap. 3.1 + 3.2, AK-1): všech 21 skillů kanonu kromě `sa-orchestrator`
# (ten je tělem agenta `sa-analytik`, ne skill — kap. 5.1). `ea-addin-developer`
# jen v profilu doma (PV-R7, N-P4). + 3 generované = 24 (doma) / 23 (banka).
SET_FULL = [
    "prevzeti-zadani",
    "emr-scaffold",
    "use-case-model",
    "use-case-analyst",
    "emr-qa",
    "logicka-obrazovka",
    "realizace-uc",
    "katalog-komponent",
    "realizace-sluzby",
    "logicky-datovy-model",
    "mapovani-rozhrani",
    "verzovani-release",
    "re-interface",
    "sar-prevzeti-zadani",
    "sar-volatilita-dekompozice",
    "sar-architektura-zapis",
    "sar-validace-call-chains",
    "structural-modeller",
    "ea-sql-expert",
    "solution-architect",
    "ea-addin-developer",
]

DOMA_ONLY_SKILLS = {"ea-addin-developer"}          # PV-R7
AGENT_BODY_SKILLS = {"sa-orchestrator"}            # kap. 5.1 — tělo agenta, ne skill

# Varianta s terminálem (PV-R8 ii, nález N-P8): skilly, jejichž postup spouští
# skripty (Python), jdou do sady JEN při terminal: true — i v sadě full. Bez
# terminálu by agent postup nemohl dodržet (krok „pusť ir-extract.py").
TERMINAL_SKILLS = ["re-interface", "mapovani-rozhrani"]
# Skripty vendorované do skills/<skill>/scripts/ při terminal: true.
# Zdroj = složka relativně k RODIČI kanonu (IT-ANALYSIS/), protože skripty žijí
# mimo Skilly/ (re-fixtures/tools/). Chybí-li zdroj nebo je seznam prázdný →
# [WARN] „skill nenese žádný skript" (build projde — N-P8 zůstává otevřený).
TERMINAL_SCRIPTS = {
    "re-interface": ("re-fixtures/tools", ["ir-extract.py", "emr-ir-check.py"]),
    "mapovani-rozhrani": (None, []),               # generátor Excelu z YAML zatím není
}
# Nástroje terminálu ve frontmatteru custom agenta (VS Code docs „Copilot features"
# ms.date 2026-09-09, fetch 2026-09-11): tool set `execute` = runInTerminal,
# getTerminalOutput, createAndRunTask, runNotebookCell, testFailure. Bereme jen
# běh příkazu + čtení výstupu, ne celý set (žádné tasks / notebooky).
TERMINAL_TOOLS = ["execute/runInTerminal", "execute/getTerminalOutput"]
AGENT_TOOLS_RE = re.compile(r"^(tools:\s*\[)(.*)(\]\s*)$", re.M)

# {{TERMINAL_RULES}} — text pravidla 11 kitu (v Zadani-Portace-VSCode-v2 „pravidlo 14").
# OFF = doslovné znění kanonu před Z260911-3 (výchozí build se nemění).
TERMINAL_RULES_OFF = ("**Nepoužívej terminál.** Vše přes soubory workspace (`requests/`, "
                      "`responses/`, `zadani/`). Žádné skripty, žádné příkazy.")
TERMINAL_RULES_ON = (
    "**Terminál jen pro skripty skillů** `re-interface` a `mapovani-rozhrani` "
    "(`scripts/` uvnitř skillu, spouštěné z kořene workspace: "
    "`python .github/skills/<skill>/scripts/<skript>.py …`). Nikdy `git`, `pip`, "
    "síť (`curl`, `wget`, …), instalace, nic mimo workspace. **Každý příkaz ukaž v chatu "
    "před spuštěním** a počkej na potvrzení; výstup skriptu použij v dalším kroku "
    "skillu, do chatu ho neopisuj celý.")

# Skilly generované ze šablon `_vscode/skills/<name>/` (kontrakt dávky Z260907b).
GENERATED_SKILLS = ["emr-konvence", "eafb-bridge", "e2e-f0-f1"]
SHARED_TARGET_SKILL = "emr-konvence"               # `_shared/` → skills/emr-konvence/references/

# Soubory `_shared/`, které se při odkazu ze skillu kopírují do jeho `references/`
# (kap. 3.3: qc-verzovani.sql → references verzovani-release / emr-qa). Ostatní
# odkazy na `_shared/*.md` se přepisují na ukazatel na skill emr-konvence (PV-R4 i).
SHARED_COPY_ON_REFERENCE = {"qc-verzovani.sql"}

# Šablony (kontrakt dávky): povinné pro každou sadu.
TEMPLATE_REQUIRED = [
    "copilot-instructions.md",
    "agents/sa-analytik.agent.md",
    "instructions/emr-zapis.instructions.md",
    "instructions/mermaid.instructions.md",
    "skills/eafb-bridge/SKILL.md",
    "skills/e2e-f0-f1/SKILL.md",
]
# `skills/emr-konvence/SKILL.md` — pokud chybí, build ji vygeneruje (kap. 4.4 bod 2)
# a do logu napíše „šablona chybí".

PLACEHOLDERS = ["REPO", "WHITELIST", "DIALEKT", "DENY_OPS", "CONTEXT_NOTES",
                "TERMINAL_RULES"]
PLACEHOLDER_RE = re.compile(r"\{\{\s*([A-Z_]+)\s*\}\}")
COPILOT_MAX_BYTES = 8192                            # kap. 4.1 / AK-1

NAME_RE = re.compile(r"^[a-z0-9-]+$")
NAME_MAX = 64
DESC_MAX = 1024

# Integritní gate (převzato z portace/build-balicek.py — ⛔ deprecated, gate žije zde).
TEXT_EXT = {".md", ".yaml", ".yml", ".html", ".vbs", ".js", ".sql", ".canvas", ".txt",
            ".py", ".kt", ".kts", ".json", ".cmd", ".ps1", ".csv"}
ALLOWED_END = set('.!?:)|`"»~]*')
# Markery aktuálnosti: relativní cesta v kanonu → řetězce, které musí obsahovat.
MARKERS = {
    "_shared/emr-zapis-pravidla.md": ["## 12."],
}

# Sweep B1 (PROBLEMS/RESENI/T6-sanitizacni-checklist.md) + názvy DB (profil).
# MDG prefix se NEsweepuje (PV-R6 ii).
SWEEP_RULES = [
    ("jira", re.compile(r"\b[A-Z][A-Z0-9]{1,9}-\d+\b")),
    ("customfield", re.compile(r"customfield_\d+")),
    ("guid", re.compile(r"\{?[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}\}?")),
    ("url", re.compile(r"https?://[^\s)\"'>`]+")),
    ("email", re.compile(r"[\w.+-]+@[\w.-]+\.\w+")),
    ("ip", re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b")),
    ("unc", re.compile(r"\\\\\w+")),
    ("drive", re.compile(r"\b[A-Za-z]:\\")),
    ("token", re.compile(r"(?i)(token|passw|secret|api[_-]?key|bearer|authorization)")),
]

GUID_CORE_RE = re.compile(r"[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}")

# Cesty v backticks / odkazech, které se považují za soubor (linkifikace / přepis).
PATH_EXT_RE = re.compile(
    r"^[^\n`|<>\"']+\.(md|sql|yaml|yml|png|jpg|json|txt|py|js|vbs|cmd|html|csv)$",
    re.IGNORECASE)
BACKTICK_RE = re.compile(r"`([^`\n]+)`")
MDLINK_RE = re.compile(r"\[([^\]\n]*)\]\(<?([^)\s>]+)>?\)")
DOTDOT_RE = re.compile(r"(?:\.\./){2,}[^\s`)\]\"']*")

MANAGED_ITEMS = ["copilot-instructions.md", "skills-manifest.md", "agents",
                 "instructions", "skills"]
MANIFEST_NAME = "skills-manifest.md"


# ---------------------------------------------------------------------------
# Pomocné funkce
# ---------------------------------------------------------------------------

def safe_console():
    """Windows konzole (cp1250/cp852) nesmí spadnout na UTF-8 znacích v logu."""
    for name in ("stdout", "stderr"):
        stream = getattr(sys, name)
        try:
            enc = stream.encoding or "utf-8"
            wrapped = io.TextIOWrapper(stream.buffer, encoding=enc, errors="replace",
                                       line_buffering=True)
            setattr(sys, name, wrapped)
        except Exception:
            pass


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def is_text_path(rel):
    return Path(rel).suffix.lower() in TEXT_EXT


def normalize_text(raw):
    """bytes → str: UTF-8 (BOM pryč), CRLF → LF, konec souboru \\n."""
    text = raw.decode("utf-8", errors="replace")
    if text.startswith("\ufeff"):
        text = text[1:]
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    if text and not text.endswith("\n"):
        text += "\n"
    return text


def norm_guid(g):
    m = GUID_CORE_RE.search(g or "")
    return m.group(0).upper() if m else None


def parse_frontmatter(text):
    """Vrátí (dict polí, chyba|None). Podporuje skalár i blokový skalár (>, |, >-, |-)."""
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        return {}, "chybí YAML frontmatter (první řádek není ---)"
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end = i
            break
    if end is None:
        return {}, "frontmatter není uzavřen (chybí druhý ---)"
    fields = {}
    i = 1
    while i < end:
        line = lines[i]
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", line)
        if not m:
            i += 1
            continue
        key, val = m.group(1), m.group(2).strip()
        if val in (">", "|", ">-", "|-", ">+", "|+"):
            block = []
            i += 1
            while i < end and (lines[i].startswith(" ") or lines[i].strip() == ""):
                block.append(lines[i].strip())
                i += 1
            joiner = "\n" if val.startswith("|") else " "
            fields[key] = joiner.join(b for b in block if b).strip()
            continue
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        fields[key] = val
        i += 1
    return fields, None


def load_profile(config_dir, profile_name):
    path = Path(config_dir) / ("vscode-profile.%s.json" % profile_name)
    if not path.is_file():
        raise SystemExit("[FAIL] profil nenalezen: %s (banka: zkopíruj "
                         "vscode-profile.banka.example.json → vscode-profile.banka.json "
                         "a doplň hodnoty; soubor je v .gitignore)" % path)
    with open(str(path), "r", encoding="utf-8") as fh:
        prof = json.load(fh)
    for key in ("repo", "whitelist", "dialekt", "denyOps"):
        if key not in prof:
            raise SystemExit("[FAIL] profil %s: chybí klíč '%s'" % (path.name, key))
    if "mdg" in prof:
        raise SystemExit("[FAIL] profil %s: klíč 'mdg' není povolen (PV-R6 ii — název "
                         "MDG profilu se nenahrazuje)" % path.name)
    prof.setdefault("contextNotes", [])
    prof.setdefault("sweepAllow", [])
    prof.setdefault("sweepWords", [])
    prof.setdefault("terminal", False)
    if not isinstance(prof["terminal"], bool):
        raise SystemExit("[FAIL] profil %s: klíč 'terminal' musí být true/false (je %r)"
                         % (path.name, prof["terminal"]))
    prof["_name"] = profile_name
    prof["_path"] = str(path)
    return prof


def substitutions(prof, terminal=False):
    wl = []
    for w in prof["whitelist"]:
        name = w.get("name", "").strip()
        guid = w.get("guid", "").strip()
        wl.append(("%s %s" % (name, guid)).strip())
    deny = prof["denyOps"]
    notes = prof.get("contextNotes") or []
    return {
        "REPO": prof["repo"],
        "WHITELIST": "; ".join(wl) if wl else "(žádný)",
        "DIALEKT": prof["dialekt"],
        "DENY_OPS": ", ".join(deny) if deny else "žádné",
        "CONTEXT_NOTES": "\n".join("- %s" % n for n in notes) if notes else "(žádné)",
        "TERMINAL_RULES": TERMINAL_RULES_ON if terminal else TERMINAL_RULES_OFF,
    }


def add_agent_tools(text, tools):
    """Do frontmatteru agenta (`tools: [...]`) doplní chybějící nástroje. Vrátí
    (nový text, přidané názvy) nebo (text, None), když řádek `tools:` chybí."""
    m = AGENT_TOOLS_RE.search(text)
    if not m:
        return text, None
    present = [t.strip().strip("'\"") for t in m.group(2).split(",") if t.strip()]
    added = [t for t in tools if t not in present]
    if not added:
        return text, []
    items = ["'%s'" % t for t in present + added]
    new_line = "%s%s%s" % (m.group(1), ", ".join(items), m.group(3))
    return text[:m.start()] + new_line + text[m.end():], added


def link_text_for(path):
    base = posixpath.basename(path)
    stem, ext = posixpath.splitext(base)
    return stem if ext.lower() == ".md" else base


def md_link(text, target):
    if " " in target:
        return "[%s](<%s>)" % (text, target)
    return "[%s](%s)" % (text, target)


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

class Build(object):

    def __init__(self, kanon, templates, out, profile, skill_set, dry_run,
                 terminal=None):
        self.kanon = Path(kanon)
        self.templates = Path(templates)
        self.out_dir = Path(out)
        self.prof = profile
        self.set_name = skill_set
        self.dry_run = dry_run
        # terminál: přepínač CLI (--terminal on/off) má přednost před profilem
        self.terminal_source = "profil" if terminal is None else "--terminal"
        self.terminal = bool(profile.get("terminal", False)) if terminal is None \
            else bool(terminal)
        self.skipped_terminal = []   # skilly vynechané kvůli terminal: false
        self.vendored_scripts = {}   # skill → [skripty ve scripts/]
        self.files = {}          # rel (posix, relativně k .github/) → bytes
        self.errors = []
        self.warnings = []
        self.rewrites = []       # (soubor, původní, nový, kategorie)
        self.linkified = 0
        self.report = []
        self.sweep_unhandled = []
        self.sweep_allowed = {}  # důvod → počet
        self.sweep_allowed_examples = {}
        self.kanon_skill_names = set()
        self.template_missing = []

    # -- log ---------------------------------------------------------------
    def log(self, line=""):
        self.report.append(line)

    def err(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    # -- vstupy ------------------------------------------------------------
    def selected_skills(self):
        base = SET_THIN if self.set_name == "thin" else SET_FULL
        out = []
        for s in base:
            if s in AGENT_BODY_SKILLS:
                continue
            if s in DOMA_ONLY_SKILLS and self.prof["_name"] != "doma":
                self.log("  vynechán %s (jen profil doma, PV-R7)" % s)
                continue
            if s in TERMINAL_SKILLS and not self.terminal:
                self.log("  vynechán %s (vyžaduje terminál — N-P8; terminal: off)" % s)
                self.skipped_terminal.append(s)
                continue
            out.append(s)
        return out

    def terminal_scripts_for(self, name):
        """Při terminal: true vrátí {scripts/<x>.py: bytes} pro skill; WARN, když
        skill žádný skript nenese (zdroj chybí nebo není definován)."""
        if not self.terminal or name not in TERMINAL_SCRIPTS:
            return {}
        src_rel, names = TERMINAL_SCRIPTS[name]
        found = {}
        if src_rel and names:
            src_dir = self.kanon.parent / src_rel
            for fname in names:
                p = src_dir / fname
                if p.is_file():
                    found["scripts/" + fname] = p.read_bytes()
                else:
                    self.warn("skill %s: skript %s nenalezen (%s)" % (name, fname, p))
        if not found:
            self.warn("skill %s: terminál zapnut, ale skill nenese žádný skript "
                      "(scripts/ prázdné — N-P8 otevřený, agent bude Python psát ad hoc)"
                      % name)
        else:
            self.vendored_scripts[name] = sorted(k[len("scripts/"):] for k in found)
        return found

    def read_tree(self, root):
        """Vrátí {posix rel: bytes} pro všechny soubory pod root (seřazeno)."""
        result = {}
        root = Path(root)
        if not root.is_dir():
            return result
        for p in sorted(root.rglob("*")):
            if p.is_file() and "__pycache__" not in p.parts:
                result[p.relative_to(root).as_posix()] = p.read_bytes()
        return result

    def put(self, rel, data):
        self.files[rel] = data

    # -- přepis odkazů -----------------------------------------------------
    def rewrite_path(self, file_rel, raw_path, skill_name, tree_files, copy_hook):
        """Rozhodne o cestě v backticks/odkazu uvnitř souboru skillu.

        file_rel  — cesta souboru uvnitř skillu (např. references/uc-patterns/index.md)
        raw_path  — text cesty tak, jak je v kanonu
        tree_files — množina cest souborů skillu (po vendoringu)
        copy_hook — callback(basename) → True, pokud se soubor z _shared dokopíroval
        Vrátí (typ, hodnota): ("link", cíl relativně k souboru) | ("text", náhrada)
        | ("keep", None).
        """
        path = raw_path.strip()
        if not PATH_EXT_RE.match(path):
            return ("keep", None)
        file_dir = posixpath.dirname(file_rel)
        resolved = posixpath.normpath(posixpath.join(file_dir, path)) if file_dir \
            else posixpath.normpath(path)
        inside = not resolved.startswith("..") and resolved in tree_files
        if inside:
            return ("link", path)

        base = posixpath.basename(path)
        # skript vendorovaný do scripts/ (terminal: true) — kanon ho odkazuje
        # původní cestou (re-fixtures/tools/x.py) → link na kopii ve skillu
        if ("scripts/" + base) in tree_files:
            return ("link", posixpath.relpath("scripts/" + base, file_dir or "."))
        # _shared/<x> nebo ../_shared/<x> (ze skillu) — sdílené reference
        m_shared = re.match(r"^(?:\.\./)*_shared/([^/]+)$", path)
        if m_shared:
            fname = m_shared.group(1)
            if fname in SHARED_COPY_ON_REFERENCE and copy_hook(fname):
                target = posixpath.relpath("references/" + fname, file_dir or ".")
                return ("link", target)
            if skill_name == SHARED_TARGET_SKILL:
                # uvnitř emr-konvence: soused ve stejné složce references/
                if ("references/" + fname) in tree_files:
                    return ("link", posixpath.relpath("references/" + fname, file_dir or "."))
            return ("text", "`%s` (skill `%s`, references/%s)"
                    % (fname, SHARED_TARGET_SKILL, fname))
        # ../<jiný skill>/… (i ../../Skilly/<skill>/…)
        m_skill = re.match(r"^(?:\.\./)+(?:Skilly/)?([a-z0-9-]+)/(.+)$", path)
        if m_skill and m_skill.group(1) in self.kanon_skill_names:
            other, rest = m_skill.group(1), m_skill.group(2)
            return ("text", "`%s` (skill `%s`)" % (rest, other))
        # ../../emr-bridge/<x> → skill eafb-bridge (references)
        m_bridge = re.match(r"^(?:\.\./)+emr-bridge/([^/]+)$", path)
        if m_bridge:
            return ("text", "`%s` (skill `eafb-bridge`, references/%s)"
                    % (m_bridge.group(1), m_bridge.group(1)))
        if path.startswith("../"):
            return ("text", "`%s` (mimo workspace — vyžádej od uživatele)" % base)
        # relativní cesta bez ../, která ve stromu není (např. RE/Koncepce…md) — nechat
        return ("keep", None)

    def rewrite_links(self, skill_name, file_rel, text, tree_files, copy_hook):
        """Backticky s cestou → markdown link (uvnitř stromu) nebo přepis (mimo strom)."""
        out_lines = []
        in_fence = False
        log_file = "skills/%s/%s" % (skill_name, file_rel)
        for line in text.split("\n"):
            stripped = line.lstrip()
            if stripped.startswith("```") or stripped.startswith("~~~"):
                in_fence = not in_fence
                out_lines.append(line)
                continue
            if in_fence:
                out_lines.append(line)
                continue

            def bt_sub(m):
                inner = m.group(1)
                if m.string[m.end():m.end() + 2] == "](":
                    return m.group(0)  # backtick je text odkazu [`x`](…) — nechat
                kind, val = self.rewrite_path(file_rel, inner, skill_name, tree_files,
                                              copy_hook)
                if kind == "link":
                    self.linkified += 1
                    return md_link(link_text_for(val), val)
                if kind == "text":
                    self.rewrites.append((log_file, inner, val, "backtick"))
                    return val
                return m.group(0)

            def link_sub(m):
                text_part, target = m.group(1), m.group(2)
                kind, val = self.rewrite_path(file_rel, target, skill_name, tree_files,
                                              copy_hook)
                if kind == "link":
                    if val != target:
                        return md_link(text_part, val)
                    return m.group(0)
                if kind == "text":
                    repl = "%s %s" % (text_part, val) if text_part else val
                    self.rewrites.append((log_file, m.group(0), repl, "link"))
                    return repl
                return m.group(0)

            line = MDLINK_RE.sub(link_sub, line)
            line = BACKTICK_RE.sub(bt_sub, line)
            out_lines.append(line)
        text = "\n".join(out_lines)

        # zbytkové ../../ kdekoli (i v kódu) — AK-3 grep musí být 0
        def dd_sub(m):
            orig = m.group(0)
            repl = "%s (mimo workspace)" % posixpath.basename(orig.rstrip("/")) \
                if posixpath.basename(orig.rstrip("/")) else "(mimo workspace)"
            self.rewrites.append((log_file, orig, repl, "zbytkové ../../"))
            return repl
        text = DOTDOT_RE.sub(dd_sub, text)
        return text

    # -- vendoring skillů ---------------------------------------------------
    def vendor_skill(self, name, src_root, extra_files=None):
        """Zkopíruje celou složku skillu do skills/<name>/ s přepisem odkazů."""
        tree = self.read_tree(src_root)
        if extra_files:
            tree.update(extra_files)
        if "SKILL.md" not in tree:
            self.err("skill %s: chybí SKILL.md v %s" % (name, src_root))
            return
        tree_files = set(tree.keys())
        shared_dir = self.kanon / "_shared"

        def copy_hook(fname):
            src = shared_dir / fname
            if not src.is_file():
                return False
            rel = "references/" + fname
            if rel not in tree:
                data = src.read_bytes()
                tree[rel] = data
                tree_files.add(rel)
                self.rewrites.append(("skills/%s/%s" % (name, rel),
                                      "_shared/" + fname, "kopie do references/", "kopie"))
            return True

        # nejdřív přepsat texty (copy_hook může přidat soubory), pak uložit vše
        rendered = {}
        broken = set()
        pending = sorted(tree.keys())
        while pending:  # copy_hook může během přepisu přidat další soubory
            for rel in pending:
                data = tree[rel]
                if not is_text_path(rel):
                    continue
                if b"\x00" in data:
                    self.err("NUL bajty (poškozený sync?): skills/%s/%s" % (name, rel))
                    broken.add(rel)
                    continue
                text = normalize_text(data)
                text = self.rewrite_links(name, rel, text, tree_files, copy_hook)
                rendered[rel] = text
            pending = sorted(r for r in tree.keys()
                             if r not in rendered and r not in broken and is_text_path(r))
        for rel in sorted(tree.keys()):
            if rel in rendered:
                self.put("skills/%s/%s" % (name, rel), rendered[rel].encode("utf-8"))
            elif rel in broken:
                pass  # chyba už zapsána
            else:
                self.put("skills/%s/%s" % (name, rel), tree[rel])

    def vendor_kanon_skills(self, names):
        for name in names:
            src = self.kanon / name
            if not src.is_dir():
                self.err("skill %s: složka v kanonu neexistuje (%s)" % (name, src))
                continue
            scripts = self.terminal_scripts_for(name)
            self.vendor_skill(name, src, extra_files=scripts or None)
            self.log("  kanon  skills/%s (%d souborů%s)" % (
                name, sum(1 for k in self.files if k.startswith("skills/%s/" % name)),
                "; scripts/: " + ", ".join(sorted(scripts)) if scripts else ""))

    # -- šablony ------------------------------------------------------------
    def substitute(self, rel, text, subs):
        def repl(m):
            key = m.group(1)
            if key in subs:
                return subs[key]
            return m.group(0)
        return PLACEHOLDER_RE.sub(repl, text)

    def render_templates(self, subs):
        tdir = self.templates
        if not tdir.is_dir():
            self.log("  šablony: složka %s neexistuje" % tdir)
        for rel in TEMPLATE_REQUIRED:
            if not (tdir / rel).is_file():
                self.template_missing.append(rel)
                self.err("šablona chybí: %s (kontrakt dávky Z260907b — dodává vlákno -3)"
                         % (tdir / rel))
        # copilot-instructions.md
        ci = tdir / "copilot-instructions.md"
        if ci.is_file():
            text = self.substitute("copilot-instructions.md", normalize_text(ci.read_bytes()),
                                   subs)
            data = text.encode("utf-8")
            self.put("copilot-instructions.md", data)
            if len(data) > COPILOT_MAX_BYTES:
                self.err("copilot-instructions.md má %d B po substituci > limit %d B"
                         % (len(data), COPILOT_MAX_BYTES))
            self.log("  šablona copilot-instructions.md (%d B, limit %d)"
                     % (len(data), COPILOT_MAX_BYTES))
        # agents/, instructions/
        for sub, pattern in (("agents", "*.agent.md"), ("instructions", "*.instructions.md")):
            d = tdir / sub
            if d.is_dir():
                for p in sorted(d.glob(pattern)):
                    text = self.substitute(sub + "/" + p.name,
                                           normalize_text(p.read_bytes()), subs)
                    if sub == "agents":
                        text = self.agent_terminal_tools(p.name, text)
                    self.put("%s/%s" % (sub, p.name), text.encode("utf-8"))
                    self.log("  šablona %s/%s" % (sub, p.name))
        # generované skilly
        shared_files = {}
        shared_dir = self.kanon / "_shared"
        if shared_dir.is_dir():
            for rel, data in self.read_tree(shared_dir).items():
                shared_files["references/" + rel] = data
        else:
            self.err("kanon: chybí složka _shared/ (%s)" % shared_dir)
        for gname in GENERATED_SKILLS:
            gdir = tdir / "skills" / gname
            tree = {}
            if gdir.is_dir():
                for rel, data in self.read_tree(gdir).items():
                    if is_text_path(rel):
                        text = self.substitute("skills/%s/%s" % (gname, rel),
                                               normalize_text(data), subs)
                        tree[rel] = text.encode("utf-8")
                    else:
                        tree[rel] = data
            if gname == SHARED_TARGET_SKILL:
                for rel, data in shared_files.items():
                    tree.setdefault(rel, data)
                if "SKILL.md" not in tree:
                    self.template_missing.append("skills/%s/SKILL.md" % gname)
                    self.log("  šablona chybí: skills/%s/SKILL.md — použit generovaný "
                             "minimální SKILL.md (kap. 4.4 bod 2)" % gname)
                    tree["SKILL.md"] = self.generated_konvence_skill(shared_files).encode(
                        "utf-8")
            if "SKILL.md" not in tree:
                continue  # chyba už zapsána (TEMPLATE_REQUIRED)
            self.vendor_skill(gname, gdir if gdir.is_dir() else self.templates / "_none_",
                              extra_files=tree)
            self.log("  šablona skills/%s (%d souborů)" % (
                gname, sum(1 for k in self.files if k.startswith("skills/%s/" % gname))))

    def agent_terminal_tools(self, fname, text):
        """terminal: true → do `tools:` agenta doplní TERMINAL_TOOLS; terminal: false →
        šablona nesmí nástroj terminálu nést (kit pravidlo 11 / AK-6 „žádný Allow")."""
        has_exec = any(("'%s'" % t) in text or ('"%s"' % t) in text
                       for t in TERMINAL_TOOLS + ["execute"])
        if not self.terminal:
            if has_exec:
                self.err("agents/%s: šablona nese nástroj terminálu (execute*), ale "
                         "terminal: off — nástroj patří do buildu, ne do šablony" % fname)
            return text
        new_text, added = add_agent_tools(text, TERMINAL_TOOLS)
        if added is None:
            self.err("agents/%s: chybí řádek `tools: [...]` ve frontmatteru — nelze "
                     "doplnit nástroj terminálu" % fname)
            return text
        self.log("  agent %s: tools += %s" % (fname, ", ".join(added) if added
                                             else "(už obsahuje)"))
        return new_text

    def generated_konvence_skill(self, shared_files):
        lines = [
            "---",
            "name: %s" % SHARED_TARGET_SKILL,
            "description: Konvence zápisu do EMR, QA checklisty, HITL brány — načti, když "
            "skládáš zápis do EMR nebo QA. Rozcestník nad sdílenými referencemi kanonu "
            "(_shared/).",
            "---",
            "",
            "# %s" % SHARED_TARGET_SKILL,
            "",
            "Generováno buildem (šablona `_vscode/skills/%s/SKILL.md` chyběla). "
            "Sdílené reference kanonu — čti podle potřeby:" % SHARED_TARGET_SKILL,
            "",
        ]
        for rel in sorted(shared_files.keys()):
            base = posixpath.basename(rel)
            lines.append("- %s" % md_link(link_text_for(base), rel))
        lines.append("")
        return "\n".join(lines)

    # -- validace -----------------------------------------------------------
    def validate_skills(self):
        skills = sorted({k.split("/")[1] for k in self.files if k.startswith("skills/")
                         and k.count("/") >= 2})
        for name in skills:
            prefix = "skills/%s/" % name
            skill_md = self.files.get(prefix + "SKILL.md")
            if skill_md is None:
                self.err("skill %s: chybí SKILL.md ve výstupu" % name)
                continue
            text = skill_md.decode("utf-8")
            fm, ferr = parse_frontmatter(text)
            if ferr:
                self.err("skill %s: %s" % (name, ferr))
                continue
            fname = fm.get("name", "")
            if fname != name:
                self.err("skill %s: name '%s' != název složky (AK-2)" % (name, fname))
            if not NAME_RE.match(fname or ""):
                self.err("skill %s: name '%s' porušuje [a-z0-9-] (AK-2)" % (name, fname))
            if len(fname) > NAME_MAX:
                self.err("skill %s: name delší než %d (AK-2)" % (name, NAME_MAX))
            desc = fm.get("description", "")
            if not desc:
                self.err("skill %s: chybí description (AK-2)" % name)
            elif len(desc) > DESC_MAX:
                self.err("skill %s: description %d znaků > %d (AK-2)"
                         % (name, len(desc), DESC_MAX))
            # references reachability (AK-3): SKILL.md → tranzitivně přes odkázané .md
            tree = {k[len(prefix):]: v for k, v in self.files.items() if k.startswith(prefix)}
            reached = self.reachable(tree)
            for rel in sorted(tree.keys()):
                if not rel.startswith("references/") or rel in reached:
                    continue
                if rel.lower().endswith(".md"):
                    self.err("skill %s: references/%s není odkázán z SKILL.md markdown "
                             "linkem (AK-3)" % (name, rel[len("references/"):]))
                else:
                    self.warn("skill %s: %s (ne-md) není odkázán z SKILL.md" % (name, rel))
            # žádný odkaz mimo strom (AK-3)
            for rel, data in tree.items():
                if not is_text_path(rel):
                    continue
                t = data.decode("utf-8")
                if "../../" in t:
                    self.err("skill %s: %s obsahuje '../../' (AK-3)" % (name, rel))
                for m in MDLINK_RE.finditer(t):
                    target = m.group(2)
                    if target.startswith(("http://", "https://", "#", "mailto:")):
                        continue
                    resolved = posixpath.normpath(posixpath.join(posixpath.dirname(rel),
                                                                 target.split("#")[0]))
                    if resolved.startswith(".."):
                        self.err("skill %s: %s odkazuje mimo strom skillu: %s (AK-3)"
                                 % (name, rel, target))
        return skills

    def reachable(self, tree):
        visited = set()   # .md soubory, jejichž odkazy už byly projity
        found = set()     # všechny odkázané soubory (i ne-md)
        stack = ["SKILL.md"]
        while stack:
            cur = stack.pop()
            if cur in visited or cur not in tree or not is_text_path(cur):
                continue
            visited.add(cur)
            text = tree[cur].decode("utf-8")
            for m in MDLINK_RE.finditer(text):
                target = m.group(2).split("#")[0]
                if not target or target.startswith(("http://", "https://", "mailto:")):
                    continue
                resolved = posixpath.normpath(posixpath.join(posixpath.dirname(cur), target))
                if resolved in tree:
                    found.add(resolved)
                    if resolved.lower().endswith(".md"):
                        stack.append(resolved)
        found.discard("SKILL.md")
        return found

    def validate_placeholders(self):
        for rel in sorted(self.files.keys()):
            if not is_text_path(rel):
                continue
            text = self.files[rel].decode("utf-8")
            for m in PLACEHOLDER_RE.finditer(text):
                self.err("nenahrazený placeholder {{%s}} v %s" % (m.group(1), rel))

    def validate_integrity(self):
        for rel in sorted(self.files.keys()):
            data = self.files[rel]
            if not is_text_path(rel):
                continue
            if b"\x00" in data:
                self.err("NUL bajty: %s" % rel)
                continue
            if rel.endswith(".md"):
                if not data.endswith(b"\n"):
                    self.err("nekončí newline: %s" % rel)
                text = data.decode("utf-8").rstrip()
                if not text:
                    self.err("prázdný soubor: %s" % rel)
                elif text[-1] not in ALLOWED_END:
                    self.warn("možné uříznutí uprostřed věty: %s — končí „…%s“"
                              % (rel, text[-30:]))
        for rel, markers in MARKERS.items():
            p = self.kanon / rel
            if not p.is_file():
                self.err("marker aktuálnosti: chybí soubor kanonu %s" % rel)
                continue
            text = p.read_text(encoding="utf-8", errors="replace")
            for m in markers:
                if m not in text:
                    self.err("chybí marker aktuálnosti „%s“: %s" % (m, rel))

    # -- sweep B1 -----------------------------------------------------------
    def sweep(self):
        self.sweep_unhandled = []
        self.sweep_allowed = {}
        self.sweep_allowed_examples = {}
        rules = list(SWEEP_RULES)
        words = [w for w in (self.prof.get("sweepWords") or []) if w and not w.startswith("<")]
        if words:
            rules.append(("db", re.compile("(?i)" + "|".join(re.escape(w) for w in words))))
        allow_guids = set()
        for w in self.prof["whitelist"]:
            g = norm_guid(w.get("guid", ""))
            if g:
                allow_guids.add(g)
        allow_entries = []
        for a in self.prof.get("sweepAllow") or []:
            try:
                allow_entries.append((re.compile(a["pattern"]), a.get("reason", "?"),
                                      a.get("scope", "match"), a.get("rule")))
            except (re.error, KeyError, TypeError) as e:
                self.err("profil sweepAllow: neplatný záznam %r (%s)" % (a, e))
        implicit = [self.prof["repo"]] + [w.get("name", "") for w in self.prof["whitelist"]]
        implicit = [x for x in implicit if x]

        for rel in sorted(self.files.keys()):
            if not is_text_path(rel) or rel == MANIFEST_NAME:
                continue
            lines = self.files[rel].decode("utf-8").split("\n")
            for ln, line in enumerate(lines, 1):
                for rname, rx in rules:
                    for m in rx.finditer(line):
                        found = m.group(0)
                        reason = None
                        if rname == "guid" and norm_guid(found) in allow_guids:
                            reason = "GUID whitelistu profilu"
                        elif any(found in v or v in found for v in implicit):
                            reason = "hodnota profilu (repo/whitelist)"
                        else:
                            for arx, areason, scope, arule in allow_entries:
                                if arule and arule != rname:
                                    continue
                                ok = arx.fullmatch(found) if scope == "match" \
                                    else arx.search(line)
                                if ok:
                                    reason = areason
                                    break
                        if reason:
                            self.sweep_allowed[reason] = self.sweep_allowed.get(reason, 0) + 1
                            ex = self.sweep_allowed_examples.setdefault(reason, [])
                            if len(ex) < 3:
                                ex.append("%s:%d %s" % (rel, ln, found))
                        else:
                            self.sweep_unhandled.append((rname, rel, ln, found))

    # -- manifest -----------------------------------------------------------
    def kanon_version(self):
        h = hashlib.sha1()
        for rel, data in sorted(self.read_tree(self.kanon).items()):
            h.update(rel.encode("utf-8"))
            h.update(b"\0")
            h.update(sha256_bytes(data).encode("ascii"))
            h.update(b"\n")
        return h.hexdigest()

    def render_manifest(self, skills, build_date):
        kver = self.kanon_version()
        n_gen = len([s for s in skills if s in GENERATED_SKILLS])
        lines = [
            "# skills-manifest — build výstup tools/build-vscode.py",
            "",
            "> vendored from IT-ANALYSIS/Skilly @ %s — needitovat ručně "
            "(lekce → kanon → rebuild; docs/BUILD-VSCODE.md)" % build_date,
            "",
            "| Pole | Hodnota |",
            "|---|---|",
            "| Verze kanonu | %s + sha1 %s |" % (build_date, kver),
            "| Profil | %s |" % self.prof["_name"],
            "| Sada | %s |" % self.set_name,
            "| Terminál | %s |" % ("on" if self.terminal else "off"),
            "| Skillů | %d (kanon %d + generované %d) |" % (len(skills), len(skills) - n_gen,
                                                            n_gen),
            "| Souborů | %d |" % len(self.files),
            "| build-vscode.py | %s |" % BUILD_VERSION,
            "",
            "## Skilly",
            "",
        ]
        for s in skills:
            extra = ""
            if s in self.vendored_scripts:
                extra = " (scripts/: %s)" % ", ".join(self.vendored_scripts[s])
            lines.append("- %s%s" % (s, extra))
        if self.skipped_terminal:
            lines += ["", "## Vynechané skilly (vyžadují terminál — N-P8; terminal: off)",
                      ""]
            for s in self.skipped_terminal:
                lines.append("- %s" % s)
        lines += ["", "## Soubory", "", "| Soubor | sha256 |", "|---|---|"]
        for rel in sorted(self.files.keys()):
            lines.append("| %s | %s |" % (rel, sha256_bytes(self.files[rel])))
        lines.append("")
        return "\n".join(lines)

    # -- zápis --------------------------------------------------------------
    def write_out(self):
        self.out_dir.mkdir(parents=True, exist_ok=True)
        for item in MANAGED_ITEMS:
            p = self.out_dir / item
            if p.is_dir():
                shutil.rmtree(str(p))
            elif p.is_file():
                p.unlink()
        for rel in sorted(self.files.keys()):
            p = self.out_dir / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(self.files[rel])

    # -- hlavní běh ---------------------------------------------------------
    def run(self):
        build_date = datetime.date.today().isoformat()
        self.log("build-vscode.py %s — %s" % (BUILD_VERSION, build_date))
        self.log("  kanon:    %s" % self.kanon)
        self.log("  šablony:  %s" % self.templates)
        self.log("  výstup:   %s%s" % (self.out_dir, "  (DRY-RUN — nic se nezapisuje)"
                                       if self.dry_run else ""))
        self.log("  profil:   %s (%s)" % (self.prof["_name"], self.prof["_path"]))
        self.log("  sada:     %s" % self.set_name)
        self.log("  terminál: %s (%s)" % ("on" if self.terminal else "off",
                                         self.terminal_source))
        if not self.kanon.is_dir():
            self.err("kanon neexistuje: %s" % self.kanon)
            return self.finish(None, build_date)
        self.kanon_skill_names = {p.name for p in self.kanon.iterdir()
                                  if p.is_dir() and (p / "SKILL.md").is_file()}

        subs = substitutions(self.prof, self.terminal)
        self.log("")
        self.log("Substituce placeholderů:")
        for k in PLACEHOLDERS:
            self.log("  {{%s}} → %s" % (k, subs[k].replace("\n", " | ")))

        self.log("")
        self.log("Skilly:")
        names = self.selected_skills()
        self.vendor_kanon_skills(names)
        self.render_templates(subs)

        skills = self.validate_skills()
        self.validate_placeholders()
        self.validate_integrity()
        self.sweep()

        manifest = self.render_manifest(skills, build_date)
        self.put(MANIFEST_NAME, manifest.encode("utf-8"))
        return self.finish(skills, build_date)

    def finish(self, skills, build_date):
        self.log("")
        self.log("Přepisy odkazů (mimo strom skillu → kopie / ukazatel / „mimo workspace“): %d"
                 % len(self.rewrites))
        if self.rewrites:
            self.log("| Soubor | Původně | Nově | Typ |")
            self.log("|---|---|---|---|")
            for f, a, b, c in self.rewrites:
                self.log("| %s | %s | %s | %s |" % (f, a.replace("|", "\\|"),
                                                   b.replace("|", "\\|"), c))
        self.log("Backtick → markdown link uvnitř stromu skillu: %d" % self.linkified)

        self.log("")
        self.log("Sweep B1 (T6; profil %s; GUID whitelistu a hodnoty profilu povoleny):"
                 % self.prof["_name"])
        for reason in sorted(self.sweep_allowed):
            self.log("  povoleno %3d× — %s (např. %s)" % (
                self.sweep_allowed[reason], reason,
                "; ".join(self.sweep_allowed_examples.get(reason, []))))
        self.log("  NEOŠETŘENÉ nálezy: %d" % len(self.sweep_unhandled))
        for rname, rel, ln, found in self.sweep_unhandled:
            self.log("    [%s] %s:%d  %s" % (rname, rel, ln, found))
        if self.sweep_unhandled:
            if self.prof["_name"] == "doma":
                self.err("sweep B1: %d neošetřených nálezů v profilu doma (AK-4) — oprav "
                         "kanon nebo doplň zdůvodněný sweepAllow v profilu"
                         % len(self.sweep_unhandled))
            else:
                self.warn("sweep B1: %d nálezů (profil %s — jen report)"
                          % (len(self.sweep_unhandled), self.prof["_name"]))

        self.log("")
        if skills is not None:
            n_ci = 1 if "copilot-instructions.md" in self.files else 0
            n_ag = sum(1 for k in self.files if k.startswith("agents/"))
            n_in = sum(1 for k in self.files if k.startswith("instructions/"))
            self.log("Počty (AK-1): copilot-instructions %d · agents %d · instructions %d · "
                     "skillů %d · souborů %d" % (n_ci, n_ag, n_in, len(skills),
                                                 len(self.files)))
            self.log("  skilly: %s" % ", ".join(skills))
        for w in self.warnings:
            self.log("  [WARN] %s" % w)
        for e in self.errors:
            self.log("  [FAIL] %s" % e)

        ok = not self.errors
        if ok and not self.dry_run:
            self.write_out()
            self.log("")
            self.log("[OK] zapsáno do %s (%d souborů)" % (self.out_dir, len(self.files)))
        elif ok:
            self.log("")
            self.log("[OK] dry-run: validace prošla, nic nezapsáno (%d souborů by vzniklo)"
                     % len(self.files))
        else:
            self.log("")
            self.log("[FAIL] build selhal: %d chyb — nic nezapsáno" % len(self.errors))
        return 0 if ok else 1


# ---------------------------------------------------------------------------
# --verify
# ---------------------------------------------------------------------------

def parse_manifest(text):
    files = {}
    for m in re.finditer(r"^\| (\S.*?) \| ([0-9a-f]{64}) \|$", text, re.M):
        files[m.group(1)] = m.group(2)
    meta = {}
    for m in re.finditer(r"^\| (Profil|Sada|Terminál|Skillů|Souborů) \| (.+?) \|$", text,
                         re.M):
        meta[m.group(1)] = m.group(2)
    return meta, files


def verify(out_dir, profile, report):
    out_dir = Path(out_dir)
    errors = []
    mpath = out_dir / MANIFEST_NAME
    report.append("verify — %s" % out_dir)
    if not mpath.is_file():
        report.append("  [FAIL] chybí %s" % MANIFEST_NAME)
        return 1
    meta, files = parse_manifest(mpath.read_text(encoding="utf-8"))
    report.append("  manifest: profil %s, sada %s, terminál %s, skillů %s, souborů %s"
                  % (meta.get("Profil"), meta.get("Sada"), meta.get("Terminál", "off"),
                     meta.get("Skillů"), meta.get("Souborů")))
    missing = changed = 0
    for rel in sorted(files):
        p = out_dir / rel
        if not p.is_file():
            missing += 1
            errors.append("chybí: %s" % rel)
        elif sha256_bytes(p.read_bytes()) != files[rel]:
            changed += 1
            errors.append("NESOUHLASÍ sha256: %s" % rel)
    # soubory ve spravovaném stromu, které manifest nezná
    present = set()
    for item in MANAGED_ITEMS:
        p = out_dir / item
        if p.is_file() and item != MANIFEST_NAME:
            present.add(item)
        elif p.is_dir():
            for q in p.rglob("*"):
                if q.is_file():
                    present.add(q.relative_to(out_dir).as_posix())
    extra = sorted(present - set(files))
    for rel in extra:
        errors.append("mimo manifest (ruční editace?): %s" % rel)
    report.append("  sha256: %d souborů OK, %d chybí, %d změněno, %d mimo manifest"
                  % (len(files) - missing - changed, missing, changed, len(extra)))
    # počty
    n_skills = sum(1 for k in files if k.startswith("skills/") and k.endswith("/SKILL.md")
                   and k.count("/") == 2)
    m = re.match(r"(\d+)", meta.get("Skillů", "") or "")
    if m and int(m.group(1)) != n_skills:
        errors.append("počet skillů %d != manifest %s" % (n_skills, m.group(1)))
    report.append("  skillů: %d" % n_skills)
    # sweep
    b = Build(out_dir, out_dir, out_dir, profile, meta.get("Sada", "thin"), True)
    for rel in files:
        p = out_dir / rel
        if p.is_file():
            b.files[rel] = p.read_bytes()
    b.sweep()
    for reason in sorted(b.sweep_allowed):
        report.append("  sweep povoleno %3d× — %s" % (b.sweep_allowed[reason], reason))
    report.append("  sweep NEOŠETŘENÉ: %d" % len(b.sweep_unhandled))
    for rname, rel, ln, found in b.sweep_unhandled:
        report.append("    [%s] %s:%d  %s" % (rname, rel, ln, found))
    if b.sweep_unhandled and profile["_name"] == "doma":
        errors.append("sweep B1: %d neošetřených nálezů (profil doma)" % len(b.sweep_unhandled))
    for e in errors:
        report.append("  [FAIL] %s" % e)
    report.append("[%s] verify %s" % ("OK" if not errors else "FAIL",
                                      "prošel" if not errors else "selhal: %d problémů"
                                      % len(errors)))
    return 0 if not errors else 1


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv=None):
    safe_console()
    repo = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(
        description="Build stromu .github/ (Agent Skills) z kanonu IT-ANALYSIS/Skilly.")
    ap.add_argument("--kanon", help="cesta ke kanonu Skilly/ (build; při --verify netřeba)")
    ap.add_argument("--out", default=str(repo / ".github"),
                    help="cílová složka .github (default <repo>/.github)")
    ap.add_argument("--templates", help="složka šablon (default <kanon>/_vscode)")
    ap.add_argument("--profile", required=True, choices=["doma", "banka"])
    ap.add_argument("--set", dest="skill_set", default="thin", choices=["thin", "full"])
    ap.add_argument("--terminal", choices=["on", "off"],
                    help="varianta s terminálem (PV-R8 ii): přebije klíč 'terminal' profilu; "
                         "on = agent dostane execute/runInTerminal, pravidlo 11 kitu ve "
                         "variantě „jen skripty skillů\", skilly re-interface/mapovani-rozhrani "
                         "v sadě + jejich scripts/")
    ap.add_argument("--config-dir", default=str(repo / "config"),
                    help="složka s vscode-profile.<profil>.json (default <repo>/config)")
    ap.add_argument("--verify", action="store_true",
                    help="ověř výstup proti manifestu (sha256, sweep, počty); nic nebuildí")
    ap.add_argument("--dry-run", action="store_true", help="validuj, nic nezapisuj")
    ap.add_argument("--log", help="soubor, kam se zapíše tentýž report jako na konzoli")
    args = ap.parse_args(argv)

    profile = load_profile(args.config_dir, args.profile)
    report = []
    if args.verify:
        rc = verify(args.out, profile, report)
    else:
        if not args.kanon:
            ap.error("--kanon je povinný pro build")
        templates = args.templates or str(Path(args.kanon) / "_vscode")
        terminal = None if args.terminal is None else (args.terminal == "on")
        b = Build(args.kanon, templates, args.out, profile, args.skill_set, args.dry_run,
                  terminal=terminal)
        rc = b.run()
        report = b.report
    text = "\n".join(report) + "\n"
    sys.stdout.write(text)
    if args.log:
        lp = Path(args.log)
        lp.parent.mkdir(parents=True, exist_ok=True)
        lp.write_text(text, encoding="utf-8")
    return rc


if __name__ == "__main__":
    sys.exit(main())
