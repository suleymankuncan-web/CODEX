# REM-2B Staging Remediation Invariant Evidence V2

Status: `completed_read_only_findings_confirmed`
Shelf: evidence
Evidence class: `staging_read_only`
Observed at: 2026-07-12 14:47 Europe/Istanbul
Reviewed commit: `07c38414948c0af44172a52034dfb7000163bdc3`
Reviewed implementation: merged PR #957
Query set: `staging-remediation-invariant-v2`
Authorization: standing owner authorization recorded 2026-07-12
Launcher digest: `90ed89c29ca3147536475bd20d8bb0f3106da59277f9cc8643a487c298af994d`
Receipt digest: `f97cb2fb251735b36f7a2501d3a614da229aa653f579eb6f5a7fb2dae0685077`
Receipt file SHA-256: `b95f0cc4a3f4214333549349c79018d980c9dbf893f7a43064ecdfedecbf0e44`
Canonical receipt: `docs/evidence/readiness/2026-07-12-staging-remediation-invariant-v2.json`

## Purpose And Boundary

This record closes the one-shot V2 staging evidence execution after REM-2B and
the reviewed Windows launcher fix merged. It activates the locked V2 semantics
as evidence and publishes the exact V1-to-V2 bridge. It does not select a
row-level winner, authorize a correction, or perform DML, DDL, backup, writer
pause, provider, paid-service, or production work.

`7149` is a count of invariant check hits. It is not a distinct-person count,
an independent-defect count, or authority to update 7149 rows. One missing or
ambiguous effective manager assignment may make many KPI period records fail
closed.

## Safety And Provenance Proof

- The evidence branch, reviewed commit, `origin/main`, and merged PR #957 SHA
  all equalled `07c38414948c0af44172a52034dfb7000163bdc3`; the worktree was clean.
- The reviewed launcher consumed one atomic attempt marker. Earlier consumed
  PR #955 and PR #956 attempts remain preserved and were not retried.
- TLS used `verify-full`; certificate/hostname verification and the bound
  staging project-ref fingerprint passed without recording target identity.
- One `REPEATABLE READ READ ONLY` transaction owned the query and exact bridge;
  the runner rolled it back before emitting stdout.
- The merged typed validator accepted the canonical receipt and digest;
  stderr was empty. Exit code `2` means completed findings, not runner failure.
- The receipt contains only typed aggregates, bounded 12-character hashes,
  digests, and safety metadata. It contains no URL, host/database name, CA,
  credential, raw UUID, person identity, personnel payload, or business value.

## Family Results

| Family | V1 hits | Carried | Revised valid | V2 new | V2 hits | Disposition |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `TARGET-02` | 54 | 0 | 54 | 0 | 0 | Locked pilot-import semantics explain all V1 hits; preserve rows and advance only through formal REM-7 reconciliation. |
| `ORG-02` | 3 | 3 | 0 | 0 | 3 | Active assignment/store-region mismatch remains; lifecycle authority and exact rows are required before a package. |
| `ASSIGN-01` | 2 | 2 | 0 | 2 | 4 | Two strict overlaps also produce two multiple-open-primary hits; rotation evidence must bind each row-level winner. |
| `ORG-04` | 11 | 2 | 9 | 7140 | 7142 | Period/lifecycle semantics expose missing or ambiguous effective-manager authority; do not infer managers or bulk-edit KPI/Norm rows. |

V2 reason totals:

| Reason | Source | Check hits |
| --- | --- | ---: |
| `assignment.open_primary_multiple` | `ops.employee_assignment_history` | 2 |
| `assignment.primary_strict_overlap` | `ops.employee_assignment_history` | 2 |
| `assignment.active_region_store_mismatch` | `ops.employee_assignment_history` | 3 |
| `norm.active_manager_ambiguous` | `ops.workforce_norm_plan` | 61 |
| `norm.active_manager_missing` | `ops.workforce_norm_plan` | 2 |
| `kpi.period_end_manager_ambiguous` | `ops.kpi_actual` | 245 |
| `kpi.period_end_manager_missing` | `ops.kpi_actual` | 6834 |
| **Overall** |  | **7149** |

## Sokrates Decision

- **Decision:** accept the V2 receipt and bridge as the active staging evidence;
  keep DB-CONSTRAINTS `No-Go` and move to secure row-authority classification.
- **Evidence:** exact merged SHA, one-shot marker, verify-full, read-only
  repeatable-read proof, canonical digest validation, empty stderr, complete
  four-family bridge, and strict typed reason/source buckets.
- **Counterargument:** the large ORG-04 total may look like a direct KPI repair
  list. The receipt proves failed authority resolution, not which manager or
  stored scope should win, and repeated period rows can share one root cause.
- **Risk / door:** accepting read-only evidence is reversible; a guessed manager
  or broad correction would be a high-risk one-way business-history decision.
- **Change-my-mind triggers:** receipt/digest or V1-hash drift, unbounded/private
  output, a changed query/runner, contradictory lifecycle evidence, or a
  supposedly unique manager resolving to zero or multiple candidates.
- **Next action:** merge this evidence-only PR, then build the minimum versioned
  read-only authority classifier needed to bind ORG-04, ORG-02, and ASSIGN-01
  rows. Do not open a correction package from aggregate counts.

## No-Mutation Statement

No DML, DDL, migration, repair, deletion, reseed, constraint, runtime API,
authorization, UI, provider setting, backup, writer pause, paid service, or
production operation was performed. `D-STAGING-MUTATION` and
`D-CONSTRAINT-WINDOW` remain `NOT_READY`.
