import type {
  CompetitionStageSummary,
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

export type StagePackageStageDraft = {
  stagePresetCode: StagePresetCode
  stageCode: string
  stageName: string
  stageOrder: string
  stageType: CompetitionStageSummary['stageType']
  startsOn: string
  endsOn: string
}

export const stagePackageOptions: StagePackageOption[] = [
  {
    code: 'league_then_final',
    label: 'League then final',
    presetCodes: ['region_league', 'final_showdown'],
  },
]

export function createStagePackageStageDrafts(input: {
  competitionStartsOn: string
  competitionEndsOn: string
  packageCode: CompetitionStagePackageCode
}): StagePackageStageDraft[] {
  const packageOption = stagePackageOptions.find((item) => item.code === input.packageCode)

  if (!packageOption) return []

  return packageOption.presetCodes.flatMap((presetCode) => {
    const presetDraft = buildStagePresetDraft({
      competitionStartsOn: input.competitionStartsOn,
      competitionEndsOn: input.competitionEndsOn,
      presetCode,
    })

    if (!presetDraft) return []

    return [presetDraft]
  })
}

export function buildStagePackagePayload(input: {
  packageCode: CompetitionStagePackageCode
  stageDrafts: StagePackageStageDraft[]
  templates: CompetitionTeamTemplate[]
}): CreateCompetitionStagePackagePayload | null {
  if (input.stageDrafts.length < 2 || input.templates.length < 2) {
    return null
  }

  const teams = input.templates.slice(0, 2).map((template) => ({
    sourceTemplateId: template.templateId,
    teamCode: template.templateCode,
    teamName: template.templateName,
    storeIds: template.stores.map((store) => store.storeId),
  }))

  return {
    packageCode: input.packageCode,
    stages: input.stageDrafts.map((stageDraft) => ({
      ...stageDraft,
      stageCode: stageDraft.stageCode.trim(),
      stageName: stageDraft.stageName.trim(),
      stageOrder: Number(stageDraft.stageOrder),
      teams,
    })),
  }
}
