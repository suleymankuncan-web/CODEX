import { useMemo, useState, type ReactNode } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { CalendarClock, ChevronRight, Inbox, Search, Store, Users, UsersRound, X } from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import { getAssignedStoreIds, getReadRegionIds, getReadStoreIds } from '../features/auth/authorization'
import { useLocalization } from '../features/localization/useLocalization'
import { getOrgStores, getStoreEmployees, getStoreHeadcountGap } from '../features/workforce/api'
import { formatNumber } from '../lib/format'
import { formatNormActualLabel, getMonthRange } from './store-workforce-headcount'
import { deriveWorkforceSummary } from './store-workforce-model'
import {
  ModalPersonnelPane,
  ModalPositionPane,
  ModalRequestsPlaceholder,
} from './store-workforce-region-detail-panes'
import { MiniBars, MiniMetric, MiniValue } from './store-workforce-region-metrics'
import type { RegionStoreRow } from './store-workforce-region-model'

type DetailTab = 'people' | 'positions' | 'requests'
type Tone = 'cyan' | 'purple' | 'green' | 'amber' | 'rose' | 'blue'

const surfaceShadow = 'tw:shadow-[0_24px_70px_rgba(58,75,118,0.16)]'
const glassPanel =
  'tw:border tw:border-[#b4c1db]/70 tw:bg-white/85 tw:backdrop-blur-[22px]'
const textInk = 'tw:text-[#071333]'
const textMuted = 'tw:text-[#647194]'

const toneClasses: Record<Tone, {
  icon: string
  pill: string
  status: string
}> = {
  amber: {
    icon: 'tw:bg-[#fff1d9] tw:text-[#f59e0b]',
    pill: 'tw:bg-[#fff1d9] tw:text-[#a35a00]',
    status: 'tw:bg-[#fff1d9] tw:text-[#a35a00]',
  },
  blue: {
    icon: 'tw:bg-[#e7efff] tw:text-[#3477f6]',
    pill: 'tw:bg-[#e7efff] tw:text-[#245ed4]',
    status: 'tw:bg-[#e7efff] tw:text-[#245ed4]',
  },
  cyan: {
    icon: 'tw:bg-[#ddfbff] tw:text-[#20bfd3]',
    pill: 'tw:bg-[#ddfbff] tw:text-[#00889b]',
    status: 'tw:bg-[#ddfbff] tw:text-[#00889b]',
  },
  green: {
    icon: 'tw:bg-[#def9ec] tw:text-[#12a873]',
    pill: 'tw:bg-[#def9ec] tw:text-[#087a51]',
    status: 'tw:bg-[#def9ec] tw:text-[#087a51]',
  },
  purple: {
    icon: 'tw:bg-[#efe9ff] tw:text-[#6847ff]',
    pill: 'tw:bg-[#efe9ff] tw:text-[#5534e6]',
    status: 'tw:bg-[#efe9ff] tw:text-[#5534e6]',
  },
  rose: {
    icon: 'tw:bg-[#ffe4ec] tw:text-[#f43f6d]',
    pill: 'tw:bg-[#ffe4ec] tw:text-[#be1645]',
    status: 'tw:bg-[#ffe4ec] tw:text-[#be1645]',
  },
}

