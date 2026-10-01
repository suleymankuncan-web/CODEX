import { Button } from '../../components/ui/button'
import { useLocalization } from '../localization/useLocalization'

export function SessionRecoveryState({ onRetry }: { onRetry: () => void }) {
  const { locale } = useLocalization()
  const tr = locale === 'tr'
  return (
    <main className="tw:flex tw:min-h-dvh tw:items-center tw:justify-center tw:bg-background tw:p-6">
      <section className="tw:w-full tw:max-w-md tw:space-y-4 tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-6" role="alert">
        <h1 className="tw:m-0 tw:text-lg tw:font-semibold">{tr ? 'Oturum doğrulanamıyor' : 'Session verification is unavailable'}</h1>
        <p className="tw:text-sm tw:text-muted-foreground">{tr
          ? 'Bağlantı yeniden kurulunca bu sayfadan devam edebilirsiniz.'
          : 'You can continue on this page when the connection is restored.'}</p>
        <Button className="tw:min-h-11" onClick={onRetry}>{tr ? 'Yeniden dene' : 'Retry'}</Button>
      </section>
    </main>
  )
}
