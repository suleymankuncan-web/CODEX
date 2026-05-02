# VM Score Contribution Activation V1 Design

Date: 29 April 2026

Status: `draft_for_review`

## Goal

Activate VM checklist contribution in monthly store score without punishing stores that did not receive a VM visit in the month.

This design turns the already working `VM_STORE_VISIT` checklist workflow into a monthly score component. It does not change daily score behavior, checklist completion behavior, or VM user access boundaries.

## Context

The project already has these foundations:

- KPI benchmark scoring produces the monthly KPI performance score.
- BM checklist can contribute to monthly store score.
- VM checklist workflow works in browser smoke with real Keycloak and real DB.
- Checklist scores are locked at completion.
- Store manager acknowledgement does not gate checklist score validity.
- Missing checklist is currently treated as `not_included`, not as zero.

Current active blend behavior:

```text
KPI: 95%
BM checklist: 5%
VM checklist: 0% / future_inactive
```

Target VM-active behavior:

```text
KPI: 90%
BM checklist: 5%
VM checklist: 5%
```

## Locked Product Decisions

- VM checklist contribution is monthly only.
- Daily score surfaces must not include VM checklist contribution.
- Completed VM checklist belongs to the month of `completed_at`.
- Monthly VM checklist score is the arithmetic average of completed VM checklist scores in that month.
- Draft and in-progress VM checklists do not affect store score.
- Store manager acknowledgement does not gate score inclusion.
- Missing VM checklist is not scored as zero.
- Missing BM checklist is not scored as zero.
- Missing checklist component weight returns to KPI, not to the other checklist component.
- Completed low checklist scores affect the store score with their configured small weight.
- Historical finalized snapshots must remain tied to the score blend config used at snapshot time.
- Store score explanation must show which components were included, excluded, and why.

## Fairness Rule

The key fairness rule is:

```text
Checklist yapilmayan magaza cezalandirilmaz.
Checklist yapilan magaza ise yapilan checklist sonucunun kucuk agirlikli kalite etkisini alir.
```

This means a store is not punished because a visit did not happen. But when a visit does happen, the result is real evidence and should influence the monthly score.

The score effect is intentionally small:

```text
BM checklist: 5%
VM checklist: 5%
```

This prevents subjective field quality scoring from overpowering objective KPI performance while still making visit quality meaningful.

## Missing Component Weight Policy

V1 uses `return_missing_weight_to_kpi`.

When a checklist component is missing, its configured weight returns to KPI.

This avoids the harder-to-explain mathematical normalization where the remaining checklist component receives a larger percentage.

## Active Blend Cases

### BM and VM both completed

```text
KPI: 90%
BM checklist: 5%
VM checklist: 5%
```

Formula:

```text
monthlyStoreScore =
  (monthlyKpiScore * 0.90)
  + (monthlyBmChecklistScore * 0.05)
  + (monthlyVmChecklistScore * 0.05)
```

Example:

```text
KPI = 100
BM = 80
VM = 100

Score = (100 * 0.90) + (80 * 0.05) + (100 * 0.05)
Score = 90 + 4 + 5
Score = 99
```

### BM completed, VM missing

VM missing weight returns to KPI.

```text
KPI: 95%
BM checklist: 5%
VM checklist: not_included
```

Formula:

```text
monthlyStoreScore =
  (monthlyKpiScore * 0.95)
  + (monthlyBmChecklistScore * 0.05)
```

Example:

```text
KPI = 100
BM = 80
VM = missing

Score = (100 * 0.95) + (80 * 0.05)
Score = 95 + 4
Score = 99
```

### BM missing, VM completed

BM missing weight returns to KPI.

```text
KPI: 95%
BM checklist: not_included
VM checklist: 5%
```

Formula:

```text
monthlyStoreScore =
  (monthlyKpiScore * 0.95)
  + (monthlyVmChecklistScore * 0.05)
```

Example:

```text
KPI = 100
BM = missing
VM = 90

Score = (100 * 0.95) + (90 * 0.05)
Score = 95 + 4.5
Score = 99.5
```

### BM and VM both missing

Both missing weights return to KPI.

```text
KPI: 100%
BM checklist: not_included
VM checklist: not_included
```

Formula:

```text
monthlyStoreScore = monthlyKpiScore
```

Example:

```text
KPI = 100
BM = missing
VM = missing

Score = 100
```

## Why Missing Weight Returns To KPI

Alternative approach:

```text
Normalize among included components.
```

Example with BM completed and VM missing:

