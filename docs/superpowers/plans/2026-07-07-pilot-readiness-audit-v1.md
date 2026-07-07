# Pilot Readiness Audit V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patron sunumu ve kontrollü pilot öncesinde HR Axis'in veri, persona, kritik akış, rapor, görünürlük ve çalışma alanı hijyenini kanıtlı şekilde doğrulamak; sadece pilotu bozacak P0/P1 ve aynı yüzeydeki net P2 sorunları düzeltmek.

**Architecture:** Bu plan yeni modül veya geniş UI redesign başlatmaz. Önce read-only audit ve kanıt dosyası üretir; ardından veri mutabakatı, persona smoke, export doğrulama ve minimum riskli fix PR'larıyla ilerler. Her PR küçük, geri alınabilir ve script testleri çalıştırılmış olacak.

**Tech Stack:** React 19, TypeScript, NestJS, PostgreSQL/Supabase, Clerk, Vercel, Render, Playwright, Node test runner, mevcut HR Axis Store/Admin yüzeyleri.

---

## Metadata

- Status: active / implementation-ready
- Date: 2026-07-07
- Owner: Pilot readiness
- Primary users: Admin, Bölge Müdürü, Mağaza Müdürü, Mağaza Personeli
- Execution mode: audit-first, fix-after-evidence
- Branch prefix: `codex/`
- Broad production decision: `No-Go`
- Controlled pilot decision target: `Conditional Go` or `No-Go with blockers`

## Context

Proje artık yeni özellik ekleme aşamasında değil. Store ve Admin ana yüzeyleri ürünleşti; fakat pilot/patron sunumu öncesi bazı veriler, persona kapsamları, export doğruluğu ve UI sürtünmeleri son kez kanıtlanmalı.

Bu auditin ana sorusu:

> Demo sırasında hangi veri, ekran veya akış güven kırar?

Bu nedenle çalışma kapsamı:

- gerçek veya staging verinin doğru görünmesi,
- persona/rol/scope davranışının doğru olması,
- raporların açılabilir ve doğru veriyle inmesi,
- sıralama, KPI, prim, hedef, checklist ve norm kadro çıktılarının birbirini çeliştirmemesi,
- login/session akışının takılmaması,
- dirty/prototype/evidence artıklarının temiz kalmasıdır.

## Non-Goals

Bu plan şunları yapmayacak:

- Nebim veya başka dış bağlantı entegrasyonu yazmak.
- Yeni modül başlatmak.
- Yeni geniş UI konsepti üretmek.
- KPI, prim, hedef veya checklist formüllerini yeniden tasarlamak.
- Auth/role/scope modelini değiştirmek.
- DB migration gerektiren yeni ürün davranışı eklemek.
- Fake veri üretip gerçek veri gibi göstermek.
- Geniş refactor yapmak.

## Severity Policy

| Severity | Anlam | İşlem |
| --- | --- | --- |
| P0 stop | Login, veri kaybı, yanlış yetki, kritik sayfa tamamen çalışmıyor | Hemen fix, tek PR |
| P1 pilot blocker | Demo/pilot ana akışını bozan veri, export, hesaplama veya UI problemi | Hemen fix, küçük PR |
| P2 pilot friction | Kullanımı zorlaştıran hizalama, copy, yavaşlık, görünürlük sorunu | Aynı yüzey ve aynı risk sınıfındaysa batch fix |
| P3 backlog | Pilot öncesi zorunlu olmayan iyileştirme | Not edilir, uygulanmaz |

## Audit Gates

