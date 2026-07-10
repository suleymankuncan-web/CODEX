# Project-Wide Audit Remediation Plan V1

Status: active
Shelf: architecture
Spec status: Draft execution plan; implementation slices remain spec-first and evidence-gated
Author: Codex
Reviewer: repository owner
Use when: implementing the 10 July 2026 Store, Admin, codebase, backend, and database audit findings
Do not use when: opening a broad refactor, changing product semantics without a decision, or claiming live production readiness
Last verified: 2026-07-10
Source of truth: live repository source, generated system-flow inventory, database DDL, current tests, and the active handoff

## 1. Reader And Post-Read Action

Reader:

- the repository owner deciding which remediation slice may start;
- the engineer implementing the first or a later remediation pull request;
- a future agent resuming the work without access to the audit conversation;
- a reviewer checking whether a proposed change stays inside the approved
  architecture, authorization, data, release, and production boundaries.

After reading, the reader must be able to:

1. distinguish confirmed findings from watch items and external blockers;
2. select the next pull request without reopening a broad code train;
3. write the required finding-specific specification and tests before code;
4. recognize the owner decisions and live evidence required before gated work;
5. verify and roll back each slice independently;
6. stop if implementation would change a protected behavior outside the
   approved finding.

## 2. Plan Landing And Pull Request Rule

This document is created before implementation and is intentionally not being
landed through a separate documentation-only pull request.

Rules:

- The document and its documentation-library entry must be included in the
  first implementation pull request in this plan.
- The first implementation pull request is PR-1, Authorization Operating Truth
  Contract.
- Creating this document does not authorize a branch push, pull request,
  merge, deployment, database migration, provider change, or runtime behavior
  change.
- No pull request or merge is part of the current documentation task.
- When PR-1 starts, its final diff must contain both the first implementation
  slice and this plan. A plan-only pull request must not be opened.
- Later pull requests must update only the execution-status register in this
  document when their state materially changes.
- Historical narration belongs in pull requests or history documents, not in
  the active plan body.

## 3. Context

The project is a mature React and NestJS modular monolith backed by PostgreSQL.
It has a generated OpenAPI contract, centralized frontend route guards,
application-level role and scope enforcement, repository boundaries, a
BullMQ/Redis worker path, audit records, reporting snapshots, and extensive
automated tests.

The architecture does not need a rewrite or a microservice split. The current
modular-monolith baseline remains the correct choice for the controlled pilot
and expected near-term scale.

The audit identified risk in consistency across the existing surface:

- frontend route permission, backend endpoint permission, documentation, and
  the Auth Admin permission preview are not always aligned;
- user-scoped frontend query data is invalidated rather than removed at an
  identity boundary;
- two target queue surfaces collect the complete request history in the
  browser;
- organization and authorization relationships rely more heavily on
  application validation than database constraints;
- a small set of active pages is not fully bilingual, timezone-safe, or
  keyboard accessible;
- generated architecture evidence does not follow all transitive API wrapper
  calls;
- database transport and external error delivery are not sufficient evidence
  for broad production.

The audit did not prove a current P0 defect. It produced four P1 findings and
eight P2 findings.

Current repository inventory used by this plan:

| Surface | Current count |
| --- | ---: |
| Frontend route patterns | 54 |
| Frontend API calls in the generated flow | 155 |
| Backend/OpenAPI endpoints | 191 |
| Route-to-API edges | 226 |
| Backend endpoints without a frontend call | 36 |
| Database tables | 81 |
| Database migrations | 59 |
| Database indexes in the canonical schema | 97 |
| Playwright E2E tests | 371 |
| Root script/contract tests | 526 |
| Frontend unit tests | 4 |

These are a dated plan baseline. Live repository evidence wins if the counts
change.

## 4. Audit Method And Evidence Boundary

The audit used:

- the active route registries and route shells;
- every Store page and every concrete Admin route component;
- frontend query keys, mutation paths, invalidation behavior, error/empty/
  loading states, localization use, and interactive semantics;
- the generated route, API, controller, and OpenAPI system-flow artifact;
- backend controller role and scope decorators;
- service, repository, transaction, audit, and observability boundaries;
- the canonical database schema and all migration files;
- current lint, unit, backend Jest, root contract, and production dependency
  audit commands.

Verified locally on 2026-07-10:

- frontend lint passed;
- backend lint passed;
- frontend unit tests passed 4 of 4;
- the full backend Jest command passed;
- root script/contract tests passed 526 of 526;
- frontend production dependency audit reported zero vulnerabilities;
- backend production dependency audit reported zero vulnerabilities;
- the worktree began clean and main matched origin/main.

Not proven by this audit:

- a complete real Clerk persona run for every route;
- real staging negative-scope evidence for the remaining B1 gaps;
- real database cardinality, query plans, index usage, lock duration, or
  constraint violations;
- deployed Lighthouse, Core Web Vitals, or automated axe results;
- external error-delivery receipt;
- provider CA/certificate behavior;
- broad-production backup, restore, Redis durability, RPO, RTO, or incident
  response.

Local source evidence must not be upgraded into one of those live claims.

## 5. Architecture Decision

### 5.1 Keep

- React web application with separate Admin and Store shells.
- NestJS modular monolith.
- PostgreSQL as the operational and reporting data source.
- Generated OpenAPI as the contract authority.
- Clerk/provider identity separated from application authorization.
- Separate read scope and assigned-store action scope.
- Repository-mediated database access.
- Audit, staging, operational, and reporting schema separation.
- BullMQ only for work that needs asynchronous durability.
- One canonical full release proof per pull request decision.

### 5.2 Improve Internally

The Store Ops module should continue to be decomposed by internal bounded
context when a finding touches it:

- checklist and visit execution;
- Store Action;
- targets;
- incentives;
- workforce;
- ranking and performance;
- reporting and snapshots.

This is internal modular-monolith decomposition. It is not permission to split
services, duplicate databases, introduce events for ordinary in-process calls,
or create a generic rules engine.

### 5.3 Do Not Start

- microservices;
- a frontend rewrite;
- a database rewrite;
- a generic authorization or rule engine;
- a broad component refactor;
- speculative indexes;
- a full legacy API-client migration;
- a separate mobile implementation;
- a new product module;
- broad production.

## 6. Severity Model

| Severity | Meaning | Required response |
| --- | --- | --- |
| P0 | Confirmed security, data loss, or core-system stop condition | Stop affected operation and fix immediately |
| P1 | Pilot blocker, authorization inconsistency, privacy risk, or unbounded core workflow | First remediation wave |
| P2 | Correctness, accessibility, maintainability, or production-readiness gap without a current stop condition | Ordered follow-up |
| P3 | Optional improvement without current evidence | Park until triggered |
| blocked_external | Requires real data, provider, credential, session, or owner decision | Record gate; do not invent local closure |

