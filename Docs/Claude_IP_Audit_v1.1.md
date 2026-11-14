# Claude IP Audit v1.1 — diagnostic candidate

Status: locally tested; Quantumult X device acceptance pending. This is not a claim that the reported device failure is fixed.

## Observations and changes

Safari success does not establish what QX received. A TCP route record establishes neither the HTTP status nor JSON body. v1.0's request options match the upstream QX sample, but `response.body || ""` collapses missing/empty bodies and its parser reports only `invalid JSON`.

v1.1 retains the IPv4/IPv6-only ipify endpoints and ipwho.is enrichment. It uses QX's documented `statusCode`, `headers`, `body` response interface, GET with Accept: application/json, no request body and no custom User-Agent. Certificate verification, redirects and auto-cookie:false remain explicit. It does not force a policy or alter routing, proxies or MitM. QX builds before 934 may ignore auto-cookie:false; use a current QX build for cookie isolation.

Diagnostics record status code, an allowlisted Content-Type category, JS body type and body length in characters (not bytes). Errors distinguish NETWORK_ERROR, NETWORK_TIMEOUT, HTTP_ERROR, EMPTY_RESPONSE, RESPONSE_TYPE_ERROR, RESPONSE_ERROR, JSON_ERROR, JSON_SCHEMA_ERROR and IP_FAMILY_ERROR. A decoded leading BOM is removed before JSON parsing. IP family syntax is checked before enrichment.

Each request has a 12-second application deadline. This settles the task's promise but cannot cancel the underlying QX request; late results are ignored. Two parallel detection requests followed by parallel enrichment can take roughly 24 seconds; QX's script execution limit must allow this. IPv6 failure alone never proves IPv6 is disabled.

## Privacy and execution

Only event-interaction manual execution is intended. No Cron, notifications, persistence or configuration writes are added. Keep the existing task type and change only its script URL to v1.1.

api.ipify.org and api6.ipify.org observe the source public IP. ipwho.is receives the detected IP in the lookup URL. Existing public-IP and provider metadata results remain in console output. No account identifiers, tokens, Cookie or Authorization headers are supplied. Diagnostic logging never prints response bodies, arbitrary headers, URLs or raw fetch/parser rejection messages. This deliberately avoids a body preview that could expose secrets. Endpoint/provider data remains untrusted and geolocation/ASN estimates do not predict account acceptance.

Upstream request interface: https://github.com/crossutility/Quantumult-X/blob/master/sample-task.js

## Local validation — 2026-11-15 (Asia/Shanghai)

Node.js v24.22.1: syntax check passed. VM-based QX mocks passed 18 scenarios/checks covering dual-stack success with enrichment, BOM, HTTP 403, five empty-body variants, HTML, malformed JSON, non-text body, absent status, missing IP, wrong family, rejected and synchronous fetch errors, deadline, and provider failure. IPv6 valid/invalid address assertions also passed. A secret sentinel in response headers, invalid bodies and rejection objects was absent from logs. Requests were checked for GET, Accept-only headers, cookie isolation, certificate verification and no policy/body override. Source check found no notification, persistence, configuration mutation API or Cron.

Run from repository root:

    node --check Scripts/Claude/Claude_IP_Audit_v1.1.js
    node Tests/Claude_IP_Audit_v1.1.test.cjs

These are controlled mocks, not live endpoint or QX device tests. Device version/build: not available. Device validation: not performed.

## Device acceptance and rollback

Run manually in QX and retain the IPv4/IPv6 diagnostic lines plus error category. Record QX version/build and test time. Compare returned addresses with independent checks. Do not share tokens, cookies, subscription URLs or raw headers. A new JSON_ERROR indicates actual QX response investigation is still needed; MIME/status/length may narrow the cause without exposing the body.

Rollback: point the existing manual task back to Claude_IP_Audit_v1.0.js. v1.0 is preserved unchanged.
