# Refactor Execution Plan V1

Status: Active as of 2026-05-09

This plan records the agreed refactor rule for the next engineering cycle: reduce structural risk without changing product behavior. Each item below must ship as a small PR with targeted verification before merge.

## Working Rules

- Do not change behavior, authorization, schema, SQL semantics, copy, or UI layout in a mechanical refactor PR.
- Identify the existing behavior tests before moving code. Add a focused contract test first if the behavior is not already covered.
- Prefer extraction by stable responsibility: route shells, display formatting, form sections, read models, orchestration, and raw persistence.
- Keep one PR to one refactor slice. Do not mix UI redesign, product features, and backend refactors.
- Use targeted tests for the touched surface and at least one build/typecheck command for the affected package.
- Stop the slice if test coverage is unclear or the extracted boundary requires product decisions.

## Ordered Refactor Slices

1. `admin-web/src/App.tsx` route and shell split
   - Extract lazy route loaders, shell state helpers, navigation definitions, and route state components.
   - Keep route access behavior identical.
   - Verification: admin/store routing tests, return-path tests, store surface coverage, and frontend build.

2. Store KPI display consolidation
   - Share KPI formatting and rank display between `StoreMyPerformancePage.tsx` and `StoreKpiHighlightsPage.tsx`.
   - Preserve Turkish-first labels and the current benchmark semantics.
   - Verification: store surfaces, KPI benchmark/explainability tests, and frontend build.

3. `StoreApprovalsPage.tsx` form-section split
   - Extract review list, detail panel, and action form sections.
   - Preserve available actions and role visibility.
   - Verification: approval surface tests and pilot API contract coverage.

4. `ReportingRepository` closed-ranking read boundary
   - Extract closed-ranking read queries into a dedicated repository boundary only after existing result contracts are captured.
   - Preserve company, region, store, and personnel scoping.
   - Verification: reporting repository tests, ranking contract tests, and backend build.

5. `ReportingService` orchestration split
   - Extract orchestration helpers around report assembly after repository contracts are stable.
   - Preserve response shape and error behavior.
   - Verification: reporting service tests, reporting E2E tests, and backend build.

6. `IntegrationRepository` raw writer split
   - Extract raw import writer logic by persistence responsibility.
   - Preserve import batch status transitions and idempotency behavior.
   - Verification: import-batch E2E tests, integration repository tests, and backend build.

## Deferred Refactors

- `AuthAdminRepository` remains deferred unless a concrete product, security, or bug pressure appears. It is security-sensitive and should not be split without stronger contract coverage.
- JSON ingestion remains out of scope while the project is driven by Power BI/Excel outputs.
