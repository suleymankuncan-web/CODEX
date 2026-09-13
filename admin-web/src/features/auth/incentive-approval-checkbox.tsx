import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'

export function IncentiveApprovalCheckbox({ checked, disabled, onChange }: {
  checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void
}) {
  const id = useId()
  return <Field orientation="horizontal" data-disabled={disabled}>
    <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} />
    <FieldContent>
      <FieldLabel htmlFor={id}>Prim Onayı</FieldLabel>
      <FieldDescription>Yalnızca bu kullanıcı, bu rolün şirket kapsamında bölge müdürünün gönderdiği primlere final onay verebilir.</FieldDescription>
    </FieldContent>
  </Field>
}
