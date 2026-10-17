# Decision log

Amendments to docs/PLAN.md. Where they conflict, this file wins.

## D1 — Local-first delivery, manual Vercel deploy (2026-10-17)

**Decision (operator):** The pipeline does NOT auto-deploy to Vercel. A
finished site stays local; the operator reviews it on their own machine and
pushes to Vercel manually only when needed (cost: avoid paying Vercel for
every demo).

Consequences:
- Automatic stage chain is `crawl → audit → plan → generate → verify →
  notify`. `deploy` remains implemented but is manual-only:
  `pipeline deploy <domain>` (still hard-gated on `.pipeline/verify-passed`).
- `notify` fires after `verify` passes, not after deploy. Message (Turkish):
  site is ready locally + how to preview it. If a deploy happened, the
  preview URL is appended.
- Local preview: `pipeline preview <domain>` (Milestone 2) serves the built
  site from `runs/<domain>/generate/` on a local port.
- Notification channel: WhatsApp is the operator's preferred channel.
  Until the Meta Cloud API app + `site_ready` utility template are approved,
  Telegram is used; WhatsApp switches on via `NOTIFY_WHATSAPP_ENABLED=true`
  with Telegram as fallback (unchanged from PLAN.md).
- Vercel Pro is NOT required until the first commercial manual deploy.
  `VERCEL_TOKEN`/`VERCEL_ORG_ID` stay optional in `.env`.
- PLAN.md sections that assume auto-deploy (§Vercel deploy, preview
  protection flow, notify-after-deploy) are to be read through this lens.
  SITE_PREVIEW noindex/Basic-Auth hardening still applies to any manual
  deploy.