export function RegionWorkforceView(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const now = useMemo(() => new Date(), [])
  const currentMonthRange = useMemo(() => getMonthRange(now), [now])
  const explicitReadStoreIds = useMemo(() => getUniqueIds(getReadStoreIds(input.authSummary)), [input.authSummary])
  const assignedStoreIds = useMemo(() => getUniqueIds(getAssignedStoreIds(input.authSummary)), [input.authSummary])
  const fallbackStoreIds = useMemo(
    () => getUniqueIds([...explicitReadStoreIds, ...assignedStoreIds]),
    [assignedStoreIds, explicitReadStoreIds],
  )
  const readRegionIds = useMemo(() => getUniqueIds(getReadRegionIds(input.authSummary)), [input.authSummary])
  const orgStoresQuery = useQuery({
    queryKey: ['store-workforce-region-org-stores', fallbackStoreIds.join('|'), readRegionIds.join('|')],
    queryFn: getOrgStores,
  })
  const scopedStores = useMemo(
    () => {
      const orgStores = orgStoresQuery.data?.items ?? []
      const hasRegionalScope = readRegionIds.length > 0
      const scopedOrgStores = !hasRegionalScope && fallbackStoreIds.length > 0
        ? orgStores.filter((store) => fallbackStoreIds.includes(store.store_id))
        : orgStores

      if (scopedOrgStores.length > 0) {
        return scopedOrgStores.map((store) => ({
          storeId: store.store_id,
          storeLabel: store.store_name || store.store_code || store.store_id,
        }))
      }

      return fallbackStoreIds.map((storeId) => ({
        storeId,
        storeLabel: storeId,
      }))
    },
    [fallbackStoreIds, orgStoresQuery.data?.items, readRegionIds.length],
  )
  const storeEmployeeQueries = useQueries({
    queries: scopedStores.map((store) => ({
      queryKey: ['workforce-store-employees', 'store-workforce-region', store.storeId],
      queryFn: () => getStoreEmployees(store.storeId),
      enabled: Boolean(store.storeId),
    })),
  })
  const storeHeadcountQueries = useQueries({
    queries: scopedStores.map((store) => ({
      queryKey: [
        'workforce-headcount-gap',
        'store-workforce-region',
        store.storeId,
        currentMonthRange.periodStart,
        currentMonthRange.periodEnd,
      ],
      queryFn: () => getStoreHeadcountGap({
        storeId: store.storeId,
        periodStart: currentMonthRange.periodStart,
        periodEnd: currentMonthRange.periodEnd,
      }),
      enabled: Boolean(store.storeId),
    })),
  })
  const scopedRows = useMemo(
    () =>
      scopedStores.map((store, index) => {
        const query = storeEmployeeQueries[index]
        const headcountQuery = storeHeadcountQueries[index]
        const employees = query?.data?.items ?? []

        return {
          ...store,
          employees,
          headcountGap: headcountQuery?.data ?? null,
          isLoading: (query?.isLoading ?? false) || (headcountQuery?.isLoading ?? false),
          isError: (query?.isError ?? false) || (headcountQuery?.isError ?? false),
          isEmployeeLoading: query?.isLoading ?? false,
          isHeadcountLoading: headcountQuery?.isLoading ?? false,
          isEmployeeError: query?.isError ?? false,
          isHeadcountError: headcountQuery?.isError ?? false,
          summary: deriveWorkforceSummary(employees, now, locale),
        }
      }),
    [locale, now, scopedStores, storeEmployeeQueries, storeHeadcountQueries],
  )
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const selectedStore = scopedRows.find((row) => row.storeId === selectedStoreId) ?? null
  const hasStoreRows = scopedRows.length > 0
  const hasRegionScopeOnly = !hasStoreRows && readRegionIds.length > 0
  const allEmployees = useMemo(
    () => scopedRows.flatMap((row) => row.employees),
    [scopedRows],
  )
  const regionSummary = useMemo(
    () => deriveWorkforceSummary(allEmployees, now, locale),
    [allEmployees, locale, now],
  )
  const isAnyStoreLoading = scopedRows.some((row) => row.isEmployeeLoading)

  return (
    <section
      aria-label={t('storeWorkforce.title')}
      aria-labelledby="store-workforce-title"
      data-testid="store-workforce-page"
      className="tw:mx-auto tw:w-full tw:max-w-[1440px] tw:px-0 tw:pb-8"
    >
      <div
        className="tw:rounded-[28px] tw:p-4 tw:md:p-6"
        style={{
          background:
            'radial-gradient(circle at 6% 4%, rgba(104,71,255,.16), transparent 28%), radial-gradient(circle at 86% 9%, rgba(32,191,211,.22), transparent 30%), linear-gradient(135deg, #f7f8ff 0%, #edf7fb 48%, #f8fbff 100%)',
        }}
      >
        <header className="tw:mb-5 tw:flex tw:flex-col tw:gap-4 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
          <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
            <div className="tw:grid tw:size-[45px] tw:place-items-center tw:rounded-[15px] tw:bg-[linear-gradient(135deg,#6847ff,#20bfd3)] tw:text-white tw:shadow-[0_18px_34px_rgba(104,71,255,0.24)]">
              <UsersRound className="tw:size-[18px]" />
            </div>
            <div className="tw:min-w-0">
              <h1
                id="store-workforce-title"
                className={cn('tw:m-0 tw:text-[clamp(26px,3vw,40px)] tw:font-bold tw:leading-none', textInk)}
              >
                {t('storeWorkforce.title')}
              </h1>
              <p className={cn('tw:mt-2 tw:max-w-3xl tw:text-sm tw:leading-6', textMuted)}>
                {t('storeWorkforce.regionManagerDescription')}
              </p>
            </div>
          </div>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <Pill tone="purple">{t('storeWorkforce.regionBadge')}</Pill>
            <Pill tone="cyan">{t('storeWorkforce.realDataBadge')}</Pill>
            <Pill tone="amber">{t('storeWorkforce.regionForbiddenActionValue')}</Pill>
          </div>
        </header>

        <MetricGrid ariaLabel={t('storeWorkforce.regionSummaryAria')}>
          <MetricCard
            icon={<Users className="tw:size-[18px]" />}
            iconTone="cyan"
            label={t('storeWorkforce.regionTotalScope')}
            value={isAnyStoreLoading ? t('storeWorkforce.sourceWaitingShort') : formatNumber(allEmployees.length, locale)}
            note={t('storeWorkforce.regionPersonnelContractNote')}
          />
          <MetricCard
            icon={<CalendarClock className="tw:size-[18px]" />}
            iconTone="purple"
            label={t('storeWorkforce.regionAverageTenure')}
            value={isAnyStoreLoading ? t('storeWorkforce.sourceWaitingShort') : regionSummary.averageTenureLabel}
            note={t('storeWorkforce.regionTenureContractNote')}
          />
          <MetricCard
            icon={<Store className="tw:size-[18px]" />}
            iconTone="green"
            label={t('storeWorkforce.regionStoreScope')}
            value={hasStoreRows ? formatNumber(scopedRows.length, locale) : t('storeWorkforce.valueNotConfigured')}
            note={
              hasStoreRows
                ? t('storeWorkforce.regionStoreScopeNote')
                : t('storeWorkforce.regionStoreScopeUnavailableNote')
            }
          />
          <MetricCard
            icon={<Inbox className="tw:size-[18px]" />}
            iconTone="amber"
            label={t('storeWorkforce.openMovements')}
            value={t('storeWorkforce.valueContractShort')}
            note={t('storeWorkforce.regionMovementContractNote')}
          />
        </MetricGrid>

        <div className="tw:grid tw:items-start tw:gap-4 tw:xl:grid-cols-[minmax(0,1fr)_minmax(280px,300px)]">
          <div className="tw:min-w-0">
            <FilterBar t={t} />

            <section
              className={cn('tw:overflow-hidden tw:rounded-[22px]', glassPanel, surfaceShadow)}
              data-testid="store-workforce-region-list"
            >
              <div className="tw:flex tw:items-start tw:justify-between tw:gap-4 tw:border-b tw:border-[#dfe6f3] tw:p-[18px]">
                <div className="tw:min-w-0">
                  <h2 className={cn('tw:text-[19px] tw:font-bold tw:leading-tight', textInk)}>
                    {t('storeWorkforce.regionStoreListTitle')}
                  </h2>
                  <p className={cn('tw:mt-1.5 tw:text-[13px] tw:leading-5', textMuted)}>
                    {t('storeWorkforce.regionStoreListDescription')}
                  </p>
                </div>
                <Pill tone={hasStoreRows ? 'cyan' : 'amber'}>
                  {hasStoreRows
                    ? t('storeWorkforce.regionStoreListBadge', { count: scopedRows.length })
                    : t('storeWorkforce.valueNotConfigured')}
                </Pill>
              </div>

              {hasStoreRows ? (
                <RegionStoreTable rows={scopedRows} locale={locale} onSelectStore={setSelectedStoreId} t={t} />
              ) : (
                <div className="tw:p-4">
                  <EmptyPrototypeState
                    title={
                      hasRegionScopeOnly
                        ? t('storeWorkforce.regionStoreListContractTitle')
                        : t('storeWorkforce.regionStoreListEmptyTitle')
                    }
                    description={
                      hasRegionScopeOnly
                        ? t('storeWorkforce.regionStoreListContractCopy')
                        : t('storeWorkforce.regionStoreListEmptyCopy')
                    }
                  />
                </div>
              )}
            </section>
          </div>

          <aside className="tw:grid tw:gap-4">
            <SidePanel
              title={t('storeWorkforce.regionPositionTotalsTitle')}
              description={t('storeWorkforce.regionPositionTotalsDescription')}
              badge={t('storeWorkforce.valueContractShort')}
              badgeTone="cyan"
            >
              <UnavailableList
                rows={
                  regionSummary.positionRows.length > 0
                    ? regionSummary.positionRows.slice(0, 5).map((row) => `${row.label}: ${formatNumber(row.count, locale)}`)
                    : [t('storeWorkforce.sourceWaitingShort')]
                }
              />
            </SidePanel>

            <SidePanel
              title={t('storeWorkforce.regionTenureSignalTitle')}
              description={t('storeWorkforce.regionTenureSignalDescription')}
              badge={t('storeWorkforce.valueContractShort')}
              badgeTone="purple"
            >
              <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:md:grid-cols-4 tw:xl:grid-cols-2">
                {[
                  ...regionSummary.tenureBuckets,
                ].map((bucket) => (
                  <div
                    key={bucket.key}
                    className="tw:min-h-[78px] tw:rounded-2xl tw:border tw:border-[#dfe6f3] tw:bg-white/65 tw:p-3"
                  >
                    <strong className={cn('tw:block tw:text-sm tw:font-bold', textInk)}>
                      {isAnyStoreLoading ? t('storeWorkforce.sourceWaitingShort') : formatNumber(bucket.count, locale)}
                    </strong>
                    <span className={cn('tw:mt-1 tw:block tw:text-xs tw:font-semibold', textMuted)}>
                      {bucket.label}
                    </span>
                  </div>
                ))}
              </div>
            </SidePanel>
          </aside>
        </div>
      </div>

      <RegionStoreDetailDialog
        row={selectedStore}
        onClose={() => setSelectedStoreId(null)}
        t={t}
      />
    </section>
  )
}

