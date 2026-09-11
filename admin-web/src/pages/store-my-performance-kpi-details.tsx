import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getMyPerformance, getPersonnelPerformance, type MyPerformanceSummary } from '../features/reports/api'
import { metricGrowth } from './store-kpis-manager-insights-utils'
import './store-my-performance-kpi-details.css'

type Props = {
  performance: MyPerformanceSummary
  profileEmployeeId: string
  locale: string
  onClose: () => void
}

export function StoreMyPerformanceKpiDetails({ performance, profileEmployeeId, locale, onClose }: Props) {
  const tr = locale === 'tr'
  const currentYear = performance.period?.periodStart.slice(0, 4) ?? String(new Date().getFullYear())
  const [year, setYear] = useState(currentYear)
  const available = new Set(performance.availablePeriods.filter(p => p.periodType === 'monthly').map(p => p.periodStart.slice(0, 10)))
  const years = [...new Set([currentYear, ...[...available].map(p => p.slice(0, 4))])].sort().reverse()
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}-01`)
  const periods = [...new Set(months.flatMap(month => [month, previousMonth(month), `${Number(year) - 1}${month.slice(4)}`]))]
  const queries = useQueries({ queries: periods.map(periodStart => ({
    queryKey: [...(profileEmployeeId ? ['personnel-performance', profileEmployeeId] : ['my-performance']), 'live', 'monthly', periodStart, ''],
    queryFn: () => profileEmployeeId
      ? getPersonnelPerformance(profileEmployeeId, { mode: 'live', periodType: 'monthly', periodStart })
      : getMyPerformance({ mode: 'live', periodType: 'monthly', periodStart }),
    enabled: available.has(periodStart), staleTime: 60_000,
  })) })
  const queryByMonth = new Map(periods.map((month, i) => [month, queries[i]!]))
  const dataFor = (month: string) => {
    const data = queryByMonth.get(month)?.data
    return available.has(month) && data?.period?.periodStart.slice(0, 10) === month &&
      data.employee?.employeeId === performance.employee?.employeeId ? data : undefined
  }
  const stateFor = (month: string) => !available.has(month) ? (tr ? 'Veri yok' : 'No data')
    : queryByMonth.get(month)?.isError ? (tr ? 'Yüklenemedi' : 'Load failed')
    : queryByMonth.get(month)?.isPending ? (tr ? 'Yükleniyor' : 'Loading') : (tr ? 'Veri yok' : 'No data')
  const codes = ['score', ...new Set([...performance.metrics, ...months.flatMap(month => dataFor(month)?.metrics ?? [])].map(metric => metric.code))]
  const failures = queries.filter(query => query.isError)
  const visibleMonths = months.filter(month => available.has(month)).reverse()
  const monthLabel = (month: string) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(`${month}T12:00:00`))
  const format = (value: number | null, code: string) => value === null ? (tr ? 'Veri yok' : 'No data')
    : new Intl.NumberFormat(locale, code === 'ATV' ? { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }
      : code === 'TARGET_ACHIEVEMENT' || code === 'CR' ? { style: 'percent', maximumFractionDigits: 1 }
      : { minimumFractionDigits: code === 'UPT' ? 2 : 0, maximumFractionDigits: code === 'UPT' ? 2 : 1 }).format(value)
  const rank = (value: number | null | undefined, population: number | undefined) =>
    value != null && value > 0 && population != null && population > 0 ? `${value}. / ${population}` : '—'
  const labels = tr ? ['KPI', 'Değer', 'Önceki aya göre', 'Geçen yıla göre', 'Mağaza', 'Bölge', 'Türkiye']
    : ['KPI', 'Value', 'Previous month', 'Previous year', 'Store', 'Region', 'Türkiye']
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent closeLabel={tr ? 'KPI detaylarını kapat' : 'Close KPI details'} className="personnel-kpi-details tw:sm:max-w-6xl" data-testid="store-me-kpi-dialog">
      <DialogHeader><DialogTitle>{tr ? 'KPI Detayları' : 'KPI Details'} · {performance.employee?.displayName}</DialogTitle>
        <DialogDescription>{tr ? 'Her ayın KPI değerleri, değişimi ve personeller arasındaki sıralamanız. Sıralama: sıra / toplam kişi.' : 'Monthly KPI values, changes and your personnel rankings. Rank: position / total people.'}</DialogDescription>
      </DialogHeader>
      <div className="personnel-kpi-details-toolbar"><span>{tr ? 'Aylık performans' : 'Monthly performance'}</span>
        <Select value={year} onValueChange={setYear}><SelectTrigger aria-label={tr ? 'Detay yılı' : 'Detail year'}><SelectValue /></SelectTrigger><SelectContent>{years.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
      </div>
      {failures.length ? <Alert variant="destructive"><AlertDescription>{tr ? 'Bazı dönemler yüklenemedi.' : 'Some periods could not be loaded.'}<Button variant="outline" onClick={() => void Promise.all(failures.map(query => query.refetch()))}>{tr ? 'Tekrar dene' : 'Retry'}</Button></AlertDescription></Alert> : null}
      <div className="personnel-kpi-details-months">{!visibleMonths.length ? <p className="personnel-kpi-month-empty">{tr ? 'Bu yıl için aylık KPI verisi bulunamadı.' : 'No monthly KPI data for this year.'}</p> : null}{visibleMonths.map(month => {
        const data = dataFor(month)
        const previous = previousMonth(month)
        const lastYear = `${Number(year) - 1}${month.slice(4)}`
        return <section key={month} aria-label={monthLabel(month)} className="personnel-kpi-month">
          <h3>{monthLabel(month)}{data?.partial.isPartial ? <Badge variant="outline">{tr ? 'Eksik veri' : 'Partial data'}</Badge> : null}</h3>
          {!data ? <p className="personnel-kpi-month-empty">{stateFor(month)}</p> : <Table aria-label={monthLabel(month)}><TableHeader><TableRow>{labels.map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{codes.map(code => {
            const metric = data.metrics.find(item => item.code === code)
            const value = performanceValue(data, code)
            const ranks = code === 'score' ? data.rankings : data.metricRanks?.find(item => item.code === code)
            const comparison = (period: string) => {
              const prior = performanceValue(dataFor(period), code)
              const growth = metricGrowth(value, prior)
              return <div className="personnel-kpi-comparison"><span>{prior === null ? stateFor(period) : format(prior, code)}</span>{growth === null ? (prior === 0 ? <small>{tr ? 'Önceki değer sıfır' : 'Previous value is zero'}</small> : null) : <Badge variant="outline" className="personnel-kpi-change" data-direction={growth > 0 ? 'up' : growth < 0 ? 'down' : 'flat'}>{growth > 0 ? <TrendingUp /> : growth < 0 ? <TrendingDown /> : <Minus />}{growth > 0 ? '+' : growth < 0 ? '−' : ''}{Math.abs(growth).toLocaleString(locale, { maximumFractionDigits: 1 })}%</Badge>}</div>
            }
            return <TableRow key={code}><TableCell><strong>{metricName(code, metric?.label, tr)}</strong></TableCell>
              <TableCell data-label={labels[1]} className="personnel-kpi-value">{format(value, code)}{metric && (metric.benchmarkValue ?? metric.targetValue) != null ? <small>{tr ? (code === 'TARGET_ACHIEVEMENT' ? 'Hedef' : 'Referans') : (code === 'TARGET_ACHIEVEMENT' ? 'Target' : 'Reference')}: {format(code === 'TARGET_ACHIEVEMENT' ? metric.targetValue ?? null : metric.benchmarkValue ?? metric.targetValue ?? null, code === 'TARGET_ACHIEVEMENT' ? 'ATV' : code)}</small> : null}</TableCell>
              <TableCell data-label={labels[2]}>{comparison(previous)}</TableCell><TableCell data-label={labels[3]}>{comparison(lastYear)}</TableCell>
              <TableCell data-label={labels[4]}>{rank(ranks?.storeRank, ranks?.storePopulation)}</TableCell><TableCell data-label={labels[5]}>{rank(ranks?.regionRank, ranks?.regionPopulation)}</TableCell><TableCell data-label={labels[6]}>{rank(ranks?.turkeyRank, ranks?.turkeyPopulation)}</TableCell>
            </TableRow>
          })}</TableBody></Table>}
        </section>
      })}</div>
      <p className="personnel-kpi-details-footnote">{tr ? 'Değişimler önceki takvim ayı ve geçen yılın aynı ayıyla karşılaştırılır. Eksik değerler ve sıralamalar tahmin edilmez.' : 'Changes compare the previous calendar month and the same month last year. Missing values and rankings are not estimated.'}</p>
    </DialogContent>
  </Dialog>
}

function previousMonth(month: string) {
  const date = new Date(`${month}T12:00:00`)
  date.setMonth(date.getMonth() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function performanceValue(data: MyPerformanceSummary | undefined, code: string): number | null {
  if (!data) return null
  const metric = data.metrics.find(item => item.code === code)
  const value = code === 'score' ? (data.score.matchedMetrics > 0 ? data.score.value : null)
    : code === 'TARGET_ACHIEVEMENT' ? metric?.achievementRate ?? metric?.actualRatio : metric?.actualValue
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function metricName(code: string, fallback: string | undefined, tr: boolean) {
  const names: Record<string, string> = tr ? { score: 'Performans Skoru', TARGET_ACHIEVEMENT: 'HG · Hedef Gerçekleşme', ATV: 'ATV · Ortalama Fiş Tutarı', UPT: 'UPT · Fiş Başına Ürün' }
    : { score: 'Performance Score', TARGET_ACHIEVEMENT: 'Target Achievement', ATV: 'Average Ticket Value', UPT: 'Units Per Ticket' }
  return names[code] ?? fallback ?? code
}
