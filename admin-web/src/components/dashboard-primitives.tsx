import type { ReactNode } from 'react'

export type Tone = 'calm' | 'warning' | 'accent' | 'danger' | 'neutral'

export function MetricAccent(input: { label: string; value: string }) {
  return (
    <div className="accent-chip">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

export function MetricCard(input: {
  title: string
  value: number | string
  note: string
  icon: ReactNode
  tone: Exclude<Tone, 'neutral'> | 'neutral'
}) {
  return (
    <article className={`metric-card metric-card-${input.tone}`}>
      <div className="metric-icon">{input.icon}</div>
      <div className="metric-value">{input.value}</div>
      <h3>{input.title}</h3>
      <p>{input.note}</p>
    </article>
  )
}

export function KeyValue(input: { label: string; value: string }) {
  return (
    <div className="key-item">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

export function StatusBar(input: {
  label: string
  value: number
  total?: number
  rate?: number
  tone: Tone
}) {
  const percent =
    input.rate !== undefined
      ? Math.round(input.rate * 100)
      : input.total && input.total > 0
        ? Math.round((input.value / input.total) * 100)
        : 0

  return (
    <div className="status-bar">
      <div className="status-bar-head">
        <span>{input.label}</span>
        <strong>{input.value} · {percent}%</strong>
      </div>
      <div className="status-bar-track">
        <div className={`status-bar-fill status-bar-fill-${input.tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export function StatusPill(input: { children: string; tone: Tone }) {
  return <span className={`status-pill status-pill-${input.tone}`}>{input.children}</span>
}

export function ScreenState(input: { title: string; copy: string; tone?: 'error' }) {
  return (
    <section className={`screen-state${input.tone === 'error' ? ' screen-state-error' : ''}`}>
      <h2>{input.title}</h2>
      <p>{input.copy}</p>
    </section>
  )
}

export function EmptyState(input: { title?: string; copy: string }) {
  return (
    <div className="empty-card">
      {input.title ? <strong>{input.title}</strong> : null}
      <p>{input.copy}</p>
    </div>
  )
}
