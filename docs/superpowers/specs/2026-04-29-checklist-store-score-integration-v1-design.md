# Checklist Store Score Integration V1 Design

Date: 29 April 2026

Status: `approved_for_planning`

## Context

Mobile Checklist Today V1 defines the operational visit workflow:

- HR admin owns checklist templates.
- Region manager scores store visits.
- Store manager acknowledges completed results.
- Completed checklist instances are locked.
- Multiple completed visits can exist in the same month.
- Monthly checklist result is the arithmetic average of completed visit scores.

This document defines the next layer: how completed checklist results affect store performance score.

The important boundary is:

- checklist workflow answers `what was observed during the visit?`
- KPI benchmark scoring answers `how did the store perform against Turkey averages and targets?`
- this integration answers `how much should checklist quality influence the monthly store score?`

## Locked Product Decisions

- Checklist effect is monthly only.
- Daily store score surfaces must not include checklist contribution.
- BM checklist contributes `5%` to monthly store score in V1.
- KPI performance contributes `95%` to monthly store score in V1 when BM checklist exists.
- VM checklist is future capacity.
- Future intended blend is:
  - KPI performance: `90%`
  - BM checklist: `5%`
  - VM checklist: `5%`
- Checklist weights must be configurable by `HR_ADMIN` / `SUPER_ADMIN`.
- V1 checklist score weights are Turkey-wide single configuration.
- V1 does not support region-specific, store-type-specific, or store-specific checklist score weights.
- Checklist config changes must be forward-only and versioned.
- Historical monthly snapshots must not silently change after checklist weights change.
- Store manager acknowledgement does not gate score inclusion.
- Region manager completion starts reporting validity.
- Completed checklist instances are locked.
- Future cancellation can be added as `cancel with reason`, but it is outside V1.

## Business Rule: Missing Checklist Does Not Penalize

Some stores may not receive a region manager visit every month because of distance or field reality.

Therefore V1 must not treat a missing BM checklist as zero.

If no completed BM checklist exists for the store/month:

- BM checklist contribution is excluded.
- KPI performance is normalized as the full monthly store score.
- UI must show that BM checklist was not included.
- Store is not penalized for a visit that never happened.

Required copy concept:

```text
BM checklist: bu donem skora dahil edilmedi
```

This is different from a completed checklist with a low score. A completed low checklist must affect score. A missing optional checklist must not.

## Monthly Score Formula

### With BM Checklist

When at least one completed BM checklist exists in the month:

```text
monthlyBmChecklistScore = average(completed BM checklist scores in month)
monthlyStoreScore = (monthlyKpiScore * 0.95) + (monthlyBmChecklistScore * 0.05)
```

Example:

```text
monthlyKpiScore = 108
monthlyBmChecklistScore = 80

monthlyStoreScore = (108 * 0.95) + (80 * 0.05)
monthlyStoreScore = 102.6 + 4
monthlyStoreScore = 106.6
```

The monthly KPI score may be a performance index and may exceed `100` because KPI metrics can overperform against benchmark up to their cap. Checklist score remains a `0-100` quality score and is not benchmark-capped.

### Without BM Checklist

When no completed BM checklist exists in the month:

```text
monthlyStoreScore = monthlyKpiScore
bmChecklistStatus = not_included
```

The score breakdown must still show that the checklist component is missing by policy, not forgotten by the system.

## Multiple Visits In One Month

Multiple completed BM visits are allowed.

Rules:

- Each visit is a separate checklist instance.
- Each completed visit stores its own score and completion timestamp.
- Monthly BM checklist score is the arithmetic average of completed BM visit scores in that calendar month.
- Draft and in-progress checklists do not affect score.
- Store manager acknowledgement status does not affect score.
- UI should show the visit count.

Formula:

```text
monthlyBmChecklistScore = average(completedVisitScores)
monthlyBmChecklistVisitCount = count(completedVisitScores)
```

Example:

```text
Visit 1 score = 72
Visit 2 score = 88

monthlyBmChecklistScore = 80
monthlyBmChecklistVisitCount = 2
```

UI concept:

```text
2 checklist yapildi
BM checklist ortalamasi: 80
```

## Completion Month Rule

Checklist score belongs to the month of `completed_at`.

Example:

```text
Started: 30 April
Completed: 1 May

Reporting month: May
```

This keeps the scoring contract auditable and avoids unclear partially completed visits.

