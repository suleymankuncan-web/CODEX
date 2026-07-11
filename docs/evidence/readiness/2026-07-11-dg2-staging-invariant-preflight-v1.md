# DG2 Staging Invariant Preflight Evidence V1

Status: `completed_no_go`
Shelf: evidence
Evidence class: `staging_read_only`
Run at: 2026-07-12 01:21 Europe/Istanbul
Reviewed commit: `8ed6886c77ec26df78d62fe4840461dbb3980f68`
Reviewed implementation: merged PR #950
Target class: `staging`
Approver role: Product owner, confirmed interactively before execution
Sanitized receipt SHA-256: `482E0AFFE975E5D1D009F4A68EA2A61F09C11ADEF59074757D088949AEC88839`

## Purpose

This record closes the DG2-C read-only evidence operation. It does not approve
data repair, schema enforcement, a migration, or broad production. The raw
runner document is intentionally not committed.

## Safety Proof

- The reviewed runner accepted only the owner-confirmed staging identity; the
  host and database name are intentionally not recorded here.
- `DB_SSL_MODE=verify-full` and a non-empty Supabase CA were supplied outside
  Git. The canonical pool builder kept certificate rejection enabled and
  removed connection-string SSL overrides.
- The pool used one connection, a 5-second connection timeout, a 30-second
  query/statement timeout, and a 1-second idle timeout.
- The runner completed with `targetClass=staging`,
  `liveEvidence=safe_target_run`, and `transactionReadOnly=true` after
  `BEGIN READ ONLY` plus `SHOW transaction_read_only`.
- Exit code `2` is the expected completed-with-violations result. Standard
  error was empty.
- Pre-parse scans found zero database URLs, private keys, bearer tokens, JWTs,
  password fields, IPv4 addresses, and email addresses. A strict JSON
  allowlist then accepted only the reviewed metadata, counts, classifications,
  reasons, and bounded sample hashes.
- No connection identity, credential, CA content, raw UUID, employee field,
  IP address, payload, or unbounded row sample is present in this record.

## Provider And Candidate-Key Metadata

| Field | Sanitized result |
| --- | --- |
| PostgreSQL version | `17.6` (`170006`) |
| Deprecated extensions checked by the runner | None present |
| Region composite unique key present | No |
| Store composite unique key present | No |

## Result Table

The counts are check hits, not a claim of 70 distinct people or business
records. A row can participate in more than one invariant family.

| Check | Category | Count | Classification | Reason | Bounded sample hashes |
| --- | --- | ---: | --- | --- | --- |
| `ASSIGN-01` | Assignment | 2 | `requires_data_correction` | `violations_present_and_temporal_semantics_unapproved` | `22ef1605151f`, `99ba8aa572d5` |
| `AUTH-01` | Authorization | 0 | `safe_to_enforce` | `approved_staging_target_reports_zero_violations` | None |
| `AUTH-02` | Authorization | 0 | `safe_to_enforce` | `approved_staging_target_reports_zero_violations` | None |
| `KEY-01` | Candidate key | 0 | `deferred_lock_or_performance` | `candidate_parent_key_validation_cost_not_measured` | None |
| `ORG-01` | Organization | 0 | `safe_to_enforce` | `approved_staging_target_reports_zero_violations` | None |
| `ORG-02` | Organization | 3 | `requires_data_correction` | `violations_present_no_automatic_repair` | `857753927fb3`, `9c8b0943b143`, `be85ba705fe8` |
| `ORG-03` | Organization | 0 | `safe_to_enforce` | `approved_staging_target_reports_zero_violations` | None |
| `ORG-04` | Organization | 11 | `requires_data_correction` | `violations_present_no_automatic_repair` | `1b653a5146e0`, `246dbd795939`, `376e62fd9afa`, `4934b376acef`, `5b6a6ed290bd` |
| `TARGET-01` | Target | 0 | `safe_to_enforce` | `approved_staging_target_reports_zero_violations` | None |
| `TARGET-02` | Target | 54 | `requires_data_correction` | `violations_present_no_automatic_repair` | `036bfddbc45a`, `0b9576c5ae25`, `0dad37bd3ed6`, `0f5ad3f8c46b`, `14ce879bcd38` |
| `TARGET-03` | Target | 0 | `requires_business_decision` | `target_duplicate_state_enforcement_unapproved` | None |
| **Total** |  | **70** | `blocked_violations` | No automatic repair |  |

## Unresolved Semantics

- `ASSIGN-01`: two overlapping primary-assignment pairs exist, and the owner
  has not approved temporal overlap semantics or a correction plan.
- `TARGET-02`: 54 requests have a stored allocation count that differs from
  the allocation JSON array length. Generated-state ownership and a correction
  plan are not approved.
- `TARGET-03`: the count is zero, but duplicate-employee enforcement ownership
  remains an explicit business decision.
- `KEY-01`: the candidate parent composite keys are absent. Validation cost and
  lock behavior have not been measured or approved.

## Family Decisions

| Invariant family | Decision | Basis |
| --- | --- | --- |
| Organization | **No-Go** | `ORG-02=3` and `ORG-04=11`; correction is required and no automatic repair is authorized. |
| Authorization | **Conditional Go** | Both checks are zero, but exact DDL, compatibility, lock, and rollback gates remain outside DG2-C. |
| Assignment | **No-Go** | `ASSIGN-01=2` and temporal semantics remain unapproved. |
| Target | **No-Go** | `TARGET-02=54`; `TARGET-03` enforcement ownership also remains unapproved. |
| Candidate key | **Conditional Go** | Data check is zero, but both composite keys are absent and validation/lock cost is unmeasured. |

Overall decision: **No-Go for DB-CONSTRAINTS**. The runner decision is
`blocked_violations`. No DB-CONSTRAINTS branch, repair, migration, or constraint
is authorized by this evidence.

## No-Mutation Statement

The approved query set ran inside a transaction proven read-only and completed
without data or schema mutation. No repair, deletion, reseed, migration, or
constraint operation occurred. Any future correction or enforcement work
requires a separately approved plan after business semantics and operational
lock/rollback gates are closed.
