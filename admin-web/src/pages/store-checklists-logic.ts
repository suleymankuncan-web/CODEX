import type { AuthSessionSummary } from '../features/auth/api'
import { hasAnyRole } from '../features/auth/authorization'
import type { ChecklistAcknowledgementItem, MobileChecklistToday } from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { formatDateTime, formatNumber, formatState } from '../lib/format'
import { getIntlLocale, type AppLocale } from '../lib/i18n'
import type {
  ChecklistCoverageRow,
  ChecklistResponseDraft,
  ChecklistSession,
  ChecklistSort,
  ChecklistSortKey,
  ChecklistStatusFilter,
  ChecklistStoreVisitRow,
  ChecklistTone,
  ChecklistTypeFilter,
} from './store-checklists-model'

const checklistMonthFormatters: Record<AppLocale, Intl.DateTimeFormat> = {
  tr: new Intl.DateTimeFormat(getIntlLocale('tr'), {
    month: 'long',
    year: 'numeric',
  }),
  en: new Intl.DateTimeFormat(getIntlLocale('en'), {
    month: 'long',
    year: 'numeric',
  }),
}

export function groupChecklistTemplateItems(items: MobileChecklistToday['templates'][number]['items']) {
  const sections = new Map<
    string,
    { name: string; items: MobileChecklistToday['templates'][number]['items'] }
  >()

  for (const item of items) {
    const section = sections.get(item.sectionName) ?? { name: item.sectionName, items: [] }
    section.items.push(item)
    sections.set(item.sectionName, section)
  }

  return [...sections.values()]
}

export function groupChecklistResultResponses(items: ChecklistAcknowledgementItem['responses']) {
  const sections = new Map<
    string,
    { name: string; items: ChecklistAcknowledgementItem['responses']; averageScore: number }
  >()

  for (const item of items) {
    const section = sections.get(item.sectionName) ?? {
      name: item.sectionName,
      items: [],
      averageScore: 0,
    }
    section.items.push(item)
    sections.set(item.sectionName, section)
  }

  const groupedSections: Array<{
    name: string
    items: ChecklistAcknowledgementItem['responses']
    averageScore: number
  }> = []

  for (const section of sections.values()) {
    let ratioTotal = 0
    let ratioCount = 0

    for (const item of section.items) {
      const ratio = getResponseRatio(item)
      if (ratio === null) continue
      ratioTotal += ratio
      ratioCount += 1
    }

    groupedSections.push({
      ...section,
      averageScore: ratioCount > 0 ? Math.round(ratioTotal / ratioCount) : 0,
    })
  }

  return groupedSections
}

export function getLowScoreResponses(items: ChecklistAcknowledgementItem['responses']) {
  return items.filter((item) => {
    const ratio = getResponseRatio(item)
    return ratio !== null && ratio < 70
  })
}

export function getResponseRatio(item: ChecklistAcknowledgementItem['responses'][number]) {
  if (item.scoreValue === null || item.maxScore <= 0) return null
  return Math.round((item.scoreValue / item.maxScore) * 100)
}

export function getCoverageRowKey(storeId: string, checklistTemplateId: string) {
  return `${storeId}:${checklistTemplateId}`
}

export function getCoverageRowKeyFromRow(row: ChecklistCoverageRow) {
  return getCoverageRowKey(row.store.storeId, row.template.checklistTemplateId)
}

export function getStoreVisitRowKey(row: ChecklistStoreVisitRow) {
  return `${row.store.storeId}:${row.bm?.template.checklistTemplateId ?? 'bm'}:${row.vm?.template.checklistTemplateId ?? 'vm'}`
}

export function buildChecklistStoreVisitRows(rows: ChecklistCoverageRow[]) {
  const grouped = new Map<string, ChecklistStoreVisitRow>()

  for (const row of rows) {
    const current = grouped.get(row.store.storeId) ?? {
      store: row.store,
      bm: undefined,
      vm: undefined,
      primary: row,
    }
    const next = { ...current }

    if (row.template.templateType === 'VM_STORE_VISIT') {
      next.vm = row
    } else {
      next.bm = row
    }

    next.primary = chooseStoreVisitPrimary(next)
    grouped.set(row.store.storeId, next)
  }

  return [...grouped.values()]
}

export function chooseStoreVisitPrimary(row: Omit<ChecklistStoreVisitRow, 'primary'> & { primary?: ChecklistCoverageRow }) {
  const primary = row.bm?.active ? row.bm : row.vm?.active ? row.vm : row.bm ?? row.vm ?? row.primary
  if (!primary) {
    throw new Error('Checklist store visit row requires at least one checklist row')
  }
  return primary
}

