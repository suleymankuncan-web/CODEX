import { Link } from 'react-router-dom'
import { KeyRound, MapPin, ShieldCheck, UserCog, Users } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  StatusPill,
} from '../../components/dashboard-primitives'
import { formatDateTime } from '../../lib/format'
import type {
  ActionStoreAssignment,
  AuthLookupStore,
  AuthLookupUser,
  AuthLookups,
  RoleAssignment,
  UserAccount,
} from './api'
import { PilotUserBindingPanel } from './PilotUserBindingPanel'
import type { LocalizationContextValue } from '../localization/localization-context'

export type RoleScopeType = 'company' | 'region' | 'store'
export type AuthProvider = 'local' | 'oidc' | 'sso' | 'clerk'

export type AuthUserFormState = {
  employeeId: string
  username: string
  email: string
  authProvider: AuthProvider
}

export type AuthAssignmentFormState = {
  userId: string
  roleCode: string
  scopeType: RoleScopeType
  companyId: string
  regionId: string
  storeId: string
  effectiveFrom: string
  effectiveTo: string
}

export type AuthActionStoreFormState = {
  userId: string
  storeId: string
  effectiveFrom: string
  effectiveTo: string
}

type Translate = LocalizationContextValue['t']
type Locale = LocalizationContextValue['locale']

type AuthPendingState = {
  createUser: boolean
  createAssignment: boolean
  createActionStoreAssignment: boolean
  deactivateAssignment: boolean
  deactivateActionStoreAssignment: boolean
  deactivateUser: boolean
  reactivateUser: boolean
}

export type AuthDashboardContentProps = {
  locale: Locale
  t: Translate
  lookups: AuthLookups
  users: UserAccount[]
  assignments: RoleAssignment[]
  actionStoreAssignments: ActionStoreAssignment[]
  filteredAssignments: RoleAssignment[]
  filteredActionStoreAssignments: ActionStoreAssignment[]
  activeUsers: number
  activeAssignments: number
  activeActionStores: number
  providerOptions: AuthProvider[]
  feedback: string | null
  errorFeedback: string | null
  search: string
  assignmentUserSearch: string
  assignmentStoreSearch: string
  actionStoreUserSearch: string
  actionStoreSearch: string
  userForm: AuthUserFormState
  assignmentForm: AuthAssignmentFormState
  actionStoreForm: AuthActionStoreFormState
  assignmentUserOptions: AuthLookupUser[]
  assignmentStoreOptions: AuthLookupStore[]
  actionStoreUserOptions: AuthLookupUser[]
  actionStoreOptions: AuthLookupStore[]
  mutationBusy: boolean
  pending: AuthPendingState
  onSetSearch: (value: string) => void
  onSetAssignmentUserSearch: (value: string) => void
  onSetAssignmentStoreSearch: (value: string) => void
  onSetActionStoreUserSearch: (value: string) => void
  onSetActionStoreSearch: (value: string) => void
  onUpdateUserForm: <K extends keyof AuthUserFormState>(
    key: K,
    value: AuthUserFormState[K],
  ) => void
  onUpdateAssignmentForm: <K extends keyof AuthAssignmentFormState>(
    key: K,
    value: AuthAssignmentFormState[K],
  ) => void
  onUpdateActionStoreForm: <K extends keyof AuthActionStoreFormState>(
    key: K,
    value: AuthActionStoreFormState[K],
  ) => void
  onSetAssignmentScopeType: (scopeType: RoleScopeType) => void
  onSelectAssignmentUser: (userId: string) => void
  onSelectAssignmentStore: (storeId: string) => void
  onSelectActionStoreUser: (userId: string) => void
  onSelectActionStore: (storeId: string) => void
  onSubmitUserForm: () => void
  onSubmitAssignmentForm: () => void
  onSubmitActionStoreForm: () => void
  onDeactivateAssignment: (assignmentId: string) => void
  onDeactivateActionStoreAssignment: (assignmentId: string) => void
  onDeactivateUser: (userId: string) => void
  onReactivateUser: (userId: string) => void
}

