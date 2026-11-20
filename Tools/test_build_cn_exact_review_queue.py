"""Offline tests for complete-source A-tier review queue."""
import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_cn_exact_review_queue import build

class ExactQueueTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        (self.base / "QX-CN-Corroboration-Report.json").write_text(
            json.dumps({"source_completeness": "complete", "source_count": 2}))
        (self.base / "QX-CN-Tier-Report.json").write_text(
            json.dumps({"tiers": {"A": 2}}))
        (self.base / "QX-CN-Tier-A-REVIEW-ONLY.list").write_text(
            "host,ads.example.com,reject\nhost,ad.other.net,reject\n")
        self.rows = [
            ["host", "ads.example.com", "2", "a;b", "2", "a;b", "", "UNAPPROVED", "NOT_TESTED"],
            ["host", "ad.other.net", "1", "a", "1", "a", "", "UNAPPROVED", "NOT_TESTED"]
        ]
        self.write_matrix()

    def write_matrix(self):
        with (self.base / "QX-CN-All-Candidates-Corroboration-REVIEW-ONLY.csv").open("w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["kind", "domain", "matched_source_count", "matched_sources",
                        "exact_source_count", "exact_sources", "parent_coverage_sources",
                        "review_status", "device_test"])
            w.writerows(self.rows)

    def test_only_two_exact_matches_enter_queue(self):
        result = build(self.base)
        self.assertEqual(result["exact_multi_source_queue"], 1)
        self.assertEqual(result["approved"], 0)
        lines = (self.base / "QX-CN-A-Exact-MultiSource-QUEUE-REVIEW-ONLY.csv").read_text().splitlines()
        self.assertEqual(len(lines), 2)
        self.assertIn("ads.example.com", lines[1])

    def test_sensitive_service_gets_extra_scrutiny(self):
        self.rows[0][1] = "ad.zijieapi.com"
        (self.base / "QX-CN-Tier-A-REVIEW-ONLY.list").write_text(
            "host,ad.zijieapi.com,reject\\nhost,ad.other.net,reject\\n")
        self.write_matrix()
        result = build(self.base)
        self.assertEqual(result["extra_scrutiny_count"], 1)
        self.assertEqual(result["standard_review_count"], 0)
        output = (self.base / "QX-CN-A-Exact-MultiSource-QUEUE-REVIEW-ONLY.csv").read_text()
        self.assertIn("EXTRA_SCRUTINY", output)

    def test_partial_sources_fail_closed(self):
        (self.base / "QX-CN-Corroboration-Report.json").write_text(
            json.dumps({"source_completeness": "partial", "source_count": 1}))
        with self.assertRaises(ValueError):
            build(self.base)

    def test_duplicate_evidence_fails_closed(self):
        self.rows.append(self.rows[0])
        self.write_matrix()
        with self.assertRaises(ValueError):
            build(self.base)

    def test_inconsistent_exact_count_fails_closed(self):
        self.rows[0][4] = "2"
        self.rows[0][5] = "a"
        self.write_matrix()
        with self.assertRaises(ValueError):
            build(self.base)

if __name__ == "__main__":
    unittest.main()
