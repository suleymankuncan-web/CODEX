# React Doctor Stage Builder Reducer V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the final React Doctor `prefer-useReducer` warning by consolidating the top-level `StageBuilderForm` draft and feedback state into one reducer.

**Architecture:** Keep competition API calls, mutation payload builders, validation helpers, child component local edit state, and query behavior unchanged. Move only the parent form state that coordinates stage draft, package draft, template draft, feedback messages, inactive template visibility, and package history selection into reducer actions.

**Tech Stack:** React 19, TypeScript, TanStack Query, Playwright E2E, React Doctor.

---

### Task 1: Consolidate Stage Builder Parent State

**Files:**
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`
- Test: `admin-web/e2e/competition-surfaces.spec.ts`

- [x] **Step 1: Replace state import**

Change:

```tsx
import { useMemo, useState } from 'react'
```

to:

```tsx
import { useMemo, useReducer, useState } from 'react'
```

Keep `useState` for child components in the same file.

- [x] **Step 2: Add reducer model**

Add a `StageBuilderFormState` type containing the current parent state fields: stage draft, package draft, template draft, feedback messages, inactive template visibility, and package history plan id.

- [x] **Step 3: Preserve initial behavior**

Initialize reducer state from `input.competitionStartsOn` and `input.competitionEndsOn`, preserving the existing `createInitialDraft`, `createInitialStagePackageDraft`, and `createInitialTemplateDraft` defaults.

- [x] **Step 4: Replace parent state transitions**

Use reducer actions for:

```tsx
stage field updates
stage preset apply/clear
stage package field updates
stage package stage updates
template draft field/store updates
template create success reset
stage/package/template feedback messages
template lifecycle feedback
inactive template toggle
package history plan selection
team updates and template application
```

- [x] **Step 5: Verify targeted behavior**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- competition-surfaces.spec.ts -g "stage builder|competition stage|stage format|league then final stage package"
npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none
```

Expected: commands exit 0, and React Doctor no longer reports `StageBuilderForm.tsx` under `prefer-useReducer`.

- [x] **Step 6: Release gate**

Run:

```powershell
npm.cmd --prefix admin-web run check:release
npm.cmd run check:release
```

Expected: both release gates exit 0 before commit/PR.
