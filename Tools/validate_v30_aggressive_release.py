#!/usr/bin/env python3
"""V3.0 fail-closed release gate for the independent QX aggressive list."""
import hashlib
import json
import re
import sys
from pathlib import Path

PATH = Path("Rules/Adblock/Experiments/QX-V2.8-Aggressive-Latest-OptIn.list")
REPORT = Path("Rules/Adblock/Experiments/QX-V2.8-Aggressive-Report.json")
# Keep service roots and their parent suffixes out of suffix-blocking rules.
ROOTS = tuple("""apple.com icloud.com icloud.com.cn mzstatic.com itunes.apple.com openai.com chatgpt.com oaistatic.com oaiusercontent.com anthropic.com claude.ai claude.com gemini.google.com google.com googleapis.com gstatic.com googleusercontent.com alipay.com alipayobjects.com mybank.cn tenpay.com wechat.com weixin.qq.com wx.com qq.com unionpay.com 95516.com paypal.com stripe.com visa.com mastercard.com bankofchina.com icbc.com.cn ccb.com abchina.com cmbchina.com github.com githubusercontent.com githubassets.com microsoft.com live.com cloudflare.com cloudflare-dns.com dns.google dns.alidns.com dns.pub baidu.com taobao.com tmall.com jd.com douyin.com bilibili.com""".split())
DOMAIN = re.compile(r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z][a-z0-9-]{1,62}$")
def protected(domain, kind):
    return any(domain == root or domain.endswith("." + root) or (kind == "host-suffix" and root.endswith("." + domain)) for root in ROOTS)
def parse(text):
    rules = set()
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        fields = line.split(",")
        if len(fields) != 3 or fields[0] not in ("host","host-suffix") or fields[2] != "reject" or not DOMAIN.fullmatch(fields[1]):
            raise ValueError("Invalid QX rule: " + line[:120])
        key = (fields[0],fields[1])
        if key in rules:
            raise ValueError("Duplicate rule: " + line)
        if protected(fields[1],fields[0]):
            raise ValueError("Protected service coverage: " + line)
        rules.add(key)
    return rules
def main():
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    data = PATH.read_bytes()
    current = parse(data.decode("utf-8"))
    if not current or len(current) != report["included"] or report["candidates"] != report["included"] + report["excluded"]:
        raise ValueError("Candidate and output counts do not reconcile")
    if hashlib.sha256(data).hexdigest() != report["sha256"]:
        raise ValueError("SHA-256 mismatch")
    old = Path("/tmp/qx-v30-previous.list")
    if old.exists():
        previous = parse(old.read_text(encoding="utf-8"))
        if previous:
            removed = len(previous - current)
            added = len(current - previous)
            if len(current) < int(len(previous)*0.85) or len(current) > int(len(previous)*1.15):
                raise ValueError("Total rules changed by more than 15 percent")
            if added > max(500, int(len(previous)*0.05)) or removed > max(500, int(len(previous)*0.05)):
                raise ValueError("More than 5 percent rule churn; keep prior version")
            print(json.dumps({"previous":len(previous),"current":len(current),"added":added,"removed":removed}))
    print("V3.0 safety gate PASS:",len(current),"rules")
if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, UnicodeError) as exc:
        print("V3.0 safety gate FAIL:",exc,file=sys.stderr)
        sys.exit(1)
