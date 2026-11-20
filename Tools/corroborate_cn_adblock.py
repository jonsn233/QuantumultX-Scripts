#!/usr/bin/env python3
"""Independent-source corroboration, review-only. No publication or approvals."""
import hashlib
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Rules/Adblock/Generated"
CANDIDATES = OUT / "QX-CN-Adblock-Bulk-REVIEW-ONLY.list"
# Sources are independent of the AdvertisingLite input, but may share upstream data.
SOURCES = {
    "oisd-small": "https://small.oisd.nl/",
    "adguard-dns": "https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt",
}
MAX_BYTES = 15_000_000

def normalize(line):
    s = line.strip().lower()
    if not s or s.startswith(("!", "#", "[", ";", "//")):
        return None
    if s.startswith("||"):
        # Reject modifiers/options before stripping the ABP rule terminator.
        # A rule with $third-party, $important, etc. is not a plain domain block.
        if "$" in s or not s.endswith("^") or s.count("^") != 1:
            return None
        s = s[2:-1]
    elif s.startswith("0.0.0.0 ") or s.startswith("127.0.0.1 "):
        fields = s.split()
        s = fields[1] if len(fields) == 2 else ""
    elif s.startswith("@@") or any(ch in s for ch in ("/", "*", "$", "|", "^", " ", "\\t")):
        return None
    # OISD domain-only feeds contain bare hostnames (one per line).
    if not s or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789.-" for c in s):
        return None
    if ("." not in s or s.startswith(".") or s.endswith(".") or ".." in s
            or any(not label or label.startswith("-") or label.endswith("-") or len(label) > 63 for label in s.split("."))):
        return None
    return s

def read_candidates(path):
    rules = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        parts = [x.strip().lower() for x in line.split(",")]
        if len(parts) == 3 and parts[0] in ("host", "host-suffix") and parts[2] == "reject":
            rules.append((parts[0], parts[1]))
    return rules

def match_type(domain, source_domains):
    """Keep exact domain matches separate from weaker parent-domain coverage."""
    if domain in source_domains:
        return "exact"
    labels = domain.split(".")
    if any(".".join(labels[i:]) in source_domains for i in range(1, len(labels)-1)):
        return "parent"
    return "none"

def covered(domain, source_domains):
    return match_type(domain, source_domains) != "none"

def main():
    if not CANDIDATES.exists():
        raise SystemExit("Missing bulk candidates")
    candidates = read_candidates(CANDIDATES)
    if len(candidates) < 1000:
        raise SystemExit("Candidate input unexpectedly small")
    source_data = {}
    source_hashes = {}
    errors = {}
    for name, url in SOURCES.items():
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "QX-Review/1.0"})
            with urllib.request.urlopen(req, timeout=35) as response:
                raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise ValueError("source exceeds size cap")
            domains = {d for line in raw.decode("utf-8-sig").splitlines() if (d := normalize(line))}
            if len(domains) < 1000:
                raise ValueError("source unexpectedly small")
            source_data[name] = domains
            source_hashes[name] = hashlib.sha256(raw).hexdigest()
        except Exception as exc:
            errors[name] = str(exc)[:200]
    # No sources: fail closed rather than producing false zero-evidence labels.
    if not source_data:
        raise SystemExit("All independent sources unavailable: " + json.dumps(errors))
    import csv
    dest = OUT / "QX-CN-All-Candidates-Corroboration-REVIEW-ONLY.csv"
    buckets = {"zero": 0, "one": 0, "multiple": 0}
    exact_buckets = {"zero": 0, "one": 0, "multiple": 0}
    with dest.open("w", encoding="utf-8", newline="") as fp:
        w = csv.writer(fp)
        w.writerow(["kind", "domain", "matched_source_count", "matched_sources",
                    "exact_source_count", "exact_sources", "parent_coverage_sources",
                    "review_status", "device_test"])
        for kind, domain in sorted(candidates):
            matches = {name: match_type(domain, domains) for name, domains in source_data.items()}
            hits = [name for name, typ in matches.items() if typ != "none"]
            exact = [name for name, typ in matches.items() if typ == "exact"]
            parent = [name for name, typ in matches.items() if typ == "parent"]
            buckets["zero" if not hits else "one" if len(hits) == 1 else "multiple"] += 1
            exact_buckets["zero" if not exact else "one" if len(exact) == 1 else "multiple"] += 1
            w.writerow([kind, domain, len(hits), ";".join(hits), len(exact),
                        ";".join(exact), ";".join(parent), "UNAPPROVED", "NOT_TESTED"])
    report = {
        "status": "review_only", "approved": 0, "published": False,
        "candidate_total": len(candidates), "source_count": len(source_data),
        "source_sizes": {k: len(v) for k, v in source_data.items()},
        "source_sha256": source_hashes,
        "source_urls": {name: SOURCES[name] for name in source_data},
        "source_completeness": "complete" if len(source_data) == len(SOURCES) else "partial",
        "source_errors": errors, "match_buckets": buckets,
        "exact_match_buckets": exact_buckets,
        "limitations": "Source outages make match counts incomparable across runs. Shared upstream provenance is possible. Matches are not independent proof of safe blocking; suffix matching may overstate evidence. No device tests."
    }
    (OUT / "QX-CN-Corroboration-Report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))

if __name__ == "__main__":
    main()
