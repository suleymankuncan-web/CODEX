# Store Targets Adaptive Approval Flow V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production `/store/targets` region-manager approval flow use one adaptive primary action: `Onayla` when nothing changed, `Düzenleyerek onayla` when the reviewer edits the submitted target distribution.

**Architecture:** Keep the existing target request workflow and `request_status = 'approved'` semantics intact. Extend the existing approve endpoint with optional final approved allocation fields, so the backend promotes the final distribution into `ops.personnel_target_reference` while preserving original and adjusted values in audit metadata. Replace the approval accordion's read-only allocation view with a scoped editable review surface and a single adaptive primary button.

**Tech Stack:** NestJS, class-validator/class-transformer, Postgres repository transaction, React, TanStack Query, shadcn/ui `Button/Input/Textarea/Badge`, Tailwind v4 `tw:` classes, Playwright E2E, Jest.

---

## Current Evidence

- Frontend approval mutation currently sends only `approvalNote`.
  - `admin-web/src/features/targets/api.ts`
  - `approveTargetDistributionRequest({ requestId, approvalNote })`
- Production approval UI is read-only for allocations.
  - `admin-web/src/pages/store-targets-contract-sections.tsx`
  - `TargetApprovalQueue` renders request allocations as text and has one `Onayla` button.
- Backend approve DTO accepts only `approvalNote`.
  - `backend/nestjs/src/modules/store-ops/web/dto/approve-target-distribution-request.dto.ts`
- Backend repository promotes the request's existing `allocation_json`.
  - `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts`
  - `approveRequest()` updates status and inserts `ops.personnel_target_reference` rows from `allocation_json`.
- Existing status consumers expect `approved`, not a new status.
  - `/store/approvals`, workflow inbox, admin target queue, target coverage, incentive read model.

## Non-Goals

- Do not add a new target request status such as `adjusted_approved`.
- Do not add a DB migration unless implementation discovers that audit metadata is insufficient.
- Do not change store-manager submission semantics.
- Do not add a Region Manager action named `Hedef iste`; missing target rows are read-only waiting states until the Store Manager submits a target request.
- Do not change role/scope guards.
- Do not change target coverage meaning.
- Do not remove the existing revision request tab in this PR.
- Do not redesign the whole targets page beyond the approval review surface needed for this flow.

## File Map

- Modify: `backend/nestjs/src/modules/store-ops/web/dto/approve-target-distribution-request.dto.ts`
  - Add optional `approvedTotalTargetValue` and `approvedAllocations`.
- Test: `backend/nestjs/src/modules/store-ops/web/dto/approve-target-distribution-request.dto.spec.ts`
  - Add approve DTO validation tests for note-only and edited final allocation payloads.
- Modify: `backend/nestjs/src/modules/store-ops/application/target-distribution.service.ts`
  - Validate edited approval payload against request scope and active store personnel.
- Modify/Test: `backend/nestjs/src/modules/store-ops/application/target-distribution.service.spec.ts`
  - Cover edited approval validation and no-edit backward compatibility.
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts`
  - Approve with optional final allocations by updating `total_target_value`, `allocation_count`, and `allocation_json` before promotion.
- Modify/Test: `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`
  - Prove adjusted allocations are promoted and audit metadata records original vs final distribution.
- Modify: `backend/nestjs/src/modules/store-ops/web/target-distribution.controller.ts`
  - Pass optional final approved allocation fields to service.
- Generated: `docs/api/openapi.json`
  - Regenerate because the approve DTO shape changes.
- Generated: `admin-web/src/generated/openapi-types.ts`
  - Run API generation/check after backend OpenAPI changes.
- Modify: `admin-web/src/features/targets/api.ts`
  - Add optional `approvedTotalTargetValue` and `approvedAllocations` to `approveTargetDistributionRequest`.
- Modify: `admin-web/src/pages/store-targets-page-model.ts`
  - Add copy keys for `Düzenleyerek onayla`, balance/difference labels, and validation states.
- Modify: `admin-web/src/pages/store-targets-contract-sections.tsx`
  - Replace read-only approval allocation rows with editable draft rows and one adaptive primary button.
- Modify/Test: `admin-web/e2e/store-targets-surfaces.spec.ts`
  - Add adaptive-button and adjusted-payload coverage.

---

### Task 1: Backend DTO Contract

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/approve-target-distribution-request.dto.ts`
- Test: `backend/nestjs/src/modules/store-ops/web/dto/approve-target-distribution-request.dto.spec.ts`

