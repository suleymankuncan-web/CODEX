import type { ReactNode } from 'react'
import {
  Building2,
  ChevronDown,
  FileClock,
  Mail,
  RotateCcw,
  Save,
  ShieldCheck,
  Store,
  UserPlus,
} from 'lucide-react'
import { AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion'
import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import type { AuthLookupStore, CreateRoleAssignmentInput } from './api'
import type { AuthWorkbenchAuditRow } from './auth-access-workbench-model'
import type { AuthAccessWorkbenchViewProps } from './AuthAccessWorkbenchView'

const scopeLabels: Record<CreateRoleAssignmentInput['scopeType'], string> = {
  company: 'Şirket',
  region: 'Bölge',
  store: 'Mağaza',
}

function AccountTray(props: AuthAccessWorkbenchViewProps) {
  const selectedUser = props.selectedUser

  return (
    <AccordionItem className="auth-tray" value="account">
      <AccordionTrigger className="auth-tray-head">
        <TrayTitle icon={<UserPlus size={16} />} label="Üyelik" meta="Yeni veya mevcut kişi" />
      </AccordionTrigger>
      <AccordionContent className="auth-tray-body">
        <section className="auth-account-section">
          <SectionTitle meta={props.canSaveProfile ? 'Taslak var' : 'Temiz'} title="Hesap bilgileri" />
          <div className="auth-form-grid">
            <label>
              Ad soyad
              <Input
                disabled={!selectedUser}
                onChange={(event) => props.onProfileDraftChange({ username: event.target.value })}
                placeholder="Kullanıcı adı"
                value={props.profileDraft.username}
              />
            </label>
            <label>
              E-posta
              <Input
                disabled={!selectedUser}
                onChange={(event) => props.onProfileDraftChange({ email: event.target.value })}
                placeholder="isim@lufian.com.tr"
                value={props.profileDraft.email}
              />
            </label>
            <label>
              Personel
              <Input
                disabled={!selectedUser}
                onChange={(event) => props.onProfileDraftChange({ employeeId: event.target.value })}
                placeholder="Personel kodu"
                value={props.profileDraft.employeeId}
              />
            </label>
          </div>
          <Button disabled={!props.canSaveProfile || props.pending.profile} onClick={props.onSaveProfile}>
            <Save size={16} />
            {props.pending.profile ? 'Kaydediliyor' : 'Bilgileri kaydet'}
          </Button>
        </section>

        <section className="auth-account-section">
          <SectionTitle meta="Saha dışı roller için" title="Yönetim hesabı" />
          <p className="auth-account-section__hint">
            Report Viewer ve yönetim rolleri için hesabı oluşturun; rol ve kapsamı ardından mevcut panellerden atayın.
          </p>
          <div className="auth-form-grid">
            <label>
              Kullanıcı adı
              <Input
                onChange={(event) => props.onNewAccountDraftChange({ username: event.target.value })}
                placeholder="ad.soyad"
                value={props.newAccountDraft.username}
              />
            </label>
            <label>
              E-posta
              <Input
                onChange={(event) => props.onNewAccountDraftChange({ email: event.target.value })}
                placeholder="isim@lufian.com.tr"
                value={props.newAccountDraft.email}
              />
            </label>
            <label>
              Personel
              <Input
                onChange={(event) => props.onNewAccountDraftChange({ employeeId: event.target.value })}
                placeholder="Opsiyonel personel kimliği"
                value={props.newAccountDraft.employeeId}
              />
            </label>
            <label>
              Giriş yöntemi
              <Select
                onValueChange={(value) => props.onNewAccountDraftChange({ authProvider: value })}
                value={props.newAccountDraft.authProvider}
              >
                <SelectTrigger><SelectValue placeholder="Giriş yöntemi seç" /></SelectTrigger>
                <SelectContent>
                  {props.providerOptions.map((provider) => (
                    <SelectItem key={provider} value={provider}>{providerLabel(provider)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <Button disabled={props.pending.newUser} onClick={props.onCreateUser}>
            <Mail size={16} />
            {props.pending.newUser ? 'Oluşturuluyor' : 'Hesap oluştur'}
          </Button>
        </section>

        <section className="auth-danger-box">
          <SectionTitle meta="Geçmiş korunur" title="Hesabı kapat / aç" />
          <label>
            Kapatma nedeni
            <Textarea
              disabled={!selectedUser || !props.statusDraft.isActive}
              onChange={(event) => props.onStatusDraftChange({ reason: event.target.value })}
              placeholder="İşten ayrıldı, görev değişti..."
              value={props.statusDraft.reason}
            />
          </label>
          {selectedUser?.status === 'active' ? (
            <DeactivateDialog
              disabled={!selectedUser || props.pending.userStatus}
              onConfirm={props.onDeactivateUser}
            />
          ) : (
            <Button disabled={!selectedUser || props.pending.reactivateUser} onClick={props.onReactivateUser}>
              <RotateCcw size={16} />
              {props.pending.reactivateUser ? 'Açılıyor' : 'Hesabı aktifleştir'}
            </Button>
          )}
        </section>
      </AccordionContent>
    </AccordionItem>
  )
}

function RoleTray(props: AuthAccessWorkbenchViewProps) {
  return (
    <AccordionItem className="auth-tray" value="role">
      <AccordionTrigger className="auth-tray-head">
        <TrayTitle icon={<ShieldCheck size={16} />} label="Rol ata" meta={selectedRoleLabel(props)} />
      </AccordionTrigger>
      <AccordionContent className="auth-tray-body">
        <div className="auth-form-grid">
          <label>
            Rol
            <Select
              onValueChange={(roleCode) => props.onRoleDraftChange({ roleCode })}
              value={props.roleDraft.roleCode}
            >
              <SelectTrigger>
                <SelectValue placeholder="Rol seç" />
              </SelectTrigger>
              <SelectContent>
                {props.lookups.roles.map((role) => (
                  <SelectItem key={role.roleCode} value={role.roleCode}>
                    {role.roleName ?? role.roleCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            Kapsam
            <Select
              onValueChange={(scopeType) =>
                props.onRoleDraftChange({ scopeType: scopeType as CreateRoleAssignmentInput['scopeType'] })
              }
              value={props.roleDraft.scopeType}
            >
              <SelectTrigger>
                <SelectValue placeholder="Kapsam seç" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(scopeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            Şirket
            <Input
              onChange={(event) => props.onRoleDraftChange({ companyId: event.target.value })}
              placeholder="Şirket referansı"
              value={props.roleDraft.companyId}
            />
          </label>
          {props.roleDraft.scopeType === 'region' ? (
            <label>
              Bölge
              <Select
                onValueChange={(regionId) => props.onRoleDraftChange({ regionId })}
                value={props.roleDraft.regionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Bölge seç" />
                </SelectTrigger>
                <SelectContent>
                  {props.regionOptions.map((region) => (
                    <SelectItem key={region.regionId} value={region.regionId}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : null}
          {props.roleDraft.scopeType === 'store' ? (
            <label>
              Mağaza
              <StoreSelect
                stores={props.availableStores}
                value={props.roleDraft.storeId}
                onValueChange={(storeId) => props.onRoleDraftChange({ storeId })}
              />
            </label>
          ) : null}
        </div>
        <Button disabled={!props.selectedUser || props.pending.role} onClick={props.onCreateRole}>
          <ShieldCheck size={16} />
          {props.pending.role ? 'Kaydediliyor' : 'Rolü kaydet'}
        </Button>
      </AccordionContent>
    </AccordionItem>
  )
}

function StoreTray(props: AuthAccessWorkbenchViewProps) {
  return (
    <AccordionItem className="auth-tray" value="store">
      <AccordionTrigger className="auth-tray-head">
        <TrayTitle
          icon={<Store size={16} />}
          label="Mağaza bağla"
          meta={props.actionStoreDraft.storeId ? 'Mağaza seçildi' : 'Seçim bekliyor'}
        />
      </AccordionTrigger>
      <AccordionContent className="auth-tray-body">
        <div className="auth-form-grid">
          <label>
            Mağaza
            <StoreSelect
              stores={props.availableStores}
              value={props.actionStoreDraft.storeId}
              onValueChange={(storeId) => props.onActionStoreDraftChange({ storeId })}
            />
          </label>
          <label>
            Başlangıç
            <Input
              onChange={(event) => props.onActionStoreDraftChange({ effectiveFrom: event.target.value })}
              placeholder="2026-06-30"
              type="date"
              value={props.actionStoreDraft.effectiveFrom}
            />
          </label>
          <label>
            Bitiş
            <Input
              onChange={(event) => props.onActionStoreDraftChange({ effectiveTo: event.target.value })}
              placeholder="Opsiyonel"
              type="date"
              value={props.actionStoreDraft.effectiveTo}
            />
          </label>
        </div>
        <Button disabled={!props.selectedUser || props.pending.actionStore} onClick={props.onCreateActionStore}>
          <Building2 size={16} />
          {props.pending.actionStore ? 'Kaydediliyor' : 'Mağazayı kaydet'}
        </Button>
      </AccordionContent>
    </AccordionItem>
  )
}

function AuditTray({
  audit,
  onOpen,
}: {
  audit: AuthWorkbenchAuditRow[]
  onOpen: () => void
}) {
  return (
    <AccordionItem className="auth-tray" value="audit">
      <AccordionTrigger className="auth-tray-head">
        <TrayTitle icon={<FileClock size={16} />} label="Kontrol izi" meta={`${audit.length} kayıt`} />
      </AccordionTrigger>
      <AccordionContent className="auth-tray-body">
        <div className="auth-mini-timeline">
          {audit.slice(0, 4).map((item) => (
            <span key={item.eventLogId}>{item.label}</span>
          ))}
          {!audit.length ? <span>Henüz işlem kaydı yok.</span> : null}
        </div>
        <Button type="button" variant="outline" onClick={onOpen}>
          <FileClock size={16} />
          Geçmişi aç
        </Button>
      </AccordionContent>
    </AccordionItem>
  )
}

function StoreSelect({
  onValueChange,
  stores,
  value,
}: {
  onValueChange: (storeId: string) => void
  stores: AuthLookupStore[]
  value: string
}) {
  return (
    <Select onValueChange={onValueChange} value={value}>
      <SelectTrigger>
        <SelectValue placeholder="Mağaza seç" />
      </SelectTrigger>
      <SelectContent>
        {stores.map((store) => (
          <SelectItem key={store.storeId} value={store.storeId}>
            {store.storeName ?? store.storeCode}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ChangeSummary({
  canSaveProfile,
  canSaveStatus,
  onOpenAccount,
  onSaveProfile,
  pending,
}: {
  canSaveProfile: boolean
  canSaveStatus: boolean
  onOpenAccount: () => void
  onSaveProfile: () => void
  pending: boolean
}) {
  const changeCount = Number(canSaveProfile) + Number(canSaveStatus)
  return (
    <section className="auth-change-summary" aria-label="Değişiklik özeti">
      <SectionTitle meta={changeCount ? `${changeCount} taslak` : 'Temiz'} title="Değişiklik özeti" />
      {changeCount ? (
        <ul>
          {canSaveProfile ? <li>Hesap bilgilerinde taslak değişiklik var.</li> : null}
          {canSaveStatus ? <li>Üyelik durumu için işlem bekliyor.</li> : null}
        </ul>
      ) : (
        <p>Seçili kullanıcıda bekleyen değişiklik yok.</p>
      )}
      <div className="auth-action-row">
        <Button disabled={!canSaveProfile || pending} onClick={onSaveProfile} size="sm">
          <Save size={15} />
          {pending ? 'Kaydediliyor' : 'Bilgileri uygula'}
        </Button>
        <Button onClick={onOpenAccount} size="sm" variant="outline">
          Üyelik
        </Button>
      </div>
    </section>
  )
}

function DeactivateDialog({
  disabled,
  onConfirm,
}: {
  disabled: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={disabled} type="button" variant="destructive">
          Erişimi kapat ve pasife al
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hesap pasife alınsın mı?</DialogTitle>
          <DialogDescription>
            Rol ve mağaza erişimi kapanır; geçmiş kayıtlar korunur.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Vazgeç
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Hesabı kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TrayTitle({
  icon,
  label,
  meta,
}: {
  icon: ReactNode
  label: string
  meta: string
}) {
  return (
    <>
      <span className="auth-tray-icon">{icon}</span>
      <span>
        <strong>{label}</strong>
        <small>{meta}</small>
      </span>
      <ChevronDown size={16} />
    </>
  )
}

function SectionTitle({ meta, title }: { meta: ReactNode; title: ReactNode }) {
  return (
    <div className="auth-section-title">
      <strong>{title}</strong>
      <span>{meta}</span>
    </div>
  )
}

function providerLabel(provider: string) {
  const normalized = provider.trim().toLowerCase()
  if (normalized === 'clerk') return 'Clerk'
  if (normalized === 'oidc') return 'OIDC'
  if (normalized === 'sso') return 'SSO'
  if (normalized === 'local') return 'Yerel'
  return provider
}

function selectedRoleLabel(props: AuthAccessWorkbenchViewProps) {
  const role = props.lookups.roles.find((item) => item.roleCode === props.roleDraft.roleCode)
  return role?.roleName ?? role?.roleCode ?? 'Rol seç'
}

export { AccountTray, AuditTray, ChangeSummary, RoleTray, StoreTray }
