import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PersonnelObservationsSection } from './personnel-observations-section'

const state = vi.hoisted(() => ({ query: {} }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => state.query }))

const row = {
  sourceId: 'source',
  businessDate: '2026-09-07',
  storeId: 'store',
  storeCode: 'M001',
  storeName: 'Test store',
  personnelCode: 'P001',
}
const render = () => renderToStaticMarkup(createElement(PersonnelObservationsSection))

describe('personnel observation read-only states', () => {
  beforeEach(() => {
    state.query = {}
  })

  it('explains the observation boundary and renders codes without management actions', () => {
    state.query = { data: { items: [row], meta: { total: 1, count: 1, limit: 20, offset: 0 } } }
    const html = render()
    expect(html).toContain('Satışlarda görülen personeller')
    expect(html).toContain('çalışan kadrosu, işe giriş veya mağaza ataması anlamına gelmez')
    expect(html).toContain('P001')
    expect(html).toContain('Test store')
    expect(html).not.toMatch(/Düzenle|Sil|İşe giriş|İşten çıkış|Yetki/)
  })

  it('does not disguise loading or failures as empty results', () => {
    state.query = { isPending: true }
    expect(render()).toContain('personeller yükleniyor')
    state.query = { isError: true, data: { items: [row] } }
    const html = render()
    expect(html).toContain('personeller alınamadı')
    expect(html).toContain('Tekrar dene')
    expect(html).not.toContain('P001')
    expect(html).not.toContain('gözlem yok')
  })

  it('shows an honest empty state and bounded navigation', () => {
    state.query = { data: { items: [], meta: { total: 0, count: 0, limit: 20, offset: 0 } } }
    expect(render()).toContain('gözlem yok')
    state.query = { data: { items: [row], meta: { total: 21, count: 1, limit: 20, offset: 0 } } }
    const html = render()
    expect(html).toContain('1-1 / 21 gözlem')
    expect(html).toContain('Sonraki gözlemler')
  })
})
