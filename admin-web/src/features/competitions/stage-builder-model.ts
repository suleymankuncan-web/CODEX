import type {
  CompetitionStagePackageCode,
  CompetitionStagePackagePlan,
  CompetitionStageSummary,
  CompetitionTeamTemplate,
  CreateCompetitionStagePayload,
} from './api'
import type { AuthLookupStore } from '../auth/api'
import type { TranslationKey } from '../localization/dictionary'
import { createStagePackageStageDrafts, type StagePackageStageDraft } from './stage-packages'
import { buildStagePresetDraft, type StagePresetCode } from './stage-presets'

export const codePattern = /^[A-Z0-9_]+$/

export type TeamDraft = {
  teamCode: string
  teamName: string
  sourceTemplateId?: string
  storeIds: string[]
}

export type TemplateDraft = {
  templateCode: string
  templateName: string
  description: string
  storeIds: string[]
}

export type TemplateEditDraft = TemplateDraft & {
  templateId: string
}

export type TemplateCloneDraft = Omit<TemplateDraft, 'storeIds'> & {
  sourceTemplateId: string
}

export type StageDraft = {
  stagePresetCode?: StagePresetCode
  stageCode: string
  stageName: string
  stageOrder: string
  stageType: CompetitionStageSummary['stageType']
  startsOn: string
  endsOn: string
  teams: TeamDraft[]
}

export type StagePackageDraft = {
  packageCode: CompetitionStagePackageCode
  planName: string
  firstTemplateId: string
  secondTemplateId: string
  stageDrafts: StagePackageStageDraft[]
}

export type StagePackagePlanEditStageDraft = StagePackageStageDraft & {
  teams: CreateCompetitionStagePayload['teams']
}

export type StagePackagePlanEditDraft = {
  planId: string
  packageCode: CompetitionStagePackageCode
  planName: string
  stageDrafts: StagePackagePlanEditStageDraft[]
}

export type StageBuilderFormProps = {
  competitionId: string
  competitionStartsOn: string
  competitionEndsOn: string
  onCreated: () => void | Promise<void>
}

export type StageBuilderFormState = {
  draft: StageDraft
  stagePackageDraft: StagePackageDraft
  templateDraft: TemplateDraft
  feedback: string | null
  stagePackageFeedback: string | null
  templateFeedback: string | null
  templateLifecycleFeedback: string | null
  showInactiveTemplates: boolean
  stagePackageHistoryPlanId: string | null
}

export type StageBuilderFormStateInput = {
  startsOn: string
  endsOn: string
}

export type StagePresetDraft = NonNullable<ReturnType<typeof buildStagePresetDraft>>
export type StageDraftTextField = 'stageCode' | 'stageName' | 'stageOrder' | 'startsOn' | 'endsOn'
export type StagePackageDraftTextField = 'planName' | 'firstTemplateId' | 'secondTemplateId'
export type StagePackageStageTextField = 'stageCode' | 'stageName' | 'stageOrder' | 'startsOn' | 'endsOn'

export type StageBuilderFormAction =
  | { type: 'setStageFeedback'; message: string }
  | { type: 'setStagePackageFeedback'; message: string }
  | { type: 'setTemplateLifecycleFeedback'; message: string }
  | { type: 'setShowInactiveTemplates'; value: boolean }
  | { type: 'setStagePackageHistoryPlanId'; planId: string }
  | { type: 'updateStageDraftField'; field: StageDraftTextField; value: string }
  | { type: 'updateStageDraftType'; value: CompetitionStageSummary['stageType'] }
  | { type: 'clearStagePreset' }
  | { type: 'applyStagePreset'; presetDraft: StagePresetDraft }
  | { type: 'updateTeam'; index: number; patch: Partial<TeamDraft> }
  | {
      type: 'updateStagePackageCode'
      packageCode: CompetitionStagePackageCode
      stageDrafts: StagePackageStageDraft[]
    }
  | { type: 'updateStagePackageField'; field: StagePackageDraftTextField; value: string }
  | {
      type: 'updateStagePackageStageField'
      stageIndex: number
      field: StagePackageStageTextField
      value: string
    }
  | {
      type: 'updateStagePackageStageType'
      stageIndex: number
      value: CompetitionStageSummary['stageType']
    }
  | { type: 'updateTemplateDraftField'; field: keyof Omit<TemplateDraft, 'storeIds'>; value: string }
  | { type: 'toggleTemplateStore'; storeId: string }
  | { type: 'resetTemplateDraftAfterCreate'; message: string }

