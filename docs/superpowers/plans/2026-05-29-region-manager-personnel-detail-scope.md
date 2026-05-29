# Region Manager Personnel Detail Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `/store/rankings` to `/store/personnel/:employeeId` navigation so a `REGION_MANAGER` can open same-active-region personnel profiles, cannot open out-of-region profiles, and never sees a dead-end profile action that the backend will reject.

**Architecture:** Keep backend authorization as the security boundary. First fix the personnel-performance controller scope so region scope is preserved for `REGION_MANAGER`, then expose a backend-computed `canOpenProfile` boolean on personnel ranking rows using the same active-assignment rule as the profile endpoint. The frontend must trust that boolean for the `Detaya git` profile action while keeping the ranking detail drawer available for ranking rows.

**Tech Stack:** NestJS reporting/ranking services, generated OpenAPI contract, React + TanStack Query rankings page, shadcn/Tailwind store UI, Jest backend tests, Playwright E2E, release check scripts.

---

## Confirmed Problem

Production/staging symptom:

```text
Performans yuzeyi acilamadi
{"errorCode":"FORBIDDEN","message":"Personnel profile is outside the current user's scope","path":"/api/reports/personnel-performance/:id?mode=:value&periodType=:value&periodStart=:value","statusCode":403}
```

Expected behavior:

- `REGION_MANAGER` may open a personnel profile when the target employee's active assignment `region_id` is inside the manager's read region scope.
- `REGION_MANAGER` may not open personnel profiles outside that active region scope.
- `SUPER_ADMIN` keeps broad profile access.
- `STORE_MANAGER` keeps assigned/read store profile access.
- `STORE_PERSONNEL` may open their own profile.
- Rankings may still display rows according to ranking visibility rules, but profile navigation must be hidden when the profile endpoint would reject the row.
- Ranking row drawer must remain available for rows that the user is allowed to inspect as ranking rows.

Root cause:

- `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts#getPersonnelPerformance` previously reused `resolveStoreReadScope`.
- For broad roles, `resolveStoreReadScope` prefers `companyIds` before `regionIds`.
- A BM session can have company scope and region scope at the same time.
- `backend/nestjs/src/modules/store-ops/application/reporting.service.ts#assertCanReadPersonnelPerformance` authorizes `REGION_MANAGER` by `assignment.region_id in input.regionIds`.
- When controller collapses to company scope, `input.regionIds` becomes empty, so same-region employees fail with 403.
- Frontend profile navigation was also based on ranking-level visibility instead of profile-level authorization, so it could display `Detaya git` for rows the profile endpoint would reject.

## File Structure

Modify:

- `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
  - Add a personnel-profile-specific read-scope resolver.
  - Use it only in `getPersonnelPerformance`.
  - Leave other reporting endpoints on `resolveStoreReadScope`.

- `backend/nestjs/src/modules/store-ops/web/reporting.controller.spec.ts`
  - Prove `REGION_MANAGER` personnel profile reads preserve `regionIds` and do not pass company scope as profile scope.

- `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts`
  - Prove same-region BM profile access passes.
  - Prove out-of-region BM profile access still fails.

- `backend/nestjs/src/modules/store-ops/application/ranking.contract.ts`
  - Add required `canOpenProfile: boolean` to `PersonnelRankingRow`.

- `backend/nestjs/src/modules/store-ops/application/ranking.service.ts`
  - Compute `canOpenProfile` from active employee assignments, not from the ranking-period row.
  - Use the same role/scope semantics as `ReportingService.assertCanReadPersonnelPerformance`.
  - Use one batched active-assignment lookup per ranking response, not one query per employee.

- `backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts`
  - Prove `canOpenProfile` follows active assignment scope, not historical/ranking-period region fields.
  - Prove assignment access is fetched through the batched repository method.

- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
  - Add a batched active employee assignment scope lookup.
  - Keep the existing single-employee helper as a thin wrapper for existing callers.

- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
  - Prove the batch helper uses one query and skips empty batches.

- `backend/nestjs/src/openapi/generate-openapi.ts`
  - Add `canOpenProfile` to the personnel ranking row OpenAPI schema.

- `docs/api/openapi.json`
  - Reflect only the intended schema addition.
  - Avoid committing unrelated OpenAPI generator drift.

- `admin-web/src/generated/openapi-types.ts`
  - Regenerate after OpenAPI is correct.

- `admin-web/src/pages/store-rankings-scope.ts`
  - Keep the frontend profile-action predicate small and backend-driven.

- `admin-web/src/pages/StoreRankingsPage.tsx`
  - Keep personnel ranking drawer opening based on ranking detail visibility.
  - Hide only the profile navigation action when `canOpenProfile` is false.

- `admin-web/e2e/store-surfaces.spec.ts`
  - Cover in-scope and out-of-scope BM personnel ranking behavior.

- `docs/flows/store-ops-system-flow.json`
- `docs/flows/store-ops-system-flow.html`
  - Regenerate after contract/source changes.

- `scripts/file-size-guard.test.mjs`
  - Update baselines only for files whose line counts intentionally changed.

Do not modify:

- DB migrations.
- KPI scoring formulas.
- Ranking population, ranking sort, or ranking score calculation.
- Auth role assignment semantics.
- Approval/workflow state machines.
- Unrelated prototype files or agent folders.

## Task 1: Baseline And Reproduction Evidence

**Files:**

- Read: `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
- Read: `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- Read: `admin-web/src/pages/StoreRankingsPage.tsx`

- [ ] **Step 1: Confirm working branch and dirty state**

Run:

```powershell
git status --short --branch
```

Expected:

- Branch name starts with `codex/`.
- Any unrelated untracked files are noted and left untouched.

- [ ] **Step 2: Locate backend profile endpoint and authorization guard**

Run:

```powershell
rg -n "getPersonnelPerformance|assertCanReadPersonnelPerformance|resolveStoreReadScope|Personnel profile is outside" backend\nestjs\src\modules\store-ops -S
```

Expected:

- Controller endpoint at `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`.
- Service authorization at `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`.

- [ ] **Step 3: Locate rankings frontend profile navigation**

Run:

```powershell
rg -n "StoreRankingsPage|RankingDetailDrawer|Detaya|onOpenPersonnelProfile|personnelLeaderboard" admin-web\src admin-web\e2e -S
```

Expected:

- `StoreRankingsPage.tsx` owns drawer and profile navigation.
- E2E fixtures live in `admin-web/e2e/store-surfaces.spec.ts`.

## Task 2: Backend Service Authorization Regression

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts`

