# Store Me Performance Card Production V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/store/me` icin kilitli HR Axis performans karti prototipini production yuzeyine tasimak; prototipteki buton metnini `Performans Kartı Oluştur` yapmak; butona basildiginda kullanicinin karsisina dogrudan performans karti preview'u, `PNG indir` ve `Kapat` aksiyonlari gelmesini saglamak; Store Me personel yuzeyinden prim/hak edis gorunumunu kaldirmak; Store Manager icin `/store/incentives` route gorunurlugunu kapatmak.

**Architecture:** Tek bir Store Me view modelinden beslenen, hassas finansal veri gostermeyen, badge kontratiyla cozumlenen, story formatinda export edilebilir bir share-card componenti. Prototip kontrati once guncellenir, sonra production componentleri ayni goruntu ve akisla eklenir. Incentive gorunurlugu sadece route/nav ve Store Me yuzeyinden temizlenir; backend prim hesaplama, incentive API, KPI/ranking matematikleri degismez.

**Tech Stack:** React, TypeScript, shadcn Dialog/Button, lucide icon, mevcut Store Me view model, mevcut Store shell, Tailwind v4 `tw:` prefiksi, scoped Store Me CSS, hafif PNG export yardimcisi (`html-to-image` veya projede onayli muadil).

---

## 1. Kilitli Kararlar

- [ ] Buton metni her yerde `Performans Kartı Oluştur` olacak.
- [ ] `Profil Kartı Oluştur` metni prototype, contract, localization ve production UI icinde kalmayacak.
- [ ] Butona basinca kullanici once ayar/format/bilgi paneli gormeyecek.
- [ ] Dialog icinde yalnizca performans karti preview'u, `PNG indir`, `Kapat` ve gerekiyorsa kisa unavailable state olacak.
- [ ] Format secimi yok: sadece story format.
- [ ] Kartta sadece Turkiye siralamasi gorunur; bolge ve magaza siralamasi external kartta yer almaz.
- [ ] Kartta ciro, satis tutari, hedef tutari, kalan hedef, prim, maas, personel kodu, UUID/internal ID ve debug/internal copy gorunmez.
- [ ] Badge sistemi `docs/contracts/store-me-performance-badge-system-v1.md` kontratina bagli olacak; share card icinde ikinci bir oncelik tablosu yazilmayacak.
- [ ] Store Me icinde personel-facing prim/hak edis karti kalkacak.
- [ ] Store Manager icin `/store/incentives` route/nav kapatilacak. Region Manager ve yetkili admin/report rolleri mevcut kapsamda korunacak.
- [ ] Incentive backend, projection, correction, approval flow, formuller, database ve API shape degismeyecek.
- [ ] Tum gorunen metinlerde Turkce karakterler kusursuz olacak; mojibake kabul edilmeyecek.

---

## 2. Dahil Edilecek Next Action Notu

Kaynak: `docs/plans/active-next-actions.md`

- [ ] `Hak edilen prim` / incentive earnings blogu Store Me prototype ve production personnel-facing Store Me yuzeylerinden kaldirilacak.
- [ ] Store personnel `/store/me` icinde incentive earnings gormeyecek.
- [ ] Prim gorunurlugu Store Me performans sayfalarindan ayrilacak; tekrar acilmasi icin ayri kapsam gerekecek.
- [ ] `/store/incentives` route gorunurlugu Store Manager icin kapatilacak.
- [ ] Bu is kapsaminda sadece UI/route visibility uygulanacak; incentive hesaplama veya admin/BM incentive akisi degismeyecek.

---

## 3. Mevcut Kodda Gorulen Temas Noktalari

### Prototip

- [ ] `admin-web/src/prototypes/store-me-reference-v1.tsx`
  - Su an buton metni `Profil Kartı Oluştur`.
  - Dialog icinde format secimi, donem aciklamasi, paylasim guvenligi listesi ve ayar paneli var.
  - Bu prototip dogrudan kart preview + indirme aksiyonuna sadeleştirilecek.

