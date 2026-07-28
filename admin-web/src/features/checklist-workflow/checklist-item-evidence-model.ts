export function countMissingRequiredChecklistEvidence(
  items: Array<{ templateItemId: string; evidencePolicy: 'none' | 'optional' | 'required' }>,
  evidenceCounts: Record<string, number>,
): number {
  return items.filter(
    (item) => item.evidencePolicy === 'required' && (evidenceCounts[item.templateItemId] ?? 0) < 1,
  ).length
}

export function canSelectSyntheticChecklistFixture(input: {
  disabled: boolean
  busy: boolean
  evidenceCount: number
  maxEvidenceCount: number
}): boolean {
  return !input.disabled && !input.busy && input.evidenceCount < input.maxEvidenceCount
}

export function applyChecklistEvidenceProjection<
  E extends object,
>(
  current: Array<E & { templateItemId: string }>,
  projection: { templateItemId: string; evidenceVersion: number; evidence: E[] },
): { evidenceVersion: number; evidence: Array<E & { templateItemId: string }> } {
  return {
    evidenceVersion: projection.evidenceVersion,
    evidence: [
      ...current.filter((item) => item.templateItemId !== projection.templateItemId),
      ...projection.evidence.map((item) => ({
        ...item,
        templateItemId: projection.templateItemId,
      })),
    ],
  }
}
