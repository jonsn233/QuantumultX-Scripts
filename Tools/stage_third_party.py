#!/usr/bin/env python3
"""Stage a reviewed third-party Quantumult X rules bundle; never overwrite live rules.

Run: python3 Tools/stage_third_party.py
Produces Rules/staging/QX-Third-Party-Candidate.list and a JSON audit.
All network failures, unsupported types, conflicts and count drops fail closed.
"""
from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import json
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Rules/staging/QX-Third-Party-Candidate.list"
REPORT = ROOT / "Rules/staging/QX-Third-Party-Audit.json"
SOURCES = [
    ("YouTube", "Intl-YouTube", 196, "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/YouTube/YouTube.list"),
    ("GitHub", "Intl-GitHub", 31, "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/GitHub/GitHub.list"),
    ("Telegram", "Intl-General", 40, "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Telegram/Telegram.list"),
]
ALLOWED = {"host", "host-suffix", "host-keyword", "host-wildcard", "ip-cidr", "ip6-cidr", "ip-asn", "user-agent"}
VALID_TOKEN = re.compile(r"^[^,\s#]+$")
def main():
    entries, seen, audit = [], {}, []
    for name, policy, baseline, url in SOURCES:
        req = urllib.request.Request(url, headers={"User-Agent": "QX-Staging-Audit/1.0"})
        with urllib.request.urlopen(req, timeout=25) as response:
            raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError(f"{name}: oversized source")
        body = raw.decode("utf-8-sig")
        rules, counts = [], Counter()
        for n, line in enumerate(body.splitlines(), 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) not in (2, 3):
                raise ValueError(f"{name}:{n}: unexpected field count: {line}")
            kind = parts[0].lower()
            if kind not in ALLOWED or not VALID_TOKEN.fullmatch(parts[1]):
                raise ValueError(f"{name}:{n}: unsupported or malformed rule: {line}")
            # Upstream third field may be 'no-resolve' on IP rules, never a policy.
            if len(parts) == 3 and parts[2].lower() != "no-resolve":
                raise ValueError(f"{name}:{n}: unexpected third field: {line}")
            if len(parts) == 3 and kind not in ("ip-cidr", "ip6-cidr"):
                raise ValueError(f"{name}:{n}: no-resolve on unsupported type: {line}")
            key = (kind, parts[1].lower())
            if key in seen:
                if seen[key] != policy:
                    raise ValueError(f"Cross-source policy conflict {key}: {seen[key]} vs {policy}")
                continue
            seen[key] = policy
            normalized = f"{kind},{parts[1]},{policy}"
            if len(parts) == 3:
                normalized += ",no-resolve"
            rules.append(normalized)
            counts[kind] += 1
        if len(rules) < baseline:
            raise ValueError(f"{name}: count dropped from baseline {baseline} to {len(rules)}")
        entries.extend([f"# {name}: {url}", *rules, ""])
        audit.append({"source": name, "url": url, "policy": policy,
                      "sha256": sha256(raw).hexdigest(), "baseline": baseline,
                      "unique_rules": len(rules), "types": dict(counts)})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("# STAGING ONLY: not live, requires Quantumult X compatibility validation\n"
                   + "# Generated from attributed third-party sources\n\n"
                   + "\n".join(entries) + "\n", encoding="utf-8")
    REPORT.write_text(json.dumps({"generated_utc": datetime.now(timezone.utc).isoformat(),
        "total_unique": len(seen), "sources": audit}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"STAGED {len(seen)} unique rules; live bundle unchanged")

if __name__ == "__main__":
    main()
