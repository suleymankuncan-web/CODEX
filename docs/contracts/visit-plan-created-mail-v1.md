# Saved weekly visit plan email

Status: implemented; deployment and activation unverified
Shelf: domain contract
Last verified: 2026-10-02
Use when: reviewing or activating notifications after BM weekly planning.

## Decision and acceptance

The owner's final scope is one email when a BM finishes planning and saves the
weekly visit calendar. Merely opening the planner or retaining an unsaved draft
sends nothing. The recipient is exactly `oguzcanakgun@lufian.com.tr`.
The subject is “X haftalık shiftini oluşturdu”, where X is the actual BM name.
The shared compact mail includes a link to the implemented checklist workspace
and an Excel of that BM's saved weekly plan: date, store code and store name.
Existing role-based application access still controls the link.

This feature has no Monday batch or completed-visit/checklist summary schedule.
Existing independent weekly store-report emails are preserved.

## Evidence and scope

The actual save writes regional revision partitions and an audit row in one
transaction. Migration103 captures those audit rows into one event per BM/week/
transaction. Its snapshot contains the final current revision IDs and the BM's
direct store scope. Later plan revisions cannot replace the saved plan in an
earlier mail. All partitions of one atomic portfolio save produce one event;
idempotent replay and unchanged saves produce none. A rollback also rolls back
the notification. Attendance completion does not create a planning notification.

Only active BM accounts with current direct assignments, active company/region/
store and a REGION_MANAGER role covering the actual store can create/export
events. Names use actual account/employee names, then the actual username.
The owner-approved fixed mailbox may be outside application accounts; it
receives only this explicitly scoped export. Saved store/revision IDs must
remain valid and authorized before delivery. Scope is rechecked before claim.
Current/upcoming-week plans are allowed; old closed-week backlog is suppressed.
No hypothetical completed visit or financial data is generated.

## Risk, counterargument and rollback

Risk: HIGH, history/authorization and irreversible SMTP delivery. Capturing only
after commit in application code could lose mail on a process crash; a revision
trigger could send separate notifications for storage partitions. The existing
transactional audit record supplies the atomic capture boundary without changing
calendar save/attendance behavior or public API contracts.

Migration103 expands event/audience/stream checks and adds a bounded trigger and
read-only scope function. Earlier migrations, plans and SMTP receipts remain
intact; no historical rows are replayed. Canonical schema mirrors migration103.
`OPERATIONAL_VISIT_PLAN_EMAIL_ENABLED` defaults to false in API and worker.
Activation gates new capture. Sent/uncertain receipts prevent automatic resend.
Rollback disables the flag and reverts source/config; keep the compatible
additive schema and immutable receipts. External accepted emails cannot be undone.

Acceptance: targeted native PostgreSQL tests for the real save, cross-region
atomic capture, rollback, replay, unchanged save, frozen revisions and revocation;
workbook/recipient/SMTP tests, fresh migration/schema parity, inline self-review
GO and all required GitHub checks. Owner instruction excludes local full suites.
Live SMTP delivery and deployment need separate runtime evidence.
