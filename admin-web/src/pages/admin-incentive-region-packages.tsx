import type { UseMutationResult } from '@tanstack/react-query'
import { CheckCircle2, ClipboardCheck, RotateCcw } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Textarea } from '../components/ui/textarea'
import {
  type AdminSalesTargetIncentiveRegionPackageReviewInput,
  type AdminSalesTargetIncentiveRegionPackageReviewResponse,
  type SalesTargetIncentiveAdminRegionPackageSummary,
  type SalesTargetIncentiveProjection,
  type SalesTargetIncentiveRow,
} from '../features/incentives/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { normalizeDisplayLabel } from '../lib/display-labels'
import { getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { formatMoneyValue } from './store-incentives-model'
import {
  AdminOperationalActionRow as AdminActionRow,
  AdminOperationalBadge as AdminSurfaceBadge,
  AdminOperationalEmpty as AdminSurfaceEmpty,
  AdminOperationalSection as AdminSurfaceSection,
  AdminOperationalState as AdminStatePanel,
  type AdminOperationalTone as AdminSurfaceTone,
} from './admin-operational-primitives'

type RegionPackageRow = {
  id: string
  projection: SalesTargetIncentiveProjection
  row: SalesTargetIncentiveRow
}

const INCENTIVE_TIMEZONE = 'Europe/Istanbul'

export function AdminRegionPackageReviewSection(input: {
  packages: SalesTargetIncentiveAdminRegionPackageSummary[]
  projections: SalesTargetIncentiveProjection[]
  expandedRegionId: string | null
  returnNotes: Record<string, string>
  locale: AppLocale
  t: TranslateFunction
  mutation: UseMutationResult<
    AdminSalesTargetIncentiveRegionPackageReviewResponse,
    Error,
    AdminSalesTargetIncentiveRegionPackageReviewInput
  >
  onToggleRegion: (regionId: string) => void
  onReturnNoteChange: (regionId: string, note: string) => void
  onReview: (packageSummary: SalesTargetIncentiveAdminRegionPackageSummary, decision: 'approve' | 'return') => void
}) {
  if (input.packages.length === 0) {
    return (
      <AdminSurfaceSection
        title={input.t('adminIncentives.packages.title')}
        description={input.t('adminIncentives.packages.emptyDescription')}
        badge={(
          <AdminSurfaceBadge tone="neutral">
            {input.t('adminIncentives.packages.packageCount', { count: 0 })}
          </AdminSurfaceBadge>
        )}
        testId="admin-incentive-region-packages"
      >
        <AdminSurfaceEmpty
          title={input.t('adminIncentives.packages.emptyTitle')}
          copy={input.t('adminIncentives.packages.emptyCopy')}
        />
      </AdminSurfaceSection>
    )
  }

  return (
    <AdminSurfaceSection
      title={input.t('adminIncentives.packages.title')}
      description={input.t('adminIncentives.packages.description')}
      badge={(
        <AdminSurfaceBadge tone="cyan">
          {input.t('adminIncentives.packages.regionCount', { count: input.packages.length })}
        </AdminSurfaceBadge>
      )}
      testId="admin-incentive-region-packages"
    >
      <div className="tw:grid tw:gap-3">
        {input.packages.map((packageSummary) => {
          const isExpanded = input.expandedRegionId === packageSummary.regionId
          const packageProjections = input.projections.filter(
            (projection) => projection.regionId === packageSummary.regionId,
          )
          const packageRows = flattenPackageRows(packageProjections)
          const correctionRows = packageRows.filter((item) =>
            item.row.regionCorrection &&
            item.row.regionCorrection.status !== 'draft' &&
            item.row.regionCorrection.status !== 'voided',
          )
          const status = getRegionPackageStatus(packageSummary.status, input.t)
          const regionLabel = normalizeDisplayLabel(
            packageSummary.regionManagerName ?? packageSummary.regionName,
            input.t('adminIncentives.packages.regionManagerFallback'),
          )
          const regionName = normalizeDisplayLabel(
            packageSummary.regionName,
            input.t('adminIncentives.packages.regionNameFallback'),
          )
          const isSubmitted = packageSummary.status === 'submitted'
          const returnNote = input.returnNotes[packageSummary.regionId] ?? ''
          const isMutatingThis =
            input.mutation.isPending && input.mutation.variables?.regionId === packageSummary.regionId

          return (
            <article
              className="tw:rounded-xl tw:border tw:border-border tw:bg-card/75 tw:p-3 tw:shadow-sm"
              data-testid="admin-incentive-region-package"
              key={packageSummary.regionId}
            >
              <button
                className="tw:grid tw:w-full tw:gap-3 tw:text-left tw:md:grid-cols-[minmax(0,1.25fr)_auto]"
                onClick={() => input.onToggleRegion(packageSummary.regionId)}
                type="button"
              >
                <span className="tw:flex tw:min-w-0 tw:items-start tw:gap-3">
                  <span className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-primary/10 tw:text-primary">
                    <ClipboardCheck size={18} />
                  </span>
                  <span className="tw:min-w-0">
                    <span className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">
                      {regionLabel}
                    </span>
                    <span className="tw:mt-1 tw:block tw:text-xs tw:text-muted-foreground">
                      {regionName}
                    </span>
                  </span>
                </span>
                <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:md:justify-end">
                  <AdminSurfaceBadge tone={status.tone}>{status.label}</AdminSurfaceBadge>
                  <AdminSurfaceBadge tone="neutral">
                    {input.t('adminIncentives.packages.storeCount', {
                      count: packageSummary.submittedStoreCount,
                    })}
                  </AdminSurfaceBadge>
                  <AdminSurfaceBadge tone={packageSummary.submittedCorrectionCount > 0 ? 'warning' : 'neutral'}>
                    {input.t('adminIncentives.packages.correctionCount', {
                      count: packageSummary.submittedCorrectionCount,
                    })}
                  </AdminSurfaceBadge>
                </span>
              </button>

              {isExpanded ? (
                <div className="tw:mt-4 tw:grid tw:gap-4">
                  <div className="tw:grid tw:gap-2 tw:md:grid-cols-4">
                    <PackageStat label={input.t('adminIncentives.packages.review')} value={`${packageSummary.reviewedStoreCount}/${packageSummary.storeCount}`} />
                    <PackageStat label={input.t('adminIncentives.packages.submittedStores')} value={packageSummary.submittedStoreCount} />
                    <PackageStat label={input.t('adminIncentives.packages.draftCorrections')} value={packageSummary.draftCorrectionCount} />
                    <PackageStat label={input.t('adminIncentives.packages.submittedCorrections')} value={packageSummary.submittedCorrectionCount} />
                  </div>

                  <div className="tw:grid tw:gap-1 tw:text-xs tw:text-muted-foreground">
                    <span>
                      {input.t('adminIncentives.packages.submittedBy', {
                        name: packageSummary.submittedByName ?? input.t('adminIncentives.packages.waiting'),
                      })}
                      {packageSummary.submittedAt ? ` / ${formatDateTimeLabel(packageSummary.submittedAt, input.locale)}` : ''}
                    </span>
                    {packageSummary.reviewedAt ? (
                      <span>
                        {input.t('adminIncentives.packages.adminDecision', {
                          name: packageSummary.reviewedByName ?? 'Admin',
                          date: formatDateTimeLabel(packageSummary.reviewedAt, input.locale),
                        })}
                      </span>
                    ) : null}
                    {packageSummary.reviewNote ? (
                      <span>
                        {input.t('adminIncentives.packages.adminNote', {
                          note: packageSummary.reviewNote,
                        })}
                      </span>
                    ) : null}
                  </div>

                  <RegionCorrectionRows rows={correctionRows} locale={input.locale} t={input.t} />

                  <div className="tw:grid tw:gap-2 tw:rounded-xl tw:border tw:border-border tw:bg-muted/25 tw:p-3">
                    <label className="tw:grid tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
                      {input.t('adminIncentives.packages.revisionNote')}
                      <Textarea
                        aria-label={input.t('adminIncentives.packages.revisionNoteAria', {
                          region: regionLabel,
                        })}
                        disabled={!isSubmitted || isMutatingThis}
                        onChange={(event) => input.onReturnNoteChange(packageSummary.regionId, event.target.value)}
                        placeholder={input.t('adminIncentives.packages.revisionPlaceholder')}
                        value={returnNote}
                      />
                    </label>
                    <AdminActionRow>
                      <Button
                        disabled={!isSubmitted || isMutatingThis}
                        onClick={() => input.onReview(packageSummary, 'approve')}
                        type="button"
                      >
                        <CheckCircle2 size={14} />
                        {input.t('adminIncentives.packages.approve')}
                      </Button>
                      <Button
                        disabled={!isSubmitted || !returnNote.trim() || isMutatingThis}
                        onClick={() => input.onReview(packageSummary, 'return')}
                        type="button"
                        variant="outline"
                      >
                        <RotateCcw size={14} />
                        {input.t('adminIncentives.packages.requestRevision')}
                      </Button>
                    </AdminActionRow>
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>

      {input.mutation.isError ? (
        <AdminStatePanel
          title={input.t('adminIncentives.packages.decisionError')}
          description={getErrorMessage(input.mutation.error)}
          tone="danger"
        />
      ) : null}
    </AdminSurfaceSection>
  )
}

function RegionCorrectionRows(input: {
  rows: RegionPackageRow[]
  locale: AppLocale
  t: TranslateFunction
}) {
  if (input.rows.length === 0) {
    return (
      <AdminSurfaceEmpty
        title={input.t('adminIncentives.packages.noCorrectionsTitle')}
        copy={input.t('adminIncentives.packages.noCorrectionsCopy')}
      />
    )
  }

  return (
    <div className="tw:overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{input.t('adminIncentives.column.store')}</TableHead>
            <TableHead>{input.t('adminIncentives.column.personnel')}</TableHead>
            <TableHead className="tw:text-right">{input.t('adminIncentives.packages.beforeAmount')}</TableHead>
            <TableHead className="tw:text-right">{input.t('adminIncentives.packages.finalAmount')}</TableHead>
            <TableHead className="tw:text-right">{input.t('adminIncentives.packages.difference')}</TableHead>
            <TableHead>{input.t('adminIncentives.packages.managerNote')}</TableHead>
            <TableHead>{input.t('adminIncentives.packages.submission')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {input.rows.map((item) => {
            const correction = item.row.regionCorrection
            if (!correction) return null

            return (
              <TableRow key={`${item.id}:region-correction`}>
                <TableCell className="tw:min-w-44 tw:font-medium">{item.projection.storeName}</TableCell>
                <TableCell className="tw:min-w-44">{item.row.displayName}</TableCell>
                <TableCell className="tw:text-right">
                  {formatRegionMoneyValue(correction.beforeAmount, input.locale, input.t)}
                </TableCell>
                <TableCell className="tw:text-right tw:font-semibold">
                  {formatRegionMoneyValue(correction.finalAmount, input.locale, input.t)}
                </TableCell>
                <TableCell className="tw:text-right">
                  {formatRegionMoneyValue(correction.adjustmentAmount, input.locale, input.t)}
                </TableCell>
                <TableCell className="tw:min-w-64">{correction.reasonNote}</TableCell>
                <TableCell className="tw:min-w-40">
                  {correction.submittedAt
                    ? formatDateTimeLabel(correction.submittedAt, input.locale)
                    : input.t('adminIncentives.packages.waiting')}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function PackageStat(input: { label: string; value: number | string }) {
  return (
    <div className="tw:rounded-lg tw:border tw:border-border/70 tw:bg-background/70 tw:p-3">
      <span className="tw:block tw:text-xs tw:font-medium tw:text-muted-foreground">{input.label}</span>
      <strong className="tw:mt-1 tw:block tw:text-lg tw:font-semibold tw:text-foreground">{input.value}</strong>
    </div>
  )
}

function getRegionPackageStatus(
  status: SalesTargetIncentiveAdminRegionPackageSummary['status'],
  t: TranslateFunction,
): { label: string; tone: AdminSurfaceTone } {
  if (status === 'submitted') {
    return { label: t('adminIncentives.packages.statusSubmitted'), tone: 'accent' }
  }
  if (status === 'admin_approved') {
    return { label: t('adminIncentives.packages.statusApproved'), tone: 'success' }
  }
  if (status === 'admin_returned') {
    return { label: t('adminIncentives.packages.statusReturned'), tone: 'warning' }
  }
  return { label: t('adminIncentives.packages.statusNotSubmitted'), tone: 'neutral' }
}

function formatDateTimeLabel(value: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: INCENTIVE_TIMEZONE,
  }).format(new Date(value))
}

function formatRegionMoneyValue(
  value: string | null | undefined,
  locale: AppLocale,
  t: TranslateFunction,
) {
  const formatted = formatMoneyValue(value, locale)
  return formatted === formatMoneyValue(null, locale)
    ? t('adminIncentives.noSource')
    : formatted
}

function flattenPackageRows(projections: SalesTargetIncentiveProjection[]): RegionPackageRow[] {
  return projections.flatMap((projection) =>
    projection.rows.map((row) => ({
      id: `${projection.storeId}:${row.employeeId}:${row.participantType}`,
      projection,
      row,
    })),
  )
}
