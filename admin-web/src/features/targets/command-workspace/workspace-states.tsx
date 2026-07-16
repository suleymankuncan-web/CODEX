import { AlertTriangle, LoaderCircle, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocalization } from '@/features/localization/useLocalization'
import { getTargetCommandCopy } from './copy'

export function TargetCommandLoading() {
  const { locale } = useLocalization()
  const copy = getTargetCommandCopy(locale)
  return <div className="target-command-state" role="status"><LoaderCircle className="target-command-spin" /><h1>{copy.loadingTitle}</h1><p>{copy.loadingCopy}</p></div>
}

export function TargetCommandFailure(input: { onRetry: () => void }) {
  const { locale } = useLocalization()
  const copy = getTargetCommandCopy(locale)
  return <div className="target-command-state" role="alert"><AlertTriangle /><h1>{copy.requestFailed}</h1><p>{copy.failureCopy}</p><Button onClick={input.onRetry}><Target />{copy.retry}</Button></div>
}