export function AuthDashboardContent(props: AuthDashboardContentProps) {
  return (
    <section className="page-stack">
      <AuthHeroPanel t={props.t} lookups={props.lookups} />
      <AuthMetricsGrid {...props} />
      <FeedbackPanels feedback={props.feedback} errorFeedback={props.errorFeedback} />
      <PilotUserBindingPanel stores={props.lookups.stores} />

      <section className="two-up-grid">
        <CreateUserPanel {...props} />
        <CreateRoleAssignmentPanel {...props} />
      </section>

      <section className="two-up-grid">
        <CreateActionStoreAssignmentPanel {...props} />
        <ActionStoreGrantsPanel {...props} />
      </section>

      <section className="two-up-grid">
        <LookupPosturePanel t={props.t} lookups={props.lookups} />
        <UserInventoryPanel {...props} />
      </section>

      <RoleAssignmentsPanel {...props} />
    </section>
  )
}

function AuthHeroPanel({ t, lookups }: Pick<AuthDashboardContentProps, 't' | 'lookups'>) {
  return (
    <section className="hero-panel">
      <div>
        <div className="eyebrow">{t('authAdmin.heroEyebrow')}</div>
        <h2 className="hero-title">{t('authAdmin.heroTitle')}</h2>
        <p className="hero-copy">{t('authAdmin.heroCopy')}</p>
      </div>
      <div className="hero-metrics">
        <MetricAccent label={t('authAdmin.users')} value={String(lookups.meta.totalUsers)} />
        <MetricAccent label={t('authAdmin.roles')} value={String(lookups.meta.totalRoles)} />
        <MetricAccent
          label={t('authAdmin.permissions')}
          value={String(lookups.meta.totalPermissions)}
        />
      </div>
    </section>
  )
}

function AuthMetricsGrid({
  t,
  lookups,
  users,
  assignments,
  actionStoreAssignments,
  activeUsers,
  activeAssignments,
  activeActionStores,
}: Pick<
  AuthDashboardContentProps,
  | 't'
  | 'lookups'
  | 'users'
  | 'assignments'
  | 'actionStoreAssignments'
  | 'activeUsers'
  | 'activeAssignments'
  | 'activeActionStores'
>) {
  return (
    <section className="metric-grid">
      <MetricCard
        title={t('authAdmin.activeUsers')}
        value={activeUsers}
        note={t('authAdmin.inactiveAccountsNote', { count: users.length - activeUsers })}
        icon={<Users size={18} />}
        tone="calm"
      />
      <MetricCard
        title={t('authAdmin.assignments')}
        value={assignments.length}
        note={t('authAdmin.activeRoleGrantsNote', { count: activeAssignments })}
        icon={<UserCog size={18} />}
        tone="accent"
      />
      <MetricCard
        title={t('authAdmin.actionStores')}
        value={actionStoreAssignments.length}
        note={t('authAdmin.activeStoreActionGrantsNote', { count: activeActionStores })}
        icon={<MapPin size={18} />}
        tone="calm"
      />
      <MetricCard
        title={t('authAdmin.roleCatalog')}
        value={lookups.meta.totalRoles}
        note={t('authAdmin.roleCatalogNote')}
        icon={<ShieldCheck size={18} />}
        tone="warning"
      />
      <MetricCard
        title={t('authAdmin.permissionCatalog')}
        value={lookups.meta.totalPermissions}
        note={t('authAdmin.permissionCatalogNote')}
        icon={<KeyRound size={18} />}
        tone="danger"
      />
    </section>
  )
}

function FeedbackPanels({
  feedback,
  errorFeedback,
}: Pick<AuthDashboardContentProps, 'feedback' | 'errorFeedback'>) {
  return (
    <>
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
    </>
  )
}

function CreateUserPanel({
  t,
  userForm,
  providerOptions,
  mutationBusy,
  pending,
  onUpdateUserForm,
  onSubmitUserForm,
}: Pick<
  AuthDashboardContentProps,
  | 't'
  | 'userForm'
  | 'providerOptions'
  | 'mutationBusy'
  | 'pending'
  | 'onUpdateUserForm'
  | 'onSubmitUserForm'
>) {
  return (
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
          <input
            value={userForm.username}
            onChange={(event) => onUpdateUserForm('username', event.target.value)}
            placeholder="new.admin"
          />
        </label>
        <label className="field-block">
          <span>{t('authAdmin.email')}</span>
          <input
            value={userForm.email}
            onChange={(event) => onUpdateUserForm('email', event.target.value)}
            placeholder="new.admin@example.com"
          />
        </label>
        <label className="field-block">
          <span>{t('authAdmin.authProvider')}</span>
          <select
            value={userForm.authProvider}
            onChange={(event) => onUpdateUserForm('authProvider', event.target.value as AuthProvider)}
          >
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </label>
        <label className="field-block">
          <span>{t('authAdmin.employeeId')}</span>
          <input
            value={userForm.employeeId}
            onChange={(event) => onUpdateUserForm('employeeId', event.target.value)}
            placeholder={t('authAdmin.optionalEmployeeUuid')}
          />
        </label>
      </div>
      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          onClick={onSubmitUserForm}
          disabled={mutationBusy || !userForm.username.trim() || !userForm.email.trim()}
        >
          {pending.createUser ? t('authAdmin.creating') : t('authAdmin.createUser')}
        </button>
      </div>
    </article>
  )
}

