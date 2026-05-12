# Store Home Command Center V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan. Work through the checklist in order and verify each slice before moving to the next.

## Goal

Turn the accepted `outputs/store-home-command-center-v1.html` direction into the real store-facing application shell:

- `/store` and `/store/home` become the new role-aware home surface.
- The fixed left toolbar becomes the real navigation model for store-facing users.
- Page interiors can remain functionally current for this slice; the priority is navigation, role-based access, and shell consistency.
- The top-right prototype persona switcher is not implemented. Real users see a single experience derived from authenticated role codes and scopes.

## Current Context

- Existing `/store` and `/store/home` render `StoreShellPreviewPage` through `StoreShell`.
- Rankings and `store/me` already use newer immersive surfaces.
- `StoreMyPerformancePage` has its own internal rail today; the new shell should own navigation to avoid duplicate left menus.
- `resolveLandingPath` currently sends `REGION_MANAGER` to `/admin/targets`; this needs to be revisited so BM users can land in the store command center while admin-only roles keep admin landing behavior.
- Visual merchandiser-only users currently land on `/store/checklists`; preserve that behavior.

## Position Model

Create a single role-to-persona resolver for store-facing navigation.

| Persona | Role Source | Landing | Navigation |
| --- | --- | --- | --- |
| Store personnel | Default store user without manager/admin role | `/store/home` | Ana Sayfa, Benim Performansım, Sıralamam, Duyurular, Ayarlar/Profil |
| Store manager | Store manager role or assigned store action scope | `/store/home` | Ana Sayfa, Mağaza KPI, Rankings, Talepler/Onaylar, Görevler, Duyurular, Ayarlar/Profil |
| Region manager | `REGION_MANAGER` without higher admin landing priority | `/store/home` | Ana Sayfa, Rankings, KPI Özetleri, Checklist, Talepler/Onaylar, Hedefler, Raporlar, Duyurular, Ayarlar/Profil |
| Visual merchandiser only | Existing VM-only guard | `/store/checklists` | Checklist, Duyurular, Ayarlar/Profil |
| Admin/super admin | Existing admin roles | Existing admin landing | Store shell only if they explicitly enter `/store`; show region-manager-level store navigation |

Role priority:

1. Keep existing admin landing for `SUPER_ADMIN`, `INTEGRATION_ADMIN`, `SNAPSHOT_OPERATOR`, `HR_ADMIN`, `REPORT_VIEWER`, and `AUDITOR`.
2. Preserve VM-only checklist landing.
3. Route store personnel, store manager, and region manager users to `/store/home`.
4. If a privileged admin manually opens `/store`, render the broadest store navigation rather than a fake persona selector.

## Data Rules

- Do not keep the three prototype identity buttons in production UI.
- Do not show fake production data.
- Display authenticated user identity from session data where available.
- Show metric values only from existing API/page data. If a card is not wired yet, render a calm empty state such as `Veri hazırlanıyor`.
- Personnel home must not show CR.
- Store manager and region manager store summaries may include store-level CR and checklist counts.
- Latest visible operational data should reflect the latest loaded day, not the current calendar day assumption.

## Files

Create:

- `admin-web/src/app/store-navigation.ts`
  - Exports `resolveStorePersona(session)`.
  - Exports `getStoreNavigation(persona)`.
  - Keeps labels, route ids, role visibility, and icon ids centralized.

- `admin-web/src/app/store-sidebar.tsx`
  - Fixed collapsible left toolbar.
  - Desktop rail plus compact mobile behavior.
  - Active route highlighting.
  - Footer action for `Ayarlar / Profil`.
  - No language switch in the main home header.

- `admin-web/src/pages/StoreHomePage.tsx`
  - Real version of the accepted command-center home.
  - Uses `AuthSessionSummary` and `resolveStorePersona`.
  - Renders role-specific cards and copy.
  - Removes all prototype-only identity switching.

- `admin-web/src/pages/StoreSettingsPage.tsx`
  - Minimal settings/profile surface.
  - Language preference belongs here and should persist per user once backend support exists; for this slice keep existing localization storage behavior.

- `admin-web/src/pages/StoreTargetsPage.tsx`
  - Store-shell route for BM `Hedefler` navigation so the left toolbar remains stable.
  - Can initially link into the existing target workflow or render a thin wrapper using existing target components if compatible.

Modify:

- `admin-web/src/app/store-shell.tsx`
  - Mount `StoreSidebar` around store routes.
  - Replace `StoreShellPreviewPage` for `/store` and `/store/home` with `StoreHomePage`.
  - Add `/store/settings` and `/store/targets`.
  - Keep `StoreRouteGuard` behavior for checklist-only users.
  - Keep immersive styling for rankings and performance pages, but with shared shell navigation.

- `admin-web/src/app/shell-state.ts`
  - Update landing resolution so region managers can land on `/store/home` unless they have a higher-priority admin role.
  - Preserve existing admin-only and VM-only landing behavior.

- `admin-web/src/app/route-loaders.tsx`
  - Lazy-load `StoreHomePage`, `StoreSettingsPage`, and `StoreTargetsPage`.

- `admin-web/src/app/route-preloaders.ts`
  - Preload `StoreHomePage` for `/store` and `/store/home`.
  - Add preload entries for settings and targets routes.