export function getActionableStoreVisitRow(row: ChecklistStoreVisitRow, authSummary: AuthSessionSummary | null) {
  const rows = [row.bm, row.vm].filter((item): item is ChecklistCoverageRow => Boolean(item))
  return rows.find((item) => canMutateChecklistTemplateType(authSummary, item.template.templateType)) ?? null
}

export function canMutateChecklistTemplateType(authSummary: AuthSessionSummary | null, templateType: string) {
  if (hasAnyRole(authSummary, ['SUPER_ADMIN'])) return true
  if (templateType === 'BM_STORE_VISIT') return hasAnyRole(authSummary, ['REGION_MANAGER'])
  if (templateType === 'VM_STORE_VISIT') return hasAnyRole(authSummary, ['VISUAL_MERCHANDISER'])
  return false
}

export function getLocalizedTemplateScoreStatus(
  t: TranslateFunction,
  locale: AppLocale,
  label: string,
  row: ChecklistCoverageRow,
) {
  if (row.active) return `${label} ${lowercaseChecklistCopy(t('storeChecklists.coverage.draft'), locale)}`
  if (row.completedCount > 0) {
    return `${label} ${lowercaseChecklistCopy(t('storeChecklists.status.completed'), locale)}`
  }
  return `${label} ${lowercaseChecklistCopy(t('storeChecklists.noVisit'), locale)}`
}

export function lowercaseChecklistCopy(value: string, locale: AppLocale) {
  return value.toLocaleLowerCase(locale === 'en' ? 'en-US' : 'tr-TR')
}

export function getStoreVisitSummary(
  t: TranslateFunction,
  locale: AppLocale,
  row: ChecklistStoreVisitRow,
  requiresCombinedTemplates: boolean,
) {
  if (!requiresCombinedTemplates) {
    const visibleRows = [row.bm, row.vm].filter((item): item is ChecklistCoverageRow => Boolean(item))
    return visibleRows.length > 0
      ? visibleRows.map((item) => formatChecklistCoverage(t, item)).join(' / ')
      : getStaticCopy(locale, 'Checklist yapılmadı', 'Checklist not done')
  }

  const bm = row.bm ? formatChecklistCoverage(t, row.bm) : getStaticCopy(locale, 'BM yapılmadı', 'BM not done')
  const vm = row.vm ? formatChecklistCoverage(t, row.vm) : getStaticCopy(locale, 'VM yapılmadı', 'VM not done')
  return `${bm} / ${vm}`
}

export function getStoreVisitDate(row: ChecklistStoreVisitRow) {
  const bmDate = row.bm && row.bm.completedCount > 0 ? row.bm.completedAt : null
  const vmDate = row.vm && row.vm.completedCount > 0 ? row.vm.completedAt : null

  if (!bmDate) return vmDate
  if (!vmDate) return bmDate
  return compareDate(bmDate, vmDate) >= 0 ? bmDate : vmDate
}

export function getStoreVisitPriority(row: ChecklistStoreVisitRow) {
  return Math.max(row.bm ? getCoveragePriority(row.bm) : 0, row.vm ? getCoveragePriority(row.vm) : 0)
}

export function isIncompleteStoreVisitRow(row: ChecklistStoreVisitRow, requiresCombinedVisitTemplates: boolean) {
  const visibleRows = [row.bm, row.vm].filter(Boolean)
  if (visibleRows.length === 0) return true
  if (requiresCombinedVisitTemplates) {
    return visibleRows.some((item) => (item?.completedCount ?? 0) === 0)
  }
  return visibleRows.every((item) => (item?.completedCount ?? 0) === 0)
}

export function getStoreVisitScore(row: ChecklistStoreVisitRow) {
  const bmScore = row.bm ? getCoverageScore(row.bm) : null
  const vmScore = row.vm ? getCoverageScore(row.vm) : null

  if (bmScore === null) return vmScore
  if (vmScore === null) return bmScore
  return Math.min(bmScore, vmScore)
}

export function getStoreVisitRiskTone(row: ChecklistStoreVisitRow, requiresCombinedTemplates: boolean): ChecklistTone {
  if (row.bm?.active || row.vm?.active) return 'warning'
  if (requiresCombinedTemplates && (!row.bm || !row.vm)) return 'danger'
  if (!row.bm && !row.vm) return 'danger'
  const score = getStoreVisitScore(row)
  if (score !== null && score < 70) return 'danger'
  return 'calm'
}

