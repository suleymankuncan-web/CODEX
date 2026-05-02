# HR Axis Staging Auth Runbook

Tarih: 2026-05-01

Bu runbook, `hr-axis.com` icin gercek internette calisan staging ortamini kurmak ve Clerk authentication + HR Axis DB authorization kanitini almak icin kullanilir.

## Hedef Mimari

- Domain/DNS: Cloudflare, `hr-axis.com`
- Staging frontend: `https://staging.hr-axis.com`
- Staging API: `https://api-staging.hr-axis.com`
- Authentication: Clerk
- Database: Supabase Postgres
- Authorization: HR Axis Postgres DB (`ops.user_account`, role/scope assignment tablolari)
- Backend auth mode: JWT + remote JWKS
- Packaging: Docker image veya platform build. Docker kalici paketleme standardidir; ileride App Platform, Droplet, Kubernetes veya baska hosta tasinsa bile image contract korunur.
- Reverse proxy: Cloudflare edge + origin HTTPS. Droplet secilirse Caddy/Nginx sadece origin routing/TLS katmani olur, uygulama mimarisinin merkezi degildir.

## Hesaplar ve Satin Alma

1. Cloudflare
   - Tamamlandi: `hr-axis.com` Cloudflare uzerinde.
   - Yapilacak: DNS kayitlari eklenecek.

2. Clerk
   - Yeni application: `HR Axis Staging`
   - Environment: development veya staging olarak ayrilmis Clerk instance.
   - Sign-in method V1: email + password veya email code.
   - SMS OTP V1'de acilmayacak.
   - Clerk Organizations V1'de kullanilmayacak; yetki HR Axis DB'de.

3. Hosting
   - Ana yol frontend: Vercel.
   - Ana yol backend: Render Web Service.
   - Ana yol database: Supabase Postgres.
   - Koyeb bu hesapta Pro plan zorunlulugu gosterdigi icin no-go.
   - B plani: DigitalOcean App Platform veya DigitalOcean Basic Droplet + Docker Compose.

Repo icindeki hazir deploy paketi: `infra/staging/README.md`.
Aktif Render + Supabase + Vercel kurulumu: `docs/deployment/render-supabase-vercel-staging.md`.
Aktif Supabase + Vercel kurulumu: `docs/deployment/supabase-vercel-staging.md`.
Koyeb no-go notu: `docs/deployment/koyeb-staging.md`.
App Platform B plani: `docs/deployment/digitalocean-app-platform-staging.md`.

## Cloudflare DNS

Kayitlar:

```text
Type   Name          Target
CNAME  staging       <frontend host target>
CNAME  api-staging   <api host target>
```

Droplet kullanilirsa:

```text
Type  Name          Target
A     staging       <droplet public ip>
A     api-staging   <droplet public ip>
```

Cloudflare proxy turuncu bulut acik kalabilir. Origin tarafinda HTTPS hazir olmadan `Full (strict)` moduna gecilmez.

## Clerk Ayarlari

Clerk Dashboard icinde:

1. Application olustur: `HR Axis Staging`.
2. API keys sayfasindan al:
   - Publishable key: `VITE_CLERK_PUBLISHABLE_KEY`
   - Secret key: simdilik backend'e gerekmez, frontend'e asla konmaz.
   - Frontend API URL / Issuer URL.
   - JWKS URL: Frontend API URL sonuna `/.well-known/jwks.json`.
3. Allowed origins / redirect ayarlari:
   - `https://staging.hr-axis.com`
   - lokal test icin gerekiyorsa `http://localhost:5173`
4. Token:
   - Default Clerk session token yeterli olabilir.
   - Custom JWT template acilacaksa adi `hr-axis-api` olsun ve frontend env `VITE_CLERK_JWT_TEMPLATE=hr-axis-api` yapilsin.
   - Token icine rol/scope koyma; rol/scope HR Axis DB'den gelir.

Not: Clerk session token `sub` claim'i Clerk user id'dir. Biz bunu `ops.user_account.provider_subject` ile eslestiriyoruz.

## Backend Env

Staging backend icin minimum:

```env
NODE_ENV=production
APP_NAME=hr-axis-staging-api
APP_PORT=3000
DATABASE_URL=postgres://...
DB_SSL_MODE=require

AUTH_MODE=jwt
AUTH_PROVIDER_KEY=clerk
ALLOW_MOCK_AUTH=false

JWT_ISSUER=<Clerk Frontend API / issuer URL>
JWT_JWKS_URL=<Clerk JWKS URL>
JWT_AUDIENCE=<beklenen audience veya Clerk azp/client policy ile uyumlu deger>
AUTH_CLIENT_ID=<Clerk publishable/client id kaniti icin kaydedilen deger>

CORS_ALLOWED_ORIGINS=https://staging.hr-axis.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
```

