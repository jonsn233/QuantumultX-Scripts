#!/usr/bin/env python3
"""Produce a bounded V2.8 device-test *proposal*, never a subscribed ruleset."""
import csv
import json
from pathlib import Path
from build_v28_broad_evidence import protected

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "Rules/Adblock/Generated"
LIMIT = 200

def build(base=BASE, limit=LIMIT):
    if not 1 <= limit <= LIMIT:
        raise ValueError("Invalid preview limit")
    report = json.loads((base / "QX-V2.8-Broad-Evidence-Report.json").read_text(encoding="utf-8"))
    if report["status"] != "review_only" or report["published"] or report["approved"]:
        raise ValueError("Review-only input required")
    selected = []
    seen = set()
    total = 0
    with (base / "QX-V2.8-Broad-Evidence-REVIEW-ONLY.csv").open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            total += 1
            domain = row["domain"]
            key = (row["kind"], domain)
            if key in seen:
                raise ValueError("Duplicate evidence row")
            seen.add(key)
            if row["decision"] != "two_exact_review" or row["kind"] != "host":
                continue
            if protected(domain):
                raise ValueError("Protected domain was incorrectly marked eligible: " + domain)
            if row["review_status"] != "PENDING_REVIEW" or row["device_test"] != "NOT_TESTED":
                raise ValueError("Unexpected approval/test state")
            selected.append(domain)
    if total != report["candidate_total"]:
        raise ValueError("Broad inventory count mismatch")
    selected.sort()
    chosen = selected[:limit]
    # Intentionally not a .list: lines are commented, not executable rules.
    dest = base / "QX-V2.8-Device-Pilot-PROPOSAL-NOT-ACTIVE.txt"
    dest.write_text(
        "# V2.8 PROPOSAL ONLY - DO NOT SUBSCRIBE OR IMPORT\n"
        "# These domains have NOT been compatibility-audited or device-tested.\n"
        "# Every potential rule is commented out on purpose.\n"
        + "".join("# host," + d + ",reject\n" for d in chosen),
        encoding="utf-8")
    summary = {
        "status": "proposal_only", "published": False, "approved": 0,
        "selected": len(chosen), "eligible_exact_host_count": len(selected),
        "limit": limit, "active_rules": 0,
        "warning": "Not deployable. Requires compatibility review and explicit pilot approval."
    }
    (base / "QX-V2.8-Device-Pilot-PROPOSAL-Report.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary

if __name__ == "__main__":
    print(json.dumps(build()))