export function getStoreVisitRiskLabel(
  t: TranslateFunction,
  locale: AppLocale,
  row: ChecklistStoreVisitRow,
  requiresCombinedTemplates: boolean,
) {
  if (row.bm?.active || row.vm?.active) return t('storeChecklists.coverage.draft')
  if (requiresCombinedTemplates && (!row.bm || !row.vm)) return getStaticCopy(locale, 'Riskli', 'Risk')
  if (!row.bm && !row.vm) return getStaticCopy(locale, 'Riskli', 'Risk')
  const score = getStoreVisitScore(row)
  if (score !== null && score < 70) return getStaticCopy(locale, 'Düşük puan', 'Low score')
  return getStaticCopy(locale, 'Temiz', 'Clear')
}

export function getChecklistTypeFilterOptions(
  authSummary: AuthSessionSummary | null,
  locale: AppLocale,
  t: TranslateFunction,
): Array<{ value: ChecklistTypeFilter; label: string }> {
  if (isVisualMerchandiserOnly(authSummary)) {
    return [{ value: 'VM_STORE_VISIT', label: getStaticCopy(locale, 'VM', 'VM') }]
  }

  return [
    { value: 'all', label: getStaticCopy(locale, 'BM + VM', 'BM + VM') },
    { value: 'BM_STORE_VISIT', label: t('storeChecklists.coverage.bm') },
    { value: 'VM_STORE_VISIT', label: t('storeChecklists.coverage.vm') },
  ]
}

export function isVisualMerchandiserOnly(authSummary: AuthSessionSummary | null) {
  return (
    hasAnyRole(authSummary, ['VISUAL_MERCHANDISER']) &&
    !hasAnyRole(authSummary, [
      'HR_ADMIN',
      'REGION_MANAGER',
      'STORE_MANAGER',
      'STORE_PERSONNEL',
      'SUPER_ADMIN',
    ])
  )
}

export function getChecklistHeroScopeLabel(
  authSummary: AuthSessionSummary | null,
  locale: AppLocale,
  canManageVisits: boolean,
) {
  if (!canManageVisits) {
    return getStaticCopy(locale, 'Mağaza kabul kayıtları', 'Store acknowledgements')
  }
  if (hasAnyRole(authSummary, ['REGION_MANAGER'])) {
    return getStaticCopy(locale, 'Bölge müdürü', 'Region manager')
  }
  if (hasAnyRole(authSummary, ['VISUAL_MERCHANDISER'])) {
    return getStaticCopy(locale, 'VM mağazaları', 'VM stores')
  }
  return getStaticCopy(locale, 'Operasyon mağazaları', 'Operations stores')
}

export function formatChecklistCoverage(t: TranslateFunction, input: ChecklistCoverageRow) {
  const prefix =
    input.template.templateType === 'VM_STORE_VISIT'
      ? t('storeChecklists.coverage.vm')
      : t('storeChecklists.coverage.bm')

  if (input.active) return t('storeChecklists.coverage.draft')
  if (input.completedCount > 1) {
    return t('storeChecklists.coverage.manyCompleted', {
      count: input.completedCount,
      prefix,
    })
  }
  if (input.completedCount === 1) {
    return t('storeChecklists.coverage.singleCompleted', { prefix })
  }
  return t('storeChecklists.coverage.none', { prefix })
}

export function formatChecklistStatus(t: TranslateFunction, status: string) {
  switch (status) {
    case 'in_progress':
      return t('storeChecklists.status.in_progress')
    case 'completed':
      return t('storeChecklists.status.completed')
    case 'draft':
      return t('storeChecklists.status.draft')
    default:
      return formatState(status)
  }
}

export function formatChecklistTemplateType(t: TranslateFunction, templateType: string) {
  switch (templateType) {
    case 'BM_STORE_VISIT':
      return t('storeChecklists.coverage.bm')
    case 'VM_STORE_VISIT':
      return t('storeChecklists.coverage.vm')
    default:
      return formatState(templateType)
  }
}

export function formatScoreValue(t: TranslateFunction, value: number | null) {
  return value === null ? t('storeChecklists.noScore') : formatNumber(value, 'tr')
}

export function formatComplianceValue(t: TranslateFunction, value: number | null) {
  return value === null ? t('storeChecklists.noRate') : `${Math.round(value * 100)}%`
}

