---
name: deploy
description: Deploy a verified site to Vercel (REST project create + CLI deploy) and verify preview protection headers.
disable-model-invocation: true
allowed-tools: Read, Bash(pnpm run *), Bash(vercel *), Bash(curl -I *), Grep
argument-hint: [domain]
---

Deploy stage for `runs/$ARGUMENTS/`. Hard precondition: the
`.pipeline/verify-passed` marker must exist — the deploy-gate hook blocks
`vercel` otherwise. Do not look for ways around the gate.

1. If `runs/$ARGUMENTS/deploy/url.txt` exists, report the existing preview
   URL and stop (idempotency).
2. The orchestrator creates the Vercel project via REST
   (`POST /v11/projects`, name = URL-safe unique slug) and stores
   `deploy/project.json`; deploy with `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID`
   exported together and `vercel deploy --prod --yes` from the site working
   copy. stdout is the deployment URL; write it to `deploy/url.txt`.
3. `SITE_PREVIEW=1` must be set on the project before deploy (noindex +
   Basic-Auth + draft band).
4. Verify protection after deploy: `curl -I <url>` must show
   `X-Robots-Tag: noindex, nofollow` and a 401 without credentials.
   A missing noindex header is a FAILURE — report it, do not continue.
5. Never run `vercel link` or `vercel project inspect` in an unlinked
   directory (silent wrong-project risk). `vercel ls` / `vercel whoami` are
   safe.