```text
KPI = 90 / 95 = 94.74%
BM = 5 / 95 = 5.26%
```

This is mathematically valid but harder to explain to store users. It also makes BM slightly stronger when VM is missing, which is not the business intent.

Preferred approach:

```text
Missing checklist weight returns to KPI.
```

This is easier to explain:

```text
VM checklist yapilmadi; bu donem VM skora dahil edilmedi. Bu pay KPI tarafinda kaldi.
```

## Component Statuses

The score breakdown must expose component status clearly.

Recommended statuses:

```text
included
not_included
missing_reference
future_inactive
```

For VM activation:

- `included`: at least one completed VM checklist exists for the store/month.
- `not_included`: no completed VM checklist exists for the store/month.
- `missing_reference`: checklist snapshot/read model cannot determine the component because source data is unavailable or invalid.
- `future_inactive`: only before VM contribution is activated; should disappear from active VM blend surfaces.

## API Breakdown Shape

The frontend must not calculate the score independently.

Backend should return:

```ts
type StoreMonthlyScoreBreakdown = {
  snapshotRunId: string;
  storeId: string;
  scoreStatus: "preview" | "final";
  totalScore: number | null;
  missingWeightPolicy: "return_missing_weight_to_kpi";
  configuredWeights: {
    kpiPerformanceWeight: 90;
    bmChecklistWeight: 5;
    vmChecklistWeight: 5;
  };
  effectiveWeights: {
    kpiPerformanceWeight: number;
    bmChecklistWeight: number;
    vmChecklistWeight: number;
  };
  components: {
    kpi: {
      included: boolean;
      score: number | null;
      weight: number;
      contribution: number | null;
      status: "included" | "missing_reference";
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
    vmChecklist: {
      included: boolean;
      score: number | null;
      weight: number;
      contribution: number | null;
      visitCount: number;
      status: "included" | "not_included" | "missing_reference";
      missingReason?: string;
    };
  };
};
```

Example with BM included and VM missing:

```json
{
  "configuredWeights": {
    "kpiPerformanceWeight": 90,
    "bmChecklistWeight": 5,
    "vmChecklistWeight": 5
  },
  "effectiveWeights": {
    "kpiPerformanceWeight": 95,
    "bmChecklistWeight": 5,
    "vmChecklistWeight": 0
  },
  "components": {
    "vmChecklist": {
      "included": false,
      "score": null,
      "weight": 0,
      "contribution": null,
      "visitCount": 0,
      "status": "not_included",
      "missingReason": "vm_checklist_not_completed_for_period"
    }
  }
}
```

## Reporting Copy

User-facing copy should be short and explicit.

Included:

```text
VM checklist katkisi: 4.5 / 5%
1 VM checklist tamamlandi
```

Missing:

```text
VM checklist: bu donem skora dahil edilmedi
VM payi KPI tarafinda kaldi
```

BM equivalent:

```text
BM checklist: bu donem skora dahil edilmedi
BM payi KPI tarafinda kaldi
```

Low checklist:

```text
VM checklist katkisi dusuk geldi; aylik skora 5% agirlikla yansidi
```

This avoids making the store feel randomly punished while still preserving checklist meaning.

## Data Flow

```text
VM user completes VM_STORE_VISIT checklist
  -> checklist instance total_score is locked
  -> monthly checklist snapshot aggregates completed VM visits
  -> store score blend reads KPI, BM checklist, VM checklist
  -> missing checklist weights return to KPI
  -> monthly score breakdown exposes configured and effective weights
  -> finalized snapshot stores config/version evidence
```

## Config Versioning

VM contribution activation must be represented as a score blend config version.

Target active config:

```text
storeMonthlyScoreBlend:
  kpiPerformanceWeight: 90
  bmChecklistWeight: 5
  vmChecklistWeight: 5
  missingWeightPolicy: return_missing_weight_to_kpi
```

Rules:

- Configured weights must total `100`.
- Effective weights may change per store/month based on missing checklist components.
- Effective weights must still total `100` when KPI score exists.
- Snapshot result must record enough evidence to explain configured and effective weights.
- Historical finalized snapshots must not change silently when the active config changes.

## Edge Cases

### KPI score missing

If monthly KPI score is missing:

- total score remains `null`.
- completed BM/VM checklist scores can still be shown as evidence.
- checklist contributions must not fabricate a total score.
- missing reason: `monthly_kpi_score_missing`.

### VM checklist completed after monthly snapshot

If a VM checklist for a closed month is completed after the official monthly snapshot:

