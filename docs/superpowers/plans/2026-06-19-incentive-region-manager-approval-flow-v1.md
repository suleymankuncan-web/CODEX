# Incentive Region Manager Approval Flow V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the approved post-close Region Manager incentive command-center flow live: store review state, Region Manager draft corrections, period package submission, admin review status, admin approve/return decisions, then promote the locked prototype into `/store/incentives`.

**Architecture:** Keep incentive calculation, sales source binding, close-run logic, role visibility, company-store-only rule, and cashier exclusion unchanged. Add a separate Region Manager workflow layer beside the existing admin adjustment model: store-period reviews, Region Manager draft/submitted corrections against final snapshot rows, region-period packages, package-store snapshots, and admin package review. Existing `ops.sales_target_incentive_adjustment` remains the approved adjustment ledger; Region Manager draft/submitted changes are not treated as final until admin approves them.

**Tech Stack:** NestJS, PostgreSQL migrations/repositories, TypeScript service/controller tests, React 19, TanStack Query, shadcn/ui, Tailwind v4 `tw:` prefix, lucide icons, Playwright.

---

## Metadata

- Status: implemented through PR #749-#756; historical execution plan
- Date: 2026-06-19
- Owner: Sales Target Incentive V1 follow-up
- Canonical prototype: `docs/prototypes/store-incentives-region-manager-command-v2.html`
- Locked prototype SHA-256: `B18107107BB91332179F00A93166ECF04038CA6E6878E14DFE8DD2FBECA5BF87`
- UI standard: `docs/process/store-admin-surface-standardization-v1.md`
- Existing V1 plan: `docs/superpowers/plans/2026-06-17-sales-target-incentive-v1.md`
- Closeout evidence: `docs/evidence/sales-target-incentive-region-approval-flow-v1-closeout-2026-06-19.md`

Note: the checklist below records the implementation plan that drove the PR
train. Use the closeout evidence and merged PRs as the source of truth for what
actually shipped.

## Findings Fixed In This Revision

1. The previous plan exposed `admin_approved` and `admin_returned` statuses without endpoints that could create them. This revision adds admin package review commands.
2. The previous plan used `ops.sales_target_incentive_adjustment` for Region Manager draft/submitted corrections. That risks mixing pending BM edits with approved admin/payroll-impacting adjustments. This revision adds a separate `ops.sales_target_incentive_region_correction` table.
3. The previous plan did not define how submitted corrections become payable. This revision makes admin approval insert approved rows into the existing adjustment ledger.
4. The previous plan did not define submit idempotency and resubmission after return. This revision defines both.
5. The previous plan did not specify OpenAPI/client generation gates after endpoint changes. This revision adds them.
6. The previous plan did not call out concurrency around review toggles, correction edits, and package submission. This revision adds transaction/advisory-lock requirements.
7. The previous plan did not distinguish pre-close projection corrections from post-close final snapshot corrections. This revision locks the Region Manager approval flow to post-close final snapshot rows.
8. The previous plan did not snapshot the submitted store set. This revision adds a package-store snapshot so later assignment changes do not rewrite what the Region Manager submitted.
9. The previous plan used a loose period regex in new DTOs and SQL checks. This revision aligns all new period validation with the existing `YYYY-(01-12)` contract.
10. The previous plan mentioned OpenAPI/client generation but did not require updating the frontend selected-operation list. This revision makes `admin-web/scripts/generate-openapi-types.mjs` a required change when new endpoints are added.
11. The previous plan allowed store review to be reverted without defining audit cleanup. This revision requires clearing reviewer metadata when a store returns to `pending_review`.
12. The previous plan did not state what happens if store assignments change before submission. This revision requires submit-time assignment and current-region revalidation.
13. The previous plan placed region-package state inside every store projection. This revision separates region-period package workflow state from store-period review state in the API contract.
14. The previous plan treated localization cleanup as optional. This revision makes Store/Admin incentive copy migration mandatory.

## Scope

In scope:

- Persist `Kontrol edildi` per company store and period for Region Manager.
- Keep store review separate from correction, package submission, and admin approval.
- Let Region Manager create draft final-amount corrections with mandatory note.
- Let Region Manager submit one region-period package after all assigned company stores are checked and final snapshots exist for the period.
- Let admin see submitted packages, submitted corrections, notes, old/final amounts, and status.
- Let admin approve or return a submitted package.
- On admin approval, convert submitted Region Manager corrections into approved `ops.sales_target_incentive_adjustment` rows.
- Integrate the locked Region Manager `/store/incentives` prototype with live API state.

Out of scope:

- Incentive formula changes.
- Sales import/source binding changes.
- Month-end close-run logic changes.
- Payroll export.
- Cashier incentive.
- Bayi/isletme incentive visibility.
- Store Manager approval workflow. Store Manager only sees earned incentives.
- Admin partial approval per person. V1 admin review is package-level approve/return.

## Current Repo Facts

