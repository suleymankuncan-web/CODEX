import type { CreatePilotUserBindingInput } from './api'

export type MembershipRole = CreatePilotUserBindingInput['roleCode']
export type MembershipProvider = CreatePilotUserBindingInput['authProvider']

export type MembershipEmployee = {
  employeeId: string
  displayName: string
  email?: string | null
  storeId: string | null
  storeName?: string | null
}

export type MembershipDraft = {
  authProvider: MembershipProvider
  email: string
  employee: MembershipEmployee | null
  providerSubject: string
  roleCode: MembershipRole
  storeIds: string[]
  username: string
}

export function createMembershipDraft(): MembershipDraft {
  return {
    authProvider: 'clerk',
    email: '',
    employee: null,
    providerSubject: '',
    roleCode: 'STORE_MANAGER',
    storeIds: [],
    username: '',
  }
}

export function validateMembershipDraft(draft: MembershipDraft): string | null {
  if (!draft.employee) return 'Personel seçin.'
  if (!draft.providerSubject.trim()) return 'Giriş sağlayıcısı kullanıcı kimliğini girin.'
  if (draft.providerSubject.trim().length < 8) return 'Kullanıcı kimliği en az 8 karakter olmalıdır.'
  if (draft.username.trim().length < 3) return 'Kullanıcı adı en az 3 karakter olmalıdır.'
  if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) return 'Geçerli bir e-posta adresi girin.'
  if (!draft.storeIds.length) return 'En az bir mağaza seçin.'
  if (draft.storeIds.length > 5) return 'En fazla 5 mağaza seçebilirsiniz.'

  if (draft.roleCode === 'STORE_MANAGER') {
    if (!draft.employee.storeId) return 'Personelin aktif mağaza ataması bulunmuyor.'
    if (draft.storeIds.length !== 1 || draft.storeIds[0] !== draft.employee.storeId) {
      return 'Mağaza müdürü personelin aktif mağazasına bağlanmalıdır.'
    }
  }

  return null
}

export function buildMembershipBindingInput(
  draft: MembershipDraft,
): CreatePilotUserBindingInput {
  const validationError = validateMembershipDraft(draft)
  if (validationError || !draft.employee) {
    throw new Error(validationError ?? 'Üyelik bilgileri eksik.')
  }

  return {
    employeeId: draft.employee.employeeId,
    authProvider: draft.authProvider,
    providerSubject: draft.providerSubject.trim(),
    username: draft.username.trim(),
    email: draft.email.trim(),
    roleCode: draft.roleCode,
    storeIds: [...new Set(draft.storeIds)],
  }
}
