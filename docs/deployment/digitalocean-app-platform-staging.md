# HR Axis DigitalOcean App Platform Staging B Plani

Tarih: 2026-05-01

Bu dosya artik aktif staging rotasi degildir. Aktif rota `docs/deployment/supabase-vercel-staging.md` icindeki Supabase Postgres + Vercel frontend yoludur.

Bu yol Droplet yolu degildir. Bos Linux sunucu kiralamiyoruz; DigitalOcean App Platform frontend ve backend component'lerini GitHub'dan build edip calistirir. Docker/Caddy dosyalari diger B planidir.

## Neyi Satin Alacagiz?

1. DigitalOcean Managed PostgreSQL
   - En kucuk staging plan yeterli.
   - DB adini `hr_axis_staging` gibi tut.
   - Connection string gizli degerdir; chat'e veya git'e yazilmaz.

2. DigitalOcean App Platform
   - Tek app: `hr-axis-staging`
   - Component 1: backend web service, `hr-axis-api`
   - Component 2: frontend static site, `hr-axis-web`

3. Clerk
   - App: `HR Axis Staging`
   - JWT template: `hr-axis-api`

## Sirali Ekran Akisi

### 1. GitHub

App Platform GitHub repo'dan deploy alir. Repo GitHub'da yoksa once GitHub'a private repo olarak cikart.

Gerekli bilgi:

```text
GitHub repo: <owner>/<repo>
Branch: main veya staging icin kullanacagimiz branch
```

### 2. Clerk

Clerk Dashboard:

1. `Create application`
2. Name: `HR Axis Staging`
3. Sign-in method: email
4. JWT template:
   - Name: `hr-axis-api`
   - `aud` claim: `hr-axis-api`

Alinacak degerler:

```text
VITE_CLERK_PUBLISHABLE_KEY=
JWT_ISSUER=
JWT_JWKS_URL=
AUTH_CLIENT_ID=
JWT_AUDIENCE=hr-axis-api
```

### 3. Managed Postgres

DigitalOcean:

1. `Databases`
2. `Create Database Cluster`
3. Engine: PostgreSQL
4. Region: Frankfurt veya sana en yakin Avrupa region
5. Plan: en kucuk staging plan
6. DB user/password ve connection string'i al

Backend env:

```text
DATABASE_URL=<managed postgres connection string>
DB_SSL_MODE=require
```

### 4. App Platform

DigitalOcean:

1. `Create`
2. `App Platform`
3. Source: GitHub
4. Repo: HR Axis repo
5. App name: `hr-axis-staging`

Backend component:

```text
Type: Web Service
Name: hr-axis-api
Source directory: backend/nestjs
Build command: npm ci && npm run build
Run command: node dist/src/main.js
HTTP port: 3000
Health check path: /api/health
Instance size: apps-s-1vcpu-1gb-fixed
```

Frontend component:

```text
Type: Static Site
Name: hr-axis-web
Source directory: admin-web
Build command: npm ci && npm run build
Output directory: dist
Fallback/catchall document: index.html
```

Repo'da template olarak hazir dosya var:

```text
.do/app-staging.template.yaml
```

Bu dosya dogrudan deploy icin degil; `CHANGE_ME` alanlari doldurulmadan `.do/app.yaml` yapilmaz.

### 5. App Platform Env

Backend env:

```text
NODE_ENV=production
APP_NAME=hr-axis-staging-api
APP_PORT=3000
DATABASE_URL=<secret>
DB_POOL_MAX=20
DB_SSL_MODE=require
AUTH_MODE=jwt
AUTH_PROVIDER_KEY=clerk
ALLOW_MOCK_AUTH=false
JWT_ISSUER=<Clerk issuer>
JWT_JWKS_URL=<Clerk JWKS>
JWT_AUDIENCE=hr-axis-api
AUTH_CLIENT_ID=<Clerk client/publishable id>
CORS_ALLOWED_ORIGINS=https://staging.hr-axis.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
QUEUE_BACKEND=in-memory
DAILY_CLOSURE_AUTOMATION_ENABLED=false
```

Frontend env:

```text
VITE_API_BASE_URL=https://api-staging.hr-axis.com/api
VITE_AUTH_MODE=bearer
VITE_AUTH_PROVIDER=clerk
VITE_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
VITE_CLERK_JWT_TEMPLATE=hr-axis-api
```

### 6. Domain ve DNS

App Platform custom domains ekraninda:

```text
staging.hr-axis.com
api-staging.hr-axis.com
```

DigitalOcean sana CNAME target verecek. Cloudflare DNS'e bu kayitlar eklenecek:

```text
Type   Name          Target
CNAME  staging       <DigitalOcean target>
CNAME  api-staging   <DigitalOcean target>
```

Ilk dogrulamada Cloudflare proxy `DNS only` daha sorunsuzdur. Domain live olduktan sonra proxy acilabilir.

### 7. Migration

Staging DB hazir olunca migration'i bir kere calistir:

```powershell
cd D:\store-ops-workspace\backend\nestjs
$env:NODE_ENV="production"
$env:DATABASE_URL="<managed-postgres-url>"
$env:DB_SSL_MODE="require"
$env:RATE_LIMIT_WINDOW_MS="60000"
$env:RATE_LIMIT_MAX="120"
npm.cmd run db:migrate
```

Gercek connection string kanit dokumanina yazilmaz.

### 8. Smoke

```text
https://staging.hr-axis.com
https://api-staging.hr-axis.com/api/health
https://api-staging.hr-axis.com/api/auth/session
```

Smoke kullanicisi Clerk'te login olur, DB'deki `ops.user_account.provider_subject` Clerk `user_...` id'siyle eslesir.

## Karar

Ana yol:

```text
Supabase Postgres + Vercel frontend + Clerk
```

B plani:

```text
DigitalOcean App Platform veya Droplet + Docker Compose + Caddy
```

Bugun Droplet acmiyoruz.