export function getChecklistResultDigest(
  t: TranslateFunction,
  locale: AppLocale,
  item: ChecklistAcknowledgementItem,
): { copy: string; title: string; tone: ChecklistTone } {
  const lowScoreResponses = getLowScoreResponses(item.responses)
  const templateLabel = formatChecklistTemplateType(t, item.templateType)
  const scorePercent =
    item.totalScore ?? (typeof item.complianceRate === 'number' ? Math.round(item.complianceRate * 100) : null)
  const scoreLabel = item.totalScore === null ? t('storeChecklists.noScore') : formatScoreValue(t, item.totalScore)

  if (lowScoreResponses.length > 0) {
    const firstLowScore = lowScoreResponses[0]?.itemText
    return {
      tone: 'warning',
      title: getStaticCopy(
        locale,
        `${templateLabel} ${scoreLabel}; ${lowScoreResponses.length} düşük madde`,
        `${templateLabel} ${scoreLabel}; ${lowScoreResponses.length} low-score ${
          lowScoreResponses.length === 1 ? 'item' : 'items'
        }`,
      ),
      copy: firstLowScore
        ? getStaticCopy(locale, `Öncelik: ${firstLowScore}`, `Priority: ${firstLowScore}`)
        : getStaticCopy(locale, 'Düşük puanlı maddeler takipte.', 'Low-score items are in follow-up.'),
    }
  }

  if (scorePercent !== null && scorePercent >= 90) {
    return {
      tone: 'calm',
      title: getStaticCopy(locale, `${templateLabel} ${scoreLabel}; güçlü sonuç`, `${templateLabel} ${scoreLabel}; strong result`),
      copy: getStaticCopy(
        locale,
        'Kritik düşük madde görünmüyor; mağaza kabulü sonrası yakın geçmişe alınır.',
        'No critical low item is visible; after store acknowledgement it moves to recent history.',
      ),
    }
  }

  return {
    tone: 'accent',
    title: getStaticCopy(locale, `${templateLabel} ${scoreLabel}; takipte`, `${templateLabel} ${scoreLabel}; in follow-up`),
    copy: getStaticCopy(
      locale,
      'Sonuç mağaza kabul notuyla beraber izlenir.',
      'The result is tracked together with the store acknowledgement note.',
    ),
  }
}

export function formatCompletedSentence(
  t: TranslateFunction,
  locale: AppLocale,
  item: ChecklistAcknowledgementItem,
) {
  return t('storeChecklists.completedSentence', {
    store: item.storeName || item.storeId,
    category: item.category,
    date: item.completedAt ? formatDateTime(item.completedAt, locale) : t('storeChecklists.recently'),
  })
}

export function buildMonthOptions(
  coverageRows: ChecklistCoverageRow[],
  items: ChecklistAcknowledgementItem[],
  locale: AppLocale,
  extraMonthValues: Array<string | null | undefined> = [],
) {
  const monthKeys = new Set<string>()
  monthKeys.add(getCurrentMonthKey())
  for (const value of extraMonthValues) {
    addMonthKey(monthKeys, value)
  }
  for (const row of coverageRows) {
    addMonthKey(monthKeys, row.summary?.monthStart)
    addMonthKey(monthKeys, row.active?.updatedAt)
    addMonthKey(monthKeys, row.active?.startedAt)
  }
  for (const item of items) {
    addMonthKey(monthKeys, item.completedAt)
    addMonthKey(monthKeys, item.acknowledgement?.acknowledgedAt)
  }

  return [
    { value: 'all', label: getStaticCopy(locale, 'Tüm aylar', 'All months') },
    ...Array.from(monthKeys).toSorted((left, right) => right.localeCompare(left)).map((value) => ({
      value,
      label: formatMonthKey(value, locale),
    })),
  ]
}

export function addMonthKey(monthKeys: Set<string>, value?: string | null) {
  const monthKey = getMonthKey(value)
  if (monthKey) monthKeys.add(monthKey)
}

export function getMonthKey(value?: string | null) {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})/)
  if (match) return `${match[1]}-${match[2]}`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getCurrentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthKey(value: string, locale: AppLocale) {
  const [year, month] = value.split('-').map(Number)
  if (year === undefined || month === undefined) {
    return checklistMonthFormatters[locale].format(new Date(Number.NaN))
  }
  return checklistMonthFormatters[locale].format(new Date(year, month - 1, 1))
}

