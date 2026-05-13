# Master Data Command Center V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Keep this checklist current as work completes.

## Goal

Replace the old `/admin/master-data` bootstrap-only surface with a production-ready master data command center that manages:

- staged store/personnel bootstrap batches,
- live store master records,
- live personnel master records,
- master-data audit evidence.

The page must match the current admin command palette and must not leave old generic UI remnants on the live surface.

## Suitability Decision

- Store master editing is already supported by backend endpoints:
  - `GET /api/integrations/store-master`
  - `GET /api/integrations/store-master-lookups`
  - `PATCH /api/integrations/store-master/:storeId`
- Bootstrap batch review/promotion is already supported by backend endpoints under:
  - `/api/integrations/master-data-bootstrap/batches`
- Personnel master editing is not yet supported by an admin-wide backend endpoint. Add a small scoped integration surface rather than reusing store workforce endpoints, because workforce endpoints are store-action scoped and not fit for admin master-data maintenance.

## Backend Tasks

- [ ] Add personnel master DTOs:
  - `backend/nestjs/src/modules/integration/web/dto/list-personnel-master.query.ts`
  - `backend/nestjs/src/modules/integration/web/dto/update-personnel-master.dto.ts`
- [ ] Add controller endpoints in `backend/nestjs/src/modules/integration/web/integration.controller.ts`:
  - `GET /integrations/personnel-master`
  - `GET /integrations/personnel-master-lookups`
  - `PATCH /integrations/personnel-master/:employeeId`
- [ ] Add service methods in `backend/nestjs/src/modules/integration/application/integration.service.ts`:
  - list personnel records with company scope,
  - return store/position/status lookups,
  - update employee identity and active primary assignment safely.
- [ ] Add repository methods in `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts`:
  - query employee plus current active primary assignment,
  - query store/position lookup options,
  - transactional update to `ops.employee` and `ops.employee_assignment_history`,
  - audit event `personnel_master_data.updated`.
- [ ] Add the audit event to `backend/nestjs/src/shared/audit/audit-event-catalog.ts`.

## Frontend Tasks

- [ ] Extend `admin-web/src/features/integrations/api.ts` with personnel master types and API functions.
- [ ] Replace `admin-web/src/pages/MasterDataBootstrapPage.tsx` with a tabbed command center:
  - `Hazırlık Partileri`,
  - `Mağazalar`,
  - `Personel`,
  - `Değişiklik Geçmişi`.
- [ ] Keep route `/admin/master-data/:batchId` usable by opening the bootstrap tab with selected batch evidence.
- [ ] Move store master editing into the new master data page using the existing store master API.
- [ ] Add personnel master editing using the new personnel API.
- [ ] Refresh localization in `admin-web/src/features/localization/messages/admin-master-data.ts`.
- [ ] Add scoped CSS in `admin-web/src/index.css` using the existing admin command colors.
- [ ] Update Playwright tests that assert old master data page copy.

## Verification

- [ ] `npm.cmd --prefix backend/nestjs run lint`
- [ ] `npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts`
- [ ] `npm.cmd --prefix backend/nestjs run build`
- [ ] `npm.cmd --prefix admin-web run lint`
- [ ] `npm.cmd --prefix admin-web run build`
- [ ] `npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts`
- [ ] `npm.cmd --prefix admin-web run test:e2e -- pilot-api-contracts.spec.ts`
- [ ] `npm.cmd --prefix admin-web run test:e2e -- integration-surfaces.spec.ts`