- `admin-web/src/pages/StoreMyPerformancePage.tsx`
  - Remove duplicate internal rail when rendered inside the new shell.
  - Preferred implementation: add a prop such as `showInternalRail?: boolean` with default `true`, then pass `false` from `StoreShell`.

- `admin-web/src/features/localization/messages/store-home.ts`
  - Add labels for the new home and toolbar.
  - Keep Turkish-first strings complete.

- `admin-web/src/index.css`
  - Port accepted output styles into production classes.
  - Keep card sizing stable.
  - Fix collapsed toolbar icon sizing.
  - Avoid overly transparent cards in the real surface.

## Implementation Slices

### Slice 1: Navigation Contract

- [ ] Add `store-navigation.ts`.
- [ ] Implement persona resolver against `AuthSessionSummary.user.roleCodes`, assigned stores, and VM-only helper.
- [ ] Add nav item definitions for personnel, manager, region manager, and VM-only.
- [ ] Add unit-style tests if the repo already has a nearby helper test pattern; otherwise cover through Playwright route tests.

Suggested resolver shape:

```ts
export type StorePersona = 'personnel' | 'storeManager' | 'regionManager' | 'visualMerchandiser'

export function resolveStorePersona(session: AuthSessionSummary): StorePersona {
  const roles = new Set(session.user.roleCodes)

  if (isVisualMerchandiserOnly(session)) return 'visualMerchandiser'
  if (roles.has('REGION_MANAGER')) return 'regionManager'
  if (roles.has('STORE_MANAGER') || session.user.actionScope.assignedStoreIds.length > 0) {
    return 'storeManager'
  }

  return 'personnel'
}
```

### Slice 2: Store Shell Toolbar

- [ ] Create `StoreSidebar`.
- [ ] Use lucide icons through a typed icon map.
- [ ] Implement collapsed state with small, readable icons.
- [ ] Put `Ayarlar / Profil` at the lower-left footer.
- [ ] Remove home-level quick switch controls from production shell.
- [ ] Ensure personnel nav does not include approvals.
- [ ] Ensure manager/BM nav labels use `Talepler / Onaylar`.
- [ ] Ensure BM nav includes `Checklist`.

### Slice 3: Real Home Surface

- [ ] Create `StoreHomePage`.
- [ ] Port the accepted layout from `outputs/store-home-command-center-v1.html`.
- [ ] Render role-specific hero and summary cards:
  - Personnel: personal score, store rank, region rank, Turkey rank, UPT, ATV, HG%.
  - Store manager: store score with decimal, store rank, pending request card, UPT, ATV, CR, HG%, checklist summary.
  - Region manager: region score, region rank, Turkey rank, checklist summary such as `Checklist yapılan mağaza 7/29`.
- [ ] Remove progress bars from this home surface unless they are purely decorative and do not imply missing data.
- [ ] Keep `Bekleyen talep` number clickable for managers and BM users.
- [ ] Use empty states instead of fabricated numbers where a real endpoint is not wired.

### Slice 4: Route Wiring

- [ ] Replace `/store` and `/store/home` preview rendering with `StoreHomePage`.
- [ ] Add `/store/settings`.
- [ ] Add `/store/targets` for BM toolbar continuity.
- [ ] Update route preloaders.
- [ ] Update route loading copy if needed so transitions feel intentional.
- [ ] Update `resolveLandingPath`.
- [ ] Preserve `/store/checklists` landing for VM-only users.

### Slice 5: Duplicate Rail Cleanup

- [ ] Disable `StoreMyPerformancePage` internal rail inside `StoreShell`.
- [ ] Check `/store/personnel/:employeeId` keeps the same shared shell and does not reintroduce a second toolbar.
- [ ] Check `/store/rankings` remains visually consistent with the new shell.

### Slice 6: Localization And Settings

- [ ] Move visible language control to `/store/settings`.
- [ ] Keep home/header free of TR/EN toggle clutter.
- [ ] Persist the existing language preference with the current localization mechanism.
- [ ] Document backend-backed per-user language preference as a separate enhancement, not part of this slice.

### Slice 7: Verification

- [ ] Run `npm.cmd --prefix admin-web run lint`.
- [ ] Run `npm.cmd --prefix admin-web run build`.
- [ ] Run targeted Playwright:

```powershell
npm.cmd --prefix admin-web run test:e2e -- e2e/store-surfaces.spec.ts
```

- [ ] Add or update Playwright coverage:
  - Personnel sees personnel nav and no approvals.
  - Store manager sees `Talepler / Onaylar` and pending request card navigates correctly.
  - Region manager sees `Checklist`.
  - VM-only still lands on checklist.
  - `/store/me` does not show duplicate left rails.
  - Top-right prototype persona controls are absent.

## Acceptance Criteria

- `/store` opens the new command-center home for store-facing roles.
- Navigation is derived from auth roles, not from UI identity buttons.
- Personnel, store manager, and BM users get distinct nav sets.
- Store personnel cannot see approvals navigation.
- Store manager and BM see `Talepler / Onaylar`.
- BM sees `Checklist`.
- Left toolbar remains stable across connected store pages.
- `Ayarlar / Profil` is reachable from the lower-left toolbar area.
- Existing rankings and performance routes still open.
- Build and targeted e2e pass.

## Out Of Scope For This Slice

- Final redesign of every page interior.
- Backend-backed language preference persistence.
- New KPI calculation rules.
- Route transition loading animation implementation.
- Mobile app implementation.
