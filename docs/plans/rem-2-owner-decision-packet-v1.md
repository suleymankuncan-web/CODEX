# REM-2 Owner Decision Packet V1

Status: `awaiting_remaining_owner_decisions`
Shelf: architecture
Author: Codex
Decision owner: Product owner
Prepared from: merged REM-1B PR #953 and receipt digest
`9eb679e8c22a343cee813a707b92bf3df06d8aaf7bbdc9892566087aa4e62e50`
Last verified: 2026-07-12
Authority: decision preparation only; no option is selected by this document

## 1. Reader And Required Action

This packet is for the product owner. After reading it, the owner should be
able to select, preserve, or block each decision without having to infer what
the code or diagnostic buckets mean.

The immediate action is not “make 70 become zero.” It is to decide what each
bucket means and whether changing it would correct data, rewrite valid history,
or conceal a mismatch that belongs in a versioned invariant definition.

Every owner selection remains `UNSET` until the owner states it explicitly.
Codex may explain and recommend options but MUST NOT choose one.

## 2. Locked Boundary

This is a documentation and approval-truth slice. It authorizes none of the
following:

- a second staging diagnostic;
- a correction manifest;
- rollback-only or committed DML;
- DDL, migration, index, constraint, or lock measurement;
- a provider setting, paid service, or production operation;
- changing the immutable V1 query or evidence; or
- treating 70 check hits, 72 source records, or an unresolved person count as
  interchangeable.

An `UNSET` or `blocked` decision keeps the affected family out of correction
and constraint work.

## 3. Evidence Baseline

REM-1B ran the exact merged REM-1A implementation once using `verify-full` and
one `REPEATABLE READ READ ONLY` transaction. Family totals remained unchanged
from V1:

| Family | Check hits | Diagnostic buckets | Evidence quality |
| --- | ---: | ---: | --- |
| `TARGET-02` | 54 | 5 | Strong source attribution; business semantics still owner-owned |
| `ORG-04` | 11 | 2 | Source tables known; period/history meaning not proven |
| `ORG-02` | 3 | 1 | Mismatch reason known; active/history/source winner not proven |
| `ASSIGN-01` | 2 | 1 | Overlap shape known; business winner not proven |

Additional facts:

- 72 distinct source records participate. The number exceeds 70 because each
  assignment-overlap pair owns two assignment rows.
- No reviewed source row co-occurs across two reported families.
- Distinct people remain unresolved.
- Nine strict buckets contain bounded hashed references only.
- No data or schema mutation occurred.

## 4. Sokrates Order Of Decisions

Decisions should be taken in this order:

1. Decide whether each bucket is a defect, valid under revised semantics,
   preserved/excluded history, or blocked.
2. For buckets classified as defects, decide which source owns the truth.
3. Decide target duplicate and assignment-date business semantics.
4. Only for selected correction families, decide restore and concurrency.
5. Decide an operator/window only after an exact package and manifest exist.
6. Defer constraint windows until reconciliation and disposable DDL evidence.

Why this order matters: choosing a correction mechanism before deciding what
the data means would make implementation convenience the source of business
truth.

### 4.1 Why now and cost of delay

Preparing the decisions now removes ambiguity before any write package is
built. There is no operational urgency to mutate: postponing a decision leaves
the real staging rows unchanged and keeps DB-CONSTRAINTS No-Go. The cost of
delay is only that correction/constraint work stays blocked. That is cheaper
than selecting a weak rule and rewriting valid history.

## 5. Decision Quality Snapshot

| Area | Current score | Why it is not higher |
| --- | ---: | --- |
| TARGET-02 source and shape | 4/5 | Owner selected revised semantics/preserve; REM-2B query and V1-to-V2 bridge are not yet implemented or approved |
| ORG-04 | 3/5 | Source table/reason are known; affected periods and historical intent are not |
| ORG-02 | 3/5 | Exact mismatch reason is known; assignment lifecycle/source authority is not |
| ASSIGN-01 | 3/5 | Overlap is strict/open/cross-scope; authoritative winner is unknown |
| Mutation/restore/concurrency | 2/5 | No family, manifest, current restore point, or write window is approved |

