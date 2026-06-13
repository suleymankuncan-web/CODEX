# Store Checklist Result Modal Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Approved `docs/prototypes/store-checklist-result-modal-v1.html` sonuc modalini production `ChecklistResultModal` yuzeyine prototip kontratina sadik kalarak tasimak.

**Architecture:** Bu bir UI-only prototype-to-product slice'idir. Mevcut checklist acknowledgement API, auth, role/scope, completion, acknowledgement ve checklist remediation/task uretim semantigi degismez; production component yalnizca mevcut veriyi yeni modal yapisiyla gosterir. Tasima, React modal JSX'i, modal CSS'i, lokalizasyon anahtarlari ve targeted Playwright guard'lari uzerinden yapilir.

**Tech Stack:** React, TypeScript, shadcn/ui Dialog/Button/Textarea, Tailwind v4 utility class sistemi, lucide-react iconlari, Playwright e2e.

**Implementation Status:** Completed in PR #712 on 2026-06-13. This document is
now the implementation contract and closeout reference, not an open runtime
task list.

---

## Design Read

Bu is Store operasyonel urun modali icin approved prototype-to-product tasimadir. Hedef, dekoratif bir redesign degil; tamamlanmis checklist sonucunu daha okunur, hizli taranir ve mobile dayanikli hale getiren kompakt bir product UI'dir.

## Source Contract

Kaynak prototip:

- `docs/prototypes/store-checklist-result-modal-v1.html`

Production hedef:

- Route/surface: `/store/checklists`
- Component: `admin-web/src/pages/store-checklists-result-modal.tsx`
- CSS: `admin-web/src/styles/store-checklists-result-modal.css`
- Veri kaynagi: `ChecklistAcknowledgementItem` via `admin-web/src/features/checklists/api.ts`

Prototipten tasinacak zorunlu parcalar:

- Eyebrow: `Kontrol listesi sonucu`.
- Baslik: gercek `item.templateName`.
- Ust skor karti: daire skor gorseli, skor rakami ve `Skor` etiketi tam ortali.
- Ozet grid: Magaza, Sablon tipi, Tamamlayan, Durum, Dusuk puan, Uyum, Bolum, Tamamlanma.
- Kaldirilacak bantlar: `Sonuc ozeti` digest card ve `Dikkat isteyen maddeler` alert card.
- Body: `Kontrol listesi kirilimi` dogrudan overview altina yakin baslar.
- Legend: `Renk anlami`, `Dusuk`, `Takip`, `Iyi`.
- Bolum basliklari: cyan/glacier vurgulu, prototipteki parlak konu basligi dili.
- Madde satirlari: danger/warning/success tonlari, sol vurgu cizgisi, status badge, skor fact.
- Aksiyon karti: mevcut acknowledgement note, cancel, acknowledge, review-only ve acknowledged state davranisini korur.

## Non-Goals

- Backend, DB migration, OpenAPI generator, API endpoint, auth veya permission degisikligi yok.
- Checklist tamamlanma, taslak, ziyaret tarihi, acknowledgement, store action plan veya remediation/task uretimi degismez.
- `Takip` etiketi task uretmez. Production task/remediation semantigi backend `checklist_remediation` ve non-compliance akisi neyse aynen kalir.
- Lufian/header/brand shell, sidebar, route guard ve toolbar bu planda degismez.
- Checklist template skorlama kurali, weight, threshold veya KPI etkisi degismez.

## Data Mapping

`ChecklistResultModal` icinde gorunen her alan mevcut data contract'ina baglanir:

| UI alan | Kaynak |
| --- | --- |
| Baslik | `input.item.templateName` |
| Tamamlanma cumlesi | `formatCompletedSentence(input.t, input.locale, input.item)` |
| Skor rakami | `input.item.totalScore ?? Math.round(input.item.complianceRate * 100)` |
| Magaza | `input.item.storeName || input.item.storeId` |
| Sablon tipi | `formatChecklistTemplateType(input.t, input.item.templateType)` |
| Tamamlayan | `input.item.completedByUserId ?? unknown` |
| Durum | `acknowledged` veya `needsAcknowledgement` |
| Dusuk puan | mevcut `getLowScoreResponses(input.item.responses).length` |
| Uyum | `formatComplianceValue(input.t, input.item.complianceRate)` |
| Bolum | `groupChecklistResultResponses(input.item.responses).length` |
| Tamamlanma | `formatDateTime(input.item.completedAt, input.locale)` veya `unknown` |

