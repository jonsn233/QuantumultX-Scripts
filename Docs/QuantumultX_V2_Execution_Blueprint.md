# Quantumult X V2 — Execution blueprint (2026-11-15)

## Outcome and priority
Ship a **new** standalone, secret-free, importable profile with a single controlled iPhone cutover, a rollback path and no unnecessary re-testing. Keep the currently working profile active until the candidate passes static validation.

## Frozen decisions
1. Separate `AI-OpenAI`, `AI-Claude`, `AI-Gemini`; do not route AI through generic `Intl-Auto` or DIRECT as an implicit fallback.
2. Prefer manually pinned AI nodes for predictable egress. **Do not claim automatic same-region-first failover** until exact Quantumult X supported group semantics and node lists are verified. A future failover option is opt-in and requires change monitoring.
3. Keep generic international traffic on `Intl-Auto`; preserve separate YouTube, GitHub, Social, Netflix and Disney policies.
4. Local/LAN ranges DIRECT; preserve regional routing only after precedence audit. Preserve the existing working DNS behavior initially rather than introduce simultaneous DoH/IPv6 changes.
5. Keep the validated Claude IP Guard v19.0 UIAction. Do not copy legacy v16/v17 monitor tasks into the new production candidate by default.
6. Do not migrate Spotify rewrites, third-party MitM rules or any certificate material without an explicit separate audit.
7. All secrets remain local: subscription tokens, node credentials, MitM P12 and passphrases. The shared source profile contained these values and must never be committed verbatim.

## Fastest safe execution sequence
- **Step A — build:** Produce a standalone profile using the uploaded file as the factual baseline; remove all credentials and MitM material; document exact places for local subscription injection. Keep all named policy references internally consistent.
- **Step B — offline gate:** Check syntax sections, duplicate policies, references, remote URLs, rule precedence and absence of sensitive content. Test only assumptions that are testable offline.
- **Step C — single cutover:** User exports a local backup, inserts a freshly rotated subscription URL only on device, imports the candidate as a separate profile, checks selected nodes, and switches to it.
- **Step D — focused acceptance:** Verify AI policy assignment, one US node egress with v19, one domestic DIRECT path, one streaming/general path, and basic DNS/LAN functionality. Only retest failures, not already verified script internals.
- **Step E — publish:** Publish the secret-free candidate and a concise operations/rollback runbook only after user confirms device acceptance.

## Stop / rollback conditions
- Subscription nodes absent, policy group empty, AI traffic unexpectedly DIRECT, loss of LAN/DNS access, or uncloseable UI: revert to saved original profile immediately.
- If no proof of supported failover semantics, ship pinned manual AI policies first. Do not trade predictable AI egress for an unverified automatic switch.

## Progress ledger
- [x] Baseline profile received and audited
- [x] Secret exposure identified and isolated from GitHub
- [x] Implementation architecture frozen
- [ ] Standalone secret-free candidate generated
- [ ] Offline validation passed
- [ ] Device cutover and focused acceptance
- [ ] Main branch release
