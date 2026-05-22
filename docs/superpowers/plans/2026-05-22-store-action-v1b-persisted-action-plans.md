# Store Action V1B Persisted Action Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Store Action V1B persisted action plans without changing KPI, checklist, target, workforce, auth, or workflow semantics outside the scoped feature.

**Architecture:** Add a feature-owned `ops.store_action_plan` table, a small repository/service/controller boundary, generated OpenAPI client coverage, and a minimal `/store/tasks` UI extension. The source fact remains in KPI/reporting; Store Action owns only the follow-up object and lifecycle.

**Tech Stack:** NestJS, PostgreSQL SQL migrations, OpenAPI generated frontend types, React/Vite admin-web, Playwright targeted tests, root script contract tests.

---

## File Map

- Create `db/migrations/049_store_action_plan_v1.sql`: add the action-plan table and indexes.
- Modify `db/schema.sql`: keep the canonical schema aligned with migration 049.
- Create `backend/nestjs/src/modules/store-ops/store-action-plan-schema-contract.spec.ts`: guard schema shape and indexes.
- Modify `backend/nestjs/src/shared/audit/audit-event-catalog.ts`: add four Store Action audit events.
- Create `backend/nestjs/src/modules/store-ops/application/store-action-plan.contract.ts`: backend domain DTOs and lifecycle helpers.
- Create `backend/nestjs/src/modules/store-ops/application/store-action-plan.service.ts`: auth/scope validation and command orchestration.
- Create `backend/nestjs/src/modules/store-ops/application/store-action-plan.service.spec.ts`: assigned-store and lifecycle tests.
- Create `backend/nestjs/src/modules/store-ops/infrastructure/store-action-plan.repository.ts`: SQL reads/writes and audit writes.
- Create `backend/nestjs/src/modules/store-ops/infrastructure/store-action-plan.repository.spec.ts`: SQL and audit contract tests.
- Create `backend/nestjs/src/modules/store-ops/web/store-action-plan.controller.ts`: REST endpoints under `/store-actions`.
- Create DTO files under `backend/nestjs/src/modules/store-ops/web/dto/`: create, list, status, close, cancel.
- Modify `backend/nestjs/src/modules/store-ops/store-ops.module.ts`: register service, repository, and controller.
- Modify `backend/nestjs/src/openapi/generate-openapi.ts`: add Store Action schemas and endpoints.
- Run generated frontend client commands after the API is added.
- Modify `backend/nestjs/src/modules/store-ops/application/workflow-inbox.contract.ts`: add `store_action_plan` adapter after plan reads exist.
- Modify `backend/nestjs/src/modules/store-ops/application/workflow-inbox.service.ts`: include action plans after plan reads exist.
- Modify `admin-web/src/pages/StoreTasksPage.tsx` and, if needed, create focused files under `admin-web/src/features/store-actions/`.
- Add or update targeted Playwright coverage for `/store/tasks`.

## Task 1: Schema Contract And Migration

**Files:**
- Create: `db/migrations/049_store_action_plan_v1.sql`
- Modify: `db/schema.sql`
- Create: `backend/nestjs/src/modules/store-ops/store-action-plan-schema-contract.spec.ts`

- [x] **Step 1: Add the failing schema contract test**

Create `backend/nestjs/src/modules/store-ops/store-action-plan-schema-contract.spec.ts` with assertions for:

```ts
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "../../../../..");
const schemaSql = readFileSync(join(root, "db/schema.sql"), "utf8");
const migrationSql = readFileSync(
  join(root, "db/migrations/049_store_action_plan_v1.sql"),
  "utf8",
);
const combinedSql = `${schemaSql}\n${migrationSql}`;

describe("store action plan schema contract", () => {
  it("defines persisted store action plans", () => {
    expect(combinedSql).toContain("CREATE TABLE IF NOT EXISTS ops.store_action_plan");
    expect(combinedSql).toContain("store_action_plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid()");
    expect(combinedSql).toContain("owner_user_id UUID NOT NULL REFERENCES ops.user_account(user_id)");
    expect(combinedSql).toContain("source_type TEXT NOT NULL");
    expect(combinedSql).toContain("CHECK (source_type IN ('kpi_exception'))");
    expect(combinedSql).toContain("CHECK (status IN ('open', 'in_progress', 'blocked', 'closed', 'cancelled'))");
  });

  it("guards active source uniqueness and scope lookup indexes", () => {
    expect(combinedSql).toContain("idx_store_action_plan_store_status_due");
    expect(combinedSql).toContain("idx_store_action_plan_owner_status_due");
    expect(combinedSql).toContain("idx_store_action_plan_scope_status_due");
    expect(combinedSql).toContain("idx_store_action_plan_active_source_unique");
    expect(combinedSql).toContain("WHERE status IN ('open', 'in_progress', 'blocked')");
  });
});
```

