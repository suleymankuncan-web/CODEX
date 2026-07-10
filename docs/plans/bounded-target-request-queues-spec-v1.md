# Bounded Target Request Queues Specification V1

Status: approved
Shelf: active plan
Author: Codex
Owner: Product owner
Approved through: owner-approved `project-wide-audit-remediation-plan-v1.md`
Date: 2026-07-10
Review: local adversarial review; GitHub Codex review is owner-disabled

## 1. Context

The active target request client exposes a convenience helper that repeatedly
loads 200-row pages until the backend-reported total is exhausted. Admin
Targets, Store Approvals, Store Targets, and route-prefetch paths call that
helper. Admin Targets then uses only pending requests and five recent approved
requests. Store Approvals combines target, seller-code, and offboarding rows in
one globally sorted ledger and performs filtering and pagination only after the
complete target history has reached the browser. Store Targets can also scan
all target history when no explicit month is present.

The backend target read already supports status, request month, store, limit,
offset, scope filtering, and accurate metadata. Those capabilities are enough
for Admin Targets and Store Targets. They are not enough to page the combined
Store Approvals ledger correctly: independently paged domain lists cannot
produce an exact globally ordered cross-domain page and total without growing
client-side overfetch. This specification therefore permits one new read-only
request-center endpoint inside the existing Store Ops workflow read boundary. It does
not permit a new module, command path, table, migration, or mutation payload.

The implementation must make the initial network and browser work independent
of total historical target rows. It must preserve the current read/action scope
split and every create/approve/workforce command contract.

## 2. Functional Requirements

- FR-01: Admin Targets MUST load pending target requests with one server-side
  paged query using `status=pending_region_approval`, an explicit limit, and an
  explicit offset.
- FR-02: Admin Targets MUST load recent approved target requests separately
  using `status=approved`, `limit=5`, and `offset=0`.
- FR-03: Admin pending pagination MUST expose accurate scoped total/count
  metadata and MUST never hide the existence of additional pending rows.
- FR-04: Admin target prefetch MUST request only the first pending page, the
  five-row approved slice, and the existing bounded coverage read.
- FR-05: Store Targets MUST use a single bounded server request for its active
  month/store selection and MUST NOT discover a month by walking history.
- FR-06: Store Targets route prefetch MUST request only its first useful active
  month/store slice.
- FR-07: Store Approvals MUST receive one globally ordered server-side page for
  its selected tab, type, status, period, store, search text, limit, and offset.
- FR-08: The Store Approvals read MUST combine target-distribution,
  seller-code, and offboarding request rows while preserving their existing
  source-specific status, display evidence, and action handoff fields.
- FR-09: Store Approvals totals and pager metadata MUST describe the complete
  filtered, authorized result set, not only the currently returned rows.
- FR-10: Changing tab, type, status, period, store, search text, or page MUST
  create a query key and request that represent that exact server-side slice.
- FR-11: Store Approvals route prefetch MUST request only the default first
  page; it MUST NOT prefetch later pages or complete histories.
- FR-12: Read scope MUST be resolved from the existing effective read-scope
  policy. Assigned-store action scope MUST continue to control commands and
  MUST NOT be widened by the new read model.
- FR-13: A requested `storeId` outside effective read scope MUST return an empty
  scoped list or the repository's established scoped-empty behavior; the read
  MUST NOT widen scope or disclose existence.
- FR-14: Target create and approve paths, workforce create/review paths,
  payloads, validation, audit behavior, and invalidation families MUST remain
  unchanged.
- FR-15: Approval success MUST invalidate both bounded Admin target queries and
  relevant request-center pages so totals refresh without a full-history read.
- FR-16: The complete-history target helper MUST have no active page or route
  prefetch caller. It MUST be removed unless a separately approved export or
  offline caller is found and documented.
- FR-17: Every list query MUST use deterministic newest-first ordering with a
  stable unique-ID tie breaker so adjacent pages do not duplicate a row when
  timestamps are equal.

## 3. Non-Functional Requirements

