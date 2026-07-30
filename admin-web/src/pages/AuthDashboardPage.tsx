import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AdminOperationalPage as AdminSurfacePage,
  AdminOperationalState as AdminStatePanel,
} from './admin-operational-primitives'
import {
  createActionStoreAssignment,
  createPilotUserBinding,
  createRoleAssignment,
  createUserAccount,
  deactivateActionStoreAssignment,
  deactivateRoleAssignment,
  deactivateUserAccount,
  getActionStoreAssignments,
  getAuthLookups,
  getRoleAssignments,
  getUserAccounts,
  getUserAudit,
  reactivateUserAccount,
  updateUserAccount,
  type ActionStoreAssignment,
  type AuthLookupStore,
  type CreateActionStoreAssignmentInput,
  type CreatePilotUserBindingInput,
  type CreateRoleAssignmentInput,
  type RoleAssignment,
  type UserAccount,
} from '../features/auth/api'
import {
  AuthAccessWorkbenchView,
  type AuthActionStoreDraft,
  type AuthRoleDraft,
  type AuthWorkbenchDetailTab,
  type AuthWorkbenchKindFilter,
  type AuthWorkbenchStatusFilter,
  type AuthWorkbenchTray,
  type NewAuthAccountDraft,
} from '../features/auth/AuthAccessWorkbenchView'
import {
  authAccessWorkbenchKeys,
  buildAuthAccessWorkbenchModel,
  buildDeactivateUserInput,
  buildUserProfileUpdateInput,
  createUserProfileDraft,
  createUserStatusDraft,
  getAuthWorkbenchInvalidationKeys,
  hasUserStatusChange,
  type UserProfileDraft,
  type UserStatusDraft,
} from '../features/auth/auth-access-workbench-model'
import { useLocalization } from '../features/localization/useLocalization'
import { actionToast } from '../lib/action-toast'
import { getErrorMessage } from '../lib/format'

type AuthDashboardViewModel =
  | {
      copy: string
      status: 'screen'
      title: string
      tone?: 'error'
    }
  | {
      status: 'ready'
      view: ReactNode
    }

const defaultNewAccountDraft: NewAuthAccountDraft = {
  authProvider: 'clerk',
  email: '',
  employeeId: '',
  username: '',
}
const authWorkbenchListLimit = 200
const authWorkbenchUserListLimit = 100

export function AuthDashboardPage() {
  const dashboard = useAuthDashboardViewModel()

  if (dashboard.status === 'screen') {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          description={dashboard.copy}
          title={dashboard.title}
          tone={dashboard.tone === 'error' ? 'danger' : 'neutral'}
        />
      </AdminSurfacePage>
    )
  }

  return dashboard.view
}

