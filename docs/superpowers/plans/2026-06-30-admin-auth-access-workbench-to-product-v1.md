# Admin Auth Access Workbench To Product V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the approved Admin Auth Access Workbench prototype into the real `/admin/auth` page with real backend data, preserving the prototype's layout, interaction model, density, typography, and operational workflow.

**Architecture:** Existing Auth Admin backend remains the source of truth. The frontend replaces the current dashboard-style auth page with a workbench surface that composes user inventory, user detail, role assignments, store/action assignments, audit trail, edit drafts, and deactivate/reactivate flows from typed OpenAPI clients.

**Tech Stack:** NestJS, PostgreSQL, OpenAPI, React, TypeScript, TanStack Query, existing HR Axis admin shell, Tailwind/AdminSurface primitives where they preserve prototype parity.

---

## Non-Negotiables

- [ ] The approved prototype at `http://127.0.0.1:5173/admin/auth?prototype=access-workbench-v1` is the visual and interaction contract.
- [ ] Production `/admin/auth` must use real data only. No mock user, fake role, fake store, fake metric, or placeholder state.
- [ ] The page must remain an operational workbench, not a dashboard.
- [ ] `SUPER_ADMIN` access behavior stays intact unless an existing backend rule already allows another admin role.
- [ ] User edit, role assignment, store assignment, deactivate, reactivate, and audit flows must be traceable through existing backend records.
- [ ] No internal copy: no `mock`, `API`, `DB`, `scope`, `provider subject`, `real data`, or debug wording in visible UI.
- [ ] Native uncontrolled form controls should not be introduced in the production surface.
- [ ] Query keys must include filters, selected user id where relevant, and active/inactive state.
- [ ] Mutations must invalidate only the affected auth workbench query families.
- [ ] Prototype parity must be checked on desktop and mobile before closeout.

---

## Current Evidence

- [ ] Prototype source exists at `admin-web/src/prototypes/admin/auth-access-workbench-v1.tsx`.
- [ ] Prototype style exists at `admin-web/src/styles/admin-auth-access-workbench.css`.
- [ ] Dev-only prototype route exists in `admin-web/src/App.tsx`.
- [ ] Current production page is `admin-web/src/pages/AuthDashboardPage.tsx`.
- [ ] Current production auth sections are in `admin-web/src/features/auth/AuthDashboardSections.tsx`.
- [ ] Current frontend auth client is `admin-web/src/features/auth/api.ts`.
- [ ] Existing backend controller is `backend/nestjs/src/modules/auth/web/auth-admin.controller.ts`.
- [ ] Existing user list DTO is `backend/nestjs/src/modules/auth/web/dto/list-user-accounts.query.ts`.
- [ ] Existing backend supports user list, create user, role assignment, store assignment, deactivate/reactivate, and audit endpoints.
- [ ] Existing backend does not yet expose a first-class user profile update endpoint.
- [ ] Existing user deactivate endpoint does not yet accept an operator reason payload.

---

## Production Data Mapping

- [ ] Left user list:
  - Source: `GET /api/auth/users`.
  - Needs `limit`, `offset`, `isActive`, `authProvider`, and `q`.
  - Page should default to at least 100 users without truncating the inventory.
- [ ] User search:
  - Add `q` to `GET /api/auth/users` instead of relying on a disconnected lookup-only endpoint.
  - Search fields: username, email, employee id, provider subject where useful.
- [ ] User status:
  - `Aktif`: `isActive === true`.
  - `Pasif`: `isActive === false`.
  - `Davet bekliyor` must only appear if a real pending invite/account state exists. If not available, do not show this status in production filters.
- [ ] User detail:
  - Source: selected user from `GET /api/auth/users`.
  - Role source: `GET /api/auth/role-assignments?userId=...`.
  - Store/action access source: `GET /api/auth/action-store-assignments?userId=...`.
  - Audit source: `GET /api/auth/users/{userId}/audit`.
- [ ] Workbench metrics:
  - `Kullanıcı`: `GET /api/auth/users` total and active count.
  - `Rol ataması`: active role assignment count.
  - `Mağaza erişimi`: active action-store assignment count.
  - `Pasif hesap`: inactive user count.
