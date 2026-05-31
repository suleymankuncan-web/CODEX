import type { AdminSurfaceTone } from '../../pages/admin-surface-primitives'

function toAdminTone(tone: string): AdminSurfaceTone {
  if (tone === 'calm') return 'success'
  if (tone === 'accent') return 'accent'
  if (tone === 'warning') return 'warning'
  if (tone === 'danger') return 'danger'
  if (tone === 'cyan') return 'cyan'
  return 'neutral'
}

function mapQualitySeverityTone(severity: string): AdminSurfaceTone {
  if (severity === 'high') return 'danger'
  if (severity === 'medium') return 'warning'
  return 'accent'
}

function mapErrorTone(category: string): AdminSurfaceTone {
  if (category === 'validation') return 'warning'
  if (category === 'missing_dependency') return 'accent'
  return 'danger'
}

export { mapErrorTone, mapQualitySeverityTone, toAdminTone }
