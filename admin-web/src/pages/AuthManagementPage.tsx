import { IncentiveApprovalCheckbox } from '../features/auth/incentive-approval-checkbox'
import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  LockKeyhole,
  Mail,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  Users,
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  createActionStoreAssignmentsBatch,
  createRoleAssignment,
  updateIncentiveApproval,
  createUserAccount,
  deactivateActionStoreAssignment,
  deactivateRoleAssignment,
  deactivateUserAccount,
  getActionStoreAssignments,
  getAuthLookups,
  getPermissions,
  getRoleAssignments,
  getRoles,
  getUserAccounts,
  grantRolePermission,
  reactivateUserAccount,
  revokeRolePermission,
  type RoleCatalogItem,
  type UserAccount,
} from '../features/auth/api'
import { actionToast } from '../lib/action-toast'
import {
  AdminStatePanel,
  AdminSurfacePage,
} from './admin-surface-primitives'

type AuthWorkspace = 'users' | 'permissions'

export function AuthManagementPage() {
  const queryClient = useQueryClient()
  const [workspace, setWorkspace] = useState<AuthWorkspace>('users')
  const [query, setQuery] = useState('')
  const [userPage, setUserPage] = useState(0)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [storeOpen, setStoreOpen] = useState(false)
  const [accountAction, setAccountAction] = useState<UserAccount | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [permissionAction, setPermissionAction] = useState<PermissionAction | null>(null)
  const deferredQuery = useDeferredValue(query.trim())

  const usersQuery = useQuery({
    queryKey: ['auth-management', 'users', deferredQuery, userPage],
    queryFn: () => getUserAccounts({ ...(deferredQuery ? { q: deferredQuery } : {}), limit: 10, offset: userPage * 10 }),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[2] === deferredQuery ? previousData : undefined,
  })
  const lookupsQuery = useQuery({ queryKey: ['auth-management', 'lookups'], queryFn: getAuthLookups })
  const rolesQuery = useQuery({ queryKey: ['auth-management', 'roles'], queryFn: getRoles })
  const permissionsQuery = useQuery({ queryKey: ['auth-management', 'permissions'], queryFn: getPermissions })

  const selectedUser = useMemo(() => {
    const users = usersQuery.data?.items ?? []
    return users.find((user) => user.userId === selectedUserId) ?? users[0] ?? null
  }, [selectedUserId, usersQuery.data?.items])
  const selectedRole = useMemo(() => {
    const roles = rolesQuery.data?.items ?? []
    return roles.find((role) => role.roleId === selectedRoleId) ?? roles[0] ?? null
  }, [rolesQuery.data?.items, selectedRoleId])
  const userTotal = usersQuery.data?.meta.total ?? 0
  const visibleUserOffset = usersQuery.data?.meta.offset ?? userPage * 10
  const visibleUserPage = Math.floor(visibleUserOffset / 10)
  const userPageCount = Math.max(1, Math.ceil(userTotal / 10))
  const userRangeStart = userTotal === 0 ? 0 : visibleUserOffset + 1
  const userRangeEnd = Math.min(visibleUserOffset + (usersQuery.data?.items.length ?? 0), userTotal)

  const roleAssignmentsQuery = useQuery({
    queryKey: ['auth-management', 'role-assignments', selectedUser?.userId],
    queryFn: () => getRoleAssignments({ userId: selectedUser!.userId, active: true, limit: 100 }),
    enabled: Boolean(selectedUser),
  })
  const storeAssignmentsQuery = useQuery({
    queryKey: ['auth-management', 'store-assignments', selectedUser?.userId],
    queryFn: () => getActionStoreAssignments({ userId: selectedUser!.userId, active: true, limit: 200 }),
    enabled: Boolean(selectedUser),
  })
  const lookupsUnavailable = lookupsQuery.isLoading || lookupsQuery.isFetching || lookupsQuery.isError
  const roleAssignmentsUnavailable = roleAssignmentsQuery.isLoading || roleAssignmentsQuery.isFetching || roleAssignmentsQuery.isError
  const storeAssignmentsUnavailable = storeAssignmentsQuery.isLoading || storeAssignmentsQuery.isFetching || storeAssignmentsQuery.isError

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: ['auth-management'] })
  const createUserMutation = useMutation({
    mutationFn: createUserAccount,
    onSuccess: async (response) => { await invalidate(); setCreateOpen(false); setSelectedUserId(response.data.user.userId); actionToast.success('Kullanıcı hesabı oluşturuldu.') },
    onError: (error) => actionToast.error(error, 'Kullanıcı hesabı oluşturulamadı.'),
  })
  const accountMutation = useMutation({
    mutationFn: (user: UserAccount) => user.isActive ? deactivateUserAccount({ userId: user.userId, reason: 'Admin yönetim ekranından devre dışı bırakıldı' }) : reactivateUserAccount(user.userId),
    onSuccess: async () => { await invalidate(); setAccountAction(null); actionToast.success('Hesap durumu güncellendi.') },
    onError: (error) => actionToast.error(error, 'Hesap durumu güncellenemedi.'),
  })
  const createRoleMutation = useMutation({
    mutationFn: createRoleAssignment,
    onSuccess: async () => { await invalidate(); setRoleOpen(false); actionToast.success('Rol ataması eklendi.') },
    onError: (error) => actionToast.error(error, 'Rol ataması eklenemedi.'),
  })
  const incentiveApprovalMutation = useMutation({
    mutationFn: updateIncentiveApproval,
    onSuccess: async () => { await invalidate(); await queryClient.invalidateQueries({ queryKey: ['shell-session'] }); actionToast.success('Prim onayı yetkisi güncellendi.') },
    onError: (error) => actionToast.error(error, 'Prim onayı yetkisi güncellenemedi.'),
  })
  const removeRoleMutation = useMutation({
    mutationFn: deactivateRoleAssignment,
    onSuccess: async () => { await invalidate(); actionToast.success('Rol ataması kaldırıldı.') },
    onError: (error) => actionToast.error(error, 'Rol ataması kaldırılamadı.'),
  })
  const createStoreMutation = useMutation({
    mutationFn: (input: { userId: string; storeIds: string[] }) => createActionStoreAssignmentsBatch(input),
    onSuccess: async () => { await invalidate(); setStoreOpen(false); actionToast.success('Mağaza erişimi eklendi.') },
    onError: async (error) => { await invalidate(); actionToast.error(error, 'Bazı mağaza erişimleri eklenemedi. Güncel listeyi kontrol edin.') },
  })
  const removeStoreMutation = useMutation({
    mutationFn: deactivateActionStoreAssignment,
    onSuccess: async () => { await invalidate(); actionToast.success('Mağaza erişimi kaldırıldı.') },
    onError: (error) => actionToast.error(error, 'Mağaza erişimi kaldırılamadı.'),
  })
  const permissionMutation = useMutation({
    mutationFn: (action: PermissionAction) => action.granted ? revokeRolePermission(action) : grantRolePermission(action),
    onSuccess: async () => { await invalidate(); setPermissionAction(null); actionToast.success('Rol yetkileri güncellendi.') },
    onError: (error) => actionToast.error(error, 'Yetki güncellenemedi.'),
  })

  return (
    <AdminSurfacePage ariaLabel="Erişim yönetimi" className="tw:max-w-none tw:gap-5 tw:font-sans">
      <section className="tw:overflow-hidden tw:rounded-[24px] tw:bg-primary tw:text-primary-foreground tw:shadow-[0_24px_60px_-36px_rgba(16,26,56,0.72)]">
        <div className="tw:grid tw:gap-5 tw:px-5 tw:pt-6 tw:pb-5 tw:sm:px-7 tw:sm:pt-7 tw:lg:grid-cols-[minmax(0,1fr)_auto] tw:lg:items-center tw:lg:px-8">
          <div className="tw:min-w-0">
            <div className="tw:flex tw:items-center tw:gap-4">
              <div className="tw:flex tw:size-11 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-2xl tw:bg-accent tw:text-accent-foreground"><LockKeyhole className="tw:size-5" aria-hidden="true" /></div>
              <div><p className="tw:m-0 tw:text-[10px] tw:font-bold tw:tracking-[0.18em] tw:text-primary-foreground/70 tw:uppercase">Kimlik ve erişim</p><h1 className="tw:mt-1 tw:mb-0 tw:text-[clamp(1.55rem,3vw,2.25rem)] tw:leading-none tw:font-semibold tw:tracking-[-0.04em]" style={{ fontFamily: "'Manrope', sans-serif" }}>Kullanıcılar ve yetkiler</h1></div>
            </div>
            <p className="tw:mt-4 tw:mb-0 tw:max-w-2xl tw:text-sm tw:leading-6 tw:text-primary-foreground/75">Hesapları, çalışma kapsamlarını ve rol izinlerini yönetin.</p>
          </div>
          <div className="tw:flex tw:items-center tw:border-t tw:border-white/10 tw:pt-5 tw:lg:border-t-0 tw:lg:pt-0">
            {workspace === 'users' ? <Button className="tw:ml-auto tw:bg-accent tw:text-accent-foreground tw:hover:bg-accent/90" onClick={() => setCreateOpen(true)}>
                <UserPlus aria-hidden="true" /> Kullanıcı ekle
              </Button> : null}
          </div>
        </div>
        <nav aria-label="Erişim alanları" className="tw:flex tw:border-t tw:border-white/10 tw:px-3 tw:sm:px-7">
          <WorkspaceTab active={workspace === 'users'} onClick={() => setWorkspace('users')}><Users aria-hidden="true" /> Kullanıcılar</WorkspaceTab>
          <WorkspaceTab active={workspace === 'permissions'} onClick={() => setWorkspace('permissions')}><KeyRound aria-hidden="true" /> Rol yetkileri</WorkspaceTab>
        </nav>
      </section>

      {workspace === 'users' ? (
        <div className="tw:grid tw:min-w-0 tw:gap-5 tw:lg:grid-cols-[340px_minmax(0,1fr)]">
          <section className="tw:min-w-0 tw:overflow-hidden tw:rounded-[24px] tw:border tw:border-border tw:bg-card tw:shadow-[0_20px_50px_-42px_rgba(15,30,68,0.7)]">
            <header className="tw:border-b tw:border-border tw:p-4 tw:sm:p-5">
              <div className="tw:mb-4 tw:flex tw:items-end tw:justify-between tw:gap-3">
                <div><p className="tw:m-0 tw:text-[10px] tw:font-bold tw:tracking-[0.16em] tw:text-muted-foreground tw:uppercase">Dizin</p><h2 className="tw:mt-1 tw:mb-0 tw:text-lg tw:font-semibold tw:tracking-[-0.02em]">Kullanıcılar</h2></div>
                <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{userTotal} hesap</span>
              </div>
              <div className="tw:relative"><Search className="tw:absolute tw:top-1/2 tw:left-3 tw:size-4 tw:-translate-y-1/2 tw:text-muted-foreground" aria-hidden="true" /><Input aria-label="Kullanıcı ara" className="tw:h-11 tw:rounded-xl tw:border-border tw:bg-muted/40 tw:pl-9 tw:shadow-none" onChange={(event) => { setQuery(event.target.value); setUserPage(0) }} placeholder="Ad, kullanıcı adı veya e-posta" value={query} /></div>
            </header>
            {usersQuery.isLoading ? <AdminStatePanel isLoading title="Kullanıcılar yükleniyor" /> : null}
            {usersQuery.error ? <AdminStatePanel action={<Button onClick={() => void usersQuery.refetch()} size="sm" variant="outline">Yeniden dene</Button>} description="Bağlantınızı kontrol edip yeniden deneyin." tone="danger" title="Kullanıcılar alınamadı" /> : null}
            {!usersQuery.isLoading && !usersQuery.error ? <div aria-busy={usersQuery.isFetching} aria-label="Kullanıcı listesi" className="tw:max-h-[640px] tw:overflow-y-auto tw:px-3 tw:py-2">
              {(usersQuery.data?.items ?? []).map((user) => (
                <button
                  aria-current={selectedUser?.userId === user.userId ? 'true' : undefined}
                  className="tw:group tw:relative tw:flex tw:w-full tw:appearance-none tw:items-center tw:gap-3 tw:border-0 tw:border-b tw:border-border tw:bg-transparent tw:px-2 tw:py-3.5 tw:text-left tw:shadow-none tw:transition tw:last:border-b-0 tw:hover:bg-muted/50 tw:aria-current:bg-accent/25 tw:aria-current:before:absolute tw:aria-current:before:top-2.5 tw:aria-current:before:bottom-2.5 tw:aria-current:before:left-0 tw:aria-current:before:w-0.5 tw:aria-current:before:rounded-full tw:aria-current:before:bg-primary"
                  key={user.userId}
                  onClick={() => setSelectedUserId(user.userId)}
                  type="button"
                >
                  <span className="tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-muted tw:text-[11px] tw:font-bold tw:text-primary tw:group-aria-current:bg-primary tw:group-aria-current:text-primary-foreground">{initials(user.username)}</span>
                  <span className="tw:min-w-0 tw:flex-1"><span className="tw:block tw:truncate tw:text-sm tw:font-semibold">{user.username}</span><span className="tw:mt-0.5 tw:block tw:truncate tw:text-xs tw:text-muted-foreground">{user.email}</span></span>
                  <AccountStatusBadge user={user} compact />
                </button>
              ))}
            </div> : null}
            {!usersQuery.isLoading && !usersQuery.error ? <footer className="tw:flex tw:items-center tw:justify-between tw:border-t tw:border-border tw:px-4 tw:py-3">
              <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{userRangeStart}-{userRangeEnd} / {userTotal}</span>
              <div className="tw:flex tw:items-center tw:gap-1.5">
                <Button aria-label="Önceki kullanıcı sayfası" className="tw:size-8" disabled={usersQuery.isFetching || userPage === 0} onClick={() => setUserPage((page) => Math.max(0, page - 1))} size="icon" variant="outline"><ChevronLeft aria-hidden="true" /></Button>
                <span className="tw:min-w-10 tw:text-center tw:text-xs tw:font-semibold tw:text-foreground">{visibleUserPage + 1}/{userPageCount}</span>
                <Button aria-label="Sonraki kullanıcı sayfası" className="tw:size-8" disabled={usersQuery.isFetching || userPage + 1 >= userPageCount} onClick={() => setUserPage((page) => Math.min(userPageCount - 1, page + 1))} size="icon" variant="outline"><ChevronRight aria-hidden="true" /></Button>
              </div>
            </footer> : null}
          </section>

          {selectedUser ? (
            <section className="tw:min-w-0 tw:overflow-hidden tw:rounded-[24px] tw:border tw:border-border tw:bg-card tw:shadow-[0_20px_50px_-42px_rgba(15,30,68,0.7)]">
              <header className="tw:bg-white tw:px-5 tw:py-5 tw:sm:px-7 tw:sm:py-6">
                <div className="tw:flex tw:flex-col tw:gap-5 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
                  <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-4">
                    <span className="tw:grid tw:size-14 tw:shrink-0 tw:place-items-center tw:rounded-2xl tw:bg-primary tw:text-base tw:font-bold tw:text-primary-foreground">{initials(selectedUser.username)}</span>
                    <div className="tw:min-w-0"><div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2"><h2 className="tw:m-0 tw:truncate tw:text-xl tw:font-semibold tw:tracking-[-0.025em]">{selectedUser.username}</h2><AccountStatusBadge user={selectedUser} /></div><p className="tw:mt-1 tw:mb-0 tw:flex tw:items-center tw:gap-1.5 tw:truncate tw:text-sm tw:text-muted-foreground"><Mail className="tw:size-3.5" aria-hidden="true" />{selectedUser.email}</p></div>
                  </div>
                  <Button className="tw:self-start" disabled={identityJobPending(selectedUser)} onClick={() => setAccountAction(selectedUser)} size="sm" variant="outline">{selectedUser.isActive ? 'Devre dışı bırak' : selectedUser.identityStatus === 'failed' ? 'Yeniden dene' : identityJobPending(selectedUser) ? 'İşleniyor' : 'Yeniden etkinleştir'}</Button>
                </div>
                <div className="tw:mt-6 tw:flex tw:flex-wrap tw:gap-x-7 tw:gap-y-2 tw:border-t tw:border-border tw:pt-4 tw:text-xs tw:text-muted-foreground">
                  <span><strong className="tw:mr-1 tw:text-foreground">{roleAssignmentsUnavailable ? '—' : roleAssignmentsQuery.data?.items.length ?? 0}</strong> aktif rol</span>
                  <span><strong className="tw:mr-1 tw:text-foreground">{storeAssignmentsUnavailable ? '—' : storeAssignmentsQuery.data?.items.length ?? 0}</strong> doğrudan mağaza</span>
                  <span>Sağlayıcı: <strong className="tw:text-foreground">{selectedUser.authProvider}</strong></span>
                </div>
              </header>
              <div className="tw:grid tw:gap-4 tw:p-4 tw:sm:p-5 tw:xl:grid-cols-2">
                {lookupsQuery.isError ? <AdminStatePanel action={<Button onClick={() => void lookupsQuery.refetch()} size="sm" variant="outline">Yeniden dene</Button>} className="tw:xl:col-span-2" description="Rol ve mağaza seçenekleri alınamadığı için yeni atamalar geçici olarak kapalı." tone="danger" title="Atama seçenekleri alınamadı" /> : null}
                <AccessBlock icon={<Shield aria-hidden="true" />} title="Roller" action={<Button disabled={roleAssignmentsUnavailable || lookupsUnavailable} onClick={() => setRoleOpen(true)} size="sm" variant="outline"><Plus aria-hidden="true" /> Rol ekle</Button>}>
                  {roleAssignmentsQuery.isLoading ? <AdminStatePanel isLoading title="Roller yükleniyor" /> : roleAssignmentsQuery.isError ? <AdminStatePanel action={<Button onClick={() => void roleAssignmentsQuery.refetch()} size="sm" variant="outline">Yeniden dene</Button>} tone="danger" title="Roller alınamadı" description="Bağlantınızı kontrol edip yeniden deneyin." /> : (roleAssignmentsQuery.data?.items ?? []).length ? roleAssignmentsQuery.data?.items.map((assignment) => (
                    <div key={assignment.assignmentId}>
                      <AccessRow label={roleDisplayName(assignment)} meta={scopeLabel(assignment)} onRemove={() => removeRoleMutation.mutate(assignment.assignmentId)} />
                      {assignment.roleCode === 'REPORT_VIEWER' && assignment.scopeType === 'company' ? <div className="tw:px-3 tw:pb-4"><p className="tw:text-xs tw:font-semibold tw:text-muted-foreground">Rol yetkileri</p><IncentiveApprovalCheckbox checked={assignment.incentiveApproval ?? false} disabled={incentiveApprovalMutation.isPending || roleAssignmentsUnavailable || removeRoleMutation.isPending} onChange={(enabled) => incentiveApprovalMutation.mutate({ assignmentId: assignment.assignmentId, enabled })} /></div> : null}
                    </div>
                  )) : <EmptyAccess copy="Rol ataması yok" />}
                </AccessBlock>
                <AccessBlock icon={<Building2 aria-hidden="true" />} title="Mağaza erişimi" action={<Button disabled={storeAssignmentsUnavailable || lookupsUnavailable} onClick={() => setStoreOpen(true)} size="sm" variant="outline"><Plus aria-hidden="true" /> Mağaza ekle</Button>}>
                  {storeAssignmentsQuery.isLoading ? <AdminStatePanel isLoading title="Mağaza erişimi yükleniyor" /> : storeAssignmentsQuery.isError ? <AdminStatePanel action={<Button onClick={() => void storeAssignmentsQuery.refetch()} size="sm" variant="outline">Yeniden dene</Button>} tone="danger" title="Mağaza erişimi alınamadı" description="Bağlantınızı kontrol edip yeniden deneyin." /> : (storeAssignmentsQuery.data?.items ?? []).length ? storeAssignmentsQuery.data?.items.map((assignment) => (
                    <AccessRow key={assignment.assignmentId} label={assignment.storeName} meta={assignment.storeCode} onRemove={() => removeStoreMutation.mutate(assignment.assignmentId)} />
                  )) : <EmptyAccess copy="Doğrudan mağaza erişimi yok" />}
                </AccessBlock>
              </div>
            </section>
          ) : <AdminStatePanel title="Kullanıcı seçin" description="Yetkileri düzenlemek için soldan bir kullanıcı seçin." />}
        </div>
      ) : (
        rolesQuery.isLoading || permissionsQuery.isLoading ? (
          <AdminStatePanel isLoading title="Rol yetkileri yükleniyor" />
        ) : rolesQuery.isError || permissionsQuery.isError ? (
          <AdminStatePanel
            action={<Button onClick={() => void Promise.all([rolesQuery.refetch(), permissionsQuery.refetch()])} size="sm" variant="outline">Yeniden dene</Button>}
            description="Rol ve yetki kataloğu alınamadı. Bağlantınızı kontrol edip yeniden deneyin."
            tone="danger"
            title="Rol yetkileri alınamadı"
          />
        ) : (
          <PermissionWorkspace
            permissions={permissionsQuery.data?.items ?? []}
            role={selectedRole}
            roles={rolesQuery.data?.items ?? []}
            onRoleChange={setSelectedRoleId}
            onToggle={setPermissionAction}
          />
        )
      )}

      <CreateUserDialog key={createOpen ? 'open' : 'closed'} open={createOpen} onOpenChange={setCreateOpen} onSave={(draft) => createUserMutation.mutate(draft)} pending={createUserMutation.isPending} />
      <RoleAssignmentDialog key={`${selectedUser?.userId ?? 'none'}-${roleOpen ? 'open' : 'closed'}`} open={roleOpen} onOpenChange={setRoleOpen} roles={lookupsQuery.data?.roles ?? []} stores={lookupsQuery.data?.stores ?? []} user={selectedUser} onSave={(draft) => createRoleMutation.mutate(draft)} pending={createRoleMutation.isPending} unavailable={roleAssignmentsUnavailable || lookupsUnavailable} unavailableByError={roleAssignmentsQuery.isError || lookupsQuery.isError} />
      <StoreAssignmentDialog key={`${selectedUser?.userId ?? 'none'}-${storeOpen ? 'open' : 'closed'}`} assignedStoreIds={(storeAssignmentsQuery.data?.items ?? []).map((item) => item.storeId)} open={storeOpen} onOpenChange={setStoreOpen} stores={lookupsQuery.data?.stores ?? []} user={selectedUser} onSave={(draft) => createStoreMutation.mutate(draft)} pending={createStoreMutation.isPending} unavailable={storeAssignmentsUnavailable || lookupsUnavailable} unavailableByError={storeAssignmentsQuery.isError || lookupsQuery.isError} />
      <ConfirmDialog open={Boolean(accountAction)} title={accountAction?.isActive ? 'Hesap devre dışı bırakılsın mı?' : 'Hesap yeniden etkinleştirilsin mi?'} copy={accountAction?.isActive ? 'Aktif rol, mağaza erişimi ve mobil oturumlar kapatılır.' : 'Hesap açılır; eski rol ve mağaza atamaları otomatik geri gelmez.'} confirmLabel={accountAction?.isActive ? 'Devre dışı bırak' : 'Etkinleştir'} onOpenChange={(open) => !open && setAccountAction(null)} onConfirm={() => accountAction && accountMutation.mutate(accountAction)} pending={accountMutation.isPending} />
      <ConfirmDialog open={Boolean(permissionAction)} title="Rol yetkisi değiştirilsin mi?" copy={permissionAction?.granted ? 'Bu izin role bağlı tüm kullanıcılar için kaldırılır.' : 'Bu izin role bağlı tüm kullanıcılar için etkinleşir.'} confirmLabel={permissionAction?.granted ? 'Yetkiyi kaldır' : 'Yetkiyi ver'} onOpenChange={(open) => !open && setPermissionAction(null)} onConfirm={() => permissionAction && permissionMutation.mutate(permissionAction)} pending={permissionMutation.isPending} />
    </AdminSurfacePage>
  )
}

