# Admin Master Data Control Center To Product V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the approved Admin Master Data control-center prototype into the real `/admin/master-data` page with real data, direct-save operations, backend-driven data quality issues, and material one-to-one UI parity.

**Architecture:** Existing master data bootstrap and direct master data edit APIs remain the source of truth. Add a backend read projection for data quality issues and audit/history, add a deterministic impact-rule layer, then replace the current production page body with the locked prototype's operational workbench layout.

**Tech Stack:** NestJS, PostgreSQL, OpenAPI, React, TypeScript, TanStack Query, existing HR Axis admin shell, feature-scoped CSS/AdminSurface primitives where they preserve prototype parity.

---

## Locked Decisions

- [ ] **No separate publish flow for manual master data edits.** Store and personnel edits save directly through existing update APIs.
- [ ] Visible copy for manual edits uses direct-save language: `Kaydedilmemiş değişiklik`, `Kaydet`, `Değişiklikleri kaydet`, `Kaydedildi`.
- [ ] Batch/import flow stays separate from manual edits. Import rows can still be validated and processed into live records, but visible copy uses `İçe Aktarım`, `Kontrol`, `Kayda işle`, not `Yayına al`.
- [ ] `Düzeltilecekler` is backend-driven. Production UI must not invent data quality problems on the frontend.
- [ ] The right-side impact panel is rule-based and dynamic. It shows where a change will be visible based on entity type and changed fields.
- [ ] Every persisted master data change must leave an audit trail in `audit.event_log` or an existing equivalent audit mechanism.
- [ ] Production `/admin/master-data` must visually match `admin-web/src/prototypes/admin/master-data-command-v1.tsx` and `admin-web/src/prototypes/admin/master-data-command-v1.css` materially.
- [ ] Real data only. No fake metrics, fake issues, fake rows, or placeholder business values in production.
- [ ] Admin shell/sidebar stays intact. The page body becomes the prototype surface.
- [ ] No internal copy: no `API`, `DB`, `scope`, `mock`, `real data`, `provider`, raw UUID-first labels, or debug wording in visible UI.
- [ ] Existing admin authorization boundary remains intact for every new read/write endpoint. Non-admin users must receive the current forbidden behavior.
- [ ] Direct saves use a stale-record conflict guard. If another admin changes the same record after the row was loaded, the save returns a conflict and the UI asks the user to refresh/apply again.

---

## Product Workflow Contract

- [ ] Admin enters `/admin/master-data` to correct store/personnel identity, assignments, seller codes, store ownership, store type, and integration-critical references.
- [ ] First screen prioritizes `Düzeltilecekler`, because pilot stability depends on correcting records that block KPI, targets, rankings, incentives, reports, workforce, or integrations.
- [ ] Admin can switch between:
  - `Düzeltilecekler`: backend-projected data quality issues.
  - `Mağazalar`: direct store master data edit surface.
  - `Personel`: direct personnel master data edit surface.
  - `İçe Aktarım`: existing master data bootstrap batch validation and processing.
  - `Geçmiş`: audit trail for master data changes and import processing.
- [ ] Selecting an issue, store, personnel row, or import batch opens the right-side operational detail panel.
- [ ] Manual store/personnel changes remain draft only in the browser until `Kaydet` is clicked.
- [ ] Save success updates the list, issue projection, detail panel, metrics, and audit history without a full-page refresh.
- [ ] If a save conflict is returned, the UI keeps the draft, reloads the latest server value beside it, and shows a short `Kayıt güncellendi, tekrar kontrol edin.` message.
- [ ] Save failure keeps the local draft visible and explains the issue in user-facing Turkish copy.
- [ ] Import processing does not share the manual edit save bar. It has its own validation and `Kayda işle` controls.

---

## Current Evidence

- [ ] Prototype route is wired through `admin-web/src/App.tsx`.
- [ ] Prototype source is `admin-web/src/prototypes/admin/master-data-command-v1.tsx`.
- [ ] Prototype styles are `admin-web/src/prototypes/admin/master-data-command-v1.css`.
- [ ] Current production route owner is `admin-web/src/pages/MasterDataBootstrapPage.tsx`.
- [ ] Current page model is `admin-web/src/pages/master-data-bootstrap-model.ts`.
- [ ] Current frontend API surface is `admin-web/src/features/integrations/api.ts`.
- [ ] Current backend controller is `backend/nestjs/src/modules/integration/web/integration.controller.ts`.
- [ ] Current backend master data bootstrap service is `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`.
- [ ] Current direct read repositories include:
  - `backend/nestjs/src/modules/integration/infrastructure/store-master-read.repository.ts`
  - `backend/nestjs/src/modules/integration/infrastructure/personnel-master-read.repository.ts`