- [x] **Step 2: Verify the schema contract fails**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- store-action-plan-schema-contract.spec.ts
```

Expected: fails because migration 049 and table text do not exist yet.

- [x] **Step 3: Add the migration and canonical schema block**

Add the SQL from `docs/plans/store-action-v1b-persisted-action-plan-design-v1.md` under `Data Model Draft` to both `db/migrations/049_store_action_plan_v1.sql` and the operational table area in `db/schema.sql`.

- [x] **Step 4: Verify schema contract passes**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- store-action-plan-schema-contract.spec.ts
```

Expected: pass.

- [x] **Step 5: Commit**

```powershell
git add db/schema.sql db/migrations/049_store_action_plan_v1.sql backend/nestjs/src/modules/store-ops/store-action-plan-schema-contract.spec.ts
git commit -m "feat: add store action plan schema"
```

## Task 2: Audit Catalog And Lifecycle Contract

**Files:**
- Modify: `backend/nestjs/src/shared/audit/audit-event-catalog.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/store-action-plan.contract.ts`
- Add tests in `backend/nestjs/src/modules/store-ops/application/store-action-plan.service.spec.ts`

- [ ] **Step 1: Add audit event catalog entries**

Add these four entries under the `store_ops` section:

```ts
auditEvent("store_action_plan.created", "ops.store_action_plan", "store_ops", "Store action plan was created."),
auditEvent("store_action_plan.status_updated", "ops.store_action_plan", "store_ops", "Store action plan status was updated."),
auditEvent("store_action_plan.closed", "ops.store_action_plan", "store_ops", "Store action plan was closed with resolution evidence."),
auditEvent("store_action_plan.cancelled", "ops.store_action_plan", "store_ops", "Store action plan was cancelled."),
```

- [ ] **Step 2: Create lifecycle helpers**

Create `store-action-plan.contract.ts` with:

```ts
export type StoreActionPlanStatus = "open" | "in_progress" | "blocked" | "closed" | "cancelled";
export type StoreActionPlanPriority = "high" | "medium" | "low";
export type StoreActionPlanSourceType = "kpi_exception";

export const terminalStoreActionPlanStatuses: StoreActionPlanStatus[] = ["closed", "cancelled"];

export function canTransitionStoreActionPlanStatus(from: StoreActionPlanStatus, to: StoreActionPlanStatus) {
  if (terminalStoreActionPlanStatuses.includes(from)) return false;
  if (from === to) return true;
  return ["in_progress", "blocked", "closed", "cancelled"].includes(to);
}
```

- [ ] **Step 3: Verify audit catalog and lifecycle tests**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- audit-event-catalog.spec.ts store-action-plan.service.spec.ts
```

Expected: pass after service spec exists in Task 3.

## Task 3: Repository And Service Commands

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/store-action-plan.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/store-action-plan.repository.spec.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/store-action-plan.service.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/store-action-plan.service.spec.ts`

- [ ] **Step 1: Write service tests first**

Cover these cases:

- assigned store create succeeds,
- unassigned store create throws `ForbiddenException`,
- duplicate active source maps to `ConflictException`,
- terminal plan update throws `ConflictException`,
- close requires resolution note,
- cancel requires cancel reason.

- [ ] **Step 2: Implement service validation**

Service must check assigned-store action scope before writes and must not use broad read scope as write permission.

- [ ] **Step 3: Implement repository SQL and audit writes**

Repository must insert the plan and audit event in one transaction. Status, close, and cancel commands must update the plan and insert the matching audit event.

- [ ] **Step 4: Run backend targeted tests**

```powershell
npm.cmd --prefix backend/nestjs test -- store-action-plan.service.spec.ts store-action-plan.repository.spec.ts audit-event-catalog.spec.ts
```

- [ ] **Step 5: Commit**

