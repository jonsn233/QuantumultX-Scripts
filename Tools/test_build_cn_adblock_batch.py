"""Regression tests for the review-only bulk adblock builder."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_cn_adblock_batch import parse, is_protected

class BulkBuilderTests(unittest.TestCase):
    def test_rejects_non_ad_policies(self):
        rules, stats = parse(b"DOMAIN,good.example,DIRECT\nDOMAIN,proxy.example,PROXY\nDOMAIN,ads.example,REJECT\n")
        self.assertEqual(rules, {("host", "ads.example")})
        self.assertEqual(stats["non_reject"], 2)

    def test_protected_services_and_parent_suffix(self):
        rules, stats = parse(b"DOMAIN-SUFFIX,apple.com,REJECT\nDOMAIN,login.alipay.com,REJECT\nDOMAIN-SUFFIX,com,REJECT\nDOMAIN,ad.example,REJECT\n")
        self.assertEqual(rules, {("host", "ad.example")})
        self.assertGreaterEqual(stats["protected"], 2)

    def test_deduplication(self):
        rules, stats = parse(b"DOMAIN,ads.example,REJECT\nHOST,ads.example,reject\n")
        self.assertEqual(len(rules), 1)
        self.assertEqual(stats["duplicates"], 1)

    def test_protected_parent(self):
        self.assertTrue(is_protected("com"))
        self.assertTrue(is_protected("apple.com"))
        self.assertFalse(is_protected("ad.example"))

if __name__ == "__main__":
    unittest.main()
