import { useDeferredValue, useMemo, useReducer } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScreenState } from '../components/dashboard-primitives'
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
  type CreateRoleAssignmentInput,
} from '../features/auth/api'
import {
  AuthDashboardContent,
  type AuthActionStoreFormState,
  type AuthAssignmentFormState,
  type AuthDashboardContentProps,
  type AuthProvider,
  type AuthUserFormState,
  type RoleScopeType,
} from '../features/auth/AuthDashboardSections'
import { useLocalization } from '../features/localization/useLocalization'
import { getErrorMessage } from '../lib/format'

type AuthDashboardState = {
  search: string
  assignmentUserSearch: string
  assignmentStoreSearch: string
  actionStoreUserSearch: string
  actionStoreSearch: string
  selectedAssignmentUser: AuthLookupUser | null
  selectedAssignmentStore: AuthLookupStore | null
  selectedActionStoreUser: AuthLookupUser | null
  selectedActionStore: AuthLookupStore | null
  feedback: string | null
  errorFeedback: string | null
  userForm: AuthUserFormState
  assignmentForm: AuthAssignmentFormState
  actionStoreForm: AuthActionStoreFormState
}

type AuthDashboardAction =
  | { type: 'setSearch'; value: string }
  | { type: 'setAssignmentUserSearch'; value: string }
  | { type: 'setAssignmentStoreSearch'; value: string }
  | { type: 'setActionStoreUserSearch'; value: string }
  | { type: 'setActionStoreSearch'; value: string }
  | { type: 'setErrorFeedback'; message: string | null }
  | { type: 'clearFeedback' }
  | { type: 'createUserSucceeded'; message: string }
  | { type: 'createAssignmentSucceeded'; message: string }
  | { type: 'createActionStoreSucceeded'; message: string }
  | { type: 'mutationSucceeded'; message: string }
  | { type: 'userClosed'; message: string }
  | { type: 'updateUserForm'; form: AuthUserFormState }
  | { type: 'updateAssignmentForm'; form: AuthAssignmentFormState }
  | { type: 'updateActionStoreForm'; form: AuthActionStoreFormState }
  | { type: 'selectAssignmentUser'; user: AuthLookupUser | null; userId: string }
  | { type: 'selectAssignmentStore'; store: AuthLookupStore | null; storeId: string }
  | { type: 'selectActionStoreUser'; user: AuthLookupUser | null; userId: string }
  | { type: 'selectActionStore'; store: AuthLookupStore | null; storeId: string }
  | { type: 'setAssignmentScopeType'; scopeType: RoleScopeType }

const initialAuthUserForm: AuthUserFormState = {
  employeeId: '',
  username: '',
  email: '',
  authProvider: 'oidc',
}

const initialAuthAssignmentForm: AuthAssignmentFormState = {
  userId: '',
  roleCode: '',
  scopeType: 'company',
  companyId: '',
  regionId: '',
  storeId: '',
  effectiveFrom: '',
  effectiveTo: '',
}

const initialAuthActionStoreForm: AuthActionStoreFormState = {
  userId: '',
  storeId: '',
  effectiveFrom: '',
  effectiveTo: '',
}

const initialAuthDashboardState: AuthDashboardState = {
  search: '',
  assignmentUserSearch: '',
  assignmentStoreSearch: '',
  actionStoreUserSearch: '',
  actionStoreSearch: '',
  selectedAssignmentUser: null,
  selectedAssignmentStore: null,
  selectedActionStoreUser: null,
  selectedActionStore: null,
  feedback: null,
  errorFeedback: null,
  userForm: initialAuthUserForm,
  assignmentForm: initialAuthAssignmentForm,
  actionStoreForm: initialAuthActionStoreForm,
}

