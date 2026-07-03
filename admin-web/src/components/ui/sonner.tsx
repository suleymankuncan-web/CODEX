import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps) {
  return <SonnerToaster {...props} />
}

export { Toaster }
export type { ToasterProps }
