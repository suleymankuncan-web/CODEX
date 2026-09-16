/// <reference types="node" />
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PDFDocument, PDFPage } from 'pdf-lib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChecklistAcknowledgementItem } from '../features/checklists/api'
import { createChecklistResultPdf } from './store-checklists-result-pdf'
import { getChecklistResultAnswerLabel } from './store-checklists-result-presentation'
import { groupChecklistResultResponses } from './store-checklists-logic'

const item: ChecklistAcknowledgementItem = {
  checklistInstanceId: '44444444-4444-4444-8444-444444444444', checklistTemplateId: 'original-version',
  templateName: 'Bölge Müdürü Mağaza Denetimi', templateType: 'BM_STORE_VISIT', category: 'BM',
  storeId: 'store-1', storeName: 'İstinyePark Mağazası', completedByUserId: 'auditor-1', completedByDisplayName: 'Özgür Şahin',
  completedAt: '2026-09-16T09:15:00.000Z', status: 'completed', totalScore: 75, complianceRate: 0.75,
  signatories: { regionManagerNames: ['Özgür Şahin'], storeManagerNames: ['Çağrı Işık'] }, acknowledgement: null,
  responses: [
    { templateItemId: 'r2', sectionName: 'Alan düzeni', itemNo: 2, itemText: 'Etiketler güncel mi?', responseType: 'compliance', weight: 50, maxScore: 2, scoreValue: 1, responseValue: 'partially_compliant', commentText: 'İndirim etiketleri güncellenecek.\nKasa girişindeki ürünler kontrol edildi.' },
    { templateItemId: 'r1', sectionName: 'Ziyaret hazırlığı', itemNo: 1, itemText: 'Ekip görev dağılımını biliyor mu?', responseType: 'compliance', weight: 50, maxScore: 2, scoreValue: 2, responseValue: 'compliant', commentText: 'Çalışanlarla açılış toplantısı yapıldı.' },
  ],
}
const fontBytes = new Uint8Array(readFileSync(resolve(process.cwd(), 'src/assets/pdf/dm-sans.ttf')))
const exportedAt = new Date('2026-09-16T11:00:00Z')
afterEach(() => vi.restoreAllMocks())

describe('checklist result record', () => {
  it('uses the instance item order and weights without mutating historical results', async () => {
    const before = JSON.stringify(item)
    const sections = groupChecklistResultResponses(item.responses)
    expect(sections.map((section) => section.name)).toEqual(['Ziyaret hazırlığı', 'Alan düzeni'])
    expect(sections.map((section) => section.earnedPoints)).toEqual([50, 25])
    const drawn = vi.spyOn(PDFPage.prototype, 'drawText')
    const bytes = await createChecklistResultPdf({ item, fontBytes, locale: 'tr', exportedAt })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
    const text = drawn.mock.calls.map(([value]) => value).join('\n')
    expect(drawn.mock.calls[0]?.[0]).toBe('LUFIAN')
    expect(text).not.toContain('belge tarihindeki mağaza atamasına göre')
    expect(text).not.toContain('Mağaza müdürü adı elle doldurulur.')
    expect(text).toContain('Çalışanlarla açılış toplantısı yapıldı.')
    expect(text).toContain('İndirim etiketleri güncellenecek.')
    expect(text).not.toContain('Çağrı Işık')
    expect(text).toContain('Ad soyad:')
    expect(text).toContain('Özgür Şahin')
    expect(text).toContain('16 Eylül 2026')
    expect(text).toContain('75')
    expect(text.indexOf('Ziyaret hazırlığı')).toBeLessThan(text.indexOf('Alan düzeni'))
    expect(JSON.stringify(item)).toBe(before)
    if (process.env.CHECKLIST_PDF_PROOF_PATH) writeFileSync(process.env.CHECKLIST_PDF_PROOF_PATH, bytes)
  })

  it('paginates long comments without clipping and places signatures after the last item', async () => {
    const longItem = structuredClone(item)
    longItem.responses[0]!.commentText = `${'Uzun gözlem notu: Türkçe karakterler ğüşiöç korunur. '.repeat(140)}\nSON YORUM`
    longItem.responses.push({ ...longItem.responses[0]!, templateItemId: 'na', itemNo: 3, responseValue: 'not_applicable', scoreValue: null, commentText: 'Kapsam dışı açıklaması' })
    const drawn = vi.spyOn(PDFPage.prototype, 'drawText')
    const bytes = await createChecklistResultPdf({ item: longItem, fontBytes, locale: 'tr', exportedAt })
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBeGreaterThan(2)
    const text = drawn.mock.calls.map(([value]) => value).join('\n')
    expect(text).toContain('SON YORUM')
    expect(text).toContain('N/A')
    expect(text).toContain('Puan dışı')
    expect(text).not.toContain('Çağrı Işık')
    expect(text.indexOf('Ad soyad:')).toBeGreaterThan(text.indexOf('Kapsam dışı açıklaması'))
    for (const [value, options] of drawn.mock.calls) {
      expect(options?.y, value).toBeGreaterThanOrEqual(15)
      expect(options?.y, value).toBeLessThan(821)
      expect((options?.x ?? 0) + (options?.font?.widthOfTextAtSize(value, options.size ?? 10) ?? 0), value).toBeLessThan(565)
    }
    if (process.env.CHECKLIST_PDF_PROOF_PATH) writeFileSync(process.env.CHECKLIST_PDF_PROOF_PATH.replace('.pdf', '-long.pdf'), bytes)
  })

  it('distinguishes written and excluded answers from unanswered items', () => {
    expect(getChecklistResultAnswerLabel('tr', { ...item.responses[0]!, scoreValue: null, responseValue: 'not_applicable' })).toBe('N/A')
    expect(getChecklistResultAnswerLabel('tr', { ...item.responses[0]!, scoreValue: null, responseValue: null })).toBe('Yanıt yok')
    expect(getChecklistResultAnswerLabel('tr', { ...item.responses[0]!, scoreValue: null, responseType: 'text', commentText: 'Gözlem' })).toBe('Gözlem')
  })
})
