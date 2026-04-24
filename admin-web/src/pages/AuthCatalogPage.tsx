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
import { getErrorMessage } from '../lib/format'

export function AuthCatalogPage() {
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
    return <ScreenState title="Loading auth catalog" copy="Pulling roles and permission definitions." />
  }

  if (rolesQuery.isError) {
    return <ScreenState title="Role catalog unavailable" copy={getErrorMessage(rolesQuery.error)} tone="error" />
  }

  if (permissionsQuery.isError) {
    return <ScreenState title="Permission catalog unavailable" copy={getErrorMessage(permissionsQuery.error)} tone="error" />
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Auth Catalog</div>
          <h2 className="hero-title">Role and permission definitions stay explicit and inspectable.</h2>
          <p className="hero-copy">
            This catalog keeps the authorization model readable before we add mutation forms and
            deeper audit tooling on top of it.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Roles" value={String(roles.length)} />
          <MetricAccent label="Permissions" value={String(permissions.length)} />
          <MetricAccent label="System roles" value={String(roles.filter((role) => role.isSystemRole).length)} />
        </div>
      </section>

      <Link className="back-link" to="/admin/auth">
        <span>Back to auth overview</span>
      </Link>

      <section className="metric-grid">
        <MetricCard title="Role count" value={roles.length} note="Distinct role definitions in ops.role" icon={<UserRoundCog size={18} />} tone="accent" />
        <MetricCard title="Permission count" value={permissions.length} note="Cataloged action capabilities" icon={<Fingerprint size={18} />} tone="calm" />
        <MetricCard title="Company scoped" value={roles.filter((role) => role.scopeType === 'company').length} note="Roles that can bind at company level" icon={<Shield size={18} />} tone="warning" />
        <MetricCard title="Searchable" value={filteredRoles.length} note="Roles currently visible after filter" icon={<SlidersHorizontal size={18} />} tone="danger" />
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
              <div className="eyebrow">Roles</div>
              <h3>Role definitions</h3>
              <p className="panel-copy">Search by code, name, scope, or permission code.</p>
            </div>
            <label className="search-field">
              <span className="sr-only">Filter roles</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search role code, name, scope, or permission"
              />
            </label>
          </div>

          {filteredRoles.length === 0 ? (
            <EmptyState copy="No roles matched your filter." />
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
                      {role.isSystemRole ? 'System role' : 'Custom role'}
                    </StatusPill>
                  </div>
                  <p>{role.description ?? 'No role description provided.'}</p>
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
                        Revoke {permission.permissionCode}
                      </button>
                    ))}
                  </div>
                  <div className="action-cluster">
                    <label className="control-select">
                      <span className="sr-only">Permission to grant</span>
                      <select
                        value={draftByRole[role.roleId] ?? ''}
                        onChange={(event) =>
                          setDraftByRole((current) => ({
                            ...current,
                            [role.roleId]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select permission</option>
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
                      {grantMutation.isPending ? 'Granting...' : 'Grant permission'}
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
              <div className="eyebrow">Permissions</div>
              <h3>Permission catalog</h3>
            </div>
          </div>
          {permissions.length === 0 ? (
            <EmptyState copy="No permissions are available yet." />
          ) : (
            <div className="stacked-table">
              {permissions.map((permission) => (
                <article className="stacked-row" key={permission.permissionId}>
                  <div className="stacked-row-head">
                    <strong>{permission.permissionCode}</strong>
                    <StatusPill tone="neutral">{permission.resourceName}</StatusPill>
                  </div>
                  <p>{permission.description ?? 'No permission description provided.'}</p>
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
