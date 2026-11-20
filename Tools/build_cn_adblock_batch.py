#!/usr/bin/env python3
"""Build a review-only QX adblock batch from pinned upstream lists.

No active subscription is written. No rule is automatically approved.
Standard library only. Run with --offline for deterministic local fixtures.
"""
import argparse
import hashlib
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Rules/Adblock/Generated"
SOURCES = {
    "blackmatrix7-advertising-lite":
        "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/AdvertisingLite/AdvertisingLite.list",
}
DOMAIN = re.compile(r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$", re.I)
# Protect full service roots AND their subdomains; review can relax this later.
PROTECTED = (
    "apple.com", "icloud.com", "icloud.com.cn", "mzstatic.com",
    "alipay.com", "alipayobjects.com", "tenpay.com", "wechat.com",
    "weixin.qq.com", "qq.com", "baidu.com", "bcebos.com",
    "taobao.com", "tmall.com", "jd.com", "douyin.com", "snssdk.com",
    "bilibili.com", "openai.com", "chatgpt.com", "anthropic.com",
    "claude.ai", "google.com", "googleapis.com", "github.com",
    "microsoft.com", "paypal.com", "stripe.com",
)
def is_protected(domain):
    return any(domain == root or domain.endswith("." + root) or root.endswith("." + domain)
               for root in PROTECTED)

def fetch(url, max_bytes):
    with urllib.request.urlopen(urllib.request.Request(url, headers={
        "User-Agent": "QX-CN-Adblock-Review-Builder/1.0"
    }), timeout=25) as response:
        data = response.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ValueError("upstream exceeds byte cap")
    return data

def parse(raw):
    counts = {"input_lines": 0, "unsupported": 0, "non_reject": 0, "protected": 0,
              "invalid": 0, "duplicates": 0}
    accepted = set()
    for line in raw.decode("utf-8-sig").splitlines():
        counts["input_lines"] += 1
        line = line.strip()
        if not line or line.startswith(("#", ";", "//")):
            continue
        fields = [s.strip().lower() for s in line.split(",")]
        if len(fields) < 2 or fields[0] not in ("host", "host-suffix", "domain", "domain-suffix"):
            counts["unsupported"] += 1
            continue
        # Only the configured AdvertisingLite list label is allowed alongside REJECT.
        # Never convert an upstream DIRECT/PROXY policy into a REJECT.
        if len(fields) > 2 and fields[2] not in ("reject", "reject-drop", "reject-200", "advertisinglite"):
            counts["non_reject"] += 1
            continue
        kind = "host-suffix" if fields[0] in ("host-suffix", "domain-suffix") else "host"
        domain = fields[1]
        if not DOMAIN.fullmatch(domain):
            counts["invalid"] += 1
        elif is_protected(domain):
            counts["protected"] += 1
        else:
            rule = (kind, domain)
            if rule in accepted:
                counts["duplicates"] += 1
            accepted.add(rule)
    return accepted, counts

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", type=Path, help="use local upstream list instead of network")
    parser.add_argument("--max-bytes", type=int, default=8_000_000)
    args = parser.parse_args()
    if not 0 < args.max_bytes <= 20_000_000:
        parser.error("max-bytes must be 1..20000000")
    raw = args.offline.read_bytes() if args.offline else fetch(next(iter(SOURCES.values())), args.max_bytes)
    if len(raw) > args.max_bytes:
        raise ValueError("input exceeds byte cap")
    rules, counts = parse(raw)
    if not rules:
        raise ValueError("zero usable candidate rules; refusing empty artifact")
    OUT.mkdir(parents=True, exist_ok=True)
    output = OUT / "QX-CN-Adblock-Bulk-REVIEW-ONLY.list"
    report = OUT / "QX-CN-Adblock-Bulk-Report.json"
    output.write_text("# GENERATED REVIEW ONLY - DO NOT SUBSCRIBE OR PUBLISH AUTOMATICALLY\n"
                      + "".join(f"{kind},{domain},reject\n" for kind, domain in sorted(rules)),
                      encoding="utf-8")
    report.write_text(json.dumps({
        "status": "unreviewed_not_device_tested", "active_publish": False,
        "source": str(args.offline) if args.offline else next(iter(SOURCES.values())),
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "accepted_count": len(rules), "counts": counts,
        "protected_roots": list(PROTECTED),
        "notes": "Domain-only safety filter cannot establish harmlessness or efficacy."
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"accepted": len(rules), "counts": counts, "output": str(output)}))

if __name__ == "__main__":
    main()
