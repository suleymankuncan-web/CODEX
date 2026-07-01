# Checklist Session Modal Production Transition V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the approved checklist session modal prototype into the production `/store/checklists` checklist start/fill flow with template-driven scoring and unchanged checklist business workflow.

**Architecture:** Production keeps the existing checklist template, instance, response, completion, acknowledgement, and low-score task-generation workflow. The backend exposes normalized scoring policy per checklist item, and the Store UI renders the accepted one-page modal from those fields instead of hard-coded `0-10` assumptions. Visual parity is treated as part of the delivery contract, with desktop/mobile evidence required before closeout.

**Tech Stack:** NestJS, PostgreSQL/Supabase, OpenAPI generation, React, TypeScript, existing HR Axis Store shell, existing checklist API client, Playwright, Jest, ESLint, Vite build.

---

## Scope

In scope:

- Productionize the approved checklist session modal opened from `/store/checklists` via `Checklisti aç` / `Checklist yap`.
- Keep the accepted modal rhythm: compact top bar, store/session summary, all questions visible in one scroll surface, score buttons, note field, low-score warning only when relevant, sticky footer, `Taslak kaydet`, `İptal`, `Tamamla`.
- Make score scale template-driven so a future admin template can use `1-5` without rewriting the modal.
- Use admin-controlled item metadata for:
  - minimum score,
  - maximum score,
  - low-score threshold,
  - low-score note requirement.
- Keep low-score task creation automatic. The UI must not introduce a manual `Takip oluştur` or `Görev oluştur` action.
- Keep draft behavior separate from completion: draft or cancelled sessions must not write a completed visit date.
- Keep existing role/scope, checklist scoring formula, acknowledgement flow, task creation destination, DB ownership, and permission semantics.

Out of scope:

- Full `/store/checklists` page redesign.
- Admin checklist template UI redesign.
- Changing checklist score formula.
- Changing checklist result/acknowledgement modal.
- New notification, calendar, route planning, or Store Action workflow.
- Switching all existing templates to `1-5` in this PR train. This plan makes the runtime ready; template migration is a separate content/config decision.

## Current Evidence

Known production state:

- Admin checklist template items already store:
  - `maxScore` as a first-class item field,
  - `minScore`, `lowScoreThreshold`, and `requiresLowScoreNote` inside `expectedValue` JSON.
- `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts` validates saved responses against `max_score`.
- `backend/nestjs/src/modules/store-ops/web/dto/save-mobile-checklist-response.dto.ts` still has hard-coded `@Max(10)`.
- `backend/nestjs/src/modules/store-ops/application/checklist-low-score-policy.ts` reads `lowScoreThreshold` from `expectedValue`.
- `MobileChecklistToday` currently returns `maxScore` but not normalized score-policy fields.
- `admin-web/src/pages/store-checklists-modals.tsx` currently builds score options from `0..maxScore`.
- The approved prototype lives in:
  - `admin-web/src/prototypes/store-checklist-session-modal-v1.tsx`
  - `admin-web/src/prototypes/store-checklist-session-modal-v1.css`
  - local route flag: `/store/checklists?prototype=session-modal-v1`

## Product Contract

The production modal must behave as follows:

- User opens checklist from the existing Store checklist flow.
- Existing checklist instance/session resolution remains unchanged.
- All checklist questions are visible in a single modal body; no section stepper and no previous/next wizard.
- Category/topic navigation is not shown.
- Question descriptions and `Ağırlık %` text are not shown.
- Each question shows:
  - item number,
  - item text,
  - score choices,
  - note input.
- Score choices for `responseType === "score"` come from template policy:
  - if `minScore=1` and `maxScore=5`, show `1 2 3 4 5`;
  - if old template has no min policy, fallback remains `0..maxScore` to preserve old templates.
- `yes_no` and `partial` response types keep existing quick-choice semantics unless a separate redesign scope is opened.
- If selected score is at or below `lowScoreThreshold`, show:
  - `Bu puanda mağazaya görev oluşacaktır.`
  - a short note that the threshold is controlled from checklist settings.
- If `requiresLowScoreNote` is true and selected score is low, completion is blocked until note is filled.
- `Taslak kaydet` saves current answers without completing the visit.
- `İptal` closes without marking the checklist completed.
- `Tamamla` appears in the sticky footer and is enabled only when required scoring/note conditions are satisfied.
- Completion triggers the existing completion path and existing automatic low-score task creation.
- Mobile view must keep footer buttons visible and usable without horizontal scroll.

## File Map

Backend contract and validation:

