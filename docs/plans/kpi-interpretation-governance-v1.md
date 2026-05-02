# KPI Interpretation Governance V1

Date: 26 April 2026

## Purpose

Score, grade, threshold ve yorum dilinin ileride admin-editable hale gelmeden once nasil version/effective-date/audit zemini kazanacagini netlestirmek.

Bu dokuman bugun DB migration acmaz. Amaci, yanlis sirada buyumeyi engellemektir.

## Current State

Bugun KPI config module-owned data config olarak `ops.kpi_score_profile_config` icinde yasar.

Mevcut gucler:

- `SUPER_ADMIN` icin draft/publish akisi var.
- `store_profile`, `personnel_profile`, `ownership_matrix`, `grading_bands` config payload'lari var.
- draft key'leri var: `draft_store_profile`, `draft_personnel_profile`, `draft_ownership_matrix`, `draft_grading_bands`.
- KPI config audit akisi var.
- snapshot ve reporting read model ayrimi zaten var.

Mevcut sinir:

- config version id yok.
- effective-from / effective-to yok.
- snapshot run icinde "hangi config version bu sonucu uretmis" bilgisi yok.
- frontend interpretation copy kod icinde duruyor.
- gecmis skor yorumlari bugunku yorum diliyle tekrar okunabilir.

## Decision

KPI interpretation ve threshold dili admin-editable hale gelmeden once versioned governance gelmeli.

V1 karari:

- Simdilik yeni `dm` veya `config` schema acilmaz.
- Yeni yorum/threshold degisikligi once planlanir, sonra versioned config tasarimi ile uygulanir.
- `ops` schema, KPI config'in sahibi olmaya devam eder.
- `rpt` snapshotlari, sonuc ureten config version'ini referanslayacak sekilde genisletilmeden gecmis yorum guvenli sayilmaz.
- Audit, publish olayini anlatir; ama tek basina historical interpretation icin yeterli kabul edilmez.

## Target Governance Model

Bir sonraki teknik V1/V2 icin hedef model:

### 1. Versioned Published Config

Her publish yeni bir config version uretmeli.

Gerekli alanlar:

- `config_version_id`
- `version_no`
- `lifecycle_state`: draft, published, retired
- `effective_from`
- `effective_to`
- `published_at`
- `published_by`
- `change_summary`
- `config_payload`

### 2. Snapshot Anchoring

Rapor snapshotlari hangi config version ile hesaplandigini tasimali.

Minimum hedef:

- `rpt.snapshot_run` veya ilgili score snapshotlari `kpi_config_version_id` referansi tasir.
- daily/monthly closure tekrar okundugunda bugunku config degil, snapshot'in kendi config version'i yorumlanir.

### 3. Interpretation Packs

Score formulu, grade band ve kullanici dili tek tek dagilmamali.

Interpretation pack sunlari tasimali:

- grading bands
- store score meaning copy
- personnel score meaning copy
- source semantics labels
- warning/action language
- locale-ready label keys veya copy payload

### 4. Approval And Rollback

Config publish tek tiklik kalabilir, ama gercek governance icin hedef:

- draft edit
- decision preview
- publish
- rollback to previous published version
- future effective date support
- audit event with before/after summary

### 5. API Contract

Frontend gelecekte sadece bugunku payload'i degil, metadata da almali:

- `configVersionId`
- `versionNo`
- `effectiveFrom`
- `effectiveTo`
- `publishedAt`
- `interpretationPackVersion`

## Do Not Build Yet

Asagidakiler hemen yapilmamali:

- yeni `dm` schema
- yeni `config` schema
- tum KPI config editor'ini bastan yazmak
- score motorunu tekrar tasarlamak
- gecmis snapshotlari backfill etmeden "historical interpretation ready" demek

## Promotion Triggers

Bu plan teknik uygulamaya su kosullardan biri olunca gecmeli:

- HR/Admin threshold veya yorum dilini UI'dan degistirmek ister
- grade band degisikligi bir sonraki ay icin planlanir
- ayni skor iki farkli donemde farkli yorumla okunmaya baslar
- audit "bu skor hangi rule/config version ile uretildi" sorusunu cevaplamali olur
- rollback ihtiyaci dogar
- staging/prod'da KPI config publish sureci duzenli operasyon haline gelir

## Suggested Implementation Order

1. `ops.kpi_config_version` gibi versioned owner tablo tasarla.
2. Mevcut `ops.kpi_score_profile_config` payload'larini published v1 olarak migrate et.
3. Draft key modelini versioned draft modeline tasiyacak expand-contract migration hazirla.
4. `rpt.snapshot_run` icine config version referansi ekle.
5. Backend `getKpiConfig` response'una config metadata ekle.
6. Frontend interpretation helper'larini metadata-aware hale getir.
7. Admin editor'de effective date, preview ve rollback dilini ekle.

## Verification Strategy

Teknik uygulama basladiginda gerekli testler:

- backend repository test: latest published config version okunur
- backend service test: future effective config bugunku read'e karismaz
- snapshot test: closure snapshot config version'a anchor olur
- audit test: publish event version id ve summary tasir
- frontend Playwright: admin config paneli version/effective date gosterir
- store Playwright: historical snapshot kendi interpretation version'ini gosterir

## CODEX DÜRÜST YORUM

Bu noktada en dogru hamle migration yazmak degil, karar sinirini kilitlemekti.

Sebep basit: yorum dili yeni guclendi, ama henuz gercek operasyonel veri hacmi ve admin edit rutini olusmadi. Simdi agir bir config/versioning sistemi kurarsak projeye gereksiz agirlik biner. Ama bu siniri yazmadan devam edersek ileride "bugunku yorum gecmise de uygulandi mi" sorusu guven kaybettirir.

Benim net yorumum: plan tamam, implementation acele degil. Bir sonraki guvenli teknik adim, admin KPI config editor tarafinda mevcut draft/publish deneyimini daha okunur governance preview ile guclendirmek olabilir; gercek versioned schema ise publish sureci duzenli kullanilmaya baslayinca gelmeli.
