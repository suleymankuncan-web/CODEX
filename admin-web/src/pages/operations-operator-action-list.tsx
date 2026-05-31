import type { TranslateFunction } from '../features/localization/dictionary'
import type { OperatorAction } from './operations-operator-action-model'
import {
  OperationsPanel,
  OperationsQueueList,
  OperationsStatusBadge,
} from './operations-surface-primitives'

export function OperatorActionListPanel(input: {
  actions: OperatorAction[]
  t: TranslateFunction
}) {
  return (
    <OperationsPanel
      eyebrow={input.t('adminOperations.actionEyebrow')}
      title={input.t('adminOperations.actionTitle')}
      description={input.t('adminOperations.actionCopy')}
      testId="operations-action-list"
      badge={
        <OperationsStatusBadge tone={input.actions.length > 0 ? 'warning' : 'calm'}>
          {input.t('adminOperations.actionCount', { count: input.actions.length })}
        </OperationsStatusBadge>
      }
    >
      <OperationsQueueList
        items={input.actions.map((action) => ({
          footer: action.href ? input.t('adminOperations.openActionDetail') : undefined,
          href: action.href,
          id: action.id,
          meta: action.subtitle,
          reason: action.reason,
          status: action.status,
          title: action.title,
          tone: action.tone,
        }))}
      />
    </OperationsPanel>
  )
}
