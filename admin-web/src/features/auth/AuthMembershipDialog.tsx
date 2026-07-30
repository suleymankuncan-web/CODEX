import { useMemo, useState, type ComponentProps, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ShieldCheck, Store, UserRound } from 'lucide-react'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { ScrollArea } from '../../components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import {
  searchAuthEligiblePersonnel,
  searchAuthStores,
  type AuthLookupStore,
  type CreatePilotUserBindingInput,
} from './api'
import {
  buildMembershipBindingInput,
  createMembershipDraft,
  validateMembershipDraft,
  type MembershipDraft,
  type MembershipEmployee,
  type MembershipRole,
} from './auth-membership-dialog-model'

const membershipRoles: Array<{ label: string; value: MembershipRole }> = [
  { label: 'Mağaza Müdürü', value: 'STORE_MANAGER' },
  { label: 'Bölge Müdürü', value: 'REGION_MANAGER' },
  { label: 'Görsel Düzenleme', value: 'VISUAL_MERCHANDISER' },
]

type AuthMembershipDialogProps = {
  availableStores: AuthLookupStore[]
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CreatePilotUserBindingInput) => void
  open: boolean
  pending: boolean
}

export function AuthMembershipDialog({
  availableStores,
  errorMessage,
  onOpenChange,
  onSubmit,
  open,
  pending,
}: AuthMembershipDialogProps) {
  const [draft, setDraft] = useState<MembershipDraft>(createMembershipDraft)
  const [personnelQuery, setPersonnelQuery] = useState('')
  const [storeQuery, setStoreQuery] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const normalizedPersonnelQuery = personnelQuery.trim()
  const normalizedStoreQuery = storeQuery.trim()

  const personnel = useQuery({
    queryKey: ['auth-membership', 'personnel', normalizedPersonnelQuery],
    queryFn: () => searchAuthEligiblePersonnel({ query: normalizedPersonnelQuery, limit: 20 }),
    enabled: open && normalizedPersonnelQuery.length >= 2,
  })
  const stores = useQuery({
    queryKey: ['auth-membership', 'stores', normalizedStoreQuery],
    queryFn: () => searchAuthStores({ query: normalizedStoreQuery, limit: 20 }),
    enabled: open && normalizedStoreQuery.length >= 2,
  })

  const visibleStores = useMemo(() => {
    const source = normalizedStoreQuery.length >= 2 ? stores.data?.items ?? [] : availableStores
    const byId = new Map(source.map((store) => [store.storeId, store]))
    for (const storeId of draft.storeIds) {
      const selected = availableStores.find((store) => store.storeId === storeId)
      if (selected) byId.set(storeId, selected)
    }
    return Array.from(byId.values()).slice(0, 20)
  }, [availableStores, normalizedStoreQuery.length, draft.storeIds, stores.data?.items])

  const validationError = validateMembershipDraft(draft)
  const displayedError = errorMessage ?? (submitted ? validationError : null)

  function patchDraft(patch: Partial<MembershipDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function selectEmployee(employee: MembershipEmployee) {
    patchDraft({
      employee,
      ...(draft.roleCode === 'STORE_MANAGER' ? { storeIds: employee.storeId ? [employee.storeId] : [] } : {}),
    })
  }

  function toggleStore(storeId: string) {
    if (draft.roleCode === 'STORE_MANAGER') return
    patchDraft({
      storeIds: draft.storeIds.includes(storeId)
        ? draft.storeIds.filter((item) => item !== storeId)
        : [...draft.storeIds, storeId].slice(0, 5),
    })
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}>
      <DialogContent
        closeLabel="Kapat"
        className="tw:max-h-[calc(100dvh-1.5rem)] tw:grid-rows-[auto_minmax(0,1fr)_auto] tw:gap-0 tw:overflow-hidden tw:p-0 tw:sm:max-w-4xl"
      >
        <DialogHeader className="tw:border-b tw:px-5 tw:py-4 tw:pr-12">
          <DialogTitle className="tw:text-lg">Yeni üyelik oluştur</DialogTitle>
          <DialogDescription>Personel, giriş, rol ve mağaza bilgilerini birlikte kaydedin.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="tw:min-h-0">
          <form
            id="auth-membership-form"
            className="tw:grid tw:gap-5 tw:p-5"
            onSubmit={(event) => {
              event.preventDefault()
              setSubmitted(true)
              if (validationError) return
              onSubmit(buildMembershipBindingInput(draft))
            }}
          >
            {displayedError ? (
              <Alert variant="destructive">
                <AlertDescription>{displayedError}</AlertDescription>
              </Alert>
            ) : null}

            <section className="tw:grid tw:gap-3" aria-labelledby="membership-personnel-title">
              <div className="tw:flex tw:items-center tw:gap-2">
                <UserRound className="tw:size-4 tw:text-primary" />
                <h3 id="membership-personnel-title" className="tw:text-sm tw:font-semibold">Personel</h3>
              </div>
              <SearchField
                label="Personel ara"
                placeholder="Ad, personel kodu, görev veya mağaza"
                value={personnelQuery}
                onChange={setPersonnelQuery}
              />
              <div className="tw:grid tw:max-h-44 tw:gap-2 tw:overflow-y-auto tw:rounded-lg tw:border tw:bg-muted/25 tw:p-2">
                {normalizedPersonnelQuery.length < 2 ? (
                  <EmptyLine>Aramak için en az 2 karakter yazın.</EmptyLine>
                ) : personnel.isFetching && !personnel.data ? (
                  <EmptyLine>Personeller aranıyor.</EmptyLine>
                ) : personnel.data?.items.length ? (
                  personnel.data.items.map((person) => (
                    <Button
                      aria-pressed={draft.employee?.employeeId === person.employeeId}
                      className="tw:h-auto tw:justify-start tw:whitespace-normal tw:px-3 tw:py-2 tw:text-left"
                      key={person.employeeId}
                      onClick={() =>
                        selectEmployee({
                          employeeId: person.employeeId,
                          displayName: person.displayName,
                          storeId: person.storeId,
                          storeName: person.storeName,
                        })
                      }
                      type="button"
                      variant={draft.employee?.employeeId === person.employeeId ? 'secondary' : 'ghost'}
                    >
                      <span className="tw:grid tw:gap-0.5">
                        <strong>{person.displayName}</strong>
                        <small className="tw:text-muted-foreground">
                          {[person.externalEmployeeRef, person.positionName, person.storeName].filter(Boolean).join(', ')}
                        </small>
                      </span>
                    </Button>
                  ))
                ) : (
                  <EmptyLine>Uygun aktif personel bulunamadı.</EmptyLine>
                )}
              </div>
            </section>

            <section className="tw:grid tw:gap-4 tw:md:grid-cols-2" aria-label="Giriş bilgileri">
              <LabeledInput
                label={draft.authProvider === 'clerk' ? 'Clerk kullanıcı kimliği' : 'OIDC kullanıcı kimliği'}
                onChange={(value) => patchDraft({ providerSubject: value })}
                placeholder="user_..."
                value={draft.providerSubject}
              />
              <label className="tw:grid tw:gap-2 tw:text-sm tw:font-medium">
                Giriş yöntemi
                <Select
                  value={draft.authProvider}
                  onValueChange={(value) => patchDraft({ authProvider: value as MembershipDraft['authProvider'] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clerk">Clerk</SelectItem>
                    <SelectItem value="oidc">OIDC</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <LabeledInput
                label="Kullanıcı adı"
                onChange={(value) => patchDraft({ username: value })}
                placeholder="ad.soyad"
                value={draft.username}
              />
              <LabeledInput
                label="E-posta"
                onChange={(value) => patchDraft({ email: value })}
                placeholder="isim@lufian.com.tr"
                type="email"
                value={draft.email}
              />
            </section>

            <section className="tw:grid tw:gap-4 tw:md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]" aria-label="Rol ve mağazalar">
              <label className="tw:grid tw:h-fit tw:gap-2 tw:text-sm tw:font-medium">
                Rol
                <Select
                  value={draft.roleCode}
                  onValueChange={(value) => {
                    const roleCode = value as MembershipRole
                    patchDraft({
                      roleCode,
                      ...(roleCode === 'STORE_MANAGER'
                        ? { storeIds: draft.employee?.storeId ? [draft.employee.storeId] : [] }
                        : {}),
                    })
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {membershipRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="tw:text-xs tw:font-normal tw:text-muted-foreground">
                  {draft.roleCode === 'STORE_MANAGER'
                    ? 'Personelin aktif mağazası otomatik kullanılır.'
                    : 'Bu rol için 1-5 mağaza seçebilirsiniz.'}
                </span>
              </label>

              <div className="tw:grid tw:gap-2">
                <div className="tw:flex tw:items-center tw:gap-2">
                  <Store className="tw:size-4 tw:text-primary" />
                  <Label htmlFor="membership-store-search">Mağazalar</Label>
                </div>
                <SearchField
                  disabled={draft.roleCode === 'STORE_MANAGER'}
                  id="membership-store-search"
                  label="Mağaza ara"
                  placeholder="Mağaza adı veya kodu"
                  value={storeQuery}
                  onChange={setStoreQuery}
                />
                <div className="tw:grid tw:max-h-48 tw:gap-1 tw:overflow-y-auto tw:rounded-lg tw:border tw:bg-muted/25 tw:p-2">
                  {draft.roleCode === 'STORE_MANAGER' ? (
                    draft.employee?.storeId ? (
                      <StoreChoice
                        checked
                        disabled
                        label={draft.employee.storeName ?? storeLabel(draft.employee.storeId, availableStores)}
                        storeId={draft.employee.storeId}
                        onToggle={toggleStore}
                      />
                    ) : (
                      <EmptyLine>Önce aktif mağazası bulunan bir personel seçin.</EmptyLine>
                    )
                  ) : visibleStores.length ? (
                    visibleStores.map((store) => (
                      <StoreChoice
                        checked={draft.storeIds.includes(store.storeId)}
                        key={store.storeId}
                        label={`${store.storeName ?? store.storeCode} (${store.storeCode})`}
                        storeId={store.storeId}
                        onToggle={toggleStore}
                      />
                    ))
                  ) : (
                    <EmptyLine>Mağaza bulunamadı.</EmptyLine>
                  )}
                </div>
              </div>
            </section>
          </form>
        </ScrollArea>

        <DialogFooter className="tw:mx-0 tw:mb-0 tw:rounded-none tw:px-5 tw:py-4">
          <Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="outline">
            Vazgeç
          </Button>
          <Button disabled={pending} form="auth-membership-form" type="submit">
            <ShieldCheck data-icon="inline-start" />
            {pending ? 'Oluşturuluyor' : 'Üyeliği oluştur'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SearchField({
  disabled,
  id,
  label,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean
  id?: string
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <label className="tw:relative tw:block">
      <span className="tw:sr-only">{label}</span>
      <Search className="tw:absolute tw:top-1/2 tw:left-3 tw:size-4 tw:-translate-y-1/2 tw:text-muted-foreground" />
      <Input
        aria-label={label}
        className="tw:pl-9"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  )
}

function LabeledInput({ label, onChange, ...props }: Omit<ComponentProps<typeof Input>, 'onChange'> & {
  label: string
  onChange: (value: string) => void
}) {
  return (
    <label className="tw:grid tw:gap-2 tw:text-sm tw:font-medium">
      {label}
      <Input {...props} aria-label={label} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function StoreChoice({ checked, disabled, label, onToggle, storeId }: {
  checked: boolean
  disabled?: boolean
  label: string
  onToggle: (storeId: string) => void
  storeId: string
}) {
  return (
    <label className="tw:flex tw:min-h-10 tw:items-center tw:gap-3 tw:rounded-md tw:px-2 tw:text-sm tw:hover:bg-muted/60">
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => onToggle(storeId)} />
      <span>{label}</span>
    </label>
  )
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="tw:m-0 tw:px-2 tw:py-3 tw:text-sm tw:text-muted-foreground">{children}</p>
}

function storeLabel(storeId: string, stores: AuthLookupStore[]) {
  const store = stores.find((item) => item.storeId === storeId)
  return store?.storeName ?? store?.storeCode ?? 'Aktif mağaza'
}