- NFR-01 Performance: Initial request count and response volume MUST be
  independent of total historical row count. Ten thousand or one million old
  rows must not add browser requests.
- NFR-02 Reliability: The default Store Approvals view MUST require one ledger
  request, not one request per source domain.
- NFR-03 Security: Existing role admission, read scope, and assigned-store
  action checks remain fail-closed.
- NFR-04 Privacy: Search, fixtures, logs, and errors MUST not expose national
  IDs, raw identity tokens, cookies, or secret-like source identifiers.
- NFR-05 Compatibility: Existing target and workforce mutation endpoints and
  response envelopes MUST not change.
- NFR-06 Data integrity: No schema or data migration is authorized.
- NFR-07 Architecture: The new ledger read MUST reuse the existing Store Ops
  workflow controller/application boundary and repository layering. It MAY add
  one dedicated read repository to the existing targets/workflow module, with a
  reasoned module-graph baseline update. It MUST NOT create a new Nest module or
  direct controller-to-database access.
- NFR-08 Query cost: Page queries MUST apply authorization and filter predicates
  before ordering/limit. Index work is out of scope without query-plan evidence.
- NFR-09 UX: Loading, empty, error, filters, metrics, handoff links, and native
  pagination remain usable in both Turkish and English.
- NFR-10 Verification: The PR uses one canonical root release proof after
  targeted tests; no second concurrent full frontend release is added.

## 4. Acceptance Criteria

- AC-01 (FR-01-FR-04): Given 10,000 historical target requests, when Admin
  Targets opens, then the client sends exactly one first-page pending request,
  one five-row approved request, and the existing coverage request; it never
  follows target metadata to later pages automatically.
- AC-02 (FR-01, FR-03): Given pending total exceeds one page, when the operator
  advances the pending pager, then only the selected offset is requested and
  the UI retains the scoped pending total.
- AC-03 (FR-02): Given more than five approved requests, when Admin Targets
  opens, then at most five approved rows are returned/rendered while approved
  metadata may state the larger scoped total.
- AC-04 (FR-05, FR-06): Given an active month/store selection, when Store
  Targets opens or prefetches, then exactly one target page for that selection
  is requested and no history-following loop runs.
- AC-05 (FR-07-FR-11): Given a Store Approvals filter/page selection, when its
  query runs, then the request contains that selection, returned rows are the
  globally newest matching authorized rows, and `meta.total` is the exact
  filtered authorized total.
- AC-06 (FR-08): Given target, seller-code, and offboarding rows with interleaved
  timestamps, when Store Approvals reads a page, then row order is globally
  newest-first and each row keeps the evidence needed by its existing label,
  status, and action URL.
- AC-07 (FR-10): Given the operator changes any server-owned filter, when the
  selection commits, then offset resets to zero and stale data from the prior
  query key is not presented as the new filtered result.
- AC-08 (FR-12, FR-13, NFR-03): Given two actors with different read/action
  scopes, when both request the same filters, then each total/items set is
  read-scoped and neither receives command authority for an unassigned store.
- AC-09 (FR-14, FR-15, NFR-05): Given target create and approval regression
  fixtures, when commands succeed or fail, then request/response validation and
  audit semantics match the pre-PR contract; success refreshes bounded lists.
- AC-10 (FR-16): Given the completed source graph, when target reads are
  inspected, then no active page/prefetch imports or calls the history-walking
  helper.
- AC-11 (FR-17): Given equal `updated_at`/`created_at` timestamps, when two
  adjacent pages are read without intervening writes, then the ID tie breaker
  produces deterministic non-overlapping rows.
- AC-12 (NFR-01): Given a repository fixture whose filtered total is 10,000,
  when the first page is requested, then one bounded data query and one count
  query (or one equivalent window-count query) execute; no loop or per-row
  query executes.
- AC-13 (NFR-06-NFR-08): Given the final diff, when architecture and DB impact
  are reviewed, then there is no migration/new module/direct web DB access and
  filtering precedes limit/offset.

## 5. Edge Cases

- EC-01: No pending Admin targets exist but approved history exists. Pending
  renders empty with total zero; recent approved remains independently visible.