function MetricGrid(input: { ariaLabel: string; children: ReactNode }) {
  return (
    <section
      aria-label={input.ariaLabel}
      className="tw:mb-4 tw:grid tw:gap-3.5 tw:md:grid-cols-2 tw:xl:grid-cols-4"
    >
      {input.children}
    </section>
  )
}

function MetricCard(input: {
  icon: ReactNode
  iconTone: Tone
  label: string
  note: string
  value: string
}) {
  return (
    <article
      className={cn(
        'tw:grid tw:min-h-28 tw:grid-cols-[43px_minmax(0,1fr)] tw:items-center tw:gap-3 tw:rounded-[20px] tw:p-[17px]',
        glassPanel,
        surfaceShadow,
      )}
    >
      <div className={cn('tw:grid tw:size-[43px] tw:place-items-center tw:rounded-[14px]', toneClasses[input.iconTone].icon)}>
        {input.icon}
      </div>
      <div className="tw:min-w-0">
        <span className={cn('tw:text-xs tw:leading-5', textMuted)}>{input.label}</span>
        <strong className={cn('tw:my-1 tw:block tw:text-[22px] tw:font-bold tw:leading-tight', textInk)}>
          {input.value}
        </strong>
        <small className="tw:block tw:text-xs tw:font-semibold tw:leading-5 tw:text-[#596789]">
          {input.note}
        </small>
      </div>
    </article>
  )
}

