# Live Protected API Smoke

Date: 6 Mayis 2026

Scope: Post-merge controlled staging smoke for protected pilot API paths after PR #12 was merged into `main`.

Environment:

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`
- Auth provider: Clerk
- Git merge commit under validation: `67ee1b59`

Sensitive material policy:

- Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, and Clerk `user_` ids are not recorded.
- Browser-console smoke used the signed-in Clerk session and printed only sanitized token metadata plus endpoint status.
- The smoke did not write data; it only performed protected `GET` checks.

## Evidence Method

The operator was already signed in at `https://staging.hr-axis.com`.

The browser console obtained a fresh Clerk JWT with:

```js
window.Clerk.session.getToken({
  template: 'hr-axis-api',
  skipCache: true,
})
```

The script then called protected staging API endpoints with:

```text
Authorization: Bearer <redacted>
Accept: application/json
```

Recorded sanitized token metadata:

- Audience: `hr-axis-api`
- Clerk session present: `true`
- Seconds remaining at smoke print: `56`

## Protected Endpoint Results

| Label | Path | Status | Result |
| --- | --- | ---: | --- |
| Auth session | `/auth/session` | `200` | pass |
| Migrations | `/admin/migrations/status` | `200` | pass |
| Integrations overview | `/integrations/import-batches/overview` | `200` | pass |
| Integrations queue | `/integrations/import-batches/needs-action?limit=1&offset=0` | `200` | pass |
| Master data | `/integrations/master-data-bootstrap/batches?limit=1&offset=0` | `200` | pass |
| Targets requests | `/target-distributions/requests` | `200` | pass |
| Targets coverage | `/target-distributions/coverage?requestMonth=2026-05-01` | `200` | pass |
| Store me | `/reports/my-performance?mode=live` | `200` | pass |
| Store rankings | `/reports/rankings?periodType=monthly&limit=100&offset=0` | `200` | pass |
| Store KPI highlights | `/reports/store-kpi-highlights?periodType=monthly` | `200` | pass |
| Store approvals targets | `/target-distributions/requests` | `200` | pass |
| Store approvals seller | `/workforce/seller-code-requests?status=rejected` | `200` | pass |
| Store approvals offboarding | `/workforce/offboarding-requests?status=rejected` | `200` | pass |
| Store employees | `/workforce/store-employees?storeId=<resolved-session-store-id>` | `200` | pass |

## Corrected Endpoint Note

An initial manual check called:

```text
/reports/store-kpi-highlights?mode=live
```

That returned `400` because the store KPI highlights API does not accept `mode=live`.

The application uses the monthly query shape:

```text
/reports/store-kpi-highlights?periodType=monthly
```

The corrected endpoint returned `200 true` and is the accepted smoke evidence.

## Interpretation

- The signed-in Clerk staging browser session can mint a valid `hr-axis-api` token.
- The staging API accepts the token on protected pilot paths.
- Admin integrations, master-data, migrations, targets, store performance, rankings, KPI highlights, approvals, and store personnel lookup paths all returned `200`.
- This evidence complements the page-level role smoke and ranking privacy evidence; it is an API smoke, not a screenshot or visual UI acceptance pass.

## Blockers

- None found for protected API smoke.

## Remaining Limits

- This does not approve broad production rollout.
- This does not prove write/mutation flows beyond previously documented scoped action smoke.
- This does not replace the future final master-data source or JSON/API ingestion work.
- Page-level visual quality remains out of scope for this evidence.

## Outcome

Status: Go for post-merge protected staging API smoke.

The controlled pilot has fresh sanitized evidence that the promoted staging frontend can obtain a Clerk JWT and the staging API accepts it across the protected pilot read paths.
