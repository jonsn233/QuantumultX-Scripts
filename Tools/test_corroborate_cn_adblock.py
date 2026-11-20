"""Offline regression checks for full-batch review-only corroboration."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from corroborate_cn_adblock import normalize, covered, match_type

class CorroborationTests(unittest.TestCase):
    def test_oisd_domain_only(self):
        self.assertEqual(normalize("ads.example.com"), "ads.example.com")

    def test_adguard_adblock_syntax(self):
        self.assertEqual(normalize("||ads.example.com^"), "ads.example.com")
        self.assertIsNone(normalize("@@||login.example.com^"))
        self.assertIsNone(normalize("||ads.example.com^$third-party"))

    def test_hosts_syntax(self):
        self.assertEqual(normalize("0.0.0.0 ads.example.com"), "ads.example.com")

    def test_invalid_lines(self):
        for line in ("# comment", "example.com/path", "*.example.com", "example..com", "localhost"):
            self.assertIsNone(normalize(line))

    def test_parent_suffix_coverage(self):
        self.assertTrue(covered("ads.example.com", {"example.com"}))
        self.assertFalse(covered("notexample.com", {"example.com"}))
        self.assertEqual(match_type("ads.example.com", {"ads.example.com"}), "exact")
        self.assertEqual(match_type("ads.example.com", {"example.com"}), "parent")
        self.assertEqual(match_type("ads.example.com", {"other.example.com"}), "none")

if __name__ == "__main__":
    unittest.main()
