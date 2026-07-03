# HR Axis Action Feedback And Incentives Production V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HR Axis içinde aksiyon sonrası bildirimleri standart hale getirmek ve onaylanan Prim Kontrol Sayfası prototipini `/store/incentives` production sayfasına birebir iş akışına zarar vermeden taşımak.

**Architecture:** Global Sonner tabanlı action feedback katmanı tek kez uygulama köküne eklenecek. Sayfa mutasyonları başarılı/başarısız durumları aynı helper üzerinden kullanacak. `/store/incentives` Bölge Müdürü görünümü onaylanan React prototipinin görsel diliyle yeniden hizalanacak; backend, hesaplama, role/scope, şirket mağazası kuralı ve mevcut mutation kontratları değişmeyecek.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Query, shadcn/ui, Tailwind v4 `tw:` prefix, lucide-react, Sonner, Playwright/e2e, mevcut OpenAPI client.

---

## References

- Approved external prototype: `D:\hr-axis-external-lab\prototypes\store-incentives-turkish-command-v3`
- Production route: `D:\store-ops-workspace\admin-web\src\pages\StoreIncentivesPage.tsx`
- Region manager view: `D:\store-ops-workspace\admin-web\src\pages\store-incentives-region-manager-view.tsx`
- Region manager sheet: `D:\store-ops-workspace\admin-web\src\pages\store-incentives-region-manager-sheet.tsx`
- App root: `D:\store-ops-workspace\admin-web\src\main.tsx`
- Store route registry: `D:\store-ops-workspace\admin-web\src\app\store-route-registry.ts`
- Error copy helper: `D:\store-ops-workspace\admin-web\src\lib\format.ts`
- Store Feed existing local notices: `D:\store-ops-workspace\admin-web\src\pages\StoreFeedPage.tsx`
- UI components: `D:\store-ops-workspace\admin-web\src\components\ui`
- Existing incentive tests:
  - `D:\store-ops-workspace\admin-web\e2e\store-incentives-projection.spec.ts`
  - `D:\store-ops-workspace\admin-web\scripts\store-incentives-money-input.test.mjs`

## Non-Negotiables

- No global notification inbox, no Novu workflow, no approval timeline in this scope.
- Sonner is only for short action feedback: saved, submitted, approved, returned, imported, exported, failed.
- No toast for passive page load, passive refresh, route navigation, field validation, or long explanatory copy.
- Critical decisions still use Dialog/AlertDialog; toast is only result feedback.
- All visible copy is Turkish with correct Turkish characters. ASCII fallback Turkish is not acceptable in product UI.
- Mojibake is a blocking UI defect and must be fixed in any touched user-facing file.
- No raw hex in production TSX.
- Keep current business workflow: incentive formula, company-store-only rule, cashier exclusion, close-state rule, correction/package flow, auth/role/scope.
- Store Manager must not see Region Manager approval controls.
- Prototype parity is required for the incentives page: typography density, button treatment, calendar placement, closed-by-default drawer, Sonner placement, and row states must materially match the approved prototype.
- Existing inline page notices must either be replaced by Sonner or explicitly kept when they provide persistent inline state. Do not show both for the same action.
- Toasts must not overlap right Sheet/Drawer controls or the floating Pilot Feedback control.

## File Contracts

- Create `D:\store-ops-workspace\admin-web\src\components\ui\sonner.tsx`
  - Responsibility: project-local shadcn/Sonner wrapper only.
  - Imports `Toaster` from `sonner`.
- Create `D:\store-ops-workspace\admin-web\src\components\hr-axis-toaster.tsx`
  - Responsibility: one global HR Axis toaster instance and styling contract.
  - Owns position, class names, visible toast count, mobile safe area, drawer offset behavior.
- Create `D:\store-ops-workspace\admin-web\src\lib\action-toast.ts`
  - Responsibility: single app API for action feedback.
  - Expected API:
    ```ts
    import { toast } from 'sonner'
    import { getUserFacingErrorMessage } from './format'

    export const actionToast = {
      success: (message: string) => toast.success(message),
      error: (error: unknown, fallback: string) =>
        toast.error(getUserFacingErrorMessage(error, fallback)),
      info: (message: string) => toast.info(message),
    }
    ```
  - If `toast.promise` is used, expose it here rather than importing Sonner directly in pages.