```powershell
git add backend/nestjs/src/modules/store-ops/application/store-action-plan* backend/nestjs/src/modules/store-ops/infrastructure/store-action-plan* backend/nestjs/src/shared/audit/audit-event-catalog.ts
git commit -m "feat: add store action plan commands"
```

## Task 4: Controller, DTOs, OpenAPI, Generated Client

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/web/store-action-plan.controller.ts`
- Create DTOs under `backend/nestjs/src/modules/store-ops/web/dto/`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`
- Modify: `backend/nestjs/src/openapi/generate-openapi.ts`
- Generated frontend client files under `admin-web/src/api/generated/`

- [ ] **Step 1: Add DTOs**

DTOs must match the API design:

- list query: `status`, `storeId`, `limit`, `offset`,
- create body: `storeId`, `sourceType`, `sourceId`, `sourceDeepLink`, `sourceSnapshotRunId`, `sourceKpiId`, `title`, `summary`, `priority`, `dueOn`,
- status body: `status`, `note`,
- close body: `resolutionNote`,
- cancel body: `cancelReason`.

- [ ] **Step 2: Add controller endpoints**

Endpoints:

- `GET /api/store-actions/plans`,
- `GET /api/store-actions/plans/:actionPlanId`,
- `POST /api/store-actions/plans`,
- `PATCH /api/store-actions/plans/:actionPlanId/status`,
- `PATCH /api/store-actions/plans/:actionPlanId/close`,
- `PATCH /api/store-actions/plans/:actionPlanId/cancel`.

- [ ] **Step 3: Add OpenAPI schemas and generated client**

Run:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
```

- [ ] **Step 4: Run backend and API gates**

```powershell
npm.cmd --prefix backend/nestjs test -- store-action-plan
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix admin-web run api:check
```

- [ ] **Step 5: Commit**

```powershell
git add backend/nestjs/src/modules/store-ops/web backend/nestjs/src/modules/store-ops/store-ops.module.ts backend/nestjs/src/openapi/generate-openapi.ts admin-web/src/api/generated
git commit -m "feat: expose store action plan api"
```

## Task 5: Workflow Inbox Integration

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/application/workflow-inbox.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/workflow-inbox.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/workflow-inbox.service.spec.ts`

- [ ] **Step 1: Add `store_action_plan` source mapping**

Action plans map to `itemType: "task"` and `sourceType: "store_action_plan"`.

- [ ] **Step 2: Add service read integration**

Include plan items after existing KPI exception, checklist, and target source reads are stable.

- [ ] **Step 3: Run workflow tests**

```powershell
npm.cmd --prefix backend/nestjs test -- workflow-inbox.service.spec.ts
```

- [ ] **Step 4: Commit**

```powershell
git add backend/nestjs/src/modules/store-ops/application/workflow-inbox*
git commit -m "feat: surface store action plans in workflow inbox"
```

## Task 6: Minimal Store Tasks UI

**Files:**
- Modify: `admin-web/src/pages/StoreTasksPage.tsx`
- Create focused components/hooks under `admin-web/src/features/store-actions/`
- Add or update targeted Playwright spec for `/store/tasks`

- [ ] **Step 1: Add generated client usage**

Use generated Store Action plan types and client functions. Do not hand-roll fetch shapes.

- [ ] **Step 2: Add minimal UI**

The UI must support:

- list plans,
- create plan from KPI exception candidate,
- status update to `in_progress` or `blocked`,
- close with resolution note,
- cancel with reason,
- loading, empty, error, retry states,
- mobile-safe layout.

- [ ] **Step 3: Run frontend gates**

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store tasks"
```

- [ ] **Step 4: Commit**

```powershell
git add admin-web/src/pages/StoreTasksPage.tsx admin-web/src/features/store-actions admin-web/tests
git commit -m "feat: add store action plan task flow"
```

## Task 7: Release Gate And Evidence

**Files:**
- Modify docs evidence and current handoff only after gates pass.

- [ ] **Step 1: Run full relevant gates**

```powershell
npm.cmd run test:scripts
npm.cmd --prefix backend/nestjs run lint
npm.cmd --prefix backend/nestjs test
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run api:check
```

- [ ] **Step 2: Record evidence**

Update Store Action evidence with exact passed commands and any caveats.

- [ ] **Step 3: Open PR**

Open a PR only when the current batch is reviewable and revertible in one paragraph.
