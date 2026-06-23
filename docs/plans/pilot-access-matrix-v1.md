# Pilot Access Matrix V1

Status: active
Shelf: pilot
Last verified: 2026-06-23

## Reader And Action

Reader:

- an operator, future agent, or engineer preparing staging pilot accounts,
  cleaning wrong role/scope assignments, or running persona smoke checks.

After reading, they should be able to:

- choose the correct pilot account class,
- avoid breaking protected real accounts,
- clean only temporary pilot assignments,
- run the minimum smoke checks without exposing secrets.

## Purpose

This matrix is the operating guard for staging Clerk accounts and application
role/scope assignments.

The 2026-06-23 account cleanup showed the risk: a real account can remain
active in Clerk/application auth while all active application roles are closed.
That state leaves login stuck in verification/session resolution instead of
landing in the app. Cleanup must therefore preserve protected baseline access
or intentionally deactivate the whole account with a visible owner decision.

## Account Classes

Exact real-user emails, passwords, OTPs, provider subjects, and Clerk ticket
links must stay in the approved secret channel, `.env.local`, Clerk, or the
admin console. This doc uses aliases for protected real accounts.

| Account class | Account label | Intended use | Active baseline verified on 2026-06-23 | Do not use for |
| --- | --- | --- | --- | --- |
| Protected real owner/admin | `real-admin-gmail` | Owner/admin assisted smoke when the owner can complete OTP. | Active Clerk-linked user, `SUPER_ADMIN` company role, `STORE_MANAGER` store role for Bursa Marka Park Avm, one action-store assignment for Bursa Marka Park Avm. | Temporary store-manager/personnel pilot experiments. |
| Protected real store manager | `real-sm-lufian` | Real store-manager assisted smoke when the owner can complete OTP. | Active Clerk-linked user, `STORE_MANAGER` store role for Bursa Marka Park Avm, one action-store assignment for Bursa Marka Park Avm. | Temporary company-store pilot experiments. |
| Example pilot admin | `pilot.admin+clerk_test@example.com` | Automated admin smoke and setup checks. | Active Clerk-linked user, one `SUPER_ADMIN` company role, no action-store assignment. | Store/personnel persona proof. |
| Example pilot region manager | `pilot.bm+clerk_test@example.com` or BM account from `.env.local` | Automated or assisted Region Manager smoke. | Active Clerk-linked user, one `REGION_MANAGER` region role. Current action-store scope is finite and must be checked before BM workflow smoke. | Company-wide admin proof. |
| Example pilot store manager | `pilot.sm+clerk_test@example.com` | Automated Store Manager smoke for company-store-only surfaces. | Active Clerk-linked user, one `STORE_MANAGER` store role for Alanya Akdenizpark Avm, one matching action-store assignment. | Admin, BM, or personnel-only proof. |
| Example pilot personnel | `pilot.personel+clerk_test@example.com` | Automated Store Personnel smoke for own-personnel surfaces. | Active Clerk-linked user, one `STORE_PERSONNEL` store role for Alanya Akdenizpark Avm, one matching action-store assignment. | Manager/admin proof. |

## Hard Rules

1. Do not use protected real accounts for temporary persona binding tests.
   Create or reuse staging-safe pilot aliases instead.
2. Do not bulk-close all active role assignments for a user unless the account
   itself is intentionally being deactivated and the user has approved that
   outcome.
3. An active Clerk-linked application account with `active_role_count = 0` is a
   stop condition. Resolve it before smoke by restoring a protected baseline
   role or intentionally deactivating the account.
4. Read scope and action-store scope are separate. A store role without the
   matching action-store assignment can pass navigation but fail workflow
   actions.
5. Real accounts require assisted OTP. Codex must not claim autonomous live
   browser proof for those accounts unless the owner completes the OTP in the
   same session.
6. Never paste or commit raw bearer tokens, cookies, OTPs, provider subjects,
   passwords, Clerk ticket URLs, or private personal data.