- Create `D:\store-ops-workspace\admin-web\src\lib\toast-viewport.ts`
  - Responsibility: viewport offset helper for drawer-open routes.
  - Expected API: `useToastViewportOffset(isOffset: boolean): void`.
  - Must clean up body class on unmount.
- Modify `D:\store-ops-workspace\admin-web\src\main.tsx`
  - Responsibility: mount exactly one `HrAxisToaster`.
- Modify page files only at mutation boundaries.
  - Responsibility: call `actionToast` in `onSuccess` / `onError`, not inside API clients.

## Action Feedback Standard

### Toast Types

- `success`: Save, approve, return, submit, pin/unpin, import accepted, export started/download ready, checklist completed, task completed.
- `error`: API or mutation failure. Use existing user-facing error extraction before falling back to a short Turkish message.
- `info`: Reset, reverted to old value, draft cleared, filter reset, no-op informational action.
- `loading`: Only for operations that visibly take time and are initiated by the user. Prefer button loading state for fast actions.

### Copy Rules

- Başarılı kayıt: `Kaydedildi`
- Düzeltme kaydı: `Düzeltme kaydedildi`
- Kontrol işareti: `Kontrol edildi`
- Geri alma: `Eski değere dönüldü`
- Toplu gönderim: `Onaya gönderildi`
- Onay: `Onaylandı`
- İade: `İade edildi`
- Import: `Aktarım başladı` or `Aktarım tamamlandı`
- Export: `Excel indirildi` or `Excel hazırlanıyor`
- Hata: short action-specific message, then existing error detail only if useful.

### Placement

- Desktop default: bottom-right.
- If a right Sheet/Drawer is open: toast shifts left so it does not cover the drawer footer/actions.
- If the floating Pilot Feedback button is visible, toast offset leaves that control clickable.
- Mobile: bottom safe-area, centered/compact, never blocking sticky action footer.

## Where It Must Be Used

### Store Pages

- `/store/incentives`
  - Region Manager: store reviewed, correction saved, correction reverted/voided, package submitted, export removed if not supported.
  - Store Manager/personnel: no approval toast controls; only export/save actions if present.
- `/store/targets`
  - target approval, edit-and-approve, return/reject, target distribution save, filter reset only as info if user explicitly resets.
- `/store/tasks`
  - task completed, resolution note saved, close/reopen action, export/download if present.
- `/store/checklists`
  - draft saved, checklist completed, cancel/dismiss no success toast, low-score task generation result only if backend returns it.
- `/store/feed` / Duyurular
  - post shared, post pinned/unpinned, post edited, post deleted.
  - Replace current `notice` / `errorNotice` banners with Sonner unless the action needs a visible undo affordance.
  - If archive/delete undo remains, use Sonner action `Geri al` or keep the existing inline undo; do not use both.
- `/store/reports`
  - Excel export ready/download started, export failure.
- `/store/workforce`
  - export/download only; no toast for row selection or drawer open.
- `/store/kpis`
  - export/download only; no toast for tab/filter changes.

### Admin Pages

- `/admin/auth`
  - user updated, user deactivated/reactivated, role assignment saved, store/region assignment saved.
- `/admin/master-data`
  - store updated, region assignment saved, store active/passive changed, catalog refresh completed if user initiated.
- `/admin/integrations`
  - upload accepted, import started, retry started, blocked batch acknowledged if action exists.
- `/admin/incentives`
  - package approved, package returned, note saved.
- `/admin/checklists`
  - template saved/published, question edited, threshold changed.
- Other admin pages: add toast only for explicit mutation/export actions, not for navigation or readonly filtering.

---

## PR Plan

## PR1 - Global Action Feedback Foundation

**Purpose:** Add Sonner once and create HR Axis action toast API.

### Tasks

