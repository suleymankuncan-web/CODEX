# Current State

Bu dosya, projeyi yeni bir konuşma penceresinde devam ettirmek için tek kanonik handoff özetidir.

## Proje
- Amaç: mağaza operasyonu, denetim, workforce, KPI, snapshot reporting ve admin yönetimi için büyüyebilir backend platformu
- Mimari: NestJS modular monolith + PostgreSQL
- Şema ayrımı:
  - `ops`: operasyonel veri
  - `stg`: integration staging
  - `rpt`: immutable reporting snapshot verisi
  - `audit`: olay ve değişim izi

## Ana Mimari Kararlar
- Dış sistem verisi önce `stg.*` içine alınır, sonra materialize edilir.
- Reporting yalnızca `rpt.*` üstünden okunur.
- Snapshot kayıtları immutable tutulur.
- Ağır işler async queue/worker üstünden çalışır.
- RBAC ve scoped access zorunludur.
- Yeni işlevler bounded context içinde büyür; `god module` açılmaz.

## Şu An Tamamlanmış Büyük Alanlar

### 1. Integration / Import omurgası
- import batch create/list/detail/errors/summary/overview/needs-action endpoint'leri var
- import retry/requeue kontrollü şekilde var
- import audit görünürlüğü var
- `dependencySummary`, `blockedByEntityTypes`, `recommendedImportOrder`, `recommendedNextEntityType`, `canRetryNow` mevcut
- import health / stuck / retry-ready türetimleri mevcut

### 2. Materialization ve external ID mapping
- validation / retryable / processed ayrımı var
- `ExternalIdMappingService` ile mapping çözümleme merkezileştirildi
- desteklenen import entity'leri:
  - `company`
  - `region`
  - `store`
  - `position`
  - `employee`
  - `assignment`
  - `kpi`
- assignment history import ayrı entity olarak destekleniyor

### 3. Worker ve async execution
- BullMQ worker host var
- worker-only bootstrap var
- snapshot ve import async çalışabiliyor
- queue abstraction pluggable
- live Redis/Postgres doğrulaması için runbook hazır:
  - `docs/backend/live-e2e-runbook.md`
- 18 Nisan 2026 itibarıyla gerçek Docker + PostgreSQL + Redis live E2E geçti

### 4. Snapshot admin surface
- snapshot run create/list/detail/summary/overview/needs-action var
- rerun immutable modelle çalışıyor: aynı run ezilmiyor, yeni run açılıyor
- rerun governance var:
  - `rerunAllowed`
  - `rerunBlockedReason`
- dependencies ve lineage endpoint'leri var
- snapshot audit görünürlüğü var

### 5. Reporting read API
- mevcut endpoint'ler:
  - `GET /api/reports/summary`
  - `GET /api/reports/snapshot-runs`
  - `GET /api/reports/workforce`
  - `GET /api/reports/kpis`
  - `GET /api/reports/checklists`
  - `GET /api/reports/turnover`
- liste endpoint'leri pagination ve `meta` döndürüyor
- admin/reporting operasyon rehberi eklendi:
  - `docs/api/admin-and-reporting-guide.md`

### 6. Auth / RBAC / Admin management
- auth guard + role guard + scope guard var
- JWT auth:
  - shared-secret
  - JWKS (`JWT_JWKS_URL`)
- DB-backed role resolution aktif
- auth admin yüzeyi mevcut:
  - user create/list/deactivate/reactivate/audit
  - role assignment create/list/deactivate/audit
  - role catalog
  - permission catalog
  - role-permission grant/revoke
  - auth lookups

### 7. Faz 3A tamamlandı
- merkezi `role/scope governance` var
- scope hierarchy kuralları zorlanıyor:
  - `company` -> `companyId`
  - `region` -> `companyId + regionId`
  - `store` -> `companyId + regionId + storeId`
- ortak audit metadata shape eklendi:
  - `reason`
  - `correlationId`
  - `sourceContext`
  - `changedFields`
  - `details`
- error modeli netleşti:
  - `401` auth problemi
  - `403` role/scope erişim problemi
  - `404` kaynak yok
  - `409` state conflict
  - `422` semantik policy hatası

### 8. Faz 3B tamamlanmış durumda
- auth için ayrı rehber var:
  - `docs/api/auth-admin-and-jwt-guide.md`
- admin/reporting operasyon rehberi var:
  - `docs/api/admin-and-reporting-guide.md`
- lookup endpoint'leri additive olarak zenginleşti:
  - mevcut top-level alanlar korundu
  - `optionGroups` eklendi
  - `meta` eklendi

## Önemli Dosyalar
- [codex.md](</e:/WEBSİTE ÇALIŞMASI/codex.md>)
- [current-state.md](</e:/WEBSİTE ÇALIŞMASI/current-state.md>)
- [store-ops-api-contracts.md](</e:/WEBSİTE ÇALIŞMASI/docs/api/store-ops-api-contracts.md>)
- [auth-admin-and-jwt-guide.md](</e:/WEBSİTE ÇALIŞMASI/docs/api/auth-admin-and-jwt-guide.md>)
- [admin-and-reporting-guide.md](</e:/WEBSİTE ÇALIŞMASI/docs/api/admin-and-reporting-guide.md>)
- [live-e2e-runbook.md](</e:/WEBSİTE ÇALIŞMASI/docs/backend/live-e2e-runbook.md>)
- [implementation-summary.md](</e:/WEBSİTE ÇALIŞMASI/docs/status/implementation-summary.md>)

## Doğrulama Durumu
- Son taze uygulama doğrulaması geçmiş durumda:
  - `npm test -- --runInBand`
  - `npm run build`
- Güncel sonuç:
  - `11` suite
  - `92` test geçti

## 18 Nisan 2026 Live Infra Durumu
- Docker Desktop ve WSL 2 sağlıklı çalışıyor.
- Doğrulanan komutlar:
  - `wsl --status`
  - `docker version`
  - `docker info`
  - `docker compose -f infra/docker-compose.live-e2e.yml up -d`
  - `npm run build`
  - `npm run test:live`
- Sonuç:
  - canlı snapshot akışı geçti
  - canlı import akışı geçti
  - Postgres ve Redis container health doğrulandı
- İlgili belgeler:
  - `docs/backend/operational-monitoring-contract.md`
  - `docs/status/release-readiness-2026-04-18.md`

## Son Eklenen Sertleştirme
- `/api/health` artık dependency-aware:
  - PostgreSQL probe yapıyor
  - `QUEUE_BACKEND=bullmq` ise Redis probe yapıyor
  - dependency failure durumunda `503` dönüyor
  - health endpoint auth guard zincirinden `Public` metadata ile muaf
- ilgili test:
  - `backend/nestjs/test/integration/health.e2e-spec.ts`
- release smoke script eklendi:
  - `backend/nestjs/scripts/release-smoke.ts`
  - `npm run smoke:release`
  - varsayılan olarak `health`, `import overview`, `snapshot overview`, `reports summary` yüzeylerini kontrol ediyor

## Bilinçli Olarak Bekleyen Konu
- structured logging ve correlation id standardı hâlâ bekleyen iyileştirme alanı

## En Mantıklı Sonraki Rota

### Sonraki Rota
- structured logging ve correlation id standardı

## Yeni Pencerede Kullanılacak Komut
En pratik devam komutu:

`codex.md ve current-state.md oku, structured logging ve correlation id standardından devam et`

Eğer daha kısa istersen çoğu durumda şu da yeter:

`current-state.md oku ve structured logging'den devam et`
