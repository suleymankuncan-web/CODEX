# Pilot Operations And Protected Capacity V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `/admin/operations` Control Tower with a strict pilot decision layer and make protected 700-user capacity evidence reproducible without inventing data.

**Architecture:** Keep the work on top of the current Operations Control Tower. PR-1 adds a read-only frontend evidence panel with explicit source, expiry, and decision impact. PR-2 adds the protected capacity runbook/evidence path and records either a real sanitized run or an explicit blocked state.

**Tech Stack:** React + TypeScript, existing admin-web operations surface primitives, lucide icons only where already consistent, Playwright E2E, existing Node capacity scripts.

## Metadata

- Status: Implemented and merged.
- Date: 2026-06-13.
- Owner: Store Ops pilot readiness / capacity evidence.
- Implementation PRs:
  - PR #714: `Add read-only capacity baseline harness`
  - PR #715: `Add operations capacity readiness panel`
  - PR #716: `Add protected capacity runbook evidence`
- Current evidence:
  - `docs/evidence/readiness/2026-06-13-capacity-700-user-baseline.md`
  - `docs/plans/protected-capacity-runbook-v1.md`
- Closeout note: public staging health passed through concurrency `25`; protected role capacity remains blocked/unproven until fresh role-specific bearer tokens are available.

---

## Tightened Decisions

- This train has exactly 2 executable PRs.
- PR-1 is UI/model only; it does not add backend routes, database fields, auth scopes, provider config, or new navigation.
- PR-2 is runbook/evidence only; it does not change capacity script behavior unless a failing contract test proves a secret-safety bug.
- Pilot feedback linking is deferred. It is not part of this train because it opens product scope without increasing capacity confidence.
- Public baseline evidence expires on the first instant of 2026-06-28 UTC. Before that date it may show `passed`; on or after that date it must show `stale`.
- Protected baseline remains `blocked` until all required personas have fresh role-specific tokens and the read ladder reaches concurrency 25 cleanly.
- "700 registered users plausible" and "700 concurrent protected users proven" must never be collapsed into one message.

## Scope

- Add a pilot/capacity readiness panel inside `/admin/operations`.
- Show public staging baseline, protected role baseline, and decision impact as separate rows.
- Show source path and last verified date in UI copy without exposing secrets.
- Add stale evidence behavior so old public baseline does not look permanently valid.
- Add protected capacity runbook and evidence update rules.

## Non-goals

- No store manager or region manager UI changes.
- No new dashboard route.
- No fake telemetry, fake load, fake user count, or manually invented pass result.
- No broad production approval language.
- No secret values in docs, tests, screenshots, PR body, terminal captures, or git diff.

---

## File Map

### PR-1 files

- Create: `admin-web/src/pages/operations-capacity-readiness-model.ts`
  - Owns evidence metadata, expiry logic, and mapping from evidence state to UI tone.
- Create: `admin-web/src/pages/operations-capacity-readiness-panel.tsx`
  - Renders the panel using existing operations surface primitives.
- Modify: `admin-web/src/pages/OperationsControlTowerPage.tsx`
  - Mounts the panel near the top of the existing Control Tower.
- Modify: `admin-web/src/features/localization/messages/admin-operations.ts`
  - Adds Turkish and English copy for the new panel.
- Modify: `admin-web/e2e/operations-control-tower.spec.ts`
  - Covers visible panel, blocked protected state, stale public evidence, and no broad production claim.

### PR-2 files

- Create: `docs/plans/protected-capacity-runbook-v1.md`
  - Gives the exact safe protected capacity run procedure.
- Create: `scripts/protected-capacity-runbook-contract.test.mjs`
  - Guards runbook env names, no fake token examples, and no broad launch claim.
- Modify: `docs/evidence/readiness/2026-06-13-capacity-700-user-baseline.md`
  - Append a protected run result only when the run actually occurs; otherwise append a dated blocked note.

---

## PR-1: Operations Pilot Readiness Panel

**Intent:** Give super admins one clear place to see what capacity evidence exists, what is stale, and what is still blocking broader launch.

### Task 1: Add Evidence Model

**Files:**

- Create: `admin-web/src/pages/operations-capacity-readiness-model.ts`

- [ ] Add this model shape and expiry behavior:

