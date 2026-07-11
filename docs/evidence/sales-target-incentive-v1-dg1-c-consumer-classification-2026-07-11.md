# DG1-C Incentive Consumer Classification - 2026-07-11

Status: `blocked_external`
Shelf: evidence
Evidence class: docs_decision
Decision: `no_runtime_change` until a sanitized provider access window is
owner-approved and recorded
Assessed at: 2026-07-11 (Europe/Istanbul)
Source head: `91d5858d` (`main`, PR #944 squash merge)

## Purpose

DG1-C must close Store-team incentive access without silently breaking an
unknown client. This record inventories the two Store GET contracts before any
backend removal:

- `GET /api/store/incentives` (store projection and Region Manager command
  surface); and
- `GET /api/store/me/incentives` (Store Personnel own projection).

The inventory is repository-, generated-flow-, and OpenAPI-backed. It is not a
claim about live request volume. No provider dashboard access or sanitized
access-count window was supplied for this assessment, so endpoint retirement is
intentionally blocked.

## Locked policy

The DG1-DG2 plan says:

- Store Manager, Store Personnel, and Report Viewer cannot access the ordinary
  Store incentive route or projection;
- Region Manager keeps the existing scoped read and command flow;
- the existing Super Admin emergency bypass remains unchanged; and
- the own-incentive endpoint may be retired only after repository/frontend/
  external consumer classification. Unknown or active external use requires a
  compatibility decision packet, not a silent breaking change.

The frontend part of the policy is already present on `main`: the Store route
registry exposes `/store/incentives` to `REGION_MANAGER` only, and the Store
Manager/Store Personnel route guards deny direct navigation before a protected
query. This record does not widen or remove that frontend boundary.

## Static repository call graph

### `GET /api/store/me/incentives`

| Layer | Evidence | Classification |
| --- | --- | --- |
| Controller | `backend/nestjs/src/modules/store-ops/web/store-sales-target-incentive.controller.ts:22`, `getOwnIncentiveProjection` | Live backend contract; `STORE_PERSONNEL` role; `authenticated` scope. |
| Application | `backend/nestjs/src/modules/store-ops/application/sales-target-incentive-api.service.ts:139`, `getOwnStoreMeProjection` | Builds a current projection, filters to the actor employee, and returns `roleScope: "own"`. |
| Frontend API helper | `admin-web/src/features/incentives/api.ts:263`, `getMySalesTargetIncentives` | Exported OpenAPI client helper; static reference only. No production import/call site was found. |
| Frontend card | `admin-web/src/pages/store-incentives-widgets.tsx:37`, `StoreMeIncentiveCard` | Component definition remains, but repository search found no production import/mount. It is not evidence of live browser usage. |
| Self-performance page | `admin-web/src/pages/StoreMyPerformancePage.tsx` | Uses reports/KPI APIs and contains no call to `getMySalesTargetIncentives`; non-incentive self-performance remains separate. |
| Generated contracts | `docs/api/openapi.json:4618`, `admin-web/src/generated/openapi-types.ts:3904` | Generated contract still exposes the endpoint and must not be removed before the usage gate clears. |
| Tests | `backend/nestjs/test/integration/sales-target-incentive-read-api.e2e-spec.ts:410`; controller/application specs | Test-only consumers prove the current contract and scope behavior; they are not live client counts. |

**Static result:** no mounted first-party production UI consumer was found;
the endpoint still has a backend route, generated contract, API helper, and
test consumers. An external client cannot be ruled out from repository evidence.

### `GET /api/store/incentives`

| Layer | Evidence | Classification |
| --- | --- | --- |
| Controller | `backend/nestjs/src/modules/store-ops/web/store-sales-target-incentive.controller.ts:35`, `getStoreIncentiveProjection` | Live backend contract; `STORE_MANAGER` and `REGION_MANAGER` role metadata is still the compatibility state in this branch. |
| Application | `backend/nestjs/src/modules/store-ops/application/sales-target-incentive-api.service.ts:175`, `getStoreProjection` | Uses assigned stores for Store Manager and assigned stores for Region Manager; returns `roleScope: "store"` or `"region"`. |
| Frontend route | `admin-web/src/app/store-route-registry.ts:353` and `:366` | `/store/incentives` is exposed only to `REGION_MANAGER` on `main`; Store Manager route/nav hiding can proceed independently of backend retirement. |
| Frontend query | `admin-web/src/pages/StoreIncentivesPage.tsx:113` | Mounted Region Manager/Store Incentives page calls `getStoreSalesTargetIncentives`; this is a confirmed first-party browser consumer. |
| Prefetch | `admin-web/src/app/route-data-preloaders.ts:207` | Route prefetch calls the same helper only when `canOpenStoreIncentives` is true. |
| Commands | `admin-web/src/pages/StoreIncentivesPage.tsx` and `store-incentives-region-manager-*` | Region Manager review, correction, void, and submission commands remain POST contracts and are outside Report Viewer/store-team scope. |
| Generated contracts | `docs/api/openapi.json:4639`, `admin-web/src/generated/openapi-types.ts:3915` | Generated read contract remains active; no removal is authorized in this classification slice. |
| Tests | `admin-web/e2e/store-incentives-contracts.spec.ts`, `store-incentives-projection.spec.ts`, `store-manager-persona.spec.ts`, `backend/nestjs/test/integration/sales-target-incentive-read-api.e2e-spec.ts:437` | Region Manager positive/read-command tests and Store Manager negative tests cover the first-party contract. |

**Static result:** Region Manager is a confirmed first-party consumer. Store
Manager remains a backend compatibility role until the breaking removal is
explicitly cleared; no Report Viewer consumer is permitted.

## Generated system-flow and OpenAPI evidence

Generated artifact: `docs/flows/store-ops-system-flow.json` at source head
`91d5858d`.

- Summary: 192 backend endpoints, 156 frontend API calls, 54 frontend routes,
  228 route-to-API edges, 0 unmatched frontend calls, and 0 unresolved
  frontend calls.
- `api:63` maps `GET /api/store/me/incentives` to the exported helper
  `getMySalesTargetIncentives` at `admin-web/src/features/incentives/api.ts:265`.
- `api:64` maps `GET /api/store/incentives` to the exported helper
  `getStoreSalesTargetIncentives` at `admin-web/src/features/incentives/api.ts:273`.
- Both endpoint records are OpenAPI-covered and point to the same Nest
  controller. The graph records exported API helpers; it does not measure
  runtime request volume or prove that an exported helper is mounted.

The corresponding generated OpenAPI paths remain in `docs/api/openapi.json`
and `admin-web/src/generated/openapi-types.ts`. Removing either path before
the usage gate closes would break generated clients even if the first-party
own-incentive helper currently has no mounted call site.

## Live provider usage window

Required evidence is missing. Repository search cannot observe Render API
access logs, Vercel/browser traffic, partner integrations, scheduled jobs, or
other external clients. Do not convert the static “no mounted first-party own
consumer found” result into a zero-usage claim.

The owner/operator must provide one sanitized window for each endpoint:

| Required field | Allowed value |
| --- | --- |
| Window | Start/end timestamp with timezone; preferably a recent pilot window plus a short lookback. |
| Endpoint | Exact GET path and method. |
| Count | Total request count and status-class counts (2xx/3xx/4xx/5xx). |
| Client class | First-party browser, scheduled/internal, partner, or unknown; no identity/PII. |
| Role class | Store Personnel, Store Manager, Region Manager, Super Admin, or unknown; aggregated only. |
| Evidence reference | Sanitized provider dashboard/export URL or stable receipt ID; never a token, cookie, IP list, or raw payload. |
| Owner sign-off | Name/role and Istanbul timestamp confirming the window is complete and sanitized. |

If provider access cannot distinguish client classes or the result is non-zero
and external/unknown, classify the endpoint as `active_external_or_unknown` and
keep the compatibility contract. If the owner-approved window is zero or
first-party-only and no scheduled/partner client exists, a later DG1-C runtime
PR may remove the own endpoint and Store Manager read together with controller,
service, OpenAPI, generated types, helper, tests, and operating truth.

## Decision and stop condition

Current decision: `blocked_external`, `no_runtime_change`.

Do not remove:

- either controller route;
- `getOwnStoreMeProjection` or its read-model path;
- `getMySalesTargetIncentives` or the generated OpenAPI/type entries;
- Store Manager compatibility metadata on `GET /api/store/incentives`; or
- the Region Manager read/command path and Super Admin emergency bypass.

The frontend can remain hidden for Store Manager/Store Personnel while this
compatibility hold is active. The absence of a mounted own-incentive card is a
safe presentation fact, not live usage proof.

## Unblock sequence

1. Owner supplies the sanitized provider usage window above.
2. Record role/client classes and classify each endpoint as
   `first_party_only`, `active_external_or_unknown`, or `zero_observed`.
3. If external/unknown, publish the compatibility decision and keep the
   endpoint; do not silently break the client.
4. If removal is cleared, open one bounded DG1-C runtime PR. It must preserve
   non-incentive `/store/me` performance, Region Manager scope/commands, and
   the Super Admin bypass while retiring all own-endpoint contract artifacts
   together.
5. Re-run the incentive persona, backend scope, OpenAPI, authorization truth,
   lint/build, and canonical release gates before closeout merge.

## Verification of this record

- `git diff --check`
- repository `rg` call-graph inventory above
- `docs/flows/store-ops-system-flow.json` summary and endpoint records
- `docs/api/openapi.json` and generated frontend types

This record contains no credentials, raw provider payloads, user identities,
IP addresses, cookies, or other private evidence.
