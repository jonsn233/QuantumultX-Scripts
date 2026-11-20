#!/usr/bin/env python3
"""Validate isolated QX opt-in pilot artifact and its rollback contract."""
import json
import re
from pathlib import Path
from build_v28_broad_evidence import protected

BASE = Path(__file__).resolve().parents[1] / "Rules/Adblock/Generated"
DOMAIN = re.compile(r"^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$")

def validate(base=BASE):
    report = json.loads((base / "QX-V2.8-OptIn-50-Report.json").read_text(encoding="utf-8"))
    if report.get("status") != "device_test_only" or report.get("published") is not False or report.get("subscribed") is not False or report.get("approved_for_production") is not False:
        raise ValueError("Pilot must be opt-in and unpublished")
    lines = (base / "QX-V2.8-OptIn-50-DEVICE-TEST-ONLY.list").read_text(encoding="utf-8").splitlines()
    domains = []
    for line in lines:
        if not line or line.startswith("#"):
            continue
        fields = line.split(",")
        if len(fields) != 3 or fields[0] != "host" or fields[2] != "reject":
            raise ValueError("Invalid or broad QX rule: " + line)
        domain = fields[1]
        if not DOMAIN.fullmatch(domain) or ".." in domain or "." not in domain or protected(domain):
            raise ValueError("Invalid or protected domain: " + domain)
        domains.append(domain)
    if not 1 <= len(domains) <= 50 or len(domains) != report["rules"]:
        raise ValueError("Invalid pilot rule count")
    if len(domains) != len(set(domains)) or domains != sorted(domains):
        raise ValueError("Duplicate or unordered pilot domains")
    return {"validated": True, "rule_count": len(domains), "production_modified": False,
            "deployment": "manual_opt_in_only", "rollback": "Remove or disable only the isolated test rule source"}

if __name__ == "__main__":
    print(json.dumps(validate()))