## 7. Finding Register

### F-01 — Authorization Operating Truth Drift

Severity: P1

Status: confirmed

Affected surfaces:

- Store KPI route;
- personnel performance detail route;
- Store incentives route;
- Auth Admin role/route preview;
- pilot route-role matrix and its contract guard.

Evidence:

- Store KPI allows Report Viewer in the route and page model, while its live
  endpoint does not support Report Viewer read scope.
- Personnel detail allows Report Viewer at the frontend route, while the
  original feature contract, backend endpoint, and preview catalog do not.
- Store incentives is Region Manager-only in runtime and Playwright, supports
  Store Manager in the backend and page implementation, lists Store Manager in
  the active route matrix, and lists a much broader role set in Auth Admin
  preview.
- Store Tasks preview grants more roles than runtime.
- Store Workforce is absent from Auth Admin preview.
- The route matrix guard checks a manually selected subset while claiming to
  cover every active route.

Impact:

- a visible route can terminate in a backend 403;
- an administrator can see an inaccurate permission preview;
- a later change can accidentally widen access by treating one stale artifact
  as authority;
- incentive visibility can change unintentionally because four layers encode
  different decisions.

Recommendation:

- make runtime registry and backend endpoint contracts the enforcement
  authorities;
- generate or derive the documentation/preview inventory from explicit route
  policy metadata;
- use separate policy identifiers for route presence, read scope, and action
  scope;
- keep negative backend authorization tests even when frontend visibility is
  denied;
- resolve Store incentives through an owner decision before runtime code.

Decision gate DG-1:

| Question | Option A | Option B | Recommendation |
| --- | --- | --- | --- |
| Store Manager incentive route | Keep the current Region Manager-only route and align docs/preview; retain backend compatibility until usage is classified | Open the company-store manager route and update existing hidden-state tests | Option A because current runtime and tests explicitly enforce it |
| Report Viewer Store KPI | Remove the route from Report Viewer | Keep the route and add company/read-scope backend support | Keep the route and add scoped read support because the role and route matrix are read-oriented |
| Report Viewer personnel detail | Remove the frontend entitlement | Add backend company-wide personnel profile read | Remove entitlement because the original profile contract and ranking contract exclude Report Viewer |
| Production Admin Session controls | Keep mock/header editing visible | Hide editing controls in production and keep a read-only status surface | Hide production editing controls; keep development diagnostics |

No choice in this table is implemented until the owner approves the
finding-specific specification.

### F-02 — Session-Scoped Query Cache Isolation

Severity: P1

Status: confirmed mechanism; live exposure not reproduced

Evidence:

- identity/session key changes invalidate non-shell queries;
- invalidation preserves cached data;
- many Admin query keys do not contain an identity or authorization
  fingerprint;
- normal provider logout performs a full navigation, but session renewal,
  diagnostic session switching, and same-SPA identity transitions do not have
  a universal cache-removal contract.

Impact:

- a new identity may mount a query key containing data fetched for an earlier
  identity before the replacement request completes;
- shared store or operator devices are the highest-risk context;
- permission correctness remains backend-enforced, but previously rendered
  client data may survive too long.

Recommendation:

- establish one stable authorization fingerprint;
- remove user-scoped queries before rendering a newly authorized shell;
- preserve only explicitly public/configuration-safe query families;
- test two different personas against one QueryClient instance;
- do not rely solely on full-page logout as the isolation mechanism.

### F-03 — Unbounded Target Request Collection

Severity: P1

Status: confirmed

Evidence:

- a frontend helper loads 200-row pages until it reaches the backend total;
- Store Approvals calls that helper without period, status, or store filters;
- Admin Targets calls it without filters;
- Admin target prefetch repeats the same unbounded call;
- the Admin page uses only pending items plus a small recent approved subset.

Impact:

- request count and browser memory grow with the complete historical dataset;
- route prefetch can perform the work before the user opens the page;
- performance degrades as history grows even if the visible queue remains
  small.

Recommendation:

- use server-side status and period filters;
- page the visible Store ledger;
- query pending and recent completed Admin rows separately;
- expose accurate total/count metadata;
- cap prefetch to the first useful page;
- retain scope filtering on the backend.

### F-04 — Database Organization And Authorization Integrity

Severity: P1

Status: confirmed schema gap; live data violations unknown

Evidence:

- organization tables and many business tables reference company, region, and
  store independently;
- the database does not guarantee that a region belongs to the stored company
  or a store belongs to the stored region/company combination;
- role assignments do not have a database constraint that locks the valid
  company/region/store column shape for each scope type;
- employee assignment history does not prevent overlapping active primary
  assignments;
- application services validate important paths, but the database remains
  permissive to manual, import, race, or future-code mistakes.

Impact:

- a cross-company relationship can undermine assumptions used by read-scope
  queries;
- malformed role assignments can become invisible or inconsistently
  interpreted;
- multiple active primary assignments can destabilize store ownership,
  performance, ranking, and personnel scope.

Recommendation:

- run read-only preflight queries first;
- define canonical organization composite keys;
- add additive constraints only after data is classified;
- choose an explicit temporal rule for primary assignment overlap;
- use staged validation where a production lock could be material;
- never auto-delete or rewrite inconsistent rows.

### F-05 — Incomplete Active Localization

Severity: P2

Status: confirmed

Affected surfaces:

- Store Feed;
- Store Reports;
- Admin Incentives.

Impact:

- switching to English leaves significant Turkish headings, actions, table
  labels, statuses, and errors;
- the current localization closeout claim is broader than actual active-page
  behavior.

Recommendation:

- move user-facing copy into typed namespaces;
- preserve technical codes and raw integration identifiers;
- add TR and EN route assertions;
- add a guard that rejects newly introduced raw product copy on active
  localized surfaces without trying to translate source data.

### F-06 — Europe/Istanbul Calendar Boundary

Severity: P2

Status: confirmed

Affected behaviors:

- integration default date/month;
- competition draft start/end date and generated date code;
- checklist-template default date;
- Store Approvals current month/day helpers.

Impact:

- between local midnight and 02:59 in Istanbul, UTC ISO slicing can select the
  previous calendar day or month;
- module-level date constants can remain stale after midnight in a long-lived
  tab.

Recommendation:

