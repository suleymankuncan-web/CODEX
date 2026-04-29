# VM Checklist V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `VISUAL_MERCHANDISER` users use only checklist-related surfaces and perform `VM_STORE_VISIT` checklists for assigned stores without opening broad admin/store access.

**Architecture:** Extend the existing checklist engine by role/type guards instead of creating a new VM module. Backend filters mobile checklist read models by allowed template type, enforces role/template/store scope on every mutation, and the frontend renders a checklist-only VM surface over the same `/store/checklists` route.

**Tech Stack:** NestJS, TypeScript, PostgreSQL, Jest, Supertest, React/Vite, TanStack Query, Playwright.

---

## Scope Boundary

This plan implements only VM checklist action enablement.

In scope:

- `VISUAL_MERCHANDISER` can read assigned-store VM checklist coverage.
- `VISUAL_MERCHANDISER` can start `VM_STORE_VISIT` for assigned stores.
- `VISUAL_MERCHANDISER` can save item scores for VM checklist instances.
- `VISUAL_MERCHANDISER` can complete VM checklist instances.
- `VISUAL_MERCHANDISER` cannot mutate `BM_STORE_VISIT`.
- `REGION_MANAGER` keeps BM checklist behavior and cannot mutate `VM_STORE_VISIT` in V1.
- VM users see checklist-only navigation/surfaces in the store shell.

Out of scope:

- monthly store score blend change to KPI `90%` + BM `5%` + VM `5%`
- VM photo attachments
- offline checklist mode
- cancel with reason
- all-store automatic VM assignment
- VM-specific admin report
- new checklist table family

## Existing Code Map

Backend:

- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts`
- Modify: `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`

Frontend:

- Modify: `admin-web/src/features/checklists/api.ts`
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`
- Modify: `admin-web/src/App.tsx`
- Modify: `admin-web/e2e/checklist-today-surfaces.spec.ts`

Docs:

- Modify: `current-state.md`

No migration is expected for this phase because `ChecklistTemplateType` already includes `VM_STORE_VISIT` and checklist tables already store `template_type`.

## Task 1: Backend Role/Template Type Guard

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts`
- Modify: `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`

- [ ] **Step 1: Add failing mutation permission tests**

Extend `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts` with tests equivalent to:

```ts
it("lets visual merchandisers start VM checklists for assigned stores", async () => {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("SELECT ct.checklist_template_id") && sql.includes("ct.template_type")) {
      return {
        rows: [{ checklist_template_id: vmTemplateId, template_type: "VM_STORE_VISIT" }],
      };
    }

    if (sql.includes("INSERT INTO ops.checklist_instance")) {
      return {
        rows: [
          {
            checklist_instance_id: "33333333-3333-4333-8333-333333333333",
            status: "in_progress",
            created_at: "2026-04-29T10:00:00.000Z",
          },
        ],
      };
    }

    return { rows: [] };
  });

  const app = await createIntegrationApp({
    databaseService: {
      query,
      withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
        work({ query }),
    },
  });

  const response = await request(app.getHttpServer())
    .post("/api/mobile/checklists/instances")
    .set("x-user-id", "vm-user-1")
    .set("x-role-codes", "VISUAL_MERCHANDISER")
    .set("x-store-ids", storeId)
    .set("x-assigned-store-ids", storeId)
    .send({ checklistTemplateId: vmTemplateId, storeId });

  expect(response.status).toBe(201);
  expect(response.body.command.status).toBe("created");

  await app.close();
});
```

Add the constants near the existing ids:

```ts
const bmTemplateId = templateId;
const vmTemplateId = "77777777-7777-4777-8777-777777777777";
```

Add two forbidden tests:

```ts
it("blocks visual merchandisers from starting BM checklists", async () => {
  // template lookup returns BM_STORE_VISIT
  // role is VISUAL_MERCHANDISER
  // expect 403
});