### Contract Docs

- [ ] `docs/prototypes/hr-axis-performance-share-card-v1.md`
  - Feature ve primary flow metinleri `Performans Kartı Oluştur` olarak guncellenecek.
  - Export button label kontrati `Performans Kartı Oluştur` olacak.
  - Dialog action kontrati `PNG indir` ve `Kapat` olarak kalacak.
  - `Profil Kartı Oluştur` kalintisi sifirlanacak.
- [ ] `docs/contracts/store-me-performance-badge-system-v1.md`
  - Primary use satiri `Performans Kartı Oluştur` external share card olarak guncellenecek.
  - Badge onceligi ve eligibility kurallari degismeyecek.

### Production Store Me

- [ ] `admin-web/src/pages/StoreMyPerformancePage.tsx`
  - Su an `StoreMeIncentiveCard` importu ve `incentiveQuery` akisi var.
  - Personel-facing Store Me icin prim karti kaldirilacak.
  - Share card dialog state ve component entegrasyonu buraya veya dashboard container'a eklenecek.
- [ ] `admin-web/src/pages/store-my-performance-plum-dashboard.tsx`
  - Ust profil/heading bolumune `Performans Kartı Oluştur` butonu eklenecek veya mevcut uygun header aksiyon slotuna baglanacak.
  - Buton shadcn Button + uygun lucide icon ile gelecek.
- [ ] `admin-web/src/pages/store-my-performance-model.ts`
  - Kart icin gereken field'lar view modelde zaten varsa aynen kullanilacak.
  - Eksik field varsa yeni hesap uydurulmayacak; sadece mevcut backend/view model verisi expose edilecek.
- [ ] `admin-web/src/features/localization/messages/store-me.ts`
  - Yeni metinler eklenecek:
    - `Performans Kartı Oluştur`
    - `PNG indir`
    - `Kapat`
    - `Performans kartı oluşturulamadı`
    - `Skor ve Türkiye sıralaması oluştuğunda kart indirilebilir.`
  - Eski `Profil Kartı Oluştur` kullanimi kalmayacak.

### Incentives Route Visibility

- [ ] `admin-web/src/app/store-route-registry.ts`
  - `canOpenStoreIncentives` Store Manager icin false olacak.
  - `navigationByPersona.storeManager` listesinden `incentives` kaldirilacak.
  - Region Manager navigation icinde `incentives` kalacak.
  - Admin/report kullanimi mevcut policy ile uyumlu kalacak.
- [ ] `admin-web/src/pages/StoreIncentivesPage.tsx`
  - Direct route guard Store Manager icin 403/forbidden state vermeli.
  - Region Manager akisi etkilenmemeli.
- [ ] `admin-web/src/pages/store-home-command-model.ts`
  - Home aksiyonlarinda Store Manager icin `Primleri aç` gibi kartlar tekrar urememeli.

---

## 4. PR Treni

### PR-1: Contract + Prototype Lock Sync

Amaç: Once prototip ve dokuman kontratini yeni akisa gore netlestirmek.

- [ ] `docs/prototypes/hr-axis-performance-share-card-v1.md` metinlerini guncelle.
- [ ] `docs/contracts/store-me-performance-badge-system-v1.md` primary use metnini guncelle.
- [ ] `docs/prototypes/README.md` locked entry hash/ozet gerekiyorsa guncelle.
- [ ] `admin-web/src/prototypes/store-me-reference-v1.tsx` icinde:
  - [ ] Buton metnini `Performans Kartı Oluştur` yap.
  - [ ] Format secimini kaldir.
  - [ ] Donem/guvenlik bilgi panelini kaldir.
  - [ ] Dialog'u sadece card preview + `PNG indir` + `Kapat` haline getir.
  - [ ] Story format disinda CSS varyanti kalmasin.
  - [ ] `Profil Kartı Oluştur` string kalmasin.
