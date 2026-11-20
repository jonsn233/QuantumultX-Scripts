"""Regression tests for the non-deployable V2.8 device pilot proposal."""
import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_v28_device_pilot_proposal import build

class PilotProposalTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        (self.base / "QX-V2.8-Broad-Evidence-Report.json").write_text(
            json.dumps({"status": "review_only", "published": False, "approved": 0}))
        with (self.base / "QX-V2.8-Broad-Evidence-REVIEW-ONLY.csv").open("w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["kind", "domain", "decision", "review_status", "device_test"])
            w.writerows([
                ["host", "ads.example.org", "two_exact_review", "PENDING_REVIEW", "NOT_TESTED"],
                ["host", "ad.zijieapi.com", "protected_hold", "PENDING_REVIEW", "NOT_TESTED"],
                ["host-suffix", "ads.other.org", "two_exact_review", "PENDING_REVIEW", "NOT_TESTED"],
                ["host", "ads.old.org", "baseline_overlap_hold", "PENDING_REVIEW", "NOT_TESTED"],
            ])
    def test_preview_is_commented_and_excludes_holds(self):
        result = build(self.base)
        self.assertEqual(result["selected"], 1)
        self.assertEqual(result["active_rules"], 0)
        text = (self.base / "QX-V2.8-Device-Pilot-PROPOSAL-NOT-ACTIVE.txt").read_text()
        self.assertIn("# host,ads.example.org,reject", text)
        self.assertNotIn("zijieapi.com", text)
        self.assertTrue(all(not line.strip() or line.startswith("#") for line in text.splitlines()))
    def test_invalid_limit_fails(self):
        with self.assertRaises(ValueError):
            build(self.base, 201)
    def test_unexpected_approval_fails(self):
        (self.base / "QX-V2.8-Broad-Evidence-Report.json").write_text(
            json.dumps({"status": "review_only", "published": True, "approved": 0}))
        with self.assertRaises(ValueError):
            build(self.base)

if __name__ == "__main__":
    unittest.main()
