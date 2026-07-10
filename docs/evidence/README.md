# Evidence Register

Status: active evidence index

## Reader And Action

Reader:

- a future agent, support operator, QA operator, or product owner checking
  whether a claim is backed by local tests, public staging, protected staging,
  provider proof, or docs-only decision evidence.

After reading, they should know which evidence folder to use and what not to
claim from each evidence class.

## Evidence Classes

| Class | Means | Cannot Prove |
| --- | --- | --- |
| `local_test` | A local unit, integration, Playwright, script, build, or release check passed. | Provider delivery, real Clerk session, production readiness. |
| `public_staging` | A public URL or unauthenticated staging endpoint returned expected health/availability. | Role-specific auth, protected data, command authorization. |
| `protected_staging` | A real scoped session/token proved route, endpoint, scope, or command behavior. | Broad production unless rerun under final release posture. |
| `provider_proof` | Render, Vercel, Supabase, Redis, Better Stack, or another provider produced sanitized evidence. | App behavior outside the provider signal. |
| `docs_decision` | A decision was recorded and linked. | Runtime behavior by itself. |
| `historical` | Kept for reconstruction. | Current direction unless an active document points to it. |

## Folders

### Pilot Readiness

Folder: `docs/evidence/pilot-readiness/`

Use for controlled pilot sessions, persona route checks, Store Action command
proof, pilot issue closure, and pilot continue/pause decisions.

Current anchors:

- `2026-05-05-controlled-pilot-feedback-log.md`
- `2026-05-23-assisted-persona-rehearsal-v1.md`
- `2026-05-23-store-action-command-live-proof-v1.md`

### Readiness

Folder: `docs/evidence/readiness/`

Use for production/readiness decisions, Redis/BullMQ, alerting, restore,
deployed readiness, performance/load, and provider posture.

Current anchors:

- `2026-05-18-production-readiness-decision.md`
- `2026-05-23-external-evidence-closure-decision-v1.md`
- `2026-05-23-redis-production-posture-v1.md`
- `2026-05-23-supabase-recovery-posture-v1.md`
- `2026-05-23-alert-email-policy-decision-v1.md`
- `2026-06-12-browser-session-staging-evidence.md`
- `2026-06-12-browser-session-staging-evidence-blocked.md`
- `2026-06-12-security-launch-blocker-pr-train-closeout.md`

### System Flow

Folder: `docs/evidence/system-flow/`

Use for generated route/API/backend flow analysis, unlinked endpoint
classification, role/scope overlays, fanout audits, and Clerk persona protected
evidence.

Current anchors:

- `clerk-persona-live-evidence-2026-05-23.md`
- `clerk-region-manager-live-evidence-2026-05-23.md`
- `auth-role-scope-overlay-v1.md`
- `fanout-bottleneck-audit-v1.md`

### Product Progress

Folder: `docs/evidence/product-progress/`

Use for product-readiness, copy clarity, UI/UX V1, and operations-surface
evidence. Do not treat these as broad redesign approval.

Current anchors:

- `docs/evidence/product-progress/2026-05-24-daily-command-brief-v1.md`
- `docs/evidence/product-progress/2026-05-24-command-chain-reason-helper-v1.md`
- `docs/evidence/product-progress/2026-05-24-internal-change-visibility-v1.md`
- `docs/plans/internal-change-visibility-operating-model-v1.md`

### Performance

Folder: `docs/evidence/performance/`

Use for performance snapshots and budgets when a measured performance question
exists.

Current anchor:

- `2026-07-10-e2e-worker-concurrency-a3.md` - measured CI E2E worker decision
  and rollback boundary.

## Evidence Safety Rules

Do not record:

- raw bearer tokens,
- Clerk cookies,
- passwords,
- provider subjects,
- full JWT payloads,
- database URLs,
- Redis URLs,
- provider tokens,
- private keys,
- private personal data,
- private payloads.

When evidence needs a real secret or provider panel, record the blocker or the
sanitized result. Never record the secret itself.

## Current Decision Boundary

Controlled pilot:

- evidence is strong enough for `Conditional Go / Continue`.

Broad production:

- still `No-Go` until the remaining Redis, alerting, recovery, provider, and
  final protected-performance posture decisions are accepted or proven.
