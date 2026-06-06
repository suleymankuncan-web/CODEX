import type { StoreEmployee } from '../features/workforce/api'

export type PersonnelStatusKind = 'active' | 'codeWaiting' | 'offboarding'

export function getPersonnelRowStatus(
  employee: StoreEmployee,
  openOffboardingEmployeeIds: Set<string>,
): { kind: PersonnelStatusKind; label: string } {
  if (openOffboardingEmployeeIds.has(employee.employeeId)) {
    return { kind: 'offboarding', label: 'Çıkış talebi' }
  }
  if (!employee.externalEmployeeRef) return { kind: 'codeWaiting', label: 'Kod bekliyor' }
  return { kind: 'active', label: 'Aktif' }
}

export function getRequestStatusClass(status: string) {
  const base =
    'tw:inline-flex tw:min-h-[27px] tw:items-center tw:gap-1.5 tw:rounded-full tw:px-2.5 tw:text-xs tw:font-semibold'

  if (status === 'rejected') return `${base} tw:bg-[#efe9ff] tw:text-[#5534e6]`
  if (status.includes('pending')) return `${base} tw:bg-[#fff1d9] tw:text-[#a35a00]`
  if (status === 'approved') return `${base} tw:bg-[#def9ec] tw:text-[#087a51]`
  return `${base} tw:bg-[#f4f7fc] tw:text-[#465272]`
}

export function isPendingOffboardingApprovalStatus(status: string) {
  return status.startsWith('pending_')
}

export function getWorkforceRequestStatusLabel(status: string) {
  if (status === 'pending_hr_approval') return 'HR onayı bekliyor'
  if (status === 'pending_region_approval') return 'Bölge onayı bekliyor'
  if (status === 'approved') return 'Onaylandı'
  if (status === 'rejected') return 'İade edildi'
  return status.replaceAll('_', ' ')
}
