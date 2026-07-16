# Work Discipline

Status: active
Shelf: operating
Last verified: 2026-07-16

Bu dosya HR Axis / Store Ops projesinde Codex ile kullanilan pratik calisma
disiplinidir. `sokrates.md` karar kalitesinin kanonik kaynagidir; bu dosya ise
gundelik is akisini, PR ritmini, dogrulama disiplinini ve durma kurallarini
tek yerde toplar.

## Isletim Dokumanlari Rol Haritasi

Bu repo dort ana isletim dokumaniyla calisir:

- `CONTRIBUTING.md`: kisa repo sozlesmesi ve minimum contributor beklentisi.
- `current-state.md`: canli handoff, son merge durumu, parked kararlar,
  caveat'ler ve taze proje gercegi.
- `sokrates.md`: karar kalitesi, risk muhakemesi, onceliklendirme, ne zaman
  durulacagi veya soru sorulacagi.
- `discipline.md`: gundelik execution, PR/merge, verification, UI/refactor,
  dosya boyutu ve done/stop isletim sistemi.

Tekrar eden kurallar bilerek vardir: `CONTRIBUTING.md` hizli sozlesme,
`discipline.md` uygulama detayi, `sokrates.md` karar muhakemesi verir. Celiski
gibi gorunurse:

- taze durum ve aktif caveat icin `current-state.md`,
- karar verme ve risk siniflandirma icin `sokrates.md`,
- PR/merge/verification/UI/refactor uygulamasi icin `discipline.md`,
- minimum contributor sozlesmesi icin `CONTRIBUTING.md`

kanonik kabul edilir.

## Bu Dosya Nasil Okunur

Bu dosya tek parca kalir; alt process dosyalarina bolunmedigi surece baglayici
isletim sistemi buradadir. Hizli navigasyon icin:

- Genel calisma: `Baslangic Ritueli`, `Ana Ilke`, `Calisma Ritmi`.
- Kodlama freni ve scope: `Istisare ve Kodlama Freni`, `Slice Disiplini`,
  `PR Risk Class`, `Feature Intake`.
- PR ve merge: `PR Disiplini`, `PR Oncesi Adversarial Review`,
  `Repo-Native Subagent Review Model`, `Pilot Subagent Orchestration
  Discipline`, `Merge Disiplini`.
- Verification: `Verification Ladder`, `External Evidence Disiplini`.
- UI refactor: `UI/UX Disiplini`, `Prototype to Product`, Store Me
  refactorundan cikan tekrar kullanilabilir sayfa kurallari,
  `docs/process/product-experience-principles.md`,
  `docs/process/ui-surface-standard-v1.md` ve taste-skill kalite pass'i.
- Mimari/refactor: `Hard Boundaries`, `Refactor Disiplini`,
  `Dosya Satir Prensipleri`.
- Risk ve durma: `Regression Trap Register`, `Stop Rules`,
  `Done Definition`.

## Baslangic Ritueli

Her yeni oturumda veya context kaybi sonrasi minimum baslangic:

1. `CONTRIBUTING.md` oku.
2. `current-state.md` oku.
3. `origin/main` ve local git durumunu kontrol et.
4. Root working tree kirliyse unrelated degisikliklere dokunma.
5. En guncel talebi eski plandan ustte tut.
6. Hedefi, riskleri, ilk guvenli adimi ve dogrulama yolunu netlestir.

Sonra riske gore katmanli oku:

- karar, belirsizlik, onceliklendirme veya orta/yuksek risk varsa
  `sokrates.md`;
- implementasyon, PR, verification, merge, UI/refactor veya workspace hygiene
  varsa bu dosyanin ilgili bolumleri;
- yeni multi-PR hat, yuksek risk veya gercek context recovery varsa dort dosya
  tamamen.

Dar read-only soru veya dusuk riskli mekanik iste tam dortlu okuma zorunlu
seremoni degildir. `current-state.md` tarih arsivi olarak kullanilmaz; eski PR
treni gerekiyorsa onun linkledigi historical archive acilir.

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

