import { useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Store,
  UserRound,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'
import { StatusBadge } from '../../components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { getBusinessMonthInputValue } from '../../lib/business-date'
import { getUserFacingErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { StoreErrorState, StoreSurfacePage } from '../../pages/store-surface-primitives'
import type { AuthSessionSummary } from '../auth/api'
import { storeChecklistAcknowledgementsQueryKey } from '../auth/store-query-scope'
import { getChecklistAcknowledgements, type ChecklistAcknowledgementItem } from '../checklists/api'
import { useLocalization } from '../localization/useLocalization'
import { ChecklistCommandPeriodPicker } from './ChecklistCommandPeriodPicker'
import { ChecklistOperationalHistoryDrawer } from './ChecklistOperationalHistoryDrawer'

const PAGE_SIZE = 30

type QueueFilter = 'all' | 'pending_acknowledgement' | 'acknowledged'

export function StoreManagerChecklistWorkspace(input: {
  authSummary: AuthSessionSummary | null
  onOpenWorkflow: (storeId: string, tab: 'visits' | 'inbox' | 'history', trigger: HTMLElement) => void
  onOpenResult?: (checklistInstanceId: string, storeId: string, tab: 'inbox' | 'history', trigger: HTMLElement) => void
}) {
  const { locale } = useLocalization()
  const [period, setPeriod] = useState(() => getBusinessMonthInputValue())
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [offset, setOffset] = useState(0)
  const [selectedStore, setSelectedStore] = useState<{ id: string; name: string } | null>(null)
  const historyTriggerRef = useRef<HTMLElement | null>(null)
  const status = filter === 'all' ? undefined : filter

  const query = useQuery({
    queryKey: [
      ...storeChecklistAcknowledgementsQueryKey(input.authSummary),
      'manager-workspace',
      period,
      filter,
      offset,
    ],
    queryFn: () => getChecklistAcknowledgements({
      period,
      ...(status ? { status } : {}),
      limit: PAGE_SIZE,
      offset,
    }),
    ...transientQueryRetryOptions,
  })
  const pendingSummaryQuery = useQuery({
    queryKey: [
      ...storeChecklistAcknowledgementsQueryKey(input.authSummary),
      'manager-summary',
      period,
      'pending_acknowledgement',
    ],
    queryFn: () => getChecklistAcknowledgements({
      period,
      status: 'pending_acknowledgement',
      limit: 1,
      offset: 0,
    }),
    ...transientQueryRetryOptions,
  })
  const acknowledgedSummaryQuery = useQuery({
    queryKey: [
      ...storeChecklistAcknowledgementsQueryKey(input.authSummary),
      'manager-summary',
      period,
      'acknowledged',
    ],
    queryFn: () => getChecklistAcknowledgements({
      period,
      status: 'acknowledged',
      limit: 1,
      offset: 0,
    }),
    ...transientQueryRetryOptions,
  })

  const response = query.data
  const pagePendingCount = response?.items.filter((item) => item.acknowledgement === null).length ?? 0
  const pageAcknowledgedCount = response?.items.filter((item) => item.acknowledgement !== null).length ?? 0
  const pendingCount = pendingSummaryQuery.data?.meta.total
    ?? (filter === 'all' ? pagePendingCount : filter === 'pending_acknowledgement' ? response?.meta.total ?? 0 : 0)
  const acknowledgedCount = acknowledgedSummaryQuery.data?.meta.total
    ?? (filter === 'all' ? pageAcknowledgedCount : filter === 'acknowledged' ? response?.meta.total ?? 0 : 0)
  const totalCount = pendingCount + acknowledgedCount
  const firstItem = response?.meta.total ? response.meta.offset + 1 : 0
  const lastItem = response ? Math.min(response.meta.total, response.meta.offset + response.items.length) : 0
  const pageCount = Math.max(1, Math.ceil((response?.meta.total ?? 0) / PAGE_SIZE))
  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1

  const changeFilter = (value: string) => {
    setFilter(value as QueueFilter)
    setOffset(0)
  }

  const openResult = (item: ChecklistAcknowledgementItem, trigger: HTMLElement) => {
    const tab = item.acknowledgement ? 'history' : 'inbox'
    if (input.onOpenResult) input.onOpenResult(item.checklistInstanceId, item.storeId, tab, trigger)
    else input.onOpenWorkflow(item.storeId, tab, trigger)
  }

  const openStoreRecord = (item: ChecklistAcknowledgementItem, trigger: HTMLElement) => {
    historyTriggerRef.current = trigger
    setSelectedStore({ id: item.storeId, name: item.storeName })
  }

  return (
    <>
      <StoreSurfacePage
        ariaLabel="Mağaza müdürü checklist görünümü"
        className="tw:!max-w-[1240px] tw:min-w-0 tw:!gap-3 tw:!py-1"
        data-testid="store_manager-checklist-command"
      >
        <header className="tw:relative tw:isolate tw:min-w-0 tw:overflow-visible tw:rounded-2xl tw:bg-primary tw:px-4 tw:py-4 tw:text-primary-foreground tw:shadow-[0_18px_45px_color-mix(in_srgb,var(--primary)_18%,transparent)] tw:sm:px-5 tw:sm:py-5">
          <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-4 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
            <div className="tw:flex tw:min-w-0 tw:items-start tw:gap-3.5">
              <span className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-primary-foreground/20 tw:bg-primary-foreground/10">
                <ClipboardCheck aria-hidden="true" className="tw:size-5" strokeWidth={1.8} />
              </span>
              <div className="tw:min-w-0">
                <h1 className="tw:m-0 tw:text-xl tw:font-semibold tw:leading-7 tw:tracking-[-0.02em] tw:text-primary-foreground tw:sm:text-2xl">
                  Checklist İnceleme
                </h1>
                <p className="tw:mt-1 tw:mb-0 tw:max-w-xl tw:text-sm tw:leading-5 tw:text-primary-foreground/75">
                  Tamamlanan kontrolleri inceleyin ve bekleyen mağaza onaylarını sonuçlandırın.
                </p>
              </div>
            </div>

            <div className="tw:self-start tw:[&_.checklist-command-period-trigger]:!w-auto tw:[&_.checklist-command-period-trigger]:!min-w-[10.75rem] tw:[&_.checklist-command-period-trigger]:!justify-start tw:[&_.checklist-command-period-trigger]:!border-primary-foreground/25 tw:[&_.checklist-command-period-trigger]:!bg-primary-foreground/10 tw:[&_.checklist-command-period-trigger]:!px-3 tw:[&_.checklist-command-period-trigger]:!text-primary-foreground tw:[&_.checklist-command-period-trigger]:!shadow-none tw:[&_.checklist-command-period-trigger:hover]:!bg-primary-foreground/15 tw:[&_.checklist-command-period-trigger>span]:!grid tw:[&_.checklist-command-period-trigger>svg:last-child]:!block tw:[&_.checklist-command-period-trigger_small]:!text-primary-foreground/65 tw:[&_.checklist-command-period-trigger_strong]:!text-primary-foreground tw:lg:self-auto">
              <ChecklistCommandPeriodPicker
                locale={locale}
                period={period}
                onChange={(value) => {
                  setPeriod(value)
                  setOffset(0)
                }}
              />
            </div>
          </div>

          <div className="tw:mt-4 tw:flex tw:flex-wrap tw:items-center tw:gap-x-5 tw:gap-y-2 tw:border-t tw:border-primary-foreground/15 tw:pt-3 tw:text-xs tw:text-primary-foreground/70">
            <HeaderCount icon={<ClipboardCheck />} label="Toplam" value={totalCount} />
            <HeaderCount icon={<Clock3 />} label="Onay bekliyor" value={pendingCount} />
            <HeaderCount icon={<CheckCircle2 />} label="Kabul edildi" value={acknowledgedCount} />
          </div>
        </header>

        <section
          className="tw:min-w-0 tw:max-w-full tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card tw:shadow-sm"
          aria-label="Checklist inceleme kuyruğu"
        >
          <div className="tw:flex tw:min-h-16 tw:flex-col tw:gap-1 tw:border-b tw:border-border tw:px-3 tw:pt-2 tw:sm:flex-row tw:sm:items-end tw:sm:justify-between tw:sm:px-4 tw:sm:pt-0">
            <Tabs value={filter} onValueChange={changeFilter} className="tw:min-w-0">
              <TabsList className="tw:h-14 tw:w-full tw:min-w-0 tw:gap-1 tw:border-0 tw:px-0 tw:sm:w-auto tw:sm:gap-5">
                <QueueTab value="all" label="Tümü" count={totalCount} />
                <QueueTab value="pending_acknowledgement" label="Onay bekleyen" mobileLabel="Bekleyen" count={pendingCount} />
                <QueueTab value="acknowledged" label="Kabul edilen" mobileLabel="Kabul" count={acknowledgedCount} />
              </TabsList>
            </Tabs>
            <div className="tw:flex tw:h-8 tw:items-center tw:justify-end tw:pb-2 tw:text-xs tw:text-muted-foreground" aria-live="polite">
              {query.isFetching && response ? 'Güncelleniyor' : `${response?.meta.total ?? totalCount} kayıt`}
            </div>
          </div>

          {!response && query.isLoading ? <ChecklistQueueSkeleton /> : null}
          {!response && query.isError ? (
            <div className="tw:p-4">
              <StoreErrorState
                title="Checklistler açılamadı"
                description={getUserFacingErrorMessage(query.error, 'Checklist kayıtları okunamadı.')}
                action={{ label: 'Tekrar dene', onClick: () => void query.refetch(), variant: 'outline' }}
              />
            </div>
          ) : null}
          {response?.items.length === 0 ? <ChecklistQueueEmpty filter={filter} /> : null}

          {response && response.items.length > 0 ? (
            <>
              <div className="tw:hidden tw:xl:block" data-testid="store-manager-checklist-desktop-table">
                <Table className="tw:table-fixed">
                  <TableHeader className="tw:bg-muted/25">
                    <TableRow className="tw:hover:bg-transparent">
                      <TableHead className="tw:w-[17%] tw:pl-5">Mağaza</TableHead>
                      <TableHead className="tw:w-[17%]">Checklist</TableHead>
                      <TableHead className="tw:w-[19%]">Tamamlayan</TableHead>
                      <TableHead className="tw:w-[7%] tw:text-center">Puan</TableHead>
                      <TableHead className="tw:w-[12%]">Durum</TableHead>
                      <TableHead className="tw:w-[28%] tw:pr-5 tw:text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {response.items.map((item) => (
                      <ChecklistTableRow
                        item={item}
                        key={item.checklistInstanceId}
                        locale={locale}
                        onOpenResult={openResult}
                        onOpenStoreRecord={openStoreRecord}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="tw:divide-y tw:divide-border tw:xl:hidden" data-testid="store-manager-checklist-mobile-list">
                {response.items.map((item) => (
                  <ChecklistMobileRow
                    item={item}
                    key={item.checklistInstanceId}
                    locale={locale}
                    onOpenResult={openResult}
                    onOpenStoreRecord={openStoreRecord}
                  />
                ))}
              </div>
            </>
          ) : null}

          {response ? (
            <footer className="tw:flex tw:min-h-14 tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-border tw:bg-muted/20 tw:px-3 tw:py-2 tw:text-xs tw:text-muted-foreground tw:sm:px-4">
              <span className="tw:tabular-nums">{firstItem}-{lastItem} / {response.meta.total}</span>
              <div className="tw:flex tw:items-center tw:gap-2">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Önceki sayfa"
                  disabled={offset === 0 || query.isFetching}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  <ChevronLeft />
                </Button>
                <span className="tw:min-w-12 tw:text-center tw:font-medium tw:tabular-nums tw:text-foreground">
                  {pageNumber} / {pageCount}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Sonraki sayfa"
                  disabled={offset + response.items.length >= response.meta.total || query.isFetching}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </footer>
          ) : null}
        </section>
      </StoreSurfacePage>

      <ChecklistOperationalHistoryDrawer
        authSummary={input.authSummary}
        open={Boolean(selectedStore)}
        storeId={selectedStore?.id ?? null}
        storeName={selectedStore?.name ?? null}
        returnFocusRef={historyTriggerRef}
        onClose={() => setSelectedStore(null)}
      />
    </>
  )
}

function HeaderCount(input: { icon: ReactNode; label: string; value: number }) {
  return (
    <span className="tw:inline-flex tw:items-center tw:gap-1.5">
      <span className="tw:[&_svg]:size-3.5 tw:[&_svg]:stroke-[1.8]" aria-hidden="true">{input.icon}</span>
      <span>{input.label}</span>
      <strong className="tw:text-sm tw:font-semibold tw:tabular-nums tw:text-primary-foreground">{input.value}</strong>
    </span>
  )
}

function QueueTab(input: { value: QueueFilter; label: string; mobileLabel?: string; count: number }) {
  return (
    <TabsTrigger
      className="tw:min-w-0 tw:flex-1 tw:gap-1.5 tw:px-1 tw:text-xs tw:sm:flex-none tw:sm:text-sm"
      value={input.value}
    >
      <span className={input.mobileLabel ? 'tw:sm:hidden' : undefined}>{input.mobileLabel ?? input.label}</span>
      {input.mobileLabel ? <span className="tw:hidden tw:sm:inline">{input.label}</span> : null}
      <span className="tw:min-w-5 tw:rounded-md tw:bg-muted tw:px-1.5 tw:py-0.5 tw:text-[10px] tw:font-semibold tw:tabular-nums tw:text-muted-foreground">
        {input.count}
      </span>
    </TabsTrigger>
  )
}

function ChecklistTableRow(input: {
  item: ChecklistAcknowledgementItem
  locale: 'tr' | 'en'
  onOpenResult: (item: ChecklistAcknowledgementItem, trigger: HTMLElement) => void
  onOpenStoreRecord: (item: ChecklistAcknowledgementItem, trigger: HTMLElement) => void
}) {
  const item = input.item
  return (
    <TableRow
      data-testid="store-manager-checklist-instance-row"
      className="tw:h-[4.5rem] tw:bg-card tw:hover:bg-primary/[0.025]"
    >
      <TableCell className="tw:pl-5">
        <strong className="tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-foreground">{item.storeName}</strong>
      </TableCell>
      <TableCell>
        <span className="tw:block tw:truncate tw:text-sm tw:text-foreground">{item.templateName}</span>
      </TableCell>
      <TableCell>
        <span className="tw:grid tw:min-w-0 tw:grid-cols-[auto_minmax(0,1fr)] tw:items-center tw:gap-x-2">
          <UserRound aria-hidden="true" className="tw:row-span-2 tw:size-3.5 tw:shrink-0 tw:text-primary" strokeWidth={1.8} />
          <span className="tw:truncate tw:text-xs tw:font-medium tw:text-foreground">
            {item.completedByDisplayName ?? 'Bilgi yok'}
          </span>
          <span className="tw:truncate tw:text-[0.7rem] tw:tabular-nums tw:text-muted-foreground">
            {item.completedAt ? formatDate(item.completedAt, input.locale) : 'Tarih yok'}
          </span>
        </span>
      </TableCell>
      <TableCell className="tw:text-center"><ChecklistScore value={item.totalScore} /></TableCell>
      <TableCell><AcknowledgementStatus acknowledged={Boolean(item.acknowledgement)} /></TableCell>
      <TableCell className="tw:pr-5">
        <div className="tw:flex tw:items-center tw:justify-end tw:gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={(event) => input.onOpenStoreRecord(item, event.currentTarget)}
          >
            <Store aria-hidden="true" />
            Mağaza kaydı
          </Button>
          <Button size="sm" onClick={(event) => input.onOpenResult(item, event.currentTarget)}>
            <ClipboardCheck aria-hidden="true" />
            {item.acknowledgement ? 'Sonucu gör' : 'İncele ve kabul et'}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function ChecklistMobileRow(input: {
  item: ChecklistAcknowledgementItem
  locale: 'tr' | 'en'
  onOpenResult: (item: ChecklistAcknowledgementItem, trigger: HTMLElement) => void
  onOpenStoreRecord: (item: ChecklistAcknowledgementItem, trigger: HTMLElement) => void
}) {
  const item = input.item
  return (
    <article className="tw:grid tw:min-w-0 tw:max-w-full tw:gap-3 tw:overflow-hidden tw:p-4">
      <div className="tw:flex tw:min-w-0 tw:items-start tw:justify-between tw:gap-3">
        <div className="tw:min-w-0">
          <strong className="tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-foreground">{item.storeName}</strong>
          <span className="tw:mt-0.5 tw:block tw:truncate tw:text-xs tw:text-muted-foreground">{item.templateName}</span>
        </div>
        <ChecklistScore value={item.totalScore} />
      </div>

      <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-x-3 tw:gap-y-2 tw:text-xs">
        <AcknowledgementStatus acknowledged={Boolean(item.acknowledgement)} />
        <span className="tw:inline-flex tw:min-w-0 tw:items-center tw:gap-1.5 tw:text-muted-foreground">
          <UserRound aria-hidden="true" className="tw:size-3.5 tw:shrink-0 tw:text-primary" strokeWidth={1.8} />
          <span className="tw:truncate">{item.completedByDisplayName ?? 'Bilgi yok'}</span>
        </span>
        <span className="tw:tabular-nums tw:text-muted-foreground">
          {item.completedAt ? formatDate(item.completedAt, input.locale) : 'Tarih yok'}
        </span>
      </div>

      <div className="tw:grid tw:min-w-0 tw:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] tw:gap-2">
        <Button
          size="lg"
          variant="outline"
          className="tw:w-full tw:min-w-0"
          onClick={(event) => input.onOpenStoreRecord(item, event.currentTarget)}
        >
          <Store aria-hidden="true" />
          Mağaza kaydı
        </Button>
        <Button
          size="lg"
          className="tw:w-full tw:min-w-0"
          onClick={(event) => input.onOpenResult(item, event.currentTarget)}
        >
          <ClipboardCheck aria-hidden="true" />
          {item.acknowledgement ? 'Sonucu gör' : 'İncele ve kabul et'}
        </Button>
      </div>
    </article>
  )
}

function ChecklistScore({ value }: { value: number | null }) {
  return value === null ? (
    <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">Skor yok</span>
  ) : (
    <span className="tw:inline-flex tw:items-baseline tw:gap-0.5 tw:tabular-nums">
      <strong className="tw:text-base tw:font-semibold tw:tracking-[-0.02em] tw:text-foreground">{Math.round(value)}</strong>
      <small className="tw:text-[0.65rem] tw:text-muted-foreground">puan</small>
    </span>
  )
}

function AcknowledgementStatus({ acknowledged }: { acknowledged: boolean }) {
  return (
    <StatusBadge tone={acknowledged ? 'success' : 'warning'}>
      {acknowledged ? 'Kabul edildi' : 'Onay bekliyor'}
    </StatusBadge>
  )
}

function ChecklistQueueSkeleton() {
  return (
    <div className="tw:grid" aria-label="Checklistler yükleniyor">
      {[0, 1, 2, 3].map((index) => (
        <div className="tw:grid tw:h-[4.5rem] tw:grid-cols-[1fr_1fr_1fr_5rem] tw:items-center tw:gap-5 tw:border-b tw:border-border tw:px-5" key={index}>
          <Skeleton className="tw:h-3 tw:w-3/4 tw:rounded-md" />
          <Skeleton className="tw:h-3 tw:w-2/3 tw:rounded-md" />
          <Skeleton className="tw:h-7 tw:w-24 tw:rounded-lg" />
          <Skeleton className="tw:h-7 tw:w-full tw:rounded-lg" />
        </div>
      ))}
    </div>
  )
}

function ChecklistQueueEmpty({ filter }: { filter: QueueFilter }) {
  const copy = filter === 'pending_acknowledgement'
    ? { title: 'Bekleyen onay yok', description: 'Bu dönemde inceleme bekleyen checklist bulunmuyor.' }
    : filter === 'acknowledged'
      ? { title: 'Kabul edilen checklist yok', description: 'Bu dönemde kabul edilmiş checklist bulunmuyor.' }
      : { title: 'Bu dönemde checklist yok', description: 'Seçili ayda tamamlanan checklist bulunmuyor.' }

  return (
    <div className="tw:grid tw:min-h-56 tw:place-items-center tw:p-8 tw:text-center">
      <div>
        <span className="tw:mx-auto tw:flex tw:size-10 tw:items-center tw:justify-center tw:rounded-xl tw:bg-primary/10 tw:text-primary">
          <ClipboardCheck aria-hidden="true" className="tw:size-5" strokeWidth={1.8} />
        </span>
        <strong className="tw:mt-3 tw:block tw:text-sm tw:text-foreground">{copy.title}</strong>
        <p className="tw:mt-1 tw:mb-0 tw:text-xs tw:text-muted-foreground">{copy.description}</p>
      </div>
    </div>
  )
}

function formatDate(value: string, locale: 'tr' | 'en') {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value)).replace('.', '')
}