function PermissionWorkspace({ permissions, role, roles, onRoleChange, onToggle }: {
  permissions: Array<{ permissionCode: string; resourceName: string; actionName: string; description: string | null }>
  role: RoleCatalogItem | null
  roles: RoleCatalogItem[]
  onRoleChange: (id: string) => void
  onToggle: (action: PermissionAction) => void
}) {
  const grouped = useMemo(() => {
    const entries = new Map<string, typeof permissions>()
    for (const permission of permissions) {
      entries.set(permission.resourceName, [...(entries.get(permission.resourceName) ?? []), permission])
    }
    return entries
  }, [permissions])
  const granted = new Set(role?.permissions.map((permission) => permission.permissionCode) ?? [])
  return (
    <section className="tw:overflow-hidden tw:rounded-[24px] tw:border tw:border-border tw:bg-card tw:shadow-[0_20px_50px_-42px_rgba(15,30,68,0.7)]">
      <header className="tw:grid tw:gap-5 tw:border-b tw:border-border tw:bg-background tw:px-5 tw:py-5 tw:sm:px-7 tw:sm:py-6 tw:lg:grid-cols-[minmax(0,1fr)_360px] tw:lg:items-end">
        <div><p className="tw:m-0 tw:text-[10px] tw:font-bold tw:tracking-[0.16em] tw:text-muted-foreground tw:uppercase">Yetki yönetimi</p><h2 className="tw:mt-1 tw:mb-0 tw:text-2xl tw:font-semibold tw:tracking-[-0.03em]">Rol yetkileri</h2><p className="tw:mt-2 tw:mb-0 tw:max-w-xl tw:text-sm tw:leading-5 tw:text-muted-foreground">Önce düzenlemek istediğiniz rolü seçin. Ardından bu role sahip kullanıcıların yapabileceklerini açın veya kapatın.</p></div>
        <div><Label className="tw:mb-2 tw:flex tw:items-center tw:gap-2 tw:text-xs tw:font-bold tw:text-foreground"><span className="tw:grid tw:size-5 tw:place-items-center tw:rounded-full tw:bg-primary tw:text-[10px] tw:text-primary-foreground">1</span> Düzenlenecek rol</Label><Select value={role?.roleId ?? ''} onValueChange={onRoleChange}><SelectTrigger aria-label="Yetkileri düzenlenecek rol" className="tw:h-11 tw:w-full tw:rounded-xl tw:border-border tw:bg-muted/40 tw:shadow-none"><SelectValue placeholder="Rol seçin" /></SelectTrigger><SelectContent>{roles.map((item) => <SelectItem key={item.roleId} value={item.roleId}>{roleDisplayName(item)}</SelectItem>)}</SelectContent></Select></div>
      </header>
      {!role ? <AdminStatePanel title="Rol seçin" /> : (
        <div className="tw:p-4 tw:sm:p-5">
          <div className="tw:mb-4 tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between"><div className="tw:flex tw:items-center tw:gap-2"><span className="tw:grid tw:size-5 tw:place-items-center tw:rounded-full tw:bg-primary tw:text-[10px] tw:font-bold tw:text-primary-foreground">2</span><h3 className="tw:m-0 tw:text-sm tw:font-semibold">{roleDisplayName(role)} için yetkileri seçin</h3></div><span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{granted.size} yetki açık</span></div>
          <div className="tw:grid tw:gap-4 tw:xl:grid-cols-2">{Array.from(grouped.entries()).map(([resource, items]) => (
            <section className="tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-background" key={resource}>
              <header className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-border tw:px-4 tw:py-3.5"><div className="tw:flex tw:items-center tw:gap-2.5"><span className="tw:grid tw:size-8 tw:place-items-center tw:rounded-lg tw:bg-accent/30 tw:text-primary"><SlidersHorizontal className="tw:size-4" aria-hidden="true" /></span><h3 className="tw:m-0 tw:text-sm tw:font-semibold">{resourceDisplayName(resource)}</h3></div><span className="tw:text-xs tw:text-muted-foreground">{items.filter((item) => granted.has(item.permissionCode)).length}/{items.length} açık</span></header>
              <div className="tw:divide-y tw:divide-[#edf1f8]">
            {items.map((permission) => {
              const checked = granted.has(permission.permissionCode)
              return (
                <label className={`tw:flex tw:cursor-pointer tw:items-start tw:gap-3 tw:px-4 tw:py-3.5 tw:transition-colors tw:hover:bg-muted/40 ${checked ? 'tw:bg-accent/20' : ''}`} key={permission.permissionCode}>
                  <Checkbox checked={checked} onCheckedChange={() => onToggle({ roleId: role.roleId, permissionCode: permission.permissionCode, granted: checked })} />
                  <span className="tw:min-w-0 tw:flex-1"><span className="tw:block tw:text-sm tw:font-semibold">{permissionActionName(permission.actionName)}</span><span className="tw:mt-0.5 tw:block tw:text-xs tw:leading-5 tw:text-muted-foreground">{permissionDescription(permission)}</span></span>
                  <span className={`tw:shrink-0 tw:rounded-full tw:px-2 tw:py-1 tw:text-[10px] tw:font-semibold ${checked ? 'tw:bg-accent/35 tw:text-primary' : 'tw:bg-muted tw:text-muted-foreground'}`}>{checked ? 'Açık' : 'Kapalı'}</span>
                </label>
              )
            })}
          </div>
            </section>
          ))}</div>
        </div>
      )}
    </section>
  )
}

