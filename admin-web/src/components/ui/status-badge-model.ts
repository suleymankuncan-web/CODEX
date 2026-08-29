const statusBadgeToneClasses = {
  danger: 'tw:border-destructive/25 tw:bg-destructive/10 tw:text-destructive',
  info: 'tw:border-primary/25 tw:bg-primary/10 tw:text-primary',
  neutral: 'tw:border-border tw:bg-muted/45 tw:text-muted-foreground',
  success: 'tw:border-success/25 tw:bg-success-soft tw:text-success-foreground',
  warning: 'tw:border-warning/25 tw:bg-warning-soft tw:text-warning-foreground',
} as const

type StatusBadgeTone = keyof typeof statusBadgeToneClasses

export { statusBadgeToneClasses, type StatusBadgeTone }