- [ ] Current integration repositories already write audit events for several integration mutations through `audit.event_log`.
- [ ] Existing e2e coverage includes `admin-web/e2e/master-data-surfaces.spec.ts`.

---

## Data Quality Projection

### Backend Endpoint

- [ ] Add `GET /api/integrations/master-data-quality/issues`.
- [ ] Query params:
  - `limit`: default `50`, max `200`.
  - `offset`: default `0`.
  - `q`: optional search across store, personnel, manager, seller code, region labels.
  - `entityType`: optional `store | personnel | assignment | import`.
  - `severity`: optional `critical | warning | info`.
  - `issueCode`: optional stable issue code.
- [ ] Response shape:
  - `items`: issue rows.
  - `summary`: counts by severity and entity type.
  - `meta`: `limit`, `offset`, `total`.
- [ ] Add DTOs under `backend/nestjs/src/modules/integration/web/dto/`:
  - `list-master-data-quality-issues.query.ts`
  - `master-data-quality-issue.response.ts`
- [ ] Add service and repository:
  - `backend/nestjs/src/modules/integration/application/master-data-quality.service.ts`
  - `backend/nestjs/src/modules/integration/application/master-data-quality.rules.ts`
  - `backend/nestjs/src/modules/integration/infrastructure/master-data-quality.repository.ts`
- [ ] Register the service and repository in `backend/nestjs/src/modules/integration/integration.module.ts`.

### Issue Codes

- [ ] `store_missing_region_assignment`: store has no active region/region manager assignment used by region-scoped pages.
- [ ] `store_missing_store_manager`: store has no active store manager assignment.
- [ ] `store_missing_external_ref`: store has no integration-safe external reference when the schema exposes that field.
- [ ] `personnel_missing_store_assignment`: active personnel cannot be attached to an active store.
- [ ] `personnel_missing_position`: active personnel has no normalized position.
- [ ] `personnel_missing_seller_code`: sales-import-relevant personnel has no seller code.
- [ ] `personnel_duplicate_seller_code`: active seller code is shared by more than one active personnel record.
- [ ] `inactive_store_has_active_personnel`: inactive/closed store still has active personnel assignment.
- [ ] `import_batch_blocked`: latest import batch has validation failures that require admin action.

### Display Fields

- [ ] Each issue item includes:
  - `id`
  - `issueCode`
  - `severity`
  - `entityType`
  - `entityId`
  - `entityLabel`
  - `secondaryLabel`
  - `problemLabel`
  - `recommendedAction`
  - `affectedModules`
  - `lastSeenAt`
  - `source`
- [ ] `source` is internal for traceability but visible UI maps it to business copy such as `Mağaza kaydı`, `Personel kaydı`, `İçe aktarım`.
- [ ] UUIDs are never the primary display label. If a name cannot be resolved, display `İsim bulunamadı` plus a short technical suffix only in the detail panel.

---

## Impact Rules

- [ ] Add a shared frontend helper at `admin-web/src/pages/master-data-impact-rules.ts`.
- [ ] The helper accepts `entityType`, changed field names, and current record data.
- [ ] It returns business-readable modules and short effects:
  - `regionId`, `regionManagerId`, `assignedRegionManagerUserId`: KPI, targets, rankings, incentives, reports, feed audience.
  - `storeManagerUserId`, `storeManagerEmployeeId`: targets, tasks, checklist acceptance, store home, reports.
  - `storeType`: incentives visibility, company-store-only flows, KPI grouping, reports.
  - `isActive`, `closedAt`: rankings, targets, workforce, reports, store visibility.
  - `externalStoreRef`: imports, KPI, sales, reports.
  - `externalEmployeeRef`, `sellerCode`: sales import, personnel KPI, incentives, rankings.
  - `positionId`, `roleCode`: incentives ratio, workforce, target distribution, personnel grouping.
  - `employmentStatus`, `assignmentEndDate`: workforce, targets, incentives, reports.
- [ ] The impact panel updates immediately while the draft changes, before save.
- [ ] The backend quality endpoint also returns `affectedModules` for each issue so issue detail and edit draft use the same language.

---

## PR Train

### PR1 - Backend Quality Projection And Audit Read

- [ ] Read `current-state.md`, `discipline.md`, `sokrates.md`, `contributing.md`, and this plan before coding.
- [ ] Add `MasterDataQualityService` and `MasterDataQualityRepository`.
- [ ] Implement `GET /api/integrations/master-data-quality/issues` in `backend/nestjs/src/modules/integration/web/integration.controller.ts`.
- [ ] Add `GET /api/integrations/master-data-quality/audit` for recent master data and import-related audit events.
- [ ] Audit endpoint query params:
  - `limit`: default `30`, max `100`.
  - `offset`: default `0`.
  - `entityType`: optional `store | personnel | import`.
  - `entityId`: optional UUID.
