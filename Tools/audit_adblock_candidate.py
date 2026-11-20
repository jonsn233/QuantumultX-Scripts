#!/usr/bin/env python3
"""Fail-closed audit for *staged* Quantumult X adblocking host rules.

No network calls. Does not publish, enable, or modify any live subscription.
Accepts only explicit domain rules using reject policy, and rejects sensitive
first-party service matches that could disrupt payments, login or AI.
"""
from pathlib import Path
import ipaddress
import json
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"Rules/Adblock/QX-Adblock-Candidate.list"
REPORT=ROOT/"Rules/Adblock/QX-Adblock-Audit.json"
DOMAIN=re.compile(r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$",re.I)
PROTECTED=(
    "apple.com","icloud.com","itunes.apple.com","mzstatic.com",
    "alipay.com","alipayobjects.com","weixin.qq.com","wechat.com",
    "paypal.com","stripe.com","visa.com","mastercard.com",
    "chatgpt.com","openai.com","oaistatic.com","oaiusercontent.com",
    "claude.ai","anthropic.com","gemini.google.com","google.com",
    "github.com","githubusercontent.com","microsoft.com",
    "login.live.com","accounts.google.com","idmsa.apple.com",
)
def protected(domain):
    return any(domain==base or domain.endswith("."+base) for base in PROTECTED)
def main():
    rules=[]
    seen=set()
    errors=[]
    for no,raw in enumerate(SOURCE.read_text(encoding="utf-8-sig").splitlines(),1):
        line=raw.strip()
        if not line or line.startswith(("#",";")):continue
        parts=[x.strip() for x in line.split(",")]
        if len(parts)!=3:
            errors.append(f"line {no}: expected 3 fields")
            continue
        kind,domain,policy=parts
        domain=domain.lower()
        if kind not in ("host","host-suffix") or policy.lower()!="reject":
            errors.append(f"line {no}: only host/host-suffix with reject allowed")
        elif not DOMAIN.fullmatch(domain) or protected(domain):
            errors.append(f"line {no}: invalid or protected domain")
        elif (kind,domain) in seen:
            errors.append(f"line {no}: duplicate")
        else:
            seen.add((kind,domain))
            rules.append((kind,domain))
    if len(rules)>200:
        errors.append("candidate exceeds 200 rules; require a separate review")
    # Avoid creating a misleading approval report on a failed audit.
    if errors:
        print("BLOCKED: "+"; ".join(errors))
        return 1
    print(json.dumps({"status":"staging_only_not_device_tested","candidate_rules":len(rules),
                      "protected_suffixes":len(PROTECTED),"active_publish":False},ensure_ascii=False))
    return 0
if __name__=="__main__":
    sys.exit(main())
