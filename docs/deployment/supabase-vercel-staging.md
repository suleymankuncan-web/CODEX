# HR Axis Supabase + Vercel Staging

Tarih: 2026-05-02

Bu dosya aktif staging rotasidir. Amac en dusuk maliyetle gercek internette calisan frontend ve gercek Postgres kaniti almak.

## Secilen Stack

```text
Domain/DNS: Cloudflare, hr-axis.com
Frontend: Vercel
Database: Supabase Postgres
Authentication: Clerk
Authorization: HR Axis DB
Backend hosting: pending
```

Backend hosting icin Koyeb degerlendirmesi ayrica yazildi: `docs/deployment/koyeb-staging.md`. NestJS backend uzun sureli Node process olarak calisir; Vercel serverless'a tasimak ayri adapter/refactor ister.

## Satin Alma ve Uyelik Listesi

1. Cloudflare
   - Tamamlandi: `hr-axis.com`.
   - Yapilacak: `staging` ve `api-staging` DNS kayitlari.

2. Clerk
   - Tamamlandi: `HR Axis Staging` app.
   - JWT template: `hr-axis-api`.
   - Frontend publishable key public env olarak girilir.
   - Secret key chat'e/git'e yazilmaz.

3. Supabase
   - Yeni project: `hr-axis-staging`.
   - Database name: `hr_axis_staging`.
   - PostgreSQL version: mumkunse 16.
   - Sadece Postgres kullanilir.
   - Supabase Auth, Storage ve Realtime V1 staging scope'una dahil degildir.

4. Vercel
   - Frontend project: `hr-axis-web-staging`.
   - Root directory: `admin-web`.
   - Build command: `npm run build`.
   - Output directory: `dist`.

5. Backend hosting
   - Aktif aday: Koyeb Web Service.
   - Diger adaylar: Render, Fly.io, Railway, DigitalOcean App Platform, Droplet + Docker Compose.
   - Secim kriteri: persistent Node service, custom domain, HTTPS, env secrets, uygun free/low-cost plan.

## Supabase Ayarlari

Supabase dashboard icinde:

1. `New project`.
2. Project name: `hr-axis-staging`.
3. Database password olustur ve guvenli sakla.
4. Region: Europe'a en yakin bolge.
5. PostgreSQL version: 16 varsa 16.

Backend icin connection string:

```text
Project Settings -> Database -> Connection string
```

Tercih:

```text
Session pooler URI
```

Backend env:

```env
DATABASE_URL=<Supabase session pooler URI>
DB_SSL_MODE=require
DB_POOL_MAX=5
```

Connection string ve password kanit dokumanina yazilmaz.

## Vercel Ayarlari

Vercel dashboard:

1. `Add New Project`.
2. GitHub repo: `suleymankuncan-web/CODEX`.
3. Branch: `codex/clerk-auth-db-lifecycle` veya staging icin merge edilen branch.
4. Root directory: `admin-web`.
5. Framework preset: Vite.
6. Build command: `npm run build`.
7. Output directory: `dist`.

Frontend env:

```env
VITE_API_BASE_URL=https://api-staging.hr-axis.com/api
VITE_AUTH_MODE=bearer
VITE_AUTH_PROVIDER=clerk
VITE_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
VITE_CLERK_JWT_TEMPLATE=hr-axis-api
```

SPA fallback icin repo'da `admin-web/vercel.json` bulunur. Bu dosya React Router route refresh'lerinde `index.html`'e rewrite yapar.

## Backend Env Kontrati

Backend hangi provider'a giderse gitsin minimum runtime env:

```env
NODE_ENV=production
APP_NAME=hr-axis-staging-api
APP_PORT=3000
DATABASE_URL=<Supabase session pooler URI>
DB_POOL_MAX=5
DB_SSL_MODE=require
AUTH_MODE=jwt
AUTH_PROVIDER_KEY=clerk
ALLOW_MOCK_AUTH=false
JWT_ISSUER=https://relative-gazelle-47.clerk.accounts.dev
JWT_JWKS_URL=https://relative-gazelle-47.clerk.accounts.dev/.well-known/jwks.json
JWT_AUDIENCE=hr-axis-api
AUTH_CLIENT_ID=<Clerk publishable/client id>
CORS_ALLOWED_ORIGINS=https://staging.hr-axis.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
QUEUE_BACKEND=in-memory
DAILY_CLOSURE_AUTOMATION_ENABLED=false
```

## Migration

Supabase DB hazir olunca migration staging DB'ye bir kere calistirilir:

```powershell
cd D:\store-ops-workspace\backend\nestjs
$env:NODE_ENV="production"
$env:DATABASE_URL="<Supabase session pooler URI>"
$env:DB_SSL_MODE="require"
$env:DB_POOL_MAX="5"
$env:RATE_LIMIT_WINDOW_MS="60000"
$env:RATE_LIMIT_MAX="120"
npm.cmd run db:migrate
```

## DNS

Frontend:

```text
staging.hr-axis.com -> Vercel custom domain target
```

Backend:

```text
api-staging.hr-axis.com -> secilecek backend provider target
```

Cloudflare proxy ilk dogrulamada `DNS only` kalabilir. Provider domain verification tamamlaninca proxy karari ayrica verilir.

## Smoke Gate

Staging kaniti icin:

```text
https://staging.hr-axis.com
https://api-staging.hr-axis.com/api/health
https://api-staging.hr-axis.com/api/auth/session
```

Sonra:

- Clerk login calisir.
- `/api/auth/session` Clerk subject'i DB `provider_subject` ile eslestirir.
- Assigned store smoke 200 veya beklenen veri doner.
- Unassigned store smoke 403 veya bos sonuc doner.
- HR admin deactivate smoke access'i kapatir.
- Offboarding approval smoke bagli user access'i kapatir.
