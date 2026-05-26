# Work Discipline

Bu dosya HR Axis / Store Ops projesinde Codex ile kullanilan pratik calisma
disiplinidir. `sokrates.md` karar kalitesinin kanonik kaynagidir; bu dosya ise
gundelik is akisini, PR ritmini, dogrulama disiplinini ve durma kurallarini
tek yerde toplar.

## Baslangic Ritueli

Her yeni oturumda veya context kaybi sonrasi:

1. `current-state.md` oku.
2. `sokrates.md` oku.
3. Bu dosyayi oku.
4. `origin/main` ve local git durumunu kontrol et.
5. Root working tree kirliyse unrelated degisikliklere dokunma.
6. En guncel talebi eski plandan ustte tut.
7. Hedefi, riskleri, ilk guvenli adimi ve dogrulama yolunu netlestir.

## Ana Ilke

Amac hizli gorunmek degil, temiz ve saglam ilerlemektir.

- Acele yok.
- Rewrite yok, kontrollu refactor var.
- Buyuk mimari hamle yok, kucuk ve geri alinabilir slice var.
- Davranis degisikligi gizlenmez.
- Her karar repo kaniti, test kaniti veya acik varsayimla desteklenir.
- Sokrates arka planda her zaman calisir, ancak dusuk riskli islerde gereksiz
  seremoniye donusmez.

## Calisma Ritmi

Varsayilan ritim:

1. Plan: hedef, varsayim, risk, neden simdi.
2. Implementasyon plani: dosyalar, guardrail, testler, rollback sekli.
3. Uygulama: en kucuk anlamli degisiklik.
4. Verification: uygun lint/build/test/e2e/check.
5. Handoff: gerekli plan, evidence veya current-state guncellemesi.

Kodlamaya gecmeden once is gercekten kod istiyor mu diye sorulur. Bazi isler
docs-only, inventory, evidence veya park karari olarak daha dogrudur.

## Istisare ve Kodlama Freni

Kullanici bir konu, fikir, sikayet, ekran goruntusu, risk veya "sence?" sorusu
getirdiginde varsayilan mod kod yazmak degil, birlikte dusunmektir. Bu durumda
once problem netlestirilir, olasi nedenler ve secenekler tartilir, riskler
soylenir ve ancak kullanici acik aksiyon verdiginde implementasyona gecilir.

Asagidaki sinyaller kodlama freni sayilir:

- "once dusunelim",
- "once istisare edelim",
- "beyin firtinasi yapalim",
- "konusalim",
- "sence ne olur",
- "yorumun ne",
- "nasil ilerleyelim",
- sadece problem/rahatsizlik anlatimi.

Bu sinyaller varken dosya editlenmez, kod yazilmaz, commit atilmaz, PR acilmaz
ve merge yapilmaz. Gerekirse sadece read-only inceleme, repo aramasi, diff
okuma veya evidence toplama yapilir; bunlar da kullaniciya "su an sadece
inceliyorum" diye aciklanir.

Aksiyon izni acik fiille gelir:

- "yaz",
- "yap",
- "uygula",
- "duzelt",
- "kodla",
- "implement et",
- "commit at",
- "PR ac",
- "merge et".

"Bak", "kontrol et", "incele" gibi ifadeler edit izni degildir. Bu ifadelerle
once bulgu ve onerilen cozum raporlanir; kullanici "yap/uygula/duzelt" demeden
kod degisikligine gecilmez.

## Worktree Dependency Bootstrap

Yeni git worktree acildiginda `node_modules` beklenmez. `node_modules` git'e
girmez ve worktree'ler arasinda otomatik tasinmaz. Bu normaldir.

Yeni worktree'de ilk gate oncesi ihtiyaca gore bootstrap yap:

