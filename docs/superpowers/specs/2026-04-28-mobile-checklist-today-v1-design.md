# Mobile Checklist Today V1 Design

## Goal

Define the first mobile checklist workflow before implementation: HR owns checklist templates, region managers perform store visit scoring, and store managers acknowledge completed results.

## Context

The current backend already has checklist primitives:

- `ops.checklist_template`
- `ops.checklist_template_item`
- `ops.checklist_instance`
- `ops.checklist_response`
- `ops.checklist_acknowledgement`

Current store-web behavior focuses on completed checklist acknowledgement. Mobile Checklist Today V1 adds the operational visit flow around those primitives without turning store managers into checklist scorers.

## Locked Product Decisions

- `HR_ADMIN` creates and publishes checklist templates.
- `REGION_MANAGER` sees assigned stores and starts a checklist for the store they are visiting.
- `REGION_MANAGER` fills checklist items during the visit and saves progress.
- `REGION_MANAGER` completes the checklist when the visit is finished.
- Completion immediately makes the checklist score valid for reporting.
- `STORE_MANAGER` receives the completed checklist as an acknowledgement item.
- `STORE_MANAGER` can only mark `Kabul ettim / Gördüm`; this is not approval, rejection, or score gating.
- The same store can receive multiple completed checklists in the same month.
- Monthly checklist result is the arithmetic average of completed visit scores for that store, checklist type, and month.
- The monthly UI should show the visit count, for example `2 checklist yapıldı`.
- Completed checklist instances are locked.
- V1 does not edit or delete completed checklist instances.
- Future cancellation can be added as `cancel with reason`, but it is outside V1.

## Roles And Scope

### HR_ADMIN

Can manage checklist templates and item weights.

Rules:

- HR can create checklist template drafts.
- HR can edit draft templates.
- HR can publish a template version.
- A template publish creates a versioned scoring contract.
- Completed historical checklists must not be recalculated if HR changes the template later.

### REGION_MANAGER

Can perform store visit checklists for assigned stores.

Rules:

- Region manager must see only stores in their allowed read/action scope.
- Starting a checklist requires action permission for that store.
- Saving item responses requires the instance to belong to an assigned store.
- Completing the checklist requires the instance to belong to an assigned store.
- Region manager cannot modify a completed checklist.

### STORE_MANAGER

Can acknowledge completed checklist results for assigned stores.

Rules:

- Store manager can see completed checklist results for assigned stores.
- Store manager can mark a checklist as acknowledged.
- Store manager cannot change score, item response, template, or completion timestamp.
- Store manager cannot reject a checklist in V1.
- Store manager acknowledgement does not delay score inclusion.

## Template And Versioning

Checklist templates are stable operational contracts.

V1 rules:

- A template has a type/category, for example `BM_STORE_VISIT`.
- The initial active flow is `Bölge Müdürü Mağaza Ziyaret Checklisti`.
- The engine must allow future types such as VM checklist without creating a separate module.
- Each template version owns its item text, response type, weight, max score, and effective dates.
- Publishing changed items or weights creates a new version.
- Existing completed checklist instances remain tied to the version used at completion time.

## Scoring

V1 active scoring uses numeric item scores.

Rules:

- Item response type supports future flexibility, but the first active BM checklist uses `score`.
- Region manager scores each item from `0` to `10`.
- Item notes are optional.
- HR-managed weights must total `100`.
- Checklist score is calculated from item score and item weight.
- A missing mandatory item blocks completion.
- Score is stored at completion time.
- Completion timestamp is stored as an explicit date-time.

Recommended score formula:

```text
itemContribution = (itemScore / 10) * itemWeight
checklistScore = sum(itemContribution)
```

Example:

- Item weight: `20`
- Region manager score: `8`
- Contribution: `(8 / 10) * 20 = 16`

## Instance Lifecycle

V1 should expose a clear lifecycle while staying compatible with existing checklist tables.

States:

- `planned`: opened but no meaningful response saved yet; shown as `Taslak`
- `in_progress`: at least one item response saved; shown as `Devam ediyor`
- `completed`: finalized, scored, locked, and visible to store manager acknowledgement
- `cancelled`: reserved for future `cancel with reason`; not part of V1 implementation

Lifecycle:

1. Region manager selects an assigned store.
2. Region manager selects an active checklist template.
3. System creates or opens a `planned` checklist instance.
4. Region manager saves item responses.
5. First saved response moves the instance to `in_progress`.
6. Region manager can leave and continue later.
7. Region manager clicks `Tamamla`.
8. System validates mandatory answers.
9. System calculates and stores score.
10. System marks the instance `completed`.
11. Completed instance becomes locked.
12. Completed instance appears for store manager acknowledgement.

