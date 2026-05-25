import { cn } from '@/lib/utils'

export function ShadcnTailwindProof() {
  return (
    <section
      className={cn(
        'tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-4 tw:text-card-foreground tw:shadow-sm',
      )}
    >
      <p className="tw:text-sm tw:font-medium">shadcn/Tailwind proof surface</p>
      <p className="tw:text-xs tw:text-muted-foreground">
        Prefixed Tailwind utilities compile without Tailwind preflight.
      </p>
    </section>
  )
}