```ts
export type CapacityEvidenceStatus = 'passed' | 'blocked' | 'stale'
export type CapacityEvidenceTone = 'calm' | 'warning'
export type CapacityDecisionImpact = 'pilot_allowed_with_limits' | 'broad_launch_blocked'

export type CapacityReadinessItem = {
  id: 'public-staging-baseline' | 'protected-role-baseline'
  labelKey: string
  status: CapacityEvidenceStatus
  tone: CapacityEvidenceTone
  sourcePath: string
  lastVerifiedAt: string
  staleOnOrAfter: string | null
  summaryKey: string
  nextActionKey: string
  decisionImpact: CapacityDecisionImpact
}

const publicBaseline = {
  id: 'public-staging-baseline',
  labelKey: 'operations.capacity.publicBaseline.label',
  baseStatus: 'passed',
  sourcePath: 'docs/evidence/readiness/2026-06-13-capacity-700-user-baseline.md',
  lastVerifiedAt: '2026-06-13',
  staleOnOrAfter: '2026-06-28',
  summaryKey: 'operations.capacity.publicBaseline.summary',
  nextActionKey: 'operations.capacity.publicBaseline.nextAction',
  decisionImpact: 'pilot_allowed_with_limits',
} as const

const protectedBaseline = {
  id: 'protected-role-baseline',
  labelKey: 'operations.capacity.protectedBaseline.label',
  baseStatus: 'blocked',
  sourcePath: 'docs/evidence/readiness/2026-06-13-capacity-700-user-baseline.md',
  lastVerifiedAt: '2026-06-13',
  staleOnOrAfter: null,
  summaryKey: 'operations.capacity.protectedBaseline.summary',
  nextActionKey: 'operations.capacity.protectedBaseline.nextAction',
  decisionImpact: 'broad_launch_blocked',
} as const

export function getCapacityReadinessSnapshot(now = new Date()): CapacityReadinessItem[] {
  return [toReadinessItem(publicBaseline, now), toReadinessItem(protectedBaseline, now)]
}

function toReadinessItem(
  item: typeof publicBaseline | typeof protectedBaseline,
  now: Date,
): CapacityReadinessItem {
  const status = resolveStatus(item.baseStatus, item.staleOnOrAfter, now)

  return {
    id: item.id,
    labelKey: item.labelKey,
    status,
    tone: resolveTone(status),
    sourcePath: item.sourcePath,
    lastVerifiedAt: item.lastVerifiedAt,
    staleOnOrAfter: item.staleOnOrAfter,
    summaryKey: item.summaryKey,
    nextActionKey: item.nextActionKey,
    decisionImpact: item.decisionImpact,
  }
}

function resolveStatus(
  baseStatus: 'passed' | 'blocked',
  staleOnOrAfter: string | null,
  now: Date,
): CapacityEvidenceStatus {
  if (baseStatus === 'passed' && staleOnOrAfter && isOnOrAfterUtcDate(now, staleOnOrAfter)) return 'stale'
  return baseStatus
}

function resolveTone(status: CapacityEvidenceStatus): CapacityEvidenceTone {
  return status === 'passed' ? 'calm' : 'warning'
}

function isOnOrAfterUtcDate(now: Date, utcDate: string): boolean {
  const [yearText, monthText, dayText] = utcDate.split('-')
  if (!yearText || !monthText || !dayText) {
    throw new Error(`Invalid UTC date: ${utcDate}`)
  }

  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  return now.getTime() >= Date.UTC(year, month - 1, day)
}
```

- [ ] Run: `npm.cmd --prefix admin-web run build`
- [ ] Expected: TypeScript reaches existing project build without errors from this new file.

### Task 2: Add Panel Component

**Files:**

- Create: `admin-web/src/pages/operations-capacity-readiness-panel.tsx`

- [ ] Use only existing primitives from `operations-surface-primitives.tsx`:
  - `OperationsPanel`
  - `OperationsQueueList`
  - `OperationsStatusBadge`
  - `OperationsInlineState`

- [ ] Use stable selectors:
  - Panel: `data-testid="operations-capacity-readiness"`
  - Rows: existing `operations-queue-row`

- [ ] Status-to-tone mapping must be:
  - `passed` -> `calm`.
  - `blocked` -> warning, not danger.
  - `stale` -> warning.

- [ ] UI must show exactly these decision meanings through localized keys:
  - Public baseline: controlled pilot can continue only with limits.
  - Protected baseline: broad launch remains blocked.

- [ ] UI must not show env var names or token hints. Those belong only in PR-2 runbook.