Madde renkleri UI-only okuma kolayligi icindir:

- `danger / Dusuk`: score ratio `< 70`; mevcut `getLowScoreResponses` dusuk puan sayisiyla ayni okuma esigidir.
- `warning / Takip`: score ratio `>= 70 && < 80`.
- `success / Iyi`: score ratio `>= 80`.
- `neutral / Puan yok`: score ratio yoksa, legend disinda sakin neutral satir.

Bu bandlar remediation/task semantigi degildir. Eger is sahibi `Dusuk` badge'inin task uretecek backend non-compliance ile birebir ayni olmasini isterse bu plan durur ve ayri bir backend/API slice'i acilir; UI-only PR bunu tahmin ederek yapmaz.

## Files

- Modify: `admin-web/src/pages/store-checklists-result-modal.tsx`
- Modify: `admin-web/src/styles/store-checklists-result-modal.css`
- Modify: `admin-web/src/pages/store-checklists-logic.ts`
- Modify: `admin-web/src/features/localization/messages/store-checklists.ts`
- Modify: `admin-web/e2e/checklist-today-surfaces.spec.ts`
- Optional evidence after implementation: `docs/evidence/store-checklist-result-modal-prototype-implementation-v1-2026-06-13.md`

## PR Plan

One PR is enough because scope is a single production modal and its tests. PR title:

`Store checklist result modal prototype parity`

PR must state explicitly:

- UI-only change.
- API shape, DB schema, auth/permission, checklist scoring, acknowledgement, queue/import/provider behavior, and remediation/task workflows unchanged.
- `Takip` is a visual status, not a task generation signal.
- Desktop/mobile prototype parity was checked.

---

### Task 1: Lock E2E Contract Before UI Rewrite

**Files:**

- Modify: `admin-web/e2e/checklist-today-surfaces.spec.ts`

- [ ] **Step 1: Add a warning-band fixture response**

In `createChecklistAcknowledgementsFixture`, add a third response to the first `BM Result` item so e2e can see all three item tones in one modal:

```ts
{
  templateItemId: '55555555-5555-4555-8555-555555555557',
  sectionName: 'Vitrin',
  itemNo: 3,
  itemText: 'Vitrin kampanya etiketi dogru',
  responseType: 'score',
  weight: 20,
  maxScore: 10,
  scoreValue: options.resultWithoutScore ? null : 7,
  commentText: 'Takipte kalacak etiket duzeni',
},
```

Expected fixture tones after implementation:

- `5 / 10` -> `Dusuk`
- `7 / 10` -> `Takip`
- `9 / 10` -> `Iyi`

- [ ] **Step 2: Update the Turkish acknowledgement modal test**

Replace the current expectation for `Checklist sonucu` and `Dikkat isteyen maddeler` with the production copy and removed-band assertions:

```ts
const dialog = page.getByRole('dialog')
await expect(dialog.getByText('Kontrol listesi sonucu', { exact: true })).toBeVisible()
await expect(dialog.getByText('Sonuc ozeti')).toHaveCount(0)
await expect(dialog.getByText('Dikkat isteyen maddeler')).toHaveCount(0)
await expect(dialog.getByText('Renk anlami', { exact: true })).toBeVisible()
await expect(dialog.getByText('Dusuk', { exact: true })).toBeVisible()
await expect(dialog.getByText('Takip', { exact: true })).toBeVisible()
await expect(dialog.getByText('Iyi', { exact: true })).toBeVisible()
await expect(dialog.locator('.store-checklist-result-item-danger')).toHaveCount(1)
await expect(dialog.locator('.store-checklist-result-item-warning')).toHaveCount(1)
await expect(dialog.locator('.store-checklist-result-item-success')).toHaveCount(1)
```

If the file uses Turkish characters in assertions, write the strings as real UTF-8 Turkish text in the final patch:

```ts
Kontrol listesi sonucu
Sonuç özeti
Dikkat isteyen maddeler
Renk anlamı
Düşük
İyi
```