Karpathy prensibi bu ritmin icinde gecerlidir: once dusun, basit tut, cerrahi
degisiklik yap ve basari kriterini dogrulanabilir yaz. Her degisen satir
kullanici istegine, repo kanitina veya gerekli verification/cleanup sonucuna
baglanabilmelidir. Baglanamiyorsa o satir scope creep'tir.

Zayif basari kriteri ile kodlamaya baslanmaz. "Calissin", "daha iyi olsun" veya
"modernlestir" gibi hedefler once test, screenshot, role matrix, API contract,
guard veya PR closeout kriterine cevrilir.

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

### PR Risk Class

Her PR acilmadan once PR body veya plan notunda risk sinifi secilir. Risk
sinifi verification ladder'i ve review derinligini belirler.

- `R0 docs/process`: Kod yok. Gate: `git diff --check`; gerekirse
  `npm.cmd run test:scripts`.
- `R1 UI-only`: Veri contract'i ve workflow degismez. Gate: frontend lint,
  build, ilgili visual/mobile kontrol.
- `R2 frontend data binding`: Mevcut API/model verisi ekrana farkli baglanir.
  Gate: frontend lint/build, targeted Playwright veya component/e2e coverage.
- `R3 backend read/API`: Read model, DTO veya API response riski vardir. Gate:
  targeted backend test, build, API contract gerekiyorsa generate/check.
- `R4 backend write/workflow`: Komut, state transition, persistence veya audit
  yolu vardir. Gate: targeted unit/e2e, backend build, gerekirse release gate.
- `R5 auth/DB/scoring/queue`: Auth, permission, migration, KPI/ranking,
  snapshot, BullMQ/import lifecycle veya provider davranisi vardir. Gate:
  explicit plan, negative tests, full relevant release/check path ve
  PR'da `Contract Impact` basligi.

PR sinifi yanlis secilirse merge edilmez; once sinif ve verification duzeltilir.

### Feature Intake

Yeni feature veya ekran baslamadan once, uygulanabilir oldugu kadar kisa intake
yapilir:

- Kullanici/persona kim?
- Ana is akisi ve tek primary action ne?
- Hangi gercek API/query/model/config verisi kullanilacak?
- Role/scope/permission etkisi var mi?
- API response shape, DB, auth, scoring, queue veya workflow degisiyor mu?
- Loading, empty, error ve access state ne?
- Basari nasil dogrulanacak: test, screenshot, smoke, guard veya PR check?
- Neyi bilincli olarak yapmiyoruz?

Bu sorular repo'dan cevaplanabiliyorsa kullaniciya sorulmaz; sadece urun
karari gerektiren boslukta durulur.

### No Silent Contract Change

API response shape, auth/permission, DB schema/migration, scoring, ranking,
snapshot interpretation, checklist weight, queue/import lifecycle veya
user-facing workflow davranisi degisiyorsa PR'da acik `Contract Impact` notu
zorunludur:

- `Contract Impact: none`
- `Contract Impact: intentionally unchanged`
- `Contract Impact: changed` ve degisen contract listesi

Bu baslik olmadan riskli PR merge edilmez.

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
tamamlandiktan sonra GitHub/Vercel check suresi bos bekleme suresi degildir.
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

Owner'in 2026-07-15 tarihli kilitli karariyla, ayni aktif hedef icinde kanit
kalitesini dusurmeden model token kullanimi asgari tutulur. Bu karar ancak owner
acikca degistirirse gevsetilir:

- Bosta check/release polling araligi 55-60 saniyedir. Daha sik model turu
  yalniz state transition, fail-fast sinyali veya kullanici mesaji varsa acilir.
- Polling native GitHub/Vercel komutu veya background shell watcher ile yapilir;
  yalniz beklemek icin model agent acilmaz.
