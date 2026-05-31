import type { AdminSurfaceTone } from './admin-surface-primitives'

export type OperationsTone = 'calm' | 'warning' | 'accent' | 'danger' | 'neutral'

export function toAdminSurfaceTone(tone: OperationsTone | undefined): AdminSurfaceTone {
  if (tone === 'calm') return 'success'
  if (tone === 'accent') return 'accent'
  if (tone === 'danger') return 'danger'
  if (tone === 'warning') return 'warning'
  return 'neutral'
}
