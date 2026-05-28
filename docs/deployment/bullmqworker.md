# BullMQ Worker PR Notu

PR: #534 `Add Render BullMQ worker service`

## Problem

Power BI / Excel import upload akisi staging ortaminda `pending` durumda
kalabiliyor. Koddaki akis su sekilde:

1. API upload istegini alir.
2. `stg.import_batch` kaydini `pending` olarak olusturur.
3. `QUEUE_BACKEND=bullmq` ise job'i Redis/BullMQ kuyruguna ekler.
4. Ayri bir worker process calisiyorsa job'i tuketir ve
   `materializeBatch(batchId)` calistirir.
5. Materialization bitince batch `completed`, `completed_with_errors` veya
   `failed` durumuna gecer.

Sorun Redis'in var olmamasi degil. Staging health Redis'i `ok` gosterebilir,
ama bu yalnizca kuyruga baglanildigini kanitlar. BullMQ modunda API job
uretici, worker ise job tuketicidir. Worker yoksa yeni import kaydi kuyruga
alinir ama DB status'u `pending` kalir.

## Neden Bu PR

Mart importlari daha once calismisti; o donemde staging ya `in-memory` queue
modundaydi ya da job'i isleyecek worker akisi vardi. Sonradan Redis/BullMQ
staging kaniti alindi ve API `QUEUE_BACKEND=bullmq` calismaya basladi. Bu
kalici mimari icin dogru yon, ancak BullMQ'nun dogru calismasi icin ayri
Render Background Worker servisi gerekir.

Bu PR, mevcut uygulama kodunu yeniden yazmadan eksik deploy parcasini ekler:

- Web service job uretir.
- Redis/BullMQ job'i saklar.
- Worker service job'i tuketir.
- Import materialization tekrar otomatik ilerler.

## Degisenler

### `render.yaml`

`hr-axis-api` web service BullMQ/Redis moduna alindi:

```env
RATE_LIMIT_BACKEND=redis
QUEUE_BACKEND=bullmq
REDIS_URL=<secret>
READINESS_PROFILE=controlled-pilot
```

Yeni Render worker servisi eklendi:

```text
type: worker
name: hr-axis-worker
plan: starter
rootDir: backend/nestjs
buildCommand: npm ci --include=dev && npm run build
startCommand: node dist/src/workers.js
```

Worker build command migration calistirmaz. Migration sorumlulugu web service
build akisi veya kontrollu release adiminda kalir.

### `docs/deployment/render-supabase-vercel-staging.md`

Staging runbook guncellendi:

- API + Background Worker mimarisi eklendi.
- Worker icin Render kurulum adimlari yazildi.
- API ve worker env parity kurallari yazildi.
- Worker log dogrulama sinyalleri eklendi.

### `scripts/deployment-runbook-contract.test.mjs`

Render Blueprint icinde worker servisinin varligini koruyan kontrat testi
eklendi.

## Bilerek Degistirmediklerimiz

Bu PR sunlari degistirmez:

- Business logic.
- API response shape.
- Auth, role, permission veya scope semantigi.
- DB schema veya migration.
- Frontend UI/CSS davranisi.
- Import mapping kurallari.

Bu sadece deploy mimarisindeki eksik worker parcasini tanimlar.

## Render'da Uygulama Sirasi

1. PR merge edilir.
2. Render Blueprint tekrar uygulanir veya manuel worker service olusturulur.
3. `hr-axis-api` ve `hr-axis-worker` servislerinde secret env'ler doldurulur:

```env
DATABASE_URL=<Supabase session pooler URI>
REDIS_URL=<Render Key Value internal URL>
QUEUE_BACKEND=bullmq
READINESS_PROFILE=controlled-pilot
```

4. API icin ek olarak:

```env
RATE_LIMIT_BACKEND=redis
```

5. `hr-axis-worker` deploy edilir.
6. Worker loglarinda su sinyaller aranir:

```text
BullMQ worker context started
Registered 2 BullMQ workers
```

7. Kucuk bir import upload testi yapilir.
8. Worker loglarinda su sinyaller aranir:

```text
job.execution.started
import_batch.materialization.started
import_batch.materialization.completed
```

9. API health kontrol edilir:

```powershell
curl.exe -sS -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health
```

Beklenen sinyaller:

```json
"queueBackend": "bullmq"
```

```json
"redis": { "status": "ok" }
```

## Eski Pending Batch Notu

Eski `pending` batch icin iki ihtimal var:

- Redis'teki job hala duruyorsa worker acilinca islenebilir.
- Redis job kaybolduysa batch DB'de `pending` kalabilir.

Ikinci durumda ayni dosyayi tekrar yuklemek idempotency nedeniyle eski batch'i
reuse edebilir. Boyle bir durumda manuel requeue/materialize araci veya hedefli
admin operasyonu gerekir. Bu PR o davranisi degistirmez; sadece worker
servisini deploy mimarisine ekler.

## Risk Ve Rollback

Risk: medium/high operational risk. Uygulama kodu davranisi degismiyor, ama
staging provider/deploy konfigurasyonu degisiyor.

Rollback:

1. Render'da `hr-axis-worker` servisini stop/delete et.
2. API env'i controlled pilot icin eski moda al:

```env
QUEUE_BACKEND=in-memory
RATE_LIMIT_BACKEND=memory
READINESS_PROFILE=controlled-pilot
```

3. API'yi redeploy et.
4. `/api/health` icinde queue mode'un process-local / in-memory oldugunu
   dogrula.

## Production Notu

Render Key Value Free veya benzeri free Redis tier kontrollu pilot icin kabul
edilebilir staging kaniti sayilir. Broad production icin kalici/persistent
Redis-compatible tier veya acik yazili risk kabul karari gerekir. Bu PR broad
production Go karari degildir.

## Lokal Dogrulama

Bu PR icin calistirilan kontroller:

```powershell
node --test scripts/deployment-runbook-contract.test.mjs
node --test scripts/queue-durability-readiness-contract.test.mjs scripts/rate-limit-readiness-contract.test.mjs scripts/readiness-env-contract.test.mjs scripts/deployment-runbook-contract.test.mjs
npm.cmd --prefix backend/nestjs run build
```

Build sonrasi `backend/nestjs/dist/src/workers.js` dosyasinin uretildigi
dogrulandi.