export function createStageBuilderFormState(input: StageBuilderFormStateInput): StageBuilderFormState {
  return {
    draft: createInitialDraft({ startsOn: input.startsOn, endsOn: input.endsOn }),
    stagePackageDraft: createInitialStagePackageDraft({
      startsOn: input.startsOn,
      endsOn: input.endsOn,
    }),
    templateDraft: createInitialTemplateDraft(),
    feedback: null,
    stagePackageFeedback: null,
    templateFeedback: null,
    templateLifecycleFeedback: null,
    showInactiveTemplates: false,
    stagePackageHistoryPlanId: null,
  }
}

export function stageBuilderFormReducer(
  state: StageBuilderFormState,
  action: StageBuilderFormAction,
): StageBuilderFormState {
  switch (action.type) {
    case 'setStageFeedback':
      return { ...state, feedback: action.message }
    case 'setStagePackageFeedback':
      return { ...state, stagePackageFeedback: action.message }
    case 'setTemplateLifecycleFeedback':
      return { ...state, templateLifecycleFeedback: action.message }
    case 'setShowInactiveTemplates':
      return { ...state, showInactiveTemplates: action.value }
    case 'setStagePackageHistoryPlanId':
      return { ...state, stagePackageHistoryPlanId: action.planId }
    case 'updateStageDraftField':
      return {
        ...state,
        feedback: null,
        draft: { ...state.draft, [action.field]: action.value },
      }
    case 'updateStageDraftType':
      return {
        ...state,
        feedback: null,
        draft: { ...state.draft, stageType: action.value },
      }
    case 'clearStagePreset':
      return {
        ...state,
        feedback: null,
        draft: { ...state.draft, stagePresetCode: undefined },
      }
    case 'applyStagePreset':
      return {
        ...state,
        feedback: null,
        draft: { ...state.draft, ...action.presetDraft },
      }
    case 'updateTeam':
      return {
        ...state,
        feedback: null,
        draft: {
          ...state.draft,
          teams: state.draft.teams.map((team, teamIndex) =>
            teamIndex === action.index ? { ...team, ...action.patch } : team,
          ),
        },
      }
    case 'updateStagePackageCode':
      return {
        ...state,
        stagePackageFeedback: null,
        stagePackageDraft: {
          ...state.stagePackageDraft,
          packageCode: action.packageCode,
          stageDrafts: action.stageDrafts,
        },
      }
    case 'updateStagePackageField':
      return {
        ...state,
        stagePackageFeedback: null,
        stagePackageDraft: {
          ...state.stagePackageDraft,
          [action.field]: action.value,
        },
      }
    case 'updateStagePackageStageField':
      return {
        ...state,
        stagePackageFeedback: null,
        stagePackageDraft: {
          ...state.stagePackageDraft,
          stageDrafts: state.stagePackageDraft.stageDrafts.map((stage, currentIndex) =>
            currentIndex === action.stageIndex ? { ...stage, [action.field]: action.value } : stage,
          ),
        },
      }
    case 'updateStagePackageStageType':
      return {
        ...state,
        stagePackageFeedback: null,
        stagePackageDraft: {
          ...state.stagePackageDraft,
          stageDrafts: state.stagePackageDraft.stageDrafts.map((stage, currentIndex) =>
            currentIndex === action.stageIndex ? { ...stage, stageType: action.value } : stage,
          ),
        },
      }
    case 'updateTemplateDraftField':
      return {
        ...state,
        templateFeedback: null,
        templateDraft: { ...state.templateDraft, [action.field]: action.value },
      }
    case 'toggleTemplateStore':
      return {
        ...state,
        templateFeedback: null,
        templateDraft: {
          ...state.templateDraft,
          storeIds: state.templateDraft.storeIds.includes(action.storeId)
            ? state.templateDraft.storeIds.filter((currentStoreId) => currentStoreId !== action.storeId)
            : [...state.templateDraft.storeIds, action.storeId],
        },
      }
    case 'resetTemplateDraftAfterCreate':
      return {
        ...state,
        templateFeedback: action.message,
        templateDraft: createInitialTemplateDraft(),
      }
    default:
      return state
  }
}

