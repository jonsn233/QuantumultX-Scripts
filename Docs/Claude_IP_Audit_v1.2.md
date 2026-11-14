# Claude IP Audit v1.2

Status: local automated tests passed; v1.2 Quantumult X device acceptance pending.

## Evidence and change

Reported device evidence for v1.1: IPv4 HTTP 200, Content-Type text/plain, string body of 15 characters, JSON failure; IPv6 NETWORK_ERROR. The actual response body was not provided. This response shape is consistent with a plain IP but does not prove its contents.

v1.2 preserves v1.1's endpoints, request options and diagnostics. IP detection first attempts JSON parsing. Successful JSON must be an object with a string `ip` field, whose address family is validated; invalid JSON schemas never trigger text fallback. Only JSON syntax failure allows a plain-text fallback, and only if the entire body (after surrounding whitespace/BOM removal) is a valid IPv4 or IPv6 literal. The literal must match the requested family. No substrings are extracted. Content-Type is diagnostic, not grounds for accepting content. Enrichment remains JSON-only.

Strict validation rejects IPv4 leading zeros and out-of-range octets, internal whitespace, invalid IPv6 compression/group counts, ports, brackets, CIDR suffixes and IPv6 zone IDs. Public-IP endpoint responses are syntax checked, not classified for global routability. Plain text accepted successfully is logged as `IP format=text validated`, without a spurious JSON_ERROR. Rejected non-JSON/non-IP content remains JSON_ERROR; invalid JSON schema and unexpected address family retain JSON_SCHEMA_ERROR and IP_FAMILY_ERROR.

IPv4 and IPv6 failures are captured separately. IPv6 network failure leaves successful IPv4 detection and enrichment intact. The parallel detection stage can wait up to the existing 12-second per-request deadline before enrichment. Deadlines do not cancel underlying QX requests; late results are ignored.

## Privacy and execution

Use only the existing event-interaction manual task, changing its script URL to v1.2. No Cron, proxy, DNS, routing, MitM, notification, storage or configuration mutation is added. No credentials, Cookie or Authorization headers are supplied or logged. Logs retain HTTP status, allowlisted MIME category, body type and length in characters. Raw response bodies, arbitrary headers and native fetch/parser errors are withheld. Existing output includes public IPs and provider metadata.

Endpoints unchanged: api.ipify.org (IPv4), api6.ipify.org (IPv6), ipwho.is (enrichment). Each provider observes the source IP; ipwho.is additionally receives the detected address in its lookup URL. auto-cookie:false depends on QX build 934+; older builds can ignore it. Metadata is approximate, not an account acceptance prediction.

## Automated validation — 2026-11-15, Asia/Shanghai

Node.js v24.22.1 syntax check and VM-based QX mocks passed before commit. Coverage:

- JSON dual stack, BOM and enrichment; JSON accepted with text/plain MIME.
- Plain-text IPv4 and IPv6, surrounding whitespace/BOM.
- Reported 15-character text IPv4 response shape with IPv6 network rejection: exactly three requests, including successful IPv4 enrichment; no JSON_ERROR.
- HTML/error pages containing IPs, malformed JSON, multiple addresses, JSON scalars/arrays/error envelopes rejected.
- HTTP 403/429/500 errors, including IP-looking error bodies, cannot trigger fallback.
- Empty bodies, wrong body types, missing status/IP, wrong family, synchronous/rejected fetch errors, timeout and provider lookup failure.
- Table-driven valid/invalid IP cases checked against Node's independent net.isIP oracle (scoped IPv6 deliberately rejected even though Node accepts it).
- Sensitive sentinel absent from console logs; GET/Accept-only headers, certificate verification, auto-cookie:false and no policy/body override asserted.
- No notification, persistence, configuration mutation or Cron APIs; enrichment remains JSON-only.

Run from repository root:

    node --check Scripts/Claude/Claude_IP_Audit_v1.2.js
    node Tests/Claude_IP_Audit_v1.2.test.cjs

Tests use synthetic addresses, not the user's actual IP. No live endpoint or v1.2 QX device test was performed. QX version/build unavailable. Simulated tests are not device acceptance and do not establish the cause of IPv6 NETWORK_ERROR.

## Device acceptance and rollback

Run v1.2 manually in QX, record version/build and time, and check the HTTP diagnostics, validated format and enrichment. IPv6 failure alone does not prove IPv6 is disabled. Do not share credentials or raw headers. v1.0/v1.1 are unchanged; rollback by restoring the previous script URL in the existing manual task.
