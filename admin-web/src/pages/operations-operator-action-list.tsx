import { Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusPill } from '../components/dashboard-primitives'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { OperatorAction } from './operations-operator-action-model'

export function OperatorActionListPanel(input: {
  actions: OperatorAction[]
  t: TranslateFunction
}) {
  return (
    <article className="panel">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{input.t('adminOperations.actionEyebrow')}</div>
          <h3>{input.t('adminOperations.actionTitle')}</h3>
          <p className="queue-subtitle">{input.t('adminOperations.actionCopy')}</p>
        </div>
        <StatusPill tone={input.actions.length > 0 ? 'warning' : 'calm'}>
          {input.t('adminOperations.actionCount', { count: input.actions.length })}
        </StatusPill>
      </div>
      <div className="queue-list">
        {input.actions.map((action) => {
          const content = (
            <>
              <div className="queue-row-head">
                <div>
                  <div className="queue-title">{action.title}</div>
                  <div className="queue-subtitle">{action.subtitle}</div>
                </div>
                <StatusPill tone={action.tone}>{action.status}</StatusPill>
              </div>
              <p className="queue-reason">{action.reason}</p>
              {action.href ? (
                <div className="queue-footer">
                  <span>{input.t('adminOperations.openActionDetail')}</span>
                  <Activity size={16} />
                </div>
              ) : null}
            </>
          )

          return action.href ? (
            <Link className="queue-row" key={action.id} to={action.href}>
              {content}
            </Link>
          ) : (
            <div className="queue-row" key={action.id}>
              {content}
            </div>
          )
        })}
      </div>
    </article>
  )
}
