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

## Second batch: documented domestic app startup-ad hosts (2026-11-20)
Exact upstream: https://github.com/blackmatrix7/ios_rule_script/blob/master/source/rule/Advertising/Advertising.list

- `DOMAIN,dss0.bdstatic.com,REJECT` — upstream comment: 百度地图开屏广告; staged as `host,dss0.bdstatic.com,reject`.
- `DOMAIN-SUFFIX,ads.lejuliang.com,REJECT` — upstream comment: 票根启动广告; staged as `host-suffix,ads.lejuliang.com,reject`.
- `DOMAIN,ad.xunkids.com,REJECT` — upstream comment: 小寻儿童电话手表 app 启动广告; staged as `host,ad.xunkids.com,reject`.
- `URL-REGEX,^https?...cdn-1rtb.caiyunapp.com/creative/...,REJECT` — upstream comment: 彩云天气开屏广告; **not imported**, because this pilot permits domain rules only and does not authorize URL rewrite or MitM.

Five total staged domains; none enabled. Upstream labeling is not device proof. Baidu's `bdstatic.com` is a shared parent; only exact `dss0.bdstatic.com` is eligible, never the entire suffix.

## Isolated opt-in test resource (published, NOT enabled)

URL: https://raw.githubusercontent.com/jonsn233/QuantumultX-Scripts/main/Rules/Adblock/QX-V2.6-CN-Adblock-Test.list

The separate file contains the five reviewed-source candidate domains. It is not referenced by the V2.5 359-rule production subscription or any automation that updates the phone. **Publishing a GitHub file does not enable it on iPhone.**

### Test order and rollback
- Before import, keep the existing V2.5 production filter and AI policy choices untouched.
- Add as a separate filter_remote subscription named `V2.6-CN-Adblock-Test`, initially **disabled**.
- During a controlled trial, ensure the new adblock resource is evaluated before any overlapping broad domestic DIRECT rule. A `CN` region shortcut may not necessarily be the first matching rule; verify via QX request log, not assumption.
- Enable the test resource; check a specific target app's opening screen and request log. Record whether the exact host was matched with REJECT and whether app content still loads.
- Check payment, Apple services, AI login and ordinary domestic apps. Turn the test resource **off immediately** if anything fails.
- Disable the test resource and repeat the same app action to compare. A successful REJECT hit does not by itself prove a visible ad disappeared.
- No MitM, scripts, certificates or rewrite modules are needed for this pilot.

### Limits
Only a handful of specific domestic ad endpoints are targeted. No guarantee of coverage for Douyin, WeChat, Bilibili, Taobao, or any app that uses first-party ad endpoints. Test subscription is manually opt-in and not automatically activated.

## Real device evidence — 2026-11-20 18:34 (user screenshot)

Quantumult X network activity while using Baidu Maps:
- `bj-td-menta-01-callback.advlion.com:443`: GEOIP,CN,DIRECT; possible advertising callback, **not verified safe to block**.
- `s.1rtb.net:443`: GEOIP,CN,DIRECT; possible real-time bidding endpoint, **not verified safe to block**.
- `open.e.kuaishou.com:443`: GEOIP,CN,DIRECT; ambiguous shared app/SDK endpoint, **do not block by inference**.
- `cnloc.map.baidu.com:443`: HOST-SUFFIX,BAIDU.COM,DIRECT; location service, preserve.
- `gateway.icloud.com.cn:443`: GEOIP,CN,DIRECT; Apple service, preserve.

No REJECT is visible in the screenshot; this does not prove no other REJECT events occurred. Previously searched `dss0.bdstatic.com` had no records. Current five-rule pilot does not cover the two observed ad-related candidate domains.

**Decision:** keep current production and five-rule test resource unchanged. Do not block `advlion.com` or `1rtb.net` at parent-domain level based solely on names. Verify endpoint role, exact-match scope, and A/B test effect before introducing a separately reviewed change. In particular, retain existing DIRECT for `cnloc.map.baidu.com` and Apple.

## Third batch: observed domains cross-checked with community filters (2026-11-20)

- `bj-td-menta-01-callback.advlion.com`: appeared as DIRECT in the user's QX log; exact hostname listed in AWAvenue Adguard filter: https://github.com/TG-Twilight/AWAvenue-Ads-Rule/blob/main/Filters/AWAvenue-Ads-Rule-Adguard.txt
- `s.1rtb.net`: appeared as DIRECT in the same log; listed in community issue https://github.com/TG-Twilight/AWAvenue-Ads-Rule/issues/193 (report, not proof of efficacy).
- Both staged as exact `host,...,reject` in the candidate and isolated test resource. Total **7** rules. Do not broaden to parent domain suffixes.
- Existing enabled QX subscription will need a **manual remote resource refresh** to fetch these new lines. GitHub edits alone do not update the local cached copy.
- To validate: refresh only V2.6 test subscription; reproduce relevant app traffic; verify both exact hosts show REJECT rather than GEOIP CN DIRECT; check map functions and unrelated domestic apps. If an app breaks, disable the test subscription to roll back.
- Observed traffic and community inclusion support *testing*, not proof that blocking is harmless or removes visible ads.
