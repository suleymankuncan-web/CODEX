# HR Axis Koyeb Staging

Tarih: 2026-05-02

Bu rota backend hosting ve Postgres DB'yi ayni platformda tutmak icindir. Frontend icin Vercel Free kullanilir; Koyeb free web service hakki backend'e ayrilir.

## Secilen Stack

```text
Domain/DNS: Cloudflare, hr-axis.com
Frontend: Vercel
Backend: Koyeb Web Service
Database: Koyeb PostgreSQL
Authentication: Clerk
Authorization: HR Axis DB
```

## Neden Koyeb?

- Mevcut NestJS backend uzun sureli Node web service olarak calisir.
- Koyeb GitHub'dan Node app deploy edebilir.
- Koyeb PostgreSQL 16 destekler.
- Koyeb'de free web service ve free database secenekleri vardir.
- Backend ve DB ayni platformda kalir; V1 staging maliyeti dusuk baslar.

## Limit ve Riskler

- Free web service staging/demo icindir, production icin degildir.
- Free web service uyuyabilir veya scale-to-zero davranisi gosterebilir.
- Free DB'nin compute/storage limitleri vardir; pilot kaniti icin uygundur ama surekli yukte paid plana gecmek gerekebilir.
- Koyeb free web service hakkini backend'e ayirdigimiz icin frontend Vercel'de kalir.
- DB connection string, password ve Clerk secret degerleri chat'e/git'e yazilmaz.

## 1. Koyeb Database

Koyeb dashboard:

```text
Databases -> Create Database Service
```

Secimler:

```text
Name: hr-axis-staging-db
Region: Frankfurt
Engine: PostgreSQL 16
Instance type: free
Default role: hr_axis
```

Olustuktan sonra connection bilgisini al:

```text
DATABASE_URL=<Koyeb PostgreSQL URI>
```

SSL zorunlu gosteriliyorsa backend env:

```env
DB_SSL_MODE=require
```

Koyeb private/internal connection string kullaniliyorsa ve SSL gerekmiyorsa:

```env
DB_SSL_MODE=disable
```

Staging icin DB pool:

```env
DB_POOL_MAX=5
```

## 2. Koyeb Backend Service

Koyeb dashboard:

```text
Create App -> Web Service -> GitHub
```

Secimler:

```text
Repository: suleymankuncan-web/CODEX
Branch: codex/clerk-auth-db-lifecycle
Root directory: backend/nestjs
Builder: Buildpack veya Dockerfile
Build command: npm ci && npm run build
Run command: node dist/main.js
Exposed/Public port: 3000
Instance type: free
Service name: hr-axis-api
```

Health check:

```text
Type: HTTP
Path: /api/health
Port: 3000
```

## 3. Backend Env

Minimum runtime env:

```env
NODE_ENV=production
APP_NAME=hr-axis-staging-api
APP_PORT=3000
DATABASE_URL=<Koyeb PostgreSQL URI>
DB_POOL_MAX=5
DB_SSL_MODE=<require or disable>
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

`DATABASE_URL` secret olarak girilir.

## 4. Migration

DB olustuktan sonra migration lokalden staging DB'ye calistirilir:

```powershell
cd D:\store-ops-workspace\backend\nestjs
$env:NODE_ENV="production"
$env:DATABASE_URL="<Koyeb PostgreSQL URI>"
$env:DB_SSL_MODE="<require or disable>"
$env:DB_POOL_MAX="5"
$env:RATE_LIMIT_WINDOW_MS="60000"
$env:RATE_LIMIT_MAX="120"
npm.cmd run db:migrate
```

## 5. DNS

Koyeb backend icin public domain verir:

```text
https://<service>.<org>.koyeb.app
```

Cloudflare DNS:

```text
api-staging.hr-axis.com -> Koyeb custom domain target
```

Vercel frontend:

```text
staging.hr-axis.com -> Vercel custom domain target
```

## 6. Smoke

```text
https://api-staging.hr-axis.com/api/health
https://api-staging.hr-axis.com/api/auth/session
https://staging.hr-axis.com
```

Smoke tamamlanmadan pilot gate acilmaz.

