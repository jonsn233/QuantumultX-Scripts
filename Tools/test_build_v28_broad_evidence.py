"""Offline regression tests for V2.8 full-batch evidence review."""
import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_v28_broad_evidence import build, protected

class V28Tests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        (self.base / "QX-CN-Corroboration-Report.json").write_text(json.dumps({
            "source_completeness": "complete", "source_count": 2, "candidate_total": 4}))
        self.rules = {
            "A": ["host,ads.example.org,reject"],
            "B": ["host,ad.zijieapi.com,reject", "host-suffix,ads.other.org,reject"],
            "C": ["host,ads.old.org,reject"],
        }
        for tier, rules in self.rules.items():
            (self.base / ("QX-CN-Tier-" + tier + "-REVIEW-ONLY.list")).write_text("\n".join(rules) + "\n")
        self.rows = [
            ["host", "ads.example.org", "2", "a;b"],
            ["host", "ad.zijieapi.com", "2", "a;b"],
            ["host-suffix", "ads.other.org", "1", "a"],
            ["host", "ads.old.org", "2", "a;b"],
        ]
        self.write_rows()

    def write_rows(self):
        with (self.base / "QX-CN-All-Candidates-Corroboration-REVIEW-ONLY.csv").open("w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["kind", "domain", "exact_source_count", "exact_sources"])
            w.writerows(self.rows)

    def test_all_candidates_are_review_only(self):
        result = build(self.base)
        self.assertEqual(result["candidate_total"], 4)
        self.assertEqual(result["buckets"]["two_exact_review"], 1)
        self.assertEqual(result["buckets"]["one_exact_review"], 1)
        self.assertEqual(result["buckets"]["protected_hold"], 1)
        self.assertEqual(result["buckets"]["baseline_overlap_hold"], 1)
        self.assertFalse(result["published"])
        self.assertEqual(result["approved"], 0)

    def test_protection_matches_subdomains_not_similar_names(self):
        self.assertTrue(protected("ad.zijieapi.com"))
        self.assertFalse(protected("fakezijieapi.com"))
        self.assertTrue(protected("api.openai.com"))

    def test_partial_source_fails_closed(self):
        p = self.base / "QX-CN-Corroboration-Report.json"
        p.write_text(json.dumps({"source_completeness": "partial", "source_count": 1, "candidate_total": 4}))
        with self.assertRaises(ValueError):
            build(self.base)

    def test_missing_tier_fails_closed(self):
        (self.base / "QX-CN-Tier-A-REVIEW-ONLY.list").write_text("")
        with self.assertRaises(ValueError):
            build(self.base)

if __name__ == "__main__":
    unittest.main()
