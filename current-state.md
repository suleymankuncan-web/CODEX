# Current State

Bu dosya projeyi yeni bir konusma penceresinde ayni noktadan devam ettirmek icin kanonik handoff ozetidir.

## Aktif Proje Yollari

Eski `E:\WEBSİTE ÇALIŞMASI` ve flash bellek yolu artik aktif proje yolu degildir. Bundan sonra aktif proje masaustundeki klasordur.

Aktif workspace:

```powershell
C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI
```

Backend:

```powershell
C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs
```

Frontend:

```powershell
C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web
```

Infra / Keycloak:

```powershell
C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\infra
```

Plan dokumanlari:

```powershell
C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\docs\plans
```

Yerel skill klasoru:

```powershell
C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\SKILL
```

Calisma notu:

- Yeni islerde ilgili yerel skill dosyalari kontrol edilmeli ve uygun olanlar kullanilmali.
- Anlamli yeni feature/workflow/data/permission islerinde once `docs/plans/request-intake-and-decision-policy.md` icindeki 6 soruluk Feature Intake Interview Gate uygulanmali; auth/scope, veri, audit, reporting, import/KPI ve test etkisi netlesmeden dogrudan kodlanmamali.
- Yeni anlamli modül veya feature kararlarinda `CODEX DÜRÜST YORUM` basligi altinda urun hissi, dogru modül siniri, ikinci kaynak riski, teknik borc, V1 siniri ve devam/sekillendir/erteleyelim tavsiyesi acikca yazilmali.
- Her is tamamlandiginda kisa sekilde siradaki mantikli adim belirtilmeli.

## Calistirma Komutlari

Backend:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run start:dev
```

Frontend:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run dev
```

Keycloak:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\infra"
docker compose -f docker-compose.keycloak.yml up -d
```

Build kontrolleri:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run build
```

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
```

## Kisa Urun Ozeti

Uygulama artik sadece raporlama paneli degil; rol, scope, approval, acknowledgement, shared inbox, KPI, import ve personel/magaza performansi tasiyan operasyon platformuna evriliyor.

Ana prensip:

- Kullanicilar yetkili olduklari performans verilerini gorebilmeli.
- Operasyonel islem sadece kendilerine atanmis magazalar uzerinden yapilmali.
- `STORE_MANAGER` magaza operasyonunu yonetir.
- `STORE_PERSONNEL` sadece kendi performansini ve kisisel alanini gorur.
- `REGION_MANAGER` hedef onaylari ve ileride kendi atanmis magazalari uzerinde saha aksiyonlari icin ayrildi.

## Son Operational Feed V1

26 Nisan 2026 itibariyla `Operational Feed V1` tamamlandi. `Competition Format Registry V1` yonu bilincli olarak superseded edildi; UPT/ATV/total score gibi odak yarislari V1'de yeni bir skor motoru degil, duyuru/challenge postu olarak ele aliniyor.

Eklenenler:

- DB: `ops.feed_post` tablosu ve `db/migrations/025_operational_feed_posts.sql`.
- Backend:
  - `GET /api/feed`
  - `GET /api/admin/feed`
  - `POST /api/admin/feed`
  - `PUT /api/admin/feed/:feedPostId`
  - `POST /api/admin/feed/:feedPostId/publish`
  - `POST /api/admin/feed/:feedPostId/pin`
  - `POST /api/admin/feed/:feedPostId/unpin`
  - `POST /api/admin/feed/:feedPostId/archive`
- Frontend:
  - `/admin/feed` yonetim yuzeyi
  - `/store/feed` okuma yuzeyi
  - `/store` ana sayfasinda pinned duyuru preview
  - admin nav icinde `Duyurular`, `Inbox` ile `Competitions` arasinda
  - store shell icinde `Duyurular` birinci sinif route

Kurallar:

- Post tipleri: `announcement`, `challenge`.
- Visibility scope: `company`, `region`, `store`.
- `SUPER_ADMIN` ve `HR_ADMIN` company/region/store kapsaminda yayin yapabilir.
- `REGION_MANAGER` V1'de sadece kendi bolgesine, tek region scope ile yayin yapabilir.
- Store kullanicilari sadece yayinlanmis ve scope'una gorunur postlari okur.
- Store-scoped kullanici company postlarini, kendi store postlarini ve store'unun bagli oldugu region postlarini gorebilir.
- Pinned postlar once siralanir; expired yayinlar store feed'den dusurulur.
- Audit eventleri: `feed_post.created`, `feed_post.updated`, `feed_post.published`, `feed_post.pinned`, `feed_post.unpinned`, `feed_post.archived`, `feed_post.scope_changed`.

Sinir:

- Feed challenge postu skor hesaplamaz.
- Feed challenge postu leaderboard materialize etmez.
- Feed challenge postu competition stage, team, package plan, snapshot veya warning olusturmaz/mutate etmez.
- Competition modulu staged competition, stage package, team template, approval/execute ve finalization alani olarak kalir.
- Gorsel, yorum, begeni, push notification ve yeni leaderboard V1 disidir; ileride attachment/push eklenebilir.

Referans:

- `docs/superpowers/specs/2026-04-26-operational-feed-v1-design.md`
- `docs/superpowers/plans/2026-04-26-operational-feed-v1.md`

Dogrulama:

- Backend targeted: `npm.cmd test -- src/modules/store-ops/application/feed.service.spec.ts src/modules/store-ops/infrastructure/feed.repository.spec.ts --runInBand` -> 2 suite / 15 test.
- Frontend targeted: `npm.cmd run build`; `npm.cmd run test:e2e -- e2e/feed-surfaces.spec.ts` -> 4 Playwright test.
- Backend release: `npm.cmd run check:release` -> lint, 30 suite / 242 test, build, `npm audit --omit=dev`.
- Frontend release: `npm.cmd run check:release` -> lint, build, 20 Playwright test, `npm audit --omit=dev`.
- Frontend buildde Vite chunk size warning'i yok.

Siradaki mantikli adim: `DM/CONFIG Boundary Note` yazmak. Mevcut `ops/stg/rpt/audit`, servis icindeki is kurallari, DB config tablolari, job/orchestration ve API/BFF sinirlari dokumante edilmeli; hemen yeni `dm` veya `config` schema acmadan once hangi ihtiyac dogarsa o sinirin tasinacagi netlesmeli.

## Son DM/CONFIG Boundary Strategy

26 Nisan 2026 itibariyla DM/CONFIG mimari siniri proje defterine baglandi.

Yeni dokuman:

- `docs/plans/dm-config-boundary-strategy.md`

Karar:

- Simdilik yeni `dm` schema yok.
- Simdilik yeni `config` schema yok.
- Mevcut fiziksel schema modeli korunuyor: `ops`, `stg`, `rpt`, `audit`.
- `DM` su an "domain model / decision model" olarak application service, typed contract, repository query ve testlerde yasayan kavramsal is kurali siniri.
- `CONFIG` uce ayrildi:
  - runtime/env config: `AppConfigService`
  - module-owned data config: ornegin `ops.kpi_score_profile_config`, `stg.integration_source` schedule alanlari, `ops.role/permission`
  - UI/localization config: ileride label dictionary/i18n katmani
- `JOB` su an `shared/jobs`, BullMQ/in-memory dispatcher, worker host ve scheduler kod katmani; ayri job schema gerekmiyor.
- `API/BFF` su an Nest controller + frontend feature API helper katmani; standalone BFF icin henuz tekrarli aggregation ihtiyaci yok.

Ek hizalama:

- `ops.kpi_score_profile_config` migration ve backend tarafinda kullaniliyordu; canonical `db/schema.sql` icine de eklendi.

Gelecekte `dm` veya `config` schema acma tetikleri:

- kural/config birden fazla modul tarafindan kullaniliyorsa
- draft/publish veya approval lifecycle gerekiyorsa
- audit "hangi rule/config version sonucu uretti" sorusunu cevaplamaliysa
- is kullanicisi UI'dan duzenleyecekse
- simulation, rollback veya version karsilastirma gerekiyorsa

Siradaki mantikli adim: Store/Region competition read experience polish. Admin tarafinda planlama guclendi; store ve bolge kullanicilari icin contribution, warning, ranking ve coverage aciklamalari daha okunur hale getirilmeli.

## Son Store/Region Competition Read Polish

26 Nisan 2026 itibariyla store ve region/admin competition okuma deneyimi guclendirildi.

Eklenenler:

- Frontend helper: `admin-web/src/features/competitions/readability.ts`.
- `/store/competitions` icinde `Read summary` paneli eklendi.
- `/admin/competitions` icinde HR/admin ve region manager read-only gorunumleri icin `Read summary` paneli eklendi.
- Contribution satirlari artik sunlari aciklar:
  - `Contribution health`
  - contribution coverage yuzdesi
  - eksik KPI label'i
  - partial score'un neden partial kaldigi
- Warning satirlari artik insan okunur baslik ve aciklama tasir:
  - `Missing BM checklist`
  - `Missing VM checklist`
  - `Missing daily store data`
- Region manager icin read-only kilidi korunur; `New draft`, `Recalculate`, `Finalize` aksiyonlari gorunmez.

Sinir:

- Yeni backend endpoint yok.
- Yeni DB veya schema yok.
- Skor hesaplama degismedi.
- Competition sadece mevcut score/contribution/warning verisini daha okunur anlatir.

Dogrulama:

- Kirmizi test izlendi: store competition smoke once `Read summary` bulunamadigi icin fail verdi.
- Hedefli store smoke gecti: `npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store competitions"` -> 1 Playwright test.
- Hedefli admin/region smoke gecti: `npm.cmd run test:e2e -- e2e/competition-surfaces.spec.ts -g "admin competitions surface|region manager competitions surface"` -> 2 Playwright test.
- Frontend release gecti: `npm.cmd run check:release` -> lint, build, 20 Playwright smoke testi ve `npm audit --omit=dev`.

Siradaki mantikli adim: Turkish UI Localization Foundation. UI default Turkce olacaksa bunu daginik string editleriyle degil, typed label/i18n temeliyle yapmak gerekiyor.

## Son Turkish UI Localization Foundation V1

26 Nisan 2026 itibariyla frontend icin ilk kontrollu localization temeli baglandi.

Eklenenler:

- `admin-web/src/lib/i18n.ts` artik locale normalize eder, default `tr` tutar ve browser localStorage tercihini okur/yazar.
- `admin-web/src/features/localization/dictionary.ts` typed `tr/en` label sozlugu tasir.
- `admin-web/src/features/localization/LocalizationProvider.tsx` React context ile `locale`, `setLocale` ve `t(key)` saglar.
- `admin-web/src/features/localization/LanguageToggle.tsx` admin ve store shell icinde `TR / EN` segmented dil secici olarak gorunur.
- `/store/competitions` ve `/admin/competitions` read-summary/contribution/warning copy'leri locale uzerinden gelir.
- Default dil Turkce; kullanici EN secerse tercih reload sonrasinda browser localStorage ile korunur.

Sinir:

- Tum uygulama tek seferde cevrilmedi.
- Backend enum, audit code, role code, warning code ve API contract degerleri cevrilmedi; stabil teknik kimlik olarak kaldi.
- User-profile bazli dil tercihi, translator workflow ve tum ekranlar icin genis sozluk V1 disinda birakildi.

Dogrulama:

- Kirmizi test izlendi: yeni Playwright testi once `Okuma özeti` bulunamadigi icin fail verdi.
- Hedefli localization smoke gecti: `npm.cmd run test:e2e -- store-surfaces.spec.ts --grep "language toggle localizes competition read labels"` -> 1 Playwright test.
- Frontend release gecti: `npm.cmd run check:release` -> lint, build, 21 Playwright smoke testi ve `npm audit --omit=dev`.

Siradaki mantikli adim: Real IdP Staging Evidence. Lokal auth akisi iyi durumda; artik staging/gercek provider uzerinde PKCE login/logout evidence toplayip production guvenini artirmak mantikli.

## Son Local Keycloak Real-Provider Evidence

26 Nisan 2026 itibariyla local Keycloak uzerinde production-shaped OIDC authorization code + PKCE smoke kaniti alindi. Bu staging sign-off degildir; staging IdP henuz tanimli olmadigi icin local real-provider evidence olarak kaydedildi.

Eklenenler:

- `admin-web` icin `npm.cmd run smoke:auth:live` script'i eklendi.
- `admin-web` icin `npm.cmd run smoke:auth:action` script'i eklendi; ayni browser login akisini DB-backed action smoke ile genisletir.
- Script browser ile `/auth/login?returnTo=/store` uzerinden Keycloak'a gider.
- `code_challenge_method=S256`, `state` ve `code_challenge` varligini dogrular.
- `store.manager` ile callback/token exchange akisini tamamlar.
- Ham token, authorization code, verifier veya id token kaydetmeden sanitize evidence JSON uretir.
- `/api/auth/session` yanitinda app role/scope/action scope'u dogrular.
- `/auth/logout` uzerinden provider logout URL'ini ve local session temizligini dogrular.
- Sentetik expired JWT ile expired bearer token'in API header'a gitmeden temizlendigini dogrular.
- `smoke:auth:action` atanmis store icin target distribution create aksiyonunu dener ve `201/submitted` bekler.
- `smoke:auth:action` atanmamis store icin ayni aksiyonda `403` bekler.
- Evidence dosyasi: `docs/plans/phase-7-auth-evidence-local-keycloak-2026-04-26.md`.

Ek hardening:

- Backend JWT role extraction artik sadece uygulama rol katalog kodlarini kabul eder.
- Keycloak default rolleri (`offline_access`, `uma_authorization`, `default-roles-store-ops`) access token payload'inda gorunse bile `/api/auth/session` icindeki `roleCodes` alanina tasinmaz.
- `CreateTargetDistributionRequestDto` artik deterministic PostgreSQL UUID formatindaki seeded store id'lerini kabul eder.
- `db/schema.sql` canonical schema'sina `ops.target_distribution_request` tablosu ve index'i eklendi; seeded DB action smoke schema eksiginden dusmez.

Sinir:

- Staging IdP registration kaniti henuz yok.
- DB-backed pozitif/negatif aksiyon smoke local seeded ortamda var.
- Staging ortaminda ayni pozitif/negatif aksiyon kaniti henuz yok.

Dogrulama:

- Kirmizi test izlendi: `JwtAuthProvider` default provider rollerini filtrelemedigi icin test fail verdi.
- Kirmizi test izlendi: seeded store id `00000000-0000-0000-0000-000000000100` target distribution DTO validation'da `400` uretirken fail verdi.
- Kirmizi test izlendi: canonical `db/schema.sql` icinde `ops.target_distribution_request` yokken schema contract testi fail verdi.
- Hedefli backend test gecti: `npm.cmd test -- src/modules/auth/providers/jwt-auth.provider.spec.ts --runInBand` -> 1 suite / 10 test.
- Hedefli backend test gecti: `npm.cmd test -- src/shared/validation/postgres-uuid.spec.ts --runInBand` -> 1 suite / 2 test.
- Hedefli backend test gecti: `npm.cmd test -- test/integration/auth-scope.e2e-spec.ts --runInBand -t "accepts seeded PostgreSQL UUID"` -> 1 test.
- Hedefli backend test gecti: `npm.cmd test -- src/modules/store-ops/demo-performance-seed-contract.spec.ts --runInBand -t "target distribution action tables"` -> 1 test.
- Local live auth smoke gecti: `npm.cmd run smoke:auth:live`.
- Local seeded action smoke gecti: `npm.cmd run smoke:auth:action` -> assigned store `201`, unassigned store `403`.
- Backend release gecti: `npm.cmd run check:release` -> lint, 31 suite / 247 test, build, `npm audit --omit=dev`.
- Frontend release gecti: `npm.cmd run check:release` -> lint, build, 21 Playwright smoke testi, `npm audit --omit=dev`.

Siradaki mantikli adim: real staging IdP + seeded staging action evidence. Artik local OIDC ve local DB-backed action mekanigi saglam; sonraki borc, gercek staging IdP bilgisi ile ayni pozitif/negatif aksiyon kanitlarini staging ortaminda toplamak.

## Son PostgreSQL UUID DTO Validation Contract

26 Nisan 2026 itibariyla seeded UUID validation borcu kalici kalite kapisina baglandi.

Eklenenler:

- Auth ve store-ops web DTO'lari database UUID alanlari icin `class-validator` raw `IsUUID` yerine ortak `IsPostgresUuid` validator'unu kullanir.
- Array alanlarda da `IsPostgresUuid({ each: true })` kullanilir.
- Yeni kontrat testi: `backend/nestjs/src/shared/validation/postgres-uuid-dto-contract.spec.ts`.
- Kontrat testi module web DTO'larinda `IsUUID` tekrar gorurse fail verir.