- EC-02: An approval changes a row between pending page reads. Invalidation
  refreshes totals; the UI clamps an now-invalid offset to the last available
  page without issuing a history scan.
- EC-03: A row is inserted between page reads. Offset pagination may move a row
  across pages, but deterministic ordering prevents unstable equal-time order
  and commands remain ID-addressed/idempotent under their existing contract.
- EC-04: Status is unknown or malformed. Validation rejects it with the standard
  400 envelope; the repository never interpolates raw status text.
- EC-05: Period is `all`. No date predicate is applied. A concrete period is
  normalized to a half-open UTC-safe calendar range according to the existing
  persisted timestamp semantics; target `requestMonth` remains a date field.
- EC-06: Search is blank or shorter than the approved minimum. It is omitted;
  whitespace-only input never creates an unbounded wildcard predicate.
- EC-07: Search contains `%`, `_`, quotes, or Turkish casing. Parameters remain
  bound, wildcard characters are escaped where needed, and behavior is covered
  without logging the raw term.
- EC-08: Type is one domain. The ledger query excludes other UNION branches and
  still returns exact metadata.
- EC-09: Type is `all`. All three authorized branches participate in one
  globally ordered page and one exact total.
- EC-10: Store Manager has assigned action stores but narrower/different read
  scope. Ledger visibility follows read scope; action links and backend commands
  continue to enforce assigned action scope.
- EC-11: REPORT_VIEWER can read scoped rows but cannot approve. The page does
  not gain mutation controls from the read endpoint.
- EC-12: A source row lacks optional name/reference evidence. Existing unknown
  label fallbacks remain; the API does not invent business data.
- EC-13: Coverage fails while Admin target lists succeed, or vice versa. Existing
  section-level error behavior remains independent.
- EC-14: Prefetch data becomes stale before navigation. The normal TanStack
  stale/invalidation policy may refresh the same bounded key only.
- EC-15: A filter total is zero while offset is nonzero due to a prior state.
  Client resets/clamps to offset zero and does not repeatedly refetch.

## 6. API Contracts

### 6.1 Existing target list (shape unchanged)

`GET /api/target-distributions/requests`

Supported query parameters remain:

```ts
type TargetRequestListQuery = {
  status?: string
  requestMonth?: string // YYYY-MM-DD
  storeId?: string      // UUID
  limit?: number        // 1..200
  offset?: number       // >= 0
}
```

The existing list envelope remains unchanged. Admin uses two independent keys:

```ts
['target-distribution-requests', 'approval-queue', 'pending', limit, offset]
['target-distribution-requests', 'approval-queue', 'approved-recent', 5, 0]
```

### 6.2 New bounded Store Approvals read

`GET /api/workflow/request-center`

```ts
type RequestCenterQuery = {
  bucket?: 'open' | 'done'       // default: open
  type?: 'all' | 'target' | 'sellerCode' | 'offboarding' // default: all
  status?: 'all' | 'pending' | 'returned' | 'approved'   // default: all
  period?: string                // YYYY-MM; omitted means all
  storeId?: string               // UUID; optional scoped narrowing
  q?: string                     // trimmed bounded search term
  limit?: number                 // 1..50; client default 15
  offset?: number                // >= 0; client default 0
}

```ts
type RequestCenterItem = {
  requestId: string
  requestType: 'target' | 'sellerCode' | 'offboarding'
  storeId: string
  storeName: string | null
  status: string
  updatedAt: string
  targetLabel: string | null
  requestMonth: string | null
  allocationCount: number | null
  approvalMode: 'direct' | 'adjusted' | null
  personDisplayName: string | null
  nationalIdLast4: string | null
  externalEmployeeRef: string | null
}

