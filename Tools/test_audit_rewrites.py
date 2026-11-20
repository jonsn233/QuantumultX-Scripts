#!/usr/bin/env python3
"""Regression tests for the conservative rewrite safety gate."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=(ROOT/"Tools/audit_rewrites.py").read_text(encoding="utf-8")

class RewriteAuditTests(unittest.TestCase):
    def run_audit(self,lines):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            (root/"Tools").mkdir()
            (root/"Rewrites").mkdir()
            (root/"Tools/audit_rewrites.py").write_text(SOURCE,encoding="utf-8")
            (root/"Rewrites/QX-All-Rewrites.conf").write_text(lines,encoding="utf-8")
            return subprocess.run([sys.executable,str(root/"Tools/audit_rewrites.py")],
                                  capture_output=True,text=True,timeout=10)
    def test_empty_and_comments_are_safe(self):
        r=self.run_audit("# comment\n; disabled\n\n")
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        self.assertIn("safe_empty_staging_only",r.stdout)
    def test_active_rewrite_is_blocked(self):
        r=self.run_audit("https://example.com url reject-200\n")
        self.assertNotEqual(r.returncode,0)
        self.assertIn("BLOCKED",r.stdout)
    def test_sensitive_target_is_redacted(self):
        r=self.run_audit("https://login.example.com url reject-200\n")
        self.assertNotEqual(r.returncode,0)
        self.assertNotIn("login.example.com",r.stdout)
    def test_whitespace_and_case(self):
        r=self.run_audit("  # safe\n  ; safe\n  HTTPS://example.com url reject-200\n")
        self.assertNotEqual(r.returncode,0)

if __name__=="__main__":
    unittest.main()
