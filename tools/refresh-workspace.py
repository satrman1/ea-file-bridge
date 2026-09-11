#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
refresh-workspace.py — naplní / obnoví WORKSPACE REPO METODIKY (doma `C:\\GIT\\ai-transfer`,
v bance korporátní workspace repo) z produktu ea-file-bridge. Rozhodnutí a kontrakt:
docs/WORKSPACE-METODIKY.md (Z260911-4, PV-R5 (b)).

Co udělá (build):
  1. `tools/build-vscode.py --out <workspace>/.github` (kanon → Agent Skills, profil, sada);
  2. zkopíruje `pump.wsf` z tohoto repa do kořene workspace (vendorovaná kopie — pumpa čte
     `requests\\` / `responses\\` VEDLE SEBE, proto musí ležet ve workspace) a zapíše
     `PUMP-VERSION` (verze z hlavičky pumpy, sha256, zdrojový commit bridge);
  3. založí skeleton: `requests/.gitkeep`, `responses/.gitkeep`, `zadani/.gitkeep`
     (jen je-li `zadani/` prázdná) a doplní spravovaný blok do `.gitignore`.
  Obsah `zadani/`, `requests/`, `responses/` se NIKDY nemění ani nemaže.

Použití (doma):
    python tools\\refresh-workspace.py --workspace C:\\GIT\\ai-transfer --profile doma --set full ^
        --kanon C:\\Users\\milos\\CLAUDE\\IT-ANALYSIS\\Skilly
    python tools\\refresh-workspace.py --workspace C:\\GIT\\ai-transfer --profile doma --verify
    python tools\\refresh-workspace.py --workspace C:\\GIT\\ai-transfer --check

Použití (banka, korporátní repo bridge s config/vscode-profile.banka.json):
    python tools\\refresh-workspace.py --workspace <korp. workspace> --profile banka --set thin --kanon <kanon>

Návratové kódy: 0 = OK / pumpa aktuální · 1 = build/verify selhal nebo pumpa zastaralá či
nesouhlasí · 2 = chybné vstupy (workspace neexistuje, PUMP-VERSION chybí u --check).

