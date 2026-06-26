import type { ReactNode } from 'react'
import { BadgeCheck, CheckCheck, FilePenLine, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TargetWorkflowTab } from './store-targets-page-model'

type TargetMetricTileTone = 'plum' | 'cyan' | 'amber' | 'rose'

export function TargetMetricTile(input: {
  icon: ReactNode
  label: string
  note: string
  testId?: string
  tone: TargetMetricTileTone
  value: string
}) {
  return (
    <article
      data-testid={input.testId}
      className={cn('targets-command-metric', metricTileToneClasses[input.tone].card)}
    >
      <div className="targets-command-metric-top">
        <span
          className={cn(
            'targets-command-metric-icon',
            metricTileToneClasses[input.tone].icon,
          )}
        >
          {input.icon}
        </span>
        <span
          className={cn(
            'targets-command-metric-chip',
            metricTileToneClasses[input.tone].chip,
          )}
        >
          {input.label}
        </span>
      </div>
      <div className="targets-command-metric-value">{input.value}</div>
      <p>{input.note}</p>
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

const metricTileToneClasses: Record<TargetMetricTileTone, { card: string; icon: string; chip: string }> = {
  plum: {
    card: 'is-plum',
    icon: 'tw:bg-primary/10 tw:text-primary',
    chip: 'tw:bg-primary/10 tw:text-primary',
  },
  cyan: {
    card: 'is-cyan',
    icon: 'tw:bg-accent/15 tw:text-accent-foreground',
    chip: 'tw:bg-accent/15 tw:text-accent-foreground',
  },
  amber: {
    card: 'is-amber',
    icon: 'tw:bg-chart-4/15 tw:text-chart-4',
    chip: 'tw:bg-chart-4/15 tw:text-foreground',
  },
  rose: {
    card: 'is-rose',
    icon: 'tw:bg-destructive/10 tw:text-destructive',
    chip: 'tw:bg-destructive/10 tw:text-destructive',
  },
}
