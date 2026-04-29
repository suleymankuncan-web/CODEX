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
} from '../features/auth/api'
import { PilotUserBindingPanel } from '../features/auth/PilotUserBindingPanel'
import { formatDateTime, getErrorMessage } from '../lib/format'

type RoleScopeType = 'company' | 'region' | 'store'
type AuthProvider = 'local' | 'oidc' | 'sso'

export function AuthDashboardPage() {
  const [search, setSearch] = useState('')
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
  const queryClient = useQueryClient()

  const lookupsQuery = useQuery({
    queryKey: ['auth-lookups'],
    queryFn: getAuthLookups,
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
      setFeedback(response.command.message)
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
    return <ScreenState title="Loading auth admin" copy="Pulling user accounts, assignments, and lookup catalogs." />
  }

  if (lookupsQuery.isError) {
    return <ScreenState title="Auth lookups unavailable" copy={getErrorMessage(lookupsQuery.error)} tone="error" />
  }

  if (usersQuery.isError) {
    return <ScreenState title="User accounts unavailable" copy={getErrorMessage(usersQuery.error)} tone="error" />
  }

  if (assignmentsQuery.isError) {
    return <ScreenState title="Role assignments unavailable" copy={getErrorMessage(assignmentsQuery.error)} tone="error" />
  }

  if (actionStoreAssignmentsQuery.isError) {
    return <ScreenState title="Action store assignments unavailable" copy={getErrorMessage(actionStoreAssignmentsQuery.error)} tone="error" />
  }

  if (!lookups) {
    return <ScreenState title="Auth lookups unavailable" copy="No auth lookup payload was returned." tone="error" />
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
  const providerOptions = Array.from(new Set<AuthProvider>(['local', 'oidc', 'sso', ...lookups.authProviders as AuthProvider[]]))

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
          <div className="eyebrow">Auth Admin</div>
          <h2 className="hero-title">Users, roles, and scope posture in one operator view.</h2>
          <p className="hero-copy">
            This surface is about control hygiene: who exists, who is active, which scoped roles shape
            access, and how quickly an admin can correct drift.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Users" value={String(lookups.meta.totalUsers)} />
          <MetricAccent label="Roles" value={String(lookups.meta.totalRoles)} />
          <MetricAccent label="Permissions" value={String(lookups.meta.totalPermissions)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title="Active users" value={activeUsers} note={`${users.length - activeUsers} inactive accounts`} icon={<Users size={18} />} tone="calm" />
        <MetricCard title="Assignments" value={assignments.length} note={`${activeAssignments} active role grants`} icon={<UserCog size={18} />} tone="accent" />
        <MetricCard title="Action stores" value={actionStoreAssignments.length} note={`${activeActionStores} active store action grants`} icon={<MapPin size={18} />} tone="calm" />
        <MetricCard title="Role catalog" value={lookups.meta.totalRoles} note="Distinct roles available to admins" icon={<ShieldCheck size={18} />} tone="warning" />
        <MetricCard title="Permission catalog" value={lookups.meta.totalPermissions} note="Action-level capabilities defined in ops" icon={<KeyRound size={18} />} tone="danger" />
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
              <div className="eyebrow">Create user</div>
              <h3>New account</h3>
            </div>
            <Link className="back-link" to="/admin/auth/catalog">
              <span>Open catalog</span>
            </Link>
          </div>
          <div className="form-grid">
            <label className="field-block">
              <span>Username</span>
              <input value={userForm.username} onChange={(event) => updateUserForm('username', event.target.value)} placeholder="new.admin" />
            </label>
            <label className="field-block">
              <span>Email</span>
              <input value={userForm.email} onChange={(event) => updateUserForm('email', event.target.value)} placeholder="new.admin@example.com" />
            </label>
            <label className="field-block">
              <span>Auth provider</span>
              <select value={userForm.authProvider} onChange={(event) => updateUserForm('authProvider', event.target.value as AuthProvider)}>
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>Employee id</span>
              <input value={userForm.employeeId} onChange={(event) => updateUserForm('employeeId', event.target.value)} placeholder="optional employee uuid" />
            </label>
          </div>
          <div className="action-cluster">
            <button
              className="control-button"
              type="button"
              onClick={submitUserForm}
              disabled={mutationBusy || !userForm.username.trim() || !userForm.email.trim()}
            >
              {createUserMutation.isPending ? 'Creating...' : 'Create user'}
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Create assignment</div>
              <h3>Scoped role grant</h3>
            </div>
          </div>
          <div className="form-grid">
            <label className="field-block">
              <span>User</span>
              <select value={assignmentForm.userId} onChange={(event) => updateAssignmentForm('userId', event.target.value)}>
                <option value="">Select user</option>
                {lookups.users.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.username} - {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>Role</span>
              <select value={assignmentForm.roleCode} onChange={(event) => updateAssignmentForm('roleCode', event.target.value)}>
                <option value="">Select role</option>
                {lookups.roles.map((role) => (
                  <option key={role.roleId} value={role.roleCode}>
                    {role.roleCode} - {role.scopeType}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>Scope type</span>
              <select
                value={assignmentForm.scopeType}
                onChange={(event) => {
                  const scopeType = event.target.value as RoleScopeType
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
              <span>Company id</span>
              <input value={assignmentForm.companyId} onChange={(event) => updateAssignmentForm('companyId', event.target.value)} placeholder="required for every scope" />
            </label>
            {assignmentForm.scopeType !== 'company' ? (
              <label className="field-block">
                <span>Region id</span>
                <input value={assignmentForm.regionId} onChange={(event) => updateAssignmentForm('regionId', event.target.value)} placeholder="required for region/store scope" />
              </label>
            ) : null}
            {assignmentForm.scopeType === 'store' ? (
              <label className="field-block">
                <span>Store id</span>
                <input value={assignmentForm.storeId} onChange={(event) => updateAssignmentForm('storeId', event.target.value)} placeholder="required for store scope" />
              </label>
            ) : null}
            <label className="field-block">
              <span>Effective from</span>
              <input type="date" value={assignmentForm.effectiveFrom} onChange={(event) => updateAssignmentForm('effectiveFrom', event.target.value)} />
            </label>
            <label className="field-block">
              <span>Effective to</span>
              <input type="date" value={assignmentForm.effectiveTo} onChange={(event) => updateAssignmentForm('effectiveTo', event.target.value)} />
            </label>
          </div>
          <div className="action-cluster">
            <button
              className="control-button"
              type="button"
              onClick={submitAssignmentForm}
              disabled={mutationBusy || !assignmentForm.userId || !assignmentForm.roleCode || !assignmentForm.companyId.trim()}
            >
              {createAssignmentMutation.isPending ? 'Creating...' : 'Create assignment'}
            </button>
          </div>
        </article>
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Action store assignment</div>
              <h3>Assigned stores for operational actions</h3>
            </div>
          </div>
          <div className="form-grid">
            <label className="field-block">
              <span>User</span>
              <select value={actionStoreForm.userId} onChange={(event) => updateActionStoreForm('userId', event.target.value)}>
                <option value="">Select user</option>
                {lookups.users.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.username} - {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>Store</span>
              <select value={actionStoreForm.storeId} onChange={(event) => updateActionStoreForm('storeId', event.target.value)}>
                <option value="">Select store</option>
                {lookups.stores.map((store) => (
                  <option key={store.storeId} value={store.storeId}>
                    {store.storeCode} - {store.storeName} - {store.regionName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>Effective from</span>
              <input type="date" value={actionStoreForm.effectiveFrom} onChange={(event) => updateActionStoreForm('effectiveFrom', event.target.value)} />
            </label>
            <label className="field-block">
              <span>Effective to</span>
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
              {createActionStoreAssignmentMutation.isPending ? 'Assigning...' : 'Assign action store'}
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Action grants</div>
              <h3>Store-level action access</h3>
            </div>
          </div>
          {filteredActionStoreAssignments.length === 0 ? (
            <EmptyState copy="No action store assignments matched the current filter." />
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
                      {assignment.active ? 'Active' : 'Inactive'}
                    </StatusPill>
                  </div>
                  <div className="key-grid">
                    <KeyValue label="Store" value={`${assignment.storeCode} - ${assignment.storeName}`} />
                    <KeyValue label="Region" value={assignment.regionName} />
                    <KeyValue label="Effective from" value={assignment.effectiveFrom ? formatDateTime(assignment.effectiveFrom) : 'Immediate'} />
                    <KeyValue label="Store id" value={assignment.storeId} />
                  </div>
                  <div className="action-cluster">
                    <Link className="back-link" to={`/admin/auth/action-store-assignments/${assignment.assignmentId}/audit`}>
                      <span>Open audit</span>
                    </Link>
                    {assignment.active ? (
                      <button
                        className="control-button"
                        type="button"
                        onClick={() => deactivateActionStoreAssignmentMutation.mutate(assignment.assignmentId)}
                        disabled={mutationBusy}
                      >
                        {deactivateActionStoreAssignmentMutation.isPending ? 'Updating...' : 'Deactivate action store'}
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
              <div className="eyebrow">Lookup posture</div>
              <h3>Admin option sets</h3>
            </div>
            <Link className="back-link" to="/admin/auth/catalog">
              <span>Open catalog</span>
            </Link>
          </div>
          <div className="key-grid">
            <KeyValue label="Scope types" value={lookups.scopeTypes.join(', ')} />
            <KeyValue label="Auth providers" value={lookups.authProviders.join(', ') || 'None'} />
            <KeyValue label="User options" value={String(lookups.optionGroups.users.length)} />
            <KeyValue label="Role options" value={String(lookups.optionGroups.roles.length)} />
            <KeyValue label="Store options" value={String(lookups.optionGroups.stores.length)} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Recent users</div>
              <h3>Account inventory</h3>
            </div>
          </div>
          {users.length === 0 ? (
            <EmptyState copy="No user accounts are available yet." />
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
                      {user.isActive ? 'Active' : 'Inactive'}
                    </StatusPill>
                  </div>
                  <div className="key-grid">
                    <KeyValue label="Provider" value={user.authProvider} />
                    <KeyValue label="Created" value={formatDateTime(user.createdAt)} />
                  </div>
                  <div className="action-cluster">
                    <Link className="back-link" to={`/admin/auth/users/${user.userId}/audit`}>
                      <span>Open audit</span>
                    </Link>
                    {user.isActive ? (
                      <button
                        className="control-button"
                        type="button"
                        onClick={() => deactivateUserMutation.mutate(user.userId)}
                        disabled={mutationBusy}
                      >
                        {deactivateUserMutation.isPending ? 'Updating...' : 'Deactivate user'}
                      </button>
                    ) : (
                      <button
                        className="control-button"
                        type="button"
                        onClick={() => reactivateUserMutation.mutate(user.userId)}
                        disabled={mutationBusy}
                      >
                        {reactivateUserMutation.isPending ? 'Updating...' : 'Reactivate user'}
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
            <div className="eyebrow">Role assignment queue</div>
            <h3>Scoped grants</h3>
            <p className="panel-copy">
              Search by user, role, store, or scope identifiers to inspect the current access map.
            </p>
          </div>
          <label className="search-field">
            <span className="sr-only">Filter auth assignments</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by user, role, store, scope, or id"
            />
          </label>
        </div>

        {filteredAssignments.length === 0 ? (
          <EmptyState
            title="No assignments matched your filter."
            copy="Clear the search to inspect the full role assignment inventory."
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
                    {assignment.active ? 'Active' : 'Inactive'}
                  </StatusPill>
                </div>

                <div className="key-grid">
                  <KeyValue label="Role" value={`${assignment.roleCode} · ${assignment.roleName}`} />
                  <KeyValue label="Scope type" value={assignment.scopeType} />
                  <KeyValue label="Company" value={assignment.companyId ?? 'n/a'} />
                  <KeyValue label="Region" value={assignment.regionId ?? 'n/a'} />
                  <KeyValue label="Store" value={assignment.storeId ?? 'n/a'} />
                  <KeyValue label="Effective from" value={assignment.effectiveFrom ? formatDateTime(assignment.effectiveFrom) : 'Immediate'} />
                </div>
                {assignment.active ? (
                  <div className="action-cluster">
                    <Link className="back-link" to={`/admin/auth/role-assignments/${assignment.assignmentId}/audit`}>
                      <span>Open audit</span>
                    </Link>
                    <button
                      className="control-button"
                      type="button"
                      onClick={() => deactivateAssignmentMutation.mutate(assignment.assignmentId)}
                      disabled={mutationBusy}
                    >
                      {deactivateAssignmentMutation.isPending ? 'Updating...' : 'Deactivate assignment'}
                    </button>
                  </div>
                ) : (
                  <div className="action-cluster">
                    <Link className="back-link" to={`/admin/auth/role-assignments/${assignment.assignmentId}/audit`}>
                      <span>Open audit</span>
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
