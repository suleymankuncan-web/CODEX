import { ClipboardList } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricCard,
  StatusPill,
} from '../components/dashboard-primitives'

export function AdminChecklistTemplatesPage() {
  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Checklistler</div>
          <h2 className="hero-title">HR şablonları, yayınlanmadan önce taslak olarak hazırlanır.</h2>
          <p className="hero-copy">
            Bu pilot yüzey şablon sahipliğini HR tarafında tutar; yayınlama ve ağırlık kontrolü
            backend güvenlik kapılarından geçer.
          </p>
        </div>
        <div className="hero-metrics">
          <StatusPill tone="warning">Taslak pilot</StatusPill>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          title="Şablon durumu"
          value={1}
          note="Versiyonlu checklist şablon omurgası backend tarafında hazır."
          icon={<ClipboardList size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Yayın kuralı"
          value={100}
          note="Kalem ağırlıkları toplamı 100 olmadan yayın kapısı açılmaz."
          icon={<ClipboardList size={18} />}
          tone="calm"
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Şablon Taslağı</div>
            <h3>HR checklist şablon yönetimi</h3>
          </div>
          <StatusPill tone="accent">Kontrollü</StatusPill>
        </div>
        <div className="key-grid">
          <KeyValue label="Şablon tipi" value="BM_STORE_VISIT" />
          <KeyValue label="Cevap tipi" value="Puanlama" />
          <KeyValue label="Yayın kontrolü" value="Ağırlık toplamı 100" />
          <KeyValue label="Sonraki bağ" value="Tam form editörü" />
        </div>
        <EmptyState
          title="Form editörü sıradaki küçük parça"
          copy="Bu ekran şimdilik route ve bilgi mimarisini açar; detaylı editör kontrollü şekilde ayrıca eklenecek."
        />
      </section>
    </section>
  )
}