- Frontend isi varsa: `npm.cmd --prefix admin-web ci`.
- Backend isi varsa: backend dependency kurulumu yap.
- Playwright gerekiyorsa browser kurulum/check adimini dogrula.
- Sadece docs-only is varsa dependency kurulumu yapma; `git diff --check`
  yeterlidir.

Kural:

- "Module not found" gordugunde once worktree dependency bootstrap eksik mi
  kontrol et.
- Dependency kurulumunu behavior degisikligi sayma, ama lockfile degisirse
  sebebini anlamadan stage etme.
- Worktree'ler arasi `node_modules` symlink/junction paylasimi varsayilan
  cozum degildir; hiz kazandirabilir ama garip Windows ve lockfile sorunlari
  yaratabilir.
- Merge edilmis ve artik kullanilmayan worktree'ler periyodik olarak
  temizlenebilir, ama once branch/PR/merge durumu dogrulanir.

## Slice Disiplini

Her slice sunlari tasimaliyidir:

- Tek net amac.
- Sinirli dosya alani.
- Davranis degisikligi varsa acik kapsam.
- Geri alma yolu.
- Uygun local gate.
- Bir paragrafta anlatilabilir review hikayesi.

Slice kucuk olabilir ama her slice ayri PR olmak zorunda degildir. Ayni domain,
ayni risk sinifi, ayni dogrulama ve ayni rollback hikayesine sahip kucuk
slicelar tek batch branch/PR icinde birlestirilebilir.

Asla ayni PR icinde karistirma:

- read ve write davranisi,
- auth/permission ve UI polish,
- DB migration ve frontend refactor,
- API response shape ve gorunum iyilestirmesi,
- farkli domainlere ait bagimsiz riskler,
- review edilemeyecek kadar buyuk diff.

## PR Disiplini

PR acmak icin minimum bar:

- Branch temiz ve `origin/main` uzerinden guncel.
- Diff beklenen dosyalardan olusuyor.
- Local gate gecmis.
- PR tek review hikayesi tasiyor.
- PR revert edilebilir.
- PR acikca neyi degistirmedigini soyluyor.

PR cok kucukse ve ayni hikayenin parcasiysa bekletilebilir. PR cok buyukse veya
birden fazla risk tasiyorsa bolunur.

## Merge Disiplini

Merge icin hepsi gerekir:

- Local verification gecti.
- GitHub/Vercel checks yesil.
- PR mergeable.
- Codex review onayi geldi.

Codex onayi su sekillerde kabul edilir:

- `found no major issue`,
- `didn't find any major issues`,
- acik thumbs-up/onay reaksiyonu.

Sadece `eyes` reaksiyonu onay degildir. Actionable Codex yorumu varsa merge
edilmez; once duzeltilir, testler yeniden kosulur, tekrar review beklenir.

Codex review kontrolu sadece tek ekrandan yapilmaz. Su kanallar birlikte
okunur:

- PR issue comments,
- latest reviews,
- inline PR review comments,
- reaction gruplari,
- status check rollup.

GitHub kontrolu tek seferlik snapshot degildir. PR acildiktan veya branch'e yeni
push geldikten sonra merge karari verilene kadar GitHub durumu 30 saniyede bir
loop ile tekrar cekilir ve birlikte degerlendirilir:

- GitHub Actions checks,
- Vercel/deploy checks,
- PR issue comments,
- latest reviews,
- inline PR review comments,
- reaction gruplari,
- status check rollup,
- mergeability / branch state.

Bu 30 saniyelik loop ancak tum checks yesil, PR mergeable, Codex review kanallari
temiz/onayli ve yeni actionable yorum olmadigi goruldugunde biter. Failed check,
pending belirsizlik, yeni yorum veya actionable Codex notu gorulurse merge
yapilmaz; once sebep okunur, gerekirse duzeltme push'lanir ve loop yeniden
baslatilir.

## Verification Ladder

Docs-only:

- `git diff --check`.
- Gerekirse diff okunur ve belge linkleri dogrulanir.

Frontend:

