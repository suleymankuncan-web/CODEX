# Mail, personnel and package audit — 2026-10-01

Status: GO for local source changes; deployment and activation not established
Shelf: implementation evidence
Scope: protected accumulated mail/checklist/personnel changes on
`codex/shared-mail-design-20261001`, based on `3d8e1b5`.

## Decision and boundaries

Decision: resolve source-level delivery, authority and archive findings, test the
four-role package flow against owned disposable PostgreSQL, and add the approved
monthly personnel workbook. The accepted shared mail design is retained.
Why now: the owner requested a final logic audit and synthetic package flow,
then approved the personnel-list example and its CRM/HR recipients.
Evidence: actual repositories, services, database constraints, targeted tests,
native migrations and accepted SMTP receipts for explicitly requested examples.
Counterargument: broad auditing can become unrelated refactoring or a release
claim unsupported by local tests. Changes stay tied to concrete findings and
existing boundaries. The alternative is to defer these findings and risk wrong
recipients, dropped action notifications or incomplete payroll context.
Risk: R5, privacy, authority, durable mail receipts and immutable money evidence.
Contract Impact: intentionally changed for the approved personnel export and
corrected current BM scope; public API, payout arithmetic and old seals are preserved.
Source/config rollback is reversible; accepted external mail is irreversible.
Guardrails: no invented target/reference values, prim calculation changes,
archived decision rewrite, live repair, real workforce export, local full suite,
manual proof/image build, deployment or automatic-send enablement.
The later owner instruction explicitly authorizes PR publication and squash merge;
required automatic CI remains mandatory.
Current user-selected root performed inline self-review; this is not independent
review. Any failing required check or changed recipient/seal contract stops GO.

## Resolved findings

1. A BM role outside a store's company could count as its owner when the user
   also had a direct store assignment. Application queries and additive
   migration102 now require the actual role scope to cover that store. Native
   cases exercise wrong-company authority, remediation and claim-time revocation.
2. Unresolvable early events could occupy the bounded mail batch indefinitely.
   Approval and operational workers stamp attempts before resolution, rotating
   pending events fairly. Missing target-owner mapping remains retryable.
3. SMTP acceptance by count alone could falsely mark a different recipient as
   delivered. Mailers check the actual accepted recipient set. Whitespace/case
   variants are normalized; uncertain sends never automatically replay.
4. A later assigned action could join a batch already delivered to one audience.
   Coalescing now stops once any receipt exists; later actions form a new event.
5. Invalid/oversized report attachments could consume a delivery claim. Filename,
   size and personnel-recipient checks now precede claims.
6. Final prim Excel omitted package notes and explicit change amounts. It now
   includes those fields, archived store context and frozen excluded personnel.
   Accepted V2 gross/return amounts are sealed as supplemental evidence and
   displayed only when they match the authoritative approved net. Later edits
   to sales facts do not alter the final export. Old seals without supplemental
   evidence retain their original format; unknown fields remain blank.
7. Personnel export could select an ended primary assignment before a current
   assignment. Current assignment coverage now takes precedence. Unassigned and
   former employees remain included; phone values are literal string cells.

## Accepted monthly personnel mail

Recipients are exactly `crm@lufian.com.tr` and `ik@lufian.com.tr`.
Schedule: day1 at09:00 Europe/Istanbul; same-month catch-up after downtime,
never a backlog of old months. The independent default-off switch is
`OPERATIONAL_PERSONNEL_ROSTER_EMAIL_ENABLED`.
Excel columns: store, position, first name, last name, phone, hire date and
Aktif/Pasif. Every stored employee is included across companies and employment
statuses, including unassigned employees. No identity or financial columns.
Both recipients receive the same generated workbook in one delivery attempt;
accepted receipts prevent repeated sends. This export is separate from the
GM-final prim Excel, which remains HR-only.

Approved synthetic sample SMTP receipts, stored privately outside Git:
- Owner sample accepted at2026-10-01T19:13:13.852Z.
- The identical sample sent to HR accepted at2026-10-01T19:19:30.923Z.
No CRM sample or real workforce export was sent. SMTP acceptance is not evidence
that the recipient opened the message or that a recurring production job is active.

## Verification

Only relevant targeted verification was run. Some unit bundles overlap and are
reported separately rather than added as unique test totals.

| Check | Result |
|---|---|
| Native company-cycle and four-role package specs |40 passed |
| Native operational mail, including all-personnel export |9 passed |
| Native approval mail compatibility/routing |9 passed |
| Auth/session/CSRF/checklist/template/module unit bundle |80 passed |
| Return/net-prim/scoring/HR workbook/no-sales unit bundle |56 passed |
| Operational/personnel delivery/module unit bundle |40 passed |
| Frontend links/session/checklist route/PNG unit bundle |43 passed |
| Architecture, file-size and image-content targeted guards |53 passed |
| Backend build and affected production/test ESLint | passed |
| Fresh native migration chain |102 applied; clean status |
| Upgrade from existing HEAD schema |3 applied,99 skipped; clean status |
| Migration repeat |102 skipped; no pending/failed/checksum drift |
| Shared generated mail theme drift | passed |

