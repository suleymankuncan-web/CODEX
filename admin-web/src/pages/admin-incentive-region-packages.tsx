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
import { normalizeDisplayLabel } from '../lib/display-labels'
import { getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { formatMoneyValue } from './store-incentives-model'
import {
  AdminActionRow,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceSection,
  type AdminSurfaceTone,
} from './admin-surface-primitives'

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
        title="Bölge müdürü onay paketleri"
        description="Bu dönem için bölge müdürü onay paketi yok."
        badge={<AdminSurfaceBadge tone="neutral">0 paket</AdminSurfaceBadge>}
        testId="admin-incentive-region-packages"
      >
        <AdminSurfaceEmpty title="Paket bulunamadı" copy="Seçili dönem için bölge müdürü gönderimi yok." />
      </AdminSurfaceSection>
    )
  }

  return (
    <AdminSurfaceSection
      title="Bölge müdürü onay paketleri"
      description="Bölge müdürü gönderimlerini, düzeltme notlarını ve nihai onay kararını buradan yönetin."
      badge={<AdminSurfaceBadge tone="cyan">{input.packages.length} bölge</AdminSurfaceBadge>}
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
          const status = getRegionPackageStatus(packageSummary.status)
          const regionLabel = normalizeDisplayLabel(
            packageSummary.regionManagerName ?? packageSummary.regionName,
            'Bölge müdürü',
          )
          const regionName = normalizeDisplayLabel(packageSummary.regionName, 'Bölge adı yok')
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
                    {packageSummary.submittedStoreCount} mağaza
                  </AdminSurfaceBadge>
                  <AdminSurfaceBadge tone={packageSummary.submittedCorrectionCount > 0 ? 'warning' : 'neutral'}>
                    {packageSummary.submittedCorrectionCount} düzeltme
                  </AdminSurfaceBadge>
                </span>
              </button>

              {isExpanded ? (
                <div className="tw:mt-4 tw:grid tw:gap-4">
                  <div className="tw:grid tw:gap-2 tw:md:grid-cols-4">
                    <PackageStat label="Kontrol" value={`${packageSummary.reviewedStoreCount}/${packageSummary.storeCount}`} />
                    <PackageStat label="Gönderilen mağaza" value={packageSummary.submittedStoreCount} />
                    <PackageStat label="Taslak düzeltme" value={packageSummary.draftCorrectionCount} />
                    <PackageStat label="Gönderilen düzeltme" value={packageSummary.submittedCorrectionCount} />
                  </div>

                  <div className="tw:grid tw:gap-1 tw:text-xs tw:text-muted-foreground">
                    <span>
                      Gönderen: {packageSummary.submittedByName ?? 'Bekleniyor'}
                      {packageSummary.submittedAt ? ` / ${formatDateTimeLabel(packageSummary.submittedAt, input.locale)}` : ''}
                    </span>
                    {packageSummary.reviewedAt ? (
                      <span>
                        Admin kararı: {packageSummary.reviewedByName ?? 'Admin'} / {formatDateTimeLabel(packageSummary.reviewedAt, input.locale)}
                      </span>
                    ) : null}
                    {packageSummary.reviewNote ? <span>Admin notu: {packageSummary.reviewNote}</span> : null}
                  </div>

                  <RegionCorrectionRows rows={correctionRows} locale={input.locale} />

                  <div className="tw:grid tw:gap-2 tw:rounded-xl tw:border tw:border-border tw:bg-muted/25 tw:p-3">
                    <label className="tw:grid tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
                      Revizyon notu
                      <Textarea
                        aria-label={`${regionLabel} revizyon notu`}
                        disabled={!isSubmitted || isMutatingThis}
                        onChange={(event) => input.onReturnNoteChange(packageSummary.regionId, event.target.value)}
                        placeholder="Revizyon gerekçesini yazın"
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
                        Onayla
                      </Button>
                      <Button
                        disabled={!isSubmitted || !returnNote.trim() || isMutatingThis}
                        onClick={() => input.onReview(packageSummary, 'return')}
                        type="button"
                        variant="outline"
                      >
                        <RotateCcw size={14} />
                        Revizyon iste
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
          title="Paket kararı kaydedilemedi"
          description={getErrorMessage(input.mutation.error)}
          tone="danger"
        />
      ) : null}
    </AdminSurfaceSection>
  )
}

function RegionCorrectionRows(input: { rows: RegionPackageRow[]; locale: AppLocale }) {
  if (input.rows.length === 0) {
    return (
      <AdminSurfaceEmpty
        title="Düzeltme yok"
        copy="Bu pakette bölge müdürü düzeltmesi bulunmuyor."
      />
    )
  }

  return (
    <div className="tw:overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mağaza</TableHead>
            <TableHead>Personel</TableHead>
            <TableHead className="tw:text-right">Eski tutar</TableHead>
            <TableHead className="tw:text-right">Final tutar</TableHead>
            <TableHead className="tw:text-right">Fark</TableHead>
            <TableHead>BM notu</TableHead>
            <TableHead>Gönderim</TableHead>
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
                <TableCell className="tw:text-right">{formatMoneyValue(correction.beforeAmount, input.locale)}</TableCell>
                <TableCell className="tw:text-right tw:font-semibold">{formatMoneyValue(correction.finalAmount, input.locale)}</TableCell>
                <TableCell className="tw:text-right">{formatMoneyValue(correction.adjustmentAmount, input.locale)}</TableCell>
                <TableCell className="tw:min-w-64">{correction.reasonNote}</TableCell>
                <TableCell className="tw:min-w-40">
                  {correction.submittedAt ? formatDateTimeLabel(correction.submittedAt, input.locale) : 'Bekleniyor'}
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
): { label: string; tone: AdminSurfaceTone } {
  if (status === 'submitted') {
    return { label: 'Bölge müdürü tarafından onaya gönderildi', tone: 'accent' }
  }
  if (status === 'admin_approved') {
    return { label: 'Admin tarafından onaylandı', tone: 'success' }
  }
  if (status === 'admin_returned') {
    return { label: 'Revizyon istendi', tone: 'warning' }
  }
  return { label: 'Onaya gönderilmedi', tone: 'neutral' }
}

function formatDateTimeLabel(value: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: INCENTIVE_TIMEZONE,
  }).format(new Date(value))
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