Python 3 stdlib only; syntax kompatibilní s Python 3.6 (banka): žádný walrus, žádné
f-string `=`, žádné anotace list[str].
"""

import argparse
import datetime
import hashlib
import io
import os
import re
import subprocess
import sys
from pathlib import Path

REFRESH_VERSION = "1.0"
PUMP_NAME = "pump.wsf"
PUMP_VERSION_NAME = "PUMP-VERSION"
GITHUB_DIR = ".github"

# Hlavička pumpy: `// EA File Bridge - pumpa v0.5 (eafb/0.2)`
PUMP_HEADER_RE = re.compile(r"EA File Bridge\s*-\s*pumpa\s+v(\d+\.\d+)\s*\((eafb/[\d.]+)\)")

# Skeleton: složka → .gitkeep vždy (requests, responses) / jen je-li prázdná (zadani).
SKELETON_ALWAYS = ["requests", "responses"]
SKELETON_IF_EMPTY = ["zadani"]

GITIGNORE_BEGIN = "# --- refresh-workspace: spravovany blok (needitovat; tools/refresh-workspace.py v bridge) ---"
GITIGNORE_END = "# --- /refresh-workspace ---"
GITIGNORE_LINES = [
    "# runtime pumpy - davky a odpovedi nesou data z EA repozitare, do gitu nepatri",
    "requests/*",
    "!requests/.gitkeep",
    "responses/*",
    "!responses/.gitkeep",
    "# zamek jedine instance pumpy (pump.wsf v0.13)",
    ".pump.lock",
    "# perzistentni stav bridge (FB_StateFile), stanice-zavisly",
    "state-*.txt",
    "# hodnoty banky pro tools/banka-dosad.py - jen v korporatnim repu, pres kuryr nikdy",
    "config/banka-hodnoty.json",
    "banka-ready/",
    "# Python bytecode",
    "__pycache__/",
    "*.pyc",
]


# ---------------------------------------------------------------------------
# Pomocné funkce
# ---------------------------------------------------------------------------

def safe_console():
    """Windows konzole s cp1250/cp852: nepadat na diakritice (stejně jako build-vscode.py)."""
    for name in ("stdout", "stderr"):
        stream = getattr(sys, name)
        try:
            enc = (stream.encoding or "").lower()
        except Exception:
            enc = ""
        if enc not in ("utf-8", "utf8"):
            try:
                setattr(sys, name, io.TextIOWrapper(stream.buffer, encoding="utf-8",
                                                    errors="replace", line_buffering=True))
            except Exception:
                pass


def sha256_file(path):
    h = hashlib.sha256()
    with open(str(path), "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def tree_digest(root):
    """Otisk stromu (cesty + sha256) — idempotence: build se stejným vstupem = stejný otisk."""
    root = Path(root)
    if not root.is_dir():
        return None
    h = hashlib.sha256()
    for p in sorted(root.rglob("*")):
        if p.is_file():
            h.update(p.relative_to(root).as_posix().encode("utf-8"))
            h.update(b"\0")
            h.update(sha256_file(p).encode("ascii"))
            h.update(b"\n")
    return h.hexdigest()


def git(repo, *args):
    """Výstup git příkazu v repu bridge, nebo None (git chybí / není repo)."""
    try:
        proc = subprocess.Popen(["git", "-C", str(repo)] + list(args),
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out, _ = proc.communicate()
        if proc.returncode != 0:
            return None
        return out.decode("utf-8", errors="replace").strip()
    except OSError:
        return None


def parse_pump_header(pump_path):
    """(verze, protokol) z hlavičky pump.wsf; ('?', '?') když nenalezeno."""
    try:
        with open(str(pump_path), "r", encoding="utf-8", errors="replace") as f:
            head = f.read(8192)
    except OSError:
        return "?", "?"
    m = PUMP_HEADER_RE.search(head)
    if not m:
        return "?", "?"
    return m.group(1), m.group(2)


def parse_pump_version(text):
    """PUMP-VERSION → dict klíč: hodnota (řádky `klic: hodnota`, komentáře `#` se přeskočí)."""
    meta = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta


def render_pump_version(repo, pump_src, today):
    version, protocol = parse_pump_header(pump_src)
    sha = sha256_file(pump_src)
    size = pump_src.stat().st_size
    head = git(repo, "rev-parse", "--short", "HEAD") or "?"
    describe = git(repo, "describe", "--tags", "--always") or "?"
    pump_commit = git(repo, "log", "-1", "--format=%h %ad", "--date=short", "--", PUMP_NAME) or "?"
    dirty = git(repo, "status", "--porcelain", "--", PUMP_NAME)
    if dirty:
        head += " +necommitnute zmeny pump.wsf"
    lines = [
        "# PUMP-VERSION - vendorovana kopie pump.wsf z ea-file-bridge (tools/refresh-workspace.py).",
        "# Needitovat rucne. Aktualizace = refresh; kontrola = --check (docs/WORKSPACE-METODIKY.md).",
        "pump-version: %s" % version,
        "protocol: %s" % protocol,
        "sha256: %s" % sha,
        "bytes: %d" % size,
        "bridge-commit: %s" % head,
        "bridge-describe: %s" % describe,
        "pump-commit: %s" % pump_commit,
        "refreshed: %s" % today,
        "refresh-workspace.py: %s" % REFRESH_VERSION,
    ]
    return "\n".join(lines) + "\n", version, sha


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------

class Refresh(object):

    def __init__(self, repo, workspace, args):
        self.repo = repo
        self.ws = workspace
        self.args = args
        self.report = []
        self.errors = []
        self.changed = []      # co se zapsalo (pro idempotenci a git status)
        self.pump_src = repo / PUMP_NAME
        self.build_py = repo / "tools" / "build-vscode.py"

    def log(self, line=""):
        self.report.append(line)

    def err(self, msg):
        self.errors.append(msg)
        self.log("  [FAIL] %s" % msg)

    # -- pomocné zápisy ------------------------------------------------------
    def write_if_changed(self, path, data, label):
        """Zapiš jen při rozdílu (idempotence: druhý běh nic nemění)."""
        if path.is_file() and path.read_bytes() == data:
            self.log("  beze změny: %s" % label)
            return False
        if self.args.dry_run:
            self.log("  (dry-run) zapsal bych: %s" % label)
            return True
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        self.changed.append(label)
        self.log("  zapsáno: %s" % label)
        return True

    # -- kroky ---------------------------------------------------------------
    def step_build(self):
        self.log("")
        self.log("1. Build .github/ (tools/build-vscode.py):")
        if not self.args.kanon:
            self.err("--kanon je povinný pro build (nebo použij --verify / --check)")
            return False
        cmd = [sys.executable, str(self.build_py),
               "--kanon", self.args.kanon,
               "--profile", self.args.profile,
               "--set", self.args.skill_set,
               "--out", str(self.ws / GITHUB_DIR),
               "--config-dir", self.args.config_dir]
        if self.args.templates:
            cmd += ["--templates", self.args.templates]
        if self.args.terminal:
            cmd += ["--terminal", self.args.terminal]
        if self.args.dry_run:
            cmd.append("--dry-run")
        before = tree_digest(self.ws / GITHUB_DIR)
        rc, out = run_cmd(cmd)
        for line in out.rstrip("\n").split("\n"):
            self.log("  | " + line)
        if rc != 0:
            self.err("build-vscode.py skončil s kódem %d — .github/ ve workspace se nezměnilo" % rc)
            return False
        if tree_digest(self.ws / GITHUB_DIR) != before:
            self.changed.append("%s/ (build)" % GITHUB_DIR)
            self.log("  zapsáno: %s/ (build)" % GITHUB_DIR)
        else:
            self.log("  beze změny: %s/ (build dal stejný obsah)" % GITHUB_DIR)
        return True

    def step_pump(self, today):
        self.log("")
        self.log("2. Pumpa (vendorovaná kopie %s + %s):" % (PUMP_NAME, PUMP_VERSION_NAME))
        if not self.pump_src.is_file():
            self.err("chybí zdroj pumpy: %s" % self.pump_src)
            return False
        text, version, sha = render_pump_version(self.repo, self.pump_src, today)
        self.log("  zdroj: %s (pumpa v%s, sha256 %s…)" % (self.pump_src, version, sha[:12]))
        self.write_if_changed(self.ws / PUMP_NAME, self.pump_src.read_bytes(), PUMP_NAME)
        # PUMP-VERSION: `refreshed` se mění jen když se změnila pumpa (idempotence dne nezávislá)
        pv_path = self.ws / PUMP_VERSION_NAME
        if pv_path.is_file():
            old = parse_pump_version(pv_path.read_text(encoding="utf-8", errors="replace"))
            if old.get("sha256") == sha and old.get("bridge-commit") == \
                    parse_pump_version(text).get("bridge-commit"):
                self.log("  beze změny: %s (stejná pumpa i commit)" % PUMP_VERSION_NAME)
                return True
        self.write_if_changed(pv_path, text.encode("utf-8"), PUMP_VERSION_NAME)
        return True

    def step_skeleton(self):
        self.log("")
        self.log("3. Skeleton složek + .gitignore:")
        for name in SKELETON_ALWAYS:
            self.write_if_changed(self.ws / name / ".gitkeep", b"", "%s/.gitkeep" % name)
        for name in SKELETON_IF_EMPTY:
            d = self.ws / name
            if d.is_dir() and any(p.name != ".gitkeep" for p in d.iterdir()):
                self.log("  beze změny: %s/ (má obsah, nesahám)" % name)
                continue
            self.write_if_changed(d / ".gitkeep", b"", "%s/.gitkeep" % name)
        self.step_gitignore()
        return True

    def step_gitignore(self):
        gi = self.ws / ".gitignore"
        block = "\n".join([GITIGNORE_BEGIN] + GITIGNORE_LINES + [GITIGNORE_END]) + "\n"
        if gi.is_file():
            current = gi.read_text(encoding="utf-8", errors="replace")
        else:
            current = ""
        if GITIGNORE_BEGIN in current and GITIGNORE_END in current:
            pre, rest = current.split(GITIGNORE_BEGIN, 1)
            _, post = rest.split(GITIGNORE_END, 1)
            post = post.lstrip("\n")
            new = pre + block + (("\n" + post) if post.strip() else "")
        else:
            new = current
            if new and not new.endswith("\n"):
                new += "\n"
            if new.strip():
                new += "\n"
            new += block
        # jiné řádky uživatele (mimo blok) zůstávají beze změny
        self.write_if_changed(gi, new.encode("utf-8"), ".gitignore (spravovaný blok)")

    # -- kontroly ------------------------------------------------------------
    def check_pump(self, freshness=True):
        """Porovná PUMP-VERSION × pump.wsf ve workspace × pump.wsf v bridge.
        Vrací kód: 0 aktuální · 1 zastaralá / nesouhlasí · 2 chybí."""
        self.log("")
        self.log("Kontrola pumpy (%s):" % PUMP_VERSION_NAME)
        pv_path = self.ws / PUMP_VERSION_NAME
        ws_pump = self.ws / PUMP_NAME
        if not pv_path.is_file():
            self.err("%s ve workspace chybí — spusť refresh" % PUMP_VERSION_NAME)
            return 2
        if not ws_pump.is_file():
            self.err("%s ve workspace chybí — spusť refresh" % PUMP_NAME)
            return 2
        meta = parse_pump_version(pv_path.read_text(encoding="utf-8", errors="replace"))
        ws_sha = sha256_file(ws_pump)
        ws_version, _ = parse_pump_header(ws_pump)
        self.log("  workspace: pumpa v%s, sha256 %s…, %s říká v%s / commit %s (refresh %s)"
                 % (ws_version, ws_sha[:12], PUMP_VERSION_NAME, meta.get("pump-version", "?"),
                    meta.get("bridge-commit", "?"), meta.get("refreshed", "?")))
        rc = 0
        if meta.get("sha256") != ws_sha:
            self.err("pump.wsf ve workspace NEODPOVÍDÁ %s (sha256) — ruční editace nebo "
                     "poškozená kopie; spusť refresh" % PUMP_VERSION_NAME)
            rc = 1
        if freshness:
            if not self.pump_src.is_file():
                self.log("  [WARN] zdroj pumpy v bridge chybí (%s) — aktuálnost nelze posoudit"
                         % self.pump_src)
            else:
                src_sha = sha256_file(self.pump_src)
                src_version, _ = parse_pump_header(self.pump_src)
                if src_sha == ws_sha:
                    self.log("  aktuální: pumpa ve workspace = pumpa v bridge (v%s)" % src_version)
                else:
                    self.err("pumpa ve workspace je ZASTARALÁ: bridge má v%s sha256 %s…, "
                             "workspace v%s sha256 %s… — spusť refresh"
                             % (src_version, src_sha[:12], ws_version, ws_sha[:12]))
                    rc = 1
        return rc

    def check_skeleton(self):
        self.log("")
        self.log("Kontrola skeletonu:")
        ok = True
        for name in SKELETON_ALWAYS + SKELETON_IF_EMPTY:
            if (self.ws / name).is_dir():
                self.log("  ok: %s/" % name)
            else:
                self.err("chybí složka %s/ — spusť refresh" % name)
                ok = False
        gi = self.ws / ".gitignore"
        if gi.is_file() and GITIGNORE_BEGIN in gi.read_text(encoding="utf-8", errors="replace"):
            self.log("  ok: .gitignore má spravovaný blok")
        else:
            self.err(".gitignore bez spravovaného bloku — spusť refresh")
            ok = False
        return ok

    def verify_build(self):
        self.log("")
        self.log("Verify .github/ (tools/build-vscode.py --verify):")
        cmd = [sys.executable, str(self.build_py), "--profile", self.args.profile,
               "--out", str(self.ws / GITHUB_DIR), "--config-dir", self.args.config_dir,
               "--verify"]
        rc, out = run_cmd(cmd)
        for line in out.rstrip("\n").split("\n"):
            self.log("  | " + line)
        if rc != 0:
            self.err("verify .github/ selhal (kód %d)" % rc)
        return rc == 0

    # -- běhy ----------------------------------------------------------------
    def header(self, mode):
        self.log("refresh-workspace.py %s — %s (%s)" % (REFRESH_VERSION,
                                                       datetime.date.today().isoformat(), mode))
        self.log("  bridge:    %s" % self.repo)
        self.log("  workspace: %s%s" % (self.ws, "  (DRY-RUN — nic se nezapisuje)"
                                        if self.args.dry_run else ""))

    def run_refresh(self):
        self.header("refresh")
        self.log("  profil:    %s · sada: %s · terminál: %s" % (
            self.args.profile, self.args.skill_set, self.args.terminal or "dle profilu"))
        today = datetime.date.today().isoformat()
        if self.step_build():
            self.step_pump(today)
            self.step_skeleton()
        return self.finish()

    def run_verify(self):
        self.header("verify")
        self.verify_build()
        self.check_pump(freshness=True)
        self.check_skeleton()
        rc = self.finish(quiet=True)
        if rc == 0:
            self.report[-1] = "[OK] verify prošel (.github/ dle manifestu, pumpa aktuální, skeleton)"
        return rc

    def run_check(self):
        self.header("check")
        rc = self.check_pump(freshness=True)
        self.finish(quiet=True)
        return rc

    def finish(self, quiet=False):
        self.log("")
        if self.errors:
            self.log("[FAIL] %d problémů" % len(self.errors))
            return 1
        if not quiet:
            if self.args.dry_run:
                self.log("[OK] dry-run prošel, nic nezapsáno")
            elif self.changed:
                self.log("[OK] hotovo — změněno: %s" % ", ".join(self.changed))
            else:
                self.log("[OK] hotovo — workspace beze změny")
        else:
            self.log("[OK] pumpa aktuální")
        return 0


def run_cmd(cmd):
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    out, _ = proc.communicate()
    return proc.returncode, out.decode("utf-8", errors="replace")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv=None):
    safe_console()
    repo = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(
        description="Refresh workspace repa metodiky (.github/ build, vendorovaná pumpa + "
                    "PUMP-VERSION, skeleton) z ea-file-bridge.")
    ap.add_argument("--workspace", required=True,
                    help="kořen workspace repa (musí existovat, např. C:\\GIT\\ai-transfer)")
    ap.add_argument("--profile", default="doma", choices=["doma", "banka"],
                    help="profil buildu (config/vscode-profile.<profil>.json; default doma)")
    ap.add_argument("--set", dest="skill_set", default="full", choices=["thin", "full"],
                    help="sada skillů (default full — workspace analytika)")
    ap.add_argument("--kanon", help="cesta ke kanonu Skilly/ (povinné pro refresh)")
    ap.add_argument("--templates", help="složka šablon (default <kanon>/_vscode)")
    ap.add_argument("--terminal", choices=["on", "off"], help="varianta s terminálem (PV-R8 ii)")
    ap.add_argument("--config-dir", default=str(repo / "config"),
                    help="složka s vscode-profile.<profil>.json (default <bridge>/config)")
    ap.add_argument("--verify", action="store_true",
                    help="jen ověř: build-vscode --verify nad workspace + PUMP-VERSION + skeleton")
    ap.add_argument("--check", action="store_true",
                    help="jen porovnej PUMP-VERSION × pump.wsf (workspace × bridge); exit 0/1/2")
    ap.add_argument("--dry-run", action="store_true", help="nic nezapisuj (build dry-run)")
    ap.add_argument("--log", help="soubor, kam se zapíše tentýž report jako na konzoli")
    args = ap.parse_args(argv)

    ws = Path(args.workspace).resolve()
    report = []
    if not ws.is_dir():
        report.append("[FAIL] workspace neexistuje: %s (naklonuj / založ repo, pak refresh)" % ws)
        rc = 2
    elif ws == repo:
        report.append("[FAIL] workspace nesmí být samo repo bridge (%s) — bridge je produkt "
                      "správce, workspace je jiné repo (docs/WORKSPACE-METODIKY.md)" % repo)
        rc = 2
    else:
        r = Refresh(repo, ws, args)
        if args.check:
            rc = r.run_check()
        elif args.verify:
            rc = r.run_verify()
        else:
            rc = r.run_refresh()
        report = r.report
    text = "\n".join(report) + "\n"
    sys.stdout.write(text)
    if args.log:
        lp = Path(args.log)
        lp.parent.mkdir(parents=True, exist_ok=True)
        lp.write_text(text, encoding="utf-8")
    return rc


if __name__ == "__main__":
    sys.exit(main())
