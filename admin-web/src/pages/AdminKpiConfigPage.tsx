import { useId, useState, type Dispatch, type SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings2, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import {
  getKpiConfigEditor,
  getKpiConfigAudit,
  publishKpiConfig,
  updateKpiConfigDraft,
  type AuditEvent,
  type KpiConfig,
  type KpiConfigEditorState,
  type KpiConfigVersionMetadata,
  type KpiGradingBand,
  type KpiOwnershipMatrixRow,
  type KpiOwnerRole,
  type KpiScoreBehavior,
  type KpiScoreProfileMetric,
} from '../features/reports/api'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import type { AppLocale } from '../lib/i18n'
import { formatDateTime, getErrorMessage } from '../lib/format'

type KpiConfigDiffSummary = {
  added: string[]
  removed: string[]
  changed: string[]
}

const ownerRoleOptions: KpiOwnerRole[] = [
  'DEPUTY_GM',
  'REGION_MANAGER',
  'STORE_MANAGER',
  'STORE_PERSONNEL',
  'VISUAL_TEAM',
]

const behaviorOptions: KpiScoreBehavior[] = [
  'score_only',
  'warning_first',
  'task_candidate',
]

const ownerRoleLabelKeys: Record<KpiOwnerRole, TranslationKey> = {
  DEPUTY_GM: 'adminKpiConfig.ownerRole.DEPUTY_GM',
  REGION_MANAGER: 'adminKpiConfig.ownerRole.REGION_MANAGER',
  STORE_MANAGER: 'adminKpiConfig.ownerRole.STORE_MANAGER',
  STORE_PERSONNEL: 'adminKpiConfig.ownerRole.STORE_PERSONNEL',
  VISUAL_TEAM: 'adminKpiConfig.ownerRole.VISUAL_TEAM',
}

const scoreBehaviorLabelKeys: Record<KpiScoreBehavior, TranslationKey> = {
  score_only: 'adminKpiConfig.scoreBehavior.score_only',
  warning_first: 'adminKpiConfig.scoreBehavior.warning_first',
  task_candidate: 'adminKpiConfig.scoreBehavior.task_candidate',
}

const toneLabelKeys: Record<KpiGradingBand['tone'], TranslationKey> = {
  calm: 'adminKpiConfig.tone.calm',
  accent: 'adminKpiConfig.tone.accent',
  warning: 'adminKpiConfig.tone.warning',
  danger: 'adminKpiConfig.tone.danger',
  neutral: 'adminKpiConfig.tone.neutral',
}

export function AdminKpiConfigPage() {
  const { locale, t } = useLocalization()
  const queryClient = useQueryClient()
  const [draftOverride, setDraft] = useState<KpiConfig | null>(null)
  const [publishedOverride, setPublished] = useState<KpiConfig | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const configQuery = useQuery({
    queryKey: ['kpi-config-editor'],
    queryFn: getKpiConfigEditor,
  })
  const auditQuery = useQuery({
    queryKey: ['kpi-config-audit'],
    queryFn: getKpiConfigAudit,
  })
  const draft = draftOverride ?? configQuery.data?.draftConfig ?? null
  const published = publishedOverride ?? configQuery.data?.publishedConfig ?? null
  const latestPublishedVersion = configQuery.data?.latestPublishedVersion ?? null
  const ownershipRows = useStableDraftRows(draft?.ownershipMatrix ?? [], 'ownership')
  const gradingBands = useStableDraftRows(draft?.gradingBands ?? [], 'grading-band')

  const updateDraft = (updater: (current: KpiConfig) => KpiConfig) => {
    setNotice(null)
    setDraft((current) => {
      const base = current ?? configQuery.data?.draftConfig ?? null
      return base ? updater(base) : current
    })
  }

  const saveMutation = useMutation({
    mutationFn: updateKpiConfigDraft,
    onSuccess: (result) => {
      syncEditorState(result, setDraft, setPublished)
      setNotice(t('adminKpiConfig.noticeDraftSaved'))
      void queryClient.invalidateQueries({ queryKey: ['kpi-config-editor'] })
      void queryClient.invalidateQueries({ queryKey: ['kpi-config-audit'] })
    },
  })
  const publishMutation = useMutation({
    mutationFn: publishKpiConfig,
    onSuccess: (result) => {
      syncEditorState(result, setDraft, setPublished)
      setNotice(t('adminKpiConfig.noticePublished'))
      void queryClient.invalidateQueries({ queryKey: ['kpi-config-editor'] })
      void queryClient.invalidateQueries({ queryKey: ['kpi-config'] })
      void queryClient.invalidateQueries({ queryKey: ['kpi-config-audit'] })
    },
  })

  if (configQuery.isLoading) {
    return (
      <ScreenState
        title={t('adminKpiConfig.loadingTitle')}
        copy={t('adminKpiConfig.loadingCopy')}
      />
    )
  }

  if (configQuery.isError || !draft) {
    return (
      <ScreenState
        title={t('adminKpiConfig.errorTitle')}
        copy={getErrorMessage(configQuery.error)}
        tone="error"
      />
    )
  }

  const storeWeightTotal = sumMetricWeights(draft.storeProfile.metrics)
  const personnelWeightTotal = sumMetricWeights(draft.personnelProfile.metrics)
  const publishedStoreWeightTotal = published ? sumMetricWeights(published.storeProfile.metrics) : 0
  const publishedPersonnelWeightTotal = published
    ? sumMetricWeights(published.personnelProfile.metrics)
    : 0
  const storeWeightGuidance = formatWeightGuidance({
    total: storeWeightTotal,
    profileLabel: t('adminKpiConfig.profile.store'),
    t,
  })
  const personnelWeightGuidance = formatWeightGuidance({
    total: personnelWeightTotal,
    profileLabel: t('adminKpiConfig.profile.personnel'),
    t,
  })
  const weightTotalsValid = isExactWeightTotal(storeWeightTotal) && isExactWeightTotal(personnelWeightTotal)
  const governancePreview = buildGovernancePreview({
    draft,
    published,
    hasUnpublishedChanges: Boolean(configQuery.data?.hasUnpublishedChanges),
  })

  return (
    <section className="page-stack">
      <AdminKpiConfigHero
        draft={draft}
        editorState={{ hasUnpublishedChanges: Boolean(configQuery.data?.hasUnpublishedChanges) }}
        t={t}
      />

      <KpiConfigMetricSummary
        draft={draft}
        storeWeightGuidance={storeWeightGuidance}
        storeWeightTotal={storeWeightTotal}
        personnelWeightGuidance={personnelWeightGuidance}
        personnelWeightTotal={personnelWeightTotal}
        editorState={{ hasUnpublishedChanges: Boolean(configQuery.data?.hasUnpublishedChanges) }}
        t={t}
      />

      <KpiConfigDraftLivePanel
        draft={draft}
        published={published}
        storeWeightTotal={storeWeightTotal}
        personnelWeightTotal={personnelWeightTotal}
        publishedStoreWeightTotal={publishedStoreWeightTotal}
        publishedPersonnelWeightTotal={publishedPersonnelWeightTotal}
        editorState={{ hasUnpublishedChanges: Boolean(configQuery.data?.hasUnpublishedChanges) }}
        t={t}
      />

      <KpiConfigGovernancePreviewPanel
        governancePreview={governancePreview}
        latestPublishedVersion={latestPublishedVersion}
        locale={locale}
        t={t}
      />

      <ProfileEditor
        t={t}
        title={draft.storeProfile.title}
        summary={draft.storeProfile.summary}
        futureMetricRule={draft.storeProfile.futureMetricRule}
        metrics={draft.storeProfile.metrics}
        weightTone={isExactWeightTotal(storeWeightTotal) ? 'calm' : 'warning'}
        weightLabel={t('adminKpiConfig.weightTotal', {
          total: formatWeightTotalValue(storeWeightTotal, t),
        })}
        weightGuidance={storeWeightGuidance}
        onMetricChange={(index, next) =>
          updateDraft((current) => ({
            ...current,
            storeProfile: {
              ...current.storeProfile,
              metrics: current.storeProfile.metrics.map((metric, metricIndex) =>
                metricIndex === index ? next : metric,
              ),
            },
          }))
        }
        onAddMetric={() =>
          updateDraft((current) => ({
            ...current,
            storeProfile: {
              ...current.storeProfile,
              metrics: [...current.storeProfile.metrics, createEmptyMetric()],
            },
          }))
        }
        onRemoveMetric={(index) =>
          updateDraft((current) => ({
            ...current,
            storeProfile: {
              ...current.storeProfile,
              metrics: current.storeProfile.metrics.filter(
                (_metric, metricIndex) => metricIndex !== index,
              ),
            },
          }))
        }
      />

      <ProfileEditor
        t={t}
        title={draft.personnelProfile.title}
        summary={draft.personnelProfile.summary}
        futureMetricRule={draft.personnelProfile.futureMetricRule}
        metrics={draft.personnelProfile.metrics}
        weightTone={isExactWeightTotal(personnelWeightTotal) ? 'calm' : 'warning'}
        weightLabel={t('adminKpiConfig.weightTotal', {
          total: formatWeightTotalValue(personnelWeightTotal, t),
        })}
        weightGuidance={personnelWeightGuidance}
        onMetricChange={(index, next) =>
          updateDraft((current) => ({
            ...current,
            personnelProfile: {
              ...current.personnelProfile,
              metrics: current.personnelProfile.metrics.map((metric, metricIndex) =>
                metricIndex === index ? next : metric,
              ),
            },
          }))
        }
        onAddMetric={() =>
          updateDraft((current) => ({
            ...current,
            personnelProfile: {
              ...current.personnelProfile,
              metrics: [...current.personnelProfile.metrics, createEmptyMetric()],
            },
          }))
        }
        onRemoveMetric={(index) =>
          updateDraft((current) => ({
            ...current,
            personnelProfile: {
              ...current.personnelProfile,
              metrics: current.personnelProfile.metrics.filter(
                (_metric, metricIndex) => metricIndex !== index,
              ),
            },
          }))
        }
      />

      <OwnershipMatrixPanel
        draft={draft}
        rows={ownershipRows}
        setDraft={setDraft}
        t={t}
        updateDraft={updateDraft}
      />

      <GradingBandsPanel
        draft={draft}
        rows={gradingBands}
        setDraft={setDraft}
        t={t}
        updateDraft={updateDraft}
      />

      <KpiConfigPersistPanel
        draft={draft}
        notice={notice}
        onPublish={() => publishMutation.mutate()}
        onSave={() => saveMutation.mutate(draft)}
        saveError={saveMutation.error}
        status={{
          hasUnpublishedChanges: Boolean(configQuery.data?.hasUnpublishedChanges),
          publishPending: publishMutation.isPending,
          saveErrorVisible: saveMutation.isError,
          savePending: saveMutation.isPending,
          weightTotalsValid,
        }}
        t={t}
      />

      <KpiConfigAuditPanel
        auditState={{
          error: auditQuery.error,
          items: auditQuery.data?.items ?? [],
          loading: auditQuery.isLoading,
          showError: auditQuery.isError,
        }}
        locale={locale}
        t={t}
      />
    </section>
  )
}

type KpiConfigEditorStatus = {
  hasUnpublishedChanges: boolean
}

type StableDraftRow<T> = {
  item: T
  key: string
}

function AdminKpiConfigHero(input: {
  draft: KpiConfig
  editorState: KpiConfigEditorStatus
  t: TranslateFunction
}) {
  return (
    <section className="hero-panel">
      <div>
        <div className="eyebrow">{input.t('adminKpiConfig.heroEyebrow')}</div>
        <h2 className="hero-title">{input.t('adminKpiConfig.heroTitle')}</h2>
        <p className="hero-copy">{input.t('adminKpiConfig.heroCopy')}</p>
      </div>
      <div className="hero-metrics">
        <MetricAccent label={input.t('adminKpiConfig.route')} value="/admin/kpi-config" />
        <MetricAccent
          label={input.t('adminKpiConfig.storeMetrics')}
          value={String(input.draft.storeProfile.metrics.length)}
        />
        <MetricAccent
          label={input.t('adminKpiConfig.ownershipRows')}
          value={String(input.draft.ownershipMatrix.length)}
        />
        <MetricAccent
          label={input.t('adminKpiConfig.gradingBandsMetric')}
          value={String(input.draft.gradingBands.length)}
        />
        <MetricAccent
          label={input.t('adminKpiConfig.mode')}
          value={
            input.editorState.hasUnpublishedChanges
              ? input.t('adminKpiConfig.draftDirty')
              : input.t('adminKpiConfig.publishedInSync')
          }
        />
      </div>
    </section>
  )
}

function KpiConfigMetricSummary(input: {
  draft: KpiConfig
  editorState: KpiConfigEditorStatus
  storeWeightGuidance: string
  storeWeightTotal: number
  personnelWeightGuidance: string
  personnelWeightTotal: number
  t: TranslateFunction
}) {
  return (
    <section className="metric-grid">
      <MetricCard
        title={input.t('adminKpiConfig.storeWeightTotal')}
        value={formatWeightTotalValue(input.storeWeightTotal, input.t)}
        note={input.storeWeightGuidance}
        icon={<SlidersHorizontal size={18} />}
        tone={isExactWeightTotal(input.storeWeightTotal) ? 'calm' : 'warning'}
      />
      <MetricCard
        title={input.t('adminKpiConfig.personnelWeightTotal')}
        value={formatWeightTotalValue(input.personnelWeightTotal, input.t)}
        note={input.personnelWeightGuidance}
        icon={<Settings2 size={18} />}
        tone={isExactWeightTotal(input.personnelWeightTotal) ? 'calm' : 'warning'}
      />
      <MetricCard
        title={input.t('adminKpiConfig.taskCandidates')}
        value={input.draft.ownershipMatrix.filter((row) => row.taskCandidate).length}
        note={input.t('adminKpiConfig.taskCandidatesNote')}
        icon={<ShieldCheck size={18} />}
        tone="accent"
      />
      <MetricCard
        title={input.t('adminKpiConfig.publishState')}
        value={input.editorState.hasUnpublishedChanges ? 1 : 0}
        note={
          input.editorState.hasUnpublishedChanges
            ? input.t('adminKpiConfig.draftDiffersFromLive')
            : input.t('adminKpiConfig.draftMatchesLive')
        }
        icon={<ShieldCheck size={18} />}
        tone={input.editorState.hasUnpublishedChanges ? 'warning' : 'calm'}
      />
    </section>
  )
}

function KpiConfigDraftLivePanel(input: {
  draft: KpiConfig
  published: KpiConfig | null
  editorState: KpiConfigEditorStatus
  storeWeightTotal: number
  personnelWeightTotal: number
  publishedStoreWeightTotal: number
  publishedPersonnelWeightTotal: number
  t: TranslateFunction
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('adminKpiConfig.publishModel')}</div>
          <h3>{input.t('adminKpiConfig.draftVsLiveTitle')}</h3>
        </div>
        <StatusPill tone={input.editorState.hasUnpublishedChanges ? 'warning' : 'calm'}>
          {input.editorState.hasUnpublishedChanges
            ? input.t('adminKpiConfig.unpublishedChanges')
            : input.t('adminKpiConfig.live')}
        </StatusPill>
      </div>
      <div className="key-grid">
        <KeyValue
          label={input.t('adminKpiConfig.draftStoreWeight')}
          value={formatWeightPercent(input.storeWeightTotal, input.t)}
        />
        <KeyValue
          label={input.t('adminKpiConfig.liveStoreWeight')}
          value={formatWeightPercent(input.publishedStoreWeightTotal, input.t)}
        />
        <KeyValue
          label={input.t('adminKpiConfig.draftPersonnelWeight')}
          value={formatWeightPercent(input.personnelWeightTotal, input.t)}
        />
        <KeyValue
          label={input.t('adminKpiConfig.livePersonnelWeight')}
          value={formatWeightPercent(input.publishedPersonnelWeightTotal, input.t)}
        />
        <KeyValue
          label={input.t('adminKpiConfig.draftGradingBands')}
          value={String(input.draft.gradingBands.length)}
        />
        <KeyValue
          label={input.t('adminKpiConfig.liveGradingBands')}
          value={String(input.published?.gradingBands.length ?? 0)}
        />
      </div>
    </section>
  )
}