- use one Europe/Istanbul business-date helper;
- calculate defaults at interaction or component initialization, not module
  load;
- keep UTC timestamps for instants and local calendar strings for business
  dates;
- test month/year transitions with a fixed clock.

### F-07 — Keyboard And Automated Accessibility Coverage

Severity: P2

Status: confirmed

Evidence:

- Master Data workbench rows use click handlers on table rows without keyboard
  activation;
- the application has main landmarks but no skip-to-main link;
- existing Playwright includes isolated ARIA and Escape assertions but no
  automated axe gate.

Impact:

- keyboard-only users cannot perform the primary row selection workflow;
- repeated navigation is slower for screen-reader and keyboard users;
- future accessibility regressions have no automated baseline.

Recommendation:

- put the selection action on a native button or link inside the primary cell;
- preserve table semantics;
- add visible focus treatment and Enter/Space behavior through the native
  control;
- add a skip link;
- start one bounded axe seed on the Admin shell and Master Data route.

### F-08 — Dual API Client And Unsafe Response Typing

Severity: P2

Status: confirmed

Evidence:

- 103 frontend calls use the generated OpenAPI client;
- 51 use the legacy JSON client;
- one uses form data;
- all currently match an OpenAPI endpoint;
- at least one target approval response requires a double cast.

Impact:

- endpoint presence is guarded, but legacy response shapes have weaker compile
  time guarantees;
- generated-contract drift may be hidden by casts;
- a broad migration would create unnecessary review risk.

Recommendation:

- remove the target response cast by expressing the response contract
  correctly;
- migrate legacy calls only when a feature is touched for a real finding;
- preserve upload/form-data behavior separately;
- do not create a repository-wide migration train.

### F-09 — System-Flow Transitive Call Blind Spot

Severity: P2

Status: confirmed

Evidence:

- Store Approvals calls a wrapper that calls the target request endpoint;
- the generated route-to-API map reports workforce calls for the page but
  misses the target request edge;
- direct API calls remain correctly matched to OpenAPI.

Impact:

- fanout and ownership reports undercount wrapper-mediated calls;
- permission and bottleneck reviews can reason from an incomplete route graph.

Recommendation:

- resolve exported wrapper calls transitively inside the frontend feature
  boundary;
- prevent recursion cycles;
- keep preload registries excluded from route fanout;
- add Store Approvals as the contract fixture.

### F-10 — Database Connection And Configuration Resilience

Severity: P2 for the controlled pilot; P1 before broad production

Status: confirmed

Evidence:

- SSL encryption is enabled in production but server certificate verification
  is disabled;
- connection and statement timeout policy is not explicit;
- database pool size and daily closure polling values do not consistently use
  existing positive-number validators.

Impact:

- transport encryption does not prove server identity;
- a network or query stall can hold resources without an application-owned
  deadline;
- invalid numeric configuration can reach runtime.

Recommendation:

- support provider-backed CA verification and a verify-full mode;
- add validated connection, idle, query, and statement timeout settings;
- fail fast on invalid numeric configuration;
- preserve a provider-compatible controlled-pilot mode until CA evidence is
  available.

### F-11 — External Error Delivery Is Not Active

Severity: P2 for the controlled pilot; P1 before broad production

Status: confirmed and provider-gated

Evidence:

- exceptions are emitted as structured logs;
- the status payload always reports external delivery as not enabled;
- DSN presence alone can remove the broad-production degraded state;
- no external receipt is produced.

Impact:

- broad-production readiness could appear healthier than the real incident
  detection path;
- fatal and unhandled errors depend on log consumption rather than a verified
  error tracker.

Recommendation:

- keep controlled-pilot log-only wording honest;
- do not report enabled until a sanitized test exception is received by the
  selected provider;
- align health/readiness with actual delivery, not configuration presence.

### F-12 — Frontend Test Pyramid Concentration

Severity: P2

Status: confirmed

Evidence:

- the full E2E suite is extensive;
- frontend unit coverage is currently four tests;
- the identified cache, date, route-policy, and pure-model findings can be
  tested below E2E.

Impact:

- small logic changes often depend on the slowest verification layer;
- edge cases are more expensive to express and debug.

Recommendation:

- add unit/contract tests only with the related finding;
- keep all existing E2E coverage;
- do not begin a whole-suite migration;
- use the new tests to reduce diagnosis time, not to weaken release proof.

## 8. Functional Requirements

### Authorization Truth

- FR-01: Every concrete Admin, Store, and Auth route must be present in one
  generated or source-derived route inventory.
- FR-02: Route visibility, endpoint read permission, and action permission must
  be represented as separate concepts.
- FR-03: Auth Admin preview must not claim a route for a role when runtime
  denies that role.
- FR-04: Auth Admin preview must not omit an active route that has an operator
  decision value.
- FR-05: Direct unauthorized navigation must render product-safe forbidden
  copy before protected page data is requested.
- FR-06: Backend authorization must remain the security boundary.
- FR-07: Store incentives behavior must not change until DG-1 is resolved.
- FR-08: Any role addition to a backend endpoint must include positive and
  negative read-scope tests.

### Session Cache

- FR-09: A change in authenticated identity or effective authorization must
  remove prior user-scoped query data before the new shell renders.
- FR-10: Public bootstrap/configuration data may be preserved only through an
  explicit allowlist.
- FR-11: Logout, expiry, renewal, cookie-session replacement, and diagnostic
  session switching must use the same isolation contract.
- FR-12: Cache isolation must not create an infinite shell-session refetch loop.

### Target Queues

- FR-13: Store Approvals must request only the active filter/page from the
  server.
- FR-14: Admin Targets must request pending items and a bounded completed
  history.
- FR-15: Target prefetch must never walk the complete history.
- FR-16: Pagination metadata must remain accurate and scope-filtered.
- FR-17: Existing create and approval payload semantics must remain unchanged.

### Frontend Correctness

- FR-18: Business calendar defaults must use Europe/Istanbul.
- FR-19: Instant timestamps must remain UTC ISO timestamps.
- FR-20: Active TR/EN pages must render user-facing product copy in the
  selected locale.
- FR-21: Technical codes, source values, route paths, and identifiers must not
  be translated.
- FR-22: Master Data row selection must be keyboard operable.
- FR-23: The application shell must expose a skip-to-main action.
- FR-24: No existing E2E test may be removed solely because a unit or axe test
  is added.

### Database Integrity

- FR-25: Database preflight must be read-only and must report every detected
  invariant violation without repairing it.
- FR-26: Composite organization constraints must preserve existing canonical
  identifiers and API shapes.
