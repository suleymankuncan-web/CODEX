# Release and PR execution

Status: active
Shelf: operating reference
Use when: preparing a push, PR, release proof or merge. Read the applicable procedure completely.

## PR Disiplini

PR acmak icin minimum bar:

- Branch temiz ve `origin/main` uzerinden guncel.
- Diff beklenen dosyalardan olusuyor.
- Local gate gecmis.
- PR oncesi adversarial local review yapilmis.
- PR tek review hikayesi tasiyor.
- PR revert edilebilir.
- PR acikca neyi degistirmedigini soyluyor.

PR cok kucukse ve ayni hikayenin parcasiysa bekletilebilir. PR cok buyukse veya
birden fazla risk tasiyorsa bolunur.

### PR Check Beklerken Paralel Ilerleme

Owner'in 2026-07-10 tarihli acik karariyla, PR acildiktan ve lokal verification
tamamlandiktan sonra GitHub ve aktif Cloudflare frontend provider deploy check suresi bos bekleme suresi degildir.
Closer check, deployment ve mergeability durumunu arka planda izlerken sonraki
bagimsiz PR'in Scout, Planner, test veya implementasyon calismasi ayri bir
branch/worktree'de ilerletilir.

Bu concurrency merge kapilarini kaldirmaz; yalnizca bekleme suresini verimli
kullanir:

- Acik PR'in required check'leri, deployment durumu, mergeability'si ve yeni
  actionable yorumlari izlenmeye devam eder.
- Sonraki calisma, acik PR'in dosya, contract, migration veya workflow'una
  bagimliysa paralel implementasyon yapilmaz. Varsayilan izinli alan repo
  kesfi, finding-specific spec, test tasarimi ve gercekten bagimsiz diff'tir.
- Bagimsiz uygulama gerekiyorsa ayri `codex/` branch ve ayri worktree kullanilir.
  Acik PR'in branch'inde ikinci review hikayesi biriktirilmez.
- Sonraki PR acilmadan once merged `origin/main` ile yenilenir ve diff'in onceki
  PR'i gizli dependency olarak tasimadigi dogrulanir. Stacked PR ancak dependency
  PR body'de acikca yazilirsa kullanilir; varsayilan sira merge sonrasi acilistir.
- Acik PR'da failed check, actionable yorum, merge conflict veya branch drift
  gorulurse sonraki calisma guvenli bir noktada durdurulur; once acik PR
  duzeltilir ve yeniden dogrulanir.
- Ayni makinede iki root/full release suite eszamanli calistirilmaz. Targeted ve
  kaynak tuketimi cakismayan kontroller paralel olabilir; agir release kosulari
  siraya alinir.
- Check beklerken calisilan worktree, branch, stash veya remote ref otomatik
  temizlenmez; normal no-delete inventory kurali devam eder.
- Sonraki PR hazir olsa bile onceki PR'in check sonucu hakkinda erken yesil veya
  merge-ready iddiasi yapilmaz.

Aktif calisma varken Closer status'u guvenli kilometre taslarinda ve merge
kararindan hemen once yeniler. Bosta bekleme durumunda 55-60 saniyelik
kanonik loop kullanilir. Her iki modelde de merge karari ancak ayni taze
snapshot'ta tum required durumlar temizken verilir.

### Token-Verimli Otonom Yurutme

