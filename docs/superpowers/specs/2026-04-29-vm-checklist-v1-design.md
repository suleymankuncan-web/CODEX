# VM Checklist V1 Design

Date: 29 April 2026

Status: `draft_for_review`

## Goal

Define the first Visual Merchandiser checklist workflow without opening a separate module: VM users should see only checklist-related surfaces, perform VM store visit checklists for assigned stores, and understand which assigned stores are missing a VM checklist for the selected month.

## Context

The project already has a reusable checklist engine:

- HR-owned checklist templates and item weights.
- Store-scoped checklist instances.
- Completed-lock behavior.
- Store manager acknowledgement.
- Monthly checklist averaging.
- BM checklist score integration into monthly store score.
- `VISUAL_MERCHANDISER` role and pilot store-scoped user binding.

VM Checklist V1 should extend that engine with a new checklist type. It must not create a second checklist engine, a second scoring model, or broad VM access to unrelated store/admin modules.

## Locked Product Decisions

- VM users are internal app users linked to employee/personnel identity, similar to other personnel-backed accounts.
- VM users are store-scoped through assigned stores.
- Pilot scope is two stores.
- Future scope may become all stores for VM users, but V1 must still use explicit assigned-store scope.
- VM users see only checklist-related surfaces in V1.
- VM users do not see target management, personnel management, KPI config, admin reports, or unrelated admin modules in V1.
- VM users can start, save, continue, and complete VM checklist visits for assigned stores.
- VM users cannot start or complete BM checklist visits.
- Region managers cannot start or complete VM checklist visits in V1.
- HR/Admin creates and publishes VM checklist templates and item weights.
- Store managers see completed VM checklist results for their assigned store and can acknowledge them.
- Store manager acknowledgement does not gate reporting or score inclusion.
- Multiple completed VM checklists can exist for the same store and month.
- Monthly VM checklist result is the arithmetic average of completed VM checklist scores in that month.
- VM checklist completion belongs to the month of `completed_at`.
- Missing VM checklist should be visible as a coverage gap, not silently hidden.
- Missing VM checklist must not create an automatic zero score in V1.

## CODEX Honest View

This should be treated as a checklist capability, not as a new VM performance module. The healthy shape is:

- one checklist engine
- multiple checklist template types
- role-specific action permissions
- clear monthly coverage reporting

The risky shape would be giving VM users broad store/admin access just because they need to visit many stores. V1 should keep them narrow: assigned stores plus checklist actions only.

## Template Type

VM checklist uses a separate template type:

```text
VM_STORE_VISIT
```

BM checklist keeps its own type:

```text
BM_STORE_VISIT
```

Rules:

- The same checklist tables should store BM and VM templates.
- The template type determines which roles can act.
- Historical completed instances stay tied to the template version used at completion time.
- HR/Admin template edits must publish a new version instead of changing completed history.

## Roles And Permissions

### HR_ADMIN / SUPER_ADMIN

Can:

- create VM checklist template drafts
- edit draft VM checklist templates
- publish VM checklist template versions
- configure VM item weights
- see VM checklist coverage for stores
- see completed VM checklist scores and acknowledgement status

Cannot in V1:

- silently recalculate historical VM checklist scores after template changes
- bypass assigned-store checks for a VM user's personal checklist action

### VISUAL_MERCHANDISER

Can:

- access checklist-only store surfaces
- see assigned stores
- see current-month VM checklist coverage for assigned stores
- start a VM checklist for an assigned store
- save VM checklist responses
- continue draft/in-progress VM checklists
- complete VM checklist visits
- see completed VM checklist history for assigned stores

Cannot:

- access non-checklist admin modules
- access target approval/configuration
- access personnel management
- access broad reporting outside checklist coverage
- start BM checklist visits
- edit completed VM checklists
- act on unassigned stores

### STORE_MANAGER

Can:

- see completed VM checklist results for their assigned store
- acknowledge completed VM checklist results

Cannot:

- change VM checklist scores
- reject VM checklist results in V1
- block score/reporting inclusion by not acknowledging

### REGION_MANAGER

Can in V1:

- keep existing BM checklist behavior
- see VM coverage later only if a separate visibility decision is made

Cannot in V1:

- start, save, or complete VM checklist visits

## VM Checklist Coverage

VM users need to know which assigned stores have not received a VM checklist for a selected month.

The checklist surface should show, per assigned store:

- store code and name
- selected month
- VM checklist status
- completed visit count
- latest completed date
- monthly VM checklist average score, if any
- draft/in-progress visit count, if any
- acknowledgement status for completed visits, if relevant

Suggested status values:

```text
not_done
in_progress
completed
multiple_completed
```

Display concepts:

```text
VM checklist yapilmadi
VM checklist devam ediyor
1 VM checklist tamamlandi
2 VM checklist tamamlandi
```

## Workflow

1. VM user opens checklist area.
2. System shows assigned stores and selected-month VM checklist coverage.
3. VM user selects an assigned store.
4. VM user starts a `VM_STORE_VISIT` checklist.
5. System creates a checklist instance in `planned` state.
6. VM user saves item responses.
7. First saved response moves the instance to `in_progress`.
8. VM user can leave and continue later.
9. VM user clicks `Tamamla`.
10. System validates mandatory items.
11. System calculates and stores the weighted checklist score.
12. System marks the instance `completed`.
13. Completed instance locks.
14. Completed result appears in store manager acknowledgement.
15. Coverage updates immediately for the selected month.

