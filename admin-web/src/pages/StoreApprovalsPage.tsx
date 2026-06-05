import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  canListTargetDistributionRequests,
  getAssignedStoreIds,
  getReadStoreIds,
} from '../features/auth/authorization'
import { useLocalization } from '../features/localization/useLocalization'
import { getAllTargetDistributionRequests } from '../features/targets/api'
import {
  getOffboardingRequests,
  getSellerCodeRequests,
} from '../features/workforce/api'
import { getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  buildRequestRows,
  createPeriodOptions,
  formatCopy,
  matchesStatusFilter,
  PAGE_SIZE,
  requestCenterCopy,
  type RequestCenterCopy,
  type RequestCenterRow,
  type RequestCenterStatus,
  type RequestCenterTab,
  type RequestCenterType,
} from './store-approvals-request-center-model'
import {
  RequestCenterHeader,
  RequestCenterMetrics,
  RequestCenterMobileCard,
  RequestCenterSelect,
  RequestCenterTableRow,
} from './store-approvals-request-center-sections'
import { resolveStoreApprovalsPersona, type StoreApprovalsPersona } from './store-approvals-model'
import {
  StoreEmptyState,
  StoreErrorState,
  StoreLoadingState,
  StoreSurfacePage,
} from './store-surface-primitives'

export function StoreApprovalsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale } = useLocalization()
  const copy = requestCenterCopy[locale]
  const persona = resolveStoreApprovalsPersona(input.authSummary)
  const assignedStoreIds = getAssignedStoreIds(input.authSummary)
  const readStoreIds = getReadStoreIds(input.authSummary)
  const scopeStoreIds = useMemo(
    () => Array.from(new Set([...assignedStoreIds, ...readStoreIds])),
    [assignedStoreIds, readStoreIds],
  )
  const canReadTargets = canListTargetDistributionRequests(input.authSummary)
  const shouldReadWorkforce = persona === 'storeManager' && assignedStoreIds.length > 0
  const scopeKey = [
    persona,
    input.authSummary?.user.roleCodes.join('|') ?? '',
    assignedStoreIds.join('|'),
    readStoreIds.join('|'),
  ].join(':')

  const targetRequestsQuery = useQuery({
    queryKey: ['target-distribution-requests', 'store-approvals-request-center', scopeKey],
    queryFn: () => getAllTargetDistributionRequests(),
    enabled: canReadTargets && persona !== 'readOnly',
  })
  const sellerCodeRequestsQuery = useQuery({
    queryKey: ['seller-code-requests', 'store-approvals-request-center', scopeKey],
    queryFn: () => getSellerCodeRequests(),
    enabled: shouldReadWorkforce,
  })
  const offboardingRequestsQuery = useQuery({
    queryKey: ['offboarding-requests', 'store-approvals-request-center', scopeKey],
    queryFn: () => getOffboardingRequests(),
    enabled: shouldReadWorkforce,
  })

  const isInitialLoading =
    (targetRequestsQuery.isLoading && !targetRequestsQuery.data) ||
    (shouldReadWorkforce &&
      ((sellerCodeRequestsQuery.isLoading && !sellerCodeRequestsQuery.data) ||
        (offboardingRequestsQuery.isLoading && !offboardingRequestsQuery.data)))

  if (isInitialLoading) {
    return <StoreLoadingState title={copy.loadingTitle} description={copy.loadingCopy} />
  }

  if (targetRequestsQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={copy.aria}>
        <StoreErrorState
          title={copy.errorTitle}
          description={getErrorMessage(targetRequestsQuery.error)}
        />
      </StoreSurfacePage>
    )
  }

  if (persona === 'readOnly') {
    return (
      <StoreSurfacePage
        ariaLabel={copy.aria}
        className="tw:mx-auto tw:w-full tw:max-w-[1400px]"
        testId="store-approvals-ledger"
      >
        <RequestCenterHeader copy={copy} />
        <StoreEmptyState
          title={copy.emptyTitle}
          titleAsHeading
          description={copy.emptyCopy}
        />
      </StoreSurfacePage>
    )
  }

  const rows = buildRequestRows({
    copy,
    locale,
    offboardingRequests: offboardingRequestsQuery.data?.items ?? [],
    persona,
    scopeStoreIds,
    sellerCodeRequests: sellerCodeRequestsQuery.data?.items ?? [],
    targetRequests: targetRequestsQuery.data?.items ?? [],
  })

  return (
    <RequestCenterSurface
      copy={copy}
      locale={locale}
      offboardingError={offboardingRequestsQuery.error}
      offboardingErrorVisible={shouldReadWorkforce && offboardingRequestsQuery.isError}
      persona={persona}
      rows={rows}
      sellerCodeError={sellerCodeRequestsQuery.error}
      sellerCodeErrorVisible={shouldReadWorkforce && sellerCodeRequestsQuery.isError}
    />
  )
}

