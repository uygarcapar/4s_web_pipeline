---
name: audit
description: Run the deterministic audit stage (Lighthouse + axe + rule checks) for a domain and write the Turkish customer narrative from issues.json.
disable-model-invocation: true
allowed-tools: Read, Write, Bash(pnpm run *), Bash(pnpm --filter *), Grep, Glob
argument-hint: [domain]
---

Audit stage for `runs/$ARGUMENTS/`. Measurement is deterministic (Lighthouse
13 node module, axe, rule checks → `audit/issues.json` with `title_tr`,
`audit/facts.json`); the only LLM work here is the Turkish narrative.

1. If `runs/$ARGUMENTS/audit/issues.json` exists, skip measurement
   (idempotency).
2. Otherwise run the audit stage via the orchestrator and confirm it produced
   `issues.json` (schema: id, category, severity, title, title_tr, evidence,
   affected_urls, fix, effort, business_impact, source_tool, confidence) and
   `facts.json`.
3. Write `runs/$ARGUMENTS/audit/report.tr.md` — a one-page TURKISH customer
   narrative from issues.json: at most 5 critical findings, the mobile
   Lighthouse median (state tool, version, device profile, median of ≥3
   runs), KVKK status, NAP consistency. Plain language, no jargon, honest
   about measurement variance.
4. Severity is bound to measurement, not opinion: critical = legal risk or
   conversion blocker (no tel/WhatsApp on mobile); high = CWV "poor", axe
   critical/serious, missing LocalBusiness, NAP mismatch.
5. Never edit issues.json severities or measurements by hand.
