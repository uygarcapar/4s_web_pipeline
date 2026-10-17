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
- Notification channel: see D2 — WhatsApp only, no Telegram.
- Vercel Pro is NOT required until the first commercial manual deploy.
  `VERCEL_TOKEN`/`VERCEL_ORG_ID` stay optional in `.env`.
- PLAN.md sections that assume auto-deploy (§Vercel deploy, preview
  protection flow, notify-after-deploy) are to be read through this lens.
  SITE_PREVIEW noindex/Basic-Auth hardening still applies to any manual
  deploy.

## D2 — WhatsApp Business (Meta Cloud API) only, no Telegram (2026-10-17)

**Decision (operator):** Skip Telegram entirely. All notifications (notify
stage + discover batch summaries) go to the operator over WhatsApp via the
Meta Cloud API test number — free to up to 5 verified recipients, which is
enough for a single operator.

Consequences:
- PLAN.md's "Telegram first, WhatsApp later" sequencing is void.
  `TELEGRAM_*` env vars removed; `NOTIFY_WHATSAPP_ENABLED` flag removed
  (WhatsApp IS the channel).
- Required env: `WA_TOKEN` (permanent System User token with
  whatsapp_business_messaging), `WA_PHONE_NUMBER_ID`, `OPERATOR_WHATSAPP`.
  Optional: `WA_WABA_ID` (template status checks via API).
- Delivery strategy (M2 notify implementation): try the approved Turkish
  `site_ready` utility template first (works unattended, outside the 24h
  window); if the template is not yet approved, fall back to a free-form
  text message, which succeeds only while the operator's 24h session window
  is open (operator can reopen it by messaging the test number). Failures
  are recorded in notify/sent.json and the run is NOT failed over a
  notification error; the event row is enough to surface it in the admin
  panel.
- If WhatsApp delivery proves flaky in practice, a fallback channel can be
  revisited; nothing else in the pipeline depends on the channel choice.

## D3 — Telegram until WhatsApp business verification (2026-10-17)

**Decision (operator):** D2 is suspended, not reversed. Meta permanently
restricted the fresh test WABA ("Hesap Kısıtlandı", duration: permanent)
and the only unlock path it offers is business verification, which requires
a registered company — the operator does not have one yet.

Consequences:
- Interim notification channel: Telegram bot (operator picked it over
  ntfy.sh/e-mail). `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` return to .env.
- The notify stage is written channel-pluggable: `telegram` now, `whatsapp`
  activates once the operator registers a company (şahıs şirketi planned —
  also needed for invoicing/Vercel commercial use), passes Meta business
  verification with the tax certificate, and the `site_ready` template is
  approved. WA_* env vars stay documented but optional until then.
- Discover summaries follow the same channel abstraction.

## D4 — LHCI gate calibration after the first real runs (2026-10-17)

**Decision (operator):** resolves the `TODO(uygar)` in build-rules.md about
LHCI thresholds. Measured on the reference template (static Next.js 16 page,
LHCI simulated Slow 4G + 4x CPU on localhost, median of 3 runs):
performance 0.94–0.96, accessibility 1.0, best-practices 1.0, SEO 1.0, but
LCP swinging 2.7–3.2 s with ±400 ms run-to-run noise.

- `largest-contentful-paint`: hard gate at **3500 ms**, with 2500 ms (the
  field CWV target) kept as a digest recommendation. A 2500 ms hard gate
  would fail every generated site on measurement noise alone and burn the
  3-iteration fix loop.
- Preset: **`lighthouse:recommended`** instead of `lighthouse:no-pwa`. The
  latter asserts every audit at error, making `legacy-javascript-insight`
  (Next.js polyfills) and `network-dependency-tree-insight` (framework chunk
  chain) permanent blockers that a generated site cannot fix from
  site.config.ts / sections / tokens.css.
- The explicit error assertions (category scores, CLS 0.1, script budget
  250 KB) remain the real gates, matching the plan's intent.

Template fixes made while calibrating (all kept):
- Google Maps embed replaced with a click-to-load facade: −476 KB of
  third-party JS off the critical path, and no Google cookies before the
  visitor makes a KVKK choice.
- KVKK consent banner is now server-rendered with a pre-paint script that
  hides it for visitors who already decided (it used to render only after
  hydration and became a ~3.3 s LCP element).
- Fonts pinned to the weights actually used instead of full variable faces.
- Total page weight 873 KB → 375 KB; script 610 KB → 164 KB.
