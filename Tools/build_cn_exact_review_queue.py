#!/usr/bin/env python3
"""Join complete A-tier and exact-source evidence; no approvals or subscriptions."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "Rules/Adblock/Generated"

def build(base=BASE):
    report = json.loads((base / "QX-CN-Corroboration-Report.json").read_text(encoding="utf-8"))
    tier = json.loads((base / "QX-CN-Tier-Report.json").read_text(encoding="utf-8"))
    if report["source_completeness"] != "complete" or report["source_count"] < 2:
        raise ValueError("Refuse shortlist when corroboration sources are incomplete")
    a = {}
    for line in (base / "QX-CN-Tier-A-REVIEW-ONLY.list").read_text(encoding="utf-8").splitlines():
        if line and not line.startswith("#"):
            kind, domain, policy = line.split(",")
            if kind != "host" or policy != "reject" or domain in a:
                raise ValueError("Unexpected A-tier data")
            a[domain] = kind
    if len(a) != tier["tiers"]["A"]:
        raise ValueError("A-tier count mismatch")
    matched = {}
    with (base / "QX-CN-All-Candidates-Corroboration-REVIEW-ONLY.csv").open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if row["kind"] == "host" and row["domain"] in a:
                if row["domain"] in matched:
                    raise ValueError("Duplicate A-tier evidence row")
                matched[row["domain"]] = row
    if len(matched) != len(a):
        raise ValueError("Evidence matrix missing A-tier entries")
    output = base / "QX-CN-A-Exact-MultiSource-QUEUE-REVIEW-ONLY.csv"
    chosen = []
    with output.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["domain", "exact_source_count", "exact_sources", "review_status", "device_test"])
        for domain in sorted(a):
            row = matched[domain]
            count = int(row["exact_source_count"])
            sources = [s for s in row["exact_sources"].split(";") if s]
            if count != len(sources) or count > report["source_count"] or len(sources) != len(set(sources)):
                raise ValueError("Inconsistent exact-source evidence")
            if count >= 2:
                chosen.append(domain)
                w.writerow([domain, count, row["exact_sources"], "PENDING_REVIEW", "NOT_TESTED"])
    summary = {"status": "review_only", "published": False, "approved": 0,
               "a_tier_count": len(a), "exact_multi_source_queue": len(chosen),
               "warning": "Exact multi-source inclusion is not safety validation or approval."}
    (base / "QX-CN-A-Exact-MultiSource-QUEUE-Report.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return summary

if __name__ == "__main__":
    print(json.dumps(build()))
