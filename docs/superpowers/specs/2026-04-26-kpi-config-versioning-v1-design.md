# KPI Config Versioning V1 Design

Date: 26 April 2026

Status: `approved_for_planning`

## Purpose

Make KPI score configuration changes traceable over time so historical reports can answer:

> Which KPI config produced this score?

Today, KPI weights, ownership, and grading bands can be edited and published through `/admin/kpi-config`. That is useful, but it is not enough for long-term reporting trust. If weights or grade bands change later, old snapshots must not silently look as if they were produced by today's rules.

## Product Problem

The business will likely change score weights and thresholds over time.

Examples:

- UPT may become more important for a campaign month.
- ATV may be lowered or raised in the personnel score.
- A/B/C/D grading thresholds may change.
- New metrics may be added later.

Without config versioning, users can ask a fair question the system cannot fully answer:

- Was this employee actually grade `B` in April?
- Or does April look like `B` because the rule changed in May?

KPI Config Versioning V1 prevents that trust gap.

## Current State

Existing strengths:

- `ops.kpi_score_profile_config` stores published and draft config payloads.
- Admin config editor supports draft save and publish.
- Publish audit exists.
- Draft/live diff preview exists on `/admin/kpi-config`.
- `rpt.snapshot_run` already represents immutable reporting snapshot runs.
- Store/personnel ranking and KPI views already depend on snapshot/read model separation.

Existing gaps:

- published config does not have a stable version id
- publish does not create immutable version history
- snapshot runs do not reference the KPI config version used during generation
- older snapshots cannot distinguish pre-governance vs versioned config output
- rollback/future effective dates are not implemented

## Decision

Implement V1 as an `ops`-owned versioning layer, not a new `dm` or global `config` schema.

V1 will:

- add immutable KPI config version records
- create a new version whenever a draft is published
- expose latest published version metadata through backend config/editor responses
- anchor new `rpt.snapshot_run` rows to the active KPI config version
- keep legacy snapshots readable with `kpiConfigVersionId = null`

V1 will not:

- build a rollback UI
- build future-effective scheduling UI
- add approval workflow to KPI config publish
- move frontend interpretation text into DB
- create a new score engine
- create a new `dm` or `config` schema

## Data Model

### New Table: `ops.kpi_config_version`

Purpose:

- immutable history of published KPI config payloads
- one row per publish event
- source of version metadata for snapshots and admin preview

Suggested fields:

```sql
kpi_config_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
version_no INTEGER NOT NULL
lifecycle_state TEXT NOT NULL DEFAULT 'published'
effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW()
effective_to TIMESTAMPTZ
published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
published_by UUID REFERENCES ops.user_account(user_id)
change_summary JSONB NOT NULL DEFAULT '{}'::jsonb
config_payload JSONB NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Suggested constraints:

- unique `version_no`
- `lifecycle_state IN ('published', 'retired')`
- `effective_to IS NULL OR effective_to > effective_from`

V1 does not need draft rows in this table. Draft remains in `ops.kpi_score_profile_config` as it does today.

### Extend: `rpt.snapshot_run`

Add:

```sql
kpi_config_version_id UUID REFERENCES ops.kpi_config_version(kpi_config_version_id)
```

Meaning:

- `null` means the snapshot was produced before config version anchoring existed, or no published version was available.
- non-null means the snapshot was generated with that KPI config version.

## Config Payload Shape

Each `ops.kpi_config_version.config_payload` stores the full published config package:

```text
storeProfile
personnelProfile
ownershipMatrix
gradingBands
```

This mirrors the existing editor contract and avoids splitting payloads before there is a proven need.

## Backend Behavior

### Publish Flow

When `publishKpiConfigDraft(actorUserId)` runs:

1. Load current published config.
2. Load draft config.
3. Validate draft config using existing validation.
4. Update live `ops.kpi_score_profile_config` rows exactly as today.
5. Insert one immutable `ops.kpi_config_version` row with:
   - next `version_no`
   - full draft payload
   - publish actor
   - diff summary
6. Record audit metadata including the new `kpiConfigVersionId` and `versionNo`.
7. Return editor state with latest published version metadata.

### Config Read Flow

`getKpiConfig()` should return the existing config shape plus metadata:

```text
metadata:
  kpiConfigVersionId
  versionNo
  effectiveFrom
  effectiveTo
  publishedAt
  publishedBy