- finalized score must not silently change.
- future audited rerun policy is required before changing historical score.

### Multiple VM checklists in one month

If multiple completed VM checklists exist:

```text
monthlyVmChecklistScore = average(completed VM checklist scores)
vmChecklistVisitCount = count(completed VM checklist scores)
```

### BM and VM template changes mid-month

Completed checklist instances keep their stored total score.

Monthly blend uses stored completed scores, not recalculated item scores.

### Store manager does not acknowledge

Acknowledgement status is visible, but score inclusion does not wait for acknowledgement.

## Functional Requirements

- FR-1: The system MUST include completed VM checklist scores in monthly store score when at least one completed VM checklist exists for the store/month.
- FR-2: The system MUST average multiple completed VM checklist scores in the same month.
- FR-3: The system MUST ignore draft and in-progress VM checklists for monthly score contribution.
- FR-4: The system MUST NOT treat missing VM checklist as zero.
- FR-5: The system MUST return missing VM checklist weight to KPI.
- FR-6: The system MUST return missing BM checklist weight to KPI.
- FR-7: The system MUST use KPI `90%`, BM `5%`, VM `5%` when both checklist components are included.
- FR-8: The system MUST expose configured weights and effective weights.
- FR-9: The system MUST keep store manager acknowledgement separate from score inclusion.
- FR-10: The system MUST preserve finalized historical score stability.

## Acceptance Criteria

- AC-1: Given KPI `100`, BM `80`, VM `100`, when monthly score is calculated, then total score is `99`.
- AC-2: Given KPI `100`, BM `80`, and VM missing, when monthly score is calculated, then total score is `99` with effective weights KPI `95`, BM `5`, VM `0`.
- AC-3: Given KPI `100`, BM missing, and VM `90`, when monthly score is calculated, then total score is `99.5` with effective weights KPI `95`, BM `0`, VM `5`.
- AC-4: Given KPI `100`, BM missing, and VM missing, when monthly score is calculated, then total score is `100` with effective KPI weight `100`.
- AC-5: Given a VM checklist is in progress but not completed, when monthly score is calculated, then VM status is `not_included`.
- AC-6: Given a completed VM checklist exists but the store manager has not acknowledged it, when monthly score is calculated, then VM status is `included`.
- AC-7: Given monthly KPI score is missing, when monthly score is calculated, then total score is `null` and checklist evidence remains visible.

## Test Plan

Backend unit tests:

- blend with BM and VM included
- blend with BM included and VM missing
- blend with BM missing and VM included
- blend with both checklist components missing
- KPI missing keeps total score null
- VM missing status uses `vm_checklist_not_completed_for_period`
- effective weights always total `100` when KPI exists

Backend integration tests:

- reporting reads BM and VM checklist snapshots by template type
- completed VM checklist appears in score breakdown
- draft/in-progress VM checklist does not appear in score breakdown
- store manager acknowledgement does not gate VM inclusion

Frontend/API tests:

- score breakdown renders VM contribution when included
- score breakdown renders `VM checklist: bu donem skora dahil edilmedi`
- score breakdown shows configured vs effective weights
- store-facing surfaces do not calculate score independently

Release validation:

- backend targeted store score blend tests
- backend reporting score blend tests
- backend build
- frontend targeted score breakdown tests if UI changes
- root `check:release`

## Out Of Scope

V1 does not include:

- daily VM checklist score contribution
- region-specific VM weights
- store-type-specific VM weights
- store-specific VM weights
- VM checklist photo attachment impact
- store manager rejection flow
- retroactive score mutation without audited rerun
- changing the VM checklist workflow permissions
- changing Keycloak/user binding behavior

## CODEX Durust Yorum

This is the correct activation path.

The user's fairness concern is real: if missing checklists are ignored but completed low checklists reduce score, visited stores can feel disadvantaged. The answer is not to make checklist meaningless. The answer is to keep the weight small, explain the impact clearly, and return missing checklist weight to KPI instead of treating missing work as zero.

The design is defensible because it separates logistics from quality evidence:

- no visit means no penalty,
- completed visit means observed quality signal,
- low visit score has only a small effect,
- every score shows its component breakdown.

This keeps the model fair enough for pilot and honest enough for later production use.

## Next Step

After this design is reviewed, create an implementation plan for:

1. Store score blend contract update.
2. VM checklist snapshot read integration.
3. Effective weight calculation.
4. Reporting DTO/API explanation fields.
5. Targeted backend tests before implementation.