Dogrulama:

- Kirmizi test izlendi: `npm.cmd test -- src/shared/validation/postgres-uuid-dto-contract.spec.ts --runInBand` once 20 DTO dosyasini offender olarak listeledi.
- Hedefli backend test gecti: `npm.cmd test -- src/shared/validation/postgres-uuid-dto-contract.spec.ts src/shared/validation/postgres-uuid.spec.ts --runInBand` -> 2 suite / 3 test.
- Hedefli integration test gecti: `npm.cmd test -- test/integration/auth-scope.e2e-spec.ts --runInBand -t "accepts seeded PostgreSQL UUID"` -> 1 test.
- Backend release gecti: `npm.cmd run check:release` -> lint, 32 suite / 248 test, build, `npm audit --omit=dev`.

Siradaki mantikli adim: real staging IdP + seeded staging action evidence. Local ve seeded validation/action borcu kapandi; staging provider bilgisi geldiginde ayni pozitif/negatif action smoke'u gercek IdP uzerinde kosmak gerekiyor.

## Son Staging Auth Smoke Guard And Runbook

26 Nisan 2026 itibariyla real staging IdP evidence adimi calistirmaya hazir hale getirildi; staging gecildi diye isaretlenmedi.

Eklenenler:

- Frontend scriptleri:
  - `npm.cmd run smoke:auth:staging`
  - `npm.cmd run smoke:auth:staging:action`
- Yeni script testi:
  - `admin-web/scripts/auth-smoke-config.test.mjs`
- Yeni runbook:
  - `docs/plans/phase-7-staging-auth-smoke-runbook.md`

Guard kurallari:

- Staging modunda local URL veya HTTP URL kabul edilmez.
- Staging modunda local demo credential default'lari kabul edilmez.
- `AUTH_SMOKE_PROVIDER_ISSUER`, `AUTH_SMOKE_JWKS_URL`, provider name ve accepted audience acik env olarak zorunludur.
- Action smoke istenirse assigned/unassigned seeded store ID'leri acik env olarak zorunludur.
- Guard eksikse script network request atmadan fail-fast verir.

Dogrulama:

- Kirmizi test izlendi: staging scriptleri yokken ve guard yokken `npm.cmd run test:scripts` fail verdi.
- Kirmizi test izlendi: issuer/JWKS guard yokken script staging API host'una gitmeye calisti; test fail verdi.
- Hedefli frontend script testi gecti: `npm.cmd run test:scripts` -> 3 Node test.
- Frontend release gecti: `npm.cmd run check:release` -> lint, 3 Node script test, build, 21 Playwright smoke testi, `npm audit --omit=dev`.

Siradaki mantikli adim: real staging IdP registration bilgileri ve seeded staging DB hazir oldugunda `npm.cmd run smoke:auth:staging:action` ile kanit toplamak. Bu adim credential/ortam olmadan tamamlanmis sayilmayacak.

## Son Official Release Check Gate

26 Nisan 2026 itibariyla backend ve frontend kalite kapilari root seviyesinde tek resmi release komutuna baglandi.

Eklenenler:

- Root `package.json`:
  - `npm.cmd run check:release`
  - `npm.cmd run test:scripts`
- Root release runner:
  - `scripts/check-release.mjs`
- Root kontrat testleri:
  - `scripts/release-gate-contract.test.mjs`
  - `scripts/auth-evidence-runbook-contract.test.mjs`
- Birlesik GitHub workflow:
  - `.github/workflows/release-check.yml`
- Dokuman:
  - `docs/plans/release-check-gate.md`

Kurallar:

- Root gate once root script kontrat testlerini calistirir.
- Root gate once backend `npm run check:release`, sonra frontend `npm run check:release` calistirir.
- Backend/frontend module-owned release zincirleri korunur.
- Production dependency audit `npm audit --omit=dev` olarak kalir.
- CI root gate Node.js 24 ile calisir.
- Mevcut ayri frontend/backend workflow runtime'lari Node.js 24'e hizalandi.

Dogrulama:

- Kirmizi test izlendi: root `package.json`, root runner ve `.github/workflows/release-check.yml` yokken `node --test scripts/release-gate-contract.test.mjs` fail verdi.
- Kirmizi test izlendi: root `check:release` root kontrat testlerini calistirmediginde `node --test scripts/release-gate-contract.test.mjs` fail verdi.
- Hedefli root kontrat testi gecti: `node --test scripts/release-gate-contract.test.mjs` -> 5 Node test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> 8 root Node test, backend lint + 32 suite / 248 test + build + audit, frontend lint + 3 Node script test + build + 21 Playwright smoke test + audit.

## Son Staging Auth Evidence Operator Checklist

26 Nisan 2026 itibariyla staging auth smoke runbook'u ekip kullanimi icin operasyonel checklist'e cevrildi.

Eklenenler:

- `docs/plans/phase-7-staging-auth-smoke-runbook.md` icinde roller:
  - Prepared by
  - Executed by
  - Reviewed by
  - Approved by
- Operator checklist:
  - environment preparation
  - preflight review
  - smoke execution
  - evidence review
  - approval decision
- Sign-off durumlari:
  - Go
  - Conditional Go
  - No-Go

Guvenlik kurallari:

- Raw bearer token, id token, refresh token, authorization code, PKCE verifier, client secret, cookie veya session dump evidence'a yapistirilmez.
- Raw secret material yakalanirsa evidence silinir, ilgili secret/session rotate edilir ve kanit sanitize sekilde yeniden uretilir.

Dogrulama:

- Kirmizi test izlendi: runbook sadece komut notuyken `node --test scripts/auth-evidence-runbook-contract.test.mjs` fail verdi.
- Hedefli runbook kontrat testi gecti: `node --test scripts/auth-evidence-runbook-contract.test.mjs` -> 3 Node test.

## Son Staging Auth Evidence JSON Guard

26 Nisan 2026 itibariyla staging auth evidence onayi icin sanitize JSON guard eklendi.

Eklenenler:

- `admin-web/scripts/auth-evidence-guard.mjs`
- `admin-web/scripts/auth-evidence-guard.test.mjs`
- `admin-web` script'i: `npm.cmd run guard:auth:evidence`

Guard davranisi:

- Smoke JSON evidence shape'ini kontrol eder.
- Raw compact JWT materyalini reddeder.
- `code`, `code_challenge`, `state`, `id_token_hint`, `refresh_token`, `client_secret`, cookie ve benzeri sensitive URL parametreleri redacted degilse reddeder.
- Secret-like field'lar raw string tasiyorsa reddeder.
- Action smoke evidence icin assigned-store `201`, unassigned-store `403`, `dbWriteExpected=false` kosullarini zorunlu tutar.

