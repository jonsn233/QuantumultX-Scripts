# Quantumult X V2.4 — Device Acceptance and Maintenance Baseline

Date: 2026-11-15
Status: DEVICE ACCEPTED FOR AI ROUTING; NO FULL-PROFILE PUBLIC RELEASE

## Evidence supplied by user
- User backed up their working QX V2.1 profile.
- User replaced only the active [policy] section with the V2.4 strategy block, preserving their private airport subscription.
- Claude manually pinned to US Los Angeles 02; prior Claude IP Guard v19 evidence confirmed a US egress at that time.
- OpenAI and Gemini benchmark groups both initially selected Singapore 01 in user screenshots.
- User subsequently manually pinned both AI-OpenAI and AI-Gemini to Singapore 01.
- User confirmed both ChatGPT and Gemini work after the pin.
- Earlier LAN, streaming, DNS, IPv6 acceptance remains unchanged by this policy-only patch; no retesting requested.

## Effective policy behavior
- AI-Claude: static manually pinned US Los Angeles 02.
- AI-OpenAI: static manually pinned Singapore 01.
- AI-Gemini: static manually pinned Singapore 01.
- AI-OpenAI-Speed / AI-Gemini-Speed: remain defined as optional latency benchmark alternatives, not currently selected.
- Generic Intl-Auto retains original availability behavior.
- Static pinning prevents QX's latency benchmark from automatically selecting a different node for these three AI parent groups, but does not guarantee an unchanged public egress IP because the provider may change its exit.

## Maintenance and privacy
- No automated switching scripts or new MitM rules.
- Claude IP Guard v19 is a read-only on-demand monitor; its historical observations are not continuous monitoring.
- No private subscription URL, certificate, or passphrase is stored in this document.
- If AI service fails: first check selected parent policy and node availability; only then consider manually changing the service-specific node. Do not globally modify DNS or reinstall profile.
- Do not re-run already passed LAN, streaming, DNS, or IPv6 tests unless symptoms or configuration change.
- Maintain the local original profile backup. For rollback, restore it locally and verify AI policy selections.
- Review exit IP only when changing nodes or when account access symptoms arise; avoid unnecessary repeated probes.
- The V2.4 full reference candidate in GitHub has an empty [server_remote] and MUST NOT replace the active private profile.
- Do not merge experimental full-profile candidates into main as a ready-to-import release. A sanitized policy-only snippet and this acceptance record are the appropriate public artifacts.

## Outstanding limitations
- No long-term proof of stable IP or provider-side exit IP assignment.
- QX latency benchmarking does not measure real throughput or AI app-level availability.
- Existing DNS leak-test observations are mixed and not definitively resolved; no DNS settings changed during this release.
