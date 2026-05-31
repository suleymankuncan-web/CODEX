import { useId, type ReactNode } from 'react'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import { AdminActionRow } from './admin-surface-primitives'
import { cn } from '../lib/utils'

function KpiConfigRowList({ children }: { children: ReactNode }) {
  return <div className="tw:grid tw:gap-3">{children}</div>
}

function KpiConfigFieldGrid({ children }: { children: ReactNode }) {
  return <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:lg:grid-cols-3">{children}</div>
}

function KpiConfigEditorRow(input: {
  'aria-label': string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card
      aria-label={input['aria-label']}
      className={cn('tw:border tw:border-border tw:bg-background/60 tw:shadow-none', input.className)}
      role="group"
      size="sm"
    >
      <CardContent className="tw:grid tw:gap-3">
        {input.children}
        {input.actions ? <AdminActionRow className="tw:justify-end">{input.actions}</AdminActionRow> : null}
      </CardContent>
    </Card>
  )
}

function KpiConfigMutedText({ children }: { children: ReactNode }) {
  return <p className="tw:m-0 tw:text-sm tw:leading-6 tw:text-muted-foreground">{children}</p>
}

function TextField(input: {
  label: string
  multiline?: boolean
  value: string
  onChange: (next: string) => void
}) {
  const id = useId()

  return (
    <div className="tw:grid tw:gap-1.5">
      <label className="tw:text-xs tw:font-medium tw:text-muted-foreground" htmlFor={id}>
        {input.label}
      </label>
      {input.multiline ? (
        <Textarea
          id={id}
          value={input.value}
          className="tw:min-h-16"
          onChange={(event) => input.onChange(event.target.value)}
        />
      ) : (
        <Input id={id} value={input.value} onChange={(event) => input.onChange(event.target.value)} />
      )}
    </div>
  )
}

function NumberField(input: {
  label: string
  value: number
  onChange: (next: number) => void
}) {
  const id = useId()

  return (
    <div className="tw:grid tw:gap-1.5">
      <label className="tw:text-xs tw:font-medium tw:text-muted-foreground" htmlFor={id}>
        {input.label}
      </label>
      <Input
        id={id}
        type="number"
        value={Number.isFinite(input.value) ? input.value : ''}
        onChange={(event) => {
          const nextValue = event.target.value
          input.onChange(nextValue.trim() === '' ? Number.NaN : Number(nextValue))
        }}
      />
    </div>
  )
}

function SelectField(input: {
  label: string
  value: string
  options: string[]
  optionLabel?: (option: string) => string
  onChange: (next: string) => void
}) {
  const id = useId()

  return (
    <div className="tw:grid tw:gap-1.5">
      <label className="tw:text-xs tw:font-medium tw:text-muted-foreground" htmlFor={id}>
        {input.label}
      </label>
      <Select value={input.value} onValueChange={input.onChange}>
        <SelectTrigger id={id} aria-label={input.label} className="tw:w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {input.options.map((option) => (
              <SelectItem key={option} value={option}>
                {input.optionLabel ? input.optionLabel(option) : option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export {
  KpiConfigEditorRow,
  KpiConfigFieldGrid,
  KpiConfigMutedText,
  KpiConfigRowList,
  NumberField,
  SelectField,
  TextField,
}