Runbook baglantisi:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run --silent smoke:auth:staging:action | npm.cmd run --silent guard:auth:evidence -- --stdin
```

Dogrulama:

- Kirmizi test izlendi: `auth-evidence-guard.mjs` yokken `npm.cmd run test:scripts` 4 yeni guard testinde fail verdi.
- Hedefli frontend script testi gecti: `npm.cmd run test:scripts` -> 7 Node test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> 9 root Node test, backend lint + 32 suite / 248 test + build + audit, frontend lint + 7 Node script test + build + 21 Playwright smoke test + audit.

Siradaki mantikli adim: real staging IdP registration bilgileri ve seeded staging DB hazir oldugunda guard'li komutla `smoke:auth:staging:action` evidence toplamak; credential/ortam gelmeden bu adim tamamlanmis sayilmayacak.

## Son Project Debt Ledger

26 Nisan 2026 itibariyla borc sayimi kanonik dokumana baglandi.

Yeni dokuman:

- `docs/plans/project-debt-ledger.md`

Sayim:

- Closed active debts: 12
- Superseded before overbuilding: 1
- Blocked external dependency: 1
- Watchlist decision item: 1
- Strategic investment backlog: 8
- Silent untracked quality debt in the active gate: 0

Yorum:

- Real IdP staging evidence dis staging IdP/credential/seeded DB bilgisi olmadan tamamlandi sayilmiyor.
- Global audit feed simdilik watchlist; gercek operator workflow kanitlanmadan kodlanmayacak.
- Daily Closure / Historical Ranking, staging bilgileri hazir degilse en guclu local urun yatirimi olarak duruyor.
- `.gitignore` mevcut; `node_modules`, `dist` ve local `.env` dosyalari ignored durumda, tracked kalite borcu olarak sayilmiyor.

Siradaki mantikli adim: staging bilgileri yoksa Daily Closure / Historical Ranking icin feature intake gate'i acmak; staging bilgileri varsa once guard'li staging auth action smoke'u kosmak.

## Son Daily Closure Ranking V2 Intake

26 Nisan 2026 itibariyla Daily Closure / Historical Ranking icin V2 intake gate acildi.

Onemli tespit:

- Daily Closure / Historical Ranking sifirdan yapilacak bir is degil.
- V1 zaten mevcut:
  - backend closed ranking service/contract
  - `GET /api/reports/leaderboards/closed`
  - `rpt.employee_performance_snapshot`
  - `rpt.employee_kpi_snapshot`
  - daily/monthly mode
  - store/Turkiye rank
  - KPI mini-rank
  - `daysWithPerformance / closedDaysInPeriod`
  - minimum 3 kapali performans gunu official monthly eligibility
  - `/store/rankings`

Yeni dokuman:

- `docs/plans/daily-closure-ranking-v2-intake.md`

V2 karari:

- Yeni ranking engine yok.
- Yeni schema ilk adimda yok.
- Mevcut closed ranking read model guclendirilecek.
- V2A hedefi: official / preview-only / not-closed / no-data / missing-day-needed hallerini daha acik anlatan explainability ve Turkish-first UI copy.
- Region league, tournament, challenge, reward ve attendance/worked-day truth V2A disinda.

CODEX DÜRÜST YORUM:

- Bu modul backlog'un ima ettiginden daha iyi durumda.
- Risk ranking'in olmamasi degil; kullanicinin rank'in resmi mi, preview-only mi, yoksa veri eksigi nedeniyle mi olmadigini anlamamasi.
- Dogru adim mevcut V1'i guclendirmek; ikinci kaynak veya ikinci skor motoru acmak degil.

Siradaki mantikli adim: `rankingStatus` / `eligibilityReason` ve `/store/rankings` Turkce aciklama polish'i icin V2 implementation plan yazmak.

## Mevcut Roller ve Test Kullanicilari

Keycloak local kullanicilari:

- `admin.operator / StoreOps123!`
- `store.manager / StoreOps123!`
- `store.personnel / StoreOps123!`
- `region.manager / StoreOps123!`

Not:

- Local Keycloak realm ve setup script artik `read_company_ids`, `read_region_ids`, `read_store_ids`, `assigned_store_ids` claim'lerini uretiyor.
- Backend artik local Keycloak demo username'lerinden role/scope/employee/action-store uretmiyor.
- Local demo kullanicilarin yetkisi token claim mapper'lari ve user attribute'larindan gelmeli.
- Imported-data kimlik mapping'i backend JWT provider'dan kaldirildi.
- Final modelde seller code / employee-store mapping kullanilacak.

## Calisan Ana Akislar

Auth:

- Local Keycloak login calisiyor.
- Backend bearer session dogruluyor.
- Role landing calisiyor.
- DEV-only local Keycloak role/scope fallback'i kaldirildi.
- Frontend login artik authorization code + PKCE akisiyle provider'a gider.
- Callback `code + state` alir, sessionStorage'daki PKCE verifier ile token endpoint uzerinden access token exchange yapar.

Target distribution:

- `/store/approvals` store manager icin personel hedef giris yuzeyi.
- Store manager mevcut personelleri ve mevcut satislarini gorebiliyor.
- Hedefleri girip region approval request olusturabiliyor.
- `/admin/targets` ve region manager route'u target approval queue icin calisiyor.
- `REGION_MANAGER` rol ve kullanici Keycloak'a eklendi.

Checklist:

- Checklist acknowledgement flow calisiyor.
- `approval` ile `acknowledgement` ayrimi kod ve urun dilinde oturdu.

Shared inbox:

- `/store/tasks` approval, acknowledgement ve KPI task kaynaklarini ortak queue diliyle gosteriyor.
- `/admin/inbox` admin shared inbox foundation olarak acildi.

KPI config:

- KPI config DB'de.
- Draft / publish modeli var.
- Audit ve diff gorunurlugu var.
- Store ve personnel score profile ayrildi.
- Grading bands config'e tasindi.

Import:

- Power BI Excel export upload gecici data akisi olarak acildi.
- `/admin/integrations` icinde upload paneli var.
- Import batch, normalization, materialization ve reconciliation akisi calisiyor.
- Mart personel ve magaza verileri import edildi.

Store KPI:

- `/store/kpis` imported live monthly KPI verisini okuyabiliyor.
- Magaza hedefi Power BI magaza exportundan geliyor.
- `TARGET_ACHIEVEMENT`, `CR`, `ATV`, `UPT` gorunuyor.
- `CR / ATV / UPT` Turkiye ortalamasina gore normalize ediliyor.

Personel performansi:

- `/store/me` `store.personnel` ile aciliyor.
- Net sales, ATV, UPT, score ve ranking gorunuyor.
- Personel target bilgisi su an bilincli olarak eksik.
- Personel hedefini personel degistiremez.
- Personel hedefini magaza muduru girer, bolge muduru onaylar.

Rankings:

- `/store/rankings` acildi.
- Tarih/period filtreleri minimum seviyede var.
- Gelismis donem filtresi daha sonra detaylandirilacak.

## Son Is Konusu

Kullanici su siniri netlestirdi:

> Herkes yetkili oldugu performans verilerine ulasabilsin; ancak operasyonel islemleri sadece kendisine atanmis magazalar uzerinden yapabilsin.

Su anki durum:

- Read tarafinda scope bazli filtreleme var.
- Backend auth context artik `readScope`, `actionScope.assignedStoreIds` ve legacy `scope` alias'ini uretiyor.
- JWT claim tarafinda `read_company_ids`, `read_region_ids`, `read_store_ids`, `assigned_store_ids` destekleniyor; eski `company_ids`, `region_ids`, `store_ids` fallback olarak calismaya devam ediyor.
- Mock auth tarafinda `x-read-company-ids`, `x-read-region-ids`, `x-read-store-ids`, `x-assigned-store-ids` destekleniyor; eski header'lar fallback.
- DB role assignment varsa read scope aktif role assignment'lardan uretiliyor.
- Action scope artik store scoped role assignment'lara ek olarak `ops.user_action_store_assignment` kayitlarindan da uretiliyor.
- Region manager / audit / saha ekipleri icin atanmis magaza listesi rolden ayri, kalici ve audit edilebilir admin modeliyle tutuluyor.
- Target distribution create/list personnel/approve ve checklist create/response/complete/acknowledgement aksiyonlari `actionScope.assignedStoreIds` ile kilitlendi.
- Performans okuma tarafinda mevcut `scope` read scope alias'i olarak kaldigi icin genis read scope davranisi korunuyor.

Eksik olan net is:

1. Secilen staging/production IdP icin `docs/plans/phase-7-provider-readiness-checklist.md` doldur; smoke evidence icin `docs/plans/phase-7-auth-evidence-template.md` kopyasi kullanilsin.
2. Real IdP ile staging ortaminda PKCE login'i end-to-end dogrula.
3. Long-session ihtiyaci real kullanimda kanitlanirsa `docs/plans/phase-7-token-renewal-decision.md` icindeki backend-mediated refresh tasarimini ayri fazda uygula.

Backend/frontend guvenlik modeli ana hatta ayrildi; kalici assignment yonetimi, store-action audit'i, DEV-only Keycloak/imported-data fallback temizligi, production auth lookup fail-closed davranisi, production JWT `sub`/`aud` zorunlulugu ve authorization code + PKCE browser login akisi tamamlandi.

## Son Dogrulama / Failure Temizligi

24 Nisan 2026 itibariyla daha once gorulen 6 backend failure kapatildi.

- Integration test harness artik test icinde acikca JWT istenmedikce mock auth ile basliyor; lokal `.env` icindeki `AUTH_MODE=jwt` / `JWT_JWKS_URL` ayarlari mock header testlerini 403'e dusurmuyor.
- Import batch source governance alanlari, audit `correlationId` beklentileri ve KPI live sync metadata beklentileri testlerde guncellendi.
- Hedefli dogrulama gecti: `npm.cmd test -- test/integration/import-batch.e2e-spec.ts test/integration/snapshot-run.e2e-spec.ts src/modules/integration/application/materialization.service.spec.ts --runInBand` -> 3 suite / 52 test.
- Full backend test gecti: `npm.cmd test -- --runInBand` -> 17 suite / 123 test.
- Backend build gecti: `npm.cmd run build`.

## Son Action Scope Sertlestirmesi

24 Nisan 2026 itibariyla P0 action-scope audit maddeleri kapatildi.

- Checklist response ve complete aksiyonlari artik path'teki `checklistInstanceId` uzerinden instance store'unu cozip `actionScope.assignedStoreIds` ile dogruluyor.
- Checklist create aksiyonunda body `storeId` icin controller guard korunurken service seviyesinde ikinci action-scope kontrolu eklendi.
- `/api/admin/migrations/run` endpointi `SUPER_ADMIN` rolune kilitlendi.
- Target distribution approve aksiyonundan `REPORT_VIEWER` cikarildi; approve artik sadece `SUPER_ADMIN` ve `REGION_MANAGER` rolunde.
- DB role katalog seed ve migrationlari controller'larda kullanilan production rollerle hizalandi: `REPORT_VIEWER`, `INTEGRATION_ADMIN`, `SNAPSHOT_OPERATOR`, `STORE_PERSONNEL` eklendi; role scope tipleri controller beklentileriyle sabitlendi.
- Role catalog contract testi eklendi; controller `@RequireRoles(...)` rolleri persisted role katalogda yoksa veya scope tipi beklenenle uyusmazsa test kirilir.
- Regression testler eklendi: assigned checklist instance response/complete, outside assigned store rejection, migration role rejection.
- Regression test eklendi: `REPORT_VIEWER` target distribution approve edemez.
- Regression test eklendi: controller role katalog sozlesmesi.
- Hedefli dogrulama gecti: `npm.cmd test -- test/integration/checklist-flow.e2e-spec.ts test/integration/auth-scope.e2e-spec.ts --runInBand` -> 2 suite / 19 test.
- Hedefli auth-scope dogrulama gecti: `npm.cmd test -- test/integration/auth-scope.e2e-spec.ts --runInBand` -> 1 suite / 16 test.
- Hedefli role catalog contract dogrulama gecti: `npm.cmd test -- src/modules/auth/role-catalog-contract.spec.ts --runInBand` -> 1 suite / 1 test.
- Full backend test gecti: `npm.cmd test -- --runInBand` -> 18 suite / 129 test.
- Backend build gecti: `npm.cmd run build`.

## Son Keycloak / Frontend Auth Hizalamasi

24 Nisan 2026 itibariyla Keycloak/local auth ve frontend action enablement borcu kapatildi.

- `infra/keycloak/store-ops-realm.json` persisted role katalogla hizalandi: `AUDITOR`, `INTEGRATION_ADMIN`, `SNAPSHOT_OPERATOR` rolleri eklendi.
- Local Keycloak realm ve `infra/scripts/setup-keycloak.ps1` yeni read/action scope claim mapper'larini uretiyor: `read_company_ids`, `read_region_ids`, `read_store_ids`, `assigned_store_ids`.
- Setup script artik `store.manager`, `store.personnel`, `region.manager`, `admin.operator` kullanicilarini ayni role/scope modeliyle kuruyor.
- Role catalog contract testi Keycloak realm rollerini, setup script role tokenlarini ve Keycloak scope mapper'larini da denetliyor.
- JWT provider local Keycloak tokenlarinda explicit role/scope/action-store claim'lerini okuyor; claim yoksa demo username'e bakarak yetki uretmiyor.
- Frontend `AuthSessionSummary` artik `readScope`, `actionScope.assignedStoreIds` ve `assignedStoreIds` alanlarini tasiyor.
- Frontend action helper'i eklendi: target create, target approve ve checklist acknowledgement kararlarini `roleCodes + actionScope.assignedStoreIds` ile veriyor.
- `/admin/targets` icinde `REPORT_VIEWER` artik queue'yu okuyabilir ama approve textarea/button gormez; approve sadece `SUPER_ADMIN` veya `REGION_MANAGER` ve atanmis action store varsa acilir.
- `/store/approvals` create akisi sadece `STORE_MANAGER` veya `SUPER_ADMIN` ve atanmis action store varsa acilir; coklu assigned store icin select kullanir.
- `/store/checklists` acknowledgement butonu sadece `STORE_MANAGER` veya `SUPER_ADMIN` ve checklist store'u assigned action store icindeyse acilir.
- Hedefli auth dogrulama gecti: `npm.cmd test -- src/modules/auth/role-catalog-contract.spec.ts src/modules/auth/providers/jwt-auth.provider.spec.ts --runInBand` -> 2 suite / 9 test.
- Full backend test gecti: `npm.cmd test -- --runInBand` -> 18 suite / 132 test.
- Backend build gecti: `npm.cmd run build`.
- Frontend build gecti: `npm.cmd run build`.
- Frontend lint borcu sonraki turda kapatildi; asagidaki "Son Frontend Lint Temizligi" bolumune bak.

## Son Frontend Lint Temizligi

24 Nisan 2026 itibariyla frontend lint borcu kapatildi.

- `downloadCsv` component dosyasindan ayrilip `src/lib/download-csv.ts` altina tasindi; `ReportingToolbar` component-only export olarak kaldi.
- Session helper'lari `src/features/session/session-storage.ts` altina tasindi.
- `useSession` hook'u `src/features/session/session-context-value.ts` altina tasindi; `SessionProvider` fast-refresh component dosyasi olarak temizlendi.
- `App.tsx` icindeki session notice temizleme effect'i state set etmek yerine route bazli gorunurlukle cozuldu.
- KPI config editor'da query sonucunu effect ile local state'e basmak yerine query payload + local override modeli kullanildi.
- Audit, auth catalog/dashboard ve reporting drill-down sayfalarinda conditional `useMemo` cagri sirasi duzeltildi; data array'leri early return oncesi stable `useMemo` ile uretiliyor.
- Store/admin inbox sayfalarindaki unstable dependency warning'leri giderildi.
- Frontend lint gecti: `npm.cmd run lint`.
- Frontend build gecti: `npm.cmd run build`.

## Son Kalici Action Store Assignment Modeli

24 Nisan 2026 itibariyla bolge/audit/saha ekipleri icin atanmis magaza listesi kalici admin modeline tasindi.

- Yeni DB modeli eklendi: `ops.user_action_store_assignment`.
- Yeni migration eklendi: `db/migrations/020_user_action_store_assignments.sql`.
- `db/schema.sql` action store assignment tablo, index ve comment bilgileriyle guncellendi.
- Auth context artik DB role assignment read scope'unu korurken action scope'u iki kaynaktan topluyor:
  - store scoped role assignment store'lari
  - `ops.user_action_store_assignment` aktif store'lari
- Bu sayede `REGION_MANAGER` region scope ile genis performans datasini okuyabilir, ama sadece action assignment verilen magazalarda approve/aksiyon yapabilir.
- Admin API eklendi:
  - `POST /api/auth/action-store-assignments`
  - `GET /api/auth/action-store-assignments`
  - `PATCH /api/auth/action-store-assignments/:assignmentId/deactivate`
  - `GET /api/auth/action-store-assignments/:assignmentId/audit`
- Auth lookups artik aktif store opsiyonlarini da donduruyor.
- Admin frontend `/admin/auth` icinde action store assignment formu, liste, deactivate ve audit linki eklendi.
- Yeni frontend audit sayfasi eklendi: `/admin/auth/action-store-assignments/:assignmentId/audit`.
- Regression testler eklendi:
  - auth context bolge read scope'u daraltmadan DB action store atamalarini action scope'a ekler.
  - action store assignment create/list/deactivate/audit endpointleri calisir.
  - auth lookups store opsiyonlarini dondurur.
- Hedefli dogrulama gecti: `npm.cmd test -- src/modules/auth/auth-context.service.spec.ts test/integration/auth-role-assignments.e2e-spec.ts --runInBand` -> 2 suite / 32 test.
- Backend full test gecti: `npm.cmd test -- --runInBand` -> 18 suite / 137 test.
- Backend build gecti: `npm.cmd run build`.
- Frontend lint gecti: `npm.cmd run lint`.
- Frontend build gecti: `npm.cmd run build`; sonraki turda route-level lazy split ile Vite chunk size warning'i kaldirildi.

## Son Action Surface Audit ve Frontend Chunk Split

24 Nisan 2026 itibariyla kalan action-scope audit borcu ve frontend chunk uyarisi kapatildi.

- Controller audit'i tekrar yapildi: store uzerinde gercek operasyonel action yuzeyleri target distribution ve checklist akislariyla sinirli.
- Integration source/import, snapshot run/rerun, KPI config ve migration endpointleri store action degil; company/admin rol-scope modeliyle korunuyor.
- Target distribution create ve store-personnel endpointlerine controller seviyesinde `@RequireActionScope("store")` eklendi; service seviyesindeki store dogrulamasi korunuyor.
- Target distribution approval icin regression test eklendi: `REGION_MANAGER` genis read scope'a sahip olsa bile request store'u assigned action store icinde degilse approve DB update'ine giremez.
- Checklist complete icin regression test eklendi: instance store'u assigned action store disindaysa completion DB update'ine giremez.
- Frontend aktif yol `C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web` icinde `src\App.tsx` route-level `React.lazy` + `Suspense` ile bolundu.
- Vite build'de eski tek buyuk JS chunk yaklasik `554 KB` idi; yeni ana `index` chunk yaklasik `212.75 KB`, en buyuk shared chunk yaklasik `42.12 KB`.
- Vite chunk size warning'i artik build ciktisinda yok.
- Hedefli dogrulama gecti: `npm.cmd test -- test/integration/auth-scope.e2e-spec.ts test/integration/checklist-flow.e2e-spec.ts --runInBand` -> 2 suite / 22 test.
- Full backend test gecti: `npm.cmd test -- --runInBand` -> 18 suite / 139 test.
- Backend build gecti: `npm.cmd run build`.
- Frontend lint gecti: `npm.cmd run lint`.
- Frontend build gecti: `npm.cmd run build`.

## Son DEV-only Keycloak Fallback Temizligi

24 Nisan 2026 itibariyla backend JWT provider icindeki DEV-only local Keycloak/imported-data fallback'i kaldirildi.

- `JwtAuthProvider` artik `store.manager`, `store.personnel`, `region.manager`, `admin.operator` gibi local demo username'lerine bakarak role, scope, employee id veya assigned store uretmiyor.
- Local Keycloak kullanicilari icin yetki kaynagi explicit token claim'leri: `roles`, `read_company_ids`, `read_region_ids`, `read_store_ids`, `assigned_store_ids`.
- Eski `company_ids`, `region_ids`, `store_ids` claim'leri geriye donuk token uyumlulugu icin okunmaya devam ediyor; bu username/imported-data fallback'i degil.
- Regression test eklendi: local Keycloak demo username'i claim yokken role/scope uretemez.
- Keycloak local runbook ve auth docs claim kontratina gore guncellendi.
- Hedefli dogrulama gecti: `npm.cmd test -- src/modules/auth/providers/jwt-auth.provider.spec.ts --runInBand` -> 1 suite / 7 test.
- Full backend test gecti: `npm.cmd test -- --runInBand` -> 18 suite / 140 test.
- Backend build gecti: `npm.cmd run build`.

## Son Production Auth Lookup Fail-Closed Sertlestirmesi

24 Nisan 2026 itibariyla production ortaminda DB-backed authorization lookup hatasi fail-closed davranisa tasindi.

- `AuthContextService` artik `appConfigService.isProduction === true` iken role/action-store assignment lookup hatasinda provider token/header context'e dusmez.
- Production hata cevabi: `503 Authorization context is unavailable`.
- Non-production davranisi korunur: lokal gelistirme ve izole integration testlerde DB kapaliysa provider context ile devam edebilir.
- Regression test eklendi: production config'te DB lookup throw ederse `resolveUser` reject eder.
- Hedefli dogrulama gecti: `npm.cmd test -- src/modules/auth/auth-context.service.spec.ts --runInBand` -> 1 suite / 7 test.
- Hedefli auth dogrulama gecti: `npm.cmd test -- src/modules/auth/auth-context.service.spec.ts src/modules/auth/providers/jwt-auth.provider.spec.ts --runInBand` -> 2 suite / 14 test.
- Full backend test gecti: `npm.cmd test -- --runInBand` -> 18 suite / 141 test.
- Backend build gecti: `npm.cmd run build`.

## Son Production JWT Claim Contract Sertlestirmesi

24 Nisan 2026 itibariyla production JWT claim kontrati backend tarafinda fail-closed hale getirildi.

- `JwtAuthProvider` production ortaminda direct `aud` claim'i olmayan tokenlari artik kabul etmiyor.
- `JwtAuthProvider` production ortaminda direct ve bos olmayan `sub` claim'i olmayan tokenlari artik kabul etmiyor.
- Non-production toleransi korundu; lokal gelistirme ve izole testlerde sparse token davranisi kirilmadi.
- Regression testler eklendi:
  - production JWT `aud` claim'i yoksa reject edilir.
  - production JWT `sub` claim'i yoksa reject edilir.
- Auth dokumanlari ve Phase 7 runbook/roadmap production `sub` + `aud` zorunluluguna gore guncellendi.
- Kirmizi TDD dogrulamasi yapildi: yeni iki test once mevcut kodda reject beklerken resolve oldugu icin dustu.
- Hedefli provider dogrulama gecti: `npm.cmd test -- src/modules/auth/providers/jwt-auth.provider.spec.ts --runInBand` -> 1 suite / 9 test.
- Hedefli auth dogrulama gecti: `npm.cmd test -- src/modules/auth/providers/jwt-auth.provider.spec.ts src/modules/auth/auth-context.service.spec.ts --runInBand` -> 2 suite / 16 test.
- Full backend test gecti: `npm.cmd test -- --runInBand` -> 18 suite / 143 test.
- Backend build gecti: `npm.cmd run build`.

## Son Authorization Code + PKCE Gecisi

24 Nisan 2026 itibariyla implicit token return borcu production yonunde kapatildi.

- Backend `/api/auth/bootstrap` artik PKCE icin `responseType=code` ve `tokenUrl` metadata'si donduruyor.
- `AUTH_RESPONSE_TYPE` varsayilani `code` oldu.
- `AUTH_TOKEN_URL` env anahtari eklendi; `response_type=code` icin provider configured sayilmasinda zorunlu.
- Frontend `/auth/login` artik `code_verifier`, `code_challenge`, `state` uretip `code_challenge_method=S256` ile provider authorization URL'i kuruyor.
- PKCE verifier ve state yalnizca `sessionStorage` icinde tutuluyor ve callback'te tek kullanimlik olarak tuketiliyor.
- Frontend `/auth/callback` artik `code + state` geldiginde token endpoint'e `authorization_code` exchange yapip donen `access_token` ile mevcut bearer session'i baslatiyor.
- Eski `access_token` / `token` callback parse destegi yalnizca frontend dev build icin korundu; production build bu URL'leri reddediyor, token'i sessionStorage'a yazmiyor ve adres cubugundan temizliyor.
- Local Keycloak realm import ve setup script implicit flow'dan public client standard flow + S256 PKCE ayarina tasindi.
- Local Keycloak setup script Keycloak 26 user profile davranisina gore sertlestirildi: realm olustuktan sonra `unmanagedAttributePolicy=ENABLED` ayarlaniyor ve demo kullanici profile/scope attribute'lari Admin REST ile yaziliyor.
- Demo kullanicilar artik `email`, `firstName`, `lastName`, `emailVerified=true`, bos `requiredActions` ve read/action scope attribute'lariyla kuruluyor; ilk login'de Keycloak `VERIFY_PROFILE` ekranina dusmuyor.
- `infra/scripts/setup-keycloak.ps1` artik her demo kullanici icin profile ve kritik scope attribute'larini geri okuyup eksikse fail eder.
- Canli local browser smoke gecti: `/auth/login?returnTo=/store` -> Keycloak Authorization Code + PKCE -> `/auth/callback` -> `/store`.
- Store shell resolved session'da `STORE_MANAGER`, company id `00000000-0000-0000-0000-000000000001` ve store id `ba0f7a18-fdd4-44cd-9c03-af32ab535286` gorundu; scope artik token claim'lerinden geliyor.
- Frontend token exchange sonucundaki `id_token` degerini bearer token'dan ayri olarak sessionStorage'da tutuyor.
- Frontend bearer token JWT ise `exp` claim'i gecmis tokenlari API header'i kurulmadan temizliyor; provider `id_token` da ayni anda temizleniyor.
- `/auth/logout` provider logout URL'ine `id_token_hint`, `client_id` ve `post_logout_redirect_uri` ekliyor; Keycloak 26 icin gorulen `Missing parameters: id_token_hint` borcu kapatildi.
- Logout sayfasindaki effect bootstrap metadata gelmeden baslamiyor ve tek seferlik guard kullaniyor; `clearToBearerMode` kaynakli update loop ve ikinci kez id_token'siz logout request uretme sorunu kapatildi.
- Canli logout smoke gecti: taze PKCE login -> `/store` -> `/auth/logout` -> tek Keycloak logout request'i -> `/auth/login`; request'te `id_token_hint` vardi ve sessionStorage temizlendi.
- `docs/plans/phase-7-provider-readiness-checklist.md` eklendi; real staging/production IdP'ye gecmeden once provider registration, backend/frontend env, direct `sub`/`aud`, role/read/action claim mapper'lari, logout, expired-token guard ve smoke evidence icin go/no-go kapisi oldu.
- `docs/plans/phase-7-auth-evidence-template.md` eklendi; real IdP smoke sirasinda raw bearer/id/refresh token veya secret saklamadan bootstrap, login redirect, sanitized token payload, session, positive/negative action, logout ve expired-token kanitlari ayni formatta toplanacak.
- `docs/plans/phase-7-token-renewal-decision.md` eklendi; ilk real IdP smoke icin browser refresh token ve hidden iframe silent re-auth reddedildi, access token expiry durumunda `/auth/login` uzerinden re-login kabul edildi, uzun oturum ihtiyaci kanitlanirsa backend-mediated refresh ayri faza alindi.
- Production callback hardening eklendi: `AuthCallbackPage` production build'de manual `access_token` / `token` callback'ini session'a almaz; local dev fallback ise korunur.
- Production preview smoke gecti: `/auth/callback#access_token=prod-manual-token&state=/store` sessionStorage'a bearer token yazmadi, `/store`'a gecmedi, disabled mesajini gosterdi ve token'i adres cubugundan temizledi.
- Dev smoke gecti: Vite dev modunda session endpoint stub'li iken manual token callback local fallback olarak calismaya devam etti.
- Regression testler eklendi:
  - auth bootstrap PKCE token endpoint metadata'sini dondurur.
  - code flow token endpoint yoksa provider configured sayilmaz.
  - local Keycloak bootstrap standard flow + S256 PKCE sozlesmesini korur.
