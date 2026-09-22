import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Layers3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { StoreHomeCommandFilter, StoreHomeCommandModel } from './store-home-command-model'

export function StoreHomeCommandView(input: { model: StoreHomeCommandModel }) {
  const [activeFilter, setActiveFilter] = useState<StoreHomeCommandFilter>('all')
  const visiblePriorities = useMemo(() => {
    if (activeFilter === 'all') return input.model.priorities
    if (activeFilter === 'attention') {
      return input.model.priorities.filter((item) =>
        item.needsAttention || item.state === 'loading' || item.state === 'unavailable',
      )
    }
    return input.model.priorities.filter((item) => item.category === activeFilter)
  }, [activeFilter, input.model.priorities])

  const resetFilter = () => setActiveFilter('all')

  return (
    <section
      aria-labelledby="store-home-ops-title"
      className="store-command-home store-home-ops"
      data-testid="store-home-command"
    >
      <div className="store-home-command-content" data-testid="store-home-dashboard">
        <header className="sh-dashboard-header">
          <div className="sh-dashboard-heading">
            <span className="sh-dashboard-eyebrow">Ana Sayfa</span>
            <h1 id="store-home-ops-title">Operasyon Paneli</h1>
            <p>{input.model.identityLabel} için bugünün çalışma özeti.</p>
          </div>
          <div className="sh-dashboard-context" aria-label="Sayfa bağlamı">
            <Badge variant="secondary">{input.model.personaLabel}</Badge>
            <span>
              <CalendarDays size={15} aria-hidden="true" />
              {input.model.periodLabel}
            </span>
          </div>
        </header>

        <section className="sh-metrics" aria-label="Operasyon özeti">
          {input.model.metrics.map((metric) => {
            const selected = metric.filter !== undefined && activeFilter === metric.filter
            const content = (
              <>
                <span className="sh-metric-icon" aria-hidden="true">{metric.icon}</span>
                <span className="sh-metric-copy">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.note}</small>
                </span>
              </>
            )

            return metric.filter ? (
              <button
                aria-pressed={selected}
                className={`sh-metric sh-tone-${metric.tone}${selected ? ' is-selected' : ''}`}
                key={metric.id}
                onClick={() => setActiveFilter(selected ? 'all' : metric.filter!)}
                type="button"
              >
                {content}
              </button>
            ) : (
              <article className={`sh-metric sh-tone-${metric.tone}`} key={metric.id}>{content}</article>
            )
          })}
        </section>

        <div className="sh-dashboard-grid">
          <section className="sh-dashboard-panel sh-agenda-panel" aria-labelledby="store-home-agenda-title">
            <div className="sh-section-head">
              <div>
                <h2 id="store-home-agenda-title">Bugünün gündemi</h2>
                <p>Kontrol veya karar bekleyen işler.</p>
              </div>
              <Badge variant="outline">{visiblePriorities.length} kayıt</Badge>
            </div>

            {input.model.hasPartialData ? (
              <div className="sh-partial-state" role="status">
                Bazı özetler şu anda görüntülenemiyor. Kullanılabilir bilgiler gösteriliyor.
              </div>
            ) : null}

            <div className="sh-agenda-list">
              {visiblePriorities.length ? visiblePriorities.map((priority) => (
                <article className={`sh-agenda-row sh-tone-${priority.tone}`} data-testid={priority.testId} key={priority.id}>
                  <span className="sh-source-icon" aria-hidden="true">{priority.icon}</span>
                  <div className="sh-agenda-copy">
                    <div>
                      <span>{priority.source}</span>
                      <Badge variant="outline">{priority.status}</Badge>
                    </div>
                    <h3>{priority.title}</h3>
                    <p>{priority.detail}</p>
                  </div>
                  <div className="sh-agenda-action">
                    <strong>{priority.meta}</strong>
                    <Button asChild size="sm" variant="outline">
                      <Link to={priority.href}>
                        {priority.cta}
                        <ArrowRight data-icon="inline-end" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </article>
              )) : (
                <div className="sh-dashboard-empty">
                  <CheckCircle2 size={21} aria-hidden="true" />
                  <div>
                    <strong>{activeFilter === 'all' ? 'Bugün bekleyen iş yok' : 'Bu başlıkta bekleyen iş yok'}</strong>
                    <span>Yeni bir işlem oluştuğunda burada görünecek.</span>
                  </div>
                  {activeFilter !== 'all' ? (
                    <Button size="sm" variant="ghost" onClick={resetFilter}>Tümünü göster</Button>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          <aside className="sh-dashboard-panel sh-workspace-panel" aria-labelledby="store-home-workspaces-title">
            <div className="sh-section-head">
              <div>
                <h2 id="store-home-workspaces-title">Çalışma alanları</h2>
                <p>Sık kullandığınız sayfalara geçin.</p>
              </div>
              <Layers3 size={18} aria-hidden="true" />
            </div>
            <nav className="sh-workspace-links" aria-label="Çalışma alanları">
              {input.model.quickLinks.map((link) => (
                <Link key={link.id} to={link.href}>
                  <span aria-hidden="true">{link.icon}</span>
                  <strong>{link.label}</strong>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      </div>
    </section>
  )
}
