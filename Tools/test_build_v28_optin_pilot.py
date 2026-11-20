"""Offline regression tests for V2.8 opt-in rule source."""
import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_v28_optin_pilot import build

class OptInTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        (self.base / "QX-V2.8-Broad-Evidence-Report.json").write_text(
            json.dumps({"status": "review_only", "published": False, "approved": 0, "candidate_total": 2}))
        self.rows = [
            ["host", "ads.example.org", "two_exact_review", "2", "PENDING_REVIEW", "NOT_TESTED"],
            ["host", "ad.zijieapi.com", "protected_hold", "2", "PENDING_REVIEW", "NOT_TESTED"],
        ]
        self.write_rows()
    def write_rows(self):
        with (self.base / "QX-V2.8-Broad-Evidence-REVIEW-ONLY.csv").open("w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["kind", "domain", "decision", "exact_source_count", "review_status", "device_test"])
            w.writerows(self.rows)
    def test_isolated_rules_and_rollback(self):
        result = build(self.base)
        self.assertEqual(result["rules"], 1)
        self.assertFalse(result["subscribed"])
        text = (self.base / "QX-V2.8-OptIn-50-DEVICE-TEST-ONLY.list").read_text()
        self.assertIn("host,ads.example.org,reject", text)
        self.assertNotIn("zijieapi.com", text)
        self.assertIn("Disable/remove", result["rollback"])
    def test_protected_misclassification_fails(self):
        self.rows[1][2] = "two_exact_review"
        self.write_rows()
        with self.assertRaises(ValueError):
            build(self.base)
    def test_insufficient_evidence_fails(self):
        self.rows[0][3] = "1"
        self.write_rows()
        with self.assertRaises(ValueError):
            build(self.base)
    def test_duplicate_fails(self):
        self.rows[1] = self.rows[0][:]
        self.write_rows()
        with self.assertRaises(ValueError):
            build(self.base)

if __name__ == "__main__":
    unittest.main()