## Preview Vs Official Snapshot

Completed checklist score is visible immediately after region manager completion.

Monthly score behavior:

- Current-month surfaces may show a preview using month-to-date KPI plus completed checklist average.
- Official monthly score is finalized by the month-end snapshot.
- Historical finalized monthly score must be tied to the KPI/checklist score config version used at snapshot time.

Display concept:

```text
Nisan on izleme
KPI katkisi: 95%
BM checklist katkisi: 5%
Final skor ay sonu snapshot ile kilitlenecek
```

## Config And Versioning

Checklist score blend config must be versioned with the KPI score configuration model.

V1 config concept:

```text
storeMonthlyScoreBlend:
  kpiPerformanceWeight: 95
  bmChecklistWeight: 5
  vmChecklistWeight: 0
  missingChecklistPolicy: exclude_and_normalize
  effectiveFrom: date
```

Future VM config:

```text
storeMonthlyScoreBlend:
  kpiPerformanceWeight: 90
  bmChecklistWeight: 5
  vmChecklistWeight: 5
  missingChecklistPolicy: exclude_and_normalize
```

Rules:

- Active weights must total `100` for included components.
- Inactive future components must not reduce score.
- Publishing a changed blend must create a new config version.
- Snapshot runs must reference the config version used.
- Past snapshots must not be recalculated silently.

## Reporting Breakdown

Every store monthly score surface should show:

- monthly KPI score
- KPI weight used
- BM checklist score, if included
- BM checklist visit count
- BM checklist contribution
- whether checklist was missing and excluded
- config version or equivalent trace metadata for admin/reporting users

Example with BM:

```text
KPI katkisi: 102.6 / 95%
BM checklist katkisi: 4.0 / 5%
Toplam skor: 106.6
2 checklist yapildi
```

Example without BM:

```text
KPI skoru: 108
BM checklist: bu donem skora dahil edilmedi
Toplam skor: 108
```

## Roles And Permissions

### HR_ADMIN / SUPER_ADMIN

Can:

- configure checklist score weights
- publish future score blend changes
- see stores with missing checklist coverage
- see score breakdown and config version metadata

Cannot in V1:

- retroactively change finalized monthly snapshot scores without an explicit future audited rerun design

### REGION_MANAGER

Can:

- complete checklist visits for assigned stores
- see completed visit scores for stores in scope
- see score impact preview for stores in scope

Cannot:

- change score blend weights
- edit completed checklist instances
- score stores outside assigned scope

### STORE_MANAGER

Can:

- see completed checklist result for own store
- acknowledge checklist result
- see monthly score breakdown for own store

Cannot:

- edit checklist score
- reject checklist score in V1
- delay score inclusion by not acknowledging

## Data Flow

```text
Region manager completes checklist
  -> checklist score is calculated and locked
  -> completed instance becomes valid reporting evidence
  -> monthly checklist aggregation reads completed visits
  -> store monthly score blend combines KPI + checklist
  -> monthly snapshot stores score, contribution, count, and config version
  -> UI shows breakdown and missing/included status
```

## API / DTO Expectations

Store monthly performance read models should expose enough data for explanation without frontend formula duplication.

Candidate DTO shape:

```ts
type StoreMonthlyScoreBreakdown = {
  storeId: string;
  periodStart: string;
  periodEnd: string;
  scoreStatus: "preview" | "final";
  totalScore: number | null;
  configVersionId: string | null;
  components: {
    kpi: {
      included: boolean;
      score: number | null;
      weight: number;
      contribution: number | null;
      missingReason?: string;
    };
    bmChecklist: {
      included: boolean;
      score: number | null;
      weight: number;
      contribution: number | null;
      visitCount: number;
      status: "included" | "not_included" | "missing_reference";
      missingReason?: string;
    };
    vmChecklist?: {
      included: boolean;
      score: number | null;
      weight: number;
      contribution: number | null;
      visitCount: number;
      status: "future_inactive" | "included" | "not_included" | "missing_reference";
      missingReason?: string;
    };
  };
};
```

Frontend must render this breakdown. It must not recalculate the store score independently.

## Edge Cases

### Completed checklist but no KPI score

If a completed checklist exists but monthly KPI score cannot be calculated:

- show checklist score
- total store score remains partial or null depending on existing reporting semantics
- missing KPI reason must be explicit

### BM checklist completed after snapshot