- [ ] Prototip mobil ve desktop screenshot kontrolu yap.
- [ ] Turkce karakter kontrolu yap.

Verification:

```powershell
rg -n "Profil Kartı|Profil KartÄ|Format|Dış paylaşım|Paylaşım güvenliği" admin-web/src/prototypes docs/prototypes docs/contracts
npm.cmd --prefix admin-web run build
```

Acceptance:

- [ ] Prototype button label `Performans Kartı Oluştur`.
- [ ] Click direkt performans karti dialog'unu acar.
- [ ] Dialogda ekstra ayar paneli yok.
- [ ] Card preview mobile'da tasmiyor.

### PR-2: Production Store Me Share Card

Amaç: Kilitli prototipi production `/store/me` icine gercek veriyle gecirmek.

- [ ] Yeni component olustur:
  - `admin-web/src/pages/store-me-share-card-dialog.tsx`
  - `admin-web/src/pages/store-me-share-card-preview.tsx` veya ayni dosyada ic component
- [ ] Badge resolver olustur:
  - `admin-web/src/pages/store-me-performance-badges.ts`
  - Kontrat dosyasindaki priority ve eligibility aynen uygulanacak.
  - Reason alanlari UI'da gosterilmeyecek.
- [ ] Unit/contract test ekle:
  - `admin-web/scripts/store-me-performance-badges-contract.test.mjs` veya mevcut test yapisina uyumlu dosya.
  - Turkiye 1.'si, Ilk %1, Magaza Lideri, Bolge Ilk 3, Ayin Yukseleni, Hedef Ustu, Istikrarli Performans, missing rank ve store population 1 cases.
- [ ] View model data mapping:
  - employee display name
  - store name
  - period label
  - performance score
  - Turkey rank
  - Turkey population
  - percentile
  - resolved badge
- [ ] Missing data davranisi:
  - Score veya Turkey rank/population eksikse buton disabled veya dialog unavailable state.
  - Production'da fake score/rank uretilmeyecek.
- [ ] PNG export:
  - Ref ile card node yakalanacak.
  - Filename: `lufian-performans-karti-{slug-name}-{yyyy-mm}.png`
  - Indirilen dosyanin acildigi dogrulanacak.
- [ ] Long name guard:
  - `Süleyman Mustafa Kuncan Karademir` icin max 2 satir, ellipsis yok, overlap yok.
- [ ] Store Me header/action entegrasyonu:
  - `Performans Kartı Oluştur` butonu sag ust aksiyon olarak gorunecek.
  - Buton tiklandiginda sadece share-card dialog acilacak.
- [ ] CSS:
  - Scoped classlar kullan.
  - Raw sensitive copy yok.
  - Mobile 390px overflow yok.

Verification:

```powershell
npm.cmd --prefix admin-web run test:scripts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

Browser verification:

- [ ] `/store/me?prototype=reference-v1` desktop screenshot.
- [ ] `/store/me?prototype=reference-v1` mobile screenshot.
- [ ] Production `/store/me` desktop screenshot.
- [ ] Production `/store/me` mobile screenshot.
- [ ] `PNG indir` dosyasi indirilir ve image decoder ile acilir.
- [ ] Card hassas veri icermiyor.

Acceptance:

- [ ] Production goruntu prototip kontratina maddi olarak uyumlu.
- [ ] Button label ve dialog akisi birebir.
- [ ] Turkce karakterler dogru.
- [ ] Badge tek tane.
- [ ] Sadece Turkiye siralamasi gorunur.
- [ ] PNG acilir.

### PR-3: Store Me Incentive Cleanup + Store Manager Incentive Route Close

Amaç: Aktif next action notunu uygulamak ve prim gorunurlugunu personel/SM performans yuzeyinden ayirmak.

- [ ] `StoreMyPerformancePage.tsx` icinden:
  - [ ] `StoreMeIncentiveCard` importunu kaldir.
  - [ ] `getMySalesTargetIncentives`, `mySalesTargetIncentivesQueryKey`, `SalesTargetIncentiveProjection` baglarini kaldir.
  - [ ] `incentiveQuery` ve `incentiveProjection` akisini kaldir.
  - [ ] Experience prop'undan `incentiveProjection` kaldir.
  - [ ] UI'dan `StoreMeIncentiveCard` render'i kaldir.
- [ ] Prototype Store Me'de prim/earnings bolumu varsa kaldir.
- [ ] `store-route-registry.ts`:
  - [ ] `canOpenStoreIncentives` Store Manager icin false.
  - [ ] `storeManager` navigation listesinden `incentives` kaldir.
  - [ ] Region Manager listesinde `incentives` kalir.
- [ ] `role-permission-preview.ts` veya Auth UI preview icinde Store Manager incentive route gorunuyorsa guncelle.
- [ ] `store-home-command-model.ts` Store Manager icin prim CTA uretmemeli.
- [ ] Store Manager direct `/store/incentives` smoke: forbidden/unavailable.
- [ ] Region Manager `/store/incentives` smoke: hala acilir.

Verification:

```powershell
rg -n "StoreMeIncentiveCard|getMySalesTargetIncentives|mySalesTargetIncentivesQueryKey|Hak edilen prim|Hakediş|Prim kazancı" admin-web/src/pages admin-web/src/prototypes admin-web/src/features/localization/messages/store-me.ts
npm.cmd --prefix admin-web run test:scripts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

Acceptance:

- [ ] Store Me personel yuzeyinde prim/hak edis yok.
- [ ] Store Manager sidebar'da `Primler` yok.
- [ ] Store Manager direct route access kapali.
- [ ] Region Manager prim sayfasi etkilenmedi.
- [ ] Incentive API/backend/formul degismedi.

---

## 5. Data Mapping Detayi

Production share card field map:

| Card field | Source |
| --- | --- |
| Personel adi | `viewModel.employeeHeading` veya `performance.employee.displayName` |
| Magaza adi | Store Me view model employee/store label |
| Donem | `selectedPeriodLabel` |
| Skor | `scoreValue` |
| Turkiye siralamasi | `turkeyRankLabel` parse edilmeden, mumkunse numeric source field |
| Turkiye kisi sayisi | `turkeyPopulationLabel` parse edilmeden, mumkunse numeric source field |
| Percentile | `ceil(rank / population * 100)`, min `1` |
| Badge | `resolveStoreMePerformanceBadge` |

Badge resolver hidden input map:

| Resolver field | Source / rule |
| --- | --- |
| `periodKey` | Selected Store Me period key |
| `score` | Same numeric source as visible performance score |
| `turkeyRank` | Backend/view-model numeric Turkey rank; do not parse display text if numeric field can be exposed |
| `turkeyPopulation` | Backend/view-model numeric Turkey population |
| `storeRank` | Backend/view-model numeric store rank; hidden on card but required for `MAĞAZA LİDERİ` |
| `storePopulation` | Backend/view-model numeric store population; hidden on card but required for single-person pool guard |
| `regionRank` | Backend/view-model numeric region rank; hidden on card but required for `BÖLGE İLK 3` |
| `regionPopulation` | Backend/view-model numeric region population |
| `targetAchievementPercent` | Existing Store Me target achievement percent; target amount stays hidden |
| `previousPeriodScore` | Existing monthly comparison source when available |
| `previousPeriodTurkeyRank` | Existing previous-period ranking source when available |
| `currentPeriodDataQuality` | Existing Store Me partial/data-quality state |

Kritik karar:

- [ ] Eger numeric rank/population view modelde yoksa, string label parse etmek yerine once modelde numeric alan expose edilecek.
- [ ] Frontend backend ranking tie-breaker'ini tekrar hesaplamayacak.
- [ ] Eksik rank/population icin kart disabled/unavailable olacak.
- [ ] Badge resolver icin gerekli hidden input eksikse o badge false donmeli; frontend gorunen label'dan tahmin yapmamali.
- [ ] Kartta gorunmeyen store/region/previous-period alanlari sadece badge kararinda kullanilacak, external card UI'ina sizdirilmayacak.