- Hedefli backend auth dogrulama gecti: `npm.cmd test -- src/modules/auth/web/auth-session.controller.spec.ts src/modules/auth/providers/jwt-auth.provider.spec.ts src/modules/auth/auth-context.service.spec.ts --runInBand` -> 3 suite / 18 test.
- Keycloak contract dogrulama gecti: `npm.cmd test -- src/modules/auth/role-catalog-contract.spec.ts --runInBand` -> 1 suite / 4 test.
- Full backend test gecti: `npm.cmd test -- --runInBand` -> 19 suite / 146 test.
- Backend build gecti: `npm.cmd run build`.
- Frontend lint gecti: `npm.cmd run lint`.
- Frontend build gecti: `npm.cmd run build`.

## Son Structured Logging / Correlation ID Standardi

24 Nisan 2026 itibariyla backend request correlation standardi sertlestirildi.

- `RequestContextMiddleware` artik inbound `x-correlation-id` degerini allowlist ile dogrular.
- Bos, whitespace-only, CR/LF veya guvensiz karakter iceren, ya da 128 karakterden uzun correlation id degerleri response'a aynen yansitilmez; yerine UUID uretilir.
- HTTP completion logu request boyunca yasayan context objesinden actor bilgisini alir; auth guard sonradan `RequestContextStore.setActorUserId(...)` yazdiginda `http.request.completed` logu `actorUserId` alanini kaybetmez.
- `GET /api/health` entegrasyon testi invalid inbound correlation id'nin echo edilmedigini dogrular.
- `docs/backend/operational-monitoring-contract.md` correlation id allowlist, request log kontrati ve kalan observability gap'lerine gore guncellendi.
- Kirmizi TDD dogrulamasi yapildi: yeni middleware testleri once mevcut kodda invalid correlation id echo edildigi ve actor id logda `null` kaldigi icin dustu.
- Hedefli observability dogrulama gecti: `npm.cmd test -- src/shared/request-context.middleware.spec.ts src/shared/audit/audit-metadata.factory.spec.ts test/integration/health.e2e-spec.ts --runInBand` -> 3 suite / 6 test.
- Full backend test gecti: `npm.cmd test -- --runInBand` -> 20 suite / 149 test.
- Backend build gecti: `npm.cmd run build`.
- Backend lint o an mevcut altyapi borcuna takilmisti: `npm.cmd run lint` ESLint 9 icin `eslint.config.*` bulunamadigi icin calismiyordu. Bir sonraki adimda bu borc kapatildi.

## Son Backend ESLint 9 Lint Altyapisi

24 Nisan 2026 itibariyla backend lint komutu tekrar calisir hale getirildi.

- `@eslint/js@9.39.4`, `typescript-eslint` ve `globals` dev dependency olarak eklendi.
- `eslint.config.mjs` eklendi; flat config ESLint 9 ile uyumlu, TypeScript parser kullanir, Node/Jest globals tanimlidir ve `dist`/`node_modules` ignore edilir.
- Ilk hipotez testinde `src/**/*.ts` flat config eslesmesi Windows ortaminda "no matching configuration" verdigi icin dosya kapsam deseni `**/*.ts` olarak sabitlendi; mevcut script yine `src/**/*.ts` calistiriyor.
- Lint gercek bulgulari temizlendi:
  - materialization spec icindeki kullanilmayan mock parametreleri `_params` yapildi.
  - reporting controller icindeki kullanilmayan `GetKpiReportQueryDto` import'u kaldirildi.
  - Redis health cleanup hatasinin `finally` icinden asil health sonucunu ezmesi engellendi.
- Backend lint gecti: `npm.cmd run lint`.
- Hedefli dogrulama gecti: `npm.cmd test -- src/modules/integration/application/materialization.service.spec.ts test/integration/health.e2e-spec.ts --runInBand` -> 2 suite / 17 test.
- Full backend test gecti: `npm.cmd test -- --runInBand` -> 20 suite / 149 test.
- Backend build gecti: `npm.cmd run build`.
- Runtime dependency audit o an 3 vulnerability raporluyordu; bir sonraki adimda bu borc kapatildi.

## Son Runtime Dependency Audit Kapatma

24 Nisan 2026 itibariyla backend runtime dependency audit borcu kapatildi.

- `xlsx@0.18.5` kaldirildi; Power BI export parser `@e965/xlsx@0.20.3` paketine tasindi.
- `PowerBiExportUploadService` import'u `@e965/xlsx` kullanacak sekilde guncellendi.
- Power BI parser regresyon testi eklendi: store workbook upload'i 5 canonical KPI row uretiyor.
- `bullmq` icindeki vulnerable `uuid@11.1.0` icin package override eklendi ve root `uuid@14.0.0` dependency ile runtime module resolution guvenceye alindi.
- Jest, `uuid@14` ESM export'unu parse edemedigi icin test ortaminda `test/jest/uuid.cjs` mapper'i kullanir; mapper sadece BullMQ'nun kullandigi `v4` API'sini `crypto.randomUUID` ile saglar.
- BullMQ runtime smoke gecti: `node -e "const { Queue } = require('bullmq'); ..."` queue token uretti.
- Runtime audit gecti: `npm.cmd audit --omit=dev` -> `found 0 vulnerabilities`.
- Backend lint gecti: `npm.cmd run lint`.
- Hedefli test gecti: `npm.cmd test -- src/modules/integration/application/power-bi-export-upload.service.spec.ts src/shared/jobs/bullmq-worker-host.service.spec.ts --runInBand` -> 2 suite / 4 test.
- Jest/BullMQ integration dogrulama gecti: `npm.cmd test -- test/integration/health.e2e-spec.ts src/shared/jobs/bullmq-worker-host.service.spec.ts --runInBand` -> 2 suite / 6 test.
- Full backend test gecti: `npm.cmd test -- --runInBand` -> 21 suite / 150 test.
- Backend build gecti: `npm.cmd run build`.
- Bakim notu: BullMQ upgrade edildiginde `bullmq -> uuid` override yeniden degerlendirilecek; BullMQ kendi dependency agacinda vulnerable `uuid <14.0.0` cekmiyorsa override ve Jest `uuid` mapper'i kaldirilacak.

## Son Backend Release Check Script

24 Nisan 2026 itibariyla backend kalite kapilari tek release check script'ine baglandi.

- `backend/nestjs/package.json` icine `check:release` script'i eklendi.
- `rehearse:release` artik once `check:release`, sonra Docker destekli rehearsal script'ini calistirir.
- `release-rehearsal.ts` Docker Compose icin izole project name kullanir: varsayilan `store-ops-live-rehearsal`, override icin `REHEARSAL_COMPOSE_PROJECT_NAME`.
- Script sirasi:
  - `npm run lint`
  - `npm test -- --runInBand`
  - `npm run build`
  - `npm audit --omit=dev`
- `docs/backend/operational-monitoring-contract.md` runtime verification kontratina `check:release` kapisi eklendi.
- BullMQ uuid override bakim notu `docs/backend/dependency-maintenance-notes.md` icine eklendi.
- Release check gecti: `npm.cmd run check:release` -> lint, 21 suite / 150 test, build ve runtime audit (`found 0 vulnerabilities`).
- Ilk `rehearse:release` denemesinde kalite kapisi gecti, Docker Compose ise mevcut `infra_default`/orphan Keycloak ag cakismasina takildi; rehearsal script'i bu nedenle izole Compose project name ile sertlestirildi.
- Uctan uca release rehearsal gecti: `npm.cmd run rehearse:release` -> `check:release`, izole Docker Postgres/Redis, `smoke:release`, health db/redis OK, import/snapshot audit correlation matched, container/network cleanup tamamlandi.
- CI baglantisi yapildi: `.github/workflows/release-rehearsal.yml` PR'larda ve `main`/`master` push'larinda backend/db/infra/workflow degisiklikleri icin `npm run rehearse:release` calistirir; bu komut once `check:release` kapisini, sonra Docker rehearsal smoke'unu kosar.

## Son Operational KPI Ingestion Workflows

24 Nisan 2026 itibariyla KPI/import, store operations ve snapshot bagimliliklari tek yesil pakette commitlendi.

- Commit: `34b81f4 Add operational KPI ingestion workflows`.
- Integration tarafina source schedule, due-source listesi, import payload template, KPI import normalization ve Power BI export upload servisleri eklendi.
- Import batch envelope, source profile, KPI live sync metadata, operational KPI definition ve integration schedule migrationlari eklendi.
- Store ops tarafinda target distribution, checklist acknowledgement, shared workflow inbox, KPI config contract, store KPI highlights, personnel self-performance ve closed leaderboard yuzeyleri genisletildi.
- Snapshot tarafinda daily closure status/queue controller'i ve worker servisi eklendi.
- `BullMqJobDispatcherService` BullMQ baglantisini yalnizca `QUEUE_BACKEND=bullmq` iken lazy init edecek sekilde sertlestirildi.
- Izole temiz worktree uzerinde staged patch dogrulandi: `npm.cmd ci` + `npm.cmd run check:release` gecti.
- Dogrulama sonucu: lint, 21 suite / 150 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).

## Son Feature Intake Kuralı

24 Nisan 2026 itibariyla yeni isler icin karar kapisi netlestirildi.

- `docs/plans/request-intake-and-decision-policy.md` genisletildi.
- Yeni feature, workflow, data model, route, permission veya integration islerinde once 6 soruluk mini roportaj yapilacak.
- Roportaj sirasinda kullanici/rol, problem, role-scope-action siniri, veri sahibi, mevcut akis baglantilari ve dogrulama kriterleri netlestirilecek.
- Auth/scope, persistence, reporting, import, KPI, audit veya workflow davranisina dokunan islerde bu kapinin atlanmamasi proje kurali olarak yazildi.

## Son Handoff / Temizlik Kapisi

24 Nisan 2026 itibariyla proje hafizasi ve gecici dosya borcu toparlandi.

- `current-state.md` tek kanonik handoff dosyasi olarak guncellendi.
- Eski `codex.md`, `codex2.md`, `codex3.md`, `codex4.md` snapshot'lari stale yol ve tekrar eden bilgi tasidigi icin kaldirildi.
- Plan hafizasi `docs/plans` altinda toplandi: domain blueprint, gap roadmap, guardrails, request intake, backlog ve module template dosyalari artik repo hafizasina dahil.
- Gecici perf baseline loglari, Keycloak cookie dosyalari, Excel inspect ciktilari ve local reference checkout'lari `.gitignore` ile disarida tutulur.

## Son UI Localization Karar Notu

24 Nisan 2026 itibariyla gelecekteki TR/EN arayuz stratejisi plan hafizasina eklendi.

- Yeni karar notu: `docs/plans/ui-localization-strategy.md`.
- Urun karari: default arayuz dili Turkce, opsiyonel ikinci dil Ingilizce.
- Turkce karakterler (`Ç`, `Ş`, `İ`, `ı`, `ğ`, `ü`, `ö`) birinci sinif desteklenecek.
- Backend/API enum, role, permission, route, audit code ve KPI metric code degerleri cevrilmeyecek; UI label olarak cevrilecek.
- Tarih, sayi, yuzde, para, search/filter, CSV/Excel export ve hata mesaji kurallari localization stratejisine yazildi.
- Feature backlog icine `UI Localization TR/EN` captured/P1 olarak eklendi.
- Project guardrails icine localization deliberate-change kurali eklendi.

## Son Daily Closure Ranking Karar Notu

24 Nisan 2026 itibariyla daily/monthly closed ranking stratejisi roportajla netlestirildi ve plan hafizasina eklendi.

- Yeni karar notu: `docs/plans/daily-closure-ranking-strategy.md`.
- Ilk hedef kullanicilar: `STORE_PERSONNEL + STORE_MANAGER`.
- Zaman kirilimi: gunluk + aylik.
- Kullanici kapanmis gecmis gun/ay secebilir.
- Ranking kapsami: magaza ici + Turkiye geneli.
- Ana siralama: mevcut agirlikli total score.
- Detay siralama: UPT, ATV, hedef gerceklesme, net satis gibi KPI'larda magaza ici + Turkiye geneli mini-rank.
- Aylik ranking: ay bitmeden, sadece kapanmis gunlerden month-to-date hesaplanir.
- Resmi aylik ranking icin minimum `3` kapali performans gunu gerekir.
- Eksik performans gunu `0` puan sayilmaz; hesap disi kalir.
- Aylik satirlarda data coverage gosterilir: `daysWithPerformance / closedDaysInPeriod`, ornek `25/27 days`.
- Bolge ligleri, turnuva ve meydan okuma fikri ileride ayri `challenge / league / tournament` modulu olarak ele alinacak.

## Son Daily Closure Ranking Uygulamasi

24 Nisan 2026 itibariyla daily/monthly closed ranking uygulamasi tamamlandi.

