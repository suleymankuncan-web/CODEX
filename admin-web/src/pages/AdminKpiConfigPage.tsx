import { useId, useState, type Dispatch, type SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings2, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Button } from '../components/ui/button'
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
import { actionToast } from '../lib/action-toast'
import { formatDateTime, getErrorMessage } from '../lib/format'
import {
  AdminActionRow,
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceSection,
  type AdminSurfaceTone,
} from './admin-surface-primitives'
import { AdminOperationalHeader, AdminOperationalMetrics, AdminOperationalPage } from './admin-operational-primitives'
import {
  KpiConfigEditorRow,
  KpiConfigFieldGrid,
  KpiConfigMutedText,
  KpiConfigRowList,
  NumberField,
  SelectField,
  TextField,
} from './admin-kpi-config-surface-primitives'

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
    setDraft((current) => {
      const base = current ?? configQuery.data?.draftConfig ?? null
      return base ? updater(base) : current
    })
  }

  const saveMutation = useMutation({
    mutationFn: updateKpiConfigDraft,
    onSuccess: (result) => {
      syncEditorState(result, setDraft, setPublished)
      actionToast.success('Taslak kaydedildi')
      void queryClient.invalidateQueries({ queryKey: ['kpi-config-editor'] })
      void queryClient.invalidateQueries({ queryKey: ['kpi-config-audit'] })
    },
    onError: (error) => {
      actionToast.error(error, 'Taslak kaydedilemedi.')
    },
  })
  const publishMutation = useMutation({
    mutationFn: publishKpiConfig,
    onSuccess: (result) => {
      syncEditorState(result, setDraft, setPublished)
      actionToast.success('Yayınlandı')
      for (const key of ['kpi-config-editor', 'kpi-config', 'kpi-config-audit', 'ranking-v1']) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
    },
    onError: (error) => {
      actionToast.error(error, 'Yayınlanamadı.')
    },
  })

  if (configQuery.isLoading) {
    return (
      <AdminOperationalPage ariaLabel={t('adminKpiConfig.loadingTitle')}>
        <AdminStatePanel
          title={t('adminKpiConfig.loadingTitle')}
          description={t('adminKpiConfig.loadingCopy')}
          isLoading
        />
      </AdminOperationalPage>
    )
  }

  if (configQuery.isError || !draft) {
    return (
      <AdminOperationalPage ariaLabel={t('adminKpiConfig.errorTitle')}>
        <AdminStatePanel
          title={t('adminKpiConfig.errorTitle')}
          description={getErrorMessage(configQuery.error)}
          tone="danger"
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void configQuery.refetch()}>
              {t('reportsSummary.retry')}
            </Button>
          }
        />
      </AdminOperationalPage>
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
    <AdminOperationalPage ariaLabel={t('adminKpiConfig.heroTitle')}>
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
        onPublish={() => publishMutation.mutate()}
        onSave={() => saveMutation.mutate(draft)}
        status={{
          hasUnpublishedChanges: Boolean(configQuery.data?.hasUnpublishedChanges),
          publishPending: publishMutation.isPending,
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
    </AdminOperationalPage>
  )
}

type KpiConfigEditorStatus = {
  hasUnpublishedChanges: boolean
}

type StableDraftRow<T> = {
  item: T
  key: string
}

type KpiSurfaceTone = 'calm' | 'accent' | 'warning' | 'danger' | 'neutral'

function toSurfaceTone(tone: KpiSurfaceTone): AdminSurfaceTone {
  return tone === 'calm' ? 'success' : tone
}

