import { FileCheck2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CommandCanvasOperationalDrawerContent } from '@/features/store-command-canvas/primitives'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { formatIncentiveMoney, formatIncentiveRate, formatSignedIncentiveMoney } from './format'
import type { IncentiveRow, IncentiveStore } from './types'

type Translate = ReturnType<typeof useLocalization>['t']

export function ReadOnlyCorrectionDrawer(input: {
  selection: { store: IncentiveStore; row: IncentiveRow } | null
  onClose: () => void
  locale: AppLocale
  t: Translate
}) {
  const correction = input.selection?.row.correction ?? null
  const row = input.selection?.row ?? null
  const store = input.selection?.store ?? null

  return (
    <Sheet open={input.selection !== null} onOpenChange={(open) => { if (!open) input.onClose() }}>
      <CommandCanvasOperationalDrawerContent>
        <SheetHeader className="incentive-drawer-header">
          <span className="incentive-drawer-icon"><FileCheck2 aria-hidden="true" size={20} /></span>
          <div>
            <SheetTitle>{input.t('storeIncentives.command.correctionRecordTitle')}</SheetTitle>
            <SheetDescription>{row?.displayName} / {store?.storeName}</SheetDescription>
          </div>
        </SheetHeader>
        {row && correction ? (
          <div className="incentive-drawer-body incentive-readonly-drawer-body">
            <section className="incentive-readonly-summary">
              <div className="incentive-readonly-heading">
                <div><h3>{input.t('storeIncentives.command.resultTitle')}</h3><p>{input.t('storeIncentives.command.resultCopy')}</p></div>
                <Badge variant="secondary">{input.t('storeIncentives.command.corrected')}</Badge>
              </div>
              <div className="incentive-stat-grid">
                <DrawerStat label={input.t('storeIncentives.command.baseFinal')} value={formatIncentiveMoney(row.calculatedAmount, input.locale)} />
                <DrawerStat label={input.t('storeIncentives.command.afterCorrection')} value={formatIncentiveMoney(row.finalAmount, input.locale)} />
                <DrawerStat label={input.t('storeIncentives.command.signedDifference')} value={formatSignedIncentiveMoney(row.signedDifferenceAmount, input.locale)} />
                <DrawerStat label={input.t('storeIncentives.command.appliedRate')} value={formatIncentiveRate(row.rate, input.locale)} />
              </div>
            </section>
            <section className="incentive-correction-audit-card">
              <div className="incentive-audit-note"><small>{input.t('storeIncentives.command.correctionNote')}</small><p>{correction.reasonNote || input.t('storeIncentives.command.noteUnavailable')}</p></div>
              <dl>
                <AuditRow label={input.t('storeIncentives.command.correctedBy')} value={correction.actor.displayName || input.t('storeIncentives.command.actorUnavailable')} />
                <AuditRow label={input.t('storeIncentives.roles')} value={formatActorRole(correction.actor.roleCode, input.t)} />
                <AuditRow label={input.t('storeIncentives.command.status')} value={formatCorrectionStatus(correction.status, input.t)} />
                <AuditRow label={input.t('storeIncentives.command.correctionDate')} value={formatDate(correction.reviewedAt ?? correction.submittedAt ?? correction.createdAt, input.locale)} />
              </dl>
              {correction.reviewNote ? <div className="incentive-audit-note"><small>{input.t('storeIncentives.command.reviewColumn')}</small><p>{correction.reviewNote}</p></div> : null}
            </section>
          </div>
        ) : null}
      </CommandCanvasOperationalDrawerContent>
    </Sheet>
  )
}

function DrawerStat(input: { label: string; value: string }) {
  return <div className="incentive-drawer-stat"><small>{input.label}</small><strong>{input.value}</strong></div>
}

function AuditRow(input: { label: string; value: string }) {
  return <div><dt>{input.label}</dt><dd>{input.value}</dd></div>
}

function formatDate(value: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul',
  }).format(new Date(value))
}

function formatActorRole(role: 'REGION_MANAGER' | 'HR_ADMIN' | 'SUPER_ADMIN' | null, t: Translate) {
  if (role === 'REGION_MANAGER') return t('storeIncentives.command.roleRegionManager')
  if (role === 'HR_ADMIN') return t('storeIncentives.command.roleHrAdmin')
  if (role === 'SUPER_ADMIN') return t('storeIncentives.command.roleSuperAdmin')
  return '—'
}

function formatCorrectionStatus(
  status: 'draft' | 'submitted' | 'admin_approved' | 'admin_returned' | 'voided',
  t: Translate,
) {
  const key = status === 'draft' ? 'storeIncentives.command.correctionStatusDraft'
    : status === 'submitted' ? 'storeIncentives.command.correctionStatusSubmitted'
      : status === 'admin_approved' ? 'storeIncentives.command.correctionStatusApproved'
        : status === 'admin_returned' ? 'storeIncentives.command.correctionStatusReturned'
          : 'storeIncentives.command.correctionStatusVoided'
  return t(key)
}
