import { Link } from 'react-router'
import { KeyRound, MapPin, ShieldCheck, UserCog, Users } from 'lucide-react'
import {
  AdminOperationalBadge as AdminSurfaceBadge,
  AdminOperationalEmpty as AdminSurfaceEmpty,
  AdminOperationalHeader as AdminSurfaceHeader,
  AdminOperationalKeyGrid as AdminKeyValueGrid,
  AdminOperationalKeyValue as AdminKeyValue,
  AdminOperationalMetrics as AdminMetricStrip,
  AdminOperationalPage as AdminSurfacePage,
  AdminOperationalSection as AdminSurfaceSection,
  AdminOperationalState as AdminStatePanel,
} from '../../pages/admin-operational-primitives'
import {
  AuthActionRow,
  AuthButton,
  AuthField,
  AuthFormGrid,
  AuthInput,
  AuthList,
  AuthListRow,
  AuthMuted,
  AuthNativeSelect,
  AuthRowHead,
} from './AuthSurfacePrimitives'
import { formatDateTime } from '../../lib/format'
import { normalizeDisplayLabel } from '../../lib/display-labels'
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
import { RolePermissionPreviewPanel } from './RolePermissionPreviewPanel'

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
    <AdminSurfacePage ariaLabel={props.t('authAdmin.heroEyebrow')}>
      <AuthHeroPanel t={props.t} lookups={props.lookups} />
      <AuthMetricsGrid {...props} />
      <FeedbackPanels feedback={props.feedback} errorFeedback={props.errorFeedback} />
      <PilotUserBindingPanel stores={props.lookups.stores} />
      <RolePermissionPreviewPanel t={props.t} lookups={props.lookups} />
      <section className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-2">
        <CreateUserPanel {...props} />
        <CreateRoleAssignmentPanel {...props} />
      </section>
      <section className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-2">
        <CreateActionStoreAssignmentPanel {...props} />
        <ActionStoreGrantsPanel {...props} />
      </section>

      <section className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-2">
        <LookupPosturePanel t={props.t} lookups={props.lookups} />
        <UserInventoryPanel {...props} />
      </section>

      <RoleAssignmentsPanel {...props} />
    </AdminSurfacePage>
  )
}

function AuthHeroPanel({ t, lookups }: Pick<AuthDashboardContentProps, 't' | 'lookups'>) {
  return (
    <AdminSurfaceHeader
      eyebrow={t('authAdmin.heroEyebrow')}
      title={t('authAdmin.heroTitle')}
      description={t('authAdmin.heroCopy')}
      icon={<ShieldCheck size={18} />}
      meta={
        <>
          <AdminSurfaceBadge tone="accent">{t('authAdmin.users')}: {lookups.meta.totalUsers}</AdminSurfaceBadge>
          <AdminSurfaceBadge tone="cyan">{t('authAdmin.roles')}: {lookups.meta.totalRoles}</AdminSurfaceBadge>
          <AdminSurfaceBadge tone="neutral">{t('authAdmin.permissions')}: {lookups.meta.totalPermissions}</AdminSurfaceBadge>
        </>
      }
    />
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
    <AdminMetricStrip
      className="tw:xl:grid-cols-5"
      items={[
        {
          id: 'active-users',
          label: t('authAdmin.activeUsers'),
          value: activeUsers,
          description: t('authAdmin.inactiveAccountsNote', { count: users.length - activeUsers }),
          icon: <Users size={18} />,
          tone: 'cyan',
        },
        {
          id: 'assignments',
          label: t('authAdmin.assignments'),
          value: assignments.length,
          description: t('authAdmin.activeRoleGrantsNote', { count: activeAssignments }),
          icon: <UserCog size={18} />,
          tone: 'accent',
        },
        {
          id: 'action-stores',
          label: t('authAdmin.actionStores'),
          value: actionStoreAssignments.length,
          description: t('authAdmin.activeStoreActionGrantsNote', { count: activeActionStores }),
          icon: <MapPin size={18} />,
          tone: 'success',
        },
        {
          id: 'role-catalog',
          label: t('authAdmin.roleCatalog'),
          value: lookups.meta.totalRoles,
          description: t('authAdmin.roleCatalogNote'),
          icon: <ShieldCheck size={18} />,
          tone: 'warning',
        },
        {
          id: 'permission-catalog',
          label: t('authAdmin.permissionCatalog'),
          value: lookups.meta.totalPermissions,
          description: t('authAdmin.permissionCatalogNote'),
          icon: <KeyRound size={18} />,
          tone: 'danger',
        },
      ]}
    />
  )
}