type RequestCenterResponse = {
  items: RequestCenterItem[]
  meta: {
    count: number
    total: number
    limit: number
    offset: number
  }
}
```

Success uses the repository's standard list response. Invalid query values use
the standard sanitized validation error envelope. Authentication/role failure
uses existing guards. Scope narrowing returns only authorized rows and never
reports the existence of excluded rows.

Allowed roles MUST be `STORE_MANAGER`, `REGION_MANAGER`, `REPORT_VIEWER`, and
`SUPER_ADMIN`, matching the Store Approvals route/read policy recorded by PR-1.
This endpoint does not become a new authorization source of truth.

### 6.3 Mutation non-change

No method, path, body, response, role decorator, action-scope check, audit event,
or validation change is authorized for:

- `POST /api/target-distributions/requests`;
- `PATCH /api/target-distributions/requests/{requestId}/approve`;
- seller-code create/review/resubmit commands;
- offboarding create/review/resubmit commands.

## 7. Data Models

No persisted data model changes are authorized. `RequestCenterItem` is a
read-model projection only. Source IDs remain opaque strings, source status is
preserved, and optional source fields remain nullable rather than fabricated.

Repository ordering contract:

```sql
ORDER BY updated_at DESC, request_type ASC, request_id DESC
LIMIT :limit OFFSET :offset
```

The exact UNION/CTE representation is implementation-owned, but authorization,
type, bucket, status, period, store, and search predicates must be applied in
the bounded query plan. No row-by-row lookup is permitted.

## 8. Out Of Scope

- OS-01: Any target or workforce mutation behavior, payload, authorization,
  validation, audit, or toast redesign.
- OS-02: Cursor pagination or an infinite-scroll redesign. Existing explicit
  pages remain offset-based.
- OS-03: Exporting complete target/request history. A future export needs a
  separate async/bounded specification and authorization decision.
- OS-04: New tables, materialized views, migrations, indexes, or data repair.
- OS-05: A new Nest module, microservice, queue, cache, worker, or polling loop.
- OS-06: Changes to coverage calculation, target allocation, incentive,
  checklist, ranking, or scoring semantics.
- OS-07: Widening Store Approvals route roles or merging read scope with action
  scope.
- OS-08: Rewriting visual design, labels, localization architecture, or all
  request-center source APIs.
- OS-09: Broad production readiness or claims based only on local fixtures.

## 9. Verification And Traceability

| Test/evidence | Requirements |
| --- | --- |
| Target API request construction unit tests | FR-01, FR-02, FR-05, FR-06 |
| Admin Targets request-count/page tests | FR-01-FR-04, FR-15; AC-01-AC-03 |
| Request-center DTO/controller tests | FR-07, FR-10, FR-12, FR-13; EC-04-EC-07 |
| Request-center repository boundary tests | FR-08, FR-09, FR-17; NFR-01, NFR-08; AC-05, AC-06, AC-11, AC-12 |
| Scope integration tests | FR-12, FR-13; NFR-03; AC-08; EC-10, EC-11 |
| Store Approvals filter/page tests | FR-07-FR-11; AC-05-AC-07; EC-08, EC-09, EC-15 |
| Prefetch source contract tests | FR-04, FR-06, FR-11, FR-16; AC-10 |
| Existing target/workforce command regressions | FR-14, FR-15; NFR-05; AC-09 |
| Architecture/diff contract review | NFR-06, NFR-07; AC-13 |

Verification ladder:

1. `git diff --check`.
2. Focused DTO, service, repository, request-count, and page/filter tests.
3. Existing target create/approve and workforce command regression tests.
4. OpenAPI generation/baseline and frontend client type checks.
5. Frontend lint and build.
6. Targeted Store Approvals and Admin Targets Playwright flows with bounded
   fixtures.
7. Root script/contract tests.
8. One canonical root release run for the PR decision.
9. Local adversarial review for scope widening, incorrect totals, hidden pending
   rows, query-key collisions, per-row queries, unbounded prefetch, and mutation
   drift.

Manual spec validation:

- Every FR and NFR is covered by an acceptance criterion or verification row.
- The unavoidable new read endpoint has success, error, pagination, scope, and
  compatibility behavior.
- Mutation non-change and no-schema/no-new-module boundaries are explicit.
- Ten-thousand-row behavior is machine-verifiable without committed sensitive
  or production data.
- Rollback can remove the new read projection and restore bounded per-domain
  reads without touching command paths or data.
