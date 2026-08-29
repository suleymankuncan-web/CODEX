import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './status-badge'
import { statusBadgeToneClasses } from './status-badge-model'

describe('StatusBadge', () => {
  it('exposes the complete semantic tone contract without raw palette utilities', () => {
    expect(Object.keys(statusBadgeToneClasses).sort()).toEqual(['danger', 'info', 'neutral', 'success', 'warning'])
    expect(Object.values(statusBadgeToneClasses).join(' ')).not.toMatch(/(?:blue|rose|amber|emerald)-\d/)
  })

  it.each(Object.keys(statusBadgeToneClasses) as Array<keyof typeof statusBadgeToneClasses>)(
    'renders the %s tone through the shared badge primitive',
    (tone) => {
      const markup = renderToStaticMarkup(createElement(StatusBadge, { tone }, 'Durum'))

      expect(markup).toContain(`data-tone="${tone}"`)
      expect(markup).toContain('data-slot="badge"')
      expect(markup).toContain(statusBadgeToneClasses[tone].split(' ')[0])
    },
  )
})
