#!/usr/bin/env python3
"""Risk-tier bulk adblock candidates. Review artifacts only, never live subscriptions."""
import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "Rules/Adblock/Generated"
SOURCE = BASE / "QX-CN-Adblock-Bulk-REVIEW-ONLY.list"
PRODUCTION = ROOT / "Rules/Releases/QX-V2.5-359-Rules.list"
PILOT = ROOT / "Rules/Adblock/QX-V2.6-CN-Adblock-Test.list"
# A tier is still untested. Require exact host and a distinct ad-serving label.
AD_LABEL = re.compile(r"^(?:ads?|adserver|adservice|adtrack|adclick|adpush|adimg|adfile|admob|doubleclick|pagead|goad|adx)(?:[-0-9]|$)", re.I)

def read_rules(path):
    result = []
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith(("#", ";")):
            continue
        fields = [x.strip().lower() for x in line.split(",")]
        if len(fields) >= 3 and fields[0] in ("host", "host-suffix"):
            result.append((fields[0], fields[1], fields[2]))
    return result

def overlaps(a_kind, a_domain, b_kind, b_domain):
    if a_domain == b_domain:
        return True
    if a_kind == "host-suffix" and b_domain.endswith("." + a_domain):
        return True
    if b_kind == "host-suffix" and a_domain.endswith("." + b_domain):
        return True
    return False

# Ambiguous first-party and infrastructure domains must never be fast-tracked
# solely because the first hostname label looks advertising-related.
SENSITIVE_SUFFIXES = (
    "tencentmusic.com", "wx.com", "139.com", "xhscdn.com",
    "pplive.com", "cibntv.net",
)
SHORT_SECOND_LEVEL = re.compile(r"^[a-z0-9-]{1,3}\.[a-z]{2,}$", re.I)

def needs_manual_escalation(domain):
    if any(domain == root or domain.endswith("." + root) for root in SENSITIVE_SUFFIXES):
        return True
    if SHORT_SECOND_LEVEL.fullmatch(domain):
        return True
    return False

def classify(candidates, production, pilot):
    tiers = {"A": [], "B": [], "C": []}
    reasons = {"production_overlap": 0, "pilot_overlap": 0, "suffix_requires_review": 0,
               "no_strong_ad_label": 0, "sensitive_or_ambiguous": 0}
    for kind, domain, policy in candidates:
        if any(overlaps(kind, domain, pk, pd) for pk, pd, _ in production):
            tiers["C"].append((kind, domain, policy))
            reasons["production_overlap"] += 1
        elif any(overlaps(kind, domain, pk, pd) for pk, pd, _ in pilot):
            tiers["C"].append((kind, domain, policy))
            reasons["pilot_overlap"] += 1
        elif needs_manual_escalation(domain):
            tiers["B"].append((kind, domain, policy))
            reasons["sensitive_or_ambiguous"] += 1
        elif kind != "host":
            tiers["B"].append((kind, domain, policy))
            reasons["suffix_requires_review"] += 1
        elif not AD_LABEL.match(domain.split(".")[0]):
            tiers["B"].append((kind, domain, policy))
            reasons["no_strong_ad_label"] += 1
        else:
            tiers["A"].append((kind, domain, policy))
    return tiers, reasons

def main():
    if not SOURCE.exists():
        raise SystemExit("Missing bulk review artifact: run builder first")
    candidates = read_rules(SOURCE)
    production = read_rules(PRODUCTION)
    pilot = read_rules(PILOT)
    if not candidates or len(candidates) < 1000 or len(production) < 100 or len(pilot) < 9:
        raise SystemExit("Unexpectedly small input/baseline: refuse classification")
    tiers, reasons = classify(candidates, production, pilot)
    if sum(map(len, tiers.values())) != len(candidates):
        raise SystemExit("Classification count mismatch")
    # Limit the first manual review to a deterministic, bounded subset.
    # This is NOT a phone subscription and is NOT an approval.
    # Stable hash ordering samples across the whole A tier instead of
    # over-representing alphabetically early domains.
    shortlist = sorted(tiers["A"], key=lambda x: (
        hashlib.sha256((x[0] + "," + x[1]).encode("utf-8")).hexdigest(), x[1]
    ))[:100]
    (BASE / "QX-CN-Tier-A-First100-REVIEW-ONLY.list").write_text(
        "# FIRST 100 FOR MANUAL REVIEW ONLY - NOT APPROVED OR DEVICE TESTED\n"
        + "".join(f"{k},{d},{p}\n" for k, d, p in shortlist),
        encoding="utf-8")
    for tier, rules in tiers.items():
        (BASE / f"QX-CN-Tier-{tier}-REVIEW-ONLY.list").write_text(
            "# NOT APPROVED, NOT DEVICE TESTED, DO NOT SUBSCRIBE\n"
            + "".join(f"{k},{d},{p}\n" for k,d,p in sorted(rules)),
            encoding="utf-8")
    # Complete review worksheet: no domain receives approval automatically.
    # This CSV is deliberately non-subscribable and includes all A-tier hosts.
    ledger = BASE / "QX-CN-Tier-A-Manual-Audit.csv"
    with ledger.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["rule_type", "domain", "policy", "review_status",
                         "evidence_url", "app_impact_test", "reviewer_notes"])
        for kind, domain, policy in sorted(tiers["A"], key=lambda item: item[1]):
            writer.writerow([kind, domain, policy, "PENDING", "", "NOT_TESTED", ""])
    if sum(1 for _ in ledger.open(encoding="utf-8")) != len(tiers["A"]) + 1:
        raise SystemExit("Manual audit worksheet count mismatch")
    report = {"status": "review_only", "published": False,
              "candidate_total": len(candidates),
              "tiers": {key: len(value) for key, value in tiers.items()},
              "tier_A_first_review_count": len(shortlist),
              "tier_A_manual_audit_pending": len(tiers["A"]),
              "approved_rules": 0,
              "first_review_selection": "sha256-ranked deterministic sample across A tier",
              "reasons": reasons,
              "tier_A_warning": "Lexical ad label is not proof of safe blocking.",
              "tier_C_warning": "Overlaps existing V2.5 routing or V2.6 pilot; not approved."}
    (BASE / "QX-CN-Tier-Report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))

if __name__ == "__main__":
    main()
