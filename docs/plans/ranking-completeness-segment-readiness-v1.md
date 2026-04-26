# Ranking Completeness Segment Readiness V1

Date: 26 April 2026

## Purpose

The closed ranking surface already supports daily and monthly rankings, Turkey rank, store rank, and KPI mini-ranks. This step makes that readiness explicit for store users.

The goal is to show which ranking scopes are usable now and which future segment/challenge formats can build on the same closed snapshot model.

## Scope

Added to `/store/rankings`:

- `Siralama kapsam olgunlugu`
- Turkey-wide readiness
- store-level readiness
- metric mini-rank readiness
- segment readiness note

The panel explains:

- Turkey and store ranks come from the same closed snapshot source.
- KPI mini-ranks can support future UPT, ATV, or target-achievement focus challenges.
- Future region, challenge, or metric segments should attach as scope rules, not as a second ranking engine.

## Implementation

Frontend:

- `admin-web/src/pages/StoreRankingsPage.tsx`
  - derives readiness from the existing `ClosedLeaderboardSummary`
  - uses current employee rank populations, metric rank availability, source state, and official/preview status
  - adds a read-only panel without changing ranking behavior

Test:

- `admin-web/e2e/store-surfaces.spec.ts`
  - protects the visible ranking readiness panel
  - proves Turkey, store, metric mini-rank, and segment readiness labels appear on `/store/rankings`

## Boundaries

No backend change.

No API contract change.

No DB schema change.

No migration.

No score formula change.

No new ranking engine.

No region league implementation.

No tournament or reward behavior.

This is a clarity layer over the existing closed ranking read model.

## Verification

Red test:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store rankings page renders closed leaderboard and metric mini-ranks"
```

Result:

- failed because `Siralama kapsam olgunlugu` did not exist yet

Targeted green verification:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run build
npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store rankings page renders closed leaderboard and metric mini-ranks"
```

Result:

- build passed
- targeted Playwright ranking smoke passed

Official root release verification:

```powershell
cd "<workspace-root>"
npm.cmd run check:release
```

Result:

- root script tests passed: 9/9
- backend release passed: lint, 32 test suites / 248 tests, build, `npm audit --omit=dev`
- frontend release passed: lint, script tests 7/7, build, 24 Playwright tests, `npm audit --omit=dev`

## CODEX DURUST YORUM

This is a good step because it does not confuse readiness with overbuilding.

The system already has enough ranking shape for total score and metric-focused contests to be explained. The dangerous move would be creating region leagues, challenge leaderboards, and segment engines before we decide their exact business rules.

This panel tells the truth: the ranking foundation is usable, segment-friendly, and still intentionally not a full tournament product.

## Next Logical Step

If staging IdP values are available, run guarded staging action evidence.

If not, the next local product candidate is Shared Inbox maturity: detail views, due dates, escalation, and stronger source actions.