type PermissionAction = { roleId: string; permissionCode: string; granted: boolean }

function WorkspaceTab({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button aria-current={active ? 'page' : undefined} className="tw:relative tw:flex tw:h-13 tw:appearance-none tw:items-center tw:gap-2 tw:border-0 tw:bg-transparent tw:px-3 tw:text-sm tw:font-semibold tw:text-primary-foreground/65 tw:shadow-none tw:transition tw:hover:bg-transparent tw:hover:text-primary-foreground tw:aria-current:bg-transparent tw:aria-current:text-primary-foreground after:tw:absolute after:tw:right-3 after:tw:bottom-0 after:tw:left-3 after:tw:h-0.5 after:tw:rounded-full after:tw:bg-accent after:tw:opacity-0 aria-current:after:tw:opacity-100 sm:tw:px-5 sm:after:tw:right-5 sm:after:tw:left-5" onClick={onClick} type="button">{children}</button>
}

function AccessBlock({ action, children, icon, title }: { action: React.ReactNode; children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return <section className="tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-background"><header className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border tw:p-3.5"><div className="tw:flex tw:items-center tw:gap-2 tw:font-semibold tw:text-foreground">{icon}{title}</div>{action}</header><div className="tw:divide-y tw:divide-border">{children}</div></section>
}

function AccessRow({ label, meta, onRemove }: { label: string; meta: string; onRemove: () => void }) {
  return <div className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:p-3"><div><div className="tw:text-sm tw:font-medium">{label}</div><div className="tw:text-xs tw:text-muted-foreground">{meta}</div></div><Button onClick={onRemove} size="sm" variant="ghost">Kaldır</Button></div>
}

function EmptyAccess({ copy }: { copy: string }) { return <div className="tw:p-4 tw:text-sm tw:text-muted-foreground">{copy}</div> }

function identityJobPending(user: UserAccount) {
  return user.identityStatus === 'pending' || user.identityStatus === 'processing'
}

function AccountStatusBadge({ user, compact = false }: { user: UserAccount; compact?: boolean }) {
  if (identityJobPending(user)) {
    const label = user.identityOperation === 'disable' ? 'Kapatılıyor' : user.identityOperation === 'enable' ? 'Açılıyor' : 'Hazırlanıyor'
    return <Badge className="tw:border-amber-200 tw:bg-amber-50 tw:text-amber-800" variant="outline">{compact ? label : `${label} (Keycloak)`}</Badge>
  }
  if (user.identityStatus === 'failed') {
    return <Badge className="tw:border-red-200 tw:bg-red-50 tw:text-red-700" title={user.identityErrorCode ?? undefined} variant="outline">{compact ? 'Hata' : 'Keycloak işlemi başarısız'}</Badge>
  }
  return <Badge className={user.isActive ? 'tw:border-emerald-200 tw:bg-emerald-50 tw:text-emerald-800' : 'tw:border-slate-200 tw:bg-slate-100 tw:text-slate-600'} variant="outline">{compact ? (user.isActive ? 'Aktif' : 'Pasif') : (user.isActive ? 'Aktif hesap' : 'Pasif hesap')}</Badge>
}

function CreateUserDialog({ open, onOpenChange, onSave, pending }: { open: boolean; onOpenChange: (open: boolean) => void; onSave: (draft: { username: string; email: string; authProvider: 'local' | 'oidc' | 'sso' | 'clerk'; providerSubject?: string }) => void; pending: boolean }) {
  const [draft, setDraft] = useState({ username: '', email: '', authProvider: 'oidc' as const, providerSubject: '' })
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent closeLabel="Kapat"><DialogHeader><DialogTitle>Kullanıcı ekle</DialogTitle><DialogDescription>OIDC seçildiğinde Keycloak hesabı otomatik oluşturulur ve kullanıcıya şifre belirleme bağlantısı gönderilir.</DialogDescription></DialogHeader><div className="tw:grid tw:gap-3"><Field label="Kullanıcı adı"><Input aria-label="Kullanıcı adı" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value.toLowerCase() })} /></Field><Field label="E-posta"><Input aria-label="E-posta" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value.toLowerCase() })} /></Field><Field label="Kimlik sağlayıcı"><Select value={draft.authProvider} onValueChange={(value) => setDraft({ ...draft, authProvider: value as typeof draft.authProvider, providerSubject: '' })}><SelectTrigger aria-label="Kimlik sağlayıcı" className="tw:w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="oidc">Keycloak / OIDC</SelectItem><SelectItem value="clerk">Clerk</SelectItem><SelectItem value="sso">SSO</SelectItem><SelectItem value="local">Yerel</SelectItem></SelectContent></Select></Field>{draft.authProvider !== 'oidc' ? <Field label="Sağlayıcı kullanıcı kimliği"><Input aria-label="Sağlayıcı kullanıcı kimliği" value={draft.providerSubject} onChange={(e) => setDraft({ ...draft, providerSubject: e.target.value })} placeholder="Örn. user_..." /></Field> : null}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button disabled={draft.username.trim().length < 3 || !draft.email.includes('@') || pending} onClick={() => onSave({ username: draft.username, email: draft.email, authProvider: draft.authProvider, ...(draft.providerSubject.trim() ? { providerSubject: draft.providerSubject.trim() } : {}) })}><Plus aria-hidden="true" /> Oluştur</Button></DialogFooter></DialogContent></Dialog>
}