- [ ] **Step 1: Add failing DTO tests**

Create `backend/nestjs/src/modules/store-ops/web/dto/approve-target-distribution-request.dto.spec.ts`:

```ts
import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ApproveTargetDistributionRequestDto } from "./approve-target-distribution-request.dto";

describe("ApproveTargetDistributionRequestDto", () => {
  it("accepts the existing note-only approve payload", async () => {
    const dto = plainToInstance(ApproveTargetDistributionRequestDto, {
      approvalNote: "Uygun",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("accepts an edited final allocation payload", async () => {
    const dto = plainToInstance(ApproveTargetDistributionRequestDto, {
      approvalNote: "Bölge müdürü hedefleri dengeledi.",
      approvedTotalTargetValue: 175000,
      approvedAllocations: [
        {
          employeeId: "00000000-0000-0000-0000-000000000501",
          assigneeLabel: "Ada Kaya",
          targetValue: 100000,
          note: "Düzenlendi",
        },
        {
          employeeId: "00000000-0000-0000-0000-000000000502",
          assigneeLabel: "Ece Demir",
          targetValue: 75000,
        },
      ],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("rejects edited allocations without an employee id", async () => {
    const dto = plainToInstance(ApproveTargetDistributionRequestDto, {
      approvedTotalTargetValue: 175000,
      approvedAllocations: [
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

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/web/dto/approve-target-distribution-request.dto.spec.ts
```

Expected: fail because `approvedTotalTargetValue` and `approvedAllocations` do not exist.

- [ ] **Step 3: Extend approve DTO**

Implement in `approve-target-distribution-request.dto.ts`:

```ts
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

class ApproveTargetDistributionAllocationDto {
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

export class ApproveTargetDistributionRequestDto {
  @IsOptional()
  @IsString()
  approvalNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  approvedTotalTargetValue?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApproveTargetDistributionAllocationDto)
  approvedAllocations?: ApproveTargetDistributionAllocationDto[];
}
```

- [ ] **Step 4: Run DTO tests**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/web/dto/approve-target-distribution-request.dto.spec.ts
```

Expected: pass.

---

### Task 2: Backend Service Validation

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/application/target-distribution.service.ts`
- Test: `backend/nestjs/src/modules/store-ops/application/target-distribution.service.spec.ts`

- [ ] **Step 1: Add service tests for edited approve payload**

Add tests that cover:

```ts
it("approves with edited allocations when every employee belongs to the request store", async () => {
  const targetDistributionRepository = {
    getRequestScope: jest.fn().mockResolvedValue({ storeId: "00000000-0000-0000-0000-000000000201" }),
    approveRequest: jest.fn().mockResolvedValue({ requestId: "request-1" }),
  };
  const storeOpsRepository = {
    listStorePersonnelTargetingRows: jest.fn().mockResolvedValue([
      { employee_id: "00000000-0000-0000-0000-000000000501" },
      { employee_id: "00000000-0000-0000-0000-000000000502" },
    ]),
  };
  const service = new TargetDistributionService(
    targetDistributionRepository as never,
    storeOpsRepository as never,
  );

  await service.approveRequest({
    actorUserId: "region-user",
    actorActionScope: { assignedStoreIds: ["00000000-0000-0000-0000-000000000201"] },
    requestId: "00000000-0000-0000-0000-000000000701",
    approvalNote: "Düzenlendi",
    approvedTotalTargetValue: 175000,
    approvedAllocations: [
      { employeeId: "00000000-0000-0000-0000-000000000501", assigneeLabel: "Ada Kaya", targetValue: 100000 },
      { employeeId: "00000000-0000-0000-0000-000000000502", assigneeLabel: "Ece Demir", targetValue: 75000 },
    ],
  });

  expect(targetDistributionRepository.approveRequest).toHaveBeenCalledWith(
    expect.objectContaining({
      approvedTotalTargetValue: 175000,
      approvedAllocations: expect.arrayContaining([
        expect.objectContaining({ employeeId: "00000000-0000-0000-0000-000000000501", targetValue: 100000 }),
      ]),
    }),
  );
});
```