- Basarili uzun loglar modele tasinmaz. Yalniz sonuc ozeti, degisen durum ve
  failure halinde hatayi aciklayan sinirli tail/ilgili satirlar alinir.
- Ayni hedefte tamamen okunmus operating docs, plan ve skill dosyalari drift
  sinyali yoksa tekrar okunmaz. Fresh Git/runtime gercegi yine her slice'ta
  dogrulanir.
- High/XHigh yalniz `AGENTS.md` routing kosulu gercekten olustugunda kullanilir;
  rutin implementation, polling ve acik mekanik hata icin specialist acilmaz.
- Canonical full release oncesi gerekli package binary'leri, dependency
  link/junction'lari ve komut erisimi ucuz bir preflight ile dogrulanir.
- Targeted kanit normalde bir kez, selector'in sectigi full release normalde bir
  kez calistirilir. Yeniden kosu ancak somut hata onceki kaniti gecersiz kildiysa
  yapilir; nedeni handoff'ta yazilir.
- Check beklerken yalniz gercekten bagimsiz is ilerletilir. Gereksiz durum
  anlatimi, yinelenen plan ozeti ve buyuk tool output'u uretilmez.

### Canonical Release Sure Ve Tekrar-Kosum Disiplini

Owner'in 2026-07-16 tarihli kilitli karariyla canonical release suresi test
kapsami azaltmadan dusurulur. `docs/plans/canonical-release-gate-wall-time-
optimization-v1.md` ayrintili contract'tir; bu bolum kalici isletim kuralidir:

- Root `npm.cmd run check:release` tek kanonik yerel giristir. Fresh kosu
  varsayilandir; onceki kosuda gec E2E gibi somut bir asama hatasi duzeltildiyse
  ayni HEAD, manifest, komut, Node/platform, lockfile ve tracked/non-ignored
  workspace kimliginde `npm.cmd run check:release -- --resume` kullanilir.
- Resume bir gate atlama mekanizmasi degildir. Yalniz atomic ve digest-bound
  basarili receipt tekrar kullanilir. Eksik, bozuk, stale, farkli input'lu veya
  unknown receipt fresh kosuya doner; dependency audit volatile'dir ve her
  resume'da yeniden kosar.
- Backend release, frontend static ve audit kaniti bagimliliklari izin verdigi
  anda paralel kosabilir. Frontend E2E frontend static PASS olmadan baslamaz;
  frontend build ve tam Playwright suite fresh kosuda birer kez kosar.
- GitHub Actions'ta root, backend, frontend ve volatile audit proof aileleri
  native ayri job'lardir. Gec bir hata sonrasi
  `Re-run failed jobs` kullanilir; yesil sibling job'lar sebepsiz yeniden
  kosturulmaz. Required aggregate selected child eksik, skipped, cancelled,
  timed-out veya failed ise fail-closed kalir.
- Release rehearsal Docker/live fixture ve smoke kanitini korur, fakat ayni
  required gate'in zaten calistirdigi backend lint/Jest/build/audit paketini
  ikinci kez kosturmaz. Post-merge exact-tree reuse kesin degilse full release
  fallback devam eder.
- Test, spec, lint, build, API check, audit, Playwright test secimi veya coverage
  hiz ugruna azaltilmaz; retry/skip ile hata gizlenmez ve yeni worker/shard
  deneyi acilmaz.
- Basarili PASS receipt'leri Actions cache/artifact olarak tasinmaz,
  `node_modules` cache'lenmez. Yalniz npm download cache'i kullanilabilir.
- Required gate p95 hedefi 13 dakika, DAG hedefi 12 dakika 30 saniyedir.
  Toplam runner-minute eski on-kosu baseline'inin 110%'unu asarsa veya wall-time
  kazanci coverage/izolasyon riski yaratirsa otomatik optimizasyon durur ve yeni
  owner karari gerekir.
