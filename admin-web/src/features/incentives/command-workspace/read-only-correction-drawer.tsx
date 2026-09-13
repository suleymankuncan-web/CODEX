import { FileCheck2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CommandCanvasOperationalDrawerContent } from '@/features/store-command-canvas/primitives'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { formatIncentiveMoney, formatIncentiveRate, formatSignedIncentiveMoney } from './format'
import type { IncentiveRow, IncentiveStore, IncentiveWorkspace } from './types'

type Translate = ReturnType<typeof useLocalization>['t']

export function ReadOnlyCorrectionDrawer(input: {
  selection: { store: IncentiveStore; row: IncentiveRow } | null
  onClose: () => void
  locale: AppLocale
  t: Translate
  workspace: IncentiveWorkspace
}) {
  const correction = input.selection?.row.correction ?? null
  const row = input.selection?.row ?? null
  const store = input.selection?.store ?? null
  const tr = input.locale === 'tr'
  const rates = input.workspace.rateMetadata.tables.find(table => table.audience === (row?.participantType === 'store_manager' ? 'manager' : 'personnel'))
  const uniqueRates = [...new Map(rates?.brackets.map(bracket => [Number(bracket.rate), bracket.rate])).values()]

  return (
    <Sheet open={input.selection !== null} onOpenChange={(open) => { if (!open) input.onClose() }}>
      <CommandCanvasOperationalDrawerContent>
        <SheetHeader className="incentive-drawer-header">
          <span className="incentive-drawer-icon"><FileCheck2 aria-hidden="true" size={20} /></span>
          <div>
            <SheetTitle>{row?.displayName ?? (tr ? 'Prim bilgileri' : 'Incentive details')}</SheetTitle>
            <SheetDescription>{store?.storeName}</SheetDescription>
          </div>
        </SheetHeader>
        {row ? (
          <div className="incentive-drawer-body incentive-readonly-drawer-body">
            <section className="incentive-readonly-summary">
              <div className="incentive-readonly-heading">
                <div><h3>{input.t('storeIncentives.command.resultTitle')}</h3><p>{tr ? 'Personelin dönem primi ve varsa düzeltme bilgileri.' : 'Period incentive and any correction details for this person.'}</p></div>
                <Badge variant="secondary">{correction ? input.t('storeIncentives.command.corrected') : (tr ? 'Hesaplanan prim' : 'Calculated incentive')}</Badge>
              </div>
              <div className="incentive-stat-grid">
                <DrawerStat label={input.t('storeIncentives.command.targetColumn')} value={formatIncentiveMoney(row.target, input.locale)} />
                <DrawerStat label={input.t('storeIncentives.command.actualColumn')} value={formatIncentiveMoney(row.actual, input.locale)} />
                <DrawerStat label={tr ? 'Hesaplanan prim' : 'Calculated incentive'} value={formatIncentiveMoney(row.calculatedAmount, input.locale)} />
                <DrawerStat label={tr ? 'Final Prim' : 'Final incentive'} value={formatIncentiveMoney(row.finalAmount, input.locale)} />
                <DrawerStat label={input.t('storeIncentives.command.signedDifference')} value={formatSignedIncentiveMoney(row.signedDifferenceAmount, input.locale)} />
                <DrawerStat label={tr ? 'Hesaplama oranı' : 'Calculation rate'} value={formatIncentiveRate(row.rate, input.locale)} />
              </div>
            </section>
            <section className="incentive-readonly-rates" aria-label={tr ? 'Prim oranları' : 'Incentive rates'}><h3>{tr ? 'Prim oranları' : 'Incentive rates'}</h3>
              {input.workspace.rateMetadata.status === 'resolved' && rates ? <div>{uniqueRates.map(rate => <Badge key={rate} variant={Number(rate) === Number(row.rate) ? 'default' : 'outline'}>{formatIncentiveRate(rate, input.locale)}</Badge>)}</div> : <p>{input.t('storeIncentives.command.rateUnavailable')}</p>}
              <p>{tr ? 'Hesaplama oranları bilgi amaçlıdır. Prim düzeltmesini bölge müdürü yapar.' : 'Calculation rates are shown for reference. Corrections are made by the regional manager.'}</p>
            </section>
            <section className="incentive-correction-audit-card">
              <div className="incentive-audit-note incentive-personnel-note"><small>{input.t('storeIncentives.command.correctionNote')}</small><p>{correction?.reasonNote || (tr ? 'Bu personel için henüz not eklenmedi.' : 'No note has been added for this person.')}</p></div>
              {correction ? <dl>
                <AuditRow label={input.t('storeIncentives.command.correctedBy')} value={correction.actor.displayName || input.t('storeIncentives.command.actorUnavailable')} />
                <AuditRow label={input.t('storeIncentives.roles')} value={formatActorRole(correction.actor.roleCode, input.t)} />
                <AuditRow label={input.t('storeIncentives.command.status')} value={formatCorrectionStatus(correction.status, input.t)} />
                <AuditRow label={input.t('storeIncentives.command.correctionDate')} value={formatDate(correction.reviewedAt ?? correction.submittedAt ?? correction.createdAt, input.locale)} />
              </dl> : null}
              {correction?.reviewNote ? <div className="incentive-audit-note"><small>{input.t('storeIncentives.command.reviewColumn')}</small><p>{correction.reviewNote}</p></div> : null}
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