- [x] Confirm route and mutation inventory before editing pages:
  ```powershell
  rg -n "useMutation\\(|setNotice\\(|setErrorNotice\\(|getUserFacingErrorMessage" admin-web/src/pages admin-web/src/features
  ```
  Expected: list includes StoreIncentivesPage, StoreFeedPage, StoreTargetsPage, StoreChecklistsPage, store task controls, AdminFeedPage, AuthDashboardPage, IntegrationDashboardPage, AdminIncentivesPage, master data page.
- [x] Install Sonner in admin web:
  ```powershell
  npm.cmd --prefix admin-web install sonner
  ```
- [x] Verify `admin-web\package.json` and `admin-web\package-lock.json` both include `sonner`.
- [x] Add `D:\store-ops-workspace\admin-web\src\components\ui\sonner.tsx` as a shadcn-style wrapper if the project does not already have one.
- [x] Add `D:\store-ops-workspace\admin-web\src\components\hr-axis-toaster.tsx`.
  - Uses `Toaster`.
  - Position: `bottom-right`.
  - Uses compact rich styling consistent with Store Command surface.
  - Does not include long descriptions by default.
- [x] Add `D:\store-ops-workspace\admin-web\src\lib\action-toast.ts`.
  - Exports `actionToast.success`, `actionToast.error`, `actionToast.info`, `actionToast.promise`.
  - Exports helper `toastErrorFromUnknown(error, fallbackMessage)`.
  - Reuses existing error-message helper if available in the repo.
- [x] Add `D:\store-ops-workspace\admin-web\src\lib\toast-viewport.ts` if needed.
  - Provides `useToastViewportOffset(isSheetOpen)`.
  - Toggles a body class such as `hr-axis-sheet-open`.
  - CSS shifts Sonner left on desktop when a right drawer is open.
  - CSS also accounts for `PilotFeedbackControl` on Store shell.
- [x] Mount `HrAxisToaster` once in `D:\store-ops-workspace\admin-web\src\main.tsx` near `<App />`.
- [x] Add CSS in the wrapper or global stylesheet for:
  - desktop bottom-right,
  - drawer-open offset,
  - mobile safe-area bottom.
- [x] Add a small script test if helper logic is non-trivial.
  - Test `toastErrorFromUnknown` returns fallback for `/api/`, UUID, forbidden, SQL-like, and empty errors.
  - Test it preserves clean business errors such as `Not alanı zorunlu.`

### Verification

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

### Expected Result

- App renders one global toaster.
- No route has duplicated Toaster instances.
- No visible notification appears on initial page load.
- Existing pages still compile before individual mutation migrations begin.

## PR2 - Store Incentives Prototype To Production

**Purpose:** Move the approved Prim Kontrol Sayfası prototype into `/store/incentives` with real data and real mutations.

### Tasks

- [ ] Compare the external prototype files:
  - `D:\hr-axis-external-lab\prototypes\store-incentives-turkish-command-v3\src\App.tsx`
  - `D:\hr-axis-external-lab\prototypes\store-incentives-turkish-command-v3\src\App.css`
- [ ] Update `store-incentives-region-manager-view.tsx` to match the accepted visual structure:
  - Title: `Prim Kontrol Sayfası`
  - Title has a meaningful lucide icon.
  - Smaller heading than the previous oversized command hero.
  - Period selector remains year/month only.
  - Store list width follows current Store shell width, not full browser width.
  - `Dönem paketi` right-side block stays removed.
  - Drawer is closed by default.
  - No approval timeline block.
  - Buttons use lucide icons where useful.
- [ ] Preserve all current real data mapping:
  - store target,
  - realized sales,
  - achievement percent,
  - manager incentive,
  - staff incentive,
  - calculated amount,
  - final amount,
  - correction delta.
- [ ] Keep store states aligned with prototype:
  - `Kontrol edilmeli`: amber/yellow surface.
  - `Kontrol edildi`: mint/cyan success surface.
  - `%80 Aşılmadı`: rose/red surface.
- [ ] Ensure `Kontrol et` updates immediately with optimistic UI and then confirms via toast.
- [ ] Add `useToastViewportOffset(Boolean(selectedRow))` or equivalent while the correction Sheet is open.
- [ ] Keep final incentive input editable in the right sheet.
  - Preserve fixed money-input behavior.
  - Decimal cents are supported.
  - Typing `50000` must not become `5.000000`.