Add rejection tests:

```ts
it("rejects edited approve payloads when allocation total does not equal approved total", async () => {
  // same repository mocks as above
  await expect(
    service.approveRequest({
      actorUserId: "region-user",
      actorActionScope: { assignedStoreIds: ["00000000-0000-0000-0000-000000000201"] },
      requestId: "00000000-0000-0000-0000-000000000701",
      approvalNote: "Düzenlendi",
      approvedTotalTargetValue: 175000,
      approvedAllocations: [
        { employeeId: "00000000-0000-0000-0000-000000000501", assigneeLabel: "Ada Kaya", targetValue: 100000 },
      ],
    }),
  ).rejects.toThrow("Approved allocation total must match the approved target total");
});
```

```ts
it("requires a note when approving edited target allocations", async () => {
  // same repository mocks as above
  await expect(
    service.approveRequest({
      actorUserId: "region-user",
      actorActionScope: { assignedStoreIds: ["00000000-0000-0000-0000-000000000201"] },
      requestId: "00000000-0000-0000-0000-000000000701",
      approvedTotalTargetValue: 100000,
      approvedAllocations: [
        { employeeId: "00000000-0000-0000-0000-000000000501", assigneeLabel: "Ada Kaya", targetValue: 100000 },
      ],
    }),
  ).rejects.toThrow("Approval note is required when target allocations are edited");
});
```

- [ ] **Step 2: Run service tests and confirm failure**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/target-distribution.service.spec.ts
```

Expected: fail because service does not pass edited allocations to repository.

- [ ] **Step 3: Implement service validation**

Update `approveRequest()` input type with:

```ts
approvedTotalTargetValue?: number;
approvedAllocations?: Array<{
  employeeId: string;
  assigneeLabel: string;
  targetValue: number;
  note?: string;
}>;
```

When `approvedAllocations` is present:

- Require `approvalNote.trim()`.
- Require `approvedTotalTargetValue !== undefined`.
- Require sum of `targetValue` equals `approvedTotalTargetValue`.
- Call the existing active-personnel source for `requestScope.storeId`.
- Reject any edited allocation whose `employeeId` is not active in that store.
- Pass `approvedTotalTargetValue` and normalized `approvedAllocations` to repository.

- [ ] **Step 4: Run service tests**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/target-distribution.service.spec.ts
```

Expected: pass.

---

