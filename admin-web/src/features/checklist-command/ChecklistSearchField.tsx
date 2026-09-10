import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import './checklist-search-field.css'

export function ChecklistSearchField({ label, placeholder = label, value, onChange, count, maxLength, testId }: {
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  count?: number | undefined
  maxLength?: number
  testId?: string
}) {
  return <InputGroup className="checklist-search-field" data-testid={testId}>
    <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
    <InputGroupInput aria-label={label} placeholder={placeholder} value={value} maxLength={maxLength} onChange={event => onChange(event.target.value)} />
    {count !== undefined ? <InputGroupAddon align="inline-end"><Badge variant="secondary">{count}</Badge></InputGroupAddon> : null}
  </InputGroup>
}