- Store read endpoint exists: `GET /api/store/incentives`.
- Admin read endpoint exists: `GET /api/admin/incentives`.
- Admin correction endpoint exists: `POST /api/admin/incentives/corrections`.
- Close endpoints exist under `/api/admin/incentives/close-status` and `/api/admin/incentives/close-runs`.
- Existing approved adjustment ledger is `ops.sales_target_incentive_adjustment`.
- Existing Store UI is `admin-web/src/pages/StoreIncentivesPage.tsx`.
- Existing Admin UI is `admin-web/src/pages/AdminIncentivesPage.tsx`.

## Target State Model

Use these status names in backend DTOs and frontend types:

```ts
type StoreReviewStatus = 'pending_review' | 'reviewed'
type RegionPackageStatus = 'not_submitted' | 'submitted' | 'admin_approved' | 'admin_returned'
type RegionCorrectionStatus = 'draft' | 'submitted' | 'admin_approved' | 'admin_returned' | 'voided'
type RegionCorrectionTargetScope = 'final_snapshot'
```

Product labels:

```ts
const storeReviewLabels = {
  pending_review: 'Kontrol edilmeli',
  reviewed: 'Kontrol edildi',
}

const packageLabels = {
  not_submitted: 'Onaya gönderilmedi',
  submitted: 'Bölge müdürü tarafından onaya gönderildi',
  admin_approved: 'Admin tarafından onaylandı',
  admin_returned: 'Revizyon istendi',
}
```

Transition rules:

```text
Store review:
pending_review -> reviewed
reviewed -> pending_review only while package is not submitted or admin_returned
When `reviewed -> pending_review`, clear `reviewed_by_user_id` and `reviewed_at` in the same write.

Region correction:
draft -> submitted
draft -> voided
submitted -> admin_approved
submitted -> admin_returned
admin_returned -> draft, when Region Manager edits and resubmits

Region package:
no row -> not_submitted
submitted -> admin_approved
submitted -> admin_returned
admin_returned -> submitted, when Region Manager resubmits after edits
admin_approved is terminal for V1
```

Period availability rule:

```text
projection_only -> read-only projection; no review, correction, submit, or admin package review
closed -> Region Manager review/correction/submit allowed
submitted/admin_approved/admin_returned -> package state rules apply
```

API response shape rule:

```ts
type RegionWorkflowState = {
  regionId: string
  regionPackageStatus: 'not_submitted' | 'submitted' | 'admin_approved' | 'admin_returned'
  regionPackageId: string | null
  submittedAt: string | null
  reviewedAt: string | null
  workflowLockedReason: string | null
}

type StoreProjectionReviewState = {
  storeReviewStatus: 'pending_review' | 'reviewed'
  reviewedByUserId: string | null
  reviewedAt: string | null
  periodCloseStatus: 'projection_only' | 'closed'
  workflowLockedReason: string | null
}
```

`RegionWorkflowState` belongs on the response root because it is region-period
state. `StoreProjectionReviewState` belongs on each store projection because it
is store-period state. Do not duplicate region-package state inside every store
row.

## File Map

Backend:

- Create: `db/migrations/053_sales_target_incentive_region_approval_flow.sql`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/sales-target-incentive-approval.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/sales-target-incentive-approval.repository.spec.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/mark-sales-target-incentive-store-review.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/create-sales-target-incentive-region-correction.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/void-sales-target-incentive-region-correction.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/submit-sales-target-incentive-region-package.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/review-sales-target-incentive-region-package.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops-incentive.module.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/store-sales-target-incentive.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/admin-sales-target-incentive.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/sales-target-incentive.controller.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/sales-target-incentive-api.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/sales-target-incentive-api.service.spec.ts`
- Modify: `backend/nestjs/test/integration/sales-target-incentive-read-api.e2e-spec.ts`

Frontend:

- Modify: `admin-web/src/features/incentives/api.ts`
- Modify: `admin-web/src/pages/store-incentives-model.ts`
- Modify: `admin-web/src/pages/store-incentives-widgets.tsx`
- Modify: `admin-web/src/pages/StoreIncentivesPage.tsx`
- Modify: `admin-web/src/pages/AdminIncentivesPage.tsx`
- Modify: `admin-web/e2e/store-incentives-projection.spec.ts`
- Modify: `admin-web/e2e/admin-incentives.spec.ts`
- Modify: `admin-web/src/features/localization/messages/store-incentives.ts`
- Modify: `admin-web/scripts/generate-openapi-types.mjs`

Docs/evidence:

- Create: `docs/evidence/sales-target-incentive-region-approval-flow-v1-closeout-2026-06-19.md`
- Modify: `docs/api/openapi.json` after `openapi:generate`.
- Modify: `admin-web/src/generated/openapi-types.ts` after `api:generate`.

## PR Plan

### PR 1: Schema And Repository Foundation

**Goal:** Add durable Region Manager workflow records without changing current read behavior.

**Files:**

- Create: `db/migrations/053_sales_target_incentive_region_approval_flow.sql`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/sales-target-incentive-approval.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/sales-target-incentive-approval.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops-incentive.module.ts`