function AdminKpiConfigHero(input: {
  draft: KpiConfig
  editorState: KpiConfigEditorStatus
  t: TranslateFunction
}) {
  return (
    <AdminOperationalHeader
      icon={<SlidersHorizontal size={20} />}
      eyebrow={input.t('adminKpiConfig.heroEyebrow')}
      title={input.t('adminKpiConfig.heroTitle')}
      description={input.t('adminKpiConfig.heroCopy')}
      meta={
        <>
          <AdminSurfaceBadge tone="cyan">
            {input.t('adminKpiConfig.storeMetrics')}: {input.draft.storeProfile.metrics.length}
          </AdminSurfaceBadge>
          <AdminSurfaceBadge tone="accent">
            {input.t('adminKpiConfig.ownershipRows')}: {input.draft.ownershipMatrix.length}
          </AdminSurfaceBadge>
          <AdminSurfaceBadge tone="neutral">
            {input.t('adminKpiConfig.gradingBandsMetric')}: {input.draft.gradingBands.length}
          </AdminSurfaceBadge>
          <AdminSurfaceBadge tone={input.editorState.hasUnpublishedChanges ? 'warning' : 'success'}>
            {input.editorState.hasUnpublishedChanges
              ? input.t('adminKpiConfig.draftDirty')
              : input.t('adminKpiConfig.publishedInSync')}
          </AdminSurfaceBadge>
        </>
      }
    />
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
    <AdminOperationalMetrics
      items={[
        {
          id: 'store-weight-total',
          label: input.t('adminKpiConfig.storeWeightTotal'),
          value: formatWeightTotalValue(input.storeWeightTotal, input.t),
          description: input.storeWeightGuidance,
          icon: <SlidersHorizontal size={18} />,
          tone: isExactWeightTotal(input.storeWeightTotal) ? 'success' : 'warning',
        },
        {
          id: 'personnel-weight-total',
          label: input.t('adminKpiConfig.personnelWeightTotal'),
          value: formatWeightTotalValue(input.personnelWeightTotal, input.t),
          description: input.personnelWeightGuidance,
          icon: <Settings2 size={18} />,
          tone: isExactWeightTotal(input.personnelWeightTotal) ? 'success' : 'warning',
        },
        {
          id: 'task-candidates',
          label: input.t('adminKpiConfig.taskCandidates'),
          value: input.draft.ownershipMatrix.filter((row) => row.taskCandidate).length,
          description: input.t('adminKpiConfig.taskCandidatesNote'),
          icon: <ShieldCheck size={18} />,
          tone: 'accent',
        },
        {
          id: 'publish-state',
          label: input.t('adminKpiConfig.publishState'),
          value: input.t(input.editorState.hasUnpublishedChanges ? 'adminKpiConfig.reviewBeforePublish' : 'adminKpiConfig.noDraftDelta'),
          description: input.editorState.hasUnpublishedChanges
            ? input.t('adminKpiConfig.draftDiffersFromLive')
            : input.t('adminKpiConfig.draftMatchesLive'),
          icon: <ShieldCheck size={18} />,
          tone: input.editorState.hasUnpublishedChanges ? 'warning' : 'success',
        },
      ]}
    />
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
    <AdminSurfaceSection
      eyebrow={input.t('adminKpiConfig.publishModel')}
      title={input.t('adminKpiConfig.draftVsLiveTitle')}
      badge={
        <AdminSurfaceBadge tone={input.editorState.hasUnpublishedChanges ? 'warning' : 'success'}>
          {input.editorState.hasUnpublishedChanges
            ? input.t('adminKpiConfig.unpublishedChanges')
            : input.t('adminKpiConfig.live')}
        </AdminSurfaceBadge>
      }
    >
      <AdminKeyValueGrid>
        <AdminKeyValue
          label={input.t('adminKpiConfig.draftStoreWeight')}
          value={formatWeightPercent(input.storeWeightTotal, input.t)}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.liveStoreWeight')}
          value={formatWeightPercent(input.publishedStoreWeightTotal, input.t)}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.draftPersonnelWeight')}
          value={formatWeightPercent(input.personnelWeightTotal, input.t)}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.livePersonnelWeight')}
          value={formatWeightPercent(input.publishedPersonnelWeightTotal, input.t)}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.draftGradingBands')}
          value={String(input.draft.gradingBands.length)}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.liveGradingBands')}
          value={String(input.published?.gradingBands.length ?? 0)}
        />
      </AdminKeyValueGrid>
    </AdminSurfaceSection>
  )
}

