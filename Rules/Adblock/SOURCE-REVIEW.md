# V2.6 advertising rule source review — 2026-11-20

Status: **source selection completed; no adblock rule enabled or approved yet**.

## Evaluated upstream: blackmatrix7/ios_rule_script

1. **AdvertisingLite (Quantumult X)**: https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/AdvertisingLite/README.md
   - Published documentation: last update 2025-12-08; **38,066 rules** (HOST 23,753; HOST-KEYWORD 187; HOST-SUFFIX 13,939; IP-CIDR 186; IP6-CIDR 1).
   - Maintainer describes it as standalone; excludes Hijacking and Privacy.
   - Not suitable for direct import into this project's strict 200-rule, domain-only staging validator.
2. **Advertising (Quantumult X)**: https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/QuantumultX/Advertising/README.md
   - Published documentation: last update 2026-10-28; **291,159 rules** (HOST 16,436; HOST-KEYWORD 278; HOST-SUFFIX 273,956; IP-CIDR 486; IP6-CIDR 3).
   - Maintainer explicitly warns about false positives and recommends allowlisting.
   - Includes categories such as AdvertisingLite, Hijacking and Privacy. Too broad for a first safe rollout.
3. **No automatic copying**: both large source lists require a review of actual contents, license/attribution, protected domain overlap, and safe exception precedence before inclusion. Documentation-level statistics are not evidence that any individual domain is safe to block.

## Decision
- **Do not import either full list.** This would violate the user's requirement that Apple, payments, logins and AI services keep working.
- Prefer a **small, reviewed allowlist-of-blocks**: explicit `host` / `host-suffix` entries, maximum 200, no wildcard, no MITM, no script, no IP or keyword rules.
- Candidate remains empty until exact domains can be inspected and verified against upstream and protected first-party services.
- Use GitHub Actions audit + regression tests before device rollout. Verify QX actual ad-block hits and critical service behavior on device. Publish a separate resource only after that evidence.
- The V2.5 359-rule production subscription is out of scope and must remain unchanged.

## Known limitation
Current static protected suffix list is a guardrail, **not** a guarantee against breakage. A seemingly unrelated telemetry domain can still be required for an app's login or operation. Actual device testing and reversible rollout are mandatory.
