# HR Axis Render + Supabase + Vercel Staging

Tarih: 2026-05-02

Bu rota Koyeb Pro zorunlulugu goruldugu icin aktif staging rotasidir.

## Secilen Stack

```text
Domain/DNS: Cloudflare, hr-axis.com
Frontend: Vercel
Backend: Render Web Service
Database: Supabase Postgres
Authentication: Clerk
Authorization: HR Axis DB
```

## Neden Render?

- Mevcut NestJS backend'i rewrite etmeden uzun sureli Node web service olarak calistirir.
- Free web service staging kaniti icin yeterli olabilir.
- Render Postgres free DB 30 gun sonra expire oldugu icin DB icin Supabase kullanilir.
- Repo'da `render.yaml` blueprint hazirdir; `DATABASE_URL` secret olarak Render ekraninda girilir.

## Limit ve Riskler

- Render free web service 15 dakika idle kalinca spin down olabilir; ilk istek yaklasik 1 dakika gecikebilir.
- Free web service production icin uygun degildir.
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
DB_SSL_MODE=require
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

`render.yaml` sabit public env'leri tanimliyor. Render ilk blueprint kurulumunda `DATABASE_URL` icin secret isteyecek.

Kontrol listesi:

```env
NODE_ENV=production
APP_NAME=hr-axis-staging-api
DATABASE_URL=<Supabase session pooler URI>
DB_POOL_MAX=5
DB_SSL_MODE=require
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
QUEUE_BACKEND=in-memory
DAILY_CLOSURE_AUTOMATION_ENABLED=false
```

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
$env:DB_SSL_MODE="require"
$env:DB_POOL_MAX="5"
$env:TRUST_PROXY_HOPS="1"
$env:RATE_LIMIT_WINDOW_MS="60000"
$env:RATE_LIMIT_MAX="120"
npm.cmd run db:migrate
```

## 5. Vercel Frontend

Vercel project:

```text
Repo: suleymankuncan-web/CODEX
Branch: main
Root Directory: admin-web
Framework: Vite
Build Command: npm run build
Output Directory: dist
```

Frontend env:

```env
VITE_API_BASE_URL=https://api-staging.hr-axis.com/api
VITE_AUTH_MODE=bearer
VITE_AUTH_PROVIDER=clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cmVsYXRpdmUtZ2F6ZWxsZS00Ny5jbGVyay5hY2NvdW50cy5kZXYk
VITE_CLERK_JWT_TEMPLATE=hr-axis-api
```

## 6. DNS

```text
staging.hr-axis.com -> Vercel custom domain target
api-staging.hr-axis.com -> Render custom domain target
```

Ilk dogrulamada Cloudflare proxy `DNS only` kalabilir.

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

Smoke tamamlanmadan pilot gate acilmaz.