- [ ] **Step 3: Add score centering assertion**

Add this assertion in the same modal test after the dialog is visible:

```ts
const scoreCenterDelta = await dialog.locator('.store-checklist-result-score-ring').evaluate((element) => {
  const ring = element.getBoundingClientRect()
  const score = element.querySelector('strong')?.getBoundingClientRect()
  if (!score) return 999
  return Math.abs((score.left + score.width / 2) - (ring.left + ring.width / 2))
})
expect(scoreCenterDelta).toBeLessThanOrEqual(1)
```

- [ ] **Step 4: Extend the mobile modal test**

In `store manager checklist result modal stays usable on mobile width`, add:

```ts
await expect(dialog.getByText('Renk anlamı', { exact: true })).toBeVisible()
await expect(dialog.locator('.store-checklist-result-score-ring')).toBeVisible()
await expect(dialog.getByText('Dikkat isteyen maddeler')).toHaveCount(0)
```

- [ ] **Step 5: Run the focused test and confirm it fails before implementation**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts --grep "acknowledgement language|result modal stays usable"
```

Expected before implementation: FAIL because production still renders the old copy/bands and lacks new legend/tone classes.

---

### Task 2: Add Pure Result Tone Helpers

**Files:**

- Modify: `admin-web/src/pages/store-checklists-logic.ts`

- [ ] **Step 1: Add the result item tone type and helpers near `getResponseRatio`**

```ts
export type ChecklistResultItemTone = 'danger' | 'warning' | 'success' | 'neutral'

export function getChecklistResultItemTone(item: ChecklistAcknowledgementItem['responses'][number]): ChecklistResultItemTone {
  const ratio = getResponseRatio(item)
  if (ratio === null) return 'neutral'
  if (ratio < 70) return 'danger'
  if (ratio < 80) return 'warning'
  return 'success'
}

export function getChecklistResultItemToneLabel(t: TranslateFunction, tone: ChecklistResultItemTone) {
  switch (tone) {
    case 'danger':
      return t('storeChecklists.resultTone.low')
    case 'warning':
      return t('storeChecklists.resultTone.follow')
    case 'success':
      return t('storeChecklists.resultTone.good')
    case 'neutral':
      return t('storeChecklists.resultTone.noScore')
  }
}
```

- [ ] **Step 2: Keep `getLowScoreResponses` unchanged**

Do not change this existing behavior:

```ts
export function getLowScoreResponses(items: ChecklistAcknowledgementItem['responses']) {
  return items.filter((item) => {
    const ratio = getResponseRatio(item)
    return ratio !== null && ratio < 70
  })
}
```

Reason: the summary count and existing sorting/filter behavior already depend on this definition. The new tone helper is visual-only.

---

### Task 3: Update Localization Copy

**Files:**

- Modify: `admin-web/src/features/localization/messages/store-checklists.ts`

- [ ] **Step 1: Replace Turkish result eyebrow**

Change:

```ts
'storeChecklists.resultEyebrow': 'Checklist sonucu',
```

to:

```ts
'storeChecklists.resultEyebrow': 'Kontrol listesi sonucu',
```

- [ ] **Step 2: Add Turkish result modal keys**

Add these keys in `storeChecklistsTr` near the existing result keys:

```ts
'storeChecklists.resultBreakdownTitle': 'Kontrol listesi kırılımı',
'storeChecklists.resultItemsEyebrow': 'Maddeler',
'storeChecklists.resultColorMeaning': 'Renk anlamı',
'storeChecklists.resultSectionCount': '{count} bölüm',
'storeChecklists.resultTone.low': 'Düşük',
'storeChecklists.resultTone.follow': 'Takip',
'storeChecklists.resultTone.good': 'İyi',
'storeChecklists.resultTone.noScore': 'Puan yok',
```

- [ ] **Step 3: Add English fallback keys**

Add matching keys in `storeChecklistsEn`:

```ts
'storeChecklists.resultBreakdownTitle': 'Checklist breakdown',
'storeChecklists.resultItemsEyebrow': 'Items',
'storeChecklists.resultColorMeaning': 'Color meaning',
'storeChecklists.resultSectionCount': '{count} sections',
'storeChecklists.resultTone.low': 'Low',
'storeChecklists.resultTone.follow': 'Follow-up',
'storeChecklists.resultTone.good': 'Good',
'storeChecklists.resultTone.noScore': 'No score',
```

- [ ] **Step 4: Keep acknowledgement language stable**

Do not rename these keys in this PR:

```ts
storeChecklists.acknowledgementNote
storeChecklists.acknowledge
storeChecklists.acknowledging
storeChecklists.reviewOnlyCopy
storeChecklists.needsAcknowledgement
storeChecklists.acknowledged
```

---

### Task 4: Rebuild `ChecklistResultModal` Markup From Prototype Structure

**Files:**

- Modify: `admin-web/src/pages/store-checklists-result-modal.tsx`

- [ ] **Step 1: Update imports**

Remove unused digest/alert imports after the rewrite:

```ts
CircleAlert
getChecklistResultDigest
```

Add helper imports:

```ts
getChecklistResultItemTone,
getChecklistResultItemToneLabel,
```

- [ ] **Step 2: Remove digest state from component**

Delete:

```ts
const digest = getChecklistResultDigest(input.t, input.locale, input.item)
```

Replace icon tone usage with score tone:

```tsx
<span className={`store-checklist-result-icon store-checklists-tone-${scoreTone}`} aria-hidden="true">
  <ClipboardCheck />