- [ ] Add table `ops.sales_target_incentive_store_review`.

```sql
CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_store_review (
    sales_target_incentive_store_review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    review_status TEXT NOT NULL DEFAULT 'pending_review',
    reviewed_by_user_id UUID REFERENCES ops.user_account(user_id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (review_status IN ('pending_review', 'reviewed')),
    CHECK (review_status <> 'reviewed' OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_store_review_unique
    ON ops.sales_target_incentive_store_review (store_id, period_key);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_store_review_region_period
    ON ops.sales_target_incentive_store_review (region_id, period_key, review_status);
```

- [ ] Add table `ops.sales_target_incentive_region_package`.

```sql
CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_region_package (
    sales_target_incentive_region_package_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    package_status TEXT NOT NULL DEFAULT 'submitted',
    submitted_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submission_note TEXT,
    reviewed_by_user_id UUID REFERENCES ops.user_account(user_id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (package_status IN ('submitted', 'admin_approved', 'admin_returned')),
    CHECK (package_status = 'submitted' OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)),
    CHECK (package_status <> 'admin_returned' OR (review_note IS NOT NULL AND BTRIM(review_note) <> ''))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_region_package_unique
    ON ops.sales_target_incentive_region_package (region_id, period_key);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_region_package_company_period
    ON ops.sales_target_incentive_region_package (company_id, period_key, package_status);
```

- [ ] Add table `ops.sales_target_incentive_region_package_store`.

```sql
CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_region_package_store (
    sales_target_incentive_region_package_store_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_package_id UUID NOT NULL REFERENCES ops.sales_target_incentive_region_package(sales_target_incentive_region_package_id) ON DELETE CASCADE,
    store_review_id UUID NOT NULL REFERENCES ops.sales_target_incentive_store_review(sales_target_incentive_store_review_id),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    period_key CHAR(7) NOT NULL,
    reviewed_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    reviewed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_region_package_store_unique
    ON ops.sales_target_incentive_region_package_store (region_package_id, store_id);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_region_package_store_period
    ON ops.sales_target_incentive_region_package_store (region_id, period_key, store_id);
```

- [ ] Add table `ops.sales_target_incentive_region_correction`.

```sql
CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_region_correction (
    sales_target_incentive_region_correction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_package_id UUID REFERENCES ops.sales_target_incentive_region_package(sales_target_incentive_region_package_id),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    participant_type TEXT NOT NULL,
    target_scope TEXT NOT NULL DEFAULT 'final_snapshot',
    final_row_id UUID NOT NULL REFERENCES rpt.sales_target_incentive_final_row(sales_target_incentive_final_row_id),
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    before_amount NUMERIC(18,2) NOT NULL,
    final_amount NUMERIC(18,2) NOT NULL,
    adjustment_amount NUMERIC(18,2) NOT NULL,
    reason_note TEXT NOT NULL,
    correction_status TEXT NOT NULL DEFAULT 'draft',
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    submitted_by_user_id UUID REFERENCES ops.user_account(user_id),
    submitted_at TIMESTAMPTZ,
    reviewed_by_user_id UUID REFERENCES ops.user_account(user_id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    approved_adjustment_id UUID REFERENCES ops.sales_target_incentive_adjustment(sales_target_incentive_adjustment_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (participant_type IN ('store_manager', 'personnel')),
    CHECK (BTRIM(reason_note) <> ''),
    CHECK (target_scope = 'final_snapshot'),
    CHECK (before_amount <> final_amount),
    CHECK (adjustment_amount = final_amount - before_amount),
    CHECK (correction_status IN ('draft', 'submitted', 'admin_approved', 'admin_returned', 'voided')),
    CHECK (correction_status <> 'submitted' OR (region_package_id IS NOT NULL AND submitted_by_user_id IS NOT NULL AND submitted_at IS NOT NULL)),
    CHECK (correction_status NOT IN ('admin_approved', 'admin_returned') OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)),
    CHECK (correction_status <> 'admin_returned' OR (review_note IS NOT NULL AND BTRIM(review_note) <> '')),
    CHECK (correction_status <> 'admin_approved' OR approved_adjustment_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_region_correction_open_unique
    ON ops.sales_target_incentive_region_correction (store_id, employee_id, participant_type, period_key)
    WHERE correction_status IN ('draft', 'submitted', 'admin_returned');

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_region_correction_package
    ON ops.sales_target_incentive_region_correction (region_package_id, correction_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_region_correction_adjustment_unique
    ON ops.sales_target_incentive_region_correction (approved_adjustment_id)
    WHERE approved_adjustment_id IS NOT NULL;
```

- [ ] Repository methods:
  - `listWorkflowState({ periodKey, storeIds })`
  - `markStoreReview({ actorUserId, periodKey, store, reviewStatus })`
  - `createOrReplaceDraftCorrection(...)`
  - `voidDraftCorrection(...)`
  - `submitRegionPackage(...)`
  - `reviewRegionPackage(...)`
  - `listClosedFinalSnapshotTargets({ periodKey, storeIds })`
  - `listRegionPackagesForAdmin({ periodKey, companyIds, regionIds, storeIds })`