function KpiConfigGovernancePreviewPanel(input: {
  governancePreview: ReturnType<typeof buildGovernancePreview>
  latestPublishedVersion: KpiConfigVersionMetadata | null
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <AdminSurfaceSection
      ariaLabel={input.t('adminKpiConfig.governancePreview')}
      eyebrow={input.t('adminKpiConfig.governancePreview')}
      title={input.t('adminKpiConfig.publishDecisionPreview')}
      badge={
        <AdminSurfaceBadge tone={toSurfaceTone(input.governancePreview.tone)}>
          {input.t(input.governancePreview.statusKey)}
        </AdminSurfaceBadge>
      }
    >
      <KpiConfigMutedText>{input.t(input.governancePreview.summaryKey)}</KpiConfigMutedText>
      <AdminKeyValueGrid>
        <AdminKeyValue
          label={input.t('adminKpiConfig.storeProfileDiff')}
          value={formatDiffSummary(input.governancePreview.storeProfile, input.t)}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.personnelProfileDiff')}
          value={formatDiffSummary(input.governancePreview.personnelProfile, input.t)}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.ownershipDiff')}
          value={formatDiffSummary(input.governancePreview.ownershipMatrix, input.t)}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.gradingDiff')}
          value={formatDiffSummary(input.governancePreview.gradingBands, input.t)}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.versionedSchema')}
          value={
            input.latestPublishedVersion?.versionNo
              ? input.t('adminKpiConfig.active')
              : input.t('adminKpiConfig.preGovernance')
          }
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.latestVersion')}
          value={formatKpiConfigVersion(input.latestPublishedVersion, input.t)}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.publishedAt')}
          value={
            input.latestPublishedVersion?.publishedAt
              ? formatDateTime(input.latestPublishedVersion.publishedAt, input.locale)
              : input.t('adminKpiConfig.notPublishedYet')
          }
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.rollback')}
          value={input.t('adminKpiConfig.rollbackInactive')}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.snapshotAnchoring')}
          value={input.t('adminKpiConfig.snapshotAnchoringActive')}
        />
      </AdminKeyValueGrid>
      <KpiConfigMutedText>{input.t('adminKpiConfig.snapshotAnchoringCopy')}</KpiConfigMutedText>
    </AdminSurfaceSection>
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
    <AdminSurfaceSection
      eyebrow={input.t('adminKpiConfig.ownershipMatrix')}
      title={input.t('adminKpiConfig.ownershipTitle')}
      badge={<AdminSurfaceBadge tone="accent">{input.t('adminKpiConfig.editable')}</AdminSurfaceBadge>}
    >
      {input.draft.ownershipMatrix.length === 0 ? (
        <AdminSurfaceEmpty copy={input.t('adminKpiConfig.noOwnershipRows')} />
      ) : (
        <KpiConfigRowList>
          {input.rows.map(({ item: row, key }, index) => {
            const rowReference = formatEditorRowReference(row.code, row.label, index)

            return (
              <KpiConfigEditorRow
                aria-label={`${input.t('adminKpiConfig.ownershipMatrix')}: ${rowReference}`}
                actions={
                  <Button
                    aria-label={`${input.t('adminKpiConfig.removeRow')}: ${rowReference}`}
                    type="button"
                    variant="destructive"
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
                  </Button>
                }
                key={key}
              >
                <KpiConfigFieldGrid>
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
                </KpiConfigFieldGrid>
              </KpiConfigEditorRow>
            )
          })}
        </KpiConfigRowList>
      )}
      <AdminActionRow>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            input.updateDraft((current) => ({
              ...current,
              ownershipMatrix: [...current.ownershipMatrix, createEmptyOwnershipRow()],
            }))
          }
        >
          {input.t('adminKpiConfig.addOwnershipRow')}
        </Button>
      </AdminActionRow>
    </AdminSurfaceSection>
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
    <AdminSurfaceSection
      eyebrow={input.t('adminKpiConfig.gradingBands')}
      title={input.t('adminKpiConfig.gradingBandsTitle')}
      badge={<AdminSurfaceBadge tone="accent">{input.t('adminKpiConfig.editable')}</AdminSurfaceBadge>}
    >
      <KpiConfigRowList>
        {input.rows.map(({ item: band, key }, index) => {
          const rowReference = formatEditorRowReference(band.code, band.label, index)

          return (
            <KpiConfigEditorRow
              aria-label={`${input.t('adminKpiConfig.gradingBands')}: ${rowReference}`}
              actions={
                <Button
                  aria-label={`${input.t('adminKpiConfig.removeBand')}: ${rowReference}`}
                  type="button"
                  variant="destructive"
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
                </Button>
              }
              key={key}
            >
              <KpiConfigFieldGrid>
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
              </KpiConfigFieldGrid>
            </KpiConfigEditorRow>
          )
        })}
      </KpiConfigRowList>
      <AdminActionRow>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            input.updateDraft((current) => ({
              ...current,
              gradingBands: [...current.gradingBands, createEmptyGradingBand()],
            }))
          }
        >
          {input.t('adminKpiConfig.addGradingBand')}
        </Button>
      </AdminActionRow>
    </AdminSurfaceSection>
  )
}