See [root execution policy](../../discipline.md#token-verimli-otonom-yurutme).

### Canonical Release Sure Ve Tekrar-Kosum Disiplini

Owner'in Eylul 2026 onayiyla canonical release suresi test kapsami azaltmadan
dusurulur. Guncel recovery contract `docs/plans/ci-incremental-recovery-v1.md`;
Temmuz wall-time plani tarihsel baseline olarak kalir.

- Root `npm.cmd run check:release` tek kanonik yerel giristir. Fresh kosu
  varsayilandir; onceki kosuda gec E2E gibi somut bir asama hatasi duzeltildiyse
  `npm.cmd run check:release -- --resume` kullanilir. Backend/static asamalar
  komut, Node/npm/platform, lockfile, ilgili kaynak/ortam ve gercek build
  ciktisi ayniysa SHA degisse bile onceki kaniti koruyabilir. Kaynak SHA ve
  mevcut execution SHA ayri kaydedilir; 24 saati gecen kanit kullanilmaz.
- Resume bir gate atlama mekanizmasi degildir. Yalniz atomic ve digest-bound
  basarili receipt tekrar kullanilir. Eksik, bozuk, stale, farkli input'lu veya
  unknown receipt fresh kosuya doner; root contracts ve dependency audit volatile'dir ve her
  resume'da yeniden kosar.
- Backend release, frontend static ve audit kaniti bagimliliklari izin verdigi
  anda paralel kosabilir. Frontend E2E frontend static PASS olmadan baslamaz;
  frontend build ve tam Playwright suite fresh kosuda birer kez kosar.
- GitHub Actions'ta root, backend, frontend static, frontend E2E ve volatile
  audit proof aileleri native ayri job'lardir. Ayni SHA'da gec bir hata sonrasi
  `Re-run failed jobs` kullanilir; yesil sibling job'lar sebepsiz yeniden
  kosturulmaz. Required aggregate selected child eksik, skipped, cancelled,
  timed-out veya failed ise fail-closed kalir.
- GitHub Actions problem bulma, hipotez deneme veya debug laboratuvari olarak
  kullanilmaz. Ilk push'tan once exact HEAD icin verification ladder, targeted
  kanitlar ve selector'in sectigi canonical yerel kanit yesil olmalidir;
  GitHub yalniz temiz Linux runner'da bagimsiz yeniden dogrulama yapar.
- Bir GitHub job'i kirmiziysa kor push/rerun dongusu acilmaz. Once failure'in
  exact alt asamasi yerelde yeniden uretilir, tek kok neden dar bir diff ile
  duzeltilir ve ilgili yerel kanit tekrar yesile getirilir. Ancak bundan sonra
  yeni push yapilir; yeni SHA yeni run gerektirir. Native `Re-run failed jobs`
  eski run'in SHA'sini degistirmez.
  Ag/429/5xx icin mevcut sinirli retry kurali bu disiplini gevsetmez.
- Harici release-rehearsal observer tek kanit otoritesi olarak exact
  `release-rehearsal.yml` workflow run'ini kullanir. Event, PR numarasi, base
  SHA, head SHA ve en yeni run/attempt birebir uyusmadan PASS kabul edilmez;
  eski bir basari yeni pending veya failure'i maskeleyemez. Yalniz ag hatasi,
  HTTP 429 ve 5xx 55-60 saniyelik butce icinde yeniden denenir; diger provider
  contract hatalari ve tukenen butce fail-closed kalir.
- Manual image/offline proof dispatch oncesinde exact clean committed HEAD
  icin `npm.cmd run check:onprem:dispatch -- prove` zorunludur; push sonrasinda
  yalniz `publish`, ardindan wrapper `dispatch image|offline` kullanilir.
  Automatic PR/reusable workflows once bounded exact-SHA
  `github-source-preflight` kosar; GitHub runtime prooflari bagimsiz final
  kanittir, hata ayiklama ortami degildir; coverage veya retry azaltimi
  yapilmaz.
- Release rehearsal Docker/live fixture ve smoke kanitini korur, fakat ayni
  required gate'in zaten calistirdigi backend lint/Jest/build/audit paketini
  ikinci kez kosturmaz. Post-merge exact-tree reuse kesin degilse full release
  fallback devam eder.
- Test kapsami, lint, build, API check ve audit korunur. E2E'de yalniz explicit
  reviewed isolated spec listesi sonuc koruyabilir; degisen/basarisiz veya
  incelenmemis spec yeniden kosar. Shared input, inventory veya browser
  degisikligi tam kosu gerektirir. Skip/flaky/global error PASS sayilmaz;
  mevcut tam inventory, executed + retained union ile birebir dogrulanir.
- CI recovery artifact'lari 1 gun tutulur; yalniz ayni repository/PR/base,
  en yeni onceki run/attempt, workflow, tested merge tree, job sonucu ve
  artifact digest dogrulanirsa kullanilir. Yerel kanit CI kaniti olmaz.
  Eksik veya belirsiz API/artifact bilgisi fresh kosuya doner.
  `node_modules` cache'lenmez. On-prem runtime kaniti SHA'lar arasinda tasinmaz.
- Required gate p95 hedefi 13 dakika, DAG hedefi 12 dakika 30 saniyedir.
  Toplam runner-minute eski on-kosu baseline'inin 110%'unu asarsa veya wall-time
  kazanci coverage/izolasyon riski yaratirsa otomatik optimizasyon durur ve yeni
  owner karari gerekir.
- Tek makinede ikinci canonical full gate ayni anda acilmaz. Yerel lock,
  child-process cleanup ve receipt yazimi Windows dahil fail-closed test edilir.
- PR/aktif frontend provider bosta polling 55-60 saniyedir; check izlemek icin model agent
  acilmaz. Basarili uzun log yerine state transition ve sinirli failure tail
  raporlanir.

### PR Oncesi Adversarial Review

GitHub Codex review owner karariyla devre disidir. Lokal adversarial review,
acik hata siniflarini PR acilmadan yakalayan aktif review backstop'udur.

Bu kural proje geneli calisma prensibidir; sadece hardening, guard veya mimari
PR'lar icin degildir. Her PR acilmadan once ve her yeni push oncesinde lokal
adversarial review yapilir.

Zorunlu lokal review pass:

1. `git diff --stat` ile diff'in tek review hikayesi tasidigini dogrula.
2. `git diff --check` calistir.
3. Degisen dosyalari tek tek oku; scope creep, behavior drift, fake data,
   layer leak, broad cast ve buyuk dosya buyumesi ara.
4. Backend degisikliklerinde yeni direct `DatabaseService` importu,
   application-to-web importu, web-to-infrastructure importu, yeni broad
   `as unknown as` repository cast'i ve allowlist genislemesi ara.
5. Frontend degisikliklerinde role-disinda UI, fake metric/copy, eski Store UI
   class'lari, debug/handoff copy ve mobile/desktop kirilma riski ara.
6. PR slice'ina uygun targeted verification'i PR description yazmadan once
   calistir.
7. Sert bir reviewer'in bulmasi muhtemel P1/P2 notlarini kendin listele;
   actionable olanlari PR acmadan once duzelt.

Her PR acilmadan veya review isteyen yeni push'tan once diff'e su gozle bak:

- Degisiklik nasil delinebilir?
- Allowlist, guard veya validation duplicate, path varyasyonu, type-only import,
  barrel/re-export ya da ayni signature tekrariyla atlatilabilir mi?
- Negatif test sadece happy-path'i mi donduruyor, yoksa gercek bypass
  senaryosunu fail ettiriyor mu?
- Yeni script/guard mevcut exception'i donduruyor mu, yoksa butun dosyayi veya
  genis domaini sessizce muaf mi birakiyor?
- UI PR'inda prototype, role/scope matrix, mobile/desktop durumlari ve eski UI
  kalintisi taramasi PR oncesi yapildi mi?
- Docs/process PR'inda yeni kuralin enforcement noktasi veya en azindan
  verification beklentisi acik mi?

Guard ve mimari script PR'larinda minimum negatif test matrisi:

- allowlist disi yeni ihlal,
- allowlist icinde duplicate ihlal,
- type-only import/re-export edge'i,
- side-effect static import edge'i,
- namespace import edge'i,
- yorum veya string icindeki sahte import ile allowlist kandirma denemesi,
- barrel `export * from` edge'i,
- ayni dosyada mevcut exception korunurken yeni exception ekleme girisimi.

Bu preflight temiz degilse PR acilmaz; PR acildiysa yeni push yapmadan once
duzeltilir. GitHub Codex yine actionable yorum bulursa normal merge disiplini
gecerlidir: yorum duzeltilir, ilgili local gate yeniden kosulur ve review tekrar
beklenir.

### Repo-Native Subagent Review Model

See [root execution policy](../../discipline.md#repo-native-subagent-review-model).

### Adaptive Reasoning Effort Routing

See [root execution policy](../../discipline.md#adaptive-reasoning-effort-routing).

### Pilot Subagent Orchestration Discipline

See [root execution policy](../../discipline.md#pilot-subagent-orchestration-discipline).

## Merge Disiplini

Merge icin her zaman gerekenler:

- Local verification gecti.
- GitHub ve aktif Cloudflare frontend provider deployment checks yesil.
- PR mergeable.

Kontrollu PR'larda varsayilan strateji squash merge'dir. Tek parent ve ayni tree
kaniti post-merge exact-tree reuse yolunu korur ve gereksiz ikinci full release'i
onler. Merge commit veya rebase merge ancak belgelenmis bir istisna ve fail-safe
post-merge full release maliyeti kabul edilerek kullanilir.

Owner'in 2026-07-10 tarihli acik karariyla GitHub Codex review devre disidir:

- `@codex review` yazilmaz,
- baska bir entegrasyon uzerinden Codex review istenmez,
- bot reaction/comment beklenmez ve merge kapisi sayilmaz,
- ancak daha yeni acik owner talimatiyla yeniden etkinlestirilir.

Bu karar required check, aktif frontend provider/deploy check, mergeability, local adversarial
review, diff scope okuma veya verification'i waive etmez. Insan reviewer ya da
baska bir otomatik kontrol actionable yorum birakirsa normal sekilde okunur ve
cozulur.

GitHub kontrolu tek seferlik snapshot degildir. PR acildiktan veya branch'e yeni
push geldikten sonra merge karari verilene kadar gereken durum birlikte
degerlendirilir:

- GitHub Actions checks,
- aktif Cloudflare frontend provider/deploy checks,
- status check rollup,
- mergeability / branch state.

Bosta bekleniyorsa bu durumlar 55-60 saniyelik kanonik loop ile tekrar cekilir.
Sonraki bagimsiz PR uzerinde calisiliyorsa `PR Check Beklerken Paralel Ilerleme`
kurali uygulanir; status guvenli kilometre taslarinda ve merge kararindan hemen
once yenilenir. Tum required checks yesil, PR mergeable ve final lokal diff
review temiz oldugunda izleme biter. Failed check, pending belirsizlik veya yeni
actionable insan/tool yorumu gorulurse merge yapilmaz; once sebep okunur,
gerekirse duzeltme push'lanir ve izleme yeniden baslatilir.