- Uygulama plani eklendi: `docs/superpowers/plans/2026-04-24-daily-closure-ranking.md`.
- Backend closed leaderboard kontrati yenilendi: `mode`, `periodType`, `state`, nested rank population, coverage ve KPI mini-rank alanlari doner.
- `STORE_PERSONNEL` ve `STORE_MANAGER` icin kapali gun/ay ranking read path eklendi.
- Gunluk ranking completed daily snapshot'tan okunur.
- Aylik ranking ay icindeki completed daily snapshot'lardan month-to-date hesaplanir.
- Magaza ici + Turkiye geneli rank desteklenir.
- KPI mini-rank detaylari desteklenir.
- `daysWithPerformance / closedDaysInPeriod` data coverage dondurulur.
- Eksik gun `0` puan sayilmaz; hesap disi kalir.
- Resmi aylik ranking icin minimum `3` kapali performans gunu gerekir; altindaki satirlar preview-only olarak rank'siz gosterilir.
- Read-side index migration eklendi: `db/migrations/021_closed_ranking_read_indexes.sql`.
- Frontend `/store/rankings` artik gunluk/aylik donem secimi, coverage, eligibility ve KPI mini-rank detaylarini gosterir.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 22 suite / 156 test, build ve runtime audit (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, TypeScript/Vite build ve runtime audit (`found 0 vulnerabilities`); Vite chunk size warning yok.

## Son Store Ranking Live Smoke Fix

24 Nisan 2026 itibariyla `/store/rankings` live browser smoke sirasinda gorulen 500 kapatildi.

- Kök neden: Keycloak store personnel claim'i `employee_id = EMP-200` olarak dis personel referansi tasiyor; yeni closed ranking read path bu degeri UUID sanip `rpt.employee_performance_snapshot.employee_id` sorgusuna veriyordu.
- Ortak cozum: reporting repository icinde auth employee identity resolver eklendi.
- Resolver sirasi: UUID claim dogrudan kullanilir; UUID degilse `ops.employee.external_employee_ref` uzerinden internal `employee_id` cozulur; bulunamazsa UUID `userId` icin `ops.user_account.employee_id` fallback'i denenir.
- Bu resolver hem `/api/reports/leaderboards/closed` hem `/api/reports/my-performance` icin kullaniliyor.
- Regression testleri eklendi: external employee claim ile closed ranking ve closed personal performance 500 donmemeli.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 22 suite / 159 test, build ve runtime audit (`found 0 vulnerabilities`).
- Live browser smoke gecti: `/store/rankings` daily ve monthly modlari 200 dondu; mevcut local veri durumunda UI `no_data` state'i gosteriyor.
- Local DB migration borcu kapatildi: `db/migrations/020_user_action_store_assignments.sql` uygulandi ve `ops.user_action_store_assignment` artik mevcut.

## Store My Performance Local Fixture Fix

24 Nisan 2026 itibariyla `/store/me` icin gorulen `Performans yuzeyi acilamadi` state'i kapatildi.

- Kok neden: Keycloak local bootstrap `store.personnel` kullanicisini `employee_id = EMP-200` ve Power BI kaynakli Adana magaza ID'si ile aciyordu; mevcut local performans seed verisi ise `DEMO-EMP-202` ve `00000000-0000-0000-0000-000000000100` IstinyePark Demo Store uzerinde.
- Kalici fix: `infra/keycloak/store-ops-realm.json` ve `infra/scripts/setup-keycloak.ps1` local demo kullanicilari seeded performans kimliklerine hizalandi.
- Yeni regression guard: `backend/nestjs/src/modules/auth/role-catalog-contract.spec.ts` Keycloak local bootstrap kullanicilarinin demo performans employee/store claim'lerinden sapmamasini test ediyor.
- Local runtime fix: `db/migrations/020_user_action_store_assignments.sql` local DB'ye uygulandi; `ops.user_action_store_assignment` artik mevcut.
- Keycloak realm yeni fixture ile yeniden kuruldu.
- Browser smoke gecti: `store.personnel` ile login sonrasi `/store/me` acildi; hata state'i yok, `Store Personnel`, Turkey ranking ve store ranking gorunuyor.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 22 suite / 159 test, build ve runtime audit (`found 0 vulnerabilities`).

## Demo Performance Seed Contract

24 Nisan 2026 itibariyla `/store/me` demo verisi seed ve contract test seviyesine tasindi.

- `db/seeds/001_reference_seed.sql` artik demo region/store/personel assignment ve Nisan 2026 personel KPI actual verisini iceriyor.
- `store.personnel` icin `DEMO-EMP-202` ve `00000000-0000-0000-0000-000000000100` fresh kurulumda da veri bulacak.
- `personnel_profile` default agirliklari kalici hale getirildi: TARGET_ACHIEVEMENT 40, ATV 30, UPT 30.
- `backend/nestjs/src/modules/store-ops/demo-performance-seed-contract.spec.ts` Keycloak fixture, reference seed ve personel score defaultlarini birlikte koruyor.
- `docs/backend/live-e2e-runbook.md` reference seed ve `/store/me` demo smoke baglantisini acikca not ediyor.

## Son Store-Me API Smoke Script

24 Nisan 2026 itibariyla `/store/me` icin browser UI disinda calisan backend smoke script'i eklendi.

- Yeni komut: `backend/nestjs` icinde `npm.cmd run smoke:store-me`.
- Script `GET /api/reports/my-performance?mode=live` endpointini kontrol eder.
- Token verilirse `STORE_ME_SMOKE_TOKEN` / `SMOKE_AUTH_TOKEN` ile bearer auth kullanir.
- Token yoksa mock auth header'lariyla `STORE_PERSONNEL`, `DEMO-EMP-202`, demo company/region/store scope ve assigned store bilgisini yollar.
- Response'ta employee identity, live source mode, scored `TARGET_ACHIEVEMENT` / `ATV` / `UPT`, pozitif score, Turkiye rank ve magaza rank yoksa fail eder.
- `scripts/release-rehearsal.ts` artik Docker-backed seeded rehearsal app acildiktan sonra `smoke:release` ardindan `smoke:store-me` de kosar; CI'da `/store/me` backend kontrati sessizce geri bozulamaz.
- Smoke script gercek `/my-performance` response formatini okur: metric satirlari icin `code/status` alanlari birinci sinif, eski `metricCode/scoreStatus` formati toleranslidir.
- Contract test eklendi: `backend/nestjs/src/modules/store-ops/store-me-smoke-script.spec.ts`.
- Runbook notu eklendi: `docs/backend/live-e2e-runbook.md`.
- Operational monitoring contract `smoke:store-me` kapisini runtime readiness kriterlerine ekledi.
- Hedefli smoke contract testi gecti: `npm.cmd test -- --runInBand src/modules/store-ops/store-me-smoke-script.spec.ts` -> 1 suite / 8 test.
- Uctan uca release rehearsal gecti: `npm.cmd run rehearse:release` -> `check:release`, Docker Postgres/Redis, `smoke:release`, `smoke:store-me`, 24 suite / 170 test, build ve audit temiz.

## Son Frontend Release Check

24 Nisan 2026 itibariyla aktif frontend klasorunde release check kapisi eklendi.

Aktif frontend yolu:

```powershell
C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web
```

- `package.json` icine `check:release` script'i eklendi.
- `lint` script'i `src/**/*.{ts,tsx}` ile kaynak dosyalara sinirlandi; dependency/build klasorleri release kapisina karismaz.
- `eslint.config.js` icinde `node_modules`, `dist`, `dist-ssr` global ignore olarak netlesti.
- Frontend release check gecti: `npm.cmd run check:release` -> lint, TypeScript/Vite build ve runtime audit (`found 0 vulnerabilities`).
- Repo icindeki `C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web` artik aktif frontend kaynagidir.
- Repo icindeki frontend icin temiz kurulum dogrulamasi gecti: `npm.cmd ci` -> 180 package installed/audited, `found 0 vulnerabilities`.
- Repo icindeki frontend release check gecti: `npm.cmd run check:release` -> lint, TypeScript/Vite build ve runtime audit (`found 0 vulnerabilities`).
- Frontend CI baglantisi yapildi: `.github/workflows/frontend-release-check.yml` PR'larda ve `main`/`master` push'larinda `admin-web/**` degisiklikleri icin `npm ci` ve `npm run check:release` calistirir.

## Son Frontend Store UI Smoke Gate

24 Nisan 2026 itibariyla `/store/me` ve `/store/rankings` icin build edilmis frontend uzerinde Playwright smoke kapisi eklendi.

- `admin-web` icine `@playwright/test`, `playwright.config.ts` ve `e2e/store-surfaces.spec.ts` eklendi.
- Yeni komutlar:
  - `npm.cmd run test:e2e` -> Playwright testlerini kosar.
  - `npm.cmd run smoke:ui` -> once frontend build alir, sonra Vite preview uzerinde Chromium smoke kosar.
- `check:release` artik `lint + smoke:ui + audit --omit=dev` calistirir; `smoke:ui` build adimini kendi icinde yaptigi icin release check build'i de kapsar.
- Smoke testleri backend/Keycloak'a baglanmaz; `/api/auth/session`, `/api/reports/kpi-config`, `/api/reports/my-performance`, `/api/reports/leaderboards/closed` ve snapshot run endpointleri Playwright route fixture'lariyla sabitlenir.
- `/store/me` icin Weighted score, Turkey ranking, Store ranking, `TARGET_ACHIEVEMENT`, `ATV`, `UPT` ve hata state yoklugu kontrol edilir.
- `/store/rankings` icin closed leaderboard, current rank, `TR 1/4`, KPI mini-ranks ve hata state yoklugu kontrol edilir.
- `.github/workflows/frontend-release-check.yml` artik `npx playwright install --with-deps chromium` adimini kosar; CI release check tarayici bulamama nedeniyle dusmez.
- Hedefli dogrulama gecti: `npm.cmd run smoke:ui` -> build + 2 Playwright smoke testi.

## Son Store Route Browser UX Sweep

24 Nisan 2026 itibariyla local Keycloak `store.personnel` oturumu ile in-app browser uzerinde store route turu yapildi.

- Gezilen route'lar: `/store/me`, `/store/rankings`, `/store/kpis`, `/store/tasks`.
- `/store/me` hata state'i gostermeden aciliyor; `Weighted score`, Turkiye siralamasi, magaza siralamasi ve metrikler gorunuyor.
- `/store/kpis` ve `/store/tasks` store personnel oturumunda preview/rol siniri mesajiyla aciliyor; konsol hata/uyari yok.
- Store shell route icerigi artik `main` landmark ile sarilir; e2e testi bunu korur.
- Keycloak teknik rolleri (`offline_access`, `uma_authorization`, `default-roles-*`) store yuzeylerinde kullaniciya gosterilmez; sadece urun rolleri gorunur.
- Dar tarayici gorunumunde store shell yatay scroll ve hero basligi tasmasi temizlendi.
- Store tasks smoke kapsami genisledi; shared inbox icin Turkce queue etiketleri regression testte korunur.
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 4 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Kapanan local data notu: `/store/rankings` icin `no_data` sebebi olan closed-ranking fixture/seed eksigi asagidaki fix ile kapatildi.

## Son Store Rankings Closed Fixture Fix

24 Nisan 2026 itibariyla local `/store/rankings` icin `no_data` veri borcu kapatildi.

- Kok neden: local DB'de `daily` tipinde tek bir eski snapshot vardi; `period_start != period_end` oldugu icin gercek gunluk closure degildi ve `rpt.employee_performance_snapshot` / `rpt.employee_kpi_snapshot` satirlari yoktu.
- `db/seeds/001_reference_seed.sql` artik 22, 23 ve 24 Nisan 2026 icin idempotent closed-ranking demo snapshot runlari uretir.
- Her gun icin 4 demo personele performance snapshot, her personele `TARGET_ACHIEVEMENT`, `ATV`, `UPT` KPI snapshot satirlari eklenir.
- `ReportingRepository` daily closure secimlerinde sadece tek gunluk snapshotlari kabul eder; multi-day daily kayitlar latest/monthly ranking hesaplarina karismaz.
- Closed ranking date alanlari API'ye `YYYY-MM-DD` string olarak doner; UI'da ISO timestamp sizmasi engellendi.
- Local Postgres'e seed uygulandi; 3 gun, gun basina 4 performance employee ve 12 KPI value dogrulandi.
- Gercek Keycloak login ile `/store/rankings` browser check gecti: state `closed`, `no_data` yok, `Store Personnel - 1/4`, `TR 1/4`, KPI mini-rank satirlari ve date-only period gorunuyor.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 25 test suite / 174 test, build, `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check tekrar gecti: `npm.cmd run check:release` -> lint, build, 4 Playwright smoke testi, `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Not: browser dogrulamasi icin backend 3000 portunda source ustunden `npx ts-node src/main.ts` ile yeniden kaldirildi.
- Siradaki mantikli adim: closed ranking uzerinden store/region leaderboard varyantlarini planlamak; bolge ligleri icin store ici + Turkiye geneli temelinin ustune bolge kapsamini eklemek.

## Son Competition Stage Foundation

25 Nisan 2026 itibariyla Competition + Stage foundation uygulandi.

- Uygulama plani eklendi: `docs/superpowers/plans/2026-04-25-competition-stage-foundation.md`.
- `HR_ADMIN` rolu ve `competition.read` / `competition.manage` permission'lari eklendi.
- Keycloak realm ve setup script role/scope katalog sozlesmesiyle hizalandi.
- Competition, stage, team template, team membership, store score snapshot, team score snapshot ve warning tablolari eklendi.
- V1 skor modeli kapali store KPI snapshot kaynaklarindan hesaplanir.
- Takim skoru stage icindeki valid store-day skorlarinin ortalamasidir.
- Eksik gunluk magaza verisi ve eksik BM/VM checklist verisi uyaridir; sifir puan yazilmaz.
- Checklist agirligi baska metriklere dagitilmaz.
- IK/Admin finalization warning varken yazili override gerekcesi ister ve audit yazar.
- Backend API eklendi: `/api/competitions`, stage create, recalculate ve finalize endpointleri.
- Admin frontend `/admin/competitions` yuzeyi eklendi; `HR_ADMIN` landing bu yuzeye yonlenir.
- Frontend smoke kapsami `/admin/competitions` icin genisledi.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 28 suite / 184 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 5 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`); Vite chunk warning yok.
- Siradaki mantikli adim: store ve region manager competition read yuzeylerini scoped contribution detaylariyla acmak.

## Son Competition Scoped Read Surfaces

25 Nisan 2026 itibariyla store ve region manager competition read yuzeyleri scoped contribution detaylariyla acildi.

- Uygulama plani eklendi: `docs/superpowers/plans/2026-04-25-competition-scoped-read-surfaces.md`.
- Backend competition detail kontratina `storeContributions` eklendi.
- Store contribution satirlari `companyIds`, `regionIds` ve `storeIds` read scope filtresiyle okunur.
- Non-company kullanicilar icin `teams[].stores` artik forbidden vermek yerine scope disi magazalari redakte eder.
- Aggregate takim skorlari gorunur kalir; magazaya ait contribution satirlari sadece yetkili scope icinden gelir.
- Admin competition yuzeyi role-aware hale geldi: `SUPER_ADMIN` ve `HR_ADMIN` disindaki roller create/recalculate/finalize butonlarini gormez.
- `REGION_MANAGER` `/admin/competitions` uzerinden read-only standing ve scoped contribution detaylarini gorebilir.
- Store shell icine `/store/competitions` read-only route'u eklendi.
- Store competition smoke testi store kullanicisinin sadece kendi scoped contribution satirlarini gordugunu ve write aksiyonlarini gormedigini korur.
- Frontend smoke kapsami 5 testten 7 teste cikarildi.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 28 suite / 185 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 7 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`); Vite chunk warning yok.
- Siradaki mantikli adim: IK/Admin icin stage/team template olusturma ekranini gercek form akisina cevirmek; DB/API var ama UI tarafindaki yonetim hatti henuz tam kapanmadi.

## Son Competition Stage Builder UI

25 Nisan 2026 itibariyla IK/Admin competition stage builder UI borcu kapatildi.

- Uygulama plani eklendi: `docs/superpowers/plans/2026-04-25-competition-stage-builder-ui.md`.
- `/admin/competitions` icinde `SUPER_ADMIN` ve `HR_ADMIN` icin stage olusturma formu acildi.
- Form mevcut `POST /api/competitions/:competitionId/stages` API sozlesmesini kullanir; backend kontrati degismedi.
- Store secenekleri `/api/auth/lookups` store listesinden gelir.
- V1 form iki takimla baslar; her takim valid code/name ve en az bir magaza secimi olmadan submit acilmaz.
- `stageCode` ve `teamCode` UI tarafinda uppercase/underscore formatina normalize edilir.
- Basarili kayit sonrasi competition listesi ve detail query'leri invalidate edilir.
- `REGION_MANAGER`, store rolleri ve diger read-only roller stage builder/create aksiyonunu gormez.
- Playwright smoke kapsami 7 testten 8 teste cikarildi; yeni test create stage POST payload'inde iki takim ve magaza atamalarini dogrular.
- TDD kirmizi dogrulamasi yapildi: test once `Stage code` label'i yokken fail verdi, implementasyon sonrasi targeted competition smoke gecti.
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 8 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`); Vite chunk warning yok.
- Siradaki mantikli adim: team template CRUD ve stage olusturma akisinda hazir takim sablonu kullanma hattini eklemek. Bu sayede her yarismada takimlari sifirdan yazmak zorunda kalmayiz.

## Son Competition Team Template V1

25 Nisan 2026 itibariyla competition team template V1 hatti acildi.

- Uygulama plani eklendi: `docs/superpowers/plans/2026-04-25-competition-team-template-v1.md`.
- Backend `GET /api/competitions/team-templates` ve `POST /api/competitions/team-templates` endpointleri eklendi.
- Endpointler `SUPER_ADMIN` ve `HR_ADMIN` ile sinirlidir; read-only roller template yonetimi gormez.
- Template create akisi `ops.competition_team_template` ve `ops.competition_team_template_store` tablolarina yazar.
- Template create bos store listesiyle reddedilir; duplicate store id'leri servis seviyesinde tekillestirilir.
- Audit event `competition_team_template.created` olarak yazilir; metadata icinde `templateCode` ve `storeCount` bulunur.
- Stage builder icinde kucuk team template formu acildi; store secimi `/api/auth/lookups` store listesine baglidir.
- Stage builder icinde her takim icin `Team N template` secimi eklendi; template secilince team code/name/storeIds/sourceTemplateId otomatik doldurulur.
- Stage create payload'i template kullanan takimlarda `sourceTemplateId` tasir; manuel takimlar eski akisi korur.
- TDD kirmizi dogrulamasi yapildi: backend metotlari yokken Jest compile fail verdi; frontend template controls yokken Playwright `Template code` label'inda fail verdi.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 28 suite / 190 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 9 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`); Vite chunk warning yok.
- Siradaki mantikli adim: template lifecycle yonetimini buyutmek. Once `is_active` pasiflestirme/guncelleme ve template listesi filtreleri; sonra bolge ligi/final gibi stage formatlarinda template setlerini kullanma.

