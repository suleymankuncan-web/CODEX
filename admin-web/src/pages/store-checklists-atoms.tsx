import type { ChecklistTone } from './store-checklists-model'
import { clamp } from './store-checklists-logic'

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

export function ChecklistEmptyBlock(input: { copy: string; title: string }) {
  return (
    <div className="store-checklists-empty-block">
      <strong>{input.title}</strong>
      <p>{input.copy}</p>
    </div>
  )
}