- [ ] **Step 1: Add same-region BM test**

Add a test near existing `getPersonnelPerformance` authorization tests. Use the local test helpers already in the file. The assertion must prove this shape:

```ts
await expect(
  service.getPersonnelPerformance({
    userId: "region-manager-user",
    employeeId: "region-manager-employee",
    targetEmployeeId: "employee-in-region",
    roleCodes: ["REGION_MANAGER"],
    identityCompanyIds: ["company-1"],
    companyIds: [],
    regionIds: ["region-1"],
    storeIds: [],
    assignedStoreIds: [],
    mode: "live",
    periodType: "monthly",
    periodStart: "2026-05-01",
  }),
).resolves.toEqual(expect.objectContaining({
  employee: expect.objectContaining({
    employeeId: "employee-in-region",
  }),
}));
```

The repository mock must return this active assignment for `employee-in-region`:

```ts
{
  company_id: "company-1",
  region_id: "region-1",
  store_id: "store-1",
}
```

- [ ] **Step 2: Add out-of-region BM test**

Add the inverse test:

```ts
await expect(
  service.getPersonnelPerformance({
    userId: "region-manager-user",
    employeeId: "region-manager-employee",
    targetEmployeeId: "employee-out-of-region",
    roleCodes: ["REGION_MANAGER"],
    identityCompanyIds: ["company-1"],
    companyIds: [],
    regionIds: ["region-1"],
    storeIds: [],
    assignedStoreIds: [],
    mode: "live",
    periodType: "monthly",
    periodStart: "2026-05-01",
  }),
).rejects.toThrow("Personnel profile is outside the current user's scope");
```

The repository mock must return this active assignment for `employee-out-of-region`:

```ts
{
  company_id: "company-1",
  region_id: "region-2",
  store_id: "store-2",
}
```

- [ ] **Step 3: Run the targeted service test**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- reporting.service.kpi-benchmark-scoring.spec.ts --runInBand
```

Expected:

- Same-region test passes when `regionIds` is supplied.
- Out-of-region test fails closed with the existing 403 message.

## Task 3: Controller Scope Resolver Regression And Fix

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/web/reporting.controller.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`

- [ ] **Step 1: Add controller regression**

Add this test to `reporting.controller.spec.ts`, adapting constructor mocks to the existing spec pattern:

```ts
it("preserves region scope for region manager personnel profile reads", async () => {
  const reportingService = {
    getPersonnelPerformance: jest.fn(async () => ({ ok: true })),
  };
  const rankingService = { getRankings: jest.fn() };
  const controller = new ReportingController(
    reportingService as never,
    rankingService as never,
  );

  await controller.getPersonnelPerformance(
    {
      user: {
        userId: "region-manager-user",
        employeeId: "manager-employee",
        roleCodes: ["REGION_MANAGER"],
        scope: {
          companyIds: ["company-1"],
          regionIds: ["region-1"],
          storeIds: [],
        },
        actionScope: {
          assignedStoreIds: ["store-1"],
        },
      },
    },
    "employee-in-region",
    {
      mode: "live",
      periodType: "monthly",
      periodStart: "2026-05-01",
    },
  );

  expect(reportingService.getPersonnelPerformance).toHaveBeenCalledWith(
    expect.objectContaining({
      roleCodes: ["REGION_MANAGER"],
      identityCompanyIds: ["company-1"],
      companyIds: [],
      regionIds: ["region-1"],
      storeIds: [],
      assignedStoreIds: ["store-1"],
      targetEmployeeId: "employee-in-region",
    }),
  );
});
```