- Modify `backend/nestjs/src/modules/store-ops/application/checklist.contract.ts`
  - Add normalized item scoring policy to `MobileChecklistToday.templates[].items[]`.
- Modify `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
  - Select `cti.expected_value` in the mobile-today template item query.
  - Map `minScore`, `lowScoreThreshold`, `requiresLowScoreNote`.
  - Enforce template min/max bounds consistently when saving score responses.
- Modify `backend/nestjs/src/modules/store-ops/application/checklist-low-score-policy.ts`
  - Extract reusable policy parsing so repository/API mapping and low-score task logic agree.
- Modify `backend/nestjs/src/modules/store-ops/web/dto/save-mobile-checklist-response.dto.ts`
  - Remove the hard-coded `@Max(10)` gate and rely on repository template validation.
- Test `backend/nestjs/src/modules/store-ops/application/checklist-low-score-policy.spec.ts`
- Test `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts`
- Regenerate `docs/api/openapi.json`.

Frontend model and helpers:

- Modify `admin-web/src/features/checklists/api.ts`
  - Add frontend-visible fields after OpenAPI generation:
    - `minScore?: number`
    - `lowScoreThreshold?: number | null`
    - `requiresLowScoreNote?: boolean`
- Modify `admin-web/src/pages/store-checklists-logic.ts`
  - Add score-policy helper functions.
  - Replace hard-coded score parsing assumptions with min/max-aware parsing.
- Modify or add focused tests under `admin-web/src/pages/__tests__` if this repo pattern exists; otherwise cover through existing e2e and script tests.

Production modal UI:

- Modify `admin-web/src/pages/store-checklists-modals.tsx`
  - Translate the approved prototype into the production modal.
  - Keep existing callback props and API mutations intact.
  - Replace old wizard/section-heavy presentation with one-page scroll form.
- Modify existing Store checklist CSS file used by the modal, or create a focused route CSS file if current styles are too coupled.
  - Do not disturb full page list styling outside the modal.
  - Do not use internal/debug copy.

Prototype registry and evidence:

- Modify `docs/prototypes/README.md`
  - Add the approved checklist session modal prototype as a locked production-bound reference after implementation starts.
- Create closeout evidence under `docs/evidence/` during the final PR.
  - Include prototype path, production route, desktop screenshot, mobile screenshot, role/scope state, and intentional deviations.

## PR Train

### PR1: Template-Driven Checklist Scoring Contract

Purpose: make the backend/API tell the Store UI what score scale and low-score policy each item uses.

- [ ] **Step 1: Add a normalized score-policy type**

In `backend/nestjs/src/modules/store-ops/application/checklist.contract.ts`, extend mobile checklist item shape:

```ts
items: Array<{
  templateItemId: string;
  sectionName: string;
  itemNo: number;
  itemText: string;
  responseType: ChecklistTemplateResponseType;
  weight: number;
  maxScore: number;
  minScore?: number;
  lowScoreThreshold?: number | null;
  requiresLowScoreNote?: boolean;
}>;
```

- [ ] **Step 2: Add one shared parser for `expectedValue` policy**

Move the parsing logic out of low-score-only code into a reusable helper, for example:

`backend/nestjs/src/modules/store-ops/application/checklist-score-policy.ts`

```ts
export type ChecklistScorePolicy = {
  minScore: number | null;
  lowScoreThreshold: number | null;
  requiresLowScoreNote: boolean;
};

export function parseChecklistScorePolicy(expectedValue: unknown): ChecklistScorePolicy {
  if (!expectedValue) {
    return { minScore: null, lowScoreThreshold: null, requiresLowScoreNote: false };
  }

  try {
    const parsed =
      typeof expectedValue === "string"
        ? (JSON.parse(expectedValue) as Record<string, unknown>)
        : (expectedValue as Record<string, unknown>);

    const minScore = Number(parsed.minScore);
    const lowScoreThreshold = Number(parsed.lowScoreThreshold);

    return {
      minScore: Number.isFinite(minScore) && minScore >= 0 ? minScore : null,
      lowScoreThreshold:
        Number.isFinite(lowScoreThreshold) && lowScoreThreshold >= 0
          ? lowScoreThreshold
          : null,
      requiresLowScoreNote: parsed.requiresLowScoreNote === true,
    };
  } catch {
    return { minScore: null, lowScoreThreshold: null, requiresLowScoreNote: false };
  }
}
```

- [ ] **Step 3: Rewire low-score policy to use the shared parser**

In `backend/nestjs/src/modules/store-ops/application/checklist-low-score-policy.ts`, import `parseChecklistScorePolicy` and keep the existing public behavior:

```ts
const policy = parseChecklistScorePolicy(input.expectedValue);
if (policy.lowScoreThreshold === null) return false;
return scoreValue <= policy.lowScoreThreshold;
```

- [ ] **Step 4: Select and map policy in mobile today repository**

In `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`, add `cti.expected_value` to the mobile-today item query and item row type. While mapping rows:

```ts
const policy = parseChecklistScorePolicy(item.expected_value);

