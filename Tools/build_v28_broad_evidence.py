#!/usr/bin/env python3
"""V2.8 broad evidence inventory, never a live Quantumult X subscription."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "Rules/Adblock/Generated"
PROTECTED = (
    "apple.com", "icloud.com", "mzstatic.com", "itunes.apple.com",
    "openai.com", "chatgpt.com", "oaistatic.com", "anthropic.com",
    "claude.ai", "gemini.google.com", "googleapis.com",
    "alipay.com", "alipayobjects.com", "mybank.cn",
    "tenpay.com", "wechat.com", "weixin.qq.com", "wx.com",
    "unionpay.com", "95516.com", "paypal.com",
    "zijieapi.com", "linksynergy.com", "mox.tv",
    "pixiv.net", "nicovideo.jp",
)
def protected(domain):
    return any(domain == root or domain.endswith("." + root) for root in PROTECTED)

def build(base=BASE):
    evidence = json.loads((base / "QX-CN-Corroboration-Report.json").read_text(encoding="utf-8"))
    if evidence["source_completeness"] != "complete" or evidence["source_count"] < 2:
        raise ValueError("Two complete sources required")
    tier_map = {}
    for tier in "ABC":
        for line in (base / ("QX-CN-Tier-" + tier + "-REVIEW-ONLY.list")).read_text(encoding="utf-8").splitlines():
            if not line or line.startswith("#"):
                continue
            kind, domain, policy = line.split(",")
            if (kind, domain) in tier_map:
                raise ValueError("Duplicate tier entry")
            tier_map[(kind, domain)] = tier
    output = base / "QX-V2.8-Broad-Evidence-REVIEW-ONLY.csv"
    counts = {"protected_hold": 0, "baseline_overlap_hold": 0,
              "two_exact_review": 0, "one_exact_review": 0, "other_review": 0}
    total = 0
    with (base / "QX-CN-All-Candidates-Corroboration-REVIEW-ONLY.csv").open(encoding="utf-8", newline="") as src, output.open("w", encoding="utf-8", newline="") as dst:
        writer = csv.writer(dst)
        writer.writerow(["kind", "domain", "tier", "exact_source_count", "exact_sources", "decision", "review_status", "device_test"])
        for row in csv.DictReader(src):
            kind, domain = row["kind"], row["domain"]
            tier = tier_map.get((kind, domain))
            if tier is None:
                raise ValueError("Missing tier for " + domain)
            exact = int(row["exact_source_count"])
            if exact > evidence["source_count"]:
                raise ValueError("Invalid evidence count")
            if tier == "C":
                decision = "baseline_overlap_hold"
            elif protected(domain):
                decision = "protected_hold"
            elif exact >= 2:
                decision = "two_exact_review"
            elif exact == 1:
                decision = "one_exact_review"
            else:
                decision = "other_review"
            counts[decision] += 1
            total += 1
            writer.writerow([kind, domain, tier, exact, row["exact_sources"], decision, "PENDING_REVIEW", "NOT_TESTED"])
    if total != len(tier_map) or total != evidence["candidate_total"]:
        raise ValueError("Inventory count mismatch")
    summary = {"status": "review_only", "published": False, "approved": 0,
               "candidate_total": total, "buckets": counts,
               "warning": "Cross-list evidence is not proof of safety. No rules are activated."}
    (base / "QX-V2.8-Broad-Evidence-Report.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary

if __name__ == "__main__":
    print(json.dumps(build()))
