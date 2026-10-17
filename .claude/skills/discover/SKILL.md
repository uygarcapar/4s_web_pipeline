---
name: discover
description: Run lead discovery for a sector+district (Places Text Search, hard filters, activity scoring, PSI tiering) and write the Turkish pre-call mini reports.
disable-model-invocation: true
allowed-tools: Read, Write, Bash(pnpm run *), Bash(pnpm --filter *), Grep, Glob
argument-hint: [sector] [district]
---

Discover stage (stage 0, Ek A). Discovery is deterministic — Places API Text
Search with a field mask, hard filters (website present, valid TR phone, not
an aggregator, ≥10 reviews), website-activity scoring (threshold ≥ 5), cheap
heuristics, PSI mobile only for candidates. The single LLM task here is the
pre-call mini report.

1. Run `pipeline discover --sector "$0" --district "$1"` via the
   orchestrator. Output: `leads/<district>-<sector>.csv` + a
   `pending_approval` batch + Telegram summary.
2. For each Tier A lead, write a 5-line TURKISH pre-call note into the leads
   data: business name, the site's 3 most visible gaps (from heuristics, in
   plain language), mobile score, preview link placeholder, suggested opening
   line. Keep each note under 60 words; no invented facts.
3. Leads with `opted_out=true` are never re-contacted or re-crawled
   (6563 / KVKK). Never override hard filters or tiers by hand.
4. The pipeline STOPS here: only `pipeline approve <selection>` moves leads
   into the queue. Do not queue anything from this skill.
