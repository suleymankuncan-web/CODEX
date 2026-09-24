# Grouped incentive review and HR email handoff

Status: implemented and locally verified; SMTP account/recipients pending
Owner decision: 24 September 2026, current task

The Report Viewer page uses the Targets header and metrics with a grouped regional
package list.
Each regional manager package owns its visible store rows and approval action.
The previous standalone approval panel is removed. Store drawers show personnel,
rates, corrections and package notes. Report Viewer package approval and rejection
are available in the regional package list. Regional approval remains an
exact-submission command; it does not become store approval.

The owner explicitly requested an additional HR email handoff after every region
is approved, with an Excel attachment and recipients configured by the owner.
The owner selected corporate SMTP and is preparing the mail account separately.

Boundary decision (HIGH): add only the scoped HR handoff endpoints, persisted
delivery receipt, approved-package Excel builder and SMTP adapter. Use the existing
individual company-scoped INCENTIVE_FINAL_APPROVAL grant; recheck it at claim time.
Keep calculation, regional correction, final approval and other roles unchanged.
Never send real email during local tests. SMTP configuration and company-recipient
mapping are server settings, never request-provided destinations.

The summary and export cover the full authorized company set, irrespective of UI
filters. Companies receive separate attachments at their configured recipients.
Submission revalidates every required region and the preview digest. A unique
company-period delivery claim prevents duplicate sends. Uncertain SMTP outcomes
are recorded and cannot be automatically replayed. SMTP acceptance means accepted
by the mail server, not guaranteed delivery to the recipient's inbox.

Counterexample: a stale preview, an unsubmitted region, changed recipients, revoked
grant or double click must not send an incomplete or duplicate payroll file.
Tests cover those failures, spreadsheet content, scope and desktop/mobile review.
Migration readiness requires a disposable PostgreSQL smoke; live SMTP acceptance
remains unverified until the owner configures the provider.

Local verification (24 September 2026, uncommitted working tree at e051d0d2):
backend lint/build, 39 targeted Jest tests, frontend lint/build/API type parity,
35 distinct browser scenarios across 320/390/1024/1440 widths. Browser coverage
includes existing regional corrections, individual/bulk decisions, failed-batch
stop, HR scope despite filters, missing settings and uncertain mail outcomes.
PostgreSQL smoke used a disposable copy of the local synthetic database: actual
approved-package SQL (12 rows, 2 stores), migration/empty rollback/reapply,
populated-table rollback guard and two concurrent claims (one success, one 409).
No production database was touched and no email was sent. Production dependency
audit found zero advisories. The new API and UI are running in local Docker.

Inline self-review corrected generated-client route selection, partial-package
total labels, mixed-company grant scope, and zero-personnel store counts in Excel.
The follow-up review tied required regions to the selected period's latest close
snapshots and blocks HR delivery when a newly closed store is missing from its
approved package. A disposable PostgreSQL copy verified both cases without
sending email.
This is local evidence, not PR/CI or hosted SMTP/deployment evidence.
[SMTP setup and operational handling](../operations/incentive-hr-email.md).

Rollback: revert the page/API code. The additive delivery table can remain for
audit preservation; its rollback SQL must not run against a table containing
delivery receipts. No current financial row or existing package is rewritten.