function KpiConfigGovernancePreviewPanel(input: {
  governancePreview: ReturnType<typeof buildGovernancePreview>
  latestPublishedVersion: KpiConfigVersionMetadata | null
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <section className="panel" aria-label={input.t('adminKpiConfig.governancePreview')}>
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('adminKpiConfig.governancePreview')}</div>
          <h3>{input.t('adminKpiConfig.publishDecisionPreview')}</h3>
        </div>
        <StatusPill tone={input.governancePreview.tone}>
          {input.t(input.governancePreview.statusKey)}
        </StatusPill>
      </div>
      <p className="queue-subtitle">{input.t(input.governancePreview.summaryKey)}</p>
      <div className="key-grid">
        <KeyValue
          label={input.t('adminKpiConfig.storeProfileDiff')}
          value={formatDiffSummary(input.governancePreview.storeProfile, input.t)}
        />
        <KeyValue
          label={input.t('adminKpiConfig.personnelProfileDiff')}
          value={formatDiffSummary(input.governancePreview.personnelProfile, input.t)}
        />
        <KeyValue
          label={input.t('adminKpiConfig.ownershipDiff')}
          value={formatDiffSummary(input.governancePreview.ownershipMatrix, input.t)}
        />
        <KeyValue
          label={input.t('adminKpiConfig.gradingDiff')}
          value={formatDiffSummary(input.governancePreview.gradingBands, input.t)}
        />
        <KeyValue
          label={input.t('adminKpiConfig.versionedSchema')}
          value={
            input.latestPublishedVersion?.versionNo
              ? input.t('adminKpiConfig.active')
              : input.t('adminKpiConfig.preGovernance')
          }
        />
        <KeyValue
          label={input.t('adminKpiConfig.latestVersion')}
          value={formatKpiConfigVersion(input.latestPublishedVersion, input.t)}
        />
        <KeyValue
          label={input.t('adminKpiConfig.publishedAt')}
          value={
            input.latestPublishedVersion?.publishedAt
              ? formatDateTime(input.latestPublishedVersion.publishedAt, input.locale)
              : input.t('adminKpiConfig.notPublishedYet')
          }
        />
        <KeyValue
          label={input.t('adminKpiConfig.rollback')}
          value={input.t('adminKpiConfig.rollbackInactive')}
        />
        <KeyValue
          label={input.t('adminKpiConfig.snapshotAnchoring')}
          value={input.t('adminKpiConfig.snapshotAnchoringActive')}
        />
      </div>
      <p className="queue-subtitle">{input.t('adminKpiConfig.snapshotAnchoringCopy')}</p>
    </section>
  )
}