### Task 3: Mount Panel

**Files:**

- Modify: `admin-web/src/pages/OperationsControlTowerPage.tsx`

- [ ] Import `OperationsCapacityReadinessPanel`.
- [ ] Render it after the hero/readiness summary and before lower queue/detail panels.
- [ ] Do not alter existing query fanout.
- [ ] Do not add a new route preloader because the panel reads static evidence metadata only.
- [ ] Do not change `admin-navigation.ts`.

### Task 4: Add Localized Copy

**Files:**

- Modify: `admin-web/src/features/localization/messages/admin-operations.ts`

- [ ] Add Turkish copy for:
  - `operations.capacity.title`
  - `operations.capacity.description`
  - `operations.capacity.source`
  - `operations.capacity.lastVerified`
  - `operations.capacity.staleOnOrAfter`
  - `operations.capacity.publicBaseline.label`
  - `operations.capacity.publicBaseline.summary`
  - `operations.capacity.publicBaseline.nextAction`
  - `operations.capacity.protectedBaseline.label`
  - `operations.capacity.protectedBaseline.summary`
  - `operations.capacity.protectedBaseline.nextAction`
  - status labels for `passed`, `blocked`, `stale`
  - decision labels for `pilot_allowed_with_limits`, `broad_launch_blocked`

- [ ] Add English copy for the same keys.
- [ ] Keep existing localized assertions untouched except for adding new assertions.
- [ ] Do not rewrite old mojibake-looking test strings as part of this PR; that is a separate encoding cleanup.

### Task 5: Add E2E Coverage

**Files:**

- Modify: `admin-web/e2e/operations-control-tower.spec.ts`

- [ ] In the main operations composition test, add the English assertions only after `await setStoredLocale(page, 'en')` has switched the page copy:

```ts
const capacityPanel = page.getByTestId('operations-capacity-readiness')
await expect(capacityPanel).toBeVisible()
await expect(capacityPanel).toContainText('Public staging baseline')
await expect(capacityPanel).toContainText('Protected role baseline')
await expect(capacityPanel).toContainText('Blocked')
await expect(page.locator('body')).not.toContainText(/production ready|broad launch approved/i)
```

- [ ] Add a date-boundary test using Playwright clock:

```ts
test('operations capacity evidence expires on the documented boundary', async ({ page }) => {
  await setInitialLocale(page, 'en')
  await page.clock.setFixedTime(new Date('2026-06-27T10:00:00.000Z'))
  await page.goto('/admin/operations')

  let capacityPanel = page.getByTestId('operations-capacity-readiness')
  await expect(capacityPanel).toContainText('Passed')

  await page.clock.setFixedTime(new Date('2026-06-28T10:00:00.000Z'))
  await page.reload()

  await expect(capacityPanel).toContainText('Stale')
  await expect(capacityPanel).toContainText('Protected role baseline')
  await expect(capacityPanel).toContainText('Blocked')
})
```

### PR-1 Verification

