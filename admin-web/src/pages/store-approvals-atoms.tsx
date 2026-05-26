import type { ReactNode } from 'react'
import type { StoreRequestFeedbackTone } from './store-approvals-model'
import { StoreEmptyState, StoreStatusBadge } from './store-surface-primitives'

type ApprovalTone = 'calm' | 'warning' | 'accent' | 'danger' | 'neutral'

export function StoreRequestFeedback(input: {
  children: ReactNode
  className?: string
  tone: StoreRequestFeedbackTone
}) {
  const role = input.tone === 'error' ? 'alert' : 'status'
  const ariaLive = input.tone === 'error' ? 'assertive' : 'polite'
  const className = [
    'store-request-feedback',
    `store-request-feedback-${input.tone}`,
    input.className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <p className={className} role={role} aria-live={ariaLive}>
      {input.children}
    </p>
  )
}

export function StoreApprovalStatusBadge(input: {
  children: ReactNode
  tone: ApprovalTone
}) {
  return <StoreStatusBadge tone={input.tone}>{input.children}</StoreStatusBadge>
}

export function StoreApprovalEmptyState(input: { title?: string; copy: string }) {
  return input.title ? (
    <StoreEmptyState title={input.title} description={input.copy} />
  ) : (
    <StoreEmptyState description={input.copy} />
  )
}

export function StoreApprovalKeyValue(input: { label: string; value: string }) {
  return (
    <div className="key-item">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}