1. PR2, PR3, PR4 ve PR5, PR1 evidence dosyasında kayıtlı bir `Finding ID` olmadan başlayamaz.
2. Her fix PR açıklamasında en az bir finding ID, root-cause özeti, rollback yolu ve çalıştırılan testler bulunur.
3. Bir finding sadece "görsel olarak kötü" diye fixlenmez. Pilot/patron sunumu etkisi, persona, route ve beklenen/gerçek davranış yazılır.
4. Bir PR hem DB verisi, hem backend behavior, hem de frontend UI değişikliği içeriyorsa bölünür. İstisna sadece P0 stop durumudur.
5. PR5 Store yüzey fixleri varsayılan olarak tek yüzey/tek route şeklinde açılır. Aynı PR içinde birden fazla Store yüzeyi ancak aynı component veya aynı contract nedeniyle bozuluyorsa birlikte alınır.

## Data And Privacy Guardrails

1. Evidence dosyalarına şifre, OTP, cookie, bearer token, database URL, Clerk secret, Render key veya raw private connection bilgisi yazılmaz.
2. Kişisel e-posta ve gerçek kullanıcı kimlikleri evidence içinde mümkünse persona etiketiyle yazılır. Gerçek e-posta gerekiyorsa sadece kullanıcı tarafından zaten açıkça paylaşılan pilot hesap etiketi kullanılabilir.
3. SQL mutation doğrudan çalıştırılmaz. Önce dry-run/readback sorgusu yazılır ve inserted/updated/skipped/review_required sayıları kaydedilir.
4. PII içeren tek kullanımlık SQL dosyası commit edilmez. Commit edilecek SQL varsa idempotent, açıklamalı ve secret/connection string içermeyen sanitized script olur.
5. Ürün tablolarına veri yazan her işlem için tersine çevrilebilirlik notu gerekir: hangi satırlar değişti, nasıl okunur, nasıl geri alınır.
6. Snapshot sonuçları elle patchlenmez. Kaynak veri düzeltilir, sonra mevcut rebuild/import/snapshot akışı kullanılır veya neden kullanılamadığı evidence dosyasında yazılır.

## Exit Criteria

Controlled pilot için `Conditional Go` ancak şu şartlarla verilir:

- Açık P0 yok.
- Açık P1 yok veya kullanıcı tarafından yazılı risk kabulü var.
- Admin, Bölge Müdürü, Mağaza Müdürü ve Personel persona smoke sonuçları kayıtlı.
- Reports Excel dosyası açılıyor ve seçili döneme ait ana kolonlar doğru veri veriyor.
- Rankings, Store Me, KPIs, Checklists, Targets, Incentives, Workforce ve Reports için demo kıran görünür hata yok.
- Login/session bounce varsa root cause ve workaround net; yoksa "pass" olarak işaretli.
- `current-state.md` ve active next action güncel.
- Working tree clean veya sadece kullanıcıya ait açıkça parked dosya var.

## PR Train

### PR1: Audit Evidence And Readiness Matrix

Risk: `R0 docs/process`, mümkün olduğunca read-only.

Amaç:

- Tüm persona, route, veri ve export durumunu tek kanıt dosyasında toplamak.
- P0/P1/P2/P3 sınıflandırmasını yapmak.
- Hangi fix PR'larının gerçekten gerektiğini kanıtlamak.

Output:

- Create: `docs/evidence/pilot-readiness/2026-07-07-pilot-readiness-audit-v1.md`
- Modify: `docs/plans/active-next-actions.md` only if the next action changes

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

### PR2: Data Reconciliation And Demo Data Fixes

Risk: `R1/R2`, DB/data-focused. Split if it touches code and data together.

Amaç:

- Ocak-Haziran mağaza/personel/hedef/satış/KPI tutarlılığını kontrol etmek.
- Demo için gerekli minimum veri düzeltmelerini idempotent SQL veya mevcut import/rebuild yolu ile yapmak.
- Store count, region assignment, personel hedefleri, norm kadro ve turnover görünümünü tutarlı hale getirmek.

Output:

- Create: `docs/evidence/pilot-readiness/2026-07-07-data-reconciliation-readback.md`
- Create if sanitized SQL is needed: `docs/evidence/pilot-readiness/sql/2026-07-07-demo-data-reconciliation-template.sql`
- No secrets, passwords, connection strings, bearer tokens, cookies or OTP values in docs.
- Do not commit one-off SQL containing private emails, raw employee lists, connection strings or unsanitized PII.

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

