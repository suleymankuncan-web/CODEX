# Shared Inbox Maturity V1

Date: 26 April 2026

## Purpose

The shared inbox already brings approvals, acknowledgements, and KPI exception tasks into one queue. This step makes each item easier to inspect without creating a new workflow engine.

The goal is to make a queue row answer four practical questions:

- What exactly is this item?
- When does it need attention?
- Is it an escalation candidate?
- Which source screen owns the action?

## Scope

Added to store and admin inbox rows:

- `Detay ozeti`
- `Due sinyali`
- `Escalation`
- `Kaynak aksiyonu`

The source action is derived from the existing `sourceType`:

- `target_distribution_request` -> `Karar ekranina git`
- `checklist_receipt` -> `Checklist receipt ac`
- `kpi_exception` -> `KPI detayina git`

Escalation is derived from the existing `inboxStatus` and `urgency` fields:

- high + needs attention -> `Escalation aday`
- medium + needs attention -> `Takipte tut`
- completed -> `Escalation yok`

## Implementation

Frontend:

- `admin-web/src/features/workflow/WorkflowInboxDetail.tsx`
  - shared detail component for inbox rows
  - derives due, escalation, detail summary, and source action from the existing item payload
- `admin-web/src/pages/StoreTasksPage.tsx`
  - uses the shared detail component in store task rows
- `admin-web/src/pages/AdminInboxPage.tsx`
  - uses the shared detail component in admin inbox rows

Tests:

- `admin-web/e2e/store-surfaces.spec.ts`
  - protects store task row detail, due, escalation, and KPI source action labels
- `admin-web/e2e/admin-inbox.spec.ts`
  - protects admin inbox row detail, due, escalation, and target approval source action labels

## Boundaries

No backend change.

No API contract change.

No DB schema change.

No migration.

No new workflow state machine.

No due-date persistence beyond existing `needsAttentionAt` and `createdAt`.

No escalation execution or notification dispatch.

No new source action endpoint.

This is a shared frontend interpretation layer over the existing inbox contract.

## Verification

Red test:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store tasks page renders readable Turkish queue labels"
```

Result:

- failed because `Detay ozeti` did not exist yet

Targeted green verification:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store tasks page renders readable Turkish queue labels"
npm.cmd run test:e2e -- e2e/admin-inbox.spec.ts
```

Result:

- store task Playwright smoke passed
- admin inbox Playwright smoke passed

Official root release verification:

```powershell
cd "<workspace-root>"
npm.cmd run check:release
```

Result:

- root script tests passed: 9/9
- backend release passed: lint, 32 test suites / 248 tests, build, `npm audit --omit=dev`
- frontend release passed: lint, script tests 7/7, build, 25 Playwright tests, `npm audit --omit=dev`

## CODEX DURUST YORUM

This is the correct V1 maturity step.

Inbox risk is not lack of a bigger backend model yet. The risk is that operators see a list of items but cannot quickly tell urgency, owner action, or escalation meaning. This change improves that without flattening approval, acknowledgement, and task semantics.

The next backend step should only happen when we need real persisted due dates, escalation ownership, SLA transitions, or notifications. Until then, the current shared contract is enough.

## Next Logical Step

If staging IdP values are available, run guarded staging action evidence.

If not, the next local product candidate is Store UX polish and broader TR-first copy rollout.
