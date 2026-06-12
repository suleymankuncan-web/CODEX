# All Pilot Persona Cookie-Session Rehearsal - 2026-06-12

## Reader And Action

Reader: pilot moderator, support engineer, QA operator, or future agent
checking whether the current staging persona set can still be used for the
controlled pilot.

Post-read action: decide whether the pilot can continue to assisted feedback
collection, or whether a targeted auth/route PR is needed before the next
pilot session.

## Scope

Environment:

- Frontend: `https://staging.hr-axis.com`
- Backend API: `https://api-staging.hr-axis.com/api`
- Evidence time: `2026-06-12T09:29:25.035Z`
- Persona set: `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER`, `STORE_MANAGER`,
  `STORE_PERSONNEL`, `REPORT_VIEWER`

This pass used the active staging-only pilot accounts through the browser login
flow. The same locally supplied password and one-time code were used as inputs,
but neither value was printed or recorded.

This evidence does not create, update, close, cancel, or otherwise mutate Store
Action plans. It is route, session, cookie-session, navigation, and read-only
command-surface evidence only.

## Security Handling

- Raw passwords, one-time codes, bearer tokens, provider tokens, cookies,
  provider subjects, private IDs, and raw browser storage values were not
  recorded.
- The runner checked that app bearer/provider tokens were not persisted in
  browser storage.
- The app browser session cookie was checked for `HttpOnly`, `Secure`,
  `SameSite=Lax`, and host-only domain behavior.
- Logout was checked for each persona and the browser-session cookie was absent
  after logout.

## Result

Decision: controlled staging/internal pilot can continue.

Status: passed for all six active pilot personas.

No new code PR is required from this rehearsal.

| Persona | Landing | Session role | Scope summary | Positive route proof | Negative route proof | Backend boundary |
| --- | --- | --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | `/admin/integrations` | `SUPER_ADMIN` | company `1`, region `0`, store `0`, assigned action stores `0` | `/admin/integrations`, `/admin/auth`, `/admin/session`, `/store/tasks`, `/store/rankings` | n/a | `GET /auth/users?limit=1` returned `200` |
| `HR_ADMIN` | `/admin/competitions` | `HR_ADMIN` | company `1`, region `0`, store `0`, assigned action stores `0` | `/admin/competitions`, `/admin/master-data`, `/admin/checklists`, `/admin/feed` | `/admin/auth`, `/admin/integrations`, `/admin/reports` | `GET /auth/users?limit=1` returned `403` |
| `REGION_MANAGER` | `/store/home` | `REGION_MANAGER` | company `1`, region `1`, store `0`, assigned action stores `3` | `/admin/targets`, `/admin/competitions`, `/admin/feed`, `/admin/session`, `/store/rankings` | `/admin/auth`, `/admin/master-data`, `/admin/integrations`, `/admin/operations`, `/admin/pilot-feedback` | `GET /auth/users?limit=1` returned `403` |
| `STORE_MANAGER` | `/store/home` | `STORE_MANAGER` | company `1`, region `1`, store `1`, assigned action stores `1` | `/store`, `/store/me`, `/store/tasks`, `/store/approvals`, `/store/kpis`, `/store/rankings` | `/admin/auth`, `/admin/integrations`, `/admin/master-data` | `GET /auth/users?limit=1` returned `403` |
| `STORE_PERSONNEL` | `/store/me` | `STORE_PERSONNEL` | company `1`, region `1`, store `1`, assigned action stores `1` | `/store`, `/store/me`, `/store/rankings` | `/admin/auth`, `/admin/targets`, `/store/approvals`, `/store/checklists`, `/store/tasks` | `GET /auth/users?limit=1` returned `403` |
| `REPORT_VIEWER` | `/admin/reports` | `REPORT_VIEWER` | company `1`, region `0`, store `0`, assigned action stores `0` | `/admin/reports`, `/admin/targets`, `/admin/inbox`, `/store/tasks` | `/admin/auth`, `/admin/master-data`, `/admin/integrations` | `GET /auth/users?limit=1` returned `403` |

## Cookie And Storage Proof

For every persona:

- browser-session create returned `201`;
- `GET /auth/session` returned authenticated with the expected role;
- app session transport was `cookie`;
- app bearer token storage was absent;
- provider ID token storage was absent;
- token-shaped browser storage values were absent;
- runtime CSRF nonce was present;
- `hr_axis_browser_session` was `HttpOnly`, `Secure`, `SameSite=Lax`, and
  host-only on the staging API domain;
- logout returned `200`;
- browser-session cookie was absent after logout.

## Read-Only Command Surface

`STORE_PERSONNEL`:

- `/store/tasks` returned the forbidden route state.
- Store Action command-like controls were absent.

`REPORT_VIEWER`:

- `/store/tasks` opened as a read-only workflow surface.
- Store Action command-like controls were absent.

## Limitations

- Store Action command-mode proof was not executed.
- No staging write mutation was performed.
- This evidence does not replace production rollout approval, provider delivery
  proof, managed restore/PITR decisions, or a full production readiness review.

## Next Action

Move to assisted controlled-pilot feedback collection. Open a targeted PR only
if a real pilot session produces a P0/P1/P2 finding or if Store Action command
mutation proof is explicitly requested with an approved disposable action plan
and rollback note.
