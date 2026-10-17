---
name: notify
description: Send the site-ready notification after verify passes (WhatsApp preferred, Telegram until the Meta template is approved; Telegram fallback on failure).
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
3. Channel order: WhatsApp Meta Cloud API utility template when
   `NOTIFY_WHATSAPP_ENABLED=true` (operator's preferred channel); otherwise —
   and on any WhatsApp failure — fall back to Telegram (`TELEGRAM_CHAT_ID`).
4. Confirm `notify/sent.json` records channel, timestamp and message id;
   report delivery status. Never print tokens or chat ids into logs.
