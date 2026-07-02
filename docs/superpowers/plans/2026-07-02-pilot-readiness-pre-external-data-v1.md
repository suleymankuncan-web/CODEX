# Pilot Readiness Pre External Data V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dış bağlantı/Nebim verisi beklenirken HR Axis pilotuna girmeden önce rol, sayfa, veri dürüstlüğü, performans, smoke ve runbook hazırlığını tamamlamak.

**Architecture:** Bu plan entegrasyon yazmaz; dış kaynak verisini beklerken uygulamanın mevcut üretim yüzeylerini, veri kabul sınırlarını ve pilot işletim akışını sertleştirir. Çalışma read-only audit, docs/runbook, küçük smoke/guard ekleri ve gerekli olursa düşük riskli UI/performans düzeltmeleri olarak ilerler.

**Tech Stack:** React 19, TypeScript, NestJS, PostgreSQL/Supabase, Clerk, Vercel, Render, Playwright, Node test runner, mevcut HR Axis Store/Admin surface yapısı.

---

## Metadata

- Status: Draft / implementation-ready after review
- Date: 2026-07-02
- Author: Codex
- Owner: Pilot readiness / Store Ops
- Primary personas: `SUPER_ADMIN`, `REGION_MANAGER`, `STORE_MANAGER`, store personnel
- External dependency: Nebim/dış bağlantı veri formatı ve erişimi bekleniyor
- Risk class: plan geneli `R0 docs/process`; smoke veya küçük UI fix çıkarsa ilgili PR `R1/R2`
- Target branch prefix: `codex/`

## Context

Proje pilot öncesinde Store tarafında büyük ölçüde ürünleşmiş durumda: Home, KPIs, Rankings, Checklists, Tasks, Targets, Incentives, Workforce, Feed ve Reports yüzeyleri aktif. Admin tarafında Auth ve Master Data operasyon ekranları da pilot işleyişine yaklaştı.

Dış bağlantı verisi henüz net değil. Bu yüzden Nebim entegrasyonu, provider davranışı, import adapter kodu veya DB migration başlatmak şu aşamada yanlış olur. Buna rağmen beklerken yapılacak yüksek katkılı işler var:

- Mevcut pilot hesaplarının gerçek rol/scope davranışıyla sayfaları açması.
- Ürün yüzeylerinde UUID, fake copy, taşma, yanlış metrik ve yavaş açılış risklerinin yakalanması.
- Dış veri geldiğinde uygulanacak canonical veri sözleşmesinin hazırlanması.
- Import/mapping hatalarının hesaplamayı kilitlememesi için kabul/karantina kurallarının netleşmesi.
- Pilot günü için tekrar edilebilir smoke ve runbook akışının hazır olması.

## Non-Goals

Bu plan şunları yapmayacak:

- Nebim entegrasyonu yazmak.
- Yeni import provider davranışı eklemek.
- DB migration yapmak.
- KPI, prim, ranking, hedef veya checklist business formüllerini değiştirmek.
- Auth/permission/scope semantiğini değiştirmek.
- Bayi/işletme/şirket mağazası kurallarını yeniden tanımlamak.
- Sahte veri veya fake metric eklemek.
- Geniş UI redesign başlatmak.

## Product Decisions

1. Dış bağlantı beklenirken öncelik entegrasyon değil, pilot hazır oluş kanıtıdır.
2. Eşleşmeyen dış veri pilotu durdurmamalı; hesaplama dışına alınmalı, raporlanmalı ve karantina görünürlüğü olmalı.
3. Dış verinin ilk kabul noktası canonical adapter boundary olmalı; sayfalar doğrudan provider formatı okumamalı.
4. Pilot smoke pack, manuel kullanıcı denemesi yerine tekrarlanabilir küçük route/persona kanıtı üretmeli.
5. Performans çalışması, özellikle açılışta yavaş hissedilen sayfalar için ölçüm ve hedefli düzeltme üretmeli; genel rewrite yapılmamalı.
6. UI polish sadece gerçek pilot sürtünmesini azaltan taşma, hizalama, hatalı copy, yanlış görünürlük ve yavaşlık bulgularına uygulanmalı.