### Task 3: Backend Repository Final Allocation Promotion

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts`
- Test: `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`

- [ ] **Step 1: Add repository test for adjusted approval**

Extend `promotes approved allocations into personnel target references` or add a new test:

```ts
it("persists edited final allocations before promotion", async () => {
  const originalAllocations = [
    { employeeId: "00000000-0000-0000-0000-000000000501", assigneeLabel: "Ada Kaya", targetValue: 120000 },
  ];
  const approvedAllocations = [
    { employeeId: "00000000-0000-0000-0000-000000000501", assigneeLabel: "Ada Kaya", targetValue: 100000 },
    { employeeId: "00000000-0000-0000-0000-000000000502", assigneeLabel: "Ece Demir", targetValue: 75000 },
  ];
  const requestRow = {
    target_distribution_request_id: "00000000-0000-0000-0000-000000000701",
    company_id: "00000000-0000-0000-0000-000000000001",
    region_id: "00000000-0000-0000-0000-000000000010",
    store_id: "00000000-0000-0000-0000-000000000201",
    request_month: "2026-03-01",
    target_label: "Aylik personel hedef dagitimi",
    total_target_value: "175000",
    allocation_count: 2,
    request_status: "approved",
    request_reason: null,
    allocation_json: approvedAllocations,
    submitted_by_user_id: "store-manager-user",
    approved_by_user_id: "region-manager-user",
    approved_at: "2026-03-02T08:00:00.000Z",
    approval_note: "Düzenlendi",
    created_at: "2026-03-01T08:00:00.000Z",
    updated_at: "2026-03-02T08:00:00.000Z",
  };
  const query = createRepositoryQueryMock()
    .mockResolvedValueOnce({ rows: [requestRow] })
    .mockResolvedValue({ rows: [] });
  const withTransaction = jest.fn(async (callback) => callback({ query }));
  const repository = new TargetDistributionRepository({ withTransaction } as never);

  await repository.approveRequest({
    requestId: requestRow.target_distribution_request_id,
    approverUserId: "region-manager-user",
    approvalNote: "Düzenlendi",
    approvedTotalTargetValue: 175000,
    approvedAllocations,
    originalAllocations,
  });

  const updateCall = query.mock.calls[0];
  expect(updateCall[0]).toContain("allocation_json");
  expect(updateCall[1]).toContain(JSON.stringify(approvedAllocations));

  const targetReferenceCalls = findExecutedQueries(query, "INSERT INTO ops.personnel_target_reference");
  expect(targetReferenceCalls).toHaveLength(2);

  const auditCall = findExecutedQuery(query, "INSERT INTO audit.event_log");
  expect(JSON.parse(auditCall?.params[5] as string)).toMatchObject({
    approvalMode: "adjusted",
    promotedTargetReferenceCount: 2,
  });
});
```

- [ ] **Step 2: Run repository tests and confirm failure**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts
```

Expected: fail because repository ignores final allocation payload.

- [ ] **Step 3: Implement repository support**

Change `approveRequest(input)` to accept:

```ts
approvedTotalTargetValue?: number;
approvedAllocations?: Array<{
  employeeId: string;
  assigneeLabel: string;
  targetValue: number;
  note?: string;
}>;
```

When final allocations are present, update:

- `total_target_value = $approvedTotalTargetValue`
- `allocation_count = approvedAllocations.length`
- `allocation_json = JSON.stringify(approvedAllocations)`
- `request_status = 'approved'`
- `approval_note = input.approvalNote`

When final allocations are absent, keep current behavior exactly.

Audit metadata must include:

```ts
{
  approvalMode: input.approvedAllocations ? "adjusted" : "direct",
  approvalNote: input.approvalNote ?? null,
  promotedTargetReferenceCount: allocations.length,
  originalAllocationCount: originalAllocations.length,
  finalAllocationCount: allocations.length
}
```

Do not change `request_status` enum.

- [ ] **Step 4: Run repository tests**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts
```

Expected: pass.

---

### Task 4: Controller, OpenAPI, Frontend API Contract

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/web/target-distribution.controller.ts`
- Modify: `admin-web/src/features/targets/api.ts`
- Generated: `docs/api/openapi.json`
- Generated: `admin-web/src/generated/openapi-types.ts`

- [ ] **Step 1: Pass fields from controller to service**

In `target-distribution.controller.ts`, pass:

```ts
approvedTotalTargetValue: body.approvedTotalTargetValue,
approvedAllocations: body.approvedAllocations,
```

- [ ] **Step 2: Extend frontend mutation input**

In `admin-web/src/features/targets/api.ts`, update:

```ts
export async function approveTargetDistributionRequest(input: {
  requestId: string
  approvalNote?: string
  approvedTotalTargetValue?: number
  approvedAllocations?: TargetDistributionAllocation[]
}) {
  return sendJson<CommandResponse<{ request: TargetDistributionRequest }>>(
    `/target-distributions/requests/${input.requestId}/approve`,
    {
      method: 'PATCH',
      body: {
        approvalNote: input.approvalNote,
        approvedTotalTargetValue: input.approvedTotalTargetValue,
        approvedAllocations: input.approvedAllocations,
      },
    },
  )
}
```

- [ ] **Step 3: Regenerate OpenAPI**