- `npm.cmd --prefix admin-web run lint`.
- `npm.cmd --prefix admin-web run build`.
- Ilgili targeted Playwright spec.
- Mobil/responsive veya browser kaniti gerekiyorsa hedef viewport kontrolu.

Backend:

- Targeted Jest.
- Backend lint/build.
- Blast radius genisse full backend test.

API contract:

- `npm.cmd --prefix backend/nestjs run openapi:generate`.
- `npm.cmd --prefix admin-web run api:generate`.
- `npm.cmd --prefix admin-web run api:check`.
- Ilgili frontend/backend targeted testler.

Release/readiness:

- GitHub checks.
- Vercel checks.
- Gerekiyorsa deployed smoke.
- Gercek provider/input gerektiren kanitlar mock ile kapatilmaz.

## Hard Boundaries

Asagidakiler ancak acik kapsam ve guclu verification ile degisir:

- business logic,
- API response shape,
- auth ve permission semantigi,
- DB schema veya migration,
- provider config,
- queue/Redis/BullMQ davranisi,
- KPI scoring, ranking sort, checklist weights,
- import lifecycle, retry veya mapping approval davranisi,
- user-facing workflow semantigi.

Bu alanlarda suphe varsa dur, plani daralt veya once docs/inventory yap.

## External Evidence Disiplini

Gercek token, provider secret, restore target, Redis URL, alert destination,
upload dosyasi veya staging input yoksa live evidence kapanmis sayilmaz.

Local code su isleri kanitlayamaz:

- gercek Clerk session/auth smoke,
- assigned/unassigned action smoke,
- Supabase restore drill,
- alert delivery proof,
- Redis/BullMQ production posture,
- authenticated upload smoke.

Input yoksa bu isler park edilir ve local-only guvenli ise gecilir.

## UI/UX Disiplini

Admin/SaaS yuzeyleri sessiz, operasyonel, yogun ama okunabilir olmalidir.

- Landing/hero pazarlama dili yok.
- Broad redesign yok.
- Nested card ve dekoratif gradient/orb yok.
- Primary action, loading, empty, error ve recovery state net olur.
- Mobile overflow ve text overlap kontrol edilir.
- Accessibility icin label, focus, link/button anlamlari korunur.
- Copy TR/EN tutarliligi korunur.
- Kullanici ekraninda ic mimari notu gosterilmez. Route, auth, scope,
  permission, provider, contract, token, evidence, mock, staging, API, DB,
  OpenAPI, queue, Redis veya benzeri uygulama-ici teknik aciklamalar sadece
  docs/evidence/dev tooling icinde kalir; sayfa refactorlerinde bu metinler
  temizlenir veya kullanici diline cevrilir.
- Sayfa UI refactoru yapildiginda eski UI kalintisi birakilmaz. Eski
  hero-card, metric-card sisirmesi, buyuk gradient blok, nested card, uzun
  aciklama paragraflari, placeholder/handoff metni, dev/debug aksiyonu,
  scaffold/readiness/evidence dili veya eski sayfa iskeleti refactor edilen
  yuzeyde gorunur kalamaz.
- Refactor edilen sayfa yeni sade iskelete iner: kucuk baslik, gerekli durum
  veya filtre satiri, tek net primary action, ana tablo/liste/form ve kisa
  loading/empty/error state. Bu iskelete uymayan eski bolumler ya kaldirilir
  ya da acikca ayri kapsam olarak park edilir; park edilen parca varsa sayfa
  tamamen refactor edilmis sayilmaz.
- Sayfa yapisi redesign kapsamindaysa `shadcn/ui` componentleri, Tailwind v4
  utility/token yapisi ve `lucide-icons/lucide` ikonlari zorunlu stacktir.
  Hazir olmayan yuzeylerde once bu stack icin kucuk kurulum/entegrasyon slice'i
  planlanir; lokal ad hoc component veya ikon dili yeni standart yerine
  gecemez.
