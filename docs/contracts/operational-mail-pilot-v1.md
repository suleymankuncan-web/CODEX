# Operational mail pilot V1

Status: active
Shelf: contract
Last verified: 2026-10-01

Local implementation; production activation and delivery are not established.
The common `base.template.ts` owns typography, violet palette, logo, emoji,
96px centered icon, escaped content, HTTPS CTA, plain text and CID assets.
No sample/disclaimer labels appear in real notifications.

| Event | Audiences | Attachment / link |
|---|---|---|
| Checklist completion | Actual author BM, active primary store mailbox, current store manager | Exact completed checklist detail |
| Actions assigned / closed | Same logical audiences | Action workspace; assignment count from real action rows |
| Deadline reminder | Same audiences; solution awaiting review goes to current responsible BM only | Action workspace |
| Personnel entry/sicil or exit request | Configured company HR recipients | Existing HR request queue tab |
| Submitted monthly targets | Current store BM | Target workspace |
| Missing submitted targets | Primary store mailbox + BM; owner gets one consolidated digest | Target workspace |
| Weekly report | Current assigned BM; exclusively current authorized stores | Previous Monday–Sunday Reports workbook |
| Monthly report | Same current BM scope after completed monthly snapshot closure | Monthly Reports workbook |
| Monthly personnel list | Exactly CRM and HR mailboxes approved by the owner | All personnel Excel; no application link |

Recipients require active account/role/current direct store assignment where
applicable, active store/company and matching company scope. The author is not
replaced with a guessed person. The configured primary store contact is used;
missing contact/role configuration remains pending and emits a PII-free warning.
Identical addresses receive once, including across the three checklist audiences.
Configured shared HR aliases are trusted configuration; known non-HR accounts
are excluded. HR mail contains name, existing/requested sicil if present, store
and requested date; it omits national identity, telephone and private reasons.
Entry/exit notices describe requests, not finalized employment changes.

Business transition capture is transactional in additive migration101. No source
decision, API permission or financial rule changes. Completion, assigned actions,
closure and request/submission notifications come from committed source rows.
Assignment events coalesce within one minute only before any delivery receipt
exists, and lock against concurrent expansion. Later actions create a new event,
including when only some audiences received the first batch. Existing rows are not backfilled;
business events before first activation are not delivered.

All calendars use Europe/Istanbul. Target absence is evaluated from day10 at09:00
and requires no submitted/approved monthly request; drafts/rejected requests
remain missing. Submission immediately suppresses a pending missing notice.
Reminders have separate five-day, one-day and overdue receipts per action and
termin; short deadlines show actual remaining days. Closed/cancelled actions,
changed deadlines and stale reminder bands are suppressed before sending.
Review-pending reminders ask the BM to review the submitted solution.

Weekly schedule is Monday09:00 with bounded same-week catch-up. The workbook
uses existing report columns/styles and actual physical daily aggregation;
it does not average imported ratios. HG retains the existing full monthly
target denominator for all months touched, explicitly noted in the workbook.
Monthly target/prim state is as of the interval end month; turnover remains YTD
and is labelled. Reports screen/API stays monthly. Monthly dispatch requires
a completed full-month `rpt.snapshot_run` after monthly activation covering
every currently assigned company; calendar rollover is insufficient.
Mail report links open the completed month; HR links open the correct queue.

Personnel list dispatch is on the first day of each month at09:00 Istanbul,
with current-month catch-up after downtime. One event per month and one receipt
per address prevent repeated accepted sends; expired months are suppressed.
The Excel covers every stored employee across all companies, including former
employees and employees without assignments. Columns are store, position,
first name, last name, telephone, hire date and Aktif/Pasif. Current assignments
take precedence over ended assignments; former employees retain their last
applicable store. Status comes from employment status and termination date.
Telephone numbers remain string cells. National identity and financial fields
are excluded; names and telephone numbers are never logged. The two audiences
in one delivery attempt receive the same workbook. This independent stream
does not send incentive financial exports to CRM.

`OPERATIONAL_MAIL_ENABLED`, `OPERATIONAL_WEEKLY_REPORT_EMAIL_ENABLED` and
`OPERATIONAL_MONTHLY_REPORT_EMAIL_ENABLED` and
`OPERATIONAL_PERSONNEL_ROSTER_EMAIL_ENABLED` are independent/default-off.
`OPERATIONAL_MAIL_APP_ORIGIN` must be an approved HTTPS origin. Configure
`OPERATIONAL_TARGET_OWNER_EMAIL` and company-scoped
`OPERATIONAL_HR_RECIPIENTS_JSON` privately; the owner digest requires current
SUPER_ADMIN scope and contains only authorized missing stores.
Operational SMTP settings fall back to the incentive SMTP configuration when
unset. File-backed password must be read-only mounted by the private overlay;
the tracked compose file does not mount an invented secret. SMTP secrets and
private recipient mappings are not written to Git. The sole explicit business
routing exception is the owner-approved personnel list pair:
`crm@lufian.com.tr` and `ik@lufian.com.tr`. Enabling switches requires a deployed migration,
current recipient mappings and successful provider verification.

SMTP preflight runs before delivery claims. Each event/address has one receipt;
Attempt timestamps rotate unresolved events fairly through bounded polling.
claim is atomic across API replicas. Recheck current recipients, business state
and report store scope immediately before claim. Definite pre-DATA rejection
may retry; ambiguous SMTP acceptance or abandoned sending claims become
`uncertain` and never automatically repeat. Logs omit addresses, names and
workbook content. Reports have a dedicated filename allowlist and15MiB bound;
Attachment namespace, recipient allowlist and size are checked before claiming;
invalid attachments remain pending. Operational notices do not carry incentive payroll exports. The existing rule
that only HR receives GM-final prim Excel is unchanged.

Rollback: disable the relevant switches, retaining accepted/uncertain receipts.
No live migration, deployment, account/provider change or production activation
is part of local verification. Relevant unit, workbook and disposable PostgreSQL
checks are targeted; no local full suite or manual image proof.

Scope diagnostics: the operational V3 invariant command executes `db/preflight/mail-event-scope-invariants-v1.sql` alongside its existing overlays. It detects store/company mismatches and approval package/cycle company/period mismatches in a read-only transaction, returning counts and at most five hashed references. Global personnel events legitimately have no store/company scope. The immutable V1 diagnostic query remains unchanged.
