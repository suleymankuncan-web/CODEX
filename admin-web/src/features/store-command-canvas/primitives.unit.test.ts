import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import {
  CommandCanvasDataList,
  CommandCanvasFilterBar,
  CommandCanvasMetricFilter,
  CommandCanvasMetricRail,
  CommandCanvasPage,
  CommandCanvasPageHeader,
  CommandCanvasPartialDataNotice,
  CommandCanvasSortableHeading,
} from './primitives'

describe('Command Canvas shared primitive semantics', () => {
  test('renders one labelled page owner with interactive metrics and sortable headings', () => {
    const html = renderToStaticMarkup(
      createElement(
        CommandCanvasPage,
        { ariaLabelledBy: 'canvas-title', children: undefined },
        createElement(CommandCanvasPageHeader, {
          title: 'Workspace',
          titleId: 'canvas-title',
          description: 'Authorized operational data',
        }),
        createElement(
          CommandCanvasMetricRail,
          { ariaLabel: 'Metrics', children: undefined },
          createElement(CommandCanvasMetricFilter, {
            active: true,
            icon: createElement('span', null, '1'),
            label: 'All',
            value: '42',
            onClick: () => undefined,
          }),
        ),
        createElement(CommandCanvasSortableHeading, {
          direction: 'ascending',
          label: 'Store',
          onClick: () => undefined,
        }),
      ),
    )

    expect(html).toContain('data-command-canvas-page="true"')
    expect(html).toContain('aria-labelledby="canvas-title"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('role="columnheader"')
    expect(html).toContain('aria-sort="ascending"')
  })

  test('announces background refresh without replacing the visible list', () => {
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(CommandCanvasFilterBar, {
          search: createElement('input', { 'aria-label': 'Search' }),
          isUpdating: true,
          updatingLabel: 'Updating current rows',
        }),
        createElement(
          CommandCanvasDataList,
          { ariaLabel: 'Authorized stores', children: undefined },
          createElement('article', null, 'Store A'),
        ),
      ),
    )

    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Updating current rows')
    expect(html).toContain('data-command-canvas-list="true"')
    expect(html).toContain('Store A')
  })

  test('renders a localized partial-data status without a mutation control', () => {
    const html = renderToStaticMarkup(
      createElement(CommandCanvasPartialDataNotice, {
        title: 'Partial data',
        description: 'One read section is unavailable.',
      }),
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('Partial data')
    expect(html).not.toContain('<button')
  })
})
