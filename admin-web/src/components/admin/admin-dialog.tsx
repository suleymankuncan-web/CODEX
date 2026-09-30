import { useRef, type ComponentProps } from 'react'
import { DialogContent, DialogFooter, DialogHeader } from '../ui/dialog'
import { SelectContent } from '../ui/select'
import './admin-dialog.css'

// Opt in only on administrative forms; other dialogs retain their own layout.
export function AdminDialogContent({ onOpenAutoFocus, onCloseAutoFocus, ...props }: ComponentProps<typeof DialogContent>) {
  const opener = useRef<HTMLElement | null>(null)
  const fallback = useRef<HTMLElement | null>(null)

  return <DialogContent {...props} data-admin-dialog=""
    onOpenAutoFocus={(event) => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      fallback.current = opener.current?.closest<HTMLElement>('main') ?? null
      onOpenAutoFocus?.(event)
    }}
    onCloseAutoFocus={(event) => {
      onCloseAutoFocus?.(event)
      if (event.defaultPrevented) return
      event.preventDefault()
      const target = opener.current
      if (target?.isConnected && !target.matches(':disabled, [aria-disabled="true"]') && target.getClientRects().length) {
        target.focus({ preventScroll: true })
      } else if (fallback.current?.isConnected) {
        fallback.current.focus({ preventScroll: true })
      }
    }}
  />
}

export function AdminDialogHeader(props: ComponentProps<typeof DialogHeader>) {
  return <DialogHeader {...props} />
}

export function AdminDialogBody(props: ComponentProps<'div'>) {
  return <div {...props} data-admin-dialog-body="" />
}

export function AdminDialogFooter(props: ComponentProps<typeof DialogFooter>) {
  return <DialogFooter {...props} />
}

export function AdminSelectContent(props: ComponentProps<typeof SelectContent>) {
  return <SelectContent position="popper" {...props} data-admin-select="" />
}
