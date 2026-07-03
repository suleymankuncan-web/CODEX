import { useEffect } from 'react'

const toastSheetOpenClassName = 'hr-axis-toast-sheet-open'

export function useToastViewportOffset(isOffset: boolean) {
  useEffect(() => {
    if (!isOffset) return undefined

    document.body.classList.add(toastSheetOpenClassName)

    return () => {
      document.body.classList.remove(toastSheetOpenClassName)
    }
  }, [isOffset])
}
