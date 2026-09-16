import { PDFDocument, rgb, type PDFFont, type RGB } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { ChecklistAcknowledgementItem } from '../features/checklists/api'
import type { AppLocale } from '../lib/i18n'
import { formatNumber } from '../lib/format'
import { getStaticCopy, getWeightedResponsePoints, groupChecklistResultResponses } from './store-checklists-logic'
import { getChecklistResultAnswerLabel, getChecklistResultItemTone } from './store-checklists-result-presentation'

const width = 595.28
const height = 841.89
const margin = 32
const contentWidth = width - margin * 2
const bottom = height - 48
const colors = {
  ink: rgb(0.078, 0.161, 0.212), muted: rgb(0.39, 0.46, 0.50),
  hero: rgb(0.09, 0.21, 0.29), soft: rgb(0.95, 0.97, 0.97),
  line: rgb(0.81, 0.86, 0.86), white: rgb(1, 1, 1),
  success: rgb(0.08, 0.57, 0.49), danger: rgb(0.78, 0.29, 0.34),
  warning: rgb(0.73, 0.46, 0.12), neutral: rgb(0.39, 0.46, 0.50),
}

// Measure real glyph widths; also split unbroken URLs and preserve comment paragraphs.
export function wrapPdfText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n').flatMap((paragraph) => {
    const lines: string[] = []
    let line = ''
    for (const word of paragraph.replace(/\p{Cc}/gu, ' ').split(/\s+/u)) {
      if (line && font.widthOfTextAtSize(`${line} ${word}`, size) <= maxWidth) { line += ` ${word}`; continue }
      if (line) { lines.push(line); line = '' }
      for (const character of word) {
        if (line && font.widthOfTextAtSize(line + character, size) > maxWidth) { lines.push(line); line = '' }
        line += character
      }
    }
    lines.push(line)
    return lines
  })
}

