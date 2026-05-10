import { useState, type Dispatch, type SetStateAction } from 'react'
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

  const updateDraft = (updater: (current: KpiConfig) => KpiConfig) => {
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

  const storeWeightTotal = draft.storeProfile.metrics.reduce(
    (sum, metric) => sum + metric.weightPercent,
    0,
  )
  const personnelWeightTotal = draft.personnelProfile.metrics.reduce(
    (sum, metric) => sum + metric.weightPercent,
    0,
  )
  const publishedStoreWeightTotal = published?.storeProfile.metrics.reduce(
    (sum, metric) => sum + metric.weightPercent,
    0,
  ) ?? 0
  const publishedPersonnelWeightTotal = published?.personnelProfile.metrics.reduce(
    (sum, metric) => sum + metric.weightPercent,
    0,
  ) ?? 0
  const governancePreview = buildGovernancePreview({
    draft,
    published,
    hasUnpublishedChanges: Boolean(configQuery.data?.hasUnpublishedChanges),
  })

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('adminKpiConfig.heroEyebrow')}</div>
          <h2 className="hero-title">{t('adminKpiConfig.heroTitle')}</h2>
          <p className="hero-copy">{t('adminKpiConfig.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('adminKpiConfig.route')} value="/admin/kpi-config" />
          <MetricAccent
            label={t('adminKpiConfig.storeMetrics')}
            value={String(draft.storeProfile.metrics.length)}
          />
          <MetricAccent
            label={t('adminKpiConfig.ownershipRows')}
            value={String(draft.ownershipMatrix.length)}
          />
          <MetricAccent
            label={t('adminKpiConfig.gradingBandsMetric')}
            value={String(draft.gradingBands.length)}
          />
          <MetricAccent
            label={t('adminKpiConfig.mode')}
            value={
              configQuery.data?.hasUnpublishedChanges
                ? t('adminKpiConfig.draftDirty')
                : t('adminKpiConfig.publishedInSync')
            }
          />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          title={t('adminKpiConfig.storeWeightTotal')}
          value={storeWeightTotal}
          note={t('adminKpiConfig.storeWeightTotalNote')}
          icon={<SlidersHorizontal size={18} />}
          tone={storeWeightTotal === 100 ? 'calm' : 'warning'}
        />
        <MetricCard
          title={t('adminKpiConfig.personnelWeightTotal')}
          value={personnelWeightTotal}
          note={t('adminKpiConfig.personnelWeightTotalNote')}
          icon={<Settings2 size={18} />}
          tone={personnelWeightTotal === 100 ? 'calm' : 'warning'}
        />
        <MetricCard
          title={t('adminKpiConfig.taskCandidates')}
          value={draft.ownershipMatrix.filter((row) => row.taskCandidate).length}
          note={t('adminKpiConfig.taskCandidatesNote')}
          icon={<ShieldCheck size={18} />}
          tone="accent"
        />
        <MetricCard
          title={t('adminKpiConfig.publishState')}
          value={configQuery.data?.hasUnpublishedChanges ? 1 : 0}
          note={
            configQuery.data?.hasUnpublishedChanges
              ? t('adminKpiConfig.draftDiffersFromLive')
              : t('adminKpiConfig.draftMatchesLive')
          }
          icon={<ShieldCheck size={18} />}
          tone={configQuery.data?.hasUnpublishedChanges ? 'warning' : 'calm'}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminKpiConfig.publishModel')}</div>
            <h3>{t('adminKpiConfig.draftVsLiveTitle')}</h3>
          </div>
          <StatusPill tone={configQuery.data?.hasUnpublishedChanges ? 'warning' : 'calm'}>
            {configQuery.data?.hasUnpublishedChanges
              ? t('adminKpiConfig.unpublishedChanges')
              : t('adminKpiConfig.live')}
          </StatusPill>
        </div>
        <div className="key-grid">
          <KeyValue label={t('adminKpiConfig.draftStoreWeight')} value={`${storeWeightTotal}%`} />
          <KeyValue label={t('adminKpiConfig.liveStoreWeight')} value={`${publishedStoreWeightTotal}%`} />
          <KeyValue
            label={t('adminKpiConfig.draftPersonnelWeight')}
            value={`${personnelWeightTotal}%`}
          />
          <KeyValue
            label={t('adminKpiConfig.livePersonnelWeight')}
            value={`${publishedPersonnelWeightTotal}%`}
          />
          <KeyValue
            label={t('adminKpiConfig.draftGradingBands')}
            value={String(draft.gradingBands.length)}
          />
          <KeyValue
            label={t('adminKpiConfig.liveGradingBands')}
            value={String(published?.gradingBands.length ?? 0)}
          />
        </div>
      </section>

      <section className="panel" aria-label={t('adminKpiConfig.governancePreview')}>
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminKpiConfig.governancePreview')}</div>
            <h3>{t('adminKpiConfig.publishDecisionPreview')}</h3>
          </div>
          <StatusPill tone={governancePreview.tone}>
            {t(governancePreview.statusKey)}
          </StatusPill>
        </div>
        <p className="queue-subtitle">{t(governancePreview.summaryKey)}</p>
        <div className="key-grid">
          <KeyValue
            label={t('adminKpiConfig.storeProfileDiff')}
            value={formatDiffSummary(governancePreview.storeProfile, t)}
          />
          <KeyValue
            label={t('adminKpiConfig.personnelProfileDiff')}
            value={formatDiffSummary(governancePreview.personnelProfile, t)}
          />
          <KeyValue
            label={t('adminKpiConfig.ownershipDiff')}
            value={formatDiffSummary(governancePreview.ownershipMatrix, t)}
          />
          <KeyValue
            label={t('adminKpiConfig.gradingDiff')}
            value={formatDiffSummary(governancePreview.gradingBands, t)}
          />
          <KeyValue
            label={t('adminKpiConfig.versionedSchema')}
            value={
              latestPublishedVersion?.versionNo
                ? t('adminKpiConfig.active')
                : t('adminKpiConfig.preGovernance')
            }
          />
          <KeyValue
            label={t('adminKpiConfig.latestVersion')}
            value={formatKpiConfigVersion(latestPublishedVersion, t)}
          />
          <KeyValue
            label={t('adminKpiConfig.publishedAt')}
            value={
              latestPublishedVersion?.publishedAt
                ? formatDateTime(latestPublishedVersion.publishedAt, locale)
                : t('adminKpiConfig.notPublishedYet')
            }
          />
          <KeyValue
            label={t('adminKpiConfig.rollback')}
            value={t('adminKpiConfig.rollbackInactive')}
          />
          <KeyValue
            label={t('adminKpiConfig.snapshotAnchoring')}
            value={t('adminKpiConfig.snapshotAnchoringActive')}
          />
        </div>
        <p className="queue-subtitle">{t('adminKpiConfig.snapshotAnchoringCopy')}</p>
      </section>

      <ProfileEditor
        t={t}
        title={draft.storeProfile.title}
        summary={draft.storeProfile.summary}
        futureMetricRule={draft.storeProfile.futureMetricRule}
        metrics={draft.storeProfile.metrics}
        weightTone={storeWeightTotal === 100 ? 'calm' : 'warning'}
        weightLabel={t('adminKpiConfig.weightTotal', { total: storeWeightTotal })}
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
        weightTone={personnelWeightTotal === 100 ? 'calm' : 'warning'}
        weightLabel={t('adminKpiConfig.weightTotal', { total: personnelWeightTotal })}
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

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminKpiConfig.ownershipMatrix')}</div>
            <h3>{t('adminKpiConfig.ownershipTitle')}</h3>
          </div>
          <StatusPill tone="accent">{t('adminKpiConfig.editable')}</StatusPill>
        </div>
        {draft.ownershipMatrix.length === 0 ? (
          <EmptyState copy={t('adminKpiConfig.noOwnershipRows')} />
        ) : (
          <div className="stacked-table">
            {draft.ownershipMatrix.map((row, index) => (
              <article className="stacked-row" key={`${row.code}-${index}`}>
                <div className="key-grid">
                  <TextField
                    label={t('adminKpiConfig.field.code')}
                    value={row.code}
                    onChange={(next) =>
                      updateOwnershipRow(setDraft, draft, index, { ...row, code: next })
                    }
                  />
                  <TextField
                    label={t('adminKpiConfig.field.label')}
                    value={row.label}
                    onChange={(next) =>
                      updateOwnershipRow(setDraft, draft, index, { ...row, label: next })
                    }
                  />
                  <SelectField
                    label={t('adminKpiConfig.field.owner')}
                    value={row.operationalOwner}
                    options={ownerRoleOptions}
                    optionLabel={(option) => formatOwnerRole(option as KpiOwnerRole, t)}
                    onChange={(next) =>
                      updateOwnershipRow(setDraft, draft, index, {
                        ...row,
                        operationalOwner: next as KpiOwnerRole,
                      })
                    }
                  />
                  <TextField
                    label={t('adminKpiConfig.field.visibleTo')}
                    value={row.visibleTo.join(', ')}
                    onChange={(next) =>
                      updateOwnershipRow(setDraft, draft, index, {
                        ...row,
                        visibleTo: splitCsv(next) as KpiOwnerRole[],
                      })
                    }
                  />
                  <TextField
                    label={t('adminKpiConfig.field.contributesTo')}
                    value={row.contributesTo.join(', ')}
                    onChange={(next) =>
                      updateOwnershipRow(setDraft, draft, index, {
                        ...row,
                        contributesTo: splitCsv(next) as Array<'store' | 'personnel'>,
                      })
                    }
                  />
                  <SelectField
                    label={t('adminKpiConfig.field.taskCandidate')}
                    value={row.taskCandidate ? 'true' : 'false'}
                    options={['true', 'false']}
                    optionLabel={(option) => formatBooleanOption(option, t)}
                    onChange={(next) =>
                      updateOwnershipRow(setDraft, draft, index, {
                        ...row,
                        taskCandidate: next === 'true',
                      })
                    }
                  />
                </div>
                <div className="action-cluster">
                  <button
                    className="control-button"
                    type="button"
                    onClick={() =>
                      updateDraft((current) => ({
                        ...current,
                        ownershipMatrix: current.ownershipMatrix.filter(
                          (_item, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                  >
                    {t('adminKpiConfig.removeRow')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="action-cluster">
          <button
            className="control-button"
            type="button"
            onClick={() =>
              updateDraft((current) => ({
                ...current,
                ownershipMatrix: [...current.ownershipMatrix, createEmptyOwnershipRow()],
              }))
            }
          >
            {t('adminKpiConfig.addOwnershipRow')}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminKpiConfig.gradingBands')}</div>
            <h3>{t('adminKpiConfig.gradingBandsTitle')}</h3>
          </div>
          <StatusPill tone="accent">{t('adminKpiConfig.editable')}</StatusPill>
        </div>
        <div className="stacked-table">
          {draft.gradingBands.map((band, index) => (
            <article className="stacked-row" key={`${band.code}-${index}`}>
              <div className="key-grid">
                <TextField
                  label={t('adminKpiConfig.field.code')}
                  value={band.code}
                  onChange={(next) =>
                    updateGradingBand(setDraft, draft, index, { ...band, code: next })
                  }
                />
                <TextField
                  label={t('adminKpiConfig.field.label')}
                  value={band.label}
                  onChange={(next) =>
                    updateGradingBand(setDraft, draft, index, { ...band, label: next })
                  }
                />
                <TextField
                  label={t('adminKpiConfig.field.emoji')}
                  value={band.emoji}
                  onChange={(next) =>
                    updateGradingBand(setDraft, draft, index, { ...band, emoji: next })
                  }
                />
                <SelectField
                  label={t('adminKpiConfig.field.tone')}
                  value={band.tone}
                  options={['calm', 'accent', 'warning', 'danger', 'neutral']}
                  optionLabel={(option) => formatToneOption(option as KpiGradingBand['tone'], t)}
                  onChange={(next) =>
                    updateGradingBand(setDraft, draft, index, {
                      ...band,
                      tone: next as KpiGradingBand['tone'],
                    })
                  }
                />
                <NumberField
                  label={t('adminKpiConfig.field.minScore')}
                  value={band.minScore}
                  onChange={(next) =>
                    updateGradingBand(setDraft, draft, index, { ...band, minScore: next })
                  }
                />
              </div>
              <div className="action-cluster">
                <button
                  className="control-button"
                  type="button"
                  onClick={() =>
                    updateDraft((current) => ({
                      ...current,
                      gradingBands: current.gradingBands.filter(
                        (_item, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                >
                  {t('adminKpiConfig.removeBand')}
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className="action-cluster">
          <button
            className="control-button"
            type="button"
            onClick={() =>
              updateDraft((current) => ({
                ...current,
                gradingBands: [...current.gradingBands, createEmptyGradingBand()],
              }))
            }
          >
            {t('adminKpiConfig.addGradingBand')}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminKpiConfig.saveEyebrow')}</div>
            <h3>{t('adminKpiConfig.persistTitle')}</h3>
          </div>
          <StatusPill tone={saveMutation.isPending ? 'warning' : 'calm'}>
            {saveMutation.isPending ? t('adminKpiConfig.saving') : t('adminKpiConfig.ready')}
          </StatusPill>
        </div>
        <div className="key-grid">
          <KeyValue label={t('adminKpiConfig.saveStoreProfile')} value={draft.storeProfile.title} />
          <KeyValue
            label={t('adminKpiConfig.savePersonnelProfile')}
            value={draft.personnelProfile.title}
          />
          <KeyValue label={t('adminKpiConfig.matrixRows')} value={String(draft.ownershipMatrix.length)} />
          <KeyValue label={t('adminKpiConfig.gradingBands')} value={String(draft.gradingBands.length)} />
          <KeyValue label={t('adminKpiConfig.persistence')} value="ops.kpi_score_profile_config" />
        </div>
        {notice ? <p className="queue-subtitle">{notice}</p> : null}
        {saveMutation.isError ? (
          <p className="queue-subtitle">{getErrorMessage(saveMutation.error)}</p>
        ) : null}
        <div className="action-cluster">
          <button
            className="control-button"
            type="button"
            disabled={saveMutation.isPending || publishMutation.isPending}
            onClick={() => saveMutation.mutate(draft)}
          >
            {saveMutation.isPending
              ? t('adminKpiConfig.saveDraftPending')
              : t('adminKpiConfig.saveDraft')}
          </button>
          <button
            className="control-button"
            type="button"
            disabled={
              publishMutation.isPending ||
              saveMutation.isPending ||
              !configQuery.data?.hasUnpublishedChanges
            }
            onClick={() => publishMutation.mutate()}
          >
            {publishMutation.isPending
              ? t('adminKpiConfig.publishPending')
              : t('adminKpiConfig.publishLiveConfig')}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminKpiConfig.recentChanges')}</div>
            <h3>{t('adminKpiConfig.auditTrailTitle')}</h3>
          </div>
          <StatusPill tone={auditQuery.isLoading ? 'warning' : 'accent'}>
            {auditQuery.isLoading ? t('adminKpiConfig.loading') : t('adminKpiConfig.live')}
          </StatusPill>
        </div>
        {auditQuery.isError ? (
          <p className="queue-subtitle">{getErrorMessage(auditQuery.error)}</p>
        ) : auditQuery.data && auditQuery.data.items.length > 0 ? (
          <div className="stacked-table">
            {auditQuery.data.items.map((item) => (
              <KpiConfigAuditRow item={item} key={item.eventLogId} locale={locale} t={t} />
            ))}
          </div>
        ) : (
          <EmptyState copy={t('adminKpiConfig.noChangesSaved')} />
        )}
      </section>
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

function diffByCode<T extends { code: string }>(
  draftRows: T[],
  publishedRows: T[],
): KpiConfigDiffSummary {
  const draftByCode = new Map(draftRows.map((row) => [row.code, row]))
  const publishedByCode = new Map(publishedRows.map((row) => [row.code, row]))
  const added = draftRows
    .filter((row) => !publishedByCode.has(row.code))
    .map((row) => row.code)
  const removed = publishedRows
    .filter((row) => !draftByCode.has(row.code))
    .map((row) => row.code)
  const changed = draftRows
    .filter((row) => {
      const publishedRow = publishedByCode.get(row.code)
      return publishedRow ? JSON.stringify(row) !== JSON.stringify(publishedRow) : false
    })
    .map((row) => row.code)

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

function ProfileEditor(input: {
  t: TranslateFunction
  title: string
  summary: string
  futureMetricRule: string
  metrics: KpiScoreProfileMetric[]
  weightLabel: string
  weightTone: 'calm' | 'warning' | 'accent'
  onMetricChange: (index: number, next: KpiScoreProfileMetric) => void
  onAddMetric: () => void
  onRemoveMetric: (index: number) => void
}) {
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
      <div className="stacked-table">
        {input.metrics.map((metric, index) => (
          <article className="stacked-row" key={`${metric.code}-${index}`}>
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
                className="control-button"
                type="button"
                onClick={() => input.onRemoveMetric(index)}
              >
                {input.t('adminKpiConfig.removeMetric')}
              </button>
            </div>
          </article>
        ))}
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
        value={input.value}
        onChange={(event) => input.onChange(Number(event.target.value))}
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
    .map((item) => item.trim())
    .filter(Boolean)
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
  setDraft({
    ...draft,
    ownershipMatrix: draft.ownershipMatrix.map((row, rowIndex) =>
      rowIndex === index ? nextRow : row,
    ),
  })
}

function updateGradingBand(
  setDraft: Dispatch<SetStateAction<KpiConfig | null>>,
  draft: KpiConfig,
  index: number,
  nextBand: KpiGradingBand,
) {
  setDraft({
    ...draft,
    gradingBands: draft.gradingBands.map((band, bandIndex) =>
      bandIndex === index ? nextBand : band,
    ),
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
