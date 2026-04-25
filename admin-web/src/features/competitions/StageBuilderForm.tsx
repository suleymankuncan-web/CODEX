import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusCircle } from 'lucide-react'
import {
  EmptyState,
  ScreenState,
  StatusPill,
} from '../../components/dashboard-primitives'
import { getAuthLookups, type AuthLookupStore } from '../auth/api'
import {
  approveCompetitionStagePackagePlan,
  cancelCompetitionStagePackagePlan,
  cloneCompetitionStagePackagePlan,
  cloneCompetitionTeamTemplate,
  createCompetitionStagePackagePlan,
  createCompetitionTeamTemplate,
  createCompetitionStage,
  createCompetitionStagePackage,
  deactivateCompetitionTeamTemplate,
  executeCompetitionStagePackagePlan,
  listCompetitionStagePackagePlanAudit,
  listCompetitionStagePackagePlans,
  listCompetitionTeamTemplates,
  rejectCompetitionStagePackagePlan,
  submitCompetitionStagePackagePlan,
  updateCompetitionStagePackagePlan,
  updateCompetitionTeamTemplate,
  type CloneCompetitionTeamTemplatePayload,
  type CompetitionStagePackagePlanAuditEvent,
  type CompetitionStagePackagePlan,
  type CompetitionStagePackageCode,
  type CompetitionTeamTemplate,
  type CompetitionStageSummary,
  type CreateCompetitionStagePackagePlanPayload,
  type CreateCompetitionStagePackagePayload,
  type CreateCompetitionTeamTemplatePayload,
  type CreateCompetitionStagePayload,
  type ReviewCompetitionStagePackagePlanPayload,
  type UpdateCompetitionStagePackagePlanPayload,
  type UpdateCompetitionTeamTemplatePayload,
} from './api'
import {
  buildStagePackagePayload,
  createStagePackageStageDrafts,
  stagePackageOptions,
  type StagePackageStageDraft,
} from './stage-packages'
import {
  buildStagePresetDraft,
  stagePresetOptions,
  type StagePresetCode,
} from './stage-presets'
import { formatState, getErrorMessage } from '../../lib/format'

const codePattern = /^[A-Z0-9_]+$/
const stageTypeOptions: CompetitionStageSummary['stageType'][] = [
  'qualifier',
  'league',
  'quarter_final',
  'semi_final',
  'final',
  'custom',
]

function formatPlanStatus(status: CompetitionStagePackagePlan['planStatus']) {
  if (status === 'submitted') return 'decision ready'
  if (status === 'rejected') return 'returned'
  return formatState(status)
}

type TeamDraft = {
  teamCode: string
  teamName: string
  sourceTemplateId?: string
  storeIds: string[]
}

type TemplateDraft = {
  templateCode: string
  templateName: string
  description: string
  storeIds: string[]
}

type TemplateEditDraft = TemplateDraft & {
  templateId: string
}

type TemplateCloneDraft = Omit<TemplateDraft, 'storeIds'> & {
  sourceTemplateId: string
}

type StageDraft = {
  stagePresetCode?: StagePresetCode
  stageCode: string
  stageName: string
  stageOrder: string
  stageType: CompetitionStageSummary['stageType']
  startsOn: string
  endsOn: string
  teams: TeamDraft[]
}

type StagePackageDraft = {
  packageCode: CompetitionStagePackageCode
  planName: string
  firstTemplateId: string
  secondTemplateId: string
  stageDrafts: StagePackageStageDraft[]
}

type StagePackagePlanEditStageDraft = StagePackageStageDraft & {
  teams: CreateCompetitionStagePayload['teams']
}

type StagePackagePlanEditDraft = {
  planId: string
  packageCode: CompetitionStagePackageCode
  planName: string
  stageDrafts: StagePackagePlanEditStageDraft[]
}

type StageBuilderFormProps = {
  competitionId: string
  competitionStartsOn: string
  competitionEndsOn: string
  onCreated: () => void | Promise<void>
}

function normalizeCode(value: string) {
  return value.toUpperCase().replaceAll(/[^A-Z0-9_]/g, '_')
}