Expected before implementation:

- Test fails if controller still uses `resolveStoreReadScope` and drops `regionIds`.

- [ ] **Step 2: Add personnel-specific resolver**

In `reporting.controller.ts`, add near `resolveStoreReadScope`:

```ts
  private resolvePersonnelProfileReadScope(input: {
    actorRoleCodes: string[];
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
  }) {
    const storeIds = input.actorActionScope?.assignedStoreIds.length
      ? input.actorActionScope.assignedStoreIds
      : input.actorScope.storeIds;

    if (input.actorRoleCodes.includes("SUPER_ADMIN")) {
      return {
        companyIds: input.actorScope.companyIds,
        regionIds: input.actorScope.regionIds,
        storeIds,
      };
    }

    if (input.actorRoleCodes.includes("REGION_MANAGER")) {
      return {
        companyIds: [],
        regionIds: input.actorScope.regionIds,
        storeIds: [],
      };
    }

    return {
      companyIds: [],
      regionIds: [],
      storeIds,
    };
  }
```

- [ ] **Step 3: Use resolver only in `getPersonnelPerformance`**

In `getPersonnelPerformance`, replace any `resolveStoreReadScope` usage with:

```ts
    const personnelProfileReadScope = this.resolvePersonnelProfileReadScope({
      actorRoleCodes: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
    });
```

Pass it to service:

```ts
      companyIds: personnelProfileReadScope.companyIds,
      regionIds: personnelProfileReadScope.regionIds,
      storeIds: personnelProfileReadScope.storeIds,
```

Keep this identity scope unchanged:

```ts
      identityCompanyIds: request.user.scope.companyIds,
```

- [ ] **Step 4: Run controller and service tests**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- reporting.controller.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- reporting.service.kpi-benchmark-scoring.spec.ts --runInBand
```

Expected: both pass.

## Task 4: Backend Ranking Contract For Profile Action Availability

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/ranking.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/ranking.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts`

- [ ] **Step 1: Add required contract field**

In `PersonnelRankingRow`, add:

```ts
  canOpenProfile: boolean;
```

Do not add this field to `StoreRankingRow`.

- [ ] **Step 2: Default unranked personnel rows to false**

In the personnel row builder inside `ranking.service.ts`, add:

```ts
          canOpenProfile: false,
```

Expected placement:

- Inside personnel rows only.
- Not inside store rows.

- [ ] **Step 3: Add active assignment access resolver**

In `ranking.service.ts`, import the personnel row type if not already imported:

```ts
import type {
  PersonnelRankingRow,
  RankingMetricValue,
} from "./ranking.contract";
```

Add the active assignment type near service-level types:

```ts
type ActivePersonnelAssignmentScope = Awaited<
  ReturnType<ReportingRepository["getActiveEmployeeAssignmentScope"]>
>;
```

Add this repository method in `reporting.repository.ts`:

