# Target Reference Control Surface V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved target reference layer that lets store and personnel `TARGET_ACHIEVEMENT` scoring use trusted, queryable, period-scoped references instead of request JSON or guessed targets.

**Architecture:** Keep `ops.target_distribution_request` as the workflow and audit object. Add `ops.personnel_target_reference` as the approved scoring contract, promote approved request allocations into that table, then teach live reporting and closed snapshots to read and anchor the approved target reference. HR_ADMIN gets coverage visibility; V1 does not add hidden target override powers.

**Tech Stack:** NestJS, PostgreSQL SQL migrations, Jest backend tests, React/Vite admin-web, Playwright smoke tests, root `npm.cmd run check:release`.

---

## File Structure

Backend schema and migrations:

- Create `backend/nestjs/src/modules/store-ops/target-reference-schema-contract.spec.ts`
  - Guards canonical `db/schema.sql` and migration `039_target_reference_control_surface_v1.sql`.
- Create `db/migrations/039_target_reference_control_surface_v1.sql`
  - Adds approved personnel target references and snapshot anchoring column.
- Modify `db/schema.sql`
  - Keeps canonical schema aligned with migration `039`.

Backend target workflow:

- Modify `backend/nestjs/src/modules/store-ops/web/dto/create-target-distribution-request.dto.ts`
  - Requires `employeeId` for every target allocation.
- Modify `backend/nestjs/src/modules/store-ops/application/target-distribution.service.ts`
  - Carries `employeeId` through the service contract.
- Modify `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts`
  - Stores `employeeId` in request payload evidence.
  - Promotes approved allocations into `ops.personnel_target_reference`.
  - Emits audit metadata with promoted reference count.
- Modify `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`
  - Covers employeeId allocation persistence and approval promotion.
- Modify `backend/nestjs/test/integration/target-distribution.e2e-spec.ts` if this file exists in the workspace during execution.
  - Adds `employeeId` to target-distribution request payload fixtures.

Backend reporting and snapshots:

- Modify `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
  - Joins approved personnel target references for live employee `TARGET_ACHIEVEMENT`.
  - Returns `personnel_target_reference_id` for live employee rows and snapshot KPI rows.
- Modify `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
  - Uses stable missing reasons for target references.
- Modify `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts`
  - Covers live personnel target scoring and missing target explanation.
- Modify `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`
  - Uses approved personnel target references while materializing employee snapshots.
  - Writes `personnel_target_reference_id` into `rpt.employee_kpi_snapshot`.
- Modify `backend/nestjs/src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts`
  - Covers snapshot scoring with approved target reference and anchoring.

Backend HR coverage:

- Modify `backend/nestjs/src/modules/store-ops/web/target-distribution.controller.ts`
  - Adds a read endpoint for target reference coverage.
- Modify `backend/nestjs/src/modules/store-ops/application/target-distribution.service.ts`
  - Adds coverage orchestration and scope checks.
- Modify `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts`
  - Adds aggregate query for missing/pending/approved target references.
- Modify `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`
  - Covers coverage status aggregation.

Frontend:

- Modify `admin-web/src/features/targets/api.ts`
  - Adds `employeeId` to `TargetDistributionAllocation`.
  - Adds target reference coverage types and API helper.
- Modify `admin-web/src/pages/StoreApprovalsPage.tsx`
  - Submits target allocations tied to real `employeeId`.
- Modify `admin-web/src/pages/TargetApprovalQueuePage.tsx`
  - Shows HR/Admin target coverage/readiness summary.
- Modify `admin-web/e2e/store-surfaces.spec.ts`
  - Updates target request smoke fixtures and assertions.
- Modify `admin-web/e2e/admin-surfaces.spec.ts` if target queue coverage is already covered there during execution.
  - Adds coverage summary assertion.

Docs and handoff:

- Modify `current-state.md`
  - Records implementation outcome after the plan is executed.
- Modify `docs/plans/active-next-actions.md`
  - Moves Target Reference Control Surface V1 from design note to planned/implemented state after execution.
- Modify `docs/plans/project-debt-ledger.md`
  - Increments closed active debt only after root release gate passes.

---

## Task 1: Schema Contract Red

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/target-reference-schema-contract.spec.ts`

- [ ] **Step 1: Write the failing schema contract**

Create the file with this complete content:

```ts
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "../../../../..");
const schemaSql = readFileSync(join(root, "db/schema.sql"), "utf8");
const migrationSql = readFileSync(
  join(root, "db/migrations/039_target_reference_control_surface_v1.sql"),
  "utf8",
);
const combinedSql = `${schemaSql}\n${migrationSql}`;