If frontend/backend code changes are needed:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

### PR3: Persona Smoke And Critical Flow Fixes

Risk: `R1/R2`, targeted runtime fixes only.

Amaç:

- Admin, Bölge Müdürü, Mağaza Müdürü ve Personel için kritik sayfaları açmak.
- Login ekranına atma/takılma, forbidden/role scope, görünürlük ve route erişimini doğrulamak.
- Store Manager ve Personnel görünürlük kurallarını pilot beklentisine göre kontrol etmek.

Output:

- Create: `docs/evidence/pilot-readiness/2026-07-07-persona-smoke-matrix.md`
- Modify only files with proven P0/P1/P2 findings.

Verification:

```powershell
npm.cmd run test:scripts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

Run targeted Playwright if the touched route already has a spec:

```powershell
npm.cmd --prefix admin-web run test:e2e -- <targeted-spec-name>
```

### PR4: Reports And Export Integrity Fixes

Risk: `R1/R2`, frontend/backend depending on root cause.

Amaç:

- Reports Excel dosyasının açıldığını, doğru dönemi ve doğru kolonları verdiğini kanıtlamak.
- Region Manager store/personnel counts, BM name, GSM, checklist, KPI, target, incentive, norm kadro ve turnover kolonlarını doğrulamak.
- Bozuk Excel formatı, boş kolon, yanlış manager/store/personnel mapping varsa düzeltmek.

Output:

- Create: `docs/evidence/pilot-readiness/2026-07-07-reports-export-readback.md`
- Modify: report/export code only if evidence shows wrong output.

Verification:

```powershell
npm.cmd run test:scripts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

If backend export changes:

```powershell
npm.cmd --prefix backend/nestjs run test
```

### PR5: Store Surface Pilot Polish Fixes

Risk: `R1/R2`, UI-only where possible.

Amaç:

- Sadece auditte kanıtlanan pilot sürtünmelerini düzeltmek.
- Bilinen aday yüzeyler: Store Me, Rankings/Türkiye Sıralaması, Store KPIs, Incentives/Primler, Checklists, Targets, Workforce, Reports, Feed/Announcements.

Known candidate findings to verify before fixing:

- Store Me metrik kart typography, icon alignment, date popover, KPI detail sizing.
- Rankings region manager filter overflow, filter clear button overflow, "Türkiye Sıralaması" nav label, reference/filter order.
- Store KPIs GSM Onayı TR ortalaması and score source visibility.
- Incentives slow first load, drawer edit lock, row separator visual noise, metrics icons, compact header.
- Checklists search/filter alignment, BM/VM filter count behavior, "Ziyaretten Geçen Süre" column.
- Reports page Excel data correctness and simplified visible UI.
- Login/session route bounce.

Output:

- Modify: only touched frontend route/component files.
- Create: `docs/evidence/pilot-readiness/2026-07-07-store-surface-polish-readback.md`
- Split into more PRs if more than one unrelated route needs code changes.

Verification:

```powershell
npm.cmd run test:scripts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

Run targeted e2e specs for touched surfaces when available.

### PR6: Final Demo Runbook And Closeout

Risk: `R0 docs/process`.

Amaç:

- Patron sunumu ve pilot için kısa, takip edilebilir demo akışı oluşturmak.
- Known limitations, data status and go/no-go decision record etmek.
- Working tree clean kalmasını sağlamak.

Output:

- Create: `docs/runbooks/patron-demo-and-pilot-readiness-runbook-v1.md`
- Create: `docs/evidence/pilot-readiness/2026-07-07-pilot-readiness-closeout.md`
- Modify: `current-state.md`
- Modify: `docs/plans/active-next-actions.md`

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
git status --short --branch
```

If PR2-PR5 included runtime changes, also record staging deploy/readback:

```markdown
## Staging Readback

| Service | Deploy needed | Deploy completed | Smoke route | Result |
| --- | --- | --- | --- | --- |
| Vercel frontend | yes/no | pending | pending | pending |
| Render backend | yes/no | pending | pending | pending |
```

## Task 1: Baseline And Guardrails

**Files:**

- Read: `current-state.md`
- Read: `discipline.md`
- Read: `sokrates.md`
- Read: `CONTRIBUTING.md`
- Read: `docs/README.md`
- Read: `docs/plans/project-control-board-v1.md`
- Modify: none

- [ ] **Step 1: Confirm clean main**

Run:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git status --short --branch
git log -5 --oneline
```

Expected:

- Branch is `main`.
- `main` is aligned with `origin/main`.
- Dirty files are either absent or explicitly identified as unrelated user files.

- [ ] **Step 2: Confirm allowed scope**

Record these lines in the first evidence file:

```markdown
Scope decision:
- New module: no
- Broad UI redesign: no
- Nebim/provider integration: no
- Business formula changes: no
- Auth/scope semantic changes: no
- Pilot blocker audit and targeted fixes: yes
```

Expected:

- Future work does not drift into new features.

## Task 2: Create Audit Evidence Matrix

**Files:**

- Create: `docs/evidence/pilot-readiness/2026-07-07-pilot-readiness-audit-v1.md`
- Read: `docs/contracts/store-page-qa-contract-v1.md`
- Read: `docs/contracts/pilot-personnel-roster-reconciliation-contract-v1.md`
- Read: `docs/plans/personnel-ranking-eligibility-and-store-me-rank-alignment-v1.md` if present
- Read: `docs/plans/store-me-and-rankings-visual-polish-notes-2026-07-05.md` if present

- [ ] **Step 1: Add evidence file header**

Create:

```markdown
# Pilot Readiness Audit V1 Evidence - 2026-07-07

Status: in_progress
Scope: controlled pilot / patron demo readiness
Secrets policy: no passwords, OTPs, cookies, bearer tokens, database URLs or private credentials recorded.

## Summary

| Area | Status | Notes |
| --- | --- | --- |
| Workspace hygiene | pending |  |
| Persona access | pending |  |
| Data completeness | pending |  |
| Store surfaces | pending |  |
| Admin surfaces | pending |  |
| Reports/export | pending |  |
| Session stability | pending |  |

## Findings

| ID | Severity | Persona | Route/Area | Evidence | Root Cause Guess | Action |
| --- | --- | --- | --- | --- | --- | --- |
```

Expected:

- Evidence file has no secret material.
- Findings can drive PR2-PR5.

- [ ] **Step 2: Add route/persona matrix**

Add:

```markdown
## Persona Route Matrix

| Persona | Route | Expected | Observed | Status |
| --- | --- | --- | --- | --- |
| Admin | /admin/auth | access | pending | pending |
| Admin | /admin/master-data | access | pending | pending |
| Admin | /admin/integrations | access | pending | pending |
| Admin | /admin/incentives | access | pending | pending |
| Bölge Müdürü | /store | access | pending | pending |
| Bölge Müdürü | /store/rankings | access | pending | pending |
| Bölge Müdürü | /store/kpis | access | pending | pending |
| Bölge Müdürü | /store/checklists | access | pending | pending |
| Bölge Müdürü | /store/targets | access | pending | pending |
| Bölge Müdürü | /store/incentives | access for company-store scope | pending | pending |
| Bölge Müdürü | /store/workforce | access | pending | pending |
| Bölge Müdürü | /store/reports | access | pending | pending |
| Mağaza Müdürü | /store/incentives | hidden or forbidden | pending | pending |
| Mağaza Müdürü | /store/rankings | visible but no other profile navigation | pending | pending |
| Personel | /store/me | access own profile | pending | pending |
| Personel | /store/rankings | visible but no other profile navigation | pending | pending |
```

Expected:

- Audit covers the routes that can affect demo confidence.

## Task 3: Data Completeness Audit

**Files:**

- Read: `docs/contracts/pilot-personnel-roster-reconciliation-contract-v1.md`
- Create or modify: `docs/evidence/pilot-readiness/2026-07-07-data-reconciliation-readback.md`
- No product table writes until dry-run findings are reviewed.

- [ ] **Step 1: Produce store count readback**

Run read-only SQL or existing admin/reporting API to record:

```markdown
## Store Count Readback