- [ ] Repository transaction rules:
  - use `pg_advisory_xact_lock` for `periodKey:regionId` when submitting or reviewing package,
  - use `pg_advisory_xact_lock` for `periodKey:storeId` when toggling store review,
  - use `pg_advisory_xact_lock` for `periodKey:storeId:employeeId:participantType` when creating or voiding correction.
  - package submission deletes and recreates `ops.sales_target_incentive_region_package_store` rows in the same transaction when resubmitting after return.

- [ ] Repository tests cover:
  - unique review upsert per store/period,
  - period SQL checks reject invalid months such as `2026-00` and `2026-99`,
  - review cannot be changed after package is `submitted` or `admin_approved`,
  - review can be changed after `admin_returned`,
  - reverting review to `pending_review` clears `reviewed_by_user_id` and `reviewed_at`,
  - package submission revalidates the actor's current assigned company-store set and current store region,
  - correction cannot have zero delta,
  - correction is rejected when the period has no latest final snapshot row for the employee,
  - correction always records `target_scope = 'final_snapshot'`,
  - package unique per region/period,
  - package submission snapshots the exact reviewed stores into `ops.sales_target_incentive_region_package_store`,
  - package resubmission after return replaces the package-store snapshot,
  - submitted corrections link to the submitted package,
  - admin approval is idempotent-safe and cannot create duplicate approved adjustments,
  - admin approval creates approved `ops.sales_target_incentive_adjustment` rows,
  - approved adjustment rows include `reason_code = 'region_manager_submission'`,
  - approved adjustment rows include `reason_note` copied from the Region Manager correction note,
  - approved adjustment rows include `before_amount`, `adjustment_amount`, and `after_amount = final_amount`,
  - approved adjustment rows include `status = 'approved'`, `created_by_user_id = submitted_by_user_id`, `approved_by_user_id = admin user`, and `approved_at = NOW()`,
  - approved adjustment rows include `evidence.regionCorrectionId`, `evidence.regionPackageId`, `evidence.submittedByUserId`, and `evidence.source = 'region_manager_submission'`,
  - admin return marks submitted corrections `admin_returned` without creating approved adjustments.

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/infrastructure/sales-target-incentive-approval.repository.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/sales-target-incentive-schema-contract.spec.ts --runInBand
```

Expected: PASS.

### PR 2: Store API For Review, Draft Correction, And Submit

**Goal:** Region Manager actions become live backend state.

**Files:**

- Create DTO files listed in File Map except admin review DTO.
- Modify `backend/nestjs/src/modules/store-ops/web/store-sales-target-incentive.controller.ts`
- Modify `backend/nestjs/src/modules/store-ops/application/sales-target-incentive-api.service.ts`
- Modify `backend/nestjs/src/modules/store-ops/web/sales-target-incentive.controller.spec.ts`
- Modify `backend/nestjs/src/modules/store-ops/application/sales-target-incentive-api.service.spec.ts`
- Modify `backend/nestjs/test/integration/sales-target-incentive-read-api.e2e-spec.ts`
- Modify `docs/api/openapi.json`
- Modify `admin-web/scripts/generate-openapi-types.mjs`
- Modify `admin-web/src/generated/openapi-types.ts`

- [ ] Extend the response root with region-period workflow state.

```ts
regionWorkflow: {
  regionId: string
  regionPackageStatus: 'not_submitted' | 'submitted' | 'admin_approved' | 'admin_returned'
  regionPackageId: string | null
  submittedAt: string | null
  reviewedAt: string | null
  workflowLockedReason: string | null
} | null
```

- [ ] Extend `SalesTargetIncentiveApiProjection` with store-period review state only.

```ts
review: {
  storeReviewStatus: 'pending_review' | 'reviewed'
  reviewedByUserId: string | null
  reviewedAt: string | null
  periodCloseStatus: 'projection_only' | 'closed'
  workflowLockedReason: string | null
}
```

- [ ] Extend row DTO for Region Manager correction.

```ts
regionCorrection: {
  correctionId: string
  status: 'draft' | 'submitted' | 'admin_approved' | 'admin_returned' | 'voided'
  targetScope: 'final_snapshot'
  beforeAmount: string
  adjustmentAmount: string
  finalAmount: string
  reasonNote: string
  createdByUserId: string
  createdAt: string
  submittedAt: string | null
  reviewedAt: string | null
  reviewNote: string | null
} | null
```

- [ ] Add Store endpoints:

```ts
@Post("incentives/store-reviews")
@RequireScope("authenticated")
@RequireRoles("REGION_MANAGER")
markStoreReview(...)

@Post("incentives/corrections")
@RequireScope("authenticated")
@RequireRoles("REGION_MANAGER")
createRegionCorrection(...)

