# Quantumult X v2 — Current profile static audit

Source: user-provided `qx 001.conf`, reviewed 2026-11-15. This document intentionally contains **no subscription URL, token, MitM certificate, private key, or passphrase**. Do not upload the original profile to public GitHub.

## Observed structure
- 11 policy entries, including static `AI-OpenAI`, `AI-Claude`, `AI-Gemini`.
- Generic `Intl-Auto` uses availability checks; **AI groups do not currently auto-failover**.
- 122 active `filter_local` entries; 5 remote filter entries, 2 remote rewrite entries, 4 local interaction tasks.
- DNS: Alibaba DoH; local/system exceptions for `home.arpa` and `local`. IPv6 remains enabled.
- Existing AI, streaming, social, YouTube, GitHub and domestic routing classes are present.
- Remote node subscription line in this exported file is disabled; the actual on-device subscription may differ.
- A Spotify rewrite is enabled. MitM contains certificate material and a passphrase: **sensitive; excluded from this repository**.
- Claude IP Guard v17 and v19 are both configured; v19.0 has passed device acceptance.

## Architecture gaps and gates
1. AI same-region-first automatic failover is not implemented. Do not imply an `available` group guarantees a stable public IP, supported region, or Claude reachability.
2. AI policy tags are matched by region regex; subscription node names and their current availability must be checked on device before activation.
3. Remote rules, DNS leak behavior, IPv6 handling and MitM interactions are **not** validated by this static audit.
4. Existing profile contains secrets. Rotate the exposed subscription token; assess whether to revoke/replace the exported MitM certificate. Keep all secrets on device.
5. Build a new standalone profile in stages; no changes to the active iPhone configuration without explicit migration/rollback.

## Proposed next phase
- Design dedicated per-service policies, same-region fallback, and observable node changes.
- Produce a secret-free standalone candidate and local-only subscription insertion instructions.
- Verify Quantumult X syntax against reliable documentation and actual device behavior before declaring auto-failover functional.
- Keep v19 IP Guard as the accepted read-only monitor, not an automatic policy-switching engine.