describe("target reference schema contract", () => {
  it("defines approved personnel target references", () => {
    expect(combinedSql).toContain("CREATE TABLE IF NOT EXISTS ops.personnel_target_reference");
    expect(combinedSql).toContain("personnel_target_reference_id UUID PRIMARY KEY DEFAULT gen_random_uuid()");
    expect(combinedSql).toContain("source_request_id UUID NOT NULL REFERENCES ops.target_distribution_request(target_distribution_request_id)");
    expect(combinedSql).toContain("employee_id UUID NOT NULL REFERENCES ops.employee(employee_id)");
    expect(combinedSql).toContain("target_type TEXT NOT NULL DEFAULT 'monthly_sales_target'");
    expect(combinedSql).toContain("status TEXT NOT NULL DEFAULT 'approved'");
    expect(combinedSql).toContain("CHECK (status IN ('approved', 'superseded', 'voided_future'))");
    expect(combinedSql).toContain("supersedes_target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id)");
  });

  it("guards lookup and active uniqueness indexes", () => {
    expect(combinedSql).toContain("CREATE INDEX IF NOT EXISTS idx_personnel_target_reference_employee_period");
    expect(combinedSql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_target_reference_active_unique");
    expect(combinedSql).toContain("WHERE status = 'approved'");
  });

  it("anchors employee KPI snapshots to the personnel target reference used", () => {
    expect(combinedSql).toContain("ALTER TABLE rpt.employee_kpi_snapshot");
    expect(combinedSql).toContain("ADD COLUMN IF NOT EXISTS personnel_target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id)");
  });

  it("documents the scoring boundary", () => {
    expect(combinedSql).toContain("COMMENT ON TABLE ops.personnel_target_reference IS 'Approved personnel target references promoted from region-approved target distribution requests for scoring.'");
  });
});
```

- [ ] **Step 2: Run the contract and verify it fails**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/target-reference-schema-contract.spec.ts --runInBand
```

Expected:

```text
FAIL target reference schema contract
ENOENT: no such file or directory, open 'db\migrations\039_target_reference_control_surface_v1.sql'
```

- [ ] **Step 3: Commit the red contract**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/target-reference-schema-contract.spec.ts
git commit -m "test: add target reference schema contract"
```

---

## Task 2: Migration And Canonical Schema

**Files:**

- Create: `db/migrations/039_target_reference_control_surface_v1.sql`
- Modify: `db/schema.sql`

- [ ] **Step 1: Add migration `039`**

Create `db/migrations/039_target_reference_control_surface_v1.sql` with this content:

```sql
CREATE TABLE IF NOT EXISTS ops.personnel_target_reference (
    personnel_target_reference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_request_id UUID NOT NULL REFERENCES ops.target_distribution_request(target_distribution_request_id),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    target_value NUMERIC(18,4) NOT NULL CHECK (target_value > 0),
    target_type TEXT NOT NULL DEFAULT 'monthly_sales_target',
    status TEXT NOT NULL DEFAULT 'approved',
    approved_by_user_id TEXT NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supersedes_target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id),
    CHECK (period_end >= period_start),
    CHECK (status IN ('approved', 'superseded', 'voided_future'))
);

CREATE INDEX IF NOT EXISTS idx_personnel_target_reference_employee_period
    ON ops.personnel_target_reference (employee_id, period_start, period_end, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_target_reference_active_unique
    ON ops.personnel_target_reference (employee_id, period_start, period_end, target_type)
    WHERE status = 'approved';

ALTER TABLE rpt.employee_kpi_snapshot
    ADD COLUMN IF NOT EXISTS personnel_target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id);

COMMENT ON TABLE ops.personnel_target_reference IS 'Approved personnel target references promoted from region-approved target distribution requests for scoring.';
```

- [ ] **Step 2: Mirror the schema in `db/schema.sql`**

Add the same table, indexes, snapshot column, and comment to `db/schema.sql` near the target distribution and employee KPI snapshot definitions. Keep the SQL identical to migration `039` for the strings guarded by `target-reference-schema-contract.spec.ts`.

- [ ] **Step 3: Run the schema contract**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/target-reference-schema-contract.spec.ts --runInBand
```

Expected:

```text
PASS src/modules/store-ops/target-reference-schema-contract.spec.ts
```

- [ ] **Step 4: Commit schema changes**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add db/migrations/039_target_reference_control_surface_v1.sql db/schema.sql backend/nestjs/src/modules/store-ops/target-reference-schema-contract.spec.ts
git commit -m "feat: add personnel target reference schema"
```

---

## Task 3: Require Employee Identity In Target Allocations

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/web/dto/create-target-distribution-request.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/target-distribution.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`
- Modify: `admin-web/src/features/targets/api.ts`
- Modify: `admin-web/src/pages/StoreApprovalsPage.tsx`
- Modify: `admin-web/e2e/store-surfaces.spec.ts`