function createInitialDraft(input: { startsOn: string; endsOn: string }): StageDraft {
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

function createInitialStagePackageDraft(input: {
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

function createStagePackagePlanEditDraft(
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

function createInitialTemplateDraft(): TemplateDraft {
  return {
    templateCode: '',
    templateName: '',
    description: '',
    storeIds: [],
  }
}

function createTemplateEditDraft(template: CompetitionTeamTemplate): TemplateEditDraft {
  return {
    templateId: template.templateId,
    templateCode: template.templateCode,
    templateName: template.templateName,
    description: template.description ?? '',
    storeIds: template.stores.map((store) => store.storeId),
  }
}

function createTemplateCloneDraft(template: CompetitionTeamTemplate): TemplateCloneDraft {
  return {
    sourceTemplateId: template.templateId,
    templateCode: normalizeCode(`${template.templateCode}_COPY`),
    templateName: `${template.templateName} Copy`,
    description: template.description ?? '',
  }
}

function storeLabel(store: AuthLookupStore) {
  return `${store.storeCode} - ${store.storeName} - ${store.regionName}`
}

function validateDraft(draft: StageDraft) {
  const stageOrder = Number(draft.stageOrder)

  if (!draft.stageCode.trim() || !codePattern.test(draft.stageCode)) {
    return 'Stage code must use uppercase letters, numbers, and underscores.'
  }

  if (!draft.stageName.trim()) {
    return 'Stage name is required.'
  }

  if (!Number.isInteger(stageOrder) || stageOrder < 1) {
    return 'Stage order must be 1 or higher.'
  }

  if (!draft.startsOn || !draft.endsOn || draft.endsOn < draft.startsOn) {
    return 'Stage date range must be valid.'
  }

  if (draft.teams.length < 2) {
    return 'At least two teams are required.'
  }

  const invalidTeam = draft.teams.find(
    (team) =>
      !team.teamCode.trim() ||
      !codePattern.test(team.teamCode) ||
      !team.teamName.trim() ||
      team.storeIds.length === 0,
  )

  if (invalidTeam) {
    return 'Every team needs a valid code, name, and at least one store.'
  }

  return null
}

function validateStagePackageDraft(
  draft: StagePackageDraft,
  templates: CompetitionTeamTemplate[],
) {
  if (!draft.packageCode) {
    return 'Stage package is required.'
  }

  if (!draft.firstTemplateId || !draft.secondTemplateId) {
    return 'Stage package needs two active team templates.'
  }

  if (draft.firstTemplateId === draft.secondTemplateId) {
    return 'Stage package team templates must be different.'
  }

  const selectedTemplates = templates.filter((template) =>
    [draft.firstTemplateId, draft.secondTemplateId].includes(template.templateId),
  )

  if (selectedTemplates.length !== 2) {
    return 'Stage package templates must be active.'
  }

  if (selectedTemplates.some((template) => template.stores.length === 0)) {
    return 'Stage package templates need at least one store.'
  }

  if (draft.stageDrafts.length < 2) {
    return 'Stage package needs at least two stage drafts.'
  }

  const stageCodes = draft.stageDrafts.map((stage) => stage.stageCode.trim())
  if (new Set(stageCodes).size !== stageCodes.length) {
    return 'Stage package stage codes must be unique.'
  }

  const invalidStage = draft.stageDrafts.find((stage) => {
    const stageOrder = Number(stage.stageOrder)

    return (
      !stage.stageCode.trim() ||
      !codePattern.test(stage.stageCode) ||
      !stage.stageName.trim() ||
      !Number.isInteger(stageOrder) ||
      stageOrder < 1 ||
      !stage.startsOn ||
      !stage.endsOn ||
      stage.endsOn < stage.startsOn
    )
  })

  if (invalidStage) {
    return 'Every package stage needs a valid code, name, order, and date range.'
  }

  return null
}

function validateStagePackagePlanDraft(
  draft: StagePackageDraft,
  templates: CompetitionTeamTemplate[],
) {
  const packageValidation = validateStagePackageDraft(draft, templates)
  if (packageValidation) return packageValidation

  if (!draft.planName.trim()) {
    return 'Package plan name is required.'
  }

  return null
}

function validateStagePackagePlanEditDraft(draft: StagePackagePlanEditDraft) {
  if (!draft.planName.trim()) {
    return 'Package plan name is required.'
  }

  if (draft.stageDrafts.length < 2) {
    return 'Stage package needs at least two stage drafts.'
  }

  const stageCodes = draft.stageDrafts.map((stage) => stage.stageCode.trim())
  if (new Set(stageCodes).size !== stageCodes.length) {
    return 'Stage package stage codes must be unique.'
  }

  const invalidStage = draft.stageDrafts.find((stage) => {
    const stageOrder = Number(stage.stageOrder)

    return (
      !stage.stageCode.trim() ||
      !codePattern.test(stage.stageCode) ||
      !stage.stageName.trim() ||
      !Number.isInteger(stageOrder) ||
      stageOrder < 1 ||
      !stage.startsOn ||
      !stage.endsOn ||
      stage.endsOn < stage.startsOn ||
      stage.teams.length < 2 ||
      stage.teams.some((team) => team.storeIds.length === 0)
    )
  })

  if (invalidStage) {
    return 'Every package stage needs valid stage fields and two teams with stores.'
  }

  return null
}

function buildStagePackagePlanUpdatePayload(
  draft: StagePackagePlanEditDraft,
): UpdateCompetitionStagePackagePlanPayload {
  return {
    packageCode: draft.packageCode,
    planName: draft.planName.trim(),
    stages: draft.stageDrafts.map((stageDraft) => ({
      stagePresetCode: stageDraft.stagePresetCode,
      stageCode: stageDraft.stageCode.trim(),
      stageName: stageDraft.stageName.trim(),
      stageOrder: Number(stageDraft.stageOrder),
      stageType: stageDraft.stageType,
      startsOn: stageDraft.startsOn,
      endsOn: stageDraft.endsOn,
      teams: stageDraft.teams,
    })),
  }
}

function formatAuditMetadata(metadata: Record<string, unknown>) {
  const planName = typeof metadata.planName === 'string' ? metadata.planName : null
  const sourcePlanName =
    typeof metadata.sourcePlanName === 'string' ? `Source: ${metadata.sourcePlanName}` : null
  const clonedPlanName =
    typeof metadata.clonedPlanName === 'string' ? `Clone: ${metadata.clonedPlanName}` : null
  const reviewNote = typeof metadata.reviewNote === 'string' ? metadata.reviewNote : null
  const stageCount = typeof metadata.stageCount === 'number' ? `${metadata.stageCount} stages` : null
  const createdStageCount = Array.isArray(metadata.createdStageIds)
    ? `${metadata.createdStageIds.length} created stages`
    : null

  return (
    [sourcePlanName, clonedPlanName, planName, reviewNote, stageCount, createdStageCount]
      .filter(Boolean)
      .join(' - ') || 'Metadata recorded'
  )
}

function validateTemplateDraft(draft: TemplateDraft) {
  if (!draft.templateCode.trim() || !codePattern.test(draft.templateCode)) {
    return 'Template code must use uppercase letters, numbers, and underscores.'
  }

  if (!draft.templateName.trim()) {
    return 'Template name is required.'
  }

  if (draft.storeIds.length === 0) {
    return 'Template needs at least one store.'
  }

  return null
}

function validateTemplateCloneDraft(draft: TemplateCloneDraft) {
  if (!draft.templateCode.trim() || !codePattern.test(draft.templateCode)) {
    return 'Template code must use uppercase letters, numbers, and underscores.'
  }

  if (!draft.templateName.trim()) {
    return 'Template name is required.'
  }

  return null
}

export function StageBuilderForm(input: StageBuilderFormProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(() =>
    createInitialDraft({ startsOn: input.competitionStartsOn, endsOn: input.competitionEndsOn }),
  )
  const [stagePackageDraft, setStagePackageDraft] = useState(() =>
    createInitialStagePackageDraft({
      startsOn: input.competitionStartsOn,
      endsOn: input.competitionEndsOn,
    }),
  )
  const [templateDraft, setTemplateDraft] = useState(createInitialTemplateDraft)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [stagePackageFeedback, setStagePackageFeedback] = useState<string | null>(null)
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null)
  const [templateLifecycleFeedback, setTemplateLifecycleFeedback] = useState<string | null>(null)
  const [showInactiveTemplates, setShowInactiveTemplates] = useState(false)
  const [stagePackageHistoryPlanId, setStagePackageHistoryPlanId] = useState<string | null>(null)

  const lookupsQuery = useQuery({
    queryKey: ['competition-stage-builder-lookups'],
    queryFn: getAuthLookups,
    staleTime: 60_000,
  })

  const stores = useMemo(
    () =>
      [...(lookupsQuery.data?.stores ?? [])].sort((left, right) =>
        storeLabel(left).localeCompare(storeLabel(right)),
      ),
    [lookupsQuery.data?.stores],
  )

  const templatesQuery = useQuery({
    queryKey: ['competition-team-templates', 'active'],
    queryFn: () => listCompetitionTeamTemplates({ activeOnly: true }),
    staleTime: 60_000,
  })

  const templateLibraryQuery = useQuery({
    queryKey: ['competition-team-templates', 'library', showInactiveTemplates],
    queryFn: () => listCompetitionTeamTemplates({ activeOnly: !showInactiveTemplates }),
    staleTime: 60_000,
  })

  const stagePackagePlansQuery = useQuery({
    queryKey: ['competition-stage-package-plans', input.competitionId],
    queryFn: () => listCompetitionStagePackagePlans(input.competitionId),
    staleTime: 60_000,
  })

  const stagePackagePlanAuditQuery = useQuery({
    queryKey: ['competition-stage-package-plan-audit', stagePackageHistoryPlanId],
    queryFn: () => listCompetitionStagePackagePlanAudit(stagePackageHistoryPlanId as string),
    enabled: Boolean(stagePackageHistoryPlanId),
    staleTime: 30_000,
  })

  const templates = useMemo(
    () =>
      [...(templatesQuery.data?.items ?? [])].sort((left, right) =>
        left.templateCode.localeCompare(right.templateCode),
      ),
    [templatesQuery.data?.items],
  )

  const validationMessage = validateDraft(draft)
  const stagePackageValidationMessage = validateStagePackageDraft(stagePackageDraft, templates)
  const stagePackagePlanValidationMessage = validateStagePackagePlanDraft(
    stagePackageDraft,
    templates,
  )
  const templateValidationMessage = validateTemplateDraft(templateDraft)

  const createMutation = useMutation({
    mutationFn: (payload: CreateCompetitionStagePayload) =>
      createCompetitionStage(input.competitionId, payload),
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      await input.onCreated()
    },
  })

  const createStagePackageMutation = useMutation({
    mutationFn: (payload: CreateCompetitionStagePackagePayload) =>
      createCompetitionStagePackage(input.competitionId, payload),
    onSuccess: async (response) => {
      setStagePackageFeedback(response.command.message)
      await input.onCreated()
    },
  })

  const createStagePackagePlanMutation = useMutation({
    mutationFn: (payload: CreateCompetitionStagePackagePlanPayload) =>
      createCompetitionStagePackagePlan(input.competitionId, payload),
    onSuccess: async (response) => {
      setStagePackageFeedback(response.command.message)
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plans', input.competitionId],
      })
    },
  })

  const updateStagePackagePlanMutation = useMutation({
    mutationFn: (request: {
      planId: string
      payload: UpdateCompetitionStagePackagePlanPayload
    }) => updateCompetitionStagePackagePlan(request.planId, request.payload),
    onSuccess: async (response) => {
      setStagePackageFeedback(response.command.message)
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plans', input.competitionId],
      })
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plan-audit', stagePackageHistoryPlanId],
      })
    },
  })

  const submitStagePackagePlanMutation = useMutation({
    mutationFn: submitCompetitionStagePackagePlan,
    onSuccess: async (response) => {
      setStagePackageFeedback(response.command.message)
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plans', input.competitionId],
      })
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plan-audit', stagePackageHistoryPlanId],
      })
    },
  })

  const approveStagePackagePlanMutation = useMutation({
    mutationFn: (request: {
      planId: string
      payload: ReviewCompetitionStagePackagePlanPayload
    }) => approveCompetitionStagePackagePlan(request.planId, request.payload),
    onSuccess: async (response) => {
      setStagePackageFeedback(response.command.message)
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plans', input.competitionId],
      })
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plan-audit', stagePackageHistoryPlanId],
      })
    },
  })

  const rejectStagePackagePlanMutation = useMutation({
    mutationFn: (request: {
      planId: string
      payload: ReviewCompetitionStagePackagePlanPayload
    }) => rejectCompetitionStagePackagePlan(request.planId, request.payload),
    onSuccess: async (response) => {
      setStagePackageFeedback(response.command.message)
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plans', input.competitionId],
      })
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plan-audit', stagePackageHistoryPlanId],
      })
    },
  })

  const cloneStagePackagePlanMutation = useMutation({
    mutationFn: cloneCompetitionStagePackagePlan,
    onSuccess: async (response) => {
      setStagePackageFeedback(response.command.message)
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plans', input.competitionId],
      })
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plan-audit', stagePackageHistoryPlanId],
      })
    },
  })

  const executeStagePackagePlanMutation = useMutation({
    mutationFn: executeCompetitionStagePackagePlan,
    onSuccess: async (response) => {
      setStagePackageFeedback(response.command.message)
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plans', input.competitionId],
      })
      await input.onCreated()
    },
  })

  const cancelStagePackagePlanMutation = useMutation({
    mutationFn: cancelCompetitionStagePackagePlan,
    onSuccess: async (response) => {
      setStagePackageFeedback(response.command.message)
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plans', input.competitionId],
      })
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plan-audit', stagePackageHistoryPlanId],
      })
    },
  })

  const createTemplateMutation = useMutation({
    mutationFn: (payload: CreateCompetitionTeamTemplatePayload) =>
      createCompetitionTeamTemplate(payload),
    onSuccess: async (response) => {
      setTemplateFeedback(response.command.message)
      setTemplateDraft(createInitialTemplateDraft())
      await queryClient.invalidateQueries({ queryKey: ['competition-team-templates'] })
    },
  })

  const deactivateTemplateMutation = useMutation({
    mutationFn: deactivateCompetitionTeamTemplate,
    onSuccess: async (response) => {
      setTemplateLifecycleFeedback(response.command.message)
      await queryClient.invalidateQueries({ queryKey: ['competition-team-templates'] })
    },
  })

  const updateTemplateMutation = useMutation({
    mutationFn: (request: {
      templateId: string
      payload: UpdateCompetitionTeamTemplatePayload
    }) => updateCompetitionTeamTemplate(request.templateId, request.payload),
    onSuccess: async (response) => {
      setTemplateLifecycleFeedback(response.command.message)
      await queryClient.invalidateQueries({ queryKey: ['competition-team-templates'] })
    },
  })

  const cloneTemplateMutation = useMutation({
    mutationFn: (request: {
      templateId: string
      payload: CloneCompetitionTeamTemplatePayload
    }) => cloneCompetitionTeamTemplate(request.templateId, request.payload),
    onSuccess: async (response) => {
      setTemplateLifecycleFeedback(response.command.message)
      await queryClient.invalidateQueries({ queryKey: ['competition-team-templates'] })
    },
  })

  function updateDraft(field: keyof Omit<StageDraft, 'teams'>, value: string) {
    setFeedback(null)
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function applyStagePreset(presetCode: string) {
    setFeedback(null)

    if (!presetCode) {
      setDraft((current) => ({ ...current, stagePresetCode: undefined }))
      return
    }

    const presetDraft = buildStagePresetDraft({
      competitionStartsOn: input.competitionStartsOn,
      competitionEndsOn: input.competitionEndsOn,
      presetCode: presetCode as StagePresetCode,
    })

    if (!presetDraft) return

    setDraft((current) => ({
      ...current,
      ...presetDraft,
    }))
  }

  function updateStagePackageDraft(field: keyof StagePackageDraft, value: string) {
    setStagePackageFeedback(null)
    setStagePackageDraft((current) => {
      if (field === 'packageCode') {
        const packageCode = value as CompetitionStagePackageCode

        return {
          ...current,
          packageCode,
          stageDrafts: createStagePackageStageDrafts({
            competitionStartsOn: input.competitionStartsOn,
            competitionEndsOn: input.competitionEndsOn,
            packageCode,
          }),
        }
      }

      return { ...current, [field]: value }
    })
  }

  function updateStagePackageStage(
    stageIndex: number,
    field: keyof StagePackageStageDraft,
    value: string,
  ) {
    setStagePackageFeedback(null)
    setStagePackageDraft((current) => ({
      ...current,
      stageDrafts: current.stageDrafts.map((stage, currentIndex) =>
        currentIndex === stageIndex ? { ...stage, [field]: value } : stage,
      ),
    }))
  }

  function getSelectedStagePackageTemplates() {
    return [
      templates.find((template) => template.templateId === stagePackageDraft.firstTemplateId),
      templates.find((template) => template.templateId === stagePackageDraft.secondTemplateId),
    ].filter((template): template is CompetitionTeamTemplate => Boolean(template))
  }

  function updateTeam(index: number, patch: Partial<TeamDraft>) {
    setFeedback(null)
    setDraft((current) => ({
      ...current,
      teams: current.teams.map((team, teamIndex) =>
        teamIndex === index ? { ...team, ...patch } : team,
      ),
    }))
  }

  function updateTemplateDraft(field: keyof Omit<TemplateDraft, 'storeIds'>, value: string) {
    setTemplateFeedback(null)
    setTemplateDraft((current) => ({ ...current, [field]: value }))
  }

  function toggleStore(teamIndex: number, storeId: string) {
    const team = draft.teams[teamIndex]
    const nextStoreIds = team.storeIds.includes(storeId)
      ? team.storeIds.filter((currentStoreId) => currentStoreId !== storeId)
      : [...team.storeIds, storeId]

    updateTeam(teamIndex, { storeIds: nextStoreIds })
  }

  function toggleTemplateStore(storeId: string) {
    setTemplateFeedback(null)
    setTemplateDraft((current) => ({
      ...current,
      storeIds: current.storeIds.includes(storeId)
        ? current.storeIds.filter((currentStoreId) => currentStoreId !== storeId)
        : [...current.storeIds, storeId],
    }))
  }

  function applyTemplate(teamIndex: number, templateId: string) {
    const template = templates.find((item) => item.templateId === templateId)

    if (!template) {
      updateTeam(teamIndex, { sourceTemplateId: undefined })
      return
    }

    updateTeam(teamIndex, {
      sourceTemplateId: template.templateId,
      teamCode: normalizeCode(template.templateCode),
      teamName: template.templateName,
      storeIds: template.stores.map((store) => store.storeId),
    })
  }

  function buildPayload(): CreateCompetitionStagePayload {
    return {
      ...(draft.stagePresetCode ? { stagePresetCode: draft.stagePresetCode } : {}),
      stageCode: draft.stageCode.trim(),
      stageName: draft.stageName.trim(),
      stageOrder: Number(draft.stageOrder),
      stageType: draft.stageType,
      startsOn: draft.startsOn,
      endsOn: draft.endsOn,
      teams: draft.teams.map((team) => {
        const teamPayload = {
          teamCode: team.teamCode.trim(),
          teamName: team.teamName.trim(),
          storeIds: team.storeIds,
        }

        return team.sourceTemplateId
          ? { ...teamPayload, sourceTemplateId: team.sourceTemplateId }
          : teamPayload
      }),
    }
  }

  function buildTemplatePayload(): CreateCompetitionTeamTemplatePayload {
    return {
      templateCode: templateDraft.templateCode.trim(),
      templateName: templateDraft.templateName.trim(),
      description: templateDraft.description.trim() || undefined,
      storeIds: templateDraft.storeIds,
    }
  }

  function submitStage() {
    const nextValidation = validateDraft(draft)
    if (nextValidation) return
    createMutation.mutate(buildPayload())
  }

  function submitTemplate() {
    const nextValidation = validateTemplateDraft(templateDraft)
    if (nextValidation) return
    createTemplateMutation.mutate(buildTemplatePayload())
  }

  function buildStagePackagePayloadFromDraft() {
    return buildStagePackagePayload({
      packageCode: stagePackageDraft.packageCode,
      stageDrafts: stagePackageDraft.stageDrafts,
      templates: getSelectedStagePackageTemplates(),
    })
  }

  function submitStagePackage() {
    const nextValidation = validateStagePackageDraft(stagePackageDraft, templates)
    if (nextValidation) return

    const payload = buildStagePackagePayloadFromDraft()

    if (!payload) return

    createStagePackageMutation.mutate(payload)
  }

  function submitStagePackagePlan() {
    const nextValidation = validateStagePackagePlanDraft(stagePackageDraft, templates)
    if (nextValidation) return

    const payload = buildStagePackagePayloadFromDraft()

    if (!payload) return

    createStagePackagePlanMutation.mutate({
      ...payload,
      planName: stagePackageDraft.planName.trim(),
    })
  }

  return (
    <section className="stacked-table" aria-label="Competition stage builder">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Stage Builder</div>
          <h3>Create stage</h3>
        </div>
        <StatusPill tone={validationMessage ? 'warning' : 'calm'}>
          {validationMessage ? 'Draft incomplete' : 'Ready'}
        </StatusPill>
      </div>

      <article className="stacked-row">
        <div className="form-grid">
          <label className="field-block">
            <span>Stage preset</span>
            <select
              value={draft.stagePresetCode ?? ''}
              onChange={(event) => applyStagePreset(event.target.value)}
            >
              <option value="">Manual stage</option>
              {stagePresetOptions.map((preset) => (
                <option key={preset.code} value={preset.code}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block">
            <span>Stage code</span>
            <input
              value={draft.stageCode}
              onChange={(event) => updateDraft('stageCode', normalizeCode(event.target.value))}
            />
          </label>
          <label className="field-block">
            <span>Stage name</span>
            <input
              value={draft.stageName}
              onChange={(event) => updateDraft('stageName', event.target.value)}
            />
          </label>
          <label className="field-block">
            <span>Stage order</span>
            <input
              min="1"
              type="number"
              value={draft.stageOrder}
              onChange={(event) => updateDraft('stageOrder', event.target.value)}
            />
          </label>
          <label className="field-block">
            <span>Stage type</span>
            <select
              value={draft.stageType}
              onChange={(event) =>
                updateDraft('stageType', event.target.value as CompetitionStageSummary['stageType'])
              }
            >
              {stageTypeOptions.map((stageType) => (
                <option key={stageType} value={stageType}>
                  {formatState(stageType)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block">
            <span>Stage starts</span>
            <input
              type="date"
              value={draft.startsOn}
              onChange={(event) => updateDraft('startsOn', event.target.value)}
            />
          </label>
          <label className="field-block">
            <span>Stage ends</span>
            <input
              type="date"
              value={draft.endsOn}
              onChange={(event) => updateDraft('endsOn', event.target.value)}
            />
          </label>
        </div>
      </article>

      {lookupsQuery.isLoading ? (
        <ScreenState title="Stores are loading" copy="Store options are loading for team assignment." />
      ) : null}

      {lookupsQuery.isError ? (
        <ScreenState
          title="Store options could not load"
          copy={getErrorMessage(lookupsQuery.error)}
          tone="error"
        />
      ) : null}

      {!lookupsQuery.isLoading && stores.length === 0 ? (
        <EmptyState title="No stores available" copy="Stage teams need at least one store." />
      ) : null}

      <TemplateBuilderSection
        draft={templateDraft}
        error={createTemplateMutation.error}
        feedback={templateFeedback}
        isPending={createTemplateMutation.isPending}
        stores={stores}
        validationMessage={templateValidationMessage}
        onSubmit={submitTemplate}
        onToggleStore={toggleTemplateStore}
        onUpdate={updateTemplateDraft}
      />

      <TemplateLibrarySection
        error={
          templateLibraryQuery.error ??
          deactivateTemplateMutation.error ??
          updateTemplateMutation.error ??
          cloneTemplateMutation.error
        }
        feedback={templateLifecycleFeedback}
        isLoading={templateLibraryQuery.isLoading}
        isPending={
          deactivateTemplateMutation.isPending ||
          updateTemplateMutation.isPending ||
          cloneTemplateMutation.isPending
        }
        showInactive={showInactiveTemplates}
        stores={stores}
        templates={templateLibraryQuery.data?.items ?? []}
        onClone={(templateId, payload) =>
          cloneTemplateMutation.mutate({ templateId, payload })
        }
        onDeactivate={(templateId) => deactivateTemplateMutation.mutate(templateId)}
        onShowInactiveChange={setShowInactiveTemplates}
        onUpdate={(templateId, payload) =>
          updateTemplateMutation.mutate({ templateId, payload })
        }
      />

      {templatesQuery.isError ? (
        <ScreenState
          title="Team templates could not load"
          copy={getErrorMessage(templatesQuery.error)}
          tone="error"
        />
      ) : null}

      <StagePackageBuilderSection
        draft={stagePackageDraft}
        error={
          stagePackagePlansQuery.error ??
          stagePackagePlanAuditQuery.error ??
          createStagePackageMutation.error ??
          createStagePackagePlanMutation.error ??
          updateStagePackagePlanMutation.error ??
          submitStagePackagePlanMutation.error ??
          approveStagePackagePlanMutation.error ??
          rejectStagePackagePlanMutation.error ??
          cloneStagePackagePlanMutation.error ??
          cancelStagePackagePlanMutation.error ??
          executeStagePackagePlanMutation.error
        }
        auditEvents={stagePackagePlanAuditQuery.data?.items ?? []}
        feedback={stagePackageFeedback}
        historyPlanId={stagePackageHistoryPlanId}
        isLoadingAudit={stagePackagePlanAuditQuery.isLoading}
        isLoadingPlans={stagePackagePlansQuery.isLoading}
        isPending={
          createStagePackageMutation.isPending ||
          createStagePackagePlanMutation.isPending ||
          updateStagePackagePlanMutation.isPending ||
          submitStagePackagePlanMutation.isPending ||
          approveStagePackagePlanMutation.isPending ||
          rejectStagePackagePlanMutation.isPending ||
          cloneStagePackagePlanMutation.isPending ||
          cancelStagePackagePlanMutation.isPending ||
          executeStagePackagePlanMutation.isPending
        }
        plans={stagePackagePlansQuery.data?.items ?? []}
        templates={templates}
        planValidationMessage={stagePackagePlanValidationMessage}
        validationMessage={stagePackageValidationMessage}
        onApprovePlan={(planId, payload) =>
          approveStagePackagePlanMutation.mutate({ planId, payload })
        }
        onCancelPlan={(planId) => cancelStagePackagePlanMutation.mutate(planId)}
        onClonePlan={(planId) => cloneStagePackagePlanMutation.mutate(planId)}
        onExecutePlan={(planId) => executeStagePackagePlanMutation.mutate(planId)}
        onRejectPlan={(planId, payload) =>
          rejectStagePackagePlanMutation.mutate({ planId, payload })
        }
        onSavePlan={submitStagePackagePlan}
        onShowPlanHistory={(planId) => setStagePackageHistoryPlanId(planId)}
        onSubmit={submitStagePackage}
        onSubmitPlan={(planId) => submitStagePackagePlanMutation.mutate(planId)}
        onUpdatePlan={(planId, payload) =>
          updateStagePackagePlanMutation.mutate({ planId, payload })
        }
        onUpdateStage={updateStagePackageStage}
        onUpdate={updateStagePackageDraft}
      />

      {draft.teams.map((team, teamIndex) => (
        <article className="stacked-row stage-builder-team" key={teamIndex}>
          <div className="stacked-row-head">
            <strong>{`Team ${teamIndex + 1}`}</strong>
            <StatusPill tone={team.storeIds.length > 0 ? 'accent' : 'warning'}>
              {`${team.storeIds.length} stores`}
            </StatusPill>
          </div>
          <div className="form-grid">
            <label className="field-block">
              <span>{`Team ${teamIndex + 1} template`}</span>
              <select
                value={team.sourceTemplateId ?? ''}
                onChange={(event) => applyTemplate(teamIndex, event.target.value)}
              >
                <option value="">Manual team</option>
                {templates.map((template) => (
                  <option key={template.templateId} value={template.templateId}>
                    {template.templateCode} - {template.templateName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>{`Team ${teamIndex + 1} code`}</span>
              <input
                value={team.teamCode}
                onChange={(event) =>
                  updateTeam(teamIndex, { teamCode: normalizeCode(event.target.value) })
                }
              />
            </label>
            <label className="field-block">
              <span>{`Team ${teamIndex + 1} name`}</span>
              <input
                value={team.teamName}
                onChange={(event) => updateTeam(teamIndex, { teamName: event.target.value })}
              />
            </label>
          </div>
          <div className="store-checkbox-grid">
            {stores.map((store) => (
              <label className="store-checkbox" key={`${teamIndex}-${store.storeId}`}>
                <input
                  type="checkbox"
                  checked={team.storeIds.includes(store.storeId)}
                  onChange={() => toggleStore(teamIndex, store.storeId)}
                />
                <span>{storeLabel(store)}</span>
              </label>
            ))}
          </div>
        </article>
      ))}

      {validationMessage ? <p className="validation-copy">{validationMessage}</p> : null}

      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          disabled={Boolean(validationMessage) || createMutation.isPending || stores.length === 0}
          onClick={submitStage}
        >
          <PlusCircle size={16} />
          Create stage
        </button>
        <StatusPill tone="neutral">{`${draft.teams.length} teams`}</StatusPill>
      </div>

      {feedback ? <ScreenState title={feedback} copy="Stage detail is refreshed." /> : null}

      {createMutation.isError ? (
        <ScreenState
          title="Stage could not be created"
          copy={getErrorMessage(createMutation.error)}
          tone="error"
        />
      ) : null}
    </section>
  )
}

function StagePackageBuilderSection(input: {
  auditEvents: CompetitionStagePackagePlanAuditEvent[]
  draft: StagePackageDraft
  error: unknown
  feedback: string | null
  historyPlanId: string | null
  isLoadingAudit: boolean
  isLoadingPlans: boolean
  isPending: boolean
  plans: CompetitionStagePackagePlan[]
  templates: CompetitionTeamTemplate[]
  planValidationMessage: string | null
  validationMessage: string | null
  onApprovePlan: (planId: string, payload: ReviewCompetitionStagePackagePlanPayload) => void
  onCancelPlan: (planId: string) => void
  onClonePlan: (planId: string) => void
  onExecutePlan: (planId: string) => void
  onRejectPlan: (planId: string, payload: ReviewCompetitionStagePackagePlanPayload) => void
  onSavePlan: () => void
  onShowPlanHistory: (planId: string) => void
  onSubmit: () => void
  onSubmitPlan: (planId: string) => void
  onUpdatePlan: (planId: string, payload: UpdateCompetitionStagePackagePlanPayload) => void
  onUpdateStage: (stageIndex: number, field: keyof StagePackageStageDraft, value: string) => void
  onUpdate: (field: keyof StagePackageDraft, value: string) => void
}) {
  const [editDraft, setEditDraft] = useState<StagePackagePlanEditDraft | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const editValidationMessage = editDraft ? validateStagePackagePlanEditDraft(editDraft) : null

  function updatePlanEditDraft(field: keyof Omit<StagePackagePlanEditDraft, 'stageDrafts'>, value: string) {
    setEditDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  function updatePlanEditStage(
    stageIndex: number,
    field: keyof StagePackageStageDraft,
    value: string,
  ) {
    setEditDraft((current) =>
      current
        ? {
            ...current,
            stageDrafts: current.stageDrafts.map((stage, currentIndex) =>
              currentIndex === stageIndex ? { ...stage, [field]: value } : stage,
            ),
          }
        : current,
    )
  }

  function submitPlanEditDraft() {
    if (!editDraft || validateStagePackagePlanEditDraft(editDraft)) return

    input.onUpdatePlan(editDraft.planId, buildStagePackagePlanUpdatePayload(editDraft))
    setEditDraft(null)
  }

  function updateReviewNote(planId: string, value: string) {
    setReviewNotes((current) => ({ ...current, [planId]: value }))
  }

  function getReviewPayload(planId: string): ReviewCompetitionStagePackagePlanPayload {
    const reviewNote = reviewNotes[planId]?.trim()

    return reviewNote ? { reviewNote } : {}
  }

  return (
    <article className="stacked-row stage-package-builder">
      <div className="stacked-row-head">
        <div>
          <strong>Stage package</strong>
          <p className="queue-subtitle">Create the league and final stages from active templates.</p>
        </div>
        <StatusPill tone={input.validationMessage ? 'warning' : 'calm'}>
          {input.validationMessage ? 'Package incomplete' : 'Ready'}
        </StatusPill>
      </div>

      <div className="form-grid">
        <label className="field-block">
          <span>Stage package</span>
          <select
            value={input.draft.packageCode}
            onChange={(event) => input.onUpdate('packageCode', event.target.value)}
          >
            {stagePackageOptions.map((packageOption) => (
              <option key={packageOption.code} value={packageOption.code}>
                {packageOption.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-block">
          <span>Package plan name</span>
          <input
            value={input.draft.planName}
            onChange={(event) => input.onUpdate('planName', event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>Package team 1 template</span>
          <select
            value={input.draft.firstTemplateId}
            onChange={(event) => input.onUpdate('firstTemplateId', event.target.value)}
          >
            <option value="">Select template</option>
            {input.templates.map((template) => (
              <option key={template.templateId} value={template.templateId}>
                {template.templateCode} - {template.templateName}
              </option>
            ))}
          </select>
        </label>
        <label className="field-block">
          <span>Package team 2 template</span>
          <select
            value={input.draft.secondTemplateId}
            onChange={(event) => input.onUpdate('secondTemplateId', event.target.value)}
          >
            <option value="">Select template</option>
            {input.templates.map((template) => (
              <option key={template.templateId} value={template.templateId}>
                {template.templateCode} - {template.templateName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {input.validationMessage ? (
        <p className="validation-copy">{input.validationMessage}</p>
      ) : null}
      {!input.validationMessage && input.planValidationMessage ? (
        <p className="validation-copy">{input.planValidationMessage}</p>
      ) : null}

      <div className="stacked-table">
        {input.draft.stageDrafts.map((stageDraft, stageIndex) => (
          <article className="stacked-row stage-package-preview-stage" key={stageDraft.stagePresetCode}>
            <div className="stacked-row-head">
              <div>
                <strong>{`Package stage ${stageIndex + 1}`}</strong>
                <p className="queue-subtitle">{formatState(stageDraft.stagePresetCode)}</p>
              </div>
              <StatusPill tone="accent">{formatState(stageDraft.stageType)}</StatusPill>
            </div>
            <div className="form-grid">
              <label className="field-block">
                <span>{`Package stage ${stageIndex + 1} code`}</span>
                <input
                  value={stageDraft.stageCode}
                  onChange={(event) =>
                    input.onUpdateStage(stageIndex, 'stageCode', normalizeCode(event.target.value))
                  }
                />
              </label>
              <label className="field-block">
                <span>{`Package stage ${stageIndex + 1} name`}</span>
                <input
                  value={stageDraft.stageName}
                  onChange={(event) =>
                    input.onUpdateStage(stageIndex, 'stageName', event.target.value)
                  }
                />
              </label>
              <label className="field-block">
                <span>{`Package stage ${stageIndex + 1} order`}</span>
                <input
                  min="1"
                  type="number"
                  value={stageDraft.stageOrder}
                  onChange={(event) =>
                    input.onUpdateStage(stageIndex, 'stageOrder', event.target.value)
                  }
                />
              </label>
              <label className="field-block">
                <span>{`Package stage ${stageIndex + 1} type`}</span>
                <select
                  value={stageDraft.stageType}
                  onChange={(event) =>
                    input.onUpdateStage(stageIndex, 'stageType', event.target.value)
                  }
                >
                  {stageTypeOptions.map((stageType) => (
                    <option key={stageType} value={stageType}>
                      {formatState(stageType)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-block">
                <span>{`Package stage ${stageIndex + 1} starts`}</span>
                <input
                  type="date"
                  value={stageDraft.startsOn}
                  onChange={(event) =>
                    input.onUpdateStage(stageIndex, 'startsOn', event.target.value)
                  }
                />
              </label>
              <label className="field-block">
                <span>{`Package stage ${stageIndex + 1} ends`}</span>
                <input
                  type="date"
                  value={stageDraft.endsOn}
                  onChange={(event) =>
                    input.onUpdateStage(stageIndex, 'endsOn', event.target.value)
                  }
                />
              </label>
            </div>
          </article>
        ))}
      </div>

      <div className="action-cluster">
        <button
          className="ghost-button"
          type="button"
          disabled={Boolean(input.planValidationMessage) || input.isPending}
          onClick={input.onSavePlan}
        >
          Save package plan
        </button>
        <button
          className="control-button"
          type="button"
          disabled={Boolean(input.validationMessage) || input.isPending}
          onClick={input.onSubmit}
        >
          <PlusCircle size={16} />
          Create stage package
        </button>
        <StatusPill tone="neutral">2 stages</StatusPill>
      </div>

      <article className="stacked-row stage-package-plan-library">
        <div className="stacked-row-head">
          <div>
            <strong>Package plan library</strong>
            <p className="queue-subtitle">Drafts are locked as decision-ready before execution.</p>
          </div>
          <StatusPill tone="neutral">{`${input.plans.length} plans`}</StatusPill>
        </div>

        {input.isLoadingPlans ? (
          <ScreenState title="Package plans are loading" copy="Saved package plans are loading." />
        ) : null}

        {!input.isLoadingPlans && input.plans.length === 0 ? (
          <EmptyState title="No package plans" copy="Saved package plans appear here." />
        ) : null}

        {input.plans.length > 0 ? (
          <div className="stacked-table">
            {input.plans.map((plan) => (
              <article className="stacked-row" key={plan.planId}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{plan.planName}</strong>
                    <p className="queue-subtitle">
                      {[
                        formatState(plan.packageCode),
                        plan.sourcePlan ? `Cloned from ${plan.sourcePlan.planName}` : null,
                      ]
                        .filter(Boolean)
                        .join(' - ')}
                    </p>
                  </div>
                  <StatusPill
                    tone={
                      plan.planStatus === 'draft'
                        ? 'warning'
                        : plan.planStatus === 'submitted'
                          ? 'accent'
                          : plan.planStatus === 'approved'
                            ? 'calm'
                            : 'neutral'
                    }
                  >
                    {formatPlanStatus(plan.planStatus)}
                  </StatusPill>
                </div>
                <div className="key-grid">
                  <div className="key-item">
                    <span>Stages</span>
                    <strong>{String(plan.stageDrafts.length)}</strong>
                  </div>
                  <div className="key-item">
                    <span>Created stages</span>
                    <strong>{String(plan.createdStageIds.length)}</strong>
                  </div>
                  <div className="key-item">
                    <span>Updated</span>
                    <strong>{plan.updatedAt.slice(0, 10)}</strong>
                  </div>
                </div>
                {editDraft?.planId === plan.planId ? (
                  <div className="stacked-row">
                    <div className="form-grid">
                      <label className="field-block">
                        <span>Edit plan name</span>
                        <input
                          value={editDraft.planName}
                          onChange={(event) => updatePlanEditDraft('planName', event.target.value)}
                        />
                      </label>
                      <label className="field-block">
                        <span>Edit stage package</span>
                        <select
                          value={editDraft.packageCode}
                          onChange={(event) =>
                            updatePlanEditDraft(
                              'packageCode',
                              event.target.value as CompetitionStagePackageCode,
                            )
                          }
                        >
                          {stagePackageOptions.map((packageOption) => (
                            <option key={packageOption.code} value={packageOption.code}>
                              {packageOption.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="stacked-table">
                      {editDraft.stageDrafts.map((stageDraft, stageIndex) => (
                        <article
                          className="stacked-row stage-package-preview-stage"
                          key={`edit-${plan.planId}-${stageDraft.stagePresetCode}`}
                        >
                          <div className="stacked-row-head">
                            <div>
                              <strong>{`Edit package stage ${stageIndex + 1}`}</strong>
                              <p className="queue-subtitle">
                                {formatState(stageDraft.stagePresetCode)}
                              </p>
                            </div>
                            <StatusPill tone="accent">{formatState(stageDraft.stageType)}</StatusPill>
                          </div>
                          <div className="form-grid">
                            <label className="field-block">
                              <span>{`Edit package stage ${stageIndex + 1} code`}</span>
                              <input
                                value={stageDraft.stageCode}
                                onChange={(event) =>
                                  updatePlanEditStage(
                                    stageIndex,
                                    'stageCode',
                                    normalizeCode(event.target.value),
                                  )
                                }
                              />
                            </label>
                            <label className="field-block">
                              <span>{`Edit package stage ${stageIndex + 1} name`}</span>
                              <input
                                value={stageDraft.stageName}
                                onChange={(event) =>
                                  updatePlanEditStage(stageIndex, 'stageName', event.target.value)
                                }
                              />
                            </label>
                            <label className="field-block">
                              <span>{`Edit package stage ${stageIndex + 1} order`}</span>
                              <input
                                min="1"
                                type="number"
                                value={stageDraft.stageOrder}
                                onChange={(event) =>
                                  updatePlanEditStage(stageIndex, 'stageOrder', event.target.value)
                                }
                              />
                            </label>
                            <label className="field-block">
                              <span>{`Edit package stage ${stageIndex + 1} type`}</span>
                              <select
                                value={stageDraft.stageType}
                                onChange={(event) =>
                                  updatePlanEditStage(stageIndex, 'stageType', event.target.value)
                                }
                              >
                                {stageTypeOptions.map((stageType) => (
                                  <option key={stageType} value={stageType}>
                                    {formatState(stageType)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field-block">
                              <span>{`Edit package stage ${stageIndex + 1} starts`}</span>
                              <input
                                type="date"
                                value={stageDraft.startsOn}
                                onChange={(event) =>
                                  updatePlanEditStage(stageIndex, 'startsOn', event.target.value)
                                }
                              />
                            </label>
                            <label className="field-block">
                              <span>{`Edit package stage ${stageIndex + 1} ends`}</span>
                              <input
                                type="date"
                                value={stageDraft.endsOn}
                                onChange={(event) =>
                                  updatePlanEditStage(stageIndex, 'endsOn', event.target.value)
                                }
                              />
                            </label>
                          </div>
                        </article>
                      ))}
                    </div>
                    {editValidationMessage ? (
                      <p className="validation-copy">{editValidationMessage}</p>
                    ) : null}
                    <div className="action-cluster">
                      <button
                        className="control-button"
                        type="button"
                        disabled={Boolean(editValidationMessage) || input.isPending}
                        onClick={submitPlanEditDraft}
                      >
                        Save package plan changes
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setEditDraft(null)}
                      >
                        Cancel edit
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="action-cluster">
                  {plan.planStatus === 'draft' ? (
                    <>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={input.isPending}
                        onClick={() => setEditDraft(createStagePackagePlanEditDraft(plan))}
                      >
                        Edit {plan.planName}
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={input.isPending}
                        onClick={() => input.onCancelPlan(plan.planId)}
                      >
                        Cancel {plan.planName}
                      </button>
                      <button
                        className="control-button"
                        type="button"
                        disabled={input.isPending}
                        onClick={() => input.onSubmitPlan(plan.planId)}
                      >
                        Mark ready for decision {plan.planName}
                      </button>
                    </>
                  ) : null}
                  {plan.planStatus === 'approved' ? (
                    <button
                      className="control-button"
                      type="button"
                      disabled={input.isPending}
                      onClick={() => input.onExecutePlan(plan.planId)}
                    >
                      Execute approved plan {plan.planName}
                    </button>
                  ) : null}
                  {plan.planStatus === 'rejected' ? (
                    <button
                      className="control-button"
                      type="button"
                      disabled={input.isPending}
                      onClick={() => input.onClonePlan(plan.planId)}
                    >
                      Clone as new draft {plan.planName}
                    </button>
                  ) : null}
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={input.isPending}
                    onClick={() => input.onShowPlanHistory(plan.planId)}
                  >
                    Show history {plan.planName}
                  </button>
                </div>

                {plan.planStatus === 'submitted' ? (
                  <div className="stacked-row">
                    <label className="field-block field-block-full">
                      <span>{`Decision note for ${plan.planName}`}</span>
                      <input
                        value={reviewNotes[plan.planId] ?? ''}
                        onChange={(event) => updateReviewNote(plan.planId, event.target.value)}
                      />
                    </label>
                    <div className="action-cluster">
                      <button
                        className="control-button"
                        type="button"
                        disabled={input.isPending}
                        onClick={() => input.onApprovePlan(plan.planId, getReviewPayload(plan.planId))}
                      >
                        Approve decision {plan.planName}
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={input.isPending}
                        onClick={() => input.onRejectPlan(plan.planId, getReviewPayload(plan.planId))}
                      >
                        Return for revision {plan.planName}
                      </button>
                    </div>
                  </div>
                ) : null}

                {input.historyPlanId === plan.planId ? (
                  <div className="action-cluster">
                    {input.isLoadingAudit ? (
                      <ScreenState title="Plan history is loading" copy="Audit events are loading." />
                    ) : null}
                    {!input.isLoadingAudit && input.auditEvents.length === 0 ? (
                      <EmptyState title="No plan history" copy="Audit events appear here." />
                    ) : null}
                    {!input.isLoadingAudit && input.auditEvents.length > 0 ? (
                      <div className="stacked-table">
                        {input.auditEvents.map((event) => (
                          <article className="stacked-row" key={event.eventLogId}>
                            <div className="stacked-row-head">
                              <div>
                                <strong>{event.eventType}</strong>
                                <p className="queue-subtitle">
                                  {formatAuditMetadata(event.metadata)}
                                </p>
                              </div>
                              <StatusPill tone="neutral">{event.occurredAt.slice(0, 10)}</StatusPill>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </article>

      {input.feedback ? (
        <ScreenState title={input.feedback} copy="Competition detail is refreshed." />
      ) : null}

      {input.error ? (
        <ScreenState
          title="Stage package action failed"
          copy={getErrorMessage(input.error)}
          tone="error"
        />
      ) : null}
    </article>
  )
}

function TemplateLibrarySection(input: {
  error: unknown
  feedback: string | null
  isLoading: boolean
  isPending: boolean
  showInactive: boolean
  stores: AuthLookupStore[]
  templates: CompetitionTeamTemplate[]
  onClone: (templateId: string, payload: CloneCompetitionTeamTemplatePayload) => void
  onDeactivate: (templateId: string) => void
  onShowInactiveChange: (value: boolean) => void
  onUpdate: (templateId: string, payload: UpdateCompetitionTeamTemplatePayload) => void
}) {
  const [editDraft, setEditDraft] = useState<TemplateEditDraft | null>(null)
  const [cloneDraft, setCloneDraft] = useState<TemplateCloneDraft | null>(null)
  const editValidationMessage = editDraft ? validateTemplateDraft(editDraft) : null
  const cloneValidationMessage = cloneDraft ? validateTemplateCloneDraft(cloneDraft) : null

  function updateEditDraft(field: keyof Omit<TemplateDraft, 'storeIds'>, value: string) {
    setEditDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  function toggleEditStore(storeId: string) {
    setEditDraft((current) => {
      if (!current) return current

      return {
        ...current,
        storeIds: current.storeIds.includes(storeId)
          ? current.storeIds.filter((currentStoreId) => currentStoreId !== storeId)
          : [...current.storeIds, storeId],
      }
    })
  }

  function submitEditDraft() {
    if (!editDraft || validateTemplateDraft(editDraft)) return

    input.onUpdate(editDraft.templateId, {
      templateCode: editDraft.templateCode.trim(),
      templateName: editDraft.templateName.trim(),
      description: editDraft.description.trim() || undefined,
      storeIds: editDraft.storeIds,
    })
    setEditDraft(null)
  }

  function updateCloneDraft(field: keyof Omit<TemplateCloneDraft, 'sourceTemplateId'>, value: string) {
    setCloneDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  function submitCloneDraft() {
    if (!cloneDraft || validateTemplateCloneDraft(cloneDraft)) return

    input.onClone(cloneDraft.sourceTemplateId, {
      templateCode: cloneDraft.templateCode.trim(),
      templateName: cloneDraft.templateName.trim(),
      description: cloneDraft.description.trim() || undefined,
    })
    setCloneDraft(null)
  }

  return (
    <article className="stacked-row stage-template-library">
      <div className="stacked-row-head">
        <div>
          <strong>Template library</strong>
          <p className="queue-subtitle">Active templates feed stage team selection.</p>
        </div>
        <StatusPill tone={input.showInactive ? 'accent' : 'neutral'}>
          {input.showInactive ? 'All templates' : 'Active only'}
        </StatusPill>
      </div>
      <label className="store-checkbox template-toggle">
        <input
          type="checkbox"
          checked={input.showInactive}
          onChange={(event) => input.onShowInactiveChange(event.target.checked)}
        />
        <span>Show inactive templates</span>
      </label>

      {input.isLoading ? (
        <ScreenState title="Templates are loading" copy="Reusable team templates are loading." />
      ) : null}

      {!input.isLoading && input.templates.length === 0 ? (
        <EmptyState title="No templates" copy="Created templates appear in this library." />
      ) : null}

      {input.templates.length > 0 ? (
        <div className="stacked-table">
          {input.templates.map((template) => (
            <article className="stacked-row" key={template.templateId}>
              <div className="stacked-row-head">
                <div>
                  <strong>{template.templateCode}</strong>
                  <p className="queue-subtitle">{template.templateName}</p>
                </div>
                <StatusPill tone={template.isActive ? 'calm' : 'neutral'}>
                  {template.isActive ? 'Active' : 'Inactive'}
                </StatusPill>
              </div>
              <div className="key-grid">
                <div className="key-item">
                  <span>Stores</span>
                  <strong>{String(template.stores.length)}</strong>
                </div>
                <div className="key-item">
                  <span>Description</span>
                  <strong>{template.description ?? '-'}</strong>
                </div>
              </div>

              {editDraft?.templateId === template.templateId ? (
                <div className="stacked-row">
                  <div className="form-grid">
                    <label className="field-block">
                      <span>Edit template code</span>
                      <input
                        value={editDraft.templateCode}
                        onChange={(event) =>
                          updateEditDraft('templateCode', normalizeCode(event.target.value))
                        }
                      />
                    </label>
                    <label className="field-block">
                      <span>Edit template name</span>
                      <input
                        value={editDraft.templateName}
                        onChange={(event) => updateEditDraft('templateName', event.target.value)}
                      />
                    </label>
                    <label className="field-block field-block-full">
                      <span>Edit template description</span>
                      <input
                        value={editDraft.description}
                        onChange={(event) => updateEditDraft('description', event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="store-checkbox-grid">
                    {input.stores.map((store) => (
                      <label className="store-checkbox" key={`edit-${template.templateId}-${store.storeId}`}>
                        <input
                          type="checkbox"
                          checked={editDraft.storeIds.includes(store.storeId)}
                          onChange={() => toggleEditStore(store.storeId)}
                        />
                        <span>{storeLabel(store)}</span>
                      </label>
                    ))}
                  </div>
                  {editValidationMessage ? (
                    <p className="validation-copy">{editValidationMessage}</p>
                  ) : null}
                  <div className="action-cluster">
                    <button
                      className="control-button"
                      type="button"
                      disabled={Boolean(editValidationMessage) || input.isPending}
                      onClick={submitEditDraft}
                    >
                      Save template
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setEditDraft(null)}
                    >
                      Cancel edit
                    </button>
                  </div>
                </div>
              ) : null}

              {cloneDraft?.sourceTemplateId === template.templateId ? (
                <div className="stacked-row">
                  <div className="form-grid">
                    <label className="field-block">
                      <span>Clone template code</span>
                      <input
                        value={cloneDraft.templateCode}
                        onChange={(event) =>
                          updateCloneDraft('templateCode', normalizeCode(event.target.value))
                        }
                      />
                    </label>
                    <label className="field-block">
                      <span>Clone template name</span>
                      <input
                        value={cloneDraft.templateName}
                        onChange={(event) => updateCloneDraft('templateName', event.target.value)}
                      />
                    </label>
                    <label className="field-block field-block-full">
                      <span>Clone template description</span>
                      <input
                        value={cloneDraft.description}
                        onChange={(event) => updateCloneDraft('description', event.target.value)}
                      />
                    </label>
                  </div>
                  {cloneValidationMessage ? (
                    <p className="validation-copy">{cloneValidationMessage}</p>
                  ) : null}
                  <div className="action-cluster">
                    <button
                      className="control-button"
                      type="button"
                      disabled={Boolean(cloneValidationMessage) || input.isPending}
                      onClick={submitCloneDraft}
                    >
                      Clone template
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setCloneDraft(null)}
                    >
                      Cancel clone
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="action-cluster">
                <button
                  className="ghost-button"
                  type="button"
                  disabled={input.isPending}
                  onClick={() => {
                    setCloneDraft(null)
                    setEditDraft(createTemplateEditDraft(template))
                  }}
                >
                  Edit {template.templateCode}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={input.isPending}
                  onClick={() => {
                    setEditDraft(null)
                    setCloneDraft(createTemplateCloneDraft(template))
                  }}
                >
                  Clone {template.templateCode}
                </button>
                {template.isActive ? (
                  <button
                    className="control-button"
                    type="button"
                    disabled={input.isPending}
                    onClick={() => input.onDeactivate(template.templateId)}
                  >
                    Deactivate {template.templateCode}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {input.feedback ? (
        <ScreenState title={input.feedback} copy="Template library is refreshed." />
      ) : null}

      {input.error ? (
        <ScreenState
          title="Template library action failed"
          copy={getErrorMessage(input.error)}
          tone="error"
        />
      ) : null}
    </article>
  )
}

function TemplateBuilderSection(input: {
  draft: TemplateDraft
  error: unknown
  feedback: string | null
  isPending: boolean
  stores: AuthLookupStore[]
  validationMessage: string | null
  onSubmit: () => void
  onToggleStore: (storeId: string) => void
  onUpdate: (field: keyof Omit<TemplateDraft, 'storeIds'>, value: string) => void
}) {
  return (
    <article className="stacked-row stage-template-builder">
      <div className="stacked-row-head">
        <div>
          <strong>Team template</strong>
          <p className="queue-subtitle">Reusable store groups for future stages.</p>
        </div>
        <StatusPill tone={input.draft.storeIds.length > 0 ? 'accent' : 'warning'}>
          {`${input.draft.storeIds.length} stores`}
        </StatusPill>
      </div>
      <div className="form-grid">
        <label className="field-block">
          <span>Template code</span>
          <input
            value={input.draft.templateCode}
            onChange={(event) => input.onUpdate('templateCode', normalizeCode(event.target.value))}
          />
        </label>
        <label className="field-block">
          <span>Template name</span>
          <input
            value={input.draft.templateName}
            onChange={(event) => input.onUpdate('templateName', event.target.value)}
          />
        </label>
        <label className="field-block field-block-full">
          <span>Template description</span>
          <input
            value={input.draft.description}
            onChange={(event) => input.onUpdate('description', event.target.value)}
          />
        </label>
      </div>
      <div className="store-checkbox-grid">
        {input.stores.map((store) => (
          <label className="store-checkbox" key={`template-${store.storeId}`}>
            <input
              type="checkbox"
              checked={input.draft.storeIds.includes(store.storeId)}
              onChange={() => input.onToggleStore(store.storeId)}
            />
            <span>{storeLabel(store)}</span>
          </label>
        ))}
      </div>
      {input.validationMessage ? (
        <p className="validation-copy">{input.validationMessage}</p>
      ) : null}
      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          disabled={Boolean(input.validationMessage) || input.isPending || input.stores.length === 0}
          onClick={input.onSubmit}
        >
          <PlusCircle size={16} />
          Create template
        </button>
      </div>
      {input.feedback ? <ScreenState title={input.feedback} copy="Template list is refreshed." /> : null}
      {input.error ? (
        <ScreenState
          title="Template could not be created"
          copy={getErrorMessage(input.error)}
          tone="error"
        />
      ) : null}
    </article>
  )
}
