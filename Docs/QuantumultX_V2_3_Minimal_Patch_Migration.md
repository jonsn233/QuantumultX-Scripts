# Quantumult X V2.3 — migration review and cutover decision

Status: DESIGN / NO PHONE ACTION YET
Date: 2026-11-15

## Critical finding from actual V2.3 candidate
The checked file `Configs/QuantumultX_V2_3_One_Time_Migration_Candidate.conf` contains an intentionally empty `[server_remote]` section. Importing it as a replacement is NOT a no-touch upgrade: the user's private subscription would need restoration and static policy selections may be reset.

## Preferred path: patch the actual working profile, not wholesale replace
1. Leave the working QX V2.1 profile active until final approval.
2. At cutover time export/back up the ACTUAL active QX profile locally.
3. Edit only the minimal necessary `[policy]` lines in a local copy; preserve `[server_remote]`, `[server_local]`, `[dns]`, `[filter_local]`, `[filter_remote]`, `[rewrite_*]`, `[task_local]`, and `[mitm]` unchanged unless an explicitly reviewed change is needed.
4. Keep the same policy names `AI-OpenAI`, `AI-Claude`, `AI-Gemini` to avoid changing routing references.
5. If optional US auto-selection is wanted, insert one `available=AI-US-Auto, server-tag-regex=美国-洛杉矶|美国-纽约|美国-西雅图, check-interval=600` policy and add `AI-US-Auto` as a selectable child of each existing AI static group. Do not silently make auto mode the default.
6. Preserve Claude's currently verified manual US LA02 selection. Policy selection persistence across profile reimport is not guaranteed: verify it once at cutover.
7. Do not publish or paste the active profile with subscription URLs, MITM passphrases, or p12 to a public GitHub repository. Work from a local redacted copy or a minimal [policy] excerpt.
8. Avoid repeating already completed DNS, streaming, LAN, or script tests. One short post-change check: subscription visible, AI-Claude still LA02, AI-OpenAI/Gemini selected as intended, one AI routing request, no unintended DIRECT.
9. If policy syntax rejected, subscription missing, or routing fails, immediately restore the untouched backup.

## What this does not promise
- Editing a local copy is still a profile change and may affect stored strategy selections. The workflow minimizes changes but cannot guarantee zero manual reselection.
- A single `available` group cannot guarantee strict LA02-first priority, per-service application health, or automatic cross-region fallback.
- `AI-US-Auto` can change exit IP. It must be opt-in, not default.

## Pre-cutover gate
Need the currently active policy block and a local backup confirmation. For safe review, request ONLY the `[policy]` block with any secrets removed; never ask for a full raw profile or subscription token in chat.

## Rollback
Keep original V2.1 profile locally, restore it if needed; no GitHub main merge before device acceptance.
