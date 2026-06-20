import { useState } from 'react'
import {
  CircleDollarSign,
  ClipboardCheck,
  Download,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Store,
  TrendingUp,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  StoreCommandBar,
  StoreCommandPersonLink,
  StoreCommandSheetContent,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStatusBadge,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from '../pages/store-surface-primitives'
import { PeriodPicker } from '../pages/store-incentives-period-picker'
import {
  formatMoneyDisplayValue,
  formatMoneyEditValue,
  getPrototypeFinalChange,
  prototypeStores,
  rateTables,
  toMoneyEditValue,
  type PersonnelPrototypeRow,
  type PrototypeFinalChange,
} from './store-incentives-region-manager-command-v2-model'

const prototypePrimaryActionClass =
  'tw:bg-gradient-to-r tw:from-primary tw:to-accent tw:text-primary-foreground tw:shadow-lg tw:shadow-primary/20 tw:hover:from-primary/90 tw:hover:to-accent/90'

export function StoreIncentivesRegionManagerCommandV2Prototype() {
  const [selectedPeriod, setSelectedPeriod] = useState('2026-06')
  const [selectedStoreId, setSelectedStoreId] = useState(prototypeStores[0]!.id)
  const [reviewedStoreIds, setReviewedStoreIds] = useState(
    new Set(prototypeStores.filter((storeRow) => storeRow.reviewed).map((storeRow) => storeRow.id)),
  )
  const [selectedPerson, setSelectedPerson] = useState<PersonnelPrototypeRow | null>(null)
  const [submitOpen, setSubmitOpen] = useState(false)
  const reviewedCount = reviewedStoreIds.size
  const pendingCount = prototypeStores.length - reviewedCount
  const selectedStore = prototypeStores.find((storeRow) => storeRow.id === selectedStoreId) ?? prototypeStores[0]!

  const toggleReviewed = (storeId: string, checked: boolean) => {
    setReviewedStoreIds((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(storeId)
      } else {
        next.delete(storeId)
      }
      return next
    })
  }

  return (
    <StoreSurfacePage
      ariaLabel="Primler"
      className="store-incentives-command-prototype"
      testId="store-incentives-command-prototype"
    >
      <StoreCommandBar
        title="Primler"
        description="Bölge hakediş kontrol ekranı"
        end={(
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <Button type="button" variant="outline">
              <Download data-icon="inline-start" />
              Excel dışa aktar
            </Button>
            <Button className={prototypePrimaryActionClass} type="button" onClick={() => setSubmitOpen(true)}>
              <Send data-icon="inline-start" />
              Onaya gönder
            </Button>
          </div>
        )}
      />

      <StoreSurfaceHeader
        title="Primler"
        description="Mağaza ve personel hakedişleri, düzeltmeler ve onay süreci."
        icon={<CircleDollarSign size={23} />}
      />

      <StoreMetricGrid ariaLabel="Prim üst özeti">
        <StoreMetricCard
          title="Toplam hakediş"
          value="1.286.450,75 TL"
          note="Mağaza müdürü ve ekip toplamı"
          icon={<WalletCards size={20} />}
          tone="plum"
        />
        <StoreMetricCard
          title="Prim hakeden personel"
          value="138"
          note="%80 kapısı geçen mağazalarda"
          icon={<UsersRound size={20} />}
          tone="mint"
        />
        <StoreMetricCard
          title="Düzeltme yapılan kayıt"
          value="7"
          note="Notlu değişiklikler"
          icon={<SlidersHorizontal size={20} />}
          tone="amber"
        />
        <StoreMetricCard
          title="Kontrol bekleyen mağaza"
          value={pendingCount}
          note="Gönderim öncesi kontrol"
          icon={<ClipboardCheck size={20} />}
          tone="cyan"
        />
      </StoreMetricGrid>

      <section
        aria-label="Prim filtreleri"
        className="tw:rounded-2xl tw:border tw:border-border/80 tw:bg-card/80 tw:p-3 tw:shadow-sm"
      >
        <div className="tw:grid tw:gap-2 tw:lg:grid-cols-[minmax(13rem,0.75fr)_minmax(18rem,1.2fr)_minmax(12rem,0.75fr)_auto]">
          <div className="tw:flex tw:h-11 tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/80 tw:px-3">
            <span className="tw:shrink-0 tw:text-xs tw:font-medium tw:text-muted-foreground">Dönem</span>
            <div className="tw:min-w-0 tw:flex-1">
              <PeriodPicker
                period={selectedPeriod}
                onChange={setSelectedPeriod}
                triggerClassName="tw:h-9 tw:w-full tw:justify-start tw:border-0 tw:bg-transparent tw:px-0 tw:font-semibold tw:shadow-none tw:hover:bg-transparent tw:focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="tw:flex tw:h-11 tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/80 tw:px-3">
            <span className="tw:shrink-0 tw:text-xs tw:font-medium tw:text-muted-foreground">Mağaza</span>
            <InputGroup className="tw:h-9 tw:flex-1 tw:border-0 tw:bg-transparent tw:shadow-none">
              <InputGroupAddon className="tw:pl-0">
                <Search />
              </InputGroupAddon>
              <InputGroupInput aria-label="Mağaza ara" className="tw:h-9 tw:px-0 tw:font-semibold" defaultValue="İstanbul" />
            </InputGroup>
          </div>

          <div className="tw:flex tw:h-11 tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/80 tw:px-3">
            <span className="tw:shrink-0 tw:text-xs tw:font-medium tw:text-muted-foreground">Durum</span>
            <Select defaultValue="all">
              <SelectTrigger aria-label="Durum" className="tw:h-9 tw:flex-1 tw:border-0 tw:bg-transparent tw:px-0 tw:font-semibold tw:shadow-none tw:focus:ring-0">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="pending_review">Kontrol edilmeli</SelectItem>
                  <SelectItem value="reviewed">Kontrol edildi</SelectItem>
                  <SelectItem value="earning">Hakediş var</SelectItem>
                  <SelectItem value="no_earning">Hakediş yok</SelectItem>
                  <SelectItem value="corrected">Düzeltildi</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="tw:h-11 tw:rounded-xl tw:border-border/80 tw:bg-background/80 tw:px-3 tw:font-semibold tw:shadow-none tw:hover:bg-muted/60"
            type="button"
            variant="outline"
          >
            <RefreshCw data-icon="inline-start" />
            Yenile
          </Button>
        </div>
      </section>

      <StoreSectionCard
        ariaLabel="Mağaza prim hakedişleri"
        title="Mağaza hakedişleri"
        description="Mağazayı açın, personel satırlarını kontrol edin."
        badge={{ label: '24 şirket mağazası', tone: 'accent' }}
      >
        <Accordion
          type="single"
          collapsible
          value={selectedStoreId}
          onValueChange={(value) => {
            setSelectedStoreId(value)
          }}
          className="tw:gap-3"
        >
          {prototypeStores.map((storeRow) => {
            const reviewed = reviewedStoreIds.has(storeRow.id)
            const gatePassed = storeRow.achievementProgress >= 80

            return (
              <AccordionItem
                className="tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card/90 tw:shadow-sm tw:data-[state=open]:shadow-xl tw:data-[state=open]:ring-1 tw:data-[state=open]:ring-primary/15"
                data-slot="card"
                key={storeRow.id}
                value={storeRow.id}
              >
                <AccordionTrigger
                  className={cn(
                    'tw:relative tw:overflow-hidden tw:px-3.5 tw:py-3 tw:hover:no-underline',
                    gatePassed
                      ? 'tw:bg-chart-2/10 tw:hover:bg-chart-2/15 tw:data-[state=open]:bg-chart-2/15'
                      : 'tw:bg-destructive/10 tw:hover:bg-destructive/15 tw:data-[state=open]:bg-destructive/15',
                  )}
                >
                  <div className="tw:grid tw:w-full tw:min-w-0 tw:gap-3 tw:pr-3 tw:lg:grid-cols-[minmax(14rem,1.1fr)_repeat(5,minmax(7.5rem,0.72fr))_minmax(8.5rem,auto)] tw:lg:items-center">
                    <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
                      <span className="tw:flex tw:size-[38px] tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-primary/10 tw:text-primary">
                        <Store size={17} />
                      </span>
                      <span className="tw:min-w-0">
                        <span className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">{storeRow.name}</span>
                        <span className="tw:mt-0.5 tw:block tw:text-xs tw:text-muted-foreground">Şirket mağazası</span>
                      </span>
                    </div>
                    <PrototypeKv label="Mağaza hedefi" value={storeRow.target} />
                    <PrototypeKv label="Gerçekleşen" value={storeRow.actual} />
                    <div className="tw:grid tw:gap-1">
                      <PrototypeKv label="Hedef" value={storeRow.achievement} />
                      <Progress value={storeRow.achievementProgress} />
                    </div>
                    <PrototypeKv label="Müdür primi" value={storeRow.managerIncentive} />
                    <PrototypeKv label="Ekip primi" value={storeRow.teamIncentive} />
                    <div className="tw:flex tw:flex-wrap tw:items-start tw:gap-2 tw:lg:justify-end">
                      <StoreStatusBadge tone={gatePassed ? 'calm' : 'danger'}>
                        {gatePassed ? '%80 kapısı geçildi' : '%80 kapısı bekliyor'}
                      </StoreStatusBadge>
                      <StoreStatusBadge tone={reviewed ? 'calm' : 'warning'}>
                        {reviewed ? 'Kontrol edildi' : 'Kontrol edilmeli'}
                      </StoreStatusBadge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="tw:border-t tw:border-border tw:bg-muted/20 tw:p-3">
                  <div className="tw:mb-3 tw:flex tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-card/80 tw:p-3 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
                    <label className="tw:inline-flex tw:min-h-8 tw:items-center tw:gap-2 tw:rounded-full tw:border tw:border-border tw:bg-background tw:px-3 tw:text-xs tw:font-semibold tw:text-foreground">
                      <Checkbox
                        checked={reviewed}
                        onCheckedChange={(checked) => toggleReviewed(storeRow.id, checked === true)}
                      />
                      Kontrol edildi
                    </label>
                    <div className="tw:flex tw:flex-wrap tw:gap-2">
                      <StoreStatusBadge tone={storeRow.personnel.length > 0 ? 'calm' : 'neutral'}>
                        {storeRow.personnel.length > 0 ? 'Personel listesi hazır' : 'Hakediş yok'}
                      </StoreStatusBadge>
                      <StoreStatusBadge tone={gatePassed ? 'calm' : 'danger'}>
                        Hedef {storeRow.achievement}
                      </StoreStatusBadge>
                    </div>
                  </div>

                  {storeRow.personnel.length > 0 ? (
                    <StorePersonnelBreakdown
                      personnel={storeRow.personnel}
                      onSelectPerson={setSelectedPerson}
                    />
                  ) : (
                    <div className="tw:rounded-xl tw:border tw:border-border tw:bg-card/80 tw:p-4">
                      <div className="tw:flex tw:items-center tw:gap-3">
                        <span className="tw:flex tw:size-9 tw:items-center tw:justify-center tw:rounded-xl tw:bg-muted tw:text-muted-foreground">
                          <TrendingUp size={16} />
                        </span>
                        <div>
                          <p className="tw:text-sm tw:font-semibold tw:text-foreground">Prim hakedişi oluşmadı</p>
                          <p className="tw:mt-0.5 tw:text-xs tw:text-muted-foreground">
                            Mağaza kapısı geçildiğinde personel satırları burada açılır.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>

        <div className="tw:mt-4 tw:grid tw:gap-3 tw:lg:grid-cols-2">
          {rateTables.map((table) => (
            <section
              className="tw:rounded-2xl tw:border tw:border-border tw:bg-card/90 tw:p-4 tw:shadow-sm"
              data-slot="card"
              key={table.title}
            >
              <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">{table.title}</h3>
              <div className="tw:mt-3 tw:grid tw:gap-2">
                {table.rows.map(([label, value]) => (
                  <div
                    className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-muted/30 tw:px-3 tw:py-2"
                    key={`${table.title}:${label}`}
                  >
                    <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{label}</span>
                    <strong className="tw:text-sm tw:font-semibold tw:text-foreground">{value}</strong>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </StoreSectionCard>

      <Sheet open={Boolean(selectedPerson)} onOpenChange={(open) => {
        if (!open) setSelectedPerson(null)
      }}>
        {selectedPerson ? <PrototypeCorrectionSheet person={selectedPerson} storeName={selectedStore.name} /> : null}
      </Sheet>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="tw:w-[calc(100vw-64px)] tw:max-w-[30rem] tw:overflow-hidden tw:p-0 tw:sm:max-w-[30rem]">
          <DialogHeader className="tw:border-b tw:border-border tw:bg-muted/20 tw:p-5">
            <div className="tw:flex tw:items-start tw:gap-3">
              <span className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-2xl tw:bg-primary/10 tw:text-primary">
                <Send size={18} />
              </span>
              <div>
                <DialogTitle>Haziran primlerini onaya gönder</DialogTitle>
                <DialogDescription className="tw:mt-1">
                  Kontrol edilen dönem paketi admin onayına gönderilecek.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="tw:grid tw:gap-3 tw:p-5">
            <div className="tw:rounded-2xl tw:border tw:border-border tw:bg-card tw:p-4">
              <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
                <span className="tw:text-sm tw:text-muted-foreground">Toplam hakediş</span>
                <strong className="tw:text-xl tw:font-semibold tw:text-foreground">1.286.450,75 TL</strong>
              </div>
              <div className="tw:mt-4 tw:grid tw:gap-2">
                <PrototypeAmountLine label="Mağaza kontrolü" value={`${reviewedCount}/${prototypeStores.length}`} />
                <PrototypeAmountLine label="Düzeltme yapılan kayıt" value="7" />
                <PrototypeAmountLine label="Gönderim tipi" value="Dönem paketi" />
              </div>
            </div>
            <div className="tw:rounded-2xl tw:border tw:border-border tw:bg-muted/30 tw:p-4">
              <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
                <span className="tw:text-sm tw:font-medium tw:text-foreground">Kontrol ilerlemesi</span>
                <StoreStatusBadge tone={pendingCount === 0 ? 'calm' : 'warning'}>
                  {pendingCount === 0 ? 'Gönderime hazır' : `${pendingCount} mağaza bekliyor`}
                </StoreStatusBadge>
              </div>
              <Progress
                className="tw:mt-3"
                value={(reviewedCount / prototypeStores.length) * 100}
              />
              <p className="tw:mt-3 tw:text-xs tw:leading-5 tw:text-muted-foreground">
                Onaya gönderildiğinde paket dönem bazında tek kayıt olarak admin kontrolüne düşer.
              </p>
            </div>
          </div>
          <DialogFooter className="tw:mx-0 tw:mb-0 tw:flex-row tw:items-center tw:justify-end tw:border-t tw:border-border tw:bg-muted/20 tw:p-4">
            <Button type="button" variant="outline" onClick={() => setSubmitOpen(false)}>
              Vazgeç
            </Button>
            <Button className={prototypePrimaryActionClass} type="button" onClick={() => setSubmitOpen(false)}>
              <Send data-icon="inline-start" />
              Onaya gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StoreSurfacePage>
  )
}

function StorePersonnelBreakdown(input: {
  personnel: PersonnelPrototypeRow[]
  onSelectPerson: (person: PersonnelPrototypeRow) => void
}) {
  return (
    <>
      <div className="tw:hidden tw:lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Personel</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Hedef</TableHead>
              <TableHead>Gerçekleşen</TableHead>
              <TableHead>Hedef %</TableHead>
              <TableHead>Oran</TableHead>
              <TableHead>Hesaplanan</TableHead>
              <TableHead>Final prim</TableHead>
              <TableHead>Değişim</TableHead>
              <TableHead>Not</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {input.personnel.map((person) => {
              const finalChange = getPrototypeFinalChange(person)

              return (
                <TableRow key={person.id}>
                  <TableCell>
                    <StoreCommandPersonLink onClick={() => input.onSelectPerson(person)} type="button">
                      {person.name}
                    </StoreCommandPersonLink>
                  </TableCell>
                  <TableCell>{person.role}</TableCell>
                  <TableCell>{person.target}</TableCell>
                  <TableCell>{person.actual}</TableCell>
                  <TableCell>{person.achievement}</TableCell>
                  <TableCell>{person.rate}</TableCell>
                  <TableCell>{person.calculated}</TableCell>
                  <TableCell>
                    <strong className="tw:text-sm tw:font-semibold tw:text-foreground">{person.final}</strong>
                  </TableCell>
                  <TableCell>
                    <PrototypeChangeBadge change={finalChange} />
                  </TableCell>
                  <TableCell>
                    <StoreStatusBadge tone={person.correctionTone}>{person.correctionLabel}</StoreStatusBadge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:lg:hidden">
        {input.personnel.map((person) => {
          const finalChange = getPrototypeFinalChange(person)

          return (
            <button
              className="tw:rounded-lg tw:border tw:border-border tw:bg-card/80 tw:p-3 tw:text-left"
              key={person.id}
              onClick={() => input.onSelectPerson(person)}
              type="button"
            >
              <span className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">{person.name}</span>
              <span className="tw:block tw:text-xs tw:text-muted-foreground">
                {person.role} / {person.achievement}
              </span>
              <span className="tw:mt-2 tw:flex tw:items-center tw:justify-between tw:gap-3">
                <span className="tw:text-sm tw:font-semibold tw:text-foreground">{person.final}</span>
                <PrototypeChangeBadge change={finalChange} />
              </span>
              <span className="tw:mt-2 tw:flex tw:justify-end">
                <StoreStatusBadge tone={person.correctionTone}>{person.correctionLabel}</StoreStatusBadge>
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}

function PrototypeChangeBadge(input: { change: PrototypeFinalChange }) {
  return (
    <StoreStatusBadge className="tw:font-semibold" tone={input.change.tone}>
      {input.change.label}
    </StoreStatusBadge>
  )
}

function PrototypeKv(input: { label: string; value: string }) {
  return (
    <div className="tw:min-w-0">
      <span className="tw:block tw:text-xs tw:font-medium tw:text-muted-foreground">{input.label}</span>
      <strong className="tw:mt-1 tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-foreground">{input.value}</strong>
    </div>
  )
}

function PrototypeCorrectionSheet(input: { person: PersonnelPrototypeRow; storeName: string }) {
  const [finalAmount, setFinalAmount] = useState(() => formatMoneyDisplayValue(input.person.final))
  const finalChange = getPrototypeFinalChange(input.person)

  return (
    <StoreCommandSheetContent
      className="tw:flex tw:max-h-[calc(100dvh-28px)] tw:flex-col tw:overflow-hidden"
      closeLabel="Kapat"
    >
      <SheetHeader className="tw:border-b tw:border-border tw:bg-gradient-to-br tw:from-primary/5 tw:via-card tw:to-accent/10 tw:p-4">
        <div className="tw:flex tw:items-start tw:justify-between tw:gap-4 tw:pr-8">
          <div className="tw:min-w-0">
            <SheetTitle className="tw:text-base tw:font-semibold tw:tracking-normal">{input.person.name}</SheetTitle>
            <SheetDescription className="tw:mt-1 tw:text-sm">
              {input.person.role}, {input.storeName}
            </SheetDescription>
            <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
              <StoreStatusBadge tone={input.person.correctionTone}>{input.person.correctionLabel}</StoreStatusBadge>
              <StoreStatusBadge tone={input.person.achievementProgress >= 80 ? 'calm' : 'warning'}>
                Hedef {input.person.achievement}
              </StoreStatusBadge>
            </div>
          </div>
        </div>
        <div className="tw:mt-4 tw:grid tw:grid-cols-3 tw:gap-2">
          <PrototypeSheetStat label="Hedef" value={input.person.achievement} />
          <PrototypeSheetStat label="Final" value={input.person.final} />
          <PrototypeSheetStat label="Değişim" value={finalChange.label} />
        </div>
      </SheetHeader>
      <ScrollArea className="tw:min-h-0 tw:flex-1">
        <div className="tw:flex tw:flex-col tw:gap-3 tw:px-4 tw:py-3">
          <section className="tw:rounded-2xl tw:border tw:border-primary/15 tw:bg-card/95 tw:p-3.5 tw:shadow-sm">
            <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">Hakediş özeti</h3>
              <span className="tw:text-sm tw:font-semibold tw:text-foreground">{input.person.achievement}</span>
            </div>
            <Progress className="tw:mt-3" value={input.person.achievementProgress} />
            <div className="tw:mt-3 tw:grid tw:gap-2 tw:sm:grid-cols-2">
              <PrototypeSheetStat label="Hedef" value={input.person.target} />
              <PrototypeSheetStat label="Gerçekleşen" value={input.person.actual} />
              <PrototypeSheetStat label="Prim oranı" value={input.person.rate} />
              <PrototypeSheetStat label="Hesaplanan prim" value={input.person.calculated} />
            </div>
          </section>
          <section className="tw:rounded-2xl tw:border tw:border-border tw:bg-card/95 tw:p-3.5 tw:shadow-sm">
            <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">Düzeltme</h3>
              <PrototypeChangeBadge change={finalChange} />
            </div>
            <FieldGroup className="tw:mt-4 tw:gap-4">
              <Field>
                <FieldLabel htmlFor="prototype-final-incentive">Final prim tutarı</FieldLabel>
                <Input
                  className="tw:h-11 tw:px-3 tw:text-base tw:font-semibold tw:tracking-normal"
                  id="prototype-final-incentive"
                  inputMode="decimal"
                  onBlur={() => setFinalAmount(formatMoneyDisplayValue(finalAmount))}
                  onChange={(event) => setFinalAmount(formatMoneyEditValue(event.target.value))}
                  onFocus={(event) => {
                    const inputElement = event.currentTarget
                    setFinalAmount(toMoneyEditValue(finalAmount))
                    window.requestAnimationFrame(() => inputElement.select())
                  }}
                  value={finalAmount}
                />
                <FieldDescription>Kaydedilen tutar admin onayına bu notla gider.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="prototype-correction-note">Düzeltme notu</FieldLabel>
                <Textarea
                  className="tw:min-h-20 tw:resize-y"
                  id="prototype-correction-note"
                  defaultValue={input.person.note}
                  placeholder="Düzeltme nedenini yazın"
                />
              </Field>
            </FieldGroup>
          </section>
        </div>
      </ScrollArea>
      <SheetFooter className="tw:mx-0 tw:mb-0 tw:border-t tw:border-border tw:bg-muted/25 tw:p-3">
        <div className="tw:flex tw:w-full tw:flex-row tw:items-center tw:justify-end tw:gap-2">
          <Button type="button" variant="secondary">
            <RotateCcw data-icon="inline-start" />
            Eski değere dön
          </Button>
          <Button type="button" variant="outline">
            İptal
          </Button>
          <Button className={prototypePrimaryActionClass} type="button">
            <Save data-icon="inline-start" />
            Kaydet
          </Button>
        </div>
      </SheetFooter>
    </StoreCommandSheetContent>
  )
}

function PrototypeSheetStat(input: { label: string; value: string }) {
  return (
    <div className="tw:min-w-0 tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/70 tw:px-3 tw:py-2">
      <span className="tw:block tw:text-xs tw:font-medium tw:text-muted-foreground">{input.label}</span>
      <strong className="tw:mt-1 tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-foreground">{input.value}</strong>
    </div>
  )
}

function PrototypeAmountLine(input: { label: string; value: string }) {
  return (
    <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
      <span className="tw:text-sm tw:text-muted-foreground">{input.label}</span>
      <span className="tw:text-sm tw:text-foreground">{input.value}</span>
    </div>
  )
}
