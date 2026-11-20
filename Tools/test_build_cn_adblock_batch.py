"""Regression tests for the review-only bulk adblock builder."""
import sys
import unittest
import io
import urllib.error
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_cn_adblock_batch import parse, is_protected, fetch

class BulkBuilderTests(unittest.TestCase):
    def test_rejects_non_ad_policies(self):
        rules, stats = parse(b"DOMAIN,good.example,DIRECT\nDOMAIN,proxy.example,PROXY\nDOMAIN,ads.example,REJECT\n")
        self.assertEqual(rules, {("host", "ads.example")})
        self.assertEqual(stats["non_reject"], 2)

    def test_upstream_advertisinglite_label(self):
        rules, stats = parse(b"HOST,ads.example,AdvertisingLite\nHOST,proxy.example,DIRECT\n")
        self.assertEqual(rules, {("host", "ads.example")})
        self.assertEqual(stats["non_reject"], 1)

    def test_protected_services_and_parent_suffix(self):
        rules, stats = parse(b"DOMAIN-SUFFIX,apple.com,REJECT\nDOMAIN,login.alipay.com,REJECT\nDOMAIN-SUFFIX,com,REJECT\nDOMAIN,ad.example,REJECT\n")
        self.assertEqual(rules, {("host", "ad.example")})
        self.assertGreaterEqual(stats["protected"], 2)

    def test_deduplication(self):
        rules, stats = parse(b"DOMAIN,ads.example,REJECT\nHOST,ads.example,reject\n")
        self.assertEqual(len(rules), 1)
        self.assertEqual(stats["duplicates"], 1)

    def test_transient_503_retries_and_recovers(self):
        class Response:
            headers = {"Content-Length": "3"}
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self, n): return b"abc"
        with patch("build_cn_adblock_batch.urllib.request.urlopen",
                   side_effect=[urllib.error.HTTPError("url", 503, "busy", {}, None), Response()]) as opener:
            delays = []
            self.assertEqual(fetch("https://example.test/list", 100, sleep=delays.append), b"abc")
            self.assertEqual(opener.call_count, 2)
            self.assertEqual(delays, [3])

    def test_non_transient_404_fails_without_retry(self):
        with patch("build_cn_adblock_batch.urllib.request.urlopen",
                   side_effect=urllib.error.HTTPError("url", 404, "missing", {}, None)) as opener:
            with self.assertRaises(urllib.error.HTTPError):
                fetch("https://example.test/list", 100, sleep=lambda _: None)
            self.assertEqual(opener.call_count, 1)

    def test_protected_parent(self):
        self.assertTrue(is_protected("com"))
        self.assertTrue(is_protected("apple.com"))
        self.assertFalse(is_protected("ad.example"))

if __name__ == "__main__":
    unittest.main()