If a BM checklist for a closed month is completed after the official monthly snapshot:

- V1 should not silently mutate the finalized score
- an explicit audited rerun policy is required before changing finalized history

### Template changes mid-month

If HR publishes a new checklist template version mid-month:

- completed checklist instances remain tied to their template version
- monthly checklist average uses the stored completed scores
- old completed visits are not recalculated

### Weight changes mid-month

If score blend weights change mid-month:

- preview uses the currently active config
- official snapshot uses the config version resolved at snapshot run
- history remains versioned

### No visits due to remote location

If no BM visit happens:

- no penalty
- BM checklist marked `not_included`
- KPI score remains the monthly score

## Functional Requirements

- FR-1: The system MUST include completed BM checklist scores in monthly store score when at least one completed BM checklist exists for the store/month.
- FR-2: The system MUST average multiple completed BM checklist scores in the same month.
- FR-3: The system MUST ignore draft and in-progress checklists for score integration.
- FR-4: The system MUST NOT require store manager acknowledgement before checklist score affects reporting.
- FR-5: The system MUST NOT penalize a store when no BM checklist exists for the month.
- FR-6: The system MUST expose score breakdown including KPI contribution, BM checklist contribution, visit count, and missing/not-included status.
- FR-7: The system MUST keep checklist blend weights configurable and versioned.
- FR-8: The system MUST NOT include inactive VM checklist weight in V1 monthly score.
- FR-9: The system MUST keep finalized historical snapshot scores stable unless a future audited rerun flow is explicitly used.

## Acceptance Criteria

- AC-1: Given a store has one completed BM checklist in April, when monthly score is calculated, then BM checklist contributes `5%` and KPI contributes `95%`.
- AC-2: Given a store has two completed BM checklists in April, when monthly score is calculated, then the BM score is the arithmetic average of the two completed visit scores.
- AC-3: Given a store has only draft or in-progress checklists, when monthly score is calculated, then checklist is excluded and KPI score is normalized as the store score.
- AC-4: Given a store manager has not acknowledged a completed checklist, when reporting reads monthly score, then the completed checklist is still included.
- AC-5: Given no BM checklist exists for the month, when the UI renders the score breakdown, then it shows `bu donem skora dahil edilmedi`.
- AC-6: Given VM checklist is not active, when monthly score is calculated, then VM weight does not reduce the store score.
- AC-7: Given checklist blend weights are changed after a monthly snapshot, when the historical month is viewed, then the historical score remains tied to the original config version.

## Test Plan

Backend targeted tests:

- monthly score includes one completed BM checklist
- monthly score averages multiple completed BM checklists
- draft/in-progress checklists are ignored
- acknowledgement does not gate score inclusion
- missing BM checklist is excluded rather than scored as zero
- inactive VM checklist does not reduce score
- config version is included in snapshot scoring metadata

Frontend/API tests:

- score breakdown shows KPI and BM contributions
- missing BM checklist shows `bu donem skora dahil edilmedi`
- visit count renders correctly
- preview/final status is visible where relevant

Release validation:

- backend targeted tests
- backend build
- root `check:release` after implementation slice

## Out Of Scope

V1 does not implement:

- VM checklist scoring
- region-specific checklist score weights
- store-type-specific checklist score weights
- store-specific checklist score weights
- store manager rejection flow
- completed checklist edit flow
- retroactive score mutation
- audited historical rerun flow
- photo attachments
- push notification
- offline checklist sync

## CODEX Durust Yorum

This integration is healthy because it keeps checklist important but not overpowering.

The `5%` BM weight is enough to make store visit quality visible without letting subjective field scoring dominate objective KPI performance. The missing-checklist policy is also the right call: it protects distant stores from being punished for visit logistics outside their control.

The main risk is silent confusion. If the UI only shows one final score, people will not understand whether checklist helped, hurt, or was excluded. The breakdown is not optional; it is what makes the score trustworthy.

The second risk is historical drift. Checklist weights and templates will change over time. Versioned config and stored completed scores are the guardrails that keep old months defensible.

This is a good V1. It is small, fair, explainable, and ready to grow into VM checklist later without rewriting the model.

## Next Step

After this design is reviewed, create an implementation plan for:

1. Monthly checklist aggregation read model.
2. Store monthly score blend contract.
3. Missing-checklist exclusion logic.
4. Score breakdown DTO/API.
5. Targeted backend tests before implementation.
