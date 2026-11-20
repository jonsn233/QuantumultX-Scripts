"""Regression tests for review-only A/B/C candidate risk tiers."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from classify_cn_adblock_batch import classify, overlaps

class TierTests(unittest.TestCase):
    def test_exact_domain_and_suffix_overlap(self):
        self.assertTrue(overlaps("host", "ad.example.com", "host-suffix", "example.com"))
        self.assertTrue(overlaps("host-suffix", "example.com", "host", "ad.example.com"))
        self.assertFalse(overlaps("host", "notexample.com", "host-suffix", "example.com"))
        self.assertFalse(overlaps("host", "ad.example.com", "host", "other.example.com"))

    def test_production_priority_over_ad_label(self):
        rules = [("host", "ad.example.com", "reject")]
        tiers, reasons = classify(rules, [("host-suffix", "example.com", "direct")], [])
        self.assertEqual(len(tiers["C"]), 1)
        self.assertEqual(reasons["production_overlap"], 1)

    def test_pilot_priority_over_ad_label(self):
        rules = [("host", "ad.example.com", "reject")]
        tiers, reasons = classify(rules, [], [("host", "ad.example.com", "reject")])
        self.assertEqual(len(tiers["C"]), 1)
        self.assertEqual(reasons["pilot_overlap"], 1)

    def test_sensitive_first_party_and_short_domains_not_fast_tracked(self):
        domains = ["adclick.tencentmusic.com", "ad.wx.com",
                   "ad.mcloud.139.com", "ads-img-qc.xhscdn.com",
                   "ad.gt", "ad.style", "ads.data.pplive.com",
                   "adx.op.cp18.ott.cibntv.net"]
        rules = [("host", d, "reject") for d in domains]
        tiers, reasons = classify(rules, [], [])
        self.assertEqual(len(tiers["A"]), 0)
        self.assertEqual(len(tiers["B"]), len(domains))
        self.assertEqual(reasons["sensitive_or_ambiguous"], len(domains))

    def test_suffix_and_ambiguous_host_stay_b(self):
        rules = [("host-suffix", "ads.example.com", "reject"),
                 ("host", "cdn.example.com", "reject"),
                 ("host", "ad.example.net", "reject")]
        tiers, reasons = classify(rules, [], [])
        self.assertEqual(len(tiers["A"]), 1)
        self.assertEqual(len(tiers["B"]), 2)
        self.assertEqual(len(tiers["C"]), 0)

if __name__ == "__main__":
    unittest.main()
