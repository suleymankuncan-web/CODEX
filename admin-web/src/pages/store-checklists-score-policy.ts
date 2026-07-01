export type ChecklistScorePolicyInput = {
  responseType: string
  maxScore: number
  minScore?: number
  lowScoreThreshold?: number | null
  requiresLowScoreNote?: boolean
}

export function getChecklistScoreBounds(item: ChecklistScorePolicyInput) {
  const maxScore = Number.isFinite(item.maxScore) ? Math.max(0, Math.floor(item.maxScore)) : 0
  const rawMinScore =
    item.responseType === 'score' && Number.isFinite(item.minScore)
      ? Math.floor(item.minScore ?? 0)
      : 0
  const minScore = Math.min(Math.max(0, rawMinScore), maxScore)

  return { maxScore, minScore }
}

export function getChecklistScoreOptions(item: ChecklistScorePolicyInput) {
  const { maxScore, minScore } = getChecklistScoreBounds(item)
  if (maxScore < minScore || maxScore - minScore > 20) return []
  return Array.from({ length: maxScore - minScore + 1 }, (_item, index) => minScore + index)
}

export function isChecklistLowScoreSelection(
  item: ChecklistScorePolicyInput,
  score: number | null | undefined,
) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return false
  if (typeof item.lowScoreThreshold !== 'number' || !Number.isFinite(item.lowScoreThreshold)) {
    return false
  }
  return score <= item.lowScoreThreshold
}

export function isChecklistLowScoreNoteMissing(input: {
  item: ChecklistScorePolicyInput
  score: number | null | undefined
  commentText: string | undefined
}) {
  return (
    input.item.requiresLowScoreNote === true &&
    isChecklistLowScoreSelection(input.item, input.score) &&
    !input.commentText?.trim()
  )
}

export function parseChecklistScoreInput(value: string, item: ChecklistScorePolicyInput) {
  if (value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  const { maxScore, minScore } = getChecklistScoreBounds(item)
  return Math.min(Math.max(parsed, minScore), maxScore)
}
