import { ArrowLeft, CalendarDays } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type StoreMyPerformanceTopbarProps = {
  employeeHeading: string
  introCopy: string
  onReturn?: () => void
  periodLabel: string
  returnLabel?: string
}

export function StoreMyPerformanceTopbar({
  employeeHeading,
  introCopy,
  onReturn,
  periodLabel,
  returnLabel,
}: StoreMyPerformanceTopbarProps) {
  return (
    <header className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-start tw:md:justify-between">
      <div className="tw:grid tw:min-w-0 tw:gap-2">
        {onReturn && returnLabel ? (
          <Button
            type="button"
            variant="outline"
            className="tw:w-fit"
            onClick={onReturn}
          >
            <ArrowLeft data-icon="inline-start" />
            {returnLabel}
          </Button>
        ) : null}
        <h1 className="tw:text-2xl tw:font-medium tw:leading-tight tw:text-foreground tw:md:text-4xl">
          {employeeHeading}
        </h1>
        <p className="tw:max-w-3xl tw:text-sm tw:leading-6 tw:text-muted-foreground">
          {introCopy}
        </p>
      </div>
      <Badge
        variant="secondary"
        className="tw:h-auto tw:min-h-8 tw:self-start tw:px-3"
        data-testid="store-me-period-pill"
      >
        <CalendarDays data-icon="inline-start" />
        {periodLabel}
      </Badge>
    </header>
  )
}
