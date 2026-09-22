import type { AuthSessionSummary } from '@/features/auth/api'
import type { RegionManagerDirectoryItem } from '@/features/org/region-manager-directory'
import { canApproveIncentives } from './final-incentive-approval-permission'
import { FinalIncentiveApproval } from './final-incentive-approval'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { IncentiveWorkspaceHierarchy } from './workspace-hierarchy'
import { IncentiveWorkspaceScaffold } from './workspace-scaffold'
import { StorePackageDecision } from './store-package-decision'
import type { IncentiveWorkspace } from './types'

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
  managerDirectory: RegionManagerDirectoryItem[]
  managerDirectoryError: boolean
  managerDirectoryLoading: boolean
  onRetryManagerDirectory: () => void
}) {
  return (
    <>
      <IncentiveWorkspaceScaffold
        {...input}
        renderApproval={canApproveIncentives(input.authSummary) ? (regionIds, onBusyChange) => <FinalIncentiveApproval key={`${input.period}:${input.authSummary?.user.userId}:${input.authSummary?.user.authorizationContextVersion}:${regionIds?.join(',') ?? 'all'}`} authSummary={input.authSummary ?? null} period={input.period} locale={input.locale} regionIds={regionIds} onBusyChange={onBusyChange} disabled={input.isUpdating || Boolean(input.backgroundError)} /> : undefined}
        renderContent={(workspace) => (
          <IncentiveWorkspaceHierarchy
            locale={input.locale}
            renderDecision={store => {
              const region = input.workspace.regions.find(item => item.stores.some(candidate => candidate.storeId === store.storeId))
              return region ? <StorePackageDecision region={region} period={input.period} locale={input.locale} auth={input.authSummary ?? null} disabled={input.isUpdating || Boolean(input.backgroundError)} /> : null
            }}
            readOnly
            t={input.t}
            workspace={workspace}
          />
        )}
      />

    </>
  )
}
