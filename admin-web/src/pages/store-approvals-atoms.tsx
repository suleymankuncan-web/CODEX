import type { ReactNode } from 'react'
import type { StoreRequestFeedbackTone } from './store-approvals-model'

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
