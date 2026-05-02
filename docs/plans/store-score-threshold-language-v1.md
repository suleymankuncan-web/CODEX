# Store Score Threshold Language V1

Date: 26 April 2026

## Purpose

Store weighted score degerinin kullaniciya ne anlattigini aciklamak.

Bu is score hesaplamasini, grading threshold degerlerini veya backend contract'i degistirmez. Mevcut store score ve grade sonucunu is diline cevirir.

## Scope

V1 kapsaminda `/store/kpis` yuzeyine `Store skor yorumu` paneli eklendi.

Panel sunlari gosterir:

- score bandi
- skor yuzdesi
- kapsanan agirlik
- aksiyon dili
- skor guveni

## Threshold Language

Grade dilinin store yorumu:

- `A`: `Guclu store skoru`
- `B`: `Saglikli store skoru`
- `C`: `Store takip bandi`
- `D`: `Kritik store skoru`

Coverage eksikse yorum daha dusuk guvenli kabul edilir ve `on izleme` olarak anlatilir.

## Implementation

Frontend helper:

- `admin-web/src/features/kpi/grading.ts`
  - `StoreScoreThresholdMeaning`
  - `resolveStoreScoreThresholdMeaning`

Baglanan yuzey:

- `admin-web/src/pages/StoreKpiHighlightsPage.tsx`

Koruyan test:

- `admin-web/e2e/store-surfaces.spec.ts`

## Boundaries

Bu V1 sunlari yapmaz:

- backend endpoint degistirmez
- DB schema veya migration eklemez
- grading threshold degerlerini degistirmez
- action/task uretmez
- KPI config effective-date, rollback veya interpretation versioning eklemez

## Verification

Kirmizi test izlendi:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store KPI highlights"
```

Ilk kosuda test `Store skor yorumu` bulunamadigi icin fail verdi.

Hedefli yesil dogrulama:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run build; if ($LASTEXITCODE -eq 0) { npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store KPI highlights" }
```

Sonuc:

- frontend build gecti
- 1 Playwright test gecti

## CODEX DÜRÜST YORUM

Bu panel dogru yerde duruyor: skoru hesaplayan motor degil, skoru kullaniciya anlatan katman.

Risk su: ileride threshold dili config version olmadan degisirse, gecmis ekranlarda "o gun bu skor boyle mi yorumlaniyordu" sorusu dogar. Bu nedenle V1 yeterli ama nihai degil. Bir sonraki olgunluk adimi, KPI config governance veya interpretation versioning tarafinda bu yorum dilini tarih/version bilgisiyle iliskilendirmek olmali.
