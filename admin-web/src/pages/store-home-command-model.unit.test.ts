import { describe, expect, it } from 'vitest'
import { buildStoreHomeCommandModel, type StoreHomeCommandBuilderInput } from './store-home-command-model'

function homeInput(overrides: Partial<StoreHomeCommandBuilderInput> = {}): StoreHomeCommandBuilderInput {
  return {
    availablePaths: new Set(['/store/checklists', '/store/approvals']),
    checklistActionLabel: null,
    checklistCopy: null,
    checklistMetricValue: '0',
    checklistTitle: null,
    checklistTone: 'ready',
    checklistUnavailable: false,
    icons: {
      alert: null, bell: null, checklist: null, file: null, megaphone: null,
      shield: null, store: null, target: null, trending: null, users: null, wallet: null,
    },
    identityLabel: 'Mağaza müdürü',
    pendingRequestsValue: '0',
    pendingValue: 'Bekliyor',
    periodLabel: 'Eylül 2026',
    persona: 'storeManager',
    personaLabel: 'Mağaza müdürü',
    storeScopeValue: '1',
    visitPriorityActionLabel: null,
    visitPriorityCopy: null,
    visitPriorityTitle: null,
    visitPriorityValue: null,
    visitUnavailable: false,
    workflowUnavailable: false,
    ...overrides,
  }
}

describe('Home summary data confidence', () => {
  it.each<Partial<StoreHomeCommandBuilderInput>>([
    { checklistMetricValue: 'Bekliyor' },
    { pendingRequestsValue: 'Bekliyor' },
    { visitPriorityValue: 'Bekliyor' },
  ])('does not declare a clear agenda while a summary is loading: %j', (overrides) => {
    const model = buildStoreHomeCommandModel(homeInput(overrides))
    expect(model.metrics.find((metric) => metric.id === 'attention')).toMatchObject({
      value: 'Bekliyor', note: 'Yükleniyor', tone: 'neutral',
    })
    expect(model.priorities.find((priority) => priority.state === 'loading')?.tone).toBe('neutral')
  })

  it.each<Partial<StoreHomeCommandBuilderInput>>([
    { checklistMetricValue: '—', checklistUnavailable: true },
    { pendingRequestsValue: '—', workflowUnavailable: true },
    { visitPriorityValue: '—', visitUnavailable: true },
  ])('does not turn an unavailable summary into zero attention: %j', (overrides) => {
    const model = buildStoreHomeCommandModel(homeInput(overrides))
    expect(model.metrics.find((metric) => metric.id === 'attention')).toMatchObject({
      value: '—', note: 'Bilgi eksik', tone: 'neutral',
    })
    expect(model.hasPartialData).toBe(true)
  })

  it('describes the request summary as loading until its response arrives', () => {
    const model = buildStoreHomeCommandModel(homeInput({ pendingRequestsValue: 'Bekliyor' }))
    const request = model.priorities.find((priority) => priority.id === 'requests')
    expect(request?.title).toBe('Talep özeti yükleniyor')
    expect(request?.detail).not.toContain('bekleyen işlem bulunmuyor')
  })

  it('keeps confirmed empty and populated attention counts unchanged', () => {
    const empty = buildStoreHomeCommandModel(homeInput())
    const populated = buildStoreHomeCommandModel(homeInput({ checklistMetricValue: '3', pendingRequestsValue: '2' }))
    expect(empty.metrics.find((metric) => metric.id === 'attention')).toMatchObject({
      value: '0', note: 'Gündem temiz', tone: 'mint',
    })
    expect(populated.metrics.find((metric) => metric.id === 'attention')).toMatchObject({
      value: '2', note: 'Bugünün gündemi', tone: 'rose',
    })
  })
})
