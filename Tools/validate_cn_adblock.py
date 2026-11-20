#!/usr/bin/env python3
"""Read-only guardrails for the opt-in China adblock pilot (stdlib only)."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PILOT = ROOT / "Rules/Adblock/QX-V2.6-CN-Adblock-Test.list"
RELEASE = ROOT / "Rules/Releases/QX-V2.5-359-Rules.list"
CANDIDATE = ROOT / "Rules/Adblock/QX-Adblock-Candidate.list"
ALLOWED = {"host", "host-suffix"}
PROTECTED = (
    "apple.com", "icloud.com", "icloud.com.cn", "baidu.com",
    "map.baidu.com", "alipay.com", "tenpay.com", "wechat.com",
    "weixin.qq.com", "qq.com", "openai.com", "chatgpt.com",
    "claude.ai", "anthropic.com", "gemini.google.com",
)
DOMAIN = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$")
errors = []
seen = set()
count = 0
for number, raw in enumerate(PILOT.read_text(encoding="utf-8").splitlines(), 1):
    line = raw.strip()
    if not line or line.startswith("#"):
        continue
    fields = [part.strip() for part in line.split(",")]
    if len(fields) != 3:
        errors.append(f"line {number}: expected exactly 3 fields")
        continue
    kind, domain, action = fields
    count += 1
    if kind not in ALLOWED or action != "reject" or not DOMAIN.fullmatch(domain):
        errors.append(f"line {number}: unsupported rule syntax")
    if (kind, domain) in seen:
        errors.append(f"line {number}: duplicate domain rule")
    seen.add((kind, domain))
    for safe in PROTECTED:
        if domain == safe or safe.endswith("." + domain) or domain.endswith("." + safe):
            errors.append(f"line {number}: overlaps protected service {safe}")
    if domain.startswith("*.") or domain in {"com", "cn", "net"}:
        errors.append(f"line {number}: overly broad domain")
candidate_rules = {
    line.strip().lower() for line in CANDIDATE.read_text(encoding="utf-8").splitlines()
    if line.strip() and not line.lstrip().startswith(("#", ";"))
}
pilot_rules = {
    line.strip().lower() for line in PILOT.read_text(encoding="utf-8").splitlines()
    if line.strip() and not line.lstrip().startswith(("#", ";"))
}
if pilot_rules != candidate_rules:
    errors.append("pilot and reviewed candidate differ; review before publishing")
if count > 200:
    errors.append("pilot exceeds 200-rule cap")
if not RELEASE.is_file():
    errors.append("V2.5 release missing")
else:
    release = RELEASE.read_text(encoding="utf-8")
    if "host-suffix,chatgpt.com,AI-OpenAI" not in release:
        errors.append("V2.5 baseline AI route unexpectedly missing")
print(f"Pilot rules: {count}; duplicates: {len(seen) != count}; errors: {len(errors)}")
for error in errors:
    print("ERROR:", error)
sys.exit(1 if errors else 0)