- [ ] Audit response maps `audit.event_log` into Turkish-safe frontend fields:
  - `eventId`
  - `eventType`
  - `entityType`
  - `entityId`
  - `entityLabel`
  - `actorLabel`
  - `occurredAt`
  - `summary`
  - `metadata`
- [ ] Verify existing store/personnel update paths write audit events.
- [ ] If a direct update path does not write audit, add audit write in the existing repository transaction that persists the update.
- [ ] Extend direct store/personnel update DTOs with `expectedUpdatedAt` using current read-model `updatedAt` values.
- [ ] Update repository writes so `expectedUpdatedAt` mismatches return a 409 conflict instead of overwriting newer data.
- [ ] Apply existing admin auth/permission decorators to the new quality and audit endpoints.
- [ ] Add backend tests:
  - quality projection returns store/personnel/import issues,
  - search and filters work,
  - max limit is enforced,
  - non-admin access is forbidden,
  - stale `expectedUpdatedAt` writes return conflict,
  - audit read maps events without exposing raw internals,
  - update path writes audit when changed fields are persisted.
- [ ] Regenerate OpenAPI:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:check
```

- [ ] Verification:

```powershell
npm.cmd --prefix backend/nestjs run lint
npm.cmd --prefix backend/nestjs run test -- --runInBand master-data
npm.cmd --prefix backend/nestjs run build
```

### PR2 - Frontend Data Model And API Wiring

- [ ] Update `admin-web/src/features/integrations/api.ts` with:
  - `getMasterDataQualityIssues`
  - `getMasterDataQualityAudit`
- [ ] Update `admin-web/scripts/generate-openapi-types.mjs` selected operations for the new endpoints.
- [ ] Update generated OpenAPI types.
- [ ] Extend `admin-web/src/pages/master-data-bootstrap-model.ts` with:
  - `MasterDataIssueRow`
  - `MasterDataAuditRow`
  - `MasterDataImpactModule`
  - `MasterDataWorkbenchTab = "issues" | "stores" | "personnel" | "imports" | "history"`
- [ ] Keep existing backend tab behavior intact by mapping production label `İçe Aktarım` to current batch/bootstrap data.
- [ ] Add `admin-web/src/pages/master-data-impact-rules.ts`.
- [ ] Add data adapters:
  - issue projection to prototype issue list rows,
  - store master records to store list rows,
  - personnel master records to personnel list rows,
  - bootstrap batches to import rows,
  - audit events to history rows.
- [ ] Add query keys that include active tab, search, filters, selected entity, limit, offset.
- [ ] Mutations invalidate:
  - relevant store/personnel list query,
  - selected detail query,
  - master-data-quality issues,
  - master-data-quality audit,
  - bootstrap readiness when import processing changes.
- [ ] Store/personnel save mutations send the selected row's `updatedAt` as `expectedUpdatedAt`.
- [ ] Add a conflict-state adapter for 409 responses that preserves the local draft and prompts the admin to compare with the latest record.
- [ ] Add frontend unit/script tests for impact rules and data adapters.
- [ ] Verification:

```powershell
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

### PR3 - Birebir UI Translation

- [ ] Replace the production body in `admin-web/src/pages/MasterDataBootstrapPage.tsx` with the locked prototype anatomy.
- [ ] Preserve production route, auth guard, admin shell, and existing backend capabilities.
- [ ] Use the prototype as the implementation contract:
  - header scale,
  - metrics strip,
  - issue-first layout,
  - tab rhythm,
  - list density,
  - right detail panel,
  - save bar,
  - direct-save wording,
  - spacing,
  - typography weight,
  - button placement.
- [ ] Move reusable visual classes from `admin-web/src/prototypes/admin/master-data-command-v1.css` into a production-scoped stylesheet only after removing mock-only selectors.
- [ ] Keep the page operational and not dashboard-like.
- [ ] Production tabs:
  - `Düzeltilecekler`
  - `Mağazalar`
  - `Personel`
  - `İçe Aktarım`
  - `Geçmiş`
- [ ] Metrics:
  - `Aksiyon bekleyen`: issue projection critical + warning total.
  - `Magaza`: real store total.
  - `Personel`: real personnel total.
  - `Kaydedilmemiş`: local unsaved draft count.
- [ ] `Düzeltilecekler` list uses backend quality issues only.
- [ ] `Mağazalar` list uses real store data and direct store edit API.
- [ ] `Personel` list uses real personnel data and direct personnel edit API.
- [ ] `İçe Aktarım` uses existing bootstrap batch list, validation, readiness, and processing APIs.
- [ ] `Geçmiş` uses the new audit projection endpoint.
- [ ] Right panel behavior:
  - issue selected: shows issue summary, affected modules, recommended correction, and quick navigation to the relevant edit surface.
  - store selected: shows editable store fields, unsaved changes, impact modules, save action.
  - personnel selected: shows editable personnel fields, unsaved changes, impact modules, save action.
  - import selected: shows batch validation/readiness and `Kayda işle` actions.
  - history selected: shows audit event detail without raw debug copy.