## File Structure

Plan uygulandığında dokunulabilecek dosya alanları:

- Create: `docs/evidence/pilot-readiness-pre-external-data-v1-YYYY-MM-DD.md`
  - Read-only audit ve smoke bulgularının kanıt dosyası.
- Create: `docs/runbooks/pilot-daily-ops-runbook-v1.md`
  - Pilot gününde kim, neyi, hangi sırayla kontrol eder.
- Create: `docs/contracts/external-source-canonical-data-contract-v1.md`
  - Nebim/dış kaynak adapter'ının içeriye vereceği canonical alan sözleşmesi.
- Create: `docs/contracts/external-source-data-quality-rules-v1.md`
  - Eşleşmeyen mağaza/personel, duplicate, tarih, iade/satış ve dönem kuralları.
- Create or Modify: `scripts/pilot-readiness-smoke-contract.test.mjs`
  - Pilot smoke/runbook sözleşmesinin docs tarafında korunması.
- Modify if needed: `admin-web/e2e/*`
  - Sadece mevcut sayfa davranışını kanıtlayan hedefli Playwright smoke ekleri.
- Modify if needed: `admin-web/src/**`
  - Sadece audit bulgusu kanıtlanmış R1/R2 küçük fix için.
- Modify if needed: `backend/nestjs/src/**`
  - Sadece read-only veya contract-level bug kanıtlanırsa; dış veri entegrasyonu yok.

Unrelated dirty evidence, prototype veya generated dosyalar bu plan kapsamında temizlenmez.

## PR Train

### PR1: Pilot Readiness Audit And Evidence

Risk: `R0 docs/process`, read-only runtime inspection.

Output:

- `docs/evidence/pilot-readiness-pre-external-data-v1-YYYY-MM-DD.md`
- Sayfa/persona matrisi.
- Açık bug listesi: severity, persona, route, evidence, önerilen PR.

Verification:

- `git diff --check`
- `npm.cmd run test:scripts` only if docs guard is touched.

### PR2: Canonical Data Contract And Data Quality Rules

Risk: `R0 docs/process`.

Output:

- `docs/contracts/external-source-canonical-data-contract-v1.md`
- `docs/contracts/external-source-data-quality-rules-v1.md`
- Gerekirse script contract test.

Verification:

- `npm.cmd run test:scripts`
- `git diff --check`

### PR3: Pilot Smoke Pack Foundation

Risk: `R1/R2` if frontend e2e is added; otherwise `R0`.

Output:

- Persona route smoke coverage for Admin, BM, SM, Personnel.
- Negative visibility smoke for forbidden surfaces.
- No live secrets committed.

Verification:

- `npm.cmd --prefix admin-web run test:e2e -- <targeted spec>`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`

### PR4: Targeted Pilot Friction Fixes

Risk: `R1/R2`, split further if auth/API/workflow risk appears.

Output:

- Only issues found in PR1 audit.
- Typical examples: UUID display, mobile overflow, broken export button, stale loading, role-hidden nav delay.

Verification:

- Targeted e2e for each fixed route.
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`

### PR5: Pilot Daily Ops Runbook

Risk: `R0 docs/process`.

Output:

- `docs/runbooks/pilot-daily-ops-runbook-v1.md`
- Deploy, smoke, import, data-quality, issue triage, rollback and communication flow.

Verification:

- `git diff --check`
- `npm.cmd run test:scripts` if linked by script guards.

## Detailed Tasks

### Task 1: Establish Fresh Baseline And Branch Hygiene

**Files:**

- Read: `CONTRIBUTING.md`
- Read: `current-state.md`
- Read: `sokrates.md`
- Read: `discipline.md`
- Read: `docs/README.md`
- Modify: none

