# HR Axis Staging Deploy

Bu klasor `staging.hr-axis.com` ve `api-staging.hr-axis.com` icin ilk gercek staging paketidir. Docker burada kalici paketleme standardi: ileride Droplet'ten App Platform, Kubernetes veya baska hosta gecsek bile image contract ayni kalir.

## 1. Alinacaklar

- Cloudflare domain: tamam, `hr-axis.com`.
- Clerk application: `HR Axis Staging`.
- Hosting: DigitalOcean Droplet veya ayni Docker Compose'u calistirabilecek baska Linux server.
- Postgres: onerilen DigitalOcean Managed Postgres. Butce kisiksa staging icin server-local Postgres kullanilabilir, ama pilot kaniti icin yedekleme riski ayrica not edilir.

Redis V1 icin sart degil. `.env.staging` icinde `QUEUE_BACKEND=in-memory` kalabilir.

## 2. DNS

Droplet public IP geldikten sonra Cloudflare DNS'e ekle:

```text
Type  Name          Content
A     staging       <droplet_public_ip>
A     api-staging   <droplet_public_ip>
```

Ilk sertifika alinana kadar proxy status `DNS only` kullanmak daha az sorun cikarir. Caddy HTTPS sertifikasini aldiktan sonra Cloudflare proxy acilabilir ve SSL/TLS modu `Full (strict)` yapilabilir.

## 3. Server Hazirligi

Server uzerinde Docker ve Compose plugin kurulu olmali. Repo server'a geldikten sonra:

```bash
cd /opt/hr-axis/infra/staging
cp .env.staging.example .env.staging
```

`.env.staging` icindeki bos alanlari doldur:

- `DATABASE_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `JWT_ISSUER`
- `JWT_JWKS_URL`
- `JWT_AUDIENCE`
- `AUTH_CLIENT_ID`

Clerk tarafinda custom JWT template kullanirsak template adi `hr-axis-api` kalsin. Kullanmazsak `VITE_CLERK_JWT_TEMPLATE` bos olabilir, fakat backend `JWT_AUDIENCE` ile token `aud` claim'i uyusmak zorunda.

## 4. Migration

Uygulamayi acmadan once staging DB migration calistir:

```bash
cd /opt/hr-axis/backend/nestjs
NODE_ENV=production \
DATABASE_URL="postgres://..." \
DB_SSL_MODE=require \
RATE_LIMIT_WINDOW_MS=60000 \
RATE_LIMIT_MAX=120 \
npm run db:migrate
```

Windows lokalden calistirilacaksa ayni degerler PowerShell env olarak set edilip `npm.cmd run db:migrate` kullanilir.

## 5. Build ve Calistirma

```bash
cd /opt/hr-axis/infra/staging
docker compose --env-file .env.staging build
docker compose --env-file .env.staging up -d
docker compose --env-file .env.staging ps
```

Frontend env degerleri build-time oldugu icin Clerk publishable key veya API base URL degisirse frontend image yeniden build edilir.

## 6. Health Kontrol

```bash
curl -fsS https://staging.hr-axis.com/health
curl -fsS https://api-staging.hr-axis.com/api/health
```

API health DB'yi de kontrol eder. `QUEUE_BACKEND=in-memory` iken Redis health skip edilir.

## 7. Clerk ve DB Kaniti

Staging smoke tamam sayilmasi icin bu degerler kanit formuna yazilir:

```text
Staging frontend URL: https://staging.hr-axis.com
Staging API URL: https://api-staging.hr-axis.com
Clerk issuer / Frontend API URL:
Clerk JWKS URL:
Client id / audience:
Smoke user email:
Smoke user Clerk subject:
Smoke user DB role:
Assigned store id:
Unassigned store id:
/api/auth/session result:
Assigned store smoke result:
Unassigned store smoke result:
Deactivate smoke result:
Offboarding smoke result:
```

## 8. Operasyon Notlari

- `.env.staging` git'e girmez.
- Cloudflare, Clerk ve DigitalOcean hesaplarinda 2FA acik tutulur.
- Production verisi staging'e kopyalanmaz; staging icin kucuk, kontrollu seed kullanilir.
- HR Axis authorization kaynagi DB'dir. Clerk sadece authentication yapar.

