"""Offline tests for final V2.8 pilot artifact validator."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_v28_optin_pilot import validate

class ValidatePilotTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.report = {"status": "device_test_only", "published": False,
                       "subscribed": False, "approved_for_production": False, "rules": 1}
        self.lines = ["# independent pilot", "host,ads.example.org,reject"]
        self.write()
    def write(self):
        (self.base / "QX-V2.8-OptIn-50-Report.json").write_text(json.dumps(self.report))
        (self.base / "QX-V2.8-OptIn-50-DEVICE-TEST-ONLY.list").write_text("\n".join(self.lines) + "\n")
    def test_valid_exact_host(self):
        self.assertEqual(validate(self.base)["rule_count"], 1)
    def test_reject_protected_domain(self):
        self.lines[-1] = "host,ad.zijieapi.com,reject"
        self.write()
        with self.assertRaises(ValueError):
            validate(self.base)
    def test_reject_suffix(self):
        self.lines[-1] = "host-suffix,ads.example.org,reject"
        self.write()
        with self.assertRaises(ValueError):
            validate(self.base)
    def test_reject_duplicate(self):
        self.lines.append(self.lines[-1])
        self.report["rules"] = 2
        self.write()
        with self.assertRaises(ValueError):
            validate(self.base)
    def test_reject_published(self):
        self.report["published"] = True
        self.write()
        with self.assertRaises(ValueError):
            validate(self.base)
    def test_reject_empty(self):
        self.lines = ["# empty"]
        self.report["rules"] = 0
        self.write()
        with self.assertRaises(ValueError):
            validate(self.base)

if __name__ == "__main__":
    unittest.main()