- [ ] **Step 1: Confirm main and dirty state**

Run:

```powershell
git fetch origin
git status --short --branch
git log -3 --oneline --decorate
```

Expected:

- Current branch is `main`.
- `main` is aligned with `origin/main` before new branches.
- Any unrelated dirty files are listed and explicitly excluded.

- [ ] **Step 2: Create PR1 branch**

Run:

```powershell
git switch -c codex/pilot-readiness-pre-external-data-audit
```

Expected:

- New branch starts from current `main`.

- [ ] **Step 3: Record scope in working notes**

Write in the PR description draft:

```markdown
Contract Impact:
- No API shape changes.
- No DB schema changes.
- No auth/scope changes.
- No scoring/ranking/incentive/checklist formula changes.
- No external provider integration.
- No fake data.
```

Expected:

- Reviewers can see this is a readiness audit/docs slice.

### Task 2: Build Persona Route Audit Matrix

**Files:**

- Create: `docs/evidence/pilot-readiness-pre-external-data-v1-YYYY-MM-DD.md`
- Read: `admin-web/src/routes/*` or route registry files found by `rg "store route|admin route|route registry" admin-web/src`
- Read: `admin-web/e2e/*pilot*`

- [ ] **Step 1: Identify active pilot personas**

Run:

```powershell
rg -n "pilot|REGION_MANAGER|STORE_MANAGER|SUPER_ADMIN|PERSONNEL|STORE_PERSONNEL" admin-web backend docs .env.local
```

Expected:

- Local ignored env may contain pilot credentials; do not copy secrets into docs.
- Evidence doc records persona labels only, not passwords, OTP, bearer tokens, or cookies.

- [ ] **Step 2: Create route matrix section**

Add this table to the evidence file:

```markdown
## Persona Route Matrix

| Persona | Route | Expected | Evidence | Status | Notes |
|---|---|---:|---|---|---|
| Admin | `/admin/auth` | visible | pending | pending | access workbench |
| Admin | `/admin/master-data` | visible | pending | pending | master data control |
| Region Manager | `/store/home` | visible | pending | pending | assigned region/store summary |
| Region Manager | `/store/kpis` | visible | pending | pending | assigned stores only |
| Region Manager | `/store/rankings` | visible | pending | pending | region/Turkey visibility rules |
| Region Manager | `/store/checklists` | visible | pending | pending | checklist visit and result flow |
| Region Manager | `/store/tasks` | visible | pending | pending | completed store-manager action visibility |
| Region Manager | `/store/targets` | visible | pending | pending | approval queue and approved state |
| Region Manager | `/store/incentives` | visible for company stores | pending | pending | post-close approval flow |
| Region Manager | `/store/workforce` | visible | pending | pending | norm kadro |
| Region Manager | `/store/feed` | visible and can post | pending | pending | announcement feed |
| Region Manager | `/store/reports` | visible | pending | pending | monthly Excel package |
| Store Manager | `/store/incentives` | visible for company store only | pending | pending | earned incentive, no approval flow |
| Store Personnel | `/store/me` | visible | pending | pending | self performance |
| Store Personnel | `/store/checklists` | forbidden | pending | pending | negative access |
```

Expected:

- The table names expected behavior without inventing data.

- [ ] **Step 3: Fill evidence with smoke notes**

For each route manually or with existing smoke harness, record:

```markdown
Evidence format:
- Date/time:
- Environment: staging/local
- Persona:
- Route:
- Result:
- Screenshot/log path:
- Issue id if any:
```

Expected:

- The evidence is enough for a cold reviewer to reproduce or understand the finding.

### Task 3: Audit Store Pages For Pilot Friction

**Files:**

- Modify: `docs/evidence/pilot-readiness-pre-external-data-v1-YYYY-MM-DD.md`
- Read only initially: `admin-web/src/pages/Store*.tsx`, `admin-web/src/pages/store-*`

