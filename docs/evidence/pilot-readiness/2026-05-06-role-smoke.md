# Pilot Role Smoke Evidence

Date: 6 Mayis 2026

Environment:

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`
- Auth provider: Clerk
- Clerk test sign-in code: `424242`
- Bound store: Bursa Marka Park Avm
- Binding method: staging admin session calling HR Axis auth admin endpoints

Sensitive material policy:

- Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, and Clerk `user_` ids are not recorded.
- Test emails are recorded because they are non-personal pilot accounts created only for controlled staging smoke.

## Pilot Users

| Persona | Email | Expected Roles | Expected Landing | Scope Summary | Smoke Status |
| --- | --- | --- | --- | --- | --- |
| Super admin | `pilot.admin+clerk_test@example.com` | `SUPER_ADMIN` | `/admin/integrations` | Company scope | Pass |
| Region manager | `pilot.bm+clerk_test@example.com` | `REGION_MANAGER` | `/admin/targets` | Region scope plus Bursa Marka Park action store | Pass |
| Store manager | `pilot.sm+clerk_test@example.com` | `STORE_MANAGER` | `/store` | Bursa Marka Park store scope and action store | Pass |
| Store personnel | `pilot.personel+clerk_test@example.com` | `STORE_PERSONNEL` | `/store` | Bursa Marka Park store scope | Pass |

## Binding Notes

- Store manager employee selected during binding: Ugur Korkmaz.
- Store personnel employee selected during binding: Ayben Oguz.
- The binding script created:
  - admin role assignment
  - region manager role assignment
  - region manager action-store assignment
  - store manager role assignment
  - store manager action-store assignment
  - store personnel role assignment
- No duplicate binding conflict was reported during the successful run.

## Manual Route Smoke

### Super Admin

Result: Pass.

Observed:

- `/admin/integrations` opens.
- `/admin/auth` opens.
- `/admin/master-data` opens.
- `/admin/targets` opens.
- `/store/rankings` opens.

Interpretation:

- The pilot admin can reach admin/operator surfaces and store ranking validation routes.

### Region Manager

Result: Pass.

Observed:

- `/store/rankings` opens.
- `/admin/targets` opens.
- `/admin/competitions` opens.
- `/admin/auth` is not available as expected.
- `/admin/master-data` is not available as expected.
- `/admin/integrations` is not available as expected.

Interpretation:

- Region manager access is limited away from auth, master-data, and integration admin surfaces while preserving region/target/ranking validation access.

### Store Manager

Result: Pass.

Observed:

- `/store` opens.
- `/store/me` opens.
- `/store/kpis` opens.
- `/store/approvals` opens.
- `/store/rankings` opens.
- Store manager can see own managed-store personnel ranking/details as expected.

Interpretation:

- Store manager can use the intended store shell and assigned-store operational surfaces.

### Store Personnel

Result: Pass.

Observed:

- `/store/me` opens.
- `/store/rankings` opens.
- Other personnel KPI details are not visible.
- The user's own detailed performance is available through `/store/me`.

Interpretation:

- Store personnel visibility is privacy-preserving: own performance details live on `/store/me`, while ranking exposure does not reveal other personnel KPI details.

## Blockers

- None found.

## Remaining Limits

- This is manual browser evidence from staging, not an automated live smoke run.
- Clerk test-mode accounts are valid for controlled staging smoke; they are not real pilot user inboxes.
- The evidence does not approve broad production rollout. It only closes the controlled pilot role smoke requirement for these four personas.

## Outcome

Status: Go for controlled role smoke.

The four pilot personas can authenticate through Clerk test accounts and resolve to the expected HR Axis app roles/scopes in staging. Store personnel privacy behavior was manually verified and closes the earlier role-smoke gap for this controlled pilot set.