High-risk data decisions should reach at least 4/5 before a package PR. A low
score does not force more live access; `blocked` is an honest terminal option.

## 6. TARGET-02: Pilot-Imported Target Requests

### 6.1 What the evidence proves

All 54 requests are:

- approved;
- created in 2026 H2;
- missing approval-evidence JSON;
- unknown as direct-versus-adjusted approval mode;
- attributable to the pilot roster import path; and
- storing a count greater than the JSON array length.

The five deltas are:

| Stored count minus JSON length | Requests |
| ---: | ---: |
| 1 | 7 |
| 2 | 10 |
| 3 | 17 |
| 4 | 15 |
| 5 | 5 |

Repository evidence explains the pattern. Pilot import creates or reuses an
approved request with an empty allocation JSON, writes approved personnel
target references, then recalculates the request count and total from those
references. Normal interactive requests instead write count and JSON together.

Therefore “set count from JSON” would set these imported request counts toward
zero while approved personnel target references still exist. It is not a safe
default.

### 6.2 `D-INVARIANT-DEFINITION` options for the five TARGET buckets

| Option | Meaning | Advantage | Cost/risk |
| --- | --- | --- | --- |
| `valid_under_revised_semantics` | Pilot-import request count is validated against its approved personnel references, while ordinary requests remain count-versus-JSON. | Matches the proven dual write contract without rewriting imported history. | Requires REM-2B, a V2 query/spec, adversarial fixtures, and an exact V1-to-V2 bridge. |
| `data_defect_correct` | The pilot path should have populated allocation JSON and the existing V1 rule is still universal. | Preserves one invariant for every request. | Requires reconstructing an approval payload and proving its source/audit meaning. |
| `preserve_excluded` | Preserve these requests and exclude this subtype from constraint eligibility. | No risky rewrite. | Leaves enforcement intentionally incomplete for this subtype. |
| `blocked` | Evidence is insufficient to choose. | Prevents accidental data loss. | Stops TARGET correction and target constraint work. |

Sokrates recommendation, not a decision: treat
`valid_under_revised_semantics` as the leading option because the code proves a
separate pilot-import contract. Select it only if the owner confirms that the
approved personnel references, not allocation JSON, are the authoritative
import result.

Owner selection for all five buckets: `valid_under_revised_semantics`, approved
2026-07-12.

Locked decision record:

| Field | Value |
| --- | --- |
| Decision ref | `REM2-TARGET-02-PILOT-20260712` |
| Approver role | Product owner |
| Decision date | 2026-07-12 |
| Affected buckets | All five `TARGET-02` pilot-import buckets: deltas `+1` through `+5`, 54 check hits |
| Disposition | `valid_under_revised_semantics` |
| Evidence basis | Merged REM-1B receipt, stable V1 totals, and repository-proven pilot import writer behavior |
| Current active query | V1 remains active and immutable until REM-2B is separately approved |
| Required next query | A separately reviewed V2 must validate ordinary requests against JSON and pilot-import requests against approved personnel references |
| Constraint eligibility | `blocked` pending approved REM-2B and zero under its active semantics |
| Revisit trigger | V2 cannot prove count/reference agreement; source attribution changes; approved personnel references are not the business authority; or the owner makes JSON universal |

This decision opens REM-2B only. It authorizes no data correction or constraint.

### 6.3 `D-TARGET-COUNT` options

| Option | What a later package would do | Sokrates view |
| --- | --- | --- |
| `preserve` | Keep current request rows; pair with a versioned semantic if selected above. | Leading companion to revised semantics. |
| `rebuild_both` | Rebuild JSON, count, totals, and affected references from one approved authoritative roster snapshot. | Viable only if exact source/audit reconstruction is available. |
| `json_canonical` | Set count from current JSON. | Not recommended for these buckets because JSON is empty while approved references exist. |
| `blocked` | Make no data change. | Correct if import ownership is not approved. |

Owner selection for all five buckets: `preserve`, approved 2026-07-12.

