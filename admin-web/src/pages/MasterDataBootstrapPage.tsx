import { AdminSurfacePage } from './admin-surface-primitives'
import { MasterDataControlCenterPage } from './master-data-control-center-page'

export function MasterDataBootstrapPage() {
  return (
    <AdminSurfacePage ariaLabel="Ana veri kontrolü" className="tw:max-w-none tw:gap-0 tw:py-0">
      <MasterDataControlCenterPage />
    </AdminSurfacePage>
  )
}