@Post("incentives/corrections/void")
@RequireScope("authenticated")
@RequireRoles("REGION_MANAGER")
voidRegionCorrection(...)

@Post("incentives/submissions")
@RequireScope("authenticated")
@RequireRoles("REGION_MANAGER")
submitRegionPackage(...)
```

- [ ] DTO request shapes:

```ts
type MarkStoreReviewRequest = {
  period: string
  storeId: string
  reviewStatus: 'pending_review' | 'reviewed'
}

type RegionCorrectionRequest = {
  period: string
  storeId: string
  employeeId: string
  participantType: 'store_manager' | 'personnel'
  finalAmount: string
  reasonNote: string
}

type VoidRegionCorrectionRequest = {
  period: string
  correctionId: string
}

type SubmitRegionPackageRequest = {
  period: string
  regionId: string
  submissionNote?: string
}
```

- [ ] DTO validation rules:
  - `period` uses `@Matches(/^\d{4}-(0[1-9]|1[0-2])$/)`.
  - `storeId`, `employeeId`, `regionId`, and `correctionId` use `IsPostgresUuid`.
  - `reviewStatus` uses `@IsIn(['pending_review', 'reviewed'])`.
  - `participantType` uses `@IsIn(['store_manager', 'personnel'])`.
  - `finalAmount` uses `@Matches(/^\d+(\.\d{1,2})?$/)` and may be `0.00`.
  - `reasonNote` uses `@IsString`, `@Matches(/\S/)`, and `@Length(3, 1000)`.
  - `submissionNote` is optional but if present uses `@Length(1, 1000)`.

- [ ] OpenAPI/client generation rules:
  - add `/api/store/incentives/store-reviews` `post` to `selectedOperations` in `admin-web/scripts/generate-openapi-types.mjs`,
  - add `/api/store/incentives/corrections` `post` to `selectedOperations`,
  - add `/api/store/incentives/corrections/void` `post` to `selectedOperations`,
  - add `/api/store/incentives/submissions` `post` to `selectedOperations`,
  - implement new frontend mutations through `sendOpenApiJson('/api/...')`, not raw `sendJson('/api/...')`, so client path stripping stays consistent with `fetchOpenApiJson`,
  - run `npm.cmd --prefix backend/nestjs run openapi:generate`,
  - run `npm.cmd --prefix admin-web run api:generate`,
  - run `npm.cmd --prefix admin-web run api:check`,
  - run `npm.cmd --prefix admin-web run test:scripts`.

- [ ] Security rules:
  - Region Manager can mutate only assigned company stores.
  - Store Manager cannot call review/submit/correction endpoints.
  - Super Admin uses admin endpoints, not Store Region Manager submit endpoints.
  - Bayi/isletme stores remain invisible and immutable.
  - Cashier rows remain absent.
  - A Region Manager cannot submit a package for a region with no assigned company stores.
  - Review/correction/submit endpoints reject periods without final snapshot rows for all included stores.
  - Read responses may show `projection_only`, but all approval controls stay disabled until `periodCloseStatus = 'closed'`.

- [ ] Submit rule:
  - Backend uses the latest final snapshot rows for the period; mutable current projections are not eligible for submission.
  - Backend recomputes the current assigned company-store set for the actor and `regionId` inside the submit transaction.
  - Backend counts a `reviewed` row only when the store still belongs to the submitted region, is still a company store, and is still in the Region Manager's action-store assignment.
  - Backend rejects submission if any assigned company store in the period is not `reviewed`.
  - Backend rejects submission if any assigned company store has no latest final snapshot.
  - If a store moved away from the Region Manager before submit, the old review row stays historical but is not included in the submitted package.
  - Error payload includes `missingStoreCount` and `missingStoreIds`.
  - UI dialog uses this to show `Kontrol tamamlanmadı`.
  - Submitting again after `submitted` is idempotent.
  - Submitting after `admin_returned` creates a new submission timestamp and moves returned corrections back to `submitted`.
  - Submitting after `admin_approved` is rejected.

- [ ] Correction rule:
  - UI sends `finalAmount`, not delta.
  - Backend computes `currentAmount` from the latest final row plus already approved final-snapshot adjustments for the same row.
  - Backend computes `adjustmentAmount = finalAmount - currentAmount`.
  - `reasonNote` is required.
  - zero delta is rejected.
  - draft corrections are not included in `correctionAmount`, `adjustmentAmount`, or `finalAmount` calculation fields until admin approval.
  - correction edits are blocked while package is `submitted` or `admin_approved`.
  - correction edits are allowed after `admin_returned`.
  - correction target resolution uses only the latest final row for the selected period/store/employee/participant.
  - Region Manager reads closed periods from the latest final snapshot, so the drawer and correction amount match the locked close data.
  - if a final row is not found, the correction endpoint returns a product-safe blocked response and does not create a draft.

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/web/sales-target-incentive.controller.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/application/sales-target-incentive-api.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- test/integration/sales-target-incentive-read-api.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
```