function useAuthDashboardViewModel(): AuthDashboardViewModel {
  const { t } = useLocalization()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AuthWorkbenchKindFilter>('all')
  const [statusFilter, setStatusFilter] = useState<AuthWorkbenchStatusFilter>('all')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<AuthWorkbenchDetailTab>('overview')
  const [openTray, setOpenTray] = useState<AuthWorkbenchTray>('role')
  const [membershipDialogOpen, setMembershipDialogOpen] = useState(false)
  const [membershipError, setMembershipError] = useState<string | null>(null)
  const [newAccountDraft, setNewAccountDraft] = useState<NewAuthAccountDraft>(defaultNewAccountDraft)
  const [profileDraftState, setProfileDraftState] = useState<{
    draft: UserProfileDraft | null
    userId: string | null
  }>({ draft: null, userId: null })
  const [statusDraftState, setStatusDraftState] = useState<{
    draft: UserStatusDraft | null
    userId: string | null
  }>({ draft: null, userId: null })
  const [roleDraft, setRoleDraft] = useState<AuthRoleDraft>({
    companyId: '',
    effectiveFrom: '',
    effectiveTo: '',
    regionId: '',
    roleCode: '',
    scopeType: 'company',
    storeId: '',
  })
  const [actionStoreDraft, setActionStoreDraft] = useState<AuthActionStoreDraft>({
    effectiveFrom: '',
    effectiveTo: '',
    storeId: '',
  })
  const deferredQuery = useDeferredValue(query)
  const trimmedQuery = deferredQuery.trim()

  const lookupsQuery = useQuery({
    queryKey: ['auth-lookups'],
    queryFn: getAuthLookups,
  })
  const usersQuery = useQuery({
    queryKey: authAccessWorkbenchKeys.users({ limit: authWorkbenchUserListLimit, q: trimmedQuery }),
    queryFn: () => getUserAccounts({ limit: authWorkbenchUserListLimit, q: trimmedQuery }),
    placeholderData: (previous) => previous,
  })
  const assignmentsQuery = useQuery({
    queryKey: authAccessWorkbenchKeys.roleAssignments(),
    queryFn: () => getRoleAssignments({ limit: authWorkbenchListLimit }),
  })
  const actionStoreAssignmentsQuery = useQuery({
    queryKey: authAccessWorkbenchKeys.actionStoreAssignments(),
    queryFn: () => getActionStoreAssignments({ limit: authWorkbenchListLimit }),
  })
  const users = useMemo(() => usersQuery.data?.items ?? [], [usersQuery.data?.items])
  const effectiveSelectedUserId = selectedUserId ?? users[0]?.userId ?? null
  const selectedRoleAssignmentsQuery = useQuery({
    queryKey: authAccessWorkbenchKeys.roleAssignments(effectiveSelectedUserId ?? undefined),
    queryFn: () => getRoleAssignments({ userId: effectiveSelectedUserId!, limit: authWorkbenchListLimit }),
    enabled: Boolean(effectiveSelectedUserId),
  })
  const selectedActionStoreAssignmentsQuery = useQuery({
    queryKey: authAccessWorkbenchKeys.actionStoreAssignments(effectiveSelectedUserId ?? undefined),
    queryFn: () => getActionStoreAssignments({ userId: effectiveSelectedUserId!, limit: authWorkbenchListLimit }),
    enabled: Boolean(effectiveSelectedUserId),
  })
  const auditQuery = useQuery({
    queryKey: effectiveSelectedUserId
      ? authAccessWorkbenchKeys.audit(effectiveSelectedUserId)
      : ['auth-access-workbench', 'audit', 'none'],
    queryFn: () => getUserAudit(effectiveSelectedUserId!),
    enabled: Boolean(effectiveSelectedUserId),
  })

  const lookups = lookupsQuery.data ?? null
  const roleAssignments = useMemo(
    () => mergeAssignments(assignmentsQuery.data?.items ?? [], selectedRoleAssignmentsQuery.data?.items ?? []),
    [assignmentsQuery.data?.items, selectedRoleAssignmentsQuery.data?.items],
  )
  const actionStoreAssignments = useMemo(
    () =>
      mergeActionStoreAssignments(
        actionStoreAssignmentsQuery.data?.items ?? [],
        selectedActionStoreAssignmentsQuery.data?.items ?? [],
      ),
    [actionStoreAssignmentsQuery.data?.items, selectedActionStoreAssignmentsQuery.data?.items],
  )

  const selectedAuditEvents = useMemo(() => auditQuery.data?.items ?? [], [auditQuery.data?.items])
  const model = useMemo(
    () =>
      buildAuthAccessWorkbenchModel({
        users,
        roleAssignments,
        actionStoreAssignments,
        auditEvents: selectedAuditEvents,
        selectedUserId: effectiveSelectedUserId,
      }),
    [actionStoreAssignments, effectiveSelectedUserId, roleAssignments, selectedAuditEvents, users],
  )
  const selectedUserFromModel = model.selectedUser
  const roleAssignmentsByUser = useMemo(() => groupBy(roleAssignments, (item) => item.userId), [roleAssignments])
  const filteredUsers = useMemo(
    () =>
      model.users.filter((user) => {
        if (statusFilter === 'active' && user.status !== 'active') return false
        if (statusFilter === 'inactive' && user.status !== 'inactive') return false
        return userMatchesKindFilter(user, roleAssignmentsByUser.get(user.userId) ?? [], filter)
      }),
    [filter, model.users, roleAssignmentsByUser, statusFilter],
  )
  const selectedUser = filteredUsers.some((user) => user.userId === selectedUserFromModel?.userId)
    ? selectedUserFromModel
    : null
  const visibleModel = useMemo(
    () => (selectedUser === model.selectedUser ? model : { ...model, selectedUser }),
    [model, selectedUser],
  )
  const availableStores = useMemo(() => lookups?.stores ?? [], [lookups?.stores])
  const providerOptions = useMemo(
    () => Array.from(new Set(['clerk', 'oidc', 'sso', 'local', ...(lookups?.authProviders ?? [])])),
    [lookups?.authProviders],
  )
  const regionOptions = useMemo(() => buildRegionOptions(availableStores), [availableStores])
  const defaultCompanyId = availableStores[0]?.companyId ?? ''
  const defaultRoleCode = lookups?.roles[0]?.roleCode ?? ''

  const profileDraft =
    selectedUser && profileDraftState.userId === selectedUser.userId && profileDraftState.draft
      ? profileDraftState.draft
      : selectedUser
        ? createUserProfileDraft(selectedUser.source)
        : { email: '', employeeId: '', username: '' }
  const statusDraft =
    selectedUser && statusDraftState.userId === selectedUser.userId && statusDraftState.draft
      ? statusDraftState.draft
      : selectedUser
        ? createUserStatusDraft(selectedUser.source)
        : { isActive: true, reason: '' }
  const effectiveRoleDraft = {
    ...roleDraft,
    companyId: roleDraft.companyId || defaultCompanyId,
    roleCode: roleDraft.roleCode || defaultRoleCode,
  }

  const createUserMutation = useMutation({
    mutationFn: createPilotUserBinding,
    onMutate: () => setMembershipError(null),
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      const createdUserId = response.data.binding.user.userId
      setMembershipDialogOpen(false)
      setSelectedUserId(createdUserId)
      await invalidateWorkbench(queryClient, createdUserId)
    },
    onError: (error) => {
      setMembershipError('Üyelik oluşturulamadı. Bilgileri kontrol edip tekrar deneyin.')
      actionToast.error(error, 'Üyelik oluşturulamadı.')
    },
  })
  const createManagementAccountMutation = useMutation({
    mutationFn: createUserAccount,
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      setNewAccountDraft(defaultNewAccountDraft)
      await invalidateWorkbench(queryClient, effectiveSelectedUserId)
    },
    onError: (error) => actionToast.error(error, 'Yönetim hesabı oluşturulamadı.'),
  })
  const updateUserMutation = useMutation({
    mutationFn: (input: { user: UserAccount; draft: UserProfileDraft }) => {
      const payload = buildUserProfileUpdateInput(input.user, input.draft)
      if (!payload) return Promise.reject(new Error('Kaydedilecek değişiklik yok.'))
      return updateUserAccount(input.user.userId, payload)
    },
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      await invalidateWorkbench(queryClient, effectiveSelectedUserId)
    },
    onError: (error) => actionToast.error(error, 'Kullanıcı güncellenemedi.'),
  })
  const createRoleMutation = useMutation({
    mutationFn: (input: CreateRoleAssignmentInput) => createRoleAssignment(input),
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      await invalidateWorkbench(queryClient, effectiveSelectedUserId)
    },
    onError: (error) => actionToast.error(error, 'Rol ataması kaydedilemedi.'),
  })
  const createActionStoreMutation = useMutation({
    mutationFn: (input: CreateActionStoreAssignmentInput) => createActionStoreAssignment(input),
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      await invalidateWorkbench(queryClient, effectiveSelectedUserId)
    },
    onError: (error) => actionToast.error(error, 'Mağaza ataması kaydedilemedi.'),
  })
  const deactivateRoleMutation = useMutation({
    mutationFn: deactivateRoleAssignment,
    onSuccess: async (response) => {
      actionToast.info(response.command.message)
      await invalidateWorkbench(queryClient, effectiveSelectedUserId)
    },
    onError: (error) => actionToast.error(error, 'Rol ataması kapatılamadı.'),
  })
  const deactivateActionStoreMutation = useMutation({
    mutationFn: deactivateActionStoreAssignment,
    onSuccess: async (response) => {
      actionToast.info(response.command.message)
      await invalidateWorkbench(queryClient, effectiveSelectedUserId)
    },
    onError: (error) => actionToast.error(error, 'Mağaza ataması kapatılamadı.'),
  })
  const deactivateUserMutation = useMutation({
    mutationFn: (input: { userId: string; draft: UserStatusDraft }) =>
      deactivateUserAccount({ userId: input.userId, ...buildDeactivateUserInput(input.draft) }),
    onSuccess: async (response) => {
      actionToast.info(response.command.message)
      await invalidateWorkbench(queryClient, effectiveSelectedUserId)
    },
    onError: (error) => actionToast.error(error, 'Kullanıcı kapatılamadı.'),
  })
  const reactivateUserMutation = useMutation({
    mutationFn: reactivateUserAccount,
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      await invalidateWorkbench(queryClient, effectiveSelectedUserId)
    },
    onError: (error) => actionToast.error(error, 'Kullanıcı yeniden açılamadı.'),
  })

  if (
    lookupsQuery.isLoading ||
    usersQuery.isLoading ||
    assignmentsQuery.isLoading ||
    actionStoreAssignmentsQuery.isLoading
  ) {
    return {
      status: 'screen',
      title: t('authAdmin.loadingTitle'),
      copy: t('authAdmin.loadingCopy'),
    }
  }

  const firstError =
    lookupsQuery.error ??
    usersQuery.error ??
    assignmentsQuery.error ??
    actionStoreAssignmentsQuery.error ??
    null

  if (firstError || !lookups) {
    return {
      status: 'screen',
      title: 'Erişim verisi alınamadı',
      copy: firstError ? getErrorMessage(firstError) : 'Yetki seçenekleri okunamadı.',
      tone: 'error',
    }
  }

  const canSaveProfile = selectedUser
    ? Boolean(buildUserProfileUpdateInput(selectedUser.source, profileDraft))
    : false
  const canSaveStatus = selectedUser ? hasUserStatusChange(selectedUser.source, statusDraft) : false
  const mutationBusy =
    createUserMutation.isPending ||
    createManagementAccountMutation.isPending ||
    updateUserMutation.isPending ||
    createRoleMutation.isPending ||
    createActionStoreMutation.isPending ||
    deactivateRoleMutation.isPending ||
    deactivateActionStoreMutation.isPending ||
    deactivateUserMutation.isPending ||
    reactivateUserMutation.isPending

  return {
    status: 'ready',
    view: (
      <AuthAccessWorkbenchView
        actionStoreDraft={actionStoreDraft}
        activeTab={activeTab}
        availableStores={availableStores}
        canSaveProfile={canSaveProfile}
        canSaveStatus={canSaveStatus}
        feedback={null}
        filter={filter}
        lookups={lookups}
        model={visibleModel}
        mutationBusy={mutationBusy}
        newAccountDraft={newAccountDraft}
        membershipDialogOpen={membershipDialogOpen}
        membershipError={membershipError}
        onActionStoreDraftChange={(patch) =>
          setActionStoreDraft((current) => ({ ...current, ...patch }))
        }
        onCreateActionStore={() => {
          if (!selectedUser || !actionStoreDraft.storeId) return
          createActionStoreMutation.mutate({
            userId: selectedUser.userId,
            storeId: actionStoreDraft.storeId,
            ...(actionStoreDraft.effectiveFrom ? { effectiveFrom: actionStoreDraft.effectiveFrom } : {}),
            ...(actionStoreDraft.effectiveTo ? { effectiveTo: actionStoreDraft.effectiveTo } : {}),
          })
        }}
        onCreateRole={() => {
          if (!selectedUser || !effectiveRoleDraft.roleCode) return
          createRoleMutation.mutate({
            userId: selectedUser.userId,
            roleCode: effectiveRoleDraft.roleCode as CreateRoleAssignmentInput['roleCode'],
            scopeType: effectiveRoleDraft.scopeType,
            ...(effectiveRoleDraft.companyId.trim() ? { companyId: effectiveRoleDraft.companyId.trim() } : {}),
            ...(effectiveRoleDraft.regionId.trim() ? { regionId: effectiveRoleDraft.regionId.trim() } : {}),
            ...(effectiveRoleDraft.storeId.trim() ? { storeId: effectiveRoleDraft.storeId.trim() } : {}),
            ...(effectiveRoleDraft.effectiveFrom ? { effectiveFrom: effectiveRoleDraft.effectiveFrom } : {}),
            ...(effectiveRoleDraft.effectiveTo ? { effectiveTo: effectiveRoleDraft.effectiveTo } : {}),
          })
        }}
        onCreateMembership={(input: CreatePilotUserBindingInput) => createUserMutation.mutate(input)}
        onCreateUser={() =>
          createManagementAccountMutation.mutate({
            username: newAccountDraft.username.trim(),
            email: newAccountDraft.email.trim(),
            authProvider: newAccountDraft.authProvider as CreateUserAuthProvider,
            ...(newAccountDraft.employeeId.trim() ? { employeeId: newAccountDraft.employeeId.trim() } : {}),
          })
        }
        onDeactivateActionStore={(assignmentId) => deactivateActionStoreMutation.mutate(assignmentId)}
        onDeactivateRole={(assignmentId) => deactivateRoleMutation.mutate(assignmentId)}
        onDeactivateUser={() => {
          if (!selectedUser) return
          deactivateUserMutation.mutate({ userId: selectedUser.userId, draft: statusDraft })
        }}
        onMembershipDialogOpenChange={(open) => {
          setMembershipDialogOpen(open)
          if (open) setMembershipError(null)
        }}
        onNewAccountDraftChange={(patch) => setNewAccountDraft((current) => ({ ...current, ...patch }))}
        onOpenTrayChange={setOpenTray}
        onProfileDraftChange={(patch) =>
          selectedUser &&
          setProfileDraftState({
            draft: { ...profileDraft, ...patch },
            userId: selectedUser.userId,
          })
        }
        onQueryChange={setQuery}
        onReactivateUser={() => selectedUser && reactivateUserMutation.mutate(selectedUser.userId)}
        onRoleDraftChange={(patch) => {
          setRoleDraft((current) => ({
            ...current,
            ...patch,
            ...(patch.scopeType === 'company' ? { regionId: '', storeId: '' } : {}),
            ...(patch.scopeType === 'region' ? { storeId: '' } : {}),
          }))
        }}
        onSaveProfile={() => {
          if (!selectedUser) return
          updateUserMutation.mutate({ user: selectedUser.source, draft: profileDraft })
        }}
        onSelectUser={(userId) => {
          setSelectedUserId(userId)
          setActiveTab('overview')
        }}
        onStatusDraftChange={(patch) =>
          selectedUser &&
          setStatusDraftState({
            draft: { ...statusDraft, ...patch },
            userId: selectedUser.userId,
          })
        }
        onStatusFilterChange={setStatusFilter}
        onTabChange={setActiveTab}
        onUserFilterChange={setFilter}
        openTray={openTray}
        pending={{
          actionStore: createActionStoreMutation.isPending,
          deactivateActionStore: deactivateActionStoreMutation.isPending,
          deactivateRole: deactivateRoleMutation.isPending,
          newUser: createUserMutation.isPending || createManagementAccountMutation.isPending,
          profile: updateUserMutation.isPending,
          reactivateUser: reactivateUserMutation.isPending,
          role: createRoleMutation.isPending,
          userStatus: deactivateUserMutation.isPending,
        }}
        profileDraft={profileDraft}
        providerOptions={providerOptions}
        query={query}
        regionOptions={regionOptions}
        roleDraft={effectiveRoleDraft}
        selectedUser={selectedUser}
        statusDraft={statusDraft}
        statusFilter={statusFilter}
        users={filteredUsers}
      />
    ),
  }
}

