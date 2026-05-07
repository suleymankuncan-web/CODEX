import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { KeyRound, MapPin, ShieldCheck, UserCog, Users } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import {
  createActionStoreAssignment,
  createRoleAssignment,
  createUserAccount,
  deactivateActionStoreAssignment,
  deactivateRoleAssignment,
  deactivateUserAccount,
  getActionStoreAssignments,
  getAuthLookups,
  getRoleAssignments,
  getUserAccounts,
  reactivateUserAccount,
  searchAuthStores,
  searchAuthUsers,
  type AuthLookupStore,
  type AuthLookupUser,
} from '../features/auth/api'
import { PilotUserBindingPanel } from '../features/auth/PilotUserBindingPanel'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDateTime, getErrorMessage } from '../lib/format'

type RoleScopeType = 'company' | 'region' | 'store'
type AuthProvider = 'local' | 'oidc' | 'sso' | 'clerk'

function mergeAuthUsers(...groups: Array<Array<AuthLookupUser | null | undefined>>) {
  const byId = new Map<string, AuthLookupUser>()
  for (const group of groups) {
    for (const user of group) {
      if (user) {
        byId.set(user.userId, user)
      }
    }
  }
  return Array.from(byId.values())
}

function mergeAuthStores(...groups: Array<Array<AuthLookupStore | null | undefined>>) {
  const byId = new Map<string, AuthLookupStore>()
  for (const group of groups) {
    for (const store of group) {
      if (store) {
        byId.set(store.storeId, store)
      }
    }
  }
  return Array.from(byId.values())
}

