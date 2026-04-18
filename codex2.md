# Codex Session Snapshot 2

Bu dosya, `2026-04-17` tarihli backend çalışma oturumunun özetini ve mevcut mimari yönünü kaydeder.

## Mimari Çerçeve

- Uygulama: mağaza operasyonu / denetim / iş gücü / KPI / raporlama platformu
- Mimari: NestJS modular monolith + PostgreSQL
- Şema ayrımı:
  - `ops`: operasyonel veri
  - `stg`: staging / integration ingestion
  - `rpt`: immutable reporting snapshots
  - `audit`: audit log ve değişim izleri
- Büyük işler async tasarlanır
- Reporting yalnızca `rpt.*` üzerinden okunur
- Entegrasyon verisi önce `stg.*` içine düşer, sonra materialize edilir

## Bu Oturumda Tamamlanan Ana İşler

### 1. Materialization validation hardening

- satır bazlı validation / retry semantiği eklendi
- batch final status:
  - `completed`
  - `completed_with_errors`
  - `failed`
- raw row status:
  - `processed`
  - `validation_failed`
  - `retryable_error`

### 2. BullMQ worker process

- worker host eklendi
- worker-only bootstrap eklendi
- snapshot üretimi worker-safe hale getirildi
- `start:workers` script’i eklendi

### 3. İlk gerçek integration test dalgası

- test harness kuruldu
- integration coverage açıldı:
  - import batch
  - snapshot run
  - auth scope
  - checklist flow

### 4. Reporting read API’leri

- eklendi:
  - `GET /api/reports/snapshot-runs`
  - `GET /api/reports/workforce`
  - `GET /api/reports/kpis`
  - `GET /api/reports/checklists`
  - `GET /api/reports/turnover`
  - `GET /api/reports/summary`
- tüm liste endpoint’leri için:
  - `limit`
  - `offset`
  - `meta.count`
  - `meta.total`

### 5. Assignment history import

- ayrı entity type olarak tasarlandı:
  - `entityType=assignment`
- eklendi:
  - `stg.assignment_raw`
  - assignment materialization
  - `ops.employee_assignment_history` upsert
  - assignment mapping writeback

### 6. Import batch operational read APIs

- eklendi:
  - `GET /api/integrations/import-batches/:batchId`
  - `GET /api/integrations/import-batches/:batchId/errors`
- batch detail:
  - `recordCount`
  - `errorCount`
  - `rowStatusSummary`
- error list:
  - pagination
  - normalized status
  - validation error

### 7. External ID mapping netleştirmesi

- `stg.external_id_map` kanonik mapping registry olarak sabitlendi
- shared service eklendi:
  - `ExternalIdMappingService`
- mapping lookup ve upsert mantığı merkezileştirildi

### 8. Position import desteği

- yeni entity type:
  - `entityType=position`
- eklendi:
  - `stg.position_raw`
  - position materialization -> `ops.position`
  - successful write sonrası `position` mapping writeback

### 9. Import observability derinleştirme

- batch detail içine eklendi:
  - `dependencySummary`
  - `blockedByEntityTypes`
  - `recommendedImportOrder`
- error endpoint içine eklendi:
  - `errorCategory`

## Import Observability Contract

### `GET /api/integrations/import-batches/:batchId`

Dönüş artık şunları içerir:

- `batch`
- `rowStatusSummary`
- `dependencySummary`
- `blockedByEntityTypes`
- `recommendedImportOrder`

### `GET /api/integrations/import-batches/:batchId/errors`

Her hata satırı artık şunları içerir:

- `rowId`
- `sourceRef`
- `normalizedStatus`
- `errorCategory`
- `validationError`
- `processedAt`

### `errorCategory`

- `validation`
- `missing_dependency`
- `write_failure`

### `recommendedImportOrder`

Şu anki sabit contract:

1. `company`
2. `region`
3. `store`
4. `position`
5. `employee`
6. `assignment`
7. `kpi`

## Test ve Build Durumu

Son doğrulama:

- `npm test -- --runInBand` geçti
- `npm run build` geçti
- toplam:
  - `8` test suite
  - `24` test

## Çalışma Prensibi

Bu projede izlenen ana kurallar:

- yeni modül eklenebilir olmalı
- veri sınırları karışmamalı
- dependent import’lar reference import kontratına bağlı kalmalı
- operational ve reporting dünyası ayrık kalmalı
- test-first ilerlenmeli
- completion claim öncesi taze test/build doğrulaması alınmalı

## Sonraki Mantıklı Adımlar

Şu noktadan sonra backend için en mantıklı adaylar:

1. import batch detail içine:
   - `recommendedNextEntityType`
   - `canRetryNow`
2. reference import policy’yi `company` / `region` için de kod seviyesine taşıma
3. import dependency graph’i daha açık hale getirme
4. opsiyonel olarak import admin/reporting ekranlarını besleyecek ek API summary yüzeyleri

## Otonom Çalışma Promptu

Uzun otonom çalışma için kullanılabilecek prompt:

`Mimariyi koruyarak backend üzerinde otonom ilerle. Her turda en mantıklı sonraki adımı sen seç, uygula, test et, build al, sonra bir sonraki adıma geç. Sadece ürün kararı gerektiren, riskli mimari sapma gerektiren veya çelişkili bir durum çıkarsa durup sor. Her önemli adımın başında kullandığın skill’i açık yaz.`
