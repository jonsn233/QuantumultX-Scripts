# Claude IP Guard v18 — Development Plan

## Status

- Development branch: `dev/claude-ip-guard-v18`
- Baseline: `Scripts/Claude/Claude_IP_Guard_QX_v17.js` (v17.2)
- Release status: development only; do not replace the v17.2 production script until acceptance testing is complete.

## Goals

Integrate optional third-party IP reputation data into Claude IP Guard while preserving the accepted v17.2 report layout and node-isolated routing behavior.

## Required behavior

1. **Selected-node isolation**
   - Read the selected node tag from Quantumult X event-interaction parameters.
   - Every request that is intended to inspect the selected node must explicitly use that exact policy.
   - Never silently fall back to DIRECT, a proxy group, or another node.
   - If the selected node tag is absent, stop before making network requests.

2. **出口 IPv4 verification**
   - Query two independent IPv4 echo services using the selected-node policy.
   - Require both responses to be valid IPv4 addresses and identical before saving a history sample.
   - If either request fails or the results disagree, show the individual outcomes and do not save history.

3. **IP intelligence and reputation**
   - Keep geolocation/ASN/ISP/type separate from reputation scores.
   - Integrate IPPure, ipapi.is, IP2Location, and Scamalytics as independent optional sources.
   - Validate that each provider's returned IP matches the verified target IP before accepting its data.
   - Preserve each provider's original score and native meaning; do not average scores or imply that equal numeric scores are equivalent.
   - Missing/blocked/rate-limited providers must display as unavailable, not as zero risk.

4. **Resilience and request discipline**
   - Use bounded timeouts and bounded concurrency.
   - Do not retry HTTP 403.
   - Handle HTTP 429 with a conservative retry policy only when a valid Retry-After value is available; otherwise mark the source rate-limited.
   - Avoid retrying schema/JSON validation failures.
   - Cache provider responses by verified IP with a conservative TTL, while showing whether data is cached and when it was obtained.
   - Never use a cached result for a different IP.

5. **History**
   - Keep history isolated by selected node tag.
   - Save only samples where the two IPv4 sources agree.
   - Keep the existing local Quantumult X preference-storage model and bounded history length.
   - Reputation cache and node history must use separate keys and schemas.

6. **UI**
   - Preserve the v17.2 visual hierarchy, compact two-column status area, history strip, and detail rows.
   - Add a clearly separated reputation section.
   - Show provider name, native score, native scale/meaning, and source status.
   - Do not restore the older v17.0 UI or introduce an unrelated layout redesign.

7. **Transparency**
   - Clearly state that IP intelligence and reputation are third-party estimates.
   - Do not describe these results as Anthropic/Claude server-side confirmation, account-ban probability, or a guarantee of account safety.
   - Do not claim DNS/IPv6 leak detection or long-term stability unless those checks are separately implemented and tested.

## Acceptance tests

- Test at least one US, one Japan, and one Singapore node.
- Confirm that the displayed selected-node tag matches the node long-pressed in Quantumult X.
- Confirm that the two echo providers return the actual selected-node exit and agree before history is saved.
- Confirm that switching nodes changes the measured IP where their exits differ.
- Confirm that each reputation provider's response IP matches the target IP.
- Simulate/observe provider failures (403, 429, timeout, malformed JSON) and verify graceful partial results without false zero scores.
- Confirm that repeated checks of the same IP use cache within TTL and that a different IP never reuses the previous IP's reputation data.
- Confirm that v17.2 remains untouched and available for rollback.

## Implementation note

The reference IPPure script is useful as a source of provider endpoints and field mappings, but its request fan-out and retry behavior should not be copied wholesale. Provider schemas and access policies must be treated as untrusted external inputs and validated before display.
