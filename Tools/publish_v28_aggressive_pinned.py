#!/usr/bin/env python3
"""Build the aggressive opt-in list from freshly generated local evidence."""
import csv, hashlib, json, re
from pathlib import Path

PROTECTED = tuple("""apple.com icloud.com mzstatic.com itunes.apple.com apple-dns.net akadns.net push.apple.com openai.com chatgpt.com oaistatic.com oaiusercontent.com anthropic.com claude.ai claude.com gemini.google.com googleapis.com google.com gstatic.com googleusercontent.com accounts.google.com alipay.com alipayobjects.com mybank.cn antgroup.com tenpay.com wechat.com weixin.qq.com wx.com qq.com qlogo.cn weixin.com unionpay.com 95516.com paypal.com stripe.com visa.com mastercard.com bankofchina.com icbc.com.cn ccb.com abchina.com cmbchina.com zijieapi.com linksynergy.com mox.tv pixiv.net nicovideo.jp microsoft.com live.com login.live.com windowsupdate.com msftconnecttest.com msftncsi.com github.com githubusercontent.com githubassets.com cloudflare.com cloudflare-dns.com dns.google dns.alidns.com dns.pub 114dns.com localhost home.arpa lan local""".split())
CRITICAL = set("login signin sign-in oauth auth sso account accounts passport payment payments pay checkout wallet bank banking secure security captcha verify verification 2fa mfa push apns ocsp crl dns doh ntp update updates".split())
VALID = re.compile(r"^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$")

def build():
    source = Path("Rules/Adblock/Generated/QX-V2.8-Broad-Evidence-REVIEW-ONLY.csv")
    with source.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if len(rows) < 30000:
        raise ValueError("Unexpectedly small candidate inventory; refusing publication")
    kept, excluded, seen = [], [], set()
    for row in rows:
        kind, domain = row["kind"], row["domain"].lower().strip()
        reason = None
        if row["decision"] == "baseline_overlap_hold":
            reason = "existing_baseline_overlap"
        elif row["decision"] == "protected_hold" or any(domain == p or domain.endswith("."+p) for p in PROTECTED):
            reason = "protected_service"
        elif any(label in CRITICAL for label in domain.split(".")):
            reason = "critical_endpoint_label"
        elif kind not in ("host","host-suffix") or not VALID.fullmatch(domain) or ".." in domain or "." not in domain:
            reason = "invalid_rule"
        elif (kind,domain) in seen:
            reason = "duplicate"
        if reason:
            excluded.append((kind,domain,reason))
        else:
            kept.append((kind,domain))
            seen.add((kind,domain))
    if len(kept) + len(excluded) != len(rows):
        raise ValueError("Partition count mismatch")
    out = Path("Rules/Adblock/Experiments/QX-V2.8-Aggressive-Latest-OptIn.list")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("# V2.8 AGGRESSIVE OPT-IN - broad host and host-suffix blocking\n# NOT device-tested. May disrupt apps; disable this independent resource to rollback.\n# Do not combine with previous V2.8 8/15/177 test resources.\n" + "".join("%s,%s,reject\n" % item for item in kept), encoding="utf-8")
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    report = {"source":"fresh AdvertisingLite plus independent corroboration","candidates":len(rows),"included":len(kept),"excluded":len(excluded),"sha256":digest,"device_tested":False,"warning":"Counts may change with upstream source updates"}
    Path("Rules/Adblock/Experiments/QX-V2.8-Aggressive-Report.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report))

if __name__ == "__main__":
    build()