- Tek makinede ikinci canonical full gate ayni anda acilmaz. Yerel lock,
  child-process cleanup ve receipt yazimi Windows dahil fail-closed test edilir.
- PR/Vercel bosta polling 55-60 saniyedir; check izlemek icin model agent
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

Dis arac veya yeni runtime bagimliligi eklemeden, buyuk veya riskli islerde
subagent benzeri coklu bakis modeli uygulanir. Bu model Pi subagent tarzindaki
scout/planner/worker/reviewer ayrimini surec prensibi olarak kullanir; projeye
paket, extension veya runtime dependency eklemek anlamina gelmez.

Roller:

- `Scout`: Kod yazmadan once repo kanitini toplar. Ilgili dosya, test, guard,
  docs, auth/helper, API client ve onceki PR kararlarini bulur. Varsayimla
  bosluk doldurmaz.
- `Planner`: Scout kanitindan kucuk, geri alinabilir slice plani cikarir.
  Scope, risk, rollback ve verification ladder'i netlestirir.
- `Worker`: Sadece onaylanan slice'i uygular. Business workflow, auth, API,
  DB, scoring, queue veya provider davranisini gizlice degistirmez.
- `Reviewer`: Worker diff'ini yeni gozle okur. P1/P2 sinifi muhtemel reviewer
  notlarini, guard bypass'larini, test bosluklarini, fake veri riskini ve
  scope creep'i PR acilmadan yakalamaya calisir.
- `Closer`: PR acma, GitHub/Vercel checks, mergeability, final lokal review,
  merge ve merge sonrasi `origin/main` dogrulamasini yurutur.

Kullanim kurali:

- Dusuk riskli docs-only veya tek satirlik net duzeltmelerde bu roller zihinsel
  checklist olarak uygulanir; ayri seremoniye donusturulmez.
- Mimari hardening, auth/permission, import lifecycle, KPI/ranking/snapshot,
  workflow-heavy Store sayfalari, guard/script degisiklikleri ve buyuk UI
  refactorlerinde roller acikca ayrilir.
- Reviewer pass, Worker'in kendi diff'ine bagli kalmaz; mumkunse once git
  diff okunur, sonra test/guard edge'leri dusunulur, sonra PR metni yazilir.
- Reviewer "sert bir reviewer bunu sorun eder mi?" sorusunu pratik olarak
  sorar. Cevap evetse
  PR acmadan once duzeltme yapilir.
- Her rol repo kanitina dayanir. Gercek veri/API/model yoksa uydurma metrik,
  fake workflow, sahte skor veya temsili business sonucu eklenmez.

Bu model `PR Oncesi Adversarial Review` kuralini genisletir. GitHub Codex
review owner-disabled kalir; lokal reviewer modeli final diff kalitesini ve
guard/test bosluklarinin erken bulunmasini guclendirir.

### Adaptive Reasoning Effort Routing

Codex calismasinda zeka seviyesi her adimda en yuksek tutulmaz; gorevin risk ve
muhakeme ihtiyacina gore yonlendirilir. Kanonik yapilandirma
`.codex/config.toml`, role overlay'leri `.codex/agents/*.toml`, otomatik
delegasyon giris sozlesmesi ise root `AGENTS.md` dosyasidir. Bu bolum politika
kaynagidir; `AGENTS.md` ayni politikayi Codex icin calistirilabilir ve kisa
talimata cevirir.

Varsayilan model:

- `Medium root coordinator`: scope, kodlama, test, entegrasyon, PR/merge ve
  handoff tek elde kalir. Acik plani yurutme, mekanik duzeltme, docs, check
  takibi ve normal implementasyon Medium'da yapilir.
- `XHigh planner`: kapsamli plan/spec, mimari veya multi-PR hat, katmanlar arasi
  bagimlilik, acceptance/rollback/sequencing belirsizligi ya da scope,
  acceptance, rollback ve verification'i kilitlenmemis R3-R5 is icin
  implementasyondan once salt-okunur planlama yapar.
