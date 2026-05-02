export type StagePresetCode = 'region_league' | 'first_half_qualifier' | 'final_showdown'

type StageType = 'qualifier' | 'league' | 'quarter_final' | 'semi_final' | 'final' | 'custom'

export type StagePresetOption = {
  code: StagePresetCode
  label: string
  stageCode: string
  stageName: string
  stageOrder: string
  stageType: StageType
  dateRange: 'full' | 'first_half' | 'second_half'
}

export const stagePresetOptions: StagePresetOption[] = [
  {
    code: 'region_league',
    label: 'Regional league',
    stageCode: 'REGION_LEAGUE',
    stageName: 'Regional League',
    stageOrder: '1',
    stageType: 'league',
    dateRange: 'full',
  },
  {
    code: 'first_half_qualifier',
    label: 'First half qualifier',
    stageCode: 'FIRST_HALF_QUALIFIER',
    stageName: 'First Half Qualifier',
    stageOrder: '1',
    stageType: 'qualifier',
    dateRange: 'first_half',
  },
  {
    code: 'final_showdown',
    label: 'Final showdown',
    stageCode: 'FINAL_SHOWDOWN',
    stageName: 'Final Showdown',
    stageOrder: '2',
    stageType: 'final',
    dateRange: 'second_half',
  },
]

export function buildStagePresetDraft(input: {
  competitionStartsOn: string
  competitionEndsOn: string
  presetCode: StagePresetCode
}) {
  const preset = stagePresetOptions.find((item) => item.code === input.presetCode)

  if (!preset) {
    return null
  }

  const dateRange = resolvePresetDateRange({
    competitionStartsOn: input.competitionStartsOn,
    competitionEndsOn: input.competitionEndsOn,
    dateRange: preset.dateRange,
  })

  return {
    stagePresetCode: preset.code,
    stageCode: preset.stageCode,
    stageName: preset.stageName,
    stageOrder: preset.stageOrder,
    stageType: preset.stageType,
    startsOn: dateRange.startsOn,
    endsOn: dateRange.endsOn,
  }
}

function resolvePresetDateRange(input: {
  competitionStartsOn: string
  competitionEndsOn: string
  dateRange: StagePresetOption['dateRange']
}) {
  if (input.dateRange === 'full') {
    return {
      startsOn: input.competitionStartsOn,
      endsOn: input.competitionEndsOn,
    }
  }

  const firstHalfEndsOn = addDays(
    input.competitionStartsOn,
    Math.max(1, Math.ceil(countInclusiveDays(input.competitionStartsOn, input.competitionEndsOn) / 2)) - 1,
  )

  if (input.dateRange === 'first_half') {
    return {
      startsOn: input.competitionStartsOn,
      endsOn: firstHalfEndsOn,
    }
  }

  const secondHalfStartsOn = addDays(firstHalfEndsOn, 1)

  return {
    startsOn: secondHalfStartsOn > input.competitionEndsOn ? input.competitionEndsOn : secondHalfStartsOn,
    endsOn: input.competitionEndsOn,
  }
}

function countInclusiveDays(startsOn: string, endsOn: string) {
  const oneDayMs = 24 * 60 * 60 * 1000
  const startDate = parseDate(startsOn)
  const endDate = parseDate(endsOn)

  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / oneDayMs) + 1)
}

function addDays(value: string, days: number) {
  const date = parseDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}