Kritik not: Backend `JWT_AUDIENCE` dogruluyor. Clerk default tokeninda `aud` yoksa staging smoke'da 401 gorursun. Bu durumda ya Clerk custom JWT template icinde `aud` claim'i eklenir ya da backend audience policy ayri bir task ile Clerk `azp` uyumlu hale getirilir. Pilot oncesi bu smoke ile kesinlestirilecek.

## Frontend Env

Staging frontend icin:

```env
VITE_API_BASE_URL=https://api-staging.hr-axis.com/api
VITE_AUTH_MODE=bearer
VITE_AUTH_PROVIDER=clerk
VITE_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
VITE_CLERK_JWT_TEMPLATE=hr-axis-api
```

Custom JWT template kullanilmiyorsa `VITE_CLERK_JWT_TEMPLATE` bos birakilabilir.

## DB Seed Kaniti

Smoke kullanicisi icin staging DB'de kayit:

```sql
INSERT INTO ops.user_account (
  user_id,
  employee_id,
  username,
  email,
  auth_provider,
  provider_subject,
  is_active,
  created_at,
  updated_at
) VALUES (
  '<uuid>',
  '<employee_uuid>',
  'staging.hr.admin',
  '<smoke email>',
  'clerk',
  '<Clerk user id: user_...>',
  true,
  NOW(),
  NOW()
);
```

Bu kullaniciya verilecek rol:

- Ilk smoke icin: `SUPER_ADMIN` veya `HR_ADMIN`.
- Pilot gercegine yakin smoke icin: ayrica `STORE_MANAGER`, `REGION_MANAGER`, `VISUAL_MERCHANDISER` gibi dar kapsamli kullanicilar eklenir.

Magaza kaniti:

- Assigned store id: kullanicinin gorebilecegi/aksiyon alabilecegi staging magaza.
- Unassigned store id: kullanicinin gormemesi veya islem yapamamasi gereken staging magaza.

Bu iki id olmadan "scope calisiyor" kaniti tamam sayilmaz.

## Smoke Checklist

1. DNS cozuluyor:
   - `https://staging.hr-axis.com`
   - `https://api-staging.hr-axis.com/api/health` veya mevcut health endpoint.
2. Clerk login calisiyor.
3. Frontend Clerk tokeni bearer session'a ceviriyor.
4. Backend `GET /api/auth/session` cagrisinda:
   - HTTP 200
   - `authProvider=clerk`
   - `providerSubject=<Clerk user id>`
   - DB rolleri donuyor.
5. Assigned store icin izinli endpoint 200.
6. Unassigned store icin ayni aksiyon 403 veya bos sonuc.
7. HR admin bir kullaniciyi deactivate ediyor:
   - user inactive oluyor
   - role grants kapaniyor
   - action store grants kapaniyor
   - mobile sessions revoked oluyor
8. Offboarding approval smoke:
   - ilgili employee offboard edilince bagli user access kapanir.

## Kanit Formu

Pilot gate'e eklenecek minimum kanit:

```text
Staging frontend URL:
Staging API URL:
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

## Riskler

- Audience riski: Clerk default token `aud` claim'i backend beklentisiyle uymazsa 401 olur. Cozum: Clerk JWT template veya backend Clerk token policy task'i.
- Subject eslesme riski: Clerk `user_...` degeri DB `provider_subject` alanina dogru yazilmazsa kullanici login olur ama HR Axis session acilmaz.
- DB seed riski: rol/scope seed eksikse login basarili gorunur ama uygulama bos/403 davranir.
- Staging veri riski: gercek assigned/unassigned store id olmadan scope kaniti alinmis sayilmaz.
- Maliyet riski: Keycloak sunucusu yerine Clerk secildigi icin auth server maliyeti dusuk kalir; ama hosting + Postgres maliyeti yine ayrica takip edilir.

## Kaynaklar

- Clerk React quickstart: https://clerk.com/docs/react/getting-started/quickstart
- Clerk `useAuth().getToken()`: https://clerk.com/docs/react/reference/hooks/use-auth
- Clerk session token/JWKS: https://clerk.com/docs/how-to/validate-session-tokens