function RoleAssignmentDialog({ open, onOpenChange, roles, stores, user, onSave, pending, unavailable, unavailableByError }: { open: boolean; onOpenChange: (open: boolean) => void; roles: Array<{ roleCode: string; roleName: string; scopeType: string }>; stores: Array<{ storeId: string; storeName: string; companyId: string; regionId: string; regionName: string }>; user: UserAccount | null; onSave: (draft: { userId: string; roleCode: 'REGION_MANAGER' | 'STORE_MANAGER' | 'VISUAL_MERCHANDISER' | 'SUPER_ADMIN' | 'HR_ADMIN' | 'INTEGRATION_ADMIN' | 'SNAPSHOT_OPERATOR' | 'REPORT_VIEWER' | 'AUDITOR' | 'STORE_PERSONNEL'; scopeType: 'company' | 'region' | 'store'; incentiveApproval?: boolean; companyId?: string; regionId?: string; storeId?: string }) => void; pending: boolean; unavailable: boolean; unavailableByError: boolean }) {
  const [roleCode, setRoleCode] = useState('')
  const [incentiveApproval, setIncentiveApproval] = useState(false)
  const selectedRole = roles.find((role) => role.roleCode === roleCode)
  const scopeType = (roleCode === 'REGION_MANAGER' ? 'company' : selectedRole?.scopeType ?? 'company') as 'company' | 'region' | 'store'
  const [scopeId, setScopeId] = useState('')
  const regions = uniqueRegions(stores)
  const selectedStore = stores.find((store) => store.storeId === scopeId)
  const selectedRegion = regions.find((region) => region.regionId === scopeId)
  const companyId = selectedStore?.companyId ?? selectedRegion?.companyId ?? stores[0]?.companyId
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent closeLabel="Kapat"><DialogHeader><DialogTitle>Rol ekle</DialogTitle><DialogDescription>{roleCode === 'REGION_MANAGER' ? `${user?.username} Bölge Müdürü olarak tanımlanacak. Sorumlu mağazaları Mağaza erişimi bölümünden seçin.` : `${user?.username} için rol ve yetki alanı seçin.`}</DialogDescription></DialogHeader><div className="tw:grid tw:gap-3">{unavailable ? <AssignmentAvailabilityState kind="role" isError={unavailableByError} /> : null}<Field label="Rol"><Select value={roleCode} onValueChange={(value) => { setRoleCode(value); setScopeId(''); setIncentiveApproval(false) }}><SelectTrigger aria-label="Rol" className="tw:w-full"><SelectValue placeholder="Rol seçin" /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.roleCode} value={role.roleCode}>{roleDisplayName(role)}</SelectItem>)}</SelectContent></Select></Field>{scopeType === 'region' ? <Field label="Bölge"><Select value={scopeId} onValueChange={setScopeId}><SelectTrigger aria-label="Rol bölgesi" className="tw:w-full"><SelectValue placeholder="Bölge seçin" /></SelectTrigger><SelectContent>{regions.map((region) => <SelectItem key={region.regionId} value={region.regionId}>{region.regionName}</SelectItem>)}</SelectContent></Select></Field> : null}{scopeType === 'store' ? <Field label="Mağaza"><Select value={scopeId} onValueChange={setScopeId}><SelectTrigger aria-label="Rol mağazası" className="tw:w-full"><SelectValue placeholder="Mağaza seçin" /></SelectTrigger><SelectContent>{stores.map((store) => <SelectItem key={store.storeId} value={store.storeId}>{store.storeName}</SelectItem>)}</SelectContent></Select></Field> : null}{roleCode === 'REPORT_VIEWER' ? <IncentiveApprovalCheckbox checked={incentiveApproval} disabled={pending || unavailable} onChange={setIncentiveApproval} /> : null}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button disabled={!user || !roleCode || !companyId || (scopeType !== 'company' && !scopeId) || pending || unavailable} onClick={() => !unavailable && user && companyId && onSave({ userId: user.userId, roleCode: roleCode as Parameters<typeof onSave>[0]['roleCode'], scopeType, companyId, ...(roleCode === 'REPORT_VIEWER' ? { incentiveApproval } : {}), ...(scopeType === 'region' ? { regionId: scopeId } : {}), ...(scopeType === 'store' ? { storeId: scopeId } : {}) })}><ShieldCheck aria-hidden="true" /> Rolü ata</Button></DialogFooter></DialogContent></Dialog>
}