Expected: PASS and generated API files have only intended endpoint/type changes.

### PR 3: Admin API Visibility And Package Review

**Goal:** Admin can see Region Manager packages and approve or return submitted packages.

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/web/dto/review-sales-target-incentive-region-package.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/admin-sales-target-incentive.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/sales-target-incentive-api.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/sales-target-incentive-approval.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/sales-target-incentive.controller.spec.ts`
- Modify: `backend/nestjs/test/integration/sales-target-incentive-read-api.e2e-spec.ts`
- Modify: `docs/api/openapi.json`
- Modify: `admin-web/scripts/generate-openapi-types.mjs`
- Modify: `admin-web/src/generated/openapi-types.ts`

- [ ] Extend admin response root:

```ts
regionPackages: Array<{
  regionId: string
  regionName: string
  submittedByUserId: string | null
  submittedByName: string | null
  submittedAt: string | null
  reviewedByUserId: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  reviewNote: string | null
  status: 'not_submitted' | 'submitted' | 'admin_approved' | 'admin_returned'
  storeCount: number
  reviewedStoreCount: number
  submittedStoreCount: number
  draftCorrectionCount: number
  submittedCorrectionCount: number
}>
```

- [ ] Admin package read rules:
  - `regionPackages` includes one row per company-region with visible company stores in the selected period.
  - If `ops.sales_target_incentive_region_package` has no row, return synthetic status `not_submitted`.
  - For submitted/approved/returned packages, store counts and package details use `ops.sales_target_incentive_region_package_store`.
  - For `not_submitted`, store counts use the current company-store set for the period and existing final snapshot availability.
  - Admin read must not create DB rows for `not_submitted`.

- [ ] Extend row correction data so admin can read Region Manager submitted changes with note.

```ts
regionCorrection: {
  correctionId: string
  status: 'submitted' | 'admin_approved' | 'admin_returned'
  targetScope: 'final_snapshot'
  beforeAmount: string
  adjustmentAmount: string
  finalAmount: string
  reasonNote: string
  submittedByName: string | null
  submittedAt: string | null
  reviewNote: string | null
} | null
```

- [ ] Add admin review endpoint:

```ts
@Post("region-packages/reviews")
@RequireScope("authenticated")
@RequireRoles("SUPER_ADMIN")
reviewRegionPackage(...)
```

- [ ] DTO request shape:

```ts
type ReviewRegionPackageRequest = {
  period: string
  regionId: string
  decision: 'approve' | 'return'
  reviewNote?: string
}
```

- [ ] DTO validation rules:
  - `period` uses `@Matches(/^\d{4}-(0[1-9]|1[0-2])$/)`.
  - `regionId` uses `IsPostgresUuid`.
  - `decision` uses `@IsIn(['approve', 'return'])`.
  - `reviewNote` is required for `return`; service rejects missing or blank notes.
  - `reviewNote` uses `@Length(1, 1000)` when present.

- [ ] OpenAPI/client generation rules:
  - add `/api/admin/incentives/region-packages/reviews` `post` to `selectedOperations` in `admin-web/scripts/generate-openapi-types.mjs`,
  - run `npm.cmd --prefix backend/nestjs run openapi:generate`,
  - run `npm.cmd --prefix admin-web run api:generate`,
  - run `npm.cmd --prefix admin-web run api:check`,
  - run `npm.cmd --prefix admin-web run test:scripts`.

- [ ] Review rules:
  - admin package detail uses `ops.sales_target_incentive_region_package_store` for submitted/approved/returned packages, not current assignment lookup,
  - approving a package changes package status to `admin_approved`,
  - approving a package changes submitted region corrections to `admin_approved`,
  - approving inserts approved rows into `ops.sales_target_incentive_adjustment` with `adjustment_scope = 'final_snapshot'` and `adjustment_type = 'manual_adjustment'`,
  - approval skips no correction rows; a package with zero corrections can still be approved,
  - approval rejects if any submitted correction already has `approved_adjustment_id` before the transaction starts,
  - approval uses each correction's `before_amount`, `adjustment_amount`, and `final_amount` as the ledger row's `before_amount`, `adjustment_amount`, and `after_amount`,
  - approval writes `evidence.regionCorrectionId`, `evidence.regionPackageId`, and `evidence.source = 'region_manager_submission'` on each approved adjustment,
  - approving writes audit events for package approval and each approved correction,
  - returning a package changes package status to `admin_returned`,
  - returning changes submitted corrections to `admin_returned`,
  - returning writes an audit event with the review note,
  - returned corrections do not affect payable/final amounts,
  - reviewing a `not_submitted` or already `admin_approved` package is rejected,
  - reviewing is single-transaction and guarded by `periodKey:regionId` advisory lock,
  - reviewing preserves existing admin manual correction endpoint behavior.

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/web/sales-target-incentive.controller.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/application/sales-target-incentive-api.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- test/integration/sales-target-incentive-read-api.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
```

Expected: PASS and generated API files have only intended endpoint/type changes.

