import { useMemo, useState } from 'react'
import { KeyRound, Route, ShieldCheck } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricCard,
  StatusPill,
} from '../../components/dashboard-primitives'
import type { LocalizationContextValue } from '../localization/localization-context'
import type { AuthLookups } from './api'
import {
  getPreviewRoleOptions,
  getRolePermissionPreviewRows,
  primaryPilotRoleCodes,
  supportRoleCodes,
} from './role-permission-preview'

type RolePermissionPreviewPanelProps = {
  lookups: AuthLookups
  t: LocalizationContextValue['t']
}

export function RolePermissionPreviewPanel({
  lookups,
  t,
}: RolePermissionPreviewPanelProps) {
  const roleOptions = useMemo(() => getPreviewRoleOptions(lookups.roles), [lookups.roles])
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>(roleOptions[0]?.roleCode ?? 'SUPER_ADMIN')
  const rows = useMemo(() => getRolePermissionPreviewRows(), [])
  const selectedRole = roleOptions.find((role) => role.roleCode === selectedRoleCode) ?? roleOptions[0]
  const visibleRows = rows.filter((row) => row.allowedRoles.includes(selectedRoleCode))
  const blockedRows = rows.filter((row) => !row.allowedRoles.includes(selectedRoleCode))
  const adminVisibleCount = visibleRows.filter((row) => row.shell === 'admin').length
  const storeVisibleCount = visibleRows.filter((row) => row.shell === 'store').length

  return (
    <section className="panel" data-testid="role-permission-preview">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{t('authAdmin.previewEyebrow')}</div>
          <h3>{t('authAdmin.previewTitle')}</h3>
          <p className="queue-subtitle">{t('authAdmin.previewCopy')}</p>
        </div>
        <StatusPill tone="neutral">{t('authAdmin.previewOnly')}</StatusPill>
      </div>

      <div className="two-up-grid">
        <label className="field-block">
          <span>{t('authAdmin.previewRole')}</span>
          <select
            aria-label={t('authAdmin.previewRole')}
            value={selectedRoleCode}
            onChange={(event) => setSelectedRoleCode(event.target.value)}
          >
            {roleOptions.map((role) => (
              <option key={role.roleCode} value={role.roleCode}>
                {role.roleCode} - {role.roleName}
              </option>
            ))}
          </select>
        </label>
        <div className="key-grid">
          <KeyValue
            label={t('authAdmin.previewRoleFamily')}
            value={selectedRole?.primary ? t('authAdmin.previewPrimaryPilot') : t('authAdmin.previewSupportRole')}
          />
          <KeyValue
            label={t('authAdmin.previewRoleCatalog')}
            value={lookups.roles.some((role) => role.roleCode === selectedRoleCode)
              ? t('authAdmin.previewInCatalog')
              : t('authAdmin.previewDocumentedOnly')}
          />
        </div>
      </div>

      <section className="metric-grid">
        <MetricCard
          title={t('authAdmin.previewAllowedRoutes')}
          value={visibleRows.length}
          note={t('authAdmin.previewAllowedRoutesNote')}
          icon={<Route size={18} />}
          tone="calm"
        />
        <MetricCard
          title={t('authAdmin.previewAdminSurfaces')}
          value={adminVisibleCount}
          note={t('authAdmin.previewAdminSurfacesNote')}
          icon={<ShieldCheck size={18} />}
          tone="accent"
        />
        <MetricCard
          title={t('authAdmin.previewStoreSurfaces')}
          value={storeVisibleCount}
          note={t('authAdmin.previewStoreSurfacesNote')}
          icon={<KeyRound size={18} />}
          tone="warning"
        />
      </section>

      {rows.length === 0 ? (
        <EmptyState copy={t('authAdmin.previewEmpty')} />
      ) : (
        <div className="stacked-table">
          {rows.map((row) => {
            const allowed = row.allowedRoles.includes(selectedRoleCode)

            return (
              <article className="stacked-row" key={row.id}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{row.route}</strong>
                    <span className="queue-subtitle">{t(row.labelKey)}</span>
                  </div>
                  <StatusPill tone={allowed ? 'calm' : 'neutral'}>
                    {allowed ? t('authAdmin.previewAllowed') : t('authAdmin.previewBlocked')}
                  </StatusPill>
                </div>
                <div className="key-grid">
                  <KeyValue label={t('authAdmin.previewShell')} value={row.shell} />
                  <KeyValue label={t('authAdmin.previewAllowedRoles')} value={row.allowedRoles.join(', ')} />
                  <KeyValue label={t('authAdmin.previewScopeBoundary')} value={t(row.scopeNoteKey)} />
                  <KeyValue label={t('authAdmin.previewActionBoundary')} value={t(row.actionNoteKey)} />
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="key-grid">
        <KeyValue
          label={t('authAdmin.previewPrimaryRoles')}
          value={primaryPilotRoleCodes.join(', ')}
        />
        <KeyValue
          label={t('authAdmin.previewSupportRoles')}
          value={supportRoleCodes.join(', ')}
        />
        <KeyValue
          label={t('authAdmin.previewBlockedRoutes')}
          value={String(blockedRows.length)}
        />
        <KeyValue
          label={t('authAdmin.previewSource')}
          value={t('authAdmin.previewSourceCopy')}
        />
      </div>
    </section>
  )
}