- [ ] **Step 1: Add a backend DTO validation test**

In the existing target distribution backend spec file that validates DTO or controller payloads, add this test. If there is no DTO test file, add it to `backend/nestjs/src/modules/store-ops/web/dto/create-target-distribution-request.dto.spec.ts`.

```ts
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateTargetDistributionRequestDto } from "./create-target-distribution-request.dto";

describe("CreateTargetDistributionRequestDto", () => {
  it("requires every target allocation to carry a real employee id", async () => {
    const dto = plainToInstance(CreateTargetDistributionRequestDto, {
      storeId: "00000000-0000-0000-0000-000000000201",
      requestMonth: "2026-03-01",
      targetLabel: "Aylik personel hedef dagitimi",
      totalTargetValue: 100000,
      allocations: [
        {
          assigneeLabel: "Ada Kaya",
          targetValue: 100000,
        },
      ],
    });

    const errors = await validate(dto);

    expect(JSON.stringify(errors)).toContain("employeeId");
  });
});
```

- [ ] **Step 2: Run the DTO test and verify it fails**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/web/dto/create-target-distribution-request.dto.spec.ts --runInBand
```

Expected:

```text
FAIL CreateTargetDistributionRequestDto requires every target allocation to carry a real employee id
```

- [ ] **Step 3: Add `employeeId` to backend allocation contracts**

Change `TargetDistributionAllocationDto` to:

```ts
class TargetDistributionAllocationDto {
  @IsPostgresUuid()
  employeeId!: string;

