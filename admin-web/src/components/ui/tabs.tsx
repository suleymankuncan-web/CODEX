import * as React from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      className={cn('tw:flex tw:flex-col', className)}
      data-slot="tabs"
      {...props}
    />
  )
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'tw:flex tw:h-12 tw:items-end tw:gap-6 tw:border-b tw:border-border tw:px-4 tw:text-muted-foreground tw:sm:px-5',
        className,
      )}
      data-slot="tabs-list"
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'tw:relative tw:inline-flex tw:h-12 tw:min-w-24 tw:appearance-none tw:items-center tw:justify-center tw:gap-2 tw:border-0 tw:border-b-2 tw:border-transparent tw:bg-transparent tw:px-1 tw:text-sm tw:font-medium tw:whitespace-nowrap tw:text-muted-foreground tw:transition-colors tw:outline-none tw:hover:text-foreground tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:ring-offset-2 tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:data-[state=active]:border-primary tw:data-[state=active]:text-foreground',
        className,
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('tw:outline-none', className)}
      data-slot="tabs-content"
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
