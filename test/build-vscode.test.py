#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Testy tools/build-vscode.py nad fixture test/fixtures/vscode-kanon/ (unittest, stdlib).

Spuštění:  python test/build-vscode.test.py        (nebo  python -m unittest test.build-vscode.test)
Fixture = minimální syntetický kanon (22 skillů, _shared 7, _vscode šablony s placeholdery).
Negativní testy pracují nad kopií fixture v temp složce — fixture se nemění.
Syntax držena kompatibilní s Python 3.6.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BUILD = REPO / "tools" / "build-vscode.py"
FIXTURE = REPO / "test" / "fixtures" / "vscode-kanon"
CONFIG = REPO / "config"


def run(*args):
    """Spustí build-vscode.py, vrátí (rc, výstup)."""
    proc = subprocess.Popen([sys.executable, str(BUILD)] + [str(a) for a in args],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    out, _ = proc.communicate()
    return proc.returncode, out.decode("utf-8", errors="replace")


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(text, encoding="utf-8")


class Base(unittest.TestCase):

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="bv-"))
        self.cfg = self.tmp / "config"
        self.cfg.mkdir()
        shutil.copy(str(CONFIG / "vscode-profile.doma.json"), str(self.cfg))
        shutil.copy(str(CONFIG / "vscode-profile.banka.example.json"),
                    str(self.cfg / "vscode-profile.banka.json"))

    def tearDown(self):
        shutil.rmtree(str(self.tmp), ignore_errors=True)

    def kanon_copy(self):
        dst = self.tmp / "kanon"
        shutil.copytree(str(FIXTURE), str(dst))
        return dst

    def build(self, profile="doma", skill_set="thin", kanon=None, out=None, extra=()):
        out = out or (self.tmp / ("out-%s-%s" % (profile, skill_set)))
        rc, log = run("--kanon", kanon or FIXTURE, "--out", out, "--profile", profile,
                      "--set", skill_set, "--config-dir", self.cfg, *extra)
        return rc, log, out

    def skill_dirs(self, out):
        return sorted(p.parent.name for p in (out / "skills").glob("*/SKILL.md"))


