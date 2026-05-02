# Store UX TR-First Copy V1

Date: 26 April 2026

## Purpose

Store-facing screens should feel like the mağaza kullanıcı alanı, not a translated admin report shell. This pass reduces the most visible mixed-language roughness before deeper product and visual design work.

## Decision

Do a narrow, user-visible copy rollout first:

- Store shell chrome
- Store home preview
- Store task queue
- Store feed and pinned announcement preview
- Workflow inbox row details and action labels

Keep backend contracts, API enum values, audit codes, score logic, and workflow state machines unchanged.

## Implemented

- Store shell header now uses Turkish-first chrome:
  - `Mağaza alanı`
  - `Mağaza kapsamlı işler için görev odaklı ön izleme.`
  - `Gerçek giriş`, `Admin raporları`, `Duyurular`, `Yarışmalar`
- Store home preview now explains routes, pinned announcements, KPI/checklist/approval ownership, and admin boundaries in Turkish-first product language.
- `/store/tasks` now uses Turkish-first queue language:
  - `Aksiyon gerektiren işler`
  - `Aksiyon bekleyenler`
  - `Yüksek öncelik`
  - `Kuyruk bağlamı`
  - `Bugünün kuyruğu`
  - `İş tipi`
  - `Aksiyon zamanı`
- Workflow inbox detail labels now use readable Turkish:
  - `Detay özeti`
  - `Zaman sinyali`
  - `Yükseltme`
  - `Kaynak aksiyonu`
- Source action labels now render as store-readable actions:
  - `KPI detayına git`
  - `Sapmayı incele`
  - `Checklist sonucunu aç`
  - `Talebi onayla`
- Store feed now uses Turkish-first labels for visible announcements, pinned posts, challenge windows, metric, destination, and empty state.

## Boundaries

- No backend endpoint changed.
- No DB schema or migration changed.
- No audit/status/enum code changed.
- No scoring or ranking math changed.
- No full visual redesign was attempted.
- This is not full bilingual localization coverage for every admin and store screen yet; it is the first store-facing copy hardening pass.

## CODEX Honest View

This was worth doing now. Mixed English/Turkish copy on store screens is not only cosmetic; it creates trust debt for real mağaza users because the system feels unfinished even when the data model is improving.

The right boundary was not to redesign the entire UI or translate every admin module in one sweep. That would be a new debt risk. This pass makes the most visible store surfaces more coherent while keeping future full EN/TR localization and visual redesign as planned investments, not rushed patches.

## Verification

Targeted checks run during implementation:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run build
npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store shell exposes Turkish-first chrome|store tasks page renders readable Turkish queue labels"
npm.cmd run test:e2e -- e2e/feed-surfaces.spec.ts -g "store feed renders pinned challenge posts with ranking link|store home shows pinned feed preview"
```

Full release verification:

```powershell
cd "<workspace-root>"
npm.cmd run check:release
```

Result:

- root script tests: 9 passed.
- backend release: lint, 32 Jest suites / 248 tests, build, `npm audit --omit=dev`.
- frontend release: lint, script tests, build, 25 Playwright tests, `npm audit --omit=dev`.
- audit result: 0 vulnerabilities.

## Next Logical Step

Plan the production UI/design-system pass before changing visuals broadly. The current screens are functionally stronger, but they are still working drafts; a later design pass should handle layout density, colors, typography, mobile polish, and complete EN/TR localization as one coordinated product layer.
