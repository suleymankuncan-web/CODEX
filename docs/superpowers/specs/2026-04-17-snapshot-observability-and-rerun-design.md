# Snapshot Observability and Rerun Design

## Scope

Bu dilim üç işi aynı operasyon çizgisinde kapatır:

1. import batch health state
2. snapshot run observability
3. snapshot rerun

Amaç, import tarafında başlayan işletilebilirlik modelini snapshot tarafına da taşımak ve başarısız snapshot denemelerini geçmişi bozmadan yeniden çalıştırabilmektir.

## Yaklaşım

- Import batch response'larına derived `healthState` eklenecek.
- Snapshot tarafında ayrı operasyon endpoint seti açılacak:
  - `GET /api/snapshots/runs`
  - `GET /api/snapshots/runs/summary`
  - `GET /api/snapshots/runs/:snapshotRunId`
  - `GET /api/snapshots/runs/:snapshotRunId/audit`
  - `POST /api/snapshots/runs/:snapshotRunId/rerun`
- `rerun` mevcut kaydı ezmeyecek; yeni bir `rpt.snapshot_run` satırı üretecek.

## Snapshot Rerun Kararı

`rerun` semantiği yeni bir snapshot run üretir. Eski run immutable kalır.

Yeni run üzerinde:
- aynı `snapshot_type`
- aynı `period_start`
- aynı `period_end`
- yeni `snapshot_run_id`
- `rerun_of_snapshot_run_id`

Bu yaklaşım geçmişi açık tutar, audit ve incident incelemeyi kolaylaştırır, immutable reporting modeline daha iyi oturur.

## Snapshot Operasyon Contract

### Liste

Her run en az şunları döner:

- `snapshotRunId`
- `snapshotType`
- `periodStart`
- `periodEnd`
- `runStatus`
- `healthState`
- `generatedAt`
- `startedAt`
- `finishedAt`
- `generatedBy`
- `rerunOfSnapshotRunId`

### Detail

Liste alanlarına ek olarak:

- `cards`
  - `workforceRows`
  - `kpiRows`
  - `checklistRows`
  - `turnoverRows`
- `canRerun`
- `rerunCount`
- `latestRerunSnapshotRunId`
- `failureReason`

### Audit

Audit endpoint şu event akışını gösterebilir:

- `snapshot_run.created`
- `snapshot_run.started`
- `snapshot_run.completed`
- `snapshot_run.failed`
- `snapshot_run.rerun_requested`

## Derived Health State

### Import

- `healthy`
  - `completed` ve error yok
- `in_progress`
  - `queued`, `pending`, `processing`
- `blocked`
  - unresolved dependency var
- `retry_ready`
  - retryable row var ve dependency blokajı yok
- `needs_action`
  - validation failure veya failed durum var ama hemen retry edilebilir değil

### Snapshot

- `healthy`
  - `completed`
- `in_progress`
  - `queued` veya `running`
- `retry_ready`
  - `failed` ve rerun yapılabilir
- `needs_action`
  - beklenmeyen/yarım kalmış durum ya da veri üretmeden tamamlanan problemli run

## Şema Değişiklikleri

`rpt.snapshot_run` genişletilecek:

- `started_at TIMESTAMPTZ`
- `finished_at TIMESTAMPTZ`
- `failure_reason TEXT`
- `rerun_of_snapshot_run_id UUID NULL REFERENCES rpt.snapshot_run(snapshot_run_id)`

Bu alanlar worker lifecycle ve rerun ilişkisini görünür kılar.

## Test Kapsamı

- service test:
  - import health state türetimi
  - snapshot rerun yeni run üretir
  - snapshot detail health/canRerun hesabı
- integration test:
  - snapshot list
  - snapshot detail
  - snapshot audit
  - snapshot rerun endpoint