  @IsString()
  assigneeLabel!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetValue!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
```

In `TargetDistributionService.createRequest`, change the allocation type to:

```ts
allocations: Array<{
  employeeId: string;
  assigneeLabel: string;
  targetValue: number;
  note?: string;
}>;
```

In `TargetDistributionRepository.createRequest`, change the allocation type to:

```ts
allocations: Array<{
  employeeId: string;
  assigneeLabel: string;
  targetValue: number;
  note?: string;
}>;
```

- [ ] **Step 4: Update frontend target API type**

Change `TargetDistributionAllocation` in `admin-web/src/features/targets/api.ts` to:

```ts
export type TargetDistributionAllocation = {
  employeeId: string
  assigneeLabel: string
  targetValue: number
  note?: string
}
```

- [ ] **Step 5: Wire `employeeId` in store target request UI**

In `StoreApprovalsPage.tsx`, change empty allocation initializers from:

```ts
{ assigneeLabel: '', targetValue: 0, note: '' }
```

to:

```ts
{ employeeId: '', assigneeLabel: '', targetValue: 0, note: '' }
```

Change the personnel hydration block to:

```ts
return personnel.map((person) => ({
  employeeId: person.employeeId,
  assigneeLabel: person.displayName,
  targetValue: 0,
  note: '',
}))
```

Change the submit guard from:

```ts
activeAllocations.every((item) => item.assigneeLabel.trim() && Number(item.targetValue) > 0)
```

to:

```ts
activeAllocations.every(
  (item) => item.employeeId.trim() && item.assigneeLabel.trim() && Number(item.targetValue) > 0,
)
```

Change `personnelByName` to `personnelById`:

```ts
const personnelById = useMemo(
  () =>
    new Map(
      (personnelQuery.data?.items ?? []).map((person) => [person.employeeId, person] as const),
    ),
  [personnelQuery.data?.items],
)
```

Use `personnelById.get(allocation.employeeId)` when rendering current sales value. For any manual row, render a `<select>` so store managers choose an existing employee:

```tsx
<select
  value={allocation.employeeId}
  onChange={(event) => {
    const selected = personnelById.get(event.target.value)
    setSubmissionNotice(null)
    setAllocations(
      activeAllocations.map((item, itemIndex) =>
        itemIndex === index
          ? Object.assign({}, item, {
              employeeId: event.target.value,
              assigneeLabel: selected?.displayName ?? '',
            })
          : item,
      ),
    )
  }}
>
  <option value="">Personel sec</option>
  {(personnelQuery.data?.items ?? []).map((person) => (
    <option key={person.employeeId} value={person.employeeId}>
      {person.displayName}
    </option>
  ))}
</select>
```

- [ ] **Step 6: Update tests and fixtures to include `employeeId`**

In backend and frontend tests that create target distribution requests, set allocations like this:

```ts
allocations: [
  {
    employeeId: "00000000-0000-0000-0000-000000000501",
    assigneeLabel: "Ada Kaya",
    targetValue: 100000,
    note: "Mart hedefi",
  },
]
```

- [ ] **Step 7: Run targeted backend and frontend checks**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/web/dto/create-target-distribution-request.dto.spec.ts src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts --runInBand
```

Expected:

```text
PASS
```

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "target"
```

Expected:

```text
passed
```

- [ ] **Step 8: Commit allocation identity wiring**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/web/dto/create-target-distribution-request.dto.ts backend/nestjs/src/modules/store-ops/application/target-distribution.service.ts backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts admin-web/src/features/targets/api.ts admin-web/src/pages/StoreApprovalsPage.tsx admin-web/e2e/store-surfaces.spec.ts
git commit -m "feat: require employee identity for target allocations"
```

---

## Task 4: Promote Approved Requests Into Target References

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`

- [ ] **Step 1: Add repository tests for promotion**

In `target-distribution.repository.spec.ts`, add tests that verify approval inserts one approved target reference per allocation and includes source request, employee id, period, value, approver, and status.

Use this allocation shape in the test fixture:

```ts
const allocations = [
  {
    employeeId: "00000000-0000-0000-0000-000000000501",
    assigneeLabel: "Ada Kaya",
    targetValue: 100000,
    note: "Mart hedefi",
  },
  {
    employeeId: "00000000-0000-0000-0000-000000000502",
    assigneeLabel: "Ece Demir",
    targetValue: 75000,
  },
];
```

Assert that the repository executes this insert target:

```sql
INSERT INTO ops.personnel_target_reference (
  source_request_id,
  company_id,
  region_id,
  store_id,
  employee_id,
  period_start,
  period_end,
  target_value,
  target_type,
  status,
  approved_by_user_id,
  approved_at
)
```

Assert that audit metadata contains:

```ts
expect(metadata).toMatchObject({
  actorUserId: "region-manager-user",
  promotedTargetReferenceCount: 2,
});
```

- [ ] **Step 2: Run repository tests and verify they fail**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts --runInBand
```

Expected:

```text
FAIL promotedTargetReferenceCount
```

- [ ] **Step 3: Add typed allocation parser**

In `target-distribution.repository.ts`, add:

```ts
type TargetDistributionAllocation = {
  employeeId: string;
  assigneeLabel: string;
  targetValue: number;
  note?: string;
};

function parseTargetDistributionAllocations(value: unknown): TargetDistributionAllocation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const allocation = item as Record<string, unknown>;
      const employeeId = typeof allocation.employeeId === "string" ? allocation.employeeId : "";
      const assigneeLabel =
        typeof allocation.assigneeLabel === "string" ? allocation.assigneeLabel : "";
      const targetValue = Number(allocation.targetValue);
      const note = typeof allocation.note === "string" ? allocation.note : undefined;

      if (!employeeId || !assigneeLabel || !Number.isFinite(targetValue) || targetValue <= 0) {
        return null;
      }

      return {
        employeeId,
        assigneeLabel,
        targetValue,
        note,
      };
    })
    .filter((item): item is TargetDistributionAllocation => item !== null);
}
```

- [ ] **Step 4: Promote references in the approval transaction**

Inside `approveRequest`, after the `UPDATE` statement returns the request row and before the audit insert, add:

```ts
const allocations = parseTargetDistributionAllocations(request.allocation_json);

for (const allocation of allocations) {
  await client.query(
    `
      INSERT INTO ops.personnel_target_reference (
        source_request_id,
        company_id,
        region_id,
        store_id,
        employee_id,
        period_start,
        period_end,
        target_value,
        target_type,
        status,
        approved_by_user_id,
        approved_at
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5::uuid,
        $6::date,
        ($6::date + INTERVAL '1 month' - INTERVAL '1 day')::date,
        $7::numeric,
        'monthly_sales_target',
        'approved',
        $8,
        $9::timestamptz
      )
      ON CONFLICT (employee_id, period_start, period_end, target_type)
      WHERE status = 'approved'
      DO UPDATE SET
        source_request_id = EXCLUDED.source_request_id,
        company_id = EXCLUDED.company_id,
        region_id = EXCLUDED.region_id,
        store_id = EXCLUDED.store_id,
        target_value = EXCLUDED.target_value,
        approved_by_user_id = EXCLUDED.approved_by_user_id,
        approved_at = EXCLUDED.approved_at
    `,
    [
      request.target_distribution_request_id,
      request.company_id,
      request.region_id,
      request.store_id,
      allocation.employeeId,
      request.request_month,
      allocation.targetValue,
      input.approverUserId,
      request.approved_at,
    ],
  );
}
```

In the audit metadata JSON, add:

```ts
promotedTargetReferenceCount: allocations.length,
```

- [ ] **Step 5: Run targeted tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts --runInBand
```

Expected:

```text
PASS
```

- [ ] **Step 6: Commit approval promotion**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts
git commit -m "feat: promote approved target references"
```

---

## Task 5: Live Personnel Reporting Reads Approved Target References

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts`

- [ ] **Step 1: Add repository test for live target reference join**

In `reporting.repository.spec.ts`, add a test asserting `getEmployeePerformanceRows` uses approved personnel target references for `TARGET_ACHIEVEMENT`.

Assert the generated query includes:

```sql
LEFT JOIN ops.personnel_target_reference ptr
  ON ptr.employee_id = ka.employee_id
 AND ptr.period_start = ka.period_start
 AND ptr.period_end = ka.period_end
 AND ptr.target_type = 'monthly_sales_target'
 AND ptr.status = 'approved'
 AND kd.kpi_code = 'TARGET_ACHIEVEMENT'
```

Assert the selected fields include:

```sql
ptr.target_value::text AS target_value,
ptr.personnel_target_reference_id::text AS personnel_target_reference_id
```

- [ ] **Step 2: Run repository test and verify it fails**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/reporting.repository.spec.ts --runInBand
```

Expected:

```text
FAIL personnel_target_reference_id
```

- [ ] **Step 3: Update `getEmployeePerformanceRows`**

Change the result row type to include:

```ts
personnel_target_reference_id: string | null;
```

Change the select target fields to:

```sql
ptr.target_value::text AS target_value,
ptr.personnel_target_reference_id::text AS personnel_target_reference_id,
```

Add this join before the `WHERE` clause:

```sql
LEFT JOIN ops.personnel_target_reference ptr
  ON ptr.employee_id = ka.employee_id
 AND ptr.period_start = ka.period_start
 AND ptr.period_end = ka.period_end
 AND ptr.target_type = 'monthly_sales_target'
 AND ptr.status = 'approved'
 AND kd.kpi_code = 'TARGET_ACHIEVEMENT'
```

- [ ] **Step 4: Update `getPeerEmployeePerformanceRows`**

Change the result row type to include:

```ts
personnel_target_reference_id: string | null;
```

Change the select target fields to:

```sql
ptr.target_value::text AS target_value,
ptr.personnel_target_reference_id::text AS personnel_target_reference_id,
```

Add the same approved target reference join used in `getEmployeePerformanceRows`.

- [ ] **Step 5: Add service tests for missing reason mapping**

In `reporting.service.kpi-benchmark-scoring.spec.ts`, add a test where `TARGET_ACHIEVEMENT` has an actual value but no approved `target_value`. Assert:

```ts
expect(targetMetric.scoreStatus).toBe("missing_reference");
expect(targetMetric.missingReason).toBe("personnel_target_missing");
```

Add another test where `target_value` is present. Assert:

```ts
expect(targetMetric.scoreStatus).toBe("scored");
expect(targetMetric.targetValue).toBe(100000);
expect(targetMetric.actualRatio).toBe(1.1);
```

- [ ] **Step 6: Implement service missing reason mapping**

In `ReportingService.getMyPerformance`, after `metricScore` is calculated for each mapped metric, add:

```ts
const missingReason =
  metric.code === "TARGET_ACHIEVEMENT" && metricScore.missingReason === "benchmark_missing"
    ? "personnel_target_missing"
    : metricScore.missingReason;
```

Use `missingReason` in the mapped metric object:

```ts
missingReason,
```

- [ ] **Step 7: Run targeted reporting tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/reporting.repository.spec.ts src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts --runInBand
```

Expected:

```text
PASS
```

- [ ] **Step 8: Commit live reporting target references**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts backend/nestjs/src/modules/store-ops/application/reporting.service.ts backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts
git commit -m "feat: use approved target references in personnel reporting"
```

---

## Task 6: Employee Snapshots Anchor Target References

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts`

- [ ] **Step 1: Add snapshot tests for approved target reference scoring**

In `snapshot.service.kpi-benchmark-scoring.spec.ts`, add a test where the employee has:

```ts
const targetReference = {
  personnel_target_reference_id: "00000000-0000-0000-0000-000000000901",
  employee_id: "00000000-0000-0000-0000-000000000501",
  period_start: "2026-03-01",
  period_end: "2026-03-31",
  target_value: "100000",
};
```

Assert that the employee `TARGET_ACHIEVEMENT` score uses `target_value` and that the insert into `rpt.employee_kpi_snapshot` includes:

```sql
personnel_target_reference_id
```

Assert the inserted parameter list includes:

```ts
"00000000-0000-0000-0000-000000000901"
```

- [ ] **Step 2: Run snapshot test and verify it fails**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts --runInBand
```

Expected:

```text
FAIL personnel_target_reference_id
```

- [ ] **Step 3: Fetch approved target references in `materializeEmployeePerformanceSnapshot`**

After benchmark rows are loaded, add:

```ts
const targetReferenceRows = await client.query<{
  personnel_target_reference_id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  target_value: string;
}>(
  `
    SELECT
      personnel_target_reference_id,
      employee_id,
      period_start::text AS period_start,
      period_end::text AS period_end,
      target_value::text AS target_value
    FROM ops.personnel_target_reference
    WHERE status = 'approved'
      AND target_type = 'monthly_sales_target'
      AND period_start = $1::date
      AND period_end = $2::date
  `,
  [periodStart, periodEnd],
);

const targetReferencesByEmployee = new Map(
  targetReferenceRows.rows.map((row) => [row.employee_id, row] as const),
);
```

- [ ] **Step 4: Insert snapshot KPI target reference id**

Change the employee KPI snapshot insert column list from:

```sql
actual_value
```

to:

```sql
actual_value,
personnel_target_reference_id
```

Change the values list from:

```sql
VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::date, $6::date, $7::numeric)
```

to:

```sql
VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::date, $6::date, $7::numeric, $8::uuid)
```

Pass the reference only for `TARGET_ACHIEVEMENT`:

```ts
const targetReference =
  row.kpi_code === "TARGET_ACHIEVEMENT"
    ? targetReferencesByEmployee.get(row.employee_id)
    : undefined;
```

Use:

```ts
targetReference?.personnel_target_reference_id ?? null
```

- [ ] **Step 5: Use target value in employee score calculation**

When calling `this.kpiBenchmarkScoringService.scoreMetric`, replace:

```ts
targetValue: null,
```

with:

```ts
targetValue:
  metric.code === "TARGET_ACHIEVEMENT"
    ? Number(targetReferencesByEmployee.get(employeeId)?.target_value ?? NaN)
    : null,
```

Then normalize invalid values to `null` before calling the scoring service:

```ts
const targetReference = targetReferencesByEmployee.get(employeeId);
const targetValue =
  metric.code === "TARGET_ACHIEVEMENT" && targetReference
    ? Number(targetReference.target_value)
    : null;
```

Pass:

```ts
targetValue,
```

- [ ] **Step 6: Run snapshot tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts --runInBand
```

Expected:

```text
PASS
```

- [ ] **Step 7: Commit snapshot anchoring**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/application/snapshot.service.ts backend/nestjs/src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts
git commit -m "feat: anchor employee snapshots to target references"
```

---

## Task 7: HR Target Reference Coverage Read Model

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/web/target-distribution.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/target-distribution.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`
- Modify: `admin-web/src/features/targets/api.ts`
- Modify: `admin-web/src/pages/TargetApprovalQueuePage.tsx`
- Modify: `admin-web/e2e/admin-surfaces.spec.ts`

- [ ] **Step 1: Add repository test for coverage rows**

In `target-distribution.repository.spec.ts`, add a test for `getTargetReferenceCoverage`. Assert the query returns:

```ts
{
  store_id: "00000000-0000-0000-0000-000000000201",
  store_name: "Marmara Park",
  period_start: "2026-03-01",
  period_end: "2026-03-31",
  active_personnel_count: "2",
  approved_personnel_target_count: "1",
  pending_request_count: "1",
  missing_personnel_target_count: "1",
  coverage_status: "missing_personnel_targets",
}
```

- [ ] **Step 2: Implement repository coverage query**

Add this method to `TargetDistributionRepository`:

```ts
async getTargetReferenceCoverage(input: {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
  periodStart: string;
  periodEnd: string;
}) {
  const params: unknown[] = [input.periodStart, input.periodEnd];
  const clauses: string[] = ["s.kpi_import_enabled = TRUE"];

  if (input.storeIds.length > 0) {
    params.push(input.storeIds);
    clauses.push(`s.store_id = ANY($${params.length}::uuid[])`);
  } else if (input.regionIds.length > 0) {
    params.push(input.regionIds);
    clauses.push(`s.region_id = ANY($${params.length}::uuid[])`);
  } else if (input.companyIds.length > 0) {
    params.push(input.companyIds);
    clauses.push(`s.company_id = ANY($${params.length}::uuid[])`);
  } else {
    clauses.push("FALSE");
  }

  const result = await this.databaseService.query<{
    store_id: string;
    store_name: string;
    period_start: string;
    period_end: string;
    active_personnel_count: string;
    approved_personnel_target_count: string;
    pending_request_count: string;
    missing_personnel_target_count: string;
    coverage_status: string;
  }>(
    `
      WITH active_personnel AS (
        SELECT
          eah.store_id,
          eah.employee_id
        FROM ops.employee_assignment_history eah
        WHERE eah.assignment_status = 'active'
      ),
      approved_targets AS (
        SELECT
          store_id,
          employee_id
        FROM ops.personnel_target_reference
        WHERE status = 'approved'
          AND target_type = 'monthly_sales_target'
          AND period_start = $1::date
          AND period_end = $2::date
      ),
      pending_requests AS (
        SELECT
          store_id,
          COUNT(*)::int AS pending_request_count
        FROM ops.target_distribution_request
        WHERE request_status = 'pending_region_approval'
          AND request_month = $1::date
        GROUP BY store_id
      )
      SELECT
        s.store_id,
        s.store_name,
        $1::date::text AS period_start,
        $2::date::text AS period_end,
        COUNT(DISTINCT ap.employee_id)::text AS active_personnel_count,
        COUNT(DISTINCT at.employee_id)::text AS approved_personnel_target_count,
        COALESCE(MAX(pr.pending_request_count), 0)::text AS pending_request_count,
        GREATEST(COUNT(DISTINCT ap.employee_id) - COUNT(DISTINCT at.employee_id), 0)::text AS missing_personnel_target_count,
        CASE
          WHEN COALESCE(MAX(pr.pending_request_count), 0) > 0 THEN 'pending_region_approval'
          WHEN GREATEST(COUNT(DISTINCT ap.employee_id) - COUNT(DISTINCT at.employee_id), 0) > 0 THEN 'missing_personnel_targets'
          ELSE 'complete'
        END AS coverage_status
      FROM ops.store s
      LEFT JOIN active_personnel ap
        ON ap.store_id = s.store_id
      LEFT JOIN approved_targets at
        ON at.store_id = s.store_id
       AND at.employee_id = ap.employee_id
      LEFT JOIN pending_requests pr
        ON pr.store_id = s.store_id
      WHERE ${clauses.join(" AND ")}
      GROUP BY s.store_id, s.store_name
      ORDER BY s.store_name ASC
    `,
    params,
  );

  return result.rows.map((row) => ({
    storeId: row.store_id,
    storeName: row.store_name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    activePersonnelCount: Number(row.active_personnel_count),
    approvedPersonnelTargetCount: Number(row.approved_personnel_target_count),
    pendingRequestCount: Number(row.pending_request_count),
    missingPersonnelTargetCount: Number(row.missing_personnel_target_count),
    coverageStatus: row.coverage_status,
  }));
}
```

- [ ] **Step 3: Add service and controller endpoint**

Add service method:

```ts
async getTargetReferenceCoverage(input: {
  actorScope: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  };
  periodStart: string;
  periodEnd: string;
}) {
  const items = await this.targetDistributionRepository.getTargetReferenceCoverage({
    companyIds: input.actorScope.companyIds,
    regionIds: input.actorScope.regionIds,
    storeIds: input.actorScope.storeIds,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });

  return buildListResponse(items, {
    total: items.length,
    limit: items.length || 50,
    offset: 0,
  });
}
```

Add controller route:

```ts
@Get("target-reference-coverage")
@Roles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
async getTargetReferenceCoverage(
  @CurrentUser() user: AuthenticatedUser,
  @Query("periodStart") periodStart: string,
  @Query("periodEnd") periodEnd: string,
) {
  return this.targetDistributionService.getTargetReferenceCoverage({
    actorScope: user.scope,
    periodStart,
    periodEnd,
  });
}
```

Use the exact existing current-user decorator and user type names from `target-distribution.controller.ts` when applying the route.

- [ ] **Step 4: Add frontend API helper**

In `admin-web/src/features/targets/api.ts`, add:

```ts
export type TargetReferenceCoverageRow = {
  storeId: string
  storeName: string
  periodStart: string
  periodEnd: string
  activePersonnelCount: number
  approvedPersonnelTargetCount: number
  pendingRequestCount: number
  missingPersonnelTargetCount: number
  coverageStatus: string
}

