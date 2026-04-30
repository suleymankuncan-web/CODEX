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

## Son KPI Benchmark Scoring V1 Kararlari

29 Nisan 2026 itibariyla KPI skorlamanin referans mantigi urun karari olarak netlesti.

Kararlar:

- Magaza hedef gerceklesme magaza hedefinden puanlanir.
- Magaza `CR`, `ATV`, `UPT` ayni donem Turkiye ortalamasina gore puanlanir.
- Gunluk veri yuklendiyse o gunun Turkiye ortalamasi referans alinir.
- Cok gunluk/aylik veri yuklendiyse ayni tarih araliginin Turkiye ortalamasi referans alinir.
- `ATV`, `UPT`, `CR` gunluk oranlarin duz ortalamasi ile degil, toplam pay/toplam payda formulleriyle hesaplanir.
- Personel hedef gerceklesme magaza muduru tarafindan girilen ve bolge muduru tarafindan onaylanan personel hedefinden puanlanir.
- HR_ADMIN eksik, taslak veya onaysiz personel hedeflerini gorebilmelidir.
- Personel `ATV` ve `UPT` ayni donem Turkiye personel ortalamasina gore puanlanir.
- Checklistler Turkiye ortalamasina gore puanlanmaz; kendi checklist puani skora katkida bulunur.
- V1 cap `120%` olarak kabul edildi.
- Gercek oran her zaman saklanir ve gosterilir; skor katkisi sadece `120%` cap ile sinirlanir.
- Cap ustu degerlerde UI yalnizca `120%` gostermemeli; ornegin `148% performans, skor limiti 120%+` gibi aciklamali gostermelidir.
- Eksik hedef veya eksik benchmark varsa sistem puan uydurmaz; `missing_reference` mantigi ile aciklar.

Referans:

- `docs/superpowers/specs/2026-04-29-kpi-benchmark-scoring-v1-design.md`
- `docs/superpowers/plans/2026-04-29-kpi-benchmark-scoring-v1.md`

## Son Checklist Store Score Integration V1 Kararlari

29 Nisan 2026 itibariyla BM checklist skorunun aylik magaza skoruna etkisi dokumante edildi.

Kararlar:

- Checklist etkisi gunluk skorlara girmeyecek; yalnizca aylik store score icin kullanilacak.
- V1 aylik magaza skoru: KPI performansi `%95`, BM checklist `%5`.
- VM checklist ileride eklendiginde hedef blend: KPI `%90`, BM `%5`, VM `%5`.
- BM checklist yapilmadiysa magaza ceza yemeyecek; KPI skoru normalize sekilde aylik skor olarak kalacak.
- Eksik BM checklist UI'da `bu donem skora dahil edilmedi` gibi aciklanacak.
- Bir ayda birden fazla tamamlanmis BM checklist varsa aylik BM checklist skoru tamamlanan ziyaretlerin aritmetik ortalamasi olacak.
- Draft/in-progress checklistler skora etki etmeyecek.
- Store manager acknowledgement skora dahil olma kosulu degil; region manager `Tamamla` dediginde checklist reporting icin gecerlilik kazanir.
- Checklist score blend agirliklari `HR_ADMIN` / `SUPER_ADMIN` tarafindan konfigurasyonla yonetilmeli ve versioned olmalidir.
- V1'de bolge, magaza tipi veya magaza bazli farkli checklist score agirligi yok.

Referans:

- `docs/superpowers/specs/2026-04-29-checklist-store-score-integration-v1-design.md`

## Son Implementation Plan Sirasi

29 Nisan 2026 itibariyla iki buyuk skor isi icin implementation plan sirasina karar verildi.

Plan sirasi:

1. Checklist Store Score Integration V1
   - Once checklist snapshot aggregation tamamlanmis instance ve `completed_at` uzerinden duzeltilecek.
   - BM checklist aylik store score icine `%5` olarak baglanacak.
   - Missing BM checklist ceza degil `not_included` olacak.
   - Store score breakdown API/UI tarafinda KPI ve BM katkisini aciklayacak.
2. KPI Benchmark Scoring V1
   - Checklist isi release check ile temiz kapandiktan sonra baslayacak.
   - Store/personel KPI metrikleri hedef veya ayni donem Turkiye ortalamasina gore puanlanacak.
   - Gercek oran saklanacak, skor katkisi `%120` cap ile sinirlanacak.
   - Eksik hedef/benchmark puan uydurmayacak; `missing_reference` olarak gorunecek.

Plan dokumanlari:

- `docs/superpowers/plans/2026-04-29-checklist-store-score-integration-v1.md`
- `docs/superpowers/plans/2026-04-29-kpi-benchmark-scoring-v1.md`

## Son Checklist Store Score Integration V1 Implementation

29 Nisan 2026 itibariyla Checklist Store Score Integration V1 uygulandi ve release kapilarindan gecti.

Eklenenler:

- `rpt.generate_store_checklist_snapshot` artik yalnizca `completed` durumundaki ve `completed_at` donem araligina dusen checklist instance'larini aylik snapshot'a alir.
- BM checklist aylik magaza skoruna `%5` agirlikla baglandi.
- BM checklist eksikse magaza ceza yemez; KPI skoru normalize edilerek aylik skor kalir ve BM durumu `not_included` aciklanir.
- VM checklist V1'de `future_inactive` olarak tutulur; aylik skoru dusurmez.
- Backend `GET /api/reports/store-score-breakdown` store manager scope'u icinde KPI, BM ve VM katkisini dondurur.
- Store KPI ekraninda aylik skor kirilimi, BM checklist durumu, katkisi ve V1 siniri kullaniciya aciklanir.

Dogrulama:

- Backend targeted: 5 suite / 16 test.
- Backend build: `npm.cmd run build`.
- Frontend build: `npm.cmd run build`.
- Frontend targeted smoke: `store KPI highlights page explains metric source semantics`.
- Root release gate: `npm.cmd run check:release`.

Bu siradaki adim tamamlandi: `KPI Benchmark Scoring V1` uygulandi ve release kapilarindan gecti.

## Son KPI Benchmark Scoring V1 Implementation

29 Nisan 2026 itibariyla KPI Benchmark Scoring V1 backend ve store-facing UI tarafinda uygulandi.

Eklenenler:

- Pure scoring engine, hedef veya benchmark referansina gore `actualRatio`, `scoredRatio`, `scoreContribution`, `isCapped` ve `missing_reference` sonucunu uretir.
- KPI config defaults artik metric direction, benchmark source ve V1 `%120` cap bilgisini tasir.
- Store `CR`, `ATV`, `UPT` benchmarklari ayni donem Turkiye ortalamasindan hesaplanir; oranlar gunluk duz ortalama degil toplam pay/toplam payda formuludur.
- Personel `ATV` ve `UPT` benchmarklari ayni donem Turkiye personel ortalamasindan hesaplanir.
- Store/personel live reporting artik benchmark degeri, gercek oran, skorlanan oran, cap durumu ve eksik referans nedenini API'da dondurur.
- Employee performance snapshot score artik benchmark scoring engine ile hesaplanir; eksik hedef/benchmark varsa puan uydurmaz.
- `/store/kpis` ve `/store/me` benchmark, `%120+` cap aciklamasi ve `Eksik referans` bilgisini kullaniciya gosterir.

Dogrulama:

- Backend targeted benchmark tests: 4 suite / 17 test.
- Backend build: `npm.cmd run build`.
- Frontend targeted e2e: `kpi-benchmark-explainability.spec.ts` -> 2 test.
- Root release gate: `npm.cmd run check:release` -> 46 root script test, backend lint + 65 suite / 400 test + build + audit, frontend lint + 7 script test + build + 38 Playwright test + audit.

CODEX durust yorum:

- Bu parca skorun guvenilirligini ciddi sekilde artirdi. Sistem artik yuksek/dusuk KPI'yi yalniz sayi olarak degil, hangi referansa gore ve hangi cap ile okudugunu anlatabiliyor.
- En kritik kazanc, eksik hedef veya eksik benchmark durumunda puan uydurmayip bunu acikca `missing_reference` olarak gostermesi.
- Siradaki risk skor motoru degil, hedef referanslarinin operasyonel olarak eksik kalmasi. Target achievement dogru puanlanacaksa hedef giris/onay ve eksik hedef gorunurlugu bir sonraki kontrollu is olmali.

Siradaki mantikli adim: Personel ve magaza hedef referanslarini skor motoruna temiz veri verecek sekilde netlestirmek. Yani hedef giris/onay akisi, HR_ADMIN eksik hedef gorunurlugu ve hedefi olmayan satirlarda `missing_reference` listesini yonetilebilir hale getirmek.

## Son KPI Benchmark Source Policy V1 Karari

29 Nisan 2026 itibariyla Turkiye ortalamasi benchmark kaynagi netlestirildi.

Karar:

- Asil skor benchmarki sistemin aktif kapsam icindeki magaza/personel verisinden hesaplanir.
- PowerBI export icindeki `Turkiye ortalamasi`, `Genel toplam` veya benzeri alt ozet satirlari magaza/personel satiri gibi islenmez.
- Bu ozet satirlar ileride `provided benchmark` kontrol kaniti olarak lineage ile saklanabilir.
- Skorlama default olarak sistemin kendi hesapladigi benchmark ile yapilir.
- PowerBI referansi ile sistem benchmarki farkliysa import ozetinde operator uyarisi verilmelidir.
- Sistem benchmarki hesaplanamiyorsa PowerBI satirina sessiz fallback yapilmaz; skor `missing_reference` kalir.

Neden:

- Garaj, cadir, pop-up veya kapsam disi magazalar aktif kapsamda degilse benchmark hesabina girmemelidir.
- PowerBI satirinin hangi filtrelerle olustugunu sistem garanti edemez.
- Bu karar Excel pilotundan JSON/API kaynagina gecildiginde skor modelinin bozulmadan devam etmesini saglar.

Referans:

- `docs/superpowers/specs/2026-04-29-kpi-benchmark-source-policy-v1-design.md`

## Son Target Reference Control Surface V1 Design

29 Nisan 2026 itibariyla hedef referans kontrol yuzeyi icin tasarim notu yazildi.

Kararlar:

- Mevcut `ops.target_distribution_request` workflow/audit objesi olarak kalacak.
- Skor motorunun okuyacagi hedef, onaylanmis ve query edilebilir target reference katmani olmalidir.
- Magaza hedefi V1'de ayni donem store KPI/import hedefinden gelir; eksik veya sifirsa `missing_reference`.
- Personel hedefi V1'de magaza muduru tarafindan girilir, bolge muduru tarafindan onaylanir ve onaydan sonra skor referansina terfi eder.
- Personel target allocation yalniz `assigneeLabel` ile skorlanmamalidir; skor referansi icin gercek `employeeId` gereklidir.
- HR_ADMIN hedefleri sessizce override etmez; V1'de eksik, pending, stale ve source conflict durumlarini gorebilen readiness/coverage yuzeyine sahip olur.
- Closed snapshotlar kullandigi target reference id/version ile anchor edilmelidir; sonradan gelen duzeltmeler gecmisi sessizce degistirmez.

CODEX durust yorum:

- Hedef talebi ile skor referansini ayirmak kritik. Talep JSON'u workflow icin iyi; scoring icin temiz, onayli ve sorgulanabilir hedef referansi gerekiyor.
- Bu adim gosterisli bir ekran degil ama performans skorunun ileride tartisilmasini engelleyen ana kolonlardan biri.

Referans:

- `docs/superpowers/specs/2026-04-29-target-reference-control-surface-v1-design.md`

## Son Target Reference Control Surface V1 Implementation Plan

29 Nisan 2026 itibariyla hedef referans kontrol yuzeyi icin implementation plani yazildi.

Yeni dokuman:

- `docs/superpowers/plans/2026-04-29-target-reference-control-surface-v1.md`

Plan sirasi:

1. Schema contract red.
2. `ops.personnel_target_reference` migration ve canonical schema alignment.
3. Target allocation payloadlarina gercek `employeeId` zorunlulugu.
4. Region manager approval sonrasi request allocation satirlarini approved target reference satirlarina promote etme.
5. Live personnel `TARGET_ACHIEVEMENT` reporting'in approved target reference okumasini saglama.
6. Closed employee snapshotlarinda `personnel_target_reference_id` anchor'i.
7. HR/Admin target coverage/readiness yuzeyi.
8. Backend/frontend/root release gate ve handoff kapamasi.

CODEX durust yorum:

- Bu plan flashy UI degil, skor guvenilirligi altyapisi. Target request workflow kanit olarak kalir; scoring ise temiz, onayli ve query edilebilir target reference satirlarini okur.
- Siradaki kod adimi schema contract ve migration ile baslamali; VM checklist, bolge benchmark veya JSON adapter bu referans zemini temizlenmeden buyutulmamali.

Bu siradaki adim tamamlandi: `Target Reference Control Surface V1` uygulandi ve release kapilarindan gecti.

## Son Target Reference Control Surface V1 Implementation

29 Nisan 2026 itibariyla Target Reference Control Surface V1 backend, reporting, snapshot ve admin coverage yuzeyiyle uygulandi.

Eklenenler:

- `ops.personnel_target_reference` onaylanmis personel hedeflerini skor motorunun okuyabilecegi canonical referans satiri olarak eklendi.
- Target distribution allocation payloadlari artik gercek `employeeId` ister; `assigneeLabel` yalniz gorunum/kanit olarak kalir.
- Region manager onayi sonrasi allocation satirlari approved monthly personnel target reference satirlarina promote edilir.
- Live personel `TARGET_ACHIEVEMENT` reporting artik approved target reference okur; aylik hedef referansi gunluk/MTD KPI periodlarini kapsayabilir.
- Employee KPI snapshotlari `personnel_target_reference_id` ile anchor edilir; sonradan gelen duzeltmeler gecmisi sessizce degistirmez.
- Eksik hedef varsa sistem hedef uydurmaz; scoring sonucu `personnel_target_missing` / `missing_reference` olarak aciklar.
- Backend `GET /api/target-distributions/coverage` active personel scope'u icin approved/missing hedef kapsamasini dondurur.
- Admin `/admin/targets` yuzeyinde hedef kapsama paneli eklendi; HR/Admin/region tarafinda eksik hedefler gorunur hale geldi.

Dogrulama:

- Backend targeted target-reference tests: repository/service/reporting/snapshot/DTO coverage.
- Frontend targeted e2e: `admin-targets.spec.ts` -> 1 Playwright test.
- Root release gate: `npm.cmd run check:release` -> 46 root script test, backend lint + 68 suite / 412 test + build + audit, frontend lint + 7 script test + build + 40 Playwright test + audit.

CODEX durust yorum:

- Bu is skor sisteminin en kritik tartisma noktasini kapatti: personel hedefi artik talep JSON'undan degil, onayli ve sorgulanabilir referans satirindan okunuyor.
- En buyuk kazanc, gecmis snapshotlarin hangi hedef referansina gore hesaplandiginin izlenebilir hale gelmesi ve eksik hedeflerde sistemin puan uydurmamasi.
- Admin coverage paneli pilot UI seviyesinde; asil degeri operasyonun eksik hedefleri skor bozulmadan once gorebilmesidir.

Bu siradaki adim tamamlandi: `Target Coverage V1-B Readiness Signals` uygulandi.

## Son Target Coverage V1-B Readiness Signals

29 Nisan 2026 itibariyla hedef coverage yuzeyi approved/missing ikilisinden operator-ready durum sinyallerine genisletildi.

Eklenenler:

- Backend `GET /api/target-distributions/coverage` artik active personel icin `approved`, `pending_region_approval`, `pending_change_conflict`, `stale_reference` ve `missing` durumlarini ayirir.
- `pending_region_approval`: aktif personelde onayli hedef yok ama ayni ay/magaza/personel icin bolge onayi bekleyen dagitim talebi var.
- `pending_change_conflict`: onayli hedef var ama ayni ay/magaza/personel icin yeni bekleyen hedef talebi de var; skor hala onayli referansi okur.
- `stale_reference`: personelin ayni ay onayli hedefi baska magazada kalmis; mevcut aktif magaza hedefsiz gorunur.
- Summary artik covered, uncovered, missing, pending, conflict ve stale sayaclarini birlikte dondurur.
- Admin `/admin/targets` paneli bu sinyalleri ayri kart/satir olarak gosterir; skor motoruna veya approved-reference okuma kuralina dokunulmadi.

Dogrulama:

- Backend targeted target-distribution repository/service tests: 2 suite / 6 test.
- Backend build: `npm.cmd run build`.
- Frontend build: `npm.cmd run build`.
- Frontend lint: `npm.cmd run lint`.
- Frontend targeted e2e: `admin-targets.spec.ts` -> 1 Playwright test.
- Root release gate: `npm.cmd run check:release` -> 46 root script test, backend lint + 68 suite / 413 test + build + audit, frontend lint + 7 script test + build + 40 Playwright test + audit.

CODEX durust yorum:

- Bu adim kucuk gorunur ama kontrol kaybini engeller. Artik eksik hedef, onay bekleyen hedef, degisiklik cakismasi ve yanlis magazada kalmis hedef ayni "missing" torbasina dusmuyor.
- En onemli sinir dogru korundu: skor sadece onayli referansi okuyor; pending/stale/conflict operator sinyali olarak kaliyor.

Siradaki mantikli adim: master data baseline gelirse Personnel Master Data Bootstrap V1'i staging/review/promote modeliyle baslatmak; gelmezse yeni adapter yazmadan mevcut import/target yuzeylerinde sadece gercek operator ihtiyaci olan kucuk guard'lari secmek.

Bu siradaki adim baslatildi: `Personnel Master Data Bootstrap V1-A/B` staging foundation ve batch staging API uygulandi.

## Son Personnel Master Data Bootstrap V1-A/B

29 Nisan 2026 itibariyla master data icin dogrudan Excel-to-live-table yerine kontrollu bootstrap zemini eklendi.

Eklenenler:

- `stg.master_data_bootstrap_batch` ve `stg.master_data_bootstrap_row` canonical staging tablolari eklendi.
- Yeni migration: `db/migrations/040_master_data_bootstrap_foundation.sql`.
- Batch/row tablolari ham payload, normalize payload, row hash, review durumu, resolved store/employee/position referanslari ve gelecekteki promote kanitini tutar.
- Backend `POST /api/integrations/master-data-bootstrap/batches` endpoint'i eklendi.
- Yetki: `HR_ADMIN`, `SUPER_ADMIN`, `INTEGRATION_ADMIN`.
- Endpoint satirlari staging'e alir, store kodunu `SM-140` -> `SM140` gibi normalize eder, seller code'u trim/uppercase yapar ve SHA-256 row hash uretir.
- Bu adim bilincli olarak `ops.store`, `ops.employee` veya `ops.employee_assignment_history` tablolarina veri yazmaz.

Dogrulama:

- Schema contract red/green: `master-data-bootstrap-schema-contract.spec.ts` -> 1 suite / 1 test.
- Backend targeted staging tests: service + repository -> 2 suite / 2 test.
- Root release gate: `npm.cmd run check:release` -> 46 root script test, backend lint + 71 suite / 416 test + build + audit, frontend lint + 7 script test + build + 40 Playwright test + audit.

CODEX durust yorum:

- Bu, master data icin dogru ilk kolon. Artik "dosyayi yukledim, sistem canli tabloya basti" gibi tehlikeli bir yol acilmiyor.
- Henuz full bootstrap bitmedi; siradaki teknik borc validation/read model ve sonra promote akisi. Ama en kritik sinir, yani staging ile live arasindaki kapı, artik schema ve API seviyesinde ayrildi.

Siradaki mantikli adim: V1-C validation read model. Batch satirlari eksik store code, bilinmeyen store type, bilinmeyen position ve duplicate row durumlarina gore `valid`, `needs_review`, `invalid` olarak siniflandirilmeli; promote hala kapali kalmali.

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
  - Real JSON Source Ingest Evidence
- Bu borc yerel kod eksigi degil; dis kaynak kontrati bekleyen kontrollu blokajdir.

CODEX DÜRÜST YORUM:

- Bu adim dogru yerde durduruldu. Payload bilinmeden connector yazmak KPI, ranking ve reporting altina gizli varsayim gomerdi.
- Proje zemin olarak hazir; eksik olan dis kaynak kontrati.
- Siradaki yerel backend adimi artik external source bilgisi gelene kadar source-agnostic ingest contract hardening gibi kontrollu bir adim olarak secilmeli; source-specific connector hala gercek payload bekler.

## Son KPI Config Versioning V1 Design

26 Nisan 2026 itibariyla KPI config versioning V1 tasarimi onaylandi ve spec olarak yazildi.