it("blocks region managers from starting VM checklists in V1", async () => {
  // template lookup returns VM_STORE_VISIT
  // role is REGION_MANAGER
  // expect 403
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: at least the VM start test fails with `403`, because `MobileChecklistController.startInstance` currently allows only `REGION_MANAGER` and `SUPER_ADMIN`.

- [ ] **Step 3: Extend mobile controller role decorators and pass roles**

Modify `backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts`.

For `startInstance`, `saveResponse`, and `completeInstance`, include `VISUAL_MERCHANDISER`:

```ts
@RequireRoles("REGION_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
```

Pass roles into service calls:

```ts
actorRoleCodes: request.user.roleCodes,
```

The `acknowledge` endpoint stays limited to:

```ts
@RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
```

- [ ] **Step 4: Add repository template/type lookup**

Modify `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`.

Add:

```ts
async getPublishedTemplateForStore(input: {
  checklistTemplateId: string;
  storeId: string;
}) {
  const result = await this.databaseService.query<{
    checklist_template_id: string;
    template_type: string;
  }>(
    `
      SELECT ct.checklist_template_id, ct.template_type
      FROM ops.checklist_template ct
      INNER JOIN ops.store s
        ON s.store_id = $2::uuid
       AND s.company_id = ct.company_id
      WHERE ct.checklist_template_id = $1::uuid
        AND ct.status = 'published'
        AND ct.effective_from <= CURRENT_DATE
        AND (ct.effective_to IS NULL OR ct.effective_to >= CURRENT_DATE)
    `,
    [input.checklistTemplateId, input.storeId],
  );

  const row = result.rows[0];
  return row
    ? {
        checklistTemplateId: row.checklist_template_id,
        templateType: row.template_type,
      }
    : null;
}
```

Extend `getMobileChecklistInstanceScope` to include `template_type`:

```sql
SELECT ci.checklist_instance_id, ci.store_id, ci.status, ct.template_type
FROM ops.checklist_instance ci
INNER JOIN ops.checklist_template ct
  ON ct.checklist_template_id = ci.checklist_template_id
WHERE ci.checklist_instance_id = $1::uuid
```

Return:

```ts
templateType: row.template_type,
```

- [ ] **Step 5: Add service role/type assertions**

Modify `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`.

Extend method inputs:

```ts
actorRoleCodes?: string[];
```

In `startMobileChecklistInstance`, before insert:

```ts
const template = await this.checklistRepository.getPublishedTemplateForStore({
  checklistTemplateId: input.checklistTemplateId,
  storeId: input.storeId,
});

if (!template) {
  throw new BadRequestException("Checklist template is not available for this store");
}

this.assertCanMutateTemplateType(input.actorRoleCodes ?? [], template.templateType);
```

Add private helper:

```ts
private assertCanMutateTemplateType(roleCodes: string[], templateType: string) {
  if (roleCodes.includes("SUPER_ADMIN")) {
    return;
  }

  if (templateType === "BM_STORE_VISIT" && roleCodes.includes("REGION_MANAGER")) {
    return;
  }

  if (templateType === "VM_STORE_VISIT" && roleCodes.includes("VISUAL_MERCHANDISER")) {
    return;
  }

  throw new ForbiddenException("Checklist template type is not available for this role");
}
```

Modify `assertCanActOnMobileChecklistInstance` to accept `roleCodes` and call the same helper with `instanceScope.templateType`.

- [ ] **Step 6: Keep repository insert behavior compatible**

Keep `startMobileChecklistInstance` insert in the repository, but it no longer needs to own the user-facing availability error. It may still return empty if a race archives the template after service lookup; service should keep the existing message:

```ts
throw new BadRequestException("Checklist template is not available for this store");
```

- [ ] **Step 7: Verify backend role/type guard GREEN**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: PASS.

## Task 2: Backend Read Model Filters VM/BM Templates By Role

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
- Modify: `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`

- [ ] **Step 1: Write failing read-model tests**

Add a test where a VM user sees only `VM_STORE_VISIT`:

```ts
it("filters VM checklist today payload to VM templates for visual merchandisers", async () => {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("FROM ops.store s") && sql.includes("ORDER BY s.store_name ASC")) {
      return { rows: [{ store_id: storeId, store_name: "Marmara Park" }] };
    }

    if (sql.includes("FROM ops.checklist_template ct")) {
      expect(sql).toContain("ct.template_type = ANY");
      return {
        rows: [
          {
            checklist_template_id: vmTemplateId,
            template_code: "VM_VISIT_V1",
            template_type: "VM_STORE_VISIT",
            template_name: "VM Visit",
            version_no: 1,
          },
        ],
      };
    }

    return { rows: [] };
  });

  const app = await createIntegrationApp({
    databaseService: {
      query,
      withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
        work({ query }),
    },
  });

  const response = await request(app.getHttpServer())
    .get("/api/mobile/checklists/today")
    .set("x-user-id", "vm-user-1")
    .set("x-role-codes", "VISUAL_MERCHANDISER")
    .set("x-store-ids", storeId)
    .set("x-assigned-store-ids", storeId);

  expect(response.status).toBe(200);
  expect(response.body.data.templates).toEqual([
    expect.objectContaining({ templateType: "VM_STORE_VISIT" }),
  ]);

  await app.close();
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: FAIL because repository queries currently do not filter by role-allowed template types.

- [ ] **Step 3: Add allowed template type resolver**

Modify `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`.

Add:

```ts
private resolveReadableTemplateTypes(roleCodes: string[]) {
  if (roleCodes.includes("SUPER_ADMIN")) {
    return ["BM_STORE_VISIT", "VM_STORE_VISIT"];
  }

  if (roleCodes.includes("VISUAL_MERCHANDISER")) {
    return ["VM_STORE_VISIT"];
  }

  if (roleCodes.includes("REGION_MANAGER")) {
    return ["BM_STORE_VISIT"];
  }

  if (roleCodes.includes("STORE_MANAGER")) {
    return ["BM_STORE_VISIT", "VM_STORE_VISIT"];
  }

  return [];
}
```

Pass the result into `checklistRepository.getMobileChecklistToday`.

- [ ] **Step 4: Add repository filtering**

Modify `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`.

Extend input:

```ts
allowedTemplateTypes: string[];
```

If no allowed types:

```ts
return {
  stores: [],
  templates: [],
  activeInstances: [],
  completedThisMonth: [],
  pendingAcknowledgements: [],
  monthlySummaries: [],
};
```

Filter every checklist query by joining `ops.checklist_template ct` and using:

```sql
AND ct.template_type = ANY($2::text[])
```

Use `[storeIds, input.allowedTemplateTypes]` for template, active, completed, and monthly summary queries.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: PASS.

## Task 3: Template Items In Mobile Read Model

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
- Modify: `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`
- Modify: `admin-web/src/features/checklists/api.ts`

- [ ] **Step 1: Write failing backend contract expectation**

Extend the mobile today payload test to expect template items:

```ts
expect(response.body.data.templates[0].items).toEqual([
  {
    templateItemId: "55555555-5555-4555-8555-555555555555",
    sectionName: "Gorsel duzen",
    itemNo: 1,
    itemText: "Vitrin standartlara uygun",
    responseType: "score",
    weight: 100,
    maxScore: 10,
  },
]);
```

The test query mock should return item rows when SQL includes `FROM ops.checklist_template_item cti`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: FAIL because `MobileChecklistToday.templates` currently has no `items`.

- [ ] **Step 3: Extend backend contract**

Modify `backend/nestjs/src/modules/store-ops/application/checklist.contract.ts`.

Change template shape:

```ts
templates: Array<{
  checklistTemplateId: string;
  templateCode: string;
  templateType: ChecklistTemplateType;
  templateName: string;
  versionNo: number;
  items: Array<{
    templateItemId: string;
    sectionName: string;
    itemNo: number;
    itemText: string;
    responseType: ChecklistTemplateResponseType;
    weight: number;
    maxScore: number;
  }>;
}>;
```

- [ ] **Step 4: Fetch and attach template items**

In `ChecklistRepository.getMobileChecklistToday`, after templates query:

```ts
const templateIds = templates.rows.map((row) => row.checklist_template_id);
const templateItems =
  templateIds.length === 0
    ? { rows: [] }
    : await this.databaseService.query<{
        checklist_template_id: string;
        template_item_id: string;
        section_name: string;
        item_no: number;
        item_text: string;
        response_type: string;
        weight: string;
        max_score: string;
      }>(
        `
          SELECT
            cti.checklist_template_id,
            cti.template_item_id,
            cti.section_name,
            cti.item_no,
            cti.item_text,
            cti.response_type,
            cti.weight,
            cti.max_score
          FROM ops.checklist_template_item cti
          WHERE cti.checklist_template_id = ANY($1::uuid[])
          ORDER BY cti.checklist_template_id, cti.item_no ASC
        `,
        [templateIds],
      );
```

Group rows by `checklist_template_id` and attach `items` in the return mapper.

- [ ] **Step 5: Update frontend API type**

Modify `admin-web/src/features/checklists/api.ts`.

Add to `MobileChecklistToday.templates`:

```ts
items: Array<{
  templateItemId: string
  sectionName: string
  itemNo: number
  itemText: string
  responseType: string
  weight: number
  maxScore: number
}>
```

- [ ] **Step 6: Verify GREEN**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: PASS.

## Task 4: Frontend VM Checklist-Only Surface

**Files:**

- Modify: `admin-web/src/features/checklists/api.ts`
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`
- Modify: `admin-web/src/App.tsx`
- Modify: `admin-web/e2e/checklist-today-surfaces.spec.ts`

- [ ] **Step 1: Add frontend API functions**

Modify `admin-web/src/features/checklists/api.ts`.

Add:

```ts
export async function saveMobileChecklistResponse(input: {
  checklistInstanceId: string
  templateItemId: string
  scoreValue: number
  commentText?: string
}) {
  return sendJson<CommandResponse<{ checklistResponse: { response_id: string; responded_at: string } }>>(
    `/mobile/checklists/instances/${input.checklistInstanceId}/responses`,
    {
      method: 'PATCH',
      body: {
        templateItemId: input.templateItemId,
        scoreValue: input.scoreValue,
        commentText: input.commentText,
      },
    },
  )
}

export async function completeMobileChecklistInstance(input: {
  checklistInstanceId: string
}) {
  return sendJson<CommandResponse<{ checklistInstance: { checklist_instance_id: string; status: string } }>>(
    `/mobile/checklists/instances/${input.checklistInstanceId}/complete`,
    {
      method: 'POST',
      body: {},
    },
  )
}
```

- [ ] **Step 2: Add failing VM Playwright test**

Modify `admin-web/e2e/checklist-today-surfaces.spec.ts`.

Add:

```ts
test('visual merchandiser sees checklist-only VM coverage and no broad store links', async ({ page }) => {
  await setupChecklistPage(page, ['VISUAL_MERCHANDISER'], {
    templateType: 'VM_STORE_VISIT',
    templateCode: 'VM_VISIT_V1',
    templateName: 'VM Visit',
    activeInstances: [],
    monthlySummaries: [],
  })
  await page.goto('/store/checklists')

  await expect(page.getByText('VM checklist yapilmadi')).toBeVisible()
  await expect(page.getByText('Checklist yap')).toBeVisible()
  await expect(page.getByText('Admin raporlari')).toHaveCount(0)
  await expect(page.getByText('Duyurular')).toHaveCount(0)
  await expect(page.getByText('Yarismalar')).toHaveCount(0)
})
```

Update `setupChecklistPage` to accept optional fixture overrides instead of only `roleCodes`.

- [ ] **Step 3: Verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/checklist-today-surfaces.spec.ts
```

Expected: FAIL because VM cannot manage visits in the current frontend and broad store header links are still visible.

- [ ] **Step 4: Restrict VM shell navigation**

Modify `admin-web/src/App.tsx`.

Add helper:

```ts
function isVisualMerchandiserOnly(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('VISUAL_MERCHANDISER') && !roles.includes('SUPER_ADMIN')
}
```

In `resolveLandingPath`, before the final store fallback:

```ts
if (hasAnyRole(roles, ['VISUAL_MERCHANDISER'])) {
  return '/store/checklists'
}
```

In `StoreShell`, hide broad links for VM-only sessions:

```tsx
const checklistOnly = isVisualMerchandiserOnly(input.authSummary)
```

Render `Admin raporlari`, `Duyurular`, and `Yarismalar` links only when `!checklistOnly`.

Guard non-checklist store routes for VM-only sessions:

```tsx
function guardStoreRoute(
  authSummary: AuthSessionSummary | null,
  element: ReactNode,
  options?: { allowVm?: boolean },
) {
  if (isVisualMerchandiserOnly(authSummary) && !options?.allowVm) {
    return <ForbiddenRoute firstAllowedPath="/store/checklists" />
  }

  return <>{element}</>
}
```

Use it on store routes. `/store/checklists` should pass `{ allowVm: true }`.

- [ ] **Step 5: Let VM manage checklist visits in StoreChecklistsPage**

Modify `admin-web/src/pages/StoreChecklistsPage.tsx`.

Change:

```ts
const canManageVisits = hasAnyRole(input.authSummary, ['REGION_MANAGER', 'SUPER_ADMIN'])
```

to:

```ts
const canManageVisits = hasAnyRole(input.authSummary, [
  'REGION_MANAGER',
  'VISUAL_MERCHANDISER',
  'SUPER_ADMIN',
])
```

Add:

```ts
const isVm = hasAnyRole(input.authSummary, ['VISUAL_MERCHANDISER'])
```

Build coverage rows from `mobileToday.stores`, `mobileToday.templates`, `activeInstances`, and `monthlySummaries`:

```ts
const coverageRows = (mobileToday?.stores ?? []).flatMap((store) =>
  (mobileToday?.templates ?? []).map((template) => {
    const active = mobileToday?.activeInstances.find(
      (item) => item.storeId === store.storeId && item.checklistTemplateId === template.checklistTemplateId,
    )
    const summary = mobileToday?.monthlySummaries.find(
      (item) => item.storeId === store.storeId && item.checklistTemplateId === template.checklistTemplateId,
    )
    const completedCount = summary?.completedCount ?? 0
    return { store, template, active, summary, completedCount }
  }),
)
```

Status text:

```ts
function describeChecklistCoverage(row: {
  active: unknown
  completedCount: number
  template: { templateType: string }
}) {
  const prefix = row.template.templateType === 'VM_STORE_VISIT' ? 'VM checklist' : 'BM checklist'

  if (row.active) return `${prefix} devam ediyor`
  if (row.completedCount > 1) return `${row.completedCount} ${prefix} tamamlandi`
  if (row.completedCount === 1) return `1 ${prefix} tamamlandi`
  return `${prefix} yapilmadi`
}
```

Render a row per coverage item. For missing rows, show `Checklist yap`. For active rows, show item score controls and `Tamamla`.

- [ ] **Step 6: Add simple item scoring controls**

In `StoreChecklistsPage`, add state:

```ts
const [scores, setScores] = useState<Record<string, number>>({})
const [comments, setComments] = useState<Record<string, string>>({})
```

Add mutations:

```ts
const saveResponseMutation = useMutation({
  mutationFn: saveMobileChecklistResponse,
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
    setAckNotice('Checklist cevabi kaydedildi')
  },
})

const completeVisitMutation = useMutation({
  mutationFn: completeMobileChecklistInstance,
  onSuccess: (result) => {
    void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
    setAckNotice(result.command.message)
  },
})
```

For each template item render numeric input:

```tsx
<input
  type="number"
  min={0}
  max={item.maxScore}
  value={scores[item.templateItemId] ?? 0}
  onChange={(event) =>
    setScores((current) => ({
      ...current,
      [item.templateItemId]: Number(event.target.value),
    }))
  }
/>
```

Save button:

```tsx
saveResponseMutation.mutate({
  checklistInstanceId: row.active.checklistInstanceId,
  templateItemId: item.templateItemId,
  scoreValue: scores[item.templateItemId] ?? 0,
  commentText: comments[item.templateItemId] || undefined,
})
```

Complete button:

```tsx
completeVisitMutation.mutate({
  checklistInstanceId: row.active.checklistInstanceId,
})
```

- [ ] **Step 7: Keep copy pilot-grade and Turkish-first**

Use compact labels:

```text
VM checklist yapilmadi
VM checklist devam ediyor
VM checklist tamamlandi
Checklist yap
Kaydet
Tamamla
```

Do not add marketing text or unrelated feature descriptions.

- [ ] **Step 8: Verify frontend targeted test GREEN**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/checklist-today-surfaces.spec.ts
```

Expected: PASS.

## Task 5: Regression And Release Checks

**Files:**

- Modify: `current-state.md`

- [ ] **Step 1: Run backend targeted tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts test/integration/auth-role-assignments.e2e-spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Run frontend targeted test and build**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/checklist-today-surfaces.spec.ts
npm.cmd run build
```

Expected: PASS. Existing Vite chunk-size warning may appear; it is not a failure.

- [ ] **Step 4: Run root release check**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected: PASS.

- [ ] **Step 5: Update current-state**

Append a section:

```markdown
## Son VM Checklist V1 Implementation

29 Nisan 2026 itibariyla VM Checklist V1 action enablement uygulandi.

Eklenenler:

- `VISUAL_MERCHANDISER` checklist-only store yuzeyine yonlenir.
- VM kullanicisi atanmis magazalarda `VM_STORE_VISIT` checklist baslatabilir, kaydedebilir ve tamamlayabilir.
- VM kullanicisi `BM_STORE_VISIT` mutasyonu yapamaz.
- Region manager V1'de `VM_STORE_VISIT` mutasyonu yapamaz.
- Mobile checklist read model role gore BM/VM template type filtreler.
- Store manager tamamlanmis VM checklist sonucunu acknowledgement olarak gorebilir.

Dogrulama:

- Backend targeted mobile/auth tests passed.
- Backend build passed.
- Frontend checklist e2e passed.
- Frontend build passed.
- Root `check:release` passed.

CODEX durust yorum:

- VM checklist dogru sekilde mevcut checklist motoruna baglandi; ayri modul borcu acilmadi.
- Skor katkisi bilincli olarak ikinci fazda bekletildi. Once pilotta VM checklist kaniti gorecegiz.

Siradaki mantikli adim: pilot VM kullanicisi ile tarayici smoke yapmak; sonra VM score contribution activation icin KPI `%90`, BM `%5`, VM `%5` blend planina gecmek.
```

- [ ] **Step 6: Commit implementation**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git status --short
git add -- backend/nestjs/src/modules/store-ops/application/checklist.contract.ts backend/nestjs/src/modules/store-ops/application/checklist.service.ts backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts admin-web/src/features/checklists/api.ts admin-web/src/pages/StoreChecklistsPage.tsx admin-web/src/App.tsx admin-web/e2e/checklist-today-surfaces.spec.ts current-state.md
git diff --cached --check
git commit -m "feat: enable vm checklist workflow"
```

Expected: commit succeeds and `outputs/` remains untracked.

## Implementation Notes

- Do not change migration tracking.
- Do not change mobile auth/session behavior.
- Do not change store score blend in this phase.
- Do not grant VM users target/report/personnel/admin access.
- Keep `SUPER_ADMIN` as an operational override where existing code already allows it.
- Keep role/type rules backend-owned; frontend visibility is not security.

## Self-Review Checklist

- Every VM mutation has three gates: role, template type, assigned store.
- Every BM mutation keeps current region manager behavior.
- VM read model cannot accidentally show BM templates.
- Store manager acknowledgement remains unchanged except that completed VM checklists can appear.
- VM route access is checklist-only in frontend.
- Release check remains the final gate.