- [ ] **Step 1: Search for known friction patterns**

Run:

```powershell
rg -n "Veri yok|Kaynak yok|UUID|uuid|scope|API|DB|mock|fake|FIXME|placeholder|\\.id\\b|userId|storeId|regionId" admin-web/src/pages admin-web/src/features
```

Expected:

- Record findings only when the string is user-visible or can leak into UI.
- Internal variables named `storeId` are not bugs by themselves.

- [ ] **Step 2: Check heavy Store routes**

Focus routes:

```text
/store/incentives
/store/master-data equivalent if any
/store/kpis
/store/rankings
/store/checklists
/store/targets
/store/workforce
/store/reports
```

For each route, record:

```markdown
| Route | First render concern | Data concern | UI concern | Role/scope concern | Severity | Next PR |
|---|---|---|---|---|---|---|
```

Severity rules:

- `P0`: user cannot enter the pilot-critical page.
- `P1`: wrong data, wrong permission, wrong business decision, blocked action.
- `P2`: slow, confusing, export/action broken, important UI overflow.
- `P3`: polish, copy, alignment, non-blocking visual issue.

- [ ] **Step 3: Split fixes**

Write a fix split section:

```markdown
## Fix Split

| Finding | PR | Risk | Why split this way |
|---|---|---|---|
```

Expected:

- No mixed PRs: auth/API/data binding separate from UI polish.

### Task 4: Define Canonical External Source Contract

**Files:**

- Create: `docs/contracts/external-source-canonical-data-contract-v1.md`
- Optional Test: `scripts/external-source-contract-doc.test.mjs`

- [ ] **Step 1: Write contract header**

Create the file with:

```markdown
# External Source Canonical Data Contract V1

## Goal

Define the provider-agnostic row shapes HR Axis expects after external source extraction and before domain materialization.

## Current Decision

- Power BI/Excel remains the current active source path.
- JSON/Nebim direct pull is parked until provider fields and access method are known.
- Domain pages must not read provider-native payloads directly.
- Adapter output must be canonical, validated, and auditable.
```

Expected:

- The contract does not assume Nebim field names.

- [ ] **Step 2: Define required canonical dimensions**

Add:

```markdown
## Canonical Dimensions

| Field | Type | Required | Rule |
|---|---|---:|---|
| `sourceSystem` | string | yes | Example: `power-bi`, `excel`, future `nebim`; provider label only |
| `sourceBatchId` | string | yes | Stable id for one extraction/import batch |
| `sourceRowId` | string | yes | Stable row id or generated hash from immutable source fields |
| `period` | `YYYY-MM` | yes | Month being reported |
| `businessDate` | `YYYY-MM-DD` | yes when daily data exists | Sales/action date; monthly rows may use last day of month |
| `storeCode` | string | yes | Must map to one active store or go to quarantine |
| `storeNameRaw` | string | no | Evidence only, not a join key by itself |
| `employeeCode` | string | no | Required for personnel-level sales/performance |
| `employeeNameRaw` | string | no | Evidence only, not a join key by itself |
| `metricCode` | string | yes | Canonical metric code such as `NET_SALES`, `GSM_ONAY`, `CR` |
| `metricValue` | decimal/string | yes | Parsed by metric-specific adapter; preserve precision |
| `currencyCode` | string | no | Required for money metrics; default `TRY` only if source omits and source is known TRY |
| `importedAt` | ISO datetime | yes | System import timestamp |
```

Expected:

- Store/personnel matching rules are explicit.

- [ ] **Step 3: Define canonical facts**

Add sections:

```markdown
## Canonical Fact Families

### Sales Fact

Required fields:
- `period`
- `businessDate`
- `storeCode`
- `employeeCode`
- `netSalesAmount`
- `quantity`
- `sourceBatchId`
- `sourceRowId`

Rules:
- Sales attribution follows selling employee/source store semantics already accepted by the product.
- Cross-store return/exchange behavior must not be reinterpreted in the adapter without product decision.
- No rounding before domain calculation.

### Store KPI Fact

Required fields:
- `period`
- `storeCode`
- `metricCode`
- `metricValue`
- `sourceBatchId`
- `sourceRowId`

Rules:
- `GSM_ONAY` is store-level and contributes to store KPI score using current configured weight.
- Missing metric rows remain missing; do not fabricate zeros unless the metric contract says zero is a valid absence.

### Target Fact

Required fields:
- `period`
- `storeCode`
- `targetAmount`
- `sourceBatchId`
- `sourceRowId`

Optional personnel fields:
- `employeeCode`
- `employeeTargetAmount`

Rules:
- New targets should flow through the target workflow.
- Historical imported targets may satisfy read/calculation paths only when explicitly accepted by current close/readiness logic.
```

Expected:

- Future adapter work has a target without changing business math.

### Task 5: Define Data Quality Rules And Quarantine Policy

**Files:**

- Create: `docs/contracts/external-source-data-quality-rules-v1.md`
- Optional Test: `scripts/external-source-contract-doc.test.mjs`

- [ ] **Step 1: Write quarantine decision**

Add:

```markdown
# External Source Data Quality Rules V1

## Decision

Rows that cannot be safely mapped must not block the full pilot surface. They must be quarantined with reason, batch id, source row id, and raw evidence fields. Domain calculations must consume accepted rows only and expose import health separately.
```

Expected:

- This matches the user's current tolerance: known unmatched historical personnel should not block incentive/KPI operation during development.

- [ ] **Step 2: Define row outcomes**

Add:

```markdown
## Row Outcomes

| Outcome | Meaning | Domain calculation? | Operator action |
|---|---|---:|---|
| `accepted` | Store/person/metric/date mapped and valid | yes | none |
| `accepted_without_person` | Store-level row valid; personnel mapping absent but not required | yes for store metrics | optional mapping cleanup |
| `quarantined_store_unmatched` | Store code/name cannot map to one store | no | map store or correct source |
| `quarantined_employee_unmatched` | Employee code cannot map for personnel-level fact | no for personnel fact | map employee/personnel code |
| `quarantined_duplicate` | Same immutable source row already imported | no | review source batch |
| `quarantined_invalid_period` | Period/date invalid or outside accepted range | no | correct source |
| `quarantined_invalid_metric` | Metric code/value cannot be parsed | no | adapter mapping fix |
```

Expected:

- Failed rows are visible without corrupting accepted rows.

- [ ] **Step 3: Define pilot tolerance**

Add:

```markdown
## Pilot Tolerance

Pilot can proceed when:
- Accepted store-level facts exist for the target month.
- Quarantined rows are visible by batch and reason.
- Quarantined personnel rows do not prevent store-level KPI/reporting from rendering.
- Incentive/personnel pages clearly show missing personnel target or sales source where data is absent.

Pilot must stop when:
- Store mapping has broad unresolved failure.
- Period parsing is inconsistent.
- Accepted rows are silently dropped.
- KPI/prim/ranking calculations use quarantined rows.
- Role/scope filters expose another region/store/personnel's data.
```

Expected:

- "Known unmatched rows" are handled without hiding real data loss.

### Task 6: Create Pilot Smoke Pack Scope

**Files:**

- Create or Modify: `scripts/pilot-readiness-smoke-contract.test.mjs`
- Modify if needed: `package.json`
- Modify if needed: `admin-web/e2e/pilot-readiness-smoke.spec.ts`

- [ ] **Step 1: Add docs contract test if docs are created**

If adding the docs above, create a test like:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

test('external source contract keeps provider payloads behind canonical boundary', () => {
  const contract = readFileSync(
    join(root, 'docs/contracts/external-source-canonical-data-contract-v1.md'),
    'utf8',
  )
  assert.match(contract, /provider-agnostic/i)
  assert.match(contract, /Domain pages must not read provider-native payloads directly/i)
  assert.match(contract, /sourceBatchId/)
  assert.match(contract, /sourceRowId/)
})