- [ ] Remove visible `yayına al`, `taslak`, `mock`, `scope`, `API`, `DB`, `gerçek veri`, and UUID-first labels.
- [ ] Loading, empty, forbidden, and error states are short and operational.
- [ ] No timer polling, 30-second refresh, or full-page refresh is introduced.
- [ ] Desktop validation:
  - no horizontal overflow at 1366px,
  - right panel remains usable,
  - save bar does not cover required controls.
- [ ] Mobile validation:
  - list stacks cleanly,
  - right panel becomes drawer/stacked detail,
  - no horizontal overflow.
- [ ] Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- master-data-surfaces.spec.ts
```

### PR4 - Evidence, Prototype Lock, And Release Hygiene

- [ ] Update `docs/prototypes/README.md` with:
  - `admin/master-data-command-v1` locked status,
  - production destination `/admin/master-data`,
  - parity notes,
  - screenshot paths.
- [ ] Add closeout evidence:
  - `docs/evidence/admin-master-data-control-center-v1-closeout-2026-06-30.md`
- [ ] Evidence includes:
  - desktop screenshot,
  - mobile screenshot,
  - quality issue projection screenshot,
  - store edit save screenshot,
  - personnel edit save screenshot,
  - import validation/readiness screenshot,
  - audit/history screenshot,
  - no-internal-copy check,
  - no-horizontal-overflow check.
- [ ] Keep or remove prototype route consciously:
  - if production parity is verified, remove the dev-only route from `admin-web/src/App.tsx`,
  - if retained for design reference, keep it dev-only and document why.
- [ ] Run final checks:

```powershell
npm.cmd --prefix backend/nestjs run lint
npm.cmd --prefix backend/nestjs run test -- --runInBand master-data
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd run test:scripts
npm.cmd run check:release
```

- [ ] Confirm working tree contains only intended files before PR merge.

---

## Acceptance Criteria

- [ ] `/admin/master-data` materially matches the locked prototype, not only functionally.
- [ ] Page remains an operational data-control surface, not a dashboard.
- [ ] Manual store/personnel edits use direct save and never use publish/yayın language.
- [ ] Import/bootstrap processing remains available and clearly separated from manual edits.
- [ ] `Düzeltilecekler` is backed by a backend projection.
- [ ] Quality issues have stable codes, severity, entity labels, recommended actions, and affected modules.
- [ ] Impact panel updates as fields change before save.
- [ ] Save creates/updates audit trail.
- [ ] History tab reads real audit events.
- [ ] UUIDs are not primary display labels.
- [ ] All visible copy is Turkish and business-readable.
- [ ] Error messages do not expose raw internal paths or debug details.
- [ ] Conflict state is visible, keeps the unsaved draft, and does not silently overwrite newer server data.
- [ ] Query invalidation refreshes only affected data families.
- [ ] No layout overflow on desktop or mobile.
- [ ] No fake data ships in production.

---

## Risks And Mitigations

- [ ] **Risk: prototype parity drifts during production translation.** Mitigation: port the page anatomy and CSS rhythm first, then wire data; capture screenshots before PR closeout.
- [ ] **Risk: import workflow copy reintroduces publish language.** Mitigation: reserve `Kayda işle` for import processing and `Kaydet` for manual edits.
- [ ] **Risk: issue projection becomes expensive.** Mitigation: compute with bounded queries, server-side pagination, indexed joins, and no broad unbounded scans.
- [ ] **Risk: audit trail lacks readable entity labels.** Mitigation: audit endpoint resolves labels through store/personnel lookup joins and falls back to short safe labels.
- [ ] **Risk: direct save hides blast radius.** Mitigation: impact panel shows affected modules before save and save confirmation summarizes changed fields.
- [ ] **Risk: concurrent admin edits overwrite each other.** Mitigation: use `expectedUpdatedAt` conflict checks and a visible conflict recovery state.
- [ ] **Risk: old bootstrap behavior is lost.** Mitigation: keep existing batch validation/readiness/promote APIs and only change surface placement/copy.

---

## Self-Review

- [ ] Product decisions are explicit and do not conflict with existing manual edit behavior.
- [ ] Backend projection is specified before frontend UI depends on it.
- [ ] UI parity is treated as an acceptance gate, not an aspiration.
- [ ] Import and manual edit workflows are separated.
- [ ] Tests cover backend projection, audit, frontend adapters, visual smoke, and release checks.
- [ ] Plan avoids hidden fake data, internal copy, and UUID-first displays.