## Son Competition Template Lifecycle V1

25 Nisan 2026 itibariyla competition team template lifecycle V1 hatti acildi.

- Uygulama plani eklendi: `docs/superpowers/plans/2026-04-25-competition-template-lifecycle-v1.md`.
- Backend `GET /api/competitions/team-templates?activeOnly=false` filtresini destekler; default davranis sadece aktif template listesidir.
- Backend `PATCH /api/competitions/team-templates/:templateId/deactivate` endpointi eklendi.
- Deactivate hard-delete yapmaz; `is_active = FALSE` yazar ve eski stage/team `sourceTemplateId` referanslarini korur.
- Audit event `competition_team_template.deactivated` olarak yazilir; metadata `templateId` ve `changedFields` tasir.
- Stage builder team select sadece aktif template query'sini kullanir.
- Stage builder icinde `Template library` eklendi; `Show inactive templates` toggle ile pasif template'ler gorunur.
- Aktif template'ler library uzerinden pasiflestirilebilir; basarili aksiyon aktif team select listesinden dusurur.
- TDD kirmizi dogrulamasi yapildi: backend lifecycle metotlari yokken Jest compile fail verdi; frontend library yokken Playwright `.stage-template-library` fail verdi.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 28 suite / 194 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 10 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`); Vite chunk warning yok.
- Siradaki mantikli adim: template update/clone akisini eklemek. Bu sayede bolge ligi/final gibi uzun sureli kurgularda eski stage referanslari bozulmadan template'ler cogaltilabilir veya revize edilebilir.

## Son Competition Template Clone/Update V1

25 Nisan 2026 itibariyla competition team template clone/update V1 hatti acildi.

- Uygulama plani eklendi: `docs/superpowers/plans/2026-04-25-competition-template-clone-update-v1.md`.
- Backend `PUT /api/competitions/team-templates/:templateId` endpointi eklendi.
- Backend `POST /api/competitions/team-templates/:templateId/clone` endpointi eklendi.
- Update akisi template code/name/description ve store membership setini gunceller; duplicate store id'leri service seviyesinde tekillestirilir.
- Clone akisi source template store membership setini yeni aktif template'e kopyalar; yeni template kendi `templateId` ve yeni code/name ile olusur.
- Eski stage/team `sourceTemplateId` referanslari korunur; update/clone hard-delete veya historical rewrite yapmaz.
- Audit event `competition_team_template.updated` ve `competition_team_template.cloned` olarak yazilir.
- Frontend ortak API helper'i `PUT` JSON requestlerini destekleyecek sekilde genisletildi.
- Stage builder `Template library` icinde `Edit`, `Clone`, `Deactivate` aksiyonlari birlikte calisir.
- Edit formu template code/name/description ve store secimini gunceller.
- Clone formu yeni code/name/description alir ve store setini backend source template uzerinden kopyalar.
- TDD kirmizi dogrulamasi yapildi: backend update/clone metotlari yokken Jest TypeScript compile fail verdi; frontend edit/clone butonlari yokken Playwright fail verdi.
- Hedefli backend dogrulama gecti: `npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand` -> 2 suite / 21 test.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; npx.cmd playwright test e2e/competition-surfaces.spec.ts` -> 6 Playwright test.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 28 suite / 199 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 11 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`); Vite chunk warning yok.
- Siradaki mantikli adim: stage format presetlerini planlamak. Bolge ligi, ilk 15 gun eleme, final/finalist kapistirma gibi kurgu tiplerini template setleriyle baglayacak yapi artik daha rahat kurulabilir.

## Son Competition Stage Format Presets V1

25 Nisan 2026 itibariyla competition stage format preset V1 hatti acildi.

- Uygulama plani eklendi: `docs/superpowers/plans/2026-04-25-competition-stage-format-presets-v1.md`.
- Backend stage create kontratina opsiyonel `stagePresetCode` eklendi.
- Desteklenen preset kodlari: `region_league`, `first_half_qualifier`, `final_showdown`.
- Backend DTO `stagePresetCode` icin whitelist validation yapar.
- Repository `advancement_rule_json` alanina preset izini yazar:
  - `region_league` -> `{ type: "rank_all", presetCode: "region_league" }`
  - diger presetler -> `{ type: "top_n", count: 1, presetCode }`
  - preset yoksa eski `{ type: "top_n", count: 1 }` davranisi korunur.
- Audit metadata artik stage create icin `stagePresetCode` tasir.
- Frontend `admin-web/src/features/competitions/stage-presets.ts` icinde V1 preset tanimlari eklendi.
- Stage builder icine `Stage preset` select'i eklendi.
- `Regional league` preset'i stage code/name/type/order ve competition full date range alanlarini doldurur.
- `First half qualifier` preset'i competition tarih araliginin ilk yarisini kullanir.
- `Final showdown` preset'i competition tarih araliginin ikinci yarisini/final kismini kullanir.
- Preset secimi takim draftlarini korur; sadece stage alanlarini doldurur.
- Stage create payload'i preset seciliyken `stagePresetCode` gonderir; manual stage eski akisi korur.
- TDD kirmizi dogrulamasi yapildi: backend `stagePresetCode` contract'ta yokken Jest TypeScript compile fail verdi; frontend `Stage preset` control yokken Playwright fail verdi.
- Hedefli backend dogrulama gecti: `npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand` -> 2 suite / 23 test.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; npx.cmd playwright test e2e/competition-surfaces.spec.ts` -> 7 Playwright test.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 28 suite / 201 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 12 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`); Vite chunk warning yok.
- Siradaki mantikli adim: preset setlerini takim template setleriyle baglayan bir "stage package" veya "competition plan wizard" tasarlamak. Bu, bolge ligi + final gibi cok asamali kurguyu tek tek stage olusturmadan hazirlatir.

## Son Competition Plan Wizard V1

25 Nisan 2026 itibariyla competition plan wizard / stage package V1 hatti acildi.

- Uygulama plani eklendi: `docs/superpowers/plans/2026-04-25-competition-plan-wizard-v1.md`.
- Backend `POST /api/competitions/:competitionId/stage-packages` endpointi eklendi.
- V1 paket kodu: `league_then_final`.
- Paket iki stage tasir:
  - `region_league` / `REGION_LEAGUE`
  - `final_showdown` / `FINAL_SHOWDOWN`
- Backend paket create akisi tum stage'leri tek DB transaction icinde olusturur; ikinci stage veya team insert patlarsa ilk stage DB'de tek basina kalmaz.
- Tekil stage olusturma davranisi korundu; `createStageWithTeams` ic insert helper'a tasindi ve eski endpoint ayni sozlesmeyle calisir.
- Service validation ortaklastirildi: stage date araligi, minimum iki takim, takim basina en az bir store kontrolu hem tek stage hem paket icin gecerlidir.
- Paket icinde duplicate `stageCode` reddedilir.
- Audit event eklendi: `competition_stage_package.created`; metadata icinde `packageCode`, `stageCount` ve `stageCodes` bulunur.
- Frontend `admin-web/src/features/competitions/stage-packages.ts` helper'i eklendi; mevcut stage preset tarih mantigini kullanarak package payload'i uretir.
- Stage builder icine `Stage package` bolumu eklendi; HR/Admin iki aktif team template secer ve `Create stage package` ile lig + final stage'lerini tek komutla olusturur.
- Playwright competition smoke testi paket payload'inda `region_league` ve `final_showdown` stage'lerinin birlikte gonderildigini korur.
- TDD kirmizi dogrulamasi yapildi: backend `createStagePackage` yokken Jest TypeScript compile fail verdi; frontend `Stage package` kontrolu yokken Playwright fail verdi.
- Hedefli backend dogrulama gecti: `npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand` -> 2 suite / 25 test.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; npx.cmd playwright test e2e/competition-surfaces.spec.ts` -> 8 Playwright test.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 28 suite / 203 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 13 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`); Vite chunk warning yok.
- Siradaki mantikli adim: plan wizard'a submit oncesi preview/duzenleme adimi eklemek. Boylece IK iki stage'in tarih, takim ve template baglarini tek ekranda onaylayip gerekirse paketi gondermeden ince ayar yapabilir.

## Son Competition Plan Wizard Preview V1

25 Nisan 2026 itibariyla competition plan wizard submit oncesi preview/duzenleme hatti acildi.

- Uygulama plani eklendi: `docs/superpowers/plans/2026-04-25-competition-plan-wizard-preview-v1.md`.
- Backend stage package endpointi degismedi; transaction garantisi aynen korunur.
- Frontend package helper'i artik once editable stage draft'lari uretir.
- `Stage package` bolumunde her package stage icin preview/editor alanlari var:
  - `Package stage N code`
  - `Package stage N name`
  - `Package stage N order`
  - `Package stage N type`
  - `Package stage N starts`
  - `Package stage N ends`
- IK/Admin `league_then_final` paketini olusturmadan once lig ve final stage adlarini/tarihlerini/tiplerini ince ayarlayabilir.
- Team template secimleri stage alanlarini resetlemez; sadece paket payload'ina iki secili aktif template'in takim/store baglarini ekler.
- Package validation genisledi: stage draft sayisi, stage code formati, unique stage code, stage name, order ve tarih araligi kontrol edilir.
- Playwright testi final stage adini ve baslangic tarihini preview uzerinden degistirip API payload'ina yansidigini korur.
- TDD kirmizi dogrulamasi yapildi: `Package stage 1 code` preview alani yokken Playwright fail verdi.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; npx.cmd playwright test e2e/competition-surfaces.spec.ts` -> 8 Playwright test.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 28 suite / 203 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 13 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`); Vite chunk warning yok.
- Siradaki mantikli adim: package planlarini kaydedilebilir taslak haline getirmek. Boylece IK bir turnuva planini bugun hazirlayip toplantidan sonra ayni taslagi publish/execute edebilir; audit ve geri donus izi daha guclu olur.

## Son Competition Stage Package Plan Drafts V1

25 Nisan 2026 itibariyla stage package planlarini kaydedilebilir taslak haline getiren V1 hatti acildi.

- Uygulama plani eklendi: `docs/superpowers/plans/2026-04-25-competition-stage-package-plan-drafts-v1.md`.
- Yeni DB modeli eklendi: `ops.competition_stage_package_plan`.
- Yeni migration eklendi: `db/migrations/023_competition_stage_package_plans.sql`.
- `db/schema.sql` stage package plan tablo ve index tanimlariyla guncellendi.
- Backend kontratina `CompetitionStagePackagePlan`, `CreateCompetitionStagePackagePlanInput` ve `ExecuteCompetitionStagePackagePlanInput` eklendi.
- Backend endpointleri eklendi:
  - `GET /api/competitions/:competitionId/stage-package-plans`
  - `POST /api/competitions/:competitionId/stage-package-plans`
  - `POST /api/competitions/stage-package-plans/:planId/execute`
- Save draft akisi stage olusturmaz; sadece stage draft JSON'unu, plan adini ve audit izini kaydeder.
- Execute akisi plan satirini `FOR UPDATE` ile kilitler, sadece `draft` durumundaki planlari calistirir, mevcut stage/team insert helper'i ile tum stage'leri tek transaction icinde olusturur.
- Execute edilen plan `executed` durumuna gecer ve `createdStageIds` alanina olusan stage id'leri yazilir; ayni taslak tekrar execute edilemez.
- Audit eventleri eklendi:
  - `competition_stage_package_plan.saved`
  - `competition_stage_package_plan.executed`
- Frontend competition API helper'lari eklendi: plan list, save draft ve execute.
- Stage builder icine `Package plan name`, `Save package plan` ve `Package plan library` eklendi.
- IK/Admin aktif team template secimleriyle plan kaydedebilir, library uzerinden draft plani execute edebilir.
- TDD kirmizi dogrulamasi yapildi:
  - Backend service testleri `listStagePackagePlans/createStagePackagePlan/executeStagePackagePlan` yokken TypeScript fail verdi.
  - Repository testleri yeni persistence metotlari yokken TypeScript fail verdi.
  - Frontend Playwright testi `Package plan name` alani yokken fail verdi.
- Hedefli backend dogrulama gecti: `npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand` -> 2 suite / 32 test.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; npx.cmd playwright test e2e/competition-surfaces.spec.ts` -> 9 Playwright test.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 28 suite / 210 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 14 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`); Vite chunk warning yok.
- Siradaki mantikli adim: package plan lifecycle V1'i buyutmek. Draft rename/edit/cancel ve audit/history gorunurlugu eklenirse toplantidan once hazirlanan planlar execute edilmeden once daha kontrollu yonetilir.

## Son Competition Stage Package Plan Lifecycle V1

25 Nisan 2026 itibariyla stage package plan lifecycle V1 borcu kapatildi.

- Uygulama plani eklendi: `docs/superpowers/plans/2026-04-25-competition-stage-package-plan-lifecycle-v1.md`.
- Tasarim notu eklendi: `docs/superpowers/specs/2026-04-25-competition-stage-package-plan-lifecycle-v1-design.md`.
- Backend kontratina plan update/cancel ve audit event okuma tipleri eklendi.
- Backend endpointleri eklendi:
  - `PUT /api/competitions/stage-package-plans/:planId`
  - `PATCH /api/competitions/stage-package-plans/:planId/cancel`
  - `GET /api/competitions/stage-package-plans/:planId/audit`
- Sadece `draft` durumundaki package planlar duzenlenebilir veya iptal edilebilir.
- `executed` planlar immutable kalir; gercek stage/team kaydi olustugu icin geriye donuk rewrite yoktur.
- `cancelled` planlar hard-delete edilmez; history icin listede kalir, execute/edit/cancel aksiyonlari kapali olur.
- Update akisi plan adini, package code'unu ve stage draft JSON'unu transaction icinde gunceller.
- Cancel akisi `plan_status = 'cancelled'` yazar ve stage olusturmaz.
- Audit eventleri eklendi:
  - `competition_stage_package_plan.updated`
  - `competition_stage_package_plan.cancelled`
- Audit history `audit.event_log` uzerinden okunur; frontend plan kutusunda `Show history` ile saved/updated/cancelled izini gosterir.
- Frontend competition API helper'lari eklendi: update, cancel ve audit list.
- Stage builder `Package plan library` icinde draft plan icin `Edit`, `Cancel`, `Execute` ve tum planlar icin `Show history` aksiyonlari calisir.
- Plan edit formu plan adi ve package stage code/name/order/type/start/end alanlarini gunceller; mevcut team/template baglari korunur.
- TDD kirmizi dogrulamasi yapildi:
  - Backend service testleri `updateStagePackagePlan/cancelStagePackagePlan/listStagePackagePlanAudit` yokken TypeScript fail verdi.
  - Repository testleri lifecycle persistence metotlari yokken TypeScript fail verdi.
  - Frontend Playwright testi `Edit April regional package` butonu yokken fail verdi.
- Hedefli backend dogrulama gecti: `npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand` -> 2 suite / 39 test.
- Hedefli frontend dogrulama gecti: `npm.cmd run test:e2e -- e2e/competition-surfaces.spec.ts -g "edit, inspect, and cancel"` -> 1 Playwright test.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 28 suite / 217 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 15 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`); Vite chunk warning yok.
- Siradaki mantikli adim: package planlarini tek competition icinde sadece listelemekten cikarip review/approval akisiyle baglamak. IK hazirlar, toplantidan sonra onayli kisi execute eder yapisina gecerse turnuva planlari daha buyurken de dagilmaz.

## Son Competition Stage Package Plan Approval V1

25 Nisan 2026 itibariyla stage package plan approval gate V1 hatti acildi.

- Tasarim notu eklendi: `docs/superpowers/specs/2026-04-25-competition-stage-package-plan-approval-v1-design.md`.
- Uygulama plani eklendi: `docs/superpowers/plans/2026-04-25-competition-stage-package-plan-approval-v1.md`.
- Yeni migration eklendi: `db/migrations/024_competition_stage_package_plan_approval.sql`.
- `ops.competition_stage_package_plan` plan status seti genisledi:
  - `draft`
  - `submitted`
  - `approved`
  - `rejected`
  - `executed`
  - `cancelled`