function FilterBar(input: { t: ReturnType<typeof useLocalization>['t'] }) {
  return (
    <div
      className={cn(
        'tw:mb-3.5 tw:grid tw:gap-2.5 tw:rounded-[20px] tw:p-3 tw:md:grid-cols-[minmax(280px,1fr)_minmax(160px,.35fr)_minmax(160px,.35fr)]',
        glassPanel,
        surfaceShadow,
      )}
    >
      <label className="tw:relative tw:flex tw:items-center">
        <Search className="tw:pointer-events-none tw:absolute tw:left-3 tw:size-[18px] tw:text-[#667397]" />
        <input
          aria-label={input.t('storeWorkforce.regionSearchAria')}
          className={cn(
            'tw:h-[42px] tw:w-full tw:rounded-[13px] tw:border tw:border-[#dfe6f3] tw:bg-white/75 tw:pr-3.5 tw:pl-10 tw:text-sm tw:font-medium tw:outline-none',
            textInk,
          )}
          placeholder={input.t('storeWorkforce.regionSearchPlaceholder')}
          readOnly
        />
      </label>
      <FilterSelect
        ariaLabel={input.t('storeWorkforce.regionStatusFilterAria')}
        values={[input.t('storeWorkforce.regionAllStatuses'), input.t('storeWorkforce.sourceWaiting')]}
      />
      <FilterSelect
        ariaLabel={input.t('storeWorkforce.regionSortAria')}
        values={[
          input.t('storeWorkforce.regionSortPersonnelScope'),
          input.t('storeWorkforce.regionSortAverageTenure'),
          input.t('storeWorkforce.regionSortPendingRequests'),
        ]}
      />
    </div>
  )
}

function FilterSelect(input: { ariaLabel: string; values: string[] }) {
  return (
    <select
      aria-label={input.ariaLabel}
      className={cn(
        'tw:h-[42px] tw:w-full tw:rounded-[13px] tw:border tw:border-[#dfe6f3] tw:bg-white/75 tw:px-3.5 tw:text-sm tw:font-medium tw:outline-none',
        textInk,
      )}
      defaultValue={input.values[0]}
    >
      {input.values.map((value) => (
        <option key={value}>{value}</option>
      ))}
    </select>
  )
}

