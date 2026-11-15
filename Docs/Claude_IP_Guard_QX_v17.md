# Claude IP Guard QX v17.0

## Status

- Branch: \`feature/claude-ip-guard-v17-node-aware\`
- Implementation: created; not yet accepted on a real Quantumult X device.
- v16A and the default branch are unchanged.
- Automated mock tests are included but must be run with Node.js before release.

## What changed

v17 uses Quantumult X's documented UIAction parameter flow:

1. Add the script as an \`event-interaction\` task.
2. Long-press an individual server node in the Quantumult X node list.
3. Quantumult X supplies the selected server tag in \`$environment.params\`.
4. v17 passes that exact value as \`opts.policy\` on every request.

There is deliberately no default policy. If the script receives no node tag, it stops before making a network request.

The script requests IPv4 from api.ipify.org and ipv4.icanhazip.com through the selected node. It only performs the ipwho.is metadata lookup when both providers return the same valid IPv4 address. History is stored locally through QX preferences, separately for each node tag, and only after dual-source agreement.

## Add to Quantumult X

Add this line to \`[task_local]\` (or add the same event-interaction task through the QX UI):

\`\`\`ini
event-interaction https://raw.githubusercontent.com/jonsn233/QuantumultX-Scripts/feature/claude-ip-guard-v17-node-aware/Scripts/Claude/Claude_IP_Guard_QX_v17.js, tag=Claude IP Guard v17, img-url=shield.lefthalf.filled, enabled=true
\`\`\`

Do not remove or replace the existing v16A task yet. Keep both versions available during acceptance.

## Acceptance procedure

1. Confirm the QX Tunnel is running and the task switch is enabled.
2. Long-press one individual server node (not a policy group) and run Claude IP Guard v17.
3. In QX Activity, verify each request marked \`FETCH\` is routed through the exact selected node tag.
4. Confirm the two IP providers agree. If they disagree, v17 must show "无法确认" and must not save history or call ipwho.is.
5. Long-press a second node and repeat. The displayed selected tag must change and each request must show the second node.
6. Repeat the first node. Its history should remain separate from the second node's history.

## Rollback

Disable or remove only the v17 event-interaction task. v16A and the default branch remain untouched.

## Scope and limitations

- IPv4 only in this first node-aware release; IPv6 is intentionally deferred.
- This measures the egress IP observed by two public echo services, not an IP attested by Anthropic/Claude.
- Country, ASN, ISP and network type are third-party estimates.
- It does not calculate account-ban probability or guarantee account acceptance.
- The providers receive the request source IP; ipwho.is additionally receives the IP being looked up.
- The local history stores only IP addresses and timestamps keyed by node label.
- QX device/build acceptance is still required. Mock tests do not prove runtime compatibility or actual routing.

## Automated tests

From the repository root:

\`\`\`sh
node --check Scripts/Claude/Claude_IP_Guard_QX_v17.js
node Tests/Claude_IP_Guard_QX_v17.test.cjs
\`\`\`

The tests mock QX APIs and verify policy propagation, two-source agreement, fail-closed behavior when no node tag is supplied, and absence of hard-coded AI-Claude routing.