export function doesCoverageRowMatchFilters(
  row: ChecklistCoverageRow,
  filters: {
    month: string
    query: string
    status: ChecklistStatusFilter
    type: ChecklistTypeFilter
  },
) {
  if (filters.type !== 'all' && row.template.templateType !== filters.type) return false
  if (filters.month !== 'all') {
    const rowMonths = [
      getMonthKey(row.summary?.monthStart),
      getMonthKey(row.active?.updatedAt),
      getMonthKey(row.active?.startedAt),
    ]
    const isCurrentMissingRow =
      filters.month === getCurrentMonthKey() && getCoverageStatus(row) === 'missing'
    const isCurrentLocalCompletion =
      filters.month === getCurrentMonthKey() &&
      getCoverageStatus(row) === 'completed' &&
      row.completedCount > 0
    if (!rowMonths.includes(filters.month) && !isCurrentMissingRow && !isCurrentLocalCompletion) return false
  }
  if (!doesStatusMatch(getCoverageStatus(row), filters.status)) return false

  const query = normalizeSearch(filters.query)
  if (!query) return true
  return normalizeSearch(
    `${row.store.storeName} ${row.template.templateName} ${row.template.templateCode} ${row.template.templateType}`,
  ).includes(query)
}

export function doesChecklistItemMatchFilters(
  item: ChecklistAcknowledgementItem,
  filters: {
    month: string
    query: string
    status: ChecklistStatusFilter
    type: ChecklistTypeFilter
  },
) {
  if (filters.type !== 'all' && item.templateType !== filters.type) return false
  if (filters.month !== 'all' && item.acknowledgement !== null && getMonthKey(item.completedAt) !== filters.month) return false
  const itemStatus: ChecklistStatusFilter = item.acknowledgement ? 'acknowledged' : 'pending'
  if (!doesStatusMatch(itemStatus, filters.status) && !doesStatusMatch(item.status, filters.status)) {
    return false
  }

  const query = normalizeSearch(filters.query)
  if (!query) return true
  return normalizeSearch(
    `${item.storeName} ${item.templateName} ${item.category} ${item.templateType} ${item.status}`,
  ).includes(query)
}

export function doesStatusMatch(itemStatus: string, filterStatus: ChecklistStatusFilter) {
  if (filterStatus === 'all') return true
  if (filterStatus === 'completed') return itemStatus === 'completed'
  return itemStatus === filterStatus
}

export function getCoverageStatus(row: ChecklistCoverageRow): ChecklistStatusFilter {
  if (row.active) return 'draft'
  if (row.completedCount > 0) return 'completed'
  return 'missing'
}

export function getCoverageScore(row: ChecklistCoverageRow) {
  return row.summary?.averageScore ?? null
}

export function sortCoverageRows(rows: ChecklistCoverageRow[], sort: ChecklistSort, locale: AppLocale) {
  return rows.toSorted((left, right) => {
    const multiplier = sort.direction === 'asc' ? 1 : -1
    const compared = compareCoverageRows(left, right, sort.key, locale)
    return compared * multiplier
  })
}

export function sortStoreVisitRows(rows: ChecklistStoreVisitRow[], sort: ChecklistSort, locale: AppLocale) {
  return rows.toSorted((left, right) => {
    const multiplier = sort.direction === 'asc' ? 1 : -1
    const compared = compareStoreVisitRows(left, right, sort.key, locale)
    return compared * multiplier
  })
}

export function compareStoreVisitRows(
  left: ChecklistStoreVisitRow,
  right: ChecklistStoreVisitRow,
  key: ChecklistSortKey,
  locale: AppLocale,
) {
  switch (key) {
    case 'store':
      return compareText(left.store.storeName, right.store.storeName, locale)
    case 'score':
      return compareNumber(getStoreVisitScore(left) ?? -1, getStoreVisitScore(right) ?? -1)
    case 'date':
      return compareDate(getStoreVisitDate(left), getStoreVisitDate(right))
    case 'status':
      return compareText(getCoverageStatus(left.primary), getCoverageStatus(right.primary), locale)
    case 'priority':
    default:
      return compareNumber(getStoreVisitPriority(left), getStoreVisitPriority(right))
  }
}

export function compareCoverageRows(
  left: ChecklistCoverageRow,
  right: ChecklistCoverageRow,
  key: ChecklistSortKey,
  locale: AppLocale,
) {
  switch (key) {
    case 'store':
      return compareText(left.store.storeName, right.store.storeName, locale)
    case 'score':
      return compareNumber(getCoverageScore(left) ?? -1, getCoverageScore(right) ?? -1)
    case 'date':
      return compareDate(getCoverageDate(left), getCoverageDate(right))
    case 'status':
      return compareText(getCoverageStatus(left), getCoverageStatus(right), locale)
    case 'priority':
    default:
      return compareNumber(getCoveragePriority(left), getCoveragePriority(right))
  }
}

