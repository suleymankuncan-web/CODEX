# Store Page QA Contract V1 Evidence

Status: guarded

## Purpose

This folder records how Store Page QA Contract V1 is verified before PRs that
touch `/store/*` pages. It is release evidence for the automated contract gate,
not a replacement for staging persona smoke when real provider behavior is in
scope.

## Required Local Gate

Run these commands before opening a PR that touches a store page:

```bash
npm.cmd run test:scripts
npm.cmd run test:e2e:store-contracts
```

For release-bound store surface work, also run the relevant focused Playwright
spec and the normal release check required by the changed files.

## Coverage Mode

| Coverage class | Mode | Evidence |
| --- | --- | --- |
| Generic store route health | Mocked contract coverage | `store-page-contracts.spec.ts` derives routes from `store-route-registry.ts` and checks allowed persona access, forbidden states, page errors, horizontal overflow, UUID/internal id leaks, and internal/debug copy. |
| Checklist, rankings and KPI surfaces | Mocked contract coverage | `store-checklists-contracts.spec.ts`, `store-rankings-contracts.spec.ts`, and `store-kpis-contracts.spec.ts` lock the high-risk filters, ranking/profile alignment, checklist BM/VM visibility, and score-source rows. |
| Incentives, targets and workforce surfaces | Mocked contract coverage | `store-incentives-contracts.spec.ts`, `store-targets-contracts.spec.ts`, and `store-workforce-contracts.spec.ts` lock review/edit surfaces, month/year controls, workforce row behavior, and core role boundaries. |
| Tasks, feed, reports, home, Store Me and personnel surfaces | Mocked contract coverage | `store-tasks-contracts.spec.ts`, `store-feed-contracts.spec.ts`, `store-reports-contracts.spec.ts`, `store-home-contracts.spec.ts`, `store-me-contracts.spec.ts`, and `store-personnel-contracts.spec.ts` lock remaining store workflows and persona boundaries. |
| Staging provider behavior | Live/staging coverage | Use the existing staging auth and persona smoke commands when Clerk/session/provider behavior changes. The store contract suite does not prove provider availability. |
| Real production data quality | Intentionally deferred | The contract suite uses stable fixtures. It does not prove Nebim feed quality, live Supabase row completeness, or pilot roster reconciliation unless a live/staging smoke is run and recorded separately. |

## Current Contract Scope

The `test:e2e:store-contracts` script must include every store contract spec:

- `store-page-contracts.spec.ts`
- `store-checklists-contracts.spec.ts`
- `store-rankings-contracts.spec.ts`
- `store-kpis-contracts.spec.ts`
- `store-incentives-contracts.spec.ts`
- `store-targets-contracts.spec.ts`
- `store-workforce-contracts.spec.ts`
- `store-tasks-contracts.spec.ts`
- `store-feed-contracts.spec.ts`
- `store-reports-contracts.spec.ts`
- `store-home-contracts.spec.ts`
- `store-me-contracts.spec.ts`
- `store-personnel-contracts.spec.ts`

The script contract test guards this list so new store contract specs are not
left outside the PR preflight command.

## Language And Copy Guard

Store QA docs and new contracts must keep Turkish characters intact:

- Türkiye Sıralaması
- KPI Özetleri
- Görevler
- Dönem gönderimi
- Kontrol edildi

Visible product pages should not show UUID/internal ids, debug copy, or
implementation terms such as API, DB, scope, mock, contract, or evidence.