function authDashboardReducer(
  state: AuthDashboardState,
  action: AuthDashboardAction,
): AuthDashboardState {
  switch (action.type) {
    case 'setSearch':
      return { ...state, search: action.value }
    case 'setAssignmentUserSearch':
      return { ...state, assignmentUserSearch: action.value }
    case 'setAssignmentStoreSearch':
      return { ...state, assignmentStoreSearch: action.value }
    case 'setActionStoreUserSearch':
      return { ...state, actionStoreUserSearch: action.value }
    case 'setActionStoreSearch':
      return { ...state, actionStoreSearch: action.value }
    case 'setErrorFeedback':
      return { ...state, errorFeedback: action.message }
    case 'clearFeedback':
      return { ...state, feedback: null, errorFeedback: null }
    case 'createUserSucceeded':
      return { ...state, feedback: action.message, errorFeedback: null, userForm: initialAuthUserForm }
    case 'createAssignmentSucceeded':
      return {
        ...state,
        feedback: action.message,
        errorFeedback: null,
        assignmentForm: initialAuthAssignmentForm,
        assignmentUserSearch: '',
        assignmentStoreSearch: '',
        selectedAssignmentUser: null,
        selectedAssignmentStore: null,
      }
    case 'createActionStoreSucceeded':
      return {
        ...state,
        feedback: action.message,
        errorFeedback: null,
        actionStoreForm: initialAuthActionStoreForm,
        actionStoreUserSearch: '',
        actionStoreSearch: '',
        selectedActionStoreUser: null,
        selectedActionStore: null,
      }
    case 'mutationSucceeded':
    case 'userClosed':
      return { ...state, feedback: action.message, errorFeedback: null }
    case 'updateUserForm':
      return { ...state, userForm: action.form }
    case 'updateAssignmentForm':
      return { ...state, assignmentForm: action.form }
    case 'updateActionStoreForm':
      return { ...state, actionStoreForm: action.form }
    case 'selectAssignmentUser':
      return {
        ...state,
        selectedAssignmentUser: action.user,
        assignmentForm: { ...state.assignmentForm, userId: action.userId },
      }
    case 'selectAssignmentStore':
      return {
        ...state,
        selectedAssignmentStore: action.store,
        assignmentForm: {
          ...state.assignmentForm,
          storeId: action.storeId,
          companyId: action.store?.companyId ?? state.assignmentForm.companyId,
          regionId: action.store?.regionId ?? state.assignmentForm.regionId,
        },
      }
    case 'selectActionStoreUser':
      return {
        ...state,
        selectedActionStoreUser: action.user,
        actionStoreForm: { ...state.actionStoreForm, userId: action.userId },
      }
    case 'selectActionStore':
      return {
        ...state,
        selectedActionStore: action.store,
        actionStoreForm: { ...state.actionStoreForm, storeId: action.storeId },
      }
    case 'setAssignmentScopeType':
      return {
        ...state,
        assignmentStoreSearch: action.scopeType === 'store' ? state.assignmentStoreSearch : '',
        selectedAssignmentStore: action.scopeType === 'store' ? state.selectedAssignmentStore : null,
        assignmentForm: {
          ...state.assignmentForm,
          scopeType: action.scopeType,
          regionId: action.scopeType === 'company' ? '' : state.assignmentForm.regionId,
          storeId: action.scopeType === 'store' ? state.assignmentForm.storeId : '',
        },
      }
    default:
      return state
  }
}

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

type AuthDashboardViewModel =
  | {
      status: 'screen'
      title: string
      copy: string
      tone?: 'error'
    }
  | ({ status: 'ready' } & AuthDashboardContentProps)

export function AuthDashboardPage() {
  const dashboard = useAuthDashboardViewModel()

  if (dashboard.status === 'screen') {
    return (
      <ScreenState
        title={dashboard.title}
        copy={dashboard.copy}
        {...(dashboard.tone === undefined ? {} : { tone: dashboard.tone })}
      />
    )
  }

  return <AuthDashboardContent {...dashboard} />
}