Yeni dokuman:

- `docs/superpowers/specs/2026-04-26-kpi-config-versioning-v1-design.md`
- `docs/superpowers/plans/2026-04-26-kpi-config-versioning-v1.md`

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

Durum:

- Tasarim uygulandi; asagidaki `Son KPI Config Versioning V1` bolumu kanonik implementation sonucudur.

## Son KPI Config Versioning V1

26 Nisan 2026 itibariyla KPI Config Versioning V1 uygulandi.

Eklenenler:

- `ops.kpi_config_version` immutable published KPI config version history tutar.
- `rpt.snapshot_run.kpi_config_version_id` yeni snapshot run'lari aktif KPI config version'a baglar.
- KPI config publish akisi her publish icin yeni immutable version row olusturur.
- Config API response'lari additive version metadata tasir.
- Daily snapshot execution, version varsa anchored config payload icindeki personnel profile'i kullanir.
- Failed snapshot rerun akisi parent snapshot'in KPI config version'ini korur.
- Legacy/null-version snapshot'lar `pre_governance` olarak okunur.
- `/admin/kpi-config` latest published version, published time ve rollback V1 sinirini gosterir.
- `/admin/reports/snapshot-runs` ve snapshot detail yuzeyi version/pre-governance context gosterir.

Sinir:

- Yeni `dm` veya global `config` schema acilmadi.
- Rollback UI, future effective scheduling, approval workflow ve DB-managed interpretation copy V1 disi kaldi.
- Score formulu degismedi.
- Eski snapshot'lar geriye donuk bozulmadi; null version bilincli olarak pre-governance anlamina gelir.

Dogrulama:

- Kirmizi backend test izlendi: snapshot create/rerun henuz `kpiConfigVersionId` tasimazken fail verdi.
- Kirmizi frontend test izlendi: admin KPI config ve snapshot runs yuzeyleri version metadata gostermedigi icin fail verdi.
- Hedefli backend test gecti: `npm.cmd test -- src/modules/store-ops/application/snapshot.service.spec.ts src/modules/store-ops/application/reporting.service.kpi-config-versioning.spec.ts src/modules/store-ops/kpi-config-versioning-schema-contract.spec.ts --runInBand` -> 3 suite / 9 test.
- Backend build gecti: `npm.cmd run build`.
- Frontend build gecti: `npm.cmd run build`.
- Hedefli frontend e2e gecti: `npx.cmd playwright test e2e/kpi-config-versioning.spec.ts e2e/admin-kpi-config.spec.ts` -> 3 Playwright test.
- Frontend lint gecti: `npm.cmd run lint`.
- Resmi root release gate gecti: `npm.cmd run check:release` -> root script tests, backend lint + 34 suite / 255 test + build + audit, frontend lint + 7 script test + build + 27 Playwright test + audit.

Debt ledger:

- Closed active debts: 23
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 1
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: staging IdP veya JSON source bilgisi yoksa yeni is, feature intake ile secilecek kontrollu local backend/data adimi olmali; source-specific connector icin hala gercek payload beklenmeli.

## Son Source-Agnostic Ingest Contract Hardening V1

26 Nisan 2026 itibariyla source-specific connector yazmadan KPI ingest kontrati guclendirildi.

Yeni dokuman:

- `docs/plans/source-agnostic-ingest-contract-hardening-v1.md`

Eklenenler:

- KPI normalization artik canonical KPI satirlarina deterministic `rowHash` ekler.
- KPI normalization artik readable `rawRowReference` ekler.
- `rowHash` stable source row payload uzerinden uretilir; ayni satir farkli key sirasi ile gelse ayni hash'i verir.
- Metric-column normalization artik `TICKET_COUNT` ve `ITEM_COUNT` metriklerini de tanir.
- `GET /api/integrations/import-payload-templates` artik `canonicalContract` metadata'si dondurur.
- Contract metadata:
  - import batch envelope fields
  - canonical KPI row fields
  - imported metric codes
  - derived metric codes
  - checklist metric codes
  - adapter/scoring boundary rules

Sinir:

- Nebim-specific connector yazilmadi.
- Fake API client yazilmadi.
- Source cadence varsayilmadi.
- Score formulu degismedi.
- DB schema degismedi.
- Snapshot veya ranking davranisi degismedi.

Dogrulama:

- Kirmizi backend test izlendi: KPI normalization `rowHash` / `rawRowReference` uretmedigi icin fail verdi.
- Kirmizi backend test izlendi: payload template endpoint `canonicalContract` dondurmedigi icin fail verdi.
- Hedefli backend test gecti: `npm.cmd test -- src/modules/integration/application/kpi-import-normalization.service.spec.ts src/modules/integration/application/materialization.service.spec.ts src/modules/integration/application/power-bi-export-upload.service.spec.ts test/integration/import-batch.e2e-spec.ts --runInBand` -> 4 suite / 45 test.
- Backend lint gecti: `npm.cmd run lint`.
- Backend build gecti: `npm.cmd run build`.
- Resmi root release gate gecti: `npm.cmd run check:release` -> root script tests, backend lint + 34 suite / 257 test + build + audit, frontend lint + 7 script test + build + 27 Playwright test + audit.

Debt ledger:

- Closed active debts: 23
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 1
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: gercek kaynak bilgisi gelirse source mapping spec'e donmek; gelmezse mevcut backend/data yuzeylerinden dis kaynak varsayimi gerektirmeyen bir sonraki kontrollu adimi secmek.

## Son KPI Raw Row Lineage Persistence V1

26 Nisan 2026 itibariyla source-agnostic KPI satir izi `payload_json` icinde kalmakla yetinmeyip `stg.kpi_raw` seviyesinde first-class kolonlara tasindi.

Yeni dokuman:

- `docs/plans/kpi-raw-row-lineage-persistence-v1.md`

Eklenenler:

- `db/migrations/027_kpi_raw_lineage_columns.sql`.
- `stg.kpi_raw.row_hash`.
- `stg.kpi_raw.raw_row_reference`.
- `kpi_raw_row_hash_idx`.
- `kpi_raw_reference_idx`.
- Canonical `db/schema.sql` bu kolon ve indexlerle hizalandi.
- KPI import staging insert artik `rowHash` ve `rawRowReference` degerlerini raw kolonlara yazar.
- Schema contract testi migration/schema kolonlarini korur.
- Import batch integration testi KPI raw lineage kolonlarinin insert edildigini dogrular.

Sinir:

- Nebim-specific connector yazilmadi.
- Fake source adapter yazilmadi.
- Source cadence varsayilmadi.
- Score formulu degismedi.
- Materialization, snapshot veya ranking davranisi degismedi.

Dogrulama:

- Kirmizi backend test izlendi: canonical schema/migration icinde KPI raw lineage kolonlari yokken schema contract fail verdi.
- Kirmizi backend test izlendi: KPI import staging insert `row_hash` ve `raw_row_reference` yazmadigi icin integration test fail verdi.
- Hedefli backend test gecti: `npm.cmd test -- src/modules/integration/source-agnostic-ingest-schema-contract.spec.ts src/modules/integration/application/kpi-import-normalization.service.spec.ts test/integration/import-batch.e2e-spec.ts --runInBand` -> 3 suite / 32 test.
- Backend build gecti: `npm.cmd run build`.
- Resmi root release gate gecti: `npm.cmd run check:release` -> root script tests, backend lint + 35 suite / 259 test + build + audit, frontend lint + 7 script test + build + 27 Playwright test + audit.

Debt ledger:

- Closed active debts: 24
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 1
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: external source bilgisi gelirse source mapping spec'e donmek; gelmezse intake ile mevcut backend/data yuzeylerinden dis kaynak varsayimi gerektirmeyen bir sonraki kontrollu adimi secmek.

## Son Import Lineage Evidence Surface V1

26 Nisan 2026 itibariyla KPI raw row lineage bilgisi admin import detay yuzeyinde operator tarafindan gorulebilir hale getirildi.

Yeni dokuman:

- `docs/plans/import-lineage-evidence-surface-v1.md`

Eklenenler:

- `GET /api/integrations/import-batches/:batchId` artik `lineageSummary` dondurur.
- KPI batch detail icinde lineage destegi, row hash sayisi, raw row reference sayisi, sample row hash ve sample raw row reference gorunur.
- `GET /api/integrations/import-batches/:batchId/errors` KPI hata satirlari icin varsa `rowHash` ve `rawRowReference` dondurur.
- `/admin/integrations/:batchId` icinde `Source row lineage` paneli eklendi.
- KPI error row satirlari raw reference ve row hash bilgisini gosterir.
- Uzun hash/reference degerleri UI'da wrap olur.

Sinir:

- Nebim-specific connector yazilmadi.
- Fake adapter yazilmadi.
- Source cadence varsayilmadi.
- Score formulu degismedi.
- Materialization, snapshot, ranking veya external source davranisi degismedi.
- Non-KPI importlar icin sahte lineage uretilmedi.

Dogrulama:

- Kirmizi backend test izlendi: batch detail `lineageSummary` dondurmedigi icin fail verdi.
- Kirmizi backend test izlendi: KPI error row `rowHash` / `rawRowReference` dondurmedigi icin fail verdi.
- Kirmizi frontend test izlendi: admin import detail `Source row lineage` panelini gostermedigi icin fail verdi.
- Hedefli backend test gecti: `npm.cmd test -- test/integration/import-batch.e2e-spec.ts --runInBand -t "lineage"` -> 3 test.
- Hedefli frontend test gecti: `npm.cmd run build; if ($LASTEXITCODE -eq 0) { npx.cmd playwright test e2e/integration-surfaces.spec.ts }` -> 1 Playwright test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> root script tests, backend lint + 35 suite / 261 test + build + audit, frontend lint + 7 script test + build + 28 Playwright test + audit.

Debt ledger:

- Closed active debts: 25
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 1
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: external source bilgisi gelirse source mapping spec'e donmek; gelmezse intake ile mevcut backend/data yuzeylerinden dis kaynak varsayimi gerektirmeyen bir sonraki kontrollu adimi secmek.

## Son Audit Event Taxonomy Guard V1

26 Nisan 2026 itibariyla global audit feed watchlist'i yeni feed UI/API acmadan kontrollu sekilde kapatildi.

Yeni dokuman:

- `docs/plans/audit-event-taxonomy-guard-v1.md`

Eklenenler:

- `backend/nestjs/src/shared/audit/audit-event-catalog.ts`.
- `backend/nestjs/src/shared/audit/audit-event-catalog.spec.ts`.
- Backend audit event katalogu event type, entity name, owner module, audit stream readiness ve kisa aciklama tasir.
- Kontrat testi backend module source icindeki audit event literal'larini tarar ve katalogda olmayan audit event gorurse fail verir.
- Kontrat testi event type naming, entity naming, owner metadata, readiness metadata, duplicate event ve lookup davranisini korur.

Karar:

- Global audit feed endpoint/UI simdilik acilmadi.
- Mevcut feature-level audit endpointleri yeterli kabul edildi.
- Ileride HR/Admin gercek cross-module incident/support timeline isterse global feed bu katalog uzerinden tasarlanacak.

Sinir:

- DB schema veya migration yok.
- Existing audit event isimleri rename edilmedi.
- Mevcut audit endpoint contract'lari degismedi.
- Structured log-only eventler audit event sayilmadi.

Dogrulama:

- Kirmizi backend test izlendi: `audit-event-catalog.spec.ts` `./audit-event-catalog` olmadigi icin fail verdi.
- Hedefli backend test gecti: `npm.cmd test -- src/shared/audit/audit-event-catalog.spec.ts --runInBand` -> 1 suite / 3 test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> root script tests, backend lint + 36 suite / 264 test + build + audit, frontend lint + 7 script test + build + 28 Playwright test + audit.

Debt ledger:

- Closed active debts: 26
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 0
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: staging/provider degerleri veya source payload bilgisi gelirse evidence adimina donmek; gelmezse intake ile dis kaynak varsayimi gerektirmeyen kucuk backend/data guard secmek.

## Son Data Quality Guard V1

26 Nisan 2026 itibariyla import hata satirlari icin source-agnostic data quality guard eklendi.

Yeni dokuman:

- `docs/plans/data-quality-guard-v1.md`

Eklenenler:

- `backend/nestjs/src/modules/integration/application/import-data-quality.ts`.
- `backend/nestjs/src/modules/integration/application/import-data-quality.spec.ts`.
- Backend import data quality katalogu issue code, owner, severity, label ve aciklama tasir.
- Import batch error response artik additive `qualityIssueCode` dondurur.
- Mevcut `errorCategory` alani korunur.
- `GET /api/integrations/import-payload-templates` canonical KPI contract icinde `dataQualityIssueCodes` dondurur.
- Frontend integration API tipleri additive contract alanlariyla hizalandi.

Ilk kalite kodlari:

- `missing_identity`
- `unmapped_store`
- `unmapped_employee`
- `unmapped_position`
- `unmapped_region`
- `unmapped_company`
- `invalid_metric`
- `duplicate_source_row`
- `late_correction_candidate`
- `schema_mismatch`
- `system_write_failure`
- `unknown_quality_issue`

Sinir:

- Nebim-specific connector yazilmadi.
- Source API/file/SFTP payload varsayimi eklenmedi.
- DB schema veya migration yok.
- Score, ranking, snapshot veya materialization davranisi degismedi.
- Yeni admin UI yuzeyi acilmadi.

Dogrulama:

- Kirmizi backend test izlendi: data quality katalog module'u yokken fail verdi.
- Kirmizi backend test izlendi: canonical KPI contract `dataQualityIssueCodes` dondurmedigi icin fail verdi.
- Kirmizi backend test izlendi: import batch error rows `qualityIssueCode` dondurmedigi icin fail verdi.
- Hedefli backend test gecti: `npm.cmd test -- src/modules/integration/application/import-data-quality.spec.ts test/integration/import-batch.e2e-spec.ts --runInBand -t "data quality|source-agnostic canonical KPI payload contract template|returns import batch error rows|returns KPI import batch error row lineage"` -> 2 suite / 13 test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> 9 root Node test, backend lint + 37 suite / 274 test + build + audit, frontend lint + 7 script test + build + 28 Playwright test + audit.

Debt ledger:

- Closed active debts: 27
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 0
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: staging/provider degerleri veya source payload bilgisi gelirse evidence/spec adimina donmek; gelmezse dis kaynak varsayimi gerektirmeyen kucuk backend/data guard secmek.

## Son Import Batch Quality Summary V1

26 Nisan 2026 itibariyla import data quality kodlari batch detay seviyesinde ozetlenir hale getirildi.

Yeni dokuman:

- `docs/plans/import-batch-quality-summary-v1.md`

Eklenenler:

- `GET /api/integrations/import-batches/:batchId` artik additive `qualityIssueSummary` dondurur.
- Summary failed row'lari stable data quality issue code'a gore gruplar.
- Summary item alanlari: `code`, `label`, `owner`, `severity`, `description`, `count`.
- Summary toplam alanlari: `totalIssueRows`, `highSeverityRows`.
- `/admin/integrations/:batchId` icinde `Data quality summary` paneli eklendi.
- Error-row CSV export artik `qualityIssueCode` kolonunu tasir.
- Error-row kartlari varsa row-level quality issue code'u gosterir.

Sinir:

- DB schema veya migration yok.
- Nebim-specific connector davranisi yok.
- Source payload/cadence varsayimi yok.
- Score, ranking, snapshot veya materialization davranisi degismedi.
- Retry karar mantigi degismedi.
- Yeni global data quality dashboard acilmadi.

Dogrulama:

- Kirmizi backend test izlendi: batch detail response `qualityIssueSummary` dondurmedigi icin fail verdi.
- Kirmizi frontend test izlendi: import detail page `Data quality summary` panelini gostermedigi icin fail verdi.
- Hedefli backend test gecti: `npm.cmd test -- test/integration/import-batch.e2e-spec.ts --runInBand -t "returns import batch detail with row status summary|returns KPI import batch lineage summary|returns import batch error rows|returns KPI import batch error row lineage"` -> 1 suite / 4 test.
- Hedefli frontend test gecti: `npx.cmd playwright test e2e/integration-surfaces.spec.ts` -> 1 Playwright test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> 9 root Node test, backend lint + 37 suite / 274 test + build + audit, frontend lint + 7 script test + build + 28 Playwright test + audit.

Debt ledger:

- Closed active debts: 28
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 0
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: staging/provider degerleri veya source payload bilgisi gelirse evidence/spec adimina donmek; gelmezse import/data yuzeyinde yeni varsayim uretmeyen en kucuk guard'i secmek.

## Son Project-Wide Scope/Auth Guard Scan V1

27 Nisan 2026 itibariyla proje geneli kontrol scan'i yapildi ve iki somut backend riski testle kapatildi.

Yeni dokuman:

- `docs/plans/project-wide-scan-2026-04-27.md`

Scan kapsami:

- root scriptleri ve official release gate
- backend auth/scope/config/repository yuzeyleri
- frontend unsafe DOM ve browser storage kullanimlari
- secret hygiene, `.gitignore`, package scriptleri ve audit kapilari
- dokumanlar ve handoff dosyalari

Bulgu ozeti:

- Tracked `.env` bulunmadi.
- Kritik committed secret bulunmadi.
- Frontend icinde `dangerouslySetInnerHTML`, `eval`, `new Function` veya direkt `document.cookie` kullanimi bulunmadi.
- Backend global auth/role/scope guardlari ve validation pipe yapisi yerinde.

Kapatilan riskler:

- Production ortaminda `JWT_JWKS_URL` yoksa ve `JWT_SECRET` eksik/default `change-me` ise artik fail-fast calisir.
- Store listing actor scope'u once uygular; requested company/region/store filtreleri sadece ek kisit olur.
- Target-distribution request listing empty actor scope icin `WHERE FALSE` uygular ve narrowest scope onceligini kullanir.

Eklenen / degisen dosyalar:

- `backend/nestjs/src/shared/app-config.service.ts`
- `backend/nestjs/src/shared/app-config.service.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`
- `docs/plans/project-wide-scan-2026-04-27.md`
- `docs/plans/project-debt-ledger.md`
- `docs/plans/active-next-actions.md`

Dogrulama:

- Hedefli backend testler kirmizi/yesil ilerletildi.
- Hedefli backend testler gecti: 3 suite / 7 test.
- Backend release gecti: lint, 40 suite / 281 test, build, `npm audit --omit=dev`.
- Official root release gecti: root 9 script test, backend lint + 40 suite / 281 test + build + audit, frontend lint + 7 script test + build + 28 Playwright test + audit.

Debt ledger:

- Closed active debts: 29
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 0
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: scan/fix commit'ini kapatmak. Sonraki yerel teknik aday, dis kaynak varsayimi gerektirmeyen "no-empty-scope repository contract pass" olmali.

## Son No-Empty-Scope Repository Contract Pass V1

27 Nisan 2026 itibariyla actor read scope'u bos olan kullanicilarin store/region/company operasyonel listelerde veri gorememesi icin repository seviyesinde fail-closed kontrat genisletildi.

Yeni dokuman:

- `docs/plans/no-empty-scope-repository-contract-pass-2026-04-27.md`

Kapatilan yuzeyler:

- Reporting:
  - workforce report
  - KPI report
  - checklist report
  - turnover report
  - employee KPI latest period lookup
  - employee KPI period list
  - external employee reference resolution
- Checklist acknowledgement:
  - completed checklist acknowledgement list
- Competition:
  - competition list
  - competition detail
  - store contribution rows
  - warning rows
- Operational Feed:
  - visible feed list

Yeni davranis:

- Bos company/region/store scope icin listeler `[]` dondurur.
- Bos scope icin paged report metodlari `{ rows: [], total: 0 }` dondurur.
- Bos scope icin single lookup metodlari `null` dondurur.
- Bos scope branch'lerinde DB query atilmaz.
- Competition company-scope okumalari artik `store.company_id` uzerinden filtrelenir; herhangi bir company scope global bypass gibi davranmaz.
- Feed company postlari scope'u olan kullanicilara gorunmeye devam eder, ama company visibility tum region/store postlarini acan bir `OR` gibi davranmaz.

Degisen / eklenen dosyalar:

- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/checklist-acknowledgement.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/checklist-acknowledgement.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.spec.ts`
- `docs/plans/no-empty-scope-repository-contract-pass-2026-04-27.md`
- `docs/plans/project-debt-ledger.md`
- `docs/plans/active-next-actions.md`

Dogrulama:

- Kirmizi test izlendi: reporting/checklist/competition/feed empty-scope testleri eski davranista fail verdi.
- Hedefli backend test gecti: 4 suite / 43 test.
- Backend release gecti: lint, 41 suite / 288 test, build, `npm audit --omit=dev`.

Debt ledger:

- Closed active debts: 30
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 0
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim tamamlandi: Production Environment Readiness Checklist V1.

## Son Production Environment Readiness Checklist V1

27 Nisan 2026 itibariyla production/staging hazirlik kapisi tek operator checklist'i olarak dokumante edildi ve root script testiyle korumaya alindi.

Yeni dokuman:

- `docs/plans/production-environment-readiness-checklist.md`

Yeni kontrat testi:

- `scripts/production-readiness-checklist-contract.test.mjs`

Kapsam:

- environment ve secret kontrolu
- real IdP registration ve PKCE smoke kontrolu
- database migration order ve backup kontrolu
- audit retention ve restore drill sahipligi
- sanitized smoke evidence kurallari
- Go / Conditional Go / No-Go kararlari
- JSON source readiness holding area

Karar:

- Nebim-specific varsayim artik ilerletilmiyor.
- Kaynak tarafinda beklenen sey, gercek JSON sample payload veya resmi alan listesi.
- Source-specific adapter, JSON payload kaniti gelene kadar blocked_external olarak kalir.
- Checklist runtime davranisi, DB schema, auth flow, skor hesaplama veya import adapter kodu degistirmez.

Dogrulama:

- Kirmizi root script testi izlendi: checklist dokumani yokken `npm.cmd run test:scripts` fail verdi.
- Hedefli root script testi gecti: `npm.cmd run test:scripts` -> 13 Node test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> 13 root Node test, backend lint + 41 suite / 288 test + build + audit, frontend lint + 7 script test + build + 28 Playwright test + audit.

Debt ledger:

- Closed active debts: 31
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 0
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim tamamlandi: Environment Variable Inventory + Deployment Runbook Skeleton V1.

## Son Environment Variable Inventory + Deployment Runbook Skeleton V1

27 Nisan 2026 itibariyla production readiness checklist'in altindaki env ve deploy isletim akisi somut dokumanlara ayrildi ve root script testiyle korumaya alindi.

Yeni dokumanlar:

- `docs/plans/environment-variable-inventory.md`
- `docs/plans/deployment-runbook-skeleton.md`

Yeni kontrat testi:

- `scripts/deployment-runbook-contract.test.mjs`

Ek hizalama:

- `backend/nestjs/.env.example` artik `ALLOW_MOCK_AUTH`, `JWT_JWKS_URL`, `DAILY_CLOSURE_AUTOMATION_ENABLED`, `DAILY_CLOSURE_POLL_MINUTES` ve `DAILY_CLOSURE_ACTOR_USER_ID` degerlerini gosterir.
- `admin-web/.env.example` artik PKCE icin `VITE_OIDC_RESPONSE_TYPE=code` kullanir ve `VITE_OIDC_TOKEN_URL` alanini gosterir.

Kapsam:

- backend runtime env inventory
- frontend build-time env inventory
- auth smoke evidence env inventory
- secret handling kurallari
- deployment preflight
- release gate
- database migration sirasi
- backend/frontend deploy sirasi
- staging auth smoke evidence
- rollback ve sign-off kaydi

Karar:

- Bu adim runtime davranisi, DB schema, source adapter, score math veya auth flow degistirmez.
- Real environment komutlari hedef hosting/IdP secilmeden doldurulmayacak.
- JSON source adapter hala gercek JSON sample payload veya resmi alan listesi bekler.

Dogrulama:

- Kirmizi root script testi izlendi: env inventory dokumani yokken `npm.cmd run test:scripts` fail verdi.
- Hedefli root script testi gecti: `npm.cmd run test:scripts` -> 19 Node test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> 19 root Node test, backend lint + 41 suite / 288 test + build + audit, frontend lint + 7 script test + build + 28 Playwright test + audit.

Debt ledger:

- Closed active debts: 32
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 0
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim tamamlandi: Environment Drift Guard V1.

## Son Environment Drift Guard V1

27 Nisan 2026 itibariyla env inventory ve `.env.example` dosyalarinin koddan sessizce kopmamasi icin dinamik root script guard eklendi.

Degisenler:

- `scripts/deployment-runbook-contract.test.mjs` artik backend env isimlerini `AppConfigService` uzerinden cikarir.
- Ayni test frontend env isimlerini `admin-web/src` altindaki `import.meta.env` kullanimlarindan cikarir.
- Ayni test auth smoke env isimlerini `admin-web/scripts/auth-live-smoke.mjs` icindeki `AUTH_SMOKE_*` kullanimlarindan cikarir.
- Backend/frontend env isimleri hem ilgili `.env.example` dosyasinda hem de `docs/plans/environment-variable-inventory.md` icinde olmak zorundadir.
- Auth smoke env isimleri `docs/plans/environment-variable-inventory.md` icinde olmak zorundadir.
- `docs/plans/environment-variable-inventory.md` icine `Drift Guard` bakim sozlesmesi eklendi.

Karar:

- Bu adim runtime davranisi, DB schema, source adapter, score math veya auth flow degistirmez.
- Yeni env eklenirse dokuman ve example hizasi root `test:scripts` kapisinda zorunlu hale gelir.

Dogrulama:

- Kirmizi root script testi izlendi: `Drift Guard` dokuman bolumu yokken `npm.cmd run test:scripts` fail verdi.
- Hedefli root script testi gecti: `npm.cmd run test:scripts` -> 23 Node test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> 23 root Node test, backend lint + 41 suite / 288 test + build + audit, frontend lint + 7 script test + build + 28 Playwright test + audit.

Debt ledger:

- Closed active debts: 33
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 0
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim tamamlandi: Production/Staging Incident Response Skeleton V1.

## Son Production/Staging Incident Response Skeleton V1

27 Nisan 2026 itibariyla staging/production baskisi altinda auth, import/data quality ve deploy/release hatalarinda dogaclama yapmamak icin incident response skeleton baglandi.

Yeni dokuman:

- `docs/plans/production-staging-incident-response-skeleton.md`

Yeni kontrat testi:

- `scripts/incident-response-skeleton-contract.test.mjs`

Kapsam:

- incident severity: P0/P1/P2
- incident lead, release operator, backend/frontend/data owner ve business approver sorumluluklari
- triage flow
- auth incident playbook
- import and data quality incident playbook
- deploy and release incident playbook
- sanitized evidence rules
- incident note template
- post-incident review

Baglantilar:

- `docs/plans/deployment-runbook-skeleton.md` rollback bolumu incident skeleton'a baglandi.
- `docs/plans/production-environment-readiness-checklist.md` reference listesine incident skeleton eklendi.

Karar:

- Bu adim runtime davranisi, DB schema, source adapter, score math, auth flow veya UI davranisi degistirmez.
- Incident aninda JSON source-specific adapter uretilmez; real JSON sample payload ve source mapping spec beklenir.
- Olayin sonucu tek karara baglanir: Rollback / Forward-fix / No-Go.

Dogrulama:

- Kirmizi root script testi izlendi: incident skeleton dokumani yokken `npm.cmd run test:scripts` fail verdi.
- Hedefli root script testi gecti: `npm.cmd run test:scripts` -> 28 Node test.
- Resmi root release gate gecti: `npm.cmd run check:release` -> 28 root Node test, backend lint + 41 suite / 288 test + build + audit, frontend lint + 7 script test + build + 28 Playwright test + audit.

Debt ledger:

- Closed active debts: 36
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 0
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Siradaki mantikli adim: JSON sample payload gelirse source mapping spec'e gecmek; staging/hosting bilgileri gelirse runbook'u target-specific fill-in note'a cevirmek. Hicbiri yoksa sanitized release/smoke/incident evidence index skeleton dusunulebilir, ama yeni paperwork acmadan once gercek ihtiyac var mi diye kontrol edilmeli.

## Son Personnel Management V1

27 Nisan 2026 itibariyla personel master-data yasam dongusunun ilk kontrollu V1 zemini tamamlandi ve dokumante edildi.

Yeni dokuman:

- `docs/plans/personnel-management-v1.md`

Kapsam:

- Store manager satici kodu / yeni personel talebi acar.
- HR/Admin onay ekraninda resmi satici kodunu girer.
- Onay `ops.employee` ve aktif `ops.employee_assignment_history` olusturur.
- Store manager aktif personel icin cikis/offboarding talebi acar.
- HR/Admin offboarding talebini onaylar.
- Onay `ops.employee.employment_status = terminated`, `termination_date`, assignment `end_date`, assignment `inactive` ve `ops.turnover_event` kaydini olusturur.
- HR/Admin satici kodu ve offboarding taleplerini zorunlu not ile iade edebilir.
- Store manager iade edilen talebi `/store/approvals` uzerinden forma yukleyip ayni request id ile tekrar gonderebilir.
- Resubmit talebi tekrar `pending_hr_approval` durumuna alir.

Guvenlik ve sahiplik kurallari:

- Store manager resmi satici kodu veya resmi employee status alanini direkt mutate etmez.
- Store manager sadece `actionScope.assignedStoreIds` icindeki magazalar icin talep acar.
- HR/Admin resmi karar noktasi olarak kalir.
- TC tam hali response'a geri donmez; sistem hash ve son 4 hane yaklasimini kullanir.
- Request tablolari workflow/evidence kaydidir; canli personel kaydi `ops.employee` ve assignment history uzerindedir.
- Return/resubmit employee, assignment veya turnover kaydi mutate etmez.
- Seller-code resubmit tam TC bilgisini yeniden ister; tam TC sistemden geri dondurulmez.

V1 disi:

- store transfer akisi
- bulk personel operasyonlari
- external HR/source sync
- belge yukleme ve bordro sureci

Dogrulama:

- Backend targeted offboarding testi gecti: `test/integration/workforce-offboarding.e2e-spec.ts` -> 5 test.
- Seller-code targeted testi gecti: `test/integration/workforce-seller-code.e2e-spec.ts` -> 7 test.
- Frontend targeted admin/store workforce testi gecti: `admin-inbox.spec.ts` + `store-surfaces.spec.ts` -> 13 Playwright test.
- Official root release gate gecti: root 28 script test, backend 43 suite / 306 test, frontend 33 Playwright test, buildler ve `npm audit --omit=dev`.

Siradaki mantikli adim tamamlandi: Elimizdeki mevcut magaza/personel listeleri ve satici kodlari icin kontrollu master-data bootstrap/import plani hazirlandi.

## Son Personnel Master Data Bootstrap V1 Plan

27 Nisan 2026 itibariyla mevcut magaza/personel listeleri ve satici kodlari icin kontrollu baslangic veri yukleme karari dokumante edildi.

Yeni dokuman:

- `docs/plans/personnel-master-data-bootstrap-v1.md`

Karar:

- Bu is gunluk KPI/satis importu degil; resmi magaza/personel kimliklerini sisteme ilk kez kontrollu alma isidir.
- Once magaza baseline, sonra personel baseline ilerlenir.
- `ops.store.store_type` is etiketleri `Sirket`, `Franchise`, `Isletme`; teknik degerler `company`, `franchise`, `operator` olarak kalir.
- `ops.store.kpi_import_enabled` hangi magazalarin KPI import kapsaminda oldugunu belirleyen ana kontrol alanidir.
- `ops.employee.external_employee_ref` resmi satici kodu kimligi olarak kullanilir.
- `ops.employee_assignment_history` aktif magaza/pozisyon atamasinin kaynagidir.
- Excel veya liste satirlari direkt canli tabloya basilmamalidir; staging/review/promote akisi kullanilmalidir.
- Garaj/cadir/ilgilenilmeyen magazalar tanimli/aktif import kapsaminda degilse skorlanmaz.
- Bilinmeyen magaza/personel satirlari `unmapped_store` / `unmapped_employee` gibi review kategorilerine dusmeli, yanlis skor yazmamalidir.

CODEX durust yorum:

- Bu adim gosterisli degil ama projenin omurgasidir.
- En buyuk risk kirli ilk veriyi resmi tabloya hizlica yazip ileride KPI, prim, ranking, turnover ve request akisini bozmaktir.
- Saglam yol staging, validation, admin review ve audit evidence ile promote etmektir.

Siradaki mantikli adim: Gercek baseline dosya seklini inceleyip V1 store baseline staging + validation icin en kucuk implementasyon planini cikarmak.

## Son Mart Excel Dosya Inceleme Notu

27 Nisan 2026 itibariyla kullanicinin ilettigi iki Excel dosyasi incelendi:

- `C:\Users\suley\Downloads\MAĞAZA TABLO.xlsx`
- `C:\Users\suley\Downloads\PERSONEL TABLO.xlsx`

Sonuc:

- Bu dosyalar master-data baseline dosyasi degil; Mart KPI snapshot dosyalari.
- `MAĞAZA TABLO.xlsx` kolonlari: magaza adi, hedef, ciro, gerceklesen %, satis adedi, FF, CR, ATV, fatura sayisi, UPT, OSF, gecen yil ciro, ciro artis.
- `PERSONEL TABLO.xlsx` kolonlari: adi, magaza adi, P. satis adeti, satis tutari, ciro payi, magaza cirosu, P.ATV, P.UPT.
- Dosyalarda magaza kodu, bolge, magaza tipi, KPI import enabled flag, satici kodu, pozisyon, ise giris tarihi ve employment status yok.
- Bu nedenle bu dosyalar `ops.store` / `ops.employee` resmi master-data bootstrap icin yeterli degildir.
- Bu dosyalar Excel KPI Import V1 icin kullanilabilir.
- 185 ortak magaza adinda personel dosyasi net satisi ile magaza dosyasi ciro degeri birebir reconcile oluyor.
- Marmara Park acceptance case dogrulandi: personel pozitif satis toplami + personel negatif hareketler = magaza net ciro.
- Is kuralı korunmali: personel KPI pozitif brut satistan beslenir; magaza KPI magaza tablosundaki net cirodan beslenir; personel eksi satirlari magazaya ikinci kez dusulmez.

Siradaki mantikli adim: Excel KPI Import V1 mapping/guard implementasyon planina gecmek. Master-data bootstrap ise gercek store/personnel baseline listesi gelene kadar beklemeli.

## Son Project MVP Focus Map

28 Nisan 2026 itibariyla proje icin sifirdan baslama yerine konsolidasyon karari dokumante edildi.

Yeni dokuman:

- `docs/plans/project-mvp-focus-map-2026-04-28.md`

Karar:

- Proje sifirdan baslatilmamali.
- Mevcut rahatsizlik mimari cokme degil; cok fazla alanin ayni anda gorunur hale gelmesinden dogan odak kalabaligi.
- Dogru hamle yeni buyuk modul acmak degil, MVP odagina daralmak.
- Korumaya alinacak cekirdek: auth/scope, action scope, release gate, KPI/import lineage, data quality, snapshot/config versioning, personnel workflows, operational feed.
- MVP odagi: gercek Excel KPI Import V1, store/personnel performans ekranlari, personnel lifecycle V1, admin import kalite gorunurlugu, root release gate.
- Bekletilecekler: full UI redesign, full EN/TR sweep, tournament derinligi, push/social ozellikleri, global audit feed.
- Dis bagimlilikta kalanlar: real staging IdP evidence ve real JSON source adapter.

CODEX durust yorum:

- Restart duygusal olarak temiz hissettirebilir ama teknik olarak israf olur.
- Proje iyi durumda oldugu icin degil, kanit ve sinir tutmayi ogrendigi icin devam etmeye deger.
- Sonraki 2-4 hafta hiz degil, keskin odak donemi olmali.

Siradaki mantikli adim: Excel KPI Import V1 implementasyon planini Mart dosyalari uzerinden hazirlamak.

## Son Excel KPI Import V1 Formula Decision

28 Nisan 2026 itibariyla Excel KPI Import V1 icin donemsel oran hesaplama kurali kilitlendi.

Yeni dokuman:

- `docs/plans/excel-kpi-import-v1.md`

Kullanici mevcut sirket sisteminden 1 Mart, 2 Mart ve iki gunluk filtre degerlerini kontrol etti. Sonuc:

- Sistem gunluk ATV/UPT degerlerinin duz ortalamasini almiyor.
- Donem ATV ve UPT degerlerini toplam baz metriklerden yeniden hesapliyor.
- CR is kurali: `Fatura Sayisi / FF x 100`.

Kilitli formuller:

- `ATV = toplam satis tutari / toplam fatura sayisi`
- `UPT = toplam satis adedi / toplam fatura sayisi`
- `CR% = toplam fatura sayisi / toplam FF x 100`

Import/donem kurallari:

- Gunluk upload ayni gun icin `periodStart = periodEnd` olur.
- 4 gunluk upload `custom` period olarak saklanir; dosyada gun kirilimi yoksa gunluk kayitlara bolunmez.
- Gunluk ranking/closure gunluk upload'lardan beslenmelidir.
- Ayni source/period/scope/metric tekrar yuklenirse eklenmez; onceki deger update/replace edilir.
- Donem gorunumunde additive metrikler toplanir; ATV/UPT/CR toplam baz metriklerden yeniden hesaplanir.
- Gunluk oran ortalamasi ancak acikca "daily average" olarak etiketlenirse ayri bir gorunum olabilir; resmi donem KPI degildir.

Siradaki mantikli adim tamamlandi: Excel KPI Import V1 implementasyon plani bu karar uzerinden yazildi.

## Son Excel KPI Import V1 Implementation Plan

28 Nisan 2026 itibariyla Excel KPI Import V1 icin uygulanabilir kod plani hazirlandi.

Yeni dokuman:

- `docs/superpowers/plans/2026-04-28-excel-kpi-import-v1.md`

Plan kapsami:

- `FF` KPI metrigini birinci sinif base metric yapmak.
- Store Excel parserini enabled local store scope ile sinirlamak.
- Store `NET_SALES`, `ITEM_COUNT`, `TICKET_COUNT`, `FF`, `ATV`, `UPT`, `CR`, `TARGET_ACHIEVEMENT` canonical satirlarini uretmek.
- Store `ATV`, `UPT`, `CR` degerlerini kaynak oran kolonlarini ortalamadan base toplamlar uzerinden yeniden hesaplamak.
- Personnel Excel tarafinda sadece pozitif `Satis Tutari` satirlarini employee gross sales olarak almak.
- Negatif personnel satirlarini employee performansindan dusmeden reconciliation evidence olarak tutmak.
- Unknown store/personnel kimliklerini gecici kayit acmadan external-id mapping review akimina dusurmek.
- Deterministic exact-payload `sourceBatchId`/`idempotencyKey` ile ayni dosya tekrar yuklemede cift sayimi engellemek.
- Admin upload UI icin monthly/daily/custom period kontrollerini eklemek.
- Backend targeted tests, frontend build/e2e, backend/frontend/root `check:release` kapilarini final kabul sarti yapmak.

CODEX durust yorum:

- Bu plan dogru next step. Excel parsingden daha kritik olan sey store/personnel skor semantigini bozmamak.
- Plan isimden resmi employee/store yaratmiyor; isimleri sadece mapping candidate olarak tutuyor.
- Store net satis ile personnel brut satis ayrimini korudugu icin prim/hedef mantigi karismaz.

Siradaki mantikli adim tamamlandi: Excel KPI Import V1 implementasyonu tamamlandi ve root release gate gecti.

## Son Excel KPI Import V1 Implementation Result

28 Nisan 2026 itibariyla Excel KPI Import V1 kodu tamamlandi.

Eklenenler:

- `FF` first-class KPI base metric olarak eklendi.
- `db/migrations/034_ff_kpi_definition.sql` eklendi.
- Store Excel import artik local master datada KPI import enabled olan magazalarla sinirli.
- Store canonical KPI satirlari: `NET_SALES`, `ITEM_COUNT`, `TICKET_COUNT`, `FF`, `ATV`, `UPT`, `CR`, `TARGET_ACHIEVEMENT`.
- Store `ATV`, `UPT`, `CR` artik kaynak oran kolonlarindan kopyalanmiyor; base toplamlar uzerinden yeniden hesaplaniyor.
- Personnel KPI satirlari sadece pozitif brut satislardan uretiliyor.
- Personnel negatif satirlari employee performansindan dusulmuyor.
- Personnel negatif satirlari reconciliation evidence icinde tutuluyor.
- Personnel `TICKET_COUNT`, `ATV`, `UPT` sadece `P.ATV` ve `P.UPT` denominator hesabi tutarliysa uretiliyor.
- Marmara Park acceptance case testte kilitlendi: personnel pozitif satis + personnel negatif hareketler = store net ciro.
- Re-upload icin deterministic exact-payload `sourceBatchId` ve `idempotencyKey` eklendi.
- Admin Excel upload UI monthly/daily/custom period secimini destekliyor.

Dogrulama:

- Backend targeted: `npm.cmd test -- src/modules/integration/application/power-bi-export-upload.service.spec.ts src/modules/integration/application/kpi-import-normalization.service.spec.ts test/integration/import-batch.e2e-spec.ts --runInBand` -> 3 suite / 43 test.
- Frontend targeted: `npm.cmd run build`; `npm.cmd run test:e2e -- e2e/integration-surfaces.spec.ts` -> build + 3 Playwright test.
- Root release: `npm.cmd run check:release` -> root script tests, backend lint/test/build/audit, frontend lint/script/build/e2e/audit.
- Backend full test sonucu: 43 suite / 309 test.
- Frontend full e2e sonucu: 34 Playwright test.

Siradaki mantikli adim tamamlandi: Excel KPI Import operator runbooku yazildi ve root script testleriyle korumaya alindi.

## Son Excel KPI Import Operator Runbook V1

28 Nisan 2026 itibariyla Excel KPI Import icin operasyonel yukleme runbooku tamamlandi.

Yeni dokuman:

- `docs/plans/excel-kpi-import-operator-runbook.md`

Yeni guard testi:

- `scripts/excel-import-runbook-contract.test.mjs`

Runbook kapsami:

- backend/frontend/local Keycloak preflight komutlari
- KPI dosya preflight kontrolu
- store import scope kontrolu
- monthly/daily/custom upload adimlari
- upload summary review
- `unmapped_store` ve `unmapped_employee` mapping review
- store net satis ile personnel pozitif/negatif hareket reconciliation kontrolu
- retry/re-upload kurallari
- materialization ve score trust karari
- evidence note template
- Go / Conditional Go / No-Go kararlari

Korunan is kurallari:

- Store performansi store net satisindan beslenir.
- Personnel performansi sadece pozitif brut satistan beslenir.
- Negative personnel satirlari employee KPI dusurmez.
- Negative personnel satirlari reconciliation evidence olarak kalir.
- `ATV`, `UPT`, `CR` donemde base toplamlar uzerinden yeniden hesaplanir.
- Name-only Excel satirlarindan gecici/resmi store veya employee uretilmez.

CODEX durust yorum:

- Bu runbook dogru sirada geldi. Parser calisiyor ama asil risk yanlis donem, yanlis store scope veya name-only employee identity'yi erken resmi veri sanmakti.
- Runbook, importu tek seferlik deneme olmaktan cikarip tekrar edilebilir operasyon haline getiriyor.

Siradaki mantikli adim tamamlandi: Production-ready backend yolunda ilk P0 teknik risk olan migration sisteminin implementation plani yazildi.

## Son Production-Ready Migration System V1 Implementation Plan

28 Nisan 2026 itibariyla migration sistemi icin koddan once uygulanabilir guvenlik plani hazirlandi.

Yeni dokuman:

- `docs/superpowers/plans/2026-04-28-production-ready-migration-system-v1.md`

Plan kapsami:

- `audit.schema_migration` tracking tablosu.
- migration checksum drift guard.
- failed migration status/error evidence.
- backend/nestjs calisma yolundan root `db/migrations` cozumleme.
- production ortaminda HTTP migration endpoint guard.
- CLI/CI migration runner: `npm.cmd run db:migrate`.

Karar:

- Mevcut NestJS + PostgreSQL + raw SQL yaklasimi korunacak.
- ORM eklenmeyecek.
- Mevcut `001` - `034` migration dosyalari yeniden yazilmayacak.
- Once red tests, sonra schema/tracking, sonra CLI ve production endpoint guard ilerleyecek.

CODEX durust yorum:

- Bu is gosterisli degil ama production guvenligi icin dogru ilk adim.
- Migration tracking bitmeden mobil auth/session, CORS/rate limit ve sosyal/topluluk tarafini buyutmek teknik riski artirir.

Siradaki mantikli adim: plan onayliysa Task 1 ile kirmizi migration service testlerini yazmak; henuz production migration kodu uygulanmadi.

## Son Production-Ready Migration System V1 Implementation Result

28 Nisan 2026 itibariyla migration sistemi production hazirligi icin guvenli hale getirildi.

Eklenenler:

- `audit.schema_migration` tracking tablosu canonical schema ve `035_schema_migration_tracking.sql` migration dosyasina eklendi.
- `MigrationService` artik root `db/migrations` yolunu `backend/nestjs` calisma dizininden dogru cozer.
- Basarili migration dosyalari checksum eslesirse skip edilir.
- Basarili migration dosyasinin checksum'u degisirse migration calistirilmadan hata verilir.
- Failed migration status ve error evidence transaction disinda kaydedilir.
- `/api/admin/migrations/run` production ortaminda `404` ile gizlenir.
- CLI/CI migration yolu eklendi: `npm.cmd run db:migrate`.

Dogrulama:

- Backend targeted migration/config/controller/CLI tests passed.
- Root script tests passed.
- Backend `npm.cmd run check:release` passed: 47 suite / 320 test, build, audit.

CODEX durust yorum:

- Bu adim teknik borc kapatti; gosterisli degil ama production veri guvenligi icin cok degerli.
- Mevcut migration setinde `001` dosyasinin `schema.sql` include etmesi tarihsel bir mimari risk olarak izlenmeli; V1 bunu daha guvenli izlenebilir hale getirdi ama ileride migration baseline/immutability stratejisi ayrica netlestirilmeli.

Siradaki mantikli adim: Production Security Gate V1 planina gecmek; CORS, rate limit, request logging, error response standardi ve mobil auth/session kararlarini koddan once netlestirmek.

## Son Production Security Gate V1-A

28 Nisan 2026 itibariyla ilk production security gate uygulandi.

Eklenenler:

- CORS allowlist: local default `http://localhost:5173`, production `CORS_ALLOWED_ORIGINS` zorunlu.
- Comma-separated origin destegi.
- In-memory V1 rate limit: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`.
- Standart global error response: `correlationId`, `statusCode`, `errorCode`, `message`, `path`, `timestamp`.
- Stack trace response'a donmez.
- Rate limit asiminda `429 RATE_LIMIT_EXCEEDED`.
- Validation hatasinda `400 VALIDATION_ERROR`.
- Unexpected error'da `500 INTERNAL_SERVER_ERROR`.
- Runtime bootstrap `configureHttpSecurity(...)` ile tek noktadan baglandi.

Dogrulama:

- Backend targeted config/security e2e tests passed.
- Root script tests passed.
- Backend `npm.cmd run check:release` passed: 48 suite / 331 test, build, audit.
- Root `npm.cmd run check:release` passed.

CODEX durust yorum:

- Bu V1-A iyi sinirlandi; mobile auth/session bilincli olarak disarida.
- Rate limit in-memory oldugu icin multi-instance prod'da Redis/WAF/gateway'e tasinacak future risk olarak kalir; su an MVP/pilot icin uygun.

Siradaki mantikli adim: Mobile Auth/Session V1 planina gecmek; access token, refresh token, device session, logout/revoke, push token storage ve mobile BFF siniri koddan once netlestirilmeli.

## Son Mobile Auth/Session V1 Design And Plan

28 Nisan 2026 itibariyla Mobile Auth/Session V1 icin koddan once tasarim ve implementation plan hazirlandi.

Yeni dokumanlar:

- `docs/superpowers/specs/2026-04-28-mobile-auth-session-v1-design.md`
- `docs/superpowers/plans/2026-04-28-mobile-auth-session-v1.md`

Kararlar:

- Mobile BFF bu fazin disinda kalacak.
- Refresh token V1'de backend tarafinda tutulmayacak; IdP-owned kalacak.
- Backend refresh token broker ileride gerekirse sadece token hash saklayacak, plaintext tutmayacak.
- Refresh token reuse detection ileride backend broker fazina girerse security event sayilacak ve default karar tum mobil session'lari revoke etmek olacak.
- Backend mobile device session kaydi tutacak.
- Token claim'e tek basina guvenilmeyecek; DB role/read/action assignment kontrolu devam edecek.
- Push token ayri tabloya baglanacak; P0 icin zorunlu degil, P1 olarak planlandi.
- Admin-web PKCE/login akisi V1'de bozulmayacak.

Planlanan P0:

- `ops.mobile_device_session` tablosu.
- `POST /api/mobile/auth/sessions`.
- `GET /api/mobile/auth/session`.
- `POST /api/mobile/auth/logout`.
- `GET /api/mobile/auth/sessions`.
- `DELETE /api/mobile/auth/sessions/:sessionId`.
- active mobile session guard.
- audit event catalog entryleri.
- targeted backend tests + backend/root release gate.

CODEX durust yorum:

- Bu plan dogru sirada. Migration ve Security Gate kapilari kapanmadan mobile session'a gecmek riskli olurdu; simdi kapinin ustune cihaz oturumu eklemek mantikli.
- Backend'i ikinci IdP'ye cevirmemek dogru karar. Once cihaz session/revoke ve DB scope guveni, sonra Mobile BFF.

Siradaki mantikli adim: onay verilirse Mobile Auth/Session V1 P0 Task 1 ile schema contract testinden baslamak; refresh token broker ve Mobile BFF simdilik acilmamali.

## Son Mobile Auth/Session V1 P0 Implementation Result

28 Nisan 2026 itibariyla Mobile Auth/Session V1 P0 backend tarafinda uygulandi.

Eklenenler:

- DB: `ops.mobile_device_session` canonical schema ve `db/migrations/036_mobile_device_sessions.sql`.
- Backend:
  - `POST /api/mobile/auth/sessions`
  - `GET /api/mobile/auth/session`
  - `GET /api/mobile/auth/sessions`
  - `POST /api/mobile/auth/logout`
  - `DELETE /api/mobile/auth/sessions/:sessionId`
- `MobileSessionGuard`: mobil session okuma/logout gibi mobil-only endpointlerde bearer auth'a ek olarak `x-mobile-session-id` ister.
- `MobileSessionService`: raw `deviceId` saklamaz, SHA-256 hash ile aktif device session'i bulur veya olusturur.
- Audit eventleri: `mobile_device_session.created`, `mobile_device_session.revoked`.

Korunan sinirlar:

- Refresh token backend'de tutulmuyor; IdP-owned kaldi.
- Backend refresh endpointi acilmadi.
- Mobile BFF acilmadi.
- Push token storage P0 disinda kaldi.
- Admin-web PKCE/auth akisi degistirilmedi.
- Store/feed/workforce/competition modullerine dokunulmadi.

Dogrulama:

- Schema contract: `npm.cmd test -- src/modules/auth/mobile-session-schema-contract.spec.ts --runInBand`.
- Repository/service/guard: `npm.cmd test -- src/modules/auth/mobile-session.service.spec.ts src/modules/auth/mobile-session.repository.spec.ts src/modules/auth/guards/mobile-session.guard.spec.ts --runInBand`.
- Mobile auth e2e: `npm.cmd test -- test/integration/mobile-auth-session.e2e-spec.ts --runInBand`.
- Audit catalog: `npm.cmd test -- src/shared/audit/audit-event-catalog.spec.ts --runInBand`.
- Backend build: `npm.cmd run build`.
- Backend release: `npm.cmd run check:release` -> lint, 53 suite / 344 test, build, `npm audit --omit=dev`.
- Root release: `npm.cmd run check:release` -> 32 root script test, backend release, frontend lint/script/build/e2e 34 Playwright test, audits.

CODEX durust yorum:

- Bu dogru sertlikte bir P0 oldu: mobil uygulama icin logout/revoke ve cihaz oturum zemini var, ama backend'i ikinci IdP'ye cevirecek refresh-token broker acilmadi.
- Sira Mobile BFF yazmakta degil; once mobil ekranlar icin hangi mevcut endpointlerin yettigi, hangi noktalarda gercek aggregation gerektigi envanterlenmeli.

Siradaki mantikli adim: Mobile API/BFF endpoint envanteri cikarmak; Home, magaza performansi, checklist, personel performansi, ranking/feed/profil ekranlari icin mevcut endpoint yetiyor mu, yoksa az sayida mobil aggregate endpoint mi gerekiyor bunu koddan once netlestirmek.

## Son Mobile API/BFF Endpoint Inventory V1

28 Nisan 2026 itibariyla Mobile API/BFF endpoint envanteri yazildi ve mobil BFF siniri koddan once netlestirildi.

Yeni dokumanlar:

- `docs/plans/mobile-api-bff-endpoint-inventory-v1.md`
- `docs/superpowers/plans/2026-04-28-mobile-api-bff-endpoint-inventory-v1.md`

Kararlar:

- Broad Mobile BFF simdilik acilmiyor.
- Mobile Auth/Session V1 P0, Mobile BFF'ten ayri kalmaya devam ediyor.
- Feed, workflow inbox, personal performance, rankings, competitions ve workforce onaylari ilk pilotta mevcut endpointlerden kullanilabilir.
- `GET /api/mobile/home` sadece mobil home kartlari netlesince P1 aggregate adayi.
- `GET /api/mobile/store-performance` store KPI mobil ekrani web gibi birden fazla rapor cagrisi gerektirirse P1 aggregate adayi.
- `GET /api/mobile/checklists/today` checklist mobil is akisi netlesmeden kodlanmayacak; mevcut checklist API'leri action/report agirlikli oldugu icin once read-model karari gerekiyor.
- Yeni `/api/mobile/*` endpoint acmadan once ekran ihtiyaci, mevcut cagrilar, business logic riski, rol/scope kurallari, response kontrati, source-of-truth servis ve scope-widening testi sorulacak.

CODEX durust yorum:

- Mobil BFF dogru yerde cok faydali olacak, ama bugun genis bir BFF acmak erken olur.
- Backend'in mevcut endpoint kapsami pilot icin yeterli seviyede; asil dikkat edilmesi gereken nokta checklist'in mobil "today" read modelidir.
- En guvenli siralama: mevcut endpointlerle pilotu sekillendir, sonra ya Mobile Home Summary V1 ya da Mobile Checklist Today V1 icin dar bir planla ilerle.

Siradaki mantikli adim: ilk mobil pilot read surface'i secmek. Dashboard/home ile baslanacaksa Mobile Home Summary V1 kartlari netlestirilmeli; operasyonel checklist onceyse Mobile Checklist Today V1 icin ayri interview yapilmali.

## Son Checklist Acknowledgement Canonical Schema Alignment V1

28 Nisan 2026 itibariyla checklist acknowledgement tablosu canonical `db/schema.sql` ile tekrar hizalandi.

Bulgu:

- `ops.checklist_acknowledgement` migration `010_checklist_acknowledgements.sql` icinde ve backend repository kodunda kullaniliyordu.
- Canonical `db/schema.sql` icinde tablo/index eksikti.
- Mobil checklist read modeline gecmeden once bu drift kapatildi.

Eklenenler:

- `db/schema.sql` icine `ops.checklist_acknowledgement` tablo tanimi.
- `db/schema.sql` icine `idx_checklist_acknowledgement_store_acknowledged_at` index tanimi.
- `backend/nestjs/src/modules/store-ops/checklist-acknowledgement-schema-contract.spec.ts` schema contract testi.

Dogrulama:

- Kirmizi test izlendi: schema contract once canonical schema'da `ops.checklist_acknowledgement` olmadigi icin fail verdi.
- Hedefli test gecti: `npm.cmd test -- src/modules/store-ops/checklist-acknowledgement-schema-contract.spec.ts --runInBand`.

CODEX durust yorum:

- Bu kucuk ama dogru zamanda yakalanmis bir borctu. Mobil checklist'i buyutmeden once canonical schema'nin mevcut checklist acknowledgement akisini temsil etmesi gerekiyor.
- Yeni feature acilmadi; var olan migration/kod/DB gercegi canonical schema ile hizalandi.

Siradaki mantikli adim: Mobile Checklist Today V1 icin urun kararini netlestirmek. Ilk soru: mobilde checklist'i kim "yapar", kim sadece "tamamlanan sonucu onaylar"?

## Son Mobile Checklist Today V1 Design

28 Nisan 2026 itibariyla Mobile Checklist Today V1 tasarim kararlari kilitlendi.

Yeni dokuman:

- `docs/superpowers/specs/2026-04-28-mobile-checklist-today-v1-design.md`

Kararlar:

- `HR_ADMIN` checklist sablonunu ve agirliklarini yonetir.
- Sablon/item/agirlik degisirse yeni template version yayinlanir; gecmis tamamlanmis checklist skorlarina geriye donuk etki etmez.
- Agirlik toplami `100` olmak zorunda.
- V1 aktif kullanimda bolge muduru maddeleri `0-10` puanlar; response type gelecekte esnek kalir.
- `REGION_MANAGER` kendisine atanmis magazalar icin checklist baslatir, taslak kaydeder, devam eder ve tamamlar.
- Durum modeli: `planned`/Taslak, `in_progress`/Devam ediyor, `completed`/Tamamlandi, future `cancelled`/cancel with reason.
- `REGION_MANAGER` tamamla dedigi anda skor gecerlidir ve aylik skora dahil olur.
- `STORE_MANAGER` sadece `Kabul ettim / Gordum` acknowledgement verir; skor onayi, red veya bekletme yetkisi yoktur.
- Ayni magazaya ayni ay icinde birden fazla checklist yapilabilir.
- Aylik checklist sonucu, o ay tamamlanan ziyaret skorlarinin aritmetik ortalamasidir ve visit count gorunur.
- Completed checklist kilitlidir; V1'de duzenleme/silme yoktur. Hata olursa yeni ziyaret kaydi acilir; future `cancel with reason` ayri fazdir.

CODEX durust yorum:

- Bu akista en dogru ayrim scoring authority ile acknowledgement authority'nin ayrilmasi. Bolge muduru saha skorunu verir; magaza muduru sonucu teslim alir.
- Coklu ziyaret serbestligi saha gercegine uygun; aylik ortalama ve ziyaret sayisi bunu dagitmadan raporlar.
- Completed-lock karari gecmis skorlarin sessizce degismesini engeller.

Siradaki mantikli adim tamamlandi: Mobile Checklist Today V1 implementation plani yazildi.

## Son Mobile Checklist Today V1 Implementation Plan

28 Nisan 2026 itibariyla Mobile Checklist Today V1 Implementation Plan hazirlandi.

Yeni dokuman:

- `docs/superpowers/plans/2026-04-28-mobile-checklist-today-v1.md`

Kapsam:

- Backend schema contract ve additive migration adimlari.
- HR template draft/publish ve agirlik toplami `100` guard'i.
- Region-manager assigned-store start/save/resume/complete akisi.
- Completed-lock ve weighted score hesaplama.
- Store-manager acknowledgement'in bilgilendirme olarak kalmasi.
- Coklu aylik ziyaretlerin `monthlySummaries` icinde ortalama ve visit count ile raporlanmasi.
- Frontend pilot yuzeyleri ve backend/frontend/root release dogrulamalari.

Not:

- Bu plan sonrasinda uygulandi ve alttaki `Son Mobile Checklist Today V1 Implementation` bolumunde kapatildi.
- Implementation plan artik tarihsel yol haritasi olarak duruyor; aktif borc sayiminda tamamlanan uygulama dikkate aliniyor.

CODEX durust yorum:

- Plan dogru sirada: once schema/contract, sonra repository/service, sonra mobil read model ve UI pilot.
- En riskli yerler tamamlanmis checklist'in kilitlenmesi ve ayni ay coklu ziyaret ortalamasinin sessizce bozulmamasi; plan bunlari ilk gunden testle yakalatacak sekilde yazildi.

Siradaki mantikli adim tamamlandi: Mobile Checklist Today V1 uygulandi ve release kapilarindan gecti.

## Son Mobile Checklist Today V1 Implementation

28 Nisan 2026 itibariyla Mobile Checklist Today V1 backend ve frontend pilot yuzeyiyle uygulandi.

Eklenenler:

- DB: `db/migrations/037_mobile_checklist_today_v1.sql` ve canonical `db/schema.sql` checklist template versioning, instance lifecycle, completed-lock ve monthly-summary indexleriyle hizalandi.
- Backend:
  - HR template draft/publish akisi ve agirlik toplami `100` publish guard'i.
  - `GET /api/mobile/checklists/today`.
  - `POST /api/mobile/checklists/instances`.
  - `PATCH /api/mobile/checklists/instances/:checklistInstanceId/responses`.
  - `POST /api/mobile/checklists/instances/:checklistInstanceId/complete`.
  - `POST /api/mobile/checklists/instances/:checklistInstanceId/acknowledge`.
- Region manager akisi:
  - sadece atanmis action store uzerinde checklist baslatir
  - yanit kaydeder
  - planned kaydi `in_progress` durumuna tasir
  - tamamladiginda weighted score hesaplanir
  - tamamlanan instance `locked_at` ile kilitlenir
- Store manager akisi:
  - tamamlanmis sonucu `Kabul ettim` olarak isaretler
  - acknowledgement skorun gecerli olmasini geciktirmez
- Aylik ozet:
  - ayni magazaya ayni ay birden fazla tamamlanmis ziyaret serbesttir
  - `monthlySummaries` completed visit count ve average score verir
- Frontend pilot:
  - `/store/checklists` bolge muduru icin atanmis magaza ziyaret akisini gosterir
  - `/store/checklists` magaza muduru icin acknowledgement dilini korur
  - `/admin/checklists` HR/SUPER_ADMIN icin template route iskeletini acar

Korunan sinirlar:

- Completed checklist V1'de duzenlenmez veya silinmez.
- Cancel-with-reason, tam form editoru, attachment, push notification ve offline sync V1 disinda kaldi.
- Mobile BFF acilmadi.
- Store/feed/workforce/competition modullerinin is mantigi degistirilmedi.

Dogrulama:

- Backend targeted checklist tests: `npm.cmd test -- src/modules/store-ops/checklist-mobile-workflow-schema-contract.spec.ts src/modules/store-ops/infrastructure/checklist.repository.spec.ts src/modules/store-ops/application/checklist.service.spec.ts test/integration/mobile-checklist-today.e2e-spec.ts --runInBand` -> 4 suite / 36 test.
- Backend release: `npm.cmd run check:release` -> lint, 58 suite / 381 test, build, `npm audit --omit=dev`.
- Frontend release: `npm.cmd run check:release` -> lint, 7 Node script test, build, 36 Playwright test, `npm audit --omit=dev`.
- Root release: `npm.cmd run check:release` -> 46 root script test, backend release, frontend release, audits.
- Not: root release ilk kosuda eski feed preview Playwright testi tek seferlik dustu; izole hedefli test ve full frontend e2e tekrar gecti, ardindan root release tekrar exit 0 verdi.

CODEX durust yorum:

- Bu parca dogru yerden buyudu: checklist artik sadece rapor/acknowledgement degil, saha ziyareti skoru uretebilen kontrollu bir workflow.
- En kritik kazanc, gecmis skoru sessizce degistirmemek icin completed-lock davranisinin testlerle kilitlenmesi.
- UI hala pilot; asil deger backend lifecycle, scope ve score davranisinin dogru oturmasinda.

Bu siradaki adim tamamlandi: Personnel Master Data Bootstrap V1 staging, validation, review queue, duplicate/conflict preflight, promotion readiness, store promotion ve personnel promotion slice'lariyla release kapilarindan gecti.

## Son Master Data Bootstrap Personnel Promotion V1

29 Nisan 2026 itibariyla reviewed personnel bootstrap rows icin canli employee ve assignment promotion yolu acildi.

Eklenenler:

- HR/Admin scoped endpoint: `POST /api/integrations/master-data-bootstrap/batches/:batchId/promote-personnel`.
- Promotion yalniz `ready_to_promote` personnel batch ve readiness `ready` satirlar icin calisir.
- Personnel staging artik live-write icin gerekli first name, last name, national id hash, hire date ve employment type metadata'sini validate eder.
- Promotion `ops.employee` kaydini create/update eder.
- Promotion ayni employee icin tek active primary assignment'i koruyarak `ops.employee_assignment_history` kaydini create/update eder.
- Staged row `promoted` olur ve employee `promoted_entity_id` kaniti saklanir.
- Store promotion path'i ve personnel promotion path'i ayri tutuldu; user account/role creation V1 disinda kaldi.

Dogrulama:

- Targeted bootstrap tests: `npm.cmd test -- master-data-bootstrap --runInBand` -> 3 suite / 39 test.
- Backend lint: `npm.cmd run lint` -> pass.
- Backend build: `npm.cmd run build` -> pass.
- Root release: `npm.cmd run check:release` -> 46 root script test, backend 71 suite / 452 test, frontend 40 Playwright test, audits.

CODEX durust yorum:

- Bu borc temiz kapandi: personel master data artik dosyadan dogrudan live tabloya ziplayan riskli bir yol degil; staging, review, readiness ve promotion kapilarindan geciyor.
- En kritik sinir korundu: personel identity/assignment canliya alinabilir, ama kullanici hesabi ve auth role binding ayri ve daha kontrollu bir slice olarak kalir.
- UI hala operator pilot seviyesinde tutulmali; asil deger backend'in yanlis satiri yanlis personele yazmamasinda.

Bu siradaki adim tamamlandi: master data promotion sonucu admin yuzeyinde kullanilabilir hale getirildi.

## Son Master Data Bootstrap Admin Review Surface V1

29 Nisan 2026 itibariyla HR/Admin icin master data bootstrap review yuzeyi eklendi.

Eklenenler:

- Yeni frontend route: `/admin/master-data`.
- Yeni frontend route: `/admin/master-data/:batchId`.
- Admin nav icinde `Master Data` girisi eklendi.
- Yetkili roller: `SUPER_ADMIN`, `HR_ADMIN`, `INTEGRATION_ADMIN`.
- Yuzey mevcut backend endpointlerini kullanir; yeni backend promotion mantigi eklenmedi.
- Batch listesi readiness, status, row count, promoted count ve source/file evidence gosterir.
- Batch detayinda readiness counters, next action, validate action, promote action ve row-level resolved/promoted evidence gorunur.
- Personnel batch promote aksiyonu `promote-personnel`, store batch promote aksiyonu `promote-stores` endpointine gider.
- UI promotion eligibility hesaplamaz; backend `canPromote` kararini render eder.

Dogrulama:

- RED acceptance: `/admin/master-data/bootstrap-batch-personnel-1` route/yuzey yokken Playwright testi dustu.
- Frontend targeted: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:e2e -- e2e/integration-surfaces.spec.ts` -> pass.
- Root release: `npm.cmd run check:release` -> 46 root script test, backend 71 suite / 452 test, frontend 41 Playwright test, audits.

CODEX durust yorum:

- Bu dogru siradaki adimdi. Backend promotion acilmisti; operator kaniti gormeden user account/auth role creation'a gecmek kontrol kaybi yaratirdi.
- Bu yuzey seksi bir ekran degil ama master data icin guven verir: hangi satir canliya yazildi, hangi entity id olustu, hangi batch hala blokta net gorunur.
- Hala V1 pilot seviyesinde. Row editing, Excel upload, auth user creation ve role assignment ayri intake ister.

Bu siradaki adim tamamlandi: `User Account / Role Assignment V1` icin tasarim-intake yapildi ve tasarim dokumani yazildi.

## Son User Account / Role Assignment V1 Design

29 Nisan 2026 itibariyla master data promotion sonrasi pilot kullanici hesabi, rol ve magaza scope baglama kararlarinin tasarimi yazildi.

Kararlar:

- V1 toplu kullanici acma degildir.
- Pilot kapsam: `1 REGION_MANAGER`, `2 STORE_MANAGER`, `1 VISUAL_MERCHANDISER` ve mevcut `HR_ADMIN` / `SUPER_ADMIN`.
- `STORE_PERSONNEL` hesaplari V1 disinda kalir.
- Keycloak kimlik saglayici olarak kalir; Keycloak kullanicilari V1'de manuel/hazir olusturulur.
- HR_ADMIN hazir Keycloak kullanicisini canli `employeeId` kaydina baglar.
- Teknik eslestirme isim soyisimle degil `employeeId + authProvider + providerSubject` ile yapilmalidir.
- Email/username gorunum ve kontrol kanitidir; canonical matching key degildir.
- HR_ADMIN pilot hesaplari ikinci onay olmadan aktif edebilir; audit zorunludur.
- V1'de kullanici basina tek ana rol vardir; multi-role yoktur.
- `VISUAL_MERCHANDISER` yeni rol kodu olarak kabul edildi ve VM kullanicisi bolge muduru yetkisi almayacak sekilde sinirlanmalidir.
- `STORE_MANAGER` yalniz kendi magazasini gorur/yonetir.
- `REGION_MANAGER` ve `VISUAL_MERCHANDISER` pilotta iki pilot magazayla sinirlanir.
- Is cikisi, kapsamdan cikarma veya transfer durumunda iki katmanli kapatma hedeflenir: backend user/role/scope kapatma + Keycloak manuel disable.

Onemli teknik not:

- Mevcut `ops.user_account` tablosunda `employee_id` vardir ama Keycloak `sub/providerSubject` icin kalici alan henuz yoktur.
- Uygulama planinda token `sub` degerini ic `user_id` ile ayni varsaymak yerine provider subject -> app user lookup yolu netlestirilmelidir.
- `REGION_MANAGER` icin iki magazalik pilot read/action scope davranisi implementation oncesi dogrulanmalidir; mevcut model role read scope ve action-store scope'u ayri tutar.

Referans:

- `docs/superpowers/specs/2026-04-29-user-account-role-assignment-v1-design.md`

CODEX durust yorum:

- Bu is yeni bir daginik modul degil; master data promotion sonrasi dogal guvenlik halkasi.
- Keycloak'i degistirmek veya otomatik user provisioning acmak simdilik yanlis olurdu. Dogru V1, hazir Keycloak kullanicisini canli employee kaydina, tek role ve acik store scope'a baglamaktir.
- En kritik risk `REGION_MANAGER` iki magazalik pilot scope'unu fazla genisletmeden cozmektir. Bu uygulama planinda ilk dogrulanacak konudur.

Bu siradaki adim tamamlandi: `User Account / Role Assignment V1` implementation plani yazildi.

## Son User Account / Role Assignment V1 Implementation Plan

29 Nisan 2026 itibariyla pilot kullanici hesabi, rol ve magaza scope baglama isinin implementation plani hazirlandi.

Plan karari:

- `REGION_MANAGER` pilotta genis bolge read scope ile acilmayacak.
- Bunun yerine plan, `REGION_MANAGER` rolunun store-scoped dar assignment alabilmesi icin kontrollu scope-policy istisnasi onerir.
- Boylece 1 bolge muduru iki pilot magaza uzerinde gercek read/action scope ile test edilebilir.
- `VISUAL_MERCHANDISER` store-scoped yeni rol olarak eklenecek; V1'de VM checklist read siniri acilir ama BM/region-manager checklist mutation yetkisi verilmez.
- `ops.user_account.provider_subject` eklenerek Keycloak/OIDC `sub` degeri ic app `user_id` kaydina cozulur.
- HR_ADMIN icin `POST /api/auth/pilot-user-bindings` tek komutta employee, provider subject, rol ve store scope baglama akisi olarak planlandi.

Referans:

- `docs/superpowers/plans/2026-04-29-user-account-role-assignment-v1.md`

CODEX durust yorum:

- Plan dogru yerde duruyor: en riskli kisim olan region manager iki-magaza scope'u genisletilmeden cozuluyor.
- User account isi tek tek mevcut auth-admin cagri setiyle operatora birakilsa hata riski olurdu; tek HR/Admin binding command daha guvenli.
- Uygulama sirasinda ilk kirmizi test provider subject schema/auth resolution olmali; Keycloak automation, bulk rollout ve store personnel hesaplari hala kapali kalmali.

Siradaki mantikli adim: bu plani inline TDD ile uygulamak; once `provider_subject` schema contract ve JWT `sub` -> internal `user_account` cozumleme adimi ile baslamak.

## Onemli Dosyalar

Backend auth / scope:

- `backend/nestjs/src/modules/auth/providers/jwt-auth.provider.ts`
- `backend/nestjs/src/shared/app-config.service.ts`
- `backend/nestjs/src/shared/app-config.service.spec.ts`
- `backend/nestjs/src/modules/auth/decorators/roles.decorator.ts`
- `backend/nestjs/src/modules/auth/decorators/scope.decorator.ts`
- `backend/nestjs/src/modules/auth/auth-authorization.repository.ts`
- `backend/nestjs/src/modules/auth/auth-admin.repository.ts`
- `backend/nestjs/src/modules/auth/auth-admin.service.ts`
- `backend/nestjs/src/modules/auth/web/auth-admin.controller.ts`
- `db/migrations/020_user_action_store_assignments.sql`

Backend database / migration:

- `backend/nestjs/src/shared/database/migration.service.ts`
- `backend/nestjs/src/shared/database/migration.service.spec.ts`
- `backend/nestjs/src/shared/database/migrations.controller.ts`
- `backend/nestjs/src/shared/database/migrations.controller.spec.ts`
- `backend/nestjs/src/shared/database/migration-cli-contract.spec.ts`
- `backend/nestjs/src/shared/database/migration-schema-contract.spec.ts`
- `backend/nestjs/scripts/run-migrations.ts`
- `db/migrations/035_schema_migration_tracking.sql`

Backend security / http:

- `backend/nestjs/src/shared/http/configure-http-security.ts`
- `backend/nestjs/src/shared/http/cors-allowlist.middleware.ts`
- `backend/nestjs/src/shared/http/rate-limit.middleware.ts`
- `backend/nestjs/src/shared/http/standard-error.filter.ts`
- `backend/nestjs/src/shared/http/standard-error-response.ts`
- `backend/nestjs/test/integration/production-security-gate.e2e-spec.ts`

Backend audit:

- `backend/nestjs/src/shared/audit/audit-event-catalog.ts`
- `backend/nestjs/src/shared/audit/audit-event-catalog.spec.ts`
- `backend/nestjs/src/shared/audit/audit-event.mapper.ts`
- `backend/nestjs/src/shared/audit/audit-metadata.factory.ts`

Store ops:

- `backend/nestjs/src/modules/store-ops/web/checklist.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/admin-checklist-template.controller.ts`
- `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
- `backend/nestjs/src/modules/store-ops/application/checklist.contract.ts`
- `backend/nestjs/src/modules/store-ops/checklist-acknowledgement-schema-contract.spec.ts`
- `backend/nestjs/src/modules/store-ops/checklist-mobile-workflow-schema-contract.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/checklist-acknowledgement.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/checklist-acknowledgement.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- `backend/nestjs/src/modules/store-ops/application/competition.service.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage-package.dto.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage-package-plan.dto.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/review-competition-stage-package-plan.dto.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/update-competition-stage-package-plan.dto.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/clone-competition-team-template.dto.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/list-competition-team-templates.query.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/update-competition-team-template.dto.ts`
- `backend/nestjs/src/modules/store-ops/web/target-distribution.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/list-target-coverage.query.ts`
- `backend/nestjs/src/modules/store-ops/application/target-distribution.service.ts`
- `backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.contract.ts`
- `backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.service.ts`
- `backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.service.spec.ts`
- `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts`
- `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`
- `backend/nestjs/src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/target-reference-schema-contract.spec.ts`

Backend integration / ingest:

- `backend/nestjs/src/modules/integration/application/import-data-quality.ts`
- `backend/nestjs/src/modules/integration/application/import-data-quality.spec.ts`
- `backend/nestjs/src/modules/integration/application/integration.service.ts`
- `backend/nestjs/src/modules/integration/application/kpi-import-normalization.service.ts`
- `backend/nestjs/src/modules/integration/application/materialization.service.ts`
- `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts`
- `backend/nestjs/src/modules/integration/source-agnostic-ingest-schema-contract.spec.ts`
- `backend/nestjs/src/modules/integration/web/integration.controller.ts`
- `backend/nestjs/test/integration/import-batch.e2e-spec.ts`
- `db/migrations/010_checklist_acknowledgements.sql`
- `db/migrations/027_kpi_raw_lineage_columns.sql`
- `db/migrations/039_target_reference_control_surface_v1.sql`
- `db/schema.sql`

Frontend:

- `admin-web/src/App.tsx`
- `admin-web/src/features/auth/api.ts`
- `admin-web/src/features/targets/api.ts`
- `admin-web/src/features/competitions/api.ts`
- `admin-web/src/features/competitions/StageBuilderForm.tsx`
- `admin-web/src/features/competitions/stage-packages.ts`
- `admin-web/src/features/competitions/stage-presets.ts`
- `admin-web/src/pages/AuthDashboardPage.tsx`
- `admin-web/src/pages/CompetitionDashboardPage.tsx`
- `admin-web/src/pages/ImportBatchDetailPage.tsx`
- `admin-web/src/pages/AuthActionStoreAssignmentAuditPage.tsx`
- `admin-web/src/features/integrations/api.ts`
- `admin-web/e2e/integration-surfaces.spec.ts`
- `admin-web/src/pages/StoreShellPreviewPage.tsx`
- `admin-web/src/pages/StoreTasksPage.tsx`
- `admin-web/src/pages/StoreFeedPage.tsx`
- `admin-web/src/pages/StoreMyPerformancePage.tsx`
- `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- `admin-web/src/pages/TargetApprovalQueuePage.tsx`
- `admin-web/src/features/kpi/grading.ts`
- `admin-web/src/features/kpi/source-semantics.ts`
- `admin-web/src/features/reports/api.ts`
- `admin-web/e2e/admin-targets.spec.ts`
- `admin-web/e2e/kpi-benchmark-explainability.spec.ts`
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
- `docs/plans/source-agnostic-ingest-contract-hardening-v1.md`
- `docs/plans/kpi-raw-row-lineage-persistence-v1.md`
- `docs/plans/import-lineage-evidence-surface-v1.md`
- `docs/plans/audit-event-taxonomy-guard-v1.md`
- `docs/plans/data-quality-guard-v1.md`
- `docs/plans/import-batch-quality-summary-v1.md`
- `docs/plans/excel-kpi-import-v1.md`
- `docs/plans/excel-kpi-import-operator-runbook.md`
- `docs/plans/mobile-api-bff-endpoint-inventory-v1.md`
- `docs/superpowers/plans/2026-04-28-production-ready-migration-system-v1.md`
- `docs/superpowers/specs/2026-04-28-mobile-auth-session-v1-design.md`
- `docs/superpowers/specs/2026-04-28-mobile-checklist-today-v1-design.md`
- `docs/superpowers/plans/2026-04-28-mobile-checklist-today-v1.md`
- `docs/superpowers/specs/2026-04-29-checklist-store-score-integration-v1-design.md`
- `docs/superpowers/plans/2026-04-29-checklist-store-score-integration-v1.md`
- `docs/superpowers/specs/2026-04-29-kpi-benchmark-scoring-v1-design.md`
- `docs/superpowers/plans/2026-04-29-kpi-benchmark-scoring-v1.md`
- `docs/superpowers/specs/2026-04-29-kpi-benchmark-source-policy-v1-design.md`
- `docs/superpowers/specs/2026-04-29-target-reference-control-surface-v1-design.md`
- `docs/superpowers/plans/2026-04-28-mobile-auth-session-v1.md`
- `docs/superpowers/plans/2026-04-28-mobile-api-bff-endpoint-inventory-v1.md`
- `docs/plans/project-wide-scan-2026-04-27.md`
- `docs/plans/project-mvp-focus-map-2026-04-28.md`
- `docs/plans/no-empty-scope-repository-contract-pass-2026-04-27.md`
- `docs/plans/personnel-master-data-bootstrap-v1.md`
- `docs/plans/production-environment-readiness-checklist.md`
- `scripts/production-readiness-checklist-contract.test.mjs`
- `docs/plans/environment-variable-inventory.md`
- `docs/plans/deployment-runbook-skeleton.md`
- `scripts/deployment-runbook-contract.test.mjs`
- `docs/plans/production-staging-incident-response-skeleton.md`
- `scripts/incident-response-skeleton-contract.test.mjs`
- `docs/superpowers/plans/2026-04-26-daily-closure-ranking-v2-explainability.md`
- `docs/superpowers/plans/2026-04-25-competition-stage-package-plan-lifecycle-v1.md`
- `docs/superpowers/specs/2026-04-25-competition-stage-package-plan-lifecycle-v1-design.md`
- `docs/superpowers/plans/2026-04-25-competition-stage-package-plan-approval-v1.md`
- `docs/superpowers/specs/2026-04-25-competition-stage-package-plan-approval-v1-design.md`

## Son User Account / Role Assignment V1 Implementation

29 Nisan 2026 itibariyla pilot kullanici hesabi, rol ve store scope baglama akisi uygulandi.

Eklenenler:

- `ops.user_account.provider_subject` provider-subject mapping alani eklendi.
- JWT `sub` degeri internal app user lookup ile `ops.user_account.user_id` kaydina cozulur.
- `VISUAL_MERCHANDISER` store-scoped rol olarak eklendi.
- `REGION_MANAGER` pilotta store-scoped dar role assignment ile iki magazaya indirgenebilir hale geldi.
- HR/Admin `POST /api/auth/pilot-user-bindings` ile employee, provider subject, tek rol ve store scope baglar.
- Admin auth yuzeyinde pilot user binding paneli eklendi.

Dogrulama:

- Backend targeted auth/checklist tests: 6 suite, 53 test passed.
- Backend lint/build passed.
- Frontend lint/build passed.
- Frontend targeted Playwright auth admin test passed.
- Root `npm.cmd run check:release` passed.

CODEX durust yorum:

Bu parca pilotu guvenli acacak kapidir. Keycloak kimlik kapisi olarak kaldi; yetki ve scope bizim DB tarafinda izlenebilir hale geldi.

Siradaki mantikli adim: gercek pilot kullanicilari Keycloak'ta manuel olusturup HR_ADMIN yuzeyinden 1 bolge muduru, 2 magaza muduru ve 1 visual merchandiser baglama smoke'u yapmak.

## Son Pilot User Binding Smoke

29 Nisan 2026 itibariyla gercek lokal Keycloak kullanicilariyla pilot binding smoke'u yapildi.

Yapilanlar:

- Lokal DB migration seviyesi smoke oncesi duzeltildi; `audit.schema_migration` tracking 42 succeeded / 0 failed duruma getirildi.
- `024_competition_stage_package_plan_approval.sql` icindeki PostgreSQL reserved alias problemi giderildi.
- Keycloak'ta pilot kullanicilar olusturuldu/guncellendi:
  - `pilot.region.manager`
  - `pilot.store.manager.100`
  - `pilot.store.manager.ist002`
  - `pilot.vm`
- `admin.operator` Keycloak kullanicisi lokal DB'de `oidc/provider_subject` ile SUPER_ADMIN hesaba baglandi.
- HR/Admin pilot binding endpoint'i ile 4 binding olusturuldu.
- Audit kaniti: `pilot_user_binding.created` event sayisi 4.
- Pilot session smoke:
  - `pilot.region.manager`: 2 magaza scope.
  - `pilot.store.manager.100`: 1 magaza scope.
  - `pilot.store.manager.ist002`: 1 magaza scope.
  - `pilot.vm`: 2 magaza scope ve `VISUAL_MERCHANDISER` rol.
- Smoke icin gecici acilan Keycloak direct access grant tekrar kapatildi.

Dogrulama:

- `npm.cmd run db:migrate` -> tum migrationlar skip, failed yok.
- `/api/auth/pilot-user-bindings` -> 4 pilot binding created.
- `/api/auth/session` -> 4 pilot kullanicida provider subject internal user'a dogru cozuldu.

CODEX durust yorum:

- Bu smoke cok degerliydi; testlerde gecen akisin lokal gercek Keycloak + DB + audit kombinasyonunda da calistigini gosterdi.
- Yakalanan asil ders: lokal/prod benzeri auth smoke'larda token scope ve actor DB mapping mutlaka kontrol edilmeli. Aksi halde route yetkisi gecse bile audit FK katmaninda patlayabilir.
- UI'dan manuel smoke sonraki adim olabilir ama backend guvenlik zinciri artik pilot hesap acmak icin daha guvenilir.

Siradaki mantikli adim: admin-web uzerinden bu 4 pilot kullaniciyla tarayici smoke'u yapmak; ozellikle store manager store kisitlari, region manager 2-magaza gorunumu ve VM read-only checklist siniri gozle kontrol edilmeli.

## Son Pilot Browser Smoke

29 Nisan 2026 itibariyla admin-web uzerinden gercek Keycloak login akisiyle pilot tarayici smoke'u yapildi.

Kontrol edilenler:

- `pilot.store.manager.100`
  - Gercek PKCE login ile `/store` acildi.
  - Rol `STORE_MANAGER` olarak cozuldu.
  - Magaza scope yalniz `STORE100` (`00000000-0000-0000-0000-000000000100`) geldi.
  - `/admin/reports` dogrudan acilmaya calisildiginda `Route not available for this role` verdi.
- `pilot.region.manager`
  - Rol `REGION_MANAGER` olarak cozuldu.
  - Store preview icinde 2 magaza scope gorundu.
  - Landing `/admin/targets` olarak cozuldu.
  - `/admin/targets` yuzeyi acildi; action stores sayisi 2 olarak gorundu.
- `pilot.vm`
  - Rol `VISUAL_MERCHANDISER` olarak cozuldu.
  - Store preview icinde 2 magaza scope gorundu.
  - `/store/checklists` okuma/acknowledgement yuzeyi acildi.
  - BM checklist baslat/tamamla gibi mutation aksiyonlari gorunmedi.
  - `/admin/targets` dogrudan acilmaya calisildiginda `Route not available for this role` verdi.
- `pilot.store.manager.ist002`
  - Rol `STORE_MANAGER` olarak cozuldu.
  - Magaza scope yalniz `IST-002` (`20000000-0000-0000-0000-000000000002`) geldi.
  - `STORE100` bu oturumda gorunmedi.

CODEX durust yorum:

- Pilot auth/scope zinciri tarayicida da dogru calisiyor. DB smoke ile UI smoke birbirini dogruladi.
- V1 icin asil risk artik auth binding degil; store yuzeylerinin role gore hangi aksiyonlari gosterecegini daha net UI kontratlarina baglamak.
- VM icin okuma siniri dogru, ama VM checklist fazina gecmeden once `BM checklist` ve `VM checklist` template/action ayrimini tasarim dokumaniyla kilitlemek gerekir.

Siradaki mantikli adim: VM Checklist V1 icin hemen kodlamaya girmeden tasarim-intake yapmak; template type, role action, score katkisi, store manager gorunurlugu ve audit siniri netlestirilmeli.

## Son VM Checklist V1 Design

29 Nisan 2026 itibariyla VM Checklist V1 icin tasarim dokumani yazildi.

Dosya:

- `docs/superpowers/specs/2026-04-29-vm-checklist-v1-design.md`

Kilitlenen kararlar:

- VM kullanicilari personel-backed app user gibi dusunulecek.
- V1'de VM kullanicilari sadece checklist ile ilgili yuzeyleri gorecek.
- Pilot scope: 1 VM kullanicisi ve 2 atanmis magaza.
- Ileri asamada VM kullanicilarina tum magazalar atanabilir, ama kod tarafinda yine explicit assigned-store scope kullanilacak.
- VM checklist mevcut checklist motorunun icinde yeni template type olarak ilerleyecek: `VM_STORE_VISIT`.
- BM checklist type ayri kalacak: `BM_STORE_VISIT`.
- `VISUAL_MERCHANDISER`, atanmis magazalarda VM checklist baslatabilir, kaydedebilir, tamamlayabilir.
- `VISUAL_MERCHANDISER`, BM checklist baslatamaz/tamamlayamaz.
- `REGION_MANAGER`, V1'de VM checklist baslatamaz/tamamlayamaz.
- Store manager tamamlanmis VM checklist sonucunu gorur ve acknowledgement yapabilir.
- Store manager acknowledgement skora/reporting gecerliligine gate olmayacak.
- VM kullanicisi atanmis magazalarda hangi ay hangi magazaya VM checklist yapilmadi bilgisini gorebilecek.
- Eksik VM checklist otomatik 0 puan olmayacak; coverage gap olarak gorunecek.
- VM score katkisi aktif edildiginde hedef aylik blend: KPI `%90`, BM `%5`, VM `%5`.
- Tavsiye edilen uygulama siniri iki adim:
  - once VM checklist action enablement,
  - sonra VM score contribution activation.

CODEX durust yorum:

- Bu modulu ayri VM performans sistemi gibi buyutmek dagitir. En saglam yol checklist engine icinde role/type permission ile buyutmek.
- VM'ye genis admin/store erisimi vermeden sadece checklist aksiyonlari acmak dogru guvenlik siniri.
- Skor etkisini hemen acmak yerine once VM checklist kanitini pilotta gormek daha kontrollu olur.

Siradaki mantikli adim: VM Checklist V1 design dokumanini onaylayip implementation plan yazmak; ilk kod fazi sadece `VM_STORE_VISIT` template/action guard, checklist-only VM yuzeyi ve assigned-store coverage olmali.

## Son VM Checklist V1 Implementation Plan

29 Nisan 2026 itibariyla VM Checklist V1 icin implementation plan yazildi.

Dosya:

- `docs/superpowers/plans/2026-04-29-vm-checklist-v1.md`

Plan siniri:

- Bu plan sadece VM checklist action enablement fazidir.
- Skor katkisini KPI `%90`, BM `%5`, VM `%5` olarak aktif etmek bu fazda yoktur.
- Migration beklenmiyor; mevcut checklist engine `template_type` ile VM'yi tasiyacak.

Planlanan teknik isler:

- Backend mobile checklist mutasyonlarina `VISUAL_MERCHANDISER` role girisi acilacak.
- Her mutasyon backend'de 3 kapidan gececek:
  - role,
  - checklist template type,
  - assigned store scope.
- `VISUAL_MERCHANDISER` yalniz `VM_STORE_VISIT` mutasyonu yapabilecek.
- `REGION_MANAGER` V1'de yalniz `BM_STORE_VISIT` mutasyonu yapabilecek.
- Mobile checklist read model role gore BM/VM template type filtreleyecek.
- Frontend store shell VM icin checklist-only davranacak.
- `/store/checklists` VM icin assigned-store coverage ve missing VM checklist durumunu gosterecek.
- Store manager tamamlanmis VM checklist sonucunu acknowledgement olarak gorebilecek.

CODEX durust yorum:

- Kontrol burada backend permission tarafinda; UI gizlemek tek basina guvenlik degil.
- Bu plan VM'yi ayri module cevirmeden mevcut checklist motoruna bagliyor, bu dogru ve borcsuz yol.
- Skor katkisini ikinci faza birakmak pilot kanitini gormemizi saglar.

Siradaki mantikli adim: bu plan onaylandiktan sonra implementation'a gecmek; once backend role/type/scope testleri kirmizi-yesil kapatilacak, sonra frontend checklist-only VM yuzeyi eklenecek.

## Son VM Checklist V1 Implementation

29 Nisan 2026 itibariyla VM Checklist V1 action enablement uygulandi.

Eklenenler:

- `VISUAL_MERCHANDISER` checklist-only store yuzeyine yonlenir.
- VM kullanicisi atanmis magazalarda `VM_STORE_VISIT` checklist baslatabilir, kaydedebilir ve tamamlayabilir.
- VM kullanicisi `BM_STORE_VISIT` mutasyonu yapamaz.
- `REGION_MANAGER` V1'de `VM_STORE_VISIT` mutasyonu yapamaz.
- Mobile checklist read model role gore BM/VM template type filtreler.
- Store manager tamamlanmis VM checklist sonucunu acknowledgement olarak gorebilir.
- `/store/checklists` VM icin atanmis magaza x VM template coverage satirlarini ve yapilmadi durumunu gosterir.

Dogrulama:

- Backend targeted mobile/auth/repository testleri gecti: 53/53.
- Backend checklist service unit testi gecti: 14/14.
- Backend build gecti.
- Frontend build gecti.
- Frontend checklist e2e gecti: 3/3.
- Root `check:release` gecti:
  - script testleri: 46/46,
  - backend: 73 suite / 464 test,
  - frontend e2e: 43/43,
  - audit: 0 vulnerability.

CODEX durust yorum:

- VM checklist dogru sekilde mevcut checklist motoruna baglandi; ayri modul borcu acilmadi.
- Guvenlik siniri backend role/type/scope katmaninda kilitlendi, UI sadece bunun gorunur yuzeyi oldu.
- Skor katkisi bilincli olarak ikinci fazda bekletildi. Once pilotta VM checklist kaniti gorecegiz.

Siradaki mantikli adim: pilot VM kullanicisi ile tarayici smoke yapmak; sonra VM score contribution activation icin KPI `%90`, BM `%5`, VM `%5` blend planina gecmek.

## Son VM Checklist Browser Smoke

29 Nisan 2026 itibariyla `pilot.vm` kullanicisi ile gercek Keycloak login uzerinden VM checklist tarayici smoke'u yapildi.

Hazirlik:

- Lokal DB'de `pilot.vm` iki magazaya atanmis durumda dogrulandi:
  - `IST-002` / Istanbul Besiktas,
  - `STORE100` / IstinyePark Demo Store.
- Lokal DB'de yayinlanmis `VM_STORE_VISIT` sablonu olmadigi icin sadece smoke amacli idempotent `VM_VISIT_SMOKE_V1` sablonu olusturuldu.
- Bu bir kod degisikligi degil; lokal pilot veri hazirligidir.

Kontrol edilenler:

- `pilot.vm` gercek PKCE login ile `/store/checklists` yuzeyine dustu.
- Oturum `VISUAL_MERCHANDISER` rolunu ve 2 store scope'u dogru cozdu.
- VM store shell genis linkleri gostermedi: admin raporlari, duyurular ve yarismalar yok.
- `/store` dogrudan acildiginda `/store/checklists` yuzeyine yonlendi.
- `/store/feed` dogrudan acildiginda `Route not available for this role` verdi.
- `/admin/targets` dogrudan acildiginda `Route not available for this role` verdi.
- Istanbul Besiktas icin VM checklist baslatildi.
- Tek VM puan maddesi `5/5` olarak kaydedildi.
- Checklist tamamlandi ve ekranda `1 VM checklist tamamlandi`, `1 ziyaret / 100 ort.` gorundu.
- DB kaniti:
  - `template_code`: `VM_VISIT_SMOKE_V1`,
  - `template_type`: `VM_STORE_VISIT`,
  - `status`: `completed`,
  - `total_score`: `100.00`,
  - `compliance_rate`: `1.0000`,
  - `response_count`: `1`.

CODEX durust yorum:

- VM Checklist V1 gercek tarayici + gercek Keycloak + gercek DB zincirinde calisti.
- Kod tarafindaki izin siniri dogru: VM kullanici checklist disindaki store/admin yuzeylerine gecemiyor.
- Eksik kalan bilincli faz: VM checklist skoru henuz magaza skor blend'ine bagli degil. Bu sonraki kontrollu plan olmali.

Siradaki mantikli adim: VM score contribution activation tasarimini yazmak; KPI `%90`, BM `%5`, VM `%5` aylik blend davranisini migration/test/rapor etkileriyle kilitlemek.

## Son VM Score Contribution Activation V1 Design

29 Nisan 2026 itibariyla VM score contribution activation icin tasarim dokumani yazildi.

Dosya:

- `docs/superpowers/specs/2026-04-29-vm-score-contribution-activation-v1-design.md`

Kilitlenen karar:

- VM skor etkisi yalniz aylik store score icin olacak.
- Aktif tam blend: KPI `%90`, BM `%5`, VM `%5`.
- Eksik BM veya VM checklist sifir sayilmayacak.
- Eksik checklist agirligi KPI tarafina geri donecek.
- BM var VM yoksa KPI `%95`, BM `%5`, VM `%0`.
- BM yok VM varsa KPI `%95`, BM `%0`, VM `%5`.
- Ikisi de yoksa KPI `%100`.
- Completed low checklist skora kucuk agirlikla yansir; aksi halde checklistin skor anlami kalmaz.
- Store manager acknowledgement score inclusion gate degildir.
- Configured ve effective weights API'da acik gosterilmeli.

CODEX durust yorum:

- Bu karar checklist yapilmayan magazayi cezalandirmiyor, ama checklist yapilan magazadaki kalite kanitini de anlamsizlastirmiyor.
- Risk kullanici algisinda; bu yuzden UI mutlaka katkida neyin dahil/neye geri dondugunu gostermeli.
- Bu faz kucuk ama kritik: skora guven icin matematik kadar aciklama da gerekiyor.

Siradaki mantikli adim: bu tasarimi implementation plan'a cevirmek; once store-score-blend contract testleriyle kirmizi-yesil ilerlemek.

## Son VM Score Contribution Activation V1 Implementation Plan

29 Nisan 2026 itibariyla VM score contribution activation icin implementation plani yazildi.

Dosya:

- `docs/superpowers/plans/2026-04-29-vm-score-contribution-activation-v1.md`

Plan siniri:

- Bu plan VM checklist skorunu aylik store score breakdown icine aktif baglar.
- Full configured blend KPI `%90`, BM `%5`, VM `%5` olur.
- Eksik BM/VM checklist sifir sayilmaz; eksik pay KPI tarafina geri doner.
- Backend configured/effective weights ve missing reason doner.
- Frontend backend sonucunu gosterir; skor hesabini frontend yapmaz.
- Migration, auth/session, checklist permission ve daily score yuzeylerine dokunulmaz.

Planlanan teknik isler:

- `StoreScoreBlendService` contract ve unit testleri VM aktif hale getirilecek.
- Reporting service BM ve VM checklist snapshotlarini template type ile ayri okuyacak.
- Store KPI kapali snapshot yuzeyi BM/VM katkisini ve eksik payin KPI tarafinda kaldigini aciklayacak.
- Targeted backend/frontend testleri, build ve root `check:release` release kapisi olacak.

CODEX durust yorum:

- Plan dogru sirada: once saf skor matematigi, sonra reporting entegrasyonu, en son UI aciklamasi.
- Bu is kucuk gorunur ama skor guveni icin kritik; kullaniciya configured ve effective agirliklari gostermeden bu ozelligi acmak yanlis anlasilma riski yaratirdi.

Siradaki mantikli adim: implementation'a gecmek; once `store-score-blend.service.spec.ts` kirmizi testleri yazip saf skor motorunu yesile almak.

## Son VM Score Contribution Activation V1 Implementation

29 Nisan 2026 itibariyla VM checklist skoru aylik store score breakdown icine aktif baglandi.

Eklenenler:

- Aylik store score configured blend KPI `%90`, BM `%5`, VM `%5` oldu.
- Eksik BM veya VM checklist sifir sayilmiyor.
- Eksik checklist agirligi KPI tarafina geri donuyor.
- BM ve VM checklist snapshotlari template type ile ayri okunuyor.
- Backend score breakdown `missingWeightPolicy`, configured/effective weights ve missing reason donuyor.
- Store KPI kapali snapshot yuzeyi BM/VM katkisini, configured/effective blend bilgisini ve eksik payin KPI tarafinda kaldigini acikliyor.
- Store surface regresyon testi BM ve VM eksik checklist metinlerini ayri okuyacak sekilde netlestirildi.

Dogrulama:

- Backend targeted score tests: 2 suite / 8 test passed.
- Backend build passed.
- Frontend targeted KPI explainability e2e: 3 test passed.
- Frontend store surface e2e: 12 test passed.
- Frontend build passed.
- Root `npm.cmd run check:release` passed:
  - root script tests: 46/46,
  - backend: lint + 73 suite / 467 test + build + audit 0 vulnerability,
  - frontend: lint + script tests + build + 44 Playwright test + audit 0 vulnerability.

CODEX durust yorum:

- Bu adim checklisti cezaya cevirmeden skora anlamli sekilde bagladi.
- En kritik kazanc, magaza kullanicisinin configured ve effective agirligi ayni ekranda gorebilmesi.
- Bundan sonra asil risk matematik degil, UI dilinin kullanicida yanlis ceza algisi yaratmasidir; bu yuzden copy sade tutuldu.

Siradaki mantikli adim: pilot veride BM/VM checklist olan ve olmayan magazalarla tarayici smoke yapmak; skor kiriliminin kullanici tarafinda anlasilir olup olmadigini gozle kontrol etmek.

## Son VM Score Contribution Pilot Smoke

29 Nisan 2026 itibariyla VM score contribution icin pilot smoke yapildi.

Hazirlik:

- `rpt.generate_store_checklist_snapshot('00000000-0000-0000-0000-00000000f301', '2026-04-01', '2026-04-30')` lokal Nisan snapshot'i icin calistirildi.
- `rpt.store_checklist_snapshot` kaniti:
  - `STORE100`: BM checklist `audit_count=2`, `avg_score=90.00`.
  - `IST-002`: VM checklist `audit_count=1`, `avg_score=100.00`.
- Tarayicida gercek Keycloak login ile `pilot.store.manager.100` acildi; rol `STORE_MANAGER`, store scope yalniz `STORE100` olarak gorundu.
- In-app browser date input siniri nedeniyle f301 secimi UI'da tam otomatiklestirilemedi; API smoke gercek JWT ile tamamlandi.
- Smoke icin Keycloak direct access grant kisa sureli acilip token alindi, her denemeden sonra tekrar `directAccessGrantsEnabled=false` durumuna kapatildi.

Dogrulanan acceptance'lar:

- `pilot.store.manager.100` + `STORE100`:
  - total score `34.9`.
  - configured weights `90/5/5`.
  - effective weights `95/5/0`.
  - KPI score `32`, KPI contribution `30.4`.
  - BM checklist dahil: score `90`, visit count `2`, contribution `4.5`.
  - VM checklist dahil degil: missing reason `vm_checklist_not_completed_for_period`.
- `pilot.store.manager.ist002` + `IST-002`:
  - total score `5`.
  - configured weights `90/5/5`.
  - effective weights `95/0/5`.
  - VM checklist dahil: score `100`, visit count `1`, contribution `5`.
  - BM checklist dahil degil: missing reason `bm_checklist_not_completed_for_period`.
- Scope guard:
  - `pilot.store.manager.ist002` ile `STORE100` skor kirilimi okunmaya calisildiginda `403 FORBIDDEN` dondu.
  - Error message: `Store score breakdown is outside current store scope.`

CODEX durust yorum:

- Matematik ve scope kapisi pilot veride calisiyor; STORE100 ve IST-002 iki farkli checklist senaryosunu net kanitladi.
- UI tarafinda date input otomasyon siniri canli kullanici hatasi degil, in-app browser runtime siniri gibi duruyor; yine de ileride kapali snapshot secimini daha belirgin select/list yapisina almak UX'i guclendirir.
- Bu smoke sonrasi VM score contribution borcu teknik olarak kapanmis sayilir; kalan iyilestirme, skor kiriliminin son kullanici dilini pilot geri bildirimle parlatmak.

Siradaki mantikli adim: Store KPI kapali snapshot secim UX'ini sade bir snapshot listesi/select yapisina cevirmeyi planlamak; boylece kullanici date yazmak zorunda kalmadan kapanmis gun/ay secip skor kirilimini gorebilir.

## Son Store KPI Snapshot Selector UX V1

29 Nisan 2026 itibariyla Store KPI kapali snapshot secimi date input'tan snapshot listesine alindi.

Eklenenler:

- `/store/kpis` kapali mod artik daily snapshot run listesini `limit=30` ile ceker.
- Kullanici tarih yazmak yerine `Kapanmis KPI snapshot secimi` combobox'undan kapanmis snapshot secer.
- Varsayilan gorunum en guncel snapshot run'dir.
- Secilen snapshot'in `snapshotRunId` degeri hem KPI rows hem store score breakdown sorgusunda kullanilir.
- `Son kapanmis gune don` butonu secimi temizleyip en guncel snapshot'a geri dondurur.
- Eski date input ve tarih bazli no-snapshot state kaldirildi.

Dogrulama:

- TDD kirmizi test: yeni snapshot combobox testi once beklenen sekilde dustu.
- Frontend targeted explainability e2e: 4 test passed.
- Frontend lint passed.
- Frontend store surface e2e: 12 test passed.
- Frontend `npm.cmd run check:release` passed:
  - lint,
  - script tests 7/7,
  - build,
  - 45 Playwright test,
  - audit 0 vulnerability.
- In-app browser smoke:
  - `pilot.store.manager.100` ile gercek Keycloak login acildi.
  - `/store/kpis` kapali modda snapshot combobox gorundu.
  - `20 Nis 2026 - 1 Nis 2026 / 30 Nis 2026` snapshot'i secildi.
  - STORE100 BM checklist katkisi gorundu: `2 BM checklist yapildi`, `BM checklist katkisi 4,50`, `Effective 95/5/0`.

CODEX durust yorum:

- Bu ufak UX degisikligi teknik olarak onemli: kullanici artik tarih formatini tahmin etmiyor, sistemin gercek kapanmis snapshot kaydini seciyor.
- Score breakdown tarafinda yanlis run'a bakma riski azaldi; f301 gibi aylik gorunumlu daily snapshot'lar da kullaniciya secilebilir oldu.
- Sonraki UI iyilestirmesinde option metnini daha urun diliyle yazmak iyi olur: `20 Nis kapanisi - Nisan aylik snapshot` gibi.

Siradaki mantikli adim: Store KPI snapshot option metinlerini ve kapali/live copy'sini tamamen urun diline cekmek; ardindan bu snapshot secim desenini `/store/me` ve `/store/rankings` gibi kapali veri secen ekranlara da kontrollu yaymak.

## Son Store KPI Snapshot Option Copy V1

29 Nisan 2026 itibariyla Store KPI kapali snapshot secim metinleri urun diline cekildi.

Eklenenler:

- Snapshot option metni teknik tarih araligi yerine kullanici diliyle yaziliyor.
- Ornekler:
  - `24 Nis 2026 kapanisi - gunluk snapshot`
  - `20 Nis 2026 kapanisi - Nisan aylik snapshot`
- Tek gunluk snapshot'lar `gunluk snapshot` olarak etiketleniyor.
- Tam ay snapshot'lari ay adiyla `Nisan aylik snapshot` gibi etiketleniyor.
- ISO/UTC tarih alanlari local date-only normalize edilerek okundu; boylece `2026-03-31T21:00:00.000Z` gibi DB kaynakli degerler UI'da onceki gune kaymiyor.
- Fallback olarak karmasik araliklar hala `baslangic - bitis snapshot` seklinde gosteriliyor.

Dogrulama:

- TDD kirmizi test: yeni option label beklentisi once mevcut UI'da dustu.
- Frontend targeted explainability e2e: 4 test passed.
- Frontend `npm.cmd run check:release` passed:
  - lint,
  - script tests 7/7,
  - build,
  - 45 Playwright test,
  - audit 0 vulnerability.
- In-app browser smoke:
  - `pilot.store.manager.100` ile `/store/kpis` acildi.
  - Kapali mod combobox'unda `24 Nis 2026 kapanisi - gunluk snapshot`, `23 Nis 2026 kapanisi - gunluk snapshot`, `22 Nis 2026 kapanisi - gunluk snapshot`, `20 Nis 2026 kapanisi - Nisan aylik snapshot` goruldu.

CODEX durust yorum:

- Bu is kucuk gorunuyor ama kullanici guveni icin degerli; tarih araligi okumak yerine kapanis tipini anliyor.
- UTC/local tarih kaymasini burada yakalamak iyi oldu; aksi halde aylik snapshot UI'da yanlis ay gibi gorunebilirdi.
- Simdilik helper sayfa icinde tutuldu; ayni desen `/store/me` ve `/store/rankings` tarafina yayilmadan once ortak helper'a cekmek daha temiz olur.

Siradaki mantikli adim: Snapshot label/selection helper'ini ortak bir frontend utility haline getirip, ayni kapali snapshot secim desenini once `/store/me`, sonra `/store/rankings` ekranina kontrollu yaymak.

## Son Snapshot Selector Pattern Yayilimi V1

30 Nisan 2026 itibariyla kapali snapshot secim deseni `/store/me` ve `/store/rankings` ekranlarina yayildi.

Eklenenler:

- Snapshot option metni `admin-web/src/features/reports/snapshot-labels.ts` icinde ortak helper'a alindi.
- `/store/kpis` artik ayni ortak helper'i kullaniyor; sayfa icindeki tekrar eden tarih/period label kodu kaldirildi.
- `/store/me` kapali modda ham tarih secmek yerine snapshot run listesinden okunur label gosteriyor.
- `/store/me` secimi UI'da `snapshotRunId` ile tutuluyor, backend `my-performance` cagrisi icin ilgili `snapshotDate` gonderiliyor.
- `/store/rankings` gunluk modda manuel date input yerine snapshot select kullaniyor.
- `/store/rankings` aylik mod mevcut month input davranisini koruyor; gunluk snapshot listesi hata verirse aylik modu gereksiz yere dusurmeyecek sekilde izole edildi.
- E2E testleri `/store/me` ve `/store/rankings` icin okunur snapshot option label beklentisini ekledi.

Dogrulama:

- TDD kirmizi test: `/store/me` ve `/store/rankings` snapshot label beklentileri once beklenen sekilde dustu.
- Frontend build passed.
- Frontend targeted store surface e2e: 13 test passed.
- Frontend targeted KPI explainability e2e: 4 test passed.
- Frontend `npm.cmd run check:release` passed:
  - lint,
  - script tests 7/7,
  - build,
  - 46 Playwright test,
  - audit 0 vulnerability.

CODEX durust yorum:

- Bu yayilim UI'nin goz alici tarafindan cok, guven tarafini guclendirdi; kullanici artik kapanmis veride elle tarih tahmin etmiyor.
- Ranking aylik modunu simdilik bozmadik; aylik snapshot secimini ayri tasarlamak daha dogru olur.
- Ortak helper sayesinde bundan sonra snapshot label metnini tek yerden degistirebiliriz.

Siradaki mantikli adim: `/store/rankings` icin aylik snapshot secimini ayri ele almak; once backend'in aylik leaderboard kaynagini periodStart mi snapshotRunId mi uzerinden kilitleyecegimize karar verip sonra UI'yi yaymak.

## Son Ranking Monthly Snapshot Selector V1

30 Nisan 2026 itibariyla `/store/rankings` aylik secim deseni netlestirildi.

Karar:

- Aylik ranking tek bir `snapshotRunId` uzerinden kilitlenmeyecek.
- Backend mevcut tasarimi geregi aylik ranking'i secilen ay icindeki tamamlanmis gunluk snapshot'lardan topluyor.
- Bu yuzden UI'da aylik mod, manuel month input yerine "kapanisi olan ay" select'i kullanacak.

Eklenenler:

- Snapshot label helper'a ay bazli fonksiyonlar eklendi:
  - `getSnapshotMonthStart`
  - `formatSnapshotMonthOptionLabel`
- `/store/rankings` snapshot run listesini gunluk ve aylik mod icin ortak okuyor.
- Gunluk mod mevcut snapshot select davranisini koruyor.
- Aylik mod artik kapanisi olan ay listesi gosteriyor.
- Ornek option: `Nisan 2026 aylik kapanis - son kapanis 24 Nis 2026`.
- Aylik leaderboard cagrisi `periodStart=YYYY-MM-01` ile yapiliyor; backend o ayin tamamlanmis gunluk snapshot'larini topluyor.
- `Bu ay` butonu yerine `Son aylik kapanisa don` davranisi eklendi.

Dogrulama:

- TDD kirmizi test: aylik snapshot option beklentisi once mevcut UI'da dustu.
- Frontend build passed.
- Frontend targeted store surface e2e: 13 test passed.
- Frontend `npm.cmd run check:release` passed:
  - lint,
  - script tests 7/7,
  - build,
  - 46 Playwright test,
  - audit 0 vulnerability.
- Ilk release kosusunda lint warning goruldu; `availableSnapshotRuns` referansi `useMemo` ile sabitlenerek tekrar kosuldu ve warning kapandi.

CODEX durust yorum:

- Bu karar dogru: aylik ranking bir snapshot secimi degil, "ay icindeki kapanmis gunler" okumasidir.
- UI artik backend matematigini kullaniciya daha dogru temsil ediyor; elle ay yazma riski azaldi.
- Henuz yapmadigimiz kisim: aylik secimde hangi gunlerin dahil oldugunu tek tek gosteren "kapanis gunleri kaniti" paneli.

Siradaki mantikli adim: `/store/rankings` aylik gorunumune dahil edilen kapanis gunleri kaniti eklemek; kullanici ay skorunun hangi gunlerden geldigini gorebilsin.

## Son Ranking Monthly Closure Evidence V1

30 Nisan 2026 itibariyla `/store/rankings` aylik gorunumune kapanis gunleri kanit paneli eklendi.

Eklenenler:

- Aylik ranking modunda `Aylik kapanis gunleri kaniti` paneli gorunuyor.
- Panel secili ay icindeki tamamlanmis gunluk snapshot run'lari listeliyor.
- Her gun icin:
  - snapshot tarihi,
  - snapshot run id,
  - donem,
  - run status,
  - generatedBy bilgisi gosteriliyor.
- Panel o ay icin kac kapanmis gunun dahil oldugunu yaziyor.
- `/store/rankings` snapshot run listesi `limit=90` ile cekiliyor; boylece aylik kanit paneli tek aya sikismadan daha fazla kapanis gunu gorebiliyor.
- Store surface fixture Nisan icin iki kapanmis gunle guncellendi: `23 Nis 2026` ve `24 Nis 2026`.

Dogrulama:

- TDD kirmizi test: aylik kanit paneli beklentisi once mevcut UI'da dustu.
- Frontend build passed.
- Frontend targeted store surface e2e: 13 test passed.
- Frontend `npm.cmd run check:release` passed:
  - lint,
  - script tests 7/7,
  - build,
  - 46 Playwright test,
  - audit 0 vulnerability.

CODEX durust yorum:

- Bu panel aylik ranking guvenini ciddi artiriyor; kullanici artik "bu ay skoru nereden geldi" sorusunun cevabini ekranda goruyor.
- Hala frontend tarafindaki snapshot run listesine dayaniyor; daha ileri asamada backend response'a `includedSnapshotRuns` gibi resmi bir alan eklemek daha da saglam olur.
- Su an icin V1 yeterince kontrollu: yeni skor motoru yok, yeni matematik yok, sadece mevcut kaynagin kaniti var.

Siradaki mantikli adim: aylik ranking kanitini backend contract seviyesine tasimayi planlamak; `GET /reports/leaderboards/closed` response'una dahil edilen snapshot gunlerini resmi alan olarak ekleyip frontend tahminini kaldirmak.

## Son Ranking Included Snapshot Contract V1

30 Nisan 2026 itibariyla aylik ranking kaniti backend kontratina tasindi.

Eklenenler:

- `GET /reports/leaderboards/closed` cevabina `includedSnapshotRuns` alani eklendi.
- Gunluk ranking cevabi 1 adet kapanmis snapshot kaniti donuyor.
- Aylik ranking cevabi secili ay icinde hesaplamaya dahil edilen tum tamamlanmis gunluk snapshot'lari donuyor.
- `includedSnapshotRuns` alaninda:
  - snapshot run id,
  - snapshot tarihi,
  - snapshot type,
  - donem,
  - run status,
  - generatedAt,
  - generatedBy bilgisi var.
- `/store/rankings` aylik kanit paneli artik frontend'in snapshot listesinden tahmin yapmiyor; resmi leaderboard response alanini okuyor.
- E2E fixture bilerek snapshot listesinde sadece son gunu birakti, backend response icinde 2 gun dondu; boylece UI'nin resmi kontrata baglandigi testlendi.

Dogrulama:

- Backend TDD kirmizi test: `includedSnapshotRuns` alan yokken `reporting.e2e-spec.ts` beklenen sekilde dustu.
- Backend targeted reporting e2e passed: 10 test passed.
- Backend build passed.
- Frontend TDD kirmizi test: snapshot listesinde tek gun varken aylik kanit 2 gun bekledigi icin mevcut UI beklenen sekilde dustu.
- Frontend build passed.
- Frontend targeted store surface e2e passed: 13 test passed.
- Backend `npm.cmd run check:release` passed:
  - lint,
  - 73 test suite / 467 test,
  - build,
  - audit 0 vulnerability.
- Frontend `npm.cmd run check:release` passed:
  - lint,
  - script tests 7/7,
  - build,
  - 46 Playwright test,
  - audit 0 vulnerability.
- Root `npm.cmd run check:release` passed:
  - root script tests 46/46,
  - backend release gate,
  - frontend release gate.

CODEX durust yorum:

- Bu borc kapandi: aylik ranking kaniti artik UI varsayimi degil, backend'in resmi aciklamasi.
- Bu, ileride mobil BFF ve raporlama ekranlari icin de daha saglam bir kontrat demek.
- Release kapilari temiz: bu adimdan sonra bilerek acik test veya build borcu birakilmadi.

Siradaki mantikli adim: aylik ranking icin store/personel skor kurallarini ayni resmi kaynaklardan belgelemek; ozellikle hangi metriklerin Turkiye ortalamasi, hedef ve checklist kaynagindan skorlandigini tek yerde toplamak.

## Son Monthly Ranking Score Source Contract V1

30 Nisan 2026 itibariyla aylik ranking ve aylik score kaynak kurallari tek dokumanda toplandi.

Referans:

- `docs/plans/monthly-ranking-score-source-contract-v1.md`

Kilitlenen kararlar:

- `GET /reports/leaderboards/closed` ve `includedSnapshotRuns` aylik ranking kanitinin resmi kaynagidir.
- Frontend snapshot listesi ay secimi icin kullanilabilir, ancak ay icine dahil edilen gunleri tahmin edemez.
- Personel aylik ana skoru `rpt.employee_performance_snapshot.score_value` uzerinden kapanmis gun ortalamasidir.
- Personel hedef skoru `TARGET`, ATV ve UPT ise `TURKEY_AVERAGE` kaynagindan skorlanir.
- Personel ranking V1 checklist metriği icermez.
- Store score hedef, CR, ATV, UPT, BM checklist ve VM checklist kaynaklarini tek tabloda aciklar.
- BM/VM checklist eksikse `missingWeightPolicy: return_missing_weight_to_kpi` davranisi ile eksik checklist store'u cezalandirmaz.
- PowerBI Turkiye ortalamasi satirlari skor kaynagi degil, reconciliation evidence olarak kalir.

Dogrulama:

- TDD kirmizi test: `scripts/monthly-ranking-score-source-contract.test.mjs` once dokuman olmadigi icin beklenen sekilde dustu.
- Targeted guard test passed: `scripts/monthly-ranking-score-source-contract.test.mjs` 4/4.
- Root `npm.cmd run check:release` passed:
  - root script tests 50/50,
  - backend release gate passed: lint, 73 test suite / 467 test, build, audit 0 vulnerability,
  - frontend release gate passed: lint, script tests, build, 46 Playwright test, audit 0 vulnerability.

CODEX durust yorum:

- Bu adim yeni koddan cok kontrol kaybi riskini kapatti.
- Artik skorun nereden geldigini ekran ekran anlatmak yerine tek resmi karar dosyasina baglayabiliriz.
- Bu, ileride mobil BFF, VM checklist aktivasyonu ve turnuva/challenge skor kurgulari icin dagilmayi azaltir.

Siradaki mantikli adim: bu kontrati store ranking ve KPI aciklama metinlerine referans olacak sekilde kullanmak; skor matematigini degistirmeden kullaniciya "bu puan nereden geldi" dilini sade tutmak.

## Son Ranking Score Explanation Copy V1

30 Nisan 2026 itibariyla aylik ranking skor kaynak kontrati store yuzeylerine kullanici dili olarak baglandi.

Degisen frontend yuzeyleri:

- `/store/rankings`
- `/store/kpis`

Kilitlenen gorunur dil:

- Personel ana skoru kapanmis gunlerdeki total score ortalamasidir.
- Personel hedefi `TARGET`, ATV ve UPT ise `TURKEY_AVERAGE` kaynagindan puanlanir.
- Checklist personel ranking V1 icinde puan kaynagi degildir.
- Aylik kanit backend `includedSnapshotRuns` alanindan gelir.
- Magaza hedefi `TARGET`, CR/ATV/UPT `TURKEY_AVERAGE`, BM/VM checklist ise `CHECKLIST_SCORE` mantigina baglidir.
- BM/VM checklist tamamlanmadiysa magaza ceza yemez; pay KPI tarafinda kalir.
- Gercek oran `%120` uzerinde olsa da skor katkisi `%120` cap ile hesaplanir.
- Import edilen Turkiye ortalamasi/ozet satirlari kontrol kanitidir; skor referansini sistem kendi kapsamindan hesaplar.

Dogrulama:

- TDD kirmizi test: `admin-web/e2e/store-surfaces.spec.ts` uc beklentide once metin yok diye dustu.
- Targeted Playwright passed: 3/3.
- Frontend `npm.cmd run check:release` passed:
  - lint,
  - script tests 7/7,
  - build,
  - Playwright 46/46,
  - audit 0 vulnerability.
- Root `npm.cmd run check:release` passed:
  - root script tests 50/50,
  - backend release gate passed: lint, 73 test suite / 467 test, build, audit 0 vulnerability,
  - frontend release gate passed: lint, script tests, build, 46 Playwright test, audit 0 vulnerability.

CODEX durust yorum:

- Bu adim skor matematigine dokunmadi; sadece karar verdigimiz kuralin ekranda dagilmasini engelledi.
- Kullanici artik "bu puan nereden geldi" sorusuna store ve ranking yuzeylerinde daha net cevap alir.
- Bu, ileride mobil BFF ve tam TR/EN localization gelince ceviri anahtarlarina tasinmasi gereken bir adaydir.

Siradaki mantikli adim: bu aciklama dilini tam localization sistemi icin anahtar adaylarina ayirmak yerine simdilik bekletmek; yeni backend temeli olarak master data bootstrap promotion/readiness tarafina devam etmek daha degerli.

## Son Master Data Bootstrap Promotion Safety Guard V1

30 Nisan 2026 itibariyla master data bootstrap promotion yolu stale/inconsistent batch durumlarina karsi guclendirildi.

Referans:

- `docs/plans/master-data-bootstrap-promotion-safety-guard-v1.md`

Kilitlenen davranis:

- Store/personnel promotion halen yalniz `ready_to_promote` batch icin calisir.
- `ready` satirlar promotion'a gider.
- `already_promoted` satirlar skip edilir ve evidence olarak kalir.
- Batch hazir gorunse bile icinde `needs_validation`, `needs_review`, `blocked` veya `waiting_batch` satir varsa repository live-write komutu calismadan islem reddedilir.
- Reddedilen cevap ilk bloklayan satirin row number, row id, readiness state ve block reason bilgisini tasir.

Dogrulama:

- TDD kirmizi test: stale store promotion once resolve olup repository promotion cagirisina gidiyordu.
- TDD kirmizi test: stale personnel promotion once resolve olup repository promotion cagirisina gidiyordu.
- Targeted service test passed: 29/29.
- Targeted master-data bootstrap tests passed: 3 suite / 41 test.
- Root `npm.cmd run check:release` passed:
  - root script tests 50/50,
  - backend release gate passed: lint, 73 test suite / 469 test, build, audit 0 vulnerability,
  - frontend release gate passed: lint, script tests, build, 46 Playwright test, audit 0 vulnerability.

CODEX durust yorum:

- Bu kucuk ama kritik bir guvenlik kapisi: normal akista gorunmeyen, ama production'da veri guvenini bozabilecek "batch hazir gorundu ama satirlar hazir degildi" riskini kapatti.
- Schema, migration, endpoint veya yeni karar motoru acilmadi; sadece promotion komutunun canli yazmadan once daha sert kontrol yapmasi saglandi.
- Master data tarafinda defter daha temiz: baseline verisi geldiginde store/personnel promotion akisi daha guvenilir olacak.

Siradaki mantikli adim: gercek master store/personnel baseline gelene kadar master data tarafinda buyuk yeni akisa girmemek; ihtiyac olursa sadece admin review smoke veya import resolver guard gibi kucuk koruyucu adimlarla ilerlemek.

## Son External ID Code Normalization Guard V1

30 Nisan 2026 itibariyla import/materialization external id mapping resolver'i kod format varyasyonlarina karsi guclendirildi.

Referans:

- `docs/plans/external-id-code-normalization-guard-v1.md`

Kilitlenen davranis:

- Exact `stg.external_id_map.external_id` eslesmesi halen ilk onceliktir.
- Exact eslesme yoksa source external id trim/uppercase/space-hyphen removal ile normalize edilir.
- Fallback, ayni integration source ve entity type icindeki stored `external_id` degerlerini ayni normalizasyonla arar.
- Fallback tek distinct `internal_id` bulursa mapping cozulur.
- Fallback birden fazla distinct `internal_id` bulursa sistem sessiz secim yapmaz; ambiguous mapping hatasi verir.
- Direct internal id alanlari normalize edilmez ve mevcut davranis korunur.

Dogrulama:

- TDD kirmizi test: `SM-140` exact mapping yokken normalized fallback ile cozulmuyordu.
- TDD kirmizi test: ambiguous normalized mapping sessizce `null` donuyordu.
- Targeted resolver test passed: 3/3.
- Targeted resolver + materialization tests passed: 2 suite / 17 test.
- Root `npm.cmd run check:release` passed:
  - root script tests 50/50,
  - backend release gate passed: lint, 74 test suite / 472 test, build, audit 0 vulnerability,
  - frontend release gate passed: lint, script tests, build, 46 Playwright test, audit 0 vulnerability.

CODEX durust yorum:

- Bu sahadaki gercek veri davranisina dogrudan cevap veriyor: `SM-140` / `SM140` ve benzeri farklar gereksiz `unmapped_*` temizligi uretmemeli.
- En onemli kisim ambiguous guard: iki farkli internal kayda giden normalize kod varsa sistem tahmin etmiyor.
- Yeni schema, endpoint veya UI acilmadi; mevcut import/mapping hattinin guvenilirligi arttirildi.

Siradaki mantikli adim: gercek baseline veya JSON sample gelene kadar yeni buyuk akis acmadan kucuk veri guvenligi adimlariyla ilerlemek; bir sonraki aday import mapping/operator smoke veya admin review dry-run kaniti olabilir.

## Son Source-Agnostic Import Boundary V1

30 Nisan 2026 itibariyla Excel bugunku aktif kaynak, JSON ise gelecekteki kanitli kaynak olacak sekilde import siniri kilitlendi.

Referans:

- `docs/plans/source-agnostic-import-boundary-v1.md`
- `scripts/source-agnostic-import-boundary-contract.test.mjs`

Kilitlenen kararlar:

- Excel KPI Import V1 aktif lokal kaynak yoludur.
- JSON real sample payload veya resmi field list gelene kadar future-only kalir.
- Tahmini veriye dayanarak JSON adapter, endpoint, scheduled job veya field map yazilmaz.
- JSON gercek oldugunda Excel ile ayni canonical import boundary icinden gecer.
- Source adapter sadece parsing/field mapping/evidence sorumludur; scoring, ranking, checklist, materialization ve master-data promotion karari vermez.
- Canonical payload `sourceCode`, `sourceBatchId`, `sourceRowReference`, `rowHash`, `rawPayload`, `storeExternalRef`, `employeeExternalRef`, `periodStart`, `periodEnd`, `metricCode`, `actualValue` gibi kanit alanlarini tasir.
- Source adapter store/personel master data auto-create edemez.
- `unmapped_store`, `unmapped_employee`, exact-first mapping, normalized fallback ve ambiguous reject kurallari korunur.
- PowerBI Turkiye ortalamasi satirlari skor kaynagi degil, reconciliation evidence olarak kalir.

Dogrulama:

- TDD kirmizi test: `docs/plans/source-agnostic-import-boundary-v1.md` yokken guard beklenen sekilde dustu.
- Targeted guard test passed: `scripts/source-agnostic-import-boundary-contract.test.mjs` 5/5.
- Root `npm.cmd run check:release` passed:
  - root script tests 55/55,
  - backend release gate passed: lint, 74 test suite / 472 test, build, audit 0 vulnerability,
  - frontend release gate passed: lint, script tests, build, 46 Playwright test, audit 0 vulnerability.

CODEX durust yorum:

- Bu adim JSON'u bugunden yazmiyor; ileride JSON gelince projeyi iki farkli ingest dunyasina bolmemeyi garanti ediyor.
- Defterin temiz kalmasi icin dogru yer burasi: karar siniri testli, runtime davranisi tahmine dayali degil.
- Gercek sample gelmeden adapter yazmamak zayiflik degil, production akli.

Siradaki mantikli adim: gercek JSON sample/field list gelirse mapping spec yazmak; gelmezse source-specific adapter acmadan sadece mevcut Excel/import/master-data hattini guclendiren kucuk guard veya operator smoke adimlariyla ilerlemek.

## Son Master Data Bootstrap Admin Dry-Run Evidence V1

30 Nisan 2026 itibariyla master-data promotion oncesi backend dry-run kaniti admin review ekraninda gorunur hale getirildi.

Referans:

- `docs/plans/master-data-bootstrap-admin-dry-run-evidence-v1.md`

Degisen yuzey:

- `/admin/master-data/:batchId`

Kilitlenen davranis:

- Backend `promotion-readiness` cevabindaki satirlar artik admin review ekraninda `Promotion dry-run evidence` panelinde gosterilir.
- Panel row number, store code, employee code, promotion readiness, promoted entity ve block reason kanitini gosterir.
- Panel canli promote yapmaz; sadece backend readiness sonucunu okur.
- Promote komutu yine mevcut `Promote stores` / `Promote personnel` butonundan ayrica calisir.
- Backend endpoint, migration, scoring, import, materialization ve promotion command davranisina dokunulmadi.

Dogrulama:

- TDD kirmizi test: panel yokken `admin master data bootstrap surface exposes personnel promotion evidence` Playwright testi beklenen sekilde dustu.
- Frontend build passed.
- Targeted Playwright passed: 1/1.
- Root `npm.cmd run check:release` passed:
  - root script tests 55/55,
  - backend release gate passed: lint, 74 test suite / 472 test, build, audit 0 vulnerability,
  - frontend release gate passed: lint, script tests, build, 46 Playwright test, audit 0 vulnerability.

CODEX durust yorum:

- Bu adim dogru bir kucuk kontrol yatirimi: canli tabloya yazmadan once operator artik backend'in satir bazli sonucunu goruyor.
- Yeni karar motoru acilmadi; mevcut backend truth sadece gorunur hale geldi.
- Gercek baseline gelene kadar fake automation yazmak yerine bu tarz kontrol yuzeylerini guclendirmek projeyi saglam tutar.

Siradaki mantikli adim: gercek store/personnel baseline hazir olunca staging/admin review smoke yapmak; yoksa yeni veri kaynagi tahmin etmeden mevcut import/master-data hattindaki kucuk kanit ve kontrol noktalarina devam etmek.

## Son Master Data Bootstrap Pilot Smoke Runbook V1

30 Nisan 2026 itibariyla ilk gercek store/personnel baseline denemesi icin operator smoke runbook'u yazildi ve root script guard'a baglandi.

Referans:

- `docs/plans/master-data-bootstrap-pilot-smoke-runbook.md`
- `scripts/master-data-bootstrap-pilot-smoke-runbook-contract.test.mjs`

Kilitlenen akış:

- true baseline batch stage edilir,
- batch validate edilir,
- row evidence incelenir,
- promotion dry-run evidence incelenir,
- yalniz onayli scoped pilot batch promote edilir,
- sanitized evidence kaydedilir.

Kilitlenen guvenlik sinirlari:

- KPI snapshot Excel dosyalari master-data baseline olarak kullanilmaz.
- Full company baseline ilk smoke olarak promote edilmez.
- Fake store/personnel satiri icat edilmez.
- Live `ops.*` tablolari manuel editlenmez.
- Backend readiness temiz olmadan promotion kapali kalir.
- Dry-run panel promote yapmaz; sadece backend promotion-readiness kanitini gosterir.

Dogrulama:

- TDD kirmizi test: `docs/plans/master-data-bootstrap-pilot-smoke-runbook.md` yokken guard beklenen sekilde dustu.
- Targeted guard test passed: 4/4.
- Root `npm.cmd run check:release` passed:
  - root script tests 59/59,
  - backend release gate passed: lint, 74 test suite / 472 test, build, audit 0 vulnerability,
  - frontend release gate passed: lint, script tests, build, 46 Playwright test, audit 0 vulnerability.

CODEX durust yorum:

- Bu, gercek veri gelmeden kod sisirmek degil; gercek veri geldiginde nasil guvenli calisacagimizi simdiden kilitlemek.
- Master data tarafinda en tehlikeli an "ilk promote" anidir; bu runbook o ani kucuk scope, dry-run evidence ve Go/No-Go karariyla kontrol altina aliyor.
- Defter acisindan bu iyi borc kapatma: sahaya cikmadan once operator adimlari net.

Siradaki mantikli adim: gercek baseline dosyalari hazir olana kadar master-data promotion kapali kalsin; yeni adim gerekiyorsa mevcut import/master-data evidence yuzeylerinden birini kucuk ve testli guclendirelim.

## Son Backend Foundation Hardening Plan V1

30 Nisan 2026 itibariyla yeni modul acmadan arka zemini guclendirme plani yazildi ve root script guard'a baglandi.

Referans:

- `docs/plans/backend-foundation-hardening-plan-v1.md`
- `scripts/backend-foundation-hardening-plan-contract.test.mjs`

Kilitlenen sinir:

- Yeni product module acilmiyor.
- Tahmini external source / JSON adapter isi acilmiyor.
- Yeni scoring engine acilmiyor.
- Broad UI redesign bu plana dahil degil.
- Oncelik mevcut backend, data, auth, import ve operator evidence yuzeylerini guclendirmek.

Planin sirasi:

1. Import decision evidence.
2. Scope/auth regression matrix.
3. DB health and migration evidence.
4. Operator evidence consistency pass.
5. Backup/restore drill, environment hazir olunca.
6. Performance/index review, real data volume olunca.

Dogrulama:

- TDD kirmizi test: `docs/plans/backend-foundation-hardening-plan-v1.md` yokken guard beklenen sekilde dustu.
- Targeted guard test passed: 4/4.
- Root `npm.cmd run check:release` passed:
  - root script tests 63/63,
  - backend release gate passed: lint, 74 test suite / 472 test, build, audit 0 vulnerability,
  - frontend release gate passed: lint, script tests, build, 46 Playwright test, audit 0 vulnerability.

CODEX durust yorum:

- Bu plan borc sayisini sisirmek icin degil, sirayi kaybetmemek icin yazildi.
- Projenin su an ihtiyaci yeni modul degil; mevcut guven, kanit, scope, DB ve operator karar yuzeylerinin daha da keskinlesmesi.
- Sıradaki en mantikli kucuk is `Import decision evidence`: scoring veya materialization degistirmeden admin import detail tarafinda Go / Conditional Go / No-Go dilini netlestirmek.

Siradaki mantikli adim: `docs/plans/backend-foundation-hardening-plan-v1.md` icindeki P0-1 Import decision evidence adimini planlayip kucuk bir slice olarak uygulamak.

## Son Import Decision Evidence V1

30 Nisan 2026 itibariyla admin import batch detail ekranina operator karar kaniti eklendi.

Referans:

- `docs/plans/import-decision-evidence-v1.md`
- `admin-web/src/pages/ImportBatchDetailPage.tsx`
- `admin-web/e2e/integration-surfaces.spec.ts`

Kilitlenen davranis:

- Ekran mevcut batch detail, data quality, reconciliation, retry ve mapping evidence verisinden tek bir operator karari uretir.
- Karar dili `Go`, `Conditional Go`, `No-Go` olarak gorunur.
- Panel row accounting, quality guard, retry evidence ve dependency mapping gerekcesini gosterir.
- Backend endpoint, import, retry, mapping, materialization ve scoring davranisina dokunulmadi.

Karar siniri:

- `Go`: satir muhasebesi temiz, quality issue yok, retryable row yok, dependency block yok.
- `Conditional Go`: evidence incelenebilir ama quality issue, retryable row, mapping ihtiyaci veya reconciliation bekleme durumu var.
- `No-Go`: row accounting mismatch, unaccounted/pending row, blocked dependency veya failed/stuck state var.

Dogrulama:

- TDD kirmizi test: karar paneli yokken `admin import batch detail explains KPI row lineage evidence` Playwright testi beklenen sekilde dustu.
- Frontend build passed.
- Targeted Playwright passed: 1/1.
- Root `npm.cmd run check:release` passed:
  - root script tests 63/63,
  - backend release gate passed: lint, 74 test suite / 472 test, build, audit 0 vulnerability,
  - frontend release gate passed: lint, script tests, build, 46 Playwright test, audit 0 vulnerability.

CODEX durust yorum:

- Bu tam olmasi gereken tipte bir zemin guclendirme: yeni motor acmadan mevcut kaniti karar diline cevirdik.
- Operator artik "bu batch ile ilerleyebilir miyim?" sorusunu quality/reconciliation/error tablolarina tek tek dagilmadan gorebilir.
- En kritik sey panelin sadece ozet kalmasi; backend truth yine import rows, reconciliation, mapping, retry ve materialization hattinda.

Bu siradaki adim tamamlandi: P0-2 Scope/auth regression matrix adimi dokumante edildi ve guard'a baglandi.

## Son Scope/Auth Regression Matrix V1

30 Nisan 2026 itibariyla mevcut auth/scope korumalari tek regression matrix dokumaninda toplandi.

Referans:

- `docs/plans/scope-auth-regression-matrix-v1.md`
- `scripts/scope-auth-regression-matrix-contract.test.mjs`

Kilitlenen sinir:

- Matrix yeni auth modeli eklemez; mevcut korunan yuzeyleri ve test kanitlarini listeler.
- `readScope` action scope degildir.
- Token claim'leri tek basina yeterli degildir; DB assignment/action kontrolleri devam eder.
- `assignedStoreIds` store create/approve/complete/acknowledge/mutate islemleri icin ayri korunur.
- Empty scope full-data access'e acilmaz; no data veya forbidden davranisiyla kapanir.
- Foreign explicit filter, actor scope disina veri genisletemez.
- Rol semantigi degistirilmedi.

Matrix kapsamindaki kanit yuzeyleri:

- `backend/nestjs/test/integration/auth-scope.e2e-spec.ts`
- `backend/nestjs/src/modules/auth/auth-context.service.spec.ts`
- `backend/nestjs/src/modules/auth/auth-role-scope-policy.service.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`
- `backend/nestjs/test/integration/workforce-seller-code.e2e-spec.ts`
- `backend/nestjs/test/integration/workforce-offboarding.e2e-spec.ts`

Dogrulama:

- TDD kirmizi test: `docs/plans/scope-auth-regression-matrix-v1.md` yokken guard beklenen sekilde dustu.
- Targeted guard test passed: `scripts/scope-auth-regression-matrix-contract.test.mjs`.
- Backend targeted scope/auth tests passed.
- Root `npm.cmd run check:release` passed.

CODEX durust yorum:

- Bu yeni feature degil, dagilmayi engelleyen harita.
- Scope/auth davranisi zaten testlerde vardi ama bilgi daginikti; artik hangi yuzeyin hangi testle korundugu tek yerde.
- En kritik cizgi net: okuma yetkisi islem yetkisi degil, `assignedStoreIds` store aksiyonlari icin ayri korunacak.

Bu siradaki adim tamamlandi: P0-3 DB health and migration evidence adimi uygulandi ve guard'a baglandi.

## Son DB Health And Migration Evidence V1

30 Nisan 2026 itibariyla DB health ve migration status gozlemlenebilirligi guclendirildi.

Referans:

- `docs/plans/db-health-migration-evidence-v1.md`
- `scripts/db-health-migration-evidence-contract.test.mjs`
- `backend/nestjs/src/shared/health.service.ts`
- `backend/nestjs/src/shared/database/migration.service.ts`
- `backend/nestjs/src/shared/database/migrations.controller.ts`

Eklenenler:

- `MigrationService.getMigrationStatus` migration dosyalarini ve `audit.schema_migration` tracking satirlarini salt-okuma evidence olarak karsilastirir.
- `GET /api/admin/migrations/status` authenticated `SUPER_ADMIN` migration status evidence dondurur.
- Status response `trackingTable`, `totalFiles`, `appliedCount`, `pending`, `failed` ve `checksumMismatches` alanlarini tasir.
- Status endpoint `runMigrations` cagirmadan calisir; SQL migration dosyalarini execute etmez.
- Mevcut `POST /api/admin/migrations/run` endpoint'i ayri guard'li kalir.
- Public `GET /api/health` dependency error mesajlarinda URL/credential tarzı detaylari `[redacted-url]` / `[redacted]` olarak maskeler.

Kilitlenen sinir:

- Migration sistemi degistirilmedi.
- Yeni migration dosyasi veya destructive DB davranisi eklenmedi.
- CLI/CI migration yolu `npm.cmd run db:migrate` olarak kalir.
- Public health response connection string, password veya raw DB URL dondurmemeli.

Dogrulama:

- TDD kirmizi test: migration status metod/endpoint eksikken backend targeted testler beklenen sekilde dustu.
- TDD kirmizi test: health error redaction yokken secret URL response icinde gorundu.
- TDD kirmizi test: `docs/plans/db-health-migration-evidence-v1.md` yokken root guard beklenen sekilde dustu.
- Targeted backend tests passed.
- Targeted guard test passed.
- Root `npm.cmd run check:release` passed.

CODEX durust yorum:

- Bu is gosterisli degil ama production akli. Deploy oncesi migration status ve fail evidence gorulebiliyor, public health ise baglanti detaylarini disari vermiyor.
- En onemli cizgi korundu: status sadece okuma; migration calistirma yine CLI/CI ve ayri guard'li run endpoint sinirinda.

Siradaki mantikli adim: P0-4 Operator evidence consistency pass adimina gecmek.

## Devam Komutu

Yeni pencerede devam etmek icin:

```text
current-state.md oku; aktif proje yolu masaustundeki WEBSİTE ÇALIŞMASI. Eski E:\ yolunu kullanma. readScope/actionScope ayrimi ve assignedStoreIds modeli korunuyor. Siradaki mantikli adim P0-4 Operator evidence consistency pass.
```
