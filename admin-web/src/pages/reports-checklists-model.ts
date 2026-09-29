import type { AdminSurfaceTone } from './admin-surface-primitives'

export function toNumber(input: string | null) {
  if (input === null) return null
  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : null
}

export function mapChecklistTone(complianceRate: string | null, criticalIssueCount: number): AdminSurfaceTone {
  if (criticalIssueCount > 0) return 'danger'
  const compliance = toNumber(complianceRate)
  if (compliance === null) return 'neutral'
  if (compliance >= 0.95) return 'success'
  if (compliance >= 0.85) return 'warning'
  return 'danger'
}

export function summarizeChecklistMetrics(rows: Array<{
  auditCount: number; avgScore: string | null; complianceRate: string | null; criticalIssueCount: number;
}>) {
  const totals = rows.reduce((accumulator, row) => {
    accumulator.auditCount += row.auditCount
    const score = toNumber(row.avgScore)
    const compliance = toNumber(row.complianceRate)
    if (score !== null) { accumulator.avgScore += score; accumulator.scoreSamples += 1 }
    if (compliance !== null) { accumulator.complianceRate += compliance; accumulator.complianceSamples += 1 }
    accumulator.criticalIssues += row.criticalIssueCount
    if (row.criticalIssueCount > 0) accumulator.rowsWithCriticalIssues += 1
    return accumulator
  }, { auditCount: 0, avgScore: 0, complianceRate: 0, scoreSamples: 0, complianceSamples: 0, criticalIssues: 0, rowsWithCriticalIssues: 0 })
  return {
    totals,
    averageScore: totals.scoreSamples > 0 ? totals.avgScore / totals.scoreSamples : null,
    averageCompliance: totals.complianceSamples > 0 ? totals.complianceRate / totals.complianceSamples : null,
  }
}
