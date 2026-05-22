# Production Readiness Decision - 2026-05-18

## Decision

Local code and release gate: Go.

Controlled staging/internal hardening: Conditional Go.

Controlled pilot expansion: Conditional Go for existing scoped pilot users and
flows with sanitized evidence.

Broad production rollout: No-Go.

This is a decision packet, not approval to widen rollout. It summarizes the readiness slices merged through PR #239 and names the remaining evidence that must be captured outside source control.

2026-05-22 update:

- Fresh Clerk controlled-pilot persona/token/action evidence is now recorded in
  `docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-22.md`.
- The current blocker refresh is recorded in
  `docs/evidence/readiness/2026-05-22-production-evidence-blockers-v2.md`.
- Broad production rollout remains No-Go until Redis/BullMQ health, Supabase
  restore, external alert delivery or accepted log-retention evidence,
- protected-route load budgets, and any owner-required future role delegation
  are proven or explicitly accepted under a narrower rollout decision.
- Import/upload evidence for the current controlled pilot is accepted through
  the existing `SUPER_ADMIN` pilot session; dedicated `INTEGRATION_ADMIN`
  evidence is no longer required for pilot continuation. See
  `docs/plans/import-upload-authorization-decision-v1.md`.

## Current Baseline

- Latest main merge reviewed: PR #239, merge commit `c69b7cf24605e9b65b7215f6557f74174dd6364b`.
- Main `Release Check` passed after the PR #239 merge.
- Staging public deploy smoke exists and passed for frontend root, SPA fallback, backend health, rate-limit headers, correlation id, and static assets.
- Staging backend public load smoke exists and passed for public API health with availability `100%`, p50 `132.23ms`, p95 `224.59ms`, and 5xx count `0`.
- Protected route performance and authenticated session evidence remain blocked because no real staging role-specific bearer tokens were available.
- Supabase direct frontend access remains guarded closed by the backend-owned data boundary.

## Slice Summary

| Slice | Status | Evidence | Remaining risk |
| --- | --- | --- | --- |
| 1. Deployed Readiness Smoke | Merged PR #228 | `docs/evidence/readiness/2026-05-18-staging-deploy-smoke.md` | Auth/session was skipped without a real bearer token. |
| 2. Edge Security Headers | Merged PR #229 | Vercel/header contracts and deployed smoke checks | HSTS preload remains a later owner decision. |
| 3. Observability V1 | Merged PR #230 | `docs/evidence/readiness/2026-05-18-staging-observability-deploy-smoke.md` | External error tracking provider or log-retention destination is not configured in source evidence. |
| 4. Alerting and Incident Evidence | Merged PR #231 | `docs/evidence/readiness/2026-05-18-alert-routing-smoke.md` | External alert delivery provider remains operator-configured outside the repo. |
| 5. Redis-Backed Rate Limit | Merged PR #232 | Config/tests/checklist gates | Controlled pilot can use memory; broad production requires Redis-backed rate limiting. |
| 6. Queue Durability Gate | Merged PR #233 | Health/config/tests/checklist gates | Controlled pilot can use process-local queue; broad production durable work requires BullMQ/Redis evidence. |
| 7. Backup/Restore Live Drill | Merged PR #234 evidence gate | `docs/evidence/readiness/2026-05-18-supabase-staging-restore-drill.md` | Supabase staging restore into a disposable target has not been executed. |
| 8. Upload Resource Guardrails | Merged PR #235 and review fixes PR #236 | Upload guardrail tests, release gate, and 2026-05-22 live proof pass | Current pilot upload/readback evidence is closed with the existing `SUPER_ADMIN` pilot session; future HR admin delegation would need a separate auth PR. |
| 9. Performance Budget Pass | Merged PR #239 | `docs/evidence/readiness/2026-05-18-staging-backend-readiness-load-smoke.md` | Store, competition, import, and auth/session route budgets need real role-specific staging tokens. |
| 10. Supabase Boundary Guard | Merged PR #238 | `scripts/supabase-boundary-guard.test.mjs` | Direct Supabase client access stays blocked until RLS/policy work is explicitly designed and tested. |
| 11. Env/Secret Drift Guard | Merged PR #237 | `scripts/readiness-env-contract.test.mjs` and deployment docs | Live Render/Vercel secret values remain manually verified outside source control. |
| 12. Final Go/No-Go Readiness Packet | This packet | This document and contract guard | Decision must be revised after external evidence lands. |

## Go / Conditional Go / No-Go

Go:

- Local implementation quality and release gate for the current codebase.
- Public staging deploy shape for health, frontend shell, API JSON correctness, rate-limit headers, and correlation id.
- Backend-owned Supabase boundary in committed frontend code.
- Env inventory and secret/public classification in committed docs/examples.

Conditional Go:

- Continue controlled internal hardening in staging without adding broad users.
- Continue controlled pilot preparation only when evidence is sanitized and the scope is not widened.
- Keep Power BI/Excel as the active operating source and keep JSON source work suspended.

No-Go:

- Broad production rollout.
- Controlled pilot expansion to new users until real staging auth/action smoke, protected route performance tokens, and current pilot operator evidence are available.
- Treating Supabase backup/restore readiness as proven before a disposable restore drill is completed.
- Treating process-local queue or memory rate limit as broad-production safe without Redis/BullMQ evidence.
- Treating HR admin import/upload delegation as real before a scoped auth PR and regression tests exist.

## Required Next Evidence

1. Protected route load smoke with fresh role-specific staging tokens when the
   next pilot or scale decision requires updated load budgets:
   - `BACKEND_LOAD_SESSION_TOKEN`
   - `BACKEND_LOAD_STORE_TOKEN`
   - `BACKEND_LOAD_COMPETITION_TOKEN`
   - `BACKEND_LOAD_IMPORT_TOKEN`
2. Supabase staging restore drill into an approved disposable target.
3. Alert/error-tracking destination proof or accepted log-retention provider evidence.
4. Broad-production Redis/BullMQ decision and health evidence if import/snapshot durability is required.
5. If import/upload ownership shifts away from `SUPER_ADMIN`, define the target role and capture a new sanitized upload/readback smoke after the scoped auth change.

## Safety

- No bearer token, cookie, authorization code, PKCE verifier, client secret, private key, database URL, Redis URL, or production credential is recorded here.
- No production database was touched by this packet.
- This packet summarizes source-controlled evidence; provider console values and live secrets must remain outside the repo.