Run:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
```

Expected: `docs/api/openapi.json` and `admin-web/src/generated/openapi-types.ts` include the new optional approve fields.

- [ ] **Step 4: API check**

Run:

```powershell
npm.cmd --prefix admin-web run api:check
```

Expected: pass.

---

### Task 5: Production UI Adaptive Approval Surface

**Files:**
- Modify: `admin-web/src/pages/store-targets-page-model.ts`
- Modify: `admin-web/src/pages/store-targets-contract-sections.tsx`
- Modify: `admin-web/src/pages/StoreTargetsPage.tsx` only if state must be lifted.

- [ ] **Step 1: Add copy keys**

Add Turkish and English copy:

```ts
approveAdjusted: 'Düzenleyerek onayla',
approvalEditedNoteRequired: 'Düzenleme yaptıysanız karar notu zorunlu.',
approvalAllocationMismatch: 'Personel hedef toplamı mağaza hedefiyle eşleşmeli.',
resetApprovalDraft: 'Değişiklikleri sıfırla',
```

English equivalents:

```ts
approveAdjusted: 'Approve with edits',
approvalEditedNoteRequired: 'A decision note is required when targets are edited.',
approvalAllocationMismatch: 'Personnel target total must match the store target.',
resetApprovalDraft: 'Reset changes',
```

- [ ] **Step 2: Add approval draft state inside `TargetApprovalQueue`**

Keep state local to the approval queue:

```ts
const [approvalDrafts, setApprovalDrafts] = useState<
  Record<string, Record<string, number>>
>({})
```

Initialize per request from `request.allocations` when opened. Compute:

```ts
const draftAllocations = request.allocations.map((allocation) => ({
  ...allocation,
  targetValue:
    approvalDrafts[request.requestId]?.[allocation.employeeId] ??
    Number(allocation.targetValue || 0),
}))
const draftTotal = draftAllocations.reduce((sum, allocation) => sum + Number(allocation.targetValue || 0), 0)
const originalTotal = Number(request.totalTargetValue || 0)
const hasEditedTargets = draftAllocations.some(
  (allocation) => Number(allocation.targetValue || 0) !== Number(request.allocations.find((item) => item.employeeId === allocation.employeeId)?.targetValue || 0),
)
const isBalanced = draftTotal === originalTotal
const canApproveEdited = canApprove && hasEditedTargets && isBalanced && Boolean(approvalNote)
const buttonLabel = hasEditedTargets ? input.copy.approveAdjusted : input.copy.approve
```

- [ ] **Step 3: Replace allocation text rows with editable rows**

For each allocation row in the open approval surface:

- Keep employee name visible.
- Replace target amount text with numeric `Input`.
- Keep share badge based on `draftTotal` or `originalTotal` consistently.
- Show a compact difference/total summary below rows.
- Add `Değişiklikleri sıfırla` only when `hasEditedTargets`.

- [ ] **Step 4: Make the primary button adaptive**

The single `Button` onClick must send:

```ts
input.approveMutation.mutate({
  requestId: request.requestId,
  ...(approvalNote ? { approvalNote } : {}),
  ...(hasEditedTargets
    ? {
        approvedTotalTargetValue: originalTotal,
        approvedAllocations: draftAllocations,
      }
    : {}),
})
```

Disable button when:

- `!canApprove`
- mutation pending
- `hasEditedTargets && !isBalanced`
- `hasEditedTargets && !approvalNote`

The visible label:

- `Onayla` when `hasEditedTargets === false`
- `Düzenleyerek onayla` when `hasEditedTargets === true`

- [ ] **Step 5: Preserve no-edit behavior**

If user only writes a note and does not change targets, payload must remain:

```json
{
  "approvalNote": "Bölge onayı"
}
```

No adjusted allocation fields should be sent.

---

### Task 6: Frontend E2E Coverage

**Files:**
- Modify: `admin-web/e2e/store-targets-surfaces.spec.ts`

- [ ] **Step 1: Update existing direct approval test**

Keep the existing assertion:

```ts
expect(capturedPayload).toEqual({
  approvalNote: 'Bolge onayi',
})
```

Expected: unchanged direct approve flow still passes.

- [ ] **Step 2: Add adjusted approval test**

Add a new test:

```ts
test('region manager approval button becomes adjusted approval after target edits', async ({ page }) => {
  let capturedPayload: unknown = null;
  // Reuse region-manager auth, pending target request, coverage, and personnel fixtures.
  // Route PATCH /target-distributions/requests/:id/approve and capture payload.

  await page.goto('/store/targets');
  await page.getByLabel('Donem').fill('2026-05');
  await expect(page.getByRole('heading', { name: 'Onay akisi' })).toBeVisible();
  await page.getByRole('button', { name: /Mayis hedef dagitimi|IstinyePark Demo Store/ }).click();

  await expect(page.getByRole('button', { name: 'Onayla' })).toBeVisible();
  await page.getByLabel('Store Personnel Hedef').fill('140000');
  await expect(page.getByRole('button', { name: 'Düzenleyerek onayla' })).toBeDisabled();
  await page.getByLabel('Karar notu').fill('Bölge hedefi dengeledi');
  await expect(page.getByRole('button', { name: 'Düzenleyerek onayla' })).toBeEnabled();
  await page.getByRole('button', { name: 'Düzenleyerek onayla' }).click();

  expect(capturedPayload).toMatchObject({
    approvalNote: 'Bölge hedefi dengeledi',
    approvedTotalTargetValue: 145000,
    approvedAllocations: expect.any(Array),
  });
});
```

Use the visible allocation input label generated by `TargetApprovalQueue`, for example
`Store Personnel Hedef`, and keep the test on `/store/targets` rather than the
separate `/store/approvals` request center.

- [ ] **Step 3: Run targeted E2E**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-targets-surfaces.spec.ts
```

