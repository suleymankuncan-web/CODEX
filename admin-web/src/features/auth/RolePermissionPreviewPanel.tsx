import { useMemo, useState } from 'react'
import { KeyRound, Route, ShieldCheck } from 'lucide-react'
import {
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminMetricStrip,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceSection,
} from '../../pages/admin-surface-primitives'
import {
  AuthField,
  AuthList,
  AuthListRow,
  AuthMuted,
  AuthNativeSelect,
  AuthRowHead,
} from './AuthSurfacePrimitives'
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
    <AdminSurfaceSection
      eyebrow={t('authAdmin.previewEyebrow')}
      title={t('authAdmin.previewTitle')}
      description={t('authAdmin.previewCopy')}
      badge={<AdminSurfaceBadge tone="neutral">{t('authAdmin.previewOnly')}</AdminSurfaceBadge>}
      testId="role-permission-preview"
    >

      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:lg:grid-cols-[minmax(15rem,0.45fr)_1fr]">
        <AuthField label={t('authAdmin.previewRole')}>
          <AuthNativeSelect
            aria-label={t('authAdmin.previewRole')}
            value={selectedRoleCode}
            onChange={(event) => setSelectedRoleCode(event.target.value)}
          >
            {roleOptions.map((role) => (
              <option key={role.roleCode} value={role.roleCode}>
                {role.roleCode} - {role.roleName}
              </option>
            ))}
          </AuthNativeSelect>
        </AuthField>
        <AdminKeyValueGrid>
          <AdminKeyValue
            label={t('authAdmin.previewRoleFamily')}
            value={selectedRole?.primary ? t('authAdmin.previewPrimaryPilot') : t('authAdmin.previewSupportRole')}
          />
          <AdminKeyValue
            label={t('authAdmin.previewRoleCatalog')}
            value={lookups.roles.some((role) => role.roleCode === selectedRoleCode)
              ? t('authAdmin.previewInCatalog')
              : t('authAdmin.previewDocumentedOnly')}
          />
        </AdminKeyValueGrid>
      </div>

      <AdminMetricStrip
        className="tw:xl:grid-cols-3"
        items={[
          {
            id: 'preview-allowed-routes',
            label: t('authAdmin.previewAllowedRoutes'),
            value: visibleRows.length,
            description: t('authAdmin.previewAllowedRoutesNote'),
            icon: <Route size={18} />,
            tone: 'success',
          },
          {
            id: 'preview-admin-surfaces',
            label: t('authAdmin.previewAdminSurfaces'),
            value: adminVisibleCount,
            description: t('authAdmin.previewAdminSurfacesNote'),
            icon: <ShieldCheck size={18} />,
            tone: 'accent',
          },
          {
            id: 'preview-store-surfaces',
            label: t('authAdmin.previewStoreSurfaces'),
            value: storeVisibleCount,
            description: t('authAdmin.previewStoreSurfacesNote'),
            icon: <KeyRound size={18} />,
            tone: 'warning',
          },
        ]}
      />

      {rows.length === 0 ? (
        <AdminSurfaceEmpty copy={t('authAdmin.previewEmpty')} />
      ) : (
        <AuthList>
          {rows.map((row) => {
            const allowed = row.allowedRoles.includes(selectedRoleCode)

            return (
              <AuthListRow key={row.id}>
                <AuthRowHead>
                  <div>
                    <strong className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">{row.route}</strong>
                    <AuthMuted>{t(row.labelKey)}</AuthMuted>
                  </div>
                  <AdminSurfaceBadge tone={allowed ? 'success' : 'neutral'}>
                    {allowed ? t('authAdmin.previewAllowed') : t('authAdmin.previewBlocked')}
                  </AdminSurfaceBadge>
                </AuthRowHead>
                <AdminKeyValueGrid>
                  <AdminKeyValue label={t('authAdmin.previewShell')} value={row.shell} />
                  <AdminKeyValue label={t('authAdmin.previewAllowedRoles')} value={row.allowedRoles.join(', ')} />
                  <AdminKeyValue label={t('authAdmin.previewScopeBoundary')} value={t(row.scopeNoteKey)} />
                  <AdminKeyValue label={t('authAdmin.previewActionBoundary')} value={t(row.actionNoteKey)} />
                </AdminKeyValueGrid>
              </AuthListRow>
            )
          })}
        </AuthList>
      )}

      <AdminKeyValueGrid>
        <AdminKeyValue
          label={t('authAdmin.previewPrimaryRoles')}
          value={primaryPilotRoleCodes.join(', ')}
        />
        <AdminKeyValue
          label={t('authAdmin.previewSupportRoles')}
          value={supportRoleCodes.join(', ')}
        />
        <AdminKeyValue
          label={t('authAdmin.previewBlockedRoutes')}
          value={String(blockedRows.length)}
        />
        <AdminKeyValue
          label={t('authAdmin.previewSource')}
          value={t('authAdmin.previewSourceCopy')}
        />
      </AdminKeyValueGrid>
    </AdminSurfaceSection>
  )
}
