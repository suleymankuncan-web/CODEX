import type { AuthSessionSummary } from '@/features/auth/api'
import { FinalIncentiveApproval } from './final-incentive-approval'
import { useState } from 'react'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { IncentiveWorkspaceHierarchy } from './workspace-hierarchy'
import { IncentiveWorkspaceScaffold } from './workspace-scaffold'
import { ReadOnlyCorrectionDrawer } from './read-only-correction-drawer'
import type { IncentiveRow, IncentiveStore, IncentiveWorkspace } from './types'

type Translate = ReturnType<typeof useLocalization>['t']

export function ReportViewerIncentivesView(input: {
  authSummary?: AuthSessionSummary | null
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
        renderApproval={regionIds => <FinalIncentiveApproval key={`${input.period}:${input.authSummary?.user.userId}:${input.authSummary?.user.authorizationContextVersion}:${regionIds?.join(',') ?? 'all'}`} authSummary={input.authSummary ?? null} period={input.period} locale={input.locale} regionIds={regionIds} disabled={input.isUpdating || Boolean(input.backgroundError)} />}
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

      <ReadOnlyCorrectionDrawer workspace={input.workspace} locale={input.locale} onClose={() => {
        const opener = selection?.opener
        setSelection(null)
        if (opener) requestAnimationFrame(() => opener.focus())
      }} selection={selection} t={input.t} />
    </>
  )
}
