import { Toaster } from '@/components/ui/sonner'

export function HrAxisToaster() {
  return (
    <Toaster
      closeButton
      containerAriaLabel="Bildirimler"
      richColors={false}
      position="bottom-right"
      visibleToasts={3}
      duration={3600}
      offset={{
        right: 'var(--hr-axis-toast-right)',
        bottom: 'var(--hr-axis-toast-bottom)',
      }}
      mobileOffset={{
        left: 'var(--hr-axis-toast-mobile-x)',
        right: 'var(--hr-axis-toast-mobile-x)',
        bottom: 'var(--hr-axis-toast-mobile-bottom)',
      }}
      toastOptions={{
        closeButtonAriaLabel: 'Bildirimi kapat',
        classNames: {
          toast: 'hr-axis-toast',
          title: 'hr-axis-toast__title',
          description: 'hr-axis-toast__description',
          actionButton: 'hr-axis-toast__action',
          cancelButton: 'hr-axis-toast__cancel',
          closeButton: 'hr-axis-toast__close',
          success: 'hr-axis-toast--success',
          error: 'hr-axis-toast--error',
          info: 'hr-axis-toast--info',
          warning: 'hr-axis-toast--warning',
          loading: 'hr-axis-toast--loading',
        },
      }}
    />
  )
}