function FeedbackPanels({
  feedback,
  errorFeedback,
}: Pick<AuthDashboardContentProps, 'feedback' | 'errorFeedback'>) {
  return (
    <>
      {feedback ? (
        <AdminStatePanel title={feedback} tone="success" />
      ) : null}

      {errorFeedback ? (
        <AdminStatePanel title={errorFeedback} tone="danger" />
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
    <AdminSurfaceSection
      eyebrow={t('authAdmin.createUserEyebrow')}
      title={t('authAdmin.newAccount')}
      actions={
        <AuthButton asChild size="sm" variant="outline">
          <Link to="/admin/auth/catalog">{t('authAdmin.openCatalog')}</Link>
        </AuthButton>
      }
    >
      <AuthFormGrid>
        <AuthField label={t('authAdmin.username')}>
          <AuthInput
            value={userForm.username}
            onChange={(event) => onUpdateUserForm('username', event.target.value)}
            placeholder="new.admin"
          />
        </AuthField>
        <AuthField label={t('authAdmin.email')}>
          <AuthInput
            value={userForm.email}
            onChange={(event) => onUpdateUserForm('email', event.target.value)}
            placeholder="new.admin@example.com"
          />
        </AuthField>
        <AuthField label={t('authAdmin.authProvider')}>
          <AuthNativeSelect
            value={userForm.authProvider}
            onChange={(event) => onUpdateUserForm('authProvider', event.target.value as AuthProvider)}
          >
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </AuthNativeSelect>
        </AuthField>
        <AuthField label={t('authAdmin.employeeId')}>
          <AuthInput
            value={userForm.employeeId}
            onChange={(event) => onUpdateUserForm('employeeId', event.target.value)}
            placeholder={t('authAdmin.optionalEmployeeUuid')}
          />
        </AuthField>
      </AuthFormGrid>
      <AuthActionRow className="tw:justify-end">
        <AuthButton
          type="button"
          onClick={onSubmitUserForm}
          disabled={mutationBusy || !userForm.username.trim() || !userForm.email.trim()}
        >
          {pending.createUser ? t('authAdmin.creating') : t('authAdmin.createUser')}
        </AuthButton>
      </AuthActionRow>
    </AdminSurfaceSection>
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
    <AdminSurfaceSection
      eyebrow={t('authAdmin.createAssignmentEyebrow')}
      title={t('authAdmin.scopedRoleGrant')}
    >
      <AuthFormGrid>
        <AuthField label={t('authAdmin.searchUsersForRoleGrant')}>
          <AuthInput
            aria-label={t('authAdmin.searchUsersForRoleGrant')}
            value={assignmentUserSearch}
            onChange={(event) => onSetAssignmentUserSearch(event.target.value)}
            placeholder={t('authAdmin.userSearchPlaceholder')}
          />
        </AuthField>
        <AuthField label={t('authAdmin.roleAssignmentUser')}>
          <AuthNativeSelect
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
          </AuthNativeSelect>
        </AuthField>
        <AuthField label={t('authAdmin.roleAssignmentRole')}>
          <AuthNativeSelect
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
          </AuthNativeSelect>
        </AuthField>
        <AuthField label={t('authAdmin.roleAssignmentScopeType')}>
          <AuthNativeSelect
            aria-label={t('authAdmin.roleAssignmentScopeType')}
            value={assignmentForm.scopeType}
            onChange={(event) => onSetAssignmentScopeType(event.target.value as RoleScopeType)}
          >
            {lookups.scopeTypes.map((scopeType) => (
              <option key={scopeType} value={scopeType}>
                {scopeType}
              </option>
            ))}
          </AuthNativeSelect>
        </AuthField>
        <AuthField label={t('authAdmin.companyId')}>
          <AuthInput
            value={assignmentForm.companyId}
            onChange={(event) => onUpdateAssignmentForm('companyId', event.target.value)}
            placeholder={t('authAdmin.companyIdPlaceholder')}
          />
        </AuthField>
        {assignmentForm.scopeType !== 'company' ? (
          <AuthField label={t('authAdmin.regionId')}>
            <AuthInput
              value={assignmentForm.regionId}
              onChange={(event) => onUpdateAssignmentForm('regionId', event.target.value)}
              placeholder={t('authAdmin.regionIdPlaceholder')}
            />
          </AuthField>
        ) : null}
        {assignmentForm.scopeType === 'store' ? (
          <>
            <AuthField label={t('authAdmin.searchStoresForRoleGrant')}>
              <AuthInput
                aria-label={t('authAdmin.searchStoresForRoleGrant')}
                value={assignmentStoreSearch}
                onChange={(event) => onSetAssignmentStoreSearch(event.target.value)}
                placeholder={t('authAdmin.storeSearchPlaceholder')}
              />
            </AuthField>
            <AuthField label={t('authAdmin.roleAssignmentStore')}>
              <AuthNativeSelect
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
              </AuthNativeSelect>
            </AuthField>
          </>
        ) : null}
        <AuthField label={t('authAdmin.effectiveFrom')}>
          <AuthInput
            type="date"
            value={assignmentForm.effectiveFrom}
            onChange={(event) => onUpdateAssignmentForm('effectiveFrom', event.target.value)}
          />
        </AuthField>
        <AuthField label={t('authAdmin.effectiveTo')}>
          <AuthInput
            type="date"
            value={assignmentForm.effectiveTo}
            onChange={(event) => onUpdateAssignmentForm('effectiveTo', event.target.value)}
          />
        </AuthField>
      </AuthFormGrid>
      <AuthActionRow className="tw:justify-end">
        <AuthButton
          type="button"
          onClick={onSubmitAssignmentForm}
          disabled={submitDisabled}
        >
          {pending.createAssignment ? t('authAdmin.creating') : t('authAdmin.createAssignment')}
        </AuthButton>
      </AuthActionRow>
    </AdminSurfaceSection>
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
    <AdminSurfaceSection
      eyebrow={t('authAdmin.actionStoreAssignmentEyebrow')}
      title={t('authAdmin.assignedStoresTitle')}
    >
      <AuthFormGrid>
        <AuthField label={t('authAdmin.searchUsersForActionAccess')}>
          <AuthInput
            aria-label={t('authAdmin.searchUsersForActionAccess')}
            value={actionStoreUserSearch}
            onChange={(event) => onSetActionStoreUserSearch(event.target.value)}
            placeholder={t('authAdmin.userSearchPlaceholder')}
          />
        </AuthField>
        <AuthField label={t('authAdmin.actionAccessUser')}>
          <AuthNativeSelect
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
          </AuthNativeSelect>
        </AuthField>
        <AuthField label={t('authAdmin.searchStoresForActionAccess')}>
          <AuthInput
            aria-label={t('authAdmin.searchStoresForActionAccess')}
            value={actionStoreSearch}
            onChange={(event) => onSetActionStoreSearch(event.target.value)}
            placeholder={t('authAdmin.storeSearchPlaceholder')}
          />
        </AuthField>
        <AuthField label={t('authAdmin.actionStore')}>
          <AuthNativeSelect
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
          </AuthNativeSelect>
        </AuthField>
        <AuthField label={t('authAdmin.effectiveFrom')}>
          <AuthInput
            type="date"
            value={actionStoreForm.effectiveFrom}
            onChange={(event) => onUpdateActionStoreForm('effectiveFrom', event.target.value)}
          />
        </AuthField>
        <AuthField label={t('authAdmin.effectiveTo')}>
          <AuthInput
            type="date"
            value={actionStoreForm.effectiveTo}
            onChange={(event) => onUpdateActionStoreForm('effectiveTo', event.target.value)}
          />
        </AuthField>
      </AuthFormGrid>
      <AuthActionRow className="tw:justify-end">
        <AuthButton
          type="button"
          onClick={onSubmitActionStoreForm}
          disabled={mutationBusy || !actionStoreForm.userId || !actionStoreForm.storeId}
        >
          {pending.createActionStoreAssignment
            ? t('authAdmin.assigning')
            : t('authAdmin.assignActionStore')}
        </AuthButton>
      </AuthActionRow>
    </AdminSurfaceSection>
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
    <AdminSurfaceSection
      eyebrow={t('authAdmin.actionGrants')}
      title={t('authAdmin.storeLevelActionAccess')}
    >
      {filteredActionStoreAssignments.length === 0 ? (
        <AdminSurfaceEmpty copy={t('authAdmin.noActionStoreAssignments')} />
      ) : (
        <AuthList>
          {filteredActionStoreAssignments.map((assignment) => (
            <AuthListRow key={assignment.assignmentId}>
              <AuthRowHead>
                <div>
                  <strong className="tw:block tw:text-sm tw:font-medium tw:text-foreground">{assignment.username}</strong>
                  <AuthMuted>{assignment.email}</AuthMuted>
                </div>
                <AdminSurfaceBadge tone={assignment.active ? 'success' : 'danger'}>
                  {assignment.active ? t('authAdmin.active') : t('authAdmin.inactive')}
                </AdminSurfaceBadge>
              </AuthRowHead>
              <AdminKeyValueGrid>
                <AdminKeyValue
                  label={t('authAdmin.store')}
                  value={`${assignment.storeCode} - ${assignment.storeName}`}
                />
                <AdminKeyValue label={t('authAdmin.region')} value={assignment.regionName} />
                <AdminKeyValue
                  label={t('authAdmin.effectiveFrom')}
                  value={
                    assignment.effectiveFrom
                      ? formatDateTime(assignment.effectiveFrom, locale)
                      : t('authAdmin.immediate')
                  }
                />
              </AdminKeyValueGrid>
              <AuthActionRow>
                <AuthButton asChild size="sm" variant="outline">
                  <Link to={`/admin/auth/action-store-assignments/${assignment.assignmentId}/audit`}>
                    {t('authAdmin.openAudit')}
                  </Link>
                </AuthButton>
                {assignment.active ? (
                  <AuthButton
                    size="sm"
                    type="button"
                    onClick={() => onDeactivateActionStoreAssignment(assignment.assignmentId)}
                    disabled={mutationBusy}
                  >
                    {pending.deactivateActionStoreAssignment
                      ? t('authAdmin.updating')
                      : t('authAdmin.deactivateActionStore')}
                  </AuthButton>
                ) : null}
              </AuthActionRow>
            </AuthListRow>
          ))}
        </AuthList>
      )}
    </AdminSurfaceSection>
  )
}

function LookupPosturePanel({ t, lookups }: Pick<AuthDashboardContentProps, 't' | 'lookups'>) {
  return (
    <AdminSurfaceSection
      eyebrow={t('authAdmin.lookupPosture')}
      title={t('authAdmin.adminOptionSets')}
      actions={
        <AuthButton asChild size="sm" variant="outline">
          <Link to="/admin/auth/catalog">{t('authAdmin.openCatalog')}</Link>
        </AuthButton>
      }
    >
      <AdminKeyValueGrid>
        <AdminKeyValue label={t('authAdmin.scopeTypes')} value={lookups.scopeTypes.join(', ')} />
        <AdminKeyValue
          label={t('authAdmin.authProviders')}
          value={lookups.authProviders.join(', ') || t('authAdmin.none')}
        />
        <AdminKeyValue label={t('authAdmin.userOptions')} value={String(lookups.optionGroups.users.length)} />
        <AdminKeyValue label={t('authAdmin.roleOptions')} value={String(lookups.optionGroups.roles.length)} />
        <AdminKeyValue
          label={t('authAdmin.storeOptions')}
          value={String(lookups.optionGroups.stores.length)}
        />
      </AdminKeyValueGrid>
    </AdminSurfaceSection>
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
    <AdminSurfaceSection
      eyebrow={t('authAdmin.recentUsers')}
      title={t('authAdmin.accountInventory')}
    >
      {users.length === 0 ? (
        <AdminSurfaceEmpty copy={t('authAdmin.noUserAccounts')} />
      ) : (
        <AuthList>
          {users.slice(0, 6).map((user) => (
            <AuthListRow key={user.userId}>
              <AuthRowHead>
                <div>
                  <strong className="tw:block tw:text-sm tw:font-medium tw:text-foreground">{user.username}</strong>
                  <AuthMuted>{user.email}</AuthMuted>
                </div>
                <AdminSurfaceBadge tone={user.isActive ? 'success' : 'danger'}>
                  {user.isActive ? t('authAdmin.active') : t('authAdmin.inactive')}
                </AdminSurfaceBadge>
              </AuthRowHead>
              <AdminKeyValueGrid>
                <AdminKeyValue label={t('authAdmin.provider')} value={user.authProvider} />
                <AdminKeyValue label={t('authAdmin.created')} value={formatDateTime(user.createdAt, locale)} />
                <AdminKeyValue
                  label={t('authAdmin.employeeStatus')}
                  value={user.employeeStatus ?? t('authAdmin.unlinked')}
                />
                <AdminKeyValue
                  label={t('authAdmin.deactivated')}
                  value={
                    user.deactivatedAt
                      ? formatDateTime(user.deactivatedAt, locale)
                      : t('authAdmin.no')
                  }
                />
                <AdminKeyValue
                  label={t('authAdmin.deactivationReason')}
                  value={user.deactivationReason ?? t('authAdmin.none')}
                />
              </AdminKeyValueGrid>
              <AuthActionRow>
                <AuthButton asChild size="sm" variant="outline">
                  <Link to={`/admin/auth/users/${user.userId}/audit`}>{t('authAdmin.openAudit')}</Link>
                </AuthButton>
                {user.isActive ? (
                  <AuthButton
                    size="sm"
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
                  </AuthButton>
                ) : (
                  <AuthButton
                    size="sm"
                    type="button"
                    onClick={() => onReactivateUser(user.userId)}
                    disabled={mutationBusy}
                  >
                    {pending.reactivateUser ? t('authAdmin.updating') : t('authAdmin.reactivateUser')}
                  </AuthButton>
                )}
              </AuthActionRow>
            </AuthListRow>
          ))}
        </AuthList>
      )}
    </AdminSurfaceSection>
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
    <AdminSurfaceSection
      eyebrow={t('authAdmin.scopedGrants')}
      title={t('authAdmin.roleAssignmentQueue')}
      description={t('authAdmin.assignmentSearchCopy')}
      actions={
        <label className="tw:min-w-64">
          <span className="tw:sr-only">{t('authAdmin.filterAssignments')}</span>
          <AuthInput
            value={search}
            onChange={(event) => onSetSearch(event.target.value)}
            placeholder={t('authAdmin.assignmentSearchPlaceholder')}
          />
        </label>
      }
    >
      {filteredAssignments.length === 0 ? (
        <AdminSurfaceEmpty
          title={t('authAdmin.noAssignmentsMatched')}
          copy={t('authAdmin.clearSearchForInventory')}
        />
      ) : (
        <AuthList>
          {filteredAssignments.map((assignment) => (
            <AuthListRow key={assignment.assignmentId}>
              <AuthRowHead>
                <div>
                  <strong className="tw:block tw:text-sm tw:font-medium tw:text-foreground">{assignment.username}</strong>
                  <AuthMuted>{assignment.email}</AuthMuted>
                </div>
                <AdminSurfaceBadge tone={assignment.active ? 'success' : 'danger'}>
                  {assignment.active ? t('authAdmin.active') : t('authAdmin.inactive')}
                </AdminSurfaceBadge>
              </AuthRowHead>

              <AdminKeyValueGrid>
                <AdminKeyValue
                  label={t('authAdmin.role')}
                  value={`${assignment.roleCode} · ${assignment.roleName}`}
                />
                <AdminKeyValue label={t('authAdmin.scopeType')} value={assignment.scopeType} />
                <AdminKeyValue
                  label={t('authAdmin.company')}
                  value={normalizeDisplayLabel(assignment.companyId, t('authAdmin.notAvailable'))}
                />
                <AdminKeyValue
                  label={t('authAdmin.region')}
                  value={normalizeDisplayLabel(assignment.regionId, t('authAdmin.notAvailable'))}
                />
                <AdminKeyValue
                  label={t('authAdmin.store')}
                  value={normalizeDisplayLabel(assignment.storeId, t('authAdmin.notAvailable'))}
                />
                <AdminKeyValue
                  label={t('authAdmin.effectiveFrom')}
                  value={
                    assignment.effectiveFrom
                      ? formatDateTime(assignment.effectiveFrom, locale)
                      : t('authAdmin.immediate')
                  }
                />
              </AdminKeyValueGrid>
              <AuthActionRow>
                <AuthButton asChild size="sm" variant="outline">
                  <Link to={`/admin/auth/role-assignments/${assignment.assignmentId}/audit`}>
                    {t('authAdmin.openAudit')}
                  </Link>
                </AuthButton>
                {assignment.active ? (
                  <AuthButton
                    size="sm"
                    type="button"
                    onClick={() => onDeactivateAssignment(assignment.assignmentId)}
                    disabled={mutationBusy}
                  >
                    {pending.deactivateAssignment
                      ? t('authAdmin.updating')
                      : t('authAdmin.deactivateAssignment')}
                  </AuthButton>
                ) : null}
              </AuthActionRow>
            </AuthListRow>
          ))}
        </AuthList>
      )}
    </AdminSurfaceSection>
  )
}