export function sortChecklistItems(
  items: ChecklistAcknowledgementItem[],
  sort: ChecklistSort,
  locale: AppLocale,
) {
  return items.toSorted((left, right) => {
    const multiplier = sort.direction === 'asc' ? 1 : -1
    const compared = compareChecklistItems(left, right, sort.key, locale)
    return compared * multiplier
  })
}

export function compareChecklistItems(
  left: ChecklistAcknowledgementItem,
  right: ChecklistAcknowledgementItem,
  key: ChecklistSortKey,
  locale: AppLocale,
) {
  switch (key) {
    case 'store':
      return compareText(left.storeName || left.storeId, right.storeName || right.storeId, locale)
    case 'score':
      return compareNumber(left.totalScore ?? -1, right.totalScore ?? -1)
    case 'status':
      return compareText(left.acknowledgement ? 'acknowledged' : 'pending', right.acknowledgement ? 'acknowledged' : 'pending', locale)
    case 'date':
      return compareDate(left.completedAt, right.completedAt)
    case 'priority':
    default:
      return compareNumber(getLowScoreResponses(left.responses).length, getLowScoreResponses(right.responses).length)
  }
}

export function getCoverageDate(row: ChecklistCoverageRow) {
  return row.active?.updatedAt ?? row.active?.startedAt ?? row.summary?.monthStart ?? null
}

export function getCoveragePriority(row: ChecklistCoverageRow) {
  if (row.active) return 4
  if (row.completedCount === 0) return 3
  const score = getCoverageScore(row)
  if (score !== null && score < 70) return 2
  return 1
}

export function compareText(left: string, right: string, locale: AppLocale) {
  return left.localeCompare(right, getIntlLocale(locale), { sensitivity: 'base' })
}

export function compareNumber(left: number, right: number) {
  return left === right ? 0 : left > right ? 1 : -1
}

export function compareDate(left?: string | null, right?: string | null) {
  const leftTime = left ? new Date(left).getTime() : 0
  const rightTime = right ? new Date(right).getTime() : 0
  return compareNumber(Number.isNaN(leftTime) ? 0 : leftTime, Number.isNaN(rightTime) ? 0 : rightTime)
}

export function normalizeSearch(input: string) {
  return input.trim().toLocaleLowerCase('tr-TR')
}

export function formatOptionalDate(value: string | null | undefined, locale: AppLocale) {
  return value ? formatDateTime(value, locale) : '-'
}

export function buildChecklistResponseDrafts(input: {
  checklistInstanceId: string
  comments: Record<string, string>
  scores: Record<string, number>
  session: ChecklistSession
}): ChecklistResponseDraft[] {
  const drafts: ChecklistResponseDraft[] = []

  for (const item of input.session.template.items) {
    const score = input.scores[item.templateItemId]
    if (typeof score !== 'number' || !Number.isFinite(score)) continue

    const commentText = input.comments[item.templateItemId]
    drafts.push({
      checklistInstanceId: input.checklistInstanceId,
      templateItemId: item.templateItemId,
      scoreValue: score,
      ...(commentText ? { commentText } : {}),
    })
  }

  return drafts
}

export function getChecklistResponseDraftKey(input: { checklistInstanceId: string; templateItemId: string }) {
  return `${input.checklistInstanceId}:${input.templateItemId}`
}

export function serializeChecklistResponseDraft(input: { scoreValue: number; commentText?: string }) {
  return JSON.stringify({ commentText: input.commentText ?? '', scoreValue: input.scoreValue })
}

export function parseChecklistScoreInput(value: string, maxScore: number) {
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? clamp(parsed, 0, maxScore) : null
}

export function getScoreQuickOptions(locale: AppLocale, maxScore: number) {
  const safeMax = Math.max(0, maxScore)
  const watch = Math.round(safeMax * 0.6)
  const critical = Math.round(safeMax * 0.2)
  const option = (tr: string, en: string, value: number) => ({ label: `${getStaticCopy(locale, tr, en)} ${value}`, value })

  return [option('Uygun', 'Good', safeMax), option('Takip', 'Watch', watch), option('Kritik', 'Critical', critical)]
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function getStaticCopy(locale: AppLocale, tr: string, en: string) {
  return locale === 'en' ? en : tr
}