function CreateRoleAssignmentPanel({
  t,
  lookups,
  assignmentUserSearch,
  assignmentStoreSearch,
  assignmentForm,
  assignmentUserOptions,
  assignmentStoreOptions,
  mutationBusy,
  pending,
  onSetAssignmentUserSearch,
  onSetAssignmentStoreSearch,
  onUpdateAssignmentForm,
  onSetAssignmentScopeType,
  onSelectAssignmentUser,
  onSelectAssignmentStore,
  onSubmitAssignmentForm,
}: Pick<
  AuthDashboardContentProps,
  | 't'
  | 'lookups'
  | 'assignmentUserSearch'
  | 'assignmentStoreSearch'
  | 'assignmentForm'
  | 'assignmentUserOptions'
  | 'assignmentStoreOptions'
  | 'mutationBusy'
  | 'pending'
  | 'onSetAssignmentUserSearch'
  | 'onSetAssignmentStoreSearch'
  | 'onUpdateAssignmentForm'
  | 'onSetAssignmentScopeType'
  | 'onSelectAssignmentUser'
  | 'onSelectAssignmentStore'
  | 'onSubmitAssignmentForm'
>) {
  const submitDisabled =
    mutationBusy ||
    !assignmentForm.userId ||
    !assignmentForm.roleCode ||
    !assignmentForm.companyId.trim() ||
    (assignmentForm.scopeType !== 'company' && !assignmentForm.regionId.trim()) ||
    (assignmentForm.scopeType === 'store' && !assignmentForm.storeId.trim())

  return (
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
            onChange={(event) => onSetAssignmentUserSearch(event.target.value)}
            placeholder={t('authAdmin.userSearchPlaceholder')}
          />
        </label>
        <label className="field-block">
          <span>{t('authAdmin.roleAssignmentUser')}</span>
          <select
            aria-label={t('authAdmin.roleAssignmentUser')}
            value={assignmentForm.userId}
            onChange={(event) => onSelectAssignmentUser(event.target.value)}
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
            onChange={(event) => onUpdateAssignmentForm('roleCode', event.target.value)}
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
            onChange={(event) => onSetAssignmentScopeType(event.target.value as RoleScopeType)}
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
          <input
            value={assignmentForm.companyId}
            onChange={(event) => onUpdateAssignmentForm('companyId', event.target.value)}
            placeholder={t('authAdmin.companyIdPlaceholder')}
          />
        </label>
        {assignmentForm.scopeType !== 'company' ? (
          <label className="field-block">
            <span>{t('authAdmin.regionId')}</span>
            <input
              value={assignmentForm.regionId}
              onChange={(event) => onUpdateAssignmentForm('regionId', event.target.value)}
              placeholder={t('authAdmin.regionIdPlaceholder')}
            />
          </label>
        ) : null}
        {assignmentForm.scopeType === 'store' ? (
          <>
            <label className="field-block">
              <span>{t('authAdmin.searchStoresForRoleGrant')}</span>
              <input
                aria-label={t('authAdmin.searchStoresForRoleGrant')}
                value={assignmentStoreSearch}
                onChange={(event) => onSetAssignmentStoreSearch(event.target.value)}
                placeholder={t('authAdmin.storeSearchPlaceholder')}
              />
            </label>
            <label className="field-block">
              <span>{t('authAdmin.roleAssignmentStore')}</span>
              <select
                aria-label={t('authAdmin.roleAssignmentStore')}
                value={assignmentForm.storeId}
                onChange={(event) => onSelectAssignmentStore(event.target.value)}
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
          <input
            type="date"
            value={assignmentForm.effectiveFrom}
            onChange={(event) => onUpdateAssignmentForm('effectiveFrom', event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>{t('authAdmin.effectiveTo')}</span>
          <input
            type="date"
            value={assignmentForm.effectiveTo}
            onChange={(event) => onUpdateAssignmentForm('effectiveTo', event.target.value)}
          />
        </label>
      </div>
      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          onClick={onSubmitAssignmentForm}
          disabled={submitDisabled}
        >
          {pending.createAssignment ? t('authAdmin.creating') : t('authAdmin.createAssignment')}
        </button>
      </div>
    </article>
  )
}

function CreateActionStoreAssignmentPanel({
  t,
  actionStoreUserSearch,
  actionStoreSearch,
  actionStoreForm,
  actionStoreUserOptions,
  actionStoreOptions,
  mutationBusy,
  pending,
  onSetActionStoreUserSearch,
  onSetActionStoreSearch,
  onUpdateActionStoreForm,
  onSelectActionStoreUser,
  onSelectActionStore,
  onSubmitActionStoreForm,
}: Pick<
  AuthDashboardContentProps,
  | 't'
  | 'actionStoreUserSearch'
  | 'actionStoreSearch'
  | 'actionStoreForm'
  | 'actionStoreUserOptions'
  | 'actionStoreOptions'
  | 'mutationBusy'
  | 'pending'
  | 'onSetActionStoreUserSearch'
  | 'onSetActionStoreSearch'
  | 'onUpdateActionStoreForm'
  | 'onSelectActionStoreUser'
  | 'onSelectActionStore'
  | 'onSubmitActionStoreForm'
>) {
  return (
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
            onChange={(event) => onSetActionStoreUserSearch(event.target.value)}
            placeholder={t('authAdmin.userSearchPlaceholder')}
          />
        </label>
        <label className="field-block">
          <span>{t('authAdmin.actionAccessUser')}</span>
          <select
            aria-label={t('authAdmin.actionAccessUser')}
            value={actionStoreForm.userId}
            onChange={(event) => onSelectActionStoreUser(event.target.value)}
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
            onChange={(event) => onSetActionStoreSearch(event.target.value)}
            placeholder={t('authAdmin.storeSearchPlaceholder')}
          />
        </label>
        <label className="field-block">
          <span>{t('authAdmin.actionStore')}</span>
          <select
            aria-label={t('authAdmin.actionStore')}
            value={actionStoreForm.storeId}
            onChange={(event) => onSelectActionStore(event.target.value)}
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
          <input
            type="date"
            value={actionStoreForm.effectiveFrom}
            onChange={(event) => onUpdateActionStoreForm('effectiveFrom', event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>{t('authAdmin.effectiveTo')}</span>
          <input
            type="date"
            value={actionStoreForm.effectiveTo}
            onChange={(event) => onUpdateActionStoreForm('effectiveTo', event.target.value)}
          />
        </label>
      </div>
      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          onClick={onSubmitActionStoreForm}
          disabled={mutationBusy || !actionStoreForm.userId || !actionStoreForm.storeId}
        >
          {pending.createActionStoreAssignment
            ? t('authAdmin.assigning')
            : t('authAdmin.assignActionStore')}
        </button>
      </div>
    </article>
  )
}

function ActionStoreGrantsPanel({
  t,
  locale,
  filteredActionStoreAssignments,
  mutationBusy,
  pending,
  onDeactivateActionStoreAssignment,
}: Pick<
  AuthDashboardContentProps,
  | 't'
  | 'locale'
  | 'filteredActionStoreAssignments'
  | 'mutationBusy'
  | 'pending'
  | 'onDeactivateActionStoreAssignment'
>) {
  return (
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
                <KeyValue
                  label={t('authAdmin.store')}
                  value={`${assignment.storeCode} - ${assignment.storeName}`}
                />
                <KeyValue label={t('authAdmin.region')} value={assignment.regionName} />
                <KeyValue
                  label={t('authAdmin.effectiveFrom')}
                  value={
                    assignment.effectiveFrom
                      ? formatDateTime(assignment.effectiveFrom, locale)
                      : t('authAdmin.immediate')
                  }
                />
                <KeyValue label={t('authAdmin.storeId')} value={assignment.storeId} />
              </div>
              <div className="action-cluster">
                <Link
                  className="back-link"
                  to={`/admin/auth/action-store-assignments/${assignment.assignmentId}/audit`}
                >
                  <span>{t('authAdmin.openAudit')}</span>
                </Link>
                {assignment.active ? (
                  <button
                    className="control-button"
                    type="button"
                    onClick={() => onDeactivateActionStoreAssignment(assignment.assignmentId)}
                    disabled={mutationBusy}
                  >
                    {pending.deactivateActionStoreAssignment
                      ? t('authAdmin.updating')
                      : t('authAdmin.deactivateActionStore')}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </article>
  )
}

function LookupPosturePanel({ t, lookups }: Pick<AuthDashboardContentProps, 't' | 'lookups'>) {
  return (
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
        <KeyValue
          label={t('authAdmin.authProviders')}
          value={lookups.authProviders.join(', ') || t('authAdmin.none')}
        />
        <KeyValue label={t('authAdmin.userOptions')} value={String(lookups.optionGroups.users.length)} />
        <KeyValue label={t('authAdmin.roleOptions')} value={String(lookups.optionGroups.roles.length)} />
        <KeyValue
          label={t('authAdmin.storeOptions')}
          value={String(lookups.optionGroups.stores.length)}
        />
      </div>
    </article>
  )
}

function UserInventoryPanel({
  t,
  locale,
  users,
  mutationBusy,
  pending,
  onDeactivateUser,
  onReactivateUser,
}: Pick<
  AuthDashboardContentProps,
  | 't'
  | 'locale'
  | 'users'
  | 'mutationBusy'
  | 'pending'
  | 'onDeactivateUser'
  | 'onReactivateUser'
>) {
  return (
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
                <KeyValue
                  label={t('authAdmin.employeeStatus')}
                  value={user.employeeStatus ?? t('authAdmin.unlinked')}
                />
                <KeyValue
                  label={t('authAdmin.deactivated')}
                  value={
                    user.deactivatedAt
                      ? formatDateTime(user.deactivatedAt, locale)
                      : t('authAdmin.no')
                  }
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
                      const confirmed = window.confirm(t('authAdmin.deactivateUserConfirm'))
                      if (confirmed) {
                        onDeactivateUser(user.userId)
                      }
                    }}
                    disabled={mutationBusy}
                  >
                    {pending.deactivateUser ? t('authAdmin.updating') : t('authAdmin.deactivateUser')}
                  </button>
                ) : (
                  <button
                    className="control-button"
                    type="button"
                    onClick={() => onReactivateUser(user.userId)}
                    disabled={mutationBusy}
                  >
                    {pending.reactivateUser ? t('authAdmin.updating') : t('authAdmin.reactivateUser')}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </article>
  )
}

function RoleAssignmentsPanel({
  t,
  locale,
  search,
  filteredAssignments,
  mutationBusy,
  pending,
  onSetSearch,
  onDeactivateAssignment,
}: Pick<
  AuthDashboardContentProps,
  | 't'
  | 'locale'
  | 'search'
  | 'filteredAssignments'
  | 'mutationBusy'
  | 'pending'
  | 'onSetSearch'
  | 'onDeactivateAssignment'
>) {
  return (
    <section className="panel">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{t('authAdmin.scopedGrants')}</div>
          <h3>{t('authAdmin.roleAssignmentQueue')}</h3>
          <p className="queue-subtitle">{t('authAdmin.assignmentSearchCopy')}</p>
        </div>
        <label className="search-field">
          <span className="sr-only">{t('authAdmin.filterAssignments')}</span>
          <input
            value={search}
            onChange={(event) => onSetSearch(event.target.value)}
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
                <KeyValue
                  label={t('authAdmin.role')}
                  value={`${assignment.roleCode} · ${assignment.roleName}`}
                />
                <KeyValue label={t('authAdmin.scopeType')} value={assignment.scopeType} />
                <KeyValue
                  label={t('authAdmin.company')}
                  value={assignment.companyId ?? t('authAdmin.notAvailable')}
                />
                <KeyValue
                  label={t('authAdmin.region')}
                  value={assignment.regionId ?? t('authAdmin.notAvailable')}
                />
                <KeyValue
                  label={t('authAdmin.store')}
                  value={assignment.storeId ?? t('authAdmin.notAvailable')}
                />
                <KeyValue
                  label={t('authAdmin.effectiveFrom')}
                  value={
                    assignment.effectiveFrom
                      ? formatDateTime(assignment.effectiveFrom, locale)
                      : t('authAdmin.immediate')
                  }
                />
              </div>
              <div className="action-cluster">
                <Link
                  className="back-link"
                  to={`/admin/auth/role-assignments/${assignment.assignmentId}/audit`}
                >
                  <span>{t('authAdmin.openAudit')}</span>
                </Link>
                {assignment.active ? (
                  <button
                    className="control-button"
                    type="button"
                    onClick={() => onDeactivateAssignment(assignment.assignmentId)}
                    disabled={mutationBusy}
                  >
                    {pending.deactivateAssignment
                      ? t('authAdmin.updating')
                      : t('authAdmin.deactivateAssignment')}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