function RegionStoreTable(input: {
  locale: ReturnType<typeof useLocalization>['locale']
  rows: RegionStoreRow[]
  onSelectStore: (storeId: string) => void
  t: ReturnType<typeof useLocalization>['t']
}) {
  return (
    <>
      <div className="tw:hidden tw:md:block">
        <table className="tw:w-full tw:table-fixed tw:border-collapse">
          <colgroup>
            <col style={{ width: '25%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
          <thead>
            <tr>
              {[
                input.t('storeWorkforce.storeColumn'),
                input.t('storeWorkforce.personnelColumn'),
                input.t('storeWorkforce.averageTenure'),
                input.t('storeWorkforce.normActual'),
                input.t('storeWorkforce.positionBalanceColumn'),
                input.t('storeWorkforce.statusColumn'),
                input.t('storeWorkforce.actionColumn'),
              ].map((heading) => (
                <th
                  key={heading}
                  className="tw:border-b tw:border-[#dfe6f3] tw:bg-[#f4f7fc]/85 tw:px-3 tw:py-3 tw:text-left tw:text-[11px] tw:font-bold tw:tracking-[0.02em] tw:text-[#687395] tw:uppercase"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-testid="store-workforce-region-rows">
            {input.rows.map((row) => (
              <RegionStoreDesktopRow
                key={row.storeId}
                locale={input.locale}
                row={row}
                onSelectStore={input.onSelectStore}
                t={input.t}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="tw:grid tw:gap-2.5 tw:p-3 tw:md:hidden" data-testid="store-workforce-region-rows">
        {input.rows.map((row) => (
          <RegionStoreMobileCard
            key={row.storeId}
            row={row}
            onSelectStore={input.onSelectStore}
            t={input.t}
          />
        ))}
      </div>
    </>
  )
}

function RegionStoreDesktopRow(input: {
  locale: ReturnType<typeof useLocalization>['locale']
  row: RegionStoreRow
  onSelectStore: (storeId: string) => void
  t: ReturnType<typeof useLocalization>['t']
}) {
  const personnelValue = input.row.isEmployeeLoading
    ? input.t('storeWorkforce.sourceWaitingShort')
    : input.row.isEmployeeError
      ? input.t('storeWorkforce.valueNotConfigured')
      : input.row.employees.length.toString()
  const normActualValue = input.row.isHeadcountLoading
    ? input.t('storeWorkforce.sourceWaitingShort')
    : input.row.isHeadcountError
      ? input.t('storeWorkforce.valueNotConfigured')
      : formatNormActualLabel({
          actualFallback: input.row.employees.length,
          headcountGap: input.row.headcountGap,
          locale: input.locale,
          notConfiguredLabel: input.t('storeWorkforce.valueNotConfigured'),
        })
  const statusTone = input.row.isError ? 'rose' : input.row.isLoading ? 'amber' : 'cyan'
  const statusLabel = input.row.isError
    ? input.t('storeWorkforce.valueNotConfigured')
    : input.row.isLoading
      ? input.t('storeWorkforce.sourceWaitingShort')
      : input.t('storeWorkforce.realDataBadge')

  return (
    <tr data-testid="store-workforce-region-row">
      <td className="tw:border-b tw:border-[#dae2f0]/90 tw:px-3 tw:py-[11px]">
        <StoreIdentity row={input.row} />
      </td>
      <td className="tw:border-b tw:border-[#dae2f0]/90 tw:px-3 tw:py-[11px]">
        <span className={cn('tw:text-sm tw:font-semibold tw:whitespace-nowrap', textInk)}>
          {personnelValue}
        </span>
      </td>
      <td className="tw:border-b tw:border-[#dae2f0]/90 tw:px-3 tw:py-[11px]">
        <span className={cn('tw:text-sm tw:font-medium tw:whitespace-nowrap', textMuted)}>
          {input.row.isEmployeeLoading
            ? input.t('storeWorkforce.sourceWaitingShort')
            : input.row.isEmployeeError
              ? input.t('storeWorkforce.valueNotConfigured')
              : input.row.summary.averageTenureLabel}
        </span>
      </td>
      <td className="tw:border-b tw:border-[#dae2f0]/90 tw:px-3 tw:py-[11px]">
        <span className={cn('tw:block tw:max-w-[130px] tw:truncate tw:text-sm tw:font-semibold tw:whitespace-nowrap', textInk)} title={normActualValue}>
          {normActualValue}
        </span>
      </td>
      <td className="tw:border-b tw:border-[#dae2f0]/90 tw:px-3 tw:py-[11px]">
        <MiniBars inactive={input.row.isEmployeeLoading || input.row.employees.length === 0} />
      </td>
      <td className="tw:border-b tw:border-[#dae2f0]/90 tw:px-3 tw:py-[11px]">
        <Status tone={statusTone}>{statusLabel}</Status>
      </td>
      <td className="tw:border-b tw:border-[#dae2f0]/90 tw:px-3 tw:py-[11px] tw:text-right">
        <DetailButton onClick={() => input.onSelectStore(input.row.storeId)}>
          {input.t('storeWorkforce.detailAction')}
        </DetailButton>
      </td>
    </tr>
  )
}

function RegionStoreMobileCard(input: {
  row: RegionStoreRow
  onSelectStore: (storeId: string) => void
  t: ReturnType<typeof useLocalization>['t']
}) {
  const personnelValue = input.row.isEmployeeLoading
    ? input.t('storeWorkforce.sourceWaitingShort')
    : input.row.isEmployeeError
      ? input.t('storeWorkforce.valueNotConfigured')
    : input.row.employees.length.toString()
  const statusTone = input.row.isError ? 'rose' : input.row.isLoading ? 'amber' : 'cyan'
  const statusLabel = input.row.isError
    ? input.t('storeWorkforce.valueNotConfigured')
    : input.row.isLoading
      ? input.t('storeWorkforce.sourceWaitingShort')
      : input.t('storeWorkforce.realDataBadge')

  return (
    <article
      className="tw:grid tw:gap-3 tw:rounded-2xl tw:border tw:border-[#dfe6f3] tw:bg-white/75 tw:p-3"
      data-testid="store-workforce-region-row"
    >
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
        <StoreIdentity row={input.row} />
        <Status tone={statusTone}>{statusLabel}</Status>
      </div>
      <div className="tw:grid tw:grid-cols-2 tw:gap-2">
        <MiniValue label={input.t('storeWorkforce.personnelColumn')} value={personnelValue} />
        <MiniValue
          label={input.t('storeWorkforce.averageTenure')}
          value={
            input.row.isEmployeeLoading
              ? input.t('storeWorkforce.sourceWaitingShort')
              : input.row.isEmployeeError
              ? input.t('storeWorkforce.valueNotConfigured')
              : input.row.summary.averageTenureLabel
          }
        />
        <MiniValue
          label={input.t('storeWorkforce.normActual')}
          value={
            input.row.isHeadcountLoading
              ? input.t('storeWorkforce.sourceWaitingShort')
              : input.row.isHeadcountError
                ? input.t('storeWorkforce.valueNotConfigured')
              : formatNormActualLabel({
                  actualFallback: input.row.employees.length,
                  headcountGap: input.row.headcountGap,
                  notConfiguredLabel: input.t('storeWorkforce.valueNotConfigured'),
                })
          }
        />
      </div>
      <DetailButton primary onClick={() => input.onSelectStore(input.row.storeId)}>
        {input.t('storeWorkforce.detailAction')}
      </DetailButton>
    </article>
  )
}

function StoreIdentity(input: { row: RegionStoreRow }) {
  return (
    <div className="tw:flex tw:w-full tw:min-w-0 tw:max-w-full tw:items-center tw:gap-2.5">
      <div className="tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-[13px] tw:bg-[#efe9ff] tw:text-[#5534e6]">
        <Store className="tw:size-[18px]" />
      </div>
      <div className="tw:min-w-0">
        <strong
          className={cn(
            'tw:block tw:max-w-[180px] tw:truncate tw:text-sm tw:font-semibold tw:leading-tight tw:md:max-w-[170px] tw:xl:max-w-[155px]',
            textInk,
          )}
          title={input.row.storeLabel}
        >
          {input.row.storeLabel}
        </strong>
      </div>
    </div>
  )
}

function DetailButton(input: {
  children: ReactNode
  onClick: () => void
  primary?: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'tw:h-8 tw:rounded-[12px] tw:border-[#6847ff]/20 tw:px-2.5 tw:text-xs tw:font-bold tw:whitespace-nowrap tw:text-[#5534e6] tw:shadow-none',
        input.primary
          ? 'tw:w-full tw:border-transparent tw:bg-[linear-gradient(135deg,#6847ff,#355cff)] tw:text-white tw:shadow-[0_12px_24px_rgba(104,71,255,0.22)]'
          : 'tw:bg-white',
      )}
      onClick={input.onClick}
    >
      {input.children}
      <ChevronRight className="tw:size-3.5" />
    </Button>
  )
}

function SidePanel(input: {
  badge: string
  badgeTone: Tone
  children: ReactNode
  description: string
  title: string
}) {
  return (
    <section className={cn('tw:overflow-hidden tw:rounded-[22px]', glassPanel, surfaceShadow)}>
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-4 tw:border-b tw:border-[#dfe6f3] tw:p-[18px]">
        <div className="tw:min-w-0">
          <h3 className={cn('tw:text-base tw:font-bold tw:leading-tight', textInk)}>
            {input.title}
          </h3>
          <p className={cn('tw:mt-1.5 tw:text-[13px] tw:leading-5', textMuted)}>
            {input.description}
          </p>
        </div>
        <Pill tone={input.badgeTone}>{input.badge}</Pill>
      </div>
      <div className="tw:p-4">{input.children}</div>
    </section>
  )
}

function UnavailableList(input: { rows: string[] }) {
  return (
    <div className="tw:grid tw:gap-3">
      {input.rows.map((row) => (
        <div
          key={row}
          className="tw:flex tw:items-start tw:gap-2 tw:rounded-2xl tw:bg-[#fff1d9] tw:px-3 tw:py-2.5 tw:text-[#a35a00]"
        >
          <span className="tw:mt-1.5 tw:size-[7px] tw:shrink-0 tw:rounded-full tw:bg-current" />
          <span className="tw:min-w-0 tw:text-xs tw:font-semibold tw:leading-5">
            {row}
          </span>
        </div>
      ))}
    </div>
  )
}

function EmptyPrototypeState(input: { description: string; title: string }) {
  return (
    <div className="tw:rounded-2xl tw:border tw:border-[#dfe6f3] tw:bg-white/75 tw:p-4">
      <strong className={cn('tw:block tw:text-sm tw:font-bold', textInk)}>{input.title}</strong>
      <p className={cn('tw:mt-1.5 tw:text-sm tw:leading-6', textMuted)}>{input.description}</p>
    </div>
  )
}

function RegionStoreDetailDialog(input: {
  row: RegionStoreRow | null
  onClose: () => void
  t: ReturnType<typeof useLocalization>['t']
}) {
  const open = Boolean(input.row)
  const [activeTab, setActiveTab] = useState<DetailTab>('people')

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) input.onClose()
      }}
    >
      <DialogContent
        closeLabel={input.t('storeWorkforce.closeDetail')}
        showCloseButton={false}
        data-testid="store-workforce-region-detail-dialog"
        className={cn(
          'tw:top-auto tw:bottom-0 tw:left-0 tw:max-h-[92dvh] tw:max-w-full tw:translate-x-0 tw:translate-y-0 tw:gap-0 tw:overflow-y-auto tw:rounded-b-none tw:rounded-t-[24px] tw:border-[#b4c1db]/70 tw:bg-[radial-gradient(circle_at_100%_0%,rgba(32,191,211,.13),transparent_36%),rgba(255,255,255,.94)] tw:p-0 tw:shadow-[0_24px_70px_rgba(58,75,118,0.16)] tw:sm:top-1/2 tw:sm:bottom-auto tw:sm:left-1/2 tw:sm:max-h-[min(86vh,820px)] tw:sm:max-w-[1000px] tw:sm:-translate-x-1/2 tw:sm:-translate-y-1/2 tw:sm:rounded-[26px]',
        )}
      >
        <div className="tw:flex tw:items-start tw:justify-between tw:gap-4 tw:border-b tw:border-[#dfe6f3] tw:p-5">
          <div className="tw:min-w-0">
            <DialogTitle className={cn('tw:text-[22px] tw:font-bold tw:leading-tight', textInk)}>
              {input.row
                ? input.t('storeWorkforce.regionDetailTitleWithStore', {
                    store: input.row.storeLabel,
                  })
                : input.t('storeWorkforce.regionDetailTitle')}
            </DialogTitle>
            <DialogDescription className={cn('tw:mt-1 tw:text-sm', textMuted)}>
              {input.t('storeWorkforce.regionDetailModalCopy')}
            </DialogDescription>
          </div>
          <div className="tw:flex tw:shrink-0 tw:flex-wrap tw:items-center tw:justify-end tw:gap-2">
            <Pill tone={input.row?.isError ? 'rose' : input.row?.isLoading ? 'amber' : 'cyan'}>
              {input.row?.isError
                ? input.t('storeWorkforce.valueNotConfigured')
                : input.row?.isLoading
                  ? input.t('storeWorkforce.sourceWaitingShort')
                  : input.t('storeWorkforce.realDataBadge')}
            </Pill>
            <button
              type="button"
              aria-label={input.t('storeWorkforce.closeDetail')}
              className={cn('tw:grid tw:size-[38px] tw:place-items-center tw:rounded-[13px] tw:border tw:border-[#dfe6f3] tw:bg-white', textInk)}
              onClick={input.onClose}
            >
              <X className="tw:size-[18px]" />
            </button>
          </div>
        </div>

        <div className="tw:grid tw:gap-4 tw:p-4 tw:sm:p-[18px]">
          <div className="tw:grid tw:grid-cols-2 tw:gap-2.5 tw:sm:grid-cols-4">
            <MiniMetric label={input.t('storeWorkforce.storeColumn')} value={input.row?.storeLabel ?? input.t('storeWorkforce.valueNotConfigured')} />
            <MiniMetric
              label={input.t('storeWorkforce.personnelColumn')}
              value={
                input.row && !input.row.isEmployeeError
                  ? input.row.employees.length.toString()
                  : input.t('storeWorkforce.valueNotConfigured')
              }
            />
            <MiniMetric
              label={input.t('storeWorkforce.averageTenure')}
              value={
                input.row
                  ? input.row.isEmployeeLoading
                    ? input.t('storeWorkforce.sourceWaitingShort')
                    : input.row.isEmployeeError
                      ? input.t('storeWorkforce.valueNotConfigured')
                      : input.row.summary.averageTenureLabel
                  : input.t('storeWorkforce.valueNotConfigured')
              }
            />
            <MiniMetric
              label={input.t('storeWorkforce.normActual')}
              value={
                input.row
                  ? input.row.isHeadcountLoading
                    ? input.t('storeWorkforce.sourceWaitingShort')
                    : input.row.isHeadcountError
                    ? input.t('storeWorkforce.valueNotConfigured')
                    : formatNormActualLabel({
                      actualFallback: input.row.employees.length,
                      headcountGap: input.row.headcountGap,
                      notConfiguredLabel: input.t('storeWorkforce.valueNotConfigured'),
                    })
                  : input.t('storeWorkforce.valueNotConfigured')
              }
            />
            <MiniMetric label={input.t('storeWorkforce.openMovements')} value={input.t('storeWorkforce.valueContractShort')} />
          </div>

          <div className="tw:inline-flex tw:w-full tw:gap-1.5 tw:rounded-[15px] tw:border tw:border-[#6847ff]/15 tw:bg-white/70 tw:p-1.5 tw:sm:w-fit">
            <ModalTab active={activeTab === 'people'} onClick={() => setActiveTab('people')}>
              {input.t('storeWorkforce.regionDetailPeopleTab')}
            </ModalTab>
            <ModalTab active={activeTab === 'positions'} onClick={() => setActiveTab('positions')}>
              {input.t('storeWorkforce.regionDetailPositionsTab')}
            </ModalTab>
            <ModalTab active={activeTab === 'requests'} onClick={() => setActiveTab('requests')}>
              {input.t('storeWorkforce.regionDetailRequestsTab')}
            </ModalTab>
          </div>

          {activeTab === 'people' ? (
            <ModalPersonnelPane row={input.row} t={input.t} />
          ) : null}
          {activeTab === 'positions' ? (
            <ModalPositionPane row={input.row} t={input.t} />
          ) : null}
          {activeTab === 'requests' ? (
            <ModalRequestsPlaceholder t={input.t} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ModalTab(input: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        'tw:h-8 tw:flex-1 tw:rounded-[11px] tw:px-2 tw:text-xs tw:font-bold tw:sm:flex-none tw:sm:px-3',
        input.active
          ? 'tw:bg-[#efe9ff] tw:text-[#5534e6]'
          : 'tw:bg-transparent tw:text-[#52607f]',
      )}
      onClick={input.onClick}
    >
      {input.children}
    </button>
  )
}

function Pill(input: { children: ReactNode; tone: Tone }) {
  return (
    <span
      className={cn(
        'tw:inline-flex tw:min-h-[30px] tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-full tw:px-3 tw:text-xs tw:font-bold tw:whitespace-nowrap',
        toneClasses[input.tone].pill,
      )}
    >
      {input.children}
    </span>
  )
}

function Status(input: { children: ReactNode; tone: Tone }) {
  return (
    <span
      className={cn(
        'tw:inline-flex tw:min-h-[25px] tw:max-w-[96px] tw:items-center tw:gap-1.5 tw:rounded-full tw:px-2 tw:text-[11px] tw:font-bold tw:whitespace-nowrap',
        toneClasses[input.tone].status,
      )}
    >
      <span className="tw:size-1.5 tw:shrink-0 tw:rounded-full tw:bg-current" />
      <span className="tw:min-w-0 tw:truncate">{input.children}</span>
    </span>
  )
}

function getUniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean))).sort((left, right) => left.localeCompare(right))
}
