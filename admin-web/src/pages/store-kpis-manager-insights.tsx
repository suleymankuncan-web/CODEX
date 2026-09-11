import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import './store-kpis-manager-insights.css'
import { useQueries } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiScoreChart } from '@/components/kpi-score-chart'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getStoreKpiHighlights, type RankingSummary, type StoreKpiHighlightsSummary } from '../features/reports/api'
import type { StoreKpiHighlightsPageModel } from './store-kpi-highlights-model'
import { formatMetricValue, resolveLocalizedKpiScoreReference } from './store-kpi-highlights-formatters'
import { toHundredPointLiveStoreScore } from './store-kpis-command-contract'
import { comparisonPeriod, metricGrowth } from './store-kpis-manager-insights-utils'

const names: Record<string, string> = { score: 'Mağaza Skoru', TARGET_ACHIEVEMENT: 'Hedef Gerçekleşme', ATV: 'Ortalama Fiş Tutarı', UPT: 'Fiş Başına Ürün', CR: 'Dönüşüm Oranı', gsm_approval: 'GSM Onayı', BM_CHECKLIST: 'Bölge Müdürü Checklist', VM_CHECKLIST: 'VM Checklist' }
const formulas: Record<string, string> = { score: 'Mağaza skoru, KPI katkılarının tanımlı ağırlıkları ve üst sınırları ile hesaplanır.', TARGET_ACHIEVEMENT: 'Net satış / satış hedefi × 100. Sıralama ve büyüme, hedef gerçekleşme oranı üzerinden hesaplanır.', ATV: 'Net satış / fiş sayısı. Tarih aralığında satış ve fiş toplamları kullanılır.', UPT: 'Satılan ürün adedi / fiş sayısı. Tarih aralığında ürün ve fiş toplamları kullanılır.', CR: 'Fiş sayısı / ziyaretçi sayısı × 100.', gsm_approval: 'GSM onayı veren müşteri / toplam müşteri × 100.', BM_CHECKLIST: 'Seçilen dönemdeki bölge müdürü checklist sonuçları.', VM_CHECKLIST: 'Seçilen dönemdeki görsel mağazacılık checklist sonuçları.' }

function summaryMetric(summary: StoreKpiHighlightsSummary | undefined, code: string) {
  if (!summary) return null
  if (code === 'score') return summary.score.matchedMetrics > 0 && summary.score.value !== null ? toHundredPointLiveStoreScore(Number(summary.score.value)) : null
  const metric = summary.metrics.find(row => row.code === code)
  if (metric?.actualValue == null) return null
  if (code === 'TARGET_ACHIEVEMENT') return metric.targetValue ? Number(metric.actualValue) / Math.abs(Number(metric.targetValue)) : null
  const value = Number(metric.actualValue)
  return Number.isFinite(value) ? value : null
}

