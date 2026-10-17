---
name: notify
description: Send the site-ready WhatsApp notification after verify passes (Meta Cloud API; site_ready utility template, free-form fallback inside the 24h window).
disable-model-invocation: true
allowed-tools: Read, Bash(pnpm run *), Bash(pnpm --filter *)
argument-hint: [domain]
---

Notify stage for `runs/$ARGUMENTS/`. Runs AFTER verify passes — the site is
finished LOCALLY; there is no automatic deploy (docs/DECISIONS.md D1). The
operator reviews the site on their own machine and deploys manually if they
choose. Notification is sent by the orchestrator's own in-process functions
(tokens never enter the model's Bash environment); this skill only triggers
and verifies it.

1. If `runs/$ARGUMENTS/notify/sent.json` exists, stop (idempotency).
2. Trigger the notify stage via the orchestrator. Message content (Turkish):
   business name, old URL, and that the new site is ready for local review —
   e.g. "{{1}} için yeni site hazır. Eski: {{2}} Önizleme:
   `pipeline preview $ARGUMENTS`". If `deploy/url.txt` exists (manual deploy
   already done), append the preview URL.
3. Channel: WhatsApp only (docs/DECISIONS.md D2), Meta Cloud API to
   `OPERATOR_WHATSAPP`. Try the approved `site_ready` utility template
   first; if unapproved/rejected, fall back to a free-form text (succeeds
   only inside the operator's 24h session window). A delivery failure is
   recorded but never fails the run.
4. Confirm `notify/sent.json` records channel, timestamp and message id;
   report delivery status. Never print tokens or phone ids into logs.