Run all commands before opening the PR:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts
npm.cmd run test:scripts
git diff --check
```

### PR-1 Merge Gate

- Panel is visible only through existing `/admin/operations` access.
- Public baseline shows `passed` before 2026-06-28 UTC and `stale` on or after 2026-06-28 UTC.
- Protected baseline shows `blocked`.
- No text claims broad production readiness.
- No new backend/API query is introduced.
- No secret/env token names are rendered in the UI.

---

## PR-2: Protected Capacity Runbook And Evidence

**Intent:** Make the protected capacity run repeatable and auditable, and prevent blocked runs from being mistaken for passes.

### Task 1: Add Runbook

**Files:**

- Create: `docs/plans/protected-capacity-runbook-v1.md`

- [ ] Include exact required token env names:

```powershell
$env:CAPACITY_STORE_MANAGER_TOKEN='<redacted-store-manager-bearer-token>'
$env:CAPACITY_REGION_MANAGER_TOKEN='<redacted-region-manager-bearer-token>'
$env:CAPACITY_SUPER_ADMIN_TOKEN='<redacted-super-admin-bearer-token>'
```

- [ ] Include exact run command:

```powershell
$env:CAPACITY_PROFILES='store-manager,region-manager,admin'
$env:CAPACITY_LEVELS='1,5,10,25'
$env:CAPACITY_MAX_LEVEL='25'
$env:CAPACITY_TIMEOUT_MS='45000'
npm.cmd run capacity:read
```

- [ ] State that `CAPACITY_ALLOW_SHARED_TOKEN` must not be used for this acceptance run.

- [ ] Include exact pass criteria:
  - script exits `0`,
  - result status is `ok`,
  - max measured concurrency is `25`,
  - all requested profiles are runnable,
  - blocked profiles count is `0`,
  - failed levels count is `0`,
  - availability is `100%`,
  - `429`, `5xx`, request errors, non-JSON responses, HTML responses are all `0`,
  - p95 stays within existing profile budgets: store `<=2000ms`, region/admin `<=2500ms`.

- [ ] Include exact blocked criteria:
  - any required token is absent,
  - result status is `blocked`,
  - endpoint calls for blocked profiles are `0`,
  - the runbook/evidence says protected capacity remains unproven.

### Task 2: Add Runbook Contract Test

**Files:**

- Create: `scripts/protected-capacity-runbook-contract.test.mjs`

- [ ] Test must read `docs/plans/protected-capacity-runbook-v1.md`.
- [ ] Test must assert the three required env names exist.
- [ ] Test must assert the command includes `CAPACITY_LEVELS='1,5,10,25'`.
- [ ] Test must reject real-looking bearer/JWT examples.
- [ ] Test must reject broad launch approval phrases.

Expected phrases to reject:

```js
[
  'production ready',
  'broad launch approved',
  '700 concurrent users proven',
]
```

Required token-pattern checks:

```js
assert.doesNotMatch(runbook, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/)
assert.doesNotMatch(runbook, /\bBearer\s+[A-Za-z0-9._-]{20,}\b/i)
assert.match(runbook, /CAPACITY_ALLOW_SHARED_TOKEN[\s\S]*must not be used/i)
```

### Task 3: Update Evidence

**Files:**

- Modify: `docs/evidence/readiness/2026-06-13-capacity-700-user-baseline.md`

- [ ] If fresh tokens are unavailable, append a dated note:
  - protected run not executed,
  - missing fresh role-specific tokens,
  - protected capacity remains blocked/unproven.

- [ ] If fresh tokens are available, run the command and append only sanitized summary values:
  - evidence date,
  - environment,
  - requested profiles,
  - measured concurrency table,
  - profile pass/block status,
  - budget result,
  - no raw auth material.

- [ ] Do not paste raw JSON output if it contains private payload samples. Summarize sanitized fields only.

### PR-2 Verification

Run:

```powershell
node --test scripts\capacity-read-baseline.test.mjs
node --test scripts\protected-capacity-runbook-contract.test.mjs
npm.cmd run test:scripts
git diff --check
```

If tokens are available, also run:

```powershell
$env:CAPACITY_PROFILES='store-manager,region-manager,admin'
$env:CAPACITY_LEVELS='1,5,10,25'
$env:CAPACITY_MAX_LEVEL='25'
$env:CAPACITY_TIMEOUT_MS='45000'
npm.cmd run capacity:read
```

### PR-2 Merge Gate

- Runbook exists and contract test passes.
- Evidence says `ok` only if the protected run actually returned `ok`.
- Evidence says `blocked` if any protected persona token is missing.
- No secret-like token appears in git diff.
- A runbook-only PR can merge, but it does not satisfy the protected capacity evidence gate unless a real `ok` run is recorded.

---

## Deferred Work

Pilot feedback link from operations is intentionally deferred. Start it only after PR-1 and PR-2 are merged and only if the current pilot feedback route/API can support a read-only summary without backend changes.

---

## Stop Rules

- Stop and split the PR if a backend endpoint, DB migration, provider setting, or auth scope change becomes necessary.
- Stop capacity execution if any 429, 5xx, timeout, request error, non-JSON response, HTML response, or p95 budget breach appears.
- Stop and redact immediately if any token, cookie, password, OTP, database URL, Redis URL, private key, or bearer fragment appears in output.
- Stop if UI copy suggests broad production approval.
- Stop if E2E requires weakening route permission checks.

---

## Success Criteria

- `/admin/operations` shows capacity evidence in a way that cannot age into a false pass.
- Admins can distinguish controlled pilot plausibility from broad launch proof.
- Protected capacity has a reproducible, secret-safe runbook.
- Missing tokens remain a visible blocker, not a hidden failure and not a pass.
- The train ends with either protected role evidence through concurrency 25 or a precise documented blocker.
