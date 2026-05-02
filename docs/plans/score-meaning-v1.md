# Score Meaning V1

## Purpose

Make the weighted score understandable for store users without changing score math, KPI weights, or backend contracts.

## Decision

Score Meaning V1 is a frontend interpretation layer over the existing grade result.

It does not:

- change the score formula
- change grading band thresholds
- create a new DB table
- create a new config schema
- turn KPI into workflow by itself

It does:

- convert grade code into a short business-language interpretation
- show whether the interpretation is based on complete or partial metric coverage
- explain the next focus in store-user language
- keep the source distinction visible: live period vs closed snapshot

## Implemented Scope

Files:

- `admin-web/src/features/kpi/grading.ts`
- `admin-web/src/pages/StoreMyPerformancePage.tsx`
- `admin-web/e2e/store-surfaces.spec.ts`

Added:

- `PerformanceScoreMeaning`
- `resolvePerformanceScoreMeaning`
- `/store/me` panel labelled `Skor yorumu`
- visible confidence text such as `Veri guveni: 3/3 metrik skorlandi.`
- Playwright coverage for the score interpretation panel

## Grade Meaning V1

The first language set is intentionally simple:

- `A`: Guclu performans
- `B`: Saglikli performans
- `C`: Takip gerekli
- `D`: Kritik takip

If the score is partial, the meaning keeps the same grade direction but downgrades the trust tone to warning and labels the interpretation as preview-like.

## CODEX DURUST YORUM

This is the right size for V1.

We should not move score meaning into backend or DB until HR/Admin needs editable grade language, effective dates, or versioned business interpretation. For now, the product needed clarity more than configurability.

The next risk is metric source trust. A user will soon ask: "This UPT or ATV number came from where, and is it imported, derived, checklist-fed, or still pending?" That should be the next local investment before expanding the score rules.

## Verification

- RED observed: Playwright self-performance test failed because `Skor yorumu` did not exist.
- GREEN observed: `npm.cmd run build; npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "self-performance"` passed.
- Official root release gate passed: `npm.cmd run check:release`.
