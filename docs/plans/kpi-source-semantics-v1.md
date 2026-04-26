# KPI Source Semantics V1

Date: 26 April 2026

## Purpose

Kullanicinin KPI satirinda gordugu degerin ne tur bir kaynaktan geldigini aciklamak.

Bu is skor hesaplamasini degistirmez. Sadece mevcut metrik satirlarina guven dili ekler.

## Scope

V1 kapsaminda iki store yuzeyi guclendirildi:

- `/store/me`: personel metrik satirlari
- `/store/kpis`: store weighted-score katkisi ve dikkat gerektiren KPI satirlari

Her metrik icin sunlar gorunur:

- `Kaynak tipi`
- `Veri kaynagi`

## Source Types

V1 kaynak tipleri:

- `Imported operational data`: operasyon veya satis kaynagindan gelen reported KPI degeri
- `Derived score signal`: hedef ve gerceklesen performanstan turetilen skor sinyali
- `Checklist-fed`: checklist sonucundan beslenen compliance katkisi
- `Pending normalization`: deger geldi, score icin normalizasyon bekliyor
- `Missing`: metrik icin kullanilabilir veri yok

## Implementation

Frontend helper:

- `admin-web/src/features/kpi/source-semantics.ts`

Baglanan yuzeyler:

- `admin-web/src/pages/StoreMyPerformancePage.tsx`
- `admin-web/src/pages/StoreKpiHighlightsPage.tsx`

Koruyan test:

- `admin-web/e2e/store-surfaces.spec.ts`

## Boundaries

Bu V1 sunlari yapmaz:

- backend contract degistirmez
- DB schema veya migration eklemez
- score formulu degistirmez
- KPI config governance veya interpretation versioning eklemez
- gercek external source lineage id'si tutmaz

Gercek connector ve batch/job metadata gelince bu presentation-only helper, API tarafindan gelen daha net source metadata ile beslenebilir.

## Verification

Kirmizi test izlendi:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "self-performance|store KPI highlights"
```

Ilk kosuda iki test `Veri kaynagi` bulunamadigi icin fail verdi.

Hedefli yesil dogrulama:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run build; if ($LASTEXITCODE -eq 0) { npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "self-performance|store KPI highlights" }
```

Sonuc:

- frontend build gecti
- 2 Playwright test gecti

## CODEX DÜRÜST YORUM

Bu dogru bir V1. Cunku kullanicinin guven sorusunu cozerken henuz olmayan connector/source-lineage altyapisini uydurmuyor.

En buyuk risk, ileride bu etiketlerin "gercek kaynak metadata'si" sanilmasi olur. O yuzden sinir net: bugunku hali presentation-only semantics. Gercek import connector, batch id, source system ve rule/config version bilgisi geldikce bu helper backend metadata ile beslenmeli.

Kararim: devam. Bu is borc degil; kontrollu bir urun guven katmani.
