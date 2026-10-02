# Account names and identity profile synchronization

Owner scope (2026-10-02): retain username entry/editing and use saved first/last
names wherever a person appears in Store. Include checklist results and previously
requested profile synchronization, application/provider browser title and icon.

## Display inventory

| Surface | Name sources corrected |
|---|---|
| Store sidebar, home, settings, session; Admin identity chrome | Current account/session display name; account first/last names when no employee is linked |
| Checklist manager/store lists, completed results, signatures, PDF inputs, operational history | Completing account before a different auditor; assigned manager account names; remove the result modal's raw actor-id fallback |
| Weekly visit calendars and plan mail | Assigned manager's account names |
| Store targets and personnel/request workspaces | Manager and correction/event actor names |
| Incentive workspace, package lists, submitting/reviewing actors, HR export | Manager/account names; preserve manager identity and ambiguous-assignment checks |
| Rankings and report manager filters, monthly store Excel | Manager account names; retain internal sorting/identity selection |
| Task owner and task history | Owner/actor account names; suppress a recorded login identifier as a display name |
| Auth user list/dialogs and Admin account audit links | Saved first/last names; keep username fields and search |
| New incentive seals and approval mail events | Record account names instead of login names |

Existing sealed financial payloads and audit rows are not rewritten. Missing name
attributes use the existing neutral label/unknown state, never a name inferred
from a username, email or id. The browser resolver also suppresses login identifiers
retained as display names in older sessions.

## Profile synchronization

A restored isolated Keycloak database reproduced a username update returning 400
with `error-user-attribute-read-only`, while a names-only update returned 204.
The realm bootstrap now explicitly reconciles username editing. The client reads
the bound provider subject before writing, rejects conflicting owner attributes,
preserves verification for an unchanged email, and records allowlisted field error
codes. Legacy bound accounts without an owner attribute remain compatible.

The UI polls only while a lifecycle operation is pending, shows profile updates
as updates, refreshes shell identity after saving, and offers an existing-command
retry for failed profile synchronization.

## Browser branding and verification

Application and Keycloak pages use `Axis Lufian` and byte-identical copies of the
production transparent mark. The existing GitHub provider login proof now checks
the rendered title and served original icon for every login. No separate manual
proof or deployment is part of this slice.

Verification is targeted locally by owner instruction, even though the advisory
selector selects full release. Required GitHub release/image proofs remain
mandatory. Relevant backend auth/Store tests, native disposable PostgreSQL name,
ranking, financial/export and visit-mail checks, and browser checks cover this
slice. Self-review must be GO before commit/push/PR.
