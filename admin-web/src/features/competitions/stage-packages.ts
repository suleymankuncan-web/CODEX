import type {
  CompetitionStagePackageCode,
  CompetitionTeamTemplate,
  CreateCompetitionStagePackagePayload,
} from './api'
import { buildStagePresetDraft, type StagePresetCode } from './stage-presets'

export type StagePackageOption = {
  code: CompetitionStagePackageCode
  label: string
  presetCodes: StagePresetCode[]
}

export const stagePackageOptions: StagePackageOption[] = [
  {
    code: 'league_then_final',
    label: 'League then final',
    presetCodes: ['region_league', 'final_showdown'],
  },
]

export function buildStagePackagePayload(input: {
  competitionStartsOn: string
  competitionEndsOn: string
  packageCode: CompetitionStagePackageCode
  templates: CompetitionTeamTemplate[]
}): CreateCompetitionStagePackagePayload | null {
  const packageOption = stagePackageOptions.find((item) => item.code === input.packageCode)

  if (!packageOption || input.templates.length < 2) {
    return null
  }

  const teams = input.templates.slice(0, 2).map((template) => ({
    sourceTemplateId: template.templateId,
    teamCode: template.templateCode,
    teamName: template.templateName,
    storeIds: template.stores.map((store) => store.storeId),
  }))

  const stages = []

  for (const presetCode of packageOption.presetCodes) {
    const stageDraft = buildStagePresetDraft({
      competitionStartsOn: input.competitionStartsOn,
      competitionEndsOn: input.competitionEndsOn,
      presetCode,
    })

    if (!stageDraft) {
      return null
    }

    stages.push({
      ...stageDraft,
      stageOrder: Number(stageDraft.stageOrder),
      teams,
    })
  }

  return {
    packageCode: input.packageCode,
    stages,
  }
}
