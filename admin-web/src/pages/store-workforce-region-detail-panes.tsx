import type { ReactNode } from 'react'
import { BriefcaseBusiness, ClipboardList, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { useLocalization } from '../features/localization/useLocalization'
import { getTenureFromDate } from './store-workforce-model'
import type { RegionStoreRow } from './store-workforce-region-model'

type Tone = 'cyan' | 'purple' | 'green' | 'amber' | 'rose' | 'blue'

const textInk = 'tw:text-[#071333]'
const textMuted = 'tw:text-[#647194]'

const toneClasses: Record<Tone, { status: string }> = {
  amber: { status: 'tw:bg-[#fff1d9] tw:text-[#a35a00]' },
  blue: { status: 'tw:bg-[#e7efff] tw:text-[#245ed4]' },
  cyan: { status: 'tw:bg-[#ddfbff] tw:text-[#00889b]' },
  green: { status: 'tw:bg-[#def9ec] tw:text-[#087a51]' },
  purple: { status: 'tw:bg-[#efe9ff] tw:text-[#5534e6]' },
  rose: { status: 'tw:bg-[#ffe4ec] tw:text-[#be1645]' },
}

export function ModalPersonnelPane(input: {
  row: RegionStoreRow | null
  t: ReturnType<typeof useLocalization>['t']
}) {
  const employees = input.row?.employees ?? []

  if (input.row?.isLoading) {
    return (
      <ModalUnavailablePane
        icon={<UsersRound className="tw:size-4" />}
        title={input.t('storeWorkforce.regionDetailPersonnelTitle')}
        copy={input.t('storeWorkforce.sourceWaitingShort')}
        t={input.t}
      />
    )
  }

  if (employees.length === 0) {
    return (
      <ModalUnavailablePane
        icon={<UsersRound className="tw:size-4" />}
        title={input.t('storeWorkforce.regionDetailPersonnelTitle')}
        copy={input.t('storeWorkforce.personnelEmptyCopy')}
        t={input.t}
      />
    )
  }

  const now = new Date()

  return (
    <div className="tw:overflow-hidden tw:rounded-2xl tw:border tw:border-[#dfe6f3] tw:bg-white/75">
      <div className="tw:grid tw:grid-cols-[minmax(0,1.2fr)_minmax(0,.9fr)_minmax(0,.7fr)] tw:border-b tw:border-[#dfe6f3] tw:bg-[#f4f7fc]/80 tw:px-3 tw:py-2.5 tw:text-[11px] tw:font-bold tw:text-[#687395] tw:uppercase">
        <span>Personel</span>
        <span>Pozisyon</span>
        <span>Kidem</span>
      </div>
      <div className="tw:max-h-[320px] tw:overflow-y-auto">
        {employees.map((employee) => (
          <div
            key={employee.employeeId}
            className="tw:grid tw:grid-cols-[minmax(0,1.2fr)_minmax(0,.9fr)_minmax(0,.7fr)] tw:items-center tw:border-b tw:border-[#edf1f7] tw:px-3 tw:py-2.5 last:tw:border-b-0"
          >
            <div className="tw:min-w-0">
              <strong className={cn('tw:block tw:truncate tw:text-sm tw:font-semibold', textInk)}>
                {employee.displayName}
              </strong>
              <span className={cn('tw:block tw:truncate tw:text-xs', textMuted)}>
                {employee.externalEmployeeRef ?? 'Personel referansı yok'}
              </span>
            </div>
            <span className={cn('tw:truncate tw:text-sm tw:font-medium', textInk)}>
              {employee.positionName}
            </span>
            <span className={cn('tw:text-sm tw:font-medium', textMuted)}>
              {getTenureFromDate(employee.assignmentStartDate, now).label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ModalPositionPane(input: {
  row: RegionStoreRow | null
  t: ReturnType<typeof useLocalization>['t']
}) {
  const rows = input.row?.summary.positionRows ?? []

  if (input.row?.isLoading || rows.length === 0) {
    return (
      <ModalUnavailablePane
        icon={<BriefcaseBusiness className="tw:size-4" />}
        title={input.t('storeWorkforce.regionDetailPositionTitle')}
        copy={input.row?.isLoading ? input.t('storeWorkforce.sourceWaitingShort') : input.t('storeWorkforce.positionDistributionEmptyCopy')}
        t={input.t}
      />
    )
  }

  const max = Math.max(...rows.map((row) => row.count), 1)

  return (
    <div className="tw:grid tw:gap-2.5 tw:rounded-2xl tw:border tw:border-[#dfe6f3] tw:bg-white/75 tw:p-3">
      {rows.map((row, index) => (
        <div key={row.label} className="tw:grid tw:grid-cols-[minmax(0,1fr)_48px] tw:items-center tw:gap-3">
          <div className="tw:min-w-0">
            <span className={cn('tw:truncate tw:text-sm tw:font-semibold', textInk)}>{row.label}</span>
            <div className="tw:mt-1.5 tw:h-2 tw:overflow-hidden tw:rounded-full tw:bg-[#edf1f7]">
              <span
                className={cn(
                  'tw:block tw:h-full tw:rounded-full',
                  index % 4 === 0
                    ? 'tw:bg-[#6847ff]'
                    : index % 4 === 1
                      ? 'tw:bg-[#20bfd3]'
                      : index % 4 === 2
                        ? 'tw:bg-[#f59e0b]'
                        : 'tw:bg-[#12a873]',
                )}
                style={{ width: `${Math.max(8, (row.count / max) * 100)}%` }}
              />
            </div>
          </div>
          <strong className={cn('tw:text-right tw:text-sm tw:font-semibold', textInk)}>
            {row.count}
          </strong>
        </div>
      ))}
    </div>
  )
}

function ModalUnavailablePane(input: {
  copy: string
  icon: ReactNode
  title: string
  t: ReturnType<typeof useLocalization>['t']
}) {
  return (
    <div className="tw:rounded-2xl tw:border tw:border-[#dfe6f3] tw:bg-white/75 tw:p-4">
      <div className="tw:flex tw:items-start tw:gap-3">
        <div className="tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-[13px] tw:bg-[#efe9ff] tw:text-[#5534e6]">
          {input.icon}
        </div>
        <div className="tw:min-w-0">
          <Status tone="amber">{input.t('storeWorkforce.valueContractShort')}</Status>
          <strong className={cn('tw:mt-3 tw:block tw:text-base tw:font-bold', textInk)}>
            {input.title}
          </strong>
          <p className={cn('tw:mt-1.5 tw:text-sm tw:leading-6', textMuted)}>
            {input.copy}
          </p>
        </div>
      </div>
    </div>
  )
}

export function ModalRequestsPlaceholder(input: {
  t: ReturnType<typeof useLocalization>['t']
}) {
  return (
    <ModalUnavailablePane
      icon={<ClipboardList className="tw:size-4" />}
      title={input.t('storeWorkforce.regionDetailRequestsTitle')}
      copy={input.t('storeWorkforce.regionDetailRequestsCopy')}
      t={input.t}
    />
  )
}

function Status(input: { children: ReactNode; tone: Tone }) {
  return (
    <span
      className={cn(
        'tw:inline-flex tw:min-h-[27px] tw:items-center tw:gap-1.5 tw:rounded-full tw:px-2.5 tw:text-xs tw:font-bold tw:whitespace-nowrap',
        toneClasses[input.tone].status,
      )}
    >
      <span className="tw:size-[7px] tw:rounded-full tw:bg-current" />
      {input.children}
    </span>
  )
}
