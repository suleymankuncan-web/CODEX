import { Button } from '@/components/ui/button'
import type { TranslateFunction } from '../features/localization/dictionary'
import { formatNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { ChecklistCoverageRow, ChecklistSortDirection, ChecklistTone } from './store-checklists-model'
import { clamp, getCoverageScore, getLocalizedTemplateScoreStatus, getStaticCopy } from './store-checklists-logic'

export function ChecklistMetric(input: { label: string; note?: string; tone: ChecklistTone; value: string }) {
  return (
    <div className={`store-checklists-metric store-checklists-tone-${input.tone}`}>
      <span>{input.label}</span>
      <strong>{input.value}</strong>
      {input.note ? <small>{input.note}</small> : null}
    </div>
  )
}

export function ChecklistBadge(input: { children: string; tone: ChecklistTone }) {
  return <span className={`store-checklists-badge store-checklists-tone-${input.tone}`}>{input.children}</span>
}

export function ChecklistFact(input: { label: string; value: string }) {
  return (
    <div className="store-checklists-fact">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

export function ChecklistScoreBar(input: {
  label: string
  percent: number
  tone: ChecklistTone
  value: string
}) {
  const percent = clamp(input.percent, 0, 100)

  return (
    <div
      className={`store-checklists-scorebar${
        input.tone === 'neutral' ? ' store-checklists-scorebar-empty' : ''
      }`}
    >
      <div>
        <span>{input.label}</span>
        <strong>{input.value}</strong>
      </div>
      <i aria-hidden="true">
        <b className={`store-checklists-tone-${input.tone}`} style={{ width: `${percent}%` }} />
      </i>
    </div>
  )
}

export function ChecklistTemplateScore(input: {
  label: string
  locale: AppLocale
  row: ChecklistCoverageRow | undefined
  t: TranslateFunction
}) {
  const score = input.row ? getCoverageScore(input.row) : null
  const tone = !input.row || score === null ? 'neutral' : score >= 70 ? 'calm' : 'warning'
  const status = input.row
    ? getLocalizedTemplateScoreStatus(input.t, input.locale, input.label, input.row)
    : getStaticCopy(input.locale, `${input.label} yapılmadı`, `${input.label} not done`)

  return (
    <div className="store-checklists-template-score">
      <small>{status}</small>
      <b>
        {score === null ? '-' : formatNumber(score, input.locale)}
        <em>/100</em>
      </b>
      <span className={`store-checklists-template-scorebar${tone === 'neutral' ? ' store-checklists-scorebar-empty' : ''}`}>
        <i>
          <b className={`store-checklists-tone-${tone}`} style={{ width: `${clamp(score ?? 0, 0, 100)}%` }} />
        </i>
      </span>
    </div>
  )
}

export function ChecklistEmptyBlock(input: { copy: string; title: string }) {
  return (
    <div className="store-checklists-empty-block">
      <strong>{input.title}</strong>
      <p>{input.copy}</p>
    </div>
  )
}

export function SortButton(input: {
  active: boolean
  children: string
  direction: ChecklistSortDirection
  onClick: () => void
}) {
  return (
    <Button
      className={`store-checklists-sort-button${input.active ? ' store-checklists-sort-button-active' : ''}`}
      type="button"
      variant="ghost"
      size="xs"
      onClick={input.onClick}
    >
      <span>{input.children}</span>
      <small aria-hidden="true">{input.active ? (input.direction === 'asc' ? '↑' : '↓') : '↕'}</small>
    </Button>
  )
}
