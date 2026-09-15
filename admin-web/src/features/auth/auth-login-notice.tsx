import { AlertCircle, Info } from 'lucide-react'
import type { ReactNode } from 'react'

export function AuthLoginNotice(input: {
  children: ReactNode
  id?: string
  tone?: 'error' | 'info'
}) {
  const tone = input.tone ?? 'error'
  const Icon = tone === 'error' ? AlertCircle : Info

  return (
    <div
      id={input.id}
      className={`axis-login-notice axis-login-notice-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon aria-hidden="true" />
      <p>{input.children}</p>
    </div>
  )
}
