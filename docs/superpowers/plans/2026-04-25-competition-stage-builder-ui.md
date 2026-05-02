# Competition Stage Builder UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR/Admin create a competition stage with two teams and scoped store assignments from the existing admin competition surface.

**Architecture:** Keep the backend contract unchanged and add a focused frontend form component that posts to `POST /api/competitions/:competitionId/stages`. The admin page owns query invalidation and role gating, while the form owns local draft state, client validation, and store selection.

**Tech Stack:** React 19, TypeScript, TanStack Query, Vite, Playwright, existing dashboard primitives.

---

### File Structure

- Modify: `admin-web/src/features/competitions/api.ts`
  - Add `CreateCompetitionStagePayload` and `createCompetitionStage`.
- Create: `admin-web/src/features/competitions/StageBuilderForm.tsx`
  - Owns stage fields, two-team draft state, store checkbox selection, validation, submit mutation feedback.
- Modify: `admin-web/src/pages/CompetitionDashboardPage.tsx`
  - Render the form only for `SUPER_ADMIN` and `HR_ADMIN`.
  - Invalidate `competitions` and `competition-detail` after stage creation.
- Modify: `admin-web/e2e/competition-surfaces.spec.ts`
  - Add a failing Playwright test that captures the stage creation payload.
- Modify: `current-state.md`
  - Record the delivered management surface and the next logical step.

### Task 1: Frontend Smoke Test

- [ ] **Step 1: Add the failing Playwright test**

Add a test to `admin-web/e2e/competition-surfaces.spec.ts` that opens `/admin/competitions`, fills a stage form, selects one store per team, submits, and asserts the request body:

```ts
expect(createdStagePayload).toMatchObject({
  stageCode: 'MAY_QUALIFIER',
  stageName: 'May Qualifier',
  stageOrder: 1,
  stageType: 'qualifier',
  startsOn: '2026-05-01',
  endsOn: '2026-05-15',
  teams: [
    {
      teamCode: 'MARMARA_A',
      teamName: 'Marmara A',
      storeIds: ['00000000-0000-0000-0000-000000000101'],
    },
    {
      teamCode: 'MARMARA_B',
      teamName: 'Marmara B',
      storeIds: ['00000000-0000-0000-0000-000000000102'],
    },
  ],
})
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```powershell
npm.cmd run build
npx.cmd playwright test e2e/competition-surfaces.spec.ts
```

Expected: FAIL because the stage builder form is not rendered yet.

### Task 2: API Helper

- [ ] **Step 1: Add typed payload and API function**

In `admin-web/src/features/competitions/api.ts`, add:

```ts
export type CreateCompetitionStagePayload = {
  stageCode: string
  stageName: string
  stageOrder: number
  stageType: CompetitionStageSummary['stageType']
  startsOn: string
  endsOn: string
  teams: Array<{
    teamCode: string
    teamName: string
    sourceTemplateId?: string
    storeIds: string[]
  }>
}

export async function createCompetitionStage(
  competitionId: string,
  payload: CreateCompetitionStagePayload,
) {
  return sendJson<CommandResponse<{ stage: CompetitionStageSummary }>>(
    `/competitions/${competitionId}/stages`,
    {
      method: 'POST',
      body: payload,
    },
  )
}
```

- [ ] **Step 2: Run TypeScript build**

Run:

```powershell
npm.cmd run build
```

Expected: PASS.

### Task 3: Stage Builder Component

- [ ] **Step 1: Create the form component**

Create `admin-web/src/features/competitions/StageBuilderForm.tsx` with:

- A stage field grid: code, name, order, type, starts, ends.
- Two team rows by default.
- Store checkboxes from `getAuthLookups()`.
- Disabled submit unless stage fields are complete, dates are ordered, there are at least two teams, and every team has one store.
- Success and error feedback using `ScreenState`.

- [ ] **Step 2: Wire the component into admin page**

In `CompetitionDashboardPage.tsx`, render `StageBuilderForm` for manageable sessions and pass `competitionId`, `competitionStartsOn`, `competitionEndsOn`, and `onCreated`.

- [ ] **Step 3: Run GREEN targeted test**

Run:

```powershell
npm.cmd run build
npx.cmd playwright test e2e/competition-surfaces.spec.ts
```

Expected: PASS.

### Task 4: Release Verification and Docs

- [ ] **Step 1: Run frontend release check**

Run:

```powershell
npm.cmd run check:release
```

Expected: lint, build, Playwright smoke, and `npm audit --omit=dev` pass.

- [ ] **Step 2: Record state**

Update `current-state.md` with:

- HR/Admin can create stage/team/store assignments from `/admin/competitions`.
- Backend contract remains the authority.
- Read-only roles still cannot see management actions.
- Latest verification command and result.
- Next logical step.

- [ ] **Step 3: Commit**

```powershell
git add admin-web/src/features/competitions/api.ts admin-web/src/features/competitions/StageBuilderForm.tsx admin-web/src/pages/CompetitionDashboardPage.tsx admin-web/e2e/competition-surfaces.spec.ts current-state.md
git commit -m "feat: add competition stage builder ui"
```