items.push({
  templateItemId: item.template_item_id,
  sectionName: item.section_name,
  itemNo: Number(item.item_no),
  itemText: item.item_text,
  responseType: item.response_type,
  weight: Number(item.weight),
  maxScore: Number(item.max_score),
  ...(policy.minScore !== null ? { minScore: policy.minScore } : {}),
  lowScoreThreshold: policy.lowScoreThreshold,
  requiresLowScoreNote: policy.requiresLowScoreNote,
});
```

- [ ] **Step 5: Replace hard-coded save DTO max**

In `backend/nestjs/src/modules/store-ops/web/dto/save-mobile-checklist-response.dto.ts`, remove `@Max(10)` from `scoreValue`. Keep `@IsNumber()` and `@Min(0)`.

- [ ] **Step 6: Enforce template min/max in repository**

In response save validation, keep existing max-score check and add min-score check only for score responses:

```ts
const policy = parseChecklistScorePolicy(guard.expected_value);
const minScore = policy.minScore ?? 0;

if (guard.response_type === "score" && input.scoreValue < minScore) {
  throw new BadRequestException("Checklist score is below item min score");
}

if (input.scoreValue > Number(guard.max_score)) {
  throw new BadRequestException("Checklist score exceeds item max score");
}
```

This avoids breaking `yes_no` and `partial` responses that legitimately use `0`.

- [ ] **Step 7: Add backend tests**

Update `backend/nestjs/src/modules/store-ops/application/checklist-low-score-policy.spec.ts`:

```ts
it("uses low score threshold parsed from checklist expected value", () => {
  expect(
    isChecklistLowScore({
      expectedValue: JSON.stringify({ lowScoreThreshold: 2 }),
      scoreValue: 2,
    }),
  ).toBe(true);
});
```

Update `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts` to assert:

- mobile-today item includes `minScore`, `lowScoreThreshold`, `requiresLowScoreNote`,
- score response above `maxScore` rejects,
- score response below `minScore` rejects for `responseType: "score"`,
- yes/no response with `0` still saves.

- [ ] **Step 8: Regenerate and verify API contract**

Run:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix backend/nestjs test -- checklist --runInBand
```

Expected:

- OpenAPI and frontend selected operation types include the new item fields.
- Checklist backend tests pass.
- No unrelated OpenAPI drift remains unstaged.

### PR2: Frontend Score Policy Helpers And Modal State

Purpose: make the production frontend consume score policy correctly before visual replacement.

- [ ] **Step 1: Add helper functions**

In `admin-web/src/pages/store-checklists-logic.ts`, add:

```ts
export type ChecklistScorePolicyInput = {
  responseType: string;
  maxScore: number;
  minScore?: number;
  lowScoreThreshold?: number | null;
  requiresLowScoreNote?: boolean;
};

export function getChecklistScoreBounds(item: ChecklistScorePolicyInput) {
  const maxScore = Number.isFinite(item.maxScore) ? Math.max(0, Math.floor(item.maxScore)) : 0;
  const minScore =
    item.responseType === "score" && Number.isFinite(item.minScore)
      ? Math.max(0, Math.floor(item.minScore ?? 0))
      : 0;

  return {
    minScore: Math.min(minScore, maxScore),
    maxScore,
  };
}

export function getChecklistScoreOptions(item: ChecklistScorePolicyInput) {
  const { minScore, maxScore } = getChecklistScoreBounds(item);
  if (maxScore < minScore || maxScore - minScore > 20) return [];
  return Array.from({ length: maxScore - minScore + 1 }, (_unused, index) => minScore + index);
}

export function isChecklistLowScoreSelection(item: ChecklistScorePolicyInput, score: number | null | undefined) {
  if (typeof score !== "number" || !Number.isFinite(score)) return false;
  if (typeof item.lowScoreThreshold !== "number" || !Number.isFinite(item.lowScoreThreshold)) return false;
  return score <= item.lowScoreThreshold;
}

export function isChecklistLowScoreNoteMissing(input: {
  item: ChecklistScorePolicyInput;
  score: number | null | undefined;
  commentText: string | undefined;
}) {
  return (
    input.item.requiresLowScoreNote === true &&
    isChecklistLowScoreSelection(input.item, input.score) &&
    !input.commentText?.trim()
  );
}
```

