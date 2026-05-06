# Controlled Pilot Operating Checklist V1

## Purpose

This checklist turns the current controlled pilot evidence into an operating routine for inviting pilot users, monitoring pilot behavior, collecting feedback, and deciding whether to continue, pause, or roll back.

Decision source:

- `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md`

Active operating record:

- `docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-feedback-log.md`

Auth session edge guard:

- `docs/plans/staging-auth-session-edge-evidence-guard-v1.md`

Controlled staging/internal pilot: `Conditional Go`.

Broad production rollout: `No-Go`.

This checklist does not approve broad production rollout. It only governs the controlled staging/internal pilot that is already evidence-backed by the current consolidation note.

## Boundaries

Allowed:

- invite only the approved pilot users and roles,
- use the backend API as the access boundary,
- collect sanitized evidence and feedback,
- run support smoke after deploys,
- pause the pilot if a No-Go trigger appears.

Not allowed:

- widen the pilot to public or broad production usage,
- reopen, plan, or staff JSON/API source adapter work while Power BI/Excel remains the chosen operating source,
- use KPI import rows as unreviewed master-data creation,
- give direct Supabase client access to `ops.*`,
- manually edit live `ops.*` data to make pilot evidence look clean,
- record secrets or private personal data in evidence.

## Before Inviting Pilot Users

Confirm the decision packet:

- Current decision note is reviewed: `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md`.
- Controlled staging/internal pilot remains `Conditional Go`.
- Broad production rollout remains `No-Go`.
- Pilot participants understand that March 2026 Power BI data is historical validation data.
- Pilot participants understand that current master data is an accepted temporary pilot baseline.

Confirm pilot roster:

| Persona | Required before invite | Included surfaces |
| --- | --- | --- |
| Super admin | Clerk pilot account, app DB role assignment, support owner named | `/admin/integrations`, `/admin/master-data`, `/admin/targets`, `/store/rankings` |
| Region manager | Clerk pilot account, app DB role assignment, approved region/store scope | `/admin/targets`, `/admin/competitions`, `/store/rankings` |
| Store manager | Clerk pilot account, app DB role assignment, action-store assignment for the pilot store | `/store`, `/store/me`, `/store/kpis`, `/store/approvals`, `/store/rankings` |
| Store personnel | Clerk pilot account, app DB role assignment, own employee binding | `/store`, `/store/me`, `/store/rankings` |

Confirm support setup:

- One admin pilot account is available for support checks.
- One low-role pilot account is available for privacy checks.
- The pilot store list is explicit.
- The pilot user list is explicit.
- A feedback owner is named.
- A decision owner is named.
- The latest merged commit hash is recorded in the pilot note or support log.

Confirm local/release confidence:

```powershell
npm.cmd run check:pilot-stabilization
```

Run this before a new invitation wave, after a runtime deploy, or after any change that can affect pilot routes.

## During Pilot

Monitor the core pilot routes:

- `/store`
- `/store/me`
- `/store/kpis`
- `/store/approvals`
- `/store/rankings`
- `/admin/integrations`
- `/admin/master-data`
- `/admin/targets`

Daily operator check:

- Can each included persona sign in?
- Does the user land on the expected shell?
- Do protected routes avoid falling through `/auth/login` after refresh?
- Does the store manager see only the approved assigned-store operational scope?
- Does store personnel see own detail on `/store/me` without other personnel KPI details?
- Do global rankings stay summary-only for low-role users?
- Do admin/import/master-data pages show evidence states without manual DB intervention?

After every deploy that can affect pilot behavior:

- run the affected local guard or smoke,
- hard refresh the staging route,
- check one admin route and one store route,
- record only sanitized evidence,
- keep the pilot paused if auth, privacy, import, or master-data evidence becomes unclear.

## Feedback Intake

Capture feedback in a small structured note. One feedback item should contain:

- date,
- persona,
- route or workflow,
- observed behavior,
- expected behavior,
- severity: `blocker`, `high`, `medium`, `low`,
- decision impact: `continue`, `conditional`, `pause`, `rollback`,
- sanitized screenshot or evidence reference if available,
- owner,
- follow-up decision.

Feedback rules:

- Do not paste raw tokens, Clerk cookies, passwords, provider subjects, full JWTs, database secrets, TC/national-id values, or private user data.
- Do not treat UI polish feedback as a pilot blocker unless it prevents the operator workflow.
- Do not change score math to make feedback look better.
- Do not broaden access scope to make a demo easier.
- Separate product feedback from data-quality feedback.

## Pause / Rollback Triggers

Pause the pilot if a low-role user can see global metric details outside allowed scope.

Pause the pilot if a user can act on an unassigned store.

Pause the pilot if protected routes resume visible login/refresh flash behavior.

Pause the pilot if Power BI import creates or silently maps unreviewed stores/personnel.

Pause the pilot if March 2026 KPI actuals attach to demo stores.

Pause the pilot if admin/master-data evidence no longer explains staged, promoted, imported, or derived data clearly.

Pause the pilot if raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, database secrets, TC/national-id values, or private user data are recorded.

Pause the pilot if direct Supabase client access to `ops.*` is introduced without RLS/policy work.

JSON source integration is suspended for the current pilot and Power BI/Excel operating path.

Do not plan or staff JSON implementation work while Power BI/Excel outputs remain the chosen operating source.

Direct Supabase client access to `ops.*` remains blocked until RLS/policy work is designed.

Rollback or pause decision must record:

- triggering route or workflow,
- affected persona,
- first observed time,
- last known good commit or deploy,
- sanitized evidence reference,
- owner,
- next action.

## Pilot Exit Decision

At the end of the controlled pilot window, record one of these outcomes:

- `Go`: pilot path works for the approved scope and remaining limits are outside the next rollout path.
- `Conditional Go`: pilot can continue with explicit restrictions, owners, and follow-up dates.
- `Pause`: a blocker exists, but the current scope can resume after a focused fix.
- `No-Go`: auth, privacy, data integrity, or evidence trust failed in a way that blocks the pilot path.

Exit review checklist:

- Which personas completed their intended flow?
- Which routes were used successfully?
- Which feedback items are blockers?
- Which feedback items are polish or future depth?
- Did any No-Go trigger appear?
- Is broad production still blocked?
- Are JSON/API source adapter work and direct Supabase client access still closed?
- Is the next rollout scope smaller, same, or wider?

## Evidence Safety

Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, database secrets, TC/national-id values, and private user data must not be recorded.

Evidence may include:

- route names,
- sanitized status codes,
- aggregate counts,
- batch ids,
- commit hashes,
- deployment ids,
- non-personal test-mode emails,
- screenshots only after checking they contain no secrets or private data.

## Outcome

Use this checklist before inviting pilot users, during each pilot support pass, and when deciding whether the pilot continues. It keeps the project in controlled pilot mode without quietly drifting into broad rollout, speculative source-adapter work, or unsafe data access.