function useAuthDashboardViewModel(): AuthDashboardViewModel {
  const [authState, dispatchAuthState] = useReducer(
    authDashboardReducer,
    initialAuthDashboardState,
  )
  const {
    search,
    assignmentUserSearch,
    assignmentStoreSearch,
    actionStoreUserSearch,
    actionStoreSearch,
    selectedAssignmentUser,
    selectedAssignmentStore,
    selectedActionStoreUser,
    selectedActionStore,
    feedback,
    errorFeedback,
    userForm,
    assignmentForm,
    actionStoreForm,
  } = authState
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

  const createUserMutation = useMutation({
    mutationFn: createUserAccount,
    onSuccess: async (response) => {
      dispatchAuthState({ type: 'createUserSucceeded', message: response.command.message })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['auth-users'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-lookups'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-role-assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-action-store-assignments'] }),
      ])
    },
    onError: (error) => {
      dispatchAuthState({ type: 'setErrorFeedback', message: getErrorMessage(error) })
    },
  })
  const createAssignmentMutation = useMutation({
    mutationFn: createRoleAssignment,
    onSuccess: async (response) => {
      dispatchAuthState({ type: 'createAssignmentSucceeded', message: response.command.message })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['auth-users'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-lookups'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-role-assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-action-store-assignments'] }),
      ])
    },
    onError: (error) => {
      dispatchAuthState({ type: 'setErrorFeedback', message: getErrorMessage(error) })
    },
  })
  const createActionStoreAssignmentMutation = useMutation({
    mutationFn: createActionStoreAssignment,
    onSuccess: async (response) => {
      dispatchAuthState({ type: 'createActionStoreSucceeded', message: response.command.message })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['auth-users'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-lookups'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-role-assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-action-store-assignments'] }),
      ])
    },
    onError: (error) => {
      dispatchAuthState({ type: 'setErrorFeedback', message: getErrorMessage(error) })
    },
  })
  const deactivateAssignmentMutation = useMutation({
    mutationFn: deactivateRoleAssignment,
    onSuccess: async (response) => {
      dispatchAuthState({ type: 'mutationSucceeded', message: response.command.message })
      await queryClient.invalidateQueries({ queryKey: ['auth-role-assignments'] })
    },
    onError: (error) => {
      dispatchAuthState({ type: 'setErrorFeedback', message: getErrorMessage(error) })
    },
  })
  const deactivateActionStoreAssignmentMutation = useMutation({
    mutationFn: deactivateActionStoreAssignment,
    onSuccess: async (response) => {
      dispatchAuthState({ type: 'mutationSucceeded', message: response.command.message })
      await queryClient.invalidateQueries({ queryKey: ['auth-action-store-assignments'] })
    },
    onError: (error) => {
      dispatchAuthState({ type: 'setErrorFeedback', message: getErrorMessage(error) })
    },
  })
  const deactivateUserMutation = useMutation({
    mutationFn: deactivateUserAccount,
    onSuccess: async (response) => {
      const closure = response.data.accessClosure
      dispatchAuthState({
        type: 'userClosed',
        message: t('authAdmin.userClosureFeedback', {
          message: response.command.message,
          roleCount: closure.closedRoleAssignments,
          actionStoreCount: closure.closedActionStoreAssignments,
          sessionCount: closure.revokedMobileSessions,
        }),
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['auth-users'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-lookups'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-role-assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-action-store-assignments'] }),
      ])
    },
    onError: (error) => {
      dispatchAuthState({ type: 'setErrorFeedback', message: getErrorMessage(error) })
    },
  })
  const reactivateUserMutation = useMutation({
    mutationFn: reactivateUserAccount,
    onSuccess: async (response) => {
      dispatchAuthState({ type: 'mutationSucceeded', message: response.command.message })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['auth-users'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-lookups'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-role-assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-action-store-assignments'] }),
      ])
    },
    onError: (error) => {
      dispatchAuthState({ type: 'setErrorFeedback', message: getErrorMessage(error) })
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
    return {
      status: 'screen',
      title: t('authAdmin.loadingTitle'),
      copy: t('authAdmin.loadingCopy'),
    }
  }

  if (lookupsQuery.isError) {
    return {
      status: 'screen',
      title: t('authAdmin.lookupsUnavailable'),
      copy: getErrorMessage(lookupsQuery.error),
      tone: 'error',
    }
  }

  if (usersQuery.isError) {
    return {
      status: 'screen',
      title: t('authAdmin.usersUnavailable'),
      copy: getErrorMessage(usersQuery.error),
      tone: 'error',
    }
  }

  if (assignmentsQuery.isError) {
    return {
      status: 'screen',
      title: t('authAdmin.assignmentsUnavailable'),
      copy: getErrorMessage(assignmentsQuery.error),
      tone: 'error',
    }
  }

  if (actionStoreAssignmentsQuery.isError) {
    return {
      status: 'screen',
      title: t('authAdmin.actionStoresUnavailable'),
      copy: getErrorMessage(actionStoreAssignmentsQuery.error),
      tone: 'error',
    }
  }

  if (!lookups) {
    return {
      status: 'screen',
      title: t('authAdmin.lookupsUnavailable'),
      copy: t('authAdmin.noLookupPayload'),
      tone: 'error',
    }
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
    dispatchAuthState({ type: 'updateUserForm', form: { ...userForm, [key]: value } })
  }

  function updateAssignmentForm<K extends keyof typeof assignmentForm>(
    key: K,
    value: (typeof assignmentForm)[K],
  ) {
    dispatchAuthState({ type: 'updateAssignmentForm', form: { ...assignmentForm, [key]: value } })
  }

  function updateActionStoreForm<K extends keyof typeof actionStoreForm>(
    key: K,
    value: (typeof actionStoreForm)[K],
  ) {
    dispatchAuthState({ type: 'updateActionStoreForm', form: { ...actionStoreForm, [key]: value } })
  }

  function selectAssignmentUser(userId: string) {
    const user = assignmentUserOptions.find((item) => item.userId === userId) ?? null
    dispatchAuthState({ type: 'selectAssignmentUser', user, userId })
  }

  function selectAssignmentStore(storeId: string) {
    const store = assignmentStoreOptions.find((item) => item.storeId === storeId) ?? null
    dispatchAuthState({ type: 'selectAssignmentStore', store, storeId })
  }

  function selectActionStoreUser(userId: string) {
    const user = actionStoreUserOptions.find((item) => item.userId === userId) ?? null
    dispatchAuthState({ type: 'selectActionStoreUser', user, userId })
  }

  function selectActionStore(storeId: string) {
    const store = actionStoreOptions.find((item) => item.storeId === storeId) ?? null
    dispatchAuthState({ type: 'selectActionStore', store, storeId })
  }

  function submitUserForm() {
    dispatchAuthState({ type: 'clearFeedback' })
    createUserMutation.mutate({
      username: userForm.username.trim(),
      email: userForm.email.trim(),
      authProvider: userForm.authProvider,
      ...(userForm.employeeId.trim() ? { employeeId: userForm.employeeId.trim() } : {}),
    })
  }

  function submitAssignmentForm() {
    dispatchAuthState({ type: 'clearFeedback' })
    createAssignmentMutation.mutate({
      userId: assignmentForm.userId,
      roleCode: assignmentForm.roleCode as CreateRoleAssignmentInput['roleCode'],
      scopeType: assignmentForm.scopeType,
      ...(assignmentForm.companyId.trim() ? { companyId: assignmentForm.companyId.trim() } : {}),
      ...(assignmentForm.regionId.trim() ? { regionId: assignmentForm.regionId.trim() } : {}),
      ...(assignmentForm.storeId.trim() ? { storeId: assignmentForm.storeId.trim() } : {}),
      ...(assignmentForm.effectiveFrom ? { effectiveFrom: assignmentForm.effectiveFrom } : {}),
      ...(assignmentForm.effectiveTo ? { effectiveTo: assignmentForm.effectiveTo } : {}),
    })
  }

  function submitActionStoreForm() {
    dispatchAuthState({ type: 'clearFeedback' })
    createActionStoreAssignmentMutation.mutate({
      userId: actionStoreForm.userId,
      storeId: actionStoreForm.storeId,
      ...(actionStoreForm.effectiveFrom ? { effectiveFrom: actionStoreForm.effectiveFrom } : {}),
      ...(actionStoreForm.effectiveTo ? { effectiveTo: actionStoreForm.effectiveTo } : {}),
    })
  }

  return {
    status: 'ready',
    locale,
    t,
    lookups,
    users,
    assignments,
    actionStoreAssignments,
    filteredAssignments,
    filteredActionStoreAssignments,
    activeUsers,
    activeAssignments,
    activeActionStores,
    providerOptions,
    feedback,
    errorFeedback,
    search,
    assignmentUserSearch,
    assignmentStoreSearch,
    actionStoreUserSearch,
    actionStoreSearch,
    userForm,
    assignmentForm,
    actionStoreForm,
    assignmentUserOptions,
    assignmentStoreOptions,
    actionStoreUserOptions,
    actionStoreOptions,
    mutationBusy,
    pending: {
      createUser: createUserMutation.isPending,
      createAssignment: createAssignmentMutation.isPending,
      createActionStoreAssignment: createActionStoreAssignmentMutation.isPending,
      deactivateAssignment: deactivateAssignmentMutation.isPending,
      deactivateActionStoreAssignment: deactivateActionStoreAssignmentMutation.isPending,
      deactivateUser: deactivateUserMutation.isPending,
      reactivateUser: reactivateUserMutation.isPending,
    },
    onSetSearch: (value: string) => dispatchAuthState({ type: 'setSearch', value }),
    onSetAssignmentUserSearch: (value: string) =>
      dispatchAuthState({ type: 'setAssignmentUserSearch', value }),
    onSetAssignmentStoreSearch: (value: string) =>
      dispatchAuthState({ type: 'setAssignmentStoreSearch', value }),
    onSetActionStoreUserSearch: (value: string) =>
      dispatchAuthState({ type: 'setActionStoreUserSearch', value }),
    onSetActionStoreSearch: (value: string) =>
      dispatchAuthState({ type: 'setActionStoreSearch', value }),
    onUpdateUserForm: updateUserForm,
    onUpdateAssignmentForm: updateAssignmentForm,
    onUpdateActionStoreForm: updateActionStoreForm,
    onSetAssignmentScopeType: (scopeType: RoleScopeType) =>
      dispatchAuthState({ type: 'setAssignmentScopeType', scopeType }),
    onSelectAssignmentUser: selectAssignmentUser,
    onSelectAssignmentStore: selectAssignmentStore,
    onSelectActionStoreUser: selectActionStoreUser,
    onSelectActionStore: selectActionStore,
    onSubmitUserForm: submitUserForm,
    onSubmitAssignmentForm: submitAssignmentForm,
    onSubmitActionStoreForm: submitActionStoreForm,
    onDeactivateAssignment: (assignmentId: string) =>
      deactivateAssignmentMutation.mutate(assignmentId),
    onDeactivateActionStoreAssignment: (assignmentId: string) =>
      deactivateActionStoreAssignmentMutation.mutate(assignmentId),
    onDeactivateUser: (userId: string) => deactivateUserMutation.mutate(userId),
    onReactivateUser: (userId: string) => reactivateUserMutation.mutate(userId),
  }
}