</span>
```

- [ ] **Step 3: Replace score card JSX**

Change the score card body to the prototype ring:

```tsx
<div className={`store-checklist-result-score-card store-checklist-result-score-card-${scoreTone}`}>
  <div className="store-checklist-result-score-ring" aria-label={`${input.t('storeChecklists.score')} ${scoreLabel}`}>
    <strong>{scoreLabel}</strong>
    <span>{input.t('storeChecklists.score')}</span>
  </div>
</div>
```

Remove the old compliance paragraph from the score card; compliance stays in the summary grid.

- [ ] **Step 4: Make summary grid match prototype**

Keep `ChecklistFact`, but order facts exactly:

```tsx
<ChecklistFact label={input.t('storeChecklists.store')} value={input.item.storeName || input.item.storeId} />
<ChecklistFact label={input.t('storeChecklists.templateType')} value={formatChecklistTemplateType(input.t, input.item.templateType)} />
<ChecklistFact label={input.t('storeChecklists.resultCompletedBy')} value={input.item.completedByUserId ?? input.t('storeChecklists.unknown')} />
<ChecklistFact label={input.t('storeChecklists.resultStatus')} value={hasAcknowledgement ? input.t('storeChecklists.acknowledged') : input.t('storeChecklists.needsAcknowledgement')} />
<ChecklistFact label={input.t('storeChecklists.resultLowScore')} value={input.t('storeChecklists.lowScoreCount', { count: lowScoreResponses.length })} />
<ChecklistFact label={input.t('storeChecklists.compliance')} value={formatComplianceValue(input.t, input.item.complianceRate)} />
<ChecklistFact label={input.t('storeChecklists.section')} value={input.t('storeChecklists.resultSectionCount', { count: sections.length })} />
<ChecklistFact label={getStaticCopy(input.locale, 'Tamamlanma', 'Completed')} value={completedAt} />
```

- [ ] **Step 5: Delete old digest and alert blocks**

Remove the full `store-checklist-result-digest-card` section and the `store-checklist-result-alert` conditional block. Do not replace them with another summary paragraph.

- [ ] **Step 6: Add legend before sections**

Inside `.store-checklist-result-findings`, after the block head and before `.store-checklist-result-sections`, add:

```tsx
<div className="store-checklist-result-status-legend" aria-label={input.t('storeChecklists.resultColorMeaning')}>
  <strong>{input.t('storeChecklists.resultColorMeaning')}</strong>
  <span><i className="store-checklist-result-legend-dot store-checklist-result-legend-dot-danger" aria-hidden="true" />{input.t('storeChecklists.resultTone.low')}</span>
  <span><i className="store-checklist-result-legend-dot store-checklist-result-legend-dot-warning" aria-hidden="true" />{input.t('storeChecklists.resultTone.follow')}</span>
  <span><i className="store-checklist-result-legend-dot store-checklist-result-legend-dot-success" aria-hidden="true" />{input.t('storeChecklists.resultTone.good')}</span>