The four-role test uses actual BM submissions, SD sealing and approval, HR
approval and GM final approval. It rejects unauthorized roles and jumping
stages, preserves one exact seal through approvals, applies adjustments once,
sends no financial Excel before final, sends the final attachment only to HR,
and prevents repeated final delivery. Returns at each approval stage go back to
preparation without payment or HR export; resealing invalidates the old revision.
SMTP is the sole test double in this native flow.
The three native groups total58 passing tests. Initial failures were an outdated
synthetic fixture missing migration096, and an old-seal fixture that reseeded
timestamps and reparsed PostgreSQL numeric text. These setups were corrected;
the final cases validate the real invariant without weakening its hash check.

Earlier bounded checklist/Store Me verification is recorded in
[the corrections evidence](store-personnel-checklist-corrections-v1.md): selected
Istanbul month boundaries, detail-only financial scope, range benchmarks, desktop
and mobile Chromium layout, real PNG signature/MIME and fresh-click share.
No actual iPhone/Safari session or Photos destination has been verified. Missing
HG targets still require approved input; no target was fabricated. The historical
Kale Center item41 incident was not replayed against live data; N/A and
noncompliance remain separate and have targeted command tests.

## Remaining release work

Final inline self-review: no actionable findings remain in the inspected scope.
Acceptance is supported by the checks above; it does not replace required CI or
independent provider/device evidence. The owned temporary audit PostgreSQL
container was removed after verification; existing application services remain.

Required GitHub CI and release/image/runtime gates have not been executed for
this dirty local branch. None of these checks establish production readiness or
an exhaustive guarantee that unrelated repository code has no defects.
Migration100/101/102, the updated application/theme release, privately mounted
SMTP configuration, valid HTTPS origin and explicit per-stream activation remain
operational steps. The existing private daily-ingestion failure mail script is
outside this repository's shared-template implementation and was not redeployed.
Rollback disables the relevant flags and preserves accepted/uncertain receipts;
source changes can be reverted without repairing or rewriting live history.

## Authorized PR closeout

The owner subsequently authorized the sequential PR/merge process. Split the accumulated approved work into read/scoring fixes (#1218), shared app/Keycloak rendering (#1219), Store presentation, then durable mail/workbook workflows. All required GitHub gates run for each exact head; local checks stay targeted. No deployment or send activation follows from merging.

Fresh final-workflow slice checks: 58 native PostgreSQL cases in four specs; 42 targeted unit cases in nine specs; two frontend mail-link cases; affected-file ESLint and backend/frontend builds. A fresh real MigrationService chain applied 102 migrations, upgrade from the existing schema applied three/skipped99, and a repeated run skipped102 with clean status. Only owned synthetic databases/container were used. The existing theme credential guard retains content scanning and its exact reviewed password-reset template checksum.

Inline self-review confirms current role scope, receipt-aware action batching, attempted-event fairness, exact accepted recipient sets, attachment validation before claims, immutable supplemental payroll evidence and all-personnel assignment precedence. Final payout arithmetic and historical seals remain authoritative. Financial workbook remains HR-only; the separately approved personnel workbook has fixed CRM/HR recipients. New streams remain default-off.

The final slice also passed 101 unique targeted architecture/file-size/handoff/on-prem/content cases. The first handoff check found an over-budget documentation entry; its prose was condensed to6488 characters, preserving required fields, and both affected guards passed. Final `git diff --check` passed. Inline self-review: GO with no remaining findings in this scope. The owned native test PostgreSQL container was removed after all database checks.

## Owner-requested single-sheet payroll export

During PR closeout the owner specified one Excel sheet and thirteen ordered columns: BM, store, person, position, target, gross sales, signed returns, net sales, HG%, entitlement rate, calculated amount, final amount and comment. This replaces the earlier multi-sheet layout. Archived row/package notes and signed proposal differences share the comment cell; excluded people remain explicit zero-payment rows there. Unknown archived excluded-person amounts stay blank. Approval seals stay in the database rather than extra workbook sheets.

Fresh verification for the owner’s final layout:22 targeted workbook/manual-handoff cases,13 native four-role/approval-mail cases, affected-file ESLint, backend build and three file-size cases passed. The native assertions require a single sheet, archived sales/returns, original calculated versus final amount and the signed change in the comment; financial delivery remains HR-only. Self-review remains GO.

## CI inventory follow-up

The full root contract inventory found that the new operational mail event table was missing from scope diagnostics. The immutable V1 SQL stays unchanged. The existing operational V3 command now executes a versioned read-only mail overlay checking operational store/company identity and approval package/cycle company and period identity. Results use bounded twelve-character hashes, with no mail contents or raw identifiers. The exact table is assigned to this verified overlay; the generic scope inventory guard remains mandatory.

Fresh related evidence:30 invariant/digest-bound remediation/file-size cases and20 native operational/approval cases passed, including valid global/company events, null/wrong operational company, package/cycle company and period mismatches, five-sample limits and actual read-only transaction preservation. Affected-file ESLint and backend build passed. Inline self-review is GO; no business records, migrations, payouts, receipts or send flags were changed by this diagnostic follow-up.
