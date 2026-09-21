# Maintenance and workspace execution

Status: active
Shelf: operating reference
Use when: dependency bootstrap, refactor/file growth or workspace hygiene is in scope.

## Worktree Dependency Bootstrap

Yeni git worktree acildiginda `node_modules` beklenmez. `node_modules` git'e
girmez ve worktree'ler arasinda otomatik tasinmaz. Bu normaldir.

Yeni worktree'de ilk gate oncesi ihtiyaca gore bootstrap yap:

- Frontend isi varsa: `npm.cmd --prefix admin-web ci`.
- Backend isi varsa: backend dependency kurulumu yap.
- Playwright gerekiyorsa browser kurulum/check adimini dogrula.
- Sadece docs-only is varsa full release icin dependency kurulumu yapma.
  `git diff --check` minimumdur; active docs veya contract degisiyorsa uygun
  root script/contract testi de calistirilir.

Kural:

- "Module not found" gordugunde once worktree dependency bootstrap eksik mi
  kontrol et.
- Dependency kurulumunu behavior degisikligi sayma, ama lockfile degisirse
  sebebini anlamadan stage etme.
- Worktree'ler arasi `node_modules` symlink/junction paylasimi varsayilan
  cozum degildir; hiz kazandirabilir ama garip Windows ve lockfile sorunlari
  yaratabilir.
- Merge edilmis ve artik kullanilmayan worktree'ler status dogrulamasiyla
  otomatik temizlenmez. Branch, worktree, stash veya remote ref silme/tasima,
  drop, reset ya da rewrite ancak ayri dogrulanmis owner-onayli proposed-delete
  listesinde acikca yer aliyorsa yapilabilir.

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
