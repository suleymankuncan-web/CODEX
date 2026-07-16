import type { AuthSessionSummary } from '@/features/auth/api'
import { TargetCommandWorkspaceOwner } from '@/features/targets/command-workspace/workspace-owner'

export function StoreTargetsPage(input: { authSummary: AuthSessionSummary | null }) {
  return <TargetCommandWorkspaceOwner authSummary={input.authSummary} />
}