function OwnershipMatrixPanel(input: {
  draft: KpiConfig
  rows: Array<StableDraftRow<KpiOwnershipMatrixRow>>
  setDraft: Dispatch<SetStateAction<KpiConfig | null>>
  t: TranslateFunction
  updateDraft: (updater: (current: KpiConfig) => KpiConfig) => void
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('adminKpiConfig.ownershipMatrix')}</div>
          <h3>{input.t('adminKpiConfig.ownershipTitle')}</h3>
        </div>
        <StatusPill tone="accent">{input.t('adminKpiConfig.editable')}</StatusPill>
      </div>
      {input.draft.ownershipMatrix.length === 0 ? (
        <EmptyState copy={input.t('adminKpiConfig.noOwnershipRows')} />
      ) : (
        <div className="stacked-table">
          {input.rows.map(({ item: row, key }, index) => {
            const rowReference = formatEditorRowReference(row.code, row.label, index)

            return (
              <div
                aria-label={`${input.t('adminKpiConfig.ownershipMatrix')}: ${rowReference}`}
                className="stacked-row"
                key={key}
                role="group"
              >
                <div className="key-grid">
                  <TextField
                    label={input.t('adminKpiConfig.field.code')}
                    value={row.code}
                    onChange={(next) =>
                      updateOwnershipRow(input.setDraft, input.draft, index, { ...row, code: next })
                    }
                  />
                  <TextField
                    label={input.t('adminKpiConfig.field.label')}
                    value={row.label}
                    onChange={(next) =>
                      updateOwnershipRow(input.setDraft, input.draft, index, { ...row, label: next })
                    }
                  />
                  <SelectField
                    label={input.t('adminKpiConfig.field.owner')}
                    value={row.operationalOwner}
                    options={ownerRoleOptions}
                    optionLabel={(option) => formatOwnerRole(option as KpiOwnerRole, input.t)}
                    onChange={(next) =>
                      updateOwnershipRow(input.setDraft, input.draft, index, {
                        ...row,
                        operationalOwner: next as KpiOwnerRole,
                      })
                    }
                  />
                  <TextField
                    label={input.t('adminKpiConfig.field.visibleTo')}
                    value={row.visibleTo.join(', ')}
                    onChange={(next) =>
                      updateOwnershipRow(input.setDraft, input.draft, index, {
                        ...row,
                        visibleTo: splitCsv(next) as KpiOwnerRole[],
                      })
                    }
                  />
                  <TextField
                    label={input.t('adminKpiConfig.field.contributesTo')}
                    value={row.contributesTo.join(', ')}
                    onChange={(next) =>
                      updateOwnershipRow(input.setDraft, input.draft, index, {
                        ...row,
                        contributesTo: splitCsv(next) as Array<'store' | 'personnel'>,
                      })
                    }
                  />
                  <SelectField
                    label={input.t('adminKpiConfig.field.taskCandidate')}
                    value={row.taskCandidate ? 'true' : 'false'}
                    options={['true', 'false']}
                    optionLabel={(option) => formatBooleanOption(option, input.t)}
                    onChange={(next) =>
                      updateOwnershipRow(input.setDraft, input.draft, index, {
                        ...row,
                        taskCandidate: next === 'true',
                      })
                    }
                  />
                </div>
                <div className="action-cluster">
                  <button
                    aria-label={`${input.t('adminKpiConfig.removeRow')}: ${rowReference}`}
                    className="control-button"
                    type="button"
                    onClick={() =>
                      input.updateDraft((current) => ({
                        ...current,
                        ownershipMatrix: current.ownershipMatrix.filter(
                          (_item, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                  >
                    {input.t('adminKpiConfig.removeRow')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          onClick={() =>
            input.updateDraft((current) => ({
              ...current,
              ownershipMatrix: [...current.ownershipMatrix, createEmptyOwnershipRow()],
            }))
          }
        >
          {input.t('adminKpiConfig.addOwnershipRow')}
        </button>
      </div>
    </section>
  )
}

function GradingBandsPanel(input: {
  draft: KpiConfig
  rows: Array<StableDraftRow<KpiGradingBand>>
  setDraft: Dispatch<SetStateAction<KpiConfig | null>>
  t: TranslateFunction
  updateDraft: (updater: (current: KpiConfig) => KpiConfig) => void
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('adminKpiConfig.gradingBands')}</div>
          <h3>{input.t('adminKpiConfig.gradingBandsTitle')}</h3>
        </div>
        <StatusPill tone="accent">{input.t('adminKpiConfig.editable')}</StatusPill>
      </div>
      <div className="stacked-table">
        {input.rows.map(({ item: band, key }, index) => {
          const rowReference = formatEditorRowReference(band.code, band.label, index)

          return (
            <div
              aria-label={`${input.t('adminKpiConfig.gradingBands')}: ${rowReference}`}
              className="stacked-row"
              key={key}
              role="group"
            >
              <div className="key-grid">
                <TextField
                  label={input.t('adminKpiConfig.field.code')}
                  value={band.code}
                  onChange={(next) =>
                    updateGradingBand(input.setDraft, input.draft, index, { ...band, code: next })
                  }
                />
                <TextField
                  label={input.t('adminKpiConfig.field.label')}
                  value={band.label}
                  onChange={(next) =>
                    updateGradingBand(input.setDraft, input.draft, index, { ...band, label: next })
                  }
                />
                <TextField
                  label={input.t('adminKpiConfig.field.emoji')}
                  value={band.emoji}
                  onChange={(next) =>
                    updateGradingBand(input.setDraft, input.draft, index, { ...band, emoji: next })
                  }
                />
                <SelectField
                  label={input.t('adminKpiConfig.field.tone')}
                  value={band.tone}
                  options={['calm', 'accent', 'warning', 'danger', 'neutral']}
                  optionLabel={(option) => formatToneOption(option as KpiGradingBand['tone'], input.t)}
                  onChange={(next) =>
                    updateGradingBand(input.setDraft, input.draft, index, {
                      ...band,
                      tone: next as KpiGradingBand['tone'],
                    })
                  }
                />
                <NumberField
                  label={input.t('adminKpiConfig.field.minScore')}
                  value={band.minScore}
                  onChange={(next) =>
                    updateGradingBand(input.setDraft, input.draft, index, { ...band, minScore: next })
                  }
                />
              </div>
              <div className="action-cluster">
                <button
                  aria-label={`${input.t('adminKpiConfig.removeBand')}: ${rowReference}`}
                  className="control-button"
                  type="button"
                  onClick={() =>
                    input.updateDraft((current) => ({
                      ...current,
                      gradingBands: current.gradingBands.filter(
                        (_item, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                >
                  {input.t('adminKpiConfig.removeBand')}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          onClick={() =>
            input.updateDraft((current) => ({
              ...current,
              gradingBands: [...current.gradingBands, createEmptyGradingBand()],
            }))
          }
        >
          {input.t('adminKpiConfig.addGradingBand')}
        </button>
      </div>
    </section>
  )
}

type KpiConfigPersistStatus = {
  hasUnpublishedChanges: boolean
  publishPending: boolean
  saveErrorVisible: boolean
  savePending: boolean
  weightTotalsValid: boolean
}

function KpiConfigPersistPanel(input: {
  draft: KpiConfig
  notice: string | null
  onPublish: () => void
  onSave: () => void
  saveError: unknown
  status: KpiConfigPersistStatus
  t: TranslateFunction
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('adminKpiConfig.saveEyebrow')}</div>
          <h3>{input.t('adminKpiConfig.persistTitle')}</h3>
        </div>
        <StatusPill tone={input.status.savePending || !input.status.weightTotalsValid ? 'warning' : 'calm'}>
          {input.status.savePending
            ? input.t('adminKpiConfig.saving')
            : input.status.weightTotalsValid
              ? input.t('adminKpiConfig.ready')
              : input.t('adminKpiConfig.needsWeightBalance')}
        </StatusPill>
      </div>
      <div className="key-grid">
        <KeyValue
          label={input.t('adminKpiConfig.saveStoreProfile')}
          value={input.draft.storeProfile.title}
        />
        <KeyValue
          label={input.t('adminKpiConfig.savePersonnelProfile')}
          value={input.draft.personnelProfile.title}
        />
        <KeyValue
          label={input.t('adminKpiConfig.matrixRows')}
          value={String(input.draft.ownershipMatrix.length)}
        />
        <KeyValue
          label={input.t('adminKpiConfig.gradingBands')}
          value={String(input.draft.gradingBands.length)}
        />
        <KeyValue label={input.t('adminKpiConfig.persistence')} value="ops.kpi_score_profile_config" />
      </div>
      {input.notice ? <p className="queue-subtitle">{input.notice}</p> : null}
      {!input.status.weightTotalsValid ? (
        <p className="queue-subtitle">{input.t('adminKpiConfig.weightSaveBlocked')}</p>
      ) : null}
      {input.status.saveErrorVisible ? (
        <p className="queue-subtitle">{getErrorMessage(input.saveError)}</p>
      ) : null}
      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          disabled={
            input.status.savePending ||
            input.status.publishPending ||
            !input.status.weightTotalsValid
          }
          onClick={input.onSave}
        >
          {input.status.savePending
            ? input.t('adminKpiConfig.saveDraftPending')
            : input.t('adminKpiConfig.saveDraft')}
        </button>
        <button
          className="control-button"
          type="button"
          disabled={
            input.status.publishPending ||
            input.status.savePending ||
            !input.status.weightTotalsValid ||
            !input.status.hasUnpublishedChanges
          }
          onClick={input.onPublish}
        >
          {input.status.publishPending
            ? input.t('adminKpiConfig.publishPending')
            : input.t('adminKpiConfig.publishLiveConfig')}
        </button>
      </div>
    </section>
  )
}

type KpiConfigAuditState = {
  error: unknown
  items: AuditEvent[]
  loading: boolean
  showError: boolean
}

function KpiConfigAuditPanel(input: {
  auditState: KpiConfigAuditState
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('adminKpiConfig.recentChanges')}</div>
          <h3>{input.t('adminKpiConfig.auditTrailTitle')}</h3>
        </div>
        <StatusPill tone={input.auditState.loading ? 'warning' : 'accent'}>
          {input.auditState.loading ? input.t('adminKpiConfig.loading') : input.t('adminKpiConfig.live')}
        </StatusPill>
      </div>
      {input.auditState.showError ? (
        <p className="queue-subtitle">{getErrorMessage(input.auditState.error)}</p>
      ) : input.auditState.items.length > 0 ? (
        <div className="stacked-table">
          {input.auditState.items.map((item) => (
            <KpiConfigAuditRow item={item} key={item.eventLogId} locale={input.locale} t={input.t} />
          ))}
        </div>
      ) : (
        <EmptyState copy={input.t('adminKpiConfig.noChangesSaved')} />
      )}
    </section>
  )
}

function buildGovernancePreview(input: {
  draft: KpiConfig
  published: KpiConfig | null
  hasUnpublishedChanges: boolean
}) {
  const published = input.published ?? createEmptyKpiConfig()
  const storeProfile = diffByCode(input.draft.storeProfile.metrics, published.storeProfile.metrics)
  const personnelProfile = diffByCode(
    input.draft.personnelProfile.metrics,
    published.personnelProfile.metrics,
  )
  const ownershipMatrix = diffByCode(input.draft.ownershipMatrix, published.ownershipMatrix)
  const gradingBands = diffByCode(input.draft.gradingBands, published.gradingBands)

  return {
    storeProfile,
    personnelProfile,
    ownershipMatrix,
    gradingBands,
    statusKey: input.hasUnpublishedChanges
      ? 'adminKpiConfig.reviewBeforePublish'
      : 'adminKpiConfig.noDraftDelta',
    summaryKey: input.hasUnpublishedChanges
      ? 'adminKpiConfig.draftAffectsLive'
      : 'adminKpiConfig.draftMatchesLiveInterpretation',
    tone: input.hasUnpublishedChanges ? 'warning' : 'calm',
  } as const
}

function createEmptyKpiConfig(): KpiConfig {
  return {
    storeProfile: {
      profileCode: 'store',
      title: '',
      summary: '',
      metrics: [],
      futureMetricRule: '',
    },
    personnelProfile: {
      profileCode: 'personnel',
      title: '',
      summary: '',
      metrics: [],
      futureMetricRule: '',
    },
    ownershipMatrix: [],
    gradingBands: [],
  }
}

function sumMetricWeights(metrics: KpiScoreProfileMetric[]) {
  if (metrics.some((metric) => !Number.isFinite(metric.weightPercent))) {
    return Number.NaN
  }

  return metrics.reduce((sum, metric) => sum + metric.weightPercent, 0)
}

function isExactWeightTotal(total: number) {
  return Number.isFinite(total) && total === 100
}

function formatWeightTotalValue(total: number, t: TranslateFunction) {
  return Number.isFinite(total) ? total : t('adminKpiConfig.invalidWeightValue')
}

function formatWeightPercent(total: number, t: TranslateFunction) {
  return Number.isFinite(total)
    ? t('adminKpiConfig.weightTotal', { total })
    : t('adminKpiConfig.invalidWeightValue')
}

function formatWeightGuidance(input: {
  total: number
  profileLabel: string
  t: TranslateFunction
}) {
  if (!Number.isFinite(input.total)) {
    return input.t('adminKpiConfig.weightInvalid', { profile: input.profileLabel })
  }

  if (input.total === 100) {
    return input.t('adminKpiConfig.weightBalanced', { profile: input.profileLabel })
  }

  if (input.total < 100) {
    return input.t('adminKpiConfig.weightShort', {
      profile: input.profileLabel,
      amount: 100 - input.total,
    })
  }

  return input.t('adminKpiConfig.weightOver', {
    profile: input.profileLabel,
    amount: input.total - 100,
  })
}

function diffByCode<T extends { code: string }>(
  draftRows: T[],
  publishedRows: T[],
): KpiConfigDiffSummary {
  const draftByCode = new Map(draftRows.map((row) => [row.code, row]))
  const publishedByCode = new Map(publishedRows.map((row) => [row.code, row]))
  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []

  for (const row of draftRows) {
    const publishedRow = publishedByCode.get(row.code)

    if (!publishedRow) {
      added.push(row.code)
    } else if (JSON.stringify(row) !== JSON.stringify(publishedRow)) {
      changed.push(row.code)
    }
  }

  for (const row of publishedRows) {
    if (!draftByCode.has(row.code)) {
      removed.push(row.code)
    }
  }

  return { added, removed, changed }
}

function KpiConfigAuditRow(input: { item: AuditEvent; locale: AppLocale; t: TranslateFunction }) {
  const diffSummary =
    input.item.metadata.diffSummary && typeof input.item.metadata.diffSummary === 'object'
      ? (input.item.metadata.diffSummary as {
          storeProfile?: { added?: unknown; removed?: unknown; changed?: unknown }
          personnelProfile?: { added?: unknown; removed?: unknown; changed?: unknown }
          ownershipMatrix?: { added?: unknown; removed?: unknown; changed?: unknown }
          gradingBands?: { added?: unknown; removed?: unknown; changed?: unknown }
        })
      : null

  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <strong>{input.item.eventType}</strong>
        <StatusPill tone="accent">{formatDateTime(input.item.occurredAt, input.locale)}</StatusPill>
      </div>
      <p>
        {input.t('adminKpiConfig.auditSummary', {
          actor: input.item.actorUserId ?? input.t('adminKpiConfig.unknown'),
          storeMetricCount: String(
            input.item.metadata.storeMetricCount ?? input.t('adminKpiConfig.notAvailable'),
          ),
          personnelMetricCount: String(
            input.item.metadata.personnelMetricCount ?? input.t('adminKpiConfig.notAvailable'),
          ),
          ownershipRowCount: String(
            input.item.metadata.ownershipRowCount ?? input.t('adminKpiConfig.notAvailable'),
          ),
        })}
      </p>
      {diffSummary ? (
        <div className="key-grid">
          <KeyValue
            label={input.t('adminKpiConfig.storeDiff')}
            value={formatDiffSummary(diffSummary.storeProfile, input.t)}
          />
          <KeyValue
            label={input.t('adminKpiConfig.personnelDiff')}
            value={formatDiffSummary(diffSummary.personnelProfile, input.t)}
          />
          <KeyValue
            label={input.t('adminKpiConfig.ownershipDiff')}
            value={formatDiffSummary(diffSummary.ownershipMatrix, input.t)}
          />
          <KeyValue
            label={input.t('adminKpiConfig.gradingDiff')}
            value={formatDiffSummary(diffSummary.gradingBands, input.t)}
          />
        </div>
      ) : null}
      <span className="queue-subtitle">
        {input.t('adminKpiConfig.correlation', {
          correlationId: input.item.correlationId ?? input.t('adminKpiConfig.notAvailable'),
        })}
      </span>
    </article>
  )
}

function formatDiffSummary(
  input: { added?: unknown; removed?: unknown; changed?: unknown } | undefined,
  t: TranslateFunction,
) {
  if (!input) {
    return t('adminKpiConfig.notAvailable')
  }

  const added = Array.isArray(input.added) ? input.added.length : 0
  const removed = Array.isArray(input.removed) ? input.removed.length : 0
  const changed = Array.isArray(input.changed) ? input.changed.length : 0

  return `+${added} / ~${changed} / -${removed}`
}

function formatKpiConfigVersion(
  input: KpiConfigVersionMetadata | null | undefined,
  t: TranslateFunction,
) {
  return input?.versionNo
    ? t('adminKpiConfig.versionValue', { version: input.versionNo })
    : t('adminKpiConfig.noPublishedVersion')
}

function useStableDraftRows<T>(items: T[], prefix: string) {
  const idPrefix = useId()

  return items.map((item, index) => ({
    item,
    key: `${idPrefix}-${prefix}-${index}`,
  }))
}

function ProfileEditor(input: {
  t: TranslateFunction
  title: string
  summary: string
  futureMetricRule: string
  metrics: KpiScoreProfileMetric[]
  weightLabel: string
  weightTone: 'calm' | 'warning' | 'accent'
  weightGuidance: string
  onMetricChange: (index: number, next: KpiScoreProfileMetric) => void
  onAddMetric: () => void
  onRemoveMetric: (index: number) => void
}) {
  const metricRows = useStableDraftRows(input.metrics, 'profile-metric')

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('adminKpiConfig.scoreProfile')}</div>
          <h3>{input.title}</h3>
        </div>
        <StatusPill tone={input.weightTone}>{input.weightLabel}</StatusPill>
      </div>
      <p className="queue-subtitle">{input.summary}</p>
      <p className="queue-subtitle">{input.weightGuidance}</p>
      <div className="stacked-table">
        {metricRows.map(({ item: metric, key }, index) => {
          const rowReference = formatEditorRowReference(metric.code, metric.label, index)

          return (
            <div
              aria-label={`${input.title} ${input.t('adminKpiConfig.metricRow')} ${rowReference}`}
              className="stacked-row"
              key={key}
              role="group"
            >
              <div className="key-grid">
                <TextField
                  label={input.t('adminKpiConfig.field.code')}
                  value={metric.code}
                  onChange={(next) => input.onMetricChange(index, { ...metric, code: next })}
                />
                <TextField
                  label={input.t('adminKpiConfig.field.label')}
                  value={metric.label}
                  onChange={(next) => input.onMetricChange(index, { ...metric, label: next })}
                />
                <NumberField
                  label={input.t('adminKpiConfig.field.weight')}
                  value={metric.weightPercent}
                  onChange={(next) =>
                    input.onMetricChange(index, { ...metric, weightPercent: next })
                  }
                />
                <SelectField
                  label={input.t('adminKpiConfig.field.owner')}
                  value={metric.ownerRole}
                  options={ownerRoleOptions}
                  optionLabel={(option) => formatOwnerRole(option as KpiOwnerRole, input.t)}
                  onChange={(next) =>
                    input.onMetricChange(index, {
                      ...metric,
                      ownerRole: next as KpiOwnerRole,
                    })
                  }
                />
                <SelectField
                  label={input.t('adminKpiConfig.field.behavior')}
                  value={metric.scoreBehavior}
                  options={behaviorOptions}
                  optionLabel={(option) => formatScoreBehavior(option as KpiScoreBehavior, input.t)}
                  onChange={(next) =>
                    input.onMetricChange(index, {
                      ...metric,
                      scoreBehavior: next as KpiScoreBehavior,
                    })
                  }
                />
                <TextField
                  label={input.t('adminKpiConfig.field.aliases')}
                  value={(metric.aliases ?? []).join(', ')}
                  onChange={(next) =>
                    input.onMetricChange(index, {
                      ...metric,
                      aliases: splitCsv(next),
                    })
                  }
                />
              </div>
              <TextField
                label={input.t('adminKpiConfig.field.notes')}
                value={metric.notes ?? ''}
                onChange={(next) => input.onMetricChange(index, { ...metric, notes: next })}
              />
              <div className="action-cluster">
                <button
                  aria-label={`${input.t('adminKpiConfig.removeMetric')}: ${input.title} ${rowReference}`}
                  className="control-button"
                  type="button"
                  onClick={() => input.onRemoveMetric(index)}
                >
                  {input.t('adminKpiConfig.removeMetric')}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="action-cluster">
        <button className="control-button" type="button" onClick={input.onAddMetric}>
          {input.t('adminKpiConfig.addMetric')}
        </button>
      </div>
      <p className="queue-subtitle">{input.futureMetricRule}</p>
    </section>
  )
}

function TextField(input: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <label>
      <span className="eyebrow">{input.label}</span>
      <input value={input.value} onChange={(event) => input.onChange(event.target.value)} />
    </label>
  )
}

function NumberField(input: {
  label: string
  value: number
  onChange: (next: number) => void
}) {
  return (
    <label>
      <span className="eyebrow">{input.label}</span>
      <input
        type="number"
        value={Number.isFinite(input.value) ? input.value : ''}
        onChange={(event) => {
          const nextValue = event.target.value
          input.onChange(nextValue.trim() === '' ? Number.NaN : Number(nextValue))
        }}
      />
    </label>
  )
}

function SelectField(input: {
  label: string
  value: string
  options: string[]
  optionLabel?: (option: string) => string
  onChange: (next: string) => void
}) {
  return (
    <label>
      <span className="eyebrow">{input.label}</span>
      <select value={input.value} onChange={(event) => input.onChange(event.target.value)}>
        {input.options.map((option) => (
          <option key={option} value={option}>
            {input.optionLabel ? input.optionLabel(option) : option}
          </option>
        ))}
      </select>
    </label>
  )
}

function formatEditorRowReference(code: string, label: string, index: number) {
  return code.trim() || label.trim() || `#${index + 1}`
}

function formatOwnerRole(role: KpiOwnerRole, t: TranslateFunction) {
  return t(ownerRoleLabelKeys[role])
}

function formatScoreBehavior(behavior: KpiScoreBehavior, t: TranslateFunction) {
  return t(scoreBehaviorLabelKeys[behavior])
}

function formatToneOption(tone: KpiGradingBand['tone'], t: TranslateFunction) {
  return t(toneLabelKeys[tone])
}

function formatBooleanOption(option: string, t: TranslateFunction) {
  return option === 'true'
    ? t('adminKpiConfig.boolean.true')
    : t('adminKpiConfig.boolean.false')
}

function splitCsv(input: string) {
  return input
    .split(',')
    .flatMap((item) => {
      const value = item.trim()
      return value ? [value] : []
    })
}

function createEmptyMetric(): KpiScoreProfileMetric {
  return {
    code: '',
    label: '',
    weightPercent: 0,
    ownerRole: 'STORE_MANAGER',
    scoreBehavior: 'warning_first',
    aliases: [],
    notes: '',
  }
}

function createEmptyOwnershipRow(): KpiOwnershipMatrixRow {
  return {
    code: '',
    label: '',
    visibleTo: ['STORE_MANAGER'],
    operationalOwner: 'STORE_MANAGER',
    contributesTo: ['store'],
    taskCandidate: false,
  }
}

function createEmptyGradingBand(): KpiGradingBand {
  return {
    code: '',
    label: '',
    emoji: '🙂',
    tone: 'neutral',
    minScore: 0,
  }
}

function updateOwnershipRow(
  setDraft: Dispatch<SetStateAction<KpiConfig | null>>,
  draft: KpiConfig,
  index: number,
  nextRow: KpiOwnershipMatrixRow,
) {
  setDraft((current) => {
    const base = current ?? draft

    return {
      ...base,
      ownershipMatrix: base.ownershipMatrix.map((row, rowIndex) =>
        rowIndex === index ? nextRow : row,
      ),
    }
  })
}

function updateGradingBand(
  setDraft: Dispatch<SetStateAction<KpiConfig | null>>,
  draft: KpiConfig,
  index: number,
  nextBand: KpiGradingBand,
) {
  setDraft((current) => {
    const base = current ?? draft

    return {
      ...base,
      gradingBands: base.gradingBands.map((band, bandIndex) =>
        bandIndex === index ? nextBand : band,
      ),
    }
  })
}

function syncEditorState(
  input: KpiConfigEditorState,
  setDraft: Dispatch<SetStateAction<KpiConfig | null>>,
  setPublished: Dispatch<SetStateAction<KpiConfig | null>>,
) {
  setDraft(input.draftConfig)
  setPublished(input.publishedConfig)
}
