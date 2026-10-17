# Vendored skills

These skill folders are copied verbatim from upstream repos, pinned to the
commits below, and committed to this repo (no live marketplace dependency).
To update: re-clone upstream, diff, copy, and update the pins here.

| Skill | Upstream | Pinned commit | Vendored on |
|---|---|---|---|
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) `skills/frontend-design` | `dbd4588f9e1033efb41dad4bef2f7947c8993d44` | 2026-10-17 |
| `webapp-testing` | anthropics/skills `skills/webapp-testing` | `dbd4588f9e1033efb41dad4bef2f7947c8993d44` | 2026-10-17 |
| `skill-creator` | anthropics/skills `skills/skill-creator` | `dbd4588f9e1033efb41dad4bef2f7947c8993d44` | 2026-10-17 |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/web-design-guidelines` | `063bee94c3f4df8453406c830b0a7df0f2860278` | 2026-10-17 |
| `react-best-practices` | vercel-labs/agent-skills `skills/react-best-practices` | `063bee94c3f4df8453406c830b0a7df0f2860278` | 2026-10-17 |

Deliberately NOT vendored:
- `vercel-optimize` (vercel-labs/agent-skills): it is a cost/observability
  audit for already-deployed Vercel projects (requires live production
  metrics), not a Next.js code-performance skill. `react-best-practices`
  covers the performance rules used by `build-rules.md` and `fix-agent`.
  Revisit if we later want post-deploy cost audits.

Licenses: anthropics/skills folders carry their own LICENSE.txt;
vercel-labs/agent-skills is MIT (see upstream repo).