### PR 4: Region Manager `/store/incentives` Prototype Integration

**Goal:** Replace the current Region Manager page with the locked command-center surface using live state.

**Files:**

- Modify: `admin-web/src/features/incentives/api.ts`
- Modify: `admin-web/src/pages/StoreIncentivesPage.tsx`
- Modify: `admin-web/src/pages/store-incentives-widgets.tsx`
- Modify: `admin-web/src/pages/store-incentives-model.ts`
- Modify: `admin-web/src/features/localization/messages/store-incentives.ts`
- Modify: `admin-web/e2e/store-incentives-projection.spec.ts`

- [ ] Component map:
  - Page shell: `StoreSurfacePage`
  - Header: compact Store surface header
  - Period picker: shadcn `Button` + `Popover`; month/year only
  - Filters: shadcn `Select`, `Input`, optional `ToggleGroup`
  - Metrics: Store metric primitive with one lucide icon each
  - Main store rows: `Table` desktop, card/accordion mobile
  - Person detail/edit: `Sheet` or `Drawer`
  - Submit confirmation: `AlertDialog`
  - Statuses: `Badge`/`StoreStatusBadge`

- [ ] Region Manager view:
  - title `Primler`
  - subtitle `Mağaza ve personel hakedişleri, düzeltmeler ve onay süreci.`
  - actions `Excel dışa aktar`, `Onaya gönder`
  - metrics:
    - `Toplam hakediş`
    - `Prim hakeden personel`
    - `Kontrol bekleyen mağaza`
    - `Düzeltme yapılan kayıt`
  - rows grouped by store.
  - if `periodCloseStatus = 'projection_only'`, show read-only projection state and disable review/correction/submit actions.
  - store row has `Kontrol edildi` persisted toggle.
  - person name opens drawer; do not add repeated `Düzenle` buttons.
  - drawer shows target achievement percent and progress.
  - drawer final amount edit saves draft correction with note.
  - package submit uses confirmation dialog.
  - after backend missing-store rejection, show `Kontrol tamamlanmadı` and `Kontrole dön`.

- [ ] Query/cache rules:
  - `storeSalesTargetIncentivesQueryKey` includes period, actor user id, and resolved role scope when available.
  - period picker updates the same `YYYY-MM` value used by backend DTO validation.
  - mark-review, create-correction, void-correction, and submit-package mutations invalidate the exact current-period store incentive query.
  - admin approve/return mutations invalidate both admin incentive package queries and affected store incentive queries.
  - no timer-based polling is added; refresh comes from initial query, explicit user refresh if present, and mutation invalidation only.

- [ ] Store Manager view:
  - remains no approval flow.
  - shows own store and personnel earned incentives only.
  - no `Kontrol edildi`, no `Onaya gönder`, no package state.

- [ ] Error/loading/empty copy:
  - replace old placeholder/future-state incentive copy in `admin-web/src/features/localization/messages/store-incentives.ts` with live product copy for Store Manager and Region Manager.
  - no `scope`, `API`, `DB`, `gerçek veri`, `kaynak temsil eder`.
  - no `henüz uygulanmadı`, `gelecek mağaza görünümü`, `sahte prim motoru`, or "payment model pending" copy on live incentive surfaces.
  - no raw period number input.
  - no native `<select>` in toolbar.

- [ ] E2E:
  - Region Manager marks store reviewed and request body is asserted.
  - Region Manager approval controls are disabled for `projection_only` fixtures.
  - Region Manager cannot submit until all stores are reviewed.
  - Region Manager cannot submit when any assigned store has no final snapshot.
  - Region Manager saves personnel final amount correction with note.
  - Region Manager resubmits after admin returned state fixture.
  - Region Manager submits package after all stores are reviewed.
  - Store Manager sees no approval controls.
  - mobile has no horizontal overflow.
  - no timer-based polling or 30-second auto-refresh is introduced; data refreshes through initial query, explicit refresh, and mutation invalidation.

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run test:e2e -- store-incentives-projection.spec.ts
npm.cmd --prefix admin-web run build
```

Expected: PASS.

### PR 5: Admin Incentive Package Review Surface And Closeout

**Goal:** Admin page reflects Region Manager package state, submitted corrections, and approve/return actions.

**Files:**

- Modify: `admin-web/src/features/incentives/api.ts`
- Modify: `admin-web/src/pages/AdminIncentivesPage.tsx`
- Modify: `admin-web/e2e/admin-incentives.spec.ts`
- Create: `docs/evidence/sales-target-incentive-region-approval-flow-v1-closeout-2026-06-19.md`

- [ ] Admin page groups by Region Manager/region first.
- [ ] If not submitted, show `Onaya gönderilmedi`.
- [ ] If submitted, show `Bölge müdürü tarafından onaya gönderildi`.
- [ ] If approved, show `Admin tarafından onaylandı`.
- [ ] If returned, show `Revizyon istendi`.
- [ ] Submitted package detail shows:
  - stores,
  - personnel rows,
  - old amount,
  - new/final amount,
  - difference,
  - Region Manager note,
  - submitted by,
  - submitted at.
- [ ] Submitted/approved/returned package details use submitted package-store snapshot rows, so later assignment changes do not change historical package contents.
- [ ] Admin actions:
  - `Onayla`
  - `Revizyon iste`
  - `Revizyon iste` requires note.
- [ ] Existing admin manual correction panel still works.
- [ ] No payroll export is added.

- [ ] E2E:
  - admin sees unsubmitted package state,
  - admin sees submitted package state and submitted correction note,
  - admin sees submitted store count from package snapshot,
  - admin approve sends review endpoint payload,
  - admin return requires review note and sends review endpoint payload,
  - existing admin correction scenario still passes,
  - Excel export still works.
  - no timer-based polling or 30-second auto-refresh is introduced.

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run test:e2e -- admin-incentives.spec.ts
npm.cmd --prefix admin-web run build
npm.cmd run check:release
```