function StoreAssignmentDialog({ assignedStoreIds, open, onOpenChange, stores, user, onSave, pending, unavailable, unavailableByError }: { assignedStoreIds: string[]; open: boolean; onOpenChange: (open: boolean) => void; stores: Array<{ storeId: string; storeName: string; storeCode: string }>; user: UserAccount | null; onSave: (draft: { userId: string; storeIds: string[] }) => void; pending: boolean; unavailable: boolean; unavailableByError: boolean }) {
  const [query, setQuery] = useState('')
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([])
  const assigned = new Set(assignedStoreIds)
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
  const filteredStores = stores.filter((store) => !normalizedQuery || `${store.storeName} ${store.storeCode}`.toLocaleLowerCase('tr-TR').includes(normalizedQuery))
  const selectedStores = selectedStoreIds.map((storeId) => stores.find((store) => store.storeId === storeId)).filter((store): store is (typeof stores)[number] => Boolean(store))
  const toggleStore = (storeId: string) => setSelectedStoreIds((current) => current.includes(storeId) ? current.filter((id) => id !== storeId) : [...current, storeId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tw:gap-0 tw:overflow-hidden tw:p-0 tw:sm:max-w-2xl" closeLabel="Kapat">
        <DialogHeader className="tw:border-b tw:border-border tw:bg-muted/40 tw:px-5 tw:py-4 tw:pr-14">
          <DialogTitle>Mağaza erişimi ekle</DialogTitle>
          <DialogDescription>{user?.username} için bir veya birden fazla mağaza seçin.</DialogDescription>
        </DialogHeader>
        <div className="tw:grid tw:gap-4 tw:p-5">
          {unavailable ? <AssignmentAvailabilityState kind="store" isError={unavailableByError} /> : null}
          <div className="tw:relative"><Search className="tw:absolute tw:top-1/2 tw:left-3 tw:size-4 tw:-translate-y-1/2 tw:text-muted-foreground" aria-hidden="true" /><Input aria-label="Mağaza ara" className="tw:h-11 tw:pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Mağaza adı veya kodu" value={query} /></div>
          {selectedStores.length ? <div aria-label="Seçilen mağazalar" className="tw:flex tw:flex-wrap tw:gap-2">{selectedStores.map((store) => <button className="tw:flex tw:appearance-none tw:items-center tw:gap-1.5 tw:rounded-full tw:border-0 tw:bg-accent/35 tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-primary tw:shadow-none" key={store.storeId} onClick={() => toggleStore(store.storeId)} type="button">{store.storeName}<span aria-hidden="true">×</span></button>)}</div> : <p className="tw:m-0 tw:text-xs tw:text-muted-foreground">Henüz mağaza seçilmedi.</p>}
          <div aria-label="Mağaza seçim listesi" className="tw:max-h-72 tw:overflow-y-auto tw:rounded-2xl tw:border tw:border-border tw:bg-background tw:p-1.5">
            {filteredStores.length ? filteredStores.map((store) => {
              const selected = selectedStoreIds.includes(store.storeId)
              const alreadyAssigned = assigned.has(store.storeId)
              return <button aria-pressed={selected} className={`tw:flex tw:w-full tw:appearance-none tw:items-center tw:gap-3 tw:rounded-xl tw:border-0 tw:px-3 tw:py-2.5 tw:text-left tw:shadow-none tw:transition ${selected ? 'tw:bg-accent/25' : 'tw:bg-transparent tw:hover:bg-muted/40'}`} disabled={alreadyAssigned} key={store.storeId} onClick={() => toggleStore(store.storeId)} type="button"><span className={`tw:grid tw:size-5 tw:shrink-0 tw:place-items-center tw:rounded-md tw:border ${selected ? 'tw:border-primary tw:bg-primary tw:text-primary-foreground' : 'tw:border-border tw:bg-background tw:text-transparent'}`}><Check className="tw:size-3.5" aria-hidden="true" /></span><span className="tw:min-w-0 tw:flex-1"><span className="tw:block tw:truncate tw:text-sm tw:font-semibold">{store.storeName}</span><span className="tw:block tw:text-xs tw:text-muted-foreground">{store.storeCode}</span></span>{alreadyAssigned ? <span className="tw:text-[10px] tw:font-semibold tw:text-emerald-700">Zaten atanmış</span> : null}</button>
            }) : <p className="tw:m-0 tw:px-3 tw:py-8 tw:text-center tw:text-sm tw:text-muted-foreground">Aramayla eşleşen mağaza yok.</p>}
          </div>
        </div>
        <DialogFooter className="tw:border-t tw:border-border tw:bg-muted/40 tw:px-5 tw:py-4"><span className="tw:mr-auto tw:text-xs tw:font-semibold tw:text-muted-foreground">{selectedStoreIds.length} mağaza seçildi</span><Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button disabled={!user || selectedStoreIds.length === 0 || pending || unavailable} onClick={() => !unavailable && user && onSave({ userId: user.userId, storeIds: selectedStoreIds })}><Building2 aria-hidden="true" /> {pending ? 'Erişim veriliyor' : 'Seçilenlere erişim ver'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssignmentAvailabilityState({ kind, isError }: { kind: 'role' | 'store'; isError: boolean }) {
  const subject = kind === 'role' ? 'rol ve kapsam' : 'mağaza erişimi ve mağaza listesi'
  return <AdminStatePanel isLoading={!isError} title={isError ? `Güncel ${subject} alınamadı` : `Güncel ${subject} yenileniyor`} tone={isError ? 'danger' : 'warning'} description="Güncel bilgiler alınana kadar kaydetme devre dışı. Pencereyi kapatıp yeniden deneyin." />
}

function ConfirmDialog({ open, title, copy, confirmLabel, onOpenChange, onConfirm, pending }: { open: boolean; title: string; copy: string; confirmLabel: string; onOpenChange: (open: boolean) => void; onConfirm: () => void; pending: boolean }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent closeLabel="Kapat"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{copy}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button disabled={pending} onClick={onConfirm}>{pending ? 'Kaydediliyor' : confirmLabel}</Button></DialogFooter></DialogContent></Dialog>
}

function Field({ children, label }: { children: React.ReactNode; label: string }) { return <div><Label className="tw:mb-1.5">{label}</Label>{children}</div> }
const roleNames: Record<string, string> = {
  SUPER_ADMIN: 'Sistem yöneticisi',
  HR_ADMIN: 'İnsan kaynakları yöneticisi',
  INTEGRATION_ADMIN: 'Entegrasyon yöneticisi',
  REGION_MANAGER: 'Bölge müdürü',
  STORE_MANAGER: 'Mağaza müdürü',
  VISUAL_MERCHANDISER: 'Görsel düzenleme sorumlusu',
  STORE_PERSONNEL: 'Mağaza personeli',
  REPORT_VIEWER: 'Rapor görüntüleyici',
  AUDITOR: 'Denetçi',
  SNAPSHOT_OPERATOR: 'Raporlama operatörü',
  VM_REFERENCE_PUBLISHER: 'VM referans yayıncısı',
  VM_VISUAL_REVIEWER: 'VM görsel denetçisi',
  VM_CAMPAIGN_WINDOW_AUTHORITY: 'VM kampanya takvimi yöneticisi',
  VM_CAMPAIGN_SCOPE_AUTHORITY: 'VM kampanya kapsamı yöneticisi',
  VM_CAMPAIGN_EMERGENCY_AUTHORITY: 'VM kampanya acil durum yöneticisi',
}
const resourceNames: Record<string, string> = {
  auth: 'Kullanıcılar ve erişim',
  checklist: 'Checklistler',
  competition: 'Yarışmalar',
  employee: 'Personel',
  integration: 'Entegrasyonlar',
  kpi: 'KPI verileri',
  kpi_config: 'KPI ayarları',
  reports: 'Raporlar',
  snapshot: 'Raporlama kayıtları',
  store: 'Mağazalar',
  target_distribution: 'Hedef dağıtımı',
  vm_campaign: 'VM kampanyaları',
  vm_reference: 'VM referansları',
  vm_visual_coverage: 'VM görsel kapsamı',
}
const permissionDescriptions: Record<string, string> = {
  STORE_READ: 'Mağaza verilerini görüntüleyebilir.',
  STORE_WRITE: 'Mağaza verilerini düzenleyebilir.',
  'store.read': 'Mağaza verilerini görüntüleyebilir.',
  'employee.read': 'Personel kayıtlarını görüntüleyebilir.',
  'checklist.manage': 'Checklist oluşturabilir ve tamamlayabilir.',
  'kpi.read': 'KPI sonuçlarını görüntüleyebilir.',
  'snapshot.read': 'Hazırlanmış raporlama kayıtlarını görüntüleyebilir.',
  'reports.read': 'Rapor ekranlarını görüntüleyebilir.',
  'integration.manage': 'Entegrasyon kaynaklarını ve veri aktarımlarını yönetebilir.',
  'snapshot.manage': 'Raporlama kayıtlarını oluşturabilir ve yeniden çalıştırabilir.',
  'target_distribution.manage': 'Hedef dağıtım talepleri oluşturabilir.',
  'target_distribution.approve': 'Hedef dağıtım taleplerini onaylayabilir.',
  'kpi_config.manage': 'KPI puanlama ayarlarını değiştirebilir.',
  'auth.manage': 'Kullanıcıları, rolleri ve yetkileri yönetebilir.',
  'competition.read': 'Yarışma sıralamalarını ve sonuçlarını görüntüleyebilir.',
  'competition.manage': 'Yarışma oluşturabilir, hesaplayabilir ve sonuçlandırabilir.',
  VM_REFERENCE_PUBLISHER: 'Şirket kapsamındaki VM referanslarını hazırlayıp yayınlayabilir.',
  VM_VISUAL_REVIEWER: 'VM kampanyalarının görsel uygulama durumunu inceleyebilir.',
  VM_CAMPAIGN_WINDOW_AUTHORITY: 'VM kampanya tarihlerini uzatabilir veya yeniden açabilir.',
  VM_CAMPAIGN_SCOPE_AUTHORITY: 'VM kampanya mağazalarını ekleyebilir, çıkarabilir veya muaf tutabilir.',
  VM_CAMPAIGN_EMERGENCY_AUTHORITY: 'VM kampanyasını beklemeye alabilir veya acil olarak sonlandırabilir.',
}
function roleDisplayName(role: { roleCode?: string; roleName?: string }) { return (role.roleCode && roleNames[role.roleCode]) || role.roleName || role.roleCode || 'Rol' }
function resourceDisplayName(resource: string) { return resourceNames[resource] ?? resource.replaceAll('_', ' ') }
function permissionActionName(action: string) {
  const names: Record<string, string> = { approve: 'Onaylama', emergency_retire: 'Acil sonlandırma', manage: 'Yönetme', publish: 'Yayınlama', read: 'Görüntüleme', revise_scope: 'Kapsam değiştirme', revise_window: 'Takvim değiştirme', write: 'Düzenleme' }
  return names[action] ?? action.replaceAll('_', ' ')
}
function permissionDescription(permission: { permissionCode: string; resourceName: string; actionName: string }) { return permissionDescriptions[permission.permissionCode] ?? `${resourceDisplayName(permission.resourceName)} alanında ${permissionActionName(permission.actionName).toLocaleLowerCase('tr-TR')} yetkisi verir.` }
function initials(value: string) { return value.split(/[._\-\s]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U' }
function scopeLabel(assignment: { roleCode?: string; scopeType: string; companyId: string | null; regionId: string | null; storeId: string | null }) { return assignment.roleCode === 'REGION_MANAGER' ? 'Sorumlu mağazalar Mağaza erişimi bölümünden yönetilir' : assignment.scopeType === 'store' ? 'Mağaza kapsamı' : assignment.scopeType === 'region' ? 'Bölge kapsamı' : 'Şirket kapsamı' }
function uniqueRegions(stores: Array<{ regionId: string; regionName: string; companyId: string }>) { return Array.from(new Map(stores.map((store) => [store.regionId, { regionId: store.regionId, regionName: store.regionName, companyId: store.companyId }])).values()) }