- Plan review metadata alanlari eklendi:
  - `submitted_by_user_id`
  - `submitted_at`
  - `reviewed_by_user_id`
  - `reviewed_at`
  - `review_note`
- Backend endpointleri eklendi:
  - `POST /api/competitions/stage-package-plans/:planId/submit`
  - `POST /api/competitions/stage-package-plans/:planId/approve`
  - `POST /api/competitions/stage-package-plans/:planId/reject`
- Execute guard degisti: package plan artik sadece `approved` durumundayken execute edilebilir.
- Draft plan dogrudan execute edilemez; once submit, sonra approve gerekir.
- Submitted plan edit/cancel/execute edilemez; sadece approve/reject edilir.
- Rejected plan history olarak kalir ve execute edilemez.
- V1 urun karari: ayni yetkili IK/Admin kullanicisi plani submit edip approve edebilir; bu onay gate'i bugun "baska kisiden izin" degil, taslak hazirligi ile resmi karar arasindaki karar kilidi olarak kullanilir.
- Gelecek delege akisi desteklenir: ileride plani alt ekip uyesi hazirlayip submit edebilir, IK karar sahibi ise `reviewed_by_user_id` ile approve/reject eder. Strict "submitter kendi planini onaylayamaz" kurali V1'de zorunlu degildir, ileride policy olarak eklenebilir.
- Audit eventleri eklendi:
  - `competition_stage_package_plan.submitted`
  - `competition_stage_package_plan.approved`
  - `competition_stage_package_plan.rejected`
- Frontend `Package plan library` status bazli aksiyonlara ayrildi:
  - Draft: `Edit`, `Cancel`, `Submit`, `Show history`
  - Submitted: `Approve`, `Reject`, `Show history`
  - Approved: `Execute`, `Show history`
  - Rejected/executed/cancelled: sadece `Show history`
- Submitted plan icin inline review note alani eklendi.
- TDD kirmizi dogrulamasi yapildi:
  - Backend service testleri `submitStagePackagePlan/approveStagePackagePlan/rejectStagePackagePlan` yokken TypeScript fail verdi.
  - Repository testleri transition metotlari yokken TypeScript fail verdi.
  - Frontend Playwright testi draft planda `Execute` butonu gorunurken ve review note alani yokken fail verdi.
- Hedefli backend dogrulama gecti: `npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand` -> 2 suite / 46 test.
- Hedefli frontend dogrulama gecti: `npm.cmd run test:e2e -- e2e/competition-surfaces.spec.ts` -> 11 Playwright test.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 28 suite / 224 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 16 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`); Vite chunk warning yok.
- Siradaki mantikli adim: approval gate metinlerini ve UX dilini "karar kilidi" mantigiyla netlestirmek; submit/approve kullaniciya baska kisiden izin gibi degil, hazirliktan resmi karara gecis gibi hissettirmeli.

## Son Competition Package Plan Decision-Lock UX

25 Nisan 2026 itibariyla package plan approval gate UI dili karar kilidi mantigiyla netlestirildi.

- Backend/API status degerleri degismedi; `submitted`, `approved`, `rejected` audit ve kontrat uyumu icin aynen kalir.
- Frontend insan dili guncellendi:
  - `submitted` status'u UI'da `decision ready` olarak gosterilir.
  - `rejected` status'u UI'da `returned` olarak gosterilir.
  - Draft aksiyonu `Submit` yerine `Mark ready for decision`.
  - Submitted aksiyonlari `Approve decision` ve `Return for revision`.
  - Review input label'i `Decision note`.
  - Approved execute aksiyonu `Execute approved plan`.
- Hedefli TDD dogrulamasi:
  - Ilk kirmizi: `npm.cmd run test:e2e -- e2e/competition-surfaces.spec.ts -g "stage package plan"` build yenilenmeden eski UI metinlerinde fail verdi.
  - Yesil: `npm.cmd run build; npm.cmd run test:e2e -- e2e/competition-surfaces.spec.ts -g "stage package plan"` -> 3 Playwright test.
- Not: Frontend Playwright config'i `vite preview` kullandigi icin source degisikliginden sonra hedefli E2E oncesi build almak gerekir.
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 16 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Siradaki mantikli adim: returned/rejected planlar icin "clone as new draft" akisini planlamak. Boylece yanlis paket geri dondugunde sifirdan kurmak yerine kontrollu duzeltme taslagi acilir.

## Son Competition Returned Plan Clone V1

25 Nisan 2026 itibariyla returned/rejected package planlar icin clone-as-new-draft akisi eklendi.

- Backend endpoint eklendi: `POST /api/competitions/stage-package-plans/:planId/clone`.
- Clone sadece `rejected` plandan yapilir; kaynak plan history olarak immutable kalir.
- Yeni plan `draft` status'u ile olusur, `created_stage_ids`, submit/review/execution metadata alanlari temiz baslar.
- Yeni plan adi otomatik kaynak plan adinin sonuna `revision` eklenerek uretilir.
- Audit izleri:
  - Kaynak plan: `competition_stage_package_plan.cloned_to_draft`.
  - Yeni draft: `competition_stage_package_plan.cloned_from_returned`.
- Frontend `Package plan library` icinde returned planlarda `Clone as new draft` aksiyonu gorunur.
- Hedefli backend dogrulama gecti: `npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand` -> 2 suite / 49 test.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; npm.cmd run test:e2e -- e2e/competition-surfaces.spec.ts -g "reject a submitted stage package plan"` -> 1 Playwright test.
- Onumuzdeki yapilacaklar listesi eklendi: `docs/plans/active-next-actions.md`.
- Siradaki mantikli adim: package plan source visibility. Clone edilen draft kartinda veya history gorunumunde hangi returned plandan geldigi daha okunur hale getirilmeli.

## Son Package Plan Source Visibility

25 Nisan 2026 itibariyla clone edilen package planlarin hangi returned plandan geldigi gorunur hale getirildi.

- Schema degisikligi yapilmadi; backend `sourcePlan` bilgisini `competition_stage_package_plan.cloned_from_returned` audit metadata'sindan turetir.
- `GET /api/competitions/:competitionId/stage-package-plans` yanitinda clone draftlar icin `sourcePlan` gelir.
- Frontend `Package plan library` kartinda clone draft icin `Cloned from ...` metni gosterilir.
- Clone draft history gorunumunde `Source: ...` metni okunur; kaynak ve clone audit izi birlikte izlenebilir kalir.
- Hedefli backend dogrulama gecti: `npm.cmd test -- src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand` -> 1 suite / 25 test.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; npm.cmd run test:e2e -- e2e/competition-surfaces.spec.ts -g "reject a submitted stage package plan"` -> 1 Playwright test.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 28 suite / 227 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 16 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- `docs/plans/active-next-actions.md` guncellendi; tamamlanan kaynak gorunurlugu kaleminden sonra siradaki mantikli adim `Package Plan Pre-Approval Preview`.

## Son Package Plan Pre-Approval Preview

26 Nisan 2026 itibariyla decision-ready package planlar icin onay oncesi karar ozeti eklendi.

- Backend/API degisikligi yapilmadi; preview mevcut `stageDrafts` verisinden frontend tarafinda turetilir.
- Submitted/decision-ready plan kartinda `Decision preview` bolumu gorunur.
- Preview icerigi:
  - plan tarih araligi
  - stage sayisi
  - team template sayisi
  - stage bazli tarih ve store assignment sayisi
  - toplam store assignment sayisi
- TDD kirmizi dogrulamasi yapildi: `npm.cmd run build; npm.cmd run test:e2e -- e2e/competition-surfaces.spec.ts -g "save, submit, approve, and execute"` once `Decision preview` bulunamadigi icin fail verdi.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; npm.cmd run test:e2e -- e2e/competition-surfaces.spec.ts -g "save, submit, approve, and execute"` -> 1 Playwright test.
- Backend release check gecti: `npm.cmd run check:release` -> lint, 28 suite / 227 test, build ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- Frontend release check gecti: `npm.cmd run check:release` -> lint, build, 16 Playwright smoke testi ve `npm audit --omit=dev` (`found 0 vulnerabilities`).
- `docs/plans/active-next-actions.md` guncellendi; siradaki mantikli adim `Stage Package Template Variants` icin feature intake roportaji.

## Son Project Forward Preview And Daily Closure Ranking V2 Explainability

26 Nisan 2026 itibariyla proje icin ileri yol onizlemesi yazildi ve Daily Closure Ranking V2 Explainability uygulandi.

Yeni dokumanlar:

- `docs/plans/project-forward-preview-2026-04-26.md`
- `docs/superpowers/plans/2026-04-26-daily-closure-ranking-v2-explainability.md`

Project forward preview sonucu:

- Mevcut durum "production-ready" degil, ama foundation-healthy olarak degerlendirildi.
- En guclu taraf kontrol: auth/scope, release gate, feed/competition ayrimi, staging evidence guard ve debt ledger.
- Ana riskler real source data, real staging IdP kaniti, UI/UX polish'in gec kalmasi ve score anlaminin kullaniciya yeterince anlatilmamasi.
- Tavsiye edilen rota: Daily Closure V2, score meaning, real KPI ingest, real staging evidence, store UX polish, config governance, design-system pass.

Daily Closure V2 sonucu:

- Mevcut `GET /api/reports/leaderboards/closed` endpoint'i ve `rpt` read modeli korundu.
- Yeni DB schema, skor formulu, region league, challenge leaderboard veya ikinci ranking engine acilmadi.
- Backend closed-ranking contract'ina employee-level alanlar eklendi:
  - `rankingStatus`
  - `eligibilityReason`
  - `neededPerformanceDays`
- Gunluk kapali satirlar resmi siralama olarak isaretlenir.
- Aylik satirlar 3 kapali performans gunune ulasmadiysa preview-only olarak isaretlenir.
- `/store/rankings` icinde rank, coverage, donem durumu ve preview-only aciklamalari Turkish-first copy ile gosterilir.
- Aylik preview durumunda kullanici kac kapali performans gunu daha gerektigini gorur.

Dogrulama:

- Backend kirmizi test izlendi: explainability alanlari yokken `closed-ranking.service.spec.ts` fail verdi.
- Frontend kirmizi test izlendi: `On izleme` aciklamasi yokken Playwright fail verdi.
- Hedefli backend test gecti: `npm.cmd test -- src/modules/store-ops/application/closed-ranking.service.spec.ts --runInBand` -> 1 suite / 4 test.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store rankings"` -> 2 Playwright test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> root script tests, backend lint/test/build/audit, frontend lint/script/build/22 Playwright/audit.

Debt ledger:

- Closed active debts: 13
- Strategic investment backlog: 7
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: Score Meaning / Grade Interpretation. Weighted score artik gorunuyor ve siralama aciklaniyor; siradaki en degerli is, skorun ne anlama geldigini grade band, esik ve is diliyle kullaniciya anlatmak.

## Son Score Meaning V1

26 Nisan 2026 itibariyla `/store/me` icin personel weighted score yorum katmani eklendi.

Yeni dokuman:

- `docs/plans/score-meaning-v1.md`

Eklenenler:

- `admin-web/src/features/kpi/grading.ts` icinde `PerformanceScoreMeaning` ve `resolvePerformanceScoreMeaning`.
- `/store/me` icinde `Skor yorumu` paneli.
- Grade kodlari icin sade is dili:
  - `A`: Guclu performans
  - `B`: Saglikli performans
  - `C`: Takip gerekli
  - `D`: Kritik takip
- Skor yorumunda veri guveni metni: kac metrik skorlandi, yorum tam mi on izleme mi.

Sinir:

- Backend contract degismedi.
- Score formulu degismedi.
- Grade threshold degerleri degismedi.
- Yeni DB, migration veya config schema yok.
- Bu V1 personel self-performance skor anlamlandirmasidir; store-score threshold dili henuz ayri yatirimdir.
- KPI source semantics V1 daha sonra ayri katman olarak eklendi.

Dogrulama:

- Kirmizi test izlendi: `Skor yorumu` yokken self-performance Playwright testi fail verdi.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "self-performance"` -> 1 Playwright test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> root script tests, backend lint/test/build/audit, frontend lint/script/build/22 Playwright/audit.

Debt ledger:

- Closed active debts: 14
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim artik tamamlandi: KPI Source Semantics V1.

## Son KPI Source Semantics V1

26 Nisan 2026 itibariyla store-facing KPI satirlarina kaynak anlamlandirmasi eklendi.

Yeni dokuman:

- `docs/plans/kpi-source-semantics-v1.md`

Eklenenler:

- `admin-web/src/features/kpi/source-semantics.ts` helper'i.
- `/store/me` personel metrik satirlarinda `Kaynak tipi` ve `Veri kaynagi`.
- `/store/kpis` weighted-score katkisi ve priority follow-up satirlarinda ayni kaynak dili.
- Kaynak tipleri:
  - `Imported operational data`
  - `Derived score signal`
  - `Checklist-fed`
  - `Pending normalization`
  - `Missing`

Sinir:

- Backend contract degismedi.
- Score formulu degismedi.
- DB schema veya migration yok.
- Gercek import connector/source-lineage metadata'si henuz eklenmedi.
- Bu V1 presentation-only semantics katmanidir.

Dogrulama:

- Kirmizi test izlendi: self-performance ve store KPI Playwright testleri `Veri kaynagi` yokken fail verdi.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; if ($LASTEXITCODE -eq 0) { npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "self-performance|store KPI highlights" }` -> 2 Playwright test.

Debt ledger:

- Closed active debts: 15
- Strategic investment backlog: 6
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: Store-score threshold language. Store weighted score bandlari kullaniciya "iyi/kritik/takip" seviyesinde ne ifade ediyor, ne zaman action/warning diline donmeli, bunu hesaplamayi degistirmeden anlatmak.

## Son Store Score Threshold Language V1

26 Nisan 2026 itibariyla `/store/kpis` icin store weighted score yorum katmani eklendi.

Yeni dokuman:

- `docs/plans/store-score-threshold-language-v1.md`

Eklenenler:

- `admin-web/src/features/kpi/grading.ts` icinde `StoreScoreThresholdMeaning` ve `resolveStoreScoreThresholdMeaning`.
- `/store/kpis` icinde `Store skor yorumu` paneli.
- Store grade kodlari icin is dili:
  - `A`: Guclu store skoru
  - `B`: Saglikli store skoru
  - `C`: Store takip bandi
  - `D`: Kritik store skoru
- Skor guveni metni: kapsanan agirlik ve eksik agirlik varsa on izleme uyarisi.
- Aksiyon dili: score'dan task uretmeden, kullaniciya nasil okunacagini anlatan kisa yonlendirme.

Sinir:

- Backend contract degismedi.
- Score formulu degismedi.
- Grade threshold config degismedi.
- DB schema veya migration yok.
- Task/action yaratma yok.
- Interpretation versioning henuz yok; bu siradaki mimari adaydir.

Dogrulama:

