# Quantumult X V2.5 — 359-rule release handover

Released: 2026-11-20. Release file: [QX-V2.5-359-Rules.list](QX-V2.5-359-Rules.list).

## Release controls
- Release is a reviewed **snapshot** of the 359-rule merged candidate already loaded and tested on device.
- The previously active 108-rule `Rules/QX-V2.5-All-Rules.list` remains unchanged; its automatic publisher continues to own that path.
- The 359-rule release path is deliberately **not** managed by the old 108-rule builder.
- Do not add a second enabled subscription to the same ruleset: use **one** of the candidate or release resources, not both.
- Keep old QX-All-Rules, YouTube-Remote, GitHub-Remote, Telegram-Remote disabled as rollback until the release resource is confirmed on device.
- Keep LAN and CN built-in direct resources enabled.
- Existing static AI node selections and airport subscription are not changed by this release.

## Device switch (only when convenient)
1. Export the current working QX config as backup.
2. Add the release URL below as a remote filter resource, initially **disabled**, and update it:
   https://raw.githubusercontent.com/jonsn233/QuantumultX-Scripts/main/Rules/Releases/QX-V2.5-359-Rules.list
3. After successful download, **disable** QX-V2.5-Test and **enable** the new release resource. Do not enable both.
4. Spot-check chatgpt.com -> AI-OpenAI, claude.ai -> AI-Claude, gemini.google.com -> AI-Gemini, baidu.com -> DIRECT in network activity.
5. If anything breaks, disable the release resource and re-enable QX-V2.5-Test. The tested candidate remains available.

## Scope
Seven representative policy matches were verified in QX request records. This is not an audit of every rule, DNS/IPv6 leaks, or the stability of actual public egress IPs. Public GitHub files must not contain proxy subscription tokens, credentials or private configuration.
