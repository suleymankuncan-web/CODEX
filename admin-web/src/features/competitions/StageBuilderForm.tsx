import { useMemo, useReducer } from 'react'
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
  type StagePackageStageDraft,
} from './stage-packages'
import {
  buildStagePresetDraft,
  stagePresetOptions,
  type StagePresetCode,
} from './stage-presets'
import {
  formatCount,
  formatStageType,
  stagePresetLabelKeys,
  stageTypeOptions,
} from './display'
import { StagePackageBuilderSection } from './stage-builder-package-section'
import { TemplateBuilderSection, TemplateLibrarySection } from './stage-builder-template-sections'
import {
  createStageBuilderFormState,
  normalizeCode,
  stageBuilderFormReducer,
  storeLabel,
  validateStageDraft,
  validateStagePackageDraft,
  validateStagePackagePlanDraft,
  validateTemplateDraft,
  type StageDraft,
  type StageBuilderFormProps,
  type StagePackageDraft,
  type TeamDraft,
  type TemplateDraft,
} from './stage-builder-model'
import { getErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { useLocalization } from '../localization/useLocalization'

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
    if (!team) {
      return
    }
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
      dispatch({ type: 'clearTeamTemplate', index: teamIndex })
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
    const description = templateDraft.description.trim()

    return {
      templateCode: templateDraft.templateCode.trim(),
      templateName: templateDraft.templateName.trim(),
      ...(description ? { description } : {}),
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