- `High problem solver`: iki kanitli denemeden sonra suren hata, ilk odakli
  incelemede nedeni bulunamayan check, celisen repo/runtime kaniti, auth,
  security, DB, data integrity, migration, concurrency veya production safety
  riski icin sinirli salt-okunur inceleme yapar. R4/R5 diff'te final lokal
  adversarial review de High ile yapilir.

Yonlendirme akisi:

1. Ana koordinator risk sinifini ve kabul kriterini belirler.
2. Planlama tetikleyicisi varsa `planner_xhigh` yalnizca kanit, slice, risk,
   rollback ve verification plani uretir.
3. Medium ana koordinator plani `sokrates.md` ile kontrol eder ve uygular.
4. Problem tetikleyicisi cikarsa rutin uygulama guvenli noktada tutulur;
   `problem_solver_high` dar root-cause/review sorusunu inceler.
5. Medium ana koordinator oneriyi repo kanitiyla kabul veya reddeder, gerekli
   degisikligi kendisi yapar ve normal verification/closeout'a doner.

Verim ve guvenlik guardrail'leri:

- R0 docs duzeltmesi, tek satirlik mekanik fix, acik adimlari olan onayli plan
  veya yalniz check izleme icin High/XHigh agent acilmaz.
- High/XHigh agent dosya edit etmez, commit/push/PR/merge/deploy yapmaz ve owner
  karari vermez. Bu, ayni dosyada iki implementer cakismasini engeller.
- Varsayilan bir uzman agent'tir. Planner ve problem solver ancak gercekten
  bagimsiz sorulari varsa paralel calisir.
- PR check polling icin model agent acilmaz. Kanonik `gh`/Vercel watcher veya
  mevcut background shell loop bekler; bekleme suresi reasoning token'i
  tuketmez. Durum degisince Medium sonucu siniflandirir ve acik hatayi ele alir.
  Koku ilk odakli incelemede aciklanamiyorsa veya High-risk siniri varsa
  `problem_solver_high` devreye girer.
- Ayni problem icin ilk net hata mesajinda High'a cikilmaz; once Medium tek
  odakli inceleme ve en fazla iki kanitli fix denemesi yapar. Auth/security/DB
  destructive riskinde bu bekleme uygulanmaz, dogrudan High inceleme kullanilir.
- Uzman sorusu cevaplaninca agent kapatilir; rutin implementation High/XHigh'da
  surdurulmez.
- Role konfigurasyonu istemcide yuklenmezse calismis gibi raporlanmaz. Capability
  failure acik yazilir ve `sokrates.md` risk/stop kurali uygulanir.
- Project config yalniz yeni Codex task'larinda garanti edilir. Acik task'in
  reasoning seviyesi kendiliginden degisti varsayilmaz.

Bu politika ana agent'in task ortasinda fiziksel olarak Medium/High/XHigh
ayarini degistirdigi anlamina gelmez. Otomasyon, Medium ana koordinatorden
farkli reasoning overlay'i olan salt-okunur uzman agente gorev delegasyonudur.
Codex Plan Mode kullanilirsa `plan_mode_reasoning_effort = "xhigh"` ayrica
uygulanir.

### Pilot Subagent Orchestration Discipline

Bu bolum gecici/pilot calisma disiplinidir. Surec olgunlasinca kaldirilabilir,
daraltilabilir veya kalici role modeline tasinabilir.

Varsayilan model:

- Ana koordinasyon, kapsam karari, uygulama birlestirme, PR karari ve merge
  sorumlulugu tek elde kalir.
- Subagentler once arastirma, denetim, kanit toplama ve review icin kullanilir.
- Ayni dosya veya ayni workflow uzerinde birden fazla implementer subagent
  paralel calistirilmaz.
- Paralel implementasyon sadece dosya/katman sinirlari gercekten bagimsizsa
  kullanilir.
- Subagent bulgusu karar degil, kanittir. Nihai karar ana koordinatorde kalir.