- [ ] **Step 2: Replace score parsing**

Replace `parseChecklistScoreInput(value, maxScore)` with a policy-aware overload:

```ts
export function parseChecklistScoreInput(value: string, item: ChecklistScorePolicyInput) {
  if (value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const { minScore, maxScore } = getChecklistScoreBounds(item);
  return clamp(parsed, minScore, maxScore);
}
```

Update call sites in `admin-web/src/pages/store-checklists-modals.tsx`.

- [ ] **Step 3: Block completion on low-score required notes**

In the modal completion check, add a missing-note condition:

```ts
const missingRequiredLowScoreNote = activeEntry
  ? isChecklistLowScoreNoteMissing({
      item: activeEntry.item,
      score,
      commentText: input.comments[activeEntry.item.templateItemId],
    })
  : false;
```

`canComplete` must be false when any item is missing score or required low-score note.

- [ ] **Step 4: Verify helper behavior**

Add or update frontend tests to cover:

- `minScore=1`, `maxScore=5` returns `[1, 2, 3, 4, 5]`,
- missing `minScore` with `maxScore=10` returns `[0..10]`,
- `score=2`, `lowScoreThreshold=2` is low,
- `score=3`, `lowScoreThreshold=2` is not low,
- required low-score note blocks completion only when low score is selected.

Run:

```powershell
npm.cmd --prefix admin-web run lint -- --quiet
npm.cmd --prefix admin-web run build
```

Expected: lint and build pass before visual rewrite starts.

### PR3: Approved Checklist Session Modal UI Translation

Purpose: replace the old production checklist session modal with the accepted one-page modal surface.

- [ ] **Step 1: Lock the prototype reference**

Update `docs/prototypes/README.md` with the approved prototype path:

- `admin-web/src/prototypes/store-checklist-session-modal-v1.tsx`
- `admin-web/src/prototypes/store-checklist-session-modal-v1.css`

Label it as the locked production-bound reference for `/store/checklists` checklist session modal, not the full page.

- [ ] **Step 2: Replace modal anatomy**

In `admin-web/src/pages/store-checklists-modals.tsx`, map the accepted prototype into production:

- top bar: close control, `Checklist Oturumu`, checklist type/subtitle, draft status,
- store/session summary block,
- progress line,
- question list,
- note field per question,
- sticky footer with remaining required count, progress, `Taslak kaydet`, `İptal`, `Tamamla`.

Keep these production callbacks unchanged:

- `onScoreChange`
- `onCommentChange`
- `onComplete`
- existing cancel/close behavior
- existing saving/completing state flags

- [ ] **Step 3: Remove old modal-only visual remnants**

Remove from the session modal UI:

- section category navigation strip,
- previous/next wizard controls,
- item description helper copy,
- weight percentage copy,
- always-visible no-task copy,
- oversized internal response-type explanations.

Do not remove the full checklist page filters, visit-plan list, result modal, or acknowledgement flow.

- [ ] **Step 4: Implement low-score warning copy**

Show this only when `isChecklistLowScoreSelection(item, score)` is true:

```text
Bu puanda mağazaya görev oluşacaktır.
```

Do not show a manual task creation checkbox or button.

- [ ] **Step 5: Implement mobile behavior**

For mobile:

- dialog width fits the viewport,
- content scrolls inside the modal body,
- sticky footer stays visible,
- buttons do not overlap,
- no horizontal scroll,
- question score buttons wrap cleanly.

Use Playwright viewport `390x844` as the baseline mobile check.

- [ ] **Step 6: Product copy pass**

Search the changed modal files for internal or malformed copy:

```powershell
rg -n "scope|API|DB|OpenAPI|mock|contract|evidence|gercek veri|kaynak|yetkili|Ağirlik|agirlik|gorev olusmaz|Takip olustur|Görev oluştur" admin-web/src/pages/store-checklists-modals.tsx admin-web/src/pages/store-checklists-logic.ts
```

Expected:

- No user-facing internal copy.
- No malformed Turkish copy.
- No `Bu puanda görev oluşmaz`.
- No manual task-create wording.

- [ ] **Step 7: Visual verification**

