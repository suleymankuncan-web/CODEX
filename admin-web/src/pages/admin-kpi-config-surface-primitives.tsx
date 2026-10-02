import { useId, type ReactNode } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion'
import { Checkbox } from '../components/ui/checkbox'
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
  return <div className="tw:grid tw:divide-y tw:divide-border">{children}</div>
}

function KpiConfigFieldGrid({ children }: { children: ReactNode }) {
  return <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:lg:grid-cols-3">{children}</div>
}

function KpiConfigEditorRow(input: {
  'aria-label': string
  actions?: ReactNode
  children: ReactNode
  className?: string
  summary?: ReactNode
  initiallyOpen?: boolean
}) {
  const content = (
    <div className="tw:grid tw:gap-3 tw:py-3">
      {input.children}
      {input.actions ? <AdminActionRow className="tw:justify-end">{input.actions}</AdminActionRow> : null}
    </div>
  )
  return (
    <div
      aria-label={input['aria-label']}
      className={cn('tw:min-w-0', input.className)}
      role="group"
    >
      {input.summary ? (
        <Accordion
          type="single"
          collapsible
          defaultValue={input.initiallyOpen ? 'editor' : ''}
          className="tw:[&_h3]:m-0 tw:[&_h3]:text-sm tw:[&_h3]:font-medium"
        >
          <AccordionItem value="editor">
            <AccordionTrigger className="tw:min-h-16 tw:items-center tw:gap-3 tw:bg-transparent">
              {input.summary}
            </AccordionTrigger>
            <AccordionContent>{content}</AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : content}
    </div>
  )
}

function KpiConfigRowSummary({ title, detail, value }: { title: string; detail?: string; value?: ReactNode }) {
  return (
    <span className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:justify-between tw:gap-3">
      <span className="tw:grid tw:min-w-0 tw:gap-1">
        <span className="tw:break-words tw:text-foreground">{title}</span>
        {detail ? <span className="tw:text-xs tw:font-normal tw:text-muted-foreground">{detail}</span> : null}
      </span>
      {value !== undefined ? <span className="tw:shrink-0 tw:text-sm tw:tabular-nums">{value}</span> : null}
    </span>
  )
}

function MultiChoiceField(input: {
  label: string
  value: string[]
  options: string[]
  optionLabel: (option: string) => string
  onChange: (next: string[]) => void
}) {
  const id = useId()
  return (
    <fieldset className="tw:m-0 tw:min-w-0 tw:border-0 tw:p-0 tw:lg:col-span-3">
      <legend className="tw:mb-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground">{input.label}</legend>
      <div className="tw:flex tw:flex-wrap tw:gap-x-4">
        {input.options.map((option, index) => (
          <label
            key={option}
            htmlFor={`${id}-${index}`}
            className="tw:flex tw:min-h-11 tw:cursor-pointer tw:items-center tw:gap-2 tw:text-sm"
          >
            <Checkbox
              id={`${id}-${index}`}
              checked={input.value.includes(option)}
              onCheckedChange={checked => input.onChange(
                checked ? [...input.value, option] : input.value.filter(value => value !== option),
              )}
            />
            {input.optionLabel(option)}
          </label>
        ))}
      </div>
    </fieldset>
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
        <Input id={id} className="tw:min-h-11 tw:sm:min-h-10" value={input.value} onChange={(event) => input.onChange(event.target.value)} />
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
        className="tw:min-h-11 tw:sm:min-h-10"
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
        <SelectTrigger id={id} aria-label={input.label} className="tw:w-full tw:min-h-11 tw:sm:min-h-10">
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
  KpiConfigRowSummary,
  MultiChoiceField,
  NumberField,
  SelectField,
  TextField,
}
