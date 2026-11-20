# V2.5 third-party filter consolidation audit (2026-11-20)

Status: **NOT YET MIGRATED**. Keep three third-party remote subscriptions enabled on the phone.

## Verified upstream sources
- YouTube: https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/YouTube/YouTube.list — upstream header says 196 rules: HOST 3, HOST-KEYWORD 1, HOST-SUFFIX 179, HOST-WILDCARD 3, IP-CIDR 2, IP6-CIDR 1, USER-AGENT 7.
- GitHub: https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/GitHub/GitHub.list — upstream header says 31 rules: HOST-SUFFIX 30, HOST-KEYWORD 1.
- Telegram: https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Telegram/Telegram.list — upstream header says 40 rules: HOST 2, HOST-KEYWORD 1, HOST-SUFFIX 22, IP-ASN 5, IP-CIDR 6, IP6-CIDR 4.

## Current policy mapping
- YouTube -> Intl-YouTube
- GitHub -> Intl-GitHub
- Telegram -> Intl-General

## Findings
- The published 108-rule QX-V2.5-All-Rules.list contains only lowercase host / host-suffix rules.
- Third-party lists contain additional match types and domains; deleting them now would reduce coverage.
- The current Tools/build_rules.py validator accepts only host / host-suffix. Directly adding these upstream lists to SOURCES will fail validation.
- Third-party files are dynamic upstream resources; snapshotting them into one bundle requires provenance, update cadence, normalization, validation and conflict detection.
- Rule order matters. Preserve dedicated AI matches ahead of generic Google/YouTube; preserve local/private direct protections and geoip/final fallback.
- The phone's built-in FILTER_LAN and FILTER_REGION are NOT part of the GitHub bundle and should remain enabled until equivalent safe behavior is independently validated.

## Safe implementation sequence
1. Add a separate importer that fetches the three upstream resources on GitHub Actions, with explicit policy mapping, rule-type allowlist and fail-closed validation.
2. Preserve upstream source URL, revision/hash, licensing attribution and generated counts.
3. Detect duplicate matches, conflicting policies, malformed lines and suspicious upstream count drops.
4. Generate one combined resource, retaining existing URL and tested native Quantumult X syntax.
5. Validate remote download in Quantumult X **before** removing the three original third-party resources.
6. Keep a known-good rollback config. Do not publish airport tokens or MitM secrets.

## Rewrite management
- Rewrites/QX-All-Rewrites.conf is a staged empty placeholder, not an enabled rewrite subscription.
- The two Spotify rewrites remain disabled after prior ineffective A/B tests.
- Do not enable broad MitM or intercept login, payment or banking traffic without review.