</div>
```

- [ ] **Step 7: Update findings block labels**

Use the new localization keys:

```tsx
<span>{input.t('storeChecklists.resultItemsEyebrow')}</span>
<strong>{input.t('storeChecklists.resultBreakdownTitle')}</strong>
```

Use the section count pill:

```tsx
<span className="store-checklist-result-section-count">
  {input.t('storeChecklists.resultSectionCount', { count: sections.length })}
</span>
```

- [ ] **Step 8: Update item row markup**

Inside `section.items.map`, compute tone and label:

```tsx
const ratio = getResponseRatio(response)
const itemTone = getChecklistResultItemTone(response)
const itemToneLabel = getChecklistResultItemToneLabel(input.t, itemTone)
```

Render rows as:

```tsx
<div className={`store-checklist-result-item store-checklist-result-item-${itemTone}`} key={response.templateItemId}>
  <div>
    <div className="store-checklist-result-item-title-line">
      <strong>{response.itemText}</strong>
      <span className={`store-checklist-result-item-status store-checklist-result-item-status-${itemTone}`}>
        {itemToneLabel}
      </span>
    </div>
    {response.commentText ? <p>{response.commentText}</p> : null}
  </div>
  <ChecklistFact
    label={input.t('storeChecklists.score')}
    value={
      response.scoreValue === null
        ? input.t('storeChecklists.noScore')
        : `${response.scoreValue}/${response.maxScore}`
    }
  />
</div>
```

If the final JSX does not use `ratio`, remove the const before running lint.

- [ ] **Step 9: Preserve action card behavior**

Do not change:

```tsx
input.canAcknowledge
input.isAcknowledging
input.onAcknowledge(acknowledgementNoteRef.current)
input.onNoteChange(event.target.value)
input.onClose
```

The action card can be restyled in CSS, but the control flow and mutation payload remain identical.

---

### Task 5: Port Prototype CSS Into Production Modal Styles

**Files:**

- Modify: `admin-web/src/styles/store-checklists-result-modal.css`

- [ ] **Step 1: Remove obsolete result-only styles**

Delete or stop referencing result-only styles for:

```css
.store-checklist-result-digest-card
.store-checklist-result-alert
```

If shared modal session styles use similar names, keep only the shared styles that are still referenced by the active checklist session modal.

- [ ] **Step 2: Add centered score ring**

Add production CSS based on the prototype:

```css
.store-checklist-result-score-card {
  display: grid;
  min-height: 10.75rem;
  place-items: center;
  border: 1px solid rgba(124, 58, 237, 0.14);
  border-radius: 1rem;
  background:
    linear-gradient(135deg, rgba(124, 58, 237, 0.14), rgba(19, 167, 179, 0.1)),
    rgba(255, 255, 255, 0.88);
  padding: 0.875rem;
  text-align: center;
}

.store-checklist-result-score-ring {
  display: flex;
  width: 8.5rem;
  height: 8.5rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background:
    radial-gradient(circle at center, #fff 0 58%, transparent 59%),
    conic-gradient(var(--checklist-plum) 0 82%, rgba(124, 58, 237, 0.12) 82% 100%);
  color: var(--store-command-plum-deep, #4c2aa5);
  box-shadow: 0 14px 32px rgba(76, 42, 165, 0.16);
}

.store-checklist-result-score-ring strong {
  display: block;
  font-size: clamp(2.45rem, 5vw, 3rem);
  font-weight: 860;
  line-height: 1;
}

.store-checklist-result-score-ring span {
  margin-top: 0.5rem;
  color: var(--checklist-muted);
  font-size: 0.75rem;
  font-weight: 820;
}
```

- [ ] **Step 3: Make overview facts match prototype density**

Scope these styles under `.store-checklist-result-overview`:

```css
.store-checklist-result-overview .store-checklists-fact {
  min-height: 4.5rem;
  align-content: space-between;
  gap: 0.5rem;
  border: 1px solid var(--checklist-line);
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.72);
  padding: 0.625rem;
}

.store-checklist-result-overview .store-checklists-fact span {
  display: inline-flex;
  min-height: 1.125rem;
  align-items: center;
  line-height: 1.15;
}
```

- [ ] **Step 4: Add status legend**

```css
.store-checklist-result-status-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgba(19, 167, 179, 0.16);
  border-radius: 0.8rem;
  background: rgba(237, 247, 246, 0.62);
  padding: 0.55rem;
}

