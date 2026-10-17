---
name: notify
description: Send the site-ready notification for a deployed domain (Telegram first; WhatsApp utility template behind a feature flag, with Telegram fallback).
disable-model-invocation: true
allowed-tools: Read, Bash(pnpm run *), Bash(pnpm --filter *)
argument-hint: [domain]
---

Notify stage for `runs/$ARGUMENTS/`. Notification is sent by the
orchestrator's own in-process functions (tokens never enter the model's Bash
environment); this skill only triggers and verifies it.

1. If `runs/$ARGUMENTS/notify/sent.json` exists, stop (idempotency).
2. Trigger the notify stage via the orchestrator. Message content (Turkish):
   business name, old URL, new preview URL — the approved `site_ready`
   template shape: "{{1}} için yeni site hazır. Eski: {{2}} Yeni: {{3}}".
3. Channel order: WhatsApp Meta Cloud API utility template only when
   `NOTIFY_WHATSAPP_ENABLED=true`; otherwise — and on any WhatsApp failure —
   fall back to Telegram (`TELEGRAM_CHAT_ID`).
4. Confirm `notify/sent.json` records channel, timestamp and message id;
   report delivery status. Never print tokens or chat ids into logs.
