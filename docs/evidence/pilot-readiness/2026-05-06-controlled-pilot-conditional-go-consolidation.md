# Controlled Pilot Conditional Go Consolidation

Date: 6 Mayis 2026

Environment:

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`
- DB: Supabase staging Postgres
- Auth provider: Clerk
- Authorization boundary: backend API and app DB role/scope/action-store assignments

Final decision: `Conditional Go` for controlled staging/internal pilot.

Broad production rollout: `No-Go`.

This note does not replace the detailed evidence files. It maps the existing evidence into the Pilot Readiness Gate V1 decision areas so the controlled pilot decision can be reviewed from one place.

## Sensitive Material Policy

Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, database secrets, TC/national-id values, and private user data are not recorded.

Test-mode emails may appear only when they are non-personal controlled staging pilot accounts.

## Gate Matrix

| Gate Area | Decision | Evidence | Accepted Limits |
| --- | --- | --- | --- |
| real staging IdP evidence | Conditional Go | `docs/evidence/pilot-readiness/2026-05-06-role-smoke.md`, `docs/evidence/pilot-readiness/2026-05-06-live-protected-api-smoke.md`, `docs/evidence/pilot-readiness/2026-05-05-pilot-readiness-decision.md` | Clerk test-mode pilot accounts are accepted for controlled staging smoke. Logout and expired-token evidence remain follow-up before broad rollout. |
| true store/personnel baseline evidence | Conditional Go | `docs/evidence/pilot-readiness/2026-05-06-master-data-power-bi-acceptance.md`, `docs/evidence/pilot-readiness/2026-05-05-staging-master-data-kpi-materialization.md` | Current master data is an accepted temporary pilot baseline, not the final HR/master-data source of truth. Known provisional/skipped personnel cleanup remains documented. |
| real KPI import smoke evidence | Go | `docs/evidence/pilot-readiness/2026-05-06-master-data-power-bi-acceptance.md`, `docs/evidence/pilot-readiness/2026-05-05-staging-master-data-kpi-materialization.md` | March 2026 Power BI import is historical pilot validation data, not proof of future monthly operation. JSON source integration is suspended for the current pilot and Power BI/Excel operating path. |
| pilot user and scope evidence | Go | `docs/evidence/pilot-readiness/2026-05-06-role-smoke.md`, `docs/evidence/pilot-readiness/2026-05-06-ranking-privacy-smoke.md` | The four pilot personas are accepted for controlled staging validation. Real mailbox-backed onboarding is still required before inviting real store personnel users. |
| release and migration evidence | Conditional Go | `docs/evidence/pilot-readiness/2026-05-06-ranking-privacy-smoke.md`, `docs/evidence/pilot-readiness/2026-05-06-master-data-power-bi-acceptance.md`, `docs/evidence/pilot-readiness/2026-05-06-live-protected-api-smoke.md` | `check:pilot-stabilization` evidence exists in the 6 May notes. Fresh DB smoke is required as manual preflight only when DB schema or migration files change. |

## Consolidated Evidence Inputs

- `docs/evidence/pilot-readiness/2026-05-05-pilot-readiness-decision.md`
- `docs/evidence/pilot-readiness/2026-05-06-role-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-06-ranking-privacy-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-06-master-data-power-bi-acceptance.md`
- `docs/evidence/pilot-readiness/2026-05-06-live-protected-api-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-05-staging-master-data-kpi-materialization.md`

## Accepted Pilot Restrictions

- Keep the pilot limited to explicitly created Clerk pilot users and approved stores/roles.
- Keep access through the backend API; Direct Supabase client access to `ops.*` remains blocked until RLS/policy work is designed.
- Treat current master data as an accepted temporary pilot baseline.
- Treat March 2026 Power BI import as historical validation evidence only.
- JSON source integration is suspended for the current pilot and Power BI/Excel operating path.
- Do not plan or staff JSON implementation work while Power BI/Excel outputs remain the chosen operating source.
- Keep broad production rollout closed.
- Keep UI/design polish as later work unless a concrete pilot blocker appears.

## No-Go Triggers

Stop or pause the pilot if a low-role user can see global metric details outside allowed scope.

Stop or pause the pilot if a user can act on an unassigned store.

Stop or pause the pilot if Power BI import creates or silently maps unreviewed stores/personnel.

Stop or pause the pilot if March 2026 KPI actuals attach to demo stores.

Stop or pause the pilot if protected routes resume the visible login/refresh flash.

Stop or pause the pilot if raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, database secrets, TC/national-id values, or private user data appear in evidence.

Stop or pause the pilot if direct Supabase client access is introduced without RLS/policy work.

## Next Operational Checklist

- Confirm the exact pilot invitation list and role/scope for each user.
- Keep one admin and one low-role account available for support smoke after deploys.
- Monitor `/store`, `/store/me`, `/store/kpis`, `/store/approvals`, `/store/rankings`, `/admin/integrations`, `/admin/master-data`, and `/admin/targets`.
- Add logout and expired-token evidence before broad rollout.
- Repeat role/privacy smoke before inviting real mailbox-backed store personnel users.
- Do not start JSON/source-specific adapter work while Power BI/Excel outputs remain the chosen operating source.

## Outcome

Status: `Conditional Go` for controlled staging/internal pilot.

The controlled pilot can proceed for operational validation under the restrictions above. Broad production rollout remains blocked until remaining auth session edge evidence, real-user onboarding evidence, final data-source decisions, direct database access/RLS policy decisions, UI polish, and measured production-readiness checks are complete.