The preserved rows remain unchanged. `preserve` is paired only with the locked
revised-semantic decision above; it is not permission to ignore these rows in
V1 continuity evidence.

### 6.4 `D-TARGET-DUPLICATE`

TARGET-03 is zero, but zero does not define whether one employee may occur more
than once in one request.

| Option | Advantage | Cost/risk |
| --- | --- | --- |
| `reject_app` | Clear user feedback without immediate DDL. | Other writers can still bypass application validation. |
| `reject_app_and_db` | Consistent enforcement across writers. | Requires compatibility, disposable DDL, lock, and rollback evidence. |
| `allow` | Supports intentionally split allocations. | Requires explicit aggregation semantics to prevent double counting. |
| `blocked` | No invented rule. | Target constraint work remains blocked. |

Sokrates recommendation, not a decision: if duplicates have no legitimate
business meaning, prefer application rejection first and consider database
enforcement only after REM-8 evidence. If split allocations are legitimate,
select `allow` and define exact aggregation behavior.

Owner selection: `reject_app_and_db`, approved 2026-07-12.

Locked interpretation:

- A duplicate means the same employee appears more than once inside one target
  distribution request. The create boundary and any adjusted-approval boundary
  must reject that shape.
- A month may legitimately receive a revision or a new target request. That is
  a new, reasoned request/version containing the intended complete allocation
  snapshot; it is not a duplicate inside the earlier request.
- The same employee may therefore appear once in each successive request for
  the same month. Only one approved personnel target reference may be active
  for that employee, month, and target type at a time.
- Approving a later version must preserve audit history: create the replacement
  reference, link it to the prior reference, and mark the prior reference
  `superseded` transactionally. Closed snapshots remain anchored to the
  reference they used unless a separately authorized rerun exists.
- Database enforcement must distinguish same-request duplication from valid
  cross-request version history. It is deferred to REM-8 compatibility,
  disposable-DDL, lock, rollback, and concurrency evidence; this decision does
  not authorize DDL.

Repository gap recorded with this decision: the request UI already submits a
revision as a new request, but the current approval writer uses an active-row
conflict update rather than creating a linked replacement reference. That code
must not be described as history-preserving until a separate implementation PR
and tests prove the lifecycle above. The gap does not permit duplicate
allocations inside one request and does not authorize a runtime change here.

## 7. ORG-04: Scoped Operational Rows

All 11 rows have `org.scope_region_store`. Nine belong to KPI actuals and two
to Norm Kadro plans. No reporting snapshot, staging-lineage, or audit row is in
this result.

“Operational” does not automatically mean “safe to overwrite.” Both tables
carry period-specific business facts.

### 7.1 KPI actuals: nine rows

KPI actuals are upserted from integration batches and store company, region,
value, source-batch, source-hash, and period metadata. Current master hierarchy
may differ from the source-period hierarchy.

| Option | Disposition | Advantage | Cost/risk |
| --- | --- | --- | --- |
| Rebuild from the authoritative source using current approved mapping | `data_defect_correct` / `rebuild` | Preserves source lineage and writer semantics. | Needs the exact source batch and a reviewed replay path. |
| Preserve source-period scope | `preserve_excluded` or `valid_under_revised_semantics` | Protects historical reporting truth. | Requires V2 semantics or exclusion from current-hierarchy constraints. |
| Directly update region to current store region | `data_defect_correct` / `correct` | Small apparent diff. | Weakest audit story; may rewrite period truth and bypass source hashes. |
| Block | `blocked` | Prevents unjustified history changes. | ORG-04 remains non-zero/excluded. |

Sokrates recommendation, not a decision: do not choose a generic direct
update. Choose source rebuild if these rows should follow the approved current
mapping; choose preserve/versioned semantics if they represent historical
scope. The receipt does not prove which is true.

Owner selection for `ops.kpi_actual`: `valid_under_revised_semantics`, approved
2026-07-12.

Locked monthly ownership rule:

