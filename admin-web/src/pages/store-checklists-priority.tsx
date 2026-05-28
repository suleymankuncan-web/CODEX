import { AlertTriangle, ArrowRight, Inbox, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AppLocale } from '../lib/i18n'
import type { ChecklistPriorityAction } from './store-checklists-priority-logic'
import { getStaticCopy } from './store-checklists-logic'

export function ChecklistAttentionBanner(input: {
  count: number
  locale: AppLocale
  onClick: () => void
}) {
  const hasPriority = input.count > 0

  return (
    <section
      className={`store-checklists-attention ${hasPriority ? 'store-checklists-attention-active' : ''}`}
      aria-label={getStaticCopy(input.locale, 'Checklist öncelik bildirimi', 'Checklist priority notice')}
    >
      <div className="store-checklists-attention-copy">
        <span className="store-checklists-attention-icon" aria-hidden="true">
          <AlertTriangle />
        </span>
        <div>
          <strong>
            {hasPriority
              ? getStaticCopy(
                  input.locale,
                  `${input.count} mağaza öncelikli aksiyon bekliyor`,
                  `${input.count} stores need priority action`,
                )
              : getStaticCopy(input.locale, 'Öncelikli aksiyon yok', 'No priority action')}
          </strong>
          <p>
            {hasPriority
              ? getStaticCopy(
                  input.locale,
                  'Düşük skor, taslak veya tamamlanmayan checklistler ana listede işaretlendi.',
                  'Low score, draft, or incomplete checklists are marked in the main list.',
                )
              : getStaticCopy(
                  input.locale,
                  'Seçili filtrelerde kritik takip gerektiren checklist kaydı görünmüyor.',
                  'No critical checklist follow-up is visible for the selected filters.',
                )}
          </p>
        </div>
      </div>
      {hasPriority ? (
        <Button className="store-checklists-attention-action" type="button" variant="outline" onClick={input.onClick}>
          {getStaticCopy(input.locale, 'Öncelikleri incele', 'Review priorities')}
          <ArrowRight data-icon="inline-end" />
        </Button>
      ) : null}
    </section>
  )
}

export function ChecklistPriorityRail(input: {
  actions: ChecklistPriorityAction[]
  locale: AppLocale
  totalCount: number
}) {
  return (
    <aside className="store-checklists-priority-rail" aria-label={getStaticCopy(input.locale, 'Öncelikli aksiyonlar', 'Priority actions')}>
      <div className="store-checklists-priority-card">
        <div className="store-checklists-priority-head">
          <div>
            <span className="store-checklists-priority-icon" aria-hidden="true">
              <TrendingDown />
            </span>
            <strong>{getStaticCopy(input.locale, 'Öncelikli aksiyonlar', 'Priority actions')}</strong>
          </div>
          <span>{input.totalCount}</span>
        </div>
        {input.actions.length > 0 ? (
          <div className="store-checklists-priority-list">
            {input.actions.map((action) => (
              <div className="store-checklists-priority-row" key={action.id}>
                <i className={`store-checklists-priority-dot store-checklists-tone-${action.tone}`} />
                <div>
                  <strong>{action.title}</strong>
                  <span>{action.copy}</span>
                </div>
                <b className={`store-checklists-priority-value store-checklists-tone-${action.tone}`}>
                  {action.value}
                </b>
              </div>
            ))}
          </div>
        ) : (
          <div className="store-checklists-priority-empty">
            <Inbox aria-hidden="true" />
            <span>{getStaticCopy(input.locale, 'Seçili filtrelerde takip kaydı yok.', 'No follow-up record in selected filters.')}</span>
          </div>
        )}
      </div>
    </aside>
  )
}