## Multiple Visits In One Month

Multiple completed visits are allowed.

Rules:

- Do not enforce one checklist per store/template/month.
- Each visit is a separate checklist instance.
- Each visit stores its own completion timestamp and scorer.
- Monthly result uses completed instances only.
- Draft and in-progress instances do not affect monthly score.
- Store manager acknowledgement is tracked per completed visit.

Monthly formula:

```text
monthlyChecklistScore = average(completedChecklistScoresInMonth)
monthlyChecklistCount = count(completedChecklistInstancesInMonth)
```

## Mobile Read Model

`GET /api/mobile/checklists/today` is the first mobile checklist read-model candidate.

It should return:

- assigned stores for the current region manager
- active checklist templates available for those stores
- draft/in-progress checklist instances the region manager can continue
- completed current-month checklist summaries
- acknowledgement status for completed visits
- store manager pending acknowledgement items when the authenticated user is a store manager

This endpoint is a composition/read model. It must not become a duplicate checklist engine.

## Write Endpoints Candidate Shape

Implementation can reuse existing checklist services but should make the workflow explicit.

Candidate API shape:

- `GET /api/mobile/checklists/today`
- `POST /api/mobile/checklists/instances`
- `PATCH /api/mobile/checklists/instances/:checklistInstanceId/responses`
- `POST /api/mobile/checklists/instances/:checklistInstanceId/complete`
- `POST /api/mobile/checklists/instances/:checklistInstanceId/acknowledge`

Controller design rule:

- Keep business logic in application services.
- Keep role/scope enforcement explicit.
- Keep response DTOs mobile-friendly.
- Do not duplicate score formulas in frontend.

## Audit And Evidence

Audit events should prove the workflow:

- template version published
- checklist instance created
- checklist response saved
- checklist instance completed
- checklist instance acknowledged
- future checklist instance cancelled with reason

Evidence stored per completed visit:

- checklist instance id
- template id and version
- store id
- scorer user or employee id
- completion timestamp
- total score
- item-level responses
- acknowledgement status

## Reporting Impact

Completed checklist instances are valid immediately after region manager completion.

Rules:

- Store manager acknowledgement does not gate reporting.
- Reporting and future store score integration must use only completed instances.
- Monthly score uses arithmetic average of completed visit scores.
- Current-month views should show both score and visit count.
- If no completed checklist exists for a required period, existing warning semantics such as `missing_bm_checklist` can remain valid.

## Non-Goals

V1 does not include:

- store manager editing checklist scores
- store manager rejecting checklist results
- completed checklist edit flow
- cancellation with reason
- offline mobile sync
- photo attachments
- push notifications
- VM checklist implementation
- a separate checklist module per checklist type

## Test Strategy

Backend tests:

- HR template publish rejects weights that do not total `100`.
- Region manager can start checklist only for assigned stores.
- Region manager can save draft responses and resume.
- First response moves the instance to `in_progress`.
- Completion rejects missing mandatory items.
- Completion calculates weighted score and locks the instance.
- Completed instance rejects further response changes.
- Store manager acknowledgement succeeds for assigned store.
- Store manager acknowledgement does not change score.
- Same store/template/month can have multiple completed instances.
- Monthly summary averages completed instances and ignores drafts.

Frontend/mobile tests later:

- Region manager sees assigned stores.
- Region manager can start, save, resume, and complete a checklist.
- Store manager sees pending acknowledgement.
- Store manager can mark `Kabul ettim / Gördüm`.
- Visit count is visible in monthly summary.

## CODEX DÜRÜST YORUM

This is the right checklist shape.

The strongest part is separating scoring authority from acknowledgement authority. Region manager owns the visit score. Store manager only receives and acknowledges the result. That keeps reporting clean and prevents store-side pressure from delaying or reshaping scores.

The second important decision is allowing multiple visits per month. It matches field reality without making the monthly score chaotic, because the monthly rule is simple: average completed visits and show the count.

The third important decision is locking completed instances. Editable completed scores would become silent historical drift. If a mistake happens, V1 should prefer a new visit. Later, an audited `cancel with reason` flow can handle exceptional cases.

## Next Step

After this spec is approved, write the implementation plan for Mobile Checklist Today V1. The implementation should start with backend contract tests for template weights, region-manager scope, draft/resume/complete locking, and monthly average behavior before building UI.