| Field | Value |
| --- | --- |
| Decision ref | `REM2-ORG04-KPI-PERIOD-END-20260712` |
| Business meaning of region | A region is the responsibility portfolio of a region manager, not an immutable geographic label |
| Canonical monthly owner | The region-manager assignment effective on the last calendar day of the KPI month |
| Mid-month change | The entire month belongs to the new manager if that manager is effective at month end |
| Multiple changes in one month | The manager effective at month end owns the entire month |
| Change after month end | It does not reassign the already closed prior month |
| Historical rule | Preserve a closed KPI row after it is proven against the period-end assignment; do not compare it to the store's later current region |
| Missing or overlapping assignment | `blocked`; do not guess an owner or auto-correct the KPI row |
| Existing nine hits | Unclassified pending effective-dated period-end assignment evidence |

`D-ORG-HISTORY / ORG-04 kpi_actual` is therefore
`period_end_manager_canonical`, approved 2026-07-12. A versioned invariant must
compare monthly KPI scope with the assignment effective at period end, not with
the store's current `region_id`. The nine current hits may resolve as valid or
as correction candidates only after that comparison. This decision authorizes
no replay, direct update, DML, or DDL.

### 7.2 Norm Kadro plans: two rows

Norm plans store approved headcount/FTE by company, region, store, position,
and period. The repository exposes no normal runtime writer; current rows are
seed/import/approved planning state.

| Option | Disposition | Advantage | Cost/risk |
| --- | --- | --- | --- |
| Supersede/rebuild active or future plans | `data_defect_correct` / `rebuild` | Keeps current planning aligned without rewriting closed periods. | Requires period status and an approved replacement plan. |
| Preserve closed historical plans | `preserve_excluded` | Protects approved historical planning truth. | Excludes those rows from hierarchy constraints. |
| Directly update current rows | `data_defect_correct` / `correct` | Mechanically simple. | May rewrite an approved plan without replacement evidence. |
| Block pending period evidence | `blocked` | Safest with current evidence. | No ORG-04 correction package yet. |

Sokrates recommendation, not a decision: classify by affected period before
choosing. Rebuild/supersede active or future plans; preserve closed historical
plans. Because REM-1B intentionally contains no business dates, the current
safe selection is otherwise `blocked`.

Owner selection for `ops.workforce_norm_plan`:
`valid_under_revised_semantics`, approved 2026-07-12.

Locked lifecycle rule:

| Field | Value |
| --- | --- |
| Decision ref | `REM2-ORG04-NORM-LIFECYCLE-20260712` |
| Closed period | Preserve the approved plan and its historical manager/region scope |
| Active period after manager change | Create an approved replacement version under the new manager; retain the prior version as `superseded` |
| Future period after manager change | Rebuild or supersede through the approved planning lifecycle before the period becomes active |
| Plan values | Preserve approved headcount/FTE when only manager ownership changes; changing business values requires a separate reasoned plan revision and approval |
| Direct row update | Forbidden; it loses approval and version history |
| Missing period state or manager assignment | `blocked`; do not guess, rewrite, or delete |
| Existing two hits | Unclassified pending period-state and effective manager evidence |

`D-ORG-HISTORY / ORG-04 workforce_norm_plan` is therefore
`supersede_active_future_preserve_closed`, approved 2026-07-12. This is the
business lifecycle to implement, not proof that the two current rows already
follow it. The repository has no normal runtime writer for these plans, so any
replacement path requires a separate implementation and approval package. No
rebuild, direct update, DML, or DDL is authorized here.

## 8. ORG-02: Assignment Region Versus Store Region

Three assignment rows disagree only on assignment region versus the referenced
store's current region. No company, employee-company, or position-company
reason appears, and no row has multiple reasons.

| Option | Meaning | Advantage | Cost/risk |
| --- | --- | --- | --- |
| Store master owns current assignments | Correct assignment region from store region. | Matches normal ingestion behavior. | Unsafe for historical assignments or changed store hierarchy. |
| Assignment history owns period truth | Preserve assignment region. | Protects time-aware personnel history. | Requires exclusion/versioned semantics for current-master comparison. |
| Rebuild/supersede from the authoritative assignment source | Replace through the owning lifecycle/import path. | Strong audit and writer consistency. | Needs source identity and per-row lifecycle evidence. |
| Block | No correction direction. | Avoids guessing. | ORG-02 remains non-zero/excluded. |