- [ ] Add action toasts:
  - review success: `Kontrol edildi`
  - correction success: `Düzeltme kaydedildi`
  - revert/void success: `Eski değere dönüldü`
  - package submit success: `Onaya gönderildi`
  - mutation failure: action-specific short Turkish error
- [ ] Remove unsupported top-level Excel export button from incentives if backend/export route is not wired.
- [ ] Add or update targeted tests:
  - money input formatting,
  - review optimistic state,
  - drawer default closed,
  - submit dialog/toast behavior where test harness supports it.
- [ ] Add visual evidence checklist to PR description:
  - desktop default page,
  - desktop drawer open,
  - desktop drawer open + toast,
  - mobile drawer/footer + toast.

### Verification

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:scripts
npm.cmd --prefix admin-web run test:e2e -- store-incentives-projection.spec.ts
```

### Expected Result

- `/store/incentives` visually matches the approved prototype materially.
- Region Manager can review, edit final incentive, save with note, revert, and submit.
- Toast appears after each action and does not block drawer controls.
- Prototype parity can be reported as `PASS` only after desktop and mobile inspection.

## PR3 - Apply Action Feedback Standard To High-Value Mutations

**Purpose:** Standardize action result feedback across the pages most used before pilot.

### Tasks

- [ ] For each page below, first map existing success/error UI:
  - `setNotice`, `setErrorNotice`, `Alert`, inline success panels, and button pending states.
  - Keep inline blocking errors for page-level load failures.
  - Convert action-result banners to Sonner.
  - Do not remove undo behavior unless replaced by a Sonner action.
- [ ] `/store/targets`
  - Add toasts for approve, edit-and-approve, return/reject, distribution save.
  - Do not toast filter or tab changes.
- [ ] `/store/tasks`
  - Add toasts for completion, resolution note save, close/reopen.
  - Keep Region Manager readonly flow intact.
- [ ] `/store/checklists`
  - Add toasts for draft save and checklist complete.
  - Do not toast plain cancel.
- [ ] `/store/feed` or Duyurular route
  - Add toasts for post share, edit, delete, pin/unpin.
  - Fix existing mojibake Turkish copy while touching the file, and replace ASCII fallback Turkish with correct Turkish characters.
  - Preserve archive undo behavior.
- [ ] `/store/reports`
  - Add toasts for Excel export success/failure.
- [ ] `/admin/auth`
  - Add toasts for user update, deactivate/reactivate, role/store/region assignment save.
- [ ] `/admin/master-data`
  - Add toasts for store/region updates and active/passive changes.
- [ ] `/admin/integrations`
  - Add toasts for upload accepted, retry started, import failure.
- [ ] `/admin/incentives`
  - Add toasts for package approve/return and note save.
- [ ] `/admin/feed`
  - Add toasts for create, publish, pin/unpin, archive.

### Verification

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:scripts
```

Manual smoke routes:

- `http://localhost:<port>/store/incentives`
- `http://localhost:<port>/store/targets`
- `http://localhost:<port>/store/tasks`
- `http://localhost:<port>/store/checklists`
- `http://localhost:<port>/store/feed`
- `http://localhost:<port>/store/reports`
- `http://localhost:<port>/admin/auth`
- `http://localhost:<port>/admin/master-data`
- `http://localhost:<port>/admin/integrations`
- `http://localhost:<port>/admin/incentives`
- `http://localhost:<port>/admin/feed`

### Expected Result

- Mutating actions have consistent short feedback.
- Readonly browsing stays quiet.
- No duplicate toasts fire for one action.
- Existing inline load errors remain visible where they are needed.
- Existing undoable actions still have a recovery path.

## PR4 - QA, Documentation, And Guardrails

**Purpose:** Lock the standard so future pages do not invent separate notification behavior.

### Tasks

- [ ] Add a short section to `.agents/skills/hr-axis-ui-refactor/SKILL.md` or a process doc:
  - Use global action toast for mutation results.
  - Do not create page-local toast systems.
  - Do not use toast for passive loads/filters/navigation.
  - Keep copy short and Turkish with correct Turkish characters.