export function normalizeCode(value: string) {
  return value.toUpperCase().replaceAll(/[^A-Z0-9_]/g, '_')
}

export function createInitialDraft(input: { startsOn: string; endsOn: string }): StageDraft {
  return {
    stageCode: 'QUALIFIER',
    stageName: 'Qualifier',
    stageOrder: '1',
    stageType: 'qualifier',
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    teams: [
      { teamCode: 'TEAM_A', teamName: 'Team A', storeIds: [] },
      { teamCode: 'TEAM_B', teamName: 'Team B', storeIds: [] },
    ],
  }
}

export function createInitialStagePackageDraft(input: {
  startsOn: string
  endsOn: string
}): StagePackageDraft {
  return {
    packageCode: 'league_then_final',
    planName: '',
    firstTemplateId: '',
    secondTemplateId: '',
    stageDrafts: createStagePackageStageDrafts({
      competitionStartsOn: input.startsOn,
      competitionEndsOn: input.endsOn,
      packageCode: 'league_then_final',
    }),
  }
}

export function createStagePackagePlanEditDraft(
  plan: CompetitionStagePackagePlan,
): StagePackagePlanEditDraft {
  return {
    planId: plan.planId,
    packageCode: plan.packageCode,
    planName: plan.planName,
    stageDrafts: plan.stageDrafts.map((stage) => ({
      stagePresetCode:
        stage.stagePresetCode ?? (stage.stageOrder === 1 ? 'region_league' : 'final_showdown'),
      stageCode: stage.stageCode,
      stageName: stage.stageName,
      stageOrder: String(stage.stageOrder),
      stageType: stage.stageType,
      startsOn: stage.startsOn,
      endsOn: stage.endsOn,
      teams: stage.teams,
    })),
  }
}

export function createInitialTemplateDraft(): TemplateDraft {
  return {
    templateCode: '',
    templateName: '',
    description: '',
    storeIds: [],
  }
}

export function createTemplateEditDraft(template: CompetitionTeamTemplate): TemplateEditDraft {
  return {
    templateId: template.templateId,
    templateCode: template.templateCode,
    templateName: template.templateName,
    description: template.description ?? '',
    storeIds: template.stores.map((store) => store.storeId),
  }
}

export function createTemplateCloneDraft(template: CompetitionTeamTemplate): TemplateCloneDraft {
  return {
    sourceTemplateId: template.templateId,
    templateCode: normalizeCode(`${template.templateCode}_COPY`),
    templateName: `${template.templateName} Copy`,
    description: template.description ?? '',
  }
}

export function storeLabel(store: AuthLookupStore) {
  return `${store.storeCode} - ${store.storeName} - ${store.regionName}`
}

export function validateTemplateDraft(draft: TemplateDraft): TranslationKey | null {
  if (!draft.templateCode.trim() || !codePattern.test(draft.templateCode)) {
    return 'competition.stageBuilder.validation.templateCode'
  }

  if (!draft.templateName.trim()) {
    return 'competition.stageBuilder.validation.templateName'
  }

  if (draft.storeIds.length === 0) {
    return 'competition.stageBuilder.validation.templateStores'
  }

  return null
}

export function validateTemplateCloneDraft(draft: TemplateCloneDraft): TranslationKey | null {
  if (!draft.templateCode.trim() || !codePattern.test(draft.templateCode)) {
    return 'competition.stageBuilder.validation.templateCode'
  }

  if (!draft.templateName.trim()) {
    return 'competition.stageBuilder.validation.templateName'
  }

  return null
}