| Period | Total ranking stores | Company stores | Region assigned stores | Stores with KPI actuals | Stores with target | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-01 | pending | pending | pending | pending | pending |  |
| 2026-02 | pending | pending | pending | pending | pending |  |
| 2026-03 | pending | pending | pending | pending | pending |  |
| 2026-04 | pending | pending | pending | pending | pending |  |
| 2026-05 | pending | pending | pending | pending | pending |  |
| 2026-06 | pending | pending | pending | pending | pending |  |
```

Expected:

- Missing stores like Düzce Dmall Avm or İstanbul Eyüp Axis Pop Up are not silently lost.
- Removed pilot stores such as İzmir Karşıyaka do not appear as real stores.

- [ ] **Step 2: Produce personnel target/sales readback**

Record:

```markdown
## Personnel Target And Sales Readback

| Period | Store | Active personnel | Personnel with sales | Personnel with target | Store target | Status |
| --- | --- | ---: | ---: | ---: | ---: | --- |
```

Expected:

- Store managers are not counted for personnel target distribution.
- Cashiers remain visible as active personnel where applicable but excluded from incentive/ranking as decided.
- May 2026 Balıkesir 10 Burda and Marmara Forum target corrections are verified if already applied.

- [ ] **Step 3: Produce norm kadro readback**

Record:

```markdown
## Norm Kadro Readback

