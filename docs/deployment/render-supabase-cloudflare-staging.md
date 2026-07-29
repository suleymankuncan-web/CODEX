# HR Axis Render + Supabase + Cloudflare Staging

Tarih: 2026-07-29

Bu rota Koyeb Pro zorunlulugu goruldugu icin aktif staging rotasidir.

## Secilen Stack

```text
Domain/DNS: Cloudflare, hr-axis.com
Frontend: Cloudflare Workers Static Assets
Backend: Render Web Service + Background Worker
Database: Supabase Postgres
Authentication: Clerk
Authorization: HR Axis DB
```

## Neden Render?

- Mevcut NestJS backend'i rewrite etmeden uzun sureli Node web service olarak calistirir.
- Free web service staging kaniti icin yeterli olabilir.
- BullMQ import/snapshot job'lari icin ayni repo ve build artifact'i ile ayri
  background worker calistirabilir.
- Render Postgres free DB 30 gun sonra expire oldugu icin DB icin Supabase kullanilir.
- Repo'da `render.yaml` blueprint hazirdir; `DATABASE_URL` secret olarak Render ekraninda girilir.

## Limit ve Riskler

- Render free web service 15 dakika idle kalinca spin down olabilir; ilk istek yaklasik 1 dakika gecikebilir.
- Free web service production icin uygun degildir.
- Render background worker icin `free` plan kullanilamaz; staging BullMQ
  worker icin en az `starter` instance gerekir.
- Render free service'in dis DB'ye outbound kullaniminda limit/suspend riski olabilir; staging kaniti dusuk trafikte kalmalidir.
- Supabase free Postgres staging icin uygundur; buyuyen pilotta paid DB veya baska managed DB'ye gecilebilir.

## 1. Supabase DB

Supabase dashboard:

```text
Project: hr-axis-staging
Database: hr_axis_staging
PostgreSQL: 16 varsa 16
```

Backend connection:

```text
Project Settings -> Database -> Connection string -> Session pooler URI
```

Render backend env:

```env
DATABASE_URL=<Supabase session pooler URI>
DB_SSL_MODE=verify-full
DB_SSL_CA=<Render secret: Supabase provider root CA; never commit or paste into chat>
DB_POOL_MAX=5
```

Connection string ve password chat'e/git'e yazilmaz.

## 2. Render Backend

Render dashboard:

```text
New -> Blueprint veya New -> Web Service
Repository: suleymankuncan-web/CODEX
Branch: main
```

Blueprint kullanilacaksa repo root'taki dosya:

```text
render.yaml
```

Manuel Web Service kurulacaksa:

```text
Name: hr-axis-api
Runtime: Node
Region: Frankfurt
Plan: Free
Root Directory: backend/nestjs
Build Command: npm ci --include=dev && npm run db:migrate && npm run build
Start Command: node dist/src/main.js
Health Check Path: /api/health/live
Auto Deploy: Off
```

BullMQ aktif edilecekse API web service sadece job uretir. Job'lari tuketecek
ikinci Render servisi zorunludur:

```text
New -> Background Worker
Name: hr-axis-worker
Runtime: Node
Region: Frankfurt
Plan: Starter
Root Directory: backend/nestjs
Build Command: npm ci --include=dev && npm run build
Start Command: node dist/src/workers.js
Auto Deploy: Off
```

Worker build command migration calistirmaz. Migration sadece web service build
akisi veya kontrollu release adimi tarafindan calistirilir.

Render Free plan does not support `preDeployCommand`. On the active free-plan
staging service, keep this Build Command so migrations run before the backend
build:

```text
Build Command: npm ci --include=dev && npm run db:migrate && npm run build
```

Port notu:

- Render runtime `PORT` env'i verir.
- Backend `APP_PORT` yoksa `PORT` degerine duserek dinler.
- Render'da `APP_PORT` set etmeye gerek yoktur.
- Render env degerleri build asamasinda da goruldugu icin `NODE_ENV=production`
  devDependencies kurulumunu etkileyebilir. Bu nedenle build command
  `npm ci --include=dev && npm run db:migrate && npm run build` olmalidir.

## 3. Backend Env