export async function getTargetReferenceCoverage(input: {
  periodStart: string
  periodEnd: string
}) {
  const params = new URLSearchParams({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  })

  return fetchJson<ListResponse<TargetReferenceCoverageRow>>(
    `/target-distributions/target-reference-coverage?${params.toString()}`,
  )
}
```

- [ ] **Step 5: Render a compact coverage panel in `TargetApprovalQueuePage.tsx`**

Add a query using the current month:

```ts
const coverageQuery = useQuery({
  queryKey: ['target-reference-coverage', requestMonth],
  queryFn: () =>
    getTargetReferenceCoverage({
      periodStart: `${requestMonth}-01`,
      periodEnd: new Date(Number(requestMonth.slice(0, 4)), Number(requestMonth.slice(5, 7)), 0)
        .toISOString()
        .slice(0, 10),
    }),
})
```

Render counts:

```tsx
<div className="stacked-card">
  <div className="stacked-row-head">
    <strong>Hedef referans hazirligi</strong>
    <StatusPill tone="info">{coverageQuery.data?.items.length ?? 0} magaza</StatusPill>
  </div>
  <div className="key-grid">
    <KeyValue
      label="Eksik personel hedefi"
      value={String(
        (coverageQuery.data?.items ?? []).reduce(
          (sum, item) => sum + item.missingPersonnelTargetCount,
          0,
        ),
      )}
    />
    <KeyValue
      label="Bolge onayi bekleyen"
      value={String(
        (coverageQuery.data?.items ?? []).reduce(
          (sum, item) => sum + item.pendingRequestCount,
          0,
        ),
      )}
    />
  </div>
