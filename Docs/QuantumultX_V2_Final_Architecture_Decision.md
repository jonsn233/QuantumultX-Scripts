# Quantumult X V2 — final architecture decision gate

Status: DESIGN FROZEN, NOT APPROVED FOR DEVICE IMPORT.
Updated 2026-11-15.

## Why we are not repeatedly importing profiles
Replacing the whole QX profile can require restoring private server subscriptions and reselecting nodes. The user has explicitly required a single final cutover, not incremental imports.

## Confirmed behavior / constraints
- QX `static` policy: user manually chooses a node or supported child policy.
- QX `available` policy: selects the first available candidate server based on connectivity checks; it is not a Claude/ChatGPT/Gemini application-health probe. QX's sample config describes rechecking when the selected result is unavailable and a request triggers the group.
- An `available` group does not natively enforce a deterministic US-LA-02 -> US-LA-03 -> US-NY -> JP multi-tier failover for a changing subscription.
- Nested `static` -> `available` is a supported design pattern in community docs, but must still be checked on the actual installed QX version.
- IP Guard v19 is read-only and stores history; it must not be advertised as a policy switcher.

## Decision
1. **Stable production baseline**: keep user's working V2.1 untouched.
2. **Claude**: default manual pin to verified US LA02. Provide US fallback candidates but no automatic change unless user opts in.
3. **OpenAI and Gemini**: manual pin by default; optional `AI-US-Auto` available group, activated only by selecting it in the service group.
4. **Cross-region fallback**: manual by design. Do not silently send AI traffic to DIRECT or unsupported locations.
5. **IP churn**: use IP Guard v19 observations, do not promise sticky IP when `available` changes nodes.
6. **DNS**: retain accepted baseline. BrowserLeaks showed multi-provider DNS but did not establish a definitive local DNS leak. IPv6 test was 9/10 and did not show obvious real IPv6 address exposure. Defer changes to a separate reversible update.
7. **Updates without profile replacement**: move eligible routing lists and UIAction scripts to maintained remote URLs. QX policy definitions and private subscriptions remain in the local profile; do not pretend remote rule updates can change [policy] definitions.
8. **Sensitive data**: private subscription token and MitM P12/passphrase stay off GitHub. Prior exposure warrants token rotation and certificate review.

## Acceptance before any new import
- [x] Existing V2.1 works on user's phone (AI routing, domestic, streaming, basic IPv6).
- [x] V2.2 experimental profile exists in development branch.
- [x] Static group references and secret scan of V2.2 passed.
- [x] QX sample documentation consulted for available/static semantics.
- [ ] Final node-name/priority list frozen, including whether LA02 must be first.
- [ ] Single final import artifact prepared, with all required sections including [mitm].
- [ ] Offline consistency and sensitive-data checks passed for that artifact.
- [ ] One-time device cutover, node subscription reattachment and focused verification.
- [ ] Release to main only after device acceptance.

## Minimal one-time cutover
1. Back up current V2.1, confirm restoration route.
2. Import final secret-free profile **once**.
3. Restore private subscription only on device and update server resources.
4. Set Claude fixed LA02; select desired OpenAI/Gemini fixed or US-Auto modes.
5. Verify selected policy paths and one egress, avoid rerunning already passed script-internal tests.
6. Roll back to V2.1 if missing nodes, empty groups, unexpected DIRECT, or critical LAN/DNS failure.

## Source references
- https://github.com/crossutility/Quantumult-X/blob/master/sample.conf
- https://qx.atlucky.me/shi-yong-fang-fa/pei-zhi-wen-jian-xiang-jie/policy-zi-ding-yi-ce-le-zu