- [ ] Add a checklist to the UI migration docs:
  - explicit mutation,
  - success toast,
  - error toast,
  - no duplicate toast,
  - drawer/mobile overlap checked.
- [ ] Run broad checks.
- [ ] Capture evidence screenshots for:
  - incentives desktop drawer open + toast,
  - incentives mobile drawer/footer + toast,
  - one admin mutation toast,
  - one store mutation toast.
- [ ] Search for direct Sonner imports outside allowed wrapper/helper:
  ```powershell
  rg -n "from 'sonner'|from \"sonner\"" admin-web/src
  ```
  Expected: only `components/ui/sonner.tsx`, `components/hr-axis-toaster.tsx`, and `lib/action-toast.ts` import from Sonner.
- [ ] Search for leftover local success notices on migrated pages:
  ```powershell
  rg -n "setNotice\\(|setErrorNotice\\(|successNotice|errorNotice" admin-web/src/pages admin-web/src/features
  ```
  Expected: only page-level load/blocking errors or deliberately retained undo UI remain.

### Verification

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:scripts
npm.cmd --prefix admin-web run check:release
```

### Expected Result

- Notification standard is documented.
- Pilot-critical pages use the same feedback language.
- No drawer/mobile overlap regression remains.

---

## Implementation Notes

- Prefer adding toast calls in mutation `onSuccess` / `onError` handlers, not inside low-level API clients.
- If a mutation already has optimistic UI, keep it. Toast confirms backend success; it should not be the only sign that the UI changed.
- If a button already has `isPending`/spinner state, keep it. Do not add a loading toast for fast mutations unless there is a real wait.
- Use existing `invalidateQueries` behavior after success. Do not add polling or full-page refresh.
- Keep route copy operational. Avoid internal terms such as API, DB, scope, mock, contract, gerçek veri.
- UI text must use correct Turkish characters. Do not ship ASCII fallback Turkish or mojibake in labels, buttons, badges, toasts, empty states, error states, sheet/dialog copy, or table headers.
- Do not migrate page-level load failures into toast. A user who lands on a broken page needs a stable inline error state and retry action.
- Keep prototype translation narrow: do not change incentive formulas, sales import, close calculations, permissions, or admin approval semantics.

## Risks And Mitigations

- **Risk:** Toasts become noisy across pages.
  - **Mitigation:** Only explicit user-triggered mutations get toasts.
- **Risk:** Toast overlaps right sheet actions.
  - **Mitigation:** Add drawer-open viewport offset and mobile safe-area rules in PR1, verify in PR2.
- **Risk:** Toast overlaps Pilot Feedback control.
  - **Mitigation:** Include Store shell floating control in the viewport offset and verify on Store pages.
- **Risk:** Replacing inline notices removes undo behavior.
  - **Mitigation:** Convert undoable actions to Sonner action toasts or keep the inline undo and document why.
- **Risk:** Mojibake Turkish copy remains while adding toasts.
  - **Mitigation:** Fix visible mojibake in touched action surfaces, especially Store Feed, as part of PR3.
- **Risk:** Incentives prototype parity drifts again.
  - **Mitigation:** Treat the external prototype as implementation contract and compare desktop/mobile before PR closeout.
- **Risk:** Error messages expose internal details.
  - **Mitigation:** Use short Turkish fallback and existing user-facing error mapper.
- **Risk:** Adding Sonner globally creates duplicate bundles or duplicated toasters.
  - **Mitigation:** One `HrAxisToaster` in app root; no page-local `Toaster`.

## Final Acceptance Criteria

- Global HR Axis action feedback exists and is mounted once.
- `/store/incentives` Region Manager page matches the accepted Prim Kontrol Sayfası prototype in visible structure and behavior.
- All new or touched visible UI copy uses correct Turkish characters.
- Review/save/revert/submit actions show consistent Sonner feedback.
- Pilot-critical store/admin mutation pages use the same action feedback standard.
- Mobile and desktop toasts do not block drawer or sticky footer controls.
- Lint, build, script tests, targeted e2e, and release check pass in the relevant PRs.
