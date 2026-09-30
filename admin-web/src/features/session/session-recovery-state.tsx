import { Button } from '../../components/ui/button'
import { useLocalization } from '../localization/useLocalization'

export function SessionRecoveryState({ onRetry }: { onRetry: () => void }) {
  const { locale } = useLocalization()
  const tr = locale === 'tr'
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="max-w-md space-y-4 rounded-xl border bg-card p-6" role="alert">
        <h1 className="text-lg font-semibold">{tr ? 'Oturum doğrulanamıyor' : 'Session verification is unavailable'}</h1>
        <p className="text-sm text-muted-foreground">{tr
          ? 'Bağlantı yeniden kurulunca bu sayfadan devam edebilirsiniz.'
          : 'You can continue on this page when the connection is restored.'}</p>
        <Button className="min-h-11" onClick={onRetry}>{tr ? 'Yeniden dene' : 'Retry'}</Button>
      </section>
    </main>
  )
}