function RequestCenterSurface(input: {
  copy: RequestCenterCopy
  locale: AppLocale
  offboardingError: unknown
  offboardingErrorVisible: boolean
  persona: StoreApprovalsPersona
  rows: RequestCenterRow[]
  sellerCodeError: unknown
  sellerCodeErrorVisible: boolean
}) {
  const [activeTab, setActiveTab] = useState<RequestCenterTab>('open')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<RequestCenterType>('all')
  const [statusFilter, setStatusFilter] = useState<RequestCenterStatus>('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const periodOptions = useMemo(() => createPeriodOptions(input.rows, input.locale), [input.rows, input.locale])
  const filteredRows = useMemo(
    () =>
      input.rows.filter((row) => {
        if (row.bucket !== activeTab) return false
        if (typeFilter !== 'all' && row.type !== typeFilter) return false
        if (statusFilter !== 'all' && !matchesStatusFilter(row.status, statusFilter)) return false
        if (periodFilter !== 'all' && row.updatedAt.slice(0, 7) !== periodFilter) return false

        const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
        if (!normalizedQuery) return true

        return [
          row.title,
          row.subtitle,
          row.scopeTitle,
          row.scopeSubtitle,
          row.statusLabel,
          row.sourceLabel,
        ].some((value) => value.toLocaleLowerCase('tr-TR').includes(normalizedQuery))
      }),
    [activeTab, input.rows, periodFilter, query, statusFilter, typeFilter],
  )
  const openCount = input.rows.filter((row) => row.bucket === 'open').length
  const doneCount = input.rows.filter((row) => row.bucket === 'done').length
  const returnedCount = input.rows.filter((row) => matchesStatusFilter(row.status, 'returned')).length
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const from = filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const to = Math.min(safePage * PAGE_SIZE, filteredRows.length)
  const resetFilters = () => {
    setQuery('')
    setTypeFilter('all')
    setStatusFilter('all')
    setPeriodFilter('all')
    setPage(1)
  }

  return (
    <StoreSurfacePage
      ariaLabel={input.copy.aria}
      ariaLabelledBy="store-approvals-request-center-title"
      className="tw:mx-auto tw:w-full tw:max-w-[1400px] tw:gap-4"
      testId="store-approvals-ledger"
    >
      <RequestCenterHeader copy={input.copy} />
      <RequestCenterMetrics
        copy={input.copy}
        doneCount={doneCount}
        openCount={openCount}
        returnedCount={returnedCount}
      />

      {input.sellerCodeErrorVisible || input.offboardingErrorVisible ? (
        <div className="tw:grid tw:gap-2">
          {input.sellerCodeErrorVisible ? (
            <StoreErrorState
              title={input.copy.errorTitle}
              description={getErrorMessage(input.sellerCodeError)}
            />
          ) : null}
          {input.offboardingErrorVisible ? (
            <StoreErrorState
              title={input.copy.errorTitle}
              description={getErrorMessage(input.offboardingError)}
            />
          ) : null}
        </div>
      ) : null}

      <section
        aria-label="Talep merkezi filtreleri"
        className="tw:grid tw:gap-2 tw:rounded-2xl tw:border tw:border-border/80 tw:bg-card/85 tw:p-3 tw:shadow-[0_20px_60px_rgba(61,79,122,0.12)] tw:lg:grid-cols-[minmax(280px,1.35fr)_minmax(150px,0.52fr)_minmax(150px,0.52fr)_minmax(150px,0.52fr)_auto]"
      >
        <label className="tw:flex tw:min-h-11 tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-border tw:bg-white/75 tw:px-3">
          <Search className="tw:size-4 tw:text-muted-foreground" />
          <span className="tw:sr-only">{input.copy.searchPlaceholder}</span>
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder={input.copy.searchPlaceholder}
            className="tw:h-auto tw:border-0 tw:bg-transparent tw:p-0 tw:text-sm tw:font-medium tw:shadow-none tw:focus-visible:ring-0"
          />
        </label>
        <RequestCenterSelect
          ariaLabel={input.copy.allTypes}
          value={typeFilter}
          onChange={(value) => {
            setTypeFilter(value as RequestCenterType)
            setPage(1)
          }}
          items={[
            { value: 'all', label: input.copy.allTypes },
            { value: 'target', label: input.copy.targetType },
            { value: 'sellerCode', label: input.copy.sellerCodeType },
            { value: 'offboarding', label: input.copy.offboardingType },
          ]}
        />
        <RequestCenterSelect
          ariaLabel={input.copy.allStatuses}
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value as RequestCenterStatus)
            setPage(1)
          }}
          items={[
            { value: 'all', label: input.copy.allStatuses },
            { value: 'pending', label: input.copy.pendingHrStatus },
            { value: 'returned', label: input.copy.rejectedStatus },
            { value: 'approved', label: input.copy.approvedStatus },
          ]}
        />
        <RequestCenterSelect
          ariaLabel={input.copy.periodAll}
          value={periodFilter}
          onChange={(value) => {
            setPeriodFilter(value)
            setPage(1)
          }}
          items={[{ value: 'all', label: input.copy.periodAll }, ...periodOptions]}
        />
        <Button
          type="button"
          variant="outline"
          onClick={resetFilters}
          className="tw:min-h-11 tw:justify-center tw:gap-2 tw:rounded-xl tw:bg-white/75"
        >
          <RefreshCcw className="tw:size-4" />
          {input.copy.resetFilters}
        </Button>
      </section>

      <Card className="tw:overflow-hidden tw:rounded-2xl tw:border-border/80 tw:bg-card/85 tw:shadow-[0_24px_70px_rgba(61,79,122,0.14)]">
        <CardHeader className="tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-border/80 tw:p-4 tw:md:flex-row tw:md:items-start tw:md:justify-between">
          <div className="tw:min-w-0">
            <CardTitle>
              <h2 className="tw:text-lg tw:font-semibold tw:text-foreground">
                {input.persona === 'regionManager'
                  ? input.copy.regionTableTitle
                  : input.copy.storeTableTitle}
              </h2>
            </CardTitle>
            <p className="tw:mt-2 tw:max-w-2xl tw:text-sm tw:leading-6 tw:text-muted-foreground">
              {input.copy.tableDescription}
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={activeTab}
            onValueChange={(value) => {
              if (!value) return
              setActiveTab(value as RequestCenterTab)
              setPage(1)
            }}
            className="tw:flex tw:justify-start tw:rounded-xl tw:border tw:border-border tw:bg-white/80 tw:p-1"
          >
            <ToggleGroupItem value="open" className="tw:h-8 tw:rounded-lg tw:px-3 tw:text-sm">
              {input.copy.openTab}
            </ToggleGroupItem>
            <ToggleGroupItem value="done" className="tw:h-8 tw:rounded-lg tw:px-3 tw:text-sm">
              {input.copy.doneTab}
            </ToggleGroupItem>
          </ToggleGroup>
          <span className="tw:rounded-full tw:bg-primary/10 tw:px-3 tw:py-1 tw:text-xs tw:font-semibold tw:text-primary">
            {formatCopy(activeTab === 'open' ? input.copy.countOpen : input.copy.countDone, {
              count: String(filteredRows.length),
            })}
          </span>
        </CardHeader>
        <CardContent className="tw:p-0">
          {filteredRows.length === 0 ? (
            <div className="tw:p-4">
              <StoreEmptyState
                title={input.copy.emptyTitle}
                description={input.copy.emptyCopy}
              />
            </div>
          ) : (
            <>
              <div className="tw:hidden tw:overflow-x-auto tw:md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="tw:bg-muted/55">
                      <TableHead className="tw:px-4 tw:text-[11px] tw:uppercase tw:tracking-[0.02em]">
                        {input.copy.requestColumn}
                      </TableHead>
                      <TableHead className="tw:px-4 tw:text-[11px] tw:uppercase tw:tracking-[0.02em]">
                        {input.persona === 'regionManager'
                          ? input.copy.scopeColumnRegion
                          : input.copy.scopeColumnStore}
                      </TableHead>
                      <TableHead className="tw:px-4 tw:text-[11px] tw:uppercase tw:tracking-[0.02em]">
                        {input.copy.statusColumn}
                      </TableHead>
                      <TableHead className="tw:px-4 tw:text-[11px] tw:uppercase tw:tracking-[0.02em]">
                        {input.copy.sourceColumn}
                      </TableHead>
                      <TableHead className="tw:px-4 tw:text-[11px] tw:uppercase tw:tracking-[0.02em]">
                        {input.copy.updatedColumn}
                      </TableHead>
                      <TableHead className="tw:px-4 tw:text-[11px] tw:uppercase tw:tracking-[0.02em]">
                        {input.copy.actionColumn}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((row) => (
                      <RequestCenterTableRow key={row.id} row={row} />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="tw:grid tw:gap-2 tw:p-3 tw:md:hidden">
                {pageRows.map((row) => (
                  <RequestCenterMobileCard key={row.id} row={row} />
                ))}
              </div>
            </>
          )}

          <div className="tw:flex tw:flex-col tw:gap-3 tw:border-t tw:border-border/80 tw:bg-muted/35 tw:p-3 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
            <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">
              {formatCopy(input.copy.pager, {
                from: String(from),
                to: String(to),
                total: String(filteredRows.length),
              })}
            </span>
            <div className="tw:flex tw:flex-wrap tw:gap-2">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <Button
                  key={pageNumber}
                  type="button"
                  size="icon"
                  variant={pageNumber === safePage ? 'secondary' : 'outline'}
                  className="tw:size-8 tw:rounded-lg"
                  onClick={() => setPage(pageNumber)}
                  aria-label={`Sayfa ${pageNumber}`}
                >
                  {pageNumber}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </StoreSurfacePage>
  )
}