Sokrates recommendation, not a decision: choose `blocked` until the owner can
state whether historical assignments retain their original region and which
source owns these three rows. If the rule is “active assignments always follow
the store's current region,” that statement must be explicit before selecting
store master authority.

`D-ORG-AUTHORITY` selection:
`store_master_active_assignment_history_closed`, approved 2026-07-12.

`D-INVARIANT-DEFINITION` selection:
`lifecycle_aware_assignment_region`, approved 2026-07-12.

Locked assignment-region rule:

| Field | Value |
| --- | --- |
| Decision ref | `REM2-ORG02-ASSIGNMENT-LIFECYCLE-20260712` |
| Active assignment | Its region must match the assigned store's current region-manager portfolio |
| Manager/region change | Close the prior active assignment with an end date and create a successor assignment under the store's new region; do not rewrite the prior row |
| Closed assignment | Preserve its original region as period history even if the store later moves to another manager |
| Future assignment | Validate against the store authority when the assignment becomes active |
| Missing dates, overlapping active rows, or missing store authority | `blocked`; do not infer or update |
| Existing three hits | Unclassified pending assignment-status, date, and authoritative-source evidence |

An active mismatch is a rebuild/supersede candidate through the assignment
lifecycle. A closed mismatch against today's store region is valid historical
state and must be excluded from a current-master equality invariant. The
current pilot roster writer does not automatically rotate an otherwise matching
active employee/store/position row when only its region changes; a separate
implementation PR must close and recreate that lifecycle safely. This decision
authorizes no direct update, import replay, DML, or DDL.

## 9. ASSIGN-01: Two Open Cross-Scope Primary Overlaps

Both pairs are strict multi-day, open-ended, and cross-scope. Neither pair is
reported only because two assignments meet on one transfer day. Therefore a
same-day boundary clarification alone cannot resolve these two findings.

### 9.1 `D-ASSIGN-DATES`

| Option | Meaning | Consequence |
| --- | --- | --- |
| One open primary assignment at a time | Open strict overlaps are defects; same-day transfer semantics are decided separately. | These two pairs need winner/supersession decisions. |
| Multiple primary assignments allowed across scope | Cross-scope concurrency is valid. | Requires a versioned invariant and downstream headcount/ranking/target semantics. |
| Multiple assignments allowed, exactly one primary | Dual work may exist but primary flag must select one. | Likely requires correcting one row per pair without deleting history. |
| Block | Business rule remains undefined. | No assignment correction or constraint package. |

Sokrates recommendation, not a decision: use “multiple assignments may exist,
exactly one open primary” unless the business explicitly treats two stores as
simultaneously primary. This protects headcount, turnover, targets, reporting,
and incentive consumers without forbidding secondary work.

Owner selection: `multiple_assignments_exactly_one_open_primary`, approved
2026-07-12.

The owner must also state whether `end_date` is the last active day and whether
a same-day transfer is allowed. That answer affects the future invariant even
though it does not clear these strict overlaps.

`D-ASSIGN-DATES` selection:
`inclusive_end_next_primary_start_following_day`, approved 2026-07-12.

Locked assignment-overlap rule:

| Field | Value |
| --- | --- |
| Decision ref | `REM2-ASSIGN01-PRIMARY-SUPPORT-20260712` |
| Ordinary employment | A person may have multiple concurrent assignments |
| Primary ownership | Exactly one open assignment may have `is_primary_assignment = true` at a time |
| Support work | A temporary assignment at another store is allowed only as secondary and may overlap the primary assignment |
| End date | Inclusive: it is the employee's last active day in that assignment |
| Primary transfer | The successor primary assignment starts no earlier than the day after the prior primary assignment ends |
| Same-day primary handoff | Not allowed |
| Existing two pairs | Both are strict, multi-day, open primary overlaps and are defects under this rule |

