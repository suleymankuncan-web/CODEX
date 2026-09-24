import type { IncentiveApprovalPackage } from './final-incentive-approval'
import type { IncentiveManagerGroup } from './types'

export const incentivePackageKey = (item: IncentiveApprovalPackage) => `${item.companyId}:${item.managerUserId}:${item.regionPackageId}:${item.submittedAt}`

export const incentiveManagerGroupKey = (group: IncentiveManagerGroup) => `${group.companyId}:${group.managerUserId ?? 'unassigned'}`

export function incentivePackageStatusLabel(status: IncentiveManagerGroup['package']['status'], tr: boolean) {
  return status === 'admin_approved' ? (tr ? 'Onaylandı' : 'Approved')
    : status === 'submitted' ? (tr ? 'Onay bekliyor' : 'Awaiting approval')
      : status === 'admin_returned' ? (tr ? 'İade edildi' : 'Returned')
        : (tr ? 'Henüz gönderilmedi' : 'Not submitted')
}
