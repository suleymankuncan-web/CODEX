import type { ReactNode } from 'react'
import { toast, type ExternalToast } from 'sonner'
import { getUserFacingErrorMessage } from './format'

type ActionToastOptions = ExternalToast
type ActionToastMessage = string | ReactNode

const defaultDurationMs = 3600
const errorDurationMs = 5200

function withDefaultDuration(options?: ActionToastOptions): ActionToastOptions {
  return {
    duration: defaultDurationMs,
    ...options,
  }
}

export function toastErrorFromUnknown(error: unknown, fallbackMessage: string) {
  return getUserFacingErrorMessage(error, fallbackMessage)
}

export const actionToast = {
  success(message: ActionToastMessage, options?: ActionToastOptions) {
    return toast.success(message, withDefaultDuration(options))
  },

  error(error: unknown, fallbackMessage: string, options?: ActionToastOptions) {
    return toast.error(toastErrorFromUnknown(error, fallbackMessage), {
      duration: errorDurationMs,
      ...options,
    })
  },

  info(message: ActionToastMessage, options?: ActionToastOptions) {
    return toast.info(message, withDefaultDuration(options))
  },

  warning(message: ActionToastMessage, options?: ActionToastOptions) {
    return toast.warning(message, withDefaultDuration(options))
  },

  loading(message: ActionToastMessage, options?: ActionToastOptions) {
    return toast.loading(message, options)
  },

  promise: toast.promise,
  dismiss: toast.dismiss,
}
