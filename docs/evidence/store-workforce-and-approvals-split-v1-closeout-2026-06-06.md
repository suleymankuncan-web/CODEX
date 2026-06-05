# Store Workforce And Approvals Split V1 Closeout

Date: 2026-06-06

## Shipped PRs

| Slice | PR | Merge | Outcome |
| --- | --- | --- | --- |
| PR-1 Contract matrix | #655 | `1f3b651f` | Locked route, role, data-source, prototype, non-goal, and stop-condition evidence before runtime work. |
| PR-2 Route foundation | #656 | `d48ba5e0` | Added `/store/workforce`, sidebar `Norm Kadro`, and frontend route/sidebar gating using existing role and store assignment data only. |
| PR-3 Store Manager workforce | #657 | `c01b707c` | Implemented the Store Manager workforce view, personnel list, position/tenure summaries, seller-code/offboarding creation, and returned-request correction handoff. |
| PR-4 Region Manager workforce | #658 | `27ccd41c` | Implemented the Region Manager workforce view with scoped store rows, in-page `Detay ac` dialog/drawer model, and honest unavailable states for missing aggregate/detail contracts. |
| PR-5 Approvals request center | #659 | `f6cfb17e` | Converted `/store/approvals` to `Talep Merkezi`; creation lives in owning surfaces, returned workforce corrections hand off to `/store/workforce`, and target work hands off to `/store/targets`. |
| PR-6 Final closeout | this PR | pending | Runs final old-UI/copy/route consistency scans, records closeout evidence, and updates current-state. |

## Runtime Surfaces

- `/store/workforce` is live as `Norm Kadro`.
- Store Manager mode reads only assigned/action-store data and keeps seller-code/offboarding request creation and returned correction flows available.
- Region Manager mode reads only authorized read-scope store rows, opens store detail in the same page, and does not render `Magazaya git`.
- `/store/approvals` is now a request-status center with `Acik / Bekleyen` and `Tamamlanan` tabs, max 15 visible rows per page, pagination, and product-language handoff actions.
- `/store/targets` remains the target distribution and target revision owner.

## Contract And Behavior Impact

Contract Impact: intentionally unchanged.

The PR line did not change:

- API response shape,
- DB schema or migrations,
- auth/permission semantics,
- target distribution lifecycle,
- seller-code request lifecycle,
- offboarding request lifecycle,
- scoring, KPI, ranking, checklist weight, or snapshot interpretation,
- BullMQ/import/provider behavior.

## Prototype And Visual Evidence

Locked prototypes:

- `docs/prototypes/store-workforce-prototype-v1.html`
- `docs/prototypes/store-approvals-request-center-v1.html`

Evidence:

- PR-3 Store Manager workforce: `docs/evidence/store-workforce-and-approvals-split-pr3-store-manager-2026-06-05.md`
- PR-4 Region Manager workforce: `docs/evidence/store-workforce-and-approvals-split-pr4-region-manager-2026-06-05.md`
- PR-4 visual QA screenshots: `docs/evidence/store-workforce-and-approvals-split-pr4-region-manager-visual-qa-2026-06-05/`
- PR-5 approvals: `docs/evidence/store-workforce-and-approvals-split-pr5-approvals-2026-06-05.md`
- PR-5 desktop screenshot: `docs/evidence/store-workforce-and-approvals-split-pr5-approvals-desktop-2026-06-05.png`
- PR-5 mobile screenshot: `docs/evidence/store-workforce-and-approvals-split-pr5-approvals-mobile-2026-06-05.png`

## Final Consistency Scan

PR-6 scan scope:

- Store workforce and approvals runtime files.
- Store shell/sidebar route visibility files.
- Relevant Store Playwright specs.
- User-facing copy for the new workforce/approvals split.

Findings:

- No old `dashboard-primitives`, old Store command shell copy, legacy creation workbench copy, or fake data additions were found in the shipped workforce/approvals split.
- The broad scan produced expected false positives in code identifiers such as `scopeTitle`, `scopeStoreIds`, route mocks, and E2E fixture fields. Those are internal model/test names, not user-facing copy.
- English user-facing `scope/action-scope` wording in the new workforce/approvals split was cleaned to product language such as `coverage`, `view`, `request area`, `assigned store`, and `authorized access`.
- Turkish `kapsam` remains where it is intentional product language for personnel/store coverage.

## Parked Risks

- Region Manager workforce aggregate/detail data remains intentionally honest-unavailable until a safe read contract exists for regional personnel totals, tenure, position mix, and request movements.
- Norm target completion remains honest-unavailable where the frontend does not have a verified completed Store norm contract.
- Future richer workforce analytics must start with a read-contract plan and tests; it must not be inferred from browser-side unbounded Store Manager endpoints.

## Verification

Local PR-6 verification:

- `npm.cmd --prefix admin-web run lint`: pass.
- `npm.cmd --prefix admin-web run build`: pass.
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store workforce|store approvals page"`: pass, 19/19.
- `npm.cmd run test:scripts`: pass, 406/406.
- `git diff --check`: pass.

Remote merge gate:

- GitHub/Vercel checks must be green.
- Codex review channels must be clean or explicitly approved according to `discipline.md`, including a latest bot thumbs-up reaction on the PR summary/comment when no actionable review comment exists.
