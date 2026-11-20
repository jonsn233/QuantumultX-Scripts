# V2.7 exact two-source review: run 44731338701

**Source:** downloaded Actions artifact `14626776073`, `QX-CN-A-Exact-MultiSource-QUEUE-REVIEW-ONLY.csv` (21 records). Two exact source matches: OISD small and AdGuard DNS. All entries were `PENDING_REVIEW` / `NOT_TESTED`.

**Decision:** No domains approved; no production or pilot changes; do not subscribe to this document. These are *triage hypotheses*, not verified safe domains. External feeds may share upstream provenance.

## Extra compatibility scrutiny (5)

| Domain | Reason to investigate |
|---|---|
| \`ad.linksynergy.com\` | Affiliate tracking and referral redirects may be affected |
| \`ad.mox.tv\` | Video-platform dependencies not established |
| \`ad.zijieapi.com\` | Potential domestic app / ByteDance service interactions |
| \`ads-pixiv.net\` | Pixiv platform behavior not tested |
| \`ads.nicovideo.jp\` | Niconico platform behavior not tested |

## Remaining candidates (16): ordinary audit priority, not approved

- \`ad-back.net\`
- \`ad-balancer.net\`
- \`ad-flow.com\`
- \`ad-maven.com\`
- \`ad-score.com\`
- \`ad-server.co.za\`
- \`ad-srv.net\`
- \`ad.aloodo.com\`
- \`ad4m.at\`
- \`adclick.pk\`
- \`ads1-adnow.com\`
- \`ads2ads.net\`
- \`ads3-adnow.com\`
- \`ads5-adnow.com\`
- \`adx1.com\`
- \`ads.feelingtouch.com\`

## Required before a test proposal

1. Check each domain against protected services, first-party app endpoints, and existing V2.5/V2.6 rules; avoid blanket parent-domain blocks.
2. Assess actual network requests and failure symptoms, especially login, payment, video playback, app startup, and deep links.
3. Prepare a separate opt-in, easily reversible test file only after review; never change active rules automatically.
4. Record per-domain decision and rollback evidence. A dual-feed match alone is insufficient.