## Scoring

VM checklist item scoring should match BM checklist scoring unless a future template explicitly changes response types.

V1 numeric formula:

```text
itemContribution = (itemScore / 10) * itemWeight
checklistScore = sum(itemContribution)
```

Rules:

- VM item scores are `0` to `10`.
- HR-managed item weights must total `100`.
- Missing mandatory items block completion.
- Score is stored at completion time.
- Draft and in-progress checklists do not affect monthly score.
- Completed checklists are immutable in V1.

## Monthly Store Score Impact

VM checklist is intended to become a monthly store score component.

Target blend when VM checklist contribution is activated:

```text
KPI performance: 90%
BM checklist: 5%
VM checklist: 5%
```

V1 rules:

- VM checklist contributes monthly only, never daily.
- Monthly VM checklist score is the average of completed VM checklist visits in the selected month.
- Missing VM checklist is not scored as zero.
- If VM checklist is missing, its component is excluded and active components are normalized by policy.
- Store score snapshots must reference the score blend config version used.
- Historical snapshots must not silently change after VM score weight changes.

This keeps distant-store and scheduling realities from becoming accidental punishment.

## Read Model

The existing mobile/store checklist read model should be extended instead of creating a second VM-only read model.

Candidate behavior:

```text
GET /api/mobile/checklists/today
```

For `VISUAL_MERCHANDISER`, the response should focus on:

- assigned stores
- active `VM_STORE_VISIT` template
- current-month VM coverage per assigned store
- draft/in-progress VM checklist instances
- completed VM checklist summaries

For `REGION_MANAGER`, the response keeps BM-focused behavior.

For `STORE_MANAGER`, the response keeps acknowledgement-focused behavior for completed BM/VM checklists belonging to the assigned store.

## Write Endpoint Boundaries

Existing checklist endpoints may be reused if they enforce template type and role action correctly.

Required permission rule:

```text
VISUAL_MERCHANDISER + VM_STORE_VISIT + assigned store = allowed
VISUAL_MERCHANDISER + BM_STORE_VISIT = forbidden
REGION_MANAGER + BM_STORE_VISIT + assigned store = allowed
REGION_MANAGER + VM_STORE_VISIT = forbidden in V1
STORE_MANAGER + acknowledgement + assigned store = allowed
```

Business logic should remain in checklist application services. Frontend should not own score formulas or permission decisions.

## Audit And Evidence

Audit should prove:

- VM checklist template published
- VM checklist instance created
- VM checklist response saved
- VM checklist instance completed
- VM checklist acknowledged by store manager
- forbidden cross-template action rejected by role/scope guard

Completed evidence should include:

- checklist instance id
- template id and version
- template type
- store id
- VM user / employee id
- completion timestamp
- total score
- item-level responses
- acknowledgement status

## Pilot Scope

Pilot should use:

- one VM user
- two assigned stores
- one active VM checklist template
- checklist-only VM navigation
- current-month coverage list
- start/save/complete flow
- store manager acknowledgement visibility

The design must not assume all-store VM access yet. Future all-store access should be a role assignment/scope expansion, not a code shortcut.

## Non-Goals

V1 does not include:

- photo attachments
- offline mobile sync
- push notifications
- VM comments or social feed posts
- VM target/KPI performance module
- VM personnel management
- VM access to all admin reports
- completed checklist edit flow
- cancellation with reason
- automatic all-store assignment
- region-specific VM score weights

## Test Strategy

Backend tests:

- HR/Admin can publish a `VM_STORE_VISIT` template.
- VM template publish rejects item weights that do not total `100`.
- VM user can list assigned-store VM checklist coverage.
- VM user can start VM checklist only for assigned stores.
- VM user cannot start VM checklist for unassigned stores.
- VM user cannot start BM checklist.
- Region manager cannot start VM checklist in V1.
- VM user can save and resume VM checklist responses.
- VM checklist completion calculates weighted score and locks the instance.
- Completed VM checklist rejects later response changes.
- Store manager can acknowledge completed VM checklist for assigned store.
- Store manager acknowledgement does not change score.
- Monthly VM checklist coverage counts completed visits and ignores drafts.

Frontend tests:

- VM navigation shows checklist area only.
- VM user sees only assigned stores.
- VM user sees missing VM checklist coverage for assigned stores.
- VM user can start and complete a VM checklist from the checklist surface.
- VM user cannot see target/admin/personnel navigation.
- Store manager sees completed VM checklist acknowledgement item.

Release verification:

- backend targeted checklist/auth tests
- frontend targeted checklist/auth tests
- backend build
- frontend build
- root `check:release`

## Open Decisions Before Implementation

- Exact VM checklist template item list.
- Whether VM coverage should default to current month or last selected month.
- Whether HR/Admin needs a dedicated VM coverage admin report in the first implementation or whether VM user coverage is enough for pilot.
- Whether monthly store score should activate VM weight immediately in the first VM implementation or remain visible-only until first pilot evidence is reviewed.

## Recommended Implementation Boundary

Do this in two small steps:

1. VM checklist action enablement:
   - template type
   - role/type permission guard
   - checklist-only VM route
   - assigned-store coverage
   - start/save/complete

2. VM score contribution activation:
   - monthly store score blend `90/5/5`
   - missing VM `not_included`
   - store-facing score breakdown
   - snapshot config version evidence

This keeps the pilot useful without forcing store score math to change before the first VM checklist evidence exists.
