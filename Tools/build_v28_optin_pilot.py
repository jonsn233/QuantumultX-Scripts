#!/usr/bin/env python3
"""Generate a separate opt-in QX pilot file; never install or modify production."""
import csv
import json
import re
from pathlib import Path
from build_v28_broad_evidence import protected

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "Rules/Adblock/Generated"
MAX_PILOT = 50
DOMAIN = re.compile(r"^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$")

def build(base=BASE, limit=MAX_PILOT):
    if not 1 <= limit <= MAX_PILOT:
        raise ValueError("Pilot must be between 1 and 50")
    report = json.loads((base / "QX-V2.8-Broad-Evidence-Report.json").read_text(encoding="utf-8"))
    if report.get("status") != "review_only" or report.get("published") or report.get("approved") != 0:
        raise ValueError("Review-only evidence required")
    total, eligible, seen = 0, [], set()
    with (base / "QX-V2.8-Broad-Evidence-REVIEW-ONLY.csv").open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            total += 1
            domain, kind = row["domain"], row["kind"]
            key = (kind, domain)
            if key in seen:
                raise ValueError("Duplicate evidence record")
            seen.add(key)
            if row["decision"] != "two_exact_review" or kind != "host":
                continue
            if protected(domain):
                raise ValueError("Protected domain misclassified: " + domain)
            if not DOMAIN.fullmatch(domain) or "." not in domain or ".." in domain:
                raise ValueError("Invalid domain")
            if row["review_status"] != "PENDING_REVIEW" or row["device_test"] != "NOT_TESTED":
                raise ValueError("Unexpected review state")
            if int(row["exact_source_count"]) < 2:
                raise ValueError("Insufficient evidence")
            eligible.append(domain)
    if total != report["candidate_total"]:
        raise ValueError("Evidence inventory count mismatch")
    chosen = sorted(eligible)[:limit]
    # This file contains live QX syntax but is NOT linked, published, or subscribed.
    dest = base / "QX-V2.8-OptIn-50-DEVICE-TEST-ONLY.list"
    dest.write_text(
        "# EXPERIMENTAL - MANUAL OPT-IN ONLY - NOT PRODUCTION\n"
        "# May break services. Disable this independent rule source to roll back.\n"
        "# Exact-host only; no broad host-suffix blocking.\n"
        + "".join("host," + domain + ",reject\n" for domain in chosen),
        encoding="utf-8")
    result = {"status": "device_test_only", "published": False, "subscribed": False,
              "approved_for_production": False, "rules": len(chosen),
              "eligible_exact_hosts": len(eligible), "limit": limit,
              "rollback": "Disable/remove the separate opt-in rule source; production remains untouched."}
    (base / "QX-V2.8-OptIn-50-Report.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result

if __name__ == "__main__":
    print(json.dumps(build()))
