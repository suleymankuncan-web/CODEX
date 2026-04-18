# Admin And Reporting Guide

## Amaç
- Faz 3B kapsamındaki admin ve reporting yüzeylerini tek bir operatör rehberinde toplamak.
- UI, QA ve backend ekiplerinin hangi endpoint'i hangi amaçla kullanacağını netleştirmek.

## Yetki Modeli
- `SUPER_ADMIN`
  - auth admin yüzeyini yönetir
- `INTEGRATION_ADMIN`
  - integration source ve import batch operasyonlarını yönetir
- `SNAPSHOT_OPERATOR`
  - snapshot run operasyonlarını yönetir
- `REPORT_VIEWER` ve `AUDITOR`
  - read-only reporting yüzeyini kullanır

## Scope Modeli
- Admin command yüzeyleri çoğunlukla `company` scope ister.
- Reporting yüzeyi authenticated kullanıcı ister ve veri dönüşü kullanıcı scope'u ile daraltılır.
- Scope hiyerarşisi:
  - `company` -> `companyId`
  - `region` -> `companyId + regionId`
  - `store` -> `companyId + regionId + storeId`

## Auth Admin Surface

### Amaç
- Kullanıcı, rol ataması, permission ve lookup yönetimini bounded auth modülü içinde toplar.

### Ana endpoint'ler
- `GET /api/auth/lookups`
  - admin form'ları için kullanıcı, rol, permission, scope ve provider seçenekleri döner
- `POST /api/auth/users`
  - kullanıcı hesabı açar
- `GET /api/auth/users`
  - kullanıcı listesini filtreli ve sayfalı döner
- `PATCH /api/auth/users/:userId/deactivate`
  - kullanıcıyı pasife alır
- `PATCH /api/auth/users/:userId/reactivate`
  - kullanıcıyı tekrar aktif eder
- `GET /api/auth/users/:userId/audit`
  - kullanıcıya ait audit geçmişini döner
- `POST /api/auth/role-assignments`
  - scoped rol ataması oluşturur
- `GET /api/auth/role-assignments`
  - rol atamalarını filtreli ve sayfalı döner
- `PATCH /api/auth/role-assignments/:assignmentId/deactivate`
  - rol atamasını pasife alır
- `GET /api/auth/role-assignments/:assignmentId/audit`
  - rol atamasının audit geçmişini döner
- `GET /api/auth/roles`
  - rol kataloğunu attached permission'larla döner
- `GET /api/auth/permissions`
  - permission kataloğunu döner
- `POST /api/auth/roles/:roleId/permissions`
  - role permission grant eder
- `DELETE /api/auth/roles/:roleId/permissions/:permissionCode`
  - role permission revoke eder

### UI notları
- Lookup endpoint'leri backward-compatible top-level alanları korur.
- Yeni UI tüketimi için aynı payload içinde `optionGroups` ve `meta` blokları da bulunur.

## Integration Admin Surface

### Amaç
- Dış veri akışını bounded integration modülü içinde görünür, retry edilebilir ve yönetilebilir tutmak.

### Kaynak yönetimi
- `GET /api/integrations/lookups`
- `GET /api/integrations/sources`
- `POST /api/integrations/sources`
- `PATCH /api/integrations/sources/:sourceId/deactivate`
- `PATCH /api/integrations/sources/:sourceId/reactivate`
- `GET /api/integrations/sources/:sourceId/audit`

### Import batch operasyonları
- `POST /api/integrations/import-batches`
  - batch kaydı açar ve async materialization enqueue eder
- `GET /api/integrations/import-batches`
  - batch listesi
- `GET /api/integrations/import-batches/summary`
  - toplamlar ve health türetimleri
- `GET /api/integrations/import-batches/overview`
  - admin dashboard kartları ve aksiyon özeti
- `GET /api/integrations/import-batches/needs-action`
  - aksiyon bekleyen batch listesi
- `GET /api/integrations/import-batches/:batchId`
  - detay, dependency summary, retry readiness
- `GET /api/integrations/import-batches/:batchId/errors`
  - row-level hata görünümü
- `GET /api/integrations/import-batches/:batchId/audit`
  - audit geçmişi
- `POST /api/integrations/import-batches/:batchId/retry`
  - kontrollü retry

### Operasyonel anlamı olan alanlar
- `dependencySummary`
- `blockedByEntityTypes`
- `recommendedImportOrder`
- `recommendedNextEntityType`
- `canRetryNow`

Bu alanlar admin UI'da yalnızca veri listelemek için değil, operatöre bir sonraki doğru adımı göstermek için tasarlanmıştır.

## Snapshot Admin Surface

### Amaç
- Immutable snapshot üretimini, rerun governance'ı ve lineage görünürlüğünü bounded snapshot yüzeyinde toplamak.

### Ana endpoint'ler
- `GET /api/snapshots/lookups`
- `POST /api/snapshots/runs`
- `GET /api/snapshots/runs`
- `GET /api/snapshots/runs/summary`
- `GET /api/snapshots/runs/overview`
- `GET /api/snapshots/runs/needs-action`
- `GET /api/snapshots/runs/:snapshotRunId`
- `GET /api/snapshots/runs/:snapshotRunId/dependencies`
- `GET /api/snapshots/runs/:snapshotRunId/lineage`
- `GET /api/snapshots/runs/:snapshotRunId/audit`
- `POST /api/snapshots/runs/:snapshotRunId/rerun`

### Operasyonel anlamı olan alanlar
- `rerunAllowed`
- `rerunBlockedReason`
- lineage görünümü
- dependency görünümü

Bu modelde rerun mevcut kaydı ezmez; her rerun yeni immutable run olarak açılır.

## Reporting Surface

### Amaç
- Dashboard ve read-only raporlama tüketimini yalnızca `rpt.*` üstünden yapmak.

### Ana endpoint'ler
- `GET /api/reports/summary`
  - son başarılı snapshot'tan dashboard summary kartları
- `GET /api/reports/snapshot-runs`
  - rapor seçici ekranlar için snapshot run listesi
- `GET /api/reports/workforce`
  - workforce snapshot satırları
- `GET /api/reports/kpis`
  - KPI snapshot satırları
- `GET /api/reports/checklists`
  - checklist compliance snapshot satırları
- `GET /api/reports/turnover`
  - turnover snapshot satırları

### Query davranışı
- Liste endpoint'leri `limit`, `offset` ve `meta` döner.
- Scope-aware endpoint'lerde kullanıcı scope'u controller seviyesinde servise aktarılır.
- `storeId`, `kpiId`, `checklistTemplateId` ve benzeri filtreler additive daraltma yapar.

## Standart Response Modeli
- Command endpoint'leri command envelope döner.
- Liste endpoint'leri `items + meta` döner.
- Admin ve reporting yüzeyleri aynı hata modelini korur:
  - `401` auth problemi
  - `403` role veya scope problemi
  - `404` kaynak bulunamadı
  - `409` state conflict
  - `422` semantik policy hatası

## Faz 3B Tamamlama Notu
- Auth admin rehberi ayrı belgede tutulur: `docs/api/auth-admin-and-jwt-guide.md`
- Bu belge, auth, integration, snapshot ve reporting yüzeylerini tek operasyonel haritada birleştirir.
- Sonraki doğal adım Faz 3C kapsamında live E2E readiness ve operational monitoring contract'ını kapatmaktır.
