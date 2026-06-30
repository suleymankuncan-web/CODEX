import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  DatabaseZap,
  History,
  Link2,
  Save,
  UserRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Input } from '../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import type {
  MasterDataBootstrapBatchDetail,
  MasterDataBootstrapPromotionReadinessResponse,
  PersonnelMasterLookups,
  StoreMasterLookups,
} from '../features/integrations/api'
import {
  dateInputValue,
  mergePersonnelPatch,
  mergeStoreMasterPatch,
  normalizeEmploymentType,
  normalizePersonnelStatus,
  normalizeStoreStatus,
  normalizeStoreType,
  type PersonnelMasterPatch,
  type StoreMasterPatch,
} from './master-data-bootstrap-model'
import { getMasterDataImpactModules } from './master-data-impact-rules'
import type {
  MasterDataAuditRow,
  MasterDataImportWorkbenchRow,
  MasterDataIssueRow,
  MasterDataPersonnelWorkbenchRow,
  MasterDataStoreWorkbenchRow,
  MasterDataWorkbenchTab,
} from './master-data-control-center-model'
import { Status } from './master-data-control-center-tables'

const EMPTY_VALUE = '__none'

export function MasterDataDetailPanel(input: {
  activeTab: MasterDataWorkbenchTab
  audit: MasterDataAuditRow | null
  conflictMessage: string | null
  importDetail: MasterDataBootstrapBatchDetail | null
  importReadiness: MasterDataBootstrapPromotionReadinessResponse | null
  importRow: MasterDataImportWorkbenchRow | null
  isImportProcessing: boolean
  isSaving: boolean
  issue: MasterDataIssueRow | null
  personnel: MasterDataPersonnelWorkbenchRow | null
  personnelDraft: PersonnelMasterPatch
  personnelLookups: PersonnelMasterLookups | undefined
  store: MasterDataStoreWorkbenchRow | null
  storeDraft: StoreMasterPatch
  storeLookups: StoreMasterLookups | undefined
  unsavedCount: number
  onIssueEdit: () => void
  onProcessImport: () => void
  onSave: () => void
  onUpdatePersonnelDraft: (employeeId: string, patch: PersonnelMasterPatch) => void
  onUpdateStoreDraft: (storeId: string, patch: StoreMasterPatch) => void
  onValidateImport: () => void
}) {
  if (input.activeTab === 'stores') {
    return (
      <StoreDetail
        conflictMessage={input.conflictMessage}
        draft={input.storeDraft}
        isSaving={input.isSaving}
        lookups={input.storeLookups}
        store={input.store}
        unsavedCount={input.unsavedCount}
        onSave={input.onSave}
        onUpdate={input.onUpdateStoreDraft}
      />
    )
  }

  if (input.activeTab === 'personnel') {
    return (
      <PersonnelDetail
        conflictMessage={input.conflictMessage}
        draft={input.personnelDraft}
        isSaving={input.isSaving}
        lookups={input.personnelLookups}
        personnel={input.personnel}
        unsavedCount={input.unsavedCount}
        onSave={input.onSave}
        onUpdate={input.onUpdatePersonnelDraft}
      />
    )
  }

  if (input.activeTab === 'imports') {
    return (
      <ImportDetail
        detail={input.importDetail}
        isProcessing={input.isImportProcessing}
        readiness={input.importReadiness}
        row={input.importRow}
        onProcess={input.onProcessImport}
        onValidate={input.onValidateImport}
      />
    )
  }

  if (input.activeTab === 'history') {
    return <AuditDetail audit={input.audit} />
  }

  return <IssueDetail issue={input.issue} onIssueEdit={input.onIssueEdit} />
}

