import { ArrowRight } from 'lucide-react'
import { Button } from '../components/ui/button'
import type { NeedsActionItem } from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { AdminStatePanel } from './admin-surface-primitives'

export function IntegrationLifecycleStrip(input: {
  actionCount: number
  primaryItem: NeedsActionItem | undefined
  t: TranslateFunction
  onOpenIssues: () => void
}) {
  const hasIssue = input.actionCount > 0
  return (
    <AdminStatePanel
      className="integration-next-action"
      tone={hasIssue ? 'warning' : 'neutral'}
      title={input.t(hasIssue ? 'adminIntegrations.operatorHandoffTitle' : 'adminIntegrations.operatorHandoffClearTitle')}
      description={input.primaryItem
        ? `${input.primaryItem.sourceCode}: ${input.primaryItem.actionReason} ${input.primaryItem.recommendedAction}`
        : input.t(hasIssue ? 'adminIntegrations.operatorHandoffCopy' : 'adminIntegrations.operatorHandoffClearCopy')}
      action={hasIssue ? (
        <Button variant="outline" onClick={input.onOpenIssues}>
          {input.t('adminIntegrations.reviewIssues')}<ArrowRight data-icon="inline-end" aria-hidden="true" />
        </Button>
      ) : undefined}
    />
  )
}