---

## 6. Badge Resolver Acceptance Matrix

- [ ] `turkeyRank=1`, `turkeyPopulation>=30` => `TÜRKİYE 1.'Sİ`
- [ ] `turkeyRank=5`, `turkeyPopulation=842` => `İLK %1`
- [ ] `turkeyRank=24`, `turkeyPopulation=842`, `storeRank=1`, `storePopulation=4` => `MAĞAZA LİDERİ`
- [ ] `regionRank=2`, `regionPopulation=78`, no stronger badge => `BÖLGE İLK 3`
- [ ] previous rank improvement condition true, score did not fall => `AYIN YÜKSELENİ`
- [ ] target achievement `>=100`, no stronger badge => `HEDEF ÜSTÜ`
- [ ] last 3 scores `>=70`, no stronger badge => `İSTİKRARLI PERFORMANS`
- [ ] missing Turkey rank => no badge
- [ ] store rank 1 but store population 1 => no `MAĞAZA LİDERİ`
- [ ] multiple eligible => highest priority only

---

## 7. UX Acceptance Checklist

- [ ] Button name: `Performans Kartı Oluştur`.
- [ ] Button icon meaningful, not decorative clutter.
- [ ] Dialog opens centered and not oversized.
- [ ] Dialog outside click behavior remains shadcn default unless route pattern says otherwise.
- [ ] Dialog contains no format picker.
- [ ] Dialog contains no long explanatory panel.
- [ ] Card fits within dialog on desktop and mobile.
- [ ] Card uses HR Axis dark plum/cyan palette.
- [ ] Score centered in ring.
- [ ] Badge has badge-specific icon.
- [ ] Person name supports long names without clipping.
- [ ] Ranking panel shows `#rank / population`.
- [ ] Percentile shows `İlk %{n}`.
- [ ] `PNG indir` visible without scrolling on normal desktop.
- [ ] Mobile footer/actions reachable.

---

## 8. Security And Privacy Checks

- [ ] No revenue/sales amount.
- [ ] No target amount.
- [ ] No remaining target.
- [ ] No incentive/bonus.
- [ ] No salary.
- [ ] No employee code.
- [ ] No UUID/internal ID.
- [ ] No admin note.
- [ ] No API/DB/scope/mock/debug copy.
- [ ] PNG export filename does not include internal IDs.

---

## 9. Performance And Bundle Risk

- [ ] If `html-to-image` or equivalent is added, bundle impact is reviewed.
- [ ] Export code loads only when dialog opens if feasible.
- [ ] Store Me first paint should not slow down because of share-card export library.
- [ ] No polling/timer refresh added.
- [ ] No query added only for the share card unless missing data cannot be obtained from existing Store Me view model.

---

## 10. Stop Conditions

Stop and ask for product/technical decision if:

- [ ] Store Me view model lacks reliable numeric Turkey rank/population and backend change is needed.
- [ ] Closed month vs live month state cannot be distinguished but badge copy would imply final award.
- [ ] PNG export requires a heavy dependency with unacceptable bundle impact.
- [ ] Store Manager incentive route is used by another required pilot workflow.
- [ ] Product wants more than one badge on the external card.
- [ ] Product wants incentive or target amount on the share card.

---

## 11. Final Closeout Evidence

Final PR train closeout should include:

- [ ] PR links and commit summaries.
- [ ] Prototype parity note.
- [ ] Store Me production screenshot desktop/mobile.
- [ ] Share card dialog screenshot desktop/mobile.
- [ ] Downloaded PNG proof path and file open check.
- [ ] Store Manager route visibility evidence.
- [ ] Region Manager incentive route still works evidence.
- [ ] Tests run with pass/fail.
- [ ] Remaining risk list, if any.