`render.yaml` sabit public env'leri tanimliyor. Render ilk blueprint kurulumunda
`DATABASE_URL` ve `DB_SSL_CA` icin secret isteyecek. `DB_SSL_CA`, Supabase'in
provider root CA materyalidir; repo'ya, chat'e veya log'a yazilmaz.

Kontrol listesi:

```env
NODE_ENV=production
APP_NAME=hr-axis-staging-api
DATABASE_URL=<Supabase session pooler URI>
DB_POOL_MAX=5
DB_SSL_MODE=verify-full
DB_SSL_CA=<Render secret: Supabase provider root CA>
AUTH_MODE=jwt
AUTH_PROVIDER_KEY=clerk
ALLOW_MOCK_AUTH=false
JWT_ISSUER=https://relative-gazelle-47.clerk.accounts.dev
JWT_JWKS_URL=https://relative-gazelle-47.clerk.accounts.dev/.well-known/jwks.json
JWT_AUDIENCE=hr-axis-api
AUTH_CLIENT_ID=pk_test_cmVsYXRpdmUtZ2F6ZWxsZS00Ny5jbGVyay5hY2NvdW50cy5kZXYk
CORS_ALLOWED_ORIGINS=https://staging.hr-axis.com
TRUST_PROXY_HOPS=1
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
RATE_LIMIT_BACKEND=redis
QUEUE_BACKEND=bullmq
REDIS_URL=<Render Key Value internal URL>
READINESS_PROFILE=controlled-pilot
DAILY_CLOSURE_AUTOMATION_ENABLED=false
```

Worker env kontrol listesi:

```env
NODE_ENV=production
APP_NAME=hr-axis-staging-worker
DATABASE_URL=<Supabase session pooler URI>
DB_POOL_MAX=5
DB_SSL_MODE=verify-full
DB_SSL_CA=<Render secret: Supabase provider root CA>
QUEUE_BACKEND=bullmq
REDIS_URL=<Render Key Value internal URL>
READINESS_PROFILE=controlled-pilot
DAILY_CLOSURE_AUTOMATION_ENABLED=false
```

Web service ve worker ayni `REDIS_URL`, `QUEUE_BACKEND`, `QUEUE_IMPORT_NAME`
ve `QUEUE_SNAPSHOT_NAME` degerlerini kullanmalidir. Queue name env'leri
set edilmezse iki process de kod default'larini kullanir.

## 4. Migration

Aktif Render Free plan staging yolunda migration build command icinde calisir:

```text
npm ci --include=dev && npm run db:migrate && npm run build
```

Paid Render plan'a gecilirse daha temiz ayrim sudur:

```text
Build Command: npm ci --include=dev && npm run build
Pre-Deploy Command: npm run db:migrate
```

Render build-step migration kullanilamiyorsa Supabase staging DB migration'i lokalden calistir:

```powershell
cd D:\store-ops-workspace\backend\nestjs
$env:NODE_ENV="production"
$env:DATABASE_URL="<Supabase session pooler URI>"
$env:DB_SSL_MODE="verify-full"
$env:DB_SSL_CA="<provider root CA loaded through a secret-safe path>"
$env:DB_POOL_MAX="5"
$env:TRUST_PROXY_HOPS="1"
$env:RATE_LIMIT_WINDOW_MS="60000"
$env:RATE_LIMIT_MAX="120"
npm.cmd run db:migrate
```

## 5. Cloudflare Frontend

Cloudflare Worker:

```text
Repo: suleymankuncan-web/CODEX
Branch: main
Root Directory: admin-web
Framework: Vite
Build Command: npm run build:cloudflare
Upload Command: npm run upload:cloudflare:artifact
Promote Command: npm run promote:cloudflare:version
Output Directory: dist
Worker: hr-axis-staging-frontend
SPA fallback: single-page-application
```

Frontend env:

