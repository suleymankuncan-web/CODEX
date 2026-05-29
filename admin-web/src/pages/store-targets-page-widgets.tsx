import type { ReactNode } from 'react'
import { BadgeCheck, CheckCheck, FilePenLine, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TargetWorkflowTab } from './store-targets-page-model'

type TargetMetricTileTone = 'plum' | 'cyan' | 'amber' | 'rose'

export function TargetMetricTile(input: {
  icon: ReactNode
  label: string
  note: string
  tone: TargetMetricTileTone
  value: string
}) {
  return (
    <article className="tw:min-h-32 tw:rounded-lg tw:border tw:border-border/80 tw:bg-white/80 tw:p-4 tw:shadow-[0_14px_38px_rgba(23,30,58,0.06)] tw:backdrop-blur">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
        <span
          className={cn(
            'tw:grid tw:size-10 tw:place-items-center tw:rounded-lg',
            metricTileToneClasses[input.tone].icon,
          )}
        >
          {input.icon}
        </span>
        <span
          className={cn(
            'tw:rounded-full tw:px-2.5 tw:py-1 tw:text-xs tw:font-medium',
            metricTileToneClasses[input.tone].chip,
          )}
        >
          {input.label}
        </span>
      </div>
      <div className="tw:mt-4 tw:text-3xl tw:font-semibold tw:leading-none tw:text-foreground">
        {input.value}
      </div>
      <p className="tw:mt-2 tw:text-xs tw:font-medium tw:leading-5 tw:text-muted-foreground">
        {input.note}
      </p>
    </article>
  )
}

export function TargetWorkflowTabIcon(input: { tab: TargetWorkflowTab }) {
  switch (input.tab) {
    case 'approval':
      return <BadgeCheck data-icon="inline-start" />
    case 'distribution':
      return <Send data-icon="inline-start" />
    case 'revision':
      return <FilePenLine data-icon="inline-start" />
    case 'approved':
      return <CheckCheck data-icon="inline-start" />
  }
}

const metricTileToneClasses: Record<TargetMetricTileTone, { icon: string; chip: string }> = {
  plum: {
    icon: 'tw:bg-primary/10 tw:text-primary',
    chip: 'tw:bg-primary/10 tw:text-primary',
  },
  cyan: {
    icon: 'tw:bg-accent/15 tw:text-accent-foreground',
    chip: 'tw:bg-accent/15 tw:text-accent-foreground',
  },
  amber: {
    icon: 'tw:bg-chart-4/15 tw:text-chart-4',
    chip: 'tw:bg-chart-4/15 tw:text-foreground',
  },
  rose: {
    icon: 'tw:bg-destructive/10 tw:text-destructive',
    chip: 'tw:bg-destructive/10 tw:text-destructive',
  },
}
