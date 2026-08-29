import { useParams } from 'react-router'
import { AdminSurfacePage } from './admin-surface-primitives'
import { MasterDataControlCenterPage } from './master-data-control-center-page'
import { MasterDataManagementPage } from './MasterDataManagementPage'

export function MasterDataBootstrapPage() {
  const { batchId } = useParams<{ batchId?: string }>()
  return (
    <AdminSurfacePage ariaLabel="Ana veri yönetimi" className="tw:max-w-none">
      {batchId ? <MasterDataControlCenterPage /> : <MasterDataManagementPage />}
    </AdminSurfacePage>
  )
}