- [ ] Deactivation flow:
  - UI copy must say `Uygulama erişimini kapat` unless real Clerk session revocation is implemented.
  - Deactivation must close app-level access consistently through existing lifecycle behavior.
- [ ] Edit flow:
  - Name/username, email, employee id, and active/passive status must save to real backend state.
  - Role/store changes save through existing create/deactivate assignment endpoints.

---

## PR Train

### PR1 - Backend Contract Gaps

- [x] Add `q?: string` to `backend/nestjs/src/modules/auth/web/dto/list-user-accounts.query.ts`.
- [x] Extend `backend/nestjs/src/modules/auth/auth-admin-user-account-read.repository.ts` to filter by `q` across safe user account fields.
- [x] Add `backend/nestjs/src/modules/auth/web/dto/update-user-account.dto.ts`.
- [x] Add `PATCH /api/auth/users/:userId` in `backend/nestjs/src/modules/auth/web/auth-admin.controller.ts`.
- [x] Implement update orchestration in `backend/nestjs/src/modules/auth/auth-admin-user-account.service.ts`.
- [x] Implement persistence in `backend/nestjs/src/modules/auth/auth-user-account-command.repository.ts`.
- [x] Add `backend/nestjs/src/modules/auth/web/dto/deactivate-user-account.dto.ts` with optional `reason`.
- [x] Change `PATCH /api/auth/users/:userId/deactivate` to accept the DTO body.
- [x] Store deactivate reason through existing lifecycle/audit path without adding a new schema column unless the current schema lacks a suitable field.
- [x] Add or update backend tests for:
  - user list `q` filter,
  - user update validation,
  - deactivate with reason,
  - unchanged existing deactivate/reactivate behavior.
