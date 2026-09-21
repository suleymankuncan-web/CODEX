# Work Discipline

Status: active
Shelf: operating
Last verified: 2026-09-18

Bu dosya HR Axis / Store Ops projesinde Codex ile kullanilan pratik calisma
disiplinidir. `sokrates.md` karar kalitesinin kanonik kaynagidir; bu dosya ise
gundelik is akisini, PR ritmini, dogrulama disiplinini ve durma kurallarini
tek yerde toplar.

## Isletim Dokumanlari Rol Haritasi

Reading and document ownership are defined in [AGENTS.md](AGENTS.md#reading-map).
This file owns execution, agent routing, verification and PR/merge mechanics.
Decision, risk and stop/ask policy lives in [sokrates.md](sokrates.md).
Other operating documents link to the owner instead of copying its rules.
Fresh Git/runtime evidence and the newest user instruction take precedence over
historical handoff descriptions.

## Bu Dosya Nasil Okunur

Read this core once for implementation, then only the task's linked execution
procedure. Detailed PR/release, UI and maintenance rules have one owner each in
`docs/process/execution-*.md`. Root headings preserve existing links. A link is
mandatory routing when its task applies, not permission to skip a gate.

## Baslangic Ritueli

Follow [the entry reading map](AGENTS.md#reading-map). Before changes, check the
branch and worktree, preserve unrelated edits, and establish the goal, non-goals,
acceptance criteria, protected areas and verification path. Reuse already-read
context within the active task; refresh only when instructions or evidence drift.
Use current-state as a handoff, not a PR history archive.

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

Choose the minimum sufficient implementation: avoid speculative abstractions,
compatibility layers or a second implementation without a present requirement.
Each new test must prove an acceptance criterion or a concrete regression risk.
Final review checks the smallest necessary file set and removes temporary debug
code introduced by the task.

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

Read the applicable [canonical procedure](docs/process/execution-maintenance.md#worktree-dependency-bootstrap) before this work.

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

Read the applicable [canonical procedure](docs/process/execution-release.md#pr-disiplini) before this work.

### PR Check Beklerken Paralel Ilerleme

Read [the complete procedure](docs/process/execution-release.md#pr-check-beklerken-paralel-ilerleme).

### Token-Verimli Otonom Yurutme

Owner'in 2026-07-15 tarihli kilitli karariyla, ayni aktif hedef icinde kanit
kalitesini dusurmeden model token kullanimi asgari tutulur. Bu karar ancak owner
acikca degistirirse gevsetilir:

- Bosta check/release polling araligi 55-60 saniyedir. Daha sik model turu
  yalniz state transition, fail-fast sinyali veya kullanici mesaji varsa acilir.
- Polling native GitHub ve aktif Cloudflare frontend provider komutu veya background shell watcher ile yapilir;
  yalniz beklemek icin model agent acilmaz.
- Basarili uzun loglar modele tasinmaz. Yalniz sonuc ozeti, degisen durum ve
  failure halinde hatayi aciklayan sinirli tail/ilgili satirlar alinir.
- Ayni hedefte tamamen okunmus operating docs, plan ve skill dosyalari drift
  sinyali yoksa tekrar okunmaz. Fresh Git/runtime gercegi yine her slice'ta
  dogrulanir.
- Risk ve hata incelemesini ana model `Adaptive Reasoning Effort Routing`
  kosullarina gore inline yurutur; ayri problem-solver agent acilmaz.
- Isi mevcut ana model dogrudan yurutur. Kullanici mevcut gorev icin acikca
  istemedikce alt ajan acilmaz veya eski ajan yeniden gorevlendirilmez.
- Canonical full release oncesi gerekli package binary'leri, dependency
  link/junction'lari ve komut erisimi ucuz bir preflight ile dogrulanir.
- Targeted kanit normalde bir kez, selector'in sectigi full release normalde bir
  kez calistirilir. Yeniden kosu ancak somut hata onceki kaniti gecersiz kildiysa
  yapilir; nedeni handoff'ta yazilir.
- Check beklerken yalniz gercekten bagimsiz is ilerletilir. Gereksiz durum
  anlatimi, yinelenen plan ozeti ve buyuk tool output'u uretilmez.

### Canonical Release Sure Ve Tekrar-Kosum Disiplini

Read [the complete procedure](docs/process/execution-release.md#canonical-release-sure-ve-tekrar-kosum-disiplini).
Manual image/offline proof remains `npm.cmd run check:onprem:dispatch -- prove`
on the exact clean committed HEAD, followed by wrapper `publish` and dispatch.
GitHub runtime proof is final evidence, never a diagnostic loop.
`--resume` retains coverage; use native `Re-run failed jobs`. Volatile stages,
the 110% ceiling, `release-rehearsal.yml`, HTTP 429 ve 5xx handling, and the rule
that iki root/full release suite eszamanli calistirilmaz remain in force.

### PR Oncesi Adversarial Review

Read [the complete procedure](docs/process/execution-release.md#pr-oncesi-adversarial-review).

### Repo-Native Subagent Review Model

Scout, Planner, Worker, Reviewer and Closer describe phases of the root's work,
not separate agents. Perform a distinct final review of the diff and acceptance
criteria; report it as inline self-review, never independent agent review.
The [local adversarial review](#pr-oncesi-adversarial-review) remains mandatory.

### Adaptive Reasoning Effort Routing

The current user-selected model performs discovery, implementation, verification,
risk investigation and closeout directly. Repository configuration sets Medium
as the default effort and High for Plan Mode; it does not pin the root model.
Explicit user selection takes precedence. Do not claim a model or effort changed
without client/session evidence; permissions remain separately enforced.

No worker or problem-solver role is configured. Do not spawn or reuse subagents
unless the user explicitly requests delegation for the current task. Older plans,
skill recipes, available tool roles and client capacity do not override this rule.
Do not spawn a model agent only to wait or poll.

Inline investigation and review:

- Inspect auth, permission, security, DB/migration, data integrity, concurrency,
  destructive or production-safety uncertainty immediately; retain final R4/R5 review.
- Investigate when the first focused inspection cannot explain a failing check,
  evidence conflicts, or a material failure survives two evidence-based correction attempts.
- Switching phases or models does not reset the failure budget. Narrow the
  problem or report the exact blocker instead of restarting blind retries.
- Review the diff, acceptance criteria, negative cases and evidence separately
  from implementation. Record actionable findings and their resolution separately.
- No dedicated problem-solver agent is used. Self-review does not replace
  required tests, external evidence, owner authority or Sokrates stop conditions.

If the user later requests delegation, define non-overlapping ownership and
protected areas explicitly; root retains integration and all owner decisions.
Never assign two implementers the same file or workflow. Do not recreate a
persistent worker configuration without a separate user request.

### Pilot Subagent Orchestration Discipline

The previous orchestration pilot is superseded by root-only execution above.
Historical plans are evidence, not standing delegation authority.
Measure efficiency by elapsed time, repeated work and actionable findings;
do not manufacture token-share quotas or performance claims.

## Merge Disiplini

Read the applicable [canonical procedure](docs/process/execution-release.md#merge-disiplini) before this work.

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
- aktif Cloudflare frontend provider deployment checks.
- Gerekiyorsa deployed smoke.
- Gercek provider/input gerektiren kanitlar mock ile kapatilmaz.

## Hard Boundaries

Backend implementation boundaries:

- Web/controllers do not import infrastructure repositories directly.
- Application services orchestrate use cases. Direct PostgreSQL, Supabase or
  `DatabaseService` access belongs in infrastructure repositories, except for
  existing allowlisted transition exceptions being removed.
- New application code must not add broad `as unknown as` repository casts.
- Source adapters enter through the canonical import boundary before mapping,
  validation, materialization, snapshotting, scoring or reporting.
- Store action, Norm Kadro, prim and incentive writes start with an explicit
  boundary decision.

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

Migration-sensitive files (`db/schema.sql`, `db/migrations/*.sql`, migration
runner/tracking code, database module or `scripts/migration-fresh-db-smoke.mjs`)
require an explicit readiness decision. The migration-change warning is not a
failure and does not make Docker smoke an automatic root-gate requirement.
Prefer `npm.cmd run smoke:migration:fresh-db`; if Docker/PostgreSQL is unavailable,
record Conditional Go with owner, date, reason and follow-up. Do not claim
migration readiness without one of these decisions.

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

Read the applicable [canonical procedure](docs/process/execution-ui.md#uiux-disiplini) before this work.

Start with [.agents/skills/hr-axis-ui/SKILL.md](.agents/skills/hr-axis-ui/SKILL.md).
It routes relevant sections of `docs/process/product-experience-principles.md`,
`docs/process/ui-surface-standard-v1.md` and
`docs/process/store-admin-surface-standardization-v1.md`.
Keep the approved calendar, real data, roles, accessibility and prototype parity.

### Prototype to Product

Read [the parity contract](docs/process/execution-ui.md#prototype-to-product).

## Refactor Disiplini

Read the applicable [canonical procedure](docs/process/execution-maintenance.md#refactor-disiplini) before this work.

## Dosya Satir Prensipleri

Read the applicable [canonical procedure](docs/process/execution-maintenance.md#dosya-satir-prensipleri) before this work.

File Size Guard V1 is enforced by `scripts/file-size-guard.test.mjs`; no baseline or exception changes are authorized by this extraction.

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