```

If no version exists yet, metadata values may be null and the config remains readable.

### Editor Read Flow

`getKpiConfigEditor()` should return:

- draft config
- published config
- `hasUnpublishedChanges`
- latest published version metadata

### Snapshot Run Creation

When a new snapshot run is created:

1. Resolve latest active published KPI config version.
2. Write that `kpi_config_version_id` into `rpt.snapshot_run`.
3. Include it in snapshot audit metadata.
4. Include it in API snapshot run responses.

If no version exists, create the snapshot with `null` version id and expose that as `pre_governance` in UI copy.

## Frontend Behavior

### Admin KPI Config

`/admin/kpi-config` should show:

- versioned schema is active
- latest published version number
- latest published time
- whether the current draft differs from the latest version
- warning that rollback and future effective scheduling are not active yet

### Snapshot / Reports Surfaces

Any admin snapshot run list/detail that already shows snapshot metadata should be able to show:

- KPI config version number when available
- `Pre-governance snapshot` when unavailable

Store-facing views do not need a big V1 UI change. They can continue reading score/report data normally. The important V1 value is anchoring the reporting truth.

## Error Handling

Publish should fail if:

- draft config is invalid
- store/personnel weights do not sum to expected totals
- duplicate metric codes exist
- grading bands are invalid
- version insert fails

Snapshot creation should not fail only because no version exists. In that case the snapshot is created with `kpi_config_version_id = null` and is treated as pre-governance.

## Audit Requirements

KPI config publish audit should include:

- actor user id
- correlation id
- `kpiConfigVersionId`
- `versionNo`
- diff summary
- metric counts
- grading band count

Snapshot audit should include:

- snapshot run id
- snapshot type
- period start/end
- `kpiConfigVersionId`
- `versionNo` when available

## Testing Strategy

Backend tests:

- repository test or SQL contract test proves `ops.kpi_config_version` and `rpt.snapshot_run.kpi_config_version_id` exist in schema/migration
- service test proves publish creates a new version and returns metadata
- service test proves snapshot run creation anchors the latest config version
- service test proves snapshot run creation still works when no version exists
- audit test proves publish metadata includes version id and version number

Frontend tests:

- admin KPI config Playwright test sees latest version metadata
- admin KPI config Playwright test sees versioned schema active
- snapshot/admin report surface test sees config version or pre-governance label

Release verification:

```powershell
cd "<workspace-root>"
npm.cmd run check:release
```

## Rollout

V1 migration should be additive:

1. Create `ops.kpi_config_version`.
2. Seed version `1` from current published `ops.kpi_score_profile_config` rows when possible.
3. Add nullable `rpt.snapshot_run.kpi_config_version_id`.
4. Update backend publish flow.
5. Update snapshot creation flow.
6. Update admin UI metadata display.

No destructive data migration is required.

## CODEX DÜRÜST YORUM

This is the right backend investment now.

The project is becoming score-driven: KPI, rankings, incentives, challenges, regional leagues, and monthly reports all depend on trust in the score. If config can change but historical outputs cannot identify the rule version used, the product will eventually face trust problems.

V1 should stay deliberately modest. We should create version history and snapshot anchoring now, but leave rollback UI, future scheduling, approval workflow, and DB-managed interpretation copy for later. That gives the system a stronger spine without overbuilding a governance platform before the business process is mature.

Recommendation: proceed with V1 implementation planning.