| Store | Active | Norm | Status | Missing days | Turnover | Notes |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| İstanbul Marmara Forum Avm | pending | 8 | expected 6/8 | pending | pending |  |
| Çanakkale 17 Burda Avm | pending | 5 | expected 5/5 | pending | pending |  |
| Bursa Downtown Avm | pending | 3 | expected 3/3 | pending | pending |  |
| Balıkesir 10 Burda Avm | pending | 4 | expected 4/4 | pending | pending |  |
| Bursa Marka Park Avm | pending | pending | expected missing days 7 if short | pending | pending |  |
| İstanbul Büyükçekmece Cadde | pending | pending | expected complete | pending | pending |  |
```

Expected:

- Demo-facing norm kadro values are internally consistent.

## Task 4: Ranking And Store Me Audit

**Files:**

- Read: `admin-web/src/pages/*Ranking*`
- Read: `admin-web/src/pages/StoreMyPerformancePage.tsx`
- Read: `admin-web/src/pages/store-my-performance-*`
- Create or update: `docs/evidence/pilot-readiness/2026-07-07-persona-smoke-matrix.md`

- [ ] **Step 1: Validate official personnel ranking eligibility**

Expected contract:

```markdown
Official personnel ranking eligibility:
- role is eligible seller role
- store manager is excluded
- monthly net sales is at least 50,000 TL
- employee share of store revenue is at least 2%
```

Record:

```markdown
## Ranking Eligibility Readback

| Period | Excluded store managers | Excluded under 50,000 TL | Excluded under 2% share | Visible ranked personnel | Status |
| --- | ---: | ---: | ---: | ---: | --- |
```

Expected:

- Store managers influence store revenue where business requires, but do not appear in personnel ranking.
- One-invoice outliers with extreme ATV/UPT do not dominate official ranking if below eligibility threshold.

- [ ] **Step 2: Validate ranking detail alignment**

Record:

```markdown
## Ranking Detail Alignment

| List row rank | Opened profile rank | Expected | Status |
| ---: | ---: | ---: | --- |
| 1 | pending | same person/rank context | pending |
| 25 | pending | same person/rank context | pending |
```

Expected:

- Opening a ranked person does not show conflicting rank numbers.
- Back navigation returns to the original tab/context.

- [ ] **Step 3: Validate Store Me card and chart UI**

Record:

```markdown
## Store Me UI Readback

| Item | Expected | Observed | Status |
| --- | --- | --- | --- |
| Date filter | compact month/year calendar popover | pending | pending |
| Performance card button | aligned with date filter, not over-wide | pending | pending |
| KPI cards | compact typography, no overflow | pending | pending |
| Target value area | Hedef/Gerçekleşen/Kalan stacked and aligned | pending | pending |
| Trend labels | not clipped or too close to points | pending | pending |
| Other profile navigation | blocked for SM/personnel | pending | pending |
```

Expected:

- No unauthorized profile navigation.
- No mobile/desktop overflow on critical cards.

## Task 5: Store Workflow Audit

**Files:**

- Read: `admin-web/src/pages/StoreChecklistsPage*`
- Read: `admin-web/src/pages/StoreTargetsPage*`
- Read: `admin-web/src/pages/StoreIncentivesPage*`
- Read: `admin-web/src/pages/StoreKpisPage*`
- Read: `admin-web/src/pages/StoreWorkforcePage*`
- Read: `admin-web/src/pages/StoreReportsPage*`

- [ ] **Step 1: Validate checklists**

Record:

```markdown
## Checklist Readback

| Check | Expected | Observed | Status |
| --- | --- | --- | --- |
| BM+VM count | all assigned stores | pending | pending |
| BM-only count | stores with BM checklist context, not accidentally missing stores | pending | pending |
| Checklist action | opens fillable session, not read-only result unless completed | pending | pending |
| Last visit elapsed column | present or listed as fix if missing | pending | pending |
| Filter alignment | search and reset vertically aligned | pending | pending |
```

Expected:

- Count difference is explainable.
- Checklisti aç/yap path is usable.

- [ ] **Step 2: Validate incentives**

Record:

```markdown
## Incentives Readback

| Check | Expected | Observed | Status |
| --- | --- | --- | --- |
| First load | no unnecessary multi-second blocking where cached/partial display is possible | pending | pending |
| Period status | closed historical periods editable where business says closed | pending | pending |
| Correction drawer | final amount editable when allowed | pending | pending |
| Store targets | person/store targets visible where imported/entered | pending | pending |
| Excel export button | removed from top if intentionally unavailable | pending | pending |
```

Expected:

- Region Manager can review/correct allowed period packages.
- Ineligible/uncalculated states explain themselves without blocking wrong periods.

- [ ] **Step 3: Validate KPIs**

Record:

```markdown
## KPI Readback

| Check | Expected | Observed | Status |
| --- | --- | --- | --- |
| GSM Onayı store KPI | TR average/reference visible when available | pending | pending |
| GSM Onayı score source | included in store score source | pending | pending |
| BM/SM date filter | month/year calendar without day picker | pending | pending |
| BM header | compact with lucide icon | pending | pending |
```

Expected:

- Store KPI score source matches visible metric contributors.

- [ ] **Step 4: Validate reports export**

Record:

```markdown
## Reports Export Readback

| Period | File opens | Store count | BM names | KPI columns | Target columns | Incentive columns | Norm columns | Status |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| 2026-06 | pending | pending | pending | pending | pending | pending | pending | pending |
```

Expected:

- Excel opens in Excel.
- No empty mystery columns.
- BM names are human-readable and correct.

## Task 6: Admin Surface Audit

**Files:**

- Read: `admin-web/src/pages/AdminAuth*`
- Read: `admin-web/src/pages/AdminMasterData*`
- Read: `admin-web/src/pages/AdminIntegrations*`
- Read: `admin-web/src/pages/AdminIncentives*`

- [ ] **Step 1: Validate admin auth and master data**

Record:

```markdown
## Admin Readback

| Route | Check | Expected | Observed | Status |
| --- | --- | --- | --- | --- |
| /admin/auth | user list | loads under backend limit | pending | pending |
| /admin/auth | deactivate/update user | available to admin, audited | pending | pending |
| /admin/master-data | store list | no severe UI jank | pending | pending |
| /admin/master-data | store manager/region assignment | human names, not UUIDs | pending | pending |
| /admin/integrations | import upload | usable, clear batch status | pending | pending |
```

Expected:

- Admin can prepare pilot data without confusing UUID-only screens.

## Task 7: Minimum Fix Execution Rules

**Files:**

- Modify only files tied to a recorded finding.
- Do not combine unrelated auth, DB, report, and UI fixes in one PR.

- [ ] **Step 1: Select fix batch**

Before coding, add this to the PR description:

```markdown
Fix selection:
- Finding IDs:
- Shared surface:
- Risk class:
- Rollback path:
- Tests to run:
- Deploy/readback needed:
```

Expected:

- The PR is scoped to one small class of issues.
- The PR does not mix unrelated routes or data/code/UI boundaries.

- [ ] **Step 2: Run mandatory pre-PR checks**

Always run:

```powershell
npm.cmd run test:scripts
git diff --check
```

If frontend changes:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

If backend changes:

```powershell
npm.cmd --prefix backend/nestjs run test
```

Expected:

- No PR is opened before script tests.
- Failures are root-caused and fixed before PR.

## Task 8: Final Readiness Closeout

**Files:**

- Create: `docs/runbooks/patron-demo-and-pilot-readiness-runbook-v1.md`
- Create: `docs/evidence/pilot-readiness/2026-07-07-pilot-readiness-closeout.md`
- Modify: `current-state.md`
- Modify: `docs/plans/active-next-actions.md`

- [ ] **Step 1: Write demo route**

Create runbook with:

```markdown
# Patron Demo And Pilot Readiness Runbook V1

## Demo Order

1. Admin: Auth and Master Data
2. Admin: Integrations import status
3. Bölge Müdürü: Home
4. Bölge Müdürü: Türkiye Sıralaması
5. Bölge Müdürü: KPIs
6. Bölge Müdürü: Checklist
7. Bölge Müdürü: Hedefler
8. Bölge Müdürü: Primler
9. Bölge Müdürü: Norm Kadro
10. Bölge Müdürü: Raporlar
11. Mağaza Müdürü: Home, KPIs, Checklist acceptance, Hedefler
12. Personel: Store Me and Performans Kartı

## Known Limitations

| Limitation | Impact | Demo wording |
| --- | --- | --- |

## Go / No-Go

Controlled pilot:
Broad production:

## Data Status

| Domain | Status | Notes |
| --- | --- | --- |
| Ocak-Haziran KPI/sales | pending |  |
| Ocak-Haziran personnel targets | pending |  |
| Active June roster | pending |  |
| Region assignments | pending |  |
| Reports Excel | pending |  |
| Pilot accounts | pending |  |
```

Expected:

- The user can rehearse without rediscovering paths.

- [ ] **Step 2: Close working tree**

Run:

```powershell
git status --short --branch
```

Expected:

- Clean tree or only explicitly parked user-owned files.

## Self-Review Checklist

- [ ] Plan starts with required agentic worker header.
- [ ] Plan does not start a new module.
- [ ] Plan does not include broad UI redesign.
- [ ] Plan separates audit, data, persona, export, UI fixes and closeout.
- [ ] Every PR requires `npm.cmd run test:scripts` before PR.
- [ ] Secrets are explicitly forbidden in evidence docs.
- [ ] Store Manager and Personnel profile visibility constraints are included.
- [ ] Ranking eligibility rules are included.
- [ ] Reports Excel validation is included.
- [ ] Session/login bounce is included.
- [ ] Final runbook and `current-state.md` update are included.
