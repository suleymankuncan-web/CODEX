# Admin And Region Manager Controlled Pilot Preflight - 2026-06-23

## Reader And Action

Reader: pilot moderator, owner, support engineer, or future agent checking
whether the current staging admin and region-manager pilot accounts can be used
for the next controlled pilot session.

Post-read action: continue the scoped pilot only for the surfaces covered here,
or run the missing store-manager/personnel persona proof before claiming those
roles.

This evidence does not approve broad production rollout.

## Scope

Environment:

- Frontend: `https://staging.hr-axis.com`
- Backend API: `https://api-staging.hr-axis.com/api`
- Local code reference: `aa82da0e fix: clean pilot preflight shell hygiene (#786)`
- Evidence time: `2026-06-22T21:32:13Z` to `2026-06-22T21:39:19Z`
- Local date: `2026-06-23`
- Personas checked: admin pilot account and region-manager pilot account

The run used local `.env.local` persona entries. Passwords, one-time codes,
bearer tokens, provider tokens, cookie values, provider subjects, raw browser
storage, private user ids, and private personal data were excluded from output
and from this note.

## Decision

Status: Conditional Go for the next admin + region-manager controlled pilot
walkthrough.

Reason:

- admin and region-manager sign-in passed through the staging browser flow;
- both sessions returned the expected role;
- tested admin and Store routes returned `200`;
- no tested route fell back to login;
- no tested route showed `Cannot GET`, visible fetch failure, API `5xx`, or
  page runtime error;
- region-manager Store routes had no page-level horizontal overflow at
  desktop `1440x1000` or mobile `390x844`;
- cookie-session security smoke passed for the region-manager persona.

Condition:

- store-manager and store-personnel live proof was not rerun in this pass
  because this local `.env.local` contained admin and region-manager pilot
  entries only.

## Persona Evidence

| Persona | Expected role | Authenticated | Scope summary | Result |
| --- | --- | --- | --- | --- |
| Admin pilot | `SUPER_ADMIN` | yes | company scope `1`, assigned action stores `0` | pass |
| Region manager pilot | `REGION_MANAGER` | yes | company scope `1`, region scope `1`, assigned action stores `30` | pass |

## Admin Route Proof

| Route | HTTP | Final path | Result |
| --- | --- | --- | --- |
| `/admin/operations` | `200` | `/admin/operations` | pass |
| `/admin/integrations` | `200` | `/admin/integrations` | pass |
| `/admin/master-data` | `200` | `/admin/master-data` | pass |
| `/admin/targets` | `200` | `/admin/targets` | pass |
| `/admin/incentives` | `200` | `/admin/incentives` | pass |
| `/store/home` | `200` | `/store/home` | pass |

Observed admin Store shell label: `Admin görünümü`.

## Region Manager Store Route Proof

| Route | Desktop result | Mobile result | Notes |
| --- | --- | --- | --- |
| `/store/home` | pass | pass | no overflow, no API `5xx` |
| `/store/rankings` | pass | pass | no overflow, no API `5xx` |
| `/store/kpis` | pass | pass | no overflow, no API `5xx` |
| `/store/checklists` | pass | pass | no overflow, no API `5xx` |
| `/store/targets` | pass | pass | no overflow, no API `5xx` |
| `/store/incentives` | pass | pass | no overflow, no API `5xx` |
| `/store/workforce` | pass | pass | no overflow, no API `5xx` |
| `/store/tasks` | pass | pass | no overflow, no API `5xx` |
| `/store/reports` | pass | pass | no overflow, no API `5xx` |
| `/store/settings` | pass | pass | no overflow, no API `5xx` |

Observed region-manager Store shell label: `Bölge müdürü`.

## Cookie And Storage Proof

The existing staging cookie-session smoke was rerun for the region-manager
persona and returned:

- browser-session create status: `201`;
- browser-session clear status: `200`;
- no-bearer status: `401`;
- session endpoint status: `200`;
- role: `REGION_MANAGER`;
- assigned store count: `30`;
- session transport: `cookie`;
- app bearer token stored in browser storage: no;
- provider id token stored in browser storage: no;
- token-shaped storage keys: none;
- CSRF nonce present: yes;
- unsafe request without CSRF header: `403`;
- browser session cookie after logout: absent.

Cookie attributes:

- `HttpOnly`: yes;
- `Secure`: yes;
- `SameSite`: `Lax`;
- host-only: yes.

## Limits

- This pass did not mutate staging data.
- This pass did not upload import files.
- This pass did not close incentive periods, approve targets, or submit
  checklist results.
- This pass did not rerun the full six-persona matrix from
  `2026-06-12-all-pilot-persona-cookie-session-rehearsal.md`.
- This pass does not prove broad production readiness.

## Next Action

Proceed with a moderated admin + region-manager controlled pilot walkthrough.
Before claiming full pilot coverage, add store-manager and store-personnel
credential entries or run the six-persona evidence runbook again.