- Kirmizi test izlendi: store KPI Playwright testi `Store skor yorumu` yokken fail verdi.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; if ($LASTEXITCODE -eq 0) { npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store KPI highlights" }` -> 1 Playwright test.

Debt ledger:

- Closed active debts: 16
- Strategic investment backlog: 6
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: KPI interpretation versioning / config governance planning. Score ve threshold yorumlari ileride admin-editable olmadan once effective date/version ile izlenebilir hale gelmeli.

## Son KPI Interpretation Governance V1

26 Nisan 2026 itibariyla KPI yorum/threshold governance plani eklendi.

Yeni dokuman:

- `docs/plans/kpi-interpretation-governance-v1.md`

Karar:

- Simdilik yeni `dm` veya `config` schema yok.
- Mevcut `ops.kpi_score_profile_config` module-owned data config olarak kalir.
- KPI yorum/threshold dili admin-editable olmadan once version/effective-date/snapshot anchoring gereklidir.
- Audit publish olayini anlatir ama tek basina historical interpretation icin yeterli degildir.
- `rpt` snapshotlari ileride hangi KPI config version ile uretildigini tasimadan gecmis yorum tam guvenli sayilmaz.

Planlanan hedef model:

- versioned published config
- interpretation packs
- snapshot anchoring
- effective date
- rollback
- config metadata iceren API response
- frontend interpretation helper'larinin metadata-aware hale gelmesi

Sinir:

- DB schema degismedi.
- Migration yok.
- Backend contract degismedi.
- Score formulu degismedi.
- Frontend davranisi degismedi.
- Bu adim implementation degil, governance karar kilididir.

Dogrulama:

- Dokuman self-review yapildi: placeholder yok, kapsam bilincli olarak plan seviyesinde.
- Resmi release gate gecti: `npm.cmd run check:release` -> root script tests, backend lint/test/build/audit, frontend lint/script/build/23 Playwright/audit.

Debt ledger:

- Closed active debts: 17
- Strategic investment backlog: 6
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: KPI config editor governance preview. Mevcut admin KPI config draft/publish yuzeyi, publish oncesi neyin degisecegini daha okunur gostermeli; versioned schema henuz acilmadan decision preview guclendirilmeli.

## Son KPI Config Editor Governance Preview V1

26 Nisan 2026 itibariyla `/admin/kpi-config` icin publish-oncesi governance preview eklendi.

Yeni dokuman:

- `docs/plans/kpi-config-editor-governance-preview-v1.md`

Eklenenler:

- `Governance preview` paneli.
- `Publish decision preview` basligi.
- Draft/live diff sayilari:
  - store profile
  - personnel profile
  - ownership matrix
  - grading bands
- Unpublished change durumunda `Review before publish` status dili.
- `Versioned schema: Not active yet` hatirlatmasi.
- Snapshot anchoring gerekliligi icin acik uyari.
- `admin-web/e2e/admin-kpi-config.spec.ts` ile Playwright korumasi.

Sinir:

- Backend contract degismedi.
- API response degismedi.
- DB schema veya migration yok.
- Score formulu degismedi.
- Publish davranisi degismedi.
- Versioned config implementation henuz acilmadi.

Dogrulama:

- Kirmizi test izlendi: `Publish decision preview` yokken admin KPI config Playwright testi fail verdi.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; if ($LASTEXITCODE -eq 0) { npm.cmd run test:e2e -- e2e/admin-kpi-config.spec.ts }` -> 1 Playwright test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> root script tests, backend lint/test/build/audit, frontend lint/script/build/24 Playwright/audit.

Debt ledger:

- Closed active debts: 18
- Strategic investment backlog: 5
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: Ranking completeness / segment-ready behavior. Turkey-wide, store ve metric mini-rank gorunumleri, daha derin KPI config versioning acilmadan once netlestirilmeli.

## Son Ranking Completeness Segment Readiness V1

26 Nisan 2026 itibariyla `/store/rankings` icin siralama kapsam olgunlugu paneli eklendi.

Yeni dokuman:

- `docs/plans/ranking-completeness-segment-readiness-v1.md`

Eklenenler:

- `Siralama kapsam olgunlugu` paneli.
- `Turkiye geneli` readiness satiri.
- `Magaza ici` readiness satiri.
- `Metrik mini-rank` readiness satiri.
- `Segment hazirligi` readiness satiri.
- Segmentlerin ileride yeni skor motoru acmadan, mevcut kapali snapshot + period + metric code modeliyle baglanabilecegini anlatan urun dili.

Sinir:

- Backend contract degismedi.
- API response degismedi.
- DB schema veya migration yok.
- Score formulu degismedi.
- Yeni ranking engine yok.
- Region league, tournament veya reward davranisi yok.

Dogrulama:

- Kirmizi test izlendi: `Siralama kapsam olgunlugu` yokken store rankings Playwright testi fail verdi.
- Hedefli frontend dogrulama gecti: `npm.cmd run build; if ($LASTEXITCODE -eq 0) { npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store rankings page renders closed leaderboard and metric mini-ranks" }` -> 1 Playwright test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> root script tests, backend lint/test/build/audit, frontend lint/script/build/24 Playwright/audit.

Debt ledger:

- Closed active debts: 19
- Strategic investment backlog: 4
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: Shared Inbox maturity. Inbox item detaylari, due date, escalation dili ve kaynak aksiyonlari netlestirilmeli.

## Son Shared Inbox Maturity V1

26 Nisan 2026 itibariyla store ve admin inbox satirlarina ortak detay/governance okunurlugu eklendi.

Yeni dokuman:

- `docs/plans/shared-inbox-maturity-v1.md`

Eklenenler:

- `admin-web/src/features/workflow/WorkflowInboxDetail.tsx`
- `/store/tasks` satirlarinda:
  - `Detay ozeti`
  - `Due sinyali`
  - `Escalation`
  - `Kaynak aksiyonu`
- `/admin/inbox` satirlarinda ayni ortak detay dili.
- Source action dili:
  - `target_distribution_request` -> `Karar ekranina git`
  - `checklist_receipt` -> `Checklist receipt ac`
  - `kpi_exception` -> `KPI detayina git`
- Escalation dili mevcut `inboxStatus` + `urgency` alanlarindan turetilir.

Sinir:

- Backend contract degismedi.
- API response degismedi.
- DB schema veya migration yok.
- Yeni workflow state machine yok.
- Gercek persisted due date, SLA transition, notification veya escalation execution yok.

Dogrulama:

- Kirmizi test izlendi: `Detay ozeti` yokken store tasks Playwright testi fail verdi.
- Hedefli frontend dogrulama gecti:
  - `npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store tasks page renders readable Turkish queue labels"` -> 1 Playwright test.
  - `npm.cmd run test:e2e -- e2e/admin-inbox.spec.ts` -> 1 Playwright test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> root script tests, backend lint/test/build/audit, frontend lint/script/build/25 Playwright/audit.

Debt ledger:

- Closed active debts: 21
- Strategic investment backlog: 3
- Silent untracked quality debt in the active gate: 0

Bu adim Store UX TR-First Copy V1 ile kapatildi; store-facing mixed-language/copy puruzleri icin ilk kontrollu pass tamamlandi.

## Son Store UX TR-First Copy V1

26 Nisan 2026 itibariyla store-facing copy icin ilk tutarli TR-first pass eklendi.

Yeni dokuman:

- `docs/plans/store-ux-tr-first-copy-v1.md`

Eklenenler:

- Store shell chrome:
  - `Mağaza alanı`
  - `Mağaza kapsamlı işler için görev odaklı ön izleme.`
  - `Gerçek giriş`
  - `Admin raporları`
  - `Yarışmalar`
- `/store` home preview Turkce-first hale getirildi:
  - sabit duyurular
  - bugunku isler
  - KPI ozetleri
  - prim ozeti
  - rota sahipligi
  - admin siniri
- `/store/tasks` artik Turkce-first kuyruk dili tasir:
  - `Aksiyon gerektiren işler`
  - `Aksiyon bekleyenler`
  - `Yüksek öncelik`
  - `Kuyruk bağlamı`
  - `Bugünün kuyruğu`
  - `İş tipi`
  - `Aksiyon zamanı`
- Workflow detail dili guncellendi:
  - `Detay özeti`
  - `Zaman sinyali`
  - `Yükseltme`
  - `Kaynak aksiyonu`
- `/store/feed` ve store home pinned duyuru preview TR-first etiketlere cekildi.

Sinir:

- Backend contract degismedi.
- API response degismedi.
- DB schema veya migration yok.
- Audit/status/enum kodlari degismedi.
- Score, ranking, competition veya workflow state machine davranisi degismedi.
- Bu tam prod gorsel tasarim pass'i degil; ekranlar hala calisan taslak. Renk, layout, typography, mobil polish ve tam EN/TR localization ileride koordineli ele alinmali.

Dogrulama:

- Kirmizi test izlendi:
  - store shell yeni Turkce heading yokken fail verdi.
  - store tasks yeni Turkce queue heading yokken fail verdi.
- Hedefli frontend dogrulama gecti:
  - `npm.cmd run build`
  - `npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store shell exposes Turkish-first chrome|store tasks page renders readable Turkish queue labels"` -> 2 Playwright test.
  - `npm.cmd run test:e2e -- e2e/feed-surfaces.spec.ts -g "store feed renders pinned challenge posts with ranking link|store home shows pinned feed preview"` -> 2 Playwright test.
  - `npm.cmd run test:e2e -- e2e/admin-inbox.spec.ts` -> 1 Playwright test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> root script tests, backend lint/test/build/audit, frontend lint/script/build/25 Playwright/audit.

Debt ledger:

- Closed active debts: 21
- Strategic investment backlog: 3
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim artik backend/data odagi: real ingest connector ve payload contract intake. UI tarafinda genis redesign bilincli olarak ertelendi; gelecekte UI iyilestirmeleri kucuk, geri alinabilir pilotlarla ilerlemeli.

## Production UI / Design-System Karari

26 Nisan 2026 itibariyla UI stratejisi plan notu olarak kaydedildi.

Yeni dokuman:

- `docs/plans/production-ui-design-system-strategy.md`

Karar:

- Mevcut UI su an calisan taslak olarak kalabilir.
- Product owner UI konusunda heyecanli, ama acelesi yok.
- Geniş visual redesign simdilik oncelik degil.
- UI iyilestirmeleri ileride kucuk pilotlarla yapilmali:
  - begenilmezse kolayca revize edilebilmeli
  - backend contract degistirmemeli
  - release gate korunmali
- Admin shell dense/desktop-first kalmali.
- Store shell mobile-first/task-first kalmali.
- Tam EN/TR localization ve production design-system planli yatirim olarak duruyor.

CODEX DÜRÜST YORUM:

- Bu dogru karar. Su anda en buyuk urun riski renklerin final olmamasi degil; zayif veri kontrati, belirsiz ingest ownership veya auditlenemeyen KPI/config degisiklikleri olur.
- UI ihmal edilmeyecek, ama backend/data temeli guclenirken kontrollu pilotlarla ilerleyecek.

Yeni siradaki mantikli adim:

- Real ingest connector ve payload contract icin feature intake interview.
- Eger gercek external payload detaylari henuz yoksa fallback: KPI config governance implementation planning.

## Son Real Ingest Connector Contract Intake

26 Nisan 2026 itibariyla real ingest connector icin kaynak bilgisizligi netlestirildi.

Yeni dokuman:

- `docs/plans/real-ingest-connector-contract-intake.md`

Guncellenen dokuman:

- `docs/plans/nebim-ingestion-and-normalization-plan.md`

Karar:

- Product owner su anda Nebim tarafindan verinin nasil cekilecegini bilmiyor.
- Bu nedenle Nebim'e ozel connector kodu yazilmayacak.
- Mevcut Nebim cadence/payload notlari vendor-confirmed truth degil, working assumption olarak okunacak.
- Gercek connector ancak sample payload, resmi kolon listesi veya source access modeli gelince yazilacak.
- Simdilik dogru sinir `stg.integration_source`, `stg.import_batch`, `stg.kpi_raw`, `stg.external_id_map`, normalization ve materialization uzerinden source-agnostic ingest contract.

Dis kaynaktan beklenenler:

- delivery type: API, DB view, file, SFTP, manual upload, Power BI export veya intermediary service
- authentication/access modeli
- sanitized sample payload veya resmi field list
- cadence ve late correction davranisi
- store identity key
- personnel/seller identity key
- business date/timezone kurali
- return/refund davranisi

Debt ledger:

- Blocked external dependency sayisi artik 2:
  - Real IdP Staging Evidence
  - Real Nebim / Source Ingest Evidence
- Bu borc yerel kod eksigi degil; dis kaynak kontrati bekleyen kontrollu blokajdir.

CODEX DÜRÜST YORUM:

- Bu adim dogru yerde durduruldu. Payload bilinmeden connector yazmak KPI, ranking ve reporting altina gizli varsayim gomerdi.
- Proje zemin olarak hazir; eksik olan dis kaynak kontrati.
- Siradaki yerel backend adimi, external source bilgisi gelene kadar KPI config governance implementation planning olmali.

## Son KPI Config Versioning V1 Design

26 Nisan 2026 itibariyla KPI config versioning V1 tasarimi onaylandi ve spec olarak yazildi.

Yeni dokuman:

- `docs/superpowers/specs/2026-04-26-kpi-config-versioning-v1-design.md`

Karar:

- Mevcut `ops.kpi_score_profile_config` draft/publish modeli korunacak.
- Yeni `ops.kpi_config_version` tablosu ile her publish immutable version olarak kaydedilecek.
- Yeni snapshot run'lar `rpt.snapshot_run.kpi_config_version_id` ile aktif KPI config version'a baglanacak.
- Eski snapshot'lar `null` version ile `pre_governance` olarak okunacak.
- Yeni `dm` veya global `config` schema acilmayacak.
- Rollback UI, future effective scheduling, approval workflow ve DB-managed interpretation copy V1 disi kalacak.

Ne ise yarar:

- Gecmis raporlar bugunku KPI kuraliyla yanlis yorumlanmaz.
- "Bu skor hangi config ile uretildi?" sorusu cevaplanabilir.
- KPI agirliklari/threshold'lari degistikce guven ve audit korunur.
- Ileride prim, yarisma, bolge ligi ve score interpretation buyurken zemin dagilmaz.

Siradaki mantikli adim:

- Bu spec'e gore implementation plan yazmak.
- Plan onayindan sonra TDD ile migration, backend publish/version metadata, snapshot anchoring ve admin UI metadata adimlarini uygulamak.

## Onemli Dosyalar

Backend auth / scope:

- `backend/nestjs/src/modules/auth/providers/jwt-auth.provider.ts`
- `backend/nestjs/src/modules/auth/decorators/roles.decorator.ts`
- `backend/nestjs/src/modules/auth/decorators/scope.decorator.ts`
- `backend/nestjs/src/modules/auth/auth-authorization.repository.ts`
- `backend/nestjs/src/modules/auth/auth-admin.repository.ts`
- `backend/nestjs/src/modules/auth/auth-admin.service.ts`
- `backend/nestjs/src/modules/auth/web/auth-admin.controller.ts`
- `db/migrations/020_user_action_store_assignments.sql`

Store ops:

- `backend/nestjs/src/modules/store-ops/web/checklist.controller.ts`
- `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
- `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- `backend/nestjs/src/modules/store-ops/application/competition.service.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
- `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage-package.dto.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage-package-plan.dto.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/review-competition-stage-package-plan.dto.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/update-competition-stage-package-plan.dto.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/clone-competition-team-template.dto.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/list-competition-team-templates.query.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/update-competition-team-template.dto.ts`
- `backend/nestjs/src/modules/store-ops/web/target-distribution.controller.ts`
- `backend/nestjs/src/modules/store-ops/application/target-distribution.service.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts`

Frontend:

- `admin-web/src/App.tsx`
- `admin-web/src/features/auth/api.ts`
- `admin-web/src/features/competitions/api.ts`
- `admin-web/src/features/competitions/StageBuilderForm.tsx`
- `admin-web/src/features/competitions/stage-packages.ts`
- `admin-web/src/features/competitions/stage-presets.ts`
- `admin-web/src/pages/AuthDashboardPage.tsx`
- `admin-web/src/pages/CompetitionDashboardPage.tsx`
- `admin-web/src/pages/AuthActionStoreAssignmentAuditPage.tsx`
- `admin-web/src/pages/StoreShellPreviewPage.tsx`
- `admin-web/src/pages/StoreTasksPage.tsx`
- `admin-web/src/pages/StoreFeedPage.tsx`
- `admin-web/src/pages/StoreMyPerformancePage.tsx`
- `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- `admin-web/src/pages/StoreApprovalsPage.tsx`
- `admin-web/src/features/workflow/WorkflowInboxDetail.tsx`

Planlar:

- `docs/plans/position-to-role-matrix.md`
- `docs/plans/kpi-domain-framework.md`
- `docs/plans/kpi-execution-roadmap.md`
- `docs/plans/nebim-ingestion-and-normalization-plan.md`
- `docs/plans/project-gap-analysis-and-roadmap.md`
- `docs/plans/request-intake-and-decision-policy.md`
- `docs/plans/project-stability-guardrails.md`
- `docs/plans/active-next-actions.md`
- `docs/plans/project-forward-preview-2026-04-26.md`
- `docs/plans/ui-localization-strategy.md`
- `docs/plans/daily-closure-ranking-strategy.md`
- `docs/plans/daily-closure-ranking-v2-intake.md`
- `docs/plans/ranking-completeness-segment-readiness-v1.md`
- `docs/plans/shared-inbox-maturity-v1.md`
- `docs/superpowers/plans/2026-04-26-daily-closure-ranking-v2-explainability.md`
- `docs/superpowers/plans/2026-04-25-competition-stage-package-plan-lifecycle-v1.md`
- `docs/superpowers/specs/2026-04-25-competition-stage-package-plan-lifecycle-v1-design.md`
- `docs/superpowers/plans/2026-04-25-competition-stage-package-plan-approval-v1.md`
- `docs/superpowers/specs/2026-04-25-competition-stage-package-plan-approval-v1-design.md`

## Devam Komutu

Yeni pencerede devam etmek icin:

```text
current-state.md oku; aktif proje yolu masaustundeki WEBSİTE ÇALIŞMASI. Eski E:\ yolunu kullanma. readScope/actionScope ayrimini ve assignedStoreIds modelini uygulamaya devam et.
```
