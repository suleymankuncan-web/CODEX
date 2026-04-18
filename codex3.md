# Codex Session Snapshot 3

Bu dosya, `2026-04-17` tarihli otonom backend ilerleyişinin ikinci büyük özetini kaydeder.

## Genel Yön

Amaç, mağaza operasyonu / workforce / KPI / checklist / reporting platformunun backend çekirdeğini büyüyebilir ve operasyonel olarak yönetilebilir hale getirmektir.

Mimari çerçeve korunmuştur:

- NestJS modular monolith
- PostgreSQL
- veri ayrımı:
  - `ops`
  - `stg`
  - `rpt`
  - `audit`
- async heavy işler queue/worker ile
- reporting sadece `rpt.*`
- integration her zaman önce `stg.*`

## Önceki Durumdan Devralınan Ana Yapı

Bu oturum öncesinde zaten şunlar vardı:

- materialization validation hardening
- BullMQ worker process
- ilk gerçek integration test dalgası
- reporting read API’leri
- assignment import
- import batch detail / error API’leri
- external ID mapping service
- position import
- import observability:
  - `dependencySummary`
  - `blockedByEntityTypes`
  - `recommendedImportOrder`
  - `recommendedNextEntityType`
  - `canRetryNow`

## Bu Otonom Blokta Yapılan Yeni İşler

### 1. Reference import zinciri genişletildi

Yeni entity import desteği tamamlandı:

- `company`
- `region`

Eklenen staging tablolar:

- `stg.company_raw`
- `stg.region_raw`

Materialization hedefleri:

- `ops.company`
- `ops.region`

Bu sayede reference import sırası gerçekten backend davranışına bağlandı:

1. `company`
2. `region`
3. `store`
4. `position`
5. `employee`
6. `assignment`
7. `kpi`

### 2. Store / Employee / Position / KPI importları mapping-aware hale getirildi

Artık sadece direct internal UUID ile değil, external mapping çözümleme ile ilerleyebiliyorlar.

Güçlenen akışlar:

- `store` -> company + region mapping çözümleyebiliyor
- `employee` -> company mapping çözümleyebiliyor
- `position` -> company mapping çözümleyebiliyor
- `kpi` -> store / employee / scope dependency çözümleyebiliyor

### 3. KPI scope guard eklendi

KPI import tarafında daha doğru semantik geldi:

- store-scope KPI için store reference çözülmeli
- employee-scope KPI için employee reference çözülmeli

Aksi durumda satır `retryable_error` olarak bırakılıyor.

### 4. Import batch listing endpoint eklendi

Yeni endpoint:

- `GET /api/integrations/import-batches`

Desteklenen filtreler:

- `status`
- `entityType`
- `sourceCode`
- `startedFrom`
- `startedTo`
- `limit`
- `offset`

Liste response artık operasyon ekranı besleyebilecek seviyede:

- `batchId`
- `integrationSourceId`
- `sourceCode`
- `sourceName`
- `entityType`
- `startedAt`
- `finishedAt`
- `status`
- `fileReference`
- `recordCount`
- `errorCount`
- `retryCount`
- `lastRetriedAt`

### 5. Import batch summary endpoint eklendi

Yeni endpoint:

- `GET /api/integrations/import-batches/summary`

Bu endpoint filtreleri destekler ve toplamları döndürür:

- `all`
- `completed`
- `failed`
- `completedWithErrors`
- `pending`
- `queued`
- `processing`

### 6. Controlled retry / requeue endpoint eklendi

Yeni endpoint:

- `POST /api/integrations/import-batches/:batchId/retry`

Semantik:

- unresolved dependency varsa retry etmez
- retryable row yoksa retry etmez
- retryable status değilse retry etmez
- uygun batch ise queue’ya geri yollar

Bu sayede retry işlemi kontrolsüz değil, operasyonel olarak anlamlı hale geldi.

### 7. Retry tracking eklendi

`stg.import_batch` genişletildi:

- `retry_count`
- `last_retried_at`

Migration:

- `db/migrations/006_import_batch_retry_tracking.sql`

Bu alanlar list/detail response’larına taşındı.

### 8. Retry audit log eklendi

Retry çağrısı artık `audit.event_log` içine event yazar:

- `import_batch.retried`

### 9. Import batch audit read endpoint eklendi

Yeni endpoint:

- `GET /api/integrations/import-batch-audit/:batchId`

Bu endpoint batch’e ait audit event geçmişini döndürür:

- `eventLogId`
- `occurredAt`
- `actorUserId`
- `eventType`
- `metadata`

### 10. Source metadata response’lara eklendi

Import batch list/detail yüzeyi artık yalnızca source ID ile değil, insan okunur source bilgisiyle döner:

- `sourceCode`
- `sourceName`

## Şema / Migration Ekleri

Bu blokta eklenen migration dosyaları:

- `db/migrations/005_company_region_import_support.sql`
- `db/migrations/006_import_batch_retry_tracking.sql`

Şemaya eklenen veya genişletilen önemli alanlar:

- `stg.company_raw`
- `stg.region_raw`
- `stg.import_batch.retry_count`
- `stg.import_batch.last_retried_at`

## Import Operasyon Contract Özeti

### Liste

`GET /api/integrations/import-batches`

Amaç:

- son batch’leri listelemek
- status / entity / source / zaman bazlı filtrelemek

### Summary

`GET /api/integrations/import-batches/summary`

Amaç:

- operasyon sağlığı için hızlı sayaçlar

### Detail

`GET /api/integrations/import-batches/:batchId`

Ek görünürlük:

- `dependencySummary`
- `blockedByEntityTypes`
- `recommendedImportOrder`
- `recommendedNextEntityType`
- `canRetryNow`
- `retryCount`
- `lastRetriedAt`

### Errors

`GET /api/integrations/import-batches/:batchId/errors`

Ek görünürlük:

- `errorCategory`

Kategori seti:

- `validation`
- `missing_dependency`
- `write_failure`

### Retry

`POST /api/integrations/import-batches/:batchId/retry`

Amaç:

- uygun batch’i controlled şekilde requeue etmek

### Audit

`GET /api/integrations/import-batch-audit/:batchId`

Amaç:

- batch’in audit geçmişini okumak

## Test ve Build Durumu

Son doğrulama:

- `npm test -- --runInBand` geçti
- `npm run build` geçti

Güncel test durumu:

- `8` suite
- `40` test

## Mevcut Teknik Olgunluk Değerlendirmesi

Bu noktada import backend yüzeyi:

- dependency-aware
- retry-controlled
- audit-visible
- filterable
- summary üretebilen
- batch bazında inspect edilebilir

hale gelmiştir.

Bu artık sadece veri ingest eden bir katman değil; operasyonel olarak işletilebilir bir import platformudur.

## Sonraki En Mantıklı Teknik Rota

Buradan sonra mantıklı adaylar:

1. import batch response’larına derived health state eklemek
   - `healthy`
   - `needs_action`
   - `blocked`
   - `retry_ready`

2. snapshot / reporting tarafına benzer operasyonel observability yüzeyi taşımak

3. import batch timeline / activity summary zenginleştirmesi

## Otonom Çalışma Notu

Bu blokta çalışma, kullanıcıdan her adım için onay almadan, sadece anlamlı checkpointlerde özet çıkarılarak ilerletildi.