- Plum Glacier pilot dili kullaniliyorsa renk/token daginikligi geri
  getirilmez. Yeni pilot/refactor sayfalari eski krem/teal foundation
  gorunumuyle plum/glacier iskeleti karistirmaz.
- UI pilotlarinda aktif renk sozlugu
  `docs/prototypes/plum-glacier-token-set-v1.md` dosyasidir. Bu karar global
  tema rewrite'i degildir; login ve sonraki yeni/refactor edilen sayfalarda
  tek token setiyle ilerleme disiplinidir.

Store Me refactorundan cikan tekrar kullanilabilir sayfa kurali:

- Redesign once data envanteriyle baslar: hangi API/view-model alani, hangi
  rol, hangi KPI/aksiyon/rank gorunecek netlesmeden layout uretilmez.
- Gorunen her metrik, aksiyon ve onerinin gercek veri kaynagi olmalidir.
  Kaynak yoksa motivasyonel/coaching metni, fake todo veya temsili skor
  yazilmaz; bolum ya gizlenir ya da dogru empty state alir.
- Operasyonel dashboard ilk viewportta kompakt olmalidir: kisa baslik,
  gerekli filtre, sinirli KPI kartlari, anlasilir trend ve data-driven action
  listesi. Uzun aciklama havuzlari ve cok parcali bilgi bloklari dagitilmaz.
- KPI kartlari tek basina anlamli olur: ana deger, hedef/ilerleme, durum,
  rank veya kapsam, varsa weight/puan katkisi ayni ritimde verilir. Yuzde,
  puan ve siralama bilgisi alelade chip/bar olarak dagitilmaz.
- Chart karari mobile-first verilir. Mobilde anlasilmayan aylik/haftalik
  grafik desktopta da dogru sayilmaz; checkpoint, tarih etiketi ve ozet copy
  veri okumayi kolaylastirmalidir.
- Sidebar/toolbar refactoru role-aware olmak zorundadir. Kullanici rolune
  tanimli olmayan sayfa navigasyonda gorunmez; mevcut route guard ile toolbar
  listesi birlikte kontrol edilir.
- Eski UI kalintisi sadece CSS rengi degildir. Eski class, eski hero iskeleti,
  eski copy, eski loading/empty state, rol disi link ve debug/handoff metni de
  kalinti sayilir.

UI iyilestirmesi business workflow degistirmez.

## Refactor Disiplini

Refactor icin gerekce gerekir:

- somut product/risk slice dokunuyor,
- dosya siniri gercekten review zorlastiriyor,
- davranis korunabiliyor,
- test kapsami var,
- rollback net.

Sadece satir sayisi yuksek diye mekanik refactor trenine donulmez.

## Dosya Satir Prensipleri

Satir sayisi tek basina kalite olcusu degildir, ama reviewability ve
maintainability icin erken uyari sinyalidir. Bu limitler soft guardrail'dir:
asildiginda otomatik rewrite degil, Sokrates triage gerekir.

File Size Guard V1 bu prensibi otomatik kontrol eder. Guard
`scripts/file-size-guard.test.mjs` icindedir ve `npm.cmd run test:scripts`
ile calisir.

Kural:

- Yeni aktif source dosyalari standart limitleri asamaz.
- Mevcut buyuk dosyalar frozen baseline olarak kalabilir, ama buyuyemez.
- Bir baseline dosyasi kuculup standart limite girerse exception kaldirilir.
- Limit asimi gerekiyorsa once Sokrates triage yapilir: gerekce, alternatif,
  rollback ve dogrulama netlesmeden guard gevsetilmez.
- Generated OpenAPI/type dosyalari guard disindadir; source generator dosyalari
  generated sayilmaz ve baseline ile dondurulur.

Genel kural:

- Yeni dosyalar mumkunse 300 satirin altinda kalir.
- 500 satir uzeri dosyada sorumluluk siniri tekrar sorgulanir.
- 800 satir uzeri dosya icin yeni ekleme yapmadan once extraction firsati
  aranir.
- 1200 satir uzeri dosyada dogrudan buyutme yerine planli split/inventory
  tercih edilir.
- 2000 satir uzeri dosya "kritik reviewability debt" sayilir; sadece cok
  zorunlu bugfix yapilir veya once refactor plani cikarilir.

Frontend hedefleri:

- React page/container: hedef 500-700 satir; 900 uzeri split adayi.
- React component: hedef 200-300 satir; 450 uzeri split adayi.
- Hook: hedef 150-250 satir; 350 uzeri sorumluluk siniri sorgulanir.
- Pure model/util/reducer: hedef 150-300 satir; 400 uzeri bolunur.
- E2E spec: hedef 500-800 satir; buyurse fixture/helper ayirma dusunulur.
- CSS entry dosyasi: hedef import/entry rolu; 250 satir uzeri sorgulanir.
- CSS partial/module: hedef 300-500 satir; 700 uzeri bolunur.

Backend hedefleri:

- Controller: hedef 200-350 satir; 500 uzeri endpoint boundary sorgulanir.
- Service/application file: hedef 400-700 satir; 900 uzeri domain/use-case
  boundary arastirilir.
- Repository facade: hedef 500-800 satir; 1000 uzeri read/write/domain split
  adayi.
- Repository implementation/helper: hedef 300-600 satir; 800 uzeri split adayi.
- DTO/schema/type dosyalari: hedef 200-400 satir; 600 uzeri domain bazli
  bolunur.
- Test file: hedef 500-900 satir; 1000 uzeri fixture/builder/helper ayirma
  dusunulur.

Istisnalar:

- Generated OpenAPI/type dosyalari.
- Lockfile'lar.
- Snapshot veya fixture-heavy dosyalar.
- Migration history dosyalari.
- Bilerek tek yerde tutulan decision/roadmap dokumanlari.

Bu istisnalar bile okunabilirlik veya review zorlugu yaratirsa belgeyle
aciklanir; fakat sirf satir sayisi icin davranis riski tasiyan refactor
yapilmaz.

## What Next Disiplini

"Siradaki ne?" sorusunda adaylar karsilastirilir:

- user value,
- risk reduction,
- blocker removal,
- blast radius,
- reviewability,
- rollback clarity,
- verification cost,
- external input ihtiyaci,
- postponing cost.

Net cevap soyle verilir:

- now: hemen en mantikli slice,
- next: sonraki aday,
- park: input veya karar bekleyenler,
- stop: hangi durumda durulacak.

## Iletisim Disiplini

Calisirken kisa ve sik durum verilir:

- neye baktigimi,
- ne ogrendigimi,
- hangi riski gordugumu,
- neden merge etmedigimi veya neden merge ettigimi.

Merge sirasinda kullaniciya ne yaptigimiz soylenir. Final cevapta en onemli
degisiklikler, test sonucu, PR/merge durumu ve kalan riskler kisaca verilir.

## Done Definition

Bir is ancak su durumda bitti sayilir:

- kapsam disina cikilmadi,
- diff okundu,
- local gate gecti,
- gerekiyorsa PR acildi,
- checks ve Codex onayi tamamlandi,
- merge sonrasi `origin/main` dogrulandi,
- gelecekteki devam icin gereken docs/current-state/evidence guncellendi,
- kalan riskler acikca soylendi.

## Stop Rules

Hemen dur ve raporla:

- conflict veya beklenmeyen diff varsa,
- check kirmiziysa,
- Codex actionable issue bulduysa,
- behavior-change riski belirdiyse,
- auth/API/DB/provider siniri istemeden aciliyorsa,
- external secret/input gerekiyorsa,
- PR review edilemeyecek kadar buyuyorsa,
- yeni kullanici talebi eski goal ile celisiyorsa.