Standart akisi:

1. Task hedefi, risk sinifi ve kabul kriteri netlestirilir.
2. Is bagimsiz inceleme alanlarina ayrilir: UI, veri/API, role/scope, test,
   performans veya PR hygiene.
3. Her subagent'e yalnizca kendi alanina yetecek kapali ve dar prompt verilir.
4. Subagentler repo kaniti, risk, onerilen fix ve verification ihtiyacini
   raporlar.
5. Ana koordinator bulgulari birlestirir, cakisma veya ayni dosya riski varsa
   uygulamayi tek elden yapar.
6. Uygulama sonrasi targeted test/build/smoke ve lokal adversarial review
   kosulur.
7. PR acilacaksa tek review hikayesi, rollback yolu ve verification sonucu
   PR'da yazilir.

Onerilen pilot roller:

- `Mufettis Gecidi`: Kod, akis, role/scope ve boundary bug taramasi yapar.
- `Veri Dedektifi`: DB/API/veri tutarliligi ve eksik mapping riskini inceler.
- `UI Nobetcisi`: Prototype parity, responsive, overflow, font, spacing ve
  copy hijyenini kontrol eder.
- `Test Hakemi`: Mevcut testlerin kapsamini, eksik negatif senaryolari ve
  uygun gate'i belirler.
- `Performans Gozcusu`: Yavas sayfa acilisi, gereksiz query, polling, render
  ve bundle risklerini arar.
- `PR Bekcisi`: Diff hygiene, unrelated change, file-size guard, PR body ve
  merge hazirligini denetler.

Ne zaman kullanilir:

- Store/Admin sayfalarinda cok katmanli bug veya UI/akis revizyonu varsa.
- Auth, role/scope, KPI/ranking, checklist, incentives, targets, workforce,
  reports veya feed gibi domainlerde veri ve UI birlikte etkileniyorsa.
- PR oncesi "burada mayin var mi?" kontrolu isteniyorsa.
- Birden fazla bagimsiz bulgu ayni anda incelenebiliyorsa.

Ne zaman kullanilmaz:

- Tek satirlik net fix.
- Docs-only kucuk duzeltme.
- Ayni dosyada birbirine bagli refactor.
- Henuz problem alani bilinmeyen ve once ana kesif gerektiren belirsiz is.
- Kullanici acikca "sadece cevapla" veya "kodlama yapma" dediyse.

Stop kurali:

- Subagentler ayni dosya veya ayni contract icin celisen fix onerirse
  paralel uygulama durur; ana koordinator once tek plan cikarir.
- Subagent yeni API, DB, auth, scoring veya workflow degisikligi onerirse bu
  otomatik kapsam sayilmaz; once Contract Impact ve risk sinifi yazilir.
- Subagent kanitsiz varsayimla hareket ederse bulgu gecersiz sayilir ve repo
  kaniti istenir.

## Merge Disiplini

Merge icin her zaman gerekenler:

- Local verification gecti.
- GitHub/Vercel checks yesil.
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

Bu karar required check, Vercel/deploy check, mergeability, local adversarial
review, diff scope okuma veya verification'i waive etmez. Insan reviewer ya da
baska bir otomatik kontrol actionable yorum birakirsa normal sekilde okunur ve
cozulur.

GitHub kontrolu tek seferlik snapshot degildir. PR acildiktan veya branch'e yeni
push geldikten sonra merge karari verilene kadar gereken durum birlikte
degerlendirilir:

- GitHub Actions checks,
- Vercel/deploy checks,
- status check rollup,
- mergeability / branch state.

