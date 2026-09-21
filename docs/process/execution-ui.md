# UI and prototype execution

Status: active
Shelf: operating reference
Use when: UI/prototype/redesign/refactor is in scope; read the relevant sections.

## UI/UX Disiplini

Admin/SaaS yuzeyleri sessiz, operasyonel, yogun ama okunabilir olmalidir.

UI/prototype/redesign/refactor veya workflow-heavy Store/Admin yuzeyi varsa
`docs/process/product-experience-principles.md` zorunlu urun deneyimi
referansidir. Bu dosya her gorev icin besinci read-first dokumani degildir;
sadece product experience, sayfa yapisi, interaction, mobil aksiyon veya gorsel
kalite degistiren islerde okunur. Ana kural: clean but premium, decorative
degil; visually strong ama operationally honest.

Bu tur islerde `docs/process/ui-surface-standard-v1.md` de uygulanir. Bu
standart shadcn-first component secimi, Button varyant anlamlari, lucide ikon
sinirlari, semantic token kullanimi, product copy hijyeni ve sayfa anatomisini
kalici UI sozlesmesi olarak tanimlar.

Store/Admin operasyonel yuzeylerinde
`docs/process/store-admin-surface-standardization-v1.md` de uygulanir. Guncel
kanonik yuzey referansi Region Manager prim command-center prototipidir; bu
referans her sayfayi prim sayfasina cevirmek icin degil, kompakt premium
yogunluk, sakin tipografi, metrik karti ikon ritmi, shadcn toolbar, drawer,
dialog, status copy ve mobile davranis kalite citasini sabitlemek icindir.

Operational Store/Admin UI uses the bounded project skill
[hr-axis-ui](../../.agents/skills/hr-axis-ui/SKILL.md). It preserves design-read,
density, anti-slop, copy, accessibility and desktop/mobile quality checks without
loading unrelated marketing recipes. External taste-skill is optional only for
explicit landing/marketing scope; it never overrides project contracts.

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
- Admin sayfa refactorlerinde ortak sayfa iskeleti `AdminSurface*`
  primitive katmanidir. Yeni veya migrate edilmis admin page dosyalari bu
  katmana baglanir; henuz migrate edilmemis yuzeyler sadece acik exception
  allowlist ile eski primitive/class dilini gecici olarak tasiyabilir.
- Plum Glacier pilot dili kullaniliyorsa renk/token daginikligi geri
  getirilmez. Yeni pilot/refactor sayfalari eski krem/teal foundation
  gorunumuyle plum/glacier iskeleti karistirmaz.
- UI pilotlarinda aktif renk sozlugu
  `docs/prototypes/plum-glacier-token-set-v1.md` dosyasidir. Bu karar global
  tema rewrite'i degildir; login ve sonraki yeni/refactor edilen sayfalarda
  tek token setiyle ilerleme disiplinidir.
- Kullanici bir HTML/prototip ciktisini "bunu sayfaya gecir", "birebir olsun"
  veya benzeri sekilde onayladiginda prototip artik sadece ilham degil,
  implementation contract'tir. Uretim sayfasi mevcut eski iskeletin
  giydirilmis hali olarak kalamaz. Layout, renk paleti, spacing, satir/kart
  ritmi, status tone'lari, modal/drawer modeli ve interaction akisi prototipten
  tasinir; demo-only kontroller, fake veri ve rol switch gibi prototip
  yardimcilari ise kaldirilir. Gercek veri, role/scope, permission,
  accessibility, responsive davranis veya eksik backend contract nedeniyle
  sapma gerekiyorsa bu sapma evidence dosyasinda acikca yazilir.
- Prototip copy'si production copy contract'idir. Prototipte temiz gorunen
  baslik, filtre, status, metrik, drawer, empty/error ve confirmation metinleri
  production'da internal/source/scope/debug diliyle degistirilemez. Rol,
  permission, eksik veri veya backend contract nedeniyle fark gerekiyorsa bu
  fark uygulama tamam denmeden once kayda gecirilir.
- Prototype-to-product UI slice'i desktop ve mobile screenshot karsilastirmasi
  olmadan bitmis sayilmaz. Screenshot prototiple maddi olarak uyusmuyorsa
  "yaklasti" yeterli degildir; sayfa tekrar duzeltilir veya hangi urun/contract
  sebebiyle birebir tasinamadigi acik stop notu olarak verilir.

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
- Store sayfa refactorlerinde final consistency pass zorunludur: aktif Store
  route'larinda eski primitive/class/copy taranir, role disi toolbar linkleri
  kontrol edilir, parked route istisnalari acikca belgelenir, mobil/desktop
  verification kosulur ve current-state/evidence guncellenir.
- Parked Store route'lari sessizce yeni urun UI'ina alinmaz. Bir route ancak
  owner onu acikca kapsamladiginda ve real data/role/workflow contract'i
  tanimlandiginda productize edilir. `/store/incentives` bu kosulu daha sonra
  Sales Target Incentive V1 ile saglamistir; artik parked route ornegi degildir.

### Prototype to Product

HTML/prototype begenilmis olsa bile product implementation sayilmaz. Product'a
tasinmadan once su pass zorunludur:

- Production-bound prototype runtime: Kullanici prototipi "birebir", "tam
  implement" veya "sayfaya gecir" diyerek production beklentisine cevirdiyse
  kabul artefakti standalone HTML olamaz. Store/Admin yuzeyleri icin kabul
  edilecek prototip React + proje shadcn/ui + Tailwind v4 `tw:` + lucide +
  AdminSurface/StoreSurface primitive katmani icinde uretilir. HTML sadece
  konsept eskizidir; production parity claim'i icin once ayni rhythm shared
  primitive veya app-ici slice'a tasinir.
- Production-contract faithful prototype: UI prototipi varsayilan olarak yeni
  feature onerisi degildir; mevcut production route/component/API/query/model,
  role/scope, state ve workflow contract'inin daha iyi gorsellestirilmesidir.
  Prototip uretmeden once hedef yuzeyin route'u, component'i, veri contract'i,
  aksiyonlari, role gorunurlugu ve loading/empty/error/access state'i okunur.
  Prototipte mevcut projede olmayan metric, filtre, tarih semantigi, sosyal
  etkilesim, notification, detail action, media upload, workflow adimi veya
  backend alan gerekiyorsa bu parca acikca `contract-discovery / future idea`
  olarak etiketlenir ve kullanici ayrica kapsamlamadan product
  implementation'a tasinmaz.
- Project UI quality pass: design read, density, operasyonel karar akisi,
  anti-slop preflight, mobile/desktop kalite ve copy denetimi yapildi mi?
- Gercek veri mapping'i: her gorunen metrik, liste, status ve aksiyon hangi
  API/query/model/config alanindan geliyor?
- Role matrix: hangi rol hangi sekme, toolbar item, route ve aksiyonu gorecek?
- Contract check: yeni API shape gerekiyor mu, yoksa mevcut contract yeterli mi?
- State modeli: loading, empty, error, access denied ve partial-data durumlari
  nasil gorunecek?
- Responsive QA: desktop ve mobile viewportta text overflow, yatay kayma,
  buton/toolbar tasmasi ve modal kullanilabilirligi kontrol edildi mi?
- Eski UI cleanup: eski class, copy, loading/empty state, debug/handoff metni ve
  role disi navigation temizlendi mi?
- Verification: targeted Playwright/component/backend test veya bilincli
  docs-only karar PR'da yazildi mi?

Bu pass tamamlanmadan prototype tasarimi "bitti" sayilmaz; sadece taslak veya
visual direction sayilir.

UI iyilestirmesi business workflow degistirmez.
