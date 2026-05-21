import { useMemo, useReducer, useState } from 'react'
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
import {
  formatCount,
  formatPlanStatus,
  formatStagePackage,
  formatStagePreset,
  formatStageType,
  stagePackageLabelKeys,
  stagePresetLabelKeys,
  stageTypeOptions,
} from './display'
import { TemplateBuilderSection, TemplateLibrarySection } from './stage-builder-template-sections'
import {
  buildStagePackagePlanUpdatePayload,
  createStageBuilderFormState,
  createStagePackagePlanEditDraft,
  normalizeCode,
  stageBuilderFormReducer,
  storeLabel,
  validateStageDraft,
  validateStagePackageDraft,
  validateStagePackagePlanDraft,
  validateStagePackagePlanEditDraft,
  validateTemplateDraft,
  type StageDraft,
  type StageBuilderFormProps,
  type StagePackageDraft,
  type StagePackagePlanEditDraft,
  type TeamDraft,
  type TemplateDraft,
} from './stage-builder-model'
import { getErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import type { TranslateFunction, TranslationKey } from '../localization/dictionary'
import { useLocalization } from '../localization/useLocalization'

function formatAuditMetadata(metadata: Record<string, unknown>, t: TranslateFunction) {
  const planName = typeof metadata.planName === 'string' ? metadata.planName : null
  const sourcePlanName =
    typeof metadata.sourcePlanName === 'string'
      ? t('competition.stageBuilder.audit.source', { planName: metadata.sourcePlanName })
      : null
  const clonedPlanName =
    typeof metadata.clonedPlanName === 'string'
      ? t('competition.stageBuilder.audit.clone', { planName: metadata.clonedPlanName })
      : null
  const reviewNote = typeof metadata.reviewNote === 'string' ? metadata.reviewNote : null
  const stageCount =
    typeof metadata.stageCount === 'number'
      ? formatCount(
          metadata.stageCount,
          'competition.stageBuilder.count.stage',
          'competition.stageBuilder.count.stages',
          t,
        )
      : null
  const createdStageCount = Array.isArray(metadata.createdStageIds)
    ? formatCount(
        metadata.createdStageIds.length,
        'competition.stageBuilder.count.createdStage',
        'competition.stageBuilder.count.createdStages',
        t,
      )
    : null

  return (
    [sourcePlanName, clonedPlanName, planName, reviewNote, stageCount, createdStageCount]
      .filter(Boolean)
      .join(' - ') || t('competition.stageBuilder.audit.metadataRecorded')
  )
}

function buildStagePackagePlanDecisionPreview(plan: CompetitionStagePackagePlan) {
  let startsOn: string | null = null
  let endsOn: string | null = null
  const teamTemplateLabelByKey = new Map<string, string>()

  for (const stage of plan.stageDrafts) {
    if (stage.startsOn && (!startsOn || stage.startsOn < startsOn)) {
      startsOn = stage.startsOn
    }

    if (stage.endsOn && (!endsOn || stage.endsOn > endsOn)) {
      endsOn = stage.endsOn
    }

    for (const team of stage.teams) {
      teamTemplateLabelByKey.set(
        team.sourceTemplateId ?? team.teamCode,
        `${team.teamCode} - ${team.teamName}`,
      )
    }
  }

  const teamTemplateLabels = Array.from(teamTemplateLabelByKey.values())
  const storeAssignmentCount = plan.stageDrafts.reduce(
    (stageTotal, stage) =>
      stageTotal +
      stage.teams.reduce((teamTotal, team) => teamTotal + team.storeIds.length, 0),
    0,
  )

  return {
    dateRange: startsOn && endsOn ? `${startsOn} - ${endsOn}` : null,
    storeAssignmentCount,
    teamTemplateLabels,
  }
}

function StagePackagePlanDecisionPreview(input: { plan: CompetitionStagePackagePlan }) {
  const { t } = useLocalization()
  const preview = buildStagePackagePlanDecisionPreview(input.plan)

  return (
    <div className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{t('competition.stageBuilder.decisionPreviewTitle')}</strong>
          <p className="queue-subtitle">{t('competition.stageBuilder.decisionPreviewCopy')}</p>
        </div>
        <StatusPill tone="accent">
          {formatCount(
            preview.storeAssignmentCount,
            'competition.stageBuilder.count.storeAssignment',
            'competition.stageBuilder.count.storeAssignments',
            t,
          )}
        </StatusPill>
      </div>
      <div className="key-grid">
        <div className="key-item">
          <span>{t('competition.stageBuilder.planWindow')}</span>
          <strong>{preview.dateRange ?? t('competition.stageBuilder.datesMissing')}</strong>
        </div>
        <div className="key-item">
          <span>{t('competition.stageBuilder.stages')}</span>
          <strong>
            {formatCount(
              input.plan.stageDrafts.length,
              'competition.stageBuilder.count.stage',
              'competition.stageBuilder.count.stages',
              t,
            )}
          </strong>
        </div>
        <div className="key-item">
          <span>{t('competition.stageBuilder.teamTemplates')}</span>
          <strong>{String(preview.teamTemplateLabels.length)}</strong>
        </div>
      </div>
      <div className="stacked-table">
        {input.plan.stageDrafts.map((stage) => (
          <article className="stacked-row" key={`${input.plan.planId}-${stage.stageCode}`}>
            <div className="stacked-row-head">
              <div>
                <strong>{stage.stageName}</strong>
                <p className="queue-subtitle">{`${stage.startsOn} - ${stage.endsOn}`}</p>
              </div>
              <StatusPill tone="neutral">{formatStageType(stage.stageType, t)}</StatusPill>
            </div>
            <p className="queue-subtitle">
              {[
                formatCount(
                  stage.teams.length,
                  'competition.stageBuilder.count.team',
                  'competition.stageBuilder.count.teams',
                  t,
                ),
                formatCount(
                  stage.teams.reduce((total, team) => total + team.storeIds.length, 0),
                  'competition.stageBuilder.count.storeAssignment',
                  'competition.stageBuilder.count.storeAssignments',
                  t,
                ),
              ].join(' - ')}
            </p>
          </article>
        ))}
      </div>
      <p className="queue-subtitle">{preview.teamTemplateLabels.join(', ')}</p>
    </div>
  )
}

function useStageBuilderFormContent(input: StageBuilderFormProps) {
  const { t } = useLocalization()
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(
    stageBuilderFormReducer,
    {
      startsOn: input.competitionStartsOn,
      endsOn: input.competitionEndsOn,
    },
    createStageBuilderFormState,
  )
  const {
    draft,
    stagePackageDraft,
    templateDraft,
    feedback,
    stagePackageFeedback,
    templateFeedback,
    templateLifecycleFeedback,
    showInactiveTemplates,
    stagePackageHistoryPlanId,
  } = state

  const lookupsQuery = useQuery({
    queryKey: ['competition-stage-builder-lookups'],
    queryFn: getAuthLookups,
    staleTime: 60_000,
    ...transientQueryRetryOptions,
  })

  const stores = useMemo(
    () =>
      (lookupsQuery.data?.stores ?? []).toSorted((left, right) =>
        storeLabel(left).localeCompare(storeLabel(right)),
      ),
    [lookupsQuery.data?.stores],
  )

  const templatesQuery = useQuery({
    queryKey: ['competition-team-templates', 'active'],
    queryFn: () => listCompetitionTeamTemplates({ activeOnly: true }),
    staleTime: 60_000,
    ...transientQueryRetryOptions,
  })

  const templateLibraryQuery = useQuery({
    queryKey: ['competition-team-templates', 'library', showInactiveTemplates],
    queryFn: () => listCompetitionTeamTemplates({ activeOnly: !showInactiveTemplates }),
    staleTime: 60_000,
    ...transientQueryRetryOptions,
  })

  const stagePackagePlansQuery = useQuery({
    queryKey: ['competition-stage-package-plans', input.competitionId],
    queryFn: () => listCompetitionStagePackagePlans(input.competitionId),
    staleTime: 60_000,
    ...transientQueryRetryOptions,
  })

  const stagePackagePlanAuditQuery = useQuery({
    queryKey: ['competition-stage-package-plan-audit', stagePackageHistoryPlanId],
    queryFn: () => listCompetitionStagePackagePlanAudit(stagePackageHistoryPlanId as string),
    enabled: Boolean(stagePackageHistoryPlanId),
    staleTime: 30_000,
    ...transientQueryRetryOptions,
  })

  const templates = useMemo(
    () =>
      (templatesQuery.data?.items ?? []).toSorted((left, right) =>
        left.templateCode.localeCompare(right.templateCode),
      ),
    [templatesQuery.data?.items],
  )

  const validationMessage = validateStageDraft(draft)
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
      dispatch({ type: 'setStageFeedback', message: response.command.message })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['competitions'] }),
        queryClient.invalidateQueries({ queryKey: ['competition-detail', input.competitionId] }),
      ])
      await input.onCreated()
    },
  })

  const createStagePackageMutation = useMutation({
    mutationFn: (payload: CreateCompetitionStagePackagePayload) =>
      createCompetitionStagePackage(input.competitionId, payload),
    onSuccess: async (response) => {
      dispatch({ type: 'setStagePackageFeedback', message: response.command.message })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['competitions'] }),
        queryClient.invalidateQueries({ queryKey: ['competition-detail', input.competitionId] }),
      ])
      await input.onCreated()
    },
  })

  const createStagePackagePlanMutation = useMutation({
    mutationFn: (payload: CreateCompetitionStagePackagePlanPayload) =>
      createCompetitionStagePackagePlan(input.competitionId, payload),
    onSuccess: async (response) => {
      dispatch({ type: 'setStagePackageFeedback', message: response.command.message })
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
      dispatch({ type: 'setStagePackageFeedback', message: response.command.message })
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
      dispatch({ type: 'setStagePackageFeedback', message: response.command.message })
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
      dispatch({ type: 'setStagePackageFeedback', message: response.command.message })
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
      dispatch({ type: 'setStagePackageFeedback', message: response.command.message })
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
      dispatch({ type: 'setStagePackageFeedback', message: response.command.message })
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
      dispatch({ type: 'setStagePackageFeedback', message: response.command.message })
      await queryClient.invalidateQueries({
        queryKey: ['competition-stage-package-plans', input.competitionId],
      })
      await input.onCreated()
    },
  })

  const cancelStagePackagePlanMutation = useMutation({
    mutationFn: cancelCompetitionStagePackagePlan,
    onSuccess: async (response) => {
      dispatch({ type: 'setStagePackageFeedback', message: response.command.message })
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
      dispatch({ type: 'resetTemplateDraftAfterCreate', message: response.command.message })
      await queryClient.invalidateQueries({ queryKey: ['competition-team-templates'] })
    },
  })

  const deactivateTemplateMutation = useMutation({
    mutationFn: deactivateCompetitionTeamTemplate,
    onSuccess: async (response) => {
      dispatch({ type: 'setTemplateLifecycleFeedback', message: response.command.message })
      await queryClient.invalidateQueries({ queryKey: ['competition-team-templates'] })
    },
  })

  const updateTemplateMutation = useMutation({
    mutationFn: (request: {
      templateId: string
      payload: UpdateCompetitionTeamTemplatePayload
    }) => updateCompetitionTeamTemplate(request.templateId, request.payload),
    onSuccess: async (response) => {
      dispatch({ type: 'setTemplateLifecycleFeedback', message: response.command.message })
      await queryClient.invalidateQueries({ queryKey: ['competition-team-templates'] })
    },
  })

  const cloneTemplateMutation = useMutation({
    mutationFn: (request: {
      templateId: string
      payload: CloneCompetitionTeamTemplatePayload
    }) => cloneCompetitionTeamTemplate(request.templateId, request.payload),
    onSuccess: async (response) => {
      dispatch({ type: 'setTemplateLifecycleFeedback', message: response.command.message })
      await queryClient.invalidateQueries({ queryKey: ['competition-team-templates'] })
    },
  })

  function updateDraft(field: keyof Omit<StageDraft, 'teams'>, value: string) {
    if (field === 'stageType') {
      dispatch({
        type: 'updateStageDraftType',
        value: value as CompetitionStageSummary['stageType'],
      })
      return
    }

    if (field === 'stagePresetCode') {
      return
    }

    dispatch({ type: 'updateStageDraftField', field, value })
  }

  function applyStagePreset(presetCode: string) {
    if (!presetCode) {
      dispatch({ type: 'clearStagePreset' })
      return
    }

    const presetDraft = buildStagePresetDraft({
      competitionStartsOn: input.competitionStartsOn,
      competitionEndsOn: input.competitionEndsOn,
      presetCode: presetCode as StagePresetCode,
    })

    if (!presetDraft) return

    dispatch({ type: 'applyStagePreset', presetDraft })
  }

  function updateStagePackageDraft(field: keyof StagePackageDraft, value: string) {
    if (field === 'packageCode') {
      const packageCode = value as CompetitionStagePackageCode

      dispatch({
        type: 'updateStagePackageCode',
        packageCode,
        stageDrafts: createStagePackageStageDrafts({
          competitionStartsOn: input.competitionStartsOn,
          competitionEndsOn: input.competitionEndsOn,
          packageCode,
        }),
      })
      return
    }

    if (field === 'stageDrafts') {
      return
    }

    dispatch({ type: 'updateStagePackageField', field, value })
  }

  function updateStagePackageStage(
    stageIndex: number,
    field: keyof StagePackageStageDraft,
    value: string,
  ) {
    if (field === 'stageType') {
      dispatch({
        type: 'updateStagePackageStageType',
        stageIndex,
        value: value as CompetitionStageSummary['stageType'],
      })
      return
    }

    if (field === 'stagePresetCode') {
      return
    }

    dispatch({ type: 'updateStagePackageStageField', stageIndex, field, value })
  }

  function getSelectedStagePackageTemplates() {
    return [
      templates.find((template) => template.templateId === stagePackageDraft.firstTemplateId),
      templates.find((template) => template.templateId === stagePackageDraft.secondTemplateId),
    ].filter((template): template is CompetitionTeamTemplate => Boolean(template))
  }

  function updateTeam(index: number, patch: Partial<TeamDraft>) {
    dispatch({ type: 'updateTeam', index, patch })
  }

  function updateTemplateDraft(field: keyof Omit<TemplateDraft, 'storeIds'>, value: string) {
    dispatch({ type: 'updateTemplateDraftField', field, value })
  }

  function toggleStore(teamIndex: number, storeId: string) {
    const team = draft.teams[teamIndex]
    const nextStoreIds = team.storeIds.includes(storeId)
      ? team.storeIds.filter((currentStoreId) => currentStoreId !== storeId)
      : [...team.storeIds, storeId]

    updateTeam(teamIndex, { storeIds: nextStoreIds })
  }

  function toggleTemplateStore(storeId: string) {
    dispatch({ type: 'toggleTemplateStore', storeId })
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
    const nextValidation = validateStageDraft(draft)
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
    <section className="stacked-table" aria-label={t('competition.stageBuilder.ariaLabel')}>
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('competition.stageBuilder.eyebrow')}</div>
          <h3>{t('competition.stageBuilder.createStageTitle')}</h3>
        </div>
        <StatusPill tone={validationMessage ? 'warning' : 'calm'}>
          {validationMessage ? t('competition.stageBuilder.draftIncomplete') : t('competition.stageBuilder.ready')}
        </StatusPill>
      </div>

      <article className="stacked-row">
        <div className="form-grid">
          <label className="field-block">
            <span>{t('competition.stageBuilder.stagePreset')}</span>
            <select
              value={draft.stagePresetCode ?? ''}
              onChange={(event) => applyStagePreset(event.target.value)}
            >
              <option value="">{t('competition.stageBuilder.manualStage')}</option>
              {stagePresetOptions.map((preset) => (
                <option key={preset.code} value={preset.code}>
                  {t(stagePresetLabelKeys[preset.code])}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block">
            <span>{t('competition.stageBuilder.stageCode')}</span>
            <input
              value={draft.stageCode}
              onChange={(event) => updateDraft('stageCode', normalizeCode(event.target.value))}
            />
          </label>
          <label className="field-block">
            <span>{t('competition.stageBuilder.stageName')}</span>
            <input
              value={draft.stageName}
              onChange={(event) => updateDraft('stageName', event.target.value)}
            />
          </label>
          <label className="field-block">
            <span>{t('competition.stageBuilder.stageOrder')}</span>
            <input
              min="1"
              type="number"
              value={draft.stageOrder}
              onChange={(event) => updateDraft('stageOrder', event.target.value)}
            />
          </label>
          <label className="field-block">
            <span>{t('competition.stageBuilder.stageType')}</span>
            <select
              value={draft.stageType}
              onChange={(event) =>
                updateDraft('stageType', event.target.value as CompetitionStageSummary['stageType'])
              }
            >
              {stageTypeOptions.map((stageType) => (
                <option key={stageType} value={stageType}>
                  {formatStageType(stageType, t)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block">
            <span>{t('competition.stageBuilder.stageStarts')}</span>
            <input
              type="date"
              value={draft.startsOn}
              onChange={(event) => updateDraft('startsOn', event.target.value)}
            />
          </label>
          <label className="field-block">
            <span>{t('competition.stageBuilder.stageEnds')}</span>
            <input
              type="date"
              value={draft.endsOn}
              onChange={(event) => updateDraft('endsOn', event.target.value)}
            />
          </label>
        </div>
      </article>

      {lookupsQuery.isLoading ? (
        <ScreenState
          title={t('competition.stageBuilder.storesLoadingTitle')}
          copy={t('competition.stageBuilder.storesLoadingCopy')}
        />
      ) : null}

      {lookupsQuery.isError ? (
        <ScreenState
          title={t('competition.stageBuilder.storesErrorTitle')}
          copy={getErrorMessage(lookupsQuery.error)}
          tone="error"
        />
      ) : null}

      {!lookupsQuery.isLoading && stores.length === 0 ? (
        <EmptyState
          title={t('competition.stageBuilder.noStoresTitle')}
          copy={t('competition.stageBuilder.noStoresCopy')}
        />
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
        onShowInactiveChange={(value) =>
          dispatch({ type: 'setShowInactiveTemplates', value })
        }
        onUpdate={(templateId, payload) =>
          updateTemplateMutation.mutate({ templateId, payload })
        }
      />

      {templatesQuery.isError ? (
        <ScreenState
          title={t('competition.stageBuilder.teamTemplatesErrorTitle')}
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
        onShowPlanHistory={(planId) =>
          dispatch({ type: 'setStagePackageHistoryPlanId', planId })
        }
        onSubmit={submitStagePackage}
        onSubmitPlan={(planId) => submitStagePackagePlanMutation.mutate(planId)}
        onUpdatePlan={(planId, payload) =>
          updateStagePackagePlanMutation.mutate({ planId, payload })
        }
        onUpdateStage={updateStagePackageStage}
        onUpdate={updateStagePackageDraft}
      />

      <StageBuilderTeamsSection
        stores={stores}
        teams={draft.teams}
        templates={templates}
        onApplyTemplate={applyTemplate}
        onToggleStore={toggleStore}
        onUpdateTeam={updateTeam}
      />

      {validationMessage ? <p className="validation-copy">{t(validationMessage)}</p> : null}

      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          disabled={Boolean(validationMessage) || createMutation.isPending || stores.length === 0}
          onClick={submitStage}
        >
          <PlusCircle size={16} />
          {t('competition.stageBuilder.createStageButton')}
        </button>
        <StatusPill tone="neutral">
          {formatCount(
            draft.teams.length,
            'competition.stageBuilder.count.team',
            'competition.stageBuilder.count.teams',
            t,
          )}
        </StatusPill>
      </div>

      {feedback ? <ScreenState title={feedback} copy={t('competition.stageBuilder.stageRefreshCopy')} /> : null}

      {createMutation.isError ? (
        <ScreenState
          title={t('competition.stageBuilder.stageCreateErrorTitle')}
          copy={getErrorMessage(createMutation.error)}
          tone="error"
        />
      ) : null}
    </section>
  )
}

export function StageBuilderForm(input: StageBuilderFormProps) {
  return useStageBuilderFormContent(input)
}

function StageBuilderTeamsSection(input: {
  stores: AuthLookupStore[]
  teams: TeamDraft[]
  templates: CompetitionTeamTemplate[]
  onApplyTemplate: (teamIndex: number, templateId: string) => void
  onToggleStore: (teamIndex: number, storeId: string) => void
  onUpdateTeam: (index: number, patch: Partial<TeamDraft>) => void
}) {
  const { t } = useLocalization()

  return (
    <>
      {input.teams.map((team, teamIndex) => (
        <article className="stacked-row stage-builder-team" key={teamIndex}>
          <div className="stacked-row-head">
            <strong>{t('competition.stageBuilder.teamNumber', { number: teamIndex + 1 })}</strong>
            <StatusPill tone={team.storeIds.length > 0 ? 'accent' : 'warning'}>
              {formatCount(
                team.storeIds.length,
                'competition.stageBuilder.count.store',
                'competition.stageBuilder.count.stores',
                t,
              )}
            </StatusPill>
          </div>
          <div className="form-grid">
            <label className="field-block">
              <span>{t('competition.stageBuilder.teamTemplateLabel', { number: teamIndex + 1 })}</span>
              <select
                value={team.sourceTemplateId ?? ''}
                onChange={(event) => input.onApplyTemplate(teamIndex, event.target.value)}
              >
                <option value="">{t('competition.stageBuilder.manualTeam')}</option>
                {input.templates.map((template) => (
                  <option key={template.templateId} value={template.templateId}>
                    {template.templateCode} - {template.templateName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>{t('competition.stageBuilder.teamCodeLabel', { number: teamIndex + 1 })}</span>
              <input
                value={team.teamCode}
                onChange={(event) =>
                  input.onUpdateTeam(teamIndex, { teamCode: normalizeCode(event.target.value) })
                }
              />
            </label>
            <label className="field-block">
              <span>{t('competition.stageBuilder.teamNameLabel', { number: teamIndex + 1 })}</span>
              <input
                value={team.teamName}
                onChange={(event) => input.onUpdateTeam(teamIndex, { teamName: event.target.value })}
              />
            </label>
          </div>
          <div className="store-checkbox-grid">
            {input.stores.map((store) => (
              <label className="store-checkbox" key={`${teamIndex}-${store.storeId}`}>
                <input
                  type="checkbox"
                  checked={team.storeIds.includes(store.storeId)}
                  onChange={() => input.onToggleStore(teamIndex, store.storeId)}
                />
                <span>{storeLabel(store)}</span>
              </label>
            ))}
          </div>
        </article>
      ))}
    </>
  )
}

type StagePackageBuilderSectionInput = {
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
  planValidationMessage: TranslationKey | null
  validationMessage: TranslationKey | null
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
}

function StagePackageBuilderSection(input: StagePackageBuilderSectionInput) {
  return useStagePackageBuilderSectionContent(input)
}

function useStagePackageBuilderSectionContent(input: StagePackageBuilderSectionInput) {
  const { t } = useLocalization()
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
          <strong>{t('competition.stageBuilder.stagePackageTitle')}</strong>
          <p className="queue-subtitle">{t('competition.stageBuilder.stagePackageCopy')}</p>
        </div>
        <StatusPill tone={input.validationMessage ? 'warning' : 'calm'}>
          {input.validationMessage ? t('competition.stageBuilder.packageIncomplete') : t('competition.stageBuilder.ready')}
        </StatusPill>
      </div>

      <StagePackageDraftFields
        draft={input.draft}
        planValidationMessage={input.planValidationMessage}
        templates={input.templates}
        validationMessage={input.validationMessage}
        onUpdate={input.onUpdate}
      />

      <StagePackagePreviewStages
        stageDrafts={input.draft.stageDrafts}
        onUpdateStage={input.onUpdateStage}
      />

      <StagePackageDraftActions
        isPending={input.isPending}
        planValidationMessage={input.planValidationMessage}
        validationMessage={input.validationMessage}
        onSavePlan={input.onSavePlan}
        onSubmit={input.onSubmit}
      />

      <article className="stacked-row stage-package-plan-library">
        <div className="stacked-row-head">
          <div>
            <strong>{t('competition.stageBuilder.packagePlanLibraryTitle')}</strong>
            <p className="queue-subtitle">{t('competition.stageBuilder.packagePlanLibraryCopy')}</p>
          </div>
          <StatusPill tone="neutral">
            {formatCount(
              input.plans.length,
              'competition.stageBuilder.count.plan',
              'competition.stageBuilder.count.plans',
              t,
            )}
          </StatusPill>
        </div>

        {input.isLoadingPlans ? (
          <ScreenState
            title={t('competition.stageBuilder.packagePlansLoadingTitle')}
            copy={t('competition.stageBuilder.packagePlansLoadingCopy')}
          />
        ) : null}

        {!input.isLoadingPlans && input.plans.length === 0 ? (
          <EmptyState
            title={t('competition.stageBuilder.noPackagePlansTitle')}
            copy={t('competition.stageBuilder.noPackagePlansCopy')}
          />
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
                        formatStagePackage(plan.packageCode, t),
                        plan.sourcePlan
                          ? t('competition.stageBuilder.clonedFrom', { planName: plan.sourcePlan.planName })
                          : null,
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
                    {formatPlanStatus(plan.planStatus, t)}
                  </StatusPill>
                </div>
                <div className="key-grid">
                  <div className="key-item">
                    <span>{t('competition.stageBuilder.stages')}</span>
                    <strong>{String(plan.stageDrafts.length)}</strong>
                  </div>
                  <div className="key-item">
                    <span>{t('competition.stageBuilder.createdStages')}</span>
                    <strong>{String(plan.createdStageIds.length)}</strong>
                  </div>
                  <div className="key-item">
                    <span>{t('competition.stageBuilder.updated')}</span>
                    <strong>{plan.updatedAt.slice(0, 10)}</strong>
                  </div>
                </div>
                {editDraft?.planId === plan.planId ? (
                  <div className="stacked-row">
                    <div className="form-grid">
                      <label className="field-block">
                        <span>{t('competition.stageBuilder.editPlanName')}</span>
                        <input
                          value={editDraft.planName}
                          onChange={(event) => updatePlanEditDraft('planName', event.target.value)}
                        />
                      </label>
                      <label className="field-block">
                        <span>{t('competition.stageBuilder.editStagePackage')}</span>
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
                              {t(stagePackageLabelKeys[packageOption.code])}
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
                              <strong>
                                {t('competition.stageBuilder.editPackageStageNumber', { number: stageIndex + 1 })}
                              </strong>
                              <p className="queue-subtitle">
                                {formatStagePreset(stageDraft.stagePresetCode, t)}
                              </p>
                            </div>
                            <StatusPill tone="accent">{formatStageType(stageDraft.stageType, t)}</StatusPill>
                          </div>
                          <div className="form-grid">
                            <label className="field-block">
                              <span>{t('competition.stageBuilder.editPackageStageCodeLabel', { number: stageIndex + 1 })}</span>
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
                              <span>{t('competition.stageBuilder.editPackageStageNameLabel', { number: stageIndex + 1 })}</span>
                              <input
                                value={stageDraft.stageName}
                                onChange={(event) =>
                                  updatePlanEditStage(stageIndex, 'stageName', event.target.value)
                                }
                              />
                            </label>
                            <label className="field-block">
                              <span>{t('competition.stageBuilder.editPackageStageOrderLabel', { number: stageIndex + 1 })}</span>
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
                              <span>{t('competition.stageBuilder.editPackageStageTypeLabel', { number: stageIndex + 1 })}</span>
                              <select
                                value={stageDraft.stageType}
                                onChange={(event) =>
                                  updatePlanEditStage(stageIndex, 'stageType', event.target.value)
                                }
                              >
                                {stageTypeOptions.map((stageType) => (
                                  <option key={stageType} value={stageType}>
                                    {formatStageType(stageType, t)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field-block">
                              <span>{t('competition.stageBuilder.editPackageStageStartsLabel', { number: stageIndex + 1 })}</span>
                              <input
                                type="date"
                                value={stageDraft.startsOn}
                                onChange={(event) =>
                                  updatePlanEditStage(stageIndex, 'startsOn', event.target.value)
                                }
                              />
                            </label>
                            <label className="field-block">
                              <span>{t('competition.stageBuilder.editPackageStageEndsLabel', { number: stageIndex + 1 })}</span>
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
                      <p className="validation-copy">{t(editValidationMessage)}</p>
                    ) : null}
                    <div className="action-cluster">
                      <button
                        className="control-button"
                        type="button"
                        disabled={Boolean(editValidationMessage) || input.isPending}
                        onClick={submitPlanEditDraft}
                      >
                        {t('competition.stageBuilder.savePackagePlanChanges')}
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setEditDraft(null)}
                      >
                        {t('competition.stageBuilder.cancelEdit')}
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
                        {t('competition.stageBuilder.editPlanButton', { planName: plan.planName })}
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={input.isPending}
                        onClick={() => input.onCancelPlan(plan.planId)}
                      >
                        {t('competition.stageBuilder.cancelPlanButton', { planName: plan.planName })}
                      </button>
                      <button
                        className="control-button"
                        type="button"
                        disabled={input.isPending}
                        onClick={() => input.onSubmitPlan(plan.planId)}
                      >
                        {t('competition.stageBuilder.markReadyButton', { planName: plan.planName })}
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
                      {t('competition.stageBuilder.executePlanButton', { planName: plan.planName })}
                    </button>
                  ) : null}
                  {plan.planStatus === 'rejected' ? (
                    <button
                      className="control-button"
                      type="button"
                      disabled={input.isPending}
                      onClick={() => input.onClonePlan(plan.planId)}
                    >
                      {t('competition.stageBuilder.clonePlanButton', { planName: plan.planName })}
                    </button>
                  ) : null}
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={input.isPending}
                    onClick={() => input.onShowPlanHistory(plan.planId)}
                  >
                    {t('competition.stageBuilder.showHistoryButton', { planName: plan.planName })}
                  </button>
                </div>

                {plan.planStatus === 'submitted' ? (
                  <div className="stacked-row">
                    <StagePackagePlanDecisionPreview plan={plan} />
                    <label className="field-block field-block-full">
                      <span>{t('competition.stageBuilder.decisionNoteLabel', { planName: plan.planName })}</span>
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
                        {t('competition.stageBuilder.approveDecisionButton', { planName: plan.planName })}
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={input.isPending}
                        onClick={() => input.onRejectPlan(plan.planId, getReviewPayload(plan.planId))}
                      >
                        {t('competition.stageBuilder.returnForRevisionButton', { planName: plan.planName })}
                      </button>
                    </div>
                  </div>
                ) : null}

                {input.historyPlanId === plan.planId ? (
                  <div className="action-cluster">
                    {input.isLoadingAudit ? (
                      <ScreenState
                        title={t('competition.stageBuilder.planHistoryLoadingTitle')}
                        copy={t('competition.stageBuilder.planHistoryLoadingCopy')}
                      />
                    ) : null}
                    {!input.isLoadingAudit && input.auditEvents.length === 0 ? (
                      <EmptyState
                        title={t('competition.stageBuilder.noPlanHistoryTitle')}
                        copy={t('competition.stageBuilder.noPlanHistoryCopy')}
                      />
                    ) : null}
                    {!input.isLoadingAudit && input.auditEvents.length > 0 ? (
                      <div className="stacked-table">
                        {input.auditEvents.map((event) => (
                          <article className="stacked-row" key={event.eventLogId}>
                            <div className="stacked-row-head">
                              <div>
                                <strong>{event.eventType}</strong>
                                <p className="queue-subtitle">
                                  {formatAuditMetadata(event.metadata, t)}
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
        <ScreenState title={input.feedback} copy={t('competition.stageBuilder.competitionRefreshCopy')} />
      ) : null}

      {input.error ? (
        <ScreenState
          title={t('competition.stageBuilder.stagePackageActionFailedTitle')}
          copy={getErrorMessage(input.error)}
          tone="error"
        />
      ) : null}
    </article>
  )
}

function StagePackageDraftFields(input: {
  draft: StagePackageDraft
  planValidationMessage: TranslationKey | null
  templates: CompetitionTeamTemplate[]
  validationMessage: TranslationKey | null
  onUpdate: (field: keyof StagePackageDraft, value: string) => void
}) {
  const { t } = useLocalization()

  return (
    <>
      <div className="form-grid">
        <label className="field-block">
          <span>{t('competition.stageBuilder.stagePackage')}</span>
          <select
            value={input.draft.packageCode}
            onChange={(event) => input.onUpdate('packageCode', event.target.value)}
          >
            {stagePackageOptions.map((packageOption) => (
              <option key={packageOption.code} value={packageOption.code}>
                {t(stagePackageLabelKeys[packageOption.code])}
              </option>
            ))}
          </select>
        </label>
        <label className="field-block">
          <span>{t('competition.stageBuilder.packagePlanName')}</span>
          <input
            value={input.draft.planName}
            onChange={(event) => input.onUpdate('planName', event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>{t('competition.stageBuilder.packageTeamTemplateLabel', { number: 1 })}</span>
          <select
            value={input.draft.firstTemplateId}
            onChange={(event) => input.onUpdate('firstTemplateId', event.target.value)}
          >
            <option value="">{t('competition.stageBuilder.selectTemplate')}</option>
            {input.templates.map((template) => (
              <option key={template.templateId} value={template.templateId}>
                {template.templateCode} - {template.templateName}
              </option>
            ))}
          </select>
        </label>
        <label className="field-block">
          <span>{t('competition.stageBuilder.packageTeamTemplateLabel', { number: 2 })}</span>
          <select
            value={input.draft.secondTemplateId}
            onChange={(event) => input.onUpdate('secondTemplateId', event.target.value)}
          >
            <option value="">{t('competition.stageBuilder.selectTemplate')}</option>
            {input.templates.map((template) => (
              <option key={template.templateId} value={template.templateId}>
                {template.templateCode} - {template.templateName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {input.validationMessage ? (
        <p className="validation-copy">{t(input.validationMessage)}</p>
      ) : null}
      {!input.validationMessage && input.planValidationMessage ? (
        <p className="validation-copy">{t(input.planValidationMessage)}</p>
      ) : null}
    </>
  )
}

function StagePackagePreviewStages(input: {
  stageDrafts: StagePackageStageDraft[]
  onUpdateStage: (stageIndex: number, field: keyof StagePackageStageDraft, value: string) => void
}) {
  const { t } = useLocalization()

  return (
    <div className="stacked-table">
      {input.stageDrafts.map((stageDraft, stageIndex) => (
        <article className="stacked-row stage-package-preview-stage" key={stageDraft.stagePresetCode}>
          <div className="stacked-row-head">
            <div>
              <strong>{t('competition.stageBuilder.packageStageNumber', { number: stageIndex + 1 })}</strong>
              <p className="queue-subtitle">{formatStagePreset(stageDraft.stagePresetCode, t)}</p>
            </div>
            <StatusPill tone="accent">{formatStageType(stageDraft.stageType, t)}</StatusPill>
          </div>
          <div className="form-grid">
            <label className="field-block">
              <span>{t('competition.stageBuilder.packageStageCodeLabel', { number: stageIndex + 1 })}</span>
              <input
                value={stageDraft.stageCode}
                onChange={(event) =>
                  input.onUpdateStage(stageIndex, 'stageCode', normalizeCode(event.target.value))
                }
              />
            </label>
            <label className="field-block">
              <span>{t('competition.stageBuilder.packageStageNameLabel', { number: stageIndex + 1 })}</span>
              <input
                value={stageDraft.stageName}
                onChange={(event) =>
                  input.onUpdateStage(stageIndex, 'stageName', event.target.value)
                }
              />
            </label>
            <label className="field-block">
              <span>{t('competition.stageBuilder.packageStageOrderLabel', { number: stageIndex + 1 })}</span>
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
              <span>{t('competition.stageBuilder.packageStageTypeLabel', { number: stageIndex + 1 })}</span>
              <select
                value={stageDraft.stageType}
                onChange={(event) =>
                  input.onUpdateStage(stageIndex, 'stageType', event.target.value)
                }
              >
                {stageTypeOptions.map((stageType) => (
                  <option key={stageType} value={stageType}>
                    {formatStageType(stageType, t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>{t('competition.stageBuilder.packageStageStartsLabel', { number: stageIndex + 1 })}</span>
              <input
                type="date"
                value={stageDraft.startsOn}
                onChange={(event) =>
                  input.onUpdateStage(stageIndex, 'startsOn', event.target.value)
                }
              />
            </label>
            <label className="field-block">
              <span>{t('competition.stageBuilder.packageStageEndsLabel', { number: stageIndex + 1 })}</span>
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
  )
}

function StagePackageDraftActions(input: {
  isPending: boolean
  planValidationMessage: TranslationKey | null
  validationMessage: TranslationKey | null
  onSavePlan: () => void
  onSubmit: () => void
}) {
  const { t } = useLocalization()

  return (
    <div className="action-cluster">
      <button
        className="ghost-button"
        type="button"
        disabled={Boolean(input.planValidationMessage) || input.isPending}
        onClick={input.onSavePlan}
      >
        {t('competition.stageBuilder.savePackagePlan')}
      </button>
      <button
        className="control-button"
        type="button"
        disabled={Boolean(input.validationMessage) || input.isPending}
        onClick={input.onSubmit}
      >
        <PlusCircle size={16} />
        {t('competition.stageBuilder.createStagePackage')}
      </button>
      <StatusPill tone="neutral">
        {formatCount(
          2,
          'competition.stageBuilder.count.stage',
          'competition.stageBuilder.count.stages',
          t,
        )}
      </StatusPill>
    </div>
  )
}