The two current pairs still need `D-ASSIGN-WINNER`: approved roster/lifecycle
evidence must identify which row remains primary and whether the other row is a
real support assignment to demote or a stale assignment to close. Creation time
alone is not authority. No row may be changed, demoted, or closed until that
per-pair evidence and a separate correction authority exist.

### 9.2 `D-ASSIGN-WINNER`

| Option | Advantage | Cost/risk |
| --- | --- | --- |
| Current approved roster/lifecycle source wins per pair | Ties correction to business source. | Requires exact source evidence for each pair. |
| Latest-created assignment wins | Mechanical. | Creation time is not proof of authority. |
| Current store/position state wins | Aligns live operations. | May rewrite valid historical transition state. |
| Manual per-pair owner decision | Highest semantic precision. | Requires secure out-of-Git row review. |
| Block | No invented winner. | No correction package. |

Sokrates recommendation, not a decision: manual per-pair selection based on
the approved roster or lifecycle source. Do not use “latest row wins” as a
generic rule.

Owner selection: `approved_effective_dated_rotation_lifecycle_source`, approved
2026-07-12.

Locked winner rule:

| Field | Value |
| --- | --- |
| Decision ref | `REM2-ASSIGN01-WINNER-ROTATION-20260712` |
| Authority | The approved, effective-dated personnel rotation or assignment-lifecycle record |
| Before rotation | The previous store remains primary through the day before the approved rotation effective date |
| On and after rotation | The new store is primary from the approved rotation effective date |
| Prior row | Close it with `end_date = rotation effective date - 1 day`; do not delete or overwrite its history |
| Successor row | Create it with `start_date = rotation effective date` and primary status |
| Support assignment | Preserve it as secondary when approved support evidence exists; it does not compete for primary winner |
| Missing or conflicting rotation evidence | `blocked`; do not use creation time, current row order, or an inferred winner |

This locks the winner method, not the row-level result for the two current
pairs. Their sanitized receipt does not contain enough lifecycle evidence to
name the winning store. A separately authorized secure evidence review must
bind each pair to its approved rotation record before any row is closed,
created, or demoted. No staging read, correction, DML, or DDL is authorized by
this decision.

## 10. Cross-Family Execution Decisions

These decisions are prepared now but should be selected only after at least one
family is classified `data_defect_correct` with a named correction direction.

### 10.1 `D-RESTORE`

| Option | Current posture |
| --- | --- |
| Fresh encrypted logical backup plus verified disposable application-schema restore | Zero-incremental-cost leading option; the May drill proves the method but not a current restore point. |
| Existing managed backup with owner-accepted recovery point | Valid only after current provider capability and recovery timestamp are verified. |
| Paid PITR | Not authorized and unnecessary unless the owner requires a shorter RPO. |
| Block | Required when no current restorable point and accepted RPO exist. |

Sokrates recommendation, not a decision: before any rollback-only staging
rehearsal, create a fresh logical backup and prove a disposable restore using
existing resources. Do not purchase PITR automatically.

Owner selection: `UNSET`.

### 10.2 `D-CONCURRENCY`

| Option | Advantage | Cost/risk |
| --- | --- | --- |
| `approved_write_pause` | Simplest fail-closed posture for a single operator and small manifest. | Must prove every affected app/import writer is paused. |
| `locks_plus_old_value_predicate` | Allows unaffected traffic to continue. | More package complexity; any conflict invalidates the window. |
| `blocked` | No unsafe concurrency assumption. | No live correction. |

Sokrates recommendation, not a decision: prefer an approved pause of the exact
affected writers when operationally possible; still retain deterministic locks
and old-value predicates as defense in depth.

Owner selection: `UNSET`.

### 10.3 `D-STAGING-MUTATION`

This decision cannot be completed in this packet. It requires:

- selected family and disposition;
- merged package runner SHA;
- exact out-of-Git manifest digest and expected rows;
- fresh restore receipt;
- chosen concurrency mode;
- named operator and bounded rehearsal window; and
- separate commit authority after rollback-only evidence.

