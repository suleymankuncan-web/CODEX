import { useRef, useState } from 'react'
import { Download, LoaderCircle } from 'lucide-react'
import { Button } from '../components/ui/button'
import type { ChecklistAcknowledgementItem } from '../features/checklists/api'
import type { AppLocale } from '../lib/i18n'
import { getStaticCopy } from './store-checklists-logic'
import fontUrl from '../assets/pdf/dm-sans.ttf?url'

export function ChecklistResultDownload({ item, locale }: { item: ChecklistAcknowledgementItem; locale: AppLocale }) {
  const busy = useRef(false)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const copy = (tr: string, en: string) => getStaticCopy(locale, tr, en)
  async function download() {
    if (busy.current) return
    busy.current = true
    setState('loading')
    try {
      const [{ createChecklistResultPdf }, fontResponse] = await Promise.all([
        import('./store-checklists-result-pdf'),
        fetch(fontUrl, { signal: AbortSignal.timeout(20_000) }),
      ])
      if (!fontResponse.ok) throw new Error('PDF font unavailable')
      const bytes = await createChecklistResultPdf({ item, locale, fontBytes: new Uint8Array(await fontResponse.arrayBuffer()), exportedAt: new Date() })
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      const storeName = item.storeName.replace(/[<>:"/\\|?*\p{Cc}]/gu, '-').slice(0, 80)
      link.download = `Checklist-${storeName}-${item.completedAt?.slice(0, 10) ?? 'sonuc'}.pdf`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      setState('idle')
    } catch {
      setState('error')
    } finally {
      busy.current = false
    }
  }
  return <div className="store-checklist-result-download">
    {state === 'error' ? <span role="alert">{copy('PDF hazırlanamadı. Tekrar deneyin.', 'Could not prepare the PDF. Please retry.')}</span> : null}
    <Button disabled={state === 'loading'} size="sm" type="button" variant="outline" onClick={() => void download()}>
      {state === 'loading' ? <LoaderCircle className="tw:animate-spin" /> : <Download />}
      {state === 'loading' ? copy('PDF hazırlanıyor…', 'Preparing PDF…') : copy('PDF indir', 'Download PDF')}
    </Button>
  </div>
}