- FR-27: Role-assignment scope shape must be enforced consistently in service
  validation and the database.
- FR-28: Primary assignment overlap behavior must be specified before a
  constraint is chosen.
- FR-29: A schema migration must not run against live data until preflight
  results are reviewed.
- FR-30: Migration rollback and forward-repair paths must be documented.

### Architecture And Operations

- FR-31: System-flow generation must follow safe transitive wrapper calls.
- FR-32: System-flow generation must not treat route preload imports as runtime
  route fanout.
- FR-33: Legacy API calls must migrate incrementally, not as a broad rewrite.
- FR-34: Database TLS readiness must reflect certificate verification state.
- FR-35: Numeric database and scheduler configuration must fail fast when
  invalid.
- FR-36: External error delivery must remain not enabled until receipt is
  proven.
- FR-37: Broad production must remain No-Go until its existing external gates
  and this plan's production-class findings are closed or explicitly accepted.

## 9. Non-Functional Requirements

- NFR-01 Security: No cross-identity cached data may be rendered after an
  authorization fingerprint changes.
- NFR-02 Least privilege: A read-only role must not gain write controls or
  action-store authority as a side effect of route alignment.
- NFR-03 Reliability: Target queue initial request count must be independent of
  the total historical row count.
- NFR-04 Accessibility: Primary row-selection workflows must be operable with
  keyboard alone and expose a visible focus state.
- NFR-05 Localization: TR and EN active surfaces must not mix fixed product
  language except for source data and technical values.
- NFR-06 Data integrity: New database constraints must be additive, preflighted,
  and independently reversible or forward-repairable.
- NFR-07 Performance: No index may be added from static foreign-key counts
  alone; query plans or constraint-maintenance evidence are required.
- NFR-08 Observability: Readiness status must describe actual delivery state.
- NFR-09 Compatibility: Existing API paths, payloads, scoring, ranking,
  checklist weights, incentive formulas, and queue behavior remain unchanged
  unless a finding-specific approved spec says otherwise.
- NFR-10 Reviewability: Each pull request must tell one implementation story
  and have one rollback story.
- NFR-11 Verification: Runtime pull requests use the canonical release path
  once; no duplicate full frontend release is added.
- NFR-12 Privacy: Evidence and tests must contain no raw tokens, cookies,
  private PII, database URLs, Redis URLs, or provider secrets.

## 10. Acceptance Criteria

- AC-01: Given the active route source, when the route inventory guard runs,
  every concrete Admin, Store, and Auth route appears exactly once or is
  explicitly classified as an alias.
- AC-02: Given any supported role, when preview rows are compared with runtime
  route access, no preview-only grant remains.
- AC-03: Given Report Viewer and Store KPI, when DG-1's approved behavior is
  implemented, route visibility and backend response agree and an out-of-scope
  store request remains forbidden.
- AC-04: Given Report Viewer and personnel detail, direct navigation is denied
  before the personnel endpoint is called unless the owner approves a new
  company-wide profile contract.
- AC-05: Given Store Manager and Store incentives, runtime, preview, matrix,
  tests, and backend compatibility are documented consistently with the DG-1
  decision.
- AC-06: Given cached User A Admin or Store data, when User B becomes the
  effective identity in the same application instance, User A data is never
  rendered for User B.
- AC-07: Given a token renewal for the same identity and unchanged
  authorization, cache handling does not create an infinite refetch or blank
  shell loop.
- AC-08: Given ten thousand historical target requests, opening Admin Targets
  performs only bounded pending/recent queries.
- AC-09: Given Store Approvals filters, changing period, status, store, or page
  requests only the selected server-side slice.
- AC-10: Given 2026-07-01 00:30 Europe/Istanbul, current business month is July
  and current business date is 2026-07-01.
- AC-11: Given an open tab across Istanbul midnight, a newly created draft uses
  the new local business date.
- AC-12: Given English locale, Store Feed, Store Reports, and Admin Incentives
  show English-owned product labels and error copy.
- AC-13: Given Turkish locale, the same surfaces preserve correct Turkish
  characters.
- AC-14: Given keyboard-only navigation, every Master Data workbench row can be
  selected and its detail can be reached without a pointer.
- AC-15: Given focus at the top of the application, the skip link moves focus
  to the active main landmark.
- AC-16: Given the first axe seed routes, no critical accessibility violation
  is reported.
- AC-17: Given Store Approvals in the generated flow, its current bounded
  request-center endpoint appears in the route-to-API edge set.
- AC-18: Given cyclic helper imports, system-flow generation terminates and
  does not duplicate edges.
- AC-19: Given database preflight, every cross-company organization mismatch,
  malformed role scope, and overlapping primary assignment is counted and
  referenced without mutation.
- AC-20: Given non-zero preflight violations, the database constraint migration
  remains blocked.
- AC-21: Given a clean disposable database, all migrations apply from empty
  state and the invariant constraints are present.
- AC-22: Given invalid DB pool or polling configuration, application startup
  fails with a safe configuration error.
- AC-23: Given verify-full mode, a certificate that cannot be verified fails
  the connection rather than falling back to unverified TLS.
- AC-24: Given external error delivery configuration, readiness reports enabled
  only after a sanitized receipt check succeeds.
- AC-25: Given any implementation pull request, existing E2E tests remain
  discoverable and the affected verification selector chooses the required
  release ladder.

## 11. Edge Cases And Failure Modes

- EC-01: A user has multiple roles and one permits a route while another does
  not. Access remains additive only where the explicit policy says so.
- EC-02: Super Admin backend bypass permits an endpoint not listed in a
  decorator. Preview and docs must describe the effective result, not only the
  decorator text.
- EC-03: A role can open a route but has no store/read scope. The route must
  show an honest scoped-empty/forbidden state without widening scope.
- EC-04: Store incentives is used by an unclassified external client. Backend
  Store Manager compatibility must not be removed without usage evidence.
- EC-05: Session renewal changes the token but not the identity. Isolation must
  use the effective authorization fingerprint, not the raw token string.
- EC-06: Session renewal changes role or scope for the same user. The prior
  scoped cache must be removed.
- EC-07: A target is approved while the user views a later page. Invalidation
  must update queue totals without returning to unbounded history loading.
- EC-08: Historical target totals change between pages. Pagination must tolerate
  a moving queue without duplicating commands.
- EC-09: Istanbul daylight-offset rules change in a future tzdata release. The
  helper must use the named timezone instead of a hard-coded numeric offset.
- EC-10: Source data is Turkish while UI locale is English. Source data stays
  unchanged and only owned labels are translated.