function IssueDetail(input: { issue: MasterDataIssueRow | null; onIssueEdit: () => void }) {
  if (!input.issue) {
    return <EmptyDetail title="Düzeltilecek kayıt yok" />
  }

  return (
    <DetailFrame
      icon={<AlertTriangle aria-hidden="true" />}
      status={<Status tone={severityTone(input.issue.severity)}>{formatSeverity(input.issue.severity)}</Status>}
      subtitle={`${input.issue.sourceLabel} · ${input.issue.title}`}
      title={input.issue.problem}
    >
      <div className="master-data-control-center__alert-block">
        <strong>{input.issue.action}</strong>
        <span>{input.issue.subtitle}</span>
      </div>
      <ImpactList modules={input.issue.affectedModules.map((module) => ({ module, effect: 'Bu kayıt düzeldiğinde ilgili akış güncellenir.', tone: 'info' }))} />
      <Button onClick={input.onIssueEdit}>
        Düzelt <ArrowRightLeft data-icon="inline-end" aria-hidden="true" />
      </Button>
    </DetailFrame>
  )
}

function StoreDetail(input: {
  conflictMessage: string | null
  draft: StoreMasterPatch
  isSaving: boolean
  lookups: StoreMasterLookups | undefined
  store: MasterDataStoreWorkbenchRow | null
  unsavedCount: number
  onSave: () => void
  onUpdate: (storeId: string, patch: StoreMasterPatch) => void
}) {
  if (!input.store) {
    return <EmptyDetail title="Mağaza seçilmedi" />
  }

  const effective = mergeStoreMasterPatch(input.store.record, input.draft, input.lookups)
  const modules = getMasterDataImpactModules({
    entityType: 'store',
    changedFields: Object.keys(input.draft),
  })

  return (
    <DetailFrame
      icon={<Building2 aria-hidden="true" />}
      status={<Status tone={storeStatusTone(effective.status)}>{input.store.statusLabel}</Status>}
      subtitle={`${input.store.subtitle} · ${input.store.region}`}
      title={input.store.title}
    >
      <div className="master-data-control-center__mini-grid">
        <MiniCard label="Tip" value={input.store.typeLabel} />
        <MiniCard label="Bölge" value={input.store.region} />
        <MiniCard label="KPI" value={input.store.kpiLabel} />
        <MiniCard label="Güncelleme" value={formatDate(input.store.updatedAt)} />
      </div>
      <div className="master-data-control-center__form">
        <SectionTitle icon={<ArrowRightLeft aria-hidden="true" />} title="İlişki düzeltme" />
        <Select
          value={normalizeStoreType(effective.storeType)}
          onValueChange={(value) => input.onUpdate(input.store!.id, { storeType: normalizeStoreType(value) })}
        >
          <SelectTrigger aria-label="Mağaza tipi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(input.lookups?.storeTypes ?? [
              { value: 'company', label: 'Şirket mağazası' },
              { value: 'franchise', label: 'Bayi' },
              { value: 'operator', label: 'İşletme' },
            ]).map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={effective.regionId ?? EMPTY_VALUE}
          onValueChange={(value) =>
            input.onUpdate(input.store!.id, { regionId: value === EMPTY_VALUE ? '' : value })
          }
        >
          <SelectTrigger aria-label="Bölge müdürü">
            <SelectValue placeholder="Bölge seç" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_VALUE}>Bölge seç</SelectItem>
            {(input.lookups?.regions ?? []).map((region) => (
              <SelectItem key={region.regionId} value={region.regionId}>
                {region.regionName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={normalizeStoreStatus(effective.status)}
          onValueChange={(value) => input.onUpdate(input.store!.id, { status: normalizeStoreStatus(value) })}
        >
          <SelectTrigger aria-label="Mağaza durumu">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(input.lookups?.statuses ?? [
              { value: 'active', label: 'Aktif' },
              { value: 'inactive', label: 'Pasif' },
              { value: 'closed', label: 'Kapalı' },
            ]).map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="master-data-control-center__checkbox-row">
          <Checkbox
            checked={effective.kpiImportEnabled}
            onCheckedChange={(checked) =>
              input.onUpdate(input.store!.id, { kpiImportEnabled: checked === true })
            }
          />
          <span>KPI aktarımına dahil</span>
        </label>
        <Textarea aria-label="Not" placeholder="Kontrol notu" />
      </div>
      <ImpactList modules={modules} />
      <SaveBar
        conflictMessage={input.conflictMessage}
        disabled={input.unsavedCount === 0 || input.isSaving}
        isSaving={input.isSaving}
        unsavedCount={input.unsavedCount}
        onSave={input.onSave}
      />
    </DetailFrame>
  )
}

function PersonnelDetail(input: {
  conflictMessage: string | null
  draft: PersonnelMasterPatch
  isSaving: boolean
  lookups: PersonnelMasterLookups | undefined
  personnel: MasterDataPersonnelWorkbenchRow | null
  unsavedCount: number
  onSave: () => void
  onUpdate: (employeeId: string, patch: PersonnelMasterPatch) => void
}) {
  if (!input.personnel) {
    return <EmptyDetail title="Personel seçilmedi" />
  }

  const effective = mergePersonnelPatch(input.personnel.record, input.draft)
  const modules = getMasterDataImpactModules({
    entityType: 'personnel',
    changedFields: Object.keys(input.draft),
  })

  return (
    <DetailFrame
      icon={<UserRound aria-hidden="true" />}
      status={<Status tone={personnelStatusTone(effective.employmentStatus)}>{input.personnel.statusLabel}</Status>}
      subtitle={`${input.personnel.position} · ${input.personnel.store}`}
      title={input.personnel.title}
    >
      <div className="master-data-control-center__mini-grid">
        <MiniCard label="Satıcı kodu" value={input.personnel.sellerCodeLabel} />
        <MiniCard label="Mağaza" value={input.personnel.store} />
        <MiniCard label="Pozisyon" value={input.personnel.position} />
        <MiniCard label="Güncelleme" value={formatDate(input.personnel.updatedAt)} />
      </div>
      <div className="master-data-control-center__form">
        <SectionTitle icon={<ArrowRightLeft aria-hidden="true" />} title="Personel düzeltme" />
        <Input
          aria-label="Ad"
          value={effective.firstName}
          onChange={(event) => input.onUpdate(input.personnel!.id, { firstName: event.target.value })}
        />
        <Input
          aria-label="Soyad"
          value={effective.lastName}
          onChange={(event) => input.onUpdate(input.personnel!.id, { lastName: event.target.value })}
        />
        <Input
          aria-label="Satıcı kodu"
          value={effective.externalEmployeeRef}
          onChange={(event) => input.onUpdate(input.personnel!.id, { externalEmployeeRef: event.target.value })}
        />
        <Select
          value={effective.storeId || EMPTY_VALUE}
          onValueChange={(value) =>
            input.onUpdate(input.personnel!.id, { storeId: value === EMPTY_VALUE ? '' : value })
          }
        >
          <SelectTrigger aria-label="Mağaza">
            <SelectValue placeholder="Mağaza seç" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_VALUE}>Mağaza seç</SelectItem>
            {(input.lookups?.stores ?? []).map((store) => (
              <SelectItem key={store.storeId} value={store.storeId}>
                {store.storeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={effective.positionId || EMPTY_VALUE}
          onValueChange={(value) =>
            input.onUpdate(input.personnel!.id, { positionId: value === EMPTY_VALUE ? '' : value })
          }
        >
          <SelectTrigger aria-label="Pozisyon">
            <SelectValue placeholder="Pozisyon seç" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_VALUE}>Pozisyon seç</SelectItem>
            {(input.lookups?.positions ?? []).map((position) => (
              <SelectItem key={position.positionId} value={position.positionId}>
                {position.positionName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={normalizePersonnelStatus(effective.employmentStatus)}
          onValueChange={(value) =>
            input.onUpdate(input.personnel!.id, { employmentStatus: normalizePersonnelStatus(value) })
          }
        >
          <SelectTrigger aria-label="Çalışma durumu">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(input.lookups?.employmentStatuses ?? [
              { value: 'active', label: 'Aktif' },
              { value: 'inactive', label: 'Pasif' },
              { value: 'terminated', label: 'Ayrıldı' },
            ]).map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={normalizeEmploymentType(effective.employmentType)}
          onValueChange={(value) =>
            input.onUpdate(input.personnel!.id, { employmentType: normalizeEmploymentType(value) })
          }
        >
          <SelectTrigger aria-label="Çalışma tipi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(input.lookups?.employmentTypes ?? [
              { value: 'full_time', label: 'Tam zamanlı' },
              { value: 'part_time', label: 'Yarı zamanlı' },
              { value: 'temporary', label: 'Geçici' },
            ]).map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="İşe giriş"
          type="date"
          value={dateInputValue(effective.hireDate)}
          onChange={(event) => input.onUpdate(input.personnel!.id, { hireDate: event.target.value })}
        />
        <Textarea aria-label="Not" placeholder="Kontrol notu" />
      </div>
      <ImpactList modules={modules} />
      <SaveBar
        conflictMessage={input.conflictMessage}
        disabled={input.unsavedCount === 0 || input.isSaving}
        isSaving={input.isSaving}
        unsavedCount={input.unsavedCount}
        onSave={input.onSave}
      />
    </DetailFrame>
  )
}

function ImportDetail(input: {
  detail: MasterDataBootstrapBatchDetail | null
  isProcessing: boolean
  readiness: MasterDataBootstrapPromotionReadinessResponse | null
  row: MasterDataImportWorkbenchRow | null
  onProcess: () => void
  onValidate: () => void
}) {
  if (!input.row) {
    return <EmptyDetail title="Aktarım partisi seçilmedi" />
  }

  const blocked = input.readiness?.summary.blockedCount ?? input.row.record.invalidCount
  const ready = input.readiness?.summary.readyCount ?? input.row.record.validCount
  const canProcess = input.readiness?.summary.canPromote ?? input.row.record.readiness === 'ready_to_promote'

  return (
    <DetailFrame
      icon={<DatabaseZap aria-hidden="true" />}
      status={<Status tone={canProcess ? 'success' : 'warning'}>{canProcess ? 'Kayda hazır' : 'Kontrol gerekli'}</Status>}
      subtitle={`${input.row.entityLabel} · ${input.row.record.rowCount.toLocaleString('tr-TR')} satır`}
      title={input.row.title}
    >
      <div className="master-data-control-center__mini-grid">
        <MiniCard label="Kayda hazır" value={ready.toLocaleString('tr-TR')} />
        <MiniCard label="Bekleyen" value={blocked.toLocaleString('tr-TR')} />
        <MiniCard label="Toplam satır" value={input.row.record.rowCount.toLocaleString('tr-TR')} />
        <MiniCard label="Durum" value={input.row.statusLabel} />
      </div>
      <div className="master-data-control-center__timeline master-data-control-center__timeline--compact">
        {(input.detail?.rows.items ?? []).slice(0, 4).map((row) => (
          <div className="master-data-control-center__audit-line" key={row.rowId}>
            <span className="master-data-control-center__dot" />
            <span>
              <strong>#{row.rowNumber} {row.sourceEmployeeCode ?? row.sourceStoreCode ?? 'Kayıt'}</strong>
              <small>{formatReadiness(row.validationStatus)}</small>
            </span>
          </div>
        ))}
        {!input.detail?.rows.items.length ? (
          <div className="master-data-control-center__empty master-data-control-center__empty--compact">
            Satır detayı bekleniyor.
          </div>
        ) : null}
      </div>
      <div className="master-data-control-center__row-actions">
        <Button disabled={input.isProcessing} variant="outline" onClick={input.onValidate}>Kontrol</Button>
        <Button disabled={input.isProcessing || !canProcess} onClick={input.onProcess}>Kayda işle</Button>
      </div>
    </DetailFrame>
  )
}

function AuditDetail(input: { audit: MasterDataAuditRow | null }) {
  if (!input.audit) {
    return <EmptyDetail title="Geçmiş kaydı seçilmedi" />
  }

  return (
    <DetailFrame
      icon={<History aria-hidden="true" />}
      status={<Status tone="neutral">Kayıtlı</Status>}
      subtitle={`${input.audit.actor} · ${formatDate(input.audit.occurredAt)}`}
      title={input.audit.title}
    >
      <div className="master-data-control-center__alert-block master-data-control-center__alert-block--neutral">
        <strong>{input.audit.summary}</strong>
        <span>{formatAuditEntity(input.audit.entityType)}</span>
      </div>
    </DetailFrame>
  )
}

function DetailFrame(input: {
  children: ReactNode
  icon: ReactNode
  status: ReactNode
  subtitle: string
  title: string
}) {
  return (
    <aside className="master-data-control-center__detail" aria-label="Ana veri detayı">
      <div className="master-data-control-center__detail-inner">
        <div>
          <div className="master-data-control-center__chipline">
            <span className="master-data-control-center__detail-icon">{input.icon}</span>
            {input.status}
          </div>
          <h2>{input.title}</h2>
          <p>{input.subtitle}</p>
        </div>
        {input.children}
      </div>
    </aside>
  )
}

function EmptyDetail(input: { title: string }) {
  return (
    <aside className="master-data-control-center__detail" aria-label="Ana veri detayı">
      <div className="master-data-control-center__detail-inner">
        <h2>{input.title}</h2>
        <p>Soldaki listeden bir kayıt seçin.</p>
      </div>
    </aside>
  )
}

function MiniCard(input: { label: string; value: string }) {
  return (
    <div className="master-data-control-center__mini-card">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

function SectionTitle(input: { icon: ReactNode; title: string }) {
  return (
    <div className="master-data-control-center__section-title">
      {input.icon}
      <strong>{input.title}</strong>
    </div>
  )
}

function ImpactList(input: { modules: Array<{ module: string; effect: string; tone: string }> }) {
  return (
    <div className="master-data-control-center__impact-list">
      <SectionTitle icon={<Link2 aria-hidden="true" />} title="Bu değişiklik nerede görünür?" />
      {input.modules.length ? (
        input.modules.map((item) => (
          <div className="master-data-control-center__impact-row" key={`${item.module}-${item.effect}`}>
            <Status tone={item.tone}>{item.module}</Status>
            <span>{item.effect}</span>
          </div>
        ))
      ) : (
        <div className="master-data-control-center__empty master-data-control-center__empty--compact">
          Değişiklik seçildiğinde etki burada görünür.
        </div>
      )}
    </div>
  )
}

function SaveBar(input: {
  conflictMessage: string | null
  disabled: boolean
  isSaving: boolean
  unsavedCount: number
  onSave: () => void
}) {
  return (
    <div className="master-data-control-center__savebar">
      <div>
        <Status tone={input.unsavedCount > 0 ? 'warning' : 'neutral'}>
          {input.unsavedCount > 0 ? `${input.unsavedCount} kaydedilmemiş değişiklik` : 'Değişiklik yok'}
        </Status>
        {input.conflictMessage ? <small>{input.conflictMessage}</small> : null}
      </div>
      <Button disabled={input.disabled} onClick={input.onSave}>
        <Save data-icon="inline-start" aria-hidden="true" />
        {input.isSaving ? 'Kaydediliyor' : 'Kaydet'}
      </Button>
    </div>
  )
}

function severityTone(value: MasterDataIssueRow['severity']) {
  if (value === 'critical') return 'danger'
  if (value === 'warning') return 'warning'
  return 'info'
}

function formatSeverity(value: MasterDataIssueRow['severity']) {
  if (value === 'critical') return 'Kritik'
  if (value === 'warning') return 'Uyarı'
  return 'Bilgi'
}

function storeStatusTone(value: string) {
  if (value === 'active') return 'success'
  if (value === 'closed') return 'danger'
  return 'neutral'
}

function personnelStatusTone(value: string) {
  if (value === 'active') return 'success'
  if (value === 'terminated') return 'danger'
  return 'neutral'
}

function formatDate(value: string | null) {
  if (!value) return 'Yok'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatReadiness(value: string) {
  if (value === 'valid' || value === 'ready' || value === 'ready_to_promote') return 'Hazır'
  if (value === 'invalid' || value === 'blocked') return 'Bekleyen'
  if (value === 'needs_review') return 'İnceleme'
  if (value === 'promoted') return 'Kayda işlendi'
  return value
}

function formatAuditEntity(value: MasterDataAuditRow['entityType']) {
  if (value === 'store') return 'Mağaza kaydı'
  if (value === 'personnel') return 'Personel kaydı'
  return 'İçe aktarım'
}
