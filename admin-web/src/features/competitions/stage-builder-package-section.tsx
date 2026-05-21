import { useState } from 'react'
import { PlusCircle } from 'lucide-react'
import { EmptyState, ScreenState, StatusPill } from '../../components/dashboard-primitives'
import { getErrorMessage } from '../../lib/format'
import type { TranslateFunction, TranslationKey } from '../localization/dictionary'
import { useLocalization } from '../localization/useLocalization'
import type {
  CompetitionStagePackageCode,
  CompetitionStagePackagePlan,
  CompetitionStagePackagePlanAuditEvent,
  CompetitionTeamTemplate,
  ReviewCompetitionStagePackagePlanPayload,
  UpdateCompetitionStagePackagePlanPayload,
} from './api'
import {
  formatCount,
  formatPlanStatus,
  formatStagePackage,
  formatStagePreset,
  formatStageType,
  stagePackageLabelKeys,
  stageTypeOptions,
} from './display'
import { stagePackageOptions, type StagePackageStageDraft } from './stage-packages'
import {
  buildStagePackagePlanUpdatePayload,
  createStagePackagePlanEditDraft,
  normalizeCode,
  validateStagePackagePlanEditDraft,
  type StagePackageDraft,
  type StagePackagePlanEditDraft,
} from './stage-builder-model'

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

export function StagePackageBuilderSection(input: StagePackageBuilderSectionInput) {
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