- EC-11: A table row contains interactive controls. Row selection must not
  swallow the control's keyboard or click behavior.
- EC-12: Preflight finds malformed tenant relationships. No automated repair,
  delete, reassignment, or merge is allowed.
- EC-13: A new composite constraint requires a supporting unique key on the
  parent. Add and validate the parent key before the child constraint.
- EC-14: A foreign key is not the leading column of an index. Do not add an
  index until a query plan, delete/update pattern, or validation cost proves
  it is needed.
- EC-15: Provider CA material is unavailable. Keep TLS work blocked rather than
  silently using an invented certificate.
- EC-16: Error-tracking DSN exists but outbound delivery is blocked. Readiness
  must remain degraded/not enabled.
- EC-17: A transitive API helper calls a dynamic endpoint path. The generator
  must preserve an explicit unresolved classification instead of guessing.
- EC-18: A docs/process change crosses into route, API, auth, database, or
  product behavior. Split it into the approved runtime pull request.

## 12. API Contract Impact

| Pull request | API shape change | Authorization change | Compatibility rule |
| --- | --- | --- | --- |
| PR-1 | None | None | Inventory and guard only |
| PR-2 | No intended response-shape change | Yes, only the approved route/read alignment | Positive and negative scope tests required |
| PR-3 | None | No backend change | Client cache lifecycle only |
| PR-4 | Existing query parameters preferred; new bounded read only if unavoidable | None | Existing mutation payloads remain unchanged |
| PR-5 | None | None | Calendar formatting only |
| PR-6 | None | None | Technical values remain stable |
| PR-7 | None | None | Interaction semantics preserved |
| PR-8 | None | None | Generated evidence only |
| PR-9 | None | None | Read-only evidence |
| PR-10 | None | No intended role behavior change | Schema invariants only |
| PR-11 | None | None | Configuration and transport behavior |
| PR-12 | Health/readiness wording may change | None | Actual delivery state must be backward-safe |

If PR-4 requires a new endpoint or changes pagination response shape, it must
define a separate API contract with success, error, pagination, scope, and
compatibility examples before implementation.

## 13. Data Model Impact

No data model changes are authorized before PR-9 preflight is reviewed.

Candidate invariants for PR-10:

| Invariant | Candidate enforcement | Gate |
| --- | --- | --- |
| Region belongs to company | Parent composite unique key plus child composite FK | Zero mismatches |
| Store belongs to region/company | Composite organization FK | Zero mismatches |
| Business row organization IDs agree | Domain-specific composite FK or validated trigger only where FK is impractical | Domain preflight |
| Role assignment scope shape | Check constraint for company/region/store column presence | Zero malformed active rows |
| Scope type vocabulary | Check constraint | Service and catalog vocabulary aligned |
| Primary employee assignment does not overlap | Temporal exclusion or explicitly approved simpler invariant | Owner approves temporal semantics |
| Target allocation count agrees with allocation payload | Check/generated value or removal of duplicate state | Separate target data decision |

Do not add every candidate automatically. PR-9 must classify each as:

- safe to enforce;
- requires data correction;
- requires business decision;
- redundant with an existing invariant;
- deferred due to lock/performance risk.

## 14. Out Of Scope

- New modules, mobile implementation, or microservices.
- Broad frontend redesign.
- Changing scoring, ranking, KPI, checklist weight, target, payout, or incentive
  formulas.
- Changing Store Action lifecycle semantics.
- Changing import/provider source contracts.
- JSON or Nebim integration.
- Bulk API-client migration.
- Bulk repository/service splitting.
- Bulk index creation.
- Automatic data cleanup.
- Branch, worktree, remote-ref, or stash cleanup.
- Broad production.
- A separate plan-only pull request.
- GitHub Codex review requests while the owner-disabled policy remains active.

## 15. Decision Gates

### DG-1 — Authorization Product Truth

Required before: PR-2

Input:

- Store Manager incentive visibility decision;
- Report Viewer Store KPI decision;
- Report Viewer personnel detail decision;
- production Admin Session diagnostic control decision.

Default if no owner decision:

- preserve current runtime access;
- align no runtime behavior;
- keep PR-2 blocked;
- PR-1 may still make drift visible through tests and inventory.

### DG-2 — Live Database Invariant Evidence

Required before: PR-10

Input:

- sanitized preflight counts;
- classification of every non-zero violation;
- lock/validation strategy;
- rollback/forward-repair plan.

Default if unavailable:

- keep PR-10 blocked;
- do not infer data cleanliness from schema or tests.

### DG-3 — Database Certificate Contract

Required before verify-full activation in PR-11

Input:

- provider-supported CA chain or documented secure connection method;
- staging connection proof;
- rotation/expiry ownership.

Default if unavailable:

- retain current controlled-pilot posture;
- record the production blocker;
- do not invent CA material.

### DG-4 — External Error Provider

Required before: PR-12

Input:

- selected provider;
- environment and release naming;
- secret ownership;
- retention/privacy policy;
- sanitized test-event receipt.

Default if unavailable:

- remain log-only;
- broad production remains No-Go.

## 16. Ordered Pull Request Plan

The plan contains twelve pull requests:

- nine can begin from repository evidence after their required specification is
  approved;
- PR-2 is gated by DG-1;
- PR-10 is gated by DG-2;
- verify-full activation in PR-11 is gated by DG-3;
- PR-12 is gated by DG-4.

### PR-1 — Authorization Operating Truth Contract

Priority: first

Type: docs, generator/contract test, no runtime behavior

Includes:

- this plan;
- its documentation-library entry;
- a complete active route inventory;
- explicit aliases and non-product wildcard routes;
- role preview versus runtime route comparison;
- the full route matrix guard instead of a selected hard-coded list;
- an explicit drift register for endpoint roles that cannot be derived safely.

Must not:

- change route access;
- change backend roles;
- change menu visibility;
- change the incentive decision;
- trigger or request GitHub Codex review.

Required tests:

- route inventory contract;
- preview/runtime parity contract;
- known mismatch fixtures proving the guard fails;
- root script/contract tests;
- affected-verification selection.

Exit criteria:

- every concrete route is classified;
- Store Workforce appears in permission-preview ownership;
- Store KPI, personnel detail, incentives, and Store Tasks mismatches are
  machine-visible;
- no product behavior changed;
- the plan document is part of the pull request.

Rollback:

- revert the generator/guard and library entry together; runtime remains
  unchanged.

### PR-2 — Store Authorization Runtime Alignment

Priority: P1

Depends on: PR-1 and DG-1