</div>
```

- [ ] **Step 6: Run backend and frontend coverage checks**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts --runInBand
```

Expected:

```text
PASS
```

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/admin-surfaces.spec.ts -g "target"
```

Expected:

```text
passed
```

- [ ] **Step 7: Commit coverage read model**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/web/target-distribution.controller.ts backend/nestjs/src/modules/store-ops/application/target-distribution.service.ts backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts admin-web/src/features/targets/api.ts admin-web/src/pages/TargetApprovalQueuePage.tsx admin-web/e2e/admin-surfaces.spec.ts
git commit -m "feat: show target reference coverage"
```

---

## Task 8: Release Gate And Handoff

**Files:**

- Modify: `current-state.md`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `docs/plans/project-debt-ledger.md`

- [ ] **Step 1: Run targeted backend checks**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/target-reference-schema-contract.spec.ts src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts src/modules/store-ops/infrastructure/reporting.repository.spec.ts src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts --runInBand
```

Expected:

```text
PASS
```

- [ ] **Step 2: Run frontend target checks**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "target"
npm.cmd run test:e2e -- e2e/admin-surfaces.spec.ts -g "target"
```

Expected:

```text
passed
```

- [ ] **Step 3: Run root release gate**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected:

```text
exit 0
```

- [ ] **Step 4: Update handoff docs**

