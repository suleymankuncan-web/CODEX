import * as React from 'react'

import { cn } from '@/lib/utils'
import { Badge } from './badge'
import { statusBadgeToneClasses, type StatusBadgeTone } from './status-badge-model'
type StatusBadgeProps = Omit<React.ComponentProps<typeof Badge>, 'variant'> & {
  tone?: StatusBadgeTone
}

function StatusBadge({ className, tone = 'neutral', ...props }: StatusBadgeProps) {
  return (
    <Badge
      className={cn('tw:rounded-md tw:font-semibold', statusBadgeToneClasses[tone], className)}
      data-tone={tone}
      variant="outline"
      {...props}
    />
  )
}

export { StatusBadge, type StatusBadgeProps, type StatusBadgeTone }
