# Active Surface Localization Closure Specification V1

Status: implemented locally; pull request and merge evidence pending
Shelf: active plan
Author: Codex
Owner: Product owner
Approved through: owner-approved `project-wide-audit-remediation-plan-v1.md`
Date: 2026-07-10
Review: local adversarial review; GitHub Codex review is owner-disabled
Target pull request: PR-6
Change type: frontend copy ownership and regression evidence

## 1. Context

The locale switch is active application-wide, but three audited routes still
own visible Turkish product copy directly in page components:

- Store Feed;
- Store Reports;
- Admin Incentives.

The gap includes headings, metrics, actions, aria labels, empty/loading/error
states, toast fallbacks, table labels, filter labels, status explanations, and
date/persona labels. Some source-provided values are intentionally raw and must
not be translated. The correction is message ownership, not a new i18n system.

## 2. Goals

- Make the selected TR/EN locale control all product-owned copy on the three
  routes.
- Keep Turkish text UTF-8 clean and preserve correct Turkish characters.
- Keep source data, identifiers, technical codes, money, formulas, and export
  meaning unchanged.
- Keep every request, mutation, route, permission, workflow, and query key
  unchanged.
- Add a bounded static guard so newly introduced raw product copy cannot reopen
  these exact surfaces silently.

## 3. Non-goals

- No localization-library migration or message-catalog redesign.
- No translation of feed post title/body/link label, store/person names,
  external references, source-system values, reason notes, or API error detail.
- No translation of route paths, query parameters, status/position/participant
  codes, spreadsheet columns, filenames, or raw export cells.
- No formula, incentive eligibility, report readiness, archive/pin, download,
  or correction/review behavior change.
- No broad repository copy sweep outside the three named routes and their
  directly owned helpers.

## 4. Message Ownership

Use the existing typed localization dictionary and `useLocalization` hook.

- Store Feed extends its existing `store-feed` namespace.
- Store Reports receives one route-owned `store-reports` namespace.
- Admin Incentives receives one route-owned `admin-incentives` namespace.
- Shared generic primitives continue receiving resolved strings; they do not
  import route message namespaces.
- Pure format/model helpers accept locale or translated labels explicitly when
  product copy is required.

Translation keys should describe meaning, not layout or current component
names. Parameterized messages own counts, period labels, store counts, and
decision-dependent toast text.

## 5. Source And Technical Allowlist

The raw-copy guard may allow only values whose text originates outside product
copy ownership or must remain technically stable:

- Feed: post title/body, link label, metric label, author/source identity.
- Reports: backend section labels/values when explicitly source-provided,
  period keys, generated filenames, export content.
- Incentives: store/person names, reason notes, source codes, position/status
  codes before existing label mapping, currency values, period keys, export
  headers/cells whose existing contract is intentionally stable.
- All routes: sanitized API error detail rendered alongside a localized fallback.

An allowlist entry must name the expression/family and reason. It must not
allow arbitrary string literals in the full file.

## 6. Functional Requirements

- FR-01: Switching to English updates every product-owned heading, metric,
  action, aria label, state message, toast fallback, table/filter label, and
  status explanation on the three routes.
- FR-02: Switching back to Turkish restores correct Turkish characters without
  mojibake or an English residue.
- FR-03: Feed create/edit/pin/unpin/archive/undo payloads and optimistic behavior
  remain byte-for-byte equivalent apart from displayed copy.
- FR-04: Store Report period selection, query identity, package readiness,
  download request, filename, and spreadsheet contents remain unchanged.
- FR-05: Admin Incentive correction, package review, filters, totals, export,
  formulas, and query invalidation remain unchanged.
- FR-06: Locale formatting may change visible dates/numbers only through the
  existing locale-aware formatters; stored/API values remain stable.
- FR-07: Unknown technical values remain visible through the existing safe
  fallback instead of being guessed or hidden.
- FR-08: Errors retain sanitized backend detail where already shown, with all
  product-owned fallback/action copy localized.

## 7. Acceptance Criteria

- TR and EN browser assertions cover all three routes.
- Store Feed management and read-only personas preserve their current actions
  and scope while rendering locale-owned chrome.
- Store Reports current/closed period, loading, error, ready, and download states
  render locale-owned copy without changing network behavior.
- Admin Incentives loading/error/empty/data, correction, region-package review,
  filters, table, and toast states render locale-owned copy.
- Turkish character/mojibake guards pass.
- A static raw-copy guard covers only the three active surfaces and rejects a
  synthetic new product string while honoring the explicit source/technical
  allowlist.
- Existing Store Feed, Store Reports, and Admin Incentives E2E remain green.
- No API/OpenAPI, backend, database, route-role, or mutation payload diff exists.

## 8. Verification

- Typed dictionary/message-catalog tests.
- Route-focused TR/EN Playwright assertions.
- Existing feed, report, and incentive E2E regression suites.
- Frontend lint, unit/script tests, production build, root guards, and one
  canonical release check.

## 9. Rollback

Revert message ownership and caller adoption together. No data, backend,
database, or API rollback is required. If only one surface must roll back, keep
its prior TR copy and document the temporary EN gap rather than mixing partial
message ownership inside that surface.

## 10. Local Verification Evidence

- Store Feed, Store Reports, and Admin Incentives use typed TR/EN namespaces;
  source posts, source rows, technical values, payloads, and export contracts
  remain unchanged.
- The bounded raw-copy guard rejects a synthetic product literal and checks the
  six owned page/helper files plus three message catalogs for mojibake.
- Three EN-to-TR acceptance tests, all eight feed-surface tests, and the 97-test
  related regression pack passed.
- Frontend build, lint, 25 unit tests, 103 script tests, and all 531 root guards
  passed.
- The canonical local release passed in 12 minutes 24 seconds. GitHub checks,
  pull request, merge, and post-merge evidence remain open.