Type: frontend and backend authorization behavior

Required specification:

- approved role-by-route-by-endpoint matrix;
- read-scope semantics;
- action-scope non-change statement;
- direct-route behavior;
- incentive decision;
- rollback.

Recommended implementation:

- add scoped Report Viewer read behavior to Store KPI if DG-1 approves;
- remove Report Viewer entitlement from personnel detail unless DG-1 approves
  a new company-wide profile contract;
- keep Store incentives Region Manager-only and align preview/docs/tests if
  DG-1 accepts the recommendation;
- hide mock/header editing controls in production while retaining development
  diagnostics if DG-1 accepts the recommendation;
- update the PR-1 parity guard to the approved truth.

Required tests:

- backend positive and negative role/scope integration tests;
- frontend direct navigation tests that assert denied pages make no protected
  data request;
- role preview assertions;
- Store Manager, Region Manager, Report Viewer, Store Personnel, Super Admin,
  and Visual Merchandiser route matrix;
- targeted Store page Playwright;
- full required release through the canonical path.

Exit criteria:

- route, page, backend, preview, matrix, and tests agree;
- no action-store widening;
- no unauthorized personnel or store detail;
- incentive behavior has exactly one documented truth.

Rollback:

- restore the prior role policy and tests together; do not leave docs or
  preview on the new policy.

### PR-3 — Session-Scoped Query Cache Isolation

Priority: P1

Depends on: PR-1 inventory only

Type: frontend security and lifecycle

Approved specification:

- `docs/plans/session-scoped-query-cache-isolation-spec-v1.md`.

Required specification:

- effective authorization fingerprint fields;
- preserved public query allowlist;
- identity change, role change, scope change, renewal, logout, and expiry
  cases;
- no-flash acceptance criteria.

Implementation direction:

- derive a stable effective authorization fingerprint from identity, roles,
  read scope, and action scope;
- remove non-public query families before a newly authorized shell renders;
- preserve shell/bootstrap behavior without a refetch loop;
- clear optimistic mutation state associated with the old identity;
- keep full-page logout defense but do not depend on it.

Required tests:

- QueryClient unit/contract test with User A then User B;
- same-user token renewal;
- same-user role/scope change;
- browser-session expiry and re-login;
- one Playwright persona switch fixture;
- frontend lint, unit, targeted E2E, and canonical release.

Exit criteria:

- prior identity data is never rendered after fingerprint change;
- same-identity renewal remains stable;
- shell session does not loop;
- no tokens or PII enter test output.

Rollback:

- revert the cache-boundary hook and its tests; no backend or database change.

### PR-4 — Bounded Target Request Queues

Priority: P1

Depends on: PR-1 inventory only

Type: frontend/backend read contract and performance

Required specification:

- Admin pending/recent query shape;
- Store ledger filter and pagination behavior;
- pagination metadata;
- scope behavior;
- mutation non-change statement.

Implementation direction:

- Admin Targets requests pending rows and a bounded recent-approved set;
- Store Approvals requests one server-side page for selected filters;
- route prefetch requests only the first useful page;
- remove complete-history walking from active route entry;
- retain a bounded helper only for explicitly approved export/offline use, if
  such a use exists.

Required tests:

- backend pagination/filter integration tests;
- ten-thousand-row repository fixture or equivalent boundary test;
- frontend request-count test;
- page/filter navigation tests;
- target create/approve regression tests;
- owner-attested successful target mutation behavior remains unchanged.

Exit criteria:

- initial request count is bounded;
- UI totals are correct;
- scope is preserved;
- no target mutation semantics changed.

Rollback:

- restore the previous read query while keeping mutation contracts untouched;
  document the performance regression if rollback is used.

### PR-5 — Europe/Istanbul Business Date Contract

Priority: P2 correctness

Depends on: PR-3 only if shared session test utilities overlap

Type: frontend pure logic

Implementation direction:

- add one named business-date helper;
- migrate integration defaults, competition drafts, checklist defaults, and
  Store Approvals helpers;
- compute new drafts at action/initialization time;
- preserve UTC for timestamp instants.

Required tests:

- 00:30 Istanbul;
- month boundary;
- year boundary;
- long-open tab crossing midnight;
- English and Turkish formatting where displayed.

Exit criteria:

- no audited business-date default uses UTC slicing;
- unit tests cover every migrated caller;
- API payload date format remains unchanged.

Rollback:

- revert helper adoption by caller; no stored data migration.

### PR-6 — Active Surface Localization Closure

Priority: P2 product correctness

Depends on: PR-5 only if shared date copy changes

Type: frontend copy and contract

Scope:

- Store Feed;
- Store Reports;
- Admin Incentives;
- localized error/toast/action/table copy owned by those surfaces.

Must not:

- translate source data;
- translate technical codes;
- change formulas or export meaning;
- begin a new i18n library migration.

Required tests:

- TR and EN route assertions;
- Turkish character preservation;
- raw-copy guard with an explicit technical/source-data allowlist;
- existing Store Feed, Store Reports, and Admin Incentives E2E.

Exit criteria:

- selected locale controls owned product copy on all three routes;
- no mojibake;
- no API or workflow behavior change.

Rollback:

- restore prior message ownership and page copy together.

### PR-7 — Keyboard And Accessibility Foundation

Priority: P2 usability

Depends on: PR-1 route inventory

Type: frontend accessibility

Scope:

- Master Data row-selection controls;
- application skip link;
- main-landmark focus target;
- bounded axe seed.

Implementation direction:

- use native controls inside table cells;
- keep table header/body relationships;
- ensure nested actions do not trigger row selection;
- add visible focus styling using existing tokens;
- run axe only on stable shell and Master Data states first.

Required tests:

- Tab, Enter, Space, and focus assertions;
- nested action isolation;
- skip-to-main;
- axe critical violations equal zero;
- existing Master Data behavior tests.

Exit criteria:

- pointer and keyboard behavior are equivalent;
- screen-reader names are meaningful;
- no table semantics regression.

Rollback:

- revert interaction markup and axe seed together; do not leave a half-keyboard
  pattern.

### PR-8 — System-Flow Transitive Precision And Target Typing

Priority: P2 architecture evidence

Depends on: PR-1 route inventory

Type: generator/contract and bounded client typing

Scope:

- transitive frontend wrapper call resolution;
- cycle and duplicate protection;
- Store Approvals request-center edge fixture (the target-edge example was
  superseded by PR-4's bounded read model);
- remove the target approval double cast if the OpenAPI response can represent
  it without an API change.

Must not:

- migrate every legacy client;
- count preloading as runtime fanout;
- change endpoint paths or response shapes.

Required tests:

- direct call;
- one-level and multi-level wrapper;
- cyclic helper graph;
- preload exclusion;
- dynamic/unresolved path classification;
- generated artifact freshness.

Exit criteria:

- Store Approvals has all expected API edges;
- route/API counts are reproducible;
- target response typing no longer needs an unsafe double cast or the remaining
  contract gap is explicitly recorded.

Rollback:

- restore the prior generator and generated artifacts together.

### PR-9 — Database Invariant Preflight Evidence

Priority: P1 data safety prerequisite

Type: read-only script/query, docs, tests

Scope:

- company/region/store mismatch queries;
- malformed role scope shapes;
- overlapping primary employee assignments;
- target allocation duplicate-state check;
- candidate parent uniqueness;
- constraint/index validation-cost observations where measurable.

Rules:

- no update, delete, insert, merge, repair, or migration;
- no raw PII in output;
- counts and stable sanitized identifiers only;
- live execution requires a safe approved database target.

Required tests:

- SQL/script contract rejects mutation statements;
- disposable fixture contains known violations and reports them;
- clean fixture reports zero;
- output redaction.

Exit criteria:

- every candidate invariant is classified;
- PR-10 has a clear go, conditional go, or blocked decision;
- nothing was repaired automatically.

Rollback:

- remove the read-only evidence tooling; no data rollback exists because no
  data changed.

### PR-10 — Database Integrity Constraints

Priority: P1 data integrity

Depends on: PR-9 and DG-2

Type: schema migration

Required specification:

- exact constraints;
- existing-row evidence;
- lock strategy;
- validation order;
- rollback/forward repair;
- application compatibility;
- temporal semantics for primary assignments.

Implementation direction:

- add parent composite uniqueness first where needed;
- add child constraints in an additive order;
- use not-valid plus validate where supported and useful;
- add role scope vocabulary/shape checks;
- add the approved primary-assignment temporal invariant;
- avoid unrelated indexes or normalization.

Required tests:

- schema contract;
- violation fixture rejection;
- backend scope regression;
- fresh database migration smoke;
- migration status/checksum evidence;
- full backend and root release;
- controlled rollback rehearsal on a disposable database.

Exit criteria:

- all approved invariants are enforced;
- fresh migration succeeds;
- existing data remains intact;
- no role, API, or workflow behavior changes unexpectedly.

Rollback:

- use the documented constraint-removal or forward-repair path on a disposable
  target first; never improvise against live data.

### PR-11 — Database Client TLS And Timeout Resilience

Priority: P2 pilot hardening; P1 before broad production

Depends on: DG-3 for verify-full activation

Type: backend configuration and infrastructure contract

Scope:

- validated pool size;
- validated scheduler polling values;
- connection, idle, query, and statement timeouts;
- certificate-verifying TLS mode;
- honest readiness status.

Implementation direction:

- add explicit config keys with safe documented defaults;
- preserve local development mode;
- support provider CA input through the existing secret boundary;
- do not log connection strings or CA content;
- distinguish encrypted-unverified from verified TLS in readiness.

Required tests:

- invalid numeric config;
- timeout config mapping;
- production mode requirements;
- untrusted certificate failure;
- provider staging smoke when CA input exists.

Exit criteria:

- invalid config fails at startup;
- verified TLS state is observable without secrets;
- controlled pilot remains deployable;
- broad production is not upgraded without provider proof.

Rollback:

- return to the prior controlled-pilot connection mode and record the verify
  blocker; do not disable production SSL.

### PR-12 — Real External Error Delivery

Priority: P2 pilot operations; P1 before broad production

Depends on: DG-4

Type: backend/worker observability and provider

Scope:

- API and worker exception delivery;
- environment and release tags;
- correlation ID;
- safe actor identifier policy;
- health/readiness delivery state;
- sanitized test event.

Must not:

- send raw request bodies;
- send tokens, cookies, PII, database URLs, Redis URLs, or provider secrets;
- claim enabled from DSN presence alone.

Required tests:

- payload redaction;
- provider unavailable behavior;
- API and worker capture;
- test-event receipt;
- readiness transition only after actual configuration/delivery contract.

Exit criteria:

- a sanitized test exception is received externally;
- log-only fallback remains available;
- readiness describes actual delivery;
- incident ownership is documented.

Rollback:

- disable provider delivery, retain structured logs, and return readiness to
  log-only/degraded.

## 17. Dependency And Sequencing Matrix

| Pull request | Can start immediately after spec approval | Dependency/gate |
| --- | --- | --- |
| PR-1 | Yes | None |
| PR-2 | No | PR-1 and DG-1 |
| PR-3 | Yes | PR-1 inventory preferred |
| PR-4 | Yes | PR-1 inventory preferred |
| PR-5 | Yes | None |
| PR-6 | Yes | PR-5 only if date copy overlaps |
| PR-7 | Yes | PR-1 inventory preferred |
| PR-8 | Yes | PR-1 |
| PR-9 | Yes locally; live execution gated | Safe DB target |
| PR-10 | No | PR-9 and DG-2 |
| PR-11 | Partial | DG-3 for verify-full activation |
| PR-12 | No | DG-4 |

Recommended merge order:

1. PR-1;
2. PR-3;
3. PR-4;
4. PR-2 after DG-1;
5. PR-5;
6. PR-6;
7. PR-7;
8. PR-8;
9. PR-9;
10. PR-10 after DG-2;
11. PR-11 when DG-3 allows the full slice;
12. PR-12 when DG-4 exists.

PR-3 and PR-4 may be prepared independently after PR-1, but each still gets a
separate review and release story.

## 18. Verification Ladder

### Documentation Or Contract-Only

- diff whitespace/error check;
- root script/contract tests;
- affected-verification selector;
- generated artifact freshness when applicable.

### Frontend Runtime

- OpenAPI generated-type check;
- frontend lint;
- frontend unit tests;
- affected page-specific Playwright;
- role/persona negative tests when applicable;
- canonical full release once for the pull request decision;
- production dependency audit through the existing release path.

### Backend Runtime

- backend lint;
- targeted controller/service/repository tests;
- relevant backend integration tests;
- full backend Jest/build through the existing release path;
- OpenAPI regeneration/check;
- root release.

### Database

- schema contract;
- migration checksum/status;
- disposable fresh database smoke;
- invariant violation fixtures;
- data-preservation and rollback/forward-repair rehearsal;
- live staging validation only with approved credentials and target.

### Provider

- configuration presence is insufficient;
- sanitized delivery/readback is required;
- provider evidence must name environment, release, timestamp, expected,
  actual, and decision without secrets.

## 19. Rollout Rules

- Frontend authorization and cache changes use one controlled pilot persona
  matrix before wider use.
- Target pagination preserves the existing endpoint/mutation behavior and may
  be rolled out without data migration.
- Database constraints use expand, preflight, validate, then enforce.
- TLS verification is proven in staging before production activation.
- External error delivery begins with one sanitized test event.
- No pull request upgrades broad-production posture by itself.

## 20. Stop Rules

Stop and split or escalate when:

- a route decision is missing;
- an auth change would widen write or action-store permission;
- a frontend fix requires a new backend contract not covered by the approved
  spec;
- database preflight returns a non-zero violation count;
- the proposed constraint cannot be rolled back or forward-repaired safely;
- provider CA or error-delivery input is missing;
- a query/index claim lacks real plan or runtime evidence;
- a P2 slice starts becoming a redesign;
- a legacy-client fix becomes a repository-wide migration;
- a test is removed to save release time;
- a pull request tells more than one unrelated implementation story;
- required checks fail or mergeability is not clean;
- a plan task attempts branch/worktree/stash/remote-ref cleanup;
- someone requests or waits for GitHub Codex review while the owner-disabled
  policy remains active.

## 21. Per-Pull-Request Documentation Contract

Before implementation, each runtime, authorization, API, schema, security, or
provider pull request must have an approved finding-specific spec containing:

- title, owner, date, status, and reviewers;
- finding ID and factual evidence;
- functional requirements;
- measurable non-functional requirements;
- Given/When/Then acceptance criteria;
- negative authorization cases;
- edge cases and dependency failures;
- API contract or an explicit no-change statement;
- data model contract or an explicit no-change statement;
- out-of-scope list;
- verification commands;
- rollout and rollback;
- evidence destination.

PR-1 may use this plan as its specification because it changes only inventory,
guards, and documentation and explicitly changes no runtime behavior.

## 22. Execution Status Register

| Pull request | Status | Decision/evidence |
| --- | --- | --- |
| PR-1 Authorization Operating Truth Contract | complete | PR #927 merged as `3f04c24e`; 54 active routes, 33 direct matrix routes, three route/preview drifts, and three route/backend drifts are machine-visible without runtime authorization changes |
| PR-2 Store Authorization Runtime Alignment | blocked_decision | DG-1 |
| PR-3 Session-Scoped Query Cache Isolation | complete | PR #929 merged as `46d20262`; effective-authorization changes now remove prior protected query/mutation state before the new shell renders, while same-authorization renewal remains stable |
| PR-4 Bounded Target Request Queues | complete | PR #930 merged as `bfa2f83c`; Admin and Store target reads are bounded, Store Approvals uses a scoped paged request-center read, and target/workforce mutation, DB, and authorization contracts remain unchanged |
| PR-5 Europe/Istanbul Business Date Contract | complete | PR #931 merged as `7495624f`; shared Europe/Istanbul business-date defaults and calendar arithmetic are guarded while UTC timestamp instants, API, DB, and authorization contracts remain unchanged |
| PR-6 Active Surface Localization Closure | complete | PR #932 merged as `2bc612d2`; typed TR/EN ownership, source/technical allowlists, EN-to-TR acceptance tests, bounded raw-copy/mojibake guard, required checks, and Vercel are green |
| PR-7 Keyboard And Accessibility Foundation | complete | PR #933 merged as `4639bd05`; native Master Data selection, Admin/Store skip links, two bounded axe seeds, local canonical release, required aggregate, targeted frontend, and Vercel are green |
| PR-8 System-Flow Transitive Precision And Target Typing | complete | PR #934 merged as `f53c274d`; transitive called-wrapper evidence, cycle/duplicate safety, unresolved-path classification, current request-center fixture, deterministic skip-link evidence, root release, aggregate gate, and Vercel are green |
| PR-9 Database Invariant Preflight Evidence | partial_complete_input_gated | PR #935 merged as `5b93988b`; read-only runner, redaction/classification tests, 59-migration clean disposable smoke, exact known-violation fixture, rollback proof, root release, aggregate gate, and Vercel are green; approved staging evidence and business decisions remain blocked |
| PR-10 Database Integrity Constraints | blocked_external | DG-2 |
| PR-11 Database Client TLS And Timeout Resilience | partial_complete_input_gated | PR #936 merged as `271bba3f`; validated pool/polling/timeouts, verify-full-capable secret-safe CA mapping, honest TLS readiness, 1155 backend tests, 541 root contracts, exact-head local/root remote release, rehearsal, aggregate, and Vercel are green; DG-3 still blocks provider activation/smoke |
| PR-12 Real External Error Delivery | blocked_external | DG-4 |

Update this table only from verified current state. Do not record a pull request
as complete before merge and post-merge verification.

Repository-actionable implementation is exhausted at this point. PR-2, PR-10,
verify-full activation, and PR-12 must remain parked until DG-1, DG-2, DG-3,
or DG-4 respectively receives the named real input; local tests or docs cannot
substitute for those gates.

## 23. Definition Of Done

The plan is complete only when:

- route, backend, preview, and documentation permission truth is aligned;
- session transitions cannot render prior identity data;
- active target queues use bounded server-side reads;
- business dates are Europe/Istanbul-safe;
- the audited active pages are fully TR/EN for owned product copy;
- Master Data primary selection is keyboard accessible and a bounded axe gate
  exists;
- system-flow captures transitive wrapper calls accurately;
- database preflight is complete and every approved invariant is enforced or
  explicitly accepted/deferred with evidence;
- database transport/configuration posture is honest and provider-verified for
  any broad-production claim;
- external error delivery is either proven or remains explicitly log-only;
- no existing E2E coverage was silently removed;
- broad production remains No-Go unless a separate owner decision and complete
  provider/recovery evidence reopen it.

Plan completion does not require:

- microservices;
- new modules;
- mobile implementation;
- a broad redesign;
- JSON/provider integration;
- a repository-wide API-client migration;
- automated workspace cleanup.

## 24. Cold-Reader Check

A cold reader should be able to answer:

1. What is the first pull request?
2. Which findings are P1?
3. Which decisions block authorization behavior changes?
4. Why must database preflight happen before constraints?
5. Which work remains provider-gated?
6. Which checks apply to each change type?
7. What must be rolled back together?
8. Why does this plan not authorize broad production or a broad refactor?

If any answer cannot be found without reading the audit conversation, update
this document before implementation proceeds.
