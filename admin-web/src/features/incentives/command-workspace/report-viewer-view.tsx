import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { IncentiveWorkspaceHierarchy } from './workspace-hierarchy'
import { IncentiveWorkspaceScaffold } from './workspace-scaffold'
import { ReadOnlyCorrectionDrawer } from './read-only-correction-drawer'
import type { IncentiveRow, IncentiveStore, IncentiveWorkspace } from './types'

type Translate = ReturnType<typeof useLocalization>['t']

export function ReportViewerIncentivesView(input: {
  workspace: IncentiveWorkspace
  period: string
  onPeriodChange: (period: string) => void
  isUpdating: boolean
  backgroundError: Error | null
  locale: AppLocale
  t: Translate
}) {
  const [selection, setSelection] = useState<{ store: IncentiveStore; row: IncentiveRow; opener: HTMLButtonElement } | null>(null)
  return (
    <>
      <IncentiveWorkspaceScaffold
        {...input}
        sectionHeader={(
          <div className="incentive-viewer-section-header">
            <div><h2>{input.t('storeIncentives.command.viewerSection')}</h2><p>{input.t('storeIncentives.command.viewerSectionCopy')}</p></div>
            <Badge variant="secondary">{input.t('storeIncentives.command.readOnly')}</Badge>
          </div>
        )}
        renderContent={(workspace) => (
          <IncentiveWorkspaceHierarchy
            locale={input.locale}
            onOpenRow={(store, row, opener) => setSelection({ store, row, opener })}
            readOnly
            t={input.t}
            workspace={workspace}
          />
        )}
      />
      <ReadOnlyCorrectionDrawer locale={input.locale} onClose={() => {
        const opener = selection?.opener
        setSelection(null)
        if (opener) requestAnimationFrame(() => opener.focus())
      }} selection={selection} t={input.t} />
    </>
  )
}
