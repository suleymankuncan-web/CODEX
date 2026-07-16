# Store Command Canvas controlled-pilot read gate

Date: 2026-07-16
Environment: protected staging
Decision: `BLOCKED_EXTERNAL_RUNTIME_NOT_CURRENT`

## Sanitized proof

The repository smoke authenticated the configured Region Manager persona with
the protected browser-cookie session and proved:

- authentication status `200` and exactly one company scope;
- `REGION_MANAGER` was the resolved application role;
- 30 assigned stores were present in the session projection;
- the app cookie was HttpOnly, Secure and host-only;
- no bearer or provider token was stored by the application;
- no mutation request was emitted while opening either Store route;
- neither route overflowed the 390 px viewport;
- logout cleared the application cookie.

`AUTH_SMOKE_PRODUCT_READ_ONLY=1` was used. The negative CSRF POST probe was
explicitly skipped, so this run performed no product mutation.

## Failing runtime gate

The exact workspace reads required by the approved plan are not present on the
current staging API runtime:

| Read contract | Unauthenticated route-presence probe | Authenticated smoke |
|---|---:|---:|
| `/api/store/incentives/workspace` | `404` | `404` |
| `/api/store/targets/workspace` | `404` | `404` |

The Region Manager route therefore cannot supply a successful period
projection or the accepted Command Canvas heading from real staging data.
This receipt is not a parity PASS and must not be used as one.

## Required external transition

Deploy a staging API artifact containing the already-merged Incentives and
Targets workspace read contracts, without changing data or configuration.
Then rerun the same read-only smoke for Region Manager, Report Viewer and Store
Manager Targets. Provider deployment is outside this plan's authorization;
PR 7 must remain unmerged until the controlled-pilot gate passes.

Credentials, subject identifiers, cookie values, business payloads and raw
workspace records are intentionally excluded.
