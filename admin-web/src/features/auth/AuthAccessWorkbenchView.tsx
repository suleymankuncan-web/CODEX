import type { ReactNode } from 'react'
import {
  Clock3,
  FileClock,
  KeyRound,
  Search,
  ShieldCheck,
  Store,
  UserCog,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { Accordion } from '../../components/ui/accordion'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { ScrollArea } from '../../components/ui/scroll-area'
import { cn } from '../../lib/utils'
import { AccountTray, AuditTray, ChangeSummary, RoleTray, StoreTray } from './AuthAccessWorkbenchTrays'
import { AuthMembershipDialog } from './AuthMembershipDialog'
import type {
  AuthLookupStore,
  AuthLookups,
  CreatePilotUserBindingInput,
  CreateRoleAssignmentInput,
} from './api'
import type {
  AuthAccessWorkbenchModel,
  AuthWorkbenchAuditRow,
  AuthWorkbenchStoreRow,
  AuthWorkbenchTone,
  AuthWorkbenchUserDetail,
  AuthWorkbenchUserRow,
  UserProfileDraft,
  UserStatusDraft,
} from './auth-access-workbench-model'

export type AuthWorkbenchKindFilter = 'all' | 'admin' | 'region' | 'store'
export type AuthWorkbenchStatusFilter = 'all' | 'active' | 'inactive'
export type AuthWorkbenchDetailTab = 'overview' | 'roles' | 'stores' | 'audit'
export type AuthWorkbenchTray = 'account' | 'role' | 'store' | 'audit'
export type NewAuthAccountDraft = {
  authProvider: string
  email: string
  employeeId: string
  username: string
}
export type AuthRoleDraft = {
  companyId: string
  effectiveFrom: string
  effectiveTo: string
  regionId: string
  roleCode: string
  scopeType: CreateRoleAssignmentInput['scopeType']
  storeId: string
}
export type AuthActionStoreDraft = {
  effectiveFrom: string
  effectiveTo: string
  storeId: string
}

type RegionOption = {
  regionId: string
  label: string
}

type MutationPendingState = {
  actionStore: boolean
  deactivateActionStore: boolean
  deactivateRole: boolean
  newUser: boolean
  profile: boolean
  reactivateUser: boolean
  role: boolean
  userStatus: boolean
}

export type AuthAccessWorkbenchViewProps = {
  actionStoreDraft: AuthActionStoreDraft
  activeTab: AuthWorkbenchDetailTab
  availableStores: AuthLookupStore[]
  canSaveProfile: boolean
  canSaveStatus: boolean
  feedback: string | null
  filter: AuthWorkbenchKindFilter
  lookups: AuthLookups
  membershipDialogOpen: boolean
  membershipError: string | null
  model: AuthAccessWorkbenchModel
  mutationBusy: boolean
  newAccountDraft: NewAuthAccountDraft
  onActionStoreDraftChange: (patch: Partial<AuthActionStoreDraft>) => void
  onCreateActionStore: () => void
  onCreateRole: () => void
  onCreateUser: () => void
  onCreateMembership: (input: CreatePilotUserBindingInput) => void
  onDeactivateActionStore: (assignmentId: string) => void
  onDeactivateRole: (assignmentId: string) => void
  onDeactivateUser: () => void
  onMembershipDialogOpenChange: (open: boolean) => void
  onNewAccountDraftChange: (patch: Partial<NewAuthAccountDraft>) => void
  onOpenTrayChange: (tray: AuthWorkbenchTray) => void
  onProfileDraftChange: (patch: Partial<UserProfileDraft>) => void
  onQueryChange: (value: string) => void
  onReactivateUser: () => void
  onRoleDraftChange: (patch: Partial<AuthRoleDraft>) => void
  onSaveProfile: () => void
  onSelectUser: (userId: string) => void
  onStatusDraftChange: (patch: Partial<UserStatusDraft>) => void
  onStatusFilterChange: (filter: AuthWorkbenchStatusFilter) => void
  onTabChange: (tab: AuthWorkbenchDetailTab) => void
  onUserFilterChange: (filter: AuthWorkbenchKindFilter) => void
  openTray: AuthWorkbenchTray
  pending: MutationPendingState
  profileDraft: UserProfileDraft
  providerOptions: string[]
  query: string
  regionOptions: RegionOption[]
  roleDraft: AuthRoleDraft
  selectedUser: AuthWorkbenchUserDetail | null
  statusDraft: UserStatusDraft
  statusFilter: AuthWorkbenchStatusFilter
  users: AuthWorkbenchUserRow[]
}

const userFilterOptions: Array<{ label: string; value: AuthWorkbenchKindFilter }> = [
  { label: 'Tümü', value: 'all' },
  { label: 'Admin', value: 'admin' },
  { label: 'Bölge', value: 'region' },
  { label: 'Mağaza', value: 'store' },
]

const statusFilterOptions: Array<{ label: string; value: AuthWorkbenchStatusFilter }> = [
  { label: 'Tümü', value: 'all' },
  { label: 'Aktif', value: 'active' },
  { label: 'Pasif', value: 'inactive' },
]

const tabs: Array<{ label: string; value: AuthWorkbenchDetailTab }> = [
  { label: 'Özet', value: 'overview' },
  { label: 'Roller', value: 'roles' },
  { label: 'Mağazalar', value: 'stores' },
  { label: 'Geçmiş', value: 'audit' },
]

export function AuthAccessWorkbenchView(props: AuthAccessWorkbenchViewProps) {
  const selectedUser = props.selectedUser

  return (
    <main className="admin-auth-workbench" aria-label="Erişim yönetimi">
      <section className="auth-workbench-shell">
        <header className="auth-workbench-header">
          <div className="auth-workbench-titleblock">
            <span className="auth-workbench-pill">
              <KeyRound size={15} />
              Erişim
            </span>
            <h1>Erişim Yönetimi</h1>
            <p>Kullanıcı, rol ve mağaza yetkilerini tek çalışma masasında düzenle.</p>
          </div>

          <div className="auth-workbench-actions" aria-label="Hızlı işlemler">
            <Button size="sm" variant="outline" asChild>
              <a href="/admin/audit">
                <FileClock size={16} />
                Son işlemler
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={() => props.onOpenTrayChange('account')}>
              Yönetim hesabı
            </Button>
            <Button size="sm" onClick={() => props.onMembershipDialogOpenChange(true)}>
              <UserPlus size={16} />
              Personel üyeliği oluştur
            </Button>
          </div>
        </header>

        <div className="auth-metric-strip" aria-label="Erişim özeti">
          <MetricCard
            icon={<UsersRound size={18} />}
            label="Üyelik"
            note={`${props.model.metrics.activeUsers} aktif`}
            tone="cyan"
            value={props.model.metrics.totalUsers}
          />
          <MetricCard
            icon={<ShieldCheck size={18} />}
            label="Rol ataması"
            note="Admin, bölge ve mağaza"
            tone="plum"
            value={props.model.metrics.activeRoleAssignments}
          />
          <MetricCard
            icon={<Store size={18} />}
            label="Mağaza erişimi"
            note="Aksiyon ve okuma"
            tone="mint"
            value={props.model.metrics.activeStoreAssignments}
          />
          <MetricCard
            icon={<Clock3 size={18} />}
            label="Kontrol bekleyen"
            note="Pasif veya eşleşmesi eksik"
            tone="amber"
            value={props.model.metrics.inactiveUsers}
          />
        </div>

        {props.feedback ? <Notice tone="mint">{props.feedback}</Notice> : null}

        <div className="auth-workbench-toolbar">
          <label className="auth-search-field">
            <Search size={17} />
            <Input
              aria-label="Kullanıcı ara"
              onChange={(event) => props.onQueryChange(event.target.value)}
              placeholder="Kullanıcı, e-posta veya personel ara"
              value={props.query}
            />
          </label>
          <SegmentedControl
            label="Kullanıcı filtresi"
            onChange={props.onUserFilterChange}
            options={userFilterOptions}
            value={props.filter}
          />
          <SegmentedControl
            compact
            label="Durum filtresi"
            onChange={props.onStatusFilterChange}
            options={statusFilterOptions}
            value={props.statusFilter}
          />
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => props.onOpenTrayChange('role')}
          >
            <ShieldCheck size={16} />
            Rol ata
          </Button>
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => props.onOpenTrayChange('store')}
          >
            <Store size={16} />
            Mağaza bağla
          </Button>
        </div>

        <section className="auth-workbench-grid">
          <aside className="auth-panel auth-user-list" aria-label="Kullanıcı listesi">
            <PanelHead title={`${props.users.length} kayıt`} eyebrow="Kişiler">
              <UserCog size={17} />
            </PanelHead>
            <ScrollArea className="auth-user-scroll">
              {props.users.length ? (
                props.users.map((user) => (
                  <button
                    className={cn('auth-user-row', selectedUser?.userId === user.userId && 'selected')}
                    key={user.userId}
                    onClick={() => props.onSelectUser(user.userId)}
                    type="button"
                  >
                    <span className={`auth-avatar tone-${user.tone}`}>{initialOf(user.displayName)}</span>
                    <span className="auth-user-copy">
                      <strong>{user.displayName}</strong>
                      <small>{user.providerLabel}</small>
                      <em>{user.email}</em>
                      <span className="auth-user-meta">
                        {user.storeCount ? `${user.storeCount} mağaza` : 'Mağaza yok'} · {formatActivity(user.lastActivityLabel)}
                      </span>
                    </span>
                    <StatusBadge tone={user.tone}>{user.statusLabel}</StatusBadge>
                  </button>
                ))
              ) : (
                <div className="auth-empty-state">Bu filtreyle kullanıcı bulunamadı.</div>
              )}
            </ScrollArea>
          </aside>

          <section className="auth-panel auth-detail-panel" aria-label="Seçili kullanıcı">
            {selectedUser ? (
              <>
                <div className="auth-profile-head">
                  <div className="auth-profile-main">
                    <span className={`auth-avatar auth-avatar-large tone-${selectedUser.tone}`}>
                      {initialOf(selectedUser.displayName)}
                    </span>
                    <div>
                      <span className="auth-kicker">Seçili kullanıcı</span>
                      <h2>{selectedUser.displayName}</h2>
                      <p>{selectedUser.email}</p>
                    </div>
                  </div>
                  <StatusBadge tone={selectedUser.tone}>{selectedUser.statusLabel}</StatusBadge>
                </div>

                <div className="auth-profile-facts">
                  <Fact label="Kimlik" value={selectedUser.providerLabel} />
                  <Fact label="Personel" value={selectedUser.employeeLabel} />
                  <Fact label="Son hareket" value={formatActivity(selectedUser.lastActivityLabel)} />
                  <Fact label="Mağaza" value={String(selectedUser.storeCount)} />
                </div>

                <div className="auth-tabs" aria-label="Kullanıcı detayı">
                  {tabs.map((tab) => (
                    <button
                      className={props.activeTab === tab.value ? 'active' : ''}
                      key={tab.value}
                      onClick={() => props.onTabChange(tab.value)}
                      type="button"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <ScrollArea className="auth-tab-body">
                  <DetailTabBody
                    activeTab={props.activeTab}
                    mutationBusy={props.mutationBusy}
                    onDeactivateActionStore={props.onDeactivateActionStore}
                    onDeactivateRole={props.onDeactivateRole}
                    selectedUser={selectedUser}
                  />
                </ScrollArea>
              </>
            ) : (
              <div className="auth-empty-state">Kullanıcı kaydı bekleniyor.</div>
            )}
          </section>

          <aside className="auth-panel auth-action-panel" aria-label="İşlem paneli">
            <PanelHead
              eyebrow="İşlem paneli"
              title={selectedUser?.displayName ?? 'Kullanıcı seç'}
              badge={selectedUser?.statusLabel}
            />
            <ChangeSummary
              canSaveProfile={props.canSaveProfile}
              canSaveStatus={props.canSaveStatus}
              onSaveProfile={props.onSaveProfile}
              onOpenAccount={() => props.onOpenTrayChange('account')}
              pending={props.pending.profile}
            />
            <Accordion
              className="auth-tray-stack"
              collapsible
              onValueChange={(value) => value && props.onOpenTrayChange(value as AuthWorkbenchTray)}
              type="single"
              value={props.openTray}
            >
              <AccountTray {...props} />
              <RoleTray {...props} />
              <StoreTray {...props} />
              <AuditTray audit={selectedUser?.audit ?? []} onOpen={() => props.onTabChange('audit')} />
            </Accordion>
          </aside>
        </section>
      </section>
      {props.membershipDialogOpen ? (
        <AuthMembershipDialog
          availableStores={props.availableStores}
          errorMessage={props.membershipError}
          onOpenChange={props.onMembershipDialogOpenChange}
          onSubmit={props.onCreateMembership}
          open
          pending={props.pending.newUser}
        />
      ) : null}
    </main>
  )
}

function MetricCard({
  icon,
  label,
  note,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  note: string
  tone: AuthWorkbenchTone
  value: ReactNode
}) {
  return (
    <article className={`auth-metric-card tone-${tone}`}>
      <span className="auth-metric-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  )
}

function SegmentedControl<T extends string>({
  compact,
  label,
  onChange,
  options,
  value,
}: {
  compact?: boolean
  label: string
  onChange: (value: T) => void
  options: Array<{ label: string; value: T }>
  value: T
}) {
  return (
    <div className={cn('auth-filter-group', compact && 'compact-filter')} aria-label={label}>
      {options.map((option) => (
        <button
          className={value === option.value ? 'active' : ''}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function PanelHead({
  badge,
  children,
  eyebrow,
  title,
}: {
  badge?: ReactNode
  children?: ReactNode
  eyebrow: string
  title: ReactNode
}) {
  return (
    <div className="auth-panel-head">
      <div>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      {badge ? <span className="auth-mini-count">{badge}</span> : children ? <span className="auth-icon-button">{children}</span> : null}
    </div>
  )
}

function DetailTabBody({
  activeTab,
  mutationBusy,
  onDeactivateActionStore,
  onDeactivateRole,
  selectedUser,
}: {
  activeTab: AuthWorkbenchDetailTab
  mutationBusy: boolean
  onDeactivateActionStore: (assignmentId: string) => void
  onDeactivateRole: (assignmentId: string) => void
  selectedUser: AuthWorkbenchUserDetail
}) {
  if (activeTab === 'overview') {
    return (
      <div className="auth-summary-grid">
        <SummaryTile title="Rol durumu" value={`${selectedUser.roles.length} aktif rol`} tone="plum" />
        <SummaryTile title="Mağaza erişimi" value={`${selectedUser.stores.length} mağaza`} tone="cyan" />
        <SummaryTile title="Üyelik" value={selectedUser.statusLabel} tone={selectedUser.tone} />
        <SummaryTile title="Son kontrol" value={selectedUser.audit[0]?.label ?? 'Kayıt yok'} tone="slate" />
      </div>
    )
  }

  if (activeTab === 'roles') {
    return selectedUser.roles.length ? (
      <div className="auth-compact-list">
        {selectedUser.roles.map((role) => (
          <article className={`auth-access-row tone-${role.tone}`} key={role.assignmentId}>
            <span className="auth-row-icon">
              <ShieldCheck size={16} />
            </span>
            <div>
              <strong>{role.label}</strong>
              <small>{role.scopeLabel}</small>
              <p>{role.effectiveLabel}</p>
            </div>
            <Button
              disabled={!role.active || mutationBusy}
              onClick={() => onDeactivateRole(role.assignmentId)}
              size="sm"
              type="button"
              variant="outline"
            >
              Kapat
            </Button>
          </article>
        ))}
      </div>
    ) : (
      <div className="auth-empty-state">Aktif rol ataması yok.</div>
    )
  }

  if (activeTab === 'stores') {
    return selectedUser.stores.length ? (
      <div className="auth-store-grid">
        {selectedUser.stores.map((store) => (
          <StoreCard
            key={store.assignmentId}
            mutationBusy={mutationBusy}
            onDeactivateActionStore={onDeactivateActionStore}
            store={store}
          />
        ))}
      </div>
    ) : (
      <div className="auth-empty-state">Bu kullanıcıya bağlı mağaza yok.</div>
    )
  }

  return selectedUser.audit.length ? (
    <AuditTimeline events={selectedUser.audit} />
  ) : (
    <div className="auth-empty-state">Denetim kaydı yok.</div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="auth-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SummaryTile({ title, value, tone }: { title: string; value: string; tone: AuthWorkbenchTone }) {
  return (
    <article className={`auth-summary-tile tone-${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  )
}

function StoreCard({
  mutationBusy,
  onDeactivateActionStore,
  store,
}: {
  mutationBusy: boolean
  onDeactivateActionStore: (assignmentId: string) => void
  store: AuthWorkbenchStoreRow
}) {
  return (
    <article className="auth-store-card">
      <div>
        <strong>{store.label}</strong>
        <small>{store.regionLabel}</small>
      </div>
      <span>{store.effectiveLabel}</span>
      <Button
        disabled={!store.active || mutationBusy}
        onClick={() => onDeactivateActionStore(store.assignmentId)}
        size="sm"
        type="button"
        variant="outline"
      >
        Kapat
      </Button>
    </article>
  )
}

function AuditTimeline({ events }: { events: AuthWorkbenchAuditRow[] }) {
  return (
    <div className="auth-timeline">
      {events.map((item, index) => (
        <div className="auth-timeline-row" key={item.eventLogId}>
          <span>{index + 1}</span>
          <p>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </p>
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ children, tone }: { children: ReactNode; tone: AuthWorkbenchTone }) {
  return <Badge className={`auth-status tone-${tone}`}>{children}</Badge>
}

function Notice({ children, tone }: { children: ReactNode; tone: AuthWorkbenchTone }) {
  return <div className={`auth-notice tone-${tone}`}>{children}</div>
}

function initialOf(label: string) {
  return label.trim().slice(0, 1).toLocaleUpperCase('tr-TR') || 'K'
}

function formatActivity(input: string) {
  const parsed = Date.parse(input)
  if (!Number.isFinite(parsed)) return input

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(parsed))
}
