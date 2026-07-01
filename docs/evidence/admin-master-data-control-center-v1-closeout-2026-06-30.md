# Admin Master Data Control Center V1 Closeout Evidence

Status: `Prototype parity: PASS`

PR: `#838`

Source prototype:

- `admin-web/src/prototypes/admin/master-data-command-v1.tsx`
- `admin-web/src/prototypes/admin/master-data-command-v1.css`

Production route:

- `/admin/master-data`
- `/admin/master-data/:batchId`

## Component Map

| Prototype area | Production mapping |
| --- | --- |
| Admin prototype shell | Existing `AdminShell` and `AdminSurfacePage`; sidebar/header preserved. |
| Header and command actions | `MasterDataControlCenterPage` header with shadcn `Button`. |
| Metric strip | `Metric` cards in `master-data-control-center-page.tsx`, backed by real queries and local draft count. |
| Issue-first workbench | Backend `master-data-quality/issues` projection, rendered through `MasterDataWorkbenchTable`. |
| Tabs | shadcn-compatible tab buttons for `Düzeltilecekler`, `Mağazalar`, `Personel`, `İçe Aktarım`, `Geçmiş`. |
| Search/filter/sort row | shadcn `Input` and `Select` controls. |
| Store/personnel/import/history rows | `master-data-control-center-tables.tsx` adapters over real API responses. |
| Right-side detail panel | `master-data-control-center-detail.tsx` for issue, store, personnel, import, and audit detail. |
| Direct save bar | `Kaydet`/`Değişiklikleri kaydet` wired to store/personnel mutations with `expectedUpdatedAt`. |
| Import processing | Existing bootstrap readiness and processing APIs; visible copy uses `İçe Aktarım`, `Kontrol`, `Kayda işle`. |

## Screenshot Evidence

Desktop and mobile screenshots were captured from local Vite with the same API fixtures used by `admin-web/e2e/master-data-surfaces.spec.ts`.

- Prototype desktop: `docs/evidence/admin-master-data-control-center-v1/prototype-desktop.png`
- Prototype mobile: `docs/evidence/admin-master-data-control-center-v1/prototype-mobile.png`
- Production issues desktop: `docs/evidence/admin-master-data-control-center-v1/production-desktop-issues.png`
- Production stores desktop: `docs/evidence/admin-master-data-control-center-v1/production-desktop-stores.png`
- Production personnel desktop: `docs/evidence/admin-master-data-control-center-v1/production-desktop-personnel.png`
- Production import desktop: `docs/evidence/admin-master-data-control-center-v1/production-desktop-import.png`
- Production history desktop: `docs/evidence/admin-master-data-control-center-v1/production-desktop-history.png`
- Production mobile: `docs/evidence/admin-master-data-control-center-v1/production-mobile.png`
- Overflow results: `docs/evidence/admin-master-data-control-center-v1/screenshot-overflow.json`

Overflow result:

- Prototype desktop: pass.
- Prototype mobile: pass.
- Production issues/stores/personnel/import/history desktop: pass.
- Production mobile: pass.

## Parity Notes

Material parity is preserved for the approved surface anatomy: compact command header, metric strip, issue-first workbench, tab rhythm, list density, right detail panel, status tones, direct-save wording, import wording, and mobile-safe stacked layout.

Intentional production deviations:

- The prototype's standalone sidebar is replaced by the real Admin shell/sidebar. This is required by the plan and keeps route navigation/auth behavior intact.
- Prototype static rows are replaced by real API-backed issue, store, personnel, import, and audit adapters. No fake production rows ship.
- Prototype native controls are translated to production shadcn/project controls where they preserve the visible rhythm.
- Prototype helper state is removed from the production route. Production uses query invalidation and local draft state without polling or full-page refresh.

## Copy And Data Checks

- `Düzeltilecekler` comes from `GET /api/integrations/master-data-quality/issues`.
- Store/personnel saves use direct `Kaydet` language.
- Import processing uses `İçe Aktarım`, `Kontrol`, and `Kayda işle`.
- UUID values are not primary visible labels in the workbench rows.
- Internal copy such as `mock`, `scope`, `API`, `DB`, `provider`, and `contract` is not present in the production files changed for this surface.

## Verification

Local checks run before opening PR `#838`:

- `npm.cmd --prefix admin-web run api:check`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- master-data-surfaces.spec.ts`
- `npm.cmd run test:scripts`
- `git diff --cached --check`

Additional evidence capture:

- Prototype and production screenshots captured at `1440x980`.
- Prototype and production mobile screenshots captured at `390x844`.
- `screenshot-overflow.json` confirms no horizontal overflow in captured states.
