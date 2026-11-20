# V2.6 domestic adblocking pilot (not enabled)

Goal: prioritize mainland Chinese app advertising while protecting normal DIRECT traffic.

## Exact upstream evidence
- Upstream: https://github.com/blackmatrix7/ios_rule_script/blob/master/source/rule/Advertising/LianXiangJia/LianXiangJia.list
- Read on 2026-11-20. The eight-line upstream source includes `DOMAIN,ad.hori-gz.com`, `DOMAIN,adfile.hori-gz.com`, and several other domains.
- **Only the two explicitly ad-named hosts** were copied into `QX-Adblock-Candidate.list`, converted from source `DOMAIN` to QX `host` with `reject`.
- These names are not proof of effectiveness or harmlessness; both require live traffic evidence and regression checks.
- Broad upstream `pangolin.snssdk.com` was intentionally not included due to shared SDK and app compatibility concerns.
- No adblocking coverage claim for WeChat, Douyin, Taobao, Bilibili or other major apps.

## Safe rollout requirements
1. GitHub workflow must pass the candidate syntax/guardrail checks.
2. Check QX matching precedence versus built-in `CN` DIRECT and existing V2.5 rules. Ad `REJECT` must take precedence over broad domestic `DIRECT` without intercepting unrelated requests.
3. Make a separately named, reversible test subscription; do not modify the existing 359-rule production file.
4. Test affected app(s) and payment/login/Apple/AI/streaming behavior, compare with test resource disabled.
5. Only after observed benefit and no critical regressions, approve a release. No MitM or response manipulation in this phase.

## Source strategy
The large upstream AdvertisingLite (38,066) and Advertising (291,159) rule sets are not imported. Future additions must cite exact upstream lines, keep domain-only matching, and be reviewed in small batches. Domain-blocking cannot reliably remove first-party or in-feed advertising that shares an application's normal API hosts.
