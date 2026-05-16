# React Doctor Admin Checklist Cache V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the AdminChecklistTemplatesPage React Doctor cache invalidation warnings and one small Intl allocation warning without changing UI behavior.

**Architecture:** Keep the slice local to the admin checklist builder. Use TanStack Query's existing query client to invalidate checklist template consumers after create/publish mutations, and hoist stable weight formatters to module scope.

**Tech Stack:** Vite, React 19, TypeScript, TanStack Query, React Doctor, Playwright.

---

**Execution status:** Implemented and verified on `codex/react-doctor-admin-checklist-cache-v1`.

**Verification results:**
- `npm.cmd --prefix admin-web run build` passed.
- `npm.cmd --prefix admin-web run lint` passed.
- `npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts -g "admin checklist"` passed.
- `npm.cmd --prefix admin-web run check:release` passed.
- `npx.cmd --yes react-doctor@latest . --json --full --offline --fail-on none` reported `0` errors, `39` warnings, `39` total diagnostics.
- `npx.cmd --yes react-doctor@latest . --score --full --offline --fail-on none` reported `93`.

### Task 1: Add Checklist Cache Invalidation

**Files:**
- Modify: `admin-web/src/pages/AdminChecklistTemplatesPage.tsx`

- [x] **Step 1: Import and initialize the query client**

Add `useQueryClient` beside `useMutation`, then initialize it near localization:

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()
```

- [x] **Step 2: Invalidate checklist consumers after create/publish**

Add `onSuccess` handlers to both existing mutations:

```tsx
const createMutation = useMutation({
  mutationFn: createAdminChecklistTemplate,
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
  },
})
const publishMutation = useMutation({
  mutationFn: publishAdminChecklistTemplate,
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
  },
})
```

Expected behavior: successful publish refreshes store/checklist template consumers that read `mobile-checklists-today`.

### Task 2: Hoist Weight Formatters

**Files:**
- Modify: `admin-web/src/pages/AdminChecklistTemplatesPage.tsx`

- [x] **Step 1: Add module-level formatters**

```tsx
const wholeWeightFormatter = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0,
})

const fractionalWeightFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})
```

- [x] **Step 2: Reuse them in `formatWeight`**

```tsx
function formatWeight(value: number) {
  return (value % 1 === 0 ? wholeWeightFormatter : fractionalWeightFormatter).format(value)
}
```

### Task 3: Verify Slice

**Files:**
- Test: `admin-web`

- [x] **Step 1: Run static checks**

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run lint
```

- [x] **Step 2: Run targeted checklist/admin E2E**

```powershell
npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts -g "admin checklist"
```

- [x] **Step 3: Measure React Doctor**

```powershell
npx.cmd --yes react-doctor@latest . --json --full --offline --fail-on none
npx.cmd --yes react-doctor@latest . --score --full --offline --fail-on none
```

Expected: React Doctor remains error-free and total warnings drop below `42`.

### Task 4: Finish

- [ ] **Step 1: Commit only this slice**

Stage:

```powershell
git add -- admin-web/src/pages/AdminChecklistTemplatesPage.tsx docs/superpowers/plans/2026-05-16-react-doctor-admin-checklist-cache-v1.md
```

Leave existing unrelated local files unstaged.

- [ ] **Step 2: PR note**

Mention that Render deploy is not required because this is frontend-only.
