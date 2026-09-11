import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

export function KpiScoreChart({ data, locale, label }: {
  data: Array<{ month: string; score: number | null }>
  locale: string
  label: string
}) {
  return <ChartContainer config={{ score: { label, color: 'var(--primary)' } }} className="tw:h-64 tw:w-full">
    <BarChart accessibilityLayer data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
      <YAxis tickLine={false} axisLine={false} width={36} domain={[0, 140]} ticks={[0, 35, 70, 105, 140]} />
      <ChartTooltip content={<ChartTooltipContent />} />
      <Bar dataKey="score" fill="var(--color-score)" radius={4} maxBarSize={42} isAnimationActive={false}>
        <LabelList dataKey="score" position="insideTop" offset={10} fill="var(--primary-foreground)" fontSize={12} fontWeight={600} formatter={(value: unknown) => typeof value === 'number' ? value.toLocaleString(locale, { maximumFractionDigits: 1 }) : ''} />
      </Bar>
    </BarChart>
  </ChartContainer>
}
