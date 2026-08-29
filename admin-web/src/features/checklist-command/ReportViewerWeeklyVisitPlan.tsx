import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Clock3, Store } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'
import { getBusinessDateInputValue } from '../../lib/business-date'
import { getUserFacingErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import type { AuthSessionSummary } from '../auth/api'
import { storeChecklistVisitPlanQueryKey } from '../auth/store-query-scope'
import { getChecklistVisitPlan, type ChecklistVisitPlan } from './api'
import { buildChecklistPlanningDays, shiftChecklistWeek } from './model'

export function ReportViewerWeeklyVisitPlan(input: {
  authSummary: AuthSessionSummary | null
  locale: 'tr' | 'en'
  scopeId: string
  weekStart: string
  onWeekStartChange: (value: string) => void
}) {
  const [mobileDaySelection, setMobileDaySelection] = useState<{ weekStart: string; index: number } | null>(null)
  const copy = input.locale === 'tr' ? trCopy : enCopy
  const planQuery = useQuery({
    queryKey: storeChecklistVisitPlanQueryKey(input.authSummary, input.scopeId, input.weekStart),
    queryFn: () => getChecklistVisitPlan({ regionId: input.scopeId, weekStart: input.weekStart }),
    ...transientQueryRetryOptions,
  })

  if (planQuery.isLoading) return <PlanLoading />
  if (planQuery.isError || !planQuery.data) {
    return (
      <div className="report-viewer-week-state" role="alert">
        <CircleAlert aria-hidden />
        <div><strong>{copy.error}</strong><p>{getUserFacingErrorMessage(planQuery.error, copy.errorCopy)}</p></div>
        <Button type="button" size="sm" variant="outline" onClick={() => void planQuery.refetch()}>{copy.retry}</Button>
      </div>
    )
  }

  const plan = planQuery.data.data
  const days = buildChecklistPlanningDays(plan.weekStart, input.locale)
  const businessDayIndex = days.findIndex((day) => day.isoDate === getBusinessDateInputValue())
  const defaultMobileDayIndex = businessDayIndex >= 0 ? businessDayIndex : 0
  const mobileDayIndex = mobileDaySelection?.weekStart === input.weekStart ? mobileDaySelection.index : defaultMobileDayIndex
  const firstDay = days[0]
  const lastDay = days.at(-1)
  const weekLabel = firstDay && lastDay ? `${firstDay.dateLabel} – ${lastDay.dateLabel} ${plan.weekStart.slice(0, 4)}` : plan.weekStart

  return (
    <section className="report-viewer-week" aria-label={copy.weeklyPlan}>
      <header className="report-viewer-week-head">
        <div className="report-viewer-week-title">
          <span aria-hidden><CalendarDays /></span>
          <div><small>{copy.weeklyPlan}</small><strong>{copy.fieldVisits}</strong></div>
        </div>
        <div className="report-viewer-week-nav">
          <Button type="button" size="icon-sm" variant="outline" aria-label={copy.previousWeek} onClick={() => input.onWeekStartChange(shiftChecklistWeek(input.weekStart, -1))}><ChevronLeft /></Button>
          <span><strong>{weekLabel}</strong><small>{copy.visitCount(plan.items.length)}</small></span>
          <Button type="button" size="icon-sm" variant="outline" aria-label={copy.nextWeek} onClick={() => input.onWeekStartChange(shiftChecklistWeek(input.weekStart, 1))}><ChevronRight /></Button>
        </div>
      </header>

      <div className="report-viewer-week-tabs" aria-label={copy.chooseDay}>
        {days.map((day, index) => {
          const count = plan.items.filter((item) => item.plannedDate === day.isoDate).length
          return (
            <Button
              type="button"
              size="sm"
              variant={mobileDayIndex === index ? 'secondary' : 'ghost'}
              aria-pressed={mobileDayIndex === index}
              key={day.isoDate}
              onClick={() => setMobileDaySelection({ weekStart: input.weekStart, index })}
            >
              <span>{day.shortLabel}</span><small>{day.dateLabel}</small><b>{count}</b>
            </Button>
          )
        })}
      </div>

      <div className="report-viewer-week-grid">
        {days.map((day, index) => {
          const items = plan.items.filter((item) => item.plannedDate === day.isoDate)
          return (
            <article className="report-viewer-day" data-mobile-active={mobileDayIndex === index} key={day.isoDate}>
              <header><span><strong>{day.dayLabel}</strong><small>{day.dateLabel}</small></span><b>{items.length}</b></header>
              <div>
                {items.length === 0 ? <span className="report-viewer-day-empty"><Store aria-hidden /> {copy.noVisit}</span> : items.map((item) => <VisitItem item={item} key={item.planItemId} locale={input.locale} />)}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function VisitItem({ item, locale }: { item: ChecklistVisitPlan['items'][number]; locale: 'tr' | 'en' }) {
  const status = getVisitStatus(item, locale)
  const Icon = status.icon
  return (
    <div className="report-viewer-visit">
      <strong>{item.storeName}</strong>
      <Badge variant={status.variant}><Icon aria-hidden /> {status.label}</Badge>
    </div>
  )
}

function getVisitStatus(item: ChecklistVisitPlan['items'][number], locale: 'tr' | 'en') {
  if (item.checklistInstanceId) return { icon: CheckCircle2, label: locale === 'tr' ? 'Checklist Yapıldı · Ziyaret Tamamlandı' : 'Checklist Done · Visit Completed', variant: 'default' as const }
  if (item.visitCompletedAt || item.status === 'completed') return { icon: CheckCircle2, label: locale === 'tr' ? 'Ziyaret Tamamlandı' : 'Visit Completed', variant: 'secondary' as const }
  if (item.status === 'missed') return { icon: CircleAlert, label: locale === 'tr' ? 'Yapılmadı' : 'Missed', variant: 'destructive' as const }
  return { icon: Clock3, label: locale === 'tr' ? 'Planlandı' : 'Planned', variant: 'outline' as const }
}

function PlanLoading() {
  return <div className="report-viewer-week-loading" aria-label="Ziyaret planı yükleniyor"><Skeleton className="tw:h-12 tw:w-full" /><div>{Array.from({ length: 6 }, (_, index) => <Skeleton className="tw:h-32 tw:w-full" key={index} />)}</div></div>
}

const trCopy = {
  chooseDay: 'Plan gününü seç', error: 'Ziyaret planı yüklenemedi.', errorCopy: 'Haftalık plan şu anda okunamıyor.', fieldVisits: 'Saha ziyaretleri', nextWeek: 'Sonraki hafta', noVisit: 'Planlanmış ziyaret yok', previousWeek: 'Önceki hafta', retry: 'Tekrar dene', visitCount: (count: number) => `${count} ziyaret`, weeklyPlan: 'HAFTALIK PLAN',
} as const

const enCopy = {
  chooseDay: 'Choose plan day', error: 'Visit plan unavailable', errorCopy: 'The weekly plan cannot be read right now.', fieldVisits: 'Field visits', nextWeek: 'Next week', noVisit: 'No planned visit', previousWeek: 'Previous week', retry: 'Retry', visitCount: (count: number) => `${count} visits`, weeklyPlan: 'WEEKLY PLAN',
} as const
