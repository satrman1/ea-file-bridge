#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Testy tools/refresh-workspace.py (unittest, stdlib) — Z260911-4, docs/WORKSPACE-METODIKY.md.

Spuštění:  python test/refresh-workspace.test.py
Workspace = temp složka; kanon = fixture test/fixtures/vscode-kanon/ (stejná jako
build-vscode.test.py); config = kopie config/ v temp. Repo bridge se nemění
(tool čte pump.wsf a tools/build-vscode.py z tohoto repa).
Syntax kompatibilní s Python 3.6.
"""

import hashlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TOOL = REPO / "tools" / "refresh-workspace.py"
FIXTURE = REPO / "test" / "fixtures" / "vscode-kanon"
CONFIG = REPO / "config"
PUMP = REPO / "pump.wsf"


def run(*args):
    proc = subprocess.Popen([sys.executable, str(TOOL)] + [str(a) for a in args],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    out, _ = proc.communicate()
    return proc.returncode, out.decode("utf-8", errors="replace")


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def tree(root):
    """{relativní cesta: sha256} všech souborů pod root (bez .git)."""
    root = Path(root)
    out = {}
    for p in root.rglob("*"):
        if p.is_file() and ".git" not in p.relative_to(root).parts:
            out[p.relative_to(root).as_posix()] = sha256(p)
    return out


def parse_pv(text):
    meta = {}
    for line in text.splitlines():
        if line.startswith("#") or ":" not in line:
            continue
        k, v = line.split(":", 1)
        meta[k.strip()] = v.strip()
    return meta


class Base(unittest.TestCase):

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="rw-"))
        self.cfg = self.tmp / "config"
        self.cfg.mkdir()
        shutil.copy(str(CONFIG / "vscode-profile.doma.json"), str(self.cfg))
        shutil.copy(str(CONFIG / "vscode-profile.banka.example.json"),
                    str(self.cfg / "vscode-profile.banka.json"))
        self.ws = self.tmp / "workspace"
        self.ws.mkdir()

    def tearDown(self):
        shutil.rmtree(str(self.tmp), ignore_errors=True)

    def refresh(self, *extra):
        return run("--workspace", self.ws, "--profile", "doma", "--set", "thin",
                   "--kanon", FIXTURE, "--config-dir", self.cfg, *extra)

    def verify(self):
        return run("--workspace", self.ws, "--profile", "doma", "--config-dir", self.cfg,
                   "--verify")

    def check(self):
        return run("--workspace", self.ws, "--check")


class Skeleton(Base):

    def test_refresh_zalozi_workspace(self):
        # existující obsah, na který tool nesmí sáhnout
        (self.ws / "zadani").mkdir()
        (self.ws / "zadani" / "moje-brd.md").write_text("# BRD\n", encoding="utf-8")
        (self.ws / "requests").mkdir()
        (self.ws / "requests" / "req-x.json").write_text("{}", encoding="utf-8")
        (self.ws / ".gitignore").write_text("# moje\n*.bak\n", encoding="utf-8")

        rc, out = self.refresh()
        self.assertEqual(rc, 0, out)
        # build
        self.assertTrue((self.ws / ".github" / "skills-manifest.md").is_file(), out)
        self.assertTrue((self.ws / ".github" / "copilot-instructions.md").is_file())
        self.assertTrue((self.ws / ".github" / "agents" / "sa-analytik.agent.md").is_file())
        # pumpa = bit-shodná kopie
        self.assertEqual(sha256(self.ws / "pump.wsf"), sha256(PUMP))
        pv = parse_pv((self.ws / "PUMP-VERSION").read_text(encoding="utf-8"))
        self.assertEqual(pv["sha256"], sha256(PUMP))
        self.assertRegex(pv["pump-version"], r"^\d+\.\d+$")
        self.assertRegex(pv["protocol"], r"^eafb/")
        self.assertIn("bridge-commit", pv)
        self.assertIn("refreshed", pv)
        # skeleton
        self.assertTrue((self.ws / "requests" / ".gitkeep").is_file())
        self.assertTrue((self.ws / "responses" / ".gitkeep").is_file())
        # zadani/ má obsah → bez .gitkeep, obsah netknutý
        self.assertFalse((self.ws / "zadani" / ".gitkeep").exists())
        self.assertEqual((self.ws / "zadani" / "moje-brd.md").read_text(encoding="utf-8"), "# BRD\n")
        self.assertEqual((self.ws / "requests" / "req-x.json").read_text(encoding="utf-8"), "{}")
        # .gitignore: uživatelské řádky zůstaly + spravovaný blok
        gi = (self.ws / ".gitignore").read_text(encoding="utf-8")
        self.assertTrue(gi.startswith("# moje\n*.bak\n"), gi)
        for needle in ("requests/*", "!requests/.gitkeep", "responses/*", ".pump.lock",
                       "config/banka-hodnoty.json", "state-*.txt"):
            self.assertIn(needle, gi)

    def test_prazdne_zadani_dostane_gitkeep(self):
        rc, out = self.refresh()
        self.assertEqual(rc, 0, out)
        self.assertTrue((self.ws / "zadani" / ".gitkeep").is_file())
        self.assertFalse((self.ws / ".pump.lock").exists())

    def test_dry_run_nic_nezapise(self):
        rc, out = self.refresh("--dry-run")
        self.assertEqual(rc, 0, out)
        self.assertEqual(tree(self.ws), {}, "dry-run zapsal soubory")
        self.assertIn("DRY-RUN", out)


class Idempotence(Base):

    def test_druhy_beh_nic_nemeni(self):
        rc, out = self.refresh()
        self.assertEqual(rc, 0, out)
        first = tree(self.ws)
        rc, out = self.refresh()
        self.assertEqual(rc, 0, out)
        self.assertEqual(tree(self.ws), first)
        self.assertIn("workspace beze změny", out)
        # .gitignore má blok jen jednou
        gi = (self.ws / ".gitignore").read_text(encoding="utf-8")
        self.assertEqual(gi.count("refresh-workspace: spravovany blok"), 1)

    def test_prepsany_blok_gitignore_se_obnovi(self):
        rc, out = self.refresh()
        self.assertEqual(rc, 0, out)
        gi_path = self.ws / ".gitignore"
        gi = gi_path.read_text(encoding="utf-8")
        gi = gi.replace("requests/*\n", "")            # někdo blok poškodil
        gi_path.write_text(gi + "\nvlastni/\n", encoding="utf-8")
        rc, out = self.refresh()
        self.assertEqual(rc, 0, out)
        gi = gi_path.read_text(encoding="utf-8")
        self.assertIn("requests/*", gi)
        self.assertIn("vlastni/", gi)                   # řádek mimo blok přežil
        self.assertEqual(gi.count("refresh-workspace: spravovany blok"), 1)


class PumpVersion(Base):

    def test_check_aktualni(self):
        rc, out = self.refresh()
        self.assertEqual(rc, 0, out)
        rc, out = self.check()
        self.assertEqual(rc, 0, out)
        self.assertIn("aktuální", out)

    def test_check_chybi(self):
        rc, out = self.check()
        self.assertEqual(rc, 2, out)
        self.assertIn("chybí", out)

    def test_check_rucni_editace_pumpy(self):
        rc, out = self.refresh()
        self.assertEqual(rc, 0, out)
        p = self.ws / "pump.wsf"
        p.write_bytes(p.read_bytes() + b"\n// rucni zasah\n")
        rc, out = self.check()
        self.assertEqual(rc, 1, out)
        self.assertIn("NEODPOVÍDÁ", out)

    def test_check_zastarala(self):
        rc, out = self.refresh()
        self.assertEqual(rc, 0, out)
        # simulace starší vendorované pumpy: jiný obsah + PUMP-VERSION, který k němu sedí
        p = self.ws / "pump.wsf"
        old = p.read_bytes().replace(b"pumpa v", b"pumpa v0.0-stara-")
        p.write_bytes(old)
        pv_path = self.ws / "PUMP-VERSION"
        pv = pv_path.read_text(encoding="utf-8")
        pv = pv.replace(sha256(PUMP), hashlib.sha256(old).hexdigest())
        pv_path.write_text(pv, encoding="utf-8")
        rc, out = self.check()
        self.assertEqual(rc, 1, out)
        self.assertIn("ZASTARALÁ", out)
        # refresh ji obnoví
        rc, out = self.refresh()
        self.assertEqual(rc, 0, out)
        self.assertEqual(sha256(p), sha256(PUMP))
        self.assertEqual(self.check()[0], 0)


class Verify(Base):

    def test_verify_po_refreshi(self):
        rc, out = self.refresh()
        self.assertEqual(rc, 0, out)
        rc, out = self.verify()
        self.assertEqual(rc, 0, out)
        self.assertIn("[OK] verify prošel", out)

    def test_verify_odhali_rucni_editaci_github(self):
        rc, out = self.refresh()
        self.assertEqual(rc, 0, out)
        (self.ws / ".github" / "skills" / "rucni.md").write_text("x", encoding="utf-8")
        rc, out = self.verify()
        self.assertEqual(rc, 1, out)
        self.assertIn("mimo manifest", out)

    def test_verify_bez_refreshe(self):
        rc, out = self.verify()
        self.assertEqual(rc, 1, out)


class Vstupy(Base):

    def test_workspace_neexistuje(self):
        rc, out = run("--workspace", self.tmp / "neni", "--profile", "doma", "--kanon", FIXTURE,
                      "--config-dir", self.cfg)
        self.assertEqual(rc, 2, out)

    def test_workspace_nesmi_byt_bridge(self):
        rc, out = run("--workspace", REPO, "--profile", "doma", "--kanon", FIXTURE,
                      "--config-dir", self.cfg, "--dry-run")
        self.assertEqual(rc, 2, out)
        self.assertIn("nesmí být samo repo bridge", out)

    def test_bez_kanonu_selze(self):
        rc, out = run("--workspace", self.ws, "--profile", "doma", "--config-dir", self.cfg)
        self.assertEqual(rc, 1, out)
        self.assertIn("--kanon", out)
        self.assertEqual(tree(self.ws), {})


if __name__ == "__main__":
    unittest.main(verbosity=2)
