import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import { useLocalization } from '../localization/useLocalization'
import { getRateLimitErrorMessage, getRateLimitRemainingSeconds } from '../../lib/api-rate-limit'

export function SessionRecoveryState({ onRetry, error }: { onRetry: () => void; error?: unknown }) {
  const { locale } = useLocalization()
  const tr = locale === 'tr'
  const [remaining, setRemaining] = useState(() => getRateLimitRemainingSeconds(error))
  useEffect(() => {
    let timer: number | undefined
    const update = () => {
      const seconds = getRateLimitRemainingSeconds(error)
      setRemaining(seconds)
      if (seconds > 0) timer = window.setTimeout(update, 1000)
    }
    update()
    return () => window.clearTimeout(timer)
  }, [error])
  const waiting = getRateLimitRemainingSeconds(error) > 0
  const rateLimitCopy = getRateLimitErrorMessage(error, tr ? 'tr' : 'en') === null ? null : (tr
    ? `Kısa sürede çok fazla işlem yapıldı. ${waiting ? `${remaining} saniye bekleyip` : 'Oturumu yeniden doğrulamak için'} yeniden deneyin.`
    : `Too many actions in a short time. ${waiting ? `Wait ${remaining} seconds and try again.` : 'Retry to verify your session.'}`)
  return (
    <main className="tw:flex tw:min-h-dvh tw:items-center tw:justify-center tw:bg-background tw:p-6">
      <section className="tw:w-full tw:max-w-md tw:space-y-4 tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-6" role="alert">
        <h1 className="tw:m-0 tw:text-lg tw:font-semibold">{tr ? 'Oturum doğrulanamıyor' : 'Session verification is unavailable'}</h1>
        <p className="tw:text-sm tw:text-muted-foreground">{rateLimitCopy ?? (tr
          ? 'Bağlantı yeniden kurulunca bu sayfadan devam edebilirsiniz.'
          : 'You can continue on this page when the connection is restored.')}</p>
        <Button className="tw:min-h-11" disabled={waiting} onClick={() => {
          if (getRateLimitRemainingSeconds(error) === 0) onRetry()
        }}>{waiting
          ? (tr ? `${remaining} saniye sonra yeniden dene` : `Retry in ${remaining} seconds`)
          : (tr ? 'Yeniden dene' : 'Retry')}</Button>
      </section>
    </main>
  )
}
