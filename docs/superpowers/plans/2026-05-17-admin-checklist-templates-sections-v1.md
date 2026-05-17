# Admin Checklist Templates Sections V1 Plan

**Goal:** Reduce maintenance risk in `/admin/checklists` by separating checklist template editor orchestration from focused render sections without changing template defaults, API calls, routes, copy keys, CSS classes, or publish behavior.

**Why this is worth doing:** This admin surface controls BM and VM checklist templates that feed store visit workflows. A small mistake here can publish the wrong field checklist shape or weight model, so the value is safer future checklist changes, not React Doctor alone.

**Scope**

- Modify: `admin-web/src/pages/AdminChecklistTemplatesPage.tsx`
- Keep BM and VM initial draft separation unchanged.
- Keep save/publish mutation flow and cache invalidation unchanged.
- Keep all route, class, aria, and translation keys unchanged.
- Do not redesign the UI.
- Do not chase unrelated Doctor warnings in this PR.

## Completed Work

- [x] Moved checklist template state, validation, mutations, and draft handlers into `useAdminChecklistTemplatesPageModel`.
- [x] Split the render tree into focused private sections for hero actions, editor panel, template strip, status strip, notices, sections, item editors, and item settings.
- [x] Preserved draft switching for BM and VM templates.
- [x] Preserved the existing validation rules for company scope, total weight, empty text, and invalid score ranges.

## Verification

- [x] `npm.cmd --prefix admin-web run lint`
- [x] `npm.cmd --prefix admin-web run build`
- [x] `npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts -g "admin checklist"`
- [x] `npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none`

## React Doctor Result

Before this slice, React Doctor reported 8 giant-component issues across 7 files and included `AdminChecklistTemplatesPage`. After the split, Doctor reports 7 issues across 6 files and `AdminChecklistTemplatesPage` is no longer in the giant-component list. Score remains 99/100.

## Release Gate

Run before PR:

```powershell
npm.cmd --prefix admin-web run check:release
npm.cmd run check:release
```

## Render Note

Frontend-only refactor; no manual Render deploy is required beyond the normal merge pipeline.

## PR Summary Sentence

Admin checklist templates now keep draft orchestration in a hook and render through smaller focused sections without changing BM/VM template behavior.