Bosta bekleniyorsa bu durumlar 55-60 saniyelik kanonik loop ile tekrar cekilir.
Sonraki bagimsiz PR uzerinde calisiliyorsa `PR Check Beklerken Paralel Ilerleme`
kurali uygulanir; status guvenli kilometre taslarinda ve merge kararindan hemen
once yenilenir. Tum required checks yesil, PR mergeable ve final lokal diff
review temiz oldugunda izleme biter. Failed check, pending belirsizlik veya yeni
actionable insan/tool yorumu gorulurse merge yapilmaz; once sebep okunur,
gerekirse duzeltme push'lanir ve izleme yeniden baslatilir.

## Verification Ladder

Docs-only:

- `git diff --check`.
- Diff okunur ve belge linkleri dogrulanir.
- Active docs veya docs/contract guard degisiyorsa `npm.cmd run test:scripts`
  calistirilir; GitHub docs-process contract da ayni root script setini calistirir.
- Sadece docs-only oldugu icin `npm.cmd run check:release` calistirmak gerekmez;
  ancak GitHub aggregate'in sectigi docs-process sonucu ve required check yine
  merge icin zorunludur.

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

## Regression Trap Register

Gecmiste pahali zaman kaybettiren hatalar yeni PR'larda aktif kontrol
listesidir. Benzer alana dokunuldugunda PR oncesi Reviewer pass bu listeyi
okur.

- Render'da API BullMQ'ya job yazabilir ama ayri worker process yoksa importlar
  pending kalir. Worker provider/module context'i release sonrasi logla
  dogrulanmadan altyapi kapandi sayilmaz.
- Store ranking/personnel detayinda BM/region scope yanlis okunursa 403 veya
  scope disi profil riski dogar. Ranking aksiyonlari sadece kullanicinin
  gorebildigi personel/store scope'una baglanir.
- Store UI'da fake KPI, fake coaching, sahte todo, temsili skor veya gercek
  veriye dayanmayan motivasyonel metin kullanilmaz.
- Monthly/daily period ayrimi karisirse ranking, Store Me ve KPI trendleri
  yanlis okunur. Period type, period start/end ve snapshot/live ayrimi
  gorunur logic'te net kalir.
- Target distribution veya revision toplam esitligi bozulursa request
  gonderilmemelidir. UI buna izin veriyorsa regression sayilir.
- Checklist sayfasinda "dusuk alan", "bekleyen", "tamamlanmayan" gibi
  ozetler admin template/config ve gercek checklist kayitlarina dayanmalidir;
  statik liste veya tahmini metin kabul edilmez.

Yeni regression trap ortaya cikarsa current-state/evidence yerine once burada
kisa, operasyonel ve tekrar kontrol edilebilir sekilde kaydedilir.

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

UI/prototype/redesign/refactor islerinde `design-taste-frontend` / taste-skill
zorunlu kalite pass'idir. Bu skill tek basina urun karari veya design system
yerine gecmez; shadcn/ui, Tailwind v4, lucide, AdminSurface/Store primitive,
gercek veri, role/scope ve workflow kurallarinin ustune anti-slop tasarim
denetimi olarak uygulanir.

Taste-skill kullanilirken:

- once kisa design read yapilir: yuzey turu, persona, operasyonel yogunluk ve
  gorsel dil netlesir,
- landing/marketing varsayilanlari admin/store operasyonel yuzeylerine
  tasinmaz,
- generic AI-purple gradient, gereksiz hero, uc esit kart, dekoratif
  glassmorphism, sahte premium copy ve gostermelik animasyon engellenir,
- UI kararinin gercek kullanici kararina veya aksiyonuna hizmet edip etmedigi
  kontrol edilir,
- mobile/desktop overflow, button contrast, shape consistency, copy kalitesi ve
  eski UI kalintisi preflight olarak okunur,
- skill'in dashboard disi notlari baglamli uygulanir; operasyonel product UI'da
  veri ve workflow dogrulugu her zaman estetik tercihin ustundedir.

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
- Taste-skill pass'i: design read, density, operasyonel karar akisi,
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
- required checks tamamlandi, PR mergeable ve final lokal adversarial review
  temiz; owner-disabled GitHub Codex review tetiklenmedi,
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