export function AuthDashboardPage() {
  const [search, setSearch] = useState('')
  const [assignmentUserSearch, setAssignmentUserSearch] = useState('')
  const [assignmentStoreSearch, setAssignmentStoreSearch] = useState('')
  const [actionStoreUserSearch, setActionStoreUserSearch] = useState('')
  const [actionStoreSearch, setActionStoreSearch] = useState('')
  const [selectedAssignmentUser, setSelectedAssignmentUser] = useState<AuthLookupUser | null>(null)
  const [selectedAssignmentStore, setSelectedAssignmentStore] = useState<AuthLookupStore | null>(null)
  const [selectedActionStoreUser, setSelectedActionStoreUser] = useState<AuthLookupUser | null>(null)
  const [selectedActionStore, setSelectedActionStore] = useState<AuthLookupStore | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null)
  const [userForm, setUserForm] = useState<{
    employeeId: string
    username: string
    email: string
    authProvider: AuthProvider
  }>({
    employeeId: '',
    username: '',
    email: '',
    authProvider: 'oidc',
  })
  const [assignmentForm, setAssignmentForm] = useState<{
    userId: string
    roleCode: string
    scopeType: RoleScopeType
    companyId: string
    regionId: string
    storeId: string
    effectiveFrom: string
    effectiveTo: string
  }>({
    userId: '',
    roleCode: '',
    scopeType: 'company',
    companyId: '',
    regionId: '',
    storeId: '',
    effectiveFrom: '',
    effectiveTo: '',
  })
  const [actionStoreForm, setActionStoreForm] = useState<{
    userId: string
    storeId: string
    effectiveFrom: string
    effectiveTo: string
  }>({
    userId: '',
    storeId: '',
    effectiveFrom: '',
    effectiveTo: '',
  })
  const deferredSearch = useDeferredValue(search)
  const deferredAssignmentUserSearch = useDeferredValue(assignmentUserSearch)
  const deferredAssignmentStoreSearch = useDeferredValue(assignmentStoreSearch)
  const deferredActionStoreUserSearch = useDeferredValue(actionStoreUserSearch)
  const deferredActionStoreSearch = useDeferredValue(actionStoreSearch)
  const queryClient = useQueryClient()
  const assignmentUserSearchText = deferredAssignmentUserSearch.trim()
  const assignmentStoreSearchText = deferredAssignmentStoreSearch.trim()
  const actionStoreUserSearchText = deferredActionStoreUserSearch.trim()
  const actionStoreSearchText = deferredActionStoreSearch.trim()
  const assignmentUserSearchEnabled = assignmentUserSearchText.length >= 2
  const assignmentStoreSearchEnabled = assignmentStoreSearchText.length >= 2
  const actionStoreUserSearchEnabled = actionStoreUserSearchText.length >= 2
  const actionStoreSearchEnabled = actionStoreSearchText.length >= 2
  const { locale, t } = useLocalization()

  const lookupsQuery = useQuery({
    queryKey: ['auth-lookups'],
    queryFn: getAuthLookups,
  })
  const assignmentUserSearchQuery = useQuery({
    queryKey: ['auth-lookups', 'users', 'search', assignmentUserSearchText],
    queryFn: () => searchAuthUsers({ query: assignmentUserSearchText }),
    enabled: assignmentUserSearchEnabled,
  })
  const assignmentStoreSearchQuery = useQuery({
    queryKey: ['auth-lookups', 'stores', 'search', assignmentStoreSearchText],
    queryFn: () => searchAuthStores({ query: assignmentStoreSearchText }),
    enabled: assignmentStoreSearchEnabled,
  })
  const actionStoreUserSearchQuery = useQuery({
    queryKey: ['auth-lookups', 'users', 'search', actionStoreUserSearchText],
    queryFn: () => searchAuthUsers({ query: actionStoreUserSearchText }),
    enabled: actionStoreUserSearchEnabled,
  })
  const actionStoreSearchQuery = useQuery({
    queryKey: ['auth-lookups', 'stores', 'search', actionStoreSearchText],
    queryFn: () => searchAuthStores({ query: actionStoreSearchText }),
    enabled: actionStoreSearchEnabled,
  })
  const usersQuery = useQuery({
    queryKey: ['auth-users'],
    queryFn: () => getUserAccounts(),
  })
  const assignmentsQuery = useQuery({
    queryKey: ['auth-role-assignments'],
    queryFn: () => getRoleAssignments(),
  })
  const actionStoreAssignmentsQuery = useQuery({
    queryKey: ['auth-action-store-assignments'],
    queryFn: () => getActionStoreAssignments(),
  })

  async function refreshAuthData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['auth-users'] }),
      queryClient.invalidateQueries({ queryKey: ['auth-lookups'] }),
      queryClient.invalidateQueries({ queryKey: ['auth-role-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['auth-action-store-assignments'] }),
    ])
  }

  const createUserMutation = useMutation({
    mutationFn: createUserAccount,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      setErrorFeedback(null)
      setUserForm({
        employeeId: '',
        username: '',
        email: '',
        authProvider: 'oidc',
      })
      await refreshAuthData()
    },
    onError: (error) => {
      setErrorFeedback(getErrorMessage(error))
    },
  })
  const createAssignmentMutation = useMutation({
    mutationFn: createRoleAssignment,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      setErrorFeedback(null)
      setAssignmentForm({
        userId: '',
        roleCode: '',
        scopeType: 'company',
        companyId: '',
        regionId: '',
        storeId: '',
        effectiveFrom: '',
        effectiveTo: '',
      })
      setAssignmentUserSearch('')
      setAssignmentStoreSearch('')
      setSelectedAssignmentUser(null)
      setSelectedAssignmentStore(null)
      await refreshAuthData()
    },
    onError: (error) => {
      setErrorFeedback(getErrorMessage(error))
    },
  })
  const createActionStoreAssignmentMutation = useMutation({
    mutationFn: createActionStoreAssignment,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      setErrorFeedback(null)
      setActionStoreForm({
        userId: '',
        storeId: '',
        effectiveFrom: '',
        effectiveTo: '',
      })
      setActionStoreUserSearch('')
      setActionStoreSearch('')
      setSelectedActionStoreUser(null)
      setSelectedActionStore(null)
      await refreshAuthData()
    },
    onError: (error) => {
      setErrorFeedback(getErrorMessage(error))
    },
  })
  const deactivateAssignmentMutation = useMutation({
    mutationFn: deactivateRoleAssignment,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      setErrorFeedback(null)
      await queryClient.invalidateQueries({ queryKey: ['auth-role-assignments'] })
    },
    onError: (error) => {
      setErrorFeedback(getErrorMessage(error))
    },
  })
  const deactivateActionStoreAssignmentMutation = useMutation({
    mutationFn: deactivateActionStoreAssignment,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      setErrorFeedback(null)
      await queryClient.invalidateQueries({ queryKey: ['auth-action-store-assignments'] })
    },
    onError: (error) => {
      setErrorFeedback(getErrorMessage(error))
    },
  })
  const deactivateUserMutation = useMutation({
    mutationFn: deactivateUserAccount,
    onSuccess: async (response) => {
      const closure = response.data.accessClosure
      setFeedback(
        t('authAdmin.userClosureFeedback', {
          message: response.command.message,
          roleCount: closure.closedRoleAssignments,
          actionStoreCount: closure.closedActionStoreAssignments,
          sessionCount: closure.revokedMobileSessions,
        }),
      )
      setErrorFeedback(null)
      await refreshAuthData()
    },
    onError: (error) => {
      setErrorFeedback(getErrorMessage(error))
    },
  })
  const reactivateUserMutation = useMutation({
    mutationFn: reactivateUserAccount,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      setErrorFeedback(null)
      await refreshAuthData()
    },
    onError: (error) => {
      setErrorFeedback(getErrorMessage(error))
    },
  })
  const lookups = lookupsQuery.data ?? null
  const users = useMemo(() => usersQuery.data?.items ?? [], [usersQuery.data?.items])
  const assignmentUserOptions = useMemo(
    () =>
      mergeAuthUsers(
        lookups?.users ?? [],
        assignmentUserSearchEnabled ? assignmentUserSearchQuery.data?.items ?? [] : [],
        [selectedAssignmentUser],
      ),
    [
      assignmentUserSearchEnabled,
      assignmentUserSearchQuery.data?.items,
      lookups?.users,
      selectedAssignmentUser,
    ],
  )
  const assignmentStoreOptions = useMemo(
    () =>
      mergeAuthStores(
        lookups?.stores ?? [],
        assignmentStoreSearchEnabled ? assignmentStoreSearchQuery.data?.items ?? [] : [],
        [selectedAssignmentStore],
      ),
    [
      assignmentStoreSearchEnabled,
      assignmentStoreSearchQuery.data?.items,
      lookups?.stores,
      selectedAssignmentStore,
    ],
  )
  const actionStoreUserOptions = useMemo(
    () =>
      mergeAuthUsers(
        lookups?.users ?? [],
        actionStoreUserSearchEnabled ? actionStoreUserSearchQuery.data?.items ?? [] : [],
        [selectedActionStoreUser],
      ),
    [
      actionStoreUserSearchEnabled,
      actionStoreUserSearchQuery.data?.items,
      lookups?.users,
      selectedActionStoreUser,
    ],
  )
  const actionStoreOptions = useMemo(
    () =>
      mergeAuthStores(
        lookups?.stores ?? [],
        actionStoreSearchEnabled ? actionStoreSearchQuery.data?.items ?? [] : [],
        [selectedActionStore],
      ),
    [
      actionStoreSearchEnabled,
      actionStoreSearchQuery.data?.items,
      lookups?.stores,
      selectedActionStore,
    ],
  )
  const assignments = useMemo(
    () => assignmentsQuery.data?.items ?? [],
    [assignmentsQuery.data?.items],
  )
  const actionStoreAssignments = useMemo(
    () => actionStoreAssignmentsQuery.data?.items ?? [],
    [actionStoreAssignmentsQuery.data?.items],
  )
  const filteredAssignments = useMemo(() => {
    const input = deferredSearch.trim().toLowerCase()
    if (!input) {
      return assignments
    }

    return assignments.filter((assignment) =>
      [
        assignment.username,
        assignment.email,
        assignment.roleCode,
        assignment.roleName,
        assignment.scopeType,
        assignment.companyId ?? '',
        assignment.regionId ?? '',
        assignment.storeId ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(input),
    )
  }, [assignments, deferredSearch])
  const filteredActionStoreAssignments = useMemo(() => {
    const input = deferredSearch.trim().toLowerCase()
    if (!input) {
      return actionStoreAssignments
    }

    return actionStoreAssignments.filter((assignment) =>
      [
        assignment.username,
        assignment.email,
        assignment.storeCode,
        assignment.storeName,
        assignment.regionName,
        assignment.companyId,
        assignment.regionId,
        assignment.storeId,
      ]
        .join(' ')
        .toLowerCase()
        .includes(input),
    )
  }, [actionStoreAssignments, deferredSearch])

  if (
    lookupsQuery.isLoading ||
    usersQuery.isLoading ||
    assignmentsQuery.isLoading ||
    actionStoreAssignmentsQuery.isLoading
  ) {
    return <ScreenState title={t('authAdmin.loadingTitle')} copy={t('authAdmin.loadingCopy')} />
  }

  if (lookupsQuery.isError) {
    return <ScreenState title={t('authAdmin.lookupsUnavailable')} copy={getErrorMessage(lookupsQuery.error)} tone="error" />
  }

  if (usersQuery.isError) {
    return <ScreenState title={t('authAdmin.usersUnavailable')} copy={getErrorMessage(usersQuery.error)} tone="error" />
  }

  if (assignmentsQuery.isError) {
    return <ScreenState title={t('authAdmin.assignmentsUnavailable')} copy={getErrorMessage(assignmentsQuery.error)} tone="error" />
  }

  if (actionStoreAssignmentsQuery.isError) {
    return <ScreenState title={t('authAdmin.actionStoresUnavailable')} copy={getErrorMessage(actionStoreAssignmentsQuery.error)} tone="error" />
  }

  if (!lookups) {
    return <ScreenState title={t('authAdmin.lookupsUnavailable')} copy={t('authAdmin.noLookupPayload')} tone="error" />
  }

  const activeUsers = users.filter((user) => user.isActive).length
  const activeAssignments = assignments.filter((assignment) => assignment.active).length
  const activeActionStores = actionStoreAssignments.filter((assignment) => assignment.active).length
  const mutationBusy =
    createUserMutation.isPending ||
    createAssignmentMutation.isPending ||
    createActionStoreAssignmentMutation.isPending ||
    deactivateAssignmentMutation.isPending ||
    deactivateActionStoreAssignmentMutation.isPending ||
    deactivateUserMutation.isPending ||
    reactivateUserMutation.isPending
  const providerOptions = Array.from(
    new Set<AuthProvider>(['local', 'oidc', 'sso', 'clerk', ...(lookups.authProviders as AuthProvider[])]),
  )

  function updateUserForm<K extends keyof typeof userForm>(key: K, value: (typeof userForm)[K]) {
    setUserForm((current) => ({ ...current, [key]: value }))
  }

  function updateAssignmentForm<K extends keyof typeof assignmentForm>(
    key: K,
    value: (typeof assignmentForm)[K],
  ) {
    setAssignmentForm((current) => ({ ...current, [key]: value }))
  }

  function updateActionStoreForm<K extends keyof typeof actionStoreForm>(
    key: K,
    value: (typeof actionStoreForm)[K],
  ) {
    setActionStoreForm((current) => ({ ...current, [key]: value }))
  }

  function selectAssignmentUser(userId: string) {
    const user = assignmentUserOptions.find((item) => item.userId === userId) ?? null
    setSelectedAssignmentUser(user)
    updateAssignmentForm('userId', userId)
  }

  function selectAssignmentStore(storeId: string) {
    const store = assignmentStoreOptions.find((item) => item.storeId === storeId) ?? null
    setSelectedAssignmentStore(store)
    setAssignmentForm((current) => ({
      ...current,
      storeId,
      companyId: store?.companyId ?? current.companyId,
      regionId: store?.regionId ?? current.regionId,
    }))
  }

  function selectActionStoreUser(userId: string) {
    const user = actionStoreUserOptions.find((item) => item.userId === userId) ?? null
    setSelectedActionStoreUser(user)
    updateActionStoreForm('userId', userId)
  }

  function selectActionStore(storeId: string) {
    const store = actionStoreOptions.find((item) => item.storeId === storeId) ?? null
    setSelectedActionStore(store)
    updateActionStoreForm('storeId', storeId)
  }

  function submitUserForm() {
    setFeedback(null)
    setErrorFeedback(null)
    createUserMutation.mutate({
      username: userForm.username.trim(),
      email: userForm.email.trim(),
      authProvider: userForm.authProvider,
      ...(userForm.employeeId.trim() ? { employeeId: userForm.employeeId.trim() } : {}),
    })
  }

  function submitAssignmentForm() {
    setFeedback(null)
    setErrorFeedback(null)
    createAssignmentMutation.mutate({
      userId: assignmentForm.userId,
      roleCode: assignmentForm.roleCode,
      scopeType: assignmentForm.scopeType,
      ...(assignmentForm.companyId.trim() ? { companyId: assignmentForm.companyId.trim() } : {}),
      ...(assignmentForm.regionId.trim() ? { regionId: assignmentForm.regionId.trim() } : {}),
      ...(assignmentForm.storeId.trim() ? { storeId: assignmentForm.storeId.trim() } : {}),
      ...(assignmentForm.effectiveFrom ? { effectiveFrom: assignmentForm.effectiveFrom } : {}),
      ...(assignmentForm.effectiveTo ? { effectiveTo: assignmentForm.effectiveTo } : {}),
    })
  }

  function submitActionStoreForm() {
    setFeedback(null)
    setErrorFeedback(null)
    createActionStoreAssignmentMutation.mutate({
      userId: actionStoreForm.userId,
      storeId: actionStoreForm.storeId,
      ...(actionStoreForm.effectiveFrom ? { effectiveFrom: actionStoreForm.effectiveFrom } : {}),
      ...(actionStoreForm.effectiveTo ? { effectiveTo: actionStoreForm.effectiveTo } : {}),
    })
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('authAdmin.heroEyebrow')}</div>
          <h2 className="hero-title">{t('authAdmin.heroTitle')}</h2>
          <p className="hero-copy">{t('authAdmin.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('authAdmin.users')} value={String(lookups.meta.totalUsers)} />
          <MetricAccent label={t('authAdmin.roles')} value={String(lookups.meta.totalRoles)} />
          <MetricAccent label={t('authAdmin.permissions')} value={String(lookups.meta.totalPermissions)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title={t('authAdmin.activeUsers')} value={activeUsers} note={t('authAdmin.inactiveAccountsNote', { count: users.length - activeUsers })} icon={<Users size={18} />} tone="calm" />
        <MetricCard title={t('authAdmin.assignments')} value={assignments.length} note={t('authAdmin.activeRoleGrantsNote', { count: activeAssignments })} icon={<UserCog size={18} />} tone="accent" />
        <MetricCard title={t('authAdmin.actionStores')} value={actionStoreAssignments.length} note={t('authAdmin.activeStoreActionGrantsNote', { count: activeActionStores })} icon={<MapPin size={18} />} tone="calm" />
        <MetricCard title={t('authAdmin.roleCatalog')} value={lookups.meta.totalRoles} note={t('authAdmin.roleCatalogNote')} icon={<ShieldCheck size={18} />} tone="warning" />
        <MetricCard title={t('authAdmin.permissionCatalog')} value={lookups.meta.totalPermissions} note={t('authAdmin.permissionCatalogNote')} icon={<KeyRound size={18} />} tone="danger" />
      </section>

      {feedback ? (
        <section className="panel">
          <div className="inline-state inline-state-accent">{feedback}</div>
        </section>
      ) : null}

      {errorFeedback ? (
        <section className="panel">
          <div className="inline-state inline-state-danger">{errorFeedback}</div>
        </section>
      ) : null}

      <PilotUserBindingPanel stores={lookups.stores} />

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('authAdmin.createUserEyebrow')}</div>
              <h3>{t('authAdmin.newAccount')}</h3>
            </div>
            <Link className="back-link" to="/admin/auth/catalog">
              <span>{t('authAdmin.openCatalog')}</span>
            </Link>
          </div>
          <div className="form-grid">
            <label className="field-block">
              <span>{t('authAdmin.username')}</span>
              <input value={userForm.username} onChange={(event) => updateUserForm('username', event.target.value)} placeholder="new.admin" />
            </label>
            <label className="field-block">
              <span>{t('authAdmin.email')}</span>
              <input value={userForm.email} onChange={(event) => updateUserForm('email', event.target.value)} placeholder="new.admin@example.com" />
            </label>
            <label className="field-block">
              <span>{t('authAdmin.authProvider')}</span>
              <select value={userForm.authProvider} onChange={(event) => updateUserForm('authProvider', event.target.value as AuthProvider)}>
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>{t('authAdmin.employeeId')}</span>
              <input value={userForm.employeeId} onChange={(event) => updateUserForm('employeeId', event.target.value)} placeholder={t('authAdmin.optionalEmployeeUuid')} />
            </label>
          </div>
          <div className="action-cluster">
            <button
              className="control-button"
              type="button"
              onClick={submitUserForm}
              disabled={mutationBusy || !userForm.username.trim() || !userForm.email.trim()}
            >
              {createUserMutation.isPending ? t('authAdmin.creating') : t('authAdmin.createUser')}
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('authAdmin.createAssignmentEyebrow')}</div>
              <h3>{t('authAdmin.scopedRoleGrant')}</h3>
            </div>
          </div>
          <div className="form-grid">
            <label className="field-block">
              <span>{t('authAdmin.searchUsersForRoleGrant')}</span>
              <input
                aria-label={t('authAdmin.searchUsersForRoleGrant')}
                value={assignmentUserSearch}
                onChange={(event) => setAssignmentUserSearch(event.target.value)}
                placeholder={t('authAdmin.userSearchPlaceholder')}
              />
            </label>
            <label className="field-block">
              <span>{t('authAdmin.roleAssignmentUser')}</span>
              <select
                aria-label={t('authAdmin.roleAssignmentUser')}
                value={assignmentForm.userId}
                onChange={(event) => selectAssignmentUser(event.target.value)}
              >
                <option value="">{t('authAdmin.selectUser')}</option>
                {assignmentUserOptions.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.username} - {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>{t('authAdmin.roleAssignmentRole')}</span>
              <select
                aria-label={t('authAdmin.roleAssignmentRole')}
                value={assignmentForm.roleCode}
                onChange={(event) => updateAssignmentForm('roleCode', event.target.value)}
              >
                <option value="">{t('authAdmin.selectRole')}</option>
                {lookups.roles.map((role) => (
                  <option key={role.roleId} value={role.roleCode}>
                    {role.roleCode} - {role.scopeType}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>{t('authAdmin.roleAssignmentScopeType')}</span>
              <select
                aria-label={t('authAdmin.roleAssignmentScopeType')}
                value={assignmentForm.scopeType}
                onChange={(event) => {
                  const scopeType = event.target.value as RoleScopeType
                  if (scopeType !== 'store') {
                    setAssignmentStoreSearch('')
                    setSelectedAssignmentStore(null)
                  }
                  setAssignmentForm((current) => ({
                    ...current,
                    scopeType,
                    regionId: scopeType === 'company' ? '' : current.regionId,
                    storeId: scopeType === 'store' ? current.storeId : '',
                  }))
                }}
              >
                {lookups.scopeTypes.map((scopeType) => (
                  <option key={scopeType} value={scopeType}>
                    {scopeType}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>{t('authAdmin.companyId')}</span>
              <input value={assignmentForm.companyId} onChange={(event) => updateAssignmentForm('companyId', event.target.value)} placeholder={t('authAdmin.companyIdPlaceholder')} />
            </label>
            {assignmentForm.scopeType !== 'company' ? (
              <label className="field-block">
                <span>{t('authAdmin.regionId')}</span>
                <input value={assignmentForm.regionId} onChange={(event) => updateAssignmentForm('regionId', event.target.value)} placeholder={t('authAdmin.regionIdPlaceholder')} />
              </label>
            ) : null}
            {assignmentForm.scopeType === 'store' ? (
              <>
                <label className="field-block">
                  <span>{t('authAdmin.searchStoresForRoleGrant')}</span>
                  <input
                    aria-label={t('authAdmin.searchStoresForRoleGrant')}
                    value={assignmentStoreSearch}
                    onChange={(event) => setAssignmentStoreSearch(event.target.value)}
                    placeholder={t('authAdmin.storeSearchPlaceholder')}
                  />
                </label>
                <label className="field-block">
                  <span>{t('authAdmin.roleAssignmentStore')}</span>
                  <select
                    aria-label={t('authAdmin.roleAssignmentStore')}
                    value={assignmentForm.storeId}
                    onChange={(event) => selectAssignmentStore(event.target.value)}
                  >
                    <option value="">{t('authAdmin.selectStore')}</option>
                    {assignmentStoreOptions.map((store) => (
                      <option key={store.storeId} value={store.storeId}>
                        {store.storeCode} - {store.storeName} - {store.regionName}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <label className="field-block">
              <span>{t('authAdmin.effectiveFrom')}</span>
              <input type="date" value={assignmentForm.effectiveFrom} onChange={(event) => updateAssignmentForm('effectiveFrom', event.target.value)} />
            </label>
            <label className="field-block">
              <span>{t('authAdmin.effectiveTo')}</span>
              <input type="date" value={assignmentForm.effectiveTo} onChange={(event) => updateAssignmentForm('effectiveTo', event.target.value)} />
            </label>
          </div>
          <div className="action-cluster">
            <button
              className="control-button"
              type="button"
              onClick={submitAssignmentForm}
              disabled={
                mutationBusy ||
                !assignmentForm.userId ||
                !assignmentForm.roleCode ||
                !assignmentForm.companyId.trim() ||
                (assignmentForm.scopeType !== 'company' && !assignmentForm.regionId.trim()) ||
                (assignmentForm.scopeType === 'store' && !assignmentForm.storeId.trim())
              }
            >
              {createAssignmentMutation.isPending ? t('authAdmin.creating') : t('authAdmin.createAssignment')}
            </button>
          </div>
        </article>
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('authAdmin.actionStoreAssignmentEyebrow')}</div>
              <h3>{t('authAdmin.assignedStoresTitle')}</h3>
            </div>
          </div>
          <div className="form-grid">
            <label className="field-block">
              <span>{t('authAdmin.searchUsersForActionAccess')}</span>
              <input
                aria-label={t('authAdmin.searchUsersForActionAccess')}
                value={actionStoreUserSearch}
                onChange={(event) => setActionStoreUserSearch(event.target.value)}
                placeholder={t('authAdmin.userSearchPlaceholder')}
              />
            </label>
            <label className="field-block">
              <span>{t('authAdmin.actionAccessUser')}</span>
              <select
                aria-label={t('authAdmin.actionAccessUser')}
                value={actionStoreForm.userId}
                onChange={(event) => selectActionStoreUser(event.target.value)}
              >
                <option value="">{t('authAdmin.selectUser')}</option>
                {actionStoreUserOptions.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.username} - {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>{t('authAdmin.searchStoresForActionAccess')}</span>
              <input
                aria-label={t('authAdmin.searchStoresForActionAccess')}
                value={actionStoreSearch}
                onChange={(event) => setActionStoreSearch(event.target.value)}
                placeholder={t('authAdmin.storeSearchPlaceholder')}
              />
            </label>
            <label className="field-block">
              <span>{t('authAdmin.actionStore')}</span>
              <select
                aria-label={t('authAdmin.actionStore')}
                value={actionStoreForm.storeId}
                onChange={(event) => selectActionStore(event.target.value)}
              >
                <option value="">{t('authAdmin.selectStore')}</option>
                {actionStoreOptions.map((store) => (
                  <option key={store.storeId} value={store.storeId}>
                    {store.storeCode} - {store.storeName} - {store.regionName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>{t('authAdmin.effectiveFrom')}</span>
              <input type="date" value={actionStoreForm.effectiveFrom} onChange={(event) => updateActionStoreForm('effectiveFrom', event.target.value)} />
            </label>
            <label className="field-block">
              <span>{t('authAdmin.effectiveTo')}</span>
              <input type="date" value={actionStoreForm.effectiveTo} onChange={(event) => updateActionStoreForm('effectiveTo', event.target.value)} />
            </label>
          </div>
          <div className="action-cluster">
            <button
              className="control-button"
              type="button"
              onClick={submitActionStoreForm}
              disabled={mutationBusy || !actionStoreForm.userId || !actionStoreForm.storeId}
            >
              {createActionStoreAssignmentMutation.isPending ? t('authAdmin.assigning') : t('authAdmin.assignActionStore')}
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('authAdmin.actionGrants')}</div>
              <h3>{t('authAdmin.storeLevelActionAccess')}</h3>
            </div>
          </div>
          {filteredActionStoreAssignments.length === 0 ? (
            <EmptyState copy={t('authAdmin.noActionStoreAssignments')} />
          ) : (
            <div className="stacked-table">
              {filteredActionStoreAssignments.map((assignment) => (
                <article className="stacked-row" key={assignment.assignmentId}>
                  <div className="stacked-row-head">
                    <div>
                      <strong>{assignment.username}</strong>
                      <span className="queue-subtitle">{assignment.email}</span>
                    </div>
                    <StatusPill tone={assignment.active ? 'calm' : 'danger'}>
                      {assignment.active ? t('authAdmin.active') : t('authAdmin.inactive')}
                    </StatusPill>
                  </div>
                  <div className="key-grid">
                    <KeyValue label={t('authAdmin.store')} value={`${assignment.storeCode} - ${assignment.storeName}`} />
                    <KeyValue label={t('authAdmin.region')} value={assignment.regionName} />
                    <KeyValue label={t('authAdmin.effectiveFrom')} value={assignment.effectiveFrom ? formatDateTime(assignment.effectiveFrom, locale) : t('authAdmin.immediate')} />
                    <KeyValue label={t('authAdmin.storeId')} value={assignment.storeId} />
                  </div>
                  <div className="action-cluster">
                    <Link className="back-link" to={`/admin/auth/action-store-assignments/${assignment.assignmentId}/audit`}>
                      <span>{t('authAdmin.openAudit')}</span>
                    </Link>
                    {assignment.active ? (
                      <button
                        className="control-button"
                        type="button"
                        onClick={() => deactivateActionStoreAssignmentMutation.mutate(assignment.assignmentId)}
                        disabled={mutationBusy}
                      >
                        {deactivateActionStoreAssignmentMutation.isPending ? t('authAdmin.updating') : t('authAdmin.deactivateActionStore')}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('authAdmin.lookupPosture')}</div>
              <h3>{t('authAdmin.adminOptionSets')}</h3>
            </div>
            <Link className="back-link" to="/admin/auth/catalog">
              <span>{t('authAdmin.openCatalog')}</span>
            </Link>
          </div>
          <div className="key-grid">
            <KeyValue label={t('authAdmin.scopeTypes')} value={lookups.scopeTypes.join(', ')} />
            <KeyValue label={t('authAdmin.authProviders')} value={lookups.authProviders.join(', ') || t('authAdmin.none')} />
            <KeyValue label={t('authAdmin.userOptions')} value={String(lookups.optionGroups.users.length)} />
            <KeyValue label={t('authAdmin.roleOptions')} value={String(lookups.optionGroups.roles.length)} />
            <KeyValue label={t('authAdmin.storeOptions')} value={String(lookups.optionGroups.stores.length)} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('authAdmin.recentUsers')}</div>
              <h3>{t('authAdmin.accountInventory')}</h3>
            </div>
          </div>
          {users.length === 0 ? (
            <EmptyState copy={t('authAdmin.noUserAccounts')} />
          ) : (
            <div className="stacked-table">
              {users.slice(0, 6).map((user) => (
                <article className="stacked-row" key={user.userId}>
                  <div className="stacked-row-head">
                    <div>
                      <strong>{user.username}</strong>
                      <span className="queue-subtitle">{user.email}</span>
                    </div>
                    <StatusPill tone={user.isActive ? 'calm' : 'danger'}>
                      {user.isActive ? t('authAdmin.active') : t('authAdmin.inactive')}
                    </StatusPill>
                  </div>
                  <div className="key-grid">
                    <KeyValue label={t('authAdmin.provider')} value={user.authProvider} />
                    <KeyValue label={t('authAdmin.created')} value={formatDateTime(user.createdAt, locale)} />
                    <KeyValue label={t('authAdmin.employeeStatus')} value={user.employeeStatus ?? t('authAdmin.unlinked')} />
                    <KeyValue
                      label={t('authAdmin.deactivated')}
                      value={user.deactivatedAt ? formatDateTime(user.deactivatedAt, locale) : t('authAdmin.no')}
                    />
                    <KeyValue
                      label={t('authAdmin.deactivationReason')}
                      value={user.deactivationReason ?? t('authAdmin.none')}
                    />
                  </div>
                  <div className="action-cluster">
                    <Link className="back-link" to={`/admin/auth/users/${user.userId}/audit`}>
                      <span>{t('authAdmin.openAudit')}</span>
                    </Link>
                    {user.isActive ? (
                      <button
                        className="control-button"
                        type="button"
                        onClick={() => {
                          const confirmed = window.confirm(
                            t('authAdmin.deactivateUserConfirm'),
                          )
                          if (confirmed) {
                            deactivateUserMutation.mutate(user.userId)
                          }
                        }}
                        disabled={mutationBusy}
                      >
                        {deactivateUserMutation.isPending ? t('authAdmin.updating') : t('authAdmin.deactivateUser')}
                      </button>
                    ) : (
                      <button
                        className="control-button"
                        type="button"
                        onClick={() => reactivateUserMutation.mutate(user.userId)}
                        disabled={mutationBusy}
                      >
                        {reactivateUserMutation.isPending ? t('authAdmin.updating') : t('authAdmin.reactivateUser')}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">{t('authAdmin.scopedGrants')}</div>
            <h3>{t('authAdmin.roleAssignmentQueue')}</h3>
            <p className="panel-copy">{t('authAdmin.assignmentSearchCopy')}</p>
          </div>
          <label className="search-field">
            <span className="sr-only">{t('authAdmin.filterAssignments')}</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('authAdmin.assignmentSearchPlaceholder')}
            />
          </label>
        </div>

        {filteredAssignments.length === 0 ? (
          <EmptyState
            title={t('authAdmin.noAssignmentsMatched')}
            copy={t('authAdmin.clearSearchForInventory')}
          />
        ) : (
          <div className="stacked-table">
            {filteredAssignments.map((assignment) => (
              <article className="stacked-row" key={assignment.assignmentId}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{assignment.username}</strong>
                    <span className="queue-subtitle">{assignment.email}</span>
                  </div>
                  <StatusPill tone={assignment.active ? 'calm' : 'danger'}>
                    {assignment.active ? t('authAdmin.active') : t('authAdmin.inactive')}
                  </StatusPill>
                </div>

                <div className="key-grid">
                  <KeyValue label={t('authAdmin.role')} value={`${assignment.roleCode} · ${assignment.roleName}`} />
                  <KeyValue label={t('authAdmin.scopeType')} value={assignment.scopeType} />
                  <KeyValue label={t('authAdmin.company')} value={assignment.companyId ?? t('authAdmin.notAvailable')} />
                  <KeyValue label={t('authAdmin.region')} value={assignment.regionId ?? t('authAdmin.notAvailable')} />
                  <KeyValue label={t('authAdmin.store')} value={assignment.storeId ?? t('authAdmin.notAvailable')} />
                  <KeyValue label={t('authAdmin.effectiveFrom')} value={assignment.effectiveFrom ? formatDateTime(assignment.effectiveFrom, locale) : t('authAdmin.immediate')} />
                </div>
                {assignment.active ? (
                  <div className="action-cluster">
                    <Link className="back-link" to={`/admin/auth/role-assignments/${assignment.assignmentId}/audit`}>
                      <span>{t('authAdmin.openAudit')}</span>
                    </Link>
                    <button
                      className="control-button"
                      type="button"
                      onClick={() => deactivateAssignmentMutation.mutate(assignment.assignmentId)}
                      disabled={mutationBusy}
                    >
                      {deactivateAssignmentMutation.isPending ? t('authAdmin.updating') : t('authAdmin.deactivateAssignment')}
                    </button>
                  </div>
                ) : (
                  <div className="action-cluster">
                    <Link className="back-link" to={`/admin/auth/role-assignments/${assignment.assignmentId}/audit`}>
                      <span>{t('authAdmin.openAudit')}</span>
                    </Link>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
