# REM-1B Staging Remediation Diagnostic Evidence V1

Status: `completed_read_only_findings_confirmed`
Shelf: evidence
Evidence class: `staging_read_only`
Observed at: 2026-07-12 08:46 Europe/Istanbul
Reviewed commit: `09800d367e5250f5bd08e1412d86323d86f9262f`
Reviewed implementation: merged PR #952
Query set: `staging-remediation-diagnostic-v1`
Approver role: Product owner, confirmed interactively for one immediate run
Receipt digest: `9eb679e8c22a343cee813a707b92bf3df06d8aaf7bbdc9892566087aa4e62e50`
Receipt file SHA-256: `88b1a5c8e693037f0fa560e532b6cb83b4bedc5f412a6d57ded5c76b4a3358d0`
Canonical receipt: `docs/evidence/readiness/2026-07-12-staging-remediation-diagnostic-v1.json`

## Purpose And Decision Boundary

This record closes REM-1B's single read-only staging diagnostic. It explains
the four non-zero V1 families with bounded reason/source buckets. It does not
approve a correction, manifest, rehearsal, commit, DML, DDL, constraint,
provider change, paid service, or production operation.

The immutable PR #951 baseline remains unchanged. The family totals are stable
at 70 check hits; this receipt adds source-record and bucket semantics without
reinterpreting the existing invariant definitions.

## Safety Proof

- The exact merged REM-1A commit owned the runner and query. The evidence branch
  changed neither before execution.
- The target was separately confirmed in a bounded immediate window. Host,
  database, URL, credentials, and CA content are not recorded.
- TLS used `verify-full`; certificate and hostname verification passed.
- One explicit `REPEATABLE READ READ ONLY` transaction owned every query and
  catalog count. The transaction was rolled back before stdout was released.
- Connection, idle, query, and statement timeouts were respectively 5000,
  1000, 30000, and 30000 milliseconds.
- The merged strict schema/digest validator and an independent post-run
  validator accepted the receipt. Standard error was empty.
- Exit code `2` means the completed sanitized result contains findings; it is
  not a runner or safety failure.
- No database location, credential, CA content, raw UUID, person identity,
  employee payload, or unbounded sample appears in the committed evidence.

## Count Semantics

| Measure | Result | Meaning |
| --- | ---: | --- |
| Overall invariant findings | 70 | `check_hits`; unchanged from the immutable V1 baseline |
| Distinct source records | 72 | Source-row participation; ASSIGN-01 pairs contribute both assignment rows |
| Distinct people | unresolved | No person count is claimed |
| Diagnostic buckets | 9 | Strict reason/source/dimension combinations |
| Cross-family same-source co-occurrences | 0 | No reviewed source row participated in two reported families |

## Family Results

| Family | Hits | Diagnostic explanation | Owner decisions still required |
| --- | ---: | --- | --- |
| `TARGET-02` | 54 | Five delta buckets (`+1` through `+5`), all approved/2026-H2, approval evidence absent, approval mode unknown, and attributable to `target.pilot_roster_import`; stored count is greater than JSON length. | `D-TARGET-COUNT`, `D-INVARIANT-DEFINITION`; no JSON/count correction is selected here. |
| `ORG-04` | 11 | Nine `ops.kpi_actual` and two `ops.workforce_norm_plan` rows; all are operational `org.scope_region_store` mismatches. | `D-ORG-AUTHORITY`, `D-ORG-HISTORY`, `D-INVARIANT-DEFINITION`; operational classification does not choose the correction winner. |
| `ORG-02` | 3 | Three assignment rows with `org.assignment_region_store_region`; no multiple-reason bucket. | `D-ORG-AUTHORITY`, `D-INVARIANT-DEFINITION`. |
| `ASSIGN-01` | 2 | Two strict multi-day, open-ended, cross-scope overlap pairs; neither is a same-day-boundary-only case. | `D-ASSIGN-DATES`, `D-ASSIGN-WINNER`, `D-INVARIANT-DEFINITION`. |

TARGET-02 delta distribution:

| Stored count minus JSON length | Requests |
| ---: | ---: |
| 1 | 7 |
| 2 | 10 |
| 3 | 17 |
| 4 | 15 |
| 5 | 5 |
| **Total** | **54** |

## Impact Inventory

The receipt inventories 21 reviewed source tables, seven write-path codes, and
two downstream codes. It found four non-internal triggers across the reviewed
catalog and one generated column. Names/definitions of triggers or generated
expressions were not emitted. These counts identify future impact-review
requirements; they do not authorize writes.

## Sokrates Decision

- **Decision:** REM-1B is complete as read-only evidence; proceed next to an
  owner decision packet, not to a correction package.
- **Evidence:** exact merged SHA, stable 70-hit family totals, nine bounded
  buckets, 72 distinct source records, strict sanitizer/digests, verify-full,
  repeatable-read/read-only proof, empty stderr, and no mutation.
- **Counterargument:** apparent source attribution may tempt an automatic
  correction. It proves where the current mismatch is attributable, not which
  business artifact must win or whether historical meaning should change.
- **Risk / door:** evidence is reversible; any future data correction is HIGH
  risk and remains owner-gated.
- **Change-my-mind triggers:** receipt/digest mismatch, hidden identity data,
  unexplained family-total drift, a runner/query change, or an owner decision
  that revises invariant meaning. None occurred in this run.
- **Next action:** prepare REM-2 options for every required `D-*` decision. Do
  not select an option, build a manifest, rehearse DML, or open a correction PR
  until the applicable owner decisions and later gates are explicit.

## No-Mutation Statement

No DML, DDL, migration, repair, deletion, reseed, constraint, runtime API,
authorization, UI, provider setting, paid service, or production operation was
performed. DB-CONSTRAINTS remains **No-Go**.