```env
VITE_API_BASE_URL=https://api-staging.hr-axis.com/api
VITE_AUTH_MODE=bearer
VITE_AUTH_PROVIDER=clerk
VITE_BROWSER_SESSION_TRANSPORT=cookie
VITE_CLERK_PUBLISHABLE_KEY=<provider-managed public build value>
VITE_CLERK_JWT_TEMPLATE=hr-axis-api
VITE_BEARER_TOKEN=
VITE_SENTRY_DSN=<provider-managed public ingest value>
VITE_SENTRY_ENABLED=true
VITE_SENTRY_ENVIRONMENT=staging
VITE_SENTRY_RELEASE=<exact deployed Git commit>
```

Build-time values are supplied by the controlled deploy environment. They are
never committed or copied into deployment evidence. The Worker contains no
runtime script; `dist` is served by Cloudflare Workers Static Assets.

## 6. DNS

```text
staging.hr-axis.com -> Cloudflare Worker custom domain
api-staging.hr-axis.com -> Render custom domain target
```

The active frontend hostname is owned by the Worker custom-domain binding. A
separate CNAME to a frontend hosting provider is not part of the steady state.

## 7. Smoke

```text
https://api-staging.hr-axis.com/api/health/live
https://api-staging.hr-axis.com/api/health
https://staging.hr-axis.com
https://api-staging.hr-axis.com/api/auth/session
```

`/api/health/live` sadece NestJS process'inin cevap verdigini gosterir ve Render
deploy health check'i icin kullanilir. `/api/health` PostgreSQL/Redis gibi
bagimliliklari da kontrol eder; staging smoke ve DB kaniti icin asil hazirlik
kontrolu budur.

BullMQ worker log dogrulamasi:

```text
BullMQ worker context started
Registered 2 BullMQ workers
job.execution.started
import_batch.materialization.started
import_batch.materialization.completed
```

`job.execution.started` ve `import_batch.materialization.completed` satirlari
kucuk bir import upload testinden sonra gorulmelidir.

Smoke tamamlanmadan pilot gate acilmaz.

## 8. Manual Env Verification

Before a staging deploy is approved, compare environment variable names against
`docs/plans/environment-variable-inventory.md` and its `Production Env Contract
Guard` table.

- Render backend and worker: verify `NODE_ENV`, `DATABASE_URL`, `DB_SSL_MODE`,
  `AUTH_MODE`, `AUTH_PROVIDER_KEY`, `ALLOW_MOCK_AUTH`,
  `MIGRATIONS_HTTP_ENABLED`, `JWT_ISSUER`, `JWT_JWKS_URL`, `JWT_AUDIENCE`,
  `AUTH_AUTHORIZATION_URL`, `AUTH_CLIENT_ID`, `AUTH_SCOPE`,
  `AUTH_RESPONSE_TYPE`, `AUTH_TOKEN_URL`, `AUTH_CALLBACK_PATH`,
  `AUTH_POST_LOGOUT_REDIRECT_PATH`, `CORS_ALLOWED_ORIGINS`,
  `TRUST_PROXY_HOPS`, `RATE_LIMIT_BACKEND`, `RATE_LIMIT_WINDOW_MS`,
  `RATE_LIMIT_MAX`, `QUEUE_BACKEND`, `UPLOAD_PARSE_MAX_CONCURRENCY`,
  `UPLOAD_PARSE_TIMEOUT_MS`, `DAILY_CLOSURE_ACTOR_USER_ID`, and
  `READINESS_PROFILE` are intentionally set or intentionally omitted for the
  controlled-pilot profile.
- Cloudflare frontend build: verify `VITE_API_BASE_URL`, `VITE_AUTH_MODE`,
  `VITE_AUTH_PROVIDER`, `VITE_BROWSER_SESSION_TRANSPORT`,
  `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_JWT_TEMPLATE`, empty
  `VITE_BEARER_TOKEN`, `VITE_SENTRY_DSN`, `VITE_SENTRY_ENABLED`,
  `VITE_SENTRY_ENVIRONMENT`, and `VITE_SENTRY_RELEASE`.
- Clerk dashboard: verify the issuer, JWKS URL, audience/template, callback URL,
  and post-logout URL match the backend/frontend env names above.
- Supabase dashboard: verify the database connection target, backup capability,
  and pooler mode without copying the connection string.

Do not copy values from Render, Cloudflare, Clerk, Supabase, or local shells into
docs, PRs, chat, screenshots, or evidence. Record only variable names, status, and owner.