class PositiveBuilds(Base):

    def test_thin_doma_ak1(self):
        rc, log, out = self.build()
        self.assertEqual(rc, 0, log)
        ci = out / "copilot-instructions.md"
        self.assertTrue(ci.is_file())
        self.assertLessEqual(ci.stat().st_size, 8192)
        self.assertTrue((out / "agents" / "sa-analytik.agent.md").is_file())
        self.assertGreaterEqual(len(list((out / "instructions").glob("*.instructions.md"))), 2)
        self.assertEqual(self.skill_dirs(out), sorted([
            "prevzeti-zadani", "emr-scaffold", "use-case-model", "use-case-analyst",
            "emr-qa", "emr-konvence", "eafb-bridge", "e2e-f0-f1"]))
        self.assertTrue((out / "skills-manifest.md").is_file())
        # substituce
        text = read(ci)
        self.assertIn("EAEXAMPLE.QEA", text)
        self.assertIn("#FB-TEST {CCD344F6-9EAA-44eb-BAA4-4952E48526B7}", text)
        self.assertIn("sqlite", text)
        self.assertNotIn("{{", text)
        # _shared → emr-konvence/references
        refs = out / "skills" / "emr-konvence" / "references"
        self.assertEqual(len(list(refs.iterdir())), 7)
        self.assertIn("## 12.", read(refs / "emr-zapis-pravidla.md"))

    def test_links_and_rewrites(self):
        rc, log, out = self.build()
        self.assertEqual(rc, 0, log)
        uca = read(out / "skills" / "use-case-analyst" / "SKILL.md")
        self.assertIn("[use-case-rules](references/use-case-rules.md)", uca)
        self.assertIn("[index](references/uc-patterns/index.md)", uca)
        self.assertIn("`references/nic.md`", uca)  # uvnitř ``` se nemění
        idx = read(out / "skills" / "use-case-analyst" / "references" / "uc-patterns" / "index.md")
        self.assertIn("[pattern-crud](pattern-crud.md)", idx)
        self.assertIn("[use-case-rules](../use-case-rules.md)", idx)
        pz = read(out / "skills" / "prevzeti-zadani" / "SKILL.md")
        self.assertIn("(mimo workspace", pz)
        self.assertIn("(skill `emr-konvence`, references/emr-zapis-pravidla.md)", pz)
        qa = read(out / "skills" / "emr-qa" / "SKILL.md")
        self.assertIn("(skill `eafb-bridge`, references/EAFB-Operace-Registr.md)", qa)
        self.assertIn("(references/qc-verzovani.sql)", qa)
        self.assertTrue((out / "skills" / "emr-qa" / "references" / "qc-verzovani.sql").is_file())
        ucm = read(out / "skills" / "use-case-model" / "SKILL.md")
        self.assertIn("(skill `use-case-analyst`)", ucm)
        # AK-3: žádné ../../ v celém stromu skillů
        for p in (out / "skills").rglob("*"):
            if p.is_file() and p.suffix in (".md", ".sql"):
                self.assertNotIn("../../", read(p), str(p))
        self.assertIn("Přepisy odkazů", log)

    def test_full_doma_and_banka(self):
        rc, log, out = self.build(skill_set="full")
        self.assertEqual(rc, 0, log)
        dirs = self.skill_dirs(out)
        self.assertEqual(len(dirs), 24, dirs)
        self.assertIn("ea-addin-developer", dirs)
        self.assertNotIn("sa-orchestrator", dirs)
        # CRLF zdroj → LF výstup
        sql = (out / "skills" / "ea-sql-expert" / "references" / "EASchema.sql").read_bytes()
        self.assertNotIn(b"\r", sql)
        # tranzitivní dosažitelnost references (index → dekompozice.md)
        self.assertTrue((out / "skills" / "solution-architect" / "references" / "idesign"
                         / "dekompozice.md").is_file())

        rc, log, out = self.build(profile="banka", skill_set="full")
        self.assertEqual(rc, 0, log)
        dirs = self.skill_dirs(out)
        self.assertEqual(len(dirs), 23, dirs)
        self.assertNotIn("ea-addin-developer", dirs)
        ci = read(out / "copilot-instructions.md")
        self.assertIn("mssql", ci)
        self.assertIn("deploy_src, delete_from_model, clone_package", ci)
        self.assertIn("<TEST-DB>", ci)

    def test_thin_banka_example_sweep_report_only(self):
        rc, log, out = self.build(profile="banka")
        self.assertEqual(rc, 0, log)
        self.assertIn("Sweep B1", log)

    def test_deterministic(self):
        rc1, _, out1 = self.build(out=self.tmp / "d1")
        rc2, _, out2 = self.build(out=self.tmp / "d2")
        self.assertEqual((rc1, rc2), (0, 0))
        files1 = {p.relative_to(out1).as_posix(): p.read_bytes() for p in out1.rglob("*")
                  if p.is_file()}
        files2 = {p.relative_to(out2).as_posix(): p.read_bytes() for p in out2.rglob("*")
                  if p.is_file()}
        self.assertEqual(files1, files2)

    def test_dry_run_writes_nothing_and_log(self):
        logf = self.tmp / "b.log"
        rc, log, out = self.build(extra=("--dry-run", "--log", logf))
        self.assertEqual(rc, 0, log)
        self.assertFalse(out.exists())
        self.assertIn("dry-run", log)
        self.assertTrue(logf.is_file())
        self.assertEqual(read(logf), log)

    def test_rebuild_replaces_managed_tree_only(self):
        rc, _, out = self.build()
        self.assertEqual(rc, 0)
        write(out / "workflows" / "ci.yml", "name: x\n")
        write(out / "skills" / "rucni-skill" / "SKILL.md", "---\nname: rucni-skill\n---\n")
        rc, log, _ = self.build(out=out)
        self.assertEqual(rc, 0, log)
        self.assertTrue((out / "workflows" / "ci.yml").is_file())
        self.assertFalse((out / "skills" / "rucni-skill").exists())

    def test_missing_konvence_template_is_generated(self):
        kanon = self.kanon_copy()
        (kanon / "_vscode" / "skills" / "emr-konvence" / "SKILL.md").unlink()
        rc, log, out = self.build(kanon=kanon)
        self.assertEqual(rc, 0, log)
        self.assertIn("šablona chybí", log)
        text = read(out / "skills" / "emr-konvence" / "SKILL.md")
        self.assertIn("name: emr-konvence", text)
        self.assertIn("(references/emr-zapis-pravidla.md)", text)