.store-checklist-result-status-legend strong,
.store-checklist-result-status-legend span {
  display: inline-flex;
  align-items: center;
  gap: 0.36rem;
  min-height: 1.55rem;
  color: var(--checklist-muted);
  font-size: 0.74rem;
  font-weight: 820;
}

.store-checklist-result-status-legend strong {
  color: var(--surface-ink, var(--checklist-ink));
}

.store-checklist-result-legend-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
}

.store-checklist-result-legend-dot-danger { background: var(--checklist-danger); }
.store-checklist-result-legend-dot-warning { background: var(--checklist-amber); }
.store-checklist-result-legend-dot-success { background: var(--checklist-mint); }
```

- [ ] **Step 5: Make section heads cyan-highlighted**

```css
.store-checklist-result-section-head {
  border-bottom: 1px solid rgba(19, 167, 179, 0.16);
  background:
    radial-gradient(circle at 100% 0, rgba(19, 167, 179, 0.16), transparent 44%),
    linear-gradient(90deg, rgba(237, 247, 246, 0.92), rgba(255, 255, 255, 0.74));
}

.store-checklist-result-section-head strong {
  color: var(--surface-ink, var(--checklist-ink));
}
```

- [ ] **Step 6: Add item tone rows and badges**

```css
.store-checklist-result-item {
  position: relative;
  overflow: hidden;
  border-top: 1px solid var(--checklist-soft-line);
}

.store-checklist-result-item::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 0.22rem;
}

.store-checklist-result-item-danger {
  background: rgba(255, 241, 242, 0.72);
}

.store-checklist-result-item-warning {
  background: rgba(255, 247, 237, 0.72);
}

.store-checklist-result-item-success {
  background: rgba(236, 253, 245, 0.7);
}

.store-checklist-result-item-neutral {
  background: rgba(248, 250, 252, 0.74);
}

.store-checklist-result-item-danger::before { background: var(--checklist-danger); }
.store-checklist-result-item-warning::before { background: var(--checklist-amber); }
.store-checklist-result-item-success::before { background: var(--checklist-mint); }
.store-checklist-result-item-neutral::before { background: rgba(108, 100, 120, 0.32); }

.store-checklist-result-item-title-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.store-checklist-result-item-status {
  display: inline-flex;
  min-height: 1.5rem;
  align-items: center;
  border-radius: 999px;
  padding: 0 0.55rem;
  font-size: 0.72rem;
  font-weight: 840;
}

.store-checklist-result-item-status-danger {
  border: 1px solid rgba(225, 29, 72, 0.22);
  background: rgba(225, 29, 72, 0.1);
  color: #be123c;
}

.store-checklist-result-item-status-warning {
  border: 1px solid rgba(245, 158, 11, 0.24);
  background: rgba(245, 158, 11, 0.12);
  color: #a16207;
}

.store-checklist-result-item-status-success {
  border: 1px solid rgba(16, 185, 129, 0.22);
  background: rgba(16, 185, 129, 0.11);
  color: #047857;
}

.store-checklist-result-item-status-neutral {
  border: 1px solid rgba(108, 100, 120, 0.18);
  background: rgba(108, 100, 120, 0.08);
  color: var(--checklist-muted);
}
```

- [ ] **Step 7: Check responsive rules**

Keep these breakpoints:

- `max-width: 980px`: overview and body become one column; action card stops sticky.
- `max-width: 640px`: modal width is nearly full viewport; summary grid one column; section head and item rows one column.

Add mobile score override:

```css
@media (max-width: 640px) {
  .store-checklist-result-score-card {
    min-height: 9.75rem;
  }

  .store-checklist-result-score-ring {
    width: 7.75rem;
    height: 7.75rem;
  }
}
```

---

### Task 6: Verification And Evidence

**Files:**

- Optional create: `docs/evidence/store-checklist-result-modal-prototype-implementation-v1-2026-06-13.md`

- [ ] **Step 1: Static diff hygiene**

Run:

```powershell
git diff --check
```

Expected: no trailing whitespace or conflict marker output.

- [ ] **Step 2: Lint**

Run:

```powershell
npm.cmd --prefix admin-web run lint
```

Expected: command exits `0`.

- [ ] **Step 3: Build**

Run:

```powershell
npm.cmd --prefix admin-web run build
```

Expected: command exits `0`.

- [ ] **Step 4: Focused Playwright**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts --grep "acknowledgement language|result modal stays usable"
```

