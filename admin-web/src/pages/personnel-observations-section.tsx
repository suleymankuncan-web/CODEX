import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { DateRange } from 'react-day-picker'
import { enGB, tr } from 'react-day-picker/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Calendar } from '../components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Alert, AlertDescription } from '../components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { getPersonnelObservations } from '../features/integrations/api'
import { useLocalization } from '../features/localization/useLocalization'
import {
  observationDate,
  initialObservationRange,
  validObservationRange,
} from './personnel-observations-model'

const pageSize = 20

export function PersonnelObservationsSection() {
  const { t, locale } = useLocalization()
  const [range, setRange] = useState<DateRange | undefined>(() =>
    initialObservationRange(new Date()),
  )
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const fromDate = range?.from ? observationDate(range.from) : ''
  const toDate = range?.to ? observationDate(range.to) : ''
  const validRange = validObservationRange(fromDate, toDate)
  const q = search.trim()
  const observations = useQuery({
    queryKey: ['admin-personnel-observations', fromDate, toDate, q, page],
    queryFn: () =>
      getPersonnelObservations({
        fromDate,
        toDate,
        ...(q ? { q } : {}),
        limit: pageSize,
        offset: page * pageSize,
      }),
    enabled: validRange,
  })
  const data = observations.data
  const dateLabel = (value: string) =>
    new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB').format(
      new Date(`${value}T12:00:00`),
    )

  return (
    <section
      aria-labelledby="personnel-observations-title"
      className="tw:mt-6 tw:space-y-3 tw:border-t tw:border-border tw:px-4 tw:pt-5 tw:pb-4"
    >
      <div>
        <h2 id="personnel-observations-title" className="tw:text-base tw:font-medium">
          {t('adminIntegrations.observationsTitle')}
        </h2>
        <p className="tw:mt-1 tw:text-sm tw:text-muted-foreground">
          {t('adminIntegrations.observationsCopy')}
        </p>
      </div>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Input
          className="tw:w-full tw:sm:max-w-xs"
          aria-label={t('adminIntegrations.observationsSearch')}
          placeholder={t('adminIntegrations.observationsSearch')}
          maxLength={80}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(0)
          }}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              aria-label={t('adminIntegrations.observationsRange')}
              className="tw:w-full tw:sm:w-auto"
            >
              <CalendarDays aria-hidden="true" />
              {fromDate && toDate
                ? `${dateLabel(fromDate)} – ${dateLabel(toDate)}`
                : t('adminIntegrations.observationsRange')}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="tw:w-auto tw:p-0">
            <Calendar
              locale={locale === 'tr' ? tr : enGB}
              mode="range"
              selected={range}
              onSelect={(value) => {
                setRange(value)
                setPage(0)
              }}
              max={365}
            />
          </PopoverContent>
        </Popover>
      </div>
      {!validRange ? (
        <p role="status">{t('adminIntegrations.observationsChooseRange')}</p>
      ) : observations.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{t('adminIntegrations.observationsError')}</AlertDescription>
          <Button variant="outline" onClick={() => void observations.refetch()}>
            {t('adminIntegrations.observationsRetry')}
          </Button>
        </Alert>
      ) : observations.isPending ? (
        <p role="status">{t('adminIntegrations.observationsLoading')}</p>
      ) : data?.items.length === 0 ? (
        <div>
          <p role="status" className="tw:py-4 tw:text-sm tw:text-muted-foreground">
            {t('adminIntegrations.observationsEmpty')}
          </p>
          {page > 0 ? (
            <Button variant="outline" onClick={() => setPage((value) => value - 1)}>
              {t('adminIntegrations.observationsPrevious')}
            </Button>
          ) : null}
        </div>
      ) : data ? (
        <>
          <div className="tw:hidden tw:sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('adminIntegrations.observationsCode')}</TableHead>
                  <TableHead>{t('adminIntegrations.observationsDate')}</TableHead>
                  <TableHead>{t('adminIntegrations.observationsStore')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow
                    key={`${item.sourceId}:${item.businessDate}:${item.storeId}:${item.personnelCode}`}
                  >
                    <TableCell className="tw:max-w-64 tw:break-all tw:font-mono">
                      {item.personnelCode}
                    </TableCell>
                    <TableCell>{dateLabel(item.businessDate)}</TableCell>
                    <TableCell>
                      {item.storeName} · {item.storeCode}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="tw:divide-y tw:sm:hidden">
            {data.items.map((item) => (
              <li
                className="tw:space-y-1 tw:py-3 tw:text-sm tw:break-words"
                key={`${item.sourceId}:${item.businessDate}:${item.storeId}:${item.personnelCode}`}
              >
                <p className="tw:font-mono">{item.personnelCode}</p>
                <p>{dateLabel(item.businessDate)}</p>
                <p className="tw:text-muted-foreground">
                  {item.storeName} · {item.storeCode}
                </p>
              </li>
            ))}
          </ul>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:text-sm tw:text-muted-foreground">
            <span>
              {t('adminIntegrations.observationsCount', {
                from: data.meta.offset + 1,
                to: data.meta.offset + data.items.length,
                total: data.meta.total,
              })}
            </span>
            <div className="tw:flex tw:gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label={t('adminIntegrations.observationsPrevious')}
                disabled={page === 0 || observations.isFetching}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={t('adminIntegrations.observationsNext')}
                disabled={
                  data.meta.offset + data.items.length >= data.meta.total || observations.isFetching
                }
                onClick={() => setPage((value) => value + 1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