test('external source data quality rules keep quarantine separate from calculations', () => {
  const rules = readFileSync(
    join(root, 'docs/contracts/external-source-data-quality-rules-v1.md'),
    'utf8',
  )
  assert.match(rules, /quarantined_employee_unmatched/)
  assert.match(rules, /Domain calculations must consume accepted rows only/i)
  assert.match(rules, /Pilot must stop when:/)
})
```

Run:

```powershell
node --test scripts/pilot-readiness-smoke-contract.test.mjs
```

Expected:

- PASS.

- [ ] **Step 2: Decide whether runtime smoke is needed now**

Decision:

```markdown
Runtime smoke is added only if PR1 audit finds a repeatable route/persona failure or a high-value existing route matrix gap. Otherwise this PR remains docs/contract only.
```

Expected:

- No new e2e is added just for ceremony.

- [ ] **Step 3: If runtime smoke is needed, keep it narrow**

Minimum e2e coverage:

```text
Admin:
- `/admin/auth` loads user table without limit error.
- `/admin/master-data` loads without frozen UI.

Region Manager:
- `/store/home` loads.
- `/store/kpis` shows assigned-region store count.
- `/store/checklists` opens checklist modal.
- `/store/reports` hides from store manager but shows for BM.

Store Manager:
- `/store/home` loads.
- `/store/incentives` shows earned-incentive surface only for company store.

Personnel:
- `/store/me` loads.
- `/store/checklists` direct route is denied.
```

Expected:

- E2E asserts behavior, not screenshots.

### Task 7: Performance Measurement For Heavy Pages

**Files:**

- Create evidence section in `docs/evidence/pilot-readiness-pre-external-data-v1-YYYY-MM-DD.md`
- Modify code only if a measurable problem is found.

- [ ] **Step 1: List heavy candidates**

Use:

```markdown
## Performance Candidates

| Route | Concern | Measurement | Root cause | Fix decision |
|---|---|---|---|---|
| `/store/incentives` | slow initial load | pending | pending | pending |
| `/admin/master-data` | in-page jank | pending | pending | pending |
| `/store/rankings` | dense table | pending | pending | pending |
| `/store/kpis` | heavy data projection | pending | pending | pending |
```

Expected:

- The team knows where subjective "kasiyor" reports map.

- [ ] **Step 2: Inspect query/render patterns**

Run:

```powershell
rg -n "useQuery|useQueries|setInterval|refetchInterval|useMemo|filter\\(|map\\(|sort\\(" admin-web/src/pages admin-web/src/features
```

Expected:

- Record only route-relevant findings.
- `setInterval`/`refetchInterval` on store surfaces should be challenged unless explicitly justified.

- [ ] **Step 3: Define acceptable fixes**

Allowed fixes:

```text
- move expensive derived lists into memoized selectors
- reduce duplicate queries
- split heavy detail data behind drawer/open action
- keep sidebar nav static while eligibility data loads
- remove full-page polling
- avoid rendering all rows when only a filtered subset is visible
```

Not allowed in this plan:

```text
- new cache/provider architecture
- backend denormalization
- DB index/migration without evidence
- changing API response shape
```

### Task 8: Pilot Daily Ops Runbook

**Files:**

- Create: `docs/runbooks/pilot-daily-ops-runbook-v1.md`

- [ ] **Step 1: Write daily start checklist**

Include:

```markdown
# Pilot Daily Ops Runbook V1

## Daily Start

1. Confirm frontend staging is reachable.
2. Confirm backend health endpoint is reachable.
3. Confirm latest Render deploy SHA and Vercel deploy SHA match expected release.
4. Run pilot smoke for Admin, BM, SM and Personnel personas.
5. Check import/data quality status for latest batch.
6. Check error reports and user feedback queue.
```

Expected:

- Pilot day starts with repeatable checks.

- [ ] **Step 2: Write import day flow**

Include:

```markdown
## Import Day Flow