- [x] Regenerate OpenAPI:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:check
```

- [x] Verification commands:

```powershell
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run test -- --runInBand auth
npm.cmd run test:scripts
```

### PR2 - Frontend Data Model And Mutations

- [ ] Update `admin-web/src/features/auth/api.ts` for:
  - `getUserAccounts({ query, limit, offset, authProvider, isActive })`,
  - `updateUserAccount(userId, input)`,
  - `deactivateUserAccount(userId, input)`.
- [ ] Create `admin-web/src/features/auth/auth-access-workbench-model.ts`.
- [ ] Map real backend records into the prototype's workbench shape:
  - user row,
  - detail facts,
  - role list,
  - store/action list,
  - audit list,
  - status badges,
  - change summary.
- [ ] Add deterministic sort:
  - active users first,
  - then recently updated/audit activity when available,
  - then display name/email.
- [ ] Build draft state helpers:
  - profile draft,
  - role add/remove draft,
  - store add/remove draft,
  - deactivate/reactivate draft.
- [ ] Mutations:
  - Save profile changes.
  - Add role assignment.
  - Deactivate role assignment.
  - Add store/action assignment.
  - Deactivate store/action assignment.
  - Deactivate/reactivate user.
- [ ] Query invalidation:
  - invalidate user list after profile/status changes,
  - invalidate selected user detail,
  - invalidate role assignments after role mutations,
  - invalidate store/action assignments after store mutations,
  - invalidate audit after every write.
- [ ] Add loading, empty, forbidden, and error adapters without changing prototype layout.
- [ ] Verification commands:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

### PR3 - Production UI Translation

- [ ] Replace the current `/admin/auth` dashboard body with an `AuthAccessWorkbench` production component.
- [ ] Keep route ownership in `admin-web/src/pages/AuthDashboardPage.tsx`.
- [ ] Keep or split old panels only if they are still needed as internal form fragments. Remove unused dashboard-only sections.
- [ ] Port the approved prototype structure exactly:
  - compact workbench header,
  - metric strip,
  - left user inventory,
  - central detail workspace,
  - right action panel,
  - accordion action trays,
  - deactivate confirmation flow.
- [ ] Preserve prototype density and visual hierarchy:
  - same relative widths,
  - same row rhythm,
  - same card sizes,
  - same typography weight,
  - same status badge style,
  - same sticky/scroll behavior.
- [ ] Convert prototype mock controls to real shadcn/AdminSurface-compatible controls only when visual parity remains intact.
- [ ] Remove visible mock copy and development hints.
- [ ] Deactivation copy:
  - `Hesabı pasife al`,
  - `Uygulama erişimini kapat`,
  - `Erişim kayıtları kapatılır`,
  - no false Clerk-session promise unless implemented.
- [ ] Profile edit copy:
  - `Bilgileri düzenle`,
  - `Kaydet`,
  - `Vazgeç`,
  - `Değişiklik yok`.
- [ ] Role/store assignment copy must use business labels, not raw IDs.
- [ ] IDs may appear only in audit/debug-free technical detail if explicitly useful; default UI must show names.
- [ ] Ensure 100-user list remains usable without the page becoming taller than necessary.
- [ ] Mobile behavior:
  - user list collapses above/detail,
  - action panel moves below or into drawer,
  - no horizontal overflow.
- [ ] Verification commands:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

### PR4 - Evidence, Cleanup, And Closeout

- [ ] Remove or keep the prototype route consciously:
  - If production parity is complete, remove `?prototype=access-workbench-v1` route from `admin-web/src/App.tsx`.
  - If kept for future reference, guard it strictly as dev-only and document it.
- [ ] Update `docs/prototypes/README.md` with the locked prototype status and production destination.
- [ ] Add closeout evidence at `docs/evidence/admin-auth-access-workbench-v1-closeout-2026-06-30.md`.
- [ ] Evidence must include:
  - desktop screenshot path,
  - mobile screenshot path,
  - 100-user list behavior,
  - edit user save behavior,
  - deactivate/reactivate behavior,
  - role assignment behavior,
  - store assignment behavior,
  - audit refresh behavior,
  - forbidden state check for non-admin if practical.
- [ ] Run final checks:

```powershell
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd run check:release
```

- [ ] Confirm working tree contains only intended files before PR merge.

---

## Acceptance Criteria

- [ ] `/admin/auth` visually matches the approved prototype materially, not just functionally.
- [ ] 100 real users can be browsed/search-filtered without truncation or layout collapse.
- [ ] Selecting a user shows real profile, roles, stores, and audit data.
- [ ] Editing user information persists and refreshes the UI without full-page reload.
- [ ] User deactivation/reactivation persists and records an audit trail.
- [ ] Role assignment add/remove works from the workbench.
- [ ] Store/action assignment add/remove works from the workbench.
- [ ] All visible labels are Turkish and business-readable.
- [ ] UUIDs/provider ids are not used as primary display labels.
- [ ] No fake invite/pending states appear unless backed by real data.
- [ ] Loading state does not look like a broken/blank page.
- [ ] Empty state is operational and short.
- [ ] Error state has retry and does not expose internal API details.
- [ ] Mobile has no horizontal scroll.
- [ ] No timer polling, 30-second refresh, or full page refresh is introduced.

---

## Risks And Decisions

- [ ] **Clerk session revocation:** Current app-level deactivate flow can close application access. Do not claim Clerk session revocation unless a Clerk management endpoint is explicitly implemented and verified.
- [ ] **Pending invite status:** Do not show `Davet bekliyor` unless the backend exposes a real pending invite signal. Otherwise keep status filters to `Tümü / Aktif / Pasif`.
- [ ] **Exit date:** If no dedicated exit-date column exists, store operator reason only. Add exit-date schema in a separate PR if HR needs structured termination reporting.
- [ ] **Prototype CSS reuse:** Reusing scoped prototype CSS is allowed only after removing mock-only assumptions and aligning tokens. If CSS fights production shell, port the visual rhythm into feature-scoped production styles.
- [ ] **Old panel deletion:** Remove old dashboard sections only after confirming no unique workflow is lost.

---

## Self-Review Checklist

- [ ] Does the plan cover every prototype area: header, metrics, user list, detail, tabs, action panel, edit, deactivate, audit?
- [ ] Does every visible prototype mock action have a real backend path or a clearly parked decision?
- [ ] Are hidden side effects called out, especially Clerk session revocation and fake pending invite states?
- [ ] Are role/store changes implemented through existing assignment lifecycle instead of client-only state?
- [ ] Are query invalidations scoped enough to avoid slow page refresh behavior?
- [ ] Are desktop and mobile parity checks explicit?
- [ ] Are there no `TODO`, `TBD`, or placeholder implementation steps?