type KpiConfigPersistStatus = {
  hasUnpublishedChanges: boolean
  publishPending: boolean
  savePending: boolean
  weightTotalsValid: boolean
}

function KpiConfigPersistPanel(input: {
  draft: KpiConfig
  onPublish: () => void
  onSave: () => void
  status: KpiConfigPersistStatus
  t: TranslateFunction
}) {
  return (
    <AdminSurfaceSection
      eyebrow={input.t('adminKpiConfig.saveEyebrow')}
      title={input.t('adminKpiConfig.persistTitle')}
      badge={
        <AdminSurfaceBadge
          tone={input.status.savePending || input.status.publishPending || !input.status.weightTotalsValid ? 'warning' : 'success'}
        >
          {input.status.savePending
            ? input.t('adminKpiConfig.saving')
            : input.status.publishPending
              ? input.t('adminKpiConfig.publishPending')
              : input.status.weightTotalsValid
                ? input.t('adminKpiConfig.ready')
                : input.t('adminKpiConfig.needsWeightBalance')}
        </AdminSurfaceBadge>
      }
    >
      <AdminKeyValueGrid>
        <AdminKeyValue
          label={input.t('adminKpiConfig.saveStoreProfile')}
          value={input.draft.storeProfile.title}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.savePersonnelProfile')}
          value={input.draft.personnelProfile.title}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.matrixRows')}
          value={String(input.draft.ownershipMatrix.length)}
        />
        <AdminKeyValue
          label={input.t('adminKpiConfig.gradingBands')}
          value={String(input.draft.gradingBands.length)}
        />
      </AdminKeyValueGrid>
      {!input.status.weightTotalsValid ? (
        <KpiConfigMutedText>{input.t('adminKpiConfig.weightSaveBlocked')}</KpiConfigMutedText>
      ) : null}
      <AdminActionRow>
        <Button
          type="button"
          variant="outline"
          aria-busy={input.status.savePending}
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
        </Button>
        <Button
          type="button"
          aria-busy={input.status.publishPending}
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
        </Button>
      </AdminActionRow>
    </AdminSurfaceSection>
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
    <AdminSurfaceSection
      eyebrow={input.t('adminKpiConfig.recentChanges')}
      title={input.t('adminKpiConfig.auditTrailTitle')}
      badge={
        <AdminSurfaceBadge tone={input.auditState.loading ? 'warning' : 'accent'}>
          {input.auditState.loading ? input.t('adminKpiConfig.loading') : input.t('adminKpiConfig.live')}
        </AdminSurfaceBadge>
      }
    >
      {input.auditState.loading ? (
        <KpiConfigMutedText>{input.t('adminKpiConfig.loading')}</KpiConfigMutedText>
      ) : input.auditState.showError ? (
        <KpiConfigMutedText>{getErrorMessage(input.auditState.error)}</KpiConfigMutedText>
      ) : input.auditState.items.length > 0 ? (
        <KpiConfigRowList>
          {input.auditState.items.map((item) => (
            <KpiConfigAuditRow item={item} key={item.eventLogId} locale={input.locale} t={input.t} />
          ))}
        </KpiConfigRowList>
      ) : (
        <AdminSurfaceEmpty copy={input.t('adminKpiConfig.noChangesSaved')} />
      )}
    </AdminSurfaceSection>
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
    <KpiConfigEditorRow
      aria-label={input.item.eventType}
      actions={
        <AdminSurfaceBadge tone="accent">{formatDateTime(input.item.occurredAt, input.locale)}</AdminSurfaceBadge>
      }
    >
      <h4 className="tw:m-0 tw:text-sm tw:font-semibold tw:tracking-normal tw:text-foreground">
        {input.item.eventType}
      </h4>
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
        <AdminKeyValueGrid>
          <AdminKeyValue
            label={input.t('adminKpiConfig.storeDiff')}
            value={formatDiffSummary(diffSummary.storeProfile, input.t)}
          />
          <AdminKeyValue
            label={input.t('adminKpiConfig.personnelDiff')}
            value={formatDiffSummary(diffSummary.personnelProfile, input.t)}
          />
          <AdminKeyValue
            label={input.t('adminKpiConfig.ownershipDiff')}
            value={formatDiffSummary(diffSummary.ownershipMatrix, input.t)}
          />
          <AdminKeyValue
            label={input.t('adminKpiConfig.gradingDiff')}
            value={formatDiffSummary(diffSummary.gradingBands, input.t)}
          />
        </AdminKeyValueGrid>
      ) : null}
    </KpiConfigEditorRow>
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
    <AdminSurfaceSection
      eyebrow={input.t('adminKpiConfig.scoreProfile')}
      title={input.title}
      badge={<AdminSurfaceBadge tone={toSurfaceTone(input.weightTone)}>{input.weightLabel}</AdminSurfaceBadge>}
    >
      <KpiConfigMutedText>{input.summary}</KpiConfigMutedText>
      <KpiConfigMutedText>{input.weightGuidance}</KpiConfigMutedText>
      <KpiConfigRowList>
        {metricRows.map(({ item: metric, key }, index) => {
          const rowReference = formatEditorRowReference(metric.code, metric.label, index)

          return (
            <KpiConfigEditorRow
              aria-label={`${input.title} ${input.t('adminKpiConfig.metricRow')} ${rowReference}`}
              actions={
                <Button
                  aria-label={`${input.t('adminKpiConfig.removeMetric')}: ${input.title} ${rowReference}`}
                  type="button"
                  variant="destructive"
                  onClick={() => input.onRemoveMetric(index)}
                >
                  {input.t('adminKpiConfig.removeMetric')}
                </Button>
              }
              key={key}
            >
              <KpiConfigFieldGrid>
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
              </KpiConfigFieldGrid>
              <TextField
                label={input.t('adminKpiConfig.field.notes')}
                value={metric.notes ?? ''}
                multiline
                onChange={(next) => input.onMetricChange(index, { ...metric, notes: next })}
              />
            </KpiConfigEditorRow>
          )
        })}
      </KpiConfigRowList>
      <AdminActionRow>
        <Button type="button" variant="outline" onClick={input.onAddMetric}>
          {input.t('adminKpiConfig.addMetric')}
        </Button>
      </AdminActionRow>
      <KpiConfigMutedText>{input.futureMetricRule}</KpiConfigMutedText>
    </AdminSurfaceSection>
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