Expected: PASS or documented pre-existing unrelated failure only.

## Release Order

1. Merge PR 1.
2. Deploy backend migration only after PR 1 is merged.
3. Merge PR 2 and deploy backend.
4. Merge PR 3 and deploy backend.
5. Merge PR 4 and deploy frontend.
6. Merge PR 5 and deploy frontend.

Do not ship PR 4 before PR 2 and PR 3 backend endpoints are deployed; otherwise the prototype controls will be visible without live state.

## Acceptance Criteria

- `Kontrol edildi` persists after refresh.
- Reverting a reviewed store to `pending_review` clears reviewer metadata.
- Region Manager correction survives refresh as a draft/submitted/returned correction.
- Region Manager review/correction/submit actions are blocked until the period has final snapshots.
- Region Manager corrections target final snapshot rows only.
- Region Manager cannot submit a period package with unchecked stores.
- Region Manager cannot submit a period package when a store is missing final snapshot data.
- Region Manager submit revalidates current assigned company stores and current store region before packaging.
- Submitted package store contents are stable even if assignments change later.
- API response keeps region-period package workflow on `data.regionWorkflow` and store-period review state on each store projection.
- Store Manager sees no approval controls.
- Admin sees package status per Region Manager/region.
- Admin sees Region Manager correction notes and amount changes.
- Admin can approve a submitted package.
- Admin can return a submitted package with a note.
- Approved Region Manager corrections become approved `ops.sales_target_incentive_adjustment` rows.
- Admin approval cannot create duplicate approved adjustment rows on retry.
- Returned Region Manager corrections do not affect payable/final amounts.
- Existing admin correction and close-run endpoints still pass tests.
- Existing incentive calculation results do not change.
- Dealer/operator stores and cashier users still see no incentive surface.
- `/store/incentives` matches the locked command-center prototype in structure, density, icon rhythm, copy, drawer, dialog, and mobile behavior.
- `/store/incentives` does not introduce timer-based polling or full-page refresh behavior.
- Store/Admin incentive surfaces no longer show old future-placeholder copy such as `henüz uygulanmadı`, `sahte prim motoru`, or payment-model pending language.
- Generated OpenAPI frontend types include every new Store/Admin incentive workflow mutation through `admin-web/scripts/generate-openapi-types.mjs` selected operations.

## Verification Matrix

Backend:

```powershell
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/infrastructure/sales-target-incentive-approval.repository.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/web/sales-target-incentive.controller.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/application/sales-target-incentive-api.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- test/integration/sales-target-incentive-read-api.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix backend/nestjs run build
```

Frontend:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix admin-web run test:scripts
npm.cmd --prefix admin-web run test:e2e -- store-incentives-projection.spec.ts
npm.cmd --prefix admin-web run test:e2e -- admin-incentives.spec.ts
npm.cmd --prefix admin-web run build
```

Root:

```powershell
npm.cmd run check:release
```

## Self Review

- Spec coverage: review state, correction drafts, package submission, admin visibility, admin approve/return, Store Manager no-approval view, company-store-only rule, cashier exclusion, and prototype parity are covered.
- Placeholder scan: no placeholder markers remain.
- Type consistency: package/correction statuses now match schema, DTO, backend response, and frontend model.
- Risk: `region_id + period_key` assumes HR Axis regions represent Region Manager regions, matching current master-data setup.
- Risk: admin approval of Region Manager corrections inserts approved adjustment rows; implementation must reuse or mirror existing adjustment ledger semantics so admin correction totals remain consistent.
- Risk: Region Manager approval is intentionally post-close only. If the owner later wants pre-close review, that should be a separate projection-review feature, not mixed into this financial approval path.
- Risk: closed-period Region Manager views must use latest final snapshot rows. Using mutable projection amounts after close would break the owner's month-close review workflow.
- Risk: package-store snapshots are required because Region Manager/store assignments can change after submission.
- Risk: OpenAPI generation may rewrite `docs/api/openapi.json`; this is now an explicit PR 2/PR 3 gate rather than a hidden release surprise.