type CreateUserAuthProvider = Parameters<typeof createUserAccount>[0]['authProvider']

function userMatchesKindFilter(
  user: { displayName: string; email: string },
  assignments: RoleAssignment[],
  filter: AuthWorkbenchKindFilter,
) {
  if (filter === 'all') return true
  const roleText = assignments
    .map((item) => `${item.roleCode} ${item.roleName ?? ''}`)
    .join(' ')
    .toLocaleLowerCase('tr-TR')

  if (filter === 'admin') return roleText.includes('admin')
  if (filter === 'region') return roleText.includes('region') || roleText.includes('bölge')
  if (filter === 'store') return roleText.includes('store') || roleText.includes('mağaza')
  return [user.displayName, user.email].join(' ').length > 0
}

function buildRegionOptions(stores: AuthLookupStore[]) {
  const byId = new Map<string, string>()
  for (const store of stores) {
    if (store.regionId) {
      byId.set(store.regionId, store.regionName ?? 'Bölge')
    }
  }

  return Array.from(byId.entries())
    .map(([regionId, label]) => ({ label, regionId }))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'))
}

function mergeAssignments(a: RoleAssignment[], b: RoleAssignment[]) {
  const byId = new Map<string, RoleAssignment>()
  for (const item of [...a, ...b]) {
    byId.set(item.assignmentId, item)
  }
  return Array.from(byId.values())
}

function mergeActionStoreAssignments(a: ActionStoreAssignment[], b: ActionStoreAssignment[]) {
  const byId = new Map<string, ActionStoreAssignment>()
  for (const item of [...a, ...b]) {
    byId.set(item.assignmentId, item)
  }
  return Array.from(byId.values())
}

function groupBy<T>(items: T[], keyOf: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }
  return groups
}

async function invalidateWorkbench(queryClient: ReturnType<typeof useQueryClient>, userId: string | null) {
  await Promise.all([
    ...getAuthWorkbenchInvalidationKeys(userId ?? undefined).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
    queryClient.invalidateQueries({ queryKey: ['auth-lookups'] }),
  ])
}
