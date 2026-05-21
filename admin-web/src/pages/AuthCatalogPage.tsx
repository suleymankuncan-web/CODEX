import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Fingerprint, Shield, SlidersHorizontal, UserRoundCog } from 'lucide-react'
import {
  EmptyState,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import {
  getPermissions,
  getRoles,
  grantRolePermission,
  revokeRolePermission,
} from '../features/auth/api'
import { useLocalization } from '../features/localization/useLocalization'
import { getErrorMessage } from '../lib/format'

export function AuthCatalogPage() {
  const { t } = useLocalization()
  const [search, setSearch] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
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
      setFeedback(response.command.message)
      setDraftByRole((current) => ({ ...current, [variables.roleId]: '' }))
      await queryClient.invalidateQueries({ queryKey: ['auth-roles'] })
    },
  })
  const revokeMutation = useMutation({
    mutationFn: revokeRolePermission,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      await queryClient.invalidateQueries({ queryKey: ['auth-roles'] })
    },
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
    return <ScreenState title={t('authCatalog.loadingTitle')} copy={t('authCatalog.loadingCopy')} />
  }

  if (rolesQuery.isError) {
    return <ScreenState title={t('authCatalog.roleErrorTitle')} copy={getErrorMessage(rolesQuery.error)} tone="error" />
  }

  if (permissionsQuery.isError) {
    return <ScreenState title={t('authCatalog.permissionErrorTitle')} copy={getErrorMessage(permissionsQuery.error)} tone="error" />
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('authCatalog.heroEyebrow')}</div>
          <h2 className="hero-title">{t('authCatalog.heroTitle')}</h2>
          <p className="hero-copy">{t('authCatalog.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('authCatalog.roles')} value={String(roles.length)} />
          <MetricAccent label={t('authCatalog.permissions')} value={String(permissions.length)} />
          <MetricAccent label={t('authCatalog.systemRoles')} value={String(roles.filter((role) => role.isSystemRole).length)} />
        </div>
      </section>

      <Link className="back-link" to="/admin/auth">
        <span>{t('authCatalog.backToAuthOverview')}</span>
      </Link>

      <section className="metric-grid">
        <MetricCard title={t('authCatalog.roleCount')} value={roles.length} note={t('authCatalog.roleCountNote')} icon={<UserRoundCog size={18} />} tone="accent" />
        <MetricCard title={t('authCatalog.permissionCount')} value={permissions.length} note={t('authCatalog.permissionCountNote')} icon={<Fingerprint size={18} />} tone="calm" />
        <MetricCard title={t('authCatalog.companyScoped')} value={roles.filter((role) => role.scopeType === 'company').length} note={t('authCatalog.companyScopedNote')} icon={<Shield size={18} />} tone="warning" />
        <MetricCard title={t('authCatalog.searchable')} value={filteredRoles.length} note={t('authCatalog.searchableNote')} icon={<SlidersHorizontal size={18} />} tone="danger" />
      </section>

      {feedback ? (
        <section className="panel">
          <div className="inline-state inline-state-accent">{feedback}</div>
        </section>
      ) : null}

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading panel-heading-spread">
            <div>
              <div className="eyebrow">{t('authCatalog.roles')}</div>
              <h3>{t('authCatalog.roleDefinitions')}</h3>
              <p className="queue-subtitle">{t('authCatalog.roleSearchCopy')}</p>
            </div>
            <label className="search-field">
              <span className="sr-only">{t('authCatalog.filterRoles')}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('authCatalog.roleSearchPlaceholder')}
              />
            </label>
          </div>

          {filteredRoles.length === 0 ? (
            <EmptyState copy={t('authCatalog.noRolesMatched')} />
          ) : (
            <div className="stacked-table">
              {filteredRoles.map((role) => (
                <article className="stacked-row" key={role.roleId}>
                  <div className="stacked-row-head">
                    <div>
                      <strong>{role.roleCode}</strong>
                      <span className="queue-subtitle">{role.roleName}</span>
                    </div>
                    <StatusPill tone={role.isSystemRole ? 'accent' : 'neutral'}>
                      {role.isSystemRole ? t('authCatalog.systemRole') : t('authCatalog.customRole')}
                    </StatusPill>
                  </div>
                  <p>{role.description ?? t('authCatalog.noRoleDescription')}</p>
                  <div className="action-cluster">
                    <span className="inline-state inline-state-neutral">{role.scopeType}</span>
                    {role.permissions.map((permission) => (
                      <button
                        className="control-button"
                        key={`${role.roleId}:${permission.permissionCode}`}
                        type="button"
                        onClick={() =>
                          revokeMutation.mutate({
                            roleId: role.roleId,
                            permissionCode: permission.permissionCode,
                          })
                        }
                        disabled={grantMutation.isPending || revokeMutation.isPending}
                      >
                        {t('authCatalog.revokePermission', { permissionCode: permission.permissionCode })}
                      </button>
                    ))}
                  </div>
                  <div className="action-cluster">
                    <label className="control-select">
                      <span className="sr-only">{t('authCatalog.permissionToGrant')}</span>
                      <select
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
                      </select>
                    </label>
                    <button
                      className="control-button"
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
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('authCatalog.permissions')}</div>
              <h3>{t('authCatalog.permissionCatalog')}</h3>
            </div>
          </div>
          {permissions.length === 0 ? (
            <EmptyState copy={t('authCatalog.noPermissions')} />
          ) : (
            <div className="stacked-table">
              {permissions.map((permission) => (
                <article className="stacked-row" key={permission.permissionId}>
                  <div className="stacked-row-head">
                    <strong>{permission.permissionCode}</strong>
                    <StatusPill tone="neutral">{permission.resourceName}</StatusPill>
                  </div>
                  <p>{permission.description ?? t('authCatalog.noPermissionDescription')}</p>
                  <div className="action-cluster">
                    <span className="inline-state inline-state-neutral">{permission.resourceName}</span>
                    <span className="inline-state inline-state-calm">{permission.actionName}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </section>
  )
}
