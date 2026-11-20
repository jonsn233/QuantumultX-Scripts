#!/usr/bin/env python3
"""Regression tests for staged-only QX adblock validator."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
AUDITOR=(ROOT/"Tools/audit_adblock_candidate.py").read_text(encoding="utf-8")

class AdblockAuditTests(unittest.TestCase):
    def check(self,body):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/"Tools").mkdir()
            (root/"Rules/Adblock").mkdir(parents=True)
            script=root/"Tools/audit_adblock_candidate.py"
            script.write_text(AUDITOR,encoding="utf-8")
            (root/"Rules/Adblock/QX-Adblock-Candidate.list").write_text(body,encoding="utf-8")
            return subprocess.run([sys.executable,str(script)],capture_output=True,text=True,timeout=10)
    def test_empty_staging(self):
        r=self.check("# comment\n; disabled\n")
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        self.assertIn("staging_only_not_device_tested",r.stdout)
    def test_safe_explicit_domain(self):
        r=self.check("host,ads.example.net,reject\nhost-suffix,metrics.example.net,reject\n")
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
    def test_protected_ai_and_payment(self):
        for domain in ("chatgpt.com","api.openai.com","login.paypal.com","idmsa.apple.com","accounts.google.com"):
            with self.subTest(domain=domain):
                self.assertNotEqual(self.check(f"host-suffix,{domain},reject\n").returncode,0)
    def test_reject_bad_types(self):
        for line in ("host-keyword,ads,reject","ip-cidr,1.2.3.0/24,reject","host,ads.example.net,DIRECT","host,*.example.net,reject"):
            with self.subTest(line=line):
                self.assertNotEqual(self.check(line+"\n").returncode,0)
    def test_duplicates(self):
        self.assertNotEqual(self.check("host,ads.example.net,reject\nhost,ADS.EXAMPLE.NET,reject\n").returncode,0)
    def test_extra_fields(self):
        self.assertNotEqual(self.check("host,ads.example.net,reject,extra\n").returncode,0)
    def test_count_cap(self):
        rules="".join(f"host,ads{i}.example.net,reject\n" for i in range(201))
        self.assertNotEqual(self.check(rules).returncode,0)

if __name__=="__main__":
    unittest.main()
