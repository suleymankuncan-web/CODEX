import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../components/ui/button'
import type {
  MasterDataAuditRow,
  MasterDataImportWorkbenchRow,
  MasterDataIssueRow,
  MasterDataPersonnelWorkbenchRow,
  MasterDataStoreWorkbenchRow,
  MasterDataWorkbenchTab,
} from './master-data-control-center-model'

export function MasterDataWorkbenchTable(input: {
  activeTab: MasterDataWorkbenchTab
  auditRows: MasterDataAuditRow[]
  importRows: MasterDataImportWorkbenchRow[]
  issueRows: MasterDataIssueRow[]
  isLoading: boolean
  personnelRows: MasterDataPersonnelWorkbenchRow[]
  selectedAuditId: string | null
  selectedImportId: string | null
  selectedIssueId: string | null
  selectedPersonnelId: string | null
  selectedStoreId: string | null
  storeRows: MasterDataStoreWorkbenchRow[]
  onSelectAudit: (id: string) => void
  onSelectImport: (id: string) => void
  onSelectIssue: (id: string) => void
  onSelectPersonnel: (id: string) => void
  onSelectStore: (id: string) => void
}) {
  if (input.isLoading) {
    return (
      <div className="master-data-control-center__table-wrap">
        <div className="master-data-control-center__empty">Kayıtlar yükleniyor.</div>
      </div>
    )
  }

  if (input.activeTab === 'issues') {
    return (
      <TableFrame emptyText="Düzeltilecek kayıt bulunamadı." hasRows={input.issueRows.length > 0}>
        <table className="master-data-control-center__table master-data-control-center__table--issues">
          <thead>
            <tr>
              <th>Konu</th>
              <th>Kayıt</th>
              <th>Tip</th>
              <th>Öncelik</th>
              <th>Etki</th>
              <th>Karar</th>
            </tr>
          </thead>
          <tbody>
            {input.issueRows.map((issue) => (
              <tr
                className="master-data-control-center__row"
                data-selected={input.selectedIssueId === issue.id}
                key={issue.id}
                onClick={() => input.onSelectIssue(issue.id)}
              >
                <td>
                  <NameBlock title={issue.problem} subtitle={issue.action} />
                </td>
                <td>{issue.title}</td>
                <td>{formatIssueEntity(issue.entityType)}</td>
                <td><Status tone={severityTone(issue.severity)}>{formatSeverity(issue.severity)}</Status></td>
                <td>{issue.affectedModules.join(', ') || 'Etki yok'}</td>
                <td>
                  <Button size="xs" variant="secondary">
                    Düzelt <ChevronRight data-icon="inline-end" aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    )
  }

  if (input.activeTab === 'stores') {
    return (
      <TableFrame emptyText="Mağaza bulunamadı." hasRows={input.storeRows.length > 0}>
        <table className="master-data-control-center__table">
          <thead>
            <tr>
              <th>Mağaza</th>
              <th>Tip</th>
              <th>Bölge</th>
              <th>Durum</th>
              <th>KPI</th>
              <th>Kontrol</th>
            </tr>
          </thead>
          <tbody>
            {input.storeRows.map((store) => (
              <tr
                className="master-data-control-center__row"
                data-selected={input.selectedStoreId === store.id}
                key={store.id}
                onClick={() => input.onSelectStore(store.id)}
              >
                <td><NameBlock title={store.title} subtitle={store.subtitle} /></td>
                <td>{store.typeLabel}</td>
                <td>{store.region}</td>
                <td><Status tone={storeStatusTone(store.record.status)}>{store.statusLabel}</Status></td>
                <td><Status tone={store.record.kpiImportEnabled ? 'success' : 'neutral'}>{store.kpiLabel}</Status></td>
                <td>
                  <Button size="xs" variant="secondary">
                    Aç <ChevronRight data-icon="inline-end" aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    )
  }

  if (input.activeTab === 'personnel') {
    return (
      <TableFrame emptyText="Personel bulunamadı." hasRows={input.personnelRows.length > 0}>
        <table className="master-data-control-center__table">
          <thead>
            <tr>
              <th>Personel</th>
              <th>Satıcı kodu</th>
              <th>Mağaza</th>
              <th>Pozisyon</th>
              <th>Durum</th>
              <th>Kontrol</th>
            </tr>
          </thead>
          <tbody>
            {input.personnelRows.map((personnel) => (
              <tr
                className="master-data-control-center__row"
                data-selected={input.selectedPersonnelId === personnel.id}
                key={personnel.id}
                onClick={() => input.onSelectPersonnel(personnel.id)}
              >
                <td><NameBlock title={personnel.title} subtitle={personnel.subtitle} /></td>
                <td>{personnel.sellerCodeLabel}</td>
                <td>{personnel.store}</td>
                <td>{personnel.position}</td>
                <td><Status tone={personnelStatusTone(personnel.record.employmentStatus)}>{personnel.statusLabel}</Status></td>
                <td>
                  <Button size="xs" variant="secondary">
                    Aç <ChevronRight data-icon="inline-end" aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    )
  }

  if (input.activeTab === 'imports') {
    return (
      <TableFrame emptyText="Aktarım partisi bulunamadı." hasRows={input.importRows.length > 0}>
        <table className="master-data-control-center__table">
          <thead>
            <tr>
              <th>Parti</th>
              <th>Kapsam</th>
              <th>Satır</th>
              <th>Hazır</th>
              <th>Bekleyen</th>
              <th>Karar</th>
            </tr>
          </thead>
          <tbody>
            {input.importRows.map((item) => (
              <tr
                className="master-data-control-center__row"
                data-selected={input.selectedImportId === item.id}
                key={item.id}
                onClick={() => input.onSelectImport(item.id)}
              >
                <td><NameBlock title={item.title} subtitle={item.subtitle} /></td>
                <td>{item.entityLabel}</td>
                <td>{item.record.rowCount.toLocaleString('tr-TR')}</td>
                <td>{item.record.validCount.toLocaleString('tr-TR')}</td>
                <td>{(item.record.needsReviewCount + item.record.invalidCount).toLocaleString('tr-TR')}</td>
                <td><Status tone={readinessTone(item.record.readiness)}>{item.statusLabel}</Status></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    )
  }

  return (
    <TableFrame emptyText="Geçmiş kaydı bulunamadı." hasRows={input.auditRows.length > 0}>
      <div className="master-data-control-center__timeline">
        {input.auditRows.map((event) => (
          <button
            className="master-data-control-center__audit-row"
            data-selected={input.selectedAuditId === event.id}
            key={event.id}
            type="button"
            onClick={() => input.onSelectAudit(event.id)}
          >
            <span className="master-data-control-center__dot" />
            <span>
              <strong>{event.title}</strong>
              <small>{event.summary}</small>
              <small>{event.actor} · {formatDateTime(event.occurredAt)}</small>
            </span>
          </button>
        ))}
      </div>
    </TableFrame>
  )
}

export function Status(input: { children: ReactNode; tone: string }) {
  return (
    <span className={`master-data-control-center__status master-data-control-center__status--${input.tone}`}>
      {input.children}
    </span>
  )
}

function TableFrame(input: { children: ReactNode; emptyText: string; hasRows: boolean }) {
  return (
    <div className="master-data-control-center__table-wrap">
      {input.hasRows ? input.children : <div className="master-data-control-center__empty">{input.emptyText}</div>}
    </div>
  )
}

function NameBlock(input: { title: string; subtitle: string }) {
  return (
    <span className="master-data-control-center__name">
      <strong>{input.title}</strong>
      <small>{input.subtitle}</small>
    </span>
  )
}

function formatIssueEntity(value: MasterDataIssueRow['entityType']) {
  if (value === 'store') return 'Mağaza'
  if (value === 'personnel') return 'Personel'
  if (value === 'assignment') return 'Atama'
  return 'İçe aktarım'
}

function formatSeverity(value: MasterDataIssueRow['severity']) {
  if (value === 'critical') return 'Kritik'
  if (value === 'warning') return 'Uyarı'
  return 'Bilgi'
}

function severityTone(value: MasterDataIssueRow['severity']) {
  if (value === 'critical') return 'danger'
  if (value === 'warning') return 'warning'
  return 'info'
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

function readinessTone(value: string) {
  if (value === 'ready_to_promote' || value === 'promote_ready_rows') return 'success'
  if (value === 'needs_review' || value === 'needs_validation') return 'warning'
  if (value === 'blocked') return 'danger'
  return 'neutral'
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