In `current-state.md`, add a section named:

```markdown
## Son Target Reference Control Surface V1 Implementation
```

Record:

```markdown
- Approved personnel target references now exist as `ops.personnel_target_reference`.
- Region-approved target distribution requests promote allocations into approved monthly personnel target references.
- Personnel target allocations require real `employeeId`; `assigneeLabel` remains display evidence only.
- Live personnel `TARGET_ACHIEVEMENT` scoring reads approved target references.
- Closed employee KPI snapshots anchor `personnel_target_reference_id`.
- HR/Admin target coverage shows missing and pending target references by period/store.
- Missing target references remain `missing_reference`; the system does not guess target values.
```

In `docs/plans/active-next-actions.md`, move the Target Reference item from design/planned state to completed state after release gate passes.

In `docs/plans/project-debt-ledger.md`, increment closed active debts by one only after `npm.cmd run check:release` exits `0`.

- [ ] **Step 5: Commit handoff docs**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add current-state.md docs/plans/active-next-actions.md docs/plans/project-debt-ledger.md
git commit -m "docs: close target reference control surface"
```

---

## Final Verification Commands

Run these before calling the implementation complete:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/target-reference-schema-contract.spec.ts src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts src/modules/store-ops/infrastructure/reporting.repository.spec.ts src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts --runInBand
```

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "target"
npm.cmd run test:e2e -- e2e/admin-surfaces.spec.ts -g "target"
```

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
git status --short
```

Expected final state:

```text
check:release exits 0
git status --short shows no uncommitted implementation files
```

## CODEX Durust Yorum

This implementation should be treated as a trust foundation, not a flashy target feature. The project already has scoring logic; the dangerous gap is whether the score reads an official target or an accidental request payload. Separating approved target references from target requests prevents historical disputes, keeps HR visibility honest, and gives the performance engine a clean source of truth.

The safest V1 boundary is clear: store managers submit, region managers approve, HR_ADMIN monitors coverage, and scoring reads only approved references. No hidden HR override is added in this pass. That keeps the module institutional instead of personal and protects us from target values changing silently after scores are already visible.

## Do Not Start Until This Lands

- Do not add VM checklist scoring before target references are operationally clean.
- Do not add region-specific benchmark scoring before target references are operationally clean.
- Do not add a source-specific JSON KPI adapter before target references are operationally clean unless real external payload evidence arrives and the source mapping spec is approved.
