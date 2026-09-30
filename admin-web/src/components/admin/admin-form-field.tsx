import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { Label } from '../ui/label'
import { Select, SelectTrigger } from '../ui/select'

type ControlProps = { id?: string; 'aria-describedby'?: string; children?: ReactNode }

export function AdminFormField({ children, className, description, error, label }: {
  children: ReactElement<ControlProps>
  className?: string
  description?: string | undefined
  error?: string | undefined
  label: string
}) {
  const generatedId = useId()
  const trigger = children.type === Select
    ? Children.toArray(children.props.children).find((child) => isValidElement<ControlProps>(child) && child.type === SelectTrigger)
    : children
  const control = isValidElement<ControlProps>(trigger) ? trigger : children
  const id = control.props.id ?? generatedId
  const describedBy = [control.props['aria-describedby'], description ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  const controlProps = { id, ...(describedBy ? { 'aria-describedby': describedBy } : {}) }
  const labelledControl = children.type === Select
    ? cloneElement(children, {}, Children.map(children.props.children, (child) =>
      isValidElement<ControlProps>(child) && child.type === SelectTrigger ? cloneElement(child, controlProps) : child))
    : cloneElement(children, controlProps)

  return <div className={className} data-admin-field="">
    <Label className="tw:mb-1.5" htmlFor={id}>{label}</Label>
    {labelledControl}
    {description ? <p className="tw:mt-1.5 tw:mb-0 tw:text-xs tw:text-muted-foreground" id={`${id}-hint`}>{description}</p> : null}
    {error ? <p className="tw:mt-1.5 tw:mb-0 tw:text-xs tw:text-destructive" id={`${id}-error`}>{error}</p> : null}
  </div>
}
