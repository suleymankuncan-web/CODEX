import { useState } from 'react'
import { PlusCircle } from 'lucide-react'
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
import {
  CompetitionActionRow,
  CompetitionButton,
  CompetitionEmptyState,
  CompetitionFieldGrid,
  CompetitionInlineNotice,
  CompetitionKeyValue,
  CompetitionKeyValueGrid,
  CompetitionRow,
  CompetitionRowHeader,
  CompetitionRowList,
  CompetitionSelectField,
  CompetitionStatePanel,
  CompetitionStatusBadge,
  CompetitionSubtleText,
  CompetitionTextField,
} from './competition-admin-surface-primitives'

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
    <CompetitionRow>
      <CompetitionRowHeader
        title={t('competition.stageBuilder.decisionPreviewTitle')}
        description={t('competition.stageBuilder.decisionPreviewCopy')}
        badge={
          <CompetitionStatusBadge tone="accent">
          {formatCount(
            preview.storeAssignmentCount,
            'competition.stageBuilder.count.storeAssignment',
            'competition.stageBuilder.count.storeAssignments',
            t,
          )}
          </CompetitionStatusBadge>
        }
      />
      <CompetitionKeyValueGrid>
        <CompetitionKeyValue
          label={t('competition.stageBuilder.planWindow')}
          value={preview.dateRange ?? t('competition.stageBuilder.datesMissing')}
        />
        <CompetitionKeyValue
          label={t('competition.stageBuilder.stages')}
          value={formatCount(
            input.plan.stageDrafts.length,
            'competition.stageBuilder.count.stage',
            'competition.stageBuilder.count.stages',
            t,
          )}
        />
        <CompetitionKeyValue
          label={t('competition.stageBuilder.teamTemplates')}
          value={String(preview.teamTemplateLabels.length)}
        />
      </CompetitionKeyValueGrid>
      <CompetitionRowList>
        {input.plan.stageDrafts.map((stage) => (
          <CompetitionRow key={`${input.plan.planId}-${stage.stageCode}`}>
            <CompetitionRowHeader
              title={stage.stageName}
              description={`${stage.startsOn} - ${stage.endsOn}`}
              badge={<CompetitionStatusBadge tone="neutral">{formatStageType(stage.stageType, t)}</CompetitionStatusBadge>}
            />
            <CompetitionSubtleText>
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
            </CompetitionSubtleText>
          </CompetitionRow>
        ))}
      </CompetitionRowList>
      <CompetitionSubtleText>{preview.teamTemplateLabels.join(', ')}</CompetitionSubtleText>
    </CompetitionRow>
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
    <CompetitionRow className="stage-package-builder">
      <CompetitionRowHeader
        title={t('competition.stageBuilder.stagePackageTitle')}
        description={t('competition.stageBuilder.stagePackageCopy')}
        badge={
          <CompetitionStatusBadge tone={input.validationMessage ? 'warning' : 'calm'}>
          {input.validationMessage ? t('competition.stageBuilder.packageIncomplete') : t('competition.stageBuilder.ready')}
          </CompetitionStatusBadge>
        }
      />

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

      <CompetitionRow className="stage-package-plan-library">
        <CompetitionRowHeader
          title={t('competition.stageBuilder.packagePlanLibraryTitle')}
          description={t('competition.stageBuilder.packagePlanLibraryCopy')}
          badge={
            <CompetitionStatusBadge tone="neutral">
            {formatCount(
              input.plans.length,
              'competition.stageBuilder.count.plan',
              'competition.stageBuilder.count.plans',
              t,
            )}
            </CompetitionStatusBadge>
          }
        />

        {input.isLoadingPlans ? (
          <CompetitionStatePanel
            title={t('competition.stageBuilder.packagePlansLoadingTitle')}
            copy={t('competition.stageBuilder.packagePlansLoadingCopy')}
            isLoading
          />
        ) : null}

        {!input.isLoadingPlans && input.plans.length === 0 ? (
          <CompetitionEmptyState
            title={t('competition.stageBuilder.noPackagePlansTitle')}
            copy={t('competition.stageBuilder.noPackagePlansCopy')}
          />
        ) : null}

        {input.plans.length > 0 ? (
          <CompetitionRowList>
            {input.plans.map((plan) => (
              <CompetitionRow key={plan.planId}>
                <CompetitionRowHeader
                  title={plan.planName}
                  description={
                    <>
                      {[
                        formatStagePackage(plan.packageCode, t),
                        plan.sourcePlan
                          ? t('competition.stageBuilder.clonedFrom', { planName: plan.sourcePlan.planName })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' - ')}
                    </>
                  }
                  badge={
                    <CompetitionStatusBadge
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
                    </CompetitionStatusBadge>
                  }
                />
                <CompetitionKeyValueGrid>
                  <CompetitionKeyValue label={t('competition.stageBuilder.stages')} value={String(plan.stageDrafts.length)} />
                  <CompetitionKeyValue label={t('competition.stageBuilder.createdStages')} value={String(plan.createdStageIds.length)} />
                  <CompetitionKeyValue label={t('competition.stageBuilder.updated')} value={plan.updatedAt.slice(0, 10)} />
                </CompetitionKeyValueGrid>
                {editDraft?.planId === plan.planId ? (
                  <CompetitionRow>
                    <CompetitionFieldGrid>
                      <CompetitionTextField
                        label={t('competition.stageBuilder.editPlanName')}
                        value={editDraft.planName}
                        onChange={(event) => updatePlanEditDraft('planName', event.target.value)}
                      />
                      <CompetitionSelectField
                        label={t('competition.stageBuilder.editStagePackage')}
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
                      </CompetitionSelectField>
                    </CompetitionFieldGrid>
                    <CompetitionRowList>
                      {editDraft.stageDrafts.map((stageDraft, stageIndex) => (
                        <CompetitionRow
                          className="stage-package-preview-stage"
                          key={`edit-${plan.planId}-${stageDraft.stagePresetCode}`}
                        >
                          <CompetitionRowHeader
                            title={t('competition.stageBuilder.editPackageStageNumber', { number: stageIndex + 1 })}
                            description={formatStagePreset(stageDraft.stagePresetCode, t)}
                            badge={<CompetitionStatusBadge tone="accent">{formatStageType(stageDraft.stageType, t)}</CompetitionStatusBadge>}
                          />
                          <CompetitionFieldGrid>
                            <CompetitionTextField
                              label={t('competition.stageBuilder.editPackageStageCodeLabel', { number: stageIndex + 1 })}
                              value={stageDraft.stageCode}
                              onChange={(event) =>
                                updatePlanEditStage(
                                  stageIndex,
                                  'stageCode',
                                  normalizeCode(event.target.value),
                                )
                              }
                            />
                            <CompetitionTextField
                              label={t('competition.stageBuilder.editPackageStageNameLabel', { number: stageIndex + 1 })}
                              value={stageDraft.stageName}
                              onChange={(event) =>
                                updatePlanEditStage(stageIndex, 'stageName', event.target.value)
                              }
                            />
                            <CompetitionTextField
                              label={t('competition.stageBuilder.editPackageStageOrderLabel', { number: stageIndex + 1 })}
                              min="1"
                              type="number"
                              value={stageDraft.stageOrder}
                              onChange={(event) =>
                                updatePlanEditStage(stageIndex, 'stageOrder', event.target.value)
                              }
                            />
                            <CompetitionSelectField
                              label={t('competition.stageBuilder.editPackageStageTypeLabel', { number: stageIndex + 1 })}
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
                            </CompetitionSelectField>
                            <CompetitionTextField
                              label={t('competition.stageBuilder.editPackageStageStartsLabel', { number: stageIndex + 1 })}
                              type="date"
                              value={stageDraft.startsOn}
                              onChange={(event) =>
                                updatePlanEditStage(stageIndex, 'startsOn', event.target.value)
                              }
                            />
                            <CompetitionTextField
                              label={t('competition.stageBuilder.editPackageStageEndsLabel', { number: stageIndex + 1 })}
                              type="date"
                              value={stageDraft.endsOn}
                              onChange={(event) =>
                                updatePlanEditStage(stageIndex, 'endsOn', event.target.value)
                              }
                            />
                          </CompetitionFieldGrid>
                        </CompetitionRow>
                      ))}
                    </CompetitionRowList>
                    {editValidationMessage ? (
                      <CompetitionInlineNotice tone="warning">{t(editValidationMessage)}</CompetitionInlineNotice>
                    ) : null}
                    <CompetitionActionRow>
                      <CompetitionButton
                        type="button"
                        disabled={Boolean(editValidationMessage) || input.isPending}
                        onClick={submitPlanEditDraft}
                      >
                        {t('competition.stageBuilder.savePackagePlanChanges')}
                      </CompetitionButton>
                      <CompetitionButton
                        variant="outline"
                        type="button"
                        onClick={() => setEditDraft(null)}
                      >
                        {t('competition.stageBuilder.cancelEdit')}
                      </CompetitionButton>
                    </CompetitionActionRow>
                  </CompetitionRow>
                ) : null}

                <CompetitionActionRow>
                  {plan.planStatus === 'draft' ? (
                    <>
                      <CompetitionButton
                        variant="outline"
                        type="button"
                        disabled={input.isPending}
                        onClick={() => setEditDraft(createStagePackagePlanEditDraft(plan))}
                      >
                        {t('competition.stageBuilder.editPlanButton', { planName: plan.planName })}
                      </CompetitionButton>
                      <CompetitionButton
                        variant="outline"
                        type="button"
                        disabled={input.isPending}
                        onClick={() => input.onCancelPlan(plan.planId)}
                      >
                        {t('competition.stageBuilder.cancelPlanButton', { planName: plan.planName })}
                      </CompetitionButton>
                      <CompetitionButton
                        type="button"
                        disabled={input.isPending}
                        onClick={() => input.onSubmitPlan(plan.planId)}
                      >
                        {t('competition.stageBuilder.markReadyButton', { planName: plan.planName })}
                      </CompetitionButton>
                    </>
                  ) : null}
                  {plan.planStatus === 'approved' ? (
                    <CompetitionButton
                      type="button"
                      disabled={input.isPending}
                      onClick={() => input.onExecutePlan(plan.planId)}
                    >
                      {t('competition.stageBuilder.executePlanButton', { planName: plan.planName })}
                    </CompetitionButton>
                  ) : null}
                  {plan.planStatus === 'rejected' ? (
                    <CompetitionButton
                      type="button"
                      disabled={input.isPending}
                      onClick={() => input.onClonePlan(plan.planId)}
                    >
                      {t('competition.stageBuilder.clonePlanButton', { planName: plan.planName })}
                    </CompetitionButton>
                  ) : null}
                  <CompetitionButton
                    variant="outline"
                    type="button"
                    disabled={input.isPending}
                    onClick={() => input.onShowPlanHistory(plan.planId)}
                  >
                    {t('competition.stageBuilder.showHistoryButton', { planName: plan.planName })}
                  </CompetitionButton>
                </CompetitionActionRow>

                {plan.planStatus === 'submitted' ? (
                  <CompetitionRow>
                    <StagePackagePlanDecisionPreview plan={plan} />
                    <CompetitionTextField
                      label={t('competition.stageBuilder.decisionNoteLabel', { planName: plan.planName })}
                      value={reviewNotes[plan.planId] ?? ''}
                      onChange={(event) => updateReviewNote(plan.planId, event.target.value)}
                    />
                    <CompetitionActionRow>
                      <CompetitionButton
                        type="button"
                        disabled={input.isPending}
                        onClick={() => input.onApprovePlan(plan.planId, getReviewPayload(plan.planId))}
                      >
                        {t('competition.stageBuilder.approveDecisionButton', { planName: plan.planName })}
                      </CompetitionButton>
                      <CompetitionButton
                        variant="outline"
                        type="button"
                        disabled={input.isPending}
                        onClick={() => input.onRejectPlan(plan.planId, getReviewPayload(plan.planId))}
                      >
                        {t('competition.stageBuilder.returnForRevisionButton', { planName: plan.planName })}
                      </CompetitionButton>
                    </CompetitionActionRow>
                  </CompetitionRow>
                ) : null}

                {input.historyPlanId === plan.planId ? (
                  <CompetitionRowList>
                    {input.isLoadingAudit ? (
                      <CompetitionStatePanel
                        title={t('competition.stageBuilder.planHistoryLoadingTitle')}
                        copy={t('competition.stageBuilder.planHistoryLoadingCopy')}
                        isLoading
                      />
                    ) : null}
                    {!input.isLoadingAudit && input.auditEvents.length === 0 ? (
                      <CompetitionEmptyState
                        title={t('competition.stageBuilder.noPlanHistoryTitle')}
                        copy={t('competition.stageBuilder.noPlanHistoryCopy')}
                      />
                    ) : null}
                    {!input.isLoadingAudit && input.auditEvents.length > 0 ? (
                      <CompetitionRowList>
                        {input.auditEvents.map((event) => (
                          <CompetitionRow key={event.eventLogId}>
                            <CompetitionRowHeader
                              title={event.eventType}
                              description={formatAuditMetadata(event.metadata, t)}
                              badge={<CompetitionStatusBadge tone="neutral">{event.occurredAt.slice(0, 10)}</CompetitionStatusBadge>}
                            />
                          </CompetitionRow>
                        ))}
                      </CompetitionRowList>
                    ) : null}
                  </CompetitionRowList>
                ) : null}
              </CompetitionRow>
            ))}
          </CompetitionRowList>
        ) : null}
      </CompetitionRow>

      {input.feedback ? (
        <CompetitionStatePanel title={input.feedback} copy={t('competition.stageBuilder.competitionRefreshCopy')} />
      ) : null}

      {input.error ? (
        <CompetitionStatePanel
          title={t('competition.stageBuilder.stagePackageActionFailedTitle')}
          copy={getErrorMessage(input.error)}
          tone="error"
        />
      ) : null}
    </CompetitionRow>
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
      <CompetitionFieldGrid>
        <CompetitionSelectField
          label={t('competition.stageBuilder.stagePackage')}
          value={input.draft.packageCode}
          onChange={(event) => input.onUpdate('packageCode', event.target.value)}
        >
          {stagePackageOptions.map((packageOption) => (
            <option key={packageOption.code} value={packageOption.code}>
              {t(stagePackageLabelKeys[packageOption.code])}
            </option>
          ))}
        </CompetitionSelectField>
        <CompetitionTextField
          label={t('competition.stageBuilder.packagePlanName')}
          value={input.draft.planName}
          onChange={(event) => input.onUpdate('planName', event.target.value)}
        />
        <CompetitionSelectField
          label={t('competition.stageBuilder.packageTeamTemplateLabel', { number: 1 })}
          value={input.draft.firstTemplateId}
          onChange={(event) => input.onUpdate('firstTemplateId', event.target.value)}
        >
          <option value="">{t('competition.stageBuilder.selectTemplate')}</option>
          {input.templates.map((template) => (
            <option key={template.templateId} value={template.templateId}>
              {template.templateCode} - {template.templateName}
            </option>
          ))}
        </CompetitionSelectField>
        <CompetitionSelectField
          label={t('competition.stageBuilder.packageTeamTemplateLabel', { number: 2 })}
          value={input.draft.secondTemplateId}
          onChange={(event) => input.onUpdate('secondTemplateId', event.target.value)}
        >
          <option value="">{t('competition.stageBuilder.selectTemplate')}</option>
          {input.templates.map((template) => (
            <option key={template.templateId} value={template.templateId}>
              {template.templateCode} - {template.templateName}
            </option>
          ))}
        </CompetitionSelectField>
      </CompetitionFieldGrid>

      {input.validationMessage ? (
        <CompetitionInlineNotice tone="warning">{t(input.validationMessage)}</CompetitionInlineNotice>
      ) : null}
      {!input.validationMessage && input.planValidationMessage ? (
        <CompetitionInlineNotice tone="warning">{t(input.planValidationMessage)}</CompetitionInlineNotice>
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
    <CompetitionRowList>
      {input.stageDrafts.map((stageDraft, stageIndex) => (
        <CompetitionRow className="stage-package-preview-stage" key={stageDraft.stagePresetCode}>
          <CompetitionRowHeader
            title={t('competition.stageBuilder.packageStageNumber', { number: stageIndex + 1 })}
            description={formatStagePreset(stageDraft.stagePresetCode, t)}
            badge={<CompetitionStatusBadge tone="accent">{formatStageType(stageDraft.stageType, t)}</CompetitionStatusBadge>}
          />
          <CompetitionFieldGrid>
            <CompetitionTextField
              label={t('competition.stageBuilder.packageStageCodeLabel', { number: stageIndex + 1 })}
              value={stageDraft.stageCode}
              onChange={(event) =>
                input.onUpdateStage(stageIndex, 'stageCode', normalizeCode(event.target.value))
              }
            />
            <CompetitionTextField
              label={t('competition.stageBuilder.packageStageNameLabel', { number: stageIndex + 1 })}
              value={stageDraft.stageName}
              onChange={(event) =>
                input.onUpdateStage(stageIndex, 'stageName', event.target.value)
              }
            />
            <CompetitionTextField
              label={t('competition.stageBuilder.packageStageOrderLabel', { number: stageIndex + 1 })}
              min="1"
              type="number"
              value={stageDraft.stageOrder}
              onChange={(event) =>
                input.onUpdateStage(stageIndex, 'stageOrder', event.target.value)
              }
            />
            <CompetitionSelectField
              label={t('competition.stageBuilder.packageStageTypeLabel', { number: stageIndex + 1 })}
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
            </CompetitionSelectField>
            <CompetitionTextField
              label={t('competition.stageBuilder.packageStageStartsLabel', { number: stageIndex + 1 })}
              type="date"
              value={stageDraft.startsOn}
              onChange={(event) =>
                input.onUpdateStage(stageIndex, 'startsOn', event.target.value)
              }
            />
            <CompetitionTextField
              label={t('competition.stageBuilder.packageStageEndsLabel', { number: stageIndex + 1 })}
              type="date"
              value={stageDraft.endsOn}
              onChange={(event) =>
                input.onUpdateStage(stageIndex, 'endsOn', event.target.value)
              }
            />
          </CompetitionFieldGrid>
        </CompetitionRow>
      ))}
    </CompetitionRowList>
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
    <CompetitionActionRow>
      <CompetitionButton
        variant="outline"
        type="button"
        disabled={Boolean(input.planValidationMessage) || input.isPending}
        onClick={input.onSavePlan}
      >
        {t('competition.stageBuilder.savePackagePlan')}
      </CompetitionButton>
      <CompetitionButton
        type="button"
        disabled={Boolean(input.validationMessage) || input.isPending}
        onClick={input.onSubmit}
      >
        <PlusCircle data-icon="inline-start" />
        {t('competition.stageBuilder.createStagePackage')}
      </CompetitionButton>
      <CompetitionStatusBadge tone="neutral">
        {formatCount(
          2,
          'competition.stageBuilder.count.stage',
          'competition.stageBuilder.count.stages',
          t,
        )}
      </CompetitionStatusBadge>
    </CompetitionActionRow>
  )
}
