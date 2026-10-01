# Operational mail pilot V1

Status: active
Shelf: implementation plan
Last verified: 2026-10-01

Decision: extend the approved common mail design to checklist completion,
acknowledgement-created actions, due reminders/closure, HR entry/exit requests,
monthly target submission/missing alerts and scheduled manager report attachments.
The report screen/API stays monthly. Weekly mail uses the previous Monday–Sunday
range at Monday09:00 Europe/Istanbul; monthly mail follows actual monthly closure.
Weekly, monthly and personnel-list pilot switches are independent and default-off.
The approved personnel list covers all active/former personnel and sends on
day1 at09:00 Istanbul to exactly CRM/HR, with current-month downtime catch-up.

Evidence: approved user request; existing store-contact primary email, active
direct user/store assignments, checklist/action statuses, HR request statuses,
target requests, report workbook and canonical daily ranking components.
Contract Impact: intentionally changed for notification events and internal
weekly report generation only. Preserve existing API/auth/scope/business writes,
monthly screen, scoring rules, imports, approval order and prim recipient privacy.
Risk: R5, reversible code/config, irreversible mail delivery once accepted.

Implementation slices:
1. Internal weekly workbook and strict Istanbul schedule/date helpers. Reuse
   report columns/styles and canonical daily physical facts, not monthly ratios.
2. Additive operational outbox/receipts and real source transition capture;
   no historical business-event backfill or mailbox/address guessing.
3. Typed templates and current recipient resolution: checklist author BM,
   primary store mailbox and current store manager; same parties for actions;
   HR-only requests; missing targets also one consolidated owner digest.
4. Scheduler and guarded sender:5/1 calendar-day reminders, distinct overdue
   notice, suppress closed/cancelled and identify solution-review waiting;
   no repeated events, stale-recipient delivery or uncertain-SMTP replay.
5. Targeted unit/PostgreSQL/contract/layout tests, self-review until GO.

Counterargument: reminders and attachments can spam or disclose the wrong store.
Mitigation: independent default-off toggles, exact period/entity receipt keys,
deduplicated addresses, live active roles/direct assignments, no workbook in
non-report notices, scoped manager workbook and no fabricated missing-data values.
Monthly closure must be backed by the existing completed monthly snapshot;
calendar rollover alone does not constitute approval or final-data readiness.

Acceptance: three logical checklist audiences; same address receives once;
linked checklist detail; no action assignment notification with zero actions;
HR requests described as requests until approved; draft targets remain distinct;
weekly reports cross month/year boundaries correctly and never leak another
manager's stores; monthly reports wait for closure; disabling either pilot stops
that stream. Existing relevant targeted tests remain green. No local full run.

Rollback: disable the operational/report switches; retain receipts and uncertain
claims. Revert code/theme images separately; additive audit/outbox can remain.
No live migration, provider change, production mail activation, deployment or
manual proof is part of local implementation. Approved owner-only examples may
be sent after verification under the existing sample-mail authorization.

Local verification2026-10-01:34 relevant backend unit/module/workbook cases and
7 real PostgreSQL cases passed;2 frontend mail-link cases passed. The native
database was owned, network-isolated and removed afterward. Backend/frontend
compilation, affected lint,31 architecture/file-size checks and diff checks passed.
Existing module limits were preserved: notification polling and workbook read
ownership moved into bounded modules; policy data extraction preserves all old
caps. Frozen size caps only decreased. No full local suite was run.

Self-review: GO for local implementation. Resolved findings include assignment
batch expansion races, incomplete/invalid recipient configuration, SMTP outage
scheduling retention, current report-store scope recheck, percent units below1%,
Istanbul historical visit bounds and isolated module ownership. Activation still
requires PR/CI/release, migrations100/101, private recipient/SMTP configuration,
an approved reachable HTTPS origin and explicit pilot switches. Existing GM-final
payroll Excel remains HR-only. This note establishes no production delivery.

The subsequent broader source audit supersedes these initial test counts and
records migration102, four-role native tests and the personnel-list extension:
[audit evidence](mail-personnel-package-audit-20261001.md).