export function StoreManagerScoreChart({ model }: { model: StoreKpiHighlightsPageModel }) {
  const year = model.livePeriodStart.slice(0, 4)
  const months = Array.from({length: 12}, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}-01`)
  const available = new Set((model.liveSummary?.availablePeriods ?? []).filter(p => p.periodType === 'monthly').map(p => p.periodStart.slice(0, 10)))
  const queries = useQueries({ queries: months.map(periodStart => ({
    queryKey: ['manager-kpi-month', model.effectiveStoreId, periodStart],
    queryFn: () => getStoreKpiHighlights({ storeId: model.effectiveStoreId!, periodType: 'monthly', periodStart }),
    enabled: model.reportingAllowed && Boolean(model.effectiveStoreId) && available.has(periodStart), staleTime: 60_000,
  })) })
  const data = months.map((periodStart, index) => ({
    month: new Intl.DateTimeFormat(model.locale, { month: 'short' }).format(new Date(`${periodStart}T12:00:00`)),
    score: queries[index]?.isError ? null : summaryMetric(queries[index]?.data, 'score'),
    state: queries[index]?.isError ? 'Yüklenemedi' : available.has(periodStart) && queries[index]?.isPending ? 'Yükleniyor' : 'Veri yok',
  }))
  const errors = queries.filter(query => query.isError)
  return <Card aria-label="Aylık mağaza skorları"><CardHeader><CardTitle>Aylık Mağaza Skoru</CardTitle><CardDescription>{year} · Ayların toplam KPI verileriyle hesaplanan puanlar</CardDescription></CardHeader><CardContent>
    {errors.length ? <Alert variant="destructive"><AlertDescription>Skor geçmişinin bir bölümü yüklenemedi.<Button variant="outline" onClick={() => void Promise.all(errors.map(query => query.refetch()))}>Tekrar dene</Button></AlertDescription></Alert> : null}
    <KpiScoreChart data={data} locale={model.locale} label="Mağaza Skoru" />
    <div className="tw:sr-only"><Table><TableHeader><TableRow><TableHead>Ay</TableHead><TableHead>Skor</TableHead></TableRow></TableHeader><TableBody>{data.map(row => <TableRow key={row.month}><TableCell>{row.month}</TableCell><TableCell>{row.score === null ? row.state : row.score.toLocaleString(model.locale)}</TableCell></TableRow>)}</TableBody></Table></div>
    <p className="tw:mt-3 tw:text-xs tw:text-muted-foreground">Verisi bulunmayan aylar boş bırakılır.</p>
  </CardContent></Card>
}

export function StoreManagerMetricDialog({ model, code, onClose, rankings, rankingError, retryRankings }: {
  model: StoreKpiHighlightsPageModel; code: string; onClose: () => void; rankings: RankingSummary | undefined; rankingError: boolean; retryRankings: () => void;
}) {
  const start = model.livePeriodStart
  const end = model.kpiDateRangeEnd || (model.livePeriodType === 'daily' ? start : '')
  const periods = [comparisonPeriod(start, end, -1), comparisonPeriod(start, end, -12)]
  const queries = useQueries({ queries: periods.map(period => ({
    queryKey: ['manager-kpi-comparison', model.effectiveStoreId, period.start, period.end],
    queryFn: () => getStoreKpiHighlights({ storeId: model.effectiveStoreId!, periodType: period.end ? 'daily' : 'monthly', periodStart: period.start, ...(period.end ? { periodEnd: period.end } : {}) }),
    enabled: model.reportingAllowed && Boolean(model.effectiveStoreId), staleTime: 60_000,
  })) })
  const actual = summaryMetric(model.liveSummary, code)
  const row = model.rows.find(metric => metric.kpiCode === code)
  const reference = row ? resolveLocalizedKpiScoreReference(model.t, { targetValue: row.targetValue, ...(row.benchmarkValue === undefined ? {} : { benchmarkValue: row.benchmarkValue }), benchmarkSource: row.benchmarkSource ?? null }) : null
  const rank = rankings?.storeLeaderboard.currentStoreComparisons?.find(item => item.code === code)
  const formatted = (value: number | null) => {
    if (value === null) return 'Veri yok'
    if (code === 'TARGET_ACHIEVEMENT') return new Intl.NumberFormat(model.locale, {style:'percent', maximumFractionDigits:2}).format(value)
    if (code === 'ATV') return new Intl.NumberFormat(model.locale, {style:'currency',currency:'TRY',maximumFractionDigits:0}).format(value)
    if (code === 'score') return new Intl.NumberFormat(model.locale, {maximumFractionDigits:1}).format(value)
    return formatMetricValue(model.locale,model.t,String(value),code)
  }
  const rankText = (value: {rank: number | null; population: number} | undefined) => rankingError ? 'Yüklenemedi' : value?.rank ? `${value.rank}. / ${value.population} mağaza` : 'Sıralama verisi yok'
  const dateLabel = (from: string, to: string) => new Intl.DateTimeFormat(model.locale,{ ...(to ? {day:'numeric' as const} : {}), month:'long',year:'numeric' }).format(new Date(`${from}T12:00:00`)) + (to && to !== from ? ` – ${new Intl.DateTimeFormat(model.locale,{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${to}T12:00:00`))}` : '')
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}><DialogContent closeLabel="Kapat" className="manager-kpi-dialog tw:sm:max-w-2xl tw:max-h-[90dvh] tw:overflow-y-auto"><DialogHeader><DialogTitle>{names[code]} · Detay</DialogTitle><DialogDescription>{model.activeStoreName} · {dateLabel(start, end)}</DialogDescription></DialogHeader>
    <div className="manager-kpi-summary tw:grid tw:grid-cols-2 tw:gap-3">
      {[['Gerçekleşen', formatted(actual)], [code === 'score' ? 'Hesaba katılan KPI' : reference?.sourceLabel ?? 'Hedef / Referans', code === 'score' ? String(model.liveSummary?.score.matchedMetrics ?? 0) : reference?.value == null ? 'Veri yok' : code === 'TARGET_ACHIEVEMENT' ? new Intl.NumberFormat(model.locale,{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(reference.value)) : formatted(Number(reference.value))], ['Bölge sıralaması', rankText(rank?.region)], ['Türkiye sıralaması', rankText(rank?.turkey)]].map(([label,value]) => <Card key={label} size="sm"><CardHeader><CardDescription>{label}</CardDescription><CardTitle>{value}</CardTitle></CardHeader></Card>)}
    </div>
    {rankingError ? <Button variant="outline" onClick={retryRankings}>Sıralamayı tekrar yükle</Button> : null}
    <div className="manager-kpi-comparisons"><Table><TableHeader><TableRow><TableHead>Karşılaştırma dönemi</TableHead><TableHead>Önceki değer</TableHead><TableHead>Değişim</TableHead></TableRow></TableHeader><TableBody>{queries.map((query,index) => {
      const previous = summaryMetric(query.data,code)
      const growth = metricGrowth(actual, previous)
      return <TableRow key={index}><TableCell><strong>{index === 0 ? 'Önceki ay' : 'Geçen yıl'}</strong><p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{dateLabel(periods[index]!.start, periods[index]!.end)}</p></TableCell><TableCell data-label="Önceki değer">{query.isPending ? <Skeleton className="tw:h-5 tw:w-16" /> : query.isError ? 'Yüklenemedi' : formatted(previous)}</TableCell><TableCell data-label="Değişim">{query.isError ? <Button variant="outline" onClick={() => void query.refetch()}>Tekrar dene</Button> : query.isPending ? 'Yükleniyor' : growth === null ? previous === 0 ? 'Önceki değer 0; yüzde hesaplanamaz' : 'Karşılaştırma verisi yok' : <Badge variant={growth < 0 ? 'destructive' : 'secondary'} className="manager-kpi-growth" data-trend={growth > 0 ? 'positive' : growth < 0 ? 'negative' : 'neutral'}>{growth > 0 ? <TrendingUp aria-hidden="true" /> : growth < 0 ? <TrendingDown aria-hidden="true" /> : <Minus aria-hidden="true" />}{growth > 0 ? '+' : growth < 0 ? '−' : ''}{Math.abs(growth).toLocaleString(model.locale,{maximumFractionDigits:2})}% {growth > 0 ? 'artış' : growth < 0 ? 'düşüş' : 'değişim'}</Badge>}</TableCell></TableRow>
    })}</TableBody></Table></div>
    <Alert className="manager-kpi-formula"><AlertDescription>{formulas[code]} Değişim yüzdesi, önceki değere göre hesaplanır. Gün ve aralık seçimleri önceki ayın ve yılın eşleşen tarihleriyle karşılaştırılır.</AlertDescription></Alert>
    {code === 'score' ? <Table className="manager-kpi-breakdown"><TableHeader><TableRow><TableHead>KPI</TableHead><TableHead>Skora katkı</TableHead></TableRow></TableHeader><TableBody>{model.rows.map(metric => <TableRow key={metric.kpiCode}><TableCell>{names[metric.kpiCode] ?? metric.kpiName}</TableCell><TableCell>{metric.scoreContribution == null ? 'Veri yok' : `${metric.scoreContribution.toLocaleString(model.locale,{maximumFractionDigits:2})} puan`}</TableCell></TableRow>)}</TableBody></Table> : <p className="tw:text-xs tw:text-muted-foreground">{row?.scoreContribution == null ? 'Skor katkısı için yeterli veri yok.' : `Mağaza skoruna katkısı: ${row.scoreContribution.toLocaleString(model.locale,{maximumFractionDigits:2})} puan.`} Eşit değerler aynı sırayı paylaşır; sıralama verisi olan mağazalar arasında hesaplanır.</p>}
  </DialogContent></Dialog>
}