Expected: pass.

---

### Task 7: Full Verification

**Files:**
- No code changes.

- [ ] **Step 1: Backend targeted tests**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/web/dto/approve-target-distribution-request.dto.spec.ts src/modules/store-ops/application/target-distribution.service.spec.ts src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts
```

Expected: pass.

- [ ] **Step 2: Backend build**

Run:

```powershell
npm.cmd --prefix backend/nestjs run build
```

Expected: pass.

- [ ] **Step 3: Frontend gates**

Run:

```powershell
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-targets-surfaces.spec.ts
```

Expected: pass.

- [ ] **Step 4: Manual browser check**

Run the app locally and verify:

1. Open `/store/targets` as Region Manager.
2. Open a pending target request.
3. Without edits, button says `Onayla`.
4. Edit a personnel target.
5. Button changes to `Düzenleyerek onayla`.
6. If totals mismatch, button is disabled or validation copy is visible.
7. If totals match but note is empty, button remains blocked.
8. Add note and approve.
9. Approved view shows all personnel with final values.

---

## Risk Review

- **Hidden side effect:** Overwriting `allocation_json` means the request row now stores final approved distribution. Mitigation: audit metadata records `approvalMode`, original/final counts, and original/final allocation snapshots if added during implementation.
- **Compatibility:** Existing note-only approve payload remains valid. Existing consumers still see `status: approved`.
- **Security:** Edited allocations must be validated against active personnel in the request store. Frontend validation is not trusted.
- **Performance:** Edited allocation arrays are small, bounded by active store personnel. No new polling or page refresh is introduced.
- **Maintenance:** Do not create a separate `adjusted-approved` status unless product explicitly wants a new lifecycle state later.
- **Testing gap to avoid:** A test must prove unchanged approvals do not send adjusted payload fields.

## Self-Review

- Spec coverage: adaptive button, edited approval, note requirement, backend final allocation promotion, no status change, and backward compatibility are covered.
- Placeholder scan: no TBD/TODO/fill-later instructions remain.
- Type consistency: `approvedTotalTargetValue` and `approvedAllocations` names are used consistently across DTO, service, repository, API client, and E2E payload.
- Boundary check: `/store/approvals`, workflow inbox, and incentive readers remain compatible because `request_status` remains `approved`.
