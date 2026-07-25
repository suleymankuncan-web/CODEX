import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Fingerprint, Shield, SlidersHorizontal, UserRoundCog } from 'lucide-react'
import {
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminMetricStrip,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceHeader,
  AdminSurfacePage,
  AdminSurfaceSection,
} from './admin-surface-primitives'
import {
  AuthActionRow,
  AuthButton,
  AuthInput,
  AuthList,
  AuthListRow,
  AuthMuted,
  AuthNativeSelect,
  AuthRowHead,
} from '../features/auth/AuthSurfacePrimitives'
import {
  getPermissions,
  getRoles,
  grantRolePermission,
  revokeRolePermission,
} from '../features/auth/api'
import { useLocalization } from '../features/localization/useLocalization'
import { actionToast } from '../lib/action-toast'
import { getErrorMessage } from '../lib/format'

export function AuthCatalogPage() {
  const { t } = useLocalization()
  const [search, setSearch] = useState('')
  const [draftByRole, setDraftByRole] = useState<Record<string, string>>({})
  const deferredSearch = useDeferredValue(search)
  const queryClient = useQueryClient()

  const rolesQuery = useQuery({
    queryKey: ['auth-roles'],
    queryFn: getRoles,
  })
  const permissionsQuery = useQuery({
    queryKey: ['auth-permissions'],
    queryFn: getPermissions,
  })
  const grantMutation = useMutation({
    mutationFn: grantRolePermission,
    onSuccess: async (response, variables) => {
      actionToast.success(response.command.message)
      setDraftByRole((current) => ({ ...current, [variables.roleId]: '' }))
      await queryClient.invalidateQueries({ queryKey: ['auth-roles'] })
    },
    onError: (error) => actionToast.error(error, 'Yetki eklenemedi.'),
  })
  const revokeMutation = useMutation({
    mutationFn: revokeRolePermission,
    onSuccess: async (response) => {
      actionToast.info(response.command.message)
      await queryClient.invalidateQueries({ queryKey: ['auth-roles'] })
    },
    onError: (error) => actionToast.error(error, 'Yetki kaldırılamadı.'),
  })
  const roles = useMemo(() => rolesQuery.data?.items ?? [], [rolesQuery.data?.items])
  const permissions = useMemo(
    () => permissionsQuery.data?.items ?? [],
    [permissionsQuery.data?.items],
  )
  const filteredRoles = useMemo(() => {
    const input = deferredSearch.trim().toLowerCase()
    if (!input) {
      return roles
    }

    return roles.filter((role) =>
      [
        role.roleCode,
        role.roleName,
        role.scopeType,
        role.description ?? '',
        role.permissions.map((permission) => permission.permissionCode).join(' '),
      ]
        .join(' ')
        .toLowerCase()
      .includes(input),
    )
  }, [deferredSearch, roles])

  if (rolesQuery.isLoading || permissionsQuery.isLoading) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel title={t('authCatalog.loadingTitle')} description={t('authCatalog.loadingCopy')} />
      </AdminSurfacePage>
    )
  }

  if (rolesQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('authCatalog.roleErrorTitle')}
          description={getErrorMessage(rolesQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  if (permissionsQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('authCatalog.permissionErrorTitle')}
          description={getErrorMessage(permissionsQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  return (
    <AdminSurfacePage ariaLabel={t('authCatalog.heroEyebrow')}>
      <AdminSurfaceHeader
        eyebrow={t('authCatalog.heroEyebrow')}
        title={t('authCatalog.heroTitle')}
        description={t('authCatalog.heroCopy')}
        icon={<Shield size={18} />}
        meta={
          <>
            <AdminSurfaceBadge tone="accent">{t('authCatalog.roles')}: {roles.length}</AdminSurfaceBadge>
            <AdminSurfaceBadge tone="cyan">{t('authCatalog.permissions')}: {permissions.length}</AdminSurfaceBadge>
            <AdminSurfaceBadge tone="neutral">
              {t('authCatalog.systemRoles')}: {roles.filter((role) => role.isSystemRole).length}
            </AdminSurfaceBadge>
          </>
        }
      />

      <AuthActionRow>
        <AuthButton asChild size="sm" variant="outline">
          <Link to="/admin/auth">{t('authCatalog.backToAuthOverview')}</Link>
        </AuthButton>
      </AuthActionRow>

      <AdminMetricStrip
        items={[
          {
            id: 'auth-catalog-role-count',
            label: t('authCatalog.roleCount'),
            value: roles.length,
            description: t('authCatalog.roleCountNote'),
            icon: <UserRoundCog size={18} />,
            tone: 'accent',
          },
          {
            id: 'auth-catalog-permission-count',
            label: t('authCatalog.permissionCount'),
            value: permissions.length,
            description: t('authCatalog.permissionCountNote'),
            icon: <Fingerprint size={18} />,
            tone: 'success',
          },
          {
            id: 'auth-catalog-company-scoped',
            label: t('authCatalog.companyScoped'),
            value: roles.filter((role) => role.scopeType === 'company').length,
            description: t('authCatalog.companyScopedNote'),
            icon: <Shield size={18} />,
            tone: 'warning',
          },
          {
            id: 'auth-catalog-searchable',
            label: t('authCatalog.searchable'),
            value: filteredRoles.length,
            description: t('authCatalog.searchableNote'),
            icon: <SlidersHorizontal size={18} />,
            tone: 'danger',
          },
        ]}
      />

      <section className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <AdminSurfaceSection
          eyebrow={t('authCatalog.roles')}
          title={t('authCatalog.roleDefinitions')}
          description={t('authCatalog.roleSearchCopy')}
          actions={
            <label className="tw:min-w-64">
              <span className="tw:sr-only">{t('authCatalog.filterRoles')}</span>
              <AuthInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('authCatalog.roleSearchPlaceholder')}
              />
            </label>
          }
        >
          {filteredRoles.length === 0 ? (
            <AdminSurfaceEmpty copy={t('authCatalog.noRolesMatched')} />
          ) : (
            <AuthList>
              {filteredRoles.map((role) => (
                <AuthListRow key={role.roleId}>
                  <AuthRowHead>
                    <div>
                      <strong className="tw:block tw:text-sm tw:font-medium tw:text-foreground">{role.roleCode}</strong>
                      <AuthMuted>{role.roleName}</AuthMuted>
                    </div>
                    <AdminSurfaceBadge tone={role.isSystemRole ? 'accent' : 'neutral'}>
                      {role.isSystemRole ? t('authCatalog.systemRole') : t('authCatalog.customRole')}
                    </AdminSurfaceBadge>
                  </AuthRowHead>
                  <p className="tw:m-0 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                    {role.description ?? t('authCatalog.noRoleDescription')}
                  </p>
                  <AuthActionRow>
                    <AdminSurfaceBadge tone="neutral">{role.scopeType}</AdminSurfaceBadge>
                    {role.permissions.map((permission) => (
                      <AuthButton
                        key={`${role.roleId}:${permission.permissionCode}`}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() =>
                          revokeMutation.mutate({
                            roleId: role.roleId,
                            permissionCode: permission.permissionCode,
                          })
                        }
                        disabled={grantMutation.isPending || revokeMutation.isPending}
                      >
                        {t('authCatalog.revokePermission', { permissionCode: permission.permissionCode })}
                      </AuthButton>
                    ))}
                  </AuthActionRow>
                  <AuthActionRow>
                    <label className="tw:min-w-56">
                      <span className="tw:sr-only">{t('authCatalog.permissionToGrant')}</span>
                      <AuthNativeSelect
                        value={draftByRole[role.roleId] ?? ''}
                        onChange={(event) =>
                          setDraftByRole((current) => ({
                            ...current,
                            [role.roleId]: event.target.value,
                          }))
                        }
                      >
                        <option value="">{t('authCatalog.selectPermission')}</option>
                        {permissions.map((permission) => (
                          <option key={permission.permissionId} value={permission.permissionCode}>
                            {permission.permissionCode}
                          </option>
                        ))}
                      </AuthNativeSelect>
                    </label>
                    <AuthButton
                      type="button"
                      onClick={() =>
                        grantMutation.mutate({
                          roleId: role.roleId,
                          permissionCode: draftByRole[role.roleId] ?? '',
                        })
                      }
                      disabled={
                        grantMutation.isPending ||
                        revokeMutation.isPending ||
                        !(draftByRole[role.roleId] ?? '')
                      }
                    >
                      {grantMutation.isPending ? t('authCatalog.granting') : t('authCatalog.grantPermission')}
                    </AuthButton>
                  </AuthActionRow>
                </AuthListRow>
              ))}
            </AuthList>
          )}
        </AdminSurfaceSection>

        <AdminSurfaceSection
          eyebrow={t('authCatalog.permissions')}
          title={t('authCatalog.permissionCatalog')}
        >
          {permissions.length === 0 ? (
            <AdminSurfaceEmpty copy={t('authCatalog.noPermissions')} />
          ) : (
            <AuthList>
              {permissions.map((permission) => (
                <AuthListRow key={permission.permissionId}>
                  <AuthRowHead>
                    <strong className="tw:text-sm tw:font-medium tw:text-foreground">
                      {permission.permissionCode}
                    </strong>
                    <AdminSurfaceBadge tone="neutral">{permission.resourceName}</AdminSurfaceBadge>
                  </AuthRowHead>
                  <p className="tw:m-0 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                    {permission.description ?? t('authCatalog.noPermissionDescription')}
                  </p>
                  <AdminKeyValueGrid className="tw:lg:grid-cols-2">
                    <AdminKeyValue label={t('authCatalog.permissions')} value={permission.resourceName} />
                    <AdminKeyValue label={t('authCatalog.permissionCatalog')} value={permission.actionName} />
                  </AdminKeyValueGrid>
                </AuthListRow>
              ))}
            </AuthList>
          )}
        </AdminSurfaceSection>
      </section>
    </AdminSurfacePage>
  )
}
