# Quantumult X remote filter management

- Live single bundle: [QX-V2.5-All-Rules.list](QX-V2.5-All-Rules.list) (108 rules at initial publication).
- Source modules: AI/, Media/, International/, Direct/.
- Automated publisher: [publish-qx-rules.yml](../.github/workflows/publish-qx-rules.yml) runs Tools/build_rules.py on source changes.
- Publisher checks syntax, duplicate domains, conflicting policies and unexpected rule-count drops. It only commits the bundle if validation passes.
- GitHub Actions execution and permissions must be confirmed in the repository Actions tab; workflow existence alone does not prove successful automation.
- Mixed-policy bundle uses explicit policy fields: never set force-policy on this subscription.
- Third-party YouTube/GitHub/Telegram and built-in LAN/CN are NOT included in the bundle; keep them enabled until coverage is reconciled.
- Do not upload airport tokens, certificates, private keys or passwords.
