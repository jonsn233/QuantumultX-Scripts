# Quantumult X V2.1 — Candidate status

2026-11-15: standalone candidate generated from the user's latest `qx 001.conf`, retaining 122 local routing rules and 11 policy groups. Original secrets were deliberately **not** copied.

## Build changes
- Three independent manually pinned AI policy groups; generic international traffic retains `available=Intl-Auto`.
- Removed hard-coded single-node labels from `Intl-General` / `Intl-Google` to reduce node-name mismatch.
- Removed private subscription URL, MitM certificate/passphrase and third-party Spotify rewrites.
- Retained only the accepted Claude IP Guard v19.0 UIAction.
- Kept existing DNS baseline and remote rule URLs for the first cutover; do not change DNS and routing simultaneously.

## Gate results
- Static section and unique policy checks: PASS.
- Secret and MitM removal: PASS.
- Real-device subscription binding, remote rule downloads, DNS behavior and failover: NOT TESTED.
- **No automatic AI failover**; this is a conscious egress-stability choice, not a missing claim.
- Do not activate the candidate until the private subscription has been added locally and nodes are visible.

## Device steps (only after file is available)
1. Export the working QX profile as an offline backup.
2. Import candidate as a separate profile. Keep the old profile active.
3. Add the rotated private node subscription **locally**, update nodes and verify AI group membership.
4. Switch to candidate; verify one AI exit with Claude IP Guard v19, one domestic DIRECT, one LAN access, and general internet.
5. On any critical failure switch back to the backed-up profile; do not debug the live profile in place.