Expected: targeted checklist result modal scenarios pass.

- [ ] **Step 5: Remediation semantic regression guard**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts --grep "checklist remediation"
```

Expected: checklist remediation rows still read as informational/source-linked work; no test requires `Takip` to generate tasks.

- [ ] **Step 6: Browser visual QA**

Open `/store/checklists?tab=inbox&result=44444444-4444-4444-8444-444444444444` with mocked/local e2e harness or local dev app and check:

- Desktop `1366x900`: no horizontal overflow, removed bands absent, score centered, legend visible, rows use danger/warning/success tones.
- Mobile `390x844`: no horizontal overflow, modal scroll works, score card remains centered, action card controls remain reachable.

If visual evidence is recorded, write the evidence file only after the commands and viewport checks complete. The evidence must contain the actual command outcomes and the actual viewport observations:

```md
# Store Checklist Result Modal Prototype Implementation V1 Evidence

- Date: 2026-06-13
- Scope: Checklist result modal prototype parity
- Prototype: docs/prototypes/store-checklist-result-modal-v1.html
- Production surface: /store/checklists result modal
- Commands:
  - git diff --check
  - npm.cmd --prefix admin-web run lint
  - npm.cmd --prefix admin-web run build
  - npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts --grep "acknowledgement language|result modal stays usable"
  - npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts --grep "checklist remediation"
- Visual QA:
  - Desktop 1366x900: modal opened, no horizontal overflow, score center delta value, removed bands absent, legend visible, row tones visible
  - Mobile 390x844: modal opened, no horizontal overflow, score card centered, action controls reachable
- Unchanged:
  - API shape
  - DB schema
  - Auth and permission semantics
  - Checklist scoring
  - Acknowledgement mutation payload
  - Remediation/task generation
```

---

## Acceptance Criteria

- Production modal materially matches approved prototype structure and density.
- `Kontrol listesi sonucu`, `Kontrol listesi kırılımı`, `Renk anlamı`, `Düşük`, `Takip`, `İyi` appear correctly in Turkish.
- `Sonuç özeti` and `Dikkat isteyen maddeler` bands are absent from the modal body.
- Score ring content is visually centered on desktop and mobile.
- Summary grid uses real acknowledgement item data only.
- Section headers use cyan/glacier emphasis without introducing a new palette.
- Item rows clearly show low/follow/good visual tones.
- Acknowledgement note, cancel, acknowledge, acknowledged-history and review-only behavior is unchanged.
- `Takip` label does not create or imply a backend task.
- Focused e2e, lint, build and diff hygiene pass.

## Stop Conditions

- Stop if implementing exact `Düşük` badge semantics requires backend non-compliance data not present on `/checklists/acknowledgements/list`.
- Stop if a requested copy change would make user-facing text mention internal API, DB, OpenAPI, queue, provider, mock or staging language.
- Stop if visual parity requires changing Lufian/header shell, route guard, toolbar, auth, permission or checklist workflow behavior.
- Stop if the acknowledgement mutation payload changes in e2e.

## Rollback

Revert only this PR's changes in:

- `admin-web/src/pages/store-checklists-result-modal.tsx`
- `admin-web/src/styles/store-checklists-result-modal.css`
- `admin-web/src/pages/store-checklists-logic.ts`
- `admin-web/src/features/localization/messages/store-checklists.ts`
- `admin-web/e2e/checklist-today-surfaces.spec.ts`

Rollback should restore the previous modal UI without touching checklist backend data, acknowledgement records or action plans.