1. Upload or pull source data using the currently approved source path.
2. Confirm batch created.
3. Confirm accepted row count.
4. Confirm quarantine count and top reasons.
5. Confirm store-level KPIs render.
6. Confirm rankings render.
7. Confirm incentive/target/report pages do not block on known quarantined personnel rows.
8. Record evidence.
```

Expected:

- External data problems are diagnosed at batch/quality layer first, not by guessing in UI.

- [ ] **Step 3: Write stop/rollback rules**

Include:

```markdown
## Stop Rules

Stop pilot validation and do not claim readiness if:
- Auth/session login loops recur.
- Persona sees another region/store/personnel data.
- KPI/ranking/prim calculations silently drop accepted rows.
- Import accepted/quarantine counts are not explainable.
- Checklist completion or task generation breaks.
- Reports export invalid files.

Rollback:
- Revert the last app PR if behavior changed.
- Disable the new source path if provider import caused the issue.
- Keep accepted prior batches unchanged unless a data corruption decision is explicitly made.
```

Expected:

- Operators know when to stop instead of patching live behavior blindly.

## Verification Plan

Docs-only PRs:

```powershell
git diff --check
npm.cmd run test:scripts
```

Frontend smoke/UI PRs:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- <targeted spec>
```

Backend/API read PRs if any:

```powershell
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run test -- <targeted test>
```

Cross-domain or release-impacting PR:

```powershell
npm.cmd run check:release
```

## Acceptance Criteria

This plan is complete when:

- Pilot persona route matrix is recorded with evidence.
- External canonical data contract exists.
- Data quality/quarantine rules exist.
- Pilot daily ops runbook exists.
- Any discovered P0/P1 bugs have either a merged fix or an explicit stop/park decision.
- P2/P3 polish issues are split into small PR candidates.
- No new fake data, provider assumptions, or business formula changes were introduced.
- Working tree remains free of plan-related uncommitted changes after each PR.

## Risks And Mitigations

| Risk | Severity | Mitigation |
|---|---:|---|
| External source assumptions leak into code before Nebim shape is known | High | Keep this plan docs/audit/smoke first; no provider adapter code |
| Known unmatched personnel rows block pilot pages | Medium | Quarantine accepted/missing distinction, accepted rows still calculate |
| Smoke pack becomes too broad and slow | Medium | Start with route/persona critical path only |
| UI polish gets mixed with data/auth fixes | Medium | Split PRs by risk class |
| Performance work turns into rewrite | Medium | Require measured route-specific root cause |
| Secrets leak into evidence docs | High | Evidence uses persona labels only; no OTP, token, cookie, password, raw env |

## Self-Review

Spec coverage:

- Pilot audit: covered by Tasks 1-3.
- Data quality/mapping: covered by Tasks 4-5.
- Canonical contract: covered by Task 4.
- Performance: covered by Task 7.
- Runbook: covered by Task 8.
- Smoke pack: covered by Task 6.
- UI polish handling: covered by PR4 and Task 3 split rules.

Placeholder scan:

- No placeholder markers or open-ended "handle later" steps remain.
- External provider values are intentionally not invented.

Boundary check:

- No DB migration.
- No API shape change.
- No auth/scope change.
- No business formula change.
- No fake data.
- No Nebim implementation before source evidence.

## Execution Recommendation

Recommended execution:

1. PR1 audit/evidence first.
2. PR2 contracts/data quality docs second.
3. PR3 smoke pack only if PR1 shows repeatable gaps.
4. PR4 targeted fixes split by risk.
5. PR5 runbook closeout.

Use subagents for PR1 route/page audit because routes are independent and findings can be reconciled into one evidence file. Use inline execution for PR2 and PR5 because they are docs/contracts and need consistent wording.