```ts
type ActiveEmployeeAssignmentScopeRow = {
  employee_id: string;
  external_employee_ref: string | null;
  first_name: string;
  last_name: string;
  company_id: string | null;
  region_id: string | null;
  region_name: string | null;
  store_id: string | null;
  store_name: string | null;
};

  async getActiveEmployeeAssignmentScope(
    employeeId: string,
  ): Promise<ActiveEmployeeAssignmentScopeRow | null> {
    const rows = await this.getActiveEmployeeAssignmentScopes([employeeId]);

    return rows[0] ?? null;
  }

  async getActiveEmployeeAssignmentScopes(
    employeeIds: string[],
  ): Promise<ActiveEmployeeAssignmentScopeRow[]> {
    if (employeeIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.query<ActiveEmployeeAssignmentScopeRow>(
      `
        SELECT
          e.employee_id,
          e.external_employee_ref,
          e.first_name,
          e.last_name,
          COALESCE(store.company_id, e.company_id)::text AS company_id,
          store.region_id::text AS region_id,
          region.region_name,
          assignment.store_id::text AS store_id,
          store.store_name
        FROM ops.employee e
        LEFT JOIN LATERAL (
          SELECT eah.store_id
          FROM ops.employee_assignment_history eah
          WHERE eah.employee_id = e.employee_id
            AND eah.assignment_status = 'active'
          ORDER BY eah.start_date DESC
          LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN ops.store store
          ON store.store_id = assignment.store_id
        LEFT JOIN ops.region region
          ON region.region_id = store.region_id
        WHERE e.employee_id = ANY($1::uuid[])
        ORDER BY e.employee_id ASC
      `,
      [employeeIds],
    );

    return result.rows;
  }
```

Add these private methods:

```ts
  private async resolvePersonnelProfileAccess(input: {
    rows: Array<PersonnelRankingRow & { metrics?: RankingMetricValue[] }>;
    currentEmployeeId: string | null;
    roleCodes: string[];
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    assignedStoreIds: string[];
  }) {
    const employeeIds = uniqueIds(input.rows.map((row) => row.employeeId));
    const result = new Map<string, boolean>();
    const managerStoreIds = input.assignedStoreIds.length > 0
      ? input.assignedStoreIds
      : input.storeIds;
    const scopedEmployeeIds = employeeIds.filter((employeeId) => {
      if (input.currentEmployeeId && input.currentEmployeeId === employeeId) {
        result.set(employeeId, true);
        return false;
      }

      return true;
    });
    const assignments =
      await this.reportingRepository.getActiveEmployeeAssignmentScopes(scopedEmployeeIds);
    const assignmentByEmployeeId = new Map(
      assignments.map((assignment) => [assignment.employee_id, assignment]),
    );

    for (const employeeId of scopedEmployeeIds) {
      result.set(
        employeeId,
        this.canReadPersonnelProfileFromActiveAssignment({
          roleCodes: input.roleCodes,
          companyIds: input.companyIds,
          regionIds: input.regionIds,
          storeIds: managerStoreIds,
          assignment: assignmentByEmployeeId.get(employeeId) ?? null,
        }),
      );
    }

    return result;
  }

  private canReadPersonnelProfileFromActiveAssignment(input: {
    roleCodes: string[];
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    assignment: ActivePersonnelAssignmentScope;
  }) {
    if (!input.assignment) {
      return false;
    }

    if (input.roleCodes.includes("SUPER_ADMIN")) {
      return (
        !this.hasPersonnelReadScope(input) ||
        (input.assignment.company_id !== null &&
          input.companyIds.includes(input.assignment.company_id)) ||
        (input.assignment.region_id !== null &&
          input.regionIds.includes(input.assignment.region_id)) ||
        (input.assignment.store_id !== null &&
          input.storeIds.includes(input.assignment.store_id))
      );
    }

    if (input.roleCodes.includes("REGION_MANAGER")) {
      return (
        input.assignment.region_id !== null &&
        input.regionIds.includes(input.assignment.region_id)
      );
    }

    if (input.roleCodes.includes("STORE_MANAGER")) {
      return (
        input.assignment.store_id !== null &&
        input.storeIds.includes(input.assignment.store_id)
      );
    }

    return false;
  }

  private hasPersonnelReadScope(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  }) {
    return (
      input.companyIds.length > 0 ||
      input.regionIds.length > 0 ||
      input.storeIds.length > 0
    );
  }
```

- [ ] **Step 4: Apply profile access before masking**

After `selectedPersonnelRows`, `currentEmployee`, and `managedStorePersonnelRows` are known, add:

```ts
    const personnelProfileAccess = await this.resolvePersonnelProfileAccess({
      rows: [
        ...selectedPersonnelRows,
        ...(currentEmployee ? [currentEmployee] : []),
        ...managedStorePersonnelRows,
      ],
      currentEmployeeId: employeeId,
      roleCodes: input.roleCodes,
      companyIds: input.companyIds,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
      assignedStoreIds: input.assignedStoreIds,
    });
    const withProfileAccess = (
      row: PersonnelRankingRow & { metrics?: RankingMetricValue[] },
    ) => ({
      ...row,
      canOpenProfile: personnelProfileAccess.get(row.employeeId) ?? false,
    });
```

Use it for all personnel ranking response rows:

```ts
    const personnelItems = selectedPersonnelRows.map((row) =>
      maskPersonnelRow(withProfileAccess(row), access.canSeeGlobalDetails ? "detail" : "summary"),
    );

    const managedStorePersonnel =
      access.canSeeManagedStorePersonnelDetails && managedStoreIds.length > 0
        ? managedStorePersonnelRows.map((row) => maskPersonnelRow(withProfileAccess(row), "detail"))
        : [];
```

For `currentEmployee`:

```ts
        currentEmployee: currentEmployee
          ? maskPersonnelRow(
              withProfileAccess(currentEmployee),
              access.canSeeGlobalDetails ? "detail" : "summary",
            )
          : null,
```

- [ ] **Step 5: Add ranking service regression**

In `ranking.service.spec.ts`, mock `getActiveEmployeeAssignmentScopes` and add:

```ts
it("marks personnel profile navigation from active assignment scope, not ranking period region", async () => {
  repository.getActiveEmployeeAssignmentScopes.mockImplementation(async (employeeIds) =>
    employeeIds.map((employeeId) => {
      if (employeeId === "employee-001") {
        return {
          employee_id: employeeId,
          external_employee_ref: null,
          first_name: "Personel",
          last_name: "Test",
          company_id: "company-1",
          region_id: "region-2",
          region_name: "Region 2",
          store_id: "store-2",
          store_name: "Store 2",
        };
      }

      return {
        employee_id: employeeId,
        external_employee_ref: null,
        first_name: "Personel",
        last_name: "Test",
        company_id: "company-1",
        region_id: "region-1",
        region_name: "Region 1",
        store_id: "store-1",
        store_name: "Store 1",
      };
    }),
  );

  const result = await service.getRankings({
    userId: "region-manager-user",
    employeeId: "manager-employee",
    roleCodes: ["REGION_MANAGER"],
    companyIds: ["company-1"],
    regionIds: ["region-1"],
    storeIds: [],
    assignedStoreIds: [],
    periodType: "monthly",
    periodStart: "2026-05-01",
  });

  expect(
    result.personnelLeaderboard.items.find((row) => row.employeeId === "employee-001"),
  ).toEqual(expect.objectContaining({
    regionId: "region-1",
    canOpenProfile: false,
  }));

  expect(
    result.personnelLeaderboard.items.find((row) => row.employeeId === "employee-002"),
  ).toEqual(expect.objectContaining({
    regionId: "region-2",
    canOpenProfile: true,
  }));
  expect(repository.getActiveEmployeeAssignmentScopes).toHaveBeenCalledTimes(1);
  expect(repository.getActiveEmployeeAssignmentScopes).toHaveBeenCalledWith([
    "employee-001",
    "employee-002",
  ]);
  expect(repository.getActiveEmployeeAssignmentScope).not.toHaveBeenCalled();
});
```

The important assertion is:

- `canOpenProfile` follows active assignment from `getActiveEmployeeAssignmentScopes`.
- The ranking endpoint does not issue one active assignment query per employee.
- It does not blindly trust the ranking-period `row.regionId`.

- [ ] **Step 6: Run ranking service test**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- ranking.service.spec.ts --runInBand
```

Expected: pass.

## Task 5: OpenAPI And Generated Frontend Types

**Files:**

- Modify: `backend/nestjs/src/openapi/generate-openapi.ts`
- Modify: `docs/api/openapi.json`
- Modify: `admin-web/src/generated/openapi-types.ts`

- [ ] **Step 1: Update OpenAPI generator schema**

In `reportingPersonnelRankingRowSchema`, add `canOpenProfile` to the required array:

```ts
    "scoreValue",
    "canOpenProfile",
    "visibility",
```

Add the property:

```ts
    canOpenProfile: { type: "boolean" },
```

- [ ] **Step 2: Regenerate or patch OpenAPI carefully**

First try:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
```

Then verify no unrelated body schema drift:

```powershell
npm.cmd --prefix backend/nestjs test -- src/shared/openapi-baseline.contract.spec.ts --runInBand
```

Expected:

- If baseline passes, keep generated `docs/api/openapi.json`.
- If baseline fails because unrelated DTO body schemas became `{}`, restore `docs/api/openapi.json` and manually apply only the `canOpenProfile` schema addition.

Manual repair command:

```powershell
git restore -- docs/api/openapi.json
```

Manual patch target:

- In `docs/api/openapi.json`, under `ReportingRankingsResponse`, update all three personnel row schemas:
  - `personnelLeaderboard.items.items`
  - `personnelLeaderboard.currentEmployee`
  - `personnelLeaderboard.managedStorePersonnel.items`

Each schema must contain:

```json
"required": [
  "subject",
  "employeeId",
  "displayName",
  "storeId",
  "storeName",
  "regionId",
  "regionName",
  "regionManagerUserId",
  "regionManagerName",
  "rank",
  "population",
  "storeRank",
  "storePopulation",
  "scoreValue",
  "canOpenProfile",
  "visibility"
]
```

and:

```json
"canOpenProfile": {
  "type": "boolean"
}
```

Verify:

```powershell
rg -n "canOpenProfile" docs\api\openapi.json
```

Expected: exactly 6 occurrences.

- [ ] **Step 3: Regenerate frontend OpenAPI types**

Run:

```powershell
npm.cmd --prefix admin-web run api:generate
```

Verify:

```powershell
rg -n "canOpenProfile" admin-web\src\generated\openapi-types.ts
```

Expected: generated personnel ranking rows include `canOpenProfile: boolean`.

- [ ] **Step 4: Run API drift check**

Run:

```powershell
npm.cmd --prefix admin-web run api:check
```

Expected: pass.

## Task 6: Frontend Profile Action Gating

**Files:**

- Modify/Create: `admin-web/src/pages/store-rankings-scope.ts`
- Modify: `admin-web/src/pages/StoreRankingsPage.tsx`

- [ ] **Step 1: Keep frontend predicate backend-driven**

Create or update `store-rankings-scope.ts`:

```ts
import type { AuthSessionSummary } from '../features/auth/api'
import type { PersonnelRankingRow } from '../features/reports/api'

export function canOpenPersonnelProfileFromRanking(
  authSummary: AuthSessionSummary | null,
  row: PersonnelRankingRow,
) {
  if (authSummary?.user.employeeId && authSummary.user.employeeId === row.employeeId) {
    return true
  }

  return row.canOpenProfile === true
}
```

Do not reconstruct authorization from `row.regionId` in frontend.

- [ ] **Step 2: Import predicate in rankings page**

At the top of `StoreRankingsPage.tsx`:

```ts
import { canOpenPersonnelProfileFromRanking } from './store-rankings-scope'
```

Inside `StoreRankingsPage`, compute:

```ts
  const canOpenPersonnelProfile = (row: PersonnelRankingRow) =>
    canOpenPersonnelProfileFromRanking(input.authSummary, row)
```

- [ ] **Step 3: Pass predicate to workspace and drawer**

Keep:

```tsx
      <RankingWorkspace
        canOpenPersonnelProfile={canOpenPersonnelProfile}
        ...
      />
```

Keep:

```tsx
      <RankingDetailDrawer
        canOpenPersonnelProfile={canOpenPersonnelProfile}
        onOpenPersonnelProfile={(employeeId) => {
          const path = `/store/personnel/${encodeURIComponent(employeeId)}`
          const params = new URLSearchParams()

          if (ranking.source.periodStart) {
            params.set('mode', 'live')
            params.set('periodType', 'monthly')
            params.set('periodStart', ranking.source.periodStart)
          }

          const query = params.toString()
          navigate(query ? `${path}?${query}` : path)
        }}
        ...
      />
```

- [ ] **Step 4: Keep row drawer open for scoped-out profile rows**

In `PersonnelRankingTableRow`, the ranking row must remain clickable when ranking detail is visible:

```tsx
        <RankingEntity
          label={row.displayName}
          caption={row.storeName ?? input.t('storeRankings.noStore')}
          canOpen={input.canSeeDetails}
          onOpen={() => input.onOpenDetail(row)}
        />
```

Do not change this to `input.canSeeDetails && input.canOpenProfile`; that would hide the ranking drawer for rows whose profile cannot be opened.

- [ ] **Step 5: Hide only `Detaya git` in drawer**

In `RankingDetailDrawer`, keep the profile button conditional:

```tsx
{personnelRow && input.canOpenPersonnelProfile(personnelRow) ? (
  <Button
    type="button"
    variant="default"
    onClick={() => input.onOpenPersonnelProfile(personnelRow.employeeId)}
  >
    {input.t('storeRankings.openPersonnelProfile')}
    <ExternalLink aria-hidden="true" />
  </Button>
) : null}
```

Expected behavior:

- In-scope row: drawer opens and `Detaya git` appears.
- Out-of-profile-scope row: drawer opens and `Detaya git` is absent.
- Clicking out-of-profile-scope ranking row does not call `/api/reports/personnel-performance/:id`.

## Task 7: E2E Regression

**Files:**

- Modify: `admin-web/e2e/store-surfaces.spec.ts`

- [ ] **Step 1: Add fixture fields**

Every personnel ranking fixture row must include:

```ts
canOpenProfile: true
```

or:

```ts
canOpenProfile: false
```

Add explicit BM rows:

```ts
const regionManagerInScopePersonnelRow = {
  subject: 'personnel',
  employeeId: 'employee-in-region',
  displayName: 'In Region Personnel',
  storeId: 'store-1',
  storeName: 'Region Store',
  regionId: 'region-1',
  regionName: 'Marmara',
  regionManagerUserId: 'region-manager-user',
  regionManagerName: 'BM User',
  rank: 1,
  population: 2,
  storeRank: 1,
  storePopulation: 1,
  scoreValue: 91,
  canOpenProfile: true,
  visibility: 'detail',
  metrics: [],
}

const regionManagerOutOfScopePersonnelRow = {
  subject: 'personnel',
  employeeId: 'employee-out-of-region',
  displayName: 'Out Of Scope Personnel',
  storeId: 'store-2',
  storeName: 'Other Store',
  regionId: 'region-2',
  regionName: 'Other Region',
  regionManagerUserId: 'other-manager-user',
  regionManagerName: 'Other BM',
  rank: 2,
  population: 2,
  storeRank: 1,
  storePopulation: 1,
  scoreValue: 88,
  canOpenProfile: false,
  visibility: 'detail',
  metrics: [],
}
```

Use actual fixture naming/style already present in the spec.

- [ ] **Step 2: Add BM rankings test**

Add a Playwright test with this behavior:

```ts
test('region manager rankings opens only in-region personnel profile actions', async ({ page }) => {
  const personnelPerformanceRequests: string[] = []

  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...rankingFixture,
        access: {
          ...rankingFixture.access,
          canSeeGlobalDetails: true,
        },
        personnelLeaderboard: {
          ...rankingFixture.personnelLeaderboard,
          items: [
            regionManagerInScopePersonnelRow,
            regionManagerOutOfScopePersonnelRow,
          ],
        },
      }),
    })
  })

  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    personnelPerformanceRequests.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(personnelPerformanceFixture),
    })
  })

  await page.goto('/store/rankings')
  await page.getByRole('button', { name: /personnel/i }).click()

  await page.getByRole('button', { name: 'In Region Personnel' }).click()
  await expect(page.getByRole('button', { name: /Detaya git/i })).toBeVisible()
  await page.getByRole('button', { name: /Detaya git/i }).click()
  await expect(page).toHaveURL(/\/store\/personnel\/employee-in-region/)

  await page.goto('/store/rankings')
  await page.getByRole('button', { name: /personnel/i }).click()
  await page.getByRole('button', { name: 'Out Of Scope Personnel' }).click()
  await expect(page.getByText('Out Of Scope Personnel')).toBeVisible()
  await expect(page.getByRole('button', { name: /Detaya git/i })).toHaveCount(0)
  expect(personnelPerformanceRequests).toHaveLength(1)
})
```

Adapt labels to real translation strings in the spec.

- [ ] **Step 3: Run targeted Playwright**

Run:

```powershell
$env:PLAYWRIGHT_USE_SYSTEM_CHROME='1'; npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --project=chromium --grep "store rankings personnel detail opens the selected personnel performance profile|region manager rankings opens only in-region personnel profile actions"
```

Expected: both targeted E2E tests pass.

## Task 8: System Flow And Size Guard

**Files:**

- Modify: `docs/flows/store-ops-system-flow.json`
- Modify: `docs/flows/store-ops-system-flow.html`
- Modify: `scripts/file-size-guard.test.mjs`

- [ ] **Step 1: Regenerate system flow**

Run:

```powershell
node scripts/generate-system-flow.mjs
```

Expected:

- `docs/flows/store-ops-system-flow.json` and `.html` update if API/source graph changed.

- [ ] **Step 2: Run script tests**

Run:

```powershell
npm.cmd run test:scripts
```

Expected:

- If file-size guard fails only for intentionally changed files, update those baselines in `scripts/file-size-guard.test.mjs`.
- Do not raise baselines for unrelated files.

Known intentional candidates:

```js
["backend/nestjs/src/openapi/generate-openapi.ts", 5256],
["admin-web/src/pages/StoreRankingsPage.tsx", 1439],
```

The exact line counts must match the final local files. Verify with:

```powershell
(Get-Content backend\nestjs\src\openapi\generate-openapi.ts | Measure-Object -Line).Lines
(Get-Content admin-web\src\pages\StoreRankingsPage.tsx | Measure-Object -Line).Lines
```

## Task 9: Full Verification

**Files:** none.

- [ ] **Step 1: Run targeted backend tests**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- ranking.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- reporting.controller.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- reporting.service.kpi-benchmark-scoring.spec.ts --runInBand
```

Expected: all pass.

- [ ] **Step 2: Run backend build**

Run:

```powershell
npm.cmd --prefix backend/nestjs run build
```

Expected: pass.

- [ ] **Step 3: Run frontend checks**

Run:

```powershell
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

Expected: all pass.

- [ ] **Step 4: Run targeted E2E**

Run:

```powershell
$env:PLAYWRIGHT_USE_SYSTEM_CHROME='1'; npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --project=chromium --grep "store rankings personnel detail opens the selected personnel performance profile|region manager rankings opens only in-region personnel profile actions"
```

Expected: pass.

- [ ] **Step 5: Run full release check**

Run:

```powershell
npm.cmd run check:release
```

Expected: pass.

If it fails:

- Read the first failing log section.
- Do not assume the failure is unrelated.
- Fix the failure if caused by this PR.
- Re-run the failing command and then `npm.cmd run check:release`.

## Task 10: PR, Review, Merge, And Post-Merge Verification

**Files:** none.

- [ ] **Step 1: Review intended diff**

Run:

```powershell
git diff -- backend/nestjs/src/modules/store-ops/web/reporting.controller.ts backend/nestjs/src/modules/store-ops/web/reporting.controller.spec.ts backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts backend/nestjs/src/modules/store-ops/application/ranking.contract.ts backend/nestjs/src/modules/store-ops/application/ranking.service.ts backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts backend/nestjs/src/openapi/generate-openapi.ts docs/api/openapi.json admin-web/src/generated/openapi-types.ts admin-web/src/pages/store-rankings-scope.ts admin-web/src/pages/StoreRankingsPage.tsx admin-web/e2e/store-surfaces.spec.ts docs/flows/store-ops-system-flow.json docs/flows/store-ops-system-flow.html scripts/file-size-guard.test.mjs docs/superpowers/plans/2026-05-29-region-manager-personnel-detail-scope.md
```

Expected:

- Diff only contains the scope fix, ranking profile action availability, tests, OpenAPI/types, flow docs, size guard, and this plan.

- [ ] **Step 2: Stage intended files only**

Run:

```powershell
git add -- admin-web/e2e/store-surfaces.spec.ts admin-web/src/generated/openapi-types.ts admin-web/src/pages/StoreRankingsPage.tsx admin-web/src/pages/store-rankings-scope.ts backend/nestjs/src/modules/store-ops/application/ranking.contract.ts backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts backend/nestjs/src/modules/store-ops/application/ranking.service.ts backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts backend/nestjs/src/modules/store-ops/web/reporting.controller.spec.ts backend/nestjs/src/modules/store-ops/web/reporting.controller.ts backend/nestjs/src/openapi/generate-openapi.ts docs/api/openapi.json docs/flows/store-ops-system-flow.html docs/flows/store-ops-system-flow.json docs/superpowers/plans/2026-05-29-region-manager-personnel-detail-scope.md scripts/file-size-guard.test.mjs
```

Do not stage unrelated untracked prototype files, `.agents/`, or `hermes-agent/`.

- [ ] **Step 3: Commit**

Run:

```powershell
git commit -m "fix: align region manager personnel profile scope"
```

If amending an existing PR commit:

```powershell
git commit --amend --no-edit
```

- [ ] **Step 4: Push branch**

Run:

```powershell
git push --force-with-lease origin codex/region-manager-personnel-detail-scope
```

Use normal `git push` if this is a new branch without an existing remote commit.

- [ ] **Step 5: Open or update PR**

If PR does not exist:

```powershell
gh pr create --title "Fix region manager personnel profile scope" --body-file docs/superpowers/plans/2026-05-29-region-manager-personnel-detail-scope.md
```

If PR exists, edit body so it says:

- Adds backend-computed `personnelLeaderboard.*.canOpenProfile`.
- Fixes `REGION_MANAGER` personnel profile controller scope.
- Does not change ranking score, ranking population/sort, DB schema, auth role assignment, KPI scoring, or workflows.
- Lists all verification commands that passed.

- [ ] **Step 6: Request Codex review after latest push**

Run a PR comment:

```powershell
gh pr comment 540 --body "Updated scope fix: profile link availability is backend-computed as canOpenProfile using active-assignment authorization. Frontend no longer derives profile access from ranking row region. @codex review"
```

Use the actual PR number if not `540`.

- [ ] **Step 7: Poll checks and reviews**

Run:

```powershell
gh pr checks 540
gh pr view 540 --json mergeable,reviewDecision,statusCheckRollup,latestReviews,comments,headRefOid
gh api repos/suleymankuncan-web/CODEX/pulls/540/comments --jq '.[] | {user: .user.login, commit_id, path, line, body, url: .html_url}'
gh api repos/suleymankuncan-web/CODEX/pulls/540/reviews --jq '.[] | {user: .user.login, state, submitted_at, commit_id, body}'
```

Expected:

- Required GitHub checks green.
- Vercel/deploy checks green if attached.
- Latest Codex review has no unresolved actionable finding.
- Stale inline comments on old commits are not blockers if the latest commit has a clean review.

- [ ] **Step 8: Merge only when clean**

Run:

```powershell
gh pr merge 540 --squash --delete-branch
```

Do not merge if checks are failing, mergeability is blocked, or Codex has an unresolved latest actionable review.

- [ ] **Step 9: Verify main after merge**

Run:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git log --oneline -1
git status --short --branch
gh pr view 540 --json state,mergeCommit,mergedAt,url
```

Expected:

- PR state is `MERGED`.
- Local `main` is up to date with `origin/main`.
- Tracked worktree is clean except unrelated untracked files that were intentionally left untouched.

## Completion Checklist

- [ ] BM same-active-region personnel profile opens from `/store/rankings`.
- [ ] BM out-of-active-region personnel profile remains forbidden by backend.
- [ ] Out-of-profile-scope ranking rows still open the ranking detail drawer.
- [ ] `Detaya git` appears only when backend sent `canOpenProfile: true`.
- [ ] `canOpenProfile` is computed from active assignment, not historical/ranking row region.
- [ ] OpenAPI and generated frontend types include `canOpenProfile`.
- [ ] No DB, scoring, ranking sort/population, auth role assignment, or workflow semantics changed.
- [ ] Targeted backend tests pass.
- [ ] Frontend API check, lint, build pass.
- [ ] Targeted Playwright pass.
- [ ] Full `npm.cmd run check:release` passes.
- [ ] PR merged and `main` verified.

## Self-Review

- Spec coverage: The plan covers backend 403 cause, frontend dead-end action, contract shape, tests, OpenAPI/types, release checks, PR discipline, and post-merge verification.
- Placeholder scan: No task depends on an undefined future decision.
- Type consistency: `canOpenProfile` is consistently a required boolean on `PersonnelRankingRow` and is not added to store rows.
