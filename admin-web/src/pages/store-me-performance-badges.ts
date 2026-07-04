export type StoreMePerformanceBadgeCode =
  | 'TURKEY_1'
  | 'TOP_1_PERCENT'
  | 'STORE_LEADER'
  | 'REGION_TOP_3'
  | 'RISING_STAR'
  | 'TARGET_ABOVE'
  | 'CONSISTENT_PERFORMER'

export type StoreMePerformanceBadgeIcon =
  | 'trophy'
  | 'medal'
  | 'crown'
  | 'podium'
  | 'trending-up'
  | 'target'
  | 'shield-check'

export type StoreMePerformanceBadge = {
  code: StoreMePerformanceBadgeCode
  icon: StoreMePerformanceBadgeIcon
  label: string
  reason: string
  tone: 'gold' | 'plum' | 'cyan' | 'mint' | 'neutral'
}

export type StoreMePerformanceBadgeInput = {
  currentPeriodDataQuality: 'trusted' | 'partial' | 'missing'
  periodKey: string
  previousPeriodScore: number | null
  previousPeriodTurkeyRank: number | null
  regionPopulation: number | null
  regionRank: number | null
  score: number | null
  scoreHistory: number[]
  storePopulation: number | null
  storeRank: number | null
  targetAchievementPercent: number | null
  turkeyPopulation: number | null
  turkeyRank: number | null
}

function isPositiveInteger(input: number | null | undefined): input is number {
  return typeof input === 'number' && Number.isInteger(input) && input > 0
}

function isFiniteNumber(input: number | null | undefined): input is number {
  return typeof input === 'number' && Number.isFinite(input)
}

export function getStoreMePerformancePercentile(input: {
  turkeyPopulation: number | null
  turkeyRank: number | null
}) {
  const { turkeyPopulation, turkeyRank } = input
  if (!isPositiveInteger(turkeyRank) || !isPositiveInteger(turkeyPopulation)) {
    return null
  }

  return Math.max(1, Math.ceil((turkeyRank / turkeyPopulation) * 100))
}

function createBadge(input: Omit<StoreMePerformanceBadge, 'reason'> & { reason: string }) {
  return input
}

function hasRequiredBaseData(input: StoreMePerformanceBadgeInput) {
  return (
    input.periodKey.trim() !== '' &&
    input.currentPeriodDataQuality === 'trusted' &&
    isFiniteNumber(input.score) &&
    isPositiveInteger(input.turkeyRank) &&
    isPositiveInteger(input.turkeyPopulation)
  )
}

export function resolveStoreMePerformanceBadge(
  input: StoreMePerformanceBadgeInput,
): StoreMePerformanceBadge | null {
  if (!hasRequiredBaseData(input)) {
    return null
  }

  const percentile = getStoreMePerformancePercentile(input)

  if (input.turkeyRank === 1 && (input.turkeyPopulation ?? 0) >= 30) {
    return createBadge({
      code: 'TURKEY_1',
      icon: 'trophy',
      label: "TÜRKİYE 1.'Sİ",
      reason: 'Turkey rank is 1 in a national pool of at least 30.',
      tone: 'gold',
    })
  }

  if (
    (input.turkeyRank ?? 0) > 1 &&
    (input.turkeyPopulation ?? 0) >= 100 &&
    percentile !== null &&
    percentile <= 1
  ) {
    return createBadge({
      code: 'TOP_1_PERCENT',
      icon: 'medal',
      label: 'İLK %1',
      reason: 'National percentile is at or above top 1%.',
      tone: 'gold',
    })
  }

  if (input.storeRank === 1 && (input.storePopulation ?? 0) >= 2) {
    return createBadge({
      code: 'STORE_LEADER',
      icon: 'crown',
      label: 'MAĞAZA LİDERİ',
      reason: 'Store rank is 1 in a store pool of at least 2.',
      tone: 'plum',
    })
  }

  if (
    isPositiveInteger(input.regionRank) &&
    (input.regionRank ?? 0) <= 3 &&
    (input.regionPopulation ?? 0) >= 10
  ) {
    return createBadge({
      code: 'REGION_TOP_3',
      icon: 'podium',
      label: 'BÖLGE İLK 3',
      reason: 'Region rank is in the top 3 in a region pool of at least 10.',
      tone: 'cyan',
    })
  }

  if (
    isPositiveInteger(input.previousPeriodTurkeyRank) &&
    isPositiveInteger(input.turkeyRank) &&
    isFiniteNumber(input.previousPeriodScore) &&
    isFiniteNumber(input.score)
  ) {
    const previousPeriodTurkeyRank = input.previousPeriodTurkeyRank
    const previousPeriodScore = input.previousPeriodScore
    const currentScore = input.score
    const turkeyRank = input.turkeyRank
    const rankImprovement = previousPeriodTurkeyRank - turkeyRank
    const relativeImprovement = rankImprovement / previousPeriodTurkeyRank
    const scoreDidNotFall = currentScore >= previousPeriodScore
    if (
      currentScore >= 60 &&
      scoreDidNotFall &&
      (rankImprovement >= 20 || relativeImprovement >= 0.15)
    ) {
      return createBadge({
        code: 'RISING_STAR',
        icon: 'trending-up',
        label: 'AYIN YÜKSELENİ',
        reason: 'Turkey rank improved enough while score did not fall.',
        tone: 'mint',
      })
    }
  }

  const targetAchievementPercent = input.targetAchievementPercent
  if (isFiniteNumber(targetAchievementPercent) && targetAchievementPercent >= 100) {
    return createBadge({
      code: 'TARGET_ABOVE',
      icon: 'target',
      label: 'HEDEF ÜSTÜ',
      reason: 'Trusted target achievement is at least 100%.',
      tone: 'cyan',
    })
  }

  if (
    input.scoreHistory.length >= 3 &&
    input.scoreHistory.slice(-3).every((score) => Number.isFinite(score) && score >= 70)
  ) {
    return createBadge({
      code: 'CONSISTENT_PERFORMER',
      icon: 'shield-check',
      label: 'İSTİKRARLI PERFORMANS',
      reason: 'Last 3 trusted period scores are at least 70.',
      tone: 'neutral',
    })
  }

  return null
}