export async function createChecklistResultPdf(input: {
  item: ChecklistAcknowledgementItem
  fontBytes: Uint8Array
  locale: AppLocale
  exportedAt: Date
}) {
  const { item, locale } = input
  const copy = (tr: string, en: string) => getStaticCopy(locale, tr, en)
  const number = (value: number) => formatNumber(value, locale, { maximumFractionDigits: 2 })
  const date = (value: string | Date | null) => value && Number.isFinite(new Date(value).getTime())
    ? new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(value))
    : copy('Tarih kaydı yok', 'Date unavailable')
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const font = await document.embedFont(input.fontBytes, { subset: true })
  document.setTitle(`LUFIAN · ${item.storeName} · ${item.templateName}`)
  document.setCreator('HR Axis')
  document.setLanguage(locale === 'tr' ? 'tr-TR' : 'en-GB')
  document.setCreationDate(input.exportedAt)
  let page = document.addPage([width, height])
  let y = margin
  const lines = (text: string, maxWidth: number, size = 10) => wrapPdfText(text, font, size, maxWidth)
  function text(value: string, x: number, top: number, size = 10, color: RGB = colors.ink) {
    page.drawText(value, { x, y: height - top - size, size, font, color })
  }
  function rect(x: number, top: number, w: number, h: number, color: RGB, border = false) {
    page.drawRectangle({ x, y: height - top - h, width: w, height: h, color, borderWidth: border ? 0.6 : 0, ...(border ? { borderColor: colors.line } : {}) })
  }
  function newPage() {
    page = document.addPage([width, height])
    text('LUFIAN', margin, 22, 9, colors.muted)
    y = 44
  }
  function ensure(space: number) { if (y + space > bottom) newPage() }
  function paragraph(value: string, size = 10, color: RGB = colors.ink) {
    for (const line of lines(value, contentWidth - 24, size)) {
      ensure(size + 5)
      text(line, margin + 12, y, size, color)
      y += size + 5
    }
  }

  text('LUFIAN', margin, y, 22)
  y += 38
  const title = lines(item.templateName, contentWidth - 32, 19)
  const titleHeight = 62 + title.length * 24
  const storeLines = lines(item.storeName, 190, 12)
  const actorLines = lines(item.completedByDisplayName?.trim() || copy('İsim kaydı yok', 'Name unavailable'), 190, 12)
  const summaryHeight = Math.max(98, 44 + Math.max(storeLines.length, actorLines.length) * 16)
  const heroHeight = titleHeight + summaryHeight
  for (let step = 0; step < 120; step += 1) {
    const ratio = step / 119
    rect(margin + step * contentWidth / 120, y, contentWidth / 120 + (step === 119 ? 0 : 1), heroHeight,
      rgb(0.28 - 0.20 * ratio, 0.15 + 0.35 * ratio, 0.44 + 0.06 * ratio))
  }
  text(copy('KONTROL LİSTESİ SONUCU', 'CHECKLIST RESULT'), margin + 16, y + 13, 9, colors.white)
  title.forEach((line, index) => text(line, margin + 16, y + 31 + index * 24, 19, colors.white))
  text(date(item.completedAt), margin + 16, y + titleHeight - 22, 9, colors.white)
  y += titleHeight
  page.drawLine({ start: { x: margin + 16, y: height - y }, end: { x: width - margin - 16, y: height - y }, thickness: 0.4, color: colors.line, opacity: 0.4 })
  const score = item.totalScore ?? (item.complianceRate === null ? null : item.complianceRate * 100)
  const scoreLabel = score === null ? '—' : number(score)
  page.drawCircle({ x: margin + 50, y: height - y - summaryHeight / 2, size: 34, color: colors.hero, borderColor: rgb(0.70, 0.83, 0.94), borderWidth: 5 })
  const scoreSize = scoreLabel.length > 5 ? 16 : 23
  text(scoreLabel, margin + 50 - font.widthOfTextAtSize(scoreLabel, scoreSize) / 2, y + summaryHeight / 2 - 21, scoreSize, colors.white)
  const scoreCaption = copy('Puan', 'Score')
  text(scoreCaption, margin + 50 - font.widthOfTextAtSize(scoreCaption, 9) / 2, y + summaryHeight / 2 + 10, 9, colors.white)
  const facts = [[copy('Mağaza', 'Store'), storeLines], [copy('Denetimi tamamlayan', 'Completed by'), actorLines]] as const
  for (const [index, [label, values]] of facts.entries()) {
    const factX = margin + 108 + index * 213
    const factY = y + summaryHeight / 2 - 22
    text(label, factX, factY, 8, colors.line)
    values.forEach((line, lineIndex) => text(line, factX, factY + 15 + lineIndex * 16, 12, colors.white))
  }
  y += summaryHeight + 18

  const sections = groupChecklistResultResponses(item.responses)
  let ordinal = 0
  for (const section of sections) {
    const sectionTitle = lines(section.name || copy('Bölüm', 'Section'), contentWidth - 122, 11)
    const sectionHeight = sectionTitle.length * 14 + 29
    const sectionHeader = (continued = false) => {
      rect(margin, y, contentWidth, sectionHeight, rgb(0.91, 0.97, 0.98), true)
      sectionTitle.forEach((line, index) => text(line, margin + 12, y + 9 + index * 14, 11))
      text(`${section.items.length} ${copy('madde', 'items')}${continued ? copy(' · devam', ' · continued') : ''}`, margin + 12, y + sectionHeight - 16, 8, colors.muted)
      text(`${number(section.earnedPoints)} / ${number(section.maxPoints)}`, width - margin - 95, y + 10, 12)
      text(copy('Puan', 'Points'), width - margin - 95, y + 27, 8, colors.muted)
      y += sectionHeight
    }
    ensure(sectionHeight + 60)
    sectionHeader()
    for (const response of section.items) {
      ordinal += 1
      const points = getWeightedResponsePoints(response)
      const scoreValue = response.responseValue === 'not_applicable' ? copy('Puan dışı', 'Excluded') : points === null ? '—' : `${number(points.earnedPoints)}/${number(points.maxPoints)}`
      const isText = response.responseType.trim().toLowerCase() === 'text'
      const answer = isText ? copy('Yazılı yanıt', 'Text response') : getChecklistResultAnswerLabel(locale, response)
      const body = lines(response.itemText, 310).map((value) => ({ value, comment: false }))
      if (response.commentText?.trim()) {
        body.push({ value: copy('Yorum', 'Comment'), comment: true })
        body.push(...lines(response.commentText, 310).map((value) => ({ value, comment: true })))
      }
      const answers = lines(answer, 83, 9)
      const scores = lines(scoreValue, 63, 9)
      const totalLines = Math.max(body.length, answers.length + 1, scores.length + 1)
      const rowHeight = totalLines * 14 + 20
      if (y + rowHeight > bottom && rowHeight < bottom - 44 - sectionHeight) { newPage(); sectionHeader(true) }
      let offset = 0
      while (offset < totalLines) {
        if (bottom - y < 48) { newPage(); sectionHeader(true) }
        const count = Math.min(totalLines - offset, Math.floor((bottom - y - 20) / 14))
        const blockHeight = count * 14 + 20
        rect(margin, y, contentWidth, blockHeight, colors.white, true)
        rect(margin, y, 2.5, blockHeight, colors[getChecklistResultItemTone(response)])
        text(String(response.itemNo || ordinal).padStart(2, '0'), margin + 8, y + 10, 8, colors.muted)
        for (let index = 0; index < count; index += 1) {
          const row = offset + index
          const lineY = y + 10 + index * 14
          if (body[row]) text(body[row].value, margin + 30, lineY, 10, body[row].comment ? colors.muted : colors.ink)
          if (row === 0) {
            text(copy('Cevap', 'Answer'), margin + 350, lineY, 8, colors.muted)
            text(copy('Puan', 'Score'), margin + 446, lineY, 8, colors.muted)
          } else {
            const answerLine = answers[row - 1]
            const scoreLine = scores[row - 1]
            if (answerLine) text(answerLine, margin + 350, lineY, 9)
            if (scoreLine) text(scoreLine, margin + 446, lineY, 9)
          }
        }
        y += blockHeight
        offset += count
      }
    }
    y += 14
  }

  if (item.acknowledgement) {
    ensure(60)
    paragraph(copy('Mağaza inceleme kaydı', 'Store acknowledgement'), 11)
    paragraph(date(item.acknowledgement.acknowledgedAt), 9, colors.muted)
    if (item.acknowledgement.acknowledgementNote) paragraph(item.acknowledgement.acknowledgementNote)
    y += 14
  }
  const statement = copy(
    `Bu belge, ${date(item.completedAt)} tarihinde yapılan denetimin sonuçlarını ve madde yorumlarını kayıt altına almak amacıyla düzenlenmiştir. Aşağıdaki imzalar, sonuçların ilgili yöneticiler tarafından incelendiğini ve teslim alındığını gösterir.`,
    `This document records the results and item comments of the inspection completed on ${date(item.completedAt)}. The signatures below confirm that the relevant managers have reviewed and received these results.`,
  )
  const regionNames = item.signatories?.regionManagerNames ?? []
  const signatureLines = [lines(regionNames.length ? regionNames.join(', ') : copy('İsim kaydı yok', 'Name unavailable'), contentWidth / 2 - 36, 11), []]
  const signatureHeight = Math.max(...signatureLines.map((value) => value.length)) * 15 + 108
  ensure(lines(statement, contentWidth - 24).length * 15 + 50 + Math.min(signatureHeight, 220))
  paragraph(copy('Kayıt ve imza', 'Record and signatures'), 13)
  y += 5
  paragraph(statement, 10, colors.muted)
  y += 8
  paragraph(`${copy('Belge tarihi', 'Document date')}: ${date(input.exportedAt)}`, 9, colors.muted)
  y += 14
  ensure(signatureHeight)
  for (let index = 0; index < 2; index += 1) {
    const x = margin + index * (contentWidth / 2 + 6)
    rect(x, y, contentWidth / 2 - 6, signatureHeight, colors.white, true)
    text(index === 0 ? copy('Bölge Müdürü', 'Regional Manager') : copy('Mağaza Müdürü', 'Store Manager'), x + 12, y + 12, 9, colors.muted)
    signatureLines[index]?.forEach((line, lineIndex) => text(line, x + 12, y + 30 + lineIndex * 15, 11))
    if (index === 1) text(copy('Ad soyad: ..................................', 'Full name: ..................................'), x + 12, y + 30, 10, colors.muted)
    text(copy('İmza: ........................................', 'Signature: ..................................'), x + 12, y + signatureHeight - 47, 9, colors.muted)
    text(copy('Tarih: ........ / ........ / ................', 'Date: ........ / ........ / ................'), x + 12, y + signatureHeight - 25, 9, colors.muted)
  }
  document.getPages().forEach((current, index) => {
    page = current
    text(`HR AXIS · ${item.checklistInstanceId}`, margin, height - 28, 7, colors.muted)
    text(`${index + 1} / ${document.getPageCount()}`, width - margin - 36, height - 28, 8, colors.muted)
  })
  return document.save()
}