class NegativeBuilds(Base):

    def broken(self, mutate):
        kanon = self.kanon_copy()
        mutate(kanon)
        rc, log, out = self.build(kanon=kanon, out=self.tmp / "neg-out")
        self.assertFalse((self.tmp / "neg-out").exists(), "při FAIL se nesmí nic zapsat")
        return rc, log

    def test_name_mismatch(self):
        def m(k):
            p = k / "emr-qa" / "SKILL.md"
            write(p, read(p).replace("name: emr-qa", "name: emr-QA"))
        rc, log = self.broken(m)
        self.assertEqual(rc, 1)
        self.assertIn("AK-2", log)
        self.assertIn("název složky", log)

    def test_description_too_long(self):
        def m(k):
            p = k / "emr-scaffold" / "SKILL.md"
            write(p, read(p).replace("description: ", "description: " + "x" * 1030))
        rc, log = self.broken(m)
        self.assertEqual(rc, 1)
        self.assertIn("description", log)
        self.assertIn("> 1024", log)

    def test_unlinked_reference(self):
        def m(k):
            write(k / "use-case-analyst" / "references" / "osirely.md", "# Osiřelý\n\nNikdo neodkazuje.\n")
        rc, log = self.broken(m)
        self.assertEqual(rc, 1)
        self.assertIn("references/osirely.md není odkázán", log)
        self.assertIn("AK-3", log)

    def test_unreplaced_placeholder(self):
        def m(k):
            p = k / "_vscode" / "copilot-instructions.md"
            write(p, read(p) + "\nNeznámý {{NECO_JINEHO}}.\n")
        rc, log = self.broken(m)
        self.assertEqual(rc, 1)
        self.assertIn("nenahrazený placeholder {{NECO_JINEHO}}", log)

    def test_copilot_instructions_over_limit(self):
        def m(k):
            p = k / "_vscode" / "copilot-instructions.md"
            write(p, read(p) + ("x" * 8200) + "\n")
        rc, log = self.broken(m)
        self.assertEqual(rc, 1)
        self.assertIn("limit 8192", log)

    def test_missing_required_template(self):
        def m(k):
            (k / "_vscode" / "agents" / "sa-analytik.agent.md").unlink()
        rc, log = self.broken(m)
        self.assertEqual(rc, 1)
        self.assertIn("šablona chybí", log)

    def test_missing_marker(self):
        def m(k):
            p = k / "_shared" / "emr-zapis-pravidla.md"
            write(p, read(p).replace("## 12.", "## 12b."))
        rc, log = self.broken(m)
        self.assertEqual(rc, 1)
        self.assertIn("marker aktuálnosti", log)

    def test_sweep_doma_fails_banka_reports(self):
        def m(k):
            p = k / "emr-scaffold" / "SKILL.md"
            write(p, read(p) + "\nKontakt: analytik@intranet.example.com, ticket PROJ-4711, "
                               "server \\\\fileserver01\\share, https://intranet.example/x\n")
        rc, log = self.broken(m)
        self.assertEqual(rc, 1)
        self.assertIn("NEOŠETŘENÉ nálezy: 4", log)
        self.assertIn("[email]", log)
        self.assertIn("[jira]", log)
        self.assertIn("[unc]", log)
        self.assertIn("[url]", log)
        # banka: jen report
        kanon = self.tmp / "kanon"
        rc, log, out = self.build(profile="banka", kanon=kanon, out=self.tmp / "banka-out")
        self.assertEqual(rc, 0, log)
        self.assertIn("NEOŠETŘENÉ nálezy: 4", log)
        self.assertIn("jen report", log)

    def test_guid_outside_whitelist(self):
        def m(k):
            p = k / "emr-scaffold" / "SKILL.md"
            write(p, read(p) + "\nŠablona {12345678-ABCD-4bcd-9ef0-123456789ABC}.\n")
        rc, log = self.broken(m)
        self.assertEqual(rc, 1)
        self.assertIn("[guid]", log)

    def test_nul_bytes(self):
        def m(k):
            p = k / "emr-qa" / "SKILL.md"
            p.write_bytes(p.read_bytes() + b"\x00\x00")
        rc, log = self.broken(m)
        self.assertEqual(rc, 1)
        self.assertIn("NUL", log)

    def test_profile_mdg_key_forbidden(self):
        p = self.cfg / "vscode-profile.doma.json"
        d = json.loads(read(p))
        d["mdg"] = "X"
        write(p, json.dumps(d))
        rc, log, _ = self.build()
        self.assertEqual(rc, 1)
        self.assertIn("PV-R6", log)


class Verify(Base):

    def test_verify_ok_then_damaged(self):
        rc, log, out = self.build()
        self.assertEqual(rc, 0, log)
        rc, log = run("--out", out, "--profile", "doma", "--config-dir", self.cfg, "--verify")
        self.assertEqual(rc, 0, log)
        self.assertIn("[OK] verify", log)
        # ruční poškození souboru
        p = out / "skills" / "emr-qa" / "SKILL.md"
        write(p, read(p) + "ruční edit\n")
        rc, log = run("--out", out, "--profile", "doma", "--config-dir", self.cfg, "--verify")
        self.assertEqual(rc, 1, log)
        self.assertIn("NESOUHLASÍ sha256: skills/emr-qa/SKILL.md", log)

    def test_verify_missing_and_extra(self):
        rc, log, out = self.build()
        self.assertEqual(rc, 0, log)
        (out / "skills" / "emr-scaffold" / "SKILL.md").unlink()
        write(out / "skills" / "emr-qa" / "references" / "navic.md", "# navíc\n")
        rc, log = run("--out", out, "--profile", "doma", "--config-dir", self.cfg, "--verify")
        self.assertEqual(rc, 1, log)
        self.assertIn("chybí: skills/emr-scaffold/SKILL.md", log)
        self.assertIn("mimo manifest", log)

    def test_verify_without_manifest(self):
        rc, log = run("--out", self.tmp / "nic", "--profile", "doma", "--config-dir", self.cfg,
                      "--verify")
        self.assertEqual(rc, 1)
        self.assertIn("chybí skills-manifest.md", log)


if __name__ == "__main__":
    unittest.main(verbosity=2)
