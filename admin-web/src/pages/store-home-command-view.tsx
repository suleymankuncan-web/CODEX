import { ArrowRight, CalendarDays, Clock3, RefreshCcw, Store } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { StoreHomeCommandFilter, StoreHomeCommandModel } from './store-home-command-model'

const filters: Array<{ id: StoreHomeCommandFilter; label: string }> = [
  { id: 'all', label: 'Tümü' },
  { id: 'critical', label: 'Kritik' },
  { id: 'approval', label: 'Onay' },
  { id: 'announcement', label: 'Duyuru' },
]

export function StoreHomeCommandView(input: { model: StoreHomeCommandModel; onRefresh?: () => void }) {
  const [selectedId, setSelectedId] = useState(input.model.priorities[0]?.id ?? '')
  const [activeFilter, setActiveFilter] = useState<StoreHomeCommandFilter>('all')
  const visiblePriorities = useMemo(
    () =>
      activeFilter === 'all'
        ? input.model.priorities
        : input.model.priorities.filter((priority) => priority.filter === activeFilter),
    [activeFilter, input.model.priorities],
  )
  const selectedPriority = useMemo(
    () =>
      visiblePriorities.find((priority) => priority.id === selectedId) ??
      visiblePriorities[0] ??
      input.model.priorities[0] ??
      null,
    [input.model.priorities, selectedId, visiblePriorities],
  )

  return (
    <section
      aria-labelledby="store-home-ops-title"
      className="store-command-home store-home-ops"
      data-testid="store-home-command"
    >
      <div className="store-home-command-content" data-testid="store-home-dashboard">
        <header className="sh-command-bar">
          <div className="sh-kicker-row" aria-label="Sayfa bağlamı">
            <span className="sh-pill sh-pill-primary">
              <Store size={15} />
              Ana Sayfa
            </span>
            <span className="sh-pill">
              <CalendarDays size={15} />
              {input.model.periodLabel}
            </span>
            <span className="sh-pill">{input.model.personaLabel}</span>
          </div>
          <div className="sh-command-actions">
            <button className="sh-button sh-button-soft" type="button" onClick={input.onRefresh}>
              <RefreshCcw size={16} />
              Yenile
            </button>
            {selectedPriority ? (
              <Link className="sh-button sh-button-primary" to={selectedPriority.href}>
                Önceliğe git
                <ArrowRight size={16} />
              </Link>
            ) : null}
          </div>
        </header>

        <section className="sh-hero">
          <div>
            <h1 id="store-home-ops-title">Günlük Operasyon</h1>
          </div>
          <div className="sh-today-card" aria-label="Günün özeti">
            <Clock3 size={18} />
            <span>{input.model.todayTitle}</span>
            <strong>{input.model.todayNote}</strong>
          </div>
        </section>

        <section className="sh-metrics" aria-label="Günlük özet">
          {input.model.metrics.map((metric) => (
            <article className={`sh-metric sh-tone-${metric.tone}`} key={metric.id}>
              <span className="sh-icon" aria-hidden="true">
                {metric.icon}
              </span>
              <div>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.note}</small>
              </div>
            </article>
          ))}
        </section>

        <section className="sh-main-grid">
          <div className="sh-panel sh-priority-panel">
            <div className="sh-section-head">
              <div>
                <h2>Öncelik akışı</h2>
                <p>Modül gezmeden önce dikkat isteyen işler.</p>
              </div>
              <span className="sh-count">{input.model.priorities.length} iş</span>
            </div>

            <div className="sh-filter-row" aria-label="Hızlı filtreler">
              {filters.map((filter) => (
                <button
                  className={activeFilter === filter.id ? 'is-active' : undefined}
                  key={filter.id}
                  onClick={() => {
                    setActiveFilter(filter.id)
                    const firstPriority = filter.id === 'all'
                      ? input.model.priorities[0]
                      : input.model.priorities.find((priority) => priority.filter === filter.id)
                    if (firstPriority) setSelectedId(firstPriority.id)
                  }}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="sh-priority-list" role="list">
              {visiblePriorities.length ? (
                visiblePriorities.map((priority) => {
                  const isSelected = priority.id === selectedPriority?.id

                  return (
                    <button
                      className={`sh-priority-row sh-tone-${priority.tone}${isSelected ? ' is-selected' : ''}`}
                      data-testid={priority.testId}
                      key={priority.id}
                      onClick={() => setSelectedId(priority.id)}
                      type="button"
                    >
                      <span className="sh-source-icon" aria-hidden="true">
                        {priority.icon}
                      </span>
                      <span className="sh-priority-copy">
                        <small>{priority.source}</small>
                        <strong>{priority.title}</strong>
                        <em>{priority.meta}</em>
                      </span>
                      <span className="sh-status">{priority.status}</span>
                    </button>
                  )
                })
              ) : (
                <div className="sh-empty-state">Bu filtrede bekleyen iş yok.</div>
              )}
            </div>
          </div>

          <aside className="sh-panel sh-detail-panel" aria-label="Seçili öncelik">
            {selectedPriority ? (
              <>
                <div className={`sh-detail-hero sh-tone-${selectedPriority.tone}`}>
                  <span className="sh-icon" aria-hidden="true">
                    {selectedPriority.icon}
                  </span>
                  <div>
                    <span>{selectedPriority.source}</span>
                    <h2>{selectedPriority.title}</h2>
                  </div>
                </div>
                <p>{selectedPriority.detail}</p>
                <div className="sh-evidence-grid">
                  <div>
                    <span>Durum</span>
                    <strong>{selectedPriority.status}</strong>
                  </div>
                  <div>
                    <span>Zaman</span>
                    <strong>{selectedPriority.meta}</strong>
                  </div>
                  <div>
                    <span>Bağlı sayfa</span>
                    <strong>{selectedPriority.routeLabel}</strong>
                  </div>
                </div>
                <Link className="sh-button sh-button-primary sh-detail-action" to={selectedPriority.href}>
                  {selectedPriority.cta}
                  <ArrowRight size={16} />
                </Link>
              </>
            ) : (
              <p>Bugün bekleyen iş yok.</p>
            )}
          </aside>
        </section>

        <section className="sh-bottom-grid">
          <div className="sh-panel sh-announcement-panel">
            <div className="sh-section-head">
              <div>
                <h2>Duyurular</h2>
                <p>Sabit ve son gönderiler.</p>
              </div>
              <span className="sh-count">{input.model.announcements.length} görünür</span>
            </div>
            <div className="sh-announcement-list">
              {input.model.announcements.length ? (
                input.model.announcements.map((announcement) => (
                  <article className="sh-announcement" key={announcement.id}>
                    <span>{announcement.label}</span>
                    <p>{announcement.copy}</p>
                    <small>{announcement.time}</small>
                  </article>
                ))
              ) : (
                <div className="sh-empty-state">Duyuru sayfası bu rol için görünmüyor.</div>
              )}
            </div>
          </div>

          <div className="sh-panel sh-links-panel">
            <div className="sh-section-head">
              <div>
                <h2>Hızlı geçiş</h2>
                <p>Detay işi kendi sayfasında tamamlanır.</p>
              </div>
            </div>
            <div className="sh-link-list">
              {input.model.quickLinks.length ? (
                input.model.quickLinks.map((link) => (
                  <Link className={`sh-link-card sh-tone-${link.tone}`} key={link.id} to={link.href}>
                    <span className="sh-icon" aria-hidden="true">
                      {link.icon}
                    </span>
                    <span>
                      <strong>{link.label}</strong>
                      <small>{link.value}</small>
                    </span>
                    <ArrowRight size={15} />
                  </Link>
                ))
              ) : (
                <div className="sh-empty-state">Bu rol için hızlı geçiş yok.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