Current state: `NOT_READY`; this is not an owner selection.

### 10.4 `D-CONSTRAINT-WINDOW`

Deferred until REM-7 reconciliation and REM-8A/8B capacity/DDL evidence.
Current state: `NOT_READY`; this is not an owner selection.

## 11. Independent DG1-C Decision

`D-DG1C-USAGE` remains outside the database remediation train. Missing provider
usage evidence preserves both compatibility endpoints and does not block this
packet. No selection is made here.

## 12. Owner Selection Form

The owner may answer sequentially. Copying this form is optional; plain-language
answers are accepted and Codex will map them back for confirmation.

```text
D-INVARIANT-DEFINITION / TARGET-02 five pilot buckets = valid_under_revised_semantics (LOCKED 2026-07-12)
D-TARGET-COUNT / TARGET-02 five pilot buckets = preserve (LOCKED 2026-07-12)
D-TARGET-DUPLICATE = reject_app_and_db (LOCKED 2026-07-12)

D-INVARIANT-DEFINITION / ORG-04 kpi_actual = valid_under_revised_semantics (LOCKED 2026-07-12)
D-ORG-HISTORY / ORG-04 kpi_actual = period_end_manager_canonical (LOCKED 2026-07-12)
D-INVARIANT-DEFINITION / ORG-04 workforce_norm_plan = valid_under_revised_semantics (LOCKED 2026-07-12)
D-ORG-HISTORY / ORG-04 workforce_norm_plan = supersede_active_future_preserve_closed (LOCKED 2026-07-12)

D-INVARIANT-DEFINITION / ORG-02 assignment-region = lifecycle_aware_assignment_region (LOCKED 2026-07-12)
D-ORG-AUTHORITY / ORG-02 assignment-region = store_master_active_assignment_history_closed (LOCKED 2026-07-12)

D-INVARIANT-DEFINITION / ASSIGN-01 strict/open/cross-scope = multiple_assignments_exactly_one_open_primary (LOCKED 2026-07-12)
D-ASSIGN-DATES = inclusive_end_next_primary_start_following_day (LOCKED 2026-07-12)
D-ASSIGN-WINNER = approved_effective_dated_rotation_lifecycle_source (LOCKED 2026-07-12)

D-RESTORE = UNSET
D-CONCURRENCY = UNSET
D-STAGING-MUTATION = NOT_READY
D-CONSTRAINT-WINDOW = NOT_READY
```

Every accepted answer must later record approver role, date, evidence basis,
affected buckets, active query version, constraint eligibility, and revisit
trigger.

## 13. Stop Rules

Stop instead of filling a blank when:

- an answer depends on hidden row identity, status, period, or source evidence
  that is not present;
- missing evidence is being fetched through a second staging query without a
  new implementation/evidence slice and separate approval;
- the easiest update is being treated as the authoritative source;
- a historical fact would be rewritten only to make a check zero;
- TARGET revised semantics are selected without a separate V2 query/spec and
  V1-to-V2 bridge;
- a winner rule would be inferred from latest timestamp alone;
- restore, manifest, concurrency, or operator evidence is absent;
- a decision attempts to authorize rehearsal, commit, DDL, or production in
  the same action; or
- the owner prefers `blocked` or `preserve_excluded`.

## 14. What Happens After Owner Decisions

- `valid_under_revised_semantics` opens REM-2B only; it does not mutate data.
- `data_defect_correct` may open one family package PR only after restore and
  concurrency decisions close.
- `preserve_excluded` keeps the bucket in V1 continuity evidence but outside
  constraint eligibility.
- `blocked` closes no further package for that bucket.
- No correction package shares TARGET, ORG-02, ORG-04, or ASSIGN-01 in one live
  transaction.

## 15. References

- Post-DG2 remediation and constraint re-entry plan V1
- REM-1B staging remediation diagnostic evidence V1
- Immutable DG2 staging invariant preflight evidence V1
- Supabase recovery posture decision V1 and logical restore drill
- Target-distribution, pilot-roster, KPI-materialization, assignment, and Norm
  Kadro repository/schema contracts
