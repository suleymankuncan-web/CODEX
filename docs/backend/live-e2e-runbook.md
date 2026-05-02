# Live E2E Runbook

## Amaç
- Gerçek PostgreSQL + Redis + worker akışıyla canlı doğrulama yapmak.
- Faz 3C için gerekli readiness adımlarını tek yerde toplamak.

## Kullanılan Dosyalar
- Infra stack: `infra/docker-compose.live-e2e.yml`
- Env örneği: `backend/nestjs/.env.live-e2e.example`
- Live test runner: `backend/nestjs/test/live/live-e2e.ts`
- Reference seed: `db/seeds/001_reference_seed.sql`

## Demo Self-Performance Seed
- `db/seeds/001_reference_seed.sql` includes the local demo region, stores, employees, assignments, and April 2026 personnel KPI actuals used by `/store/me`.
- Keycloak local users in `infra/keycloak/store-ops-realm.json` and `infra/scripts/setup-keycloak.ps1` must stay aligned with these seeded `DEMO-EMP-*` external employee refs and demo store IDs.
- `backend/nestjs/src/modules/store-ops/demo-performance-seed-contract.spec.ts` protects this alignment.
- Expected local smoke user: `store.personnel` opens `/store/me` with `DEMO-EMP-202` in store `00000000-0000-0000-0000-000000000100`.

## Store-Me API Smoke
- `backend/nestjs/scripts/store-me-smoke.ts` checks `GET /api/reports/my-performance?mode=live` without the browser UI layer.
- NPM command:

```powershell
Set-Location backend\nestjs
npm run smoke:store-me
```

- Default mock-auth scope uses `STORE_PERSONNEL`, `DEMO-EMP-202`, company `00000000-0000-0000-0000-000000000001`, region `00000000-0000-0000-0000-000000000010`, and store `00000000-0000-0000-0000-000000000100`.
- JWT/staging mode can be run by setting `STORE_ME_SMOKE_TOKEN` or `SMOKE_AUTH_TOKEN`; when a token is present the script sends only `Authorization: Bearer <token>`.
- The script fails if the live response does not include employee identity, scored `TARGET_ACHIEVEMENT`/`ATV`/`UPT` metrics, positive score, Turkey rank, and store rank.
- Useful overrides: `STORE_ME_SMOKE_BASE_URL`, `STORE_ME_SMOKE_EMPLOYEE_ID`, `STORE_ME_SMOKE_EXPECTED_EMPLOYEE_ID`, `STORE_ME_SMOKE_COMPANY_ID`, `STORE_ME_SMOKE_REGION_ID`, `STORE_ME_SMOKE_STORE_ID`, `STORE_ME_SMOKE_REQUIRED_METRICS`.
- `npm run rehearse:release` also runs this smoke against the Docker-backed seeded rehearsal app in `AUTH_MODE=mock`.

## Ön Koşullar
- Docker Desktop kurulu olmalı.
- WSL 2 backend hazır olmalı.
- Windows restart gerektiren feature kurulumu tamamlanmış olmalı.
- `docker version` ve `docker info` başarılı dönmeli.
- `wsl -l -v` komutu dağıtım/engine durumunu gösterebilmeli.

## Beklenen Env

```env
APP_PORT=3000
AUTH_MODE=mock
QUEUE_BACKEND=bullmq
DATABASE_URL=postgres://postgres:postgres@localhost:54329/store_ops_live
REDIS_URL=redis://localhost:6389
QUEUE_IMPORT_NAME=store-ops-import
QUEUE_SNAPSHOT_NAME=store-ops-snapshot
```

## Çalıştırma Adımları
1. Docker engine'in hazır olduğunu doğrula:

```powershell
& 'C:\Program Files\Docker\Docker\resources\bin\docker.exe' version
& 'C:\Program Files\Docker\Docker\resources\bin\docker.exe' info
```

2. Live infra stack'i ayağa kaldır:

```powershell
& 'C:\Program Files\Docker\Docker\resources\bin\docker.exe' compose -f infra\docker-compose.live-e2e.yml up -d
& 'C:\Program Files\Docker\Docker\resources\bin\docker.exe' compose -f infra\docker-compose.live-e2e.yml ps
```

3. Backend çalışma klasörüne geç ve live env değerlerini yükle:

```powershell
Set-Location backend\nestjs
Get-Content .env.live-e2e.example | ForEach-Object {
  if ($_ -match '^(?<key>[^#=]+)=(?<value>.*)$') {
    [System.Environment]::SetEnvironmentVariable($matches.key, $matches.value, 'Process')
  }
}
```

4. Live E2E doğrulamasını çalıştır:

```powershell
npm run test:live
```

5. İş bittiğinde infra'yı kapat:

```powershell
Set-Location ..\..
& 'C:\Program Files\Docker\Docker\resources\bin\docker.exe' compose -f infra\docker-compose.live-e2e.yml down -v
```

## Testin Doğruladığı Akış
- PostgreSQL bağlantısı açılır.
- `db/schema.sql`, `db/seeds/001_reference_seed.sql` ve `db/jobs/generate_snapshots.sql` uygulanır.
- Worker context ayağa kalkar.
- API app ayağa kalkar.
- `POST /api/snapshots/runs` çağrısı ile snapshot enqueue edilir.
- Worker, snapshot run'ı tamamlanmış duruma taşır.
- `POST /api/integrations/import-batches` çağrısı ile import enqueue edilir.
- Worker, import batch'i terminal bir duruma taşır.

## 18 Nisan 2026 Doğrulama Notu
- Bu workspace içinde Docker CLI bulundu:
  - `C:\Program Files\Docker\Docker\resources\bin\docker.exe`
- Ancak canlı doğrulama aynı tarihte tamamlanamadı.
- Gözlenen blokajlar:
  - `docker version` ve `docker info` -> Docker Desktop Linux engine pipe üstünden `500 Internal Server Error`
  - `docker compose ... up -d` -> image inspect aşamasında aynı `500` hatası
  - `wsl -l -v` -> WSL kurulu değil hatası
- Kurulum logu da aynı gün Windows feature etkinleştirmesinden sonra restart gerektiğini gösteriyor.

## Sorun Giderme

### Belirti
- `docker version` veya `docker compose` komutları `500 Internal Server Error` dönüyor.

### Olası neden
- Docker Desktop kurulmuş ama WSL 2 backend henüz hazır değil.
- Windows restart henüz yapılmadı.
- Docker Desktop engine açılmış görünüyor fakat Linux engine sağlıklı başlatılamıyor.

### Çözüm sırası
1. Makineyi yeniden başlat.
2. Gerekirse elevated terminalde `wsl --install` veya eksik WSL bileşen kurulumunu tamamla.
3. `wsl -l -v` ve `docker info` başarılı olana kadar engine durumunu doğrula.
4. Ardından bu runbook'taki live E2E adımlarını tekrar çalıştır.

## Faz 3C Çıkışı
- `npm run test:live` başarılı geçtiğinde canlı infra doğrulaması tamamlanmış sayılır.
- Sonraki adım operational monitoring contract ve release readiness pass olacaktır.