Run local app and inspect:

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run lint -- --quiet
```

Then capture or manually verify:

- desktop `/store/checklists` checklist modal,
- mobile `/store/checklists` checklist modal,
- low-score state,
- all-required-complete state,
- incomplete state with disabled `Tamamla`.

### PR4: End-To-End Flow Evidence And Closeout

Purpose: prove the UI and workflow moved together without breaking checklist behavior.

- [ ] **Step 1: Add or update Playwright coverage**

Update existing checklist e2e coverage under `admin-web/e2e/` to assert:

- checklist session modal opens,
- score choices render from template policy,
- low score shows task warning,
- missing required score disables complete,
- draft close does not show completed/visit state,
- complete path still calls the existing completion mutation.

- [ ] **Step 2: Add one fixture or route mock for `1-5`**

Use a test fixture with:

```json
{
  "responseType": "score",
  "minScore": 1,
  "maxScore": 5,
  "lowScoreThreshold": 2,
  "requiresLowScoreNote": true
}
```

Expected UI:

- score buttons are `1 2 3 4 5`,
- score `2` shows the task warning,
- score `2` with empty note blocks completion,
- score `4` does not show task warning.

- [ ] **Step 3: Run targeted gates**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- checklist --runInBand
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix admin-web run lint -- --quiet
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-checklists
```

If the exact e2e spec name differs, run the smallest checklist-related spec and record the actual command in closeout evidence.

- [ ] **Step 4: Record parity evidence**

Create `docs/evidence/checklist-session-modal-production-transition-v1-closeout-2026-07-01.md` with:

- approved prototype path,
- production route,
- role/persona used,
- API fields used for score policy,
- desktop visual check,
- mobile visual check,
- low-score warning check,
- draft-vs-complete behavior check,
- task generation behavior statement,
- intentional deviations, if any.

Required parity conclusion:

```text
Prototype parity: PASS
```

Only use `PASS` if desktop and mobile materially match the approved prototype. If not, record:

```text
Prototype parity: BLOCKED
```

and list exact differences before merge.

## Data And Workflow Decisions

- Admin remains the source of checklist item scoring configuration.
- Store UI must not hard-code future `1-5`; it reads `minScore` and `maxScore`.
- Existing old templates without explicit `minScore` keep fallback behavior so pilot data is not broken.
- Low-score task creation remains automatic and backend-owned.
- The UI warning is informational. It does not create tasks by itself.
- Completed visit date is still tied to successful checklist completion only.
- Draft save and cancellation must never look like completed visits.
- Acknowledgement and result review remain separate flows.

## Risk Register

- **Risk: old templates only have `maxScore`.**
  - Mitigation: fallback `minScore=0` for old templates.
- **Risk: hard-coded `@Max(10)` rejects future templates above 10 or conflicts with policy.**
  - Mitigation: remove DTO max and enforce template bounds in repository.
- **Risk: low-score note requirement exists in admin metadata but not UI.**
  - Mitigation: expose `requiresLowScoreNote` and block completion only when low score is selected.
- **Risk: UI parity drifts because production modal keeps old wizard shell.**
  - Mitigation: replace modal anatomy, not recolor old structure.
- **Risk: yes/no answers break if min-score validation applies to all response types.**
  - Mitigation: apply min-score validation only for `responseType === "score"`.
- **Risk: mobile sticky footer hides controls.**
  - Mitigation: explicit 390px viewport verification.

## Definition Of Done

- Backend mobile checklist API exposes normalized score policy.
- Frontend checklist item model consumes score policy.
- Store checklist session modal visually matches the approved prototype on desktop and mobile.
- Score buttons are template-driven.
- Low-score warning appears only when applicable.
- Required low-score note blocks completion when configured.
- Draft/cancel does not mark visits completed.
- Completion still uses existing production workflow and automatic task generation.
- No internal/debug copy appears in the modal.
- Targeted backend tests pass.
- Frontend lint/build pass.
- Checklist e2e or equivalent route-mock coverage passes.
- Prototype parity evidence is recorded.

## Self-Review

Spec coverage:

- UI transition is covered in PR3 and PR4.
- Business workflow preservation is covered in scope, product contract, and PR4.
- Admin-driven scoring is covered in PR1 and PR2.
- Future `1-5` support is covered by explicit min/max API fields and fixture test.
- Automatic task behavior is covered by low-score warning and backend-owned generation notes.
- Mobile modal usability is covered in PR3 and PR4.

Placeholder scan:

- No unresolved placeholder or vague future implementation step remains.
- Every planned code change names the target file and expected behavior.

Type consistency:

- `minScore`, `maxScore`, `lowScoreThreshold`, and `requiresLowScoreNote` names are used consistently across backend contract, frontend helpers, and tests.
- `responseType === "score"` is the boundary for min-score enforcement.
