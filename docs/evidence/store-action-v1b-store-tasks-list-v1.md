# Store Action V1B Store Tasks Read-Only List V1

Date: 2026-05-22

## Decision

Expose persisted Store Action plans on `/store/tasks` as a read-only list.

This is the sixth V1B kademe after schema, lifecycle contract, command
boundary, API contract, and workflow inbox source integration. It does not add
create, status update, close, cancel, notification, escalation, or attachment
UI.

## Sokrates

Claim:

- Store managers should be able to see persisted action plans in the owning
  Store Tasks surface before lifecycle commands are added to the UI.

Repo evidence:

- `/api/store-actions/plans` already exists with generated OpenAPI types.
- The workflow inbox already exposes active action plans as task items.
- `/store/tasks` is the first owning surface for Store Action work.

Counterargument:

- A read-only plan list can feel incomplete because users cannot change plan
  status yet. That is intentional in this slice; write controls carry lifecycle
  and recovery risk and need a separate PR.

Risk:

- MEDIUM. It adds a protected frontend read call and user-visible panel, but no
  backend behavior, DB migration, auth semantics, or write workflow changes.

Door:

- Two-way door. The panel can be reverted without data repair or contract
  rollback.

## Scope

Added:

- `admin-web/src/features/store-actions/api.ts`
- `admin-web/src/features/store-actions/StoreActionPlansPanel.tsx`
- Store Tasks integration for a read-only plan panel and metric.
- Store Tasks localization copy.
- Playwright coverage for persisted action plan read-only rendering.

Intentionally unchanged:

- API response shape.
- Auth or permission semantics.
- DB schema or migrations.
- Store Action create/status/close/cancel commands.
- KPI scoring, checklist scoring, target approval, and workflow inbox lifecycle
  mapping.
- Broad UI redesign.

## Verification Ladder

Expected local gates:

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store tasks"`
- `npm.cmd run test:scripts`

PR gates:

- GitHub checks.
- Vercel preview checks.
- Codex review/comment approval before merge.
