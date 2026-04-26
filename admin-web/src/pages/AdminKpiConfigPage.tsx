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
  type KpiGradingBand,
  type KpiOwnershipMatrixRow,
  type KpiOwnerRole,
  type KpiScoreBehavior,
  type KpiScoreProfileMetric,
} from '../features/reports/api'
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

export function AdminKpiConfigPage() {
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

  const saveMutation = useMutation({
    mutationFn: updateKpiConfigDraft,
    onSuccess: (result) => {
      syncEditorState(result, setDraft, setPublished)
      setNotice('Taslak KPI config kaydedildi.')
      void queryClient.invalidateQueries({ queryKey: ['kpi-config-editor'] })
      void queryClient.invalidateQueries({ queryKey: ['kpi-config-audit'] })
    },
  })
  const publishMutation = useMutation({
    mutationFn: publishKpiConfig,
    onSuccess: (result) => {
      syncEditorState(result, setDraft, setPublished)
      setNotice('KPI config publish edildi.')
      void queryClient.invalidateQueries({ queryKey: ['kpi-config-editor'] })
      void queryClient.invalidateQueries({ queryKey: ['kpi-config'] })
      void queryClient.invalidateQueries({ queryKey: ['kpi-config-audit'] })
    },
  })

  if (configQuery.isLoading) {
    return (
      <ScreenState
        title="Loading KPI config"
        copy="Pulling the current store and personnel score profiles."
      />
    )
  }

  if (configQuery.isError || !draft) {
    return (
      <ScreenState
        title="KPI config unavailable"
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
          <div className="eyebrow">KPI Config</div>
          <h2 className="hero-title">Admin surface for score profiles and KPI ownership.</h2>
          <p className="hero-copy">
            Store ve personnel score profilleri artik backend config olarak saklaniyor. Bu yuzey,
            agirliklari ve ownership matrix&apos;i bozmadan guncellemek icin acildi.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/admin/kpi-config" />
          <MetricAccent label="Store metrics" value={String(draft.storeProfile.metrics.length)} />
          <MetricAccent
            label="Ownership rows"
            value={String(draft.ownershipMatrix.length)}
          />
          <MetricAccent label="Grading bands" value={String(draft.gradingBands.length)} />
          <MetricAccent
            label="Mode"
            value={configQuery.data?.hasUnpublishedChanges ? 'Draft dirty' : 'Published in sync'}
          />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          title="Store weight total"
          value={storeWeightTotal}
          note="Store profile ideally sums to 100."
          icon={<SlidersHorizontal size={18} />}
          tone={storeWeightTotal === 100 ? 'calm' : 'warning'}
        />
        <MetricCard
          title="Personnel weight total"
          value={personnelWeightTotal}
          note="Personnel profile da 100 toplamina esit olmali."
          icon={<Settings2 size={18} />}
          tone={personnelWeightTotal === 100 ? 'calm' : 'warning'}
        />
        <MetricCard
          title="Task candidates"
          value={draft.ownershipMatrix.filter((row) => row.taskCandidate).length}
          note="Metrics that may later emit inbox work."
          icon={<ShieldCheck size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Publish state"
          value={configQuery.data?.hasUnpublishedChanges ? 1 : 0}
          note={
            configQuery.data?.hasUnpublishedChanges
              ? 'Draft differs from live config'
              : 'Draft and live config match'
          }
          icon={<ShieldCheck size={18} />}
          tone={configQuery.data?.hasUnpublishedChanges ? 'warning' : 'calm'}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Publish model</div>
            <h3>Draft vs live KPI config</h3>
          </div>
          <StatusPill tone={configQuery.data?.hasUnpublishedChanges ? 'warning' : 'calm'}>
            {configQuery.data?.hasUnpublishedChanges ? 'Unpublished changes' : 'Live'}
          </StatusPill>
        </div>
        <div className="key-grid">
          <KeyValue label="Draft store weight" value={`${storeWeightTotal}%`} />
          <KeyValue label="Live store weight" value={`${publishedStoreWeightTotal}%`} />
          <KeyValue label="Draft personnel weight" value={`${personnelWeightTotal}%`} />
          <KeyValue label="Live personnel weight" value={`${publishedPersonnelWeightTotal}%`} />
          <KeyValue label="Draft grading bands" value={String(draft.gradingBands.length)} />
          <KeyValue label="Live grading bands" value={String(published?.gradingBands.length ?? 0)} />
        </div>
      </section>

      <section className="panel" aria-label="KPI config governance preview">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Governance preview</div>
            <h3>Publish decision preview</h3>
          </div>
          <StatusPill tone={governancePreview.tone}>{governancePreview.statusLabel}</StatusPill>
        </div>
        <p className="queue-subtitle">{governancePreview.summary}</p>
        <div className="key-grid">
          <KeyValue
            label="Store profile diff"
            value={formatDiffSummary(governancePreview.storeProfile)}
          />
          <KeyValue
            label="Personnel profile diff"
            value={formatDiffSummary(governancePreview.personnelProfile)}
          />
          <KeyValue
            label="Ownership diff"
            value={formatDiffSummary(governancePreview.ownershipMatrix)}
          />
          <KeyValue
            label="Grading diff"
            value={formatDiffSummary(governancePreview.gradingBands)}
          />
          <KeyValue label="Versioned schema" value="Not active yet" />
          <KeyValue label="Snapshot anchoring" value="Required before admin-editable interpretation changes" />
        </div>
        <p className="queue-subtitle">
          Snapshot anchoring is required before interpretation changes become admin-editable.
        </p>
      </section>

      <ProfileEditor
        title={draft.storeProfile.title}
        summary={draft.storeProfile.summary}
        futureMetricRule={draft.storeProfile.futureMetricRule}
        metrics={draft.storeProfile.metrics}
        weightTone={storeWeightTotal === 100 ? 'calm' : 'warning'}
        weightLabel={`${storeWeightTotal}% total`}
        onMetricChange={(index, next) =>
          setDraft((current) =>
            current
              ? {
                  ...current,
                  storeProfile: {
                    ...current.storeProfile,
                    metrics: current.storeProfile.metrics.map((metric, metricIndex) =>
                      metricIndex === index ? next : metric,
                    ),
                  },
                }
              : current,
          )
        }
        onAddMetric={() =>
          setDraft((current) =>
            current
              ? {
                  ...current,
                  storeProfile: {
                    ...current.storeProfile,
                    metrics: [...current.storeProfile.metrics, createEmptyMetric()],
                  },
                }
              : current,
          )
        }
        onRemoveMetric={(index) =>
          setDraft((current) =>
            current
              ? {
                  ...current,
                  storeProfile: {
                    ...current.storeProfile,
                    metrics: current.storeProfile.metrics.filter(
                      (_metric, metricIndex) => metricIndex !== index,
                    ),
                  },
                }
              : current,
          )
        }
      />

      <ProfileEditor
        title={draft.personnelProfile.title}
        summary={draft.personnelProfile.summary}
        futureMetricRule={draft.personnelProfile.futureMetricRule}
        metrics={draft.personnelProfile.metrics}
        weightTone={personnelWeightTotal === 100 ? 'calm' : 'warning'}
        weightLabel={`${personnelWeightTotal}% total`}
        onMetricChange={(index, next) =>
          setDraft((current) =>
            current
              ? {
                  ...current,
                  personnelProfile: {
                    ...current.personnelProfile,
                    metrics: current.personnelProfile.metrics.map((metric, metricIndex) =>
                      metricIndex === index ? next : metric,
                    ),
                  },
                }
              : current,
          )
        }
        onAddMetric={() =>
          setDraft((current) =>
            current
              ? {
                  ...current,
                  personnelProfile: {
                    ...current.personnelProfile,
                    metrics: [...current.personnelProfile.metrics, createEmptyMetric()],
                  },
                }
              : current,
          )
        }
        onRemoveMetric={(index) =>
          setDraft((current) =>
            current
              ? {
                  ...current,
                  personnelProfile: {
                    ...current.personnelProfile,
                    metrics: current.personnelProfile.metrics.filter(
                      (_metric, metricIndex) => metricIndex !== index,
                    ),
                  },
                }
              : current,
          )
        }
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Ownership Matrix</div>
            <h3>Which KPI belongs to whom</h3>
          </div>
          <StatusPill tone="accent">Editable</StatusPill>
        </div>
        {draft.ownershipMatrix.length === 0 ? (
          <EmptyState copy="No ownership rows configured yet." />
        ) : (
          <div className="stacked-table">
            {draft.ownershipMatrix.map((row, index) => (
              <article className="stacked-row" key={`${row.code}-${index}`}>
                <div className="key-grid">
                  <TextField
                    label="Code"
                    value={row.code}
                    onChange={(next) =>
                      updateOwnershipRow(setDraft, draft, index, { ...row, code: next })
                    }
                  />
                  <TextField
                    label="Label"
                    value={row.label}
                    onChange={(next) =>
                      updateOwnershipRow(setDraft, draft, index, { ...row, label: next })
                    }
                  />
                  <SelectField
                    label="Owner"
                    value={row.operationalOwner}
                    options={ownerRoleOptions}
                    onChange={(next) =>
                      updateOwnershipRow(setDraft, draft, index, {
                        ...row,
                        operationalOwner: next as KpiOwnerRole,
                      })
                    }
                  />
                  <TextField
                    label="Visible to"
                    value={row.visibleTo.join(', ')}
                    onChange={(next) =>
                      updateOwnershipRow(setDraft, draft, index, {
                        ...row,
                        visibleTo: splitCsv(next) as KpiOwnerRole[],
                      })
                    }
                  />
                  <TextField
                    label="Contributes to"
                    value={row.contributesTo.join(', ')}
                    onChange={(next) =>
                      updateOwnershipRow(setDraft, draft, index, {
                        ...row,
                        contributesTo: splitCsv(next) as Array<'store' | 'personnel'>,
                      })
                    }
                  />
                  <SelectField
                    label="Task candidate"
                    value={row.taskCandidate ? 'true' : 'false'}
                    options={['true', 'false']}
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
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              ownershipMatrix: current.ownershipMatrix.filter(
                                (_item, itemIndex) => itemIndex !== index,
                              ),
                            }
                          : current,
                      )
                    }
                  >
                    Remove row
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
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      ownershipMatrix: [...current.ownershipMatrix, createEmptyOwnershipRow()],
                    }
                  : current,
              )
            }
          >
            Add ownership row
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Grading Bands</div>
            <h3>A/B/C/D + emoji config</h3>
          </div>
          <StatusPill tone="accent">Editable</StatusPill>
        </div>
        <div className="stacked-table">
          {draft.gradingBands.map((band, index) => (
            <article className="stacked-row" key={`${band.code}-${index}`}>
              <div className="key-grid">
                <TextField
                  label="Code"
                  value={band.code}
                  onChange={(next) =>
                    updateGradingBand(setDraft, draft, index, { ...band, code: next })
                  }
                />
                <TextField
                  label="Label"
                  value={band.label}
                  onChange={(next) =>
                    updateGradingBand(setDraft, draft, index, { ...band, label: next })
                  }
                />
                <TextField
                  label="Emoji"
                  value={band.emoji}
                  onChange={(next) =>
                    updateGradingBand(setDraft, draft, index, { ...band, emoji: next })
                  }
                />
                <SelectField
                  label="Tone"
                  value={band.tone}
                  options={['calm', 'accent', 'warning', 'danger', 'neutral']}
                  onChange={(next) =>
                    updateGradingBand(setDraft, draft, index, {
                      ...band,
                      tone: next as KpiGradingBand['tone'],
                    })
                  }
                />
                <NumberField
                  label="Min score"
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
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            gradingBands: current.gradingBands.filter(
                              (_item, itemIndex) => itemIndex !== index,
                            ),
                          }
                        : current,
                    )
                  }
                >
                  Remove band
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
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      gradingBands: [...current.gradingBands, createEmptyGradingBand()],
                    }
                  : current,
              )
            }
          >
            Add grading band
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Save</div>
            <h3>Persist KPI config</h3>
          </div>
          <StatusPill tone={saveMutation.isPending ? 'warning' : 'calm'}>
            {saveMutation.isPending ? 'Saving' : 'Ready'}
          </StatusPill>
        </div>
        <div className="key-grid">
          <KeyValue label="Store profile" value={draft.storeProfile.title} />
          <KeyValue label="Personnel profile" value={draft.personnelProfile.title} />
          <KeyValue label="Matrix rows" value={String(draft.ownershipMatrix.length)} />
          <KeyValue label="Grading bands" value={String(draft.gradingBands.length)} />
          <KeyValue label="Persistence" value="ops.kpi_score_profile_config" />
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
            {saveMutation.isPending ? 'Saving...' : 'Save draft'}
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
            {publishMutation.isPending ? 'Publishing...' : 'Publish live config'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Recent changes</div>
            <h3>KPI config audit trail</h3>
          </div>
          <StatusPill tone={auditQuery.isLoading ? 'warning' : 'accent'}>
            {auditQuery.isLoading ? 'Loading' : 'Live'}
          </StatusPill>
        </div>
        {auditQuery.isError ? (
          <p className="queue-subtitle">{getErrorMessage(auditQuery.error)}</p>
        ) : auditQuery.data && auditQuery.data.items.length > 0 ? (
          <div className="stacked-table">
            {auditQuery.data.items.map((item) => (
              <KpiConfigAuditRow item={item} key={item.eventLogId} />
            ))}
          </div>
        ) : (
          <EmptyState copy="No KPI config changes have been saved yet." />
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
    statusLabel: input.hasUnpublishedChanges ? 'Review before publish' : 'No draft delta',
    summary: input.hasUnpublishedChanges
      ? 'Draft changes affect live KPI interpretation.'
      : 'Draft matches live KPI interpretation.',
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

function KpiConfigAuditRow(input: { item: AuditEvent }) {
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
        <StatusPill tone="accent">{formatDateTime(input.item.occurredAt)}</StatusPill>
      </div>
      <p>
        actor {input.item.actorUserId ?? 'unknown'} · store metrics{' '}
        {String(input.item.metadata.storeMetricCount ?? 'n/a')} · personnel metrics{' '}
        {String(input.item.metadata.personnelMetricCount ?? 'n/a')} · ownership rows{' '}
        {String(input.item.metadata.ownershipRowCount ?? 'n/a')}
      </p>
      {diffSummary ? (
        <div className="key-grid">
          <KeyValue label="Store diff" value={formatDiffSummary(diffSummary.storeProfile)} />
          <KeyValue
            label="Personnel diff"
            value={formatDiffSummary(diffSummary.personnelProfile)}
          />
          <KeyValue
            label="Ownership diff"
            value={formatDiffSummary(diffSummary.ownershipMatrix)}
          />
          <KeyValue
            label="Grading diff"
            value={formatDiffSummary(diffSummary.gradingBands)}
          />
        </div>
      ) : null}
      <span className="queue-subtitle">
        correlation {input.item.correlationId ?? 'n/a'}
      </span>
    </article>
  )
}

function formatDiffSummary(input: { added?: unknown; removed?: unknown; changed?: unknown } | undefined) {
  if (!input) {
    return 'n/a'
  }

  const added = Array.isArray(input.added) ? input.added.length : 0
  const removed = Array.isArray(input.removed) ? input.removed.length : 0
  const changed = Array.isArray(input.changed) ? input.changed.length : 0

  return `+${added} / ~${changed} / -${removed}`
}

function ProfileEditor(input: {
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
          <div className="eyebrow">Score Profile</div>
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
                label="Code"
                value={metric.code}
                onChange={(next) => input.onMetricChange(index, { ...metric, code: next })}
              />
              <TextField
                label="Label"
                value={metric.label}
                onChange={(next) => input.onMetricChange(index, { ...metric, label: next })}
              />
              <NumberField
                label="Weight %"
                value={metric.weightPercent}
                onChange={(next) =>
                  input.onMetricChange(index, { ...metric, weightPercent: next })
                }
              />
              <SelectField
                label="Owner"
                value={metric.ownerRole}
                options={ownerRoleOptions}
                onChange={(next) =>
                  input.onMetricChange(index, {
                    ...metric,
                    ownerRole: next as KpiOwnerRole,
                  })
                }
              />
              <SelectField
                label="Behavior"
                value={metric.scoreBehavior}
                options={behaviorOptions}
                onChange={(next) =>
                  input.onMetricChange(index, {
                    ...metric,
                    scoreBehavior: next as KpiScoreBehavior,
                  })
                }
              />
              <TextField
                label="Aliases"
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
              label="Notes"
              value={metric.notes ?? ''}
              onChange={(next) => input.onMetricChange(index, { ...metric, notes: next })}
            />
            <div className="action-cluster">
              <button
                className="control-button"
                type="button"
                onClick={() => input.onRemoveMetric(index)}
              >
                Remove metric
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="action-cluster">
        <button className="control-button" type="button" onClick={input.onAddMetric}>
          Add metric
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
  onChange: (next: string) => void
}) {
  return (
    <label>
      <span className="eyebrow">{input.label}</span>
      <select value={input.value} onChange={(event) => input.onChange(event.target.value)}>
        {input.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
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
