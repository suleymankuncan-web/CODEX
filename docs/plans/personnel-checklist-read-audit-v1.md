# Personnel and monthly checklist read corrections

Status: local self-review GO; PR checks pending
Shelf: implementation plan
Last verified: 2026-10-01

Decision: fix the requested personnel range benchmarks and monthly checklist
last-visit boundary, and expose optional personnel financial detail from the
existing accepted prim V2 read owner. Application UI and mail workflows are
separate follow-up PRs. Why now: a later checklist changed historical last visit,
and Store Me returned zero despite available ATV/UPT reference data.
Evidence: bounded source audit and targeted reporting/ranking/checklist tests.
Counterargument: gross/return display could bypass attribution or change scores.
The financial mapper reuses verified V2 attribution and detail authorization;
missing inputs remain unavailable. Same-store returns reduce the seller;
cross-store returns reduce only the receiving store. LP stays a valid store.

Contract Impact: additive optional detail-only ranking sales fields and selected
Istanbul-month last-visit semantics. Published scoring weights, monetary rules,
targets, permissions, writes and immutable snapshots remain unchanged.
Risk: R5 scoring/read integrity, reversible source changes. No migration or live
repair. Benchmark reads use the same range mode as the corresponding actuals;
HG remains unavailable without an approved target. Summary masking omits
personnel financial fields. Months without completion have no completed visit.

Acceptance: range benchmark regression, checklist month bounds, scope/masking,
accepted net/gross/attributed returns and compilation remain green. Architecture
limits stay fixed; the ranking dependency module owns only existing read/cache
exports. Guard extraction preserves all existing policy values. Only the reduced
reporting file-size baseline is updated in this slice.

Verification follows the explicit owner instruction: targeted local tests only;
the complete required GitHub CI is followed before squash merge. Local full run,
manual image proof, deploy and live data writes are outside scope. Rollback reverts
source/read fields without rewriting historical data. A scope leak, unverified
financial value or altered score weight stops local GO.

Final slice evidence:71 targeted backend cases across8 specs passed; backend
build, affected-file ESLint, generated API-client check,31 architecture/size
guard cases and whitespace checks passed. Splitting from the protected working
branch introduced no hidden mail/UI dependency. Inline adversarial self-review
found no remaining actionable issue in this slice. The selector requests the
full release gate; per the owner's explicit instruction that gate runs in GitHub,
while local verification remains targeted. No required CI check is waived.