## Cleanup Procedure

Use this when wrong role/scope assignments were made during pilot setup.

1. Identify the user by safe alias or approved admin-console lookup.
2. Capture current active roles and action-store assignments before changing
   anything.
3. Classify each active assignment:
   - protected baseline,
   - intended current pilot assignment,
   - temporary wrong pilot assignment,
   - stale closed assignment.
4. Close only the temporary wrong pilot assignments.
5. Preserve protected baseline assignments unless the owner explicitly asks to
   remove the account's access.
6. Re-check the account:
   - `is_active = true`,
   - `has_provider_subject = true` for Clerk-backed accounts,
   - `active_role_count > 0`,
   - expected action-store count for store/BM workflow personas.
7. Run the matching smoke checklist below.
8. Record only sanitized evidence: account label, role code, scope type, route,
   status code, and pass/fail.

## Minimum Smoke Checklist

| Persona | Positive check | Negative/boundary check | Expected result |
| --- | --- | --- | --- |
| Example pilot admin | Admin session and admin route allowed. | Store-only or personnel-only proof must not use this account. | `SUPER_ADMIN` company scope is visible; no store-persona claim is made. |
| Example pilot BM | Region/store operational route allowed for assigned region. | Company-only admin routes remain outside BM proof unless role matrix allows them. | `REGION_MANAGER` route and scope match the selected BM account. |
| Example pilot SM | `/api/store/incentives?period=YYYY-MM` for a closed or historical period. | Personnel-only `/api/store/me/incentives?period=YYYY-MM` must not be treated as SM proof. | Store scoped data returns; company-store-only incentive surface is visible. |
| Example pilot personnel | `/api/store/me/incentives?period=YYYY-MM`. | `/api/store/incentives?period=YYYY-MM` must return forbidden. | Own-personnel data returns; manager surface is denied. |
| Protected real owner/admin | Assisted browser smoke after owner OTP. | No autonomous smoke without OTP. | Landing and role summary match the protected baseline. |
| Protected real store manager | Assisted browser smoke after owner OTP. | No autonomous smoke without OTP. | Store Manager landing and store scope match the protected baseline. |

## Current Verified Snapshot

Verified by read-only Supabase checks on 2026-06-23:

- `pilot.sm+clerk_test@example.com`: active Clerk-linked account, one active
  `STORE_MANAGER` store role for Alanya Akdenizpark Avm, one matching
  action-store assignment.
- `pilot.personel+clerk_test@example.com`: active Clerk-linked account, one
  active `STORE_PERSONNEL` store role for Alanya Akdenizpark Avm, one matching
  action-store assignment.
- `pilot.admin+clerk_test@example.com`: active Clerk-linked account, one active
  `SUPER_ADMIN` company role.
- protected real owner/admin alias: active Clerk-linked account, active
  `SUPER_ADMIN` company role plus active `STORE_MANAGER` Bursa Marka Park Avm
  role and matching action-store assignment.
- protected real store-manager alias: active Clerk-linked account, active
  `STORE_MANAGER` Bursa Marka Park Avm role and matching action-store
  assignment.

The prior temporary company-store assignments that were attached to protected
real accounts are not the baseline and must not be recreated for future smoke.

## Incident Note: 2026-06-23

Symptom:

- two protected real accounts could complete OTP but stayed on the
  "session verifying" path instead of landing in the app.

Root cause:

- cleanup removed temporary pilot assignments but also left the active real
  accounts without their required active baseline role/scope set.

Fix applied:

- restored the protected baseline role/action-store assignments for both real
  accounts,
- moved automated Store Manager and Store Personnel smoke to the example pilot
  accounts,
- verified example SM/personnel account role and action-store scope against the
  intended Alanya Akdenizpark Avm company store.

Follow-up rule:

- future cleanup must first classify protected baseline assignments and must
  stop if a Clerk-linked active account would be left with zero active roles.
